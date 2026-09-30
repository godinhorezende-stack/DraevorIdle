// Gera a ÁRVORE DE PASSIVAS (`game/gamedata/passivas/arvore.json`) a partir dos
// clusters e dos inícios das classes (`game/gamedata/passivas/clusters.json`).
//
// A árvore é um GRAFO: nós com posição (x, y) e conexões. O motor
// (`game/systems/passivas/arvore.mjs`) só lê o arvore.json — não sabe nada de
// clusters nem de geometria —, então dá para trocar este gerador por um editor
// de árvore (arrastar nó, ligar, desligar) sem mexer no motor.
//
// A forma:
//   - um ANEL de atributos em volta do centro liga os cinco inícios (é por ele
//     que o Knight chega ao Fire/Spell: cross-build);
//   - cada início liga ao anel e às ENTRADAS dos clusters da região dele;
//   - cada cluster: entrada → 2 pequenos → dois ramos de 3 pequenos → um
//     notável na ponta de cada ramo → o keystone (se tiver) atrás do 1º;
//   - clusters vizinhos (`perto`) se ligam pelas pontas mais próximas, e os
//     clusters de fora (raio maior) só se alcançam por eles.
//
// Uso: node tools/gerar-arvore-passiva.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const raiz = new URL('../game/gamedata/passivas/', import.meta.url);
const fonte = JSON.parse(readFileSync(new URL('clusters.json', raiz), 'utf8'));

const nos = [];
const porId = new Map();
const arestas = new Set();
const rad = (g) => (g * Math.PI) / 180;
const polar = (angulo, raio) => ({ x: Math.round(Math.cos(rad(angulo)) * raio), y: Math.round(Math.sin(rad(angulo)) * raio) });

function no(n) {
  if (porId.has(n.id)) throw new Error(`nó repetido: ${n.id}`);
  const completo = { levelMinimo: 0, efeitos: [], tags: [], ...n };
  nos.push(completo);
  porId.set(n.id, completo);
  return completo;
}
function ligar(a, b) {
  if (a === b) return;
  const [x, y] = [a, b].sort();
  arestas.add(`${x}|${y}`);
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// ---- o anel de atributos ----
const anel = fonte.anel;
const inicios = Object.entries(fonte.inicios);
const classeMaisPerto = (angulo) =>
  inicios.reduce((m, [classe, i]) => {
    const d = Math.abs(((angulo - i.angulo + 540) % 360) - 180);
    return !m || d < m.d ? { classe, d } : m;
  }, null).classe;
const ATRIBUTO_NOME = { str: 'STR', dex: 'DEX', int: 'INT' };
for (let i = 0; i < anel.nos; i++) {
  const angulo = -90 + (360 * i) / anel.nos;
  const atributo = anel.atributo[classeMaisPerto(angulo)];
  no({ id: `anel_${i}`, nome: ATRIBUTO_NOME[atributo], tipo: 'small', ...polar(angulo, anel.raio), cluster: 'anel', dominio: null, tags: ['atributo', atributo], efeitos: [{ add: atributo, valor: anel.valor }] });
  if (i > 0) ligar(`anel_${i - 1}`, `anel_${i}`);
}
ligar(`anel_${anel.nos - 1}`, 'anel_0');
const anelMaisPerto = (p) => nos.filter((n) => n.cluster === 'anel').reduce((m, n) => (!m || dist(n, p) < dist(m, p) ? n : m), null);

// ---- os clusters ----
// Coordenadas locais: u para FORA (radial), v de lado (tangencial).
const FORMA = {
  e: [0, 0],
  s1: [110, 0],
  s2: [220, 0],
  a1: [330, -100],
  a2: [440, -150],
  a3: [560, -170],
  b1: [330, 100],
  b2: [440, 150],
  b3: [560, 170],
  na: [690, -180],
  nb: [690, 180],
  k: [860, -210],
};
const PEQUENOS = ['e', 's1', 's2', 'a1', 'a2', 'a3', 'b1', 'b2', 'b3'];
const pontas = new Map(); // cluster -> nós que podem ligar a outro cluster
for (const c of fonte.clusters) {
  const base = polar(c.angulo, c.raio);
  const ur = { x: Math.cos(rad(c.angulo)), y: Math.sin(rad(c.angulo)) };
  const vr = { x: -ur.y, y: ur.x };
  const pos = ([u, v]) => ({ x: Math.round(base.x + ur.x * u + vr.x * v), y: Math.round(base.y + ur.y * u + vr.y * v) });
  const comum = { cluster: c.id, dominio: c.dominio, icone: c.id };
  PEQUENOS.forEach((k, i) => {
    const efeitos = c.pequenos[i % c.pequenos.length];
    no({ id: `${c.id}_${k}`, nome: c.nome, tipo: 'small', ...pos(FORMA[k]), ...comum, tags: [...c.tags], efeitos });
  });
  c.notaveis.forEach((n, i) => {
    const k = i === 0 ? 'na' : 'nb';
    no({ id: `${c.id}_${k}`, nome: n.nome, tipo: 'notable', ...pos(FORMA[k]), ...comum, tags: [...c.tags], efeitos: n.efeitos, ...(n.descricao ? { descricao: n.descricao } : {}) });
  });
  if (c.keystone) {
    no({
      id: `${c.id}_k`,
      nome: c.keystone.nome,
      descricao: c.keystone.descricao,
      tipo: 'keystone',
      ...pos(FORMA.k),
      ...comum,
      tags: [...c.tags, 'keystone'],
      levelMinimo: c.keystone.levelMinimo ?? 60,
      efeitos: c.keystone.efeitos ?? [],
      keystone: c.keystone.keystone,
    });
  }
  const id = (k) => `${c.id}_${k}`;
  for (const [a, b] of [['e', 's1'], ['s1', 's2'], ['s2', 'a1'], ['a1', 'a2'], ['a2', 'a3'], ['a3', 'na'], ['s2', 'b1'], ['b1', 'b2'], ['b2', 'b3'], ['b3', 'nb']]) ligar(id(a), id(b));
  if (c.keystone) ligar(id('na'), id('k'));
  pontas.set(c.id, [id('e'), id('a3'), id('b3')]);
}

// ---- os inícios das classes ----
const INICIO = {};
for (const [classe, i] of inicios) {
  const n = no({ id: `inicio_${classe}`, nome: i.nome, tipo: 'start', ...polar(i.angulo, i.raio), cluster: 'inicio', dominio: null, classe, tags: ['inicio', classe], efeitos: [] });
  INICIO[classe] = n.id;
  ligar(n.id, anelMaisPerto(n).id);
  for (const c of i.clusters) ligar(n.id, `${c}_e`);
}

// ---- vizinhos: pelas pontas mais próximas ----
for (const c of fonte.clusters) {
  for (const outro of c.perto ?? []) {
    if (!pontas.has(outro)) throw new Error(`${c.id}: vizinho desconhecido ${outro}`);
    let melhor = null;
    for (const a of pontas.get(c.id)) for (const b of pontas.get(outro)) {
      const d = dist(porId.get(a), porId.get(b));
      if (!melhor || d < melhor.d) melhor = { a, b, d };
    }
    ligar(melhor.a, melhor.b);
  }
}

// ---- conexões nos dois sentidos, e a saída ----
const conexoes = [...arestas].sort().map((s) => s.split('|'));
for (const n of nos) n.conexoes = [];
for (const [a, b] of conexoes) {
  porId.get(a).conexoes.push(b);
  porId.get(b).conexoes.push(a);
}
const clusters = fonte.clusters.map((c) => ({ id: c.id, nome: c.nome, dominio: c.dominio, ...polar(c.angulo, c.raio + 430) }));
const saida = {
  _nota: 'GERADO por tools/gerar-arvore-passiva.mjs a partir de clusters.json — não edite à mão (edite clusters.json e gere de novo). Lido por game/systems/passivas/arvore.mjs.',
  versao: 1,
  inicios: INICIO,
  clusters,
  nos,
  conexoes,
};
writeFileSync(new URL('arvore.json', raiz), JSON.stringify(saida, null, 1) + '\n');
const porTipo = nos.reduce((m, n) => ((m[n.tipo] = (m[n.tipo] ?? 0) + 1), m), {});
console.log(`árvore: ${nos.length} nós (${Object.entries(porTipo).map(([t, n]) => `${n} ${t}`).join(', ')}), ${conexoes.length} conexões`);
