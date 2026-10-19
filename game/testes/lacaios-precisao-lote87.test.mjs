// OS LACAIOS — LOTE 87 (dono, 19/10: a parte B da Égide Necromântica, "Todos os lacaios (PoE)"): B0 a precisão, o limiar e a imunidade ao
// atordoamento do Path of Building (`pob-lacaios.json`); B1 o golpe de ATAQUE do lacaio pode errar (a precisão contra a evasão do bicho, a sua
// fórmula; a magia, o mercenário e o totem não erram); B2 o atordoamento e o congelado do Chefe no lacaio (preso: não anda nem ataca; 3 s de
// imunidade; o totem e os Robôs fora) e a trava do bloqueio ÷ a recuperação; B3 o crítico do monstro no lacaio, com o "Dano Extra recebido de
// Acertos Críticos reduzido".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');
await import('../systems/acoes.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const Comandos = await import('../systems/passivas/comandos.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const LacaiosPoe = await import('../systems/itens-poe/lacaios-poe.mjs');
const AtributosDoMob = await import('../systems/mobs/atributos.mjs');
const Atributos = await import('../systems/personagem/atributos.mjs');
const Terreno = await import('../systems/hunt/terreno.mjs');
const { BESTIARY } = await import('../systems/hunt/monstros.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
}

const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 70, rng: () => 0.5 }));
/** Uma Bruxa com uma Varinha e um Escudo (com `afEscudo`), e a Égide Necromântica alocada. */
function personagem({ afEscudo = {} } = {}) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'sorcerer', level: 80 }), { sistema: 'poe', classePoe: 'Witch' });
  const escudo = peca('Shields/Cedar_Tower_Shield');
  escudo.poe.af = { ...(escudo.poe.af ?? {}), ...afEscudo };
  e.equipment = { ...(e.equipment ?? {}), weapon: peca('Wands/Driftwood_Wand'), shield: escudo };
  P.garantir(e);
  const no = P.arvore().nos.find((n) => !n.ascendencia && (n.efeitos ?? []).some((x) => /^egide_necromantica$/.test(x.add ?? '')));
  const caminho = P.caminhoAte(e, no.id);
  if (caminho.length > 1) Comandos.comando(e, { action: 'alocar', ids: caminho.slice(0, -1) });
  assert.ok(Comandos.comando(e, { action: 'alocar', id: no.id }).ok);
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  return e;
}
const af = (e) => { Ficha.invalidar(e); return Ficha.combate(e).afPoe; };
const invocar = (slug, a = {}) => LacaiosPoe.oQueInvoca(slug, 10, null, a);
const sequencia = (...xs) => () => xs.shift() ?? 0.99;
/** Uma caçada de verdade (o primeiro bicho, os outros longe) com o relógio lógico longe do de parede. */
function cacada() {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 80 });
  Object.assign(e, { sistema: 'poe', classePoe: 'Witch' });
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  const h = e.hunt;
  h.clock = 100_000;
  Object.assign(e, { hp: 1e6, maxHp: 1e6 });
  const [b, ...outros] = h.monstros;
  for (const o of outros) Object.assign(o, { x: h.pos.x + 60, y: h.pos.y + 60 });
  return { e, h, b };
}

test('B0 — o PoB dos lacaios: a precisão (3,4 no Zumbi), a tabela de precisão de monstro, o limiar do Zumbi (+30%) e os Robôs imunes ao atordoamento', { skip: SEM }, () => {
  const { POB } = LacaiosPoe;
  assert.equal(POB.lacaios.RaisedZombie.precisao, 3.4);
  assert.equal(POB.lacaios.RaisedZombie.limiarAtordoamentoPct, 30);
  for (const id of ['SkitterbotCold', 'SkitterbotLightning', 'SkitterbotFire']) assert.equal(POB.lacaios[id].imuneAtordoamento, true, id);
  assert.ok(!POB.lacaios.RaisedZombie.imuneAtordoamento);
  assert.equal(POB.lacaios.SummonedPhantasm.precisao, 1, 'o Fantasma: × 1');
  assert.equal(POB.lacaios.AbsolutionTemplarJudge.precisao, 1, 'os Juízes: × 1');
  assert.equal(POB.tabelas.precisao.length, 100);
  assert.equal(POB.tabelas.precisao[0], 14);
  assert.equal(POB.tabelas.precisao[67], 290);
  const z = LacaiosPoe.forcaDoPob('RaisedZombie', 68);
  assert.ok(Math.abs(z.precisao - 290 * 3.4) < 1e-9);
  assert.equal(z.golpeDeMagia, false);
  assert.equal(LacaiosPoe.forcaDoPob('SummonedFlameGolem', 68).golpeDeMagia, true, 'o Golem de Chamas: magia');
  assert.equal(LacaiosPoe.forcaDoPob('SkitterbotCold', 68).imuneAtordoamento, true);
  // (a revisão e o dono, 19/10: a habilidade principal no PoE — o Fantasma e o Juiz da Absolvição são magia; o Golem de Caos é ataque)
  // (dono, 19/10: "Pela habilidade principal no PoE")
  assert.equal(LacaiosPoe.forcaDoPob('SummonedChaosGolem', 68).golpeDeMagia, false, 'o Golem de Caos: o golpe corpo a corpo');
  assert.equal(LacaiosPoe.forcaDoPob('SummonedPhantasm', 68).golpeDeMagia, true, 'o Fantasma: o projétil mágico');
  assert.equal(LacaiosPoe.forcaDoPob('AbsolutionTemplarJudge', 68).golpeDeMagia, true, 'o Juiz: a Absolvição');
  assert.equal(LacaiosPoe.forcaDoPob('AbsolutionTemplarJudgeVaal', 68).golpeDeMagia, true, 'o Vaal: magia');
  assert.equal(LacaiosPoe.forcaDoPob('RaisedZombie', 68).golpeDeMagia, false);
});

test('B0 — o escudo da Égide no lacaio: a precisão (fixa e aumentada), a recuperação de atordoamento e de bloqueio, o crítico recebido reduzido', { skip: SEM }, () => {
  const a = af(personagem({ afEscudo: { accuracy: 100, accuracy_inc: 20, stun_recovery: 30, block_recovery: 40, crit_dmg_taken_red: 50 } }));
  assert.deepEqual([a.minion_precisao, a.minion_precisao_inc, a.minion_stun_recovery, a.minion_block_recovery, a.minion_crit_dmg_taken_red], [100, 20, 30, 40, 50]);
  const q = invocar('Raise_Zombie', a);
  // (a precisão de base do Zumbi da gema 10: o nível dele — 32 — na tabela de precisão de monstro do PoB × 3,4 = 65 × 3,4)
  assert.equal(q.nivel, 32);
  assert.ok(Math.abs(q.poe.precisaoBase - 65 * 3.4) < 1e-9, `${q.poe.precisaoBase} = 221`);
  assert.ok(Math.abs(q.poe.precisaoBase - LacaiosPoe.POB.tabelas.precisao[q.nivel - 1] * 3.4) < 1e-9);
  assert.deepEqual([q.poe.precisaoFixa, q.poe.precisaoInc, q.poe.recAtordoamento, q.poe.recBloqueio, q.poe.critRecebidoRed], [100, 20, 30, 40, 50]);
  assert.ok(Math.abs(LacaiosPoe.precisaoDoLacaio({ ...q, poe: q.poe }) - (q.poe.precisaoBase + 100) * 1.2) < 1e-9);
  assert.equal(q.poe.limiarAtordoamentoPct, 30);
  // o Espectro e os sem PoB: a tabela do nível × 1
  assert.equal(LacaiosPoe.precisaoDoLacaio({ nivel: 68, poe: {} }), 290);
});

test('B1 — o golpe de ataque do lacaio erra contra a evasão alta; contra evasão 0, acerta sempre; a magia, o mercenário e o totem não erram', { skip: SEM }, () => {
  const { h, b } = cacada();
  // (um monstro do bestiário do PoE com evasão — a maioria tem 0)
  b.key = Object.keys(BESTIARY).find((k) => BESTIARY[k].poe?.evasao > 0);
  const z = { ...invocar('Raise_Zombie'), nivel: 68 };
  z.poe = { ...z.poe, precisaoBase: LacaiosPoe.forcaDoPob('RaisedZombie', 68).precisao };
  b.evasaoPct = 100_000;
  const nivel = Atributos.levelDoBicho(h, b);
  const evasao = AtributosDoMob.evasaoDe(b, nivel);
  const chance = Atributos.chanceDeAcerto(LacaiosPoe.precisaoDoLacaio(z), nivel, evasao);
  assert.ok(evasao > 0 && chance < 0.5, `a chance de acertar (${chance}) contra ${evasao} de evasão`);
  assert.equal(Cacadas.lacaioErrou(h, z, b, false, () => chance + 0.01), true, 'erra');
  assert.equal(Cacadas.lacaioErrou(h, z, b, false, () => chance - 0.01), false, 'acerta');
  assert.equal(Cacadas.lacaioErrou(h, z, b, true, () => 0.999), false, 'a magia (o estilo do mago) nunca erra');
  const golem = { ...invocar('Summon_Flame_Golem'), nivel: 68 };
  assert.equal(golem.poe.golpeDeMagia, true);
  assert.equal(Cacadas.lacaioErrou(h, golem, b, false, () => 0.999), false, 'o Golem de Chamas (magia) nunca erra');
  assert.equal(Cacadas.lacaioErrou(h, { ...z, mercenario: true }, b, false, () => 0.999), false, 'o mercenário nunca erra');
  assert.equal(Cacadas.lacaioErrou(h, { ...z, tipo: 'totem' }, b, false, () => 0.999), false, 'o totem usa a sua gema (a sua precisão)');
  assert.equal(Cacadas.lacaioErrou(h, { ...z, poe: null }, b, false, () => 0.999), false, 'sem o PoE, não erra');
  // contra evasão 0: 100%
  b.evasaoPct = -100;
  assert.equal(AtributosDoMob.evasaoDe(b, nivel), 0);
  assert.equal(Cacadas.lacaioErrou(h, z, b, false, () => 0.999), false);
});

test('B2 — o Chefe atordoa o lacaio: preso 1,5 s ÷ (1 + recuperação), não anda nem ataca, 3 s de imunidade; o limiar do Zumbi; o totem e os Robôs fora', { skip: SEM }, () => {
  const hunt = { isBoss: true, clock: 5000 };
  const chefe = { boss: true, hp: 100 };
  const z = { uid: 'z', nome: 'Zumbi', poe: { ...invocar('Raise_Zombie').poe } };
  // (os pesos do Chefe: atordoado 2, congelado 2, lento 3 — a 1ª jogada é a chance, a 2ª o efeito)
  assert.equal(LacaiosPoe.controleNoLacaio(z, chefe, hunt, Date.now(), () => 0), 'atordoado');
  assert.equal(z.atordoado.ate, 6500);
  assert.equal(LacaiosPoe.lacaioPreso(z, 6400), true);
  assert.equal(LacaiosPoe.lacaioPreso(z, 6600), false);
  assert.equal(LacaiosPoe.controleNoLacaio(z, chefe, { ...hunt, clock: 7000 }, Date.now(), () => 0), false, 'a imunidade de 3 s depois');
  assert.equal(LacaiosPoe.controleNoLacaio(z, chefe, { ...hunt, clock: 9600 }, Date.now(), () => 0), 'atordoado', 'depois dela, de novo');
  // a recuperação de atordoamento: 1,5 s ÷ 1,5
  const rec = { uid: 'r', nome: 'Zumbi', poe: { ...z.poe, recAtordoamento: 50 } };
  LacaiosPoe.controleNoLacaio(rec, chefe, hunt, Date.now(), () => 0);
  assert.equal(rec.atordoado.ms, 1000);
  // o limiar do Zumbi (+30%): 8 < 10, mas > 10/1,3
  assert.equal(LacaiosPoe.controleNoLacaio({ uid: 'z2', poe: { ...z.poe } }, chefe, hunt, Date.now(), sequencia(0.08, 0)), false);
  assert.equal(LacaiosPoe.controleNoLacaio({ uid: 's', poe: { ...invocar('Summon_Skeletons').poe } }, chefe, hunt, Date.now(), sequencia(0.08, 0)), 'atordoado', 'sem limiar');
  // o totem fica fora; os Robôs são imunes ao atordoamento (o congelado vale)
  assert.equal(LacaiosPoe.controleNoLacaio({ uid: 't', tipo: 'totem', nome: 'Totem', poe: {} }, chefe, hunt, Date.now(), () => 0), false);
  const robo = { uid: 'b', poe: { ...invocar('Summon_Skitterbots').poe } };
  assert.equal(robo.poe.imuneAtordoamento, true);
  assert.equal(LacaiosPoe.controleNoLacaio(robo, chefe, hunt, Date.now(), () => 0), false);
  assert.equal(LacaiosPoe.controleNoLacaio(robo, chefe, hunt, Date.now(), sequencia(0, 0.5)), 'congelado', 'o congelado do Chefe');
  // o comum não controla
  assert.equal(LacaiosPoe.controleNoLacaio({ uid: 'c', poe: {} }, { hp: 1 }, { clock: 0 }, 0, () => 0), false);
});

/** O tique dos lacaios com o Math.random fixo e um Zumbi `l` (com `extra`) ao lado de você; o bicho `b` em `dx` casas dele. */
function tiqueDoZumbi({ extra = {}, dx = 1, random = 0.5, evasaoPct = null } = {}) {
  const { e, h, b } = cacada();
  const q = invocar('Raise_Zombie');
  const l = { ...q, uid: 'l1', tipo: 'lacaio', x: h.pos.x + 2, y: h.pos.y, hp: q.vida, maxHp: q.vida, proximoGolpe: 0, alcanceDeAtaque: 1, perto: 6, ...extra };
  Object.assign(b, { x: l.x + dx, y: l.y, hp: 1e9, maxHp: 1e9 });
  if (evasaoPct != null) Object.assign(b, { key: Object.keys(BESTIARY).find((k) => BESTIARY[k].poe?.evasao > 0), evasaoPct });
  h.lacaios = [l];
  const grade = Cacadas.andarDaGrade(Cacadas.gradeDaHunt(Terreno.huntOuMapaCustom(h.huntId)), h.z);
  const r = Math.random;
  Math.random = () => random;
  let ev;
  try { ev = Cacadas.tiqueDosLacaios(e, h, null, grade, Date.now()); } finally { Math.random = r; }
  return { e, h, b, l, ev };
}

test('B2 — no tique, o lacaio atordoado não anda nem ataca; sem o atordoamento, anda até o bicho e ataca', { skip: SEM }, () => {
  // colado: o atordoado não ataca; o livre, sim
  const preso = tiqueDoZumbi({ extra: { atordoado: { ate: 100_000 + 1000 } } });
  assert.equal(preso.b.hp, 1e9, 'não atacou');
  assert.equal(preso.l.proximoGolpe, 0);
  assert.ok(!preso.ev.some((x) => x.t === 'dmg' && x.foe && x.lacaio));
  const livre = tiqueDoZumbi();
  assert.ok(livre.b.hp < 1e9, 'sem o atordoamento, atacou');
  // o bicho a 3 casas (fora do alcance): o atordoado fica no lugar; o livre anda
  const parado = tiqueDoZumbi({ dx: 3, extra: { atordoado: { ate: 100_000 + 1000 } } });
  assert.deepEqual([parado.l.x, parado.l.y], [parado.h.pos.x + 2, parado.h.pos.y], 'não andou');
  const andou = tiqueDoZumbi({ dx: 3 });
  assert.notDeepEqual([andou.l.x, andou.l.y], [andou.h.pos.x + 2, andou.h.pos.y], 'sem o atordoamento, andou');
});

test('B1 — o golpe principal que ERRA não conta acerto nem solta o golpe em área do Zumbi', { skip: SEM }, () => {
  const cada = invocar('Raise_Zombie').estilo.area.cada;
  // a 4ª pancada é a da área; um vizinho do bicho a leva
  const comVizinho = (opcoes) => {
    const r = tiqueDoZumbi({ ...opcoes, extra: { acertos: cada - 1 } });
    return r;
  };
  const errou = comVizinho({ random: 0.99, evasaoPct: 100_000 });
  assert.ok(errou.ev.some((x) => x.t === 'block' && x.errou && x.lacaio), 'errou');
  assert.equal(errou.l.acertos, cada - 1, 'não contou o acerto');
  assert.ok(!errou.ev.some((x) => x.t === 'explosao'), 'nem soltou a área');
  const acertou = comVizinho({ random: 0.99 });
  assert.ok(acertou.b.hp < 1e9);
  assert.equal(acertou.l.acertos, cada, 'acertou: contou');
  assert.ok(acertou.ev.some((x) => x.t === 'explosao'), 'e soltou a área');
});

test('B2 — a lentidão da MAGIA do Elite no lacaio vale no tique seguinte (o relógio do tique, não o da caçada)', { skip: SEM }, () => {
  const { e, h, b } = cacada();
  const parede = Date.now();
  const q = invocar('Raise_Zombie');
  const l = { ...q, uid: 'l1', tipo: 'lacaio', x: b.x - 1, y: b.y, hp: 1e9, maxHp: 1e9, proximoGolpe: Infinity, poe: { ...q.poe, bloqueioMagico: 0 } };
  h.lacaios = [l];
  // o tique dos lacaios guarda o relógio dele; a magia do monstro chega com o da caçada
  Cacadas.tiqueDosLacaios(e, h, null, Cacadas.andarDaGrade(Cacadas.gradeDaHunt(Terreno.huntOuMapaCustom(h.huntId)), h.z), parede);
  assert.equal(h.agoraDosLacaios, parede);
  Object.assign(b, { elite: true });
  const r = Math.random;
  Math.random = () => 0.001;
  const ev = [];
  try { Cacadas.magiaNoLacaio({ estado: e, hunt: h, bicho: b, l, a: { elemento: 'fire', min: 10, max: 10 }, eventos: ev, agora: h.clock, ficha: Ficha.combate(e) }); } finally { Math.random = r; }
  assert.ok(ev.some((x) => x.t === 'estado' && x.uid === 'l1' && x.estado === 'lento'), 'o Elite deixou o lacaio lento');
  assert.ok(LacaiosPoe.fatorDeLentidao(l, parede + 250) > 1, 'no tique seguinte, o golpe dele demora mais');
});

test('B2 — a trava do bloqueio no lacaio: 0,35 s ÷ (1 + recuperação de bloqueio + de atordoamento); o bloqueio de verdade a põe', { skip: SEM }, () => {
  const l = { uid: 'l', x: 0, y: 0, hp: 10, maxHp: 10, poe: { recBloqueio: 40, recAtordoamento: 60 } };
  assert.equal(LacaiosPoe.travarLacaioNoBloqueio(l, 1000), 175);
  assert.equal(LacaiosPoe.lacaioPreso(l, 1100), true);
  assert.equal(LacaiosPoe.lacaioPreso(l, 1200), false);
  const m = { uid: 'm', x: 0, y: 0, hp: 10, maxHp: 10, poe: { bloqueio: 50 } };
  assert.equal(Cacadas.lacaioBloqueia(m, null, [], () => 0, null, 0, { hunt: { clock: 2000, monstros: [] }, agora: 2000 }), true);
  assert.equal(m.travadoAte, 2350, 'sem recuperação: 0,35 s');
  assert.equal(LacaiosPoe.lacaioPreso(m, 2349), true);
  assert.equal(LacaiosPoe.lacaioPreso(m, 2349, { semTrava: true }), false);
});

test('B3 — o crítico do monstro "Afiado" no lacaio, e o "Dano Extra recebido de Acertos Críticos reduzido" dele', { skip: SEM }, () => {
  const afiado = { critChance: 8, critMultiplicador: 25, hp: 100 };
  const base = AtributosDoMob.critico(afiado);
  assert.ok(base.chance >= 0.08 && base.fator > 1, `o Afiado critica (${base.chance}, ×${base.fator})`);
  const l = { poe: { critRecebidoRed: 0 } };
  const c = LacaiosPoe.criticoNoLacaio(l, base, afiado, 1000, () => 0);
  assert.deepEqual(c, { critico: true, fator: base.fator });
  assert.equal(LacaiosPoe.criticoNoLacaio(l, base, afiado, 1000, () => 0.999).critico, false);
  const red = LacaiosPoe.criticoNoLacaio({ poe: { critRecebidoRed: 50 } }, base, afiado, 1000, () => 0);
  assert.ok(Math.abs(red.fator - (1 + (base.fator - 1) * 0.5)) < 1e-9, `${red.fator}: o dano extra pela metade`);
  // a magia no lacaio: o crítico entra no dano
  const { e, h, b } = cacada();
  Object.assign(b, { critChance: 100, critMultiplicador: 100 });
  const q = invocar('Raise_Zombie');
  const mk = (critRecebidoRed) => ({ ...q, uid: 'l', tipo: 'lacaio', x: b.x - 1, y: b.y, hp: 1e9, maxHp: 1e9, poe: { ...q.poe, bloqueioMagico: 0, critRecebidoRed } });
  const dano = (lac) => { const r = Math.random; Math.random = () => 0.5; try { return Cacadas.magiaNoLacaio({ estado: e, hunt: h, bicho: b, l: lac, a: { elemento: 'physical', min: 100, max: 100 }, eventos: [], agora: Date.now(), ficha: Ficha.combate(e) }); } finally { Math.random = r; } };
  const cheio = dano(mk(0));
  const metade = dano(mk(50));
  delete b.critChance;
  delete b.critMultiplicador;
  const semCrit = dano(mk(0));
  assert.ok(cheio > semCrit && metade > semCrit && metade < cheio, `${semCrit} < ${metade} < ${cheio}`);
});
