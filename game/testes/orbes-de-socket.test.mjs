// Os ORBES de socket (Orb of Socketing / Orb of Linking) e a venda deles na loja da Zuma Magehide:
// limites por tipo de peça, links e grupos independentes, efeito das supports mudando com o link,
// consumo só depois de validar, persistência, cliques repetidos, peças antigas e a compra (saldo,
// pedido repetido, depósito). O servidor é a fonte da verdade; a tela só propõe e confirma.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../systems/skills/gemas.mjs';
import * as Ficha from '../systems/ficha.mjs';
import * as Deposito from '../systems/deposito.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import { gruposLigados } from '../engine/sockets-de-gema.mjs';
import { personagemDeTeste } from './apoio.mjs';

const idDe = (nome) => Number(Object.values(ITEM_CATALOG).find((i) => i.name === nome).id);
const GEMA = (acao) => G.ITEM_DA_ACAO.get(acao);
const SUPPORT = (id) => [...G.DEFS.values()].find((d) => d.tipo === 'support' && d.id === id).itemId;
const FLAME = 'spell-flame-strike';
const ENCAIXE = G.ORBE_DE_ENCAIXE;
const LIGACAO = G.ORBE_DE_LIGACAO;
const quantos = (e, id) => e.inventory.filter((p) => p.id === id).reduce((t, p) => t + (p.count ?? 1), 0);
const dar = (e, id, n) => e.inventory.push({ id, count: n });

/** Uma peça vestida em `slot` com `abertos` sockets e os links dados. */
function vestir(e, slot, nome, { abertos, links = [], gemas = [] } = {}) {
  const id = idDe(nome);
  const max = G.maximoDeSockets(ITEM_CATALOG[id]);
  e.equipment[slot] = { id, count: 1, soquetes: { abertos, links: Array.from({ length: max - 1 }, (_, i) => !!links[i]), gemas: Array.from({ length: max }, (_, i) => gemas[i] ?? null) } };
  Ficha.invalidar(e);
  return e.equipment[slot];
}
const novo = () => personagemDeTeste({ vocacao: 'sorcerer', level: 200 });

test('os dois orbes existem no catálogo: itens reais, empilháveis, com descrição e o limite por slot', () => {
  for (const [id, tipo] of [[ENCAIXE, 'encaixe'], [LIGACAO, 'ligacao']]) {
    const i = ITEM_CATALOG[id];
    assert.ok(i, `${tipo} está no catálogo`);
    assert.equal(i.stackable, true);
    assert.equal(i.sell, 0, 'o NPC não compra de volta');
    assert.equal(i.orbeDeSocket, tipo);
    assert.ok(i.descricao.length > 20);
    assert.equal(i.limitesDeSocket.weapon, G.CONFIG.sockets.maximo.weapon);
  }
  assert.notEqual(ENCAIXE, LIGACAO);
});

test('Orbe de Encaixe: abre UM socket, vazio e sem link; gasta 1 orbe; gemas e links ficam como estavam', () => {
  const e = novo();
  const gema = G.novaGema(GEMA(FLAME));
  vestir(e, 'weapon', 'wand of vortex', { abertos: 2, links: [true], gemas: [gema] });
  dar(e, ENCAIXE, 3);
  const r = G.abrirSocket(e, { slot: 'weapon' });
  assert.equal(r.ok, true);
  const s = G.soquetesDe(e.equipment.weapon);
  assert.equal(s.abertos, 3);
  assert.equal(s.gemas[2], null, 'o socket novo nasce vazio');
  assert.deepEqual(s.gemas[0], gema, 'a gema continua onde estava');
  assert.equal(s.links[0], true, 'o link que já existia fica');
  assert.equal(s.links[2 - 1], false, 'o socket novo nasce sem link com o vizinho');
  assert.equal(quantos(e, ENCAIXE), 2, 'gastou exatamente 1');
});

test('limite por tipo de peça: não passa do máximo do slot, informa o motivo e NÃO gasta o orbe', () => {
  for (const [slot, nome] of [['weapon', 'wand of vortex'], ['head', 'crown helmet'], ['ring', 'might ring']]) {
    const e = novo();
    const meta = ITEM_CATALOG[idDe(nome)];
    const max = G.maximoDeSockets(meta);
    assert.equal(max, G.CONFIG.sockets.maximo[meta.slot], `${nome}: o limite vem da config central`);
    vestir(e, slot, nome, { abertos: max });
    dar(e, ENCAIXE, 2);
    const r = G.abrirSocket(e, { slot });
    assert.equal(r.ok, false);
    assert.match(r.erro, /máximo/);
    assert.equal(quantos(e, ENCAIXE), 2, `${nome}: o orbe não foi gasto`);
    assert.equal(G.soquetesDe(e.equipment[slot]).abertos, max);
  }
  // Os limites NÃO são iguais para todo mundo.
  const limites = new Set(Object.values(G.CONFIG.sockets.maximo));
  assert.ok(limites.size > 1);
});

test('uso errado não gasta nada: sem orbe, slot vazio, peça sem sockets (backpack/munição)', () => {
  const e = novo();
  vestir(e, 'weapon', 'wand of vortex', { abertos: 1 });
  assert.match(G.abrirSocket(e, { slot: 'weapon' }).erro, /não tem Orbe de Encaixe/);
  dar(e, ENCAIXE, 1);
  e.equipment.legs = null;
  assert.match(G.abrirSocket(e, { slot: 'legs' }).erro, /Não há nada vestido/);
  const mochila = e.equipment.backpack ?? { id: 2854, count: 1 };
  e.equipment.backpack = mochila; // a mochila não tem sockets (config: ammo e backpack ficam de fora)
  assert.match(G.abrirSocket(e, { slot: 'backpack' }).erro, /não tem sockets/);
  assert.equal(quantos(e, ENCAIXE), 1);
  assert.equal(G.soquetesDe(e.equipment.weapon).abertos, 1);
});

test('peça antiga SEM o campo `soquetes`: o orbe abre o primeiro socket (equipamento já existente)', () => {
  const e = novo();
  e.equipment.weapon = { id: idDe('wand of vortex'), count: 1 };
  dar(e, ENCAIXE, 1);
  assert.equal(G.abrirSocket(e, { slot: 'weapon' }).ok, true);
  assert.equal(G.soquetesDe(e.equipment.weapon).abertos, 1);
});

test('Orbe de Ligação: liga dois sockets vizinhos (e só esses), gastando 1 orbe', () => {
  const e = novo();
  vestir(e, 'weapon', 'wand of vortex', { abertos: 4 });
  dar(e, LIGACAO, 5);
  const r = G.ligarElo(e, { slot: 'weapon', elo: 0, ligar: true });
  assert.equal(r.ok, true);
  assert.deepEqual(G.soquetesDe(e.equipment.weapon).links, [true, false, false]);
  assert.equal(quantos(e, LIGACAO), 4);
  assert.match(r.notice, /1\+2 \| 3 \| 4/);
});

test('grupos de 3 ou mais e GRUPOS INDEPENDENTES na mesma peça; alterar e remover links', () => {
  const e = novo();
  vestir(e, 'body', 'plate armor', { abertos: 4 });
  dar(e, LIGACAO, 10);
  const ligar = (elo, ligar = true) => G.ligarElo(e, { slot: 'body', elo, ligar });
  assert.equal(ligar(0).ok && ligar(1).ok, true);
  assert.deepEqual(gruposLigados(G.soquetesDe(e.equipment.body)), [[0, 1, 2], [3]], 'um grupo de 3');
  assert.equal(ligar(1, false).ok, true, 'remover um link');
  assert.equal(ligar(2).ok, true);
  assert.deepEqual(gruposLigados(G.soquetesDe(e.equipment.body)), [[0, 1], [2, 3]], 'dois grupos independentes (A e B)');
  assert.equal(quantos(e, LIGACAO), 10 - 4);
});

test('validação do elo: sockets bloqueados, índice inválido, estado já pedido — nada gasta, nada muda', () => {
  const e = novo();
  vestir(e, 'weapon', 'wand of vortex', { abertos: 2, links: [true] });
  dar(e, LIGACAO, 3);
  const antes = JSON.stringify(e.equipment.weapon);
  for (const m of [{ elo: 1, ligar: true }, { elo: -1, ligar: true }, { elo: 9, ligar: true }, { elo: 0, ligar: true }, { elo: 'x', ligar: true }, { elo: 0 }]) {
    assert.equal(G.ligarElo(e, { slot: 'weapon', ...m }).ok, false, JSON.stringify(m));
  }
  assert.equal(JSON.stringify(e.equipment.weapon), antes, 'a peça não mudou');
  assert.equal(quantos(e, LIGACAO), 3, 'nenhum orbe gasto');
  assert.match(G.ligarElo(e, { slot: 'weapon', elo: 0, ligar: true }).erro, /já estão ligados/);
});

test('o link decide a support: ligar passa a valer, desligar tira o efeito; grupos separados não compartilham', () => {
  const e = novo();
  const GD = SUPPORT('greater-damage');
  vestir(e, 'weapon', 'wand of vortex', { abertos: 4, gemas: [G.novaGema(GEMA(FLAME)), G.novaGema(GD)] });
  dar(e, LIGACAO, 5);
  assert.deepEqual(G.efeitoNaSkill(e, FLAME).supports, [], 'sem link: a support não vale');
  assert.equal(G.ligarElo(e, { slot: 'weapon', elo: 0, ligar: true }).ok, true);
  assert.deepEqual(G.efeitoNaSkill(e, FLAME).supports, ['Greater Damage'], 'ligou: vale');
  assert.equal(G.ligarElo(e, { slot: 'weapon', elo: 0, ligar: false }).ok, true);
  assert.deepEqual(G.efeitoNaSkill(e, FLAME).supports, [], 'desligou: o efeito saiu');
  assert.ok(G.soquetesDe(e.equipment.weapon).gemas[0] && G.soquetesDe(e.equipment.weapon).gemas[1], 'as gemas não saíram do lugar');
  // Dois grupos: a support do grupo B não afeta a skill do grupo A.
  vestir(e, 'weapon', 'wand of vortex', { abertos: 4, links: [false, false, true], gemas: [G.novaGema(GEMA(FLAME)), null, G.novaGema(GEMA('spell-energy-strike')), G.novaGema(GD)] });
  assert.deepEqual(G.efeitoNaSkill(e, FLAME).supports, [], 'a support do outro grupo não chega');
});

test('cliques repetidos: encaixe esgota no limite; ligação pedindo o mesmo estado não desfaz nem gasta', () => {
  const e = novo();
  vestir(e, 'weapon', 'wand of vortex', { abertos: 3 });
  dar(e, ENCAIXE, 5);
  dar(e, LIGACAO, 5);
  const max = G.maximoDeSockets(ITEM_CATALOG[idDe('wand of vortex')]);
  const resultados = Array.from({ length: 6 }, () => G.abrirSocket(e, { slot: 'weapon' }).ok);
  assert.equal(resultados.filter(Boolean).length, max - 3, 'só abriu até o máximo');
  assert.equal(quantos(e, ENCAIXE), 5 - (max - 3), 'e só gastou o que abriu');
  const duplo = [G.ligarElo(e, { slot: 'weapon', elo: 0, ligar: true }), G.ligarElo(e, { slot: 'weapon', elo: 0, ligar: true })];
  assert.deepEqual(duplo.map((r) => r.ok), [true, false], 'o segundo clique não faz nada');
  assert.equal(G.soquetesDe(e.equipment.weapon).links[0], true, 'o link continua ligado');
  assert.equal(quantos(e, LIGACAO), 4, 'um orbe só');
});

test('o último orbe: a pilha some (sem sobra de 0), e sem orbe nenhum o uso é recusado', () => {
  const e = novo();
  vestir(e, 'weapon', 'wand of vortex', { abertos: 1 });
  dar(e, ENCAIXE, 1);
  assert.equal(G.abrirSocket(e, { slot: 'weapon' }).ok, true);
  assert.equal(e.inventory.some((p) => p.id === ENCAIXE), false);
  assert.equal(G.abrirSocket(e, { slot: 'weapon' }).ok, false);
});

test('persistência: depois de gravar e ler o save, os sockets, os links e o saldo de orbes são os mesmos', () => {
  const e = novo();
  vestir(e, 'weapon', 'wand of vortex', { abertos: 2, gemas: [G.novaGema(GEMA(FLAME))] });
  dar(e, ENCAIXE, 2);
  dar(e, LIGACAO, 2);
  G.abrirSocket(e, { slot: 'weapon' });
  G.ligarElo(e, { slot: 'weapon', elo: 0, ligar: true });
  const relido = JSON.parse(JSON.stringify(e));
  assert.deepEqual(G.soquetesDe(relido.equipment.weapon), G.soquetesDe(e.equipment.weapon));
  assert.equal(G.soquetesDe(relido.equipment.weapon).abertos, 3);
  assert.equal(quantos(relido, ENCAIXE), 1);
  assert.equal(quantos(relido, LIGACAO), 1);
});

test('campos extras do `soquetes` (cores, no futuro) sobrevivem às operações dos orbes', () => {
  const e = novo();
  const p = vestir(e, 'weapon', 'wand of vortex', { abertos: 2 });
  p.soquetes.cores = ['r', 'g', 'b'];
  dar(e, ENCAIXE, 1);
  dar(e, LIGACAO, 1);
  G.abrirSocket(e, { slot: 'weapon' });
  G.ligarElo(e, { slot: 'weapon', elo: 0, ligar: true });
  assert.deepEqual(e.equipment.weapon.soquetes.cores, ['r', 'g', 'b']);
});

test('drop: a chance dos orbes é ZERO por enquanto (a fonte é a loja); com valor na config, sai', () => {
  for (const tipo of ['encaixe', 'ligacao']) {
    for (let i = 0; i < 2000; i++) assert.equal(G.sortearOrbe(tipo, { ato: 1 }, () => 0), null, 'zero é zero, mesmo com o dado no pior caso');
  }
  const antes = G.CONFIG.orbes.encaixe.drop.chancePorAto['1'];
  G.CONFIG.orbes.encaixe.drop.chancePorAto['1'] = 0.5;
  assert.deepEqual(G.sortearOrbe('encaixe', { ato: 1 }, () => 0.1), { id: ENCAIXE, count: 1 });
  G.CONFIG.orbes.encaixe.drop.chancePorAto['1'] = antes;
});

// ---------------------------------------------------------------- a loja da Zuma Magehide

const orbesDaLoja = (e) => G.catalogoDaLoja(e).filter((l) => l.categoria === 'orbes');

test('loja: os dois orbes aparecem, a 10.000.000 de gold cada, com nome e ícone (id do item)', () => {
  const linhas = orbesDaLoja(novo());
  assert.deepEqual(linhas.map((l) => l.id).sort(), [ENCAIXE, LIGACAO].sort());
  for (const l of linhas) {
    assert.equal(l.buy, 10_000_000);
    assert.match(l.nome, /Orb of (Socketing|Linking)/);
    assert.equal(l.categoriaNome, 'Orbes de socket');
    assert.ok(ITEM_CATALOG[l.id].descricao);
  }
});

test('loja: as gemas e os preços delas NÃO mudaram', () => {
  const gemas = G.catalogoDaLoja(novo()).filter((l) => l.categoria !== 'orbes');
  assert.ok(gemas.length > 20);
  for (const l of gemas) {
    const def = G.DEFS.get(l.id);
    assert.equal(l.buy, G.precoNaLoja(def, l.raridade), `${l.nome}: preço igual ao da fórmula de sempre`);
  }
});

test('compra de 1 e de várias unidades: desconta o total exato e empilha na mochila', () => {
  const e = novo();
  e.gold = 100_000_000;
  e.bank = 0;
  assert.equal(G.comprarNaLoja(e, { id: ENCAIXE, count: 1 }).ok, true);
  assert.equal(e.gold, 90_000_000);
  assert.equal(quantos(e, ENCAIXE), 1);
  const r = G.comprarNaLoja(e, { id: LIGACAO, count: 3 });
  assert.equal(r.ok, true);
  assert.equal(e.gold, 60_000_000, '3 × 10.000.000');
  assert.equal(quantos(e, LIGACAO), 3);
  assert.match(r.notice, /30\.000\.000/);
  assert.equal(e.inventory.filter((p) => p.id === LIGACAO).length, 1, 'uma pilha só');
});

test('compra: o ouro vem do bolso e depois do banco; a pilha passa de 100 em outra pilha', () => {
  const e = novo();
  e.gold = 5_000_000;
  e.bank = 500_000_000;
  e.inventory = [{ id: ENCAIXE, count: 99 }];
  assert.equal(G.comprarNaLoja(e, { id: ENCAIXE, count: 2 }).ok, true);
  assert.equal(e.gold, 0);
  assert.equal(e.bank, 485_000_000);
  assert.deepEqual(e.inventory.map((p) => p.count), [100, 1], 'a pilha cheia fecha em 100 e a sobra abre outra');
});

test('compra sem saldo: recusada por inteiro — nem ouro nem item mexem', () => {
  const e = novo();
  e.gold = 9_999_999;
  e.bank = 0;
  const r = G.comprarNaLoja(e, { id: ENCAIXE, count: 1 });
  assert.equal(r.ok, false);
  assert.match(r.erro, /Ouro insuficiente/);
  assert.equal(e.gold, 9_999_999);
  assert.equal(quantos(e, ENCAIXE), 0);
  e.gold = 25_000_000;
  assert.equal(G.comprarNaLoja(e, { id: ENCAIXE, count: 3 }).ok, false, 'pediu 3 com saldo de 2');
  assert.equal(e.gold, 25_000_000);
});

test('compras seguidas (concorrência): cada uma confere o saldo da anterior — não gasta o mesmo ouro duas vezes', () => {
  const e = novo();
  e.gold = 10_000_000;
  e.bank = 0;
  const resultados = [G.comprarNaLoja(e, { id: ENCAIXE, count: 1 }), G.comprarNaLoja(e, { id: ENCAIXE, count: 1 }), G.comprarNaLoja(e, { id: LIGACAO, count: 1 })];
  assert.deepEqual(resultados.map((r) => r.ok), [true, false, false]);
  assert.equal(e.gold, 0);
  assert.equal(quantos(e, ENCAIXE) + quantos(e, LIGACAO), 1, 'um item só, e o saldo nunca ficou negativo');
});

test('produto fora da loja ou indisponível: recusado; o teto por compra vale', () => {
  const e = novo();
  e.gold = 1e12;
  assert.equal(G.comprarNaLoja(e, { id: 3031, count: 1 }).ok, false, 'item que ela não vende');
  const r = G.comprarNaLoja(e, { id: ENCAIXE, count: 5000 });
  assert.equal(r.ok, true);
  assert.equal(quantos(e, ENCAIXE), G.CONFIG.loja.porVez, 'no máximo `porVez` de uma vez');
  G.CONFIG.orbes.ligacao.loja.disponivel = false;
  assert.equal(G.comprarNaLoja(e, { id: LIGACAO, count: 1 }).ok, false, 'tirado da venda na config: some da compra…');
  assert.equal(orbesDaLoja(e).some((l) => l.id === LIGACAO), false, '…e da vitrine');
  G.CONFIG.orbes.ligacao.loja.disponivel = true;
});

test('inventário cheio: o que passa da capacidade vai para o depósito (o mais pesado primeiro), sem perder nada', async () => {
  const Afixos = await import('../systems/afixos.mjs');
  const { pesoDoInventario } = await import('../systems/inventario.mjs');
  const e = novo();
  e.gold = 400_000_000;
  e.bank = 0;
  e.inventory = [];
  // Um item empilhável pesado (1 oz cada) enche a mochila até menos de 2 oz da capacidade: 20 orbes (2 oz) estouram.
  const enchimento = Object.values(ITEM_CATALOG).find((i) => i.stackable && i.weight === 1 && !i.slot);
  assert.ok(enchimento, 'há um item de 1 oz no catálogo para o teste');
  const folga = Afixos.capacidade(e) - pesoDoInventario(e);
  e.inventory.push({ id: Number(enchimento.id), count: Math.floor(folga - 0.5) });
  const sobra = Afixos.capacidade(e) - pesoDoInventario(e);
  assert.ok(sobra >= 0 && sobra < 1.9, `sobra menos de 2 oz (${sobra})`);
  assert.equal(G.comprarNaLoja(e, { id: ENCAIXE, count: 20 }).ok, true);
  assert.ok(pesoDoInventario(e) > Afixos.capacidade(e), 'a compra estourou a capacidade');
  const foi = Deposito.excessoParaODeposito(e); // o que a sessão faz depois de toda compra (`aplicar`)
  assert.ok(foi.length > 0, 'algo foi para o depósito');
  assert.ok(pesoDoInventario(e) <= Afixos.capacidade(e), 'a mochila voltou para dentro da capacidade');
  // Nada se perdeu: o que saiu da mochila está no depósito, na mesma quantidade.
  const guardado = (id) => JSON.stringify(e.deposito ?? []).includes(`"id":${id}`);
  for (const f of foi) assert.ok(guardado(f.id), `${f.name} está no depósito`);
  assert.equal(e.gold, 200_000_000, 'e o ouro foi cobrado uma vez só');
});

test('o pedido repetido (mesmo `pedido`) é ignorado pela sessão: um duplo clique compra uma vez só', async () => {
  const { Sessao } = await import('../websocket/sessao.mjs');
  const e = novo();
  e.gold = 100_000_000;
  e.bank = 0;
  const s = new Sessao({ readyState: 1, bufferedAmount: 0, send: () => {} });
  s.estado = e;
  s.personagem = { id: 'x', nome: 'Orbes' };
  s.mandarLojaDeGemas = () => {};
  s.aplicar = (r) => (r.ok ? undefined : undefined);
  s.erro = () => {};
  s.comprarNoNpc({ id: ENCAIXE, count: 1, pedido: 'abc' });
  s.comprarNoNpc({ id: ENCAIXE, count: 1, pedido: 'abc' }); // o mesmo clique, reenviado
  assert.equal(quantos(e, ENCAIXE), 1);
  assert.equal(e.gold, 90_000_000);
  s.comprarNoNpc({ id: ENCAIXE, count: 1, pedido: 'def' }); // um clique NOVO compra
  assert.equal(quantos(e, ENCAIXE), 2);
  s.comprarNoNpc({ id: ENCAIXE, count: 1 }); // cliente antigo, sem `pedido`: como antes
  assert.equal(quantos(e, ENCAIXE), 3);
});

test('persistência da compra: depois do save, os orbes e o saldo continuam', () => {
  const e = novo();
  e.gold = 30_000_000;
  e.bank = 0;
  G.comprarNaLoja(e, { id: ENCAIXE, count: 2 });
  const relido = JSON.parse(JSON.stringify(e));
  assert.equal(quantos(relido, ENCAIXE), 2);
  assert.equal(relido.gold, 10_000_000);
});
