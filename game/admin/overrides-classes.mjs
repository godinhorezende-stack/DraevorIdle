// O EDITOR DE CLASSES por overrides: `gamedata/classes.json` + `atributos-principais.json` + `classes-meta.json` (fábrica) nunca são editados; o dono grava só o que MUDA em `gamedata/overrides/classes.json`
// (`systems/classes.mjs` aplica no boot e o Hot Reload re-aplica). Mesmo fluxo dos outros editores: propor (valida, sem gravar) → salvar (arquivo + versão anterior, com revisão) → aprovar versão/Git/merge/deploy
// manuais. Apagar uma classe com personagens exige MIGRAÇÃO explícita (`migrar`, que mexe no banco). As contagens de personagens entram por parâmetro (o banco é assíncrono: a rota as busca).
import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import * as Classes from '../systems/classes.mjs';
import * as O from '../systems/overrides.mjs';
import { criarArquivoVersionado, revisaoDe, conferirRevisao } from './arquivo-versionado.mjs';

export const CAMINHOS = { arquivo: Classes.ARQUIVO_DE_OVERRIDE, versoes: join(O.PASTA, '_versoes', 'classes') };
const COMO_PUBLICAR = 'O arquivo gamedata/overrides/classes.json foi gravado neste servidor e o Hot Reload local já o aplicou (personagens já online usam os atributos novos no próximo cálculo). Para valer na produção: aprove a versão, faça commit e publique pelo deploy.';
const arq = () => criarArquivoVersionado({ caminhos: CAMINHOS, valorPadrao: () => ({ ativo: true, classes: {}, efeitos: {} }) });
export const lerOverride = () => { const d = arq().ler(); return d && typeof d === 'object' && !Array.isArray(d) ? { ativo: true, classes: {}, efeitos: {}, ...d } : { ativo: true, classes: {}, efeitos: {} }; };
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const CAMPOS_DA_CLASSE = ['nome', 'descricao', 'icone', 'cor', 'ativo', 'atributosIniciais', 'porLevel', 'vocacaoBase', 'outfit'];

/** Uma classe com o que a tela precisa (contagem de personagens e a prévia dos efeitos dos atributos iniciais). */
function paraTela(c, efeitos, contagens) {
  return { ...c, personagens: contagens?.[c.id] ?? 0, previaDosIniciais: Classes.previaDeEfeitos(efeitos, c.atributosIniciais) };
}

/** O que a tela precisa de uma vez (a configuração GRAVADA, a de fábrica e os números de apoio). */
export function obter(contagens = null) {
  const override = lerOverride();
  const ef = Classes.efetivo(Classes.ORIGINAL, override);
  return {
    original: { classes: Classes.ORIGINAL.classes, efeitos: Classes.ORIGINAL.efeitos }, override, revisao: revisaoDe(CAMINHOS.arquivo), versoes: arq().versoes(),
    classes: Object.values(ef.classes).map((c) => paraTela(c, ef.efeitos, contagens)), efeitos: ef.efeitos, definicaoDosEfeitos: Classes.EFEITOS, perfilSugerido: Classes.ORIGINAL.perfilSugerido,
    validacao: Classes.validarConfiguracao(ef), vocacoes: Classes.VOCACOES, carga: { aplicado: Classes.resultadoDaCarga.aplicado, erros: Classes.resultadoDaCarga.erros },
    totalDePersonagens: contagens ? Object.values(contagens).reduce((a, b) => a + b, 0) : null,
  };
}

/** Remove do override o que é igual à fábrica (só a diferença). Pura. */
export function minimizar(original, ov) {
  const saida = { ativo: ov?.ativo !== false, classes: {}, efeitos: {} };
  for (const [id, c] of Object.entries(ov?.classes ?? {})) {
    const base = original.classes[id];
    if (c === null || c?.excluido === true) { if (!base) continue; saida.classes[id] = { excluido: true }; continue; }
    if (!base) { saida.classes[id] = Object.fromEntries(Object.entries(c).filter(([k]) => CAMPOS_DA_CLASSE.includes(k))); continue; }
    const dif = {};
    for (const k of CAMPOS_DA_CLASSE) {
      if (c[k] === undefined || k === 'vocacaoBase') continue;
      if (k === 'atributosIniciais' || k === 'porLevel') { const d = Object.fromEntries(Object.entries(c[k] ?? {}).filter(([a, v]) => !igual(v, base[k][a]))); if (Object.keys(d).length) dif[k] = d; }
      else if (!igual(c[k], base[k])) dif[k] = c[k];
    }
    if (Object.keys(dif).length) saida.classes[id] = dif;
  }
  for (const [k, v] of Object.entries(ov?.efeitos ?? {})) if (!igual(v, original.efeitos[k])) saida.efeitos[k] = v;
  return saida;
}

/** Valida e mostra o que MUDARIA (sem gravar). `contagens`: `{ classe: personagens }` — apagar classe com personagens é recusado (use a migração). */
export function propor(ov, { contagens = null } = {}) {
  if (!ov || typeof ov !== 'object' || Array.isArray(ov)) return { ok: false, erros: ['O override precisa ser um objeto.'], avisos: [] };
  const erros = [];
  for (const k of Object.keys(ov)) if (!['ativo', 'classes', 'efeitos', '_nota'].includes(k)) erros.push(`O campo "${k}" não existe (permitidos: ativo, classes, efeitos).`);
  if (ov.classes != null && (typeof ov.classes !== 'object' || Array.isArray(ov.classes))) return { ok: false, erros: ['"classes" precisa ser um objeto { id: classe }.'], avisos: [] };
  for (const [id, c] of Object.entries(ov.classes ?? {})) {
    if (c !== null && (typeof c !== 'object' || Array.isArray(c))) { erros.push(`classe ${id}: precisa ser um objeto.`); continue; }
    // `poe` (a classe do PoE de onde a de fábrica vem) é derivado como `id`/`builtin`: a tela devolve junto, nada disso se grava.
    for (const k of Object.keys(c ?? {})) if (!['excluido', ...CAMPOS_DA_CLASSE, 'id', 'builtin', 'poe', 'personagens', 'previaDosIniciais'].includes(k)) erros.push(`classe ${id}: o campo "${k}" não existe.`);
  }
  // campos derivados que a tela devolve junto não fazem parte do que se grava
  const limpos = Object.fromEntries(Object.entries(ov.classes ?? {}).map(([id, c]) => [id, c && typeof c === 'object' && !Array.isArray(c) ? Object.fromEntries(Object.entries(c).filter(([k]) => !['id', 'builtin', 'poe', 'personagens', 'previaDosIniciais'].includes(k))) : c]));
  const minimo = minimizar(Classes.ORIGINAL, { ...ov, classes: limpos });
  const candidata = Classes.efetivo(Classes.ORIGINAL, { ...minimo, ativo: ov.ativo !== false });
  const v = Classes.validarConfiguracao(candidata);
  const salva = Classes.efetivo(Classes.ORIGINAL, lerOverride());
  const ocupadas = [];
  for (const id of Object.keys(salva.classes)) if (!candidata.classes[id] && (contagens?.[id] ?? 0) > 0) ocupadas.push(`classe ${id}: ${contagens[id]} personagem(ns) ainda usam esta classe — migre-os para outra classe antes de apagar.`);
  const avisos = [...v.avisos];
  for (const id of Object.keys(candidata.classes)) if (candidata.classes[id].ativo === false && (contagens?.[id] ?? 0) > 0) avisos.push(`classe ${id}: ${contagens[id]} personagem(ns) já existem nela; desativar só impede NOVOS personagens (os atuais continuam jogando).`);
  const ids = new Set([...Object.keys(salva.classes), ...Object.keys(candidata.classes)]);
  const impacto = [...ids].map((id) => (!salva.classes[id] ? { id, mudanca: 'nova' } : !candidata.classes[id] ? { id, mudanca: 'removida' } : !igual(salva.classes[id], candidata.classes[id]) ? { id, mudanca: 'alterada' } : null)).filter(Boolean);
  const efeitosAlterados = Object.keys(candidata.efeitos).filter((k) => candidata.efeitos[k] !== salva.efeitos[k]).map((k) => ({ chave: k, de: salva.efeitos[k], para: candidata.efeitos[k] }));
  return { ok: !erros.length && !v.erros.length && !ocupadas.length, erros: [...erros, ...v.erros, ...ocupadas], avisos, override: minimo, impacto, efeitosAlterados, classes: v.erros.length ? null : Object.values(candidata.classes).map((c) => paraTela(c, candidata.efeitos, contagens)), comoPublicar: COMO_PUBLICAR };
}

export function salvar(ov, revisao, opcoes = {}) {
  const conflito = conferirRevisao(revisao, CAMINHOS.arquivo);
  if (conflito) return conflito;
  const r = propor(ov, opcoes);
  if (!r.ok) return { ok: false, erros: r.erros, avisos: r.avisos };
  arq().gravar({ _nota: 'Overrides de classes (systems/classes.mjs): só o NOVO ou DIFERENTE sobre classes.json, atributos-principais.json e classes-meta.json. Editado em /editor/conteudo (Classes).', ativo: ov.ativo !== false, classes: r.override.classes, efeitos: r.override.efeitos });
  return { ok: true, avisos: r.avisos, impacto: r.impacto, revisao: revisaoDe(CAMINHOS.arquivo), comoPublicar: COMO_PUBLICAR };
}
/** Descarta TODAS as alterações locais (volta à fábrica). */
export function reverter(revisao) {
  const conflito = conferirRevisao(revisao, CAMINHOS.arquivo);
  if (conflito) return conflito;
  if (!existsSync(CAMINHOS.arquivo)) return { ok: false, erros: ['Não há override para reverter.'] };
  arq().gravar({ _nota: 'Sem diferenças: valem as classes de fábrica.', ativo: true, classes: {}, efeitos: {} });
  return { ok: true, revisao: revisaoDe(CAMINHOS.arquivo), comoPublicar: COMO_PUBLICAR };
}
export function restaurar(n, revisao) {
  const conflito = conferirRevisao(revisao, CAMINHOS.arquivo);
  if (conflito) return conflito;
  const r = arq().restaurar(n);
  return r.ok ? { ...r, revisao: revisaoDe(CAMINHOS.arquivo), comoPublicar: COMO_PUBLICAR } : r;
}
export const versoes = () => arq().versoes();

/** Compara a configuração de uma versão anterior (`de`) com a atual (ou outra versão): classes e efeitos que mudaram, campo a campo. */
export function comparar(de, para = 'atual') {
  const ler = (ref) => {
    if (ref === 'atual') return lerOverride();
    const a = join(CAMINHOS.versoes, `${Number(ref)}.json`);
    return Number.isInteger(Number(ref)) && existsSync(a) ? JSON.parse(readFileSync(a, 'utf8')) : null;
  };
  const A = ler(de); const B = ler(para);
  if (!A || !B) return { ok: false, erros: ['Versão não encontrada.'] };
  const ea = Classes.efetivo(Classes.ORIGINAL, A); const eb = Classes.efetivo(Classes.ORIGINAL, B);
  const mudancas = [];
  for (const id of new Set([...Object.keys(ea.classes), ...Object.keys(eb.classes)])) {
    const x = ea.classes[id]; const y = eb.classes[id];
    if (!x || !y) { mudancas.push({ classe: id, campo: '(classe)', de: x ? 'existia' : null, para: y ? 'existe' : null }); continue; }
    for (const k of ['nome', 'descricao', 'icone', 'cor', 'ativo']) if (!igual(x[k], y[k])) mudancas.push({ classe: id, campo: k, de: x[k], para: y[k] });
    for (const g of ['atributosIniciais', 'porLevel']) for (const a of Classes.ATRIBUTOS) if (x[g][a] !== y[g][a]) mudancas.push({ classe: id, campo: `${g}.${a}`, de: x[g][a], para: y[g][a] });
  }
  for (const k of Object.keys(Classes.EFEITOS)) if (ea.efeitos[k] !== eb.efeitos[k]) mudancas.push({ classe: null, campo: k, de: ea.efeitos[k], para: eb.efeitos[k] });
  return { ok: true, de, para, total: mudancas.length, mudancas };
}
