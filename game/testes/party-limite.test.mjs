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

test('campanha na party: quem não liberou a fase entra mesmo assim (o amigo carrega), e a morte conta para todos', async () => {
  const host = await jogador(0, 1, 45);
  const novato = await jogador(1, 1, 38);
  novato.s.estado.campanha = {}; // começando a campanha: só a fase 1 do Fácil
  grupo(host.s, 'convidar', novato.nome);
  assert.equal(grupo(novato.s, 'aceitar').ok, true);
  const huntId = 'port-hope-corym-dungeons';
  assert.equal(Cacadas.entrar(host.s.estado, { huntId, mode: 'auto' }).ok, true);
  // Sozinho ele não entraria:
  assert.match(Cacadas.entrar(structuredClone(novato.s.estado), { huntId, mode: 'auto' }).erro, /Complete a fase anterior/);
  // Na party, entra (chamado e pedido).
  assert.equal(caca(host.s, 'invite', novato.nome).ok, true);
  assert.equal(caca(novato.s, 'accept').ok, true);
  assert.equal(Cacadas.salaDe(novato.s.estado.hunt), Cacadas.salaDe(host.s.estado.hunt));
  assert.deepEqual(novato.s.estado.hunt.campanha, host.s.estado.hunt.campanha, 'caça a mesma fase');
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
  // No Médio (level alvo 101): no Fácil a Troll Cave é a fase 1 e quase não dá ouro para dividir.
  assert.equal(Cacadas.entrar(lider.s.estado, { huntId: 'troll-cave', mode: 'auto', dificuldade: 'medio' }).ok, true);
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

// ------------------------------------------ as opções da ⚙ Config / janela de party

/** Monta a party: o primeiro é o líder. */
function partyDe(lider, ...outros) {
  for (const o of outros) {
    assert.equal(grupo(lider.s, 'convidar', o.nome).ok, true);
    assert.equal(grupo(o.s, 'aceitar').ok, true);
  }
}

test('"Permitir entrar na caçada": marcado, a party entra direto; sem marcar, só pedindo', async () => {
  const host = await jogador(0, 1, 60);
  const outro = await jogador(1, 1, 60);
  partyDe(host, outro);
  assert.equal(Cacadas.entrar(host.s.estado, { huntId: 'troll-cave', mode: 'auto' }).ok, true);
  const semMarca = caca(outro.s, 'entrar', host.nome);
  assert.equal(semMarca.ok, false);
  assert.match(semMarca.erro, /não liberou a entrada direta/);
  const cartao = () => Party.camposDoPersonagem(outro.s).party.membros.find((m) => m.name === host.nome);
  assert.equal(cartao().podeEntrarDireto, false);

  host.s.estado.settings.entrarSemConvite = true;
  assert.equal(cartao().podeEntrarDireto, true, 'a janela mostra "Entrar na caçada"');
  assert.equal(caca(outro.s, 'entrar', host.nome).ok, true);
  assert.equal(Cacadas.salaDe(outro.s.estado.hunt), Cacadas.salaDe(host.s.estado.hunt));
  grupo(outro.s, 'sair');
});

test('"Permitir entrar na caçada" vale mesmo para quem ainda não liberou a fase', async () => {
  const host = await jogador(0, 1, 45);
  const novato = await jogador(1, 1, 38);
  novato.s.estado.campanha = {};
  partyDe(host, novato);
  host.s.estado.settings.entrarSemConvite = true;
  assert.equal(Cacadas.entrar(host.s.estado, { huntId: 'port-hope-corym-dungeons', mode: 'auto' }).ok, true);
  const cartao = Party.camposDoPersonagem(novato.s).party.membros.find((m) => m.name === host.nome);
  assert.equal(cartao.podeEntrarDireto, true, 'o botão aparece');
  assert.equal(caca(novato.s, 'entrar', host.nome).ok, true);
  grupo(novato.s, 'sair');
});

test('"Seguir líder": vai junto na caçada, na troca de hunt, na volta para a cidade e na morte', async () => {
  const lider = await jogador(0, 3, 60);
  const segue = await jogador(1, 3, 60);
  const naoSegue = await jogador(2, 3, 60);
  partyDe(lider, segue, naoSegue);
  segue.s.estado.settings.seguirLider = true;

  // Entrou numa caçada: quem segue vem; quem não marcou, não.
  lider.s.despachar({ t: 'startHunt', huntId: 'troll-cave', mode: 'auto' });
  assert.equal(lider.s.estado.hunt?.huntId, 'troll-cave');
  assert.equal(Cacadas.salaDe(segue.s.estado.hunt), Cacadas.salaDe(lider.s.estado.hunt), 'seguiu');
  assert.equal(naoSegue.s.estado.hunt ?? null, null, 'quem não marcou fica');
  for (let i = 0; i < 4; i++) for (const j of [lider, segue]) await j.s.tique();

  // Trocou de hunt: vai junto, com o extrato da de antes.
  const extratos = () => segue.avisos.filter((m) => m.t === 'runReport').length;
  const antes = extratos();
  lider.s.despachar({ t: 'startHunt', huntId: 'amazon-camp', mode: 'auto' });
  assert.equal(lider.s.estado.hunt?.huntId, 'amazon-camp');
  assert.equal(segue.s.estado.hunt?.huntId, 'amazon-camp');
  assert.equal(Cacadas.salaDe(segue.s.estado.hunt), Cacadas.salaDe(lider.s.estado.hunt));
  assert.equal(extratos(), antes + 1, 'o extrato da Troll Cave');

  // Voltou para a cidade: volta junto, com o extrato.
  lider.s.despachar({ t: 'stopHunt' });
  assert.equal(lider.s.estado.hunt ?? null, null);
  assert.equal(segue.s.estado.hunt ?? null, null, 'voltou junto');
  assert.match(segue.avisos.filter((m) => m.t === 'runReport').at(-1).motivo, /voltou para a cidade — você voltou junto/);

  // Morreu: volta junto.
  lider.s.despachar({ t: 'startHunt', huntId: 'troll-cave', mode: 'auto' });
  assert.ok(segue.s.estado.hunt);
  lider.s.morrerNaHunt();
  assert.equal(segue.s.estado.hunt ?? null, null, 'voltou junto com a morte do líder');
  assert.match(segue.avisos.filter((m) => m.t === 'runReport').at(-1).motivo, /morreu — você voltou junto/);
  grupo(segue.s, 'sair');
  grupo(naoSegue.s, 'sair');
});

test('"Seguir líder" leva junto quem ainda não liberou a fase (na party, o líder carrega)', async () => {
  const lider = await jogador(0, 1, 45);
  const segue = await jogador(1, 1, 38);
  segue.s.estado.campanha = {};
  partyDe(lider, segue);
  segue.s.estado.settings.seguirLider = true;
  lider.s.despachar({ t: 'startHunt', huntId: 'port-hope-corym-dungeons', mode: 'auto' });
  assert.equal(lider.s.estado.hunt?.huntId, 'port-hope-corym-dungeons');
  assert.equal(segue.s.estado.hunt?.huntId, 'port-hope-corym-dungeons', 'seguiu');
  grupo(segue.s, 'sair');
});

test('colisão: cinco na mesma caçada nunca dividem casa (nem com bicho), e ninguém fica travado', async () => {
  const js = [];
  for (let i = 0; i < 5; i++) js.push(await jogador(i, 3));
  const [lider, ...outros] = js;
  partyDe(lider, ...outros);
  for (const o of outros) o.s.estado.settings.seguirLider = true;
  lider.s.despachar({ t: 'startHunt', huntId: 'troll-cave', mode: 'auto' });
  for (const o of outros) assert.ok(o.s.estado.hunt, `${o.nome} veio`);

  const casa = (j) => `${j.s.estado.hunt.z ?? 0}:${j.s.estado.hunt.pos.x},${j.s.estado.hunt.pos.y}`;
  const conferir = (quando) => {
    const vistas = new Map();
    for (const j of js) {
      const k = casa(j);
      assert.ok(!vistas.has(k), `${quando}: ${j.nome} e ${vistas.get(k)} na mesma casa ${k}`);
      vistas.set(k, j.nome);
    }
    for (const m of lider.s.estado.hunt.monstros) {
      if (m.hp <= 0) continue;
      const k = `${m.z ?? lider.s.estado.hunt.z ?? 0}:${m.x},${m.y}`;
      assert.ok(!vistas.has(k), `${quando}: um ${m.name} em cima de ${vistas.get(k)}`);
    }
  };
  conferir('na entrada');

  const real = Date.now;
  let agora = real();
  Date.now = () => agora;
  const andou = new Map(js.map((j) => [j.nome, 0]));
  try {
    for (let t = 0; t < 4 * 60 * 5; t++) { // 5 minutos
      agora += 250;
      for (const j of js) {
        const antes = casa(j);
        await j.s.tique();
        if (!j.s.estado.hunt) continue;
        if (casa(j) !== antes) andou.set(j.nome, andou.get(j.nome) + 1);
      }
      conferir(`tique ${t}`);
    }
  } finally {
    Date.now = real;
  }
  for (const j of js) assert.ok(andou.get(j.nome) > 5, `${j.nome} andou (${andou.get(j.nome)} passos) — não ficou travado`);
  for (const o of outros) grupo(o.s, 'sair');
});

test('colisão: barrado pelo mesmo aliado, espera — e depois de 1,5 s os dois trocam de lugar', async () => {
  const a = await jogador(0, 1, 60);
  const b = await jogador(1, 1, 60);
  partyDe(a, b);
  assert.equal(Cacadas.entrar(a.s.estado, { huntId: 'troll-cave', mode: 'online' }).ok, true);
  caca(a.s, 'invite', b.nome);
  assert.equal(caca(b.s, 'accept').ok, true);
  const ha = a.s.estado.hunt;
  const hb = b.s.estado.hunt;
  ha.monstros.splice(0); // sem bichos: só os dois
  ha.respawns?.splice(0);
  hb.modo = 'online'; // parado (Caça Online sem tecla)
  hb.manual = true;
  // B na casa andável ao lado de A.
  const grade = Cacadas.andarDaGrade(Cacadas.gradeDaHunt({ id: 'troll-cave' }), ha.z);
  const livre = (x, y) => grade.andavel.has(`${x},${y}`);
  const lado = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dy]) => livre(ha.pos.x + dx, ha.pos.y + dy));
  assert.ok(lado, 'uma casa livre ao lado');
  hb.pos.x = ha.pos.x + lado[0];
  hb.pos.y = ha.pos.y + lado[1];
  const deA = { x: ha.pos.x, y: ha.pos.y };
  const deB = { x: hb.pos.x, y: hb.pos.y };

  const real = Date.now;
  let agora = real();
  Date.now = () => agora;
  try {
    // Menos de 1,5 s andando contra B: não passa, e ninguém fica em cima de ninguém.
    for (let i = 0; i < 4; i++) {
      agora += 250;
      Cacadas.andar(a.s.estado, { dx: lado[0], dy: lado[1] });
      await a.s.tique();
      await b.s.tique();
      assert.deepEqual({ x: ha.pos.x, y: ha.pos.y }, deA, 'A espera');
      assert.deepEqual({ x: hb.pos.x, y: hb.pos.y }, deB);
    }
    // Insistindo: passados 1,5 s, trocam de lugar.
    for (let i = 0; i < 6 && ha.pos.x === deA.x && ha.pos.y === deA.y; i++) {
      agora += 250;
      Cacadas.andar(a.s.estado, { dx: lado[0], dy: lado[1] });
      await a.s.tique();
      await b.s.tique();
    }
  } finally {
    Date.now = real;
  }
  assert.deepEqual({ x: ha.pos.x, y: ha.pos.y }, deB, 'A foi para a casa de B');
  assert.deepEqual({ x: hb.pos.x, y: hb.pos.y }, deA, 'e B para a de A');
  grupo(b.s, 'sair');
});
