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
  for (const s of FEITAS) assert.deepEqual(naoSimuladas(s), [], s);
  assert.equal(G.statusNoJogo().Holy_Flame_Totem.status, 'funciona');
  // as que ficam (o dono decide ou é mecânica nova): a linha delas segue, e só ela
  assert.deepEqual(naoSimuladas('Dominating_Blow').length, 1, 'o Golpe Dominador: só os 25% em Raro/Único');
  assert.ok(naoSimuladas('Summon_Holy_Relic').some((m) => /Efeito do Buff/.test(m)), 'a Relíquia Sagrada: o Efeito do Buff é o da Nova, que não existe');
  assert.ok(naoSimuladas('Spirit_Offering').some((m) => /Cadáver extra/.test(m)));
  assert.ok(!naoSimuladas('Spirit_Offering').some((m) => /Efeito da Oferenda/.test(m)));
  assert.ok(naoSimuladas('Summon_Chaos_Golem_of_the_Maelstr%C3%B6m').some((m) => /definhamento/.test(m)));
  assert.ok(naoSimuladas('Shrapnel_Ballista').every((m) => !/Velocidade de Proj/.test(m)), 'a Balista Estilhaçante: a velocidade vale; o acerto repetido segue');
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
  // o Golem da Carniça: o dano adicionado por lacaio não-golem também × 1,2
  const carn = invocar('Summon_Carrion_Golem', 20);
  const z = { uid: 'z', tipo: 'lacaio', hp: 10, golem: false };
  const comCarn = G.adds({ hunt: { clock: 0, lacaios: [{ uid: 'c', tipo: 'lacaio', hp: 10, golem: true, gema: 'Summon_Carrion_Golem', porLacaioFisico: carn.porLacaioFisico, ...carn.e1a }, z] }, equipment: {} });
  assert.ok(Math.abs(comCarn.added_phys_dmg_max - carn.porLacaioFisico[1] * 1.2) < 1e-6);
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
