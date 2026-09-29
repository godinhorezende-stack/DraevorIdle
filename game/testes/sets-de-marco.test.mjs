// Os sets de marco (level 50 "Set intermediário", 100 "Set completo") são da
// VOCAÇÃO — antes todo mundo recebia os de knight — e só abrem no level deles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Recompensas from '../systems/recompensas.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import { personagemDeTeste } from './apoio.mjs';

const ARMA = { knight: 'heroic axe', paladin: 'composite hornbow', sorcerer: 'wand of voodoo', druid: 'underworld rod', monk: 'nunchaku of enlightenment' };
const nomesNaMochila = (e) => (e.inventory ?? []).map((p) => ITEM_CATALOG[p.id]?.name);

test('cada vocação vê e recebe o set dela', () => {
  for (const [voc, arma] of Object.entries(ARMA)) {
    const e = personagemDeTeste({ vocacao: voc, level: 60 });
    Recompensas.marcosDaVocacao(e);
    const marco = e.presentes.marcos.find((m) => m.level === 50);
    assert.ok(marco.itens.some((i) => i.name === arma), `${voc}: o set mostra ${arma}`);
    for (const i of marco.itens) {
      const vocs = ITEM_CATALOG[i.itemId].vocations;
      assert.ok(!vocs || vocs.includes(voc), `${voc}: ${i.name} é de ${vocs}`);
    }
    e.gold = 50_000;
    assert.equal(Recompensas.coletarMarco(e, { level: 50 }).ok, true);
    assert.ok(nomesNaMochila(e).includes(arma), `${voc} recebeu ${arma}`);
    assert.equal(e.gold, 0);
  }
});

test('druid não recebe mais itens de knight (o molde era o de knight)', () => {
  const e = personagemDeTeste({ vocacao: 'druid', level: 100 });
  e.gold = 100_000;
  assert.equal(Recompensas.coletarMarco(e, { level: 100 }).ok, true);
  const nomes = nomesNaMochila(e);
  assert.ok(nomes.includes('dream blossom staff'));
  for (const deKnight of ['ornate legs', 'mastermind shield', 'crystalline axe', 'royal draken mail']) assert.ok(!nomes.includes(deKnight), deKnight);
});

test('o marco só abre no level dele (antes bastava ter o ouro)', () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 8 });
  e.gold = 1_000_000;
  const r = Recompensas.coletarMarco(e, { level: 100 });
  assert.equal(r.ok, false);
  assert.match(r.erro, /abre no level 100/);
  assert.equal(e.gold, 1_000_000, 'não cobrou');
});

test('marco já pego não é reescrito', () => {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 60 });
  const marco = e.presentes.marcos.find((m) => m.level === 50);
  marco.pego = true;
  const antes = JSON.stringify(marco.itens);
  Recompensas.marcosDaVocacao(e);
  assert.equal(JSON.stringify(marco.itens), antes);
});
