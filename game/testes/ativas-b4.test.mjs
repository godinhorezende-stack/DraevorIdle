// (lote B4, dono 25/10) AS GEMAS ATIVAS DE FEIXES E OBJETOS QUE REAGEM (o plano das ativas, as recomendações aceitas e as três confirmações do dono): a Chuva
// Tempestuosa e as duas alternativas (D-B4.1/D-B4.2), o Orbe Trovejante e o das Borrascas (D-B4.3: sozinho a cada 2,55 s, como o PoB), o Campo Galvânico e o da
// Intensidade, a Lança Crepitante (a Intensidade — D-B4.6), a Hidroesfera (D-B4.4: o objeto que as suas áreas e projéteis acertam), a Parede Flamejante e as Paredes de
// Gelo (D-B4.5: a "[DNT]" da Invasão vale, 10% por parede ativa). Os números são os do PoE (o PoB, o poedb); os sorteios ficam travados.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
const Acoes = await import('../systems/acoes.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const G = await import('../systems/itens-poe/gemas-poe.mjs');
const B4 = await import('../systems/itens-poe/gemas-b4.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');

let J;
let gerarPeca;
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
const perto = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

/** Roda `fn` com o `Math.random` travado em `v`. */
function travado(v, fn) {
  const antes = Math.random;
  Math.random = () => v;
  try { return fn(); } finally { Math.random = antes; }
}
/**
 * O personagem com as gemas (`slugs`: a do slot 0, a do 1…) na arma, numa caçada; o alvo imortal a (`dx`, `dy`) casas e os outros longe. `niveis`: o nível de cada
 * gema (o padrão, 20).
 */
async function montar(slugs, { niveis = [], qualidade = 0, arma = 'Wands/Driftwood_Wand', dx = 2, dy = 0 } = {}) {
  J ??= await import('../systems/itens-poe/jogo.mjs');
  gerarPeca ??= (await import('../systems/itens-poe/gerar.mjs')).gerarPeca;
  const lista = [slugs].flat();
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Scion', sistema: 'poe' });
  const a = peca(arma);
  a.soquetes = { abertos: lista.length, links: [], gemas: Array(lista.length).fill(null), cores: Array(lista.length).fill('W') };
  e.equipment = { ...e.equipment, weapon: a };
  delete e.equipment.shield;
  e.inventory = lista.map((s, i) => GS.itemDaGema({ id: G.doSlug(s).itemId, nivel: niveis[i] ?? 20, xp: 0, raridade: 'comum', qualidade }));
  for (let i = 0; i < lista.length; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  e.actions = Array(Acoes.SLOTS).fill(null);
  lista.forEach((s, i) => { e.actions[i] = { id: G.doSlug(s).acao, enabled: true, minMana: 0, conditions: [] }; });
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(travado(0.5, () => Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' })).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 1e7;
  e.maxHp = e.hp = 1e7;
  const [b, ...resto] = e.hunt.monstros;
  for (const m of resto) Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60 });
  Object.assign(b, { x: e.hunt.pos.x + dx, y: e.hunt.pos.y + dy, hp: 1e12, maxHp: 1e12, estados: {}, resist: {}, dots: [] });
  e.hunt.cadaveres = [];
  return { e, b, resto };
}
/** Usa a gema do `slot` no alvo (com a conjuração concluída), com o sorteio travado; devolve o resultado com os eventos da conclusão. */
function usar(e, b, { slot = 0, v = 0.5 } = {}) {
  return travado(v, () => {
    const x = Acoes.disparar(e, e.hunt, PERSONAGEM, slot, b, { manual: true });
    if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; return { ...x, eventos: [...(x.eventos ?? []), ...Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM)] }; }
    return x;
  });
}
/** O próximo uso pode sair (a recarga, o tempo de uso). */
const liberar = (e, ms = 10_000) => { e.hunt.clock += ms; e.hunt.cooldowns = {}; };
/** O tique das plantadas de `ms` em `ms`, até `total`. */
function tiques(e, total, ms = 50, v = 0.5) {
  const ev = [];
  travado(v, () => { for (let t = 0; t < total; t += ms) { e.hunt.clock += ms; ev.push(...Acoes.tiqueDasPlantadas(e, e.hunt, PERSONAGEM, [])); } });
  return ev;
}
const golpesEm = (ev, b) => ev.filter((x) => x.t === 'dmg' && x.foe && x.uid === b.uid);
/** Um dos monstros longe, trazido para (`dx`, `dy`) de você, imortal. */
function vizinho(m, dx, dy, i = 0) {
  const v = m.resto[i];
  Object.assign(v, { x: m.e.hunt.pos.x + dx, y: m.e.hunt.pos.y + dy, hp: 1e12, maxHp: 1e12, estados: {}, resist: {}, dots: [] });
  return v;
}
const objetos = (e, tipo) => (e.hunt.poeObjetos ?? []).filter((o) => o.tipo === tipo && o.ate > e.hunt.clock);
const LOTE = ['Storm_Rain', 'Storm_Rain_of_the_Conduit', 'Storm_Rain_of_the_Fence', 'Orb_of_Storms', 'Orb_of_Storms_of_Squalls', 'Galvanic_Field', 'Galvanic_Field_of_Intensity', 'Hydrosphere', 'Flame_Wall', 'Frost_Wall', 'Frost_Wall_of_Encroachment'];

// ---------------------------------------------------------------- o status

test('B4: as 13 gemas do lote saem de parcial (a ramificação da Lança Crepitante pela decisão do dono, 25/10)', { skip: SEM }, () => {
  for (const s of [...LOTE, 'Crackling_Lance', 'Crackling_Lance_of_Branching']) {
    const r = G.REGISTRO.get(s);
    assert.deepEqual([s, r.statusNoJogo, r.motivosNoJogo], [s, 'funciona', []]);
  }
  // (o Campo Galvânico é buff no PoE — SkillType.Buff: o uso dá o buff; o dano é o do campo)
  for (const s of ['Galvanic_Field', 'Galvanic_Field_of_Intensity']) assert.equal(G.REGISTRO.get(s).arquetipo, 'guarda', s);
});

// ---------------------------------------------------------------- os leitores (os números do PoE)

test('B4: os leitores no nível 20 — os números do PoB e do poedb', { skip: SEM }, () => {
  // a Chuva Tempestuosa: 0,41 s, 4 feixes (+1 da qualidade), até 100 flechas, o feixe de 1,2 m; a do Conduíte 0,3 s, 6 (+2), 10; a da Barreira 0,15 s, 20 (+4), 2, uma flecha só
  assert.deepEqual(G.objetoDaGema('Storm_Rain', 20, 20), { tipo: 'flechaTempestade', semAcerto: false, intervaloMs: 410, feixes: 5, max: 100, larguraM: 1.2, semQuantidade: false });
  assert.deepEqual([G.objetoDaGema('Storm_Rain_of_the_Conduit', 20, 20).intervaloMs, G.objetoDaGema('Storm_Rain_of_the_Conduit', 20, 20).feixes, G.objetoDaGema('Storm_Rain_of_the_Conduit', 20, 20).max], [300, 8, 10]);
  assert.deepEqual([G.objetoDaGema('Storm_Rain_of_the_Fence', 20, 20).intervaloMs, G.objetoDaGema('Storm_Rain_of_the_Fence', 20, 0).feixes, G.objetoDaGema('Storm_Rain_of_the_Fence', 20, 20).feixes, G.objetoDaGema('Storm_Rain_of_the_Fence', 20, 20).max, G.objetoDaGema('Storm_Rain_of_the_Fence', 20, 20).semQuantidade], [150, 20, 24, 2, true]);
  // o Orbe Trovejante: 2,55 s, 0,5 s canalizando, 2,8 m, a divisão de 3,5 m para 3 (+2 da qualidade), 29 golpes; o das Borrascas: sem o golpe sozinho, 3,8 m, 5 (+2), 14, teleporta
  assert.deepEqual(G.objetoDaGema('Orb_of_Storms', 20, 0), { tipo: 'orbeTempestade', semAcerto: true, intervaloMs: 2550, canalMs: 500, raioM: 2.8, raioDivisaoM: 3.5, golpes: 29, divide: 3, teleporta: false });
  assert.equal(G.objetoDaGema('Orb_of_Storms', 20, 20).divide, 5);
  assert.deepEqual(G.objetoDaGema('Orb_of_Storms_of_Squalls', 20, 20), { tipo: 'orbeTempestade', semAcerto: true, intervaloMs: null, canalMs: 500, raioM: 3.8, raioDivisaoM: 3.8, golpes: 14, divide: 7, teleporta: true });
  // o Campo Galvânico: o feixe a cada 0,1 s, 0,4 s por inimigo, 15% mais por 5% de Eletrização, +0,1 m por 10%, 1,9 m, 6 s, 1 campo; o buff, 50% (+20 da qualidade)
  assert.deepEqual(G.b4DaGema('Galvanic_Field', 20, 20).campo, { feixeMs: 100, focoMs: 400, maisPor5Pct: 15, raioPor10M: 0.1, raioM: 1.9, duracaoMs: 6000, max: 1, chancePct: 70 });
  assert.deepEqual([G.b4DaGema('Galvanic_Field_of_Intensity', 20, 0).campo.feixeMs, G.b4DaGema('Galvanic_Field_of_Intensity', 20, 0).campo.focoMs, G.b4DaGema('Galvanic_Field_of_Intensity', 20, 0).campo.maisPor5Pct], [200, 550, 0]);
  assert.deepEqual(G.buffNoNivel('Galvanic_Field', 20, 0).af, { chance_shock: 50 });
  assert.deepEqual(G.buffNoNivel('Galvanic_Field', 20, 20).af, { chance_shock: 70 });
  assert.deepEqual(B4.campoPelaEletrizacao(G.b4DaGema('Galvanic_Field', 20, 0).campo, 24), { raioM: 2.1, maisPct: 60 });
  // a Lança Crepitante: até 3, perde 1 a cada 0,5 s, 35% mais por Intensidade (+0,5 por qualidade)
  assert.deepEqual(G.b4DaGema('Crackling_Lance', 20, 0).intensidade, { max: 3, perde: 1, perdeMs: 500, maisPorPct: 35 });
  assert.equal(G.b4DaGema('Crackling_Lance', 20, 20).intensidade.maisPorPct, 45);
  // a Hidroesfera: 0,4 s ÷ (1 + 10% da qualidade 20), 1 s entre acertos, −10%, o Encharcado de 4 s, 8 s, 2,3 m, o limiar do PoB no nível
  assert.deepEqual(G.objetoDaGema('Hydrosphere', 20, 0), { tipo: 'hidroesfera', semAcerto: true, pulsoMs: 400, acertoMs: 1000, exposicaoPct: 10, encharcadoMs: 4000, duracaoMs: 8000, raioM: 2.3, limiar: 103048 });
  assert.ok(perto(G.objetoDaGema('Hydrosphere', 20, 20).pulsoMs, 400 / 1.1));
  assert.equal(G.objetoDaGema('Hydrosphere', 1, 0).limiar, 1500);
  // as Paredes: a Flamejante de 5,9 m, 78–117 nos projéteis, 3 (+2 da qualidade), 4,9 s e o secundário de 2 s; a de Gelo de 5,6 m, 0,15 s por seção; a da Invasão, 4,6 m e 10%
  assert.deepEqual(G.objetoDaGema('Flame_Wall', 20, 20), { tipo: 'paredeFogo', semAcerto: true, comprimentoM: 5.9, duracaoMs: 4900, secundarioMs: 2000, adicional: [78, 117], max: 5, comArea: true });
  assert.equal(G.objetoDaGema('Flame_Wall', 20, 0).max, 3);
  assert.deepEqual(G.objetoDaGema('Frost_Wall', 20, 0), { tipo: 'paredeGelo', semAcerto: true, comprimentoM: 5.6, secaoMs: 150, duracaoMs: 4900, porParedePct: 0, comArea: false });
  assert.deepEqual([G.objetoDaGema('Frost_Wall_of_Encroachment', 20, 0).comprimentoM, G.objetoDaGema('Frost_Wall_of_Encroachment', 20, 0).porParedePct], [4.6, 10]);
});

test('B4: as contas puras — o feixe, a parede, os pares da chuva, a divisão do orbe, o foco do campo e a conversão da esfera', () => {
  // o feixe de 1 casa: a reta com as duas pontas; de 3 casas: um de cada lado da perpendicular
  assert.deepEqual(B4.casasDoFeixe({ x: 0, y: 0 }, { x: 3, y: 0 }, 1), [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }]);
  assert.equal(B4.casasDoFeixe({ x: 0, y: 0 }, { x: 3, y: 0 }, 3).length, 12);
  assert.equal(B4.larguraDoFeixe(1.2, 1, () => 0.9), 1);
  assert.equal(B4.larguraDoFeixe(5, 1, () => 0.4), 3);
  // a parede perpendicular, do centro para fora
  assert.deepEqual(B4.casasDaParede({ x: 5, y: 0 }, { x: 0, y: 0 }, 3), [{ x: 5, y: 0 }, { x: 5, y: 1 }, { x: 5, y: -1 }]);
  assert.equal(B4.casasDoComprimento(5.6, 1, () => 0.9), 2);
  assert.equal(B4.casasDoComprimento(5.6, 1, () => 0.1), 3);
  assert.ok(B4.cruza({ x: 0, y: 0 }, { x: 4, y: 0 }, new Set(['2,0'])));
  assert.ok(!B4.cruza({ x: 0, y: 0 }, { x: 4, y: 0 }, new Set(['2,1'])));
  // os pares: cada flecha na mais perto, sem repetir o par
  const f = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 3, y: 0 }, { id: 'c', x: 10, y: 0 }];
  assert.deepEqual(B4.paresDoPulso(f, f).map(([a, b]) => `${a.id}-${b.id}`), ['a-b', 'c-b']);
  // a divisão do orbe: os mais perto do atingido no raio, até N
  const m = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 5, y: 0 }];
  assert.deepEqual(B4.atingidosDoOrbe(m[0], m, 1, 2), [m[0], m[1]]);
  assert.deepEqual(B4.atingidosDoOrbe(m[0], m, 5, 2), [m[0], m[1], m[2]]);
  // o foco do campo: o que ele não focou há pouco, o mais antigo primeiro
  const x = { uid: 'x' };
  const y = { uid: 'y' };
  assert.equal(B4.alvoDoCampo([x, y], { x: 1000 }, 1100, 400), y);
  assert.equal(B4.alvoDoCampo([x, y], { x: 1000, y: 900 }, 1100, 400), null);
  assert.equal(B4.alvoDoCampo([x, y], { x: 1000, y: 900 }, 1350, 400), y);
  // a conversão pela afecção da esfera
  assert.deepEqual(B4.conversaoDaEsfera({}, 0), { ice: 100, energy: 0 });
  assert.deepEqual(B4.conversaoDaEsfera({ chocado: { ate: 10 } }, 0), { ice: 0, energy: 100 });
  assert.deepEqual(B4.conversaoDaEsfera({ exaurido: { ate: 10 } }, 0), { ice: 0, energy: 100 });
  assert.deepEqual(B4.conversaoDaEsfera({ congelado: { ate: 10 } }, 0), { ice: 100, energy: 0 });
  assert.deepEqual(B4.conversaoDaEsfera({ congelado: { ate: 10 }, chocado: { ate: 10 } }, 0), { ice: 50, energy: 50 });
  assert.deepEqual(B4.conversaoDaEsfera({ congelado: { ate: 10 }, chocado: { ate: 10 } }, 20), { ice: 100, energy: 0 });
});

// ---------------------------------------------------------------- a Chuva Tempestuosa (D-B4.1/D-B4.2)

const ARCO = { arma: 'Bows/Crude_Bow' };
test('B4 no jogo: a Chuva Tempestuosa — a flecha fica no chão e, com outra perto, o feixe entre as duas acerta quem está no meio, um pulso a cada 0,41 s, 4 vezes', { skip: SEM }, async () => {
  const m = await montar('Storm_Rain', { ...ARCO, dx: 4 });
  const outro = vizinho(m, 4, 4);
  const meio = vizinho(m, 4, 2, 1);
  assert.ok(usar(m.e, m.b).ok);
  liberar(m.e, 0);
  m.e.hunt.clock += 2;
  assert.ok(usar(m.e, outro).ok);
  assert.equal(objetos(m.e, 'flechaTempestade').length, 2);
  // (o feixe vertical de (4,0) a (4,4): acerta quem está em (4,2), uma vez por pulso — os pulsos das duas flechas saem em instantes diferentes)
  const ev = tiques(m.e, 2000);
  // (a última da segunda flecha sai sem par: a primeira já soltou os 4 feixes e acabou)
  assert.equal(golpesEm(ev, meio).length, 7, 'as 4 da primeira e 3 da segunda');
  assert.equal(objetos(m.e, 'flechaTempestade').length, 0, 'as flechas acabaram os feixes');
});

test('B4 no jogo: a Chuva Tempestuosa da Barreira — no máximo 2 flechas no chão (sai a mais velha); sozinha, a flecha não solta feixe', { skip: SEM }, async () => {
  const m = await montar('Storm_Rain_of_the_Fence', { ...ARCO, dx: 3 });
  assert.ok(usar(m.e, m.b).ok);
  const meio = vizinho(m, 3, 1, 1);
  assert.equal(golpesEm(tiques(m.e, 200), meio).length, 0, 'uma flecha só');
  for (let i = 0; i < 2; i++) { liberar(m.e, 0); m.e.hunt.clock += 1; assert.ok(usar(m.e, vizinho(m, 3, 2 + i)).ok); }
  assert.equal(objetos(m.e, 'flechaTempestade').length, 2);
});

// ---------------------------------------------------------------- o Orbe Trovejante (D-B4.3)

test('B4 no jogo: o Orbe Trovejante — golpeia ao ser posto e sozinho a cada 2,55 s; o feixe se divide para o vizinho; some depois de 29 golpes; usar de novo troca o orbe', { skip: SEM }, async () => {
  const m = await montar('Orb_of_Storms', { dx: 2 });
  const v = vizinho(m, 3, 0);
  const r = usar(m.e, m.b);
  assert.ok(r.ok, r.erro);
  assert.equal(golpesEm(r.eventos, m.b).length, 0, 'o uso não acerta: o golpe é do orbe');
  let ev = tiques(m.e, 100);
  assert.equal(golpesEm(ev, m.b).length + golpesEm(ev, v).length, 2, 'o golpe ao ser posto, dividido para o vizinho');
  ev = tiques(m.e, 2400);
  assert.equal(golpesEm(ev, m.b).length + golpesEm(ev, v).length, 0, 'antes dos 2,55 s');
  ev = tiques(m.e, 100);
  assert.equal(golpesEm(ev, m.b).length + golpesEm(ev, v).length, 2, 'aos 2,55 s');
  const [o] = objetos(m.e, 'orbeTempestade');
  assert.equal(o.golpes, 27);
  o.golpes = 1;
  tiques(m.e, 2600);
  assert.equal(objetos(m.e, 'orbeTempestade').length, 0, 'acabaram os golpes');
  liberar(m.e);
  usar(m.e, m.b);
  liberar(m.e);
  usar(m.e, m.b);
  assert.equal(objetos(m.e, 'orbeTempestade').length, 1, 'um orbe por vez');
});

test('B4 no jogo: o Orbe Trovejante das Borrascas — não golpeia sozinho; o seu uso de Raio perto dele o faz golpear, e ele teleporta para um atingido', { skip: SEM }, async () => {
  const m = await montar(['Orb_of_Storms_of_Squalls', 'Spark'], { dx: 1 });
  assert.ok(usar(m.e, m.b).ok);
  tiques(m.e, 100);
  const [o] = objetos(m.e, 'orbeTempestade');
  assert.equal(o.golpes, 13);
  tiques(m.e, 5000);
  assert.equal(o.golpes, 13, 'sem o golpe sozinho');
  liberar(m.e);
  assert.ok(usar(m.e, m.b, { slot: 1 }).ok);
  assert.equal(o.golpes, 12, 'a Faísca (Raio) perto do orbe');
  assert.deepEqual([o.x, o.y], [m.b.x, m.b.y], 'teleportou para o atingido');
});

test('B4 no jogo: o Orbe Trovejante — com você canalizando uma magia de Raio a até o raio dele, golpeia a cada 0,5 s (D-B4.3); longe dele, não', { skip: SEM }, async () => {
  const m = await montar('Orb_of_Storms', { dx: 1 });
  assert.ok(usar(m.e, m.b).ok);
  tiques(m.e, 50);
  const [o] = objetos(m.e, 'orbeTempestade');
  assert.equal(o.golpes, 28);
  // (as Gavinhas Relampejantes — Raio, Canalização — canalizando por 1 s)
  m.e.hunt.canalizacao = { acao: G.doSlug('Lightning_Tendrils').acao, ate: m.e.hunt.clock + 1000 };
  tiques(m.e, 1000);
  assert.equal(o.golpes, 26, 'dois golpes em 1 s');
  // (você longe do orbe: não)
  m.e.hunt.canalizacao.ate = m.e.hunt.clock + 1000;
  Object.assign(o, { x: m.e.hunt.pos.x + 5 });
  Object.assign(m.b, { x: o.x });
  tiques(m.e, 1000);
  assert.equal(o.golpes, 26);
});

// ---------------------------------------------------------------- o Campo Galvânico

test('B4 no jogo: o Campo Galvânico — o uso dá o buff (50% de chance de Eletrizar); Eletrizar com ele cria o campo no inimigo, com 15% mais por 5% de Eletrização', { skip: SEM }, async () => {
  const m = await montar('Galvanic_Field', { dx: 1 });
  const r = usar(m.e, m.b);
  assert.ok(r.ok, r.erro);
  assert.equal(golpesEm(r.eventos, m.b).length, 0, 'o uso é o buff');
  assert.ok(m.e.hunt.buffs?.[G.doSlug('Galvanic_Field').acao]?.ate > m.e.hunt.clock);
  assert.equal(Ficha.combate(m.e).afeccoes.chance.eletrizacao >= 50, true);
  // (Eletrizado em 20%: o campo com 60% mais, raio 1,9 + 0,2 m)
  m.b.estados.chocado = { ate: m.e.hunt.clock + 60_000, pct: 20, dur: 60_000 };
  Acoes.campoGalvanicoAoEletrizar(m.e, m.e.hunt, m.b);
  const [c] = objetos(m.e, 'campoGalvanico');
  assert.ok(c, 'o campo');
  assert.deepEqual([c.hospede, c.maisPct, c.eletrizacaoPct], [m.b.uid, 60, 20]);
  // (no mesmo inimigo, não cria outro)
  Acoes.campoGalvanicoAoEletrizar(m.e, m.e.hunt, m.b);
  assert.equal(objetos(m.e, 'campoGalvanico').length, 1);
  // (um feixe a cada 0,1 s, mas cada inimigo só uma vez a cada 0,4 s: em 1 s, 3 no alvo sozinho — aos 0,1, 0,5 e 0,9 s)
  const ev = tiques(m.e, 1000);
  assert.equal(golpesEm(ev, m.b).length, 3);
  // (o campo segue o inimigo)
  m.b.x += 1;
  tiques(m.e, 50);
  assert.equal(c.x, m.b.x);
});

test('B4 no jogo: o Campo Galvânico — o golpe com 60% mais pela Eletrização de 20% (a conta do golpe: o mesmo sorteio com e sem)', { skip: SEM }, async () => {
  const dano = async (pct) => {
    const m = await montar('Galvanic_Field', { dx: 1 });
    assert.ok(usar(m.e, m.b).ok);
    m.b.estados.chocado = { ate: m.e.hunt.clock + 60_000, pct, dur: 60_000 };
    Acoes.campoGalvanicoAoEletrizar(m.e, m.e.hunt, m.b);
    delete m.b.estados.chocado;
    return golpesEm(tiques(m.e, 150), m.b)[0]?.v;
  };
  const sem = await dano(4);
  const com = await dano(20);
  assert.ok(sem > 0 && com > 0);
  assert.ok(perto(com / sem, 1.6, 0.01), `${com} / ${sem}`);
});

// ---------------------------------------------------------------- a Lança Crepitante (D-B4.6)

test('B4 no jogo: a Lança Crepitante — +1 de Intensidade por uso, até 3; 35% mais por Intensidade; o teleporte zera; a troca de instância também', { skip: SEM }, async () => {
  const m = await montar('Crackling_Lance', { dx: 1 });
  const golpe = () => { liberar(m.e, 1000); return golpesEm(usar(m.e, m.b).eventos, m.b)[0]?.v; };
  const g0 = golpe();
  const g1 = golpe();
  const g2 = golpe();
  const g3 = golpe();
  const g4 = golpe();
  assert.equal(m.e.hunt.poeIntensidade[G.doSlug('Crackling_Lance').acao].n, 3);
  assert.ok(perto(g1 / g0, 1.35, 0.01) && perto(g2 / g0, 1.7, 0.01) && perto(g3 / g0, 2.05, 0.01) && perto(g4 / g0, 2.05, 0.01), [g0, g1, g2, g3, g4].join(' '));
  m.e.hunt.teleportes = (m.e.hunt.teleportes ?? 0) + 1;
  assert.ok(perto(golpe() / g0, 1, 0.01), 'o teleporte zerou');
});

test('B4: o feixe da Lança Crepitante (dono, 25/10) — 7 casas, as laterais do meio a 45°, 33% menos por Intensidade (≈ 13,5° com 3); a da Ramificação, 67,5°', { skip: SEM }, () => {
  const l = G.b4DaGema('Crackling_Lance', 20, 0).lanca;
  assert.deepEqual(l, { comprimento: 7, meio: 3, larguraM: 1, anguloGraus: 45, porIntensidadeM: 0.3, menosPorIntensidadePct: 33 });
  assert.ok(perto(B4.anguloDaLanca(l, 3), 45 * 0.67 ** 3));
  assert.equal(B4.anguloDaLanca(G.b4DaGema('Crackling_Lance_of_Branching', 20, 0).lanca, 0), 67.5);
  // sem Intensidade, para a direita: o principal (1..7, 0) e as laterais de (3, 0) a 45° — até (6, ±3)
  const cs = new Set(B4.casasDaLanca({ x: 0, y: 0 }, { x: 5, y: 0 }, l, 45).map((c) => `${c.x},${c.y}`));
  for (let i = 1; i <= 7; i++) assert.ok(cs.has(`${i},0`), `${i},0`);
  for (const k of ['4,1', '5,2', '6,3', '4,-1', '5,-2', '6,-3']) assert.ok(cs.has(k), k);
  assert.ok(!cs.has('0,0') && !cs.has('8,0') && !cs.has('2,2'));
  // com 3 de Intensidade (≈ 13,5°), as laterais quase no principal: (7, ±1) no fim
  const c3 = new Set(B4.casasDaLanca({ x: 0, y: 0 }, { x: 5, y: 0 }, l, B4.anguloDaLanca(l, 3)).map((c) => `${c.x},${c.y}`));
  assert.ok(c3.has('7,1') && c3.has('7,-1') && !c3.has('6,3'));
});

test('B4 no jogo: a Lança Crepitante acerta no feixe e nas laterais (a 45°), não atrás de você nem fora do ângulo', { skip: SEM }, async () => {
  const m = await montar('Crackling_Lance', { dx: 6 });
  const lateral = vizinho(m, 6, 3, 0);
  const atras = vizinho(m, -2, 0, 1);
  const fora = vizinho(m, 2, 3, 2);
  const r = usar(m.e, m.b);
  assert.ok(r.ok, r.erro);
  assert.equal(golpesEm(r.eventos, m.b).length, 1, 'o principal');
  assert.equal(golpesEm(r.eventos, lateral).length, 1, 'a lateral');
  assert.equal(golpesEm(r.eventos, atras).length + golpesEm(r.eventos, fora).length, 0);
});

// ---------------------------------------------------------------- a Hidroesfera (D-B4.4)

test('B4 no jogo: a Hidroesfera — pulsa ao ser posta (o Físico em Gelo, sem afecção) e põe Encharcado; sem afecção não pulsa de novo; Eletrizada, pulsa a cada 0,4 s em Raio', { skip: SEM }, async () => {
  const m = await montar('Hydrosphere', { dx: 2 });
  const r = usar(m.e, m.b);
  assert.ok(r.ok, r.erro);
  assert.equal(golpesEm(r.eventos, m.b).length, 0, 'o uso não acerta: o pulso é da esfera');
  const ev = tiques(m.e, 50);
  const g = golpesEm(ev, m.b);
  assert.equal(g.length, 1, 'o pulso ao ser posta');
  assert.equal(g[0].color, Acoes.COR_DO_ELEMENTO.ice, 'o Físico em Gelo');
  assert.ok(m.b.estados.exposicao?.ice > m.e.hunt.clock && m.b.estados.exposicao?.energy > m.e.hunt.clock, 'Encharcado: a Exposição a Gelo e a Raio');
  assert.equal(golpesEm(tiques(m.e, 1000), m.b).length, 0, 'sem afecção, sem pulso');
  const [o] = objetos(m.e, 'hidroesfera');
  o.estados = { chocado: { ate: m.e.hunt.clock + 1000, pct: 10 } };
  const ev2 = tiques(m.e, 1000);
  assert.equal(golpesEm(ev2, m.b).length, 2, 'Eletrizada por 1 s: os pulsos aos 0,4 e 0,8 s');
  assert.ok(golpesEm(ev2, m.b).every((x) => x.color === Acoes.COR_DO_ELEMENTO.energy), 'Eletrizada: o Físico em Raio');
  // usar de novo move a esfera e renova a duração (e ela pulsa de novo)
  liberar(m.e, 1000);
  const v = vizinho(m, 4, 3);
  const r2 = usar(m.e, v);
  assert.ok(r2.ok, r2.erro);
  assert.equal(objetos(m.e, 'hidroesfera').length, 1);
  assert.deepEqual([o.x, o.y], [v.x, v.y]);
  assert.equal(golpesEm(tiques(m.e, 50), v).length, 1);
});

test('B4 no jogo: a Hidroesfera — a área de Gelo sua que a pega a Congela (o crítico, o limiar do nível 1), no máximo 1 vez por segundo; Congelada, ela volta a pulsar', { skip: SEM }, async () => {
  const m = await montar(['Hydrosphere', 'Ice_Nova'], { niveis: [1, 20], dx: 2 });
  assert.ok(usar(m.e, m.b).ok);
  tiques(m.e, 50);
  const [o] = objetos(m.e, 'hidroesfera');
  liberar(m.e, 0);
  // (o sorteio 0: o crítico, que Congela de forma inerente; o Gelo da Nova contra o limiar de 1.500)
  const r = usar(m.e, m.b, { slot: 1, v: 0 });
  assert.ok(r.ok, r.erro);
  assert.ok(o.estados.congelado?.ate > m.e.hunt.clock, JSON.stringify(o.estados));
  assert.ok(o.proximoAcerto > m.e.hunt.clock, 'só 1 vez por segundo');
  assert.ok(golpesEm(tiques(m.e, 500), m.b).length >= 1, 'Congelada, pulsa');
});

// ---------------------------------------------------------------- as Paredes (D-B4.5)

test('B4 no jogo: a Parede de Gelo — as casas aparecem do centro para fora (0,15 s); quem está nelas leva o golpe e é empurrado; os bichos não passam por elas', { skip: SEM }, async () => {
  const m = await montar('Frost_Wall', { dx: 2 });
  const lado = vizinho(m, 2, 1);
  const x0 = m.b.x;
  const r = usar(m.e, m.b, { v: 0.1 });
  assert.ok(r.ok, r.erro);
  const s = objetos(m.e, 'secaoGelo');
  assert.equal(s.length, 3, '5,6 m: 2,8 casas, o sorteio 0,1 dá 3');
  assert.deepEqual(s.map((o) => [o.x - m.e.hunt.pos.x, o.y - m.e.hunt.pos.y, o.aparece - s[0].aparece]), [[2, 0, 0], [2, 1, 150], [2, -1, 300]]);
  const ev = tiques(m.e, 50);
  assert.equal(golpesEm(ev, m.b).length, 1, 'o centro');
  assert.equal(m.b.x, x0 + 1, 'empurrado');
  assert.equal(golpesEm(ev, lado).length, 0, 'a casa do lado ainda não apareceu');
  assert.equal(golpesEm(tiques(m.e, 150), lado).length, 1, 'aos 0,15 s');
  const grade = Acoes.gradeSemParedes(m.e.hunt, { andavel: new Set(['1,1', `${m.e.hunt.pos.x + 2},${m.e.hunt.pos.y}`]) });
  assert.ok(!grade.andavel.has(`${m.e.hunt.pos.x + 2},${m.e.hunt.pos.y}`) && grade.andavel.has('1,1'), 'a casa da parede sai da grade dos bichos');
  tiques(m.e, 5000);
  assert.equal(objetos(m.e, 'secaoGelo').length, 0, 'expirou');
});

test('B4 no jogo: a Parede de Gelo da Invasão — 10% mais dano por parede ativa da gema (a "[DNT]", decisão do dono)', { skip: SEM }, async () => {
  const m = await montar('Frost_Wall_of_Encroachment', { dx: 2 });
  const v = vizinho(m, 2, 3);
  assert.ok(usar(m.e, m.b).ok);
  const um = golpesEm(tiques(m.e, 50), m.b)[0]?.v;
  liberar(m.e, 0);
  m.e.hunt.clock += 10;
  assert.ok(usar(m.e, v).ok);
  const dois = golpesEm(tiques(m.e, 50), v)[0]?.v;
  assert.ok(um > 0 && dois > 0);
  assert.ok(perto(dois / um, 1.2 / 1.1, 0.01), `${dois} / ${um}`);
});

test('B4 no jogo: a Parede Flamejante — queima quem está nela e põe o debuff secundário; até 3 paredes (sai a mais velha); o projétil seu que a cruza ganha os 78–117 de Fogo', { skip: SEM }, async () => {
  const m = await montar(['Flame_Wall', 'Fireball'], { dx: 2 });
  assert.ok(usar(m.e, m.b).ok);
  assert.ok(objetos(m.e, 'secaoFogo').length >= 2);
  const ev = tiques(m.e, 1000);
  assert.ok(golpesEm(ev, m.b).length > 0, 'queima');
  assert.ok((m.b.dots ?? []).some((d) => d.chave === 'Flame_Wall:secundario' && d.falta > 0), 'o debuff secundário');
  for (let i = 0; i < 3; i++) { liberar(m.e, 0); m.e.hunt.clock += 1; usar(m.e, vizinho(m, 6, 2 * i, i)); }
  assert.equal(new Set(objetos(m.e, 'secaoFogo').map((o) => o.parede)).size, 3, 'até 3 paredes');
  // o projétil pela parede: a Bola de Fogo num inimigo atrás da parede (a de (2, 0) já saiu — a mais velha); uma parede nova no meio
  const m2 = await montar(['Flame_Wall', 'Fireball'], { dx: 3 });
  const sem = golpesEm(usar(m2.e, m2.b, { slot: 1, v: 0.5 }).eventos, m2.b)[0]?.v;
  liberar(m2.e);
  const meio = vizinho(m2, 2, 0);
  usar(m2.e, meio);
  Object.assign(meio, { x: m2.e.hunt.pos.x + 30, y: m2.e.hunt.pos.y + 30 });
  liberar(m2.e, 0);
  m2.e.hunt.clock += 1;
  const com = golpesEm(usar(m2.e, m2.b, { slot: 1, v: 0.5 }).eventos, m2.b)[0]?.v;
  assert.ok(sem > 0 && com > sem, `${com} > ${sem}`);
});
