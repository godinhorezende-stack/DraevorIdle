// As linhas de BUFF das gemas (lote G8, 17/10): "Buff concede…" e as auras "Você e aliados próximos ganham…" viram os atributos do buff
// (`linhas-das-gemas.atributosDoBuff` → `GemasPoe.buffNoNivel` → a ficha): o dano adicionado dos Arautos (aos ataques e às magias), o "mais
// Armadura" da Determinação, o máximo de resistência das Purezas, as imunidades. Mede no jogo: o Arauto de Gelo ligado → o dano na ficha.
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
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');

test('G8: os atributos de buff no nível 20', { skip: SEM }, () => {
  const gelo = G.buffNoNivel('Herald_of_Ice', 20).af;
  assert.deepEqual([gelo.added_ice_dmg_min, gelo.added_ice_dmg_max, gelo.spell_added_ice_dmg_min, gelo.spell_added_ice_dmg_max], [38, 56, 38, 56]);
  assert.equal(gelo.imune_reflexo, 1, '"Dano não pode ser Refletido"');
  const trovao = G.buffNoNivel('Herald_of_Thunder', 20).af;
  assert.deepEqual([trovao.added_energy_dmg_max, trovao.spell_added_energy_dmg_max], [76, 76]);
  assert.equal(G.buffNoNivel('Determination', 20).af.armour_mais, 49);
  assert.equal(G.buffNoNivel('Purity_of_Fire', 20).af.fire_res_max, 4);
  assert.equal(G.buffNoNivel('Steelskin', 20).af.imune_sangramento, 1);
});

test('G8: o Arauto de Gelo ligado dá o dano de gelo adicionado aos ataques e às magias na ficha', { skip: SEM }, async () => {
  const J = await import('../systems/itens-poe/jogo.mjs');
  const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
  const e = Object.assign(personagemDeTeste({ vocacao: 'sorcerer', level: 80 }), { classePoe: 'Witch', sistema: 'poe' });
  const arma = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Wands/Driftwood_Wand', raridade: 'normal', ilvl: 1, rng: () => 0.5 }));
  arma.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
  e.equipment = { ...e.equipment, weapon: arma };
  e.inventory = [GS.itemDaGema({ id: G.doSlug('Herald_of_Ice').itemId, nivel: 20, xp: 0, raridade: 'comum' })];
  GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: G.doSlug('Herald_of_Ice').acao, enabled: true, minMana: 0, conditions: [] };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana;
  const antes = Ficha.combate(e);
  const r = Acoes.disparar(e, e.hunt, PERSONAGEM, 0, e.hunt.monstros[0], {});
  assert.ok(r.ok, r.erro);
  if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM); }
  Ficha.invalidar(e);
  const depois = Ficha.combate(e);
  const d = (f, k) => f[k]?.ice ?? [0, 0];
  assert.deepEqual([d(depois, 'danoSomado')[0] - d(antes, 'danoSomado')[0], d(depois, 'danoSomado')[1] - d(antes, 'danoSomado')[1]], [38, 56], 'aos ataques');
  assert.deepEqual([d(depois, 'danoSomadoMagia')[0] - d(antes, 'danoSomadoMagia')[0], d(depois, 'danoSomadoMagia')[1] - d(antes, 'danoSomadoMagia')[1]], [38, 56], 'às magias');
});

// ---- lote G9: o efeito dos Arautos ao matar ----
async function comArauto(slug) {
  const J = await import('../systems/itens-poe/jogo.mjs');
  const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
  const e = Object.assign(personagemDeTeste({ vocacao: 'sorcerer', level: 80 }), { classePoe: 'Witch', sistema: 'poe' });
  const arma = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Wands/Driftwood_Wand', raridade: 'normal', ilvl: 1, rng: () => 0.5 }));
  arma.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
  e.equipment = { ...e.equipment, weapon: arma };
  e.inventory = [GS.itemDaGema({ id: G.doSlug(slug).itemId, nivel: 20, xp: 0, raridade: 'comum' })];
  GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
  e.actions = Array(Acoes.SLOTS).fill(null);
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.clock = 100_000;
  // o buff ligado (como o uso do Arauto deixa)
  (e.hunt.buffs ??= {})[G.doSlug(slug).acao] = { ate: 1e12, desde: 0, tipo: 'poe-arauto', afPoe: {} };
  const [morto, perto, longe, ...resto] = e.hunt.monstros;
  for (const m of resto) Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60 });
  Object.assign(morto, { x: e.hunt.pos.x + 3, y: e.hunt.pos.y, hp: -500, maxHp: 1000 });
  Object.assign(perto, { x: e.hunt.pos.x + 4, y: e.hunt.pos.y, hp: 1e9, maxHp: 1e9 });
  Object.assign(longe, { x: e.hunt.pos.x + 9, y: e.hunt.pos.y, hp: 1e9, maxHp: 1e9 });
  return { e, morto, perto, longe };
}

// (dono, 18/10 — "Juntar o branch das gemas aqui": os 3 testes do G9 dos Arautos saíram com a implementação do G9; a explosão do Glacial, a
// tempestade do Trovejante e a queima do Flamejante — a do lote 81, mais completa — estão em testes/arautos-acertos-lote81.test.mjs. A queima vale em
// qualquer abate seu por acerto: o PoB e o texto atual do PoE — "if you kill an enemy"; o "com um ataque" do poedb em português é o texto antigo.)
