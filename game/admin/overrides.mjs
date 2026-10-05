// O EDITOR DE OVERRIDES (monstros): o backend das telas "Mobs" da Engine. O bestiário é do Canary (`catalog-real.json`, intocado); o dono edita
// só as DIFERENÇAS em `gamedata/overrides/monstros.json` (ver `systems/overrides.mjs`), que o jogo aplica no boot. Fluxo: PROPOR (valida e mostra
// original × efetivo, impacto e avisos, sem gravar) → SALVAR (grava o arquivo, com cópia da versão anterior) → PUBLICAR (commit + deploy). Reverter =
// apagar a entrada (o original volta). Funções puras; quem fala HTTP é `conteudo-http.mjs`.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import * as O from '../systems/overrides.mjs';
import { precoNpc } from '../systems/hunt/rentabilidade.mjs';
import { VALOR_DA_MOEDA } from '../systems/inventario.mjs';
import { usosDe, desenhoDoMonstro } from './biblioteca.mjs';
import { revisaoDe, conferirRevisao } from './arquivo-versionado.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', 'gamedata');
/** Onde ler e gravar (os testes apontam para uma pasta temporária). */
export const CAMINHOS = { arquivo: join(O.PASTA, 'monstros.json'), versoes: join(O.PASTA, '_versoes', 'monstros') };
const AVISO_DE_VARIACAO = 0.25;

// O ORIGINAL: o catálogo importado lido do disco (NÃO o objeto do jogo, que já recebeu os overrides deste boot).
let BRUTO = null;
const bruto = () => (BRUTO ??= { bestiario: JSON.parse(readFileSync(join(RAIZ, 'catalog-real.json'), 'utf8')).bestiary, poderes: { ...JSON.parse(readFileSync(join(RAIZ, 'monstro-poderes.json'), 'utf8')).monstros, ...JSON.parse(readFileSync(join(RAIZ, 'boss-poderes.json'), 'utf8')).bosses } });
export const originalDe = (key) => bruto().bestiario[key] ?? null;
const ataquesOriginais = (key) => bruto().poderes[key]?.ataques ?? [];
const contexto = () => ({ ...O.contextoDoJogo(ITEM_CATALOG) });

function lerArquivo() {
  if (!existsSync(CAMINHOS.arquivo)) return { ativo: true, monstros: {} };
  const d = JSON.parse(readFileSync(CAMINHOS.arquivo, 'utf8'));
  return { ...d, ativo: d.ativo !== false, monstros: d.monstros ?? {} };
}
const ctxValidacao = (key, dados) => ({ ...contexto(), original: originalDe(key), existeMonstro: (k) => !!originalDe(k) || (dados.monstros[k]?.base != null && k !== key) });

/** O monstro EFETIVO de um override (original + diferenças, ataques incluídos). `base`: a variação parte do original da base. */
export function efetivoDe(key, ov) {
  const orig = originalDe(ov?.base ?? key);
  if (!orig) return null;
  const m = ov ? O.aplicarNoMonstro(orig, ov) : structuredClone(orig);
  m.ataques = ov?.ataques ?? structuredClone(ataquesOriginais(ov?.base ?? key));
  return m;
}

const med = (a) => ((a.min ?? 0) + (a.max ?? 0)) / 2;
/** Uma estimativa do dano por segundo de um conjunto de ataques (média × chance ÷ intervalo) — só para comparar antes × depois. */
const danoPorSegundo = (ataques) => ataques.reduce((s, a) => s + (med(a) * (a.chance ?? 100) / 100) / ((a.intervalo ?? 2000) / 1000), 0);
/** O valor esperado do loot por morte (ouro das moedas + itens pelo preço do NPC); a quantidade média das moedas segue a exp do bicho. */
function valorDoLoot(m) {
  let v = 0;
  for (const l of m.loot ?? []) {
    if (VALOR_DA_MOEDA[l.id] != null) v += l.chance * Math.max(1, m.exp ?? 10) * VALOR_DA_MOEDA[l.id];
    else v += l.chance * precoNpc(l.id);
  }
  return Math.round(v);
}
const pct = (a, b) => (a ? Math.round((b / a - 1) * 100) : b ? 100 : 0);

/** Os monstros para a lista da tela: com busca e filtro (`com-override`), o sprite e a marca de override/variação. */
export function listar({ q = '', filtro = '', limite = 80 } = {}) {
  const dados = lerArquivo();
  const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const t = norm(q).trim();
  const todos = [...new Set([...Object.keys(bruto().bestiario), ...Object.keys(dados.monstros)])];
  const linhas = todos.map((key) => {
    const ov = dados.monstros[key];
    const m = efetivoDe(key, ov) ?? {};
    return { key, nome: m.name ?? key, hp: m.hp ?? null, exp: m.exp ?? null, classe: m.class ?? null, temOverride: !!ov, ativo: ov ? ov.ativo !== false : null, variacaoDe: ov?.base ?? null, desenho: m.look ? desenhoDoMonstro(m) : null };
  }).filter((l) => (!t || norm(l.nome).includes(t) || l.key.includes(t)) && (filtro !== 'com-override' || l.temOverride));
  linhas.sort((a, b) => Number(b.temOverride) - Number(a.temOverride) || String(a.nome).localeCompare(String(b.nome)));
  return { total: linhas.length, itens: linhas.slice(0, Math.min(200, Math.max(1, Number(limite) || 80))), ativo: dados.ativo, comOverride: Object.keys(dados.monstros).length, revisao: revisaoDe(CAMINHOS.arquivo) };
}

/** A ficha de um monstro para a tela: original, override gravado, efetivo, onde é usado. */
export function obter(key) {
  const dados = lerArquivo();
  const ov = dados.monstros[key] ?? null;
  const orig = originalDe(ov?.base ?? key);
  if (!orig) return null;
  const efetivo = efetivoDe(key, ov);
  return {
    key,
    ehVariacao: ov?.base != null,
    base: ov?.base ?? null,
    original: { ...structuredClone(orig), ataques: structuredClone(ataquesOriginais(ov?.base ?? key)) },
    override: ov,
    efetivo,
    desenho: efetivo.look ? desenhoDoMonstro(efetivo) : null,
    usos: usosDe('monstros', key),
    globalAtivo: dados.ativo,
    elementos: O.ELEMENTOS,
    revisao: revisaoDe(CAMINHOS.arquivo),
  };
}

/**
 * Propõe um override para `key` (sem gravar): valida, calcula o efetivo, as mudanças e o impacto, e devolve avisos de balanceamento e de uso.
 * `ov` vazio/`null` = sem override (volta ao original).
 */
export function propor(key, ov) {
  const dados = lerArquivo();
  const limpo = ov && Object.keys(ov).filter((c) => c !== 'ativo').length ? ov : null;
  const { erros, avisos } = limpo ? O.validarMonstro(key, limpo, ctxValidacao(key, dados)) : { erros: [], avisos: [] };
  if (erros.length) return { ok: false, erros, avisos, mudancas: [] };
  const base = limpo?.base ?? key;
  const orig = originalDe(base);
  if (!orig) return { ok: false, erros: [`monstro ${key}: não existe no bestiário.`], avisos, mudancas: [] };
  const antes = limpo?.base != null ? efetivoDe(base, null) : efetivoDe(key, null);
  const depois = efetivoDe(key, limpo);
  const mudancas = [];
  const add = (campo, a, d, extra = {}) => { if (JSON.stringify(a) !== JSON.stringify(d)) mudancas.push({ campo, antes: a ?? null, depois: d ?? null, ...extra }); };
  for (const c of ['name', 'hp', 'exp', 'armor', 'speed', 'class', 'stars', 'look']) add(c, antes[c], depois[c], typeof antes[c] === 'number' && typeof depois[c] === 'number' ? { variacaoPct: pct(antes[c], depois[c]) } : {});
  add('elements', antes.elements ?? {}, depois.elements ?? {});
  add('loot', antes.loot ?? [], depois.loot ?? [], { valorEsperado: { antes: valorDoLoot(antes), depois: valorDoLoot(depois), variacaoPct: pct(valorDoLoot(antes), valorDoLoot(depois)) } });
  add('ataques', antes.ataques, depois.ataques, { danoPorSegundo: { antes: Math.round(danoPorSegundo(antes.ataques)), depois: Math.round(danoPorSegundo(depois.ataques)), variacaoPct: pct(danoPorSegundo(antes.ataques), danoPorSegundo(depois.ataques)) } });
  const usos = usosDe('monstros', key);
  const avisosDeBalanco = [];
  for (const m of mudancas) {
    const v = m.valorEsperado?.variacaoPct ?? m.danoPorSegundo?.variacaoPct ?? m.variacaoPct;
    if (v != null && Math.abs(v) >= AVISO_DE_VARIACAO * 100 && ['hp', 'exp', 'armor', 'loot', 'ataques'].includes(m.campo)) avisosDeBalanco.push(`BALANCEAMENTO — ${m.campo === 'loot' ? 'valor esperado do loot' : m.campo === 'ataques' ? 'dano por segundo' : m.campo}: ${v > 0 ? '+' : ''}${v}% em relação ao original.`);
  }
  if (usos.length && mudancas.length) avisosDeBalanco.push(`USO — ${depois.name ?? key} aparece em ${usos.length} lugar(es) (${usos.slice(0, 4).map((u) => u.nome ?? u.id).join(', ')}${usos.length > 4 ? '…' : ''}): a mudança vale em todos.`);
  if (limpo?.base != null && !usos.length) avisosDeBalanco.push('Variação nova ainda não usada em nenhum mapa: coloque-a como spawn no Editor de mapas para ela aparecer no jogo.');
  return { ok: true, erros: [], avisos: [...avisos, ...avisosDeBalanco], mudancas, efetivo: depois, usos: usos.length, semMudancas: mudancas.length === 0 && !limpo };
}

// ------------------------------------------------------------------ gravação (versões só de acréscimo)
export function versoes() {
  if (!existsSync(CAMINHOS.versoes)) return [];
  return readdirSync(CAMINHOS.versoes).filter((n) => /^\d+\.json$/.test(n)).map((n) => Number(n.slice(0, -5))).sort((a, b) => b - a);
}
function gravar(dados) {
  mkdirSync(dirname(CAMINHOS.arquivo), { recursive: true });
  if (existsSync(CAMINHOS.arquivo)) {
    mkdirSync(CAMINHOS.versoes, { recursive: true });
    writeFileSync(join(CAMINHOS.versoes, `${(versoes()[0] ?? 0) + 1}.json`), readFileSync(CAMINHOS.arquivo, 'utf8'), { flag: 'wx' });
  }
  const ordenado = Object.fromEntries(Object.keys(dados.monstros).sort().map((k) => [k, dados.monstros[k]]));
  writeFileSync(CAMINHOS.arquivo, `${JSON.stringify({ _nota: 'Overrides de monstros (systems/overrides.mjs): só as DIFERENÇAS sobre o bestiário importado. Apagar uma entrada devolve o original. Editado em /editor/conteudo (Mobs).', ativo: dados.ativo, monstros: ordenado }, null, 1)}\n`);
}
const COMO_PUBLICAR = 'O arquivo gamedata/overrides/monstros.json foi gravado neste servidor. O jogo só aplica os overrides no boot: faça commit e publique pelo deploy (reinício controlado). Nada muda no jogo antes disso.';

export function salvar(key, ov, revisao) {
  const conflito = conferirRevisao(revisao, CAMINHOS.arquivo);
  if (conflito) return conflito;
  const p = propor(key, ov);
  if (!p.ok) return { ok: false, erros: p.erros };
  const dados = lerArquivo();
  if (p.semMudancas && !dados.monstros[key]) return { ok: true, semMudancas: true, avisos: [] };
  const limpo = ov && Object.keys(ov).filter((c) => c !== 'ativo').length ? ov : null;
  if (!limpo) delete dados.monstros[key];
  else dados.monstros[key] = { ...(dados.monstros[key]?.ativo === false ? { ativo: false } : {}), ...limpo };
  gravar(dados);
  return { ok: true, avisos: p.avisos, mudancas: p.mudancas, comoPublicar: COMO_PUBLICAR };
}

/** Reverter: apaga o override (o original volta). Uma variação em uso não pode ser apagada (quebraria os mapas). */
export function reverter(key, revisao) {
  const conflito = conferirRevisao(revisao, CAMINHOS.arquivo);
  if (conflito) return conflito;
  const dados = lerArquivo();
  const ov = dados.monstros[key];
  if (!ov) return { ok: false, erros: ['Esse monstro não tem override.'] };
  if (ov.base != null) {
    const usos = usosDe('monstros', key);
    if (usos.length) return { ok: false, erros: [`A variação "${key}" é usada em ${usos.length} lugar(es) (${usos.slice(0, 3).map((u) => u.nome ?? u.id).join(', ')}): tire-a de lá antes de apagar.`] };
  }
  delete dados.monstros[key];
  gravar(dados);
  return { ok: true, comoPublicar: COMO_PUBLICAR };
}

/** Duplicar: cria uma VARIAÇÃO (`base`) com chave e nome novos — o original não muda. */
export function duplicar(origem, novaKey, novoNome = null, revisao) {
  const conflito = conferirRevisao(revisao, CAMINHOS.arquivo);
  if (conflito) return conflito;
  const dados = lerArquivo();
  const base = dados.monstros[origem]?.base ?? origem;
  // A cópia leva o que o monstro de origem JÁ tem de override (duplicar o efetivo, não o original), com a base e o nome novos.
  const { ativo: _a, base: _b, ...campos } = dados.monstros[origem] ?? {};
  const ov = { ...structuredClone(campos), base, name: novoNome || `${efetivoDe(origem, dados.monstros[origem])?.name ?? origem} (variação)` };
  const { erros } = O.validarMonstro(novaKey, ov, ctxValidacao(novaKey, dados));
  if (dados.monstros[novaKey]) erros.push(`monstro ${novaKey}: já existe um override com essa chave.`);
  if (erros.length) return { ok: false, erros };
  dados.monstros[novaKey] = ov;
  gravar(dados);
  return { ok: true, key: novaKey, comoPublicar: COMO_PUBLICAR };
}

/** Liga/desliga a camada inteira (`ativo`) ou um monstro só (o jogo ignora o desligado, sem apagar nada). */
export function definirAtivo(ativo, key = null, revisao) {
  const conflito = conferirRevisao(revisao, CAMINHOS.arquivo);
  if (conflito) return conflito;
  if (typeof ativo !== 'boolean') return { ok: false, erros: ['ativo deve ser true ou false.'] };
  const dados = lerArquivo();
  if (key == null) dados.ativo = ativo;
  else {
    if (!dados.monstros[key]) return { ok: false, erros: ['Esse monstro não tem override.'] };
    if (ativo) delete dados.monstros[key].ativo; else dados.monstros[key].ativo = false;
  }
  gravar(dados);
  return { ok: true, comoPublicar: COMO_PUBLICAR };
}

export function restaurar(n, revisao) {
  const conflito = conferirRevisao(revisao, CAMINHOS.arquivo);
  if (conflito) return conflito;
  const arq = join(CAMINHOS.versoes, `${Number(n)}.json`);
  if (!Number.isInteger(Number(n)) || !existsSync(arq)) return { ok: false, erros: ['Versão não encontrada.'] };
  const antiga = JSON.parse(readFileSync(arq, 'utf8'));
  gravar({ ativo: antiga.ativo !== false, monstros: antiga.monstros ?? {} });
  return { ok: true, comoPublicar: COMO_PUBLICAR };
}
