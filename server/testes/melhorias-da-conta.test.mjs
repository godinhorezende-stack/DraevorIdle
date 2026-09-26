// As melhorias da conta (slot de party...) ficam guardadas em memória: ler de
// novo não vai ao banco, gravar atualiza o guardado, e mexer no objeto lido
// não suja o guardado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import * as B from '../nucleo/banco.mjs';

test('ler, mexer no objeto lido, gravar e ler de novo', async (t) => {
  const { id: conta } = await B.criarConta({ email: `melhorias-${randomUUID()}@teste.local`, senha: 'x' });
  t.after(() => {
    B.db.prepare('DELETE FROM melhorias_da_conta WHERE conta = ?').run(conta);
    B.db.prepare('DELETE FROM contas WHERE id = ?').run(conta);
  });

  assert.deepEqual(B.lerMelhoriasDaConta(conta), {});
  const lida = B.lerMelhoriasDaConta(conta);
  lida.slotsDeParty = 3; // mexeu e NÃO gravou (ex.: compra que falhou)
  assert.deepEqual(B.lerMelhoriasDaConta(conta), {});

  B.gravarMelhoriasDaConta(conta, { slotsDeParty: 1 });
  assert.deepEqual(B.lerMelhoriasDaConta(conta), { slotsDeParty: 1 });
  // O banco tem o mesmo que a memória.
  const noBanco = B.db.prepare('SELECT dados FROM melhorias_da_conta WHERE conta = ?').get(conta);
  assert.deepEqual(JSON.parse(noBanco.dados), { slotsDeParty: 1 });
});

test('a segunda leitura não consulta o banco', () => {
  const conta = `teste-${randomUUID()}`;
  B.lerMelhoriasDaConta(conta);
  const prepare = B.db.prepare;
  let consultas = 0;
  B.db.prepare = (...a) => (consultas++, prepare.apply(B.db, a));
  try {
    for (let i = 0; i < 100; i++) B.lerMelhoriasDaConta(conta);
  } finally {
    B.db.prepare = prepare;
  }
  assert.equal(consultas, 0);
});
