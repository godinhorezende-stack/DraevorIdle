// O EDITOR DE OVERRIDES DE ITENS: o catálogo importado (`item-catalog.json`) nunca é editado; o dono grava só as diferenças em
// `gamedata/overrides/itens.json` (`systems/overrides.mjs`), aplicadas no boot. Mesmo fluxo dos monstros: propor (valida + original × efetivo + avisos
// de balanceamento e de uso, sem gravar) → salvar (arquivo + versão anterior) → publicar (commit + deploy). Reverter apaga a entrada.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as O from '../systems/overrides.mjs';
import { criarArquivoVersionado, revisaoDe, conferirRevisao } from './arquivo-versionado.mjs';
import { usosDe, desenhoDoItem } from './biblioteca.mjs';
import * as Conjuntos from '../systems/conjuntos.mjs';
import * as ItemPower from '../systems/item-power.mjs';
import * as Diario from './item-power-historico.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', 'gamedata');
export const CAMINHOS = { arquivo: join(O.PASTA, 'itens.json'), versoes: join(O.PASTA, '_versoes', 'itens') };
const AVISO_DE_VARIACAO = 0.25;
const COMO_PUBLICAR = 'O arquivo gamedata/overrides/itens.json foi gravado neste servidor. No ambiente local o Hot Reload aplica o catálogo em memória; para valer na produção: faça commit e publique pelo deploy (reinício controlado).';
const arq = () => criarArquivoVersionado({ caminhos: CAMINHOS, valorPadrao: () => ({ ativo: true, itens: {} }) });
const dados = () => { const d = arq().ler(); return { ...d, ativo: d.ativo !== false, itens: d.itens ?? {} }; };
const gravar = (d) => arq().gravar({ _nota: 'Overrides de itens (systems/overrides.mjs): só as DIFERENÇAS sobre o catálogo importado. Apagar uma entrada devolve o original. Editado em /editor/conteudo (Itens).', ativo: d.ativo, itens: Object.fromEntries(Object.keys(d.itens).sort((a, b) => Number(a) - Number(b)).map((k) => [k, d.itens[k]])) });

// O ORIGINAL: o catálogo do disco, não o objeto do jogo (que já recebeu os overrides deste boot).
let BRUTO = null;
export const originalDe = (id) => (BRUTO ??= JSON.parse(readFileSync(join(RAIZ, 'item-catalog.json'), 'utf8')))[id] ?? null;
const pct = (a, b) => (a ? Math.round((b / a - 1) * 100) : b ? 100 : 0);

export function efetivoDe(id, ov) {
  const o = originalDe(id);
  return o ? (ov ? O.aplicarNoItem(o, ov) : structuredClone(o)) : null;
}

export function listar({ q = '', filtro = '', slot = '', limite = 80 } = {}) {
  const d = dados();
  const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const t = norm(q).trim();
  const ids = filtro === 'com-override' ? Object.keys(d.itens) : t.length >= 2 || slot ? Object.keys(JSON.parse(readFileSync(join(RAIZ, 'item-catalog.json'), 'utf8'))) : Object.keys(d.itens);
  const linhas = ids.map((id) => {
    const ov = d.itens[id];
    const m = efetivoDe(id, ov);
    if (!m) return null;
    const f = ItemPower.fichaDoMeta({ ...m, id }, ItemPower.EM_USO);
    const editado = !!ov && ov.ativo !== false && ['name', 'minLevel', 'rarity', 'attack', 'defense', 'armor'].some((k) => k in ov);
    return { id, nome: m.name, tipo: m.type ?? null, slot: m.slot ?? null, rarity: m.rarity ?? null, temOverride: !!ov, ativo: ov ? ov.ativo !== false : null, desenho: desenhoDoItem(m),
      minLevel: m.minLevel ?? null, attack: m.attack ?? null, defense: m.defense ?? null, armor: m.armor ?? null, ip: f?.ip ?? null, situacao: f?.situacao ?? null, atributosEditados: editado,
      original: editado ? { minLevel: originalDe(id).minLevel ?? null, attack: originalDe(id).attack ?? null, defense: originalDe(id).defense ?? null, armor: originalDe(id).armor ?? null } : null };
  }).filter((l) => l && (!t || norm(l.nome).includes(t) || l.id === t) && (!slot || l.slot === slot));
  linhas.sort((a, b) => Number(b.temOverride) - Number(a.temOverride) || String(a.nome).localeCompare(String(b.nome)));
  return { total: linhas.length, itens: linhas.slice(0, Math.min(200, Math.max(1, Number(limite) || 80))), ativo: d.ativo, comOverride: Object.keys(d.itens).length, revisao: revisaoDe(CAMINHOS.arquivo), dica: t.length < 2 && !slot && filtro !== 'com-override' ? 'Busque pelo nome (2 letras ou mais) ou escolha um slot; sem busca só aparecem os itens que já têm override.' : null };
}

export function obter(id) {
  const d = dados();
  const original = originalDe(id);
  if (!original) return null;
  const ov = d.itens[id] ?? null;
  const efetivo = efetivoDe(id, ov);
  return { id: String(id), original, override: ov, efetivo, desenho: desenhoDoItem(efetivo), usos: usosDe('itens', id), conjuntos: Conjuntos.usadoPor(id), globalAtivo: d.ativo, revisao: revisaoDe(CAMINHOS.arquivo), rarezas: O.RARIDADES_DE_ITEM, campos: O.CAMPOS_DE_ITEM, equipamento: !!original.slot };
}

export function propor(id, ov) {
  const limpo = ov && Object.keys(ov).filter((c) => c !== 'ativo').length ? ov : null;
  const original = originalDe(id);
  const { erros, avisos } = limpo ? O.validarItem(id, limpo, { original }) : { erros: original ? [] : [`item ${id}: não existe no catálogo de itens.`], avisos: [] };
  if (erros.length) return { ok: false, erros, avisos, mudancas: [] };
  const antes = efetivoDe(id, null);
  const depois = efetivoDe(id, limpo);
  const mudancas = [];
  for (const c of O.CAMPOS_DE_ITEM) {
    if (JSON.stringify(antes[c]) === JSON.stringify(depois[c])) continue;
    mudancas.push({ campo: c, antes: antes[c] ?? null, depois: depois[c] ?? null, ...(typeof antes[c] === 'number' && typeof depois[c] === 'number' ? { variacaoPct: pct(antes[c], depois[c]) } : {}) });
  }
  const usos = usosDe('itens', id);
  const extra = [];
  for (const m of mudancas) if (m.variacaoPct != null && Math.abs(m.variacaoPct) >= AVISO_DE_VARIACAO * 100 && ['attack', 'defense', 'armor', 'buy', 'sell'].includes(m.campo)) extra.push(`BALANCEAMENTO — ${m.campo}: ${m.variacaoPct > 0 ? '+' : ''}${m.variacaoPct}% em relação ao original.`);
  if (mudancas.some((m) => m.campo === 'rarity')) extra.push('BALANCEAMENTO — mudar a raridade-base do item muda a ficha e o valor de referência dele para todos os jogadores.');
  if (usos.length && mudancas.length) extra.push(`USO — o item aparece em ${usos.length} lugar(es) (${usos.slice(0, 4).map((u) => u.nome ?? u.id).join(', ')}${usos.length > 4 ? '…' : ''}): a mudança vale em todos.`);
  return { ok: true, erros: [], avisos: [...avisos, ...extra], mudancas, efetivo: depois, usos: usos.length, semMudancas: mudancas.length === 0 && !limpo };
}

export function salvar(id, ov, revisao) {
  const conflito = conferirRevisao(revisao, CAMINHOS.arquivo);
  if (conflito) return conflito;
  const p = propor(id, ov);
  if (!p.ok) return { ok: false, erros: p.erros };
  const d = dados();
  const limpo = ov && Object.keys(ov).filter((c) => c !== 'ativo').length ? ov : null;
  if (!limpo && !d.itens[id]) return { ok: true, semMudancas: true, avisos: [] };
  if (!limpo) delete d.itens[id]; else d.itens[id] = { ...(d.itens[id]?.ativo === false ? { ativo: false } : {}), ...limpo };
  gravar(d);
  Diario.registrar({ tipo: 'itens-editor', ids: [Number(id)], itens: [{ id: Number(id), nome: p.efetivo?.name ?? null, mudancas: p.mudancas.map((m) => ({ campo: m.campo, de: m.antes, para: m.depois })) }] });
  return { ok: true, avisos: p.avisos, mudancas: p.mudancas, comoPublicar: COMO_PUBLICAR };
}

export function reverter(id, revisao) {
  const conflito = conferirRevisao(revisao, CAMINHOS.arquivo);
  if (conflito) return conflito;
  const d = dados();
  if (!d.itens[id]) return { ok: false, erros: ['Esse item não tem override.'] };
  delete d.itens[id];
  gravar(d);
  Diario.registrar({ tipo: 'restauracao', ids: [Number(id)], rotulo: 'reverter ao original (editor de itens)' });
  return { ok: true, comoPublicar: COMO_PUBLICAR };
}

export function definirAtivo(ativo, id = null, revisao) {
  const conflito = conferirRevisao(revisao, CAMINHOS.arquivo);
  if (conflito) return conflito;
  if (typeof ativo !== 'boolean') return { ok: false, erros: ['ativo deve ser true ou false.'] };
  const d = dados();
  if (id == null) d.ativo = ativo;
  else {
    if (!d.itens[id]) return { ok: false, erros: ['Esse item não tem override.'] };
    if (ativo) delete d.itens[id].ativo; else d.itens[id].ativo = false;
  }
  gravar(d);
  return { ok: true, comoPublicar: COMO_PUBLICAR };
}

export const versoes = () => arq().versoes();
export function restaurar(n, revisao) {
  const conflito = conferirRevisao(revisao, CAMINHOS.arquivo);
  if (conflito) return conflito;
  const r = arq().restaurar(n);
  return r.ok ? { ...r, comoPublicar: COMO_PUBLICAR } : r;
}

// Para o editor de atributos-base do Item Power (`item-power-editor.mjs`): a MESMA leitura e gravação versionada deste arquivo — nenhuma fonte de dados paralela.
export const lerDados = dados;
export const gravarDados = gravar;
