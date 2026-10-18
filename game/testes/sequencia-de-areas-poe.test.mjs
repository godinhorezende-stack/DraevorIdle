// A SEQUÊNCIA DE ÁREAS da Ruptura (lote G11, 17/10): "Onda causa Dano em 5 Áreas" em linha à frente, o raio crescendo "+0.2 metros para cada
// área anterior", e as Ondas de Choque ("de até 5 Inimigos em cada Área", "40% menos Dano"). Antes: um golpe só na forma da varredura.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
const Acoes = await import('../systems/acoes.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const G = await import('../systems/itens-poe/gemas-poe.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');

test('G11: os números da Ruptura no nível 20', { skip: SEM }, () => {
  const s = G.sequenciaDaGema('Sunder', 20);
  assert.deepEqual([s.areas, s.porAreaM, s.choques, s.choqueMenos], [5, 0.2, 5, 40]);
  assert.equal(G.sequenciaDaGema('Sunder_of_Earthbreaking', 20).areas, 6);
  assert.equal(G.sequenciaDaGema('Cleave', 20), null);
  assert.ok(!G.doSlug('Sunder').motivosNoJogo.some((m) => /Onda|Ondas de Choque|repetições/.test(m)), G.doSlug('Sunder').motivosNoJogo.join(' | '));
});

test('G11: a onda da Ruptura acerta em linha à frente até a 5ª área, com mais de um acerto por criatura (as áreas e as Ondas de Choque)', { skip: SEM }, async () => {
  const J = await import('../systems/itens-poe/jogo.mjs');
  const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 80 }), { classePoe: 'Marauder', sistema: 'poe' });
  const arma = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'One_Hand_Maces/Driftwood_Club', raridade: 'normal', ilvl: 1, rng: () => 0.5 }));
  arma.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
  e.equipment = { ...e.equipment, weapon: arma };
  e.inventory = [GS.itemDaGema({ id: G.doSlug('Sunder').itemId, nivel: 20, xp: 0, raridade: 'comum' })];
  GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: G.doSlug('Sunder').acao, enabled: true, minMana: 0, conditions: [] };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 1e6;
  const [m1, m3, m5, longe, ...resto] = e.hunt.monstros;
  for (const m of resto) Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60 });
  for (const [m, d] of [[m1, 1], [m3, 3], [m5, 5], [longe, 12]]) Object.assign(m, { x: e.hunt.pos.x + d, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12 });
  const a = Math.random;
  Math.random = () => 0.5;
  let ev;
  try {
    const r = Acoes.disparar(e, e.hunt, PERSONAGEM, 0, m1, { manual: true });
    assert.ok(r.ok, r.erro);
    ev = [...(r.eventos ?? [])];
  } finally { Math.random = a; }
  const acertos = (m) => ev.filter((x) => x.t === 'dmg' && x.uid === m.uid && x.foe).length;
  assert.ok(acertos(m1) >= 1 && acertos(m3) >= 1 && acertos(m5) >= 1, `${acertos(m1)} ${acertos(m3)} ${acertos(m5)}`);
  assert.equal(acertos(longe), 0, 'a 12 casas a onda não chega');
  assert.ok(acertos(m1) + acertos(m3) + acertos(m5) > 3, 'mais de um acerto por criatura (áreas que se sobrepõem e as Ondas de Choque)');
});

test('G11: a Armadilha de Torre Elétrica — ativada, golpeia 3 áreas a cada 0,36 s por 3,5 s (do lugar dela)', { skip: SEM }, async () => {
  const Plantadas = await import('../systems/itens-poe/armas-plantadas.mjs');
  const J = await import('../systems/itens-poe/jogo.mjs');
  const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
  assert.deepEqual(G.torreDaGema('Lightning_Spire_Trap', 20), { intervaloMs: 360, duracaoMs: 3500, areas: 3, velocidadeDeArremesso: true });
  const e = Object.assign(personagemDeTeste({ vocacao: 'sorcerer', level: 80 }), { classePoe: 'Shadow', sistema: 'poe' });
  const arma = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Wands/Driftwood_Wand', raridade: 'normal', ilvl: 1, rng: () => 0.5 }));
  arma.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
  e.equipment = { ...e.equipment, weapon: arma };
  e.inventory = [GS.itemDaGema({ id: G.doSlug('Lightning_Spire_Trap').itemId, nivel: 20, xp: 0, raridade: 'comum' })];
  GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: G.doSlug('Lightning_Spire_Trap').acao, enabled: true, minMana: 0, conditions: [] };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 1e6;
  const [b, ...resto] = e.hunt.monstros;
  for (const m of resto) Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60 });
  Object.assign(b, { x: e.hunt.pos.x + 4, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12 });
  Plantadas.plantar(e.hunt, Ficha.combate(e), { tipo: 'armadilha', acao: e.actions[0].id, slot: 0, x: e.hunt.pos.x + 3, y: e.hunt.pos.y, duracaoMs: 4000, agora: e.hunt.clock });
  // o inimigo a 1 casa ativa: a torre nasce e golpeia na hora (3 áreas no mesmo inimigo — o único perto)
  const ev0 = Acoes.tiqueDasPlantadas(e, e.hunt, PERSONAGEM, []);
  const golpes = (ev) => ev.filter((x) => x.t === 'dmg' && x.uid === b.uid && x.foe).length;
  assert.equal(golpes(ev0), 3, 'o primeiro golpe: 3 áreas');
  assert.equal(e.hunt.poeTorres?.length, 1);
  // 1 s depois: 1000 / 360 → mais 2 golpes de 3 áreas (o de 360 e o de 720)
  e.hunt.clock += 1000;
  assert.equal(golpes(Acoes.tiqueDasPlantadas(e, e.hunt, PERSONAGEM, [])), 6);
  // passada a duração (3,5 s), acabou
  e.hunt.clock += 5000;
  Acoes.tiqueDasPlantadas(e, e.hunt, PERSONAGEM, []);
  assert.equal(e.hunt.poeTorres, undefined);
  assert.ok(!G.doSlug('Lightning_Spire_Trap').motivosNoJogo.some((m) => /repetições|Ataca a cada|Golpeia/.test(m)), G.doSlug('Lightning_Spire_Trap').motivosNoJogo.join(' | '));
});
