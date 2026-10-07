// A ÁRVORE DE PASSIVAS do PoE no Draevor (sistema de itens do PoE, Fase 1 — incremento 4b: os dados; 4c: no jogo, só com ITENS_POE=1).
//
// `traduzirLinha(texto)`: uma linha de efeito de um nó do PoE ("Vida máxima aumentada em 8%") vira efeitos da árvore do Draevor —
//   `{ add, valor }` (atributo somado, a mesma chave dos itens: `Afixos.soma` junta), `{ stat, pct }` (% de vida, mana... — o formato das
//   especializações, que a vida/mana máximas somam) ou `{ tag, dano }` (dano % por tag de skill).
//   Ordem: as regras PRÓPRIAS da árvore (`gamedata/itens-poe/traducao-arvore.json`), depois as dos mods (`traducao.json`); sem regra, a
//   linha fica REGISTRADA (o atributo automático do texto, sem efeito ainda — como nos itens). Linha inteira entre parênteses é texto
//   explicativo do PoE: nota, não efeito.
// `converterArvore(poe)`: a árvore do PoE inteira (a da coleção do Drive) no formato da árvore do Draevor (`passivas/arvore.mjs`).
import { readFileSync } from 'node:fs';
import { traduzirMod, compilar, TABELA } from './traduzir.mjs';

/** O caminho local do ícone de uma passiva de ascendência (o mesmo de `tools/baixar-ascendencias-poedb.mjs`): o jogo serve em `/api/jogo/poe/icone/ascendencia/<caminho>`. */
export function caminhoDoIconeDeAscendencia(url) {
  const u = String(url ?? '');
  const p = /\/passives\/(.+\.webp)$/i.exec(u);
  if (p) return p[1].split('/').map(decodeURIComponent).join('/');
  const c = /\/UIImages\/Common\/([^/]+\.webp)$/i.exec(u);
  if (c) return `classes/${decodeURIComponent(c[1])}`;
  return null;
}

export const REGRAS_DA_ARVORE = JSON.parse(readFileSync(new URL('../../gamedata/itens-poe/traducao-arvore.json', import.meta.url), 'utf8'));
const PROPRIAS = compilar({ ...TABELA, regras: REGRAS_DA_ARVORE.regras });
/** As chaves que a árvore do Draevor aceita num `add` (as outras ficam registradas). */
const ADD_VALIDO = /^[a-z_]+$/;

/** "Evasão aumentada em 14%" → `{ modelo: 'Evasão aumentada em {0}%', valores: [14] }`. */
export function paraModelo(texto) {
  const valores = [];
  const modelo = String(texto).replace(/-?\d+(?:[.,]\d+)?/g, (n) => {
    valores.push(Number(n.replace(',', '.')));
    return `{${valores.length - 1}}`;
  });
  return { modelo, valores };
}

const valorDe = (expr, m, valores) => {
  const idx = [...m.slice(1)].filter((x) => x != null && /^\d+$/.test(x));
  const um = /^\{(\d+)\}$/.exec(expr);
  return um ? Number(valores[idx[Number(um[1]) - 1]]) : Number(expr);
};

/**
 * Traduz UMA linha. `{ estado, efeitos, registrados, nota }`: `efeitos` no formato da árvore do Draevor; `registrados` os atributos
 * sem efeito (o id automático e o valor), para mostrar; `estado` = equivalente | aproximado | novo | registrado | nota.
 */
export function traduzirLinha(texto) {
  const t = String(texto ?? '').trim();
  if (!t) return { estado: 'nota', efeitos: [], registrados: [], nota: null };
  if (/^\(.*\)\.?$/.test(t)) return { estado: 'nota', efeitos: [], registrados: [], nota: t };
  const { modelo, valores } = paraModelo(t);
  for (const r of PROPRIAS) {
    const m = r.re.exec(modelo);
    if (!m) continue;
    const efeitos = r.efeitos.map((e) => (e.tag ? { tag: e.tag, dano: valorDe(e.valor, m, valores) } : e.pct ? { stat: e.pct, pct: valorDe(e.valor, m, valores) } : { add: e.stat, valor: valorDe(e.valor, m, valores) }));
    return { estado: r.estado, efeitos, registrados: [], nota: r.nota ?? null };
  }
  const tm = traduzirMod({ modelo, valores });
  const efeitos = [];
  const registrados = [];
  for (const e of tm.efeitos) {
    if (ADD_VALIDO.test(e.stat) && typeof e.valor === 'number' && Number.isFinite(e.valor)) efeitos.push({ add: e.stat, valor: e.valor });
    else registrados.push({ stat: e.stat, valor: e.valor });
  }
  return { estado: efeitos.length ? tm.estado : 'registrado', efeitos, registrados, nota: tm.partes.find((p) => p.nota)?.nota ?? null };
}

const TIPO = { comum: 'small', notavel: 'notable', keystone: 'keystone' };

/**
 * A keystone do PoE no Draevor: a do mapa (`traducao-arvore.json` → keystones, pelo nome em inglês) com mecânica, ou só o texto. Devolve
 * os campos do nó: `keystone` e — se o mapa der — os `efeitos` que ela soma e o estado de cada linha (todas com o estado da keystone).
 */
function keystoneDe(n, linhas, traduzidas) {
  const texto = linhas.filter((l, i) => traduzidas[i].estado !== 'nota').join(' ') || n.nome;
  const m = REGRAS_DA_ARVORE.keystones?.[n.nome_en];
  if (!m) return { keystone: { regra: 'texto', texto } };
  const { estado, nota, efeitos = [], ...regra } = m;
  return {
    keystone: { ...regra, texto, ...(nota ? { nota } : {}) },
    efeitos: efeitos.map((e) => (e.pct ? { stat: e.pct, pct: e.valor } : { add: e.stat, valor: e.valor })),
    estados: traduzidas.map((t) => (t.estado === 'nota' ? 'nota' : estado)),
  };
}

/**
 * As ASCENDÊNCIAS (incremento 4e): cada uma vira um pedaço à parte da árvore (fica na borda de fora da principal, sem tocar nela), com o
 * próprio nó inicial (`tipo: 'start'`, em `inicios` como `asc:<slug>`) e os nós marcados com `ascendencia` (gastam pontos de
 * ascendência). `lista`: os `ascendencia.json` da coleção. Devolve `{ nos, inicios, ascendencias, relatorio }`.
 */
export function converterAscendencias(lista) {
  const nos = [];
  const inicios = {};
  const ascendencias = {};
  const estados = { equivalente: 0, aproximado: 0, novo: 0, registrado: 0, nota: 0 };
  for (const a of lista) {
    const ids = new Set(a.nos.map((n) => n.id));
    const viz = new Map(a.nos.map((n) => [n.id, new Set()]));
    const ligar = (x, y) => {
      if (!ids.has(x) || !ids.has(y) || x === y) return;
      viz.get(x).add(y);
      viz.get(y).add(x);
    };
    for (const l of a.ligacoes ?? []) ligar(l.de, l.para);
    for (const n of a.nos) for (const v of n.vizinhos ?? []) ligar(n.id, v);
    for (const n of a.nos) {
      const inicio = n.id === a.no_inicial || n.eh_no_inicial;
      const linhas = (n.efeitos ?? []).flatMap((e) => String(e).split('\n')).map((l) => l.trim()).filter(Boolean);
      const traduzidas = linhas.map(traduzirLinha);
      for (const t of traduzidas) estados[t.estado]++;
      nos.push({
        id: String(n.id),
        nome: inicio ? `Ascendência: ${a.nome_pt}` : n.nome,
        ...(n.nome_en ? { nomeEn: n.nome_en } : {}),
        tipo: inicio ? 'start' : n.molde === 'notable' ? 'notable' : 'small',
        x: n.x,
        y: n.y,
        custo: inicio ? 0 : 1,
        ascendencia: a.slug,
        efeitos: traduzidas.flatMap((t) => t.efeitos),
        textos: linhas,
        estados: traduzidas.map((t) => t.estado),
        conexoes: [...viz.get(n.id)].map(String),
        // O ícone do PoE (dono, 07/10): o nó da ascendência mostra a arte dele na árvore; o início mostra o emblema da ascendência.
        ...((inicio ? caminhoDoIconeDeAscendencia(a.icone) : caminhoDoIconeDeAscendencia(n.icone)) ? { icone: inicio ? caminhoDoIconeDeAscendencia(a.icone) : caminhoDoIconeDeAscendencia(n.icone) } : {}),
      });
      if (inicio) inicios[`asc:${a.slug}`] = String(n.id);
    }
    ascendencias[a.slug] = { slug: a.slug, nome: a.nome_pt, classe: a.classe, inicio: String(a.no_inicial), nos: a.nos.length, ...(a.flavour ? { flavour: a.flavour } : {}), ...(caminhoDoIconeDeAscendencia(a.icone) ? { icone: caminhoDoIconeDeAscendencia(a.icone) } : {}) };
  }
  return { nos, inicios, ascendencias, relatorio: { ascendencias: lista.length, nos: nos.length, estados } };
}

/**
 * A árvore do PoE (`{ nos, ligacoes, classes_iniciais }`) no formato da árvore do Draevor: nós `{ id, nome, tipo, x, y, conexoes,
 * efeitos, custo: 1, textos, estados }`, `inicios` por classe do PoE. Nós sem ligação nenhuma (as maestrias soltas) e os que nenhum
 * início alcança ficam de fora (a árvore do Draevor exige tudo alcançável). Devolve `{ arvore, relatorio }`.
 */
export function converterArvore(poe, completa = null) {
  // A árvore COMPLETA (o arquivo oficial do jogo, na coleção) dá o GRUPO de cada nó e as MAESTRIAS com as opções delas.
  const daCompleta = new Map((completa?.nos ?? []).map((n) => [n.id, n]));
  const inicioDe = new Map(Object.entries(poe.classes_iniciais ?? {}).map(([classe, v]) => [String(v.no), classe]));
  const viz = new Map(poe.nos.map((n) => [n.id, new Set()]));
  for (const l of poe.ligacoes ?? []) {
    if (!viz.has(l.de) || !viz.has(l.para) || l.de === l.para) continue;
    viz.get(l.de).add(l.para);
    viz.get(l.para).add(l.de);
  }
  for (const n of poe.nos) for (const v of n.vizinhos ?? []) if (viz.has(v) && v !== n.id) {
    viz.get(n.id).add(v);
    viz.get(v).add(n.id);
  }
  // Quem os inícios alcançam.
  const alcancados = new Set();
  const fila = [...inicioDe.keys()].map(Number).filter((id) => viz.has(id));
  for (const id of fila) alcancados.add(id);
  while (fila.length) {
    const id = fila.pop();
    for (const c of viz.get(id)) if (!alcancados.has(c)) {
      alcancados.add(c);
      fila.push(c);
    }
  }
  const estados = { equivalente: 0, aproximado: 0, novo: 0, registrado: 0, nota: 0 };
  const nos = [];
  for (const n of poe.nos) {
    if (!alcancados.has(n.id)) continue;
    const classe = inicioDe.get(String(n.id));
    const linhas = (n.efeitos ?? []).flatMap((e) => String(e).split('\n')).map((l) => l.trim()).filter(Boolean);
    const traduzidas = linhas.map(traduzirLinha);
    for (const t of traduzidas) estados[t.estado]++;
    const tipo = classe ? 'start' : TIPO[n.tipo] ?? 'small';
    const grupo = daCompleta.get(n.id)?.grupo;
    nos.push({
      id: String(n.id),
      nome: classe ? `Início: ${classe}` : n.nome,
      ...(n.nome_en ? { nomeEn: n.nome_en } : {}),
      tipo,
      x: n.x,
      y: n.y,
      custo: classe ? 0 : 1,
      ...(classe ? { classe } : {}),
      efeitos: traduzidas.flatMap((t) => t.efeitos),
      textos: linhas,
      estados: traduzidas.map((t) => t.estado),
      ...(tipo === 'keystone' ? keystoneDe(n, linhas, traduzidas) : {}),
      ...(n.placeholder ? { placeholder: true } : {}),
      // O grupo do notável (é ele que abre a maestria do mesmo grupo).
      ...(tipo === 'notable' && grupo != null ? { grupo } : {}),
      conexoes: [...viz.get(n.id)].filter((c) => alcancados.has(c)).map(String),
    });
  }
  /*
   * ---- As MAESTRIAS (como no PoE) ----
   * Um nó sem ligação: abre quando há um notável alocado no MESMO grupo, custa 1 ponto, e ao alocar escolhe-se UMA das opções (cada uma
   * com os efeitos traduzidos). Só as da árvore principal (posicionadas, fora das ascendências) e com um notável no grupo.
   */
  const gruposComNotavel = new Set(nos.filter((x) => x.tipo === 'notable' && x.grupo != null).map((x) => x.grupo));
  const nomeEn = new Map(poe.nos.map((n) => [n.id, n.nome_en]));
  let maestrias = 0;
  for (const m of completa?.nos ?? []) {
    if (m.tipo !== 'maestria' || !m.posicionado || m.fora_da_arvore || m.ascendencia || !gruposComNotavel.has(m.grupo) || !m.efeitos_de_maestria?.length) continue;
    const opcoes = m.efeitos_de_maestria.map((o) => {
      const linhas = (o.efeitos ?? []).flatMap((e) => String(e).split('\n')).map((l) => l.trim()).filter(Boolean);
      const traduzidas = linhas.map(traduzirLinha);
      for (const t of traduzidas) estados[t.estado]++;
      return { id: String(o.id), textos: linhas, estados: traduzidas.map((t) => t.estado), efeitos: traduzidas.flatMap((t) => t.efeitos) };
    });
    nos.push({
      id: String(m.id),
      nome: m.nome,
      ...(nomeEn.get(m.id) ? { nomeEn: nomeEn.get(m.id) } : {}),
      tipo: 'mastery',
      x: m.x,
      y: m.y,
      custo: 1,
      grupo: m.grupo,
      efeitos: [],
      textos: [],
      estados: [],
      opcoes,
      conexoes: [],
    });
    maestrias++;
  }
  const inicios = Object.fromEntries([...inicioDe].filter(([id]) => alcancados.has(Number(id))).map(([id, classe]) => [classe, id]));
  return {
    arvore: { versao: 1, inicios, nos },
    relatorio: { nos: nos.length, maestrias, foraDaArvore: poe.nos.length - (nos.length - maestrias), linhas: Object.values(estados).reduce((a, b) => a + b, 0), estados },
  };
}
