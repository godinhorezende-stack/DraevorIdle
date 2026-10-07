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
    // O veneno é dano de Caos ao longo do tempo e o sangramento, Físico: os multiplicadores "de Caos" e "Físico" do PoE valem neles.
    multiplicadorVeneno: n('dot_multi_poison') + n('dot_multi_chaos'),
    multiplicadorSangramento: n('dot_multi_bleed') + n('dot_multi_phys'),
    duracao: n('ailment_duration'),
    duracaoVeneno: n('poison_duration'),
    // PoE (07/10): o "Dano Degenerativo aumentado" (todas) e o de cada uma; a duração de cada uma e a das Elementais; o efeito do
    // Resfriamento e da Eletrização; "causam dano X% mais rápido"; "todo o dano pode Envenenar"; o dano a mais em quem está Mutilado.
    danoAumentado: n('dot_dmg_inc'),
    danoIncendio: n('ignite_dmg_inc'),
    danoSangramento: n('bleed_dmg_inc'),
    danoVeneno: n('poison_dmg_inc'),
    duracaoIncendio: n('duracao_incendio') + n('duracao_afeccoes_elementais'),
    duracaoSangramento: n('duracao_sangramento'),
    duracaoCongelamento: n('duracao_congelamento') + n('duracao_afeccoes_elementais'),
    duracaoEletrizacao: n('duracao_eletrizacao') + n('duracao_afeccoes_elementais'),
    efeitoResfriamento: n('efeito_resfriamento'),
    efeitoEletrizacao: n('efeito_eletrizacao'),
    maisRapido: n('dot_mais_rapido'),
    qualquerDanoEnvenena: n('envenena_qualquer_dano') > 0,
    mutiladosDot: n('mutilados_dot_inc'),
    // Segredos do Sofrimento (keystone da peça): não Incendeia, Resfria, Congela nem Eletriza (o crítico inflige Causticar/Fragilizar/Exaurir).
    semElementais: n('keystone_sofrimento') > 0,
    incendioMaisRapido: n('incendio_mais_rapido'),
  };
}

/** A força (em %) da Eletrização ou do Resfriamento: 50% × (dano ÷ limiar)^0,4, entre o mínimo e o máximo; abaixo do mínimo, nada. */
export function forca(dano, limiar, { minimo, maximo }) {
  if (!(dano > 0) || !(limiar > 0)) return 0;
  const pct = 50 * Math.pow(dano / limiar, 0.4);
  return pct < minimo ? 0 : Math.min(maximo, Math.round(pct * 10) / 10);
}

/** A força com o "Efeito de Afecções de Gelo/Raio aumentado" (o teto do PoE continua valendo). */
const comEfeito = (pct, aumento = 0, teto = 100) => (pct > 0 ? Math.min(teto, Math.round(pct * (1 + (aumento ?? 0) / 100) * 10) / 10) : 0);

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
  const duracaoDe = (base, extra = 0) => Math.round(base * (1 + ((a.duracao ?? 0) + extra) / 100));
  const mutilado = (bicho.estados?.mutilado?.ate ?? 0) > agora ? a.mutiladosDot ?? 0 : 0;
  // `aumentado`: o "Dano Degenerativo aumentado" daquela afecção. "X% mais rápido": a mesma soma em menos tempo.
  const dot = (tipo, porSegundo, duracaoMs, base, multiplicador, aumentado = 0) => {
    if (!(base > 0)) return;
    const total = base * porSegundo * (duracaoMs / 1000) * (1 + multiplicador / 100) * (1 + ((a.danoAumentado ?? 0) + aumentado + mutilado) / 100);
    const rapido = Math.max(100, Math.round(duracaoMs / (1 + ((a.maisRapido ?? 0) + (tipo === 'queimadura' ? a.incendioMaisRapido ?? 0 : 0)) / 100)));
    const estado = Dot.aplicar(bicho, { tipo, total, duracaoMs: rapido, origem: { fonte: 'poe' } }, agora);
    if (estado) postos.push(estado);
  };
  const fogo = a.semElementais ? 0 : dano('fire');
  const fisico = dano('physical');
  const gelo = a.semElementais ? 0 : dano('ice');
  const raio = a.semElementais ? 0 : dano('energy');
  const caos = dano('chaos');
  // Incêndio: pela chance, ou crítico com dano de Fogo.
  if (fogo > 0 && (crit || sorte(chance('incendio')))) dot('queimadura', BASE.incendio.porSegundo, duracaoDe(BASE.incendio.duracaoMs, a.duracaoIncendio ?? 0), fogo, a.multiplicador + a.multiplicadorFogo, a.danoIncendio ?? 0);
  if (fisico > 0 && sorte(chance('sangramento'))) dot('sangramento', BASE.sangramento.porSegundo, duracaoDe(BASE.sangramento.duracaoMs, a.duracaoSangramento ?? 0), fisico, a.multiplicador + (a.multiplicadorSangramento ?? 0), a.danoSangramento ?? 0);
  // Veneno: do dano Físico e de Caos (ou de TODO o dano, com "Todo o Dano … pode Envenenar").
  const baseDoVeneno = a.qualquerDanoEnvenena ? fisico + caos + fogo + gelo + raio : fisico + caos;
  if (baseDoVeneno > 0 && sorte(chance('veneno'))) dot('venenoPoe', BASE.veneno.porSegundo, duracaoDe(BASE.veneno.duracaoMs, a.duracaoVeneno), baseDoVeneno, a.multiplicador + a.multiplicadorVeneno, a.danoVeneno ?? 0);
  const limiar = bicho.maxHp ?? bicho.hp;
  if (gelo > 0) {
    // Congelamento (chance ou crítico) e Resfriamento (sempre), pelas regras de controle do Draevor.
    const congela = crit || sorte(chance('congelamento'));
    const lento = comEfeito(forca(gelo, limiar, BASE.resfriamento), a.efeitoResfriamento, BASE.resfriamento.maximo);
    postos.push(...Estados.aplicar(bicho, { ...(congela ? { congelarChance: 100, congelarDuracaoPct: a.duracaoCongelamento ?? 0 } : {}), ...(lento ? { lentidaoPct: lento } : {}) }, gelo, agora, rng, salaDeBoss));
  }
  if (raio > 0 && (crit || sorte(chance('eletrizacao')))) {
    const pct = comEfeito(forca(raio, limiar, BASE.eletrizacao), a.efeitoEletrizacao, BASE.eletrizacao.maximo);
    const atual = bicho.estados?.chocado;
    // Vale a mais forte; não encurta a que já corre.
    if (pct > 0 && !(atual && atual.ate > agora && atual.pct >= pct)) {
      (bicho.estados ??= {}).chocado = { ate: agora + duracaoDe(BASE.eletrizacao.duracaoMs, a.duracaoEletrizacao ?? 0), pct };
      postos.push('eletrizado');
    }
  }
  return [...new Set(postos)];
}
