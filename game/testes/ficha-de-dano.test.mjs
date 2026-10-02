// O dano na ficha do monstro (`fichaDoBicho` → `Poderes.ataquesParaFicha`): a MESMA fonte do combate
// (`gamedata/monstro-poderes.json` e `boss-poderes.json`), sem valor inventado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as Poderes from '../systems/poderes.mjs';
import * as Campanha from '../systems/campanha.mjs';
import { BESTIARY } from '../systems/hunt/monstros.mjs';
import { huntOuMapaCustom } from '../systems/hunt/terreno.mjs';
import { fichaDoBicho } from '../systems/hunt/combate.mjs';
import { personagemDeTeste } from './apoio.mjs';

const lerJson = (n) => JSON.parse(readFileSync(new URL(`../gamedata/${n}`, import.meta.url), 'utf8'));
const FONTE = { ...lerJson('monstro-poderes.json').monstros, ...lerJson('boss-poderes.json').bosses };

test('a ficha mostra exatamente os ataques do arquivo, de todos os 279 monstros com dados', () => {
  let n = 0;
  for (const [key, p] of Object.entries(FONTE)) {
    const a = Poderes.ataquesParaFicha(key);
    assert.equal(a.length, p.ataques.length, key);
    p.ataques.forEach((orig, i) => {
      // Faixa invertida/negativa nos dados (5 golpes): a ficha mostra a faixa sorteada, ordenada e sem negativos.
      assert.equal(a[i].min, Math.max(0, Math.min(orig.min, orig.max)), `${key}[${i}].min`);
      assert.equal(a[i].max, Math.max(0, Math.max(orig.min, orig.max)), `${key}[${i}].max`);
      assert.equal(a[i].intervalo, orig.intervalo);
      assert.equal(a[i].chance, orig.chance);
      assert.equal(a[i].elemento, orig.tipo === 'melee' ? 'physical' : orig.elemento);
      assert.equal(a[i].estimado, !!orig.estimado, `${key}: o aviso de estimado vem do dado`);
      assert.ok(a[i].min <= a[i].max, `${key}: min <= max`);
    });
    n++;
  }
  assert.ok(n >= 279);
});

test('Cyclops: corpo a corpo físico 0–105; Troll 0–15 — e o golpe que o combate sorteia cai nessa faixa', () => {
  const cy = Poderes.ataquesParaFicha('cyclops');
  assert.deepEqual([cy.length, cy[0].tipo, cy[0].elemento, cy[0].min, cy[0].max], [1, 'melee', 'physical', 0, 105]);
  const tr = Poderes.ataquesParaFicha('troll');
  assert.deepEqual([tr[0].min, tr[0].max], [0, 15]);
  for (let i = 0; i < 500; i++) {
    const v = Poderes.golpeCorpoACorpo({ key: 'cyclops' });
    assert.ok(v >= 0 && v <= 105, `golpe ${v}`);
  }
});

test('monstro com várias habilidades (físico + mágicas de tipos diferentes): todos os golpes, cada um com o seu tipo', () => {
  const multi = Object.keys(FONTE).filter((k) => new Set(FONTE[k].ataques.map((a) => (a.tipo === 'melee' ? 'physical' : a.elemento))).size >= 3);
  assert.ok(multi.length > 0, 'existe monstro com 3+ tipos de dano');
  const k = multi[0];
  const a = Poderes.ataquesParaFicha(k);
  assert.ok(a.some((x) => x.tipo === 'melee') || a.every((x) => x.tipo === 'magia'));
  assert.ok(new Set(a.map((x) => x.elemento)).size >= 3, `${k}: ${a.map((x) => x.elemento)}`);
  const fogoEmArea = Object.entries(FONTE).flatMap(([key, p]) => p.ataques.filter((x) => x.elemento === 'fire' && x.forma === 'area').map(() => key));
  assert.ok(fogoEmArea.length > 0, 'ataque em área de fogo existe nos dados');
  assert.equal(Poderes.ataquesParaFicha(fogoEmArea[0]).some((x) => x.elemento === 'fire' && x.forma === 'area'), true);
});

test('os golpes ESTIMADOS pelo gerador dos dados vêm marcados (a ficha mostra "~")', () => {
  const k = Object.keys(FONTE).find((key) => FONTE[key].ataques.some((a) => a.estimado));
  assert.ok(k);
  assert.ok(Poderes.ataquesParaFicha(k).some((a) => a.estimado));
  const exato = Object.keys(FONTE).find((key) => FONTE[key].ataques.every((a) => !a.estimado));
  assert.ok(Poderes.ataquesParaFicha(exato).every((a) => !a.estimado));
});

test('sem dados, sem invenção: bicho fora dos arquivos devolve null (a ficha diz "sem dados de ataque")', () => {
  const sem = Object.keys(BESTIARY).filter((k) => !FONTE[k]);
  assert.ok(sem.length > 1000, `${sem.length} criaturas sem arquivo de poderes`);
  assert.equal(Poderes.ataquesParaFicha(sem[0]), null);
  assert.equal(Poderes.ataquesParaFicha('nao-existe'), null);
});

test('TODA criatura que aparece nas hunts da campanha tem dados de ataque', () => {
  const nasHunts = new Set();
  for (const f of Campanha.FASES) {
    if (f.pular) continue;
    const h = huntOuMapaCustom(f.huntId);
    for (const m of JSON.stringify(h.posicoes ?? h.spawns ?? h).matchAll(/"key":"([a-z0-9-]+)"/g)) nasHunts.add(m[1]);
  }
  const faltam = [...nasHunts].filter((k) => BESTIARY[k] && !FONTE[k]);
  assert.deepEqual(faltam, [], `sem dados: ${faltam.join(', ')}`);
  assert.ok(nasHunts.size >= 100);
});

test('fichaDoBicho: ataques + XP na mesma resposta, e a escala de dano da fase (a prévia do seletor usa fase e dificuldade)', () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 60 });
  const fora = fichaDoBicho(e, null, 'cyclops');
  assert.equal(fora.escalaDoDano, 1);
  assert.equal(fora.ataques[0].max, 105);
  assert.equal(fora.base, 150);
  const facil = fichaDoBicho(e, null, 'cyclops', { huntId: 'mistrock-cyclops', dificuldade: 'facil' });
  const medio = fichaDoBicho(e, null, 'cyclops', { huntId: 'mistrock-cyclops', dificuldade: 'medio' });
  assert.equal(facil.escalaDoDano, Campanha.escalaDaFase('mistrock-cyclops', 'facil').dano);
  assert.ok(facil.escalaDoDano < 1 && medio.escalaDoDano > 1, `${facil.escalaDoDano} / ${medio.escalaDoDano}`);
  assert.equal(facil.ataques[0].max, 105, 'o dano-BASE da ficha não muda com a fase (a escala vem à parte)');
  assert.equal(fichaDoBicho(e, null, 'pig').ataques?.length ?? 0, 0, 'arquivo sem ataques: lista vazia, nada inventado');
});

test('as anomalias dos dados (faixa invertida, melee negativo) saem na ficha como a luta as sorteia, sem mexer no arquivo', () => {
  const i = FONTE['pirat-mate'].ataques.findIndex((a) => a.min > a.max);
  const pirat = Poderes.ataquesParaFicha('pirat-mate')[i];
  assert.deepEqual([pirat.min, pirat.max], [80, 140], 'invertida no arquivo (140..80): a luta sorteia entre 81 e 140');
  const planta = Poderes.ataquesParaFicha('plagueroot').find((a) => a.tipo === 'melee');
  assert.deepEqual([planta.min, planta.max], [0, 0], 'o melee negativo não causa dano na luta');
  for (const key of Object.keys(FONTE)) for (const a of Poderes.ataquesParaFicha(key)) assert.ok(a.min >= 0 && a.min <= a.max, key);
});
