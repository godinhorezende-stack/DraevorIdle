// (lote S2A, 27/10) OS SUPORTES COM MECÂNICA NOVA (a primeira metade da fila S2): o Excomungar, o Toque Definhador, a Santificação, o Rompimento, o Traumatismo, a
// Inspiração, a Fonte de Vida, o Combate Próximo, as Armadilhas Múltiplas e as Agrupadas (a área de ativação), o Chamado Abençoado, o Marcar ao Acertar e o Decapitar.
// Os sorteios ficam travados.
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
const S2A = await import('../systems/itens-poe/suportes-s2a.mjs');
const J2A = await import('../systems/itens-poe/suportes-s2a-jogo.mjs');
const Dot = await import('../systems/combate/dot.mjs');
const Plantadas = await import('../systems/itens-poe/armas-plantadas.mjs');
const QuemFeriu = await import('../systems/hunt/quem-feriu.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
await import('../systems/itens-poe/aprendizado-inspirado.mjs');

let J;
let gerarPeca;
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
const perto = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
function travado(v, fn) {
  const antes = Math.random;
  Math.random = () => v;
  try { return fn(); } finally { Math.random = antes; }
}
const doSlug = (s) => G.doSlug(s) ?? SP.doSlug(s);
const TAGS = (...t) => ({ tags: t.map((x) => `poe:${x}`) });
const ef = (slug, nivel = 20, q = 0, tags = TAGS('Magia', 'Ataque', 'Projétil', 'Área', 'Corpo a Corpo', 'Fogo', 'Gelo', 'Raio', 'Caos', 'Físico', 'Duração', 'Clamor', 'Armadilha', 'Marca')) => SP.efeitoNoNivel(slug, nivel, q, tags).efeito;
/** O personagem com as gemas na arma, numa caçada; o alvo imortal colado e os outros longe. */
async function montar(slugs, { arma = 'One_Hand_Swords/Rusted_Sword', nivel = 20, qualidade = 0, links = null } = {}) {
  J ??= await import('../systems/itens-poe/jogo.mjs');
  gerarPeca ??= (await import('../systems/itens-poe/gerar.mjs')).gerarPeca;
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Scion', sistema: 'poe' });
  const a = peca(arma);
  a.soquetes = { abertos: slugs.length, links: links ?? Array(Math.max(0, slugs.length - 1)).fill(true), gemas: Array(slugs.length).fill(null), cores: Array(slugs.length).fill('W') };
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
  e.mana = e.maxMana = 1e7;
  e.maxHp = e.hp = 1e7;
  const [b, ...resto] = e.hunt.monstros;
  for (const m of resto) Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60, hp: 1e12, maxHp: 1e12 });
  Object.assign(b, { x: e.hunt.pos.x + 1, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12, estados: {}, dots: [] });
  return { e, b, resto };
}
/** Usa a gema do slot 0 no alvo `b` (com a conjuração concluída), com o sorteio travado em `v`; devolve os eventos. */
function usar(e, b, v = 0.5) {
  const eventos = [];
  const r = travado(v, () => Acoes.disparar(e, e.hunt, { nome: 'T' }, 0, b, { manual: true }));
  assert.ok(r.ok, JSON.stringify(r));
  eventos.push(...(r.eventos ?? []));
  if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; eventos.push(...(travado(v, () => Acoes.concluirConjuracao(e, e.hunt, { nome: 'T' })) ?? [])); }
  return eventos;
}
const bicho = (extra = {}) => ({ uid: 'b' + Math.random(), name: 'Alvo', x: 10, y: 10, z: 0, hp: 1e6, maxHp: 1e6, estados: {}, dots: [], ...extra });

const FEITOS = ['Excommunicate_Support', 'Withering_Touch_Support', 'Hallow_Support', 'Rupture_Support', 'Trauma_Support', 'Inspiration_Support', 'Lifetap_Support', 'Close_Combat_Support',
  'Multiple_Traps_Support', 'Cluster_Traps_Support', 'Blessed_Call_Support', 'Mark_On_Hit_Support', 'Corrupting_Cry_Support', 'Bloodsoaked_Banner_Support', 'Manaforged_Arrows_Support', 'Companionship_Support'];
test('S2A: os suportes da fila feitos saem de "parcial"; o Decapitar fica só com a renovação (a decisão do dono)', { skip: SEM }, () => {
  const falhas = FEITOS.filter((s) => SP.doSlug(s)?.status !== 'funciona').map((s) => `${s}: ${SP.doSlug(s)?.status} ${(SP.doSlug(s)?.motivos ?? []).join(' | ')}`);
  assert.deepEqual(falhas, [], falhas.join('\n'));
  const d = SP.doSlug('Behead_Support');
  assert.equal(d.status, 'parcial');
  assert.ok(d.motivos.length === 1 && /renovar a Duração do Modificador/.test(d.motivos[0]), d.motivos.join(' | '));
});

test('S2A: os números das linhas no nível 20 (com a qualidade 20)', { skip: SEM }, () => {
  assert.equal(ef('Excommunicate_Support').excomungarMs, 3000);
  assert.deepEqual([ef('Withering_Touch_Support').definharChancePct, ef('Withering_Touch_Support').definharMs, ef('Withering_Touch_Support')['af:phys_as_extra_chaos']], [25, 2000, 29]);
  assert.deepEqual([ef('Hallow_Support', 20, 20).chamaSantificada, ef('Hallow_Support', 20, 20).chamaEfeitoPct], [1, 46], '36% do nível + 10% da qualidade');
  const r = ef('Rupture_Support');
  assert.deepEqual([r.rompimento, r.rompimentoMaisPct, r.rompimentoRapidoPct], [1, 29, 25]);
  const t = ef('Trauma_Support');
  assert.deepEqual([t.traumaFisicoMin, t.traumaFisicoMax, t.traumaAtordoamentoPct, t.traumaGanho, t.traumaDano, t.traumaMs], [10, 17, 5, 1, 146, 6900]);
  const i = ef('Inspiration_Support');
  assert.deepEqual([i.inspiracao, i.inspiracaoCritPct, i.inspiracaoElementalMaisPct, i.inspiracaoPerdeEm, i.maisDanoPct], [1, 8, 5, 800, undefined], 'o "5% mais Dano Elemental por Carga" não é mais 5% fixo em todo o dano');
  const l = ef('Lifetap_Support', 20, 20);
  assert.deepEqual([l.custoEmVida, l.fonteDeVidaApos, l.fonteDeVidaMs, l['af:mais_dano@buff:fonteDeVida'], l.maisDanoPct], [1, 273, 6000, 19, undefined], 'o "19% mais Dano" só com a Fonte de Vida');
  assert.deepEqual([ef('Close_Combat_Support').impetoMs, ef('Close_Combat_Support').impetoVelPct], [2000, 20]);
  assert.equal(ef('Multiple_Traps_Support', 20, 20).ativacaoArmadilhaIncPct, 20);
  assert.equal(ef('Cluster_Traps_Support', 20, 20).ativacaoArmadilhaIncPct, 20);
  const bc = ef('Blessed_Call_Support');
  assert.ok(perto(bc.recargaPct, (1 / 0.8 - 1) * 100), 'a recarga reduzida em 20%: 25% mais tempo');
  assert.deepEqual([bc.clamorSoloSagradoMs, bc.clamorAreaIncPct], [6000, -40]);
  assert.equal(ef('Mark_On_Hit_Support', 20, 20).efeitoMaldicaoPct, -16, '−21% do nível + 5% da qualidade');
  assert.deepEqual(SP.fichaNoNivel('Mark_On_Hit_Support', 20).gatilho, { quando: 'acertoRaro', recargaMs: 4000 });
  assert.equal(ef('Behead_Support').decapitarS, 20);
});

test('S2A: no acerto — o Excomungado (corpo a corpo, × a Duração), o Definhado na chance, a Chama Santificada, o Rompimento e o Ímpeto de Combate', { skip: SEM }, () => {
  const agora = 10_000;
  const hunt = { clock: agora, z: 0, pos: { x: 0, y: 0 }, monstros: [] };
  const b = bicho();
  J2A.noAcertoS2A(hunt, b, { excomungarMs: 3000 }, { corpo: false, agora });
  assert.equal(b.estados.excomungado, undefined, 'só corpo a corpo');
  J2A.noAcertoS2A(hunt, b, { excomungarMs: 3000 }, { corpo: true, fatorDur: 1.5, agora });
  assert.equal(b.estados.excomungado.ate, agora + 4500);
  J2A.noAcertoS2A(hunt, b, { definharChancePct: 25, definharMs: 2000 }, { agora, rng: () => 0.3 });
  assert.equal(b.estados.definhado, undefined, 'acima dos 25%');
  J2A.noAcertoS2A(hunt, b, { definharChancePct: 25, definharMs: 2000 }, { agora, rng: () => 0.2 });
  assert.deepEqual([b.estados.definhado.ate, b.estados.definhado.n], [agora + 2000, 1]);
  J2A.noAcertoS2A(hunt, b, { chamaSantificada: 1, chamaEfeitoPct: 46 }, { corpo: true, agora, ficha: { afPoe: {} } });
  assert.equal(b.estados.chamas.length, 1);
  assert.ok(perto(b.estados.chamas[0].pct, 25 * 1.46), 'a Chama do PoE: 25% do Físico como Fogo, × a Intensidade');
  const doTotem = bicho();
  J2A.noAcertoS2A(hunt, doTotem, { chamaSantificada: 1 }, { corpo: true, doTotem: true, agora });
  assert.equal(doTotem.estados.chamas, undefined, 'o totem não põe a Chama');
  const rup = { rompimento: 1, rompimentoMaisPct: 29, rompimentoRapidoPct: 25 };
  J2A.noAcertoS2A(hunt, b, rup, { crit: false, postos: ['sangrando'], agora });
  assert.equal(S2A.rompimentosAgora(b, agora), 0, 'sem crítico, sem Rompimento');
  J2A.noAcertoS2A(hunt, b, rup, { crit: true, postos: [], agora });
  assert.equal(S2A.rompimentosAgora(b, agora), 0, 'o crítico que não pôs Sangramento');
  for (let k = 0; k < 6; k++) J2A.noAcertoS2A(hunt, b, rup, { crit: true, postos: ['sangrando'], agora: agora + k });
  assert.equal(S2A.rompimentosAgora(b, agora + 10), 4, 'até 4 acúmulos');
  assert.equal(S2A.rompimentosAgora(b, agora + 3004), 1, 'cada um dura 3 s');
  J2A.noAcertoS2A(hunt, b, { impetoMs: 2000, impetoVelPct: 20 }, { fatorDur: 1, agora });
  assert.equal(hunt.poeBuffs.impetoDeCombate, agora + 2000);
  assert.equal(hunt.poeImpetoVelS2A, 20);
});

test('S2A: o Rompimento no Sangramento — 2 acúmulos: o pulso × 1,5 (expira 25% mais rápido cada) e o dano × 1,58 (29% mais cada); o mesmo total sai em menos tempo', { skip: SEM }, () => {
  const agora = 0;
  const rodar = (comRompimento) => {
    const m = bicho({ x: 1, y: 1, maxHp: 1e9, hp: 1e9 });
    if (comRompimento) { S2A.porRompimento(m, { maisPct: 29, rapidoPct: 25 }, agora); S2A.porRompimento(m, { maisPct: 29, rapidoPct: 25 }, agora); m.estados.rompimento.fins = [1e9, 1e9]; }
    Dot.aplicar(m, { tipo: 'sangramento', total: 5000, duracaoMs: 5000, origem: { fonte: 'gema' } }, agora);
    const hunt = { clock: 0, z: 0, pos: { x: 0, y: 0 }, monstros: [m] };
    const primeiro = 1e9 - m.hp;
    Dot.tique(hunt, [], 1000);
    const pulso = 1e9 - m.hp - primeiro;
    for (let t = 2000; t <= 7000; t += 1000) Dot.tique(hunt, [], t);
    return { pulso, total: 1e9 - m.hp, fim: (m.dots ?? []).length };
  };
  const sem = rodar(false);
  const com = rodar(true);
  assert.ok(perto(com.pulso, sem.pulso * 1.5 * 1.58, 0.02), JSON.stringify({ sem, com }));
  assert.ok(perto(com.total, sem.total * 1.58, 0.02), 'o total de antes da resistência é o mesmo; os 29% por acúmulo vão por cima');
  assert.equal(Dot.rompimento(bicho(), 0), null);
});

test('S2A: o uso pago — a Inspiração (as cargas de antes valem; zera após 800 de Mana), a Fonte de Vida (273 de Vida gasta) e o Traumatismo do suporte', { skip: SEM }, () => {
  const hunt = { clock: 1000 };
  const ins = { inspiracao: 1, inspiracaoCritPct: 8, inspiracaoElementalMaisPct: 5, inspiracaoPerdeEm: 800, critChance: 1 };
  let e1 = J2A.doUsoS2A(null, hunt, ins, { mana: 100 });
  assert.equal(e1, ins, 'sem carga ainda: o mesmo efeito');
  assert.deepEqual(hunt.poeInspiracaoS2A, { n: 1, gasto: 100 });
  for (let k = 0; k < 5; k++) J2A.doUsoS2A(null, hunt, ins, { mana: 100 });
  assert.deepEqual(hunt.poeInspiracaoS2A, { n: 5, gasto: 600 }, 'até 5 cargas');
  e1 = J2A.doUsoS2A(null, hunt, ins, { mana: 100 });
  assert.ok(perto(e1.critChance, 1 + (8 * 5) / 20));
  assert.ok(perto(e1['af:mais_dano_elemental'], 25));
  J2A.doUsoS2A(null, hunt, ins, { mana: 100 });
  assert.deepEqual(hunt.poeInspiracaoS2A, { n: 0, gasto: 0 }, 'os 800 de Mana: perde todas');
  assert.deepEqual(S2A.inspiracaoAposGastar({ n: 2, gasto: 10 }, 0, 800), { n: 2, gasto: 10 }, 'o uso que não gasta Mana não dá carga');
  const fonte = { fonteDeVidaApos: 273, fonteDeVidaMs: 6000 };
  J2A.doUsoS2A(null, hunt, fonte, { vida: 200, fatorDur: 1.5 });
  assert.equal(hunt.poeBuffs?.fonteDeVida, undefined);
  J2A.doUsoS2A(null, hunt, fonte, { vida: 100, fatorDur: 1.5 });
  assert.equal(hunt.poeBuffs.fonteDeVida, 1000 + 9000, '6 s × a Duração');
  assert.equal(hunt.poeFonteDeVidaS2A, 27, 'o que passou do limite fica na conta');
  const tr = J2A.doUsoS2A(null, hunt, { traumaFisicoMin: 10, traumaFisicoMax: 17, traumaAtordoamentoPct: 5 }, { traumas: 3 });
  assert.deepEqual([tr['somadoMin:physical'], tr['somadoMax:physical'], tr['af:stun_duration']], [30, 51, 15]);
});

test('S2A: de ponta a ponta — o Golpe Pesado com o Excomungar excomunga; com a Santificação põe a Chama; com o Toque Definhador (o sorteio baixo) Definha', { skip: SEM }, async () => {
  const x = await montar(['Heavy_Strike', 'Excommunicate_Support']);
  usar(x.e, x.b);
  assert.ok(x.b.estados.excomungado?.ate > x.e.hunt.clock, JSON.stringify(x.b.estados));
  const h = await montar(['Heavy_Strike', 'Hallow_Support']);
  usar(h.e, h.b);
  assert.equal((h.b.estados.chamas ?? []).length, 1, JSON.stringify(h.b.estados));
  const w = await montar(['Heavy_Strike', 'Withering_Touch_Support']);
  usar(w.e, w.b, 0.1);
  assert.ok(w.b.estados.definhado?.n >= 1, JSON.stringify(w.b.estados));
});

test('S2A: de ponta a ponta — a Inspiração ganha uma carga por uso que gasta Mana; a Fonte de Vida vem depois de 273 de Vida gasta no custo', { skip: SEM }, async () => {
  const i = await montar(['Fireball', 'Inspiration_Support']);
  usar(i.e, i.b); i.e.hunt.clock += 5000; usar(i.e, i.b);
  assert.equal(i.e.hunt.poeInspiracaoS2A?.n, 2, JSON.stringify(i.e.hunt.poeInspiracaoS2A));
  const l = await montar(['Fireball', 'Lifetap_Support']);
  let usos = 0;
  while (!(l.e.hunt.poeBuffs?.fonteDeVida > l.e.hunt.clock) && usos < 100) { usar(l.e, l.b); l.e.hunt.clock += 3000; usos++; }
  assert.ok(usos > 0 && usos < 100, `a Fonte de Vida em ${usos} usos`);
  assert.ok(l.e.mana === 1e7, 'o custo saiu da Vida');
});

test('S2A: o Ímpeto de Combate — 20% mais Velocidade de Ataque no Deslocamento de ataque não suportado pelo Combate Próximo; usá-lo tira o Ímpeto', { skip: SEM }, async () => {
  const s = await montar(['Leap_Slam']);
  const entry = Acoes.POR_ID_PUBLICO(G.doSlug('Leap_Slam').acao);
  const efeito = GS.efeitoNaSkill(s.e, entry.id);
  const sem = Acoes.temposDaGemaPoe(s.e, entry, efeito).uso;
  s.e.hunt.poeBuffs = { impetoDeCombate: s.e.hunt.clock + 2000 };
  s.e.hunt.poeImpetoVelS2A = 20;
  const com = Acoes.temposDaGemaPoe(s.e, entry, efeito).uso;
  assert.ok(perto(com, sem / 1.2, 0.02), JSON.stringify({ sem, com }));
  assert.ok(perto(Acoes.temposDaGemaPoe(s.e, entry, { ...efeito, impetoMs: 2000 }).uso, sem, 0.02), 'suportado pelo Combate Próximo: sem o bônus');
  const golpe = Acoes.POR_ID_PUBLICO(G.doSlug('Heavy_Strike').acao);
  assert.equal(J2A.fatorDoImpetoNoUso(s.e.hunt, { deslocamento: false, ataque: true, ef: {} }), 1, 'o que não é Deslocamento');
  assert.ok(golpe);
  assert.ok(J2A.tirarImpeto(s.e.hunt));
  assert.equal(s.e.hunt.poeBuffs.impetoDeCombate, undefined);
});

test('S2A: as Armadilhas — o raio de ativação da Armadilha suportada (2 casas) pega o inimigo que a de 1 casa não pega', { skip: SEM }, () => {
  const agora = 1000;
  const longe = bicho({ x: 12, y: 10 });
  const hunt = { clock: agora, z: 0, pos: { x: 0, y: 0 }, monstros: [longe], plantadas: [] };
  const p = Plantadas.plantar(hunt, { afPoe: {} }, { tipo: 'armadilha', acao: 'x', slot: 0, x: 10, y: 10, z: 0, duracaoMs: 4000, agora });
  assert.equal(Plantadas.armadilhasQueAtivam(hunt, { afPoe: {} }, agora).length, 0);
  p.raioDeAtivacao = 2;
  assert.equal(Plantadas.armadilhasQueAtivam(hunt, { afPoe: {} }, agora).length, 1);
});

test('S2A: de ponta a ponta — a Armadilha de Urso com as Armadilhas Múltiplas (qualidade 20) tem o raio de ativação sorteado em 1 ou 2 casas (+20% de área: √1,2 − 1 ≈ 9,5% de chance)', { skip: SEM }, async () => {
  // (o alvo é um boneco — o boneco não ativa Armadilha —, para a Armadilha ficar plantada e o raio dela ser visto)
  const s = await montar(['Bear_Trap', 'Multiple_Traps_Support'], { qualidade: 20 });
  s.b.dummy = true;
  usar(s.e, s.b, 0.05);
  const minhas = (s.e.hunt.plantadas ?? []).filter((p) => p.tipo === 'armadilha');
  assert.ok(minhas.length >= 1 && minhas.every((p) => p.raioDeAtivacao === 2), JSON.stringify(minhas));
  const t = await montar(['Bear_Trap', 'Multiple_Traps_Support'], { qualidade: 20 });
  t.b.dummy = true;
  usar(t.e, t.b, 0.5);
  const outras = (t.e.hunt.plantadas ?? []).filter((p) => p.tipo === 'armadilha');
  assert.ok(outras.length >= 1 && outras.every((p) => p.raioDeAtivacao === 1), JSON.stringify(outras));
});

test('S2A: de ponta a ponta — o Clamor Intimidador com o Chamado Abençoado cria o Solo Sagrado em volta de você e tem o raio menor', { skip: SEM }, async () => {
  const s = await montar(['Intimidating_Cry', 'Blessed_Call_Support']);
  const entry = Acoes.POR_ID_PUBLICO(G.doSlug('Intimidating_Cry').acao);
  const comSuporte = travado(0.99, () => Acoes.raioDoClamor(s.e, entry, 6));
  const sem = await montar(['Intimidating_Cry']);
  const semSuporte = travado(0.99, () => Acoes.raioDoClamor(sem.e, Acoes.POR_ID_PUBLICO(G.doSlug('Intimidating_Cry').acao), 6));
  assert.ok(comSuporte < semSuporte, JSON.stringify({ comSuporte, semSuporte }));
  usar(s.e, s.b);
  const solo = (s.e.hunt.solosSagrados ?? []).find((x) => x.fonte === entry.id);
  assert.ok(solo && solo.ate > s.e.hunt.clock, JSON.stringify(s.e.hunt.solosSagrados));
});

test('S2A: de ponta a ponta — o Marcar ao Acertar: o Golpe Pesado no Raro Ativa a Marca do Assassino ligada (4 s de recarga); no Normal, não', { skip: SEM }, async () => {
  const n = await montar(['Heavy_Strike', 'Mark_On_Hit_Support', 'Assassins_Mark']);
  const marca = G.doSlug('Assassins_Mark').acao;
  // (no jogo a Marca conjurada liga o buff dela e os seus acertos marcam — `Reforcos.marcarCom`)
  usar(n.e, n.b);
  assert.ok(!(n.e.hunt.buffs?.[marca]?.ate > n.e.hunt.clock), 'o Normal não ativa');
  const r = await montar(['Heavy_Strike', 'Mark_On_Hit_Support', 'Assassins_Mark']);
  r.b.raridade = 'raro';
  const ev = usar(r.e, r.b);
  assert.ok(ev.some((x) => x.t === 'gatilho' && x.suporte === 'Marcar ao Acertar'));
  assert.ok(r.e.hunt.buffs?.[marca]?.ate > r.e.hunt.clock, JSON.stringify(Object.keys(r.e.hunt.buffs ?? {})));
  assert.equal(r.e.hunt.cooldowns?.['gatilho:weapon:1']?.total, 4000, 'a recarga do suporte');
});

test('S2A: o Decapitar — o golpe final seu da Habilidade de Golpe com arma corpo a corpo num Raro dá um dos Modificadores dele por 20 s', { skip: SEM }, async () => {
  const s = await montar(['Heavy_Strike', 'Behead_Support']);
  const h = s.e.hunt;
  const morto = (extra = {}) => { const b = bicho({ hp: 0, raridade: 'raro', mods: ['poe:Sem_Frostweaver'], ...extra }); QuemFeriu.carimbar(b, QuemFeriu.VOCE); return b; };
  assert.deepEqual(J2A.abatesS2A(s.e, h, { decapitarS: 20 }, [morto()], { golpeCorpo: false, rng: () => 0 }), [], 'sem Golpe corpo a corpo');
  assert.deepEqual(J2A.abatesS2A(s.e, h, { decapitarS: 20 }, [morto({ raridade: 'magico' })], { golpeCorpo: true, rng: () => 0 }), [], 'o Mágico não dá');
  const antes = Ficha.combate(s.e).afPoe.ice_res ?? 0;
  assert.deepEqual(J2A.abatesS2A(s.e, h, { decapitarS: 20 }, [morto()], { golpeCorpo: true, agora: h.clock, rng: () => 0 }), ['poe:Sem_Frostweaver']);
  Ficha.invalidar(s.e);
  assert.equal((Ficha.combate(s.e).afPoe.ice_res ?? 0) - antes, 50);
  const fim = Object.values(h.poeTemporarios).map((x) => x.ate);
  assert.ok(fim.every((t) => t === h.clock + 20_000));
});

test('S2A: de ponta a ponta — o Clamor Corrompedor põe 4 Sangues Corrompidos em quem está no raio (2 s × a Duração); o ataque Impelido por ele põe mais 1 no primeiro acertado', { skip: SEM }, async () => {
  const c = ef('Corrupting_Cry_Support');
  assert.deepEqual([c.sangueClamorPorS, c.sangueClamorMs, c.sangueClamorN, c.sangueImpelirN], [691.8, 2000, 4, 1]);
  const s = await montar(['Intimidating_Cry', 'Corrupting_Cry_Support']);
  const longe = s.resto[0];
  usar(s.e, s.b);
  const sangues = (m) => (m.dots ?? []).filter((d) => d.tipo === 'sangueCorrompido' && d.falta > 0);
  assert.equal(sangues(s.b).length, 4, JSON.stringify(s.b.dots));
  assert.equal(sangues(longe).length, 0, 'fora do raio do Clamor');
  const um = sangues(s.b)[0];
  assert.ok(um.ate - s.e.hunt.clock <= 2000 * 3 && um.ate > s.e.hunt.clock, 'a duração base de 2 s');
  assert.ok(um.falta >= 691.8 * 2 * 0.5, `o dano de um: ${um.falta}`);
  const guardado = s.e.hunt.poeSangueDoImpelirS2A?.Intimidating_Cry;
  assert.equal(guardado?.n, 1);
  // (o ataque impelido pelo Clamor: mais 1 no primeiro inimigo acertado)
  const h = await montar(['Heavy_Strike']);
  h.e.hunt.impelidos = { n: 3, ate: h.e.hunt.clock + 20_000, de: 'Intimidating_Cry' };
  h.e.hunt.poeSangueDoImpelirS2A = { Intimidating_Cry: { total: 1000, ms: 2000, acao: 'x', n: 1 } };
  usar(h.e, h.b);
  assert.equal(sangues(h.b).length, 1);
  const sem = await montar(['Heavy_Strike']);
  sem.e.hunt.poeSangueDoImpelirS2A = { Intimidating_Cry: { total: 1000, ms: 2000, acao: 'x', n: 1 } };
  usar(sem.e, sem.b);
  assert.equal(sangues(sem.b).length, 0, 'sem o Impelir, nada');
});

test('S2A: de ponta a ponta — o Estandarte de Guerra com o Estandarte Ensanguentado, plantado com Valor, põe 1 Sangue Corrompido por segundo em quem está na área dele', { skip: SEM }, async () => {
  const s = await montar(['War_Banner', 'Bloodsoaked_Banner_Support'], { nivel: 3 });
  s.e.hunt.valor = { n: 50, ultimo: s.e.hunt.clock };
  s.e.hunt.poeTemEstandarte = true;
  usar(s.e, s.b);
  const b = Object.values(s.e.hunt.buffs ?? {}).find((x) => x?.estandarte);
  assert.ok(b?.estandarte?.sangue?.total > 0, JSON.stringify(b?.estandarte));
  assert.ok(b.estandarte.sangue.total >= 26.7 * (b.estandarte.valor ?? 0) * 8 * 0.5, JSON.stringify({ sangue: b.estandarte.sangue, valor: b.estandarte.valor }));
  const sangues = (m) => (m.dots ?? []).filter((d) => d.tipo === 'sangueCorrompido' && d.falta > 0).length;
  const antes = sangues(s.b);
  const agora = s.e.hunt.clock;
  J2A.tiqueS2A(s.e.hunt, [], agora + 2500);
  assert.ok(sangues(s.b) - antes >= 2, `um por segundo: ${antes} → ${sangues(s.b)}`);
});

test('S2A: de ponta a ponta — a Flecha Forjada com Mana Ativa a Flecha Dividida ligada quando a Mana gasta na Flecha Ardente (outro Ataque de Arco) passa de 300% do custo dela', { skip: SEM }, async () => {
  assert.equal(ef('Manaforged_Arrows_Support').maisPorCustoManaPct, 1);
  assert.deepEqual(SP.fichaNoNivel('Manaforged_Arrows_Support', 20).gatilho, { quando: 'manaForjada', recargaMs: 500, limiarPct: 300 });
  // (a Flecha Ardente sozinha no primeiro encaixe; a Flecha Dividida e a Forjada ligadas nos outros dois)
  const s = await montar(['Burning_Arrow', 'Split_Arrow', 'Manaforged_Arrows_Support'], { arma: 'Bows/Crude_Bow', links: [false, true] });
  const dividida = G.doSlug('Split_Arrow').acao;
  const grupo = GS.gruposComGatilho(s.e).find((g) => g.gatilho.quando === 'manaForjada');
  assert.deepEqual(grupo?.magias, [dividida], JSON.stringify(GS.gruposComGatilho(s.e)));
  let usos = 0;
  let saiu = false;
  while (!saiu && usos < 40) {
    const ev = usar(s.e, s.b);
    saiu = ev.some((x) => x.t === 'gatilho' && x.suporte === 'Flecha Forjada com Mana');
    s.e.hunt.clock += 2000;
    usos++;
  }
  assert.ok(saiu && usos > 1, `a Ativação em ${usos} usos`);
  assert.equal(s.e.hunt.poeManaForjadaS2A?.[grupo.chave], 0, 'a conta zera');
  // (o "mais" pelo custo: o uso com custo 20 leva 20% mais)
  const hunt = { clock: 0 };
  assert.ok(perto(J2A.doUsoS2A(null, hunt, { maisPorCustoManaPct: 1, fatorDeDano: 0.69 }, { custoDeMana: 20 }).fatorDeDano, 0.69 * 1.2));
});

test('S2A: o Companheirismo — os lacaios da habilidade suportada, se forem os seus únicos (o totem não conta), tomam 15% do Ataque que acerta você e sofrem −28% de dano', { skip: SEM }, async () => {
  const c = ef('Companionship_Support', 3);
  assert.deepEqual([c.companheirismoAbsorvePct, c.companheirismoDanoPct], [15, -28]);
  const s = await montar(['Raise_Zombie', 'Companionship_Support'], { nivel: 3 });
  const h = s.e.hunt;
  const zumbi = { uid: 'z', hp: 1000, maxHp: 1000, x: h.pos.x + 1, y: h.pos.y, companheirismoS2A: { acao: 'a', absorvePct: 15, danoPct: -28 } };
  const totem = { uid: 't', hp: 50, maxHp: 50, tipo: 'totem', x: h.pos.x, y: h.pos.y + 1 };
  h.lacaios = [zumbi, totem];
  assert.deepEqual(S2A.companheirismoDe(h), zumbi.companheirismoS2A);
  assert.equal(S2A.fatorDoCompanheirismo(h, zumbi), 0.72);
  const Arvore = await import('../systems/arvore.mjs');
  const fica = Arvore.danoRecebido(s.e, 1000, [], h.pos, 'T', { ficha: Ficha.combate(s.e), elemento: 'physical', ataque: true });
  assert.equal(zumbi.hp, 1000 - 150, 'os 15% do Ataque na vida do lacaio');
  assert.ok(fica <= 850, String(fica));
  Arvore.danoRecebido(s.e, 1000, [], h.pos, 'T', { ficha: Ficha.combate(s.e), elemento: 'physical' });
  assert.equal(zumbi.hp, 850, 'a magia (sem ataque) não desvia');
  // (outro lacaio de outra habilidade: não são mais os únicos)
  h.lacaios.push({ uid: 'o', hp: 10, maxHp: 10, x: 0, y: 0 });
  assert.equal(S2A.companheirismoDe(h), null);
  assert.equal(S2A.fatorDoCompanheirismo(h, zumbi), 1);
  // (de ponta a ponta: o Espírito Furioso invocado com o suporte leva os números)
  const r = await montar(['Summon_Raging_Spirit', 'Companionship_Support'], { nivel: 3 });
  r.e.hunt.lacaios = [];
  usar(r.e, r.b);
  const espiritos = (r.e.hunt.lacaios ?? []).filter((l) => l.hp > 0);
  assert.ok(espiritos.length >= 1 && espiritos.every((l) => l.companheirismoS2A?.absorvePct === 15 && l.companheirismoS2A.danoPct === -28), JSON.stringify(espiritos.map((l) => l.companheirismoS2A)));
});
