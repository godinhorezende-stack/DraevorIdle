// A aba ABAS DO POEDB da engine (dono, 09/10: "quem tem cada um várias abas, entre em cada aba para extrair as coisas que faltam"): para
// cada página de classe do poedb, cada aba dela (Orbe Vaal, Síntese, Labirinto, Golpe, Mesa de Criação, Ungir, Exarca/Devorador…) com
// quantos itens o poedb tem, quantos o jogo tem, o que faltava e foi importado, e — para os pools — SE o jogo alcança (qual sistema
// põe aquele pool numa peça) e o EFEITO dos mods dele naquela classe (a mesma conta da aba Pendências).
// O manifesto é do tools/importar-poedb-abas.mjs (`gamedata/itens-poe/poedb-abas.json`); só leitura.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as Pendencias from './itens-poe-pendencias.mjs';

export const ARQUIVO = fileURLToPath(new URL('../gamedata/itens-poe/poedb-abas.json', import.meta.url));

/** Por onde cada pool entra numa peça do jogo (null: nenhum sistema ainda — o pool fica só de referência). */
export const ALCANCE = Object.freeze({
  corrupted: 'Orbe Vaal (o implícito corrompido)',
  searing: 'Brasas Ancestrais e Orbe do Conflito',
  eater: 'Icores Ancestrais e Orbe do Conflito',
  synthesis: null,
  synthesis_corrupted: null,
  master: null,
  labirinto: null,
  golpe: null,
  orbe_incandescente: null,
  orbe_instigante: null,
  ungir: null,
  vislumbre_do_caos: null,
  tintura: null,
  semente_harvest: null,
  crucible: null,
});
/** O pool → a origem dele na aba Pendências (os que o jogo alcança têm o grupo da moeda; os de referência, o próprio nome). */
const ORIGEM_DO_POOL = { ...Pendencias.POOLS_DO_JOGO, ...Object.fromEntries(Object.keys(Pendencias.POOLS_DE_REFERENCIA).map((k) => [k, k])) };

let CACHE = null;
/** `{ geradoEm, fonte, paginas: [{ pagina, fonte, classe, variante, abas: [{ ..., alcance, efeito }] }], resumo }`, ou null sem o manifesto. */
export function abas() {
  if (CACHE) return CACHE;
  if (!existsSync(ARQUIVO)) return null;
  const m = JSON.parse(readFileSync(ARQUIVO, 'utf8'));
  // O efeito por origem e classe: { "corrompido|Gloves": { funciona: n, pendente: n, … } }.
  const efeito = new Map();
  for (const l of Pendencias.pendencias().linhas) {
    for (const c of l.classes) {
      const k = `${l.origem}|${c}`;
      const r = efeito.get(k) ?? {};
      r[l.estado] = (r[l.estado] ?? 0) + 1;
      efeito.set(k, r);
    }
  }
  const resumo = { porEstado: {}, pools: {} };
  for (const p of m.paginas) {
    for (const a of p.abas) {
      resumo.porEstado[a.estado] = (resumo.porEstado[a.estado] ?? 0) + 1;
      if (!a.pool) continue;
      a.alcance = ALCANCE[a.pool] ?? null;
      const origem = ORIGEM_DO_POOL[a.pool];
      a.efeito = origem ? (efeito.get(`${origem}|${p.classe}`) ?? null) : null;
      const r = (resumo.pools[a.pool] ??= { abas: 0, poedb: 0, importados: 0, alcance: a.alcance, efeito: null });
      r.abas++;
      r.poedb += a.poedb;
      r.importados += a.importados ?? 0;
    }
  }
  const pend = Pendencias.pendencias().resumo;
  for (const [pool, r] of Object.entries(resumo.pools)) r.efeito = pend[ORIGEM_DO_POOL[pool]] ?? null;
  CACHE = { ...m, resumo };
  return CACHE;
}
/** Esquece a conta (junto com a das Pendências). */
export const esquecer = () => { CACHE = null; };
