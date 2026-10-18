// (lote 63) Os NÓS que uma Joia Ramificadora cria na árvore do PoE — como o Path of Building monta (`PassiveSpec:BuildSubgraph`, que segue o
// jogo: os ids dos nós são os mesmos do PoE). Dono, 16/10: "Fazer completo" e "Seguir nessa ordem" (1 os dados, 2 o servidor, 3 a tela, 4 as
// únicas). A peça vem de `itens-poe/ramificadoras.mjs`; os dados, de `catalogo.ramificadoras` (`gamedata/itens-poe/ramificadoras.json`).
//
// Só o ENCAIXE DE EXPANSÃO Grande (a borda da árvore) começa; o encaixe que a joia cria é um nó da árvore (o encaixe interno) e recebe uma
// joia menor — que monta os nós dela a partir dele. Para cada joia:
//   - o id: 0x10000 + (o índice do encaixe Grande × 64 | o do Médio × 512) e, de cada nó, + o tamanho da joia × 16 + o índice dele;
//   - os ÍNDICES do molde do tamanho (o PoB): primeiro os encaixes (a Grande com 1 encaixe: o índice 6), depois os notáveis (na ordem do PoB,
//     com as regras da Média), depois as pequenas; o índice 0 é a entrada, ligada ao encaixe;
//   - a POSIÇÃO: o centro do grupo do proxy do encaixe, a órbita do tamanho (Pequena 1, Média 2, Grande 3), o índice + o deslocamento do
//     proxy, levado do molde (12 ou 6) para a órbita (16 ou 6) e o ângulo da órbita do PoE;
//   - as LIGAÇÕES: em anel, na ordem dos índices (fechado, fora na Pequena), e a entrada no encaixe;
//   - os EFEITOS: a pequena concede o encantamento e os "também concedem" da joia, com o "Efeito aumentado" das pequenas (o PoB: o valor ×
//     o efeito, truncado); o notável, os efeitos dele (a árvore 3.29 do poedb). As linhas pelo mesmo tradutor da árvore.
import { traduzirLinha } from '../itens-poe/arvore.mjs';
import { encantamentoDa, definirEstadosDaPeca } from '../itens-poe/ramificadoras.mjs';
import { definirRamificadoras } from './arvore.mjs';
import { catalogo } from '../itens-poe/catalogo.mjs';

export const ID_BASE = 0x10000;
/** Os ângulos da órbita de 16 nós do PoE (graus); as outras são divididas por igual. */
const ANGULOS_16 = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330];
const DE_12_PARA_16 = [0, 1, 3, 4, 5, 7, 8, 9, 11, 12, 13, 15];
const DE_6_PARA_16 = [0, 3, 5, 8, 11, 13];
/** O índice do molde da joia (`de` posições) na órbita da árvore (`para` posições) — o `TranslateClusterOrbitIndex` do PoB. */
export function indiceNaOrbita(i, de, para) {
  if (de === para) return i;
  if (de === 12 && para === 16) return DE_12_PARA_16[i];
  if (de === 6 && para === 16) return DE_6_PARA_16[i];
  return Math.floor((i * para) / de);
}
const angulo = (indice, nos) => (nos === 16 ? ANGULOS_16[indice] : (360 * indice) / nos);

// As linhas da peça que mudam os nós (o português do poedb, pelo modelo do mod)
const NOS = /^Adiciona \{0\} Habilidades Passivas$/;
const ENCAIXES = /^\{0\} das Habilidades Passivas adicionadas são Encaixes de Joia$/;
const TAMBEM = /^(?:Pequenas )?Habilidades Passivas [Aa]dicionadas também concedem: (.+)$/;
const EFEITO = /^Pequenas Habilidades Passivas adicionadas possuem Efeito aumentado em \{0\}%$/;
const escrever = (modelo, valores) => String(modelo).replace(/\{(\d+)\}/g, (_, i) => String(valores?.[Number(i)] ?? '?'));

/**
 * O que a JOIA (`poe`, a peça) diz para os nós: o tamanho, o encantamento, quantos nós, quantos encaixes, os notáveis (as chaves de
 * `dados.notaveis`), as linhas a mais das pequenas e o efeito delas (%). null se não é uma Ramificadora gerada.
 */
export function leituraDaJoia(dados, poe) {
  const enc = encantamentoDa(dados, poe);
  const T = dados?.tamanhos?.[poe?.ramificadora?.tamanho];
  if (!enc || !T) return null;
  const implicito = (re) => (poe.implicitos ?? []).find((x) => re.test(x.modelo ?? ''));
  const mods = [...(poe.prefixos ?? []), ...(poe.sufixos ?? [])];
  return {
    tamanho: poe.ramificadora.tamanho, molde: T, encantamento: enc,
    nos: Number(implicito(NOS)?.valores?.[0]) || T.nos[0],
    encaixes: Number(implicito(ENCAIXES)?.valores?.[0]) || 0,
    notaveis: mods.filter((m) => m.notavel && dados.notaveis[m.notavel]).map((m) => m.notavel),
    tambem: mods.filter((m) => TAMBEM.test(m.modelo ?? '')).map((m) => escrever(TAMBEM.exec(m.modelo)[1], m.valores)),
    efeitoPct: mods.filter((m) => EFEITO.test(m.modelo ?? '')).reduce((s, m) => s + (Number(m.valores?.[0]) || 0), 0),
  };
}

/** Os números de uma linha × o efeito (o PoB: o inteiro truncado; o decimal, cortado nas casas dele). */
export function comEfeito(linha, pct) {
  if (!pct) return linha;
  const f = 1 + pct / 100;
  return String(linha).replace(/\d+(?:\.\d+)?/g, (n) => {
    const casas = (n.split('.')[1] ?? '').length;
    const v = Math.round(Number(n) * f * 100) / 100;
    return String(casas ? Math.floor(v * 10 ** casas) / 10 ** casas : Math.trunc(v));
  });
}

/** O nó (no formato da árvore): os textos, os estados e os efeitos de cada linha pelo tradutor da árvore. */
function noComLinhas(base, linhas) {
  const traduzidas = linhas.map(traduzirLinha);
  const notas = traduzidas.map((t) => (t.nota && t.estado !== 'nota' && t.estado !== 'equivalente' ? t.nota : null));
  return { ...base, custo: 1, efeitos: traduzidas.flatMap((t) => t.efeitos), textos: linhas, estados: traduzidas.map((t) => t.estado), ...(notas.some(Boolean) ? { notas } : {}) };
}

/**
 * Monta os nós da joia `poe` no encaixe de expansão `encaixe` (o nó da árvore, com `expansao`). `arvore`: `{ porId, orbitas }`.
 * `joiaNoEncaixe(id)`: a peça encaixada num encaixe interno (as joias menores montam a partir dele). Devolve `{ encaixe, entrada, nos }`
 * (os nós com `conexoes` dentro da joia — a entrada também liga ao encaixe) ou null (a joia não cabe: maior que o encaixe, ou sem os dados).
 */
export function montar({ dados, arvore, encaixe, poe, id = ID_BASE, joiaNoEncaixe = () => null }) {
  const exp = encaixe?.expansao;
  const j = leituraDaJoia(dados, poe);
  if (!exp || !j) return null;
  const T = j.molde;
  if (T.indice > exp.tamanho) return null;
  if (exp.tamanho === 2) id += exp.indice << 6;
  else if (exp.tamanho === 1) id += exp.indice << 9;
  const idDoNo = id + (T.indice << 4);
  const proxy = arvore.porId.get(String(exp.proxy));
  if (!proxy?.proxy) return null;
  const indices = new Map();
  // 1º os ENCAIXES (o encaixe interno do grupo do proxy, pelo índice dele)
  const encaixeDoGrupo = (indice) => proxy.proxy.encaixes.find((e) => e.indice === indice)?.id ?? null;
  const porEncaixe = (no, indice) => {
    const idDoEncaixe = encaixeDoGrupo(indice);
    if (idDoEncaixe) indices.set(no, { tipo: 'encaixe', id: idDoEncaixe });
  };
  if (j.tamanho === 'Large' && j.encaixes === 1) porEncaixe(6, 1);
  else for (let i = 0; i < Math.min(j.encaixes, T.encaixes.length); i++) porEncaixe(T.encaixes[i], [0, 2, 1][i]);
  // 2º os NOTÁVEIS, na ordem do PoB, nos índices livres (as regras da Média)
  const notaveis = [...j.notaveis].sort((a, b) => (dados.notaveis[a].ordem ?? 0) - (dados.notaveis[b].ordem ?? 0));
  const livresParaNotavel = [];
  for (let i of T.notaveis) {
    if (livresParaNotavel.length === notaveis.length) break;
    if (j.tamanho === 'Medium') {
      if (j.encaixes === 0 && notaveis.length === 2) i = i === 6 ? 4 : i === 10 ? 8 : i;
      else if (j.nos === 4) i = i === 10 ? 9 : i === 2 ? 3 : i;
    }
    if (!indices.has(i)) livresParaNotavel.push(i);
  }
  livresParaNotavel.sort((a, b) => a - b);
  notaveis.forEach((n, k) => { if (livresParaNotavel[k] != null) indices.set(livresParaNotavel[k], { tipo: 'notavel', nome: n }); });
  // 3º as PEQUENAS, nos índices que sobram
  const pequenas = Math.max(0, j.nos - j.encaixes - notaveis.length);
  const livresParaPequena = [];
  for (let i of T.pequenas) {
    if (livresParaPequena.length === pequenas) break;
    if (j.tamanho === 'Medium') {
      if (j.nos === 5 && i === 4) i = 3;
      else if (j.nos === 4) i = i === 8 ? 9 : i === 4 ? 3 : i;
    }
    if (!indices.has(i)) livresParaPequena.push(i);
  }
  for (const i of livresParaPequena.slice(0, pequenas)) indices.set(i, { tipo: 'pequena' });
  if (!indices.has(0)) return null;
  // A posição: o centro do grupo do proxy, a órbita do tamanho, o índice levado para a órbita (com o deslocamento do proxy)
  const orbita = T.indice + 1;
  const nosNaOrbita = arvore.orbitas?.nos?.[orbita] ?? T.total;
  const raio = arvore.orbitas?.raios?.[orbita] ?? 0;
  const deslocamento = Number(dados.deslocamentos?.[String(proxy.id)]?.[String(T.indice)]) || 0;
  const posicao = (i) => {
    const a = (angulo(indiceNaOrbita((i + deslocamento) % T.total, T.total, nosNaOrbita), nosNaOrbita) * Math.PI) / 180;
    return { x: Math.round((proxy.proxy.grupo.x + raio * Math.sin(a)) * 100) / 100, y: Math.round((proxy.proxy.grupo.y - raio * Math.cos(a)) * 100) / 100 };
  };
  const linhasDaPequena = [...j.encantamento.linhas, ...j.tambem].map((l) => comEfeito(l, j.efeitoPct));
  const nos = [];
  const ordem = [...indices.keys()].sort((a, b) => a - b);
  for (const i of ordem) {
    const x = indices.get(i);
    const marca = { ramificadora: { encaixe: encaixe.id, indice: i, tamanho: j.tamanho } };
    if (x.tipo === 'encaixe') {
      const no = arvore.porId.get(x.id);
      nos.push({ id: x.id, nome: no?.nome ?? 'Encaixe de Joia', ...(no?.nomeEn ? { nomeEn: no.nomeEn } : {}), tipo: no?.tipo ?? 'small', ...posicao(i), custo: 1, efeitos: [], textos: [], estados: [], expansao: no?.expansao, encaixeInterno: true, ...marca });
    } else if (x.tipo === 'notavel') {
      const n = dados.notaveis[x.nome];
      nos.push(noComLinhas({ id: String(idDoNo + i), nome: n.nome ?? x.nome, nomeEn: n.en, tipo: 'notable', ...posicao(i), ...(n.icone ? { icone: n.icone } : {}), ...marca }, [...n.linhas, ...(n.lembretes ?? [])]));
    } else {
      nos.push(noComLinhas({ id: String(idDoNo + i), nome: j.encantamento.nome ?? j.encantamento.en, nomeEn: j.encantamento.en, tipo: 'small', ...posicao(i), ...(j.encantamento.icone ? { icone: j.encantamento.icone } : {}), ...marca }, [...linhasDaPequena, ...(j.encantamento.lembretes ?? [])]));
    }
  }
  // As ligações: em anel na ordem dos índices (fechado, fora na Pequena); a entrada (o índice 0) no encaixe
  const conexoes = new Map(nos.map((n) => [n.id, new Set()]));
  const ligar = (a, b) => { if (a !== b) { conexoes.get(a)?.add(b); conexoes.get(b)?.add(a); } };
  for (let k = 1; k < nos.length; k++) ligar(nos[k - 1].id, nos[k].id);
  if (nos.length > 2 && j.tamanho !== 'Small') ligar(nos[0].id, nos[nos.length - 1].id);
  const entrada = nos[0].id;
  for (const n of nos) n.conexoes = [...conexoes.get(n.id), ...(n.id === entrada ? [encaixe.id] : [])];
  const saida = { encaixe: encaixe.id, entrada, nos };
  // As joias MENORES nos encaixes internos: montam a partir deles (o id segue o desta joia)
  for (const n of nos.filter((x) => x.encaixeInterno)) {
    const menor = joiaNoEncaixe(n.id);
    if (!menor?.poe?.ramificadora) continue;
    const dentro = montar({ dados, arvore, encaixe: { ...arvore.porId.get(n.id), id: n.id }, poe: menor.poe, id, joiaNoEncaixe });
    if (!dentro) continue;
    n.conexoes.push(dentro.entrada);
    saida.nos.push(...dentro.nos);
  }
  return saida;
}

/** Do pior para o melhor: a linha da peça leva o pior estado das linhas do nó que ela dá (as notas e os lembretes não contam). */
const PIOR = { registrado: 5, inerte: 4, parcial: 3, aproximado: 2, novo: 1, equivalente: 0 };
// (a linha que "não se aplica ao jogo" — o balão da árvore marca "–" — só conta se o nó não tiver outra)
const naoSeAplica = (t) => t.estado === 'inerte' && /^não se aplica ao jogo:/i.test(t.nota ?? '');
const pior = (traduzidas) => {
  const validas = traduzidas.filter((t) => t.estado in PIOR);
  const comEfeito = validas.filter((t) => !naoSeAplica(t));
  return (comEfeito.length ? comEfeito : validas).sort((a, b) => PIOR[b.estado] - PIOR[a.estado])[0] ?? null;
};
const ENCANTAMENTO = /^Habilidades Passivas Adicionadas concedem /;
/**
 * (lote 78) Os ESTADOS das linhas da peça `poe` (na ordem da tradução: implícitos, prefixos, sufixos, modificadores) pelas linhas dos nós que
 * ela cria: "Adiciona N", "N são Encaixes de Joia" e o "Efeito aumentado" das pequenas montam os nós (✓); o encantamento e o "também
 * concedem", o estado da linha na pequena; o "1 das … é <Notável>", o pior das linhas do notável. A nota vai com o estado (o porquê no balão).
 */
export function estadosDaPeca(dados, poe, estados = [], notas = []) {
  if (!leituraDaJoia(dados, poe)) return null;
  const linhas = [...(poe.implicitos ?? []), ...(poe.prefixos ?? []), ...(poe.sufixos ?? []), ...(poe.modificadores ?? [])];
  if (linhas.length !== estados.length) return null;
  const novos = [...estados];
  const novasNotas = linhas.map((_, i) => notas?.[i] ?? null);
  linhas.forEach((m, i) => {
    const modelo = m.modelo ?? '';
    let t = null;
    if (NOS.test(modelo) || ENCAIXES.test(modelo) || EFEITO.test(modelo)) t = { estado: 'equivalente', nota: null };
    else if (m.encantamento) t = pior([traduzirLinha(String(m.texto ?? modelo).replace(ENCANTAMENTO, ''))]);
    else if (m.notavel && dados.notaveis[m.notavel]) t = pior(dados.notaveis[m.notavel].linhas.map(traduzirLinha));
    else if (TAMBEM.test(modelo)) t = pior([traduzirLinha(escrever(TAMBEM.exec(modelo)[1], m.valores))]);
    if (!t) return;
    novos[i] = t.estado;
    novasNotas[i] = t.estado === 'inerte' ? t.nota ?? null : null;
  });
  return { estados: novos, notas: novasNotas };
}
definirEstadosDaPeca((poe, estados, notas) => estadosDaPeca(catalogo()?.ramificadoras ?? null, poe, estados, notas));

// (lote 64) a árvore do personagem monta os nós das Ramificadoras encaixadas por aqui (`passivas/arvore.grafoDe`)
definirRamificadoras({ montar, dados: () => catalogo()?.ramificadoras ?? null });
