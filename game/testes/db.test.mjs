// Fase 6: `game/database/db.mjs` — a mesma API (get/all/run/exec/transacao) nos dois
// bancos. O de Postgres só roda se houver `DATABASE_URL_TESTE` no ambiente
// (não trava o `npm test` de quem não tem Postgres rodando — ver README de
// deploy); o de SQLite roda sempre, num arquivo temporário próprio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as Db from '../database/db.mjs';

async function schema(db) {
  if (db.dialeto === 'postgres') {
    await db.exec('DROP TABLE IF EXISTS teste_db');
    await db.exec('CREATE TABLE teste_db (id SERIAL PRIMARY KEY, nome TEXT NOT NULL, valor INTEGER NOT NULL)');
  } else {
    await db.exec('CREATE TABLE IF NOT EXISTS teste_db (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, valor INTEGER NOT NULL)');
  }
}

/** Os mesmos testes, rodados uma vez por banco disponível. */
async function testesComuns(nome, abrirDb) {
  test(`[${nome}] get/all/run fazem o CRUD básico`, async () => {
    const db = await abrirDb();
    await schema(db);
    const inserir = db.prepare('INSERT INTO teste_db (nome, valor) VALUES (?, ?)' + (db.dialeto === 'postgres' ? ' RETURNING id' : ''));
    const r1 = await inserir.run('a', 1);
    await inserir.run('b', 2);
    assert.ok(r1.changes >= 1);

    const um = await db.prepare('SELECT * FROM teste_db WHERE nome = ?').get('a');
    assert.equal(um.valor, 1);

    const todos = await db.prepare('SELECT * FROM teste_db ORDER BY nome').all();
    assert.deepEqual(todos.map((l) => l.nome), ['a', 'b']);

    await db.prepare('UPDATE teste_db SET valor = ? WHERE nome = ?').run(99, 'a');
    assert.equal((await db.prepare('SELECT valor FROM teste_db WHERE nome = ?').get('a')).valor, 99);

    await db.prepare('DELETE FROM teste_db WHERE nome = ?').run('b');
    assert.equal((await db.prepare('SELECT * FROM teste_db').all()).length, 1);
    await db.fechar?.();
  });

  test(`[${nome}] transacao: commit grava, erro faz rollback`, async () => {
    const db = await abrirDb();
    await schema(db);
    await db.transacao(async () => {
      await db.prepare('INSERT INTO teste_db (nome, valor) VALUES (?, ?)').run('commitado', 1);
    });
    assert.ok(await db.prepare('SELECT * FROM teste_db WHERE nome = ?').get('commitado'));

    await assert.rejects(
      db.transacao(async () => {
        await db.prepare('INSERT INTO teste_db (nome, valor) VALUES (?, ?)').run('nao-vai-ficar', 1);
        throw new Error('falha de propósito');
      }),
    );
    assert.equal(await db.prepare('SELECT * FROM teste_db WHERE nome = ?').get('nao-vai-ficar'), undefined);
    await db.fechar?.();
  });
}

const dirSQLite = mkdtempSync(join(tmpdir(), 'db-teste-'));
process.env.DATABASE_URL = ''; // garante que este bloco pega o SQLite, mesmo se outro teste mexeu no env
await testesComuns('sqlite', async () => {
  const original = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const db = await Db.abrir(join(dirSQLite, `${Math.random()}.db`));
  if (original) process.env.DATABASE_URL = original;
  return db;
});

const urlPostgres = process.env.DATABASE_URL_TESTE;
if (urlPostgres) {
  await testesComuns('postgres', async () => {
    const original = process.env.DATABASE_URL;
    process.env.DATABASE_URL = urlPostgres;
    const db = await Db.abrir();
    if (original) process.env.DATABASE_URL = original;
    else delete process.env.DATABASE_URL;
    return db;
  });
} else {
  test('[postgres] pulado — sem DATABASE_URL_TESTE no ambiente', { skip: true }, () => {});
}

process.on('exit', () => {
  try {
    rmSync(dirSQLite, { recursive: true, force: true });
  } catch {}
});
