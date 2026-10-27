// OS TOTENS ESPECÍFICOS (lote G20c, 18/10): os ancestrais só agem — e o buff deles só vale em você — com você a até 8 m (o Chefe Guerreiro) / 8,5 m
// (o Protetor) deles (a wiki no poedb), e o buff não soma entre totens; a aura do Rejuvenescedor (4 m, o Efeito de Aura; a Vaal: −30% de área e 40%
// do acerto em você no totem antes); o Solo Sagrado do Flamejante com a imunidade a maldições; a velocidade por totem máximo da Balista de Cerco;
// o Devorador consome o cadáver perto dele e o dreno vem para você.
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
const SP = await import('../systems/itens-poe/suportes-poe.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const LacaiosPoe = await import('../systems/itens-poe/lacaios-poe.mjs');
const QuemFeriu = await import('../systems/hunt/quem-feriu.mjs');
const Aco = await import('../systems/itens-poe/convocar-o-aco.mjs');

const sorte = (v, f) => { const o = Math.random; Math.random = () => v; try { return f(); } finally { Math.random = o; } };

async function montar(arma, grupos) {
  const J = await import('../systems/itens-poe/jogo.mjs');
  const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Scion', sistema: 'poe' });
  const a = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: arma, raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
  const todas = grupos.flat();
  const links = grupos.flatMap((g) => g.map((_, i) => i < g.length - 1)).slice(0, todas.length - 1);
  a.soquetes = { abertos: todas.length, links, gemas: Array(todas.length).fill(null), cores: Array(todas.length).fill('W') };
  e.equipment = { ...e.equipment, weapon: a };
  delete e.equipment.shield;
  e.inventory = todas.map((s) => GS.itemDaGema({ id: (G.doSlug(s) ?? SP.doSlug(s)).itemId, nivel: 20, xp: 0, raridade: 'comum' }));
  for (let i = 0; i < todas.length; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  e.actions = Array(Acoes.SLOTS).fill(null);
  grupos.forEach((g, i) => { e.actions[i] = { id: G.doSlug(g[0]).acao, enabled: true, minMana: 0, conditions: [] }; });
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(sorte(0.999, () => Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' })).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 1e7;
  e.maxHp = e.hp = 1e7;
  const ms = e.hunt.monstros;
  for (const m of ms) Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60, hp: 1e12, maxHp: 1e12, estados: {}, dots: [], resist: {} });
  return { e, ms };
}
/** O seu uso da gema de totem (colocar): a conjuração até o fim; devolve o totem posto. */
function colocar(e, slot = 0) {
  // (a gema de suporte só sai com bicho por perto — `SEM_BICHO_POR_PERTO`)
  Object.assign(e.hunt.monstros[0], { x: e.hunt.pos.x + 3, y: e.hunt.pos.y });
  const r = sorte(0.5, () => Acoes.disparar(e, e.hunt, PERSONAGEM, slot, e.hunt.monstros[0], { manual: true }));
  assert.ok(r.ok, r.erro);
  if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; sorte(0.5, () => Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM)); }
  const l = (e.hunt.lacaios ?? []).filter((x) => x.tipo === 'totem' && x.hp > 0).at(-1);
  assert.ok(l, 'o totem foi posto');
  return l;
}
const Arvore = await import('../systems/arvore.mjs');
const CP = await import('../systems/itens-poe/condicoes-poe.mjs');
const totens = (e) => (e.hunt.lacaios ?? []).filter((l) => l.tipo === 'totem' && l.hp > 0);
const longeDe = (e, l, n) => Object.assign(e.hunt.pos, { x: l.x + n, y: l.y });

test('G20c: o Chefe Guerreiro — ativação de 8 m (4 casas; 10,4 m com a qualidade 20), o buff "18% mais Dano Corpo a Corpo" só com você perto, e não soma entre totens', { skip: SEM }, async () => {
  assert.equal(LacaiosPoe.oQueInvoca('Ancestral_Warchief', 20, { qualidade: 0 }, {}).efeitosDoTotem.ativacaoM, 8);
  assert.ok(Math.abs(LacaiosPoe.oQueInvoca('Ancestral_Warchief', 20, { qualidade: 20 }, {}).efeitosDoTotem.ativacaoM - 10.4) < 1e-9);
  assert.equal(LacaiosPoe.oQueInvoca('Ancestral_Protector', 20, { qualidade: 0 }, {}).efeitosDoTotem.ativacaoM, 8.5);
  assert.deepEqual(LacaiosPoe.oQueInvoca('Ancestral_Protector', 20, null, {}).efeitosDoTotem.buffAtivo, { atk_speed_mais: 20 });
  const { e, ms } = await montar('Two_Hand_Maces/Driftwood_Maul', [['Ancestral_Warchief']]);
  const l = colocar(e);
  assert.equal(l.ativacao, 4);
  longeDe(e, l, 4);
  assert.equal(G.adds(e)?.['mais_dano@corpo'], 18, 'com você a 4 casas');
  e.hunt.lacaios.push({ ...l, uid: 'outro' });
  assert.equal(G.adds(e)?.['mais_dano@corpo'], 18, 'dois Chefes: ainda 18');
  longeDe(e, l, 5);
  assert.equal(G.adds(e)?.['mais_dano@corpo'] ?? 0, 0, 'a 5 casas: nada');
  // o totem só ataca com você perto
  e.hunt.lacaios = e.hunt.lacaios.filter((x) => x.uid !== 'outro');
  Object.assign(ms[0], { x: l.x + 1, y: l.y });
  const ataques = () => { l.proximoGolpe = 0; return sorte(0.001, () => Cacadas.tiqueDosLacaios(e, e.hunt, PERSONAGEM, null, e.hunt.clock)).filter((x) => x.t === 'dmg' && x.foe && x.lacaio).length; };
  assert.equal(ataques(), 0, 'você longe: o totem não ataca');
  longeDe(e, l, 2);
  assert.ok(ataques() > 0, 'você perto: ataca');
});

test('G20c: o Rejuvenescedor — 317,5 de Vida por segundo a até 2 casas (4 m), não soma entre totens; a Vaal leva 40% do acerto em você antes', { skip: SEM }, async () => {
  const q = LacaiosPoe.oQueInvoca('Rejuvenation_Totem', 20, null, {}).efeitosDoTotem;
  assert.deepEqual([q.auraDoTotem.af.life_regen, q.auraDoTotem.raioM], [317.5, 4]);
  const qv = LacaiosPoe.oQueInvoca('Vaal_Rejuvenation_Totem', 20, null, {}).efeitosDoTotem.auraDoTotem;
  assert.ok(Math.abs(qv.raioM - 4 * Math.sqrt(0.7)) < 1e-9);
  assert.equal(qv.absorvePct, 40);
  const { e } = await montar('Wands/Driftwood_Wand', [['Rejuvenation_Totem']]);
  const l = colocar(e);
  assert.equal(l.auraDoTotem.raio, 2);
  longeDe(e, l, 2);
  assert.equal(G.adds(e)?.life_regen, 317.5);
  e.hunt.lacaios.push({ ...l, uid: 'outro' });
  assert.equal(G.adds(e)?.life_regen, 317.5, 'dois: ainda 317,5');
  longeDe(e, l, 3);
  assert.equal(G.adds(e)?.life_regen ?? 0, 0);
  // a Vaal: um acerto de 1000 em você dentro da aura — 400 no totem
  e.hunt.lacaios = [{ uid: 'v', tipo: 'totem', hp: 5000, maxHp: 5000, x: e.hunt.pos.x + 1, y: e.hunt.pos.y, auraDoTotem: { af: {}, raio: 1, absorvePct: 40 } }];
  const fica = Arvore.danoRecebido(e, 1000, [], e.hunt.pos, PERSONAGEM?.nome ?? null);
  assert.equal(e.hunt.lacaios[0].hp, 4600);
  assert.equal(fica, 600);
});

test('G20c: o Flamejante Sagrado — o Solo Sagrado em volta do totem dá imunidade a maldições; o totem morre, o solo some', { skip: SEM }, async () => {
  const { e } = await montar('Wands/Driftwood_Wand', [['Holy_Flame_Totem']]);
  const l = colocar(e);
  const solo = (e.hunt.solosSagrados ?? []).find((s) => s.dono === l.uid);
  assert.ok(solo?.imuneMaldicao, 'o solo do totem');
  longeDe(e, l, 1);
  assert.equal(CP.soloImuneAMaldicoes(e.hunt), true);
  longeDe(e, l, 2);
  assert.equal(CP.soloImuneAMaldicoes(e.hunt), false, 'a 2 casas: fora do solo (1 casa)');
  longeDe(e, l, 0);
  l.hp = 0;
  assert.equal(CP.soloImuneAMaldicoes(e.hunt), false, 'o totem morreu: o solo some');
});

test('G20c: a Balista de Cerco q20 — +5% de Velocidade de Ataque por Totem máximo (4 → +20%); o Devorador drena 299 de Vida e 59 de Mana por cadáver', { skip: SEM }, async () => {
  assert.equal(LacaiosPoe.oQueInvoca('Siege_Ballista', 20, { qualidade: 20 }, {}).velAtaquePct, 20);
  assert.equal(LacaiosPoe.oQueInvoca('Siege_Ballista', 20, { qualidade: 20 }, { 'max_lacaio:totem': 1 }).velAtaquePct, 25);
  const { e } = await montar('Wands/Driftwood_Wand', [['Devouring_Totem']]);
  const l = colocar(e);
  Object.assign(e.hunt, { cadaveres: [{ key: 'x', x: l.x + 2, y: l.y }, { key: 'y', x: l.x + 9, y: l.y }], roubos: [] });
  // vida e mana cheias: nada
  e.mana = e.maxMana;
  l.proximoGolpe = 0;
  Cacadas.devorarCadaver(e, e.hunt, l, Ficha.combate(e), PERSONAGEM, e.hunt.clock);
  assert.equal(e.hunt.cadaveres.length, 2);
  e.hp = e.maxHp - 1000;
  Cacadas.devorarCadaver(e, e.hunt, l, Ficha.combate(e), PERSONAGEM, e.hunt.clock);
  assert.deepEqual(e.hunt.cadaveres.map((c) => c.key), ['y'], 'o de 2 casas foi consumido; o de 9, não');
  const total = (r) => e.hunt.roubos.filter((x) => x.recurso === r).reduce((n, x) => n + x.restante, 0);
  assert.ok(total('vida') > 0 && total('mana') > 0, JSON.stringify(e.hunt.roubos));
});

test('G20c: o status — o Chefe Guerreiro, o Protetor, o Chefe Vaal, os Rejuvenescedores, o Devorador e a Balista de Cerco "funciona"; o Chamariz segue com a provocação', { skip: SEM }, () => {
  for (const s of ['Ancestral_Warchief', 'Ancestral_Protector', 'Vaal_Ancestral_Warchief', 'Rejuvenation_Totem', 'Vaal_Rejuvenation_Totem', 'Devouring_Totem', 'Siege_Ballista']) assert.equal(G.doSlug(s).statusNoJogo, 'funciona', `${s}: ${G.doSlug(s).motivosNoJogo.join(' | ')}`);
  // (aval do dono 27/10, R3: a provocação do Chamariz é feita — lote R3D)
  assert.ok(!G.doSlug('Decoy_Totem').motivosNoJogo.some((m) => /provoca/.test(m)));
  assert.ok(!G.doSlug('Decoy_Totem').motivosNoJogo.some((m) => /não podem Evadir/.test(m)));
});

test('G20d: o Vínculo Abrasador — o feixe do totem a você queima quem está na reta e perto das pontas; uma queima só por inimigo', { skip: SEM }, async () => {
  const { e, ms } = await montar('Wands/Driftwood_Wand', [['Searing_Bond']]);
  const l = colocar(e);
  Object.assign(l, { x: e.hunt.pos.x + 6, y: e.hunt.pos.y });
  const [naReta, longe, naPonta] = ms;
  Object.assign(naReta, { x: e.hunt.pos.x + 3, y: e.hunt.pos.y });
  Object.assign(longe, { x: e.hunt.pos.x + 3, y: e.hunt.pos.y + 3 });
  Object.assign(naPonta, { x: e.hunt.pos.x - 1, y: e.hunt.pos.y + 1 });
  Acoes.feixeDoVinculo(e, e.hunt, l, e.hunt.clock);
  const queima = (m) => (m.dots ?? []).filter((d) => d.tipo === G.DEGEN_DO_ELEMENTO.fire && d.falta > 0);
  assert.equal(queima(naReta).length, 1, 'na reta entre o totem e você');
  assert.equal(queima(naPonta).length, 1, 'perto da ponta (você)');
  assert.equal(queima(longe).length, 0, 'fora do feixe');
  assert.equal(queima(naReta)[0].ate - e.hunt.clock, Acoes.FEIXE_MS);
  // um segundo totem: o feixe dele também passa no bicho da reta — a queima é uma só (a chave da gema)
  e.hunt.lacaios.push({ ...l, uid: 'outro', x: e.hunt.pos.x + 3, y: e.hunt.pos.y - 3 });
  Acoes.feixeDoVinculo(e, e.hunt, l, e.hunt.clock);
  assert.equal(queima(naReta).length, 1);
  assert.equal(G.doSlug('Searing_Bond').statusNoJogo, 'funciona', G.doSlug('Searing_Bond').motivosNoJogo.join(' | '));
});

test('G20d: o Vínculo da Detonação — o máximo é 1 + as Cargas de Poder máximas (3 → 4); o 4º detona todos e queima em volta por 4 s', { skip: SEM }, async () => {
  assert.equal(LacaiosPoe.oQueInvoca('Searing_Bond_of_Detonation', 20, null, {}).maximo, 4);
  assert.equal(LacaiosPoe.oQueInvoca('Searing_Bond_of_Detonation', 20, null, { max_poder: 1 }).maximo, 5);
  const { e, ms } = await montar('Wands/Driftwood_Wand', [['Searing_Bond_of_Detonation']]);
  for (let i = 0; i < 3; i++) { e.hunt.cooldowns = {}; colocar(e); e.hunt.clock += 2000; }
  assert.equal(totens(e).length, 3);
  const b = Object.assign(ms[0], { x: e.hunt.pos.x + 1, y: e.hunt.pos.y });
  e.hunt.cooldowns = {};
  const r = sorte(0.5, () => Acoes.disparar(e, e.hunt, PERSONAGEM, 0, b, { manual: true }));
  assert.ok(r.ok, r.erro);
  if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; sorte(0.5, () => Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM)); }
  assert.equal(totens(e).length, 0, 'os totens detonaram');
  const d = (b.dots ?? []).find((x) => x.tipo === G.DEGEN_DO_ELEMENTO.fire);
  assert.ok(d && d.ate - e.hunt.clock >= 4000, JSON.stringify(b.dots));
  assert.equal(G.doSlug('Searing_Bond_of_Detonation').statusNoJogo, 'funciona', G.doSlug('Searing_Bond_of_Detonation').motivosNoJogo.join(' | '));
});
