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
  nova: { fire: 'spell-hell-s-core', ice: 'spell-ice-burst', energy: 'spell-rage-of-the-skies', physical: 'spell-groundshaker', death: 'spell-wrath-of-nature' },
  onda: { fire: 'spell-fire-wave', ice: 'spell-ice-wave', energy: 'spell-energy-wave', physical: 'spell-front-sweep', death: 'spell-terra-wave' },
  feixe: { fire: 'spell-fire-wave', ice: 'spell-ice-wave', energy: 'spell-energy-beam', physical: 'spell-front-sweep', death: 'spell-great-death-beam' },
  cadeia: { ice: 'spell-forked-glacier', fire: 'spell-forked-thorns', energy: 'spell-forked-thorns', physical: 'spell-forked-thorns', death: 'spell-forked-thorns' },
};
/** O formato de cada arquétipo da arena (o `carga` dos objetos: armadilha e mina valem pelo que soltam). */
const FORMATO = { projetil: 'projetil', area: 'chao', chuva: 'chao', orbe: 'chao', marca: 'chao', armadilha: 'chao', mina: 'chao', nova: 'nova', impacto: 'onda', canalizacao: 'feixe', ricochete: 'cadeia' };
const BUFF = new Set(['aura', 'arauto', 'guarda', 'clamor', 'maldicao']);
const SEM_NO_JOGO = { lacaio: 'lacaios ainda não existem no jogo (o Draevor tem só o familiar)', totem: 'totens ainda não existem no jogo', generico: 'a gema não tem comportamento de combate reconhecido' };

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

/** O dano direto da gema no nível: `{ min, max, elementos }` (todos os elementos somados no elemento principal). */
export function danoNoNivel(slug, nivel) {
  const h = compilada(slug, nivel);
  const d = Object.values(h?.stats?.dano ?? {});
  return { min: Math.round(d.reduce((t, [a]) => t + a, 0)), max: Math.round(d.reduce((t, [, b]) => t + b, 0)), elementos: Object.keys(h?.stats?.dano ?? {}).length };
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
  if (SEM_NO_JOGO[h.arquetipo] || (['totem'].includes(h.arquetipo))) return { status: 'nao', motivos: [SEM_NO_JOGO[h.arquetipo] ?? SEM_NO_JOGO.totem] };
  if (BUFF.has(h.arquetipo)) {
    const b = buffNoNivel(h.slug, h.nivel);
    motivos.push(...b.motivos);
    if (!b.efeitos.length && !Object.keys(b.af).length) motivos.push('nenhum efeito do buff tem equivalente no jogo');
  } else {
    if (h.arquetipo === 'movimento') motivos.push('o deslocamento (salto, investida, teleporte) não existe: no jogo é o golpe na área');
    if (Object.keys(st.dano ?? {}).length > 1) motivos.push(`o dano de ${Object.keys(st.dano).join(' + ')} sai num elemento só`);
    if ((st.projeteis ?? 1) > 1 || st.projeteisExtra) motivos.push(`dispara ${(st.projeteis ?? 1) + (st.projeteisExtra ?? 0)} projéteis: no jogo, 1 (os suportes de projétil do Draevor somam)`);
    if (st.perfura) motivos.push('a perfuração da gema não se aplica (só a dos suportes)');
    if (st.ricochetes && formato !== 'cadeia') motivos.push('os ricochetes da gema não se aplicam');
    if (st.dot?.length) motivos.push('o dano degenerativo (ao longo do tempo) da gema não se aplica');
    if (st.estagios) motivos.push('os estágios de canalização não existem: no jogo é um uso por vez');
    if (st.repeticoes) motivos.push('as repetições do golpe não existem: no jogo é um');
    for (const [k, v] of Object.entries(st.chances ?? {})) if (v && !AFECCAO_NO_JOGO[k]) motivos.push(`a chance de ${v}% de ${k} ainda não existe no jogo`);
    if (st.cadaver) motivos.push('o uso de cadáveres não existe no jogo');
    if (!Object.keys(st.dano ?? {}).length && !h.ataque) motivos.push('sem dano direto: nenhum efeito no combate');
  }
  for (const l of h.linhas?.naoImplementadas ?? []) motivos.push(`efeito não simulado: ${l}`);
  return { status: motivos.length ? 'parcial' : 'funciona', motivos };
}

/** A magia do catálogo de ações da gema (o molde + os números do PoE no nível 1). */
function acaoDaGema(g, h, itemId, formato, elemento) {
  const visual = VISUAL[elemento] ?? 'physical';
  const buff = BUFF.has(h.arquetipo);
  const tagsArea = (g.tags ?? []).some((t) => /Área/i.test(t));
  let moldeId;
  if (buff) moldeId = 'spell-blood-rage';
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
    cooldown: Math.max(500, Math.round(recarga || tempo)),
    groupCooldown: Math.max(500, Math.round(tempo)),
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
    papeis: buff ? ['suporte'] : moldeId === 'spell-haste' ? ['velocidade'] : ['attack'],
    group: buff || moldeId === 'spell-haste' ? 'support' : 'attack',
    // Para os ganchos do combate (dano pelo nível da gema, custo, buff, bloqueio).
    poeGema: { slug: g.slug, arquetipo: h.arquetipo, ataque: !!h.ataque, buff, molde: moldeId },
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
  COMPILADOR = { compilarHabilidade: comp.compilarHabilidade, nivelMaximo: prog.nivelMaximo };
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
    registrarGema?.({ itemId, entry, gema: g, categoria: entry.poeGema.buff ? 'reforco' : 'ataque', castTime: entry.poeGema.ataque ? 0 : Math.round((h.stats.tempoUso ?? 0) * 1000), levelMinimo: g.nivelReq ?? 1 });
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
  if (!hunt?.buffs) return null;
  const agora = hunt.clock ?? 0;
  const total = {};
  for (const b of Object.values(hunt.buffs)) if (b.afPoe && b.ate > agora) for (const [k, v] of Object.entries(b.afPoe)) total[k] = (total[k] ?? 0) + v;
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
