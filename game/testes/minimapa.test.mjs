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

test('o RADAR vai pelo fio com TODOS os bichos do andar, e não só os da tela (o quadro corta a tela)', async () => {
  const { Sessao } = await import('../websocket/sessao.mjs');
  const Quadro = await import('../websocket/quadro.mjs');
  const e = personagemDeTeste({ level: 2000 });
  assert.equal(Cacadas.entrar(e, { huntId: 'werelions-1', mode: 'auto', dificuldade: 'facil' }).ok || Cacadas.entrar(e, { huntId: Campanha.FASES[5].huntId, mode: 'auto', dificuldade: 'facil' }).ok, true);
  const s = new Sessao({ readyState: 1, bufferedAmount: 0, send: () => {} });
  s.delta = true;
  const vivos = e.hunt.monstros.filter((m) => m.hp > 0).length;
  const msg = {};
  s.quadroDaCacada(msg, Cacadas.snapshotDaHunt(e, true), true);
  assert.equal(msg.hunt.radar.length / 3, vivos, 'o radar tem todos os vivos do andar');
  assert.ok(msg.hunt.monsters.length < vivos, `o quadro só leva os da tela (${msg.hunt.monsters.length} de ${vivos})`);
  // E no minimapa, os pontos saem do radar.
  const pontos = pontosDoRetrato({ ...msg.hunt });
  assert.equal(pontos.filter((p) => p.tipo !== 'jogador' && p.tipo !== 'aliado').length, vivos);
  // Antes de RADAR_MS, o radar não viaja de novo (o delta não o leva); depois, sim.
  const m2 = {};
  s.quadroDaCacada(m2, Cacadas.snapshotDaHunt(e), false);
  assert.ok(!m2.hunt || !('radar' in m2.hunt), 'dentro de 1 s: sem radar repetido');
  e.hunt.monstros[0].hp = 0; // um morreu: a quantidade mudou — vai na hora
  const m3 = {};
  s.quadroDaCacada(m3, Cacadas.snapshotDaHunt(e), false);
  assert.equal(m3.hunt.radar.length / 3, vivos - 1, 'morreu um: o radar já vem sem ele');
  assert.ok(Quadro.RADAR_MS >= 500);
});

test('radarDosBichos: só os vivos, boss e raridade marcados', async () => {
  const { radarDosBichos } = await import('../websocket/quadro.mjs');
  const r = radarDosBichos([{ uid: 1, x: 1, y: 2, hp: 5 }, { uid: 2, x: 3, y: 4, hp: 0 }, { uid: 3, x: 5, y: 6, hp: 1, raridade: 'raro' }, { uid: 4, x: 7, y: 8, hp: 9 }], 4);
  assert.deepEqual(r, [1, 2, 0, 5, 6, 1, 7, 8, 2]);
  assert.deepEqual(radarDosBichos([{ uid: 9, x: 0, y: 0, hp: 1 }], null, true), [0, 0, 2], 'sala de boss');
});

test('buracos e escadas: só os que FUNCIONAM, pela mesma regra do servidor, em todas as fases', async () => {
  const { passagensDoAndar } = await import('../frontend/client/src/minimapa.mjs');
  const { destinoDaMudanca } = await import('../systems/hunt/andares.mjs');
  let total = 0;
  for (const f of Campanha.FASES) {
    if (f.pular) continue;
    const snap = retratoDa(f.huntId);
    const map = snap.map;
    for (const z of Object.keys(map.floors ?? {}).map(Number)) {
      for (const p of passagensDoAndar(map, z)) {
        total++;
        const i = p.y * map.width + p.x;
        const mud = Number(map.floors[z].mudanca?.[i] ?? 0);
        const esc = Number(map.floors[z].escada?.[i] ?? 0);
        const dz = p.sentido === 'desce' ? 1 : -1;
        assert.ok(map.floors[z + dz], `${f.huntId} z${z} (${p.x},${p.y}): leva a um andar que existe`);
        if (mud) assert.ok(destinoDaMudanca(map, z, p.x, p.y), `${f.huntId}: o servidor também troca de andar aí`);
        else assert.equal(esc, p.sentido === 'desce' ? 2 : 1, `${f.huntId}: escada de clicar no sentido certo`);
      }
    }
  }
  assert.ok(total > 50, `${total} passagens conferidas`);
});

test('passagem que não leva a lugar nenhum não aparece; a rampa larga vira um marcador só', async () => {
  const { passagensDoAndar } = await import('../frontend/client/src/minimapa.mjs');
  const w = 10;
  const map = { width: w, height: 10, floors: { 7: { mudanca: { 11: 1, 12: 1, 13: 1, 55: 2 }, escada: { 77: 2, 88: 1 } } } };
  assert.deepEqual(passagensDoAndar(map, 7), [], 'andar único: nada leva a lugar nenhum');
  map.floors[8] = {};
  const desce = passagensDoAndar(map, 7);
  assert.deepEqual(desce.map((p) => p.sentido), ['desce', 'desce'], 'a rampa de 3 casas vira 1, mais a escada de clicar de descer');
  map.floors[6] = {};
  assert.equal(passagensDoAndar(map, 7).filter((p) => p.sentido === 'sobe').length, 2, 'com o andar de cima, as de subir aparecem');
});
