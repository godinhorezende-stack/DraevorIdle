// As CIDADES por ato, cada uma uma INSTÂNCIA (dono, 10/10: "entre atos a cidade muda — então terá instâncias de cada cidade"; escolheu
// "instância por cidade, mesmo mapa"): o registro das cidades do PoE, a praça e o chão separados por cidade, e a viagem pelo mapa da
// campanha (o comando `irParaCidade`), que só vai para ato aberto e tira da caçada.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';

const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no jogo oficial (PoE)';
const { personagemDeTeste } = await import('./apoio.mjs');
const Cidades = await import('../systems/cidades.mjs');
const Campanha = await import('../systems/campanha.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Inventario = await import('../systems/inventario.mjs');
const Chat = await import('../systems/chat.mjs');
const { Sessao, vivas } = await import('../websocket/sessao.mjs');
const R = await import('../systems/regras.mjs');

/** Um personagem numa cidade (`ato`), parado num ponto da praça. */
function naCidade(ato, pos = { x: 300, y: 300 }) {
  const e = personagemDeTeste({ level: 30 });
  e.atoDaCidade = ato;
  e.pos = { z: 7, dir: 2, ...pos };
  return e;
}

test('as cidades do PoE: uma por ato (a Vigília de Lioneye no 1, as Docas de Oriath no 10); sem ato, a primeira', { skip: SEM }, () => {
  assert.equal(Cidades.porAto(), true);
  const lista = Cidades.cidades();
  assert.ok(lista.length >= 10, `${lista.length} cidades`);
  assert.deepEqual(lista.map((c) => c.ato), [...lista.map((c) => c.ato)].sort((a, b) => a - b), 'na ordem dos atos');
  assert.equal(Cidades.daCidadeDoAto(1).id, 'poe-a1-lioneyes-watch');
  assert.equal(Cidades.daCidadeDoAto(2).nome, 'Acampamento da Floresta');
  assert.equal(Cidades.daCidadeDoAto(10).id, 'poe-a10-oriath-docks');
  assert.notEqual(Cidades.daCidadeDoAto(6).id, Cidades.daCidadeDoAto(1).id, 'a Vigília do Ato 6 é outra instância que a do Ato 1');
  assert.equal(Cidades.cidadeDe({ atoDaCidade: 3 }).id, 'poe-a3-the-sarn-encampment');
  assert.equal(Cidades.cidadeDe({}).ato, 1, 'sem ato: a primeira');
});

test('o chão é de cada cidade: o que cai numa não aparece nem se pega na outra (na mesma casa)', { skip: SEM }, () => {
  const ESPADA = Inventario.inventarioInicial('knight').find((p) => p.id)?.id;
  const noUm = naCidade(1);
  const noDois = naCidade(2);
  const outroNoUm = naCidade(1);
  const peca = noUm.inventory.find((p) => p.id === ESPADA);
  assert.ok(peca, 'ele tem o que largar');
  const { x, y } = noUm.pos;
  assert.equal(Inventario.largar(noUm, { id: ESPADA, count: 1, x, y }).ok, true);
  const daUm = Inventario.chaoParaCliente(Cidades.daCidadeDoAto(1).id).filter((p) => p.x === x && p.y === y);
  const daDois = Inventario.chaoParaCliente(Cidades.daCidadeDoAto(2).id).filter((p) => p.x === x && p.y === y);
  assert.equal(daUm.length, 1, 'na cidade do Ato 1');
  assert.equal(daDois.length, 0, 'não na do Ato 2');
  assert.match(Inventario.pegar(noDois, { x, y, indice: null }).erro, /Não há nada aí/);
  // Quem está na MESMA cidade acha a pilha (a espada do Draevor fica no chão do jogo oficial — a recusa é essa, não "nada aí").
  const r = Inventario.pegar(outroNoUm, { x, y, indice: null });
  assert.doesNotMatch(r.erro ?? '', /Não há nada aí/, `quem está na mesma cidade acha a pilha (${r.erro ?? 'pegou'})`);
});

test('a praça é de cada cidade: na mesma casa e andar, quem está noutra cidade não aparece', { skip: SEM }, () => {
  for (const nome of [...vivas.keys()]) vivas.delete(nome);
  const sessao = (nome, ato) => {
    const s = { personagem: { nome }, estado: { ...naCidade(ato, { x: 100, y: 100 }), outfit: {} } };
    vivas.set(nome, s);
    return s;
  };
  const eu = sessao('EuNoUm', 1);
  sessao('VizinhoNoUm', 1);
  sessao('VizinhoNoDois', 2);
  Chat.invalidarIndice();
  assert.deepEqual(Chat.jogadoresNaPraca(eu).map((j) => j.name), ['VizinhoNoUm']);
  for (const nome of [...vivas.keys()]) vivas.delete(nome);
});

test('viajar pelo mapa: só para ato aberto; a caçada acaba; chega no ponto de entrada; e a tela recebe a cidade', { skip: SEM }, () => {
  const enviados = [];
  const s = new Sessao({ readyState: 1, send: (t) => enviados.push(JSON.parse(t)) });
  s.personagem = { id: 0, nome: 'Viajante' };
  // Só o Ato 1 aberto (nada vencido): o Ato 2 é recusado.
  s.estado = personagemDeTeste({ level: 30, campanha: { facil: { completas: [], bosses: [] } } });
  s.estado.atoDaCidade = 1;
  s.receber({ t: 'irParaCidade', ato: 2 });
  assert.match(enviados.findLast((m) => m.t === 'error')?.message ?? '', /Ato 2 ainda não está aberto/);
  assert.equal(s.estado.atoDaCidade, 1);
  assert.equal(Campanha.atoAberto(s.estado, 1), true);
  assert.equal(Campanha.atoAberto(s.estado, 2), false);
  // Com a campanha toda aberta: caçando no Ato 1, vai para a cidade do Ato 2 — sai da caçada e chega na entrada da praça.
  s.estado = personagemDeTeste({ level: 30 });
  const fase = Campanha.FASES.find((f) => f.ato === 1);
  assert.ok(Cacadas.entrar(s.estado, { huntId: fase.huntId, mode: 'auto', dificuldade: 'facil' }).ok);
  assert.equal(s.estado.atoDaCidade, 1, 'caçar no Ato 1 põe a cidade do Ato 1');
  s.estado.pos = { x: 1, y: 1, z: 7, dir: 2 };
  assert.equal(Campanha.atoAberto(s.estado, 2), true);
  s.receber({ t: 'irParaCidade', ato: 2 });
  assert.equal(s.estado.hunt, null, 'saiu da caçada');
  assert.equal(s.estado.atoDaCidade, 2);
  assert.deepEqual({ x: s.estado.pos.x, y: s.estado.pos.y }, { x: R.POSICAO_INICIAL.x, y: R.POSICAO_INICIAL.y });
  assert.equal(enviados.findLast((m) => m.t === 'campanha')?.campanha?.atoDaCidade, 2);
  assert.equal(enviados.findLast((m) => m.t === 'campanha')?.campanha?.cidadesPorAto, true);
  // Uma cidade que não existe.
  s.receber({ t: 'irParaCidade', ato: 99 });
  assert.match(enviados.findLast((m) => m.t === 'error')?.message ?? '', /não existe/);
});

test('o ato da fronteira é a cidade de quem ainda não tem uma (a sessão põe no login)', { skip: SEM }, () => {
  const novo = personagemDeTeste({ level: 1, campanha: { facil: { completas: [], bosses: [] } } });
  assert.equal(Campanha.atoDaFronteira(novo), 1);
  assert.equal(Campanha.atoDaFronteira(personagemDeTeste({ level: 30 })) >= 1, true);
});
