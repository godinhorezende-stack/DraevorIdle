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
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { pathToFileURL } from 'node:url';
import { ligado } from './catalogo.mjs';
import { ACTION_CATALOG } from '../dados.mjs';

const RAIZ = process.env.REFERENCIAS_POE ?? '/home/deploy/referencias-poe';
const PASTA = join(RAIZ, 'poe-gemas-poedb', 'engine');
const ARQ_IDS = new URL('../../gamedata/itens-poe/gemas-poe-ids.json', import.meta.url);
export const PREFIXO = 'poe-gema:';
const PRIMEIRO_ID = 912001;

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
const BUFF = new Set(['aura', 'arauto', 'guarda', 'clamor', 'maldicao']);
const SEM_NO_JOGO = { generico: 'a gema não tem comportamento de combate reconhecido' };
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

/** A gema compilada no nível (cache): os números do PoE (`compilarHabilidade` da arena do dono). */
export function compilada(slug, nivel = 1) {
  const g = POR_SLUG.get(slug);
  if (!g || !COMPILADOR) return null;
  const n = Math.max(1, Math.min(nivel | 0 || 1, COMPILADOR.nivelMaximo?.(g) ?? 40));
  const k = `${slug}@${n}`;
  if (!CACHE.has(k)) CACHE.set(k, COMPILADOR.compilarHabilidade(g, n));
  return CACHE.get(k);
}

/**
 * Os TEMPOS do PoE da gema no nível (dono, 06/10: "cooldown e cast corretos com o do PoE"): o tempo de conjuração da magia (s), a recarga
 * própria (s, só as que têm "Recarga" no PoE — a maioria não tem) com as cargas, e a velocidade de ataque da gema de ataque ("X% de base":
 * o golpe da arma × X%).
 */
export function temposNoNivel(slug, nivel = 1) {
  const st = compilada(slug, nivel)?.stats ?? {};
  return { conjuracaoMs: Math.round((st.tempoUso ?? 0) * 1000), recargaMs: st.recarga ? Math.round(st.recarga * 1000) : 0, cargas: st.cargas ?? 1, velAtaqueBase: st.velAtaqueBase ?? 100 };
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
  [/^Dispara (?:um|1) Projétil adicional$/i, (m, a) => { a.projeteis += 1; }],
  [/se divide em direção a (\d+) alvos adiciona/i, (m, a) => { a.divide += Number(m[1]); }],
  [/^Projéteis se Difundem$/i, (m, a) => { a.bifurcar = Math.max(a.bifurcar, 2); }],
];
/** As linhas da gema no nível (os números DESTE nível), e o "RequerNível" dele — para quem lê a gema fora daqui (os lacaios). */
export function textosDaGema(slug, nivel = 1) {
  const g = POR_SLUG.get(slug);
  if (!g || !COMPILADOR?.textosDoNivel) return { linhas: [], props: [], requer: 1 };
  const n = Math.max(1, Math.min(nivel | 0 || 1, COMPILADOR.nivelMaximo?.(g) ?? 40));
  return { linhas: COMPILADOR.textosDoNivel(g, n), props: COMPILADOR.propsDoNivel(g, n), requer: COMPILADOR.basicosDoNivel(g, n).nivelReq ?? g.nivelReq ?? 1, nome: g.nome, tags: g.tags ?? [] };
}

/** As linhas da gema que o jogo agora faz (saem de "não simulado"). */
export const ehLinhaDeAlvos = (linha) => REGRAS_DE_ALVOS.some(([re]) => re.test(linha));
const ALVOS = new Map();
export function alvosNoNivel(slug, nivel = 1) {
  const g = POR_SLUG.get(slug);
  const n = Math.max(1, Math.min(nivel | 0 || 1, COMPILADOR?.nivelMaximo?.(g) ?? 40));
  const k = `${slug}@${n}`;
  if (ALVOS.has(k)) return ALVOS.get(k);
  const a = { saltos: 0, pctPorRestante: 0, perfurar: 0, projeteis: 0, bifurcar: 0, divide: 0 };
  for (const linha of g && COMPILADOR?.textosDoNivel ? COMPILADOR.textosDoNivel(g, n) : []) for (const [re, fazer] of REGRAS_DE_ALVOS) { const m = linha.match(re); if (m) fazer(m, a); }
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
  somar('physical', [arma.min ?? 1, arma.max ?? 1], ef);
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
/** Os tipos de AFECÇÃO ELEMENTAL no bicho agora (incêndio, resfriamento, congelamento, eletrização). */
export function afeccoesElementaisEm(bicho, agora) {
  const e = bicho?.estados ?? {};
  const vale = (s) => s && s.ate > agora;
  return [(bicho?.dots ?? []).some((d) => d.tipo === 'queimadura' && d.ate > agora), vale(e.lento), vale(e.congelado), vale(e.chocado)].filter(Boolean).length;
}
/** A eficácia de um ATAQUE no nível (o "Dano de Ataque X% de base"): o golpe da arma × isto. */
export const eficaciaNoNivel = (slug, nivel) => compilada(slug, nivel)?.stats?.efetividade ?? 1;
/** As chances de afecção da arena → as do jogo (`itens-poe/afeccoes.mjs`): as que existem. */
const AFECCAO_NO_JOGO = { incendiar: 'incendio', congelar: 'congelamento', eletrizar: 'eletrizacao', envenenar: 'veneno', sangrar: 'sangramento' };
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

// ---- os BUFFS (auras, arautos, guardas, gritos, maldições) no nível: os efeitos de reforço do Draevor + atributos na ficha ----
const AF_DO_ELEMENTO = { fogo: 'fire', gelo: 'ice', raio: 'energy', fisico: 'phys', caos: 'chaos' };
/** `{ efeitos, af, dur, motivos }` do buff da gema no nível. */
export function buffNoNivel(slug, nivel) {
  const h = compilada(slug, nivel);
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
  for (const t of b.extra ?? []) motivos.push(`efeito não aplicado no jogo: ${t}`);
  // A MALDIÇÃO: quem você atinge sofre mais dano (resistência reduzida, dano recebido) ou causa menos.
  const durMarca = Math.round((st.duracao ?? 6) * 1000);
  for (const [el, v] of Object.entries(m.resist ?? {})) if (v < 0 && ELEMENTO[el]) efeitos.push({ efeito: 'marcaVulneravel', pct: -v, tipos: [ELEMENTO[el]], durMarca });
  if (m.danoRecebido) efeitos.push({ efeito: 'marcaVulneravel', pct: m.danoRecebido, tipos: ['physical', 'fire', 'ice', 'energy', 'chaos', 'earth', 'death', 'holy'], durMarca });
  if (m.menosDano) efeitos.push({ efeito: 'marcaEnfraquece', pct: m.menosDano, durMarca });
  if (m.lentidao) motivos.push('a lentidão da maldição ainda não existe no jogo');
  if (h.arquetipo === 'clamor') efeitos.push({ efeito: 'provocar', raio: Math.max(3, Math.round(st.raioFinal ?? 4)) });
  // Aura e arauto: ligados enquanto a gema estiver encaixada (o uso automático renova); guarda e grito: a duração da gema.
  const dur = ['aura', 'arauto'].includes(h.arquetipo) ? 60000 : Math.round(Math.max(2, st.duracao ?? 6) * 1000);
  return { efeitos, af, dur, motivos };
}

// ---- o STATUS NO JOGO ----
function avaliarNoJogo(h, formato) {
  const st = h.stats;
  const motivos = [];
  if (SEM_NO_JOGO[h.arquetipo]) return { status: 'nao', motivos: [SEM_NO_JOGO[h.arquetipo]] };
  // LACAIOS e TOTENS (`lacaios-poe.mjs`): invocam de verdade, com o máximo, a duração e os bônus da gema; o que ainda é simplificado vai nos motivos.
  if (h.arquetipo === 'lacaio' || h.arquetipo === 'totem') {
    const motivos = h.arquetipo === 'totem'
      ? ['o totem fica parado e usa a skill da gema no bicho mais perto (os bônus do PoE ao totem, como a velocidade de posicionamento, não entram)']
      : ['o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro'];
    for (const l of h.linhas?.naoImplementadas ?? []) if (!ehLinhaDeLacaio(l) && !ehLinhaDeAlvos(l) && !ehLinhaDeAtaque(l)) motivos.push(`efeito não simulado: ${l}`);
    return { status: 'parcial', motivos };
  }
  if (BUFF.has(h.arquetipo)) {
    const b = buffNoNivel(h.slug, h.nivel);
    motivos.push(...b.motivos);
    if (!b.efeitos.length && !Object.keys(b.af).length) motivos.push('nenhum efeito do buff tem equivalente no jogo');
  } else {
    if (h.arquetipo === 'movimento') motivos.push('o deslocamento (salto, investida, teleporte) não existe: no jogo é o golpe na área');
    // Projéteis adicionais, perfuração, ricochetes, difusão e divisão do feixe: aplicados pelo nível da gema (`alvosNoNivel`).
    if (st.dot?.length) motivos.push('o dano degenerativo (ao longo do tempo) da gema não se aplica');
    if (st.estagios) motivos.push('os estágios de canalização não existem: no jogo é um uso por vez');
    if (st.repeticoes) motivos.push('as repetições do golpe não existem: no jogo é um');
    for (const [k, v] of Object.entries(st.chances ?? {})) if (v && !AFECCAO_NO_JOGO[k]) motivos.push(`a chance de ${v}% de ${k} ainda não existe no jogo`);
    if (st.cadaver) motivos.push('o uso de cadáveres não existe no jogo');
    if (!Object.keys(st.dano ?? {}).length && !h.ataque) motivos.push('sem dano direto: nenhum efeito no combate');
  }
  for (const l of h.linhas?.naoImplementadas ?? []) if (!ehLinhaDeAlvos(l) && !ehLinhaDeAtaque(l)) motivos.push(`efeito não simulado: ${l}`);
  return { status: motivos.length ? 'parcial' : 'funciona', motivos };
}

/** A magia do catálogo de ações da gema (o molde + os números do PoE no nível 1). */
function acaoDaGema(g, h, itemId, formato, elemento) {
  const visual = VISUAL[elemento] ?? 'physical';
  const buff = BUFF.has(h.arquetipo);
  const tagsArea = (g.tags ?? []).some((t) => /Área/i.test(t));
  let moldeId;
  if (buff) moldeId = 'spell-blood-rage';
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
    poeGema: { slug: g.slug, arquetipo: h.arquetipo, ataque: !!h.ataque, buff, molde: moldeId, ...(['lacaio', 'totem'].includes(h.arquetipo) ? { lacaio: h.arquetipo } : {}) },
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
    status: r?.statusNoJogo ?? 'nao', motivos: r?.motivosNoJogo ?? [], naoFeitas: (h.linhas?.naoImplementadas ?? []).filter((l) => !ehLinhaDeAlvos(l) && !ehLinhaDeLacaio(l) && !ehLinhaDeAtaque(l)),
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
  if (!ligado() || !existsSync(join(PASTA, 'dados', 'gemas.js'))) return (INICIADO = { gemas: 0, porStatus: {} });
  const janela = {};
  runInNewContext(readFileSync(join(PASTA, 'dados', 'gemas.js'), 'utf8'), { window: janela });
  GEMAS = janela.GEMAS ?? [];
  for (const g of GEMAS) POR_SLUG.set(g.slug, g);
  const comp = await import(pathToFileURL(join(PASTA, 'src', 'gemas', 'compilador.mjs')).href);
  const prog = await import(pathToFileURL(join(PASTA, 'src', 'gemas', 'progressao.mjs')).href);
  COMPILADOR = { compilarHabilidade: comp.compilarHabilidade, nivelMaximo: prog.nivelMaximo, textosDoNivel: prog.textosDoNivel, propsDoNivel: prog.propsDoNivel, basicosDoNivel: prog.basicosDoNivel };
  const ids = idsDasGemas(GEMAS.map((g) => g.slug));
  const porStatus = {};
  for (const g of GEMAS) {
    const nivelRef = Math.min(20, prog.nivelMaximo(g));
    const h = compilada(g.slug, nivelRef);
    if (!h) continue;
    const formato = FORMATO[h.arquetipo] ?? FORMATO[h.carga] ?? null;
    const elemento = ELEMENTO[h.elemento] ?? 'physical';
    const itemId = ids[g.slug];
    const entry = acaoDaGema(g, h, itemId, formato, elemento);
    const { status, motivos } = avaliarNoJogo({ ...h, slug: g.slug, nivel: nivelRef }, formato);
    if (status === 'nao') entry.poeGema.bloqueio = motivos[0];
    ACTION_CATALOG.spells.push(entry);
    REGISTRO.set(g.slug, { itemId, acao: entry.id, arquetipo: h.arquetipo, formato, elemento, ataque: !!h.ataque, buff: entry.poeGema.buff, molde: entry.poeGema.molde, statusNoJogo: status, motivosNoJogo: motivos, nivelMax: prog.nivelMaximo(g), gema: g });
    porStatus[status] = (porStatus[status] ?? 0) + 1;
    registrarGema?.({ itemId, entry, gema: g, tabelaDeXp: gemaDaTabelaDeXp(g), categoria: entry.poeGema.buff ? 'reforco' : 'ataque', castTime: entry.poeGema.ataque ? 0 : Math.round((h.stats.tempoUso ?? 0) * 1000), levelMinimo: g.nivelReq ?? 1 });
    if (entry.poeGema.buff) registrarReforco?.(entry.id, { dur: buffNoNivel(g.slug, 1).dur, tipo: `poe-${h.arquetipo}`, efeitos: [] });
  }
  INICIADO = { gemas: REGISTRO.size, porStatus };
  return INICIADO;
}
export const ligadas = () => !!INICIADO?.gemas;
export const doSlug = (slug) => REGISTRO.get(slug) ?? null;
export const daAcao = (acao) => (String(acao).startsWith(PREFIXO) ? REGISTRO.get(String(acao).slice(PREFIXO.length)) ?? null : null);

/** Os atributos dos buffs de gema do PoE ligados agora (somados em `Afixos.soma`). null: nenhum. */
export function adds(estado) {
  const hunt = estado?.hunt;
  if (!hunt?.buffs && !hunt?.lacaios?.length) return null;
  const agora = hunt.clock ?? 0;
  const total = {};
  for (const b of Object.values(hunt.buffs ?? {})) if (b.afPoe && b.ate > agora) for (const [k, v] of Object.entries(b.afPoe)) total[k] = (total[k] ?? 0) + v;
  // Os GOLENS dão bônus ao dono enquanto vivem ("Golens aumentam 24% de Dano", "+256 de precisão"...); o Golem Carniçal, dano físico
  // adicional por lacaio não-golem em campo.
  const vivos = (hunt.lacaios ?? []).filter((l) => l.hp > 0);
  const naoGolens = vivos.filter((l) => !l.golem && l.tipo === 'lacaio').length;
  for (const l of vivos) {
    for (const [k, v] of Object.entries(l.afDono ?? {})) total[k] = (total[k] ?? 0) + v;
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
