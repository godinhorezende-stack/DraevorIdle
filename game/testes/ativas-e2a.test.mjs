// LOTE E2A (26/10) — as gemas ATIVAS de LACAIO que ainda estavam parciais (as mais difíceis), iguais ao PoE 1 (o PoB: Skills/act_int.lua, act_str.lua,
// Skills/minion.lua, Minions.lua, Modules/Data.lua e CalcPerform.lua): as Oferendas (o movimento da Carnal, o bloqueio mágico da Óssea), os Espectros (as resistências,
// o "mais" do movimento, a duração, o crítico e o máximo da qualidade da Transitoriedade), o agravar do Ceifador da Evisceração, a Pancada do Zumbi da Pancada, a
// Queda do Zumbi da Queda, o Golpe Sagrado (o alcance, a conversão do Armamento, o máximo e o "mais Dano" do PoB), as Sentinelas Ascendidas (300% mais Dano, 70%
// menos Dano sofrido, o máximo 3 da Dominação) e os dois Robôs Rastejantes (as auras sem dano e o buff de Armadilhas e Minas).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
const Acoes = await import('../systems/acoes.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const G = await import('../systems/itens-poe/gemas-poe.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const LacaiosPoe = await import('../systems/itens-poe/lacaios-poe.mjs');
const GemasE2a = await import('../systems/itens-poe/gemas-e2a.mjs');
const Terreno = await import('../systems/hunt/terreno.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Dot = await import('../systems/combate/dot.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
}

const invocar = (slug, qualidade = 0, nivel = 20) => LacaiosPoe.oQueInvoca(slug, nivel, { nivel, qualidade }, {});
const naoSimuladas = (slug) => (G.statusNoJogo()[slug]?.motivos ?? []).filter((m) => /não simulado/.test(m));

// As gemas da fila que ficam sem "efeito não simulado" (só a limitação do idle — "o lacaio ataca do jeito do tipo dele").
const FEITAS = ['Bone_Offering', 'Flesh_Offering', 'Summon_Reaper_of_Eviscerating', 'Raise_Zombie_of_Slamming', 'Raise_Zombie_of_Falling', 'Vaal_Absolution', 'Vaal_Domination', 'Summon_Skitterbots'];

test('E2A — status: as 8 gemas sem "efeito não simulado"; as que seguem ficam só com a linha delas', { skip: SEM }, () => {
  for (const s of FEITAS) {
    assert.deepEqual(naoSimuladas(s), [], s);
    assert.equal(G.statusNoJogo()[s].motivos.length, 1, s);
  }
  // o teto do movimento do Espectro (movement_velocity_cap): feito no D1 (decisão do dono) — aval do dono (revisão F1): sem motivo
  for (const s of ['Raise_Spectre', 'Raise_Spectre_of_Transience']) assert.deepEqual(naoSimuladas(s), [], s);
  // o Golpe Sagrado: o golpe do jogador ainda não existe (a gema só invoca) — a conversão "Este ataque e lacaios" segue
  // (aval do dono 27/10, R3: o golpe do Golpe Sagrado existe — lote R3B —: a conversão "Este ataque e lacaios" é feita)
  assert.deepEqual(naoSimuladas('Holy_Strike'), []);
  // só nas gemas do lote
  assert.equal(GemasE2a.ehLinhaE2a('Raise_Zombie', 'Lacaios têm 15 % de chance de causar Dano Dobrado'), false);
  assert.equal(GemasE2a.ehLinhaE2a('Raise_Zombie_of_Falling', 'Lacaios têm 15 % de chance de causar Dano Dobrado', 'area'), false);
});

test('E2A — os Espectros: +30% (+20% da qualidade) de Resistências Elementais; a Transitoriedade: 30 s, +1180% de crítico, +1 de máximo na qualidade 20', { skip: SEM }, () => {
  const e = invocar('Raise_Spectre', 20);
  assert.deepEqual([e.poe.resFogo, e.poe.resGelo, e.poe.resRaio], [50, 50, 50]);
  assert.deepEqual([invocar('Raise_Spectre', 0).poe.resFogo], [30]);
  assert.equal(e.poe.movMaisPct, 55);
  const t = invocar('Raise_Spectre_of_Transience', 20);
  assert.equal(t.duracaoMs, 30000);
  assert.equal(t.poe.critInc, 1180);
  assert.equal(t.maximo, 7);
  assert.equal(invocar('Raise_Spectre_of_Transience', 0).maximo, 6);
  assert.equal(invocar('Raise_Spectre_of_Transience', 0).poe.resFogo, 30);
  // o crítico do espectro: 5% × (1 + 1180%) = 64% (no golpe e nas magias do monstro erguido)
  assert.ok(Math.abs(LacaiosPoe.criticoDoLacaio({ critChanceBase: 5, poe: t.poe }).chance - 64) < 1e-9);
  // a Duração dos Lacaios vale na dele
  assert.equal(LacaiosPoe.oQueInvoca('Raise_Spectre_of_Transience', 20, { nivel: 20, qualidade: 0, duracaoPct: 50 }, {}).duracaoMs, 45000);
});

test('E2A — o movimento do lacaio: o "mais" multiplica o aumentado; a Oferenda Carnal soma ao aumentado', { skip: SEM }, () => {
  const l = { poe: { movimentoPct: 20, movMaisPct: 55 } };
  assert.ok(Math.abs(LacaiosPoe.movimentoDoLacaio(l, 0) - (1.2 * 1.55 - 1) * 100) < 1e-9);
  assert.ok(Math.abs(LacaiosPoe.movimentoDoLacaio(l, 0, 29) - (1.49 * 1.55 - 1) * 100) < 1e-9, 'com os 29% da Carnal');
  assert.equal(LacaiosPoe.movimentoDoLacaio({ poe: { movimentoPct: 20 } }, 0, 29), 49, 'sem o mais: soma, como antes');
  assert.equal(invocar('Summon_Holy_Relic', 0).poe.movMaisPct, 76, 'a Relíquia Sagrada também');
  const carnal = LacaiosPoe.oQueInvoca('Flesh_Offering', 20);
  assert.deepEqual([carnal.bonus.velConjPct, carnal.bonus.velMovPct], [30, 29]);
  assert.equal(LacaiosPoe.oQueInvoca('Bone_Offering', 20).bonus.bloqueioMagicoPct, 34);
});

test('E2A — o Golpe Sagrado: 3 Armamentos, +2,6 m de alcance (q20), Físico com 50% em Raio, e o "mais Dano" do PoB (−60% no 1, +168% no 20)', { skip: SEM }, () => {
  const q = invocar('Holy_Strike', 20);
  assert.equal(q.maximo, 3);
  assert.equal(q.nome, 'Armamento Sagrado');
  assert.ok(Math.abs(q.alcanceExtraM - 2.6) < 1e-9);
  assert.equal(q.elemento, 'physical');
  assert.equal(q.conversao.energy, 50);
  const f20 = LacaiosPoe.forcaDoNivel(q.nivel).dano;
  assert.ok(Math.abs((q.dano.min + q.dano.max) / 2 - f20 * 2.68) <= 1, `${q.dano.min}-${q.dano.max} vs ${f20 * 2.68}`);
  const q1 = invocar('Holy_Strike', 0, 1);
  const f1 = LacaiosPoe.forcaDoNivel(q1.nivel).dano;
  assert.ok(Math.abs((q1.dano.min + q1.dano.max) / 2 - f1 * 0.4) <= 1, `${q1.dano.min}-${q1.dano.max} vs ${f1 * 0.4}`);
  // o golpe: metade Raio, metade Físico
  assert.deepEqual(Cacadas.partesDoGolpeDoLacaio({ conversao: q.conversao }, 'physical').map((x) => [x.tipo, x.f]), [['energy', 0.5], ['physical', 0.5]]);
  // o alcance: 1 + 1 casa (2,6 m ÷ 2 m) e 30% de chance de mais uma
  assert.deepEqual([GemasE2a.casasDosMetros(2.6, () => 0.5), GemasE2a.casasDosMetros(2.6, () => 0.1)], [1, 2]);
});

test('E2A — as Sentinelas Ascendidas: 300% mais Dano, 70% menos Dano sofrido; a Dominação Vaal com até 3', { skip: SEM }, () => {
  for (const s of ['Vaal_Absolution', 'Vaal_Domination']) {
    const q = invocar(s);
    const base = LacaiosPoe.forcaDoPob(LacaiosPoe.lacaioDoPob(s), q.nivel).dano;
    assert.ok(Math.abs((q.dano.min + q.dano.max) / 2 - base * 4) <= 1, s);
    assert.equal(q.poe.menosDanoRecebidoPct, 70, s);
  }
  assert.equal(invocar('Vaal_Domination').maximo, 3);
  assert.equal(invocar('Vaal_Absolution').maximo, 1);
  const l = { hp: 1000, maxHp: 1000, poe: { menosDanoRecebidoPct: 70 } };
  assert.ok(Math.abs(LacaiosPoe.danoNoLacaio(l, { fisico: 0, outros: 100 }).dano - 30) < 1e-9);
});

/** Uma Bruxa com a gema na varinha (slot 1 da barra), numa caçada de verdade, com um bicho colado. */
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 1, rng: () => 0.5 }));
function cacadaComGema(gema, { nivel = 20 } = {}) {
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
  h.monstros = h.monstros.slice(0, 2);
  Object.assign(h.monstros[0], { hp: 1e12, maxHp: 1e12, x: h.pos.x + 2, y: h.pos.y });
  Object.assign(h.monstros[1], { hp: 1e12, maxHp: 1e12, x: h.pos.x + 2, y: h.pos.y + 1 });
  h.lacaios = [];
  h.cadaveres = [];
  return { e, h, alvo: h.monstros[0] };
}
const usar = ({ e, h, alvo }) => {
  const r = Acoes.disparar(e, h, PERSONAGEM, 0, alvo, { manual: true });
  if (r.ok && h.conjurando) { h.clock = h.conjurando.fim; Acoes.concluirConjuracao(e, h, PERSONAGEM); }
  return r;
};
const grade = (h) => Cacadas.andarDaGrade(Cacadas.gradeDaHunt(Terreno.huntOuMapaCustom(h.huntId)), h.z);

test('E2A — o Zumbi da Queda: aparece no alvo, não pode ser atingido; em 1 s acerta a área (2,5× o golpe, sempre acerta) e morre; até 200; 15% de Dano Dobrado (q20)', { skip: SEM }, () => {
  const q = invocar('Raise_Zombie_of_Falling', 20);
  assert.equal(q.maximo, 200);
  assert.equal(q.nome, 'Zumbi');
  assert.deepEqual(q.queda, { mult: 2.5, ms: 1000 });
  assert.equal(q.poe.danoDobrado, 15);
  const c = cacadaComGema('Raise_Zombie_of_Falling');
  const r = usar(c);
  assert.equal(r.ok, true, r.erro);
  const z = c.h.lacaios.find((l) => l.gema === 'Raise_Zombie_of_Falling');
  assert.ok(z, 'o zumbi veio (sem cadáver)');
  assert.deepEqual([z.x, z.y], [c.alvo.x, c.alvo.y], 'no alvo ' + JSON.stringify({ pos: c.h.pos, ms: c.h.monstros.map((m) => [m.x, m.y]), conj: c.h.conjurando }));
  assert.equal(z.intocavel, true);
  const t0 = z.queda.em - 1000;
  const vidas = c.h.monstros.map((m) => m.hp);
  // antes da queda: nada
  let ev = Cacadas.tiqueDosLacaios(c.e, c.h, null, grade(c.h), t0 + 500);
  assert.ok(!ev.some((x) => x.t === 'dmg' && x.lacaio), 'ainda caindo');
  assert.deepEqual(c.h.monstros.map((m) => m.hp), vidas);
  // na queda: os dois bichos (o do lado está a 1 casa — o raio do golpe em área do lacaio) levam o impacto; o zumbi morre
  const r0 = Math.random;
  Math.random = () => 0.99;
  try { ev = Cacadas.tiqueDosLacaios(c.e, c.h, null, grade(c.h), t0 + 1000); } finally { Math.random = r0; }
  const golpes = ev.filter((x) => x.t === 'dmg' && x.lacaio);
  assert.equal(golpes.length, 2, JSON.stringify(ev));
  assert.ok(ev.some((x) => x.t === 'explosao'));
  assert.equal(c.h.lacaios.filter((l) => l.gema === 'Raise_Zombie_of_Falling').length, 0, 'não sobrevive ao impacto');
  // o dano: 2,5× o golpe do zumbi (o máximo da faixa, com Math.random 0,99), pela resistência do bicho (0 de Físico neste)
  assert.ok(golpes[0].v >= Math.round(q.dano.min * 2.5), `${golpes[0].v}`);
});

test('E2A — os Robôs Rastejantes: dois (Resfriante e Eletrizante), sem dano; a aura Resfria 11,9% e Eletriza 17,85%; 10% mais Dano de Armadilhas e Minas', { skip: SEM }, () => {
  const q = invocar('Summon_Skitterbots', 20);
  assert.deepEqual([q.maximo, q.porUso], [2, 2]);
  assert.ok(Math.abs(q.robos.resfriarPct - 11.9) < 1e-9 && Math.abs(q.robos.eletrizarPct - 17.85) < 1e-9);
  const c = cacadaComGema('Summon_Skitterbots');
  const r = usar(c);
  assert.equal(r.ok, true, r.erro);
  const robos = c.h.lacaios.filter((l) => l.gema === 'Summon_Skitterbots');
  assert.deepEqual(robos.map((l) => l.auraNaoDano.tipo).sort(), ['eletrizar', 'resfriar']);
  // os dois colados nos bichos
  const [frio, raio] = [robos.find((l) => l.auraNaoDano.tipo === 'resfriar'), robos.find((l) => l.auraNaoDano.tipo === 'eletrizar')];
  Object.assign(frio, { x: c.alvo.x - 1, y: c.alvo.y, proximoGolpe: 0 });
  Object.assign(raio, { x: c.alvo.x - 1, y: c.alvo.y + 1, proximoGolpe: 0 });
  const vidas = c.h.monstros.map((m) => m.hp);
  const ev = Cacadas.tiqueDosLacaios(c.e, c.h, null, grade(c.h), Date.now());
  assert.ok(!ev.some((x) => x.t === 'dmg' && x.lacaio), 'não causam dano');
  assert.deepEqual(c.h.monstros.map((m) => m.hp), vidas);
  const m = c.alvo;
  assert.ok(Math.abs(m.estados.lento.pct - 11.9) < 1e-9, JSON.stringify(m.estados));
  assert.ok(Math.abs(m.estados.chocado.pct - 17.85) < 1e-9);
  assert.ok(m.estados.chocado.ate > c.h.clock && m.estados.chocado.ate <= c.h.clock + 1250);
  // o buff na ficha (o Resfriante o leva): o "mais Dano" das Armadilhas e das Minas
  Ficha.invalidar(c.e);
  const af = Ficha.combate(c.e).afPoe;
  assert.equal(af['mais_dano@armadilha'], 10);
  assert.equal(af['mais_dano@mina'], 10);
  // a Eletrização mais forte fica; a mais fraca não a troca
  const b = { estados: { chocado: { ate: 99999, pct: 30 } } };
  assert.equal(GemasE2a.eletrizarNaAura(b, 17.85, 1000, 0), false);
  assert.equal(b.estados.chocado.pct, 30);
});

/** Um lacaio da gema colado num bicho e um tique dos lacaios com o Math.random fixo. */
function tiqueDe(slug, { random = 0.99, qualidade = 20, antes = null } = {}) {
  const c = cacadaComGema('Raise_Zombie');
  const h = c.h;
  const q = LacaiosPoe.oQueInvoca(slug, 20, { nivel: 20, qualidade }, {});
  const l = { ...q, uid: 'l1', gema: slug, tipo: 'lacaio', x: c.alvo.x - 1, y: c.alvo.y, hp: q.vida, maxHp: q.vida, proximoGolpe: 0, alcanceDeAtaque: 1, perto: 6, acertos: 0 };
  h.lacaios = [l];
  antes?.(c, l);
  const r = Math.random;
  Math.random = () => random;
  let ev;
  try { ev = Cacadas.tiqueDosLacaios(c.e, h, null, grade(h), Date.now()); } finally { Math.random = r; }
  return { c, l, ev };
}

test('E2A — o Ceifador da Evisceração: 40% (q20) de chance de agravar os Sangramentos do alvo atingido', { skip: SEM }, () => {
  assert.equal(invocar('Summon_Reaper_of_Eviscerating', 20).poe.agravarPct, 40);
  assert.equal(invocar('Summon_Reaper_of_Eviscerating', 0).poe.agravarPct, undefined);
  const sangra = (c) => Dot.aplicar(c.alvo, { tipo: 'sangramento', total: 1000, origem: { fonte: 'suporte' } }, c.h.clock);
  // dentro dos 40% (0,3): agrava; fora (0,5): não
  const dentro = tiqueDe('Summon_Reaper_of_Eviscerating', { random: 0.3, antes: (c) => sangra(c) });
  assert.ok(dentro.c.alvo.dots.some((d) => d.tipo === 'sangramento' && d.agravado), JSON.stringify(dentro.c.alvo.dots));
  const fora = tiqueDe('Summon_Reaper_of_Eviscerating', { random: 0.5, antes: (c) => sangra(c) });
  assert.ok(!fora.c.alvo.dots.some((d) => d.tipo === 'sangramento' && d.agravado));
});

test('E2A — o Zumbi da Pancada: +76% de Área e de Recarga só na Pancada (o golpe em área do zumbi)', { skip: SEM }, () => {
  const q = invocar('Raise_Zombie_of_Slamming');
  assert.deepEqual([q.poe.impactoAreaPct, q.poe.impactoRecargaPct], [76, 76]);
  // o raio: 1 × √1,76 = 1,327 casa → 1 + (32,7% de chance de mais uma)
  assert.equal(LacaiosPoe.raioDaAreaDoLacaio({ poe: q.poe }, () => 0.2), 2);
  assert.equal(LacaiosPoe.raioDaAreaDoLacaio({ poe: q.poe }, () => 0.5), 1);
  assert.equal(LacaiosPoe.raioDaAreaDoLacaio({ poe: {} }, () => 0.2), 1);
  // a recarga: cada acerto carrega 1,76 da Pancada
  const { l } = tiqueDe('Raise_Zombie_of_Slamming', { random: 0.99, antes: (c, z) => { z.cargaDaArea = 0; } });
  assert.ok(Math.abs(l.cargaDaArea - 1.76) < 1e-9, String(l.cargaDaArea));
});

test('E2A — a Balista de Cerco de Trarthus: 8 balistas (no 20) em anel em volta do alvo, que disparam uma vez e somem; 20% mais Dano de Projétil (q20)', { skip: SEM }, () => {
  assert.deepEqual(G.statusNoJogo().Siege_Ballista_of_Trarthus.motivos, []);
  assert.equal(G.statusNoJogo().Siege_Ballista_of_Trarthus.status, 'funciona');
  assert.deepEqual(invocar('Siege_Ballista_of_Trarthus').anel, { n: 8, posicionamentoPct: 300, umaVez: true });
  assert.equal(invocar('Siege_Ballista_of_Trarthus', 0, 1).anel.n, 4, 'no 1: 4 (o poedb escreve "Invoca 1")');
  assert.deepEqual([invocar('Siege_Ballista_of_Trarthus').maximo, invocar('Siege_Ballista_of_Trarthus').porUso], [8, 8]);
  assert.equal(G.linhasLocaisNoNivel('Siege_Ballista_of_Trarthus', 20, 20).af['mais_dano@projetil'], 20);
  assert.equal(G.linhasLocaisNoNivel('Siege_Ballista_of_Trarthus', 20, 0).af['mais_dano@projetil'], undefined);
  // as casas do anel: as 8 em volta (sem a do bicho), as mais perto de você primeiro
  const anel = GemasE2a.casasDoAnel({ x: 10, y: 10 }, { x: 6, y: 10 }, null, new Set(['9,10']));
  assert.equal(anel.length, 7);
  assert.ok(!anel.some((c) => c.x === 9 && c.y === 10));
  assert.equal(anel[0].x, 9);
  const { e, h, alvo } = trarthus(20);
  const totens = h.lacaios.filter((l) => l.tipo === 'totem' && l.hp > 0);
  assert.equal(totens.length, 8);
  for (const l of totens) {
    assert.ok(Math.max(Math.abs(l.x - alvo.x), Math.abs(l.y - alvo.y)) <= 1, 'em volta do alvo ' + JSON.stringify({ t: totens.map((x) => [x.x, x.y]), a: [alvo.x, alvo.y], p: h.pos }));
    assert.ok(l.x !== alvo.x || l.y !== alvo.y, 'fora da casa do bicho');
    assert.equal(l.umaVez, true);
  }
  // o tique: cada uma dispara no alvo e some
  for (const l of totens) l.proximoGolpe = 0;
  Cacadas.tiqueDosLacaios(e, h, null, grade(h), Date.now());
  assert.ok(alvo.hp < 1e12, 'o alvo levou as flechas');
  assert.equal(h.lacaios.filter((l) => l.tipo === 'totem' && l.hp > 0).length, 0, 'depois de atacar, desaparecem');
  // o "20% mais Dano de Projétil" da qualidade no tiro da balista: × 1,2 com a mesma rolagem
  const dano = (q) => {
    const c = trarthus(q);
    const l = c.h.lacaios.find((x) => x.tipo === 'totem' && x.hp > 0);
    const r0 = Math.random;
    Math.random = () => 0.5;
    let ev;
    try { ev = Cacadas.golpeDoTotem(c.e, c.h, l, c.alvo, Ficha.combate(c.e), PERSONAGEM, c.h.clock); } finally { Math.random = r0; }
    return ev.filter((x) => x.t === 'dmg' && x.foe && x.uid === c.alvo.uid).reduce((n, x) => n + x.v, 0);
  };
  const [d0, d20] = [dano(0), dano(20)];
  assert.ok(d0 > 0 && d20 > d0 && Math.abs(d20 - d0 * 1.2) <= 1, `${d0} → ${d20}`);
});

test('E2A — a Troca de Corpos do Sacrifício: de área (não lacaio); o lacaio danificável no lugar do cadáver explode (34% da Vida dele, q20, 300% mais Área só nela) e morre; você vai para lá', { skip: SEM }, () => {
  assert.equal(G.doSlug('Bodyswap_of_Sacrifice').arquetipo, 'area');
  assert.deepEqual(G.statusNoJogo().Bodyswap_of_Sacrifice.motivos, []);
  const t = G.b3DaGema('Bodyswap_of_Sacrifice', 20, 20).troca;
  assert.deepEqual([t.min, t.max, t.vidaPct, t.lacaio, t.lacaioPct, t.areaLacaioMaisPct], [210, 315, 4, true, 34, 300]);
  assert.ok(Math.abs(t.raioM - 1.6) < 1e-9);
  assert.equal(G.b3DaGema('Bodyswap', 20, 20).troca.lacaio, undefined, 'a comum segue com o cadáver');
  // o "50% menos Dano de Afecções" agora vale (a gema acerta): nas afecções do acerto e da explosão
  assert.equal(G.maisNasAfeccoesDaGema('Bodyswap_of_Sacrifice', 20, 0).maisAfeccaoPct, -50);
  // quem ele consome: o danificável a até o alcance, o mais perto do ponto (não o totem, o intocável, o mercenário, o que ainda cai)
  const ls = [{ uid: 't', tipo: 'totem', hp: 9, x: 5, y: 5 }, { uid: 'r', tipo: 'lacaio', intocavel: true, hp: 9, x: 5, y: 5 }, { uid: 'm', tipo: 'lacaio', mercenario: true, hp: 9, x: 5, y: 5 }, { uid: 'q', tipo: 'lacaio', queda: {}, hp: 9, x: 5, y: 5 }, { uid: 'a', tipo: 'lacaio', hp: 9, x: 8, y: 5 }, { uid: 'b', tipo: 'lacaio', hp: 9, x: 6, y: 5 }];
  assert.equal(GemasE2a.lacaioDoSacrificio(ls, { x: 0, y: 5 }, { x: 5, y: 5 }, 10).uid, 'b');
  assert.equal(GemasE2a.lacaioDoSacrificio(ls, { x: 0, y: 5 }, { x: 5, y: 5 }, 7).uid, 'b');
  assert.equal(GemasE2a.lacaioDoSacrificio(ls, { x: 0, y: 5 }, { x: 5, y: 5 }, 5), null, 'fora do alcance');
  // na caçada: um zumbi de 100 mil de vida colado nos dois bichos
  const c = cacadaComGema('Bodyswap_of_Sacrifice');
  const z = { uid: 'z1', gema: 'Raise_Zombie', tipo: 'lacaio', hp: 100000, maxHp: 100000, x: c.alvo.x + 1, y: c.alvo.y, nome: 'Zumbi' };
  c.h.lacaios = [z];
  for (const m of c.h.monstros) Object.assign(m, { resist: {}, estados: {}, dots: [] });
  // (o sorteio travado em 0,1: o raio de 0,8 casa da explosão vira 1 casa)
  const r0 = Math.random;
  Math.random = () => 0.1;
  let r;
  try { r = usar(c); } finally { Math.random = r0; }
  assert.equal(r.ok, true, r.erro);
  assert.deepEqual([c.h.pos.x, c.h.pos.y], [z.x, z.y], 'você foi para o lugar do lacaio');
  assert.ok(z.hp <= 0, 'o lacaio foi destruído');
  // a explosão do lacaio: 34% de 100 mil (com o seu Fogo aumentado — a ficha da Bruxa de teste), nos dois bichos (a 1 casa dele)
  for (const m of c.h.monstros) assert.ok(1e12 - m.hp >= 34000, `${1e12 - m.hp}`);
});

/** A Balista de Cerco de Trarthus (com a qualidade) num arco, numa caçada com um bicho a 4 casas; o uso já posto. */
function trarthus(qualidade) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Ranger', sistema: 'poe' });
  const arco = peca('Bows/Crude_Bow');
  arco.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
  e.equipment = { ...e.equipment, weapon: arco };
  delete e.equipment.shield;
  e.inventory = [GS.itemDaGema({ id: G.doSlug('Siege_Ballista_of_Trarthus').itemId, nivel: 20, xp: 0, raridade: 'comum', qualidade })];
  GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: G.doSlug('Siege_Ballista_of_Trarthus').acao, enabled: true, minMana: 0, conditions: [] };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  const h = e.hunt;
  h.clock = 100_000;
  Object.assign(e, { mana: 1e7, maxMana: 1e7, hp: 1e7, maxHp: 1e7 });
  h.monstros = h.monstros.slice(0, 1);
  const alvo = Object.assign(h.monstros[0], { x: h.pos.x + 4, y: h.pos.y, hp: 1e12, maxHp: 1e12, estados: {}, dots: [], resist: {} });
  h.lacaios = [];
  const r = Acoes.disparar(e, h, PERSONAGEM, 0, alvo, { manual: true });
  assert.ok(r.ok, r.erro);
  if (h.conjurando) { h.clock = h.conjurando.fim; Acoes.concluirConjuracao(e, h, PERSONAGEM); }
  return { e, h, alvo };
}
