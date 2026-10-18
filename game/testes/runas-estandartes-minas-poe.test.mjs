// Runas, Estandartes e Minas (lote G13, 17/10): as linhas que o sistema das Runas e o do Estandarte já faziam e o status não reconhecia; o "X%
// mais/menos Dano contra o Inimigo Vinculado"; o buff do Estandarte ("Estandarte concede … a Você e Aliados"); e as Minas da gema — os
// projéteis a mais pela Sequência de Detonação e a aura de crítico (Mina de Gelo) / de dano sofrido (Mina de Tempestade).
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
const Plantadas = await import('../systems/itens-poe/armas-plantadas.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');

test('G13: o status reconhece as linhas da Runa e do Estandarte; os números', { skip: SEM }, () => {
  assert.ok(!G.doSlug('Storm_Brand').motivosNoJogo.some((m) => /Vinculada|Desvinculada|contra o Inimigo Vinculado/.test(m)), G.doSlug('Storm_Brand').motivosNoJogo.join(' | '));
  assert.ok(!G.doSlug('War_Banner').motivosNoJogo.some((m) => /Valor/.test(m)), G.doSlug('War_Banner').motivosNoJogo.join(' | '));
  assert.equal(G.contraOVinculado('Armageddon_Brand', 20), 29);
  assert.equal(G.contraOVinculado('Armageddon_Brand_of_Recall', 20), -80);
  assert.equal(G.buffNoNivel('Defiance_Banner', 20).af.spell_suppression, 8);
  assert.deepEqual(G.minaDaGema('Icicle_Mine', 20), { porAnteriores: 2, auraCritico: { porMina: 10, teto: 500 } });
  assert.deepEqual(G.minaDaGema('Stormblast_Mine', 20), { auraDano: { porMina: 3, teto: 150 } });
  assert.ok(!G.doSlug('Icicle_Mine').motivosNoJogo.some((m) => /Minas anteriores|Cada Mina/.test(m)));
});

test('G13: a aura das Minas de Gelo plantadas — +10% de Chance de Crítico aumentada por Mina no inimigo perto delas', { skip: SEM }, async () => {
  const J = await import('../systems/itens-poe/jogo.mjs');
  const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
  const e = Object.assign(personagemDeTeste({ vocacao: 'sorcerer', level: 80 }), { classePoe: 'Shadow', sistema: 'poe' });
  const arma = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Wands/Driftwood_Wand', raridade: 'normal', ilvl: 1, rng: () => 0.5 }));
  arma.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
  e.equipment = { ...e.equipment, weapon: arma };
  e.inventory = [GS.itemDaGema({ id: G.doSlug('Icicle_Mine').itemId, nivel: 20, xp: 0, raridade: 'comum' })];
  GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: G.doSlug('Icicle_Mine').acao, enabled: true, minMana: 0, conditions: [] };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.clock = 100_000;
  const [b, ...resto] = e.hunt.monstros;
  for (const m of resto) Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60 });
  // o inimigo a 5 casas (fora da detonação, 2 casas) e 3 Minas a 1 casa dele (dentro da aura, 35 unidades = 1 casa)
  Object.assign(b, { x: e.hunt.pos.x + 8, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12, estados: {} });
  for (const dy of [-1, 0, 1]) Plantadas.plantar(e.hunt, Ficha.combate(e), { tipo: 'mina', acao: e.actions[0].id, slot: 0, x: b.x - 3, y: b.y + dy, duracaoMs: 5000, detonacaoMs: 250, agora: e.hunt.clock });
  Acoes.tiqueDasPlantadas(e, e.hunt, PERSONAGEM, []);
  assert.equal(b.estados.minaCritico, undefined, 'a 3 casas das Minas: fora da aura');
  for (const p of e.hunt.plantadas) p.x = b.x - 1;
  e.hunt.poeRecente = { moveu: e.hunt.clock };
  Acoes.tiqueDasPlantadas(e, e.hunt, PERSONAGEM, []);
  assert.equal(b.estados.minaCritico?.pct, 30, JSON.stringify(b.estados.minaCritico));
});
