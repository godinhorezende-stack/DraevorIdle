// A ROUPA DA CLASSE (dono, 08/10: "tem personagem que ficaram com outfit sem ser da classe coloque todos personagens com a outfit da classe
// propria"): o boot veste, uma vez, cada personagem do PoE com a roupa da classe dele (a mesma de quem nasce agora); o arquivado não é tocado.
// Banco SQLite só deste arquivo: o `aplicarEmTodos` regrava TODOS os personagens do PoE do banco, e no banco comum estão os dos outros
// arquivos de teste, rodando em paralelo.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { soNoOficial } from './apoio-migracao.mjs';

const PASTA = mkdtempSync(join(tmpdir(), 'draevor-roupa-da-classe-'));
process.env.DRAEVOR_SQLITE = join(PASTA, 'jogo.db');
after(() => rmSync(PASTA, { recursive: true, force: true }));

const B = await import('../database/banco.mjs');
const Classes = await import('../systems/classes.mjs');
const RoupaDaClasse = await import('../systems/personagem/roupa-da-classe.mjs');

const SO_NO_OFICIAL = soNoOficial('as classes do PoE e as roupas delas (`classes-poe.json`)');
// As roupas configuradas pelo dono na Engine (`gamedata/overrides/classes-poe.json`): o Duelista tem as duas; o Templário, nenhuma.
const VELHA = { type: 128, head: 78, body: 88, legs: 58, feet: 76, mount: 7, addons: 0 };

test('veste a roupa da classe pelo sexo, uma vez só (a marca), e guarda a montaria', { skip: SO_NO_OFICIAL }, () => {
  const esperada = Classes.outfitInicial(Classes.obter('duelist'), 'female');
  assert.ok(esperada, 'o Duelista tem a roupa feminina configurada');
  const e = { classe: 'duelist', sex: 'female', sistema: 'poe', outfit: { ...VELHA } };
  assert.equal(RoupaDaClasse.aplicar(e), 'vestiu');
  assert.deepEqual(e.outfit, { ...esperada, mount: 7 }, 'a roupa da classe, com a montaria que ele tinha');
  assert.deepEqual(e.outfitsDaClasse, { [esperada.type]: esperada.addons }, 'a roupa fica dele');
  assert.equal(e[RoupaDaClasse.MARCA], 1);
  // Depois da marca, a escolha dele vale: trocou de roupa, ninguém troca de volta.
  e.outfit = { ...VELHA };
  assert.equal(RoupaDaClasse.aplicar(e), null);
  assert.deepEqual(e.outfit, VELHA);
});

test('sem o sexo no estado vale o da linha do banco; classe sem roupa (o Templário) só ganha a marca e fica com a dele', { skip: SO_NO_OFICIAL }, () => {
  const masculina = Classes.outfitInicial(Classes.obter('duelist'), 'male');
  const semSexo = { classe: 'duelist', outfit: { ...VELHA } };
  assert.equal(RoupaDaClasse.aplicar(semSexo, 'male'), 'vestiu');
  assert.equal(semSexo.outfit.type, masculina.type);

  assert.equal(Classes.outfitInicial(Classes.obter('templar'), 'male'), null, 'o Templário não tem roupa configurada');
  const templario = { classe: 'templar', sex: 'male', outfit: { ...VELHA } };
  assert.equal(RoupaDaClasse.aplicar(templario), 'marcou');
  assert.deepEqual(templario.outfit, VELHA);
  assert.equal(templario.outfitsDaClasse, undefined);
  assert.equal(templario[RoupaDaClasse.MARCA], 1);
});

test('o boot: todo personagem do PoE no banco veste a roupa da classe, uma vez; o arquivado (Draevor clássico) fica como está', { skip: SO_NO_OFICIAL }, async () => {
  const conta = await B.criarConta({ email: `roupa-${randomUUID()}@teste.local`, senha: 'x' });
  const nome = (p) => `${p}${randomUUID().replace(/[^a-z]/g, '').slice(0, 7)}`;
  const criar = (n, sexo, estado) => B.criarPersonagem({ conta: conta.id, nome: n, vocacao: 'knight', sexo, estadoInicial: estado });
  const duelista = await criar(nome('Duel'), 'female', { classe: 'duelist', sex: 'female', sistema: 'poe', level: 5, outfit: { ...VELHA } });
  const ranger = await criar(nome('Rang'), 'male', { classe: 'ranger', sex: 'male', frascos: [null, null, null, null, null], level: 3, outfit: { ...VELHA } });
  const templario = await criar(nome('Temp'), 'male', { classe: 'templar', sex: 'male', sistema: 'poe', level: 2, outfit: { ...VELHA } });
  const antigo = await criar(nome('Anti'), 'male', { vocation: 'knight', sex: 'male', level: 120, outfit: { ...VELHA } });
  const estado = async (id) => JSON.parse((await B.banco.prepare('SELECT estado FROM personagens WHERE id = ?').get(id)).estado);

  assert.deepEqual(await RoupaDaClasse.aplicarEmTodos(B), { vestidos: 2, marcados: 1 });
  assert.equal((await estado(duelista.id)).outfit.type, Classes.outfitInicial(Classes.obter('duelist'), 'female').type);
  assert.equal((await estado(ranger.id)).outfit.type, Classes.outfitInicial(Classes.obter('ranger'), 'male').type, 'o do PoE de antes da marca (cinto + classe do PoE)');
  assert.equal((await estado(ranger.id)).outfit.mount, 7);
  assert.deepEqual((await estado(templario.id)).outfit, VELHA);
  const doAntigo = await estado(antigo.id);
  assert.deepEqual(doAntigo.outfit, VELHA, 'o arquivado não é tocado');
  assert.equal(doAntigo[RoupaDaClasse.MARCA], undefined);

  // O segundo boot não faz nada (a marca).
  assert.deepEqual(await RoupaDaClasse.aplicarEmTodos(B), { vestidos: 0, marcados: 0 });
});
