// As JOIAS ATEMPORAIS do PoE (lote 48 — dono, 16/10: "Pode baixar agora" as tabelas do Path of Building, "As 6 joias, ~33 MB" no
// repositório). A Vaidade Gloriosa (Vaal), o Orgulho Letal (Karui), a Restrição Brutal (Maraketh), a Fé Militante (Templários), a
// Arrogância Elegante (Império Eterno) e a Tragédia Heroica (Kalguuranos): no encaixe, as passivas no raio (Grande) são CONQUISTADAS — a
// regra do PoB (`Classes/PassiveSpec.lua`, `Modules/DataLegionLookUpTableHelper.lua`), com os dados de `tools/importar-pob-atemporais.mjs`:
//   - o NOTÁVEL: a tabela da joia diz, pela semente, o que ele vira — uma passiva da legião no lugar dele, ou uma adição somada a ele (na
//     Vaidade, a passiva Vaal com os números dela, ou o Poder/Legado dos Vaal com até 4 adições roladas);
//   - a KEYSTONE: a do líder (`<tipo>_keystone_<id>`);
//   - a PEQUENA: Karui +2/+4 de Força, Maraketh +2/+4 de Destreza, Kalguuranos 1%/2% de Salvaguarda (os de atributo, o menor), Templários
//     o nó de Devoção (no de atributo) ou +5 de Devoção, Império Eterno nada, Vaal a pequena Vaal da tabela.
// As linhas conquistadas valem pelas regras de sempre (`arvore.traduzirLinha` — as em português do importador); as que o jogo não tem ficam
// sem efeito, como toda linha da árvore. "Habilidades Passivas Conquistadas não podem ser modificadas por outras joias".
import { readFileSync, readdirSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { traduzirLinha } from './arvore.mjs';
import { definirConquista } from '../passivas/arvore.mjs';

const PASTA = new URL('../../gamedata/itens-poe/atemporais/', import.meta.url);
let DADOS = null;
export const dados = () => (DADOS ??= JSON.parse(readFileSync(new URL('atemporais.json', PASTA), 'utf8')));
/** Os nós fixos da legião (o índice do PoB, 1-based, − 1): o Poder e o Legado dos Vaal, o nó de Devoção, a pequena vazia do Império Eterno. */
const NO = { poderVaal: 76, legadoVaal: 77, devocao: 90, eternoVazio: 109 };
const ATRIBUTOS = new Set(['Strength', 'Dexterity', 'Intelligence']);

/** O líder da linha da joia: `{ tipo, id }` (`kaom` → `{ tipo: 'karui', id: '1' }`); null sem ele. */
export const lider = (nome) => dados().lideres[String(nome ?? '').toLowerCase()] ?? null;
/** O atributo da linha da joia (`atemporal_<tipo>_<id>` = a semente). */
export const statDoLider = (l) => `atemporal_${l.tipo}_${l.id}`;
/** A conquista que a peça (a joia no encaixe) faz: `{ tipo, id, semente }` pelo atributo da linha dela; null se ela não conquista. */
/** Os atributos das linhas dos 23 líderes (as regras de `traducao.json`; `atributos-novos.json`). */
export const STATS_DOS_LIDERES = Object.freeze([
  'atemporal_eternal_1', 'atemporal_eternal_2', 'atemporal_eternal_3', 'atemporal_eternal_3_v2', 'atemporal_kalguur_1', 'atemporal_kalguur_2', 'atemporal_kalguur_3', 'atemporal_karui_1', 'atemporal_karui_2', 'atemporal_karui_3', 'atemporal_karui_3_v2', 'atemporal_maraketh_1', 'atemporal_maraketh_1_v2', 'atemporal_maraketh_2', 'atemporal_maraketh_3', 'atemporal_templar_1', 'atemporal_templar_1_v2', 'atemporal_templar_2', 'atemporal_templar_3', 'atemporal_vaal_1', 'atemporal_vaal_2', 'atemporal_vaal_2_v2', 'atemporal_vaal_3',
]);
export function conquistaDaPeca(peca) {
  const af = peca?.poe?.af ?? {};
  for (const k of STATS_DOS_LIDERES) {
    const v = Number(af[k]);
    if (!(v > 0)) continue;
    const m = /^atemporal_([a-z]+)_(\w+)$/.exec(k);
    return { tipo: m[1], id: m[2], semente: Math.round(v) };
  }
  return null;
}

// ---- as tabelas (o zlib do PoB; a da Vaidade em partes) ----
const TABELAS = new Map();
function tabela(tipoN) {
  if (TABELAS.has(tipoN)) return TABELAS.get(tipoN);
  const d = dados();
  const nome = d.arquivos[tipoN];
  const dir = new URL('lut/', PASTA);
  const parte = (f) => Number(/part(\d+)$/.exec(f)?.[1] ?? -1);
  const arquivos = readdirSync(dir).filter((f) => f === `${nome}.zip` || f.startsWith(`${nome}.zip.part`)).sort((a, b) => parte(a) - parte(b));
  const buf = inflateSync(Buffer.concat(arquivos.map((f) => readFileSync(new URL(f, dir)))));
  const t = { buf };
  if (tipoN === 1) {
    // a Vaidade: os tamanhos (um byte por nó e semente) e, depois, os dados de cada nó em sequência (o tamanho dele no índice)
    const [mn, mx] = d.sementes[1];
    const porSemente = mx - mn + 1;
    const porIndice = [];
    for (const [id, i] of Object.entries(d.indice)) porIndice[i] = id;
    let cursor = d.total * porSemente;
    t.inicio = new Float64Array(d.total);
    for (let i = 0; i < d.total; i++) { t.inicio[i] = cursor; cursor += d.tamanho[porIndice[i]] ?? 0; }
    t.prefixos = new Map();
    t.porSemente = porSemente;
  }
  TABELAS.set(tipoN, t);
  return t;
}
const global = (tipoN, x) => dados().localParaGlobal?.[tipoN]?.[x] ?? x;

/** A tabela no nó `noId` com a `semente` (o `readLUT` do PoB): a lista de bytes (vazia fora da tabela ou da faixa da semente). */
export function lerTabela(tipoN, semente, noId) {
  const d = dados();
  const seed = tipoN === 5 ? semente / 20 : semente;
  const [mn, mx] = d.sementes[tipoN];
  if (!(seed >= mn && seed <= mx) || !Number.isInteger(seed)) return [];
  const indice = d.indice[noId];
  if (indice == null) return [];
  const t = tabela(tipoN);
  const desloc = seed - mn;
  const porSemente = mx - mn + 1;
  if (tipoN === 1) {
    const tam = (s) => t.buf[indice * porSemente + s];
    let pre = t.prefixos.get(indice);
    if (!pre) {
      pre = new Uint32Array(porSemente + 1);
      for (let s = 0; s < porSemente; s++) pre[s + 1] = pre[s] + tam(s);
      t.prefixos.set(indice, pre);
    }
    const len = tam(desloc);
    const ini = t.inicio[indice] + pre[desloc];
    const r = [...t.buf.subarray(ini, ini + len)];
    if (len === 2 || len === 3) r[0] = global(1, r[0]);
    else if (len === 6 || len === 8) for (let i = 0; i < len / 2; i++) r[i] = global(1, r[i]);
    return r;
  }
  if (indice > d.notaveis) return [];
  return [global(tipoN, t.buf[indice * porSemente + desloc])];
}

/** O número da linha da legião no lugar da faixa (o `replaceHelperFunc` do PoB: por minuto ÷ 60, "permyriad" ÷ 100, ms ÷ 1000). */
function comValor(linha, chave, s, valor) {
  let v = valor;
  if (s.fmt === 'g') {
    if (/per_minute/.test(chave)) v = Math.round((v / 60) * 10) / 10;
    else if (/permyriad/.test(chave)) v /= 100;
    else if (/_ms/.test(chave)) v /= 1000;
  }
  if (s.min !== s.max) return linha.replace(`(${s.min}-${s.max})`, String(v));
  if (s.min !== v) return linha.replace(String(s.min), String(v));
  return linha;
}
/** As linhas (em português) da passiva da legião `p` com os números `valores` por índice do stat (sem valores: as da passiva). */
function linhasDe(p, valores = null) {
  return (p?.pt ?? []).map((l, i) => {
    if (!valores || !l) return l;
    const chave = p.ordem?.[i];
    const s = chave ? p.stats?.[chave] : null;
    return s ? comValor(l, chave, s, valores(s)) : l;
  }).filter(Boolean);
}
const adicaoPorId = (id) => dados().adicoes.find((a) => a?.id === id);

/**
 * A CONQUISTA do nó `no` (o da árvore do jogo: `tipo`, `nomeEn`) por `c` (`{ tipo, id, semente }`): `{ substitui, nome?, linhas, keystone? }`
 * — `substitui`: as linhas tomam o lugar das do nó (senão, somam). Null: o nó não muda (o encaixe, a maestria, fora da tabela).
 */
const CACHE = new Map();
export function conquista(no, c) {
  if (!no || !c) return null;
  const chave = `${c.tipo}|${c.id}|${c.semente}|${no.id}`;
  if (CACHE.has(chave)) return CACHE.get(chave);
  const r = calcular(no, c);
  CACHE.set(chave, r);
  return r;
}
function calcular(no, c) {
  const d = dados();
  const tipoN = d.tipos[c.tipo];
  const A = d.adicoesTotal;
  if (no.tipo === 'keystone') {
    const k = d.nos.find((n) => n?.id === `${c.tipo}_keystone_${c.id}`);
    return k ? { substitui: true, nome: k.nome, linhas: linhasDe(k), keystone: true } : null;
  }
  if (no.tipo === 'notable') {
    const t = lerTabela(tipoN, c.semente, no.id);
    if (!t.length) return null;
    if (tipoN === 1) {
      if (t.length === 2 || t.length === 3) {
        const p = d.nos[t[0] - A];
        return p ? { substitui: true, nome: p.nome, linhas: linhasDe(p, (s) => t[s.index]) } : null;
      }
      if (t.length === 6 || t.length === 8) {
        const meio = t.length / 2;
        let vies = 0;
        for (let i = 0; i < meio; i++) vies += t[i] <= 21 ? 1 : -1;
        const base = d.nos[vies >= 0 ? NO.poderVaal : NO.legadoVaal];
        const somas = new Map();
        for (let i = 0; i < meio; i++) somas.set(t[i], (somas.get(t[i]) ?? 0) + t[i + meio]);
        const linhas = [];
        for (const [add, rolado] of somas) { const a = d.adicoes[add]; if (a) linhas.push(...linhasDe(a, () => rolado)); }
        return { substitui: true, nome: base?.nome, linhas };
      }
      return null;
    }
    let substitui = false;
    let nome;
    const linhas = [];
    for (const x of t) {
      if (x >= A) {
        const p = d.nos[x - A];
        if (p) { substitui = true; nome = p.nome; linhas.splice(0, linhas.length, ...linhasDe(p)); }
      } else {
        const a = d.adicoes[x];
        if (a) linhas.push(...linhasDe(a));
      }
    }
    return linhas.length || substitui ? { substitui, nome, linhas } : null;
  }
  if (no.tipo === 'small') {
    const atributo = ATRIBUTOS.has(no.nomeEn);
    if (c.tipo === 'vaal') {
      const t = lerTabela(1, c.semente, no.id);
      const p = t.length ? d.nos[t[0] - A] : null;
      return p ? { substitui: true, nome: p.nome, linhas: linhasDe(p, () => t[1]) } : null;
    }
    const somar = (idAtributo, idPequeno) => ({ substitui: false, linhas: linhasDe(adicaoPorId(atributo ? idAtributo : idPequeno)) });
    if (c.tipo === 'karui') return somar('karui_attribute_strength', 'karui_small_strength');
    if (c.tipo === 'maraketh') return somar('maraketh_attribute_dex', 'maraketh_small_dex');
    if (c.tipo === 'kalguur') return somar('kalguuran_attribute_ward', 'kalguuran_small_ward');
    if (c.tipo === 'templar') return atributo ? { substitui: true, nome: d.nos[NO.devocao]?.nome, linhas: linhasDe(d.nos[NO.devocao]) } : { substitui: false, linhas: linhasDe(adicaoPorId('templar_small_devotion')) };
    if (c.tipo === 'eternal') return { substitui: true, nome: d.nos[NO.eternoVazio]?.nome, linhas: [] };
  }
  return null;
}

/** Os EFEITOS das linhas conquistadas (as regras de sempre — `traduzirLinha`; memorizado por linha). */
const EFEITOS = new Map();
export function efeitosDasLinhas(linhas) {
  const saida = [];
  for (const l of linhas ?? []) {
    if (!EFEITOS.has(l)) EFEITOS.set(l, traduzirLinha(l).efeitos);
    saida.push(...EFEITOS.get(l));
  }
  return saida;
}

// (a árvore pergunta por aqui — `passivas/arvore.definirConquista`)
definirConquista({ daPeca: conquistaDaPeca, doNo: conquista, efeitos: efeitosDasLinhas });
