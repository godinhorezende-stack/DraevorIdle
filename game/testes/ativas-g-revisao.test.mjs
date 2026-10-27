// (revisão adversarial do lote G, 26/10) OS ACHADOS CONFIRMADOS das gemas ativas G-A/G-C, G-B/G-D e do merge: a Ruína (o "mais" linear do PoB, o −25% da Condenação, o
// pctRaro sem o k em dobro, as maldições ligadas só pela Ruína e a Blasfêmia), a Marca do Alquimista (6 s), a Punição e os Impelidos no golpe básico (a Combustão do
// Infernal, os alvos a mais do Ancestral), o Escudo Tempestuoso no bloqueio de magia, o gelo da Armadura Ártica Vaal (todo acerto com dano conta; o frasco que tira o
// Congelado quebra o gelo), os dois Fogos Justos juntos, o Chamado Imortal Vaal antes das absorções e trocado por outra Guarda, a Runa do Arcanista (o "mais" só no
// vinculado), o Impelir de outro Clamor (o `de`, os bônus do buff por Clamor), a lentidão de duas fontes e a linha do feixe da Indecisão. Os sorteios ficam travados.
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
const GAC = await import('../systems/itens-poe/gemas-gac.mjs');
const GBD = await import('../systems/itens-poe/gemas-gbd.mjs');
const Reforcos = await import('../systems/skills/reforcos.mjs');
const Estados = await import('../systems/skills/estados.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Combate = await import('../systems/hunt/combate.mjs');
const Poderes = await import('../systems/poderes.mjs');
const Fr = await import('../systems/itens-poe/frascos.mjs');

let J;
let gerarPeca;
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
const perto = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

function travado(v, fn) {
  const antes = Math.random;
  Math.random = () => v;
  try { return fn(); } finally { Math.random = antes; }
}
/** O personagem com as gemas LIGADAS na arma (um grupo só), numa caçada; o alvo imortal a (`dx`, 0) e os outros longe. */
async function montar(slugs, { nivel = 20, qualidade = 0, arma = 'Wands/Driftwood_Wand', dx = 1, escudo = null } = {}) {
  J ??= await import('../systems/itens-poe/jogo.mjs');
  gerarPeca ??= (await import('../systems/itens-poe/gerar.mjs')).gerarPeca;
  const lista = [slugs].flat();
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Scion', sistema: 'poe' });
  const a = peca(arma);
  a.soquetes = { abertos: lista.length, links: lista.slice(1).map(() => true), gemas: lista.map(() => null), cores: lista.map(() => 'W') };
  e.equipment = { ...e.equipment, weapon: a };
  if (escudo) e.equipment.shield = peca(escudo);
  else delete e.equipment.shield;
  // (os suportes pelo slug do PoE nas definições — `GS.DEFS`)
  const itemDe = (s) => G.doSlug(s)?.itemId ?? [...GS.DEFS.values()].find((d) => d.poe?.slug === s)?.itemId;
  e.inventory = lista.map((s) => GS.itemDaGema({ id: itemDe(s), nivel, xp: 0, raridade: 'comum', qualidade }));
  for (let i = 0; i < lista.length; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  e.actions = Array(Acoes.SLOTS).fill(null);
  lista.forEach((s, i) => { if (G.doSlug(s)) e.actions[i] = { id: G.doSlug(s).acao, enabled: true, minMana: 0, conditions: [] }; });
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(travado(0.5, () => Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' })).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 10_000;
  e.maxHp = e.hp = 100_000;
  const [b, ...resto] = e.hunt.monstros;
  for (const m of resto) Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60 });
  Object.assign(b, { x: e.hunt.pos.x + dx, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12, estados: {}, resist: {}, dots: [], armaduraPct: -100, evasao: 0 });
  return { e, b, resto };
}
function usar(e, b, slot = 0, v = 0.5) {
  return travado(v, () => {
    const x = Acoes.disparar(e, e.hunt, PERSONAGEM, slot, b, { manual: true });
    if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; return { ...x, eventos: [...(x.eventos ?? []), ...(Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM) ?? [])] }; }
    return x;
  });
}
const liberar = (e, ms = 1) => { e.hunt.cooldowns = {}; delete e.hunt.conjurando; e.hunt.clock += ms; };
const id = (slug) => G.doSlug(slug).acao;
const golpesEm = (ev, m) => (ev ?? []).filter((x) => x.t === 'dmg' && x.foe !== false && x.uid === m.uid && !x.dot).map((x) => x.v);
const vizinho = (e, m, dx, dy) => Object.assign(m, { x: e.hunt.pos.x + dx, y: e.hunt.pos.y + dy, hp: 1e12, maxHp: 1e12, estados: {}, resist: {}, dots: [], armaduraPct: -100, evasao: 0 });
/** A maldição da gema `slug` posta em `b` como o buff dela a poria (`Reforcos.marcarCom`). */
function amaldicoar(hunt, b, slug, { nivel = 20, qualidade = 0, agora = hunt.clock } = {}) {
  const r = G.doSlug(slug);
  const efeitos = Acoes.efeitosDaMaldicao(G.buffNoNivel(slug, nivel, qualidade).efeitos, { nivel, qualidade }, null, Acoes.POR_ID_PUBLICO(r.acao));
  Reforcos.marcarCom(hunt, b, [{ id: r.acao, def: { tipo: 'poe-maldicao', efeitos }, fator: 1, lancado: agora, emAura: false }], agora);
}
/** O golpe do monstro em você (o corpo a corpo). */
function apanhar(e, b, v = 0.5) {
  const eventos = [];
  const antes = e.hp;
  travado(v, () => Combate.contraAtaque(e, e.hunt, PERSONAGEM, b, eventos));
  return { perdeu: antes - e.hp, eventos };
}
/** Uma magia do monstro em você (`Poderes.dispararMagia`), com a ficha `ficha` (a de agora sem ela). */
function magiaEm(e, b, { ficha = null, a = { min: 500, max: 500, elemento: 'fire' } } = {}) {
  const eventos = [];
  const antes = e.hp;
  travado(0.5, () => Poderes.dispararMagia({ estado: e, hunt: e.hunt, personagem: PERSONAGEM, bicho: b, eventos, agora: e.hunt.clock, ficha: ficha ?? Ficha.combate(e), temEscudo: false }, a));
  return { perdeu: antes - e.hp, eventos };
}
/** O golpe básico (o `round` da caçada) no alvo `b`. */
function golpeBasico(e, b) {
  e.hunt.alvo = b.uid;
  return travado(0.5, () => Combate.round(e, PERSONAGEM));
}

// ---------------------------------------------------------------- G-A/G-C: a Ruína (achados 1 a 4)

test('revisão G (1, 2): a Ruína — o "mais" por maldição é linear (o PoB: um MORE × CurseApplied); a Condenação tem o −25% final nas ligadas', { skip: SEM }, () => {
  const r = G.ruinaNoNivel('Bane', 20, 20);
  assert.ok(perto(GAC.ruinaComMaldicoes(r, 2).fatorDano, 1.84), '1 + 42% × 2');
  const c = G.ruinaNoNivel('Bane_of_Condemnation', 20);
  assert.ok(perto(GAC.ruinaComMaldicoes(c, 2).fatorDano, 3), '1 + 100% × 2');
  assert.equal(c.efeitoLigadasMaisPct, -25);
  assert.equal(c.efeitoLigadasPct, 0, 'a Condenação não tem a qualidade de efeito');
});

test('revisão G (3): a Corrente Temporal ligada à Ruína — o valor contra Raro/Único leva o −25% uma vez só (18% → 13,5%)', { skip: SEM }, async () => {
  const { e } = await montar(['Bane', 'Temporal_Chains']);
  const [x] = Acoes.maldicoesDaRuina(e, Acoes.POR_ID_PUBLICO(id('Bane')), G.ruinaNoNivel('Bane', 20, 0));
  assert.ok(x, 'a Ruína aplica a Corrente Temporal ligada');
  const ligada = GAC.efeitoNoBicho(x.def.efeitos.find((f) => f.efeito === 'marcaGac' && f.pctRaro != null), 1);
  const efeitos = Acoes.efeitosDaMaldicao(G.buffNoNivel('Temporal_Chains', 20, 0).efeitos, { nivel: 20, qualidade: 0 }, null, Acoes.POR_ID_PUBLICO(id('Temporal_Chains')));
  const so = GAC.efeitoNoBicho(efeitos.find((f) => f.efeito === 'marcaGac' && f.pctRaro != null), 1);
  assert.ok(perto(ligada.pct, so.pct * 0.75), `o normal: ${so.pct} × 0,75 = ${ligada.pct}`);
  assert.ok(perto(ligada.pctRaro, so.pctRaro * 0.75), `o Raro: ${so.pctRaro} × 0,75 = ${ligada.pctRaro}`);
});

test('revisão G (4): as maldições ligadas à Ruína só saem por ela (o PoB: cannot_cast_curses); com a Blasfêmia no grupo, a Ruína não as suporta', { skip: SEM }, async () => {
  const { e, b } = await montar(['Bane', 'Despair']);
  assert.equal(GS.ativadaPor(e, id('Despair')), G.doSlug('Bane').gema.nome);
  const r = travado(0.5, () => Acoes.disparar(e, e.hunt, PERSONAGEM, 1, b, { manual: true }));
  assert.equal(r.ok, false);
  assert.equal(r.motivo, 'ATIVADA_POR_GATILHO');
  // a Ruína em si continua usável e aplica o Desespero
  assert.ok(usar(e, b, 0).ok);
  assert.ok(b.maldicoes?.[id('Despair')], 'a Ruína aplicou a ligada');
  // com a Blasfêmia: a maldição vira aura (AuraAffectsEnemies) — a Ruína não a aplica e ela se conjura sozinha
  const bl = await montar(['Bane', 'Despair', 'Blasphemy_Support']);
  assert.equal(GS.ativadaPor(bl.e, id('Despair')), null);
  assert.deepEqual(Acoes.maldicoesDaRuina(bl.e, Acoes.POR_ID_PUBLICO(id('Bane')), G.ruinaNoNivel('Bane', 20, 0)), []);
});

// ---------------------------------------------------------------- G-A/G-C: a Alquimista, a Punição e o Ancestral (achados 5, 7, 8)

test('revisão G (5): a Marca do Alquimista dura o mesmo que as outras Marcas (6 s) — os 4 s do PoB são os dos solos', { skip: SEM }, () => {
  const alq = G.buffNoNivel('Alchemists_Mark', 20, 0);
  const ass = G.buffNoNivel('Assassins_Mark', 20, 0);
  const durs = (x) => [...new Set(x.efeitos.filter((f) => f.durMarca != null).map((f) => f.durMarca))];
  assert.deepEqual(durs(alq), [6000]);
  assert.equal(alq.dur, ass.dur);
  assert.equal(alq.dur, 6000);
  assert.equal(GAC.SOLO_DO_ALQUIMISTA.duracaoMs, 4000, 'os solos seguem com 4 s');
});

test('revisão G (7): a Punição vale também no golpe básico — o alvo em Vida Baixa sofre os +X%', { skip: SEM }, async () => {
  const dano = async (baixa) => {
    const { e, b } = await montar('Punishment', { arma: 'One_Hand_Swords/Rusted_Sword' });
    amaldicoar(e.hunt, b, 'Punishment');
    if (baixa) b.hp = b.maxHp * 0.4;
    const antes = b.hp;
    golpeBasico(e, b);
    return antes - b.hp;
  };
  const alta = await dano(false);
  const baixa = await dano(true);
  assert.ok(alta > 0);
  const pct = G.buffNoNivel('Punishment', 20, 0).efeitos.filter((f) => f.efeito === 'marcaGac' && f.tipo === 'vidaBaixa').reduce((t, f) => t + f.pct, 0);
  assert.ok(pct > 0);
  assert.ok(Math.abs(baixa - alta * (1 + pct / 100)) <= Math.max(2, alta * 0.01), `${alta} × (1 + ${pct}%) ≈ ${baixa}`);
});

test('revisão G (8, 17): o golpe básico Impelido — o do Ancestral acerta mais 2 inimigos; o do Infernal ativa a Combustão; cada um gasta 1', { skip: SEM }, async () => {
  const an = await montar('Ancestral_Cry', { arma: 'One_Hand_Swords/Rusted_Sword' });
  assert.ok(usar(an.e, an.b).ok);
  const n0 = an.e.hunt.impelidos.n;
  assert.equal(an.e.hunt.impelidos.alvosExtra, 2);
  const [v1, v2, v3] = an.resto;
  vizinho(an.e, v1, 0, 1);
  vizinho(an.e, v2, 1, 1);
  vizinho(an.e, v3, 1, -1);
  const r = golpeBasico(an.e, an.b);
  const atingidos = [v1, v2, v3].filter((m) => golpesEm(r.eventos, m).length > 0).length;
  assert.ok(golpesEm(r.eventos, an.b).length > 0, 'o alvo');
  assert.equal(atingidos, 2, 'e mais 2 inimigos');
  assert.equal(an.e.hunt.impelidos.n, n0 - 1, 'um golpe só gastou');
  // o Infernal: a Combustão no alvo do golpe básico corpo a corpo
  const inf = await montar('Infernal_Cry', { arma: 'One_Hand_Swords/Rusted_Sword' });
  assert.ok(usar(inf.e, inf.b).ok);
  const r2 = golpeBasico(inf.e, inf.b);
  assert.ok(r2.eventos.some((x) => x.fonte === 'combustao' && x.uid === inf.b.uid), 'a Combustão');
  assert.equal(inf.e.hunt.impelidos.n, 5);
});

// ---------------------------------------------------------------- G-B/G-D (achados 9 a 15)

test('revisão G (9): o Escudo Tempestuoso sai também ao bloquear uma MAGIA (o gancho de `Poderes.dispararMagia`)', { skip: SEM }, async () => {
  const { e, b } = await montar('Tempest_Shield', { arma: 'One_Hand_Swords/Rusted_Sword', escudo: 'Shields/Splintered_Tower_Shield' });
  assert.ok(usar(e, b).ok);
  const r = magiaEm(e, b, { ficha: { ...Ficha.combate(e), bloqueioDeMagia: 1 } });
  assert.equal(r.perdeu, 0, 'a magia foi bloqueada');
  assert.ok(golpesEm(r.eventos, b).length >= 1, 'o raio saiu no atacante');
});

test('revisão G (10): o gelo da Armadura Ártica Vaal quebra com 3 acertos absorvidos inteiros pelo Escudo de Energia', { skip: SEM }, async () => {
  const Controle = await import('../systems/combate/controle.mjs');
  const { e, b } = await montar('Vaal_Arctic_Armour');
  e.equipment.ring = { id: 3357, count: 1, poe: { classe: 'Rings', base: 'Rings/X', af: { energy_shield: 1_000_000 }, prefixos: [], sufixos: [], implicitos: [] } };
  Ficha.invalidar(e);
  e.es = Math.round(Ficha.combate(e).energyShield);
  assert.ok(e.es >= 1_000_000);
  assert.ok(usar(e, b).ok);
  const va = id('Vaal_Arctic_Armour');
  assert.equal(Controle.podeAgir(e.hunt), false);
  for (let i = 0; i < 2; i++) assert.equal(apanhar(e, b).perdeu, 0, 'o Escudo de Energia absorve tudo');
  assert.ok(e.hunt.buffs[va], 'dois acertos: o gelo segue');
  apanhar(e, b);
  assert.equal(e.hunt.buffs[va], undefined, 'o 3º acerto com dano quebra o gelo');
  assert.equal(Controle.podeAgir(e.hunt), true);
  // a magia também conta pelo dano antes das absorções
  const m = await montar('Vaal_Arctic_Armour');
  m.e.equipment.ring = e.equipment.ring;
  Ficha.invalidar(m.e);
  m.e.es = Math.round(Ficha.combate(m.e).energyShield);
  assert.ok(usar(m.e, m.b).ok);
  for (let i = 0; i < 3; i++) magiaEm(m.e, m.b);
  assert.equal(m.e.hunt.buffs[va], undefined, 'três magias absorvidas pelo Escudo quebram o gelo');
});

test('revisão G (11): o Fogo Justo Vaal e o da Devoção ligados juntos — o fim do Vaal não apaga a queima da Devoção', { skip: SEM }, async () => {
  const { e, b } = await montar(['Righteous_Fire_of_Arcane_Devotion', 'Vaal_Righteous_Fire']);
  assert.ok(usar(e, b, 0).ok);
  liberar(e);
  assert.ok(usar(e, b, 1).ok);
  assert.equal(e.hunt.poeFogoJusto?.acao, id('Vaal_Righteous_Fire'));
  assert.equal(e.hunt.poeFogoJustoDevocao?.acao, id('Righteous_Fire_of_Arcane_Devotion'));
  e.hunt.clock += 250;
  Acoes.tiqueDasGemasGBD(e, e.hunt, PERSONAGEM, [], e.hunt.clock);
  assert.ok(b.dots.some((d) => d.chave === 'Vaal_Righteous_Fire') && b.dots.some((d) => d.chave === 'Righteous_Fire_of_Arcane_Devotion'), 'as duas queimas');
  // o Vaal acaba (4 s): a Devoção segue queimando em volta e em você
  e.hunt.clock += 4000;
  Acoes.tiqueDasGemasGBD(e, e.hunt, PERSONAGEM, [], e.hunt.clock);
  assert.equal(e.hunt.poeFogoJusto, undefined);
  assert.ok(e.hunt.poeFogoJustoDevocao, 'a Devoção segue registrada');
  b.dots = [];
  e.es = 0;
  const vida = e.hp;
  e.hunt.clock += 250;
  Acoes.tiqueDasGemasGBD(e, e.hunt, PERSONAGEM, [], e.hunt.clock);
  assert.ok(b.dots.some((d) => d.chave === 'Righteous_Fire_of_Arcane_Devotion'), 'a queima da Devoção em volta');
  assert.ok(e.hp < vida, 'e em você');
  // o buff da Devoção sai: o registro dela também (no tique)
  delete e.hunt.buffs[id('Righteous_Fire_of_Arcane_Devotion')];
  e.hunt.clock += 100;
  Acoes.tiqueDasGemasGBD(e, e.hunt, PERSONAGEM, [], e.hunt.clock);
  assert.equal(e.hunt.poeFogoJustoDevocao, undefined);
});

test('revisão G (12): na magia, o Chamado Imortal Vaal impede o dano antes da Guarda (nada é gasto)', { skip: SEM }, async () => {
  const { e, b } = await montar('Vaal_Immortal_Call');
  assert.ok(usar(e, b).ok);
  const vic = id('Vaal_Immortal_Call');
  GBD.porGuarda(e.hunt, { acao: vic, slug: 'Vaal_Immortal_Call', pct: 70, limite: 1000 }, e.hunt.clock);
  const r = magiaEm(e, b);
  assert.equal(r.perdeu, 0);
  assert.equal(e.hunt.poeGuarda.resta, 1000, 'a Guarda não absorveu nada');
});

test('revisão G (13): a Guarda nova que troca o Chamado Imortal Vaal tira o "não pode morrer"', { skip: SEM }, async () => {
  const { e, b } = await montar(['Vaal_Immortal_Call', 'Steelskin']);
  assert.ok(usar(e, b, 0).ok);
  assert.ok(e.hunt.poeImortal > e.hunt.clock);
  liberar(e);
  assert.ok(usar(e, b, 1).ok);
  assert.equal(e.hunt.buffs[id('Vaal_Immortal_Call')], undefined, 'uma Guarda por vez');
  assert.equal(e.hunt.poeImortal, undefined, 'o imortal saiu junto');
  e.es = 0;
  assert.ok(apanhar(e, b).perdeu > 0, 'volta a ferir');
});

test('revisão G (14): Runa do Arcanista — o "mais Dano com Acertos contra o Vinculado" só no vinculado; os outros atingidos, só o "menos"', { skip: SEM }, async () => {
  const { e, b, resto } = await montar(['Arcanist_Brand', 'Fireball']);
  const outro = vizinho(e, resto[0], 2, 0);
  const ev = usar(e, b, 0).eventos ?? [];
  const g = golpesEm(ev, b);
  const o = golpesEm(ev, outro);
  assert.ok(g.length > 0 && o.length > 0, `o vinculado e o outro foram atingidos (${g.length}, ${o.length})`);
  const arc = G.arcanistaDaGema('Arcanist_Brand', 20, 0);
  assert.ok(Math.abs(g[0] / o[0] - (1 + arc.contraVinculadoPct / 100)) <= 0.02, `${g[0]} / ${o[0]} ≈ 1 + ${arc.contraVinculadoPct}%`);
});

test('revisão G (15): o frasco com imunidade a Congelamento quebra o gelo da Armadura Ártica Vaal — o buff sai junto (o PoB)', { skip: SEM }, async () => {
  const { e, b } = await montar('Vaal_Arctic_Armour');
  assert.ok(usar(e, b).ok);
  const va = id('Vaal_Arctic_Armour');
  const f = peca('Utility_Flasks/Ruby_Flask');
  f.poe.sufixos = [...(f.poe.sufixos ?? []), { modelo: 'Concede Imunidade a Congelamento por {0} segundos se usado enquanto Congelado', valores: [4], texto: 'Concede Imunidade a Congelamento por {0} segundos se usado enquanto Congelado' }];
  assert.deepEqual(Fr.parametros(f).aoUsar.imunidades.map((x) => x.afeccao), ['congelamento']);
  f.poe.cargas = 100;
  Fr.cinto(e)[0] = f;
  assert.ok(Fr.usar(e, 0, []));
  assert.equal(e.hunt.controle?.congelado, undefined, 'o Congelado saiu');
  assert.equal(e.hunt.poeGeloVaal, undefined, 'o gelo quebrou');
  assert.equal(e.hunt.buffs[va], undefined, 'e o buff saiu');
});

// ---------------------------------------------------------------- o merge (achados 16, 18, 19, 21)

test('revisão G (16): outro Clamor troca o Impelir — Infernal → Intimidador: os números do Intimidador, sem a Combustão', { skip: SEM }, async () => {
  const { e, b } = await montar(['Infernal_Cry', 'Intimidating_Cry'], { arma: 'One_Hand_Swords/Rusted_Sword' });
  assert.ok(usar(e, b, 0).ok);
  assert.deepEqual([e.hunt.impelidos.n, e.hunt.impelidos.de], [6, 'Infernal_Cry']);
  liberar(e);
  assert.ok(usar(e, b, 1).ok);
  assert.deepEqual([e.hunt.impelidos.n, e.hunt.impelidos.de], [G.impelidosDaGema('Intimidating_Cry', 20), 'Intimidating_Cry']);
  const r = golpeBasico(e, b);
  // (aval do dono, 26/10 — lote S1: vários Clamores impelem o mesmo ataque, cada um com a sua carga; o Infernal continua impelindo junto com o Intimidador, e a
  // Combustão sai. Antes: o Intimidador trocava o Impelir e o golpe saía sem a Combustão)
  assert.ok(e.hunt.impelidos.outros?.some((x) => x.de === 'Infernal_Cry' && x.n > 0), 'o Impelir do Infernal segue, junto');
  assert.ok(r.eventos.some((x) => x.fonte === 'combustao'), 'o Infernal ainda impele: a Combustão sai');
});

test('revisão G (18): os bônus do buff de um Clamor só valem no ataque Impelido por ele (o Dano Dobrado do Intimidador não vale no Impelido pelo Infernal)', { skip: SEM }, async () => {
  const { e, b } = await montar(['Intimidating_Cry', 'Infernal_Cry'], { arma: 'One_Hand_Swords/Rusted_Sword' });
  const dobrado = () => { Ficha.invalidar(e); return ModsPoe.valor(ModsPoe.fichaDoGolpe(Ficha.combate(e), ['ataque', 'corpo'], { estado: e }), 'chance_dano_dobrado'); };
  assert.ok(usar(e, b, 0).ok);
  assert.equal(dobrado(), 100, 'Impelido pelo Intimidador: o Dano Dobrado do buff dele');
  liberar(e);
  assert.ok(usar(e, b, 1).ok);
  assert.ok(e.hunt.buffs[id('Intimidating_Cry')]?.ate > e.hunt.clock, 'o buff do Intimidador segue');
  assert.equal(e.hunt.impelidos.de, 'Infernal_Cry');
  // (aval do dono, 26/10 — lote S1: vários Clamores impelem o mesmo ataque; o Intimidador ainda impele este, junto com o Infernal, e o bônus do buff dele vale. Antes: 0)
  assert.equal(dobrado(), 100, 'Impelido pelos dois: o do Intimidador vale');
});

test('revisão G (19): a lentidão de duas fontes — o Resfriar da Armadura Ártica (30%, 0,5 s) e o Debilitado da Punição (20%) — vale a mais forte ativa', { skip: SEM }, async () => {
  const { e, b } = await montar('Old_Arctic_Armour');
  assert.ok(usar(e, b).ok);
  amaldicoar(e.hunt, b, 'Punishment');
  apanhar(e, b);
  const agora = e.hunt.clock;
  const deb = b.estados.debilitado?.ate;
  assert.ok(deb > agora + 1000, 'Debilitado');
  assert.equal(b.estados.lento.pct, 30, 'agora vale o Resfriar');
  assert.deepEqual(b.estados.lento.lista, [{ ate: agora + 500, pct: 30 }, { ate: deb, pct: 20 }], 'cada fonte com a sua duração');
  assert.equal(b.estados.lento.ate, deb);
  e.hunt.clock = agora + 600;
  Estados.tique(e.hunt, [], e.hunt.clock);
  assert.deepEqual([b.estados.lento.pct, b.estados.lento.ate], [20, deb], 'acabado o Resfriar, vale o Debilitado');
});

test('revisão G (19, dono 26/10): a lentidão guarda TODAS as fontes, cada uma com a sua duração (o modelo do tolhido) — sem limite de 2', { skip: SEM }, () => {
  const e = {};
  GBD.porLento(e, 1000, 50, 0);
  GBD.porLento(e, 2000, 40, 0);
  GBD.porLento(e, 3000, 30, 0);
  GBD.porLento(e, 4000, 20, 0);
  assert.deepEqual(e.lento.lista.map((i) => [i.pct, i.ate]), [[50, 1000], [40, 2000], [30, 3000], [20, 4000]], 'as quatro');
  assert.deepEqual([e.lento.pct, e.lento.ate], [50, 4000]);
  // a coberta (mais fraca e mais curta) não entra; a mesma força fica com a mais longa
  GBD.porLento(e, 500, 10, 0);
  GBD.porLento(e, 2500, 40, 0);
  assert.deepEqual(e.lento.lista.map((i) => [i.pct, i.ate]), [[50, 1000], [40, 2500], [30, 3000], [20, 4000]]);
  // no tempo: vale a mais forte ainda ativa
  for (const [t, pct] of [[999, 50], [1500, 40], [2600, 30], [3500, 20]]) {
    GBD.atualizarLento(e, t);
    assert.equal(e.lento.pct, pct, `em ${t} ms`);
    assert.equal(GBD.pctDoLento(e, t), pct);
  }
  // a mais fraca e mais curta não encurta nem herda a mais forte
  const x = {};
  GBD.porLento(x, 5000, 40, 0);
  GBD.porLento(x, 1000, 10, 0);
  assert.deepEqual(x.lento, { ate: 5000, pct: 40 });
  // as Forças Profanadas renovam cada instância pela duração dela
  const r = {};
  GBD.porLento(r, 1000, 30, 0, { dur: 1000 });
  GBD.porLento(r, 2000, 10, 0, { dur: 2000 });
  GBD.renovarLento(r, 900);
  assert.deepEqual(r.lento.lista.map((i) => i.ate), [1900, 2900]);
});

test('revisão G (dono 26/10): o segundo clique desliga o Fogo Justo da Devoção e o comum (como no PoE); o Vaal é de duração e não desliga', { skip: SEM }, async () => {
  for (const slug of ['Righteous_Fire_of_Arcane_Devotion', 'Righteous_Fire']) {
    const { e, b } = await montar(slug);
    assert.ok(usar(e, b).ok);
    assert.ok(e.hunt.buffs[id(slug)]?.ate > 1e12, `${slug}: ligado até desligar`);
    liberar(e);
    const r = usar(e, b);
    assert.ok(r.ok && r.desligou, `${slug}: o segundo clique desliga`);
    assert.equal(e.hunt.buffs[id(slug)], undefined);
    assert.equal(e.hunt.poeFogoJustoDevocao, undefined);
  }
  const v = await montar('Vaal_Righteous_Fire');
  assert.ok(usar(v.e, v.b).ok);
  liberar(v.e);
  assert.equal(usar(v.e, v.b).motivo, 'EFEITO_ATIVO');
  assert.ok(v.e.hunt.buffs[id('Vaal_Righteous_Fire')], 'o Vaal segue pela duração');
});

test('revisão G (21): a linha do feixe da Runa Tempestuosa da Indecisão é só do G-D', { skip: SEM }, () => {
  const l = 'Envia um feixe ao Inimigo Vinculado';
  assert.equal(GAC.ehLinhaGAC('Storm_Brand_of_Indecision', l, 'marca'), false);
  assert.equal(GBD.ehLinhaGBD('Storm_Brand_of_Indecision', l), true);
  assert.equal(GAC.naoConvocavelDasLinhas(['Não pode ser Convocada']), true);
});
