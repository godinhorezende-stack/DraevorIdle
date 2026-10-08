// O passo da Caça Automática não entra em ciclo (A → B → B → A...): ver
// `game/systems/hunt/progresso.mjs` e o `passoDeRecuo` em `cacadas.mjs`.
//
// Os cenários rodam o `tique` DE VERDADE numa grade desenhada aqui (injetada no
// cache de grades com um id próprio), com o bicho parado ou movido pelo teste
// — é assim que se força o espelhamento que, no jogo, vem do próprio bicho.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Cacadas from '../systems/cacadas.mjs';
import * as R from '../systems/regras.mjs';
import { gradesCacheadas, gradeDaHunt, huntOuMapaCustom } from '../systems/hunt/terreno.mjs';
import { passoComProgresso, MEMORIA_MS } from '../systems/hunt/progresso.mjs';
import * as Caminho from '../systems/hunt/caminho.mjs';
import { personagemDeTeste, PERSONAGEM, HUNT_DE_TESTE } from './apoio.mjs';
import { doClassico } from './apoio-migracao.mjs';

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
      return numerica;
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

// ------------------------------------------------------------------ A

test('A. espaço livre: vai direto até o bicho, sem repassar por casa nenhuma', () => {
  const { e, alvo } = naGrade([
    '..........',
    '.P.......M',
    '..........',
  ]);
  const casas = rodar(e, 20);
  assert.equal(cheb(e.hunt.pos, alvo), 1, `parou em ${casas.at(-1)}`);
  assert.equal(retornos(casas), 0);
  // 8 casas de distância, colado = 7 passos (a primeira casa da lista já é a do 1º passo).
  assert.equal(passos(casas).length, 7);
});

// ------------------------------------------------------------------ B

test('B. contra a parede, kite, bicho acompanhando de lado: desliza UMA vez e para — sem vaivém, batendo', () => {
  // O ahau real (31,25 ↔ 32,25): parede atrás, bicho a 2 casas, "Distância 4".
  // Deslizar pela parede é tentado (pode haver saída adiante), mas com o bicho
  // espelhando não afasta: ele para no fim do deslize e não volta por ele.
  const { e, alvo } = naGrade([
    '.........',
    '....M....',
    '.........',
    '....P....',
    '#########',
  ], { vocacao: 'sorcerer', distancia: 4 });
  const casas = rodar(e, 40, () => {
    // O bicho espelha o personagem, na mesma coluna, duas casas acima.
    alvo.x = e.hunt.pos.x;
  });
  assert.equal(retornos(casas), 0, `voltou: ${passos(casas).join(' → ')}`);
  assert.ok(passos(casas).length <= 6, `deslizou demais: ${passos(casas).join(' → ')}`);
  assert.ok(e.hunt.sessao.damageDealt > 0, 'ele tinha de estar batendo');
});

test('B3. parede atrás, mas saída de lado e na diagonal: o kite desliza por ela e se afasta', () => {
  // "quando chega na parede ele para, mesmo tendo espaço para movimentar
  // diagonal e sair". Nenhuma vizinha afasta de cara; a saída é a abertura à direita.
  const { e, alvo } = naGrade([
    '..........',
    '...M......',
    '...P......',
    '#####.....',
    '#####.....',
    '#####.....',
  ], { vocacao: 'sorcerer', distancia: 3 });
  const casas = rodar(e, 24);
  assert.ok(cheb(e.hunt.pos, alvo) >= 3, `ficou a ${cheb(e.hunt.pos, alvo)}: ${passos(casas).join(' → ')}`);
  assert.equal(retornos(casas), 0, passos(casas).join(' → '));
});

test('B2. contra a parede com espaço de verdade para trás: o kite continua recuando', () => {
  const { e, alvo } = naGrade([
    '....M....',
    '....P....',
    '.........',
    '.........',
    '.........',
  ], { vocacao: 'sorcerer', distancia: 3 });
  rodar(e, 12);
  assert.ok(cheb(e.hunt.pos, alvo) >= 3, `não recuou: ${e.hunt.pos.x},${e.hunt.pos.y}`);
});

// ------------------------------------------------------------------ C

test('C. no canto, kite, com espaço ao longo da parede: desliza e se afasta, sem voltar', () => {
  const { e, alvo } = naGrade([
    '#######',
    '#P....#',
    '#.M...#',
    '#.....#',
    '#######',
  ], { vocacao: 'sorcerer', distancia: 4 });
  const casas = rodar(e, 30);
  assert.ok(cheb(e.hunt.pos, alvo) >= 3, `ficou a ${cheb(e.hunt.pos, alvo)}: ${passos(casas).join(' → ')}`);
  assert.equal(retornos(casas), 0, passos(casas).join(' → '));
});

test('C3. no canto sem saída de verdade (só a casa do bicho em volta): fica parado', () => {
  const { e, alvo } = naGrade([
    '####',
    '#P.#',
    '#.M#',
    '####',
  ], { vocacao: 'sorcerer', distancia: 4 });
  const casas = rodar(e, 30);
  assert.equal(new Set(casas).size, 1, `andou: ${passos(casas).join(' → ')}`);
  assert.equal(cheb(e.hunt.pos, alvo), 1);
});

test('C2. no canto, corpo a corpo: chega no bicho e para', () => {
  const { e, alvo } = naGrade([
    '#######',
    '#P....#',
    '#.....#',
    '#....M#',
    '#######',
  ]);
  const casas = rodar(e, 20);
  assert.equal(cheb(e.hunt.pos, alvo), 1);
  assert.equal(retornos(casas), 0);
});

// ------------------------------------------------------------------ D

test('D. cercado (paredes e bichos em volta): fica parado, e sem refazer a busca a cada tique', () => {
  const { e, alvo, buscas } = naGrade([
    '#########',
    '#.......#',
    '#..mmm..#',
    '#..mPm..#',
    '#..mmm..#',
    '#......M#',
    '#########',
  ]);
  // O alvo é o de longe, escolhido no clique: os oito em volta só atrapalham o caminho.
  e.hunt.alvo = alvo.uid;
  const casas = rodar(e, 4);
  buscas.n = 0;
  casas.push(...rodar(e, 40));
  assert.equal(new Set(casas).size, 1);
  // Nada mudou em volta: a busca impossível não é refeita (antes: 4 BFS por tique).
  assert.equal(buscas.n, 0, `${buscas.n} buscas em 40 tiques parado`);
});

// ------------------------------------------------------------------ E

test('E. só a alternativa lateral: contorna a parede pelo lado e chega', () => {
  const { e, alvo } = naGrade([
    '...M...',
    '.......',
    '.#####.',
    '...P...',
  ]);
  const casas = rodar(e, 30);
  assert.equal(cheb(e.hunt.pos, alvo), 1, `parou em ${casas.at(-1)}: ${passos(casas).join(' → ')}`);
  assert.equal(retornos(casas), 0);
});

// ------------------------------------------------------------------ F

test('F. só a diagonal passa: usa o passo diagonal (o jogo anda em diagonal)', () => {
  const { e, alvo } = naGrade([
    '####M',
    '###.#',
    '##P##',
  ]);
  const casas = rodar(e, 10);
  assert.equal(cheb(e.hunt.pos, alvo), 1);
  assert.deepEqual(passos(casas).slice(0, 1), ['3,1']);
});

// ------------------------------------------------------------------ G

test('G. nenhuma posição válida (bicho fechado atrás da parede): fica parado, sem recalcular', () => {
  const { e, buscas } = naGrade([
    '.......###',
    '.P.....#M#',
    '.......###',
  ]);
  const casas = rodar(e, 2);
  buscas.n = 0;
  casas.push(...rodar(e, 40));
  assert.equal(new Set(casas).size, 1, `andou: ${passos(casas).join(' → ')}`);
  assert.equal(buscas.n, 0, `${buscas.n} buscas do mesmo caminho impossível`);
});

// ------------------------------------------------------------------ H

test('H. A → B → A → B: o vai-e-volta é cortado no primeiro retorno', () => {
  // Kite numa parede com o bicho espelhando — a versão antiga do recuo dançava
  // aqui para sempre (25 dos 127 mapas medidos).
  const { e, alvo } = naGrade([
    '..........',
    '.....M....',
    '..........',
    '.....P....',
    '##########',
  ], { vocacao: 'sorcerer', distancia: 4 });
  const casas = rodar(e, 80, () => {
    alvo.x = e.hunt.pos.x;
  });
  assert.equal(retornos(casas), 0, passos(casas).join(' → '));
});

test('H2. o vigia, direto: A → B e o pedido de voltar a A é ciclo (fica em B)', () => {
  const g = desenho(['.....', '..P..', '.....']);
  const hunt = { pos: { ...g.P }, z: 7, clock: 0, monstros: [] };
  // Alvo fora de qualquer desvio possível: nenhuma casa por perto chega mais perto dele.
  const longe = bicho({ x: 2, y: 500 });
  const A = { ...g.P };
  const B = { x: A.x + 1, y: A.y };
  assert.deepEqual(passoComProgresso(hunt, g.grade, longe, B, { quer: 1 }), B);
  hunt.pos = { ...B };
  hunt.clock += 250;
  assert.equal(passoComProgresso(hunt, g.grade, longe, A, { quer: 1 }), null, 'voltar a A sem progresso é ciclo');
  hunt.clock += 250;
  assert.equal(passoComProgresso(hunt, g.grade, longe, A, { quer: 1 }), null, 'e continua parado');
});

// ------------------------------------------------------------------ I

test('I. A → B → B → A → A → B → B → A: reconhecido e interrompido (parede com duas aberturas, bicho espelhando)', () => {
  // O ABBA do relato, reproduzido: parede no meio com uma abertura de cada
  // lado, o bicho do outro lado andando ao contrário do personagem, percurso
  // ligado e o bicho "vindo" (`perseguindo`). Sem o vigia, a espera de
  // `voltariaAtras` virava 8,3 ×6 → 7,3 ×7 → 8,3 ×7 → 7,3 ×7... para sempre.
  const linhas = [
    '###########',
    '#....M....#',
    '##.#####.##',
    '#....P....#',
    '###########',
  ];
  const pontos = [{ x: 5, y: 3 }, { x: 2, y: 3 }, { x: 8, y: 3 }];
  const { e, alvo } = naGrade(linhas, { percurso: { passo: 0, pontos } });
  e.hunt.percurso = { passo: 0 };
  const casas = rodar(e, 60, () => {
    // Enquanto ele está embaixo, o bicho anda em espelho do outro lado da parede.
    if (e.hunt.pos.y === 3) alvo.x = Math.max(1, Math.min(9, 10 - e.hunt.pos.x));
    alvo.perseguindo = true;
  });
  const p = passos(casas);
  assert.equal(retornos(casas), 0, `ciclo: ${p.join(' → ')}`);
  // Achou a alternativa (a abertura) e chegou no bicho — sem ficar andando de um lado para o outro.
  assert.equal(cheb(e.hunt.pos, alvo), 1, `parou em ${e.hunt.pos.x},${e.hunt.pos.y}: ${p.join(' → ')}`);
});

test('I2. o vigia, direto: A, B, B (espera), A — para em B, sem A → A → B → B', () => {
  const g = desenho(['.......', '...P...', '.......']);
  const hunt = { pos: { ...g.P }, z: 7, clock: 0, monstros: [] };
  const longe = bicho({ x: 3, y: 500 });
  const A = { ...g.P };
  const B = { x: A.x + 1, y: A.y };
  const seq = [];
  const pedir = (destino) => {
    const passo = passoComProgresso(hunt, g.grade, longe, destino, { quer: 1 });
    if (passo) hunt.pos = { ...passo };
    hunt.clock += 250;
    seq.push(`${hunt.pos.x},${hunt.pos.y}`);
  };
  pedir(B); // A → B
  pedir(null); // a espera em B
  pedir(A); // B → A: ciclo
  pedir(A);
  pedir(null);
  pedir(A);
  assert.deepEqual(seq, ['4,1', '4,1', '4,1', '4,1', '4,1', '4,1']);
});

test('I3. ciclo de três casas (A → B → C → A) também é ciclo', () => {
  const g = desenho(['.....', '.P...', '.....']);
  const hunt = { pos: { ...g.P }, z: 7, clock: 0, monstros: [] };
  // Longe à esquerda: B e C ficam mais longe que A, e voltar a A não bate o recorde de A.
  const longe = bicho({ x: -500, y: 1 });
  const A = { ...g.P };
  const B = { x: 2, y: 1 };
  const C = { x: 2, y: 2 };
  for (const d of [B, C]) {
    assert.deepEqual(passoComProgresso(hunt, g.grade, longe, d, { quer: 1 }), d);
    hunt.pos = { ...d };
  }
  assert.equal(passoComProgresso(hunt, g.grade, longe, A, { quer: 1 }), null);
});

// ------------------------------------------------------------------ J

test('J. a saída do ciclo fica a mais de uma casa: ele vai até ela contornando a parede', () => {
  const g = desenho([
    '....M....',
    '.........',
    '###.#####',
    '.........',
    '...P.....',
  ]);
  const alvo = bicho(g.M);
  const hunt = { pos: { ...g.P }, z: 7, clock: 0, monstros: [alvo] };
  const bloqueado = new Set([`${alvo.x},${alvo.y}`]);
  const opcoes = { quer: 1, bloqueado };
  const A = { x: 2, y: 4 };
  // Já passou por A e por aqui sem chegar mais perto (falta 3): pedir A de novo é ciclo.
  hunt.progresso = { uid: alvo.uid, z: 7, melhor: 3, casas: { '2,4': 10_000, '3,4': 10_000 }, travado: null, desvio: null };
  const passo = passoComProgresso(hunt, g.grade, alvo, A, opcoes);
  assert.deepEqual(passo, { x: 3, y: 3 }, 'o primeiro passo do desvio é rumo à abertura');
  const desvio = hunt.progresso.desvio;
  assert.ok(desvio && cheb(desvio, g.P) > 1, `desvio ${JSON.stringify(desvio)} devia ficar a mais de 1 casa`);
  assert.ok(cheb(desvio, alvo) <= 1, 'e é uma casa de onde ele ataca');
  // Daí para a frente o passo normal leva até o bicho, passando pela abertura.
  hunt.pos = { ...passo };
  for (let i = 0; i < 6 && cheb(hunt.pos, alvo) > 1; i++) {
    hunt.clock += 250;
    const normal = Caminho.proximoPassoAte(g.grade, hunt.pos, alvo, null, bloqueado);
    hunt.pos = { ...passoComProgresso(hunt, g.grade, alvo, normal, opcoes) };
  }
  assert.equal(cheb(hunt.pos, alvo), 1, `parou em ${hunt.pos.x},${hunt.pos.y}`);
});

// ------------------------------------------------------------------ K

test('K. já em posição de ataque: não anda (corpo a corpo e kite)', () => {
  const colado = naGrade(['.....', '..P..', '..M..', '.....']);
  assert.equal(new Set(rodar(colado.e, 20)).size, 1);
  const kite = naGrade(['.........', '.P...M...', '.........'], { vocacao: 'sorcerer', distancia: 4 });
  const casas = rodar(kite.e, 20);
  assert.equal(new Set(casas).size, 1, passos(casas).join(' → '));
});

// ------------------------------------------------------------------ L

test('L. parado sem caminho, o bicho muda de lugar: volta a tentar e chega', () => {
  const { e, alvo } = naGrade([
    '.......###',
    '.P.....#M#',
    '.......###',
  ]);
  const antes = rodar(e, 12);
  assert.equal(new Set(antes).size, 1);
  // O bicho sai do buraco para o lado de cá.
  alvo.x = 5;
  alvo.y = 1;
  rodar(e, 12);
  assert.equal(cheb(e.hunt.pos, alvo), 1, `não voltou a tentar: ${e.hunt.pos.x},${e.hunt.pos.y}`);
});

test('L2. travado, a memória expira (MEMORIA_MS) e a casa volta a valer', () => {
  const g = desenho(['.....', '.P...', '.....']);
  const hunt = { pos: { ...g.P }, z: 7, clock: 0, monstros: [] };
  const longe = bicho({ x: 1, y: 500 });
  const A = { ...g.P };
  const B = { x: 2, y: 1 };
  passoComProgresso(hunt, g.grade, longe, B, { quer: 1 });
  hunt.pos = { ...B };
  assert.equal(passoComProgresso(hunt, g.grade, longe, A, { quer: 1 }), null);
  hunt.clock += MEMORIA_MS + 1;
  assert.deepEqual(passoComProgresso(hunt, g.grade, longe, A, { quer: 1 }), A);
});

// ---------------------------------------------------- os mapas de verdade

/** Gerador com semente (mulberry32): os bichos dos mapas reais andam com `Math.random`, e sem semente o teste falhava ao acaso. */
function comSemente(semente, fn) {
  const original = Math.random;
  let a = semente;
  Math.random = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

// Com semente fixa e o relógio fixo, o cenário é reproduzível. O recuo que não ganha distância (o bicho cola de novo a cada passo)
// para depois de 3 passos; mesmo assim, ~1 em 40 sementes ainda tem um boss encurralando o personagem em terreno apertado (pendência).
test('mapas reais que dançavam (ahau, burster-spectres): o kite não repassa em ciclo', { skip: doClassico("Mapas reais do Draevor (ahau, burster-spectres)") }, () => {
  for (const huntId of ['ahau', 'burster-spectres']) comSemente(1, () => {
    const e = personagemDeTeste({ vocacao: 'sorcerer', level: 600 });
    e.settings.distance = 4;
    assert.equal(Cacadas.entrar(e, { huntId, mode: 'auto', strategy: 'nearest' }).ok, true);
    let agora = 1e9;
    e.hunt.ultimoTique = agora;
    const janela = [];
    let pior = 0;
    for (let i = 0; i < 4 * 90 && e.hunt; i++) {
      agora += R.PASSO_MS;
      e.hp = e.maxHp = 1e12;
      Cacadas.tique(e, PERSONAGEM, agora);
      if (!e.hunt) break;
      const alvo = Cacadas.alvoAtual(e.hunt);
      janela.push(alvo ? `${e.hunt.pos.x},${e.hunt.pos.y}|${alvo.uid}` : null);
      const ultimas = janela.slice(-24);
      // 6 s com o mesmo alvo e só 2 ou 3 casas, trocando de uma para outra: ciclo.
      if (ultimas.length === 24 && ultimas.every((c) => c && c.split('|')[1] === ultimas[0].split('|')[1])) {
        const cs = ultimas.map((c) => c.split('|')[0]);
        const trocas = cs.filter((c, k) => k && c !== cs[k - 1]).length;
        // 6 trocas (e não 4): quatro é correr até um beco e voltar — o personagem encurralado bate de onde está; seis ou mais, nas mesmas 3 casas, é vaivém.
        if (new Set(cs).size <= 3 && trocas >= 6) pior++;
      }
    }
    assert.equal(pior, 0, `${huntId}: ${pior} janelas em ciclo`);
  });
});

test('o grid injetado é o que o tique usa (sanidade dos cenários)', () => {
  const g = desenho(['P.M']);
  assert.equal(gradeDaHunt(huntOuMapaCustom(g.id)), g.grade);
});

test('lurando, com espaço: passa pela leva em vez de encerrar a juntada', () => {
  // "se tiver espaço para lure ele passa pelos mobs". Ele veio da esquerda
  // (casa anterior 4,1), a rota o manda de volta para lá, e um bicho da leva
  // está colado. O passo reto desfaria o anterior — antes, isso encerrava o
  // lure na hora. Com o corredor de três, há o caminho por cima ou por baixo.
  const { e } = naGrade([
    '....................',
    '.....Pm............M',
    '....................',
  ], { vocacao: 'knight', percurso: { passo: 0, pontos: [{ x: 0, y: 1 }, { x: 19, y: 1 }] } });
  e.settings.lure = 5;
  e.hunt.levaAlvo = 5;
  e.hunt.lurando = true;
  e.hunt.casaAnterior = { x: 4, y: 1 };
  for (const m of e.hunt.monstros) m.perseguindo = m.name === 'Outro';
  rodar(e, 1);
  assert.equal(e.hunt.lurando, true, 'encerrou o lure');
  assert.notDeepEqual({ x: e.hunt.pos.x, y: e.hunt.pos.y }, { x: 5, y: 1 }, 'ficou parado');
  assert.notDeepEqual({ x: e.hunt.pos.x, y: e.hunt.pos.y }, { x: 4, y: 1 }, 'voltou pela casa de onde veio');
  // E segue: em poucos passos está à esquerda de onde começou, ainda lurando.
  rodar(e, 4);
  assert.ok(e.hunt.pos.x < 5, `não avançou na rota: ${e.hunt.pos.x},${e.hunt.pos.y}`);
  assert.equal(e.hunt.lurando, true, 'encerrou o lure depois');
});
