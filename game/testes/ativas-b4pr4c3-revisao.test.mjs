// (revisão adversarial dos lotes B4, PR4 e C3 das gemas ativas, 25/10) Os achados confirmados, corrigidos pelo PoE (o PoB, o poedb): a largura par do feixe e a
// fração da D-B4.1; a qualidade da Lança da Ramificação; a Intensidade só na sua conjuração; o Encharcado antes do pulso e o andar da Hidroesfera movida; o golpe
// recusado do Orbe Trovejante; a Parede de Gelo dos dois lados ao mesmo tempo e a quina da diagonal; a Flecha Explosiva e a Concha que explodem na morte; uma
// flecha por projétil; o teto das flechas antes do tique; o que grudou some na troca de andar; a Concha esgotada não é sobrescrita; a troca de Postura sem bicho;
// um abalo por vez no Terremoto; o Sangrar da Tempestade da Incerteza; os desenhos dos objetos do C3.
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
const PR4 = await import('../systems/itens-poe/gemas-pr4.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Combate = await import('../systems/hunt/combate.mjs');
const Monstros = await import('../systems/hunt/monstros.mjs');
const Protecao = await import('../systems/protecao.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Desenho = await import('../frontend/client/src/objetos-do-poe.mjs');

let J;
let gerarPeca;
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
const perto = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const QUEM = PERSONAGEM.nome;

function travado(v, fn) {
  const antes = Math.random;
  Math.random = () => v;
  try { return fn(); } finally { Math.random = antes; }
}
/** O personagem com as gemas na arma, numa caçada; o alvo imortal a (`dx`, `dy`) e os outros longe. */
async function montar(slugs, { nivel = 20, qualidade = 0, arma = 'Wands/Driftwood_Wand', dx = 2, dy = 0 } = {}) {
  J ??= await import('../systems/itens-poe/jogo.mjs');
  gerarPeca ??= (await import('../systems/itens-poe/gerar.mjs')).gerarPeca;
  const lista = [slugs].flat();
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Scion', sistema: 'poe' });
  const a = peca(arma);
  a.soquetes = { abertos: lista.length, links: [], gemas: lista.map(() => null), cores: lista.map(() => 'W') };
  e.equipment = { ...e.equipment, weapon: a };
  delete e.equipment.shield;
  e.inventory = lista.map((s) => GS.itemDaGema({ id: G.doSlug(s).itemId, nivel, xp: 0, raridade: 'comum', qualidade }));
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
  Object.assign(b, { x: e.hunt.pos.x + dx, y: e.hunt.pos.y + dy, hp: 1e12, maxHp: 1e12, estados: {}, resist: {}, dots: [], armaduraPct: -100, evasao: 0 });
  e.hunt.cadaveres = [];
  return { e, b, resto };
}
function usar(e, b, { slot = 0, v = 0.5, opcoes = { manual: true } } = {}) {
  return travado(v, () => {
    const x = Acoes.disparar(e, e.hunt, PERSONAGEM, slot, b, opcoes);
    if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; return { ...x, eventos: [...(x.eventos ?? []), ...(Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM) ?? [])] }; }
    return x;
  });
}
const liberar = (e, ms = 1) => { e.hunt.cooldowns = {}; delete e.hunt.conjurando; e.hunt.clock += ms; };
function tiques(e, total, ms = 50, v = 0.5) {
  const ev = [];
  travado(v, () => { for (let t = 0; t < total; t += ms) { e.hunt.clock += ms; ev.push(...Acoes.tiqueDasPlantadas(e, e.hunt, PERSONAGEM, [])); } });
  return ev;
}
const tiquePR4 = (e, t, v = 0.5) => travado(v, () => { e.hunt.clock = t; return Acoes.tiqueDasGemasPR4(e, e.hunt, PERSONAGEM, [], t); });
const golpesEm = (ev, m) => (ev ?? []).filter((x) => x.t === 'dmg' && x.foe !== false && x.uid === m.uid);
const outro = (e, m, dx, dy) => Object.assign(m, { x: e.hunt.pos.x + dx, y: e.hunt.pos.y + dy, hp: 1e12, maxHp: 1e12, estados: {}, resist: {}, dots: [], armaduraPct: -100, evasao: 0 });
const objetos = (e, tipo) => (e.hunt.poeObjetos ?? []).filter((o) => o.tipo === tipo && o.ate > e.hunt.clock);

// ---------------------------------------------------------------- B4

test('revisão B4 (1): a largura PAR do feixe vale — a fração da D-B4.1 conta a partir de 1 casa', () => {
  const de = { x: 0, y: 0 };
  const para = { x: 5, y: 0 };
  assert.equal(B4.casasDoFeixe(de, para, 1).length, 6);
  assert.equal(B4.casasDoFeixe(de, para, 2).length, 12, 'antes a 2 dava as 6 da 1');
  assert.equal(B4.casasDoFeixe(de, para, 3).length, 18);
  // a Chuva Tempestuosa (1,2 m) com o fator 4 da Área: 1,2 casa — a fração 0,2 é a chance da 2ª
  assert.equal(B4.larguraDoFeixe(1.2, 4, () => 0.1), 2);
  assert.equal(B4.larguraDoFeixe(1.2, 4, () => 0.3), 1);
  assert.equal(B4.casasDoFeixe(de, para, B4.larguraDoFeixe(1.2, 4, () => 0.1)).length, 12);
});

test('revisão B4 (7): a qualidade da Lança da Ramificação ("20% mais Área de Efeito") alarga e alonga o feixe; a da Lança comum, não', { skip: SEM }, () => {
  const q0 = G.b4DaGema('Crackling_Lance_of_Branching', 20, 0).lanca;
  const q20 = G.b4DaGema('Crackling_Lance_of_Branching', 20, 20).lanca;
  assert.equal(q0.fatorDaArea, undefined);
  assert.ok(perto(q20.fatorDaArea, 1.2));
  assert.equal(G.b4DaGema('Crackling_Lance', 20, 20).lanca.fatorDaArea, undefined);
  const de = { x: 0, y: 0 };
  const para = { x: 7, y: 0 };
  const sem = B4.casasDaLancaNoUso(de, para, q0, 0, () => 0);
  const com = B4.casasDaLancaNoUso(de, para, q20, 0, () => 0);
  // 7 casas × √1,2 = 7,67: com o sorteio 0, 8 casas no principal
  assert.ok(com.some((c) => c.x === 8 && c.y === 0) && !sem.some((c) => c.x === 8 && c.y === 0), 'o principal com 8 casas');
  assert.ok(com.length > sem.length);
  // com o sorteio alto, a fração não sai: o mesmo feixe
  assert.equal(B4.casasDaLancaNoUso(de, para, q20, 0, () => 0.99).length, sem.length);
});

test('revisão B4 (7, dono 25/10): toda a Área do uso alarga e alonga o feixe das duas Lanças, como o PoB; a largura segue os metros ÷ 2', { skip: SEM }, () => {
  const l = G.b4DaGema('Crackling_Lance', 20, 0).lanca;
  const de = { x: 0, y: 0 };
  const para = { x: 7, y: 0 };
  const sem = B4.casasDaLancaNoUso(de, para, l, 3, () => 0);
  // o fator 2 com a Intensidade 3: 1,9 m ÷ 2 × √2 = 1,34 casa (o sorteio 0: 2 casas); 7 × √2 = 9,9 casas (o sorteio 0: 10)
  const com = B4.casasDaLancaNoUso(de, para, l, 3, () => 0, 2);
  assert.ok(!sem.some((c) => c.x === 8) && com.some((c) => c.x === 10 && c.y === 0), 'o comprimento');
  assert.ok(!sem.some((c) => c.x === 1 && c.y === 1) && com.some((c) => c.x === 1 && c.y === 1), 'a largura de 2 casas');
  // menos Área encurta: 7 × √0,5 = 4,9 casas
  assert.ok(!B4.casasDaLancaNoUso(de, para, l, 0, () => 0.99, 0.5).some((c) => c.x === 6 && c.y === 0));
  // a da Ramificação: a qualidade multiplica com a Área do uso (1,2 × 2 = 2,4: 7 × 1,55 = 10,8 casas)
  const r = G.b4DaGema('Crackling_Lance_of_Branching', 20, 20).lanca;
  assert.ok(B4.casasDaLancaNoUso(de, para, r, 0, () => 0, 2).some((c) => c.x === 11 && c.y === 0));
});

test('revisão B4 (6): a Lança ativada por gatilho não ganha Intensidade; a conjurada por você, sim', { skip: SEM }, async () => {
  const m = await montar('Crackling_Lance', { dx: 1 });
  const id = G.doSlug('Crackling_Lance').acao;
  const r = usar(m.e, m.b, { opcoes: { gatilho: { acao: { id, enabled: true, minMana: 0, minTargets: 1, conditions: [] }, semCusto: true, ignorarRecarga: true } } });
  assert.ok(r.ok, r.erro);
  assert.equal(m.e.hunt.poeIntensidade?.[id]?.n ?? 0, 0, 'o gatilho não conta');
  liberar(m.e, 1000);
  assert.ok(usar(m.e, m.b).ok);
  assert.equal(m.e.hunt.poeIntensidade[id].n, 1);
});

test('revisão B4 (2, 3): o pulso da Hidroesfera já sai com o Encharcado; movida, ela vai para o andar de agora', { skip: SEM }, async () => {
  const m = await montar('Hydrosphere', { dx: 2 });
  assert.ok(usar(m.e, m.b).ok);
  const g1 = golpesEm(tiques(m.e, 50), m.b);
  assert.equal(g1.length, 1);
  // o segundo pulso (movida no mesmo bicho, ainda Encharcado): o mesmo dano — o primeiro já tinha a Exposição
  liberar(m.e, 1000);
  const [o] = objetos(m.e, 'hidroesfera');
  o.z = 99; // (como se tivesse sido posta em outro andar)
  assert.ok(usar(m.e, m.b).ok);
  assert.equal(o.z, m.e.hunt.z ?? 0, 'o andar de agora');
  const g2 = golpesEm(tiques(m.e, 50), m.b);
  assert.equal(g2.length, 1, 'movida, pulsa no andar de agora');
  assert.ok(perto(g1[0].v, g2[0].v, 0.01), `${g1[0].v} × ${g2[0].v}`);
});

test('revisão B4 (5): na zona segura o golpe do Orbe Trovejante é recusado — não aparece nem gasta golpe', { skip: SEM }, async () => {
  const m = await montar('Orb_of_Storms', { dx: 2 });
  assert.ok(usar(m.e, m.b).ok);
  tiques(m.e, 100);
  const [o] = objetos(m.e, 'orbeTempestade');
  const antes = o.golpes;
  Protecao.marcarImune(m.e.hunt, true);
  const ev = tiques(m.e, 2600);
  assert.equal(golpesEm(ev, m.b).length, 0);
  assert.equal(ev.filter((x) => x.t === 'explosao').length, 0, 'sem o desenho do golpe');
  assert.equal(o.golpes, antes, 'o golpe não foi gasto');
  Protecao.marcarImune(m.e.hunt, false);
  assert.equal(golpesEm(tiques(m.e, 2600), m.b).length, 1);
  assert.equal(o.golpes, antes - 1);
});

test('revisão B4 (8): a Parede de Gelo cresce do centro para os DOIS lados ao mesmo tempo', { skip: SEM }, async () => {
  const m = await montar('Frost_Wall', { dx: 2 });
  assert.ok(usar(m.e, m.b, { v: 0.1 }).ok);
  const s = objetos(m.e, 'secaoGelo');
  assert.deepEqual(s.map((o) => [o.x - m.e.hunt.pos.x, o.y - m.e.hunt.pos.y, o.aparece - s[0].aparece]), [[2, 0, 0], [2, 1, 150], [2, -1, 150]]);
});

test('revisão B4 (9): a Parede de Gelo na diagonal fecha as quinas; a grade sem as paredes fica guardada enquanto elas não mudam', () => {
  const andavel = new Set();
  for (let x = 0; x < 10; x++) for (let y = 0; y < 10; y++) andavel.add(`${x},${y}`);
  const grade = { andavel };
  const sec = (x, y) => ({ tipo: 'secaoGelo', parede: 'p#1', x, y, z: 0, ate: 10_000, aparece: 0 });
  const hunt = { z: 0, clock: 100, poeObjetos: [sec(5, 5), sec(4, 6), sec(6, 4)] };
  const g = Acoes.gradeSemParedes(hunt, grade, 100);
  for (const k of ['5,5', '4,6', '6,4']) assert.ok(!g.andavel.has(k), k);
  // as quinas: entre (4,6) e (5,5), e entre (5,5) e (6,4)
  assert.ok(!g.andavel.has('5,6') && !g.andavel.has('6,5'), 'a escada contínua');
  assert.equal(Acoes.gradeSemParedes(hunt, grade, 120), g, 'a mesma grade no tique seguinte');
  hunt.poeObjetos.pop();
  const g2 = Acoes.gradeSemParedes(hunt, grade, 140);
  assert.notEqual(g2, g, 'a parede mudou: a grade é refeita');
  assert.ok(g2.andavel.has('6,4') && g2.andavel.has('6,5'));
});

// ---------------------------------------------------------------- PR4

test('revisão PR4 (11): cada projétil no mesmo alvo gruda a sua flecha (a Barragem, os extras)', { skip: SEM }, () => {
  const b = { uid: 1 };
  const d = { uid: 2 };
  assert.equal(PR4.alvosFinais([b], [{ bicho: b, tipo: 'projetil' }, { bicho: b, tipo: 'projetil' }]).length, 3);
  assert.deepEqual(PR4.alvosFinais([b], [{ bicho: d, tipo: 'perfuracao' }, { bicho: b, tipo: 'projetil' }]).map((x) => x.uid), [2, 1]);
});

test('revisão PR4 (12): as flechas da Flecha Explosiva não passam do máximo antes do tique', { skip: SEM }, async () => {
  const { e, b } = await montar('Explosive_Arrow', { arma: 'Bows/Crude_Bow', dx: 3 });
  assert.ok(usar(e, b).ok);
  b.poeFusiveis[QUEM].n = 19;
  for (let k = 0; k < 3; k++) { liberar(e); assert.ok(usar(e, b).ok); }
  assert.equal(b.poeFusiveis[QUEM].n, 20);
  assert.equal(b.poeFusiveis[QUEM].max, 20);
});

test('revisão PR4 (10): a Flecha Explosiva explode quando o bicho morre (e sai da sala antes do tique)', { skip: SEM }, async () => {
  const { e, b, resto } = await montar('Explosive_Arrow', { arma: 'Bows/Crude_Bow', dx: 3 });
  const v = outro(e, resto[0], 4, 0);
  assert.ok(usar(e, b).ok);
  assert.equal(b.poeFusiveis[QUEM].n, 1);
  b.hp = 0;
  Combate.processarMortes(e, PERSONAGEM, []);
  assert.ok(!e.hunt.monstros.includes(b), 'o morto saiu da sala');
  const ev = tiquePR4(e, e.hunt.clock + 1);
  assert.ok(ev.some((x) => x.t === 'explosao' && x.x === b.x && x.y === b.y), 'a explosão na casa do morto');
  assert.equal(golpesEm(ev, v).length, 1, 'o vizinho no raio');
  assert.equal(e.hunt.poeRestosPR4, undefined, 'os restos saem');
  assert.equal(golpesEm(tiquePR4(e, e.hunt.clock + 100), v).length, 0, 'uma vez');
});

test('revisão PR4 (10, 14): a Concha esgotada no golpe que mata explode; a esgotada à espera do tique não é sobrescrita', { skip: SEM }, async () => {
  const { e, b, resto } = await montar('Somatic_Shell', { dx: 3 });
  const v = outro(e, resto[0], 4, 0);
  assert.ok(usar(e, b).ok);
  // esgotada à espera do tique: usar de novo não põe outra concha por cima
  b.poeConchas[QUEM].hp = 0;
  b.poeConchas[QUEM].estourou = e.hunt.clock;
  const estourou = e.hunt.clock;
  liberar(e);
  assert.ok(usar(e, b).ok);
  assert.equal(b.poeConchas[QUEM].estourou, estourou, 'a esgotada ficou');
  // e o bicho morre no mesmo golpe: os restos explodem no tique e a concha passa ao vizinho
  b.hp = 0;
  Combate.processarMortes(e, PERSONAGEM, []);
  assert.ok(!e.hunt.monstros.includes(b));
  const ev = tiquePR4(e, e.hunt.clock);
  assert.ok(ev.some((x) => x.t === 'explosao' && x.x === b.x && x.y === b.y));
  assert.ok(golpesEm(ev, v).length >= 1, 'o vizinho no raio');
  assert.ok(v.poeConchas?.[QUEM], 'a concha passou');
});

test('revisão PR4 (13): na troca de andar, as flechas grudadas e os golpes da Eletrocussão somem — não caem todos na volta', { skip: SEM }, async () => {
  const { e, b } = await montar('Explosive_Arrow', { arma: 'Bows/Crude_Bow', dx: 3 });
  assert.ok(usar(e, b).ok);
  b.poeEletrocussao = [{ quem: QUEM, acao: b.poeFusiveis[QUEM].acao, proxima: e.hunt.clock + 500, intervaloMs: 500, restam: 4 }];
  const z = e.hunt.z ?? 0;
  const pos = { x: e.hunt.pos.x, y: e.hunt.pos.y };
  assert.ok(Monstros.trocarDeAndar(e.hunt, { z: z + 1, x: pos.x, y: pos.y }));
  assert.equal(b.poeFusiveis, undefined);
  assert.equal(b.poeEletrocussao, undefined);
  e.hunt.clock += 10_000;
  assert.ok(Monstros.trocarDeAndar(e.hunt, { z, x: pos.x, y: pos.y }));
  assert.ok(e.hunt.monstros.includes(b));
  const ev = tiquePR4(e, e.hunt.clock);
  assert.equal(golpesEm(ev, b).length, 0);
  assert.ok(!ev.some((x) => x.t === 'explosao'));
});

// ---------------------------------------------------------------- C3

test('revisão C3 (15): a troca de Postura do Sangue e Areia sai sem bicho por perto', { skip: SEM }, async () => {
  const { e, b } = await montar('Blood_and_Sand', { arma: 'One_Hand_Swords/Rusted_Sword', dx: 1 });
  assert.ok(usar(e, b).ok);
  const id = G.doSlug('Blood_and_Sand').acao;
  assert.equal(e.hunt.buffs[id].postura, 'sangue');
  for (const m of e.hunt.monstros) Object.assign(m, { x: e.hunt.pos.x + 30, y: e.hunt.pos.y + 30 });
  e.hunt.clock = Math.max(e.hunt.clock, e.hunt.cooldowns?.[id]?.ate ?? 0);
  const r = Acoes.disparar(e, e.hunt, PERSONAGEM, 0, null, { manual: true });
  assert.ok(r.ok && r.postura === 'areia', JSON.stringify(r));
});

test('revisão C3 (16): o Terremoto e o da Amplificação — com o abalo anterior pendente, o uso não cria outro (o PoB); depois do estouro, sim', { skip: SEM }, async () => {
  for (const slug of ['Earthquake', 'Earthquake_of_Amplification']) {
    const { e, b } = await montar(slug, { arma: 'Two_Hand_Maces/Driftwood_Maul', qualidade: 20, dx: 1 });
    assert.ok(usar(e, b).ok);
    const [a] = objetos(e, 'abalo');
    assert.ok(a, slug);
    liberar(e, 100);
    const r = usar(e, b);
    assert.ok(r.ok, r.erro);
    assert.ok(golpesEm(r.eventos, b).length >= 1, `${slug}: o uso golpeia`);
    assert.equal(objetos(e, 'abalo').length, 1, `${slug}: um abalo por vez`);
    e.hunt.clock = a.ate;
    travado(0.5, () => { Acoes.tiqueDosObjetos(e, e.hunt, PERSONAGEM, [], e.hunt.clock); });
    liberar(e, 1);
    assert.ok(usar(e, b).ok);
    assert.equal(objetos(e, 'abalo').length, 1, `${slug}: o novo depois do estouro`);
    assert.notEqual(objetos(e, 'abalo')[0], a);
  }
});

test('revisão C3 (17): a tempestade de Sangue da Tempestade de Lâminas da Incerteza faz Sangrar (o PoB: "Blood bladestorms … cause Bleeding")', { skip: SEM }, () => {
  assert.equal(G.objetoDaGema('Bladestorm_of_Uncertainty', 20, 20).sangra, true);
  assert.equal(G.objetoDaGema('Bladestorm', 20, 20).sangra, true);
});

// ---------------------------------------------------------------- a tela

test('revisão C3 (19): os objetos do C3 têm desenho na tela; nenhum tipo repetido entre os lotes', () => {
  for (const t of Desenho.TIPOS_C3) assert.ok(Desenho.estiloDoObjeto({ t }), t);
  assert.notDeepEqual(Desenho.estiloDoObjeto({ t: 'tempestadeDeLaminas', postura: 'areia' }), Desenho.estiloDoObjeto({ t: 'tempestadeDeLaminas', postura: 'sangue' }));
  const todos = [...Desenho.TIPOS, ...Desenho.TIPOS_B4, ...Desenho.TIPOS_C3];
  assert.equal(new Set(todos).size, todos.length);
});
