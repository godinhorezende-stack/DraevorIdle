// O CATÁLOGO de itens no modelo do PoE (Fase 1): o arquivo importado por tools/importar-poe-itens.mjs + as regras do repositório.
//
// DESLIGADO por padrão: só carrega com `ITENS_POE=1` E com o catálogo importado presente em `<REFERENCIAS_POE>/importado/` — a coleção
// do PoE fica fora do repositório e não é montada no container de produção, então lá ele nunca liga (decisão do dono de 04/10:
// testar no jogo local antes de qualquer troca). Nada do jogo atual depende deste módulo.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = process.env.REFERENCIAS_POE ?? '/home/deploy/referencias-poe';
export const ARQUIVO = join(RAIZ, 'importado', 'itens-poe.json');
export const PASTA_ORIGINAL = join(RAIZ, 'original');
export const REGRAS = JSON.parse(readFileSync(new URL('../../gamedata/itens-poe/regras.json', import.meta.url), 'utf8'));

/** O sistema está ligado neste processo? (a chave E o catálogo importado) */
export const ligado = () => process.env.ITENS_POE === '1' && existsSync(ARQUIVO);

let cache = null;
/** O catálogo importado (lido uma vez), ou null quando desligado. */
export function catalogo() {
  if (!ligado()) return null;
  cache ??= JSON.parse(readFileSync(ARQUIVO, 'utf8'));
  return cache;
}
/** Esquece o catálogo lido (depois de reimportar). */
export const recarregar = () => {
  cache = null;
  return catalogo();
};
