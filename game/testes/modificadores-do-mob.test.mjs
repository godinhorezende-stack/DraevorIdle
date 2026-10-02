// A RARIDADE e os AFIXOS dos monstros com regras (etapa 4, dono 02/10): categoria, raridades e espécies permitidas, incompatibilidades,
// teto ofensivo e de resistência (erros) e combinações punitivas (avisos) — sem tocar nos mapas que já existem.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import * as R from '../systems/mobs/raridade.mjs';
import * as M from '../systems/mobs/atributos.mjs';
import { criarMonstro } from '../systems/hunt/monstros.mjs';
import { validar as validarSpawns } from '../systems/mapa/spawns.mjs';

const REGRAS = R.CONFIG.regras;
const comMod = (id, extra, fn) => {
  const antes = R.MODIFICADORES[id];
  R.MODIFICADORES[id] = { ...antes, ...extra };
  try { return fn(); } finally { R.MODIFICADORES[id] = antes; }
};

test('os modificadores novos (Acurado, Evasivo, Afiado, Escudado, Temperado) declaram categoria e valem nos atributos do mob', () => {
  for (const id of ['acurado', 'evasivo', 'afiado', 'escudado', 'temperado']) assert.ok(R.MODIFICADORES[id], id);
  assert.equal(R.categoriaDe('acurado'), 'ofensivo');
  assert.equal(R.categoriaDe('escudado'), 'defensivo');
  const m = R.aplicar(criarMonstro({ key: 'troll', x: 1, y: 1 }, null), { raridade: 'raro', modificadores: ['acurado', 'evasivo', 'afiado', 'escudado', 'temperado'] });
  assert.equal(m.precisaoPct, 30);
  assert.equal(m.evasaoPct, 40);
  assert.equal(m.critChance, 8);
  assert.equal(m.critMultiplicador, 25);
  assert.equal(m.bloqueio, 25);
  assert.equal(m.reducaoDeDano, 15);
  assert.equal(M.critico(m).chance, 0.08);
  assert.equal(M.critico(m).fator, 1.75, 'o multiplicador padrão (150%) + 25');
  assert.equal(M.bloqueioDe(m), 0.25);
  assert.equal(M.reducaoDeDano(m), 0.15);
});

test('a categoria sai dos stats quando o modificador não declara', () => {
  assert.equal(R.categoriaDe('brutal'), 'ofensivo');
  assert.equal(R.categoriaDe('veloz'), 'velocidade');
  assert.equal(R.categoriaDe('vigoroso'), 'defensivo');
  assert.equal(R.categoriaDe('ignifugo'), 'defensivo');
  assert.equal(R.categoriaDe('explosivo'), 'mecanica');
  assert.equal(R.categoriaDe('nao-existe'), null);
});

test('raridades permitidas: o Escudado só entra de Raro para cima (o Mágico recusa), e o texto diz onde', () => {
  assert.ok(R.motivoDeNaoEntrar('escudado', 'modificado'));
  assert.match(R.motivoDeNaoEntrar('escudado', 'modificado'), /Escudado.*não entra em Mágico/);
  assert.equal(R.motivoDeNaoEntrar('escudado', 'raro'), null);
  assert.equal(R.motivoDeNaoEntrar('brutal', 'modificado'), null, 'sem declaração: entra em todas');
  assert.ok(R.errosDoSpawn({ key: 'troll', raridade: 'modificado', modificadores: ['escudado'] }).some((e) => /não entra em Mágico/.test(e)));
  assert.deepEqual(R.errosDoSpawn({ key: 'troll', raridade: 'raro', modificadores: ['escudado'] }), []);
});

test('incompatibilidades: o Escudado não combina com o Evasivo (erro, nos dois sentidos)', () => {
  const e = R.validarCombinacao('raro', ['escudado', 'evasivo']).erros;
  assert.equal(e.length, 1);
  assert.match(e[0], /não combina/);
  assert.equal(R.validarCombinacao('raro', ['evasivo', 'escudado']).erros.length, 1);
  assert.deepEqual(R.validarCombinacao('raro', ['evasivo', 'acurado']).erros, []);
});

test('compatibilidade com a espécie: `especies`, `classes` e `exceto` limitam onde o modificador entra', () => {
  comMod('brutal', { especies: ['rat'] }, () => {
    assert.ok(R.validarCombinacao('raro', ['brutal'], ['troll']).erros.length);
    assert.deepEqual(R.validarCombinacao('raro', ['brutal'], ['rat']).erros, []);
  });
  comMod('brutal', { exceto: ['troll'] }, () => {
    assert.ok(R.validarCombinacao('raro', ['brutal'], ['troll']).erros.length);
    assert.deepEqual(R.validarCombinacao('raro', ['brutal'], ['rat']).erros, []);
  });
  comMod('brutal', { classes: ['Dragon'] }, () => {
    assert.ok(R.validarCombinacao('raro', ['brutal'], ['troll']).erros.length, 'troll não é Dragon');
  });
});

test('limite ofensivo: dano da raridade × dano × velocidade não passa do teto (erro); o que existe nos mapas continua válido', () => {
  const f = R.forcaDaCombinacao('boss', ['brutal', 'frenetico']);
  assert.ok(Math.abs(f.ofensivo - 1.8 * 1.25 * 1.35) < 1e-9);
  const antes = REGRAS.ofensivoMaximo;
  REGRAS.ofensivoMaximo = 2.5;
  try {
    assert.ok(R.validarCombinacao('boss', ['brutal', 'frenetico']).erros.some((e) => /bate forte demais/.test(e)));
  } finally {
    REGRAS.ofensivoMaximo = antes;
  }
  assert.deepEqual(R.validarCombinacao('boss', ['brutal', 'frenetico']).erros, []);
});

test('resistência somada: os modificadores não passam do teto por elemento (erro)', () => {
  const antes = REGRAS.resistenciaSomadaMaxima;
  REGRAS.resistenciaSomadaMaxima = 50;
  try {
    assert.ok(R.validarCombinacao('raro', ['ignifugo', 'resistente']).erros.some((e) => /55% de resistência a fogo/.test(e)));
    assert.deepEqual(R.validarCombinacao('raro', ['gelido', 'resistente']).erros.filter((e) => /resistência a gelo/.test(e)).length, 1);
    assert.deepEqual(R.validarCombinacao('raro', ['ignifugo']).erros, []);
  } finally {
    REGRAS.resistenciaSomadaMaxima = antes;
  }
});

test('limite por categoria da raridade (configurável, vazio por padrão): erro quando passa', () => {
  assert.deepEqual(REGRAS.maxPorCategoria, {});
  REGRAS.maxPorCategoria = { raro: { defensivo: 1 } };
  try {
    assert.ok(R.validarCombinacao('raro', ['vigoroso', 'ignifugo']).erros.some((e) => /aceita até 1 modificador\(es\) defensivo/.test(e)));
    assert.deepEqual(R.validarCombinacao('raro', ['vigoroso', 'brutal']).erros, []);
  } finally {
    REGRAS.maxPorCategoria = {};
  }
});

test('aviso de combinação punitiva: dano alto + ataque rápido + mitigação gera AVISO (não bloqueia o spawn)', () => {
  const s = { key: 'troll', raridade: 'raro', modificadores: ['vigoroso', 'brutal', 'frenetico'] };
  assert.equal(R.avisosDoSpawn(s).length, 1);
  assert.match(R.avisosDoSpawn(s)[0], /dano alto, ataque rápido e mitigação/);
  assert.deepEqual(R.errosDoSpawn(s), [], 'aviso não é erro');
  assert.deepEqual(R.avisosDoSpawn({ key: 'troll', raridade: 'raro', modificadores: ['brutal', 'frenetico'] }), [], 'sem mitigação: sem aviso');
});

test('COMPATIBILIDADE: nenhum spawn dos mapas do repositório vira erro com as regras novas (os de produção foram conferidos na entrega: 2.014 spawns, 0 erros, 16 avisos)', () => {
  const dirs = [new URL('../gamedata/hunts/', import.meta.url)];
  let n = 0;
  for (const dir of dirs) {
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      let j;
      try { j = JSON.parse(readFileSync(typeof dir === 'string' ? dir + f : new URL(f, dir), 'utf8')); } catch { continue; }
      const andar = (x) => {
        if (Array.isArray(x)) return x.forEach(andar);
        if (!x || typeof x !== 'object') return;
        if (Array.isArray(x.modificadores) && x.modificadores.length) {
          n++;
          assert.deepEqual(R.errosDoSpawn(x), [], `${f}: ${JSON.stringify(x.modificadores)}`);
        }
        Object.values(x).forEach(andar);
      };
      andar(j);
    }
  }
  assert.ok(n > 100, `spawns com modificador conferidos: ${n}`);
});

test('o editor de mapas recebe categoria, raridades permitidas, incompatíveis e as regras; a descrição sai dos stats (inclusive os novos)', () => {
  const o = R.opcoesParaEditor();
  const esc = o.modificadores.find((x) => x.id === 'escudado');
  assert.equal(esc.categoria, 'defensivo');
  assert.deepEqual(esc.raridades, ['raro', 'elite', 'unico', 'boss']);
  assert.deepEqual(esc.incompativeis, ['evasivo']);
  assert.match(esc.descricao, /25% de chance de bloquear/);
  assert.match(o.modificadores.find((x) => x.id === 'afiado').descricao, /8% de chance de crítico \(\+25% de dano crítico\)/);
  assert.match(o.modificadores.find((x) => x.id === 'evasivo').descricao, /\+40% de evasão/);
  assert.equal(o.regras.ofensivoMaximo, 3.5);
});

test('o validador de spawns do mapa usa as regras (erro para modificador fora da raridade)', () => {
  const erros = validarSpawns([{ id: 1, x: 1, y: 1, quantidade: 1, criaturas: [{ key: 'troll', peso: 1 }], raridade: 'modificado', modificadores: ['escudado'] }], { largura: 10, altura: 10 });
  assert.ok(erros.some((e) => /não entra em Mágico/.test(e)), erros.join(' | '));
  assert.deepEqual(validarSpawns([{ id: 1, x: 1, y: 1, quantidade: 1, criaturas: [{ key: 'troll', peso: 1 }], raridade: 'raro', modificadores: ['brutal'] }], { largura: 10, altura: 10 }), []);
});
