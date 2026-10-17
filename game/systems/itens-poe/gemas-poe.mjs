// As GEMAS DO PoE dentro do JOGO (dono, 06/10: "as gemas do PoE substituem as do Draevor, mas tenta conciliar os efeitos nas magias").
// Só com ITENS_POE=1 e a coleção do dono baixada (`poe-gemas-poedb`, ver `admin/gemas-poe.mjs`).
//
//   O INTERPRETADOR é o da Arena de Gemas do dono (`engine/src/gemas/compilador.mjs`, puro: roda no Node): a gema no nível N vira os
//   números do PoE — dano por elemento, custo, tempo de uso, recarga, eficácia (ataques), crítico, raio, chances, buffs e maldições.
//
//   O MOLDE é uma magia do Draevor do mesmo FORMATO e ELEMENTO (é o "conciliar os efeitos"): o projétil de fogo do Flame Strike, a área no
//   chão do Great Fireball, a onda do Ice Wave, o feixe do Energy Beam, o golpe do Brutal Strike, a corrente do Forked Glacier... A gema do
//   PoE ganha a magia dela no catálogo de ações (`poe-gema:<slug>`) com a forma, o efeito visual e o projétil do molde, e os números do PoE.
//   As auras, arautos, guardas, gritos e maldições viram REFORÇOS (o sistema de buffs do Draevor): os efeitos calculados no nível da gema
//   de quem lançou, guardados no próprio buff, e os atributos deles (armadura, resistências, dano adicionado...) somados na ficha (`adds`).
//
//   O STATUS NO JOGO de cada gema (funciona / parcial / não, com os motivos) diz o que o combate do Draevor faz dela — separado do status
//   da Arena do dono. Lacaios e totens ainda não existem no jogo (o Draevor tem só o familiar): a gema existe, mas a skill avisa.
//
// No modo PoE, estas gemas SUBSTITUEM as gemas ativas do Draevor (drop, loja, iniciais); os SUPORTES do Draevor seguem valendo nelas
// (pelas tags). Sem o PoE nada disto roda.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { ligado } from './catalogo.mjs';
import { slugDoNome, partir, condicoesDe, vale } from './condicoes-poe.mjs';
import { comNiveisDoPoedb } from './gemas-niveis.mjs';
import * as Vinculos from './vinculos.mjs';
import { ehLinhaDoAco } from './convocar-o-aco.mjs';
import { ehLinhaLocalDaGema, atributosDasLinhas, atributosDoBuff, ehLinhaDoBuff } from './linhas-das-gemas.mjs';
import { ACTION_CATALOG } from '../dados.mjs';

// As gemas (`game/tools/importar-gemas-poe.mjs`, da coleção do dono) e o interpretador delas (`compilador-de-gemas/`): no repositório.
const ARQ_GEMAS = new URL('../../gamedata/itens-poe/gemas-poe.json', import.meta.url);
// (09/10) O ÍCONE DA HABILIDADE de cada gema (o que vai na barra de slots, como no PoE — "SkillIcons/iconcleave"; o da gema é o do item):
// `slug → arquivo` em `gamedata/itens-poe/icones-habilidades/` (tools/importar-poedb-gemas.mjs, das páginas do poedb).
const ARQ_ICONES_DAS_HABILIDADES = new URL('../../gamedata/itens-poe/icones-habilidades.json', import.meta.url);
let ICONES_DAS_HABILIDADES = null;
const iconeDaHabilidade = (slug) => {
  ICONES_DAS_HABILIDADES ??= existsSync(ARQ_ICONES_DAS_HABILIDADES) ? JSON.parse(readFileSync(ARQ_ICONES_DAS_HABILIDADES, 'utf8')).icones ?? {} : {};
  return ICONES_DAS_HABILIDADES[slug] ?? null;
};
const ARQ_IDS = new URL('../../gamedata/itens-poe/gemas-poe-ids.json', import.meta.url);
export const PREFIXO = 'poe-gema:';
// 916001 (não 912001: a Lapidadora, a Fundidora e os orbes do Draevor são 912001–912004).
const PRIMEIRO_ID = 916001;

/** O elemento do PoE (o da arena) → o do Draevor. O caos do PoE fica `chaos` (a resistência a caos já existe; o desenho é o de morte). */
export const ELEMENTO = { fisico: 'physical', fogo: 'fire', gelo: 'ice', raio: 'energy', caos: 'chaos' };
const VISUAL = { physical: 'physical', fire: 'fire', ice: 'ice', energy: 'energy', chaos: 'death' };

// ---- os MOLDES (id da magia do Draevor) por formato e elemento ----
const MOLDES = {
  projetil: { fire: 'spell-flame-strike', ice: 'spell-ice-strike', energy: 'spell-energy-strike', physical: 'spell-ethereal-spear', death: 'spell-death-strike' },
  chao: { fire: 'rune-great-fireball-rune', ice: 'rune-avalanche-rune', energy: 'rune-thunderstorm-rune', physical: 'spell-ethereal-barrage', death: 'spell-death-echo' },
  // A nova pega em VOLTA, cheia (a "Ice Burst" do Draevor é um anel de 2 a 4 casas, oco no meio: a Nova de Gelo não pegava quem estava
  // colado). A de gelo usa a forma cheia da de fogo; a cor é a do gelo (o efeito do elemento entra por cima).
  nova: { fire: 'spell-hell-s-core', ice: 'spell-hell-s-core', energy: 'spell-rage-of-the-skies', physical: 'spell-groundshaker', death: 'spell-wrath-of-nature' },
  onda: { fire: 'spell-fire-wave', ice: 'spell-ice-wave', energy: 'spell-energy-wave', physical: 'spell-front-sweep', death: 'spell-terra-wave' },
  feixe: { fire: 'spell-fire-wave', ice: 'spell-ice-wave', energy: 'spell-energy-beam', physical: 'spell-front-sweep', death: 'spell-great-death-beam' },
  cadeia: { ice: 'spell-forked-glacier', fire: 'spell-forked-thorns', energy: 'spell-forked-thorns', physical: 'spell-forked-thorns', death: 'spell-forked-thorns' },
};
/** O formato de cada arquétipo da arena (o `carga` dos objetos: armadilha e mina valem pelo que soltam). */
const FORMATO = { projetil: 'projetil', area: 'chao', chuva: 'chao', orbe: 'chao', marca: 'chao', armadilha: 'chao', mina: 'chao', nova: 'nova', impacto: 'onda', canalizacao: 'feixe', ricochete: 'cadeia' };
/** (17/10, lote G10) O formato de gemas que o arquétipo erra: a Rajada de Chamas canaliza uma EXPLOSÃO no lugar mirado (não o feixe). */
const FORMATO_PROPRIO = { Flameblast: 'chao' };
const BUFF = new Set(['aura', 'arauto', 'guarda', 'clamor', 'maldicao']);
const SEM_NO_JOGO = { generico: 'a gema não tem comportamento de combate reconhecido' };
/**
 * (14/10, a árvore principal) As gemas com comportamento próprio, que o classificador da arena não conhece: o INFESTADOR (Plague Bearer —
 * `acoes.tiqueDaPraga`) e o FEITICEIRO (Spellslinger — a reserva em `reserva.pedida`, o gatilho em `acoes.ativarGatilhos`).
 */
const ARQUETIPO_PROPRIO = { Plague_Bearer: 'praga', Spellslinger: 'feiticeiro' };
/**
 * O INFESTADOR do PoE (RePoE, `corrosive_shroud_*`): o Valor Máximo da Praga por nível (`MAX_DA_PRAGA[n]`, do 1 ao 40), 40% do Dano Esperado
 * de cada Veneno infligido enquanto Incubando, 20% menos Dano com Veneno enquanto Incubando (fora do máximo), Infestando 12% do Valor do início
 * por segundo (+0,2% por qualidade); recarga 0,5 s. O raio da Infestação, que o PoE não publica: 2 casas.
 */
export const PRAGA = Object.freeze({ ganhoPct: 40, menosVenenoPct: 20, porSegundoPct: 12, qualidadePorPonto: 0.2, recargaMs: 500, raio: 2 });
const MAX_DA_PRAGA = [0, 4000, 5903, 8655, 12616, 18299, 26429, 38027, 54530, 77962, 98791, 125046, 158112, 199725, 252058, 317825, 400423, 504097, 634145, 797189, 1000000,
  1100000, 1180000, 1245000, 1300000, 1350000, 1400000, 1450000, 1500000, 1550000, 1600000, 1650000, 1700000, 1750000, 1800000, 1850000, 1900000, 1950000, 2000000, 2050000, 2100000];
export const maxDaPraga = (nivel) => MAX_DA_PRAGA[Math.max(1, Math.min(40, Math.floor(Number(nivel) || 1)))];
/**
 * O FEITICEIRO do PoE no nível (as linhas da gema): `pct` — "Habilidades Suportadas têm Dano Mágico Adicional igual a X% do Dano da Varinha
 * Equipada"; `menos` — "causam X% menos Dano com Acertos e Afecções"; `recuperacao` — "Velocidade de Recuperação da Recarga aumentada em X%"
 * (a recarga do gatilho, 0,6 s); `reservaPct` — cada magia suportada reserva 20% da mana (RePoE: `mana_percent`).
 */
export const FEITICEIRO = Object.freeze({ recargaMs: 600, reservaPct: 20 });
export function feiticeiroNoNivel(nivel = 1) {
  const linhas = textosDaGema('Spellslinger', nivel).linhas;
  const achar = (re) => { for (const l of linhas) { const m = re.exec(l); if (m) return Number(m[1]); } return 0; };
  const recuperacao = achar(/Recuperação da Recarga aumentada em (\d+(?:\.\d+)?) ?%/);
  return {
    pct: achar(/Dano Mágico Adicional igual a (\d+(?:\.\d+)?) ?% do Dano da Varinha/), menos: achar(/causam (\d+(?:\.\d+)?) ?% menos Dano/), recuperacao,
    recargaMs: Math.round(FEITICEIRO.recargaMs / (1 + recuperacao / 100)),
  };
}
/** Lacaios e totens (`itens-poe/lacaios-poe.mjs`): as linhas que o jogo faz. (Aqui, e não lá: o módulo dos lacaios importa este.) */
const LINHA_DE_LACAIO = /^Máximo de |^\+\d+ ao número máximo de Totens|^Convoca \d+ |^Duração base é de|^Totem dura|Lacaios? têm .*mais Vida|Lacaios? causam? .*(mais|menos) Dano|são de Nível|Invoca um Totem que usa|^Golens (aumentam|concedem)|mais Velocidade de Ataque|sempre Golpes Críticos|Multiplicador de Acerto Crítico|Dano Físico adicional|infligir Sangramento|Velocidade de Ataque dos Lacaios|Chance de Golpe Crítico aumentada|Multiplicador de Golpe Crítico|Chance de Bloquear o Dano de Ataques|Vida Regenerada por Segundo|Regenera .*da Vida por segundo|Aura dos Robôs/i;
export const ehLinhaDeLacaio = (l) => LINHA_DE_LACAIO.test(l);

const acaoPorId = (id) => ACTION_CATALOG.spells.find((e) => e.id === id) ?? ACTION_CATALOG.runes?.find((e) => e.id === id) ?? null;

let COMPILADOR = null;
let GEMAS = [];
const POR_SLUG = new Map();
/** slug → `{ itemId, acao, arquetipo, carga, formato, elemento, ataque, buff, bloqueio, statusNoJogo, motivosNoJogo, nivelMax, gema }` */
export const REGISTRO = new Map();
const CACHE = new Map();

/** (uma frase nova começa numa faixa "(a — b)" quando a parte de antes já tem a sua faixa e termina num número, "%" ou palavra fechada) */
function partirQualidade(t) {
  const out = [];
  let resto = String(t);
  for (;;) {
    const re = / (?=[+-]?\(-?\d[^)]*—[^)]*\))/g;
    let corte = -1;
    for (let m; (m = re.exec(resto));) if (/\(-?\d[^)]*—[^)]*\)/.test(resto.slice(0, m.index)) && !/\b(em|de|a|até|por|ao|do|da)$/i.test(resto.slice(0, m.index))) { corte = m.index; break; }
    if (corte < 0) { out.push(resto); return out; }
    out.push(resto.slice(0, corte));
    resto = resto.slice(corte + 1);
  }
}
/** As linhas da QUALIDADE da gema no valor da fração `q` (0–1). */
const linhasDaQualidade = (g, q) => (g?.qualidade ?? []).flatMap(partirQualidade).map((t) => naFracao(t, q));
/**
 * A gema compilada no nível (cache): os números do PoE (`compilarHabilidade` da arena do dono). (17/10, lote G2: + a QUALIDADE, 0–20 — as
 * linhas dela entram com as do nível: "+0.4 metros de raio", "+2 segundos à duração base", "Dispara +1 projétil"…)
 */
export function compilada(slug, nivel = 1, qualidade = 0) {
  const g = POR_SLUG.get(slug);
  if (!g || !COMPILADOR) return null;
  const n = Math.max(1, Math.min(nivel | 0 || 1, COMPILADOR.nivelMaximo?.(g) ?? 40));
  const q = Math.max(0, Math.min(20, Math.round(Number(qualidade) || 0)));
  const k = `${slug}@${n}@${q}`;
  if (!CACHE.has(k)) {
    const h = COMPILADOR.compilarHabilidade(g, n, q > 0 ? linhasDaQualidade(g, q / 20) : []);
    CACHE.set(k, h && ARQUETIPO_PROPRIO[slug] ? { ...h, arquetipo: ARQUETIPO_PROPRIO[slug] } : h);
  }
  return CACHE.get(k);
}

/**
 * Os TEMPOS do PoE da gema no nível (dono, 06/10: "cooldown e cast corretos com o do PoE"): o tempo de conjuração da magia (s), a recarga
 * própria (s, só as que têm "Recarga" no PoE — a maioria não tem) com as cargas, e a velocidade de ataque da gema de ataque ("X% de base":
 * o golpe da arma × X%).
 */
export function temposNoNivel(slug, nivel = 1, qualidade = 0) {
  // (17/10, lote G2: + a qualidade — "Velocidade de Recarga aumentada em X%" da qualidade encurta a recarga)
  const st = compilada(slug, nivel, qualidade)?.stats ?? {};
  return { conjuracaoMs: Math.round((st.tempoUso ?? 0) * 1000), recargaMs: st.recarga ? Math.round(st.recarga * 1000) : 0, cargas: st.cargas ?? 1, velAtaqueBase: st.velAtaqueBase ?? 100, velClamor: st.velClamor ?? 0 };
}

/**
 * Os ALVOS da gema no nível (dono, 06/10: "o arco elétrico bate em vários mobs como no PoE?"): o que as linhas da gema dizem, com os números
 * DESTE nível — `saltos` ("Ricocheteia +4 Vezes": a cadeia, 1 + saltos alvos), `pctPorRestante` ("15% mais Dano por cada Ricochete
 * restante"), `perfurar` (N alvos, ou 99 = "todos"), `projeteis` adicionais, `bifurcar` ("se Difundem") e `divide` ("o feixe se divide em
 * direção a N alvos adicionais"). Antes o jogo usava os da magia-molde do Draevor (a cadeia sempre de 6 alvos).
 */
const REGRAS_DE_ALVOS = [
  [/^(?:Projétil Primário )?(?:Raios )?Ricocheteiam? \+?(\d+) Vez/i, (m, a) => { a.saltos += Number(m[1]); }],
  [/(\d+) ?% mais Dano .*por (?:cada )?Ricochete restante/i, (m, a) => { a.pctPorRestante += Number(m[1]); }],
  [/Perfuram todos (?:os )?Alvos/i, (m, a) => { a.perfurar = 99; }],
  [/Perfuram (\d+) Alvos adiciona/i, (m, a) => { a.perfurar = Math.max(a.perfurar, Number(m[1])); }],
  [/^Dispara (\d+) Projéteis adicionais$/i, (m, a) => { a.projeteis += Number(m[1]); }],
  // (11/10) A quantidade BASE ("Dispara 15 projéteis", "Dispara 9 Flechas") e "Dispara Projéteis em sequência" (todos podem ir no alvo):
  // a emissão de `skills/golpes-secundarios.resolver`.
  // (só aparecem na gema que os declara)
  [/^Dispara (\d+) (?:projéteis|flechas)$/i, (m, a) => { a.base = Math.max(a.base ?? 0, Number(m[1])); }],
  [/^Dispara Projéteis em sequência$/i, (m, a) => { a.sequencia = true; }],
  [/^Dispara (?:um|1) Projétil adicional$/i, (m, a) => { a.projeteis += 1; }],
  // (17/10, lote G2) a qualidade escreve os adicionais com "+": "Dispara +2 projéteis", "Dispara +1 Flecha" (a fração arredonda para baixo)
  [/^Dispara \+(\d+(?:\.\d+)?) (?:projéteis|projétil|Flechas?)$/i, (m, a) => { a.projeteis += Math.floor(Number(m[1])); }],
  [/se divide em direção a (\d+) alvos adiciona/i, (m, a) => { a.divide += Number(m[1]); }],
  // (12/10) O Aço Violento: "Projéteis se Partem na direção de N alvos" (o compilador lia o número, mas nada o usava: a divisão não saía).
  [/^Projéteis se Partem na direção de (\d+) alvos$/i, (m, a) => { a.divide += Number(m[1]); }],
  [/^Projéteis se Difundem$/i, (m, a) => { a.bifurcar = Math.max(a.bifurcar, 2); }],
];
/** As linhas da gema no nível (os números DESTE nível), e o "RequerNível" dele — para quem lê a gema fora daqui (os lacaios). */
export function textosDaGema(slug, nivel = 1) {
  const g = POR_SLUG.get(slug);
  if (!g || !COMPILADOR?.textosDoNivel) return { linhas: [], props: [], requer: 1 };
  const n = Math.max(1, Math.min(nivel | 0 || 1, COMPILADOR.nivelMaximo?.(g) ?? 40));
  return { linhas: COMPILADOR.textosDoNivel(g, n), props: COMPILADOR.propsDoNivel(g, n), requer: COMPILADOR.basicosDoNivel(g, n).nivelReq ?? g.nivelReq ?? 1, nome: g.nome, tags: g.tags ?? [] };
}

/**
 * (11/10) A RETALIAÇÃO do PoE: "Não pode ser usado por padrão — Se Torna Utilizável uma vez por 2 segundos quando você Bloquear um Acerto"
 * (`'bloquear'`) ou "quando você sofrer um Acerto Selvagem" (`'selvagem'` — o Clamor Vingativo). Null: a gema usa-se sempre.
 */
export function gatilhoDeRetaliacao(slug) {
  for (const l of textosDaGema(slug, 1).linhas) {
    if (!/Se Torna Utilizável/i.test(l)) continue;
    if (/Bloquear um Acerto/i.test(l)) return 'bloquear';
    if (/Acerto Selvagem/i.test(l)) return 'selvagem';
  }
  return null;
}

/** (ciclo 7, lote G) Quantos ataques o CLAMOR Impele ("Impele os próximos 8 Ataques de Golpe Corpo a Corpo que você executar"): 0 se não Impele. */
export function impelidosDaGema(slug, nivel = 1) {
  for (const l of textosDaGema(slug, nivel).linhas) {
    const m = /Impele (?:os próximos|o próximo) (\d+) Ataques?/i.exec(l);
    if (m) return Number(m[1]) || 0;
  }
  return 0;
}

/**
 * (14/10, o Coveiro) Os CADÁVERES que a gema cria — Profanar: "Cria 5 cadáveres" dos monstros da área, "Nível dos Corpos Criados é igual ao
 * nível da área, máximo de Nível X"; Desenterrar: um cadáver de Arqueiro de Ossos onde o projétil cai, "Corpos Criados são Nível X"; as duas:
 * "Máximo de 10 Cadáveres permitidos" (os criados por ela; o mais velho sai). `{ n, maximo, nivel, nivelMax, arqueiro }`, ou null.
 */
const LINHA_DE_CADAVER = /^Cria \d+ cadáveres?$|^Nível dos Corpos Criados é igual ao nível da área|^Corpos Criados são Nível \d+$|^Máximo de \d+ Cadáveres permitidos$/;
export const ehLinhaDeCadaver = (l) => LINHA_DE_CADAVER.test(l);
export function cadaveresDaGema(slug, nivel = 1) {
  const g = POR_SLUG.get(slug);
  if (!(g?.tipos ?? []).includes('CreatesCorpse')) return null;
  const linhas = textosDaGema(slug, nivel).linhas;
  const achar = (re) => { for (const l of linhas) { const m = re.exec(l); if (m) return Number(m[1]); } return null; };
  const cria = achar(/^Cria (\d+) cadáveres?$/);
  return {
    n: cria ?? 1, maximo: achar(/^Máximo de (\d+) Cadáveres permitidos$/) ?? 10, arqueiro: cria == null,
    nivel: achar(/^Corpos Criados são Nível (\d+)$/), nivelMax: achar(/^Nível dos Corpos Criados é igual ao nível da área, máximo de Nível (\d+)$/),
  };
}

/** As linhas da gema que o jogo agora faz (saem de "não simulado"). */
export const ehLinhaDeAlvos = (linha) => REGRAS_DE_ALVOS.some(([re]) => re.test(linha));
const ALVOS = new Map();
export function alvosNoNivel(slug, nivel = 1, qualidade = 0) {
  const g = POR_SLUG.get(slug);
  const n = Math.max(1, Math.min(nivel | 0 || 1, COMPILADOR?.nivelMaximo?.(g) ?? 40));
  const q = Math.max(0, Math.min(20, Math.round(Number(qualidade) || 0)));
  const k = `${slug}@${n}@${q}`;
  if (ALVOS.has(k)) return ALVOS.get(k);
  const a = { saltos: 0, pctPorRestante: 0, perfurar: 0, projeteis: 0, bifurcar: 0, divide: 0 };
  // (17/10, lote G2: + as linhas da qualidade — "Dispara +1 projétil", "Ricocheteia +1 Vezes")
  const linhas = g && COMPILADOR?.textosDoNivel ? [...COMPILADOR.textosDoNivel(g, n), ...(q > 0 ? linhasDaQualidade(g, q / 20) : [])] : [];
  for (const linha of linhas) for (const [re, fazer] of REGRAS_DE_ALVOS) { const m = linha.match(re); if (m) fazer(m, a); }
  ALVOS.set(k, a);
  return a;
}

/** O dano direto da gema no nível: `{ min, max, elementos }` (todos os elementos somados no elemento principal). */
export function danoNoNivel(slug, nivel) {
  const h = compilada(slug, nivel);
  const d = Object.values(h?.stats?.dano ?? {});
  return { min: Math.round(d.reduce((t, [a]) => t + a, 0)), max: Math.round(d.reduce((t, [, b]) => t + b, 0)), elementos: Object.keys(h?.stats?.dano ?? {}).length };
}
/**
 * O dano de um ATAQUE do PoE por ELEMENTO (dono, 06/10: "Acerto Elemental do Espectro — vai depender do elemento da arma?"), como o
 * `montarPacote` da Arena de Gemas: o golpe FÍSICO da arma × a eficácia, + o dano ADICIONAL da gema ("8 a 14 de Dano de Fogo Adicional")
 * × a eficácia, + o adicionado das peças/suportes (`extras`: `{ elemento: [min, max] }`); depois a CONVERSÃO de físico da gema ("Converte
 * 50% do Dano Físico em Raio"; "em Fogo, Gelo ou Raio" sorteia) e "Não causa Dano não-Elemental" (o físico e o caos que sobram somem).
 * Devolve `{ elemento: [min, max] }` (no jogo: physical, fire, ice, energy, chaos).
 */
const EL_DA_ARENA = { fisico: 'physical', fogo: 'fire', gelo: 'ice', raio: 'energy', caos: 'chaos' };
export function partesDoAtaque(slug, nivel, arma = { min: 1, max: 1 }, extras = {}, rng = Math.random) {
  const st = compilada(slug, nivel)?.stats ?? {};
  const ef = st.efetividade ?? 1;
  const p = {};
  const somar = (el, [a, b], m = 1) => { const x = p[el] ?? [0, 0]; p[el] = [x[0] + a * m, x[1] + b * m]; };
  // (17/10, lote G4: a "arma" pode ser de outro elemento — a base de Fogo/Gelo do escudo nas gemas de escudo transfiguradas, `escudoDaGema`)
  somar(arma.elemento ?? 'physical', [arma.min ?? 1, arma.max ?? 1], ef);
  for (const [el, v] of Object.entries(st.adicional ?? {})) somar(EL_DA_ARENA[el] ?? 'physical', v, ef);
  for (const [el, v] of Object.entries(extras)) if (v && (v[0] || v[1])) somar(el, v);
  if (p.physical) {
    const fis = p.physical;
    let resta = 1;
    for (const c of st.conversao ?? []) {
      const pct = Math.min(resta, c.pct / 100);
      somar(c.para === 'aleatorio' ? ['fire', 'ice', 'energy'][Math.floor(rng() * 3)] : EL_DA_ARENA[c.para] ?? 'physical', fis, pct);
      resta -= pct;
    }
    p.physical = [fis[0] * resta, fis[1] * resta];
  }
  const ex = extrasDoAtaque(slug, nivel);
  if (ex.soElemental) { delete p.physical; delete p.chaos; }
  // "Apenas Causa Dano do Elemento escolhido" (Acerto Elemental): cada uso sorteia fogo, gelo ou raio e só ele fica.
  if (ex.umElemento) { const els = ['fire', 'ice', 'energy'].filter((el) => p[el]); const fica = els[Math.floor(rng() * els.length)]; for (const el of Object.keys(p)) if (el !== fica) delete p[el]; }
  for (const el of Object.keys(p)) if (!(p[el][1] > 0)) delete p[el];
  return p;
}
/** O dano de uma MAGIA do PoE por elemento (`{ elemento: [min, max] }`): a Bola de Fogo é só fogo; o Golpe Cósmico, fogo + gelo... */
export function partesDaMagia(slug, nivel) {
  const p = {};
  for (const [el, v] of Object.entries(compilada(slug, nivel)?.stats?.dano ?? {})) { const k = EL_DA_ARENA[el] ?? 'physical'; const x = p[k] ?? [0, 0]; p[k] = [x[0] + v[0], x[1] + v[1]]; }
  return p;
}
/**
 * (17/10) As LINHAS LOCAIS da gema no nível e na QUALIDADE (`itens-poe/linhas-das-gemas.mjs`): as linhas que o compilador não lê mas que são
 * um modificador que o jogo já calcula ("200% de Poder Arcano", "X% mais Velocidade de Ataque por Carga de Frenesi"…) e as linhas da
 * qualidade da gema ("+(0 — 50)% de Poder Arcano", "(0 — 20)% de chance de causar Dano Dobrado"), × a fração da qualidade — antes a
 * qualidade das gemas ativas não valia (só o "mais Dano por cada tipo de Afecção" do Acerto Elemental). `{ af, feitas, qualidade }`: os
 * atributos somados, as linhas do nível que viraram atributo e as linhas da qualidade que o jogo faz (as outras ficam fora do balão).
 */
const LOCAIS = new Map();
/** As linhas da qualidade que o compilador lê E o jogo usa (o raio, a área, a duração, a recarga). */
const QUALIDADE_PELO_COMPILADOR = /metros? (?:de|ao) raio$|^O raio Base|Área de Efeito aumentada|% (?:mais|menos) Área de Efeito$|segundos? à duração base$|^Duração base é de|Velocidade de Recarga aumentada/i;
/** As linhas da qualidade (o poedb junta duas numa: "+(0 — 2)% mais Dano … +(0 — 2)% mais Velocidade …"), × a fração `q` (0–1). */
export function linhasLocaisNoNivel(slug, nivel = 1, qualidade = 0) {
  const g = POR_SLUG.get(slug);
  const q = Math.max(0, Math.min(20, Math.round(Number(qualidade) || 0)));
  const h = compilada(slug, nivel, q);
  if (!g || !h) return { af: {}, feitas: [], qualidade: [] };
  const k = `${slug}@${h.nivel}@${q}`;
  if (LOCAIS.has(k)) return LOCAIS.get(k);
  // (as linhas que o compilador não leu — as do nível e as da qualidade —; as da qualidade que ele leu (raio, duração, projéteis) já valem
  // pela compilada)
  const daQ = new Set(q > 0 ? linhasDaQualidade(g, q / 20) : []);
  const nao = h.linhas?.naoImplementadas ?? [];
  const uso = ehUso(h);
  const doNivel = uso ? atributosDasLinhas(nao.filter((l) => !daQ.has(l))) : { af: {}, feitas: [] };
  const daQualidade = uso ? atributosDasLinhas(nao.filter((l) => daQ.has(l))) : { af: {}, feitas: [] };
  const af = { ...doNivel.af };
  for (const [x, v] of Object.entries(daQualidade.af)) af[x] = (af[x] ?? 0) + v;
  // (só as que o JOGO usa da compilada: o raio e a área — `areaNoNivel`/`formaNoRaioDoPoe` —, a duração e a recarga — `temposNoNivel`; o
  // resto que o compilador lê não vale no jogo e fica fora)
  const lidasPeloCompilador = [...daQ].filter((l) => !nao.includes(l) && QUALIDADE_PELO_COMPILADOR.test(l));
  const r = { af, feitas: doNivel.feitas, qualidade: [...lidasPeloCompilador, ...daQualidade.feitas] };
  LOCAIS.set(k, r);
  return r;
}

/**
 * (17/10, lote G2) A ÁREA DO PoE da gema no nível e na qualidade: `raioM` — o raio-base em metros ("O raio Base é de 3 metros", "Raio: 3.5"), +
 * os "+X metros de raio" da gema, × √ do "X% mais Área de Efeito" dela —, ou null se o PoE não publica o raio; `areaIncPct` — a "Área de
 * Efeito aumentada em X%" da gema (soma com a das peças e dos suportes).
 */
export function areaNoNivel(slug, nivel = 1, qualidade = 0) {
  const st = compilada(slug, nivel, qualidade)?.stats;
  if (!st) return { raioM: null, areaIncPct: 0 };
  const base = st.raio ?? st.raioProp ?? null;
  const raioM = base == null ? null : Math.max(0, (base + (st.raioBonus ?? 0)) * Math.sqrt(Math.max(0.2, 1 + (st.areaMais ?? 0) / 100)));
  return { raioM, areaIncPct: st.areaInc ?? 0 };
}

/**
 * (17/10, lote G4) As GEMAS DE ESCUDO do PoE (Golpe de Escudo, Investida com Escudo, Arremesso Espectral de Escudo, Escudo da Luz, Explosão Divina,
 * Golpe de Escudo Glacial…): o ataque usa o ESCUDO como a arma da mão secundária — "X a Y de Dano Físico Base como a Mão Secundária" (ou de
 * Fogo/Gelo, nas transfiguradas) no lugar do golpe da arma —, + "X a Y de Dano Adicional por cada 15 de Armadura (ou Evasão) no Escudo" e
 * "+0,1% de Chance de Golpe Crítico da Mão Secundária por cada 10 de Escudo de Energia Máximo no Escudo". `{ base: { elemento, min, max },
 * porDefesa: [{ elemento, min, max, por, defesa: 'armadura'|'evasao'|'armEva' }], critPorEs: { pct, por } | null }` ou null (a gema não é de escudo).
 */
const EL_DO_TEXTO = { Físico: 'physical', Fogo: 'fire', Gelo: 'ice', Raio: 'energy', Caos: 'chaos', físico: 'physical' };
const LINHA_DE_ESCUDO = /de Dano (?:Físico|de Fogo|de Gelo|de Raio) Base (?:cmo a|como a|da) Mão Secund[aá]ria|Dano (?:Físico|de Fogo|de Gelo|de Raio) Adicional por cada \d+ de (?:Armadura|Evasão)|dano físico adicionado por \d+ de armadura no escudo|Chance de Golpe Crítico da Mão Secundária por cada \d+ de Escudo de Energia Máximo no Escudo/i;
export const ehLinhaDeEscudo = (l) => LINHA_DE_ESCUDO.test(l);
/**
 * (lote G4) A linha da RETALIAÇÃO ("Não pode ser usado por padrão Se Torna Utilizável uma vez por 2 segundos quando você Bloquear um Acerto" /
 * "sofrer um Acerto Selvagem"): o jogo a faz desde 11/10 (`gatilhoDeRetaliacao`, a janela de 2 s de `condicoes-poe.RETALIACAO`). Só a de 2
 * segundos (a janela do jogo); outro número seguiria "não simulado".
 */
const LINHA_DE_RETALIACAO = /^Não pode ser usado por padrão Se Torna Utilizável uma vez por 2 segundos? quando você (?:Bloquear um Acerto|sofrer um Acerto Selvagem)$/i;
export const ehLinhaDeRetaliacao = (l) => LINHA_DE_RETALIACAO.test(l);
const ESCUDOS = new Map();
export function escudoDaGema(slug, nivel = 1) {
  const g = POR_SLUG.get(slug);
  if (!g || !COMPILADOR?.textosDoNivel) return null;
  const n = Math.max(1, Math.min(nivel | 0 || 1, COMPILADOR.nivelMaximo?.(g) ?? 40));
  const k = `${slug}@${n}`;
  if (ESCUDOS.has(k)) return ESCUDOS.get(k);
  let base = null;
  const porDefesa = [];
  let critPorEs = null;
  for (const l of COMPILADOR.textosDoNivel(g, n)) {
    let m = /^(\d+(?:\.\d+)?) a (\d+(?:\.\d+)?) de Dano (?:de )?(Físico|Fogo|Gelo|Raio|Caos) Base (?:cmo a|como a|da) Mão Secund[aá]ria/i.exec(l);
    if (m) { base = { elemento: EL_DO_TEXTO[m[3]] ?? 'physical', min: Number(m[1]), max: Number(m[2]) }; continue; }
    m = /^(\d+(?:\.\d+)?) a (\d+(?:\.\d+)?) de Dano (?:de )?(Físico|Fogo|Gelo|Raio|Caos) Adicional por cada (\d+) de (Armadura ou Evasão|Armadura|Evasão) no Escudo/i.exec(l);
    if (m) { porDefesa.push({ elemento: EL_DO_TEXTO[m[3]] ?? 'physical', min: Number(m[1]), max: Number(m[2]), por: Number(m[4]), defesa: /ou/i.test(m[5]) ? 'armEva' : /Armadura/i.test(m[5]) ? 'armadura' : 'evasao' }); continue; }
    m = /^(\d+(?:\.\d+)?) a (\d+(?:\.\d+)?) de dano físico adicionado por (\d+) de armadura no escudo/i.exec(l);
    if (m) { porDefesa.push({ elemento: 'physical', min: Number(m[1]), max: Number(m[2]), por: Number(m[3]), defesa: 'armadura' }); continue; }
    m = /^\+?(\d+(?:\.\d+)?) ?% de Chance de Golpe Crítico da Mão Secundária por cada (\d+) de Escudo de Energia Máximo no Escudo/i.exec(l);
    if (m) critPorEs = { pct: Number(m[1]), por: Number(m[2]) };
  }
  const r = base || porDefesa.length || critPorEs ? { base, porDefesa, critPorEs } : null;
  ESCUDOS.set(k, r);
  return r;
}

/**
 * (17/10, lote G5) Os CLAMORES pelo PODER (PoE: "Conta o Poder total de Inimigos no Alcance" — `ModsPoe.poderDoClamor`, contado no uso): o buff
 * de cada clamor "por cada N de Poder, contando um máximo de M" — a regeneração de vida (Resistente), as resistências e o máximo delas
 * (Ancestral), o "mais Armadura" (Sísmico), a Fúria por segundo, o máximo e "impede a perda inerente" (Vingativo) —, as Cargas de Tolerância
 * por Poder (Resistente) e o "Ataques Impelidos causam Dano Dobrado" (Intimidador). `{ af, tolerancia }` no `poder` dado.
 */
const POR_PODER = [
  [/^Buff concede (\d+(?:\.\d+)?) ?% da Vida Regenerada por segundo por cada (\d+) de poder, contando um máximo de (\d+) de Poder$/i, (x) => ({ life_regen_pct: x })],
  [/^Buff concede \+(\d+(?:\.\d+)?) ?% de todas as Resistências Elementais por cada (\d+) de poder, contando um máximo de (\d+) de Poder$/i, (x) => ({ fire_res: x, ice_res: x, energy_res: x })],
  [/^Buff concede \+(\d+(?:\.\d+)?) ?% ao Máximo de todas as Resistências Elementais por cada (\d+) de Poder, contando um máximo de (\d+) de Poder$/i, (x) => ({ fire_res_max: x, ice_res_max: x, energy_res_max: x })],
  [/^Buff concede (\d+(?:\.\d+)?) ?% mais Armadura por cada (\d+) de Poder, contando um máximo de (\d+) de Poder$/i, (x) => ({ armour_mais: x })],
  [/^Buff concede (\d+(?:\.\d+)?) de Fúria por segundo por cada (\d+) de Poder, contando um máximo de (\d+) de Poder$/i, (x) => ({ 'periodico:1:furia': x })],
];
const LINHAS_FIXAS_DO_CLAMOR = [
  [/^Buff concede \+ ?(\d+) ao Máximo de Fúria Buff impede a perda inerente de Fúria$/i, (m) => ({ furia_max: Number(m[1]), furia_perda_lenta: 1e6 })],
  [/^Ataques Impelidos causam Dano Dobrado$/i, () => ({ 'chance_dano_dobrado@impelido': 100 })],
];
const TOLERANCIA_POR_PODER = /^Concede (\d+) Carga de Tolerância por cada (\d+) de Poder a Você e Jogadores Aliados$/i;
const CONTA_O_PODER = /^Conta o Poder total de Inimigos no Alcance$/i;
export const ehLinhaDoClamor = (l) => CONTA_O_PODER.test(l) || TOLERANCIA_POR_PODER.test(l) || POR_PODER.some(([re]) => re.test(l)) || LINHAS_FIXAS_DO_CLAMOR.some(([re]) => re.test(l));
export function clamorPeloPoder(slug, nivel = 1, poder = 0) {
  const af = {};
  let tolerancia = 0;
  const somar = (o, m = 1) => { for (const [k, v] of Object.entries(o)) af[k] = (af[k] ?? 0) + v * m; };
  for (const l of textosDaGema(slug, nivel).linhas) {
    for (const [re, f] of POR_PODER) {
      const m = re.exec(l);
      if (m) somar(f(Number(m[1])), Math.floor(Math.min(Math.max(0, poder), Number(m[3])) / Math.max(1, Number(m[2]))));
    }
    for (const [re, f] of LINHAS_FIXAS_DO_CLAMOR) { const m = re.exec(l); if (m) somar(f(m)); }
    const t = TOLERANCIA_POR_PODER.exec(l);
    if (t) tolerancia += Number(t[1]) * Math.floor(Math.max(0, poder) / Math.max(1, Number(t[2])));
  }
  return { af, tolerancia };
}

/**
 * (17/10, lote G6) As linhas de MARCA/maldição contra o amaldiçoado: `golpe` — atributos do seu golpe nele (`@ataque`: só com ataques) —, e
 * `morte` — o que o abate dele dá (`carga:<tipo>` = a chance, `vida`, `mana`).
 */
const CONTRA = [
  [/^Inimigos Amaldiçoados concedem ([\d.]+) ?% de Dreno de (Vida|Mana) quando Acertados por Ataques$/i, (m) => ({ golpe: { [`${m[2] === 'Vida' ? 'life' : 'mana'}_leech@ataque`]: Number(m[1]) } })],
  [/^Inimigos Amaldiçoados concedem (\d+) de (Vida|Mana) quando Acertados por Ataques$/i, (m) => ({ golpe: { [`${m[2] === 'Vida' ? 'life' : 'mana'}_on_hit@ataque`]: Number(m[1]) } })],
  [/^Inimigos Amaldiçoados possuem uma chance de (\d+) ?% de concederem uma Carga de (Tolerância|Frenesi|Poder) quando mortos$/i, (m) => ({ morte: { [`carga:${{ Tolerância: 'tolerancia', Frenesi: 'frenesi', Poder: 'poder' }[m[2]]}`]: Number(m[1]) } })],
  [/^Inimigos Amaldiçoados concedem (\d+) de (Vida|Mana) quando Mortos$/i, (m) => ({ morte: { [m[2] === 'Vida' ? 'vida' : 'mana']: Number(m[1]) } })],
  [/^Acertos contra Inimigos Amaldiçoados ganham \+([\d.]+) ?% de Chance de Acerto Crítico$/i, (m) => ({ golpe: { crit_chance: Number(m[1]) } })],
  [/^Hits against Cursed Enemies have \+(\d+) ?% to Critical Strike Multiplier$/i, (m) => ({ golpe: { crit_dmg: Number(m[1]) } })],
  [/^Adiciona (\d+) a (\d+) de Dano Físico aos Acertos contra Inimigos Amaldiçoados$/i, (m) => ({ golpe: { added_physical_dmg_min: Number(m[1]), added_physical_dmg_max: Number(m[2]) } })],
  [/^Inimigos Amaldiçoados concedem (\d+) de Fúria quando Atordoados$/i, (m) => ({ atordoar: { furia: Number(m[1]) } })],
];
export const ehLinhaContraOAmaldicoado = (l) => CONTRA.some(([re]) => re.test(l));
function contraOAmaldicoado(linhas = []) {
  const golpe = {};
  const morte = {};
  const atordoar = {};
  for (const l of linhas) for (const [re, f] of CONTRA) {
    const m = re.exec(l);
    if (!m) continue;
    const r = f(m);
    for (const [k, v] of Object.entries(r.golpe ?? {})) golpe[k] = (golpe[k] ?? 0) + v;
    for (const [k, v] of Object.entries(r.morte ?? {})) morte[k] = (morte[k] ?? 0) + v;
    for (const [k, v] of Object.entries(r.atordoar ?? {})) atordoar[k] = (atordoar[k] ?? 0) + v;
  }
  return { golpe, morte, atordoar };
}

/** (17/10, lote G9) Os Arautos com o efeito ao matar no jogo (`Acoes.aoMatarComArautos`) e as linhas dele que o compilador não lê. */
const ARAUTOS_AO_MATAR = new Set(['Herald_of_Ice', 'Herald_of_Thunder', 'Herald_of_Ash']);
const LINHA_DO_ARAUTO = /^Tempestade Acerta um Inimigo a cada 0\.25 Segundos$|^Cria uma tempestade quando você Matar um Inimigo Eletrizado$|^Dano Ardente Base é igual a 25 ?% do Dano Excedente$/i;
export const ehLinhaDoArauto = (l) => LINHA_DO_ARAUTO.test(l);

/**
 * (17/10, lote G10) Os ESTÁGIOS DE CANALIZAÇÃO da gema (o PoE: cada uso enquanto canaliza ganha um estágio, até o máximo): `{ max, modo, mais,
 * critMais, velMais, raioM, raioMaxM, final, golpesFinais, porMs }` ou null (a gema não tem estágio que o jogo faça).
 *   `intensifica` — cada uso acerta com "X% mais Dano por estágio" (Lâminas Velozes, Incinerar); no MÁXIMO a canalização se libera sozinha: as
 *                   Lâminas Velozes soltam "um golpe adicional por cada estágio" (`golpesFinais`), o Incinerar a onda final ("A onda final causa
 *                   X% mais Dano com Acertos" — `final`);
 *   `carrega`     — os usos só carregam (Rajada de Chamas, Flecha Flagelante); no máximo, a liberação com o "X% mais Dano por estágio" × os estágios;
 *   `tempo`       — um estágio a cada N s canalizando (o Ciclone do Tumulto: "25% mais Velocidade de Ataque por Estágio").
 * O raio cresce "+X metros ao raio por estágio" (até o máximo da linha). O idle não solta o botão: a liberação no máximo é a abstração (a
 * canalização interrompida por outra habilidade perde os estágios, como a do PoE que não chegou a soltar).
 */
const CARREGAM = /^(Flameblast|Scourge_Arrow)/;
const LINHAS_DE_ESTAGIO = [
  [/^(\d+(?:\.\d+)?) ?% mais Dano (?:com Acertos e Afecções|Mágico) por (?:cada )?estágio$/i, (m, e) => { e.mais += Number(m[1]); }],
  [/^(\d+(?:\.\d+)?) ?% mais Dano com Afecções por estágio$/i, () => {}],
  [/^(\d+(?:\.\d+)?) ?% mais Change? de Golpe Crítico por cada Estágio$/i, (m, e) => { e.critMais += Number(m[1]); }],
  [/^(\d+(?:\.\d+)?) ?% mais Velocidade de Ataque por Estágio$/i, (m, e) => { e.velMais += Number(m[1]); }],
  [/^Concede 1 Estágio a cada (\d+(?:\.\d+)?) segundos? enquanto Canalizando$/i, (m, e) => { e.porMs = Math.round(Number(m[1]) * 1000); }],
  [/^Perde 1 Estágio a cada (\d+(?:\.\d+)?) segundos? enquanto não Canalizada$/i, () => {}],
  [/^\+?(\d+(?:\.\d+)?) metros ao raio por estágio, máximo de \+(\d+(?:\.\d+)?) metros$/i, (m, e) => { e.raioM = Number(m[1]); e.raioMaxM = Number(m[2]); }],
  [/^A onda final causa (\d+(?:\.\d+)?) ?% mais Dano com Acertos$/i, (m, e) => { e.final += Number(m[1]); }],
  [/^A onda final causa (\d+(?:\.\d+)?) ?% mais Dano com Incêndio$/i, () => {}],
  [/^onda final sempre Incendeia$/i, () => {}],
];
export const ehLinhaDeEstagio = (l) => LINHAS_DE_ESTAGIO.some(([re]) => re.test(l));
const ESTAGIOS = new Map();
export function estagiosDaGema(slug, nivel = 1) {
  const h = compilada(slug, nivel);
  if (!h?.stats?.estagios) return null;
  const k = `${slug}@${h.nivel}`;
  if (ESTAGIOS.has(k)) return ESTAGIOS.get(k);
  const e = { max: h.stats.estagios, mais: 0, critMais: 0, velMais: 0, raioM: h.stats.raioPorEstagio ?? 0, raioMaxM: null, final: 0, golpesFinais: /^Blade_Flurry/.test(slug), porMs: 0 };
  for (const l of textosDaGema(slug, nivel).linhas) for (const [re, f] of LINHAS_DE_ESTAGIO) { const m = re.exec(l); if (m) f(m, e); }
  e.modo = e.porMs ? 'tempo' : CARREGAM.test(slug) ? 'carrega' : 'intensifica';
  const r = e.mais || e.critMais || e.velMais || e.raioM || e.final || e.golpesFinais ? e : null;
  ESTAGIOS.set(k, r);
  return r;
}

/**
 * (17/10, lote G11) A SEQUÊNCIA DE ÁREAS da Ruptura (Sunder): a onda causa dano em N áreas em linha à sua frente ("Onda causa Dano em 5 Áreas"),
 * cada uma com o raio-base da gema + "+X metros de raio para cada área anterior"; até M inimigos acertados em cada área soltam uma ONDA DE
 * CHOQUE ("Onda causa Ondas de Choque de até 5 Inimigos em cada Área") com "X% menos Dano". `{ areas, raioM, porAreaM, choques, choqueMenos }`
 * ou null. (O "delay entre Áreas" e o "não pode parar antes de N Áreas" são do tempo da onda e da interrupção pelo novo uso: o idle resolve a
 * onda inteira no uso — sem efeito aqui.)
 */
const LINHA_DA_SEQUENCIA = /^Onda causa Dano em \d+ Áreas$|^Áreas de onda ganham \+[\d.]+ metros de raio para cada área anterior(?: da onda)?$|^Onda causa Ondas de Choque de até \d+ Inimigos em cada Área$|^Ondas de Choque causam \d+ ?% menos Dano$|^Onda tem o delay entre Áreas reduzido em [\d.]+ ?%$|^Onda não pode parar antes de causar Dano em \d+ Áreas$/i;
export const ehLinhaDaSequencia = (l) => LINHA_DA_SEQUENCIA.test(l);
export function sequenciaDaGema(slug, nivel = 1, qualidade = 0) {
  if (!/^Sunder/.test(slug)) return null;
  const linhas = textosDaGema(slug, nivel).linhas;
  const achar = (re) => { for (const l of linhas) { const m = re.exec(l); if (m) return Number(m[1]); } return null; };
  const areas = achar(/^Onda causa Dano em (\d+) Áreas$/i);
  if (!areas) return null;
  return {
    areas, raioM: areaNoNivel(slug, nivel, qualidade).raioM ?? 1.2, porAreaM: achar(/^Áreas de onda ganham \+([\d.]+) metros/i) ?? 0,
    choques: achar(/^Onda causa Ondas de Choque de até (\d+) Inimigos em cada Área$/i) ?? 0, choqueMenos: achar(/^Ondas de Choque causam (\d+) ?% menos Dano$/i) ?? 0,
  };
}

/**
 * (17/10, lote G11) Os GOLPES REPETIDOS NO TEMPO da Armadilha de Torre Elétrica: ativada, ela "Ataca a cada X segundos" pela "Duração base",
 * golpeando "N Áreas" a cada vez (`Acoes.tiqueDasTorres`). `{ intervaloMs, duracaoMs, areas }` ou null.
 */
const LINHA_DA_TORRE = /^Ataca a cada [\d.]+ segundos?$|^Golpeia \d+ Áreas$|^Modificadores à Velocidade de Arremesso de Armadilhas também se aplicam à Frequência dos golpes$/i;
export const ehLinhaDaTorre = (l) => LINHA_DA_TORRE.test(l);
export function torreDaGema(slug, nivel = 1, qualidade = 0) {
  if (!/^Lightning_Spire_Trap/.test(slug)) return null;
  const linhas = textosDaGema(slug, nivel).linhas;
  const achar = (re) => { for (const l of linhas) { const m = re.exec(l); if (m) return Number(m[1]); } return null; };
  const intervalo = achar(/^Ataca a cada ([\d.]+) segundos?$/i);
  const areas = achar(/^Golpeia (\d+) Áreas$/i);
  if (!intervalo || !areas) return null;
  return { intervaloMs: Math.round(intervalo * 1000), duracaoMs: Math.round((compilada(slug, nivel, qualidade)?.stats?.duracao ?? 3.5) * 1000), areas, velocidadeDeArremesso: linhas.some((l) => /Frequência dos golpes/i.test(l)) };
}

/**
 * (17/10, lote G12) O USO DE CADÁVERES das gemas (os cadáveres da caçada — `hunt.cadaveres`, com a Vida Máxima do morto): a EXPLOSÃO ("Explosão
 * causa Dano de Fogo base igual a X% da Vida Máxima do Cadáver" — sem os modificadores de dano mágico, no raio da explosão) e o modo de cada
 * gema: `detonar` (Detonar os Mortos: o cadáver mais perto do alvo explode, com o dano mágico da gema em volta dele; a do Saque não mira os
 * criados e não tem dano mágico), `todos` (a Vaal: todos os cadáveres em volta do alvo), `consumir` (Mortos Voláteis: até N cadáveres perto do
 * alvo explodem, e cada um solta um orbe que causa o dano mágico em volta do inimigo mais perto), `geiser` (Cremação: o cadáver explode e vira
 * um gêiser que dispara N projéteis a cada intervalo pela duração, até o máximo de gêiseres). Sem cadáver, a gema não sai.
 */
const MODO_DO_CADAVER = { Detonate_Dead: 'detonar', Vaal_Detonate_Dead: 'todos', Volatile_Dead: 'consumir', Cremation: 'geiser' };
const LINHA_DE_CADAVER_DA_GEMA = /^Explosão causa Dano de Fogo base igual a [\d.]+ ?% da Vida M[áa]xima do Cad[áa]ver$|^Consome até \d+ cadáveres$|^Raio Base da explos[aã]o igual a [\d.]+ metros?$|^Dispara Projéteis a cada [\d.]+ segundos?$|^Máximo de \d+ gêiseres por vez$|^Máximo de \d+ Orbes por vez$/i;
export const ehLinhaDeCadaverDaGema = (l) => LINHA_DE_CADAVER_DA_GEMA.test(l);
export function cadaverDaGema(slug, nivel = 1, qualidade = 0) {
  const base = slug.replace(/_of_.*$/, '');
  const modo = MODO_DO_CADAVER[base];
  if (!modo) return null;
  const linhas = textosDaGema(slug, nivel).linhas;
  const achar = (re) => { for (const l of linhas) { const m = re.exec(l); if (m) return Number(m[1]); } return null; };
  const pct = achar(/^Explosão causa Dano de Fogo base igual a ([\d.]+) ?% da Vida M[áa]xima do Cad[áa]ver$/i);
  if (pct == null) return null;
  const st = compilada(slug, nivel, qualidade)?.stats ?? {};
  return {
    modo, pct, soMortos: /Scavenging/.test(slug), comDano: !!Object.keys(st.dano ?? {}).length,
    raioExplosaoM: achar(/^Raio Base da explos[aã]o igual a ([\d.]+) metros?$/i) ?? achar(/^O raio Base é de ([\d.]+) metros?$/i) ?? 1.5,
    maximo: achar(/^Consome até (\d+) cadáveres$/i) ?? 1,
    ...(modo === 'geiser' ? { geiser: { intervaloMs: Math.round((achar(/^Dispara Projéteis a cada ([\d.]+) segundos?$/i) ?? 1) * 1000), duracaoMs: Math.round((st.duracao ?? 8) * 1000), projeteis: achar(/^Dispara (\d+) projéteis$/i) ?? 4, max: achar(/^Máximo de (\d+) gêiseres por vez$/i) ?? 3 } } : {}),
  };
}

/** As linhas de ataque que o jogo faz: "Não causa Dano não-Elemental" e "X% mais Dano por cada tipo de Afecção Elemental no Inimigo". */
const LINHA_DE_ATAQUE = /^Não causa Dano não-Elemental$|^Apenas Causa Dano do Elemento escolhido|mais Dano por cada tipo de Afecção Elemental no Inimigo/i;
export const ehLinhaDeAtaque = (l) => LINHA_DE_ATAQUE.test(l);
export function extrasDoAtaque(slug, nivel = 1, qualidade = 0) {
  const g = POR_SLUG.get(slug);
  const linhas = g && COMPILADOR?.textosDoNivel ? COMPILADOR.textosDoNivel(g, Math.max(1, Math.min(nivel | 0 || 1, COMPILADOR.nivelMaximo?.(g) ?? 40))) : [];
  const daQualidade = qualidade > 0 ? (g?.qualidade ?? []).map((t) => naFracao(t, Math.min(1, qualidade / 20))) : [];
  let porAfeccao = 0;
  for (const l of [...linhas, ...daQualidade]) { const m = String(l).match(/\+?(\d+(?:[.,]\d+)?) ?% mais Dano por cada tipo de Afecção Elemental no Inimigo/i); if (m) porAfeccao += Number(m[1].replace(',', '.')); }
  return { soElemental: linhas.some((l) => /^Não causa Dano não-Elemental$/i.test(l)), umElemento: linhas.some((l) => /^Apenas Causa Dano do Elemento escolhido/i.test(l)), porAfeccao };
}
/**
 * DUAS ARMAS (PoE): a % do dano com que o ataque acerta COMBINANDO as duas armas — "Quando em Dupla Empunhadura, Causa 60 % do Dano
 * combinando cada Arma" (Cutilada), 75 nas Lâminas Giratórias, 100 no Ataque Combinado (Dual Strike: "causando o dano de ambas em um ataque"). null: o
 * ataque ALTERNA entre as armas, como todo ataque do PoE.
 */
const COMBINA_AS_ARMAS = /Quando em Dupla Empunhadura, Causa (\d+(?:[.,]\d+)?) ?% do Dano combinando cada Arma/i;
const DANO_DE_AMBAS = /Ataca com ambas as armas, causando o dano de ambas em um ataque/i;
export function danoComAsDuasArmas(slug) {
  const g = POR_SLUG.get(slug);
  if (!g) return null;
  for (const l of g.mods ?? []) {
    const m = String(l).match(COMBINA_AS_ARMAS);
    if (m) return Number(m[1].replace(',', '.'));
  }
  return DANO_DE_AMBAS.test(g.desc ?? '') ? 100 : null;
}
/** Os tipos de AFECÇÃO ELEMENTAL no bicho agora (incêndio, resfriamento, congelamento, eletrização). */
export function afeccoesElementaisEm(bicho, agora) {
  const e = bicho?.estados ?? {};
  const vale = (s) => s && s.ate > agora;
  return [(bicho?.dots ?? []).some((d) => d.tipo === 'queimadura' && d.ate > agora), vale(e.lento), vale(e.congelado), vale(e.chocado)].filter(Boolean).length;
}
/** A eficácia de um ATAQUE no nível (o "Dano de Ataque X% de base"): o golpe da arma × isto. */
export const eficaciaNoNivel = (slug, nivel) => compilada(slug, nivel)?.stats?.efetividade ?? 1;
/**
 * (S002, lote 47) A EFICÁCIA DO DANO ADICIONADO de uma MAGIA no nível ("Eficácia do Dano Adicionado: (300 — 480)%" na Bola de Fogo): a do PoB
 * (`gamedata/itens-poe/pob-eficacia.json` — `tools/importar-pob-eficacia.mjs`, o `damageEffectiveness` de cada nível; acima da tabela, o
 * último nível dela); sem a gema no PoB, a da tabela do poedb (`eficaciaNoNivel`). O dano adicionado às magias (peças, suportes, varinhas)
 * entra × isto.
 */
let POB_EFICACIA = null;
export function eficaciaDoAdicionado(slug, nivel = 1) {
  POB_EFICACIA ??= JSON.parse(readFileSync(new URL('../../gamedata/itens-poe/pob-eficacia.json', import.meta.url), 'utf8')).gemas;
  const t = POB_EFICACIA[POR_SLUG.get(slug)?.en ?? String(slug).replace(/_/g, ' ')];
  if (!t) return eficaciaNoNivel(slug, nivel);
  const ks = Object.keys(t).map(Number).sort((a, b) => a - b);
  const k = ks.filter((x) => x <= Math.max(ks[0], Math.round(nivel) || 1)).at(-1) ?? ks[0];
  return t[k];
}
/** A chance de crítico BASE da gema no nível ("Chance de Crítico: 6.00%" do poedb), como fração; null se a gema não diz. */
export function criticoBaseNoNivel(slug, nivel = 1) {
  const g = POR_SLUG.get(slug);
  const h = compilada(slug, nivel);
  if (!g || !h || !COMPILADOR?.propsDoNivel) return null;
  for (const p of COMPILADOR.propsDoNivel(g, h.nivel)) {
    const m = /^Chance de Crítico: ([\d.,]+)%/.exec(p);
    if (m) return Number(m[1].replace(',', '.')) / 100;
  }
  return null;
}
/** As chances de afecção da arena → as do jogo (`itens-poe/afeccoes.mjs`): as que existem. */
const AFECCAO_NO_JOGO = { incendiar: 'incendio', congelar: 'congelamento', eletrizar: 'eletrizacao', envenenar: 'veneno', sangrar: 'sangramento' };
/**
 * As chances da gema que NÃO são afecção (o empalamento — "40% de chance de Empalar Inimigos ao Acertar", 7 gemas: Golpe Duplo do Empalamento,
 * Aço Partido…): o atributo do PoE que `ModsPoe.aoAcertar` sorteia. (09/10, auditoria de dependências: antes a chance da gema não ia a lugar nenhum.)
 */
const CHANCE_NO_ACERTO = { empalar: 'chance_empalar' };
/** A ficha do golpe da gema com as chances dela no acerto (o empalamento): a mesma ficha se a gema não tem nenhuma. */
export function fichaComAsChancesDaGema(ficha, slug, nivel) {
  const ch = compilada(slug, nivel)?.stats?.chances ?? {};
  const extra = Object.entries(ch).filter(([k, v]) => v && CHANCE_NO_ACERTO[k]);
  if (!ficha?.afPoe || !extra.length) return ficha;
  const afPoe = { ...ficha.afPoe };
  for (const [k, v] of extra) afPoe[CHANCE_NO_ACERTO[k]] = (Number(afPoe[CHANCE_NO_ACERTO[k]]) || 0) + v;
  return { ...ficha, afPoe };
}
/** As afecções da ficha + as chances da gema no nível (o acerto da skill usa isto). */
export function afeccoesComAGema(afeccoes, slug, nivel) {
  const ch = compilada(slug, nivel)?.stats?.chances ?? {};
  const extra = Object.entries(ch).filter(([k, v]) => v && AFECCAO_NO_JOGO[k]);
  if (!afeccoes || !extra.length) return afeccoes;
  const chance = { ...afeccoes.chance };
  for (const [k, v] of extra) chance[AFECCAO_NO_JOGO[k]] = (chance[AFECCAO_NO_JOGO[k]] ?? 0) + v;
  return { ...afeccoes, chance };
}
/** O custo de mana da gema no nível. */
export const custoNoNivel = (slug, nivel) => Math.max(0, Math.round(compilada(slug, nivel)?.stats?.custo ?? 0));

// ---- o DANO DEGENERATIVO da gema (09/10: "o dano degenerativo das gemas") ----
/** O tipo de dano contínuo (`combate/dot.json`) do dano degenerativo de cada elemento de uma habilidade. */
export const DEGEN_DO_ELEMENTO = { physical: 'degenFisico', fire: 'degenFogo', ice: 'degenGelo', energy: 'degenRaio', chaos: 'degenCaos' };
/**
 * O dano degenerativo da gema no nível ("Causa 765 de Dano de Gelo Base por segundo" — Vórtice, Geada Rastejante, Flecha Cáustica…):
 * `{ partes: [{ elemento, dps }], duracaoMs }` ou null. A duração é a da habilidade (sem ela, 4 s; no mínimo 1 s: um pulso inteiro).
 */
export function degenerativoNoNivel(slug, nivel, qualidade = 0) {
  const st = compilada(slug, nivel, qualidade)?.stats;
  const partes = (st?.dot ?? []).map((d) => ({ elemento: ELEMENTO[d.el], dps: Number(d.dps) || 0 })).filter((p) => p.elemento && p.dps > 0);
  if (!partes.length) return null;
  return { partes, duracaoMs: Math.round(Math.max(1, Number(st.duracao) || 4) * 1000) };
}

// ---- os BUFFS (auras, arautos, guardas, gritos, maldições) no nível: os efeitos de reforço do Draevor + atributos na ficha ----
const AF_DO_ELEMENTO = { fogo: 'fire', gelo: 'ice', raio: 'energy', fisico: 'phys', caos: 'chaos' };
/** `{ efeitos, af, dur, motivos }` do buff da gema no nível. */
export function buffNoNivel(slug, nivel, qualidade = 0) {
  const h = compilada(slug, nivel, qualidade);
  if (!h) return null;
  const st = h.stats;
  const b = st.buff ?? {};
  const m = st.maldicao ?? {};
  const efeitos = [];
  const af = {};
  const motivos = [];
  if (b.maisDano) efeitos.push({ efeito: 'dano', tags: [], pct: b.maisDano });
  if (b.critico) efeitos.push({ efeito: 'critChance', tags: [], pct: b.critico });
  for (const [el, [a, z]] of Object.entries(b.adicional ?? {})) {
    const e = AF_DO_ELEMENTO[el];
    if (!e || e === 'phys') {
      if (e === 'phys') af.phys_add = (af.phys_add ?? 0) + Math.round((a + z) / 2);
      continue;
    }
    af[`added_${e}_dmg_min`] = (af[`added_${e}_dmg_min`] ?? 0) + Math.round(a);
    af[`added_${e}_dmg_max`] = (af[`added_${e}_dmg_max`] ?? 0) + Math.round(z);
  }
  for (const [el, v] of Object.entries(b.resist ?? {})) {
    const e = AF_DO_ELEMENTO[el];
    if (e === 'phys') af.phys_res = (af.phys_res ?? 0) + v;
    else if (e) af[`${e}_res`] = (af[`${e}_res`] ?? 0) + v;
  }
  // (17/10, lote G8) as linhas "Buff concede…" que o compilador não lê (o dano adicionado dos Arautos, as imunidades, o "mais Dano Físico"):
  // os atributos delas no buff (`linhas-das-gemas.atributosDoBuff`)
  for (const l of h.linhas?.naoImplementadas ?? []) {
    const x = atributosDoBuff(l);
    if (x) for (const [k, v] of Object.entries(x)) af[k] = (af[k] ?? 0) + v;
  }
  if (b.armadura) af.armor_flat = (af.armor_flat ?? 0) + Math.round(b.armadura);
  if (b.evasao) af.evasion = (af.evasion ?? 0) + Math.round(b.evasao);
  if (b.escudo) af.energy_shield = (af.energy_shield ?? 0) + Math.round(b.escudo);
  if (b.velAtaque) af.atk_speed = (af.atk_speed ?? 0) + b.velAtaque;
  if (b.velConj) af.cast_speed = (af.cast_speed ?? 0) + b.velConj;
  if (b.velMov) af.move_speed = (af.move_speed ?? 0) + b.velMov;
  if (b.regen) af.life_regen = (af.life_regen ?? 0) + Math.round(b.regen);
  if (b.regenMana) af.mana_regen = (af.mana_regen ?? 0) + Math.round(b.regenMana);
  if (b.menosDanoRecebido) af.dmg_reduction = (af.dmg_reduction ?? 0) + b.menosDanoRecebido;
  if (b.absorve) motivos.push('a absorção de dano da guarda ainda não existe no jogo');
  if (b.imuneAfeccoes) motivos.push('a imunidade a afecções ainda não existe no jogo');
  // (14/10) "Você e aliados próximos recebem X% de Dano Físico como Dano Extra de Gelo" (o Ódio): o Físico como Extra do elemento — antes não
  // entrava ("efeito não aplicado").
  for (const t of b.extra ?? []) {
    const e = AF_DO_ELEMENTO[t?.para];
    if (e && e !== 'phys' && t.pct > 0) af[`phys_as_extra_${e}`] = (af[`phys_as_extra_${e}`] ?? 0) + t.pct;
    else motivos.push(`efeito não aplicado no jogo: ${t?.para ?? t}`);
  }
  // A MALDIÇÃO: quem você atinge sofre mais dano (resistência reduzida, dano recebido) ou causa menos.
  const durMarca = Math.round((st.duracao ?? 6) * 1000);
  for (const [el, v] of Object.entries(m.resist ?? {})) if (v < 0 && ELEMENTO[el]) efeitos.push({ efeito: 'marcaVulneravel', pct: -v, tipos: [ELEMENTO[el]], durMarca });
  if (m.danoRecebido) efeitos.push({ efeito: 'marcaVulneravel', pct: m.danoRecebido, tipos: ['physical', 'fire', 'ice', 'energy', 'chaos', 'earth', 'death', 'holy'], durMarca });
  if (m.menosDano) efeitos.push({ efeito: 'marcaEnfraquece', pct: m.menosDano, durMarca });
  if (m.lentidao) motivos.push('a lentidão da maldição ainda não existe no jogo');
  // (17/10, lote G6) O que a MARCA/maldição dá aos seus acertos CONTRA o inimigo amaldiçoado por ela ("Acertos contra Inimigos Amaldiçoados
  // ganham…", "Inimigos Amaldiçoados concedem X% de Dreno de Vida quando Acertados por Ataques") e ao matá-lo ("…concedem uma Carga de Poder
  // quando mortos", "…600 de Vida quando Mortos"): guardado na maldição do bicho (`Reforcos.marcar`) e lido no golpe (`fichaDoGolpe`) e no abate.
  const contra = contraOAmaldicoado(textosDaGema(slug, nivel).linhas);
  if (Object.keys(contra.golpe).length || Object.keys(contra.morte).length || Object.keys(contra.atordoar).length) efeitos.push({ efeito: 'maldicaoContra', golpe: contra.golpe, morte: contra.morte, atordoar: contra.atordoar });
  // (lote 46, dono: "Toda área em metros") o raio do Clamor em CASAS: os metros da gema ÷ 2 (antes, os metros como casas — o dobro); no uso, × √
  // da "Área de Efeito aumentada" — `acoes.raioDoClamor`
  if (h.arquetipo === 'clamor') efeitos.push({ efeito: 'provocar', raio: Math.max(1, Math.round((st.raioFinal ?? 6) / 2)), raioM: st.raioFinal ?? 6 });
  // Aura e arauto: ligados enquanto a gema estiver encaixada (o uso automático renova); guarda e grito: a duração da gema.
  // (11/10: a aura VAAL tem a duração dela — "Duração base é de 4 segundos" —, e o "Duração de Aura aumentada" passa a valer nela.)
  const vaalComDuracao = h.arquetipo === 'aura' && /^Vaal_/.test(slug) && st.duracao > 0;
  // (11/10) O ESTANDARTE do PoE atual se PLANTA: dura o da gema ("Duração base é de 10 segundos") e cresce com o Valor consumido ("X% mais Área de
  // Efeito / Efeito de Aura por Valor consumido", do nível — `porValor`, `mods-poe.plantarEstandarte`).
  const estandarte = /_Banner$/.test(slug);
  const comDuracao = vaalComDuracao || estandarte;
  const dur = ['aura', 'arauto'].includes(h.arquetipo) && !comDuracao ? 60000 : Math.round(Math.max(comDuracao ? 1 : 2, st.duracao ?? (estandarte ? 10 : 6)) * 1000);
  const porValor = estandarte ? (() => {
    const linhas = textosDaGema(slug, nivel).linhas;
    const achar = (re) => Number(linhas.map((l) => re.exec(l)?.[1]).find((x) => x != null)) || 0;
    return { efeito: achar(/([\d.]+) ?% mais Efeito de Aura por Valor consumido/), area: achar(/([\d.]+) ?% mais Área de Efeito por Valor consumido/) };
  })() : null;
  // (11/10) O RAIO da aura em casas (1 casa = 2 m): ela vale nos companheiros de grupo a esse raio (`adds`). (`raioM`: em metros, sem arredondar.)
  const raio = h.arquetipo === 'aura' ? Math.max(1, Math.round((st.raioFinal ?? 4) / 2)) : null;
  return { efeitos, af, dur, motivos, ...(raio ? { raio, raioM: st.raioFinal ?? 4 } : {}), ...(porValor ? { porValor } : {}) };
}

// ---- o STATUS NO JOGO ----
function avaliarNoJogo(h, formato) {
  const st = h.stats;
  const motivos = [];
  if (SEM_NO_JOGO[h.arquetipo]) return { status: 'nao', motivos: [SEM_NO_JOGO[h.arquetipo]] };
  // (14/10) O Infestador sai sozinho (o jogo usa as habilidades sozinho); o Feiticeiro liga reservando e ativa as magias ligadas.
  if (h.arquetipo === 'praga') return { status: 'parcial', motivos: ['sai sozinha, na barra: Incuba e, no Valor Máximo da Praga com um inimigo a até 2 casas, Infesta até o Valor acabar; o raio da Infestação é de 2 casas (o PoE não publica o raio base)'] };
  if (h.arquetipo === 'feiticeiro') return { status: 'funciona', motivos: [] };
  // LACAIOS e TOTENS (`lacaios-poe.mjs`): invocam de verdade, com o máximo, a duração e os bônus da gema; o que ainda é simplificado vai nos motivos.
  if (h.arquetipo === 'lacaio' || h.arquetipo === 'totem') {
    const motivos = h.arquetipo === 'totem'
      ? ['o totem fica parado e usa a skill da gema no bicho mais perto (os bônus do PoE ao totem, como a velocidade de posicionamento, não entram)']
      : ['o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro'];
    for (const l of h.linhas?.naoImplementadas ?? []) if (!ehLinhaDeLacaio(l) && !ehLinhaDeAlvos(l) && !ehLinhaDeAtaque(l) && !ehLinhaDoAco(l)) motivos.push(`efeito não simulado: ${l}`);
    return { status: 'parcial', motivos };
  }
  // (12/10) O VÍNCULO (`itens-poe/vinculos.mjs`): foca um aliado; as linhas que o jogo ainda não faz vão nos motivos.
  if (h.arquetipo === 'vinculo') {
    const d = Vinculos.daGema(textosDaGema(h.slug, 1).linhas);
    for (const l of d.naoFeitas) motivos.push(`efeito não simulado: ${l}`);
    if ((h.tags ?? []).includes('Ativação')) motivos.push('os acertos do alvo vinculado ainda não ativam as suas magias suportadas');
    return { status: motivos.length ? 'parcial' : 'funciona', motivos };
  }
  if (BUFF.has(h.arquetipo)) {
    const b = buffNoNivel(h.slug, h.nivel);
    motivos.push(...b.motivos);
    // (17/10, lote G8) o ARAUTO tem o efeito ao matar (a explosão do Gelo, a tempestade do Trovão, o fogo das Cinzas) com o dano da gema: o jogo
    // ainda faz só o buff — o dano "Causa X a Y" que o compilador lê não vai a lugar nenhum
    // (lote G9: o do Gelo, do Trovão e das Cinzas já existe — `Acoes.aoMatarComArautos`/`tiqueDosArautos`)
    if (h.arquetipo === 'arauto' && !ARAUTOS_AO_MATAR.has(h.slug) && (Object.keys(st.dano ?? {}).length || (st.dot ?? []).length)) motivos.push('o efeito do Arauto ao matar (a explosão, a tempestade, o fogo) ainda não existe no jogo: só o buff');
    if (!b.efeitos.length && !Object.keys(b.af).length) motivos.push('nenhum efeito do buff tem equivalente no jogo');
  } else {
    if (h.arquetipo === 'movimento') motivos.push('o deslocamento (salto, investida, teleporte) não existe: no jogo é o golpe na área');
    // Projéteis adicionais, perfuração, ricochetes, difusão e divisão do feixe: aplicados pelo nível da gema (`alvosNoNivel`).
    // (09/10) O dano degenerativo da gema se aplica no acerto (`acoes`: `degenerativoNoNivel`); o "% da Vida por segundo" do Fogo Justo, ainda não.
    if (st.dotPctVida) motivos.push('o dano por % da Vida por segundo (Fogo Justo) ainda não se aplica');
    // (lote G10: os estágios que o jogo faz — `estagiosDaGema`; o resto segue)
    if (st.estagios && !estagiosDaGema(h.slug, h.nivel)) motivos.push('os estágios de canalização não existem: no jogo é um uso por vez');
    // (lote G11: a sequência de áreas da Ruptura existe — `sequenciaDaGema`)
    if (st.repeticoes && !sequenciaDaGema(h.slug, h.nivel) && !torreDaGema(h.slug, h.nivel)) motivos.push('as repetições do golpe não existem: no jogo é um');
    for (const [k, v] of Object.entries(st.chances ?? {})) if (v && !AFECCAO_NO_JOGO[k] && !CHANCE_NO_ACERTO[k]) motivos.push(`a chance de ${v}% de ${k} ainda não existe no jogo`);
    // (lote G12: as gemas de cadáver que o jogo faz — `cadaverDaGema`)
    if (st.cadaver && !cadaverDaGema(h.slug, h.nivel)) motivos.push('o uso de cadáveres não existe no jogo');
    if (!Object.keys(st.dano ?? {}).length && !h.ataque && !st.dot?.length) motivos.push('sem dano direto: nenhum efeito no combate');
  }
  // (12/10: + as linhas dos Fragmentos de Aço — `itens-poe/convocar-o-aco.mjs`.)
  // (17/10: + as linhas locais — `linhasLocaisNoNivel`.)
  for (const l of h.linhas?.naoImplementadas ?? []) if (!ehLinhaDeAlvos(l) && !ehLinhaDeAtaque(l) && !ehLinhaDoAco(l) && !ehLinhaDeCadaver(l) && !ehLinhaDeEscudo(l) && !ehLinhaDeRetaliacao(l) && !(h.arquetipo === 'clamor' && ehLinhaDoClamor(l)) && !(h.arquetipo === 'maldicao' && ehLinhaContraOAmaldicoado(l)) && !(BUFF.has(h.arquetipo) && ehLinhaDoBuff(l)) && !(ARAUTOS_AO_MATAR.has(h.slug) && ehLinhaDoArauto(l)) && !(estagiosDaGema(h.slug, h.nivel) && ehLinhaDeEstagio(l)) && !(sequenciaDaGema(h.slug, h.nivel) && ehLinhaDaSequencia(l)) && !(torreDaGema(h.slug, h.nivel) && ehLinhaDaTorre(l)) && !(cadaverDaGema(h.slug, h.nivel) && ehLinhaDeCadaverDaGema(l)) && !(ehUso(h) && ehLinhaLocalDaGema(l))) motivos.push(`efeito não simulado: ${l}`);
  return { status: motivos.length ? 'parcial' : 'funciona', motivos };
}

/** (17/10) A gema é um USO com golpe (as linhas locais valem nos acertos dela — `linhasLocaisNoNivel`): não é buff, lacaio nem totem. */
const ehUso = (h) => !BUFF.has(h.arquetipo) && !['lacaio', 'totem', 'vinculo', 'praga', 'feiticeiro'].includes(h.arquetipo);

/** A magia do catálogo de ações da gema (o molde + os números do PoE no nível 1). */
function acaoDaGema(g, h, itemId, formato, elemento) {
  const visual = VISUAL[elemento] ?? 'physical';
  // (o Vínculo é um buff num aliado: o molde, sem dano, de suporte — como os buffs; `itens-poe/vinculos.mjs`)
  const vinculo = h.arquetipo === 'vinculo';
  // (14/10: o Feiticeiro liga como as auras — reserva e fica ligado; o Infestador, sem alvo)
  const buff = BUFF.has(h.arquetipo) || vinculo || h.arquetipo === 'feiticeiro';
  const tagsArea = (g.tags ?? []).some((t) => /Área/i.test(t));
  let moldeId;
  if (buff) moldeId = 'spell-blood-rage';
  else if (h.arquetipo === 'praga') moldeId = 'spell-haste';
  // O lacaio só invoca (o visual é o do estilo da gema): o molde sem alvo. O totem usa o molde da skill que ele vai usar (o projétil, a área).
  else if (h.arquetipo === 'lacaio') moldeId = 'spell-haste';
  else if (h.arquetipo === 'corpo_a_corpo') moldeId = tagsArea ? 'spell-front-sweep' : 'spell-brutal-strike';
  else if (h.arquetipo === 'movimento') moldeId = h.ataque || Object.keys(h.stats.dano ?? {}).length ? 'spell-ethereal-barrage' : 'spell-haste';
  else moldeId = MOLDES[formato]?.[visual] ?? MOLDES.projetil[visual] ?? 'spell-brutal-strike';
  const molde = acaoPorId(moldeId) ?? acaoPorId('spell-brutal-strike');
  // O efeito visual e o projétil do ELEMENTO (a corrente de espinhos vira de raio, de fogo...), quando o molde é de outro elemento.
  const doElemento = acaoPorId(MOLDES.projetil[visual]);
  const outroElemento = molde.element && VISUAL[molde.element] !== visual && molde.element !== visual && !buff;
  const d = danoNoNivel(g.slug, 1);
  const tempo = (h.stats.tempoUso ?? 0.75) * 1000;
  const recarga = h.stats.recarga ? h.stats.recarga * 1000 : 0;
  const entry = {
    ...molde,
    id: PREFIXO + g.slug,
    name: g.nome,
    words: '',
    element: buff ? null : h.ataque && !Object.keys(h.stats.dano ?? {}).length ? 'physical' : elemento,
    level: g.nivelReq ?? 1,
    magicLevel: 0,
    mana: custoNoNivel(g.slug, 1),
    // Os tempos do PoE (o `disparar` refaz com a ficha: velocidade de conjuração/ataque, recuperação de recarga): recarga só a do PoE.
    cooldown: Math.round(recarga),
    groupCooldown: Math.max(250, Math.round(tempo)),
    ...(outroElemento && doElemento ? { efeito: doElemento.efeito, projetil: molde.projetil ? doElemento.projetil : molde.projetil } : {}),
    damage: buff ? null : { min: Math.max(1, d.min), max: Math.max(1, d.max) },
    heals: false,
    curaOutro: false,
    overTime: null,
    summon: null,
    icon: null,
    itemId,
    runeId: null,
    kind: 'spell',
    vocations: null,
    // Lacaio e totem são de SUPORTE na barra (invocam; quem bate é o invocado).
    papeis: buff || ['lacaio', 'totem'].includes(h.arquetipo) ? ['suporte'] : moldeId === 'spell-haste' ? ['velocidade'] : ['attack'],
    group: buff || moldeId === 'spell-haste' || ['lacaio', 'totem'].includes(h.arquetipo) ? 'support' : 'attack',
    // Para os ganchos do combate (dano pelo nível da gema, custo, buff, bloqueio).
    poeGema: { slug: g.slug, arquetipo: h.arquetipo, ataque: !!h.ataque, buff: buff && !vinculo, molde: moldeId, ...(vinculo ? { vinculo: true } : {}), ...(['lacaio', 'totem'].includes(h.arquetipo) ? { lacaio: h.arquetipo } : {}), ...(iconeDaHabilidade(g.slug) ? { iconeHabilidade: iconeDaHabilidade(g.slug) } : {}) },
  };
  delete entry.blocked;
  return entry;
}

/** Os ids de item das gemas (estáveis: o arquivo só cresce — uma gema nova ganha o próximo número). */
function idsDasGemas(slugs) {
  const dados = existsSync(ARQ_IDS) ? JSON.parse(readFileSync(ARQ_IDS, 'utf8')) : { _nota: 'Id de ITEM de cada gema do PoE (slug → id). ESTÁVEL: só cresce (a peça salva guarda o número). Gerado por systems/itens-poe/gemas-poe.mjs.', ids: {} };
  let proximo = Math.max(PRIMEIRO_ID - 1, ...Object.values(dados.ids)) + 1;
  let novos = 0;
  for (const s of [...slugs].sort()) if (!dados.ids[s]) {
    dados.ids[s] = proximo++;
    novos++;
  }
  if (novos) writeFileSync(ARQ_IDS, `${JSON.stringify(dados, null, 1)}\n`);
  return dados.ids;
}

/** Troca as faixas "(a — b)" pelo valor na fração `t` (0..1) — a qualidade da gema vai de 0 a 20%. */
const naFracao = (texto, t) => texto.replace(/\((-?\d+(?:\.\d+)?)\s*—\s*(-?\d+(?:\.\d+)?)\)/g, (_, a, b) => String(Math.round((parseFloat(a) + (parseFloat(b) - parseFloat(a)) * t) * 10) / 10));

/** Quantos níveis da tabela têm `Experiência` (a XP para sair do nível). */
const niveisComXp = (g) => {
  const i = g?.colunas?.indexOf('Experiência') ?? -1;
  return i < 0 ? 0 : (g.linhas ?? []).filter((l) => Number(String(l[i] ?? '').replace(/,/g, '')) > 0).length;
};
const chaveDoRequisito = (g) => {
  const r = g.colunas?.indexOf('RequerNível') ?? -1;
  return (g.linhas ?? []).slice(0, 20).map((l) => (r >= 0 ? l[r] : '')).join(',');
};
let PELO_REQUISITO = null;
/**
 * A gema de onde vem a TABELA DE XP: a própria; sem ela (280 da coleção vieram sem a coluna preenchida — as transfiguradas "X of Y" e
 * as Vaal), a da gema de BASE, como no PoE (Vaal_X → X; X_of_Y → X, pelo nome mais longo que existe); sem base, uma gema com o mesmo
 * `RequerNível` nível a nível.
 */
export function gemaDaTabelaDeXp(g) {
  if (!g || niveisComXp(g) >= 19) return g;
  const partes = g.slug.replace(/^Vaal_/, '').split('_');
  for (let n = partes.length; n >= 1; n--) {
    const base = POR_SLUG.get(partes.slice(0, n).join('_'));
    if (base && base !== g && niveisComXp(base) >= 19) return base;
  }
  if (!PELO_REQUISITO) {
    PELO_REQUISITO = new Map();
    for (const x of GEMAS) if (niveisComXp(x) >= 19 && !PELO_REQUISITO.has(chaveDoRequisito(x))) PELO_REQUISITO.set(chaveDoRequisito(x), x);
  }
  return PELO_REQUISITO.get(chaveDoRequisito(g)) ?? g;
}

/** O nível máximo por XP (o último com `Experiência` na tabela + 1 — o 20 das gemas comuns); acima, só com o add de nível das peças. */
const maximoPorXp = (g) => niveisComXp(gemaDaTabelaDeXp(g)) + 1;

/** O valor interpolado de dano ("334.9 a 502.2") sai inteiro, como no PoE; os pequenos (raio de 1.3 metro) ficam com a casa. */
const inteiros = (t) => t.replace(/\d+\.\d+/g, (x) => (parseFloat(x) >= 10 ? String(Math.round(parseFloat(x))) : x));

/**
 * A FICHA da gema no nível (dono, 06/10: "mudar isso conforme a magia do PoE"): o que o balão do PoE mostra — tags, as propriedades
 * (nível, custo, conjuração, crítico, eficácia, requisito), a descrição, os modificadores com os números DESTE nível e os da qualidade —
 * e o que vale no jogo (status, motivos, as linhas que o combate ainda não faz).
 */
export function fichaNoNivel(slug, nivel = 1, qualidade = 0) {
  const g = POR_SLUG.get(slug);
  const r = REGISTRO.get(slug);
  const h = compilada(slug, nivel);
  if (!g || !h || !COMPILADOR?.textosDoNivel) return null;
  const n = h.nivel;
  const b = COMPILADOR.basicosDoNivel(g, n);
  const props = [];
  for (const p of COMPILADOR.propsDoNivel(g, n)) {
    if (/^Nível:/.test(p)) props.push(['Nível', `${n}${n >= maximoPorXp(g) ? ' (Máx)' : ''}`]);
    else if (/^Custo:/.test(p)) props.push(['Custo', `${b.custo ?? 0} Mana`]);
    else if (/^Eficácia do Dano Adicionado:/.test(p)) props.push(['Eficácia do Dano Adicionado', `${Math.round((b.efetividade ?? 1) * 100)}%`]);
    else {
      const i = p.indexOf(': ');
      // "(3 Times)" do poedb em português (as cargas da recarga).
      const valor = p.slice(i + 2).replace(/\((\d+) Times\)/, '($1 usos)');
      props.push(i > 0 ? [p.slice(0, i), valor] : [p, '']);
    }
  }
  const q = Math.max(0, Math.min(20, qualidade || 0));
  return {
    nome: g.nome, en: g.en, cor: g.cor, tags: g.tags ?? [], nivel: n, nivelMax: maximoPorXp(g), nivelReq: b.nivelReq ?? g.nivelReq ?? 1,
    props, desc: g.desc ?? '', mods: COMPILADOR.textosDoNivel(g, n).map(inteiros), qualidade: q, modsDaQualidade: (g.qualidade ?? []).map((t) => naFracao(t, q / 20)),
    status: r?.statusNoJogo ?? 'nao', motivos: r?.motivosNoJogo ?? [], naoFeitas: (h.linhas?.naoImplementadas ?? []).filter((l) => !ehLinhaDeAlvos(l) && !ehLinhaDeLacaio(l) && !ehLinhaDeAtaque(l) && !ehLinhaDeEscudo(l) && !ehLinhaDeRetaliacao(l) && !(ehUso(h) && ehLinhaLocalDaGema(l))),
    ataque: !!h.ataque, tempos: temposNoNivel(slug, n),
  };
}

let INICIADO = null;
/**
 * Liga as gemas do PoE no jogo (uma vez): lê a coleção, carrega o interpretador, registra a magia, o item e o buff de cada gema. Devolve
 * `{ gemas, porStatus }`. Precisa do `registrar` de `skills/gemas.mjs` e do de `skills/reforcos.mjs` (passados por quem chama, para este
 * módulo não importar o sistema de gemas, que importa ele).
 */
export async function iniciar({ registrarGema, registrarReforco } = {}) {
  if (INICIADO) return INICIADO;
  if (!ligado() || !existsSync(ARQ_GEMAS)) return (INICIADO = { gemas: 0, porStatus: {} });
  // (09/10) A tabela por nível de cada gema pela do poedb (a Experiência, os requisitos e as colunas que faltavam — `gemas-niveis.mjs`).
  GEMAS = comNiveisDoPoedb(JSON.parse(readFileSync(ARQ_GEMAS, 'utf8')));
  for (const g of GEMAS) POR_SLUG.set(g.slug, g);
  const comp = await import('./compilador-de-gemas/compilador.mjs');
  const prog = await import('./compilador-de-gemas/progressao.mjs');
  COMPILADOR = { compilarHabilidade: comp.compilarHabilidade, nivelMaximo: prog.nivelMaximo, textosDoNivel: prog.textosDoNivel, propsDoNivel: prog.propsDoNivel, basicosDoNivel: prog.basicosDoNivel };
  const ids = idsDasGemas(GEMAS.map((g) => g.slug));
  const porStatus = {};
  for (const g of GEMAS) {
    const nivelRef = Math.min(20, prog.nivelMaximo(g));
    const h = compilada(g.slug, nivelRef);
    if (!h) continue;
    const formato = FORMATO_PROPRIO[g.slug.replace(/_of_.*$/, '')] ?? FORMATO[h.arquetipo] ?? FORMATO[h.carga] ?? null;
    const elemento = ELEMENTO[h.elemento] ?? 'physical';
    const itemId = ids[g.slug];
    const entry = acaoDaGema(g, h, itemId, formato, elemento);
    const { status, motivos } = avaliarNoJogo({ ...h, slug: g.slug, nivel: nivelRef }, formato);
    if (status === 'nao') entry.poeGema.bloqueio = motivos[0];
    ACTION_CATALOG.spells.push(entry);
    REGISTRO.set(g.slug, { itemId, acao: entry.id, arquetipo: h.arquetipo, formato, elemento, ataque: !!h.ataque, buff: entry.poeGema.buff, molde: entry.poeGema.molde, statusNoJogo: status, motivosNoJogo: motivos, nivelMax: prog.nivelMaximo(g), gema: g });
    porStatus[status] = (porStatus[status] ?? 0) + 1;
    registrarGema?.({ itemId, entry, gema: g, tabelaDeXp: gemaDaTabelaDeXp(g), categoria: entry.poeGema.buff || entry.poeGema.vinculo ? 'reforco' : 'ataque', castTime: entry.poeGema.ataque ? 0 : Math.round((h.stats.tempoUso ?? 0) * 1000), levelMinimo: g.nivelReq ?? 1 });
    if (entry.poeGema.buff) registrarReforco?.(entry.id, { dur: buffNoNivel(g.slug, 1).dur, tipo: `poe-${h.arquetipo}`, efeitos: [] });
  }
  INICIADO = { gemas: REGISTRO.size, porStatus };
  return INICIADO;
}
export const ligadas = () => !!INICIADO?.gemas;
export const doSlug = (slug) => REGISTRO.get(slug) ?? null;
export const daAcao = (acao) => (String(acao).startsWith(PREFIXO) ? REGISTRO.get(String(acao).slice(PREFIXO.length)) ?? null : null);

/** Os atributos dos buffs de gema do PoE ligados agora (somados em `Afixos.soma`). null: nenhum. */
/**
 * A soma de um atributo nas peças vestidas — também a variante com CONDIÇÃO DE ESTADO ("Enquanto um Inimigo Único estiver em sua presença,
 * Ira possui 20% de aumento do Efeito de Aura": `efeito_buff_gema:ira@unicoNaPresenca`), quando a condição vale agora. (Aqui não dá para ler
 * a ficha: `adds` é parte da soma que monta a ficha.)
 */
// (ciclo 7) O leitor da ÁRVORE (as passivas alocadas — registrado por `acoes.mjs`, que as lê sem ciclo de imports).
// eslint-disable-next-line no-var
var leitorDaArvore;
export function definirLeitorDaArvore(fn) { leitorDaArvore = fn; }
function doEquipamento(estado, chave) {
  let conds = null;
  let n = 0;
  const somar = (af) => {
    for (const [k, v] of Object.entries(af ?? {})) {
      if (k !== chave && !k.startsWith(`${chave}@`)) continue;
      const cs = partir(k).conds;
      if (cs.length) {
        conds ??= condicoesDe(estado);
        if (!cs.every((c) => vale(conds, c))) continue;
      }
      n += Number(v) || 0;
    }
  };
  for (const p of Object.values(estado?.equipment ?? {})) somar(p?.poe?.af);
  // (+ a árvore: "Efeito dos Buffs de Arauto em você aumentado em X%")
  somar(leitorDaArvore?.(estado));
  return n;
}

/** (ciclo 7) As tags de gema que têm "Efeito do Buff" próprio na árvore (as que o arquétipo não separa). */
const TAGS_DE_BUFF = { Vínculo: 'vinculo', Guarda: 'guarda' };
export function adds(estado) {
  const hunt = estado?.hunt;
  if (!hunt?.buffs && !hunt?.lacaios?.length && !hunt?.partilha?.naSala?.length) return null;
  const agora = hunt.clock ?? 0;
  const total = {};
  // (× o "Efeito de Auras / dos Buffs dos Clamores / dos Arautos aumentado" dos únicos: `efeito_buff_gema:<arquétipo>` nas peças vestidas — e o
  // de UMA gema ("Ira possui 20% de aumento do Efeito de Aura", "Efeito do Buff da Armadura Ártica aumentado": `efeito_buff_gema:<nome da gema>`,
  // os implícitos eldritch e os únicos — 09/10).)
  // (11/10: o efeito é o do DONO da aura — `dono` — porque a aura de um companheiro de grupo também vale aqui)
  const efeitoDe = (tipo, id, dono = estado, b = null) => {
    const g = String(id ?? '').startsWith(PREFIXO) ? REGISTRO.get(String(id).slice(PREFIXO.length))?.gema : null;
    const daGema = g?.nome ? `efeito_buff_gema:${slugDoNome(g.nome)}` : null;
    // (ciclo 7) + pela TAG da gema ("Habilidades de Vínculo têm Efeito do Buff aumentado" — o Vínculo não tem arquétipo próprio)
    const porTag = (g?.tags ?? []).filter((t) => TAGS_DE_BUFF[t]).reduce((n, t) => n + doEquipamento(dono, `efeito_buff_gema:${TAGS_DE_BUFF[t]}`), 0);
    // (ciclo 7, lote G) o ESTANDARTE: "Habilidades de Estandarte têm Efeito de Aura aumentado"; (11/10) e o "X% mais Efeito de Aura por Valor
    // consumido" do Estandarte plantado (`estandarte.efeitoMais` — `mods-poe.plantarEstandarte`), que multiplica.
    const estandarte = /_Banner/.test(String(id)) ? doEquipamento(dono, 'efeito_buff_gema:estandarte') : 0;
    // (13/10, o Ego Supremo: "Habilidades Aura têm 1% mais Efeito de Aura por cada 2% de Mana máxima que Reservarem" — a reserva DESTA aura,
    // na máxima de agora; multiplica.)
    const porReserva = b?.reserva && b.reserva.recurso !== 'vida' && tipo === 'poe-aura' ? doEquipamento(dono, 'aura_efeito_por_reserva') : 0;
    const reservaPct = porReserva > 0 && (dono?.maxMana ?? 0) > 0 ? (100 * Math.ceil((b.reserva.pct ? (dono.maxMana * b.reserva.pct) / 100 : b.reserva.fixo ?? 0) * (b.reserva.fator ?? 1))) / dono.maxMana : 0;
    const mais = (1 + Math.max(0, Number(b?.estandarte?.efeitoMais) || 0) / 100) * (porReserva > 0 ? 1 + Math.floor(reservaPct / porReserva) / 100 : 1);
    return (1 + (doEquipamento(dono, `efeito_buff_gema:${String(tipo ?? '').replace(/^poe-/, '')}`) + doEquipamento(dono, 'efeito_buff_gema:todos') + (daGema ? doEquipamento(dono, daGema) : 0) + porTag + estandarte) / 100) * mais;
  };
  for (const [id, b] of Object.entries(hunt.buffs ?? {})) if (b.afPoe && b.ate > agora) { const f = efeitoDe(b.tipo, id, estado, b); for (const [k, v] of Object.entries(b.afPoe)) total[k] = (total[k] ?? 0) + v * f; }
  // (11/10) As AURAS dos COMPANHEIROS de grupo na mesma sala, a até o raio da aura deles (`raio` em casas, com o "Efeito em Área de Habilidades
  // de Aura aumentado" de quem lançou): valem em você como no PoE ("você e Aliados"). Cada aura uma vez: a sua, se você também tem a mesma.
  // (13/10, a Ichimonji: "Buffs de Auras Aliadas não afetam você" — o seu; "Os Buffs das Suas Auras não afetam aliados" — o do companheiro.)
  const semAurasAliadas = doEquipamento(estado, 'auras_aliadas_nao_afetam') > 0;
  for (const outro of semAurasAliadas ? [] : hunt.partilha?.naSala ?? []) {
    if (!outro || outro === estado || !outro.hunt?.pos || !hunt.pos || (outro.hunt.z ?? 0) !== (hunt.z ?? 0)) continue;
    if (doEquipamento(outro, 'auras_so_em_voce') > 0) continue;
    for (const [id, b] of Object.entries(outro.hunt.buffs ?? {})) {
      // (o Estandarte plantado vale em volta DELE, não de quem o plantou)
      const centro = b.estandarte ?? outro.hunt.pos;
      const longe = Math.max(Math.abs(centro.x - hunt.pos.x), Math.abs(centro.y - hunt.pos.y));
      if (b.tipo !== 'poe-aura' || !b.afPoe || !(b.ate > (outro.hunt.clock ?? agora)) || !(b.raio > 0) || longe > b.raio || hunt.buffs?.[id]?.ate > agora) continue;
      const f = efeitoDe(b.tipo, id, outro, b);
      for (const [k, v] of Object.entries(b.afPoe)) total[k] = (total[k] ?? 0) + v * f;
    }
  }
  // Os GOLENS dão bônus ao dono enquanto vivem ("Golens aumentam 24% de Dano", "+256 de precisão"...); o Golem Carniçal, dano físico
  // adicional por lacaio não-golem em campo.
  const vivos = (hunt.lacaios ?? []).filter((l) => l.hp > 0);
  const naoGolens = vivos.filter((l) => !l.golem && l.tipo === 'lacaio').length;
  // (09/10) × o "Efeitos de Buffs concedidos pelos seus Golens aumentados" (`efeito_buff_gema:golem`) e o de UM golem ("Golens de Chamas":
  // `efeito_buff_gema:convocar-golem-flamejante`).
  for (const l of vivos) {
    const nomeDaGema = l.golem ? REGISTRO.get(l.gema)?.gema?.nome : null;
    const f = l.golem ? 1 + (doEquipamento(estado, 'efeito_buff_gema:golem') + (nomeDaGema ? doEquipamento(estado, `efeito_buff_gema:${slugDoNome(nomeDaGema)}`) : 0)) / 100 : 1;
    for (const [k, v] of Object.entries(l.afDono ?? {})) total[k] = (total[k] ?? 0) + v * f;
    if (l.porLacaioFisico && naoGolens) {
      total.added_phys_dmg_min = (total.added_phys_dmg_min ?? 0) + l.porLacaioFisico[0] * naoGolens;
      total.added_phys_dmg_max = (total.added_phys_dmg_max ?? 0) + l.porLacaioFisico[1] * naoGolens;
    }
  }
  return Object.keys(total).length ? total : null;
}

/** No tique: um buff de gema do PoE com atributos venceu? (a ficha é refeita por quem chama). */
export function tique(estado) {
  const hunt = estado?.hunt;
  if (!hunt?.buffs) return false;
  const agora = hunt.clock ?? 0;
  const vivos = Object.entries(hunt.buffs).filter(([, b]) => b.afPoe && b.ate > agora).map(([id]) => id).sort().join(',');
  if (vivos === (hunt.buffsPoeVistos ?? '')) return false;
  hunt.buffsPoeVistos = vivos;
  return true;
}

/** A lista para a engine: o status no jogo de cada gema e os motivos. */
export const statusNoJogo = () => Object.fromEntries([...REGISTRO].map(([slug, r]) => [slug, { status: r.statusNoJogo, motivos: r.motivosNoJogo, molde: r.molde, formato: r.formato, elemento: r.elemento }]));
