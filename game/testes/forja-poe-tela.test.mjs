// A TELA da Forja do PoE reformulada (`frontend/client/src/forja-poe.mjs`) ligada ao servidor de verdade (`systems/itens-poe/forja.mjs`) por
// uma fila no lugar do WebSocket: abre na peça vestida, pede as opções, escolhe o material, configura o resultado (sem deixar configurar o
// impossível), forja uma vez, repete em lotes (um por vez: o próximo passo só depois da resposta), cancela, ignora a resposta repetida e
// a de outra repetição, troca de peça pelo inventário e de categoria pelo material, e cancela ao fechar no meio. DOM mínimo (o módulo só
// cria elementos e lê/escreve campos); o desenho do item, o balão e a célula da mochila são trocados por versões vazias.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { register } from 'node:module';

// ---- os imports do navegador: `/packages/shared/src/` é a pasta `engine/`; sprites, balão e mochila viram versões vazias
const ENGINE = new URL('../engine/', import.meta.url).href;
const VAZIOS = {
  './sprites.mjs': "export const itemCanvas = (id) => { const c = document.createElement('canvas'); c.dataset.id = String(id); return c; };",
  './tooltip.mjs': 'export const tipFor = (el, id, extra) => { el.dataset.tip = String(id); if (extra) el.dataset.tipExtra = extra; }; export const tipTexto = (el, t) => { el.dataset.tipTexto = t; };',
  './inventory.mjs': "export const vestirRaridade = (cell) => cell.classList.add('raridade'); export const selarSoquetes = () => {};",
};
register(`data:text/javascript,${encodeURIComponent(`
const ENGINE = ${JSON.stringify(ENGINE)};
const VAZIOS = ${JSON.stringify(VAZIOS)};
export async function resolve(spec, ctx, next) {
  if (spec.startsWith('/packages/shared/src/')) return { url: ENGINE + spec.slice(21), shortCircuit: true };
  if (ctx.parentURL?.endsWith('/forja-poe.mjs') && VAZIOS[spec]) return { url: 'data:text/javascript,' + encodeURIComponent(VAZIOS[spec]), shortCircuit: true };
  return next(spec, ctx);
}`)}`, import.meta.url);

// ---- o DOM mínimo
class No {
  constructor(tag) {
    this.tag = tag;
    this.filhos = [];
    this.className = '';
    this.dataset = {};
    this.attrs = {};
    this.disabled = false;
    this.texto = '';
    this.value = '';
    const estilo = {};
    this.style = Object.assign(estilo, { setProperty: (k, v) => (estilo[k] = v) });
    this.classList = {
      add: (...cs) => (this.className = [...new Set([...this.className.split(' ').filter(Boolean), ...cs])].join(' ')),
      remove: (c) => (this.className = this.className.split(' ').filter((x) => x !== c).join(' ')),
      contains: (c) => this.className.split(' ').includes(c),
    };
  }
  append(...fs) {
    for (const f of fs) this.filhos.push(f);
  }
  replaceChildren(...fs) {
    this.filhos = [...fs];
    this.texto = '';
  }
  setAttribute(k, v) {
    this.attrs[k] = v;
  }
  get childNodes() {
    return this.filhos;
  }
  set textContent(t) {
    this.filhos = [];
    this.texto = String(t);
  }
  get textContent() {
    return this.texto + this.filhos.map((f) => (f instanceof No ? f.textContent : f?.data ?? '')).join('');
  }
  set innerHTML(_) {
    this.filhos = [];
    this.texto = '';
  }
  todos() {
    return [this, ...this.filhos.filter((f) => f instanceof No).flatMap((f) => f.todos())];
  }
  achar(classe) {
    return this.todos().filter((n) => n.className.split(' ').includes(classe));
  }
  clicar() {
    assert.equal(this.disabled, false, `clique num botão desligado: ${this.textContent}`);
    this.onclick?.({ stopPropagation() {}, preventDefault() {} });
  }
}
globalThis.document = { createElement: (tag) => new No(tag), createTextNode: (data) => ({ data, nodeType: 3 }) };
globalThis.Option = class extends No {
  constructor(texto, valor) {
    super('option');
    this.texto = texto;
    this.value = valor;
  }
};

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no jogo oficial (PoE)';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const Gerar = await import('../systems/itens-poe/gerar.mjs');
const M = await import('../systems/itens-poe/moedas.mjs');
const F = await import('../systems/itens-poe/forja.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  Jogo.iniciar(ITEM_CATALOG);
}
const Tela = SEM ? null : await import('../frontend/client/src/forja-poe.mjs');

function rngDe(semente) {
  let s = semente >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}
const gerar = (base, raridade, ilvl, semente = 1) => Jogo.pecaDoJogo(Gerar.gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade, ilvl, rng: rngDe(semente) }));
const soquetes = (abertos, cores = Array(6).fill('R')) => ({ abertos, links: Array(5).fill(false), gemas: Array(6).fill(null), cores });
const copia = (x) => JSON.parse(JSON.stringify(x));

/** O jogo montado: o personagem no "servidor", o estado da tela, a fila de mensagens e a janela. */
function montar({ moedas = { Jewellers_Orb: 200, Chromatic_Orb: 300, Exalted_Orb: 2 } } = {}) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 100 });
  const corpo = gerar('Body_Armours/Plate_Vest', 'raro', 80, 3);
  corpo.soquetes = soquetes(2);
  e.equipment.body = corpo;
  const bota = gerar('Boots/Bronzescale_Boots', 'raro', 60, 4);
  bota.soquetes = soquetes(3);
  e.inventory = [bota, ...Object.entries(moedas).map(([slug, n]) => ({ id: M.idDa(slug), count: n }))];
  const items = Object.fromEntries(Object.entries(ITEM_CATALOG).filter(([, i]) => i?.moedaPoe || i?.poe || i?.gemaDef));
  const state = { character: { ...copia({ equipment: e.equipment, inventory: e.inventory }), equipment: copia(e.equipment) }, items };
  const fila = [];
  const enviadas = [];
  let guardado = null;
  let fechar = null;
  const body = new No('div');
  const rng = rngDe(77);
  const ctx = {
    state, tabs: {}, redraw: null,
    send: (m) => {
      enviadas.push(m);
      fila.push(m);
    },
    openModal: (titulo, build, onClose, variante) => {
      Object.assign(ctx, { titulo, variante });
      fechar = onClose;
      build(body);
    },
    acoesDoModal: () => new No('div'),
    seloDoModal: () => new No('div'),
  };
  /** O "servidor" responde UMA mensagem da fila (como o WebSocket: na ordem). */
  function responder() {
    const m = fila.shift();
    if (!m) return false;
    if (m.t === 'forjaOpcoes') Tela.chegouForjaOpcoes({ t: 'forjaOpcoes', ...F.opcoes(e, m) });
    else if (m.t === 'forjaRepetir' || m.t === 'forjaCancelar') {
      const r = m.t === 'forjaRepetir' ? F.repetir(e, guardado, m, rng) : F.cancelar(guardado, m.id);
      guardado = r.guardado;
      if (r.mudou) {
        state.character = copia({ equipment: e.equipment, inventory: e.inventory });
        ctx.redraw?.();
      }
      Tela.chegouForjaResultado({ t: 'forjaResultado', ...r.resposta });
    }
    return true;
  }
  /** Deixa o tempo do "pedir as opções" correr e responde tudo o que estiver na fila. */
  function andar(max = 200) {
    for (let i = 0; i < max; i++) {
      mock.timers.tick(200);
      if (!responder() && !fila.length) {
        mock.timers.tick(200);
        if (!fila.length) return;
      }
    }
  }
  return { e, state, ctx, body, fila, enviadas, responder, andar, fechar: () => fechar?.(), corpo, bota };
}
const porTexto = (raiz, classe, texto) => raiz.achar(classe).find((n) => n.textContent.includes(texto));
/** O seletor (− n +) da linha de cor: o botão `sinal`. */
const passoDaCor = (j, cor, sinal) => j.body.achar('fp-cor').find((n) => n.textContent.includes(cor))?.achar('fp-passo').find((b) => b.textContent === sinal);
/** Pede EXATAMENTE as cores dadas (`{ Azul: 2 }`): zera as outras pelo "−" e sobe pelo "+" (a tela guarda o desejo da sessão). */
function pedirCores(j, pedido) {
  for (const cor of ['Vermelho', 'Verde', 'Azul']) {
    for (let b = passoDaCor(j, cor, '−'); b && !b.disabled; b = passoDaCor(j, cor, '−')) {
      b.clicar();
      j.andar();
    }
  }
  for (const [cor, n] of Object.entries(pedido)) {
    for (let i = 0; i < n; i++) {
      passoDaCor(j, cor, '+').clicar();
      j.andar();
    }
  }
}
const quantas = (e, slug) => e.inventory.filter((x) => x.id === M.idDa(slug)).reduce((t, x) => t + (x.count ?? 1), 0);
const ultimaDe = (j, t) => j.enviadas.findLast((m) => m.t === t);

test('abrir: a janela larga da Forja na peça vestida, as categorias em grupos (só texto), o inventário e o material escolhido sozinho', { skip: SEM }, async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const j = montar();
    Tela.abrirForjaPoe(j.ctx);
    assert.equal(j.ctx.titulo, 'Forja');
    assert.equal(j.ctx.variante, 'forja-poe');
    j.andar();
    const op = ultimaDe(j, 'forjaOpcoes');
    assert.deepEqual(op.alvo, { onde: 'equipment', slot: 'body' }, 'abre na peça vestida');
    assert.equal(op.categoria, 'sockets');
    assert.equal(op.moeda, M.idDa('Jewellers_Orb'), 'o material da categoria escolhido sozinho');
    // As categorias em grupos, só texto (dono, 12/10: "tire essas imgs, pode confundir").
    const Regras = await import('../engine/forja-poe.mjs');
    assert.equal(j.body.achar('fp-cat').length, Regras.CATEGORIAS.length);
    assert.deepEqual(j.body.achar('fp-grupo-nome').map((n) => n.textContent), Regras.GRUPOS.map((g) => g.nome));
    assert.ok(j.body.achar('fp-trilho')[0].todos().every((n) => n.tag !== 'canvas'), 'nenhum desenho de moeda no trilho');
    assert.ok(j.body.achar('fp-celula').length >= 1, 'o inventário mostra as peças');
    assert.ok(j.body.achar('fp-mat').some((b) => b.className.includes('escolhida')), 'a barra mostra o material escolhido');
    assert.ok(porTexto(j.body, 'fp-legenda', 'Agora: 2 de 6'), 'a peça: 2 sockets de 6');
  } finally {
    mock.timers.reset();
  }
});

test('Forjar: uma tentativa pelo servidor; o estado volta e a tela mostra o resultado e o gasto', { skip: SEM }, () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const j = montar();
    Tela.abrirForjaPoe(j.ctx);
    j.andar();
    j.body.achar('fp-forjar')[0].clicar();
    const m = ultimaDe(j, 'forjaRepetir');
    assert.equal(m.passo, 0);
    assert.equal(m.modo, 'uma');
    assert.equal(m.desejo, null, 'Forjar é uma tentativa, sem desejo');
    j.andar();
    assert.equal(quantas(j.e, 'Jewellers_Orb'), 199, 'o servidor gastou uma');
    const prog = j.body.achar('fp-progresso')[0];
    assert.ok(prog.textContent.includes('1 tentativa'), prog.textContent);
    assert.ok(prog.textContent.includes('1× '), 'o gasto aparece');
    assert.equal(j.enviadas.filter((x) => x.t === 'forjaRepetir').length, 1, 'uma mensagem só');
  } finally {
    mock.timers.reset();
  }
});

test('Configurar resultado e repetir até atingir: o desejo vai ao servidor; os lotes andam um por vez até a parada', { skip: SEM }, () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const j = montar();
    Tela.abrirForjaPoe(j.ctx);
    j.andar();
    porTexto(j.body, 'fp-botao', 'Configurar resultado').clicar();
    // O seletor de sockets até 4 (a tela guarda o desejo da sessão: anda pelo número mostrado).
    for (let i = 0; i < 6 && j.body.achar('fp-numero')[0].textContent !== '4'; i++) {
      const sinal = Number(j.body.achar('fp-numero')[0].textContent) < 4 ? '+' : '−';
      j.body.achar('fp-passo').find((b) => b.textContent === sinal).clicar();
      j.andar();
    }
    assert.deepEqual(ultimaDe(j, 'forjaOpcoes').desejo, { abertos: 4 });
    porTexto(j.body, 'fp-segmento', 'Até atingir').filhos.find((b) => b.textContent.includes('Até atingir')).clicar();
    j.body.achar('fp-repetir')[0].clicar();
    const primeira = ultimaDe(j, 'forjaRepetir');
    assert.equal(primeira.modo, 'ate');
    assert.deepEqual(primeira.desejo, { abertos: 4 });
    // Um por vez: com a primeira ainda sem resposta, nenhuma outra sai.
    j.responder();
    assert.ok(j.fila.length <= 1, 'no máximo o próximo passo na fila');
    j.andar(400);
    const passos = j.enviadas.filter((x) => x.t === 'forjaRepetir').map((x) => x.passo);
    assert.deepEqual(passos, passos.map((_, i) => i), 'os passos em ordem, sem pular nem repetir');
    assert.ok(j.enviadas.filter((x) => x.t === 'forjaRepetir' && x.passo > 0).every((x) => Object.keys(x).sort().join() === 'id,passo,t'), 'os passos seguintes só levam id e passo');
    const prog = j.body.achar('fp-progresso')[0].textContent;
    assert.ok(/Resultado alcançado|Sem material/.test(prog), prog);
    if (/Resultado alcançado/.test(prog)) assert.ok(j.e.equipment.body.soquetes.abertos >= 4);
  } finally {
    mock.timers.reset();
  }
});

test('Configuração impossível não passa: as cores somam no máximo os sockets abertos (o "+" desliga); sem desejo, o Repetir "até atingir" fica desligado', { skip: SEM }, () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const j = montar();
    Tela.abrirForjaPoe(j.ctx);
    j.andar();
    porTexto(j.body, 'fp-cat', 'Cores').clicar();
    j.andar();
    porTexto(j.body, 'fp-segmento', 'Até atingir').filhos.find((b) => b.textContent.includes('Até atingir')).clicar();
    porTexto(j.body, 'fp-botao', 'Configurar resultado').clicar();
    pedirCores(j, {});
    porTexto(j.body, 'fp-botao', 'Configurar resultado').clicar();
    assert.equal(j.body.achar('fp-repetir')[0].disabled, true, 'sem cor pedida não repete');
    porTexto(j.body, 'fp-botao', 'Configurar resultado').clicar();
    pedirCores(j, { Azul: 2 });
    // 2 sockets abertos, 2 azuis pedidos: nenhum "+" liga mais.
    for (const linha of j.body.achar('fp-cor')) assert.equal(linha.achar('fp-passo').find((b) => b.textContent === '+').disabled, true, linha.textContent);
    assert.ok(!j.body.achar('fp-cor').some((n) => n.textContent.includes('Branco')), 'o branco não aparece para o Cromático');
    assert.deepEqual(ultimaDe(j, 'forjaOpcoes').desejo, { R: 0, G: 0, B: 2, W: 0 });
    assert.equal(j.body.achar('fp-repetir')[0].disabled, false, 'com o desejo válido, repete');
  } finally {
    mock.timers.reset();
  }
});

test('Cancelar: o lote em andamento termina, o próximo passo não sai, e a tela mostra "Cancelado"; o material que não repete desliga os modos', { skip: SEM }, () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const j = montar();
    j.corpo.soquetes = soquetes(6);
    j.state.character.equipment.body.soquetes = soquetes(6);
    Tela.abrirForjaPoe(j.ctx);
    j.andar();
    porTexto(j.body, 'fp-cat', 'Cores').clicar();
    j.andar();
    if (!j.body.achar('fp-cor').length) porTexto(j.body, 'fp-botao', 'Configurar resultado').clicar();
    pedirCores(j, { Azul: 6 });
    porTexto(j.body, 'fp-segmento', 'Até atingir').filhos.find((b) => b.textContent.includes('Até atingir')).clicar();
    j.body.achar('fp-repetir')[0].clicar();
    j.responder(); // o primeiro lote
    const enviadosAntes = j.enviadas.filter((x) => x.t === 'forjaRepetir').length;
    const cancelar = j.body.achar('fp-cancelar')[0];
    if (!cancelar) return; // (os seis azuis saíram no primeiro lote: nada a cancelar)
    cancelar.clicar();
    assert.equal(ultimaDe(j, 'forjaCancelar').id, ultimaDe(j, 'forjaRepetir').id);
    j.andar();
    assert.equal(j.enviadas.filter((x) => x.t === 'forjaRepetir').length, enviadosAntes, 'nenhum passo depois do cancelar');
    const prog = j.body.achar('fp-progresso')[0].textContent;
    assert.ok(/Cancelado|Resultado alcançado/.test(prog), prog);
    // O Exaltado (Atributos) é de uma tentativa: os modos de repetição desligam.
    porTexto(j.body, 'fp-cat', 'Atributos').clicar();
    j.andar();
    const exaltado = j.body.achar('fp-mat').find((b) => b.attrs['aria-label']?.startsWith(ITEM_CATALOG[M.idDa('Exalted_Orb')].name));
    exaltado.clicar();
    j.andar();
    const seg = porTexto(j.body, 'fp-segmento', 'Até atingir');
    assert.equal(seg.filhos.find((b) => b.textContent.includes('Até atingir')).disabled, true);
    assert.equal(seg.filhos.find((b) => b.textContent.includes('Uma tentativa')).disabled, false);
  } finally {
    mock.timers.reset();
  }
});

test('A tela ignora a resposta repetida e a de outra repetição; fechar a janela no meio cancela', { skip: SEM }, () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const j = montar();
    j.corpo.soquetes = soquetes(6);
    j.state.character.equipment.body.soquetes = soquetes(6);
    Tela.abrirForjaPoe(j.ctx);
    j.andar();
    porTexto(j.body, 'fp-cat', 'Cores').clicar();
    j.andar();
    if (!j.body.achar('fp-cor').length) porTexto(j.body, 'fp-botao', 'Configurar resultado').clicar();
    pedirCores(j, { Verde: 6 });
    porTexto(j.body, 'fp-segmento', 'Limite').filhos.find((b) => b.textContent.includes('Limite')).clicar();
    // O limite (o campo da tela): 200 — mais que um lote, para fechar com a repetição no meio.
    const campo = j.body.achar('fp-limite')[0].filhos.find((n) => n.tag === 'input');
    campo.value = '200';
    campo.onchange();
    j.body.achar('fp-repetir')[0].clicar();
    assert.equal(ultimaDe(j, 'forjaRepetir').limite, 200);
    const id = ultimaDe(j, 'forjaRepetir').id;
    const antes = j.enviadas.length;
    // De outra repetição e a repetida: nada muda, nada sai.
    Tela.chegouForjaResultado({ t: 'forjaResultado', id: 'outra', passo: 0, feitas: 99, fim: true, motivo: 'atingiu' });
    Tela.chegouForjaResultado({ t: 'forjaResultado', id, passo: 0, feitas: 99, fim: true, motivo: 'atingiu', duplicada: true });
    assert.equal(j.enviadas.length, antes);
    assert.ok(j.body.achar('fp-cancelar').length === 1, 'continua rodando');
    // Fechar no meio: a tela pede o cancelar (e a resposta dele encerra a repetição).
    j.fechar();
    assert.equal(ultimaDe(j, 'forjaCancelar')?.id, id);
    const passos = j.enviadas.filter((x) => x.t === 'forjaRepetir').length;
    j.andar();
    assert.equal(j.enviadas.filter((x) => x.t === 'forjaRepetir').length, passos, 'nenhum passo depois de fechar');
    // Reaberta, a Forja mostra a repetição encerrada (e os botões soltos).
    Tela.abrirForjaPoe(j.ctx);
    j.andar();
    assert.equal(j.body.achar('fp-cancelar').length, 0, 'parou');
    assert.ok(/Cancelado|Resultado alcançado/.test(j.body.achar('fp-progresso')[0]?.textContent ?? ''), 'o fim aparece');
  } finally {
    mock.timers.reset();
  }
});

test('O inventário escolhe a peça (sem fechar a Forja) e a aba Materiais escolhe o material e a categoria dele', { skip: SEM }, () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const j = montar();
    Tela.abrirForjaPoe(j.ctx);
    j.andar();
    porTexto(j.body, 'fp-abas', 'Inventário').filhos.find((b) => b.textContent === 'Inventário').clicar();
    const bota = j.body.achar('fp-celula')[0];
    bota.clicar();
    j.andar();
    assert.deepEqual(ultimaDe(j, 'forjaOpcoes').alvo, { onde: 'inventory', indice: 0 }, 'a bota da mochila');
    assert.ok(j.body.achar('fp-peca-nome')[0].textContent.length > 0);
    porTexto(j.body, 'fp-abas', 'Materiais').filhos.find((b) => b.textContent === 'Materiais').clicar();
    const cromatico = j.body.achar('fp-celula').find((c) => c.filhos.some((f) => f.dataset?.id === String(M.idDa('Chromatic_Orb'))));
    cromatico.clicar();
    j.andar();
    const op = ultimaDe(j, 'forjaOpcoes');
    assert.equal(op.categoria, 'cores');
    assert.equal(op.moeda, M.idDa('Chromatic_Orb'));
    assert.ok(j.body.achar('fp-cat').find((b) => b.className.includes('ativa')).textContent.includes('Cores'));
  } finally {
    mock.timers.reset();
  }
});
