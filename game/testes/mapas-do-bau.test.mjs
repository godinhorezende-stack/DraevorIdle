// OS MAPAS DO BAÚ (dono, 27/10: "é possível utilizar mapas do baú também? hoje só o que está no inventário"). O Dispositivo de Mapas lista e
// abre também os mapas do DEPÓSITO do personagem — as caixas numeradas e as Chegadas —, direto de lá (como no PoE), sem passar pela mochila:
//   - abrir do depósito tira a peça da caixa certa e acerta a contagem "N/100" (`tipos`);
//   - a assinatura errada recusa; um `onde` inventado (caixa que não há, a da conta, um número) recusa;
//   - o BAÚ DA CONTA fica de fora (é de todos os personagens da conta): não lista, não abre, não entra no loop — a tela só diz quantos há lá;
//   - o loop usa a mochila, depois a bolsa, depois o depósito, e procura a peça de novo a cada mapa;
//   - a tela junta as três origens no mesmo cartão ×N e diz de onde vêm ("1 no baú · 1 na bolsa").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';

// ---------------------------------------------------------------- um DOM mínimo (o mesmo jeito de `mapas-abas-loop.test.mjs`)
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

const { agruparMapas, ondeDoGrupo, origemDoMapa } = await import('../frontend/client/src/mapas-grupos.mjs');
const { desenharDispositivo, esquecerMemoria } = await import('../frontend/client/src/mapas-dispositivo.mjs');

const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no jogo oficial (PoE)';
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Dispositivo = await import('../systems/mapas-dispositivo.mjs');
const MapasLoop = await import('../systems/itens-poe/mapas-loop.mjs');
const Mapas = await import('../systems/itens-poe/mapas.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const Bolsa = await import('../systems/bolsa.mjs');
const Deposito = await import('../systems/deposito.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');

/** O personagem dos testes de mapas (`mapas-abas-loop.test.mjs`): a campanha até o Ato 10, vida que não acaba, um Machado Vaal e o depósito. */
function personagem() {
  const e = personagemDeTeste({ vocacao: 'knight', level: 90 });
  e.equipment = { ...(e.equipment ?? {}), weapon: Jogo.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Two_Hand_Axes/Vaal_Axe', raridade: 'normal', ilvl: 64, rng: () => 0.5 })) };
  e.hp = e.maxHp = 1e9;
  for (const d of Object.keys(e.campanha)) e.campanha[d].bosses = Array.from({ length: 10 }, (_, i) => i + 1);
  Bolsa.garantir(e);
  Deposito.garantir(e);
  return e;
}
const normal = (tier) => Jogo.mapaSorteado(tier, { raridade: 'normal' });
const chave = (peca) => MapasLoop.chaveDoMapa(peca);
const caixa = (e, indice) => e.deposito.find((c) => c.indice === indice);
/** Põe a peça numa caixa numerada (como o `store` do depósito: a peça inteira, `count` 1) e acerta a contagem. */
function guardar(e, indice, peca) {
  const c = caixa(e, indice);
  c.itens.push({ ...peca, count: 1 });
  c.tipos = c.itens.length;
  return c.itens.at(-1);
}
const todos = (e) => [...e.hunt.monstros, ...Object.values(e.hunt.outrosAndares ?? {}).flat()];
function concluir(e, relogio) {
  const id = e.hunt.mapa.id;
  for (const m of todos(e)) m.hp = 0;
  for (let i = 0; i < 400 && e.hunt?.mapa?.id === id; i++) Cacadas.tique(e, PERSONAGEM, (relogio.agora += 250));
  return e.hunt;
}
const semDrops = (e) => (e.pouch = e.pouch.filter((p) => !Mapas.ehMapa(p)));

// ---------------------------------------------------------------- o servidor

test('abrir do depósito: a peça sai da caixa certa (as outras ficam) e a contagem "N/100" acompanha; das Chegadas também', { skip: SEM }, () => {
  const e = personagem();
  const t2 = guardar(e, 2, normal(2));
  const t3 = guardar(e, 2, normal(3));
  const outra = guardar(e, 5, normal(3));
  assert.equal(caixa(e, 2).tipos, 2);
  const naTela = Dispositivo.mapasCarregados(e).find((m) => m.peca === t3);
  assert.ok(naTela, 'o mapa da caixa aparece na lista');
  assert.equal(naTela.onde, 'depot:2');
  assert.equal(naTela.origem, 'deposito');
  assert.equal(naTela.caixa, 'Caixa III');
  assert.equal(naTela.indice, 1);
  const r = Dispositivo.abrir(e, { onde: naTela.onde, indice: naTela.indice, assinatura: naTela.assinatura, mode: 'auto' });
  assert.ok(r.ok, r.erro);
  assert.equal(e.hunt.mapa.tier, 3);
  assert.equal(e.mapas.aberto.peca.poe.base, t3.poe.base);
  assert.deepEqual(caixa(e, 2).itens, [t2], 'só a peça aberta saiu da Caixa III');
  assert.equal(caixa(e, 2).tipos, 1, 'a contagem da caixa acompanha');
  assert.deepEqual(caixa(e, 5).itens, [outra], 'a outra caixa não mudou');
  Dispositivo.abandonar(e);

  // As Chegadas (o que chega da Store e do Mercado): `onde` 'chegadas'.
  const chegou = normal(4);
  Deposito.porNasChegadas(e, chegou);
  const daChegada = Dispositivo.mapasCarregados(e).find((m) => m.onde === 'chegadas');
  assert.ok(daChegada);
  assert.equal(daChegada.tier, 4);
  assert.ok(Dispositivo.abrir(e, { onde: 'chegadas', indice: daChegada.indice, assinatura: daChegada.assinatura, mode: 'auto' }).ok);
  const chegadas = e.deposito.find((c) => c.indice === Deposito.INDICE_DAS_CHEGADAS);
  assert.equal(chegadas.itens.filter((p) => Mapas.ehMapa(p)).length, 0);
  assert.equal(chegadas.tipos, chegadas.itens.length);
});

test('a assinatura errada (o mapa mudou de lugar) recusa e não gasta nada', { skip: SEM }, () => {
  const e = personagem();
  const a = guardar(e, 0, normal(3));
  const b = guardar(e, 0, normal(5));
  const sa = Dispositivo.assinatura(a);
  // A tela mostrou o T3 no índice 0, mas ele foi tirado: no 0 agora está o T5.
  caixa(e, 0).itens.splice(0, 1);
  caixa(e, 0).tipos = 1;
  const r = Dispositivo.abrir(e, { onde: 'depot:0', indice: 0, assinatura: sa, mode: 'auto' });
  assert.equal(r.ok, false);
  assert.match(r.erro, /mudou de lugar/);
  assert.equal(Dispositivo.abrir(e, { onde: 'depot:0', indice: 0, mode: 'auto' }).ok, false, 'sem assinatura também não');
  assert.deepEqual(caixa(e, 0).itens, [b]);
  assert.equal(e.hunt ?? null, null);
  assert.equal(e.mapas?.aberto ?? null, null);
});

test('onde ou caixa inventados recusam: caixa que não há, a da conta, número no lugar do texto, índice fora', { skip: SEM }, () => {
  const e = personagem();
  const p = guardar(e, 1, normal(3));
  const s = Dispositivo.assinatura(p);
  for (const onde of ['depot:99', 'depot:17', `depot:${Deposito.INDICE_DA_CONTA}`, 'depot:-1', 'depot:1.0', 'depot:', 'deposito', 'bauDaConta', 'compartilhada', 'equipment', '__proto__', 1, null, { onde: 'depot:1' }]) {
    const r = Dispositivo.abrir(e, { onde, indice: 0, assinatura: s, mode: 'auto' });
    assert.equal(r.ok, false, `onde ${JSON.stringify(onde)}`);
    assert.match(r.erro, /não está com você/);
  }
  for (const indice of [1, -1, 99, '0x', 0.5, undefined]) {
    const r = Dispositivo.abrir(e, { onde: 'depot:1', indice, assinatura: s, mode: 'auto' });
    assert.equal(r.ok, false, `índice ${indice}`);
  }
  assert.deepEqual(caixa(e, 1).itens, [p], 'nada saiu');
  assert.equal(e.hunt ?? null, null);
  // O certo abre.
  assert.ok(Dispositivo.abrir(e, { onde: 'depot:1', indice: 0, assinatura: s, mode: 'auto' }).ok);
});

test('o Baú da Conta fica de fora: não lista, não abre (nem forjado no depósito do personagem), não entra no loop; a tela diz quantos há', { skip: SEM }, () => {
  const e = personagem();
  const daConta = normal(3);
  e.bauDaConta = Deposito.caixaDaConta({ itens: [{ ...daConta, count: 1 }, { ...normal(6), count: 1 }], teto: 20 });
  // Uma caixa compartilhada forjada dentro do depósito do personagem (save antigo, cliente esperto): `garantir` a tira e as fontes a recusam.
  e.deposito.push({ indice: Deposito.INDICE_DA_CONTA, nome: 'Compartilhada', compartilhada: true, teto: 20, itens: [{ ...normal(3), count: 1 }] });
  assert.equal(MapasLoop.fontesDeMapas(e).some((f) => f.onde === `depot:${Deposito.INDICE_DA_CONTA}`), false);
  assert.deepEqual(Dispositivo.mapasCarregados(e), [], 'nenhum mapa da conta na lista');
  const tela = Dispositivo.paraTela(e);
  assert.equal(tela.mapas.length, 0);
  assert.equal(tela.noBauDaConta, 2);
  const r = Dispositivo.abrir(e, { onde: `depot:${Deposito.INDICE_DA_CONTA}`, indice: 0, assinatura: Dispositivo.assinatura(e.bauDaConta.itens[0]), mode: 'auto' });
  assert.equal(r.ok, false);
  assert.equal(e.bauDaConta.itens.length, 2, 'a peça da conta não saiu');
  const loop = Dispositivo.iniciarLoop(e, { grupos: [{ chave: chave(daConta) }], mode: 'auto' });
  assert.equal(loop.ok, false);
  assert.match(loop.erro, /não estão mais com você/);
  assert.equal(e.bauDaConta.itens.length, 2);
});

test('loop: usa a mochila, depois a bolsa, depois o depósito — e procura a peça de novo a cada mapa (também no depósito)', { skip: SEM }, () => {
  const e = personagem();
  // (com qualidade: o T3 Normal que o chefe derruba na bolsa no caminho não é do grupo — o teste quer a ordem exata das três origens)
  const comQualidade = () => {
    const p = normal(3);
    p.poe.qualidade = 7;
    return p;
  };
  const naMochila = comQualidade();
  const naBolsa = comQualidade();
  e.inventory.push(naMochila);
  e.pouch.push({ ...naBolsa, count: 1 });
  guardar(e, 4, comQualidade());
  guardar(e, 4, normal(2));
  const naoMapa = caixa(e, 4).itens.at(-1);
  assert.equal(MapasLoop.pecasDoGrupo(e, chave(naMochila)).map((p) => p.onde).join(), 'inventory,pouch,depot:4');
  const r = Dispositivo.iniciarLoop(e, { grupos: [{ chave: chave(naMochila), quantos: 3 }], mode: 'auto' });
  assert.ok(r.ok, r.erro);
  assert.equal(e.inventory.filter((p) => Mapas.ehMapa(p)).length, 0, 'o primeiro saiu da mochila');
  assert.equal(e.pouch.filter((p) => Mapas.ehMapa(p)).length, 1);
  assert.equal(caixa(e, 4).tipos, 2);
  assert.equal(Dispositivo.paraTela(e).loop.total, 3);

  const relogio = { agora: Date.now() };
  concluir(e, relogio);
  semDrops(e);
  assert.equal(e.hunt?.mapa?.tier, 3, 'o segundo abriu');
  assert.equal(e.pouch.filter((p) => Mapas.ehMapa(p)).length, 0, 'o segundo saiu da bolsa');
  assert.equal(caixa(e, 4).tipos, 2, 'o do depósito ainda está lá');
  // A peça do depósito mudou de lugar (outra caixa) entre um mapa e outro: o loop a acha de novo.
  const [p] = caixa(e, 4).itens.splice(0, 1);
  caixa(e, 4).tipos = caixa(e, 4).itens.length;
  guardar(e, 7, p);
  concluir(e, relogio);
  semDrops(e);
  assert.equal(e.hunt?.mapa?.tier, 3, 'o terceiro abriu do depósito (Caixa VIII)');
  assert.deepEqual(caixa(e, 7).itens, [], 'saiu da caixa onde estava');
  assert.equal(caixa(e, 7).tipos, 0);
  assert.deepEqual(caixa(e, 4).itens, [naoMapa], 'o mapa de outro grupo ficou');
  concluir(e, relogio);
  assert.equal(e.mapas.loop, null);
  assert.equal(e.mapas.loopFim.concluiu, true);
  assert.equal(e.mapas.concluidos, 3);
});

test('a lista junta as três origens pela mesma chave, na ordem mochila → bolsa → depósito; o "Abrir mapa" pega a da mochila', { skip: SEM }, () => {
  const e = personagem();
  const a = normal(3);
  e.inventory.push(a);
  e.pouch.push({ ...normal(3), count: 1 });
  guardar(e, 3, normal(3));
  const lista = Dispositivo.paraTela(e).mapas;
  assert.deepEqual(lista.map((m) => m.origem), ['mochila', 'bolsa', 'deposito']);
  const [g] = agruparMapas(lista);
  assert.equal(g.qtd, 3);
  assert.equal(g.naBolsa, 1);
  assert.equal(g.noBau, 1);
  assert.equal(g.mapas[0].onde, 'inventory');
  assert.equal(ondeDoGrupo(g), ' · 1 no baú · 1 na bolsa');
});

// ---------------------------------------------------------------- a parte pura e a tela

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
const naTela = (onde, indice, extra = {}) => ({ onde, indice, assinatura: `s${onde}${indice}`, chave: 'k3', id: 7_700_003, tier: 3, nivel: 70, raridade: 'normal', nome: 'Mapa (Nível 3)', peca: { id: 7_700_003, poe: { mapa: { linhas: [] } } }, ...extra });

test('agrupar e a linha de onde vêm: "3 no baú · 1 na bolsa", "no baú" (todos lá), a mochila não se diz; sem `origem`, pelo `onde`', () => {
  assert.equal(origemDoMapa({ onde: 'depot:3' }), 'deposito');
  assert.equal(origemDoMapa({ onde: 'chegadas' }), 'deposito');
  assert.equal(origemDoMapa({ onde: 'pouch' }), 'bolsa');
  assert.equal(origemDoMapa({ onde: 'inventory' }), 'mochila');
  const [g] = agruparMapas([naTela('pouch', 0), naTela('depot:0', 0), naTela('depot:2', 1), naTela('chegadas', 0)]);
  assert.deepEqual([g.qtd, g.naBolsa, g.noBau], [4, 1, 3]);
  assert.equal(ondeDoGrupo(g), ' · 3 no baú · 1 na bolsa');
  assert.equal(ondeDoGrupo(agruparMapas([naTela('depot:1', 0), naTela('depot:1', 1)])[0]), ' · no baú');
  assert.equal(ondeDoGrupo(agruparMapas([naTela('inventory', 0), naTela('depot:1', 1)])[0]), ' · 1 no baú');
  assert.equal(ondeDoGrupo(agruparMapas([naTela('inventory', 0), naTela('inventory', 1)])[0]), '');
});

test('tela: o cartão diz de onde vêm, o "Abrir mapa" manda o `onde` da caixa; o Baú da Conta numa linha', () => {
  esquecerMemoria();
  const t = desenhar({ mapas: [naTela('depot:2', 4, { origem: 'deposito', caixa: 'Caixa III' }), naTela('chegadas', 0, { origem: 'deposito' })], noBauDaConta: 2 });
  const [cartao] = t.body.achar('mp-mapa');
  assert.match(cartao.textContent, /Normal · área nível 70 · no baú/);
  assert.match(cartao.textContent, /×2/);
  t.body.achar('mp-abrir')[0].onclick();
  assert.deepEqual(t.enviados.at(-1), { t: 'abrirMapa', onde: 'depot:2', indice: 4, assinatura: 'sdepot:24', mode: 'auto' });
  assert.match(t.body.achar('mp-bau-conta')[0].textContent, /2 mapas no Baú da Conta: mova para o seu depósito para usar/);
  // Sem mapas com você, a linha da conta aparece igual; sem mapas na conta, ela some.
  const vazio = desenhar({ mapas: [], noBauDaConta: 1 });
  assert.match(vazio.body.achar('mp-bau-conta')[0].textContent, /^1 mapa no Baú da Conta/);
  assert.equal(desenhar({ mapas: [] }).body.achar('mp-bau-conta').length, 0);
  esquecerMemoria();
});
