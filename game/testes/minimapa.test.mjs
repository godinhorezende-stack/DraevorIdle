// O minimapa (`client/src/minimapa.mjs`): as contas puras — a geometria da fase, a escala e os
// pontos — com os mapas e os monstros REAIS de todas as fases da campanha (o retrato que o
// servidor manda, `snapshotDaHunt`). O desenho no canvas é do navegador e não roda aqui.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarBase, escala, pontosDoRetrato } from '../frontend/client/src/minimapa.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Campanha from '../systems/campanha.mjs';
import { personagemDeTeste } from './apoio.mjs';

function retratoDa(huntId) {
  const e = personagemDeTeste({ level: 2000 });
  const r = Cacadas.entrar(e, { huntId, mode: 'auto', dificuldade: 'facil' });
  if (!r.ok) return null;
  return Cacadas.snapshotDaHunt(e, true);
}

test('todas as fases da campanha: a geometria monta, e todo monstro e o jogador caem DENTRO do mapa', () => {
  let fases = 0;
  for (const f of Campanha.FASES) {
    if (f.pular) continue;
    const snap = retratoDa(f.huntId);
    assert.ok(snap?.map?.width, `${f.huntId}: retrato com mapa`);
    const b = montarBase(snap.map, snap.z ?? snap.map.z);
    assert.equal(b.pixels.length, snap.map.width * snap.map.height * 4);
    let chao = 0;
    for (let i = 3; i < b.pixels.length; i += 4) if (b.pixels[i]) chao++;
    assert.ok(chao > 0, `${f.huntId}: tem chão/parede desenhados`);
    const pontos = pontosDoRetrato(snap);
    assert.ok(pontos.some((p) => p.tipo === 'jogador'), `${f.huntId}: o jogador aparece`);
    assert.ok(pontos.some((p) => p.tipo === 'monstro' || p.tipo === 'raro'), `${f.huntId}: os monstros aparecem`);
    for (const p of pontos) {
      assert.ok(p.x >= 0 && p.y >= 0 && p.x < snap.map.width && p.y < snap.map.height, `${f.huntId}: ponto (${p.x},${p.y}) dentro do mapa`);
    }
    fases++;
  }
  assert.ok(fases >= 40, `${fases} fases conferidas`);
});

test('a fase inteira cabe no quadrado, sem distorcer (mesma escala nos dois eixos) e centrada', () => {
  const largo = escala({ width: 200, height: 100 }, 176);
  assert.equal(largo.s, 176 / 200);
  assert.equal(largo.ox, 0);
  assert.equal(largo.oy, (176 - 100 * largo.s) / 2);
  const alto = escala({ width: 50, height: 160 }, 112);
  assert.equal(alto.s, 112 / 160);
  assert.ok(alto.ox > 0 && alto.oy === 0);
});

test('pontos: só monstro VIVO; boss marcado; raridade em outra cor; jogador e companheiros', () => {
  const snap = {
    player: { x: 5, y: 5 },
    monsters: [
      { uid: 1, x: 1, y: 1, hp: 10 },
      { uid: 2, x: 2, y: 2, hp: 0 }, // morto: sai
      { uid: 3, x: 3, y: 3, hp: 5, raridade: 'raro' },
      { uid: 4, x: 4, y: 4, hp: 99 },
    ],
    boss: { uid: 4 },
    aliados: [{ x: 6, y: 6 }],
  };
  const tipos = pontosDoRetrato(snap).map((p) => `${p.tipo}@${p.x}`);
  assert.deepEqual(tipos, ['monstro@1', 'raro@3', 'boss@4', 'aliado@6', 'jogador@5'], 'o jogador por último (desenhado por cima)');
  const salaDeBoss = pontosDoRetrato({ isBoss: true, monsters: [{ uid: 9, x: 1, y: 1, hp: 1 }] });
  assert.equal(salaDeBoss[0].tipo, 'boss');
});

test('desempenho: montar a geometria do maior mapa é rápido (é feito só ao trocar de fase/andar)', () => {
  const maiores = Campanha.FASES.filter((f) => !f.pular).map((f) => retratoDa(f.huntId)).filter(Boolean).sort((a, b) => b.map.width * b.map.height - a.map.width * a.map.height);
  const snap = maiores[0];
  const t0 = performance.now();
  for (let i = 0; i < 10; i++) montarBase(snap.map, snap.z ?? snap.map.z);
  const ms = (performance.now() - t0) / 10;
  assert.ok(ms < 50, `${snap.mapId} ${snap.map.width}x${snap.map.height}: ${ms.toFixed(1)}ms`);
  // E os pontos de uma fase cheia: microssegundos.
  const t1 = performance.now();
  for (let i = 0; i < 100; i++) pontosDoRetrato(snap);
  assert.ok((performance.now() - t1) / 100 < 5);
});

test('o minimapa desvia das janelas: vai para a esquerda do Inventário no canto; sem lugar, desce', async () => {
  const { lugarLivre } = await import('../frontend/client/src/minimapa.mjs');
  const tela = 1920;
  // O Inventário no canto superior direito (o report): x 1700–1910, y 60–500.
  const inventario = { left: 1700, right: 1910, top: 60, bottom: 500 };
  const l = lugarLivre({ topo: 70, direita: 8, largura: 186, altura: 186, larguraDaTela: tela, obstaculos: [inventario] });
  const caixa = { left: tela - l.direita - 186, right: tela - l.direita, top: l.topo, bottom: l.topo + 186 };
  assert.ok(caixa.right <= inventario.left, `à esquerda do inventário (${caixa.right} ≤ ${inventario.left})`);
  assert.equal(l.topo, 70, 'na mesma altura');
  // Sem janela: no canto de sempre.
  assert.deepEqual(lugarLivre({ topo: 70, direita: 8, largura: 186, altura: 186, larguraDaTela: tela, obstaculos: [] }), { topo: 70, direita: 8 });
  // A tela toda ocupada à esquerda (esquerdaMinima): desce para baixo da janela do canto.
  const baixo = lugarLivre({ topo: 70, direita: 8, largura: 186, altura: 186, larguraDaTela: 400, obstaculos: [{ left: 150, right: 400, top: 60, bottom: 300 }], esquerdaMinima: 100 });
  assert.ok(baixo.topo >= 300, `desceu (${baixo.topo})`);
});
