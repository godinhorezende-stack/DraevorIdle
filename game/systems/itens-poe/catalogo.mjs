// O CATÁLOGO de itens no modelo do PoE: o arquivo gerado por tools/importar-poe-itens.mjs + as regras, ambos no repositório.
//
// ---- O jogo OFICIAL é o do PoE (dono, 07/10: "migração do Draevor para o PoE oficial — migrar a arquitetura, não trocar uma variável") ----
// `ligado()` é a ÚNICA porta do modo: todo o jogo pergunta a ela. O padrão agora é o PoE — sem variável nenhuma. O Draevor clássico só
// existe durante a TRANSIÇÃO, para o código e os testes do legado ainda não migrados: `DRAEVOR_CLASSICO=1` (ver docs/migracao-poe-oficial.md).
// Os dados que o JOGO usa ficam no repositório, em `gamedata/itens-poe/` (dono, 08/10: o catálogo, as imagens dele, as gemas, os
// suportes e os ícones — a produção recebe pelo git): sem o catálogo o jogo oficial não sobe (`dadosAusentes`, conferido no boot). A
// coleção do dono (`<REFERENCIAS_POE>`, padrão /home/deploy/referencias-poe) fica fora: é a fonte dos tools e de telas da Engine local
// (`PASTA_ORIGINAL`). `ITENS_POE` não é mais lida.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ARQUIVO = fileURLToPath(new URL('../../gamedata/itens-poe/catalogo-itens.json', import.meta.url));
/** As imagens das peças que o catálogo referencia (o mesmo caminho relativo de `original/` da coleção). */
export const PASTA_DAS_IMAGENS = fileURLToPath(new URL('../../gamedata/itens-poe/icones-itens', import.meta.url));
/** A coleção inteira do dono, fora do repositório: só para a Engine local (as imagens de referência) e os tools. */
export const PASTA_ORIGINAL = join(process.env.REFERENCIAS_POE ?? '/home/deploy/referencias-poe', 'original');
export const REGRAS = JSON.parse(readFileSync(new URL('../../gamedata/itens-poe/regras.json', import.meta.url), 'utf8'));

/** Os dados do PoE estão presentes? (conferido UMA vez: `ligado()` é chamada no caminho quente do combate.) */
const TEM_DADOS = existsSync(ARQUIVO);
/** O processo está no Draevor CLÁSSICO (só a transição: o legado ainda não migrado e os testes dele)? */
export const classico = () => process.env.DRAEVOR_CLASSICO === '1';
/** O jogo do PoE está ligado neste processo? (o oficial: sempre, salvo o clássico da transição — e com os dados presentes) */
export const ligado = () => !classico() && TEM_DADOS;
/** O jogo oficial precisa dos dados do PoE: o que falta (para o boot parar com a mensagem), ou null. */
export const dadosAusentes = () => (classico() || TEM_DADOS ? null : `o catálogo do PoE não está em ${ARQUIVO} (ele é do repositório: confira o checkout, ou gere com node tools/importar-poe-itens.mjs)`);

let cache = null;
/** O catálogo importado (lido uma vez), ou null quando desligado. */
export function catalogo() {
  if (!ligado()) return null;
  cache ??= JSON.parse(readFileSync(ARQUIVO, 'utf8'));
  return cache;
}
// ---- Os POOLS ESPECIAIS do PoE (influências, corrompido, bancada do mestre, essência, fósseis, velado, eldritch, síntese,
// encantamento…): `gamedata/itens-poe/pools/<pool>.json` (tools/importar-poe-itens.mjs). Ficam FORA do drop comum — na campanha do PoE o
// item cai só com o pool normal — e cada um entra pelo sistema dele (orbe Vaal, essência, fóssil, orbe de influência…). Lidos sob demanda.
const PASTA_DOS_POOLS = fileURLToPath(new URL('../../gamedata/itens-poe/pools', import.meta.url));
const POOLS_LIDOS = new Map();
/** Os nomes dos pools especiais que existem no repositório. */
export const poolsEspeciais = () => (existsSync(PASTA_DOS_POOLS) ? readdirSync(PASTA_DOS_POOLS).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort() : []);
/** Um pool especial inteiro (`{ pool, nome, familias, tiers, classes }`), ou null. Só nome de pool (letras e `_`): nada de caminho. */
export function poolEspecial(nome) {
  if (!/^[a-z_]+$/.test(String(nome ?? ''))) return null;
  if (!POOLS_LIDOS.has(nome)) {
    const arq = join(PASTA_DOS_POOLS, `${nome}.json`);
    POOLS_LIDOS.set(nome, existsSync(arq) ? JSON.parse(readFileSync(arq, 'utf8')) : null);
  }
  return POOLS_LIDOS.get(nome);
}
/** O pool especial de uma página do catálogo (`classe` e o `pool` da base, ex.: `Body_Armours`, `str`): `{ prefixos, sufixos, implicitos }` ou null. */
export const poolEspecialDa = (nome, classe, pagina) => poolEspecial(nome)?.classes?.[classe]?.[pagina] ?? null;

/** Esquece o catálogo lido (depois de reimportar). */
export const recarregar = () => {
  cache = null;
  return catalogo();
};
