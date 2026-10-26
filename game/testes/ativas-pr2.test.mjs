// (lote PR2, dono 20/10) AS GEMAS ATIVAS DE PROJÉTIL DO RECURSO (o plano do grupo, as recomendações aceitas): o Ritual Proibido (a base pela Vida e pelo Escudo
// de Energia; o dano em você pela resistência a Caos, que pode matar), o Drenar Essência (a Vida regenerada e a perda do Desespero pelo dano de cada debuff), a
// Barganha Sombria em você (sem Esqueleto: 12% da Vida como Caos base e o "mais Dano"), os Compostos (as cargas dos frascos por projétil, o bônus de cada
// frasco, o Definhar da qualidade) e o salto no solo em direções sorteadas do Saltador. Os números são os do PoE (o PoB, o poedb); os sorteios ficam travados.
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
const PR2 = await import('../systems/itens-poe/gemas-pr2.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Frascos = await import('../systems/itens-poe/frascos.mjs');
const Dot = await import('../systems/combate/dot.mjs');
const Secundarios = await import('../systems/skills/golpes-secundarios.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');

let J;
let gerarPeca;
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 70, rng: () => 0.5 }));
const perto = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

/** Roda `fn` com o `Math.random` travado em `v`. */
function travado(v, fn) {
  const antes = Math.random;
  Math.random = () => v;
  try { return fn(); } finally { Math.random = antes; }
}
/** O personagem com a gema na arma (e os frascos no cinto), numa caçada; o alvo imortal colado e os outros longe. */
async function montar(slug, { nivel = 20, qualidade = 0, arma = 'Wands/Driftwood_Wand', frascos = [] } = {}) {
  J ??= await import('../systems/itens-poe/jogo.mjs');
  gerarPeca ??= (await import('../systems/itens-poe/gerar.mjs')).gerarPeca;
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Scion', sistema: 'poe' });
  const a = peca(arma);
  a.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
  e.equipment = { ...e.equipment, weapon: a };
  delete e.equipment.shield;
  e.inventory = [GS.itemDaGema({ id: G.doSlug(slug).itemId, nivel, xp: 0, raridade: 'comum', qualidade })];
  GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
  for (const f of frascos) { e.inventory.push(peca(f)); assert.ok(Frascos.por(e, { pilha: e.inventory.length - 1 }).ok); }
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: G.doSlug(slug).acao, enabled: true, minMana: 0, conditions: [] };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(travado(0.5, () => Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' })).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 1e7;
  e.maxHp = e.hp = 1e7;
  const [b, ...resto] = e.hunt.monstros;
  for (const m of resto) Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60 });
  Object.assign(b, { x: e.hunt.pos.x + 1, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12, estados: {}, resist: {}, armaduraPct: -100, dots: [] });
  return { e, b, resto, entry: Acoes.POR_ID_PUBLICO(G.doSlug(slug).acao) };
}
/** Usa a gema no alvo (com a conjuração concluída), com o sorteio travado. */
function usar(e, b, v = 0.5) {
  return travado(v, () => {
    const x = Acoes.disparar(e, e.hunt, PERSONAGEM, 0, b, { manual: true });
    if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM); }
    return x;
  });
}

// ---------------------------------------------------------------- o status

test('PR2: as gemas do lote saem de parcial; a Barganha Sombria fica só com a parte dos Esqueletos (da outra sessão)', { skip: SEM }, () => {
  for (const s of ['Forbidden_Rite', 'Forbidden_Rite_of_Soul_Sacrifice', 'Essence_Drain', 'Essence_Drain_of_Wickedness', 'Essence_Drain_of_Desperation', 'Poisonous_Concoction', 'Poisonous_Concoction_of_Bouncing', 'Explosive_Concoction', 'Explosive_Concoction_of_Destruction']) {
    const r = G.REGISTRO.get(s);
    assert.deepEqual([s, r.statusNoJogo, r.motivosNoJogo], [s, 'funciona', []]);
  }
  const db = G.REGISTRO.get('Dark_Bargain').motivosNoJogo;
  assert.ok(db.length && db.every((m) => /da Vida do Esqueleto/.test(m)), JSON.stringify(db));
});

// ---------------------------------------------------------------- o Ritual Proibido

test('PR2: o Ritual Proibido — as linhas do PoB (14% da Vida + 5% do Escudo; o do Sacrifício: 20% do Escudo) e o dano em você pela resistência a Caos', { skip: SEM }, () => {
  assert.deepEqual(G.ritualDaGema('Forbidden_Rite', 20), { vidaPct: 14, esPct: 5, sofreVidaPct: 40, sofreEsPct: 25 });
  assert.deepEqual(G.ritualDaGema('Forbidden_Rite_of_Soul_Sacrifice', 20), { vidaPct: 0, esPct: 20, sofreVidaPct: 0, sofreEsPct: 50 });
  assert.equal(G.ritualDaGema('Fireball', 20), null);
  const r = G.ritualDaGema('Forbidden_Rite', 20);
  assert.equal(PR2.baseDoRitual(r, 5000, 2000), 700 + 100);
  // o PoB: floor(round(Vida × 40%) × (100 − res)/100) + o mesmo do Escudo (25%) — com 75% de resistência a Caos: 2000 × 0,25 + 500 × 0,25
  assert.equal(PR2.danoEmVoceDoRitual(r, 5000, 2000, 0.25), 500 + 125);
  assert.equal(PR2.danoEmVoceDoRitual(r, 5000, 2000, 0), 0, 'a Inoculação do Caos: imune');
});

test('PR2: o Ritual Proibido no uso — a Vida máxima entra como Caos BASE (mín. = máx., sem a eficácia de 110%) e fere você a cada conjuração', { skip: SEM }, async () => {
  const { e, b, entry } = await montar('Forbidden_Rite');
  const com = (vida) => { e.maxHp = vida; Ficha.invalidar(e); return Acoes.danoMostrado(e, entry); };
  const d1 = com(1000);
  const d2 = com(11000);
  // a base do nível 20: 498–747; o a mais de 10.000 de Vida: 1400, no mínimo e no máximo
  const f = (d2.min - d1.min) / 1400;
  assert.ok(f > 0 && perto(d2.max - d1.max, d2.min - d1.min, 0.01), `${JSON.stringify(d1)} → ${JSON.stringify(d2)}`);
  assert.ok(perto(d1.min, (498 + 140) * f, 0.01), `a base não leva a eficácia: ${d1.min} vs ${(498 + 140) * f}`);
  // o dano em você: 40% da Vida máxima pela resistência a Caos (o Escudo da ficha, 0)
  e.maxHp = e.hp = 1e6;
  Ficha.invalidar(e);
  const ficha = Ficha.combate(e);
  assert.equal(ficha.energyShield ?? 0, 0);
  const esperado = Math.floor(400_000 * ModsPoe.fatorDaResistenciaRecebida(ficha, 'chaos'));
  assert.ok(esperado > 0);
  const r = usar(e, b);
  assert.ok(r.ok, r.erro);
  assert.equal(1e6 - e.hp, esperado);
});

test('PR2: o Ritual Proibido pode MATAR (D1 do dono)', { skip: SEM }, async () => {
  const { e, b } = await montar('Forbidden_Rite');
  e.maxHp = 1000;
  e.hp = 50;
  Ficha.invalidar(e);
  assert.ok(usar(e, b).ok);
  assert.equal(e.hp, 0);
});

// ---------------------------------------------------------------- o Drenar Essência

test('PR2: o Drenar Essência — 0,5% (+0,5% na qualidade 20) do dano do debuff volta como Vida; o da Maldade, 1%; o Desespero perde 0,3% da Vida e do Escudo', { skip: SEM }, () => {
  assert.deepEqual(G.drenoDaGema('Essence_Drain', 20, 0), { vidaPct: 0.5, perdaPct: 0 });
  assert.deepEqual(G.drenoDaGema('Essence_Drain', 20, 20), { vidaPct: 1, perdaPct: 0 });
  assert.deepEqual(G.drenoDaGema('Essence_Drain_of_Wickedness', 20, 20), { vidaPct: 1.5, perdaPct: 0 });
  assert.deepEqual(G.drenoDaGema('Essence_Drain_of_Desperation', 20, 20), { vidaPct: 0, perdaPct: 0.3 });
  assert.equal(G.drenoDaGema('Fireball', 20), null);
});

test('PR2: no uso, cada pulso do debuff do Drenar Essência devolve a % do dano dele como a sua Vida (somados, D2)', { skip: SEM }, async () => {
  const { e, b } = await montar('Essence_Drain');
  assert.ok(usar(e, b).ok);
  const debuffs = (b.dots ?? []).filter((d) => d.chave === 'Essence_Drain');
  assert.ok(debuffs.length && debuffs.every((d) => d.dreno?.vidaPct === 0.5), JSON.stringify(b.dots));
  e.hp = e.maxHp - 1e6;
  const antes = b.hp;
  const hp0 = e.hp;
  const eventos = [];
  e.hunt.clock += 4000;
  Dot.tique(e.hunt, eventos, e.hunt.clock);
  const causado = antes - b.hp;
  assert.ok(causado > 0);
  Acoes.drenoDosDebuffs(e, e.hunt, PERSONAGEM, eventos);
  assert.equal(e.hp - hp0, Math.floor(causado * 0.005));
});

test('PR2: o Desespero perde a Vida e o Escudo pela % do dano do debuff — e não mata (exceção 2)', { skip: SEM }, async () => {
  const { e, b } = await montar('Essence_Drain_of_Desperation');
  assert.ok(usar(e, b).ok);
  const antes = b.hp;
  e.es = 1e6;
  const hp0 = e.hp;
  e.hunt.clock += 4000;
  Dot.tique(e.hunt, [], e.hunt.clock);
  const perda = Math.floor((antes - b.hp) * 0.003);
  assert.ok(perda > 0);
  Acoes.drenoDosDebuffs(e, e.hunt, PERSONAGEM, []);
  assert.equal(hp0 - e.hp, perda);
  assert.equal(1e6 - e.es, perda);
  e.hunt.drenoDosDebuffs = { vida: 0, perda: 1e9 };
  Acoes.drenoDosDebuffs(e, e.hunt, PERSONAGEM, []);
  assert.equal(e.hp, 1);
});

// ---------------------------------------------------------------- a Barganha Sombria (em você)

test('PR2: a Barganha Sombria sem Esqueleto — 12% (+2% da qualidade 20) da sua Vida como Caos base e 136% mais Dano; com Esqueleto vivo, nada disso (D3)', { skip: SEM }, async () => {
  assert.deepEqual(G.barganhaDaGema('Dark_Bargain', 20, 20), { vidaPct: 14, maisPct: 136 });
  assert.deepEqual(G.barganhaDaGema('Dark_Bargain', 1, 0), { vidaPct: 12, maisPct: 56 });
  const { e, entry } = await montar('Dark_Bargain');
  e.maxHp = e.hp = 10_000;
  Ficha.invalidar(e);
  const ef = GS.efeitoNaSkill(e, entry.id);
  const com = Acoes.danoMostrado(e, entry, { ...ef, barganhaComVida: true });
  const sem = Acoes.danoMostrado(e, entry, { ...ef, barganhaComVida: false });
  // (241 + 1200) × f × 2,36 contra 241 × f; (362 + 1200) × f × 2,36 contra 362 × f
  assert.ok(perto(com.min / sem.min, ((241 + 1200) * 2.36) / 241, 0.01), `${com.min} / ${sem.min}`);
  assert.ok(perto(com.max / sem.max, ((362 + 1200) * 2.36) / 362, 0.01), `${com.max} / ${sem.max}`);
  // no balão, sem lacaio: a sua Vida; com um Esqueleto vivo, a parte em você não vale (e a Vida não sai de você — o PoB)
  assert.deepEqual(Acoes.danoMostrado(e, entry), com);
  e.hunt.lacaios = [{ uid: 'l1', pob: 'RaisedSkeleton', nome: 'Esqueleto', hp: 100, maxHp: 100, x: e.hunt.pos.x + 1, y: e.hunt.pos.y }];
  assert.deepEqual(Acoes.danoMostrado(e, entry), sem);
});

// ---------------------------------------------------------------- os Compostos

test('PR2: os Compostos — as cargas por projétil (1; o Saltador, 8; o Explosivo, 1 de cada, −15% na qualidade 20) e o bônus de cada frasco', { skip: SEM }, () => {
  assert.deepEqual(G.compostoDaGema('Poisonous_Concoction', 20), { tipo: 'vida', cargas: 1, pctDaRecuperacao: 16 });
  assert.deepEqual(G.compostoDaGema('Poisonous_Concoction_of_Bouncing', 20), { tipo: 'vida', cargas: 8, pctDaRecuperacao: 18 });
  assert.deepEqual(G.compostoDaGema('Explosive_Concoction', 20, 20), { tipo: 'explosivo', cargas: 0.85, safira: [706, 1058], topazio: [151, 1764], rubi: { dot_multi_fire: 196 } });
  assert.deepEqual(G.compostoDaGema('Explosive_Concoction_of_Destruction', 20).rubi, { crit_dmg: 196 });
  assert.deepEqual(PR2.pagosPeloFrasco(10, 8, 2), { pagos: 1, gastas: 8 });
  assert.deepEqual(PR2.pagosPeloFrasco(3, 0.85, 2), { pagos: 2, gastas: 1.7 });
  assert.deepEqual(PR2.pagosPeloFrasco(0.5, 1, 1), { pagos: 0, gastas: 0 });
  assert.deepEqual(G.definharDaGema('Poisonous_Concoction', 20), { chance: 20, ms: 2000 });
  assert.equal(G.definharDaGema('Poisonous_Concoction', 0), null);
});

test('PR2: o Composto Venenoso gasta 1 carga do primeiro Frasco de Vida e ganha Caos adicional = 16% da recuperação dele; sem carga, sai sem o bônus (D4)', { skip: SEM }, async () => {
  const { e, entry } = await montar('Poisonous_Concoction', { frascos: ['Mana_Flasks/Divine_Mana_Flask', 'Life_Flasks/Divine_Life_Flask'] });
  const vida = Frascos.cinto(e)[1];
  const par = Frascos.parametros(vida, Ficha.combate(e).afPoe);
  const cargas = Frascos.cargasDe(vida, par);
  const ef = GS.efeitoNaSkill(e, entry.id);
  const novo = Acoes.comOsFrascosDoComposto(e, entry, ef, 1);
  assert.ok(perto(novo['somadoMin:chaos'] - (ef['somadoMin:chaos'] ?? 0), par.quantidade * 0.16) && perto(novo['somadoMax:chaos'] - (ef['somadoMax:chaos'] ?? 0), par.quantidade * 0.16), JSON.stringify(novo));
  assert.equal(Frascos.cargasDe(vida, par), cargas - 1);
  assert.equal(Frascos.cargasDe(Frascos.cinto(e)[0]), Frascos.parametros(Frascos.cinto(e)[0]).cargasMaximas, 'o de Mana não é tocado');
  // dois projéteis com 1 carga: um pago — o bônus × 1/2 (exceção 4)
  vida.poe.cargas = 1;
  const meio = Acoes.comOsFrascosDoComposto(e, entry, ef, 2);
  assert.ok(perto(meio['somadoMin:chaos'] - (ef['somadoMin:chaos'] ?? 0), par.quantidade * 0.16 * 0.5));
  // sem carga: o mesmo efeito
  vida.poe.cargas = 0;
  assert.equal(Acoes.comOsFrascosDoComposto(e, entry, ef, 1), ef);
});

test('PR2: o Composto Explosivo gasta 1 carga de cada tipo (Rubi, Safira, Topázio) e ganha o Gelo, o Raio e o Multiplicador do Incêndio; no uso, o frasco desce', { skip: SEM }, async () => {
  const { e, b, entry } = await montar('Explosive_Concoction', { frascos: ['Utility_Flasks/Sapphire_Flask', 'Utility_Flasks/Topaz_Flask', 'Utility_Flasks/Ruby_Flask'] });
  const ef = GS.efeitoNaSkill(e, entry.id);
  const novo = Acoes.comOsFrascosDoComposto(e, entry, ef, 1);
  assert.deepEqual([novo['somadoMin:ice'] - (ef['somadoMin:ice'] ?? 0), novo['somadoMax:ice'] - (ef['somadoMax:ice'] ?? 0), novo['somadoMin:energy'] - (ef['somadoMin:energy'] ?? 0), novo['somadoMax:energy'] - (ef['somadoMax:energy'] ?? 0), novo['af:dot_multi_fire'] - (ef['af:dot_multi_fire'] ?? 0)], [706, 1058, 151, 1764, 196]);
  const antes = Frascos.cinto(e).slice(0, 3).map((p) => Frascos.cargasDe(p));
  // no uso de verdade: mais uma carga de cada
  const r = usar(e, b);
  assert.ok(r.ok, r.erro);
  assert.deepEqual(Frascos.cinto(e).slice(0, 3).map((p) => Frascos.cargasDe(p)), antes.map((c) => c - 1));
});

test('PR2: o Composto Explosivo da Destruição — o Rubi dá +196% de Multiplicador de Golpe Crítico ao uso', { skip: SEM }, async () => {
  const { e, entry } = await montar('Explosive_Concoction_of_Destruction', { frascos: ['Utility_Flasks/Ruby_Flask'] });
  const ef = GS.efeitoNaSkill(e, entry.id);
  const novo = Acoes.comOsFrascosDoComposto(e, entry, ef, 1);
  assert.equal(novo['af:crit_dmg'] - (ef['af:crit_dmg'] ?? 0), 196);
  assert.equal(novo['somadoMin:ice'], ef['somadoMin:ice'], 'sem Safira, sem o Gelo');
  const f = Acoes.comAsLinhasDaGema(e, Ficha.combate(e), entry, novo);
  const critDe = (x) => ModsPoe.somaPorTags(x, Acoes.tagsPoeDaSkill(entry)).crit_dmg ?? 0;
  assert.equal(critDe(f) - critDe(Acoes.comAsLinhasDaGema(e, Ficha.combate(e), entry, ef)), 196, 'o "+196%" entra na ficha do uso');
});

test('PR2: o Composto Venenoso da qualidade 20 Definha o acertado (20% por acerto, 2 s)', { skip: SEM }, async () => {
  const { e, b } = await montar('Poisonous_Concoction', { qualidade: 20 });
  assert.ok(usar(e, b, 0.01).ok);
  assert.ok(b.estados?.definhado?.ate > e.hunt.clock, JSON.stringify(b.estados));
  const m = await montar('Poisonous_Concoction', { qualidade: 20 });
  assert.ok(usar(m.e, m.b, 0.5).ok);
  assert.ok(!(m.b.estados?.definhado?.ate > m.e.hunt.clock), 'o sorteio de 50 ≥ 20: sem Definhar');
});

test('PR2: o Saltador ricocheteia no solo em direções sorteadas — cada salto 3 casas a partir do anterior', { skip: SEM }, () => {
  const a = G.alvosNoNivel('Poisonous_Concoction_of_Bouncing', 20);
  assert.ok(a.saltoNoSolo && a.saltoAleatorio);
  const efeito = Acoes.comOsAlvosDaGema(Acoes.POR_ID_PUBLICO(G.doSlug('Poisonous_Concoction_of_Bouncing').acao), { nivel: 20, qualidade: 0 }, null);
  assert.ok(efeito.saltoNoSolo && efeito.saltoAleatorio && efeito.encadear === 2, JSON.stringify(efeito));
  const b = (x, y, uid) => ({ uid, x, y, hp: 10 });
  // o sorteio 0,25: o rumo π/2 (o sul, y+): do alvo em (2,0), (2,3) e depois (2,6)
  const v = [b(2, 0, 'alvo'), b(2, 3, 's1'), b(3, 6, 's2'), b(5, 0, 'reta')];
  const r = Secundarios.resolver({ efeito: { encadear: 2, saltoNoSolo: true, saltoAleatorio: true }, tags: ['projectile'], origem: { x: 0, y: 0 }, alvo: v[0], atingidos: [v[0]], vivos: v, alcance: 7, rng: () => 0.25 });
  assert.deepEqual(r.golpes.map((g) => [g.bicho.uid, g.de.x, g.de.y]), [['s1', 2, 3], ['s2', 2, 6]]);
});
