// As AFECÇÕES do PoE nos acertos do jogador (sistema de itens do PoE — só com ITENS_POE=1; em produção nada disto roda).
//
// Usa o motor que o Draevor já tem (`combate/dot.mjs` para o dano ao longo do tempo, `skills/estados.mjs` para congelar e desacelerar)
// com os NÚMEROS BASE do PoE:
//   Incêndio     — 90% do dano de Fogo do acerto por segundo, 4 s (vale o mais forte).        Chance: chance_ignite (+ _ataque).
//   Sangramento  — 70% do dano Físico do acerto por segundo, 5 s.                             Chance: chance_bleed (+ _ataque).
//   Veneno       — 30% do dano Físico + Caos do acerto por segundo, 2 s, acumula (de Caos).    Chance: chance_poison (+ _ataque).
//   Congelamento — pela chance, com as regras de controle do Draevor (chefe imune, imunidade depois).  Chance: chance_freeze.
//   Eletrização  — o alvo recebe de 5% a 50% mais dano por 2 s.                               Chance: chance_shock.
//   Resfriamento — todo acerto com dano de Gelo desacelera de 5% a 30% (sem chance, como no PoE).
//   A força da Eletrização e do Resfriamento é a fórmula do PoE: 50% × (dano ÷ limiar)^0,4, e o limiar é a vida máxima do alvo.
//   Golpe CRÍTICO incendeia, congela e eletriza de forma inerente (como no PoE).
// O dano das afecções escala com o multiplicador de dano degenerativo (dot_multi, + o de Fogo no incêndio e o do Veneno no veneno) e com
// a duração (ailment_duration, + poison_duration): mais duração = mais dano total, o mesmo por segundo.
import { ligado } from './catalogo.mjs';
import * as Dot from '../combate/dot.mjs';
import * as Estados from '../skills/estados.mjs';

export const BASE = {
  incendio: { porSegundo: 0.9, duracaoMs: 4000 },
  sangramento: { porSegundo: 0.7, duracaoMs: 5000 },
  veneno: { porSegundo: 0.3, duracaoMs: 2000 },
  eletrizacao: { duracaoMs: 2000, minimo: 5, maximo: 50 },
  resfriamento: { minimo: 5, maximo: 30 },
};

/** O que as peças/árvore dão de afecção (da soma de atributos `af`), no formato que `aoAcertar` usa. */
export function daSoma(af = {}) {
  const n = (k) => Number(af[k]) || 0;
  return {
    chance: { incendio: n('chance_ignite'), sangramento: n('chance_bleed'), veneno: n('chance_poison'), congelamento: n('chance_freeze'), eletrizacao: n('chance_shock') },
    chanceAtaque: { incendio: n('chance_ignite_ataque'), sangramento: n('chance_bleed_ataque'), veneno: n('chance_poison_ataque') },
    multiplicador: n('dot_multi'),
    multiplicadorFogo: n('dot_multi_fire'),
    multiplicadorVeneno: n('dot_multi_poison'),
    duracao: n('ailment_duration'),
    duracaoVeneno: n('poison_duration'),
  };
}

/** A força (em %) da Eletrização ou do Resfriamento: 50% × (dano ÷ limiar)^0,4, entre o mínimo e o máximo; abaixo do mínimo, nada. */
export function forca(dano, limiar, { minimo, maximo }) {
  if (!(dano > 0) || !(limiar > 0)) return 0;
  const pct = 50 * Math.pow(dano / limiar, 0.4);
  return pct < minimo ? 0 : Math.min(maximo, Math.round(pct * 10) / 10);
}

/** O alvo está eletrizado agora? O fator do dano que ele recebe (1 = normal). Vale para todo golpe do jogador (`Ficha.rolarCritico`). */
export function fatorDeEletrizacao(alvo, agora) {
  const s = alvo?.estados?.chocado;
  return s && s.ate > agora ? 1 + s.pct / 100 : 1;
}

/**
 * Depois de um acerto do jogador. `partes`: `[{ elemento, dano }]` (o dano de cada tipo no acerto, antes da resistência); `crit`: foi
 * crítico; `ataque`: é ataque (golpe da arma, habilidade de ataque) — as chances "com Ataques" só valem nele. `afeccoes`: o de `daSoma`
 * (a ficha guarda). Devolve os nomes dos estados postos (o evento na tela). Sem o sistema do PoE, não faz nada.
 */
export function aoAcertar(bicho, partes, { afeccoes, crit = false, ataque = false, agora = 0, rng = Math.random, salaDeBoss = false } = {}) {
  if (!ligado() || !bicho || bicho.hp <= 0 || bicho.dummy) return [];
  const a = afeccoes ?? daSoma();
  const dano = (el) => partes.filter((p) => p.elemento === el).reduce((s, p) => s + (Number(p.dano) || 0), 0);
  const chance = (tipo) => (a.chance[tipo] ?? 0) + (ataque ? a.chanceAtaque?.[tipo] ?? 0 : 0);
  const sorte = (pct) => pct > 0 && rng() * 100 < pct;
  const postos = [];
  const duracaoDe = (base, extra = 0) => Math.round(base * (1 + (a.duracao + extra) / 100));
  const dot = (tipo, porSegundo, duracaoMs, base, multiplicador) => {
    if (!(base > 0)) return;
    const total = base * porSegundo * (duracaoMs / 1000) * (1 + multiplicador / 100);
    const estado = Dot.aplicar(bicho, { tipo, total, duracaoMs, origem: { fonte: 'poe' } }, agora);
    if (estado) postos.push(estado);
  };
  const fogo = dano('fire');
  const fisico = dano('physical');
  const gelo = dano('ice');
  const raio = dano('energy');
  const caos = dano('chaos');
  // Incêndio: pela chance, ou crítico com dano de Fogo.
  if (fogo > 0 && (crit || sorte(chance('incendio')))) dot('queimadura', BASE.incendio.porSegundo, duracaoDe(BASE.incendio.duracaoMs), fogo, a.multiplicador + a.multiplicadorFogo);
  if (fisico > 0 && sorte(chance('sangramento'))) dot('sangramento', BASE.sangramento.porSegundo, duracaoDe(BASE.sangramento.duracaoMs), fisico, a.multiplicador);
  if (fisico + caos > 0 && sorte(chance('veneno'))) dot('venenoPoe', BASE.veneno.porSegundo, duracaoDe(BASE.veneno.duracaoMs, a.duracaoVeneno), fisico + caos, a.multiplicador + a.multiplicadorVeneno);
  const limiar = bicho.maxHp ?? bicho.hp;
  if (gelo > 0) {
    // Congelamento (chance ou crítico) e Resfriamento (sempre), pelas regras de controle do Draevor.
    const congela = crit || sorte(chance('congelamento'));
    const lento = forca(gelo, limiar, BASE.resfriamento);
    postos.push(...Estados.aplicar(bicho, { ...(congela ? { congelarChance: 100 } : {}), ...(lento ? { lentidaoPct: lento } : {}) }, gelo, agora, rng, salaDeBoss));
  }
  if (raio > 0 && (crit || sorte(chance('eletrizacao')))) {
    const pct = forca(raio, limiar, BASE.eletrizacao);
    const atual = bicho.estados?.chocado;
    // Vale a mais forte; não encurta a que já corre.
    if (pct > 0 && !(atual && atual.ate > agora && atual.pct >= pct)) {
      (bicho.estados ??= {}).chocado = { ate: agora + duracaoDe(BASE.eletrizacao.duracaoMs), pct };
      postos.push('eletrizado');
    }
  }
  return [...new Set(postos)];
}
