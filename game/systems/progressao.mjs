// A PROGRESSÃO DE EQUIPAMENTOS e a DIFICULDADE do loot — duas dimensões SEPARADAS (config em `gamedata/progressao.json`, overrides em `gamedata/overrides/progressao.json`).
//
//   progressao  (COMPARTILHADA pelas três dificuldades): a faixa de level de equipamento de cada Ato (1–100, 101–200 … 901–1000) e o tier das bases (T1 … T11). Normal, Cruel
//               e Merciless reutilizam os MESMOS Acts e as MESMAS bases: a dificuldade nunca cria level de equipamento novo, e nada passa de `nivelMaximoDeEquipamento` (1000).
//   loot        (POR DIFICULDADE): só a qualidade das oportunidades — pesos de raridade, chance de drop de equipamento, chance de +1 modificador, pesos e teto dos tiers de
//               modificador. Os valores de fábrica são NEUTROS (não mudam nada do que já existe).
//
// Tier da BASE (do equipamento), tier do MODIFICADOR, requisito de level do item e dificuldade do conteúdo são quatro conceitos diferentes: aqui só moram os dois primeiros +
// a dificuldade; o tier do modificador continua sendo sorteado em `itens/config.mjs` (`sortearTier`) com os pesos que a dificuldade pede.
//
// Módulo de baixo nível: não importa `itens/config.mjs` (que o importa). Funções puras recebem os dados; a carga do disco e o override ficam no fim do arquivo.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ITEM_CATALOG } from './dados.mjs';
import { PASTA as PASTA_DE_OVERRIDES } from './overrides.mjs';

export const DIFICULDADES = ['facil', 'medio', 'dificil'];
export const RARIDADES = ['comum', 'incomum', 'raro', 'épico', 'lendário', 'mítico'];
export const TIERS_DE_MODIFICADOR = ['1', '2', '3', '4', '5'];
export const NIVEL_MAXIMO_DOS_EQUIPAMENTOS = 1000;
const SLOTS_DE_EQUIPAMENTO = new Set(['weapon', 'shield', 'head', 'body', 'legs', 'feet', 'ring', 'neck']);

// ---------------------------------------------------------------- funções puras (recebem a configuração)
/** Mescla um override parcial sobre a base: objetos se mesclam, listas e valores substituem; `null` substitui. Pura (não muda os argumentos). */
export function mesclar(base, ov) {
  if (ov === undefined) return structuredClone(base);
  if (ov === null || typeof ov !== 'object' || Array.isArray(ov) || base === null || typeof base !== 'object' || Array.isArray(base)) return structuredClone(ov);
  const saida = structuredClone(base);
  for (const [k, v] of Object.entries(ov)) saida[k] = mesclar(base[k], v);
  return saida;
}

/** O tier da BASE de um equipamento de `level`: `floor((level + deslocamento − 1) / largura) + 1` (Act 1 = T1–T2 … Act 10 = T10–T11). */
export const tierDaBaseCom = (tier, level) => Math.floor((Math.max(1, Number(level) || 1) + (tier?.deslocamento ?? 0) - 1) / (tier?.largura ?? 100)) + 1;
/** Os tiers que um Ato cobre (do primeiro ao último level da faixa). */
export const tiersDoAtoCom = (tier, faixa) => [...new Set([tierDaBaseCom(tier, faixa.de), tierDaBaseCom(tier, faixa.ate)])];

/** O ato de um level de equipamento (`null` se acima do máximo ou fora de qualquer faixa). */
export function atoDoNivelCom(prog, level) {
  const l = Number(level);
  if (!(l >= 1) || l > prog.nivelMaximoDeEquipamento) return null;
  return prog.atos.find((a) => l >= a.de && l <= a.ate)?.ato ?? null;
}

/** Aplica os pesos de raridade (multiplicadores) a uma tabela `{raridade: %}` e NORMALIZA para somar 100. Pesos vazios = a mesma tabela. Pura. */
export function aplicarPesosDeRaridade(tabela, pesos) {
  if (!pesos || !Object.keys(pesos).length) return tabela;
  const novo = Object.fromEntries(RARIDADES.map((r) => [r, (tabela[r] ?? 0) * (pesos[r] ?? 1)]));
  const total = RARIDADES.reduce((s, r) => s + novo[r], 0);
  return total > 0 ? Object.fromEntries(RARIDADES.map((r) => [r, (100 * novo[r]) / total])) : tabela;
}

/** O loot de uma dificuldade com os padrões preenchidos (neutro). */
export function lootComPadroes(loot) {
  return { chanceDeDrop: 1, pesosDeRaridade: {}, chanceDeModificadorExtra: 0, pesosDeTier: {}, tierMaximo: null, ...(loot ?? {}) };
}

/**
 * Valida uma configuração (`{ progressao, dificuldades, loot }`). Devolve `{ erros, avisos }`: erro impede salvar/subir; aviso é o que merece atenção (exceções intencionais não bloqueiam).
 * `catalogo` (opcional): o catálogo de itens, para as conferências de level e elegibilidade; `distribuicao(dif)` (opcional): `{ raroOuMelhor }` por dificuldade (para o aviso de "dificuldade
 * inferior mais vantajosa").
 */
export function validarConfiguracao(dados, { catalogo = null, distribuicao = null } = {}) {
  const erros = [];
  const avisos = [];
  const p = dados?.progressao;
  if (!p || typeof p !== 'object') return { erros: ['progressao: seção ausente.'], avisos };
  const max = p.nivelMaximoDeEquipamento;
  if (!Number.isInteger(max) || max < 1) erros.push('progressao: nivelMaximoDeEquipamento precisa ser um inteiro positivo.');
  else if (max > NIVEL_MAXIMO_DOS_EQUIPAMENTOS) erros.push(`progressao: nivelMaximoDeEquipamento ${max} passa do limite de ${NIVEL_MAXIMO_DOS_EQUIPAMENTOS}: os equipamentos vão somente até o level ${NIVEL_MAXIMO_DOS_EQUIPAMENTOS} (Cruel e Merciless não criam levels novos).`);
  const t = p.tier;
  if (!t || !Number.isInteger(t.largura) || t.largura < 1 || !Number.isInteger(t.deslocamento) || t.deslocamento < 0 || t.deslocamento >= t.largura) erros.push('progressao: tier precisa de { largura (inteiro ≥ 1), deslocamento (inteiro de 0 a largura − 1) }.');
  const atos = Array.isArray(p.atos) ? p.atos : [];
  if (!atos.length) erros.push('progressao: a lista de atos está vazia.');
  let esperado = 1;
  atos.forEach((a, i) => {
    if (a.ato !== i + 1) erros.push(`progressao: o ${i + 1}º ato está numerado ${a.ato} (a numeração é 1, 2, 3… em sequência).`);
    if (!Number.isInteger(a.de) || !Number.isInteger(a.ate) || a.de > a.ate) { erros.push(`progressao: Ato ${a.ato} com faixa inválida (${a.de}–${a.ate}).`); return; }
    if (a.de !== esperado) erros.push(`progressao: o Ato ${a.ato} começa no level ${a.de}, mas devia ser ${esperado} (faixas contíguas, sem buraco nem sobreposição).`);
    if (a.ate > NIVEL_MAXIMO_DOS_EQUIPAMENTOS) erros.push(`progressao: o Ato ${a.ato} vai até o level ${a.ate}: passa do limite de ${NIVEL_MAXIMO_DOS_EQUIPAMENTOS}.`);
    esperado = a.ate + 1;
    if (t && !erros.some((e) => e.startsWith('progressao: tier'))) {
      const derivado = tiersDoAtoCom(t, a);
      if (a.tiers && JSON.stringify(a.tiers) !== JSON.stringify(derivado)) erros.push(`progressao: o Ato ${a.ato} declara os tiers ${a.tiers.map((x) => `T${x}`).join('–')}, mas a regra de tier das bases dá ${derivado.map((x) => `T${x}`).join('–')} para os levels ${a.de}–${a.ate}.`);
    }
  });
  const est = p.estagioDeRaridade ?? {};
  let anterior = 0;
  for (const a of atos) {
    const e = est[String(a.ato)];
    if (!Number.isInteger(e) || e < 1 || e > 4) erros.push(`progressao: o Ato ${a.ato} precisa de um estágio de raridade de 1 a 4 (veio ${e}).`);
    else { if (e < anterior) erros.push(`progressao: o Ato ${a.ato} usa o estágio de raridade ${e}, abaixo do estágio ${anterior} do Ato anterior: a qualidade do loot nunca cai ao avançar de Ato.`); anterior = e; }
  }
  if (p.tiersDeModificador != null) {
    const tab = p.tiersDeModificador.itemLevel;
    if (!Array.isArray(tab) || !tab.length) erros.push('progressao: tiersDeModificador.itemLevel precisa ser uma lista de { ate, tiers }.');
    else {
      let ateAnterior = 0; let maiorAnterior = 0;
      tab.forEach((f, i) => {
        const ultimo = i === tab.length - 1;
        if (ultimo ? f.ate != null : !(Number.isInteger(f.ate) && f.ate > ateAnterior)) erros.push(`progressao: tiersDeModificador faixa ${i + 1}: "ate" ${ultimo ? 'da última faixa precisa ser vazio (aberta)' : 'precisa crescer (inteiro maior que o da faixa anterior)'}.`);
        if (!Array.isArray(f.tiers) || !f.tiers.length || f.tiers.some((t) => !Number.isInteger(t) || t < 1 || t > 5)) erros.push(`progressao: tiersDeModificador faixa ${i + 1}: tiers precisam ser inteiros de 1 a 5.`);
        else { const maior = Math.max(...f.tiers); if (maior < maiorAnterior) erros.push(`progressao: tiersDeModificador faixa ${i + 1} libera até T${maior}, menos que a faixa anterior (T${maiorAnterior}): o tier liberado nunca cai com o level.`); maiorAnterior = maior; }
        if (Number.isInteger(f.ate)) ateAnterior = f.ate;
      });
    }
  }
  if (atos.length && Number.isInteger(max) && atos.at(-1).ate !== max) erros.push(`progressao: o último ato termina no level ${atos.at(-1).ate}, mas o nível máximo é ${max}.`);
  // dificuldades e loot
  for (const d of DIFICULDADES) {
    if (!dados.dificuldades?.[d]) erros.push(`dificuldades: falta a dificuldade ${d}.`);
    const l = dados.loot?.[d];
    if (!l) { erros.push(`loot: falta a configuração da dificuldade ${d}.`); continue; }
    const onde = `loot ${d}`;
    if (!(Number(l.chanceDeDrop) > 0) || Number(l.chanceDeDrop) > 10) erros.push(`${onde}: chanceDeDrop precisa ser um multiplicador maior que 0 e até 10 (veio ${l.chanceDeDrop}).`);
    if (!(Number(l.chanceDeModificadorExtra ?? 0) >= 0) || Number(l.chanceDeModificadorExtra ?? 0) > 1) erros.push(`${onde}: chanceDeModificadorExtra precisa estar entre 0 e 1 (veio ${l.chanceDeModificadorExtra}).`);
    for (const [r, v] of Object.entries(l.pesosDeRaridade ?? {})) if (!RARIDADES.includes(r) || !(Number(v) >= 0) || !Number.isFinite(Number(v))) erros.push(`${onde}: peso de raridade inválido (${r}: ${v}).`);
    if (Object.keys(l.pesosDeRaridade ?? {}).length && RARIDADES.every((r) => (l.pesosDeRaridade[r] ?? 1) === 0)) erros.push(`${onde}: todos os pesos de raridade são 0 (nada poderia cair).`);
    for (const [k, v] of Object.entries(l.pesosDeTier ?? {})) if (!TIERS_DE_MODIFICADOR.includes(k) || !(Number(v) >= 0) || !Number.isFinite(Number(v))) erros.push(`${onde}: peso de tier inválido (T${k}: ${v}).`);
    if (Object.keys(l.pesosDeTier ?? {}).length && TIERS_DE_MODIFICADOR.every((k) => (l.pesosDeTier[k] ?? 1) === 0)) erros.push(`${onde}: todos os pesos de tier são 0.`);
    if (l.tierMaximo != null && (!Number.isInteger(l.tierMaximo) || l.tierMaximo < 1 || l.tierMaximo > 5)) erros.push(`${onde}: tierMaximo precisa ser vazio ou um inteiro de 1 a 5 (veio ${l.tierMaximo}).`);
  }
  for (const d of Object.keys(dados.loot ?? {})) if (!d.startsWith('_') && !DIFICULDADES.includes(d)) erros.push(`loot: "${d}" não é uma dificuldade (use ${DIFICULDADES.join(', ')}).`);
  // dificuldade inferior mais vantajosa sem intenção
  if (!erros.length) {
    const L = (d) => lootComPadroes(dados.loot[d]);
    for (let i = 0; i < DIFICULDADES.length - 1; i++) {
      const [a, b] = [DIFICULDADES[i], DIFICULDADES[i + 1]];
      const nome = (d) => dados.dificuldades[d]?.nome ?? d;
      if (L(a).chanceDeDrop > L(b).chanceDeDrop) avisos.push(`${nome(a)} tem chance de drop de equipamento (${L(a).chanceDeDrop}×) maior que ${nome(b)} (${L(b).chanceDeDrop}×): a dificuldade inferior ficou mais vantajosa. Intencional?`);
      if ((L(a).chanceDeModificadorExtra ?? 0) > (L(b).chanceDeModificadorExtra ?? 0)) avisos.push(`${nome(a)} dá mais chance de modificador extra (${L(a).chanceDeModificadorExtra}) que ${nome(b)} (${L(b).chanceDeModificadorExtra}). Intencional?`);
      if (distribuicao) {
        const [da, db] = [distribuicao(a), distribuicao(b)];
        if (da && db && da.raroOuMelhor > db.raroOuMelhor + 1e-9) avisos.push(`${nome(a)} tem mais chance de item raro ou melhor (${(da.raroOuMelhor * 100).toFixed(2)}%) que ${nome(b)} (${(db.raroOuMelhor * 100).toFixed(2)}%) no Ato de referência: a dificuldade inferior ficou mais vantajosa. Intencional?`);
      }
    }
  }
  // o catálogo
  if (catalogo && Number.isInteger(max)) {
    const equip = Object.values(catalogo).filter((i) => SLOTS_DE_EQUIPAMENTO.has(i.slot) && !i.stackable);
    const acima = equip.filter((i) => (i.minLevel ?? 0) > Math.min(max, NIVEL_MAXIMO_DOS_EQUIPAMENTOS));
    if (acima.length) avisos.push(`${acima.length} equipamento(s) do catálogo exigem level acima de ${Math.min(max, NIVEL_MAXIMO_DOS_EQUIPAMENTOS)} (ex.: ${acima.slice(0, 3).map((i) => `${i.name} nv ${i.minLevel}`).join('; ')}): não pertencem a nenhum Ato da progressão e nunca seriam elegíveis. Se forem exceções intencionais (conteúdo especial/craft), deixe como está.`);
  }
  return { erros, avisos };
}

// ---------------------------------------------------------------- carga do disco (base + override) e consultas
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', 'gamedata');
export const RAIZ_DOS_DADOS = RAIZ;
const lerJson = (c) => JSON.parse(readFileSync(c, 'utf8'));
/** O arquivo de fábrica (nunca é editado pela Engine). */
export const ORIGINAL = lerJson(join(RAIZ, 'progressao.json'));
export const ARQUIVO_DE_OVERRIDE = join(PASTA_DE_OVERRIDES, 'progressao.json');

/** Lê o override (ignora e avisa se estiver quebrado). `{ ativo, progressao?, dificuldades?, loot?, perfilAtivo? }` ou `null`. */
export function lerOverride(arquivo = ARQUIVO_DE_OVERRIDE, avisar = console.warn) {
  if (!existsSync(arquivo)) return null;
  try { return lerJson(arquivo); } catch (e) { avisar(`[overrides] progressao.json ignorado: ${e.message}`); return null; }
}
/** A configuração EFETIVA: o original com o override por cima (se ativo). Pura (recebe os dois). */
export function efetiva(original, override) {
  if (!override || override.ativo === false) return { progressao: structuredClone(original.progressao), dificuldades: structuredClone(original.dificuldades), loot: structuredClone(original.loot) };
  const sobre = { progressao: override.progressao, dificuldades: override.dificuldades, loot: override.loot };
  return { progressao: mesclar(original.progressao, sobre.progressao), dificuldades: mesclar(original.dificuldades, sobre.dificuldades), loot: mesclar(original.loot, sobre.loot) };
}

/** O estado EM USO (um objeto só, mutado no lugar quando o Hot Reload re-aplica: quem guardou a referência enxerga a mudança). */
export const EM_USO = efetiva(ORIGINAL, null);
export const resultadoDaCarga = { aplicado: false, erros: [], avisos: [] };

/** Aplica um override ao estado em uso. Em modo estrito (Hot Reload) um override inválido NÃO é aplicado. Devolve `{ ok, erros, avisos }`. */
export function aplicar(override, { estrito = false, avisar = console.warn, catalogo = ITEM_CATALOG } = {}) {
  const proposta = efetiva(ORIGINAL, override);
  const v = validarConfiguracao(proposta, { catalogo });
  if (v.erros.length) {
    resultadoDaCarga.erros = v.erros;
    if (!estrito) avisar(`[overrides] progressao.json ignorado: ${v.erros.join(' | ')}`);
    return { ok: false, ...v };
  }
  for (const k of ['progressao', 'dificuldades', 'loot']) { for (const c of Object.keys(EM_USO[k])) delete EM_USO[k][c]; Object.assign(EM_USO[k], proposta[k]); }
  resultadoDaCarga.aplicado = !!override && override.ativo !== false;
  resultadoDaCarga.erros = [];
  resultadoDaCarga.avisos = v.avisos;
  return { ok: true, ...v };
}
// No boot: o override (se houver) entra; inválido é ignorado com aviso e o original segue.
{
  const ov = lerOverride();
  if (ov) { const r = aplicar(ov); if (r.ok) console.log('[overrides] progressão e loot por dificuldade: override aplicado.'); }
}

// consultas (independem da dificuldade)
export const nivelMaximo = () => EM_USO.progressao.nivelMaximoDeEquipamento;
export const atos = () => EM_USO.progressao.atos;
export const faixaDoAto = (ato) => { const a = EM_USO.progressao.atos.find((x) => x.ato === Number(ato)); return a ? { ...a, tiers: tiersDoAtoCom(EM_USO.progressao.tier, a) } : null; };
export const atoDoNivel = (level) => atoDoNivelCom(EM_USO.progressao, level);
export const tierDaBase = (level) => tierDaBaseCom(EM_USO.progressao.tier, level);
export const tiersDoAto = (ato) => faixaDoAto(ato)?.tiers ?? null;
/** O estágio (1–4) da tabela de raridade de `itens/raridades.json` que um Ato da progressão usa. */
export const estagioDeRaridadeDoAto = (ato) => EM_USO.progressao.estagioDeRaridade?.[String(ato)] ?? 1;
/** O loot de uma dificuldade (padrões preenchidos); `dificuldade` desconhecida = a Normal. */
export const lootDa = (dificuldade) => lootComPadroes(EM_USO.loot[DIFICULDADES.includes(dificuldade) ? dificuldade : 'facil']);
export const nomeDaDificuldade = (d) => EM_USO.dificuldades[d]?.nome ?? d;

/** Multiplicador da chance de drop de um ITEM numa dificuldade: só equipamento (peça que rola atributos) é afetado; moedas, gemas e poções ficam como estão. */
export function fatorDeDropDe(dificuldade, itemId) {
  const f = lootDa(dificuldade).chanceDeDrop;
  if (f === 1) return 1;
  const meta = ITEM_CATALOG[itemId];
  return meta && SLOTS_DE_EQUIPAMENTO.has(meta.slot) && !meta.stackable ? f : 1;
}

/**
 * As BASES (equipamentos do catálogo) que pertencem a um Ato: o level mínimo cai na faixa dele. Independe da dificuldade. Filtros: `slot`, `vocacao`.
 * Peças de craft ("Crafted …": só saem da forja) ficam de fora por padrão. Devolve `{ total, porSlot: {slot: n}, porTier: {tier: n}, bases: [{id, nome, slot, minLevel, tier}] (até `limite`) }`.
 */
export function basesDoAto(ato, { slot = null, vocacao = null, incluirCraft = false, limite = 200 } = {}) {
  const f = faixaDoAto(ato);
  if (!f) return null;
  const lista = Object.values(ITEM_CATALOG).filter((i) => SLOTS_DE_EQUIPAMENTO.has(i.slot) && !i.stackable && (i.minLevel ?? 0) >= (f.de === 1 ? 0 : f.de) && (i.minLevel ?? 0) <= f.ate
    && (incluirCraft || !/^Crafted /.test(i.name ?? '')) && (!slot || i.slot === slot) && (!vocacao || !i.vocations?.length || i.vocations.includes(vocacao)));
  const contar = (chave) => lista.reduce((m, i) => { const k = chave(i); m[k] = (m[k] ?? 0) + 1; return m; }, {});
  return { ato: f.ato, de: f.de, ate: f.ate, tiers: f.tiers, total: lista.length, porSlot: contar((i) => i.slot), porTier: contar((i) => `T${tierDaBase(i.minLevel ?? 1)}`),
    bases: lista.sort((a, b) => (a.minLevel ?? 0) - (b.minLevel ?? 0) || a.name.localeCompare(b.name)).slice(0, limite).map((i) => ({ id: i.id, nome: i.name, slot: i.slot, minLevel: i.minLevel ?? 0, tier: tierDaBase(i.minLevel ?? 1) })) };
}

/**
 * Roda `fn` (SÍNCRONA) com uma configuração EFETIVA candidata no lugar da que está em uso, e restaura depois (mesmo se `fn` lançar). É como o simulador avalia uma PROPOSTA com o gerador
 * real sem aplicá-la: o JavaScript é de uma linha só, então nada mais enxerga a configuração provisória durante a simulação.
 */
export function comConfiguracao(candidata, fn) {
  const backup = structuredClone({ progressao: EM_USO.progressao, dificuldades: EM_USO.dificuldades, loot: EM_USO.loot });
  const por = (cfg) => { for (const k of ['progressao', 'dificuldades', 'loot']) { for (const c of Object.keys(EM_USO[k])) delete EM_USO[k][c]; Object.assign(EM_USO[k], structuredClone(cfg[k])); } };
  por(candidata);
  try { return fn(); } finally { por(backup); }
}
