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
// (09/10) As ABAS do poedb (tools/importar-poedb-abas.mjs): os pools novos (Labirinto, Golpe, Ungir, Crucible…) e os COMPLEMENTOS dos que
// já existem (o que o poedb tem e a coleção antiga não: o corrompido das Espadas de Duas Mãos, o "+1 ao Mínimo de Cargas de Poder"…).
// Numa pasta à parte (o importador antigo refaz `pools/` inteira); `poolEspecial` junta os dois.
const PASTA_DO_POEDB = fileURLToPath(new URL('../../gamedata/itens-poe/pools-poedb', import.meta.url));
const POOLS_LIDOS = new Map();
const nomesEm = (pasta) => (existsSync(pasta) ? readdirSync(pasta).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)) : []);
/** Os nomes dos pools especiais da coleção (`pools/`, um arquivo por pool). */
export const poolsEspeciais = () => nomesEm(PASTA_DOS_POOLS).sort();
/** Os nomes dos pools das ABAS do poedb (`pools-poedb/`: os novos e os complementos dos da coleção). */
export const poolsDoPoedb = () => nomesEm(PASTA_DO_POEDB).sort();
const lerSeHouver = (arq) => (existsSync(arq) ? JSON.parse(readFileSync(arq, 'utf8')) : null);
/**
 * Junta o complemento do poedb ao pool da coleção: página que não existe entra inteira; na que existe, entram as famílias que ela não
 * tem (pelo id da família). Não muda nada do que já estava (os mods que as peças guardam continuam achando o tier delas).
 */
export function juntarPools(base, extra) {
  if (!base) return extra;
  if (!extra) return base;
  const classes = structuredClone(base.classes ?? {});
  let familias = base.familias ?? 0;
  let tiers = base.tiers ?? 0;
  for (const [classe, paginas] of Object.entries(extra.classes ?? {})) {
    for (const [pagina, pg] of Object.entries(paginas)) {
      const alvo = ((classes[classe] ??= {})[pagina] ??= { prefixos: [], sufixos: [], implicitos: [] });
      for (const lado of ['prefixos', 'sufixos', 'implicitos']) {
        const ja = new Set((alvo[lado] ??= []).map((f) => f.familia));
        for (const f of pg[lado] ?? []) {
          if (ja.has(f.familia)) continue;
          alvo[lado].push(f);
          familias++;
          tiers += f.tiers.length;
        }
      }
    }
  }
  return { ...base, familias, tiers, classes, complementadoPor: extra._nota ?? 'poedb' };
}
/** Um pool especial inteiro (`{ pool, nome, familias, tiers, classes }`), ou null. Só nome de pool (letras e `_`): nada de caminho. */
export function poolEspecial(nome) {
  if (!/^[a-z_]+$/.test(String(nome ?? ''))) return null;
  if (!POOLS_LIDOS.has(nome)) POOLS_LIDOS.set(nome, juntarPools(lerSeHouver(join(PASTA_DOS_POOLS, `${nome}.json`)), lerSeHouver(join(PASTA_DO_POEDB, `${nome}.json`))));
  return POOLS_LIDOS.get(nome);
}
/**
 * O pool especial de uma página do catálogo (`classe` e o `pool` da base, ex.: `Body_Armours`, `str`): `{ prefixos, sufixos, implicitos }`
 * ou null. Um pool igual para todas as variantes da classe (os encantamentos do Labirinto valem para qualquer elmo) fica uma vez só, em `*`.
 */
export const poolEspecialDa = (nome, classe, pagina) => {
  const c = poolEspecial(nome)?.classes?.[classe];
  return c?.[pagina] ?? c?.['*'] ?? null;
};

/** Esquece o catálogo lido (depois de reimportar). */
export const recarregar = () => {
  cache = null;
  return catalogo();
};
