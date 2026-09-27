#!/usr/bin/env node
// Copia os dados de um `jogo.db` (SQLite) para o Postgres de destino —
// usado uma vez, na virada de dev/staging (SQLite) para produção (Postgres),
// ou para trazer um dump de produção para uma cópia local de teste.
//
// Uso:
//   DATABASE_URL="postgres://usuario:senha@host:5432/jogo" \
//     node game/database/migrar-sqlite-para-postgres.mjs [caminho/para/jogo.db]
//
// O caminho do SQLite de origem é opcional — o padrão é `dados/jogo.db`
// (o mesmo arquivo que o servidor usa em modo SQLite). O `DATABASE_URL` é
// obrigatório: sem ele o script recusa rodar, para nunca escrever por engano
// dentro do próprio SQLite de origem.
//
// Como funciona: o schema é criado importando os módulos do jogo (o mesmo
// código que cria as tabelas quando o servidor sobe) com `DATABASE_URL` já
// apontando para o destino — nenhuma tabela é redeclarada aqui. Depois, para
// cada tabela (na ordem que respeita as referências entre elas — conta antes
// de personagem, por exemplo), lê todas as linhas do SQLite de origem e
// insere no Postgres pelo mesmo `game/database/db.mjs` (`?` → `$1, $2...`
// automático). `ON CONFLICT DO NOTHING` faz rodar de novo (mesmo destino,
// mesma origem) não duplicar nada — mas NÃO é um merge: para uma migração de
// verdade, rode contra um Postgres vazio.
import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = dirname(fileURLToPath(import.meta.url));

const destino = process.env.DATABASE_URL;
if (!destino) {
  console.error('Faltou DATABASE_URL (o Postgres de destino). Ver o comentário no topo deste arquivo.');
  process.exit(1);
}

const origem = process.argv[2] ?? join(RAIZ, 'dados', 'jogo.db');
if (!existsSync(origem)) {
  console.error(`SQLite de origem não encontrado: ${origem}`);
  process.exit(1);
}

// Precisa vir ANTES de importar qualquer módulo do jogo: é na primeira
// importação de `game/database/banco.mjs` (deste processo) que `DATABASE_URL` é lido
// e o schema Postgres é criado.
console.log(`origem (SQLite):  ${origem}`);
console.log(`destino (Postgres): ${destino.replace(/:[^:@]+@/, ':***@')}`);

const sqlite = new DatabaseSync(origem, { readOnly: true });

// Só a criação do schema — cada import roda seu bloco `CREATE TABLE IF NOT
// EXISTS` contra o destino, na primeira vez que `banco.mjs` é aberto.
const { banco } = await import('./banco.mjs');
await import('../systems/amigos.mjs');
await import('../systems/arena.mjs');
await import('../systems/drops-do-site.mjs');
await import('../systems/guildas.mjs');
await import('../systems/mercado.mjs');

if (banco.dialeto !== 'postgres') {
  console.error('DATABASE_URL não resultou em modo Postgres — nada a migrar (ver db.mjs).');
  process.exit(1);
}

// Ordem que respeita as referências (`REFERENCES contas(id)` etc.) — uma
// conta antes de qualquer personagem/sessão dela, por exemplo.
const TABELAS = [
  { nome: 'contas' },
  { nome: 'personagens' },
  { nome: 'sessoes' },
  { nome: 'bau_da_conta' },
  { nome: 'melhorias_da_conta' },
  { nome: 'guildas', serial: true },
  { nome: 'guilda_membros' },
  { nome: 'guilda_convites' },
  { nome: 'guilda_pedidos' },
  { nome: 'guilda_diario' },
  { nome: 'amizades' },
  { nome: 'arena_historico' },
  { nome: 'arena_podio' },
  { nome: 'arena_semanas' },
  { nome: 'site_drops', serial: true },
  { nome: 'mercado_ofertas', serial: true },
  { nome: 'mercado_historico', serial: true },
  { nome: 'coin_ordens', serial: true },
  { nome: 'coin_historico', serial: true },
  { nome: 'creditos', serial: true },
];

/** As colunas de verdade da tabela, lidas do SQLite de origem — nunca digitadas à mão aqui. */
function colunasDe(tabela) {
  return sqlite.prepare(`PRAGMA table_info(${tabela})`).all().map((c) => c.name);
}

let totalLinhas = 0;
for (const { nome, serial } of TABELAS) {
  if (!sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?").get(nome)) {
    console.log(`  ${nome}: não existe na origem, pulando`);
    continue;
  }
  const colunas = colunasDe(nome);
  const linhas = sqlite.prepare(`SELECT * FROM ${nome}`).all();
  if (linhas.length === 0) {
    console.log(`  ${nome}: 0 linhas`);
    continue;
  }
  const inserir = banco.prepare(
    `INSERT INTO ${nome} (${colunas.join(', ')}) VALUES (${colunas.map(() => '?').join(', ')}) ON CONFLICT DO NOTHING`,
  );
  for (const linha of linhas) await inserir.run(...colunas.map((c) => linha[c]));
  // A sequência do SERIAL não sobe sozinha inserindo o `id` explícito — sem
  // isto, o próximo INSERT sem id (`fundar` de guilda, `anunciar` no mercado
  // etc.) tentaria reusar um id que acabou de vir da migração.
  if (serial) {
    await banco.exec(
      `SELECT setval(pg_get_serial_sequence('${nome}', 'id'), GREATEST((SELECT COALESCE(MAX(id), 1) FROM ${nome}), 1))`,
    );
  }
  console.log(`  ${nome}: ${linhas.length} linhas`);
  totalLinhas += linhas.length;
}

sqlite.close();
await banco.fechar();
console.log(`\nOK — ${totalLinhas} linhas migradas.`);
