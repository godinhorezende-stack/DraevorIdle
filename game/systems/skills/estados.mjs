// Os ESTADOS que as supports põem nos bichos atingidos (etapa 4 do plano, 30/09):
// QUEIMANDO (Ignite: dano ao longo do tempo), CONGELADO (Freeze: não anda nem ataca),
// LENTO (Slow: anda e ataca mais devagar), ATORDOADO (Stun: não anda nem ataca).
// Genérico e por dados: as chances e os % vêm das supports ligadas
// (`Gemas.efeitoNaSkill`), as durações e as regras de controle de `config.estados`. Cada estado
// mora no bicho (`m.estados`), com o instante em que acaba.
//
// REGRAS (auditoria de 02/10, decididas pelo dono):
//  - QUEIMANDO: UMA por bicho, vale a de MAIOR dano (reaplicar mais forte substitui; mais fraca é ignorada). O relógio dos pulsos NÃO
//    reinicia ao reaplicar — antes, com acertos a menos de 1 s um do outro, o pulso nunca chegava e a queimação não dava dano nenhum.
//  - CONGELAR e ATORDOAR: não renovam enquanto ativos e, quando acabam, o bicho fica imune aos dois por `controle.imunidade` (3 s):
//    não dá para prender o bicho. Boss é imune; elite leva metade da duração.
//  - LENTIDÃO: vale a maior (não a última); boss leva metade do %; elite metade da duração.
import { CONFIG } from './gemas.mjs';
import * as R from '../regras.mjs';

const E = () => CONFIG.estados ?? {};
const ativo = (s, agora) => !!s && s.ate > agora;

/** Boss único, boss de sala ou mob de raridade chefe. `salaDeBoss`: a caçada é de boss (todos os bichos dela). */
export const ehChefe = (m, salaDeBoss = false) => !!(m?.boss || m?.chefe || salaDeBoss);
const ehElite = (m) => !!m?.elite;

/** A duração (ms) de um estado de controle neste bicho: a da config × a regra de elite. */
const duracaoNo = (m, base) => Math.round(base * (ehElite(m) ? E().elite?.duracao ?? 1 : 1));

/**
 * Depois de um acerto (`dano` do `tipo`) com o efeito da gema: sorteia e põe os estados.
 * Queimar guarda o total que falta (o % do acerto) e sai em pulsos (`tique`).
 * Devolve os nomes dos estados postos (para o evento na tela). `salaDeBoss`: a caçada é uma sala de boss.
 */
export function aplicar(bicho, efeito, dano, agora, rng = Math.random, salaDeBoss = false) {
  if (!efeito || !(dano > 0) || bicho.hp <= 0) return [];
  const postos = [];
  const cfg = E();
  const estados = (bicho.estados ??= {});
  const chefe = ehChefe(bicho, salaDeBoss);

  if (efeito.igniteChance > 0 && rng() * 100 < efeito.igniteChance) {
    const dur = cfg.queimando?.duracao ?? 4000;
    const pulso = cfg.queimando?.pulso ?? 1000;
    const total = (dano * (efeito.ignitePct ?? 0)) / 100;
    const q = estados.queimando;
    const queimando = ativo(q, agora) && q.falta > 0;
    // Uma queimação por bicho: a nova só entra se for MAIOR do que o que ainda falta pagar.
    if (total > 0 && (!queimando || total > q.falta)) {
      estados.queimando = {
        ate: agora + dur,
        falta: total,
        porPulso: total / Math.max(1, Math.round(dur / pulso)),
        // O relógio dos pulsos continua o que já corria: reaplicar não adia o próximo pulso.
        proximo: queimando ? q.proximo : agora + pulso,
      };
      postos.push('queimando');
    }
  }

  // Congelar e atordoar dividem a MESMA imunidade (um depois do outro seria controle quase contínuo).
  const preso = ativo(estados.congelado, agora) || ativo(estados.atordoado, agora) || agora < (estados.controleImuneAte ?? 0);
  const podeControlar = !preso && !(chefe && (cfg.chefe?.controle ?? 1) <= 0);
  const prender = (nome, base) => {
    const dur = duracaoNo(bicho, base);
    estados[nome] = { ate: agora + dur };
    estados.controleImuneAte = agora + dur + (cfg.controle?.imunidade ?? 0);
    postos.push(nome);
  };
  if (podeControlar && efeito.congelarChance > 0 && rng() * 100 < efeito.congelarChance) prender('congelado', cfg.congelado?.duracao ?? 1500);
  else if (podeControlar && efeito.atordoarChance > 0 && rng() * 100 < efeito.atordoarChance) prender('atordoado', cfg.atordoado?.duracao ?? 1500);

  if (efeito.lentidaoPct > 0) {
    const maximo = cfg.lento?.maximo ?? 40;
    const pct = Math.min(maximo, efeito.lentidaoPct) * (chefe ? cfg.chefe?.lento ?? 1 : 1);
    if (pct > 0) {
      const ate = agora + duracaoNo(bicho, cfg.lento?.duracao ?? 3000);
      const l = estados.lento;
      // Vale a MAIOR lentidão (não a última) e nunca encurta o que já corre.
      estados.lento = ativo(l, agora) ? { ate: Math.max(l.ate, ate), pct: Math.max(l.pct, pct) } : { ate, pct };
      postos.push('lento');
    }
  }
  return postos;
}

/** Os estados ATIVOS do bicho agora (o cliente mostra um ícone de cada): `['congelado', 'lento', 'queimando']`. */
export function ativosDe(m, agora) {
  const e = m?.estados;
  if (!e) return [];
  return ['congelado', 'atordoado', 'lento', 'queimando'].filter((n) => ativo(e[n], agora));
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
