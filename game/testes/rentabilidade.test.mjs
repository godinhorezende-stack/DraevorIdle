// O preço de venda ao NPC e as contas do Analisador (`hunt/rentabilidade.mjs`): os cenários da
// auditoria de 01/10, comparados com contas independentes e com a venda de verdade.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Rent from '../systems/hunt/rentabilidade.mjs';
import * as Relatorio from '../systems/hunt/relatorio.mjs';
import * as Bolsa from '../systems/bolsa.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import { personagemDeTeste, HUNT_DE_TESTE } from './apoio.mjs';

const ITEM = 900_001; // ids de mentira: o preço é passado pela função
const preco = (tabela) => (id) => tabela[id] ?? 0;

test('valor esperado: 0,1% de chance, 10.000 de preço, 1.000 mortes = 10.000 (chance é fração, não %)', () => {
  const bestiario = { lobo: { loot: [{ id: ITEM, chance: 0.001 }] } };
  const r = Rent.valorEsperado({ lobo: 1000 }, bestiario, preco({ [ITEM]: 10_000 }));
  assert.equal(Math.round(r.valor), 10_000);
  assert.equal(Math.round(r.itens[0].quantidade * 1000) / 1000, 1);
});

test('valor esperado: drop garantido, chance baixíssima, item de 1 gold, item sem preço, chance acima de 1', () => {
  const b = { m: { loot: [{ id: 1, chance: 1 }, { id: 2, chance: 0.00002 }, { id: 3, chance: 0.5 }, { id: 4, chance: 0.5 }, { id: 5, chance: 7 }] } };
  const r = Rent.valorEsperado({ m: 1000 }, b, preco({ 1: 50, 2: 1_000_000, 3: 1, 5: 2 }));
  const de = (id) => r.itens.find((i) => i.id === id);
  assert.equal(de(1).total, 50_000, 'garantido: 1000 × 50');
  assert.equal(Math.round(de(2).total), 20_000, 'raríssimo: 1000 × 0,00002 × 1.000.000');
  assert.equal(de(3).total, 500, '1 gold: 500 unidades × 1');
  assert.equal(de(4).total, 0, 'sem preço: conta 0, sem inventar 1 gold');
  assert.equal(de(5).total, 2000, 'chance > 1 vale 100%');
});

test('valor esperado: quantidade variável — a moeda de ouro sai em volta da exp do bicho', () => {
  const b = { troll: { exp: 20, loot: [{ id: 3031, chance: 0.5 }] } };
  const r = Rent.valorEsperado({ troll: 100 }, b);
  assert.equal(r.gold, 100 * 0.5 * 20, 'ouro esperado = mortes × chance × média');
  assert.equal(r.valor, 0, 'moeda não entra como item (não conta duas vezes)');
});

test('valor do loot coletado: preço × quantidade, moedas fora, sem preço avisado e contando 0', () => {
  const r = Rent.valorDoLoot({ 1: 3, 2: 10, 3031: 500, 4: 2 }, preco({ 1: 10_000, 2: 1 }));
  assert.equal(r.valor, 30_000 + 10);
  assert.equal(r.semPreco, 2);
  assert.deepEqual(r.itens.map((i) => i.id), [1, 2], 'do que mais vale para o que menos vale');
});

test('resumo: bruto, custos, líquido e por hora — inclusive bruto positivo com líquido negativo, e prejuízo real', () => {
  const caro = Rent.resumo({ gold: 1000, loot: 4000, supplies: 8000, ms: 3_600_000 });
  assert.deepEqual([caro.bruto, caro.custos, caro.liquido, caro.porHora], [5000, 8000, -3000, -3000], 'consumível caro: prejuízo de verdade aparece');
  const meia = Rent.resumo({ gold: 0, loot: 10_000, supplies: 2000, ms: 1_800_000 });
  assert.equal(meia.porHora, 16_000, 'por hora com meia hora');
  assert.equal(Rent.resumo({ gold: 0, loot: 0, supplies: 0, ms: 0 }).porHora, 0, 'sem tempo: 0, e não infinito/NaN');
});

test('o preço do Analisador é o MESMO da venda: vender a bolsa paga exatamente o valor calculado', () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 50 });
  e.pouch = [];
  const comPreco = Object.values(ITEM_CATALOG).filter((i) => i.sell > 0 && i.stackable).slice(0, 3);
  for (const [k, i] of comPreco.entries()) Bolsa.porNaBolsa(e, Number(i.id), k + 2);
  const esperado = comPreco.reduce((t, i, k) => t + Rent.precoNpc(Number(i.id)) * (k + 2), 0);
  assert.equal(Bolsa.valorDaBolsa(e).gold, esperado, 'a "próxima venda" promete o mesmo');
  assert.equal(Bolsa.venderBolsa(e).gold, esperado, 'e a venda paga o mesmo');
});

test('a CAUSA do prejuízo falso: vender a bolsa à mão não muda mais o lucro da sessão', () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 50 });
  e.pouch = [];
  const item = Object.values(ITEM_CATALOG).find((i) => i.sell >= 100 && i.stackable);
  const sessao = Relatorio.novaSessao(e, 'teste', 'auto', Date.now() - 3_600_000);
  sessao.supplies = 50;
  Bolsa.porNaBolsa(e, Number(item.id), 4);
  sessao.itens.loot[item.id] = 4; // o que a caçada conta ao coletar
  const antes = Relatorio.analise(sessao, 3_600_000);
  assert.equal(antes.valorDoLoot, Rent.precoNpc(Number(item.id)) * 4);
  // A conta antiga: ouro + vendido-pela-auto-venda + bolsa de AGORA.
  const contaAntiga = () => sessao.gold + sessao.lootValue + Bolsa.valorDaBolsa(e).gold - sessao.supplies;
  const antigaAntes = contaAntiga();
  Bolsa.venderAgora(e); // o botão "Vender" da bolsa (não passa pela sessão)
  assert.ok(contaAntiga() < antigaAntes, 'na conta antiga o lucro caía (até ficar negativo)');
  const depois = Relatorio.analise(sessao, 3_600_000);
  assert.equal(depois.liquido, antes.liquido, 'na conta nova o lucro é o mesmo');
  assert.equal(depois.liquido, antes.valorDoLoot - 50);
});

test('relatório da caçada e Analisador usam a mesma conta (ouro + loot pelo NPC − suprimentos)', () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 50 });
  const item = Object.values(ITEM_CATALOG).find((i) => i.sell >= 10 && i.stackable);
  const sessao = Relatorio.novaSessao(e, 'teste', 'auto', Date.now() - 1_800_000);
  sessao.gold = 700;
  sessao.supplies = 300;
  sessao.itens.loot[item.id] = 10;
  const rel = Relatorio.relatorio(e, sessao);
  assert.equal(rel.lucro, 700 + Rent.precoNpc(Number(item.id)) * 10 - 300);
  assert.equal(rel.valorDoLoot, Rent.precoNpc(Number(item.id)) * 10);
  assert.equal(Relatorio.sessaoParaCliente(sessao).analise.liquido, rel.lucro);
});

test('estimativa da sessão: pelas mortes REGISTRADAS, com a tabela real do bicho', () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 50 });
  const sessao = Relatorio.novaSessao(e, 'teste', 'auto');
  sessao.byMonster.Troll = 1000;
  const a = Relatorio.analise(sessao, 3_600_000);
  assert.ok(a.estimativa.gold > 0, 'troll dá moedas');
  assert.ok(a.estimativa.valor > 0, 'e itens com preço');
  assert.ok(a.estimativa.principais.length > 0);
});

test('peça de raridade alta (com atributos) vende pelo preço do item-base — a mesma regra em todo lugar', () => {
  const arma = Object.values(ITEM_CATALOG).find((i) => i.slot === 'weapon' && i.sell > 0 && !i.stackable);
  const e = personagemDeTeste({ vocacao: 'knight', level: 50 });
  e.pouch = [{ id: Number(arma.id), count: 1, raridade: 'lendário', af: [{ id: 'atk_flat', nivel: 5, value: 12 }] }];
  const bolsa = Bolsa.valorDaBolsa(e);
  const naVenda = Bolsa.venderBolsa(e).gold;
  assert.equal(bolsa.gold, naVenda, 'o que a bolsa promete é o que a venda paga (guardada pelo filtro: 0 nos dois)');
  if (naVenda) assert.equal(naVenda, Rent.precoNpc(Number(arma.id)));
});

test('loot SEM id no bestiário ("rotten feather"): não vira item fantasma na bolsa nem "undefined" no Analisador', async () => {
  const Cacadas = await import('../systems/cacadas.mjs');
  const { criarMonstro, BESTIARY } = await import('../systems/hunt/monstros.mjs');
  const { matarMonstro } = await import('../systems/hunt/combate.mjs');
  const { PERSONAGEM } = await import('./apoio.mjs');
  const chave = Object.keys(BESTIARY).find((k) => (BESTIARY[k].loot ?? []).some((l) => l.id == null && l.chance > 0.5));
  assert.ok(chave, 'existe bicho com entrada de loot sem id (o dado continua lá)');
  const e = personagemDeTeste({ level: 300 });
  e.pouch = [];
  e.maxHp = e.hp = 1e9;
  assert.equal(Cacadas.entrar(e, { huntId: HUNT_DE_TESTE, mode: 'auto' }).ok, true);
  for (let i = 0; i < 15; i++) {
    const m = criarMonstro({ key: chave, x: e.hunt.pos.x + 1, y: e.hunt.pos.y }, null);
    e.hunt.monstros.push(m);
    matarMonstro(e, e.hunt, PERSONAGEM, m, []);
  }
  assert.equal(e.pouch.filter((p) => p.id == null || !Number.isFinite(Number(p.id))).length, 0, 'nenhum item sem id na bolsa');
  assert.ok(!('undefined' in e.hunt.sessao.itens.loot), 'nem na sessão');
  // E a sessão antiga que já tem o fantasma não quebra a conta.
  assert.equal(Rent.valorDoLoot({ undefined: 9, 3031: 5 }).valor, 0);
});
