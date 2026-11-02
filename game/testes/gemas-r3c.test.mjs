// (lote R3C, 27/10) AS PARCIAIS MAIS DIFÍCEIS QUE SOBRARAM (a fila R3C): as Bênçãos (a Divina, a Eterna, a do Guardião), a Mina Local, a Blasfêmia Sobrenatural (a Insanidade
// Perversa), a Constrição Pérfida (as mãos), as Instabilidades Cinéticas (o Fluxo Cinético) e o Vínculo Frígido. Os sorteios ficam travados.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste } = await import('./apoio.mjs');
const Acoes = await import('../systems/acoes.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const G = await import('../systems/itens-poe/gemas-poe.mjs');
const SP = await import('../systems/itens-poe/suportes-poe.mjs');
const R3C = await import('../systems/itens-poe/gemas-r3c.mjs');
const GAC = await import('../systems/itens-poe/gemas-gac.mjs');
const Cond = await import('../systems/itens-poe/condicoes-poe.mjs');
const Plantadas = await import('../systems/itens-poe/armas-plantadas.mjs');
const Runas = await import('../systems/itens-poe/runas-vinculadas.mjs');
const Reserva = await import('../systems/itens-poe/reserva.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');

let J;
let gerarPeca;
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
function travado(v, fn) {
  const antes = Math.random;
  Math.random = typeof v === 'function' ? v : () => v;
  try { return fn(); } finally { Math.random = antes; }
}
const doSlug = (s) => G.doSlug(s) ?? SP.doSlug(s);
const TAGS = (...t) => ({ tags: t.map((x) => `poe:${x}`) });
const ef = (slug, nivel = 20, q = 0, tags = TAGS('Aura', 'Magia', 'Ataque', 'Mina', 'Projétil', 'Vínculo', 'Runa')) => SP.efeitoNoNivel(slug, nivel, q, tags).efeito;
/** O personagem com as gemas (o primeiro grupo ligado: `slugs`; `soltas`: cada uma num soquete sem ligação), numa caçada; o alvo colado e os outros longe. */
async function montar(slugs, { arma = 'One_Hand_Swords/Rusted_Sword', nivel = 20, qualidade = 0, soltas = [] } = {}) {
  J ??= await import('../systems/itens-poe/jogo.mjs');
  gerarPeca ??= (await import('../systems/itens-poe/gerar.mjs')).gerarPeca;
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Scion', sistema: 'poe' });
  const a = peca(arma);
  const n = slugs.length + soltas.length;
  a.soquetes = { abertos: n, links: Array(Math.max(0, n - 1)).fill(false).map((_, i) => i < slugs.length - 1), gemas: Array(n).fill(null), cores: Array(n).fill('W') };
  e.equipment = { ...e.equipment, weapon: a };
  delete e.equipment.shield;
  const todas = [...slugs, ...soltas];
  e.inventory = todas.map((s) => GS.itemDaGema({ id: doSlug(s).itemId, nivel, xp: 0, raridade: 'comum', qualidade }));
  for (let i = 0; i < todas.length; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  e.actions = Array(Acoes.SLOTS).fill(null);
  const ativas = todas.filter((s) => G.doSlug(s));
  ativas.forEach((s, i) => { e.actions[i] = { id: G.doSlug(s).acao, enabled: true, minMana: 0, conditions: [] }; });
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(travado(0.5, () => Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' })).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 1e7;
  e.maxHp = e.hp = 1e7;
  const [b, ...resto] = e.hunt.monstros;
  for (const m of resto) Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60, hp: 1e12, maxHp: 1e12 });
  Object.assign(b, { x: e.hunt.pos.x + 1, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12, estados: {}, dots: [] });
  return { e, b, resto };
}
function usar(e, slot, b, v = 0.5) {
  const r = travado(v, () => Acoes.disparar(e, e.hunt, { nome: 'T' }, slot, b, { manual: true }));
  if (r.ok && e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; travado(v, () => Acoes.concluirConjuracao(e, e.hunt, { nome: 'T' })); }
  return r;
}
const acao = (s) => G.doSlug(s).acao;

const FEITOS = ['Divine_Blessing_Support', 'Eternal_Blessing_Support', 'Guardians_Blessing_Support', 'Locus_Mine_Support', 'Eldritch_Blasphemy_Support', 'Foulgrasp_Support',
  'Kinetic_Instability_Support', 'Greater_Kinetic_Instability_Support', 'Frigid_Bond_Support'];
test('R3C: os suportes feitos saem de "parcial" (toda linha lida)', { skip: SEM }, () => {
  const falhas = FEITOS.filter((s) => SP.doSlug(s)?.status !== 'funciona').map((s) => `${s}: ${SP.doSlug(s)?.status} ${(SP.doSlug(s)?.motivos ?? []).join(' | ')}`);
  assert.deepEqual(falhas, []);
});

test('R3C: as linhas das Bênçãos no nível (a duração e o custo da Divina; o sinal do Efeito das Auras da do Guardião)', { skip: SEM }, () => {
  const d = ef('Divine_Blessing_Support', 20);
  assert.equal(d.bencaoDuracaoMs, 10900);
  assert.equal(d.bencaoCustoMana, 233);
  assert.equal(d.efeitoAuraPct, 29);
  // a do Guardião: −30% no 1, +27% no 20 (o poedb: "reduzido em 30" … "reduzido em 27" — a coluna passa pelo zero no 11)
  assert.equal(ef('Guardians_Blessing_Support', 1).efeitoAuraPct, -30);
  assert.equal(ef('Guardians_Blessing_Support', 10).efeitoAuraPct, -3);
  assert.equal(ef('Guardians_Blessing_Support', 20).efeitoAuraPct, 27);
  assert.equal(ef('Guardians_Blessing_Support', 20).guardiaoDegenPct, 14.3);
  assert.equal(ef('Eternal_Blessing_Support', 20).semReservaR3c, 1);
  assert.deepEqual(R3C.bencaoDaAura('aura', 'Hatred', d), { tipo: 'divina', duracaoMs: 10900, custoMana: 233 });
  // só a aura permanente (nem o Estandarte nem outro arquétipo)
  assert.equal(R3C.bencaoDaAura('aura', 'War_Banner', d), null);
  assert.equal(R3C.bencaoDaAura('maldicao', 'Despair', d), null);
});

test('R3C: a Bênção Divina — a aura não reserva, custa "+N de Mana" e dura a base × a Duração', { skip: SEM }, async () => {
  const { e, b } = await montar(['Hatred', 'Divine_Blessing_Support']);
  const id = acao('Hatred');
  const antes = e.mana;
  const r = usar(e, 0, b);
  assert.ok(r.ok, JSON.stringify(r));
  const buff = e.hunt.buffs[id];
  assert.ok(buff, 'a aura ligou');
  assert.equal(buff.bencaoR3c, 'divina');
  assert.equal(buff.reserva, undefined);
  assert.equal(Reserva.reservadas(e).mana, 0);
  const dur = buff.ate - (buff.desde ?? e.hunt.clock);
  assert.ok(dur >= 10900 * 0.99 && dur < 30000, `duração ${dur}`);
  // o custo: os 233 de Mana × os multiplicadores (o personagem de teste não tem nenhum)
  assert.ok(antes - e.mana >= 233 * 0.5 && antes - e.mana <= 233 * 2, `gastou ${antes - e.mana}`);
});

test('R3C: a Bênção Eterna — sem reserva, ligada; desabilita as não-Bênção que reservam Mana', { skip: SEM }, async () => {
  const { e, b } = await montar(['Hatred', 'Eternal_Blessing_Support'], { soltas: ['Anger'] });
  const raiva = acao('Anger');
  const r0 = usar(e, 1, b);
  assert.ok(r0.ok, JSON.stringify(r0));
  assert.ok(e.hunt.buffs[raiva]?.reserva);
  e.hunt.clock += 5000;
  const r1 = usar(e, 0, b);
  assert.ok(r1.ok, JSON.stringify(r1));
  const buff = e.hunt.buffs[acao('Hatred')];
  assert.equal(buff.bencaoR3c, 'eterna');
  assert.equal(buff.ate, Reserva.LIGADA_ATE);
  assert.equal(buff.reserva, undefined);
  assert.equal(e.hunt.buffs[raiva], undefined, 'a Eterna desligou a Ira');
  e.hunt.clock += 5000;
  const r = usar(e, 1, b);
  assert.equal(r.ok, false);
  assert.equal(r.motivo, 'AURA_DESABILITADA');
});

test('R3C: "Você só pode ter uma Aura de suas Habilidades Bênção" (a nova tira a velha)', () => {
  const hunt = { clock: 0, buffs: { a: { ate: 5000, bencaoR3c: 'divina' }, c: { ate: 9e15, reserva: { recurso: 'mana', pct: 25 } } } };
  hunt.buffs.b = { ate: 100 };
  R3C.aplicarBencao(hunt, 'b', hunt.buffs.b, { tipo: 'divina', duracaoMs: 10000 }, 0, 1.5);
  assert.equal(hunt.buffs.a, undefined);
  assert.equal(hunt.buffs.b.ate, 15000);
  assert.ok(hunt.buffs.c, 'a Divina não desliga quem reserva');
  hunt.buffs.d = { ate: 100 };
  R3C.aplicarBencao(hunt, 'd', hunt.buffs.d, { tipo: 'eterna' }, 0, 1, 777);
  assert.equal(hunt.buffs.b, undefined);
  assert.equal(hunt.buffs.c, undefined, 'a Eterna desliga quem reserva Mana');
  assert.equal(hunt.buffs.d.ate, 777);
});

test('R3C: a Bênção do Guardião — a aura só em você com lacaios do grupo; o dano neles enquanto ela está em você', () => {
  const hunt = { clock: 0, lacaios: [{ acao: 'z', hp: 1000, maxHp: 1000, es: 0, maxEs: 0 }, { acao: 'outro', hp: 1000, maxHp: 1000 }] };
  const b = { bencaoR3c: 'guardiao', ate: 9e15 };
  assert.equal(R3C.guardiaoEmVoce(hunt, b, ['z'], 0), false, 'nada muda: já vale em você');
  assert.equal(b.soAliados, undefined, 'com o Zumbi do grupo vivo, a aura vale em você');
  assert.equal(R3C.guardiaoEmVoce(hunt, b, ['outro-grupo'], 0), true);
  assert.equal(b.soAliados, true, 'sem lacaio do grupo, só nos aliados');
  assert.equal(R3C.guardiaoEmVoce(hunt, b, ['z'], 0), true);
  assert.equal(b.soAliados, undefined);
  // 14,3% de (Vida + Escudo de Energia) por segundo: em 500 ms, 71,5 da Vida de 1000
  const l = { acao: 'z', hp: 1000, maxHp: 800, es: 50, maxEs: 200 };
  R3C.degenDoGuardiao([l], ['z'], 14.3, 500, 0);
  assert.ok(Math.abs(l.es - 0) < 1e-9);
  assert.ok(Math.abs(l.hp - (1000 - (71.5 - 50))) < 1e-9);
  const fora = { acao: 'w', hp: 1000, maxHp: 1000 };
  R3C.degenDoGuardiao([fora], ['z'], 14.3, 500, 0);
  assert.equal(fora.hp, 1000);
});

test('R3C: a Mina Local — as Minas caem em você, em arco à frente, e não detonam a até 3 m de você', () => {
  const e1 = ef('Locus_Mine_Support', 20);
  assert.equal(e1.minaEmVoceR3c, 1);
  assert.equal(e1.minaEmArcoR3c, 1);
  assert.equal(e1.minaSemDetonarPertoM, 3);
  // (aval do dono 27/10: a Mina cai no lugar mirado; o "foca na sua localização" é a mira da habilidade dela)
  assert.deepEqual(R3C.lugarDaMina(e1, { x: 9, y: 9 }, { x: 1, y: 2 }), { x: 9, y: 9 });
  assert.deepEqual(R3C.casasDoArco({ x: 0, y: 0 }, 0, 3), [{ x: 0, y: 0 }, { x: 0, y: -1 }, { x: 1, y: -1 }]);
  // 3 m = 1,5 casa: 1 casa e 50% de chance de 2
  assert.equal(travado(0.4, () => R3C.raioSemDetonar(e1)), 2);
  assert.equal(travado(0.6, () => R3C.raioSemDetonar(e1)), 1);
  const hunt = { clock: 10_000, pos: { x: 0, y: 0 }, z: 0, monstros: [{ uid: 'm', x: 1, y: 0, z: 0, hp: 10 }], plantadas: [] };
  const p = Plantadas.plantar(hunt, {}, { tipo: 'mina', acao: 'a', slot: 0, x: 1, y: 0, duracaoMs: 5000, detonacaoMs: 250, agora: 9000 });
  p.semDetonarCasas = 1;
  assert.deepEqual(Plantadas.minasQueDetonam(hunt, {}, 10_000), [], 'colada em você, não detona');
  hunt.pos = { x: -5, y: 0 };
  assert.equal(Plantadas.minasQueDetonam(hunt, {}, 10_000).length, 1, 'longe de você, detona');
});

test('R3C: a Insanidade Perversa — 5 s na aura; 10% menos Dano e 10% de Velocidade de Ação reduzida', () => {
  const m = { uid: 'm', x: 2, y: 0, z: 0, hp: 10, estados: {} };
  const longe = { uid: 'l', x: 9, y: 0, z: 0, hp: 10, estados: {} };
  R3C.tiqueDaInsanidade([m, longe], { x: 0, y: 0 }, 0, 'aura', 2.4, 5000, 0, () => 0.5);
  assert.equal(R3C.comInsanidade(m, 0), false);
  R3C.tiqueDaInsanidade([m, longe], { x: 0, y: 0 }, 0, 'aura', 2.4, 5000, 5000, () => 0.5);
  assert.equal(R3C.comInsanidade(m, 5000), true);
  assert.equal(R3C.comInsanidade(longe, 5000), false);
  assert.ok(Math.abs(R3C.fatorDaInsanidade(m, 5000) - 0.9) < 1e-12);
  assert.ok(Math.abs(GAC.fatorDeAcao(m, 5000) - 1 / 0.9) < 1e-12);
  assert.ok(Math.abs(Cond.doBicho(m, 5000).danoFator - 0.9) < 1e-12);
  // saiu da aura: a conta zera
  m.x = 9;
  R3C.tiqueDaInsanidade([m], { x: 0, y: 0 }, 0, 'aura', 2.4, 5000, 6000, () => 0.5);
  assert.equal(m.poeR3cAura.aura, undefined);
  assert.equal(R3C.comInsanidade(m, 6000), false);
});

test('R3C: a Blasfêmia Sobrenatural no tique — o inimigo na aura da maldição por mais de 5 s fica com a Insanidade', { skip: SEM }, async () => {
  const { e, b } = await montar(['Despair', 'Eldritch_Blasphemy_Support']);
  assert.ok(usar(e, 0, b).ok);
  const id = acao('Despair');
  assert.ok(e.hunt.buffs[id]?.efeitosPoe, 'a maldição em aura ligou');
  travado(0.5, () => Acoes.tiqueR3C(e, e.hunt, { nome: 'T' }, [], e.hunt.clock));
  e.hunt.clock += 5000;
  travado(0.5, () => Acoes.tiqueR3C(e, e.hunt, { nome: 'T' }, [], e.hunt.clock));
  assert.equal(R3C.comInsanidade(b, e.hunt.clock), true);
});

test('R3C: o Fluxo Cinético — a anomalia explode com um inimigo perto (o ataque da varinha × o X% de base, com o Poder Arcano)', { skip: SEM }, async () => {
  const { e, b } = await montar(['Kinetic_Bolt', 'Kinetic_Instability_Support'], { arma: 'Wands/Driftwood_Wand' });
  const e1 = ef('Kinetic_Instability_Support', 20);
  assert.equal(e1.fluxoAoMatar, 1);
  assert.equal(e1.fluxoArcanoPct, 150);
  assert.equal(e1.fluxoDanoPct, 150);
  const id = acao('Kinetic_Bolt');
  // o golpe fatal cria a anomalia no lugar do morto
  b.hp = 1;
  assert.ok(usar(e, 0, b, 0.01).ok);
  const an = e.hunt.poeR3c?.anomalias ?? [];
  assert.equal(an.length, 1, JSON.stringify(e.hunt.poeR3c));
  assert.equal(an[0].acao, id);
  // um inimigo chega perto: explode (sai da lista e acerta)
  const outro = e.hunt.monstros.find((m) => m !== b);
  Object.assign(outro, { x: an[0].x, y: an[0].y, z: an[0].z, hp: 1e12, maxHp: 1e12, estados: {}, dots: [] });
  const eventos = travado(0.01, () => Acoes.tiqueR3C(e, e.hunt, { nome: 'T' }, [], e.hunt.clock));
  assert.equal(e.hunt.poeR3c.anomalias.length, 0);
  assert.ok(eventos.some((x) => x.t === 'dmg' && x.fonte === 'fluxo-cinetico' && x.v > 0), JSON.stringify(eventos.slice(0, 5)));
  // o teto: 20 anomalias (a mais velha sai)
  const hunt = { clock: 0 };
  for (let i = 0; i < 25; i++) R3C.criarAnomalia(hunt, { acao: 'a', c: { x: i, y: 0 }, z: 0, raio: 0, ms: 6000 }, 0);
  assert.equal(hunt.poeR3c.anomalias.length, 20);
  assert.equal(hunt.poeR3c.anomalias[0].x, 5);
});

test('R3C: a Instabilidade Cinética Maior — no golpe crítico, na recarga de 0,15 s com 6 usos', () => {
  const hunt = { clock: 0 };
  const usos = Array.from({ length: 8 }, () => R3C.gastarUso(hunt, 'k', 150, 6, 0));
  assert.deepEqual(usos, [true, true, true, true, true, true, false, false]);
  assert.equal(R3C.gastarUso(hunt, 'k', 150, 6, 150), true);
  assert.equal(R3C.gastarUso(hunt, 'k', 150, 6, 150), false);
  assert.equal(ef('Greater_Kinetic_Instability_Support', 3).fluxoAoCritico, 1);
  assert.equal(ef('Greater_Kinetic_Instability_Support', 3).fluxoUsos, 6);
});

test('R3C: a Constrição Pérfida — +2 Runas; convocar cria as mãos, que detonam com um inimigo perto', { skip: SEM }, async () => {
  const e1 = ef('Foulgrasp_Support', 3, 20);
  assert.equal(e1.runasExtrasR3c, 2);
  assert.equal(e1.maosPorRuna, 2);
  assert.equal(e1.maosExtras, 2);
  // o teto das Runas com o extra
  const hunt0 = { clock: 0, runas: [] };
  for (let i = 0; i < 5; i++) Runas.conjurar(hunt0, {}, { acao: 'r', slot: 0, x: 0, y: 0, props: { intervaloMs: 1000, vinculadaMs: 4000, soltaMs: 2000 }, maximoExtra: 2 });
  assert.equal(hunt0.runas.length, Runas.maximo({}) + 2);
  const { e, b } = await montar(['Armageddon_Brand', 'Foulgrasp_Support'], { nivel: 3, qualidade: 20 });
  const id = acao('Armageddon_Brand');
  const novas = travado(0.3, () => Acoes.maosNaConvocacaoR3c(e, e.hunt, { [id]: 2 }, e.hunt.clock));
  assert.equal(novas.length, 2 * 2 + 2);
  // a recarga de 1 s
  assert.equal(travado(0.3, () => Acoes.maosNaConvocacaoR3c(e, e.hunt, { [id]: 2 }, e.hunt.clock + 10)).length, 0);
  const h = e.hunt.poeR3c.maos[0];
  Object.assign(b, { x: h.x, y: h.y, z: h.z });
  const eventos = travado(0.3, () => Acoes.tiqueR3C(e, e.hunt, { nome: 'T' }, [], e.hunt.clock + 20));
  assert.ok(eventos.some((x) => x.t === 'dmg' && x.fonte === 'constricao-perfida' && x.v > 0), JSON.stringify(eventos.slice(0, 4)));
  assert.ok(e.hunt.poeR3c.maos.length < novas.length);
  // o teto de 30 mãos vivas
  const hunt = { clock: 0 };
  R3C.criarMaos(hunt, { acao: 'a', centro: { x: 0, y: 0 }, z: 0, raio: 2, raio2: 1, n: 50, ms: 8000 }, 0, () => 0.5);
  assert.equal(hunt.poeR3c.maos.length, 30);
});

test('R3C: o Vínculo Frígido — o feixe entre você e o alvo vinculado dá o Gelo degenerativo e Resfria (10%)', { skip: SEM }, async () => {
  const e1 = ef('Frigid_Bond_Support', 20, 20);
  assert.equal(e1.frigidoDps, 4335.8);
  assert.equal(e1.frigidoMs, 5000);
  assert.equal(e1.frigidoMagico, 1);
  assert.deepEqual(R3C.casasDoFeixe({ x: 0, y: 0 }, { x: 3, y: 0 }), ['0,0', '1,0', '2,0', '3,0']);
  const { e, b } = await montar(['Protective_Link', 'Frigid_Bond_Support']);
  const id = acao('Protective_Link');
  const p = e.hunt.pos;
  const lacaio = { uid: 'lac1', acao: 'x', hp: 100, maxHp: 100, x: p.x + 4, y: p.y, z: e.hunt.z ?? 0 };
  e.hunt.lacaios = [...(e.hunt.lacaios ?? []), lacaio];
  e.hunt.vinculos = [{ acao: id, slug: 'Protective_Link', nome: 'Vínculo', desde: e.hunt.clock, ate: e.hunt.clock + 10_000, custoPorSegundo: 0, proximoCusto: e.hunt.clock + 1e9, efeitos: [], alvos: [{ tipo: 'lacaio', uid: 'lac1', foraMs: 0 }], em: e.hunt.clock }];
  Object.assign(b, { x: p.x + 2, y: p.y, estados: {}, dots: [] });
  const eventos = travado(0.5, () => Acoes.tiqueDosVinculos(e, e.hunt, { nome: 'T' }, [], e.hunt.clock));
  assert.ok((b.dots ?? []).some((d) => d.tipo === G.DEGEN_DO_ELEMENTO.ice), JSON.stringify(b.dots));
  assert.ok((b.estados.lento?.pct ?? 0) >= 10 - 1e-9, JSON.stringify(b.estados.lento));
  assert.ok(Array.isArray(eventos));
});
