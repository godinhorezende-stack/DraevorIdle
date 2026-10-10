// A PROTEÇÃO DE ENTRADA na PARTY (dono, 10/10: "no sistema de party também, podendo até 5 players na instância"). Cinco jogadores (contas
// com 3 Slots de party) na MESMA sala: cada um tem a proteção DELE, na sessão dele — quem confirma o carregamento é liberado sem esperar os
// outros, quem ainda carrega segue protegido (nenhum bicho o fere), e a instância nova (todos chegam juntos) protege os cinco de novo.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import * as B from '../database/banco.mjs';
import { Sessao, vivas } from '../websocket/sessao.mjs';
import * as Party from '../systems/party.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Protecao from '../systems/protecao.mjs';
import * as R from '../systems/regras.mjs';
import { personagemDeTeste, HUNT_DE_TESTE } from './apoio.mjs';

const DIF = HUNT_DE_TESTE === 'troll-cave' ? 'medio' : 'facil';
const MINIMO = Protecao.config().minimoMs;
const criadas = [];

const relogioReal = Date.now;
let agora = relogioReal();
Date.now = () => agora;

after(async () => {
  Date.now = relogioReal;
  for (const { s, nome, conta } of criadas) {
    s.desconectar();
    vivas.delete(nome);
    await B.db.prepare('DELETE FROM melhorias_da_conta WHERE conta = ?').run(conta);
    await B.db.prepare('DELETE FROM contas WHERE id = ?').run(conta);
  }
});

/** Um jogador conectado (conta própria com 3 Slots de party), com a tela que confirma o carregamento. */
async function jogador(i) {
  const conta = await B.criarConta({ email: `protecao-${randomUUID()}@teste.local`, senha: 'senha-123' });
  await B.gravarMelhoriasDaConta(conta.id, { slotsDeParty: 3 });
  await B.lerMelhoriasDaConta(conta.id);
  const enviados = [];
  const s = new Sessao({ readyState: 1, bufferedAmount: 0, send: (d) => enviados.push(JSON.parse(d)) });
  s.conta = { id: conta.id };
  s.receber({ t: 'carregamento', versao: 1 });
  const nome = `Pr${i}${randomUUID().replace(/[^a-z]/g, '').slice(0, 6)}`;
  const e = personagemDeTeste({ vocacao: ['knight', 'paladin', 'druid', 'sorcerer', 'monk'][i % 5], level: 60 });
  e.pos = { ...R.POSICAO_INICIAL };
  await s.concluirEntrada({ id: randomUUID(), nome }, e, null, null);
  s.gravadoEm = Infinity;
  criadas.push({ s, nome, conta: conta.id });
  return { s, nome, enviados };
}

async function passar(js, ms) {
  for (let t = 0; t < ms; t += R.PASSO_MS) {
    agora += R.PASSO_MS;
    for (const j of js) await j.s.tique();
  }
}
const confirmar = (j) => j.s.receber({ t: 'mapaPronto', entrada: j.s.estado.hunt.entrada });

test('cinco na MESMA instância, cada um protegido na sua sessão: quem confirma é liberado sozinho, quem carrega segue protegido', async () => {
  const js = [];
  for (let i = 0; i < 5; i++) js.push(await jogador(i));
  const [lider, ...outros] = js;
  for (const o of outros) {
    assert.equal(Party.comandoDoGrupo(lider.s, { action: 'convidar', name: o.nome }).ok, true);
    assert.equal(Party.comandoDoGrupo(o.s, { action: 'aceitar' }).ok, true);
  }
  assert.equal(Party.camposDoPersonagem(lider.s).party.membros.length, 5, 'a party com cinco');
  lider.s.receber({ t: 'startHunt', huntId: HUNT_DE_TESTE, mode: 'auto', dificuldade: DIF });
  assert.ok(lider.s.estado.hunt, 'o líder entrou');
  for (const o of outros) {
    assert.equal(Party.comandoDaCaca(lider.s, { action: 'invite', name: o.nome }).ok, true);
    const r = Party.comandoDaCaca(o.s, { action: 'accept' });
    assert.equal(r.ok, true, `${o.nome} entra: ${r.erro ?? ''}`);
  }
  const sala = Cacadas.salaDe(lider.s.estado.hunt);
  for (const j of js) assert.equal(Cacadas.salaDe(j.s.estado.hunt), sala, 'todos na mesma sala');
  // Cada um tem a SUA entrada (a caçada de cada um) e a sua proteção.
  assert.equal(new Set(js.map((j) => j.s.estado.hunt.entrada)).size, 5);
  await passar(js, 1000);
  for (const j of js) assert.equal(j.s.protegidoNaEntrada(), true, `${j.nome} protegido ao chegar`);

  // Dois carregaram rápido; três ainda carregam.
  confirmar(js[0]);
  confirmar(js[2]);
  await passar(js, MINIMO);
  assert.deepEqual(js.map((j) => j.s.protegidoNaEntrada()), [false, true, false, true, true], 'só quem confirmou foi liberado');
  // Os que carregam não apanham, nem com um bicho colado neles.
  const vidas = js.map((j) => j.s.estado.hp);
  const relogios = js.map((j) => j.s.estado.hunt.clock);
  const bicho = sala.monstros.find((m) => m.hp > 0);
  bicho.hp = bicho.maxHp = 1e9;
  const alvo = js[1].s.estado.hunt;
  bicho.x = alvo.pos.x + 1;
  bicho.y = alvo.pos.y;
  await passar(js, 3000);
  for (const i of [1, 3, 4]) assert.equal(js[i].s.estado.hp, vidas[i], `${js[i].nome} (carregando) sem dano`);
  // A caçada de quem carrega ficou parada (nenhum golpe dele, nenhum dos bichos nele); a dos liberados andou.
  for (const i of [1, 3, 4]) assert.equal(js[i].s.estado.hunt.clock, relogios[i], `${js[i].nome}: caçada parada`);
  for (const i of [0, 2]) assert.ok(js[i].s.estado.hunt.clock > relogios[i], `${js[i].nome}: caçada andando`);
  for (const i of [1, 3, 4]) confirmar(js[i]);
  await passar(js, R.PASSO_MS);
  for (const j of js) assert.equal(j.s.protegidoNaEntrada(), false, `${j.nome} liberado`);

  // A instância NOVA (o líder troca, todos chegam juntos): os cinco protegidos de novo, cada um com a entrada nova.
  if (sala.instancia) {
    const velhas = js.map((j) => j.s.estado.hunt.entrada);
    assert.equal(Cacadas.novaInstancia(lider.s.estado), true);
    js.forEach((j, i) => assert.notEqual(j.s.estado.hunt.entrada, velhas[i], `${j.nome}: entrada nova`));
    await passar(js, R.PASSO_MS);
    for (const j of js) assert.equal(j.s.protegidoNaEntrada(), true, `${j.nome} protegido na instância nova`);
    for (const j of js) confirmar(j);
    await passar(js, MINIMO);
    for (const j of js) assert.equal(j.s.protegidoNaEntrada(), false);
  }
});
