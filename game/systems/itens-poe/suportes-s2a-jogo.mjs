// O LOTE S2A dos SUPORTES do PoE (27/10) na CAÇADA: o que as regras de `suportes-s2a.mjs` fazem no acerto, no uso pago e no abate do uso suportado. Quem chama é
// `acoes.mjs` (uma linha em cada lugar); a regra de cada um está no começo de `suportes-s2a.mjs`.
import { ligado } from './catalogo.mjs';
import * as ModsPoe from './mods-poe.mjs';
import * as QuemFeriu from '../hunt/quem-feriu.mjs';
import * as Dot from '../combate/dot.mjs';
import { porRompimento, inspiracaoAposGastar, fonteAposGastar, fatorDoImpeto, INSPIRACAO, raroOuUnico, renovarDoDecapitar, transfusaoAposGastar, lacaioProximo } from './suportes-s2a.mjs';
import { almasDoLacaio, DEVORADOR_DE_ALMAS } from './condicoes-poe.mjs';
// (lote D2) as contas puras que `acoes.mjs` usa direto
export { impedimentoDasProps, dobroDasMinasNoAlvo, fatorDoDobroDasMinas } from './suportes-s2a.mjs';

const vezes = (a, b) => ((1 + (a ?? 0) / 100) * (1 + (b ?? 0) / 100) - 1) * 100;

/**
 * Um ACERTO do uso suportado (o que acertou de fato — `acoes`, depois das afecções): o Excomungar (corpo a corpo), o Definhar do Toque Definhador, a Chama
 * Santificada da Santificação (corpo a corpo, o seu — não o do totem), o Rompimento (o crítico que pôs Sangramento) e o Ímpeto de Combate. `postos`: os estados
 * que o acerto pôs (as afecções e os do suporte); `fatorDur`: o da Duração da Habilidade do uso. Devolve os estados postos.
 */
export function noAcertoS2A(hunt, bicho, ef, { crit = false, corpo = false, postos = [], ficha = null, fatorDur = 1, doTotem = false, agora = hunt?.clock ?? 0, eventos = [], rng = Math.random } = {}) {
  const saida = [];
  if (!ligado() || !ef || !bicho || !hunt) return saida;
  const ev = (estado) => { saida.push(estado); eventos.push({ t: 'estado', uid: bicho.uid, x: bicho.x, y: bicho.y, estado }); };
  if (bicho.hp > 0 && corpo && ef.excomungarMs > 0) {
    ModsPoe.porNoAlvo(bicho, 'excomungado', agora + Math.max(1, Math.round(ef.excomungarMs * fatorDur)), agora);
    ev('excomungado');
  }
  if (bicho.hp > 0 && ef.definharChancePct > 0 && rng() * 100 < ef.definharChancePct) {
    ModsPoe.porNoAlvoComMods(bicho, 'definhado', agora + Math.max(1, Math.round((ef.definharMs ?? 2000) * fatorDur)), agora, ficha, rng);
    ev('definhado');
  }
  if (bicho.hp > 0 && corpo && ef.chamaSantificada > 0 && !doTotem) {
    const af = ficha?.afPoe ?? {};
    if (ModsPoe.porChamaSantificada(hunt, bicho, { ...af, chama_santificada_corpo: 1, chama_santificada_efeito: (Number(af.chama_santificada_efeito) || 0) + (Number(ef.chamaEfeitoPct) || 0) }, agora)) saida.push('chamaSantificada');
  }
  if (bicho.hp > 0 && crit && ef.rompimento > 0 && postos.includes('sangrando')) {
    porRompimento(bicho, { maisPct: ef.rompimentoMaisPct ?? 0, rapidoPct: ef.rompimentoRapidoPct ?? 0 }, agora);
    ev('rompido');
  }
  // (lote D2, dono 27/10) o Decapitar: o acerto num Raro ou Único tem 20% de chance de somar até 5 s ao modificador que ele deu (sem passar dos 20 s)
  if (ef.decapitarRenovarPct > 0 && !doTotem && raroOuUnico(bicho) && hunt.poeTemporarios && rng() * 100 < ef.decapitarRenovarPct) {
    renovarDoDecapitar(hunt.poeTemporarios, { somaMs: ef.decapitarRenovarMs ?? 5000, tetoMs: Math.round((ef.decapitarS ?? 20) * 1000) }, agora);
  }
  if (ef.impetoMs > 0 && !doTotem) {
    ModsPoe.ganharBuff(hunt, 'impetoDeCombate', (ef.impetoMs * fatorDur) / 1000, agora);
    hunt.poeImpetoVelS2A = Math.max(hunt.poeImpetoVelS2A ?? 0, ef.impetoVelPct ?? 0);
  }
  return saida;
}

/**
 * O USO PAGO por você (não o do totem, nem a plantada que ativa): `vida` e `mana` gastas no custo. Devolve o efeito do uso com o que as cargas dão a ele:
 *  - o Traumatismo (o suporte): "X a Y de Dano de Ataque Físico Adicional por Traumatismo" (o adicionado do suporte, × a eficácia) e a "Duração do Atordoamento
 *    aumentada em X% por Traumatismo", pelos Traumatismos de agora (`traumas`);
 *  - a Inspiração: as cargas de ANTES deste gasto valem neste uso (o crítico aumentado — como as outras linhas de "Chance de Crítico aumentada" dos suportes, o
 *    `critChance` em ÷ 20 — e o "mais Dano Elemental"); depois, o gasto soma (`inspiracaoAposGastar`);
 *  - a Fonte de Vida: a Vida gasta soma; no limite, o buff (× a Duração);
 *  - a Flecha Forjada com Mana: o "mais" pelo custo de Mana deste uso (`custoDeMana`).
 */
export function doUsoS2A(estado, hunt, ef, { vida = 0, mana = 0, fatorDur = 1, traumas = 0, custoDeMana = 0, agora = hunt?.clock ?? 0 } = {}) {
  if (!ligado() || !ef || !hunt) return ef;
  let e = ef;
  // (a Flecha Forjada com Mana: "1% mais Dano com Acertos e Afecções por cada 1 de Custo de Mana" — o custo de Mana deste uso; o "mais" do suporte é o `fatorDeDano`)
  if (e.maisPorCustoManaPct > 0 && custoDeMana > 0) e = { ...e, fatorDeDano: (e.fatorDeDano ?? 1) * (1 + (e.maisPorCustoManaPct * custoDeMana) / 100) };
  if (traumas > 0 && (e.traumaFisicoMin > 0 || e.traumaAtordoamentoPct > 0)) {
    e = { ...e };
    if (e.traumaFisicoMin > 0) {
      e['somadoMin:physical'] = (e['somadoMin:physical'] ?? 0) + e.traumaFisicoMin * traumas;
      e['somadoMax:physical'] = (e['somadoMax:physical'] ?? 0) + (e.traumaFisicoMax ?? e.traumaFisicoMin) * traumas;
    }
    if (e.traumaAtordoamentoPct > 0) e['af:stun_duration'] = (e['af:stun_duration'] ?? 0) + e.traumaAtordoamentoPct * traumas;
  }
  if (e.inspiracao > 0) {
    const n = Math.min(INSPIRACAO.maximo, hunt.poeInspiracaoS2A?.n ?? 0);
    if (n > 0) {
      e = { ...e };
      if (e.inspiracaoCritPct > 0) e.critChance = (e.critChance ?? 0) + (e.inspiracaoCritPct * n) / 20;
      if (e.inspiracaoElementalMaisPct > 0) e['af:mais_dano_elemental'] = vezes(e['af:mais_dano_elemental'], e.inspiracaoElementalMaisPct * n);
    }
    if (mana > 0) hunt.poeInspiracaoS2A = inspiracaoAposGastar(hunt.poeInspiracaoS2A, mana, e.inspiracaoPerdeEm ?? 0);
  }
  // (lote D2, dono 27/10) a Transfusão: a cada 200 de Vida gasta no custo inicial das magias suportadas, uma alma (a do Devorador de Almas: +5% de velocidade de ataque e de
  // conjuração por alma, até 45, perde 1 a cada 0,5 s sem alma nova) no lacaio mais perto a até 3 casas — mesmo sem o Devorador (`almas.livre`)
  if (e.transfusaoVidaPorAlma > 0 && vida > 0) {
    const t = transfusaoAposGastar(hunt.poeTransfusaoS2A, vida, e.transfusaoVidaPorAlma);
    hunt.poeTransfusaoS2A = t.gasto;
    const l = t.almas > 0 ? lacaioProximo(hunt, DEVORADOR_DE_ALMAS.raioCasas) : null;
    if (l) l.almas = { n: Math.min(DEVORADOR_DE_ALMAS.maximo, almasDoLacaio(l, agora) + t.almas), em: agora, livre: true };
  }
  if (e.fonteDeVidaApos > 0 && vida > 0) {
    const f = fonteAposGastar(hunt.poeFonteDeVidaS2A, vida, e.fonteDeVidaApos);
    hunt.poeFonteDeVidaS2A = f.gasto;
    if (f.ganhou) ModsPoe.ganharBuff(hunt, 'fonteDeVida', ((e.fonteDeVidaMs ?? 4000) * fatorDur) / 1000, agora);
  }
  return e;
}

/** O ÍMPETO DE COMBATE no tempo deste uso (`acoes.temposDaGemaPoe`): o fator do tempo (÷), 1 sem ele. */
export function fatorDoImpetoNoUso(hunt, { deslocamento, ataque, ef }, agora = hunt?.clock ?? 0) {
  if (!ligado() || !hunt) return 1;
  const ate = hunt.poeBuffs?.impetoDeCombate ?? 0;
  return fatorDoImpeto({ ate, velPct: hunt.poeImpetoVelS2A ?? 0 }, { deslocamento, ataque, suportadoPeloCombate: ef?.impetoMs > 0 }, agora);
}
/** Usar uma Habilidade de Deslocamento tira o Ímpeto de Combate ("dura 2 segundos ou até que você utilize uma Habilidade de Deslocamento"). */
export function tirarImpeto(hunt) {
  if (!hunt?.poeBuffs?.impetoDeCombate) return false;
  delete hunt.poeBuffs.impetoDeCombate;
  delete hunt.poeImpetoVelS2A;
  hunt.poeFichaMudou = true;
  return true;
}

// ---------------------------------------------------------------- o Sangue Corrompido do Clamor Corrompedor e do Estandarte Ensanguentado

/** Põe `n` acúmulos do Sangue Corrompido (`{ total, ms, acao }` — o dano de um acúmulo pela duração) no bicho. Devolve quantos entraram. */
export function porSangueCorrompido(bicho, sangue, n, agora, eventos = []) {
  if (!ligado() || !bicho || !(bicho.hp > 0) || bicho.dummy || !(sangue?.total > 0) || !(n > 0)) return 0;
  let k = 0;
  for (let i = 0; i < n; i++) if (Dot.aplicar(bicho, { tipo: 'sangueCorrompido', total: sangue.total, duracaoMs: sangue.ms, origem: { fonte: 'gema', habilidade: sangue.acao ?? null } }, agora)) k++;
  if (k) eventos.push({ t: 'estado', uid: bicho.uid, x: bicho.x, y: bicho.y, estado: 'sangrando' });
  return k;
}
/** O Clamor Corrompedor no uso do Clamor: os `n` acúmulos em cada inimigo vivo a até `raio` casas de `centro`. Devolve os bichos. */
export function sangueNoRaio(hunt, centro, raio, sangue, n, agora = hunt?.clock ?? 0, eventos = []) {
  const atingidos = [];
  for (const m of hunt?.monstros ?? []) {
    if (!(m.hp > 0) || m.dummy || (m.z ?? hunt.z ?? 0) !== (hunt.z ?? 0) || Math.max(Math.abs(m.x - centro.x), Math.abs(m.y - centro.y)) > raio) continue;
    if (porSangueCorrompido(m, sangue, n, agora, eventos)) atingidos.push(m);
  }
  return atingidos;
}
/**
 * O Sangue Corrompido do ataque IMPELIDO por um Clamor Corrompedor ("infligem 1 Debuffs … no primeiro inimigo Acertado por cada Ataque que Impelirem"): o que os
 * Clamores que impelem este ataque (`des` — os slugs) guardaram no uso (`hunt.poeSangueDoImpelirS2A`), ou null.
 */
export function sangueDoImpelir(hunt, des) {
  const t = hunt?.poeSangueDoImpelirS2A;
  if (!t || !des?.length) return null;
  const lista = des.map((d) => t[d]).filter((x) => x?.n > 0 && x.total > 0);
  return lista.length ? lista : null;
}
/** O Estandarte Ensanguentado no tique: o plantado inflige 1 acúmulo por segundo em cada inimigo vivo na área dele (`estandarte.sangue`). */
export function tiqueS2A(hunt, eventos = [], agora = hunt?.clock ?? 0) {
  if (!ligado() || !hunt) return 0;
  const p = ModsPoe.estandartePlantado(hunt, agora);
  const s = p?.estandarte?.sangue;
  if (!s) return 0;
  let n = 0;
  while (s.proximo <= agora) {
    s.proximo += 1000;
    for (const m of hunt.monstros ?? []) {
      if (!(m.hp > 0) || m.dummy || (m.z ?? hunt.z ?? 0) !== (p.estandarte.z ?? hunt.z ?? 0) || Math.max(Math.abs(m.x - p.estandarte.x), Math.abs(m.y - p.estandarte.y)) > (p.raio ?? 1)) continue;
      n += porSangueCorrompido(m, s, 1, agora, eventos);
    }
  }
  return n;
}

/**
 * O ABATE do uso suportado: o Decapitar — o golpe final SEU da Habilidade de Golpe suportada, com arma corpo a corpo, num Raro dá um dos Modificadores dele por
 * N s (`ModsPoe.aprenderDoRaro`: o sorteio do Aprendizado Inspirado). `golpeCorpo`: o uso é um Golpe com arma corpo a corpo. Devolve os modificadores ganhos.
 */
export function abatesS2A(estado, hunt, ef, atingidos, { golpeCorpo = false, agora = hunt?.clock ?? 0, rng = Math.random } = {}) {
  if (!ligado() || !hunt || !(ef?.decapitarS > 0) || !golpeCorpo) return [];
  const ganhos = [];
  for (const b of atingidos ?? []) {
    if (!b || b.hp > 0 || b.dummy || b.poeDecapitadoS2A || !QuemFeriu.abateSeu(b)) continue;
    b.poeDecapitadoS2A = true;
    const ids = ModsPoe.aprenderDoRaro(estado, hunt, { afPoe: { aprendizado_inspirado_n: 1, aprendizado_inspirado_s: ef.decapitarS } }, b, agora, rng);
    // (lote D2: o modificador que o Decapitar deu — o que a renovação dele estende)
    for (const id of ids) for (const [k, t] of Object.entries(hunt.poeTemporarios ?? {})) if (k.startsWith(`aprendizado:${id}:`)) t.decapitar = true;
    ganhos.push(...ids);
  }
  return ganhos;
}

/**
 * (lote D2, dono 27/10) a TENTAÇÃO VAAL: o seu uso da habilidade Vaal suportada inflige em você o Dano Físico degenerativo do suporte (1300 por segundo — o motor do dano
 * contínuo em você: os modificadores de dano degenerativo sofrido, o Escudo de Energia e a Vida; pode matar) pelo tempo do Impedimento de Ganho de Almas da gema
 * (`impedimentoMs` — a Tentação vem "em vez de" ele). Devolve o estado posto, ou null.
 */
export function tentacaoVaalNoUso(hunt, ef, { vaal = false, impedimentoMs = 0, agora = hunt?.clock ?? 0 } = {}) {
  if (!ligado() || !hunt || !vaal || !(ef?.tentacaoVaalPorS > 0) || !(impedimentoMs > 0)) return null;
  return Dot.aplicarNoJogador(hunt, { tipo: 'degenFisico', total: (ef.tentacaoVaalPorS * impedimentoMs) / 1000, duracaoMs: impedimentoMs, chave: 'tentacaoVaal', origem: { fonte: 'proprio', mob: 'Tentação Vaal' } }, agora);
}
