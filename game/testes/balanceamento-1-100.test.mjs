// O 1–100 mais rápido (29/09): estágios de exp por faixa de level e o reforço
// de spawn nas hunts que foram capturadas só com os bichos à vista da entrada.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Boosts from '../systems/boosts.mjs';
import * as R from '../systems/regras.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import { SPAWNS_CAPTURADOS, REFORCO_DE_SPAWN, spawnsCapturados, mapaRealCapturado } from '../systems/hunt/terreno.mjs';
import { andavelDoAndar } from '../systems/hunt/andares.mjs';
import { personagemDeTeste, huntDoPoe } from './apoio.mjs';
import { doClassico } from './apoio-migracao.mjs';

test('estágios: x3 até o 50, x2 até o 100, normal depois (faixas inclusivas)', () => {
  assert.equal(Boosts.estagioDeExp(8), 3);
  assert.equal(Boosts.estagioDeExp(50), 3);
  assert.equal(Boosts.estagioDeExp(51), 2);
  assert.equal(Boosts.estagioDeExp(100), 2);
  assert.equal(Boosts.estagioDeExp(101), 1);
  assert.equal(Boosts.estagioDeExp(1500), 1);
});

test('a exp do bicho leva o estágio por cima de todo o resto', { skip: doClassico("Curva de balanceamento 1–100 do Draevor") }, () => {
  // Troll (20 de exp) sem boost, stamina normal: 20 x (1 + bônus de level) x estágio.
  for (const level of [20, 80, 150]) {
    const e = personagemDeTeste({ level });
    e.stamina = 1500; // fora das faixas de x1,5 e x0,5
    const esperado = Math.round(20 * (1 + R.levelBonus(level) / 100) * Boosts.estagioDeExp(level));
    assert.equal(Boosts.expDoBicho(e, 20), esperado, `level ${level}`);
  }
});

test('reforço de spawn: mais bichos, espalhados, alcançáveis, a mesma mistura — e sempre iguais', () => {
  for (const [id, alvo] of Object.entries(REFORCO_DE_SPAWN)) {
    const base = SPAWNS_CAPTURADOS[id];
    const pontos = spawnsCapturados(id);
    assert.ok(pontos.length > base.length * 3, `${id}: ${base.length} -> ${pontos.length}`);
    // Os capturados continuam, e a mistura é a da captura.
    for (const p of base) assert.ok(pontos.includes(p));
    const chaves = new Set(base.map((p) => p.key));
    for (const p of pontos) assert.ok(chaves.has(p.key), `${id}: ${p.key} não é da captura`);
    // Todos em casa andável, e os novos a 3+ casas de qualquer outro.
    const real = mapaRealCapturado(id);
    const andavel = andavelDoAndar(real, real.z);
    const novos = pontos.slice(base.length);
    for (const p of novos) {
      assert.ok(andavel.has(`${p.x},${p.y}`), `${id}: ${p.x},${p.y} não é andável`);
      for (const q of pontos) if (q !== p) assert.ok(Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y)) >= 3, `${id}: dois pontos colados`);
    }
    // Densidade perto do alvo (a cada 100 casas andáveis do andar — as alcançáveis são um pouco menos).
    assert.ok((pontos.length / andavel.size) * 100 <= alvo + 0.01);
    // Sempre a mesma lista (cache) — online, offline e worker veem o mesmo mapa.
    assert.equal(spawnsCapturados(id), pontos);
  }
  // Hunt capturada sem reforço fica como estava.
  assert.equal(spawnsCapturados('medusa-cave'), SPAWNS_CAPTURADOS['medusa-cave']);
});

test('entrando numa hunt reforçada, os bichos a mais estão lá (gravados como spawns no mapa pela migração)', () => {
  const e = personagemDeTeste({ level: 45 });
  assert.equal(Cacadas.entrar(e, { huntId: huntDoPoe('port-hope-corym-dungeons'), mode: 'auto' }).ok, true);
  const bichos = [...e.hunt.monstros, ...Object.values(e.hunt.outrosAndares ?? {}).flat()];
  // O mapa define 54; só nasce quem cabe numa casa alcançável do raio do spawn.
  assert.ok(bichos.length >= 45, `${bichos.length} bichos (eram 14)`);
});
