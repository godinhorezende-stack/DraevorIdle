// A EFICÁCIA DO ATAQUE como no PoE (dono, 20/10). No PoB (`CalcOffence.lua`, "Calculate base hit damage"), num ataque a ARMA entra × o `baseMultiplier`
// ("Dano de Ataque X% de base") e todo dano ADICIONADO — peças, passivas, auras, Arautos, suportes, Empalamento — × o `damageEffectiveness` do nível
// (`gamedata/itens-poe/pob-eficacia.json`, tabela `ataques` — `tools/importar-pob-eficacia.mjs`). Antes o adicionado do ataque entrava × 1.
// Juntos: "Adiciona X a Y de Dano Físico em Ataques" com +X no mínimo e +Y no máximo (antes a média, com o máximo 2×), e o "ganham X% de Dano Físico
// como Dano Extra de Fogo" do Dano Adicional de Fogo pelo Físico de fato do golpe (antes "Dano aumentado", só com a tag Físico na gema).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const Gerar = await import('../systems/itens-poe/gerar.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const GP = await import('../systems/itens-poe/gemas-poe.mjs');
const SP = await import('../systems/itens-poe/suportes-poe.mjs');
const Acoes = await import('../systems/acoes.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const { traduzirMod } = await import('../systems/itens-poe/traduzir.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  Jogo.iniciar(ITEM_CATALOG);
}

/** A peça do PoE da base; com `mods`, só esses prefixos (`[modelo, [valores]]`), sem implícito. */
function peca(base, mods = null) {
  const p = Gerar.gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 80, rng: () => 0.5 });
  if (mods) {
    p.implicitos = [];
    p.prefixos = mods.map(([modelo, v]) => ({ familia: 'X', tier: 1, nome: 'X', ilvl: 1, modelo, valores: v, texto: modelo.replace('{0}', v[0]).replace('{1}', v[1]) }));
    p.sufixos = [];
    p.raridade = 'magico';
  }
  return Jogo.pecaDoJogo(p);
}
const ANEL_FOGO = [['Adiciona {0} a {1} de Dano de Fogo em Ataques', [20, 40]]];
const ANEL_FISICO = [['Adiciona {0} a {1} de Dano Físico em Ataques', [10, 20]]];
const ESPADA = 'One_Hand_Swords/Midnight_Blade'; // 35–99, req. 68
const ARCO = 'Bows/Harbinger_Bow'; // 50–133, req. 68

/** Um Duelista nível 80 com a arma, a gema (nível 20) e, opcional, um suporte ligado (nível 20) e um anel. */
function montar(gema, base, { anel = null, suporte = null } = {}) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 80 }), { classePoe: 'Duelist' });
  const arma = peca(base);
  const slugs = [gema, ...(suporte ? [suporte] : [])];
  arma.soquetes = { abertos: slugs.length, links: slugs.slice(1).map(() => true), gemas: slugs.map(() => null), cores: slugs.map(() => 'W') };
  e.equipment = { ...e.equipment, weapon: arma };
  for (const s of ['shield', 'ring', 'neck']) delete e.equipment[s];
  if (anel) e.equipment.ring = peca('Rings/Iron_Ring', anel);
  e.inventory = slugs.map((s) => GS.itemDaGema({ id: (GP.doSlug(s) ?? SP.doSlug(s)).itemId, nivel: 20, xp: 0, raridade: 'comum' }));
  slugs.forEach((_, i) => GS.encaixar(e, { de: 0, slot: 'weapon', indice: i }));
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: GP.doSlug(gema).acao, enabled: true, minMana: 0, conditions: [] };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  return e;
}
const media = (e, slug) => { const d = Acoes.danoMostrado(e, Acoes.POR_ID_PUBLICO(GP.doSlug(slug).acao)); return (d.min + d.max) / 2; };

test('a eficácia do dano adicionado dos ATAQUES é a do PoB (damageEffectiveness); a arma segue × o "Dano de Ataque X% de base"', { skip: SEM }, () => {
  assert.equal(GP.eficaciaDoAdicionado('Cyclone', 20), 1.5);
  assert.equal(GP.eficaciaDoAdicionado('Lightning_Strike', 20), 4.56);
  assert.equal(GP.eficaciaDoAdicionado('Barrage', 20), 0.55, 'o damageEffectiveness do PoB (act_dex.lua: 0,55)');
  assert.equal(GP.eficaciaNoNivel('Barrage', 20), 0.546, 'a arma: o baseMultiplier (0,546)');
  assert.equal(GP.eficaciaDoAdicionado('Heavy_Strike', 10), 3.433);
  // as magias não mudam
  assert.equal(GP.eficaciaDoAdicionado('Fireball', 20), 4.8);
});

/*
 * Os números (dano médio por golpe no balão, Duelista nível 80, gema 20, anel "Adiciona 20 a 40 de Dano de Fogo em Ataques", Dano Adicional de Gelo 20 —
 * 152 a 228). ANTES (o adicionado × 1) → DEPOIS (× a eficácia):
 *   Cyclone (1,5):           só a arma 105 · anel 136,5 → 151,5 · suporte 302,5 → 401,5 · os dois 334 → 448
 *   Lightning Strike (4,56): só a arma 305,5 · anel 335,5 → 442,5 · suporte 495,5 → 1172 · os dois 525,5 → 1309
 *   Barragem (0,55):         só a arma 50 · anel 80 → 66,5 · suporte 240 → 154,5 · os dois 270 → 171
 */
test('o adicionado das peças e dos suportes nos ataques × a eficácia: Cyclone, Lightning Strike e Barragem (antes × 1)', { skip: SEM }, () => {
  const CASOS = [
    ['Cyclone', ESPADA, { so: 105, anel: 151.5, sup: 401.5, tudo: 448 }],
    ['Lightning_Strike', ESPADA, { so: 305.5, anel: 442.5, sup: 1172, tudo: 1309 }],
    ['Barrage', ARCO, { so: 50, anel: 66.5, sup: 154.5, tudo: 171 }],
  ];
  for (const [g, base, esperado] of CASOS) {
    const ef = GP.eficaciaDoAdicionado(g, 20);
    const so = media(montar(g, base), g);
    const anel = media(montar(g, base, { anel: ANEL_FOGO }), g);
    const sup = media(montar(g, base, { suporte: 'Added_Cold_Damage_Support' }), g);
    const tudo = media(montar(g, base, { anel: ANEL_FOGO, suporte: 'Added_Cold_Damage_Support' }), g);
    for (const [k, v] of Object.entries({ so, anel, sup, tudo })) assert.ok(Math.abs(v - esperado[k]) <= 1, `${g} ${k}: ${v} (esperado ${esperado[k]})`);
    // o anel soma 20 a 40 de Fogo (média 30) × a eficácia (± 5%: o arredondamento das pontas e os multiplicadores da gema e do personagem de teste)
    assert.ok(Math.abs((anel - so) / (30 * ef) - 1) <= 0.05, `${g}: o anel ${anel - so} ≈ 30 × ${ef}`);
    // o suporte soma 152 a 228 de Gelo (média 190) × a eficácia (± 5%)
    assert.ok(Math.abs((sup - so) / (190 * ef) - 1) <= 0.05, `${g}: o suporte ${sup - so} ≈ 190 × ${ef}`);
  }
});

test('"Adiciona X a Y de Dano Físico em Ataques": +X no mínimo e +Y no máximo, como no PoE (antes a média, com o máximo 2×)', { skip: SEM }, () => {
  const t = traduzirMod({ modelo: 'Adiciona {0} a {1} de Dano Físico em Ataques', valores: [10, 20] });
  assert.deepEqual([t.estado, t.efeitos], ['equivalente', [{ stat: 'phys_add_min', valor: 10 }, { stat: 'phys_add_max', valor: 20 }]]);
  assert.deepEqual(peca('Rings/Iron_Ring', ANEL_FISICO).poe.af, { phys_add_min: 10, phys_add_max: 20 });
  const sem = montar('Cyclone', ESPADA);
  const com = montar('Cyclone', ESPADA, { anel: ANEL_FISICO });
  // a Lâmina da Meia-Noite (35–99) + 10 a 20 = 45–119 (antes 50–129: a média 15 no mínimo e 30 no máximo)
  assert.deepEqual(Ficha.combate(sem).damage, { min: 35, max: 99 });
  assert.deepEqual(Ficha.combate(com).damage, { min: 45, max: 119 });
  // o Físico das peças está na faixa da arma do golpe: × a eficácia do ataque, como a arma
  assert.ok(media(com, 'Cyclone') > media(sem, 'Cyclone'));
});

test('o Dano Adicional de Fogo ("ganham X% de Dano Físico como Dano Extra de Fogo") no Cyclone com espada: pelo Físico do golpe, sem depender da tag', { skip: SEM }, () => {
  // o efeito do suporte: o ganho como extra no uso (antes "Dano aumentado", e só na gema com a tag Físico — o Cyclone ficava com 0)
  const e = montar('Cyclone', ESPADA, { suporte: 'Added_Fire_Damage_Support' });
  const ef = GS.efeitoNaSkill(e, Acoes.POR_ID_PUBLICO(GP.doSlug('Cyclone').acao).id);
  assert.equal(ef['af:phys_as_extra_fire'], 39, 'nível 20: 39%');
  assert.equal(ef.danoPct ?? 0, 0);
  const so = media(montar('Cyclone', ESPADA), 'Cyclone');
  const com = media(e, 'Cyclone');
  // 105 → 145: o Físico do golpe (105) + 39% dele como Fogo (≈ 41) — o Duelista de teste tem "aumentado" de Físico pela Força, que o Fogo não leva
  assert.ok(Math.abs(com - 145) <= 1, `${so} → ${com}`);
  assert.ok(com > so * 1.3, `${com} > ${so} × 1,3`);
  // o Gelo em Fogo: o mesmo ganho, do Gelo
  assert.equal(SP.efeitoNoNivel('Cold_to_Fire_Support', 20, 0, { tags: ['poe:Ataque'] }).efeito['af:ice_as_extra_fire'] > 0, true);
});

// ---------------------------------------------------------------- revisão adversarial do lote (20/10)

test('revisão: o Físico LOCAL da arma — "Adiciona X a Y de Dano Físico" e "Dano Físico aumentado em X%" na base da própria arma, com a qualidade', { skip: SEM }, () => {
  const ESP = 'One_Hand_Swords/Midnight_Blade'; // 35–99
  const so = (mods) => peca(ESP, mods);
  const flat = so([['Adiciona {0} a {1} de Dano Físico', [17, 27]]]);
  assert.deepEqual(flat.base.attack, [52, 126], '35 + 17, 99 + 27');
  assert.equal(flat.poe.af.phys_add_min, undefined, 'não é o adicionado global');
  const pct = so([['Dano Físico aumentado em {0}%', [15]]]);
  assert.deepEqual(pct.base.attack, [40, 114], '35 × 1,15, 99 × 1,15');
  assert.equal(pct.poe.af.phys_dmg, undefined, 'não é o aumentado global');
  const os2 = so([['Adiciona {0} a {1} de Dano Físico', [10, 20]], ['Dano Físico aumentado em {0}%', [50]]]);
  assert.deepEqual(os2.base.attack, [68, 179], '(35 + 10) × 1,5, (99 + 20) × 1,5');
  // a qualidade soma com o % local: (35 + 10) × (1 + 0,5 + 0,2)
  os2.poe.qualidade = 20;
  Jogo.recalcular(os2);
  assert.deepEqual(os2.base.attack, [77, 202]);
  // no golpe: a faixa da arma
  const e = montar('Cyclone', ESP);
  e.equipment.weapon = { ...flat, soquetes: e.equipment.weapon.soquetes };
  Ficha.invalidar(e);
  assert.deepEqual(Ficha.combate(e).damage, { min: 52, max: 126 });
});

test('revisão: o Físico adicionado global também nas gemas de escudo e na Lâmina de Energia (× a eficácia)', { skip: SEM }, () => {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 80 }), { classePoe: 'Duelist' });
  const arma = peca('One_Hand_Swords/Rusted_Sword');
  arma.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
  e.equipment = { ...e.equipment, weapon: arma, shield: peca('Shields/Splintered_Tower_Shield') };
  delete e.equipment.ring;
  e.inventory = [GS.itemDaGema({ id: GP.doSlug('Shield_Crush').itemId, nivel: 20, xp: 0, raridade: 'comum' })];
  GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: GP.doSlug('Shield_Crush').acao, enabled: true, minMana: 0, conditions: [] };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  const sem = media(e, 'Shield_Crush');
  e.equipment.ring = peca('Rings/Iron_Ring', [['Adiciona {0} a {1} de Dano Físico em Ataques', [100, 200]]]);
  Ficha.invalidar(e);
  const com = media(e, 'Shield_Crush');
  // 150 de média × a eficácia (e o "aumentado" do Físico do personagem de teste, ≥ 1)
  assert.ok(com - sem >= 150 * GP.eficaciaDoAdicionado('Shield_Crush', 20) * 0.95, `${sem} → ${com}`);
});

test('revisão: "…contra Inimigos Sangrando" é Físico adicionado no acerto; "…de Maças e Cetros" vale com Cetro; a Caneta do Poeta pelo nível', { skip: SEM }, async () => {
  const sang = traduzirMod({ modelo: 'Adiciona {0} a {1} de Dano Físico contra Inimigos Sangrando', valores: [10, 20] });
  assert.deepEqual(sang.efeitos.map((x) => x.stat), ['added_physical_dmg_min@alvoSangrando', 'added_physical_dmg_max@alvoSangrando']);
  assert.notEqual(sang.estado, 'registrado');
  const e = montar('Cyclone', ESPADA);
  e.equipment.ring = peca('Rings/Iron_Ring', [['Adiciona {0} a {1} de Dano Físico contra Inimigos Sangrando', [10, 20]]]);
  Ficha.invalidar(e);
  const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
  const f = Ficha.combate(e);
  const sangrando = { hp: 100, maxHp: 100, estados: {}, dots: [{ tipo: 'sangramento', falta: 1000 }] };
  // na gema: o `golpeNoAlvo` dá o Físico ao `ajusteDoAlvo.somado` (× a eficácia, como a Marca do Caçador); sem o sangramento, nada
  const g = ModsPoe.golpeNoAlvo(f, sangrando, 0);
  assert.deepEqual([g.s.added_physical_dmg_min, g.s.added_physical_dmg_max], [10, 20]);
  assert.equal(ModsPoe.golpeNoAlvo(f, { ...sangrando, dots: [] }, 0).s.added_physical_dmg_min, undefined);
  // no golpe básico: o Físico somado da ficha do golpe (`danoSomadoDoPoe`)
  assert.deepEqual(ModsPoe.fichaDoGolpe(f, ['ataque'], { alvo: sangrando, estado: e }).danoSomado?.physical, [10, 20]);
  // Maças e Cetros: com um Cetro, o anel soma +10/+20 na faixa da arma
  const cetro = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 80 }), { classePoe: 'Templar' });
  cetro.equipment = { weapon: peca('Sceptres/Driftwood_Sceptre') };
  Ficha.invalidar(cetro);
  const antes = Ficha.combate(cetro).damage;
  cetro.equipment.ring = peca('Rings/Iron_Ring', [['Adiciona {0} a {1} de Dano Físico aos Ataques de Maças e Cetros', [10, 20]]]);
  Ficha.invalidar(cetro);
  assert.deepEqual(Ficha.combate(cetro).damage, { min: antes.min + 10, max: antes.max + 20 });
  // a Caneta do Poeta: 3 a 5 a cada 3 níveis do personagem
  const pena = traduzirMod({ modelo: 'Adiciona {0} a {1} de Dano Físico em Ataques com esta Arma a cada {2} Níveis do Jogador', valores: [3, 5, 3] });
  assert.deepEqual(pena.efeitos, [{ stat: 'phys_add_min%nivel:3', valor: 3 }, { stat: 'phys_add_max%nivel:3', valor: 5 }]);
  assert.notEqual(pena.estado, 'registrado');
});

test('revisão: os suportes de ganho e de conversão como o PoB — o ganho sobre o dano de ANTES da conversão, a conversão do suporte, a qualidade por tipo', { skip: SEM }, async () => {
  const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
  // o Gelo em Fogo nível 20: 50% do Gelo convertido em Fogo e 29% do Gelo ganho como Fogo — 100 de Gelo dão 50 de Gelo e 79 de Fogo (antes, 64,5)
  const gf = SP.efeitoNoNivel('Cold_to_Fire_Support', 20, 0, { tags: ['poe:Ataque'] }).efeito;
  assert.deepEqual([gf['af:conv_hab_ice_fire'], gf['af:ice_as_extra_fire']], [50, 29]);
  const p = ModsPoe.transformarPartes({ afPoe: { conv_hab_ice_fire: 50, ice_as_extra_fire: 29 } }, { ice: [100, 100] });
  assert.deepEqual(p.ice.map((x) => Math.round(x * 10) / 10), [50, 50]);
  assert.deepEqual(p.fire.map((x) => Math.round(x * 10) / 10), [79, 79]);
  // o Físico em Raio nível 20: 50% convertido (com a conversão da gema) e 29% ganho do Físico de antes — o Cyclone (1,5) com 100 de arma: 75 Físico e 118,5 de Raio
  const fr = SP.efeitoNoNivel('Physical_to_Lightning_Support', 20, 0, { tags: ['poe:Ataque'] }).efeito;
  assert.deepEqual([fr['af:conv_hab_physical_energy'], fr['af:phys_as_extra_energy']], [50, 29]);
  const partes = GP.partesDoAtaque('Cyclone', 20, { min: 100, max: 100 }, {}, () => 0.5, { conversoesExtras: GP.conversoesDosSuportes(fr), outras: (fis, teto) => ModsPoe.extrasDoFisico({ afPoe: { phys_as_extra_energy: 29 } }, fis, () => 0.5, teto) });
  assert.deepEqual([Math.round(partes.physical[0] * 10) / 10, Math.round(partes.energy[0] * 10) / 10], [75, 118.5]);
  // a qualidade: "causam (0—10)% de Dano de Fogo aumentado" — o aumentado de Fogo do uso, sem depender de tag (antes, `danoPct` no dano todo)
  const q = SP.efeitoNoNivel('Added_Fire_Damage_Support', 20, 20, { tags: ['poe:Ataque', 'poe:Corpo a Corpo'] }).efeito;
  assert.equal(q['af:fire_dmg'], 10);
  assert.equal(q.danoPct ?? 0, 0);
});

test('revisão: a Rajada Vulcânica leva o dano adicionado aos ataques (× a eficácia dela) e converte 60% do Físico', { skip: SEM }, async () => {
  const Cacadas = await import('../systems/cacadas.mjs');
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 80 }), { classePoe: 'Duelist' });
  const arma = peca('One_Hand_Swords/Rusted_Sword');
  arma.poe.af = { ...(arma.poe.af ?? {}), rajada_vulcanica: 20, nunca_critico: 1 };
  e.equipment = { weapon: arma };
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  e.actions = Array(Acoes.SLOTS).fill(null);
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.clock = 100_000;
  e.maxHp = e.hp = 1e6;
  const h = e.hunt;
  const [a, ...outros] = h.monstros;
  for (const o of outros) Object.assign(o, { x: h.pos.x + 60, y: h.pos.y + 60 });
  Object.assign(a, { x: h.pos.x + 1, y: h.pos.y, hp: 1e9, maxHp: 1e9, estados: {}, dots: [], evasao: 0 });
  const golpe = () => { h.clock += 1000; Ficha.invalidar(e); const ev = []; Acoes.rajadaVulcanica(e, h, a, ev, () => 0.5); return ev.filter((x) => x.t === 'dmg' && x.uid === a.uid).reduce((t, x) => t + x.v, 0); };
  const sem = golpe();
  e.equipment.ring = peca('Rings/Iron_Ring', [['Adiciona {0} a {1} de Dano de Fogo em Ataques', [100, 200]]]);
  const com = golpe();
  assert.ok(sem > 0 && com > sem * 1.5, `${sem} → ${com}: os 4 projéteis com 150 × 2 de Fogo a mais`);
});
