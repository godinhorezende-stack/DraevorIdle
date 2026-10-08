// As cargas do PoE (Tolerância, Frenesi, Poder) — só com ITENS_POE=1: números base do PoE, na caçada.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { HUNT_DE_TESTE } from './apoio.mjs';

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
  assert.deepEqual([s.crit_chance_inc, s.spell_dmg], [50, 5], 'Poder: +50% de chance de crítico, como no PoE 1');
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
  assert.ok(Cacadas.entrar(e, { huntId: HUNT_DE_TESTE, mode: 'auto' }).ok);
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

test('máximo e mínimo: Executor (Tolerância = máximo de Frenesi), "+N ao Mínimo" (volta ao mínimo, não a 0), Destruidor (chance do máximo de uma vez)', { skip: SEM }, () => {
  assert.equal(C.maximo({ max_frenesi: 2, max_tolerancia_igual_frenesi: 1 }, 'tolerancia'), 5);
  const e = comCacada(0);
  const af = { min_poder: 1 };
  C.tique(e, af);
  assert.equal(C.ativas(e).poder, 1, 'o mínimo entra sozinho');
  C.ganhar(e, 'poder', af);
  C.ganhar(e, 'poder', af);
  e.hunt.clock = 10_000;
  C.tique(e, af);
  assert.equal(C.ativas(e).poder, 1, 'venceu: volta ao mínimo');
  const j = comCacada(0);
  C.ganhar(j, 'tolerancia', { chance_tolerancia_maxima: 100 }, 1, () => 0);
  assert.equal(C.ativas(j).tolerancia, 3, 'de 0 direto ao máximo');
});

test('ganhos: crítico/varinha/não crítico (Poder), crítico corpo a corpo e atordoar (Tolerância), quando acertado, ao bloquear, por mana gasta', { skip: SEM }, () => {
  const sempre = () => 0;
  let e = comCacada(0);
  assert.deepEqual(C.aoAcertar(e, { carga_poder_ao_critico_varinha: 100 }, {}, { crit: true, varinha: false }, sempre), [], 'com varinha só vale na varinha');
  assert.deepEqual(C.aoAcertar(e, { carga_poder_ao_critico_varinha: 100 }, {}, { crit: true, varinha: true }, sempre), ['poder']);
  assert.deepEqual(C.aoAcertar(comCacada(0), { carga_poder_ao_acerto_nao_critico: 100 }, {}, { crit: false }, sempre), ['poder']);
  assert.deepEqual(C.aoAcertar(comCacada(0), { carga_tolerancia_ao_critico_corpo: 100 }, {}, { crit: true, corpoACorpo: true }, sempre), ['tolerancia']);
  assert.deepEqual(C.aoAcertar(comCacada(0), { carga_tolerancia_ao_atordoar: 100 }, {}, { atordoou: true }, sempre), ['tolerancia']);
  assert.deepEqual(C.aoSerAcertado(comCacada(0), { carga_tolerancia_ao_ser_acertado: 100 }, sempre), ['tolerancia']);
  assert.deepEqual(C.aoBloquear(comCacada(0), { carga_frenesi_ao_bloquear: 100 }, sempre), ['frenesi']);
  e = comCacada(0);
  C.aoGastarMana(e, { poder_por_mana_gasta: 100 }, 250);
  assert.equal(C.ativas(e).poder, 2, '250 de mana = 2 cargas (sobram 50)');
  assert.equal(e.hunt.cargasPoeTempo.manaGasta, 50);
});

test('por tempo: Tolerância por segundo se acertado recentemente (Destruidor) e Frenesi a cada N s se movendo (Atiradora)', { skip: SEM }, () => {
  const e = comCacada(0);
  const af = { tolerancia_por_segundo_acertado: 1 };
  C.aoSerAcertado(e, af);
  for (let t = 0; t <= 3000; t += 250) {
    e.hunt.clock = t;
    C.tique(e, af);
  }
  assert.equal(C.ativas(e).tolerancia, 3, 'uma por segundo, até o máximo');
  const m = comCacada(0);
  m.hunt.pos = { x: 0, y: 0, z: 7 };
  const am = { frenesi_a_cada_s_movendo: 2 };
  for (let t = 0; t <= 4500; t += 250) {
    m.hunt.clock = t;
    m.hunt.pos = { x: t / 250, y: 0, z: 7 };
    C.tique(m, am);
  }
  assert.equal(C.ativas(m).frenesi, 2, 'andando 4,5 s com 1 a cada 2 s');
});

test('efeitos por carga dos mods e o Conduíte (a party na mesma sala ganha junto)', { skip: SEM }, () => {
  const e = comCacada(0);
  for (let i = 0; i < 2; i++) C.ganhar(e, 'tolerancia', {});
  C.ganhar(e, 'poder', {});
  const s = C.adds(e, { armour_pct_por_tolerancia: 5, phys_res_por_tolerancia: 1, crit_chance_inc_por_poder: 10, mana_regen_pct_por_poder: 3 });
  assert.deepEqual([s.armour_pct, s.phys_res, s.crit_chance_inc, s.mana_regen_pct], [10, 10, 60, 3], 'Poder: 50% base + 10 do mod');
  assert.ok(Math.abs(C.fatorDeDano(e, { dano_por_tolerancia: 5, dano_por_carga: 2 }) - (1 + (5 * 2 + 2 * 3) / 100)) < 1e-9);
  // Conduíte
  const a = comCacada(0);
  const b = comCacada(0);
  a.hunt.partilha = b.hunt.partilha = { ativa: true, membros: [{ estado: a }, { estado: b }] };
  C.definirLeitores({ regras: () => ({}), conduite: (x) => x === a });
  C.ganhar(a, 'frenesi', {});
  assert.deepEqual([C.ativas(a).frenesi, C.ativas(b).frenesi], [1, 1], 'b ganhou junto');
  C.ganhar(b, 'poder', {});
  assert.equal(C.ativas(a).poder, 0, 'b não tem Conduíte: não reparte');
});
