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
/** A resistência do BICHO a controle (`m.resistControle`, em %, do bestiário/modificadores): encurta a duração; 100% = imune. */
const resistenciaDoBichoAControle = (m) => Math.max(0, Math.min(100, Number(m?.resistControle) || 0));
const duracaoNo = (m, base) => Math.round(base * (ehElite(m) ? E().elite?.duracao ?? 1 : 1) * (1 - resistenciaDoBichoAControle(m) / 100));

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
  const podeControlar = !preso && !(chefe && (cfg.chefe?.controle ?? 1) <= 0) && resistenciaDoBichoAControle(bicho) < 100;
  const prender = (nome, base) => {
    const dur = duracaoNo(bicho, base);
    estados[nome] = { ate: agora + dur };
    estados.controleImuneAte = agora + dur + (cfg.controle?.imunidade ?? 0);
    postos.push(nome);
  };
  // (`congelarDuracaoPct`: a "Duração do Congelamento em Inimigos aumentada" do PoE.)
  if (podeControlar && efeito.congelarChance > 0 && rng() * 100 < efeito.congelarChance) prender('congelado', (cfg.congelado?.duracao ?? 1500) * (1 + (efeito.congelarDuracaoPct ?? 0) / 100));
  else if (podeControlar && efeito.atordoarChance > 0 && rng() * 100 < efeito.atordoarChance) prender('atordoado', cfg.atordoado?.duracao ?? 1500);

  if (efeito.lentidaoPct > 0) {
    const maximo = cfg.lento?.maximo ?? 40;
    const pct = Math.min(maximo, efeito.lentidaoPct) * (chefe ? cfg.chefe?.lento ?? 1 : 1);
    if (pct > 0) {
      // (`lentidaoDuracaoPct`: a "Duração do Resfriamento em Inimigos aumentada" do PoE.)
      const ate = agora + duracaoNo(bicho, (cfg.lento?.duracao ?? 3000) * (1 + (efeito.lentidaoDuracaoPct ?? 0) / 100));
      const l = estados.lento;
      // Vale a MAIOR lentidão (não a última) e nunca encurta o que já corre.
      estados.lento = ativo(l, agora) ? { ate: Math.max(l.ate, ate), pct: Math.max(l.pct, pct) } : { ate, pct };
      postos.push('lento');
    }
  }
  return postos;
}

/**
 * O ATORDOAMENTO do PoE num acerto do jogador (`itens-poe/mods-poe.mjs → atordoar`): as mesmas regras de controle do Draevor (chefe,
 * imunidade depois, resistência do bicho). `duracaoMs` já vem pronta. Devolve true se atordoou.
 */
export function atordoar(bicho, duracaoMs, agora, salaDeBoss = false) {
  if (!bicho || bicho.hp <= 0 || !(duracaoMs > 0)) return false;
  const cfg = E();
  const estados = (bicho.estados ??= {});
  const preso = ativo(estados.congelado, agora) || ativo(estados.atordoado, agora) || agora < (estados.controleImuneAte ?? 0);
  if (preso || (ehChefe(bicho, salaDeBoss) && (cfg.chefe?.controle ?? 1) <= 0) || resistenciaDoBichoAControle(bicho) >= 100) return false;
  const dur = duracaoNo(bicho, duracaoMs);
  estados.atordoado = { ate: agora + dur };
  estados.controleImuneAte = agora + dur + (cfg.controle?.imunidade ?? 0);
  return true;
}

/** Os estados ATIVOS do bicho agora (o cliente mostra um ícone de cada): `['congelado', 'lento', 'queimando']`. */
export function ativosDe(m, agora) {
  const e = m?.estados ?? {};
  const lista = [...['congelado', 'atordoado', 'lento'].filter((n) => ativo(e[n], agora)), ...Dot.ativosDe(m, agora)];
  // A Eletrização do PoE (`itens-poe/afeccoes.mjs`: o bicho recebe mais dano) usa o ícone de eletrizado.
  if (ativo(e.chocado, agora) && !lista.includes('eletrizado')) lista.push('eletrizado');
  return lista;
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
    // (A próxima regeneração gravada no relógio de parede — antes de 09/10 este tique recebia ele — volta para o relógio da caçada.)
    if (m.proximaRegen > agora + 60_000) m.proximaRegen = agora;
    if (m.regen && m.hp > 0 && m.hp < m.maxHp && R.jaPode(agora, m.proximaRegen)) {
      // (PoE: "Inimigos Desacelerados por você têm Regeneração de Vida reduzida em X%".)
      const desacelerado = ativo(m.estados?.desacelerado, agora) ? Math.max(0, 1 - (m.estados.desacelerado.regenMenosPct ?? 0) / 100) : 1;
      m.hp = Math.min(m.maxHp, m.hp + Math.max(desacelerado > 0 ? 1 : 0, Math.round((m.maxHp * m.regen * desacelerado) / 100)));
      m.proximaRegen = agora + 1000;
    }
  }
  // Os pulsos de dano ao longo do tempo (queimadura, veneno, sangramento...).
  total += Dot.tique(hunt, eventos, agora);
  return total;
}
