// Este arquivo de teste é do DRAEVOR CLÁSSICO: ele testa uma regra que o jogo oficial (PoE) não tem — a categoria B da matriz de migração
// (docs/migracao-poe-matriz.md). Ele roda com `DRAEVOR_CLASSICO=1` dentro da suíte de sempre, para o clássico continuar protegido
// enquanto ele existir (a transição); quando o modo clássico for aposentado, o arquivo sai junto com o código que ele testa.
//
// Tem de ser o PRIMEIRO import do arquivo de teste: as constantes de carga dos módulos (a barra, os slots, a campanha...) leem o modo
// quando o módulo carrega.
import { fileURLToPath } from 'node:url';

process.env.DRAEVOR_CLASSICO = '1';
// O banco SQLite de teste do clássico é OUTRO arquivo: o irmão `<x>.classico.test.mjs` roda junto com o `<x>.test.mjs` (a suíte roda os
// arquivos em paralelo), e no mesmo arquivo os dois disputariam as mesmas linhas (server-save: "database is locked").
process.env.DRAEVOR_SQLITE ??= fileURLToPath(new URL('../database/dados/jogo-testes-classico.db', import.meta.url));
