// O EDITOR DE NÍVEL E ATRIBUTOS-BASE dos equipamentos, dentro do Item Power. NÃO existe fonte de dados paralela: ele edita o catálogo real de itens pela MESMA camada de overrides do editor de
// Itens (`gamedata/overrides/itens.json`, `systems/overrides.mjs`: `attack`, `defense`, `armor`, `minLevel`, `name`, `rarity`), com o mesmo histórico de versões, controle de revisão e
// Hot Reload ('itens'). O catálogo importado nunca é alterado.
//
// Mapa dos atributos do Item Power para os campos reais do item:
//   Damage  → `attack` (valor único: mín = máx)        Block → `defense` (rating do escudo; a arma conta metade)
//   Armour / Evasion / Energy Shield → TODOS derivados de `armor` (a armadura-base) pelo TIPO da base da peça e pelo level dela (`defesaDoCatalogo`). Não existem como campos separados:
//   editar um deles resolve a `armor` que o produz (com o tipo e o level do item) e mostra o resultado real. Um item só tem os tipos da sua base (ex.: peça de knight = Armour).
// Somente leitura (sem suporte na camada de overrides; mudar mexeria em regras de equipar/loot): categoria (slot), tipo, classe compatível, duas mãos, e o tier (derivado do level).
// Tudo que NÃO é atributo-base fica de fora: afixos/modificadores aleatórios, atributos adicionais, bônus de conjunto, atributos do personagem e derivados de combate.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as IP from '../systems/item-power.mjs';
import * as P from '../systems/progressao.mjs';
import * as O from '../systems/overrides.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import { defesaDoCatalogo } from '../systems/itens/item.mjs';
import { desenhoDoItem } from './biblioteca.mjs';
import { revisaoDe, conferirRevisao } from './arquivo-versionado.mjs';
import * as Itens from './overrides-itens.mjs';
import * as Diario from './item-power-historico.mjs';
import * as ArmaMod from '../engine/arma.mjs';
import * as Ficha from '../systems/ficha.mjs';
import * as Afixos from '../systems/afixos.mjs';

export { HISTORICO } from './item-power-historico.mjs';
const COMO_PUBLICAR = 'O arquivo gamedata/overrides/itens.json foi gravado neste servidor e o Hot Reload local atualizou o catálogo em memória (itens já gerados mantêm a faixa que sortearam). Para valer na produção: faça commit e publique pelo deploy.';
export const CAMPOS_EDITAVEIS = ['name', 'minLevel', 'rarity', 'attack', 'defense', 'armor'];
const ALIAS = { damage: 'attack', block: 'defense' };
const ALVOS_DE_DEFESA = { armour: 'armour', evasion: 'evasion', energyShield: 'es' };
const ROTULO = { name: 'Nome', minLevel: 'Nível exigido', rarity: 'Raridade', attack: 'Damage (attack)', defense: 'Block (defense)', armor: 'Armadura-base (armor → Armour/Evasion/Energy Shield)' };
export const SOMENTE_LEITURA = {
  slot: 'Categoria (slot): a camada de overrides não a suporta, e trocar o slot muda onde o item pode ser equipado.',
  type: 'Tipo de equipamento: vem do catálogo importado e define a base e a perícia.',
  vocations: 'Classe compatível: não é suportada pelos overrides; mudar altera quem pode equipar e a base de defesa (Armour/Evasion/Energy Shield).',
  twoHanded: 'Duas mãos: regra de equipar, não é atributo-base.',
  tier: 'Tier de progressão: é DERIVADO do nível exigido (tabela de progressão); muda sozinho quando o nível muda.',
};
const EQUIVALENTE_LEVEL = 25;
const arred = (n, c = 3) => (Number.isFinite(n) ? Number(n.toFixed(c)) : null);
const eNum = (v) => typeof v === 'number' && Number.isFinite(v);
const cfg = () => IP.EM_USO;
const compat = (a, b) => !a.length || !b.length || a.some((v) => b.includes(v));
const slim = (f) => (f ? { ip: f.ip, esperado: f.esperado, diferenca: f.diferenca, diferencaPct: f.diferencaPct, situacao: f.situacao, minLevel: f.minLevel, tier: f.tier, atributos: f.atributos, contribuicao: f.contribuicao } : null);

// ---------------------------------------------------------------- tradução da edição para campos reais do override
/** O coeficiente de cada tipo de defesa para `armor = 1` neste item e level (`{ armour, evasion, es }`). */
function coeficientes(meta) {
  const GRANDE = 1_000_000;
  const d = defesaDoCatalogo({ ...meta, armor: GRANDE });
  return { armour: (d.armor ?? 0) / GRANDE, evasion: (d.evasion ?? 0) / GRANDE, es: (d.es ?? 0) / GRANDE };
}

/**
 * Traduz uma edição (`{ name, minLevel, rarity, damage|attack, block|defense, armor, armour, evasion, energyShield, restaurar: [campos] }`) em campos reais do override do item.
 * `ovAtual`: o override que o item já tem. Devolve `{ ov, campos, erros, avisos }`, onde `ov` é o override COMPLETO resultante (só o que difere do original).
 */
export function traduzir(id, edicao, ovAtual = null) {
  const erros = []; const avisos = [];
  const original = Itens.originalDe(id);
  const onde = `item ${id}`;
  if (!original) return { ov: null, campos: {}, erros: [`${onde}: não existe no catálogo de itens.`], avisos };
  if (!edicao || typeof edicao !== 'object' || Array.isArray(edicao)) return { ov: null, campos: {}, erros: [`${onde}: a edição precisa ser um objeto.`], avisos };
  const permitidos = new Set([...CAMPOS_EDITAVEIS, ...Object.keys(ALIAS), ...Object.keys(ALVOS_DE_DEFESA), 'restaurar']);
  for (const k of Object.keys(edicao)) if (!permitidos.has(k)) erros.push(`${onde}: o campo "${k}" não pode ser editado aqui${SOMENTE_LEITURA[k] ? ` — ${SOMENTE_LEITURA[k]}` : ' (campo desconhecido)'}`);
  if (erros.length) return { ov: null, campos: {}, erros, avisos };
  const campos = {};
  for (const [k, v] of Object.entries(edicao)) {
    const campo = ALIAS[k] ?? k;
    if (k === 'restaurar' || ALVOS_DE_DEFESA[k] || v === undefined || v === null || v === '') continue;
    if (campo === 'name' || campo === 'rarity') { campos[campo] = v; continue; }
    const n = Number(v);
    if (!Number.isFinite(n)) { erros.push(`${onde}: ${ROTULO[campo] ?? k} precisa ser um número válido (veio ${JSON.stringify(v)}).`); continue; }
    if (n < 0) { erros.push(`${onde}: ${ROTULO[campo] ?? k} não pode ser negativo (${n}).`); continue; }
    if (!Number.isInteger(n)) avisos.push(`${onde}: ${ROTULO[campo] ?? k} é inteiro no jogo: ${n} foi arredondado para ${Math.round(n)}.`);
    campos[campo] = Math.round(n);
  }
  const restaurar = [...new Set((Array.isArray(edicao.restaurar) ? edicao.restaurar : []).map((k) => ALIAS[k] ?? k))];
  for (const k of restaurar) if (!CAMPOS_EDITAVEIS.includes(k)) erros.push(`${onde}: "${k}" não é um campo restaurável aqui.`);
  const base = { ...(ovAtual ?? {}) };
  for (const k of restaurar) delete base[k];
  const comCampos = { ...base, ...campos };
  // metas de defesa (Armour/Evasion/Energy Shield): resolvem a armadura-base no tipo e no level do item
  const metas = Object.keys(ALVOS_DE_DEFESA).filter((k) => edicao[k] !== undefined && edicao[k] !== null && edicao[k] !== '');
  if (metas.length && campos.armor === undefined) {
    const k = metas[0];
    const alvo = Number(edicao[k]);
    if (!Number.isFinite(alvo) || alvo < 0) erros.push(`${onde}: ${k} precisa ser um número válido e não negativo.`);
    else {
      const meta = O.aplicarNoItem(original, comCampos);
      const coef = coeficientes(meta)[ALVOS_DE_DEFESA[k]];
      if (!IP.SLOTS.includes(meta.slot) || ['weapon', 'shield'].includes(meta.slot)) erros.push(`${onde}: este slot (${meta.slot}) não tem armadura-base; ${k} não se aplica.`);
      else if (!(coef > 0)) erros.push(`${onde}: a base deste item não tem ${k} (os tipos dela decidem: knight = Armour, paladin = Evasion, sorcerer/druid = Energy Shield, monk = Armour + Evasion; sem classe, pelo peso).`);
      else { comCampos.armor = Math.round(alvo / coef); avisos.push(`${onde}: ${k} ${alvo} resolvido para armadura-base ${comCampos.armor} (resultado real no detalhamento).`); if (metas.length > 1) avisos.push(`${onde}: só um alvo de defesa por vez (usado ${k}); a armadura-base é única e os outros tipos acompanham.`); }
    }
  } else if (metas.length > 1) avisos.push(`${onde}: informe um alvo de defesa só.`);
  // só o que difere do original
  const ov = {};
  for (const [k, v] of Object.entries(comCampos)) {
    if (k === 'ativo') { if (v === false) ov.ativo = false; continue; }
    if (original[k] === v || (original[k] === undefined && v === 0)) continue;
    ov[k] = v;
  }
  return { ov, campos, erros, avisos };
}

// ---------------------------------------------------------------- equivalentes e alertas
/** Equipamentos equivalentes: mesmo slot, classes compatíveis e level a ±25 (efetivos, sem o próprio). Com o IP da configuração em uso. */
export function equivalentes(meta, { n = 8, cfgEmUso = cfg() } = {}) {
  const lv = meta.minLevel ?? null;
  if (lv == null) return [];
  const voc = meta.vocations ?? [];
  const l = [];
  for (const m of Object.values(ITEM_CATALOG)) {
    if (String(m.id) === String(meta.id) || m.slot !== meta.slot || m.stackable || /^Crafted /.test(m.name ?? '') || !(m.minLevel > 0)) continue;
    if (Math.abs(m.minLevel - lv) > EQUIVALENTE_LEVEL || !compat(voc, m.vocations ?? [])) continue;
    const f = IP.fichaDoMeta(m, cfgEmUso);
    if (f && f.ip > 0) l.push({ id: f.id, nome: f.nome, minLevel: f.minLevel, ip: f.ip, situacao: f.situacao, vocations: f.vocations });
  }
  return l.sort((a, b) => Math.abs(a.minLevel - lv) - Math.abs(b.minLevel - lv) || b.ip - a.ip).slice(0, n);
}

function alertasDoItem(id, original, candidato, fOrig, fAtual, fCand, equiv) {
  const c = cfg(); const a = c.alertas; const nome = candidato.name;
  const lista = [];
  const add = (tipo, mensagem) => lista.push({ codigo: `${tipo}:${id}`, tipo, item: Number(id), nome, mensagem, exigeAprovacao: true });
  if (candidato.minLevel != null && original.minLevel != null && Math.abs(candidato.minLevel - original.minLevel) > a.margemDeLevel) add('nivel-distante', `${nome}: o nível ${candidato.minLevel} está ${Math.abs(candidato.minLevel - original.minLevel)} níveis longe do original (${original.minLevel}); a margem de atenção é ${a.margemDeLevel}.`);
  if (fCand && fOrig && fCand.ip !== fAtual?.ip) {
    if (fCand.situacao === 'muito-acima') add('ip-muito-acima', `${nome}: o Item Power ${fCand.ip} ficou ${Math.round((fCand.diferencaPct ?? 0) * 100)}% acima do esperado (${fCand.esperado}) para o nível ${fCand.minLevel}.`);
    if (fCand.diferencaPct != null && fCand.diferencaPct < a.itemMuitoAbaixoPct) add('ip-muito-abaixo', `${nome}: o Item Power ${fCand.ip} ficou ${Math.round(-fCand.diferencaPct * 100)}% abaixo do esperado (${fCand.esperado}) para o nível ${fCand.minLevel}.`);
    const maxEq = equiv.length >= 3 ? Math.max(...equiv.map((e) => e.ip)) : null;
    if (maxEq && fCand.ip > maxEq * (1 + c.classificacao.acimaDe)) add('supera-equivalentes', `${nome}: o Item Power ${fCand.ip} supera em mais de ${Math.round(c.classificacao.acimaDe * 100)}% o melhor equivalente (${maxEq}) entre ${equiv.length} peças do mesmo slot e nível próximo.`);
  }
  // atributo fora da faixa esperada para o tier (pares do mesmo slot e tier no catálogo efetivo)
  if (candidato.minLevel > 0 && fCand) {
    const tier = fCand.tier;
    const pares = Object.values(ITEM_CATALOG).filter((m) => String(m.id) !== String(id) && m.slot === candidato.slot && !m.stackable && m.minLevel > 0 && !/^Crafted /.test(m.name ?? '') && P_TIER(m.minLevel) === tier);
    for (const campo of ['attack', 'defense', 'armor']) {
      const v = Math.floor(Number(candidato[campo])) || 0; const antes = Math.floor(Number(original[campo])) || 0;
      if (!v || v === antes) continue;
      const vals = pares.map((m) => Math.floor(Number(m[campo])) || 0).filter((x) => x > 0);
      if (vals.length < 3) continue;
      const max = Math.max(...vals); const min = Math.min(...vals);
      if (v > max * (1 + a.faixaDoTierPct)) add(`faixa-do-tier-${campo}`, `${nome}: ${ROTULO[campo]} ${v} passa ${Math.round(a.faixaDoTierPct * 100)}% do maior valor do tier T${tier} neste slot (${max}, ${vals.length} peças).`);
      else if (v < min * (1 - a.faixaDoTierPct)) add(`faixa-do-tier-${campo}`, `${nome}: ${ROTULO[campo]} ${v} fica ${Math.round(a.faixaDoTierPct * 100)}% abaixo do menor valor do tier T${tier} neste slot (${min}, ${vals.length} peças).`);
    }
  }
  return lista;
}
const P_TIER = (level) => P.tierDaBase(level);

// ---------------------------------------------------------------- prévia
/** O que uma edição de UM item causaria (sem gravar): erros, avisos, alertas (com aprovação), IP original × atual × candidato e equivalentes. */
export function previaDoItem(id, edicao, dadosAtuais = Itens.lerDados()) {
  const ovAtual = dadosAtuais.itens[id] ?? null;
  const t = traduzir(id, edicao, ovAtual);
  const original = Itens.originalDe(id);
  if (!original) return { id: Number(id), ok: false, erros: t.erros, avisos: [], alertas: [], mudancas: [] };
  const erros = [...t.erros]; const avisos = [...t.avisos];
  if (!t.ov && erros.length) return { id: Number(id), ok: false, erros, avisos, alertas: [], mudancas: [] };
  const v = O.validarItem(id, t.ov, { original });
  erros.push(...v.erros); avisos.push(...v.avisos);
  const atual = Itens.efetivoDe(id, ovAtual); const candidato = Itens.efetivoDe(id, t.ov);
  const c = cfg();
  const fOrig = IP.fichaDoMeta(original, c); const fAtual = IP.fichaDoMeta(atual, c); const fCand = IP.fichaDoMeta(candidato, c);
  if (!fCand) erros.push(`item ${id}: não é um equipamento dos 8 slots do Item Power.`);
  const mudancas = [];
  for (const k of CAMPOS_EDITAVEIS) if (JSON.stringify(atual[k] ?? null) !== JSON.stringify(candidato[k] ?? null)) mudancas.push({ campo: k, rotulo: ROTULO[k], original: original[k] ?? null, atual: atual[k] ?? null, candidato: candidato[k] ?? null });
  const equiv = fCand ? equivalentes({ ...candidato, id }, { cfgEmUso: c }) : [];
  const alertas = !erros.length && mudancas.length && fCand ? alertasDoItem(id, original, candidato, fOrig, fAtual, fCand, equiv) : [];
  return {
    id: Number(id), nome: candidato.name, slot: candidato.slot, ok: !erros.length, erros, avisos, alertas, mudancas, semMudancas: !mudancas.length, ovResultante: t.ov,
    original: slim(fOrig), atual: slim(fAtual), candidato: slim(fCand), equivalentes: equiv,
    tiposDeDefesa: ['weapon', 'shield'].includes(candidato.slot) ? [] : Object.entries(coeficientes(candidato)).filter(([, c]) => c > 0).map(([k]) => (k === 'es' ? 'energyShield' : k)), desenho: desenhoDoItem(candidato),
    somenteLeitura: { slot: candidato.slot, type: candidato.type ?? null, vocations: candidato.vocations ?? [], twoHanded: !!candidato.twoHanded, tier: fCand?.tier ?? null },
  };
}

/** A prévia de várias edições `{ id: edicao }`: tudo ou nada (`ok` falso se QUALQUER item tem erro). Devolve também os códigos que exigem aprovação manual. */
export function previa(edicoes, { origem = 'individual', limiteDeLinhas = 300 } = {}) {
  const dadosAtuais = Itens.lerDados();
  const ids = Object.keys(edicoes ?? {});
  if (!ids.length) return { ok: false, erros: ['Nenhuma edição para validar.'], itens: [], alertas: [], exigeAprovacao: [] };
  const todos = ids.map((id) => previaDoItem(id, edicoes[id], dadosAtuais));
  const alertas = todos.flatMap((i) => i.alertas);
  const erros = todos.flatMap((i) => i.erros);
  const resumo = { itens: todos.length, comMudanca: todos.filter((i) => !i.semMudancas).length, semMudanca: todos.filter((i) => i.semMudancas).length, comErro: todos.filter((i) => !i.ok).length, alertas: alertas.length };
  return { ok: !erros.length, origem, erros, itens: todos.slice(0, limiteDeLinhas), total: todos.length, resumo, alertas, exigeAprovacao: alertas.map((a) => a.codigo), revisao: revisaoDe(Itens.CAMINHOS.arquivo), aviso: 'Prévia: nada foi gravado. Item Power é um indicador dos atributos base, não simulação de combate.' };
}

// ---------------------------------------------------------------- gravação (uma única escrita: tudo ou nada)
const diario = (evento) => Diario.registrar(evento);

/**
 * Salva edições `{ id: edicao }` numa ÚNICA gravação do `itens.json` (a versão anterior vai para o histórico do arquivo). Recusa tudo se qualquer item tem erro; os alertas que exigem aprovação
 * precisam estar em `aprovados` (ou `aprovarTodos`). `origem`: 'individual' | 'tabela' | 'lote' (fica no histórico).
 */
export function salvar({ edicoes, origem = 'individual', rotulo = null, aprovados = [], aprovarTodos = false, revisao } = {}) {
  const conflito = conferirRevisao(revisao, Itens.CAMINHOS.arquivo);
  if (conflito) return conflito;
  const p = previa(edicoes, { origem, limiteDeLinhas: 0 });
  if (!p.ok) return { ok: false, erros: p.erros, avisos: [] };
  const pendentes = p.alertas.filter((a) => !aprovarTodos && !(aprovados ?? []).includes(a.codigo));
  if (pendentes.length) return { ok: false, codigo: 'aprovacao', erros: [`${pendentes.length} alerta(s) precisam da sua aprovação manual antes de salvar.`], pendentes };
  const d = Itens.lerDados();
  const alterados = [];
  const resumo = [];
  const antesDe = {};
  for (const id of Object.keys(edicoes)) {
    const i = previaDoItem(id, edicoes[id], d);
    if (i.semMudancas) continue;
    antesDe[id] = d.itens[id] ?? null;
    if (!Object.keys(i.ovResultante ?? {}).length) delete d.itens[id]; else d.itens[id] = i.ovResultante;
    alterados.push(Number(id));
    resumo.push({ id: Number(id), nome: i.nome, mudancas: i.mudancas.map((m) => ({ campo: m.campo, de: m.atual, para: m.candidato })), ipDe: i.atual?.ip ?? null, ipPara: i.candidato?.ip ?? null });
  }
  if (!alterados.length) return { ok: true, semMudancas: true, alterados: [], avisos: [] };
  const versoes = Itens.versoes();
  Itens.gravarDados(d);
  diario({ tipo: origem, rotulo, ids: alterados, itens: resumo.slice(0, 500), aprovados: aprovarTodos ? 'todos' : aprovados, versaoAnterior: Itens.versoes()[0] ?? null, versoesAntes: versoes.length });
  return { ok: true, alterados, avisos: p.itens.flatMap((i) => i.avisos), revisao: revisaoDe(Itens.CAMINHOS.arquivo), versaoAnterior: Itens.versoes()[0] ?? null, comoPublicar: COMO_PUBLICAR, hotReload: 'O Hot Reload local aplica o catálogo em memória em instantes. Isso atualiza o Item Power, a ficha e os próximos drops; peças já geradas mantêm a faixa sorteada, e o combate só reflete o que a ficha lê do catálogo.' };
}

/** Restaura ao original: remove SÓ os campos editáveis (ou os de `campos`) do override dos `ids`, sem tocar em preço, peso nem nos outros itens. Uma gravação só. */
export function restaurar({ ids, filtros = null, campos = null, rotulo = null, revisao } = {}) {
  const conflito = conferirRevisao(revisao, Itens.CAMINHOS.arquivo);
  if (conflito) return conflito;
  const lista = (filtros ? selecionar(filtros) : (ids ?? [])).map(String);
  if (!lista.length) return { ok: false, erros: ['Nenhum item para restaurar.'] };
  const alvo = (campos ?? CAMPOS_EDITAVEIS).map((k) => ALIAS[k] ?? k);
  for (const k of alvo) if (!CAMPOS_EDITAVEIS.includes(k)) return { ok: false, erros: [`"${k}" não é um campo restaurável aqui.`] };
  const d = Itens.lerDados();
  const restaurados = [];
  for (const id of lista) {
    const ov = d.itens[id];
    if (!ov) continue;
    const novo = { ...ov };
    let mexeu = false;
    for (const k of alvo) if (k in novo) { delete novo[k]; mexeu = true; }
    if (!mexeu) continue;
    if (!Object.keys(novo).filter((k) => k !== 'ativo').length) delete d.itens[id]; else d.itens[id] = novo;
    restaurados.push(Number(id));
  }
  if (!restaurados.length) return { ok: false, erros: ['Esses itens não têm alteração nesses campos.'] };
  Itens.gravarDados(d);
  diario({ tipo: 'restauracao', rotulo, ids: restaurados, campos: alvo });
  return { ok: true, restaurados, revisao: revisaoDe(Itens.CAMINHOS.arquivo), comoPublicar: COMO_PUBLICAR };
}

/** Restaura uma VERSÃO inteira do `itens.json` (a atual vai para o histórico). */
export function restaurarVersao(n, revisao) {
  const r = Itens.restaurar(n, revisao);
  if (r.ok) diario({ tipo: 'restauracao-de-versao', versao: Number(n) });
  return r.ok ? { ...r, revisao: revisaoDe(Itens.CAMINHOS.arquivo), comoPublicar: COMO_PUBLICAR } : r;
}

// ---------------------------------------------------------------- histórico e comparação de versões
export function historico({ limite = 100, id = null } = {}) {
  return { eventos: Diario.ler({ limite, id }), versoes: Itens.versoes() };
}
function snapshot(ref) {
  if (ref === 'atual' || ref === undefined || ref === null) return Itens.lerDados().itens;
  const arq = join(Itens.CAMINHOS.versoes, `${Number(ref)}.json`);
  if (!Number.isInteger(Number(ref)) || !existsSync(arq)) return null;
  return JSON.parse(readFileSync(arq, 'utf8')).itens ?? {};
}
/** Diferença item a item entre duas versões do `itens.json` (`'atual'` ou o número da versão). */
export function compararVersoes(a, b = 'atual', apenasId = null) {
  const A = snapshot(a); const B = snapshot(b);
  if (!A || !B) return { ok: false, erros: ['Versão não encontrada.'] };
  const mudancas = [];
  for (const id of new Set([...Object.keys(A), ...Object.keys(B)])) {
    if (apenasId != null && String(apenasId) !== id) continue;
    for (const k of CAMPOS_EDITAVEIS) {
      const de = A[id]?.[k] ?? null; const para = B[id]?.[k] ?? null;
      if (JSON.stringify(de) !== JSON.stringify(para)) mudancas.push({ id: Number(id), nome: ITEM_CATALOG[id]?.name ?? null, campo: k, rotulo: ROTULO[k], de, para });
    }
  }
  return { ok: true, de: a, para: b, total: mudancas.length, mudancas: mudancas.slice(0, 1000) };
}

// ---------------------------------------------------------------- seleção e edição em lote
/** Os ids que passam nos filtros (classe, categoria, tier, Ato, faixa de level, raridade, busca). Equipamentos efetivos; sem peças "Crafted" salvo `incluirCraft`. */
export function selecionar(f = {}) {
  const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const t = norm(f.q).trim();
  const comNivel = ['tier', 'ato', 'nivelMin', 'nivelMax'].some((k) => f[k] !== undefined && f[k] !== '' && f[k] !== null);
  const ids = [];
  for (const m of Object.values(ITEM_CATALOG)) {
    if (!IP.SLOTS.includes(m.slot) || m.stackable) continue;
    if (!f.incluirCraft && /^Crafted /.test(m.name ?? '')) continue;
    if (f.categoria && m.slot !== f.categoria) continue;
    if (f.classe && m.vocations?.length && !m.vocations.includes(f.classe)) continue;
    if (f.raridade && m.rarity !== f.raridade) continue;
    if (t && !norm(m.name).includes(t) && String(m.id) !== t) continue;
    if (comNivel) {
      const lv = m.minLevel;
      if (!(lv > 0)) continue;
      if (f.nivelMin !== undefined && f.nivelMin !== '' && lv < Number(f.nivelMin)) continue;
      if (f.nivelMax !== undefined && f.nivelMax !== '' && lv > Number(f.nivelMax)) continue;
      if (f.tier !== undefined && f.tier !== '' && P_TIER(lv) !== Number(f.tier)) continue;
      if (f.ato !== undefined && f.ato !== '' && P.atoDoNivel(lv) !== Number(f.ato)) continue;
    }
    ids.push(Number(m.id));
  }
  return ids;
}

const OPERACOES = ['definir', 'somar', 'multiplicar'];
const CAMPOS_DE_LOTE = { nivel: 'minLevel', damage: 'attack', block: 'defense', armour: 'armour', evasion: 'evasion', energyShield: 'energyShield' };
/**
 * Monta as edições de um lote: `operacoes = [{ campo: nivel|damage|block|armour|evasion|energyShield, op: definir|somar|multiplicar, valor }]` sobre os itens dos `filtros` (ou de `ids`).
 * Item sem o atributo (ou sem level, para somar) é IGNORADO e listado. Devolve `{ edicoes, ignorados, erros }` — sem gravar. Pura em relação ao disco.
 */
export function montarLote({ filtros = {}, ids = null, operacoes = [] } = {}) {
  const erros = [];
  if (!Array.isArray(operacoes) || !operacoes.length) erros.push('Escolha ao menos uma operação.');
  for (const o of operacoes ?? []) {
    if (!(o?.campo in CAMPOS_DE_LOTE)) erros.push(`Operação inválida: o campo "${o?.campo}" não existe (use ${Object.keys(CAMPOS_DE_LOTE).join(', ')}).`);
    else if (!OPERACOES.includes(o.op)) erros.push(`Operação inválida: "${o.op}" (use ${OPERACOES.join(', ')}).`);
    else if (!eNum(Number(o.valor)) || o.valor === '' || o.valor === null) erros.push(`Operação ${o.campo}: o valor precisa ser um número.`);
    else if (o.campo === 'nivel' && o.op === 'multiplicar') erros.push('O nível não é multiplicado: use definir ou somar.');
    else if (o.op === 'multiplicar' && Number(o.valor) < 0) erros.push(`Operação ${o.campo}: o fator não pode ser negativo.`);
  }
  if (erros.length) return { edicoes: {}, ignorados: [], erros };
  const alvo = (ids ?? selecionar(filtros)).map(String);
  const d = Itens.lerDados();
  const edicoes = {}; const ignorados = [];
  for (const id of alvo) {
    const meta = Itens.efetivoDe(id, d.itens[id] ?? null);
    const a = IP.atributosDoMeta(meta);
    if (!meta || !a) { ignorados.push({ id: Number(id), motivo: 'não é equipamento dos 8 slots' }); continue; }
    const atual = { nivel: meta.minLevel > 0 ? meta.minLevel : null, damage: a.damageMax, block: a.defesa, armour: a.armour, evasion: a.evasion, energyShield: a.energyShield };
    const ed = {}; let pula = null;
    for (const o of operacoes) {
      const cur = atual[o.campo]; const v = Number(o.valor);
      if (o.campo === 'nivel') { if (o.op === 'somar' && cur == null) { pula = 'sem nível mínimo para somar'; break; } ed.minLevel = o.op === 'definir' ? v : Math.max(1, cur + v); continue; }
      if (!(cur > 0)) { pula = `não tem ${o.campo}`; break; }
      const novo = o.op === 'definir' ? v : o.op === 'somar' ? cur + v : cur * v;
      ed[o.campo === 'damage' ? 'damage' : o.campo === 'block' ? 'block' : o.campo] = Math.max(0, Math.round(novo));
    }
    if (pula) ignorados.push({ id: Number(id), nome: meta.name, motivo: pula }); else edicoes[id] = ed;
  }
  return { edicoes, ignorados, erros: [] };
}

/** A prévia de um lote: quantos itens, valores antigos × novos, IP e os alertas de excesso (variação do IP acima de `loteExcessoPct` ou do nível acima de `loteExcessoNiveis`). Não grava. */
export function previaDeLote(pedido) {
  const m = montarLote(pedido);
  if (m.erros.length) return { ok: false, erros: m.erros, afetados: 0, ignorados: [] };
  const ids = Object.keys(m.edicoes);
  if (!ids.length) return { ok: false, erros: ['Nenhum item foi afetado pelos filtros e operações.'], afetados: 0, ignorados: m.ignorados.slice(0, 100), totalIgnorados: m.ignorados.length };
  const p = previa(m.edicoes, { origem: 'lote', limiteDeLinhas: 300 });
  const a = cfg().alertas; const excessos = [];
  for (const i of p.itens) {
    if (!i.candidato || !i.atual) continue;
    const dIp = i.atual.ip ? (i.candidato.ip - i.atual.ip) / i.atual.ip : null;
    const dNivel = i.candidato.minLevel != null && i.atual.minLevel != null ? Math.abs(i.candidato.minLevel - i.atual.minLevel) : 0;
    if ((dIp != null && Math.abs(dIp) > a.loteExcessoPct) || dNivel > a.loteExcessoNiveis) excessos.push({ codigo: `lote-excessivo:${i.id}`, tipo: 'lote-excessivo', item: i.id, nome: i.nome, exigeAprovacao: true, mensagem: `${i.nome}: alteração grande (IP ${dIp != null ? `${dIp > 0 ? '+' : ''}${Math.round(dIp * 100)}%` : 'novo'}, nível ${dNivel ? `±${dNivel}` : 'igual'}; limites ${Math.round(a.loteExcessoPct * 100)}% e ${a.loteExcessoNiveis} níveis).` });
  }
  const alertas = [...p.alertas, ...excessos];
  return { ...p, ok: p.ok, alertas, exigeAprovacao: alertas.map((x) => x.codigo), afetados: ids.length, ignorados: m.ignorados.slice(0, 100), totalIgnorados: m.ignorados.length, edicoes: m.edicoes,
    linhas: p.itens.map((i) => ({ id: i.id, nome: i.nome, slot: i.slot, mudancas: i.mudancas, ipAntes: i.atual?.ip ?? null, ipDepois: i.candidato?.ip ?? null, situacaoDepois: i.candidato?.situacao ?? null })) };
}

// ---------------------------------------------------------------- recalcular a curva com os dados atuais (só proposta: gravar a curva é um passo explícito do usuário)
export function propostaDeCurva({ filtros = {}, excluirIds = [], minimoDeItens = 3, descartarAtipicos = true, monotonica = true, niveis } = {}) {
  const ids = new Set(selecionar({ ...filtros, categoria: '' }).filter((id) => !excluirIds.map(Number).includes(id)));
  const c = cfg();
  const fichas = [...ids].map((id) => IP.fichaDoMeta(ITEM_CATALOG[id], c)).filter(Boolean).filter((f) => !filtros.categoria || f.slot === filtros.categoria);
  const r = IP.propostaDeCurva(fichas, { minimoDeItens, descartarAtipicos, monotonica, ...(Array.isArray(niveis) && niveis.length ? { niveis } : {}), ...(filtros.categoria ? { categorias: [filtros.categoria] } : {}) });
  const atual = Object.fromEntries(Object.keys(r.categorias).map((s) => [s, IP.pontosDaCurva(c, s)]));
  return { ok: true, itensConsiderados: fichas.length, porCategoria: Object.fromEntries(Object.entries(r.categorias).map(([s, v]) => [s, { considerados: v.considerados, descartados: v.descartados, totalDescartados: v.totalDescartados, buckets: v.buckets }])), proposta: Object.fromEntries(Object.entries(r.categorias).map(([s, v]) => [s, v.pontos])), atual,
    amostra: fichas.slice(0, 200).map((f) => ({ id: f.id, nome: f.nome, slot: f.slot, minLevel: f.minLevel, ip: f.ip })), aviso: 'Proposta: a curva só muda quando você a aplica e salva na aba Fórmula/Curva. Valores atípicos são descartados para não distorcer a curva.' };
}

/**
 * Compara entradas `{ id, versao: 'atual'|'original'|'editada', edicao?, rotulo? }`: o item real, o ORIGINAL do catálogo importado ou uma versão EDITADA ainda não salva (candidato da prévia).
 * Devolve a comparação com nível, classe, categoria, tier, raridade, os 5 atributos, IP, diferença % e situação contra a curva.
 */
export function compararEntradas(entradas) {
  const c = cfg(); const dados = Itens.lerDados();
  const fichas = []; const erros = [];
  for (const e of entradas ?? []) {
    const id = String(e?.id);
    const original = Itens.originalDe(id);
    if (!original) { erros.push(`Item ${id}: não existe no catálogo.`); continue; }
    let meta;
    if (e.versao === 'original') meta = original;
    else if (e.versao === 'editada') { const t = traduzir(id, e.edicao ?? {}, dados.itens[id] ?? null); if (t.erros.length) { erros.push(...t.erros); continue; } meta = Itens.efetivoDe(id, t.ov); }
    else meta = Itens.efetivoDe(id, dados.itens[id] ?? null);
    const f = IP.fichaDoMeta({ ...meta, id }, c);
    if (!f) { erros.push(`Item ${id}: não é equipamento dos 8 slots.`); continue; }
    fichas.push({ ...f, rotulo: e.rotulo ?? `${f.nome}${e.versao === 'original' ? ' (original)' : e.versao === 'editada' ? ' (editado, não salvo)' : ''}`, versao: e.versao ?? 'atual' });
  }
  if (erros.length) return { ok: false, erros };
  return IP.compararFichas(fichas);
}

// ---------------------------------------------------------------- o painel de poder do editor de ITENS (Combate / Geral)
const APLICAVEL = { attack: ['weapon'], defense: ['weapon', 'shield'], armor: ['head', 'body', 'legs', 'feet', 'ring', 'neck'] };
const ROTULO_RAW = { attack: 'Damage (attack)', defense: 'Block (defense)', armor: 'Armadura-base (armor)' };
const dif = (a, b) => (eNum(a) && eNum(b) ? arred(b - a) : null);
const difPct = (a, b) => (eNum(a) && eNum(b) && a !== 0 ? arred((b - a) / a, 4) : null);

/** Outros campos de base que o item tem mas o editor NÃO altera (os overrides não os suportam): mostrados só para leitura, com o motivo. */
function outrosAtributos(m) {
  const l = [];
  if (m.extraDefense != null) l.push({ campo: 'extraDefense', rotulo: 'Defesa extra da arma', valor: m.extraDefense, nota: 'Entra no Block da ficha, mas não é campo editável pelos overrides; não entra no Item Power.' });
  if (m.wand) l.push({ campo: 'wand', rotulo: 'Dano legado do cajado/rod (mín–máx)', valor: `${m.wand.min}–${m.wand.max}`, nota: 'Vem do Canary; a ficha do jogo não o usa (usa Magic Attack). Não editável e fora do Item Power (fator danoDoCajado = 0).' });
  if (m.element) l.push({ campo: 'element', rotulo: 'Elemento', valor: m.element, nota: 'Somente leitura.' });
  if (m.protection && Object.keys(m.protection).length) l.push({ campo: 'protection', rotulo: 'Proteções elementais da base', valor: Object.entries(m.protection).map(([k, v]) => `${k} ${v}`).join(', '), nota: 'Somente leitura; resistências ficam fora do Item Power.' });
  if (m.twoHanded) l.push({ campo: 'twoHanded', rotulo: 'Duas mãos', valor: 'sim', nota: SOMENTE_LEITURA.twoHanded });
  return l;
}

/**
 * Tudo que o painel de Item Power do editor de itens mostra, para o override-RASCUNHO `ov` do item `id` (o que está na tela, ainda não salvo): atributos original × atual (salvo) × simulado,
 * nível/tier/Ato derivados, IP e esperado, diferenças, classificação, composição do cálculo (fórmula, fatores e pesos reais do módulo), curva, equivalentes, alertas e erros. Não grava nada
 * e usa as MESMAS funções do módulo Item Power (`fichaDoMeta`, `esperado`, `classeDaDiferenca`): nenhuma fórmula é reescrita aqui.
 */
export function poderDoOverride(id, ov, dadosAtuais = Itens.lerDados(), previaDaArma = null) {
  const original = Itens.originalDe(id);
  if (!original) return { ok: false, erros: [`item ${id}: não existe no catálogo de itens.`] };
  const limpo = ov && typeof ov === 'object' && !Array.isArray(ov) ? ov : {};
  const v = Object.keys(limpo).filter((k) => k !== 'ativo').length ? O.validarItem(id, limpo, { original }) : { erros: [], avisos: [] };
  const c = cfg();
  const ovAtual = dadosAtuais.itens[id] ?? null;
  const atual = Itens.efetivoDe(id, ovAtual);
  // um override com erro não é aplicado: a simulação cai no que está salvo, e os erros aparecem
  const candidato = v.erros.length ? atual : Itens.efetivoDe(id, limpo);
  const fOrig = IP.fichaDoMeta(original, c); const fAtual = IP.fichaDoMeta(atual, c); const fSim = IP.fichaDoMeta(candidato, c);
  const equipamento = !!fOrig;
  const campos = Object.fromEntries(['attack', 'defense', 'armor'].map((k) => [k, {
    campo: k, rotulo: ROTULO_RAW[k], aplicavel: (APLICAVEL[k] ?? []).includes(original.slot) || original[k] !== undefined, presente: original[k] !== undefined,
    original: original[k] ?? null, atual: atual[k] ?? null, simulado: candidato[k] ?? null, modificado: limpo[k] !== undefined, comOverrideSalvo: ovAtual?.[k] !== undefined,
    diferenca: dif(original[k], candidato[k]), diferencaPct: difPct(original[k], candidato[k]),
  }]));
  const derivados = equipamento ? ['damage', 'block', 'armour', 'evasion', 'energyShield'].map((a) => {
    const g = (f) => (f ? (a === 'damage' ? f.atributos.damage : f.contribuicao[a].valor) : null);
    const tipos = ['weapon', 'shield'].includes(original.slot) ? [] : Object.entries(coeficientes(candidato)).filter(([, x]) => x > 0).map(([k]) => (k === 'es' ? 'energyShield' : k));
    const aplicavel = a === 'damage' ? original.slot === 'weapon' || (g(fOrig) ?? 0) > 0 : a === 'block' ? ['weapon', 'shield'].includes(original.slot) : tipos.includes(a) || (g(fOrig) ?? 0) > 0;
    return { atributo: a, rotulo: IP.ROTULO_DO_ATRIBUTO[a], aplicavel, original: g(fOrig), atual: g(fAtual), simulado: g(fSim), diferenca: dif(g(fOrig), g(fSim)), diferencaPct: difPct(g(fOrig), g(fSim)),
      pontosOriginal: fOrig?.contribuicao[a].pontos ?? null, pontosSimulado: fSim?.contribuicao[a].pontos ?? null, derivado: ['armour', 'evasion', 'energyShield'].includes(a) };
  }) : [];
  const nivel = {
    original: original.minLevel ?? null, atual: atual.minLevel ?? null, simulado: candidato.minLevel ?? null, modificado: limpo.minLevel !== undefined,
    tierOriginal: fOrig?.tier ?? null, tierSimulado: fSim?.tier ?? null, atoOriginal: original.minLevel > 0 ? P.atoDoNivel(original.minLevel) : null, atoSimulado: candidato.minLevel > 0 ? P.atoDoNivel(candidato.minLevel) : null,
    recomendado: candidato.minLevel ?? null, nivelMaximo: P.nivelMaximo(),
    nota: 'O nível exigido NÃO altera os campos attack/defense/armor gravados, mas o tier da base é derivado dele e a Evasion/Energy Shield DERIVADAS da armadura-base crescem com ele. O nível recomendado e o Act de referência também são derivados (o catálogo não tem campos próprios).',
  };
  const esperadoCand = fSim?.esperado ?? null;
  const curva = fSim?.slot ? { categoria: fSim.slot, esperado: esperadoCand, faixaAdequada: esperadoCand ? [arred(esperadoCand * (1 + c.classificacao.abaixoDe), 2), arred(esperadoCand * (1 + c.classificacao.acimaDe), 2)] : null, posicaoPct: fSim.diferencaPct, esperadoOriginal: fOrig?.esperado ?? null, independente: 'A curva não muda com a simulação nem com a edição; só se você a recalcular no Item Power.' } : null;
  const mudouDe = fAtual && fSim ? ATRIBUTOSIP.map((a) => ({ atributo: a, rotulo: IP.ROTULO_DO_ATRIBUTO[a], pontosAntes: fAtual.contribuicao[a].pontos, pontosDepois: fSim.contribuicao[a].pontos, diferenca: arred(fSim.contribuicao[a].pontos - fAtual.contribuicao[a].pontos) })).filter((x) => x.diferenca !== 0).sort((a, b) => Math.abs(b.diferenca) - Math.abs(a.diferenca)) : [];
  const equiv = fSim ? equivalentes({ ...candidato, id }, { cfgEmUso: c }) : [];
  const temMudanca = [...CAMPOS_EDITAVEIS, ...O.CAMPOS_DE_ARMA].some((k) => (atual[k] ?? null) !== (candidato[k] ?? null));
  const alertas = !v.erros.length && temMudanca && fSim ? alertasDoItem(id, original, candidato, fOrig, fAtual, fSim, equiv) : [];
  const composicao = fSim ? IP.ATRIBUTOS.map((a) => ({ atributo: a, rotulo: IP.ROTULO_DO_ATRIBUTO[a], valor: fSim.contribuicao[a].valor, fator: c.normalizacao[a], peso: fSim.contribuicao[a].peso, pontos: fSim.contribuicao[a].pontos, normalizado: fSim.contribuicao[a].normalizado })) : [];
  return {
    ok: !v.erros.length, erros: v.erros, avisos: v.avisos, id: Number(id), nome: candidato.name, slot: original.slot ?? null, tipo: original.type ?? null, ehEquipamento: equipamento,
    campos, derivados, nivel, outros: outrosAtributos(original), tiposDeDefesa: equipamento && !['weapon', 'shield'].includes(original.slot) ? Object.entries(coeficientes(candidato)).filter(([, x]) => x > 0).map(([k]) => (k === 'es' ? 'energyShield' : k)) : [],
    ip: equipamento ? { original: fOrig.ip, atual: fAtual.ip, simulado: fSim.ip, diferencaSimuladoAtual: dif(fAtual.ip, fSim.ip), diferencaSimuladoOriginal: dif(fOrig.ip, fSim.ip), pctSimuladoAtual: difPct(fAtual.ip, fSim.ip), pctSimuladoOriginal: difPct(fOrig.ip, fSim.ip),
      esperado: esperadoCand, diferencaEsperado: fSim.diferenca, diferencaEsperadoPct: fSim.diferencaPct,
      situacaoOriginal: fOrig.situacao, situacaoAtual: fAtual.situacao, situacaoSimulada: fSim.situacao, mudouDeSituacao: fOrig.situacao !== fSim.situacao } : null,
    arma: blocoDaArma(id, original, candidato, previaDaArma), composicao, curva, atributosQueMudaram: mudouDe, equivalentes: equiv, alertas, exigeAprovacao: alertas.map((a) => a.codigo), rotuloDaClasse: c.classificacao,
    desenho: desenhoDoItem(candidato), aviso: 'Item Power é um indicador comparativo dos atributos BASE: não é DPS, defesa real do personagem nem garantia de equilíbrio em combate. Modificadores aleatórios, bônus de conjunto e atributos do personagem não entram.',
  };
}
const ATRIBUTOSIP = IP.ATRIBUTOS;

/** Resolve um alvo de Armour/Evasion/Energy Shield para a armadura-base (`armor`) que o produz, no tipo e no nível do item, dado o override-rascunho. */
export function resolverDefesa(id, ov, tipo, valor) {
  const t = traduzir(id, { [tipo]: valor }, ov ?? null);
  if (t.erros.length) return { ok: false, erros: t.erros };
  const original = Itens.originalDe(id);
  return { ok: true, armor: t.ov.armor ?? original.armor ?? 0, avisos: t.avisos };
}

// ---------------------------------------------------------------- a ARMA no editor: base, qualidade, modificadores locais, finais e o golpe básico REAL
const REFERENCIA_POR_FAMILIA = { melee: 'knight', distance: 'paladin', magic: 'druid' };

/**
 * Os atributos de uma ARMA para o editor: base original × base editada (de `engine/arma.mjs`, a conta única), a qualidade e os modificadores locais da PRÉVIA (`previa`: `{ qualidade, locais }` —
 * o catálogo não guarda qualidade; ela vive na peça), os finais por etapa, o DPS físico da arma e, separado, o golpe básico REAL do personagem de referência (`Ficha.combate`, que inclui
 * perícia, level e STR/INT; sem habilidades, gemas ou críticos de combate). Só leitura: o item candidato entra no catálogo por um instante SÍNCRONO (sem await) e é devolvido no `finally`.
 * `null` se o item não é arma.
 */
export function blocoDaArma(id, original, candidato, previa = null) {
  const bo = ArmaMod.baseDaArma(original); const bc = ArmaMod.baseDaArma(candidato);
  if (!bc) return null;
  const entrada = { qualidade: previa?.qualidade ?? 0, locais: previa?.locais ?? {} };
  const sOriginal = ArmaMod.statsDaArma(bo); const sFinal = ArmaMod.statsDaArma(bc, entrada);
  const familia = bc.magica ? 'magic' : candidato.skill === 'distance' ? 'distance' : 'melee';
  const nivelRef = Math.max(1, candidato.minLevel ?? 1);
  let real = null;
  const guardado = ITEM_CATALOG[id];
  try {
    ITEM_CATALOG[id] = { ...candidato, id: Number(id) };
    const estado = { level: nivelRef, xp: 0, vocation: REFERENCIA_POR_FAMILIA[familia], hp: 1, maxHp: 1, mana: 1, maxMana: 1, inventory: [], equipment: { weapon: { id: Number(id), count: 1, qualidade: entrada.qualidade, locais: entrada.locais } } };
    try { Afixos.sincronizarMaximos(estado); } catch { /* sem afixos */ }
    Ficha.invalidar(estado);
    const f = Ficha.combate(estado);
    real = { classe: REFERENCIA_POR_FAMILIA[familia], level: nivelRef, pericia: f.skillName, valorDaPericia: f.skillValue, danoMin: f.damage.min, danoMax: f.damage.max, intervaloMs: f.intervaloDoGolpeMs, golpesPorSegundo: f.intervaloDoGolpeMs > 0 ? arred(1000 / f.intervaloDoGolpeMs, 3) : null,
      danoMedio: arred((f.damage.min + f.damage.max) / 2, 2), critChance: arred(f.critChance, 4),
      dpsDoGolpeBasico: f.intervaloDoGolpeMs > 0 ? arred(((f.damage.min + f.damage.max) / 2) * (1000 / f.intervaloDoGolpeMs), 2) : null };
  } finally { if (guardado === undefined) delete ITEM_CATALOG[id]; else ITEM_CATALOG[id] = guardado; }
  const r = (s) => (s ? { qualidade: s.qualidade, locais: s.locais, dano: s.dano, aps: s.aps, critChance: s.critChance, danoMin: s.danoMin, danoMax: s.danoMax, danoMedio: s.danoMedio, apsFinal: s.apsFinal, dpsFisico: s.dpsFisico, ganhoDaQualidade: s.ganhoDaQualidade } : null);
  return {
    tipo: bc.tipo, familia, magica: bc.magica, duasMaos: bc.duasMaos, alcance: bc.alcance, nivel: bc.nivel, requisitos: bc.requisitos, temFaixa: bc.temFaixa,
    base: { original: bo, editada: bc }, original: r(sOriginal), final: r(sFinal), golpeBasicoReal: real,
    qualidadeMaxima: ArmaMod.QUALIDADE_MAXIMA, apsPadrao: ArmaMod.APS_PADRAO, limitesDoAps: ArmaMod.LIMITES_DO_APS,
    rotulos: {
      base: 'Atributos ORIGINAIS da base (catálogo do Canary + overrides): não dependem do personagem.',
      locais: 'Modificadores LOCAIS da arma (ficam na peça): mudam os números dela. Globais do personagem não entram aqui.',
      final: 'Valores FINAIS da arma = base → + dano adicional local → × % local → × qualidade (aplicada uma vez). DPS físico da arma = dano médio × APS: NÃO é o dano de habilidade nem o DPS efetivo do personagem.',
      real: 'Golpe básico REAL calculado pela ficha do jogo para o personagem de referência (perícia inicial, level da arma, STR/INT, sem habilidades, gemas nem críticos): é o que a engine usa de verdade.',
    },
    nota: bc.magica ? 'Wand/rod: o dano vem do Magic Attack (poder da arma), não do dano físico da base; a qualidade só afeta a velocidade.' : null,
  };
}
