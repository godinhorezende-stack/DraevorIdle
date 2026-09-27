// Treino online: o servidor põe o personagem a 1 SQM do boneco, ele fica FIXO
// ali, todo movimento é recusado no servidor e o treino só acaba quando é
// encerrado de verdade. Ver `Treinos.postoNoPatio`/`emTreino`,
// `Cacadas.entrarNoPatio`/`sairDoPatio` e `Exercicio.comecar`/`manterNoPosto`.
//
// Os dois treinos feitos online, com boneco: o PÁTIO (o card "Treino online",
// a hunt 'treino') e o EXERCISE (na cidade, com arma de treino).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import * as B from '../database/banco.mjs';
import { Sessao, vivas } from '../websocket/sessao.mjs';
import * as Treinos from '../systems/treinos.mjs';
import * as R from '../systems/regras.mjs';
import { gradeDaHunt } from '../systems/hunt/terreno.mjs';
import { personagemDeTeste } from './apoio.mjs';

const ARMA_DE_TREINO = 55714; // Boosted Exercise Axe (STORE_REAL.exercises)
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** Um jogador ONLINE (sessão viva, linha no banco), com as mensagens guardadas. */
async function jogador(t, { vocacao = 'knight', distancia = 0 } = {}) {
  const conta = await B.criarConta({ email: `treino-${randomUUID()}@teste.local`, senha: 'x' });
  const nome = `Tre${randomUUID().replace(/[^a-z]/g, '').slice(0, 8)}`;
  const estado = personagemDeTeste({ vocacao, level: 100 });
  estado.settings.distance = distancia;
  estado.inventory.push({ id: ARMA_DE_TREINO, count: 1 });
  const p = await B.criarPersonagem({ conta: conta.id, nome, vocacao, sexo: 'male', estadoInicial: estado });
  const enviados = [];
  const socket = { readyState: 1, send: (texto) => enviados.push(JSON.parse(texto)) };
  const s = new Sessao(socket);
  s.conta = await B.contaPorId(conta.id);
  await s.receber({ t: 'play', name: nome });
  assert.equal(vivas.get(nome), s);
  t.after(() => {
    vivas.get(nome)?.desconectar();
    B.db.prepare('DELETE FROM personagens WHERE id = ?').run(p.id);
    B.db.prepare('DELETE FROM sessoes WHERE conta = ?').run(conta.id);
    B.db.prepare('DELETE FROM contas WHERE id = ?').run(conta.id);
  });
  return { s, id: p.id, nome, conta, enviados, socket };
}

/**
 * `n` tiques de 250 ms com o relógio controlado (o passo da cidade e o da hunt
 * usam `Date.now()`); `antes(i)` roda antes de cada um — é onde o "cliente"
 * manda os comandos. Devolve as posições por onde ele passou.
 */
async function tiques(s, n, antes = () => {}) {
  const original = Date.now;
  let agora = original();
  Date.now = () => agora;
  const casas = new Set();
  try {
    for (let i = 0; i < n; i++) {
      await antes(i);
      agora += R.PASSO_MS;
      await s.tique();
      const p = s.estado.hunt?.pos ?? s.estado.pos;
      casas.add(`${p.x},${p.y}`);
    }
  } finally {
    Date.now = original;
  }
  return [...casas];
}

const noBanco = (id) => JSON.parse(B.db.prepare('SELECT estado FROM personagens WHERE id = ?').get(id).estado);

// ============================================================ o pátio

test('posto do pátio: a casa andável a 1 SQM de um boneco (na sala real, 18,12)', () => {
  const grade = gradeDaHunt({ id: 'treino' });
  const posto = Treinos.postoNoPatio(grade.andavel);
  assert.deepEqual(posto, { x: 18, y: 12 });
  assert.ok(grade.andavel.has('18,12'));
  assert.ok(Treinos.bonecos().some((b) => cheb(b, posto) === 1));
  // Sem nenhuma casa válida em volta dos bonecos: não há posto.
  assert.equal(Treinos.postoNoPatio(new Set(['0,0'])), null);
  // Outra sala: 18,13 não encosta em boneco; 16,11 e 20,10 encostam e ficam a 2
  // da partida — no empate, a de cima (linha, depois coluna): sempre a mesma.
  const andavel = new Set(['18,13', '16,11', '20,10']);
  assert.deepEqual(Treinos.postoNoPatio(andavel), { x: 20, y: 10 });
  assert.deepEqual(Treinos.postoNoPatio(new Set(['18,13', '16,11'])), { x: 16, y: 11 });
});

test('A. iniciar o treino online: o servidor põe o personagem a 1 SQM do boneco, de frente, e grava', async (t) => {
  const j = await jogador(t);
  await j.s.receber({ t: 'training', action: 'start', mode: 'online' });
  const hunt = j.s.estado.hunt;
  assert.equal(hunt?.huntId, 'treino');
  assert.deepEqual({ x: hunt.pos.x, y: hunt.pos.y }, { x: 18, y: 12 });
  assert.deepEqual(hunt.posto, { x: 18, y: 12 });
  const alvo = hunt.monstros.find((m) => m.uid === hunt.alvo);
  assert.equal(cheb(hunt.pos, alvo), 1, 'o alvo é o boneco colado nele');
  assert.ok(Treinos.emTreino(j.s.estado));
  // Persistido.
  assert.deepEqual(noBanco(j.id).hunt?.posto, { x: 18, y: 12 });
});

test('B/C/E/F. andar no pátio (teclado, analógico e WebSocket cru: `huntWalk`) é recusado', async (t) => {
  const j = await jogador(t);
  await j.s.receber({ t: 'training', action: 'start', mode: 'online' });
  // Para o SUL é o único lado aberto do posto (18,13): é por ali que ele saía.
  const casas = await tiques(j.s, 20, () => j.s.receber({ t: 'huntWalk', dx: 0, dy: 1 }));
  assert.deepEqual(casas, ['18,12']);
  assert.equal(j.s.estado.hunt.rumo, null);
  // A escada de mão também é movimento.
  j.enviados.length = 0;
  await j.s.receber({ t: 'huntEscada', x: 18, y: 13 });
  assert.match(j.enviados.find((m) => m.t === 'error')?.message ?? '', /Treinando/);
  // E o `walk` da cidade, mandado de dentro do pátio.
  assert.deepEqual(await tiques(j.s, 8, () => j.s.receber({ t: 'walk', dx: 1, dy: 0 })), ['18,12']);
});

test('D. clique no mapa (`walkTo`/`huntWalkTo`) não move', async (t) => {
  const j = await jogador(t);
  await j.s.receber({ t: 'training', action: 'start', mode: 'online' });
  const casas = await tiques(j.s, 8, async () => {
    await j.s.receber({ t: 'huntWalkTo', x: 18, y: 20 });
    await j.s.receber({ t: 'walkTo', x: 18, y: 20 });
  });
  assert.deepEqual(casas, ['18,12']);
});

test('G. continuar treinando: com "Distância" de kite, ele NÃO recua nem vai e volta — bate de onde está', async (t) => {
  for (const [vocacao, distancia] of [['sorcerer', 4], ['paladin', 3], ['knight', 0]]) {
    const j = await jogador(t, { vocacao, distancia });
    await j.s.receber({ t: 'training', action: 'start', mode: 'online' });
    await j.s.receber({ t: 'distance', value: distancia });
    const casas = await tiques(j.s, 40);
    assert.deepEqual(casas, ['18,12'], `${vocacao} com distância ${distancia} saiu do posto`);
    assert.ok(j.s.estado.hunt.sessao.damageDealt > 0, `${vocacao}: parado, tinha de estar batendo no boneco`);
  }
});

test('G2. posição fora do posto (estado antigo/corrompido): o servidor devolve ao posto, sem encerrar', async (t) => {
  const j = await jogador(t);
  await j.s.receber({ t: 'training', action: 'start', mode: 'online' });
  j.s.estado.hunt.pos.y = 14;
  delete j.s.estado.hunt.posto; // pátio gravado antes do posto existir
  assert.deepEqual(await tiques(j.s, 2), ['18,12']);
  assert.equal(j.s.estado.hunt?.huntId, 'treino');
});

test('H/I. encerrar: relatório, sai do pátio, volta à casa da cidade de onde saiu, movimento livre, gravado', async (t) => {
  const j = await jogador(t);
  const cidade = { ...j.s.estado.pos };
  await j.s.receber({ t: 'training', action: 'start', mode: 'online' });
  await tiques(j.s, 8);
  j.enviados.length = 0;
  await j.s.receber({ t: 'training', action: 'stop' });
  assert.ok(j.enviados.some((m) => m.t === 'treinoReport'), 'sem relatório');
  assert.ok(!j.enviados.some((m) => m.t === 'error'), JSON.stringify(j.enviados.find((m) => m.t === 'error')));
  assert.equal(j.s.estado.hunt, null);
  assert.equal(Treinos.emTreino(j.s.estado), false);
  assert.deepEqual({ x: j.s.estado.pos.x, y: j.s.estado.pos.y }, { x: cidade.x, y: cidade.y });
  // O quadro que vai ao cliente é o da cidade, com o mapa.
  const quadro = j.enviados.find((m) => m.t === 'state' && m.city);
  assert.ok(quadro?.city?.map, 'o cliente não recebeu o mapa da cidade');
  assert.equal(quadro.hunt ?? null, null);
  // Persistido: no banco ele já está na cidade, sem hunt.
  const gravado = noBanco(j.id);
  assert.equal(gravado.hunt ?? null, null);
  assert.deepEqual({ x: gravado.pos.x, y: gravado.pos.y }, { x: cidade.x, y: cidade.y });
  // Movimento liberado.
  const casas = await tiques(j.s, 4, () => j.s.receber({ t: 'walk', dx: 1, dy: 0 }));
  assert.ok(casas.length > 1, 'depois de parar ele devia andar');
  // E agora sim "Você não está treinando." é a verdade.
  j.enviados.length = 0;
  await j.s.receber({ t: 'training', action: 'stop' });
  assert.equal(j.enviados.find((m) => m.t === 'error')?.message, 'Você não está treinando.');
});

test('H2. "Voltar para a cidade" (`stopHunt`) no pátio encerra o treino do mesmo jeito', async (t) => {
  const j = await jogador(t);
  await j.s.receber({ t: 'training', action: 'start', mode: 'online' });
  j.enviados.length = 0;
  await j.s.receber({ t: 'stopHunt' });
  assert.ok(!j.enviados.some((m) => m.t === 'error'), 'antes: "Você não está treinando." com ele dentro do pátio');
  assert.equal(j.s.estado.hunt, null);
});

test('J. reconectar durante o treino no pátio: ele volta consistente — na cidade, fora do treino, livre', async (t) => {
  const j = await jogador(t);
  const cidade = { ...j.s.estado.pos };
  await j.s.receber({ t: 'training', action: 'start', mode: 'online' });
  j.s.desconectar(); // a conexão caiu: "o pátio de treino para quando você sai"
  await new Promise((r) => setTimeout(r, 50));
  const s2 = new Sessao({ readyState: 1, send() {} });
  s2.conta = j.s.conta ?? (await B.contaPorId(j.conta.id));
  await s2.receber({ t: 'play', name: j.nome });
  assert.equal(s2.estado.hunt, null);
  assert.equal(Treinos.emTreino(s2.estado), false);
  assert.deepEqual({ x: s2.estado.pos.x, y: s2.estado.pos.y }, { x: cidade.x, y: cidade.y });
  s2.desconectar();
});

// ============================================================ o Exercise

test('A (Exercise). começar: vai para a casa a 1 SQM do boneco da cidade e grava o posto', async (t) => {
  const j = await jogador(t);
  await j.s.receber({ t: 'training', action: 'start', mode: 'exercise', itemId: ARMA_DE_TREINO });
  const ex = j.s.estado.exercicio;
  assert.equal(ex?.treinando, true);
  assert.deepEqual({ x: j.s.estado.pos.x, y: j.s.estado.pos.y }, ex.posto);
  assert.equal(cheb(j.s.estado.pos, ex.boneco), 1);
  assert.deepEqual(noBanco(j.id).pos.x, ex.posto.x);
});

test('B/C/E/F (Exercise). `walk` (teclado, analógico, WebSocket cru) é recusado — e não encerra o treino', async (t) => {
  const j = await jogador(t);
  await j.s.receber({ t: 'training', action: 'start', mode: 'exercise', itemId: ARMA_DE_TREINO });
  const posto = { ...j.s.estado.exercicio.posto };
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const casas = await tiques(j.s, 6, () => j.s.receber({ t: 'walk', dx, dy }));
    assert.deepEqual(casas, [`${posto.x},${posto.y}`], `andou para ${dx},${dy}`);
  }
  assert.equal(j.s.estado.exercicio.treinando, true, 'tentar andar não pode encerrar o treino');
});

test('G2 (Exercise). tirado do posto por fora: volta ao posto e CONTINUA treinando (distância não encerra)', async (t) => {
  const j = await jogador(t);
  await j.s.receber({ t: 'training', action: 'start', mode: 'exercise', itemId: ARMA_DE_TREINO });
  const posto = { ...j.s.estado.exercicio.posto };
  j.s.estado.pos = { ...j.s.estado.pos, x: posto.x - 5 };
  await tiques(j.s, 2);
  assert.equal(j.s.estado.exercicio.treinando, true);
  assert.deepEqual({ x: j.s.estado.pos.x, y: j.s.estado.pos.y }, posto);
});

test('H (Exercise). parar: relatório, movimento livre de novo', async (t) => {
  const j = await jogador(t);
  await j.s.receber({ t: 'training', action: 'start', mode: 'exercise', itemId: ARMA_DE_TREINO });
  await tiques(j.s, 4);
  j.enviados.length = 0;
  await j.s.receber({ t: 'training', action: 'stop' });
  assert.ok(j.enviados.some((m) => m.t === 'treinoReport'));
  assert.equal(Treinos.emTreino(j.s.estado), false);
  const casas = await tiques(j.s, 6, () => j.s.receber({ t: 'walk', dx: 0, dy: 1 }));
  assert.ok(casas.length > 1, 'depois de parar ele devia andar');
});

test('J (Exercise). reconectar treinando: continua treinando, no mesmo posto', async (t) => {
  const j = await jogador(t);
  await j.s.receber({ t: 'training', action: 'start', mode: 'exercise', itemId: ARMA_DE_TREINO });
  const posto = { ...j.s.estado.exercicio.posto };
  await j.s.soltarPersonagem();
  const s2 = new Sessao({ readyState: 1, send() {} });
  s2.conta = await B.contaPorId(j.conta.id);
  await s2.receber({ t: 'play', name: j.nome });
  assert.equal(s2.estado.exercicio?.treinando, true);
  assert.deepEqual({ x: s2.estado.pos.x, y: s2.estado.pos.y }, posto);
  assert.deepEqual(await tiques(s2, 4, () => s2.receber({ t: 'walk', dx: 1, dy: 0 })), [`${posto.x},${posto.y}`]);
  s2.desconectar();
});
