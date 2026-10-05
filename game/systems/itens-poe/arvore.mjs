// A ÁRVORE DE PASSIVAS do PoE no Draevor (sistema de itens do PoE, Fase 1 — incremento 4b: os dados; 4c: no jogo, só com ITENS_POE=1).
//
// `traduzirLinha(texto)`: uma linha de efeito de um nó do PoE ("Vida máxima aumentada em 8%") vira efeitos da árvore do Draevor —
//   `{ add, valor }` (atributo somado, a mesma chave dos itens: `Afixos.soma` junta) ou `{ tag, dano }` (dano % por tag de skill).
//   Ordem: as regras PRÓPRIAS da árvore (`gamedata/itens-poe/traducao-arvore.json`), depois as dos mods (`traducao.json`); sem regra, a
//   linha fica REGISTRADA (o atributo automático do texto, sem efeito ainda — como nos itens). Linha inteira entre parênteses é texto
//   explicativo do PoE: nota, não efeito.
// `converterArvore(poe)`: a árvore do PoE inteira (a da coleção do Drive) no formato da árvore do Draevor (`passivas/arvore.mjs`).
import { readFileSync } from 'node:fs';
import { traduzirMod, compilar, TABELA } from './traduzir.mjs';

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
    const efeitos = r.efeitos.map((e) => (e.tag ? { tag: e.tag, dano: valorDe(e.valor, m, valores) } : { add: e.stat, valor: valorDe(e.valor, m, valores) }));
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
 * A árvore do PoE (`{ nos, ligacoes, classes_iniciais }`) no formato da árvore do Draevor: nós `{ id, nome, tipo, x, y, conexoes,
 * efeitos, custo: 1, textos, estados }`, `inicios` por classe do PoE. Nós sem ligação nenhuma (as maestrias soltas) e os que nenhum
 * início alcança ficam de fora (a árvore do Draevor exige tudo alcançável). Devolve `{ arvore, relatorio }`.
 */
export function converterArvore(poe) {
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
      ...(tipo === 'keystone' ? { keystone: { regra: 'texto', texto: linhas.filter((l, i) => traduzidas[i].estado !== 'nota').join(' ') || n.nome } } : {}),
      ...(n.placeholder ? { placeholder: true } : {}),
      conexoes: [...viz.get(n.id)].filter((c) => alcancados.has(c)).map(String),
    });
  }
  const inicios = Object.fromEntries([...inicioDe].filter(([id]) => alcancados.has(Number(id))).map(([id, classe]) => [classe, id]));
  return {
    arvore: { versao: 1, inicios, nos },
    relatorio: { nos: nos.length, foraDaArvore: poe.nos.length - nos.length, linhas: Object.values(estados).reduce((a, b) => a + b, 0), estados },
  };
}
