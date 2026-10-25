// (lotes G-B e G-D, dono 25/10) AS GUARDAS, AS MECÂNICAS NOVAS E O ESCUDO TEMPESTUOSO (o plano `plano-ativas-3.md`, as recomendações aceitas): a absorção das Guardas
// (depois da mitigação, antes do Escudo de Energia; uma por vez; a recarga compartilhada e parada durante o efeito), a reflexão da Carapaça, o gasto do Manto Arcano, o
// Chamado Imortal pelas cargas e o Vaal (não pode morrer), a Armadura Ártica (Resfria quem acerta) e a Vaal (Congelado até o gelo quebrar), a Fúria Sangrenta que mata, a
// Onda Arcana com a Eficácia de 450%, o Emblema do Poder na party, a Energia da Penitência, os feixes da Tempestuosa, o Arcanista, o Fogo Justo, o Pacto de K'Tash, os
// Clamores Infernal e de Reunião e o Escudo Tempestuoso. Os números são os do PoE (o PoB, o poedb); os sorteios ficam travados.
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
const GBD = await import('../systems/itens-poe/gemas-gbd.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Combate = await import('../systems/hunt/combate.mjs');
const CargasPoe = await import('../systems/itens-poe/cargas.mjs');
const Runas = await import('../systems/itens-poe/runas-vinculadas.mjs');

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
 * O personagem com as gemas (`slugs`, na arma; ligadas umas às outras) numa caçada; o alvo imortal a `dx` casas e os outros longe. `escudo`: uma base de escudo na
 * mão secundária.
 */
async function montar(slugs, { nivel = 20, qualidade = 0, arma = 'Wands/Driftwood_Wand', dx = 1, escudo = null } = {}) {
  J ??= await import('../systems/itens-poe/jogo.mjs');
  gerarPeca ??= (await import('../systems/itens-poe/gerar.mjs')).gerarPeca;
  const lista = Array.isArray(slugs) ? slugs : [slugs];
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Scion', sistema: 'poe' });
  const a = peca(arma);
  a.soquetes = { abertos: lista.length, links: lista.slice(1).map(() => true), gemas: lista.map(() => null), cores: lista.map(() => 'W') };
  e.equipment = { ...e.equipment, weapon: a };
  if (escudo) e.equipment.shield = peca(escudo);
  else delete e.equipment.shield;
  e.inventory = lista.map((s) => GS.itemDaGema({ id: G.doSlug(s).itemId, nivel, xp: 0, raridade: 'comum', qualidade }));
  for (let i = 0; i < lista.length; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  e.actions = Array(Acoes.SLOTS).fill(null);
  lista.forEach((s, i) => { e.actions[i] = { id: G.doSlug(s).acao, enabled: true, minMana: 0, conditions: [] }; });
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(travado(0.5, () => Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' })).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 10_000;
  e.maxHp = e.hp = 100_000;
  const [b, ...resto] = e.hunt.monstros;
  for (const m of resto) Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60 });
  Object.assign(b, { x: e.hunt.pos.x + dx, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12, estados: {}, resist: {}, armaduraPct: -100, evasao: 0 });
  return { e, b, resto };
}
/** Usa o slot `slot` (a gema `i`) no alvo, com a conjuração concluída e o sorteio travado. */
function usar(e, b, slot = 0, v = 0.5) {
  return travado(v, () => {
    const x = Acoes.disparar(e, e.hunt, PERSONAGEM, slot, b, { manual: true });
    if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; return { ...x, eventos: Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM) }; }
    return x;
  });
}
const liberar = (e) => { e.hunt.cooldowns = {}; delete e.hunt.conjurando; e.hunt.clock += 1; };
const id = (slug) => G.doSlug(slug).acao;
const golpesEm = (eventos, m) => (eventos ?? []).filter((v) => v.t === 'dmg' && v.uid === m.uid).map((v) => v.v);

// ---------------------------------------------------------------- o status e os números

test('G-BD: os números das linhas no nível 20, como o PoB e o poedb', { skip: SEM }, () => {
  assert.deepEqual(G.daGemaGBD('Steelskin', 20).guarda, { pct: 70, fixo: 2209 });
  assert.deepEqual(G.daGemaGBD('Molten_Shell', 20).guarda, { pct: 75, armaduraPct: 10, maximo: 5000, reflete: { pct: 3000, porSegundo: false, raioM: 1.5 } });
  assert.deepEqual(G.daGemaGBD('Vaal_Molten_Shell', 20).guarda, { pct: 39, armaduraPct: 20, maximo: 10000, reflete: { pct: 9000, porSegundo: true, raioM: 1.5 } });
  assert.deepEqual(G.daGemaGBD('Arcane_Cloak', 20).guarda, { pct: 75, gastaPct: 64, raioDoGastoPct: 10 });
  assert.deepEqual(G.daGemaGBD('Immortal_Call', 20).chamado, { duracaoPorCargaPct: 20, fisicoPorCargaPct: 15, vaal: false, maxCargas: 5 });
  assert.equal(G.daGemaGBD('Vaal_Immortal_Call', 20).chamado.duracaoPorCargaPct, 157);
  assert.deepEqual(G.daGemaGBD('Old_Arctic_Armour', 20).artica, { resfriaMs: 500, resfriaPct: 30 });
  assert.deepEqual(G.daGemaGBD('Vaal_Arctic_Armour', 20).articaVaal, { menosPct: 90, acertos: 3, manaPorS: 30.6, esPorS: 395 });
  assert.deepEqual(G.daGemaGBD('Pact_of_KTash', 20).ktash, { magias: 1, maisPct: 29, devolveAlmas: true });
  const rf = G.daGemaGBD('Righteous_Fire_of_Arcane_Devotion', 20).fogoJusto;
  assert.deepEqual([rf.modo, rf.pctPorS, rf.queimaPctPorS, rf.conjuracaoMaisPct, rf.dotMagico], ['mana', 70, 90, 24, true]);
  assert.ok(perto(rf.raioM, 2.3));
  const vrf = G.daGemaGBD('Vaal_Righteous_Fire', 20).fogoJusto;
  assert.deepEqual([vrf.modo, vrf.sacrificioPct, vrf.pctPorS, vrf.magicoMaisPct, vrf.raioM], ['sacrificio', 60, 158, 19, 3]);
  assert.deepEqual(G.penitenciaDaGema('Penance_Brand', 20), { modo: 'explode', max: 20 });
  assert.deepEqual(G.penitenciaDaGema('Penance_Brand_of_Dissipation', 20), { modo: 'pulsa', max: 20, acertoPorPct: 20, afeccaoPorPct: 20, raioPorM: 0.1 });
  assert.deepEqual(G.penitenciaDaGema('Penance_Brand_of_Conduction', 20), { modo: 'conduz', propagaM: 0.9 });
  assert.equal(G.feixesDaGema('Storm_Brand', 20), 3);
  assert.equal(G.feixesDaGema('Storm_Brand', 20, 20), 4);
  assert.equal(G.feixesDaGema('Storm_Brand_of_Indecision', 20), 1);
  assert.deepEqual(G.arcanistaDaGema('Arcanist_Brand', 20), { menosPct: 63, contraVinculadoPct: 59, menosAreaPct: 40, freqPct: 0 });
  assert.equal(G.arcanistaDaGema('Arcanist_Brand', 20, 20).freqPct, 10);
  assert.deepEqual(G.infernalDaGema('Infernal_Cry', 20), { combustao: true, explodePct: 8, penalidadeMs: 3400 });
  assert.deepEqual(G.reuniaoDaGema('Rallying_Cry', 20), { armaPct: 4, porPoder: 5, maxPoder: 30, lacaiosMaisPct: 100, porAliadoPct: 5, porAliadoMax: 25 });
});

test('G-BD: as colunas herdadas saem (o 0.6 do plano) e a duração é a do PoE', { skip: SEM }, () => {
  // o Chamado Vaal não tem os −34% / −35% da base; a Armadura Ártica Vaal dura 5 s (o PoB), sem o "enquanto parado"
  assert.deepEqual(G.buffNoNivel('Vaal_Immortal_Call', 20).af, {});
  assert.equal(G.buffNoNivel('Vaal_Immortal_Call', 20).dur, 400);
  const vaa = G.buffNoNivel('Vaal_Arctic_Armour', 20);
  assert.deepEqual(vaa.af, { mana_regen: 30.6, es_regen: 395 });
  assert.equal(vaa.dur, 5000);
  assert.equal(G.buffNoNivel('Steelskin', 20).dur, 1500);
  // o Clamor Infernal: o raio do Clamor é 6 m (radius 60 do PoB) — 3 casas
  assert.equal(G.buffNoNivel('Infernal_Cry', 20).efeitos.find((x) => x.efeito === 'provocar').raio, 3);
  // os do lote com linha do PoB: o Fogo Extra do Infernal e o crítico do Mago de Batalha pelo Poder
  assert.equal(G.clamorPeloPoder('Infernal_Cry', 20, 30).af.phys_as_extra_fire, 25);
  assert.equal(G.clamorPeloPoder('Infernal_Cry', 20, 12).af.phys_as_extra_fire, 10);
  assert.equal(G.clamorPeloPoder('Battlemages_Cry', 20, 30).af.crit_chance, 2.5);
});

/** O golpe corpo a corpo do monstro `b` em você, com o sorteio travado: o que a Vida perdeu, os eventos e o que a Guarda tomou. */
function apanhar(e, b, v = 0.5) {
  const eventos = [];
  const antes = e.hp;
  travado(v, () => Combate.contraAtaque(e, e.hunt, PERSONAGEM, b, eventos));
  return { perdeu: antes - e.hp, eventos, guarda: eventos.filter((x) => x.guarda).reduce((t, x) => t + x.v, 0) };
}

// ---------------------------------------------------------------- G-B: as Guardas

test('G-B: a Pele de Aço absorve 70% do acerto, antes da Vida, até 2209; esgotada, o buff acaba e a recarga começa ali', { skip: SEM }, async () => {
  const { e, b } = await montar('Steelskin');
  e.es = 0;
  const sem = apanhar(e, b);
  assert.ok(sem.perdeu > 0, 'o golpe do monstro fere');
  assert.ok(usar(e, b).ok);
  const sk = id('Steelskin');
  assert.equal(e.hunt.buffs[sk].ate - 100_000, 1500, 'a duração do PoE (1,5 s), sem o piso de 2 s');
  assert.equal(e.hunt.cooldowns[sk].ate, 100_000 + 1500 + 3000, 'a recarga não corre durante o efeito');
  assert.equal(e.hunt.poeGuarda.limite, 2209);
  const com = apanhar(e, b);
  assert.equal(com.guarda, Math.round(sem.perdeu * 0.7), '70% do acerto sai do buff');
  assert.equal(com.perdeu, sem.perdeu - com.guarda, 'o resto vai para a Vida');
  // o limite esgota: o que passa dele vai para a Vida; no tique, o buff sai e a recarga começa agora
  e.hunt.poeGuarda.resta = 2;
  const ultimo = apanhar(e, b);
  assert.equal(ultimo.guarda, 2);
  e.hunt.clock += 10;
  Acoes.tiqueDasGemasGBD(e, e.hunt, PERSONAGEM, [], e.hunt.clock);
  assert.equal(e.hunt.buffs[sk], undefined, 'esgotada, a Guarda acaba');
  assert.equal(e.hunt.poeGuarda, undefined);
  assert.equal(e.hunt.cooldowns[sk].ate, e.hunt.clock + 3000, 'a recarga começa no fim antecipado');
  // (a Imunidade a Sangramento segue no buff)
  assert.equal(G.buffNoNivel('Steelskin', 20).af.imune_sangramento, 1);
});

test('G-B: só uma Guarda por vez, e a recarga é compartilhada entre as Guardas não Vaal', { skip: SEM }, async () => {
  const { e, b } = await montar(['Steelskin', 'Molten_Shell', 'Immortal_Call']);
  const [sk, ms, ic] = ['Steelskin', 'Molten_Shell', 'Immortal_Call'].map(id);
  assert.ok(usar(e, b, 0).ok);
  // a recarga da Pele de Aço vale para as outras Guardas da barra
  assert.equal(e.hunt.cooldowns[ms].ate, e.hunt.cooldowns[sk].ate);
  assert.equal(e.hunt.cooldowns[ic].ate, e.hunt.cooldowns[sk].ate);
  liberar(e);
  assert.ok(usar(e, b, 1).ok);
  assert.equal(e.hunt.buffs[sk], undefined, 'a Carapaça tira a Pele de Aço');
  assert.ok(e.hunt.buffs[ms]?.ate > e.hunt.clock);
  assert.equal(e.hunt.poeGuarda.acao, ms);
  liberar(e);
  assert.ok(usar(e, b, 2).ok);
  assert.equal(e.hunt.buffs[ms], undefined, 'o Chamado Imortal (Guarda) tira a Carapaça');
  assert.equal(e.hunt.poeGuarda, undefined);
});

test('G-B: a Carapaça Derretida absorve 75% até 10% da Armadura e reflete 3000% do absorvido como Fogo em volta ao acabar', { skip: SEM }, async () => {
  const { e, b } = await montar('Molten_Shell');
  e.es = 0;
  assert.ok(usar(e, b).ok);
  const g = e.hunt.poeGuarda;
  const armadura = Ficha.combate(e).armor;
  assert.equal(g.limite, Math.round(Math.min(5000, armadura * 0.1)), 'o limite: 10% da Armadura (já com os +858 do buff), até 5000');
  g.limite = g.resta = 1e6;
  const r = apanhar(e, b);
  assert.ok(r.guarda > 0);
  const vida = b.hp;
  e.hunt.clock = e.hunt.buffs[id('Molten_Shell')].ate;
  const ev = Acoes.tiqueDasGemasGBD(e, e.hunt, PERSONAGEM, [], e.hunt.clock);
  assert.equal(vida - b.hp, Math.round(r.guarda * 30), 'a reflexão: o absorvido × 3000%, sem os seus modificadores, pela resistência (0) do monstro');
  assert.ok(ev.some((x) => x.fonte === 'carapaca'));
});

test('G-B: a Carapaça Vaal reflete 9000% do absorvido em cada segundo, e o total no fim', { skip: SEM }, async () => {
  const { e, b } = await montar('Vaal_Molten_Shell');
  e.es = 0;
  assert.ok(usar(e, b).ok);
  const g = e.hunt.poeGuarda;
  assert.equal(g.pct, 39);
  g.limite = g.resta = 1e6;
  const r = apanhar(e, b);
  const vida = b.hp;
  e.hunt.clock += 1000;
  Acoes.tiqueDasGemasGBD(e, e.hunt, PERSONAGEM, [], e.hunt.clock);
  assert.equal(vida - b.hp, Math.round(r.guarda * 90), 'o do segundo');
  const vida2 = b.hp;
  e.hunt.clock = e.hunt.buffs[id('Vaal_Molten_Shell')].ate;
  Acoes.tiqueDasGemasGBD(e, e.hunt, PERSONAGEM, [], e.hunt.clock);
  assert.equal(vida2 - b.hp, Math.round(r.guarda * 90), 'e o total, no fim');
});

test('G-B: o Manto Arcano gasta 64% da Mana atual (é Mana Gasta), absorve até o gasto e dá Raio adicional de 10% do gasto', { skip: SEM }, async () => {
  const { e, b } = await montar('Arcane_Cloak');
  e.mana = 8000;
  assert.ok(usar(e, b).ok);
  const gasto = Math.floor(8000 * 0.64);
  assert.equal(e.mana, 8000 - gasto - G.custoNoNivel('Arcane_Cloak', 20));
  assert.equal(e.hunt.poeGuarda.limite, gasto);
  assert.equal(e.hunt.poeGuarda.pct, 75);
  const af = e.hunt.buffs[id('Arcane_Cloak')].afPoe;
  const v = Math.round(gasto * 0.1);
  assert.deepEqual([af.added_energy_dmg_min, af.added_energy_dmg_max, af.spell_added_energy_dmg_min, af.spell_added_energy_dmg_max], [v, v, v, v]);
  assert.ok((e.hunt.poeManaGasta ?? []).some((x) => x.n === gasto), 'o gasto conta como Mana Gasta');
});

test('G-B: o Chamado Imortal consome até 5 Tolerâncias: +20% de duração e 15% menos Físico por carga', { skip: SEM }, async () => {
  const { e, b } = await montar('Immortal_Call');
  CargasPoe.ganhar(e, 'tolerancia', { max_tolerancia: 7 }, 7);
  const antes = e.hunt.cargasPoe?.tolerancia?.n ?? 0;
  assert.ok(antes >= 5);
  assert.ok(usar(e, b).ok);
  assert.equal(e.hunt.cargasPoe?.tolerancia?.n ?? 0, antes - 5, 'no máximo 5');
  const buff = e.hunt.buffs[id('Immortal_Call')];
  assert.equal(buff.ate - 100_000, Math.round(1000 * (1 + 5 * 0.2)), '1 s × (1 + 5 × 20%)');
  assert.ok(perto(buff.afPoe.dano_physical_recebido_mais, (0.65 * (1 - 0.75) - 1) * 100), 'os −35% da gema × (1 − 15% × 5)');
  assert.equal(buff.afPoe.dano_fire_recebido_mais, -34);
});

test('G-B: o Chamado Imortal Vaal — você não pode morrer por 0,4 s × (1 + 1,57 × as cargas); sem os −34%/−35% herdados', { skip: SEM }, async () => {
  const { e, b } = await montar('Vaal_Immortal_Call');
  CargasPoe.ganhar(e, 'tolerancia', { max_tolerancia: 7 }, 3);
  const n = e.hunt.cargasPoe?.tolerancia?.n ?? 0;
  assert.ok(n > 0);
  assert.ok(usar(e, b).ok);
  const buff = e.hunt.buffs[id('Vaal_Immortal_Call')];
  assert.equal(buff.ate - 100_000, Math.round(400 * (1 + 1.57 * n)));
  assert.deepEqual(buff.afPoe, {});
  assert.equal(e.hunt.poeImortal, buff.ate);
  const r = apanhar(e, b);
  assert.equal(r.perdeu, 0, 'todo dano é impedido');
  e.hunt.clock = buff.ate;
  Acoes.tiqueDasGemasGBD(e, e.hunt, PERSONAGEM, [], e.hunt.clock);
  assert.equal(e.hunt.poeImortal, undefined);
  assert.ok(apanhar(e, b).perdeu > 0, 'acabou: volta a ferir');
});

test('G-B: a Armadura Ártica Resfria quem acerta você por 0,5 s (30% de Velocidade de Ação)', { skip: SEM }, async () => {
  const { e, b } = await montar('Old_Arctic_Armour');
  assert.ok(usar(e, b).ok);
  apanhar(e, b);
  assert.deepEqual(b.estados.lento, { ate: e.hunt.clock + 500, pct: 30 });
});

test('G-B: a Armadura Ártica Vaal — 90% menos dano de acertos, Congelado até o gelo quebrar no 3º acerto; as regenerações no buff', { skip: SEM }, async () => {
  const Controle = await import('../systems/combate/controle.mjs');
  const { e, b } = await montar('Vaal_Arctic_Armour');
  e.es = 0;
  const sem = apanhar(e, b).perdeu;
  assert.ok(usar(e, b).ok);
  const va = id('Vaal_Arctic_Armour');
  assert.equal(e.hunt.buffs[va].ate - e.hunt.clock, 5000, 'os 5 s do PoB');
  assert.equal(Controle.podeAgir(e.hunt), false, 'conta como Congelado: você não age');
  const r1 = apanhar(e, b);
  assert.ok(Math.abs(r1.perdeu - sem * 0.1) <= 1, `90% menos: ${sem} → ${r1.perdeu}`);
  apanhar(e, b);
  apanhar(e, b);
  assert.equal(e.hunt.buffs[va], undefined, 'o gelo quebra no 3º acerto com dano');
  assert.equal(Controle.podeAgir(e.hunt), true);
  assert.deepEqual(G.buffNoNivel('Vaal_Arctic_Armour', 20).af, { mana_regen: 30.6, es_regen: 395 });
});

test('G-B: a Fúria Sangrenta é Dano Físico degenerativo em você (o PhysicalDegen do PoB) — pode matar', { skip: SEM }, async () => {
  const { e, b } = await montar('Blood_Rage');
  assert.ok(usar(e, b).ok);
  const buff = e.hunt.buffs[id('Blood_Rage')];
  assert.equal(buff.afPoe.perde_vida_pct_s, undefined, 'não é mais a perda do jogo, que parava em 1 de Vida');
  Acoes.tiqueDasGemasGBD(e, e.hunt, PERSONAGEM, [], e.hunt.clock);
  const dot = e.hunt.efeitosDoJogador.dots.find((d) => d.tipo === 'degenFisico');
  const es = Math.round(Ficha.combate(e).energyShield ?? 0);
  assert.ok(perto(dot.falta, ((e.maxHp * 4 + es * 4) / 100) * 0.5), '4% da Vida e do ES máximos por segundo');
  assert.equal(dot.origem.fonte, 'proprio');
  // pode matar: com 1 de Vida, o pulso chega a 0
  const Mecanicas = await import('../systems/mobs/mecanicas.mjs');
  e.hp = 1;
  e.es = 0;
  e.hunt.clock += 600;
  travado(0.5, () => Mecanicas.tique(e, e.hunt, PERSONAGEM, []));
  assert.equal(e.hp, 0, 'o degenerativo da Fúria Sangrenta mata');
});

test('G-B: a Onda Arcana do Cajado Impregnado leva a Eficácia de 450% no dano adicionado às magias', { skip: SEM }, async () => {
  const { e, b } = await montar('Mana-Infused_Staff', { arma: 'Staves/Gnarled_Branch' });
  assert.ok(usar(e, b).ok);
  const onda = () => {
    if (e.hunt.a2) delete e.hunt.a2.ondaEm;
    const vida = b.hp;
    Acoes.ondaArcana(e, e.hunt, PERSONAGEM, [], e.hunt.clock, () => 0.99);
    return vida - b.hp;
  };
  const sem = onda();
  assert.ok(sem > 0);
  e.hunt.buffs['teste:raio-nas-magias'] = { ate: 1e15, tipo: 'teste', afPoe: { spell_added_energy_dmg_min: 100, spell_added_energy_dmg_max: 100 } };
  Ficha.invalidar(e);
  const com = onda();
  const aumento = 1 + (Ficha.combate(e).danoDoElemento?.energy ?? 0) / 100;
  assert.ok(Math.abs(com - sem - 450 * aumento) <= 2, `100 de Raio adicionado às magias × 4,5 (${com - sem})`);
});

test('G-B: o Emblema do Poder vale para o companheiro de party na área (D9)', { skip: SEM }, async () => {
  const A2 = await import('../systems/itens-poe/gemas-a2.mjs');
  const { e } = await montar('Steelskin');
  const pos = e.hunt.pos;
  const dono = { clock: 100_000, a2: { emblema: { x: pos.x + 1, y: pos.y, z: e.hunt.z ?? 0, ate: 200_000, estagios: 3, a2: { raioPorEstagio: [7, 141], estagiosMax: 4 } } } };
  assert.deepEqual(A2.emblemaDoAliado(dono, pos, e.hunt.z ?? 0), { added_energy_dmg_min: 21, added_energy_dmg_max: 423, spell_added_energy_dmg_min: 21, spell_added_energy_dmg_max: 423 });
  assert.equal(A2.emblemaDoAliado(dono, { x: pos.x + 5, y: pos.y }, e.hunt.z ?? 0), null, 'fora da área (2 casas)');
  e.hunt.partilha = { naSala: [e, { hunt: { ...dono, pos: { x: pos.x + 1, y: pos.y }, z: e.hunt.z ?? 0 } }] };
  const t = G.adds(e);
  assert.equal(t.spell_added_energy_dmg_max, 423);
  delete e.hunt.partilha;
});

// ---------------------------------------------------------------- G-D: as Runas

/** Avança as Runas `passos` vezes de `ms` (o tique delas), com o sorteio travado; devolve os eventos. */
function runas(e, passos, ms = 100) {
  const eventos = [];
  for (let i = 0; i < passos; i++) {
    e.hunt.clock += ms;
    travado(0.5, () => Acoes.tiqueDasRunas(e, e.hunt, PERSONAGEM, eventos, e.hunt.clock));
  }
  return eventos;
}

test('G-D: a Runa da Penitência põe 1 de Energia por Ativação e só explode com 20 — vinculada sem limite de tempo (D14)', { skip: SEM }, async () => {
  const { e, b } = await montar('Penance_Brand');
  const ev0 = usar(e, b).eventos ?? [];
  assert.equal(e.hunt.runas.length, 1);
  const r = e.hunt.runas[0];
  assert.equal(r.alvo, b.uid);
  assert.ok(r.vinculadaMs >= 1e12, 'brand_atttached_duration_is_infinite');
  assert.deepEqual(golpesEm(ev0, b), [], 'a primeira Ativação só põe Energia');
  const ev = runas(e, 18);
  assert.deepEqual(golpesEm(ev, b), []);
  assert.equal(r.energia, 19);
  const ev2 = runas(e, 1);
  assert.ok(golpesEm(ev2, b).length > 0, 'com 20 de Energia, a explosão');
  assert.equal(e.hunt.runas.length, 0, 'e a Runa sai');
});

test('G-D: a Runa da Penitência da Dissipação pulsa a cada 1 s com +20% mais por Energia depois da primeira', { skip: SEM }, async () => {
  const { e, b } = await montar('Penance_Brand_of_Dissipation');
  const g1 = golpesEm(usar(e, b).eventos, b);
  assert.equal(g1.length, 1);
  const g2 = golpesEm(runas(e, 10), b);
  assert.equal(g2.length, 1, 'um pulso por segundo');
  assert.ok(Math.abs(g2[0] - g1[0] * 1.2) <= 1, `2 de Energia: 20% mais (${g1[0]} → ${g2[0]})`);
  assert.deepEqual(GBD.pulsoDaDissipacao(G.penitenciaDaGema('Penance_Brand_of_Dissipation', 20), 20), { maisAcertoPct: 380, maisAfeccaoPct: 380, raioExtraM: 1.9000000000000001 });
});

test('G-D: a Runa da Penitência da Condução espalha a Energia aos vizinhos a 1 casa e, ao se desvincular, cada um com Energia leva o acerto', { skip: SEM }, async () => {
  const { e, b, resto } = await montar('Penance_Brand_of_Conduction', { dx: 2 });
  const [v1, v2] = resto;
  Object.assign(v1, { x: b.x + 1, y: b.y, hp: 1e12, maxHp: 1e12, estados: {}, resist: {}, armaduraPct: -100, evasao: 0 });
  Object.assign(v2, { x: b.x + 4, y: b.y + 4, hp: 1e12, maxHp: 1e12, estados: {}, resist: {}, armaduraPct: -100, evasao: 0 });
  const ev0 = usar(e, b).eventos ?? [];
  assert.deepEqual(golpesEm(ev0, b), []);
  assert.ok(b.estados.energiaConducao && v1.estados.energiaConducao, 'o vinculado e o vizinho a 1 casa');
  assert.equal(v2.estados.energiaConducao, undefined, 'o de longe, não');
  const ev = runas(e, 8);
  assert.ok(golpesEm(ev, b).length === 1 && golpesEm(ev, v1).length === 1, 'acabou a duração (0,5 s): um acerto em cada um com Energia');
  assert.equal(golpesEm(ev, v2).length, 0);
  assert.equal(b.estados.energiaConducao, undefined);
});

test('G-D: a Runa Tempestuosa envia os feixes ao vinculado e aos 2 mais perto dele a até 3 casas (D15)', { skip: SEM }, async () => {
  const { e, b, resto } = await montar('Storm_Brand');
  const [v1, v2, v3] = resto;
  const pos = (m, dx, dy) => Object.assign(m, { x: b.x + dx, y: b.y + dy, hp: 1e12, maxHp: 1e12, estados: {}, resist: {}, armaduraPct: -100, evasao: 0 });
  pos(v1, 1, 0); pos(v2, 2, 1); pos(v3, 5, 5);
  const ev = usar(e, b).eventos ?? [];
  assert.equal(golpesEm(ev, b).length, 1);
  assert.equal(golpesEm(ev, v1).length, 1);
  assert.equal(golpesEm(ev, v2).length, 1);
  assert.equal(golpesEm(ev, v3).length, 0, 'o quarto, longe, não');
  assert.ok(golpesEm(ev, b)[0] > golpesEm(ev, v1)[0], 'o "80% mais com Acertos contra o Vinculado" só no vinculado');
});

test('G-D: a Runa do Arcanista ativa as magias ligadas a ela a cada Ativação, com 63% menos Dano e 59% mais com Acertos no Vinculado (D16)', { skip: SEM }, async () => {
  const solo = await montar('Fireball');
  const base = golpesEm(usar(solo.e, solo.b).eventos, solo.b);
  assert.ok(base.length > 0);
  const { e, b } = await montar(['Arcanist_Brand', 'Fireball']);
  assert.equal(GS.ativadaPor(e, id('Fireball')), G.doSlug('Arcanist_Brand').gema.nome, 'a magia ligada só sai pela Runa');
  const ev = usar(e, b, 0).eventos ?? [];
  assert.ok(ev.some((x) => x.t === 'gatilho' && x.skill), 'a Ativação da Runa ativou a magia');
  const g = golpesEm(ev, b);
  assert.equal(g.length, base.length);
  assert.ok(Math.abs(g[0] - base[0] * 0.37 * 1.59) <= Math.max(2, base[0] * 0.01), `${base[0]} × 0,37 × 1,59 ≈ ${g[0]}`);
  // a cada 1 s vinculada
  const ev2 = runas(e, 10);
  assert.equal(golpesEm(ev2, b).length, base.length);
});

// ---------------------------------------------------------------- G-D: o Pacto de K'Tash, o Fogo Justo, o Escudo Tempestuoso e os Clamores

test("G-D: o Pacto de K'Tash fortalece a próxima magia Vaal que causa dano (+29%) e devolve as almas — a recarga volta pronta (D17)", { skip: SEM }, async () => {
  const { e, b } = await montar(['Pact_of_KTash', 'Vaal_Ice_Nova']);
  const vf = id('Vaal_Ice_Nova');
  const sem = golpesEm(usar(e, b, 1).eventos, b);
  assert.ok(sem.length > 0);
  assert.ok(e.hunt.cooldowns[vf].ate > e.hunt.clock + 1000, 'sem o Pacto, a Vaal espera as almas');
  liberar(e);
  assert.ok(usar(e, b, 0).ok);
  assert.ok(e.hunt.poeKtash);
  delete e.hunt.cooldowns[vf];
  e.hunt.clock += 1;
  const com = golpesEm(usar(e, b, 1).eventos, b);
  assert.ok(Math.abs(com[0] - sem[0] * 1.29) <= Math.max(2, sem[0] * 0.01), `${sem[0]} × 1,29 ≈ ${com[0]}`);
  assert.equal(e.hunt.poeKtash, undefined, 'gasto');
  assert.ok(!(e.hunt.cooldowns[vf].ate > e.hunt.clock), 'as almas voltam: a recarga já está pronta');
});

test('G-D: o Fogo Justo da Devoção queima em volta (70% da Mana máxima por segundo) e queima você (90%) sem matar; com 1 de Vida, acaba (D18)', { skip: SEM }, async () => {
  const { e, b, resto } = await montar('Righteous_Fire_of_Arcane_Devotion');
  const longe = Object.assign(resto[0], { x: e.hunt.pos.x + 4, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12, estados: {} });
  assert.ok(usar(e, b).ok);
  const rf = id('Righteous_Fire_of_Arcane_Devotion');
  assert.ok(e.hunt.buffs[rf].ate > 1e12, 'ligado até desligar');
  assert.equal(Ficha.combate(e).afPoe?.cast_speed_mais ?? G.buffNoNivel('Righteous_Fire_of_Arcane_Devotion', 20).af.cast_speed_mais, 24);
  e.hunt.clock += 250;
  e.es = 0;
  const vida = e.hp;
  Acoes.tiqueDasGemasGBD(e, e.hunt, PERSONAGEM, [], e.hunt.clock);
  const q = (b.dots ?? []).find((d) => d.tipo === 'degenFogo' && d.chave === 'Righteous_Fire_of_Arcane_Devotion');
  assert.ok(q && q.falta >= e.maxMana * 0.7 * 0.5 * 0.99, 'a queima em volta: 70% da Mana × 0,5 s, com os aumentos');
  assert.equal((longe.dots ?? []).length, 0, 'fora do raio, não');
  const ModsPoe = await import('../systems/itens-poe/condicoes-poe.mjs');
  const esperado = e.maxMana * 0.9 * 0.25 * ModsPoe.fatorDaResistenciaRecebida(Ficha.combate(e), 'fire');
  assert.ok(Math.abs(vida - e.hp - esperado) <= 1, `a queima em você: 90% da Mana × 0,25 s pela resistência a Fogo (${vida - e.hp} ≈ ${esperado})`);
  e.hp = 5;
  e.hunt.clock += 1000;
  Acoes.tiqueDasGemasGBD(e, e.hunt, PERSONAGEM, [], e.hunt.clock);
  assert.equal(e.hp, 1, 'não mata');
  assert.equal(e.hunt.buffs[rf], undefined, 'com 1 de Vida, acaba');
});

test('G-D: o Fogo Justo Vaal sacrifica 60% da Vida e do ES e queima em volta 158% do sacrificado por segundo, 4 s; 19% mais Dano Mágico', { skip: SEM }, async () => {
  const { e, b } = await montar('Vaal_Righteous_Fire');
  const maxEs = Math.round(Ficha.combate(e).energyShield ?? 0);
  e.es = maxEs;
  assert.ok(usar(e, b).ok);
  assert.equal(e.hp, 100_000 - 60_000);
  const vrf = id('Vaal_Righteous_Fire');
  assert.equal(e.hunt.buffs[vrf].ate - e.hunt.clock, 4000);
  assert.ok(perto(e.hunt.poeFogoJusto.porS, (100_000 + maxEs) * 0.6 * 1.58));
  assert.equal(e.hunt.buffs[vrf].afPoe['mais_dano_acerto@magia'], 19);
  e.hunt.clock += 250;
  Acoes.tiqueDasGemasGBD(e, e.hunt, PERSONAGEM, [], e.hunt.clock);
  assert.ok((b.dots ?? []).some((d) => d.tipo === 'degenFogo' && d.chave === 'Vaal_Righteous_Fire'));
  assert.equal(e.hp, 40_000, 'o Vaal não queima você');
});

test('G-D: o Escudo Tempestuoso é um buff que reserva 25% da Mana; ao bloquear, o raio sai no atacante e ricocheteia', { skip: SEM }, async () => {
  const Reserva = await import('../systems/itens-poe/reserva.mjs');
  const { e, b, resto } = await montar('Tempest_Shield', { arma: 'One_Hand_Swords/Rusted_Sword', escudo: 'Shields/Splintered_Tower_Shield' });
  const ts = id('Tempest_Shield');
  assert.equal(G.doSlug('Tempest_Shield').arquetipo ?? G.REGISTRO.get('Tempest_Shield')?.arquetipo, 'guarda');
  assert.ok(usar(e, b).ok);
  assert.ok(e.hunt.buffs[ts].ate > 1e12, 'ligado (reserva)');
  assert.equal(Reserva.reservadas(e).mana, 2500, '25% da Mana');
  const af = Ficha.combate(e).afPoe ?? {};
  assert.equal(af.imune_eletrizacao, 1);
  const outro = Object.assign(resto[0], { x: b.x + 1, y: b.y, hp: 1e12, maxHp: 1e12, estados: {}, resist: {}, armaduraPct: -100, evasao: 0 });
  const ev = [];
  assert.ok(travado(0.5, () => Acoes.escudoTempestuoso(e, e.hunt, PERSONAGEM, b, ev, e.hunt.clock)));
  assert.equal(golpesEm(ev, b).length, 1, 'o raio no atacante');
  assert.equal(golpesEm(ev, outro).length, 1, 'e o ricochete (+1)');
  // sem escudo, não
  delete e.equipment.shield;
  assert.equal(Acoes.escudoTempestuoso(e, e.hunt, PERSONAGEM, b, [], e.hunt.clock), false);
});

test('G-D: o Clamor Infernal — o Fogo Extra pelo Poder, Impele 6 ataques que ativam a Combustão; o provocado explode ao morrer (8% da Vida dele como Fogo)', { skip: SEM }, async () => {
  const { e, b, resto } = await montar(['Infernal_Cry', 'Heavy_Strike'], { arma: 'One_Hand_Swords/Rusted_Sword' });
  b.raridade = 'unico';
  assert.ok(usar(e, b, 0).ok);
  assert.deepEqual([e.hunt.impelidos.n, e.hunt.impelidos.de], [6, 'Infernal_Cry']);
  const buff = e.hunt.buffs[id('Infernal_Cry')];
  assert.equal(buff.afPoe.phys_as_extra_fire, 20, 'o Poder 20 do Único: 4 × 5% do Físico como Fogo Extra');
  assert.ok(b.estados.infernal?.ate > e.hunt.clock, 'o provocado ganha a penalidade');
  assert.equal(b.estados.infernal.ate - e.hunt.clock, Math.round(3400 * 1), '3,4 s × a Duração');
  liberar(e);
  const ev = usar(e, b, 1).eventos ?? [];
  assert.ok(ev.some((x) => x.fonte === 'combustao' && x.uid === b.uid), 'o ataque Impelido ativou a Combustão no alvo');
  assert.equal(e.hunt.impelidos.n, 5);
  // a explosão do provocado que morre
  const vizinho = Object.assign(resto[0], { x: b.x + 1, y: b.y, hp: 1e9, maxHp: 1e9, estados: {}, resist: {}, armaduraPct: -100, evasao: 0 });
  Object.assign(b, { maxHp: 10_000, hp: 0 });
  const antes = vizinho.hp;
  const ex = Acoes.aoMorrerGBD(e, e.hunt, PERSONAGEM, b, []);
  assert.equal(antes - vizinho.hp, 800, '8% de 10000, sem os seus modificadores');
  assert.ok(ex.some((x) => x.fonte === 'explosao-infernal'));
});

test('G-D: o Clamor de Reunião — +5% mais nos Impelidos por aliado afetado (até 25%) e o buff do dano da arma nos aliados da party', { skip: SEM }, async () => {
  const Aliados = await import('../systems/itens-poe/aliados.mjs');
  const { e, b } = await montar('Rallying_Cry', { arma: 'One_Hand_Swords/Rusted_Sword' });
  b.raridade = 'unico';
  const pos = e.hunt.pos;
  e.hunt.lacaios = [{ hp: 10, maxHp: 10, x: pos.x + 1, y: pos.y + 1, tipo: 'lacaio' }];
  const amigo = { hunt: { pos: { x: pos.x - 1, y: pos.y }, z: e.hunt.z ?? 0, clock: e.hunt.clock } };
  e.hunt.partilha = { naSala: [e, amigo] };
  assert.ok(usar(e, b).ok);
  assert.equal(e.hunt.buffs[id('Rallying_Cry')].afPoe['mais_dano@impelidoClamor'], 10, '2 aliados × 5%');
  const arma = Ficha.armasEquipadas(e).find((a) => a.slot === 'weapon');
  assert.equal(e.hunt.poeReuniao.af.phys_add_min, Math.round((arma.min * 16) / 100), 'o Poder 20: 4 × 4% do dano da arma');
  // o companheiro no raio lê o buff
  amigo.hunt.partilha = { naSala: [amigo, e] };
  const r = Aliados.aplicar(amigo, {});
  assert.equal(r.phys_add_max, e.hunt.poeReuniao.af.phys_add_max);
  delete e.hunt.partilha;
});

test('G-BD: as gemas do lote saem de parcial (o que fica são as linhas da qualidade do G-A e as decisões do dono)', { skip: SEM }, () => {
  for (const s of ['Steelskin', 'Immortal_Call', 'Blood_Rage', 'Mana-Infused_Staff', 'Sigil_of_Power', 'Storm_Brand', 'Storm_Brand_of_Indecision', 'Penance_Brand', 'Penance_Brand_of_Dissipation', 'Penance_Brand_of_Conduction', 'Arcanist_Brand', 'Infernal_Cry', 'Righteous_Fire_of_Arcane_Devotion', 'Vaal_Righteous_Fire', 'Pact_of_KTash', 'Tempest_Shield']) {
    const r = G.REGISTRO.get(s);
    assert.deepEqual([s, r.statusNoJogo, r.motivosNoJogo], [s, 'funciona', []]);
  }
  // (as Guardas com a linha da qualidade "Duração do Efeito"/"Efeito do Buff" — do lote G-A — só têm ela pendente)
  for (const s of ['Molten_Shell', 'Vaal_Molten_Shell', 'Vaal_Immortal_Call', 'Old_Arctic_Armour', 'Vaal_Arctic_Armour', 'Arcane_Cloak']) {
    const r = G.REGISTRO.get(s);
    assert.ok(r.motivosNoJogo.every((m) => /Duração do Efeito de Habilidades aumentada|Efeito do Buff aumentado/.test(m)), `${s}: ${r.motivosNoJogo.join(' | ')}`);
  }
});
