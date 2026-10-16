// O CONTROLE no JOGADOR (dono, 02/10): bosses e elites podem congelar, atordoar ou fazer lentidão no jogador, e a RESISTÊNCIA A CONTROLE
// dele encurta o efeito. Config em `gamedata/combate/controle.json`. O estado mora na caçada (`hunt.controle`, relógio da caçada) e é JSON puro.
//
//   - congelado/atordoado: o jogador não anda, não ataca nem conjura (`podeAgir`); depois que acabam, `imunidadeMs` de imunidade aos dois;
//   - lento: anda e ataca mais devagar (`fatorDeLentidao`, o mesmo cálculo dos bichos: 1 / (1 − %));
//   - resistência a controle: encurta a DURAÇÃO (100% = imune); não muda a chance de o mob acertar o efeito.
import { readFileSync } from 'node:fs';
import { ehChefe } from '../skills/estados.mjs';
import { limitar } from './limites.mjs';
import * as ModsPoe from '../itens-poe/condicoes-poe.mjs';

export const CONFIG = JSON.parse(readFileSync(new URL('../../gamedata/combate/controle.json', import.meta.url), 'utf8'));

const ativo = (s, agora) => !!s && s.ate > agora;

/** O jogador pode andar, atacar e conjurar agora? (congelado e atordoado: não.) */
export function podeAgir(hunt, agora = hunt?.clock ?? 0) {
  const c = hunt?.controle;
  return !c || (!ativo(c.congelado, agora) && !ativo(c.atordoado, agora));
}

/** Quanto o jogador LENTO demora a mais (1 = normal): o passo e o intervalo do golpe × isto. */
export function fatorDeLentidao(hunt, agora = hunt?.clock ?? 0) {
  const s = hunt?.controle?.lento;
  return ativo(s, agora) ? 1 / (1 - s.pct / 100) : 1;
}

/** Os efeitos de controle ATIVOS no jogador agora (`['congelado', 'lento']`). */
export function ativosNoJogador(hunt, agora = hunt?.clock ?? 0) {
  const c = hunt?.controle;
  return c ? ['congelado', 'atordoado', 'lento'].filter((n) => ativo(c[n], agora)) : [];
}

/**
 * (PoE, 11/10) A RECUPERAÇÃO DE BLOQUEIO: bloquear um golpe trava a próxima ação por 0,35 s ÷ (1 + "Recuperação de Bloqueio" + "Recuperação de
 * Atordoamentos e Bloqueios"). A trava entra na fila de ações do PoE (o grupo `grupo:poe` de `acoes.mjs` — o golpe básico e as gemas esperam).
 * Devolve os ms travados (0: nada). (lote 35 — P004, a decisão do dono "Como no PoE: todo bloqueio": em TODO bloqueio, de qualquer monstro;
 * antes só no golpe de Elite/Chefe.)
 */
export const BLOQUEIO_TRAVA_MS = 350;
export function travarNoBloqueio(hunt, bicho, ficha, agora = hunt?.clock ?? 0) {
  if (!hunt || !bicho || !ficha?.afPoe) return 0;
  const rec = (Number(ficha.afPoe.block_recovery) || 0) + (Number(ficha.afPoe.stun_recovery) || 0);
  const ms = Math.round(BLOQUEIO_TRAVA_MS / Math.max(0.1, 1 + rec / 100));
  const cds = (hunt.cooldowns ??= {});
  const atual = cds['grupo:poe'];
  if (!(atual?.ate > agora + ms)) cds['grupo:poe'] = { ate: agora + ms, total: ms, bloqueio: true };
  return ms;
}

/** A classe do mob para o controle: `'boss'`, `'elite'` ou null (mob comum não controla). */
export function classeDoMob(bicho, salaDeBoss = false) {
  if (ehChefe(bicho, salaDeBoss)) return 'boss';
  return bicho?.elite ? 'elite' : null;
}

function sortearEfeito(pesos, rng) {
  const entradas = Object.entries(pesos);
  let sorte = rng() * entradas.reduce((n, [, p]) => n + p, 0);
  for (const [nome, p] of entradas) if ((sorte -= p) < 0) return nome;
  return entradas[0]?.[0] ?? null;
}

/**
 * Um golpe do `bicho` acertou o jogador: sorteia se ele põe controle e qual. `ficha`: a do jogador (`resistenciaAControle`, em %).
 * Devolve o nome do efeito posto ou null (sem sorte, mob comum, jogador imune, já preso ou resistência de 100%).
 */
export function tentar(hunt, bicho, ficha, agora = hunt?.clock ?? 0, rng = Math.random, { semAfeccaoElemental = false, soFisico = false, estado = null, semAtordoamento = false } = {}) {
  const classe = classeDoMob(bicho, !!hunt?.isBoss);
  const cfg = classe ? CONFIG.mobs[classe] : null;
  if (!cfg) return null;
  const sorte = rng() * 100;
  const efeito = sortearEfeito(cfg.efeitos, rng);
  // (PoE: a magia suprimida com "Dano Mágico Suprimido não pode infligir Afecções Elementais em você" não Congela nem Resfria — o
  // Atordoamento não é afecção.)
  if (semAfeccaoElemental && (efeito === 'congelado' || efeito === 'lento')) return null;
  // ("Não pode ser Atordoado por Dano Mágico Suprimido".)
  if (semAtordoamento && efeito === 'atordoado') return null;
  // (PoE: "Inimigos Amaldiçoados não podem infligir Afecções Elementais em Você" — o Congelamento e o Resfriamento do monstro amaldiçoado.)
  if ((efeito === 'congelado' || efeito === 'lento') && Number(ficha?.afPoe?.amaldicoados_sem_afeccao_elemental) > 0 && ModsPoe.amaldicoadoPorVoce(bicho, agora)) return null;
  // PoE (`itens-poe/mods-poe.mjs → controleNoJogador`): evitar e imunidade, a duração em você, a Recuperação de Atordoamentos, o efeito do
  // Resfriamento em você e o "Ponto de Atordoamento reduzido" (mais chance de ser atordoado). Sem o PoE, tudo 1.
  // (+ ciclo 7: "Não pode ser Atordoado por Acertos que causem apenas Dano Físico" — `soFisico`: o golpe só tem Físico; o Escudo de Energia
  // no Ponto de Atordoamento — `estado`.)
  const poe = ModsPoe.controleNoJogador(ficha, efeito, rng, hunt, { soFisico, estado });
  if (!(sorte < cfg.chance * poe.chanceFator) || poe.evitou) return null;
  const c = (hunt.controle ??= {});
  const preso = ativo(c.congelado, agora) || ativo(c.atordoado, agora) || agora < (c.imuneAte ?? 0);
  if (efeito !== 'lento' && preso) return null;
  const resistencia = limitar(ficha?.resistenciaAControle ?? 0, CONFIG.jogador.resistenciaMaxima);
  const duracao = Math.round(CONFIG.jogador.duracaoMs[efeito] * (1 - resistencia / 100) * poe.duracaoFator);
  if (!(duracao > 0)) return null;
  if (efeito === 'lento') {
    // (+ ciclo 7, lote F: "Sua Velocidade de Ação é de ao menos X% do valor base" — a lentidão vai no máximo até 100 − X.)
    const minima = Number(ficha?.afPoe?.velocidade_acao_minima) || 0;
    const pct = Math.min(CONFIG.jogador.lentidaoMaxima, minima > 0 ? 100 - minima : 100, (cfg.lentidaoPct ?? 30) * poe.pctFator);
    if (!(pct > 0)) return null;
    const atual = c.lento;
    // Vale a MAIOR lentidão e nunca encurta o que já corre.
    c.lento = ativo(atual, agora) ? { ate: Math.max(atual.ate, agora + duracao), pct: Math.max(atual.pct, pct) } : { ate: agora + duracao, pct };
  } else {
    // (`desde`/`ms`: as reações do PoE ao ser Atordoado leem quando e quanto — `mods-poe.aoSerAcertado`)
    c[efeito] = { ate: agora + duracao, desde: agora, ms: duracao };
    c.imuneAte = agora + duracao + CONFIG.jogador.imunidadeMs;
  }
  // (PoE: "Você não pode ser Congelado / Resfriado durante N segundos depois de ter sido" — `ModsPoe.imunidadeApos`.)
  const nome = { congelado: 'congelamento', lento: 'resfriamento' }[efeito];
  if (nome) ModsPoe.imunidadeApos(hunt, ficha, nome, agora);
  return efeito;
}

/**
 * (PoE, 12/10) O CONGELAMENTO de um acerto do monstro que não depende da classe dele — a afecção inerente do Golpe Crítico (`mobs/mecanicas.
 * aoAcertarJogador`): `ms` já vem da conta do PoE (o dano de Gelo × a vida máxima — `monstros-no-jogador.msDoCongelamento`). Os mesmos
 * evitar/imunidade/duração do PoE de `tentar`, a resistência a controle e a imunidade depois de congelado. Devolve se congelou.
 */
export function congelar(hunt, ficha, ms, agora = hunt?.clock ?? 0, rng = Math.random) {
  if (!hunt || !(ms > 0)) return false;
  const poe = ModsPoe.controleNoJogador(ficha, 'congelado', rng, hunt, {});
  if (poe.evitou) return false;
  const c = (hunt.controle ??= {});
  if (ativo(c.congelado, agora) || ativo(c.atordoado, agora) || agora < (c.imuneAte ?? 0)) return false;
  const resistencia = limitar(ficha?.resistenciaAControle ?? 0, CONFIG.jogador.resistenciaMaxima);
  const duracao = Math.round(ms * (1 - resistencia / 100) * poe.duracaoFator);
  if (!(duracao > 0)) return false;
  c.congelado = { ate: agora + duracao, desde: agora, ms: duracao };
  c.imuneAte = agora + duracao + CONFIG.jogador.imunidadeMs;
  ModsPoe.imunidadeApos(hunt, ficha, 'congelamento', agora);
  return true;
}
