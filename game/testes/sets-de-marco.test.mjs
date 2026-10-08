// Os marcos de level 50 e 100 são BAÚS de item (antes: "Set intermediário" e "Set completo") e
// são da VOCAÇÃO — antes todo mundo recebia os de knight — e só abrem no level deles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Recompensas from '../systems/recompensas.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import { personagemDeTeste } from './apoio.mjs';
import { doClassico } from './apoio-migracao.mjs';

const ARMA = { knight: 'heroic axe', paladin: 'composite hornbow', sorcerer: 'wand of voodoo', druid: 'underworld rod', monk: 'nunchaku of enlightenment' };
const nomesNaMochila = (e) => (e.inventory ?? []).map((p) => ITEM_CATALOG[p.id]?.name);

test('os marcos 50 e 100 são BAÚS de item; cada vocação vê e sorteia entre os itens dela', { skip: doClassico("Baús de marco (level 50/100) com itens do Draevor por vocação") }, () => {
  for (const [voc, arma] of Object.entries(ARMA)) {
    const e = personagemDeTeste({ vocacao: voc, level: 60 });
    Recompensas.marcosDaVocacao(e);
    const marco = e.presentes.marcos.find((m) => m.level === 50);
    assert.equal(marco.tipo, 'bau');
    assert.equal(marco.titulo, 'Baú de itens (nível 50)');
    assert.equal(e.presentes.marcos.find((m) => m.level === 100).titulo, 'Baú de itens (nível 100)');
    assert.ok(marco.itens.some((i) => i.name === arma), `${voc}: o baú pode dar ${arma}`);
    for (const i of marco.itens) {
      const vocs = ITEM_CATALOG[i.itemId].vocations;
      assert.ok(!vocs || vocs.includes(voc), `${voc}: ${i.name} é de ${vocs}`);
    }
    e.gold = 50_000;
    const r = Recompensas.coletarMarco(e, { level: 50 });
    assert.equal(r.ok, true);
    assert.equal(e.gold, 0);
    // UM item só, um dos possíveis, e o aviso diz qual e a raridade.
    const recebidos = (e.inventory ?? []).filter((p) => marco.itens.some((i) => i.itemId === p.id));
    assert.equal(recebidos.length, 1, `${voc}: um item só`);
    assert.match(r.notice, /O baú abriu: .+ \(.+\)\./);
    assert.equal(marco.pego, true);
  }
});

test('o item do baú sai do gerador: raridade e faixa de valores como num drop', { skip: doClassico("Baús de marco (level 50/100) com itens do Draevor por vocação") }, () => {
  let comFaixa = 0;
  const raridades = new Set();
  for (let i = 0; i < 200; i++) {
    const e = personagemDeTeste({ vocacao: 'knight', level: 100 });
    e.gold = 100_000;
    Recompensas.coletarMarco(e, { level: 100 });
    const peca = e.inventory.find((p) => ITEM_CATALOG[p.id]?.slot && !ITEM_CATALOG[p.id]?.stackable && p.base);
    if (peca) { comFaixa++; if (peca.raridade) raridades.add(peca.raridade); }
  }
  assert.ok(comFaixa > 100, `${comFaixa} de 200 com faixa`);
  assert.ok(raridades.size >= 2, `raridades diferentes: ${[...raridades]}`);
});

test('druid não recebe itens de knight do baú', { skip: doClassico("Baús de marco (level 50/100) com itens do Draevor por vocação") }, () => {
  const deKnight = ['ornate legs', 'mastermind shield', 'crystalline axe', 'royal draken mail'];
  for (let i = 0; i < 60; i++) {
    const e = personagemDeTeste({ vocacao: 'druid', level: 100 });
    e.gold = 100_000;
    assert.equal(Recompensas.coletarMarco(e, { level: 100 }).ok, true);
    for (const nome of nomesNaMochila(e)) assert.ok(!deKnight.includes(nome), nome);
  }
});

test('set antigo AINDA NÃO PEGO vira baú; o já pego fica como set', { skip: doClassico("Baús de marco (level 50/100) com itens do Draevor por vocação") }, () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 60 });
  const m50 = e.presentes.marcos.find((m) => m.level === 50);
  const m100 = e.presentes.marcos.find((m) => m.level === 100);
  m50.tipo = 'set';
  m50.titulo = 'Set intermediário';
  m100.tipo = 'set';
  m100.titulo = 'Set completo';
  m100.pego = true;
  Recompensas.marcosDaVocacao(e);
  assert.equal(m50.tipo, 'bau');
  assert.equal(m50.titulo, 'Baú de itens (nível 50)');
  assert.equal(m100.tipo, 'set');
  assert.equal(m100.titulo, 'Set completo');
});

test('o marco só abre no level dele (antes bastava ter o ouro)', { skip: doClassico("Baús de marco (level 50/100) com itens do Draevor por vocação") }, () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 8 });
  e.gold = 1_000_000;
  const r = Recompensas.coletarMarco(e, { level: 100 });
  assert.equal(r.ok, false);
  assert.match(r.erro, /abre no level 100/);
  assert.equal(e.gold, 1_000_000, 'não cobrou');
});

test('marco já pego não é reescrito', { skip: doClassico("Baús de marco (level 50/100) com itens do Draevor por vocação") }, () => {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 60 });
  const marco = e.presentes.marcos.find((m) => m.level === 50);
  marco.pego = true;
  const antes = JSON.stringify(marco.itens);
  Recompensas.marcosDaVocacao(e);
  assert.equal(JSON.stringify(marco.itens), antes);
});

// ---- a fila de recompensas de level: só a primeira que falta abre, quando o level chega ----
const marco = (e, level) => e.presentes.marcos.find((m) => m.level === level);

// (A trilha das armas de treino 8–50 saiu com o treino — dono, 06/10: a fila começa no baú do 50.)
test('level 50: o BAÚ do 50 abre (sem a trilha de treino na frente)', { skip: doClassico("Baús de marco (level 50/100) com itens do Draevor por vocação") }, () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 50 });
  Recompensas.abrirProximas(e);
  assert.equal(e.presentes.degraus.length, 0);
  assert.equal(marco(e, 50).aberto, true, 'o baú do 50 abre');
  assert.equal(marco(e, 100).aberto, false, 'o do 100: nem chegou no level');
  assert.equal(e.presentes.marcosAbertos, 1);
  assert.equal(e.presentes.pendentes, 0);
});

test('só a PRIMEIRA que falta abre: level alto, nada pego — só o baú do 50', { skip: doClassico("Baús de marco (level 50/100) com itens do Draevor por vocação") }, () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 500 });
  Recompensas.abrirProximas(e);
  assert.equal(marco(e, 50).aberto, true);
  for (const outra of [marco(e, 100), marco(e, 120)]) assert.equal(outra.aberto, false);
});

test('pegar o baú abre a próxima da fila (o do 100) quando o level chega', { skip: doClassico("Baús de marco (level 50/100) com itens do Draevor por vocação") }, () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 100 });
  e.gold = 200_000;
  Recompensas.abrirProximas(e);
  assert.equal(Recompensas.coletarMarco(e, { level: 50 }).ok, true);
  assert.equal(marco(e, 50).pego, true);
  assert.equal(marco(e, 100).aberto, true);
  assert.equal(e.presentes.marcosAbertos, 1);
});
