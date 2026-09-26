// Tarefas contra o ORIGINAL (Zoros, 2026-09-26, api-mapeada/captura-tarefas-0926/):
// a ficha das tasks de bicho, as tasks de montaria e as entregas remontadas aqui
// saem IGUAIS; e as ações (pegar, aceitar, entregar, adiantar) pelas regras.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as Tarefas from '../sistemas/tarefas.mjs';
import * as Entregas from '../sistemas/entregas.mjs';
import * as Aparencia from '../sistemas/aparencia.mjs';
import * as Promocao from '../sistemas/promocao.mjs';
import { personagemDeTeste } from './apoio.mjs';

const CAP = new URL('../../api-mapeada/captura-tarefas-0926/', import.meta.url);
const ler = (n) => JSON.parse(readFileSync(new URL(n, CAP), 'utf8'));
const W = ler('welcome-zoros.json').character;
const FICHA = ler('tasksDeBicho-zoros.json').ficha;

/**
 * O Zoros: o bestiary do welcome e, nas tasks que ele já pegou, a etapa paga e
 * a task parada (as mortes perdidas = bestiary − as da task). Seis bichos têm a
 * task 1 a 4 mortes À FRENTE do bestiary (as duas contagens do original andam
 * separadas); para a conta, o bestiary deles é o da task.
 */
function zoros() {
  const e = personagemDeTeste({ vocacao: 'knight', level: W.level });
  e.bestiary = { ...W.bestiary };
  e.tarefas = { etapa: {}, pausada: {}, perdidas: {}, montarias: [] };
  for (const b of FICHA.bichos) {
    const k = e.bestiary[b.key] ?? 0;
    if (b.pausada) {
      e.tarefas.pausada[b.key] = true;
      e.tarefas.perdidas[b.key] = k - b.mortes;
    } else if (k !== b.mortes) e.bestiary[b.key] = b.mortes;
    if (b.etapa) e.tarefas.etapa[b.key] = b.etapa;
  }
  e.inventory = structuredClone(W.inventory);
  e.pouch = structuredClone(W.pouch);
  e.gold = W.gold;
  return e;
}

test('a ficha das tasks de bicho: as 322 iguais às do original', () => {
  assert.deepEqual(Tarefas.ficha(zoros()), FICHA);
});

test('as tasks de montaria: iguais às do welcome (as mortes do bestiary)', () => {
  assert.deepEqual(Tarefas.mountTasks(zoros()), W.mountTasks);
});

test('as 33 entregas: iguais às do welcome (Nobleman pronta com o ouro do bolso)', () => {
  assert.deepEqual(Entregas.paraCliente(zoros()), W.entregas);
});

test('pegar paga os tokens e PARA a task; aceitar volta a contar; parada não conta', () => {
  const e = zoros();
  const antes = e.bestiary['crazed-winter-rearguard'];
  const r = Tarefas.comando(e, { action: 'resgatar', key: 'crazed-winter-rearguard' });
  assert.ok(r.ok);
  assert.equal(Tarefas.loja(e).saldo, 12);
  const linha = () => Tarefas.ficha(e).bichos.find((b) => b.key === 'crazed-winter-rearguard');
  assert.deepEqual([linha().etapa, linha().aResgatar, linha().pausada], [3, 0, true]);
  // Morre com ela parada: o bestiary conta, a task não.
  e.bestiary['crazed-winter-rearguard'] += 1;
  Tarefas.contarMorte(e, 'crazed-winter-rearguard');
  assert.equal(linha().mortes, antes);
  assert.ok(Tarefas.comando(e, { action: 'aceitar', key: 'crazed-winter-rearguard' }).ok);
  e.bestiary['crazed-winter-rearguard'] += 1;
  Tarefas.contarMorte(e, 'crazed-winter-rearguard');
  assert.equal(linha().mortes, antes + 1);
  assert.match(Tarefas.comando(e, { action: 'resgatar', key: 'rotworm' }).erro, /Nada/);
});

test('com o Auto Task a etapa que fecha paga sozinha e a task não para', () => {
  const e = personagemDeTeste({ level: 100 });
  e.bestiary = { rotworm: 1999 };
  e.autoTask = { passe: true, passeAte: Date.now() + 1e9 };
  e.bestiary.rotworm += 1;
  Tarefas.contarMorte(e, 'rotworm');
  const l = Tarefas.ficha(e).bichos.find((b) => b.key === 'rotworm');
  assert.deepEqual([l.etapa, l.aResgatar, l.pausada], [1, 0, undefined]);
  assert.equal(Tarefas.loja(e).saldo, 1);
});

test('task de montaria: fechando, a montaria é dele e paga os tokens', () => {
  const e = personagemDeTeste({ level: 100 });
  e.bestiary = { dragon: 2250 };
  Tarefas.contarMorte(e, 'dragon');
  const stampor = Tarefas.mountTasks(e).find((t) => t.id === 'mt-stampor');
  assert.equal(stampor.feito, true);
  assert.equal(Tarefas.loja(e).saldo, 2);
  const id = Aparencia.montariasEOutfits(e).mounts.find((m) => m.look === stampor.mountLook).id;
  assert.ok(Aparencia.temMontaria(e, id));
  assert.ok(Aparencia.equiparMontaria(e, { id }).ok);
});

test('entrega: adianta o que tem, fecha quando completa e dá o addon nos dois sexos', () => {
  const e = personagemDeTeste({ level: 100 });
  e.gold = 0;
  e.pouch = [];
  e.inventory = [{ id: 5878, count: 40 }]; // minotaur leather (pede 100)
  const citizen1 = () => Entregas.paraCliente(e).find((x) => x.id === 'citizen-addon-1');
  assert.deepEqual([citizen1().pronta, citizen1().podeAdiantar, citizen1().itens[0].tem], [false, true, 40]);
  assert.ok(Entregas.entregar(e, { id: 'citizen-addon-1' }).ok);
  assert.deepEqual([citizen1().adiantada, citizen1().itens[0].entregue, citizen1().itens[0].falta], [true, 40, 60]);
  assert.equal(e.inventory.length, 0);
  assert.match(Entregas.entregar(e, { id: 'citizen-addon-1' }).erro, /nada/);
  e.inventory = [{ id: 5878, count: 70 }];
  assert.ok(citizen1().pronta);
  assert.ok(Entregas.entregar(e, { id: 'citizen-addon-1' }).ok);
  assert.equal(citizen1().feita, true);
  assert.deepEqual(e.inventory, [{ id: 5878, count: 10 }], 'só os 60 que faltavam');
  const outfits = Aparencia.montariasEOutfits(e).outfits.filter((o) => o.name === 'Citizen');
  assert.ok(outfits.length === 2 && outfits.every((o) => o.addons === 1));
  // Vestir: o addon 1 fica, o 2 (que ele não tem) cai.
  Aparencia.salvarAparencia(e, { outfit: { type: outfits[0].look, head: 0, body: 0, legs: 0, feet: 0, addons: 3 } });
  assert.equal(e.outfit.addons, 1);
});

test('promoção no derived: o nome novo, promoted e a regeneração do original', () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 100 });
  assert.deepEqual(Promocao.derivados(e), { vocationName: 'Knight', promoted: false, hpRegen: 6, manaRegen: 6, regen: { hp: 1, mana: 1 } });
  e.promovido = true;
  const d = Promocao.derivados(e, { hp: 0.1129032258064516, mana: 0 });
  assert.equal(d.vocationName, W.derived.vocationName);
  assert.equal(d.promoted, W.derived.promoted);
  assert.equal(d.hpRegen, W.derived.hpRegen);
  assert.ok(Math.abs(d.regen.hp - W.derived.regen.hp) < 1e-9);
});

test('sessão: as entregas só vão quando mudam, e vão depois de entregar', async () => {
  const { Sessao } = await import('../nucleo/sessao.mjs');
  const enviados = [];
  const s = new Sessao({ readyState: 1, bufferedAmount: 0, send: (d) => enviados.push(JSON.parse(d)) });
  s.personagem = { id: 'x', nome: 'Entregador' };
  s.conta = { id: 'conta-x' };
  s.estado = personagemDeTeste({ level: 100 });
  s.estado.gold = 0;
  s.estado.pouch = [];
  s.estado.inventory = [{ id: 5878, count: 100 }];
  s.receber({ t: 'delta', on: true, sessao: true, fundo: true });
  s.mandarEstado();
  const inteiro = () => { s.characterSujo = true; enviados.length = 0; s.mandarEstado(); return enviados.find((m) => m.t === 'state')?.character ?? {}; };
  assert.equal(inteiro().entregas, undefined, 'nada mudou: não vai');
  assert.ok(Entregas.entregar(s.estado, { id: 'citizen-addon-1' }).ok);
  const depois = inteiro().entregas;
  assert.ok(depois, 'mudou: vai');
  assert.equal(depois.find((e) => e.id === 'citizen-addon-1').feita, true);
  assert.equal(inteiro().entregas, undefined, 'e de novo parada');
});

test('Boss Tasks: as mortes são as do bestiary (Minotauros 465, como no original)', async () => {
  const Bosses = await import('../sistemas/bosses.mjs');
  const e = personagemDeTeste({ level: W.level });
  e.bestiary = { ...W.bestiary };
  assert.deepEqual(Bosses.tasks(e), W.bossTasks);
  // Uma morte a mais conta UMA vez (o bestiary já contou quando a task conta).
  e.bestiary.minotaur += 1;
  Bosses.contarMorte(e, 'minotaur');
  assert.equal(Bosses.tasks(e)[0].kills, 466);
});

test('Coleção: Blade Dancer + Gorgon Hydra = 2 peças, +0,6% de crítico (o Zoros no original)', () => {
  const e = personagemDeTeste({ level: 100 });
  e.lojaOutfits = [1746];
  e.lojaMontarias = [223];
  assert.deepEqual(Aparencia.colecao(e), W.derived.collection);
  // A montaria de task e a de entrega entram; outfit de graça não.
  e.lojaOutfits.push(128);
  e.tarefas = { montarias: [999] };
  e.montariasEntregues = [998];
  assert.equal(Aparencia.colecao(e).pieces, 4);
});
