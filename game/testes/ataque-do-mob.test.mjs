// O ATAQUE dos monstros (etapa 3, dono 02/10): velocidade de ataque com limites, crítico (só quem tem), dano de vários tipos no mesmo golpe,
// e os efeitos de dano contínuo no jogador pelo motor `combate/dot.mjs` (o Venenoso já passa por ele). Nenhum mob muda por padrão.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../systems/mobs/atributos.mjs';
import * as Dot from '../systems/combate/dot.mjs';
import * as Raridade from '../systems/mobs/raridade.mjs';
import * as Mecanicas from '../systems/mobs/mecanicas.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Ficha from '../systems/ficha.mjs';
import * as Afixos from '../systems/afixos.mjs';
import { criarMonstro } from '../systems/hunt/monstros.mjs';
import { contraAtaque } from '../systems/hunt/combate.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import { personagemDeTeste, PERSONAGEM, HUNT_DE_TESTE } from './apoio.mjs';

const troll = (extra = {}) => Object.assign(criarMonstro({ key: 'troll', x: 1, y: 1 }, null), extra);
const comEspecie = (dados, fn) => {
  const antes = M.CONFIG.porEspecie.especies;
  M.CONFIG.porEspecie.especies = { troll: dados };
  try { return fn(); } finally { M.CONFIG.porEspecie.especies = antes; }
};

test('a velocidade de ataque: sem modificador o intervalo é o de sempre (2 s ÷ lentidão); a velocidade tem limites e o intervalo, um mínimo', () => {
  assert.equal(M.intervaloDoGolpe(troll()), 2000);
  assert.equal(M.intervaloDoGolpe(troll({ velocidadeDeAtaque: 2 })), 1000);
  assert.equal(M.intervaloDoGolpe(troll(), { lentidao: 1.5 }), 3000);
  assert.equal(M.intervaloDoGolpe(troll({ velocidadeDeAtaque: 1.25 }), { buffPct: 20 }), Math.round(2000 / 1.5));
  assert.equal(M.intervaloDoGolpe(troll({ velocidadeDeAtaque: 1000 })), Math.round(2000 / M.CONFIG.ataque.velocidadeMaxima), 'a velocidade não passa do teto');
  assert.equal(M.intervaloDoGolpe(troll({ velocidadeDeAtaque: 0.0001 })), Math.round(2000 / M.CONFIG.ataque.velocidadeMinima), 'nem fica abaixo do piso');
  assert.ok(M.intervaloDoGolpe(troll({ velocidadeDeAtaque: 1000 }), { base: 100 }) >= M.CONFIG.ataque.intervaloMinimoMs, 'o intervalo nunca fica absurdamente baixo');
});

test('crítico do mob: nenhum mob tem por padrão; espécie, ataque e modificador ligam; rola UMA vez; o teto vale', () => {
  assert.deepEqual(M.critico(troll()), { chance: 0, fator: 1.5 });
  assert.deepEqual(M.rolarCritico(troll(), null, () => 0), { critico: false, fator: 1 }, 'sem chance nunca critica');
  comEspecie({ critChance: 100, critMultiplicador: 130 }, () => {
    assert.deepEqual(M.critico(troll()), { chance: 1, fator: 1.3 });
    assert.deepEqual(M.rolarCritico(troll(), null, () => 0.99), { critico: true, fator: 1.3 });
  });
  comEspecie({ critChance: 25 }, () => {
    assert.deepEqual(M.rolarCritico(troll(), null, () => 0.1), { critico: true, fator: 1.5 }, 'multiplicador padrão');
    assert.equal(M.rolarCritico(troll(), null, () => 0.3).critico, false);
  });
  assert.equal(M.critico(troll(), { critChance: 40, critMultiplicador: 200 }).fator, 2, 'o ataque tem o dele');
  assert.equal(M.critico(troll({ critChance: 900 })).chance, 1, 'teto de 100%');
  const mod = Raridade.aplicar(troll(), { raridade: 'raro', modificadores: [] });
  assert.equal(M.critico(mod).chance, 0);
  assert.equal(Raridade.statsDos([]).critChance, 0);
});

test('o intervalo do mob no combate de verdade usa os limites: um mob frenético não bate mais que o teto de velocidade', () => {
  const m = troll({ velocidadeDeAtaque: 50 });
  const iv = M.intervaloDoGolpe(m, { base: 2000 });
  assert.equal(iv, 500);
});

function cena() {
  const e = personagemDeTeste({ vocacao: 'knight', level: 100 });
  e.maxHp = e.hp = 1e9;
  assert.ok(Cacadas.entrar(e, { huntId: HUNT_DE_TESTE, mode: 'auto' }).ok);
  const h = e.hunt;
  const m = Object.assign(criarMonstro({ key: 'troll', x: h.pos.x + 1, y: h.pos.y }, null), {});
  h.monstros.splice(0, h.monstros.length, m);
  return { e, h, m };
}
const bater = (e, h, m) => {
  const ev = [];
  const original = Math.random;
  Math.random = () => 0.5;
  try { contraAtaque(e, h, PERSONAGEM, m, ev); } finally { Math.random = original; }
  return ev;
};
const danoNoJogador = (ev) => ev.filter((x) => x.t === 'dmg' && !x.foe).reduce((n, x) => n + x.v, 0);

test('dano de OUTRO tipo no mesmo golpe: soma ao físico, cada um com a defesa do seu tipo (a resistência a fogo corta só o fogo)', () => {
  const sem = cena();
  const semExtra = danoNoJogador(bater(sem.e, sem.h, sem.m));
  comEspecie({ danoExtra: [{ elemento: 'fire', min: 4000, max: 4000 }] }, () => {
    const a = cena();
    const comFogo = danoNoJogador(bater(a.e, a.h, a.m));
    assert.ok(comFogo > semExtra + 1000, `${semExtra} → ${comFogo}`);
    // Com resistência a fogo no jogador, o fogo cai e o físico fica igual.
    const b = cena();
    const ANEL = Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'might ring').id);
    b.e.equipment.ring = { id: ANEL, count: 1, af: [{ id: 'fire_res', nivel: 5, value: 60 }] };
    Afixos.sincronizarMaximos(b.e);
    Ficha.invalidar(b.e);
    const resistido = danoNoJogador(bater(b.e, b.h, b.m));
    assert.ok(resistido < comFogo, `${resistido} < ${comFogo}`);
    assert.ok(resistido > semExtra, 'o físico segue');
  });
});

test('o crítico do mob dobra o golpe todo (todos os tipos) e marca o evento; sem crítico, nada', () => {
  const sem = cena();
  const evSem = bater(sem.e, sem.h, sem.m);
  assert.ok(!evSem.some((x) => x.crit));
  comEspecie({ critChance: 100, critMultiplicador: 300 }, () => {
    const c = cena();
    const ev = bater(c.e, c.h, c.m);
    assert.ok(ev.some((x) => x.t === 'dmg' && !x.foe && x.crit), 'o dano vem marcado como crítico');
    assert.ok(danoNoJogador(ev) > danoNoJogador(evSem) * 1.5, `${danoNoJogador(evSem)} → ${danoNoJogador(ev)}`);
  });
});

test('os efeitos do golpe: dano contínuo no jogador pelo motor (sangramento renova, veneno empilha); a armadura não reduz o pulso', () => {
  comEspecie({ efeitos: [{ tipo: 'sangramento', chance: 100, pctDoGolpe: 80 }, { tipo: 'veneno', chance: 100, pctDoGolpe: 40 }] }, () => {
    const { e, h, m } = cena();
    bater(e, h, m);
    bater(e, h, m);
    const dots = h.efeitosDoJogador.dots;
    assert.equal(dots.filter((d) => d.tipo === 'sangramento').length, 1, 'sangramento: uma só (renova)');
    assert.equal(dots.filter((d) => d.tipo === 'veneno').length, 2, 'veneno: empilha');
    assert.ok(dots.every((d) => d.origem.fonte === 'mob' && d.origem.mob === 'Troll'));
    // Os pulsos pagam pelo tique das mecânicas (um por segundo), na vida do jogador.
    const hp = e.hp;
    h.clock = (h.clock ?? 0) + 1500;
    Mecanicas.tique(e, h, PERSONAGEM, []);
    assert.ok(e.hp < hp, 'o pulso tirou vida');
  });
});

test('o motor de efeitos no JOGADOR: mesmas regras de acumulação, estados ativos e remoção', () => {
  const h = { clock: 0 };
  assert.equal(Dot.aplicarNoJogador(h, { tipo: 'veneno', total: 600 }, 0), 'envenenado');
  assert.equal(Dot.aplicarNoJogador(h, { tipo: 'veneno', total: 300 }, 0), 'envenenado');
  assert.equal(h.efeitosDoJogador.dots.length, 2);
  assert.equal(Dot.aplicarNoJogador(h, { tipo: 'queimadura', total: 400 }, 0), 'queimando');
  assert.equal(Dot.aplicarNoJogador(h, { tipo: 'queimadura', total: 100 }, 100), null, 'queimadura: só a maior');
  assert.deepEqual(Dot.ativosNoJogador(h, 500), ['queimando', 'envenenado']);
  const pagos = [];
  Dot.tiqueDoJogador(h, 1000, (origem, valor, elemento, nome) => { pagos.push([elemento, nome]); return valor; });
  assert.ok(pagos.some(([el]) => el === 'earth') && pagos.some(([el]) => el === 'fire'));
  Dot.removerDoJogador(h, 'veneno');
  assert.deepEqual(Dot.ativosNoJogador(h, 1500), ['queimando']);
  assert.equal(Dot.tipoDoElemento('earth'), 'veneno');
  assert.equal(Dot.tipoDoElemento('physical'), 'sangramento');
  assert.equal(Dot.tipoDoElemento('ice'), 'gelo');
});

test('os extras e os efeitos de uma MAGIA do mob (`extras`, `efeitos` no ataque) são lidos sem a espécie', () => {
  const a = { extras: [{ elemento: 'death', min: 20, max: 10 }, { elemento: 'fire', min: 0, max: 0 }], efeitos: [{ tipo: 'veneno', chance: 50, pctDoGolpe: 30 }, { tipo: 'veneno', pctDoGolpe: 0 }] };
  assert.deepEqual(M.danoExtraDoGolpe(null, a), [{ elemento: 'death', min: 10, max: 20 }], 'faixa ordenada; tipo sem dano some');
  assert.equal(M.efeitosDoGolpe(null, a).length, 1);
  assert.deepEqual(M.danoExtraDoGolpe(troll()), [], 'nenhum mob tem dano extra por padrão');
  assert.deepEqual(M.efeitosDoGolpe(troll()), []);
});
