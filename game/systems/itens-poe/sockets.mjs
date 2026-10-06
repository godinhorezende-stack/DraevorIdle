// Os SOCKETS das peças do PoE (regra do dono, 05/10 — `itens-poe/regras.json` → `sockets`): o máximo pela classe da peça e pelo item level,
// e o sorteio da peça que cai (totalmente aleatório: de 0 ao máximo, links ao acaso entre vizinhos). Fica num módulo leve porque o sistema
// de gemas (`skills/gemas.mjs`) o consulta para toda peça do PoE.
import { REGRAS, ligado } from './catalogo.mjs';

/** O sistema do PoE está ligado? (atalho para quem já importa este módulo leve) */
export const poeLigado = () => ligado();

const S = () => REGRAS.sockets ?? {};

/** A classe do PoE de uma peça do jogo (`peca.poe.classe`) ou do item do catálogo (`meta.poe.base`: 'Classe/Slug'). */
export const classeDe = (meta, peca = null) => peca?.poe?.classe ?? peca?.poe?.base?.split('/')[0] ?? meta?.poe?.classe ?? meta?.poe?.base?.split('/')[0] ?? null;

/** Quantos sockets o item level permite (`porItemLevel`). Sem item level: o máximo da tabela. */
export function maximoPeloItemLevel(ilvl) {
  const t = S().porItemLevel ?? [];
  if (ilvl == null) return t.at(-1)?.[1] ?? 0;
  let max = 0;
  for (const [nivel, n] of t) if (Number(ilvl) >= nivel) max = Math.max(max, n);
  return max;
}

/** O máximo de sockets de uma peça do PoE: o da classe, limitado pelo item level. */
export const maximo = (classe, ilvl = null) => Math.min(Number(S().porClasse?.[classe]) || 0, maximoPeloItemLevel(ilvl));

/** Os sockets de uma peça do PoE que cai: `{ abertos, links, gemas, cores }` (o formato das gemas), ou null se a classe não tem. */
export function sortear(classe, ilvl, rng = Math.random, requisitos = null) {
  const max = maximo(classe, ilvl);
  if (!max) return null;
  const abertos = Math.floor(rng() * (max + 1));
  const chance = Number(S().chanceDeLink ?? 0.5);
  const links = Array.from({ length: max - 1 }, (_, i) => i + 1 < abertos && rng() < chance);
  return { abertos, links, gemas: Array(max).fill(null), cores: sortearCores(max, requisitos, rng) };
}

/*
 * ---- As CORES dos sockets (dono, 06/10: "como no PoE" — poedb Item_socket) ----
 * R (vermelho, Força), G (verde, Destreza), B (azul, Inteligência) e W (branco: aceita qualquer gema). A cor sai sorteada com o PESO do
 * requisito de atributo da peça: `requisito + constante` (a constante vale para todas as cores — a peça de Destreza pura ainda tira
 * vermelho e azul de vez em quando; sem requisito, as três iguais). É a aproximação das calculadoras da comunidade (o PoE não publica
 * a conta); `sockets.cores.constante` em `itens-poe/regras.json`. A GEMA só entra no socket da cor dela; gema branca e socket branco
 * aceitam qualquer uma.
 */
export const COR_DA_GEMA = { vermelha: 'R', verde: 'G', azul: 'B', branca: 'W' };
export const NOME_DA_COR = { R: 'vermelho', G: 'verde', B: 'azul', W: 'branco' };
/** A cor de uma gema (pela `cor` do PoE); a gema sem cor (as do Draevor) vale como branca. */
export const corDaGema = (cor) => COR_DA_GEMA[cor] ?? 'W';
/** A gema de cor `gema` cabe no socket de cor `socket`? */
export const cabe = (socket, gema) => !socket || socket === 'W' || gema === 'W' || socket === gema;
/** Os pesos de cada cor pelos requisitos `{ str, dex, int }` da peça. */
export function pesosDeCor(requisitos = null) {
  const x = Number(S().cores?.constante ?? 12);
  const r = requisitos ?? {};
  return { R: (Number(r.str) || 0) + x, G: (Number(r.dex) || 0) + x, B: (Number(r.int) || 0) + x };
}
export function sortearCor(requisitos = null, rng = Math.random) {
  const pesos = Object.entries(pesosDeCor(requisitos));
  let v = rng() * pesos.reduce((t, [, p]) => t + p, 0);
  for (const [cor, p] of pesos) if ((v -= p) < 0) return cor;
  return pesos.at(-1)[0];
}
export const sortearCores = (n, requisitos = null, rng = Math.random) => Array.from({ length: n }, () => sortearCor(requisitos, rng));
/** Um sorteio FIXO (o mesmo número sempre) a partir de um texto: as cores das peças que ainda não tinham (sem gravar, a tela e o servidor concordam). */
export function sorteioFixo(texto) {
  let h = 2166136261;
  for (const c of String(texto)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

/*
 * ---- Os ORBES do PoE (dono, 06/10: "os do PoE no lugar" dos orbes do Draevor) ----
 * Joalheiro: sorteia de novo o NÚMERO de sockets (sempre outro número; não usa na peça no máximo). Fusão: sorteia de novo os LINKS (não
 * usa na peça toda ligada). Cromático: sorteia de novo as CORES (sempre outra combinação). As chances não são públicas: os pesos seguem
 * o custo da bancada do PoE (`sockets.orbes` em `itens-poe/regras.json`: 6 sockets ~1 em 350 Joalheiros, 6 links ~1 em 1.500 Fusões).
 */
export const orbes = () => S().orbes ?? {};
/** O novo número de sockets do Joalheiro: diferente de `atual`, até `max`; null se não há outro. */
export function sortearNumero(atual, max, rng = Math.random) {
  const pesos = Object.entries(orbes().joalheiro?.pesoPorNumero ?? {}).map(([n, p]) => [Number(n), Number(p)]).filter(([n, p]) => n >= 1 && n <= max && n !== atual && p > 0);
  if (!pesos.length) return null;
  let v = rng() * pesos.reduce((t, [, p]) => t + p, 0);
  for (const [n, p] of pesos) if ((v -= p) < 0) return n;
  return pesos.at(-1)[0];
}
/** Os novos links da Fusão nos `abertos` sockets (de `max`): todos ligados com a chance do número de sockets; senão, ao acaso (sem ligar todos). */
export function sortearLinks(abertos, max, rng = Math.random) {
  const tudo = Array.from({ length: max - 1 }, (_, i) => i + 1 < abertos);
  if (abertos < 2) return tudo.map(() => false);
  if (rng() < Number(orbes().fusao?.chanceDeLigarTodos?.[abertos] ?? 0)) return tudo;
  const chance = Number(S().chanceDeLink ?? 0.5);
  for (let tentativa = 0; tentativa < 20; tentativa++) {
    const links = tudo.map((pode) => pode && rng() < chance);
    if (links.filter(Boolean).length < abertos - 1) return links;
  }
  return tudo.map((pode, i) => pode && i > 0);
}
/** As novas cores do Cromático nos `abertos` sockets: outra combinação (até 50 tentativas). */
export function sortearOutrasCores(cores, abertos, requisitos = null, rng = Math.random) {
  const antes = cores.slice(0, abertos).join('');
  let novas = cores;
  for (let t = 0; t < 50; t++) {
    novas = [...sortearCores(abertos, requisitos, rng), ...cores.slice(abertos)];
    if (novas.slice(0, abertos).join('') !== antes) return novas;
  }
  return novas;
}
