// O armazém dos ATOS do editor (rascunhos): um arquivo por ato em `gamedata/atos/<id>.json`. Os atos de hoje aparecem como `legado-N`,
// SÓ LEITURA (`systems/atos-legado.mjs`), e nunca são gravados aqui. Nada disto roda no jogo ainda: o runtime por grafo é a Etapa 6 —
// `beta`/`publicado` só gravam com a validação limpa, e o jogo carrega o arquivo no PRÓXIMO BOOT do servidor (`Campanha.registrarAto`).
// Funções puras; quem fala HTTP é `admin/conteudo-http.mjs` (prefixo trancado).
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CATALOGO, ITEM_CATALOG } from '../systems/dados.mjs';
import * as Modelo from '../systems/atos-modelo.mjs';
import * as Legado from '../systems/atos-legado.mjs';
import * as Campanha from '../systems/campanha.mjs';
import * as Recompensas from '../systems/encontros/recompensas.mjs';
import { CONFIG as CONFIG_DE_ENCONTROS } from '../systems/encontros/config.mjs';
import { valorDaInstancia } from '../systems/encontros/economia.mjs';
import { desenhoDoItem } from './biblioteca.mjs';
import { precoNpc } from '../systems/hunt/rentabilidade.mjs';

export const CAMINHOS = { atos: join(dirname(fileURLToPath(import.meta.url)), '..', 'gamedata', 'atos') };
const HUNTS = () => new Set([...CATALOGO.hunts, ...CATALOGO.vips, ...CATALOGO.especiais, ...CATALOGO.divinas].map((h) => h.id));
const BOSSES = () => new Set(CATALOGO.bosses.map((b) => b.id));
const arquivo = (id) => join(CAMINHOS.atos, `${id}.json`);

function lerSalvos() {
  if (!existsSync(CAMINHOS.atos)) return [];
  const saida = [];
  for (const a of readdirSync(CAMINHOS.atos).filter((n) => n.endsWith('.json'))) {
    try {
      saida.push(Modelo.normalizar(JSON.parse(readFileSync(join(CAMINHOS.atos, a), 'utf8'))));
    } catch {
      /* arquivo corrompido: ignorado na listagem (o validador não o vê) */
    }
  }
  return saida;
}

/** Todos os atos: os legados (somente leitura) e os salvos pelo editor. */
export const todos = () => [...Legado.atosLegados(), ...lerSalvos()];
export const obter = (id) => todos().find((a) => a.id === id) ?? null;

/** Resumo para a lista do editor. */
export const listar = () =>
  todos().map((a) => ({ id: a.id, nome: a.nome, estado: a.estado, versao: a.versao, ordem: a.ordem, fases: a.fases.length, bossFinal: a.bossFinal?.bossId ?? null, somenteLeitura: !!a.legado?.somenteLeitura }));

/**
 * O teto RELATIVO de economia (o mesmo dos encontros): o que a recompensa paga a CADA limpeza, em ouro de NPC, contra o valor de limpar a
 * própria fase. Aviso a partir de `fracaoDaFaseAviso`, erro a partir de `fracaoDaFaseErro`. Sem hunt (boss final) ou sem spawns, não há base.
 */
function avaliarEconomia(huntId, rec) {
  if (!huntId) return [];
  const base = valorDaInstancia(huntId, 'facil').valor;
  if (!(base > 0)) return [{ nivel: 'aviso', mensagem: 'Sem base de comparação: a hunt não tem spawns para estimar o valor da fase.' }];
  const fracao = Recompensas.valorEsperado(rec) / base;
  const L = CONFIG_DE_ENCONTROS.limites;
  const pct = `${Math.round(fracao * 100)}%`;
  if (fracao >= L.fracaoDaFaseErro) return [{ nivel: 'erro', mensagem: `A recompensa vale ${pct} do valor de limpar a fase (teto ${Math.round(L.fracaoDaFaseErro * 100)}%): seria uma fonte nova de loot.` }];
  if (fracao >= L.fracaoDaFaseAviso) return [{ nivel: 'aviso', mensagem: `A recompensa vale ${pct} do valor de limpar a fase (aviso a partir de ${Math.round(L.fracaoDaFaseAviso * 100)}%): confira o balanceamento.` }];
  return [];
}

const NOME_DO_MODELO = 'Chance INDIVIDUAL por item (cada linha sorteia por conta própria, a cada rolagem). Não há peso, quantidade mín./máx. nem condição no loot do jogo.';

/** A PRÉVIA de uma recompensa: o que cada linha paga, com a chance e a origem. Só leitura. */
export function previa(rec, { origem = 'fase' } = {}) {
  const r = rec ?? {};
  const rolagens = r.rolagens ?? 1;
  const nome = (id) => ITEM_CATALOG[id]?.name ?? null;
  const linhas = [
    ...Recompensas.dropsDe(r).map((d) => ({ tipo: 'drop', item: d.id, nome: nome(d.id), desenho: ITEM_CATALOG[d.id] ? desenhoDoItem(ITEM_CATALOG[d.id]) : null, valorPorExecucao: Math.round(d.chance * rolagens * precoNpc(d.id)), chancePct: Number((d.chance * 100).toFixed(4)), esperadoPorExecucao: Number((d.chance * rolagens).toFixed(4)), origem: `${origem} (loot)`, condicao: 'sempre' })),
    ...(r.primeiraConclusao?.itens ?? []).map((i) => ({ tipo: 'primeira vez', item: i.id, nome: nome(i.id), desenho: ITEM_CATALOG[i.id] ? desenhoDoItem(ITEM_CATALOG[i.id]) : null, quantidade: i.count, chancePct: 100, origem: `${origem} (1ª vez, uma por personagem)`, condicao: 'só na primeira' })),
  ];
  if (r.primeiraConclusao?.gold) linhas.push({ tipo: 'primeira vez', nome: 'ouro', quantidade: r.primeiraConclusao.gold, chancePct: 100, origem: `${origem} (1ª vez)`, condicao: 'só na primeira' });
  if (r.primeiraConclusao?.exp) linhas.push({ tipo: 'primeira vez', nome: 'experiência', quantidade: r.primeiraConclusao.exp, chancePct: 100, origem: `${origem} (1ª vez)`, condicao: 'só na primeira' });
  return { modelo: NOME_DO_MODELO, rolagens, moedasMediaPorRolagem: r.moedasMedia ?? null, valorEsperadoPorExecucao: Recompensas.valorEsperado(r), linhas };
}

/** Gerador pseudo-aleatório com semente (mulberry32): a mesma simulação dá o mesmo resultado. */
function semente(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * SIMULA `execucoes` execuções (limpezas/vitórias) da recompensa. É ESTATÍSTICA: estima a frequência pelo modelo de chance individual; não
 * garante o resultado de uma execução real (o jogo ainda aplica bônus de loot, filtros e capacidade).
 */
export function simular(rec, { execucoes = 10000, semente: s = 1 } = {}) {
  const n = Math.min(100000, Math.max(1, Math.floor(execucoes) || 10000));
  const rng = semente(s);
  const drops = Recompensas.dropsDe(rec ?? {});
  const rolagens = rec?.rolagens ?? 1;
  const total = new Map();
  const comAlgum = new Map();
  for (let i = 0; i < n; i++) {
    const nessa = new Set();
    for (let r = 0; r < rolagens; r++) for (const d of drops) if (rng() < d.chance) {
      total.set(d.id, (total.get(d.id) ?? 0) + 1);
      nessa.add(d.id);
    }
    for (const id of nessa) comAlgum.set(id, (comAlgum.get(id) ?? 0) + 1);
  }
  const ids = [...new Set(drops.map((d) => d.id))];
  return {
    aviso: 'Simulação estatística: estima a frequência pela chance configurada; não garante o resultado de uma execução real.',
    execucoes: n,
    itens: ids.map((id) => ({ item: id, nome: ITEM_CATALOG[id]?.name ?? null, quedasPorExecucao: Number(((total.get(id) ?? 0) / n).toFixed(4)), execucoesComQueda: Number((((comAlgum.get(id) ?? 0) / n) * 100).toFixed(2)), execucoesParaUmaQueda: total.get(id) ? Number((n / total.get(id)).toFixed(1)) : null })),
  };
}

/** O que o validador consulta: cadastros reais + as hunts dos OUTROS atos (o progresso é por hunt: dois atos não podem dividir uma). */
export function contexto(idDoAto) {
  const hunts = HUNTS();
  const bosses = BOSSES();
  const outros = todos().filter((a) => a.id !== idDoAto);
  const emUso = new Map();
  for (const o of outros) for (const f of o.fases) if (f.huntId && !emUso.has(f.huntId)) emUso.set(f.huntId, o.id);
  const ordensEmUso = new Map(outros.filter((o) => o.ordem != null).map((o) => [o.ordem, o.id]));
  const bossesEmUso = new Map(outros.filter((o) => o.bossFinal?.bossId).map((o) => [o.bossFinal.bossId, o.id]));
  return { huntExiste: (h) => hunts.has(h), bossExiste: (b) => bosses.has(b), huntsEmUso: emUso, bossesEmUso, ordensEmUso, ordemMinima: Campanha.ATOS + 1, atos: outros.map((o) => ({ id: o.id })), validarRecompensa: Recompensas.validar, avaliarEconomia };
}

/** Só a recompensa (para o painel dar o alerta na hora): estrutura, itens, chances, tetos e economia. */
export function validarRecompensa(rec, huntId = null) {
  if (rec == null) return [];
  const ctx = contexto(null);
  const erros = (ctx.validarRecompensa(rec, 'recompensa') ?? []).map((mensagem) => ({ nivel: 'erro', mensagem }));
  const ids = (rec.drops ?? []).map((d) => d?.id);
  for (const id of new Set(ids.filter((x, i) => ids.indexOf(x) !== i))) erros.push({ nivel: 'aviso', mensagem: `O item ${id} aparece mais de uma vez nos drops.` });
  for (const it of rec.primeiraConclusao?.itens ?? []) if (ids.includes(it?.id)) erros.push({ nivel: 'aviso', mensagem: `O item ${it.id} está nos drops e na primeira conclusão.` });
  return [...erros, ...avaliarEconomia(huntId, rec)];
}

/** Valida sem gravar. */
export function validar(bruto) {
  const ato = Modelo.normalizar(bruto);
  const problemas = Modelo.validarAto(ato, contexto(ato.id));
  return { ok: !Modelo.temErro(problemas), problemas };
}

/**
 * Grava um rascunho. Recusa: id de ato legado; estados `beta`/`publicado` (sem runtime ainda); id/forma inválidos (erros de ID e nome
 * bloqueiam; o resto — fases soltas, tipos sem suporte — pode ser salvo como rascunho e aparece na validação).
 */
export function salvar(bruto) {
  const ato = Modelo.normalizar(bruto);
  if (!Modelo.ID_VALIDO.test(ato.id)) return { ok: false, erros: ['ID do ato inválido (3 a 40: minúsculas, números, hífen).'] };
  if (Legado.ehLegado(ato.id)) return { ok: false, erros: ['Os atos legados são somente leitura: duplique para editar.'] };
  // Beta/publicado: o jogo executa este arquivo no próximo boot. Só com a validação limpa (a mesma que o servidor refaz ao carregar).
  if (['beta', 'publicado'].includes(ato.estado)) {
    const erros = Modelo.validarAto(ato, contexto(ato.id)).filter((p) => p.nivel === 'erro');
    if (erros.length) return { ok: false, erros: [`Não dá para pôr em ${ato.estado}: ${erros.length} erro(s) na validação.`, ...erros.slice(0, 8).map((e) => `[${e.onde}] ${e.mensagem}`)] };
  }
  const antes = existsSync(arquivo(ato.id)) ? Modelo.normalizar(JSON.parse(readFileSync(arquivo(ato.id), 'utf8'))) : null;
  if (antes) ato.versao = antes.versao + 1;
  mkdirSync(CAMINHOS.atos, { recursive: true });
  writeFileSync(arquivo(ato.id), `${JSON.stringify(ato, null, 2)}\n`);
  const v = validar(ato);
  return { ok: true, ato, valido: v.ok, problemas: v.problemas };
}

/** Cópia como rascunho novo (nunca altera o original). */
export function duplicar(idOrigem, novoId, novoNome = null) {
  const o = obter(idOrigem);
  if (!o) return { ok: false, erros: ['Ato de origem não encontrado.'] };
  if (obter(novoId)) return { ok: false, erros: [`Já existe um ato "${novoId}".`] };
  const { legado, ...resto } = o;
  return salvar({ ...structuredClone(resto), id: novoId, nome: novoNome ?? `${o.nome} (cópia)`, estado: 'rascunho', versao: 1 });
}

/** Só rascunhos salvos pelo editor podem ser excluídos (nunca os legados). */
export function excluir(id) {
  if (Legado.ehLegado(id)) return { ok: false, erros: ['Os atos legados não podem ser excluídos.'] };
  if (!existsSync(arquivo(id))) return { ok: false, erros: ['Ato não encontrado.'] };
  unlinkSync(arquivo(id));
  return { ok: true };
}

export const opcoes = () => ({ tiposDeFase: Object.entries(Modelo.TIPOS_DE_FASE).map(([id, t]) => ({ id, nome: t.nome, suportado: t.suportado, motivo: t.motivo ?? null })), estados: Modelo.ESTADOS });
