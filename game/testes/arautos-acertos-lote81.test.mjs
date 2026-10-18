// LOTE 81 — os ACERTOS dos ARAUTOS (dono: "As duas coisas" — o Mensageiro Solitário pede; como o PoE/PoB): os buffs do Glacial e do Trovejante
// passam a dar o dano adicional (o texto do PoE não casava: "de Ataque de Gelo", "Mágico de Gelo"); a EXPLOSÃO do Arauto Glacial (o inimigo que
// você Estilhaça explode em Gelo nos vizinhos, em cadeia; o golpe fatal que congelaria também Estilhaça — dono: "Golpe fatal também"); a QUEIMA do
// Arauto das Cinzas (o excesso de dano do golpe fatal queima os vizinhos, dano degenerativo); e as 2 linhas do Mensageiro com efeito.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
await (await import('../systems/itens-poe/iniciar.mjs')).iniciarJogoDoPoe();
const A = await import('../systems/itens-poe/arvore.mjs');
const AfeccoesPoe = await import('../systems/itens-poe/afeccoes.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Acoes = await import('../systems/acoes.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Combate = await import('../systems/hunt/combate.mjs');
const QuemFeriu = await import('../systems/hunt/quem-feriu.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const G = await import('../systems/itens-poe/gemas-poe.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
if (!SEM) J.iniciar(ITEM_CATALOG);

const efeitos = (linha) => Object.fromEntries(A.traduzirLinha(linha).efeitos.map((e) => [e.add, e.valor]));
const anel = (af) => ({ id: 3357, count: 1, poe: { classe: 'Rings', base: 'Rings/X', af, prefixos: [], sufixos: [], implicitos: [] } });
/** Uma Bruxa com a gema do Arauto `slug` (nível 20, sem qualidade) ligada, um anel com `af`, numa caçada; os bichos longe, um em (`x`,`y`). */
function comArauto(slug, af = {}) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'sorcerer', level: 90 }), { sistema: 'poe', classePoe: 'Witch' });
  const arma = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Wands/Driftwood_Wand', raridade: 'normal', ilvl: 20, rng: () => 0.99 }));
  arma.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
  e.equipment = { ...(e.equipment ?? {}), weapon: arma, ring: anel(af) };
  e.inventory = [GS.itemDaGema({ id: G.doSlug(slug).itemId, nivel: 20, xp: 0, raridade: 'comum', qualidade: 0 })];
  GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: `poe-gema:${slug}`, enabled: true, minMana: 0, conditions: [] };
  const sorteio = Math.random;
  let semente = 777;
  Math.random = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);
  try {
    assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  } finally {
    Math.random = sorteio;
  }
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 1e6;
  e.maxHp = e.hp = 1e6;
  P.garantir(e);
  e.hunt.clock += 10_000;
  assert.ok(Acoes.disparar(e, e.hunt, PERSONAGEM, 0, null, { manual: true }).ok, 'liga o Arauto');
  // os bichos: os 4 primeiros perto (o morto em 10,10), o resto longe; sem resistências nem mods (a conta limpa)
  const [morto, a, b, c] = e.hunt.monstros;
  const lugar = (m, x, y, hp = 1e6) => Object.assign(m, { x, y, z: 0, hp, maxHp: 1e6, dots: [], estados: {}, resist: {}, poeMods: [] });
  lugar(morto, 10, 10, 0);
  lugar(a, 11, 10);
  lugar(b, 13, 10);
  lugar(c, 12, 10);
  for (const o of e.hunt.monstros.slice(4)) Object.assign(o, { x: 80, y: 80 });
  return { e, morto, a, b, c };
}
const fixo = (f) => { const o = Math.random; Math.random = () => 0.5; try { return f(); } finally { Math.random = o; } };

test('os BUFFS do Glacial e do Trovejante dão o dano adicional (ataques e magias) — antes nada', { skip: SEM }, () => {
  assert.deepEqual(G.buffNoNivel('Herald_of_Ice', 20).af, { added_ice_dmg_min: 38, added_ice_dmg_max: 56, spell_added_ice_dmg_min: 38, spell_added_ice_dmg_max: 56 });
  assert.deepEqual(G.buffNoNivel('Herald_of_Thunder', 20).af, { added_energy_dmg_min: 19, added_energy_dmg_max: 76, spell_added_energy_dmg_min: 19, spell_added_energy_dmg_max: 76 });
  assert.equal(G.REGISTRO.get('Herald_of_Ice').statusNoJogo, 'funciona');
});

test('as 2 linhas do Mensageiro Solitário: o "mais com Acertos" e o "mais Degenerativo" de Arauto', { skip: SEM }, () => {
  assert.deepEqual(efeitos('100% mais Dano com Acertos de Habilidades de Arauto'), { 'mais_dano@arauto': 100 });
  assert.deepEqual(efeitos('50% mais Dano Degenerativo com Habilidades de Arautos'), { 'dano_dot_mais@arauto': 50 });
});

/** A explosão do Glacial no vizinho `a` (o morto Congelado, morto por você): o dano em `a` e em `b` (a 3 casas). */
function explodir(af = {}, { congelado = true, quem = QuemFeriu.VOCE, desligado = false } = {}) {
  const { e, morto, a, b } = comArauto('Herald_of_Ice', af);
  if (desligado) delete e.hunt.buffs['poe-gema:Herald_of_Ice'];
  if (congelado) morto.estados.congelado = { ate: e.hunt.clock + 5000 };
  QuemFeriu.carimbar(morto, quem, ['magia', 'gelo', 'acerto']);
  const eventos = [];
  fixo(() => Combate.processarMortes(e, PERSONAGEM, eventos));
  return { emA: 1e6 - a.hp, emB: 1e6 - b.hp, eventos };
}

test('a EXPLOSÃO do Arauto Glacial: o Estilhaçado explode em Gelo no vizinho (308–462 no nível 20), a 1 casa; sem Congelar, sem o Arauto ou pelo lacaio, nada', { skip: SEM }, () => {
  const r = explodir();
  assert.ok(r.emA >= 308 && r.emA <= 462 * 2, `${r.emA}`);
  assert.equal(r.emB, 0, 'a 3 casas, fora');
  assert.ok(r.eventos.some((x) => x.t === 'explosao' && x.fonte === 'arauto-glacial'));
  assert.equal(explodir({}, { congelado: false }).emA, 0);
  assert.equal(explodir({}, { quem: QuemFeriu.LACAIO }).emA, 0);
  assert.equal(explodir({}, { desligado: true }).emA, 0);
});

test('a EXPLOSÃO escala pelas tags do Arauto (sem "magia"): Dano de Arauto e "mais com Acertos" sim; Dano Mágico e o adicionado às magias, não', { skip: SEM }, () => {
  const base = explodir().emA;
  assert.ok(Math.abs(explodir({ 'dmg_inc@arauto': 100 }).emA / base - 2) < 0.02);
  assert.ok(Math.abs(explodir({ 'mais_dano@arauto': 100 }).emA / base - 2) < 0.02);
  assert.equal(explodir({ spell_dmg: 100 }).emA, base);
  assert.equal(explodir({ spell_added_ice_dmg_min: 500, spell_added_ice_dmg_max: 500 }).emA, base);
});

test('a CADEIA: o vizinho Congelado que morre na explosão Estilhaça e explode também, na mesma volta', { skip: SEM }, () => {
  const { e, morto, a, c } = comArauto('Herald_of_Ice');
  morto.estados.congelado = { ate: e.hunt.clock + 5000 };
  QuemFeriu.carimbar(morto, QuemFeriu.VOCE, ['magia', 'gelo', 'acerto']);
  // `a` (em 11,10) Congelado e com pouca vida: morre na explosão; `c` (em 12,10) está a 2 casas do morto e a 1 de `a`
  Object.assign(a, { hp: 5 });
  a.estados.congelado = { ate: e.hunt.clock + 5000 };
  const antes = c.hp;
  fixo(() => Combate.processarMortes(e, PERSONAGEM, []));
  assert.ok(a.hp <= 0 && a.recompensado, 'a morreu e foi processado');
  assert.ok(c.hp < antes, 'a explosão de `a` acertou `c`');
});

test('o GOLPE FATAL que congelaria marca o morto como Congelado (o PoE Estilhaça)', { skip: SEM }, () => {
  const bicho = { hp: -5, maxHp: 100, estados: {}, dots: [] };
  const a = { ...AfeccoesPoe.daSoma({}), chance: { congelamento: 100 } };
  AfeccoesPoe.aoAcertar(bicho, [{ elemento: 'ice', dano: 80 }], { afeccoes: a, agora: 1000 });
  assert.ok(bicho.estados.congelado?.ate > 1000);
  const fogo = { hp: -5, maxHp: 100, estados: {}, dots: [] };
  AfeccoesPoe.aoAcertar(fogo, [{ elemento: 'fire', dano: 80 }], { afeccoes: a, agora: 1000 });
  assert.equal(fogo.estados.congelado, undefined, 'sem Gelo, não');
  // quem o jogo nunca congela vivo: o chefe (e a sala de boss) e a resistência a controle de 100%
  const chefe = { hp: -5, maxHp: 100, boss: true, estados: {}, dots: [] };
  AfeccoesPoe.aoAcertar(chefe, [{ elemento: 'ice', dano: 80 }], { afeccoes: a, agora: 1000 });
  assert.equal(chefe.estados.congelado, undefined);
  const naSala = { hp: -5, maxHp: 100, estados: {}, dots: [] };
  AfeccoesPoe.aoAcertar(naSala, [{ elemento: 'ice', dano: 80 }], { afeccoes: a, agora: 1000, salaDeBoss: true });
  assert.equal(naSala.estados.congelado, undefined);
});

/** A queima do Arauto das Cinzas: o morto com `excedente` de excesso (golpe fatal seu); o total da queima no vizinho `a` e em `b`. */
function queimar(af = {}, excedente = 200, quem = QuemFeriu.VOCE) {
  const { e, morto, a, b } = comArauto('Herald_of_Ash', af);
  morto.poeExcedente = excedente;
  QuemFeriu.carimbar(morto, quem, ['ataque', 'fisico', 'acerto']);
  Combate.processarMortes(e, PERSONAGEM, []);
  const dot = (m) => (m.dots ?? []).filter((d) => d.chave === 'Herald_of_Ash').reduce((t, d) => t + d.falta, 0);
  return { emA: dot(a), emB: dot(b), e };
}

test('a QUEIMA do Arauto das Cinzas: 25% do excesso por segundo × 1,38 (nível 20) por 4 s no vizinho; sem excesso ou pelo lacaio, nada', { skip: SEM }, () => {
  assert.deepEqual(Acoes.arautoDasCinzasNoNivel(20, 0), { pctPorS: 25, maisPct: 38, duracaoMs: 4000, raioM: 1 });
  assert.equal(Acoes.arautoDasCinzasNoNivel(20, 20).pctPorS, 30);
  const r = queimar();
  assert.ok(r.emA >= 200 * 0.25 * 1.38 * 4 * 0.99, `${r.emA}`);
  assert.equal(r.emB, 0);
  assert.equal(queimar({}, 0).emA, 0);
  assert.equal(queimar({}, 200, QuemFeriu.LACAIO).emA, 0);
  // é degenerativo: o "mais Degenerativo com Arautos" (o Mensageiro) multiplica; o "mais com Acertos", não; o Dano Mágico, não
  const base = r.emA;
  assert.ok(Math.abs(queimar({ 'dano_dot_mais@arauto': 50 }).emA / base - 1.5) < 0.01);
  assert.ok(Math.abs(queimar({ 'mais_dano@arauto': 100 }).emA / base - 1) < 0.01);
  assert.ok(Math.abs(queimar({ spell_dmg: 100 }).emA / base - 1) < 0.01);
  assert.ok(G.REGISTRO.get('Herald_of_Ash').motivosNoJogo.every((m) => !/Dano Excedente/.test(m)));
});

/** A tempestade do Trovejante: o personagem em (10,10); `a` a 1 casa, `b` a 3 casas (fora dos 2). */
function tempestade(af = {}) {
  const r = comArauto('Herald_of_Thunder', af);
  r.e.hunt.pos = { x: 10, y: 10 };
  // (como nas caçadas de verdade: o andar é o da caçada e os bichos não têm `z` próprio)
  r.e.hunt.z = 8;
  for (const m of r.e.hunt.monstros) delete m.z;
  Object.assign(r.morto, { hp: 1e6 });
  Object.assign(r.c, { x: 80, y: 80 });
  return r;
}

test('a TEMPESTADE do Arauto Trovejante: abre ao matar um Eletrizado (também o que "mortos são Eletrizados" Eletriza); 4 raios por segundo por 6 s, a até 2 casas, sem Eletrizar', { skip: SEM }, () => {
  const { e, morto, a, b } = tempestade();
  // matar um não Eletrizado não abre
  Object.assign(morto, { hp: 0 });
  QuemFeriu.carimbar(morto, QuemFeriu.VOCE, ['magia', 'acerto']);
  Combate.processarMortes(e, PERSONAGEM, []);
  assert.equal(e.hunt.poeTempestade, undefined);
  // o Eletrizado abre
  assert.ok(Acoes.abrirTempestade(e, e.hunt));
  const t0 = e.hunt.clock;
  assert.equal(e.hunt.poeTempestade.ate, t0 + 6000);
  // o morto sai de perto; só `a` (1 casa) e `b` (3 casas)
  const antesA = a.hp;
  const antesB = b.hp;
  const fx = [];
  for (let i = 0; i < 4; i++) { e.hunt.clock = t0 + 250 * i; fx.push(...fixo(() => Acoes.tiqueDaTempestade(e, e.hunt, e.hunt.clock))); }
  const golpes = fx.filter((x) => x.t === 'dmg' && x.fonte === 'arauto-trovejante');
  assert.equal(golpes.length, 4, '4 raios no primeiro segundo');
  assert.ok(a.hp < antesA);
  assert.equal(b.hp, antesB, 'a 3 casas, fora');
  assert.ok(!(a.estados?.chocado?.ate > e.hunt.clock), 'não Eletriza');
  // passou a duração: some
  e.hunt.clock = t0 + 7000;
  Acoes.tiqueDaTempestade(e, e.hunt, e.hunt.clock);
  assert.equal(e.hunt.poeTempestade, undefined);
  // sem o Arauto, não abre
  delete e.hunt.buffs['poe-gema:Herald_of_Thunder'];
  assert.equal(Acoes.abrirTempestade(e, e.hunt), false);
  // "Inimigos mortos por você são Eletrizados": o morto que ela Eletriza também abre (dono: "Abre também")
  const r = tempestade({ mortos_eletrizados: 1 });
  Object.assign(r.morto, { hp: 0 });
  QuemFeriu.carimbar(r.morto, QuemFeriu.VOCE, ['magia', 'acerto']);
  Combate.processarMortes(r.e, PERSONAGEM, []);
  assert.ok(r.e.hunt.poeTempestade?.ate > r.e.hunt.clock);
});

test('a TEMPESTADE pelo abate: o Eletrizado morto por você abre; o golpe escala pelas tags do Arauto (sem "magia")', { skip: SEM }, () => {
  const { e, morto } = tempestade();
  Object.assign(morto, { hp: 0 });
  morto.estados.chocado = { ate: e.hunt.clock + 3000, pct: 15 };
  QuemFeriu.carimbar(morto, QuemFeriu.VOCE, ['magia', 'raio', 'acerto']);
  Combate.processarMortes(e, PERSONAGEM, []);
  assert.ok(e.hunt.poeTempestade?.ate > e.hunt.clock);
  const raio = (af) => {
    const r = tempestade(af);
    Acoes.abrirTempestade(r.e, r.e.hunt);
    const antes = r.a.hp;
    fixo(() => Acoes.tiqueDaTempestade(r.e, r.e.hunt, r.e.hunt.clock));
    return antes - r.a.hp;
  };
  const base = raio();
  assert.ok(base > 0);
  assert.ok(Math.abs(raio({ 'dmg_inc@arauto': 100 }) / base - 2) < 0.02);
  assert.ok(Math.abs(raio({ 'mais_dano@arauto': 100 }) / base - 2) < 0.02);
  assert.equal(raio({ spell_dmg: 100 }), base);
});

test('o SEGREDO DA TORMENTA: Eletrizar abre a tempestade; "com Frequência aumentada" acelera; cada raio tira o dano em você × a sua resistência a Raio', { skip: SEM }, () => {
  assert.deepEqual(efeitos('Arauto Trovejante também cria uma tempestade quando você Eletrizar um Inimgo'), { arauto_tempestade_ao_eletrizar: 1 });
  assert.deepEqual(efeitos('Tempestestades do Arauto Trovejante Acertam Inimigos com Frequência aumentada em 40%'), { arauto_tempestade_freq_inc: 40 });
  assert.deepEqual(efeitos('Sofre 250 de Dano de Raio quando o Arauto Trovejante Acertar um Inimigo'), { arauto_trovao_dano_em_voce: 250 });
  const { e, a } = tempestade({ arauto_tempestade_ao_eletrizar: 1, arauto_tempestade_freq_inc: 100, arauto_trovao_dano_em_voce: 250 });
  // o Eletrizar (as afecções postas pelo acerto) marca; o tique abre
  ModsPoe.aoPorAfeccoes(e, e.hunt, a, Ficha.combate(e), ['eletrizado'], { eventos: [] });
  assert.equal(e.hunt.poeEletrizouParaTempestade, e.hunt.clock);
  const t0 = e.hunt.clock;
  const antes = e.hp;
  let golpes = 0;
  for (let i = 0; i < 8; i++) { e.hunt.clock = t0 + 125 * i; golpes += fixo(() => Acoes.tiqueDaTempestade(e, e.hunt, e.hunt.clock)).filter((x) => x.t === 'dmg' && x.foe).length; }
  assert.equal(golpes, 8, 'frequência dobrada: 8 raios em 1 s');
  assert.ok(e.hp < antes && e.hp > antes - 8 * 250 - 1, `${antes} → ${e.hp}`);
  assert.ok(a.hp < 1e6);
});

test('o CÍRCULO DA AMBIÇÃO: o dano de Fogo/Gelo e a resistência máxima "enquanto afetado por Arauto Flamejante/Glacial"', { skip: SEM }, () => {
  assert.deepEqual(efeitos('Dano de Fogo enquanto afetado por Arauto Flamejante aumentado em 50%'), { 'fire_dmg@afetadoPor:arauto-flamejante': 50 });
  assert.deepEqual(efeitos('Dano de Gelo enquanto afetado por Arauto Glacial aumentado em 50%'), { 'ice_dmg@afetadoPor:arauto-glacial': 50 });
  const { e } = comArauto('Herald_of_Ice', { 'ice_dmg@afetadoPor:arauto-glacial': 50 });
  Ficha.invalidar(e);
  const com = Ficha.combate(e).afPoe.ice_dmg ?? 0;
  delete e.hunt.buffs['poe-gema:Herald_of_Ice'];
  Ficha.invalidar(e);
  assert.equal(com - (Ficha.combate(e).afPoe.ice_dmg ?? 0), 50);
});
