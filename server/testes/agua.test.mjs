// "mobs nas fases não podem andar sobre a água e player também não".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ITEM_CATALOG, CATALOGO } from '../../game/systems/dados.mjs';
import * as Cacadas from '../../game/systems/cacadas.mjs';
import { personagemDeTeste, PERSONAGEM } from './apoio.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets_raw', 'gamedata', 'hunts');
// Só as hunts: as salas de boss ficam como o original (a da Magma Bubble é
// chão de lava, e é nele que se entra — ver `mapaRealCapturado`).
const SALAS_DE_BOSS = new Set(CATALOGO.bosses.map((b) => b.id));
const HUNTS = readdirSync(RAIZ).map((f) => f.replace(/-map\.json$/, '')).filter((id) => !SALAS_DE_BOSS.has(id));
const LIQUIDO = /^(shallow water|water|swamp|lava|tar|muddy water|dirty water|bog water|ghostly water)$/;

function casaLiquida(mapa, x, y) {
  const andar = mapa.floors?.[mapa.z] ?? mapa;
  const chao = mapa.palette[andar.stacks[y * mapa.width + x]?.[0]]?.id;
  return LIQUIDO.test(ITEM_CATALOG[chao]?.name ?? '');
}

function entrarEPegarMapa(huntId, estado = personagemDeTeste({ level: 400 })) {
  const r = Cacadas.entrar(estado, { huntId, mode: 'auto' });
  assert.ok(r.ok, `${huntId}: ${r.erro}`);
  return { estado, mapa: Cacadas.snapshotDaHunt(estado, true).map };
}

test('nenhuma casa de chão líquido fica andável em nenhum mapa real', () => {
  for (const huntId of HUNTS) {
    const { mapa } = entrarEPegarMapa(huntId);
    const andar = mapa.floors?.[mapa.z] ?? mapa;
    let livres = 0;
    for (let i = 0; i < andar.stacks.length; i++) {
      if (!andar.blocked[i] && casaLiquida(mapa, i % mapa.width, Math.floor(i / mapa.width))) livres++;
    }
    assert.equal(livres, 0, `${huntId}: ${livres} casas de água andáveis`);
    assert.equal(mapa.blocked, andar.blocked, `${huntId}: blocked do topo diferente do andar`);
  }
});

test('ninguém nasce na água: jogador e bichos começam em chão seco', () => {
  for (const huntId of HUNTS) {
    const { estado, mapa } = entrarEPegarMapa(huntId);
    assert.ok(!casaLiquida(mapa, estado.hunt.pos.x, estado.hunt.pos.y), `${huntId}: jogador nasceu na água`);
    for (const m of estado.hunt.monstros) assert.ok(!casaLiquida(mapa, m.x, m.y), `${huntId}: ${m.name} nasceu na água`);
  }
});

test('caçando 3 minutos nas hunts com lago, ninguém pisa na água', () => {
  // As quatro que tinham mais água "livre" antes da correção.
  for (const huntId of ['winter-dream-court', 'hive-surface', 'werelions-1', 'dark-pyramid']) {
    const { estado, mapa } = entrarEPegarMapa(huntId);
    // Imortal para o teste não acabar numa morte: o que importa é o caminho.
    estado.maxHp = estado.hp = 1e9;
    let t = Date.now();
    estado.hunt.ultimoTique = t;
    for (let i = 0; i < 720; i++) {
      t += 250;
      estado.hp = estado.maxHp;
      Cacadas.tique(estado, PERSONAGEM, t);
      if (!estado.hunt) break;
      const { pos, monstros } = estado.hunt;
      assert.ok(!casaLiquida(mapa, pos.x, pos.y), `${huntId}: jogador na água em (${pos.x},${pos.y})`);
      for (const m of monstros) assert.ok(!casaLiquida(mapa, m.x, m.y), `${huntId}: ${m.name} na água em (${m.x},${m.y})`);
    }
  }
});
