// O ALVO no golpe das gemas (lote G7) e as MARCAS contra o amaldiçoado (lote G6), 17/10. A ficha da gema é montada sem alvo; os condicionais
// com tag de alvo ("contra Inimigos em Vida Cheia", "contra Inimigos Eletrizados") não entravam nos acertos das gemas — só no golpe básico.
// As Marcas ("Acertos contra Inimigos Amaldiçoados ganham…", "…concedem uma Carga de Poder quando mortos") ficam na maldição do bicho.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
const Acoes = await import('../systems/acoes.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const G = await import('../systems/itens-poe/gemas-poe.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');

const ANEL = Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'might ring')?.id);
async function bruxa(gema, af = null) {
  const J = await import('../systems/itens-poe/jogo.mjs');
  const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
  const e = Object.assign(personagemDeTeste({ vocacao: 'sorcerer', level: 80 }), { classePoe: 'Witch', sistema: 'poe' });
  const arma = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Wands/Driftwood_Wand', raridade: 'normal', ilvl: 1, rng: () => 0.5 }));
  arma.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
  e.equipment = { ...e.equipment, weapon: arma };
  if (af) e.equipment.ring = { id: ANEL, count: 1, af: [], poe: { af } };
  e.inventory = [GS.itemDaGema({ id: G.doSlug(gema).itemId, nivel: 20, xp: 0, raridade: 'comum' })];
  GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: G.doSlug(gema).acao, enabled: true, minMana: 0, conditions: [] };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 1e6;
  return e;
}
function comSorte(v, fn) { const a = Math.random; Math.random = () => v; try { return fn(); } finally { Math.random = a; } }
/** O dano da Nova de Gelo num alvo colado com `hp` de `max` (o resto longe), com o sorteio fixo. (A Nova acerta na hora: o projétil de uma
 * Bola de Fogo cai depois e entrava na medição seguinte.) */
function danoNoAlvo(e, hp, max = 1e9) {
  e.hunt.monstros.forEach((m, i) => Object.assign(m, i ? { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60 } : { x: e.hunt.pos.x + 1, y: e.hunt.pos.y, hp, maxHp: max }));
  const b = e.hunt.monstros[0];
  e.hunt.clock += 10_000;
  // (o dano pelos EVENTOS deste uso — a vida do bicho também mudaria com o laço da caçada usando a gema sozinho entre os passos)
  const eventos = comSorte(0.5, () => {
    const r = Acoes.disparar(e, e.hunt, PERSONAGEM, 0, b, { manual: true });
    assert.ok(r.ok, r.erro);
    const ev = [...(r.eventos ?? [])];
    if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; ev.push(...(Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM) ?? [])); }
    return ev;
  });
  return eventos.filter((x) => x.t === 'dmg' && x.uid === b.uid && x.foe).reduce((t, x) => t + x.v, 0);
}

test('G7: "X% mais Dano contra Inimigos em Vida Cheia" (da soma) vale no acerto da gema — antes só no golpe básico', { skip: SEM }, async () => {
  // o MESMO personagem e o MESMO monstro (a caçada sorteia a raridade e os modificadores dele no entrar): com o anel e sem ele
  const e = await bruxa('Ice_Nova', { 'mais_dano@alvoVidaCheia': 100 });
  const anel = e.equipment.ring;
  const medir = (comAnel) => {
    if (comAnel) e.equipment.ring = anel;
    else delete e.equipment.ring;
    Ficha.invalidar(e);
    return { cheio: danoNoAlvo(e, 1e9), metade: danoNoAlvo(e, 5e8) };
  };
  const sem = medir(false);
  const com = medir(true);
  // alvo com a vida cheia: o dobro; com a vida pela metade: igual
  assert.ok(Math.abs(com.cheio / sem.cheio - 2) < 0.02, `vida cheia: ${com.cheio} / ${sem.cheio}`);
  assert.ok(Math.abs(com.metade / sem.metade - 1) < 0.02, `vida pela metade: ${com.metade} / ${sem.metade}`);
});

test('G7: o "aumentado" com tag de alvo soma ao aumentado do golpe (não multiplica)', { skip: SEM }, async () => {
  const e = await bruxa('Fireball', { 'dmg_inc@alvoVidaCheia': 100 });
  const ficha = Acoes.comAsLinhasDaGema(e, Ficha.combate(e), Acoes.POR_ID_PUBLICO(G.doSlug('Fireball').acao));
  const g = ModsPoe.golpeNoAlvo({ ...ficha, tagsDoGolpe: ['magia', 'fogo', 'habilidade'] }, { hp: 10, maxHp: 10, estados: {} }, 0);
  assert.equal(g.s.dmg_inc, 100);
  assert.ok(g.tags.includes('alvoVidaCheia'));
  assert.ok(ModsPoe.golpeNoAlvo({ ...ficha, tagsDoGolpe: ['magia'] }, { hp: 5, maxHp: 10, estados: {} }, 0).vazio, 'sem vida cheia, nada');
});

test('G6: as Marcas guardam o que dão contra o amaldiçoado e o golpe nele lê', { skip: SEM }, () => {
  const assassino = G.buffNoNivel('Assassins_Mark', 20).efeitos.find((x) => x.efeito === 'maldicaoContra');
  assert.ok(assassino, 'a Marca do Assassino tem efeito contra o amaldiçoado');
  assert.ok(assassino.golpe.crit_chance > 0 && assassino.golpe.crit_dmg > 0, JSON.stringify(assassino.golpe));
  assert.equal(assassino.morte['carga:poder'], 100);
  assert.ok(assassino.morte.vida > 0 && assassino.morte.mana > 0);
  const senhor = G.buffNoNivel('Warlords_Mark', 20).efeitos.find((x) => x.efeito === 'maldicaoContra');
  assert.ok(senhor.golpe['life_leech@ataque'] > 0 && senhor.morte['carga:tolerancia'] === 100);
  const cacador = G.buffNoNivel('Poachers_Mark', 20).efeitos.find((x) => x.efeito === 'maldicaoContra');
  assert.ok(cacador.golpe.added_physical_dmg_max > 0 && cacador.morte['carga:frenesi'] === 100);
  // o golpe no amaldiçoado: o "+X%" de crítico e o multiplicador da Marca; o roubo "@ataque" só com ataque
  const bicho = { hp: 5, maxHp: 10, estados: {}, maldicoes: { m: { ate: 1e9, contra: { golpe: assassino.golpe, morte: assassino.morte, fator: 1 } } } };
  const g = ModsPoe.golpeNoAlvo({ tagsDoGolpe: ['magia'], porTag: [], afPoe: {} }, bicho, 0);
  assert.equal(g.s.crit_chance, assassino.golpe.crit_chance);
  const s2 = ModsPoe.golpeNoAlvo({ tagsDoGolpe: ['magia'], porTag: [], afPoe: {} }, { ...bicho, maldicoes: { m: { ate: 1e9, contra: { golpe: senhor.golpe, morte: {}, fator: 1 } } } }, 0);
  assert.equal(s2.s.life_leech ?? 0, 0, 'o Dreno do Senhor da Guerra é só de ataques');
  for (const slug of ['Assassins_Mark', 'Warlords_Mark', 'Poachers_Mark']) assert.ok(!G.doSlug(slug).motivosNoJogo.some((m) => /nenhum efeito do buff|Amaldiçoados (concedem|possuem)|Acertos contra/.test(m)), `${slug}: ${G.doSlug(slug).motivosNoJogo.join(' | ')}`);
});
