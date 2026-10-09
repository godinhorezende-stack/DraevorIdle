// O PORTAL DE VIAGEM (dono, 08/10: "quando o personagem entra em uma instância e sai, ele usa [o Portal_(Marapur)], simulando que ele
// entra e vai embora para outro lugar; se tiver em party, os 2 ou mais personagens nunca caem no mesmo lugar, mas caem no range perto,
// na tela visível"). Ele abre onde cada um sai (antes da instância nova; no "Parar", para quem fica) e onde cada um chega (a entrada da
// instância nova, o começo da caçada, a entrada na sala da party). Antes, na instância nova só o dono voltava para a entrada: os outros
// da party ficavam onde estavam na instância de antes.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
// Uma tabela de parties SÓ deste teste (os outros arquivos, em outros processos, também gravam parties no banco compartilhado).
process.env.PARTY_TABELA = `parties_salvas_v${process.pid}`;
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const B = await import('../database/banco.mjs');
const { Sessao, vivas } = await import('../websocket/sessao.mjs');
const Party = await import('../systems/party.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Campanha = await import('../systems/campanha.mjs');
const Bolsa = await import('../systems/bolsa.mjs');
const R = await import('../systems/regras.mjs');
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');

const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no jogo oficial (PoE)';
const contas = [];
after(async () => {
  for (const s of [...vivas.values()]) s.desconectar?.();
  for (const c of contas) {
    await B.db.prepare('DELETE FROM melhorias_da_conta WHERE conta = ?').run(c);
    await B.db.prepare('DELETE FROM contas WHERE id = ?').run(c);
  }
  await B.banco.exec(`DROP TABLE IF EXISTS ${process.env.PARTY_TABELA}`);
});

// Uma fase do MEIO do Ato 1 que conclui limpando: na última, limpar abre o chefe do ato, e a instância espera ele morrer.
const H = () => Campanha.FASES.find((f) => f.ato === 1 && f.huntId !== Campanha.ultimaFaseDoAto(1).huntId && Campanha.conclusaoDa(f.huntId).tipo === 'limpar-hunt').huntId;
const VIAGEM = 'fabrica-portal-de-viagem';
const portais = (eventos) => eventos.filter((ev) => ev.t === 'portal' && ev.asset === VIAGEM);
const casa = (p) => `${p.x},${p.y}`;
const distancia = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const vivos = (e) => [...e.hunt.monstros, ...Object.values(e.hunt.outrosAndares ?? {}).flat()].filter((m) => m.hp > 0);

/** Um personagem com o Ato 1 feito menos a fase `H` (imortal: a viagem é o assunto, não a luta). */
function novo() {
  const e = personagemDeTeste({ vocacao: 'knight', level: 30 });
  e.hp = e.maxHp = 1e9;
  e.sistema = 'poe';
  e.campanha = { facil: { completas: Campanha.FASES.filter((f) => f.ato === 1 && f.huntId !== H()).map((f) => f.huntId), bosses: [] } };
  Bolsa.garantir(e);
  return e;
}
/** O dono e `n` convidados na sala dele, com a partilha que o tique da sessão põe na caçada (`Party.partilha`). */
function sala(n) {
  const a = novo();
  assert.ok(Cacadas.entrar(a, { huntId: H(), mode: 'auto', strategy: 'nearest', dificuldade: 'facil' }).ok);
  const convidados = [];
  for (let i = 0; i < n; i++) {
    const o = novo();
    assert.notEqual(Cacadas.entrarNaSala(o, a.hunt, convidados.map((c) => ({ ...c.hunt.pos, z: c.hunt.z }))).ok, false);
    convidados.push(o);
  }
  const todos = [a, ...convidados];
  Object.defineProperty(a.hunt, 'partilha', { value: { ativa: n > 0, bonus: 1, membros: todos.map((e, i) => ({ estado: e, nome: `p${i}` })), naSala: todos }, configurable: true, writable: true });
  return todos;
}
/** Só o dono anda (`ms` em tiques de 250 ms): os convidados ficam parados onde o teste os pôs. Devolve os eventos. */
function andar(e, ms, relogio) {
  const eventos = [];
  for (let t = 0; t < ms && e.hunt; t += 250) eventos.push(...(Cacadas.tique(e, PERSONAGEM, (relogio.agora += 250)) ?? []));
  return eventos;
}

test('entrar na caçada: ele chega por um portal de viagem na entrada (o cliente o mostra quando a cortina "Traçando a rota" sai)', { skip: SEM }, () => {
  const e = novo();
  assert.ok(Cacadas.entrar(e, { huntId: H(), mode: 'auto', strategy: 'nearest', dificuldade: 'facil' }).ok);
  const entrada = { ...e.hunt.pos };
  const chegou = portais(Cacadas.tique(e, PERSONAGEM, Date.now() + 250) ?? []);
  assert.equal(chegou.length, 1);
  assert.deepEqual([chegou[0].x, chegou[0].y], [entrada.x, entrada.y]);
  assert.equal(chegou[0].chegada, true);
  assert.ok(chegou[0].ms > 0);
});

test('entrar na sala da party: cada um numa casa livre diferente, perto do dono (na tela), e cada um chega por um portal', { skip: SEM }, () => {
  const todos = sala(3);
  const casas = todos.map((e) => casa(e.hunt.pos));
  assert.equal(new Set(casas).size, 4, `nunca a mesma casa: ${casas}`);
  for (const o of todos.slice(1)) assert.ok(distancia(o.hunt.pos, todos[0].hunt.pos) <= Cacadas.RAIO_DA_CHEGADA, `${casa(o.hunt.pos)} perto de ${casa(todos[0].hunt.pos)}`);
  const chegaram = portais(Cacadas.tique(todos[0], PERSONAGEM, Date.now() + 250) ?? []);
  assert.deepEqual(new Set(chegaram.map(casa)), new Set(casas), 'um portal onde cada um chegou');
  assert.ok(chegaram.every((p) => p.chegada));
});

test('troca de instância: o portal abre sob cada um da sala e, um instante depois, todos chegam juntos na nova — cada um numa casa diferente, perto da entrada', { skip: SEM }, () => {
  const todos = sala(2);
  const [a, b, c] = todos;
  const relogio = { agora: Date.now() };
  andar(a, 250, relogio);
  // Os convidados longe, do outro lado da instância (na casa de dois bichos do fundo): antes da regra, ficavam lá na instância nova.
  const longe = vivos(a).sort((x, y) => distancia(y, a.hunt.pos) - distancia(x, a.hunt.pos));
  b.hunt.pos = { x: longe[0].x, y: longe[0].y, dir: 2 };
  c.hunt.pos = { x: longe[1].x, y: longe[1].y, dir: 2 };
  const idDaInstancia = a.hunt.instancia.id;
  // Limpa (só o dono anda) e espera a pausa do "Hunt Clear!".
  for (let i = 0; i < 40 && a.hunt.instancia.status !== 'limpa'; i++) {
    for (const m of vivos(a)) m.hp = 0;
    andar(a, 250, relogio);
  }
  assert.equal(a.hunt.instancia.status, 'limpa');
  let saida = [];
  for (let i = 0; i < 40 && !saida.length; i++) saida = portais(andar(a, 250, relogio));
  const ondeEstavam = todos.map((e) => casa(e.hunt.pos));
  assert.deepEqual(new Set(saida.map(casa)), new Set(ondeEstavam), 'o portal abre sob cada um, onde cada um está');
  assert.ok(saida.every((p) => p.z === a.hunt.z && !p.chegada), 'o da saída leva o andar (o cliente não o desenha noutro andar)');
  assert.equal(a.hunt.instancia.id, idDaInstancia, 'ainda na mesma: eles "entram" no portal primeiro');
  const abriu = relogio.agora;
  let chegada = [];
  for (let i = 0; i < 12 && a.hunt.instancia.id === idDaInstancia; i++) {
    assert.equal(casa(a.hunt.pos), ondeEstavam[0], 'parado no portal enquanto ele está aberto');
    chegada = portais(andar(a, 250, relogio));
  }
  assert.notEqual(a.hunt.instancia.id, idDaInstancia, 'a instância nova veio');
  assert.ok(relogio.agora - abriu >= 750, 'um instante com o portal aberto antes da troca');
  // Na nova: o dono na entrada; os convidados vieram junto, cada um numa casa livre diferente, perto dele, no mesmo andar.
  const casas = todos.map((e) => casa(e.hunt.pos));
  assert.equal(new Set(casas).size, 3, `nunca a mesma casa: ${casas}`);
  const deBicho = new Set(vivos(a).map(casa));
  for (const o of [b, c]) {
    assert.ok(distancia(o.hunt.pos, a.hunt.pos) <= Cacadas.RAIO_DA_CHEGADA, `${casa(o.hunt.pos)} perto da entrada ${casa(a.hunt.pos)}`);
    assert.equal(o.hunt.z, a.hunt.z);
    assert.ok(!deBicho.has(casa(o.hunt.pos)), 'nem em cima de um bicho da instância nova');
    assert.equal(o.hunt.alvo ?? null, null, 'sem o alvo da instância de antes');
  }
  assert.deepEqual(new Set(chegada.map(casa)), new Set(casas), 'e cada um sai de um portal onde chegou');
  assert.ok(chegada.every((p) => p.chegada));
});

/** Um jogador conectado (sessão de verdade), com o Ato 1 aberto até a fase `H`. */
async function jogador(prefixo) {
  const c = await B.criarConta({ email: `viagem-${randomUUID()}@teste.local`, senha: 'senha-123' });
  contas.push(c.id);
  await B.gravarMelhoriasDaConta(c.id, { slotsDeParty: 3 });
  await B.lerMelhoriasDaConta(c.id);
  const s = new Sessao({ readyState: 1, bufferedAmount: 0, send: () => {} });
  s.conta = { id: c.id };
  const nome = `${prefixo}${randomUUID().replace(/[^a-z]/g, '').slice(0, 7)}`;
  const e = { ...novo(), pos: { ...R.POSICAO_INICIAL } };
  await s.concluirEntrada({ id: randomUUID(), nome }, e, null, null);
  return { s, nome, e: s.estado };
}
/** A e B na party, B na sala de A. */
async function dupla() {
  const a = await jogador('Va');
  const b = await jogador('Vb');
  assert.ok(Party.comandoDoGrupo(a.s, { action: 'convidar', name: b.nome }).ok);
  assert.ok(Party.comandoDoGrupo(b.s, { action: 'aceitar' }).ok);
  assert.ok(Cacadas.entrar(a.e, { huntId: H(), mode: 'auto', strategy: 'nearest', dificuldade: 'facil' }).ok);
  assert.ok(Party.comandoDaCaca(a.s, { action: 'invite', name: b.nome }).ok);
  const aceite = Party.comandoDaCaca(b.s, { action: 'accept' });
  assert.ok(aceite.ok, aceite.erro);
  assert.equal(Cacadas.salaDe(b.e.hunt), a.e.hunt);
  // Os portais da chegada (o começo e a entrada na sala) já saíram.
  Cacadas.tique(a.e, PERSONAGEM, Date.now() + 250);
  return { a, b };
}

test('"Parar": quem fica na sala vê o portal de viagem onde ele estava — o convidado saindo, ou o dono (a sala passa ao outro)', { skip: SEM }, async () => {
  const { a, b } = await dupla();
  const deB = { ...b.e.hunt.pos, z: b.e.hunt.z };
  b.s.despachar({ t: 'stopHunt' });
  assert.equal(b.e.hunt, null);
  const viuB = portais(Cacadas.tique(a.e, PERSONAGEM, Date.now() + 500) ?? []);
  assert.deepEqual(viuB.map((p) => [p.x, p.y, p.z]), [[deB.x, deB.y, deB.z]], 'A viu B ir embora');
  // Agora o DONO sai: B (de volta na sala) fica com ela e vê o portal onde A estava.
  const { a: dono, b: fica } = await dupla();
  const deDono = { ...dono.e.hunt.pos, z: dono.e.hunt.z };
  dono.s.despachar({ t: 'stopHunt' });
  assert.equal(dono.e.hunt, null);
  assert.equal(Cacadas.salaDe(fica.e.hunt), fica.e.hunt, 'B virou o dono da sala');
  const viuDono = portais(Cacadas.tique(fica.e, PERSONAGEM, Date.now() + 500) ?? []);
  assert.deepEqual(viuDono.map((p) => [p.x, p.y, p.z]), [[deDono.x, deDono.y, deDono.z]], 'B viu A ir embora');
  // Sozinho na caçada: sair não deixa portal para ninguém (e não quebra).
  fica.s.despachar({ t: 'stopHunt' });
  assert.equal(fica.e.hunt, null);
});
