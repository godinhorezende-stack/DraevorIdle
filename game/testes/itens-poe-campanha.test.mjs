// A campanha do PoE convertida (gamedata/itens-poe/campanha-poe.json — tools/montar-campanha-poe.mjs): 10 atos + Epílogo, áreas com mapa
// do Draevor e monstros do PoE, chefes de ato.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const C = JSON.parse(readFileSync(new URL('../gamedata/itens-poe/campanha-poe.json', import.meta.url), 'utf8'));
const CAMPANHA = JSON.parse(readFileSync(new URL('../gamedata/campanha.json', import.meta.url), 'utf8'));

test('C1 — 10 atos + Epílogo; toda área de combate tem mapa do Draevor (de uma hunt da campanha) e monstros do PoE com status', () => {
  assert.equal(C.atos.length, 11);
  assert.equal(C.atos.at(-1).nome, 'Epílogo');
  const huntsDoDraevor = new Set(CAMPANHA.fases.map((f) => f.huntId));
  for (const a of Object.values(C.areas)) {
    if (a.cidade) {
      assert.equal(a.mapa, null);
      continue;
    }
    assert.ok(huntsDoDraevor.has(a.mapa), `${a.nome}: mapa ${a.mapa}`);
    assert.ok(a.monstros.length > 0, `${a.nome}: sem monstros`);
    for (const m of a.monstros) assert.ok(m.vida > 0 && m.dano >= 0 && m.tempoAtaque > 0, `${a.nome}/${m.nome}`);
    for (const c of a.conexoes) assert.ok(C.areas[c], `${a.nome}: conexão ${c}`);
  }
  const prisao = Object.values(C.areas).find((a) => a.nome === 'Prisão Inferior' && a.ato === 1);
  assert.equal(prisao.mapa, 'prison-2', 'a prisão usa o mapa de prisão do Draevor');
});

test('C1 — os 10 chefes de ato com os status de campanha (os 3 que a coleção só traz em nível de mapa, calculados)', () => {
  assert.equal(Object.keys(C.chefes).length, 10);
  for (const ch of Object.values(C.chefes)) assert.ok(ch.monstro?.vida > 0 && ch.monstro.dano > 0, ch.nome);
  assert.equal(C.chefes[1].monstro.vida, 9657, 'Merveil: o valor da coleção');
  assert.ok(C.chefes[2].monstro.calculado && C.chefes[2].monstro.vida > C.chefes[1].monstro.vida && C.chefes[2].monstro.vida < C.chefes[3].monstro.vida, 'Essência dos Vaal entre Merveil e Dominus');
});

test('C2 — os monstros do PoE viram criaturas: status do PoE, desenho do Draevor (pelo nome ou nativo do mapa), golpe e ritmo do PoE', async () => {
  const { execFileSync } = await import('node:child_process');
  const codigo = `
    process.env.ITENS_POE = '1';
    const M = await import('./systems/itens-poe/monstros.mjs');
    const { BESTIARY, criarMonstro } = await import('./systems/hunt/monstros.mjs');
    const { spawnsDaHunt } = await import('./systems/hunt/terreno.mjs');
    const Poderes = await import('./systems/poderes.mjs');
    const Mob = await import('./systems/mobs/atributos.mjs');
    const nativos = (mapa) => [...new Set((spawnsDaHunt(mapa) ?? []).flatMap((s) => (s.criaturas ?? []).map((c) => c.key)))];
    const r = M.iniciar(nativos);
    const costa = M.CAMPANHA.areas['poe-a1-the-twilight-strand'];
    const chaves = r.porArea.get(costa.id);
    const hillock = costa.monstros.find((m) => m.slug === 'Hillock');
    const kH = M.chaveDe(hillock);
    const b = BESTIARY[kH];
    const m = criarMonstro({ key: kH, x: 1, y: 1 }, null);
    const golpes = Array.from({ length: 200 }, () => Poderes.golpeCorpoACorpo(m));
    const caranguejo = Object.values(M.CAMPANHA.areas).flatMap((a) => a.monstros).find((x) => /^Caranguejo/.test(x.nome));
    console.log(JSON.stringify({ total: r.total, chaves: chaves.length, nome: b.name, hp: b.hp, vidaPoe: hillock.vida, exp: b.exp, vel: m.velocidadeDeAtaque, tempo: hillock.tempoAtaque,
      golpeMin: Math.min(...golpes), golpeMax: Math.max(...golpes), dano: hillock.dano, armadura: Mob.armaduraDe(m, 1), armPoe: hillock.armadura,
      desenhoCaranguejo: BESTIARY[M.chaveDe(caranguejo)].look, lookCrab: BESTIARY.crab.look }));
  `;
  const r = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', codigo], { cwd: new URL('..', import.meta.url).pathname, encoding: 'utf8' }).trim().split('\n').pop());
  assert.ok(r.total > 500, `${r.total} criaturas`);
  assert.equal(r.nome, 'Hillock');
  assert.equal(r.hp, r.vidaPoe, 'a vida do PoE, como está');
  assert.ok(Math.abs(r.vel - 2000 / (r.tempo * 1000)) < 0.01, 'o ritmo: o tempo de ataque do PoE');
  assert.ok(r.golpeMin >= Math.round(r.dano * 0.8) && r.golpeMax <= Math.round(r.dano * 1.2), 'o golpe: o dano do PoE ±20%');
  assert.equal(r.armadura, r.armPoe, 'a armadura do PoE, sem a curva do Draevor');
  assert.equal(r.desenhoCaranguejo, r.lookCrab, 'o Caranguejo do PoE usa o desenho do caranguejo do Draevor');
});
