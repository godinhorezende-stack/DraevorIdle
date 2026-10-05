// A TABELA DE DROP POR MONSTRO e os ITENS DE MISSÃO (sistema de itens do PoE — só com ITENS_POE=1). Pedido do dono (05/10): o Act liga os
// mapas, os mapas ligam os mobs e os mobs ligam os drops — NO MODELO DO PoE: o monstro COMUM não tem item amarrado (ele cai pela tabela
// global: a chance de cair, o Item Level = o nível dele, qualquer base até esse nível — `jogo.dropsDoMonstro`); só os ÚNICOS e CHEFES têm
// itens próprios (como os pináculos com os únicos exclusivos e o alvo da missão com o item dela). Cada único (pelo slug do PoE —
// `poe-<slug>-<nível>` no bestiário) tem uma lista editável na engine, POR CIMA do drop global:
//   { id, chance (% de 0 a 100), missao? }   — `missao`: só cai enquanto a fase da missão não foi concluída (o item da missão).
// Os itens de missão (`itens-de-missao.json`, de `tools/importar-atos-poe.mjs`) entram no catálogo de itens como itens comuns sem slot,
// sem peso e sem preço (a venda automática não os vende).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { ligado } from './catalogo.mjs';

const ARQ_ITENS = new URL('../../gamedata/itens-poe/itens-de-missao.json', import.meta.url);
const ARQ_DROPS = new URL('../../gamedata/itens-poe/drops-por-monstro.json', import.meta.url);
const ler = (u, padrao) => (existsSync(u) ? JSON.parse(readFileSync(u, 'utf8')) : padrao);

export const ITENS_DE_MISSAO = ler(ARQ_ITENS, { itens: [] }).itens;
const DADOS = ler(ARQ_DROPS, { monstros: {} });
DADOS.monstros ??= {};

const slug = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/** A chave da tabela de um bicho: o slug do monstro do PoE (`poe-hailrake-3` → `hailrake`) ou a chave do bestiário. */
export const chaveDaTabela = (key) => {
  const m = /^poe-(.+)-\d+$/.exec(String(key ?? ''));
  return m ? m[1] : slug(key);
};
/** A lista de drop de um monstro (pela chave do bestiário ou pelo slug). */
export const tabelaDe = (keyOuSlug) => DADOS.monstros[chaveDaTabela(keyOuSlug)] ?? DADOS.monstros[slug(keyOuSlug)] ?? [];
export const todas = () => DADOS.monstros;

/** Põe os itens de missão no catálogo de itens (uma vez). Sem o sistema ligado, nada. */
export function registrarItens(itemCatalog) {
  if (!ligado()) return 0;
  for (const it of ITENS_DE_MISSAO) {
    if (itemCatalog[it.id]) continue;
    itemCatalog[it.id] = { id: it.id, name: it.nome, type: 'quest items', weight: 0, hasSprite: false, rarity: 'comum', stackable: false, descricao: it.descricao, missao: { nome: it.missao, ato: it.ato, area: it.area } };
  }
  return ITENS_DE_MISSAO.length;
}

/**
 * O que a tabela solta nesta morte: `[{ id, count: 1 }]`. `missaoAberta(id)`: o item de missão ainda serve (a fase da missão não foi
 * concluída e o personagem não o tem) — sem ela, item de missão não cai.
 */
export function soltar(key, { rng = Math.random, missaoAberta = () => false, existe = () => true } = {}) {
  const saida = [];
  for (const d of tabelaDe(key)) {
    if (!existe(d.id)) continue;
    if (d.missao && !missaoAberta(d.id)) continue;
    if (rng() * 100 < Number(d.chance)) saida.push({ id: Number(d.id), count: 1 });
  }
  return saida;
}

/** Valida e grava a tabela de um monstro. `existe(id)`: o item está no catálogo. Devolve `{ ok, erros?, lista? }`. */
export function salvar(keyOuSlug, lista, { existe = () => true, podeTer = () => true, gravar = true } = {}) {
  const k = chaveDaTabela(keyOuSlug);
  if (!k) return { ok: false, erros: ['Monstro inválido.'] };
  if (Array.isArray(lista) && lista.length && !podeTer(k)) return { ok: false, erros: ['Monstro comum não tem item próprio (modelo do PoE): ele cai pela tabela global. Só únicos e chefes têm drop próprio.'] };
  if (!Array.isArray(lista)) return { ok: false, erros: ['A tabela precisa ser uma lista.'] };
  const erros = [];
  const limpa = lista.map((d, i) => {
    const id = Number(d?.id);
    const chance = Number(d?.chance);
    if (!existe(id)) erros.push(`Linha ${i + 1}: o item ${d?.id} não existe no catálogo.`);
    if (!(chance > 0 && chance <= 100)) erros.push(`Linha ${i + 1}: a chance vai de 0,01 a 100 (%).`);
    return { id, chance: Math.round(chance * 100) / 100, ...(d?.missao ? { missao: true } : {}) };
  });
  const ids = limpa.map((d) => d.id);
  for (const id of new Set(ids.filter((x, i) => ids.indexOf(x) !== i))) erros.push(`O item ${id} aparece mais de uma vez.`);
  if (erros.length) return { ok: false, erros };
  if (limpa.length) DADOS.monstros[k] = limpa;
  else delete DADOS.monstros[k];
  if (gravar) writeFileSync(ARQ_DROPS, `${JSON.stringify(DADOS, null, 1)}\n`);
  return { ok: true, lista: limpa };
}
