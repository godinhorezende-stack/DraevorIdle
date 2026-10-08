// O arquivo de teste de CARGA que importa isto como PRIMEIRO import ganha um SQLite só dele (um por modo). Os arquivos de teste rodam em
// paralelo no mesmo banco: o server-save P1 põe 1.500 ausentes nele de uma vez, e a rodada da consolidação (consolidacao-offline, que pega
// os 40 mais antigos — `POR_RODADA`) deixava de alcançar o personagem do próprio teste. Tem de vir antes de qualquer módulo do jogo
// (o banco abre o arquivo quando carrega). Produção é Postgres (`DATABASE_URL`) e nem lê `DRAEVOR_SQLITE`.
import { fileURLToPath } from 'node:url';

const modo = process.env.DRAEVOR_CLASSICO === '1' ? '-classico' : '';
process.env.DRAEVOR_SQLITE = fileURLToPath(new URL(`../database/dados/jogo-testes-carga${modo}.db`, import.meta.url));
