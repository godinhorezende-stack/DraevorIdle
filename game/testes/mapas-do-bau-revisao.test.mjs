// OS MAPAS DO BAÚ — os achados da revisão (27/10):
//   - o Dispositivo (o loop, no tique) tira mapa do MEIO de uma caixa do depósito: o "tirar" da tela que ainda mostra a caixa de antes
//     acertava outra peça do mesmo id (todo mapa do tier tem o mesmo) — a `rev` da caixa sobe e o `take` com a `rev` velha recusa;
//   - a lista de mapas da campanha crescia com o depósito inteiro e ia inteira a cada 8 s: a `peca` vai só no primeiro de cada grupo de
//     iguais, e a lista que a tela já tem (`versaoDosMapas`) não vai de novo;
//   - a linha "N mapas no Baú da Conta" ficava velha: o pedido da campanha relê o baú do banco (no máximo a cada 30 s).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';

const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no jogo oficial (PoE)';
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
const Dispositivo = await import('../systems/mapas-dispositivo.mjs');
const MapasLoop = await import('../systems/itens-poe/mapas-loop.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const Bolsa = await import('../systems/bolsa.mjs');
const Deposito = await import('../systems/deposito.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const { Sessao } = await import('../websocket/sessao.mjs');

/** O personagem dos testes de mapas (`mapas-do-bau.test.mjs`): a campanha até o Ato 10, vida que não acaba, um Machado Vaal e o depósito. */
function personagem() {
  const e = personagemDeTeste({ vocacao: 'knight', level: 90 });
  e.equipment = { ...(e.equipment ?? {}), weapon: Jogo.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Two_Hand_Axes/Vaal_Axe', raridade: 'normal', ilvl: 64, rng: () => 0.5 })) };
  e.hp = e.maxHp = 1e9;
  for (const d of Object.keys(e.campanha)) e.campanha[d].bosses = Array.from({ length: 10 }, (_, i) => i + 1);
  Bolsa.garantir(e);
  Deposito.garantir(e);
  return e;
}
const caixa = (e, indice) => e.deposito.find((c) => c.indice === indice);
function guardar(e, indice, peca) {
  const c = caixa(e, indice);
  c.itens.push({ ...peca, count: 1 });
  c.tipos = c.itens.length;
  return c.itens.at(-1);
}
function sessao(e) {
  const enviadas = [];
  const s = new Sessao({ readyState: 1, bufferedAmount: 0, send: (d) => enviadas.push(JSON.parse(d)) });
  s.estado = e;
  s.personagem = PERSONAGEM;
  return { s, enviadas };
}
const campanhas = (enviadas) => enviadas.filter((m) => m.t === 'campanha');

// ---------------------------------------------------------------- 1. o "tirar" com a caixa de antes

test('o loop abre um mapa do meio da caixa: o "tirar" com a rev velha recusa e nada sai; com a rev de agora, sai a peça que a tela mostra', { skip: SEM }, () => {
  const e = personagem();
  const normal = guardar(e, 1, Jogo.mapaSorteado(5, { raridade: 'normal' }));
  const raro = guardar(e, 1, Jogo.mapaSorteado(5, { raridade: 'raro' }));
  assert.equal(normal.id, raro.id, 'todo T5 tem o mesmo id');
  const revAntes = caixa(e, 1).rev ?? 0;
  // O loop abre o normal (o primeiro do grupo dele) — pelo mesmo `abrir` do botão.
  assert.ok(Dispositivo.iniciarLoop(e, { grupos: [{ chave: MapasLoop.chaveDoMapa(normal), quantos: 1 }], mode: 'auto' }).ok);
  assert.deepEqual(caixa(e, 1).itens, [raro], 'o normal saiu e o raro andou para a posição 0');
  assert.equal(caixa(e, 1).rev, revAntes + 1, 'a rev da caixa sobe');
  const naMochila = () => (e.inventory ?? []).filter((p) => p.id === raro.id).length;
  const antes = naMochila();

  // A tela de antes: "tirar" o normal (pos 0, o id do T5, a rev que ela via).
  const velho = Deposito.comando(e, { action: 'take', caixa: 1, pos: 0, id: normal.id, count: 1, rev: revAntes });
  assert.equal(velho.ok, false);
  assert.match(velho.erro, /mudou/);
  assert.deepEqual(caixa(e, 1).itens, [raro], 'o raro continua na caixa');
  assert.equal(naMochila(), antes, 'nada foi para a mochila');

  // A tela de agora (a rev nova): o raro, que é o que ela mostra na posição 0.
  const novo = Deposito.comando(e, { action: 'take', caixa: 1, pos: 0, id: raro.id, count: 1, rev: caixa(e, 1).rev });
  assert.ok(novo.ok, novo.erro);
  assert.equal(caixa(e, 1).itens.length, 0);
  assert.equal(e.inventory.at(-1).poe.raridade, 'raro');
});

test('a rev só sobe quando o Dispositivo tira da caixa: o pedido sem rev (os antigos) e o guardar/tirar do jogador seguem como antes', { skip: SEM }, () => {
  const e = personagem();
  guardar(e, 2, Jogo.mapaSorteado(3, { raridade: 'normal' }));
  const c = caixa(e, 2);
  assert.equal(c.rev ?? 0, 0);
  const r = Deposito.comando(e, { action: 'take', caixa: 2, pos: 0, id: c.itens[0].id, count: 1 });
  assert.ok(r.ok, r.erro);
  assert.equal(c.rev ?? 0, 0, 'tirar à mão não mexe na rev');
  // A rev 0 mandada contra a caixa nunca mexida (sem `rev` no estado) vale.
  const peca = e.inventory.at(-1);
  assert.ok(Deposito.comando(e, { action: 'store', caixa: 2, id: peca.id, count: 1, alvo: { onde: 'inventory', indice: e.inventory.length - 1 } }).ok);
  assert.ok(Deposito.comando(e, { action: 'take', caixa: 2, pos: 0, id: peca.id, count: 1, rev: 0 }).ok);
});

// ---------------------------------------------------------------- 2. o tamanho da lista da campanha

test('a lista da tela leva a peça só no primeiro de cada grupo; a abertura usa o primeiro e os outros continuam abríveis', { skip: SEM }, () => {
  const e = personagem();
  const base = Jogo.mapaSorteado(4, { raridade: 'normal' });
  for (let i = 0; i < 40; i++) guardar(e, 1 + (i % 3), base);
  const raro = guardar(e, 4, Jogo.mapaSorteado(4, { raridade: 'raro' }));
  const tela = Dispositivo.paraTela(e);
  assert.equal(tela.mapas.length, 41);
  const comPeca = tela.mapas.filter((m) => m.peca);
  assert.equal(comPeca.length, 2, 'uma peça por grupo (os 40 iguais e o raro)');
  const primeiros = new Map();
  for (const m of tela.mapas) if (!primeiros.has(m.chave)) primeiros.set(m.chave, m);
  for (const m of primeiros.values()) assert.ok(m.peca, 'o primeiro de cada grupo leva a peça (o cartão a desenha)');
  assert.equal(comPeca.find((m) => m.raridade === 'raro').peca.poe.raridade, raro.poe.raridade);
  // Sem a peça, as outras entradas ainda têm o que o "Abrir mapa" manda (onde, índice, assinatura).
  const ultimo = tela.mapas.filter((m) => m.chave === MapasLoop.chaveDoMapa(base)).at(-1);
  assert.equal(ultimo.peca, undefined);
  const r = Dispositivo.abrir(e, { onde: ultimo.onde, indice: ultimo.indice, assinatura: ultimo.assinatura, mode: 'auto' });
  assert.ok(r.ok, r.erro);
  // O servidor (`mapasCarregados`) continua com a peça em todas: só a tela fica sem.
  assert.ok(Dispositivo.mapasCarregados(e).every((m) => m.peca));
});

test('a lista que a tela já tem não vai de novo (versaoDosMapas); muda quando um mapa sai do depósito', { skip: SEM }, () => {
  const e = personagem();
  for (let i = 0; i < 300; i++) guardar(e, 1 + (i % 3), Jogo.mapaSorteado(6, { raridade: 'normal' }));
  const t1 = Dispositivo.paraTela(e);
  assert.ok(t1.versaoDosMapas);
  assert.ok(JSON.stringify(t1).length < 120_000, `300 mapas iguais: ${JSON.stringify(t1).length} bytes (antes, cada um levava a peça)`);
  const t2 = Dispositivo.paraTela(e, { versaoDaTela: t1.versaoDosMapas });
  assert.equal(t2.mapas, null);
  assert.equal(t2.mapasIguais, true);
  assert.equal(t2.versaoDosMapas, t1.versaoDosMapas);
  assert.ok(JSON.stringify(t2).length < 4_000, `repetida: ${JSON.stringify(t2).length} bytes`);
  // Outra versão (ou nenhuma): a lista vai inteira.
  assert.equal(Dispositivo.paraTela(e, { versaoDaTela: 'outra' }).mapas.length, 300);
  // Um mapa sai da caixa: a versão muda e a lista vai.
  const m = t1.mapas.at(-1);
  assert.ok(Dispositivo.abrir(e, { onde: m.onde, indice: m.indice, assinatura: m.assinatura, mode: 'auto' }).ok);
  const t3 = Dispositivo.paraTela(e, { versaoDaTela: t1.versaoDosMapas });
  assert.notEqual(t3.versaoDosMapas, t1.versaoDosMapas);
  assert.equal(t3.mapas.length, 299);
  assert.equal(t3.mapasIguais, undefined);
});

test('o loop na tela conta os iguais do depósito numa passada (contagemPorChave) e dá o mesmo número de antes', { skip: SEM }, () => {
  const e = personagem();
  const a = Jogo.mapaSorteado(2, { raridade: 'normal' });
  const b = Jogo.mapaSorteado(3, { raridade: 'normal' });
  for (let i = 0; i < 5; i++) guardar(e, 1, a);
  for (let i = 0; i < 4; i++) guardar(e, 2, b);
  const contagem = MapasLoop.contagemPorChave(e);
  assert.equal(contagem.get(MapasLoop.chaveDoMapa(a)), 5);
  assert.equal(contagem.get(MapasLoop.chaveDoMapa(b)), 4);
  assert.ok(Dispositivo.iniciarLoop(e, { grupos: [{ chave: MapasLoop.chaveDoMapa(b) }, { chave: MapasLoop.chaveDoMapa(a), quantos: 2 }], mode: 'auto' }).ok);
  const loop = Dispositivo.paraTela(e).loop;
  // b: o aberto + 3 que sobram; a: os 2 escolhidos.
  assert.equal(loop.total, 1 + 3 + 2);
  assert.deepEqual(loop.grupos.map((g) => g.restam), [3, 2]);
});

test('sessão: o pedido "campanha" com a versão da tela responde sem a lista; sem a versão, com ela', { skip: SEM }, () => {
  const e = personagem();
  for (let i = 0; i < 20; i++) guardar(e, 1, Jogo.mapaSorteado(7, { raridade: 'normal' }));
  const { s, enviadas } = sessao(e);
  s.despachar({ t: 'campanha' });
  const [primeira] = campanhas(enviadas);
  assert.equal(primeira.campanha.mapas.mapas.length, 20);
  s.despachar({ t: 'campanha', versaoDosMapas: primeira.campanha.mapas.versaoDosMapas });
  const segunda = campanhas(enviadas)[1];
  assert.equal(segunda.campanha.mapas.mapas, null);
  assert.equal(segunda.campanha.mapas.mapasIguais, true);
  assert.ok(JSON.stringify(segunda).length < JSON.stringify(primeira).length);
});

// ---------------------------------------------------------------- 3. o Baú da Conta da tela

test('sessão: o pedido "campanha" relê o Baú da Conta do banco (a contagem de mapas não fica velha), no máximo a cada 30 s', { skip: SEM }, async () => {
  const e = personagem();
  // A cópia velha: 2 mapas que outro personagem da conta já tirou (no banco, a conta não tem baú: vazio).
  e.bauDaConta = Deposito.caixaDaConta({ itens: [{ ...Jogo.mapaSorteado(3, { raridade: 'normal' }), count: 1 }, { ...Jogo.mapaSorteado(4, { raridade: 'normal' }), count: 1 }] });
  assert.equal(Dispositivo.mapasNoBauDaConta(e), 2);
  const { s, enviadas } = sessao(e);
  s.conta = { id: `teste-mapas-bau-${randomUUID()}` };
  await s.despachar({ t: 'campanha' });
  assert.equal(campanhas(enviadas).at(-1).campanha.mapas.noBauDaConta, 0, 'relido do banco');
  // Dentro dos 30 s não relê (a cópia que um comando do depósito puser fica).
  e.bauDaConta = Deposito.caixaDaConta({ itens: [{ ...Jogo.mapaSorteado(5, { raridade: 'normal' }), count: 1 }] });
  await s.despachar({ t: 'campanha' });
  assert.equal(campanhas(enviadas).at(-1).campanha.mapas.noBauDaConta, 1);
  // Passados os 30 s, relê de novo.
  s.bauDaContaRelidoEm -= 31_000;
  await s.despachar({ t: 'campanha' });
  assert.equal(campanhas(enviadas).at(-1).campanha.mapas.noBauDaConta, 0);
});
