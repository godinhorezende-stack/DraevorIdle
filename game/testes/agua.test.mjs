// "mobs nas fases não podem andar sobre a água e player também não".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import { personagemDeTeste, PERSONAGEM } from './apoio.mjs';

// (08/11, adaptado ao PoE — o dono: "Adaptar antes") As ÁREAS da campanha do PoE (todas, menos as cidades): o terreno de cada uma é um
// mapa capturado, e é nele que a regra vale.
const AREAS = Object.entries(JSON.parse(readFileSync(new URL('../gamedata/itens-poe/campanha-poe.json', import.meta.url), 'utf8')).areas).filter(([, a]) => !a.cidade);
const HUNTS = AREAS.map(([id]) => id);
const ULTIMO_ATO = Math.max(...AREAS.map(([, a]) => Number(a.ato) || 0));
const LIQUIDO = /^(shallow water|water|swamp|lava|tar|muddy water|dirty water|bog water|ghostly water)$/;

function casaLiquida(mapa, x, y) {
  const andar = mapa.floors?.[mapa.z] ?? mapa;
  const chao = mapa.palette[andar.stacks[y * mapa.width + x]?.[0]]?.id;
  return LIQUIDO.test(ITEM_CATALOG[chao]?.name ?? '');
}

/** Um personagem com os chefes de todos os atos vencidos (as áreas de todo ato abertas): o teste é do mapa, não da porta da campanha. */
function todosOsAtos() {
  const e = personagemDeTeste({ level: 100 });
  for (const p of Object.values(e.campanha)) p.bosses = Array.from({ length: ULTIMO_ATO }, (_, i) => i + 1);
  return e;
}

function entrarEPegarMapa(huntId, estado = todosOsAtos()) {
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

test('caçando 3 minutos nas áreas com lago, ninguém pisa na água', () => {
  // As quatro áreas com mais água no terreno.
  const comAgua = HUNTS.map((id) => {
    const { mapa } = entrarEPegarMapa(id);
    const andar = mapa.floors?.[mapa.z] ?? mapa;
    let n = 0;
    for (let i = 0; i < andar.stacks.length; i++) if (casaLiquida(mapa, i % mapa.width, Math.floor(i / mapa.width))) n++;
    return [id, n];
  }).sort((a, b) => b[1] - a[1]).slice(0, 4);
  assert.ok(comAgua.every(([, n]) => n > 0), `áreas com água: ${JSON.stringify(comAgua)}`);
  for (const [huntId] of comAgua) {
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
