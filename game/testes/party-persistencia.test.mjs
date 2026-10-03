// A party sobrevive à desconexão e ao reinício (`party.mjs`: `saiuDoJogo`/`entrouNoJogo`/`varrer`/`carregar`).
import { test, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
// Uma tabela SÓ deste teste (os outros arquivos de teste, em outros processos, também gravam parties no banco compartilhado).
const TABELA = `parties_salvas_t${process.pid}`;
process.env.PARTY_TABELA = TABELA;
const B = await import('../database/banco.mjs');
const { Sessao, vivas } = await import('../websocket/sessao.mjs');
const Party = await import('../systems/party.mjs');
const R = await import('../systems/regras.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');

const criadas = [];
after(async () => {
  for (const { s, nome, conta } of criadas) {
    s.desconectar();
    vivas.delete(nome);
    await B.db.prepare('DELETE FROM melhorias_da_conta WHERE conta = ?').run(conta);
    await B.db.prepare('DELETE FROM contas WHERE id = ?').run(conta);
  }
  await B.banco.exec(`DROP TABLE IF EXISTS ${TABELA}`);
});
beforeEach(async () => {
  Party._esquecerParaTeste();
  await B.banco.prepare(`DELETE FROM ${TABELA}`).run();
});

async function entrar(nome, conta, level = 60) {
  const avisos = [];
  const s = new Sessao({ readyState: 1, bufferedAmount: 0, send: (d) => avisos.push(JSON.parse(d)) });
  s.conta = { id: conta };
  const e = personagemDeTeste({ vocacao: 'knight', level });
  e.pos = { ...R.POSICAO_INICIAL };
  await s.concluirEntrada({ id: randomUUID(), nome }, e, null, null);
  criadas.push({ s, nome, conta });
  return { s, nome, avisos };
}
async function conta() {
  const c = await B.criarConta({ email: `partyp-${randomUUID()}@teste.local`, senha: 'senha-123' });
  await B.gravarMelhoriasDaConta(c.id, { slotsDeParty: 3 });
  await B.lerMelhoriasDaConta(c.id);
  return c.id;
}
const nomeNovo = (p) => `${p}${randomUUID().replace(/[^a-z]/g, '').slice(0, 7)}`;
async function trio() {
  const js = [];
  for (const p of ['Ca', 'Cb', 'Cc']) js.push(await entrar(nomeNovo(p), await conta()));
  const [a, b, c] = js;
  for (const o of [b, c]) {
    assert.equal(Party.comandoDoGrupo(a.s, { action: 'convidar', name: o.nome }).ok, true);
    assert.equal(Party.comandoDoGrupo(o.s, { action: 'aceitar' }).ok, true);
  }
  return { a, b, c };
}
const membros = (j) => Party.camposDoPersonagem(j.s).party?.membros ?? [];
const sair = (j) => { j.s.soltarPersonagem(); vivas.delete(j.nome); };

test('S1. desconectar NÃO tira da party: o membro fica offline (com o cartão dele) e volta ao reconectar', async () => {
  const { a, b, c } = await trio();
  sair(c);
  const m = membros(a).find((x) => x.nome === c.nome);
  assert.ok(m, 'continua na lista');
  assert.equal(m.online, false);
  assert.equal(m.level, 60, 'o cartão guarda o level de quando saiu');
  assert.ok(m.voltaEm > 0 && m.voltaEm <= Party.GRACE_MS, 'quanto falta para o prazo de volta acabar');
  assert.equal(membros(a).length, 3);
  const volta = await entrar(c.nome, c.s.conta.id);
  assert.equal(membros(volta).find((x) => x.nome === c.nome).online, true);
  assert.equal(membros(a).find((x) => x.nome === c.nome).online, true);
  assert.ok(volta.avisos.some((m2) => /voltou para a sua party/.test(m2.notice ?? '')), 'ele é avisado');
  void b;
});

test('S2. o líder desconecta: o próximo online conduz; quando o líder volta no prazo, retoma a liderança', async () => {
  const { a, b, c } = await trio();
  sair(a);
  const vistoPorB = Party.camposDoPersonagem(b.s).party;
  assert.equal(vistoPorB.lider, b.nome, 'o próximo conduz');
  assert.equal(Party.comandoDoGrupo(b.s, { action: 'convidar', name: 'ninguem' }).erro?.includes('Só o líder'), false, 'b já pode agir como líder');
  const volta = await entrar(a.nome, a.s.conta.id);
  assert.equal(Party.camposDoPersonagem(volta.s).party.lider, a.nome, 'a retoma');
  assert.equal(Party.camposDoPersonagem(c.s).party.lider, a.nome);
});

test('S3. o modo e a coleira do membro voltam com ele', async () => {
  const { a, b } = await trio();
  Party.comandoDaCaca(b.s, { action: 'modo', valor: 'independente' });
  Party.comandoDaCaca(b.s, { action: 'coleira', valor: 3 });
  sair(b);
  const volta = await entrar(b.nome, b.s.conta.id);
  const eu = membros(volta).find((x) => x.nome === b.nome);
  assert.equal(eu.modo, 'independente');
  assert.equal(eu.coleira, 3);
  void a;
});

test('S4. passou do prazo, o offline sai da party; com menos de 2 a party acaba e some do banco', async () => {
  const { a, b, c } = await trio();
  sair(c);
  await Party.varrer(Date.now() + Party.GRACE_MS - 1000);
  assert.equal(membros(a).length, 3, 'antes do prazo, fica');
  await Party.varrer(Date.now() + Party.GRACE_MS + 1000);
  assert.deepEqual(membros(a).map((x) => x.nome).sort(), [a.nome, b.nome].sort());
  sair(b);
  await Party.varrer(Date.now() + 2 * Party.GRACE_MS);
  assert.equal(Party.camposDoPersonagem(a.s).party, null, 'sobrou um só: a party acabou');
  await Party.gravarMudancas();
  assert.equal(Number((await B.banco.prepare(`SELECT COUNT(*) AS n FROM ${TABELA}`).get()).n), 0);
});

test('S5. o líder que não volta no prazo perde o lugar de vez (e não reassume ao voltar tarde)', async () => {
  const { a, b } = await trio();
  sair(a);
  await Party.varrer(Date.now() + Party.GRACE_MS + 1000);
  assert.equal(membros(b).some((x) => x.nome === a.nome), false);
  const volta = await entrar(a.nome, a.s.conta.id);
  assert.equal(Party.camposDoPersonagem(volta.s).party, null, 'voltou tarde: está fora da party');
  assert.equal(Party.camposDoPersonagem(b.s).party.lider, b.nome);
});

test('S6. reinício do servidor: a party é gravada, recarregada com todos offline, e cada um volta ao seu lugar', async () => {
  const { a, b, c } = await trio();
  Party.comandoDaCaca(c.s, { action: 'modo', valor: 'independente' });
  assert.ok((await Party.gravarMudancas()) >= 1);
  assert.equal(Number((await B.banco.prepare(`SELECT COUNT(*) AS n FROM ${TABELA}`).get()).n), 1);
  for (const j of [a, b, c]) sair(j);
  // "Reinício": a memória some, o banco fica.
  Party._esquecerParaTeste();
  assert.equal(await Party.carregar(), 1);
  const a2 = await entrar(a.nome, a.s.conta.id);
  const lista = membros(a2);
  assert.equal(lista.length, 3);
  assert.equal(lista.find((x) => x.nome === a.nome).online, true);
  assert.equal(lista.find((x) => x.nome === b.nome).online, false, 'quem ainda não voltou aparece offline');
  const c2 = await entrar(c.nome, c.s.conta.id);
  assert.equal(membros(c2).find((x) => x.nome === c.nome).modo, 'independente', 'o modo sobreviveu ao reinício');
  assert.equal(Party.camposDoPersonagem(a2.s).party.lider, a.nome);
});

test('S7. depois do reinício, quem não volta em 10 min sai; party gravada com um só membro ou com JSON ruim é descartada', async () => {
  const { a, b } = await trio();
  await Party.gravarMudancas();
  await B.banco.prepare(`INSERT INTO ${TABELA} (id, dados, atualizado_em) VALUES (9001, '{ruim', 1)`).run();
  await B.banco.prepare(`INSERT INTO ${TABELA} (id, dados, atualizado_em) VALUES (9002, ?, 1)`).run(JSON.stringify({ id: 9002, lider: 'x', membros: ['x'] }));
  for (const j of [a, b]) sair(j);
  Party._esquecerParaTeste();
  assert.equal(await Party.carregar(), 1, 'só a boa volta');
  assert.equal(Number((await B.banco.prepare(`SELECT COUNT(*) AS n FROM ${TABELA} WHERE id IN (9001, 9002)`).get()).n), 0, 'as ruins foram apagadas');
  const a2 = await entrar(a.nome, a.s.conta.id);
  await Party.varrer(Date.now() + Party.GRACE_APOS_REINICIO_MS + 1000);
  assert.ok(!membros(a2).some((x) => x.nome === b.nome), 'quem não voltou saiu');
});

test('S8. ids novos não colidem com os recarregados; sair de verdade (comando) continua tirando na hora', async () => {
  const { a, b, c } = await trio();
  await Party.gravarMudancas();
  for (const j of [a, b, c]) sair(j);
  Party._esquecerParaTeste();
  await Party.carregar();
  const d = await entrar(nomeNovo('Cd'), await conta());
  const e = await entrar(nomeNovo('Ce'), await conta());
  assert.equal(Party.comandoDoGrupo(d.s, { action: 'convidar', name: e.nome }).ok, true);
  assert.equal(Party.comandoDoGrupo(e.s, { action: 'aceitar' }).ok, true);
  const dados = (await B.banco.prepare(`SELECT id FROM ${TABELA}`).all()).length;
  await Party.gravarMudancas();
  assert.equal((await B.banco.prepare(`SELECT id FROM ${TABELA}`).all()).length, dados + 1);
  Party.comandoDoGrupo(e.s, { action: 'sair' });
  assert.equal(Party.camposDoPersonagem(d.s).party, null, 'sair pelo comando é na hora');
});
