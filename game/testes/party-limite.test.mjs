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

test('diferença de level: até 10 entra na party; 11 não', async () => {
  const a = await jogador(0, 1, 60);
  const dez = await jogador(1, 1, 50);
  const onze = await jogador(2, 1, 71);
  const r = grupo(a.s, 'convidar', onze.nome);
  assert.equal(r.ok, false);
  assert.match(r.erro, /no máximo 10: .* é level 71 e .* é level 60/);
  assert.equal(Party.camposDoPersonagem(a.s).party, null, 'recusado não deixa party de um só');
  assert.equal(grupo(a.s, 'convidar', dez.nome).ok, true);
  assert.equal(grupo(dez.s, 'aceitar').ok, true);
  grupo(dez.s, 'sair');
});

test('subiu de level na caçada e passou de 10: continua na party, mas a partilha desliga', async () => {
  const alto = await jogador(0, 1, 60);
  const baixo = await jogador(1, 1, 55);
  grupo(alto.s, 'convidar', baixo.nome);
  grupo(baixo.s, 'aceitar');
  assert.equal(Cacadas.entrar(alto.s.estado, { huntId: 'troll-cave', mode: 'auto' }).ok, true);
  caca(alto.s, 'invite', baixo.nome);
  assert.equal(caca(baixo.s, 'accept').ok, true);
  assert.equal(Party.partilha(alto.s).ativa, true);
  alto.s.estado.level = 66;
  const p = Party.partilha(alto.s);
  assert.equal(p.ativa, false);
  assert.equal(p.motivo, 'level');
  assert.deepEqual(p.faixa, { min: 56, max: 65 });
  grupo(baixo.s, 'sair');
});

test('hunt não liberada (level da hunt): nem o chamado, nem o pedido, nem a entrada', async () => {
  const host = await jogador(0, 1, 45);
  const novato = await jogador(1, 1, 36);
  grupo(host.s, 'convidar', novato.nome);
  assert.equal(grupo(novato.s, 'aceitar').ok, true);
  // Port Hope pede level 40.
  const huntId = 'port-hope-corym-dungeons';
  assert.equal(Cacadas.levelDaHunt(huntId), 40);
  assert.equal(Cacadas.entrar(host.s.estado, { huntId, mode: 'auto' }).ok, true);
  const chamado = caca(host.s, 'invite', novato.nome);
  assert.equal(chamado.ok, false);
  assert.match(chamado.erro, /ainda não liberou .*pede level 40.* é level 36/);
  const pedido = caca(novato.s, 'pedir', host.nome);
  assert.equal(pedido.ok, false);
  assert.match(pedido.erro, /ainda não liberou/);
  assert.equal(novato.s.estado.hunt ?? null, null, 'e ele não entrou');
  // Subiu para 40: agora pode.
  novato.s.estado.level = 40;
  assert.equal(caca(host.s, 'invite', novato.nome).ok, true);
  assert.equal(caca(novato.s, 'accept').ok, true);
  assert.equal(Cacadas.salaDe(novato.s.estado.hunt), Cacadas.salaDe(host.s.estado.hunt));
  grupo(novato.s, 'sair');
});

test('aceitou o chamado caçando em outro lugar: o extrato da caçada de antes aparece para ele', async () => {
  const host = await jogador(0, 1, 60);
  const outro = await jogador(1, 1, 60);
  grupo(host.s, 'convidar', outro.nome);
  grupo(outro.s, 'aceitar');
  assert.equal(Cacadas.entrar(outro.s.estado, { huntId: 'amazon-camp', mode: 'auto' }).ok, true);
  for (let i = 0; i < 4; i++) await outro.s.tique();
  assert.equal(Cacadas.entrar(host.s.estado, { huntId: 'troll-cave', mode: 'auto' }).ok, true);
  const antes = outro.avisos.filter((m) => m.t === 'runReport').length;
  caca(host.s, 'invite', outro.nome);
  assert.equal(caca(outro.s, 'accept').ok, true);
  const extratos = outro.avisos.filter((m) => m.t === 'runReport');
  assert.equal(extratos.length, antes + 1, 'um extrato');
  assert.match(extratos.at(-1).motivo, /Você saiu de Amazon Camp para entrar na caçada de/);
  assert.ok(extratos.at(-1).report);
  grupo(outro.s, 'sair');
});

// ---------------------------------------------------- a divisão do LOOT na party

import * as Combate from '../systems/hunt/combate.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';

/** Quatro contas na mesma caçada, com a partilha como o tique calcula. */
async function quatroCacando() {
  const js = [];
  for (let i = 0; i < 4; i++) js.push(await jogador(i, 3));
  const [lider, ...outros] = js;
  for (const o of outros) {
    grupo(lider.s, 'convidar', o.nome);
    grupo(o.s, 'aceitar');
  }
  assert.equal(Cacadas.entrar(lider.s.estado, { huntId: 'troll-cave', mode: 'auto' }).ok, true);
  for (const o of outros) {
    caca(lider.s, 'invite', o.nome);
    assert.equal(caca(o.s, 'accept').ok, true);
  }
  const partilhar = () => {
    for (const j of js) Object.defineProperty(j.s.estado.hunt, 'partilha', { value: Party.partilha(j.s), configurable: true, writable: true });
  };
  partilhar();
  assert.equal(Party.partilha(lider.s).ativa, true);
  return { js, lider, partilhar };
}

/** Mata um bicho da sala com o loot trocado por `loot` (chance 1 = cai sempre). */
function matar(quem, loot, key) {
  const hunt = quem.s.estado.hunt;
  const alvo = hunt.monstros.find((m) => m.hp > 0) ?? hunt.monstros[0];
  alvo.loot = loot;
  if (key) alvo.key = key;
  const eventos = [];
  Combate.matarMonstro(quem.s.estado, hunt, quem.s.personagem, alvo, eventos);
  return eventos;
}

const leve = Object.entries(ITEM_CATALOG)
  .filter(([id, it]) => (it.weight ?? 0) > 0 && (it.weight ?? 0) <= 100 && ![3031, 3035, 3043].includes(Number(id)) && it.pickupable !== false)
  .map(([id]) => Number(id))
  .slice(0, 50);

test('party: o OURO de cada bicho vai em partes iguais para os quatro (o resto, para quem matou)', async () => {
  const { js, lider } = await quatroCacando();
  const antes = js.map((j) => j.s.estado.gold);
  for (let i = 0; i < 20; i++) matar(i % 3 === 0 ? js[1] : lider, [{ id: 3031, chance: 1 }]);
  const ganho = js.map((j, i) => j.s.estado.gold - antes[i]);
  assert.ok(Math.min(...ganho) > 0, `todos ganharam: ${ganho}`);
  // O resto de cada divisão é de 0 a 3 moedas: 20 bichos, no máximo 60 de diferença.
  assert.ok(Math.max(...ganho) - Math.min(...ganho) <= 60, `quase igual: ${ganho}`);
  // E o relatório de cada um conta o ouro dele.
  for (const [i, j] of js.entries()) assert.equal(j.s.estado.hunt.sessao.gold >= ganho[i], true);
});

test('party: os ITENS vão em rodízio — cada um leva a sua vez, e o chat de quem recebeu mostra', async () => {
  const { js, lider } = await quatroCacando();
  const itensDe = (j) => Object.entries(j.s.estado.hunt.sessao.itens.loot).filter(([id]) => leve.includes(Number(id))).reduce((a, [, n]) => a + n, 0);
  const antes = js.map(itensDe);
  // Só o líder mata (o pior caso de antes: quem mata levava tudo).
  for (let i = 0; i < 10; i++) matar(lider, leve.slice(0, 4).map((id) => ({ id, chance: 1 })));
  const recebidos = js.map((j, i) => itensDe(j) - antes[i]);
  assert.equal(recebidos.reduce((a, b) => a + b, 0), 40, `todos os 40 itens foram para alguém: ${recebidos}`);
  assert.deepEqual(recebidos, [10, 10, 10, 10], 'dez para cada um');
  // "Loot of a ...": quem recebeu vê no chat dele (no próximo tique).
  for (const j of js.slice(1)) {
    const ev = Combate.tirarEventosDaParty(j.s.estado);
    assert.ok(ev?.length, `${j.nome} viu o loot`);
    assert.equal(ev.flatMap((e) => e.items).length, 10);
  }
  assert.equal(Combate.tirarEventosDaParty(lider.s.estado), null, 'o líder viu o dele no próprio golpe');
});

test('party: quem não pode levar (filtro do loot) passa a vez — o item não se perde', async () => {
  const { js, lider } = await quatroCacando();
  const item = leve[0];
  // O paladin (js[1]) não quer este item.
  js[1].s.estado.itemRules ??= {};
  (js[1].s.estado.itemRules.noLoot ??= []).push(item);
  const conta = (j) => j.s.estado.hunt.sessao.itens.loot[item] ?? 0;
  const antes = js.map(conta);
  for (let i = 0; i < 12; i++) matar(lider, [{ id: item, chance: 1 }]);
  const recebidos = js.map((j, i) => conta(j) - antes[i]);
  assert.equal(recebidos[1], 0, 'o que recusa não leva');
  assert.equal(recebidos.reduce((a, b) => a + b, 0), 12, `nada ficou no chão: ${recebidos}`);
  assert.deepEqual(recebidos.filter((_, i) => i !== 1), [4, 4, 4]);
});

test('party: a exp continua igual para todos, e a Boss Task conta para todos', async () => {
  const { js, lider } = await quatroCacando();
  const task = (j) => j.s.estado.bossTasks?.find((t) => t.alvos?.some((a) => a.key === 'minotaur'));
  assert.ok(task(lider), 'a ficha tem a Boss Task de minotauro');
  const xp = js.map((j) => j.s.estado.xp);
  const kills = js.map((j) => task(j).kills);
  for (let i = 0; i < 5; i++) matar(lider, [], 'minotaur');
  for (const [i, j] of js.entries()) assert.ok(task(j).kills >= kills[i] + 5, `${j.nome}: Boss Task andou`);
  const ganhos = js.map((j, i) => j.s.estado.xp - xp[i]);
  assert.ok(Math.max(...ganhos) - Math.min(...ganhos) <= 5, `exp igual: ${ganhos}`);
});
