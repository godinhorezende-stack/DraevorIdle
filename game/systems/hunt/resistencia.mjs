// A RESISTÊNCIA do bicho ao tipo de dano — a mesma regra em todo golpe.
//
// Auditoria dos atributos (dono, 29/09): "o cálculo deve ser baseado no tipo
// de dano efetivamente produzido pelo ataque". Todo dano do jogador passa por
// aqui, pelo TIPO (physical, fire, energy, earth, ice, death, holy).
//
// `elements` do bestiário: +20 = resiste 20% (toma 80%), −10 = fraco (toma
// 110%). Na sala de boss a resistência tem teto (`RESISTENCIA_MAXIMA_DE_BOSS`).
//
// Limites e penetração (dono, 02/10): a resistência do bicho passa pelo teto dele (`combate/limites.json`), depois SUBTRAI a
// penetração do atacante naquele tipo (`combate/limites.mjs`) — uma conta só, a mesma do golpe, do charm e do balão.
import * as BuffsDeMob from '../mobs/buffs.mjs';
import { BESTIARY } from './monstros.mjs';
import * as R from '../regras.mjs';
import * as Limites from '../combate/limites.mjs';
import * as Formulas from '../combate/formulas.mjs';
import * as Atributos from '../personagem/atributos.mjs';
import * as AtributosDoMob from '../mobs/atributos.mjs';
import * as ModsPoe from '../itens-poe/condicoes-poe.mjs';
// (lote G-A, dono 25/10 — D4: a Redução de Dano Físico a menos da Marca do Caçador)
import { reducaoFisicaMenos, resistenciaDoCaos } from '../itens-poe/gemas-gac.mjs';
// (lote E1b, 26/10: a resistência ignorada pelos acertos no raio das Impurezas Vaal)
import { resIgnoradaNoAlvo } from '../itens-poe/gemas-e1b.mjs';

/** A resistência (em %) do bicho ao `tipo`, com o teto do boss e o piso da fraqueza (antes do teto de resistência e da penetração). */
export function resistenciaDe(hunt, alvo, tipo) {
  // A do bestiário + a dos modificadores do mob (`resist`, ver `mobs/raridade.mjs`).
  // (+ a que os buffs das mecânicas dão por um tempo: Endurecido — `mobs/buffs.mjs`.)
  // (- a janela de vulnerabilidade de um boss único depois que o escudo dele quebra — `bosses-unicos/boss.mjs`.)
  const vulneravel = alvo?.boss?.vulnerabilidade && (hunt?.clock ?? 0) < alvo.boss.vulnerabilidade.ate ? alvo.boss.vulnerabilidade.pct : 0;
  // (- o Causticar do PoE nas resistências elementais: "Inflige Causticar em Inimigos ao Bloquear" — `itens-poe/mods-poe.mjs`.)
  // (- as resistências que as afecções do personagem tiram: "Incendiados ou Resfriados por você têm −X% de Resistências Elementais",
  // "Envenenados por você têm −X% de Resistência a Caos".)
  // (+ a Exposição com o "aplicam X% extra / ao menos X%" de quem a infligiu — a ficha do personagem da caçada.)
  const causticado = (['fire', 'ice', 'energy'].includes(tipo) ? ModsPoe.causticado(alvo, hunt?.clock ?? 0) + ModsPoe.exposicao(alvo, hunt?.clock ?? 0, tipo, ModsPoe.fichaDa(hunt)?.afPoe) : 0) + ModsPoe.resMenosDasAfeccoes(alvo, hunt?.clock ?? 0, tipo);
  // (+ o Equilíbrio Elemental do PoE: +25 / −50 pelos elementos que acertaram o bicho por último.)
  // (+ as auras do personagem nos de perto: "Inimigos Próximos possuem -10% de todas as Resistências", "têm Resistência a Fogo e Gelo aumentadas";
  // "têm Resistência a Raio igual a sua" troca a do bicho pela do personagem — `mods-poe.aurasProximas`.)
  const agora = hunt?.clock ?? 0;
  const igual = ModsPoe.ativo(alvo?.estados?.resIgual, agora) ? alvo.estados.resIgual[tipo] : undefined;
  const daAura = ModsPoe.ativo(alvo?.estados?.resAura, agora) ? Number(alvo.estados.resAura[tipo]) || 0 : 0;
  // (+ "as Resistências deles para tais Elementos são zeradas": o bicho que te acertou com aquele elemento.)
  const zerada = ModsPoe.ativo(alvo?.estados?.resZerada, agora) && alvo.estados.resZerada[tipo];
  const daEspecie = zerada ? 0 : igual != null ? igual : (BESTIARY[alvo?.key]?.elements?.[tipo] ?? 0) + (alvo?.resist?.[tipo] ?? 0);
  // (+ o Esmagado do PoE: −15 na redução física; + lote F: "Inimigos Próximos possuem −X% de Resistência a <tipo>" — a aura da árvore.)
  const esmagado = (tipo === 'physical' ? ModsPoe.esmagado(alvo, agora) : 0) + ModsPoe.resMenosDaAura(alvo, agora, tipo);
  const r = daEspecie + daAura + BuffsDeMob.resistencia(alvo, agora, tipo) - vulneravel - causticado - esmagado + ModsPoe.equilibrio(alvo, agora, tipo);
  const comBoss = hunt?.isBoss ? Math.min(R.RESISTENCIA_MAXIMA_DE_BOSS, r) : r;
  // A fraqueza só vai até o piso (`fraquezaMaxima`); o teto de cima fica para `resistenciaEfetivaDe`.
  return Math.max(-Limites.LIMITES.resistenciaDoMob.fraquezaMaxima, comBoss);
}

/**
 * A resistência EFETIVA do bicho a um golpe do atacante (`ficha`): a do bicho, no teto, menos a penetração do atacante naquele tipo.
 * Sem `ficha`, é a resistência do bicho no teto (sem penetração).
 */
export function resistenciaEfetivaDe(hunt, alvo, tipo, ficha = null) {
  let res = resistenciaDe(hunt, alvo, tipo);
  let pen = Limites.penetracaoDe(ficha?.penetracao, tipo);
  // As regras dos únicos do PoE (o atacante — `ficha.afPoe`): "Dano Elemental Causado por você com Acertos é Resistido pela Resistência
  // Elemental mais baixa ao invés"; "Trata os valores das Resistências Elementais (a de Caos) dos Monstros Inimigos como invertidos" (a
  // positiva vira negativa e a fraqueza vira resistência); "Seus Acertos não podem Penetrar ou ignorar Resistências Elementais" (a penetração
  // negativa — "como se fosse X% maior" — fica).
  const af = ficha?.afPoe;
  const elemental = ['fire', 'ice', 'energy'].includes(tipo);
  const sempreInvertida = elemental && Number(af?.res_elemental_invertida) > 0;
  if (af) {
    if (elemental && Number(af.resistido_pela_menor) > 0) res = Math.min(...['fire', 'ice', 'energy'].map((t) => resistenciaDe(hunt, alvo, t)));
    if (sempreInvertida || (tipo === 'chaos' && Number(af.res_caos_invertida) > 0)) res = -res;
    if (elemental && Number(af.sem_penetracao_elemental) > 0) pen = Math.min(0, pen);
  }
  // (ciclo 7, lote E) "Acertos têm X% de chance de tratarem os valores da Resistência Elemental dos Monstros Inimigos como invertidos": o
  // golpe sorteado (`ModsPoe.fichaDoGolpe` → `resInvertida`) usa a resistência elemental com o sinal trocado (uma vez só, com a dos únicos).
  if (ficha?.resInvertida && elemental && !sempreInvertida) res = -res;
  // (lote G-C, D11) a Detonação de Feitiços: o Caos do acerto resistido pela menor resistência do alvo entre Fogo, Gelo, Raio e Caos (a da Contradição: a maior)
  if (tipo === 'chaos' && ficha?.caosResistidoPela) res = resistenciaDoCaos(ficha.caosResistidoPela, (t) => resistenciaDe(hunt, alvo, t));
  // (lote E1b, 26/10) as Impurezas Vaal: "Resistência a <El> de Inimigos Próximos é Ignorada por Acertos" — o acerto (com a ficha de quem acerta; o dano degenerativo
  // vem sem ela) no bicho a até o raio da aura ignora a resistência POSITIVA (a negativa fica, como no "Golpes Críticos ignoram as Resistências" do jogo)
  if (ficha && res > 0 && resIgnoradaNoAlvo(hunt, alvo, tipo)) res = 0;
  // (lote S2B, 27/10) a Tríade Profana: o acerto que sorteou "ignorar a resistência a dano de caos e elétrico" (`ficha.ignoraResDe` — `ModsPoe.fichaDoGolpe`): a positiva vai a 0
  if (res > 0 && ficha?.ignoraResDe?.includes(tipo)) res = 0;
  return Limites.resistenciaEfetiva(Limites.resistenciaDoMob(res), pen);
}

/**
 * `valor` de dano do `tipo` depois das defesas do bicho: a ARMADURA (só no golpe FÍSICO — com a `ficha` do atacante, que marca o golpe; o
 * dano contínuo não passa por ela), a redução de dano do bicho (separada), a resistência ao elemento e a penetração do atacante. (No PoE, o
 * físico: a armadura e a redução física adicional somadas, com teto — `fracaoFisicaDoPoe`.)
 * (`mobs/atributos.mjs`: armadura, bloqueio e redução vêm da espécie e dos modificadores.)
 */
export function resistido(hunt, alvo, tipo, valor, ficha = null, { armadura = true } = {}) {
  let v = valor;
  // PoE: "Acertos ignoram a Redução de Dano Físico dos Monstros Inimigos" (a ficha do golpe sorteou): sem armadura nem resistência física.
  if (ficha?.ignoraReducaoFisica && tipo === 'physical') return Math.max(0, Math.round(v));
  // PoE 1 (dono, 10/10): no físico, a armadura e a redução física adicional SOMAM, no teto de 90% (`fracaoFisicaDoPoe`) — no lugar da
  // armadura daqui e da resistência física do fim.
  const somaDoPoe = tipo === 'physical' && ModsPoe.somaFisicaDoPoe();
  if (somaDoPoe) v *= fracaoFisicaDoPoe(hunt, alvo, valor, ficha, { armadura });
  else if (ficha && armadura && tipo === 'physical') v *= 1 - AtributosDoMob.reducaoDeArmadura(alvo, Atributos.levelDoBicho(hunt, alvo), valor, Formulas.PARAMETROS.armadura.poe.coeficiente);
  const reducao = AtributosDoMob.reducaoDeDano(alvo);
  if (reducao > 0) v *= 1 - reducao;
  // (+ os estados do PoE no bicho: Cinzas, Intimidado, Definhado.)
  if (ficha) v *= ModsPoe.fatorRecebidoPeloBicho(alvo, tipo, ficha, hunt?.clock ?? 0);
  if (somaDoPoe) return Math.max(0, Math.round(v));
  return Math.max(0, Math.round(Limites.danoAposResistencia(v, resistenciaEfetivaDe(hunt, alvo, tipo, ficha))));
}

/**
 * A fração do dano FÍSICO que passa pela defesa física do bicho no PoE 1 (dono, 10/10): a armadura (só no golpe — com a `ficha` do atacante e
 * `armadura`) + a redução física adicional (a "resistência" física: bestiário, modificadores, buffs), SOMADAS no teto de 90%, menos a
 * penetração física (Overwhelm) do atacante depois do teto. A fraqueza física (a adicional negativa: a janela de vulnerabilidade do boss)
 * aumenta o dano por cima, como antes.
 */
export function fracaoFisicaDoPoe(hunt, alvo, valor, ficha = null, { armadura = true } = {}) {
  const adicional = resistenciaDe(hunt, alvo, 'physical');
  const daArmadura = ficha && armadura ? AtributosDoMob.reducaoDeArmadura(alvo, Atributos.levelDoBicho(hunt, alvo), valor, Formulas.PARAMETROS.armadura.poe.coeficiente) : 0;
  // (lote G-A, D4) a Marca do Caçador: "Inimigos Amaldiçoados têm −X% de Redução de Dano Físico" — SOMADA à armadura e à redução adicional (o PoE); a soma pode
  // ficar negativa (o monstro sofre mais). Sem a marca, a conta de sempre.
  const menos = reducaoFisicaMenos(alvo, hunt?.clock ?? 0);
  if (menos > 0) {
    const soma = Math.max(0, daArmadura) * 100 + Math.max(0, adicional) - menos;
    const red = soma > 0 ? Limites.reducaoFisicaTotal(0, soma, Limites.penetracaoDe(ficha?.penetracao, 'physical')) : soma;
    return (1 - red / 100) * (adicional < 0 ? 1 - adicional / 100 : 1);
  }
  const total = Limites.reducaoFisicaTotal(daArmadura, adicional, Limites.penetracaoDe(ficha?.penetracao, 'physical'));
  return (1 - total / 100) * (adicional < 0 ? 1 - adicional / 100 : 1);
}
