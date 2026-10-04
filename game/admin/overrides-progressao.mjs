// O EDITOR de PROGRESSÃO E LOOT por overrides: `gamedata/progressao.json` (fábrica) nunca é editado; o dono grava só as DIFERENÇAS em `gamedata/overrides/progressao.json`
// (`systems/progressao.mjs` aplica no boot e o Hot Reload re-aplica a quente). Mesmo fluxo dos outros editores: propor (valida + impacto, sem gravar) → salvar (arquivo + versão anterior,
// com controle de revisão) → publicar (commit + deploy). Reverter volta ao original. O IMPACTO compara as distribuições EXATAS (raridade, tiers, modificadores) antes e depois.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import * as P from '../systems/progressao.mjs';
import * as O from '../systems/overrides.mjs';
import * as S from '../systems/itens/simulador-de-loot.mjs';
import * as C from '../systems/itens/config.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import { criarArquivoVersionado, revisaoDe, conferirRevisao } from './arquivo-versionado.mjs';

export const CAMINHOS = { arquivo: P.ARQUIVO_DE_OVERRIDE, versoes: join(O.PASTA, '_versoes', 'progressao') };
const COMO_PUBLICAR = 'O arquivo gamedata/overrides/progressao.json foi gravado neste servidor e o Hot Reload local já o aplicou. Para valer na produção: faça commit e publique pelo deploy.';
const CHAVES_PERMITIDAS = new Set(['ativo', 'progressao', 'dificuldades', 'loot']);
const arq = () => criarArquivoVersionado({ caminhos: CAMINHOS, valorPadrao: () => ({ ativo: true }) });
/** O Ato de referência para o aviso de "dificuldade inferior mais vantajosa" (um Ato do meio da progressão). */
const ATO_DE_REFERENCIA = 5;

/** Remove do override o que é igual ao original (o arquivo guarda só a DIFERENÇA). Pura. */
export function minimizar(original, ov) {
  if (ov === undefined) return undefined;
  if (JSON.stringify(original) === JSON.stringify(ov)) return undefined;
  if (ov === null || typeof ov !== 'object' || Array.isArray(ov) || original === null || typeof original !== 'object' || Array.isArray(original)) return ov;
  const saida = {};
  for (const [k, v] of Object.entries(ov)) { const m = minimizar(original[k], v); if (m !== undefined) saida[k] = m; }
  return Object.keys(saida).length ? saida : undefined;
}

export const lerOverride = () => { const d = arq().ler(); return d && typeof d === 'object' && !Array.isArray(d) ? d : { ativo: true }; };

/** As distribuições EXATAS de todos os Atos × dificuldades de uma configuração efetiva (para a tela e o impacto). */
export function distribuicoes(config = P.EM_USO) {
  return config.progressao.atos.map((a) => ({ ato: a.ato, de: a.de, ate: a.ate, tiersDasBases: [...new Set([a.de, a.ate].map((l) => P.tierDaBaseCom(config.progressao.tier, l)))], estagioDeRaridade: config.progressao.estagioDeRaridade?.[String(a.ato)] ?? 1,
    dificuldades: Object.fromEntries(P.DIFICULDADES.map((d) => [d, S.resumoAnalitico({ ato: a.ato, dificuldade: d, config })])) }));
}

/** Valida uma configuração efetiva candidata (com o catálogo e o aviso de dificuldade inferior mais vantajosa). */
export const validarEfetiva = (candidata) => P.validarConfiguracao(candidata, { catalogo: ITEM_CATALOG, distribuicao: (d) => (candidata.progressao.atos.some((a) => a.ato === ATO_DE_REFERENCIA) ? S.distribuicaoDeRaridade({ ato: ATO_DE_REFERENCIA, dificuldade: d, config: candidata }) : null) });

/** O impacto: a diferença (depois − antes) das distribuições exatas por Ato × dificuldade; só entram os que mudaram. */
export function impacto(antes, depois) {
  const a = distribuicoes(antes); const d = distribuicoes(depois);
  const linhas = [];
  for (const [i, ato] of d.entries()) for (const dif of P.DIFICULDADES) {
    const x = a[i]?.dificuldades[dif]; const y = ato.dificuldades[dif];
    if (!x) { linhas.push({ ato: ato.ato, dificuldade: dif, novo: true }); continue; }
    const delta = { chanceDeDrop: y.chanceDeDrop - x.chanceDeDrop, raroOuMelhor: y.raroOuMelhor - x.raroOuMelhor, modificadoresPorItem: y.modificadoresPorItem - x.modificadoresPorItem, tierMedio: y.tierMedio - x.tierMedio, tierAlto: y.tierAlto - x.tierAlto };
    if (Object.values(delta).some((v) => Math.abs(v) > 1e-6)) linhas.push({ ato: ato.ato, dificuldade: dif, antes: { chanceDeDrop: x.chanceDeDrop, raroOuMelhor: x.raroOuMelhor, modificadoresPorItem: x.modificadoresPorItem, tierMedio: x.tierMedio, tierAlto: x.tierAlto }, depois: { chanceDeDrop: y.chanceDeDrop, raroOuMelhor: y.raroOuMelhor, modificadoresPorItem: y.modificadoresPorItem, tierMedio: y.tierMedio, tierAlto: y.tierAlto }, delta });
  }
  return linhas;
}

/** O que a tela precisa: original, override, efetivo, versões, perfis propostos (não aplicados), distribuições e a cobertura do catálogo por Ato. */
export function obter() {
  const ov = lerOverride();
  return {
    original: { progressao: P.ORIGINAL.progressao, dificuldades: P.ORIGINAL.dificuldades, loot: P.ORIGINAL.loot }, override: ov, efetivo: structuredClone(P.EM_USO),
    perfis: P.ORIGINAL.perfis ?? {}, tiersOriginais: C.TIERS.itemLevel, revisao: revisaoDe(CAMINHOS.arquivo), versoes: arq().versoes(), nivelMaximo: P.nivelMaximo(), carga: { aplicado: P.resultadoDaCarga.aplicado, erros: P.resultadoDaCarga.erros },
    distribuicoes: distribuicoes(), cobertura: P.EM_USO.progressao.atos.map((a) => { const b = P.basesDoAto(a.ato, { limite: 0 }); return { ato: a.ato, bases: b.total, porSlot: b.porSlot, porTier: b.porTier }; }),
    validacao: validarEfetiva(P.EM_USO),
  };
}

/** Valida e mostra o impacto SEM gravar. `ov` = o override proposto (o arquivo inteiro). */
export function propor(ov) {
  const erros = [];
  if (!ov || typeof ov !== 'object' || Array.isArray(ov)) return { ok: false, erros: ['O override precisa ser um objeto.'], avisos: [], impacto: [] };
  for (const k of Object.keys(ov)) if (!CHAVES_PERMITIDAS.has(k)) erros.push(`O campo "${k}" não existe (permitidos: ${[...CHAVES_PERMITIDAS].join(', ')}).`);
  const minimo = { ...ov };
  for (const k of ['progressao', 'dificuldades', 'loot']) if (ov[k] !== undefined) { const m = minimizar(P.ORIGINAL[k], ov[k]); if (m === undefined) delete minimo[k]; else minimo[k] = m; }
  const candidata = P.efetiva(P.ORIGINAL, { ...minimo, ativo: ov.ativo !== false });
  const v = validarEfetiva(candidata);
  const salvoNoDisco = P.efetiva(P.ORIGINAL, lerOverride());
  return { ok: !erros.length && !v.erros.length, erros: [...erros, ...v.erros], avisos: v.avisos, override: minimo, distribuicoes: v.erros.length ? null : distribuicoes(candidata), impacto: v.erros.length ? [] : impacto(salvoNoDisco, candidata), modifica: Object.keys(minimo).filter((k) => k !== 'ativo'), comoPublicar: COMO_PUBLICAR };
}

export function salvar(ov, revisao) {
  const conflito = conferirRevisao(revisao, CAMINHOS.arquivo);
  if (conflito) return conflito;
  const r = propor(ov);
  if (!r.ok) return { ok: false, erros: r.erros, avisos: r.avisos };
  arq().gravar({ _nota: 'Overrides de progressão e loot por dificuldade (systems/progressao.mjs): só as DIFERENÇAS sobre gamedata/progressao.json. Apagar uma chave devolve o original. Editado em /editor/conteudo (Progressão e loot).', ...r.override, ativo: ov.ativo !== false });
  return { ok: true, avisos: r.avisos, impacto: r.impacto, revisao: revisaoDe(CAMINHOS.arquivo), comoPublicar: COMO_PUBLICAR };
}
export function reverter(revisao) {
  const conflito = conferirRevisao(revisao, CAMINHOS.arquivo);
  if (conflito) return conflito;
  if (!existsSync(CAMINHOS.arquivo)) return { ok: false, erros: ['Não há override para reverter.'] };
  arq().gravar({ _nota: 'Sem diferenças: vale o original (gamedata/progressao.json).', ativo: true });
  return { ok: true, revisao: revisaoDe(CAMINHOS.arquivo), comoPublicar: COMO_PUBLICAR };
}
export function definirAtivo(ativo, revisao) {
  const conflito = conferirRevisao(revisao, CAMINHOS.arquivo);
  if (conflito) return conflito;
  const atual = lerOverride();
  arq().gravar({ ...atual, ativo: !!ativo });
  return { ok: true, revisao: revisaoDe(CAMINHOS.arquivo), comoPublicar: COMO_PUBLICAR };
}
export function restaurar(n, revisao) {
  const conflito = conferirRevisao(revisao, CAMINHOS.arquivo);
  if (conflito) return conflito;
  const r = arq().restaurar(n);
  return r.ok ? { ...r, revisao: revisaoDe(CAMINHOS.arquivo), comoPublicar: COMO_PUBLICAR } : r;
}
export const versoes = () => arq().versoes();
export { readFileSync };

/** Os presentes de marco (sets por vocação e level) que caem na faixa de um Ato — o "grupo de sets" que a progressão compartilha entre as dificuldades. */
export function marcosDoAto(ato) {
  const f = P.faixaDoAto(ato);
  if (!f) return null;
  const arquivo = join(P.RAIZ_DOS_DADOS, 'sets-de-marco.json');
  const marcos = existsSync(arquivo) ? JSON.parse(readFileSync(arquivo, 'utf8')).vocacoes ?? {} : {};
  const lista = [];
  for (const [vocacao, porLevel] of Object.entries(marcos)) for (const [level, pecas] of Object.entries(porLevel)) if (Number(level) >= f.de && Number(level) <= f.ate) lista.push({ vocacao, level: Number(level), pecas: pecas.map(([id, nome]) => ({ id, nome })) });
  return lista.sort((a, b) => a.level - b.level || a.vocacao.localeCompare(b.vocacao));
}

/** A configuração efetiva que um override (o arquivo inteiro) produziria, ou `null` se for inválida. */
export function candidataDe(ov) {
  if (!ov || typeof ov !== 'object' || Array.isArray(ov)) return null;
  const c = P.efetiva(P.ORIGINAL, { ...ov, ativo: ov.ativo !== false });
  return validarEfetiva(c).erros.length ? null : c;
}
