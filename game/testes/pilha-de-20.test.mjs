// As PILHAS no jogo oficial (dono, 08/10: "as pilhas podem ficar no máximo 20"): o tamanho da pilha do PoE, até 20 — o Orbe do Remorso
// (40 no PoE) fica 20, as moedas de 10 continuam 10. Vale na mochila (dar, juntar, organizar), na bolsa de loot, na retirada do depósito e
// nas moedas da Forja. Antes era 100 (o do Tibia) em todo lugar. A pilha maior que já estava lá (de antes) fica como está: nada se perde.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');
const Inventario = await import('../systems/inventario.mjs');
const Bolsa = await import('../systems/bolsa.mjs');
const Deposito = await import('../systems/deposito.mjs');
const MoedasPoe = await import('../systems/itens-poe/moedas.mjs');
const { pilhaMaxima } = await import('../systems/itens/pilha.mjs');

const SEM = !existsSync(Catalogo.ARQUIVO) && 'catálogo do PoE não importado nesta máquina';
const REMORSO = () => MoedasPoe.idDa('Orb_of_Regret'); // 40 no PoE
const DE_10 = () => MoedasPoe.MOEDAS.find((m) => m.pilha === 10)?.itemId;
const contagens = (lista, id) => lista.filter((p) => Number(p.id) === id).map((p) => p.count);
function quem() {
  const e = personagemDeTeste({ vocacao: 'knight', level: 50 });
  Bolsa.garantir(e);
  e.inventory = [];
  e.pouch = [];
  return e;
}

test('o tamanho da pilha: o do PoE até 20 (o Remorso, 40 no PoE, fica 20; a de 10 continua 10) — e o balão recebe o 20', { skip: SEM }, () => {
  assert.ok(REMORSO() && ITEM_CATALOG[REMORSO()], 'o Orbe do Remorso no catálogo');
  assert.equal(MoedasPoe.MOEDAS.find((m) => m.slug === 'Orb_of_Regret').pilha, 40, 'no PoE, 40');
  assert.equal(pilhaMaxima(REMORSO()), 20);
  assert.equal(ITEM_CATALOG[REMORSO()].pilha, 20, 'o catálogo (o balão: "Tamanho da Pilha: n / 20")');
  assert.equal(pilhaMaxima(DE_10()), 10);
  for (const m of MoedasPoe.MOEDAS) assert.ok(pilhaMaxima(m.itemId) <= 20, `${m.slug}: ${pilhaMaxima(m.itemId)}`);
});

test('mochila: dar 45 vira 20 + 20 + 5; juntar para em 20; organizar refaz em pilhas de 20', { skip: SEM }, () => {
  const id = REMORSO();
  const e = quem();
  Inventario.darItem(e, id, 45);
  assert.deepEqual(contagens(e.inventory, id), [20, 20, 5]);
  Inventario.darItem(e, id, 18);
  assert.deepEqual(contagens(e.inventory, id), [20, 20, 20, 3], 'completa a pilha de 5 e abre outra');
  // Juntar: a de 3 na de 20 — cheia, recusa; a de 20 na de 3 passa só 17.
  assert.equal(Inventario.juntar(e, { de: 3, para: 0, from: 'inventory' }).ok, false, 'a de 20 está cheia');
  assert.equal(Inventario.juntar(e, { de: 0, para: 3, from: 'inventory' }).ok, true);
  assert.deepEqual(contagens(e.inventory, id), [3, 20, 20, 20], 'passou 17 (3 + 17 = 20), sobraram 3');
  e.inventory = [{ id, count: 7 }, { id, count: 9 }, { id, count: 13 }];
  assert.equal(Inventario.organizar(e, { from: 'inventory' }).ok, true);
  assert.deepEqual(contagens(e.inventory, id), [20, 9]);
});

test('a pilha maior que já estava lá (de antes da regra) fica como está: nada se perde, e o que chega abre outra pilha', { skip: SEM }, () => {
  const id = REMORSO();
  const e = quem();
  e.inventory = [{ id, count: 57 }];
  Inventario.darItem(e, id, 4);
  assert.deepEqual(contagens(e.inventory, id), [57, 4]);
  assert.equal(contagens(e.inventory, id).reduce((a, b) => a + b, 0), 61);
});

test('bolsa de loot: as pilhas também param em 20', { skip: SEM }, () => {
  const id = REMORSO();
  const e = quem();
  assert.equal(Bolsa.porNaBolsa(e, id, 45), 45);
  assert.deepEqual(contagens(e.pouch, id), [20, 20, 5]);
});

test('depósito: o monte da caixa não tem teto, mas o que sai para a mochila sai em pilhas de 20', { skip: SEM }, () => {
  const id = REMORSO();
  const e = quem();
  const caixas = Deposito.garantir(e);
  const caixa = caixas.find((c) => !c.chegadas && !c.compartilhada);
  caixa.itens.push({ id, count: 60 });
  const r = Deposito.comando(e, { action: 'take', caixa: caixa.indice, id, count: 45 });
  assert.ok(r.ok, r.erro);
  assert.deepEqual(contagens(e.inventory, id), [20, 20, 5]);
  assert.equal(caixa.itens.find((p) => p.id === id).count, 15, 'ficaram 15 na caixa');
});

test('mover da bolsa de loot para a mochila pelo menu do celular (count 9999 = "tudo"): passa o que há; sem vaga, diz "mochila cheia"', { skip: SEM }, () => {
  // Dono, 08/10: "no mobile está bugado passar item da bolsa de loot para a mochila" — a vaga era conferida com 9999 e a moeda nunca
  // passava ("Você não tem capacidade para carregar isso."), mesmo com a mochila vazia.
  const id = REMORSO();
  const e = quem();
  e.pouch = [{ id, count: 13 }];
  const r = Bolsa.moverBolsa(e, { id, count: 9999, to: 'bag', pilha: 0 });
  assert.ok(r.ok, r.erro);
  assert.deepEqual(contagens(e.inventory, id), [13], 'os 13 na mochila');
  assert.deepEqual(contagens(e.pouch, id), [], 'a bolsa ficou sem eles');
  // Uma vaga só: passa o que cabe (uma pilha de 20) e avisa; o resto fica na bolsa.
  const naoEmpilha = Number(Object.keys(ITEM_CATALOG).find((i) => ITEM_CATALOG[i].slot === 'body' && !ITEM_CATALOG[i].stackable));
  const quase = quem();
  quase.inventory = Array.from({ length: Inventario.vagasDaMochila(quase) - 1 }, () => ({ id: naoEmpilha, count: 1 }));
  quase.pouch = [{ id, count: 20 }, { id, count: 20 }, { id, count: 5 }];
  const r2 = Bolsa.moverBolsa(quase, { id, count: 9999, to: 'bag' });
  assert.ok(r2.ok, r2.erro);
  assert.match(r2.notice ?? '', /passaram 20 de 45/);
  assert.deepEqual(contagens(quase.inventory, id), [20]);
  assert.equal(contagens(quase.pouch, id).reduce((a, b) => a + b, 0), 25, 'nada se perdeu');
  // Cheia (e sem pilha dele com espaço): a mensagem é a da mochila cheia, não a do peso.
  const r3 = Bolsa.moverBolsa(quase, { id, count: 9999, to: 'bag' });
  assert.equal(r3.ok, false);
  assert.match(r3.erro, /mochila está cheia \(20 vagas\)/);
});
