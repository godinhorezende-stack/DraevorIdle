// O ITEM POWER BASE: um indicador de COMPARAÇÃO dos atributos base de um equipamento (config em `gamedata/item-power.json`, override em `gamedata/overrides/item-power.json`).
//
//   IP = Damage × pesoDamage + Block × pesoBlock + Armour × pesoArmour + Evasion × pesoEvasion + EnergyShield × pesoEnergyShield   (cada atributo × seu fator de normalização)
//
// NÃO é DPS, força real do personagem nem garantia de equilíbrio de combate: só olha os atributos BASE do próprio item (sem raridade, afixos, atributos principais, gemas,
// imbuement, conjuntos nem sinergias). Os cinco atributos vêm do MESMO lugar de onde a ficha do jogo os lê (`faixaDoCampo`: o valor cheio do catálogo, com a defesa dividida em
// Armour / Evasion / Energy Shield pelo tipo da base): nenhuma conta de combate é reescrita aqui.
//
// Unidades (auditadas no catálogo): Damage = `attack` (valor único: mínimo = máximo; a média é a própria); Block = `defense` do escudo (o RATING de defesa que a perícia Shielding
// converte em chance de bloqueio — não é %); a defesa da ARMA conta a metade, como em `ficha.bloqueioDaFicha` (`normalizacao.blockDaArma`); Armour/Evasion/Energy Shield = valores
// absolutos. Como nenhum é percentual, os fatores de `normalizacao` valem 1 de fábrica; existem para o dono converter unidades se o jogo mudar.
//
// A CURVA de referência (level → IP esperado) é independente da fórmula: pontos por categoria (= slot) com interpolação entre eles; a classificação compara o IP do item com ela.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ITEM_CATALOG } from './dados.mjs';
import { PASTA as PASTA_DE_OVERRIDES } from './overrides.mjs';
import { defesaDoCatalogo } from './itens/item.mjs';
import { mesclar, tierDaBaseCom, EM_USO as PROGRESSAO_EM_USO } from './progressao.mjs';
const P_TIER = () => PROGRESSAO_EM_USO.progressao.tier;
import * as Atributos from './personagem/atributos.mjs';

export const SLOTS = ['weapon', 'shield', 'head', 'body', 'legs', 'feet', 'ring', 'neck'];
export const ROTULO_DO_SLOT = { weapon: 'Arma', shield: 'Escudo', head: 'Cabeça', body: 'Corpo', legs: 'Pernas', feet: 'Botas', ring: 'Anel', neck: 'Amuleto' };
export const ATRIBUTOS = ['damage', 'block', 'armour', 'evasion', 'energyShield'];
export const ROTULO_DO_ATRIBUTO = { damage: 'Damage', block: 'Block', armour: 'Armour', evasion: 'Evasion', energyShield: 'Energy Shield' };
export const CLASSES_DE_PODER = ['abaixo', 'adequado', 'acima', 'muito-acima'];
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', 'gamedata');
const eNum = (n) => typeof n === 'number' && Number.isFinite(n);
const arred = (n, c = 2) => (eNum(n) ? Number(n.toFixed(c)) : null);

// ---------------------------------------------------------------- atributos base de um item
/**
 * Os atributos BASE de um equipamento (um objeto `meta` do catálogo — o efetivo, o original ou um CANDIDATO de edição): `{ damageMin, damageMax, defesa, armour, evasion, energyShield, cajado }`.
 * Mesma regra da ficha do jogo: o valor cheio do catálogo, com a armadura dividida em Armour / Evasion / Energy Shield pelo tipo da base e pelo level do item (`defesaDoCatalogo`).
 * `null` se não é equipamento dos 8 slots. Só lê.
 */
export function atributosDoMeta(m) {
  if (!m || !SLOTS.includes(m.slot) || m.stackable) return null;
  const inteiro = (v) => { const n = Math.floor(Number(v)); return n > 0 ? n : 0; };
  const d = defesaDoCatalogo(m);
  return { damageMin: inteiro(m.attackMin ?? m.attack), damageMax: inteiro(m.attackMax ?? m.attack), defesa: inteiro(m.defense), armour: d.armor ?? 0, evasion: d.evasion ?? 0, energyShield: d.es ?? 0, cajado: m.wand && eNum(m.wand.min) && eNum(m.wand.max) ? { min: m.wand.min, max: m.wand.max } : null };
}
/** Os atributos base de um item do catálogo pelo id (ver `atributosDoMeta`). */
export const atributosBase = (itemId, catalogo = ITEM_CATALOG) => atributosDoMeta(catalogo[itemId]);

// ---------------------------------------------------------------- a fórmula
/** O Block que entra na conta: o rating de defesa do escudo; a metade (configurável) da defesa da arma; nada nos outros slots. */
export function blockDoItem(defesa, slot, cfg) {
  if (slot === 'shield') return defesa;
  if (slot === 'weapon') return defesa * (cfg.normalizacao.blockDaArma ?? 0.5);
  return 0;
}

/**
 * O Item Power e o detalhamento por atributo. `attrs`: `{ damageMin, damageMax, defesa|block, armour, evasion, energyShield, cajado? }` (qualquer ausente = 0); `slot` decide o
 * Block. Valores negativos ou não numéricos não existem: viram erro em `validarAtributos` e aqui contam 0. Pura.
 */
export function calcular(attrs, cfg, slot = null) {
  const n = (v) => (eNum(v) && v > 0 ? v : 0);
  const cajado = attrs.cajado ? ((n(attrs.cajado.min) + n(attrs.cajado.max)) / 2) * (cfg.normalizacao.danoDoCajado ?? 0) : 0;
  const damage = (n(attrs.damageMin) + n(attrs.damageMax)) / 2 + cajado;
  const block = attrs.block != null ? n(attrs.block) : blockDoItem(n(attrs.defesa), slot, cfg);
  const valores = { damage, block, armour: n(attrs.armour), evasion: n(attrs.evasion), energyShield: n(attrs.energyShield) };
  const contribuicao = {};
  let ip = 0;
  for (const a of ATRIBUTOS) {
    const normalizado = valores[a] * (cfg.normalizacao[a] ?? 1);
    contribuicao[a] = { valor: arred(valores[a], 3), normalizado: arred(normalizado, 3), peso: cfg.pesos[a], pontos: arred(normalizado * cfg.pesos[a], 3) };
    ip += normalizado * cfg.pesos[a];
  }
  return { ip: arred(ip, 3), contribuicao, damage: arred(damage, 3) };
}

/** Valida atributos digitados na simulação (negativos e não numéricos são recusados). */
export function validarAtributos(attrs) {
  const erros = [];
  for (const k of ['damageMin', 'damageMax', 'defesa', 'block', 'armour', 'evasion', 'energyShield']) {
    if (attrs?.[k] === undefined || attrs?.[k] === null || attrs?.[k] === '') continue;
    if (!eNum(Number(attrs[k]))) erros.push(`${k}: precisa ser um número.`);
    else if (Number(attrs[k]) < 0) erros.push(`${k}: não pode ser negativo (${attrs[k]}).`);
  }
  if (eNum(Number(attrs?.damageMin)) && eNum(Number(attrs?.damageMax)) && Number(attrs.damageMin) > Number(attrs.damageMax)) erros.push('damageMin: não pode ser maior que damageMax.');
  return erros;
}

// ---------------------------------------------------------------- a curva
/** Os pontos da curva de uma categoria (o padrão se ela não tem a sua), ordenados por level. */
export const pontosDaCurva = (cfg, categoria) => [...(cfg.curva.categorias?.[categoria] ?? cfg.curva.padrao)].sort((a, b) => a.level - b.level);

/** O IP esperado no `level`: interpolação linear entre os pontos (fora do primeiro/último, vale o valor da ponta). Pura. */
export function esperadoNoLevel(pontos, level) {
  if (!pontos?.length || !eNum(level)) return null;
  if (level <= pontos[0].level) return pontos[0].ip;
  const ult = pontos.at(-1);
  if (level >= ult.level) return ult.ip;
  for (let i = 1; i < pontos.length; i++) {
    const a = pontos[i - 1]; const b = pontos[i];
    if (level <= b.level) return b.level === a.level ? b.ip : a.ip + ((b.ip - a.ip) * (level - a.level)) / (b.level - a.level);
  }
  return ult.ip;
}
export const esperado = (cfg, categoria, level) => arred(esperadoNoLevel(pontosDaCurva(cfg, categoria), level), 3);

/** A curva amostrada de 1 até `ate` de `passo` em `passo` (para o gráfico). */
export function amostrarCurva(cfg, categoria, { ate = 1000, passo = 10 } = {}) {
  const p = pontosDaCurva(cfg, categoria);
  const saida = [];
  for (let l = 1; l <= ate; l += passo) saida.push({ level: l, ip: arred(esperadoNoLevel(p, l), 3) });
  if (saida.at(-1)?.level !== ate) saida.push({ level: ate, ip: arred(esperadoNoLevel(p, ate), 3) });
  return saida;
}

/** Trechos da curva com progressão ABRUPTA: a inclinação passa de `saltoAbruptoFator` × a mediana das inclinações, ou o poder CAI com o level. Pura. */
export function saltosDaCurva(pontos, { saltoAbruptoFator = 3 } = {}) {
  const trechos = [];
  for (let i = 1; i < pontos.length; i++) {
    const a = pontos[i - 1]; const b = pontos[i];
    if (b.level > a.level) trechos.push({ de: a.level, ate: b.level, ipDe: a.ip, ipAte: b.ip, inclinacao: (b.ip - a.ip) / (b.level - a.level) });
  }
  const positivas = trechos.map((t) => t.inclinacao).filter((x) => x > 0).sort((x, y) => x - y);
  const mediana = positivas.length ? positivas[Math.floor(positivas.length / 2)] : 0;
  return trechos.flatMap((t) => {
    if (t.inclinacao < 0) return [{ ...t, tipo: 'queda', mensagem: `o poder esperado CAI de ${t.ipDe} para ${t.ipAte} entre os levels ${t.de} e ${t.ate}.` }];
    if (mediana > 0 && t.inclinacao > mediana * saltoAbruptoFator) return [{ ...t, tipo: 'salto', mensagem: `salto abrupto entre os levels ${t.de} e ${t.ate}: ${arred(t.inclinacao, 3)} IP por level, mais de ${saltoAbruptoFator}× a mediana (${arred(mediana, 3)}).` }];
    return [];
  });
}

// ---------------------------------------------------------------- classificação
/** Classifica a diferença percentual (fração: 0,3 = +30%) pelos limites da configuração. */
export function classeDaDiferenca(diff, cfg) {
  const c = cfg.classificacao;
  if (diff < c.abaixoDe) return 'abaixo';
  if (diff <= c.acimaDe) return 'adequado';
  if (diff <= c.muitoAcimaDe) return 'acima';
  return 'muito-acima';
}

/** A ficha de poder de um `meta` (efetivo, original ou candidato): IP, esperado no level, diferença absoluta e %, classe, tier e o detalhamento. `null` se não é equipamento. */
export function fichaDoMeta(m, cfg) {
  const a = atributosDoMeta(m);
  if (!a) return null;
  const p = calcular(a, cfg, m.slot);
  const level = eNum(m.minLevel) && m.minLevel > 0 ? m.minLevel : null;
  const exp = level != null ? esperado(cfg, m.slot, level) : null;
  let situacao;
  let diff = null; let diffPct = null;
  if (p.ip === 0) situacao = 'sem-poder';
  else if (level == null) situacao = 'sem-level';
  else if (!exp) situacao = 'sem-referencia';
  else { diff = arred(p.ip - exp, 3); diffPct = arred((p.ip - exp) / exp, 4); situacao = classeDaDiferenca(diffPct, cfg); }
  return {
    id: Number(m.id), nome: m.name, slot: m.slot, categoria: m.type ?? m.slot, raridade: m.rarity ?? null, vocations: m.vocations ?? [], twoHanded: !!m.twoHanded,
    minLevel: level, levelRecomendado: level, tier: level != null ? tierDaBaseCom(P_TIER(), level) : null, ip: p.ip, esperado: exp, diferenca: diff, diferencaPct: diffPct, situacao, contribuicao: p.contribuicao,
    atributos: { damageMin: a.damageMin, damageMax: a.damageMax, damage: p.damage, block: p.contribuicao.block.valor, armour: a.armour, evasion: a.evasion, energyShield: a.energyShield, armor: Math.floor(Number(m.armor)) > 0 ? Math.floor(Number(m.armor)) : 0, attack: a.damageMax, defense: a.defesa },
  };
}
export const fichaDePoder = (itemId, cfg, catalogo = ITEM_CATALOG) => fichaDoMeta(catalogo[itemId], cfg);

/** A tabela de TODOS os equipamentos dos 8 slots (sem as peças "Crafted …" se `incluirCraft` for falso): é a base de filtros, curva e relatórios. */
export function fichasDoCatalogo(cfg, { catalogo = ITEM_CATALOG, incluirCraft = true } = {}) {
  const saida = [];
  for (const m of Object.values(catalogo)) {
    if (!SLOTS.includes(m.slot) || m.stackable) continue;
    if (!incluirCraft && /^Crafted /.test(m.name ?? '')) continue;
    saida.push(fichaDePoder(m.id, cfg, catalogo));
  }
  return saida;
}

// ---------------------------------------------------------------- comparação
/** Compara 2+ FICHAS de poder (de itens reais, originais ou candidatos de edição): diferença contra a PRIMEIRA (absoluta e %) e o atributo que mais explica a diferença. */
export function compararFichas(fichas) {
  if (fichas.length < 2) return { ok: false, erros: ['Escolha ao menos dois equipamentos válidos para comparar.'] };
  const ref = fichas[0];
  const linhas = fichas.map((f) => {
    const dif = f.ip - ref.ip;
    const porAtributo = ATRIBUTOS.map((a) => ({ atributo: a, pontos: f.contribuicao[a].pontos, diferenca: arred(f.contribuicao[a].pontos - ref.contribuicao[a].pontos, 3) }));
    const maior = [...porAtributo].filter((x) => x.diferenca !== 0).sort((x, y) => Math.abs(y.diferenca) - Math.abs(x.diferenca))[0] ?? null;
    return { ...f, contraReferencia: { diferenca: arred(dif, 3), diferencaPct: ref.ip ? arred(dif / ref.ip, 4) : null, porAtributo, maiorContribuinte: maior?.atributo ?? null } };
  });
  return { ok: true, referencia: ref.id, itens: linhas, aviso: 'Comparação só dos atributos BASE: não é DPS nem força em combate.' };
}
/** Compara 2+ itens (ids) do catálogo efetivo. */
export function compararItens(ids, cfg, catalogo = ITEM_CATALOG) {
  return compararFichas(ids.map((id) => fichaDePoder(id, cfg, catalogo)).filter(Boolean));
}

// ---------------------------------------------------------------- relatórios sobre o catálogo
const mediana = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };

/** Resumo por categoria: quantos itens em cada situação, e o desvio mediano. */
export function resumoPorCategoria(fichas) {
  return SLOTS.map((slot) => {
    const f = fichas.filter((x) => x.slot === slot);
    const classes = Object.fromEntries([...CLASSES_DE_PODER, 'sem-poder', 'sem-level', 'sem-referencia'].map((c) => [c, f.filter((x) => x.situacao === c).length]));
    return { slot, rotulo: ROTULO_DO_SLOT[slot], total: f.length, ...classes, desvioMedianoPct: arred(mediana(f.filter((x) => x.diferencaPct != null).map((x) => x.diferencaPct)), 4) };
  });
}

/** Grandes LACUNAS de poder entre itens da mesma faixa: por slot e por Ato (faixa de level), dois IPs vizinhos com razão acima de `lacunaFator`. */
export function lacunasDePoder(fichas, atos, { lacunaFator = 2 } = {}) {
  const achados = [];
  for (const slot of SLOTS) {
    for (const ato of atos) {
      const grupo = fichas.filter((f) => f.slot === slot && f.ip > 0 && f.minLevel != null && f.minLevel >= ato.de && f.minLevel <= ato.ate).sort((a, b) => a.ip - b.ip);
      for (let i = 1; i < grupo.length; i++) {
        const a = grupo[i - 1]; const b = grupo[i];
        if (b.ip / a.ip > lacunaFator) achados.push({ slot, ato: ato.ato, de: { id: a.id, nome: a.nome, ip: a.ip, minLevel: a.minLevel }, ate: { id: b.id, nome: b.nome, ip: b.ip, minLevel: b.minLevel }, razao: arred(b.ip / a.ip, 2) });
      }
    }
  }
  return achados;
}

// ---------------------------------------------------------------- recalcular a curva a partir dos dados
const quantil = (ordenado, q) => { if (!ordenado.length) return 0; const i = (ordenado.length - 1) * q; const lo = Math.floor(i); const hi = Math.ceil(i); return ordenado[lo] + (ordenado[hi] - ordenado[lo]) * (i - lo); };

/**
 * Uma PROPOSTA de curva calculada dos equipamentos recebidos (`fichas`, já filtradas por quem chama): por categoria, a MEDIANA do IP numa janela em volta de cada level de referência
 * (±25% + 10). A mediana e o descarte de valores atípicos (acima de Q3 + 1,5 × IQR, ou abaixo de Q1 − 1,5 × IQR) impedem que um item exagerado distorça a curva. Pontos sem itens
 * suficientes (`minimoDeItens`) repetem o anterior; com `monotonica` a curva nunca cai. Pura: não grava nada. Devolve `{ categorias: { slot: { pontos, buckets, considerados, descartados } } }`.
 */
export function propostaDeCurva(fichas, { niveis = [1, 25, 50, 100, 150, 200, 300, 400, 600, 1000], minimoDeItens = 3, descartarAtipicos = true, monotonica = true, categorias = SLOTS } = {}) {
  const saida = {};
  for (const slot of categorias) {
    const base = fichas.filter((f) => f.slot === slot && f.ip > 0 && f.minLevel != null);
    let consideradas = base; const descartados = [];
    if (descartarAtipicos && base.length >= 4) {
      const o = base.map((f) => f.ip).sort((a, b) => a - b);
      const q1 = quantil(o, 0.25); const q3 = quantil(o, 0.75); const iqr = q3 - q1;
      consideradas = base.filter((f) => { const ok = f.ip <= q3 + 1.5 * iqr && f.ip >= q1 - 1.5 * iqr; if (!ok) descartados.push({ id: f.id, nome: f.nome, ip: f.ip, minLevel: f.minLevel }); return ok; });
    }
    let anterior = 0; const pontos = []; const buckets = [];
    for (const l of niveis) {
      const n = consideradas.filter((f) => Math.abs(f.minLevel - l) <= l * 0.25 + 10).map((f) => f.ip).sort((a, b) => a - b);
      const med = n.length >= minimoDeItens ? quantil(n, 0.5) : null;
      let v = med ?? anterior; if (monotonica) v = Math.max(anterior, v);
      anterior = v; pontos.push({ level: l, ip: Math.round(v * 10) / 10 }); buckets.push({ level: l, itens: n.length, mediana: med == null ? null : Math.round(med * 10) / 10 });
    }
    const primeiro = pontos.find((p) => p.ip > 0)?.ip ?? 0;
    for (const p of pontos) { if (p.ip === 0) p.ip = primeiro; else break; }
    saida[slot] = { pontos, buckets, considerados: consideradas.length, descartados: descartados.slice(0, 50), totalDescartados: descartados.length };
  }
  return { categorias: saida };
}

// ---------------------------------------------------------------- validação da configuração
const eInt = Number.isInteger;
/** Valida uma configuração completa. Devolve `{ erros, avisos }`. Pura. */
export function validarConfiguracao(c, { nivelMaximo = 1000 } = {}) {
  const erros = []; const avisos = [];
  if (!eInt(c.versaoDaFormula) || c.versaoDaFormula < 1) erros.push('versaoDaFormula: precisa ser um inteiro a partir de 1.');
  const pesoMax = c.limites?.pesoMax ?? 100;
  for (const a of ATRIBUTOS) {
    const p = c.pesos?.[a];
    if (!eNum(p) || p < 0 || p > pesoMax) erros.push(`peso de ${ROTULO_DO_ATRIBUTO[a]}: precisa ser um número de 0 a ${pesoMax} (veio ${p}).`);
    const f = c.normalizacao?.[a];
    if (!eNum(f) || f < 0 || f > 1000) erros.push(`normalização de ${ROTULO_DO_ATRIBUTO[a]}: precisa ser um número de 0 a 1000 (veio ${f}).`);
  }
  for (const k of ['blockDaArma', 'danoDoCajado']) { const f = c.normalizacao?.[k]; if (!eNum(f) || f < 0 || f > 1000) erros.push(`normalização "${k}": precisa ser um número de 0 a 1000 (veio ${f}).`); }
  if (ATRIBUTOS.every((a) => !(c.pesos?.[a] > 0))) erros.push('ao menos um peso precisa ser maior que zero.');
  const cl = c.classificacao ?? {};
  if (![cl.abaixoDe, cl.acimaDe, cl.muitoAcimaDe].every(eNum)) erros.push('classificacao: abaixoDe, acimaDe e muitoAcimaDe precisam ser números.');
  else if (!(cl.abaixoDe < 0 && cl.acimaDe > 0 && cl.acimaDe < cl.muitoAcimaDe)) erros.push('classificacao: use abaixoDe < 0 < acimaDe < muitoAcimaDe (frações: 0,25 = 25%).');
  const curvas = { padrao: c.curva?.padrao, ...Object.fromEntries(Object.entries(c.curva?.categorias ?? {}).map(([k, v]) => [`categoria ${k}`, v])) };
  for (const k of Object.keys(c.curva?.categorias ?? {})) if (!SLOTS.includes(k)) erros.push(`curva: a categoria "${k}" não existe (use ${SLOTS.join(', ')}).`);
  for (const [nome, pontos] of Object.entries(curvas)) {
    if (!Array.isArray(pontos) || pontos.length < 2) { erros.push(`curva ${nome}: precisa de ao menos 2 pontos.`); continue; }
    const vistos = new Set();
    for (const p of pontos) {
      if (!eInt(p?.level) || p.level < 1 || p.level > nivelMaximo) erros.push(`curva ${nome}: o level ${p?.level} precisa ser inteiro de 1 a ${nivelMaximo}.`);
      else if (vistos.has(p.level)) erros.push(`curva ${nome}: o level ${p.level} aparece duas vezes.`);
      else vistos.add(p.level);
      if (!eNum(p?.ip) || p.ip < 0) erros.push(`curva ${nome}: o IP do level ${p?.level} precisa ser um número ≥ 0.`);
    }
    if (!erros.length) for (const s of saltosDaCurva([...pontos].sort((a, b) => a.level - b.level), c.alertas)) avisos.push(`curva ${nome}: ${s.mensagem}`);
  }
  const al = c.alertas ?? {};
  for (const k of ['saltoAbruptoFator', 'lacunaFator']) if (!eNum(al[k]) || al[k] <= 1) erros.push(`alertas.${k}: precisa ser um número maior que 1.`);
  for (const k of ['faixaDoTierPct', 'loteExcessoPct']) if (!eNum(al[k]) || al[k] <= 0) erros.push(`alertas.${k}: precisa ser um número maior que 0.`);
  if (!eInt(al.loteExcessoNiveis) || al.loteExcessoNiveis < 1) erros.push('alertas.loteExcessoNiveis: precisa ser um inteiro a partir de 1.');
  for (const k of ['huntsDemais', 'margemDeLevel']) if (!eInt(al[k]) || al[k] < 1) erros.push(`alertas.${k}: precisa ser um inteiro a partir de 1.`);
  if (!eNum(al.itemMuitoAbaixoPct) || al.itemMuitoAbaixoPct >= 0) erros.push('alertas.itemMuitoAbaixoPct: precisa ser uma fração negativa (-0,6 = 60% abaixo).');
  const ids = new Set();
  for (const r of c.regras ?? []) {
    const onde = `regra ${r?.id ?? '?'}`;
    if (!/^[a-z0-9][a-z0-9_-]{1,59}$/.test(String(r?.id ?? ''))) erros.push(`${onde}: o ID precisa ter 2 a 60 caracteres (minúsculas, números, hífen e sublinhado).`);
    if (ids.has(r?.id)) erros.push(`${onde}: ID repetido.`); ids.add(r?.id);
    if (r.levelMin != null && (!eInt(r.levelMin) || r.levelMin < 1)) erros.push(`${onde}: levelMin inválido.`);
    if (r.levelMax != null && (!eInt(r.levelMax) || r.levelMax > nivelMaximo)) erros.push(`${onde}: levelMax inválido (até ${nivelMaximo}).`);
    if (r.levelMin != null && r.levelMax != null && r.levelMin > r.levelMax) erros.push(`${onde}: levelMin maior que levelMax.`);
    if (r.ipMin != null && (!eNum(r.ipMin) || r.ipMin < 0)) erros.push(`${onde}: ipMin precisa ser ≥ 0.`);
    if (r.ipMax != null && (!eNum(r.ipMax) || r.ipMax < 0)) erros.push(`${onde}: ipMax precisa ser ≥ 0.`);
    if (eNum(r.ipMin) && eNum(r.ipMax) && r.ipMin > r.ipMax) erros.push(`${onde}: ipMin maior que ipMax.`);
    if (r.chance != null && (!eNum(r.chance) || r.chance < 0 || r.chance > 1)) erros.push(`${onde}: chance precisa estar entre 0 e 1.`);
    for (const d of r.dificuldades ?? []) if (!['facil', 'medio', 'dificil'].includes(d)) erros.push(`${onde}: dificuldade "${d}" não existe.`);
    for (const s of r.slots ?? []) if (!SLOTS.includes(s)) erros.push(`${onde}: o slot "${s}" não existe.`);
  }
  return { erros, avisos };
}

// ---------------------------------------------------------------- carga do disco (fábrica + override)
const lerJson = (c) => JSON.parse(readFileSync(c, 'utf8'));
export const ORIGINAL = lerJson(join(RAIZ, 'item-power.json'));
export const ARQUIVO_DE_OVERRIDE = join(PASTA_DE_OVERRIDES, 'item-power.json');
const CAMPOS_DO_OVERRIDE = ['ativo', '_nota', 'versaoDaFormula', 'pesos', 'normalizacao', 'limites', 'classificacao', 'curva', 'alertas', 'regras'];
export { CAMPOS_DO_OVERRIDE };

/** O override (`null` se não existe; ignora e avisa se quebrado). */
export function lerOverride(arquivo = ARQUIVO_DE_OVERRIDE, avisar = console.warn) {
  if (!existsSync(arquivo)) return null;
  try { return lerJson(arquivo); } catch (e) { avisar(`[overrides] item-power.json ignorado: ${e.message}`); return null; }
}
/** A configuração EFETIVA: a fábrica com o override por cima (se ativo). `curva.categorias` mescla por categoria; listas (pontos, regras) substituem. Pura. */
export function efetiva(original, override) {
  const base = { ...structuredClone(original) };
  delete base._nota;
  if (!override || override.ativo === false) return base;
  const { ativo, _nota, ...resto } = override; void ativo; void _nota;
  return mesclar(base, resto);
}

/** O estado EM USO (objeto mutado no lugar quando o Hot Reload re-aplica). */
export const EM_USO = efetiva(ORIGINAL, null);
export const resultadoDaCarga = { aplicado: false, erros: [], avisos: [] };
/** Aplica um override ao estado em uso. Estrito (Hot Reload): inválido NÃO é aplicado. Devolve `{ ok, erros, avisos }`. */
export function aplicar(override, { estrito = false, avisar = console.warn, nivelMaximo = 1000 } = {}) {
  const proposta = efetiva(ORIGINAL, override);
  const v = validarConfiguracao(proposta, { nivelMaximo });
  if (v.erros.length) {
    resultadoDaCarga.erros = v.erros;
    if (!estrito) avisar(`[overrides] item-power.json ignorado: ${v.erros.join(' | ')}`);
    return { ok: false, ...v };
  }
  for (const k of Object.keys(EM_USO)) delete EM_USO[k];
  Object.assign(EM_USO, proposta);
  resultadoDaCarga.aplicado = !!override && override.ativo !== false;
  resultadoDaCarga.erros = [];
  resultadoDaCarga.avisos = v.avisos;
  return { ok: true, ...v };
}
{
  const ov = lerOverride();
  if (ov) { const r = aplicar(ov); if (r.ok) console.log('[overrides] item power: override aplicado.'); }
}
