// O arquivo de teste que importa isto como PRIMEIRO import ganha um SQLite NOVO, numa pasta temporária só dele (apagada no fim do
// processo): para testes que contam linhas da tabela `personagens` (o ranking, as ferramentas de admin) sem ver os personagens que os
// outros arquivos, rodando em paralelo, põem no banco de sempre. Tem de vir antes de qualquer módulo do jogo (o banco abre o arquivo
// quando carrega). Produção é Postgres (`DATABASE_URL`) e nem lê `DRAEVOR_SQLITE`.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const PASTA = mkdtempSync(join(tmpdir(), 'draevor-teste-'));
process.env.DRAEVOR_SQLITE = join(PASTA, 'jogo.db');
process.on('exit', () => {
  try {
    rmSync(PASTA, { recursive: true, force: true });
  } catch {
    // (a pasta temporária fica para o sistema limpar)
  }
});
