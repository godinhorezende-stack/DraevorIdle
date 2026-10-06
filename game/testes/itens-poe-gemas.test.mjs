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
const SP = await import('../systems/itens-poe/suportes-poe.mjs');
const SEM_SUPORTES = SEM || (!existsSync('/home/deploy/referencias-poe/poe-suportes-poedb/suportes.json') && 'suportes do PoE não baixados (node tools/baixar-suportes-poedb.mjs)');
if (!SEM) {
  (await import('../systems/itens-poe/jogo.mjs')).iniciar(ITEM_CATALOG);
  await G.iniciar({ registrarGema: (g) => (Acoes.registrarAcao(g.entry), GS.registrarAtiva(g)), registrarReforco: R.registrar });
  SP.iniciar({ registrarSuporte: GS.registrarSuporte });
}

test('as 562 gemas viram magias do jogo com o molde do Draevor, item com ícone, e um status no jogo', { skip: SEM }, () => {
  assert.equal(G.REGISTRO.size, 562);
  const bola = G.doSlug('Fireball');
  const e = ACTION_CATALOG.spells.find((x) => x.id === bola.acao);
  assert.equal(bola.molde, 'spell-flame-strike', 'Bola de Fogo = o projétil de fogo do Draevor');
  assert.deepEqual([e.element, e.kind, !!e.projetil], ['fire', 'spell', true]);
  assert.equal(ITEM_CATALOG[bola.itemId].poeGema.icone, 'icones/Fireball.png');
  assert.equal(G.doSlug('Arc').molde, 'spell-forked-thorns', 'Arco = a corrente');
  assert.equal(G.doSlug('Raise_Zombie').statusNoJogo, 'parcial', 'o lacaio invoca (as habilidades próprias dele ainda não)');
  const st = [...G.REGISTRO.values()].reduce((o, r) => ((o[r.statusNoJogo] = (o[r.statusNoJogo] ?? 0) + 1), o), {});
  assert.ok(st.funciona > 30 && st.parcial > 300 && st.nao < 40, JSON.stringify(st));
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
  const doPoe = lista.filter((l) => GS.defDaGema(l.id)?.poe && GS.defDaGema(l.id).tipo === 'ativa');
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

test('os tempos do PoE: conjuração, velocidade de ataque da gema, recarga e cargas — sem o cooldown global do Draevor', { skip: SEM }, async () => {
  const { personagemDeTeste } = await import('./apoio.mjs');
  const e = personagemDeTeste({ vocacao: 'knight', level: 20 });
  const t = (slug) => Acoes.temposDaGemaPoe(e, ACTION_CATALOG.spells.find((x) => x.id === `poe-gema:${slug}`), { nivel: 1 });
  assert.deepEqual([t('Fireball').uso, t('Fireball').recarga], [750, 0], 'Bola de Fogo: 0,75 s de conjuração, sem recarga');
  assert.deepEqual([t('Frost_Bomb').uso, t('Frost_Bomb').recarga], [500, 2500]);
  assert.deepEqual([t('Flame_Dash').recarga, t('Flame_Dash').cargas], [3500, 3], 'Avanço Flamejante: 3,5 s, 3 usos');
  const golpe = (await import('../systems/ficha.mjs')).combate(e).intervaloDoGolpeMs;
  assert.equal(t('Cleave').uso, Math.round(golpe / 0.8), 'Cleave: o golpe da arma ÷ 80%');
  const fb = ACTION_CATALOG.spells.find((x) => x.id === 'poe-gema:Fireball');
  assert.equal(fb.cooldown, 0, 'o catálogo não inventa recarga');
});

// ---------------------------------------------------------------- os SUPORTES do PoE e os gatilhos

/** Um personagem numa caçada do Ato 1 com as gemas `[ativa|suporte]` (slugs) ligadas na varinha. */
async function comGemas(slugs, { crit = 0 } = {}) {
  const J = await import('../systems/itens-poe/jogo.mjs');
  const Cat = await import('../systems/itens-poe/catalogo.mjs');
  const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
  const Cacadas = await import('../systems/cacadas.mjs');
  const Ficha = await import('../systems/ficha.mjs');
  const Afixos = await import('../systems/afixos.mjs');
  const { personagemDeTeste } = await import('./apoio.mjs');
  (await import('../systems/itens-poe/campanha.mjs')).iniciar();
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 40 });
  e.classePoe = 'Witch';
  const arma = J.pecaDoJogo(gerarPeca({ catalogo: Cat.catalogo(), regras: Cat.REGRAS, base: 'Wands/Driftwood_Wand', raridade: 'normal', ilvl: 20, rng: () => 0.99 }));
  arma.soquetes = { abertos: slugs.length, links: slugs.slice(1).map(() => true), gemas: slugs.map(() => null) };
  e.equipment = { ...(e.equipment ?? {}), weapon: arma };
  e.inventory = slugs.map((s) => GS.itemDaGema({ id: (G.doSlug(s) ?? SP.doSlug(s)).itemId, nivel: 10, xp: 0, raridade: 'comum' }));
  slugs.forEach((_, i) => GS.encaixar(e, { de: 0, slot: 'weapon', indice: i }));
  Ficha.invalidar(e); Afixos.sincronizarMaximos(e); e.mana = 99999; e.maxMana = 99999;
  Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' });
  if (crit) { e.hunt.buffs = { teste: { ate: 1e15, afPoe: { crit_chance: crit } } }; Ficha.invalidar(e); }
  return e;
}

test('os 260 suportes do PoE viram gemas de suporte, com o status no jogo e a compatibilidade pelas tags do PoE', { skip: SEM_SUPORTES }, () => {
  assert.equal(SP.REGISTRO.size, 260);
  const st = [...SP.REGISTRO.values()].reduce((o, r) => ((o[r.status] = (o[r.status] ?? 0) + 1), o), {});
  assert.ok(st.funciona > 40 && st.parcial > 100, JSON.stringify(st));
  assert.equal(SP.doSlug('Cast_On_Critical_Strike_Support').status, 'funciona');
  assert.equal(SP.doSlug('Minion_Damage_Support')?.status, 'funciona', 'o suporte de dano de lacaio vale nos lacaios');
  assert.equal(SP.doSlug('Trap_Support')?.status ?? 'nao', 'nao', 'armadilha ainda não existe no jogo');
  const def = (s) => GS.defDaGema(SP.doSlug(s).itemId);
  assert.deepEqual(def('Cast_On_Critical_Strike_Support').suporte.requer, ['poe:Magia'], 'o gatilho restringe só a magia que ativa');
  assert.ok(def('Faster_Projectiles_Support')?.suporte.requer.includes('poe:Projétil') ?? true);
  // A loja e o drop do modo PoE: só os suportes do PoE.
  const loja = GS.catalogoDaLoja({ level: 1, inventory: [] }).filter((l) => GS.defDaGema(l.id)?.tipo === 'support');
  assert.ok(loja.length >= 250 && loja.every((l) => GS.defDaGema(l.id).poe), 'os suportes do Draevor saem da loja');
});

test('o efeito do suporte no nível: "mais/menos" multiplica, custo, velocidade, projéteis, nível extra', { skip: SEM_SUPORTES }, () => {
  const magia = { tags: ['poe:Magia', 'poe:Projétil', 'poe:Fogo'] };
  const gmp = SP.efeitoNoNivel('Greater_Multiple_Projectiles_Support', 10, 0, magia).efeito;
  assert.equal(gmp.alvosExtras, 4);
  assert.ok(gmp.maisDanoPct < 0 && gmp.custoPct === 50);
  assert.ok(SP.efeitoNoNivel('Faster_Casting_Support', 10, 0, magia).efeito.castTimePct < -15);
  assert.equal(SP.efeitoNoNivel('Faster_Casting_Support', 10, 0, { tags: ['poe:Ataque'] }).efeito.castTimePct, undefined, 'conjuração não vale no ataque');
  assert.equal(SP.efeitoNoNivel('Empower_Support', 2, 0, magia).efeito.nivelExtra, 1);
  const cwdt = SP.fichaNoNivel('Cast_when_Damage_Taken_Support', 1).gatilho;
  assert.deepEqual(cwdt, { quando: 'danoRecebido', recargaMs: 250, limiar: 528 }, 'limiar do nível 1 do PoE');
});

test('Conjurar no Acerto Crítico: o crítico do ataque ligado ativa a magia ligada (e ela não sai à mão)', { skip: SEM_SUPORTES }, async () => {
  const e = await comGemas(['Kinetic_Bolt', 'Cast_On_Critical_Strike_Support', 'Fireball'], { crit: 50 });
  const bola = G.doSlug('Fireball').acao;
  assert.equal(GS.ativadaPor(e, bola), 'Conjurar no Acerto Crítico');
  e.actions = Array(22).fill(null);
  e.actions[0] = { id: G.doSlug('Kinetic_Bolt').acao, enabled: true, minMana: 0, conditions: [] };
  e.actions[1] = { id: bola, enabled: true, minMana: 0, conditions: [] };
  const Cacadas = await import('../systems/cacadas.mjs');
  const { PERSONAGEM } = await import('./apoio.mjs');
  let agora = Date.now();
  const ev = [];
  for (let t = 0; t < 320 && e.hunt; t++) ev.push(...(Cacadas.tique(e, PERSONAGEM, (agora += 250)) ?? []));
  const ativadas = ev.filter((x) => x.t === 'gatilho').length;
  assert.ok(ativadas > 5, `${ativadas} magias ativadas`);
  assert.equal(ev.filter((x) => x.t === 'cast' && x.skill === 'Bola de Fogo').length, 0, 'a magia ativada não se conjura à mão');
});

test('Conjurar ao Receber Dano: soma o dano recebido e, no limiar do nível, ativa a magia ligada', { skip: SEM_SUPORTES }, async () => {
  const e = await comGemas(['Cast_when_Damage_Taken_Support', 'Arc']);
  const { PERSONAGEM } = await import('./apoio.mjs');
  const limiar = SP.fichaNoNivel('Cast_when_Damage_Taken_Support', 10).gatilho.limiar;
  // Um bicho do lado, para a magia ter alvo.
  const bicho = e.hunt.monstros.find((b) => b.hp > 0);
  e.hunt.pos = { ...e.hunt.pos, x: bicho.x + 1, y: bicho.y };
  assert.equal(Acoes.aoReceberDano(e, e.hunt, PERSONAGEM, limiar - 1), 0, 'abaixo do limiar: nada');
  const ev = [];
  assert.equal(Acoes.aoReceberDano(e, e.hunt, PERSONAGEM, 1, ev), 1, 'no limiar: a magia sai');
  assert.equal(ev[0].t, 'gatilho');
  assert.equal(Acoes.aoReceberDano(e, e.hunt, PERSONAGEM, limiar), 0, 'dentro da recarga do gatilho: espera');
});

test('o visual das gemas: cada uma com o estilo dela (muito menos repetição), a Nova de Gelo pega quem está colado, e o combate da arena', { skip: SEM }, async () => {
  const Ef = await import('../systems/efeitos-visuais.mjs');
  const combos = new Set([...G.REGISTRO.values()].map((r) => { const v = Ef.visualDaSkill(r.acao, { skills: {}, presets: {}, assets: {} }); return JSON.stringify([v?.projetil?.sprite?.id, v?.impacto?.sprite?.id, v?.area?.sprite?.id, v?.lancamento?.sprite?.id]); }));
  assert.ok(combos.size > 60, `${combos.size} visuais diferentes`);
  const nova = ACTION_CATALOG.spells.find((x) => x.id === G.doSlug('Ice_Nova').acao);
  assert.ok(nova.forma.some(([x, y]) => Math.max(Math.abs(x), Math.abs(y)) === 1), 'a nova é cheia (pega as casas coladas)');
  const Arena = await import('../admin/arena-efeitos.mjs');
  const r = Arena.combate({ skill: G.doSlug('Arc').acao, mobs: 5, segundos: 6 });
  assert.ok(r.ok, r.erros?.join(' '));
  assert.equal(r.quadros.length, 25, 'um quadro por tique (250 ms)');
  assert.ok(r.usos > 0 && r.mortes > 0, `usos ${r.usos}, mortes ${r.mortes}`);
  const longe = r.quadros.flatMap((q) => q.mobs.map((m) => Math.max(Math.abs(m.x - q.pos.x), Math.abs(m.y - q.pos.y))));
  assert.ok(Math.max(...longe) <= 8, 'os bichos ficam perto (a tela mostra ±6)');
});

test('os alvos da gema pelo nível dela: o Arco salta +4 (nv 1) a +7 (nv 20), mais 2 com o suporte de Corrente; o Disparo Congelante perfura', { skip: SEM_SUPORTES }, async () => {
  const Arena = await import('../admin/arena-efeitos.mjs');
  const mobs = (slug, nivel, suportes = []) => {
    const r = Arena.simular({ skill: G.doSlug(slug).acao, nivel, suportes, alvos: 10, distancia: 2, direcao: 'l' });
    assert.ok(r.ok, r.erros?.join(' '));
    return new Set(r.eventos.filter((e) => e.t === 'dmg' && e.foe).map((e) => e.uid)).size;
  };
  assert.equal(mobs('Arc', 1), 5, '1 + 4 ricochetes');
  assert.equal(mobs('Arc', 20), 8, '1 + 7 ricochetes');
  assert.equal(mobs('Arc', 10, ['Chain_Support']), mobs('Arc', 10) + 2, 'o suporte de Corrente vale no Arco (Ricochete, sem ser projétil)');
  assert.deepEqual(G.alvosNoNivel('Arc', 1), { saltos: 4, pctPorRestante: 15, perfurar: 0, projeteis: 0, bifurcar: 0, divide: 0 });
  assert.equal(G.alvosNoNivel('Frostbolt', 1).perfurar, 99, '"Perfuram todos os alvos"');
  assert.ok(!G.fichaNoNivel('Arc', 1).naoFeitas.some((l) => /Ricochete/i.test(l)), 'o ricochete saiu de "não simulado"');
});

test('lacaios e totens do PoE: o que a gema invoca no nível dela, eles batem e matam, e o totem usa a skill da gema', { skip: SEM_SUPORTES }, async () => {
  const L = await import('../systems/itens-poe/lacaios-poe.mjs');
  const z1 = L.oQueInvoca('Raise_Zombie', 1);
  const z20 = L.oQueInvoca('Raise_Zombie', 20);
  assert.deepEqual([z1.tipo, z1.nome, z1.maximo, z20.maximo], ['lacaio', 'Zumbi', 3, 6], '"Máximo de (3 — 6) Zumbis"');
  assert.ok(z20.vida > z1.vida * 10, 'o zumbi do nível 20 é bem mais forte');
  const esq = L.oQueInvoca('Summon_Skeletons', 1);
  assert.deepEqual([esq.porUso, esq.duracaoMs], [2, 20000], '"Convoca 2 Guerreiros Esqueleto", 20 s');
  assert.equal(L.oQueInvoca('Holy_Flame_Totem', 1).tipo, 'totem');
  const comSuporte = L.oQueInvoca('Raise_Zombie', 10, { lacaioDanoPct: 50 });
  assert.ok(comSuporte.dano.max > L.oQueInvoca('Raise_Zombie', 10).dano.max * 1.4, 'o suporte de dano de lacaio vale');
  assert.notEqual(G.doSlug('Raise_Zombie').statusNoJogo, 'nao', 'a invocação não é mais bloqueada');
  const Arena = await import('../admin/arena-efeitos.mjs');
  const r = Arena.combate({ skill: G.doSlug('Raise_Zombie').acao, nivel: 10, mobs: 5, segundos: 10 });
  assert.ok(r.ok, r.erros?.join(' '));
  const maxEmCampo = Math.max(...r.quadros.map((q) => q.lacaios.length));
  assert.equal(maxEmCampo, L.oQueInvoca('Raise_Zombie', 10).maximo, 'invoca até o máximo da gema e para');
  assert.ok(r.quadros.flatMap((q) => q.eventos).some((e) => e.t === 'dmg' && e.lacaio && e.foe), 'os zumbis batem');
  const t = Arena.combate({ skill: G.doSlug('Holy_Flame_Totem').acao, nivel: 10, mobs: 5, segundos: 8 });
  assert.ok(t.quadros.flatMap((q) => q.eventos).some((e) => e.t === 'dmg' && e.lacaio && e.foe && e.sk), 'o totem acerta com a skill da gema');
});

test('as habilidades próprias dos lacaios: de longe/de perto, área, crítico da gema, oferenda, e os golens dando bônus ao dono', { skip: SEM_SUPORTES }, async () => {
  const L = await import('../systems/itens-poe/lacaios-poe.mjs');
  assert.equal(L.oQueInvoca('Summon_Skeletons_of_Mages', 10).estilo.alcance, 5, 'mago ataca de longe');
  assert.equal(L.oQueInvoca('Raise_Zombie', 10).estilo.area.cada, 4, 'a pancada do zumbi a cada 4');
  assert.equal(L.oQueInvoca('Summon_Raging_Spirit_of_Enormity', 10).critChance, 100, '"Acertos dos Lacaios são sempre Golpes Críticos"');
  assert.deepEqual(L.oQueInvoca('Summon_Flame_Golem', 10).afDono, { dmg_vs_monsters: 24 }, '"Golens aumentam 24% de Dano"');
  const of = L.oQueInvoca('Flesh_Offering', 10);
  assert.equal(of.tipo, 'oferenda');
  assert.ok(of.bonus.velAtaquePct > 0);
  // O golem vivo entra na ficha do dono (o gancho dos afixos do PoE).
  const e = { hunt: { clock: 0, buffs: {}, lacaios: [{ hp: 10, tipo: 'lacaio', golem: true, afDono: { dmg_vs_monsters: 24 } }] } };
  assert.deepEqual(G.adds(e), { dmg_vs_monsters: 24 });
  e.hunt.lacaios[0].hp = 0;
  assert.equal(G.adds(e), null, 'morreu: sai');
  const Arena = await import('../admin/arena-efeitos.mjs');
  const r = Arena.combate({ skill: G.doSlug('Summon_Skeletons_of_Archers').acao, nivel: 10, mobs: 5, segundos: 8 });
  assert.ok(r.quadros.flatMap((q) => q.eventos).filter((x) => x.t === 'shot').length > 5, 'os arqueiros atiram de longe');
});

test('a magia própria dos espectros: o espectro ergue o cadáver de um monstro com magia e lança as magias dele', { skip: SEM_SUPORTES }, async () => {
  const Arena = await import('../admin/arena-efeitos.mjs');
  assert.ok(Arena.obter().espectros.length > 50, 'a arena lista os monstros com magia para escolher');
  const r = Arena.combate({ skill: G.doSlug('Raise_Spectre').acao, nivel: 10, mobs: 5, segundos: 10, espectroDe: 'poe-fire-fury-2' });
  assert.ok(r.ok, r.erros?.join(' '));
  const nomes = new Set(r.quadros.flatMap((q) => q.lacaios.map((l) => l.nome)));
  assert.ok([...nomes].some((n) => /^Espectro de /.test(n)), [...nomes].join(', '));
  const eventos = r.quadros.flatMap((q) => q.eventos);
  assert.ok(eventos.some((e) => e.t === 'shot' || e.t === 'area'), 'o espectro lança a magia do monstro');
  assert.ok(eventos.some((e) => e.t === 'dmg' && e.lacaio && e.foe), 'e a magia acerta');
});

test('o ataque do PoE separa o dano por elemento: a arma × eficácia + o adicional da gema, a conversão e "Não causa Dano não-Elemental"', { skip: SEM }, async () => {
  const arma = { min: 10, max: 20 };
  // Acerto Elemental do Espectro: fogo, gelo e raio da gema; o físico da arma some. Não depende do elemento da arma.
  const esp = G.partesDoAtaque('Elemental_Hit_of_the_Spectrum', 10, arma);
  assert.deepEqual(Object.keys(esp).sort(), ['energy', 'fire', 'ice']);
  assert.deepEqual(esp.fire, [53, 98], '"(8 — 182) a (14 — 337) de Dano de Fogo Adicional" no nível 10');
  assert.equal(G.extrasDoAtaque('Elemental_Hit_of_the_Spectrum', 10).porAfeccao, 10, '"10% mais Dano por cada tipo de Afecção Elemental"');
  assert.equal(G.extrasDoAtaque('Elemental_Hit_of_the_Spectrum', 10, 20).porAfeccao, 15, 'a qualidade 20% soma +5%');
  assert.equal(G.doSlug('Elemental_Hit_of_the_Spectrum').statusNoJogo, 'funciona');
  // Acerto Elemental: um elemento sorteado por uso.
  assert.equal(Object.keys(G.partesDoAtaque('Elemental_Hit', 10, arma)).length, 1);
  // Flecha Ardente: 100% do físico vira fogo; Disparo de Gelo: parte física, parte gelo.
  assert.deepEqual(Object.keys(G.partesDoAtaque('Burning_Arrow', 10, arma)), ['fire']);
  assert.deepEqual(Object.keys(G.partesDoAtaque('Ice_Shot', 10, arma)).sort(), ['ice', 'physical']);
  // As afecções elementais no bicho (para o "mais Dano por cada tipo").
  assert.equal(G.afeccoesElementaisEm({ estados: { chocado: { ate: 50 }, lento: { ate: 50 } }, dots: [{ tipo: 'queimadura', ate: 50 }] }, 10), 3);
  // No combate: o golpe leva as três partes, cada uma com a resistência dela.
  const Reg = await import('../systems/combate/registro.mjs');
  const antes = Reg.nivelDoRegistro();
  Reg.definirNivel(2);
  Reg.limparRegistro();
  const Arena = await import('../admin/arena-efeitos.mjs');
  Arena.combate({ skill: G.doSlug('Elemental_Hit_of_the_Spectrum').acao, nivel: 10, mobs: 3, segundos: 4 });
  const golpe = Reg.ultimosGolpes().find((g) => g.habilidade === G.doSlug('Elemental_Hit_of_the_Spectrum').acao);
  Reg.definirNivel(antes);
  assert.deepEqual(Object.keys(golpe?.detalhe?.porElemento ?? {}).sort(), ['energy', 'fire', 'ice'], JSON.stringify(golpe));
});
