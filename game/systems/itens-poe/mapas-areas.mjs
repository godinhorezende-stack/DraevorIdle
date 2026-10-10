// As ÁREAS dos mapas do endgame (T1–T16, dono 10/10 — só no jogo oficial). Cada tier é uma hunt virtual (`poe-mapa-<tier>`) montada como as
// áreas da campanha do PoE (`campanha.mjs`): o TERRENO de uma hunt do Draevor (o apelido do mapa), os MONSTROS comuns de uma área da
// campanha e um CHEFE (um monstro único da campanha) — todos LEVADOS AO NÍVEL DO MAPA (68–83) pelo crescimento por nível do PoE
// (`mapas.json → instancia.crescimentoPorNivel`, medido nos próprios monstros da campanha). A peça que abre o mapa decide o resto, na
// entrada (`Cacadas.entrar` com `mapa`): os efeitos dos afixos nos monstros e no chefe (`aplicarEfeitos`), a raridade a mais, o tamanho
// do grupo e quantos chefes.
import { ligado } from './catalogo.mjs';
import * as Mapas from './mapas.mjs';
import * as Monstros from './monstros.mjs';
import { CATALOGO } from '../dados.mjs';
import { BESTIARY } from '../hunt/monstros.mjs';
import { acharHunt, apelidarMapa, definirTransformadorDeSpawns, spawnsDaHunt } from '../hunt/terreno.mjs';

const C = Monstros.CAMPANHA;
export const CONFIG = Mapas.DADOS.instancia ?? { porTier: [], crescimentoPorNivel: {} };
const POR_TIER = new Map((CONFIG.porTier ?? []).map((t) => [Number(t.tier), t]));
const PREFIXO = 'poe-mapa-';

/** A hunt virtual do tier (`poe-mapa-<tier>`), ou null fora de T1…T16. */
export const huntIdDoTier = (tier) => (POR_TIER.has(Number(tier)) && Mapas.nivelDoTier(tier) ? `${PREFIXO}${Number(tier)}` : null);
/** O tier de uma hunt de mapa (ou null: não é mapa). */
export function tierDaHunt(huntId) {
  const m = /^poe-mapa-(\d+)$/.exec(String(huntId ?? ''));
  return m && POR_TIER.has(Number(m[1])) ? Number(m[1]) : null;
}

const STATUS_QUE_CRESCEM = ['vida', 'dano', 'experiencia', 'armadura', 'evasao', 'escudoDeEnergia'];
/**
 * O monstro do PoE (status de `campanha-poe.json`, num nível da campanha) levado ao `nivel` do mapa: cada status × e^(crescimento × níveis
 * a mais) — o dano das habilidades junto (a proporção entre o golpe e as magias continua a mesma). Resistências e tempo de ataque não
 * mudam com o nível no PoE.
 */
export function noNivel(m, nivel) {
  const d = Number(nivel) - Number(m.nivel);
  if (!d) return m;
  const fator = (campo) => Math.exp((Number(CONFIG.crescimentoPorNivel?.[campo]) || 0) * d);
  const saida = { ...m, nivel: Number(nivel) };
  for (const campo of STATUS_QUE_CRESCEM) if (Number(m[campo]) > 0) saida[campo] = Math.round(m[campo] * fator(campo));
  if (m.habilidades?.length) {
    const fd = fator('dano');
    saida.habilidades = m.habilidades.map((h) => (h.dano ? { ...h, dano: { min: Math.round(h.dano.min * fd), max: Math.round(h.dano.max * fd) } } : h));
  }
  return saida;
}

/** O monstro único da campanha pelo slug (o de nível mais alto; os chefes de ato também valem). */
function unicoPeloSlug(slug) {
  let achado = null;
  for (const a of Object.values(C.areas)) for (const m of a.monstros ?? []) if (m.slug === slug && (!achado || m.nivel > achado.nivel)) achado = m;
  for (const c of Object.values(C.chefes ?? {})) if (c.monstro?.slug === slug && (!achado || c.monstro.nivel > achado.nivel)) achado = c.monstro;
  return achado;
}
/** As criaturas do Draevor dos spawns de um terreno (o desenho dos monstros do PoE que não têm um pelo nome). */
const nativosDoTerreno = (terreno) => [...new Set((spawnsDaHunt(terreno) ?? []).flatMap((s) => (s.criaturas ?? []).map((c) => c.key)))].filter((k) => BESTIARY[k]);

// tier → { comuns: [chaves], chefe: chave }
const DO_TIER = new Map();
/** As chaves do bestiário dos monstros comuns do tier. */
export const comunsDoTier = (tier) => DO_TIER.get(Number(tier))?.comuns ?? [];
/** A chave do bestiário do chefe do tier (ou null). */
export const chefeDoTier = (tier) => DO_TIER.get(Number(tier))?.chefe ?? null;

let INICIADO = null;
/**
 * Monta as áreas dos mapas (uma vez): as hunts virtuais com o apelido do terreno, os monstros e o chefe de cada tier no nível do mapa, e o
 * transformador que põe os monstros do tier nos spawns do terreno. Sem o jogo oficial, nada. `{ tiers, problemas }`.
 */
export function iniciar() {
  if (!ligado()) return { tiers: 0, problemas: [] };
  if (INICIADO) return INICIADO;
  const problemas = [];
  for (const t of CONFIG.porTier ?? []) {
    const tier = Number(t.tier);
    const nivel = Mapas.nivelDoTier(tier);
    const area = C.areas[t.area];
    const base = acharHunt(t.terreno);
    if (!nivel) problemas.push(`T${tier}: o tier não está em mapas.json → tiers`);
    else if (!area || area.cidade) problemas.push(`T${tier}: a área "${t.area}" não existe na campanha do PoE`);
    else if (!base || base.poeArea || base.poeMapa) problemas.push(`T${tier}: o terreno "${t.terreno}" não é uma hunt do Draevor`);
    if (problemas.length && problemas.at(-1).startsWith(`T${tier}:`)) continue;
    const nativos = nativosDoTerreno(t.terreno);
    const comuns = (area.monstros ?? []).filter((m) => !m.unico).map((m, i) => Monstros.registrar(noNivel(m, nivel), nativos[i % Math.max(1, nativos.length)] ?? 'skeleton'));
    if (!comuns.length) {
      problemas.push(`T${tier}: a área "${t.area}" não tem monstros comuns`);
      continue;
    }
    const doChefe = t.chefe ? unicoPeloSlug(t.chefe) : null;
    if (t.chefe && !doChefe) problemas.push(`T${tier}: o chefe "${t.chefe}" não é um monstro único da campanha`);
    const chefe = doChefe ? Monstros.registrar(noNivel(doChefe, nivel), 'demon') : null;
    DO_TIER.set(tier, { comuns, chefe });
    const id = `${PREFIXO}${tier}`;
    apelidarMapa(id, t.terreno);
    const criaturas = [...new Set([...comuns, ...(chefe ? [chefe] : [])])].map((k) => ({ key: k, name: BESTIARY[k].name, look: BESTIARY[k].look, exp: BESTIARY[k].exp, hp: BESTIARY[k].hp }));
    const hunt = { ...base, id, name: `Mapa (Nível ${tier})`, level: nivel, blurb: `Mapa do Atlas · Nível ${tier} (PoE)`, poeMapa: tier, creatures: criaturas };
    const i = CATALOGO.hunts.findIndex((h) => h.id === id);
    if (i >= 0) CATALOGO.hunts[i] = hunt;
    else CATALOGO.hunts.push(hunt);
  }
  // Os spawns do terreno com os monstros comuns do tier, revezando (a quantidade, a raridade e os modificadores do spawn ficam).
  definirTransformadorDeSpawns((huntId, spawns) => {
    const comuns = comunsDoTier(tierDaHunt(huntId));
    if (!comuns.length) return spawns;
    return spawns.map((s, i) => ({ ...s, criaturas: [{ key: comuns[i % comuns.length], peso: 1 }] }));
  }, 'mapas');
  INICIADO = { tiers: DO_TIER.size, problemas };
  return INICIADO;
}

/**
 * Os EFEITOS do mapa (`resumo.efeitos.monstros`, ou `.chefe` no chefe) num monstro já pronto (raridade aplicada) — muta e devolve. As
 * porcentagens "mais" do PoE multiplicam o que o monstro já tem: a vida (e o escudo, que é parte da barra), o dano (`forca`), as
 * velocidades; a chance de crítico e o multiplicador somam pontos; a resistência soma por elemento; o dano extra por elemento e a
 * imunidade a atordoamento são campos do monstro (`combate.mjs`, `poderes.mjs`, `skills/estados.mjs`).
 */
export function aplicarEfeitos(m, ef) {
  if (!m || !ef) return m;
  const n = (k) => Number(ef[k]) || 0;
  if (n('vidaPct')) {
    m.maxHp = Math.max(1, Math.round(m.maxHp * (1 + n('vidaPct') / 100)));
    m.hp = m.maxHp;
    if (m.esPoe) m.esPoe.ultimoHp = m.maxHp;
  }
  if (n('esPct') > 0) {
    // "Ganham X% da Vida Máxima como Escudo de Energia Máximo Extra": o escudo por cima da barra, como o do modificador do monstro.
    const esAntes = (m.esPoe?.fracao ?? 0) * m.maxHp;
    const es = Math.round(((m.maxHp - esAntes) * n('esPct')) / 100);
    m.maxHp += es;
    m.hp = m.maxHp;
    m.esPoe = { ...(m.esPoe ?? {}), fracao: (esAntes + es) / m.maxHp, ultimoHp: m.maxHp };
  }
  if (n('danoPct')) m.forca = (m.forca ?? 1) * (1 + n('danoPct') / 100);
  if (n('velocidadePct')) m.velocidade = (m.velocidade ?? 1) * (1 + n('velocidadePct') / 100);
  if (n('velocidadeDeAtaquePct')) m.velocidadeDeAtaque = (m.velocidadeDeAtaque ?? 1) * (1 + n('velocidadeDeAtaquePct') / 100);
  if (n('critChance')) m.critChance = (m.critChance ?? 0) + n('critChance');
  if (n('critMultiplicador')) m.critMultiplicador = (m.critMultiplicador ?? 0) + n('critMultiplicador');
  if (n('precisaoPct')) m.precisaoPct = (m.precisaoPct ?? 0) + n('precisaoPct');
  for (const [el, v] of Object.entries(ef.resist ?? {})) if (Number(v)) m.resist = { ...(m.resist ?? {}), [el]: (m.resist?.[el] ?? 0) + Number(v) };
  for (const [el, v] of Object.entries(ef.danoExtraPct ?? {})) if (Number(v) > 0) m.danoExtraPct = { ...(m.danoExtraPct ?? {}), [el]: (m.danoExtraPct?.[el] ?? 0) + Number(v) };
  if (n('imuneAtordoamento') > 0) m.imuneAtordoamento = true;
  return m;
}
