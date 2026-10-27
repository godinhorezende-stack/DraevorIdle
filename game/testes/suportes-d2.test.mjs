// (lote D2, 27/10) AS DECISÕES DO DONO sobre os suportes do S2A e as Minas com reserva: o Decapitar (renovar = somar até 5 s, sem passar dos 20 s), a Transfusão (a
// alma do Devorador de Almas mesmo sem ele, no lacaio a até 3 casas), a Tentação Vaal (o dano de 1300/s pelo tempo da gema Vaal), as Minas da Cadeia Explosiva e de Alto
// Impacto (a reserva do custo base enquanto na barra; cada mina sem custo) e o Dano Dobrado do Alto Impacto (2% por mina a até 3 casas, até 100%). Os sorteios ficam
// travados.
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
const S2A = await import('../systems/itens-poe/suportes-s2a.mjs');
const J2A = await import('../systems/itens-poe/suportes-s2a-jogo.mjs');
const Cond = await import('../systems/itens-poe/condicoes-poe.mjs');
const LacaiosPoe = await import('../systems/itens-poe/lacaios-poe.mjs');
const Reserva = await import('../systems/itens-poe/reserva.mjs');
const Plantadas = await import('../systems/itens-poe/armas-plantadas.mjs');
const QuemFeriu = await import('../systems/hunt/quem-feriu.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const P = await import('../systems/passivas/arvore.mjs');
await import('../systems/itens-poe/aprendizado-inspirado.mjs');

function travado(v, fn) {
  const antes = Math.random;
  Math.random = () => v;
  try { return fn(); } finally { Math.random = antes; }
}
const doSlug = (s) => G.doSlug(s) ?? SP.doSlug(s);
const TAGS = (...t) => ({ tags: t.map((x) => `poe:${x}`) });
const ef = (slug, nivel = 20, q = 0) => SP.efeitoNoNivel(slug, nivel, q, TAGS('Magia', 'Ataque', 'Corpo a Corpo', 'Mina', 'Vaal', 'Lacaio', 'Duração')).efeito;
const bicho = (extra = {}) => ({ uid: 'b' + Math.random(), name: 'Alvo', x: 10, y: 10, z: 0, hp: 1e6, maxHp: 1e6, estados: {}, dots: [], ...extra });

/** O personagem com as gemas ligadas na arma, a ativa no slot 0, numa caçada do PoE; o primeiro bicho colado e imortal, os outros longe. */
async function montar(slugs, { arma = 'Wands/Driftwood_Wand', vocacao = 'sorcerer', classe = 'Witch', nivel = 20, qualidade = 0 } = {}) {
  const J = await import('../systems/itens-poe/jogo.mjs');
  const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
  const e = Object.assign(personagemDeTeste({ vocacao, level: 90 }), { classePoe: classe, sistema: 'poe' });
  const a = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: arma, raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
  a.soquetes = { abertos: slugs.length, links: Array(Math.max(0, slugs.length - 1)).fill(true), gemas: Array(slugs.length).fill(null), cores: Array(slugs.length).fill('W') };
  e.equipment = { ...e.equipment, weapon: a };
  delete e.equipment.shield;
  e.inventory = slugs.map((s) => GS.itemDaGema({ id: doSlug(s).itemId, nivel, xp: 0, raridade: 'comum', qualidade }));
  for (let i = 0; i < slugs.length; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: G.doSlug(slugs[0]).acao, enabled: true, minMana: 0, conditions: [] };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(travado(0.5, () => Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' })).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 1e6;
  e.maxHp = e.hp = 1e6;
  P.garantir(e);
  const [b, ...resto] = e.hunt.monstros;
  for (const m of resto) Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60, hp: 1e12, maxHp: 1e12 });
  Object.assign(b, { x: e.hunt.pos.x + 1, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12, estados: {}, dots: [] });
  return { e, b };
}
/** Usa a gema do slot 0 no alvo (a conjuração concluída), com o sorteio travado em `v`; devolve `{ r, eventos }`. */
function usar(e, alvo, v = 0.5, passo = 10_000) {
  e.hunt.clock += passo;
  const r = travado(v, () => Acoes.disparar(e, e.hunt, PERSONAGEM, 0, alvo, { manual: true }));
  const eventos = [...(r.eventos ?? [])];
  if (r.ok && e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; eventos.push(...(travado(v, () => Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM)) ?? [])); }
  return { r, eventos };
}
const danoEm = (eventos, b) => eventos.filter((x) => x.t === 'dmg' && x.uid === b.uid && x.foe).reduce((t, x) => t + x.v, 0);

test('D2: o Decapitar, a Transfusão e as Minas da Cadeia Explosiva e de Alto Impacto saem de "parcial"; a Tentação Vaal fica só pelo impedimento de ganho de almas', { skip: SEM }, () => {
  for (const s of ['Behead_Support', 'Transfusion_Support', 'Blastchain_Mine_Support', 'High-Impact_Mine_Support']) assert.equal(SP.doSlug(s).status, 'funciona', `${s}: ${SP.doSlug(s).motivos.join(' | ')}`);
  const t = SP.doSlug('Vaal_Temptation_Support');
  assert.equal(t.status, 'parcial');
  assert.equal(t.motivos.length, 1);
  assert.match(t.motivos[0], /impedimento de ganho de almas/i);
  // (a Mina Local: a linha da reserva também sai — o resto dela segue)
  assert.ok(!SP.doSlug('Locus_Mine_Support').motivos.some((m) => /Reserva Base/.test(m)));
});

test('D2: os números das linhas', { skip: SEM }, () => {
  const d = ef('Behead_Support');
  assert.equal(d.decapitarRenovarPct, 20);
  assert.equal(d.decapitarRenovarMs, 5000);
  assert.equal(d.decapitarS, 20);
  const t = ef('Transfusion_Support', 3, 20);
  assert.equal(t.transfusaoVidaPorAlma, 200);
  assert.equal(t.custoVidaIncPct, 10);
  assert.equal(t.custoEmVida, 1);
  assert.equal(ef('Vaal_Temptation_Support', 1).tentacaoVaalPorS, 1500, 'o nível 1 (a tabela do poedb)');
  assert.equal(ef('Blastchain_Mine_Support').reservaDoCusto, 1);
  const a = ef('High-Impact_Mine_Support');
  assert.equal(a.reservaDoCusto, 1);
  assert.equal(a.minaDobroPct, 2);
  assert.equal(a.minaDobroTeto, 100);
});

test('D2: o Decapitar renova — o acerto num Raro ou Único (20%) soma 5 s ao modificador que ele deu, sem passar dos 20 s; no Normal, não', { skip: SEM }, async () => {
  const s = await montar(['Heavy_Strike', 'Behead_Support'], { arma: 'One_Hand_Swords/Rusted_Sword', vocacao: 'knight', classe: 'Scion' });
  const h = s.e.hunt;
  const morto = bicho({ hp: 0, raridade: 'raro', mods: ['poe:Sem_Frostweaver'] });
  QuemFeriu.carimbar(morto, QuemFeriu.VOCE);
  const efD = { decapitarS: 20, decapitarRenovarPct: 20, decapitarRenovarMs: 5000 };
  assert.deepEqual(J2A.abatesS2A(s.e, h, efD, [morto], { golpeCorpo: true, agora: h.clock, rng: () => 0 }), ['poe:Sem_Frostweaver']);
  const temps = () => Object.values(h.poeTemporarios).filter((x) => x.decapitar);
  assert.ok(temps().length > 0 && temps().every((x) => x.ate === h.clock + 20_000));
  h.clock += 12_000; // faltam 8 s
  J2A.noAcertoS2A(h, bicho({ raridade: 'raro' }), efD, { agora: h.clock, rng: () => 0.5 });
  assert.ok(temps().every((x) => x.ate === h.clock + 8000), 'fora dos 20%: não renova');
  J2A.noAcertoS2A(h, bicho({ raridade: 'normal' }), efD, { agora: h.clock, rng: () => 0 });
  assert.ok(temps().every((x) => x.ate === h.clock + 8000), 'o Normal não renova');
  J2A.noAcertoS2A(h, bicho({ raridade: 'unico' }), efD, { agora: h.clock, rng: () => 0.19 });
  assert.ok(temps().every((x) => x.ate === h.clock + 13_000), 'o Único renova: 8 + 5 s');
  J2A.noAcertoS2A(h, bicho({ raridade: 'raro' }), efD, { agora: h.clock, rng: () => 0 });
  J2A.noAcertoS2A(h, bicho({ raridade: 'raro' }), efD, { agora: h.clock, rng: () => 0 });
  assert.ok(temps().every((x) => x.ate === h.clock + 20_000), 'não passa dos 20 s');
  J2A.noAcertoS2A(h, bicho({ raridade: 'raro' }), efD, { agora: h.clock, rng: () => 0, doTotem: true });
  // (o modificador de outro lugar — o Aprendizado Inspirado — não é do Decapitar)
  const outro = { stat: 'fire_res', valor: 10, ate: h.clock + 1000 };
  assert.equal(S2A.renovarDoDecapitar({ a: outro }, { somaMs: 5000, tetoMs: 20_000 }, h.clock), 0);
  assert.equal(outro.ate, h.clock + 1000);
});

test('D2: a Transfusão — a cada 200 de Vida gasta no custo inicial, uma alma no lacaio mais perto a até 3 casas, mesmo sem o Devorador de Almas', { skip: SEM }, () => {
  const agora = 50_000;
  const perto = { uid: 'l1', hp: 100, x: 12, y: 10, z: 0, buffs: {} };
  const longe = { uid: 'l2', hp: 100, x: 14, y: 10, z: 0, buffs: {} };
  const totem = { uid: 't', hp: 100, x: 10, y: 10, z: 0, tipo: 'totem', buffs: {} };
  const hunt = { pos: { x: 10, y: 10 }, z: 0, clock: agora, lacaios: [longe, totem, perto] };
  const e = J2A.doUsoS2A({}, hunt, { transfusaoVidaPorAlma: 200 }, { vida: 450, agora });
  assert.ok(e);
  assert.equal(perto.almas.n, 2);
  assert.equal(longe.almas, undefined);
  assert.equal(totem.almas, undefined);
  assert.equal(hunt.poeTransfusaoS2A, 50, 'o que passou fica para a próxima');
  // (+5% de velocidade de ataque e conjuração por alma, sem o buff)
  assert.equal(LacaiosPoe.velocidadeDoLacaio(perto, agora), 10);
  J2A.doUsoS2A({}, hunt, { transfusaoVidaPorAlma: 200 }, { vida: 150, agora: agora + 100 });
  assert.equal(Cond.almasDoLacaio(perto, agora + 100), 3);
  // (sem alma nova Recentemente — 4 s —, perde 1 a cada 0,5 s)
  assert.equal(Cond.almasDoLacaio(perto, agora + 100 + 4000 + 1000), 1);
  // (o lacaio a mais de 3 casas não ganha)
  const so = { pos: { x: 10, y: 10 }, z: 0, lacaios: [longe] };
  J2A.doUsoS2A({}, so, { transfusaoVidaPorAlma: 200 }, { vida: 400, agora });
  assert.equal(longe.almas, undefined);
});

test('D2: de ponta a ponta — a Convocação de Espíritos Furiosos com a Transfusão paga em Vida (+10% com a qualidade 20)', { skip: SEM }, async () => {
  const gasto = async (q) => {
    const s = await montar(['Summon_Raging_Spirit', 'Transfusion_Support'], { qualidade: q });
    const antes = { hp: s.e.hp, mana: s.e.mana };
    const { r } = usar(s.e, s.b);
    assert.ok(r.ok, JSON.stringify(r));
    return { hp: antes.hp - s.e.hp, mana: antes.mana - s.e.mana, e: s.e };
  };
  const q0 = await gasto(0);
  const q20 = await gasto(20);
  assert.ok(q0.hp > 0, `paga em Vida: ${q0.hp}`);
  assert.equal(q0.mana, 0);
  assert.ok(Math.abs(q20.hp / q0.hp - 1.1) < 0.02, `${q0.hp} → ${q20.hp}`);
});

test('D2: a Tentação Vaal — o uso da Vaal suportada põe o Dano Físico degenerativo em você pelo Impedimento de Ganho de Almas da gema', { skip: SEM }, async () => {
  assert.equal(S2A.impedimentoDasProps(G.textosDaGema('Vaal_Molten_Strike', 20).props), 3000);
  const hunt = { clock: 1000 };
  assert.equal(J2A.tentacaoVaalNoUso(hunt, { tentacaoVaalPorS: 1300 }, { vaal: false, impedimentoMs: 3000, agora: 1000 }), null, 'não Vaal');
  assert.ok(J2A.tentacaoVaalNoUso(hunt, { tentacaoVaalPorS: 1300 }, { vaal: true, impedimentoMs: 3000, agora: 1000 }));
  const d = hunt.efeitosDoJogador.dots.find((x) => x.chave === 'tentacaoVaal');
  assert.equal(d.tipo, 'degenFisico');
  assert.equal(d.falta, 3900);
  assert.equal(d.ate, 4000);
  // (não briga com o degenerativo da Fúria Sangrenta — sem chave: os dois valem)
  const Dot = await import('../systems/combate/dot.mjs');
  Dot.aplicarNoJogador(hunt, { tipo: 'degenFisico', total: 100, duracaoMs: 500, origem: { fonte: 'proprio', mob: 'Fúria Sangrenta' } }, 1000);
  assert.equal(hunt.efeitosDoJogador.dots.length, 2);
  assert.equal(d.falta, 3900);
});

test('D2: de ponta a ponta — o Golpe Fundido Vaal com a Tentação Vaal: o uso põe 1500/s (o nível 1) por 3 s em você', { skip: SEM }, async () => {
  const s = await montar(['Vaal_Molten_Strike', 'Vaal_Temptation_Support'], { arma: 'One_Hand_Swords/Rusted_Sword', vocacao: 'knight', classe: 'Scion', nivel: 1 });
  const efV = GS.efeitoNaSkill(s.e, G.doSlug('Vaal_Molten_Strike').acao);
  assert.equal(efV.tentacaoVaalPorS, 1500);
  const { r } = usar(s.e, s.b);
  assert.ok(r.ok, JSON.stringify(r));
  const d = (s.e.hunt.efeitosDoJogador?.dots ?? []).find((x) => x.chave === 'tentacaoVaal');
  assert.ok(d, 'a Tentação em você');
  assert.equal(d.falta, 4500);
});

// (revisão F2, decisão nova do dono 27/10 — revoga a do D2: a reserva é como a do PoB, o custo base × as Minas da gema plantadas AGORA — CalcPerform.lua, activeMineCount)
test('D2: a Mina da Cadeia Explosiva reserva o custo base da gema por Mina plantada (o PoB); sem mina plantada, nada; cada mina sai sem custo', { skip: SEM }, async () => {
  const s = await montar(['Fireball', 'Blastchain_Mine_Support']);
  const e = s.e;
  const acao = G.doSlug('Fireball').acao;
  const base = G.custoNoNivel('Fireball', 20);
  const manaAntes = e.mana;
  // (você andando: as minas ficam plantadas — parado, com o inimigo colado, elas detonam na hora)
  (e.hunt.poeRecente ??= {}).moveu = Number.MAX_SAFE_INTEGER;
  const { r } = usar(e, s.b);
  assert.ok(r.ok, JSON.stringify(r));
  const b = e.hunt.buffs[acao];
  assert.ok(b?.reserva, 'liga a reserva');
  assert.equal(b.reserva.recurso, 'mana');
  assert.equal(b.reserva.fixo, base);
  const ficha = Ficha.combate(e);
  const eficacia = ['eficiencia_reserva', 'eficiencia_reserva_mana', 'eficiencia_reserva_minas'].reduce((t, k) => t + Cond.valor(ficha, k), 0);
  const esperado = Math.ceil(base * 0.65 / (1 + eficacia / 100));
  assert.equal(Reserva.reservadas(e).mana, esperado, `${base} × 65% (o Multiplicador de Custo & Reserva) ÷ a eficácia`);
  assert.equal(e.mana, Math.min(manaAntes, e.maxMana - esperado), 'a mina sai sem custo: só a parte reservada sai da mana');
  assert.equal(Plantadas.plantadas(e.hunt, 'mina').length, 1);
  // (a segunda mina, 1 s depois — a primeira dura 5 s: sem custo; a reserva vira a de duas)
  usar(e, s.b, 0.5, 1000);
  assert.equal(Plantadas.plantadas(e.hunt, 'mina').length, 2);
  assert.equal(Reserva.reservadas(e).mana, 2 * esperado);
  assert.equal(e.mana, Math.min(manaAntes, e.maxMana - 2 * esperado));
  // (a gema fora da barra: a reserva sai)
  e.actions[0] = null;
  Acoes.desligarAurasForaDaBarra(e, e.hunt);
  assert.equal(Reserva.reservadas(e).mana, 0);
});

test('D2 (revisão F2): as Minas detonadas saem da reserva — sem mina plantada, nada reservado (o buff segue ligado)', { skip: SEM }, async () => {
  const s = await montar(['Fireball', 'Blastchain_Mine_Support']);
  const e = s.e;
  const acao = G.doSlug('Fireball').acao;
  (e.hunt.poeRecente ??= {}).moveu = Number.MAX_SAFE_INTEGER;
  assert.ok(usar(e, s.b).r.ok);
  assert.ok(Reserva.reservadas(e).mana > 0);
  // (parado, com o inimigo colado: a sequência detona as plantadas)
  e.hunt.poeRecente.moveu = -Infinity;
  for (let i = 0; i < 20 && Plantadas.plantadas(e.hunt, 'mina').length; i++) { e.hunt.clock += 500; travado(0.5, () => Acoes.tiqueDasPlantadas(e, e.hunt, PERSONAGEM, [], e.hunt.clock)); }
  assert.equal(Plantadas.plantadas(e.hunt, 'mina').length, 0);
  assert.ok(e.hunt.buffs[acao]?.reserva);
  assert.equal(Reserva.reservadas(e).mana, 0);
});

test('D2: a Mina da Cadeia Explosiva sem mana livre para reservar não sai', { skip: SEM }, async () => {
  const s = await montar(['Fireball', 'Blastchain_Mine_Support']);
  s.e.maxMana = s.e.mana = 1;
  Ficha.invalidar(s.e);
  s.e.maxMana = s.e.mana = 1;
  const r = travado(0.5, () => Acoes.disparar(s.e, s.e.hunt, PERSONAGEM, 0, s.b, { manual: true }));
  assert.equal(r.ok, false);
  assert.equal(r.motivo, 'RESERVA');
});

test('D2: a Mina de Alto Impacto — 2% de chance de Dano Dobrado por mina a até 3 casas do inimigo, até 100%; o sorteio por acerto', { skip: SEM }, async () => {
  const b = { x: 10, y: 10, z: 0 };
  const mina = (x, y) => ({ x, y, z: 0, porMina: 2, teto: 100, efeito: 1 });
  assert.equal(S2A.dobroDasMinasNoAlvo(b, [mina(10, 10), mina(13, 10), mina(14, 10)]), 4, 'a de 4 casas não conta');
  assert.equal(S2A.dobroDasMinasNoAlvo(b, Array.from({ length: 60 }, () => mina(11, 11))), 100, 'até 100%');
  assert.equal(S2A.fatorDoDobroDasMinas(6, {}, () => 0.059), 2);
  assert.equal(S2A.fatorDoDobroDasMinas(6, {}, () => 0.06), 1);
  assert.equal(S2A.fatorDoDobroDasMinas(6, { jaDobrado: true }, () => 0), 1, 'o uso já Dobrado não dobra de novo');
  assert.equal(S2A.fatorDoDobroDasMinas(6, { jaPct: 50 }, () => 0.119), 2, 'as chances somam: (56 − 50) ÷ 50 = 12% do que sobrou');
  assert.equal(S2A.fatorDoDobroDasMinas(6, { jaPct: 50 }, () => 0.121), 1);
  // no jogo: 3 minas plantadas perto do inimigo → 6% nele (o tique das plantadas)
  const s = await montar(['Fireball', 'High-Impact_Mine_Support']);
  const h = s.e.hunt;
  for (let i = 0; i < 3; i++) Plantadas.plantar(h, Ficha.combate(s.e), { tipo: 'mina', acao: s.e.actions[0].id, slot: 0, x: s.b.x + 1, y: s.b.y, duracaoMs: 5000, agora: h.clock });
  Acoes.tiqueDasPlantadas(s.e, h, PERSONAGEM, [], h.clock);
  const efeitoAura = 1 + Cond.valor(Ficha.combate(s.e), 'efeito_aura_mina') / 100;
  assert.ok(Math.abs(s.b.estados.minaDobro.pct - 6 * efeitoAura) < 1e-9, JSON.stringify(s.b.estados.minaDobro));
});

// (a Bola de Fogo: o Fogo não passa pela armadura do monstro, que tira menos do golpe maior — o dobro sai inteiro)
test('D2: de ponta a ponta — a Bola de Fogo no inimigo com 100% de Dano Dobrado das Minas sai com o dobro do dano', { skip: SEM }, async () => {
  const golpe = async (dobro) => {
    const s = await montar(['Fireball']);
    if (dobro) s.b.estados.minaDobro = { ate: s.e.hunt.clock + 60_000, pct: 100 };
    return danoEm(usar(s.e, s.b, 0.5).eventos, s.b);
  };
  const sem = await golpe(false);
  const com = await golpe(true);
  assert.ok(sem > 0);
  assert.ok(Math.abs(com / sem - 2) < 0.02, `${sem} → ${com}`);
});
