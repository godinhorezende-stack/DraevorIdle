// O banco de ouro: os três comandos do `renderBank` (panels.mjs) e a morte.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as Banqueiro from '../../game/systems/banqueiro.mjs';
import { personagemDeTeste } from './apoio.mjs';

const API = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'api-mapeada', 'servidor');
const capturado = (arquivo) => JSON.parse(readFileSync(join(API, arquivo), 'utf8'));

function comOuro(gold, bank = 0) {
  return Object.assign(personagemDeTeste(), { gold, bank });
}

/** Um "outro personagem" como a sessão entrega: estado + gravar. */
function outro(nome, estado = personagemDeTeste()) {
  const registro = { id: `id-${nome}`, nome, estado, gravou: 0 };
  registro.gravar = () => registro.gravou++;
  return registro;
}

// As respostas medidas no original (ver o cabeçalho de banqueiro.mjs): todo
// resultado é um notice — erro incluído —, e a quantia é LIMITADA ao saldo.
const ok = (r, texto) => {
  assert.equal(r.ok, true);
  assert.equal(r.notice, texto);
};

test('depositar: do bolso para o banco, limitado ao que se carrega', () => {
  const e = comOuro(1000);
  ok(Banqueiro.comando(e, { action: 'deposit', amount: 400 }), 'Depositou 400 gold');
  assert.deepEqual([e.gold, e.bank], [600, 400]);
  // Pedir mais do que carrega move tudo, não dá erro.
  ok(Banqueiro.comando(e, { action: 'deposit', amount: 99999 }), 'Depositou 600 gold');
  assert.deepEqual([e.gold, e.bank], [0, 1000]);
  // Nada a mover: "valor inválido", sem mexer em nada.
  ok(Banqueiro.comando(e, { action: 'deposit', amount: 1 }), 'valor inválido');
  assert.deepEqual([e.gold, e.bank], [0, 1000]);
});

test('sacar: do banco para o bolso, limitado ao que há no banco', () => {
  const e = comOuro(0, 500);
  ok(Banqueiro.comando(e, { action: 'withdraw', amount: 200 }), 'Sacou 200 gold');
  assert.deepEqual([e.gold, e.bank], [200, 300]);
  ok(Banqueiro.comando(e, { action: 'withdraw', amount: 301 }), 'Sacou 300 gold');
  assert.deepEqual([e.gold, e.bank], [500, 0]);
});

test('valores inválidos e ação desconhecida respondem "valor inválido" sem mexer no saldo; fração é truncada', () => {
  const e = comOuro(1000, 1000);
  for (const amount of [0, -5, 'abc', null, undefined, NaN, Infinity]) {
    ok(Banqueiro.comando(e, { action: 'deposit', amount }), 'valor inválido');
    ok(Banqueiro.comando(e, { action: 'withdraw', amount }), 'valor inválido');
  }
  assert.deepEqual([e.gold, e.bank], [1000, 1000]);
  ok(Banqueiro.comando(e, { action: 'deposit', amount: 1.5 }), 'Depositou 1 gold');
  ok(Banqueiro.comando(e, { action: 'xyz', amount: 1 }), 'valor inválido');
  assert.deepEqual([e.gold, e.bank], [999, 1001]);
});

test('transferir: sai do BANCO (nunca do bolso) e entra no banco do outro', async () => {
  const e = comOuro(5000, 1000);
  const zoros = outro('Zoros');
  zoros.estado.bank = 50;
  const r = await Banqueiro.comando(e, { action: 'transfer', name: ' zoros ', amount: 700 }, { id: 'eu' }, (nome) => (nome.toLowerCase() === 'zoros' ? zoros : null));
  ok(r, 'Transferiu 700 gold para Zoros');
  assert.deepEqual([e.gold, e.bank], [5000, 300]);
  assert.equal(zoros.estado.bank, 750);
  assert.equal(zoros.estado.gold, 500, 'o bolso do outro não muda');
  assert.equal(zoros.gravou, 1);
});

test('transferir: recusas na ordem do original (quantia antes do nome) sem mexer em nada', async () => {
  const e = comOuro(1_000_000, 0);
  const zoros = outro('Zoros');
  const acha = (nome) => ({ zoros, eu: outro('Eu') }[nome.toLowerCase()] ?? null);
  const t = async (m) => (await Banqueiro.transferir(e, m, { id: 'id-Eu' }, acha)).notice;
  assert.equal(await t({ name: 'Ninguem', amount: 0 }), 'valor inválido', 'quantia conferida antes do nome');
  assert.equal(await t({ name: '', amount: 10 }), 'personagem não encontrado');
  assert.equal(await t({ name: 'Ninguem', amount: 10 }), 'personagem não encontrado');
  assert.equal(await t({ name: 'Eu', amount: 10 }), 'você não pode transferir para si mesmo');
  assert.equal(await t({ name: 'Zoros', amount: 10 }), 'valor inválido', 'banco vazio, mesmo com ouro no bolso');
  delete zoros.estado.vocation;
  e.bank = 100;
  assert.equal(await t({ name: 'Zoros', amount: 10 }), 'o destinatário precisa ter vocação');
  assert.deepEqual([e.gold, e.bank, zoros.gravou], [1_000_000, 100, 0]);
});

test('morte: custa 20% do ouro CARREGADO (a fração real capturada) e o banco fica intacto', () => {
  assert.equal(Banqueiro.FRACAO_DO_OURO_NA_MORTE, capturado('blessings.json').resumo.ouroFracao);
  const e = comOuro(10_000, 50_000);
  assert.equal(Banqueiro.cobrarMorte(e), 2000);
  assert.deepEqual([e.gold, e.bank], [8000, 50_000]);
  const pobre = comOuro(0, 50_000);
  assert.equal(Banqueiro.cobrarMorte(pobre), 0);
  assert.deepEqual([pobre.gold, pobre.bank], [0, 50_000]);
});

test('a fala do Banker é a capturada do original', () => {
  const real = capturado('npc-naji.json');
  assert.equal(Banqueiro.FALA_DO_BANQUEIRO, real.fala);
  assert.equal(real.tipo, 'banco');
});
