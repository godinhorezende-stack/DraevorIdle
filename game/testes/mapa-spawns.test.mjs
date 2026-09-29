// Os spawns são do MAPA (systems/mapa/spawns.mjs): o arquivo de cada mapa
// define os pontos, a instância da hunt nasce deles, e o editor e a migração
// gravam no mesmo formato.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as Spawns from '../systems/mapa/spawns.mjs';
import { spawnsDaHunt } from '../systems/hunt/terreno.mjs';
import { FASES } from '../systems/campanha.mjs';
import { spawnsDasFontesAntigas } from '../admin/migrar-spawns.mjs';

const TROLL = 'troll';

test('normalizar: preenche os padrões e lê o formato antigo de um bicho por ponto', () => {
  assert.deepEqual(Spawns.normalizar({ x: 3, y: 4, key: TROLL }, 7), { id: 's1', x: 3, y: 4, z: 7, raio: 2, quantidade: 1, tipo: 'normal', criaturas: [{ key: TROLL, peso: 1 }] });
  const s = Spawns.normalizar({ id: 'a', x: 1, y: 2, z: 8, raio: 0, quantidade: 3, tipo: 'elite', criaturas: [{ key: TROLL, peso: 2 }] }, 7);
  assert.equal(s.z, 8);
  assert.equal(s.quantidade, 3);
  assert.equal(s.tipo, 'elite');
  assert.equal(Spawns.normalizar({ x: 1, y: 2, criaturas: [] }, 7), null, 'sem criatura não é spawn');
  // O mapa de editor antigo: `posicoes` viram spawns de quantidade 1, raio 0.
  const antigos = Spawns.spawnsDoMapa({ z: 7, posicoes: [{ key: TROLL, x: 5, y: 5 }] });
  assert.equal(antigos.length, 1);
  assert.equal(antigos[0].raio, 0);
});

test('validar: fora da grade, id repetido, monstro inventado, tipo desconhecido', () => {
  assert.deepEqual(Spawns.validar([{ id: 'a', x: 1, y: 1, criaturas: [{ key: TROLL }] }], { largura: 10, altura: 10 }), []);
  const erros = Spawns.validar(
    [
      { id: 'a', x: 50, y: 1, criaturas: [{ key: TROLL }] },
      { id: 'a', x: 1, y: 1, criaturas: [{ key: 'dragao-de-mentira' }] },
      { id: 'b', x: 1, y: 1, tipo: 'chefao', criaturas: [{ key: TROLL }] },
    ],
    { largura: 10, altura: 10 }
  );
  assert.ok(erros.some((e) => /fora da grade/.test(e)));
  assert.ok(erros.some((e) => /id repetido/.test(e)));
  assert.ok(erros.some((e) => /não é um monstro/.test(e)));
  assert.ok(erros.some((e) => /tipo "chefao"/.test(e)));
  assert.match(Spawns.validar([])[0], /ao menos um spawn/);
});

test('sortearCriatura segue os pesos', () => {
  const s = { criaturas: [{ key: 'a', peso: 1 }, { key: 'b', peso: 3 }] };
  assert.equal(Spawns.sortearCriatura(s, () => 0.2), 'a');
  assert.equal(Spawns.sortearCriatura(s, () => 0.3), 'b');
});

test('toda fase jogável tem os spawns na definição do mapa, válidos', () => {
  for (const f of FASES) {
    if (f.pular) continue;
    const spawns = spawnsDaHunt(f.huntId);
    assert.ok(spawns?.length, `${f.huntId}: o mapa não define spawn`);
    const cru = (() => {
      try {
        return JSON.parse(readFileSync(new URL(`../gamedata/hunts/${f.huntId}-map.json`, import.meta.url), 'utf8'));
      } catch {
        return null;
      }
    })();
    assert.deepEqual(Spawns.validar(spawns, cru ? { largura: cru.width, altura: cru.height } : {}), [], f.huntId);
  }
});

test('migração: o que foi gravado no mapa é o que as fontes antigas davam (original × density)', () => {
  for (const id of ['winter-dream-court', 'troll-cave', 'putrid-mummies']) {
    const gravado = spawnsDaHunt(id);
    const fontes = spawnsDasFontesAntigas(id);
    assert.equal(gravado.length, fontes.length, id);
    assert.equal(Spawns.totalDoMapa(gravado), fontes.reduce((n, s) => n + s.quantidade, 0), id);
  }
});
