// Os ESTADOS que as supports põem nos bichos atingidos (etapa 4 do plano, 30/09):
// QUEIMANDO (Ignite: dano ao longo do tempo), CONGELADO (Freeze: não anda nem ataca),
// LENTO (Slow: anda e ataca mais devagar), ATORDOADO (Stun: não anda nem ataca).
// Genérico e por dados: as chances e os % vêm das supports ligadas
// (`Gemas.efeitoNaSkill`), as durações de `config.estados`. Cada estado mora no
// bicho (`m.estados`), com o instante em que acaba.
import { CONFIG } from './gemas.mjs';
import * as R from '../regras.mjs';

const E = () => CONFIG.estados ?? {};
const ativo = (s, agora) => !!s && s.ate > agora;

/**
 * Depois de um acerto (`dano` do `tipo`) com o efeito da gema: sorteia e põe os estados.
 * Queimar guarda o total que falta (o % do acerto) e sai em pulsos (`tique`).
 * Devolve os nomes dos estados postos (para o evento na tela).
 */
export function aplicar(bicho, efeito, dano, agora, rng = Math.random) {
  if (!efeito || !(dano > 0) || bicho.hp <= 0) return [];
  const postos = [];
  const cfg = E();
  const estados = (bicho.estados ??= {});
  if (efeito.igniteChance > 0 && rng() * 100 < efeito.igniteChance) {
    const dur = cfg.queimando?.duracao ?? 4000;
    const total = (dano * (efeito.ignitePct ?? 0)) / 100;
    // Queimar de novo soma o que falta (não reinicia do zero).
    const resto = ativo(estados.queimando, agora) ? estados.queimando.falta : 0;
    estados.queimando = { ate: agora + dur, falta: resto + total, porPulso: (resto + total) / Math.max(1, Math.round(dur / (cfg.queimando?.pulso ?? 1000))), proximo: agora + (cfg.queimando?.pulso ?? 1000) };
    postos.push('queimando');
  }
  if (efeito.congelarChance > 0 && rng() * 100 < efeito.congelarChance) {
    estados.congelado = { ate: agora + (cfg.congelado?.duracao ?? 2000) };
    postos.push('congelado');
  }
  if (efeito.lentidaoPct > 0) {
    estados.lento = { ate: agora + (cfg.lento?.duracao ?? 4000), pct: Math.min(cfg.lento?.maximo ?? 60, efeito.lentidaoPct) };
    postos.push('lento');
  }
  if (efeito.atordoarChance > 0 && rng() * 100 < efeito.atordoarChance) {
    estados.atordoado = { ate: agora + (cfg.atordoado?.duracao ?? 1500) };
    postos.push('atordoado');
  }
  return postos;
}

/** O bicho pode andar/atacar agora? (congelado e atordoado não). */
export const podeAgir = (m, agora) => !ativo(m?.estados?.congelado, agora) && !ativo(m?.estados?.atordoado, agora);

/** Quanto o bicho LENTO demora a mais (1 = normal): passo e intervalo do golpe × isto. */
export function fatorDeLentidao(m, agora) {
  const s = m?.estados?.lento;
  return ativo(s, agora) ? 1 / (1 - s.pct / 100) : 1;
}

/**
 * Um tique da caçada: os pulsos de QUEIMANDO. O dano sai direto na vida (a
 * resistência já passou no acerto que acendeu); quem cair é recolhido depois por
 * `processarMortes`. Devolve o dano total do tique.
 */
export function tique(hunt, eventos, agora) {
  let total = 0;
  const pulso = E().queimando?.pulso ?? 1000;
  for (const m of hunt?.monstros ?? []) {
    // A REGENERAÇÃO do modificador (`regen`: % da vida por segundo — ver `mobs/raridade.mjs`).
    if (m.regen && m.hp > 0 && m.hp < m.maxHp && R.jaPode(agora, m.proximaRegen)) {
      m.hp = Math.min(m.maxHp, m.hp + Math.max(1, Math.round((m.maxHp * m.regen) / 100)));
      m.proximaRegen = agora + 1000;
    }
    const q = m.estados?.queimando;
    if (!q || m.hp <= 0) continue;
    while (q.falta > 0 && R.jaPode(agora, q.proximo) && q.proximo <= q.ate + pulso) {
      const v = Math.max(1, Math.round(Math.min(q.falta, q.porPulso)));
      m.hp -= v;
      q.falta -= v;
      q.proximo += pulso;
      total += v;
      eventos.push({ t: 'dmg', uid: m.uid, x: m.x, y: m.y, v, foe: true, alvo: m.name, color: '#ff9000', queimando: true });
      if (m.hp <= 0) break;
    }
    if (q.falta <= 0 || q.proximo > q.ate + pulso) delete m.estados.queimando;
  }
  return total;
}
