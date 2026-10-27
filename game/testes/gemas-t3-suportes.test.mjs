// (lote T3, rodada 4 das gemas — dono 27/10: "quero resolver") OS SUPORTES "implementada, sem teste próprio" da parte 3: cada um com o número do nível 20 (o das
// Excepcionais no máximo delas) conferido com a tabela do poedb salvo e o efeito medido num uso real, com e sem o suporte, com os sorteios travados.
// O que os testes acharam e o lote corrigiu (systems/itens-poe/suportes-t3.mjs):
//   - a Imolação somava o Fogo adicionado SEMPRE — agora só contra o alvo Queimando (o PoB: ActorCondition enemy Burning);
//   - o "X% da Chance de Crítico aumentada" dos Golpes Críticos Aumentados virava +X÷20 pontos no fim, e o "+2%" entrava depois dos aumentos — agora (base + 2%) × (1 + 117%);
//   - o "X% menos Duração" do Menos Duração e do Sofrimento Veloz (normal e Desperto) somava como "reduzida" — agora multiplica (o "mais" do PoB);
//   - a Reserva da Blasfêmia Desperta no nível 20 saía da faixa da propriedade (32%) — agora a da tabela (28%).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEM, Acoes, GS, G, SP, Ficha, montar, posicionar, usar, andar, golpesEm, danoEm, celula, numeros, perto, travado } from './apoio-t3.mjs';

const TAGS = (...t) => ({ tags: t.map((x) => `poe:${x}`) });
const ef = (slug, nivel = 20, tags = TAGS('Magia', 'Ataque', 'Projétil', 'Área', 'Corpo a Corpo', 'Fogo', 'Gelo', 'Raio', 'Caos', 'Físico', 'Duração', 'Maldição')) => SP.efeitoNoNivel(slug, nivel, 0, tags);
const FILA = ['Stun_Support', 'Less_Duration_Support', 'Cast_on_Melee_Kill_Support', 'Awakened_Empower_Support', 'Awakened_Multistrike_Support', 'Cold_Penetration_Support',
  'Swift_Affliction_Support', 'Awakened_Added_Cold_Damage_Support', 'Awakened_Deadly_Ailments_Support', 'Awakened_Swift_Affliction_Support', 'Increased_Critical_Strikes_Support',
  'Added_Chaos_Damage_Support', 'Immolate_Support', 'Awakened_Blasphemy_Support', 'Awakened_Increased_Area_of_Effect_Support', 'Awakened_Unleash_Support', 'Greater_Unleash_Support'];
/** O dano do uso da ativa `ativa` (com os `sup` ligados) no alvo colado, com o sorteio `v`; `prep(e, b)` antes de usar. */
async function danoDoUso(ativa, sup = [], { v = 0.5, prep = null, arma, vocacao, nivel } = {}) {
  const m = await montar([[ativa, ...sup]], { ...(arma ? { arma } : {}), ...(vocacao ? { vocacao } : {}), ...(nivel ? { nivel } : {}) });
  prep?.(m.e, m.b);
  const u = usar(m.e, m.b, { v });
  assert.ok(u.r.ok, `${ativa}: ${u.r.erro ?? u.r.motivo}`);
  return { ...m, u, golpes: golpesEm(u.eventos, m.b), dano: danoEm(u.eventos, m.b), custo: 1e7 - m.e.mana };
}
const queimando = (e, b) => { b.dots = [{ id: 'q', tipo: 'queimadura', elemento: 'fire', ate: e.hunt.clock + 1e7, falta: 1e9, porPulso: 1, proximo: e.hunt.clock + 1e7 }]; };

test('T3: os 17 suportes da fila estão "funciona", sem motivos, e nenhuma linha do nível 20 fica não feita', { skip: SEM }, async () => {
  await montar([['Fireball']]);
  for (const s of FILA) {
    const r = SP.doSlug(s);
    assert.deepEqual([s, r.status, r.motivos], [s, 'funciona', []]);
    const n = Math.min(20, SP.nivelMaximoDe(r.suporte));
    assert.deepEqual([s, ef(s, n).naoFeitas], [s, []]);
  }
});

// ---------------------------------------------------------------- Atordoar

test('T3: o Atordoar — 49% de Ponto de Atordoamento reduzido no nível 20 (o poedb); o mesmo golpe que não atordoava passa a atordoar', { skip: SEM }, async () => {
  assert.equal(numeros(celula('Stun_Support', /Ponto de Atordoamento/))[0], 49);
  assert.equal(ef('Stun_Support').efeito['af:enemy_stun_threshold_red'], 49);
  // (a chance de atordoar do PoE: 200 × dano ÷ o limiar, o limiar = a Vida máxima × (1 − o "reduzido"); a Pancada já tem 25% — os dois SOMAM, como no PoE: com a Vida
  // máxima em 12× o golpe, 200 ÷ (12 × 0,75) = 22% sem o suporte e 200 ÷ (12 × 0,26) = 64% com; multiplicados (0,75 × 0,51) seriam 44% — o sorteio em 0,5)
  const ref = await danoDoUso('Heavy_Strike', [], { arma: 'One_Hand_Swords/Rusted_Sword', vocacao: 'knight' });
  const D = ref.dano;
  assert.ok(D > 0);
  const atordoou = async (sup) => {
    const m = await montar([['Heavy_Strike', ...sup]], { arma: 'One_Hand_Swords/Rusted_Sword', vocacao: 'knight' });
    m.b.maxHp = D * 12;
    const u = usar(m.e, m.b);
    assert.ok(u.r.ok);
    assert.equal(Math.round(danoEm(u.eventos, m.b)), Math.round(D), 'o mesmo golpe');
    return (m.b.estados?.atordoado?.ate ?? 0) > m.e.hunt.clock;
  };
  assert.equal(G.textosDaGema('Heavy_Strike', 20).linhas[0], 'Ponto de Atordoamento Inimigo reduzido em 25 %');
  assert.equal(await atordoou([]), false, 'sem o suporte: 22% < 50%');
  assert.equal(await atordoou(['Stun_Support']), true, 'com: 25% + 49% de reduzido = 64% > 50%');
});

// ---------------------------------------------------------------- Menos Duração

test('T3: o Menos Duração — 19% mais Dano, 49% MENOS Duração (multiplica — o "aumentada" da árvore/peças soma à parte) e o custo × 1,3', { skip: SEM }, async () => {
  assert.deepEqual([celula('Less_Duration_Support', /mais Dano/), celula('Less_Duration_Support', /menos Duração/)].map((x) => numeros(x)[0]), [19, 49]);
  assert.deepEqual(ef('Less_Duration_Support').efeito, { custoPct: 30, maisDanoPct: 19, duracaoMaisPct: -49 });
  const sem = await danoDoUso('Spark_of_the_Nova');
  const com = await danoDoUso('Spark_of_the_Nova', ['Less_Duration_Support']);
  assert.ok(perto(com.dano, sem.dano * 1.19, 0.005), `${com.dano} ≈ ${sem.dano} × 1,19`);
  assert.ok(perto(com.custo, sem.custo * 1.3, 0.03), `custo ${com.custo} ≈ ${sem.custo} × 1,3`);
  // (a duração: × 0,51; com +50% de Duração aumentada das peças, 1,5 × 0,51 — antes 1 + 0,5 − 0,49)
  const entry = Acoes.POR_ID_PUBLICO(G.doSlug('Spark_of_the_Nova').acao);
  const efc = GS.efeitoNaSkill(com.e, entry.id);
  assert.ok(perto(Acoes.fatorDeDuracao(com.e, entry, efc), 0.51, 1e-9));
  assert.ok(perto(Acoes.fatorDeDuracao(com.e, entry, efc, 50), 1.5 * 0.51, 1e-9), 'o "menos" multiplica o aumentado');
});

// ---------------------------------------------------------------- Conjurar ao Matar Corpo a Corpo

test('T3: o Conjurar ao Matar Corpo a Corpo — o golpe corpo a corpo que mata Ativa a Bola de Fogo ligada, com 39% mais Dano Mágico (nível 20); a recarga de 0,15 s', { skip: SEM }, async () => {
  assert.equal(numeros(celula('Cast_on_Melee_Kill_Support', /mais Dano Mágico/))[0], 39);
  assert.equal(SP.fichaNoNivel('Cast_on_Melee_Kill_Support', 20).props.find(([k]) => k === 'Recarga')?.[1], '0.15 seg');
  const montarCoMK = async () => {
    const m = await montar([['Heavy_Strike', 'Cast_on_Melee_Kill_Support', 'Fireball']], { arma: 'One_Hand_Swords/Rusted_Sword', vocacao: 'knight' });
    const outro = m.resto[0];
    posicionar(m.e, [outro], [[2, 0]]);
    return { ...m, outro };
  };
  // (sem matar: nada)
  const vivo = await montarCoMK();
  const u0 = usar(vivo.e, vivo.b);
  assert.ok(u0.r.ok);
  assert.equal(u0.eventos.filter((x) => x.t === 'gatilho').length, 0, 'o golpe que não mata não Ativa');
  // (matando: a Bola de Fogo sai no outro)
  const m = await montarCoMK();
  Object.assign(m.b, { hp: 1, maxHp: 1000 });
  const u = usar(m.e, m.b);
  assert.ok(m.b.hp <= 0, 'o golpe matou');
  assert.equal(u.eventos.filter((x) => x.t === 'gatilho' && x.skill === 'Bola de Fogo').length, 1);
  const ativada = danoEm(u.eventos, m.outro);
  // (a mesma Bola de Fogo usada à mão, sem o suporte, no mesmo personagem)
  const mao = await montar([['Fireball']], { arma: 'One_Hand_Swords/Rusted_Sword', vocacao: 'knight' });
  const um = usar(mao.e, mao.b);
  assert.ok(perto(ativada, danoEm(um.eventos, mao.b) * 1.39, 0.005), `ativada ${ativada} ≈ à mão ${danoEm(um.eventos, mao.b)} × 1,39`);
});

// ---------------------------------------------------------------- Maximizar Desperto

test('T3: o Maximizar Desperto — +3 níveis no nível 4 (o máximo; a tabela do poedb: +19 no 20); a Bola de Fogo ligada sai com o dano do nível 23', { skip: SEM }, async () => {
  assert.equal(SP.nivelMaximoDe(SP.doSlug('Awakened_Empower_Support').suporte), 4);
  assert.deepEqual([4, 20].map((n) => numeros(celula('Awakened_Empower_Support', /ao Nïvel de Gemas/, n))[0]), [3, 19]);
  assert.equal(ef('Awakened_Empower_Support', 4).efeito.nivelExtra, 3);
  assert.equal(ef('Awakened_Empower_Support', 20).efeito.nivelExtra, 19);
  const sem = await danoDoUso('Fireball');
  const com = await danoDoUso('Fireball', ['Awakened_Empower_Support'], { nivel: { Fireball: 20, Awakened_Empower_Support: 4 } });
  assert.equal(GS.efeitoNaSkill(com.e, G.doSlug('Fireball').acao).nivel, 23);
  const d20 = G.danoNoNivel('Fireball', 20);
  const d23 = G.danoNoNivel('Fireball', 23);
  assert.ok(perto(com.dano / sem.dano, (d23.min + d23.max) / (d20.min + d20.max), 0.01), `${com.dano} / ${sem.dano} ≈ o dano base do nível 23 ÷ o do 20`);
});

// ---------------------------------------------------------------- Ataques Múltiplos Desperto

test('T3: os Ataques Múltiplos Despertos — 3 repetições (22/44/66% mais), 20% menos Dano de Ataque e 52% mais Velocidade de Ataque Corpo a Corpo (nível 20)', { skip: SEM }, async () => {
  assert.equal(numeros(celula('Awakened_Multistrike_Support', /mais Velocidade de Ataque/))[0], 52);
  const e20 = ef('Awakened_Multistrike_Support').efeito;
  assert.deepEqual([e20.repeticoes, e20.maisDanoAcertoPct, e20['repeticaoMaisPct:1'], e20['repeticaoMaisPct:2'], e20['repeticaoMaisPct:3']], [3, -20, 22, 44, 66]);
  const opts = { arma: 'One_Hand_Swords/Rusted_Sword', vocacao: 'knight' };
  const sem = await danoDoUso('Heavy_Strike', [], opts);
  const com = await danoDoUso('Heavy_Strike', ['Awakened_Multistrike_Support'], opts);
  assert.equal(sem.golpes.length, 1);
  assert.equal(com.golpes.length, 4, 'o golpe e 3 repetições');
  const d = sem.golpes[0].v;
  [0.8, 0.8 * 1.22, 0.8 * 1.44, 0.8 * 1.66].forEach((f, i) => assert.ok(Math.abs(com.golpes[i].v - d * f) <= 1.5, `golpe ${i}: ${com.golpes[i].v} ≈ ${d} × ${f.toFixed(3)}`));
  // (o uso dura 4 golpes, cada um 52% mais rápido)
  const t = (m) => m.e.hunt.cooldowns?.[Acoes.GRUPO_DO_POE]?.total ?? 0;
  assert.ok(perto(t(com), (t(sem) / 1.52) * 4, 0.01), `o uso: ${t(com)} ms ≈ ${t(sem)} ÷ 1,52 × 4`);
});

// ---------------------------------------------------------------- Penetração de Gelo

test('T3: a Penetração de Gelo — 34% no nível 20; contra 50% de resistência a Gelo, o golpe sai × (1 − 0,16) ÷ (1 − 0,5)', { skip: SEM }, async () => {
  assert.equal(numeros(celula('Cold_Penetration_Support', /Penetram/))[0], 34);
  assert.equal(ef('Cold_Penetration_Support').efeito['af:ice_pen'], 34);
  const prep = (e, b) => { b.resist = { ice: 50 }; };
  const sem = await danoDoUso('Ice_Nova', [], { prep });
  const com = await danoDoUso('Ice_Nova', ['Cold_Penetration_Support'], { prep });
  assert.ok(perto(com.dano, (sem.dano * 0.84) / 0.5, 0.005), `${com.dano} ≈ ${sem.dano} × 0,84 ÷ 0,5`);
});

// ---------------------------------------------------------------- Sofrimento Veloz (e o Desperto) e Afecções Mortais Desperto

test('T3: o Sofrimento Veloz (39%) e o Desperto (57%) — mais Dano Degenerativo e 25% menos Duração na Queimadura do acerto; as Afecções Mortais Despertas: 62% mais nas afecções e 80% menos no acerto', { skip: SEM }, async () => {
  assert.equal(numeros(celula('Swift_Affliction_Support', /mais Dano Degenerativo/))[0], 39);
  assert.equal(numeros(celula('Awakened_Swift_Affliction_Support', /mais Dano Degenerativo/))[0], 57);
  assert.equal(numeros(celula('Awakened_Deadly_Ailments_Support', /mais Dano de Afecções/))[0], 62);
  assert.deepEqual(ef('Awakened_Deadly_Ailments_Support').efeito, { custoPct: 40, maisAfeccaoPct: 62, maisDanoAcertoPct: -80, 'af:dot_dmg_inc': 0 });
  // (o sorteio baixo: a Bola de Fogo Incendeia)
  const queima = (r) => r.b.dots.find((d) => d.tipo === 'queimadura');
  const sem = await danoDoUso('Fireball', [], { v: 0.01 });
  const q0 = queima(sem);
  assert.ok(q0, 'a Queimadura do acerto');
  const dur = (d) => d.ate - d.desde;
  for (const [s, mais] of [['Swift_Affliction_Support', 39], ['Awakened_Swift_Affliction_Support', 57]]) {
    const r = await danoDoUso('Fireball', [s], { v: 0.01 });
    const q = queima(r);
    assert.ok(perto(r.dano, sem.dano, 1e-9), `${s}: o acerto não muda`);
    assert.equal(dur(q), dur(q0) * 0.75, `${s}: 25% menos Duração da afecção`);
    assert.ok(perto(q.falta, q0.falta * (1 + mais / 100) * 0.75, 0.002), `${s}: o total ${q.falta} ≈ ${q0.falta} × ${1 + mais / 100} × 0,75 (o mesmo por segundo × ${1 + mais / 100})`);
  }
  const mort = await danoDoUso('Fireball', ['Awakened_Deadly_Ailments_Support'], { v: 0.01 });
  assert.ok(perto(mort.dano, sem.dano * 0.2, 0.005), `o acerto ${mort.dano} ≈ ${sem.dano} × 0,2`);
  assert.equal(dur(queima(mort)), dur(q0));
  assert.ok(perto(queima(mort).falta, q0.falta * 1.62, 0.002), `a Queimadura ${queima(mort).falta} ≈ ${q0.falta} × 1,62 (do acerto antes do "menos")`);
});

// ---------------------------------------------------------------- Dano Adicional de Gelo Desperto e Dano Adicional de Caos

test('T3: o Dano Adicional de Gelo Desperto (251 a 377 e +4 níveis nas de Gelo) e o Dano Adicional de Caos (154 a 231): o adicionado × a Eficácia do Dano Adicionado da gema', { skip: SEM }, async () => {
  assert.deepEqual(numeros(celula('Awakened_Added_Cold_Damage_Support', /de Dano de Gelo adicional/)), [251, 377]);
  assert.equal(numeros(celula('Awakened_Added_Cold_Damage_Support', /Nível de Gemas de Habilidades de Gelo/))[0], 4);
  assert.deepEqual(numeros(celula('Added_Chaos_Damage_Support', /de Dano de Caos adicional/)), [154, 231]);
  const ec = ef('Awakened_Added_Cold_Damage_Support').efeito;
  assert.deepEqual([ec['somadoMin:ice'], ec['somadoMax:ice'], ec.nivelExtra], [251, 377, 4]);
  // (o Gelo Desperto: a Nova de Gelo ligada sobe 4 níveis — de Gelo — e ganha o adicionado)
  const nova = await danoDoUso('Ice_Nova', ['Awakened_Added_Cold_Damage_Support']);
  assert.equal(GS.efeitoNaSkill(nova.e, G.doSlug('Ice_Nova').acao).nivel, 24);
  const semNova = await danoDoUso('Ice_Nova');
  const b20 = G.danoNoNivel('Ice_Nova', 20);
  const b24 = G.danoNoNivel('Ice_Nova', 24);
  const efi = G.eficaciaDoAdicionado?.('Ice_Nova', 24) ?? null;
  // (o sorteio em 0,5: a média; o golpe = (base + adicionado × eficácia) × o mesmo fator)
  const fator = semNova.dano / ((b20.min + b20.max) / 2);
  const esperado = ((b24.min + b24.max) / 2 + ((251 + 377) / 2) * (efi ?? 1)) * fator;
  if (efi != null) assert.ok(perto(nova.dano, esperado, 0.02), `${nova.dano} ≈ (${(b24.min + b24.max) / 2} + 314 × ${efi}) × ${fator.toFixed(3)}`);
  else assert.ok(nova.dano > semNova.dano * ((b24.min + b24.max) / (b20.min + b20.max)), 'mais que só os níveis');
  // (o adicionado entra na mesma conta em todo nível do suporte: a diferença para a gema sem ele segue a média da faixa da tabela — o 20 contra o 5)
  const fb = await danoDoUso('Fireball');
  const dif = async (sup, n) => (await danoDoUso('Fireball', [sup], { nivel: { Fireball: 20, [sup]: n } })).dano - fb.dano;
  const media = (sup, re, n) => numeros(celula(sup, re, n)).reduce((t, x) => t + x, 0) / 2;
  for (const [sup, re] of [['Added_Chaos_Damage_Support', /de Dano de Caos adicional/], ['Awakened_Added_Cold_Damage_Support', /de Dano de Gelo adicional/]]) {
    const [d20, d5] = [await dif(sup, 20), await dif(sup, 5)];
    assert.ok(d5 > 0, `${sup}: o nível 5 também soma`);
    assert.ok(perto(d20 / d5, media(sup, re, 20) / media(sup, re, 5), 0.01), `${sup}: ${d20} ÷ ${d5} ≈ ${media(sup, re, 20)} ÷ ${media(sup, re, 5)}`);
  }
  // (a Bola de Fogo — Fogo — não sobe de nível pelo Gelo Desperto)
  const fbGelo = await danoDoUso('Fireball', ['Awakened_Added_Cold_Damage_Support']);
  assert.equal(GS.efeitoNaSkill(fbGelo.e, G.doSlug('Fireball').acao).nivel, 20);
});

// ---------------------------------------------------------------- Golpes Críticos Aumentados

test('T3: os Golpes Críticos Aumentados — 117% de Chance de Crítico aumentada e +2% (nível 20): a Nova de Gelo (7,5%) critica até (7,5 + 2) × 2,17 = 20,6%', { skip: SEM }, async () => {
  assert.equal(numeros(celula('Increased_Critical_Strikes_Support', /Chance de Crítico aumentada/))[0], 117);
  assert.deepEqual(ef('Increased_Critical_Strikes_Support').efeito, { custoPct: 20, 'af:crit_chance_inc': 117, 'af:crit_base_golpe': 2 });
  const critou = async (sup, v) => (await danoDoUso('Ice_Nova', sup, { v })).golpes.some((x) => x.crit);
  // (o sorteio do crítico e o do dano são o mesmo Math.random travado: crítico ⇔ v < a chance)
  assert.equal(await critou([], 0.07), true, 'sem: 7,5%');
  assert.equal(await critou([], 0.08), false);
  assert.equal(await critou(['Increased_Critical_Strikes_Support'], 0.2), true, 'com: 20,6%');
  assert.equal(await critou(['Increased_Critical_Strikes_Support'], 0.21), false, 'com: 20,6% (antes 7,5 + 5,85 + 2 = 15,35%)');
  // (num ataque: a base da arma + 2%, × (1 + 117%))
  const opts = { arma: 'One_Hand_Swords/Rusted_Sword', vocacao: 'knight' };
  const a = await montar([['Heavy_Strike', 'Increased_Critical_Strikes_Support']], opts);
  const f0 = Ficha.combate(a.e);
  const chanceAtaque = Math.min(1, (f0.critPontos + 0.02) * (1 + (f0.critInc + 117) / 100) * (f0.critMais ?? 1));
  const critouAtaque = async (v) => (await danoDoUso('Heavy_Strike', ['Increased_Critical_Strikes_Support'], { ...opts, v })).golpes.some((x) => x.crit);
  assert.equal(await critouAtaque(chanceAtaque - 0.004), true, `ataque: ${chanceAtaque}`);
  assert.equal(await critouAtaque(chanceAtaque + 0.004), false);
});

// ---------------------------------------------------------------- Imolação

test('T3: a Imolação — 205 a 308 de Fogo adicional (nível 20) SÓ contra o inimigo Queimando; sem a Queimadura, o golpe é o mesmo', { skip: SEM }, async () => {
  assert.deepEqual(numeros(celula('Immolate_Support', /contra Inimigos Queimando/)), [205, 308]);
  assert.deepEqual(ef('Immolate_Support').efeito, { custoPct: 20, imolacaoMin: 205, imolacaoMax: 308, 'af:fire_dmg': 0 });
  const sem = await danoDoUso('Fireball');
  const comSemQueimar = await danoDoUso('Fireball', ['Immolate_Support']);
  assert.ok(perto(comSemQueimar.dano, sem.dano, 1e-9), `sem Queimadura: ${comSemQueimar.dano} = ${sem.dano}`);
  const semQ = await danoDoUso('Fireball', [], { prep: queimando });
  const comQ = await danoDoUso('Fireball', ['Immolate_Support'], { prep: queimando });
  assert.ok(comQ.dano > semQ.dano * 1.2, `Queimando: ${comQ.dano} > ${semQ.dano}`);
  const efFb = G.eficaciaDoAdicionado?.('Fireball', 20);
  if (efFb != null) assert.ok(perto(comQ.dano / semQ.dano, 1 + (256.5 * efFb) / ((G.danoNoNivel('Fireball', 20).min + G.danoNoNivel('Fireball', 20).max) / 2), 0.03), 'o adicionado × a eficácia, na mesma escala do Fogo da gema');
});

// ---------------------------------------------------------------- Blasfêmia Desperta

test('T3: a Blasfêmia Desperta — a Fraqueza Elemental vira aura (Reserva 28% no nível 20; recarga 1,2 s; uso instantâneo), +4 níveis, 25% menos Efeito e +104% de Área', { skip: SEM }, async () => {
  assert.equal(celula('Awakened_Blasphemy_Support', /^Mana$/), '28%');
  assert.deepEqual(numeros(celula('Awakened_Blasphemy_Support', /Efeito em Área/)), [104]);
  assert.equal(numeros(celula('Awakened_Blasphemy_Support', /Nível de Gemas de Habilidades de Maldição/))[0], 4);
  const e20 = ef('Awakened_Blasphemy_Support').efeito;
  assert.deepEqual([e20.reservaSobreposta, e20.maldicaoEmAura, e20.castTimePct, e20.efeitoMaldicaoPct, e20.areaMaldicaoPct, e20.nivelExtra], [28, 2, -100, -25, 104, 4]);
  const sem = await montar([['Elemental_Weakness']]);
  const u0 = usar(sem.e, sem.b);
  assert.ok(u0.r.ok);
  const id = G.doSlug('Elemental_Weakness').acao;
  const b0 = sem.e.hunt.buffs[id];
  const com = await montar([['Elemental_Weakness', 'Awakened_Blasphemy_Support']]);
  const u = usar(com.e, com.b);
  assert.ok(u.r.ok);
  assert.ok(!u.eventos.some((x) => x.t === 'cast'), 'instantâneo: sem conjuração');
  const b = com.e.hunt.buffs[id];
  assert.deepEqual(b.reserva, { recurso: 'mana', pct: 28, fator: 1 }, 'liga como aura, reservando 28%');
  assert.ok(b.ate > com.e.hunt.clock + 1e9, 'a aura não acaba');
  // (o nível 24 da Fraqueza Elemental — a coluna do poedb — × 0,75)
  const res24 = Math.abs(numeros(celula('Elemental_Weakness', /Resistências Elementais/, 24))[0]);
  const vuln = (x) => x.efeitosPoe.filter((y) => y.efeito === 'marcaVulneravel').map((y) => y.pct);
  assert.deepEqual(vuln(b0), [30, 30, 30], 'sem: −30% no nível 20');
  assert.deepEqual(vuln(b).map((x) => Math.round(x * 100) / 100), Array(3).fill(Math.round(res24 * 0.75 * 100) / 100), `com: −${res24} × 0,75`);
  // (a área: o raio da gema no nível 24 × √(1 + 104%) ÷ 2 m por casa)
  const raio24 = G.areaNoNivel('Elemental_Weakness', 24).raioM;
  const regras = (x) => x.efeitosPoe.find((y) => y.efeito === 'maldicaoRegras');
  assert.ok(perto(regras(b).raioCasas, (raio24 * Math.sqrt(2.04)) / 2, 0.01), `${regras(b).raioCasas} ≈ ${raio24} × √2,04 ÷ 2`);
  assert.ok(perto(regras(b0).raioCasas, G.areaNoNivel('Elemental_Weakness', 20).raioM / 2, 0.01));
  // (a recarga de 1,2 s da Blasfêmia)
  assert.equal(SP.fichaNoNivel('Awakened_Blasphemy_Support', 20).props.find(([k]) => k === 'Recarga')?.[1], '1.20 seg');
});

// ---------------------------------------------------------------- Área de Efeito Aumentada Desperta

test('T3: a Área de Efeito Aumentada Desperta — +64% de Área e 24% mais Dano em Área (nível 20): a Nova de Gelo pega quem estava fora e bate × 1,24', { skip: SEM }, async () => {
  assert.deepEqual([celula('Awakened_Increased_Area_of_Effect_Support', /Efeito em Área aumentado/), celula('Awakened_Increased_Area_of_Effect_Support', /mais Dano em Área/)].map((x) => numeros(x)[0]), [64, 24]);
  assert.deepEqual(ef('Awakened_Increased_Area_of_Effect_Support').efeito, { custoPct: 30, areaIncPct: 64, maisDanoAcertoPct: 24, danoPct: 0 });
  const sem = await danoDoUso('Ice_Nova');
  const com = await danoDoUso('Ice_Nova', ['Awakened_Increased_Area_of_Effect_Support']);
  assert.ok(perto(com.dano, sem.dano * 1.24, 0.005), `${com.dano} ≈ ${sem.dano} × 1,24`);
  // (a área no jogo: o raio da gema em casas (3 m ÷ 2 = 1,5: 1 casa, ou 2 com 50%) e as casas a mais pela Área do uso (o raio × (√1,64 − 1), a fração como chance —
  // `ModsPoe.casasPelaArea`): com o sorteio em 0,05, 2 casas sem o suporte e 2 + 1 com ele — o bicho a 3 casas só entra com o suporte)
  const raio = G.areaNoNivel('Ice_Nova', 20).raioM;
  assert.equal(raio, 3);
  const alcance = async (sup) => {
    const m = await montar([['Ice_Nova', ...sup]]);
    const longe = m.resto[0];
    posicionar(m.e, [longe], [[3, 0]]);
    const u = usar(m.e, m.b, { v: 0.05 });
    return danoEm(u.eventos, longe) > 0;
  };
  assert.equal(await alcance([]), false, 'sem: 2 casas');
  assert.equal(await alcance(['Awakened_Increased_Area_of_Effect_Support']), true, 'com: 3 casas');
});

// ---------------------------------------------------------------- Libertar Desperto e Desencadeamento Maior

for (const [slug, nivel, ms, menos] of [['Awakened_Unleash_Support', 20, 580, 29], ['Greater_Unleash_Support', 3, 660, 23]]) {
  test(`T3: ${slug === 'Greater_Unleash_Support' ? 'o Desencadeamento Maior (Excepcional, nível 3)' : 'o Libertar Desperto (nível 20)'} — um Selo a cada ${ms / 1000} s, até 4; cada Selo faz a magia Ocorrer Novamente com ${menos}% menos Dano`, { skip: SEM }, async () => {
    const cel = numeros(celula(slug, /ganham um Selo/, nivel));
    assert.deepEqual([cel[0] * 1000, cel[1], numeros(celula(slug, /menos Dano quando Ocorrendo/, nivel))[0]], [ms, 4, menos]);
    const e0 = ef(slug, nivel).efeito;
    assert.deepEqual([e0.seloIntervaloMs, e0.selosMax, e0.selosMenosDanoPct], [ms, 4, menos]);
    const { e, b } = await montar([['Fireball', slug]], { nivel: { Fireball: 20, [slug]: nivel } });
    const d = (passo) => golpesEm(usar(e, b, { passo }).eventos, b).map((x) => x.v);
    const primeira = d(60_000);
    assert.equal(primeira.length, 1, 'a primeira conjuração, sem Selos');
    const cheia = d(60_000);
    assert.equal(cheia.length, 5, '4 Selos: 4 vezes de novo');
    for (const x of cheia.slice(1)) assert.ok(Math.abs(x - primeira[0] * (1 - menos / 100)) <= 1, `${x} ≈ ${primeira[0]} × ${1 - menos / 100}`);
    // (os Selos são os intervalos inteiros desde a última liberação até esta — a conjuração conta)
    const id = G.doSlug('Fireball').acao;
    const desde = e.hunt.poeSelos[id].desde;
    e.hunt.clock += ms + 10;
    const parcial = d(0);
    const selos = Math.min(4, Math.floor((e.hunt.clock - desde) / ms));
    assert.ok(selos >= 1 && selos < 4, `${selos} Selos`);
    assert.equal(parcial.length, 1 + selos);
  });
}
