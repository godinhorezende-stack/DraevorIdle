// A TELA do Dispositivo de Mapas (`client/src/mapas-dispositivo.mjs`): fechada mostra o porquê; aberta lista os mapas com o que o servidor
// mandou e o botão manda a peça que a tela mostrou (`onde`, `indice`, `assinatura`); com um mapa aberto o "Abrir" fica travado; desistir
// pede a confirmação na própria tela. Um DOM mínimo (o módulo só cria elementos e lê/escreve campos).
import { test } from 'node:test';
import assert from 'node:assert/strict';

class No {
  constructor(tag) {
    this.tag = tag;
    this.filhos = [];
    this.className = '';
    this.dataset = {};
    this.style = {};
    this.attrs = {};
    this.hidden = false;
    this.disabled = false;
    this.texto = '';
    this.classList = { add: (c) => (this.className = `${this.className} ${c}`.trim()), remove: () => {}, toggle: () => {} };
  }
  append(...fs) {
    for (const f of fs) this.filhos.push(f);
  }
  setAttribute(k, v) {
    this.attrs[k] = v;
  }
  get firstChild() {
    return this.filhos[0] ?? null;
  }
  set textContent(t) {
    this.filhos = [];
    this.texto = String(t);
  }
  get textContent() {
    return this.texto + this.filhos.map((f) => (f instanceof No ? f.textContent : f.data ?? '')).join('');
  }
  /** Todos os nós abaixo (inclusive), em ordem. */
  todos() {
    return [this, ...this.filhos.filter((f) => f instanceof No).flatMap((f) => f.todos())];
  }
  achar(classe) {
    return this.todos().filter((n) => ` ${n.className} `.includes(` ${classe} `));
  }
}
globalThis.document = {
  createElement: (tag) => new No(tag),
  createElementNS: (_, tag) => new No(tag),
  createTextNode: (data) => ({ data, nodeType: 3 }),
};
No.prototype.nodeType = 1;

const { desenharDispositivo, faixaDosMapas } = await import('../frontend/client/src/mapas-dispositivo.mjs');

const peca = (tier, raridade, linhas = []) => ({ id: 7_700_000 + tier, count: 1, poe: { classe: 'Maps', base: `Maps/Map_Tier_${tier}`, raridade, nome: `Mapa (Nível ${tier})`, mapa: { tier, nivel: 67 + tier, quantidade: 13, raridade: 8, grupo: 5, linhas } } });
const TIERS = Array.from({ length: 16 }, (_, i) => ({ tier: i + 1, nivel: 68 + i }));
function desenhar(mapas, faixaDaCampanha = null) {
  const enviados = [];
  let fechou = 0;
  let voltou = 0;
  const body = new No('div');
  desenharDispositivo(body, {
    mapas,
    faixaDaCampanha,
    h: { send: (m) => enviados.push(m), itemCanvas: (id) => Object.assign(new No('canvas'), { idDoItem: id }), tipFor: (n, id, _x, _s, p) => Object.assign(n, { peca: p }), voltarParaCampanha: () => voltou++, fechar: () => fechou++ },
  });
  return { body, enviados, fechou: () => fechou, voltou: () => voltou };
}

test('fechado: diz o porquê (o chefe do Ato 10) e não lista mapa nenhum', () => {
  const { body } = desenhar({ liberado: false, motivo: 'O Dispositivo de Mapas abre depois de vencer Kitava (Ato 10).', ato: 10, portais: 6, aberto: null, mapas: [], estatisticas: {}, tiers: TIERS });
  assert.match(body.textContent, /depois de vencer Kitava/);
  assert.equal(body.achar('mp-mapa').length, 0);
  assert.equal(body.achar('mp-abrir').length, 0);
});

test('liberado: cada mapa com tier, raridade, números e afixos (o parcial marcado); "Abrir" manda a peça que a tela mostrou', () => {
  const linhas = [{ texto: '+40% mais Vida de Monstros', estado: 'equivalente' }, { texto: 'Velocidade de Conjuração…', estado: 'parcial', nota: 'a velocidade de conjuração ainda não existe' }];
  const mapas = [
    { onde: 'pouch', indice: 3, assinatura: 'abc', id: 7_700_009, tier: 9, nivel: 76, raridade: 'raro', nome: 'Mapa (Nível 9)', peca: peca(9, 'raro', linhas) },
    { onde: 'inventory', indice: 0, assinatura: 'xyz', id: 7_700_002, tier: 2, nivel: 69, raridade: 'normal', nome: 'Mapa (Nível 2)', peca: peca(2, 'normal') },
  ];
  const t = desenhar({ liberado: true, ato: 10, portais: 6, aberto: null, mapas, estatisticas: { concluidos: 3, porTier: { 1: 2, 2: 1 }, maiorTier: 2, falhos: 0, mortes: 1 }, tiers: TIERS });
  const cartoes = t.body.achar('mp-mapa');
  assert.equal(cartoes.length, 2);
  assert.match(cartoes[0].textContent, /Mapa \(Nível 9\)/);
  assert.match(cartoes[0].textContent, /Raro · área nível 76 · na bolsa/);
  assert.match(cartoes[0].textContent, /\+13% quantidade/);
  assert.equal(t.body.achar('parcial').length, 1, 'a linha parcial marcada');
  assert.match(cartoes[1].textContent, /Sem afixos/);
  // O ícone leva a peça para o balão.
  assert.equal(cartoes[0].achar('mp-fig')[0].filhos[0].peca, mapas[0].peca);
  const abrir = cartoes[0].achar('mp-abrir')[0];
  assert.equal(abrir.disabled, false);
  abrir.onclick();
  assert.deepEqual(t.enviados, [{ t: 'abrirMapa', onde: 'pouch', indice: 3, assinatura: 'abc', mode: 'auto' }]);
  assert.equal(abrir.disabled, true, 'sem clique duplo');
  assert.equal(t.fechou(), 1);
  // As estatísticas: as barras dos 16 tiers.
  assert.equal(t.body.achar('mp-tierbar').length, 16);
  assert.equal(t.body.achar('feito').length, 2);
  // Voltar para a Campanha.
  t.body.achar('w2-dif')[0].onclick();
  assert.equal(t.voltou(), 1);
});

test('com um mapa aberto: portais, "Voltar ao mapa", "Abrir" travado e desistir só com a confirmação', () => {
  const aberto = { id: 'm1', tier: 5, nivel: 72, nome: 'Mapa (Nível 5)', peca: peca(5, 'magico'), portais: 4, portaisMax: 6, mortes: 2, naCacada: false, guardado: true };
  const mapas = [{ onde: 'inventory', indice: 0, assinatura: 'q', id: 7_700_003, tier: 3, nivel: 70, raridade: 'normal', nome: 'Mapa (Nível 3)', peca: peca(3, 'normal') }];
  const t = desenhar({ liberado: true, ato: 10, portais: 6, aberto, mapas, estatisticas: {}, tiers: TIERS });
  assert.match(t.body.achar('mp-aberto')[0].textContent, /4 de 6 portais · 2 mortes/);
  assert.match(t.body.achar('mp-aberto')[0].textContent, /Esperando a sua volta/);
  assert.equal(t.body.achar('aceso').length, 4);
  assert.equal(t.body.achar('mp-abrir')[0].disabled, true);
  t.body.achar('w2-entrar').find((b) => b.textContent === 'Voltar ao mapa').onclick();
  assert.deepEqual(t.enviados.at(-1), { t: 'voltarAoMapa', mode: 'auto' });
  const desistir = t.body.achar('mp-desistir')[0];
  desistir.onclick();
  assert.notEqual(t.enviados.at(-1)?.t, 'abandonarMapa', 'o primeiro clique só pergunta');
  assert.match(desistir.textContent, /Tem certeza/);
  desistir.onclick();
  assert.deepEqual(t.enviados.at(-1), { t: 'abandonarMapa' });
});

test('as abas dizem os níveis: a Campanha (Nível 1 – 69) e os Mapas (do T1 ao último tier: Nível 68 – 83)', () => {
  const t = desenhar({ liberado: true, ato: 10, portais: 6, aberto: null, mapas: [], estatisticas: {}, tiers: TIERS }, [1, 69]);
  const [campanha, mapas] = t.body.achar('w2-dif');
  assert.match(campanha.textContent, /CampanhaNível 1 – 69/);
  assert.match(mapas.textContent, /MapasNível 68 – 83/);
  assert.equal(faixaDosMapas({ tiers: TIERS }), 'Nível 68 – 83');
  assert.equal(faixaDosMapas({ tiers: [...TIERS, { tier: 17, nivel: 84 }] }), 'Nível 68 – 84', 'segue os tiers configurados');
});

