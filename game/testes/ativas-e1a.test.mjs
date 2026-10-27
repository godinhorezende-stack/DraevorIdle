// LOTE E1a (26/10) — as gemas ATIVAS de LACAIO e de TOTEM com 1 ou 2 linhas de fora, iguais ao PoE 1 (o PoB: Skills/act_int.lua, act_str.lua, act_dex.lua):
// a qualidade do lacaio (o máximo, o movimento, a recarga, o Efeito do Buff do golem, a regeneração, o lacaio extra, o Efeito da Oferenda), o "menos Vida"
// do Golem de Pedra da Proteção, o "Anima até N Armas" da Animar Arma Vaal, o Ceifador nos outros lacaios, o "mais Dano por Lacaio Não-Golem próximo" do
// Golem da Carniça, a Vaal Convocar Esqueletos pelo PoB e a Velocidade de Projéteis dos totens (o tiro sai pelo seu uso).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');
const Acoes = await import('../systems/acoes.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const G = await import('../systems/itens-poe/gemas-poe.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const LacaiosPoe = await import('../systems/itens-poe/lacaios-poe.mjs');
const GemasE1a = await import('../systems/itens-poe/gemas-e1a.mjs');
const Terreno = await import('../systems/hunt/terreno.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const Combate = await import('../systems/hunt/combate.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const { PERSONAGEM } = await import('./apoio.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
}

const invocar = (slug, qualidade = 0, nivel = 20) => LacaiosPoe.oQueInvoca(slug, nivel, { nivel, qualidade }, {});
const naoSimuladas = (slug) => (G.statusNoJogo()[slug]?.motivos ?? []).filter((m) => /não simulado/.test(m));

// As 30 gemas da fila que ficam sem linha de fora (as de lacaio, só com a limitação do idle — "o lacaio ataca do jeito do tipo dele"; os totens, funcionando).
const FEITAS = ['Holy_Flame_Totem', 'Holy_Flame_Totem_of_Ire', 'Animate_Guardian', 'Animate_Guardian_of_Smiting', 'Summon_Flame_Golem', 'Summon_Flame_Golem_of_Hordes',
  'Summon_Stone_Golem', 'Summon_Stone_Golem_of_Hordes', 'Summon_Stone_Golem_of_Safeguarding', 'Animate_Weapon', 'Animate_Weapon_of_Self_Reflection', 'Animate_Weapon_of_Ranged_Arms',
  'Vaal_Animate_Weapon', 'Summon_Ice_Golem', 'Summon_Ice_Golem_of_Hordes', 'Raise_Zombie', 'Summon_Holy_Relic_of_Conviction', 'Summon_Raging_Spirit', 'Summon_Skeletons',
  'Summon_Skeletons_of_Archers', 'Summon_Skeletons_of_Mages', 'Vaal_Summon_Skeletons', 'Summon_Reaper', 'Summon_Carrion_Golem', 'Summon_Carrion_Golem_of_Hordes',
  'Summon_Carrion_Golem_of_Scavenging', 'Summon_Chaos_Golem', 'Summon_Chaos_Golem_of_Hordes', 'Summon_Lightning_Golem', 'Summon_Lightning_Golem_of_Hordes'];

test('E1a — status: as 30 gemas sem "efeito não simulado"; as que dependem de mecânica nova ou do dono seguem com a linha delas', { skip: SEM }, () => {
  // (aval do dono, 27/10 — revisão E1a, achado 3: o Golem de Relâmpago e o da Carniça das Hordas seguem em FEITAS porque o jogo passou a ter as habilidades com recarga
  // deles — o Orbe e a Ira; a Cascata e o Salto —, que a Recuperação da Recarga encurta: `LacaiosPoe.HABILIDADES_COM_RECARGA`)
  for (const s of FEITAS) assert.deepEqual(naoSimuladas(s), [], s);
  assert.equal(G.statusNoJogo().Holy_Flame_Totem.status, 'funciona');
  // as que ficam (o dono decide ou é mecânica nova): a linha delas segue, e só ela
  // (as decisões do dono, 26/10: o Golpe Dominador, a Oferenda Espiritual e a Balista Estilhaçante fecharam)
  for (const s of ['Dominating_Blow', 'Dominating_Blow_of_Inspiring', 'Spirit_Offering', 'Shrapnel_Ballista', 'Shrapnel_Ballista_of_Steel']) assert.deepEqual(naoSimuladas(s), [], s);
  assert.ok(naoSimuladas('Summon_Holy_Relic').some((m) => /Efeito do Buff/.test(m)), 'a Relíquia Sagrada: o Efeito do Buff é o da Nova, que não existe');
  // (dono, 26/10) as linhas da Nova da Relíquia Sagrada não eram feitas: voltam aos motivos
  assert.equal(naoSimuladas('Summon_Holy_Relic').filter((m) => /Habilidade Explosiva da Relíquia Sagrada/.test(m)).length, 2);
  assert.ok(!naoSimuladas('Bone_Offering').some((m) => /Cadáver extra/.test(m)) && !naoSimuladas('Flesh_Offering').some((m) => /Cadáver extra/.test(m)), 'a Óssea e a Carnal também');
  assert.ok(naoSimuladas('Summon_Chaos_Golem_of_the_Maelstr%C3%B6m').some((m) => /definhamento/.test(m)));
  // a Absolvição é de área (não convoca as Sentinelas no jogo): a Recuperação da Recarga dos Lacaios dela não sai
  assert.ok(G.statusNoJogo().Absolution.motivos.some((m) => /Recuperação da Recarga/.test(m)));
  assert.equal(GemasE1a.ehLinhaE1a('Absolution', 'Lacaios têm Recuperação da Recarga aumentada em 40 %', 'area'), false);
});

test('E1a — a qualidade sobe o máximo (⌊N⌋): Zumbis +1, Esqueletos +1, Armas Animadas +2; a Vaal Animar Arma anima 10 por uso', { skip: SEM }, () => {
  for (const [s, mais] of [['Raise_Zombie', 1], ['Summon_Skeletons', 1], ['Summon_Skeletons_of_Archers', 1], ['Summon_Skeletons_of_Mages', 1], ['Animate_Weapon', 2], ['Animate_Weapon_of_Self_Reflection', 1], ['Animate_Weapon_of_Ranged_Arms', 2], ['Vaal_Animate_Weapon', 2]]) {
    assert.equal(invocar(s, 20).maximo, invocar(s, 0).maximo + mais, s);
  }
  // qualidade 10: +0,5 Zumbi → 0 (o máximo é inteiro)
  assert.equal(invocar('Raise_Zombie', 10).maximo, invocar('Raise_Zombie', 0).maximo);
  assert.equal(invocar('Vaal_Animate_Weapon').porUso, 10, '"Anima até 10 Armas" no nível 20');
  assert.equal(invocar('Vaal_Animate_Weapon').maximo, 10);
});

test('E1a — a Vaal Convocar Esqueletos pelo PoB: 21 soldados + 9 arqueiros + 5 magos + 1 general por uso, máximo 36 (+1 da qualidade); as colunas mal rotuladas não valem', { skip: SEM }, () => {
  const q = invocar('Vaal_Summon_Skeletons');
  assert.equal(q.porUso, 36);
  assert.equal(q.maximo, 36);
  assert.equal(invocar('Vaal_Summon_Skeletons', 20).maximo, 37);
  assert.equal(GemasE1a.ehLinhaE1a('Vaal_Summon_Skeletons', '+7 ao Máximo de Esqueletos Convocados'), true);
});

test('E1a — o movimento (Guardião Animado), a recarga (Hordas, Golpe Dominador, Relíquia da Convicção) e a regeneração (Carniça do Saque) da qualidade no lacaio', { skip: SEM }, () => {
  assert.equal(invocar('Animate_Guardian', 20).poe.movimentoPct - invocar('Animate_Guardian', 0).poe.movimentoPct, 40);
  assert.equal(invocar('Animate_Guardian_of_Smiting', 20).poe.movimentoPct, 40);
  for (const s of ['Summon_Flame_Golem_of_Hordes', 'Summon_Stone_Golem_of_Hordes', 'Summon_Ice_Golem_of_Hordes', 'Summon_Chaos_Golem_of_Hordes', 'Summon_Lightning_Golem_of_Hordes', 'Summon_Carrion_Golem_of_Hordes', 'Dominating_Blow']) {
    assert.equal(invocar(s, 20).poe.recargaPct, 40, s);
    assert.equal(invocar(s, 0).poe.recargaPct, 0, s);
  }
  assert.equal(invocar('Summon_Holy_Relic_of_Conviction', 20).poe.recargaPct, 20);
  // a recarga encurta a habilidade com recarga do lacaio (a magia do espectro): 1,4 s ÷ 1,4
  assert.equal(LacaiosPoe.recargaDoLacaio(invocar('Summon_Stone_Golem_of_Hordes', 20), 1400), 1000);
  assert.equal(invocar('Summon_Carrion_Golem_of_Scavenging', 20).poe.regenPct, 3);
  // a Animar Arma dos Braços Distantes já ataca de longe (o arco)
  assert.equal(invocar('Animate_Weapon_of_Ranged_Arms').estilo.alcance, 5);
});

test('E1a — o Efeito do Buff da qualidade do golem (× 1,2 no que ele dá a você)', { skip: SEM }, () => {
  for (const s of ['Summon_Flame_Golem', 'Summon_Stone_Golem', 'Summon_Stone_Golem_of_Safeguarding', 'Summon_Ice_Golem', 'Summon_Chaos_Golem', 'Summon_Lightning_Golem', 'Summon_Carrion_Golem']) {
    assert.equal(invocar(s, 20).e1a?.efeitoDoBuffPct, 20, s);
    assert.equal(invocar(s, 0).e1a?.efeitoDoBuffPct, undefined, s);
  }
  const pedra = invocar('Summon_Stone_Golem', 20);
  const l = { uid: 'g', tipo: 'lacaio', hp: 10, golem: true, gema: 'Summon_Stone_Golem', afDono: pedra.afDono, ...pedra.e1a };
  const total = G.adds({ hunt: { clock: 0, lacaios: [l] }, equipment: {} });
  assert.ok(Math.abs(total.life_regen - pedra.afDono.life_regen * 1.2) < 1e-6, String(total.life_regen));
  const sem = G.adds({ hunt: { clock: 0, lacaios: [{ ...l, efeitoDoBuffPct: undefined }] }, equipment: {} });
  assert.equal(sem.life_regen, pedra.afDono.life_regen);
  // (dono, 26/10) o Golem da Carniça: o dano físico adicionado vai aos lacaios NÃO-golem (o PoB, MinionModifier), × o Efeito do Buff — não a você
  const carn = invocar('Summon_Carrion_Golem', 20);
  const golemC = { uid: 'c', tipo: 'lacaio', hp: 10, golem: true, gema: 'Summon_Carrion_Golem', porLacaioFisico: carn.porLacaioFisico, ...carn.e1a };
  const z = { uid: 'z', tipo: 'lacaio', hp: 10, golem: false };
  const comCarn = G.adds({ hunt: { clock: 0, lacaios: [golemC, z] }, equipment: {} });
  assert.ok(!(comCarn?.added_phys_dmg_max > 0), 'você não ganha o dano físico');
  const noZumbi = LacaiosPoe.danoDoGolemDaCarnica(z, [golemC, z], (g) => G.fatorDoBuffDoGolem({ equipment: {} }, g));
  assert.ok(Math.abs(noZumbi[1] - carn.porLacaioFisico[1] * 1.2) < 1e-6, String(noZumbi));
  assert.deepEqual(LacaiosPoe.danoDoGolemDaCarnica(golemC, [golemC, z]), [0, 0], 'o golem não');
  assert.deepEqual(LacaiosPoe.danoDoGolemDaCarnica({ uid: 't', tipo: 'totem', hp: 1 }, [golemC]), [0, 0], 'o totem não');
  // (dono, 26/10) o Golem Flamejante: "Golens concedem 20% mais área de efeito" é a Área AUMENTADA do PoB (fire_golem_grants_area_of_effect_+%)
  assert.equal(invocar('Summon_Flame_Golem').afDono.area_inc, 20);
});

test('E1a — o Golem de Pedra da Proteção tem 50% menos Vida; o Espírito Furioso, 30% de chance de um a mais; a Oferenda Espiritual, × 1,1', { skip: SEM }, () => {
  const prot = invocar('Summon_Stone_Golem_of_Safeguarding');
  const hordas = invocar('Summon_Stone_Golem_of_Hordes');
  assert.equal(prot.nivel, hordas.nivel);
  assert.ok(Math.abs(prot.vida / hordas.vida - 0.5) < 0.01, String(prot.vida / hordas.vida));
  assert.equal(invocar('Summon_Raging_Spirit', 20).chanceDeLacaioExtra, 30);
  assert.equal(invocar('Summon_Raging_Spirit', 0).chanceDeLacaioExtra, undefined);
  const of0 = invocar('Spirit_Offering', 0).bonus;
  const of20 = invocar('Spirit_Offering', 20).bonus;
  assert.ok(Math.abs(of20.critInc - of0.critInc * 1.1) < 1e-9);
  assert.ok(Math.abs(of20.critMult - of0.critMult * 1.1) < 1e-9);
});

test('E1a — o Ceifador: os outros lacaios causam 29% menos Dano e têm 29% menos Vida enquanto ele vive (o totem, o mercenário e ele mesmo, não)', { skip: SEM }, () => {
  const q = invocar('Summon_Reaper');
  assert.deepEqual(q.e1a.ceifador, { menosDanoPct: 29, menosVidaPct: 29 });
  const ceifador = { uid: 'r', tipo: 'lacaio', hp: 100, maxHp: 100, ceifador: q.e1a.ceifador };
  const zumbi = { uid: 'z', tipo: 'lacaio', hp: 500, maxHp: 1000, x: 0, y: 0 };
  const totem = { uid: 't', tipo: 'totem', hp: 300, maxHp: 300 };
  const merc = { uid: 'm', tipo: 'lacaio', mercenario: true, hp: 300, maxHp: 300 };
  const todos = [ceifador, zumbi, totem, merc];
  assert.ok(Math.abs(LacaiosPoe.fatorDoCeifador(zumbi, todos) - 0.71) < 1e-9);
  assert.equal(LacaiosPoe.fatorDoCeifador(ceifador, todos), 1);
  assert.equal(LacaiosPoe.fatorDoCeifador(totem, todos), 1);
  assert.equal(LacaiosPoe.fatorDoCeifador(merc, todos), 1);
  LacaiosPoe.aplicarCeifador(todos);
  assert.equal(zumbi.maxHp, 710);
  assert.equal(zumbi.hp, 355, 'a vida atual na mesma proporção');
  assert.equal(totem.maxHp, 300);
  assert.equal(ceifador.maxHp, 100);
  LacaiosPoe.aplicarCeifador(todos);
  assert.equal(zumbi.maxHp, 710, 'não aplica duas vezes');
  // o Ceifador morre: a vida volta
  ceifador.hp = 0;
  LacaiosPoe.aplicarCeifador(todos);
  assert.equal(zumbi.maxHp, 1000);
  assert.equal(LacaiosPoe.fatorDoCeifador(zumbi, todos), 1);
  // no golpe do lacaio (o fator do `golpeDoLacaio`)
  ceifador.hp = 100;
  const sem = LacaiosPoe.golpeDoLacaio(zumbi, {}, {}, 'physical', 0, () => 0.99, [zumbi], 0).fator;
  const com = LacaiosPoe.golpeDoLacaio(zumbi, {}, {}, 'physical', 0, () => 0.99, todos, 0).fator;
  assert.ok(Math.abs(com / sem - 0.71) < 1e-9);
  // o Ceifador dos Revenantes (o outro texto) também
  assert.deepEqual(invocar('Summon_Reaper_of_Revenants').e1a.ceifador, { menosDanoPct: 29, menosVidaPct: 29 });
});

test('E1a — o Golem da Carniça: 5% mais Dano por lacaio não-golem a até 4 casas dele, até 50%', { skip: SEM }, () => {
  const q = invocar('Summon_Carrion_Golem');
  assert.deepEqual(q.e1a.maisPorNaoGolem, { pct: 5, max: 50 });
  const g = { uid: 'g', tipo: 'lacaio', golem: true, hp: 10, x: 10, y: 10, maisPorNaoGolem: q.e1a.maisPorNaoGolem };
  const z = (i, x = 11) => ({ uid: 'z' + i, tipo: 'lacaio', hp: 10, x, y: 10 });
  const outroGolem = { uid: 'o', tipo: 'lacaio', golem: true, hp: 10, x: 10, y: 11 };
  assert.ok(Math.abs(LacaiosPoe.fatorPorNaoGolemPerto(g, [g, z(1), z(2), z(3), z(4, 15), outroGolem]) - 1.15) < 1e-9, 'três perto (o de 5 casas e o outro golem não contam)');
  assert.ok(Math.abs(LacaiosPoe.fatorPorNaoGolemPerto(g, [g, ...Array.from({ length: 12 }, (_, i) => z(i))]) - 1.5) < 1e-9, 'o teto de 50%');
  assert.equal(LacaiosPoe.fatorPorNaoGolemPerto(z(9), [g, z(9)]), 1, 'só no Golem da Carniça');
  assert.equal(invocar('Summon_Carrion_Golem_of_Scavenging').e1a.maisPorNaoGolem.pct, 5);
});

test('E1a — os totens: a Velocidade de Projéteis da gema (40% do Flamejante Sagrado; 128% mais do da Ira) no tiro do totem, pelo seu uso', { skip: SEM }, () => {
  const entry = (s) => Acoes.POR_ID_PUBLICO(G.doSlug(s).acao);
  assert.ok(Math.abs(Acoes.velocidadeDoProjetil(null, entry('Holy_Flame_Totem'), { nivel: 20, qualidade: 20 }).mod - 1.4) < 1e-9);
  assert.ok(Math.abs(Acoes.velocidadeDoProjetil(null, entry('Holy_Flame_Totem'), { nivel: 20, qualidade: 0 }).mod - 1) < 1e-9);
  assert.ok(Math.abs(Acoes.velocidadeDoProjetil(null, entry('Holy_Flame_Totem_of_Ire'), { nivel: 20, qualidade: 0 }).mod - 2.28) < 1e-9);
  assert.ok(Math.abs(Acoes.velocidadeDoProjetil(null, entry('Shrapnel_Ballista'), { nivel: 20, qualidade: 20 }).mod - 1.4) < 1e-9);
});

/** Uma caçada de verdade (o primeiro bicho; os outros longe) e um Zumbi colado nele, com `extra`; o tique dos lacaios com o Math.random fixo. */
function tiqueDoZumbi(extra = {}) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'sorcerer', level: 80 }), { sistema: 'poe', classePoe: 'Witch' });
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  const h = e.hunt;
  h.clock = 100_000;
  Object.assign(e, { hp: 1e6, maxHp: 1e6 });
  const [b, ...outros] = h.monstros;
  outros.forEach((o) => Object.assign(o, { x: h.pos.x + 60, y: h.pos.y + 60 }));
  const q = LacaiosPoe.oQueInvoca('Raise_Zombie', 10, null, {});
  const l = { ...q, uid: 'l1', tipo: 'lacaio', x: h.pos.x + 2, y: h.pos.y, hp: q.vida, maxHp: q.vida, proximoGolpe: 0, alcanceDeAtaque: 1, perto: 6, ...extra, poe: { ...q.poe, ...(extra.poe ?? {}) } };
  Object.assign(b, { x: l.x + 1, y: l.y, hp: 1e9, maxHp: 1e9 });
  h.lacaios = [l];
  const grade = Cacadas.andarDaGrade(Cacadas.gradeDaHunt(Terreno.huntOuMapaCustom(h.huntId)), h.z);
  const r = Math.random;
  Math.random = () => 0.99;
  let ev;
  try { ev = Cacadas.tiqueDosLacaios(e, h, null, grade, Date.now()); } finally { Math.random = r; }
  return { l, ev };
}

test('E1a — a Recuperação da Recarga do lacaio solta o golpe em área (a habilidade com recarga) (1 + X%) vezes mais; sem ela, a cada N acertos, como antes', { skip: SEM }, () => {
  const cada = LacaiosPoe.oQueInvoca('Raise_Zombie', 10, null, {}).estilo.area.cada;
  // sem recarga: o 1º acerto não solta a área
  const sem = tiqueDoZumbi();
  assert.equal(sem.l.acertos, 1);
  assert.ok(!sem.ev.some((x) => x.t === 'explosao'));
  // com 100%: cada acerto carrega 2 — com a carga a N − 2, o acerto completa o N e solta
  const com = tiqueDoZumbi({ cargaDaArea: cada - 2, poe: { recargaPct: 100 } });
  assert.ok(com.ev.some((x) => x.t === 'explosao'), 'soltou a área');
  assert.equal(com.l.cargaDaArea, 0);
  // e o ritmo: com 100%, a área sai a cada N/2 acertos
  const meio = tiqueDoZumbi({ cargaDaArea: 0, poe: { recargaPct: 100 } });
  assert.equal(meio.l.cargaDaArea, 2);
});

// ---- as decisões do dono (26/10) ----
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 1, rng: () => 0.5 }));
/** Uma Bruxa com a gema na varinha (slot 1 da barra), numa caçada de verdade, com um bicho colado (`raridade`). */
function cacadaComGema(gema, { raridade = 'normal', nivel = 20 } = {}) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'sorcerer', level: 80 }), { sistema: 'poe', classePoe: 'Witch' });
  const arma = peca('Wands/Driftwood_Wand');
  arma.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
  e.equipment = { ...e.equipment, weapon: arma };
  delete e.equipment.shield;
  e.inventory = [GS.itemDaGema({ id: G.doSlug(gema).itemId, nivel, xp: 0, raridade: 'comum' })];
  GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: G.doSlug(gema).acao, enabled: true, minMana: 0, conditions: [] };
  assert.equal(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok, true);
  Object.assign(e, { mana: 1e6, maxMana: 1e6, hp: 1e6, maxHp: 1e6 });
  const h = e.hunt;
  h.clock = 10000;
  h.monstros = h.monstros.slice(0, 1);
  Object.assign(h.monstros[0], { hp: 1e12, maxHp: 1e12, x: h.pos.x + 1, y: h.pos.y, raridade });
  h.lacaios = [];
  h.cadaveres = [];
  return { e, h, alvo: h.monstros[0] };
}
const usar = ({ e, h, alvo }) => {
  const r = Acoes.disparar(e, h, PERSONAGEM, 0, alvo, { manual: true });
  if (r.ok && h.conjurando) { h.clock = h.conjurando.fim; Acoes.concluirConjuracao(e, h, PERSONAGEM); }
  return r;
};

test('E1a (dono) — as Oferendas consomem os cadáveres a até 4 casas: sem cadáver não saem; +1 s por cadáver extra', { skip: SEM }, () => {
  for (const gema of ['Spirit_Offering', 'Bone_Offering', 'Flesh_Offering']) {
    const c = cacadaComGema(gema);
    c.h.lacaios = [{ uid: 'l1', tipo: 'lacaio', hp: 100, maxHp: 100, x: c.h.pos.x, y: c.h.pos.y + 1 }];
    const sem = usar(c);
    assert.equal(sem.ok, false, gema);
    assert.equal(sem.motivo, 'SEM_CADAVER');
    // três cadáveres perto e um longe (5 casas)
    const ca = (dx) => ({ x: c.h.pos.x + dx, y: c.h.pos.y, z: c.h.z ?? 0, key: 'x' });
    c.h.cadaveres = [ca(1), ca(2), ca(4), ca(5)];
    const q = LacaiosPoe.oQueInvoca(gema, 20, { nivel: 20, qualidade: 0 }, {});
    assert.equal(q.porCadaverMs, 1000, gema);
    const agora = c.h.ultimoTique ?? Date.now();
    const r = usar(c);
    assert.equal(r.ok, true, r.erro);
    assert.equal(c.h.cadaveres.length, 1, 'os três perto foram consumidos; o de 5 casas fica');
    const ate = c.h.lacaios[0].oferenda?.ate;
    assert.ok(ate - agora >= q.duracaoMs + 2000 - 50 && ate - agora <= q.duracaoMs + 2000 + 1000, String(ate - agora));
  }
  assert.equal(GemasE1a.duracaoDaOferenda({ duracaoMs: 5000, porCadaverMs: 1000 }, 1), 5000);
  assert.equal(GemasE1a.duracaoDaOferenda({ duracaoMs: 5000, porCadaverMs: 1000 }, 4), 8000);
});

test('E1a (dono) — o Golpe Dominador: com o alvo Raro ou Único, 25% de chance de uma Sentinela a mais', { skip: SEM }, () => {
  const q = LacaiosPoe.oQueInvoca('Dominating_Blow', 20, null, {});
  assert.equal(q.chanceRaroUnico, 25);
  assert.equal(q.maximo, 13, 'o máximo: 3 Mágicas + 9 Normais + 1 Rara');
  assert.equal(LacaiosPoe.oQueInvoca('Dominating_Blow_of_Inspiring', 20, null, {}).maximo, 10);
  assert.equal(GemasE1a.sentinelaAMais(q, { raridade: 'raro' }, () => 0.2), 1);
  assert.equal(GemasE1a.sentinelaAMais(q, { raridade: 'unico' }, () => 0.2), 1);
  assert.equal(GemasE1a.sentinelaAMais(q, { raridade: 'raro' }, () => 0.3), 0, 'fora dos 25%');
  assert.equal(GemasE1a.sentinelaAMais(q, { raridade: 'normal' }, () => 0), 0, 'o normal não');
  assert.equal(GemasE1a.sentinelaAMais(q, { raridade: 'magico' }, () => 0), 0);
  assert.equal(GemasE1a.sentinelaAMais(LacaiosPoe.oQueInvoca('Raise_Zombie', 20, null, {}), { raridade: 'raro' }, () => 0), 0, 'só no Golpe Dominador');
  // no uso de verdade: o alvo Raro, o sorteio dentro dos 25% → 2 Sentinelas; o Normal → 1
  for (const [raridade, n] of [['raro', 2], ['normal', 1]]) {
    const c = cacadaComGema('Dominating_Blow', { raridade });
    const r0 = Math.random;
    Math.random = () => 0.1;
    let r;
    try { r = usar(c); } finally { Math.random = r0; }
    assert.equal(r.ok, true, r.erro);
    assert.equal(c.h.lacaios.filter((l) => l.gema === 'Dominating_Blow' && l.hp > 0).length, n, raridade);
  }
});

test('E1a (dono) — o Golem de Pedra da Proteção: 15% do acerto corpo a corpo na vida dele antes da sua (× o Efeito do Buff; até a vida dele)', { skip: SEM }, () => {
  const q = LacaiosPoe.oQueInvoca('Summon_Stone_Golem_of_Safeguarding', 20, { nivel: 20, qualidade: 20 }, {});
  assert.equal(q.e1a.protecaoPct, 15);
  const golem = { uid: 'g', tipo: 'lacaio', golem: true, hp: 1000, maxHp: 1000, gema: 'Summon_Stone_Golem_of_Safeguarding', ...q.e1a };
  const h = { lacaios: [golem] };
  // 15% × 1,2 (o Efeito do Buff da qualidade) = 18% de 1000
  const r = LacaiosPoe.desviarParaOGolemDePedra(h, 1000);
  assert.equal(r.tomou, 180);
  assert.equal(golem.hp, 820);
  golem.hp = 50;
  assert.equal(LacaiosPoe.desviarParaOGolemDePedra(h, 1000).tomou, 50, 'até a vida dele');
  assert.equal(LacaiosPoe.desviarParaOGolemDePedra({ lacaios: [{ uid: 'z', tipo: 'lacaio', hp: 100 }] }, 1000).tomou, 0, 'sem o golem, nada');
  // no golpe corpo a corpo de verdade: o golem toma a parte
  const c = cacadaComGema('Summon_Stone_Golem_of_Safeguarding');
  const g2 = { ...golem, hp: 1e6, maxHp: 1e6, x: c.h.pos.x - 1, y: c.h.pos.y };
  c.h.lacaios = [g2];
  const r0 = Math.random;
  Math.random = () => 0.99;
  try { for (let i = 0; i < 20 && g2.hp === 1e6; i++) Combate.contraAtaque(c.e, c.h, PERSONAGEM, c.alvo, []); } finally { Math.random = r0; }
  assert.ok(g2.hp < 1e6, 'o golem levou parte do golpe corpo a corpo');
});

test('E1a (dono) — o Ceifador: o "87% mais Dano com Sangramento" vale só no Sangramento (não no golpe)', { skip: SEM }, () => {
  const q = LacaiosPoe.oQueInvoca('Summon_Reaper', 20, null, {});
  assert.equal(q.e1a.maisSangramentoPct, 87);
  assert.ok(Math.abs(q.poe.fatorDoDano - 1) < 1e-9, 'o golpe sem o 87%: ' + q.poe.fatorDoDano);
  // a Nova da Relíquia Sagrada: as linhas não são de lacaio feitas
  assert.equal(LacaiosPoe.ehLinhaDeLacaio('A Habilidade Explosiva da Relíquia Sagrada concede 985 de Vida regenerada por segundo aos Lacaios'), false);
  assert.equal(LacaiosPoe.ehLinhaDeLacaio('Golens concedem 15 % do Dano Corpo a Corpo sofrido na Vida do seu Golem de Pedra antes da sua'), true);
});
