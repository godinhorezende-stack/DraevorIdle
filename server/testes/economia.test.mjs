// Comandos de economia gravam as duas pontas na mesma transação (ver
// `Sessao.emTransacao`): se o processo cair logo depois, o banco já tem o
// personagem de quem mandou E a outra ponta — sem item duplicado nem ouro
// criado do nada. Aqui "cair" é só não chamar o autosave: tudo é lido direto
// do banco logo depois do comando.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import * as B from '../../game/database/banco.mjs';
import { Sessao, vivas } from '../../game/websocket/sessao.mjs';
import { ITEM_CATALOG } from '../../game/systems/dados.mjs';
import { personagemDeTeste } from './apoio.mjs';

const socket = () => ({ readyState: 1, send: () => {} });
const noBanco = (id) => JSON.parse(B.db.prepare('SELECT estado FROM personagens WHERE id = ?').get(id).estado);
const quantos = (estado, item) => (estado.inventory ?? []).filter((p) => p.id === item).reduce((a, p) => a + (p.count ?? 1), 0);

/** Um jogador ONLINE (sessão viva, em `vivas`), com a linha no banco. */
async function jogador(t, prefixo) {
  const conta = await B.criarConta({ email: `${prefixo}-${randomUUID()}@teste.local`, senha: 'x' });
  const nome = `${prefixo}${randomUUID().replace(/[^a-z]/g, '').slice(0, 8)}`;
  const estado = personagemDeTeste({ level: 100 });
  estado.gold = 10_000;
  const p = await B.criarPersonagem({ conta: conta.id, nome, vocacao: 'knight', sexo: 'male', estadoInicial: estado });
  const s = new Sessao(socket());
  s.conta = await B.contaPorId(conta.id);
  await s.receber({ t: 'play', name: nome });
  assert.equal(vivas.get(nome), s, 'não entrou no jogo');
  t.after(() => {
    s.desconectar();
    B.db.prepare('DELETE FROM mercado_ofertas WHERE personagem = ?').run(p.id);
    B.db.prepare('DELETE FROM mercado_historico WHERE personagem = ?').run(p.id);
    B.db.prepare('DELETE FROM creditos WHERE personagem = ?').run(p.id);
    B.db.prepare('DELETE FROM personagens WHERE id = ?').run(p.id);
    B.db.prepare('DELETE FROM sessoes WHERE conta = ?').run(conta.id);
    B.db.prepare('DELETE FROM contas WHERE id = ?').run(conta.id);
  });
  return { s, id: p.id, nome };
}

test('mercado: anunciar e comprar deixam o banco certo sem esperar o autosave', async (t) => {
  const vendedor = await jogador(t, 'Vend');
  const comprador = await jogador(t, 'Comp');
  const item = vendedor.s.estado.inventory.find((p) => ITEM_CATALOG[p.id])?.id;
  assert.ok(item, 'o personagem de teste não tem item na mochila');
  const tinha = quantos(vendedor.s.estado, item);

  await vendedor.s.receber({ t: 'market', action: 'offer', kind: 'sell', id: item, count: 1, price: 700, moeda: 'gold' });
  const oferta = B.db.prepare('SELECT * FROM mercado_ofertas WHERE personagem = ?').get(vendedor.id);
  assert.ok(oferta, 'a oferta não foi criada');
  // A oferta existe no banco E o item já saiu da mochila gravada: uma queda agora não duplica.
  assert.equal(quantos(noBanco(vendedor.id), item), tinha - 1);

  await comprador.s.receber({ t: 'market', action: 'accept', offerId: oferta.id, count: 1 });
  assert.equal(B.db.prepare('SELECT * FROM mercado_ofertas WHERE id = ?').get(oferta.id), undefined, 'a oferta continua no banco');
  const c = noBanco(comprador.id);
  const v = noBanco(vendedor.id);
  // O comprador gravado já pagou e já tem o item; o vendedor (online) gravado já recebeu.
  assert.equal(quantos(c, item), quantos(comprador.s.estado, item));
  assert.ok(quantos(c, item) >= 1);
  assert.equal(c.gold + (c.bank ?? 0), comprador.s.estado.gold + (comprador.s.estado.bank ?? 0));
  assert.equal(v.gold + (v.bank ?? 0), vendedor.s.estado.gold + (vendedor.s.estado.bank ?? 0));
  assert.ok(v.gold + (v.bank ?? 0) > 10_000, 'o vendedor gravado não recebeu');
});

test('olhar o mercado não abre transação nem grava ninguém', async (t) => {
  const j = await jogador(t, 'Olha');
  let gravou = 0;
  const gravar = j.s.gravarAgora;
  j.s.gravarAgora = () => (gravou++, gravar.call(j.s));
  await j.s.receber({ t: 'market', action: 'offers', filtros: {} });
  await j.s.receber({ t: 'market' });
  assert.equal(gravou, 0);
});

test('erro no meio: nada do comando fica no banco (ROLLBACK)', async (t) => {
  const j = await jogador(t, 'Erro');
  const antes = B.db.prepare('SELECT count(*) AS n FROM mercado_historico WHERE personagem = ?').get(j.id).n;
  await assert.rejects(() =>
    j.s.emTransacao(() => {
      B.db.prepare('INSERT INTO mercado_historico (personagem, lado, item, count, price, moeda, outro, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(j.id, 'compra', 1, 1, 1, 'gold', 'x', Date.now());
      throw new Error('falhou no meio');
    }),
  );
  assert.equal(B.db.prepare('SELECT count(*) AS n FROM mercado_historico WHERE personagem = ?').get(j.id).n, antes);
  // E a sessão segue podendo abrir outra.
  await j.s.emTransacao(() => {});
});
