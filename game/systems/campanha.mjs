// A CAMPANHA — as 48 hunts normais em 4 atos (12 fases cada), jogadas em
// Fácil, depois Médio, depois Difícil, como o Normal/Cruel/Merciless do Path of
// Exile. Configuração em `gamedata/campanha.json`.
//
// Regras (decididas com o dono, uma a uma):
//   - completar uma fase = LIMPAR uma instância dela (todos os bichos mortos,
//     sem respawn — ver `hunt/instancia.mjs`); libera a seguinte;
//   - para entrar, só o PROGRESSO conta (não o level do personagem);
//   - a limpeza na caçada offline conta; offline ele fica sempre na mesma hunt;
//   - na party, qualquer um entra, e a limpeza conta para todos da sala;
//   - fim de cada ato: um boss, que abre com as 12 fases completas; a PRIMEIRA
//     vitória (sem task nem recarga) libera o ato seguinte — e a do Ato 4, a
//     dificuldade seguinte;
//   - fase travada (`pular`: hunt quebrada ou fechada pelo dono) NÃO se entra, e conta como completa sozinha;
//   - os bichos de cada fase são escalados do level original da hunt para o
//     level alvo da fase naquela dificuldade (`escalaDaFase`).
//
// O progresso fica no personagem: `estado.campanha[dificuldade] = { limpezas:
// {huntId: n}, completas: [huntId], bosses: [ato] }` (`kills` é do sistema de
// antes, por contagem de mortes: fica gravado, ninguém mais lê).
import { readFileSync } from 'node:fs';
import { conteudoDaFase, exigidasDaFase, nomesDeBosses, atosDoConteudo } from './campanha-conteudo.mjs';

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
  p.limpezas ??= {};
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
  // Fase travada (`pular`): ninguém entra — nem pelo cliente, nem mandando o `startHunt` na mão.
  if (f.pular) return false;
  if (f.indice === 0) return true;
  // A primeira fase de um ato pede o boss do ato anterior.
  if (f.indice % FASES_POR_ATO === 0 && !bossVencido(estado, dif, f.ato - 1)) return false;
  if (primeiraIncompleta(estado, dif, f)) return false;
  // Requisitos de entrada do conteúdo (editor): fases que precisam estar completas além da cadeia do ato.
  return exigidasDaFase(huntId).every((id) => faseCompleta(estado, dif, id));
}

/**
 * A primeira fase do ATO, antes desta, que ainda não está completa (a travada conta como completa) — ou
 * `null`. A liberação olha a CADEIA inteira, e não só a fase de trás: com a party, uma fase pode ficar
 * "completa" (a limpeza conta para todos da sala) sem a anterior estar — e olhando só a de trás, essa
 * marca abria a seguinte, que abria a seguinte... (uma fase aberta no meio do ato, com a 6 por fazer).
 */
export function primeiraIncompleta(estado, dif, f) {
  const inicio = f.indice - (f.indice % FASES_POR_ATO);
  for (let k = inicio; k < f.indice; k++) if (!faseCompleta(estado, dif, FASES[k].huntId)) return FASES[k];
  return null;
}

/**
 * A fase que precisa estar completa para abrir esta: a anterior — mas a travada (`pular`) conta como
 * completa SOZINHA, então ela não pode ser o elo: com ela como exigência, quem nunca jogou o ato
 * entrava direto na fase depois dela (foi assim que a Infernatil Seal abria no começo). Anda para
 * trás até a primeira que não é travada. `null` = nada antes dela no ato.
 */
export function faseExigida(f) {
  let k = f.indice - 1;
  while (k >= 0 && FASES[k].ato === f.ato && FASES[k].pular) k--;
  return k >= 0 && FASES[k].ato === f.ato ? FASES[k] : null;
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
  if (f.pular) return `${f.nome} está travada (em obras) e não abre por enquanto.`;
  if (faseLiberada(estado, dif, huntId)) return null;
  if (f.indice % FASES_POR_ATO === 0 && !bossVencido(estado, dif, f.ato - 1)) return `Derrote o boss do Ato ${f.ato - 1} (${bossDoAto(f.ato - 1)?.nome}) no ${nomeDif} para abrir o Ato ${f.ato}.`;
  const faltando = exigidasDaFase(huntId).find((id) => !faseCompleta(estado, dif, id));
  if (faltando && !primeiraIncompleta(estado, dif, f)) return `Complete antes ${faseDe(faltando)?.nome ?? faltando} no ${nomeDif} para abrir esta.`;
  return `Complete a fase anterior (${(primeiraIncompleta(estado, dif, f) ?? FASES[f.indice - 1]).nome}) no ${nomeDif} para abrir esta.`;
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
 * A instância da fase foi LIMPA (todos os bichos mortos): conta a limpeza e,
 * na primeira, completa a fase e libera a seguinte. Vale para quem estava na
 * sala (ver `hunt/instancia.mjs`). Devolve o aviso "Hunt Clear!" da tela.
 */
export function limpou(estado, hunt) {
  const c = hunt?.campanha;
  if (!c || c.bossDoAto) return null;
  const f = faseDe(c.huntId);
  if (!f || f.pular) return null;
  const p = progresso(estado, c.dificuldade);
  p.limpezas[f.huntId] = (p.limpezas[f.huntId] ?? 0) + 1;
  const nomeDif = CAMPANHA.dificuldades[c.dificuldade].nome;
  let aviso;
  if (p.completas.includes(f.huntId)) {
    aviso = `Hunt Clear! ${f.nome} (${nomeDif}) limpa.`;
  } else {
    p.completas.push(f.huntId);
    const proxima = FASES[f.indice + 1];
    aviso =
      proxima && proxima.ato === f.ato
        ? `Hunt Clear! Fase completa: ${f.nome} (${nomeDif}). Liberou ${proxima.nome}.`
        : `Hunt Clear! Fase completa: ${f.nome} (${nomeDif}). O boss do Ato ${f.ato} (${bossDoAto(f.ato)?.nome}) está liberado.`;
  }
  estado.avisoDaHunt = aviso;
  return aviso;
}

/** O que fazer ao completar uma fase: `'repetir'` (fica em loop nela, o padrão) ou `'seguir'`. */
export const AO_COMPLETAR = ['repetir', 'seguir'];
export const aoCompletar = (estado) => (AO_COMPLETAR.includes(estado.settings?.aoCompletarFase) ? estado.settings.aoCompletarFase : 'repetir');

/**
 * A fase seguinte para quem escolheu "Seguir": a próxima do MESMO ato que não
 * se pula e já está liberada. No fim do ato não segue: o boss é uma luta, não
 * uma fase — o aviso da tela diz que ele abriu. `null` = fica onde está.
 */
export function proximaParaSeguir(estado, dif, huntId) {
  const f = faseDe(huntId);
  if (!f) return null;
  for (let i = f.indice + 1; i < FASES.length && FASES[i].ato === f.ato; i++) {
    if (FASES[i].pular) continue;
    return faseLiberada(estado, dif, FASES[i].huntId) ? FASES[i] : null;
  }
  return null;
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

/**
 * O que a tela WORLD sabe de uma fase além do progresso: descrição, ambiente, conexões, o que ela exige, o boss
 * principal e os encontros OBRIGATÓRIOS (a condição de conclusão) — e, dos opcionais e secretos, SÓ os que este
 * personagem já ENCONTROU (concluiu): nenhum segredo, baú ou boss oculto é revelado antes da hora.
 */
function mundoDaFase(estado, f) {
  const c = conteudoDaFase(f.huntId);
  const m = c.mundo ?? {};
  const concluidos = estado.encontros?.concluidos?.[f.huntId] ?? {};
  const descobertos = (m.todos ?? []).filter((e) => concluidos[e.id]).map((e) => ({ nome: e.nome, tipo: e.tipo, vezes: concluidos[e.id] }));
  return {
    ...(c.descricao ? { descricao: c.descricao } : {}),
    ...(c.ambiente ? { ambiente: c.ambiente } : {}),
    // Onde o nó fica no mapa (0–1000 × 0–640), o tipo e o ícone escolhidos no editor; sem isso a tela desenha o caminho sozinha.
    ...(c.mapa && Number.isFinite(c.mapa.x) && Number.isFinite(c.mapa.y) ? { mapa: { x: c.mapa.x, y: c.mapa.y, ...(c.mapa.icone ? { icone: c.mapa.icone } : {}) } } : {}),
    ...(c.tipo ? { tipo: c.tipo } : {}),
    ...(c.conexoes?.length ? { conexoes: c.conexoes } : {}),
    ...(c.requisitos?.levelMin ? { levelRecomendado: c.requisitos.levelMin } : {}),
    ...(c.requisitos?.exige?.length ? { exige: c.requisitos.exige.map((id) => ({ huntId: id, nome: faseDe(id)?.nome ?? id })) } : {}),
    ...(m.bossPrincipal ? { bossPrincipal: m.bossPrincipal.nome } : {}),
    ...(m.obrigatorios?.length ? { obrigatorios: m.obrigatorios.map((e) => ({ nome: e.nome, tipo: e.tipo })) } : {}),
    ...(descobertos.length ? { descobertos } : {}),
  };
}

/** A campanha para a tela: por dificuldade, as fases (com progresso) e os bosses — mais o conteúdo do WORLD. */
export function paraCliente(estado) {
  const nomes = nomesDeBosses();
  const vitorias = estado.encontros?.concluidos?.boss ?? {};
  return {
    aoCompletar: aoCompletar(estado),
    atos: atosDoConteudo(),
    mundo: Object.fromEntries(FASES.map((f) => [f.huntId, mundoDaFase(estado, f)]).filter(([, v]) => Object.keys(v).length)),
    bossesDerrotados: Object.entries(vitorias).map(([id, vezes]) => ({ id, nome: nomes[id] ?? id, vezes })),
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
          limpezas: p.limpezas[f.huntId] ?? 0,
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
  const completa = faseCompleta(estado, c.dificuldade, f.huntId);
  return {
    tipo: 'fase', aoCompletar: aoCompletar(estado), ato: f.ato, numero: f.indice + 1, dificuldade: c.dificuldade, nomeDaDificuldade: dif?.nome, nome: f.nome,
    limpezas: p.limpezas[f.huntId] ?? 0, completa,
    // Completa e sem próxima para seguir: fim do ato (o boss é o jogador quem chama).
    fimDoAto: completa && !proximaParaSeguir(estado, c.dificuldade, f.huntId),
  };
}
