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

/** As linhas do suporte no nível (e as da qualidade): os números DESTE nível. */
export function textosDoNivel(s, nivel = 1, qualidade = 0) {
  const n = Math.max(1, Math.min(nivel | 0 || 1, s.linhas.length || 1));
  const linha = linhaDoNivel(s, n);
  const porMolde = new Map();
  s.colunas.forEach((c, i) => { if (!PADRAO.has(c)) porMolde.set(molde(c), { cab: c, valor: linha[i], doNivel1: s.linhas[0]?.[i] }); });
  const out = [];
  const add = (t) => t && !out.includes(t) && out.push(t);
  for (const m of [...s.mods, ...(s.implicitos ?? []).filter((t) => !/^Mana:/.test(t))]) {
    const col = porMolde.get(molde(m));
    if (col) col.valor !== undefined && col.valor !== '' && add(substituir(col.cab, col.valor, col.doNivel1));
    else add(m.includes('—') ? interpolar(m, (n - 1) / 19) : m);
  }
  const q = Math.max(0, Math.min(20, qualidade || 0)) / 20;
  return { mods: out, qualidade: (s.qualidade ?? []).map((t) => interpolar(t, q)), props: s.props.map((p) => interpolar(p, (n - 1) / 19)) };
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
  for (const [tag] of Object.entries(ELEMENTO_DA_TAG)) if (new RegExp(`Dano (de )?${tag}`, 'i').test(texto) && !/Dano .* como Dano Extra/i.test(texto)) return temTag(ativa, tag);
  return true;
}
/** Velocidade X% mais/aumentada → o % do TEMPO de uso (o motor: `castTimePct`). */
const tempoDaVelocidade = (pct) => (1 / (1 + pct / 100) - 1) * 100;

/**
 * As REGRAS: `[regex, (m, texto, ativa) → { chave: valor } | null]`. `null` = a linha fala de outra coisa (não vale para esta ativa) e
 * conta como feita. Linha sem regra nenhuma vai para `naoFeitas`.
 */
const ELEMENTO_DO_TEXTO = { fogo: 'fire', gelo: 'ice', raio: 'energy', 'físico': 'physical', fisico: 'physical', caos: 'chaos' };
const REGRAS = [
  // O custo (a propriedade "Multiplicador de Custo & Reserva: 120%").
  [new RegExp(`^Multiplicador de Custo & Reserva: ${N}%`), (m) => ({ custoPct: num(m[1]) - 100 })],
  [/não Custam nada/i, () => ({ custoPct: -100 })],
  [/custam Vida ao invés de Mana|Reservam Vida ao invés de Mana/i, () => ({ custoEmVida: 1 })],
  // A BLASFÊMIA (`itens-poe/reserva.mjs`): a maldição suportada vira AURA — liga e reserva a "Sobreposição de Reserva", com menos efeito.
  [new RegExp(`^(?:Sobreposição de )?Reserva: ${N}% Mana`), (m) => ({ reservaSobreposta: num(m[1]) })],
  [/aplicam suas Maldições como Auras/i, () => ({ maldicaoEmAura: 1 })],
  [new RegExp(`^${N}% menos Efeito de Maldições Suportadas`, 'i'), (m) => ({ efeitoMaldicaoPct: -num(m[1]) })],
  // LACAIOS e TOTENS (`itens-poe/lacaios-poe.mjs`): dano e vida dos lacaios, totens a mais.
  [new RegExp(`Lacaios? (?:d[ae]s? Habilidades Suportadas )?causam? ${N}% (mais|menos) Dano`, 'i'), (m) => ({ lacaioDanoPct: (m[2] === 'mais' ? 1 : -1) * num(m[1]) })],
  [new RegExp(`Lacaios? (?:d[ae]s? Habilidades Suportadas )?(?:causam? )?Dano aumentado em ${N}%`, 'i'), (m) => ({ lacaioDanoPct: num(m[1]) })],
  [new RegExp(`Lacaios? (?:d[ae]s? Habilidades Suportadas )?têm ${N}% (mais|menos) Vida`, 'i'), (m) => ({ lacaioVidaPct: (m[2] === 'mais' ? 1 : -1) * num(m[1]) })],
  [new RegExp(`Lacaios? (?:d[ae]s? Habilidades Suportadas )?têm Vida Máxima aumentada em ${N}%`, 'i'), (m) => ({ lacaioVidaPct: num(m[1]) })],
  [new RegExp(`têm ${N}% (mais|menos) Vida de Lacaio`, 'i'), (m) => ({ lacaioVidaPct: (m[2] === 'mais' ? 1 : -1) * num(m[1]) })],
  [new RegExp(`têm ${N}% de Vida máxima de Lacaios aumentada`, 'i'), (m) => ({ lacaioVidaPct: num(m[1]) })],
  [new RegExp(`\\+${N} (?:ao|de) número máximo de Totens`, 'i'), (m) => ({ totensExtras: num(m[1]) })],
  // Dano: "mais/menos" multiplica (como no PoE); "aumentado/reduzido" soma.
  [new RegExp(`causa[m]? (?:até )?${N}% (mais|menos) Dano(?! com Sangramento| com Incêndio| de Afecções| Propagado| enquanto Morto| com Acertos e Afecções contra)`, 'i'), (m, t, a) => (valeParaOTipo(t, a) ? { maisDanoPct: (m[2] === 'mais' ? 1 : -1) * num(m[1]) } : null)],
  [new RegExp(`causam? ([+-])${N}% de dano`, 'i'), (m, t, a) => (valeParaOTipo(t, a) ? { maisDanoPct: (m[1] === '-' ? -1 : 1) * num(m[2]) } : null)],
  [new RegExp(`Magias Suportadas têm ${N}% mais Dano Mágico`, 'i'), (m, t, a) => (temTag(a, 'Magia') ? { maisDanoPct: num(m[1]) } : null)],
  [new RegExp(`causam? ${N}% de Dano (?:de )?(\\S+)? ?aumentado`, 'i'), (m, t, a) => (valeParaOTipo(t, a) ? { danoPct: num(m[1]) } : null)],
  [new RegExp(`causam Dano aumentado em ${N}%`, 'i'), (m) => ({ danoPct: num(m[1]) })],
  [new RegExp(`Dano [^%]*?aumentado em ${N}%`, 'i'), (m, t, a) => (valeParaOTipo(t, a) ? { danoPct: num(m[1]) } : null)],
  [new RegExp(`${N}% de Dano [^%]*?aumentado`, 'i'), (m, t, a) => (valeParaOTipo(t, a) ? { danoPct: num(m[1]) } : null)],
  [new RegExp(`causam ${N}% mais Dano com Acertos`, 'i'), (m) => ({ maisDanoPct: num(m[1]) })],
  [new RegExp(`causam ${N}% menos Dano com Acertos`, 'i'), (m) => ({ maisDanoPct: -num(m[1]) })],
  [new RegExp(`ganham ${N}% de Dano (\\S+) como Dano Extra de`, 'i'), (m, t, a) => (temTag(a, m[2]) ? { danoPct: num(m[1]) } : null)],
  [/não causam Dano Elemental/i, (m, t, a) => (['Fogo', 'Gelo', 'Raio'].some((x) => temTag(a, x)) ? { maisDanoPct: -100 } : null)],
  [/não causam Dano de Caos/i, (m, t, a) => (temTag(a, 'Caos') ? { maisDanoPct: -100 } : null)],
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
  // Área (o motor anda em casas: ±1 casa a cada ~25%).
  [new RegExp(`têm ${N}% (mais|menos) Efeito em Área`, 'i'), (m) => ({ areaExtra: (m[2] === 'mais' ? 1 : -1) * Math.max(1, Math.round(num(m[1]) / 25)) })],
  [new RegExp(`(?:Área de Efeito|Efeito em Área) aumentad[oa] em ${N}%`, 'i'), (m, t) => (/Maldição|Clamor|Lacaio/i.test(t) ? null : { areaExtra: Math.max(1, Math.round(num(m[1]) / 25)) })],
  // Crítico.
  [new RegExp(`têm \\+${N}% (?:de|ao) Multiplicador de (?:Dano de )?Acertos? Críticos?`, 'i'), (m) => ({ critDano: num(m[1]) })],
  [new RegExp(`Chance de Acerto Crítico(?: \\S+)* aumentad[oa] em ${N}%`, 'i'), (m) => ({ critChance: num(m[1]) / 20 })],
  [new RegExp(`têm \\+${N}% de Chance de (?:Acerto )?Crítico`, 'i'), (m) => ({ critChance: num(m[1]) })],
  [new RegExp(`têm ${N}% da Chance de Crítico aumentada`, 'i'), (m) => ({ critChance: num(m[1]) / 20 })],
  [new RegExp(`têm ${N}% menos Chance de (?:Golpe|Acerto) Crítico`, 'i'), (m) => ({ critChance: -num(m[1]) / 20 })],
  [new RegExp(`têm \\+${N}% de Multiplicador de Crítico`, 'i'), (m) => ({ critDano: num(m[1]) })],
  [new RegExp(`Penetram ${N}% de Resistência (?:a |ao )?(\\S+)`, 'i'), (m, t, a) => (temTag(a, m[2]) ? { penetracaoPct: num(m[1]) } : null)],
  [/Utilizar Habilidades Suportadas é Instantâneo/i, () => ({ castTimePct: -100 })],
  [new RegExp(`Velocidade de Recuperação da Recarga aumentada em ${N}%`, 'i'), (m) => ({ recargaPct: tempoDaVelocidade(num(m[1])) })],
  [new RegExp(`têm ${N}% menos Custo de Mana`, 'i'), (m) => ({ custoPct: -num(m[1]) })],
  [/Projéteis .*se Difundem/i, () => ({ bifurcar: 2 })],
  // Informativas do próprio suporte (o raio e a duração do que ele cria): não mudam a skill suportada.
  [/^O raio Base é de|^Duração base é de|^Raio de alcance secundário/i, () => ({})],
  [new RegExp(`têm ${N}% mais Recuperação da Recarga`, 'i'), (m) => ({ recargaPct: tempoDaVelocidade(num(m[1])) })],
  // Afecções ao acertar.
  [new RegExp(`têm ${N}% de chance de Incendiar`, 'i'), (m) => ({ igniteChance: num(m[1]) })],
  [new RegExp(`têm ${N}% de chance de Envenenar`, 'i'), (m) => ({ venenoChance: num(m[1]) })],
  [new RegExp(`têm ${N}% de chance de causar Sangramento`, 'i'), (m) => ({ sangramentoChance: num(m[1]) })],
  [/^Causa Sangramento$/i, () => ({ sangramentoChance: 100 })],
  [new RegExp(`têm ${N}% de chance de Congelar`, 'i'), (m) => ({ congelarChance: num(m[1]) })],
  [new RegExp(`causam ${N}% mais Dano (?:com )?(?:Incendiário|com Incêndio|com Sangramento|de Afecções)`, 'i'), (m) => ({ ignitePct: num(m[1]), venenoPct: num(m[1]), sangramentoPct: num(m[1]) })],
  // Duração, recarga, drenagem.
  [new RegExp(`têm ${N}% (mais|menos) Duração`, 'i'), (m) => ({ duracaoPct: (m[2] === 'mais' ? 1 : -1) * num(m[1]) })],
  [new RegExp(`Duração (?:de Habilidade )?aumentada em ${N}%`, 'i'), (m) => ({ duracaoPct: num(m[1]) })],
  [new RegExp(`Velocidade de Recarga aumentada em ${N}%`, 'i'), (m) => ({ recargaPct: tempoDaVelocidade(num(m[1])) })],
  [new RegExp(`${N}% do Dano .*Drenado como Vida`, 'i'), (m) => ({ leechVidaPct: num(m[1]) })],
  [new RegExp(`${N}% do Dano .*Drenado como Mana`, 'i'), (m) => ({ leechManaPct: num(m[1]) })],
  // Nível das gemas suportadas (Fortalecer...).
  [new RegExp(`^\\+?${N} ao N[iíï]vel (?:de|das) Gemas de (?:Habilidade )?(\\S+)? ?(?:de )?(?:Habilidades? )?(\\S+)? ?Suportadas`, 'i'), (m, t, a) => {
    const so = /Físicas/i.test(t) ? 'Físico' : /de Fogo/i.test(t) ? 'Fogo' : /Aura/i.test(t) ? 'Aura' : /Golpes/i.test(t) ? 'Golpe' : null;
    return !so || temTag(a, so) ? { nivelExtra: Math.floor(num(m[1])) } : null;
  }],
  // Repetições (Eco de Magia, Golpe Múltiplo): a skill sai de novo na hora.
  [new RegExp(`Repetem ${N} vez(?:es)? adiciona`, 'i'), (m) => ({ repeticoes: num(m[1]) })],
  [/Repetição (?:de|das) Habilidades Suportadas causa/i, () => ({})],
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
  const recargaMs = recarga ? Math.round(parseFloat(recarga[1]) * 1000) : 250;
  if (/Ativarão uma Magia Suportada ao causar um Crítico/i.test(tudo)) return { quando: 'critico', recargaMs };
  if (/Ativarão uma Magia Suportada ao Matar/i.test(tudo)) return { quando: 'abate', recargaMs };
  const dano = tudo.match(/Ativa Magias Suportadas quando você sofrer (\d+(?:\.\d+)?) de Dano total/i);
  if (dano) return { quando: 'danoRecebido', recargaMs, limiar: parseFloat(dano[1]) };
  return null;
}

/** O que o jogo não tem (o suporte inteiro não age): totens, armadilhas, minas, lacaios, marcas, clamores, estandartes. */
const SEM_SISTEMA = [
  [/Armadilha|Minas?\b/i, 'armadilhas e minas ainda não existem no jogo'],
  [/Sentinela|torres de osso/i, 'esses lacaios especiais ainda não existem no jogo'],
  [/ao Morrer|quando (?:você (?:for|é) )?Atordoad|enquanto (?:você )?Canaliz|Canalização/i, 'esse gatilho ainda não existe no jogo (só o crítico, o abate corpo a corpo e o dano recebido)'],
];

/** O efeito do suporte no nível, para esta ativa: `{ efeito, naoFeitas }`. */
export function efeitoNoNivel(slug, nivel = 1, qualidade = 0, ativa = null) {
  const s = POR_SLUG.get(slug);
  if (!s) return { efeito: {}, naoFeitas: [] };
  const t = textosDoNivel(s, nivel, qualidade);
  const efeito = {};
  const naoFeitas = [];
  for (const linha of [...t.props, ...t.mods, ...t.qualidade]) {
    const regra = REGRAS.find(([re]) => re.test(linha));
    if (!regra) { naoFeitas.push(linha); continue; }
    const r = regra[1](linha.match(regra[0]), linha, ativa);
    for (const [k, v] of Object.entries(r ?? {})) efeito[k] = (efeito[k] ?? 0) + v;
  }
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
  const nivel = Math.min(20, s.linhas.length || 1);
  const { efeito, naoFeitas } = efeitoNoNivel(s.slug, nivel, 20, { tags: [...['Magia', 'Ataque', 'Projétil', 'Área', 'Corpo a Corpo', 'Fogo', 'Gelo', 'Raio', 'Caos', 'Físico', 'Duração', 'Aura', 'Golpe'].map((x) => `poe:${x}`)] });
  const fez = Object.keys(efeito).length || gatilhoDe(s, textosDoNivel(s, nivel));
  if (!fez) return { status: 'nao', motivos: ['nenhuma linha do suporte tem efeito no jogo ainda', ...naoFeitas.slice(0, 3).map((l) => `não simulado: ${l}`)] };
  return naoFeitas.length ? { status: 'parcial', motivos: naoFeitas.map((l) => `não simulado: ${l}`) } : { status: 'funciona', motivos: [] };
}

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
