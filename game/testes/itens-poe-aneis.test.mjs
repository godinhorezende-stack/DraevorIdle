// O SEGUNDO ANEL do PoE (dono, 06/10): com ITENS_POE=1 existe o slot `ring2`, que aceita anel; o clique veste no primeiro anel livre, o
// arrasto escolhe o slot, e os dois anéis somam na ficha. Sem o PoE, nada muda (um anel só).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = !existsSync(Catalogo.ARQUIVO) && 'catálogo do PoE não importado nesta máquina';
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const Equipamento = await import('../systems/itens/equipamento.mjs');
const Inventario = await import('../systems/inventario.mjs');
const Afixos = await import('../systems/afixos.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const semente = (s = 1) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
if (!SEM) Jogo.iniciar(ITEM_CATALOG);

test('dois anéis: o clique veste no primeiro anel livre, o arrasto escolhe, os dois somam na ficha, e tirar devolve cada um', { skip: SEM }, async () => {
  const { personagemDeTeste } = await import('./apoio.mjs');
  assert.ok(Equipamento.SLOTS_DE_EQUIPAMENTO.includes('ring2'));
  const anel = Jogo.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Rings/Iron_Ring', raridade: 'normal', ilvl: 10, rng: semente(2) }));
  assert.ok(Equipamento.cabeNoSlot(ITEM_CATALOG[anel.id], 'ring2'));
  assert.ok(!Equipamento.cabeNoSlot(ITEM_CATALOG[anel.id], 'neck'));
  const e = personagemDeTeste({ vocacao: 'knight', level: 30 });
  e.equipment = { ...(e.equipment ?? {}), ring: null, ring2: null };
  e.inventory = [structuredClone(anel), structuredClone(anel), structuredClone(anel)];
  assert.equal(Inventario.equipar(e, { id: anel.id, pilha: 0 }).ok, true);
  assert.equal(Inventario.equipar(e, { id: anel.id, pilha: 0 }).ok, true);
  assert.ok(e.equipment.ring && e.equipment.ring2, 'o segundo clique foi para o segundo anel');
  // Com os dois cheios, o clique troca o primeiro; o arrasto escolhe o slot.
  assert.equal(Inventario.equipar(e, { id: anel.id, pilha: 0, slot: 'ring2' }).ok, true);
  assert.equal(e.inventory.length, 1);
  // Os dois somam (o Anel de Ferro dá dano físico adicional, implícito).
  const um = Object.values(e.equipment.ring.poe.af).reduce((a, v) => a + (typeof v === 'number' ? v : 0), 0);
  assert.ok(um > 0);
  const soma = Afixos.somaDeItens(e);
  for (const [k, v] of Object.entries(e.equipment.ring.poe.af)) if (typeof v === 'number') assert.equal(soma[k] >= v * 2, true, k);
  assert.equal(Inventario.desequipar(e, { slot: 'ring2' }).ok, true);
  assert.equal(e.equipment.ring2, null);
  assert.ok(e.equipment.ring);
  assert.equal(e.inventory.length, 2);
  // Peça que não é anel não entra no segundo anel.
  const elmo = Jogo.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Helmets/Iron_Hat', raridade: 'normal', ilvl: 10, rng: semente(3) }));
  e.inventory.push(elmo);
  assert.equal(Inventario.equipar(e, { id: elmo.id, pilha: e.inventory.length - 1, slot: 'ring2' }).ok, false);
});

test('sem capacidade no PoE (dono, 06/10: "não existe cap mais"): o peso não manda nada para o Depósito nem impede pegar loot', { skip: SEM }, async () => {
  const { personagemDeTeste } = await import('./apoio.mjs');
  const Deposito = await import('../systems/deposito.mjs');
  const e = personagemDeTeste({ vocacao: 'knight', level: 1 });
  assert.equal(Afixos.capacidade(e), Infinity);
  const placa = Jogo.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Body_Armours/Plate_Vest', raridade: 'normal', ilvl: 10, rng: semente(4) }));
  e.inventory = Array.from({ length: 80 }, () => structuredClone(placa));
  assert.ok(Inventario.pesoDoInventario(e) > 5000);
  assert.deepEqual(Deposito.excessoParaODeposito(e), []);
  assert.equal(e.inventory.length, 80);
  assert.equal(Inventario.cabeNoPeso(e, placa.id, 1000), true, 'o loot sempre cabe no peso');
});
