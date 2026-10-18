// LOTE 76 — os SUPORTES de afecção no modo PoE (dono, 17/10: "Corrigir num lote próprio aqui", pela revisão do lote 75). As chances de
// Incendiar, Envenenar e Sangrar dos suportes vão para a conta do PoE (como o Congelar); o "X% mais Dano" de cada afecção (Toxinas Vis,
// Dano Incendiário, Afecções Mortais, Dano Físico Corpo a Corpo, Dose Letal…) multiplica só nela; o "Dano aumentado com <afecção>" da
// qualidade soma só nela; a "Duração de Afecções infligidas com Habilidades Suportadas aumentada" vale. Antes: o dano contínuo antigo do
// Draevor (um % do acerto — o Veneno do suporte saía com 0) e o "mais Dano com Veneno"/"Incendiário" no dano de TUDO.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
await (await import('../systems/itens-poe/iniciar.mjs')).iniciarJogoDoPoe();
const S = await import('../systems/itens-poe/suportes-poe.mjs');
const AfeccoesPoe = await import('../systems/itens-poe/afeccoes.mjs');
const Acoes = await import('../systems/acoes.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
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

const ef = (slug, nivel = 20, q = 0) => S.efeitoNoNivel(slug, nivel, q).efeito;

test('a LEITURA dos suportes: o "mais" e o "aumentado" de UMA afecção, a chance e a duração das afecções', { skip: SEM }, () => {
  // (merge com o lote G17, com o aval do dono, 18/10: uma regra só para as duas leituras — as chaves do G17; os valores são os mesmos. A chance vai
  // às afecções do PoE pelo atributo local do uso, `af:chance_*`; o "aumentado" de uma afecção, `af:<afecção>_dmg_inc`; o "Dano Incendiário", o
  // "mais" do Fogo degenerativo, `maisDotFogoPct`; o "de Afecções", `maisAfeccaoPct`; o "só no acerto", `maisDanoAcertoPct`)
  assert.deepEqual([ef('Chance_to_Bleed_Support')['af:chance_bleed'], ef('Chance_to_Bleed_Support').maisSangramentoPct], [25, 29]);
  assert.equal(ef('Chance_to_Bleed_Support', 20, 20)['af:bleed_dmg_inc'], 10, 'a qualidade: só no Sangramento');
  assert.equal(ef('Chance_to_Poison_Support')['af:chance_poison'], 40);
  assert.equal(ef('Chance_to_Poison_Support', 20, 20)['af:poison_dmg_inc'], 10);
  assert.equal(ef('Chance_to_Poison_Support', 20, 20).danoPct ?? 0, 0, 'não é mais o dano de tudo');
  assert.equal(ef('Vile_Toxins_Support').maisVenenoPct, 19);
  assert.equal(ef('Burning_Damage_Support').maisDotFogoPct, 34, '"Dano Incendiário": o Incêndio e o Fogo contínuo da gema');
  assert.equal(ef('Burning_Damage_Support').maisDanoPct ?? 0, 0, '"mais Dano Incendiário" não é o dano de tudo');
  assert.equal(ef('Ignite_Proliferation_Support').maisIncendioPct, 24, '"com Incêndio": só o Incêndio');
  // o "menos Dano com Acertos" das Afecções Mortais vale só no acerto (`maisDanoAcertoPct`): as afecções não perdem os 80%
  assert.deepEqual([ef('Deadly_Ailments_Support').maisAfeccaoPct, ef('Deadly_Ailments_Support').maisDanoAcertoPct, ef('Deadly_Ailments_Support').maisDanoPct ?? 0], [44, -80, 0]);
  const mpd = S.efeitoNoNivel('Melee_Physical_Damage_Support', 20, 0, { tags: ['poe:Ataque', 'poe:Corpo a Corpo'] }).efeito;
  assert.deepEqual([mpd.maisSangramentoPct, mpd.maisVenenoPct, mpd.maisDanoAcertoPct, mpd.maisDanoPct ?? 0], [49, 49, 49, 0], 'o "Físico Corpo a Corpo": só no acerto; o Sangramento/Veneno pela linha deles');
  assert.equal(ef('Lethal_Dose_Support', 15).maisVenenoPct, -2, 'a Dose Letal: menos só no Veneno');
  assert.equal(ef('Unbound_Ailments_Support', 20, 20)['af:ailment_duration'], 64);
  assert.equal(ef('Combustion_Support')['af:chance_ignite'], 25);
  for (const s of ['Chance_to_Bleed_Support', 'Vile_Toxins_Support', 'Deadly_Ailments_Support', 'Burning_Damage_Support', 'Melee_Physical_Damage_Support', 'Unbound_Ailments_Support', 'Ignite_Proliferation_Support']) {
    for (const k of ['ignitePct', 'venenoPct', 'sangramentoPct']) assert.equal(ef(s)[k], undefined, `${s}: ${k} do dano contínuo antigo`);
  }
});

test('o "mais" de cada afecção: o da afecção × o de "de Afecções" (merge com o lote G17: os fatores das afecções do acerto, `fatoresDoDano`)', { skip: SEM }, () => {
  const incendio = (fatoresDoDano) => {
    const bicho = { uid: 1, hp: 1e9, maxHp: 1e9, estados: {}, dots: [] };
    AfeccoesPoe.aoAcertar(bicho, [{ elemento: 'fire', dano: 1000 }], { afeccoes: AfeccoesPoe.daSoma({ chance_ignite: 100 }), agora: 1000, rng: () => 0, fatoresDoDano });
    return (bicho.dots ?? []).filter((x) => x.tipo === 'queimadura').reduce((n, x) => n + x.falta, 0);
  };
  const sem = incendio(null);
  assert.ok(sem > 0);
  assert.ok(Math.abs(incendio({ todas: 1.44, incendio: 1.34 }) / sem - 1.34 * 1.44) < 1e-6, 'o Incêndio × o de Afecções');
  assert.ok(Math.abs(incendio({ veneno: 1.5, sangramento: 1.5 }) / sem - 1) < 1e-9, 'o de outra afecção não vale');
});

test('nas afecções do PoE: o "mais" e o "aumentado" do suporte só na afecção dele; a duração', { skip: SEM }, () => {
  const total = (tipo, extra) => {
    const bicho = { uid: 1, hp: 1e9, maxHp: 1e9, estados: {}, dots: [] };
    const a = { ...AfeccoesPoe.daSoma({ chance_poison: 100, chance_ignite: 100, chance_bleed: 100 }), ...extra };
    AfeccoesPoe.aoAcertar(bicho, [{ elemento: 'physical', dano: 1000 }, { elemento: 'fire', dano: 1000 }], { afeccoes: a, agora: 1000, rng: () => 0 });
    const d = (bicho.dots ?? []).filter((x) => x.tipo === tipo);
    return { total: d.reduce((n, x) => n + x.falta, 0), ate: Math.max(0, ...d.map((x) => x.ate ?? 0)) };
  };
  for (const [tipo, k] of [['venenoPoe', 'veneno'], ['queimadura', 'incendio'], ['sangramento', 'sangramento']]) {
    const sem = total(tipo, {});
    assert.ok(sem.total > 0, tipo);
    assert.ok(Math.abs(total(tipo, { maisDoSuporte: { [k]: 50 } }).total / sem.total - 1.5) < 0.01, `${tipo}: 50% mais`);
    const outro = k === 'veneno' ? 'incendio' : 'veneno';
    assert.ok(Math.abs(total(tipo, { maisDoSuporte: { [outro]: 50 } }).total - sem.total) < 1e-6, `${tipo}: o "mais" de outra afecção não vale`);
    assert.ok(total(tipo, { aumDoSuporte: { [k]: 10 } }).total > sem.total, `${tipo}: o aumentado`);
  }
  assert.ok(total('venenoPoe', { duracao: 50 }).ate > total('venenoPoe', {}).ate, 'a duração aumentada');
});

test('de ponta a ponta: a gema ligada ao Chance de Envenenar põe o Veneno do PoE (não o dano contínuo antigo)', { skip: SEM }, () => {
  const e = Object.assign(personagemDeTeste({ vocacao: 'sorcerer', level: 90 }), { sistema: 'poe', classePoe: 'Witch' });
  const arma = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Wands/Driftwood_Wand', raridade: 'normal', ilvl: 20, rng: () => 0.99 }));
  arma.soquetes = { abertos: 2, links: [true], gemas: [null, null], cores: ['W', 'W'] };
  e.equipment = { ...(e.equipment ?? {}), weapon: arma };
  e.inventory = [GS.itemDaGema({ id: G.doSlug('Essence_Drain').itemId, nivel: 10, xp: 0, raridade: 'comum' }), GS.itemDaGema({ id: S.doSlug('Chance_to_Poison_Support').itemId, nivel: 20, xp: 0, raridade: 'comum' })];
  GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
  GS.encaixar(e, { de: 0, slot: 'weapon', indice: 1 });
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: G.doSlug('Essence_Drain').acao, enabled: true, minMana: 0, conditions: [] };
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 1e6;
  e.maxHp = e.hp = 1e6;
  P.garantir(e);
  assert.ok((GS.efeitoNaSkill(e, e.actions[0].id)['af:chance_poison'] ?? 0) >= 40, 'o suporte está ligado');
  const [b] = e.hunt.monstros;
  Object.assign(b, { x: e.hunt.pos.x + 2, y: e.hunt.pos.y, hp: 1e9, maxHp: 1e9, dots: [] });
  const original = Math.random;
  Math.random = () => 0.01; // a chance de 40% acerta
  try {
    e.hunt.clock += 10_000;
    const r = Acoes.disparar(e, e.hunt, PERSONAGEM, 0, b, { manual: true });
    assert.ok(r.ok, r.erro);
    if (r.conjurando) { e.hunt.clock += 3000; Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM); }
  } finally {
    Math.random = original;
  }
  const tipos = (b.dots ?? []).filter((d) => d.falta > 0).map((d) => d.tipo);
  assert.ok(tipos.includes('venenoPoe'), `o Veneno do PoE: ${tipos}`);
  assert.ok(!tipos.includes('veneno'), 'não o veneno antigo do Draevor');
});

/** Uma Bruxa do PoE com a Bola de Fogo (+ os suportes) ligada na varinha; um tiro no bicho com o sorteio travado. `{ acerto, incendio }`. */
function bolaDeFogo(suportes = []) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'sorcerer', level: 90 }), { sistema: 'poe', classePoe: 'Witch' });
  const n = 1 + suportes.length;
  const arma = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Wands/Driftwood_Wand', raridade: 'normal', ilvl: 20, rng: () => 0.99 }));
  arma.soquetes = { abertos: n, links: Array.from({ length: n - 1 }, () => true), gemas: Array(n).fill(null), cores: Array(n).fill('W') };
  e.equipment = { ...(e.equipment ?? {}), weapon: arma };
  e.inventory = [GS.itemDaGema({ id: G.doSlug('Fireball').itemId, nivel: 10, xp: 0, raridade: 'comum' }), ...suportes.map((s) => GS.itemDaGema({ id: S.doSlug(s).itemId, nivel: 20, xp: 0, raridade: 'comum' }))];
  for (let i = 0; i < n; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: G.doSlug('Fireball').acao, enabled: true, minMana: 0, conditions: [] };
  // (dono, 18/10: "Semear o entrar" — a raridade e os mods do monstro são sorteados ao entrar; sem a semente, o Incêndio variava — 3/10 falhas)
  const sorteio = Math.random;
  let semente = 12345;
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
  const [b] = e.hunt.monstros;
  Object.assign(b, { x: e.hunt.pos.x + 2, y: e.hunt.pos.y, hp: 1e9, maxHp: 1e9, dots: [], estados: {} });
  for (const o of e.hunt.monstros.slice(1)) Object.assign(o, { x: e.hunt.pos.x + 80, y: e.hunt.pos.y + 80 });
  const original = Math.random;
  let eventos = [];
  Math.random = () => 0.01;
  try {
    e.hunt.clock += 10_000;
    const r = Acoes.disparar(e, e.hunt, PERSONAGEM, 0, b, { manual: true });
    assert.ok(r.ok, r.erro);
    eventos = r.eventos ?? [];
    if (r.conjurando) { e.hunt.clock += 3000; eventos = Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM); }
  } finally {
    Math.random = original;
  }
  const acerto = eventos.filter((x) => x.t === 'dmg' && x.uid === b.uid && x.foe).reduce((t, x) => t + x.v, 0);
  const incendio = (b.dots ?? []).filter((d) => d.tipo === 'queimadura').reduce((t, d) => t + d.falta, 0);
  return { acerto, incendio };
}

test('de ponta a ponta: as Afecções Mortais — o acerto × 0,2 e o Incêndio × 1,44 (o "menos com Acertos" não corta a afecção)', { skip: SEM }, () => {
  const sem = bolaDeFogo();
  const com = bolaDeFogo(['Deadly_Ailments_Support']);
  assert.ok(sem.incendio > 0 && sem.acerto > 0, JSON.stringify(sem));
  assert.ok(Math.abs(com.incendio / sem.incendio - 1.44) < 0.03, `${com.incendio} / ${sem.incendio}`);
  assert.ok(com.acerto < sem.acerto * 0.25, `o acerto cai: ${com.acerto} / ${sem.acerto}`);
});

test('de ponta a ponta: o Dano Incendiário — o Incêndio × 1,34; o acerto não muda', { skip: SEM }, () => {
  const sem = bolaDeFogo();
  const com = bolaDeFogo(['Burning_Damage_Support']);
  assert.ok(Math.abs(com.incendio / sem.incendio - 1.34) < 0.03, `${com.incendio} / ${sem.incendio}`);
  assert.ok(Math.abs(com.acerto / sem.acerto - 1) < 0.02, `${com.acerto} / ${sem.acerto}`);
});

test('a Duração de Afecções aumentada também alonga o Congelamento e o Resfriamento', { skip: SEM }, () => {
  const estados = (extra) => {
    const bicho = { uid: 1, hp: 1e6, maxHp: 1e6, estados: {}, dots: [] };
    AfeccoesPoe.aoAcertar(bicho, [{ elemento: 'ice', dano: 500000 }], { afeccoes: { ...AfeccoesPoe.daSoma({ chance_freeze: 100 }), ...extra }, agora: 1000, rng: () => 0 });
    return { congelado: bicho.estados.congelado?.ate ?? 0, lento: bicho.estados.lento?.ate ?? 0 };
  };
  const sem = estados({});
  const com = estados({ duracao: 100 });
  assert.ok(sem.congelado > 1000 && com.congelado > sem.congelado, `congelado: ${sem.congelado} → ${com.congelado}`);
});
