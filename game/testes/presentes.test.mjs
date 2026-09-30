// Presente da equipe para todas as contas (systems/presentes.mjs) e o aviso dele no login (Mercado.receberCreditos).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { banco } from '../database/banco.mjs';
import * as Presentes from '../systems/presentes.mjs';
import * as Mercado from '../systems/mercado.mjs';

const CHAVE = `teste-presente-${process.pid}`;
const PID = (n) => `teste-presente-p${n}-${process.pid}`;

after(async () => {
  // Os créditos primeiro (eles são achados pela anotação), depois a anotação.
  await banco.prepare("DELETE FROM creditos WHERE origem = 'presente' AND personagem IN (SELECT personagem FROM presentes_entregues WHERE chave = ?)").run(CHAVE);
  await banco.prepare('DELETE FROM presentes_entregues WHERE chave = ?').run(CHAVE);
  for (const n of [1, 2, 3]) await banco.prepare('DELETE FROM creditos WHERE personagem = ?').run(PID(n));
});

test('plano: uma linha por conta com personagem, o mais antigo dela', async () => {
  const linhas = await Presentes.plano(CHAVE);
  const contas = (await banco.prepare('SELECT DISTINCT conta FROM personagens').all()).map((r) => r.conta);
  assert.equal(linhas.length, contas.length, 'uma por conta');
  for (const l of linhas) {
    const maisAntigo = await banco.prepare('SELECT id FROM personagens WHERE conta = ? ORDER BY criado_em ASC, nome ASC LIMIT 1').get(l.conta);
    assert.equal(l.personagem, maisAntigo.id);
    assert.equal(l.jaRecebeu, false);
  }
});

test('sem --gravar não grava nada; com, entrega uma vez por conta — a mesma chave não entrega de novo', async () => {
  const antes = (await banco.prepare('SELECT COUNT(*) AS n FROM creditos').get()).n;
  await Presentes.presentear({ chave: CHAVE, coins: 10000 });
  assert.equal((await banco.prepare('SELECT COUNT(*) AS n FROM creditos').get()).n, antes, 'simulação não grava');

  const feito = await Presentes.presentear({ chave: CHAVE, coins: 10000, gravar: true });
  const entregues = feito.filter((l) => l.entregue);
  assert.equal(entregues.length, feito.length);
  for (const l of entregues) {
    const c = await banco.prepare("SELECT coins, origem FROM creditos WHERE personagem = ? AND origem = 'presente'").all(l.personagem);
    assert.equal(c.length, 1);
    assert.equal(Number(c[0].coins), 10000);
  }
  const deNovo = await Presentes.presentear({ chave: CHAVE, coins: 10000, gravar: true });
  assert.ok(deNovo.every((l) => l.jaRecebeu && !l.entregue), 'a mesma chave não entrega duas vezes');
  await assert.rejects(() => Presentes.presentear({ chave: 'Chave Ruim!', coins: 1 }));
  await assert.rejects(() => Presentes.presentear({ chave: CHAVE }));
});

test('no login: o presente entra no bolso com o aviso de presente; o do Mercado segue com o dele', async () => {
  await banco.prepare("INSERT INTO creditos (personagem, gold, coins, itens, origem) VALUES (?, 0, 10000, '[]', 'presente')").run(PID(1));
  const e = { coins: 5, gold: 0, inventory: [], equipment: {} };
  assert.equal(await Mercado.receberCreditos(e, PID(1)), 'Presente do Draevor: você recebeu 10.000 Draevor Coins.');
  assert.equal(e.coins, 10005);
  assert.equal(await Mercado.receberCreditos(e, PID(1)), null, 'entregue uma vez só');

  await banco.prepare("INSERT INTO creditos (personagem, gold, coins, itens, origem) VALUES (?, 0, 10000, '[]', 'presente')").run(PID(2));
  await banco.prepare("INSERT INTO creditos (personagem, gold, coins, itens) VALUES (?, 300, 0, '[]')").run(PID(2));
  const aviso = await Mercado.receberCreditos({ coins: 0, gold: 0, inventory: [], equipment: {} }, PID(2));
  assert.match(aviso, /^Presente do Draevor: você recebeu 10\.000 Draevor Coins\. Mercado: você recebeu 300 gold enquanto estava fora\.$/);
});
