// ZERAR A ÁRVORE — LOTE 38 (dono, 16/10: o "Mercenário completo", a TELA — `frontend/client/src/mercenarios.mjs`) ligada ao servidor de verdade
// (`systems/itens-poe/mercenarios.mjs`, `Acoes.fichaDoMercenario`) por uma fila no lugar do WebSocket: abre e pede a tela; sem o nó, o aviso;
// com o nó, os candidatos com o preço (a primeira grátis da transição); contrata; o cartão com a ficha (vida e as gemas), os 10 encaixes e as
// ações; dá uma peça da mochila (a regra do servidor), tira a sua de volta, deixa e leva, revive, despede em dois cliques. DOM mínimo; o desenho
// do item, o balão e a célula da mochila são trocados por versões vazias. E o botão no menu Sistemas e a resposta `mercenarios` no `main.mjs`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { register } from 'node:module';

const VAZIOS = {
  './sprites.mjs': "export const itemCanvas = (id) => { const c = document.createElement('canvas'); c.dataset.id = String(id); return c; };",
  './tooltip.mjs': 'export const tipFor = (el, id, extra) => { el.dataset.tip = String(id); if (extra) el.dataset.tipExtra = extra; }; export const tipTexto = (el, t) => { el.dataset.tipTexto = t; };',
  './inventory.mjs': "export const vestirRaridade = (cell) => cell.classList.add('raridade');",
};
register(`data:text/javascript,${encodeURIComponent(`
const VAZIOS = ${JSON.stringify(VAZIOS)};
export async function resolve(spec, ctx, next) {
  if (ctx.parentURL?.endsWith('/mercenarios.mjs') && ctx.parentURL.includes('/frontend/') && VAZIOS[spec]) return { url: 'data:text/javascript,' + encodeURIComponent(VAZIOS[spec]), shortCircuit: true };
  return next(spec, ctx);
}`)}`, import.meta.url);

class No {
  constructor(tag) {
    this.tag = tag;
    this.filhos = [];
    this.className = '';
    this.dataset = {};
    this.disabled = false;
    this.texto = '';
    this.classList = {
      add: (...cs) => (this.className = [...new Set([...this.className.split(' ').filter(Boolean), ...cs])].join(' ')),
      contains: (c) => this.className.split(' ').includes(c),
    };
  }
  append(...fs) { this.filhos.push(...fs); }
  replaceChildren(...fs) { this.filhos = [...fs]; this.texto = ''; }
  get children() { return this.filhos; }
  set textContent(t) { this.filhos = []; this.texto = String(t); }
  get textContent() { return this.texto + this.filhos.map((f) => (f instanceof No ? f.textContent : '')).join(''); }
  todos() { return [this, ...this.filhos.filter((f) => f instanceof No).flatMap((f) => f.todos())]; }
  achar(classe) { return this.todos().filter((n) => n.className.split(' ').includes(classe)); }
  botao(texto) { return this.todos().find((n) => n.tag === 'button' && (texto instanceof RegExp ? texto.test(n.textContent) : n.textContent === texto)); }
  clicar() {
    assert.equal(this.disabled, false, `clique num botão desligado: ${this.textContent}`);
    this.onclick?.({ stopPropagation() {}, preventDefault() {} });
  }
}
globalThis.document = { createElement: (tag) => new No(tag) };

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no jogo oficial (PoE)';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const Gerar = await import('../systems/itens-poe/gerar.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Acoes = await import('../systems/acoes.mjs');
const Merc = await import('../systems/itens-poe/mercenarios.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  Jogo.iniciar(ITEM_CATALOG);
}
const Tela = SEM ? null : await import('../frontend/client/src/mercenarios.mjs');
const ANEL = Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'might ring')?.id);
const copia = (x) => JSON.parse(JSON.stringify(x));
const peca = (base) => Jogo.pecaDoJogo(Gerar.gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 20, rng: () => 0.5 }));

/** O jogo montado: o personagem no "servidor", o estado da tela, a fila e a janela. Cada mensagem passa pelo servidor de verdade. */
function montar({ no = true, gratis = false } = {}) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 40 }), { sistema: 'poe', classePoe: 'Scion', gold: 1_000_000, bank: 0 });
  e.equipment.ring = { id: ANEL, count: 1, af: [], poe: { af: no ? { mercenario: 1 } : {} } };
  e.inventory = [peca('Body_Armours/Plate_Vest'), peca('Bows/Crude_Bow')];
  P.garantir(e);
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  if (gratis) Merc.migrar(e, Ficha.combate(e).afPoe);
  const items = Object.fromEntries(Object.entries(ITEM_CATALOG).filter(([, i]) => i?.poe));
  const state = { character: {}, items };
  const erros = [];
  const sync = () => Object.assign(state.character, copia({ inventory: e.inventory, gold: e.gold, bank: e.bank }));
  sync();
  const body = new No('div');
  const ctx = {
    state, redraw: null,
    send: (m) => {
      assert.equal(m.t, 'mercenario');
      const af = (Ficha.invalidar(e), Ficha.combate(e).afPoe);
      if (m.action && m.action !== 'ver') {
        const r = Merc.comando(e, m, af);
        if (!r.ok) erros.push(r.erro);
      }
      sync();
      Tela.chegouMercenarios(Merc.paraCliente(e, af, (merc) => Acoes.fichaDoMercenario(e, merc, af)));
    },
    openModal: (titulo, build, onClose, variante) => {
      Object.assign(ctx, { titulo, variante, fechar: onClose });
      build(body);
    },
  };
  Tela.abrirMercenarios(ctx);
  return { e, ctx, body, erros };
}

test('o botão no menu Sistemas e a resposta `mercenarios` (main.mjs, panels.mjs)', { skip: SEM }, () => {
  const main = readFileSync(new URL('../frontend/client/src/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /id: 'mercenarios', label: 'Mercenários'[^\n]*abre: \(\) => openMercenarios\(\)/);
  assert.match(main, /case 'mercenarios':\s*\n\s*chegouMercenarios\(message\)/);
  assert.match(readFileSync(new URL('../frontend/client/src/panels.mjs', import.meta.url), 'utf8'), /export function openMercenarios\(\) \{\s*\n\s*abrirMercenarios\(ctx\)/);
});

test('sem o nó: a janela abre com o aviso, sem candidatos', { skip: SEM }, () => {
  const { body, ctx } = montar({ no: false });
  assert.equal(ctx.titulo, 'Mercenários');
  assert.match(body.textContent, /pede o nó "Você pode contratar um mercenário de forma permanente"/);
  body.botao('Contratar').clicar();
  assert.equal(body.achar('merc-card').length, 0);
});

test('CONTRATAR pela tela: os candidatos com o preço (a primeira grátis da transição); o contratado ao seu lado, com a ficha e os encaixes', { skip: SEM }, () => {
  const { e, body, erros } = montar({ gratis: true });
  body.botao('Contratar').clicar();
  const cards = body.achar('merc-card');
  assert.equal(cards.length, 3);
  assert.match(body.textContent, /A sua primeira contratação é grátis/);
  const b = cards[0].botao(/^Contratar \(grátis\)$/);
  assert.ok(b, 'o preço: grátis');
  b.clicar();
  assert.deepEqual(erros, []);
  assert.equal(e.gold, 1_000_000, 'de graça');
  assert.equal(Merc.dados(e).contratados.length, 1);
  // a segunda já tem preço
  assert.ok(body.achar('merc-card')[0].botao(/^Contratar \([\d.]+ de ouro\)$/));
  body.botao('Contratados').clicar();
  const [card] = body.achar('merc-card');
  const m = Merc.dados(e).contratados[0];
  assert.match(card.textContent, new RegExp(`${m.nome}.*nível ${m.nivel}.*Ao seu lado`));
  assert.match(card.textContent, /Vida: [\d.]+/);
  assert.equal(card.achar('merc-habilidades')[0].filhos.length, 2, 'as duas gemas do arquétipo');
  assert.equal(card.achar('merc-encaixe').length, 10);
});

test('DAR, TIRAR, DEIXAR, LEVAR, REVIVER e DESPEDIR pela tela', { skip: SEM }, () => {
  const { e, body, erros, ctx } = montar();
  const d = Merc.dados(e);
  // um bárbaro de nível 40 (veste as Placas; não usa arco)
  d.contratados.push({ ...Merc.candidato(40, () => 0.5), arquetipo: 'barbaro', equipment: {}, doJogador: {} });
  d.ativo = d.contratados[0].id;
  const m = d.contratados[0];
  ctx.send({ t: 'mercenario', action: 'ver' });
  body.botao('Contratados').clicar();
  body.botao('Dar peça da mochila').clicar();
  const pecas = body.achar('merc-peca');
  assert.equal(pecas.length, 2, 'as duas peças do PoE da mochila');
  // o arco: o servidor recusa (a arma do arquétipo)
  pecas.find((c) => /Arco|Bow/i.test(ITEM_CATALOG[Number(c.dataset.tip)]?.name ?? '') || ITEM_CATALOG[Number(c.dataset.tip)]?.poe?.classe === 'Bows').clicar();
  assert.match(erros.pop(), /arma/);
  // as Placas: entram
  body.achar('merc-peca').find((c) => ITEM_CATALOG[Number(c.dataset.tip)]?.poe?.classe === 'Body_Armours').clicar();
  assert.deepEqual(erros, []);
  assert.ok(m.equipment.body && m.doJogador.body);
  assert.equal(e.inventory.length, 1);
  const sua = body.achar('merc-encaixe').find((c) => c.achar('merc-sua').length);
  assert.ok(sua, 'a marca "sua"');
  sua.clicar();
  assert.equal(e.inventory.length, 2, 'tirou: voltou para a mochila');
  // deixar e levar
  body.botao('Deixar').clicar();
  assert.equal(d.ativo, null);
  assert.match(body.textContent, /Na reserva/);
  body.botao('Levar comigo').clicar();
  assert.equal(d.ativo, m.id);
  // morto: o botão de reviver com o preço
  Merc.morreu(e, m.id);
  ctx.send({ t: 'mercenario', action: 'ver' });
  const reviver = body.botao(/^Reviver \(10\.000 de ouro\)$/);
  assert.ok(reviver, '250 × 40');
  reviver.clicar();
  assert.equal(m.morto, false);
  // despedir: dois cliques
  body.botao('Despedir').clicar();
  assert.equal(d.contratados.length, 1, 'o primeiro clique só pede a confirmação');
  body.botao('Confirmar: despedir').clicar();
  assert.equal(d.contratados.length, 0);
  assert.match(body.textContent, /Nenhum mercenário contratado ainda/);
});
