// A TRADUÇÃO dos mods do PoE para os atributos do Draevor (Fase 1, incremento 2 — desligado em produção).
//
// Puro: recebe o texto do mod já com o modelo e os valores (o que o gerador produz) e a tabela `gamedata/itens-poe/traducao.json`, e
// devolve os efeitos nas chaves que a ficha do jogo já soma (`Afixos.somaDeItens`: `life`, `fire_res`, `phys_add`…) ou nos ATRIBUTOS
// NOVOS do PoE (`gamedata/itens-poe/atributos-novos.json`). Nada é aplicado aqui: quem equipa é o incremento 3c. Decisão do dono (04/10):
// "todas do PoE, sem excluir nada" — todo texto vira atributo. Cada mod sai com um ESTADO:
//   'equivalente' / 'aproximado' — atributo que o Draevor já calcula (tem efeito no combate);
//   'novo'       — atributo novo do PoE que JÁ tem efeito no combate (`combate: true` em atributos-novos.json; incremento 3b);
//   'registrado' — atributo novo ainda sem efeito, ou texto sem regra (atributo automático `poe.<texto>`);
//   'inerte'     — mecânica do PoE que não tem como existir no jogo (pesca, Fendas, Óleos…): o balão explica (a `nota` da regra).
// Atributo CONDICIONAL (`dmg_inc@corpo`, `atk_speed@comEscudo` — `mods-poe.mjs`): vale o estado do atributo-base, se as condições existem.
import { readFileSync } from 'node:fs';
import { FICHAS } from '../afixos.mjs';
import { partir, ehCondDeEstado, TAGS_DE_GOLPE, CONDICOES_DE_ANEL, dinamicoValido, escalaValida, slugDoNome, gemaConhecida } from './condicoes-poe.mjs';

export const TABELA = JSON.parse(readFileSync(new URL('../../gamedata/itens-poe/traducao.json', import.meta.url), 'utf8'));
export const NOVOS = JSON.parse(readFileSync(new URL('../../gamedata/itens-poe/atributos-novos.json', import.meta.url), 'utf8')).atributos;

/** O id automático de um texto sem regra: `poe.` + o texto sem acento, com `n` no lugar dos números. */
export const idAutomatico = (parte) =>
  `poe.${String(parte).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\{\d+\}/g, 'n').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)}`;

/** As regras prontas para casar: `{E}` vira o grupo dos nomes de elemento do PoE. */
export function compilar(tabela = TABELA) {
  const nomes = Object.keys(tabela.elementos ?? {}).filter((k) => !k.startsWith('_'));
  const grupoE = `(${nomes.join('|')})`;
  const base = (tabela.regras ?? []).map((r, i) => ({ ...r, i, re: new RegExp(r.padrao.replace('{E}', grupoE).replace(/^\^\\\+/, '^([+-])?')) }));
  // As versões "REDUZIDA" das regras "aumentada" (o PoE escreve "Velocidade de Ataque reduzida em 10%" com o mesmo número positivo): o
  // mesmo atributo com o valor negativo. Só quando nenhuma regra própria já casa o texto.
  const reduzidas = base
    .filter((r) => /aumentad[oa]s?/.test(r.padrao) && r.estado !== 'inerte')
    .map((r) => ({ ...r, reduzida: true, re: new RegExp(r.padrao.replace('{E}', grupoE).replace(/aumentad([oa]s?)/g, 'reduzid$1')) }));
  return [...base, ...reduzidas];
}
/** O texto de LEMBRETE do PoE (entre parênteses: explica a mecânica, não é um mod) — vira nota, sem efeito nem marca. */
const LEMBRETE = /^\(|\)$|^\(.*\)$/;
const PADRAO = compilar();

/**
 * O valor de um efeito. `{n}` = o n-ésimo NÚMERO-ÍNDICE capturado (os grupos `\{(\d+)\}` do padrão — o elemento e os opcionais não
 * contam), que aponta para `valores`. `media({1},{2})` = a média dos dois (a faixa "Adiciona 5 a 9" vira 7).
 */
function valorDo(expr, indices, valores) {
  const v = (n) => Number(valores[indices[Number(n) - 1]]);
  const media = /^media\(\{(\d+)\},\{(\d+)\}\)$/.exec(expr);
  if (media) return (v(media[1]) + v(media[2])) / 2;
  const um = /^(-?)\{(\d+)\}$/.exec(expr);
  return um ? (um[1] ? -1 : 1) * v(um[2]) : Number(expr);
}

/**
 * Os NOMES DE GEMA como os textos dos mods escrevem, quando o nome da gema no jogo é outro (a tradução do PoE não é uniforme: o mod diz
 * "Pureza dos Elementos", a gema chama "Pureza Elementar"). `{NOME}` passa por aqui antes de virar a chave.
 */
export const APELIDOS_DE_GEMA = Object.freeze({
  'Pureza dos Elementos': 'Pureza Elementar', 'Pureza do Fogo': 'Pureza Ardente', 'Pureza do Gelo': 'Pureza Glacial', 'Pureza do Raio': 'Pureza Elétrica',
  'Arauto da Agonia': 'Arauto Agonizante', 'Arauto do Trovão': 'Arauto Trovejante', 'Arauto do Gelo': 'Arauto Glacial', 'Arauto das Cinzas': 'Arauto Flamejante',
  'Oferenda de Carne': 'Oferenda Carnal', 'Oferenda de Espíritos': 'Oferenda Espiritual', 'Oferenda Espírito': 'Oferenda Espiritual',
  'Golens de Chamas': 'Convocar Golem Flamejante', 'Golens de Gelo': 'Convocar Golem Glacial', 'Golens de Raio': 'Convocar Golem Relampejante',
  'Golens de Pedra': 'Convocar Golem Pedregulho', 'Golens de Caos': 'Convocar Golem Caótico', 'Golens da Carniça': 'Convocar Golem da Carniça',
});
const slugDaGema = (nome) => slugDoNome(APELIDOS_DE_GEMA[nome] ?? nome);

/** Traduz UMA parte do modelo (sem " / "). */
export function traduzirParte(parte, valores, opcoes = {}) {
  const { regras = PADRAO, tabela = TABELA } = opcoes;
  if (LEMBRETE.test(String(parte).trim())) return { estado: 'lembrete', efeitos: [], nota: null, regra: null };
  for (const r of regras) {
    const m = r.re.exec(parte);
    if (!m) continue;
    const capturas = m.slice(1).filter((x) => x != null);
    const indices = capturas.filter((x) => /^\d+$/.test(x));
    const elemento = capturas.find((x) => tabela.elementos?.[x] && !/^\d+$/.test(x));
    // `{NOME}`: o nome capturado (a gema de "Concede a Habilidade X", "Suportadas por X", "Ativa X") como chave.
    const nome = capturas.find((x) => !/^\d+$/.test(x) && !tabela.elementos?.[x] && x.length > 2);
    // `{V<n>}`: o n-ésimo número do texto como PARÂMETRO do atributo ("a cada {1} de Destreza" → `%atr:dex:{V2}`).
    const stat = (s) => s.replace('{E}', tabela.elementos?.[elemento] ?? '?').replace('{NOME}', slugDaGema(nome)).replace(/\{V(\d)\}/g, (_, n) => String(Math.abs(valorDo(`{${n}}`, indices, valores)) || 1));
    // "reduzida" (a regra derivada) e o "-" na frente do número ("-10% de Resistência a Fogo"): o valor sai negativo.
    const sinal = (r.reduzida ? -1 : 1) * (m[0].startsWith('-') ? -1 : 1);
    const efeitos = r.efeitos.map((e) => { const v = valorDo(e.valor, indices, valores); return { stat: stat(e.stat), valor: typeof v === 'number' ? v * sinal : v }; });
    if (r.estado === 'inerte') return { estado: 'inerte', efeitos: [], nota: r.nota ?? null, regra: r.i };
    if (r.estado === 'lembrete') return { estado: 'lembrete', efeitos: [], nota: r.nota ?? null, regra: r.i };
    // Atributo que o Draevor não tem (ex.: Resistência a Caos → chaos_res): 'novo' se ele já tem efeito no combate, senão 'registrado'.
    // Sem efeito em algum atributo: 'registrado'. Só atributos do Draevor sem condição: o estado da regra. O resto: o da regra, se ela
    // diz ('equivalente'/'aproximado'), ou 'novo'.
    const soDoDraevor = efeitos.every((e) => FICHAS[e.stat]);
    // A gema nomeada não está na coleção do jogo: o mod não tem como agir (o balão explica).
    if (r.efeitos.some((e) => e.stat.includes('{NOME}')) && gemaConhecida(slugDaGema(nome)) === false) return { estado: 'inerte', efeitos: [], nota: `a habilidade "${nome}" não está na coleção de gemas do jogo`, regra: r.i };
    const estado = !efeitos.every(temEfeito) ? 'registrado' : soDoDraevor ? r.estado ?? 'equivalente' : r._nova && r.estado && r.estado !== 'novo' ? r.estado : 'novo';
    return { estado, efeitos, nota: r.nota ?? null, regra: r.i };
  }
  // A CONDIÇÃO no texto ("<efeito> enquanto/se/caso <condição>", "Enquanto <condição>, <efeito>"): o efeito pelas regras de sempre e a
  // condição que o jogo avalia (`@cond`, `condicoes-poe.mjs`). Só quando o efeito sozinho já tem efeito no combate.
  if (!opcoes?.semCondicao) {
    const c = condicaoDoTexto(parte, valores);
    if (c) {
      const base = traduzirParte(c.efeito, valores, { regras, tabela, semCondicao: true });
      const efeitos = base.efeitos.map((e) => ({ ...e, stat: comCondicao(e.stat, c.cond) }));
      const doGolpe = TAGS_DE_GOLPE.has(c.cond);
      if (['equivalente', 'aproximado', 'novo'].includes(base.estado) && efeitos.every(temEfeito) && (!doGolpe || base.efeitos.every((e) => DO_GOLPE.test(partir(e.stat).stat)))) {
        return { estado: 'novo', efeitos, nota: base.nota ?? null, regra: base.regra, condicao: c.cond };
      }
    }
  }
  // Sem regra: o atributo automático do próprio texto (nada fica de fora). O valor é o número da parte (ou a lista, se forem vários).
  const nums = [...parte.matchAll(/\{(\d+)\}/g)].map((m) => Number(valores[Number(m[1])]));
  return { estado: 'registrado', efeitos: [{ stat: idAutomatico(parte), valor: nums.length === 1 ? nums[0] : nums.length ? nums : 1 }], nota: null, regra: null };
}

/*
 * ---- As CONDIÇÕES escritas no texto do mod (09/10: "eu quero que tenha efeito real, funcione 100%") ----
 * O PoE escreve a condição na frase: "Velocidade de Ataque aumentada em 10% se você Matou Recentemente", "Enquanto um Inimigo Único estiver
 * em sua presença, Dano de Fogo aumentado em 20%" (os implícitos eldritch). Cada frase daqui vira a condição que o jogo já avalia; o efeito
 * é traduzido pelas regras de sempre. As do ALVO ("contra Inimigos Resfriados") só valem nos atributos que o golpe resolve (`DO_GOLPE`).
 */
const CARGA = { 'Tolerância': 'tolerancia', 'Frenesi': 'frenesi', 'Poder': 'poder' };
const ARMA = { Cajado: 'comCajado', Arco: 'comArco', Varinha: 'comVarinha', Adaga: 'comAdaga', Garra: 'comGarra', Espada: 'comEspada', Machado: 'comMachado', 'Maça': 'comMaca', Cetro: 'comCetro' };
const ALVO = { Resfriados: 'alvoResfriado', Congelados: 'alvoCongelado', Eletrizados: 'alvoEletrizado', Cegos: 'alvoCego', 'Amaldiçoados': 'alvoAmaldicoado', Sangrando: 'alvoSangrando', Envenenados: 'alvoEnvenenado', Incendiados: 'alvoIncendiado', Mutilados: 'alvoMutilado', Lentos: 'alvoLento', Provocados: 'alvoProvocado' };
const PREFIXOS_DE_CONDICAO = [
  [/^Enquanto um Inimigo Único estiver em sua presença, (.+)$/, 'unicoNaPresenca'],
  [/^Enquanto o Chefe Final do Atlas estiver em sua presença, (.+)$/, 'chefeFinalNaPresenca'],
];
const SUFIXOS_DE_CONDICAO = [
  [/^(.+?),? (?:enquanto|quando) (?:estiver |você estiver )?em Vida Baixa$/, 'vidaBaixa'],
  [/^(.+?),? enquanto não (?:estiver )?em Vida Baixa$/, 'naoVidaBaixa'],
  [/^(.+?),? (?:enquanto|quando) (?:estiver )?em Vida Cheia$/, 'vidaCheia'],
  [/^(.+?),? enquanto (?:estiver )?em Mana Baixa$/, 'manaBaixa'],
  [/^(.+?),? enquanto não (?:estiver )?em Mana Baixa$/, 'naoManaBaixa'],
  [/^(.+?),? (?:se você|caso (?:você )?tenha) Matado? Recentemente$/i, 'matouRecente'],
  [/^(.+?),? (?:se você não (?:houver )?Matou|caso (?:você )?não tenha Matado|se você não tiver Matado) Recentemente$/i, 'naoMatouRecente'],
  [/^(.+?),? (?:se você causou|caso (?:você )?tenha causado) um (?:Golpe|Acerto) Crítico Recentemente$/i, 'criticoRecente'],
  [/^(.+?),? se você não causou um (?:Golpe|Acerto) Crítico Recentemente$/i, 'naoCriticoRecente'],
  [/^(.+?),? (?:se você foi Acertado|caso (?:você )?tenha sido Acertado|caso tenha sofrido Dano de um Acerto) Recentemente$/i, 'acertadoRecente'],
  [/^(.+?),? se você não foi Acertado Recentemente$/i, 'naoAcertadoRecente'],
  [/^(.+?),? (?:se você Bloqueou|caso (?:você )?tenha Bloqueado)(?: (?:o )?Dano (?:Mágico|de Ataques))? Recentemente$/i, 'bloqueouRecente'],
  [/^(.+?),? se você Atordoou um Inimigo Recentemente$/i, 'atordoouRecente'],
  [/^(.+?),? (?:se você Acertou|caso (?:você )?tenha Acertado)(?: um Inimigo)? Recentemente$/i, 'acertouRecente'],
  [/^(.+?),? se voc[eê6]+ (?:Clamou|usou um Clamor) Recentemente$/i, 'clamouRecente'],
  [/^(.+?),? se você usou uma Habilidade de Movimento Recentemente$/i, 'usouMovimentoRecente'],
  [/^(.+?),? (?:se você Conjurou|caso você tenha Conjurado) Avanço recentemente$/i, 'conjurouAvancoRecente'],
  [/^(.+?),? se você não houver Conjurado Avanço recentemente$/i, 'naoConjurouAvancoRecente'],
  [/^(.+?),? durante (?:qualquer|um) Efeito de Frasco$/, 'duranteFrasco'],
  [/^(.+?),? enquanto (?:se move|se movendo|movendo-se)$/, 'movendo'],
  [/^(.+?),? enquanto parado$/, 'parado'],
  [/^(.+?),? enquanto (?:estiver )?Sangrando$/, 'sangrandoProprio'],
  [/^(.+?),? enquanto (?:estiver )?Envenenado$/, 'envenenadoProprio'],
  [/^(.+?),? enquanto (?:estiver )?Inc[eê]?n?diado$/, 'ardendo'],
  [/^(.+?),? enquanto (?:estiver )?Congelado$/, 'congeladoProprio'],
  [/^(.+?),? enquanto (?:estiver )?Eletrizado$/, 'eletrizadoProprio'],
  [/^(.+?),? enquanto (?:estiver )?Resfriado$/, 'resfriadoProprio'],
  [/^(.+?),? enquanto (?:estiver )?Amaldiçoado$/, 'amaldicoadoProprio'],
  [/^(.+?),? enquanto não (?:estiver )?Incendiado, Congelado ou Eletrizado$/, 'semAfeccaoElemental'],
  [/^(.+?),? enquanto (?:carregando|empunhando|empunhar|segurando) um Escudo$/, 'comEscudo'],
  [/^(.+?),? enquanto (?:em|estiver em) Dupla Empunhadura$/, 'duasArmas'],
  [/^(.+?),? enquanto (?:carregando|empunhando|empunhar) uma Arma de Duas Mãos$/, 'duasMaos'],
  [/^(.+?),? enquanto um Inimigo Raro ou Único estiver Próximo$/, 'raroOuUnicoPerto'],
];
const SUFIXOS_COM_PARAMETRO = [
  [/^(.+?),? enquanto (?:carregando|empunhando|empunhar|segurando) (?:um|uma) (Cajado|Arco|Varinha|Adaga|Garra|Espada|Machado|Maça|Cetro)$/, (m) => ARMA[m[2]]],
  [/^(.+?),? (?:enquanto|quando) (?:você )?(?:estiver )?(?:no máximo de|com o Máximo de) Cargas de (Tolerância|Frenesi|Poder)$/, (m) => `cargasMax:${CARGA[m[2]]}`],
  [/^(.+?),? (?:quando|enquanto) você não (?:tiver|tem|possuir) Cargas de (Tolerância|Frenesi|Poder)$/, (m) => `semCargas:${CARGA[m[2]]}`],
  [/^(.+?),? contra Inimigos (Resfriados|Congelados|Eletrizados|Cegos|Amaldiçoados|Sangrando|Envenenados|Incendiados|Mutilados|Lentos|Provocados)$/, (m) => ALVO[m[2]]],
  [/^(.+?),? caso você tenha ao menos \{(\d+)\} de Escudo de Energia Máximo$/, (m, valores) => `escudoMin:${Number(valores[Number(m[2])]) || 0}`],
];
/** Os atributos que o GOLPE resolve com as tags do alvo (`fichaDoGolpe`): dano aumentado, crítico, penetração, dano por elemento, "mais dano". */
const DO_GOLPE = /^(dmg_inc|crit_chance_inc|crit_chance|crit_dmg|elem_pen|phys_dmg|fire_dmg|ice_dmg|energy_dmg|chaos_dmg|mais_dano|life_leech|mana_leech)$/;
/** `{ efeito, cond }` da condição escrita no texto, ou null. */
export function condicaoDoTexto(parte, valores = []) {
  for (const [re, cond] of PREFIXOS_DE_CONDICAO) { const m = re.exec(parte); if (m) return { efeito: m[1], cond }; }
  for (const [re, cond] of SUFIXOS_DE_CONDICAO) { const m = re.exec(parte); if (m) return { efeito: m[1], cond }; }
  for (const [re, f] of SUFIXOS_COM_PARAMETRO) { const m = re.exec(parte); if (m) { const cond = f(m, valores); if (cond) return { efeito: m[1], cond }; } }
  return null;
}
/** O atributo com mais uma condição: `stat@a` → `stat@a+cond`. */
const comCondicao = (stat, cond) => (String(stat).includes('@') ? `${stat}+${cond}` : `${stat}@${cond}`);

/** O atributo tem efeito no combate? (o do Draevor, ou o novo com `combate: true`; condicional: o atributo-base e condições conhecidas.) */
function temEfeito(e) {
  const { stat, escala, conds } = partir(e.stat);
  if (!(FICHAS[stat] || NOVOS[stat]?.combate || dinamicoValido(stat))) return false;
  if (!escalaValida(escala)) return false;
  // (+ `alvoVenenos:N` — "contra Inimigos Afetados por ao menos N Venenos": `condicoes-poe.tagsDoAlvo`)
  return conds.every((c) => ehCondDeEstado(c) || TAGS_DE_GOLPE.has(c) || CONDICOES_DE_ANEL[c] || /^alvoVenenos:\d+$/.test(c));
}

const PIOR = ['lembrete', 'equivalente', 'aproximado', 'novo', 'inerte', 'registrado'];
/** Traduz um mod inteiro (`{ modelo, valores }`): híbridos "A / B" viram as partes; o estado do mod é o PIOR das partes. */
export function traduzirMod(mod, opcoes) {
  const partes = String(mod?.modelo ?? '').split(' / ');
  const lista = partes.map((p) => ({ parte: p, ...traduzirParte(p, mod?.valores ?? [], opcoes) }));
  const estado = lista.reduce((pior, x) => (PIOR.indexOf(x.estado) > PIOR.indexOf(pior) ? x.estado : pior), 'lembrete');
  return { estado, partes: lista, efeitos: lista.flatMap((x) => x.efeitos) };
}

/**
 * Os efeitos de uma PEÇA gerada (implícitos + prefixos + sufixos + mods do único), somados por atributo do Draevor (`af`, o formato
 * que a ficha soma), e a lista de cada mod com o estado.
 */
export function traduzirPeca(peca, opcoes) {
  const mods = [...(peca.implicitos ?? []), ...(peca.prefixos ?? []), ...(peca.sufixos ?? []), ...(peca.modificadores ?? [])];
  const af = {};
  const linhas = mods.map((m) => {
    const t = traduzirMod(m, opcoes);
    for (const e of t.efeitos) {
      // Número soma; lista (atributo automático com vários números) soma posição a posição.
      if (Array.isArray(e.valor)) af[e.stat] = e.valor.map((v, k) => Math.round(((af[e.stat]?.[k] ?? 0) + v) * 100) / 100);
      else af[e.stat] = Math.round(((af[e.stat] ?? 0) + e.valor) * 100) / 100;
    }
    return { texto: m.texto, ...t };
  });
  return { af, linhas };
}

/**
 * A COBERTURA da tabela sobre o catálogo importado: o peso de drop dos tiers de cada estado (o quanto do que realmente cai já funciona),
 * e os modelos ainda sem regra, do mais pesado ao mais leve.
 */
export function cobertura(catalogo, opcoes) {
  const peso = { lembrete: 0, equivalente: 0, aproximado: 0, novo: 0, inerte: 0, registrado: 0 };
  const semRegra = new Map();
  const automaticos = new Set();
  for (const c of Object.values(catalogo?.classes ?? {})) {
    for (const pool of Object.values(c.paginas)) {
      for (const g of [...pool.prefixos, ...pool.sufixos]) {
        for (const t of g.tiers) {
          const r = traduzirMod({ modelo: t.modelo, valores: t.faixas.map((f) => f[0]) }, opcoes);
          peso[r.estado] += t.peso ?? 0;
          for (const e of r.efeitos) if (e.stat.startsWith('poe.')) automaticos.add(e.stat);
          if (r.estado === 'registrado') semRegra.set(t.modelo, (semRegra.get(t.modelo) ?? 0) + (t.peso ?? 0));
        }
      }
    }
  }
  const total = Object.values(peso).reduce((a, b) => a + b, 0) || 1;
  return {
    pct: Object.fromEntries(Object.entries(peso).map(([k, v]) => [k, Number(((v / total) * 100).toFixed(1))])),
    semRegra: [...semRegra.entries()].sort((a, b) => b[1] - a[1]).map(([modelo, p]) => ({ modelo, pct: Number(((p / total) * 100).toFixed(2)) })),
    atributosAutomaticos: automaticos.size,
    atributosNovos: Object.keys(NOVOS).length,
    comEfeitoNoCombate: Number((((peso.equivalente + peso.aproximado + peso.novo) / total) * 100).toFixed(1)),
  };
}
