// Comando de jogo numa sessão SEM personagem: a aba que reconectou (ou que outra aba soltou com `released`) e manda um comando antes do
// `play`. Em produção, 16/10/2026, logo depois do deploy do PR #244: `sessao gema -> Cannot read properties of null (reading 'equipment')`
// — o `case 'gema'` agia em `this.estado` nulo. O erro era capturado, mas ia para o log. O certo: sem personagem, o comando de jogo é
// ignorado em silêncio (como durante a entrada); a conta, o handshake e as consultas que não leem o personagem seguem respondendo.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import * as B from '../database/banco.mjs';
import { Sessao } from '../websocket/sessao.mjs';
import { personagemDeTeste, HUNT_DE_TESTE } from './apoio.mjs';

const limpar = [];
after(async () => {
  for (const f of limpar.reverse()) await f();
});

async function conta() {
  const c = await B.criarConta({ email: `sem-personagem-${randomUUID()}@teste.local`, senha: 'senha-123' });
  limpar.push(() => B.db.prepare('DELETE FROM contas WHERE id = ?').run(c.id));
  return B.contaPorId(c.id);
}

/** Uma aba logada na conta, sem personagem: um socket de mentira que guarda o que recebeu. */
function aba(c) {
  const recebidas = [];
  const s = new Sessao({ readyState: 1, bufferedAmount: 0, send: (t) => recebidas.push(JSON.parse(t)) });
  s.conta = c;
  return { s, recebidas };
}

/** Manda `m` como o socket manda (`receber`), esperando o que for assíncrono; guarda o que foi logado como erro e o que estourou. */
async function mandar(s, m) {
  const original = console.error;
  const erros = [];
  console.error = (...a) => erros.push(a.map(String).join(' '));
  try {
    await s.receber(m);
  } catch (e) {
    erros.push(e?.stack ?? String(e));
  } finally {
    console.error = original;
  }
  return erros;
}

// Comandos de jogo que estouravam sem personagem (o `gema` de produção entre eles), os de leitura e os assíncronos (banco).
const COMANDOS_DE_JOGO = [
  { t: 'gema', action: 'encaixar', item: 1, slot: 'weapon', socket: 0 },
  { t: 'gema', action: 'tirar', slot: 'weapon', socket: 0 },
  { t: 'startHunt', huntId: HUNT_DE_TESTE, mode: 'auto', strategy: 'nearest' },
  { t: 'stopHunt' },
  { t: 'equip', id: 1 },
  { t: 'unequip', slot: 'weapon' },
  { t: 'frasco', action: 'usar', vaga: 0 },
  { t: 'forja' },
  { t: 'forjaAfixos' },
  { t: 'huntTarget', id: 1 },
  { t: 'huntAction', slot: 0 },
  { t: 'settings', settings: { autoLoot: false } },
  { t: 'regrasDeUso', regras: [] },
  { t: 'actions' },
  { t: 'pouch', id: 1 },
  { t: 'store' },
  { t: 'depot' },
  { t: 'bank', action: 'deposit', amount: 1 },
  { t: 'friends', action: 'list' },
  { t: 'guilda' },
  { t: 'arena' },
  { t: 'chat', channel: 'global', text: 'oi' },
];

test('sem personagem, comando de jogo não estoura, não loga erro e não responde nada', async () => {
  const { s, recebidas } = aba(await conta());
  for (const m of COMANDOS_DE_JOGO) {
    const erros = await mandar(s, m);
    assert.deepEqual(erros, [], `${m.t}${m.action ? ` (${m.action})` : ''} logou erro`);
  }
  assert.deepEqual(recebidas, [], 'a sessão sem personagem respondeu a um comando de jogo');
  assert.equal(s.personagem, null);
  assert.equal(s.estado, null);
});

test('sem personagem, o handshake e as consultas que não leem o personagem seguem respondendo', async () => {
  const { s, recebidas } = aba(await conta());
  const erros = [
    ...(await mandar(s, { t: 'ping', at: 123 })),
    ...(await mandar(s, { t: 'oculta', on: true })),
    ...(await mandar(s, { t: 'jaTenhoCatalogo' })),
    ...(await mandar(s, { t: 'ranking', category: 'exp' })),
    ...(await mandar(s, { t: 'presenca', nomes: ['Ninguem'] })),
    ...(await mandar(s, { t: 'previaPoe', id: 'nenhuma' })),
  ];
  assert.deepEqual(erros, []);
  assert.deepEqual(recebidas.find((m) => m.t === 'pong'), { t: 'pong', at: 123 });
  assert.equal(s.oculta, true);
  assert.equal(s.guardaCatalogo, true);
  assert.ok(recebidas.some((m) => m.t === 'ranking'), 'o ranking não respondeu');
  assert.deepEqual(recebidas.find((m) => m.t === 'presenca')?.nomes, { Ninguem: 'off' });
  assert.ok(recebidas.some((m) => m.t === 'previaPoe'), 'a prévia da área não respondeu');
});

test('com personagem, o comando de jogo continua chegando ao jogo', async () => {
  const { s, recebidas } = aba(await conta());
  s.personagem = { id: 0, nome: 'ComPersonagem' };
  s.estado = personagemDeTeste({ level: 20 });
  const erros = await mandar(s, { t: 'gema', action: 'nenhuma' });
  assert.deepEqual(erros, []);
  assert.equal(recebidas.findLast((m) => m.t === 'error')?.message, 'Ação de gema desconhecida.');
});
