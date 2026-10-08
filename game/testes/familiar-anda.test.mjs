// O FAMILIAR (Summon) anda atrás do dono, tile por tile, pela busca da caçada (dono, 03/10): antes, passou de `perto` casas, ele era reposicionado do lado
// do dono de uma vez (o "puxão"). Cenários no `tique` de verdade, em grades desenhadas (como `progresso-da-hunt.test.mjs`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Cacadas from '../systems/cacadas.mjs';
import * as R from '../systems/regras.mjs';
import * as Summon from '../systems/summon.mjs';
import { ACTION_CATALOG } from '../systems/dados.mjs';
import { gradesCacheadas } from '../systems/hunt/terreno.mjs';
import * as Caminho from '../systems/hunt/caminho.mjs';
import { personagemDeTeste, PERSONAGEM, HUNT_DE_TESTE } from './apoio.mjs';

let proximaGrade = 0;

/**
 * Uma grade a partir de um desenho: `.` chão, `#` parede, `P` o personagem,
 * `M` o alvo (e `m` outros bichos) — as três letras são chão também.
 */
function desenho(linhas) {
  const andavel = new Set();
  const achados = { P: null, M: null, m: [] };
  linhas.forEach((linha, y) =>
    [...linha].forEach((c, x) => {
      if (c !== '#') andavel.add(`${x},${y}`);
      if (c === 'P') achados.P = { x, y };
      if (c === 'M') achados.M = { x, y };
      if (c === 'm') achados.m.push({ x, y });
    }),
  );
  const id = `teste-progresso-${++proximaGrade}`;
  const grade = { z: 7, minX: 0, maxX: linhas[0].length - 1, minY: 0, maxY: linhas.length - 1, andavel };
  /*
   * Contador de buscas: toda BFS (`bfsDistancias`) lê `grade.numerica` logo de
   * cara. Um getter aqui conta quantas buscas o tique fez nesta grade.
   */
  const numerica = Caminho.gradeNumerica({ ...grade });
  const buscas = { n: 0 };
  Object.defineProperty(grade, 'numerica', {
    get() {
      buscas.n++;
      return Caminho.gradeNumerica({ ...grade }); // recalculada a cada leitura: o teste da porta que abre muda `andavel` no meio
    },
  });
  gradesCacheadas.set(id, grade);
  return { id, grade, buscas, ...achados };
}

let uid = 900_000;
const bicho = (pos, extra = {}) => ({
  uid: ++uid, key: null, name: 'Alvo de Teste', look: 0, x: pos.x, y: pos.y, dir: 2,
  hp: 1e9, maxHp: 1e9, exp: 0, loot: [], perseguindo: true, proximoPasso: Infinity, ...extra,
});

/**
 * Um personagem caçando no desenho. `distancia` > 0 é o kite (sorcerer com
 * wand); 0 é corpo a corpo (knight). O bicho fica parado (`proximoPasso:
 * Infinity`) a menos que o teste o mova.
 */
function naGrade(linhas, { vocacao = 'knight', distancia = 0, percurso = null } = {}) {
  const g = desenho(linhas);
  const e = personagemDeTeste({ vocacao, level: 600 });
  e.settings.distance = distancia;
  assert.equal(Cacadas.entrar(e, { huntId: HUNT_DE_TESTE, mode: 'auto', strategy: 'nearest' }).ok, true);
  const alvo = bicho(g.M);
  Object.assign(e.hunt, {
    huntId: g.id, z: 7, pos: { ...g.P, dir: 2 }, percurso, respawns: [], outrosAndares: {},
    monstros: [alvo, ...g.m.map((p) => bicho(p, { name: 'Outro' }))],
  });
  if (percurso) g.grade.percurso = percurso.pontos;
  return { e, alvo, grade: g.grade, buscas: g.buscas };
}

/** `n` tiques de 250 ms; `antes(i)` roda antes de cada um (o teste mexe no bicho ali). Devolve as casas, tique a tique. */
const relogios = new WeakMap();
function rodar(e, n, antes = () => {}) {
  // O relógio continua de uma chamada para a outra (o passo seguinte já está agendado nele).
  let agora = relogios.get(e) ?? Date.now();
  if (!relogios.has(e)) e.hunt.ultimoTique = agora;
  const casas = [];
  for (let i = 0; i < n; i++) {
    antes(i);
    agora += R.PASSO_MS;
    e.hp = e.maxHp = 1e12;
    Cacadas.tique(e, PERSONAGEM, agora);
    casas.push(`${e.hunt.pos.x},${e.hunt.pos.y}`);
  }
  relogios.set(e, agora);
  return casas;
}

/** Os passos dados (casas diferentes seguidas), sem as paradas. */
const passos = (casas) => casas.filter((c, i) => i === 0 || c !== casas[i - 1]);

/**
 * Quantas vezes o personagem VOLTOU a uma casa de onde já tinha saído — o
 * sintoma de qualquer ciclo (A → B → A, A → B → B → A, A → B → C → A).
 */
function retornos(casas) {
  const vistas = new Set();
  let n = 0;
  for (const c of passos(casas)) {
    if (vistas.has(c)) n++;
    vistas.add(c);
  }
  return n;
}

const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));


/** O dono caçando no desenho (`P`), o familiar invocado (já na casa do dono), sem bicho a menos que o desenho tenha `M`/`m`. */
function comFamiliar(linhas, { vocacao = 'knight', perto = 3 } = {}) {
  const g = desenho(linhas);
  const e = personagemDeTeste({ vocacao, level: 300 });
  e.maxHp = e.hp = 1e12;
  assert.ok(Cacadas.entrar(e, { huntId: HUNT_DE_TESTE, mode: 'auto', strategy: 'nearest' }).ok);
  const h = e.hunt;
  Object.assign(h, { huntId: g.id, z: 7, pos: { ...g.P, dir: 2 }, percurso: null, respawns: [], outrosAndares: {}, monstros: [...(g.M ? [bicho(g.M)] : []), ...g.m.map((p) => bicho(p, { name: 'Outro' }))] });
  const agora = 1e9;
  h.ultimoTique = agora;
  Summon.invocar(e, h, { summonPerto: perto, summonAlcance: 3 }, agora);
  relogios.set(e, agora);
  return { e, h, g };
}

/** `n` tiques; `antes(i)` mexe no dono. Devolve a trilha do familiar, tique a tique. */
function tiqueDoDono(e, h, n, antes = () => {}) {
  let agora = relogios.get(e);
  const trilha = [];
  for (let i = 0; i < n; i++) {
    antes(i);
    agora += R.PASSO_MS;
    e.hp = e.maxHp = 1e12;
    Cacadas.tique(e, PERSONAGEM, agora);
    const f = h.summon;
    trilha.push(f ? { x: f.x, y: f.y } : null);
  }
  relogios.set(e, agora);
  return trilha;
}
/** O dono andando por `rota` (uma casa por tique, por conta do teste). */
const andarPor = (h, rota) => (i) => { const p = rota[Math.min(i, rota.length - 1)]; h.pos.x = p.x; h.pos.y = p.y; };
const saltos = (trilha) => Math.max(...trilha.slice(1).map((c, i) => cheb(c, trilha[i])));
const reta = (x0, x1, y) => Array.from({ length: x1 - x0 + 1 }, (_, k) => ({ x: x0 + k, y }));

test('F1. o familiar sai da casa do dono com UM passo de uma casa (não é teleporte) e para a até `perto` casas', () => {
  const { e, h } = comFamiliar(['..........', '.P........', '..........']);
  const trilha = tiqueDoDono(e, h, 6);
  assert.ok(cheb(trilha[0], h.pos) === 1, `deveria sair da casa do dono: ${JSON.stringify(trilha[0])}`);
  assert.ok(saltos(trilha) <= 1, `saltou ${saltos(trilha)} casas num tique`);
});

test('F2. o dono anda 25 casas em linha reta: o familiar acompanha andando, sem nenhum salto, e fica a até `perto` casas', () => {
  const { e, h } = comFamiliar(['.'.repeat(40), '.P' + '.'.repeat(38), '.'.repeat(40)]);
  const rota = reta(1, 26, 1);
  const trilha = tiqueDoDono(e, h, 60, andarPor(h, rota));
  assert.ok(saltos(trilha) <= 2, `salto de ${saltos(trilha)} casas`);
  assert.ok(cheb(trilha.at(-1), h.pos) <= 3 && cheb(trilha.at(-1), h.pos) >= 1, `terminou a ${cheb(trilha.at(-1), h.pos)} do dono`);
  const percorridas = new Set(trilha.map((c) => `${c.x},${c.y}`));
  assert.ok(percorridas.size >= 15, 'passou pelas casas do caminho (não apareceu de uma vez)');
  // Parado, o dono: o familiar também não anda mais (as últimas 10 posições são iguais).
  assert.equal(new Set(trilha.slice(-10).map((c) => `${c.x},${c.y}`)).size, 1);
});

test('F3. diagonal: o dono vai na diagonal e o familiar também anda na diagonal, uma casa por vez', () => {
  const { e, h } = comFamiliar([...Array.from({ length: 30 }, (_, y) => (y === 1 ? '.P' + '.'.repeat(28) : '.'.repeat(30)))]);
  const rota = Array.from({ length: 20 }, (_, k) => ({ x: 1 + k, y: 1 + k }));
  const trilha = tiqueDoDono(e, h, 50, andarPor(h, rota));
  assert.ok(saltos(trilha) <= 2);
  assert.ok(cheb(trilha.at(-1), h.pos) <= 3);
});

test('F4. parede e corredor estreito: o familiar contorna pelo caminho de verdade (passa por todas as casas do corredor)', () => {
  const linhas = [
    '###########',
    '#P...#....#',
    '###.##.####',
    '###.##.####',
    '#...#..#..#',
    '#.#####.#.#',
    '#.......#.#',
    '###########',
  ];
  const { e, h } = comFamiliar(linhas, { perto: 1 });
  const rota = [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 3, y: 2 }, { x: 3, y: 3 }, { x: 3, y: 4 }, { x: 2, y: 4 }, { x: 1, y: 4 }, { x: 1, y: 5 }, { x: 1, y: 6 }, { x: 2, y: 6 }, { x: 3, y: 6 }, { x: 4, y: 6 }, { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 7, y: 6 }, { x: 7, y: 5 }, { x: 7, y: 4 }];
  const trilha = tiqueDoDono(e, h, 120, (i) => andarPor(h, rota)(Math.floor(i / 2)));
  assert.ok(saltos(trilha) <= 2, `saltou ${saltos(trilha)}`);
  assert.ok(cheb(trilha.at(-1), h.pos) <= 2, `ficou a ${cheb(trilha.at(-1), h.pos)} do dono`);
  const noChao = new Set();
  linhas.forEach((l, y) => [...l].forEach((c, x) => { if (c !== '#') noChao.add(`${x},${y}`); }));
  for (const c of trilha) assert.ok(noChao.has(`${c.x},${c.y}`), `atravessou parede em ${c.x},${c.y}`);
});

test('F5. perto o bastante, o familiar não anda; o dono se afasta e ele retoma; sem vaivém', () => {
  const { e, h } = comFamiliar(['.'.repeat(40), '.P' + '.'.repeat(38), '.'.repeat(40)]);
  tiqueDoDono(e, h, 8);
  const parado = tiqueDoDono(e, h, 12);
  assert.equal(new Set(parado.map((c) => `${c.x},${c.y}`)).size, 1, 'perto do dono, ele ficou onde estava');
  const depois = tiqueDoDono(e, h, 40, andarPor(h, reta(1, 30, 1)));
  assert.ok(cheb(depois.at(-1), h.pos) <= 3, 'retomou o seguimento');
  const vistas = new Set();
  let voltas = 0;
  for (const c of depois.filter((c, i) => i === 0 || `${c.x},${c.y}` !== `${depois[i - 1].x},${depois[i - 1].y}`)) {
    if (vistas.has(`${c.x},${c.y}`)) voltas++;
    vistas.add(`${c.x},${c.y}`);
  }
  assert.equal(voltas, 0, 'andando para a frente, nunca voltou a uma casa');
});

test('F6. bloqueado por bichos: contorna e não pisa em bicho; sem rota possível, ESPERA — não aparece do lado do dono', () => {
  const { e, h, g } = comFamiliar(['....#.....', '.P..#..M..', '....#.....'], { perto: 1 });
  // O familiar (que saiu da casa do dono) está do lado esquerdo da parede; o dono vai para o lado direito: não há passagem.
  const antes = tiqueDoDono(e, h, 4);
  h.pos.x = 8;
  h.pos.y = 2;
  const preso = tiqueDoDono(e, h, 30);
  assert.ok(preso.every((c) => c.x < 4), `atravessou a parede: ${JSON.stringify(preso.at(-1))}`);
  assert.ok(cheb(preso.at(-1), h.pos) > 3, 'esperou do outro lado em vez de aparecer ao lado do dono');
  assert.equal(new Set(preso.slice(-10).map((c) => `${c.x},${c.y}`)).size, 1, 'esperando parado, sem vaivém');
  assert.ok(antes.length === 4);
  // Abre a passagem: ele vai.
  g.grade.andavel.add('4,1');
  const depois = tiqueDoDono(e, h, 30);
  assert.ok(cheb(depois.at(-1), h.pos) <= 1 + 1, 'foi quando o caminho abriu');
});

test('F7. em combate com o dono andando: o familiar bate no alvo do dono (a até `alcance`) e continua acompanhando', () => {
  const { e, h } = comFamiliar(['.'.repeat(40), '.P' + '.'.repeat(30) + 'M' + '.'.repeat(7), '.'.repeat(40)]);
  const alvo = h.monstros[0];
  alvo.hp = alvo.maxHp = 1e9;
  alvo.perseguindo = false;
  h.alvo = alvo.uid;
  let ataques = 0;
  const trilha = tiqueDoDono(e, h, 80, (i) => { andarPor(h, reta(1, 28, 1))(Math.floor(i / 2)); h.alvo = alvo.uid; ataques = e.hunt.sessao?.acertosDoFamiliar ?? ataques; });
  assert.ok(cheb(trilha.at(-1), h.pos) <= 3, 'acompanhou o dono');
  assert.ok(alvo.hp < alvo.maxHp, 'o familiar (ou o dono) bateu no alvo durante o seguimento');
});

test('F8. as cinco magias Summon usam o mesmo caminho: todas as invocações caminham', () => {
  const magias = ACTION_CATALOG.spells.filter((a) => a.summon).map((a) => a.id).sort();
  assert.deepEqual(magias, ['spell-monk-familiar', 'spell-summon-druid-familiar', 'spell-summon-knight-familiar', 'spell-summon-paladin-familiar', 'spell-summon-sorcerer-familiar']);
  for (const voc of ['knight', 'paladin', 'druid', 'sorcerer', 'monk']) {
    const { e, h } = comFamiliar(['.'.repeat(30), '.P' + '.'.repeat(28), '.'.repeat(30)], { vocacao: voc });
    const trilha = tiqueDoDono(e, h, 40, andarPor(h, reta(1, 15, 1)));
    assert.ok(saltos(trilha) <= 2, `${voc}: salto de ${saltos(trilha)}`);
    assert.ok(cheb(trilha.at(-1), h.pos) <= 3, `${voc}: ficou para trás`);
  }
});

test('F9. o que vai para o cliente: a posição é a lógica (uma casa por passo) e o tempo do deslocamento acompanha o passo', () => {
  const { e, h } = comFamiliar(['.'.repeat(40), '.P' + '.'.repeat(38), '.'.repeat(40)]);
  let maior = 0;
  let anterior = null;
  tiqueDoDono(e, h, 40, (i) => {
    andarPor(h, reta(1, 20, 1))(Math.floor(i / 2));
    const s = Cacadas.snapshotDaHunt(e, true).summon;
    if (s && anterior) maior = Math.max(maior, cheb(s, anterior));
    if (s) { assert.ok(s.moveMs > 0 && s.moveMs <= R.PASSO_MS); anterior = { x: s.x, y: s.y }; }
  });
  assert.ok(maior <= 2, `o cliente recebeu um salto de ${maior} casas`);
});

test('F10. o familiar some no fim do tempo e com o dono fora da caçada; troca de andar/instância o põe ao lado do dono (aparição no destino) e dali ele anda', () => {
  const { e, h } = comFamiliar(['........', '.P......', '........']);
  tiqueDoDono(e, h, 3);
  h.summon.ate = relogios.get(e) + 1;
  tiqueDoDono(e, h, 2);
  assert.equal(h.summon, null, 'acabou o tempo, saiu de campo');
});

test('F11. desempenho: 300 tiques de um familiar seguindo o dono por um mapa aberto custam pouco', () => {
  const { e, h } = comFamiliar(['.'.repeat(80), '.P' + '.'.repeat(78), ...Array.from({ length: 20 }, () => '.'.repeat(80))]);
  const t0 = process.hrtime.bigint();
  tiqueDoDono(e, h, 300, (i) => andarPor(h, reta(1, 75, 1))(Math.floor(i / 3)));
  const msPorTique = Number(process.hrtime.bigint() - t0) / 1e6 / 300;
  console.log(`  [medido] ${msPorTique.toFixed(3)} ms por tique (dono + familiar)`);
  assert.ok(msPorTique < 10, `${msPorTique} ms por tique`);
});
