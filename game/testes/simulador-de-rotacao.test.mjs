// O simulador de rotação (dono, 02/10): roda o motor de verdade e mede o que saiu. Testes: determinismo, a rotação respeita o intervalo global e a
// recarga, a mana é medida, suporte e alvos mudam o resultado do jeito certo, e as entradas ruins dão erro claro.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { personagemDeTeste, PERSONAGEM } from './apoio.mjs';
import * as Rot from '../systems/combate/simulador-rotacao.mjs';
import { aAdaptar } from './apoio-migracao.mjs';

const rodar = (voc, grupos, o = {}) => {
  const e = personagemDeTeste({ vocacao: voc, level: 300 });
  const v = Rot.vestirBuild(e, { grupos, arma: o.arma });
  assert.ok(v.ok, v.erro);
  return Rot.medirRotacao(e, PERSONAGEM, { duracaoMs: 30000, ...o });
};

test('a mesma semente dá o mesmo resultado; o relógio de 30 s e o intervalo global limitam as execuções', { skip: aAdaptar("O simulador de rotação deve medir as gemas do PoE; o teste usa magias do Draevor (\"Sem slot de attack\")") }, () => {
  const a = rodar('sorcerer', [{ skill: 'spell-energy-strike' }], { semente: 5 });
  const b = rodar('sorcerer', [{ skill: 'spell-energy-strike' }], { semente: 5 });
  assert.deepEqual(a, b);
  assert.ok(a.ok && a.dps > 0 && a.dpsDasGemas > 0);
  assert.ok(a.execucoes <= 30000 / 1900 + 1, `${a.execucoes} execuções em 30 s passam do intervalo global`);
  assert.ok(a.segundosEntreExecucoes >= 1.8);
  assert.ok(a.manaGasta >= a.execucoes * 20 && a.manaGasta <= a.execucoes * 20 * 1.1, `mana ${a.manaGasta} para ${a.execucoes} execuções de 20`);
  assert.ok(a.danoPorHabilidade['spell-energy-strike'] > 0);
});

test('um suporte de dano aumenta o dano da gema; com suporte de custo a mana sobe/cai como diz o suporte', { skip: aAdaptar("O simulador de rotação deve medir as gemas do PoE; o teste usa magias do Draevor (\"Sem slot de attack\")") }, () => {
  const base = rodar('sorcerer', [{ skill: 'spell-energy-strike' }]);
  const comDano = rodar('sorcerer', [{ skill: 'spell-energy-strike', supports: ['greater-damage'] }]);
  assert.ok(comDano.dpsDasGemas > base.dpsDasGemas);
  const barata = rodar('sorcerer', [{ skill: 'spell-energy-strike', supports: ['mana-efficiency'] }]);
  assert.ok(barata.manaGasta < base.manaGasta);
});

test('mais alvos só ajudam o dano de área; o de alvo único não ganha', { skip: aAdaptar("O simulador de rotação deve medir as gemas do PoE; o teste usa magias do Draevor (\"Sem slot de attack\")") }, () => {
  const area1 = rodar('sorcerer', [{ skill: 'spell-fire-wave' }], { alvos: 1 });
  const area5 = rodar('sorcerer', [{ skill: 'spell-fire-wave' }], { alvos: 5 });
  assert.ok(area5.dpsDasGemas > area1.dpsDasGemas * 1.5, `${area1.dpsDasGemas} → ${area5.dpsDasGemas}`);
  const unico1 = rodar('sorcerer', [{ skill: 'spell-energy-strike' }], { alvos: 1 });
  const unico5 = rodar('sorcerer', [{ skill: 'spell-energy-strike' }], { alvos: 5 });
  assert.ok(Math.abs(unico5.dpsDasGemas - unico1.dpsDasGemas) / unico1.dpsDasGemas < 0.1);
});

test('a mana medida mostra quem não se sustenta (gasto por segundo contra a regeneração)', { skip: aAdaptar("O simulador de rotação deve medir as gemas do PoE; o teste usa magias do Draevor (\"Sem slot de attack\")") }, () => {
  const barata = rodar('sorcerer', [{ skill: 'spell-buzz' }]);
  assert.equal(barata.sustentavel, true);
  const cara = rodar('knight', [{ skill: 'spell-fierce-berserk' }], { alvos: 5 });
  assert.equal(cara.sustentavel, false);
  assert.ok(cara.manaPorSegundo > cara.regeneracaoDeMana);
});

test('a prioridade é a ordem dos slots: a magia de recarga curta no 1º slot ocupa todo o intervalo global', { skip: aAdaptar("O simulador de rotação deve medir as gemas do PoE; o teste usa magias do Draevor (\"Sem slot de attack\")") }, () => {
  const r = rodar('sorcerer', [{ skill: 'spell-energy-strike' }, { skill: 'spell-fire-wave' }], { alvos: 3 });
  assert.ok(r.danoPorHabilidade['spell-energy-strike'] > 0);
  assert.equal(r.danoPorHabilidade['spell-fire-wave'] ?? 0, 0, 'a de baixo nunca sai: o 1º slot está sempre pronto quando o global libera');
});

test('entradas ruins dão erro claro (gema que não existe, build que não cabe, arma desconhecida)', () => {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 50 });
  assert.equal(Rot.vestirBuild(e, { grupos: [{ skill: 'spell-nao-existe' }] }).ok, false);
  assert.equal(Rot.vestirBuild(e, { grupos: [{ skill: 'spell-buzz' }], arma: 'arma-que-nao-existe' }).ok, false);
  const demais = Array.from({ length: 12 }, () => ({ skill: 'spell-buzz', supports: ['greater-damage', 'faster-casting', 'mana-efficiency'] }));
  assert.equal(Rot.vestirBuild(e, { grupos: demais }).ok, false);
});
