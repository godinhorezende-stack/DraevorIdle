// O EDITOR DO ITEM POWER BASE por overrides: `gamedata/item-power.json` (fábrica) nunca é editado; o dono grava só o que MUDA (pesos, normalização, classificação, curva, alertas, regras
// de distribuição) em `gamedata/overrides/item-power.json`. Mesmo fluxo dos outros editores: propor (valida e mostra o impacto, sem gravar) → salvar (arquivo + versão anterior, com
// revisão) → publicar (commit + deploy manuais). Nada aqui altera um item, uma chance de drop ou o combate: é só um indicador de comparação dos atributos base.
import { ligado as itensPoeLigado } from '../systems/itens-poe/catalogo.mjs';
import { join } from 'node:path';
import * as IP from '../systems/item-power.mjs';
import * as P from '../systems/progressao.mjs';
import * as O from '../systems/overrides.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import { desenhoDoItem } from './biblioteca.mjs';
import { criarArquivoVersionado, revisaoDe, conferirRevisao } from './arquivo-versionado.mjs';
import * as Itens from './overrides-itens.mjs';

export const CAMINHOS = { arquivo: IP.ARQUIVO_DE_OVERRIDE, versoes: join(O.PASTA, '_versoes', 'item-power') };
const COMO_PUBLICAR = 'O arquivo gamedata/overrides/item-power.json foi gravado neste servidor e o Hot Reload local já o aplicou. Para valer na produção: faça commit e publique pelo deploy. O Item Power é só um indicador: não muda item, drop nem combate.';
const arq = () => criarArquivoVersionado({ caminhos: CAMINHOS, valorPadrao: () => ({ ativo: true }) });
export const lerOverride = () => { const d = arq().ler(); return d && typeof d === 'object' && !Array.isArray(d) ? { ativo: true, ...d } : { ativo: true }; };
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const nivelMaximo = () => P.nivelMaximo();

/** O que a tela precisa de uma vez (a configuração GRAVADA, a de fábrica e os números de apoio). */
export function obter() {
  const override = lerOverride();
  const efetiva = IP.efetiva(IP.ORIGINAL, override);
  const fichas = IP.fichasDoCatalogo(efetiva);
  return {
    original: IP.ORIGINAL, override, efetiva, revisao: revisaoDe(CAMINHOS.arquivo), versoes: arq().versoes(), validacao: IP.validarConfiguracao(efetiva, { nivelMaximo: nivelMaximo() }),
    slots: IP.SLOTS, rotulosDoSlot: IP.ROTULO_DO_SLOT, atributos: IP.ATRIBUTOS, rotulosDoAtributo: IP.ROTULO_DO_ATRIBUTO, nivelMaximo: nivelMaximo(), atos: P.atos(),
    resumo: IP.resumoPorCategoria(fichas), carga: { aplicado: IP.resultadoDaCarga.aplicado, erros: IP.resultadoDaCarga.erros },
    aviso: 'Item Power Base = indicador de comparação dos atributos base. Não é DPS, força real do personagem nem garantia de equilíbrio em combate.',
  };
}

/** Remove do override o que é igual à fábrica (só a diferença). Pura. */
export function minimizar(original, ov) {
  const saida = {};
  for (const k of IP.CAMPOS_DO_OVERRIDE) if (ov?.[k] !== undefined && !['pesos', 'normalizacao', 'limites', 'classificacao', 'alertas', 'curva'].includes(k)) saida[k] = ov[k];
  for (const bloco of ['pesos', 'normalizacao', 'limites', 'classificacao', 'alertas']) {
    const d = {};
    for (const [k, v] of Object.entries(ov?.[bloco] ?? {})) if (!igual(v, original[bloco]?.[k])) d[k] = v;
    if (Object.keys(d).length) saida[bloco] = d;
  }
  const curva = {};
  if (ov?.curva?.padrao && !igual(ov.curva.padrao, original.curva.padrao)) curva.padrao = ov.curva.padrao;
  const cats = {};
  for (const [c, pts] of Object.entries(ov?.curva?.categorias ?? {})) if (!igual(pts, original.curva.categorias?.[c])) cats[c] = pts;
  if (Object.keys(cats).length) curva.categorias = cats;
  if (Object.keys(curva).length) saida.curva = curva;
  if (ov?.versaoDaFormula === original.versaoDaFormula) delete saida.versaoDaFormula;
  if (ov?.regras && igual(ov.regras, original.regras)) delete saida.regras;
  if (ov?.ativo === false) saida.ativo = false;
  return saida;
}

const resumoDe = (fichas) => Object.fromEntries(['abaixo', 'adequado', 'acima', 'muito-acima', 'sem-poder', 'sem-level', 'sem-referencia'].map((c) => [c, fichas.filter((f) => f.situacao === c).length]));

/** Valida e mostra o que MUDARIA (sem gravar): erros, avisos, o override mínimo e o impacto nos itens (quem muda de situação). */
export function propor(ov) {
  if (!ov || typeof ov !== 'object' || Array.isArray(ov)) return { ok: false, erros: ['O override precisa ser um objeto.'], avisos: [] };
  const erros = [];
  for (const k of Object.keys(ov)) if (!IP.CAMPOS_DO_OVERRIDE.includes(k)) erros.push(`O campo "${k}" não existe (permitidos: ${IP.CAMPOS_DO_OVERRIDE.filter((c) => c !== '_nota').join(', ')}).`);
  const minimo = minimizar(IP.ORIGINAL, ov);
  const candidata = IP.efetiva(IP.ORIGINAL, { ...minimo, ativo: ov.ativo !== false });
  const v = IP.validarConfiguracao(candidata, { nivelMaximo: nivelMaximo() });
  const ok = !erros.length && !v.erros.length;
  const atual = IP.efetiva(IP.ORIGINAL, lerOverride());
  let impacto = null;
  if (ok) {
    const antes = IP.fichasDoCatalogo(atual); const depois = IP.fichasDoCatalogo(candidata);
    const porId = new Map(antes.map((f) => [f.id, f]));
    const mudaram = depois.filter((f) => porId.get(f.id)?.situacao !== f.situacao).map((f) => ({ id: f.id, nome: f.nome, slot: f.slot, de: porId.get(f.id).situacao, para: f.situacao, ipAntes: porId.get(f.id).ip, ipDepois: f.ip }));
    impacto = { antes: resumoDe(antes), depois: resumoDe(depois), mudaramDeSituacao: mudaram.length, exemplos: mudaram.slice(0, 40), versaoAntes: atual.versaoDaFormula, versaoDepois: candidata.versaoDaFormula };
  }
  return { ok, erros: [...erros, ...v.erros], avisos: v.avisos, override: minimo, impacto, comoPublicar: COMO_PUBLICAR };
}

function gravavel(ov) { return { _nota: 'Overrides do Item Power Base (systems/item-power.mjs): só o DIFERENTE sobre gamedata/item-power.json. Editado em /editor/conteudo (Item Power).', ...ov }; }
export function salvar(ov, revisao) {
  const conflito = conferirRevisao(revisao, CAMINHOS.arquivo);
  if (conflito) return conflito;
  const r = propor(ov);
  if (!r.ok) return { ok: false, erros: r.erros, avisos: r.avisos };
  arq().gravar(gravavel(r.override));
  return { ok: true, avisos: r.avisos, impacto: r.impacto, revisao: revisaoDe(CAMINHOS.arquivo), comoPublicar: COMO_PUBLICAR };
}
export function reverter(revisao) {
  const conflito = conferirRevisao(revisao, CAMINHOS.arquivo);
  if (conflito) return conflito;
  arq().gravar({ _nota: 'Sem diferenças: vale a configuração de fábrica (gamedata/item-power.json).', ativo: true });
  return { ok: true, revisao: revisaoDe(CAMINHOS.arquivo), comoPublicar: COMO_PUBLICAR };
}
export function restaurar(n, revisao) {
  const conflito = conferirRevisao(revisao, CAMINHOS.arquivo);
  if (conflito) return conflito;
  const r = arq().restaurar(n);
  return r.ok ? { ...r, revisao: revisaoDe(CAMINHOS.arquivo), comoPublicar: COMO_PUBLICAR } : r;
}
export const versoes = () => arq().versoes();

// ---------------------------------------------------------------- consultas (sobre a configuração EM USO ou uma candidata)
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const EDITAVEIS = ['name', 'minLevel', 'rarity', 'attack', 'defense', 'armor'];
const slim = (f, modificados = null) => ({ modificado: !!modificados?.[f.id], original: modificados?.[f.id] ? origem(f.id) : null, id: f.id, nome: f.nome, slot: f.slot, categoria: f.categoria, raridade: f.raridade, vocations: f.vocations, minLevel: f.minLevel, ip: f.ip, esperado: f.esperado, diferenca: f.diferenca, diferencaPct: f.diferencaPct, situacao: f.situacao, atributos: f.atributos, desenho: desenhoDoItem(ITEM_CATALOG[f.id]) });

/** Os valores ORIGINAIS (catálogo importado) de um item modificado, com o IP que ele teria. */
function origem(id) {
  const m = Itens.originalDe(id);
  const f = m ? IP.fichaDoMeta(m, IP.EM_USO) : null;
  return m ? { minLevel: m.minLevel ?? null, attack: m.attack ?? 0, defense: m.defense ?? 0, armor: m.armor ?? 0, nome: m.name, rarity: m.rarity ?? null, ip: f?.ip ?? null } : null;
}

/** A lista de itens com filtros (slot, classe, raridade, level, situação, nome/ID), ordenada e paginada. */
export function listarItens({ q = '', modificado = '', slot = '', classe = '', raridade = '', nivelMin = '', nivelMax = '', situacao = '', ordem = 'level', pagina = 0, limite = 60, incluirCraft = '' } = {}, cfg = IP.EM_USO) {
  const t = norm(q).trim();
  const modificadosIds = new Set(Object.entries(Itens.lerDados().itens).filter(([, ov]) => EDITAVEIS.some((k) => k in ov)).map(([id]) => id));
  // Com o PoE ligado, só os itens do PoE (decisão do dono, 05/10: "os itens só quero do PoE").
  const soPoe = itensPoeLigado();
  let l = IP.fichasDoCatalogo(cfg, { incluirCraft: incluirCraft === true || incluirCraft === 'true' || incluirCraft === '1' }).filter((f) => {
    if (soPoe && !ITEM_CATALOG[f.id]?.poe) return false;
    if (slot && f.slot !== slot) return false;
    if (classe && f.vocations.length && !f.vocations.includes(classe)) return false;
    if (raridade && f.raridade !== raridade) return false;
    if (nivelMin !== '' && (f.minLevel ?? -1) < Number(nivelMin)) return false;
    if (nivelMax !== '' && (f.minLevel ?? Infinity) > Number(nivelMax)) return false;
    if (situacao && f.situacao !== situacao) return false;
    if (modificado === '1' && !modificadosIds.has(String(f.id))) return false;
    if (t && !norm(f.nome).includes(t) && String(f.id) !== t) return false;
    return true;
  });
  const ordens = { level: (a, b) => (a.minLevel ?? 9999) - (b.minLevel ?? 9999) || b.ip - a.ip, ip: (a, b) => b.ip - a.ip, diferenca: (a, b) => (b.diferencaPct ?? -9) - (a.diferencaPct ?? -9), nome: (a, b) => a.nome.localeCompare(b.nome) };
  l = l.sort(ordens[ordem] ?? ordens.level);
  const lim = Math.min(200, Math.max(1, Number(limite) || 60)); const pag = Math.max(0, Number(pagina) || 0);
  const ovs = Itens.lerDados().itens;
  const modificados = Object.fromEntries(Object.entries(ovs).filter(([, ov]) => EDITAVEIS.some((k) => k in ov)).map(([id]) => [id, true]));
  return { total: l.length, pagina: pag, revisaoItens: revisaoDe(Itens.CAMINHOS.arquivo), modificados: Object.keys(modificados).length, itens: l.slice(pag * lim, pag * lim + lim).map((f) => slim(f, modificados)) };
}

/** O detalhamento de UM item (contribuição de cada atributo, esperado, classe). */
export function itemDetalhado(id, cfg = IP.EM_USO) {
  const f = IP.fichaDePoder(id, cfg);
  return f ? { ...slim(f), contribuicao: f.contribuicao } : null;
}

/** A curva de uma categoria: pontos, amostragem para o gráfico, saltos e a nuvem dos itens do catálogo (level × IP). */
export function curva(categoria, cfg = IP.EM_USO) {
  if (!IP.SLOTS.includes(categoria)) return { ok: false, erros: [`A categoria "${categoria}" não existe (use ${IP.SLOTS.join(', ')}).`] };
  const pontos = IP.pontosDaCurva(cfg, categoria);
  const itens = IP.fichasDoCatalogo(cfg, { incluirCraft: false }).filter((f) => f.slot === categoria && f.minLevel != null && f.ip > 0).map((f) => ({ id: f.id, nome: f.nome, level: f.minLevel, ip: f.ip, situacao: f.situacao }));
  return { ok: true, categoria, propria: !!cfg.curva.categorias?.[categoria], pontos, amostra: IP.amostrarCurva(cfg, categoria, { ate: nivelMaximo(), passo: 10 }), saltos: IP.saltosDaCurva(pontos, cfg.alertas), itens };
}

/** A SIMULAÇÃO: atributos digitados (ou de um item, com alterações) → IP, esperado e classe, sem gravar nada. `config` opcional = um override candidato (pesos novos). */
export function simular({ itemId = null, atributos = {}, slot = null, level = null, config = null } = {}) {
  let cfg = IP.EM_USO;
  if (config) {
    const p = propor(config);
    if (!p.ok) return { ok: false, erros: p.erros };
    cfg = IP.efetiva(IP.ORIGINAL, { ...p.override, ativo: true });
  }
  const base = itemId != null ? IP.atributosBase(itemId) : null;
  if (itemId != null && !base) return { ok: false, erros: [`O item ${itemId} não é um equipamento.`] };
  const meta = itemId != null ? ITEM_CATALOG[itemId] : null;
  const mesclados = { ...(base ?? {}), ...Object.fromEntries(Object.entries(atributos ?? {}).filter(([, v]) => v !== '' && v !== null && v !== undefined).map(([k, v]) => [k, Number(v)])) };
  const erros = IP.validarAtributos(mesclados);
  const sl = slot ?? meta?.slot ?? null;
  if (sl && !IP.SLOTS.includes(sl)) erros.push(`O slot "${sl}" não existe.`);
  if (erros.length) return { ok: false, erros };
  const r = IP.calcular(mesclados, cfg, sl);
  const lv = level != null && level !== '' ? Number(level) : meta?.minLevel ?? null;
  const exp = sl && lv ? IP.esperado(cfg, sl, lv) : null;
  const diffPct = exp ? Math.round(((r.ip - exp) / exp) * 10000) / 10000 : null;
  return { ok: true, ip: r.ip, contribuicao: r.contribuicao, level: lv, esperado: exp, diferenca: exp != null ? Math.round((r.ip - exp) * 1000) / 1000 : null, diferencaPct: diffPct, situacao: r.ip === 0 ? 'sem-poder' : diffPct == null ? 'sem-referencia' : IP.classeDaDiferenca(diffPct, cfg), atributosUsados: mesclados, aviso: 'Simulação: nada foi gravado e o item original não muda.' };
}
export const comparar = (ids, cfg = IP.EM_USO) => IP.compararItens((ids ?? []).map(Number), cfg);
