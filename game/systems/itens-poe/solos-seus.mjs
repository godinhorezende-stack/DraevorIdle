// OS SOLOS QUE VOCÊ CRIA (06/11, lote 11 das inertes — dono: "Continue resolvendo até dar zero nos itens"). Os dos monstros moram em `hunt.solosDosMonstros`
// (`mobs/mecanicas` — o Ardente, o Eletrizado e o Congelado em você); os seus, em `hunt.solosSeus`, valem nos MONSTROS que estão neles (a casa no raio, no seu andar):
//
//   ELETRIZADO — Eletriza em 15% (o Solo Eletrizado do PoE sem número próprio: o mínimo útil da Eletrização) enquanto o monstro está nele (o Despertar da Destruição deixa
//                um rastro ao se mover; a Trapaça de Ylfeban o cria quando você é Acertado);
//   CÁUSTICO / ARDENTE — Caos / Fogo por segundo (o Quebra-cercos e a Réplica: 20% da Vida máxima do lacaio que morreu), pelo dano degenerativo do jogo;
//   PICHE — Tolhe 30% (o Hinder do PoE sem número próprio: o da Aranha) — a Matua Tupuna o espalha ao Bloquear;
//   FÚNGICO — o Guarda-esporo: em volta de você enquanto parado; quem está nele causa 10% menos Dano (o lembrete do PoE: "Inimigos no seu Solo Fúngico causam 10% menos
//             Dano; você e Aliados no seu Solo Fúngico ganham 10% do Dano Não-Caótico como Caos extra") e morre explodindo, com a linha da peça.
// Os raios e as durações que o PoE não publica: 1 casa e 4 s (o Fúngico: 2 casas, enquanto parado).
import { ativo, naAreaFria } from './condicoes-poe.mjs';
import * as Dot from '../combate/dot.mjs';
import { tolher as tolherBicho } from '../skills/estados.mjs';

export const SOLOS = Object.freeze({
  eletrizado: { pct: 15, raio: 1, segundos: 4 },
  caustico: { tipoDot: 'degenCaos', raio: 1, segundos: 4 },
  ardente: { tipoDot: 'degenFogo', raio: 1, segundos: 4 },
  piche: { tolherPct: 30, raio: 1, segundos: 4 },
  fungico: { raio: 2, danoMenosPct: 10, caosExtraPct: 10 },
});
const MAXIMO = 40;
const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** Cria um solo seu (`tipo`) em `onde` (a sua casa, sem ele). `dps`: o dano por segundo dos que queimam. Devolve o solo. */
export function criar(hunt, tipo, { x = hunt?.pos?.x, y = hunt?.pos?.y, raio = SOLOS[tipo]?.raio ?? 1, segundos = SOLOS[tipo]?.segundos ?? 4, dps = 0, agora = hunt?.clock ?? 0 } = {}) {
  if (!hunt || !SOLOS[tipo] || x == null) return null;
  const s = { tipo, x, y, z: hunt.z ?? 0, raio, ate: agora + segundos * 1000, proximo: agora, ...(dps > 0 ? { dps } : {}) };
  hunt.solosSeus = [...(hunt.solosSeus ?? []).filter((o) => o.ate > agora), s].slice(-MAXIMO);
  return s;
}

/**
 * O tique (no tique do PoE — `mods-poe.tiqueDosAspectos`): os solos valem nos monstros neles; o rastro do Despertar da Destruição; o Fúngico em volta de você parado; e o
 * Cáustico/Ardente onde um lacaio seu morreu (o lacaio que sumiu desde o último tique — o morto e o que acabou: no PoE, os dois morrem).
 */
export function tique(hunt, af, agora = hunt?.clock ?? 0, { parado = false } = {}) {
  if (!hunt?.pos) return;
  const n = (k) => Number(af?.[k]) || 0;
  // o rastro ao se mover ("Deixa Solo Eletrizado enquanto se move, durando 2 segundos")
  const pos = `${hunt.pos.x},${hunt.pos.y},${hunt.z ?? 0}`;
  if (n('solo_eletrizado_movendo_s') > 0 && hunt.poeSoloUltimaPos && hunt.poeSoloUltimaPos !== pos) criar(hunt, 'eletrizado', { segundos: n('solo_eletrizado_movendo_s'), agora });
  hunt.poeSoloUltimaPos = pos;
  // o Fúngico: enquanto parado, em volta de você
  hunt.poeSoloFungico = n('solo_fungico_parado') > 0 && parado ? { x: hunt.pos.x, y: hunt.pos.y, z: hunt.z ?? 0, raio: SOLOS.fungico.raio, ate: agora + 500 } : null;
  // os lacaios que morreram (ou acabaram) desde o último tique
  const pct = { caustico: n('lacaio_morte_solo_caustico_pct'), ardente: n('lacaio_morte_solo_ardente_pct') };
  const vistos = hunt.poeLacaiosVistos ?? {};
  const agoraVivos = {};
  for (const l of hunt.lacaios ?? []) if (l.hp > 0 && !l.intocavel) agoraVivos[l.uid] = { x: l.x, y: l.y, maxHp: l.maxHp ?? 0 };
  if (pct.caustico > 0 || pct.ardente > 0) {
    for (const [uid, l] of Object.entries(vistos)) {
      if (agoraVivos[uid]) continue;
      for (const tipo of ['caustico', 'ardente']) if (pct[tipo] > 0) criar(hunt, tipo, { x: l.x, y: l.y, dps: (l.maxHp * pct[tipo]) / 100, agora });
    }
  }
  hunt.poeLacaiosVistos = agoraVivos;
  const solos = (hunt.solosSeus = (hunt.solosSeus ?? []).filter((s) => s.ate > agora));
  const fungico = hunt.poeSoloFungico;
  if (!solos.length && !fungico && !hunt.areasFrias?.length && !(Number(af?.solo_sagrado_dano_sofrido) > 0)) return;
  for (const m of hunt.monstros ?? []) {
    if (!(m.hp > 0) || m.dummy) continue;
    const e = (m.estados ??= {});
    if (fungico && dist(m, fungico) <= fungico.raio) e.soloFungico = { ate: agora + 500, danoMenosPct: SOLOS.fungico.danoMenosPct };
    // (a Fé Engarrafada: o monstro no Solo Sagrado do frasco ou num seu, com o "aplica Dano sofrido aumentado" do efeito)
    const consagra = Number(af?.solo_sagrado_dano_sofrido) || 0;
    if (consagra > 0 && [hunt.poeSoloDoFrasco, ...(hunt.solosSagrados ?? [])].some((g) => g && g.ate > agora && (g.z ?? hunt.z ?? 0) === (hunt.z ?? 0) && dist(m, g) <= g.raio)) e.consagradoFragil = { ate: agora + 500, pct: consagra };
    // (o Algor Mortis: o monstro numa das suas Áreas Resfriadas — a marca para as linhas "em Áreas Resfriadas")
    if (hunt.areasFrias?.length && naAreaFria(hunt, m, agora)) e.naAreaFria = { ate: agora + 500 };
    for (const s of solos) {
      if (s.z !== (hunt.z ?? 0) || dist(m, s) > s.raio) continue;
      if (s.tipo === 'eletrizado' && !m.imuneChoque) {
        const a = e.chocado;
        if (!(ativo(a, agora) && (a.pct ?? 0) > SOLOS.eletrizado.pct)) e.chocado = { ate: Math.max(a?.ate ?? 0, agora + 500), pct: SOLOS.eletrizado.pct, dur: 500 };
      } else if (s.tipo === 'piche') tolherBicho(m, SOLOS.piche.tolherPct, 500, agora);
      else if ((s.tipo === 'caustico' || s.tipo === 'ardente') && s.dps > 0 && agora >= (s.proximoDe?.[m.uid] ?? 0)) {
        (s.proximoDe ??= {})[m.uid] = agora + 1000;
        Dot.aplicar(m, { tipo: SOLOS[s.tipo].tipoDot, total: s.dps, duracaoMs: 1000, chave: `soloSeu:${s.tipo}`, origem: { fonte: 'poe' } }, agora);
      }
    }
  }
}
/** Você está no seu Solo Fúngico agora? */
export const noFungico = (hunt, agora = hunt?.clock ?? 0) => (hunt?.poeSoloFungico?.ate ?? 0) > agora;
