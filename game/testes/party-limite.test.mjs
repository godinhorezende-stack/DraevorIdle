// Party com VÁRIOS jogadores, até o limite: o grupo (convidar/aceitar), o teto
// (2 + os "Slot de party" da conta com MENOS slots, até 5), a caçada em grupo
// (todo mundo na MESMA sala, com os mesmos bichos), a partilha da exp com o
// bônus por vocações, e o que acontece quando o líder sai.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import * as B from '../database/banco.mjs';
import { Sessao, vivas } from '../websocket/sessao.mjs';
import * as Party from '../systems/party.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as R from '../systems/regras.mjs';
import { personagemDeTeste } from './apoio.mjs';

const VOCACOES = ['knight', 'paladin', 'druid', 'sorcerer', 'monk', 'knight'];
const criadas = [];

after(async () => {
  for (const { s, nome, conta } of criadas) {
    s.desconectar();
    vivas.delete(nome);
    await B.db.prepare('DELETE FROM melhorias_da_conta WHERE conta = ?').run(conta);
    await B.db.prepare('DELETE FROM contas WHERE id = ?').run(conta);
  }
});

/** Um jogador conectado, numa conta própria com `slots` Slots de party. */
async function jogador(i, slots = 0, level = 60) {
  const conta = await B.criarConta({ email: `party-${randomUUID()}@teste.local`, senha: 'senha-123' });
  if (slots) await B.gravarMelhoriasDaConta(conta.id, { slotsDeParty: slots });
  await B.lerMelhoriasDaConta(conta.id);
  const avisos = [];
  const s = new Sessao({ readyState: 1, bufferedAmount: 0, send: (d) => avisos.push(JSON.parse(d)) });
  s.conta = { id: conta.id };
  const nome = `Pt${i}${randomUUID().replace(/[^a-z]/g, '').slice(0, 6)}`;
  const e = personagemDeTeste({ vocacao: VOCACOES[i % VOCACOES.length], level });
  e.pos = { ...R.POSICAO_INICIAL };
  await s.concluirEntrada({ id: randomUUID(), nome }, e, null, null);
  criadas.push({ s, nome, conta: conta.id });
  return { s, nome, avisos };
}

const grupo = (s, action, name) => Party.comandoDoGrupo(s, { action, name });
const caca = (s, action, name) => Party.comandoDaCaca(s, { action, name });
const naMesmaSala = (a, b) => Cacadas.salaDe(a.estado.hunt) === Cacadas.salaDe(b.estado.hunt);

test('sem Slot de party: a party para em 2, e o terceiro ouve "cheia"', async () => {
  const [a, b, c] = [await jogador(0), await jogador(1), await jogador(2)];
  assert.equal(grupo(a.s, 'convidar', b.nome).ok, true);
  assert.equal(grupo(b.s, 'aceitar').ok, true);
  const r = grupo(a.s, 'convidar', c.nome);
  assert.equal(r.ok, false);
  assert.match(r.erro, /cheia \(2 lugares\)/);
  assert.equal(Party.camposDoPersonagem(a.s).party.maximo, 2);
  // Só o líder convida.
  assert.match(grupo(b.s, 'convidar', c.nome).erro, /Só o líder/);
  grupo(b.s, 'sair');
  assert.equal(Party.camposDoPersonagem(a.s).party, null, 'com um só, a party se desfaz');
});

test('com 3 Slots em todas as contas: cinco na party, na MESMA caçada, com a partilha e o bônus de vocações', async () => {
  const js = [];
  for (let i = 0; i < 6; i++) js.push(await jogador(i, 3));
  const [lider, ...outros] = js;
  for (const o of outros.slice(0, 4)) {
    assert.equal(grupo(lider.s, 'convidar', o.nome).ok, true, `convite para ${o.nome}`);
    assert.equal(grupo(o.s, 'aceitar').ok, true, `${o.nome} aceita`);
  }
  const sexto = outros[4];
  const cheio = grupo(lider.s, 'convidar', sexto.nome);
  assert.equal(cheio.ok, false);
  assert.match(cheio.erro, /cheia \(5 lugares\)/);
  const party = Party.camposDoPersonagem(lider.s).party;
  assert.equal(party.maximo, 5);
  assert.equal(party.membros.length, 5);

  // O líder abre a caçada e chama cada um: todos na MESMA sala.
  assert.equal(Cacadas.entrar(lider.s.estado, { huntId: 'troll-cave', mode: 'auto' }).ok, true);
  for (const o of outros.slice(0, 4)) {
    assert.equal(caca(lider.s, 'invite', o.nome).ok, true, `chamado para ${o.nome}`);
    const r = caca(o.s, 'accept');
    assert.equal(r.ok, true, `${o.nome} entra: ${r.erro ?? ''}`);
    assert.ok(naMesmaSala(o.s, lider.s));
  }
  // Os bichos são OS MESMOS (a mesma lista) para os cinco.
  for (const o of outros.slice(0, 4)) assert.equal(o.s.estado.hunt.monstros, lider.s.estado.hunt.monstros);

  // Partilha: cinco juntos, mesmo level, perto — ativa, com o bônus de 4+ vocações diferentes.
  const p = Party.partilha(lider.s);
  assert.equal(p.membros.length, 5);
  assert.equal(p.ativa, true, `motivo: ${p.motivo}`);
  assert.equal(p.vocacoes, 5);
  assert.equal(p.bonus, 2);

  // O sexto não é da party: não dá para chamá-lo.
  assert.match(caca(lider.s, 'invite', sexto.nome).erro, /party primeiro/);

  // Os cinco caçam juntos alguns tiques sem quebrar nada.
  for (let t = 0; t < 12; t++) for (const j of js.slice(0, 5)) await j.s.tique();
  for (const o of outros.slice(0, 4)) assert.ok(o.s.estado.hunt && naMesmaSala(o.s, lider.s), 'seguem juntos');

  // O líder sai do jogo: o próximo assume a party E a sala, e os quatro continuam juntos.
  lider.s.soltarPersonagem();
  const depois = Party.camposDoPersonagem(outros[0].s).party;
  assert.equal(depois.membros.length, 4);
  assert.equal(depois.lider, outros[0].nome);
  const sala = Cacadas.salaDe(outros[0].s.estado.hunt);
  for (const o of outros.slice(1, 4)) assert.equal(Cacadas.salaDe(o.s.estado.hunt), sala);
  for (let t = 0; t < 4; t++) for (const o of outros.slice(0, 4)) await o.s.tique();
});

test('a party fica no tamanho da conta com MENOS slots', async () => {
  const lider = await jogador(0, 3);
  const pobre = await jogador(1, 0);
  const terceiro = await jogador(2, 3);
  assert.equal(grupo(lider.s, 'convidar', pobre.nome).ok, true);
  assert.equal(grupo(pobre.s, 'aceitar').ok, true);
  const r = grupo(lider.s, 'convidar', terceiro.nome);
  assert.equal(r.ok, false, 'com uma conta sem slots dentro, o teto é 2');
  assert.match(r.erro, /cheia \(2 lugares\)/);
  grupo(pobre.s, 'sair');
});

test('partilha desliga fora da faixa de level (o menor abaixo de 2/3 do maior)', async () => {
  const alto = await jogador(0, 1, 90);
  const baixo = await jogador(1, 1, 40);
  grupo(alto.s, 'convidar', baixo.nome);
  grupo(baixo.s, 'aceitar');
  assert.equal(Cacadas.entrar(alto.s.estado, { huntId: 'troll-cave', mode: 'auto' }).ok, true);
  caca(alto.s, 'invite', baixo.nome);
  assert.equal(caca(baixo.s, 'accept').ok, true);
  const p = Party.partilha(alto.s);
  assert.equal(p.ativa, false);
  assert.equal(p.motivo, 'level');
  grupo(baixo.s, 'sair');
});
