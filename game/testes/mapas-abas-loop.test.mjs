// As ABAS por tier, os mapas IGUAIS num cartão "×N" e o LOOP de mapas (dono, 27/10: "uma aba por mapa e os mapas que forem iguais aparecer
// ×1 ×2 a quantidade; fazer em loop de mapa — ficar repetindo até acabar — o mapa escolhido ou vários mapas escolhidos").
//   - a parte pura da tela (`client/src/mapas-grupos.mjs`): o agrupamento (iguais juntam, diferentes não), as abas e as contagens, a seleção;
//   - a chave dos iguais no servidor (`itens-poe/mapas-loop.mjs → chaveDoMapa`);
//   - a tela (`client/src/mapas-dispositivo.mjs`, com um DOM mínimo): o selo ×N, as abas, a caixa do loop e o "Iniciar loop" / "Parar loop";
//   - o loop no servidor (`mapas-dispositivo.mjs → iniciarLoop/seguirLoop`): abre o próximo ao concluir, para ao falhar ou ao sair, pula o
//     mapa que sumiu, sobrevive a gravar e ler o personagem, e segue na caçada offline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';

// ---------------------------------------------------------------- um DOM mínimo (o mesmo jeito de `mapas-dispositivo-tela.test.mjs`)
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
  todos() {
    return [this, ...this.filhos.filter((f) => f instanceof No).flatMap((f) => f.todos())];
  }
  achar(classe) {
    return this.todos().filter((n) => ` ${n.className} `.includes(` ${classe} `));
  }
}
No.prototype.nodeType = 1;
globalThis.document = {
  createElement: (tag) => new No(tag),
  createElementNS: (_, tag) => new No(tag),
  createTextNode: (data) => ({ data, nodeType: 3 }),
};

const { agruparMapas, abasDosMapas, abaValida, gruposDaAba, resumoDaSelecao, rotuloDoGrupo } = await import('../frontend/client/src/mapas-grupos.mjs');
const { desenharDispositivo, esquecerMemoria } = await import('../frontend/client/src/mapas-dispositivo.mjs');

const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no jogo oficial (PoE)';
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Dispositivo = await import('../systems/mapas-dispositivo.mjs');
const MapaAberto = await import('../systems/itens-poe/mapa-aberto.mjs');
const MapasLoop = await import('../systems/itens-poe/mapas-loop.mjs');
const Mapas = await import('../systems/itens-poe/mapas.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const Bolsa = await import('../systems/bolsa.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');

// ---------------------------------------------------------------- a parte pura

/** Um mapa como o servidor manda para a tela (`mapasCarregados`). */
const naTela = (tier, raridade, chave, { onde = 'inventory', indice = 0, unico = false } = {}) => ({
  onde, indice, assinatura: `a${tier}${indice}`, chave, id: 7_700_000 + tier, tier, nivel: 67 + tier, raridade: unico ? 'unico' : raridade,
  nome: unico ? 'Torre Esquecida' : `Mapa (Nível ${tier})`, peca: { id: 7_700_000 + tier, poe: { mapa: { linhas: [] } } },
});

test('agrupar: os iguais (a mesma chave) viram um grupo ×N na ordem do servidor; os diferentes ficam separados; sem chave, cada um sozinho', () => {
  const lista = [
    naTela(4, 'magico', 'k4m', { indice: 0 }),
    naTela(3, 'normal', 'k3n', { indice: 1 }),
    naTela(3, 'normal', 'k3n', { indice: 2 }),
    naTela(3, 'normal', 'k3n', { onde: 'pouch', indice: 0 }),
    naTela(3, 'raro', 'k3r-a', { indice: 3 }),
    naTela(3, 'raro', 'k3r-b', { indice: 4 }),
  ];
  const g = agruparMapas(lista);
  assert.deepEqual(g.map((x) => [x.chave, x.qtd]), [['k4m', 1], ['k3n', 3], ['k3r-a', 1], ['k3r-b', 1]]);
  assert.equal(g[1].mapas[0].indice, 1, 'o "Abrir mapa" abre o primeiro do grupo');
  assert.equal(g[1].naBolsa, 1);
  // Servidor antigo (sem chave): nada se junta.
  const velhos = agruparMapas([{ ...lista[1], chave: undefined }, { ...lista[2], chave: undefined }]);
  assert.equal(velhos.length, 2);
  assert.equal(rotuloDoGrupo(g[1], 3), 'T3 Normal ×3');
});

test('abas: "Todos" e um tier por aba só dos que você tem (T1 → T16), mais "Únicos"; a contagem é de mapas, não de grupos', () => {
  const g = agruparMapas([
    naTela(16, 'raro', 'a'),
    naTela(3, 'normal', 'b'), naTela(3, 'normal', 'b'), naTela(3, 'magico', 'c'),
    naTela(1, 'normal', 'd'),
    naTela(5, null, 'u', { unico: true }),
  ]);
  const abas = abasDosMapas(g);
  assert.deepEqual(abas.map((a) => `${a.rotulo} ×${a.qtd}`), ['Todos ×6', 'T1 ×1', 'T3 ×3', 'T16 ×1', 'Únicos ×1']);
  assert.deepEqual(gruposDaAba(g, 't3').map((x) => x.chave), ['b', 'c']);
  assert.deepEqual(gruposDaAba(g, 'unicos').map((x) => x.chave), ['u'], 'o único fica na aba dele');
  assert.equal(gruposDaAba(g, 'todos').length, 5);
  assert.equal(abaValida(abas, 't3'), 't3');
  assert.equal(abaValida(abas, 't9'), 'todos', 'a aba que sumiu volta para Todos');
  assert.deepEqual(abasDosMapas([]).map((a) => a.id), ['todos']);
});

test('seleção do loop: só os grupos que existem, na ordem da tela; "todos" (null) ou o número, sem passar do que há', () => {
  const g = agruparMapas([naTela(3, 'normal', 'b'), naTela(3, 'normal', 'b'), naTela(3, 'normal', 'b'), naTela(4, 'magico', 'c')]);
  const sel = new Map([['c', null], ['b', 2], ['sumiu', null]]);
  assert.deepEqual(resumoDaSelecao(g, sel), { grupos: [{ chave: 'b', quantos: 2 }, { chave: 'c', quantos: null }], mapas: 3 });
  assert.deepEqual(resumoDaSelecao(g, new Map([['b', 99]])), { grupos: [{ chave: 'b', quantos: 3 }], mapas: 3 });
  assert.deepEqual(resumoDaSelecao(g, new Map()), { grupos: [], mapas: 0 });
});

// ---------------------------------------------------------------- a tela

const TIERS = Array.from({ length: 16 }, (_, i) => ({ tier: i + 1, nivel: 68 + i }));
function desenhar(mapas) {
  const enviados = [];
  const body = new No('div');
  desenharDispositivo(body, {
    mapas: { liberado: true, ato: 10, portais: 6, aberto: null, estatisticas: {}, tiers: TIERS, ...mapas },
    h: { send: (m) => enviados.push(m), itemCanvas: (id) => Object.assign(new No('canvas'), { idDoItem: id }), tipFor: () => {}, voltarParaCampanha: () => {}, fechar: () => {} },
  });
  return { body, enviados };
}
const texto = (n) => n.textContent;

test('tela: um cartão por grupo com o selo ×N, abas com a contagem; a aba escolhida filtra e é lembrada', () => {
  esquecerMemoria();
  const lista = [naTela(4, 'magico', 'c', { indice: 0 }), naTela(3, 'normal', 'b', { indice: 1 }), naTela(3, 'normal', 'b', { indice: 2 }), naTela(3, 'normal', 'b', { onde: 'pouch', indice: 0 })];
  const t = desenhar({ mapas: lista });
  assert.equal(t.body.achar('mp-mapa').length, 2);
  assert.deepEqual(t.body.achar('mp-qtd').map(texto), ['×1', '×3']);
  assert.match(texto(t.body.achar('mp-mapa')[1]), /Normal · área nível 70 · 1 na bolsa/);
  assert.match(texto(t.body.achar('mp-titulo')[0]), /Seus mapas \(4\)/);
  assert.deepEqual(t.body.achar('mp-aba').map(texto), ['Todos×4', 'T3×3', 'T4×1']);
  // "Abrir mapa" abre o primeiro do grupo.
  t.body.achar('mp-abrir')[1].onclick();
  assert.deepEqual(t.enviados.at(-1), { t: 'abrirMapa', onde: 'inventory', indice: 1, assinatura: 'a31', mode: 'auto' });
  // A aba T3: só o grupo do T3; redesenhada (a campanha chega de novo), continua nela.
  t.body.achar('mp-aba')[1].onclick();
  assert.equal(t.body.achar('mp-mapa').length, 1);
  assert.match(t.body.achar('mp-aba ativa').map(texto).join(), /T3/);
  const de_novo = desenhar({ mapas: lista });
  assert.equal(de_novo.body.achar('mp-mapa').length, 1, 'a aba é lembrada');
  esquecerMemoria();
});

test('tela: marcar grupos (com quantos usar) e "Iniciar loop" manda a fila; travado com mapa aberto', () => {
  esquecerMemoria();
  const lista = [naTela(4, 'magico', 'c', { indice: 0 }), naTela(3, 'normal', 'b', { indice: 1 }), naTela(3, 'normal', 'b', { indice: 2 }), naTela(3, 'normal', 'b', { indice: 3 })];
  const t = desenhar({ mapas: lista });
  const iniciar = () => t.body.achar('mp-iniciar')[0];
  assert.equal(iniciar().disabled, true, 'nada marcado');
  // Marca o T3 ×3 e escolhe 2.
  const caixa = t.body.achar('mp-caixa')[1];
  caixa.checked = true;
  caixa.onchange();
  const qtd = t.body.achar('mp-quantos')[0];
  assert.equal(qtd.placeholder, 'todos');
  qtd.value = '2';
  qtd.onchange();
  // E o T4 (todos).
  const c4 = t.body.achar('mp-caixa')[0];
  c4.checked = true;
  c4.onchange();
  assert.match(texto(t.body.achar('mp-barra-texto')[0]), /2 grupos · 3 mapas no loop/);
  assert.equal(t.body.achar('marcado').length, 2);
  assert.equal(iniciar().disabled, false);
  iniciar().onclick();
  assert.deepEqual(t.enviados.at(-1), { t: 'iniciarLoopDeMapas', grupos: [{ chave: 'c', quantos: null }, { chave: 'b', quantos: 2 }], mode: 'auto' });
  // Com um mapa aberto, o loop não começa.
  const aberto = { id: 'm1', tier: 5, nivel: 72, nome: 'Mapa (Nível 5)', peca: { poe: {} }, portais: 6, portaisMax: 6, mortes: 0, naCacada: true, guardado: false };
  const t2 = desenhar({ mapas: lista, aberto });
  t2.body.achar('mp-caixa')[0].checked = true;
  t2.body.achar('mp-caixa')[0].onchange();
  assert.equal(t2.body.achar('mp-iniciar')[0].disabled, true);
  esquecerMemoria();
});

test('tela: o loop rodando mostra "Loop: 3 de 8 — T3 Normal ×5, T4 Mágico ×3" e o "Parar loop"; as caixas travam', () => {
  esquecerMemoria();
  const loop = { ativo: true, feitos: 2, total: 8, numero: 3, atual: 'm9', pendente: false, grupos: [{ chave: 'b', rotulo: 'T3 Normal ×5' }, { chave: 'c', rotulo: 'T4 Mágico ×3' }], fim: null };
  const t = desenhar({ mapas: [naTela(3, 'normal', 'b')], loop });
  assert.match(texto(t.body.achar('mp-loop')[0]), /Loop: 3 de 8 — T3 Normal ×5, T4 Mágico ×3/);
  assert.equal(t.body.achar('mp-loop-barra')[0].firstChild.style.width, '25%');
  assert.equal(t.body.achar('mp-caixa')[0].disabled, true);
  assert.equal(t.body.achar('mp-iniciar')[0].disabled, true);
  t.body.achar('mp-parar')[0].onclick();
  assert.deepEqual(t.enviados.at(-1), { t: 'pararLoopDeMapas' });
  // Parado: o porquê no topo da lista.
  const parado = desenhar({ mapas: [], loop: { ativo: false, fim: { motivo: 'O mapa falhou (os portais acabaram): o loop parou.', feitos: 1, concluiu: false } } });
  assert.match(texto(parado.body.achar('mp-loop-fim')[0]), /falhou/);
  assert.equal(parado.body.achar('mp-loop').length, 0);
});

// ---------------------------------------------------------------- o servidor

/** O personagem dos testes de mapas (`mapas-endgame.test.mjs`): a campanha até o Ato 10, vida que não acaba e um Machado Vaal. */
function personagem() {
  const e = personagemDeTeste({ vocacao: 'knight', level: 90 });
  e.equipment = { ...(e.equipment ?? {}), weapon: Jogo.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Two_Hand_Axes/Vaal_Axe', raridade: 'normal', ilvl: 64, rng: () => 0.5 })) };
  e.hp = e.maxHp = 1e9;
  for (const d of Object.keys(e.campanha)) e.campanha[d].bosses = Array.from({ length: 10 }, (_, i) => i + 1);
  Bolsa.garantir(e);
  return e;
}
const todos = (e) => [...e.hunt.monstros, ...Object.values(e.hunt.outrosAndares ?? {}).flat()];
const normal = (tier) => Jogo.mapaSorteado(tier, { raridade: 'normal' });
const chave = (peca) => MapasLoop.chaveDoMapa(peca);
/** Limpa o mapa da caçada (100%) e anda os tiques até a caçada dele acabar (a pausa do "concluído"): devolve a caçada de depois. */
function concluir(e, relogio) {
  const id = e.hunt.mapa.id;
  for (const m of todos(e)) m.hp = 0;
  for (let i = 0; i < 400 && e.hunt?.mapa?.id === id; i++) Cacadas.tique(e, PERSONAGEM, (relogio.agora += 250));
  return e.hunt;
}
/** Os mapas que o chefe derrubou ficam de fora (a contagem da fila fica a do teste). */
const semDrops = (e) => (e.pouch = e.pouch.filter((p) => !Mapas.ehMapa(p)));

test('chave dos iguais: a mesma base, raridade, qualidade e afixos juntam; tier, afixo, qualidade ou corrompido diferentes separam', { skip: SEM }, () => {
  const a = normal(3);
  const b = normal(3);
  assert.notEqual(a.id === b.id && a === b, true);
  assert.equal(chave(a), chave(b), 'dois T3 Normais sem afixo são iguais');
  assert.notEqual(chave(a), chave(normal(4)), 'outro tier');
  const q = structuredClone(a);
  q.poe.qualidade = 10;
  assert.notEqual(chave(a), chave(q), 'qualidade');
  const c = structuredClone(a);
  c.poe.corrompido = true;
  assert.notEqual(chave(a), chave(c), 'corrompido');
  const m1 = Jogo.mapaSorteado(3, { raridade: 'magico', rng: () => 0.1 });
  const m2 = structuredClone(m1);
  assert.equal(chave(m1), chave(m2), 'o mesmo Mágico (os mesmos afixos) junta');
  const mod = [...(m2.poe.prefixos ?? []), ...(m2.poe.sufixos ?? [])][0];
  assert.ok(mod, 'o Mágico tem afixo');
  mod.texto = `${mod.texto} (outro valor)`;
  assert.notEqual(chave(m1), chave(m2), 'afixo com outro valor separa');
  // A tela recebe a chave.
  const e = personagem();
  e.inventory.push(a, b, normal(4));
  const t = Dispositivo.paraTela(e);
  assert.equal(new Set(t.mapas.map((m) => m.chave)).size, 2);
});

test('loop: abre o primeiro; ao concluir, o próximo abre sozinho (o mesmo caminho do "Abrir"); acabou a fila, o loop termina', { skip: SEM }, () => {
  const e = personagem();
  const t3 = [normal(3), normal(3)];
  const t4 = normal(4);
  e.inventory.push(...t3, t4, normal(3));
  // (com números: "todos" também usaria os iguais que o chefe derruba no caminho — o teste quer a fila exata)
  const r = Dispositivo.iniciarLoop(e, { grupos: [{ chave: chave(t3[0]), quantos: 2 }, { chave: chave(t4), quantos: 1 }], mode: 'auto' });
  assert.ok(r.ok, r.erro);
  assert.match(r.notice, /Loop de mapas: Mapa \(Nível 3\) \(1 de 3\)/);
  assert.equal(e.hunt.mapa.tier, 3);
  assert.equal(e.mapas.loop.atual.mapaId, e.mapas.aberto.id);
  assert.equal(e.inventory.filter((p) => Mapas.ehMapa(p)).length, 3, 'a peça aberta saiu (como no "Abrir")');
  let tela = Dispositivo.paraTela(e).loop;
  assert.deepEqual([tela.numero, tela.total, tela.feitos], [1, 3, 0]);
  assert.deepEqual(tela.grupos.map((g) => g.rotulo), ['T3 Normal ×2', 'T4 Normal ×1']);
  // Outro "Iniciar" ou o "Abrir" no meio: recusados (um mapa aberto).
  assert.match(Dispositivo.iniciarLoop(e, { grupos: [{ chave: chave(t4) }] }).erro, /mapa aberto/);

  const relogio = { agora: Date.now() };
  const primeiro = e.hunt.mapa.id;
  concluir(e, relogio);
  semDrops(e);
  assert.ok(e.hunt?.mapa && e.hunt.mapa.id !== primeiro, 'o segundo abriu sozinho');
  assert.equal(e.hunt.mapa.tier, 3);
  assert.equal(e.mapas.concluidos, 1);
  assert.equal(e.mapas.loop.feitos, 1);
  assert.match(e.avisoDaHunt ?? '', /Loop de mapas: .*\(2 de 3\)/);
  assert.equal(e.mapas.loop.seguir, true, 'a sessão traz a party que segue o líder');
  concluir(e, relogio);
  semDrops(e);
  assert.equal(e.hunt?.mapa?.tier, 4, 'o T3 deu os 2 escolhidos; agora o T4');
  tela = Dispositivo.paraTela(e).loop;
  assert.deepEqual([tela.numero, tela.total, tela.feitos], [3, 3, 2]);
  concluir(e, relogio);
  assert.equal(e.hunt, null, 'a fila acabou: de volta à cidade');
  assert.equal(e.mapas.loop, null);
  assert.equal(e.mapas.loopFim.concluiu, true);
  assert.match(e.mapas.loopFim.motivo, /Loop de mapas concluído: 3 mapas/);
  assert.equal(e.mapas.concluidos, 3);
  assert.equal(e.inventory.filter((p) => Mapas.ehMapa(p)).length, 1, 'o terceiro T3 (fora do número escolhido) ficou');
});

test('loop: o mapa que FALHA (os 6 portais) para o loop; morrer com portal sobrando não', { skip: SEM }, () => {
  const e = personagem();
  const p = [normal(2), normal(2), normal(2)];
  e.inventory.push(...p);
  assert.ok(Dispositivo.iniciarLoop(e, { grupos: [{ chave: chave(p[0]) }] }).ok);
  MapaAberto.guardarAoSair(e, { morreu: true });
  e.hunt = null;
  assert.ok(e.mapas.loop, 'com portal sobrando o loop espera a volta');
  assert.equal(Dispositivo.paraTela(e).loop.ativo, true);
  for (let i = 0; i < 5; i++) {
    if (!e.hunt) assert.ok(Dispositivo.voltar(e, { mode: 'auto' }).ok);
    MapaAberto.guardarAoSair(e, { morreu: true });
    e.hunt = null;
  }
  assert.equal(e.mapas.aberto, null);
  assert.equal(e.mapas.ultimo.resultado, 'falhou');
  assert.equal(e.mapas.loop, null, 'o loop parou');
  assert.match(e.mapas.loopFim.motivo, /falhou/);
  assert.equal(e.inventory.filter((x) => Mapas.ehMapa(x)).length, 2, 'os outros mapas ficaram');
});

test('loop: sair do mapa por conta própria (parar, outra caçada) ou abandonar para o loop; "Parar loop" deixa o mapa aberto', { skip: SEM }, () => {
  const e = personagem();
  const p = [normal(2), normal(2), normal(2)];
  e.inventory.push(...p);
  assert.ok(Dispositivo.iniciarLoop(e, { grupos: [{ chave: chave(p[0]) }] }).ok);
  Cacadas.sair(e);
  assert.equal(e.mapas.loop, null);
  assert.match(e.mapas.loopFim.motivo, /saiu do mapa/);
  assert.ok(e.mapas.aberto, 'o mapa continua aberto (parar não gasta)');
  assert.ok(Dispositivo.abandonar(e).ok);

  assert.ok(Dispositivo.iniciarLoop(e, { grupos: [{ chave: chave(p[0]) }] }).ok);
  assert.ok(Dispositivo.abandonar(e).ok);
  assert.match(e.mapas.loopFim.motivo, /abandonou/);

  const q = normal(2);
  e.inventory.push(q);
  assert.ok(Dispositivo.iniciarLoop(e, { grupos: [{ chave: chave(q) }] }).ok);
  assert.ok(Dispositivo.pararLoop(e).ok);
  assert.equal(e.mapas.loop, null);
  assert.ok(e.hunt?.mapa && e.mapas.aberto, 'o mapa aberto continua');
  assert.match(Dispositivo.pararLoop(e).erro, /não está rodando/);

  // Sair na PAUSA do concluído (antes de o próximo abrir) também para.
  Dispositivo.abandonar(e);
  e.inventory.push(normal(2), normal(2));
  assert.ok(Dispositivo.iniciarLoop(e, { grupos: [{ chave: chave(q) }] }).ok);
  for (const m of todos(e)) m.hp = 0;
  const relogio = { agora: Date.now() };
  for (let i = 0; i < 3; i++) Cacadas.tique(e, PERSONAGEM, (relogio.agora += 250));
  assert.equal(e.mapas.loop.pendente, true, 'concluído: o próximo espera a pausa');
  Cacadas.sair(e);
  assert.equal(e.mapas.loop, null);
  assert.equal(e.hunt, null, 'nenhum mapa abriu');
});

test('loop: o mapa que sumiu (vendido, trocado) sai da fila sem quebrar; sem nenhum, o loop nem começa', { skip: SEM }, () => {
  const e = personagem();
  // (Mágicos com os mesmos afixos: um mapa que o chefe derrube no caminho não é igual a eles)
  const m3 = Jogo.mapaSorteado(3, { raridade: 'magico', rng: () => 0.1 });
  const t3 = [m3, structuredClone(m3)];
  const t5 = Jogo.mapaSorteado(5, { raridade: 'magico', rng: () => 0.1 });
  e.inventory.push(...t3, t5);
  assert.ok(Dispositivo.iniciarLoop(e, { grupos: [{ chave: chave(t3[0]) }, { chave: chave(t5) }] }).ok);
  // O outro T3 some da mochila (vendido) enquanto o primeiro roda.
  e.inventory = e.inventory.filter((p) => !(Mapas.ehMapa(p) && Mapas.tierDaPeca(p) === 3));
  const relogio = { agora: Date.now() };
  concluir(e, relogio);
  semDrops(e);
  assert.equal(e.hunt?.mapa?.tier, 5, 'pulou para o T5');
  // O T5 muda de lugar na mochila: a fila acha pela chave, não pela posição.
  concluir(e, relogio);
  assert.equal(e.mapas.loop, null);
  assert.equal(e.mapas.loopFim.feitos, 2);
  assert.match(Dispositivo.iniciarLoop(e, { grupos: [{ chave: 'nao-existe' }] }).erro, /não estão mais com você/);
  assert.match(Dispositivo.iniciarLoop(e, { grupos: [] }).erro, /Marque/);
  assert.equal(e.mapas.loop, null);
});

test('loop: as travas de hoje (o dispositivo fechado não começa nada)', { skip: SEM }, () => {
  const e = personagem();
  for (const d of Object.keys(e.campanha)) e.campanha[d].bosses = [1, 2, 3];
  const p = normal(1);
  e.inventory.push(p);
  assert.match(Dispositivo.iniciarLoop(e, { grupos: [{ chave: chave(p) }] }).erro, /Ato 10/);
  assert.equal(e.mapas?.loop ?? null, null);
  assert.ok(e.inventory.includes(p));
});

/** O personagem vai para o banco e volta (a caçada compactada, como no save — `huntParaGravar`/`huntAoCarregar`). */
function gravarELer(e) {
  const lido = JSON.parse(JSON.stringify({ ...e, hunt: Cacadas.huntParaGravar(e.hunt) }));
  lido.hunt = Cacadas.huntAoCarregar(lido.hunt);
  return lido;
}

test('loop: sobrevive a gravar e ler o personagem (no meio do mapa e na pausa do concluído)', { skip: SEM }, () => {
  const e = personagem();
  const p = [normal(2), normal(2), normal(2)];
  e.inventory.push(...p);
  assert.ok(Dispositivo.iniciarLoop(e, { grupos: [{ chave: chave(p[0]), quantos: 3 }] }).ok);
  // Gravado e lido no meio do mapa: o mesmo loop, o mesmo mapa aberto, e ao concluir o próximo abre.
  let lido = gravarELer(e);
  assert.equal(lido.mapas.loop.atual.mapaId, lido.mapas.aberto.id);
  assert.equal(lido.hunt.mapa.id, lido.mapas.aberto.id);
  const relogio = { agora: Date.now() };
  concluir(lido, relogio);
  semDrops(lido);
  assert.equal(lido.mapas.loop.feitos, 1);
  assert.ok(lido.hunt?.mapa, 'o próximo abriu');
  // De novo, agora na PAUSA do concluído: gravado e lido, o próximo abre quando a pausa acaba.
  for (const m of todos(lido)) m.hp = 0;
  for (let i = 0; i < 3; i++) Cacadas.tique(lido, PERSONAGEM, (relogio.agora += 250));
  assert.equal(lido.mapas.loop.pendente, true);
  const id = lido.hunt.mapa.id;
  lido = gravarELer(lido);
  for (let i = 0; i < 400 && lido.hunt?.mapa?.id === id; i++) Cacadas.tique(lido, PERSONAGEM, (relogio.agora += 250));
  semDrops(lido);
  assert.ok(lido.hunt?.mapa && lido.hunt.mapa.id !== id, 'o terceiro abriu depois de gravar e ler');
  assert.equal(lido.mapas.loop.feitos, 2);
  assert.equal(Dispositivo.paraTela(lido).loop.numero, 3);
});

test('loop offline: o mapa concluído na caçada offline abre o próximo, e a ausência continua nele (o mesmo relatório)', { skip: SEM }, () => {
  const e = personagem();
  const p = [normal(1), normal(1)];
  e.inventory.push(...p);
  assert.ok(Dispositivo.iniciarLoop(e, { grupos: [{ chave: chave(p[0]), quantos: 2 }] }).ok);
  const primeiro = e.hunt.mapa.id;
  // Sobram dois monstros de um golpe: offline, ele limpa o primeiro (como em `mapas-endgame.test.mjs`).
  const sobram = todos(e).filter((m) => m.hp > 0).slice(0, 2);
  for (const m of todos(e)) if (!sobram.includes(m)) m.hp = 0;
  for (const m of sobram) m.hp = m.maxHp = 1;
  const inicio = Date.now();
  e.hunt.offlineDesde = inicio;
  Cacadas.consolidarAusencia(e, PERSONAGEM, inicio + 3 * 3_600_000);
  assert.equal(e.mapas.loop?.feitos ?? e.mapas.loopFim?.feitos, e.mapas.concluidos);
  assert.ok(e.mapas.concluidos >= 1, 'o primeiro concluiu offline');
  if (e.mapas.loop) {
    assert.ok(e.hunt?.mapa && e.hunt.mapa.id !== primeiro, 'o segundo abriu offline');
    assert.equal(e.hunt.mapa.id, e.mapas.loop.atual.mapaId);
    assert.ok(e.hunt.ausencia, 'a ausência seguiu no mapa novo');
    assert.ok(e.hunt.offlineDesde <= inicio + 30 * 60_000 + 1000, 'até os 30 min simulados');
  } else {
    assert.equal(e.mapas.loopFim.concluiu, true, 'os dois concluídos offline');
  }
  // O login fecha a ausência inteira (com o relatório).
  const volta = Cacadas.simularAusencia(e, PERSONAGEM, inicio + 3 * 3_600_000);
  assert.ok(volta?.report, 'o relatório da ausência');
});
