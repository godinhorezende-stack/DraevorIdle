// As cargas do PoE (Tolerância, Frenesi, Poder) — só com ITENS_POE=1: números base do PoE, na caçada.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const C = await import('../systems/itens-poe/cargas.mjs');
const SEM = !existsSync(Catalogo.ARQUIVO) && 'catálogo do PoE não importado nesta máquina';
const comCacada = (clock = 0) => ({ hunt: { clock } });

test('ganhar: até 3 (+ o máximo dos mods), 10 s, cada ganho renova todas do tipo; vencidas somem', { skip: SEM }, () => {
  const e = comCacada(0);
  for (let i = 0; i < 5; i++) C.ganhar(e, 'frenesi', {});
  assert.equal(C.ativas(e).frenesi, 3, 'o máximo base é 3');
  C.ganhar(e, 'frenesi', { max_frenesi: 1 });
  assert.equal(C.ativas(e).frenesi, 4, '+1 ao máximo');
  e.hunt.clock = 9000;
  C.ganhar(e, 'frenesi', {});
  assert.equal(e.hunt.cargasPoe.frenesi.ate, 19000, 'renovou: 10 s a partir de agora');
  assert.equal(C.duracao({ duracao_frenesi: 50, duracao_cargas: 50 }, 'frenesi'), 20000);
  e.hunt.clock = 19000;
  assert.equal(C.ativas(e).frenesi, 0);
  assert.equal(C.vencer(e), true);
  assert.equal(e.hunt.cargasPoe.frenesi, undefined);
});

test('o que cada carga soma: Tolerância (físico e resistências), Frenesi (velocidade, mais dano), Poder (crítico); mods por carga', { skip: SEM }, () => {
  const e = comCacada(0);
  for (let i = 0; i < 2; i++) C.ganhar(e, 'tolerancia', {});
  for (let i = 0; i < 3; i++) C.ganhar(e, 'frenesi', {});
  C.ganhar(e, 'poder', {});
  const s = C.adds(e, { move_speed_por_frenesi: 2, spell_dmg_por_poder: 5 });
  assert.equal(s.phys_res, 8);
  assert.deepEqual([s.fire_res, s.ice_res, s.energy_res], [8, 8, 8]);
  assert.deepEqual([s.atk_speed, s.cast_speed, s.move_speed], [12, 12, 6]);
  assert.deepEqual([s.crit_chance_inc, s.spell_dmg], [40, 5]);
  assert.ok(Math.abs(C.fatorDeDano(e, { dano_por_poder: 10 }) - 1.12 * 1.1) < 1e-9, '4% mais por Frenesi × dano por Poder');
  assert.equal(C.adds(comCacada(0), {}), null, 'sem carga: nada');
});

test('no combate de verdade: matar com "Carga de Frenesi ao Matar" ganha a carga, a ficha muda e o cartão aparece na caçada', { skip: SEM }, async () => {
  const Cacadas = await import('../systems/cacadas.mjs');
  const Afixos = await import('../systems/afixos.mjs');
  const Ficha = await import('../systems/ficha.mjs');
  const Treino = await import('../systems/treino.mjs');
  const { ITEM_CATALOG } = await import('../systems/dados.mjs');
  const { criarMonstro } = await import('../systems/hunt/monstros.mjs');
  const { matarMonstro } = await import('../systems/hunt/combate.mjs');
  const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
  const e = personagemDeTeste({ vocacao: 'knight', level: 300 });
  Treino.garantir(e);
  e.equipment.ring = { id: Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'might ring').id), count: 1, af: [], poe: { af: { carga_frenesi_ao_matar: 100 } } };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(Cacadas.entrar(e, { huntId: 'troll-cave', mode: 'auto' }).ok);
  const antes = Ficha.combate(e);
  const m = criarMonstro({ key: 'troll', x: e.hunt.pos.x + 1, y: e.hunt.pos.y }, null);
  e.hunt.monstros.push(m);
  m.hp = 0;
  matarMonstro(e, e.hunt, PERSONAGEM, m, []);
  assert.equal(C.ativas(e).frenesi, 1, 'ganhou 1 Carga de Frenesi');
  const depois = Ficha.combate(e);
  assert.ok(depois.velocidadeDeAtaque > antes.velocidadeDeAtaque, 'mais velocidade de ataque');
  assert.ok(Math.abs(depois.fatorDasCargas - 1.04) < 1e-9);
  const cartao = Cacadas.snapshotDaHunt(e).buffs.find((b) => b.tipo === 'cargaPoe');
  assert.deepEqual([cartao?.carga, cartao?.n], ['frenesi', 1]);
});
