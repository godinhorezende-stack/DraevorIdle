// A CAMPANHA — as 48 hunts normais em 4 atos (12 fases cada), jogadas em
// Fácil, depois Médio, depois Difícil, como o Normal/Cruel/Merciless do Path of
// Exile. Configuração em `gamedata/campanha.json`.
//
// Regras (decididas com o dono, uma a uma):
//   - completar uma fase = matar `kills[dificuldade]` bichos NELA; libera a seguinte;
//   - para entrar, só o PROGRESSO conta (não o level do personagem);
//   - as mortes da caçada offline contam; o personagem não troca de fase sozinho;
//   - na party, qualquer um entra, e cada morte conta para todos da sala;
//   - fim de cada ato: um boss, que abre com as 12 fases completas; a PRIMEIRA
//     vitória (sem task nem recarga) libera o ato seguinte — e a do Ato 4, a
//     dificuldade seguinte;
//   - fase com a hunt quebrada (`pular`) conta como completa sozinha;
//   - os bichos de cada fase são escalados do level original da hunt para o
//     level alvo da fase naquela dificuldade (`escalaDaFase`).
//
// O progresso fica no personagem: `estado.campanha[dificuldade] = { kills:
// {huntId: n}, completas: [huntId], bosses: [ato] }`.
import { readFileSync } from 'node:fs';

export const CAMPANHA = JSON.parse(readFileSync(new URL('../gamedata/campanha.json', import.meta.url), 'utf8'));
export const DIFICULDADES = Object.keys(CAMPANHA.dificuldades);
export const FASES = CAMPANHA.fases;
const INDICE = new Map(FASES.map((f, i) => [f.huntId, i]));
const FASES_POR_ATO = 12;
export const ATOS = Math.ceil(FASES.length / FASES_POR_ATO);

/** A fase de uma hunt (`null` se ela não é da campanha: boss, VIP, sala gerada...). */
export const faseDe = (huntId) => (INDICE.has(huntId) ? { ...FASES[INDICE.get(huntId)], indice: INDICE.get(huntId) } : null);
/** O boss que fecha um ato (`{bossId, nome, nivel}`), e o ato de um boss (`null` se não fecha nenhum). */
export const bossDoAto = (ato) => CAMPANHA.bosses[String(ato)] ?? null;
export const atoDoBoss = (bossId) => Number(Object.entries(CAMPANHA.bosses).find(([, b]) => b.bossId === bossId)?.[0]) || null;

const ehDificuldade = (d) => DIFICULDADES.includes(d);
function progresso(estado, dif) {
  estado.campanha ??= {};
  const p = (estado.campanha[dif] ??= {});
  p.kills ??= {};
  p.completas ??= [];
  p.bosses ??= [];
  return p;
}

/** A fase conta como completa (matou os X, ou é uma hunt quebrada que se pula)? */
export function faseCompleta(estado, dif, huntId) {
  const f = faseDe(huntId);
  if (!f) return false;
  return !!f.pular || progresso(estado, dif).completas.includes(huntId);
}

export const bossVencido = (estado, dif, ato) => progresso(estado, dif).bosses.includes(Number(ato));

/** A dificuldade está aberta? Fácil sempre; a seguinte, depois do boss do último ato da anterior. */
export function dificuldadeLiberada(estado, dif) {
  const i = DIFICULDADES.indexOf(dif);
  if (i <= 0) return i === 0;
  return bossVencido(estado, DIFICULDADES[i - 1], ATOS);
}

/** Pode entrar nesta fase, nesta dificuldade? */
export function faseLiberada(estado, dif, huntId) {
  const f = faseDe(huntId);
  if (!f || !ehDificuldade(dif) || !dificuldadeLiberada(estado, dif)) return false;
  if (f.indice === 0) return true;
  // A primeira fase de um ato pede o boss do ato anterior.
  if (f.indice % FASES_POR_ATO === 0 && !bossVencido(estado, dif, f.ato - 1)) return false;
  return faseCompleta(estado, dif, FASES[f.indice - 1].huntId);
}

/** O boss do ato está aberto? (as 12 fases dele completas, na dificuldade) */
export function bossLiberado(estado, dif, ato) {
  if (!ehDificuldade(dif) || !dificuldadeLiberada(estado, dif)) return false;
  return FASES.filter((f) => f.ato === Number(ato)).every((f) => faseCompleta(estado, dif, f.huntId));
}

/** Por que não dá para entrar (`null` = pode). */
export function motivoParaNaoEntrar(estado, dif, huntId) {
  const f = faseDe(huntId);
  if (!f) return null;
  if (!ehDificuldade(dif)) return 'Dificuldade inválida.';
  const nomeDif = CAMPANHA.dificuldades[dif].nome;
  if (!dificuldadeLiberada(estado, dif)) return `O ${nomeDif} abre depois de vencer o boss do Ato ${ATOS} na dificuldade anterior.`;
  if (faseLiberada(estado, dif, huntId)) return null;
  if (f.indice % FASES_POR_ATO === 0 && !bossVencido(estado, dif, f.ato - 1)) return `Derrote o boss do Ato ${f.ato - 1} (${bossDoAto(f.ato - 1)?.nome}) no ${nomeDif} para abrir o Ato ${f.ato}.`;
  return `Complete a fase anterior (${FASES[f.indice - 1].nome}) no ${nomeDif} para abrir esta.`;
}

/*
 * ---- A força dos bichos na fase ----
 * Multiplicador = (level alvo / level original) ^ expoente, para vida, dano e
 * exp. Troll Cave no Difícil (level alvo 601, troll de level 8): bem mais forte;
 * Walking Pillar no Fácil (alvo 100, original 1200): bem mais fraca.
 */
export function escala(levelOriginal, levelAlvo) {
  const e = CAMPANHA.escala;
  const r = Math.max(1, levelAlvo) / Math.max(1, levelOriginal);
  const f = (exp) => Math.max(e.minimo ?? 0, Math.pow(r, exp));
  return { vida: f(e.vida), dano: f(e.dano), exp: f(e.exp), nivel: levelAlvo };
}

export function escalaDaFase(huntId, dif) {
  const f = faseDe(huntId);
  return f && ehDificuldade(dif) ? escala(f.levelOriginal, f.nivel[dif]) : null;
}

export function escalaDoBoss(ato, dif) {
  const b = bossDoAto(ato);
  return b && ehDificuldade(dif) ? escala(b.levelOriginal, b.nivel[dif]) : null;
}

/** Aplica a escala num bicho recém-criado (vida, dano via `forca`, exp). No lugar. */
export function aplicarEscala(m, esc) {
  if (!m || !esc) return m;
  m.maxHp = Math.max(1, Math.round((m.maxHp ?? m.hp) * esc.vida));
  m.hp = m.maxHp;
  m.exp = Math.max(0, Math.round((m.exp ?? 0) * esc.exp));
  m.forca = (m.forca ?? 1) * esc.dano;
  return m;
}

/**
 * Uma morte na fase conta para o progresso (de quem matou e de cada um da
 * sala — ver `matarMonstro`). Devolve o aviso quando a fase fecha.
 */
export function contarKills(estado, hunt, n = 1) {
  const c = hunt?.campanha;
  if (!c || !n) return null;
  const f = faseDe(c.huntId);
  if (!f || f.pular) return null;
  const p = progresso(estado, c.dificuldade);
  if (p.completas.includes(f.huntId)) return null;
  p.kills[f.huntId] = (p.kills[f.huntId] ?? 0) + n;
  if (p.kills[f.huntId] < f.kills[c.dificuldade]) return null;
  p.completas.push(f.huntId);
  const nomeDif = CAMPANHA.dificuldades[c.dificuldade].nome;
  const proxima = FASES[f.indice + 1];
  const aviso =
    proxima && proxima.ato === f.ato
      ? `Fase completa: ${f.nome} (${nomeDif})! Liberou ${proxima.nome}.`
      : `Fase completa: ${f.nome} (${nomeDif})! O boss do Ato ${f.ato} (${bossDoAto(f.ato)?.nome}) está liberado.`;
  estado.avisoDaHunt = aviso;
  return aviso;
}

/** O boss do ato caiu: a primeira vitória libera o ato seguinte (ou a dificuldade seguinte). */
export function venceuBoss(estado, dif, ato) {
  const p = progresso(estado, dif);
  if (p.bosses.includes(Number(ato))) return null;
  p.bosses.push(Number(ato));
  const nomeDif = CAMPANHA.dificuldades[dif].nome;
  const proxDif = DIFICULDADES[DIFICULDADES.indexOf(dif) + 1];
  const aviso =
    Number(ato) < ATOS
      ? `Ato ${ato} concluído no ${nomeDif}! O Ato ${Number(ato) + 1} está liberado.`
      : proxDif
        ? `Campanha concluída no ${nomeDif}! O ${CAMPANHA.dificuldades[proxDif].nome} está liberado.`
        : `Campanha concluída no ${nomeDif}!`;
  estado.avisoDaHunt = aviso;
  return aviso;
}

/** A campanha para a tela: por dificuldade, as fases (com progresso) e os bosses. */
export function paraCliente(estado) {
  return {
    dificuldades: DIFICULDADES.map((dif) => {
      const p = progresso(estado, dif);
      return {
        id: dif,
        nome: CAMPANHA.dificuldades[dif].nome,
        faixa: CAMPANHA.dificuldades[dif].faixa,
        liberada: dificuldadeLiberada(estado, dif),
        fases: FASES.map((f) => ({
          huntId: f.huntId,
          nome: f.nome,
          ato: f.ato,
          nivel: f.nivel[dif],
          kills: Math.min(p.kills[f.huntId] ?? 0, f.kills[dif]),
          precisa: f.kills[dif],
          completa: faseCompleta(estado, dif, f.huntId),
          liberada: faseLiberada(estado, dif, f.huntId),
          ...(f.pular ? { pular: true } : {}),
        })),
        bosses: Object.entries(CAMPANHA.bosses).map(([ato, b]) => ({
          ato: Number(ato),
          bossId: b.bossId,
          nome: b.nome,
          nivel: b.nivel[dif],
          liberado: bossLiberado(estado, dif, ato),
          vencido: bossVencido(estado, dif, ato),
        })),
      };
    }),
  };
}

/** A fase em que a caçada está, para a barra da tela ("Troll Cave · Fácil — 312 / 500"). `null` fora da campanha. */
export function faseAtual(estado, hunt) {
  const c = hunt?.campanha;
  if (!c) return null;
  const dif = CAMPANHA.dificuldades[c.dificuldade];
  if (c.bossDoAto) return { tipo: 'boss', ato: c.ato, dificuldade: c.dificuldade, nomeDaDificuldade: dif?.nome, nome: bossDoAto(c.ato)?.nome, vencido: bossVencido(estado, c.dificuldade, c.ato) };
  const f = faseDe(c.huntId);
  if (!f) return null;
  const p = progresso(estado, c.dificuldade);
  return {
    tipo: 'fase', ato: f.ato, numero: f.indice + 1, dificuldade: c.dificuldade, nomeDaDificuldade: dif?.nome, nome: f.nome,
    kills: Math.min(p.kills[f.huntId] ?? 0, f.kills[c.dificuldade]), precisa: f.kills[c.dificuldade], completa: faseCompleta(estado, c.dificuldade, f.huntId),
  };
}
