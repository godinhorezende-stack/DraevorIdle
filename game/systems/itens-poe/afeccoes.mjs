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

/** (o Warden) A Causticação: a redução das Resistências, pelo Dano de Fogo do acerto (como a Eletrização), até 30%, por 4 s. */
export const CAUSTICACAO = { duracaoMs: 4000, minimo: 1, maximo: 30 };
export const BASE = {
  incendio: { porSegundo: 0.9, duracaoMs: 4000 },
  sangramento: { porSegundo: 0.7, duracaoMs: 5000 },
  veneno: { porSegundo: 0.3, duracaoMs: 2000 },
  eletrizacao: { duracaoMs: 2000, minimo: 5, maximo: 50 },
  resfriamento: { minimo: 5, maximo: 30 },
  // A afecção de DANO (incêndio, sangramento, veneno) posta por um golpe CRÍTICO causa 50% mais (a tela de personagem do PoE: o
  // "… from Critical Strikes" é 1,5× o do acerto). O "+X% ao Multiplicador de Crítico" não entra: o dano do golpe chega aqui sem o crítico.
  criticoMaisPct: 50,
};
/**
 * (14/10, dono: "Adotar a conta do PoE") O CONGELAMENTO que você põe: 60 ms por 1% do limiar (a vida máxima do monstro) em dano de Gelo do
 * acerto, até 3 s; × a "Duração do Congelamento aumentada" (e +20% por Geada no alvo); com menos de 0,3 s ele não é infligido. A mesma conta
 * do Congelamento dos monstros em você (`monstros-no-jogador.msDoCongelamento`). Antes, 1,5 s fixos.
 * A GEADA (o Juramento do Inverno: "Acertos que falharem em Congelar devido a Duração insuficiente do Congelamento infligem Geada"): dura
 * 10 s, acumula (cada uma renova a duração), +20% de Duração do Congelamento por Geada, e sai toda quando o alvo é Congelado.
 */
export const CONGELAMENTO = Object.freeze({ msPorPct: 60, minimoMs: 300, maximoMs: 3000 });
export const GEADA = Object.freeze({ duracaoMs: 10_000, duracaoCongelamentoPct: 20 });
/** As Geadas no monstro agora (0 sem nenhuma). */
export const geadasNo = (bicho, agora) => ((bicho?.estados?.geada?.ate ?? 0) > agora ? bicho.estados.geada.n | 0 : 0);
/** A duração do Congelamento de um acerto com `gelo` de dano de Gelo (ms; 0 = não congela — abaixo de 0,3 s). `aumentadoPct`: a Duração aumentada. */
export function msDoCongelamento(gelo, limiar, aumentadoPct = 0) {
  if (!(gelo > 0) || !(limiar > 0)) return 0;
  const ms = Math.min(CONGELAMENTO.maximoMs, (CONGELAMENTO.msPorPct * 100 * gelo) / limiar) * Math.max(0, 1 + aumentadoPct / 100);
  return ms >= CONGELAMENTO.minimoMs ? Math.round(ms) : 0;
}

/** O que as peças/árvore dão de afecção (da soma de atributos `af`), no formato que `aoAcertar` usa. */
export function daSoma(af = {}) {
  const n = (k) => Number(af[k]) || 0;
  return {
    chance: { incendio: n('chance_ignite'), sangramento: n('chance_bleed'), veneno: n('chance_poison'), congelamento: n('chance_freeze'), eletrizacao: n('chance_shock') },
    chanceAtaque: { incendio: n('chance_ignite_ataque'), sangramento: n('chance_bleed_ataque'), veneno: n('chance_poison_ataque') },
    multiplicador: n('dot_multi'),
    multiplicadorFogo: n('dot_multi_fire'),
    // (09/10) Gelo e Raio: só o dano degenerativo das habilidades usa (não há afecção de dano de Gelo nem de Raio).
    multiplicadorGelo: n('dot_multi_cold'),
    multiplicadorRaio: n('dot_multi_lightning'),
    multiplicadorCaos: n('dot_multi_chaos'),
    multiplicadorFisico: n('dot_multi_phys'),
    // O veneno é dano de Caos ao longo do tempo e o sangramento, Físico: os multiplicadores "de Caos" e "Físico" do PoE valem neles.
    multiplicadorVeneno: n('dot_multi_poison') + n('dot_multi_chaos'),
    multiplicadorSangramento: n('dot_multi_bleed') + n('dot_multi_phys'),
    duracao: n('ailment_duration'),
    // (17/10, lote G17) o "X% mais/menos Duração de Afecções" (multiplica: o Sadismo) e o só das de dano (a Aflição Ágil)
    duracaoMais: n('ailment_duration_mais'), duracaoDanoMais: n('duracao_afeccoes_dano_mais'),
    duracaoVeneno: n('poison_duration'),
    // PoE (07/10): o "Dano Degenerativo aumentado" (todas) e o de cada uma; a duração de cada uma e a das Elementais; o efeito do
    // Resfriamento e da Eletrização; "causam dano X% mais rápido"; "todo o dano pode Envenenar"; o dano a mais em quem está Mutilado.
    danoAumentado: n('dot_dmg_inc'),
    // (09/10) "Dano com Afecções aumentado" (a árvore: "Ataques com Machados causam Dano com Afecções aumentado"): só nas afecções de dano.
    danoComAfeccoes: n('ailment_dmg_inc'),
    danoIncendio: n('ignite_dmg_inc'),
    // ("Incêndios infligidos com esta Arma causam X% mais Dano")
    incendioMais: n('incendio_mais'),
    // (a Chama Voraz: "Você pode infligir um incêndio adicional em cada inimigo"; "A duração base do incêndio é de N segundo")
    incendiosExtra: n('incendios_extra'), incendioDuracaoBaseMs: n('incendio_duracao_base_s') * 1000,
    // (o Warden: "Acertos que causariam Incêndio causam Causticação ao invés"; "Você pode infligir uma Causticação adicional em cada Inimigo")
    incendioViraCausticacao: n('incendio_vira_causticacao') > 0, causticacoesExtra: n('causticacoes_extra'),
    // (lote A1b, dono 19/10: D-f) "X% de chance de Causticar Inimigos" (o Avanço Ardente do Retorno, na qualidade — a gema a põe no acerto dela):
    // a Causticação de sempre, pela chance
    chanceCausticar: n('chance_causticar'),
    // (lote 65) o "Dano Físico Degenerativo aumentado" vale no Sangramento (o dano Físico ao longo do tempo), como no PoE
    danoSangramento: n('bleed_dmg_inc') + n('dot_dmg_inc_fisico'),
    // (lote 65) e o "Dano de Caos Degenerativo aumentado", no Veneno (o de Caos)
    danoVeneno: n('poison_dmg_inc') + n('dot_dmg_inc_caos'),
    // (lote 65, as Ramificadoras) o "Dano Degenerativo aumentado" de UM tipo — o degenerativo das gemas desse elemento (`acoes`)
    danoDegenDoElemento: { chaos: n('dot_dmg_inc_caos'), physical: n('dot_dmg_inc_fisico'), ice: n('dot_dmg_inc_gelo') },
    duracaoIncendio: n('duracao_incendio') + n('duracao_afeccoes_elementais'),
    duracaoSangramento: n('duracao_sangramento'),
    duracaoCongelamento: n('duracao_congelamento') + n('duracao_afeccoes_elementais'),
    duracaoEletrizacao: n('duracao_eletrizacao') + n('duracao_afeccoes_elementais'),
    efeitoResfriamento: n('efeito_resfriamento'),
    // (lote 33, P009) "Efeito de Afecções Não-Danificadoras aumentado" — o da Causticação, do Fragilizar e do Exaurir (no Resfriamento e na
    // Eletrização a regra já soma em `efeito_resfriamento`/`efeito_eletrizacao`)
    efeitoNaoDano: n('efeito_nao_dano'),
    efeitoEletrizacao: n('efeito_eletrizacao'),
    maisRapido: n('dot_mais_rapido'),
    // (a Crueldade: "mais Dano Degenerativo" — multiplica todas as afecções e o degenerativo das gemas)
    dotMais: n('dano_dot_mais'),
    qualquerDanoEnvenena: n('envenena_qualquer_dano') > 0,
    mutiladosDot: n('mutilados_dot_inc'),
    // Segredos do Sofrimento (keystone da peça): não Incendeia, Resfria, Congela nem Eletriza (o crítico inflige Causticar/Fragilizar/Exaurir).
    semElementais: n('keystone_sofrimento') > 0,
    incendioMaisRapido: n('incendio_mais_rapido'),
    // (09/10) "Sangramentos infligidos por você causam Dano X% mais rápido": o mesmo total em menos tempo.
    sangramentoMaisRapido: n('sangramento_mais_rapido'),
    // (13/10, a Maestria de Envenenamentos: "Envenenamentos infligidos por você causam Dano X% mais rápido" — só o Veneno)
    venenoMaisRapido: n('veneno_mais_rapido'),
    // (09/10) "Golpes Críticos não Incendeiam de forma inerente" (a maestria de fogo).
    criticoNaoIncendeia: n('critico_nao_incendeia') > 0,
    // Os únicos: que dano pode pôr cada afecção ("Seu Dano de Raio pode Incendiar", "Seu Dano de Fogo pode Eletrizar, mas não Incendiar",
    // "Todo Dano pode Congelar"), quais não pode pôr ("Não Pode aplicar Incendiar"), as chances só no crítico, o "como se causasse X% mais
    // Dano", a duração do Resfriamento e os venenos a mais.
    pode: Object.fromEntries(['incendio', 'congelamento', 'resfriamento', 'eletrizacao', 'veneno', 'sangramento'].map((t) => [t, ['physical', 'fire', 'ice', 'energy', 'chaos'].filter((el) => n(`pode:${t}:${el}`) > 0)])),
    naoPode: Object.fromEntries(['incendio', 'congelamento', 'resfriamento', 'eletrizacao', 'veneno', 'sangramento'].map((t) => [t, n(`nao_pode:${t}`) > 0])),
    naoPodeEl: Object.fromEntries(['incendio', 'congelamento', 'resfriamento', 'eletrizacao'].map((t) => [t, ['physical', 'fire', 'ice', 'energy', 'chaos'].filter((el) => n(`nao_pode:${t}:${el}`) > 0)])),
    chanceCritico: { incendio: n('chance_ignite_critico'), sangramento: n('chance_bleed_critico'), veneno: n('chance_poison_critico'), congelamento: n('chance_freeze_critico'), eletrizacao: n('chance_shock_critico') },
    eletrizaComoMais: n('eletrizacao_como_mais'), resfriaComoMais: n('resfriamento_como_mais'), congelaComoMais: n('congelamento_como_mais'), duracaoResfriamento: n('duracao_resfriamento') + n('duracao_afeccoes_elementais'),
    venenosExtras: n('venenos_extras'), venenoMaxNoAlvo: n('veneno_max_no_alvo'), semInerente: n('critico_sem_afeccao_inerente') > 0,
    // (09/10, as afecções do personagem nos monstros) a Eletrização: o máximo (+X, ou fixo — "Efeito Máximo da Eletrização é igual a X%"), o
    // mínimo ("sempre aumentam o Dano recebido em ao menos X%"), quantas por inimigo ("até N Eletrizações") e a parte da Mana máxima aumentada.
    eletrizacaoMaximo: n('eletrizacao_maximo'), eletrizacaoMaximoFixo: n('eletrizacao_maximo_fixo'), eletrizacaoMinima: n('eletrizacao_minima'),
    eletrizacoesMax: n('eletrizacoes_max'), eletrizacaoDaMana: (n('mana_inc') * n('eletrizacao_da_mana_pct')) / 100,
    // o Resfriamento: o mínimo, o máximo ("podem reduzir… até um máximo de X%") e o "reduz o Dano causado pela metade do Efeito"
    resfriamentoMinimo: n('resfriamento_minimo'), resfriamentoMaximo: n('resfriamento_maximo'), resfriamentoReduzDano: n('resfriamento_reduz_dano') > 0,
    // o crítico: o efeito das não danificadoras, o multiplicador degenerativo (de todas e do veneno), o "mais dano" do veneno; a Agonia Perfeita
    efeitoNaoDanoCritico: n('efeito_nao_dano_critico'), multiplicadorCritico: n('dot_multi_critico'), multiplicadorVenenoCritico: n('dot_multi_poison_critico'), multiplicadorSangramentoCritico: n('dot_multi_bleed_critico'), multiplicadorIncendioCritico: n('dot_multi_ignite_critico'),
    venenoCriticoMais: n('veneno_critico_mais'), venenoMaisChance: n('veneno_mais_chance'), venenoMaisPct: n('veneno_mais_pct'),
    // (lote 75, o buff do Arauto da Agonia: "Buff concede 10% mais Dano com Veneno" — o MORE do PoB, só no Veneno; multiplica à parte)
    venenoMaisFinal: n('veneno_mais_final'), agoniaPerfeita: n('agonia_perfeita') > 0, semAfeccaoSemCritico: n('sem_afeccao_sem_critico') > 0,
    // o veneno em inimigo não envenenado / sangrando; o sangramento por empalamento, as pilhas (Dança Carmesim) e o "menos dano"
    venenoNaoEnvenenado: n('veneno_nao_envenenado_inc'), multiplicadorVenenoSangrando: n('dot_multi_poison_sangrando'),
    multiplicadorSangramentoPorEmpalamento: n('dot_multi_bleed_por_empalamento'), sangramentoPilhas: n('sangramento_pilhas'), sangramentoMenos: n('sangramento_menos'),
    // (11/10) "Sangramentos que você infligir são Agravados"; a Dança Carmesim — "Seu Sangramento não causa Dano extra enquanto o Inimigo se move"
    sangramentoAgravado: n('sangramento_agravado') > 0, sangramentoSemMovimento: n('sangramento_sem_movimento') > 0,
    // o Congelamento: o mínimo, o Resfriamento ao descongelar e o dano "permanente" por segundo Congelado/Resfriado
    congelamentoMinimoMs: n('congelamento_minimo_s') * 1000, resfriarAoDescongelar: n('resfriar_ao_descongelar'),
    // (14/10, o Juramento do Inverno: o acerto que falhar em Congelar por duração insuficiente inflige Geada)
    geada: n('geada_ao_falhar_congelar') > 0,
    permanente: { congelado: n('dano_perm_congelado'), congeladoMax: n('dano_perm_congelado_max'), resfriado: n('dano_perm_resfriado'), resfriadoMax: n('dano_perm_resfriado_max') },
    // as resistências a menos dos Incendiados/Resfriados e dos Envenenados por você (`hunt/resistencia.resistenciaDe`)
    // (o texto traz o "−": o valor chega negativo — vale o tamanho)
    resMenosIncendiadoResfriado: Math.abs(n('res_menos_incendiado_resfriado')), resMenosCaosEnvenenado: Math.abs(n('res_menos_caos_envenenado')),
    // (lote 69, as Ramificadoras) "Inimigos Incendiados por você têm −X% de Resistência a Fogo"; "Inimigos Envenenados por você não podem
    // Regenerar Vida" (`skills/estados` — a regeneração do monstro)
    resMenosFogoIncendiado: Math.abs(n('res_menos_fogo_incendiado')), envenenadosSemRegen: n('envenenados_sem_regen') > 0,
    // (lote A5, dono 20/10) o "X% mais Efeito de Resfriamento" (o Estalo Gélido — multiplica, no teto); o Resfriamento Ósseo (D5: o Resfriamento posto marca o
    // Gelo sofrido aumentado — `fragilGelo`); o Coursing Current (D6: a Eletrização que nasce do Resfriamento e o Resfriamento que nasce da Eletrização)
    efeitoResfriamentoMais: n('efeito_resfriamento_mais'), resfriadoFragilGelo: n('resfriado_fragil_gelo') > 0,
    eletrizaAoResfriar: n('eletriza_ao_resfriar') > 0, resfriaAoEletrizar: n('resfria_ao_eletrizar') > 0,
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
  const e = alvo?.estados;
  // ("Você pode aplicar até N Eletrizações em cada Inimigo": as da pilha somam; sem ela, a Eletrização única.)
  const pilha = (e?.chocadosPilha ?? []).filter((x) => x.ate > agora);
  if (pilha.length) return 1 + pilha.reduce((t, x) => t + x.pct, 0) / 100;
  const s = e?.chocado;
  return s && s.ate > agora ? 1 + s.pct / 100 : 1;
}

/** (lote 81) O golpe fatal que congelaria: marca o Congelamento no morto (a mesma conta do Congelamento do acerto — a chance ou o crítico, e o limiar). */
function congelarNoGolpeFatal(bicho, partes, { afeccoes, crit, agora, rng, salaDeBoss = false }) {
  const a = afeccoes ?? daSoma();
  if (a.naoPode?.congelamento || (a.semAfeccaoSemCritico && !crit)) return;
  // (quem o jogo nunca congela vivo — o chefe, a resistência a controle de 100% — também não fica Congelado no golpe fatal: `Estados.aplicar`)
  if (Estados.ehChefe(bicho, salaDeBoss) || (Number(bicho.resistControle) || 0) >= 100) return;
  // (o Gelo que conta, como no acerto: o que "pode Congelar", sem o que "não pode" e sem os elementais do Sofrimento)
  const conta = [...new Set(['ice', ...(a.pode?.congelamento ?? [])])].filter((el) => !(a.naoPodeEl?.congelamento ?? []).includes(el) && !(a.semElementais && ['fire', 'ice', 'energy'].includes(el)));
  const gelo = partes.filter((p) => conta.includes(p.elemento)).reduce((t, p) => t + (Number(p.dano) || 0), 0);
  if (!(gelo > 0)) return;
  const chance = (a.chance?.congelamento ?? 0) + (crit ? a.chanceCritico?.congelamento ?? 0 : 0);
  if (!((crit && !a.semInerente) || (chance > 0 && rng() * 100 < chance))) return;
  const ms = msDoCongelamento(gelo * (1 + (a.congelaComoMais ?? 0) / 100), bicho.maxHp ?? 1, (a.duracaoCongelamento ?? 0) + (a.duracao ?? 0) + geadasNo(bicho, agora) * GEADA.duracaoCongelamentoPct);
  if (ms > 0) (bicho.estados ??= {}).congelado = { ate: agora + ms };
}

/**
 * Depois de um acerto do jogador. `partes`: `[{ elemento, dano }]` (o dano de cada tipo no acerto, antes da resistência); `crit`: foi
 * crítico; `ataque`: é ataque (golpe da arma, habilidade de ataque) — as chances "com Ataques" só valem nele. `afeccoes`: o de `daSoma`
 * (a ficha guarda). Devolve os nomes dos estados postos (o evento na tela). Sem o sistema do PoE, não faz nada.
 */
export function aoAcertar(bicho, partes, { afeccoes, crit = false, ataque = false, agora = 0, rng = Math.random, salaDeBoss = false, praga = null, fatoresDoDano = null, fonte = 'poe', aoPor = null, sofrido = null } = {}) {
  if (!ligado() || !bicho || bicho.dummy) return [];
  // (lote 81 — dono: "Golpe fatal também") o golpe que MATA e congelaria: o morto conta como Congelado (o PoE Estilhaça — a explosão do Arauto
  // Glacial, as Almas Vaal…); nada mais se aplica a um morto
  if (bicho.hp <= 0) {
    congelarNoGolpeFatal(bicho, partes, { afeccoes, crit, agora, rng, salaDeBoss });
    return [];
  }
  const a = afeccoes ?? daSoma();
  // "Golpes não Críticos não infligem Afecções" (a Agonia Perfeita).
  if (a.semAfeccaoSemCritico && !crit) return [];
  const dano = (el) => partes.filter((p) => p.elemento === el).reduce((s, p) => s + (Number(p.dano) || 0), 0);
  const chance = (tipo) => (a.chance[tipo] ?? 0) + (ataque ? a.chanceAtaque?.[tipo] ?? 0 : 0) + (crit ? a.chanceCritico?.[tipo] ?? 0 : 0);
  // (lote 76) o "X% mais Dano" de cada afecção dos SUPORTES da gema (`acoes.maisDasAfeccoesDoSuporte`): multiplica o "mais" dela
  const comSuporte = (tipo, mais) => ((1 + mais / 100) * (1 + (a.maisDoSuporte?.[tipo] ?? 0) / 100) - 1) * 100;
  // (lote 76) e o "Dano aumentado com <afecção>" deles: soma ao aumentado dela (`acoes.aumDasAfeccoesDoSuporte`)
  const aumDoSuporte = (tipo) => a.aumDoSuporte?.[tipo] ?? 0;
  // O dano que conta para cada afecção: o tipo dela + os que um único libera, sem os que um único proíbe.
  const PADRAO = { incendio: ['fire'], congelamento: ['ice'], resfriamento: ['ice'], eletrizacao: ['energy'], sangramento: ['physical'] };
  const baseDe = (t) => (a.naoPode?.[t] ? 0 : [...new Set([...(PADRAO[t] ?? []), ...(a.pode?.[t] ?? [])])].filter((el) => !(a.naoPodeEl?.[t] ?? []).includes(el)).reduce((x, el) => x + (a.semElementais && ['fire', 'ice', 'energy'].includes(el) ? 0 : dano(el)), 0));
  // O crítico incendeia/congela/eletriza de forma inerente (como no PoE), salvo "Golpes Críticos não aplicam Afecções… de forma inerente".
  const doCritico = crit ? 1 + BASE.criticoMaisPct / 100 : 1;
  crit = crit && !a.semInerente;
  const sorte = (pct) => pct > 0 && rng() * 100 < pct;
  const postos = [];
  const duracaoDe = (base, extra = 0) => Math.round(base * (1 + ((a.duracao ?? 0) + extra) / 100) * Math.max(0, 1 + (a.duracaoMais ?? 0) / 100));
  const mutilado = (bicho.estados?.mutilado?.ate ?? 0) > agora ? a.mutiladosDot ?? 0 : 0;
  // O que o alvo já tinha ANTES deste acerto (o "em Inimigos não-Envenenados", o "Incendiar um Inimigo não Incendiado").
  const tinha = (...t) => (bicho.dots ?? []).some((d) => t.includes(d.tipo) && d.falta > 0);
  const jaEnvenenado = tinha('veneno', 'venenoPoe');
  const jaIncendiado = tinha('queimadura');
  const sangrando = tinha('sangramento');
  const empalamentos = (bicho.estados?.empalado ?? []).filter((x) => x.ate > agora && x.acertos > 0).length;
  // O MULTIPLICADOR degenerativo das afecções: o de sempre — ou, com a Agonia Perfeita, o multiplicador de crítico (150% → +50%) — + o
  // "+X% de Multiplicador do Dano Degenerativo para Afecções dos Golpes Críticos".
  const multiplicadorBase = (a.agoniaPerfeita ? Math.max(0, (a.multiplicadorDoCritico ?? 1.5) * 100 - 100) : a.multiplicador ?? 0) + (crit ? a.multiplicadorCritico ?? 0 : 0);
  // `aumentado`: o "Dano Degenerativo aumentado" daquela afecção. "X% mais rápido": a mesma soma em menos tempo. `mais`: o "X% mais/menos
  // dano" daquela afecção (multiplica). `chave`: a pilha do sangramento (a Dança Carmesim).
  let ultimoTotal = 0;
  // (17/10, lote G17) `fatoresDoDano`: o dano-base das afecções de DANO à parte do acerto — `todas` (sem o "mais Dano com Acertos", com o "mais Dano
  // de Afecções") e o de cada uma (`incendio`, `sangramento`, `veneno`). A força das não danificadoras segue o dano do acerto.
  const DO_TIPO = { queimadura: 'incendio', sangramento: 'sangramento', venenoPoe: 'veneno' };
  const dot = (tipo, porSegundo, duracaoMs, base0, multiplicador, aumentado = 0, { mais = 0, chave = null, agravado = false, semMovimento = false } = {}) => {
    const base = base0 * (fatoresDoDano ? (fatoresDoDano.todas ?? 1) * (fatoresDoDano[DO_TIPO[tipo]] ?? 1) : 1);
    if (!(base > 0)) return null;
    // (a duração "menos" só das afecções de dano — a Aflição Ágil)
    if (a.duracaoDanoMais) duracaoMs = Math.round(duracaoMs * Math.max(0, 1 + a.duracaoDanoMais / 100));
    const total = ultimoTotal = base * doCritico * porSegundo * (duracaoMs / 1000) * (1 + multiplicador / 100) * (1 + ((a.danoAumentado ?? 0) + (a.danoComAfeccoes ?? 0) + aumentado + mutilado) / 100) * Math.max(0, 1 + mais / 100) * Math.max(0, 1 + (a.dotMais ?? 0) / 100);
    const rapido = Math.max(100, Math.round(duracaoMs / (1 + ((a.maisRapido ?? 0) + (tipo === 'queimadura' ? a.incendioMaisRapido ?? 0 : 0) + (tipo === 'sangramento' ? a.sangramentoMaisRapido ?? 0 : 0) + (tipo === 'venenoPoe' ? a.venenoMaisRapido ?? 0 : 0)) / 100)));
    // (lote G20a: `fonte` — a do totem é dele: o abate pelo pulso é `matarTotem`, `combate/dot`)
    // (revisão do C4, 21/10: `doAcerto` — a afecção do ACERTO já traz a maldição de dano sofrido na base: o pulso não a conta de novo, nem a do totem, `Dot.recebidoNoPulso`;
    // `sofrido` — o dano sofrido do atacante no pulso, `ModsPoe.sofridoDoAtacante`)
    const estado = Dot.aplicar(bicho, { tipo, total, duracaoMs: rapido, origem: { fonte, doAcerto: true, ...(sofrido ? { sofrido } : {}) }, ...(chave != null ? { chave } : {}), agravado, semMovimento }, agora);
    if (estado) postos.push(estado);
    // (lote 53, a Regra de Ouro: o dano contínuo posto, com o total e a duração — `ModsPoe.refletorDeAfeccoes` o reflete em você)
    if (estado) aoPor?.(tipo, total, rapido, agora);
    return estado;
  };
  // A DANÇA CARMESIM ("Você pode aplicar Sangramento em um Inimigo até N vezes"): cada pilha é um sangramento à parte (a `chave`); cheio, a
  // nova renova a mais fraca.
  const chaveDoSangramento = () => {
    const n = Math.floor(a.sangramentoPilhas ?? 0);
    if (n <= 1) return null;
    const pilhas = (bicho.dots ?? []).filter((d) => d.tipo === 'sangramento' && d.falta > 0 && String(d.chave ?? '').startsWith('pilha:'));
    if (pilhas.length < n) { for (let k = 0; k < n; k++) if (!pilhas.some((d) => d.chave === `pilha:${k}`)) return `pilha:${k}`; }
    return pilhas.reduce((x, d) => (x && x.falta <= d.falta ? x : d), null)?.chave ?? 'pilha:0';
  };
  // (a Chama Voraz: os incêndios a mais — cada um à parte, como as pilhas do Sangramento; cheio, o novo renova o mais fraco)
  const chaveDoIncendio = () => {
    const n = 1 + Math.floor(a.incendiosExtra ?? 0);
    if (n <= 1) return null;
    const pilhas = (bicho.dots ?? []).filter((d) => d.tipo === 'queimadura' && d.falta > 0 && String(d.chave ?? '').startsWith('incendio:'));
    if (pilhas.length < n) { for (let k = 0; k < n; k++) if (!pilhas.some((d) => d.chave === `incendio:${k}`)) return `incendio:${k}`; }
    return pilhas.reduce((x, d) => (x && x.falta <= d.falta ? x : d), null)?.chave ?? 'incendio:0';
  };
  const fogo = baseDe('incendio');
  const fisico = baseDe('sangramento');
  const gelo = baseDe('congelamento');
  const resfria = baseDe('resfriamento');
  const raio = baseDe('eletrizacao');
  const caos = dano('chaos');
  // Incêndio: pela chance, ou crítico com dano de Fogo.
  // (lote A1b, dono 19/10: D-f — a mesma Causticação, numa função só: a do Warden e a da chance de Causticar)
  const causticar = () => {
    // (o Warden: a CAUSTICAÇÃO no lugar do Incêndio — "Inimigos Causticados têm suas Resistências reduzidas em até 30%, baseado no Dano de Fogo
    // do Acerto, por 4 segundos"; com a adicional, as duas mais fortes valem juntas — `condicoes-poe.causticado`.)
    // (lote 33, P009: × o "Efeito de Afecções Não-Danificadoras" — e o do crítico —, no teto de 30%)
    const pct = comEfeito(forca(fogo, bicho.maxHp ?? bicho.hp, CAUSTICACAO), (a.efeitoNaoDano ?? 0) + (crit ? a.efeitoNaoDanoCritico ?? 0 : 0), CAUSTICACAO.maximo);
    const e = (bicho.estados ??= {});
    const ate = agora + duracaoDe(CAUSTICACAO.duracaoMs);
    if (pct > 0) {
      if (a.causticacoesExtra > 0) {
        const pilha = [...(e.causticadosPilha ?? []), ...(e.causticado?.ate > agora ? [e.causticado] : [])].filter((x) => x.ate > agora);
        pilha.push({ ate, pct });
        e.causticadosPilha = pilha.sort((x, y) => y.pct - x.pct).slice(0, 1 + Math.floor(a.causticacoesExtra));
        delete e.causticado;
      } else if (!(e.causticado?.ate > agora && e.causticado.pct >= pct)) e.causticado = { ate, pct };
      postos.push('causticado');
    }
  };
  if (fogo > 0 && ((crit && !a.criticoNaoIncendeia) || sorte(chance('incendio'))) && a.incendioViraCausticacao) {
    causticar();
  } else if (fogo > 0 && ((crit && !a.criticoNaoIncendeia) || sorte(chance('incendio')))) {
    const posto = dot('queimadura', BASE.incendio.porSegundo, duracaoDe(a.incendioDuracaoBaseMs > 0 ? a.incendioDuracaoBaseMs : BASE.incendio.duracaoMs, a.duracaoIncendio ?? 0), fogo, multiplicadorBase + a.multiplicadorFogo + (crit ? a.multiplicadorIncendioCritico ?? 0 : 0), (a.danoIncendio ?? 0) + aumDoSuporte('incendio'), { mais: comSuporte('incendio', a.incendioMais ?? 0), chave: chaveDoIncendio() });
    // (o "ao Incendiar um Inimigo não Incendiado" — `mods-poe.aoPorAfeccoes` lê e apaga)
    if (posto && !jaIncendiado) (bicho.estados ??= {}).incendiadoNovo = true;
  }
  // (lote A1b, dono 19/10: D-f) "X% de chance de Causticar Inimigos": a Causticação pela chance, no acerto com Fogo (sem repetir a do Warden)
  if (fogo > 0 && a.chanceCausticar > 0 && !postos.includes('causticado') && sorte(a.chanceCausticar)) causticar();
  // (+ "+X% de Multiplicador … para Sangramentos por Empalamento no Inimigo"; a Dança Carmesim: as pilhas e o "X% menos Dano com Sangramento")
  if (fisico > 0 && sorte(chance('sangramento'))) dot('sangramento', BASE.sangramento.porSegundo, duracaoDe(BASE.sangramento.duracaoMs, a.duracaoSangramento ?? 0), fisico, multiplicadorBase + (a.multiplicadorSangramento ?? 0) + empalamentos * (a.multiplicadorSangramentoPorEmpalamento ?? 0) + (crit ? a.multiplicadorSangramentoCritico ?? 0 : 0), (a.danoSangramento ?? 0) + aumDoSuporte('sangramento'), { mais: comSuporte('sangramento', -(a.sangramentoMenos ?? 0)), chave: chaveDoSangramento(), agravado: !!a.sangramentoAgravado && !a.sangramentoSemMovimento, semMovimento: !!a.sangramentoSemMovimento });
  // Veneno: do dano Físico e de Caos (ou de TODO o dano, com "Todo o Dano … pode Envenenar").
  const todos = ['physical', 'fire', 'ice', 'energy', 'chaos'].reduce((x, el) => x + dano(el), 0);
  const baseDoVeneno = a.naoPode?.veneno ? 0 : a.qualquerDanoEnvenena ? todos : dano('physical') + caos + (a.pode?.veneno ?? []).filter((el) => !['physical', 'chaos'].includes(el)).reduce((x, el) => x + dano(el), 0);
  // (lote C4, dono 21/10) o Golpe da Víbora da Mamba: "Não pode infligir Envenenamento em Inimigos Envenenados" (cannot_poison_poisoned_enemies — por quem for)
  if (baseDoVeneno > 0 && !(a.naoEnvenenaEnvenenado && jaEnvenenado) && sorte(chance('veneno'))) {
    // ("Inflige N envenenamentos adicionais": mais pilhas do mesmo veneno.)
    // (+ "em Inimigos não-Envenenados causam Dano aumentado", "+X% … por Envenenamento infligido por você em Inimigos Sangrando", o do
    // crítico — multiplicador e "X% mais Dano")
    const multVeneno = multiplicadorBase + a.multiplicadorVeneno + (sangrando ? a.multiplicadorVenenoSangrando ?? 0 : 0) + (crit ? a.multiplicadorVenenoCritico ?? 0 : 0);
    const aumVeneno = (a.danoVeneno ?? 0) + (jaEnvenenado ? 0 : a.venenoNaoEnvenenado ?? 0) + aumDoSuporte('veneno');
    // ("Não pode envenenar inimigos que já tenham pelo menos N envenenamentos": o teto de venenos no alvo.)
    const jaTem = (bicho.dots ?? []).filter((d) => (d.tipo === 'veneno' || d.tipo === 'venenoPoe') && d.falta > 0).length;
    const teto = a.venenoMaxNoAlvo > 0 ? a.venenoMaxNoAlvo : Infinity;
    // ("X% de chance dos Envenenamentos inflingidos por esta Arma causarem Y% mais Dano": sorteado em cada veneno.)
    const maisDoVeneno = () => (crit ? a.venenoCriticoMais ?? 0 : 0) + (a.venenoMaisChance > 0 && rng() * 100 < a.venenoMaisChance ? a.venenoMaisPct ?? 0 : 0);
    // (14/10, o Infestador Incubando: "20% menos Dano com Veneno enquanto Incubando e não estiver no Máximo do Valor da Praga" e "Ao infligir
    // Veneno enquanto Incubando, adiciona 40% do Dano Esperado de Veneno ao Valor da Praga" — `acoes.pragaDoAcerto`)
    // (lote C4, dono 21/10) "Não pode infligir múltiplos envenenamentos com o mesmo ataque" (a Mamba — cannot_inflict_additional_poisons: os adicionais não valem) e
    // o "X% mais Duração do Veneno" da gema (o Golpe Pestilento — active_skill_poison_duration_+%_final, o do nível + o da qualidade)
    const extras = a.venenoUnico ? 0 : Math.max(0, Math.floor(a.venenosExtras ?? 0));
    const duracaoDoVeneno = Math.round(duracaoDe(BASE.veneno.duracaoMs, a.duracaoVeneno) * Math.max(0, 1 + (a.venenoDuracaoMais ?? 0) / 100));
    for (let k = 0; k <= extras && jaTem + k < teto; k++) {
      if (dot('venenoPoe', BASE.veneno.porSegundo, duracaoDoVeneno, baseDoVeneno, multVeneno, aumVeneno, { mais: comSuporte('veneno', ((1 + maisDoVeneno() / 100) * (1 + (a.venenoMaisFinal ?? 0) / 100) * (1 - (praga?.menosPct ?? 0) / 100) - 1) * 100) })) praga?.somar(ultimoTotal);
    }
    // ("Inimigos Envenenados por você têm −X% de Resistência a Caos" — `hunt/resistencia.resistenciaDe`)
    if (a.resMenosCaosEnvenenado > 0) (bicho.estados ??= {}).resMenosCaos = Math.max(bicho.estados.resMenosCaos ?? 0, a.resMenosCaosEnvenenado);
    if (a.envenenadosSemRegen) (bicho.estados ??= {}).semRegenEnvenenado = true;
  }
  const limiar = bicho.maxHp ?? bicho.hp;
  // A ELETRIZAÇÃO de `pct`% no alvo (a do acerto e — lote A5, D6 — a que nasce do Resfriamento, o Coursing Current): vale a mais forte, não
  // encurta a que já corre; com "Você pode aplicar até N Eletrizações", a pilha. Devolve se pôs.
  const maxEl = a.eletrizacaoMaximoFixo > 0 ? a.eletrizacaoMaximoFixo : BASE.eletrizacao.maximo + (a.eletrizacaoMaximo ?? 0);
  const eletrizar = (pct0) => {
    if (bicho.imuneChoque) return false;
    const pct = Math.min(maxEl, pct0);
    const e = (bicho.estados ??= {});
    const ate = agora + duracaoDe(BASE.eletrizacao.duracaoMs, a.duracaoEletrizacao ?? 0);
    if (pct > 0 && a.eletrizacoesMax > 1) {
      // "Você pode aplicar até N Eletrizações em cada Inimigo": a pilha (as N mais fortes ativas) — o dano a mais é a soma.
      const pilha = (e.chocadosPilha ?? []).filter((x) => x.ate > agora);
      pilha.push({ ate, pct, dur: ate - agora });
      e.chocadosPilha = pilha.sort((x, y) => y.pct - x.pct).slice(0, Math.floor(a.eletrizacoesMax));
      e.chocado = { ate: Math.max(...e.chocadosPilha.map((x) => x.ate)), pct: e.chocadosPilha.reduce((t, x) => t + x.pct, 0) };
      postos.push('eletrizado');
      return true;
    }
    const atual = e.chocado;
    // Vale a mais forte; não encurta a que já corre.
    if (pct > 0 && !(atual && atual.ate > agora && atual.pct >= pct)) {
      e.chocado = { ate, pct, dur: ate - agora };
      postos.push('eletrizado');
      return true;
    }
    return false;
  };
  // (+ "Efeito de Afecções não-Danificadoras infligidas por você com Golpes Críticos aumentado": o Resfriamento e a Eletrização do crítico)
  const efeitoDoCritico = crit ? a.efeitoNaoDanoCritico ?? 0 : 0;
  if (gelo > 0 || resfria > 0) {
    // Congelamento (chance ou crítico) e Resfriamento (sempre), pelas regras de controle do Draevor.
    // (14/10: a duração pela conta do PoE — `msDoCongelamento`; curta demais, não congela e, com o Juramento do Inverno, vira Geada)
    const tentou = gelo > 0 && (crit || sorte(chance('congelamento')));
    // ("Congela Inimigos como se causasse X% mais Dano": o Gelo da conta × (1 + X%))
    const congelarMs = tentou ? msDoCongelamento(gelo * (1 + (a.congelaComoMais ?? 0) / 100), limiar, (a.duracaoCongelamento ?? 0) + (a.duracao ?? 0) + geadasNo(bicho, agora) * GEADA.duracaoCongelamentoPct) : 0;
    const congela = congelarMs > 0;
    if (tentou && !congela && a.geada) {
      const e = (bicho.estados ??= {});
      e.geada = { n: geadasNo(bicho, agora) + 1, ate: agora + GEADA.duracaoMs };
      postos.push('geada');
    }
    // ("Seus Resfriamentos podem reduzir a Velocidade de Ação em até um máximo de X%"; "sempre reduzem … em ao menos X%")
    const maxResfria = a.resfriamentoMaximo > 0 ? a.resfriamentoMaximo : BASE.resfriamento.maximo;
    let lento = resfria > 0 ? comEfeito(forca(resfria * (1 + (a.resfriaComoMais ?? 0) / 100), limiar, { ...BASE.resfriamento, maximo: maxResfria }), (a.efeitoResfriamento ?? 0) + efeitoDoCritico, maxResfria) : 0;
    // (lote A5, dono 20/10) "X% mais Efeito de Resfriamento" (o Estalo Gélido): multiplica a força, no teto
    if (lento > 0 && a.efeitoResfriamentoMais) lento = Math.min(maxResfria, Math.round(lento * Math.max(0, 1 + a.efeitoResfriamentoMais / 100) * 10) / 10);
    if (resfria > 0 && a.resfriamentoMinimo > 0) lento = Math.min(maxResfria, Math.max(lento, a.resfriamentoMinimo));
    postos.push(...Estados.aplicar(bicho, {
      ...(congela ? { congelarChance: 100, congelarMs, ...(a.congelamentoMinimoMs > 0 ? { congelarMinimoMs: a.congelamentoMinimoMs } : {}), ...(a.resfriarAoDescongelar > 0 ? { resfriarAoDescongelar: a.resfriarAoDescongelar } : {}) } : {}),
      // (lote 76: + a "Duração de Afecções aumentada" — no PoE vale em todas, o Congelamento e o Resfriamento também)
      ...(lento ? { lentidaoPct: lento, lentidaoDuracaoPct: (a.duracaoResfriamento ?? 0) + (a.duracao ?? 0) } : {}),
    }, Math.max(gelo, resfria), agora, rng, salaDeBoss));
    const e = (bicho.estados ??= {});
    // ("Inimigos Resfriados pelos seus Acertos reduz o Dano causado pela metade do Efeito de Resfriamento" — `condicoes-poe.doBicho`)
    if (lento && a.resfriamentoReduzDano && e.lento) e.lento.reduzDano = true;
    // (lote A5, dono 20/10 — D5) o Resfriamento Ósseo: o Resfriamento deste acerto deixa o Gelo sofrido aumentado pelo efeito dele, enquanto durar
    // (`condicoes-poe.fatorRecebidoPeloBicho` — qualquer Gelo no inimigo, uma vez só)
    if (lento && a.resfriadoFragilGelo && e.lento?.ate > agora) e.fragilGelo = { ate: e.lento.ate };
    // (lote A5, dono 20/10 — D6) o Coursing Current: "Eletrifica inimigos quando eles são esfriados" — uma Eletrização com a força do Resfriamento deste acerto
    // (no teto dela, a duração base com os modificadores; sem a cascata: ela não Resfria de novo; não acontece se a gema não pode Eletrizar)
    if (lento && a.eletrizaAoResfriar && !a.naoPode?.eletrizacao && !a.semElementais) eletrizar(lento);
    // ("Inimigos sofrem permanentemente Dano aumentado em X% por cada segundo que passaram Congelados/Resfriados por você" — o tempo é contado
    // em `skills/estados.tique`, o dano a mais em `condicoes-poe.fatorRecebidoPeloBicho`)
    const p = a.permanente ?? {};
    if ((congela && p.congelado > 0) || (lento && p.resfriado > 0)) e.permanente = { ...(e.permanente ?? {}), ...(p.congelado > 0 ? { congelado: p.congelado, congeladoMax: p.congeladoMax } : {}), ...(p.resfriado > 0 ? { resfriado: p.resfriado, resfriadoMax: p.resfriadoMax } : {}) };
  }
  // ("Monstros não são Afetados por Eletrizações" — o mapa único A Praça Vinktar: `imuneChoque`.)
  if (raio > 0 && !bicho.imuneChoque && (crit || sorte(chance('eletrizacao')))) {
    // O máximo ("+X% ao Máximo de Efeito da Eletrização" ou "Efeito Máximo … é igual a X%"), o efeito (+ a Mana máxima aumentada e o do
    // crítico) e o mínimo ("sempre aumentam o Dano recebido em ao menos X%").
    let pct = comEfeito(forca(raio * (1 + (a.eletrizaComoMais ?? 0) / 100), limiar, { ...BASE.eletrizacao, maximo: maxEl }), (a.efeitoEletrizacao ?? 0) + (a.eletrizacaoDaMana ?? 0) + efeitoDoCritico, maxEl);
    if (a.eletrizacaoMinima > 0) pct = Math.min(maxEl, Math.max(pct, a.eletrizacaoMinima));
    // (lote A5, dono 20/10 — D6) o Coursing Current: "Esfria inimigos quando eles são eletrificados" — um Resfriamento com a força desta Eletrização, no teto
    // dele (sem a cascata; não acontece se a gema não pode Resfriar)
    if (eletrizar(pct) && a.resfriaAoEletrizar && !a.naoPode?.resfriamento && !a.semElementais) {
      const maxResfria = a.resfriamentoMaximo > 0 ? a.resfriamentoMaximo : BASE.resfriamento.maximo;
      const lento = Math.min(maxResfria, pct);
      postos.push(...Estados.aplicar(bicho, { lentidaoPct: lento, lentidaoDuracaoPct: (a.duracaoResfriamento ?? 0) + (a.duracao ?? 0) }, 1, agora, rng, salaDeBoss));
      if (a.resfriadoFragilGelo && bicho.estados?.lento?.ate > agora) bicho.estados.fragilGelo = { ate: bicho.estados.lento.ate };
    }
  }
  // ("Inimigos Incendiados ou Resfriados por você têm −X% de Resistências Elementais" — `hunt/resistencia.resistenciaDe`)
  if (a.resMenosFogoIncendiado > 0 && postos.includes('queimando')) (bicho.estados ??= {}).resMenosFogo = Math.max(bicho.estados.resMenosFogo ?? 0, a.resMenosFogoIncendiado);
  if (a.resMenosIncendiadoResfriado > 0 && (postos.includes('queimando') || (bicho.estados?.lento?.ate ?? 0) > agora)) {
    (bicho.estados ??= {}).resMenosElemental = Math.max(bicho.estados.resMenosElemental ?? 0, a.resMenosIncendiadoResfriado);
  }
  return [...new Set(postos)];
}
