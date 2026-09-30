// Presente da equipe para todas as contas (systems/presentes.mjs): pendente NA CONTA, cai no personagem
// que estiver jogando — na hora se estiver online, no login se não — uma vez só por conta.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { banco } from '../database/banco.mjs';
import * as Presentes from '../systems/presentes.mjs';
import * as Mercado from '../systems/mercado.mjs';

const TAG = `teste-presente-${process.pid}`;
const CONTA = (n) => `${TAG}-conta${n}`;
const PERS = (n) => `${TAG}-p${n}`;

after(async () => {
  await banco.prepare('DELETE FROM presentes_entregues WHERE chave LIKE ? OR conta LIKE ?').run(`${TAG}%`, `${TAG}%`);
  await banco.prepare('DELETE FROM creditos WHERE personagem LIKE ?').run(`${TAG}%`);
});

const pendente = (chave, conta, coins = 10000, gold = 0) =>
  banco.prepare("INSERT INTO presentes_entregues (chave, conta, personagem, coins, gold, em, modo) VALUES (?, ?, '', ?, ?, ?, 'conta')").run(chave, conta, coins, gold, Date.now());

test('ferramenta: simulação não grava; com --gravar deixa o presente PENDENTE na conta (sem crédito na fila); a mesma chave não repete', async () => {
  const chave = `${TAG}-ferramenta`;
  const creditosAntes = (await banco.prepare('SELECT COUNT(*) AS n FROM creditos').get()).n;
  await Presentes.presentear({ chave, coins: 10000 });
  assert.equal((await banco.prepare('SELECT COUNT(*) AS n FROM presentes_entregues WHERE chave = ?').get(chave)).n, 0);
  const feito = await Presentes.presentear({ chave, coins: 10000, gravar: true });
  const contas = (await banco.prepare('SELECT COUNT(DISTINCT conta) AS n FROM personagens').get()).n;
  assert.equal(feito.filter((l) => l.entregue).length, Number(contas), 'uma por conta com personagem');
  const pend = await banco.prepare("SELECT COUNT(*) AS n FROM presentes_entregues WHERE chave = ? AND modo = 'conta' AND recebido_em IS NULL").get(chave);
  assert.equal(Number(pend.n), Number(contas));
  assert.equal((await banco.prepare('SELECT COUNT(*) AS n FROM creditos').get()).n, creditosAntes, 'nada na fila de créditos');
  assert.ok((await Presentes.presentear({ chave, coins: 10000, gravar: true })).every((l) => l.jaRecebeu && !l.entregue));
  await assert.rejects(() => Presentes.presentear({ chave: 'Chave Ruim!', coins: 1 }));
  await assert.rejects(() => Presentes.presentear({ chave }));
});

test('a primeira versão (fila do personagem mais antigo): o que está na fila volta para a conta; o já entregue fica como recebido', async () => {
  const chave = `${TAG}-fila`;
  await banco.prepare("INSERT INTO presentes_entregues (chave, conta, personagem, coins, gold, em, modo) VALUES (?, ?, ?, 10000, 0, 111, 'fila')").run(chave, CONTA(1), PERS(1));
  await banco.prepare("INSERT INTO creditos (personagem, gold, coins, itens, origem) VALUES (?, 0, 10000, '[]', 'presente')").run(PERS(1));
  await banco.prepare("INSERT INTO presentes_entregues (chave, conta, personagem, coins, gold, em, modo) VALUES (?, ?, ?, 10000, 0, 222, 'fila')").run(chave, CONTA(2), PERS(2));
  await Presentes.migrarDaFila();
  const [a, b] = await Promise.all([1, 2].map((n) => banco.prepare('SELECT modo, recebido_em, recebido_por FROM presentes_entregues WHERE chave = ? AND conta = ?').get(chave, CONTA(n))));
  assert.deepEqual([a.modo, a.recebido_em, a.recebido_por], ['conta', null, null], 'estava na fila: pendente na conta');
  assert.equal((await banco.prepare('SELECT COUNT(*) AS n FROM creditos WHERE personagem = ?').get(PERS(1))).n, 0, 'e saiu da fila');
  assert.deepEqual([b.modo, Number(b.recebido_em), b.recebido_por], ['conta', 222, PERS(2)], 'a fila já tinha entregado: recebido');
  assert.equal(await Presentes.migrarDaFila(), 0, 'uma vez só');
});

test('reivindicar: o primeiro personagem da conta leva; o segundo, nada', async () => {
  await pendente(`${TAG}-dupla`, CONTA(3), 10000, 500);
  assert.deepEqual(await Presentes.reivindicar(CONTA(3), PERS(31)), { coins: 10000, gold: 500 });
  assert.deepEqual(await Presentes.reivindicar(CONTA(3), PERS(32)), { coins: 0, gold: 0 });
  const r = await banco.prepare('SELECT recebido_por FROM presentes_entregues WHERE chave = ?').get(`${TAG}-dupla`);
  assert.equal(r.recebido_por, PERS(31));
});

test('login: cai no personagem que entrou, com o aviso de presente', async () => {
  await pendente(`${TAG}-login`, CONTA(4));
  const e = { coins: 7, gold: 0 };
  assert.equal(await Presentes.receberNaEntrada(e, CONTA(4), PERS(4)), 'Presente do Draevor: você recebeu 10.000 Draevor Coins.');
  assert.equal(e.coins, 10007);
  assert.equal(await Presentes.receberNaEntrada(e, CONTA(4), PERS(4)), null);
  assert.equal(e.coins, 10007);
});

test('online: quem já está jogando recebe NA HORA — no estado vivo, com aviso no chat, estado novo e gravação', async () => {
  await pendente(`${TAG}-online`, CONTA(5));
  const sessao = (conta, pers) => ({ conta: { id: conta }, personagem: { id: pers }, estado: { coins: 1, gold: 0 }, msgs: [], gravou: 0, mandou: 0,
    enviar(m) { this.msgs.push(m); }, mandarEstado() { this.mandou++; }, async gravarAgora() { this.gravou++; } });
  const jogando = sessao(CONTA(5), PERS(5));
  const outra = sessao(CONTA(6), PERS(6));
  const naTela = { conta: { id: CONTA(5) }, personagem: null, estado: null };
  const vivas = new Map([['a', jogando], ['b', outra], ['c', naTela]]);
  assert.equal(await Presentes.verificarOnline(vivas), 1);
  assert.equal(jogando.estado.coins, 10001);
  assert.deepEqual(jogando.msgs, [{ t: 'chat', aviso: true, channel: 'global', text: 'Presente do Draevor: você recebeu 10.000 Draevor Coins.' }]);
  assert.equal(jogando.mandou, 1);
  assert.equal(jogando.gravou, 1);
  assert.equal(outra.estado.coins, 1, 'outra conta, nada');
  assert.equal(await Presentes.verificarOnline(vivas), 0, 'de novo: nada');
});

test('o crédito do Mercado segue com o aviso dele', async () => {
  await banco.prepare("INSERT INTO creditos (personagem, gold, coins, itens) VALUES (?, 300, 0, '[]')").run(PERS(7));
  assert.equal(await Mercado.receberCreditos({ coins: 0, gold: 0, inventory: [], equipment: {} }, PERS(7)), 'Mercado: você recebeu 300 gold enquanto estava fora.');
});
