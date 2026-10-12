// As TINTURAS do PoE (dono, 12/10: "pode seguir com a tintura" — o bloco "criar a Tintura" da árvore). Igual ao PoE 3.29:
//
//   O ITEM: vai no CINTO de frascos (`frascos.mjs` — as Tinturas estão na lista dos frascos de `jogo.mjs`), Normal, Mágica ou Única. A base diz
//           "Inflige Queima de Mana a cada X Segundos" e "N Segundos de Recarga quando Desativado" (`queima_mana_intervalo_s`,
//           `recarga_desativado_s`); os mods dela valem "com Armas Corpo a Corpo" (as condições `@ataque+armaCorpo` e `@corpo` da tradução).
//   ATIVAR: a Tintura fica ATIVA até ser desativada (não gasta cargas). Ativa, ela inflige QUEIMA DE MANA em você a cada X segundos: "Queima de
//           Mana faz com que você perca 1% da sua Mana máxima por acúmulo a cada segundo". Só 1 Tintura ativa por vez ("Você pode ter uma
//           Tintura adicional ativa", a Caçadora).
//   DESATIVAR: na mão, ou quando a mana ACABA; a Queima de Mana dela sai junto e começa a recarga ("N Segundos de Recarga quando Desativado" ÷
//           a "Recuperação da Recarga"). Com "Tinturas infligem Ferimentos Abertos ao invés de Queima de Mana" (a keystone Lâmina
//           Ensanguentada) é a VIDA que vai (1% por acúmulo por segundo) e ela desativa com 1 de vida.
//   AUTOMÁTICO (o jogo é idle — como os frascos): ativa sozinha em combate e desativa fora de combate ou com a mana abaixo de X% (a regra da
//           Tintura, `frascos.configurar`; 0% = só quando a mana acabar, como no PoE).
//
// O estado na caçada mora em `hunt.frascosPoe.tinturas[vaga]` (JSON). O que a Tintura dá (os mods × o Efeito, o "por Queima de Mana") é
// calculado no tique, com a ficha, e guardado como FOTO (`t.af`): `adds` (somado em `Afixos.soma`) só lê a foto — sem ficha cruzada.
import { traduzirParte } from './traduzir.mjs';

export const CLASSE = 'Tinctures';
export const PADRAO = Object.freeze({
  /** Tinturas ativas ao mesmo tempo (+ "Você pode ter uma Tintura adicional ativa"). */
  maxAtivas: 1,
  /** "Queima de Mana faz com que você perca 1% da sua Mana máxima por acúmulo a cada segundo" (o mesmo nos Ferimentos Abertos, na vida). */
  pctPorQueima: 1,
  /** "Efeitos das Tinturas Perduram em você por 0.5 segundos por Queima de Mana … máximo de 6 segundos" (a Caçadora). */
  perduraPorQueimaMs: 500,
  perduraMaxMs: 6000,
  /** "Frascos adjacentes às Tinturas ativas ganham 2 cargas quando você Acertar…, não mais que uma vez por segundo". */
  cargasAdjacentesMs: 1000,
  /** A regra automática de fábrica: ativa em combate; desativa com a mana abaixo de 30% (o mesmo número do frasco de mana). */
  regra: Object.freeze({ emCombate: true, abaixoPct: 30 }),
});

export const ehTintura = (poe) => poe?.classe === CLASSE;
const n = (af, k) => Number(af?.[k]) || 0;

/** As linhas que mexem na própria TINTURA (e não no personagem): o Efeito, a Queima de Mana, a recarga e o "por Queima de Mana" dos únicos. */
const LOCAIS = [
  [/^Efeito aumentado em \{\d+\}%$/, (p, v) => (p.efeitoPct += v)],
  [/^Efeito reduzido em \{\d+\}%$/, (p, v) => (p.efeitoPct -= v)],
  [/^Queima de Mana aumentada em \{\d+\}%$/, (p, v) => (p.queimaPct += v)],
  [/^Queima de Mana reduzida em \{\d+\}%$/, (p, v) => (p.queimaPct -= v)],
  [/^Recuperação da Recarga aumentada em \{\d+\}%$/, (p, v) => (p.recargaPct += v)],
  [/^Recuperação da Recarga reduzida em \{\d+\}%$/, (p, v) => (p.recargaPct -= v)],
  // (A Batalha Interna: "Não inflige Queima de Mana degenerativa" — sem a periódica; "Inflige 1 Queimas de Mana em você quando você Acertar…")
  [/^Não inflige Queima de Mana degenerativa$/, (p) => (p.semPeriodica = true)],
  [/^Inflige \{\d+\} Queimas de Mana em você quando você Acertar um Inimigo com uma Arma Corpo a Corpo$/, (p, v) => (p.queimasAoAcertar += v)],
  [/^Dano de Armas Corpo a Corpo Penetra \{\d+\}% das Resistências Elementais por Queima de Mana, máximo de \{\d+\}%$/, (p, v, nums) => p.porQueima.push({ stat: 'elem_pen@ataque+armaCorpo', v, max: nums[1] })],
  [/^Raridade dos Itens encontrados aumentada em \{\d+\}% por Queima de Mana, máximo de \{\d+\}%$/, (p, v, nums) => p.porQueima.push({ stat: 'item_rarity', v, max: nums[1] })],
  [/^\{\d+\} de Dano de Fogo sofrido dos Acertos por Queima de Mana$/, (p, v) => p.porQueima.push({ stat: 'fire_sofrido_acerto', v, max: null })],
];
/** É linha que a Tintura faz por conta própria? */
export const ehLinhaDaTintura = (parte) => LOCAIS.some(([re]) => re.test(String(parte)));

/**
 * Os parâmetros de uma Tintura (a base + os mods + o que o personagem tem para Tinturas — `afp`): `{ tipo, intervaloMs, recargaMs, efeitoPct,
 * semPeriodica, queimasAoAcertar, porQueima, af, linhas, estadosPorMod }`. `af`: os mods "com Armas Corpo a Corpo" já × o Efeito.
 */
export function parametros(peca, afp = null) {
  const poe = peca?.poe ?? {};
  const a = poe.atributos ?? {};
  const p = { efeitoPct: 0, queimaPct: 0, recargaPct: 0, semPeriodica: false, queimasAoAcertar: 0, porQueima: [] };
  // O do personagem: "Tinturas aplicadas em você têm Efeito aumentado", "… Queima de Mana reduzida", "Recuperação da Recarga de Tinturas".
  p.efeitoPct += n(afp, 'tintura_efeito_inc');
  p.queimaPct += n(afp, 'tintura_queima_inc');
  p.recargaPct += n(afp, 'tintura_recarga_inc');
  const bruto = {};
  const linhas = [];
  const estadosPorMod = [];
  for (const mod of [...(poe.implicitos ?? []), ...(poe.prefixos ?? []), ...(poe.sufixos ?? []), ...(poe.modificadores ?? [])]) {
    const antes = linhas.length;
    for (const parte of String(mod.modelo ?? mod.texto ?? '').split(' / ')) {
      const nums = [...parte.matchAll(/\{(\d+)\}/g)].map((m) => Number(mod.valores?.[Number(m[1])]));
      const local = LOCAIS.find(([re]) => re.test(parte));
      if (local) {
        local[1](p, nums[0] ?? 0, nums);
        linhas.push({ estado: 'efeito' });
        continue;
      }
      const tr = traduzirParte(parte, mod.valores ?? []);
      if (tr.estado === 'lembrete') { linhas.push({ estado: 'lembrete' }); continue; }
      const vale = ['equivalente', 'aproximado', 'novo'].includes(tr.estado);
      if (vale) for (const e of tr.efeitos) if (typeof e.valor === 'number') bruto[e.stat] = (bruto[e.stat] ?? 0) + e.valor;
      linhas.push({ estado: vale ? (tr.estado === 'aproximado' ? 'aproximado' : 'efeito') : tr.estado === 'inerte' ? 'inerte' : 'registrado' });
    }
    const minhas = linhas.slice(antes).filter((l) => l.estado !== 'lembrete');
    const agem = minhas.filter((l) => l.estado === 'efeito' || l.estado === 'aproximado');
    estadosPorMod.push(!minhas.length ? 'lembrete' : minhas.every((l) => l.estado === 'efeito') ? 'equivalente' : agem.length ? 'aproximado' : minhas.every((l) => l.estado === 'inerte') ? 'inerte' : 'registrado');
  }
  const fator = Math.max(0, 1 + p.efeitoPct / 100);
  const af = {};
  for (const [k, v] of Object.entries(bruto)) af[k] = Math.round(v * fator * 100) / 100;
  // A Queima de Mana: "X% reduzida/aumentada" na frequência (o intervalo ÷), e o "X% menos Queima de Mana" (a Caçadora) multiplica.
  const ritmo = Math.max(0.05, (1 + p.queimaPct / 100) * Math.max(0, 1 - n(afp, 'tintura_queima_menos') / 100));
  return {
    tipo: 'tintura',
    intervaloMs: Math.max(50, Math.round((Number(a.queima_mana_intervalo_s) || 1) * 1000 / ritmo)),
    recargaMs: Math.max(0, Math.round((Number(a.recarga_desativado_s) || 0) * 1000 / Math.max(0.1, 1 + p.recargaPct / 100))),
    efeitoPct: p.efeitoPct,
    semPeriodica: p.semPeriodica,
    queimasAoAcertar: p.queimasAoAcertar,
    porQueima: p.porQueima.map((x) => ({ ...x, v: Math.round(x.v * fator * 100) / 100 })),
    af,
    linhas,
    estadosPorMod,
  };
}

/** O resumo para o balão: a Queima de Mana, a recarga, o Efeito. */
export function resumo(peca) {
  const par = parametros(peca);
  return { tipo: 'tintura', queimaCadaS: par.intervaloMs / 1000, recargaS: par.recargaMs / 1000, efeitoPct: par.efeitoPct, semPeriodica: par.semPeriodica, queimasAoAcertar: par.queimasAoAcertar };
}

// ---------------------------------------------------------------- na caçada

/** O registro das Tinturas na caçada (`hunt.frascosPoe.tinturas`): por vaga do cinto. */
export const registro = (st) => (st.tinturas ??= {});
/** As Tinturas ATIVAS agora: `[[vaga, t]]`. */
export const ativas = (st) => Object.entries(st?.tinturas ?? {}).filter(([, t]) => t?.ativa);
/** A Queima de Mana em você (a soma das Tinturas ativas). */
export const queimasEmVoce = (st) => ativas(st).reduce((s, [, t]) => s + (t.queimas ?? 0), 0);
/** Quantas Tinturas podem ficar ativas. */
export const maxAtivas = (afp) => PADRAO.maxAtivas + Math.max(0, Math.floor(n(afp, 'tintura_ativas_extra')));
/** Ferimentos Abertos no lugar da Queima de Mana (a Lâmina Ensanguentada)? */
const ferimentos = (afp) => n(afp, 'tintura_ferimentos') > 0;

/**
 * ATIVA a Tintura da vaga `v` (o estado do personagem, a peça, o `afp` da ficha): pronta (fora da recarga), abaixo do máximo de ativas e com
 * mana (ou vida, nos Ferimentos Abertos). "Recupere X% de Mana ao ativar uma Tintura". Devolve true se ativou.
 */
export function ativar(estado, st, v, peca, afp, agora) {
  const reg = registro(st);
  const t = reg[v];
  if (t?.ativa || (t?.recargaAte ?? 0) > agora) return false;
  if (ativas(st).length >= maxAtivas(afp)) return false;
  if (ferimentos(afp) ? (estado.hp ?? 0) <= 1 : (estado.mana ?? 0) <= 0) return false;
  const par = parametros(peca, afp);
  reg[v] = { ativa: true, desde: agora, proxima: agora + par.intervaloMs, queimas: 0, nome: peca.poe?.nome ?? 'Tintura' };
  const mana = n(afp, 'tintura_mana_ativar_pct');
  if (mana > 0) estado.mana = Math.min(estado.maxMana ?? 0, (estado.mana ?? 0) + ((estado.maxMana ?? 0) * mana) / 100);
  fotografar(reg[v], par, afp, 0);
  return true;
}

/**
 * DESATIVA a Tintura da vaga `v`: a Queima de Mana dela sai, começa a recarga e — "Efeitos das Tinturas Perduram em você por 0.5 segundos por
 * Queima de Mana em você quando a Tintura foi desativada, máximo de 6 segundos" — o efeito fica pelo tempo.
 */
export function desativar(st, v, peca, afp, agora) {
  const reg = registro(st);
  const t = reg[v];
  if (!t?.ativa) return false;
  const par = parametros(peca, afp);
  const perdura = n(afp, 'tintura_perdura') > 0 ? Math.min(PADRAO.perduraMaxMs, PADRAO.perduraPorQueimaMs * queimasEmVoce(st)) : 0;
  reg[v] = { ativa: false, recargaAte: agora + par.recargaMs, recargaTotal: par.recargaMs, nome: t.nome, ...(perdura > 0 ? { perduraAte: agora + perdura, af: t.af } : {}) };
  return true;
}

/** A FOTO do que a Tintura dá agora: os mods × o Efeito (+ "também se aplicam às Armas à Distância") e o "por Queima de Mana" (`q`). */
function fotografar(t, par, afp, q) {
  const distancia = n(afp, 'tintura_distancia') > 0;
  const af = {};
  const somar = (k, v) => { af[k] = Math.round(((af[k] ?? 0) + v) * 100) / 100; };
  // ("Efeitos das Tinturas também se aplicam às Armas à Distância": sem a condição de arma corpo a corpo — os ataques com qualquer arma.)
  const chave = (k) => (distancia ? k.replace(/\+armaCorpo|armaCorpo\+?/g, '').replace(/@corpo\b/, '@ataque').replace(/@$/, '') : k);
  for (const [k, v] of Object.entries(par.af)) somar(chave(k), v);
  for (const x of par.porQueima) somar(chave(x.stat), x.max != null ? Math.sign(x.v) * Math.min(Math.abs(x.v * q), x.max) : x.v * q);
  t.af = af;
}

/**
 * O TIQUE das Tinturas (`frascos.tique`, a cada tique da caçada): a Queima de Mana (a periódica e a "quando você Acertar"), a mana que ela
 * tira, as desativações (a mana acabou, "Tinturas são desativadas quando você tiver 12 ou mais de Queima de Mana"), as cargas dos frascos
 * ADJACENTES e as fotos. `cinto`: as vagas; `afp`: a ficha do personagem; `acertos`: os acertos de ataque desde o último tique. Devolve se o
 * que as Tinturas dão mudou (quem chama refaz a ficha).
 */
export function tique(estado, st, cinto, afp, agora, { acertos = 0, rng = Math.random, cargasNoFrasco = null } = {}) {
  const reg = registro(st);
  let mudou = false;
  const dt = Math.max(0, agora - (st.tinturaUltimo ?? agora));
  st.tinturaUltimo = agora;
  // O efeito que PERDURA acaba.
  for (const t of Object.values(reg)) if (!t.ativa && t.perduraAte && t.perduraAte <= agora) { delete t.perduraAte; delete t.af; mudou = true; }
  const lista = ativas(st);
  if (!lista.length) {
    if (st.tinturaExtras) { delete st.tinturaExtras; mudou = true; }
    return mudou;
  }
  // ("quando você Acertar um Inimigo com uma Arma Corpo a Corpo": o ataque com a arma corpo a corpo — com "também se aplicam às Armas à
  // Distância", qualquer arma)
  const acertosValem = acertos > 0 && (armaCorpoACorpo(estado) || n(afp, 'tintura_distancia') > 0) ? acertos : 0;
  const semQueima = n(afp, 'tintura_sem_queima_chance');
  for (const [v, t] of lista) {
    const peca = cinto[v];
    if (!peca) { delete reg[v]; mudou = true; continue; }
    const par = parametros(peca, afp);
    if (!par.semPeriodica) {
      while (agora >= t.proxima) {
        t.proxima += par.intervaloMs;
        // ("X% de chance de Tinturas não infligirem Queima de Mana")
        if (!(semQueima > 0 && rng() * 100 < semQueima)) t.queimas += 1;
      }
    } else t.proxima = agora + par.intervaloMs;
    t.queimas += acertosValem * par.queimasAoAcertar;
  }
  // ("Frascos adjacentes às Tinturas ativas ganham 2 cargas quando você Acertar um Inimigo com uma Arma Corpo a Corpo, não mais que uma vez
  // por segundo")
  const adjacentes = n(afp, 'tintura_cargas_adjacentes');
  if (adjacentes > 0 && acertosValem > 0 && agora - (st.cargasAdjacentesEm ?? -Infinity) >= PADRAO.cargasAdjacentesMs) {
    st.cargasAdjacentesEm = agora;
    const vagas = new Set(lista.flatMap(([v]) => [Number(v) - 1, Number(v) + 1]));
    for (const w of vagas) if (cinto[w] && !ehTintura(cinto[w].poe)) cargasNoFrasco?.(w, adjacentes);
  }
  // A Queima de Mana em você: "As primeiras 6 Queimas de Mana aplicadas em você não tem efeito".
  const q = queimasEmVoce(st);
  const valem = Math.max(0, q - Math.max(0, Math.floor(n(afp, 'tintura_queimas_gratis'))));
  let acabou = false;
  if (ferimentos(afp)) {
    // (Ferimentos Abertos: a vida, até 1 — "Tinturas são desativadas quando você tem 1 de vida restante")
    if (valem > 0) estado.hp = Math.max(1, (estado.hp ?? 0) - ((estado.maxHp ?? 0) * PADRAO.pctPorQueima * valem * dt) / 100000);
    acabou = (estado.hp ?? 0) <= 1;
  } else {
    if (valem > 0) estado.mana = Math.max(0, (estado.mana ?? 0) - ((estado.maxMana ?? 0) * PADRAO.pctPorQueima * valem * dt) / 100000);
    acabou = q > 0 && (estado.mana ?? 0) <= 0;
  }
  const teto = n(afp, 'tintura_desativa_queimas');
  if (acabou || (teto > 0 && q >= teto)) {
    for (const [v] of lista) desativar(st, v, cinto[v], afp, agora);
    delete st.tinturaExtras;
    return true;
  }
  // (do personagem, uma vez só: "Cargas de Frascos recebidas aumentadas em 1% por Queima de Mana em você")
  const porQueima = n(afp, 'frasco_cargas_por_queima') * q;
  const extras = porQueima ? { frasco_cargas_recebidas: porQueima } : null;
  if (JSON.stringify(extras) !== JSON.stringify(st.tinturaExtras ?? null)) { mudou = true; if (extras) st.tinturaExtras = extras; else delete st.tinturaExtras; }
  for (const [v, t] of lista) {
    const antes = JSON.stringify(t.af);
    fotografar(t, parametros(cinto[v], afp), afp, q);
    if (JSON.stringify(t.af) !== antes) mudou = true;
  }
  return mudou;
}

/** "X% de chance de remover N Queima de Mana ao Matar" (A Lâmina Viva): tira da Tintura ativa com mais Queima de Mana. */
export function removerQueimas(st, quantas) {
  const [, t] = ativas(st).sort((a, b) => (b[1].queimas ?? 0) - (a[1].queimas ?? 0))[0] ?? [];
  if (!t || !(quantas > 0)) return false;
  t.queimas = Math.max(0, (t.queimas ?? 0) - Math.floor(quantas));
  return true;
}

/** A arma do personagem é de corpo a corpo (não Arco nem Varinha)? */
export function armaCorpoACorpo(estado) {
  const classe = estado?.equipment?.weapon?.poe?.classe;
  return !!classe && classe !== 'Bows' && classe !== 'Wands';
}

/** O que as Tinturas dão agora (somado em `Afixos.soma`): as fotos das ativas e das que perduram. null: nada. */
export function adds(st, agora) {
  const total = { ...(st?.tinturaExtras ?? {}) };
  for (const t of Object.values(st?.tinturas ?? {})) {
    if (!t?.af || !(t.ativa || (t.perduraAte ?? 0) > agora)) continue;
    for (const [k, v] of Object.entries(t.af)) total[k] = (total[k] ?? 0) + v;
  }
  return Object.keys(total).length ? total : null;
}
