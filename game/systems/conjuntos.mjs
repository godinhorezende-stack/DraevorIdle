// CONJUNTOS (sets de equipamento) — dados, validação e consultas. Uma ferramenta de DESENVOLVIMENTO E BALANCEAMENTO da Engine: um conjunto é uma lista de bases de equipamento (uma por
// slot) de uma classe, organizada por Ato, tier e faixa de level. NÃO é mecânica de jogo: não dá bônus de conjunto, não muda o drop nem o combate. Cada peça é só uma REFERÊNCIA ao item
// do catálogo (com os overrides de itens já aplicados): nenhum atributo é copiado, então o que se edita no item aparece no conjunto.
//
// Dados: `gamedata/conjuntos.json` (fábrica, nunca editada) + `gamedata/overrides/conjuntos.json` (só o novo/diferente; `{ ativo, conjuntos: { id: {campos} | { excluido: true } } }`).
// Os Atos, a regra de tier e o level máximo vêm de `progressao.mjs` (configuráveis: nada fixo aqui). Os slots usam os ids do catálogo (`feet` = botas, `neck` = amuleto).
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ITEM_CATALOG } from './dados.mjs';
import { PASTA as PASTA_DE_OVERRIDES } from './overrides.mjs';
import * as P from './progressao.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', 'gamedata');
const lerJson = (c) => JSON.parse(readFileSync(c, 'utf8'));
export const ORIGINAL = lerJson(join(RAIZ, 'conjuntos.json'));
export const ARQUIVO_DE_OVERRIDE = join(PASTA_DE_OVERRIDES, 'conjuntos.json');
export const SLOTS = ORIGINAL.regras.slots;
export const ROTULO_DO_SLOT = { head: 'Cabeça', body: 'Corpo', legs: 'Pernas', feet: 'Botas', weapon: 'Arma', shield: 'Escudo', ring: 'Anel', neck: 'Amuleto' };
/** As classes do jogo (as de `classes.json`, sem "none"): nenhuma é criada aqui. */
export const CLASSES = Object.keys(lerJson(join(RAIZ, 'classes.json')).classes).filter((c) => c !== 'none');
export const FORMATO_DO_ID = /^[a-z0-9][a-z0-9_-]{2,59}$/;
const CAMPOS = new Set(['origem', 'id', 'nome', 'classe', 'ato', 'tier', 'levelMin', 'levelMax', 'levelRecomendado', 'descricao', 'ativo', 'completo', 'pecas']);
const eInt = Number.isInteger;

// ---------------------------------------------------------------- consultas puras sobre o catálogo
const ehEquipamento = (m) => !!m?.slot && SLOTS.includes(m.slot) && !m.stackable;
const ehCraft = (m) => /^Crafted /.test(m?.name ?? '');
/** A escolha de escudo que ocupa a mão (a aljava usa o slot do escudo, mas é do arco: não conta). */
const ocupaAMao = (m) => !!m && m.slot === 'shield' && !m.quiver;

/** A ficha de um item para a tela: nome, slot, level mínimo, tier da base, classes, atributos principais (do catálogo EFETIVO, com overrides). `null` se o item não existe. */
export function fichaDoItem(itemId, catalogo = ITEM_CATALOG, prog = P.EM_USO.progressao) {
  const m = catalogo[itemId];
  if (!m) return null;
  const level = m.minLevel ?? 0;
  const atributos = {};
  for (const k of ['attack', 'defense', 'armor', 'extraDefense', 'weight']) if (m[k] != null && m[k] !== 0) atributos[k] = m[k];
  if (m.element) atributos.element = m.element;
  return { id: Number(m.id), nome: m.name, slot: m.slot ?? null, minLevel: level, tier: P.tierDaBaseCom(prog.tier, Math.max(1, level)), vocations: m.vocations ?? [], duasMaos: !!m.twoHanded, aljava: !!m.quiver, craft: ehCraft(m), atributos };
}

// ---------------------------------------------------------------- validação
/**
 * Valida UM conjunto. `ctx`: `{ catalogo, classes, prog (progressao), nivelMaximo }`. Devolve `{ erros, avisos }`: erro = estrutural, impede salvar;
 * aviso = planejamento (item acima da faixa, conjunto incompleto, faixa fora do Ato…): conjuntos incompletos podem ser salvos.
 */
export function validarConjunto(c, ctx) {
  const erros = [];
  const avisos = [];
  const onde = `conjunto ${c?.id ?? '?'}`;
  if (!c || typeof c !== 'object' || Array.isArray(c)) return { erros: [`${onde}: precisa ser um objeto.`], avisos };
  for (const k of Object.keys(c)) if (!CAMPOS.has(k)) erros.push(`${onde}: o campo "${k}" não existe (permitidos: ${[...CAMPOS].join(', ')}).`);
  if (!FORMATO_DO_ID.test(String(c.id ?? ''))) erros.push(`${onde}: o ID precisa ter 3 a 60 caracteres (minúsculas, números, hífen e sublinhado).`);
  if (!(typeof c.nome === 'string' && c.nome.trim().length >= 1 && c.nome.length <= 80)) erros.push(`${onde}: o nome precisa ter de 1 a 80 caracteres.`);
  if (!ctx.classes.includes(c.classe)) erros.push(`${onde}: a classe "${c.classe}" não existe (use ${ctx.classes.join(', ')}).`);
  const atoCfg = ctx.prog.atos.find((a) => a.ato === c.ato);
  if (!eInt(c.ato) || !atoCfg) erros.push(`${onde}: o Ato ${c.ato} não existe (há ${ctx.prog.atos.length} Atos na progressão).`);
  const tierMax = P.tierDaBaseCom(ctx.prog.tier, ctx.nivelMaximo);
  if (!eInt(c.tier) || c.tier < 1 || c.tier > tierMax) erros.push(`${onde}: o tier ${c.tier} é inválido (de 1 a ${tierMax}).`);
  const niveisOk = eInt(c.levelMin) && eInt(c.levelMax) && c.levelMin >= 1 && c.levelMax >= 1;
  if (!niveisOk) erros.push(`${onde}: levelMin e levelMax precisam ser inteiros a partir de 1.`);
  else {
    if (c.levelMin > c.levelMax) erros.push(`${onde}: o level mínimo (${c.levelMin}) é maior que o máximo (${c.levelMax}).`);
    if (c.levelMax > ctx.nivelMaximo) erros.push(`${onde}: o level máximo ${c.levelMax} passa do limite configurado (${ctx.nivelMaximo}).`);
    if (c.levelRecomendado != null && (!eInt(c.levelRecomendado) || c.levelRecomendado < c.levelMin || c.levelRecomendado > c.levelMax)) avisos.push(`${onde}: o level recomendado (${c.levelRecomendado}) está fora da faixa ${c.levelMin}–${c.levelMax}.`);
    if (atoCfg && (c.levelMax < atoCfg.de || c.levelMin > atoCfg.ate)) avisos.push(`${onde}: a faixa ${c.levelMin}–${c.levelMax} não toca o Ato ${c.ato} (levels ${atoCfg.de}–${atoCfg.ate}).`);
    else if (atoCfg && (c.levelMin < atoCfg.de || c.levelMax > atoCfg.ate)) avisos.push(`${onde}: a faixa ${c.levelMin}–${c.levelMax} passa dos limites do Ato ${c.ato} (${atoCfg.de}–${atoCfg.ate}).`);
    if (atoCfg && eInt(c.tier)) { const tiers = P.tiersDoAtoCom(ctx.prog.tier, atoCfg); if (!tiers.includes(c.tier)) avisos.push(`${onde}: o tier T${c.tier} não é um dos tiers do Ato ${c.ato} (${tiers.map((t) => `T${t}`).join('–')}).`); }
  }
  if (c.ativo !== undefined && typeof c.ativo !== 'boolean') erros.push(`${onde}: "ativo" precisa ser verdadeiro ou falso.`);
  if (c.completo !== undefined && typeof c.completo !== 'boolean') erros.push(`${onde}: "completo" precisa ser verdadeiro ou falso.`);
  const pecas = c.pecas ?? {};
  if (typeof pecas !== 'object' || Array.isArray(pecas)) { erros.push(`${onde}: "pecas" precisa ser um objeto { slot: id do item }.`); return { erros, avisos }; }
  for (const [slot, id] of Object.entries(pecas)) {
    if (!SLOTS.includes(slot)) { erros.push(`${onde}: o slot "${slot}" não existe (use ${SLOTS.join(', ')}).`); continue; }
    if (id == null) continue; // slot vazio
    const m = ctx.catalogo[id];
    const rot = ROTULO_DO_SLOT[slot];
    if (!m) { erros.push(`${onde}: ${rot} — o item ${id} não existe no catálogo.`); continue; }
    if (m.slot !== slot || m.stackable) erros.push(`${onde}: ${rot} — "${m.name}" (#${id}) é do slot ${m.slot ?? 'nenhum'}, não cabe em ${slot}.`);
    if (m.vocations?.length && ctx.classes.includes(c.classe) && !m.vocations.includes(c.classe)) erros.push(`${onde}: ${rot} — "${m.name}" é restrito a ${m.vocations.join('/')} e o conjunto é de ${c.classe}.`);
    if (niveisOk && (m.minLevel ?? 0) > c.levelMax) avisos.push(`${onde}: ${rot} — "${m.name}" exige level ${m.minLevel}, acima da faixa do conjunto (até ${c.levelMax}).`);
    if (ehCraft(m)) avisos.push(`${onde}: ${rot} — "${m.name}" é peça de craft (só sai da forja).`);
    if ((m.minLevel ?? 0) > ctx.nivelMaximo) avisos.push(`${onde}: ${rot} — "${m.name}" exige level ${m.minLevel}, acima do máximo de equipamento (${ctx.nivelMaximo}).`);
  }
  const arma = pecas.weapon != null ? ctx.catalogo[pecas.weapon] : null;
  const escudo = pecas.shield != null ? ctx.catalogo[pecas.shield] : null;
  if (arma?.twoHanded && ocupaAMao(escudo)) erros.push(`${onde}: "${arma.name}" é de duas mãos e não combina com o escudo "${escudo.name}" (um tira o outro no jogo).`);
  const faltam = [];
  for (const slot of ORIGINAL.regras.obrigatoriosSeCompleto) if (pecas[slot] == null) faltam.push(slot);
  if (pecas.shield == null && !arma?.twoHanded) faltam.push('shield');
  const vazios = SLOTS.filter((s) => pecas[s] == null);
  if (c.completo === true && faltam.length) erros.push(`${onde}: está marcado como completo, mas faltam: ${faltam.map((s) => ROTULO_DO_SLOT[s]).join(', ')}.`);
  else if (c.completo !== true && faltam.length) avisos.push(`${onde}: incompleto (${SLOTS.length - vazios.length}/${SLOTS.length} slots; faltam ${faltam.map((s) => ROTULO_DO_SLOT[s]).join(', ')}).`);
  return { erros, avisos };
}

/** Valida o conjunto inteiro de conjuntos (cada um + repetições de item entre conjuntos e lacunas de cobertura por classe). Pura. */
export function validarTodos(mapa, ctx, { planejamento = ORIGINAL.planejamento } = {}) {
  const erros = [];
  const avisos = [];
  for (const [id, c] of Object.entries(mapa)) {
    if (c?.id !== id) erros.push(`conjunto ${id}: o ID dentro do conjunto (${c?.id}) não bate com a chave.`);
    const r = validarConjunto(c, ctx);
    erros.push(...r.erros); avisos.push(...r.avisos);
  }
  const ativos = Object.values(mapa).filter((c) => c.ativo !== false);
  const usos = new Map();
  for (const c of ativos) for (const [slot, id] of Object.entries(c.pecas ?? {})) if (id != null) { const k = `${slot}:${id}`; usos.set(k, [...(usos.get(k) ?? []), c.id]); }
  for (const [k, ids] of usos) if (ids.length > 1) { const [slot, id] = k.split(':'); avisos.push(`o item ${ctx.catalogo[id]?.name ?? id} (#${id}, ${ROTULO_DO_SLOT[slot]}) se repete nos conjuntos ${ids.join(', ')}.`); }
  for (const classe of ctx.classes) {
    const lacunas = lacunasDaClasse(ativos.filter((c) => c.classe === classe), planejamento);
    if (lacunas.length) avisos.push(`${classe}: faixas do planejamento (${planejamento.de}–${planejamento.ate}) sem nenhum conjunto ativo: ${lacunas.map(([a, b]) => `${a}–${b}`).join(', ')}.`);
  }
  return { erros, avisos };
}

/** As faixas de level de [de, ate] que nenhum dos conjuntos cobre. Pura. */
export function lacunasDaClasse(conjuntos, { de, ate }) {
  const faixas = conjuntos.filter((c) => eInt(c.levelMin) && eInt(c.levelMax)).map((c) => [c.levelMin, c.levelMax]).sort((a, b) => a[0] - b[0]);
  const lacunas = [];
  let proximo = de;
  for (const [a, b] of faixas) { if (a > proximo) lacunas.push([proximo, Math.min(a - 1, ate)]); proximo = Math.max(proximo, b + 1); if (proximo > ate) break; }
  if (proximo <= ate) lacunas.push([proximo, ate]);
  return lacunas.filter(([a, b]) => a <= b);
}

/** O painel de progressão: por classe e por Ato, as linhas da tabela e os indicadores. Pura. */
export function painel(mapa, ctx, { planejamento = ORIGINAL.planejamento } = {}) {
  const lista = Object.values(mapa);
  const linhas = lista.map((c) => {
    const pecas = c.pecas ?? {};
    const preenchidos = SLOTS.filter((s) => pecas[s] != null).length;
    const r = validarConjunto(c, ctx);
    const faltam = SLOTS.filter((s) => pecas[s] == null);
    return { id: c.id, nome: c.nome, classe: c.classe, ato: c.ato, tier: c.tier, levelMin: c.levelMin, levelMax: c.levelMax, ativo: c.ativo !== false, completo: !!c.completo, preenchidos, total: SLOTS.length,
      status: r.erros.length ? 'erro' : c.ativo === false ? 'inativo' : faltam.length && c.completo !== true && (faltam.length > 1 || faltam[0] !== 'shield' || !ctx.catalogo[pecas.weapon]?.twoHanded) ? 'incompleto' : r.avisos.length ? 'aviso' : 'valido', erros: r.erros.length, avisos: r.avisos.length, origem: c.origem ?? 'novo' };
  });
  const porClasse = Object.fromEntries(ctx.classes.map((cl) => [cl, { conjuntos: linhas.filter((l) => l.classe === cl).length, ativos: linhas.filter((l) => l.classe === cl && l.ativo).length, lacunas: lacunasDaClasse(lista.filter((c) => c.classe === cl && c.ativo !== false), planejamento) }]));
  const porAto = Object.fromEntries(ctx.prog.atos.map((a) => [a.ato, linhas.filter((l) => l.ato === a.ato).length]));
  const repetidos = []; const usos = new Map();
  for (const c of lista.filter((x) => x.ativo !== false)) for (const [slot, id] of Object.entries(c.pecas ?? {})) if (id != null) usos.set(`${slot}:${id}`, [...(usos.get(`${slot}:${id}`) ?? []), c.id]);
  for (const [k, ids] of usos) if (ids.length > 1) { const [slot, id] = k.split(':'); repetidos.push({ slot, item: Number(id), nome: ctx.catalogo[id]?.name ?? null, conjuntos: ids }); }
  const foraDaFaixa = [];
  for (const c of lista) for (const [slot, id] of Object.entries(c.pecas ?? {})) { const m = id != null ? ctx.catalogo[id] : null; if (m && eInt(c.levelMax) && (m.minLevel ?? 0) > c.levelMax) foraDaFaixa.push({ conjunto: c.id, slot, item: Number(id), nome: m.name, minLevel: m.minLevel }); }
  const slotsPreenchidos = linhas.reduce((s, l) => s + l.preenchidos, 0);
  return { linhas, porClasse, porAto, repetidos, foraDaFaixa, slots: { preenchidos: slotsPreenchidos, vazios: linhas.length * SLOTS.length - slotsPreenchidos }, incompletos: linhas.filter((l) => l.status === 'incompleto').length, planejamento };
}

/**
 * MODELOS INICIAIS (só quando o dono pede): `por` conjuntos por classe, repartindo [de, ate] em faixas iguais, com Ato e tier da progressão e os slots VAZIOS. Devolve os conjuntos
 * (inativos e incompletos) SEM gravar nada: o dono revisa e salva. Pura.
 */
export function modelosIniciais({ classes = CLASSES, por = ORIGINAL.planejamento.conjuntosPorClasse, de = ORIGINAL.planejamento.de, ate = ORIGINAL.planejamento.ate } = {}, prog = P.EM_USO.progressao) {
  const n = Math.max(1, Math.floor(por));
  const tamanho = Math.ceil((ate - de + 1) / n);
  const saida = [];
  for (const classe of classes) {
    for (let i = 0; i < n; i++) {
      const levelMin = de + i * tamanho;
      const levelMax = Math.min(ate, levelMin + tamanho - 1);
      if (levelMin > ate) break;
      const ato = P.atoDoNivelCom(prog, levelMin) ?? 1;
      saida.push({ id: `${classe}_ato${String(ato).padStart(2, '0')}_set${String(i + 1).padStart(2, '0')}`, nome: `${classe[0].toUpperCase()}${classe.slice(1)} — conjunto ${i + 1}`, classe, ato, tier: P.tierDaBaseCom(prog.tier, levelMin), levelMin, levelMax, ativo: false, completo: false, pecas: {} });
    }
  }
  return saida;
}

// ---------------------------------------------------------------- carga do disco (fábrica + override)
/** O override (`null` se não existe; ignora e avisa se quebrado). */
export function lerOverride(arquivo = ARQUIVO_DE_OVERRIDE, avisar = console.warn) {
  if (!existsSync(arquivo)) return null;
  try { return lerJson(arquivo); } catch (e) { avisar(`[overrides] conjuntos.json ignorado: ${e.message}`); return null; }
}
/** O mapa EFETIVO `{ id: conjunto }` (cada um com `origem`: 'original' | 'novo' | 'alterado'): a fábrica com o override por cima. Pura. */
export function efetivo(original, override) {
  const mapa = {};
  for (const [id, c] of Object.entries(original.conjuntos ?? {})) mapa[id] = { ...structuredClone(c), id, origem: 'original' };
  if (override && override.ativo !== false) {
    for (const [id, ov] of Object.entries(override.conjuntos ?? {})) {
      if (ov === null || ov?.excluido === true) { delete mapa[id]; continue; }
      const base = mapa[id];
      if (base) mapa[id] = { ...base, ...structuredClone(ov), id, pecas: { ...base.pecas, ...structuredClone(ov.pecas ?? {}) }, origem: 'alterado' };
      else mapa[id] = { ...structuredClone(ov), id, pecas: structuredClone(ov.pecas ?? {}), origem: 'novo' };
    }
  }
  return mapa;
}
/** O contexto de validação do jogo real (catálogo efetivo, classes, progressão EM USO, level máximo). */
export const contextoDoJogo = () => ({ catalogo: ITEM_CATALOG, classes: CLASSES, prog: P.EM_USO.progressao, nivelMaximo: P.nivelMaximo() });

/** O estado EM USO (objeto mutado no lugar quando o Hot Reload re-aplica). */
export const EM_USO = {};
export const resultadoDaCarga = { aplicado: false, erros: [], avisos: [] };
/** Aplica um override ao estado em uso. Estrito (Hot Reload): inválido NÃO é aplicado. Devolve `{ ok, erros, avisos }`. */
export function aplicar(override, { estrito = false, avisar = console.warn } = {}) {
  const mapa = efetivo(ORIGINAL, override);
  const v = validarTodos(mapa, contextoDoJogo());
  if (v.erros.length) {
    resultadoDaCarga.erros = v.erros;
    if (!estrito) avisar(`[overrides] conjuntos.json ignorado: ${v.erros.join(' | ')}`);
    return { ok: false, ...v };
  }
  for (const k of Object.keys(EM_USO)) delete EM_USO[k];
  Object.assign(EM_USO, mapa);
  resultadoDaCarga.aplicado = !!override && override.ativo !== false && Object.keys(override.conjuntos ?? {}).length > 0;
  resultadoDaCarga.erros = [];
  resultadoDaCarga.avisos = v.avisos;
  return { ok: true, ...v };
}
{
  const ov = lerOverride();
  const r = aplicar(ov);
  if (!r.ok) aplicar(null); // inválido: ignora com aviso e a fábrica segue
  else if (ov && Object.keys(ov.conjuntos ?? {}).length) console.log(`[overrides] conjuntos: ${Object.keys(ov.conjuntos).length} conjunto(s) do override aplicado(s).`);
}

// consultas do estado em uso
export const listar = () => Object.values(EM_USO);
export const obter = (id) => EM_USO[id] ?? null;
/** Em quais conjuntos (ativos ou não) o item aparece (para o editor de itens: "usado em conjuntos"). */
export const usadoPor = (itemId) => listar().flatMap((c) => Object.entries(c.pecas ?? {}).filter(([, id]) => Number(id) === Number(itemId)).map(([slot]) => ({ id: c.id, nome: c.nome, classe: c.classe, ato: c.ato, slot, ativo: c.ativo !== false })));
