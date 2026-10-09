// As TABELAS POR NÍVEL das gemas e dos suportes do PoE pelo poedb (dono, 09/10: "ao entrar em cada gema verifique tudo — o level effect"):
// o "Level Effect" de cada página de gema do poedb, em `gamedata/itens-poe/gemas-niveis-poedb.json` (tools/importar-poedb-gemas.mjs). A
// coleção antiga (`gemas-poe.json`, `suportes-poe.json`) deixava 278 gemas SEM a coluna de Experiência (221 transfiguradas: a gema não
// subia de nível), sem os requisitos de atributo e sem colunas de dano (o "Causa 21 a 31 de Dano Físico" da Absolvição). Quem carrega as
// gemas troca a tabela pela do poedb quando ela existe — num arquivo à parte, para o importador antigo não apagar e este não apagar o dele.
import { readFileSync, existsSync } from 'node:fs';

const ARQUIVO = new URL('../../gamedata/itens-poe/gemas-niveis-poedb.json', import.meta.url);
let NIVEIS = null;
/** `{ slug: { colunas, linhas } }` (vazio sem o arquivo). */
export const niveisDoPoedb = () => (NIVEIS ??= existsSync(ARQUIVO) ? JSON.parse(readFileSync(ARQUIVO, 'utf8')).niveis ?? {} : {});
/** A lista de gemas (ou suportes) com a tabela do poedb no lugar da antiga, quando há. Devolve a mesma lista (as gemas trocadas, novas). */
export function comNiveisDoPoedb(lista) {
  const n = niveisDoPoedb();
  return lista.map((g) => (n[g.slug]?.linhas?.length ? { ...g, colunas: n[g.slug].colunas, linhas: n[g.slug].linhas, niveisDoPoedb: true } : g));
}
