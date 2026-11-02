// O LOTE R3D das gemas do PoE (27/10): o Totem Chamariz provoca (os monstros vão até ele e batem nele, não em você); as flechas da Balista de Artilharia caem em linha (o Fogo
// Cruzado em cruz, o Fogo Concentrado em inimigos diferentes), cada inimigo leva um acerto; a Armadilha Conversora faz do inimigo um aliado pela duração e o devolve no fim;
// o Chuva Ardente dá ao totem a Vingança Flamejante (o Fogo de X% da vida dele no atacante, recarga 1 s); o Golem Caótico tem a Cascata e a Aura Caótica (o do Turbilhão, a
// Potencializada, que Definha com o efeito da qualidade); o Rastejador do Arauto da Agonia tem o Morteiro e o Espinho da Cauda; a Mina de Fumaça teleporta, Cega nas nuvens,
// dá o buff de movimento e entra uma só por Sequência, na hora. Os sorteios ficam travados.
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
const Combate = await import('../systems/hunt/combate.mjs');
const Monstros = await import('../systems/hunt/monstros.mjs');
const Terreno = await import('../systems/hunt/terreno.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const LacaiosPoe = await import('../systems/itens-poe/lacaios-poe.mjs');
const Plantadas = await import('../systems/itens-poe/armas-plantadas.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const R3D = await import('../systems/itens-poe/gemas-r3d.mjs');

const sorte = (v, f) => { const o = Math.random; Math.random = () => v; try { return f(); } finally { Math.random = o; } };
const grade = (h) => Cacadas.andarDaGrade(Cacadas.gradeDaHunt(Terreno.huntOuMapaCustom(h.huntId)), h.z);

async function montar(arma, grupos, { qualidade = 0 } = {}) {
  const J = await import('../systems/itens-poe/jogo.mjs');
  const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Scion', sistema: 'poe' });
  const a = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: arma, raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
  const todas = grupos.flat();
  const links = grupos.flatMap((g) => g.map((_, i) => i < g.length - 1)).slice(0, todas.length - 1);
  a.soquetes = { abertos: todas.length, links, gemas: Array(todas.length).fill(null), cores: Array(todas.length).fill('W') };
  e.equipment = { ...e.equipment, weapon: a };
  delete e.equipment.shield;
  e.inventory = todas.map((s) => GS.itemDaGema({ id: (G.doSlug(s) ?? SP.doSlug(s)).itemId, nivel: 20, xp: 0, raridade: 'comum', qualidade }));
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
function colocar(e, slot = 0) {
  Object.assign(e.hunt.monstros[0], { x: e.hunt.pos.x + 3, y: e.hunt.pos.y });
  const r = sorte(0.5, () => Acoes.disparar(e, e.hunt, PERSONAGEM, slot, e.hunt.monstros[0], { manual: true }));
  assert.ok(r.ok, r.erro);
  if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; sorte(0.5, () => Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM)); }
  const l = (e.hunt.lacaios ?? []).filter((x) => x.tipo === 'totem' && x.hp > 0).at(-1);
  assert.ok(l, 'o totem foi posto');
  return l;
}
const golpeDoTotem = (e, l, alvo, v = 0.5) => sorte(v, () => Cacadas.golpeDoTotem(e, e.hunt, l, alvo, Ficha.combate(e), PERSONAGEM, e.hunt.clock));
const acertos = (ev, uid) => ev.filter((x) => x.t === 'dmg' && x.foe && x.uid === uid).length;

// ---------------------------------------------------------------- as contas puras

test('R3D: as flechas da Artilharia — a linha centrada no alvo, a cruz, o foco em inimigos diferentes; um acerto por inimigo', () => {
  const o = { x: 0, y: 0 };
  const a = { x: 4, y: 0, hp: 1 };
  assert.deepEqual(R3D.impactosDaArtilharia('linha', o, a, 6).map((c) => c.x), [2, 3, 4, 5, 6, 7], '6 flechas, 1 casa entre elas, o alvo no meio (a sobra para a frente)');
  assert.ok(R3D.impactosDaArtilharia('linha', o, a, 6).every((c) => c.y === 0));
  const cruz = R3D.impactosDaArtilharia('cruz', o, a, 6);
  assert.equal(cruz.filter((c) => c.y === 0).length, 4, 'a linha da direção: 3 + o cruzamento');
  assert.deepEqual(cruz.filter((c) => c.x === 4).map((c) => c.y).sort((p, q) => p - q), [-1, 0, 0, 1], 'a perpendicular: 3 no x do alvo (uma no cruzamento)');
  const b = { x: 3, y: 2, hp: 1 };
  const c = { x: 9, y: 0, hp: 1 };
  assert.deepEqual(R3D.impactosDaArtilharia('foco', o, a, 5, { vivos: [a, b, c], alcance: 4 }), [{ x: 4, y: 0 }, { x: 3, y: 2 }], 'só os inimigos ao alcance do totem, um cada');
  const r = R3D.atingidosDaArtilharia([{ x: 4, y: 0 }, { x: 5, y: 0 }], 1, [a]);
  assert.equal(r.atingidos.length, 1, 'duas áreas pegam o mesmo: um acerto (OneShotProj)');
  assert.equal(R3D.raioDoImpacto(1), 0, 'sem Área: a casa onde a flecha cai');
  assert.equal(sorte(0.3, () => R3D.raioDoImpacto(2)), 1, '+100% de Área: 2 m × 0,41 = 0,41 casa — o sorteio 0,3 dá a casa a mais');
  assert.equal(R3D.formaDaArtilharia('Artillery_Ballista_of_Focus_Fire'), 'foco');
  assert.equal(R3D.formaDaArtilharia('Siege_Ballista'), null);
});

test('R3D: o Chamariz — o raio de 6 m (3 casas) × √ da Área; o pulso provoca os do raio por 1 s; a isca é o totem vivo', () => {
  assert.equal(R3D.raioDoChamariz(1), 3);
  assert.equal(sorte(0.9, () => R3D.raioDoChamariz(1.5)), 3, '6 × √1,5 = 7,35 m = 3,67 casas — o sorteio 0,9 não dá a casa a mais');
  const l = { uid: 't', x: 0, y: 0, hp: 10, provocaR3D: { raio: 3 } };
  const perto = { uid: 'a', x: 3, y: 1, hp: 5 };
  const longe = { uid: 'b', x: 5, y: 0, hp: 5 };
  const novos = R3D.provocarEmVolta([perto, longe], l, 0, 1000);
  assert.deepEqual(novos.map((m) => m.uid), ['a']);
  assert.deepEqual(perto.estados.provocado, { ate: 2000, por: 'Totem Chamariz', deLacaio: true, alvoUid: 't' });
  const hunt = { clock: 1500, lacaios: [l], monstros: [perto] };
  assert.equal(R3D.iscaDoMonstro(hunt, perto), l);
  l.hp = 0;
  assert.equal(R3D.iscaDoMonstro(hunt, perto), null, 'o totem morto: o monstro volta a você');
  assert.deepEqual(R3D.passoAteAIsca({ x: 4, y: 0 }, { x: 0, y: 0 }, [{ x: 5, y: 0 }, { x: 3, y: 1 }]), { x: 3, y: 1 });
});

test('R3D: a Mina de Fumaça e o Golem Caótico pelas linhas e pelo PoB', () => {
  assert.deepEqual(R3D.fumacaDasLinhas(['Duração base é de 5 segundos', 'Duração Base Secundária é de 1 segundos', 'Buff concede Velocidade de Movimento aumentada em 29 %'], ['Buff concede Velocidade de Movimento aumentada em 20 %']), { movPct: 49, buffMs: 5000, nuvemMs: 1000 });
  const comum = R3D.recargasDoLacaio('Summon_Chaos_Golem', 'SummonedChaosGolem', 20);
  assert.deepEqual(comum.map((h) => h.nome), ['Cascata', 'Aura Caótica']);
  const turbilhao = R3D.recargasDoLacaio('Summon_Chaos_Golem_of_the_Maelstr%C3%B6m', 'SummonedChaosGolem', 20, { definhaPct: 20 });
  assert.deepEqual(turbilhao.map((h) => h.nome), ['Aura Caótica Potencializada'], 'o do Turbilhão: só a Potencializada');
  assert.equal(turbilhao[0].definhaPct, 20);
  assert.equal(turbilhao[0].caosSofridoPct, 6);
  // a eficácia do PoB no nível 20: (3,885209 + 0,360246 × 19) × 19,9 × 1,0521^19
  const ef = (3.885209 + 0.360246 * 19) * 19.89999961853 * 1.052099999040365 ** 19;
  assert.ok(Math.abs(turbilhao[0].porSegundo - (16.666667039196 * ef) / 60) < 1e-6);
  assert.deepEqual(R3D.recargasDoLacaio('Herald_of_Agony', 'HeraldOfAgonySpiderPlated', 20).map((h) => [h.nome, h.projeteis]), [['Morteiro', 6], ['Espinho da Cauda', 5]]);
  const m = { estados: {} };
  assert.equal(R3D.definharNaAura(m, { ate: 5000, agora: 1000, extraPct: 20 }), true);
  assert.equal(R3D.definharNaAura(m, { ate: 5000, agora: 1500, extraPct: 20 }), false, 'um acúmulo por segundo');
  assert.equal(R3D.definharNaAura(m, { ate: 5000, agora: 2000, extraPct: 20 }), true);
  assert.deepEqual([m.estados.definhado.n, m.estados.definhado.ate, m.estados.definhado.efeitoExtraPct], [2, 7000, 20]);
});

test('R3D: o status — as gemas da fila saem de parcial', { skip: SEM }, () => {
  for (const s of ['Decoy_Totem', 'Artillery_Ballista', 'Artillery_Ballista_of_Cross_Strafe', 'Artillery_Ballista_of_Focus_Fire', 'Conversion_Trap', 'Smoke_Mine', 'Herald_of_Agony']) assert.equal(G.doSlug(s).statusNoJogo, 'funciona', `${s}: ${G.doSlug(s).motivosNoJogo.join(' | ')}`);
  assert.ok(!G.doSlug('Summon_Chaos_Golem_of_the_Maelstr%C3%B6m').motivosNoJogo.some((m) => /definhamento/.test(m)));
  assert.equal(SP.doSlug('Flamewood_Support').status, 'funciona', SP.doSlug('Flamewood_Support').motivos.join(' | '));
  assert.deepEqual(SP.efeitoNoNivel('Flamewood_Support', 20, 0, { tags: ['poe:Totem'] }).efeito, { custoPct: 40, vingancaR3D: 1, vingancaRaioM: 1.8, vingancaPct: 137, totemVidaPct: 0 });
});

// ---------------------------------------------------------------- no jogo

test('R3D: a Balista de Artilharia — as 6 flechas em linha acertam os que estão na linha, um acerto cada; fora da linha, nada', { skip: SEM }, async () => {
  const { e, ms } = await montar('Bows/Crude_Bow', [['Artillery_Ballista']]);
  const l = colocar(e);
  const [alvo, atras, frente, fora] = ms;
  Object.assign(alvo, { x: l.x + 3, y: l.y });
  Object.assign(atras, { x: l.x + 1, y: l.y });
  Object.assign(frente, { x: l.x + 5, y: l.y });
  Object.assign(fora, { x: l.x + 3, y: l.y + 2 });
  const ev = golpeDoTotem(e, l, alvo);
  for (const b of [alvo, atras, frente]) assert.equal(acertos(ev, b.uid), 1, `${b.uid} na linha: um acerto`);
  assert.equal(acertos(ev, fora.uid), 0, 'a 2 casas da linha: nada');
  assert.ok(ev.some((x) => x.t === 'area'), 'as áreas das flechas vão para a tela');
});

test('R3D: o Fogo Cruzado acerta na perpendicular; o Fogo Concentrado, cada inimigo ao alcance uma vez', { skip: SEM }, async () => {
  {
    const { e, ms } = await montar('Bows/Crude_Bow', [['Artillery_Ballista_of_Cross_Strafe']]);
    const l = colocar(e);
    const [alvo, lado] = ms;
    Object.assign(alvo, { x: l.x + 3, y: l.y });
    Object.assign(lado, { x: l.x + 3, y: l.y + 1 });
    const ev = golpeDoTotem(e, l, alvo);
    assert.equal(acertos(ev, lado.uid), 1, 'na linha perpendicular, no x do alvo');
  }
  {
    const { e, ms } = await montar('Bows/Crude_Bow', [['Artillery_Ballista_of_Focus_Fire']]);
    const l = colocar(e);
    const [alvo, b, c] = ms;
    Object.assign(alvo, { x: l.x + 3, y: l.y });
    Object.assign(b, { x: l.x - 2, y: l.y + 2 });
    Object.assign(c, { x: l.x + 2, y: l.y - 3 });
    const ev = golpeDoTotem(e, l, alvo);
    for (const m of [alvo, b, c]) assert.equal(acertos(ev, m.uid), 1, `${m.uid}: uma flecha nele`);
  }
});

test('R3D: o Totem Chamariz — o monstro provocado anda até o totem, bate nele (não em você) e o totem perde vida', { skip: SEM }, async () => {
  const { e, ms } = await montar('Wands/Driftwood_Wand', [['Decoy_Totem']]);
  const h = e.hunt;
  const l = colocar(e);
  assert.equal(l.provocaR3D.raio, 3, '6 m: 3 casas');
  Object.assign(l, { x: h.pos.x + 3, y: h.pos.y });
  const [b] = ms;
  // ao seu lado, a 2 casas do totem
  Object.assign(b, { x: h.pos.x + 1, y: h.pos.y, proximoGolpe: 0, proximoPasso: 0 });
  h.clock += 1000;
  sorte(0.99, () => Cacadas.tiqueDosLacaios(e, h, PERSONAGEM, grade(h), Date.now()));
  assert.equal(b.estados.provocado?.alvoUid, l.uid, 'provocado pelo totem');
  // colado em você, provocado: não bate em você
  const hp0 = e.hp;
  sorte(0.5, () => Combate.golpesDosMonstros(e, h, PERSONAGEM));
  assert.equal(e.hp, hp0, 'o provocado não bate em você');
  // anda até o totem
  sorte(0.5, () => Monstros.moverMonstros(h, grade(h), h.clock));
  assert.equal(Math.max(Math.abs(b.x - l.x), Math.abs(b.y - l.y)), 1, 'um passo na direção do totem: colado nele');
  // colado no totem, bate nele no ritmo do golpe dele
  b.proximoGolpe = 0;
  const vida = l.hp;
  sorte(0.99, () => Cacadas.tiqueDosLacaios(e, h, PERSONAGEM, grade(h), Date.now()));
  assert.ok(l.hp < vida, 'o totem levou o golpe (com o sorteio 0,99 o "um golpe a cada ~2 s" de antes não sairia)');
});

test('R3D: o Chuva Ardente — o totem acertado lança a Vingança Flamejante no atacante (137% da vida dele em Fogo), uma vez por segundo', { skip: SEM }, async () => {
  const { e, ms } = await montar('Wands/Driftwood_Wand', [['Shockwave_Totem', 'Flamewood_Support']]);
  const h = e.hunt;
  const l = colocar(e);
  assert.deepEqual([l.vingancaR3D.pct, l.vingancaR3D.raioM], [137, 1.8]);
  const [b] = ms;
  Object.assign(b, { x: l.x + 1, y: l.y });
  const ev = sorte(0.5, () => Acoes.vingancaFlamejante(e, h, PERSONAGEM, l, b, h.clock));
  assert.equal(acertos(ev, b.uid), 1, 'o atacante leva o Fogo');
  assert.ok(ev.find((x) => x.t === 'dmg' && x.uid === b.uid).lacaio, 'o acerto é do totem');
  assert.equal(b.poeUltimoDano?.quem, 'totem');
  assert.equal(sorte(0.5, () => Acoes.vingancaFlamejante(e, h, PERSONAGEM, l, b, h.clock + 500)).length, 0, 'na recarga (1 s): nada');
  assert.ok(sorte(0.5, () => Acoes.vingancaFlamejante(e, h, PERSONAGEM, l, b, h.clock + 1000)).length > 0, 'depois de 1 s, de novo');
});

test('R3D: a Armadilha Conversora — o inimigo vira aliado pela duração, sai dos inimigos e volta no fim; o Único não', { skip: SEM }, async () => {
  const { e, ms } = await montar('Wands/Driftwood_Wand', [['Conversion_Trap']]);
  const h = e.hunt;
  const [b, unico] = ms;
  Object.assign(b, { x: h.pos.x + 2, y: h.pos.y, raridade: 'normal' });
  const ficha = Ficha.combate(e);
  Plantadas.plantar(h, ficha, { tipo: 'armadilha', acao: G.doSlug('Conversion_Trap').acao, slot: 0, x: b.x, y: b.y, duracaoMs: 4000, agora: h.clock });
  sorte(0.5, () => Acoes.tiqueDasPlantadas(e, h, PERSONAGEM, [], h.clock, { soPlantadas: true }));
  assert.ok(!h.monstros.includes(b), 'saiu dos inimigos');
  const l = h.lacaios.find((x) => x.convertido?.monstro === b);
  assert.ok(l, 'virou aliado');
  assert.equal(l.tipo, 'convertido');
  assert.equal(l.poe, null, 'não é lacaio: os modificadores de lacaio não valem');
  assert.equal(l.duracaoMs, 10000, 'a duração da gema no nível 20');
  // luta por você: o golpe corpo a corpo dele no inimigo colado
  const outro = ms[2];
  Object.assign(outro, { x: l.x + 1, y: l.y, hp: 1e9, maxHp: 1e9 });
  l.proximoGolpe = 0;
  sorte(0.5, () => Cacadas.tiqueDosLacaios(e, h, PERSONAGEM, grade(h), l.desde + 1000));
  assert.ok(outro.hp < 1e9, 'o aliado bateu no inimigo');
  // no fim, volta com a vida que sobrou
  l.hp = 123;
  sorte(0.5, () => Cacadas.tiqueDosLacaios(e, h, PERSONAGEM, grade(h), l.ate + 1));
  assert.ok(h.monstros.includes(b), 'voltou a ser inimigo');
  assert.equal(b.hp, 123);
  // o Único não é convertido
  Object.assign(unico, { x: h.pos.x - 2, y: h.pos.y, raridade: 'unico' });
  Plantadas.plantar(h, ficha, { tipo: 'armadilha', acao: G.doSlug('Conversion_Trap').acao, slot: 0, x: unico.x, y: unico.y, duracaoMs: 4000, agora: h.clock });
  sorte(0.5, () => Acoes.tiqueDasPlantadas(e, h, PERSONAGEM, [], h.clock, { soPlantadas: true }));
  assert.ok(h.monstros.includes(unico));
});

test('R3D: a Mina de Fumaça — teleporta para a Mina, Cega nas nuvens e dá o buff; uma só por Sequência, na hora', { skip: SEM }, async () => {
  const { e, ms } = await montar('Wands/Driftwood_Wand', [['Smoke_Mine']], { qualidade: 20 });
  const h = e.hunt;
  const ficha = Ficha.combate(e);
  const acao = G.doSlug('Smoke_Mine').acao;
  const de = { x: h.pos.x, y: h.pos.y };
  const andavel = [...grade(h).andavel].map((k) => k.split(',').map(Number)).find(([x, y]) => Math.max(Math.abs(x - de.x), Math.abs(y - de.y)) === 3);
  const [b, c] = ms;
  const p1 = Plantadas.plantar(h, ficha, { tipo: 'mina', acao, slot: 0, x: andavel[0], y: andavel[1], duracaoMs: 8000, agora: h.clock });
  Plantadas.plantar(h, ficha, { tipo: 'mina', acao, slot: 0, x: andavel[0], y: andavel[1], duracaoMs: 8000, agora: h.clock + 1 });
  Object.assign(b, { x: p1.x + 1, y: p1.y });
  Object.assign(c, { x: de.x, y: de.y + 1 });
  h.clock += 10;
  const ev = sorte(0.0, () => Acoes.tiqueDasPlantadas(e, h, PERSONAGEM, [], h.clock, { soPlantadas: true }));
  assert.deepEqual([h.pos.x, h.pos.y], [p1.x, p1.y], 'teleportou para a Mina, na hora (sem o tempo de detonação)');
  assert.equal(h.plantadas.filter((p) => p.tipo === 'mina').length, 1, 'a outra Mina de Fumaça espera a próxima Sequência');
  assert.ok(b.estados.cego?.ate > h.clock && c.estados.cego?.ate > h.clock, 'as duas nuvens Cegam (a de saída e a de chegada; sorteio 0 dá o raio de 1 casa)');
  assert.ok(ev.some((x) => x.t === 'estado' && x.estado === 'cego'));
  const buff = h.poeTemporarios['fumacaR3D:move_speed'];
  assert.equal(buff.valor, 49, '29% do nível + 20% da qualidade');
  assert.equal(buff.ate - h.clock, 5000, 'a duração da gema no nível 20');
});

test('R3D: o Golem do Turbilhão — a Aura Potencializada fere com Caos, Definha (com o efeito da qualidade) e faz sofrer 6% mais Caos', { skip: SEM }, async () => {
  const { e, ms } = await montar('Wands/Driftwood_Wand', [['Summon_Chaos_Golem_of_the_Maelstr%C3%B6m']], { qualidade: 20 });
  const h = e.hunt;
  const q = LacaiosPoe.oQueInvoca('Summon_Chaos_Golem_of_the_Maelstr%C3%B6m', 20, { qualidade: 20 }, {});
  assert.deepEqual(q.recargas.map((x) => [x.tipo, x.definhaPct]), [['auraCaotica', 20]]);
  const g = { ...q, recargas: q.recargas.map((x) => ({ ...x })), uid: 'g1', tipo: 'lacaio', x: h.pos.x + 2, y: h.pos.y, hp: q.vida, maxHp: q.vida, proximoGolpe: Infinity, alcanceDeAtaque: 1, perto: 6 };
  h.lacaios = [g];
  const [b] = ms;
  Object.assign(b, { x: g.x + 1, y: g.y, hp: 1e9, maxHp: 1e9 });
  sorte(0.5, () => Cacadas.tiqueDosLacaios(e, h, PERSONAGEM, grade(h), Date.now()));
  assert.equal(h.poeAurasCaoticasR3D?.length, 1, 'a aura foi lançada');
  h.clock += 1000;
  const antes = b.hp;
  sorte(0.5, () => Cacadas.tiqueDosLacaios(e, h, PERSONAGEM, grade(h), Date.now()));
  assert.ok(b.hp < antes, 'o Caos por segundo');
  assert.equal(b.estados.definhado?.efeitoExtraPct, 20, 'Definhado com o efeito da qualidade');
  assert.ok(b.estados.caosSofridoR3D?.pct === 6);
  const f1 = ModsPoe.fatorRecebidoPeloBicho?.(b, 'chaos', null, h.clock);
  if (f1 != null) assert.ok(Math.abs(f1 - (1 + 0.06 * 1.2 * b.estados.definhado.n) * 1.06) < 1e-9, `o Definhamento com +20% e os 6%: ${f1}`);
});

test('R3D: o Rastejador do Arauto da Agonia — o Morteiro em área e o Espinho da Cauda em inimigos diferentes', { skip: SEM }, async () => {
  const { e, ms } = await montar('Wands/Driftwood_Wand', [['Herald_of_Agony']]);
  const h = e.hunt;
  const q = LacaiosPoe.oQueInvoca('Herald_of_Agony', 20, { virulencia: 10 }, {});
  assert.deepEqual(q.recargas.map((x) => x.tipo), ['morteiro', 'espinho']);
  const r = { ...q, recargas: q.recargas.map((x) => ({ ...x })), uid: 'r1', tipo: 'lacaio', x: h.pos.x + 1, y: h.pos.y, hp: 1, maxHp: 1, proximoGolpe: Infinity, alcanceDeAtaque: 1, perto: 6, intocavel: true };
  h.lacaios = [r];
  const [a, b] = ms;
  Object.assign(a, { x: r.x + 3, y: r.y, hp: 1e9, maxHp: 1e9 });
  Object.assign(b, { x: r.x + 3, y: r.y + 2, hp: 1e9, maxHp: 1e9 });
  const ev = sorte(0.5, () => Cacadas.tiqueDosLacaios(e, h, PERSONAGEM, grade(h), Date.now()));
  const doMorteiro = ev.filter((x) => x.habilidade === 'HeraldOfAgonyMinionMortar' && x.t === 'dmg');
  const doEspinho = ev.filter((x) => x.habilidade === 'HeraldOfAgonyMinionTailSpike' && x.t === 'dmg');
  assert.ok(doMorteiro.length >= 2, `o Morteiro: 6 projéteis distribuídos nos dois (${doMorteiro.length})`);
  assert.deepEqual(new Set(doEspinho.map((x) => x.uid)), new Set([a.uid, b.uid]), 'o Espinho: um projétil em cada inimigo');
});
