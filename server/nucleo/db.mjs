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
// A API é a MESMA dos dois lados — `prepare(sql).get/all/run(...params)` e
// `exec(sql)` — e sempre ASSÍNCRONA, mesmo no SQLite: essa é a ordem que o
// audit pede (API assíncrona primeiro, sobre o banco de sempre; o Postgres
// entra depois SEM trocar de novo o formato de chamada de quem usa).
//
// O texto do SQL usa `?` como placeholder nos dois — o backend Postgres troca
// por `$1, $2...` sozinho (`paraPostgres`, abaixo). Sintaxe de UM banco só
// (SQLite: `PRAGMA`, `INSERT OR REPLACE`, `json_extract`, `COLLATE NOCASE`;
// Postgres: `RETURNING id` para pegar o id de uma auto-incrementada) continua
// exigindo o `dialeto` (`'sqlite' | 'postgres'`) e um branch em quem chama —
// a tabela `Db.dialeto === 'postgres' ? ... : ...` de cada módulo.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';

/** `?` posicional (o mesmo texto nos dois bancos) → `$1, $2, ...` do Postgres. */
export function paraPostgres(sql) {
  let n = 0;
  return sql.replace(/\?/g, () => `$${++n}`);
}

function abrirSQLite(caminho) {
  mkdirSync(caminho.slice(0, caminho.lastIndexOf('/')), { recursive: true });
  const db = new DatabaseSync(caminho);
  return {
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
    /** Só para os poucos casos que precisam de SQL cru fora de `prepare` (ex.: `PRAGMA table_info`). */
    bruto: db,
    async fechar() {
      db.close();
    },
  };
}

function abrirPostgres(url) {
  // Import só quando precisa: `pg` não entra no caminho do dev/teste comum (SQLite).
  let Pool;
  return import('pg').then(({ default: pg }) => {
    Pool = pg.Pool;
    const pool = new Pool({ connectionString: url });
    return {
      dialeto: 'postgres',
      async exec(sql) {
        await pool.query(sql);
      },
      prepare(sql) {
        const traduzido = paraPostgres(sql);
        return {
          async get(...params) {
            const r = await pool.query(traduzido, params);
            return r.rows[0];
          },
          async all(...params) {
            const r = await pool.query(traduzido, params);
            return r.rows;
          },
          async run(...params) {
            const r = await pool.query(traduzido, params);
            // `lastInsertRowid` só existe de verdade se o SQL pediu `RETURNING id`
            // (ver `paraPostgres`/quem chama) — sem isso, Postgres não devolve nada sozinho.
            return { changes: r.rowCount, lastInsertRowid: r.rows[0]?.id };
          },
        };
      },
      async fechar() {
        await pool.end();
      },
    };
  });
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
