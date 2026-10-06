// As GEMAS DO PoE no jogo (itens-poe/gemas-poe.mjs): as 562 da coleção do dono viram magias do Draevor (o molde do mesmo formato e elemento,
// os números do PoE pelo nível da gema), substituem as gemas ativas do Draevor no modo PoE, e cada uma tem o status no jogo. Precisa da
// coleção (`poe-gemas-poedb`) e do catálogo do PoE nesta máquina: sem eles, os testes são pulados.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !existsSync('/home/deploy/referencias-poe/poe-gemas-poedb/engine/dados/gemas.js')) && 'coleção de gemas / catálogo do PoE não estão nesta máquina';
const { ITEM_CATALOG, ACTION_CATALOG } = await import('../systems/dados.mjs');
const Acoes = await import('../systems/acoes.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const R = await import('../systems/skills/reforcos.mjs');
const G = await import('../systems/itens-poe/gemas-poe.mjs');
if (!SEM) {
  (await import('../systems/itens-poe/jogo.mjs')).iniciar(ITEM_CATALOG);
  await G.iniciar({ registrarGema: (g) => (Acoes.registrarAcao(g.entry), GS.registrarAtiva(g)), registrarReforco: R.registrar });
}

test('as 562 gemas viram magias do jogo com o molde do Draevor, item com ícone, e um status no jogo', { skip: SEM }, () => {
  assert.equal(G.REGISTRO.size, 562);
  const bola = G.doSlug('Fireball');
  const e = ACTION_CATALOG.spells.find((x) => x.id === bola.acao);
  assert.equal(bola.molde, 'spell-flame-strike', 'Bola de Fogo = o projétil de fogo do Draevor');
  assert.deepEqual([e.element, e.kind, !!e.projetil], ['fire', 'spell', true]);
  assert.equal(ITEM_CATALOG[bola.itemId].poeGema.icone, 'icones/Fireball.png');
  assert.equal(G.doSlug('Arc').molde, 'spell-forked-thorns', 'Arco = a corrente');
  assert.equal(G.doSlug('Raise_Zombie').statusNoJogo, 'nao', 'lacaio ainda não existe no jogo');
  const st = [...G.REGISTRO.values()].reduce((o, r) => ((o[r.statusNoJogo] = (o[r.statusNoJogo] ?? 0) + 1), o), {});
  assert.ok(st.funciona > 30 && st.parcial > 300 && st.nao < 120, JSON.stringify(st));
  for (const r of G.REGISTRO.values()) if (r.statusNoJogo !== 'funciona') assert.ok(r.motivosNoJogo.length, `${r.gema.slug}: sem motivo`);
});

test('os números do PoE pelo nível da gema: dano, custo, eficácia de ataque, chances de afecção', { skip: SEM }, () => {
  const d1 = G.danoNoNivel('Fireball', 1);
  const d20 = G.danoNoNivel('Fireball', 20);
  assert.ok(d20.min > d1.min * 10, `${d1.min} → ${d20.min}`);
  assert.ok(G.custoNoNivel('Fireball', 20) > G.custoNoNivel('Fireball', 1));
  assert.ok(G.eficaciaNoNivel('Cleave', 20) > 1, 'ataque: a arma × a eficácia');
  const af = G.afeccoesComAGema({ chance: { incendio: 0 } }, 'Fireball', 10);
  assert.equal(af.chance.incendio, 25, 'a chance de incendiar da gema entra no acerto');
});

test('aura e maldição viram reforço: os efeitos e os atributos do nível ficam no buff (dano adicionado, marca de vulnerável)', { skip: SEM }, () => {
  const ira = G.buffNoNivel('Wrath', 10);
  assert.ok(ira.af.added_energy_dmg_max > 0 && ira.efeitos.some((x) => x.efeito === 'dano'));
  const mordida = G.buffNoNivel('Frostbite', 10);
  assert.deepEqual(mordida.efeitos[0].tipos, ['ice']);
  assert.ok(mordida.efeitos[0].efeito === 'marcaVulneravel' && mordida.efeitos[0].pct > 0);
  const e = { hunt: { clock: 0, buffs: { 'poe-gema:Wrath': { ate: 1000, afPoe: ira.af } } } };
  assert.deepEqual(G.adds(e), ira.af);
  e.hunt.clock = 2000;
  assert.equal(G.adds(e), null, 'venceu: sai da ficha');
});

test('no modo PoE as gemas ativas do Draevor saem do drop (os suportes ficam) e o drop respeita o nível', { skip: SEM }, () => {
  let s = 1;
  const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  let n = 0;
  for (let i = 0; i < 4000; i++) {
    const g = GS.sortearDrop({ ato: 10, levelDaFase: 5, fatorDeChance: 1000 }, rng);
    if (!g) continue;
    const def = GS.defDaGema(g.id);
    if (def.tipo === 'support') continue;
    n++;
    assert.ok(def.poe, `${def.nome}: ativa do Draevor no drop do PoE`);
    assert.ok(def.levelMinimo <= 5, `${def.nome}: nível ${def.levelMinimo}`);
  }
  assert.ok(n > 50);
});

test('a ficha da gema para o balão: as propriedades e os modificadores com os números DO NÍVEL, e a qualidade', { skip: SEM }, () => {
  const f = G.fichaNoNivel('Fireball', 8, 10);
  assert.equal(f.nome, 'Bola de Fogo');
  assert.deepEqual(f.props.find(([r]) => r === 'Nível'), ['Nível', '8']);
  assert.deepEqual(f.props.find(([r]) => r === 'Custo'), ['Custo', `${G.custoNoNivel('Fireball', 8)} Mana`]);
  assert.ok(f.mods.some((m) => /^Causa \d+ a \d+ de Dano de Fogo$/.test(m)), f.mods.join(' | '));
  assert.ok(!f.mods.some((m) => m.includes('—')), 'sem faixa "(a — b)" no balão');
  assert.equal(f.qualidade, 10);
  assert.ok(f.modsDaQualidade.every((m) => !m.includes('—')));
  assert.equal(f.status, 'funciona');
  const max = G.fichaNoNivel('Fireball', 20);
  assert.match(max.props.find(([r]) => r === 'Nível')[1], /Máx/);
});

test('cada tipo de dano só escala com o seu "aumentado" (dono, 06/10): o físico não sobe o fogo; sem afinidade de classe do Draevor', { skip: SEM }, async () => {
  const { personagemDeTeste } = await import('./apoio.mjs');
  const Ficha = await import('../systems/ficha.mjs');
  const efeito = { nivel: 8, danoPct: 0, fatorDeDano: 1 };
  const acao = (slug) => ACTION_CATALOG.spells.find((x) => x.id === `poe-gema:${slug}`);
  const dano = (af, slug, vocacao = 'knight') => {
    const e = personagemDeTeste({ vocacao, level: 12 });
    e.hunt = { clock: 0, buffs: { teste: { ate: 1e12, afPoe: af } } };
    Ficha.invalidar?.(e);
    return Acoes.danoMostrado(e, acao(slug), efeito).min;
  };
  const puro = G.danoNoNivel('Fireball', 8).min;
  assert.equal(dano({}, 'Fireball'), puro);
  assert.equal(dano({}, 'Fireball', 'sorcerer'), puro, 'a afinidade de classe (Magia/Fogo +15%) do Draevor não entra');
  assert.equal(dano({ phys_dmg: 100 }, 'Fireball'), puro, 'dano físico aumentado não mexe no fogo');
  assert.equal(dano({ fire_dmg: 100 }, 'Fireball'), puro * 2);
  assert.equal(dano({ spell_dmg: 100 }, 'Fireball'), puro * 2);
  const abs = G.danoNoNivel('Absolution', 8).min;
  assert.equal(dano({ fire_dmg: 100 }, 'Absolution'), abs, 'fogo aumentado não mexe na magia física');
  assert.equal(dano({ spell_dmg: 100 }, 'Absolution'), abs * 2, 'magia física (tags physical+ranged) é MAGIA: o dano de magia vale');
  const cleave = dano({}, 'Cleave');
  assert.equal(dano({ spell_dmg: 100 }, 'Cleave'), cleave, 'dano de magia não vale no ataque');
  assert.ok(dano({ phys_dmg: 100 }, 'Cleave') > cleave * 1.8);
  assert.ok(!G.fichaNoNivel('Absolution', 8).mods[0].includes('.'), 'dano inteiro na ficha');
});

test('a gema do PoE nasce no nível 1 (drop e loja) e sobe pela tabela de XP do arquivo dela, travada pelo level que o nível pede', { skip: SEM }, () => {
  const id = G.doSlug('Fireball').itemId;
  const def = GS.defDaGema(id);
  assert.equal(GS.maximoDaGema(def), 20, 'máximo por XP: o 20 do PoE');
  assert.equal(GS.xpDaGema(def, 1), 70, 'do 1 ao 2: 70 de XP (poedb)');
  assert.equal(GS.xpDaGema(def, 2), 308);
  assert.equal(GS.levelDoNivel(def, 3), 4, 'o nível 3 pede level 4');
  // Loja: sempre nível 1, XP 0.
  const e = { level: 3, gold: 1e9, bank: 0, inventory: [], equipment: {} };
  assert.ok(GS.comprarNaLoja(e, { id, count: 1 }).ok);
  assert.deepEqual([e.inventory[0].gema.nivel, e.inventory[0].gema.xp], [1, 0]);
  // Drop: sempre nível 1.
  let s = 7;
  const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 3000; i++) { const g = GS.sortearDrop({ ato: 10, levelDaFase: 30, fatorDeChance: 1000 }, rng); if (g) assert.equal(g.gema.nivel, 1); }
  // XP: 70 leva ao 2; o 3 pede level 4 — com o personagem no 3 a XP enche e espera.
  const gema = { id, nivel: 1, xp: 0 };
  const est = { level: 3, equipment: { weapon: { id: 1, soquetes: { abertos: 1, links: [], gemas: [gema] } } } };
  GS.ganharXp(est, 70);
  assert.equal(gema.nivel, 2);
  GS.ganharXp(est, 10_000);
  assert.deepEqual([gema.nivel, gema.xp], [2, 308], 'XP cheia, esperando o level 4');
  est.level = 4;
  GS.ganharXp(est, 1);
  assert.equal(gema.nivel, 3, 'com o level, passa');
});

test('a loja do Zuma vende TODAS as gemas do PoE, para qualquer level, no nível 1', { skip: SEM }, () => {
  const lista = GS.catalogoDaLoja({ level: 1, inventory: [] }).filter((l) => l.categoria !== 'orbes');
  const doPoe = lista.filter((l) => GS.defDaGema(l.id)?.poe);
  assert.equal(new Set(doPoe.map((l) => l.id)).size, 562);
  assert.ok(lista.some((l) => l.nome.includes('Ira')), 'a Ira (pede level 24) aparece para o level 1');
});

test('transfiguradas e Vaal sem XP no arquivo sobem pela tabela da gema de base (como no PoE)', { skip: SEM }, () => {
  for (const [slug, base] of [['Explosive_Trap_of_Magnitude', 'Explosive_Trap'], ['Vaal_Cleave', 'Cleave'], ['Heavy_Strike_of_Trarthus', 'Heavy_Strike']]) {
    assert.equal(G.gemaDaTabelaDeXp(G.doSlug(slug).gema).slug, base);
    const def = GS.defDaGema(G.doSlug(slug).itemId);
    assert.equal(GS.maximoDaGema(def), 20, slug);
    assert.equal(GS.xpDaGema(def, 1), GS.xpDaGema(GS.defDaGema(G.doSlug(base).itemId), 1));
    assert.doesNotMatch(G.fichaNoNivel(slug, 1).props[0][1], /Máx/);
  }
  const vinte = [...G.REGISTRO.values()].filter((r) => GS.maximoDaGema(GS.defDaGema(r.itemId)) === 20).length;
  assert.ok(vinte >= 550, `${vinte} gemas sobem até o 20`);
});
