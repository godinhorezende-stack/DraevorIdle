// As GEMAS DE SUPORTE do PoE no jogo (dono, 06/10: "faça isso" — as magias ativadas por gatilho; as gemas do PoE no lugar das do
// Draevor). Os dados vêm de `tools/baixar-suportes-poedb.mjs` (poedb, pt) para a coleção do dono, e de lá para o repositório
// (`gamedata/itens-poe/suportes-poe.json`, `game/tools/importar-gemas-poe.mjs`).
// Cada suporte vira um item de gema (ids estáveis em `gamedata/itens-poe/suportes-poe-ids.json`) com:
//   - a COMPATIBILIDADE pelas tags do PoE (`Projétil`, `Magia`, `Ataque`, `Corpo a Corpo`...): só as tags que restringem;
//   - o EFEITO NO NÍVEL: cada linha do suporte (com os números do nível, da tabela do poedb, e da qualidade) traduzida para as chaves do
//     motor de suportes (`danoPct`, `maisDanoPct`, `custoPct`, `castTimePct`, `alvosExtras`, `perfurar`, `critChance`, `somadoMin`...);
//     a linha que o jogo não faz entra em `naoFeitas` (o status: funciona / parcial / não, como nas ativas);
//   - o GATILHO (Conjurar no Acerto Crítico, ao Abater Corpo a Corpo, ao Receber Dano): quando e a recarga dele.
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { ligado } from './catalogo.mjs';
import { comNiveisDoPoedb } from './gemas-niveis.mjs';
import { atributosDaLinha } from './linhas-das-gemas.mjs';
import { REGRAS_S2A, ehGatilhoDoMarcar, limiarDaFlechaForjada } from './suportes-s2a.mjs';
// (lote R3B, 27/10: as linhas próprias do Arqueiro Ilusório, dos Espíritos Sagrados, do Relâmpago Vivo e do Nascido da Colmeia — `gemas-r3b.mjs`)
import { PROPRIAS_R3B, completarEfeito as completarEfeitoR3B } from './gemas-r3b.mjs';

const ARQ_SUPORTES = new URL('../../gamedata/itens-poe/suportes-poe.json', import.meta.url);
const ARQ_IDS = new URL('../../gamedata/itens-poe/suportes-poe-ids.json', import.meta.url);
const PRIMEIRO_ID = 914001;
export const PREFIXO = 'poe-suporte:';

let SUPORTES = [];
const POR_SLUG = new Map();
export const REGISTRO = new Map();

// ---------------------------------------------------------------- os textos do nível

const FAIXA = /\((-?\d+(?:\.\d+)?)\s*—\s*(-?\d+(?:\.\d+)?)\)/g;
const NUM = /\d+(?:[.,]\d+)?/g;
/** O "molde" de uma linha (números e faixas viram #; o sinal fica): casa o modificador com a coluna da tabela de níveis. */
const molde = (t) => t.replace(FAIXA, '#').replace(NUM, '#').replace(/\+#/g, '#').replace(/\s+/g, '').toLowerCase();
const PADRAO = new Set(['Nível', 'RequerNível', 'Experiência', 'Base Damage', 'Mana', 'For', 'Des', 'Int']);
const linhaDoNivel = (s, n) => s.linhas[Math.min(Math.max(1, n), s.linhas.length) - 1] ?? [];
const interpolar = (t, f) => t.replace(FAIXA, (_, a, b) => String(Math.round((parseFloat(a) + (parseFloat(b) - parseFloat(a)) * f) * 10) / 10));
/** A coluna com os valores do nível no lugar dos números do cabeçalho (o sinal do cabeçalho fica: "-19%" com a célula 19). */
const substituir = (cab, celula, doNivel1 = null) => {
  let v = String(celula).split(/,\s*/).filter(Boolean);
  // A ORDEM da célula nem sempre é a do texto ("Ao atingir 3 de Momentum … Rapidez por 1.5 segundos" com a célula "1.5, 3"), e a célula
  // pode ter menos números que o texto ("Ganhe 1 de Momentum … a cada 0.7 segundos" com só "0.7"). O cabeçalho mostra os números do
  // NÍVEL 1: cada valor deste nível vai para o número do texto que tinha o MESMO valor no nível 1; o que não casa fica como está. Antes o
  // Momentum nível 10 saía "Ganhe 0.61 de Momentum" e "Ao atingir 1.5 de Momentum … Rapidez por 4 segundos".
  const base = doNivel1 != null ? String(doNivel1).split(/,\s*/).filter(Boolean) : null;
  const doTexto = cab.includes('#') ? [] : cab.match(NUM) ?? [];
  const numero = (x) => Number(String(x).replace(',', '.'));
  if (base && base.length === v.length && doTexto.length && base.every((b) => doTexto.some((t) => numero(t) === numero(b)))) {
    const usados = new Set();
    return cab.replace(NUM, (o) => {
      const k = base.findIndex((b, i) => !usados.has(i) && numero(b) === numero(o));
      if (k < 0) return o;
      usados.add(k);
      return v[k];
    });
  }
  // Célula com mais valores que o cabeçalho tem números ("100, 528" para "sofrer 528 de Dano"): os do FIM são os do texto.
  const vagas = (cab.match(/#/g) ?? cab.match(NUM) ?? []).length;
  if (vagas && v.length > vagas) v = v.slice(-vagas);
  let i = 0;
  if (!v.length) return null;
  // O cabeçalho às vezes traz "#" no lugar do número ("Velocidade de Recarga aumentada em #%").
  return cab.includes('#') ? cab.replace(/#/g, () => v[Math.min(i++, v.length - 1)]) : cab.replace(NUM, (o) => (i < v.length ? v[i++] : o));
};

/**
 * (lote A2, dono 19/10: "Gemas Excepcionais: o nível máximo é 3, como no poedb — Nível (1—3)") O nível MÁXIMO do suporte: o da propriedade "Nível:
 * (1—N)" nas Excepcionais (a tabela delas vem com 15 linhas — os níveis acima do 3 não existem no PoE); nos outros, as linhas da tabela.
 */
export const ehExcepcional = (s) => !!s?.tags?.includes('Excepcional');
export function nivelMaximoDe(s) {
  const linhas = s?.linhas?.length || 1;
  if (!ehExcepcional(s)) return linhas;
  const m = (s.props ?? []).map((p) => /^Nível: \((\d+)\s*—\s*(\d+)\)/.exec(p)).find(Boolean);
  return m ? Math.max(1, Math.min(linhas, Number(m[2]))) : linhas;
}
/** As linhas do suporte no nível (e as da qualidade): os números DESTE nível. */
export function textosDoNivel(s, nivel = 1, qualidade = 0) {
  // (revisão do A2: o máximo 3 das Excepcionais é o nível da GEMA — o XP e a avaliação; os bônus de nível das peças, "+N ao nível das gemas de
  // suporte", somam acima dele como no PoE: o nível efetivo lê as linhas da tabela até o fim dela)
  const max = nivelMaximoDe(s);
  const n = Math.max(1, Math.min(nivel | 0 || 1, s.linhas.length || 1));
  const passos = ehExcepcional(s) ? Math.max(1, max - 1) : 19;
  const linha = linhaDoNivel(s, n);
  // (17/10, lote G3: várias colunas com o MESMO molde — a Montagem Ágil, "X% de chance de arremessar até 2 / até 3 Armadilhas ou Minas
  // adicionais" — ficam numa lista, e cada mod escolhe a coluna cujo cabeçalho tem os números FIXOS dele (os que não são faixa: o "2", o "3");
  // antes a última coluna ganhava e a faixa de 2 sumia)
  const porMolde = new Map();
  s.colunas.forEach((c, i) => { if (!PADRAO.has(c)) { const k = molde(c); (porMolde.get(k) ?? porMolde.set(k, []).get(k)).push({ cab: c, valor: linha[i], doNivel1: s.linhas[0]?.[i] }); } });
  const fixos = (t) => (String(t).replace(FAIXA, ' ').match(NUM) ?? []).map((x) => Number(x.replace(',', '.')));
  const colunaDe = (m) => {
    const lista = porMolde.get(molde(m));
    if (!lista || lista.length < 2) return lista?.[0];
    const f = fixos(m);
    return lista.find((c) => { const n = fixos(c.cab); return f.every((x) => n.includes(x)); }) ?? lista[0];
  };
  const out = [];
  const add = (t) => t && !out.includes(t) && out.push(t);
  for (const m of [...s.mods, ...(s.implicitos ?? []).filter((t) => !/^Mana:/.test(t))]) {
    const col = colunaDe(m);
    if (col) col.valor !== undefined && col.valor !== '' && add(substituir(col.cab, col.valor, col.doNivel1));
    // (lote A2: a faixa "(a—b)" do poedb vai do nível 1 ao 20 — ou ao máximo das Excepcionais, o 3)
    else add(m.includes('—') ? interpolar(m, (n - 1) / passos) : m);
  }
  const q = Math.max(0, Math.min(20, qualidade || 0)) / 20;
  return { mods: out, qualidade: (s.qualidade ?? []).map((t) => interpolar(t, q)), props: s.props.map((p) => interpolar(p, (n - 1) / passos)) };
}

// ---------------------------------------------------------------- as linhas → os efeitos do motor

const N = '(-?\\d+(?:[.,]\\d+)?)';
const num = (x) => parseFloat(String(x).replace(',', '.'));
const temTag = (ativa, t) => !!ativa?.tags?.includes(`poe:${t}`);
const ELEMENTO_DA_TAG = { Fogo: 'fire', Gelo: 'ice', Raio: 'energy', Caos: 'chaos', Físico: 'physical' };
/** O tipo de dano de que a linha fala ("Dano de Fogo", "Dano Físico", "Dano de Projétil"...) vale para esta ativa? */
function valeParaOTipo(texto, ativa) {
  if (/Dano (de )?Projétil/i.test(texto)) return temTag(ativa, 'Projétil');
  if (/Dano Mágico|Magias Suportadas/i.test(texto)) return temTag(ativa, 'Magia');
  if (/Dano de Ataque|Ataques Suportad|Habilidades de Ataque/i.test(texto)) return temTag(ativa, 'Ataque');
  if (/Corpo a Corpo/i.test(texto)) return temTag(ativa, 'Corpo a Corpo');
  if (/Dano Elemental/i.test(texto)) return ['Fogo', 'Gelo', 'Raio'].some((t) => temTag(ativa, t));
  // (17/10, lote G17: o "Dano Físico" num ATAQUE vale sem a tag Físico — o físico vem da arma; os ataques de arco não têm a tag e batem físico)
  for (const [tag] of Object.entries(ELEMENTO_DA_TAG)) if (new RegExp(`Dano (de )?${tag}`, 'i').test(texto) && !/Dano .* como Dano Extra/i.test(texto)) return temTag(ativa, tag) || (tag === 'Físico' && temTag(ativa, 'Ataque'));
  return true;
}
/*
 * (17/10, lote G17) O "mais/menos Dano" com qualificador de ACERTO — Mágico, de Projétil, Corpo a Corpo, de Ataque, em Área — fica só no acerto
 * (`maisDanoAcertoPct`): no PoB esses são ModFlag Spell/Projectile/Melee/Attack/Area, e o `dotCfg` das afecções não os tem (CalcOffence:
 * calcAilmentSourceDamage). O resto (sem qualificador, "de Fogo", "Elemental", "com Acertos e Afecções") vale no acerto e na afecção (`maisDanoPct`).
 */
const SO_DO_ACERTO = /Dano (?:Físico )?(?:Mágico|(?:de Ataque )?de Projétil|Corpo a Corpo|de Ataque|em Área)|de dano mágico/i;
const chaveDoMais = (texto) => (SO_DO_ACERTO.test(texto) ? 'maisDanoAcertoPct' : 'maisDanoPct');
/** O "mais" pelo qualificador; o MÁGICO também vai a `maisDanoMagicoPct` (lote G18a: a parte que volta no degenerativo `dotIsSpell`). */
const maisDe = (texto, v) => ({ [chaveDoMais(texto)]: v, ...(/Dano Mágico|de dano mágico/i.test(texto) ? { maisDanoMagicoPct: v } : {}) });
/** O "mais Dano <tipo> degenerativo" → a chave do degenerativo daquele tipo (`acoes` — as afecções de dano e o degenerativo da gema). */
const MAIS_DOT_DO_TIPO = { caos: 'maisDotCaosPct', 'físico': 'maisDotFisicoPct', gelo: 'maisDotGeloPct', fogo: 'maisDotFogoPct', raio: 'maisDotRaioPct' };
/** Os "mais/menos" em % que MULTIPLICAM (duas linhas do mesmo suporte na mesma chave: ×, não +). */
const MAIS_MULTIPLICA = new Set(['maisDanoPct', 'maisDanoAcertoPct', 'maisDanoMagicoPct', 'maisAfeccaoPct', 'maisIncendioPct', 'maisSangramentoPct', 'maisVenenoPct', 'maisDotPct', 'lacaioMaisDanoPct', ...Object.values(MAIS_DOT_DO_TIPO)]);
// (lote A3, dono 19/10) as chaves que são uma flag ou um teto (o poedb repete a linha com "\n" no meio — o Localizar, a Nova de Flechas): a maior
// das linhas, não a soma
const O_MAIOR = new Set(['intensidadeMax', 'intensidadeMenosProjetil', 'doPontoDoAlvo', 'emCirculo', 'soArco', 'origensLaterais', 'projeteisMinimo', 'voltaAtravessa', 'retornar']);
/** Velocidade X% mais/aumentada → o % do TEMPO de uso (o motor: `castTimePct`). */
const tempoDaVelocidade = (pct) => (1 / (1 + pct / 100) - 1) * 100;

/**
 * As REGRAS: `[regex, (m, texto, ativa) → { chave: valor } | null]`. `null` = a linha fala de outra coisa (não vale para esta ativa) e
 * conta como feita. Linha sem regra nenhuma vai para `naoFeitas`.
 */
const ELEMENTO_DO_TEXTO = { fogo: 'fire', gelo: 'ice', raio: 'energy', 'físico': 'physical', fisico: 'physical', caos: 'chaos' };
const CARGA_DO_TEXTO = { frenesi: 'frenesi', poder: 'poder', 'tolerância': 'tolerancia' };
/** (lote S1) O dano ADICIONADO local do uso (`af:`), aos ataques e às magias, com a escala ("× a Vida máxima", "× as Cargas de Frenesi"…). */
const adicionadoDe = (el, escala, min, max = min) => Object.fromEntries(['added', 'spell_added'].flatMap((p) => [[`af:${p}_${el}_dmg_min%${escala}`, min], [`af:${p}_${el}_dmg_max%${escala}`, max]]));
const ESP = '(?:\\\\n|\\s)+';
const REGRAS = [
  // ---- (lote S2A, 27/10: os suportes com mecânica nova — `suportes-s2a.mjs`; antes de todas, que pegavam o começo de algumas) ----
  ...REGRAS_S2A,
  // ---- (lote S2B, 27/10: a segunda metade das parciais — `suportes-s2b.mjs`; antes das gerais, que pegavam o começo de algumas e davam o "mais" sem a condição) ----
  // - os LACAIOS: a Velocidade do Lacaio (ataque e conjuração — `LacaiosPoe.oQueInvoca`), o crítico da qualidade do Exemplar e da Carne Fresca, o Exemplar ("toda vez que
  //   você causar um golpe crítico recentemente com um ataque, até X"), a Carne Fresca (a Fúria Desperta e a Adrenalina), o Exército Elemental (as resistências, o máximo,
  //   o "mais Dano Elemental" só nas partes elementais e a Exposição), o Escudo de Carne (a Provocação, o "menos Dano" recebido — o nível e a qualidade somam no MESMO
  //   "mais" do PoB, `support_minion_defensive_stance_minion_damage_taken_+%_final` — e o "mais Dano" contra os inimigos perto de você) e o Frenesi Faminto;
  [new RegExp(`têm ${N}% de Velocidade de Ataque de Lacaios aumentada$`, 'i'), (m) => ({ lacaioVelAtaquePct: num(m[1]) })],
  [new RegExp(`têm ${N}% de Velocidade de Conjuração de Lacaios aumentada$`, 'i'), (m) => ({ lacaioVelConjPct: num(m[1]) })],
  [new RegExp(`^Lacaios de Habilidades Suportadas têm Chance de Golpe Crítico aumentada em ${N}%$`, 'i'), (m) => ({ lacaioCritIncPct: num(m[1]) })],
  [new RegExp(`^Lacaios de habilidades reforçadas têm a chance de causar golpe crítico aumentada em ${N}% toda vez que você causar um golpe crítico recentemente com um ataque, até ${N}%$`, 'i'), (m) => ({ exemplarCritIncPor: num(m[1]), exemplarCritIncMax: num(m[2]) })],
  [new RegExp(`^Lacaios de habilidades reforçadas têm \\+${N}% de multiplicador de golpe crítico toda vez que você causar um golpe crítico recentemente com um ataque, até \\+${N}%$`, 'i'), (m) => ({ exemplarMultPor: num(m[1]), exemplarMultMax: num(m[2]) })],
  [new RegExp(`^Lacaios criados por Habilidades Suportadas ganham Fúria Desperta e Adrenalina por ${N}% de sua Duração, máximo de ${N} segundos${ESP}Fúria Desperta concede \\+${N}% de Chance de Golpe Crítico${ESP}Fúria Desperta concede \\+${N}% de Multiplicador de Golpe Crítico$`, 'i'),
    (m) => ({ carneFrescaPct: num(m[1]), carneFrescaMaxMs: Math.round(num(m[2]) * 1000), furiaDespertaCrit: num(m[3]), furiaDespertaMult: num(m[4]) })],
  [new RegExp(`^Lacaios de Habilidades Suportadas têm \\+${N}% de todas as Resistências Elementais$`, 'i'), (m) => ({ lacaioResPct: num(m[1]) })],
  [new RegExp(`^Lacaios de Habilidades Suportadas têm \\+?${N}% ao máximo de todas as Resistências Elementais$`, 'i'), (m) => ({ lacaioResMaxPct: num(m[1]) })],
  [new RegExp(`^Lacaios de Habilidades Suportadas infligem Exposição no Acerto, aplicando -${N}% à Resistência Elemental que combine com o maior tipo de Dano sofrido pelo Inimigo$`, 'i'), (m) => ({ lacaioExposicaoPct: num(m[1]) })],
  [new RegExp(`^Lacaios de Habilidades Suportadas causam ${N}% mais Dano Elemental$`, 'i'), (m) => ({ lacaioMaisElementalPct: num(m[1]) })],
  [new RegExp(`^Lacaios de Habilidades Suportadas tem ${N}% de chance de Provocar ao Acertar$`, 'i'), (m) => ({ lacaioProvocarPct: num(m[1]) })],
  [new RegExp(`^Lacaios de Habilidades Suportadas sofrem ${N}% (menos|mais) Dano$`, 'i'), (m) => ({ lacaioMenosDanoRecebidoPct: (m[2].toLowerCase() === 'menos' ? 1 : -1) * num(m[1]) })],
  [new RegExp(`^Lacaios das Habilidades Suportadas causam ${N}% mais Dano com Acertos e Afecções aos Inimigos Próximos a você$`, 'i'), (m) => ({ lacaioMaisPertoDeVocePct: num(m[1]) })],
  [new RegExp(`^Duração Base do Frenesi Faminto é de ${N} segundos$`, 'i'), (m) => ({ frenesiFamintoMs: Math.round(num(m[1]) * 1000) })],
  [new RegExp(`^Lacaios de Habilidades Suportadas tem ${N}% de chance de conceder Frenesi Faminto à você no Acerto$`, 'i'), (m) => ({ frenesiFamintoPct: num(m[1]) })],
  [/^Lacaios de Habilidades Suportadas são Agressivos$/i, () => ({ lacaioAgressivo: 1 })],
  // ---- (lote D3, decisões do dono 27/10) ----
  // - o Escudo de Carne: "Lacaios … são Defensivos" — só atacam inimigos a até 3 casas de VOCÊ (a regra de "Próximos" — `cacadas.alvoDoFamiliar`);
  // - o Predador: a Presa ("Sinalizar Presa", sozinha a cada 0,8 s no Raro/Único mais perto — `SuportesS2B.tiqueDaPresa`), o foco nela e o "mais Dano … às suas Presas";
  // - a Legião Infernal: a queima em volta do lacaio (o dano por segundo, 2 m + o "metros ao Raio") e o dano no próprio lacaio (40% da Vida máxima por segundo, o PoB);
  // - o Solo Maldito e o Sapo Enfeitiçado: o solo nasce no alvo ao ligar o Feitiço (`SuportesS2B.criarSoloMaldito`, `Acoes.tiqueDosFeiticosS2B`);
  [/^Lacaios de Habilidades Suportadas são Defensivos$/i, () => ({ lacaioDefensivo: 1 })],
  [new RegExp(`^Lacaios de Habilidades Suportadas causam ${N}% mais Dano com Acertos e Afecções às suas Presas$`, 'i'), (m) => ({ lacaioMaisPresaPct: num(m[1]) })],
  [/^Lacaios de Habilidades Suportadas sempre focam em Presas se possível$/i, () => ({ lacaioPredador: 1 })],
  [new RegExp(`^Lacaios de Habilidades Suportadas sofrem ${N}% de sua Vida Máxima como Dano de Fogo por segundo$`, 'i'), (m) => ({ legiaoDegenPct: num(m[1]) })],
  [new RegExp(`^Lacaios de Habilidades Suportadas causam ${N} de Dano de Fogo por segundo aos Inimigos próximos a eles$`, 'i'), (m) => ({ legiaoDps: num(m[1]) })],
  [new RegExp(`^Lacaios das Habilidades Suportadas têm \\+?${N} metros ao Raio de seu Efeito Incendiário$`, 'i'), (m) => ({ legiaoRaioM: num(m[1]) })],
  [new RegExp(`^Habilidades suportadas criam Solo Maldito com uma Duração base de ${N} segundos${ESP}Feitiços de Habilidades Suportadas não tem Duração${ESP}Inimigos em Solo Maldito das Habilidades Suportadas são Amaldiçoados com tal Feitiço${ESP}Limite de 1 área de Solo Maldito$`, 'i'), (m) => ({ soloMalditoMs: Math.round(num(m[1]) * 1000) })],
  // - a FÚRIA ARCANA do suporte: a mana gasta no custo da habilidade (`Acoes`, o pagamento), o que o buff dá (o MAIOR com o da Fúria Arcana comum — o PoB) e o "35% mais Dano
  //   Mágico enquanto você possuir Fúria Arcana" (só com ela — antes, sempre);
  [new RegExp(`^Ganha Fúria Arcana após Gastar um total de ${N} de Mana em Custos Diretos e Efeitos de uma Habilidade Suportada$`, 'i'), (m) => ({ furiaArcanaLimiar: num(m[1]) })],
  [new RegExp(`^Fúria Arcana concede Velocidade de Conjuração aumentada em ${N}%${ESP}Fúria Arcana concede Regeneração de Mana aumentada em ${N}%$`, 'i'), (m, t) => (/\\n/.test(t) ? {} : { furiaArcanaCastPct: num(m[1]), furiaArcanaRegenPct: num(m[2]) })],
  [new RegExp(`^Fúria Arcana dura ${N} segundos$`, 'i'), (m) => ({ furiaArcanaMs: Math.round(num(m[1]) * 1000) })],
  [new RegExp(`^Habilidades Suportadas causam ${N}% mais Dano Mágico enquanto você possuir Fúria Arcana$`, 'i'), (m) => ({ furiaArcanaMaisMagicoPct: num(m[1]) })],
  // - a INERVAÇÃO: ao matar um Eletrizado com a suportada, o dano de Raio adicionado (aos ataques e às magias) pela duração (8 s + a da qualidade — o PoB soma as duas);
  [/^Ganha Invervação ao Matar um Inimigo Eletrizado com Habilidades Suportadas$/i, () => ({ inervacao: 1 })],
  [new RegExp(`^Invervação concede ${N} a ${N} de Dano de Raio$`, 'i'), (m) => ({ inervacaoMin: num(m[1]), inervacaoMax: num(m[2]) })],
  [new RegExp(`^(?:Estímulo|Inervação) dura ${N} segundos$`, 'i'), (m) => ({ inervacaoMs: Math.round(num(m[1]) * 1000) })],
  // - a TRINDADE e a TRÍADE PROFANA: as Ressonâncias (`SuportesS2B.noAcerto`, `doUso`); o "+7% de dano por 10 da menor" agora escala (antes, 7% mais fixo);
  [new RegExp(`^Acertos com Habilidades Suportadas para o qual o maior Tipo de Dano for Elemental fazem com que você ganhe ${N} de Ressonância de outros Elementos por ${N} segundos${ESP}Perde ${N} de Ressonância por segundo para cada Elemento que não estiver ganhando$`, 'i'), (m, t) => (/\\n/.test(t) ? {} : { trindade: 1 })],
  [new RegExp(`^Habilidades Suportadas causam ${N}% mais Dano Elemental por cada 5 da sua menor Ressonância$`, 'i'), (m) => ({ trindadeMaisPor5: num(m[1]) })],
  [new RegExp(`^Habilidades Suportadas penetram ${N}% da Resistência Elemental enquanto cada Ressonância estiver em ao menos 25$`, 'i'), (m) => ({ trindadePen: num(m[1]) })],
  [new RegExp(`^Ataques com habilidades reforçadas, cujo maior tipo de dano é caos, elétrico ou físico, fazem você ganhar ${N} de Ressonância Profana dos outros tipos por segundo durante ${N} segundos${ESP}Perde ${N} de Ressonância Profana por segundo para cada tipo que não ganhar$`, 'i'), (m, t) => (/\\n/.test(t) ? {} : { profana: 1 })],
  [new RegExp(`^Habilidades reforçadas causam \\+${N}% de dano por 10 da menor Ressonância Profana$`, 'i'), (m) => ({ profanaMaisPor10: num(m[1]) })],
  [new RegExp(`^Habilidades reforçadas têm ${N}% de chance de ignorar a resistência a dano de caos e elétrico do inimigo, se cada Ressonância Profana for de, no mínimo, 25$`, 'i'), (m) => ({ profanaIgnoraResPct: num(m[1]) })],
  [new RegExp(`^Habilidades reforçadas têm ${N}% de chance de ignorar a redução de dano físico do inimigo, se cada Ressonância Profana for de, no mínimo, 25$`, 'i'), (m) => ({ profanaIgnoraFisicoPct: num(m[1]) })],
  // - a GULA: 1 de Gula por magia conjurada; em 10, a Regurgitação (4 s): os projéteis em círculo e os 7 a mais (`SuportesS2B.doUso`);
  [new RegExp(`^Ganha ${N} de Gula ao conjurar magias reforçadas$`, 'i'), (m) => ({ gulaPorUso: num(m[1]) })],
  [new RegExp(`^Ao atingir ${N} de Gula, perde toda a Gula e ganha Regurgitação por ${N} segundos$`, 'i'), (m) => ({ gulaLimite: num(m[1]), regurgitaMs: Math.round(num(m[2]) * 1000) })],
  [new RegExp(`^Enquanto você tiver Regurgitação, as magias reforçadas disparam projéteis em círculo${ESP}Enquanto você tiver Regurgitação, as magias reforçadas disparam ${N} projéteis adicionais$`, 'i'), (m, t) => (/\\n/.test(t) ? {} : { regurgitaProjeteis: num(m[1]) })],
  // - a INTENSIDADE SOBRECARREGADA: uma instância (10 s) a cada 6 de Intensidade perdida, e o crítico por instância (`SuportesS2B.doUso`);
  [new RegExp(`^Ganha uma instância de Intensidade Sobrecarregada por ${N} segundos após${ESP}perder ${N} de Intensidade com habilidades reforçadas$`, 'i'), (m, t) => (/\\n/.test(t) ? {} : { sobrecargaMs: Math.round(num(m[1]) * 1000), sobrecargaPerda: num(m[2]) })],
  [new RegExp(`^Habilidades reforçadas têm \\+${N}% de chance de causar golpe crítico por Intensidade Sobrecarregada$`, 'i'), (m) => ({ sobrecargaCritPor: num(m[1]) })],
  [new RegExp(`^Habilidades reforçadas têm \\+${N}% de multiplicador de golpe crítico por Intensidade Sobrecarregada$`, 'i'), (m) => ({ sobrecargaMultPor: num(m[1]) })],
  // - os FEITIÇOS: o Passe Enfeitiçado e o Toque Maldito Desperto (os inimigos "Anti-Maldições"), "não podem causar golpes críticos", a área reduzida do Passe e o Propagar
  //   Feitiço (a transferência na morte, o alcance aumentado — `SuportesS2B.regrasDoFeitico`);
  [/^Feitiços aplicados por habilidades de maldição reforçadas afetam inimigos imunes a feitiços$/i, () => ({ feiticoAfetaAProva: 1 })],
  [new RegExp(`^Feitiços aplicados por habilidades de maldição reforçadas têm ${N}% de chance de afetar inimigos imunes a feitiços$`, 'i'), (m) => ({ feiticoAfetaAProvaPct: num(m[1]) })],
  [/^Inimigos afetados por feitiços de habilidades de maldição reforçadas não podem causar golpes críticos$/i, () => ({ amaldicoadoSemCritico: 1 })],
  [new RegExp(`^Efeito em Área de Habilidades Maldição Suportadas reduzido em ${N}%$`, 'i'), (m) => ({ areaMaldicaoPct: -num(m[1]) })],
  [new RegExp(`têm alcance de Transferência de Feitiços aumentado em ${N}%$`, 'i'), (m) => ({ feiticoTransfereIncPct: num(m[1]) })],
  [new RegExp(`^Feitiços de Habilidades Suportadas se Transferem para todos os Inimigos dentro de ${N} metros quando o Inimigo Enfeitiçado morrer$`, 'i'), (m) => ({ feiticoTransfereM: num(m[1]) })],
  // ---- (lote S1, 26/10: os suportes com 1 ou 2 linhas faltando — antes das regras gerais, que pegavam o começo de algumas) ----
  // - o "X% mais Dano por Carga" (a Carga de Poder no Crítico — o PoB: support_power_charge_on_crit_damage_+%_final_per_power_charge, Damage MORE × as Cargas de
  //   Poder) e o "Dano aumentado em X% por Carga" (a qualidade da Mordida Congelante): × as cargas de agora (`af:` com a escala da carga — antes, um "mais" fixo);
  [new RegExp(`causam ${N}% mais Dano por Carga de (Frenesi|Poder|Tolerância)$`, 'i'), (m) => ({ [`af:mais_dano%carga:${CARGA_DO_TEXTO[m[2].toLowerCase()]}`]: num(m[1]) })],
  [new RegExp(`causam Dano aumentado em ${N}% por Carga de (Frenesi|Poder|Tolerância)$`, 'i'), (m) => ({ [`af:dmg_inc%carga:${CARGA_DO_TEXTO[m[2].toLowerCase()]}`]: num(m[1]) })],
  // - a Mordida Congelante: "X a Y de Dano de Gelo adicional por Carga de Frenesi" — o adicionado aos ataques e às magias × as cargas (× a eficácia, no `contaDoDano`;
  //   antes somava fixo ao adicionado da linha de cima);
  [new RegExp(`têm ${N} a ${N} de Dano de (\\S+) adicional por Carga de (Frenesi|Poder|Tolerância)$`, 'i'), (m) => adicionadoDe(ELEMENTO_DO_TEXTO[m[3].toLowerCase()] ?? 'physical', `carga:${CARGA_DO_TEXTO[m[4].toLowerCase()]}`, num(m[1]), num(m[2]))],
  // - as CARGAS do uso suportado (`Acoes`, no acerto e no abate do uso; o do totem não dá carga a você): a de Poder no Golpe Crítico (o nível e a qualidade somam —
  //   add_power_charge_on_critical_strike_%), a de Tolerância ao Atordoar com um Acerto Corpo a Corpo e a de Frenesi ao Matar um Inimigo Congelado;
  [new RegExp(`têm ${N}% de chance de ganhar uma Carga de Poder com Golpes Críticos$`, 'i'), (m) => ({ cargaPoderNoCriticoPct: num(m[1]) })],
  [/^Receba uma Carga de Tolerância quando você Atordoar um Inimigo com um Acerto Corpo a Corpo com Habilidades Suportadas$/i, () => ({ cargaToleranciaAoAtordoarPct: 100 })],
  [new RegExp(`têm ${N}% de chance de ganhar uma Carga de Frenesi ao Matar um Inimigo Congelado$`, 'i'), (m) => ({ cargaFrenesiAoMatarCongeladoPct: num(m[1]) })],
  // - a Sede de Sangue (Bloodthirst): "Dano Físico com Armas Adicional igual a X% da Vida Máxima enquanto em Vida Baixa" — o Físico adicionado ao ataque, mínimo e máximo
  //   iguais, × a Vida máxima de agora, só em Vida Baixa (a cópia com o "\n" literal não soma) — e a qualidade "Dano aumentado em X% quando em Vida Baixa" (antes, sempre);
  [new RegExp(`^Ataques Suportados causam Dano Físico com Armas Adicional igual a ${N}% da Vida Máxima enquanto em Vida Baixa$`, 'i'), (m, t, a) => (temTag(a, 'Ataque') ? adicionadoDe('physical', 'vidaMax:1@vidaBaixa', num(m[1]) / 100) : null)],
  [/^Ataques Suportados causam Dano Físico com Armas Adicional igual a\\n/i, () => ({})],
  [new RegExp(`causam Dano aumentado em ${N}% quando em Vida Baixa$`, 'i'), (m) => ({ ['af:dmg_inc@vidaBaixa']: num(m[1]) })],
  // - o Devorar: o golpe fatal do uso consome o cadáver do morto e recupera X de Vida e Y de Mana (o PoB: LifeOnKill/ManaOnKill — `Acoes`, por morto seu) e marca o
  //   "Consumiu um cadáver Recentemente" (a qualidade: "Dano aumentado em X% se você tiver Consumido um cadáver Recentemente" — antes, sempre);
  [new RegExp(`^Golpes Abatedores com Habilidades Suportadas Consomem cadáveres para Recuperar ${N} de Vida e ${N} de Mana$`, 'i'), (m) => ({ devorarVida: num(m[1]), devorarMana: num(m[2]) })],
  [new RegExp(`causam Dano aumentado em ${N}% se você tiver Consumido um cadáver Recentemente$`, 'i'), (m) => ({ ['af:dmg_inc@consumiuCadaverRecente']: num(m[1]) })],
  // - o Esforço Excessivo (dono, 26/10: "como no PoE"): "X% mais Dano por cada Clamor que os Impelir" — × os Clamores que impelem o ataque (um Impelir por Clamor —
  //   `GemasGAC.impelemEste`, `Acoes.comOsAlvosDaGema`);
  [new RegExp(`^Ataques Suportados causam ${N}% mais Dano por cada Clamor que os Impelir$`, 'i'), (m) => ({ impelidoPorClamorMaisPct: num(m[1]) })],
  // - a Empunhadura de Ferro e a Vontade de Ferro: o Bônus de Dano da Força (o "Dano Físico Corpo a Corpo aumentado" a cada 5 de Força) também no Dano de Ataque dos
  //   Projéteis / em todo o Dano Mágico do uso suportado (`Acoes.contaDoDano`);
  [/^Bônus de Dano da Força é aplicado ao Dano de Ataque dos Projéteis assim como às Habilidades Suportadas$/i, () => ({ forcaEmProjeteis: 1 })],
  [/^Bônus de dano da Força também é aplicado à todo Dano Mágico para Magias Suportadas$/i, () => ({ forcaEmMagias: 1 })],
  // - o Arquimago e o Mago do Gelo (o PoB: LightningMin/Max BASE pelo PercentStat ManaUnreserved; ColdMin/Max BASE pelo ManaReserved): o dano adicionado igual a X% da
  //   Mana máxima não reservada / reservada, de agora (× a eficácia do dano adicionado, como todo adicionado), e o custo de Mana BASE a mais igual a 5% dela
  //   (manaweave_cost_equals_%_unreserved_mana — ManaCostBase BASE: antes dos multiplicadores do custo — `Acoes.custoDaSkill`);
  [new RegExp(`ganham Dano de (Raio|Gelo|Fogo) Adicional igual a ${N}% da Mana Máxima não Reservada$`, 'i'), (m) => adicionadoDe(ELEMENTO_DO_TEXTO[m[1].toLowerCase()], 'manaNaoReservada:1', num(m[2]) / 100)],
  [new RegExp(`ganham dano de frio adicionado equivalente a ${N}% do mana máximo reservado$`, 'i'), (m) => adicionadoDe('ice', 'manaReservada:1', num(m[1]) / 100)],
  [new RegExp(`ganham custo de mana base equivalente a ${N}% do mana máximo (não reservado|reservado)$`, 'i'), (m) => ({ [m[2].toLowerCase() === 'reservado' ? 'custoBaseManaReservadaPct' : 'custoBaseManaNaoReservadaPct']: num(m[1]) })],
  // - o Sacrificar: a magia suportada, ao ser conjurada, tira X% da sua Vida atual e ganha Dano de Caos adicional igual a Y% da Vida sacrificada (o PoB:
  //   support_sacrifice_* — ChaosMin/Max BASE: × a eficácia do dano adicionado); o Sacrifício Vaal: tudo, menos 1, da Vida e todo o Escudo de Energia ao usar (`Acoes`);
  [new RegExp(`^Magias Suportadas Sacrificam ${N}% da sua Vida atual quando Conjuradas para ganhar Dano de Caos adicional igual a ${N}% da Vida Sacrificada$`, 'i'), (m, t, a) => (temTag(a, 'Magia') ? { sacrificioVidaPct: num(m[1]), sacrificioCaosPct: num(m[2]) } : null)],
  [/^Habilidades reforçadas sacrificam tudo, menos 1, da sua vida e escudo de energia ao usar$/i, () => ({ sacrificaTudoMenosUm: 1 })],
  // - a Segunda Ventania: a recuperação da recarga "reduzida" (o "aumentada" da qualidade soma com ela antes de virar tempo — `recuperacaoRecargaPct`, no fim de
  //   `efeitoNoNivel`) e "+1 Usos de Tempo de Recarga" só na habilidade não instantânea (`Acoes.temposDaGemaPoe`);
  [new RegExp(`Velocidade de Recuperação da Recarga (aumentada|reduzida) em ${N}%`, 'i'), (m) => ({ recuperacaoRecargaPct: (m[1].toLowerCase() === 'reduzida' ? -1 : 1) * num(m[2]) })],
  [new RegExp(`^Habilidades Não-Instantâneas Suportadas têm \\+${N} Usos de Tempo do Recarga$`, 'i'), (m) => ({ usosExtraNaoInstantanea: Math.floor(num(m[1])) })],
  // - o Conjurar no Acerto Crítico Desperto: "Magias Suportadas têm Recuperação da Recarga aumentada em X%" — a recarga do gatilho (a das magias ativadas) ÷ (1 + X%)
  //   (`gatilhoDe`);
  [/^Magias Suportadas têm Recuperação da Recarga aumentada em/i, () => ({})],
  // - a Runa Repentina (o PoB: support_rapid_activation_brand_activation_rate_+%_final — o nível e a qualidade somam no MESMO "mais") e as durações dela (−65% MAIS na
  //   vinculada e na desvinculada — as duas são a Duração da Runa, `Acoes.fatorDeDuracao`; antes as duas somavam −130% no "aumentado");
  [new RegExp(`têm ${N}% mais frequência de Ativação$`, 'i'), (m) => ({ freqAtivacaoMaisPct: num(m[1]) })],
  [new RegExp(`têm ${N}% (mais|menos) Duração Vinculada$`, 'i'), (m) => ({ duracaoMaisPct: (m[2] === 'mais' ? 1 : -1) * num(m[1]) })],
  [new RegExp(`têm ${N}% (mais|menos) Duração Desvinculada$`, 'i'), () => ({})],
  // - a Propagação Maior: "se propagam X% mais vezes" — o total de Ricochetes do uso × (1 + X%), para baixo (o ChainCountMax MORE do PoE — `Acoes.comOsAlvosDaGema`);
  [new RegExp(`se propagam ${N}% mais vezes$`, 'i'), (m) => ({ encadearMaisPct: num(m[1]) })],
  // - a Proliferação Elemental e a de Incêndio: as afecções que o acerto do uso PÔS se espalham aos inimigos a até N metros do atingido (1 casa = 2 m, no mínimo 1),
  //   iguais (o mesmo Incêndio, Congelamento, Eletrização e Resfriamento — `Acoes.aposAfeccoesS1`);
  [new RegExp(`^Afecções Elementais infligidas por Habilidades Suportadas se espalham para outros inimigos dentro de ${N} metros$`, 'i'), (m) => ({ proliferarElementalM: num(m[1]) })],
  [new RegExp(`^Incêndios causados por Habilidades Suportadas se espalham para outros Inimigos dentro de ${N} metros$`, 'i'), (m) => ({ proliferarIncendioM: num(m[1]) })],
  // - a Dose Letal: envenenar um inimigo que não estava envenenado inflige N Venenos a mais (cópias do Veneno do acerto — `Acoes.aposAfeccoesS1`);
  [new RegExp(`^Envenenar inimigos não envenenados com habilidades reforçadas inflige ${N} envenenamentos adicionais$`, 'i'), (m) => ({ venenosExtrasNoNaoEnvenenado: Math.floor(num(m[1])) })],
  // - a Aniquilação: o golpe fatal do uso faz o morto explodir com X% de chance (o nível e a qualidade somam), "um décimo da própria vida máxima como dano de um elemento
  //   aleatório" (Fogo, Gelo ou Raio — `ModsPoe.explodirMorto`, `Acoes.abatesDoSuporteS1`);
  [new RegExp(`fazem com que os inimigos tenham \\+?${N}% de chance de explodir e causarem um décimo da própria vida máxima como dano de um elemento aleatório$`, 'i'), (m) => ({ explodirAoMatarPct: num(m[1]) })],
  // - o Conjurar ao Canalizar Desperto: "Ignora Atordoamentos enquanto Usando Habilidades Suportadas" — enquanto canaliza a habilidade suportada, o atordoamento dos
  //   monstros não pega (`Controle.tentar`, pelo `hunt.canalizacao`);
  [/^Ignora Atordoamentos enquanto Usando Habilidades Suportadas$/i, () => ({ ignoraAtordoamento: 1 })],
  // - a Congregação (lacaios): "+X% para o número máximo de lacaios" (o % do máximo, como o `max_lacaio_pct` das peças) e a "Velocidade de Movimento de Lacaios
  //   aumentada" da qualidade (`LacaiosPoe.oQueInvoca`);
  [new RegExp(`^\\+${N}% para o número máximo de lacaios de habilidades reforçadas$`, 'i'), (m) => ({ maxLacaioPct: num(m[1]) })],
  [new RegExp(`têm ${N}% de Velocidade de Movimento de Lacaios aumentada$`, 'i'), (m) => ({ lacaioMovPct: num(m[1]) })],
  // - a Comunhão: "Magias reforçadas causam de X a Y de dano físico adicionado para cada lacaio permanente" — × os seus lacaios vivos sem duração, no uso (× a eficácia
  //   do dano adicionado, como o dos suportes — `Acoes.sacrificioDoUsoS1`);
  [new RegExp(`^Magias reforçadas causam de ${N} a ${N} de dano físico adicionado para cada lacaio permanente$`, 'i'), (m, t, a) => (temTag(a, 'Magia') ? { comunhaoMin: num(m[1]), comunhaoMax: num(m[2]) } : null)],
  // - a Cascata Mágica (e a Desperta e a Maior): "também afetam áreas na frente e atrás da área alvo" (1) / "na frente, atrás, e dos lados" (2) — as cópias da área do uso
  //   ao lado dela, na linha de você até o centro (e na perpendicular), encostadas; quem está em mais de uma leva mais de um acerto (`Acoes`, como a Fissura do Serpenteado;
  //   a cópia da linha com o "\n" literal não soma);
  [/^Habilidades de Efeito em Área Suportadas também afetam áreas na frente, atrás, e dos lados da área alvo$/i, () => ({ cascataMagica: 2 })],
  [/^Habilidades de Efeito em Área Suportadas também afetam áreas na frente e atrás da área alvo$/i, () => ({ cascataMagica: 1 })],
  [/^Habilidades de Efeito em Área Suportadas também afetam áreas na frente, atrás,\\n/i, () => ({})],
  // - o Incêndio Controlado: por cada Incêndio que a habilidade infligiu Recentemente (4 s — `hunt.poeIncendiosS1`), "X% mais Dano com Incêndio" (até o máximo) e "Y% menos
  //   Dano" (até o máximo), no uso (`Acoes.doUsoS1`);
  [new RegExp(`^Cada Habilidade Suportada causa ${N}% mais Dano com Incêndio por cada Incêndio infligido com ela Recentemente, máximo de ${N}%$`, 'i'), (m) => ({ blazeIncendioPorPct: num(m[1]), blazeIncendioMax: num(m[2]) })],
  [new RegExp(`^Cada Habilidade Suportada causa ${N}% menos Dano por cada Incêndio infligido com ela Recentemente, máximo de ${N}%$`, 'i'), (m) => ({ blazeMenosPorPct: num(m[1]), blazeMenosMax: num(m[2]) })],
  // - o Superaquecimento: o uso consome toda a Fortificação e as afecções dele causam "+X% de dano" (o "mais") por cada 3 de Fortificação consumida (`Acoes.doUsoS1`);
  [new RegExp(`^Habilidades reforçadas consomem toda a Fortificação ao usar, causando \\+${N}% de dano com afecções por ${N} de Fortificação consumida$`, 'i'), (m) => ({ superaquecerPct: num(m[1]), superaquecerPor: num(m[2]) })],
  // - a Decadência: "infligem Podridão ao Acertar, causando X de Dano de Caos por segundo durante N segundos" — o degenerativo de Caos no acertado, uma Podridão por
  //   inimigo (a mais forte vale; reaplicar renova), pela conta do degenerativo do uso (os "mais" e os multiplicadores de dano degenerativo — `Acoes`);
  [new RegExp(`infligem Podridão ao Acertar, causando ${N} de Dano de Caos por segundo durante ${N} segundos$`, 'i'), (m) => ({ podridaoPorS: num(m[1]), podridaoMs: Math.round(num(m[2]) * 1000) })],
  // - o Campo Minado: "podem ter até N Minas Remotas adicionais plantadas de uma vez" (o limite das Minas do uso — `Acoes.plantarArmas`) e a qualidade da Invenção: a
  //   "Duração da Armadilha / de mina aumentada em X%" (soma com a das peças — `Acoes.plantarArmas`);
  [new RegExp(`podem ter até ${N} Minas Remotas adicionais plantadas de uma vez$`, 'i'), (m) => ({ maxMinasExtra: num(m[1]) })],
  [new RegExp(`têm Duração da Armadilha aumentada em ${N}% Habilidades reforçadas têm a duração de mina aumentada em ${N}%$`, 'i'), (m) => ({ plantaDuracaoIncPct: num(m[1]) })],
  // - o Arauto Desdenhoso: "Habilidades de arauto reforçadas não têm efeito bônus" — o buff do Arauto suportado não dá os atributos dele (o dano adicionado…); o resto do
  //   Arauto (a explosão, os acertos dele, com o crítico do suporte) segue (`Acoes`, o buff ligado);
  [/^Habilidades de arauto reforçadas não têm efeito bônus$/i, () => ({ arautoSemBuff: 1 })],
  // - o Toque Maldito: as maldições do grupo saem nos acertos das outras ativas dele e não se conjuram à mão (`Gemas.gruposComGatilho` — `toqueMaldito` —,
  //   `Acoes.maldicoesDoToqueS1`); o "menos efeito" e a duração das maldições suportadas seguem as regras de sempre;
  [/^Habilidades Suportadas aplicam Maldições Suportadas em Acertos$/i, () => ({ toqueMaldito: 1 })],
  [/^Você não pode Conjurar Magias Maldição Suportadas$/i, () => ({})],
  // - o Chamado Ancestral (e o Desperto e o Maior): "Alvos Extras das Habilidades Suportadas podem ser encontrados X% mais distante" — o raio em que o Golpe procura
  //   os alvos extras (`Acoes`, o golpe corpo a corpo da gema);
  [new RegExp(`^Alvos Extras das Habilidades Suportadas podem ser encontrados ${N}% mais dist`, 'i'), (m) => ({ alcanceAlvosExtrasPct: num(m[1]) })],
  // (lote A2, dono 19/10) os suportes "sem efeito" do PoE: a Raridade de Itens do abate (`combate.raridadeDoDrop`), a chance de os monstros FUGIREM
  // (2 s — `Acoes.fugir`), o Pacifismo (o ataque não mata — `Acoes.acertoDosSuportesA2`) e a Redução de Chance de Bloqueio (os pontos a menos, o
  // "reduzido" da qualidade e o Subjugado — `AtributosDoMob.bloqueou`, `subjugar`)
  [new RegExp(`Raridade de Itens Derrubados por Inimigos Mortos por Habilidades Suportadas aumentada em ${N}%`, 'i'), (m) => ({ raridadeAoMatarPct: num(m[1]) })],
  [new RegExp(`têm \\+?${N}% de chance de fazer os monstros fugirem ao atingir`, 'i'), (m) => ({ chanceFugirPct: num(m[1]) })],
  [/^Ataques de habilidades reforçadas não podem matar inimigos$/i, () => ({ naoMata: 1 })],
  [new RegExp(`^Inimigos possuem -?${N}% de chance de Bloquear o Dano de Ataques e Magias das Habilidades Suportadas`, 'i'), (m) => ({ bloqueioInimigoMenos: num(m[1]) })],
  [new RegExp(`^Habilidades Suportadas infligem Subjugado por ${N} segundos? ao Bloquear`, 'i'), (m) => ({ subjugadoMs: Math.round(num(m[1]) * 1000) })],
  [new RegExp(`^Subjugado aplica -?${N}% à chance de Bloquear`, 'i'), (m) => ({ subjugadoPct: num(m[1]) })],
  [new RegExp(`^Habilidades Suportadas têm ${N}% de Chance de Bloqueio Inimigo reduzid[ao]`, 'i'), (m) => ({ bloqueioInimigoReduzidoPct: num(m[1]) })],
  // (lote A5, dono 20/10) os suportes simples das famílias 1–4:
  // - o Dreno de Vida (D3): o dreno do PoE nos ataques (`af:life_leech` — a ficha do golpe) e nas magias (`af:vida_leech_magia` — `Ficha.aplicarLeech`); a
  //   cura instantânea do Draevor (`leechVidaPct`) fica para o modo clássico;
  [new RegExp(`têm ${N}% de Dano Drenado como Vida$`, 'i'), (m, t, a) => ({ ...(temTag(a, 'Ataque') || !temTag(a, 'Magia') ? { 'af:life_leech': num(m[1]) } : {}), ...(temTag(a, 'Magia') ? { 'af:vida_leech_magia': num(m[1]) } : {}) })],
  // - (revisão do A5) o Dreno de Vida e o de Energia: os bônus condicionais — "Dano aumentado enquanto Drenando Vida / Escudo de Energia" (a qualidade: só com
  //   uma instância de Dreno daquele recurso ativa — `drenandoVida`, `drenandoEs`) e "mais Dano enquanto em Escudo de Energia Completo" (`escudoCheio`);
  [new RegExp(`causam Dano aumentado em ${N}% enquanto Drenando Vida$`, 'i'), (m) => ({ 'af:dmg_inc@drenandoVida': num(m[1]) })],
  [new RegExp(`causam Dano aumentado em ${N}% enquanto Drenando Escudo de Energia$`, 'i'), (m) => ({ 'af:dmg_inc@drenandoEs': num(m[1]) })],
  [new RegExp(`causam ${N}% mais Dano enquanto em Escudo de Energia Completo$`, 'i'), (m) => ({ 'af:mais_dano@escudoCheio': num(m[1]) })],
  // - a qualidade a mais da gema ativa (D2 — o Aprimorar, o Aprimorar Desperto, o Eclipse; `Gemas.efeitoNaSkill`);
  [new RegExp(`^\\+?${N}% de Qualidade das Gemas de Habilidade Suportadas$`, 'i'), (m) => ({ qualidadeExtra: num(m[1]) })],
  // - a Vida ao matar do Golpe de Misericórdia e do Abater o Fraco ("Recupera 2% de Vida quando Habilidades Suportadas Matam um Inimigo" — o abate seu
  //   pelo acerto do uso, `Acoes.vidaAoMatarDoSuporte`);
  [new RegExp(`^Recupera ${N}% de Vida quando Habilidades Suportadas Matam um Inimigo$`, 'i'), (m) => ({ vidaAoMatarPct: num(m[1]) })],
  // - a Sobrecarga: "Habilidades Suportadas Eletrizam Inimigos como se causassem X% mais Dano" (o PoB: ShockAsThoughDealing MORE, sup_int.lua:5170 — a força da
  //   Eletrização do uso);
  [new RegExp(`^Habilidades Suportadas Eletrizam Inimigos como se causassem ${N}% mais Dano$`, 'i'), (m) => ({ 'af:eletrizacao_como_mais': num(m[1]) })],
  // - a Retaliação Experiente (D8: a janela por gema — "se tornam Utilizáveis por um tempo X% maior", só na suportada: `ModsPoe.retaliacaoUsavel`);
  [new RegExp(`^Habilidades de Retaliação Suportadas se tornam Utilizáveis por um tempo ${N}% maior$`, 'i'), (m) => ({ retaliacaoJanelaPct: num(m[1]) })],
  // - a Inversão de Regras (D7: em qualquer acerto da suportada, como o PoB — o texto fala de Ataques);
  [new RegExp(`têm ${N}% de chance de considerar os valores de resistência elemental dos monstros inimigos como invertidos$`, 'i'), (m) => ({ 'af:chance_res_invertida': num(m[1]) })],
  // - o Coursing Current: o efeito da Eletrização (a frase com "habilidades reforçadas") e as Eletrizações e os Resfriamentos que nascem um do outro (D6 —
  //   `AfeccoesPoe.aoAcertar`: a força do outro, a duração base, o teto de cada um, sem cascata; as duas versões do texto de cada regra são a mesma regra);
  [new RegExp(`^Efeito de eletrificações infligidos com habilidades reforçadas aumentado em ${N}%$`, 'i'), (m) => ({ 'af:efeito_eletrizacao': num(m[1]) })],
  [/^Esfria inimigos quando eles são eletrificados por (?:seus ataques|ataques de habilidades reforçadas), reduzindo a velocidade de ação com base no efeito de eletrificação$/i, () => ({ 'af:resfria_ao_eletrizar': 1 })],
  [/^Eletrifica inimigos quando eles são esfriados por (?:seus ataques|ataques de habilidades reforçadas), aumentando o dano sofrido com base no efeito de esfriamento$/i, () => ({ 'af:eletriza_ao_resfriar': 1 })],
  // - o Resfriamento Ósseo (D5): o Gelo sofrido aumentado pelo Resfriamento (o debuff do PoE — qualquer Gelo no inimigo, uma vez só com o da árvore) e nas
  //   áreas frias da suportada (`condicoes-poe.fatorRecebidoPeloBicho`, `Acoes` — `criarAreaFria`);
  [/^Inimigos Resfriados por Habilidades Suportadas tem o Dano de Gelo sofrido aumentado pelo Efeito de Resfriamento$/i, () => ({ 'af:resfriado_fragil_gelo': 1 })],
  [/^Inimigos em Áreas Resfriadas por Habilidades Suportadas tem o Dano de Gelo sofrido aumentado pelo Efeito de Resfriamento$/i, () => ({ areaFriaFragilGelo: 1 })],
  // - a Lâmina Mágica (D7): o dano da arma corpo a corpo de uma mão como Dano Mágico adicional — X% de cada arma; com duas, 60% de cada (`Acoes.comAsLinhasDaGema`)
  [new RegExp(`têm Dano Mágico Adicional igual a ${N}% do ?Dano das Armas Corpo a Corpo de Uma Mão Equipadas`, 'i'), (m, t, a) => (temTag(a, 'Magia') ? { laminaMagicaPct: num(m[1]) } : {})],
  // O custo (a propriedade "Multiplicador de Custo & Reserva: 120%").
  [new RegExp(`^Multiplicador de Custo & Reserva: ${N}%`), (m) => ({ custoPct: num(m[1]) - 100 })],
  [/não Custam nada/i, () => ({ custoPct: -100 })],
  [/custam Vida ao invés de Mana|Reservam Vida ao invés de Mana/i, () => ({ custoEmVida: 1 })],
  // (11/10) Os suportes que viraram mecânica (`acoes` — antes das regras gerais de dano: o "mais Dano" deles só vale no caso deles).
  // (lote 46) O PROPAGAR DANO (Melee Splash): o golpe propaga aos inimigos em volta de cada atingido (1 casa — o raio do Dano Propagado, a decisão
  // do dono do lote 34 —, × √ da área da Propagação e da habilidade), com "X% menos Dano Propagado"; o "mais Efeito em Área da Propagação" é só
  // da propagação (antes crescia a área da habilidade) — `acoes`, o `atacar`.
  [/Propagam Dano aos alvos próximos/i, () => ({ propagar: 1 })],
  [new RegExp(`causam ${N}% (mais|menos) Dano Propagado aos alvos ao redor`, 'i'), (m) => ({ propagaMaisPct: (m[2] === 'mais' ? 1 : -1) * num(m[1]) })],
  [new RegExp(`têm ${N}% (mais|menos) Efeito em Área da Propagação`, 'i'), (m) => ({ propagaAreaMaisPct: (m[2] === 'mais' ? 1 : -1) * num(m[1]) })],
  // (lote 46) O PUNHO DE GUERRA (Fist of War): um ataque a cada N segundos é MAXIMIZADO ANCESTRALMENTE — só nele o "X% mais Dano com Acertos e
  // Afecções" e a "Área de Efeito aumentada" dos Impactos (antes valiam em todo ataque); a repetição do ataque não — `acoes`, o `disparar`.
  [new RegExp(`são Maximizados Ancestralmente, não mais que uma vez a cada ${N} segundos`, 'i'), (m) => ({ maximizadoMs: Math.round(num(m[1]) * 1000) })],
  [new RegExp(`Ancestralmente Empoderadas causam ${N}% (mais|menos) Dano com Acertos e Afecções`, 'i'), (m) => ({ maximizadoMaisDanoPct: (m[2] === 'mais' ? 1 : -1) * num(m[1]) })],
  [new RegExp(`Impactos Maximizados Ancestralmente têm (?:Área de Efeito|Efeito em Área) aumentad[oa] em ${N}%`, 'i'), (m) => ({ maximizadoAreaIncPct: num(m[1]) })],
  // (17/10, lote G3) As ARMADILHAS e MINAS dos suportes (`itens-poe/armas-plantadas.mjs` — as plantadas existem desde 12/10): o Suporte de
  // Armadilha e os de Mina TRANSFORMAM a habilidade suportada em Armadilha/Mina ("Armadilha dura 4 segundo", "Mina dura 5 segundos" — a
  // duração; `Plantadas.tipoDaGema(entry, efeito)`), o tempo de detonação das Minas, as Armadilhas/Minas a mais do arremesso (sempre, e as
  // faixas de chance da Montagem Ágil), o limite a mais, a velocidade de arremesso (o "mais/menos" e o "aumentada", só no tipo que a
  // habilidade planta — `Acoes.temposDaGemaPoe`), a recuperação da recarga do arremesso das Armadilhas, as cargas ao ativar/detonar
  // (`Acoes.tiqueDasPlantadas`), a Invenção (mais dano e área por segundo plantada) e a Explosão em Cadeia (mais dano por Mina anterior na
  // Sequência de Detonação).
  [new RegExp(`^Armadilha dura ${N} segundos?$`, 'i'), (m) => ({ plantaArmadilha: 1, plantaDuracaoMs: Math.round(num(m[1]) * 1000) })],
  [new RegExp(`^Mina dura ${N} segundos?$`, 'i'), (m) => ({ plantaMina: 1, plantaDuracaoMs: Math.round(num(m[1]) * 1000) })],
  [new RegExp(`tem um Tempo Base de Detonação de Minas de ${N} segundos?`, 'i'), (m) => ({ plantaDetonacaoMs: Math.round(num(m[1]) * 1000) })],
  [new RegExp(`arremessam até ${N} Armadilhas? adiciona(?:l|is)`, 'i'), (m) => ({ armadilhasExtras: num(m[1]) })],
  [new RegExp(`arremessam até ${N} Minas? adiciona(?:l|is)`, 'i'), (m) => ({ minasExtras: num(m[1]) })],
  [new RegExp(`podem ter até ${N} Armadilhas adicionais armadas de uma vez`, 'i'), (m) => ({ maxArmadilhasExtra: num(m[1]) })],
  [new RegExp(`tem ${N}% de chance de arremessar até ${N} Armadilhas? ou Minas? adiciona(?:l|is)`, 'i'), (m) => ({ [`arremessoChance:${num(m[2])}`]: num(m[1]) })],
  [/arremessam Armadilhas aleatoriamente ao redor do local alvo/i, () => ({})],
  [new RegExp(`têm ${N}% (mais|menos) Velocidade de Arremesso de (Minas|Armadilhas)`, 'i'), (m) => ({ [m[3] === 'Minas' ? 'velArremessoMinaMaisPct' : 'velArremessoArmadilhaMaisPct']: (m[2] === 'mais' ? 1 : -1) * num(m[1]) })],
  [new RegExp(`têm ${N}% de Velocidade de Armação de Armadilhas aumentada`, 'i'), (m) => ({ velArremessoArmadilhaPct: num(m[1]) })],
  [new RegExp(`(?:têm|tem) Velocidade de Arremesso de Minas aumentada em ${N}%$`, 'i'), (m) => ({ velArremessoMinaPct: num(m[1]) })],
  [new RegExp(`têm ${N}% de Velocidade de Recarga por armar Armadilhas aumentada`, 'i'), (m) => ({ recuperacaoArmadilhaPct: num(m[1]) })],
  [new RegExp(`possuem ${N}% de chance de receber uma Carga de (Frenesi|Poder) quando sua Armadilha for ativada por um Inimigo`, 'i'), (m) => ({ [`cargaAoAtivar:${m[2] === 'Poder' ? 'poder' : 'frenesi'}`]: num(m[1]) })],
  [new RegExp(`^${N}% de chance de ganhar uma Carga de (Frenesi|Poder) quando uma Mina de Habilidades Suportadas for Detonada focando um Inimigo`, 'i'), (m) => ({ [`cargaAoAtivar:${m[2] === 'Poder' ? 'poder' : 'frenesi'}`]: num(m[1]) })],
  [new RegExp(`possuem \\+${N}% ao Multiplicador de Acertos Críticos por Carga de Poder quando utilizadas por Armadilhas`, 'i'), (m) => ({ 'af:crit_dmg%carga:poder': num(m[1]) })],
  [new RegExp(`têm Chance de Golpe Crítico aumentada em ${N}% por Carga de Poder quando utilizadas por Minas`, 'i'), (m) => ({ 'af:crit_chance_inc%carga:poder': num(m[1]) })],
  // (a cópia da mesma linha com um "\n" literal no meio, que o poedb repete nos implícitos: não soma de novo)
  [/por\\nCarga de Poder quando utilizadas por Minas/i, () => ({})],
  [new RegExp(`possuem ${N}% de aumento da Velocidade de Arremesso de Armadilhas por Carga de Frenesi`, 'i'), (m) => ({ 'af:cast_speed_tag%carga:frenesi': num(m[1]), 'af:atk_speed%carga:frenesi': num(m[1]) })],
  [new RegExp(`têm Velocidade de Arremesso de Minas aumentada em ${N}% por Carga de Frenesi`, 'i'), (m) => ({ 'af:cast_speed_tag%carga:frenesi': num(m[1]), 'af:atk_speed%carga:frenesi': num(m[1]) })],
  [new RegExp(`causam \\+?${N}% de dano por segundo que ficaram posicionadas antes de serem ativadas, até ${N}%`, 'i'), (m) => ({ invencaoDanoPorS: num(m[1]), invencaoDanoMax: num(m[2]) })],
  [new RegExp(`têm a área de efeito aumentada em ${N}% por segundo que ficaram posicionadas antes de serem ativadas, até ${N}%`, 'i'), (m) => ({ invencaoAreaPorS: num(m[1]), invencaoAreaMax: num(m[2]) })],
  [new RegExp(`causam ${N}% mais Dano para cada Mina anterior na Sequência de Detonação`, 'i'), (m) => ({ maisPorMinaAnteriorPct: num(m[1]) })],
  // As restrições de arma ("não podem ser usadas com Armas Corpo a Corpo", "só com Arcos e Varinhas") — `Acoes.dispararSemMarcar`.
  [/Habilidades de Ataque Suportadas não podem ser usadas com Armas Corpo a Corpo/i, () => ({ ataqueSemArmaCorpo: 1 })],
  [/só podem ser usadas com Arcos e Varinhas/i, () => ({ soArcoVarinha: 1 })],
  // A RAJADA (Barrage): os projéteis em sequência (`Secundarios.resolver`) e "X% mais Tempo de Ataque por Projétil" (no `temposDaGemaPoe`,
  // pelos projéteis do uso).
  [/Disparam Projéteis em sequência/i, () => ({ sequencia: 1 })],
  [new RegExp(`têm ${N}% mais Tempo de Ataque por Projétil`, 'i'), (m) => ({ tempoPorProjetilPct: num(m[1]) })],
  [new RegExp(`têm ${N}% mais Tempo de Arremesso de Minas e Armadilhas por Projétil`, 'i'), (m) => ({ tempoArremessoPorProjetilPct: num(m[1]) })],
  // (17/10, lote G14) Suportes que mexem em modificadores do USO (`af:<atributo>` → `Acoes.comAsLinhasDaGema`) e no buff/maldição suportados.
  [new RegExp(`^Duração de Afecções infligidas com Habilidades Suportadas aumentada em ${N}%`, 'i'), (m) => ({ 'af:ailment_duration': num(m[1]) })],
  [new RegExp(`têm ${N}% de chance de Empurrar Inimigos ao Acertar`, 'i'), (m) => ({ 'af:chance_empurrar': num(m[1]) })],
  [new RegExp(`têm ${N}% de Distância do Empurrão aumentada`, 'i'), (m) => ({ 'af:distancia_empurrao': num(m[1]) })],
  [new RegExp(`têm ${N}% de Ponto de Atordoamento Inimigo reduzido`, 'i'), (m) => ({ 'af:enemy_stun_threshold_red': num(m[1]) })],
  [new RegExp(`^${N} de Vida recebida por Inimigo Acertado com Ataques Suportados`, 'i'), (m, t, a) => (temTag(a, 'Ataque') ? { 'af:life_on_hit': num(m[1]) } : null)],
  [new RegExp(`têm Velocidade de Clamor aumentada em ${N}%`, 'i'), (m) => ({ 'af:velocidade_clamor': num(m[1]) })],
  [new RegExp(`têm \\+${N}% de Multiplicador de Dano Degenerativo para Afecções de Golpes Críticos`, 'i'), (m) => ({ 'af:dot_multi_critico': num(m[1]) })],
  [new RegExp(`têm alcance do Ricochete aumentado em ${N}%`, 'i'), (m) => ({ alcanceRicochetePct: num(m[1]) })],
  [new RegExp(`têm Efeito das Auras aumentado em ${N}%`, 'i'), (m) => ({ efeitoAuraPct: num(m[1]) })],
  [new RegExp(`^Auras Não-Maldições das Habilidades Suportadas possuem ${N}% de aumento do Efeito`, 'i'), (m) => ({ efeitoAuraPct: num(m[1]) })],
  [/^Auras Suportadas não afetam você$/i, () => ({ auraSoAliados: 1 })],
  [new RegExp(`têm a Área de Efeito das Auras aumentada em ${N}%`, 'i'), (m) => ({ auraAreaIncPct: num(m[1]) })],
  [new RegExp(`têm ${N}% de chance de ganhar Duração de Atordoamento dobrada`, 'i'), (m) => ({ 'af:chance_dobrar_atordoamento': num(m[1]) })],
  [new RegExp(`(?:têm|reforçadas têm) ([+-]?)${N}% de [Dd]uração de [Mm]aldiç(?:ão|ões)(?: aumentada)?`, 'i'), (m) => ({ duracaoMaldicaoPct: (m[1] === '-' ? -1 : 1) * num(m[2]) })],
  // (17/10, lote G15) os gatilhos (as linhas do gatilho são lidas por `gatilhoDe`) e os suportes de canalização: a Canalização Focada ("X% mais
  // dano / custo por segundo canalizando, até Y%" — `Acoes.dispararSemMarcar`, pelo tempo de `hunt.canalizacao`), o "mais Dano enquanto Morto"
  // da Conjurar ao Morrer (as magias dela só saem ao morrer).
  [/Ativa uma Magia Suportada a cada [\d.]+ segundos enquanto Canalizando|de chance de Ativar Magias Suportadas quando você for Atordoado|de chance de Ativar Magias de Não-Lacaios Suportadas ao Morrer/i, () => ({})],
  [new RegExp(`^${N}% mais Dano enquanto Morto`, 'i'), (m) => ({ maisDanoPct: num(m[1]) })],
  // (a Canalização Infundida: o personagem sofre menos dano de acertos enquanto canaliza a habilidade suportada — `Acoes.menosDanoDaCanalizacao`;
  // a cópia da linha com um "\n" literal, que o poedb repete, não soma)
  [new RegExp(`^Enquanto Canalizando uma Habilidade Suportada, sofra ${N}% menos Dano dos Acertos$`, 'i'), (m) => ({ infusaMenosDanoPct: num(m[1]) })],
  [/^Enquanto Canalizando uma Habilidade Suportada,\s*(?:\\n)?\s*sofra/i, () => ({})],
  [new RegExp(`causam ${N}% mais dano por segundo canalizando, até ${N}%`, 'i'), (m) => ({ focadoDanoPorS: num(m[1]), focadoDanoMax: num(m[2]) })],
  [new RegExp(`têm ${N}% mais custo por segundo canalizando, até ${N}%`, 'i'), (m) => ({ focadoCustoPorS: num(m[1]), focadoCustoMax: num(m[2]) })],
  // A CRUELDADE: os acertos concedem Crueldade (mais dano degenerativo — `condicoes-poe.BUFFS.crueldade`) por N segundos.
  [new RegExp(`^Crueldade tem Duração Base de ${N} segundos`, 'i'), (m) => ({ crueldadeMs: Math.round(num(m[1]) * 1000) })],
  [/^Acertos de Habilidades Suportadas concedem Crueldade/i, () => ({ crueldade: 1 })],
  [new RegExp(`^Efeito da Crueldade concedido por Habilidades Suportadas aumentado em ${N}%`, 'i'), (m) => ({ crueldadeEfeitoPct: num(m[1]) })],
  // (14/10) O CONVOCAR FANTASMA (`acoes.convocarFantasmas`): a chance no golpe fatal e no acerto no Raro/Único, o máximo e a duração. (A linha
  // do Raro/Único vem repetida no poedb com um "\n" literal: a cópia não soma.)
  [/Lacaios Não Fantasm\S*\\n ?de Habilidades Suportadas, Acertarem um Inimigo Raro ou Único/i, () => ({})],
  [new RegExp(`^${N}% de chance de Convocar um Fantasma quando Habilidades Suportadas, ou Lacaios Não Fantasm\\S* de Habilidades Suportadas, causam um Golpe Fatal`, 'i'), (m) => ({ fantasmaAoMatarPct: num(m[1]) })],
  [new RegExp(`^${N}% de chance de Convocar um Fantasma quando Habilidades Suportadas, ou Lacaios Não Fantasm\\S* de Habilidades Suportadas, Acertarem um Inimigo Raro ou Único`, 'i'), (m) => ({ fantasmaRaroPct: num(m[1]) })],
  [new RegExp(`^Máximo de ${N} Fantasmas Convocados`, 'i'), (m) => ({ fantasmaMax: num(m[1]) })],
  [new RegExp(`^Fantasmas duram ${N} segundos`, 'i'), (m) => ({ fantasmaDuracaoMs: Math.round(num(m[1]) * 1000) })],
  // A IMPIEDADE: cada terceiro ataque corpo a corpo é um Golpe Impiedoso (mais dano, mais dano com afecções, o atordoamento).
  [/Cada terceiro Ataque com Ataques Corpo a Corpo Suportados causa um Golpe Impiedoso/i, () => ({ impiedosoCada: 3 })],
  [new RegExp(`Golpes Impiedosos com Habilidades Suportadas causam ${N}% mais Dano Corpo a Corpo`, 'i'), (m) => ({ impiedosoMaisDanoPct: num(m[1]) })],
  [new RegExp(`Golpes Impiedosos com Habilidades Suportadas causam ${N}% mais Dano com Afecções`, 'i'), (m) => ({ impiedosoMaisAfeccaoPct: num(m[1]) })],
  [new RegExp(`Golpes Impiedosos com Habilidades Suportadas têm uma Duração base de Atordoamento de ${N} segundos`, 'i'), (m) => ({ impiedosoAtordoamentoMs: Math.round(num(m[1]) * 1000) })],
  // A LÂMINA NOTURNA: Elusivo no crítico; crítico e multiplicador a mais enquanto Elusivo; só com Garras e Adagas.
  [/concedem Elusivo no Golpe Crítico/i, () => ({ elusivoNoCritico: 1 })],
  [new RegExp(`tem \\+${N}% de Chance de Golpe Crítico enquanto Elusivo`, 'i'), (m) => ({ critElusivo: num(m[1]) })],
  [new RegExp(`^Efeito do Elusivo das Habilidades Suportadas aumentado em ${N}%`, 'i'), (m) => ({ elusivoEfeitoPct: num(m[1]) })],
  [new RegExp(`Elusivo de Habilidades Suportadas também concedem \\+${N}% de Multiplicador de Golpes Críticos`, 'i'), (m) => ({ critMultElusivo: num(m[1]) })],
  [/só podem ser usadas com Garras e Adagas/i, () => ({ soGarraAdaga: 1 })],
  // O LIBERTAR: os Selos (um a cada N s, até M); a magia Ocorre Novamente por Selo, com menos dano.
  [new RegExp(`ganham um Selo a cada ${N} segundos, até um máximo de ${N} Selos`, 'i'), (m) => ({ seloIntervaloMs: Math.round(num(m[1]) * 1000), selosMax: num(m[2]) })],
  [new RegExp(`causam ${N}% menos Dano quando Ocorrendo Novamente`, 'i'), (m) => ({ selosMenosDanoPct: num(m[1]) })],
  // O INTENSIFICAR: a Intensidade (ganha ao conjurar, até N; perde andando); mais dano em área e menos área por Intensidade.
  [new RegExp(`ganham Intensidade quando você as Conjurar, máximo de ${N} Habilidades Suportadas causam ${N}% mais Dano em Área com Acertos por Intensidade Habilidades Suportadas têm ${N}% less Efeito em Área por Intensidade`, 'i'),
    (m) => ({ intensidadeMax: num(m[1]), intensidadeMaisDanoPct: num(m[2]), intensidadeMenosAreaPct: num(m[3]) })],
  [new RegExp(`perdem 1 de Intensidade a cada ${N} segundos enquanto se movendo`, 'i'), (m) => ({ intensidadePerdaMs: Math.round(num(m[1]) * 1000) })],
  // A BLASFÊMIA (`itens-poe/reserva.mjs`): a maldição suportada vira AURA — liga e reserva a "Sobreposição de Reserva", com menos efeito.
  [new RegExp(`^(?:Sobreposição de )?Reserva: ${N}% Mana`), (m) => ({ reservaSobreposta: num(m[1]) })],
  [/aplicam suas Maldições como Auras/i, () => ({ maldicaoEmAura: 1 })],
  [new RegExp(`^${N}% menos Efeito de Maldições Suportadas`, 'i'), (m) => ({ efeitoMaldicaoPct: -num(m[1]) })],
  // LACAIOS e TOTENS (`itens-poe/lacaios-poe.mjs`): dano e vida dos lacaios, totens a mais.
  // (27/10) o "mais/menos Dano" dos lacaios MULTIPLICA (PoB sup_int.lua, `minion_damage_+%_final`), à parte do "Dano aumentado" que soma
  [new RegExp(`Lacaios? (?:d[ae]s? Habilidades Suportadas )?causam? ${N}% (mais|menos) Dano`, 'i'), (m) => ({ lacaioMaisDanoPct: (m[2] === 'mais' ? 1 : -1) * num(m[1]) })],
  [new RegExp(`Lacaios? (?:d[ae]s? Habilidades Suportadas )?(?:causam? )?Dano aumentado em ${N}%`, 'i'), (m) => ({ lacaioDanoPct: num(m[1]) })],
  [new RegExp(`Lacaios? (?:d[ae]s? Habilidades Suportadas )?têm ${N}% (mais|menos) Vida`, 'i'), (m) => ({ lacaioVidaPct: (m[2] === 'mais' ? 1 : -1) * num(m[1]) })],
  [new RegExp(`Lacaios? (?:d[ae]s? Habilidades Suportadas )?têm Vida Máxima aumentada em ${N}%`, 'i'), (m) => ({ lacaioVidaPct: num(m[1]) })],
  [new RegExp(`têm ${N}% (mais|menos) Vida de Lacaio`, 'i'), (m) => ({ lacaioVidaPct: (m[2] === 'mais' ? 1 : -1) * num(m[1]) })],
  [new RegExp(`têm ${N}% de Vida máxima de Lacaios aumentada`, 'i'), (m) => ({ lacaioVidaPct: num(m[1]) })],
  [new RegExp(`\\+${N} (?:ao|de) número máximo de Totens`, 'i'), (m) => ({ totensExtras: num(m[1]) })],
  // (18/10, lote G20b) os suportes que VIRAM TOTEM (o Totem de Magia, o Totem Balista, o Devastador — sup_str.lua:4513, 5034; other.lua:1468): o seu uso
  // da habilidade suportada COLOCA um totem que a usa sozinho (`Acoes.dispararSemMarcar` → `invocarLacaios`; o totem usa pelo caminho do seu uso,
  // `Acoes.usarComoTotem`); "Totem dura N segundos" é a duração dele; os Totens Múltiplos põem dois por uso (summon_2_totems — sup_str.lua:3905); a
  // Balista Focada só ataca quando você dispara um projétil de ataque
  [/^Habilidades suportadas invocam um Totem( de Balista)? que usa tal habilidade$/i, (m) => ({ viraTotem: m[1] ? 2 : 1 })],
  [new RegExp(`^Totem dura ${N} segundos?$`, 'i'), (m) => ({ totemDuracaoMs: Math.round(num(m[1]) * 1000) })],
  [/^Habilidades Suportadas Convocam dois Totens ao invés de um$/i, () => ({ totensPorUso: 2 })],
  [/^Totens Balista das Habilidades Suportadas só Atacam quando você disparar um Projétil de Ataque$/i, () => ({ balistaFocada: 1 })],
  // (18/10, lote G20a) os suportes de totem: "têm N% mais Velocidade de Posicionamento de Totens" — no PoB é AUMENTADA (summon_totem_cast_speed_+%,
  // sup_str.lua:5056/4540/3898, other.lua:1500, sup_dex.lua:1942; o "mais" do texto em português é da tradução): soma com a das peças e a da gema no
  // tempo de COLOCAR o totem (`Acoes.temposDaGemaPoe`) — e "têm Vida do Totem aumentada em N%" (`LacaiosPoe.oQueInvoca`)
  [new RegExp(`têm ${N}% (mais|menos) Velocidade de Posicionamento de Totens`, 'i'), (m) => ({ velPosicionamentoPct: (m[2] === 'mais' ? 1 : -1) * num(m[1]) })],
  [new RegExp(`têm Vida do Totem aumentada em ${N}%`, 'i'), (m) => ({ totemVidaPct: num(m[1]) })],
  // (17/10, lote G17) O dano SÓ DO ACERTO e o SÓ DAS AFECÇÕES (antes da regra geral de "mais/menos Dano", que os pegava): o "X% menos Dano com
  // Acertos" das Afecções Mortais e do Encadear não diminui o Incêndio/Sangramento/Veneno que o acerto põe; o "mais Dano de Afecções" e o de cada
  // uma (Sangramento, Incêndio, Veneno) multiplicam só a afecção — `Gemas.efeitoNaSkill` (multiplicam entre si) e `AfeccoesPoe.aoAcertar`.
  [new RegExp(`causam ${N}% (mais|menos) Dano com Acertos$`, 'i'), (m) => ({ maisDanoAcertoPct: (m[2] === 'mais' ? 1 : -1) * num(m[1]) })],
  // (o Toxinas Vis: "X% mais Dano com Acertos por Veneno no Inimigo, até N" — só no acerto, × os Venenos no alvo agora: `acoes`, o `acertar`)
  [new RegExp(`causam ${N}% mais Dano com Acertos por Veneno no Inimigo, até ${N}`, 'i'), (m) => ({ maisAcertoPorVenenoPct: num(m[1]), maisAcertoPorVenenoMax: num(m[2]) })],
  // ("…com Acertos e Afecções contra Inimigos em Vida Baixa / Resfriados" — Decapitar, Hipotermia: o "mais" só no alvo com a condição, no acerto
  // e na afecção — `af:mais_dano@alvo…`, `ModsPoe.golpeNoAlvo`)
  [new RegExp(`causam ${N}% (mais|menos) Dano com Acertos e Afecções contra Inimigos (em Vida Baixa|Resfriados)$`, 'i'), (m) => ({ [`af:mais_dano@${m[3].toLowerCase() === 'resfriados' ? 'alvoResfriado' : 'alvoVidaBaixa'}`]: (m[2] === 'mais' ? 1 : -1) * num(m[1]) })],
  // (o Golpe Múltiplo: o "mais Dano" de cada repetição vale só nela — `repeticaoMaisPct:<n>`, no `acertar`)
  [new RegExp(`^(Primeira|Segunda|Terceira) Repetição (?:de|das) Habilidades Suportadas causam? ${N}% (mais|menos) Dano$`, 'i'), (m) => ({ [`repeticaoMaisPct:${{ primeira: 1, segunda: 2, terceira: 3 }[m[1].toLowerCase()]}`]: (m[3] === 'mais' ? 1 : -1) * num(m[2]) })],
  // (o DEGENERATIVO — o PoB: ModFlag.Dot — vale nas afecções de dano e no degenerativo da gema, nunca no acerto; o de um tipo ("Dano de Caos
  // degenerativo" — o Veneno e o Caos da gema) e o "Incendiário" (o Fogo degenerativo: o Incêndio e o Fogo da gema))
  [new RegExp(`causam ${N}% (mais|menos) Dano Degenerativo$`, 'i'), (m) => ({ maisDotPct: (m[2] === 'mais' ? 1 : -1) * num(m[1]) })],
  [new RegExp(`causam ${N}% (mais|menos) Dano (?:de )?(Caos|Físico|Gelo|Fogo|Raio) [Dd]egenerativo$`, 'i'), (m) => ({ [MAIS_DOT_DO_TIPO[m[3].toLowerCase()]]: (m[2] === 'mais' ? 1 : -1) * num(m[1]) })],
  [new RegExp(`causam ${N}% (mais|menos) Dano Incendiário$`, 'i'), (m) => ({ maisDotFogoPct: (m[2] === 'mais' ? 1 : -1) * num(m[1]) })],
  // (o "aumentado" só do degenerativo e de uma afecção entra na soma das afecções — `af:dot_dmg_inc`, `af:ignite_dmg_inc`… —, não no acerto; o
  // "Dano com Acertos aumentado contra Inimigos em Vida Baixa" do Decapitar, só no alvo com a condição)
  [new RegExp(`causam ${N}% de Dano Degenerativo aumentado`, 'i'), (m) => ({ 'af:dot_dmg_inc': num(m[1]) })],
  [new RegExp(`causam ${N}% de Dano Incendiário aumentado`, 'i'), (m) => ({ 'af:ignite_dmg_inc': num(m[1]) })],
  [new RegExp(`causam Dano aumentado em ${N}% com (Veneno|Sangramento)`, 'i'), (m) => ({ [m[2].toLowerCase() === 'veneno' ? 'af:poison_dmg_inc' : 'af:bleed_dmg_inc']: num(m[1]) })],
  [new RegExp(`causam Dano com Acertos aumentado em ${N}% contra Inimigos que estejam em Vida Baixa`, 'i'), (m) => ({ 'af:dmg_inc@alvoVidaBaixa': num(m[1]) })],
  // (a Volatilidade: "X% mais Dano Máximo de Ataque" / "Y% menos Dano Mínimo de Ataque" — as pontas da faixa de cada parte do ataque, `contaDoDano`)
  [new RegExp(`causam ${N}% (mais|menos) Dano (Máximo|Mínimo) de Ataque$`, 'i'), (m, t, a) => (temTag(a, 'Ataque') ? { [m[3].toLowerCase() === 'máximo' ? 'maisMaxAtaquePct' : 'maisMinAtaquePct']: (m[2] === 'mais' ? 1 : -1) * num(m[1]) } : {})],
  // (o Sobre-esforço: o "mais" e o "aumentado" só no ataque Impelido — a tag `impelido` do golpe)
  [new RegExp(`Ataques Suportados causam ${N}% (mais|menos) Dano se Impelidos$`, 'i'), (m) => ({ 'af:mais_dano@impelido': (m[2] === 'mais' ? 1 : -1) * num(m[1]) })],
  [new RegExp(`Ataques Suportados causam Dano aumentado em ${N}% se Impelidos$`, 'i'), (m) => ({ 'af:dmg_inc@impelido': num(m[1]) })],
  // (a Sede de Sangue: o "mais Dano Físico Corpo a Corpo" só contra o alvo Sangrando — só no acerto, `acoes`; o "aumentado" contra ele)
  [new RegExp(`causam ${N}% mais Dano Físico Corpo a Corpo contra inimigos Sangrando`, 'i'), (m, t, a) => (temTag(a, 'Corpo a Corpo') ? { maisAcertoContraSangrandoPct: num(m[1]) } : {})],
  [new RegExp(`causam ${N}% de Dano Corpo a Corpo aumentado contra Inimigos Sangrando`, 'i'), (m, t, a) => (temTag(a, 'Corpo a Corpo') ? { 'af:dmg_inc@alvoSangrando': num(m[1]) } : {})],
  // (o Eco de Magia Maior: "+X% de dano mágico por repetição" — cada repetição X% a mais que a anterior, só no acerto da magia)
  [new RegExp(`causam \\+${N}% de dano mágico por repetição`, 'i'), (m, t, a) => (temTag(a, 'Magia') ? { repeticaoMaisPorPct: num(m[1]) } : {})],
  // (as chaves que as afecções do PoE já leem — `afeccoes.daSoma`: o Foco Elemental e a Sede de Sangue não infligem; o Sadismo "mais rápido" e a
  // duração "menos" (multiplica); as Afecções Desenfreadas no efeito das não danificadoras; a Aflição Ágil, a duração da habilidade e das de dano)
  [/^Habilidades Suportadas não podem infligir Afecções Elementais$/i, () => ({ 'af:nao_pode:incendio': 1, 'af:nao_pode:congelamento': 1, 'af:nao_pode:resfriamento': 1, 'af:nao_pode:eletrizacao': 1 })],
  [/^Ataques Suportados não podem causar Sangramento$/i, () => ({ 'af:nao_pode:sangramento': 1 })],
  [new RegExp(`^Afecções Danificadoras infligidas com Habilidades Suportadas causam Dano ${N}% mais rápido`, 'i'), (m) => ({ 'af:dot_mais_rapido': num(m[1]) })],
  [new RegExp(`^${N}% (mais|menos) Duração de Afecções infligidas com Habilidades Suportadas`, 'i'), (m) => ({ 'af:ailment_duration_mais': (m[2] === 'mais' ? 1 : -1) * num(m[1]) })],
  [new RegExp(`têm ${N}% do Efeito de Afecções não Danificantes aumentado`, 'i'), (m) => ({ 'af:efeito_nao_dano': num(m[1]), 'af:efeito_resfriamento': num(m[1]), 'af:efeito_eletrizacao': num(m[1]) })],
  [new RegExp(`^${N}% (mais|menos) Duração das Habilidades Suportadas e Afecções Danificadoras`, 'i'), (m) => ({ duracaoPct: (m[2] === 'mais' ? 1 : -1) * num(m[1]), 'af:duracao_afeccoes_dano_mais': (m[2] === 'mais' ? 1 : -1) * num(m[1]) })],
  // (a Dose Letal: "-2% de dano com venenos" — só o Veneno)
  [new RegExp(`causam ([+-])${N}% de dano com venenos`, 'i'), (m) => ({ maisVenenoPct: (m[1] === '-' ? -1 : 1) * num(m[2]) })],
  // (a Proliferação Elemental: a chance das três — antes só a de Congelar saía)
  [new RegExp(`têm ${N}% de chance de Congelar, Eletrizar e Incendiar`, 'i'), (m) => ({ congelarChance: num(m[1]), 'af:chance_shock': num(m[1]), 'af:chance_ignite': num(m[1]) })],
  [new RegExp(`causam ${N}% (mais|menos) Dano (?:de|com) Afecções$`, 'i'), (m) => ({ maisAfeccaoPct: (m[2] === 'mais' ? 1 : -1) * num(m[1]) })],
  [new RegExp(`causam ${N}% mais Dano com Afecções causad[oa]s por Acertos Corpo a Corpo`, 'i'), (m, t, a) => (temTag(a, 'Corpo a Corpo') ? { maisAfeccaoPct: num(m[1]) } : {})],
  [new RegExp(`causam ${N}% mais Dano com Sangramento e Veneno causados por Acertos Corpo a Corpo`, 'i'), (m, t, a) => (temTag(a, 'Corpo a Corpo') ? { maisSangramentoPct: num(m[1]), maisVenenoPct: num(m[1]) } : {})],
  [new RegExp(`(?:causam )?${N}% (mais|menos) Dano com (Sangramento|Incêndio|Veneno)$`, 'i'), (m) => ({ [{ sangramento: 'maisSangramentoPct', incêndio: 'maisIncendioPct', veneno: 'maisVenenoPct' }[m[3].toLowerCase()]]: (m[2] === 'mais' ? 1 : -1) * num(m[1]) })],
  // (a chance de cada afecção do suporte entra na ficha do uso — `af:chance_*`, as afecções do PoE —, não no estado do Draevor)
  [new RegExp(`têm ${N}% de chance de Incendiar`, 'i'), (m) => ({ 'af:chance_ignite': num(m[1]) })],
  [new RegExp(`têm ${N}% de chance de Envenenar`, 'i'), (m) => ({ 'af:chance_poison': num(m[1]) })],
  [new RegExp(`têm ${N}% de chance de causar Sangramento`, 'i'), (m) => ({ 'af:chance_bleed': num(m[1]) })],
  [/^Causa Sangramento$/i, () => ({ 'af:chance_bleed': 100 })],
  // (lote A3, dono 19/10) os PROJÉTEIS dos suportes, antes das regras gerais de dano (que pegavam o começo de algumas):
  // - o Ponto Cego (D9): "Os Acertos de Ataques … causam até 30% mais Dano aos alvos no início de seu movimento, causando menos Dano … na medida em
  //   que o projétil viaja adiante" é a flag PointBlank do PoB (ModParser.lua:2305) — a rampa do Queima-Roupa (`condicoes-poe.DISTANCIA_DO_PROJETIL`),
  //   sem somar com a keystone. Antes a regra geral do "até X% mais Dano" dava 30% mais a qualquer distância;
  [/^Os Acertos de Ataques das Habilidades Suportadas causam até [\d.,]+% mais Dano aos alvos no início de seu movimento/i, () => ({ 'af:queima_roupa': 1 })],
  // - o Atravessar (erro 1): "Projéteis de Habilidades Suportadas Atravessam N Alvos adicionais" (o jogo procurava "Perfuram N Inimigos");
  [new RegExp(`Atravessam ${N} Alvos adiciona`, 'i'), (m) => ({ perfurar: num(m[1]) })],
  // - o Retorno (F4): volta a você, "X% menos Dano com Acertos e Afecções enquanto Retornam" (o % da volta) e "Atravessam todos os Alvos enquanto
  //   Retornando" (D4: a reta da volta acerta todos os vivos no caminho — `Secundarios.resolver`);
  [/Projéteis de Habilidades Suportadas Retornam a você$/i, () => ({ retornar: 1 })],
  [new RegExp(`causam ${N}% menos Dano com Acertos e Afecções enquanto Retornam`, 'i'), (m) => ({ danoDoRetornoPct: Math.max(0, 100 - num(m[1])) })],
  [/Atravessam todos os Alvos enquanto Retornando$/i, () => ({ voltaAtravessa: 1 })],
  // - a Velocidade de Projétil (F1, D1): o "aumentada" é o atributo local do uso (soma com o das peças e o da gema); o "mais/menos" multiplica
  //   (`Acoes.velocidadeDoProjetil`);
  [new RegExp(`têm ${N}% de Velocidade de Projétil aumentada`, 'i'), (m) => ({ 'af:projectile_speed': num(m[1]) })],
  [new RegExp(`têm ${N}% (mais|menos) Velocidade de Projétil`, 'i'), (m) => ({ velProjetilMaisPct: (m[2] === 'mais' ? 1 : -1) * num(m[1]) })],
  // - a Difusão Maior/Desperta (F5): "podem Difundir N Vezes adicionais" (os filhos difundem de novo) e "X% de chance de ganhar um Projétil
  //   adicional ao Difundirem" — somam com os das peças e da gema (`Acoes.comOsAlvosDaGema`);
  [new RegExp(`podem Difundir ${N} Vez\\w* adicionais`, 'i'), (m) => ({ bifurcarDeNovo: num(m[1]) })],
  [new RegExp(`têm ${N}% de chance de ganhar um Projétil adicional ao Difundirem`, 'i'), (m) => ({ bifurcarExtraChance: num(m[1]) })],
  // - a quantidade e a emissão (F7): a Saraivada ("também disparam Projéteis de até N pontos de cada lado seu" — D7: origens laterais na
  //   perpendicular), a Nova de Flechas (o círculo a partir do ponto do alvo — D7 — e "só podem ser usadas com Arcos"), o Localizar (a Intensidade:
  //   um projétil a menos e X% mais Dano com Acertos por Intensidade, o PoB: sup_int.lua:5510) e a Mina Locus ("X% menos Projéteis"), com o
  //   "sempre disparam ao menos N Projétil" dos dois
  [new RegExp(`também disparam Projéteis de até ${N} pontos de cada lado seu`, 'i'), (m) => ({ origensLaterais: num(m[1]) })],
  [/Disparam Projéteis em um círculo$/i, () => ({ emCirculo: 1 })],
  [/disparam uma Flecha Carregada no ar(?:\s|\\n)+Projéteis da Habilidade Suportada Disparam de onde a Flecha Carregada cair/i, () => ({ doPontoDoAlvo: 1 })],
  [/só podem ser usadas com Arcos$/i, () => ({ soArco: 1 })],
  // (lote A5, dono 20/10) as restrições de arma da Fissura e do Trauma (a da Onda de Choque do Vazio subiu para cá — a Excepcional tem a própria, em
  // `PROPRIAS_A2`), da Onda de Choque e do Combate Próximo — `Acoes.dispararSemMarcar` (D6: com duas armas, a mão principal)
  [/só podem ser usadas com Machados, Maças, Cetros ou Cajados$/i, () => ({ soMachadoMacaCetroCajado: 1 })],
  [/só podem ser usadas com Maças, Cetros ou Cajados$/i, () => ({ soMacaCetroCajado: 1 })],
  [/só podem ser usadas com Machados e Espadas$/i, () => ({ soMachadoEspada: 1 })],
  [new RegExp(`ganham Intensidade quando você as Conjurar, máximo de ${N}(?:\\s|\\\\n)+Habilidades Suportadas disparam um Projétil a menos por Intensidade`, 'i'), (m) => ({ intensidadeMax: num(m[1]), intensidadeMenosProjetil: 1 })],
  [new RegExp(`causam ${N}% mais Dano com Acertos por Intensidade`, 'i'), (m) => ({ intensidadeMaisProjetilPct: num(m[1]) })],
  [new RegExp(`sempre disparam ao menos ${N} Projétil`, 'i'), (m) => ({ projeteisMinimo: num(m[1]) })],
  [new RegExp(`disparam ${N}% menos Projéteis`, 'i'), (m) => ({ menosProjeteisPct: num(m[1]) })],
  // Dano: "mais/menos" multiplica (como no PoE); "aumentado/reduzido" soma.
  [new RegExp(`causa[m]? (?:até )?${N}% (mais|menos) Dano(?! com Sangramento| com Incêndio| de Afecções| Propagado| enquanto Morto| com Acertos e Afecções contra| com Acertos por|[^%]* por cada |[^%]* enquanto Retornam)`, 'i'), (m, t, a) => (valeParaOTipo(t, a) ? maisDe(t, (m[2] === 'mais' ? 1 : -1) * num(m[1])) : null)],
  [new RegExp(`^(?!Repetições|Explosão)[^%]*?causam? ([+-])${N}% de dano(?![^%]*por estágio)`, 'i'), (m, t, a) => (valeParaOTipo(t, a) ? maisDe(t, (m[1] === '-' ? -1 : 1) * num(m[2])) : null)],
  [new RegExp(`Magias Suportadas têm ${N}% mais Dano Mágico`, 'i'), (m, t, a) => (temTag(a, 'Magia') ? { maisDanoAcertoPct: num(m[1]), maisDanoMagicoPct: num(m[1]) } : null)],
  // (revisão do lote da eficácia, 20/10 — o PoB: `fire_damage_+%`, `cold_damage_+%`, `physical_damage_+%`… nos `qualityStats`) "causam X% de Dano de Fogo
  // aumentado" é o aumentado DAQUELE TIPO, só na parte dele e sem depender de tag (`af:<tipo>_dmg` no uso, como as linhas locais); antes, `danoPct` no dano todo e só
  // com a tag do tipo na gema
  [new RegExp(`causam? ${N}% de Dano (de Fogo|de Gelo|de Raio|de Caos|Físico) aumentado$`, 'i'), (m) => ({ [`af:${{ 'de fogo': 'fire', 'de gelo': 'ice', 'de raio': 'energy', 'de caos': 'chaos', 'físico': 'phys' }[m[2].toLowerCase()]}_dmg`]: num(m[1]) })],
  // (revisão do lote da eficácia, 20/10) a CONVERSÃO da habilidade dos suportes ("têm 50% de Dano Físico Convertido em Dano de Raio", "…de Gelo Convertido para Dano de
  // Fogo"): a do Físico entra com a da gema (`acoes.contaDoDano` → `GemasPoe.partesDoAtaque`), a de um elemento antes das outras fontes (`ModsPoe.transformarPartes`)
  [new RegExp(`têm ${N}% de Dano (?:de )?(\\S+) Convertido (?:em|para) Dano de (\\S+)`, 'i'), (m) => {
    const de = ELEMENTO_DO_TEXTO[m[2].toLowerCase()];
    const para = ELEMENTO_DO_TEXTO[m[3].toLowerCase()];
    if (!de || !para || de === para || para === 'physical') return null;
    return { [`af:conv_hab_${de}_${para}`]: num(m[1]) };
  }],
  [new RegExp(`causam? ${N}% de Dano (?:de )?(\\S+)? ?aumentado`, 'i'), (m, t, a) => (valeParaOTipo(t, a) ? { danoPct: num(m[1]) } : null)],
  // (lote 76) o "Dano aumentado com Incêndio" da qualidade: só no Incêndio (o de Veneno e o de Sangramento, no bloco do lote G17, acima)
  [new RegExp(`causam Dano aumentado em ${N}% com Incêndio`, 'i'), (m) => ({ 'af:ignite_dmg_inc': num(m[1]) })],
  [new RegExp(`causam Dano aumentado em ${N}%`, 'i'), (m) => ({ danoPct: num(m[1]) })],
  [new RegExp(`Dano [^%]*?aumentado em ${N}%`, 'i'), (m, t, a) => (valeParaOTipo(t, a) ? { danoPct: num(m[1]) } : null)],
  [new RegExp(`${N}% de Dano [^%]*?aumentado`, 'i'), (m, t, a) => (valeParaOTipo(t, a) ? { danoPct: num(m[1]) } : null)],
  // (dono, 20/10) "ganham X% de Dano Físico como Dano Extra de Fogo" (o Dano Adicional de Fogo, o Excomungar, o Físico em Raio) e "…de Dano de Gelo como
  // Dano Extra de Fogo" (o Gelo em Fogo): o GANHO COMO EXTRA do PoE, sobre o dano daquele tipo que o golpe tem de fato — `af:phys_as_extra_<el>` /
  // `af:<de>_as_extra_<para>` no uso (`ModsPoe.extrasDoFisico`, `ModsPoe.transformarPartes`). Antes: "Dano aumentado" e só se a gema tinha a tag do tipo
  // (o Cyclone, sem a tag Físico, não ganhava nada; o Gelo em Fogo, nunca)
  [new RegExp(`ganham ${N}% de Dano (?:de )?(\\S+) como Dano Extra de (\\S+)`, 'i'), (m) => {
    const de = ELEMENTO_DO_TEXTO[m[2].toLowerCase()];
    const para = ELEMENTO_DO_TEXTO[m[3].toLowerCase()];
    if (!de || !para || para === 'physical' || de === para) return null;
    return { [`af:${de === 'physical' ? 'phys' : de}_as_extra_${para}`]: num(m[1]) };
  }],
  // (revisão do A5: "não causam Dano Elemental" / "de Caos" — a Manipulação do Vazio — tira só a PARTE daquele tipo do golpe, não o dano todo — `Acoes.contaDoDano`;
  // antes um "−100% mais" zerava também o Caos)
  [/não causam Dano Elemental/i, () => ({ semDanoElemental: 1 })],
  [/não causam Dano de Caos/i, () => ({ semDanoCaos: 1 })],
  // Dano ADICIONADO (× a eficácia da gema, no `contaDoDano`).
  // O elemento vai junto (`somadoMin:fire`...): o ataque do PoE separa o dano por elemento (`GemasPoe.partesDoAtaque`).
  [new RegExp(`têm ${N} a ${N} de Dano de (\\S+) adicional`, 'i'), (m) => { const el = ELEMENTO_DO_TEXTO[m[3].toLowerCase()] ?? 'physical'; return { somadoMin: num(m[1]), somadoMax: num(m[2]), [`somadoMin:${el}`]: num(m[1]), [`somadoMax:${el}`]: num(m[2]) }; }],
  // Velocidade. O "mais/menos" MULTIPLICA o tempo de uso (`castTimePct`); o "aumentada" SOMA com os aumentos da ficha, como no PoE
  // (`velAtaquePct`/`velConjuracaoPct` → `Acoes.temposDaGemaPoe`). Antes o "aumentada" também multiplicava: Ataques Acelerados nv 10 (31%) com
  // +40% global fazia a Cutilada em 440 ms em vez dos 472 do PoE (1,55 × 0,8 × 1,71).
  [new RegExp(`têm ${N}% (mais|menos) Velocidade de (Ataque|Conjuração)( Corpo a Corpo)?`, 'i'), (m, t, a) => ((m[3] === 'Ataque' && !temTag(a, 'Ataque')) || (m[3] === 'Conjuração' && !temTag(a, 'Magia')) || (m[4] && !temTag(a, 'Corpo a Corpo')) ? null : { castTimePct: tempoDaVelocidade((m[2] === 'mais' ? 1 : -1) * num(m[1])) })],
  // O Momentum e a Fúria (as velocidades CONDICIONAIS — antes da regra geral do "aumentada", que pegava o começo delas e valia sempre):
  // "N% por Momentum" (× o Momentum na hora: `Acoes.temposDaGemaPoe`), "enquanto você tiver ao menos M de Fúria" (`velAtaquePct@furia:M`), o
  // Momentum de cada uso, o máximo que vira Rapidez e a Fúria no acerto (`ModsPoe.ganharMomentum`, `Acoes`).
  [new RegExp(`têm Velocidade de Ataque aumentada em ${N}% por Momentum`, 'i'), (m, t, a) => (temTag(a, 'Ataque') ? { velAtaquePorMomentumPct: num(m[1]) } : null)],
  [new RegExp(`têm Velocidade de Ataque aumentada em ${N}% enquanto você tiver ao menos ${N} de Fúria`, 'i'), (m, t, a) => (temTag(a, 'Ataque') ? { [`velAtaquePct@furia:${num(m[2])}`]: num(m[1]) } : null)],
  [new RegExp(`^Ganhe ${N} de Momentum quando você Usar uma Habilidade Suportada`, 'i'), (m) => ({ momentumPorUso: num(m[1]) })],
  [new RegExp(`^Ao atingir ${N} de Momentum, perca todo o Momentum e ganhe Rapidez por ${N} segundos`, 'i'), (m) => ({ momentumMaximo: num(m[1]), rapidezMs: Math.round(num(m[2]) * 1000) })],
  [new RegExp(`^Rapidez concede Velocidade de Movimento aumentada em ${N}% por Momentum perdido`, 'i'), (m) => ({ rapidezMovimentoPct: num(m[1]) })],
  [new RegExp(`^Rapidez du(?:d)?ra \\+?${N} segundos`, 'i'), (m) => ({ rapidezMs: Math.round(num(m[1]) * 1000) })],
  [new RegExp(`^Ganhe ${N} de Fúria no Acerto com Ataques`, 'i'), (m) => ({ furiaNoAcerto: num(m[1]) })],
  [new RegExp(`têm Velocidade de (Ataque|Conjuração) aumentada em ${N}%`, 'i'), (m, t, a) => (temTag(a, m[1] === 'Ataque' ? 'Ataque' : 'Magia') ? { [m[1] === 'Ataque' ? 'velAtaquePct' : 'velConjuracaoPct']: num(m[2]) } : null)],
  [new RegExp(`têm ${N}% de Velocidade de (Ataque|Conjuração) aumentada`, 'i'), (m, t, a) => (temTag(a, m[2] === 'Ataque' ? 'Ataque' : 'Magia') ? { [m[2] === 'Ataque' ? 'velAtaquePct' : 'velConjuracaoPct']: num(m[1]) } : null)],
  // Projéteis, alvos, perfurar, bifurcar, encadear.
  [new RegExp(`atiram ${N} Proj\\S+ adiciona`, 'i'), (m) => ({ alvosExtras: num(m[1]) })],
  [new RegExp(`Ricocheteiam \\+?${N} vez`, 'i'), (m) => ({ encadear: num(m[1]) })],
  [new RegExp(`focam em ${N} Inimigos próximos adicionais`, 'i'), (m) => ({ alvosExtras: num(m[1]) })],
  [new RegExp(`Perfuram ${N} Inimigos? adiciona`, 'i'), (m) => ({ perfurar: num(m[1]) })],
  [/Projéteis .*Bifurcam/i, () => ({ bifurcar: 2 })],
  [new RegExp(`Encadeiam \\+?${N} vez`, 'i'), (m) => ({ encadear: num(m[1]) })],
  // Área (lote 36, P002 — "Toda área em metros"): o "mais/menos" (multiplica entre os suportes) e o "aumentado" (soma com o das peças) em %;
  // o raio da forma cresce × √ no uso (`acoes`, `ModsPoe.casasPelaArea`). Antes, ±1 casa a cada ~25%.
  [new RegExp(`têm ${N}% (mais|menos) Efeito em Área`, 'i'), (m) => ({ areaMaisPct: (m[2] === 'mais' ? 1 : -1) * num(m[1]) })],
  // (lote 83) a da Blasfêmia: "Efeito em Área de Habilidades Maldição Suportadas aumentado em X%" — o raio da maldição (`acoes.efeitosDaMaldicao`)
  [new RegExp(`Efeito em Área de Habilidades (?:de )?Maldição Suportadas aumentad[oa] em ${N}%`, 'i'), (m) => ({ areaMaldicaoPct: num(m[1]) })],
  [new RegExp(`(?:Área de Efeito|Efeito em Área) aumentad[oa] em ${N}%`, 'i'), (m, t) => (/Maldição|Clamor|Lacaio/i.test(t) ? null : { areaIncPct: num(m[1]) })],
  // Crítico.
  [new RegExp(`têm \\+${N}% (?:de|ao) Multiplicador de (?:Dano de )?Acertos? Críticos?`, 'i'), (m) => ({ critDano: num(m[1]) })],
  [new RegExp(`Chance de Acerto Crítico(?: \\S+)* aumentad[oa] em ${N}%`, 'i'), (m) => ({ critChance: num(m[1]) / 20 })],
  [new RegExp(`têm \\+${N}% de Chance de (?:Acerto )?Crítico`, 'i'), (m) => ({ critChance: num(m[1]) })],
  [new RegExp(`têm ${N}% da Chance de Crítico aumentada`, 'i'), (m) => ({ critChance: num(m[1]) / 20 })],
  [new RegExp(`têm ${N}% menos Chance de (?:Golpe|Acerto) Crítico`, 'i'), (m) => ({ critChance: -num(m[1]) / 20 })],
  [new RegExp(`têm \\+${N}% de Multiplicador de Crítico`, 'i'), (m) => ({ critDano: num(m[1]) })],
  // (17/10, lote G16) a Penetração entra no uso como o atributo da ficha (`af:fire_pen`… → `ficha.penetracao` pela ficha do golpe): só o dano
  // daquele elemento penetra — o `penetracaoPct` de antes ninguém lia (o teste das gemas "funciona" achou).
  [new RegExp(`Penetram ${N}% de Resistência (?:a |ao )?(Fogo|Gelo|Raio)`, 'i'), (m) => ({ [`af:${ELEMENTO_DA_TAG[m[2][0].toUpperCase() + m[2].slice(1).toLowerCase()]}_pen`]: num(m[1]) })],
  [new RegExp(`Penetram ${N}% das Resistências Elementais`, 'i'), (m) => ({ 'af:elem_pen': num(m[1]) })],
  [/Utilizar Habilidades Suportadas é Instantâneo/i, () => ({ castTimePct: -100 })],
  [new RegExp(`Velocidade de Recuperação da Recarga aumentada em ${N}%`, 'i'), (m) => ({ recargaPct: tempoDaVelocidade(num(m[1])) })],
  [new RegExp(`têm ${N}% menos Custo de Mana`, 'i'), (m) => ({ custoPct: -num(m[1]) })],
  [/Projéteis .*se Difundem/i, () => ({ bifurcar: 2 })],
  // Informativas do próprio suporte (o raio e a duração do que ele cria): não mudam a skill suportada.
  [/^O raio Base é de|^Duração base é de|^Raio de alcance secundário/i, () => ({})],
  [new RegExp(`têm ${N}% mais Recuperação da Recarga`, 'i'), (m) => ({ recargaPct: tempoDaVelocidade(num(m[1])) })],
  // Afecções ao acertar.
  [new RegExp(`têm ${N}% de chance de Congelar`, 'i'), (m) => ({ congelarChance: num(m[1]) })],
  // Duração, recarga, drenagem.
  [new RegExp(`têm ${N}% (mais|menos) Duração`, 'i'), (m) => ({ duracaoPct: (m[2] === 'mais' ? 1 : -1) * num(m[1]) })],
  [new RegExp(`Duração (?:de Habilidade )?aumentada em ${N}%`, 'i'), (m) => ({ duracaoPct: num(m[1]) })],
  [new RegExp(`Velocidade de Recarga aumentada em ${N}%`, 'i'), (m) => ({ recargaPct: tempoDaVelocidade(num(m[1])) })],
  [new RegExp(`${N}% do Dano .*Drenado como Vida`, 'i'), (m) => ({ leechVidaPct: num(m[1]) })],
  [new RegExp(`${N}% do Dano .*Drenado como Mana`, 'i'), (m) => ({ leechManaPct: num(m[1]) })],
  // Nível das gemas suportadas (Fortalecer...).
  // (lote A5, dono 20/10: + "1 do Nível das Gemas de Habilidade de Caos Suportadas" — o Manipulação do Vazio Desperto: "do Nível", e só nas de Caos)
  [new RegExp(`^\\+?${N} (?:ao|do) N[iíï]vel (?:de|das) Gemas de (?:Habilidade )?(\\S+)? ?(?:de )?(?:Habilidades? )?(\\S+)? ?Suportadas`, 'i'), (m, t, a) => {
    const so = /Físicas/i.test(t) ? 'Físico' : /de Fogo/i.test(t) ? 'Fogo' : /de Caos/i.test(t) ? 'Caos' : /Aura/i.test(t) ? 'Aura' : /Golpes/i.test(t) ? 'Golpe' : null;
    return !so || temTag(a, so) ? { nivelExtra: Math.floor(num(m[1])) } : null;
  }],
  // Repetições (Eco de Magia, Golpe Múltiplo): a skill sai de novo na hora.
  [new RegExp(`Repetem ${N} vez(?:es)? adiciona`, 'i'), (m) => ({ repeticoes: num(m[1]) })],
  [/Repetição (?:de|das) Habilidades Suportadas causa/i, () => ({})],
  // (lote A4, dono 19/10) o Eco Desperto: "Repetição Final das Habilidades Suportadas tem X% de chance de causar Dano Dobrado" — sorteado na última
  // repetição do uso (`Acoes.dispararSemMarcar`: o `dobroNaFinal`, que não dobra o golpe que já saiu Dobrado)
  [new RegExp(`^Repetição Final das Habilidades Suportadas tem ${N}% de chance de causar Dano Dobrado$`, 'i'), (m) => ({ repeticaoFinalDobroPct: num(m[1]) })],
  // As propriedades que não mexem no efeito (o nível, o raio informativo, a recarga do gatilho — tratada no gatilho).
  [/^Nível:|^Recarga:|^Tempo de Uso:|^CooldownTime:|^Eficácia do Dano Adicionado:|^Dano de Ataque: .* de base|^Tempo de Conjuração:|^Chance de Crítico:|^Velocidade de Projétil:/, () => ({})],
  [/Experiência aumentada|requerem uma quantidade de Dano sofrido reduzid/i, () => ({})],
  // Os textos dos gatilhos (a regra está no gatilho).
  [/Ativarão uma Magia Suportada|Ativa Magias Suportadas quando você sofrer|só pode Suportar Gemas de Habilidade que requerem Nível/i, () => ({})],
];

/** O GATILHO do suporte (ou null): `{ quando: 'critico'|'abate'|'danoRecebido', recargaMs, limiar }` no nível. */
function gatilhoDe(s, textos) {
  const tudo = [...textos.mods, ...textos.props].join(' | ');
  const recarga = textos.props.map((p) => p.match(/^Recarga: (-?\d+(?:\.\d+)?) seg/)).find(Boolean);
  // (lote S1: o Conjurar no Acerto Crítico Desperto — "Magias Suportadas têm Recuperação da Recarga aumentada em X%": a recarga das magias ativadas ÷ (1 + X%))
  const recuperacao = Number(/Magias Suportadas têm Recuperação da Recarga aumentada em (\d+(?:\.\d+)?)%/i.exec(tudo)?.[1]) || 0;
  const recargaMs = recarga ? Math.round((parseFloat(recarga[1]) * 1000) / (1 + recuperacao / 100)) : 250;
  if (/Ativarão uma Magia Suportada ao causar um Crítico/i.test(tudo)) return { quando: 'critico', recargaMs };
  if (/Ativarão uma Magia Suportada ao Matar/i.test(tudo)) return { quando: 'abate', recargaMs };
  const dano = tudo.match(/Ativa Magias Suportadas quando você sofrer (\d+(?:\.\d+)?) de Dano total/i);
  if (dano) return { quando: 'danoRecebido', recargaMs, limiar: parseFloat(dano[1]) };
  // (17/10, lote G15) Conjurar enquanto Canaliza ("Ativa uma Magia Suportada a cada N segundos enquanto Canalizando" — o intervalo é a recarga do
  // gatilho), Conjurar ao ser Atordoado ("X% de chance de Ativar Magias Suportadas quando você for Atordoado") e Conjurar ao Morrer
  const canal = tudo.match(/Ativa uma Magia Suportada a cada (\d+(?:\.\d+)?) segundos enquanto Canalizando/i);
  if (canal) return { quando: 'canalizar', recargaMs: Math.round(parseFloat(canal[1]) * 1000) };
  const atordoado = tudo.match(/(\d+(?:\.\d+)?)% de chance de Ativar Magias Suportadas quando você for Atordoado/i);
  if (atordoado) return { quando: 'atordoado', recargaMs, chance: parseFloat(atordoado[1]) };
  if (/chance de Ativar Magias de Não-Lacaios Suportadas ao Morrer/i.test(tudo)) return { quando: 'morte', recargaMs };
  // (lote S2A, 27/10) o Marcar ao Acertar: a Marca suportada sai quando você Acerta um Inimigo Raro ou Único com um Ataque (a recarga do suporte, 4 s)
  if (ehGatilhoDoMarcar(tudo)) return { quando: 'acertoRaro', recargaMs };
  // (lote S2A) a Flecha Forjada com Mana: os Ataques de Arco suportados saem quando a Mana gasta em OUTROS Ataques de Arco passa de X% do custo deles (a recarga, 0,5 s)
  const limiarPct = limiarDaFlechaForjada(tudo);
  if (limiarPct != null) return { quando: 'manaForjada', recargaMs, limiarPct };
  return null;
}

/** O que o jogo não tem (o suporte inteiro não age): totens, armadilhas, minas, lacaios, marcas, clamores, estandartes. */
// (lote A2, dono 19/10: a Sentinela Divina — as sentinelas existem desde os lacaios — e a Torre Óssea — `Acoes.torresOsseas` — saíram daqui)
const SEM_SISTEMA = [];

/** A linha do suporte sem o "Habilidades Suportadas têm"/"com Habilidades Suportadas" (o modificador como a gema o escreveria). */
function linhaSemSuportadas(l) {
  const t = String(l)
    .replace(/^(?:Habilidades|Ataques|Magias) Suportad[ao]s (?:têm|tem|possuem|causam) /i, '')
    .replace(/ (?:infligid[ao]s? )?(?:com|por|de|das|pelas|nas) (?:Habilidades|Ataques|Magias) Suportad[ao]s/i, '')
    .replace(/ das Habilidades Suportadas/i, '');
  return t.charAt(0).toUpperCase() + t.slice(1);
}
/**
 * (lote A2, dono 19/10) As linhas da TORRE ÓSSEA (Bonespire, Excepcional: "Clamores reforçados ativam Tomar a Carne ao usar" — o poedb) e da
 * SENTINELA DIVINA. A Torre Óssea: `torresOsseas` (o Clamor suportado as ergue — `Acoes.torresOsseas`), `torres` (quantas), `torresMax`,
 * `torresMs` (a duração), `torresRaioM` (o raio da explosão), `torresAlcanceM` (o raio em que nascem em volta de você), `torresDanoPct` (o "Dano de
 * Ataque: X% de base"), `torresSangramentoMaisPct` e `torresRecargaMs`. A Sentinela Divina: `areaLacaioPct` e `auraTemplaria` (`Acoes.invocarLacaios`).
 */
const PROPRIAS_A2 = {
  Bonespire_Support: [
    [/^Clamores reforçados ativam Tomar a Carne ao usar$/i, (m, e) => { e.torresOsseas = 1; }],
    [new RegExp(`^Cria \\+?${N} torres de osso$`, 'i'), (m, e) => { e.torres = (e.torres ?? 0) + Math.floor(num(m[1])); }],
    [new RegExp(`^Máximo de ${N} torres de osso$`, 'i'), (m, e) => { e.torresMax = num(m[1]); }],
    [new RegExp(`^Duração base é de ${N} segundos?$`, 'i'), (m, e) => { e.torresMs = Math.round(num(m[1]) * 1000); }],
    [new RegExp(`^O raio Base é de ${N} metros?$`, 'i'), (m, e) => { e.torresRaioM = num(m[1]); }],
    [new RegExp(`^Raio de alcance secundário base é de ${N} metros?$`, 'i'), (m, e) => { e.torresAlcanceM = num(m[1]); }],
    [new RegExp(`^${N}% mais Dano com Sangramento$`, 'i'), (m, e) => { e.torresSangramentoMaisPct = num(m[1]); }],
    [/^Causa Sangramento$/i, (m, e) => { e.torresSangram = 1; }],
    [new RegExp(`^Dano de Ataque: ${N}% de base$`, 'i'), (m, e) => { e.torresDanoPct = num(m[1]); }],
    [new RegExp(`^Recarga: ${N} seg`, 'i'), (m, e) => { e.torresRecargaMs = Math.round(num(m[1]) * 1000); }],
    [/^Tempo de Uso:|^Eficácia do Dano Adicionado:/i, () => {}],
  ],
  // (lote A4, dono 19/10) as Excepcionais da ONDA DE CHOQUE DO VAZIO e da TORMENTA DO VAZIO: a habilidade que o suporte concede tem os números dela (a
  // recarga, o "Dano de Ataque: X% de base", o raio, a duração, a qualidade dela — o "Dano … aumentado" sem "Habilidades Suportadas"), que as regras
  // gerais leriam como da suportada. A onda: `ondaDoVazio`, `ondaRaioM`, `ondaRepeticoes`, `ondaRepeticaoMaisPct`, `ondaRecargaMs`, `ondaDanoPct`,
  // `ondaIncPct`, `soMachadoMacaCetroCajado` (`Acoes.ondaDoVazio`). A tormenta: `tormentaDoVazio`, `tormentaMinM`, `tormentaMs`, `tormentaRaioM`,
  // `tormentasMax`, `tormentaEstagioMs`, `tormentaEstagiosMax`, `tormentaAreaPorEstagioPct`, `tormentaDanoPorEstagioPct`, `tormentaRecargaMs`,
  // `tormentaDanoPct`, `tormentaIncPct` (`Acoes.tiqueDasTormentas`).
  Void_Shockwave_Support: [
    [/^Habilidades Suportadas Ativam Onda de Choque no Acerto Corpo a Corpo$/i, (m, e) => { e.ondaDoVazio = 1; }],
    [/^Habilidades Suportadas só podem ser usadas com Machados, Maças, Cetros ou Cajados$/i, (m, e) => { e.soMachadoMacaCetroCajado = 1; }],
    [new RegExp(`^O raio Base é de ${N} metros?$`, 'i'), (m, e) => { e.ondaRaioM = num(m[1]); }],
    [new RegExp(`^Onda de choque se repete de até ${N} inimigos na área$`, 'i'), (m, e) => { e.ondaRepeticoes = Math.floor(num(m[1])); }],
    [new RegExp(`^Repetições da onda de choque causam ${N}% de dano com ataques e afecções$`, 'i'), (m, e) => { e.ondaRepeticaoMaisPct = num(m[1]); }],
    [new RegExp(`^Recarga: ${N} seg`, 'i'), (m, e) => { e.ondaRecargaMs = Math.round(num(m[1]) * 1000); }],
    [new RegExp(`^Dano de Ataque: ${N}% de base$`, 'i'), (m, e) => { e.ondaDanoPct = num(m[1]); }],
    [new RegExp(`^Dano Corpo a Corpo aumentado em ${N}%$`, 'i'), (m, e) => { e.ondaIncPct = (e.ondaIncPct ?? 0) + num(m[1]); }],
    [/^Tempo de Uso:|^Eficácia do Dano Adicionado:/i, () => {}],
  ],
  Voidstorm_Support: [
    [new RegExp(`^Habilidades reforçadas ativam Tormenta do Vazio ao atingir o chão(?:\\\\n|\\s)+Tormentas do Vazio não podem ser ativadas a menos de ${N} metros de você$`, 'i'), (m, e) => { e.tormentaDoVazio = 1; e.tormentaMinM = num(m[1]); }],
    [new RegExp(`^Duração base é de ${N} segundos?$`, 'i'), (m, e) => { e.tormentaMs = Math.round(num(m[1]) * 1000); }],
    [new RegExp(`^O raio Base é de ${N} metros?$`, 'i'), (m, e) => { e.tormentaRaioM = num(m[1]); }],
    [new RegExp(`^Máximo de ${N} tempestades$`, 'i'), (m, e) => { e.tormentasMax = Math.floor(num(m[1])); }],
    [new RegExp(`^Tempestades ganham um estágio por ${N} segundos?, até ${N}$`, 'i'), (m, e) => { e.tormentaEstagioMs = Math.round(num(m[1]) * 1000); e.tormentaEstagiosMax = Math.floor(num(m[2])); }],
    [new RegExp(`^Tempestades têm \\+${N}% de área de efeito por estágio$`, 'i'), (m, e) => { e.tormentaAreaPorEstagioPct = num(m[1]); }],
    [new RegExp(`^Explosão causa \\+${N}% de dano com ataques e afecções por estágio$`, 'i'), (m, e) => { e.tormentaDanoPorEstagioPct = num(m[1]); }],
    [new RegExp(`^Recarga: ${N} seg`, 'i'), (m, e) => { e.tormentaRecargaMs = Math.round(num(m[1]) * 1000); }],
    [new RegExp(`^Dano de Ataque: ${N}% de base$`, 'i'), (m, e) => { e.tormentaDanoPct = num(m[1]); }],
    [new RegExp(`^Dano em Área aumentado em ${N}%$`, 'i'), (m, e) => { e.tormentaIncPct = (e.tormentaIncPct ?? 0) + num(m[1]); }],
    [/^Tempo de Uso:|^Eficácia do Dano Adicionado:/i, () => {}],
  ],
  // (lote S1, 26/10) a ONDA DE CHOQUE (o suporte comum): a mesma onda da Excepcional (`Acoes.ondaDoVazio`), com os números dela — a recarga com os usos ("Recarga: 1.00
  // seg (4 Times)"), a "Velocidade de Recarga aumentada" (só a da onda), o "Dano de Ataque: X% de base", o raio e o "Dano Corpo a Corpo aumentado" da qualidade dela;
  // sem repetições
  Shockwave_Support: [
    [/^Habilidades Suportadas Ativam Onda de Choque no Acerto Corpo a Corpo$/i, (m, e) => { e.ondaDoVazio = 1; }],
    [new RegExp(`^Recarga: ${N} seg(?:\\s*\\((\\d+) Times\\))?`, 'i'), (m, e) => { e.ondaRecargaMs = Math.round(num(m[1]) * 1000); if (m[2]) e.ondaUsos = Number(m[2]); }],
    [new RegExp(`^Velocidade de Recarga aumentada em ${N}%$`, 'i'), (m, e) => { e.ondaRecargaIncPct = (e.ondaRecargaIncPct ?? 0) + num(m[1]); }],
    [new RegExp(`^O raio Base é de ${N} metros?$`, 'i'), (m, e) => { e.ondaRaioM = num(m[1]); }],
    [new RegExp(`^Dano de Ataque: ${N}% de base$`, 'i'), (m, e) => { e.ondaDanoPct = num(m[1]); }],
    [new RegExp(`^Dano Corpo a Corpo aumentado em ${N}%$`, 'i'), (m, e) => { e.ondaIncPct = (e.ondaIncPct ?? 0) + num(m[1]); }],
    [/^Tempo de Uso:|^Eficácia do Dano Adicionado:/i, () => {}],
  ],
  // (lote S2B, 27/10) a EXPLOSÃO PRISMÁTICA e a DESTRUIÇÃO IMINENTE: a magia que o suporte ativa tem os números dela (o dano, o raio — o PoB: 13 e 20 unidades de base,
  // 1,3 m e 2 m; a Prismática + "0.9 metros de raio" —, a recarga, o crítico, a eficácia e a qualidade — "Dano Elemental aumentado" / "Área de Efeito aumentada" são da
  // magia ativada no PoB, `PrismaticBurst`/`DoomBlast`.qualityStats), que as regras gerais davam à suportada (o "100% menos Dano de cada Tipo não escolhido" zerava o
  // dano da suportada). `Acoes.prismaNoAcerto`, `Acoes.tiqueDosFeiticosS2B`.
  Prismatic_Burst_Support: [
    [/^Habilidades Suportadas Ativam Explosão Prismática ao Acertar$/i, (m, e) => { e.prisma = 1; }],
    [new RegExp(`^Causa ${N} a ${N} de Dano de (Gelo|Raio|Fogo)$`, 'i'), (m, e) => { const el = ELEMENTO_DO_TEXTO[m[3].toLowerCase()]; e[`prismaMin_${el}`] = num(m[1]); e[`prismaMax_${el}`] = num(m[2]); }],
    [new RegExp(`^\\+?${N} metros de raio$`, 'i'), (m, e) => { e.prismaRaioM = 1.3 + num(m[1]); }],
    [/^Causa 100% menos Dano de cada Tipo de Dano não escolhido$/i, () => {}],
    [new RegExp(`^Velocidade de Recarga aumentada em ${N}%$`, 'i'), (m, e) => { e.prismaRecargaIncPct = (e.prismaRecargaIncPct ?? 0) + num(m[1]); }],
    [new RegExp(`^Recarga: ${N} seg`, 'i'), (m, e) => { e.prismaRecargaMs = Math.round(num(m[1]) * 1000); }],
    [new RegExp(`^Chance de Crítico: ${N}%$`, 'i'), (m, e) => { e.prismaCrit = num(m[1]); }],
    [new RegExp(`^Eficácia do Dano Adicionado: ${N}%$`, 'i'), (m, e) => { e.prismaEficacia = num(m[1]) / 100; }],
    [new RegExp(`^Dano Elemental aumentado em ${N}%$`, 'i'), (m, e) => { e.prismaIncPct = (e.prismaIncPct ?? 0) + num(m[1]); }],
    [/^Tempo de Conjuração:/i, () => {}],
  ],
  Impending_Doom_Support: [
    [/^Ativa Explosão Destruidora quando um Feitiço de Habilidades Maldição Suportadas terminar$/i, (m, e) => { e.doomBlast = 1; e.doomRaioM = 2; }],
    [/^Ativa Esta Habilidade quando um Feitiço de Habilidades Suportadas terminar$/i, () => {}],
    [new RegExp(`^Causa ${N} a ${N} de Dano de Caos$`, 'i'), (m, e) => { e.doomMin = num(m[1]); e.doomMax = num(m[2]); }],
    [new RegExp(`^Recarga: ${N} seg(?:\\s*\\((\\d+) Times\\))?`, 'i'), (m, e) => { e.doomRecargaMs = Math.round(num(m[1]) * 1000); e.doomUsos = m[2] ? Number(m[2]) : 1; }],
    [new RegExp(`^Chance de Crítico: ${N}%$`, 'i'), (m, e) => { e.doomCrit = num(m[1]); }],
    [new RegExp(`^Eficácia do Dano Adicionado: ${N}%$`, 'i'), (m, e) => { e.doomEficacia = num(m[1]) / 100; }],
    [new RegExp(`^Área de Efeito aumentada em ${N}%$`, 'i'), (m, e) => { e.doomAreaIncPct = (e.doomAreaIncPct ?? 0) + num(m[1]); }],
    [/^Tempo de Conjuração:/i, () => {}],
  ],
  // (lote D3, dono 27/10) o PREDADOR: a "Sinalizar Presa" dele (o PoB, `SignalPrey`: recarga 0,8 s, instantânea, a Presa dura 8 s) — sozinha (`SuportesS2B.tiqueDaPresa`);
  // o SAPO ENFEITIÇADO: o Sapo Explosivo que o Solo Maldito ativa (o PoB, `TriggeredSupportHextoad`: o Caos da magia, 2,3 m, 5% de crítico, a eficácia, o Definhando de
  // 2 s no acerto) — `Acoes.tiqueDosFeiticosS2B`. As linhas eram lidas como da suportada (nenhuma tinha efeito nela).
  Predator_Support: [
    [new RegExp(`^Duração base é de ${N} segundos?$`, 'i'), (m, e) => { e.presaMs = Math.round(num(m[1]) * 1000); }],
    [new RegExp(`^Recarga: ${N} seg`, 'i'), (m, e) => { e.presaRecargaMs = Math.round(num(m[1]) * 1000); }],
    [/^Tempo de Conjuração:/i, () => {}],
  ],
  Hextoad_Support: [
    [new RegExp(`^Chão amaldiçoado de habilidades reforçadas ativam Sapo Explosivo a cada ${N} segundos?$`, 'i'), (m, e) => { e.sapoIntervaloMs = Math.round(num(m[1]) * 1000); }],
    [new RegExp(`^Causa ${N} a ${N} de Dano de Caos$`, 'i'), (m, e) => { e.sapoMin = num(m[1]); e.sapoMax = num(m[2]); }],
    [new RegExp(`^O raio Base é de ${N} metros?$`, 'i'), (m, e) => { e.sapoRaioM = num(m[1]); }],
    [new RegExp(`^Inflige Definhando por ${N} segundos? ao Acertar$`, 'i'), (m, e) => { e.sapoDefinharMs = Math.round(num(m[1]) * 1000); }],
    [new RegExp(`^Chance de Crítico: ${N}%$`, 'i'), (m, e) => { e.sapoCrit = num(m[1]); }],
    [new RegExp(`^Eficácia do Dano Adicionado: ${N}%$`, 'i'), (m, e) => { e.sapoEficacia = num(m[1]) / 100; }],
    [/^Tempo de Conjuração:/i, () => {}],
  ],
  Divine_Sentinel_Support: [
    [new RegExp(`^Lacaios de habilidades reforçadas têm a área de efeito aumentada em ${N}%$`, 'i'), (m, e) => { e.areaLacaioPct = (e.areaLacaioPct ?? 0) + num(m[1]); }],
    [/^Sentinelas invocadas de habilidades reforçadas têm uma aura templária$/i, (m, e) => { e.auraTemplaria = 1; }],
  ],
};
/**
 * (lote S2B, 27/10) As linhas que as regras gerais leriam como da SUPORTADA e são de quem o jogo ainda não tem (ficam não feitas, sem efeito): o "mais Dano … às suas
 * Presas" do Predador (a Presa); o "Poder Arcano" do Fluxo Cinético das Instabilidades Cinéticas (a habilidade ativada); o "Ricocheteiam" dos Relâmpagos Vivos (os
 * lacaios do suporte); o "menos Dano quando usadas por Espíritos Sagrados" (só no uso dos Espíritos — antes, a suportada saía sempre com 51% menos).
 */
// (lote D3, dono 27/10: a Presa existe — o "mais Dano … às suas Presas" do Predador saiu daqui, `SuportesS2B.noGolpeDoLacaio`)
const NAO_FEITAS_S2B = [];
const NAO_FEITAS_S2B_DO = {
  Kinetic_Instability_Support: [/de Poder Arcano$/i], Greater_Kinetic_Instability_Support: [/de Poder Arcano$/i],
  // (lote R3B, 27/10: o "Ricocheteiam +3" dos Relâmpagos Vivos e o "menos Dano quando usadas por Espíritos Sagrados" saíram daqui — os lacaios e os Espíritos existem,
  // `PROPRIAS_R3B`)
};
/** O efeito do suporte no nível, para esta ativa: `{ efeito, naoFeitas }`. */
export function efeitoNoNivel(slug, nivel = 1, qualidade = 0, ativa = null) {
  const s = POR_SLUG.get(slug);
  if (!s) return { efeito: {}, naoFeitas: [] };
  const t = textosDoNivel(s, nivel, qualidade);
  const efeito = {};
  const naoFeitas = [];
  // (lote A2) as linhas próprias da Torre Óssea e da Sentinela Divina (`PROPRIAS_A2`): a habilidade concedida pela Torre Óssea — Tomar a Carne — tem
  // os números dela (a duração, os raios, as torres), que as regras gerais leriam como do Clamor suportado
  // (lote R3B: + as do Arqueiro Ilusório, dos Espíritos Sagrados, do Relâmpago Vivo e do Nascido da Colmeia — `PROPRIAS_R3B`; o 3º argumento diz se a linha é da qualidade)
  const proprias = PROPRIAS_A2[slug] ?? PROPRIAS_R3B[slug];
  for (const linha of [...t.props, ...t.mods, ...t.qualidade]) {
    if (proprias) {
      const p = proprias.find(([re]) => re.test(linha));
      if (p) { p[1](linha.match(p[0]), efeito, t.qualidade.includes(linha)); continue; }
    }
    // (lote S2B) as linhas que as regras gerais leriam sem a condição e que o jogo ainda não faz (o "mais Dano … às suas Presas" do Predador: a Presa não existe)
    if (NAO_FEITAS_S2B.some((re) => re.test(linha)) || NAO_FEITAS_S2B_DO[slug]?.some((re) => re.test(linha))) { naoFeitas.push(linha); continue; }
    const regra = REGRAS.find(([re]) => re.test(linha));
    if (!regra) {
      // (17/10, lote G3) sem regra própria: a linha como modificador LOCAL do uso suportado ("Habilidades Suportadas têm 30% de chance de Mutilar
      // ao Acertar" → `chance_mutilar`), pelas linhas locais das gemas (`linhas-das-gemas.atributosDaLinha`) — entra no uso como as linhas da
      // gema (`af:<atributo>`, `Acoes.comAsLinhasDaGema`).
      const af = atributosDaLinha(linhaSemSuportadas(linha));
      if (!af) { naoFeitas.push(linha); continue; }
      for (const [k, v] of Object.entries(af)) efeito[`af:${k}`] = (efeito[`af:${k}`] ?? 0) + v;
      continue;
    }
    const r = regra[1](linha.match(regra[0]), linha, ativa);
    for (const [k, v] of Object.entries(r ?? {})) efeito[k] = O_MAIOR.has(k) ? Math.max(efeito[k] ?? 0, v) : MAIS_MULTIPLICA.has(k) && efeito[k] != null ? ((1 + efeito[k] / 100) * (1 + v / 100) - 1) * 100 : (efeito[k] ?? 0) + v;
  }
  // (lote 44, P064) o nível do Suporte: Convocar Fantasma — o Poder Fantasmal de cada Fantasma é o desse nível (a tabela do PoB)
  if (efeito.fantasmaAoMatarPct > 0 || efeito.fantasmaRaroPct > 0) efeito.fantasmaNivel = nivel;
  // (lote R3B) o nível dos lacaios do Relâmpago Vivo e do Nascido da Colmeia e os totais com a qualidade (`GemasR3B.completarEfeito`)
  if (PROPRIAS_R3B[slug]) completarEfeitoR3B(slug, efeito, nivel, Number(linhaDoNivel(s, nivel)[s.colunas.indexOf('RequerNível')]) || s.nivelReq || 1);
  // (lote S1) a recuperação da recarga "aumentada/reduzida" das linhas soma ANTES de virar o % do tempo (a Segunda Ventania: −X% do nível e +Y% da qualidade)
  if (efeito.recuperacaoRecargaPct != null) {
    if (efeito.recuperacaoRecargaPct) efeito.recargaPct = (efeito.recargaPct ?? 0) + tempoDaVelocidade(efeito.recuperacaoRecargaPct);
    delete efeito.recuperacaoRecargaPct;
  }
  // (18/10, lote G20b) o DEVASTADOR: "um totem ancestral que usa a habilidade por você ENQUANTO VOCÊ ESTIVER PERTO dele" (a descrição; sem linha) — a
  // distância de ativação é a do PoB, `ancestor_totem_parent_activiation_range` 70 = 7 m (other.lua:1499)
  if (slug === 'Earthbreaker_Support' && efeito.viraTotem) efeito.ativacaoM = 7;
  return { efeito, naoFeitas };
}

// ---------------------------------------------------------------- compatibilidade

/** As tags que RESTRINGEM o suporte (a ativa precisa ter todas): as outras (Fogo, Crítico, Suporte...) não restringem. */
const RESTRINGEM = new Set(['Magia', 'Ataque', 'Projétil', 'Área', 'Corpo a Corpo', 'Arco', 'Duração', 'Canalização', 'Corrente', 'Movimento', 'Aura', 'Clamor', 'Golpe', 'Totem', 'Armadilha', 'Mina', 'Lacaio', 'Marca', 'Guarda', 'Arauto']);
// O suporte de GATILHO (tag Ativação) restringe só o que ele ATIVA (a magia); o ataque que dispara é qualquer um do grupo.
// "Ricochete + Projétil" (o suporte de Corrente) vale para quem é projétil OU ricocheteia (o Arco não é projétil): vai para `algum`.
export const requerDe = (s) => (s.tags.includes('Ativação') ? ['poe:Magia'] : s.tags.filter((t) => RESTRINGEM.has(t) && !(t === 'Projétil' && s.tags.includes('Ricochete'))).map((t) => `poe:${t}`));
export const algumDe = (s) => (s.tags.includes('Ricochete') && !s.tags.includes('Ativação') ? ['poe:Projétil', 'poe:Ricochete'] : []);

// ---------------------------------------------------------------- status, ids, registro

const MOMENTUM_CANALIZANDO = /Ganhe \S+ de Momentum a cada \S+ segundos enquanto Canalizando uma Habilidade suportada/gi;
function avaliar(s) {
  // Pelo que o suporte É (as tags) e pelo gatilho dos mods — a descrição fala do que ele NÃO suporta ("não pode suportar totens").
  // (O Momentum cita a canalização só como OUTRO jeito de ganhar Momentum — "a cada N segundos enquanto Canalizando" —, que o jogo não tem;
  // o ganho a cada uso, sim: essa frase não trava o suporte.)
  const tudo = [s.tags.join(' '), ...s.mods, ...(s.implicitos ?? [])].join(' ').replace(MOMENTUM_CANALIZANDO, '');
  const sem = SEM_SISTEMA.find(([re]) => re.test(tudo));
  if (sem) return { status: 'nao', motivos: [sem[1]] };
  // (lote A2: no nível máximo dele — o 3 das Excepcionais, antes o 15 das linhas da tabela)
  const nivel = Math.min(20, nivelMaximoDe(s));
  const { efeito, naoFeitas } = efeitoNoNivel(s.slug, nivel, 20, { tags: [...['Magia', 'Ataque', 'Projétil', 'Área', 'Corpo a Corpo', 'Fogo', 'Gelo', 'Raio', 'Caos', 'Físico', 'Duração', 'Aura', 'Golpe'].map((x) => `poe:${x}`)] });
  const fez = Object.keys(efeito).length || gatilhoDe(s, textosDoNivel(s, nivel));
  if (!fez) return { status: 'nao', motivos: ['nenhuma linha do suporte tem efeito no jogo ainda', ...naoFeitas.slice(0, 3).map((l) => `não simulado: ${l}`)] };
  // (lote G20b) o que a DESCRIÇÃO do suporte diz e não tem linha nem número nos dados
  const daDescricao = DESCRICAO_NAO_FEITA[s.slug] ?? [];
  const motivos = [...naoFeitas.map((l) => `não simulado: ${l}`), ...daDescricao];
  return motivos.length ? { status: 'parcial', motivos } : { status: 'funciona', motivos: [] };
}
/** (lote G20b) O que a descrição do suporte diz e o jogo ainda não faz — sem linha (o status não a vê) nem número nos dados do PoB. */
const DESCRICAO_NAO_FEITA = {
  // (lote A2) a Torre Óssea: a explosão é o físico MÉDIO da sua arma × o "Dano de Ataque: X% de base" da Tomar a Carne, pelo acerto das habilidades sem
  // golpe — os modificadores do golpe da arma (o crítico dela, os locais) não entram
  Bonespire_Support: ['não simulado: a explosão das torres usa o físico médio da arma × 250–271% pelo acerto sem golpe (sem o crítico e os modificadores locais da arma); as torres não bloqueiam o caminho dos monstros'],
  // (lote A4, dono 19/10) as Excepcionais do Vazio: o acerto da onda e da tempestade é o das habilidades sem golpe (como a Torre Óssea)
  Shockwave_Support: ['não simulado: a onda usa o físico médio da arma × o "Dano de Ataque: X% de base" dela pelo acerto sem golpe (sem o crítico e os modificadores locais da arma)'],
  Void_Shockwave_Support: ['não simulado: a onda usa o físico médio da arma × o "Dano de Ataque: X% de base" dela pelo acerto sem golpe (sem o crítico e os modificadores locais da arma)'],
  Voidstorm_Support: ['não simulado: a explosão da tempestade usa o físico médio da arma × o "Dano de Ataque: X% de base" dela pelo acerto sem golpe (sem o crítico e os modificadores locais da arma); a Cegueira dentro dela (a descrição) não é aplicada'],
  // (lote D2, dono 27/10) a Tentação Vaal: o dano de 1300/s em você é feito (`SuportesS2A.tentacaoVaalNoUso`); o "em vez de aplicar impedimento de ganho de almas" fica — o jogo
  // não tem o Impedimento de Ganho de Almas (as almas das Vaal são a recarga), então não há o que a Tentação substitua nem ganho de almas para bloquear enquanto ela dura
  Vaal_Temptation_Support: ['não simulado: o impedimento de ganho de almas que a Tentação substitui (o jogo não tem o Impedimento de Ganho de Almas: as almas das gemas Vaal são a recarga)'],
  Earthbreaker_Support: ['não simulado: perto do totem, você ganha Área de Efeito aumentada para Habilidades Corpo a Corpo (a descrição; o valor — ancestor_totem_grants_owner_area_of_effect_+%_with_melee_skills — não está nos dados do PoB)'],
};

function idsDosSuportes(slugs) {
  const atual = existsSync(ARQ_IDS) ? JSON.parse(readFileSync(ARQ_IDS, 'utf8')) : { _nota: 'Ids estáveis dos itens das gemas de SUPORTE do PoE (itens-poe/suportes-poe.mjs). Só cresce: um suporte novo ganha o próximo id; nunca reaproveitar.', ids: {} };
  let proximo = Math.max(PRIMEIRO_ID - 1, ...Object.values(atual.ids)) + 1;
  let mudou = false;
  for (const s of slugs) if (atual.ids[s] == null) { atual.ids[s] = proximo++; mudou = true; }
  if (mudou) writeFileSync(ARQ_IDS, `${JSON.stringify(atual, null, 1)}\n`);
  return atual.ids;
}

let INICIADO = null;
/**
 * Liga os suportes do PoE (uma vez): lê `suportes.json`, registra o item e o suporte de cada um (`registrarSuporte` de `skills/gemas.mjs`,
 * passado por quem chama). Devolve `{ suportes, porStatus }`.
 */
/*
 * Os suportes SEM a lista do PoE (a coleção do Drive não traz quais gemas eles suportam — `compat-suportes.mjs`) seguem as tags; o
 * Pacifism "reforça qualquer habilidade que ataque inimigos": as que não atacam (aura, arauto, guarda, postura, clamor, vínculo) ficam de
 * fora. (O Inspiration "suporta qualquer habilidade" — sem exclusão.)
 */
const EXCLUI = { Pacifism_Support: ['poe:Aura', 'poe:Arauto', 'poe:Guarda', 'poe:Postura', 'poe:Clamor', 'poe:Vínculo'] };
export function iniciar({ registrarSuporte } = {}) {
  if (INICIADO) return INICIADO;
  if (!ligado() || !existsSync(ARQ_SUPORTES)) return (INICIADO = { suportes: 0, porStatus: {} });
  // Os "Despertados"/"Excepcionais" (só de endgame) ficam de fora junto: o jogo usa os comuns.
  // (09/10) A tabela por nível de cada suporte pela do poedb (`gemas-niveis.mjs`).
  SUPORTES = comNiveisDoPoedb(JSON.parse(readFileSync(ARQ_SUPORTES, 'utf8'))).filter((s) => s.linhas?.length);
  for (const s of SUPORTES) POR_SLUG.set(s.slug, s);
  const ids = idsDosSuportes(SUPORTES.map((s) => s.slug));
  const porStatus = {};
  for (const s of SUPORTES) {
    const { status, motivos } = avaliar(s);
    const itemId = ids[s.slug];
    REGISTRO.set(s.slug, { itemId, status, motivos, suporte: s });
    porStatus[status] = (porStatus[status] ?? 0) + 1;
    registrarSuporte?.({
      itemId, suporte: s, requer: requerDe(s), algum: algumDe(s), exclui: EXCLUI[s.slug] ?? [], levelMinimo: s.nivelReq ?? 1,
      // Sem sistema no jogo (totem, armadilha, lacaio...): não mexe em nada.
      efeitoDoPoe: status === 'nao' ? () => ({}) : (nivel, qualidade, ativa) => efeitoNoNivel(s.slug, nivel, qualidade, ativa).efeito,
      gatilho: status === 'nao' ? null : gatilhoDe(s, textosDoNivel(s, 1)) ? (nivel) => gatilhoDe(s, textosDoNivel(s, nivel)) : null,
    });
  }
  INICIADO = { suportes: REGISTRO.size, porStatus };
  return INICIADO;
}

export const doSlug = (slug) => REGISTRO.get(slug) ?? null;
export const statusNoJogo = () => Object.fromEntries([...REGISTRO].map(([slug, r]) => [slug, { status: r.status, motivos: r.motivos }]));

/** A FICHA do suporte no nível (o balão do item): o mesmo formato da ficha da ativa (`GemasPoe.fichaNoNivel`). */
export function fichaNoNivel(slug, nivel = 1, qualidade = 0) {
  const r = REGISTRO.get(slug);
  if (!r) return null;
  const s = r.suporte;
  const n = Math.max(1, Math.min(nivel | 0 || 1, s.linhas.length || 1));
  const t = textosDoNivel(s, n, qualidade);
  const req = Number(linhaDoNivel(s, n)[s.colunas.indexOf('RequerNível')]) || s.nivelReq || 1;
  const props = t.props.map((p) => (/^Nível:/.test(p) ? ['Nível', String(n)] : p.includes(': ') ? [p.slice(0, p.indexOf(': ')), p.slice(p.indexOf(': ') + 2).replace(/\((\d+) Times\)/, '($1 usos)')] : [p, '']));
  const { naoFeitas } = efeitoNoNivel(slug, n, qualidade, { tags: ['Magia', 'Ataque', 'Projétil', 'Área', 'Corpo a Corpo', 'Fogo', 'Gelo', 'Raio', 'Caos', 'Físico'].map((x) => `poe:${x}`) });
  return {
    nome: s.nome, en: s.en, cor: s.cor, tags: s.tags, nivel: n, nivelReq: req, props, desc: s.desc, mods: t.mods, qualidade: Math.max(0, Math.min(20, qualidade || 0)), modsDaQualidade: t.qualidade,
    status: r.status, motivos: r.motivos, naoFeitas, suporte: true, gatilho: gatilhoDe(s, t),
  };
}
