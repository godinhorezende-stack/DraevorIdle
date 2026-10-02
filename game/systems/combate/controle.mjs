// O CONTROLE no JOGADOR (dono, 02/10): bosses e elites podem congelar, atordoar ou fazer lentidão no jogador, e a RESISTÊNCIA A CONTROLE
// dele encurta o efeito. Config em `gamedata/combate/controle.json`. O estado mora na caçada (`hunt.controle`, relógio da caçada) e é JSON puro.
//
//   - congelado/atordoado: o jogador não anda, não ataca nem conjura (`podeAgir`); depois que acabam, `imunidadeMs` de imunidade aos dois;
//   - lento: anda e ataca mais devagar (`fatorDeLentidao`, o mesmo cálculo dos bichos: 1 / (1 − %));
//   - resistência a controle: encurta a DURAÇÃO (100% = imune); não muda a chance de o mob acertar o efeito.
import { readFileSync } from 'node:fs';
import { ehChefe } from '../skills/estados.mjs';
import { limitar } from './limites.mjs';

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
export function tentar(hunt, bicho, ficha, agora = hunt?.clock ?? 0, rng = Math.random) {
  const classe = classeDoMob(bicho, !!hunt?.isBoss);
  const cfg = classe ? CONFIG.mobs[classe] : null;
  if (!cfg || !(rng() * 100 < cfg.chance)) return null;
  const efeito = sortearEfeito(cfg.efeitos, rng);
  const c = (hunt.controle ??= {});
  const preso = ativo(c.congelado, agora) || ativo(c.atordoado, agora) || agora < (c.imuneAte ?? 0);
  if (efeito !== 'lento' && preso) return null;
  const resistencia = limitar(ficha?.resistenciaAControle ?? 0, CONFIG.jogador.resistenciaMaxima);
  const duracao = Math.round(CONFIG.jogador.duracaoMs[efeito] * (1 - resistencia / 100));
  if (!(duracao > 0)) return null;
  if (efeito === 'lento') {
    const pct = Math.min(CONFIG.jogador.lentidaoMaxima, cfg.lentidaoPct ?? 30);
    const atual = c.lento;
    // Vale a MAIOR lentidão e nunca encurta o que já corre.
    c.lento = ativo(atual, agora) ? { ate: Math.max(atual.ate, agora + duracao), pct: Math.max(atual.pct, pct) } : { ate: agora + duracao, pct };
  } else {
    c[efeito] = { ate: agora + duracao };
    c.imuneAte = agora + duracao + CONFIG.jogador.imunidadeMs;
  }
  return efeito;
}
