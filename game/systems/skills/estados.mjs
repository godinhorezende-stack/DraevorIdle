// Os ESTADOS que as supports põem nos bichos atingidos (etapa 4 do plano, 30/09):
// QUEIMANDO / ENVENENADO / SANGRANDO (Ignite, Poison, Bleed: dano ao longo do tempo — o motor deles é `combate/dot.mjs`), CONGELADO (Freeze: não anda nem ataca),
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
import * as Dot from '../combate/dot.mjs';

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
export function aplicar(bicho, efeito, dano, agora, rng = Math.random, salaDeBoss = false, baseDoDot = dano) {
  if (!efeito || !(dano > 0) || bicho.hp <= 0) return [];
  const postos = [];
  const cfg = E();
  const estados = (bicho.estados ??= {});
  const chefe = ehChefe(bicho, salaDeBoss);

  // Os efeitos de DANO AO LONGO DO TEMPO (`combate/dot.mjs`): o % do acerto (antes da resistência e do crítico — o pulso passa pela
  // resistência do bicho, e o dano contínuo não rola crítico) que o efeito paga, na duração do tipo.
  const dot = (chance, pct, tipo) => {
    if (!(chance > 0) || !(rng() * 100 < chance)) return;
    const estado = Dot.aplicar(bicho, { tipo, total: (baseDoDot * (pct ?? 0)) / 100, origem: { fonte: 'suporte' } }, agora);
    if (estado) postos.push(estado);
  };
  dot(efeito.igniteChance, efeito.ignitePct, 'queimadura');
  dot(efeito.venenoChance, efeito.venenoPct, 'veneno');
  dot(efeito.sangramentoChance, efeito.sangramentoPct, 'sangramento');

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
  const e = m?.estados ?? {};
  return [...['congelado', 'atordoado', 'lento'].filter((n) => ativo(e[n], agora)), ...Dot.ativosDe(m, agora)];
}

/** O bicho pode andar/atacar agora? (congelado e atordoado não). */
export const podeAgir = (m, agora) => !ativo(m?.estados?.congelado, agora) && !ativo(m?.estados?.atordoado, agora);

/** Quanto o bicho LENTO demora a mais (1 = normal): passo e intervalo do golpe × isto. */
export function fatorDeLentidao(m, agora) {
  const s = m?.estados?.lento;
  return ativo(s, agora) ? 1 / (1 - s.pct / 100) : 1;
}

/**
 * Um tique da caçada: a regeneração dos modificadores e os pulsos de dano ao longo do tempo
 * (`combate/dot.mjs`). Quem cair é recolhido depois por `processarMortes`. Devolve o dano total dos pulsos.
 */
export function tique(hunt, eventos, agora) {
  let total = 0;
  for (const m of hunt?.monstros ?? []) {
    // A REGENERAÇÃO do modificador (`regen`: % da vida por segundo — ver `mobs/raridade.mjs`).
    if (m.regen && m.hp > 0 && m.hp < m.maxHp && R.jaPode(agora, m.proximaRegen)) {
      m.hp = Math.min(m.maxHp, m.hp + Math.max(1, Math.round((m.maxHp * m.regen) / 100)));
      m.proximaRegen = agora + 1000;
    }
  }
  // Os pulsos de dano ao longo do tempo (queimadura, veneno, sangramento...).
  total += Dot.tique(hunt, eventos, agora);
  return total;
}
