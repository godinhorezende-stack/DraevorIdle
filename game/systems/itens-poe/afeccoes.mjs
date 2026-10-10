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
  // A afecção de DANO (incêndio, sangramento, veneno) posta por um golpe CRÍTICO causa 50% mais (a tela de personagem do PoE: o
  // "… from Critical Strikes" é 1,5× o do acerto). O "+X% ao Multiplicador de Crítico" não entra: o dano do golpe chega aqui sem o crítico.
  criticoMaisPct: 50,
};

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
    duracaoVeneno: n('poison_duration'),
    // PoE (07/10): o "Dano Degenerativo aumentado" (todas) e o de cada uma; a duração de cada uma e a das Elementais; o efeito do
    // Resfriamento e da Eletrização; "causam dano X% mais rápido"; "todo o dano pode Envenenar"; o dano a mais em quem está Mutilado.
    danoAumentado: n('dot_dmg_inc'),
    // (09/10) "Dano com Afecções aumentado" (a árvore: "Ataques com Machados causam Dano com Afecções aumentado"): só nas afecções de dano.
    danoComAfeccoes: n('ailment_dmg_inc'),
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
    // (09/10) "Sangramentos infligidos por você causam Dano X% mais rápido": o mesmo total em menos tempo.
    sangramentoMaisRapido: n('sangramento_mais_rapido'),
    // (09/10) "Golpes Críticos não Incendeiam de forma inerente" (a maestria de fogo).
    criticoNaoIncendeia: n('critico_nao_incendeia') > 0,
    // Os únicos: que dano pode pôr cada afecção ("Seu Dano de Raio pode Incendiar", "Seu Dano de Fogo pode Eletrizar, mas não Incendiar",
    // "Todo Dano pode Congelar"), quais não pode pôr ("Não Pode aplicar Incendiar"), as chances só no crítico, o "como se causasse X% mais
    // Dano", a duração do Resfriamento e os venenos a mais.
    pode: Object.fromEntries(['incendio', 'congelamento', 'resfriamento', 'eletrizacao', 'veneno', 'sangramento'].map((t) => [t, ['physical', 'fire', 'ice', 'energy', 'chaos'].filter((el) => n(`pode:${t}:${el}`) > 0)])),
    naoPode: Object.fromEntries(['incendio', 'congelamento', 'resfriamento', 'eletrizacao', 'veneno', 'sangramento'].map((t) => [t, n(`nao_pode:${t}`) > 0])),
    naoPodeEl: Object.fromEntries(['incendio', 'congelamento', 'resfriamento', 'eletrizacao'].map((t) => [t, ['physical', 'fire', 'ice', 'energy', 'chaos'].filter((el) => n(`nao_pode:${t}:${el}`) > 0)])),
    chanceCritico: { incendio: n('chance_ignite_critico'), sangramento: n('chance_bleed_critico'), veneno: n('chance_poison_critico'), congelamento: n('chance_freeze_critico'), eletrizacao: n('chance_shock_critico') },
    eletrizaComoMais: n('eletrizacao_como_mais'), resfriaComoMais: n('resfriamento_como_mais'), duracaoResfriamento: n('duracao_resfriamento') + n('duracao_afeccoes_elementais'),
    venenosExtras: n('venenos_extras'), semInerente: n('critico_sem_afeccao_inerente') > 0,
    // (09/10, as afecções do personagem nos monstros) a Eletrização: o máximo (+X, ou fixo — "Efeito Máximo da Eletrização é igual a X%"), o
    // mínimo ("sempre aumentam o Dano recebido em ao menos X%"), quantas por inimigo ("até N Eletrizações") e a parte da Mana máxima aumentada.
    eletrizacaoMaximo: n('eletrizacao_maximo'), eletrizacaoMaximoFixo: n('eletrizacao_maximo_fixo'), eletrizacaoMinima: n('eletrizacao_minima'),
    eletrizacoesMax: n('eletrizacoes_max'), eletrizacaoDaMana: (n('mana_inc') * n('eletrizacao_da_mana_pct')) / 100,
    // o Resfriamento: o mínimo, o máximo ("podem reduzir… até um máximo de X%") e o "reduz o Dano causado pela metade do Efeito"
    resfriamentoMinimo: n('resfriamento_minimo'), resfriamentoMaximo: n('resfriamento_maximo'), resfriamentoReduzDano: n('resfriamento_reduz_dano') > 0,
    // o crítico: o efeito das não danificadoras, o multiplicador degenerativo (de todas e do veneno), o "mais dano" do veneno; a Agonia Perfeita
    efeitoNaoDanoCritico: n('efeito_nao_dano_critico'), multiplicadorCritico: n('dot_multi_critico'), multiplicadorVenenoCritico: n('dot_multi_poison_critico'),
    venenoCriticoMais: n('veneno_critico_mais'), agoniaPerfeita: n('agonia_perfeita') > 0, semAfeccaoSemCritico: n('sem_afeccao_sem_critico') > 0,
    // o veneno em inimigo não envenenado / sangrando; o sangramento por empalamento, as pilhas (Dança Carmesim) e o "menos dano"
    venenoNaoEnvenenado: n('veneno_nao_envenenado_inc'), multiplicadorVenenoSangrando: n('dot_multi_poison_sangrando'),
    multiplicadorSangramentoPorEmpalamento: n('dot_multi_bleed_por_empalamento'), sangramentoPilhas: n('sangramento_pilhas'), sangramentoMenos: n('sangramento_menos'),
    // o Congelamento: o mínimo, o Resfriamento ao descongelar e o dano "permanente" por segundo Congelado/Resfriado
    congelamentoMinimoMs: n('congelamento_minimo_s') * 1000, resfriarAoDescongelar: n('resfriar_ao_descongelar'),
    permanente: { congelado: n('dano_perm_congelado'), congeladoMax: n('dano_perm_congelado_max'), resfriado: n('dano_perm_resfriado'), resfriadoMax: n('dano_perm_resfriado_max') },
    // as resistências a menos dos Incendiados/Resfriados e dos Envenenados por você (`hunt/resistencia.resistenciaDe`)
    // (o texto traz o "−": o valor chega negativo — vale o tamanho)
    resMenosIncendiadoResfriado: Math.abs(n('res_menos_incendiado_resfriado')), resMenosCaosEnvenenado: Math.abs(n('res_menos_caos_envenenado')),
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

/**
 * Depois de um acerto do jogador. `partes`: `[{ elemento, dano }]` (o dano de cada tipo no acerto, antes da resistência); `crit`: foi
 * crítico; `ataque`: é ataque (golpe da arma, habilidade de ataque) — as chances "com Ataques" só valem nele. `afeccoes`: o de `daSoma`
 * (a ficha guarda). Devolve os nomes dos estados postos (o evento na tela). Sem o sistema do PoE, não faz nada.
 */
export function aoAcertar(bicho, partes, { afeccoes, crit = false, ataque = false, agora = 0, rng = Math.random, salaDeBoss = false } = {}) {
  if (!ligado() || !bicho || bicho.hp <= 0 || bicho.dummy) return [];
  const a = afeccoes ?? daSoma();
  // "Golpes não Críticos não infligem Afecções" (a Agonia Perfeita).
  if (a.semAfeccaoSemCritico && !crit) return [];
  const dano = (el) => partes.filter((p) => p.elemento === el).reduce((s, p) => s + (Number(p.dano) || 0), 0);
  const chance = (tipo) => (a.chance[tipo] ?? 0) + (ataque ? a.chanceAtaque?.[tipo] ?? 0 : 0) + (crit ? a.chanceCritico?.[tipo] ?? 0 : 0);
  // O dano que conta para cada afecção: o tipo dela + os que um único libera, sem os que um único proíbe.
  const PADRAO = { incendio: ['fire'], congelamento: ['ice'], resfriamento: ['ice'], eletrizacao: ['energy'], sangramento: ['physical'] };
  const baseDe = (t) => (a.naoPode?.[t] ? 0 : [...new Set([...(PADRAO[t] ?? []), ...(a.pode?.[t] ?? [])])].filter((el) => !(a.naoPodeEl?.[t] ?? []).includes(el)).reduce((x, el) => x + (a.semElementais && ['fire', 'ice', 'energy'].includes(el) ? 0 : dano(el)), 0));
  // O crítico incendeia/congela/eletriza de forma inerente (como no PoE), salvo "Golpes Críticos não aplicam Afecções… de forma inerente".
  const doCritico = crit ? 1 + BASE.criticoMaisPct / 100 : 1;
  crit = crit && !a.semInerente;
  const sorte = (pct) => pct > 0 && rng() * 100 < pct;
  const postos = [];
  const duracaoDe = (base, extra = 0) => Math.round(base * (1 + ((a.duracao ?? 0) + extra) / 100));
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
  const dot = (tipo, porSegundo, duracaoMs, base, multiplicador, aumentado = 0, { mais = 0, chave = null } = {}) => {
    if (!(base > 0)) return null;
    const total = base * doCritico * porSegundo * (duracaoMs / 1000) * (1 + multiplicador / 100) * (1 + ((a.danoAumentado ?? 0) + (a.danoComAfeccoes ?? 0) + aumentado + mutilado) / 100) * Math.max(0, 1 + mais / 100);
    const rapido = Math.max(100, Math.round(duracaoMs / (1 + ((a.maisRapido ?? 0) + (tipo === 'queimadura' ? a.incendioMaisRapido ?? 0 : 0) + (tipo === 'sangramento' ? a.sangramentoMaisRapido ?? 0 : 0)) / 100)));
    const estado = Dot.aplicar(bicho, { tipo, total, duracaoMs: rapido, origem: { fonte: 'poe' }, ...(chave != null ? { chave } : {}) }, agora);
    if (estado) postos.push(estado);
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
  const fogo = baseDe('incendio');
  const fisico = baseDe('sangramento');
  const gelo = baseDe('congelamento');
  const resfria = baseDe('resfriamento');
  const raio = baseDe('eletrizacao');
  const caos = dano('chaos');
  // Incêndio: pela chance, ou crítico com dano de Fogo.
  if (fogo > 0 && ((crit && !a.criticoNaoIncendeia) || sorte(chance('incendio')))) {
    const posto = dot('queimadura', BASE.incendio.porSegundo, duracaoDe(BASE.incendio.duracaoMs, a.duracaoIncendio ?? 0), fogo, multiplicadorBase + a.multiplicadorFogo, a.danoIncendio ?? 0);
    // (o "ao Incendiar um Inimigo não Incendiado" — `mods-poe.aoPorAfeccoes` lê e apaga)
    if (posto && !jaIncendiado) (bicho.estados ??= {}).incendiadoNovo = true;
  }
  // (+ "+X% de Multiplicador … para Sangramentos por Empalamento no Inimigo"; a Dança Carmesim: as pilhas e o "X% menos Dano com Sangramento")
  if (fisico > 0 && sorte(chance('sangramento'))) dot('sangramento', BASE.sangramento.porSegundo, duracaoDe(BASE.sangramento.duracaoMs, a.duracaoSangramento ?? 0), fisico, multiplicadorBase + (a.multiplicadorSangramento ?? 0) + empalamentos * (a.multiplicadorSangramentoPorEmpalamento ?? 0), a.danoSangramento ?? 0, { mais: -(a.sangramentoMenos ?? 0), chave: chaveDoSangramento() });
  // Veneno: do dano Físico e de Caos (ou de TODO o dano, com "Todo o Dano … pode Envenenar").
  const todos = ['physical', 'fire', 'ice', 'energy', 'chaos'].reduce((x, el) => x + dano(el), 0);
  const baseDoVeneno = a.naoPode?.veneno ? 0 : a.qualquerDanoEnvenena ? todos : dano('physical') + caos + (a.pode?.veneno ?? []).filter((el) => !['physical', 'chaos'].includes(el)).reduce((x, el) => x + dano(el), 0);
  if (baseDoVeneno > 0 && sorte(chance('veneno'))) {
    // ("Inflige N envenenamentos adicionais": mais pilhas do mesmo veneno.)
    // (+ "em Inimigos não-Envenenados causam Dano aumentado", "+X% … por Envenenamento infligido por você em Inimigos Sangrando", o do
    // crítico — multiplicador e "X% mais Dano")
    const multVeneno = multiplicadorBase + a.multiplicadorVeneno + (sangrando ? a.multiplicadorVenenoSangrando ?? 0 : 0) + (crit ? a.multiplicadorVenenoCritico ?? 0 : 0);
    const aumVeneno = (a.danoVeneno ?? 0) + (jaEnvenenado ? 0 : a.venenoNaoEnvenenado ?? 0);
    for (let k = 0; k <= Math.max(0, Math.floor(a.venenosExtras ?? 0)); k++) dot('venenoPoe', BASE.veneno.porSegundo, duracaoDe(BASE.veneno.duracaoMs, a.duracaoVeneno), baseDoVeneno, multVeneno, aumVeneno, { mais: crit ? a.venenoCriticoMais ?? 0 : 0 });
    // ("Inimigos Envenenados por você têm −X% de Resistência a Caos" — `hunt/resistencia.resistenciaDe`)
    if (a.resMenosCaosEnvenenado > 0) (bicho.estados ??= {}).resMenosCaos = Math.max(bicho.estados.resMenosCaos ?? 0, a.resMenosCaosEnvenenado);
  }
  const limiar = bicho.maxHp ?? bicho.hp;
  // (+ "Efeito de Afecções não-Danificadoras infligidas por você com Golpes Críticos aumentado": o Resfriamento e a Eletrização do crítico)
  const efeitoDoCritico = crit ? a.efeitoNaoDanoCritico ?? 0 : 0;
  if (gelo > 0 || resfria > 0) {
    // Congelamento (chance ou crítico) e Resfriamento (sempre), pelas regras de controle do Draevor.
    const congela = gelo > 0 && (crit || sorte(chance('congelamento')));
    // ("Seus Resfriamentos podem reduzir a Velocidade de Ação em até um máximo de X%"; "sempre reduzem … em ao menos X%")
    const maxResfria = a.resfriamentoMaximo > 0 ? a.resfriamentoMaximo : BASE.resfriamento.maximo;
    let lento = resfria > 0 ? comEfeito(forca(resfria * (1 + (a.resfriaComoMais ?? 0) / 100), limiar, { ...BASE.resfriamento, maximo: maxResfria }), (a.efeitoResfriamento ?? 0) + efeitoDoCritico, maxResfria) : 0;
    if (resfria > 0 && a.resfriamentoMinimo > 0) lento = Math.min(maxResfria, Math.max(lento, a.resfriamentoMinimo));
    postos.push(...Estados.aplicar(bicho, {
      ...(congela ? { congelarChance: 100, congelarDuracaoPct: a.duracaoCongelamento ?? 0, ...(a.congelamentoMinimoMs > 0 ? { congelarMinimoMs: a.congelamentoMinimoMs } : {}), ...(a.resfriarAoDescongelar > 0 ? { resfriarAoDescongelar: a.resfriarAoDescongelar } : {}) } : {}),
      ...(lento ? { lentidaoPct: lento, lentidaoDuracaoPct: a.duracaoResfriamento ?? 0 } : {}),
    }, Math.max(gelo, resfria), agora, rng, salaDeBoss));
    const e = (bicho.estados ??= {});
    // ("Inimigos Resfriados pelos seus Acertos reduz o Dano causado pela metade do Efeito de Resfriamento" — `condicoes-poe.doBicho`)
    if (lento && a.resfriamentoReduzDano && e.lento) e.lento.reduzDano = true;
    // ("Inimigos sofrem permanentemente Dano aumentado em X% por cada segundo que passaram Congelados/Resfriados por você" — o tempo é contado
    // em `skills/estados.tique`, o dano a mais em `condicoes-poe.fatorRecebidoPeloBicho`)
    const p = a.permanente ?? {};
    if ((congela && p.congelado > 0) || (lento && p.resfriado > 0)) e.permanente = { ...(e.permanente ?? {}), ...(p.congelado > 0 ? { congelado: p.congelado, congeladoMax: p.congeladoMax } : {}), ...(p.resfriado > 0 ? { resfriado: p.resfriado, resfriadoMax: p.resfriadoMax } : {}) };
  }
  // ("Monstros não são Afetados por Eletrizações" — o mapa único A Praça Vinktar: `imuneChoque`.)
  if (raio > 0 && !bicho.imuneChoque && (crit || sorte(chance('eletrizacao')))) {
    // O máximo ("+X% ao Máximo de Efeito da Eletrização" ou "Efeito Máximo … é igual a X%"), o efeito (+ a Mana máxima aumentada e o do
    // crítico) e o mínimo ("sempre aumentam o Dano recebido em ao menos X%").
    const maxEl = a.eletrizacaoMaximoFixo > 0 ? a.eletrizacaoMaximoFixo : BASE.eletrizacao.maximo + (a.eletrizacaoMaximo ?? 0);
    let pct = comEfeito(forca(raio * (1 + (a.eletrizaComoMais ?? 0) / 100), limiar, { ...BASE.eletrizacao, maximo: maxEl }), (a.efeitoEletrizacao ?? 0) + (a.eletrizacaoDaMana ?? 0) + efeitoDoCritico, maxEl);
    if (a.eletrizacaoMinima > 0) pct = Math.min(maxEl, Math.max(pct, a.eletrizacaoMinima));
    const e = (bicho.estados ??= {});
    const ate = agora + duracaoDe(BASE.eletrizacao.duracaoMs, a.duracaoEletrizacao ?? 0);
    if (pct > 0 && a.eletrizacoesMax > 1) {
      // "Você pode aplicar até N Eletrizações em cada Inimigo": a pilha (as N mais fortes ativas) — o dano a mais é a soma.
      const pilha = (e.chocadosPilha ?? []).filter((x) => x.ate > agora);
      pilha.push({ ate, pct });
      e.chocadosPilha = pilha.sort((x, y) => y.pct - x.pct).slice(0, Math.floor(a.eletrizacoesMax));
      e.chocado = { ate: Math.max(...e.chocadosPilha.map((x) => x.ate)), pct: e.chocadosPilha.reduce((t, x) => t + x.pct, 0) };
      postos.push('eletrizado');
    } else {
      const atual = e.chocado;
      // Vale a mais forte; não encurta a que já corre.
      if (pct > 0 && !(atual && atual.ate > agora && atual.pct >= pct)) {
        e.chocado = { ate, pct };
        postos.push('eletrizado');
      }
    }
  }
  // ("Inimigos Incendiados ou Resfriados por você têm −X% de Resistências Elementais" — `hunt/resistencia.resistenciaDe`)
  if (a.resMenosIncendiadoResfriado > 0 && (postos.includes('queimando') || (bicho.estados?.lento?.ate ?? 0) > agora)) {
    (bicho.estados ??= {}).resMenosElemental = Math.max(bicho.estados.resMenosElemental ?? 0, a.resMenosIncendiadoResfriado);
  }
  return [...new Set(postos)];
}
