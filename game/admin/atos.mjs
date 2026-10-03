// O armazém dos ATOS do editor (rascunhos): um arquivo por ato em `gamedata/atos/<id>.json`. Os atos de hoje aparecem como `legado-N`,
// SÓ LEITURA (`systems/atos-legado.mjs`), e nunca são gravados aqui. Nada disto roda no jogo ainda: o runtime por grafo é a Etapa 6 —
// por isso, hoje, só se grava `rascunho` e `desativado`; `beta`/`publicado` são recusados com essa explicação.
// Funções puras; quem fala HTTP é `admin/conteudo-http.mjs` (prefixo trancado).
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CATALOGO } from '../systems/dados.mjs';
import * as Modelo from '../systems/atos-modelo.mjs';
import * as Legado from '../systems/atos-legado.mjs';

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

/** O que o validador consulta: cadastros reais + as hunts dos OUTROS atos (o progresso é por hunt: dois atos não podem dividir uma). */
export function contexto(idDoAto) {
  const hunts = HUNTS();
  const bosses = BOSSES();
  const outros = todos().filter((a) => a.id !== idDoAto);
  const emUso = new Map();
  for (const o of outros) for (const f of o.fases) if (f.huntId && !emUso.has(f.huntId)) emUso.set(f.huntId, o.id);
  return { huntExiste: (h) => hunts.has(h), bossExiste: (b) => bosses.has(b), huntsEmUso: emUso, atos: outros.map((o) => ({ id: o.id })) };
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
  if (['beta', 'publicado'].includes(ato.estado)) return { ok: false, erros: ['Beta e publicação ainda não existem: o runtime por grafo é a próxima etapa. Salve como rascunho.'] };
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
