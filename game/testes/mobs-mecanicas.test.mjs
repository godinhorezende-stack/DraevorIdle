// As MECÂNICAS dos modificadores dos mobs (fase 2): cada gatilho muda o
// comportamento pelas contas que já existem (força, intervalo, resistência,
// o caminho do dano no jogador e a limpeza da instância).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Raridade from '../systems/mobs/raridade.mjs';
import * as Mecanicas from '../systems/mobs/mecanicas.mjs';
import * as Buffs from '../systems/mobs/buffs.mjs';
import * as Reforcos from '../systems/skills/reforcos.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Treino from '../systems/treino.mjs';
import * as Instancia from '../systems/hunt/instancia.mjs';
import { criarMonstro } from '../systems/hunt/monstros.mjs';
import { resistenciaDe } from '../systems/hunt/resistencia.mjs';
import { personagemDeTeste } from './apoio.mjs';

/** Um knight dentro da Troll Cave, com UM mob nosso do lado (a instância de verdade). */
function cena(mods, raridade = 'raro', longe = false) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 200 });
  Treino.garantir(e);
  assert.ok(Cacadas.entrar(e, { huntId: 'troll-cave', mode: 'auto' }).ok);
  const hunt = e.hunt;
  hunt.clock ??= 0;
  const inst = Instancia.daSala(hunt);
  const m = Raridade.aplicar(criarMonstro({ key: 'troll', x: hunt.pos.x + (longe ? 6 : 1), y: hunt.pos.y }, null), { raridade, modificadores: mods });
  if (inst) {
    m.instancia = inst.id;
    m.objetivo = 1;
    inst.objetivos.total += 1;
  }
  hunt.monstros.push(m);
  return { e, hunt, m, inst, personagem: e.personagem ?? null };
}

test('Explosivo: ao morrer, fere o jogador perto (pelo caminho de dano do jogador); longe não', () => {
  const perto = cena(['explosivo']);
  const antes = perto.e.hp;
  perto.m.hp = 0;
  const ev = [];
  Mecanicas.aoMorrer(perto.e, perto.hunt, perto.personagem, perto.m, ev);
  assert.ok(perto.e.hp < antes, 'o jogador perdeu vida');
  assert.ok(ev.some((x) => x.t === 'dmg'));
  const longe = cena(['explosivo'], 'raro', true);
  const hp = longe.e.hp;
  longe.m.hp = 0;
  Mecanicas.aoMorrer(longe.e, longe.hunt, longe.personagem, longe.m, []);
  assert.equal(longe.e.hp, hp);
});

test('Procriador: os filhos nascem NA MESMA instância e entram na conta da limpeza', () => {
  const { e, hunt, m, inst, personagem } = cena(['procriador']);
  assert.ok(inst, 'a caçada tem instância');
  const total = inst.objetivos.total;
  const antes = hunt.monstros.length;
  m.hp = 0;
  Mecanicas.aoMorrer(e, hunt, personagem, m, []);
  const filhos = hunt.monstros.slice(antes);
  assert.equal(filhos.length, 2);
  assert.equal(inst.objetivos.total, total + 2);
  for (const f of filhos) {
    assert.equal(f.instancia, inst.id);
    assert.equal(f.maxHp, Math.round((m.maxHp * 35) / 100), "35% da vida do pai");
    assert.equal(f.mods, undefined, 'não gera em cadeia');
    assert.deepEqual(f.loot, []);
  }
  assert.ok(Instancia.pendentes(hunt) >= 2, 'a limpeza espera os filhos');
  for (const f of filhos) f.hp = 0;
});

test('Enfurecido: na vida baixa, UMA vez, mais dano (forcaDoBicho) e golpe mais rápido', () => {
  const { e, hunt, m, personagem } = cena(['enfurecido']);
  const forca = Reforcos.forcaDoBicho(m, hunt.clock);
  Mecanicas.tique(e, hunt, personagem, []);
  assert.equal(m.enfurecido, undefined, 'com a vida cheia, nada');
  m.hp = Math.floor(m.maxHp * 0.2);
  const ev = [];
  Mecanicas.tique(e, hunt, personagem, ev);
  assert.ok(m.enfurecido);
  assert.ok(Math.abs(Reforcos.forcaDoBicho(m, hunt.clock + 60000) - forca * 1.4) < 1e-9, 'o enrage dura até a morte');
  assert.equal(Buffs.soma(m, hunt.clock, 'velocidadeDeAtaquePct'), 30);
  assert.ok(ev.some((x) => x.t === 'say'));
  Mecanicas.tique(e, hunt, personagem, []);
  assert.equal(m.buffsDeMob.length, 1, 'não empilha');
});

test('Vingativo: um aliado morre perto e ele ganha dano por um tempo', () => {
  const { e, hunt, m, personagem } = cena(['vingativo']);
  const aliado = criarMonstro({ key: 'troll', x: m.x + 1, y: m.y }, null);
  hunt.monstros.push(aliado);
  const forca = Reforcos.forcaDoBicho(m, hunt.clock);
  aliado.hp = 0;
  Mecanicas.aoMorrer(e, hunt, personagem, aliado, []);
  assert.ok(Math.abs(Reforcos.forcaDoBicho(m, hunt.clock) - forca * 1.15) < 1e-9);
  assert.equal(Reforcos.forcaDoBicho(m, hunt.clock + 8001), forca, 'acaba');
});

test('Endurecido: cada dano recebido empilha resistência física, até o teto', () => {
  const { e, hunt, m, personagem } = cena(['endurecido']);
  const base = resistenciaDe(hunt, m, 'physical');
  for (let i = 0; i < 8; i++) Mecanicas.aoReceberDano(e, hunt, personagem, m, 10, 'physical', []);
  assert.equal(resistenciaDe(hunt, m, 'physical'), base + 6 * 5);
});

test('Espelhado: parte do dano físico volta no jogador; magia de fogo não', () => {
  const { e, hunt, m, personagem } = cena(['espelhado']);
  const hp = e.hp;
  Mecanicas.aoReceberDano(e, hunt, personagem, m, 50, 'fire', []);
  assert.equal(e.hp, hp);
  Mecanicas.aoReceberDano(e, hunt, personagem, m, 500, 'physical', []);
  assert.ok(e.hp < hp);
});

test('Venenoso: o golpe deixa um dano ao longo do tempo, um pulso por segundo', () => {
  const { e, hunt, m, personagem } = cena(['venenoso']);
  const rnd = Math.random;
  Math.random = () => 0;
  try {
    Mecanicas.aoAtacar(e, hunt, personagem, m, 100, []);
  } finally {
    Math.random = rnd;
  }
  assert.equal(hunt.danoNoTempo.length, 1);
  const hp = e.hp;
  Mecanicas.tique(e, hunt, personagem, []);
  assert.equal(e.hp, hp, 'o primeiro pulso é daqui a 1 s');
  hunt.clock += 4000;
  Mecanicas.tique(e, hunt, personagem, []);
  assert.ok(e.hp < hp);
  assert.equal(hunt.danoNoTempo.length, 0, 'acabou');
});

test('Abrasador: a aura fere quem está perto, no intervalo dela', () => {
  const { e, hunt, m, personagem } = cena(['abrasador']);
  // A aura é 0,5% da vida do mob por segundo: num troll ela some na proteção; num mob grande, não.
  m.maxHp = m.hp = 100000;
  const hp = e.hp;
  Mecanicas.tique(e, hunt, personagem, []);
  const depois = e.hp;
  assert.ok(depois < hp);
  Mecanicas.tique(e, hunt, personagem, []);
  assert.equal(e.hp, depois, 'só de novo depois do intervalo');
  hunt.clock += 1000;
  Mecanicas.tique(e, hunt, personagem, []);
  assert.ok(e.hp < depois);
});

test('mob sem modificador: as mecânicas não fazem nada', () => {
  const { e, hunt, m, personagem } = cena([], 'elite');
  const hp = e.hp;
  m.hp = 1;
  Mecanicas.tique(e, hunt, personagem, []);
  Mecanicas.aoReceberDano(e, hunt, personagem, m, 100, 'physical', []);
  Mecanicas.aoAtacar(e, hunt, personagem, m, 100, []);
  assert.equal(e.hp, hp);
  assert.equal(m.buffsDeMob, undefined);
});
