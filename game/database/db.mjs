// Fase 6: a única fronteira entre "banco de dados" e o resto do jogo.
//
// Dois bancos possíveis, escolhidos por `DATABASE_URL`:
// - Sem ela (padrão — dev e os testes): SQLite, `node:sqlite`, nativo, nada
//   para instalar. O arquivo mora em `server/dados/jogo.db`.
// - Com ela (`DATABASE_URL=postgres://usuario:senha@host:5432/jogo`):
//   PostgreSQL, via `pg` — o banco de produção, pensado para várias conexões
//   ao mesmo tempo (o jogo e a simulação offline, e no futuro mais de um
//   processo — ver docs/auditoria-performance.md, Fase 6).
//
// A API é a MESMA dos dois lados — `prepare(sql).get/all/run(...params)`,
// `exec(sql)` e `transacao(fn)` — e sempre ASSÍNCRONA, mesmo no SQLite: essa
// é a ordem que o audit pede (API assíncrona primeiro, sobre o banco de
// sempre; o Postgres entra depois SEM trocar de novo o formato de chamada de
// quem usa).
//
// O texto do SQL usa `?` como placeholder nos dois — o backend Postgres troca
// por `$1, $2...` sozinho (`paraPostgres`, abaixo). Sintaxe de UM banco só
// (SQLite: `PRAGMA`, `INSERT OR REPLACE`, `json_extract`, `COLLATE NOCASE`;
// Postgres: `RETURNING id` para pegar o id de uma auto-incrementada) continua
// exigindo o `dialeto` (`'sqlite' | 'postgres'`) e um branch em quem chama.
//
// ---- Transação de verdade, com o banco assíncrono ----
//
// `emTransacao` (nucleo/sessao.mjs) garantia a atomicidade do mercado, banco,
// guilda e loja fazendo BEGIN → o comando INTEIRO síncrono → COMMIT: em JS
// síncrono, nada mais roda no meio, então a exclusão mútua vinha de graça.
// Com o banco assíncrono isso quebra — um `await` no meio abre uma janela
// onde OUTRA mensagem (de outra sessão, ou o próximo tique) pode mexer no
// mesmo ouro/item antes do COMMIT. `transacao(fn)` resolve a metade que é
// deste módulo: no Postgres, tira UMA conexão do pool (`pool.connect()`) e
// prende nela (`AsyncLocalStorage`) toda consulta feita enquanto `fn` roda —
// sem isso, duas queries da mesma transação podiam cair em conexões
// diferentes do pool e nunca formar uma transação de verdade. A OUTRA
// metade — impedir que DUAS transações rodem ao mesmo tempo — é a fila
// global em `sessao.mjs` (`emTransacao`); as duas juntas são a correção.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { AsyncLocalStorage } from 'node:async_hooks';

/** `?` posicional (o mesmo texto nos dois bancos) → `$1, $2, ...` do Postgres. */
export function paraPostgres(sql) {
  let n = 0;
  return sql.replace(/\?/g, () => `$${++n}`);
}

function abrirSQLite(caminho) {
  mkdirSync(caminho.slice(0, caminho.lastIndexOf('/')), { recursive: true });
  const db = new DatabaseSync(caminho);
  const api = {
    dialeto: 'sqlite',
    async exec(sql) {
      db.exec(sql);
    },
    prepare(sql) {
      const st = db.prepare(sql);
      return {
        async get(...params) {
          return st.get(...params);
        },
        async all(...params) {
          return st.all(...params);
        },
        async run(...params) {
          return st.run(...params);
        },
      };
    },
    // Uma única conexão (o arquivo é o mesmo para todo mundo): a transação só
    // precisa do BEGIN/COMMIT/ROLLBACK — não há "conexão errada" possível.
    async transacao(fn) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const r = await fn();
        db.exec('COMMIT');
        return r;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    /** Só para os poucos casos que precisam de SQL cru fora de `prepare` (ex.: `PRAGMA table_info`). */
    bruto: db,
    async fechar() {
      db.close();
    },
  };
  return api;
}

async function abrirPostgres(url) {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString: url });
  // Enquanto uma transação está aberta (`transacao`, abaixo), toda consulta
  // desta sessão assíncrona usa a MESMA conexão retirada do pool — é o que
  // faz BEGIN/as queries de dentro/COMMIT serem uma transação de verdade, e
  // não três comandos soltos em conexões diferentes.
  const conexaoDaTransacao = new AsyncLocalStorage();

  const executor = () => conexaoDaTransacao.getStore() ?? pool;

  const api = {
    dialeto: 'postgres',
    async exec(sql) {
      await executor().query(sql);
    },
    prepare(sql) {
      const traduzido = paraPostgres(sql);
      return {
        async get(...params) {
          const r = await executor().query(traduzido, params);
          return r.rows[0];
        },
        async all(...params) {
          const r = await executor().query(traduzido, params);
          return r.rows;
        },
        async run(...params) {
          const r = await executor().query(traduzido, params);
          // `lastInsertRowid` só existe de verdade se o SQL pediu `RETURNING id`
          // (ver `paraPostgres`/quem chama) — sem isso, Postgres não devolve nada sozinho.
          return { changes: r.rowCount, lastInsertRowid: r.rows[0]?.id };
        },
      };
    },
    async transacao(fn) {
      const client = await pool.connect();
      try {
        return await conexaoDaTransacao.run(client, async () => {
          await client.query('BEGIN');
          try {
            const r = await fn();
            await client.query('COMMIT');
            return r;
          } catch (e) {
            await client.query('ROLLBACK');
            throw e;
          }
        });
      } finally {
        client.release();
      }
    },
    async fechar() {
      await pool.end();
    },
  };
  return api;
}

/**
 * Abre o banco: `DATABASE_URL` no ambiente escolhe Postgres; sem ela, o
 * arquivo SQLite de sempre. `caminho` é só o caminho do arquivo SQLite
 * (ignorado quando há `DATABASE_URL`).
 */
export async function abrir(caminho) {
  const url = process.env.DATABASE_URL;
  return url ? abrirPostgres(url) : abrirSQLite(caminho);
}
