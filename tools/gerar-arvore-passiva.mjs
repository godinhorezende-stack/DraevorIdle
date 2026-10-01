// Gera a ÁRVORE DE PASSIVAS (`game/gamedata/passivas/arvore.json`) a partir dos
// clusters e dos inícios das classes (`game/gamedata/passivas/clusters.json`).
//
// A árvore é um GRAFO: nós com posição (x, y) e conexões. O motor
// (`game/systems/passivas/arvore.mjs`) só lê o arvore.json — não sabe nada de
// clusters nem de geometria —, então dá para trocar este gerador por um editor
// de árvore (arrastar nó, ligar, desligar) sem mexer no motor.
//
// A forma (versão 2, 01/10 — o estilo do Path of Exile, pedido do dono):
//   - um ANEL de atributos em volta do centro liga os cinco inícios (é por ele
//     que o Knight chega ao Fire/Spell: cross-build);
//   - cada cluster é uma RODA: o 1º notável no centro, a entrada e os pequenos
//     numa órbita em volta (ligados em arco), o 2º notável na órbita do lado de
//     fora e o keystone atrás dele;
//   - entre um início e as rodas da região dele, e entre rodas vizinhas, há
//     CAMINHOS de nós de atributo (+STR/+DEX/+INT da classe mais perto, e
//     híbridos na faixa entre duas classes) — andar pela árvore dá atributo,
//     os clusters de % são os destinos.
// Os ids dos nós de cada roda são os de antes (`<cluster>_e`, `_s1`... `_na`,
// `_nb`, `_k`), para a árvore já montada dos jogadores continuar valendo onde dá.
//
// Uso: node tools/gerar-arvore-passiva.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const raiz = new URL('../game/gamedata/passivas/', import.meta.url);
const fonte = JSON.parse(readFileSync(new URL('clusters.json', raiz), 'utf8'));

const nos = [];
const porId = new Map();
const arestas = new Set();
const rad = (g) => (g * Math.PI) / 180;
const polar = (angulo, raio, cx = 0, cy = 0) => ({ x: Math.round(cx + Math.cos(rad(angulo)) * raio), y: Math.round(cy + Math.sin(rad(angulo)) * raio) });
const anguloDe = (p) => (Math.atan2(p.y, p.x) * 180) / Math.PI;

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

// ---- o atributo de um ponto: o da classe mais perto, ou híbrido na fronteira ----
const inicios = Object.entries(fonte.inicios);
const ATRIBUTO_DA_CLASSE = fonte.anel.atributo;
const NOME_DO_ATRIBUTO = { str: 'Força', dex: 'Destreza', int: 'Inteligência' };
function atributosDoPonto(p) {
  const ang = anguloDe(p);
  const perto = inicios
    .map(([classe, i]) => ({ classe, d: Math.abs(((ang - i.angulo + 540) % 360) - 180) }))
    .sort((a, b) => a.d - b.d);
  const [a, b] = perto;
  const atrA = ATRIBUTO_DA_CLASSE[a.classe];
  const atrB = ATRIBUTO_DA_CLASSE[b.classe];
  // Na faixa do meio entre duas classes de atributos diferentes: os dois (híbrido).
  const meio = a.d / (a.d + b.d || 1);
  if (atrA !== atrB && meio > 0.5 - fonte.caminhos.faixaHibrida / 2) return [atrA, atrB].sort();
  return [atrA];
}
function noDeAtributo(id, p, extra = {}) {
  const atrs = atributosDoPonto(p);
  const hibrido = atrs.length > 1;
  const valor = hibrido ? fonte.caminhos.hibrido : fonte.caminhos.valor;
  return no({
    id,
    nome: atrs.map((a) => NOME_DO_ATRIBUTO[a]).join(' e '),
    tipo: 'small',
    atributo: atrs.join('+'),
    ...p,
    cluster: 'caminho',
    dominio: null,
    tags: ['atributo', ...atrs],
    efeitos: atrs.map((a) => ({ add: a, valor })),
    ...extra,
  });
}

// ---- o anel de atributos ----
const anel = fonte.anel;
for (let i = 0; i < anel.nos; i++) {
  const angulo = -90 + (360 * i) / anel.nos;
  const p = polar(angulo, anel.raio);
  const n = noDeAtributo(`anel_${i}`, p, { cluster: 'anel', orbita: { x: 0, y: 0, r: anel.raio } });
  // O anel é das classes, sem híbrido: o atributo da classe mais perto (como antes).
  const atr = atributosDoPonto({ x: p.x * 3, y: p.y * 3 })[0];
  Object.assign(n, { nome: NOME_DO_ATRIBUTO[atr], atributo: atr, tags: ['atributo', atr], efeitos: [{ add: atr, valor: anel.valor }] });
  if (i > 0) ligar(`anel_${i - 1}`, `anel_${i}`);
}
ligar(`anel_${anel.nos - 1}`, 'anel_0');
const anelMaisPerto = (p) => nos.filter((n) => n.cluster === 'anel').reduce((m, n) => (!m || dist(n, p) < dist(m, p) ? n : m), null);

// ---- as rodas (clusters) ----
// A órbita: 10 lugares em volta do centro, começando pela ENTRADA (virada para o
// centro da árvore) e girando; o 2º notável cai do lado de fora (lugar 5).
const ORBITA = ['e', 's1', 'a1', 'a2', 'a3', 'nb', 'b3', 'b2', 'b1', 's2'];
const PEQUENOS = ['e', 's1', 's2', 'a1', 'a2', 'a3', 'b1', 'b2', 'b3'];
const roda = fonte.roda;
const rodas = new Map(); // cluster -> { centro, nosDaOrbita }
for (const c of fonte.clusters) {
  const ponto = polar(c.angulo, c.raio);
  const centro = polar(c.angulo, c.raio + roda.afastamento);
  const orbita = { x: centro.x, y: centro.y, r: roda.raio };
  const comum = { cluster: c.id, dominio: c.dominio, icone: c.id };
  const id = (k) => `${c.id}_${k}`;
  ORBITA.forEach((k, i) => {
    const p = polar(c.angulo + 180 + i * (360 / ORBITA.length), roda.raio, centro.x, centro.y);
    if (k === 'nb') {
      const n = c.notaveis[1];
      no({ id: id(k), nome: n.nome, tipo: 'notable', ...p, ...comum, orbita, tags: [...c.tags], efeitos: n.efeitos, ...(n.flavor ? { flavor: n.flavor } : {}), ...(n.descricao ? { descricao: n.descricao } : {}) });
    } else {
      const efeitos = c.pequenos[PEQUENOS.indexOf(k) % c.pequenos.length];
      no({ id: id(k), nome: c.nome, tipo: 'small', ...p, ...comum, orbita, tags: [...c.tags], efeitos });
    }
  });
  const n0 = c.notaveis[0];
  no({ id: id('na'), nome: n0.nome, tipo: 'notable', ...centro, ...comum, tags: [...c.tags], efeitos: n0.efeitos, ...(n0.flavor ? { flavor: n0.flavor } : {}), ...(n0.descricao ? { descricao: n0.descricao } : {}) });
  if (c.keystone) {
    no({
      id: id('k'),
      nome: c.keystone.nome,
      descricao: c.keystone.descricao,
      ...(c.keystone.flavor ? { flavor: c.keystone.flavor } : {}),
      tipo: 'keystone',
      ...polar(c.angulo, roda.raio + roda.keystone, centro.x, centro.y),
      ...comum,
      tags: [...c.tags, 'keystone'],
      levelMinimo: c.keystone.levelMinimo ?? 60,
      efeitos: c.keystone.efeitos ?? [],
      keystone: c.keystone.keystone,
    });
  }
  // A órbita fechada em arco; o centro pelos dois lados (a3 e b3); o keystone atrás do 2º notável.
  ORBITA.forEach((k, i) => ligar(id(k), id(ORBITA[(i + 1) % ORBITA.length])));
  ligar(id('na'), id('a3'));
  ligar(id('na'), id('b3'));
  if (c.keystone) ligar(id('nb'), id('k'));
  rodas.set(c.id, { ponto, centro, orbita: ORBITA.map(id) });
}

// ---- os caminhos de atributo ----
/** Liga `a` a `b` por nós de atributo em linha reta (um a cada `passo`). */
function caminho(de, ate, prefixo) {
  const d = dist(de, ate);
  const n = Math.max(fonte.caminhos.min, Math.min(fonte.caminhos.max, Math.round(d / fonte.caminhos.passo) - 1));
  let anterior = de.id;
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    const p = { x: Math.round(de.x + (ate.x - de.x) * t), y: Math.round(de.y + (ate.y - de.y) * t) };
    const atual = noDeAtributo(`${prefixo}_${i}`, p);
    ligar(anterior, atual.id);
    anterior = atual.id;
  }
  ligar(anterior, ate.id);
}

// Os inícios: ao anel, e por caminhos às ENTRADAS das rodas da região.
const INICIO = {};
for (const [classe, i] of inicios) {
  const n = no({ id: `inicio_${classe}`, nome: i.nome, tipo: 'start', ...polar(i.angulo, i.raio), cluster: 'inicio', dominio: null, classe, tags: ['inicio', classe], efeitos: [] });
  INICIO[classe] = n.id;
  ligar(n.id, anelMaisPerto(n).id);
  for (const c of i.clusters) caminho(n, porId.get(`${c}_e`), `via_${classe}_${c}`);
}

// Vizinhos: pelos nós de órbita mais próximos, com um caminho entre eles.
const feitos = new Set();
for (const c of fonte.clusters) {
  for (const outro of c.perto ?? []) {
    if (!rodas.has(outro)) throw new Error(`${c.id}: vizinho desconhecido ${outro}`);
    const par = [c.id, outro].sort().join('~');
    if (feitos.has(par)) continue;
    feitos.add(par);
    let melhor = null;
    for (const a of rodas.get(c.id).orbita) for (const b of rodas.get(outro).orbita) {
      const d = dist(porId.get(a), porId.get(b));
      if (!melhor || d < melhor.d) melhor = { a, b, d };
    }
    caminho(porId.get(melhor.a), porId.get(melhor.b), `via_${[c.id, outro].sort().join('_')}`);
  }
}

// ---- conexões nos dois sentidos, e a saída ----
const conexoes = [...arestas].sort().map((s) => s.split('|'));
for (const n of nos) n.conexoes = [];
for (const [a, b] of conexoes) {
  porId.get(a).conexoes.push(b);
  porId.get(b).conexoes.push(a);
}
const clusters = fonte.clusters.map((c) => ({ id: c.id, nome: c.nome, dominio: c.dominio, ...rodas.get(c.id).centro, raio: roda.raio }));
const saida = {
  _nota: 'GERADO por tools/gerar-arvore-passiva.mjs a partir de clusters.json — não edite à mão (edite clusters.json e gere de novo). Lido por game/systems/passivas/arvore.mjs.',
  versao: 2,
  inicios: INICIO,
  clusters,
  nos,
  conexoes,
};
writeFileSync(new URL('arvore.json', raiz), JSON.stringify(saida, null, 1) + '\n');
const porTipo = nos.reduce((m, n) => ((m[n.atributo ? 'atributo' : n.tipo] = (m[n.atributo ? 'atributo' : n.tipo] ?? 0) + 1), m), {});
console.log(`árvore: ${nos.length} nós (${Object.entries(porTipo).map(([t, n]) => `${n} ${t}`).join(', ')}), ${conexoes.length} conexões; híbridos: ${nos.filter((n) => n.atributo?.includes('+')).length}`);
