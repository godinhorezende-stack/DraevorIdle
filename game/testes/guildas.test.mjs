// Guildas no formato do original (api-mapeada/captura-guilda-arena-0926/) e o
// brasão pelas regras do shared (packages/shared/src/brasao-de-guilda.mjs).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as B from '../database/banco.mjs';
import * as Guildas from '../systems/guildas.mjs';
import { CUSTO_DE_TROCAR, brasaoPadrao } from '../engine/brasao-de-guilda.mjs';
import { compararGuildas } from '../engine/ordem-das-guildas.mjs';

const original = JSON.parse(readFileSync(new URL('../../api-mapeada/captura-guilda-arena-0926/guilda-zoros.json', import.meta.url), 'utf8')).view;
const NOMES = ['Guildatesteum', 'Guildatestedois'];
const GUILDA = 'Os Testadores';

const limpar = () => {
  const g = B.db.prepare('SELECT id FROM guildas WHERE lower(nome) = lower(?)').get(GUILDA);
  if (g) for (const t of ['guilda_membros', 'guilda_convites', 'guilda_pedidos', 'guilda_diario']) B.db.prepare(`DELETE FROM ${t} WHERE guilda = ?`).run(g.id);
  B.db.prepare('DELETE FROM guildas WHERE lower(nome) = lower(?)').run(GUILDA);
  for (const n of NOMES) B.db.prepare('DELETE FROM guilda_membros WHERE nome = ?').run(n);
};
limpar();
after(limpar);

const sessao = (nome, extra = {}) => ({
  personagem: { nome },
  enviar: () => {},
  estado: { level: 600, coins: 1000, gold: 5_000_000_000, premiumAte: Date.now() + 86_400_000, inventory: [], ...extra },
});
const lider = sessao(NOMES[0]);
const outro = sessao(NOMES[1]);
// Os dois 'online': a guilda acha cada um pela sessão aberta, como no jogo.
Guildas.ligar(new Map([[NOMES[0], lider], [NOMES[1], outro]]));

test('fundar: nome do shared, brasão pago só nos efeitos', async () => {
  assert.match((await Guildas.comando(lider, { action: 'fundar', nome: 'ab' })).erro, /pelo menos 3 letras/);
  assert.match((await Guildas.comando(lider, { action: 'fundar', nome: 'Nome_Ruim' })).erro, /letras, números e espaço/);
  const brasao = { ...brasaoPadrao(GUILDA), cor: 'ouro' };
  const r = await Guildas.comando(lider, { action: 'fundar', nome: `  Os   Testadores `, brasao });
  assert.equal(r.ok, true, r.erro);
  assert.equal(lider.estado.coins, 950); // efeito Ouro = 50, fundar não cobra a troca
  assert.match((await Guildas.comando(outro, { action: 'fundar', nome: 'os testadores' })).erro, /Já existe/);
  const { minha } = (await Guildas.vista(NOMES[0])).view;
  assert.equal(minha.nome, GUILDA);
  assert.equal(minha.brasao.cor, 'ouro');
  assert.deepEqual(minha.brasaoEfeitos, ['ouro']);
});

test('vista: as mesmas chaves do original', async () => {
  const nossa = (await Guildas.vista(NOMES[0])).view;
  assert.deepEqual(Object.keys(nossa).sort(), Object.keys(original).sort());
  assert.deepEqual(Object.keys(nossa.minha).sort(), Object.keys(original.minha).sort());
  assert.deepEqual(Object.keys(nossa.minha.diario).sort(), Object.keys(original.minha.diario).sort());
  assert.deepEqual(nossa.regras, original.regras);
});

test('trocar o brasão: só o líder, 50 coins + efeito novo, o destravado não paga de novo', async () => {
  await Guildas.comando(lider, { action: 'convidar', quem: NOMES[1] });
  assert.equal((await Guildas.vista(NOMES[1])).view.convites[0].brasao.cor, 'ouro');
  assert.equal((await Guildas.comando(outro, { action: 'aceitar', guildaId: (await Guildas.vista(NOMES[1])).view.convites[0].guildaId })).ok, true);
  const atual = (await Guildas.vista(NOMES[0])).view.minha.brasao;
  assert.match((await Guildas.comando(outro, { action: 'brasao', brasao: { ...atual, simbolo: 'martelo' } })).erro, /Só o líder/);
  assert.match((await Guildas.comando(lider, { action: 'brasao', brasao: atual })).erro, /igual/);

  let antes = lider.estado.coins;
  assert.equal((await Guildas.comando(lider, { action: 'brasao', brasao: { ...atual, simbolo: 'martelo', corSimbolo: 'sangue' } })).ok, true);
  assert.equal(antes - lider.estado.coins, CUSTO_DE_TROCAR + 75);
  assert.deepEqual((await Guildas.vista(NOMES[0])).view.minha.brasaoEfeitos, ['ouro', 'sangue']);

  antes = lider.estado.coins;
  const agora = (await Guildas.vista(NOMES[0])).view.minha.brasao;
  assert.equal((await Guildas.comando(lider, { action: 'brasao', brasao: { ...agora, corSimbolo: 'ouro', cor: 'sangue' } })).ok, true);
  assert.equal(antes - lider.estado.coins, CUSTO_DE_TROCAR);

  const pobre = { ...lider, estado: { ...lider.estado, coins: 10 } };
  assert.match((await Guildas.comando(pobre, { action: 'brasao', brasao: { ...agora, simbolo: null } })).erro, /Faltam 40 Draevor Coins/);
});

test('baú: guarda a peça apontada (alvo), não a primeira de mesmo id', async () => {
  // Peça no formato do sistema de itens (nível + raridade): o baú guarda como está.
  const af = [{ id: 'crit_dmg', nivel: 2, value: 3.1 }];
  lider.estado.inventory = [{ id: 3280, count: 1 }, { id: 3280, count: 1, raridade: 'incomum', af }];
  assert.equal((await Guildas.comando(lider, { action: 'bauGuardar', id: 3280, count: 1, alvo: { indice: 1, tier: 0, af } })).ok, true);
  assert.deepEqual(lider.estado.inventory, [{ id: 3280, count: 1 }]);
  // O baú lê a peça já com a faixa sorteada (`base`) — ela não muda de uma leitura para outra.
  const noBau = (await Guildas.vista(NOMES[0])).view.bau.itens;
  const { base, ilvl, ...resto } = noBau[0];
  assert.deepEqual(resto, { id: 3280, raridade: 'incomum', af, count: 1 });
  assert.ok(base, 'a peça do baú tem faixa');
  assert.ok(ilvl >= 1, 'e Item Level (a migração v4 dá o nível mínimo da peça)');
  assert.deepEqual((await Guildas.vista(NOMES[0])).view.bau.itens[0].base, base, 'a mesma faixa a cada leitura');
  // índice velho (a mochila mudou): acha pela peça
  lider.estado.inventory = [{ id: 1, count: 1 }, { id: 3280, count: 1, tier: 3 }, { id: 3280, count: 1 }];
  assert.equal((await Guildas.comando(lider, { action: 'bauGuardar', id: 3280, count: 1, alvo: { indice: 0, tier: 3, af: null } })).ok, true);
  assert.deepEqual(lider.estado.inventory, [{ id: 1, count: 1 }, { id: 3280, count: 1 }]);
});

test('tabela na ordem do shared: pontos, nível, membros, fundação', async () => {
  const lista = (await Guildas.vista(NOMES[0])).view.lista;
  for (let i = 1; i < lista.length; i++) assert.ok(compararGuildas(lista[i - 1], lista[i]) <= 0, lista[i - 1].nome + " antes de " + lista[i].nome);
});
