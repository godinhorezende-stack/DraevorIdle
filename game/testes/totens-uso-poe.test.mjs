// OS TOTENS USAM A GEMA COMO VOCÊ (lote G20a, 18/10): o totem usa a habilidade da gema pelo MESMO caminho do seu uso, do lugar dele (o PoB: a skill
// do totem é a sua, com os seus modificadores) — a área em volta dele, o crítico, as afecções e as linhas da gema; os acertos são do totem (o abate é
// `matarTotem`; a vida no acerto, o dreno e as cargas não vêm para você). O seu uso da gema é COLOCAR o totem: 0,6 s (0,5 s na Balista) ÷ a Velocidade
// de Posicionamento. A vida do totem pelo PoB (a tabela de aliados × o tipo de totem × a "Vida do Totem aumentada" × o "mais" da qualidade); os
// modificadores de lacaio não valem nele. O totem sem golpe (o Chamariz…) não acerta ninguém. O status lista o que o totem ainda não faz.
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
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const LacaiosPoe = await import('../systems/itens-poe/lacaios-poe.mjs');
const QuemFeriu = await import('../systems/hunt/quem-feriu.mjs');
const Aco = await import('../systems/itens-poe/convocar-o-aco.mjs');

const sorte = (v, f) => { const o = Math.random; Math.random = () => v; try { return f(); } finally { Math.random = o; } };

async function montar(arma, grupos) {
  const J = await import('../systems/itens-poe/jogo.mjs');
  const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Scion', sistema: 'poe' });
  const a = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: arma, raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
  const todas = grupos.flat();
  const links = grupos.flatMap((g) => g.map((_, i) => i < g.length - 1)).slice(0, todas.length - 1);
  a.soquetes = { abertos: todas.length, links, gemas: Array(todas.length).fill(null), cores: Array(todas.length).fill('W') };
  e.equipment = { ...e.equipment, weapon: a };
  delete e.equipment.shield;
  e.inventory = todas.map((s) => GS.itemDaGema({ id: (G.doSlug(s) ?? SP.doSlug(s)).itemId, nivel: 20, xp: 0, raridade: 'comum' }));
  for (let i = 0; i < todas.length; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  e.actions = Array(Acoes.SLOTS).fill(null);
  grupos.forEach((g, i) => { e.actions[i] = { id: G.doSlug(g[0]).acao, enabled: true, minMana: 0, conditions: [] }; });
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(sorte(0.999, () => Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' })).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 1e7;
  e.maxHp = e.hp = 1e7;
  const ms = e.hunt.monstros;
  for (const m of ms) Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60, hp: 1e12, maxHp: 1e12, estados: {}, dots: [], resist: {} });
  return { e, ms };
}
/** O seu uso da gema de totem (colocar): a conjuração até o fim; devolve o totem posto. */
function colocar(e, slot = 0) {
  // (a gema de suporte só sai com bicho por perto — `SEM_BICHO_POR_PERTO`)
  Object.assign(e.hunt.monstros[0], { x: e.hunt.pos.x + 3, y: e.hunt.pos.y });
  const r = sorte(0.5, () => Acoes.disparar(e, e.hunt, PERSONAGEM, slot, e.hunt.monstros[0], { manual: true }));
  assert.ok(r.ok, r.erro);
  if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; sorte(0.5, () => Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM)); }
  const l = (e.hunt.lacaios ?? []).filter((x) => x.tipo === 'totem' && x.hp > 0).at(-1);
  assert.ok(l, 'o totem foi posto');
  return l;
}
const golpe = (e, l, alvo, v = 0.5) => sorte(v, () => Cacadas.golpeDoTotem(e, e.hunt, l, alvo, Ficha.combate(e), PERSONAGEM, e.hunt.clock));

test('G20a: o Totem Sísmico usa a gema como você — a área em volta DELE acerta os 3 bichos colados nele (antes, só o alvo); o abate é do totem', { skip: SEM }, async () => {
  const { e, ms } = await montar('Wands/Driftwood_Wand', [['Shockwave_Totem']]);
  const l = colocar(e);
  const perto = ms.slice(0, 3);
  [[1, 0], [-1, 0], [0, 1]].forEach(([dx, dy], i) => Object.assign(perto[i], { x: l.x + dx, y: l.y + dy }));
  const ev = golpe(e, l, perto[0]);
  const acertados = new Set(ev.filter((x) => x.t === 'dmg' && x.foe && x.v > 0).map((x) => x.uid));
  assert.equal(acertados.size, 3, 'os 3 na área do totem');
  for (const b of perto) assert.ok(b.hp < 1e12, `${b.uid} levou dano`);
  // o golpe que mata: o abate é do totem (`matarTotem`), não seu
  perto[1].hp = 5;
  golpe(e, l, perto[0]);
  assert.ok(perto[1].hp <= 0);
  assert.equal(perto[1].poeUltimoDano?.quem, QuemFeriu.TOTEM);
  assert.equal(QuemFeriu.eventoDoAbate(perto[1]), 'matarTotem');
});

test('G20a: o totem rola o crítico da gema (antes nunca: era o dano do balão) e o "Empurrar" da linha local sai do lugar dele', { skip: SEM }, async () => {
  const { e, ms } = await montar('Wands/Driftwood_Wand', [['Shockwave_Totem']]);
  const l = colocar(e);
  const b = Object.assign(ms[0], { x: l.x + 1, y: l.y });
  const ev = golpe(e, l, b, 0.001);
  assert.ok(ev.some((x) => x.t === 'dmg' && x.uid === b.uid && x.crit), 'com o sorteio 0,001 o acerto é crítico (5% da gema)');
  // "25 % de chance de Empurrar Inimigos ao acertar": para LONGE do totem (não de você)
  assert.equal(b.x, l.x + 2, 'empurrado 1 casa para longe do totem');
});

test('G20a: o acerto do totem não é seu — o Ganho de Vida no Acerto ligado na Balista não cura você (o mesmo suporte na Flecha Ardente cura)', { skip: SEM }, async () => {
  const { e, ms } = await montar('Bows/Crude_Bow', [['Siege_Ballista', 'Life_Gain_on_Hit_Support'], ['Burning_Arrow', 'Life_Gain_on_Hit_Support']]);
  const l = colocar(e);
  const b = Object.assign(ms[0], { x: l.x + 2, y: l.y });
  e.hp = e.maxHp - 100_000;
  const ev = golpe(e, l, b, 0.001);
  assert.ok(ev.some((x) => x.t === 'dmg' && x.uid === b.uid && x.v > 0), 'a balista acertou');
  assert.equal(e.hp, e.maxHp - 100_000, 'a vida no acerto do totem não vem para você');
  const r = sorte(0.001, () => Acoes.disparar(e, e.hunt, PERSONAGEM, 1, b, { manual: true }));
  assert.ok(r.ok, r.erro);
  assert.ok(e.hp > e.maxHp - 100_000, 'no seu ataque, o suporte cura');
});

test('G20a: a Balista do Aço no uso novo — o ataque do totem gasta 1 dos SEUS fragmentos; sem fragmento, só 1 flecha', { skip: SEM }, async () => {
  const { e, ms } = await montar('Bows/Crude_Bow', [['Shrapnel_Ballista_of_Steel']]);
  const l = colocar(e);
  const b = Object.assign(ms[0], { x: l.x + 3, y: l.y });
  const flechas = (frag) => {
    Aco.aco(e.hunt).fragmentos = frag;
    const entry = Acoes.POR_ID_PUBLICO(l.acao);
    return golpe(e, l, b).filter((x) => x.t === 'shot' && x.id === entry.projetil && x.x === l.x && x.y === l.y).length;
  };
  assert.equal(flechas(5), 3, '"Dispara 3 Flechas"');
  assert.equal(e.hunt.aco.fragmentos, 4);
  assert.equal(flechas(0), 1);
});

test('G20a: COLOCAR o totem — 0,6 s ÷ a Velocidade de Posicionamento (o Chefe Guerreiro 400 ms; a Balista 0,5 s; com a Balista Focada 298 ms)', { skip: SEM }, async () => {
  const tempo = async (grupo, arma) => {
    const { e } = await montar(arma, [grupo]);
    return Acoes.temposDaGemaPoe(e, Acoes.POR_ID_PUBLICO(G.doSlug(grupo[0]).acao));
  };
  const chefe = await tempo(['Ancestral_Warchief'], 'Two_Hand_Maces/Driftwood_Maul');
  assert.equal(chefe.conjuracaoMs, 400, '600 / (1 + 50% da gema)');
  assert.equal(chefe.ataque, false);
  assert.equal((await tempo(['Siege_Ballista'], 'Bows/Crude_Bow')).conjuracaoMs, 500);
  assert.equal((await tempo(['Siege_Ballista', 'Focused_Ballista_Support'], 'Bows/Crude_Bow')).conjuracaoMs, 298, '500 / 1,68 (68% mais do suporte)');
});

test('G20a: a "Velocidade de Posicionamento do Totem aumentada" das peças só encurta o COLOCAR — o totem conjura a habilidade no tempo dela', { skip: SEM }, async () => {
  const { e } = await montar('Wands/Driftwood_Wand', [['Shockwave_Totem_of_Authority']]);
  const entry = Acoes.POR_ID_PUBLICO(G.doSlug('Shockwave_Totem_of_Authority').acao);
  const f = Ficha.combate(e);
  const comPeca = { ...f, porTag: [...(f.porTag ?? []), { stat: 'cast_speed_tag', tags: ['totem'], valor: 30 }] };
  const ef = GS.efeitoNaSkill(e, entry.id);
  assert.equal(Acoes.temposDaGemaPoe(e, entry, ef, comPeca).conjuracaoMs, 462, '600 / 1,30');
  const doTotem = (ficha, extra = 0) => Acoes.temposDaGemaPoe(e, entry, ef, ficha, { doJogador: false, velExtraPct: extra });
  assert.equal(doTotem(comPeca).conjuracaoMs, doTotem(f).conjuracaoMs, 'o totem não conjura mais rápido pela velocidade de COLOCAR');
  assert.equal(doTotem(f).conjuracaoMs, 600);
  // "Magias Conjuradas por Totens têm 50% de Velocidade de Conjuração aumentada" (`l.velAtaquePct`, do `oQueInvoca`): o totem conjura em 400 ms
  assert.equal(doTotem(f, 50).conjuracaoMs, 400);
  assert.equal(LacaiosPoe.oQueInvoca('Shockwave_Totem_of_Authority', 20, null, { totem_vel_magia: 50 }).velAtaquePct, 50);
});

test('G20a: a VIDA do totem pelo PoB — o Chamariz q20 3745 (1478 × 1,2 × 1,76 × 1,20); o Sísmico 1478; o Rejuvenescedor Vaal q20 5617', { skip: SEM }, () => {
  const vida = (slug, q = 0, af = {}, efeito = {}) => LacaiosPoe.oQueInvoca(slug, 20, { qualidade: q, ...efeito }, af).vida;
  assert.equal(LacaiosPoe.POB.tabelas.vida[69], 1478, 'a vida dos aliados no nível 70');
  assert.equal(vida('Decoy_Totem', 20), 3745);
  assert.equal(vida('Decoy_Totem', 0), Math.round(1773 * 1.76));
  assert.equal(vida('Shockwave_Totem'), 1478);
  assert.equal(vida('Vaal_Rejuvenation_Totem', 20), 5617);
  // "Vida do Totem aumentada em 50%" das peças e "Habilidades Suportadas têm Vida do Totem aumentada em 10%" dos suportes: somam no aumentado
  assert.equal(vida('Shockwave_Totem', 0, { totem_life: 50 }, { totemVidaPct: 10 }), Math.round(1478 * 1.6));
  // os modificadores de LACAIO não valem no totem: a vida, a velocidade, a evasão e a "Duração de Habilidade"
  const q = LacaiosPoe.oQueInvoca('Shockwave_Totem', 20, { duracaoPct: 50, lacaioVidaPct: 100 }, { minion_life: 100, minion_atk_speed: 50, minion_evasao: 1000 });
  assert.equal(q.vida, 1478);
  assert.equal(q.velAtaquePct, 0);
  assert.equal(q.poe.evasao, 0);
  assert.equal(q.duracaoMs, 8000, 'a duração do totem é a do totem (só a "Duração do Totem aumentada")');
  assert.equal(LacaiosPoe.oQueInvoca('Shockwave_Totem', 20, null, { 'lacaio_duracao:totem': 50 }).duracaoMs, 12000);
});

test('G20a: o máximo da qualidade (o Vínculo Abrasador q20: 1 + 2 + 2 = 5 totens)', { skip: SEM }, () => {
  assert.equal(LacaiosPoe.oQueInvoca('Searing_Bond', 20, { qualidade: 0 }, {}).maximo, 3);
  assert.equal(LacaiosPoe.oQueInvoca('Searing_Bond', 20, { qualidade: 20 }, {}).maximo, 5);
});

test('G20a: o totem SEM golpe (o Chamariz, o Devorador, os Rejuvenescedores, o Vínculo Abrasador) não acerta; o status lista o que ele não faz', { skip: SEM }, () => {
  for (const s of ['Decoy_Totem', 'Devouring_Totem', 'Rejuvenation_Totem', 'Vaal_Rejuvenation_Totem', 'Searing_Bond', 'Searing_Bond_of_Detonation']) assert.equal(G.totemSemGolpe(s), true, s);
  for (const s of ['Shockwave_Totem', 'Siege_Ballista', 'Ancestral_Warchief', 'Holy_Flame_Totem']) assert.equal(G.totemSemGolpe(s), false, s);
  const chamariz = G.doSlug('Decoy_Totem').motivosNoJogo;
  // (lote G20c, com o aval do dono: o "não podem Evadir" e a regeneração do Rejuvenescedor foram feitos — `totens-especificos-poe.test.mjs`; a
  // provocação do Chamariz segue não feita)
  assert.ok(chamariz.some((m) => /o totem provoca os monstros em volta/.test(m)), chamariz.join(' | '));
  assert.ok(!chamariz.some((m) => /Totem dura|Vida do Totem|mais Vida de Totens|Invoca um Totem/.test(m)), 'as linhas do totem são feitas');
  assert.ok(!G.doSlug('Rejuvenation_Totem').motivosNoJogo.some((m) => /Vida Regenerada/.test(m)), 'a aura do Rejuvenescedor: feita no G20c');
  assert.ok(G.doSlug('Searing_Bond').motivosNoJogo.includes('efeito não simulado: Causa 4430.6 de Dano de Fogo Base por segundo'));
});

test('G20a: o status honesto — o Sísmico "funciona"; o que o totem não faz vai nos motivos (o buff do Chefe, o "mais Velocidade de Projétil", o alcance)', { skip: SEM }, () => {
  assert.equal(G.doSlug('Shockwave_Totem').statusNoJogo, 'funciona', G.doSlug('Shockwave_Totem').motivosNoJogo.join(' | '));
  // (lote G20c, com o aval do dono: o buff do Chefe Guerreiro Ativo foi feito — `totens-especificos-poe.test.mjs`)
  const chefe = G.doSlug('Ancestral_Warchief').motivosNoJogo;
  assert.ok(!chefe.some((m) => /o totem fica parado|Velocidade de Posicionamento|enquanto o Totem estiver Ativo/.test(m)), chefe.join(' | '));
  assert.ok(G.doSlug('Holy_Flame_Totem_of_Ire').motivosNoJogo.includes('efeito não simulado: 128 % mais Velocidade de Projétil'));
  // (a chave do compilador sem leitor: o alcance corpo a corpo da gema não ia a lugar nenhum — a Lâmina Gélida também)
  assert.ok(G.doSlug('Frost_Blades').motivosNoJogo.includes('efeito não simulado: +2.1 metros ao Alcance de Golpes Corpo a Corpo'), G.doSlug('Frost_Blades').motivosNoJogo.join(' | '));
});

test('G20a: o ALCANCE do totem ancestral é o do seu golpe corpo a corpo (o Protetor com a Espada Enferrujada: 1 + ⌊(1,1 + 1,8) / 2⌋ = 2 casas; antes 7)', { skip: SEM }, async () => {
  const { e } = await montar('One_Hand_Swords/Rusted_Sword', [['Ancestral_Protector']]);
  assert.equal(colocar(e).alcanceDeAtaque, 2);
  const m = await montar('Two_Hand_Maces/Driftwood_Maul', [['Ancestral_Warchief']]);
  const metros = Ficha.alcanceCorpoEmMetros(m.e.equipment.weapon, Ficha.combate(m.e).afPoe);
  assert.equal(colocar(m.e).alcanceDeAtaque, 1 + Math.floor((metros + 1) / 2), `"+1 metro ao Alcance" do Chefe com a maça de ${metros} m`);
  // o totem que não é corpo a corpo segue o alcance da habilidade
  const s = await montar('Wands/Driftwood_Wand', [['Shockwave_Totem']]);
  assert.equal(colocar(s.e).alcanceDeAtaque, 6);
});

test('G20a: a Balista de Cerco Fragmentadora — os filhos da difusão difundem de novo e a qualidade dá 40% de chance de 1 filho a mais', { skip: SEM }, async () => {
  assert.equal(G.alvosNoNivel('Siege_Ballista_of_Splintering', 20, 20).difundirDeNovo, 1);
  assert.equal(G.alvosNoNivel('Siege_Ballista_of_Splintering', 20, 20).difusaoExtraChance, 40);
  assert.equal(G.alvosNoNivel('Siege_Ballista_of_Splintering', 20, 0).difusaoExtraChance, undefined);
  const { e } = await montar('Bows/Crude_Bow', [['Siege_Ballista_of_Splintering']]);
  const entry = Acoes.POR_ID_PUBLICO(G.doSlug('Siege_Ballista_of_Splintering').acao);
  const ef = Acoes.comOsAlvosDaGema(entry, { ...GS.efeitoNaSkill(e, entry.id), qualidade: 20 }, e);
  assert.deepEqual([ef.bifurcar, ef.bifurcarDeNovo, ef.bifurcarExtraChance], [2, 1, 40]);
  assert.equal(G.doSlug('Siege_Ballista_of_Splintering').statusNoJogo, 'funciona');
});

test('G20a (revisão): a nova do Sísmico da Autoridade sai em volta de VOCÊ; a área vazia não acerta ninguém; o ataque do totem não gasta o Impelir', { skip: SEM }, async () => {
  const { e, ms } = await montar('Wands/Driftwood_Wand', [['Shockwave_Totem_of_Authority']]);
  const l = colocar(e);
  Object.assign(l, { x: e.hunt.pos.x + 5, y: e.hunt.pos.y });
  const b = Object.assign(ms[0], { x: e.hunt.pos.x - 1, y: e.hunt.pos.y });
  const ev = golpe(e, l, b);
  assert.ok(ev.some((x) => x.t === 'dmg' && x.uid === b.uid && x.v > 0), 'o bicho colado em você leva a nova');
  // o Sísmico comum: o bicho longe da área do totem — o uso não acerta ninguém (antes acertava o alvo de qualquer jeito)
  const s = await montar('Wands/Driftwood_Wand', [['Shockwave_Totem']]);
  const t = colocar(s.e);
  const longe = Object.assign(s.ms[0], { x: t.x + 4, y: t.y });
  assert.deepEqual(golpe(s.e, t, longe), []);
  assert.equal(longe.hp, 1e12);
  // o Impelir é seu: a Balista não leva a tag nem gasta
  const m = await montar('Bows/Crude_Bow', [['Siege_Ballista']]);
  const bal = colocar(m.e);
  m.e.hunt.impelidos = { n: 5, ate: Infinity };
  golpe(m.e, bal, Object.assign(m.ms[0], { x: bal.x + 2, y: bal.y }), 0.001);
  assert.equal(m.e.hunt.impelidos.n, 5);
});
