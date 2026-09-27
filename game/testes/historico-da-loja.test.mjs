// O Histórico da loja (`{t:'historicoDaLoja'}`): o client pedia e o servidor
// nunca respondia — a janela ficava em "Carregando o histórico..." para sempre.
// Ver `game/systems/historico-da-loja.mjs`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import * as B from '../database/banco.mjs';
import { Sessao, vivas } from '../websocket/sessao.mjs';
import * as HistoricoDaLoja from '../systems/historico-da-loja.mjs';
import { personagemDeTeste } from './apoio.mjs';

/** Um jogador ONLINE com `coins`, a sessão guardando tudo o que o servidor manda. */
async function jogador(t, { coins = 1000, conta = null } = {}) {
  const c = conta ?? (await B.criarConta({ email: `loja-${randomUUID()}@teste.local`, senha: 'x' }));
  const nome = `Loja${randomUUID().replace(/[^a-z]/g, '').slice(0, 8)}`;
  const estado = personagemDeTeste({ level: 100 });
  estado.coins = coins;
  const p = await B.criarPersonagem({ conta: c.id, nome, vocacao: 'knight', sexo: 'male', estadoInicial: estado });
  const enviados = [];
  const s = new Sessao({ readyState: 1, send: (texto) => enviados.push(JSON.parse(texto)) });
  s.conta = await B.contaPorId(c.id);
  await s.receber({ t: 'play', name: nome });
  assert.equal(vivas.get(nome), s, 'não entrou no jogo');
  t.after(() => {
    s.desconectar();
    B.db.prepare('DELETE FROM loja_historico WHERE conta = ?').run(c.id);
    B.db.prepare('DELETE FROM personagens WHERE id = ?').run(p.id);
    if (!conta) {
      // Outro personagem da mesma conta (o teste da conta) sai junto, antes dela.
      B.db.prepare('DELETE FROM personagens WHERE conta = ?').run(c.id);
      B.db.prepare('DELETE FROM sessoes WHERE conta = ?').run(c.id);
      B.db.prepare('DELETE FROM contas WHERE id = ?').run(c.id);
    }
  });
  /** Pede o histórico e devolve a resposta — o mesmo que a janela recebe. */
  const historico = async () => {
    enviados.length = 0;
    await s.receber({ t: 'historicoDaLoja' });
    const r = enviados.filter((m) => m.t === 'historicoDaLoja');
    assert.equal(r.length, 1, 'o servidor tem de responder exatamente uma vez');
    return r[0];
  };
  return { s, conta: c, id: p.id, nome, enviados, historico };
}

test('A/H. sem compras: responde (não fica em "Carregando") com a lista vazia', async (t) => {
  const j = await jogador(t);
  const r = await j.historico();
  assert.deepEqual(r.linhas, []);
  assert.equal(r.erro, undefined);
});

test('B. uma compra: a linha tem o produto, o preço cobrado, o personagem e a hora', async (t) => {
  const j = await jogador(t, { coins: 1000 });
  const antes = Date.now();
  await j.s.receber({ t: 'store', action: 'buy', id: 'xp-boost' });
  assert.equal(j.s.estado.coins, 980, 'a compra não foi feita');
  const { linhas } = await j.historico();
  assert.equal(linhas.length, 1);
  const [l] = linhas;
  assert.equal(l.tipo, 'compra');
  assert.equal(l.produto, 'xp-boost');
  assert.equal(l.titulo, 'XP Boost — 1 hora');
  assert.equal(l.coins, -20);
  assert.equal(l.personagem, j.nome);
  assert.deepEqual(l.imagem, { art: 'xp-boost' });
  assert.ok(l.em >= antes && l.em <= Date.now());
});

test('C/E/J. várias compras: todas, a mais recente primeiro — e a nova aparece na hora', async (t) => {
  const j = await jogador(t, { coins: 1000 });
  for (const id of ['xp-boost', 'premium-7', 'wildcards-5']) await j.s.receber({ t: 'store', action: 'buy', id });
  let { linhas } = await j.historico();
  assert.deepEqual(linhas.map((l) => l.produto), ['wildcards-5', 'premium-7', 'xp-boost']);
  for (let i = 1; i < linhas.length; i++) assert.ok(linhas[i - 1].em >= linhas[i].em);
  // Uma compra nova depois de abrir: o próximo pedido já a traz no topo.
  await j.s.receber({ t: 'store', action: 'buy', id: 'xp-boost' });
  ({ linhas } = await j.historico());
  assert.equal(linhas.length, 4);
  assert.equal(linhas[0].produto, 'xp-boost');
  assert.equal(linhas.reduce((a, l) => a + l.coins, 0), j.s.estado.coins - 1000, 'a soma das linhas é o que saiu do saldo');
});

test('D/E. compras antigas entram na ordem pela data, não pela ordem de gravação', async (t) => {
  const j = await jogador(t);
  const dia = 86_400_000;
  const agora = Date.now();
  const base = { conta: j.conta.id, personagem: j.id, nome: j.nome, imagem: null };
  await HistoricoDaLoja.registrarCompra({ ...base, produto: 'meio', titulo: 'Meio', coins: 10, at: agora - 5 * dia });
  await HistoricoDaLoja.registrarCompra({ ...base, produto: 'velha', titulo: 'Velha', coins: 10, at: agora - 400 * dia });
  await HistoricoDaLoja.registrarCompra({ ...base, produto: 'nova', titulo: 'Nova', coins: 10, at: agora - dia });
  const { linhas } = await j.historico();
  assert.deepEqual(linhas.map((l) => l.produto), ['nova', 'meio', 'velha']);
  assert.equal(linhas[2].em, agora - 400 * dia);
});

test('F. limite: só as últimas `LIMITE`, as mais recentes', async (t) => {
  const j = await jogador(t);
  const agora = Date.now();
  const base = { conta: j.conta.id, personagem: j.id, nome: j.nome };
  for (let i = 0; i < HistoricoDaLoja.LIMITE + 10; i++) {
    await HistoricoDaLoja.registrarCompra({ ...base, produto: `p${i}`, titulo: `P${i}`, coins: 1, at: agora - i * 1000 });
  }
  const { linhas } = await j.historico();
  assert.equal(linhas.length, HistoricoDaLoja.LIMITE);
  assert.equal(linhas[0].produto, 'p0');
  assert.equal(linhas.at(-1).produto, `p${HistoricoDaLoja.LIMITE - 1}`);
});

test('o histórico é da CONTA: compras de outro personagem dela aparecem, de outra conta não', async (t) => {
  const a = await jogador(t, { coins: 500 });
  await a.s.receber({ t: 'store', action: 'buy', id: 'xp-boost' });
  a.s.desconectar();
  const b = await jogador(t, { coins: 500, conta: a.conta });
  await b.s.receber({ t: 'store', action: 'buy', id: 'wildcards-5' });
  const estranho = await jogador(t, { coins: 500 });
  await estranho.s.receber({ t: 'store', action: 'buy', id: 'xp-boost' });
  const { linhas } = await b.historico();
  assert.deepEqual(linhas.map((l) => [l.produto, l.personagem]), [['wildcards-5', b.nome], ['xp-boost', a.nome]]);
  assert.equal((await estranho.historico()).linhas.length, 1);
});

test('compra recusada (sem saldo, produto inexistente) não vira linha', async (t) => {
  const j = await jogador(t, { coins: 5 });
  await j.s.receber({ t: 'store', action: 'buy', id: 'premium-7' });
  await j.s.receber({ t: 'store', action: 'buy', id: 'nao-existe' });
  assert.equal(j.s.estado.coins, 5);
  assert.deepEqual((await j.historico()).linhas, []);
});

test('a linha é gravada na MESMA transação da compra: falhou a gravação, a compra volta', async (t) => {
  const j = await jogador(t, { coins: 1000 });
  B.db.exec('ALTER TABLE loja_historico RENAME TO loja_historico_fora');
  try {
    await assert.rejects(() => j.s.receber({ t: 'store', action: 'buy', id: 'xp-boost' }));
  } finally {
    B.db.exec('ALTER TABLE loja_historico_fora RENAME TO loja_historico');
  }
  const gravado = JSON.parse(B.db.prepare('SELECT estado FROM personagens WHERE id = ?').get(j.id).estado);
  assert.equal(gravado.coins, 1000, 'o banco não pode ter a compra sem a linha');
});

test('G. erro no banco ao ler: a resposta vem assim mesmo, com `erro` (a janela não trava)', async (t) => {
  const j = await jogador(t);
  B.db.exec('ALTER TABLE loja_historico RENAME TO loja_historico_fora2');
  let r;
  try {
    r = await j.historico();
  } finally {
    B.db.exec('ALTER TABLE loja_historico_fora2 RENAME TO loja_historico');
  }
  assert.deepEqual(r.linhas, []);
  assert.match(r.erro, /histórico/);
});

test('I. abrir a loja e comprar respondem a prateleira (`store`) — é o que dispara a recarga da janela aberta', async (t) => {
  const j = await jogador(t, { coins: 1000 });
  j.enviados.length = 0;
  await j.s.receber({ t: 'store' });
  assert.equal(j.enviados.filter((m) => m.t === 'store').length, 1);
  j.enviados.length = 0;
  await j.s.receber({ t: 'store', action: 'buy', id: 'xp-boost' });
  assert.equal(j.enviados.filter((m) => m.t === 'store').length, 1);
  // Olhar a loja não é compra: nenhuma linha.
  assert.equal((await j.historico()).linhas.length, 1);
});
