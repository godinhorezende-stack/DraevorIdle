// Prey: cada comando do painel (`openPrey`, panels.mjs) e cada bônus em combate.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CATALOGO } from '../systems/dados.mjs';
import * as Prey from '../systems/prey.mjs';
import * as Loja from '../systems/loja.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Ficha from '../systems/ficha.mjs';
import { personagemDeTeste, PERSONAGEM, comMarcaNova, HUNT_DE_TESTE } from './apoio.mjs';
import { doClassico } from './apoio-migracao.mjs';

const API = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'api-mapeada');
const capturado = (arquivo) => comMarcaNova(JSON.parse(readFileSync(join(API, arquivo), 'utf8')));
const HORA = 3_600_000;

function novo(opcoes) {
  const estado = personagemDeTeste(opcoes);
  Prey.garantir(estado, 1_000_000);
  return estado;
}

// ---- Fidelidade aos personagens REAIS capturados ----

test('percentual por estrela bate com todos os slots reais capturados', () => {
  const reais = [
    ...capturado('character-real-example.json').prey,
    ...capturado('treino-online-full.json').character?.prey ?? [],
  ].filter((s) => s.bonus);
  assert.ok(reais.length >= 2);
  for (const s of reais) assert.equal(Prey.percentual(s.bonus, s.rarity), s.percent, `${s.bonus} ${s.rarity}★`);
  // Os extremos do Tibia.
  assert.equal(Prey.percentual('damage', 1), 7);
  assert.equal(Prey.percentual('damage', 10), 25);
  assert.equal(Prey.percentual('defense', 1), 12);
  assert.equal(Prey.percentual('exp', 10), 40);
});

test('preço da lista nova é 200 x level (1.600 no 8, 80.000 no 400, como capturado)', () => {
  assert.equal(Prey.paraCliente(personagemDeTeste({ level: 8 })).preyRerollCost, 1600);
  assert.equal(Prey.paraCliente(personagemDeTeste({ level: 400 })).preyRerollCost, 80000);
});

test('personagem novo nasce com o formato real: 2 slots abertos com 9 criaturas e o 3º travado', () => {
  const agora = 1_000_000;
  const { prey } = Prey.paraCliente(novo());
  const real = capturado('character-real-example.json').prey;
  assert.equal(prey.length, 3);
  for (const slot of prey) assert.deepEqual(Object.keys(slot).sort(), Object.keys(real[slot.index]).sort());
  for (const slot of prey.slice(0, 2)) {
    assert.equal(slot.state, 'selection');
    assert.equal(slot.key, null);
    assert.equal(slot.options.length, 9);
    assert.equal(new Set(slot.options).size, 9);
    for (const key of slot.options) {
      assert.ok(CATALOGO.bestiary[key].exp > 0 && !CATALOGO.bestiary[key].boss, key);
    }
    assert.equal(slot.percent, Prey.percentual(slot.bonus, slot.rarity));
    assert.equal(slot.total, 7_200_000);
    assert.equal(slot.freeRerollAte, agora + 20 * HORA);
  }
  assert.equal(prey[2].state, 'locked');
  assert.deepEqual(prey[2].options, []);
});

// ---- Os comandos ----

test('choose: escolhe da lista e ativa 2h; recusa fora da lista, slot ocupado e travado', () => {
  const e = novo();
  const [s0, s1] = e.prey;
  assert.equal(Prey.comando(e, { action: 'choose', slot: 0, key: 'nao-existe' }).ok, false);
  assert.equal(Prey.comando(e, { action: 'choose', slot: 2, key: s0.options[0] }).ok, false);
  const key = s0.options[0];
  assert.ok(Prey.comando(e, { action: 'choose', slot: 0, key }).ok);
  assert.equal(s0.key, key);
  assert.equal(s0.left, 2 * HORA);
  assert.equal(s0.state, 'active');
  assert.deepEqual(s0.options, []);
  assert.equal(Prey.comando(e, { action: 'choose', slot: 0, key }).erro, 'Esse slot já tem uma presa.');
  // A mesma criatura em outro slot não pode (o bônus não empilha).
  s1.options[0] = key;
  assert.equal(Prey.comando(e, { action: 'choose', slot: 1, key }).ok, false);
  assert.equal(e.wildcards, 5, 'escolher da lista é de graça');
});

test('selectAll: qualquer criatura do bestiário por 5 wildcards; recusa boss, repetida e sem saldo', () => {
  const e = novo();
  assert.equal(e.wildcards, 5);
  const boss = Object.keys(CATALOGO.bestiary).find((k) => CATALOGO.bestiary[k].boss);
  assert.equal(Prey.comando(e, { action: 'selectAll', slot: 0, key: boss }).ok, false);
  assert.ok(Prey.comando(e, { action: 'selectAll', slot: 0, key: 'troll' }).ok);
  assert.equal(e.prey[0].key, 'troll');
  assert.equal(e.wildcards, 0);
  e.wildcards = 10;
  assert.equal(Prey.comando(e, { action: 'selectAll', slot: 1, key: 'troll' }).ok, false, 'troll já é presa no slot 0');
  e.wildcards = 4;
  const r = Prey.comando(e, { action: 'selectAll', slot: 1, key: 'amazon' });
  assert.equal(r.ok, false);
  assert.equal(e.wildcards, 4, 'recusa não cobra');
});

test('rerollBonus: custa 1 wildcard, nunca piora as estrelas e reinicia o relógio da presa ativa', () => {
  const e = novo();
  e.wildcards = 200;
  const s = e.prey[0];
  Prey.comando(e, { action: 'choose', slot: 0, key: s.options[0] });
  s.left = 10;
  for (let i = 0; i < 100; i++) {
    const antes = s.rarity;
    assert.ok(Prey.comando(e, { action: 'rerollBonus', slot: 0 }).ok);
    assert.ok(s.rarity >= antes);
    assert.equal(s.percent, Prey.percentual(s.bonus, s.rarity));
  }
  assert.equal(e.wildcards, 100);
  assert.equal(s.left, 2 * HORA);
  assert.ok(new Set(['damage', 'defense', 'exp', 'loot']).has(s.bonus));
  e.wildcards = 0;
  assert.equal(Prey.comando(e, { action: 'rerollBonus', slot: 0 }).ok, false);
});

test('rerollList: grátis quando o relógio passou (e volta 20h), senão cobra 200 x level de ouro', () => {
  const e = novo();
  const s = e.prey[0];
  const listaVelha = [...s.options];
  // Antes das 20h: cobra.
  e.gold = 1599;
  assert.equal(Prey.novaLista(e, { slot: 0 }, 1_000_000).ok, false);
  e.gold = 1600;
  assert.ok(Prey.novaLista(e, { slot: 0 }, 1_000_000).ok);
  assert.equal(e.gold, 0);
  assert.notDeepEqual(s.options, listaVelha);
  // Depois das 20h: grátis, e o relógio volta a contar.
  const depois = s.freeRerollAte + 1;
  assert.ok(Prey.novaLista(e, { slot: 0 }, depois).ok);
  assert.equal(e.gold, 0);
  assert.equal(s.freeRerollAte, depois + 20 * HORA);
  // Com presa ativa, a lista nova descarta a presa.
  Prey.comando(e, { action: 'choose', slot: 0, key: s.options[0] });
  e.gold = 1600;
  assert.ok(Prey.novaLista(e, { slot: 0 }, depois + 1).ok);
  assert.equal(s.key, null);
  assert.equal(s.state, 'selection');
  assert.equal(s.options.length, 9);
});

test('a lista nova nunca traz a criatura que já é presa ativa em outro slot', () => {
  const e = novo();
  e.gold = 1e12;
  Prey.comando(e, { action: 'selectAll', slot: 0, key: 'troll' });
  for (let i = 0; i < 300; i++) {
    Prey.novaLista(e, { slot: 1 }, 1_000_000);
    assert.ok(!e.prey[1].options.includes('troll'));
  }
});

test('option: liga/desliga "Renovar sozinho" e "Travar bônus", que são excludentes', () => {
  const e = novo();
  const s = e.prey[0];
  assert.ok(Prey.comando(e, { action: 'option', slot: 0, option: 'autoReroll', value: true }).ok);
  assert.equal(s.autoReroll, true);
  assert.ok(Prey.comando(e, { action: 'option', slot: 0, option: 'lock', value: true }).ok);
  assert.equal(s.locked, true);
  assert.equal(s.autoReroll, false);
  assert.ok(Prey.comando(e, { action: 'option', slot: 0, option: 'lock', value: false }).ok);
  assert.equal(s.locked, false);
  assert.equal(Prey.comando(e, { action: 'option', slot: 0, option: 'outra', value: true }).ok, false);
  assert.equal(e.wildcards, 5, 'ligar não cobra — cobra na renovação');
});

test('comando desconhecido e slot inexistente viram erro, não exceção', () => {
  const e = novo();
  assert.equal(Prey.comando(e, { action: 'xyz', slot: 0 }).ok, false);
  assert.equal(Prey.comando(e, { action: 'rerollBonus', slot: 7 }).ok, false);
});

// ---- O relógio e a renovação ----

test('o tempo desce só quando consumido; ao zerar sem renovação, o slot volta à escolha com lista nova', () => {
  const e = novo();
  const s = e.prey[0];
  Prey.comando(e, { action: 'choose', slot: 0, key: s.options[0] });
  Prey.consumir(e, HORA);
  assert.equal(s.left, HORA);
  Prey.consumir(e, HORA);
  assert.equal(s.key, null);
  assert.equal(s.state, 'selection');
  assert.equal(s.options.length, 9);
});

test('"Travar bônus" renova a mesma presa com o mesmo bônus por 5 wildcards', () => {
  const e = novo();
  const s = e.prey[0];
  Prey.comando(e, { action: 'choose', slot: 0, key: s.options[0] });
  Prey.comando(e, { action: 'option', slot: 0, option: 'lock', value: true });
  const { key, bonus, rarity } = s;
  Prey.consumir(e, 2 * HORA);
  assert.deepEqual([s.key, s.bonus, s.rarity, s.left], [key, bonus, rarity, 2 * HORA]);
  assert.equal(e.wildcards, 0);
  // Sem wildcard, não renova: volta para a escolha.
  Prey.consumir(e, 2 * HORA);
  assert.equal(s.key, null);
});

test('"Renovar sozinho" mantém a presa e sorteia bônus novo por 1 wildcard', () => {
  const e = novo();
  const s = e.prey[0];
  Prey.comando(e, { action: 'choose', slot: 0, key: s.options[0] });
  Prey.comando(e, { action: 'option', slot: 0, option: 'autoReroll', value: true });
  const key = s.key;
  Prey.consumir(e, 2 * HORA);
  assert.equal(s.key, key);
  assert.equal(s.left, 2 * HORA);
  assert.equal(s.percent, Prey.percentual(s.bonus, s.rarity));
  assert.equal(e.wildcards, 4);
});

test('o terceiro slot abre ao comprar na Store', () => {
  const e = novo();
  e.coins = 1000;
  assert.ok(Loja.comprar(e, { id: 'prey-slot' }).ok);
  const { prey } = Prey.paraCliente(e);
  assert.equal(prey[2].state, 'selection');
  assert.equal(prey[2].options.length, 9);
});

// ---- Os bônus em combate: só contra a criatura do slot ----

function comPresa(bonus, rarity = 10, key = 'troll') {
  const e = novo();
  Object.assign(e.prey[0], { key, bonus, rarity, percent: Prey.percentual(bonus, rarity), left: HORA, state: 'active' });
  return e;
}

test('fatores: só contra a criatura escolhida e só com tempo sobrando', () => {
  const e = comPresa('exp');
  assert.equal(Prey.fatorDeExp(e, 'troll'), 1.4);
  assert.equal(Prey.fatorDeExp(e, 'amazon'), 1);
  assert.equal(Prey.fatorDeDano(e, 'troll'), 1, 'bônus de exp não dá dano');
  assert.equal(Prey.fatorDeDano(comPresa('damage'), 'troll'), 1.25);
  assert.equal(Prey.fatorDeDefesa(comPresa('defense'), 'troll'), 0.7);
  assert.equal(Prey.fatorDeLoot(comPresa('loot'), 'troll'), 1.4);
  e.prey[0].left = 0;
  assert.equal(Prey.fatorDeExp(e, 'troll'), 1);
  assert.equal(Prey.fatorDeExp(personagemDeTeste(), 'troll'), 1, 'personagem sem prey');
});

test('prey de dano entra no golpe do jogador (rolarCritico)', () => {
  const e = comPresa('damage');
  const ficha = { ...Ficha.combate(e), critChance: 0, onslaughtExtra: 0 };
  const troll = { key: 'troll', uid: 1, x: 0, y: 0 };
  assert.equal(Ficha.rolarCritico(e, 100, troll, [], ficha).dano, 125);
  assert.equal(Ficha.rolarCritico(e, 100, { ...troll, key: 'amazon' }, [], ficha).dano, 100);
});

test('caçando de verdade: prey de exp dá +40% na exp do Troll e o relógio desce', { skip: doClassico("Prey do Draevor (por criatura: Troll)") }, () => {
  const semPrey = personagemDeTeste({ level: 400 });
  const comPrey = personagemDeTeste({ level: 400 });
  Prey.garantir(comPrey);
  Object.assign(comPrey.prey[0], { key: 'troll', bonus: 'exp', rarity: 10, percent: 40, left: HORA, state: 'active' });

  const matarUmTroll = (estado) => {
    assert.ok(Cacadas.entrar(estado, { huntId: HUNT_DE_TESTE, mode: 'auto' }).ok);
    estado.maxHp = estado.hp = 1e9;
    let t = Date.now();
    estado.hunt.ultimoTique = t;
    for (let i = 0; i < 4 * 600; i++) {
      t += 250;
      estado.hp = estado.maxHp;
      const eventos = Cacadas.tique(estado, PERSONAGEM, t) ?? [];
      const kill = [...eventos, ...(estado.hunt?.eventos ?? [])].find((ev) => ev.t === 'kill' && ev.name === 'Troll');
      if (kill) return kill.exp;
    }
    assert.fail('não matou nenhum troll em 10 minutos');
  };
  const base = matarUmTroll(semPrey);
  const comBonus = matarUmTroll(comPrey);
  assert.equal(comBonus, Math.round(base * 1.4));
  assert.ok(comPrey.prey[0].left < HORA, 'o relógio da prey correu dentro da hunt');
});
