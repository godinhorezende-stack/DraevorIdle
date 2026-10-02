// ONDE moram os encontros de cada fase: `gamedata/encontros/<huntId>.json` (`{ "encontros": [...] }`).
//
// Antes viviam no bloco `encontros` do arquivo do mapa (`gamedata/hunts/<id>-map.json`). Dois problemas: o arquivo do mapa
// tem ~1 MB numa linha só (qualquer edição vira um diff gigante) e, em produção, `gamedata/hunts` é SOBREPOSTO por
// `data/mapas` (mapa novo só vale se for copiado à mão). Os encontros são conteúdo do jogo, não do mapa: ficam num arquivo
// próprio, que viaja com o código no deploy.
//
// Compatibilidade: sem arquivo próprio, vale o bloco `encontros` do mapa (formato antigo). Com arquivo (mesmo vazio),
// o arquivo manda.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const PASTA = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'gamedata', 'encontros');
const cache = new Map();

export const caminhoDos = (huntId, pasta = PASTA) => join(pasta, `${huntId}.json`);

/** A lista bruta de encontros do arquivo próprio, ou `null` se a fase não tem arquivo. */
export function doArquivo(huntId, pasta = PASTA) {
  if (pasta === PASTA && cache.has(huntId)) return cache.get(huntId);
  const caminho = caminhoDos(huntId, pasta);
  const lista = existsSync(caminho) ? JSON.parse(readFileSync(caminho, 'utf8')).encontros ?? [] : null;
  if (pasta === PASTA) cache.set(huntId, lista);
  return lista;
}

/** Os encontros BRUTOS de uma fase: o arquivo próprio, ou o bloco do mapa (formato antigo). */
export const brutosDaFase = (huntId, mapa = null, pasta = PASTA) => doArquivo(huntId, pasta) ?? (Array.isArray(mapa?.encontros) ? mapa.encontros : []);

/** Só os testes: define os encontros de uma fase na memória (devolve a função que restaura). */
export function _definirParaTestes(huntId, lista) {
  const tinha = cache.has(huntId);
  const antes = cache.get(huntId);
  cache.set(huntId, lista);
  return () => (tinha ? cache.set(huntId, antes) : cache.delete(huntId));
}

/** Só os testes: limpa o cache (o arquivo mudou no disco). */
export const esquecerCache = () => cache.clear();
