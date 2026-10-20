// As GEMAS DO PoE dentro do JOGO (dono, 06/10: "as gemas do PoE substituem as do Draevor, mas tenta conciliar os efeitos nas magias").
// Só com ITENS_POE=1 e a coleção do dono baixada (`poe-gemas-poedb`, ver `admin/gemas-poe.mjs`).
//
//   O INTERPRETADOR é o da Arena de Gemas do dono (`engine/src/gemas/compilador.mjs`, puro: roda no Node): a gema no nível N vira os
//   números do PoE — dano por elemento, custo, tempo de uso, recarga, eficácia (ataques), crítico, raio, chances, buffs e maldições.
//
//   O MOLDE é uma magia do Draevor do mesmo FORMATO e ELEMENTO (é o "conciliar os efeitos"): o projétil de fogo do Flame Strike, a área no
//   chão do Great Fireball, a onda do Ice Wave, o feixe do Energy Beam, o golpe do Brutal Strike, a corrente do Forked Glacier... A gema do
//   PoE ganha a magia dela no catálogo de ações (`poe-gema:<slug>`) com a forma, o efeito visual e o projétil do molde, e os números do PoE.
//   As auras, arautos, guardas, gritos e maldições viram REFORÇOS (o sistema de buffs do Draevor): os efeitos calculados no nível da gema
//   de quem lançou, guardados no próprio buff, e os atributos deles (armadura, resistências, dano adicionado...) somados na ficha (`adds`).
//
//   O STATUS NO JOGO de cada gema (funciona / parcial / não, com os motivos) diz o que o combate do Draevor faz dela — separado do status
//   da Arena do dono. Lacaios e totens ainda não existem no jogo (o Draevor tem só o familiar): a gema existe, mas a skill avisa.
//
// No modo PoE, estas gemas SUBSTITUEM as gemas ativas do Draevor (drop, loja, iniciais); os SUPORTES do Draevor seguem valendo nelas
// (pelas tags). Sem o PoE nada disto roda.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { ligado } from './catalogo.mjs';
import { slugDoNome, partir, condicoesDe, vale, somarOrigem } from './condicoes-poe.mjs';
import { comNiveisDoPoedb } from './gemas-niveis.mjs';
import * as Vinculos from './vinculos.mjs';
import { ehLinhaDoAco } from './convocar-o-aco.mjs';
import { ehLinhaLocalDaGema, atributosDasLinhas, atributosDoBuff, ehLinhaDoBuff } from './linhas-das-gemas.mjs';
import { ACTION_CATALOG } from '../dados.mjs';
import { DESLOCAMENTO, deslocamentoDasLinhas, ehLinhaDoDeslocamento } from './deslocamento.mjs';
import * as GemasA2 from './gemas-a2.mjs';
import * as GemasA4 from './gemas-a4.mjs';
import * as GemasA3b from './gemas-a3b.mjs';
// (lote A1b, dono 19/10: a Investida Carregada e o resto das gemas de movimento — os dados e as contas puras)
import * as GemasA1b from './movimento-a1b.mjs';
// (lote A5, dono 20/10: os leitores das linhas das famílias 1–4 — o Condutor Elétrico, a Exposição da gema, o Solo Resfriado, a arma)
import * as GemasA5 from './gemas-a5.mjs';
// (lote B1, dono 20/10: os leitores das gemas de área, nova, chuva e orbe que reusam o que já existe — a Descarga, os Estalos Gélidos, as Bombas…)
import * as GemasB1 from './gemas-b1.mjs';
// (lote PR1, dono 20/10: as gemas ativas de projétil que reusam o que já existe — o Sifão de Poder, as estilhas do Arremesso de Escudo Espectral, a Galvânica)
import * as GemasPR1 from './gemas-pr1.mjs';

// As gemas (`game/tools/importar-gemas-poe.mjs`, da coleção do dono) e o interpretador delas (`compilador-de-gemas/`): no repositório.
const ARQ_GEMAS = new URL('../../gamedata/itens-poe/gemas-poe.json', import.meta.url);
// (09/10) O ÍCONE DA HABILIDADE de cada gema (o que vai na barra de slots, como no PoE — "SkillIcons/iconcleave"; o da gema é o do item):
// `slug → arquivo` em `gamedata/itens-poe/icones-habilidades/` (tools/importar-poedb-gemas.mjs, das páginas do poedb).
const ARQ_ICONES_DAS_HABILIDADES = new URL('../../gamedata/itens-poe/icones-habilidades.json', import.meta.url);
let ICONES_DAS_HABILIDADES = null;
const iconeDaHabilidade = (slug) => {
  ICONES_DAS_HABILIDADES ??= existsSync(ARQ_ICONES_DAS_HABILIDADES) ? JSON.parse(readFileSync(ARQ_ICONES_DAS_HABILIDADES, 'utf8')).icones ?? {} : {};
  return ICONES_DAS_HABILIDADES[slug] ?? null;
};
const ARQ_IDS = new URL('../../gamedata/itens-poe/gemas-poe-ids.json', import.meta.url);
export const PREFIXO = 'poe-gema:';
// 916001 (não 912001: a Lapidadora, a Fundidora e os orbes do Draevor são 912001–912004).
const PRIMEIRO_ID = 916001;

/** O elemento do PoE (o da arena) → o do Draevor. O caos do PoE fica `chaos` (a resistência a caos já existe; o desenho é o de morte). */
export const ELEMENTO = { fisico: 'physical', fogo: 'fire', gelo: 'ice', raio: 'energy', caos: 'chaos' };
const VISUAL = { physical: 'physical', fire: 'fire', ice: 'ice', energy: 'energy', chaos: 'death' };

// ---- os MOLDES (id da magia do Draevor) por formato e elemento ----
const MOLDES = {
  projetil: { fire: 'spell-flame-strike', ice: 'spell-ice-strike', energy: 'spell-energy-strike', physical: 'spell-ethereal-spear', death: 'spell-death-strike' },
  chao: { fire: 'rune-great-fireball-rune', ice: 'rune-avalanche-rune', energy: 'rune-thunderstorm-rune', physical: 'spell-ethereal-barrage', death: 'spell-death-echo' },
  // A nova pega em VOLTA, cheia (a "Ice Burst" do Draevor é um anel de 2 a 4 casas, oco no meio: a Nova de Gelo não pegava quem estava
  // colado). A de gelo usa a forma cheia da de fogo; a cor é a do gelo (o efeito do elemento entra por cima).
  nova: { fire: 'spell-hell-s-core', ice: 'spell-hell-s-core', energy: 'spell-rage-of-the-skies', physical: 'spell-groundshaker', death: 'spell-wrath-of-nature' },
  onda: { fire: 'spell-fire-wave', ice: 'spell-ice-wave', energy: 'spell-energy-wave', physical: 'spell-front-sweep', death: 'spell-terra-wave' },
  feixe: { fire: 'spell-fire-wave', ice: 'spell-ice-wave', energy: 'spell-energy-beam', physical: 'spell-front-sweep', death: 'spell-great-death-beam' },
  cadeia: { ice: 'spell-forked-glacier', fire: 'spell-forked-thorns', energy: 'spell-forked-thorns', physical: 'spell-forked-thorns', death: 'spell-forked-thorns' },
};
/** O formato de cada arquétipo da arena (o `carga` dos objetos: armadilha e mina valem pelo que soltam). */
const FORMATO = { projetil: 'projetil', area: 'chao', chuva: 'chao', orbe: 'chao', marca: 'chao', armadilha: 'chao', mina: 'chao', nova: 'nova', impacto: 'onda', canalizacao: 'feixe', ricochete: 'cadeia' };
/** (17/10, lote G10) O formato de gemas que o arquétipo erra: a Rajada de Chamas canaliza uma EXPLOSÃO no lugar mirado (não o feixe). */
const FORMATO_PROPRIO = { Flameblast: 'chao' };
const BUFF = new Set(['aura', 'arauto', 'guarda', 'clamor', 'maldicao']);
const SEM_NO_JOGO = { generico: 'a gema não tem comportamento de combate reconhecido' };
/**
 * (14/10, a árvore principal) As gemas com comportamento próprio, que o classificador da arena não conhece: o INFESTADOR (Plague Bearer —
 * `acoes.tiqueDaPraga`) e o FEITICEIRO (Spellslinger — a reserva em `reserva.pedida`, o gatilho em `acoes.ativarGatilhos`).
 */
// (lote 75 — dono, 17/10: "No máximo, como o PoB") o Arauto da Agonia é um ARAUTO (o buff com reserva; o Rastejador vem ao Envenenar — `acoes.
// tiqueDoArautoDaAgonia`): o classificador vê o tipo Minion antes de Herald. (O Arauto da Pureza fica como lacaio.)
// (lote A1, dono 19/10 — D7) a Corrida de Fase Antiga e o Passo Definhante NÃO deslocam no PoE: são BUFFS (a descrição não fala em teleporte) — a
// guarda, com o que o jogo já tem (a velocidade de movimento, o Elusivo, o Definhar de quem está na área)
// (lote A2, dono 19/10) as gemas "sem efeito" que o PoB chama de BUFF (SkillType.Buff) e o poedb trouxe sem tipo: a guarda — o buff ligado no uso (a
// reserva, quando a gema reserva — `reserva.pedida`) — com a mecânica própria de cada uma (`itens-poe/gemas-a2.mjs`). O Emblema do Poder, o Escudo
// Gélido e a Parede de Força também: o uso põe o objeto no chão e liga o buff enquanto ele dura.
const DO_LOTE_A2 = ['Blood_Rage', 'Berserk', 'Petrified_Blood', 'Temporal_Rift', 'Automation', 'Energy_Blade', 'Frost_Shield', 'Mana-Infused_Staff', 'Sigil_of_Power', 'Wall_of_Force'];
const ARQUETIPO_PROPRIO = { Plague_Bearer: 'praga', Spellslinger: 'feiticeiro', Herald_of_Agony: 'arauto', Old_Phase_Run: 'guarda', Withering_Step: 'guarda', ...Object.fromEntries(DO_LOTE_A2.map((s) => [s, 'guarda'])) };
/**
 * (lote A2, dono 19/10: "o Portal passa a não se aplica") A gema que NÃO SE APLICA ao jogo, com a nota do porquê — o relatório a mostra assim
 * (`tools/relatorio-gemas-poe.mjs`). Ela segue sem efeito (a skill avisa — `poeGema.bloqueio`).
 */
export const NAO_SE_APLICA = {
  Portal: 'não se aplica: a caçada já tem a saída para a cidade, e os 6 portais do mapa são gastos pela morte (mapa-aberto.mjs) — o portal do PoE não tem o que fazer no jogo',
};
/**
 * (lote A2, dono 19/10) As LINHAS das gemas do lote A2 que o jogo faz: `[regex, (m, x) => void]` — `x.af` (os atributos do buff, na ficha enquanto
 * ele está ligado) e `x.a2` (os números da mecânica própria, guardados no buff — `itens-poe/gemas-a2.mjs`). Os números são os do nível (e da
 * qualidade, quando a linha é dela).
 */
const n = (x) => Number(String(x).replace(',', '.'));
const LINHAS_A2 = {
  // (Fúria Sangrenta — PoB act_dex.lua:3305-3397: a Velocidade de Ataque, o dreno do físico de ataque, a perda de 4%/s da Vida e do ES, a Carga de
  // Frenesi ao matar; o "matar renova a duração" está na descrição — `GemasA2.aoMatar`)
  Blood_Rage: [
    [/^Concede Velocidade de Ataque aumentada em ([\d.]+) ?%$/i, (m, x) => { x.af.atk_speed = (x.af.atk_speed ?? 0) + n(m[1]); }],
    [/^([\d.]+) ?% do Dano de Ataques Físicos Drenado como Vida$/i, (m, x) => { x.af.life_leech_fisico_ataque = (x.af.life_leech_fisico_ataque ?? 0) + n(m[1]); }],
    [/^Você sofre ([\d.]+) ?% da sua Vida Máxima por segundo como Dano Físico$/i, (m, x) => { x.af.perde_vida_pct_s = (x.af.perde_vida_pct_s ?? 0) + n(m[1]); }],
    [/^Você sofre ([\d.]+) ?% do seu Escudo de Energia Máximo por segundo como Dano Físico$/i, (m, x) => { x.af.perde_es_pct_s = (x.af.perde_es_pct_s ?? 0) + n(m[1]); }],
    [/^([\d.]+) ?% de chance de ganhar uma Carga de Frenesi ao Matar$/i, (m, x) => { x.af.carga_frenesi_ao_matar = (x.af.carga_frenesi_ao_matar ?? 0) + n(m[1]); }],
  ],
  // (Berserk — act_str.lua:934-1006: o Efeito da Fúria; o mínimo para entrar, a perda e a aceleração dela, a recarga parada durante o efeito)
  Berserk: [
    [/^Efeito da Fúria aumentado em ([\d.]+) ?%$/i, (m, x) => { x.af.efeito_furia = (x.af.efeito_furia ?? 0) + n(m[1]); }],
    [/^Perde ([\d.]+) de Fúria por segundo$/i, (m, x) => { x.a2.perdaPorS = n(m[1]); }],
    [/^Ao menos ([\d.]+) de Fúria necessário para entrar em Berserk$/i, (m, x) => { x.a2.furiaMin = n(m[1]); }],
    [/^A ?cada segundo ([\d.]+) ?% mais Fúria perdida$/i, (m, x) => { x.a2.aceleraPct = n(m[1]); }],
  ],
  // (Sangue Petrificado — act_str.lua:8538-8596: a perda impedida abaixo da metade, o teto da Vida em Vida Baixa e o custo de Vida acima dela; a
  // qualidade tira 0,25 ponto por % da parte perdida no tempo — a linha do poedb vem com a faixa invertida, "(-5 — 0)": vale o PoB)
  Petrified_Blood: [
    [/Quando sofrer Dano de Acertos, ([\d.]+) ?% da Vida perdida abaixo da metade da Vida é Impedida, então ([\d.]+) ?% da Vida \S+ impedida desta forma é perdida durante ([\d.]+) segundos?$/i, (m, x) => { x.a2.impedePct = n(m[1]); x.a2.perdePct = n(m[2]); x.a2.duranteMs = Math.round(n(m[3]) * 1000); x.a2.tetoVidaBaixa = true; }],
    [/^Habilidades ganham Custo de Vida Base igual a ([\d.]+) ?% do Custo de Mana Base enquanto não estiver em Vida Baixa$/i, (m, x) => { x.a2.custoVidaPct = n(m[1]); }],
    [/^\(?-?[\d.]+(?: — [\d.]+\))? ?% da Vida \S+ impedida desta forma é perdida durante [\d.]+ segundos$/i, (m, x) => { x.a2.qualidadeMenosPct = 0.25 * (x.q ?? 0); }],
  ],
  // (Fenda Temporal — act_dex.lua:17756-17827: a imunidade a Grilhões Temporais e os Debuffs da qualidade; a volta — `GemasA2.tiqueDaFenda`)
  Temporal_Rift: [
    [/^Buff te torna Inafetável por Grilhões Temporais$/i, (m, x) => { x.af.imune_grilhoes_temporais = 1; }],
    [/^Buff faz com que Debuffs em você expirem ([\d.]+) ?% mais rápido$/i, (m, x) => { x.af.debuffs_expiram_rapido = (x.af.debuffs_expiram_rapido ?? 0) + n(m[1]); }],
  ],
  // (Automação — act_int.lua:417-472: a Recuperação da Recarga das suportadas; o disparo — `Gemas.gruposComGatilho`, `Acoes.ativarGatilhos`)
  Automation: [
    // (revisão do A2: o valor com sinal — "reduzida" negativo, "aumentada" positivo — + a qualidade, que o poedb não trouxe: o PoB dá
    // base_cooldown_speed_+% 0,25 por ponto)
    [/^Habilidades Suportadas têm Velocidade de Recuperação da Recarga (reduzida|aumentada) em ([\d.]+) ?%$/i, (m, x) => { x.a2.recuperacaoPct = (m[1].toLowerCase() === 'reduzida' ? -1 : 1) * n(m[2]) + 0.25 * (x.q ?? 0); }],
  ],
  // (Lâmina de Energia — act_int.lua:5072-5169: a linha em pt chega EMBARALHADA — vale o PoB: o Raio mínimo = 2% do ES + o fixo do nível, o máximo =
  // 40% do ES + o fixo do nível; 50% menos ES máximo; 70% mais dano com duas mãos; a qualidade dá velocidade de ataque "mais")
  Energy_Blade: [
    [/^Lâminas de Energia têm Dano de Raio mínimo igual a ([\d.]+) ?% do Escudo de Energia, mais ([\d.]+) Lâminas de Energia têm Dano de Raio máximo igual a ([\d.]+) ?% do Escudo de Energia, mais ([\d.]+)$/i,
      // (as colunas trocadas: o 1º par é o FIXO do nível — mínimo e máximo; o 2º, as % do ES — 2 e 40, constantes no PoB)
      (m, x) => { x.a2.minFixo = n(m[1]); x.a2.maxFixo = n(m[2]); x.a2.minPctEs = n(m[3]); x.a2.maxPctEs = n(m[4]); }],
    [/^Lâminas de Energia de Duas Mãos têm ([\d.]+) ?% mais Dano de Raio$/i, (m, x) => { x.a2.duasMaosMaisPct = n(m[1]); }],
    [/^Buff concede ([\d.]+) ?% menos Escudo de Energia Máximo$/i, (m, x) => { x.af.es_mais = (x.af.es_mais ?? 0) - n(m[1]); }],
    [/^Bônus concede velocidade de ataque aumentada em ([\d.]+) ?%$/i, (m, x) => { x.a2.velAtaqueMaisPct = n(m[1]); x.af.atk_speed_mais = (x.af.atk_speed_mais ?? 0) + n(m[1]); }],
  ],
  // (Escudo Gélido — act_int.lua:8014-8109: o globo no chão — `GemasA2.porEscudoGelido`)
  Frost_Shield: [
    [/^([\d.]+) ?% do Dano causado à você ou Aliados na Área com Acertos de Inimigos na Área é sofrido na Vida do Escudo Gélido/i, (m, x) => { x.a2.dentroPct = n(m[1]); }],
    [/^([\d.]+) ?% do Dano causado à você ou Aliados na Área com Acertos de Inimigos fora da Área é sofrido na Vida do Escudo Gélido/i, (m, x) => { x.a2.foraPct = n(m[1]); }],
    [/^Você ganha \+?([\d.]+) ?% de Chance de Golpe Crítico Mágico por Estágio enquanto na Área$/i, (m, x) => { x.a2.critPorEstagio = n(m[1]); }],
    [/^Escudo Gélido tem ([\d.]+) de Vida máxima por Estágio$/i, (m, x) => { x.a2.vidaPorEstagio = n(m[1]); }],
    [/^Máximo de ([\d.]+) Estágios$/i, (m, x) => { x.a2.estagiosMax = n(m[1]); }],
    [/^Ganha 1 Estágio a cada ([\d.]+) segundos? enquanto você estiver perdendo Escudo de Energia$/i, (m, x) => { x.a2.estagioMs = Math.round(n(m[1]) * 1000); }],
    [/^Você perde ([\d.]+) de Escudo de Energia por segundo$/i, (m, x) => { x.a2.esPorS = n(m[1]); }],
    [/^Efeito de Afecções de Gelo aumentado em ([\d.]+) ?%$/i, (m, x) => { x.a2.efeitoGeloPct = n(m[1]); }],
  ],
  // (Cajado Impregnado de Mana — act_int.lua:13426-13516: a reserva de 30% sem modificador, o custo de mana "mais", o bloqueio "mais" — o pt diz
  // "+24%", o PoB é `BlockChance MORE` —, a Onda Arcana ao bloquear com 73% da mana máxima)
  'Mana-Infused_Staff': [
    [/^Reserva de mana desta habilidade é sempre ([\d.]+) ?%$/i, (m, x) => { x.a2.reservaFixaPct = n(m[1]); }],
    [/^Causa dano elétrico base equivalente a ([\d.]+) ?% do mana máximo$/i, (m, x) => { x.a2.ondaPctMana = n(m[1]); }],
    [/^Libera uma Onda Arcana ao bloquear, limitado a uma vez a cada ([\d.]+ )?segundos?$/i, (m, x) => { x.a2.ondaCadaMs = Math.round(n(m[1] ?? 1) * 1000); }],
    [/^Bônus concede - ?([\d.]+) ?% de custo de mana das habilidades$/i, (m, x) => { x.af.custo_mana_mais = (x.af.custo_mana_mais ?? 0) - n(m[1]); }],
    [/^Bônus concede \+ ?([\d.]+) ?% de chance de bloquear dano de ataque e mágico$/i, (m, x) => { x.af.bloqueio_mais = (x.af.bloqueio_mais ?? 0) + n(m[1]); }],
  ],
  // (Emblema do Poder — act_int.lua:16091-16190: o emblema no chão, os estágios pela mana gasta nele, o Raio por estágio e o "menos dano" dos inimigos)
  Sigil_of_Power: [
    [/^Ganha um Estágio quando você Gastar um total de ([\d.]+) Mana enquanto na Área$/i, (m, x) => { x.a2.manaPorEstagio = n(m[1]); }],
    [/^Inimigos na Área causam \+?([\d.]+) ?% menos [Dd]ano enquanto no máximo de Estágios$/i, (m, x) => { x.a2.menosDanoPct = (x.a2.menosDanoPct ?? 0) + n(m[1]); }],
    [/^Máximo de ([\d.]+) Estágios$/i, (m, x) => { x.a2.estagiosMax = n(m[1]); }],
    [/^Buff concede ([\d.]+) a ([\d.]+) de Dano de Raio Adicional por Estágio$/i, (m, x) => { x.a2.raioPorEstagio = [n(m[1]), n(m[2])]; }],
    [/^Mínimo de ([\d.]+) segundos? entre Estágios$/i, (m, x) => { x.a2.entreEstagiosMs = Math.round(n(m[1]) * 1000); }],
  ],
  // (Parede de Força — act_int.lua:20715-20784, simplificada pelo dono: a parede entre você e o alvo; o projétil que a cruza ganha +1 ricochete com
  // −20% de dano, até 17 colisões)
  Wall_of_Force: [
    [/^Parede terá ([\d.]+) metros$/i, (m, x) => { x.a2.comprimentoM = n(m[1]); }],
    [/^Projéteis não se dividem, não perfuram e não se ramificam ao colidir com a parede/i, (m, x) => { x.a2.ricochetes = 1; }],
    [/^Projéteis que colidiram com a parede causam - ?([\d.]+) ?% de dano$/i, (m, x) => { x.a2.menosDanoPct = n(m[1]); }],
    [/^Parede é destruída após ([\d.]+) colisões de projétil$/i, (m, x) => { x.a2.colisoes = n(m[1]); }],
  ],
};
/** (lote A2) A linha da gema do lote A2 que o jogo faz. */
export const ehLinhaA2 = (slug, l) => !!LINHAS_A2[slug]?.some(([re]) => re.test(String(l)));
/** (lote A2) Os atributos e os números da mecânica de uma gema do lote A2 no nível e na qualidade: `{ af, a2 }` (vazios fora do lote). */
/**
 * (lote A5, dono 20/10 — D2: "a qualidade acima de 20 pelo suporte, linear") A qualidade nas CONTAS da gema: inteira, sem o teto de 20 — o Aprimorar, o
 * Aprimorar Desperto e o Eclipse ("+X% de Qualidade das Gemas de Habilidade Suportadas" — o PoB supported_active_skill_gem_quality_%, other.lua:1559) passam
 * dele; as linhas da qualidade crescem na fração q/20 (36% = 1,8 × as de 20%). A qualidade da PEÇA (a gema, a Lapidadora) segue até 20 (`Gemas.qualidadeDaGema`).
 */
const qualidadeDasContas = (qualidade) => Math.max(0, Math.round(Number(qualidade) || 0));
const A2_CACHE = new Map();
export function daGemaA2(slug, nivel = 1, qualidade = 0) {
  const regras = LINHAS_A2[slug];
  if (!regras) return { af: {}, a2: {} };
  const q = qualidadeDasContas(qualidade);
  const k = `${slug}@${nivel | 0}@${q}`;
  if (A2_CACHE.has(k)) return A2_CACHE.get(k);
  const x = { af: {}, a2: {}, q };
  for (const l of [...textosDaGema(slug, nivel).linhas, ...linhasDaQualidadeDe(slug, q)]) for (const [re, f] of regras) { const m = re.exec(String(l)); if (m) f(m, x); }
  delete x.q;
  A2_CACHE.set(k, x);
  return x;
}
/**
 * O INFESTADOR do PoE (RePoE, `corrosive_shroud_*`): o Valor Máximo da Praga por nível (`MAX_DA_PRAGA[n]`, do 1 ao 40), 40% do Dano Esperado
 * de cada Veneno infligido enquanto Incubando, 20% menos Dano com Veneno enquanto Incubando (fora do máximo), Infestando 12% do Valor do início
 * por segundo (+0,2% por qualidade); recarga 0,5 s. O raio da Infestação, que o PoE não publica: 2 casas.
 */
export const PRAGA = Object.freeze({ ganhoPct: 40, menosVenenoPct: 20, porSegundoPct: 12, qualidadePorPonto: 0.2, recargaMs: 500, raio: 2 });
const MAX_DA_PRAGA = [0, 4000, 5903, 8655, 12616, 18299, 26429, 38027, 54530, 77962, 98791, 125046, 158112, 199725, 252058, 317825, 400423, 504097, 634145, 797189, 1000000,
  1100000, 1180000, 1245000, 1300000, 1350000, 1400000, 1450000, 1500000, 1550000, 1600000, 1650000, 1700000, 1750000, 1800000, 1850000, 1900000, 1950000, 2000000, 2050000, 2100000];
export const maxDaPraga = (nivel) => MAX_DA_PRAGA[Math.max(1, Math.min(40, Math.floor(Number(nivel) || 1)))];
/**
 * O FEITICEIRO do PoE no nível (as linhas da gema): `pct` — "Habilidades Suportadas têm Dano Mágico Adicional igual a X% do Dano da Varinha
 * Equipada"; `menos` — "causam X% menos Dano com Acertos e Afecções"; `recuperacao` — "Velocidade de Recuperação da Recarga aumentada em X%"
 * (a recarga do gatilho, 0,6 s); `reservaPct` — cada magia suportada reserva 20% da mana (RePoE: `mana_percent`).
 */
export const FEITICEIRO = Object.freeze({ recargaMs: 600, reservaPct: 20 });
export function feiticeiroNoNivel(nivel = 1) {
  const linhas = textosDaGema('Spellslinger', nivel).linhas;
  const achar = (re) => { for (const l of linhas) { const m = re.exec(l); if (m) return Number(m[1]); } return 0; };
  const recuperacao = achar(/Recuperação da Recarga aumentada em (\d+(?:\.\d+)?) ?%/);
  return {
    pct: achar(/Dano Mágico Adicional igual a (\d+(?:\.\d+)?) ?% do Dano da Varinha/), menos: achar(/causam (\d+(?:\.\d+)?) ?% menos Dano/), recuperacao,
    recargaMs: Math.round(FEITICEIRO.recargaMs / (1 + recuperacao / 100)),
  };
}
/**
 * (18/10, lote G20a) O TOTEM: as linhas que o sistema do totem consome (`LacaiosPoe.oQueInvoca`, `Acoes.temposDaGemaPoe`) — a duração, o "Invoca um
 * Totem", o máximo, a vida, a velocidade de posicionamento e o alcance corpo a corpo do totem ancestral (`Acoes.alcanceDoTotem`). As do uso valem pelo
 * caminho do seu uso (`Acoes.usarComoTotem`).
 */
const LINHA_DO_TOTEM = /^Totem dura [\d.]+ segundos?$|^Invoca um Totem(?: de Balista)? que usa esta habilidade$|^\+[\d.]+ ao número máximo de Totens(?: Balista)? Convocados$|Vida do Totem aumentada em [\d.]+ ?%$|^[\d.]+ ?% mais Vida de Totens$|^Velocidade de Posicionamento de Totem aumentada em [\d.]+ ?%$|^\+[\d.]+ metros? ao Alcance de Golpes Corpo a Corpo$/i;
// (lote G20c: + os efeitos próprios dos totens — `LacaiosPoe.efeitosDoTotem`; aqui a regex, porque o módulo dos lacaios importa este. O "não podem
// Evadir" do Chamariz: o totem do jogo não tem evasão — os modificadores de lacaio não valem nele, lote G20a)
const LINHA_DO_EFEITO_DO_TOTEM = /^Distância de Ativação aumentada em|enquanto o Totem estiver Ativo$|de Vida Regenerada por segundo$|^[\d.]+ ?% menos Área de Efeito$|é sofrido na Vida do Totem antes do alvo$|^Solo Sagrado concede Imunidade a Maldições|^Área do Solo Sagrado aumentada em|por Totem máximo$|para si a cada cadáver consumido$|^Totens Convocados por esta Habilidade não podem Evadir$|^\+[\d.]+ à quantidade máxima de totens invocados por carga de poder máxima$|^Dano abrasador aplicado pela detonação causa/i;
export const ehLinhaDoTotem = (l) => LINHA_DO_TOTEM.test(l) || LINHA_DO_EFEITO_DO_TOTEM.test(l);
/**
 * (lote G20a) O totem que NÃO ACERTA ninguém: no PoE o Chamariz, o Devorador e os Rejuvenescedores não causam dano (`base_deal_no_damage` —
 * act_str.lua:2444, 2689, 9358) e o Vínculo Abrasador causa o dano no FEIXE entre os totens e você, não num acerto. O efeito próprio de cada um ainda
 * não existe: as linhas vão nos motivos.
 */
/** (lote G20a) A mecânica do totem que está só na descrição do PoE (act_str/act_dex.lua), sem linha nos dados. */
const DESCRICAO_DO_TOTEM = [
  [/^Artillery_Ballista/, 'as flechas caem em linha, cada uma com dano em área e um acerto só por inimigo (act_dex.lua:751-769; no jogo ainda são projéteis no alvo)'],
  [/^Decoy_Totem/, 'o totem provoca os monstros em volta a atacá-lo (act_str.lua:2416-2432)'],
  [/^Shrapnel_Ballista/, 'as flechas do mesmo ataque podem acertar o mesmo inimigo (no jogo cada flecha a mais vai num inimigo diferente)'],
];
const TOTEM_SEM_GOLPE = /^(?:Decoy_Totem|Devouring_Totem|Rejuvenation_Totem|Vaal_Rejuvenation_Totem|Searing_Bond)/;
export const totemSemGolpe = (slug) => TOTEM_SEM_GOLPE.test(String(slug ?? ''));
/** Lacaios e totens (`itens-poe/lacaios-poe.mjs`): as linhas que o jogo faz. (Aqui, e não lá: o módulo dos lacaios importa este.) */
const LINHA_DE_LACAIO = /^Máximo de |^\+\d+ ao número máximo de Totens|^Convoca \d+ |^Duração base é de|^Totem dura|Lacaios? têm .*mais Vida|Lacaios? causam? .*(mais|menos) Dano|são de Nível|Invoca um Totem que usa|^Golens (aumentam|concedem)|mais Velocidade de Ataque|sempre Golpes Críticos|Multiplicador de Acerto Crítico|Dano Físico adicional|infligir Sangramento|Velocidade de Ataque dos Lacaios|Chance de Golpe Crítico aumentada|Multiplicador de Golpe Crítico|Chance de Bloquear o Dano de Ataques|Vida Regenerada por Segundo|Regenera .*da Vida por segundo|Aura dos Robôs/i;
export const ehLinhaDeLacaio = (l) => LINHA_DE_LACAIO.test(l);
/** (lote 75) As linhas da VIRULÊNCIA do Arauto da Agonia (`itens-poe/virulencia.mjs` e o Rastejador — `lacaios-poe.oQueInvoca`). */
const LINHA_DA_VIRULENCIA = /Virulência|Rastejador/i;
export const ehLinhaDaVirulencia = (l) => LINHA_DA_VIRULENCIA.test(l);
/** (lote 81) As linhas dos ACERTOS e da QUEIMA dos Arautos que o jogo faz (`acoes.explosaoDoArautoGlacial`, `queimaduraDoArautoDasCinzas`). */
const LINHAS_DO_ARAUTO = { Herald_of_Ice: /O raio Base é de|Dano não pode ser Refletido|^Causa \d/, Herald_of_Ash: /Dano Excedente|mais Dano Incendiário/, Herald_of_Thunder: /Tempestade Acerta um Inimigo|Cria uma tempestade quando|^Causa \d|Não Pode aplicar Eletrizar|Duração base é de/ };
export const ehLinhaDoArauto = (slug, l) => !!LINHAS_DO_ARAUTO[slug]?.test(l);

const acaoPorId = (id) => ACTION_CATALOG.spells.find((e) => e.id === id) ?? ACTION_CATALOG.runes?.find((e) => e.id === id) ?? null;

let COMPILADOR = null;
let GEMAS = [];
const POR_SLUG = new Map();
/** slug → `{ itemId, acao, arquetipo, carga, formato, elemento, ataque, buff, bloqueio, statusNoJogo, motivosNoJogo, nivelMax, gema }` */
export const REGISTRO = new Map();
const CACHE = new Map();

/** (uma frase nova começa numa faixa "(a — b)" quando a parte de antes já tem a sua faixa e termina num número, "%" ou palavra fechada) */
function partirQualidade(t) {
  const out = [];
  let resto = String(t);
  for (;;) {
    // (17/10, lote G18a: a frase que REPETE o começo — "A onda final causa +(0 — 150)% … A onda final causa +(0 — 80)% …" — corta ali)
    const inicio = resto.split(' ').slice(0, 3).join(' ');
    const rep = inicio.length > 6 ? resto.indexOf(` ${inicio}`, 1) : -1;
    if (rep > 0) { out.push(resto.slice(0, rep)); resto = resto.slice(rep + 1); continue; }
    const re = / (?=[+-]?\(-?\d[^)]*—[^)]*\))/g;
    let corte = -1;
    for (let m; (m = re.exec(resto));) if (/\(-?\d[^)]*—[^)]*\)/.test(resto.slice(0, m.index)) && !/\b(em|de|a|até|por|ao|do|da)$/i.test(resto.slice(0, m.index))) { corte = m.index; break; }
    if (corte < 0) { out.push(resto); return out; }
    out.push(resto.slice(0, corte));
    resto = resto.slice(corte + 1);
  }
}
/** As linhas da QUALIDADE da gema no valor da fração `q` (0–1). */
// (17/10, lote G18b: "O raio Base é de 0,3 metros" da qualidade SOMA no raio do nível — o mesmo stat no PoB —: vira "+0,3 metros de raio"; antes o
// compilador o tomava pelo raio, e a Bola de Fogo com qualidade 20 ficava com 0,3 m)
const linhasDaQualidade = (g, q) => (g?.qualidade ?? []).flatMap(partirQualidade).map((t) => naFracao(t, q).replace(/^O raio Base é de ([\d.]+) metros?$/i, '+$1 metros de raio'));
/**
 * A gema compilada no nível (cache): os números do PoE (`compilarHabilidade` da arena do dono). (17/10, lote G2: + a QUALIDADE, 0–20 — as
 * linhas dela entram com as do nível: "+0.4 metros de raio", "+2 segundos à duração base", "Dispara +1 projétil"…)
 */
/**
 * (revisão do A3, dono 19/10: "Siga o PoB") A Vaal Flecha Relampejante veio do poedb com a tabela de níveis da Flecha Relampejante comum: o dano base
 * (149,5% → 177,1%) e a coluna "Dispara N Projéteis adicionais". No PoB (act_dex.lua:10568) ela tem só as 5 flechas (base_number_of_arrows) e o
 * baseMultiplier 0,713 → 0,983 por nível — os de cá.
 */
const CORRECAO_DO_POB = {
  Vaal_Lightning_Arrow: {
    efetividade: [0.713, 0.726, 0.737, 0.749, 0.76, 0.772, 0.782, 0.792, 0.803, 0.813, 0.822, 0.831, 0.841, 0.85, 0.858, 0.866, 0.874, 0.882, 0.89, 0.897, 0.904, 0.911, 0.918, 0.925, 0.931, 0.937, 0.943, 0.949, 0.954, 0.96, 0.963, 0.965, 0.967, 0.969, 0.972, 0.974, 0.976, 0.979, 0.981, 0.983],
    semProjeteisAdicionais: true,
  },
};
export function compilada(slug, nivel = 1, qualidade = 0) {
  const g = POR_SLUG.get(slug);
  if (!g || !COMPILADOR) return null;
  const n = Math.max(1, Math.min(nivel | 0 || 1, COMPILADOR.nivelMaximo?.(g) ?? 40));
  const q = qualidadeDasContas(qualidade);
  const k = `${slug}@${n}@${q}`;
  if (!CACHE.has(k)) {
    const h = COMPILADOR.compilarHabilidade(g, n, q > 0 ? linhasDaQualidade(g, q / 20) : []);
    const c = CORRECAO_DO_POB[slug];
    const h2 = h && c?.efetividade ? { ...h, stats: { ...h.stats, efetividade: c.efetividade[Math.min(c.efetividade.length, n) - 1] } } : h;
    CACHE.set(k, h2 && ARQUETIPO_PROPRIO[slug] ? { ...h2, arquetipo: ARQUETIPO_PROPRIO[slug] } : h2);
  }
  return CACHE.get(k);
}

/**
 * Os TEMPOS do PoE da gema no nível (dono, 06/10: "cooldown e cast corretos com o do PoE"): o tempo de conjuração da magia (s), a recarga
 * própria (s, só as que têm "Recarga" no PoE — a maioria não tem) com as cargas, e a velocidade de ataque da gema de ataque ("X% de base":
 * o golpe da arma × X%).
 */
export function temposNoNivel(slug, nivel = 1, qualidade = 0) {
  // (17/10, lote G2: + a qualidade — "Velocidade de Recarga aumentada em X%" da qualidade encurta a recarga)
  const st = compilada(slug, nivel, qualidade)?.stats ?? {};
  // (18/10, lote G20a: + a "Velocidade de Posicionamento de Totem aumentada" da gema — os ancestrais —, no tempo de COLOCAR o totem)
  // (lote A1: + a recuperação condicional do Passo Rápido — `Acoes.temposDaGemaPoe` a aplica no uso, pela presença)
  return { conjuracaoMs: Math.round((st.tempoUso ?? 0) * 1000), recargaMs: st.recarga ? Math.round(st.recarga * 1000) : 0, cargas: st.cargas ?? 1, velAtaqueBase: st.velAtaqueBase ?? 100, velClamor: st.velClamor ?? 0, tempoExtraMs: Math.round((st.tempoAtaqueExtra ?? 0) * 1000), velPosicionamentoPct: st.velPosicionamento ?? 0,
    ...(st.velRecargaSemInimigos ? { recargaSemInimigosPct: st.velRecargaSemInimigos } : {}), ...(st.recuperacaoComUnico ? { recargaComUnicoPct: st.recuperacaoComUnico } : {}) };
}

/**
 * Os ALVOS da gema no nível (dono, 06/10: "o arco elétrico bate em vários mobs como no PoE?"): o que as linhas da gema dizem, com os números
 * DESTE nível — `saltos` ("Ricocheteia +4 Vezes": a cadeia, 1 + saltos alvos), `pctPorRestante` ("15% mais Dano por cada Ricochete
 * restante"), `perfurar` (N alvos, ou 99 = "todos"), `projeteis` adicionais, `bifurcar` ("se Difundem") e `divide` ("o feixe se divide em
 * direção a N alvos adicionais"). Antes o jogo usava os da magia-molde do Draevor (a cadeia sempre de 6 alvos).
 */
const REGRAS_DE_ALVOS = [
  [/^(?:Projétil Primário )?(?:Raios )?Ricocheteiam? \+?(\d+) Vez/i, (m, a) => { a.saltos += Number(m[1]); }],
  [/(\d+) ?% mais Dano .*por (?:cada )?Ricochete restante/i, (m, a) => { a.pctPorRestante += Number(m[1]); }],
  [/Perfuram todos (?:os )?Alvos/i, (m, a) => { a.perfurar = 99; }],
  [/Perfuram (\d+) Alvos adiciona/i, (m, a) => { a.perfurar = Math.max(a.perfurar, Number(m[1])); }],
  [/^Dispara (\d+) Projéteis adicionais$/i, (m, a) => { a.projeteis += Number(m[1]); }],
  // (11/10) A quantidade BASE ("Dispara 15 projéteis", "Dispara 9 Flechas") e "Dispara Projéteis em sequência" (todos podem ir no alvo):
  // a emissão de `skills/golpes-secundarios.resolver`.
  // (só aparecem na gema que os declara)
  // (lote A3, dono 19/10: + o singular — o Pulso Congelante chega como "Dispara 5 projétil" no nível 20; o PoB dá base_number_of_projectiles 5)
  // (lote B1, dono 20/10: + a flecha no singular — a Chuva Explosiva de Trarthus, "Dispara 1 Flecha"; os "+N projéteis" não valem nela, a linha de baixo)
  [/^Dispara (\d+) (?:projéteis|projétil|flechas?)$/i, (m, a) => { a.base = Math.max(a.base ?? 0, Number(m[1])); }],
  [/^Dispara Projéteis em sequência$/i, (m, a) => { a.sequencia = true; }],
  [/^Dispara (?:um|1) Projétil adicional$/i, (m, a) => { a.projeteis += 1; }],
  // (17/10, lote G2) a qualidade escreve os adicionais com "+": "Dispara +2 projéteis", "Dispara +1 Flecha" (a fração arredonda para baixo)
  [/^Dispara \+(\d+(?:\.\d+)?) (?:projéteis|projétil|Flechas?)$/i, (m, a) => { a.projeteis += Math.floor(Number(m[1])); }],
  // (lote A3, dono 19/10: + o "+" da qualidade — "O feixe se divide em direção a +2 alvos adicionais")
  [/se divide em direção a \+?(\d+) alvos adiciona/i, (m, a) => { a.divide += Number(m[1]); }],
  // (12/10) O Aço Violento: "Projéteis se Partem na direção de N alvos" (o compilador lia o número, mas nada o usava: a divisão não saía).
  // (lote A3, dono 19/10 — D5: a DIVISÃO como no PoE — o projétil se divide a partir do alvo atingido em N projéteis para os mais próximos
  // (`Secundarios.resolver`); antes eram N projéteis a mais saindo de você. O `divide` segue com os dois — o do feixe e o do projétil —, e
  // `partir` é só o do projétil, que não vira projétil a mais.)
  [/^Projéteis se Partem na direção de (\d+) alvos$/i, (m, a) => { a.divide += Number(m[1]); a.partir = (a.partir ?? 0) + Number(m[1]); }],
  // (lote A3, D5) "Modificadores do número de Projéteis ao invés são aplicados ao número de alvos para os quais os Projéteis focam sua Divisão":
  // os projéteis a mais (da gema, dos suportes, das peças) viram alvos da divisão (`Acoes.comOsAlvosDaGema`)
  [/^Modificadores do número de Projéteis ao invés são aplicados ao número de alvos para os quais os Projéteis focam sua Divisão$/i, (m, a) => { a.extrasNaDivisao = true; }],
  [/^Projéteis podem se Dividir sem acertar um alvo$/i, (m, a) => { a.partirSemAcertar = true; }],
  [/^Projéteis podem se Dividir ao acertar o terreno$/i, (m, a) => { a.partirNoTerreno = true; }],
  // ("Projéteis não podem se Partir" — a Explosão Cinética do Agrupamento, a Vaal Flecha Relampejante: o CannotSplit do PoB)
  [/^Projéteis não podem se Partir$/i, (m, a) => { a.semPartir = true; }],
  // (lote A3 — F1, D1) a VELOCIDADE DE PROJÉTIL da gema: o "aumentada" soma com a das peças e a dos suportes; o "mais" multiplica. Vale no tiro
  // da tela, nas rampas do Pulso Congelante e do Olho Invernal (× o ProjectileSpeedMod do PoB) e no "dano com Arcos" (só o "aumentada")
  [/^Velocidade de Projéteis aumentada em ([\d.]+) ?%$/i, (m, a) => { a.velInc = (a.velInc ?? 0) + Number(m[1]); }],
  [/^([\d.]+) ?% mais Velocidade de Projétil$/i, (m, a) => { a.velMais = (a.velMais ?? 1) * (1 + Number(m[1]) / 100); }],
  // (lote A3 — F3) "Projéteis que Atravessaram causam X% mais Dano" (o PoB: projectile_damage_+%_final_if_pierced_enemy) — o acerto do projétil
  // que já atravessou alguém (`Acoes.disparar`, o `fatorDoProjetil`)
  [/^Projéteis que Atravessaram causam ([\d.]+) ?% mais Dano$/i, (m, a) => { a.atravessouMaisPct = (a.atravessouMaisPct ?? 0) + Number(m[1]); }],
  // (lote A3 — F4) o RETORNO da gema (o Giro Venenoso): volta a você; "Projéteis Retornando causam X% menos Dano com Acertos e Afecções" (o % da
  // volta) e "Projéteis Retornando Atravessam todos os Alvos" (dono, D4: a reta da volta acerta todos os vivos no caminho)
  [/^Projéteis Retornam a você$/i, (m, a) => { a.retornar = 1; }],
  [/^Projéteis Retornando causam ([\d.]+) ?% menos Dano com Acertos e Afecções$/i, (m, a) => { a.danoDoRetornoPct = Math.max(0, 100 - Number(m[1])); }],
  [/^Projéteis Retornando Atravessam todos os Alvos$/i, (m, a) => { a.voltaAtravessa = true; }],
  // (lote A3 — F2, D2) as RAMPAS DE DISTÂNCIA do PoB (DistanceRamp, × o ProjectileSpeedMod): o Pulso Congelante — 50% menos Dano de 0 a 60
  // unidades, e os 25% de Congelar que caem a 0 em 15 unidades (act_int.lua:7687-7688) —; o Olho Invernal — até X% mais Dano de 0 a 60 unidades
  // (act_int.lua:5519; a da qualidade soma). A distância em unidades é a do lote 33: as casas × 20 (o colado, 20).
  [/^Projéteis perdem Dano continuamente, causando até ([\d.]+) ?% menos Dano por vez que se dissiparem Projéteis têm ([\d.]+) ?% de chance de Congelar, que é perdida no primeiro quarto da luta$/i,
    (m, a) => { a.rampaMaisPct = (a.rampaMaisPct ?? 0) - Number(m[1]); a.rampaCongelar = Number(m[2]); }],
  [/^Projéteis ganham Dano continuamente, até ([\d.]+) ?% mais Dano até se dissiparem$/i, (m, a) => { a.rampaMaisPct = (a.rampaMaisPct ?? 0) + Number(m[1]); }],
  [/^Projéteis ganham até \+([\d.]+) ?% mais Dano até se dissiparem$/i, (m, a) => { a.rampaMaisPct = (a.rampaMaisPct ?? 0) + Number(m[1]); }],
  // (lote A3 — F6) "Dispara Projéteis em direções aleatórias" (a Vaal Faísca: o ramo das direções aleatórias, lote 42)
  [/^Dispara Projéteis em direções aleatórias$/i, (m, a) => { a.direcoesAleatorias = true; }],
  // (lote A3 — F6, D6) a Hélice Espectral: "Rebate até N vezes" (cada rebatida é um ricochete no terreno, 100%) e os projéteis a mais viram
  // rebatidas; a Vaal Flecha Relampejante: "mudam de direção N vezes … podem Acertar alvos cada vez" — N acertos a mais nos mais perto, a 3 casas
  // (os Difundir/Ricochetear a mais também viram mudanças de direção)
  [/^Rebate até (\d+) vezes Modificadores ao número de Projéteis se aplicam ao número de Rebatidas$/i, (m, a) => { a.rebatidas = (a.rebatidas ?? 0) + Number(m[1]); a.extrasNasRebatidas = true; a.rebatidasNoTerreno = true; }],
  [/^Projéteis mudam de direção (\d+) vezes Projéteis podem Acertar alvos cada vez que mudam de direção$/i, (m, a) => { a.rebatidas = (a.rebatidas ?? 0) + Number(m[1]); a.ricochetesNasRebatidas = true; }],
  // (lote A3 — F6, D6) o Magma Rolante e o Vaal Golpe Fundido: "Projéteis podem Ricochetear ao atingir o solo / não mudam de direção" — cada
  // ricochete é um salto no solo: uma área a cada 3 casas, na mesma reta (o raio do PoB do Magma: 1,4 + 0,4 m ≈ 1 casa)
  [/^Projéteis podem Ricochetear ao atingir o solo Projéteis não mudam de direção ao Ricochetear$/i, (m, a) => { a.saltoNoSolo = true; }],
  // (lote A3 — F7) a quantidade e a emissão: "O primeiro e último disparo da sequência dispara N Projéteis adicionais simultâneos" (a Saraivada:
  // 2 × N a mais — os simultâneos vão nos outros bichos, a sequência no alvo); "Dispara Projéteis extras em até N Inimigos ao redor" (o Rito
  // Proibido: um projétil a mais em cada inimigo em volta, até N — só os que existem); "Dispara Projéteis em cada inimigo Próximo" (a Vaal Sifão
  // de Poder: um em cada um no alcance); "Projéteis causam +X% (mais) dano por projétil disparado anteriormente em sequência" (a Fuzilaria
  // Cinética: o k-ésimo projétil do uso, × (1 + X·k/100))
  // (revisão do A3: os simultâneos à parte — `simultaneos`, em leque para os outros inimigos; não são projéteis da sequência)
  [/^O primeiro e último disparo da sequência dispara (\d+) Projéteis adicionais simultâneos$/i, (m, a) => { a.simultaneos = (a.simultaneos ?? 0) + Number(m[1]); }],
  [/^Dispara Projéteis extras em até \+?(\d+) Inimigos ao redor$/i, (m, a) => { a.aoRedor = (a.aoRedor ?? 0) + Number(m[1]); }],
  [/^Dispara Projéteis em cada inimigo Próximo$/i, (m, a) => { a.aoRedor = Math.max(a.aoRedor ?? 0, 99); }],
  [/^Projéteis causam \+ ?([\d.]+) ?% (?:mais )?dano por projétil disparado anteriormente em sequência$/i, (m, a) => { a.porProjetilAnteriorPct = (a.porProjetilAnteriorPct ?? 0) + Number(m[1]); a.extrasNoAlvo = true; }],
  // (revisão do A3) o Raio Cinético: "Modificadores que fariam com que projéteis se Difundissem fazem com que eles mudem de direção vezes
  // adicionais ao invés" — e a mudança de direção não se aplica (`LINHAS_QUE_NAO_SE_APLICAM`): a Difusão não vale nesta gema
  [/^Modificadores que fariam com que projéteis se Difundissem fazem com que eles mudem de direção vezes adicionais ao invés$/i, (m, a) => { a.semDifundir = true; }],
  [/^Projéteis se Difundem$/i, (m, a) => { a.bifurcar = Math.max(a.bifurcar, 2); }],
  // (18/10, lote G20a) a Balista de Cerco Fragmentadora: os filhos da difusão difundem de novo e a chance de 1 filho a mais (a da qualidade —
  // act_dex.lua:14056-14061)
  [/^Projéteis podem Difundir (\d+) Vez\w* adicionais$/i, (m, a) => { a.difundirDeNovo = (a.difundirDeNovo ?? 0) + Number(m[1]); }],
  [/^Projéteis têm ([\d.]+) ?% de chance de receber um Projétil adicional quando Difundindo$/i, (m, a) => { a.difusaoExtraChance = (a.difusaoExtraChance ?? 0) + Number(m[1]); }],
  // (17/10, lote G18b) a Flecha Relampejante: "Acerta até N inimigos adicionais próximos ao alvo" (a 1,8 m — 1 casa — de cada atingido)
  [/^Acerta até (\d+(?:\.\d+)?) inimigos adicionais próximos ao alvo$/i, (m, a) => { a.proximos = (a.proximos ?? 0) + Math.floor(Number(m[1])); }],
];
/**
 * (lote A1, dono 19/10) O DESLOCAMENTO da gema de movimento no nível e na qualidade (`itens-poe/deslocamento.mjs`): `{ modo, maxM, danoEm, … }`
 * ou null (a gema não desloca). As linhas da gema entram: a "Distância de Deslocamento (máxima) aumentada", o atraso do Teleporte Relampejante.
 */
const DESLOCAMENTOS = new Map();
/** (lote A1, dono 19/10: "fica para depois") A mecânica das gemas de movimento que está só na DESCRIÇÃO — o status não a vê por linha. */
const DESCRICAO_DO_MOVIMENTO = {
  // (lote A1b, dono 19/10: D-a: a recarga pulada com a carga — o Golpe Súbito, o do Poder e o Caminho Sagrado da Tolerância — existe:
  // `GemasA1b.CARGA_QUE_PULA_A_RECARGA`, `Acoes.dispararSemMarcar`)
  // (lote A4, dono 19/10: D3: os 25 golpes do Golpe Cintilante Vaal existem — `GemasA4.GOLPE_CINTILANTE_VAAL`, `Acoes.dispararSemMarcar`)
};
/** (lote A1 — D7) As linhas do Passo Definhante que o jogo faz (`Acoes.passoDefinhante`): o Elusivo e o Definhar de quem está na área. */
const LINHAS_DO_PASSO_DEFINHANTE = /^Definhado dura [\d.]+ segundos?$|^Não pode ser Conjurado ou Ativado enquanto Elusivo Concede Elusivo$|^Efeito do Elusivo desta Habilidade aumentado em [\d.]+ ?%$|^Inflige \+?[\d.]+ Debuffs de Definhamento adicionais na primeira vez que cada Inimigo entrar na Área$/i;
export function deslocamentoDaGema(slug, nivel = 1, qualidade = 0) {
  if (!DESLOCAMENTO[slug]) return null;
  const k = `${slug}@${nivel | 0}@${qualidade | 0}`;
  if (!DESLOCAMENTOS.has(k)) DESLOCAMENTOS.set(k, deslocamentoDasLinhas(slug, [...textosDaGema(slug, nivel).linhas, ...linhasDaQualidadeDe(slug, qualidade)]));
  return DESLOCAMENTOS.get(k);
}
/** As linhas da gema no nível (os números DESTE nível), e o "RequerNível" dele — para quem lê a gema fora daqui (os lacaios). */
export function textosDaGema(slug, nivel = 1) {
  const g = POR_SLUG.get(slug);
  if (!g || !COMPILADOR?.textosDoNivel) return { linhas: [], props: [], requer: 1 };
  const n = Math.max(1, Math.min(nivel | 0 || 1, COMPILADOR.nivelMaximo?.(g) ?? 40));
  return { linhas: COMPILADOR.textosDoNivel(g, n), props: COMPILADOR.propsDoNivel(g, n), requer: COMPILADOR.basicosDoNivel(g, n).nivelReq ?? g.nivelReq ?? 1, nome: g.nome, tags: g.tags ?? [] };
}

/**
 * (11/10) A RETALIAÇÃO do PoE: "Não pode ser usado por padrão — Se Torna Utilizável uma vez por 2 segundos quando você Bloquear um Acerto"
 * (`'bloquear'`) ou "quando você sofrer um Acerto Selvagem" (`'selvagem'` — o Clamor Vingativo). Null: a gema usa-se sempre.
 */
export function gatilhoDeRetaliacao(slug) {
  for (const l of textosDaGema(slug, 1).linhas) {
    if (!/Se Torna Utilizável/i.test(l)) continue;
    if (/Bloquear um Acerto/i.test(l)) return 'bloquear';
    if (/Acerto Selvagem/i.test(l)) return 'selvagem';
  }
  return null;
}

/** (ciclo 7, lote G) Quantos ataques o CLAMOR Impele ("Impele os próximos 8 Ataques de Golpe Corpo a Corpo que você executar"): 0 se não Impele. */
export function impelidosDaGema(slug, nivel = 1) {
  for (const l of textosDaGema(slug, nivel).linhas) {
    const m = /Impele (?:os próximos|o próximo) (\d+) Ataques?/i.exec(l);
    if (m) return Number(m[1]) || 0;
  }
  return 0;
}

/**
 * (14/10, o Coveiro) Os CADÁVERES que a gema cria — Profanar: "Cria 5 cadáveres" dos monstros da área, "Nível dos Corpos Criados é igual ao
 * nível da área, máximo de Nível X"; Desenterrar: um cadáver de Arqueiro de Ossos onde o projétil cai, "Corpos Criados são Nível X"; as duas:
 * "Máximo de 10 Cadáveres permitidos" (os criados por ela; o mais velho sai). `{ n, maximo, nivel, nivelMax, arqueiro }`, ou null.
 */
const LINHA_DE_CADAVER = /^Cria \d+ cadáveres?$|^Nível dos Corpos Criados é igual ao nível da área|^Corpos Criados são Nível \d+$|^Máximo de \d+ Cadáveres permitidos$/;
export const ehLinhaDeCadaver = (l) => LINHA_DE_CADAVER.test(l);
export function cadaveresDaGema(slug, nivel = 1) {
  const g = POR_SLUG.get(slug);
  if (!(g?.tipos ?? []).includes('CreatesCorpse')) return null;
  const linhas = textosDaGema(slug, nivel).linhas;
  const achar = (re) => { for (const l of linhas) { const m = re.exec(l); if (m) return Number(m[1]); } return null; };
  const cria = achar(/^Cria (\d+) cadáveres?$/);
  return {
    n: cria ?? 1, maximo: achar(/^Máximo de (\d+) Cadáveres permitidos$/) ?? 10, arqueiro: cria == null,
    nivel: achar(/^Corpos Criados são Nível (\d+)$/), nivelMax: achar(/^Nível dos Corpos Criados é igual ao nível da área, máximo de Nível (\d+)$/),
  };
}

/**
 * (lote A3, dono 19/10 — D3) O que o projétil do Arremesso Espectral e da Hélice Espectral faz e está só no PoB e na DESCRIÇÃO (sem linha):
 * o Arremesso "voa e depois retorna a você … causando dano aos inimigos em seu caminho" e tem PierceChance 100 (act_dex.lua:14603) — atravessa
 * todos, na ida e na volta —; o da Materialização "só acerta e causa dano enquanto retorna" (a ida não acerta ninguém); a Hélice "causa dano aos
 * inimigos em seu caminho" — atravessa todos (o retorno não está na descrição dela). Sem isso, o "Projéteis que Atravessaram causam X% mais
 * Dano" da qualidade não faria nada.
 */
const DESCRICAO_DO_PROJETIL = [
  [/^(?:Vaal_)?Spectral_Throw(?:_of_Trarthus)?$/, { perfurar: 99, retornar: 1, voltaAtravessa: true }],
  [/^Spectral_Throw_of_Materialising$/, { perfurar: 99, retornar: 1, voltaAtravessa: true, soNaVolta: true }],
  [/^Spectral_Helix(?:_of_Trarthus)?$/, { perfurar: 99 }],
];
/**
 * (lote A3, dono 19/10 — D1, D6) As linhas de projétil que NÃO SE APLICAM ao jogo (só a trajetória — o projétil do jogo acerta no tique, e o PoB
 * não as usa na conta): saem dos motivos e ficam como nota (`linhasQueNaoSeAplicam`, o relatório as mostra).
 */
const LINHAS_QUE_NAO_SE_APLICAM = [
  [/^A Segunda forma possui [\d.]+ ?% mais Velocidade de Projétil$/i, 'não se aplica: "A Segunda forma possui X% mais Velocidade de Projétil" (Lança de Gelo) só muda a trajetória da segunda forma — o PoB não a usa na conta, e o projétil do jogo acerta no tique'],
  [/^Desaceleração do Projétil reduzida em [\d.]+ ?%$/i, 'não se aplica: "Desaceleração do Projétil reduzida" (Arremesso Espectral da Materialização) só muda a trajetória — o PoB não a usa na conta'],
  [/^Projéteis mudam de direção \d+ vezes$/i, 'não se aplica: "Projéteis mudam de direção N vezes" (Raio Cinético) só muda a trajetória — o projétil não acerta de novo a cada mudança'],
  // (lote PR1, dono 20/10 — D1 do plano: como a 2ª forma da Lança de Gelo) a Hélice Espectral
  [/^Gira por [\d.]+ rotações$/i, 'não se aplica: "Gira por N rotações" (Hélice Espectral) só muda a trajetória da espiral — o PoB não a usa na conta, e o projétil do jogo acerta no tique'],
];
/**
 * (lote A3, dono 19/10) O que o projétil da gema faz só no PoB, sem linha (o status não o vê): a Vaal Faísca lança 100 projéteis em espiral por 3 s
 * (base_number_of_projectiles_in_spiral_nova, act_int.lua:16994) — as direções aleatórias valem, mas a espiral é do lote A3b (F8).
 */
// (lote A3b, dono 19/10: D10: a espiral da Faísca Vaal existe — os 100 projéteis em 3 s, `GemasA3b.ESPIRAIS`, `Acoes.tiqueDosObjetos`)
const PROJETIL_SEM_LINHA = {};
export const ehLinhaQueNaoSeAplica = (l) => LINHAS_QUE_NAO_SE_APLICAM.some(([re]) => re.test(String(l)));
/** (lote A3) As notas das linhas da gema que não se aplicam (sem repetição). */
export const linhasQueNaoSeAplicam = (linhas = []) => [...new Set(linhas.map((l) => LINHAS_QUE_NAO_SE_APLICAM.find(([re]) => re.test(String(l)))?.[1]).filter(Boolean))];
// (lote A3: a velocidade de projétil de uma gema de TOTEM não conta como feita aqui — o tiro do totem é do ramo do totem, de outra sessão)
const VELOCIDADE_DA_GEMA = /^Velocidade de Projéteis aumentada em|^[\d.]+ ?% mais Velocidade de Projétil$/i;
/** As linhas da gema que o jogo agora faz (saem de "não simulado"). */
export const ehLinhaDeAlvos = (linha, arquetipo = null) => !(arquetipo === 'totem' && VELOCIDADE_DA_GEMA.test(linha)) && REGRAS_DE_ALVOS.some(([re]) => re.test(linha));
const ALVOS = new Map();
export function alvosNoNivel(slug, nivel = 1, qualidade = 0) {
  const g = POR_SLUG.get(slug);
  const n = Math.max(1, Math.min(nivel | 0 || 1, COMPILADOR?.nivelMaximo?.(g) ?? 40));
  const q = qualidadeDasContas(qualidade);
  const k = `${slug}@${n}@${q}`;
  if (ALVOS.has(k)) return ALVOS.get(k);
  const a = { saltos: 0, pctPorRestante: 0, perfurar: 0, projeteis: 0, bifurcar: 0, divide: 0 };
  // (17/10, lote G2: + as linhas da qualidade — "Dispara +1 projétil", "Ricocheteia +1 Vezes")
  const linhas = g && COMPILADOR?.textosDoNivel ? [...COMPILADOR.textosDoNivel(g, n), ...(q > 0 ? linhasDaQualidade(g, q / 20) : [])] : [];
  for (const linha of linhas) for (const [re, fazer] of REGRAS_DE_ALVOS) { if (CORRECAO_DO_POB[slug]?.semProjeteisAdicionais && /^Dispara \d+ Projéteis adicionais$/i.test(linha)) continue; const m = linha.match(re); if (m) fazer(m, a); }
  // (lote A3 — D3: o que está só na descrição e no PoB do projétil)
  for (const [re, d] of DESCRICAO_DO_PROJETIL) if (re.test(slug)) { Object.assign(a, d); a.perfurar = Math.max(a.perfurar, d.perfurar ?? 0); }
  ALVOS.set(k, a);
  return a;
}

/** O dano direto da gema no nível: `{ min, max, elementos }` (todos os elementos somados no elemento principal). */
export function danoNoNivel(slug, nivel) {
  const h = compilada(slug, nivel);
  const d = Object.values(h?.stats?.dano ?? {});
  return { min: Math.round(d.reduce((t, [a]) => t + a, 0)), max: Math.round(d.reduce((t, [, b]) => t + b, 0)), elementos: Object.keys(h?.stats?.dano ?? {}).length };
}
/**
 * O dano de um ATAQUE do PoE por ELEMENTO (dono, 06/10: "Acerto Elemental do Espectro — vai depender do elemento da arma?"), como o
 * `montarPacote` da Arena de Gemas: o golpe FÍSICO da arma × a eficácia, + o dano ADICIONAL da gema ("8 a 14 de Dano de Fogo Adicional")
 * × a eficácia, + o adicionado das peças/suportes (`extras`: `{ elemento: [min, max] }`); depois a CONVERSÃO de físico da gema ("Converte
 * 50% do Dano Físico em Raio"; "em Fogo, Gelo ou Raio" sorteia) e "Não causa Dano não-Elemental" (o físico e o caos que sobram somem).
 * Devolve `{ elemento: [min, max] }` (no jogo: physical, fire, ice, energy, chaos).
 */
const EL_DA_ARENA = { fisico: 'physical', fogo: 'fire', gelo: 'ice', raio: 'energy', caos: 'chaos' };
/**
 * (lote A5c, dono 20/10) A CONVERSÃO do Físico do golpe, a mesma nos ataques e nas magias (a ordem do PoE): a da GEMA (`conversoes`; `escolher` dá o elemento
 * do "aleatorio"), depois as das OUTRAS fontes só no que a gema deixou e o "Físico como Extra" sobre o Físico de antes (`outras(fisico, tetoPct)`). Muda `p`
 * no lugar; com `origens`, o que veio do Físico fica na origem `physical+<elemento>` (`somarOrigem`) — os modificadores dos dois tipos valem nele.
 */
function converterOFisico(p, origens, conversoes, outras, escolher) {
  if (!p.physical || !(p.physical[0] > 0 || p.physical[1] > 0)) return;
  const fis = [...p.physical];
  const somar = (el, [a, b], m = 1) => { const x = p[el] ?? [0, 0]; p[el] = [x[0] + a * m, x[1] + b * m]; somarOrigem(origens, el, ['physical'], [a, b], m); };
  let resta = 1;
  for (const c of conversoes ?? []) {
    const pct = Math.min(resta, Math.max(0, c.pct) / 100);
    if (!(pct > 0)) continue;
    somar(c.para === 'aleatorio' ? escolher() : EL_DA_ARENA[c.para] ?? 'physical', fis, pct);
    resta -= pct;
  }
  if (outras) {
    const o = outras([...fis], resta * 100);
    for (const [el, v] of Object.entries(o?.extras ?? {})) somar(el, v);
    resta = Math.max(0, resta - (o?.convertidoPct ?? 0) / 100);
  }
  p.physical = [fis[0] * resta, fis[1] * resta];
  if (origens) origens.physical = { physical: [...p.physical] };
}
/** (lote A5c) Tira das `origens` as partes que saíram de `p`. */
const podarOrigens = (p, origens) => { if (origens) for (const el of Object.keys(origens)) if (!p[el]) delete origens[el]; };
// (lote A5c, dono 20/10: "a mesma ordem das magias") `outras(fisico, tetoPct)` — `ModsPoe.extrasDoFisico` com a ficha: as conversões das OUTRAS fontes só no
// Físico que a gema deixou (proporcionais se passarem dele) e o "Físico como Extra" sobre o Físico de antes da conversão — todo o Físico do golpe (a arma × a
// eficácia + o adicionado). Antes elas saíam da arma crua primeiro e a gema convertia o resto, multiplicando.
export function partesDoAtaque(slug, nivel, arma = { min: 1, max: 1 }, extras = {}, rng = Math.random, { outras = null, origens = null } = {}) {
  const st = compilada(slug, nivel)?.stats ?? {};
  const ef = st.efetividade ?? 1;
  const p = {};
  const somar = (el, [a, b], m = 1) => { const x = p[el] ?? [0, 0]; p[el] = [x[0] + a * m, x[1] + b * m]; somarOrigem(origens, el, [], [a, b], m); };
  // (17/10, lote G4: a "arma" pode ser de outro elemento — a base de Fogo/Gelo do escudo nas gemas de escudo transfiguradas, `escudoDaGema`)
  somar(arma.elemento ?? 'physical', [arma.min ?? 1, arma.max ?? 1], ef);
  for (const [el, v] of Object.entries(st.adicional ?? {})) somar(EL_DA_ARENA[el] ?? 'physical', v, ef);
  for (const [el, v] of Object.entries(extras)) if (v && (v[0] || v[1])) somar(el, v);
  converterOFisico(p, origens, st.conversao, outras, () => ['fire', 'ice', 'energy'][Math.floor(rng() * 3)]);
  const ex = extrasDoAtaque(slug, nivel);
  if (ex.soElemental) { delete p.physical; delete p.chaos; }
  // "Apenas Causa Dano do Elemento escolhido" (Acerto Elemental): cada uso sorteia fogo, gelo ou raio e só ele fica.
  if (ex.umElemento) { const els = ['fire', 'ice', 'energy'].filter((el) => p[el]); const fica = els[Math.floor(rng() * els.length)]; for (const el of Object.keys(p)) if (el !== fica) delete p[el]; }
  for (const el of Object.keys(p)) if (!(p[el][1] > 0)) delete p[el];
  podarOrigens(p, origens);
  return p;
}
/**
 * O dano de uma MAGIA do PoE por elemento (`{ elemento: [min, max] }`): a Bola de Fogo é só fogo; o Golpe Cósmico, fogo + gelo...
 *
 * (lote A5c, dono 20/10: "corrigir como o PoE") + a CONVERSÃO do Físico da gema, como nos ataques (`partesDoAtaque`): antes ela era ignorada e cerca de 24
 * magias (a Onda de Convicção, a Cascata Glacial, a Marca da Penitência, a Esfera do Vácuo…) batiam só Físico. A ordem do PoE:
 *   1. o Físico do golpe é o da gema + o ADICIONADO (`extras`: `{ elemento: [min, max] }` — as peças, os suportes, o Feiticeiro, a Lâmina Mágica —, já × a
 *      eficácia do dano adicionado): a conversão vale para todo ele;
 *   2. a conversão da GEMA ("50 % do Dano Físico Convertido em Dano de Raio"; "em Fogo, Gelo ou Raio": `elementoSorteado`, ou o `rng` sorteia);
 *   3. a das OUTRAS fontes (`outras(fisico, tetoPct)` — `ModsPoe.extrasDoFisico` com a ficha): só converte o que a gema deixou; e o "Físico como Extra"
 *      dela, sobre o Físico de ANTES da conversão (no PoE o ganho como extra é calculado do dano antes de ele se converter).
 * As conversões entre elementos e os ganhos de um elemento em outro vêm depois, em `ModsPoe.transformarPartes`.
 */
export const conversaoDaMagia = (slug, nivel) => compilada(slug, nivel)?.stats?.conversao ?? [];
// (lote B1, dono 20/10: `basePor` — o multiplicador do dano BASE da gema por elemento, `{ energy: 2, … }`: a Descarga, "por Carga removida")
export function partesDaMagia(slug, nivel, extras = {}, { rng = Math.random, elementoSorteado = null, outras = null, origens = null, basePor = null } = {}) {
  const p = {};
  const somar = (k, [a, b], m = 1) => { if (!m) return; const x = p[k] ?? [0, 0]; p[k] = [x[0] + a * m, x[1] + b * m]; somarOrigem(origens, k, [], [a, b], m); };
  for (const [el, v] of Object.entries(compilada(slug, nivel)?.stats?.dano ?? {})) { const k = EL_DA_ARENA[el] ?? 'physical'; somar(k, v, basePor ? Math.max(0, Number(basePor[k]) || 0) : 1); }
  for (const [el, v] of Object.entries(extras ?? {})) if (v && (v[0] || v[1])) somar(el, v);
  converterOFisico(p, origens, conversaoDaMagia(slug, nivel), outras, () => (['fire', 'ice', 'energy'].includes(elementoSorteado) ? elementoSorteado : ['fire', 'ice', 'energy'][Math.floor(rng() * 3)]));
  for (const el of Object.keys(p)) if (!(p[el][0] > 0 || p[el][1] > 0)) delete p[el];
  podarOrigens(p, origens);
  return p;
}
/**
 * (17/10) As LINHAS LOCAIS da gema no nível e na QUALIDADE (`itens-poe/linhas-das-gemas.mjs`): as linhas que o compilador não lê mas que são
 * um modificador que o jogo já calcula ("200% de Poder Arcano", "X% mais Velocidade de Ataque por Carga de Frenesi"…) e as linhas da
 * qualidade da gema ("+(0 — 50)% de Poder Arcano", "(0 — 20)% de chance de causar Dano Dobrado"), × a fração da qualidade — antes a
 * qualidade das gemas ativas não valia (só o "mais Dano por cada tipo de Afecção" do Acerto Elemental). `{ af, feitas, qualidade }`: os
 * atributos somados, as linhas do nível que viraram atributo e as linhas da qualidade que o jogo faz (as outras ficam fora do balão).
 */
const LOCAIS = new Map();
/** As linhas da qualidade que o compilador lê E o jogo usa (o raio, a área, a duração, a recarga). */
const QUALIDADE_PELO_COMPILADOR = /metros? (?:de|ao) raio$|^O raio Base|Área de Efeito aumentada|% (?:mais|menos) Área de Efeito$|segundos? à duração base$|^Duração base é de|Velocidade de Recarga aumentada|% (?:mais|menos) dano (?:com sangramento|com incêndio|com envenenamentos|com veneno|de afecções)$|^Causa até \+?[\d.]+ ?% mais Dano com Acertos aos alvos próximos$|^Projéteis causam \+?[\d.]+ ?% (?:mais|menos) Dano com Acertos e Afecções$|^A cada cinco Ataques, Projéteis causam/i;
/** As linhas da qualidade (o poedb junta duas numa: "+(0 — 2)% mais Dano … +(0 — 2)% mais Velocidade …"), × a fração `q` (0–1). */
export function linhasLocaisNoNivel(slug, nivel = 1, qualidade = 0) {
  const g = POR_SLUG.get(slug);
  const q = qualidadeDasContas(qualidade);
  const h = compilada(slug, nivel, q);
  if (!g || !h) return { af: {}, feitas: [], qualidade: [] };
  const k = `${slug}@${h.nivel}@${q}`;
  if (LOCAIS.has(k)) return LOCAIS.get(k);
  // (as linhas que o compilador não leu — as do nível e as da qualidade —; as da qualidade que ele leu (raio, duração, projéteis) já valem
  // pela compilada)
  const daQ = new Set(q > 0 ? linhasDaQualidade(g, q / 20) : []);
  const nao = (h.linhas?.naoImplementadas ?? []).filter((l) => !ehColunaMalRotulada(slug, l));
  const uso = ehUso(h);
  const doNivel = uso ? atributosDasLinhas(nao.filter((l) => !daQ.has(l))) : { af: {}, feitas: [] };
  const daQualidade = uso ? atributosDasLinhas(nao.filter((l) => daQ.has(l))) : { af: {}, feitas: [] };
  const af = { ...doNivel.af };
  for (const [x, v] of Object.entries(daQualidade.af)) af[x] = (af[x] ?? 0) + v;
  // (só as que o JOGO usa da compilada: o raio e a área — `areaNoNivel`/`formaNoRaioDoPoe` —, a duração e a recarga — `temposNoNivel`; o
  // resto que o compilador lê não vale no jogo e fica fora)
  const lidasPeloCompilador = [...daQ].filter((l) => !nao.includes(l) && QUALIDADE_PELO_COMPILADOR.test(l));
  const r = { af, feitas: doNivel.feitas, qualidade: [...lidasPeloCompilador, ...daQualidade.feitas] };
  LOCAIS.set(k, r);
  return r;
}

/**
 * (17/10, lote G2) A ÁREA DO PoE da gema no nível e na qualidade: `raioM` — o raio-base em metros ("O raio Base é de 3 metros", "Raio: 3.5"), +
 * os "+X metros de raio" da gema, × √ do "X% mais Área de Efeito" dela —, ou null se o PoE não publica o raio; `areaIncPct` — a "Área de
 * Efeito aumentada em X%" da gema (soma com a das peças e dos suportes).
 */
const RAIO_DO_POB = Object.freeze({ Vaal_Flameblast: 4.5 });
export function areaNoNivel(slug, nivel = 1, qualidade = 0) {
  const st = compilada(slug, nivel, qualidade)?.stats;
  if (!st) return { raioM: null, areaIncPct: 0 };
  // (lote A4, dono 19/10: D8: os dados divergentes seguem o PoB) a Rajada de Chamas Vaal: o raio de 4,5 m do PoB (radius 45, act_int.lua:7106) — o
  // poedb diz 3,5
  const base = RAIO_DO_POB[slug] ?? st.raio ?? st.raioProp ?? null;
  const raioM = base == null ? null : Math.max(0, (base + (st.raioBonus ?? 0)) * Math.sqrt(Math.max(0.2, 1 + (st.areaMais ?? 0) / 100)));
  return { raioM, areaIncPct: st.areaInc ?? 0 };
}

/*
 * (lote A3c, dono 19/10: "Fazer como o PoE") A ÁREA NO IMPACTO dos projéteis: as gemas cujo projétil o PoB marca com raio no impacto (a explosão
 * da Bola de Fogo, o orbe do Magma Rolante, o "dano em área ao se dividir" do Aço Divisor, a Fuzilaria Cinética…). `pob`: o raio-base em metros do
 * PoB quando o poedb não o publica no raio da gema (ou publica outro — a Flecha Cáustica: o do chão, 2 m; o da explosão é o
 * caustic_arrow_explode_on_hit, 1,2 m); sem `pob`, o "O raio Base é de N metros" da gema. `soNosExtras`: o golpe direto é o corpo a corpo e só as
 * bolas (os projéteis) caem em área — o Golpe Vulcânico (o PoB: "Melee Hit" area = false, "Magma Balls" area = true).
 * Fora (o PoB dá o raio a outra coisa): a Bola de Raios e a Geada Rastejante (a área em volta do projétil que voa), a Drenagem de Essência e o
 * Dilacerar Almas (a área do debuff/do caminho), a Flecha Explosiva (o fusível), a Explosão Cinética (as explosões no raio secundário — linhas à
 * parte), o Trovão Estrondoso (explode no fim da duração), a Concha Somática (a concha), a Chuva Cinética (a chuva), o cone do Tiro Gélido, da
 * Flecha Galvânica e do Aço Estraçalhador, os "alvos próximos" da Flecha Relampejante e o Golpe Selvagem (a explosão do golpe corpo a corpo).
 *
 * (lote A3c — EXCEÇÕES DO DONO, 19/10: as escolhas sem fonte do lote, aceitas pelo dono)
 *   1. a área é o quadrado do raio (Chebyshev), como a explosão e o salto no solo — não um círculo;
 *   2. o raio é sorteado uma vez por uso (metros × √ do fator da área ÷ 2, a fração como a chance de uma casa), não a cada impacto;
 *   3. com o raio de 0 casa, só o atingido (o desenho da área, 1×1, sai assim mesmo);
 *   4. quem a área pegou entra nos alvos já acertados do projétil na ida: a perfuração, o ricochete, a rebatida e os filhos da divisão e da difusão
 *      não o acertam depois;
 *   5. no retorno, a área acerta de novo os vizinhos, uma vez; quem uma área da volta já pegou não leva o retorno direto de novo;
 *   6. o Aço Violento (Splitting Steel) explode só nos impactos que acertam (as divisões que erram não explodem no fim do voo, como diz o PoB);
 *   7. no Golpe Vulcânico o golpe direto (o corpo a corpo) não tem área — só as bolas, que no jogo são os projéteis extras;
 *   8. o teto de 60 áreas no impacto por uso (`limites.areasNoImpactoPorUso`); passou, corta;
 *   9. a área pega os bonecos de treino como as outras áreas de gema (`Areas.dentro`), sem checagem própria de zona segura (os bichos não ficam
 *      nelas, e o ataque numa zona segura já é barrado);
 *  10. o tiro do totem (o Totem de Magia, a Balista — pelo `usarComoTotem` → `dispararSemMarcar`) e o golpe do mercenário explodem igual ao seu
 *      (revisão do A3c; o mercenário: dono, "Sim, igual").
 */
const AREA_NO_IMPACTO = Object.freeze({
  Fireball: {}, Vaal_Fireball: {}, // act_int.lua:5788, 5872 — Projectile | Explosion
  Rolling_Magma: { pob: 1.4 }, // act_int.lua:13278 — radius 14 (+ active_skill_base_radius_+)
  Blazing_Salvo: { pob: 1.6 }, // act_int.lua:1834 — radius 16, "dealing area damage on impact"
  Forbidden_Rite: { pob: 0.8 }, Forbidden_Rite_of_Soul_Sacrifice: { pob: 0.8 }, // act_int.lua:7462, 7609 — projectile_behaviour_only_explode
  Kinetic_Fusillade: {}, Kinetic_Fusillade_of_Detonation: {}, // act_int.lua:10990, 11208 — "dealing area damage on impact"
  Splitting_Steel: {}, Splitting_Steel_of_Ammunition: {}, // act_dex.lua:15527, 15607 — "dealing area damage when it splits"
  Vaal_Burning_Arrow: { pob: 1.6 }, // act_dex.lua:3559 — radius 16, vaal_burning_arrow_explode_on_hit
  Caustic_Arrow: { pob: 1.2 }, Caustic_Arrow_of_Poison: { pob: 1.2 }, // act_dex.lua:3656, 3740 — caustic_arrow_explode_on_hit_base_area_of_effect_radius 12
  Elemental_Hit_of_the_Spectrum: {}, // act_dex.lua:6212 — "AoE Explosion"
  Poisonous_Concoction: {}, Poisonous_Concoction_of_Bouncing: {}, Explosive_Concoction: {}, Explosive_Concoction_of_Destruction: {}, // projectile_behaviour_only_explode
  Molten_Strike: { pob: 0.9, soNosExtras: true }, Molten_Strike_of_the_Zenith: { pob: 0.9, soNosExtras: true }, Vaal_Molten_Strike: { pob: 0.9, soNosExtras: true }, // act_str.lua:7833, 8041, 8157
});
export const temAreaNoImpacto = (slug) => Object.hasOwn(AREA_NO_IMPACTO, slug);
export const GEMAS_COM_AREA_NO_IMPACTO = Object.freeze(Object.keys(AREA_NO_IMPACTO));
/**
 * (lote A3c) O raio da área no impacto do projétil da gema, no nível e na qualidade: `{ raioM, soNosExtras }` — o raio-base (o do PoB ou o da gema)
 * + os "+X metros de raio" da gema, × √ do "X% mais Área de Efeito" dela (a conta de `areaNoNivel`) —, ou null (a gema não explode no impacto).
 */
export function areaNoImpacto(slug, nivel = 1, qualidade = 0) {
  const def = AREA_NO_IMPACTO[slug];
  if (!def) return null;
  const st = compilada(slug, nivel, qualidade)?.stats;
  const base = def.pob ?? st?.raio ?? null;
  if (base == null) return null;
  const raioM = Math.max(0, (base + (st?.raioBonus ?? 0)) * Math.sqrt(Math.max(0.2, 1 + (st?.areaMais ?? 0) / 100)));
  return { raioM, soNosExtras: !!def.soNosExtras };
}

/**
 * (17/10, lote G4) As GEMAS DE ESCUDO do PoE (Golpe de Escudo, Investida com Escudo, Arremesso Espectral de Escudo, Escudo da Luz, Explosão Divina,
 * Golpe de Escudo Glacial…): o ataque usa o ESCUDO como a arma da mão secundária — "X a Y de Dano Físico Base como a Mão Secundária" (ou de
 * Fogo/Gelo, nas transfiguradas) no lugar do golpe da arma —, + "X a Y de Dano Adicional por cada 15 de Armadura (ou Evasão) no Escudo" e
 * "+0,1% de Chance de Golpe Crítico da Mão Secundária por cada 10 de Escudo de Energia Máximo no Escudo". `{ base: { elemento, min, max },
 * porDefesa: [{ elemento, min, max, por, defesa: 'armadura'|'evasao'|'armEva' }], critPorEs: { pct, por } | null }` ou null (a gema não é de escudo).
 */
const EL_DO_TEXTO = { Físico: 'physical', Fogo: 'fire', Gelo: 'ice', Raio: 'energy', Caos: 'chaos', físico: 'physical' };
const LINHA_DE_ESCUDO = /de Dano (?:Físico|de Fogo|de Gelo|de Raio) Base (?:cmo a|como a|da) Mão Secund[aá]ria|Dano (?:Físico|de Fogo|de Gelo|de Raio) Adicional por cada \d+ de (?:Armadura|Evasão)|dano físico adicionado por \d+ de armadura no escudo|Chance de Golpe Crítico da Mão Secundária por cada \d+ de Escudo de Energia Máximo no Escudo/i;
export const ehLinhaDeEscudo = (l) => LINHA_DE_ESCUDO.test(l);
/**
 * (lote G4) A linha da RETALIAÇÃO ("Não pode ser usado por padrão Se Torna Utilizável uma vez por 2 segundos quando você Bloquear um Acerto" /
 * "sofrer um Acerto Selvagem"): o jogo a faz desde 11/10 (`gatilhoDeRetaliacao`, a janela de 2 s de `condicoes-poe.RETALIACAO`). Só a de 2
 * segundos (a janela do jogo); outro número seguiria "não simulado".
 */
const LINHA_DE_RETALIACAO = /^Não pode ser usado por padrão Se Torna Utilizável uma vez por 2 segundos? quando você (?:Bloquear um Acerto|sofrer um Acerto Selvagem)$/i;
export const ehLinhaDeRetaliacao = (l) => LINHA_DE_RETALIACAO.test(l);
const ESCUDOS = new Map();
export function escudoDaGema(slug, nivel = 1) {
  const g = POR_SLUG.get(slug);
  if (!g || !COMPILADOR?.textosDoNivel) return null;
  const n = Math.max(1, Math.min(nivel | 0 || 1, COMPILADOR.nivelMaximo?.(g) ?? 40));
  const k = `${slug}@${n}`;
  if (ESCUDOS.has(k)) return ESCUDOS.get(k);
  let base = null;
  const porDefesa = [];
  let critPorEs = null;
  for (const l of COMPILADOR.textosDoNivel(g, n)) {
    let m = /^(\d+(?:\.\d+)?) a (\d+(?:\.\d+)?) de Dano (?:de )?(Físico|Fogo|Gelo|Raio|Caos) Base (?:cmo a|como a|da) Mão Secund[aá]ria/i.exec(l);
    if (m) { base = { elemento: EL_DO_TEXTO[m[3]] ?? 'physical', min: Number(m[1]), max: Number(m[2]) }; continue; }
    m = /^(\d+(?:\.\d+)?) a (\d+(?:\.\d+)?) de Dano (?:de )?(Físico|Fogo|Gelo|Raio|Caos) Adicional por cada (\d+) de (Armadura ou Evasão|Armadura|Evasão) no Escudo/i.exec(l);
    if (m) { porDefesa.push({ elemento: EL_DO_TEXTO[m[3]] ?? 'physical', min: Number(m[1]), max: Number(m[2]), por: Number(m[4]), defesa: /ou/i.test(m[5]) ? 'armEva' : /Armadura/i.test(m[5]) ? 'armadura' : 'evasao' }); continue; }
    m = /^(\d+(?:\.\d+)?) a (\d+(?:\.\d+)?) de dano físico adicionado por (\d+) de armadura no escudo/i.exec(l);
    if (m) { porDefesa.push({ elemento: 'physical', min: Number(m[1]), max: Number(m[2]), por: Number(m[3]), defesa: 'armadura' }); continue; }
    m = /^\+?(\d+(?:\.\d+)?) ?% de Chance de Golpe Crítico da Mão Secundária por cada (\d+) de Escudo de Energia Máximo no Escudo/i.exec(l);
    if (m) critPorEs = { pct: Number(m[1]), por: Number(m[2]) };
  }
  const r = base || porDefesa.length || critPorEs ? { base, porDefesa, critPorEs } : null;
  ESCUDOS.set(k, r);
  return r;
}

/**
 * (17/10, lote G5) Os CLAMORES pelo PODER (PoE: "Conta o Poder total de Inimigos no Alcance" — `ModsPoe.poderDoClamor`, contado no uso): o buff
 * de cada clamor "por cada N de Poder, contando um máximo de M" — a regeneração de vida (Resistente), as resistências e o máximo delas
 * (Ancestral), o "mais Armadura" (Sísmico), a Fúria por segundo, o máximo e "impede a perda inerente" (Vingativo) —, as Cargas de Tolerância
 * por Poder (Resistente) e o "Ataques Impelidos causam Dano Dobrado" (Intimidador). `{ af, tolerancia }` no `poder` dado.
 */
const POR_PODER = [
  [/^Buff concede (\d+(?:\.\d+)?) ?% da Vida Regenerada por segundo por cada (\d+) de poder, contando um máximo de (\d+) de Poder$/i, (x) => ({ life_regen_pct: x })],
  [/^Buff concede \+(\d+(?:\.\d+)?) ?% de todas as Resistências Elementais por cada (\d+) de poder, contando um máximo de (\d+) de Poder$/i, (x) => ({ fire_res: x, ice_res: x, energy_res: x })],
  [/^Buff concede \+(\d+(?:\.\d+)?) ?% ao Máximo de todas as Resistências Elementais por cada (\d+) de Poder, contando um máximo de (\d+) de Poder$/i, (x) => ({ fire_res_max: x, ice_res_max: x, energy_res_max: x })],
  [/^Buff concede (\d+(?:\.\d+)?) ?% mais Armadura por cada (\d+) de Poder, contando um máximo de (\d+) de Poder$/i, (x) => ({ armour_mais: x })],
  [/^Buff concede (\d+(?:\.\d+)?) de Fúria por segundo por cada (\d+) de Poder, contando um máximo de (\d+) de Poder$/i, (x) => ({ 'periodico:1:furia': x })],
];
const LINHAS_FIXAS_DO_CLAMOR = [
  [/^Buff concede \+ ?(\d+) ao Máximo de Fúria Buff impede a perda inerente de Fúria$/i, (m) => ({ furia_max: Number(m[1]), furia_perda_lenta: 1e6 })],
  // (lote A1b, revisão do dono 19/10: o bônus do BUFF do Clamor vale só no ataque Impelido pelo Clamor — `impelidoClamor`; o Impelido pela Emboscada
  // "não pode ser Impelido por outras Habilidades")
  [/^Ataques Impelidos causam Dano Dobrado$/i, () => ({ 'chance_dano_dobrado@impelidoClamor': 100 })],
];
const TOLERANCIA_POR_PODER = /^Concede (\d+) Carga de Tolerância por cada (\d+) de Poder a Você e Jogadores Aliados$/i;
const CONTA_O_PODER = /^Conta o Poder total de Inimigos no Alcance$/i;
export const ehLinhaDoClamor = (l) => CONTA_O_PODER.test(l) || TOLERANCIA_POR_PODER.test(l) || POR_PODER.some(([re]) => re.test(l)) || LINHAS_FIXAS_DO_CLAMOR.some(([re]) => re.test(l));
export function clamorPeloPoder(slug, nivel = 1, poder = 0) {
  const af = {};
  let tolerancia = 0;
  const somar = (o, m = 1) => { for (const [k, v] of Object.entries(o)) af[k] = (af[k] ?? 0) + v * m; };
  for (const l of textosDaGema(slug, nivel).linhas) {
    for (const [re, f] of POR_PODER) {
      const m = re.exec(l);
      if (m) somar(f(Number(m[1])), Math.floor(Math.min(Math.max(0, poder), Number(m[3])) / Math.max(1, Number(m[2]))));
    }
    for (const [re, f] of LINHAS_FIXAS_DO_CLAMOR) { const m = re.exec(l); if (m) somar(f(m)); }
    const t = TOLERANCIA_POR_PODER.exec(l);
    if (t) tolerancia += Number(t[1]) * Math.floor(Math.max(0, poder) / Math.max(1, Number(t[2])));
  }
  return { af, tolerancia };
}

/**
 * (17/10, lote G6) As linhas de MARCA/maldição contra o amaldiçoado: `golpe` — atributos do seu golpe nele (`@ataque`: só com ataques) —, e
 * `morte` — o que o abate dele dá (`carga:<tipo>` = a chance, `vida`, `mana`).
 */
const CONTRA = [
  [/^Inimigos Amaldiçoados concedem ([\d.]+) ?% de Dreno de (Vida|Mana) quando Acertados por Ataques$/i, (m) => ({ golpe: { [`${m[2] === 'Vida' ? 'life' : 'mana'}_leech@ataque`]: Number(m[1]) } })],
  [/^Inimigos Amaldiçoados concedem (\d+) de (Vida|Mana) quando Acertados por Ataques$/i, (m) => ({ golpe: { [`${m[2] === 'Vida' ? 'life' : 'mana'}_on_hit@ataque`]: Number(m[1]) } })],
  [/^Inimigos Amaldiçoados possuem uma chance de (\d+) ?% de concederem uma Carga de (Tolerância|Frenesi|Poder) quando mortos$/i, (m) => ({ morte: { [`carga:${{ Tolerância: 'tolerancia', Frenesi: 'frenesi', Poder: 'poder' }[m[2]]}`]: Number(m[1]) } })],
  [/^Inimigos Amaldiçoados concedem (\d+) de (Vida|Mana) quando Mortos$/i, (m) => ({ morte: { [m[2] === 'Vida' ? 'vida' : 'mana']: Number(m[1]) } })],
  [/^Acertos contra Inimigos Amaldiçoados ganham \+([\d.]+) ?% de Chance de Acerto Crítico$/i, (m) => ({ golpe: { crit_chance: Number(m[1]) } })],
  [/^Hits against Cursed Enemies have \+(\d+) ?% to Critical Strike Multiplier$/i, (m) => ({ golpe: { crit_dmg: Number(m[1]) } })],
  [/^Adiciona (\d+) a (\d+) de Dano Físico aos Acertos contra Inimigos Amaldiçoados$/i, (m) => ({ golpe: { added_physical_dmg_min: Number(m[1]), added_physical_dmg_max: Number(m[2]) } })],
  [/^Inimigos Amaldiçoados concedem (\d+) de Fúria quando Atordoados$/i, (m) => ({ atordoar: { furia: Number(m[1]) } })],
  // (17/10, lote G18b) as chances e as durações das afecções no AMALDIÇOADO (o PoB: Self<Afecção>Chance/Duration no inimigo — valem nos acertos
  // nele; o Sangramento da Vulnerabilidade só nos ataques); e as da qualidade (a Fraqueza Elemental "reduzida" é um aumento — o sinal do PoB)
  [/^Acertos de Ataques contra Inimigos Amaldiçoados têm (\d+) ?% de chance de infligir Sangramento$/i, (m) => ({ golpe: { 'chance_bleed@ataque': Number(m[1]) } })],
  [/^Acertos contra Inimigos Amaldiçoados têm \+?(\d+) ?% de chance de (Incendiar|Eletrizar|Congelar)$/i, (m) => ({ golpe: { [{ Incendiar: 'chance_ignite', Eletrizar: 'chance_shock', Congelar: 'chance_freeze' }[m[2]]]: Number(m[1]) } })],
  [/^Acertos contra Inimigos Amaldiçoados têm (\d+) ?% de chance de dobrar a Duração do Atordoamento$/i, (m) => ({ golpe: { chance_dobrar_atordoamento: Number(m[1]) } })],
  [/^Duração do Incêndio em inimigos Amaldiçoados aumentada em ([\d.]+) ?%$/i, (m) => ({ golpe: { duracao_incendio: Number(m[1]) } })],
  [/^(Eletrização|Congelamento) em inimigos Amaldiçoados possui a Duração aumentada em ([\d.]+) ?%$/i, (m) => ({ golpe: { [m[1] === 'Eletrização' ? 'duracao_eletrizacao' : 'duracao_congelamento']: Number(m[2]) } })],
  [/^Duração de Afecções Elementais em inimigos Amaldiçoados reduzida em ([\d.]+) ?%$/i, (m) => ({ golpe: { duracao_afeccoes_elementais: Number(m[1]) } })],
  [/^Acertos de Ataques contra Inimigos Amaldiçoados têm ([\d.]+) ?% de chance de Agravar o Sangramento$/i, (m) => ({ golpe: { 'chance_agravar@ataque': Number(m[1]) } })],
];
export const ehLinhaContraOAmaldicoado = (l) => CONTRA.some(([re]) => re.test(l));
function contraOAmaldicoado(linhas = []) {
  const golpe = {};
  const morte = {};
  const atordoar = {};
  for (const l of linhas) for (const [re, f] of CONTRA) {
    const m = re.exec(l);
    if (!m) continue;
    const r = f(m);
    for (const [k, v] of Object.entries(r.golpe ?? {})) golpe[k] = (golpe[k] ?? 0) + v;
    for (const [k, v] of Object.entries(r.morte ?? {})) morte[k] = (morte[k] ?? 0) + v;
    for (const [k, v] of Object.entries(r.atordoar ?? {})) atordoar[k] = (atordoar[k] ?? 0) + v;
  }
  return { golpe, morte, atordoar };
}

// (lote 81: o G9 dos Arautos — o conjunto dos Arautos ao matar e a regra de uma linha — unificado com o lote 81: `LINHAS_DO_ARAUTO`)

/**
 * (17/10, lote G10) Os ESTÁGIOS DE CANALIZAÇÃO da gema (o PoE: cada uso enquanto canaliza ganha um estágio, até o máximo): `{ max, modo, mais,
 * critMais, velMais, raioM, raioMaxM, final, golpesFinais, porMs }` ou null (a gema não tem estágio que o jogo faça).
 *   `intensifica` — cada uso acerta com "X% mais Dano por estágio" (Lâminas Velozes, Incinerar); no MÁXIMO a canalização se libera sozinha: as
 *                   Lâminas Velozes soltam "um golpe adicional por cada estágio" (`golpesFinais`), o Incinerar a onda final ("A onda final causa
 *                   X% mais Dano com Acertos" — `final`);
 *   `carrega`     — os usos só carregam (Rajada de Chamas, Flecha Flagelante); no máximo, a liberação com o "X% mais Dano por estágio" × os estágios;
 *   `tempo`       — um estágio a cada N s canalizando (o Ciclone do Tumulto: "25% mais Velocidade de Ataque por Estágio").
 * O raio cresce "+X metros ao raio por estágio" (até o máximo da linha). O idle não solta o botão: a liberação no máximo é a abstração (a
 * canalização interrompida por outra habilidade perde os estágios, como a do PoE que não chegou a soltar).
 */
// (lote A4, dono 19/10: + a Rajada de Chamas Vaal, a Ira Divina, o Atirar e as Lâminas Velozes Vaal — só carregam até liberar)
const CARREGAM = /^(Flameblast|Scourge_Arrow|Vaal_Flameblast|Divine_Ire|Snipe$|Vaal_Blade_Flurry)/;
// (17/10, lote G18) o "mais" de cada estágio pela flag do PoB: "com Acertos e Afecções" (Hit|Ailment — o Incinerar, a Flecha Flagelante: `mais` e
// `maisAmbos`), "Mágico" (só o acerto — a Rajada de Chamas, ModFlag.Hit: só `mais`) e "com Afecções" (só as afecções — `maisAfeccao`); a onda final
// do Incinerar: o "com Acertos" (só o acerto), o "com Incêndio" (só o Incêndio) e o "sempre Incendeia". A qualidade entra (`linhasDaQualidade`).
const LINHAS_DE_ESTAGIO = [
  [/^\+?(\d+(?:\.\d+)?) ?% mais Dano com Acertos e Afecções por (?:cada )?estágio$/i, (m, e) => { e.mais += Number(m[1]); e.maisAmbos += Number(m[1]); }],
  [/^\+?(\d+(?:\.\d+)?) ?% mais Dano Mágico por (?:cada )?estágio$/i, (m, e) => { e.mais += Number(m[1]); }],
  [/^\+?(\d+(?:\.\d+)?) ?% mais Dano com Afecções por estágio$/i, (m, e) => { e.maisAfeccao += Number(m[1]); }],
  [/^(\d+(?:\.\d+)?) ?% mais Change? de Golpe Crítico por cada Estágio$/i, (m, e) => { e.critMais += Number(m[1]); }],
  [/^(\d+(?:\.\d+)?) ?% mais Velocidade de Ataque por Estágio$/i, (m, e) => { e.velMais += Number(m[1]); }],
  [/^Concede 1 Estágio a cada (\d+(?:\.\d+)?) segundos? enquanto Canalizando$/i, (m, e) => { e.porMs = Math.round(Number(m[1]) * 1000); }],
  [/^Perde 1 Estágio a cada (\d+(?:\.\d+)?) segundos? enquanto não Canalizada$/i, () => {}],
  [/^\+?(\d+(?:\.\d+)?) metros ao raio por estágio, máximo de \+(\d+(?:\.\d+)?) metros$/i, (m, e) => { e.raioM = Number(m[1]); e.raioMaxM = Number(m[2]); }],
  [/^A onda final causa \+?(\d+(?:\.\d+)?) ?% mais Dano com Acertos$/i, (m, e) => { e.final += Number(m[1]); }],
  [/^A onda final causa \+?(\d+(?:\.\d+)?) ?% mais Dano com Incêndio$/i, (m, e) => { e.finalIncendio += Number(m[1]); }],
  [/^onda final sempre Incendeia$/i, (m, e) => { e.finalIncendeia = true; }],
];
// (lote A4, dono 19/10: + as linhas de estágio do lote A4 — `GemasA4.LINHAS_DE_ESTAGIO_A4`)
export const ehLinhaDeEstagio = (l) => LINHAS_DE_ESTAGIO.some(([re]) => re.test(l)) || GemasA4.ehLinhaDeEstagioA4(l);
const ESTAGIOS = new Map();
/**
 * (lote A4, dono 19/10) + o máximo que só o PoB publica (`GemasA4.MAX_DO_POB` — a Rajada de Chamas Vaal, a Ira Divina, o Atirar, as Lâminas Velozes
 * Vaal, o Devastar — D6: 8) e os escritos de outro jeito (`GemasA4.LINHAS_DE_ESTAGIO_A4`: "4 Estágios Máximos", "+ 2 do máximo de Estágios", "+2
 * Estágios Máximos"); os modos sem canalizar (`acerto` — o Devastar —, `usos` — o Golpe Duplo do Ímpeto: `GemasA4.modoSemCanalizar`); o "mais" no
 * máximo (as Lâminas Velozes na qualidade), o "após o primeiro" da Ira Divina (o da afecção pelo PoB — D8), o raio por segundo das Gavinhas da
 * Escalada e o raio "após o primeiro" da Rajada Vaal (VaalFlameblastStageAfterFirst).
 */
export function estagiosDaGema(slug, nivel = 1, qualidade = 0) {
  const h = compilada(slug, nivel, qualidade);
  if (!h?.stats) return null;
  const q = Math.max(0, Number(qualidade) || 0);
  const k = `${slug}@${h.nivel}@${q}`;
  if (ESTAGIOS.has(k)) return ESTAGIOS.get(k);
  const e = { max: 0, mais: 0, maisAmbos: 0, maisAfeccao: 0, critMais: 0, velMais: 0, raioM: h.stats.raioPorEstagio ?? 0, raioMaxM: null, final: 0, finalIncendio: 0, finalIncendeia: false, golpesFinais: /^Blade_Flurry/.test(slug), porMs: 0,
    maxEscrito: null, maxExtra: 0, maisNoMax: 0, critMultNoMax: 0, maisAcertoAposPrimeiro: 0, maisAfeccaoAposPrimeiro: 0, menosMovimentoPct: 0, cadaUsos: 0, areaMaisPorEstagioPct: 0, raioAposPrimeiro: slug === 'Vaal_Flameblast' };
  for (const l of [...textosDaGema(slug, nivel).linhas, ...(q ? linhasDaQualidade(POR_SLUG.get(slug), q / 20) : [])]) {
    for (const [re, f] of LINHAS_DE_ESTAGIO) { const m = re.exec(l); if (m) f(m, e); }
    const t = String(l).replace(/(\d)%/g, '$1 %').replace(/\s+/g, ' ').trim();
    for (const [re, f] of GemasA4.LINHAS_DE_ESTAGIO_A4) { const m = re.exec(t); if (m) f(m, e); }
  }
  // (o "50% mais Área de Efeito por cada estágio" do Devastar é um "mais" da área — o compilador o lia como metros de raio)
  if (e.areaMaisPorEstagioPct) e.raioM = 0;
  // (a Ira Divina: a afecção do PoB, não a do poedb)
  if (GemasA4.IRA_DIVINA_AFECCAO_DO_POB[slug] != null && e.maisAcertoAposPrimeiro) e.maisAfeccaoAposPrimeiro = GemasA4.IRA_DIVINA_AFECCAO_DO_POB[slug];
  // (o Atirar: a flecha própria com o "mais por Estágio do Tiro" — só o acerto e só a afecção — na liberação, como as suportadas)
  const sn = GemasA4.snipeDasLinhas(slug, textosDaGema(slug, nivel).linhas);
  if (sn) { e.mais += sn.maisAcertoPct; e.maisAfeccao += sn.maisAfeccaoPct; }
  // (o Atirar: + 0,05 estágio por ponto de qualidade — snipe_max_stacks do PoB; o poedb não tem a linha)
  const doPob = GemasA4.MAX_DO_POB[slug];
  const base = h.stats.estagios ?? doPob ?? e.maxEscrito ?? 0;
  e.max = Math.floor(base + e.maxExtra + (slug === 'Snipe' ? 0.05 * q : 0) + 1e-9);
  e.modo = e.porMs ? 'tempo' : CARREGAM.test(slug) ? 'carrega' : GemasA4.modoSemCanalizar(slug) ?? 'intensifica';
  // (revisão do A4: a Rajada Vaal explode a cada 3 estágios; o Devastar Vaal começa com 4)
  e.explodeCada = GemasA4.EXPLODE_CADA[slug] ?? 0;
  e.iniciais = GemasA4.ESTAGIOS_INICIAIS_DO_POB[slug] ?? 0;
  // (a Maré Invernal: os estágios são do debuff no inimigo — `debuffDaGema`; o Orbe Invernal: do orbe — `orbeDaGema`)
  const deOutro = !!GemasA4.debuffDasLinhas(slug, textosDaGema(slug, nivel).linhas) || /^Winter_Orb/.test(slug);
  const tem = e.mais || e.maisAfeccao || e.critMais || e.velMais || e.raioM || e.final || e.finalIncendio || e.finalIncendeia || e.golpesFinais || e.maisNoMax || e.critMultNoMax || e.maisAcertoAposPrimeiro || e.areaMaisPorEstagioPct || e.menosMovimentoPct || ['carrega', 'acerto', 'usos'].includes(e.modo);
  const r = e.max > 0 && tem && !deOutro ? e : null;
  ESTAGIOS.set(k, r);
  return r;
}

/**
 * (17/10, lote G11) A SEQUÊNCIA DE ÁREAS da Ruptura (Sunder): a onda causa dano em N áreas em linha à sua frente ("Onda causa Dano em 5 Áreas"),
 * cada uma com o raio-base da gema + "+X metros de raio para cada área anterior"; até M inimigos acertados em cada área soltam uma ONDA DE
 * CHOQUE ("Onda causa Ondas de Choque de até 5 Inimigos em cada Área") com "X% menos Dano". `{ areas, raioM, porAreaM, choques, choqueMenos }`
 * ou null. (O "delay entre Áreas" e o "não pode parar antes de N Áreas" são do tempo da onda e da interrupção pelo novo uso: o idle resolve a
 * onda inteira no uso — sem efeito aqui.)
 */
const LINHA_DA_SEQUENCIA = /^Onda causa Dano em \d+ Áreas$|^Áreas de onda ganham \+[\d.]+ metros de raio para cada área anterior(?: da onda)?$|^Onda causa Ondas de Choque de até \d+ Inimigos em cada Área$|^Ondas de Choque causam \d+ ?% menos Dano$|^Onda tem o delay entre Áreas reduzido em [\d.]+ ?%$|^Onda não pode parar antes de causar Dano em \d+ Áreas$/i;
export const ehLinhaDaSequencia = (l) => LINHA_DA_SEQUENCIA.test(l);
/**
 * (lote A4, dono 19/10: R2) + as outras formas da sequência (`GemasA4.sequenciaDasLinhas`): a Chuva de Lâminas (`retangulo` — D4), a Colisão de
 * Gelo (`concentrica`) e o Estilhaçar a Terra (`estrela`, com as estacas — D5). A da Ruptura é a `linha`.
 */
export function sequenciaDaGema(slug, nivel = 1, qualidade = 0) {
  if (!/^Sunder/.test(slug)) {
    const a4 = /^(Bladefall|Ice_Crash|Earthshatter)/.test(slug) ? GemasA4.sequenciaDasLinhas(slug, textosDaGema(slug, nivel).linhas, linhasDaQualidadeDe(slug, qualidade)) : null;
    return a4;
  }
  const linhas = textosDaGema(slug, nivel).linhas;
  const achar = (re) => { for (const l of linhas) { const m = re.exec(l); if (m) return Number(m[1]); } return null; };
  const areas = achar(/^Onda causa Dano em (\d+) Áreas$/i);
  if (!areas) return null;
  return {
    forma: 'linha', areas, raioM: areaNoNivel(slug, nivel, qualidade).raioM ?? 1.2, porAreaM: achar(/^Áreas de onda ganham \+([\d.]+) metros/i) ?? 0,
    choques: achar(/^Onda causa Ondas de Choque de até (\d+) Inimigos em cada Área$/i) ?? 0, choqueMenos: achar(/^Ondas de Choque causam (\d+) ?% menos Dano$/i) ?? 0,
  };
}

/**
 * (17/10, lote G11) Os GOLPES REPETIDOS NO TEMPO da Armadilha de Torre Elétrica: ativada, ela "Ataca a cada X segundos" pela "Duração base",
 * golpeando "N Áreas" a cada vez (`Acoes.tiqueDasTorres`). `{ intervaloMs, duracaoMs, areas }` ou null.
 */
const LINHA_DA_TORRE = /^Ataca a cada [\d.]+ segundos?$|^Golpeia \d+ Áreas$|^Golpeia \+[\d.]+ Áreas? adiciona(?:l|is)$|^Modificadores à Velocidade de Arremesso de Armadilhas também se aplicam à Frequência dos golpes$/i;
export const ehLinhaDaTorre = (l) => LINHA_DA_TORRE.test(l);
export function torreDaGema(slug, nivel = 1, qualidade = 0) {
  if (!/^Lightning_Spire_Trap/.test(slug)) return null;
  const linhas = textosDaGema(slug, nivel).linhas;
  const achar = (re) => { for (const l of linhas) { const m = re.exec(l); if (m) return Number(m[1]); } return null; };
  const intervalo = achar(/^Ataca a cada ([\d.]+) segundos?$/i);
  // (lote G18b: + a qualidade — "Golpeia +1 Área adicional")
  const areas = achar(/^Golpeia (\d+) Áreas$/i) + linhasDaQualidadeDe(slug, qualidade).reduce((t, l) => { const m = /^Golpeia \+([\d.]+) Áreas? adiciona(?:l|is)$/i.exec(l); return t + (m ? Math.floor(Number(m[1])) : 0); }, 0);
  if (!intervalo || !areas) return null;
  return { intervaloMs: Math.round(intervalo * 1000), duracaoMs: Math.round((compilada(slug, nivel, qualidade)?.stats?.duracao ?? 3.5) * 1000), areas, velocidadeDeArremesso: linhas.some((l) => /Frequência dos golpes/i.test(l)) };
}

/*
 * ---- (lote A4, dono 19/10) os leitores no nível das gemas do lote A4 (`itens-poe/gemas-a4.mjs`: os dados e as contas) ----
 */
const comCache = (mapa, k, f) => { if (!mapa.has(k)) mapa.set(k, f()); return mapa.get(k); };
const A4 = new Map();
const linhasA4 = (slug, nivel, qualidade) => [textosDaGema(slug, nivel).linhas, linhasDaQualidadeDe(slug, qualidade)];
/** (R1) A repetição própria da gema (`GemasA4.repeticoesDasLinhas`): a Procissão, a Nova de Gelo Vaal. */
export const repeticoesDaGema = (slug, nivel = 1, qualidade = 0) => comCache(A4, `rep|${slug}@${nivel | 0}@${qualidade | 0}`, () => GemasA4.repeticoesDasLinhas(slug, linhasA4(slug, nivel, qualidade).flat()));
/** (D7) O ângulo da forma da gema (`GemasA4.anguloDasLinhas`). */
export const anguloDaGema = (slug, nivel = 1, qualidade = 0) => comCache(A4, `ang|${slug}@${nivel | 0}@${qualidade | 0}`, () => GemasA4.anguloDasLinhas(linhasA4(slug, nivel, qualidade).flat()));
/** A Ira Divina (os toques ao ganhar estágio, a explosão e o feixe da liberação). */
export const iraDivinaDaGema = (slug, nivel = 1, qualidade = 0) => comCache(A4, `ira|${slug}@${nivel | 0}@${qualidade | 0}`, () => GemasA4.iraDivinaDasLinhas(slug, ...linhasA4(slug, nivel, qualidade)));
/** O círculo das Lâminas Velozes Vaal. */
export const circuloDaGema = (slug, nivel = 1) => comCache(A4, `cir|${slug}@${nivel | 0}`, () => GemasA4.circuloDasLinhas(slug, textosDaGema(slug, nivel).linhas));
/** O "mais por Estágio do Tiro" do Atirar. */
export const snipeDaGema = (slug, nivel = 1) => comCache(A4, `sni|${slug}@${nivel | 0}`, () => GemasA4.snipeDasLinhas(slug, textosDaGema(slug, nivel).linhas));
/*
 * ---- (lote A3b, dono 19/10) o leitor no nível do lote A3b (`itens-poe/gemas-a3b.mjs`: os objetos que ficam no chão ou no tempo) ----
 */
const A3B = new Map();
/** O objeto que o uso da gema deixa (`GemasA3b.objetoDaGema`): a bola, o tornado, a espiral, o olho, o marcador, o chão, as lâminas, a captura. */
// (lote B1, dono 20/10 — D-B1.10: + o marcador da Invocar Tormenta, `GemasB1.tormentaDasLinhas`)
export const objetoDaGema = (slug, nivel = 1, qualidade = 0) => comCache(A3B, `obj|${slug}@${nivel | 0}@${qualidade | 0}`, () => GemasA3b.objetoDaGema(slug, textosDaGema(slug, nivel).linhas, linhasDaQualidadeDe(slug, qualidade), compilada(slug, nivel, qualidade)?.stats ?? {}) ?? GemasB1.tormentaDasLinhas(slug, linhasDaQualidadeDe(slug, qualidade), compilada(slug, nivel, qualidade)?.stats ?? {}) ?? GemasPR1.objetoDasLinhas(slug, textosDaGema(slug, nivel).linhas));
/** (D2) O que a gema faz com os seus Disparos Congelantes (a Nova Glacial dos Disparos, o Vórtice da Projeção). */
export const consomeDisparosDaGema = (slug, nivel = 1) => comCache(A3B, `con|${slug}@${nivel | 0}`, () => GemasA3b.consomeDisparos(slug, textosDaGema(slug, nivel).linhas));
/** Os esporos da Flecha Flagelante. */
export const esporosDaGema = (slug, nivel = 1, qualidade = 0) => comCache(A4, `esp|${slug}@${nivel | 0}@${qualidade | 0}`, () => GemasA4.esporosDasLinhas(slug, ...linhasA4(slug, nivel, qualidade)));
/** O Orbe Invernal (o objeto no tempo). */
export const orbeDaGema = (slug, nivel = 1, qualidade = 0) => comCache(A4, `orb|${slug}@${nivel | 0}@${qualidade | 0}`, () => GemasA4.orbeDasLinhas(slug, ...linhasA4(slug, nivel, qualidade)));
/** Os debuffs com estágios (a Maré Invernal, o Raio Abrasador). */
export const debuffDaGema = (slug, nivel = 1, qualidade = 0) => comCache(A4, `deb|${slug}@${nivel | 0}@${qualidade | 0}`, () => GemasA4.debuffDasLinhas(slug, ...linhasA4(slug, nivel, qualidade), qualidade));
/** (C) A área do Ciclone por alcance ("X% por cada 0.1 metro de Alcance … adicional", o nível e a qualidade) e o "menos Velocidade de Movimento". */
export const areaPorAlcanceDaGema = (slug, nivel = 1, qualidade = 0) => comCache(A4, `alc|${slug}@${nivel | 0}@${qualidade | 0}`, () => GemasA4.areaPorAlcanceDasLinhas(linhasA4(slug, nivel, qualidade).flat()));
export const menosMovimentoDaGema = (slug, nivel = 1) => comCache(A4, `mov|${slug}@${nivel | 0}`, () => GemasA4.menosMovimentoDasLinhas(slug, textosDaGema(slug, nivel).linhas));
/*
 * ---- (lote A1b, dono 19/10) os leitores no nível do lote A1b (`itens-poe/movimento-a1b.mjs`: os dados e as contas da Investida Carregada e das outras
 * gemas de movimento) ----
 */
const A1B = new Map();
const linhasA1b = (slug, nivel, qualidade) => [textosDaGema(slug, nivel).linhas, linhasDaQualidadeDe(slug, qualidade)];
/** (I1–I7) A miragem da Investida Carregada (a velocidade, a onda final, o "+150%" parada, os números do PoB/poedb). */
export const miragemDaGema = (slug, nivel = 1, qualidade = 0) => (GemasA1b.MIRAGEM[slug] ? comCache(A1B, `mir|${slug}@${nivel | 0}@${qualidade | 0}`, () => GemasA1b.miragemDasLinhas(slug, ...linhasA1b(slug, nivel, qualidade))) : null);
/** As cargas no acerto do Golpe Súbito (a Frenesi no acerto, o Poder no crítico) e do Estalo Gélido do Poder (lote B1: o Poder no crítico). */
export const cargasNoAcertoDaGema = (slug, nivel = 1, qualidade = 0) => comCache(A1B, `car|${slug}@${nivel | 0}@${qualidade | 0}`, () => (/^Flicker_Strike|^Cold_Snap_of_Power$/.test(slug) ? GemasA1b.cargasNoAcertoDasLinhas(...linhasA1b(slug, nivel, qualidade)) : null));
/** (D-b) A Emboscada. */
export const emboscadaDaGema = (slug, nivel = 1, qualidade = 0) => comCache(A1B, `emb|${slug}@${nivel | 0}@${qualidade | 0}`, () => GemasA1b.emboscadaDasLinhas(slug, ...linhasA1b(slug, nivel, qualidade)));
/** O Teleporte Gélido da Explosão Invernal (o "mais" contra o resfriado). */
export const explosaoInvernalDaGema = (slug, nivel = 1, qualidade = 0) => comCache(A1B, `inv|${slug}@${nivel | 0}@${qualidade | 0}`, () => GemasA1b.explosaoInvernalDasLinhas(slug, ...linhasA1b(slug, nivel, qualidade)));
/*
 * ---- (lote A5, dono 20/10) os leitores no nível do lote A5 (`itens-poe/gemas-a5.mjs`) ----
 */
const A5 = new Map();
/** (f34 D1/D2) O Condutor Elétrico: o "mais" por cada 5% de Eletrização no alvo, e tira a Eletrização. */
export const condutorDaGema = (slug, nivel = 1, qualidade = 0) => comCache(A5, `con|${slug}@${nivel | 0}@${qualidade | 0}`, () => GemasA5.condutorDasLinhas(slug, ...linhasA1b(slug, nivel, qualidade)));
/** (D4) O raio (m) do Solo Resfriado da gema (o Estalo Gélido), da linha; null sem ela. */
export const raioDaAreaFriaDaGema = (slug, nivel = 1) => comCache(A5, `fri|${slug}@${nivel | 0}`, () => GemasA5.raioDaAreaFriaDasLinhas(textosDaGema(slug, nivel).linhas));
/** (f34 D8/D9) A Exposição que a gema põe (a Bomba Congelante, a Onda de Convicção). */
export const exposicaoDaGema = (slug, nivel = 1) => comCache(A5, `exp|${slug}@${nivel | 0}`, () => GemasA5.exposicaoDasLinhas(slug, textosDaGema(slug, nivel).linhas));
/** (f12 #34) O Golpe Duplo da Ambidestria usa o tempo de ataque da arma secundária. */
export const usaTempoDaSecundaria = (slug) => comCache(A5, `sec|${slug}`, () => GemasA5.usaTempoDaSecundariaDasLinhas(textosDaGema(slug, 1).linhas));
/** (f12 #36) A Detonação da Adaga: o % do dano da adaga como Dano Mágico adicional. */
export const detonacaoDaAdagaDaGema = (slug, nivel = 1) => comCache(A5, `ada|${slug}@${nivel | 0}`, () => (slug === 'Blade_Blast_of_Dagger_Detonation' ? GemasA5.detonacaoDaAdagaDasLinhas(textosDaGema(slug, nivel).linhas) : null));
/*
 * ---- (lote PR1, dono 20/10) os leitores no nível do lote PR1 (`itens-poe/gemas-pr1.mjs`) ----
 */
const PR1 = new Map();
/** A chance (%) de Carga de Poder por projétil que acerta um Raro ou Único (o Sifão de Poder; a Vaal: 100). */
export const cargaDoSifaoDaGema = (slug, nivel = 1) => comCache(PR1, `sif|${slug}@${nivel | 0}`, () => (/^(Vaal_)?Power_Siphon/.test(slug) ? GemasPR1.cargaDoSifaoDasLinhas(textosDaGema(slug, nivel).linhas) : 0));
/** As estilhas do Arremesso de Escudo Espectral (`GemasPR1.estilhasDasLinhas`). */
export const estilhasDaGema = (slug, nivel = 1) => comCache(PR1, `est|${slug}@${nivel | 0}`, () => GemasPR1.estilhasDasLinhas(slug, textosDaGema(slug, nivel).linhas));
/** O "Vida Máxima aumentada" (%) dos cadáveres que a gema cria (a qualidade do Desenterrar). */
export const vidaDoCadaverDaGema = (slug, qualidade = 0) => comCache(PR1, `cad|${slug}@${qualidade | 0}`, () => GemasPR1.vidaDoCadaverDasLinhas(linhasDaQualidadeDe(slug, qualidade)));
/*
 * ---- (lote B1, dono 20/10) os leitores no nível do lote B1 (`itens-poe/gemas-b1.mjs`) ----
 */
const B1 = new Map();
/** A Descarga: o "mais Área por Carga removida" e a chance de não remover. */
export const descargaDaGema = (slug, nivel = 1, qualidade = 0) => comCache(B1, `des|${slug}@${nivel | 0}@${qualidade | 0}`, () => GemasB1.descargaDasLinhas(slug, ...linhasA1b(slug, nivel, qualidade)));
/** O Condutor Elétrico dos Céus: o máximo de alvos. */
export const maxAlvosDaGema = (slug, nivel = 1, qualidade = 0) => comCache(B1, `max|${slug}@${nivel | 0}@${qualidade | 0}`, () => GemasB1.maxAlvosDasLinhas(slug, ...linhasA1b(slug, nivel, qualidade)));
/** (D-B1.8) A Chuva de Flechas Vaal: o total de sequências (1 + as adicionais). */
export const sequenciasDaChuvaDaGema = (slug, nivel = 1) => comCache(B1, `seq|${slug}@${nivel | 0}`, () => GemasB1.sequenciasDaChuvaDasLinhas(textosDaGema(slug, nivel).linhas));
/** (D-B1.9) A Chuva Tóxica do Definhamento: 1 Definhamento de 2 s por uso. */
export const definhamentoDaChuvaDaGema = (slug, nivel = 1) => comCache(B1, `def|${slug}@${nivel | 0}`, () => GemasB1.definhamentoDaChuvaDasLinhas(textosDaGema(slug, nivel).linhas));
/** A Bomba Congelante: a Regeneração de Vida reduzida do debuff. */
export const regenMenosDaGema = (slug, nivel = 1) => comCache(B1, `reg|${slug}@${nivel | 0}`, () => GemasB1.regenMenosDasLinhas(slug, textosDaGema(slug, nivel).linhas));
/** (D-B1.3) A Bomba Congelante da Aproximação: o "mais" por 0,1 s de duração. */
export const porDuracaoDaGema = (slug, nivel = 1) => comCache(B1, `dur|${slug}@${nivel | 0}`, () => GemasB1.porDuracaoDasLinhas(textosDaGema(slug, nivel).linhas));
/** (D-B1.6/D-B1.7) O chão dos Estalos Gélidos: o raio que cresce e as cargas. */
export const estaloDaGema = (slug, nivel = 1) => comCache(B1, `est|${slug}@${nivel | 0}`, () => GemasB1.estaloDasLinhas(slug, textosDaGema(slug, nivel).linhas));
/** "Tempo de Conjuração desta Magia é adicionado à sua Recarga se Ativada" (o Condutor Elétrico; a Explosão Invernal do A1b). */
export const conjuracaoNaRecargaSeAtivada = (slug) => comCache(B1, `cnr|${slug}`, () => textosDaGema(slug, 1).linhas.some((l) => GemasB1.LINHA_CONJURACAO_NA_RECARGA.test(String(l).trim())));
/** A Corrente com Gancho: o raio por Fúria. */
export const raioPorFuriaDaGema = (slug, nivel = 1) => comCache(A1B, `fur|${slug}@${nivel | 0}`, () => (slug === 'Chain_Hook' ? GemasA1b.raioPorFuriaDasLinhas(textosDaGema(slug, nivel).linhas) : null));
/** A Investida com Escudo: o atordoamento na distância máxima. */
export const atordoamentoDaInvestidaDaGema = (slug, nivel = 1) => comCache(A1B, `ato|${slug}@${nivel | 0}`, () => (slug === 'Shield_Charge' ? GemasA1b.atordoamentoDaInvestidaDasLinhas(textosDaGema(slug, nivel).linhas) : 0));
/** (D-e) A Corrida de Fase Antiga. */
export const corridaDeFaseDaGema = (slug, nivel = 1) => comCache(A1B, `fas|${slug}@${nivel | 0}`, () => GemasA1b.corridaDeFaseDasLinhas(slug, textosDaGema(slug, nivel).linhas));
/** (D-f) A chance de Causticar do Avanço Ardente do Retorno (o nível e a qualidade). */
export const chanceDeCausticarDaGema = (slug, nivel = 1, qualidade = 0) => comCache(A1B, `cau|${slug}@${nivel | 0}@${qualidade | 0}`, () => (slug === 'Flame_Dash_of_Return' ? GemasA1b.chanceDeCausticarDasLinhas(linhasA1b(slug, nivel, qualidade).flat()) : 0));
/** (D-c) Quantos usos o Teleporte Relampejante aglomera na fila. */
export const filaDoTeleporteDaGema = (slug, nivel = 1) => comCache(A1B, `fil|${slug}@${nivel | 0}`, () => GemasA1b.filaDoTeleporteDasLinhas(slug, textosDaGema(slug, nivel).linhas));

/**
 * (17/10, lote G12) O USO DE CADÁVERES das gemas (os cadáveres da caçada — `hunt.cadaveres`, com a Vida Máxima do morto): a EXPLOSÃO ("Explosão
 * causa Dano de Fogo base igual a X% da Vida Máxima do Cadáver" — sem os modificadores de dano mágico, no raio da explosão) e o modo de cada
 * gema: `detonar` (Detonar os Mortos: o cadáver mais perto do alvo explode, com o dano mágico da gema em volta dele; a do Saque não mira os
 * criados e não tem dano mágico), `todos` (a Vaal: todos os cadáveres em volta do alvo), `consumir` (Mortos Voláteis: até N cadáveres perto do
 * alvo explodem, e cada um solta um orbe que causa o dano mágico em volta do inimigo mais perto), `geiser` (Cremação: o cadáver explode e vira
 * um gêiser que dispara N projéteis a cada intervalo pela duração, até o máximo de gêiseres). Sem cadáver, a gema não sai.
 */
const MODO_DO_CADAVER = { Detonate_Dead: 'detonar', Vaal_Detonate_Dead: 'todos', Volatile_Dead: 'consumir', Cremation: 'geiser' };
const LINHA_DE_CADAVER_DA_GEMA = /^Explosão causa Dano de Fogo base igual a [\d.]+ ?% da Vida M[áa]xima do Cad[áa]ver$|^Consome até \d+ cadáveres$|^Raio Base da explos[aã]o igual a [\d.]+ metros?$|^Dispara Projéteis a cada [\d.]+ segundos?$|^Máximo de \d+ gêiseres por vez$|^Máximo de \d+ Orbes por vez$/i;
export const ehLinhaDeCadaverDaGema = (l) => LINHA_DE_CADAVER_DA_GEMA.test(l);
export function cadaverDaGema(slug, nivel = 1, qualidade = 0) {
  const base = slug.replace(/_of_.*$/, '');
  const modo = MODO_DO_CADAVER[base];
  if (!modo) return null;
  const linhas = textosDaGema(slug, nivel).linhas;
  const achar = (re) => { for (const l of linhas) { const m = re.exec(l); if (m) return Number(m[1]); } return null; };
  const pct0 = achar(/^Explosão causa Dano de Fogo base igual a ([\d.]+) ?% da Vida M[áa]xima do Cad[áa]ver$/i);
  if (pct0 == null) return null;
  // (lote B1, dono 20/10: a QUALIDADE — o "+X% da Vida Máxima do Cadáver" do Detonar Mortos da Limpeza, o "X% de chance de detonar um cadáver adicional" do
  // Detonar Mortos e do Vaal e o "Dispara Projéteis X% mais rápido" da Cremação — `GemasB1`)
  const daQ = linhasDaQualidadeDe(slug, qualidade);
  const pct = pct0 + daQ.reduce((t, l) => t + (Number(/^Explosão causa Dano de Fogo base igual a ([\d.]+) ?% da Vida M[áa]xima do Cad[áa]ver$/i.exec(String(l).replace(/(\d)%/g, '$1 %').trim())?.[1]) || 0), 0);
  const maisRapidoPct = GemasB1.geiserMaisRapidoDasLinhas(daQ);
  const st = compilada(slug, nivel, qualidade)?.stats ?? {};
  return {
    modo, pct, soMortos: /Scavenging/.test(slug), comDano: !!Object.keys(st.dano ?? {}).length,
    raioExplosaoM: achar(/^Raio Base da explos[aã]o igual a ([\d.]+) metros?$/i) ?? achar(/^O raio Base é de ([\d.]+) metros?$/i) ?? 1.5,
    maximo: achar(/^Consome até (\d+) cadáveres$/i) ?? 1, adicionalPct: GemasB1.cadaverAdicionalDasLinhas(daQ),
    ...(modo === 'geiser' ? { geiser: { intervaloMs: Math.round(((achar(/^Dispara Projéteis a cada ([\d.]+) segundos?$/i) ?? 1) * 1000) / (1 + maisRapidoPct / 100)), duracaoMs: Math.round((st.duracao ?? 8) * 1000), projeteis: achar(/^Dispara (\d+) projéteis$/i) ?? 4, max: achar(/^Máximo de (\d+) gêiseres por vez$/i) ?? 3 } } : {}),
  };
}

/**
 * (17/10, lote G13) As linhas que outros sistemas já fazem e o status não reconhecia: as da RUNA (`runas-vinculadas.daGema` lê "É Ativado a cada",
 * "Pode ser Vinculada/Desvinculada por uma Duração total de N segundos", a troca de alvo, as Runas adicionais, a Ativada uma vez) e as do
 * ESTANDARTE (`mods-poe.plantarEstandarte`: o "X% mais Área de Efeito / Efeito de Aura por Valor consumido" e o ganho de Valor).
 */
const LINHA_DA_RUNA = /^É Ativad[ao] a cada (?:[\d.]+ )?segundos? enquanto Vinculad[ao]$|^Pode ser (?:Des)?[Vv]inculada por uma Duração total de [\d.]+ segundos?$|^Vincula a um novo Inimigo após ser Ativada, não mais que uma vez a cada [\d.]+ segundos?$|^Pode ter \d+ Runas? adiciona(?:l|is) Vinculadas? a um Inimigo$|^É Ativado uma vez quando Vinculada, então é Destruída$|^Causa \+?[\d.]+ ?% (?:mais|menos) Dano com Acertos contra o Inimigo Vinculado$/i;
const LINHA_DO_ESTANDARTE = /^Enquanto você não tiver nenhum Estandarte plantado, você pode ganhar Valor$|^[\d.]+ ?% mais (?:Área de Efeito|Efeito de Aura) por Valor consumido$/i;
export const ehLinhaDaRuna = (l) => LINHA_DA_RUNA.test(l);
export const ehLinhaDoEstandarte = (l) => LINHA_DO_ESTANDARTE.test(l);
/** (lote G13) "Causa X% mais/menos Dano com Acertos contra o Inimigo Vinculado" (a Runa): o % (negativo no "menos"), ou 0. */
export function contraOVinculado(slug, nivel = 1, qualidade = 0) {
  // (lote G18b: + a qualidade — "Causa +10 % mais Dano com Acertos contra o Inimigo Vinculado" — o mesmo stat, soma)
  let t = 0;
  for (const l of [...textosDaGema(slug, nivel).linhas, ...linhasDaQualidadeDe(slug, qualidade)]) { const m = /^Causa \+?([\d.]+) ?% (mais|menos) Dano com Acertos contra o Inimigo Vinculado$/i.exec(l); if (m) t += (m[2] === 'menos' ? -1 : 1) * Number(m[1]); }
  return t;
}
/**
 * (lote G13) As linhas das MINAS da gema: "Dispara um Projétil adicional para cada N Minas anteriores na Sequência de Detonação" (`porAnteriores`),
 * "Cada Mina aplica Chance de Golpe Crítico de Acertos aumentada em X% contra Inimigos próximos a ela, até Y%" (`auraCritico`) e "Cada mina aplica
 * Dano aumentado em X% aos Inimigos próximos máximo de Y%" (`auraDano` — o dano sofrido, `minaFragil`). `{…}` ou null.
 */
const LINHA_DA_MINA = /^Dispara um Projétil adicional para cada \d+ Minas anteriores na Sequência de Detonação$|^Cada Mina aplica Chance de Golpe Crítico de Acertos aumentada em [\d.]+ ?% contra Inimigos próximos a ela, até um máximo de [\d.]+ ?%$|^Cada mina aplica Dano aumentado em [\d.]+ ?% aos Inimigos próximos máximo de [\d.]+ ?%$/i;
export const ehLinhaDaMina = (l) => LINHA_DA_MINA.test(l);
export function minaDaGema(slug, nivel = 1) {
  const r = {};
  for (const l of textosDaGema(slug, nivel).linhas) {
    let m = /^Dispara um Projétil adicional para cada (\d+) Minas anteriores/i.exec(l);
    if (m) r.porAnteriores = Number(m[1]);
    m = /^Cada Mina aplica Chance de Golpe Crítico de Acertos aumentada em ([\d.]+) ?% contra Inimigos próximos a ela, até um máximo de ([\d.]+)/i.exec(l);
    if (m) r.auraCritico = { porMina: Number(m[1]), teto: Number(m[2]) };
    m = /^Cada mina aplica Dano aumentado em ([\d.]+) ?% aos Inimigos próximos máximo de ([\d.]+)/i.exec(l);
    if (m) r.auraDano = { porMina: Number(m[1]), teto: Number(m[2]) };
  }
  return Object.keys(r).length ? r : null;
}

/** As linhas de ataque que o jogo faz: "Não causa Dano não-Elemental" e "X% mais Dano por cada tipo de Afecção Elemental no Inimigo". */
const LINHA_DE_ATAQUE = /^Não causa Dano não-Elemental$|^Apenas Causa Dano do Elemento escolhido|mais Dano por cada tipo de Afecção Elemental no Inimigo/i;
export const ehLinhaDeAtaque = (l) => LINHA_DE_ATAQUE.test(l);
export function extrasDoAtaque(slug, nivel = 1, qualidade = 0) {
  const g = POR_SLUG.get(slug);
  const linhas = g && COMPILADOR?.textosDoNivel ? COMPILADOR.textosDoNivel(g, Math.max(1, Math.min(nivel | 0 || 1, COMPILADOR.nivelMaximo?.(g) ?? 40))) : [];
  // (revisão do A5 — D2: sem o teto de 20, linear como as outras linhas da qualidade)
  const daQualidade = qualidade > 0 ? (g?.qualidade ?? []).map((t) => naFracao(t, qualidade / 20)) : [];
  let porAfeccao = 0;
  for (const l of [...linhas, ...daQualidade]) { const m = String(l).match(/\+?(\d+(?:[.,]\d+)?) ?% mais Dano por cada tipo de Afecção Elemental no Inimigo/i); if (m) porAfeccao += Number(m[1].replace(',', '.')); }
  return { soElemental: linhas.some((l) => /^Não causa Dano não-Elemental$/i.test(l)), umElemento: linhas.some((l) => /^Apenas Causa Dano do Elemento escolhido/i.test(l)), porAfeccao };
}
/**
 * DUAS ARMAS (PoE): a % do dano com que o ataque acerta COMBINANDO as duas armas — "Quando em Dupla Empunhadura, Causa 60 % do Dano
 * combinando cada Arma" (Cutilada), 75 nas Lâminas Giratórias, 100 no Ataque Combinado (Dual Strike: "causando o dano de ambas em um ataque"). null: o
 * ataque ALTERNA entre as armas, como todo ataque do PoE.
 */
const COMBINA_AS_ARMAS = /Quando em Dupla Empunhadura, Causa (\d+(?:[.,]\d+)?) ?% do Dano combinando cada Arma/i;
// (lote A5, dono 20/10 — D5: + o Golpe da Víbora — "Se em empunhadura dupla, golpeará com ambas as armas" — e o da Mamba — "causa o dano de ambas as armas em um
// golpe": a soma das duas armas num acerto, como o Ataque Combinado; o PoB: skill_double_hits_when_dual_wielding)
const DANO_DE_AMBAS = /Ataca com ambas as armas, causando o dano de ambas em um ataque|Se em empunhadura dupla, golpeará com ambas as armas|Se em empunhadura dupla, causa o dano de ambas as armas em um golpe/i;
export function danoComAsDuasArmas(slug) {
  const g = POR_SLUG.get(slug);
  if (!g) return null;
  for (const l of g.mods ?? []) {
    const m = String(l).match(COMBINA_AS_ARMAS);
    if (m) return Number(m[1].replace(',', '.'));
  }
  return DANO_DE_AMBAS.test(g.desc ?? '') ? 100 : null;
}
/** Os tipos de AFECÇÃO ELEMENTAL no bicho agora (incêndio, resfriamento, congelamento, eletrização). */
export function afeccoesElementaisEm(bicho, agora) {
  const e = bicho?.estados ?? {};
  const vale = (s) => s && s.ate > agora;
  return [(bicho?.dots ?? []).some((d) => d.tipo === 'queimadura' && d.ate > agora), vale(e.lento), vale(e.congelado), vale(e.chocado)].filter(Boolean).length;
}
/** A eficácia de um ATAQUE no nível (o "Dano de Ataque X% de base"): o golpe da arma × isto. */
export const eficaciaNoNivel = (slug, nivel) => compilada(slug, nivel)?.stats?.efetividade ?? 1;
/**
 * (S002, lote 47) A EFICÁCIA DO DANO ADICIONADO de uma MAGIA no nível ("Eficácia do Dano Adicionado: (300 — 480)%" na Bola de Fogo): a do PoB
 * (`gamedata/itens-poe/pob-eficacia.json` — `tools/importar-pob-eficacia.mjs`, o `damageEffectiveness` de cada nível; acima da tabela, o
 * último nível dela); sem a gema no PoB, a da tabela do poedb (`eficaciaNoNivel`). O dano adicionado às magias (peças, suportes, varinhas)
 * entra × isto.
 */
let POB_EFICACIA = null;
export function eficaciaDoAdicionado(slug, nivel = 1) {
  POB_EFICACIA ??= JSON.parse(readFileSync(new URL('../../gamedata/itens-poe/pob-eficacia.json', import.meta.url), 'utf8')).gemas;
  const t = POB_EFICACIA[POR_SLUG.get(slug)?.en ?? String(slug).replace(/_/g, ' ')];
  if (!t) return eficaciaNoNivel(slug, nivel);
  const ks = Object.keys(t).map(Number).sort((a, b) => a - b);
  const k = ks.filter((x) => x <= Math.max(ks[0], Math.round(nivel) || 1)).at(-1) ?? ks[0];
  return t[k];
}
/** A chance de crítico BASE da gema no nível ("Chance de Crítico: 6.00%" do poedb), como fração; null se a gema não diz. */
export function criticoBaseNoNivel(slug, nivel = 1) {
  const g = POR_SLUG.get(slug);
  const h = compilada(slug, nivel);
  if (!g || !h || !COMPILADOR?.propsDoNivel) return null;
  for (const p of COMPILADOR.propsDoNivel(g, h.nivel)) {
    const m = /^Chance de Crítico: ([\d.,]+)%/.exec(p);
    if (m) return Number(m[1].replace(',', '.')) / 100;
  }
  return null;
}
/** As chances de afecção da arena → as do jogo (`itens-poe/afeccoes.mjs`): as que existem. */
const AFECCAO_NO_JOGO = { incendiar: 'incendio', congelar: 'congelamento', eletrizar: 'eletrizacao', envenenar: 'veneno', sangrar: 'sangramento' };
/**
 * As chances da gema que NÃO são afecção (o empalamento — "40% de chance de Empalar Inimigos ao Acertar", 7 gemas: Golpe Duplo do Empalamento,
 * Aço Partido…): o atributo do PoE que `ModsPoe.aoAcertar` sorteia. (09/10, auditoria de dependências: antes a chance da gema não ia a lugar nenhum.)
 */
const CHANCE_NO_ACERTO = { empalar: 'chance_empalar' };
/** A ficha do golpe da gema com as chances dela no acerto (o empalamento): a mesma ficha se a gema não tem nenhuma. */
export function fichaComAsChancesDaGema(ficha, slug, nivel, qualidade = 0) {
  const ch = compilada(slug, nivel, qualidade)?.stats?.chances ?? {};
  const extra = Object.entries(ch).filter(([k, v]) => v && CHANCE_NO_ACERTO[k]);
  if (!ficha?.afPoe || !extra.length) return ficha;
  const afPoe = { ...ficha.afPoe };
  for (const [k, v] of extra) afPoe[CHANCE_NO_ACERTO[k]] = (Number(afPoe[CHANCE_NO_ACERTO[k]]) || 0) + v;
  return { ...ficha, afPoe };
}
/** As afecções da ficha + as chances da gema no nível (o acerto da skill usa isto). */
export function afeccoesComAGema(afeccoes, slug, nivel, qualidade = 0) {
  // (lote G18b: com a qualidade — o Golpe Selvagem: "20% de chance de Congelar, Eletrizar e Incendiar" na qualidade 20; "Não Pode aplicar
  // Eletrizar" (−1) é o "não pode", não uma chance negativa)
  const ch = compilada(slug, nivel, qualidade)?.stats?.chances ?? {};
  const extra = Object.entries(ch).filter(([k, v]) => v && AFECCAO_NO_JOGO[k]);
  if (!afeccoes || !extra.length) return afeccoes;
  const chance = { ...afeccoes.chance };
  const naoPode = { ...(afeccoes.naoPode ?? {}) };
  for (const [k, v] of extra) {
    if (v < 0) naoPode[AFECCAO_NO_JOGO[k]] = true;
    else chance[AFECCAO_NO_JOGO[k]] = (chance[AFECCAO_NO_JOGO[k]] ?? 0) + v;
  }
  return { ...afeccoes, chance, naoPode };
}
/**
 * (17/10, lote G18) O "mais/menos" só das afecções de dano da própria gema, no nível e com a qualidade: `{ maisAfeccaoPct, maisSangramentoPct }`
 * ("60 % menos Dano de Afecções" do Punho Esmagador; "49 % mais Dano com Sangramento" da Punctura) — o `acertar` multiplica no dano das
 * afecções (`AfeccoesPoe.aoAcertar`, `fatoresDoDano`), como o dos suportes (lote G17).
 */
/**
 * (17/10, lote G18a) As colunas MAL ROTULADAS dos dados (o poedb): a tabela do Martelo Glacial Vaal traz o cabeçalho "Cada terceiro golpe sucessivo
 * Congela…" para os números do "Congela inimigos causando X% mais Dano" dele (o PoB: só `freeze_as_though_dealt_damage_+%`) — a linha some.
 */
// (lote A1: o cabeçalho "CooldownTime" do Piscar Gélido — a recarga já vem da tabela, `temposNoNivel`)
const COLUNAS_MAL_ROTULADAS = { Vaal_Glacial_Hammer: /^Cada terceiro golpe sucessivo Congela/i, Frostblink: /^CooldownTime$/ };
const ehColunaMalRotulada = (slug, l) => !!COLUNAS_MAL_ROTULADAS[slug]?.test(l);
/** (lote G18a) A gema cujo degenerativo leva os modificadores de Dano Mágico (o `dotIsSpell` do PoB): o "mais Dano Mágico" vale no DoT dela. */
export const dotEhMagico = (slug) => textosDaGema(slug, 1).linhas.some((l) => /Modificadores de Dano Mágico aplicam-se ao Dano Degenerativo/i.test(l));
/** (17/10, lote G18b) As linhas da QUALIDADE da gema na fração (0 a 20): para quem lê as linhas sozinho (o Vínculo, a maldição). */
export const linhasDaQualidadeDe = (slug, qualidade = 0) => (qualidade > 0 ? linhasDaQualidade(POR_SLUG.get(slug), qualidade / 20) : []);
export function maisNasAfeccoesDaGema(slug, nivel = 1, qualidade = 0) {
  const st = compilada(slug, nivel, qualidade)?.stats ?? {};
  return { maisAfeccaoPct: st.maisAfeccaoPct ?? 0, maisSangramentoPct: st.maisSangramentoPct ?? 0, ...(st.maisIncendioPct ? { maisIncendioPct: st.maisIncendioPct } : {}), ...(st.maisVenenoPct ? { maisVenenoPct: st.maisVenenoPct } : {}) };
}
/**
 * (17/10, lote G18) O "até X% mais Dano com Acertos aos alvos próximos" da gema (o Golpe no Chão, o Caminho Consagrado, o Esmagar com Escudo):
 * `{ pct, rampa }` — o PoB: o "AtCloseRange" (binário — o Curto Alcance do jogo, até 2 casas) ou, no Esmagar com Escudo, a rampa do corpo a corpo
 * (`MeleeProximity` — `ModsPoe.proximidadeCorpoACorpo`). Só no acerto.
 */
const RAMPA_DO_PERTO = { Shield_Crush: 'proximidade' };
export function maisPertoNoNivel(slug, nivel = 1, qualidade = 0) {
  const pct = compilada(slug, nivel, qualidade)?.stats?.maisPertoPct ?? 0;
  return pct ? { pct, rampa: RAMPA_DO_PERTO[slug.replace(/_of_.*$/, '')] ?? 'perto' } : null;
}
/** (lote G18) Os projéteis secundários da gema (o Golpe Vulcânico, as Lâminas Gélidas): `{ pct, quintoPct, quintoProjeteis }` ou null. */
export function projeteisDaGema(slug, nivel = 1, qualidade = 0) {
  const st = compilada(slug, nivel, qualidade)?.stats ?? {};
  return st.maisProjetilPct || st.quintoMaisPct || st.quintoProjeteis ? { pct: st.maisProjetilPct ?? 0, quintoPct: st.quintoMaisPct ?? 0, quintoProjeteis: st.quintoProjeteis ?? 0 } : null;
}
/** O custo de mana da gema no nível. */
export const custoNoNivel = (slug, nivel) => Math.max(0, Math.round(compilada(slug, nivel)?.stats?.custo ?? 0));
/**
 * (lote A2, dono 19/10) O RECURSO do custo da gema no nível ("Custo: 29 Vida" — a Fúria Sangrenta; "Custo: 624 Escudo de Energia" — a Lâmina de
 * Energia; o resto, Mana): `'vida'`, `'es'` ou `'mana'`.
 */
export function recursoDoCusto(slug, nivel = 1) {
  const g = POR_SLUG.get(slug);
  if (!g || !COMPILADOR?.propsDoNivel) return 'mana';
  const n = Math.max(1, Math.min(nivel | 0 || 1, COMPILADOR.nivelMaximo?.(g) ?? 40));
  const p = COMPILADOR.propsDoNivel(g, n).find((x) => /^Custo:/.test(x)) ?? '';
  // (revisão do A5: o custo com os TRÊS recursos juntos — o Golpe Selvagem dos Extremos, "Custo: 28 Mana 28 Vida 28 Escudo de Energia"; o PoB: cost = { ES, Life,
  // Mana }, act_dex.lua:17270 — paga cada um: 'todos')
  if (/Mana/i.test(p) && /Vida/i.test(p) && /Escudo de Energia/i.test(p)) return 'todos';
  return /Escudo de Energia/i.test(p) ? 'es' : /Vida/i.test(p) ? 'vida' : 'mana';
}

// ---- o DANO DEGENERATIVO da gema (09/10: "o dano degenerativo das gemas") ----
/** O tipo de dano contínuo (`combate/dot.json`) do dano degenerativo de cada elemento de uma habilidade. */
export const DEGEN_DO_ELEMENTO = { physical: 'degenFisico', fire: 'degenFogo', ice: 'degenGelo', energy: 'degenRaio', chaos: 'degenCaos' };
/**
 * O dano degenerativo da gema no nível ("Causa 765 de Dano de Gelo Base por segundo" — Vórtice, Geada Rastejante, Flecha Cáustica…):
 * `{ partes: [{ elemento, dps }], duracaoMs }` ou null. A duração é a da habilidade (sem ela, 4 s; no mínimo 1 s: um pulso inteiro).
 */
export function degenerativoNoNivel(slug, nivel, qualidade = 0) {
  const st = compilada(slug, nivel, qualidade)?.stats;
  const partes = (st?.dot ?? []).map((d) => ({ elemento: ELEMENTO[d.el], dps: Number(d.dps) || 0 })).filter((p) => p.elemento && p.dps > 0);
  if (!partes.length) return null;
  return { partes, duracaoMs: Math.round(Math.max(1, Number(st.duracao) || 4) * 1000) };
}

// ---- os BUFFS (auras, arautos, guardas, gritos, maldições) no nível: os efeitos de reforço do Draevor + atributos na ficha ----
const AF_DO_ELEMENTO = { fogo: 'fire', gelo: 'ice', raio: 'energy', fisico: 'phys', caos: 'chaos' };
/** `{ efeitos, af, dur, motivos }` do buff da gema no nível. */
export function buffNoNivel(slug, nivel, qualidade = 0) {
  const h = compilada(slug, nivel, qualidade);
  if (!h) return null;
  const st = h.stats;
  const b = st.buff ?? {};
  const m = st.maldicao ?? {};
  const efeitos = [];
  const af = {};
  const motivos = [];
  if (b.maisDano) efeitos.push({ efeito: 'dano', tags: [], pct: b.maisDano });
  if (b.critico) efeitos.push({ efeito: 'critChance', tags: [], pct: b.critico });
  for (const [el, [a, z]] of Object.entries(b.adicional ?? {})) {
    const e = AF_DO_ELEMENTO[el];
    if (!e || e === 'phys') {
      if (e === 'phys') af.phys_add = (af.phys_add ?? 0) + Math.round((a + z) / 2);
      continue;
    }
    af[`added_${e}_dmg_min`] = (af[`added_${e}_dmg_min`] ?? 0) + Math.round(a);
    af[`added_${e}_dmg_max`] = (af[`added_${e}_dmg_max`] ?? 0) + Math.round(z);
  }
  // (lote 81, os Arautos Glacial e Trovejante) o adicional só nos ataques (`added_*`) e só nas magias (`spell_added_*` — `ficha.danoSomadoMagia`)
  for (const [chave, prefixo] of [['adicionalAtaque', 'added'], ['adicionalMagia', 'spell_added']]) {
    for (const [el, [a, z]] of Object.entries(b[chave] ?? {})) {
      const e = AF_DO_ELEMENTO[el];
      if (!e || e === 'phys') continue;
      af[`${prefixo}_${e}_dmg_min`] = (af[`${prefixo}_${e}_dmg_min`] ?? 0) + Math.round(a);
      af[`${prefixo}_${e}_dmg_max`] = (af[`${prefixo}_${e}_dmg_max`] ?? 0) + Math.round(z);
    }
  }
  for (const [el, v] of Object.entries(b.resist ?? {})) {
    const e = AF_DO_ELEMENTO[el];
    if (e === 'phys') af.phys_res = (af.phys_res ?? 0) + v;
    else if (e) af[`${e}_res`] = (af[`${e}_res`] ?? 0) + v;
  }
  // (17/10, lote G8) as linhas "Buff concede…" que o compilador não lê (o dano adicionado dos Arautos, as imunidades, o "mais Dano Físico"):
  // os atributos delas no buff (`linhas-das-gemas.atributosDoBuff`)
  for (const l of h.linhas?.naoImplementadas ?? []) {
    const x = atributosDoBuff(l);
    if (x) for (const [k, v] of Object.entries(x)) af[k] = (af[k] ?? 0) + v;
  }
  if (b.armadura) af.armor_flat = (af.armor_flat ?? 0) + Math.round(b.armadura);
  if (b.evasao) af.evasion = (af.evasion ?? 0) + Math.round(b.evasao);
  if (b.escudo) af.energy_shield = (af.energy_shield ?? 0) + Math.round(b.escudo);
  if (b.velAtaque) af.atk_speed = (af.atk_speed ?? 0) + b.velAtaque;
  if (b.velConj) af.cast_speed = (af.cast_speed ?? 0) + b.velConj;
  if (b.velMov) af.move_speed = (af.move_speed ?? 0) + b.velMov;
  if (b.regen) af.life_regen = (af.life_regen ?? 0) + Math.round(b.regen);
  if (b.regenMana) af.mana_regen = (af.mana_regen ?? 0) + Math.round(b.regenMana);
  if (b.menosDanoRecebido) af.dmg_reduction = (af.dmg_reduction ?? 0) + b.menosDanoRecebido;
  // (lote 75, o Arauto da Agonia) a chance de Envenenar em todos os acertos e o "mais" do Veneno, enquanto o buff está ligado
  if (b.chanceVeneno) af.chance_poison = (af.chance_poison ?? 0) + b.chanceVeneno;
  if (b.maisVeneno) af.veneno_mais_final = (af.veneno_mais_final ?? 0) + b.maisVeneno;
  if (b.absorve) motivos.push('a absorção de dano da guarda ainda não existe no jogo');
  if (b.imuneAfeccoes) motivos.push('a imunidade a afecções ainda não existe no jogo');
  // (14/10) "Você e aliados próximos recebem X% de Dano Físico como Dano Extra de Gelo" (o Ódio): o Físico como Extra do elemento — antes não
  // entrava ("efeito não aplicado").
  for (const t of b.extra ?? []) {
    const e = AF_DO_ELEMENTO[t?.para];
    if (e && e !== 'phys' && t.pct > 0) af[`phys_as_extra_${e}`] = (af[`phys_as_extra_${e}`] ?? 0) + t.pct;
    else motivos.push(`efeito não aplicado no jogo: ${t?.para ?? t}`);
  }
  // A MALDIÇÃO: quem você atinge sofre mais dano (resistência reduzida, dano recebido) ou causa menos.
  const durMarca = Math.round((st.duracao ?? 6) * 1000);
  for (const [el, v] of Object.entries(m.resist ?? {})) if (v < 0 && ELEMENTO[el]) efeitos.push({ efeito: 'marcaVulneravel', pct: -v, tipos: [ELEMENTO[el]], durMarca });
  if (m.danoRecebido) efeitos.push({ efeito: 'marcaVulneravel', pct: m.danoRecebido, tipos: ['physical', 'fire', 'ice', 'energy', 'chaos', 'earth', 'death', 'holy'], durMarca });
  // (lote G18b: o dano sofrido de um tipo — a Vulnerabilidade, o Orgulho: só o Físico)
  // (o Orgulho: do mínimo ao máximo em N s na aura — `pctMax`, `rampaMs`)
  for (const [el, v] of Object.entries(m.danoRecebidoTipo ?? {})) if (v > 0 && ELEMENTO[el]) efeitos.push({ efeito: 'marcaVulneravel', pct: v, tipos: [ELEMENTO[el]], durMarca, ...(m.rampa && el === 'fisico' ? { pctMax: m.rampa.max, rampaMs: m.rampa.ms } : {}) });
  if (m.menosDano) efeitos.push({ efeito: 'marcaEnfraquece', pct: m.menosDano, ...(m.menosDanoRaro != null ? { pctRaro: m.menosDanoRaro } : {}), durMarca });
  if (m.lentidao) motivos.push('a lentidão da maldição ainda não existe no jogo');
  // (17/10, lote G6) O que a MARCA/maldição dá aos seus acertos CONTRA o inimigo amaldiçoado por ela ("Acertos contra Inimigos Amaldiçoados
  // ganham…", "Inimigos Amaldiçoados concedem X% de Dreno de Vida quando Acertados por Ataques") e ao matá-lo ("…concedem uma Carga de Poder
  // quando mortos", "…600 de Vida quando Mortos"): guardado na maldição do bicho (`Reforcos.marcar`) e lido no golpe (`fichaDoGolpe`) e no abate.
  // (lote G18b: + as da qualidade — a duração das afecções no amaldiçoado)
  const contra = contraOAmaldicoado([...textosDaGema(slug, nivel).linhas, ...(qualidade > 0 ? linhasDaQualidade(POR_SLUG.get(slug), qualidade / 20) : [])]);
  if (Object.keys(contra.golpe).length || Object.keys(contra.morte).length || Object.keys(contra.atordoar).length) efeitos.push({ efeito: 'maldicaoContra', golpe: contra.golpe, morte: contra.morte, atordoar: contra.atordoar });
  // (lote 46, dono: "Toda área em metros") o raio do Clamor em CASAS: os metros da gema ÷ 2 (antes, os metros como casas — o dobro); no uso, × √
  // da "Área de Efeito aumentada" — `acoes.raioDoClamor`
  if (h.arquetipo === 'clamor') efeitos.push({ efeito: 'provocar', raio: Math.max(1, Math.round((st.raioFinal ?? 6) / 2)), raioM: st.raioFinal ?? 6 });
  // Aura e arauto: ligados enquanto a gema estiver encaixada (o uso automático renova); guarda e grito: a duração da gema.
  // (11/10: a aura VAAL tem a duração dela — "Duração base é de 4 segundos" —, e o "Duração de Aura aumentada" passa a valer nela.)
  const vaalComDuracao = h.arquetipo === 'aura' && /^Vaal_/.test(slug) && st.duracao > 0;
  // (11/10) O ESTANDARTE do PoE atual se PLANTA: dura o da gema ("Duração base é de 10 segundos") e cresce com o Valor consumido ("X% mais Área de
  // Efeito / Efeito de Aura por Valor consumido", do nível — `porValor`, `mods-poe.plantarEstandarte`).
  const estandarte = /_Banner$/.test(slug);
  const comDuracao = vaalComDuracao || estandarte;
  const dur = ['aura', 'arauto'].includes(h.arquetipo) && !comDuracao ? 60000 : Math.round(Math.max(comDuracao ? 1 : 2, st.duracao ?? (estandarte ? 10 : 6)) * 1000);
  const porValor = estandarte ? (() => {
    const linhas = textosDaGema(slug, nivel).linhas;
    const achar = (re) => Number(linhas.map((l) => re.exec(l)?.[1]).find((x) => x != null)) || 0;
    return { efeito: achar(/([\d.]+) ?% mais Efeito de Aura por Valor consumido/), area: achar(/([\d.]+) ?% mais Área de Efeito por Valor consumido/) };
  })() : null;
  // (11/10) O RAIO da aura em casas (1 casa = 2 m): ela vale nos companheiros de grupo a esse raio (`adds`). (`raioM`: em metros, sem arredondar.)
  const raio = h.arquetipo === 'aura' ? Math.max(1, Math.round((st.raioFinal ?? 4) / 2)) : null;
  // (lote A2, dono 19/10) as gemas do lote A2: os atributos das linhas delas e os números da mecânica (`a2`); o "por Estágio" do Emblema do Poder
  // que o compilador leu como fixo sai daqui (o Emblema o dá pelos estágios — `GemasA2.adds`). `ligada`: o buff que fica ligado até ser desligado
  // (a Automação e a Lâmina de Energia — "usar de novo desliga" — e o Berserk, até a Fúria acabar).
  const a2 = LINHAS_A2[slug] ? daGemaA2(slug, nivel, qualidade) : null;
  if (a2) {
    if (slug === 'Sigil_of_Power') for (const k of Object.keys(af)) if (/^added_energy_dmg_(min|max)$/.test(k)) delete af[k];
    for (const [k, v] of Object.entries(a2.af)) af[k] = (af[k] ?? 0) + v;
  }
  const ligada = ['Automation', 'Energy_Blade', 'Berserk'].includes(slug);
  return { efeitos, af, dur, motivos, ...(raio ? { raio, raioM: st.raioFinal ?? 4 } : {}), ...(porValor ? { porValor } : {}), ...(a2 ? { a2: a2.a2 } : {}), ...(ligada ? { ligada: true } : {}) };
}

// ---- o STATUS NO JOGO ----
function avaliarNoJogo(h, formato) {
  const st = h.stats;
  const motivos = [];
  const q = h.qualidade ?? 0;
  // (as linhas que vieram da qualidade — o lacaio só lê as do nível)
  const norm = (t) => String(t).replace(/(\d)%/g, '$1 %').replace(/\\b/g, ' ').replace(/\s+/g, ' ').trim();
  const daQualidade = new Set(linhasDaQualidadeDe(h.slug, q).map(norm));
  if (SEM_NO_JOGO[h.arquetipo]) return { status: 'nao', motivos: [SEM_NO_JOGO[h.arquetipo]] };
  // (14/10) O Infestador sai sozinho (o jogo usa as habilidades sozinho); o Feiticeiro liga reservando e ativa as magias ligadas.
  if (h.arquetipo === 'praga') return { status: 'parcial', motivos: ['sai sozinha, na barra: Incuba e, no Valor Máximo da Praga com um inimigo a até 2 casas, Infesta até o Valor acabar; o raio da Infestação é de 2 casas (o PoE não publica o raio base)'] };
  if (h.arquetipo === 'feiticeiro') return { status: 'funciona', motivos: [] };
  // (lote 74 — dono, 17/10: "Implementar a gema") a Convocar Runas: traz as suas Runas, Ativa as vinculadas pagando 20% do custo de cada uma e dá o
  // Alcance de Vínculo da gema até se vincularem de novo (`acoes.convocarRunas`).
  if (h.slug === 'Brand_Recall') return { status: 'funciona', motivos: [] };
  // LACAIOS (`lacaios-poe.mjs`): invocam de verdade, com o máximo, a duração e os bônus da gema; o que ainda é simplificado vai nos motivos.
  if (h.arquetipo === 'lacaio') {
    const motivos = ['o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro'];
    for (const l of h.linhas?.naoImplementadas ?? []) if ((!ehLinhaDeLacaio(l) || daQualidade.has(l)) && !ehLinhaDeAlvos(l) && !ehLinhaDeAtaque(l) && !ehLinhaDoAco(l)) motivos.push(`efeito não simulado: ${l}`);
    // (17/10, lote G18: o "mais/menos Dano de Afecções" que o compilador lê vale no ACERTO da gema; a de lacaio não acerta — a Troca de Corpos do
    // Sacrifício —, então a linha fica não feita)
    for (const l of h.linhas?.aplicadas ?? []) if (/% (?:mais|menos) Dano (?:de|com) (?:Afecções|Sangramento)$/i.test(l)) motivos.push(`efeito não simulado: ${l}`);
    return { status: 'parcial', motivos };
  }
  // (18/10, lote G20a) o TOTEM: invoca (o máximo, a duração, a vida pelo PoB e o tempo de posicionamento — `LacaiosPoe.oQueInvoca`,
  // `Acoes.temposDaGemaPoe`) e usa a habilidade da gema pelo caminho do SEU uso (`Acoes.usarComoTotem`) — as linhas do uso contam como numa gema de
  // uso (abaixo). O totem sem golpe ainda não tem o efeito dele: toda linha que não é do totem vai nos motivos.
  // (a mecânica que está só na DESCRIÇÃO do totem, sem linha — o status não a vê)
  if (h.arquetipo === 'totem') for (const [re, m] of DESCRICAO_DO_TOTEM) if (re.test(h.slug)) motivos.push(`efeito não simulado: ${m}`);
  if (h.arquetipo === 'totem' && totemSemGolpe(h.slug)) {
    // (lote G20d: o Vínculo Abrasador — o dano por segundo é o do feixe e o da Detonação; a duração e o raio, os da Detonação — `Acoes.feixeDoVinculo`,
    // `Acoes.detonarVinculos`)
    const doVinculo = (l) => /^Searing_Bond/.test(h.slug) && /^Causa [\d.]+ de Dano de Fogo Base por segundo$|^Duração base é de [\d.]+ segundos?$|^O raio Base é de [\d.]+ metros?$|^\+[\d.]+ metros de raio$/i.test(l);
    for (const l of [...(h.linhas?.aplicadas ?? []), ...(h.linhas?.naoImplementadas ?? [])]) if (!ehLinhaDoTotem(l) && !doVinculo(l)) motivos.push(`efeito não simulado: ${l}`);
    return { status: motivos.length ? 'parcial' : 'funciona', motivos };
  }
  // (12/10) O VÍNCULO (`itens-poe/vinculos.mjs`): foca um aliado; as linhas que o jogo ainda não faz vão nos motivos.
  if (h.arquetipo === 'vinculo') {
    const d = Vinculos.daGema([...textosDaGema(h.slug, 1).linhas, ...linhasDaQualidadeDe(h.slug, q)]);
    for (const l of d.naoFeitas) motivos.push(`efeito não simulado: ${l}`);
    if ((h.tags ?? []).includes('Ativação')) motivos.push('os acertos do alvo vinculado ainda não ativam as suas magias suportadas');
    return { status: motivos.length ? 'parcial' : 'funciona', motivos };
  }
  if (BUFF.has(h.arquetipo)) {
    const b = buffNoNivel(h.slug, h.nivel, q);
    motivos.push(...b.motivos);
    // (17/10, lote G8) o ARAUTO tem o efeito ao matar (a explosão do Gelo, a tempestade do Trovão, o fogo das Cinzas) com o dano da gema: o jogo
    // ainda faz só o buff — o dano "Causa X a Y" que o compilador lê não vai a lugar nenhum
    // (lote G9 → lote 81: o do Gelo, do Trovão e das Cinzas existe — `Acoes.explosaoDoArautoGlacial`, `tiqueDaTempestade`, `queimaduraDoArautoDasCinzas`)
    if (h.arquetipo === 'arauto' && !LINHAS_DO_ARAUTO[h.slug] && (Object.keys(st.dano ?? {}).length || (st.dot ?? []).length)) motivos.push('o efeito do Arauto ao matar (a explosão, a tempestade, o fogo) ainda não existe no jogo: só o buff');
    if (!b.efeitos.length && !Object.keys(b.af).length && h.slug !== 'Withering_Step' && !LINHAS_A2[h.slug]) motivos.push('nenhum efeito do buff tem equivalente no jogo');
    // (lote A2) o que a mecânica própria ainda simplifica (`itens-poe/gemas-a2.mjs`)
    for (const m of MOTIVOS_A2[h.slug] ?? []) motivos.push(m);
    // (lote 75 — dono, 17/10: "No máximo, como o PoB")
    if (h.slug === 'Herald_of_Ash') motivos.push('a queima do excesso de dano é a mesma em todos os vizinhos do morto (as condições de cada alvo não entram)');
    if (h.slug === 'Herald_of_Agony') motivos.push('a Virulência fica no máximo (40 + a qualidade + a "Virulência Máxima") enquanto o Arauto está ligado e você Envenenou com ele há até 4 s, como o PoB: o ganho por Veneno e a perda com o tempo do PoE não são simulados', 'o Rastejador ataca como um lacaio de perto do jogo (o Morteiro e o Espinho da Cauda do PoE não são simulados)');
  } else {
    // (lote A1, dono 19/10: o deslocamento existe — `deslocamentoDaGema`, `Acoes.planoDoDeslocamento`; só a gema de movimento sem os dados dele fica)
    if (h.arquetipo === 'movimento' && !DESLOCAMENTO[h.slug]) motivos.push('o deslocamento (salto, investida, teleporte) não existe: no jogo é o golpe na área');
    // (lote A1, dono 19/10: o que fica para depois — a mecânica está só na descrição da gema, sem linha)
    for (const m of DESCRICAO_DO_MOVIMENTO[h.slug] ?? []) motivos.push(`efeito não simulado: ${m}`);
    // (lote A3: o que o projétil da gema faz só no PoB, sem linha — fica para o lote A3b)
    for (const m of PROJETIL_SEM_LINHA[h.slug] ?? []) motivos.push(`efeito não simulado: ${m}`);
    // Projéteis adicionais, perfuração, ricochetes, difusão e divisão do feixe: aplicados pelo nível da gema (`alvosNoNivel`).
    // (09/10) O dano degenerativo da gema se aplica no acerto (`acoes`: `degenerativoNoNivel`); o "% da Vida por segundo" do Fogo Justo, ainda não.
    if (st.dotPctVida) motivos.push('o dano por % da Vida por segundo (Fogo Justo) ainda não se aplica');
    // (lote G10: os estágios que o jogo faz — `estagiosDaGema`; o resto segue)
    // (lote A4, dono 19/10: + os estágios do Orbe Invernal — os do orbe — e os do debuff da Maré Invernal — os do inimigo)
    if (st.estagios && !estagiosDaGema(h.slug, h.nivel, q) && !orbeDaGema(h.slug, h.nivel) && !debuffDaGema(h.slug, h.nivel, q)) motivos.push('os estágios de canalização não existem: no jogo é um uso por vez');
    // (lote G11: a sequência de áreas da Ruptura existe — `sequenciaDaGema`)
    // (lote A4, dono 19/10: + a Chuva de Lâminas, a Colisão de Gelo e o Estilhaçar a Terra — `sequenciaDaGema`)
    if (st.repeticoes && !sequenciaDaGema(h.slug, h.nivel, q) && !torreDaGema(h.slug, h.nivel)) motivos.push('as repetições do golpe não existem: no jogo é um');
    for (const [k, v] of Object.entries(st.chances ?? {})) if (v && !AFECCAO_NO_JOGO[k] && !CHANCE_NO_ACERTO[k]) motivos.push(`a chance de ${v}% de ${k} ainda não existe no jogo`);
    // (lote G12: as gemas de cadáver que o jogo faz — `cadaverDaGema`)
    if (st.cadaver && !cadaverDaGema(h.slug, h.nivel)) motivos.push('o uso de cadáveres não existe no jogo');
    // (lote A1: a gema de movimento sem dano — o Avanço, o Passo Rápido, a Emboscada — tem o efeito dela: o deslocamento)
    // (lote B1, dono 20/10: + a gema de cadáver sem dano mágico — o Detonar Mortos da Limpeza: o efeito é a explosão, `cadaverDaGema`)
    if (!Object.keys(st.dano ?? {}).length && !h.ataque && !st.dot?.length && !DESLOCAMENTO[h.slug] && !cadaverDaGema(h.slug, h.nivel)) motivos.push('sem dano direto: nenhum efeito no combate');
  }
  // (12/10: + as linhas dos Fragmentos de Aço — `itens-poe/convocar-o-aco.mjs`.)
  // (17/10: + as linhas locais — `linhasLocaisNoNivel`.)
  // (lote A3: + as linhas de projétil que não se aplicam — `LINHAS_QUE_NAO_SE_APLICAM`, que vão como nota)
  for (const l of h.linhas?.naoImplementadas ?? []) if (!ehLinhaDeAlvos(l, h.arquetipo) && !ehLinhaQueNaoSeAplica(l) && !ehLinhaDeAtaque(l) && !(h.arquetipo === 'totem' && ehLinhaDoTotem(l)) && !ehLinhaDoAco(l) && !ehLinhaDeCadaver(l) && !ehLinhaDeEscudo(l) && !ehLinhaDeRetaliacao(l) && !(h.arquetipo === 'clamor' && ehLinhaDoClamor(l)) && !(h.arquetipo === 'maldicao' && ehLinhaContraOAmaldicoado(l)) && !(BUFF.has(h.arquetipo) && ehLinhaDoBuff(l)) && !ehLinhaDoArauto(h.slug, l) && !ehColunaMalRotulada(h.slug, l) && !(estagiosDaGema(h.slug, h.nivel, q) && ehLinhaDeEstagio(l)) && !(sequenciaDaGema(h.slug, h.nivel, q) && (ehLinhaDaSequencia(l) || GemasA4.ehLinhaDaSequenciaA4(l))) && !(anguloDaGema(h.slug, h.nivel, q) && GemasA4.ehLinhaDoAngulo(l)) && !GemasA4.ehLinhaA4(h.slug, l) && !(torreDaGema(h.slug, h.nivel, q) && ehLinhaDaTorre(l)) && !(cadaverDaGema(h.slug, h.nivel) && ehLinhaDeCadaverDaGema(l)) && !ehLinhaDaRuna(l) && !ehLinhaDoEstandarte(l) && !ehLinhaDaMina(l) && !(ehUso(h) && ehLinhaLocalDaGema(l)) && !(h.slug === 'Herald_of_Agony' && ehLinhaDaVirulencia(l)) && !ehLinhaDoDeslocamento(h.slug, l) && !(h.slug === 'Withering_Step' && LINHAS_DO_PASSO_DEFINHANTE.test(l)) && !ehLinhaA2(h.slug, l) && !GemasA3b.ehLinhaA3b(h.slug, l) && !GemasA1b.ehLinhaA1b(h.slug, l) && !GemasA5.ehLinhaA5(h.slug, l) && !GemasB1.ehLinhaB1(h.slug, l) && !GemasPR1.ehLinhaPR1(h.slug, l)) motivos.push(`efeito não simulado: ${l}`);
  // (lote A3b, dono 19/10: o que o mecanismo dos objetos ainda simplifica — `GemasA3b.MOTIVOS_A3B`)
  for (const m of GemasA3b.MOTIVOS_A3B[h.slug] ?? []) motivos.push(m);
  // (revisão do A5: o que a mecânica do lote A5 ainda depende de outro lote — `GemasA5.MOTIVOS_A5`)
  for (const m of GemasA5.MOTIVOS_A5[h.slug] ?? []) motivos.push(m);
  return { status: motivos.length ? 'parcial' : 'funciona', motivos };
}
/**
 * (lote A2, dono 19/10) O que a mecânica das gemas do lote A2 ainda simplifica — sem linha (o status não a vê) ou com a escolha que não tinha fonte.
 * Uma gema sem nada aqui segue o PoE pelas linhas.
 */
const MOTIVOS_A2 = {
  Blood_Rage: ['efeito não simulado: a perda de 4% da Vida e do Escudo de Energia por segundo é a perda por segundo do jogo — não mata (deixa 1 de Vida) e não passa pelos modificadores de dano degenerativo recebido; no PoE é Dano Físico degenerativo (PhysicalDegen)'],
  // (revisão do A2: a Lâmina de Energia virou a base — `Acoes.laminaNaFicha` —, nada mais a listar)
  'Mana-Infused_Staff': ['efeito não simulado: a Onda Arcana é um acerto só, no anel de 2 casas em volta de você — a duração de 0,35 s e a Eficácia de 450% do dano adicionado não entram'],
  Sigil_of_Power: ['efeito não simulado: o Raio por estágio e o "menos dano" valem para você e os inimigos na área; os aliados (a party) na área não recebem o buff'],
};

/** (17/10) A gema é um USO com golpe (as linhas locais valem nos acertos dela — `linhasLocaisNoNivel`): não é buff nem lacaio. (lote G20a: o totem é —
 * ele usa a habilidade pelo caminho do seu uso, `Acoes.usarComoTotem`.) */
const ehUso = (h) => !BUFF.has(h.arquetipo) && !['lacaio', 'vinculo', 'praga', 'feiticeiro'].includes(h.arquetipo);

/** A magia do catálogo de ações da gema (o molde + os números do PoE no nível 1). */
function acaoDaGema(g, h, itemId, formato, elemento) {
  const visual = VISUAL[elemento] ?? 'physical';
  // (o Vínculo é um buff num aliado: o molde, sem dano, de suporte — como os buffs; `itens-poe/vinculos.mjs`)
  const vinculo = h.arquetipo === 'vinculo';
  // (14/10: o Feiticeiro liga como as auras — reserva e fica ligado; o Infestador, sem alvo)
  const buff = BUFF.has(h.arquetipo) || vinculo || h.arquetipo === 'feiticeiro';
  const convocaRunas = g.slug === 'Brand_Recall';
  const tagsArea = (g.tags ?? []).some((t) => /Área/i.test(t));
  let moldeId;
  if (buff) moldeId = 'spell-blood-rage';
  else if (h.arquetipo === 'praga') moldeId = 'spell-haste';
  // O lacaio só invoca (o visual é o do estilo da gema): o molde sem alvo. O totem usa o molde da skill que ele vai usar (o projétil, a área).
  // (lote 74: a Convocar Runas também — no PoE ela sai em você, sem alvo nem área: `acoes.convocarRunas`)
  else if (h.arquetipo === 'lacaio' || convocaRunas) moldeId = 'spell-haste';
  else if (h.arquetipo === 'corpo_a_corpo') moldeId = tagsArea ? 'spell-front-sweep' : 'spell-brutal-strike';
  else if (h.arquetipo === 'movimento') moldeId = h.ataque || Object.keys(h.stats.dano ?? {}).length ? 'spell-ethereal-barrage' : 'spell-haste';
  else moldeId = MOLDES[formato]?.[visual] ?? MOLDES.projetil[visual] ?? 'spell-brutal-strike';
  const molde = acaoPorId(moldeId) ?? acaoPorId('spell-brutal-strike');
  // O efeito visual e o projétil do ELEMENTO (a corrente de espinhos vira de raio, de fogo...), quando o molde é de outro elemento.
  const doElemento = acaoPorId(MOLDES.projetil[visual]);
  const outroElemento = molde.element && VISUAL[molde.element] !== visual && molde.element !== visual && !buff;
  const d = danoNoNivel(g.slug, 1);
  const tempo = (h.stats.tempoUso ?? 0.75) * 1000;
  const recarga = h.stats.recarga ? h.stats.recarga * 1000 : 0;
  const entry = {
    ...molde,
    id: PREFIXO + g.slug,
    name: g.nome,
    words: '',
    element: buff ? null : h.ataque && !Object.keys(h.stats.dano ?? {}).length ? 'physical' : elemento,
    level: g.nivelReq ?? 1,
    magicLevel: 0,
    mana: custoNoNivel(g.slug, 1),
    // Os tempos do PoE (o `disparar` refaz com a ficha: velocidade de conjuração/ataque, recuperação de recarga): recarga só a do PoE.
    cooldown: Math.round(recarga),
    groupCooldown: Math.max(250, Math.round(tempo)),
    ...(outroElemento && doElemento ? { efeito: doElemento.efeito, projetil: molde.projetil ? doElemento.projetil : molde.projetil } : {}),
    damage: buff ? null : { min: Math.max(1, d.min), max: Math.max(1, d.max) },
    heals: false,
    curaOutro: false,
    overTime: null,
    summon: null,
    icon: null,
    itemId,
    runeId: null,
    kind: 'spell',
    vocations: null,
    // Lacaio e totem são de SUPORTE na barra (invocam; quem bate é o invocado).
    papeis: buff || ['lacaio', 'totem'].includes(h.arquetipo) || convocaRunas ? ['suporte'] : moldeId === 'spell-haste' ? ['velocidade'] : ['attack'],
    group: buff || moldeId === 'spell-haste' || ['lacaio', 'totem'].includes(h.arquetipo) ? 'support' : 'attack',
    // Para os ganchos do combate (dano pelo nível da gema, custo, buff, bloqueio).
    poeGema: { slug: g.slug, arquetipo: h.arquetipo, ataque: !!h.ataque, buff: buff && !vinculo, molde: moldeId, ...(vinculo ? { vinculo: true } : {}), ...(['lacaio', 'totem'].includes(h.arquetipo) ? { lacaio: h.arquetipo } : {}), ...(iconeDaHabilidade(g.slug) ? { iconeHabilidade: iconeDaHabilidade(g.slug) } : {}),
      // (lote A1: a gema que DESLOCA — o "Configurar ação" mostra a opção "direção", e a de fuga a aceita)
      ...(DESLOCAMENTO[g.slug] ? { desloca: true, ...(DESLOCAMENTO[g.slug].fuga ? { fuga: true } : {}) } : {}),
      // (lote A1b, dono 19/10: I1: a Investida Carregada — o "Configurar ação" mostra a opção "Segurar a miragem no alvo")
      ...(GemasA1b.MIRAGEM[g.slug] ? { miragem: true } : {}),
      // (lote A2: a gema que reserva — a Automação não suporta as que reservam, `Gemas.gruposComGatilho`)
      ...(h.stats.reserva ? { reserva: true } : {}) },
  };
  delete entry.blocked;
  return entry;
}

/** Os ids de item das gemas (estáveis: o arquivo só cresce — uma gema nova ganha o próximo número). */
function idsDasGemas(slugs) {
  const dados = existsSync(ARQ_IDS) ? JSON.parse(readFileSync(ARQ_IDS, 'utf8')) : { _nota: 'Id de ITEM de cada gema do PoE (slug → id). ESTÁVEL: só cresce (a peça salva guarda o número). Gerado por systems/itens-poe/gemas-poe.mjs.', ids: {} };
  let proximo = Math.max(PRIMEIRO_ID - 1, ...Object.values(dados.ids)) + 1;
  let novos = 0;
  for (const s of [...slugs].sort()) if (!dados.ids[s]) {
    dados.ids[s] = proximo++;
    novos++;
  }
  if (novos) writeFileSync(ARQ_IDS, `${JSON.stringify(dados, null, 1)}\n`);
  return dados.ids;
}

/** Troca as faixas "(a — b)" pelo valor na fração `t` (0..1) — a qualidade da gema vai de 0 a 20%. */
const naFracao = (texto, t) => texto.replace(/\((-?\d+(?:\.\d+)?)\s*—\s*(-?\d+(?:\.\d+)?)\)/g, (_, a, b) => String(Math.round((parseFloat(a) + (parseFloat(b) - parseFloat(a)) * t) * 10) / 10));

/** Quantos níveis da tabela têm `Experiência` (a XP para sair do nível). */
const niveisComXp = (g) => {
  const i = g?.colunas?.indexOf('Experiência') ?? -1;
  return i < 0 ? 0 : (g.linhas ?? []).filter((l) => Number(String(l[i] ?? '').replace(/,/g, '')) > 0).length;
};
const chaveDoRequisito = (g) => {
  const r = g.colunas?.indexOf('RequerNível') ?? -1;
  return (g.linhas ?? []).slice(0, 20).map((l) => (r >= 0 ? l[r] : '')).join(',');
};
let PELO_REQUISITO = null;
/**
 * A gema de onde vem a TABELA DE XP: a própria; sem ela (280 da coleção vieram sem a coluna preenchida — as transfiguradas "X of Y" e
 * as Vaal), a da gema de BASE, como no PoE (Vaal_X → X; X_of_Y → X, pelo nome mais longo que existe); sem base, uma gema com o mesmo
 * `RequerNível` nível a nível.
 */
export function gemaDaTabelaDeXp(g) {
  if (!g || niveisComXp(g) >= 19) return g;
  const partes = g.slug.replace(/^Vaal_/, '').split('_');
  for (let n = partes.length; n >= 1; n--) {
    const base = POR_SLUG.get(partes.slice(0, n).join('_'));
    if (base && base !== g && niveisComXp(base) >= 19) return base;
  }
  if (!PELO_REQUISITO) {
    PELO_REQUISITO = new Map();
    for (const x of GEMAS) if (niveisComXp(x) >= 19 && !PELO_REQUISITO.has(chaveDoRequisito(x))) PELO_REQUISITO.set(chaveDoRequisito(x), x);
  }
  return PELO_REQUISITO.get(chaveDoRequisito(g)) ?? g;
}

/** O nível máximo por XP (o último com `Experiência` na tabela + 1 — o 20 das gemas comuns); acima, só com o add de nível das peças. */
const maximoPorXp = (g) => niveisComXp(gemaDaTabelaDeXp(g)) + 1;

/** O valor interpolado de dano ("334.9 a 502.2") sai inteiro, como no PoE; os pequenos (raio de 1.3 metro) ficam com a casa. */
const inteiros = (t) => t.replace(/\d+\.\d+/g, (x) => (parseFloat(x) >= 10 ? String(Math.round(parseFloat(x))) : x));

/**
 * A FICHA da gema no nível (dono, 06/10: "mudar isso conforme a magia do PoE"): o que o balão do PoE mostra — tags, as propriedades
 * (nível, custo, conjuração, crítico, eficácia, requisito), a descrição, os modificadores com os números DESTE nível e os da qualidade —
 * e o que vale no jogo (status, motivos, as linhas que o combate ainda não faz).
 */
export function fichaNoNivel(slug, nivel = 1, qualidade = 0) {
  const g = POR_SLUG.get(slug);
  const r = REGISTRO.get(slug);
  const h = compilada(slug, nivel);
  if (!g || !h || !COMPILADOR?.textosDoNivel) return null;
  const n = h.nivel;
  const b = COMPILADOR.basicosDoNivel(g, n);
  const props = [];
  for (const p of COMPILADOR.propsDoNivel(g, n)) {
    if (/^Nível:/.test(p)) props.push(['Nível', `${n}${n >= maximoPorXp(g) ? ' (Máx)' : ''}`]);
    else if (/^Custo:/.test(p)) props.push(['Custo', `${b.custo ?? 0} Mana`]);
    else if (/^Eficácia do Dano Adicionado:/.test(p)) props.push(['Eficácia do Dano Adicionado', `${Math.round((b.efetividade ?? 1) * 100)}%`]);
    else {
      const i = p.indexOf(': ');
      // "(3 Times)" do poedb em português (as cargas da recarga).
      const valor = p.slice(i + 2).replace(/\((\d+) Times\)/, '($1 usos)');
      props.push(i > 0 ? [p.slice(0, i), valor] : [p, '']);
    }
  }
  // (revisão do A5 — D2: o balão mostra a qualidade que vale no uso, acima de 20 com o Aprimorar/Eclipse)
  const q = qualidadeDasContas(qualidade);
  return {
    nome: g.nome, en: g.en, cor: g.cor, tags: g.tags ?? [], nivel: n, nivelMax: maximoPorXp(g), nivelReq: b.nivelReq ?? g.nivelReq ?? 1,
    props, desc: g.desc ?? '', mods: COMPILADOR.textosDoNivel(g, n).map(inteiros), qualidade: q, modsDaQualidade: (g.qualidade ?? []).map((t) => naFracao(t, q / 20)),
    status: r?.statusNoJogo ?? 'nao', motivos: r?.motivosNoJogo ?? [], naoFeitas: (h.linhas?.naoImplementadas ?? []).filter((l) => !ehLinhaDeAlvos(l, h.arquetipo) && !ehLinhaQueNaoSeAplica(l) && !ehLinhaDeLacaio(l) && !ehLinhaDeAtaque(l) && !ehLinhaDeEscudo(l) && !ehLinhaDeRetaliacao(l) && !(estagiosDaGema(slug, n) && ehLinhaDeEstagio(l)) && !(ehUso(h) && ehLinhaLocalDaGema(l)) && !(slug === 'Herald_of_Agony' && ehLinhaDaVirulencia(l)) && !ehLinhaDoArauto(slug, l) && !ehLinhaA2(slug, l) && !GemasA1b.ehLinhaA1b(slug, l) && !GemasA5.ehLinhaA5(slug, l) && !GemasB1.ehLinhaB1(slug, l) && !GemasPR1.ehLinhaPR1(slug, l)),
    ataque: !!h.ataque, tempos: temposNoNivel(slug, n),
  };
}

let INICIADO = null;
/**
 * Liga as gemas do PoE no jogo (uma vez): lê a coleção, carrega o interpretador, registra a magia, o item e o buff de cada gema. Devolve
 * `{ gemas, porStatus }`. Precisa do `registrar` de `skills/gemas.mjs` e do de `skills/reforcos.mjs` (passados por quem chama, para este
 * módulo não importar o sistema de gemas, que importa ele).
 */
export async function iniciar({ registrarGema, registrarReforco } = {}) {
  if (INICIADO) return INICIADO;
  if (!ligado() || !existsSync(ARQ_GEMAS)) return (INICIADO = { gemas: 0, porStatus: {} });
  // (09/10) A tabela por nível de cada gema pela do poedb (a Experiência, os requisitos e as colunas que faltavam — `gemas-niveis.mjs`).
  GEMAS = comNiveisDoPoedb(JSON.parse(readFileSync(ARQ_GEMAS, 'utf8')));
  for (const g of GEMAS) POR_SLUG.set(g.slug, g);
  const comp = await import('./compilador-de-gemas/compilador.mjs');
  const prog = await import('./compilador-de-gemas/progressao.mjs');
  COMPILADOR = { compilarHabilidade: comp.compilarHabilidade, nivelMaximo: prog.nivelMaximo, textosDoNivel: prog.textosDoNivel, propsDoNivel: prog.propsDoNivel, basicosDoNivel: prog.basicosDoNivel };
  const ids = idsDasGemas(GEMAS.map((g) => g.slug));
  const porStatus = {};
  for (const g of GEMAS) {
    const nivelRef = Math.min(20, prog.nivelMaximo(g));
    const h = compilada(g.slug, nivelRef);
    if (!h) continue;
    const formato = FORMATO_PROPRIO[g.slug.replace(/_of_.*$/, '')] ?? FORMATO[h.arquetipo] ?? FORMATO[h.carga] ?? null;
    const elemento = ELEMENTO[h.elemento] ?? 'physical';
    const itemId = ids[g.slug];
    const entry = acaoDaGema(g, h, itemId, formato, elemento);
    // (17/10, lote G18b: o status com a QUALIDADE 20 — as linhas da qualidade que o jogo não faz entram nos motivos, como as do nível)
    const hq = compilada(g.slug, nivelRef, 20) ?? h;
    // (lote A2: a gema que não se aplica — `NAO_SE_APLICA` — fica sem efeito, com a nota)
    const { status, motivos } = NAO_SE_APLICA[g.slug] ? { status: 'nao', motivos: [NAO_SE_APLICA[g.slug]] } : avaliarNoJogo({ ...hq, slug: g.slug, nivel: nivelRef, qualidade: 20 }, formato);
    if (status === 'nao') entry.poeGema.bloqueio = motivos[0];
    ACTION_CATALOG.spells.push(entry);
    REGISTRO.set(g.slug, { itemId, acao: entry.id, arquetipo: h.arquetipo, formato, elemento, ataque: !!h.ataque, buff: entry.poeGema.buff, molde: entry.poeGema.molde, statusNoJogo: status, motivosNoJogo: motivos, nivelMax: prog.nivelMaximo(g), gema: g,
      // (lote A3) as notas das linhas que não se aplicam
      ...(linhasQueNaoSeAplicam(hq.linhas?.naoImplementadas).length && !NAO_SE_APLICA[g.slug] ? { linhasNaoSeAplicam: linhasQueNaoSeAplicam(hq.linhas.naoImplementadas) } : {}), ...(NAO_SE_APLICA[g.slug] ? { naoSeAplica: NAO_SE_APLICA[g.slug] } : {}) });
    porStatus[status] = (porStatus[status] ?? 0) + 1;
    registrarGema?.({ itemId, entry, gema: g, tabelaDeXp: gemaDaTabelaDeXp(g), categoria: entry.poeGema.buff || entry.poeGema.vinculo ? 'reforco' : 'ataque', castTime: entry.poeGema.ataque ? 0 : Math.round((h.stats.tempoUso ?? 0) * 1000), levelMinimo: g.nivelReq ?? 1 });
    if (entry.poeGema.buff) registrarReforco?.(entry.id, { dur: buffNoNivel(g.slug, 1).dur, tipo: `poe-${h.arquetipo}`, efeitos: [] });
  }
  INICIADO = { gemas: REGISTRO.size, porStatus };
  return INICIADO;
}
export const ligadas = () => !!INICIADO?.gemas;
export const doSlug = (slug) => REGISTRO.get(slug) ?? null;
export const daAcao = (acao) => (String(acao).startsWith(PREFIXO) ? REGISTRO.get(String(acao).slice(PREFIXO.length)) ?? null : null);

/** Os atributos dos buffs de gema do PoE ligados agora (somados em `Afixos.soma`). null: nenhum. */
/**
 * A soma de um atributo nas peças vestidas — também a variante com CONDIÇÃO DE ESTADO ("Enquanto um Inimigo Único estiver em sua presença,
 * Ira possui 20% de aumento do Efeito de Aura": `efeito_buff_gema:ira@unicoNaPresenca`), quando a condição vale agora. (Aqui não dá para ler
 * a ficha: `adds` é parte da soma que monta a ficha.)
 */
// (ciclo 7) O leitor da ÁRVORE (as passivas alocadas — registrado por `acoes.mjs`, que as lê sem ciclo de imports).
// eslint-disable-next-line no-var
var leitorDaArvore;
export function definirLeitorDaArvore(fn) { leitorDaArvore = fn; }
function doEquipamento(estado, chave) {
  let conds = null;
  let n = 0;
  const somar = (af) => {
    for (const [k, v] of Object.entries(af ?? {})) {
      if (k !== chave && !k.startsWith(`${chave}@`)) continue;
      const cs = partir(k).conds;
      if (cs.length) {
        conds ??= condicoesDe(estado);
        if (!cs.every((c) => vale(conds, c))) continue;
      }
      n += Number(v) || 0;
    }
  };
  for (const p of Object.values(estado?.equipment ?? {})) somar(p?.poe?.af);
  // (+ a árvore: "Efeito dos Buffs de Arauto em você aumentado em X%")
  somar(leitorDaArvore?.(estado));
  return n;
}

/** (ciclo 7) As tags de gema que têm "Efeito do Buff" próprio na árvore (as que o arquétipo não separa). */
const TAGS_DE_BUFF = { Vínculo: 'vinculo', Guarda: 'guarda' };
/**
 * (lote A4, dono 19/10) O que a gema CANALIZADA agora dá a você enquanto canaliza (o PoB: Condition ChannellingCyclone, GlobalEffect Buff): o "X% menos
 * Velocidade de Movimento" do Ciclone (e o "por Estágio" do Ciclone do Tumulto — o estágio do tempo, `hunt.canalizacao.estagioDaFicha`) e o "50% menos
 * Dano Sofrido enquanto Canalizando" das Lâminas Velozes Vaal. A ficha é refeita quando a canalização começa, acaba ou muda de estágio (o relógio da
 * ficha — `ModsPoe.tique`).
 */
function addsDaCanalizacao(hunt) {
  const c = hunt?.canalizacao;
  if (!c || (hunt.clock ?? 0) > c.ate || !String(c.acao ?? '').startsWith(PREFIXO)) return null;
  const slug = String(c.acao).slice(PREFIXO.length);
  const nivel = c.nivel ?? 1;
  const r = {};
  const mov = menosMovimentoDaGema(slug, nivel) + (estagiosDaGema(slug, nivel)?.menosMovimentoPct ?? 0) * (c.estagioDaFicha ?? 0);
  if (mov) r.move_speed_mais = -mov;
  const menos = circuloDaGema(slug, nivel)?.menosDanoSofridoPct ?? 0;
  if (menos) r.dano_recebido_mais = -menos;
  return Object.keys(r).length ? r : null;
}
export function adds(estado) {
  const hunt = estado?.hunt;
  const daCanalizacao = addsDaCanalizacao(hunt);
  if (!hunt?.buffs && !hunt?.lacaios?.length && !hunt?.partilha?.naSala?.length && !hunt?.a2) return daCanalizacao;
  const agora = hunt.clock ?? 0;
  const total = {};
  // (× o "Efeito de Auras / dos Buffs dos Clamores / dos Arautos aumentado" dos únicos: `efeito_buff_gema:<arquétipo>` nas peças vestidas — e o
  // de UMA gema ("Ira possui 20% de aumento do Efeito de Aura", "Efeito do Buff da Armadura Ártica aumentado": `efeito_buff_gema:<nome da gema>`,
  // os implícitos eldritch e os únicos — 09/10).)
  // (11/10: o efeito é o do DONO da aura — `dono` — porque a aura de um companheiro de grupo também vale aqui)
  const efeitoDe = (tipo, id, dono = estado, b = null) => {
    const g = String(id ?? '').startsWith(PREFIXO) ? REGISTRO.get(String(id).slice(PREFIXO.length))?.gema : null;
    const daGema = g?.nome ? `efeito_buff_gema:${slugDoNome(g.nome)}` : null;
    // (ciclo 7) + pela TAG da gema ("Habilidades de Vínculo têm Efeito do Buff aumentado" — o Vínculo não tem arquétipo próprio)
    const porTag = (g?.tags ?? []).filter((t) => TAGS_DE_BUFF[t]).reduce((n, t) => n + doEquipamento(dono, `efeito_buff_gema:${TAGS_DE_BUFF[t]}`), 0);
    // (ciclo 7, lote G) o ESTANDARTE: "Habilidades de Estandarte têm Efeito de Aura aumentado"; (11/10) e o "X% mais Efeito de Aura por Valor
    // consumido" do Estandarte plantado (`estandarte.efeitoMais` — `mods-poe.plantarEstandarte`), que multiplica.
    const estandarte = /_Banner/.test(String(id)) ? doEquipamento(dono, 'efeito_buff_gema:estandarte') : 0;
    // (13/10, o Ego Supremo: "Habilidades Aura têm 1% mais Efeito de Aura por cada 2% de Mana máxima que Reservarem" — a reserva DESTA aura,
    // na máxima de agora; multiplica.)
    const porReserva = b?.reserva && b.reserva.recurso !== 'vida' && tipo === 'poe-aura' ? doEquipamento(dono, 'aura_efeito_por_reserva') : 0;
    const reservaPct = porReserva > 0 && (dono?.maxMana ?? 0) > 0 ? (100 * Math.ceil((b.reserva.pct ? (dono.maxMana * b.reserva.pct) / 100 : b.reserva.fixo ?? 0) * (b.reserva.fator ?? 1))) / dono.maxMana : 0;
    const mais = (1 + Math.max(0, Number(b?.estandarte?.efeitoMais) || 0) / 100) * (porReserva > 0 ? 1 + Math.floor(reservaPct / porReserva) / 100 : 1);
    // (17/10, lote G14: + o "Efeito das Auras aumentado" do suporte ligado à aura — `b.efeitoAuraPct`)
    // (lote 72, o Emissário do Propósito) "Auras das suas Habilidades têm Efeito reduzido em X% em você para cada Arauto te afetando, até Y%":
    // só as suas auras, em você.
    const menosPorArauto = tipo === 'poe-aura' && dono === estado ? doEquipamento(dono, 'aura_em_voce_menos_por_arauto') : 0;
    const arautos = menosPorArauto > 0 ? Object.values(hunt.buffs ?? {}).filter((x) => x?.tipo === 'poe-arauto' && x.ate > agora).length : 0;
    const porArauto = arautos > 0 ? Math.min(doEquipamento(dono, 'aura_em_voce_menos_por_arauto_max') || Infinity, menosPorArauto * arautos) : 0;
    // (lote 80, o Mensageiro Solitário: "50% mais Efeito dos Buffs de Arautos em você" — multiplica)
    const maisArauto = tipo === 'poe-arauto' && dono === estado ? 1 + doEquipamento(dono, 'efeito_buff_arauto_mais') / 100 : 1;
    return (1 + (doEquipamento(dono, `efeito_buff_gema:${String(tipo ?? '').replace(/^poe-/, '')}`) + doEquipamento(dono, 'efeito_buff_gema:todos') + (daGema ? doEquipamento(dono, daGema) : 0) + porTag + estandarte + (Number(b?.efeitoAuraPct) || 0) - porArauto) / 100) * mais * maisArauto;
  };
  // (lote G14: a aura "que não afeta você" — a Generosidade — não entra na sua soma; nos companheiros, sim)
  for (const [id, b] of Object.entries(hunt.buffs ?? {})) if (b.afPoe && b.ate > agora && !b.soAliados) { const f = efeitoDe(b.tipo, id, estado, b); for (const [k, v] of Object.entries(b.afPoe)) total[k] = (total[k] ?? 0) + v * f; }
  // (11/10) As AURAS dos COMPANHEIROS de grupo na mesma sala, a até o raio da aura deles (`raio` em casas, com o "Efeito em Área de Habilidades
  // de Aura aumentado" de quem lançou): valem em você como no PoE ("você e Aliados"). Cada aura uma vez: a sua, se você também tem a mesma.
  // (13/10, a Ichimonji: "Buffs de Auras Aliadas não afetam você" — o seu; "Os Buffs das Suas Auras não afetam aliados" — o do companheiro.)
  const semAurasAliadas = doEquipamento(estado, 'auras_aliadas_nao_afetam') > 0;
  for (const outro of semAurasAliadas ? [] : hunt.partilha?.naSala ?? []) {
    if (!outro || outro === estado || !outro.hunt?.pos || !hunt.pos || (outro.hunt.z ?? 0) !== (hunt.z ?? 0)) continue;
    if (doEquipamento(outro, 'auras_so_em_voce') > 0) continue;
    for (const [id, b] of Object.entries(outro.hunt.buffs ?? {})) {
      // (o Estandarte plantado vale em volta DELE, não de quem o plantou)
      const centro = b.estandarte ?? outro.hunt.pos;
      const longe = Math.max(Math.abs(centro.x - hunt.pos.x), Math.abs(centro.y - hunt.pos.y));
      if (b.tipo !== 'poe-aura' || !b.afPoe || !(b.ate > (outro.hunt.clock ?? agora)) || !(b.raio > 0) || longe > b.raio || hunt.buffs?.[id]?.ate > agora) continue;
      const f = efeitoDe(b.tipo, id, outro, b);
      for (const [k, v] of Object.entries(b.afPoe)) total[k] = (total[k] ?? 0) + v * f;
    }
  }
  // Os GOLENS dão bônus ao dono enquanto vivem ("Golens aumentam 24% de Dano", "+256 de precisão"...); o Golem Carniçal, dano físico
  // adicional por lacaio não-golem em campo.
  const vivos = (hunt.lacaios ?? []).filter((l) => l.hp > 0);
  const naoGolens = vivos.filter((l) => !l.golem && l.tipo === 'lacaio').length;
  // (09/10) × o "Efeitos de Buffs concedidos pelos seus Golens aumentados" (`efeito_buff_gema:golem`) e o de UM golem ("Golens de Chamas":
  // `efeito_buff_gema:convocar-golem-flamejante`).
  // (18/10, lote G20c) os TOTENS com efeito em você enquanto você está perto deles: o buff do ancestral ATIVO (`l.buffAtivo`, com você a até
  // `l.ativacao` casas) e a aura do Rejuvenescedor (`l.auraDoTotem`, no raio dela, × o Efeito de Aura). Não somam entre totens: o maior de cada
  // atributo (a wiki no poedb: "Melee damage buff does not stack when multiple totems are summoned").
  const dosTotens = {};
  const pertoDe = (l, r) => !!hunt.pos && r != null && Math.max(Math.abs(l.x - hunt.pos.x), Math.abs(l.y - hunt.pos.y)) <= r;
  for (const l of vivos) {
    if (l.tipo !== 'totem') continue;
    if (l.buffAtivo && pertoDe(l, l.ativacao ?? Infinity)) for (const [k, v] of Object.entries(l.buffAtivo)) dosTotens[k] = Math.max(dosTotens[k] ?? 0, v);
    if (l.auraDoTotem && pertoDe(l, l.auraDoTotem.raio)) {
      const f = efeitoDe('poe-aura', `${PREFIXO}${l.gema}`);
      for (const [k, v] of Object.entries(l.auraDoTotem.af)) dosTotens[k] = Math.max(dosTotens[k] ?? 0, v * f);
    }
  }
  for (const [k, v] of Object.entries(dosTotens)) total[k] = (total[k] ?? 0) + v;
  // (lote A2) o Escudo Gélido, o Emblema do Poder e as auras templárias das sentinelas (`itens-poe/gemas-a2.mjs`)
  for (const [k, v] of Object.entries(GemasA2.adds(estado) ?? {})) total[k] = (total[k] ?? 0) + v;
  // (lote A4, dono 19/10) o da canalização de agora (`addsDaCanalizacao`)
  for (const [k, v] of Object.entries(daCanalizacao ?? {})) total[k] = (total[k] ?? 0) + v;
  for (const l of vivos) {
    const nomeDaGema = l.golem ? REGISTRO.get(l.gema)?.gema?.nome : null;
    const f = l.golem ? 1 + (doEquipamento(estado, 'efeito_buff_gema:golem') + (nomeDaGema ? doEquipamento(estado, `efeito_buff_gema:${slugDoNome(nomeDaGema)}`) : 0)) / 100 : 1;
    for (const [k, v] of Object.entries(l.afDono ?? {})) total[k] = (total[k] ?? 0) + v * f;
    if (l.porLacaioFisico && naoGolens) {
      total.added_phys_dmg_min = (total.added_phys_dmg_min ?? 0) + l.porLacaioFisico[0] * naoGolens;
      total.added_phys_dmg_max = (total.added_phys_dmg_max ?? 0) + l.porLacaioFisico[1] * naoGolens;
    }
  }
  return Object.keys(total).length ? total : null;
}

/** No tique: um buff de gema do PoE com atributos venceu? (a ficha é refeita por quem chama). */
export function tique(estado) {
  const hunt = estado?.hunt;
  if (!hunt?.buffs) return false;
  const agora = hunt.clock ?? 0;
  const vivos = Object.entries(hunt.buffs).filter(([, b]) => b.afPoe && b.ate > agora).map(([id]) => id).sort().join(',');
  if (vivos === (hunt.buffsPoeVistos ?? '')) return false;
  hunt.buffsPoeVistos = vivos;
  return true;
}

/** A lista para a engine: o status no jogo de cada gema e os motivos. */
export const statusNoJogo = () => Object.fromEntries([...REGISTRO].map(([slug, r]) => [slug, { status: r.statusNoJogo, motivos: r.motivosNoJogo, molde: r.molde, formato: r.formato, elemento: r.elemento }]));
