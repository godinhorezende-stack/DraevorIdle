// O motor de dano das gemas (testes/motor-de-dano.mjs): conta as gemas e mede
// o dano de cada uma de ataque num boneco sem resistência, pelo disparo real.
import * as Dot from '../systems/combate/dot.mjs';
import { ACTION_CATALOG } from '../systems/dados.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Gemas from '../systems/skills/gemas.mjs';
import { contarGemas, medirGema, medirTodas, medirCura, medirTodasAsCuras } from './motor-de-dano.mjs';

test('contagem: ativas + supports = total; toda ativa tem uma função', () => {
  const c = contarGemas();
  assert.equal(c.total, Gemas.DEFS.size);
  assert.equal(c.ativas + c.supports, c.total);
  assert.equal(c.porFuncao.ataque + c.porFuncao.cura + c.porFuncao.suporte, c.ativas);
  assert.equal(c.porTipo.magia + c.porTipo.runa, c.ativas);
  assert.ok(c.porFuncao.ataque > 50);
});

test('toda gema de ATAQUE causa dano no nível 1, no boneco sem resistência', () => {
  // As gemas de DANO CONTÍNUO (Ignite, Envenom...) não batem: põem um efeito de dano ao longo do tempo (testado em `dano-ao-longo-do-tempo.test.mjs`).
  const contino = new Set([...ACTION_CATALOG.spells, ...ACTION_CATALOG.runes].filter((a) => a.overTime && Dot.tipoDaFonte(a.overTime.type)).map((a) => a.id));
  const linhas = medirTodas({ usos: 5 }).filter((l) => !contino.has(l.acao));
  const sem = linhas.filter((l) => !(l.media > 0)).map((l) => `${l.acao}: ${l.erro ?? l.media}`);
  assert.deepEqual(sem, []);
});

test('a medida é repetível (semente) e o nível 20 bate mais que o 1', () => {
  const a = medirGema('spell-flame-strike', { usos: 20 });
  assert.deepEqual(medirGema('spell-flame-strike', { usos: 20 }), a);
  assert.equal(a.usos, 20, 'todos os usos contam (recarga e intervalo do combo zerados)');
  // O sorteio entre o mínimo e o máximo só aparece com números maiores que o arredondamento (no level 1 a magia dá ~5 de dano): mede num level alto.
  const alto = medirGema('spell-flame-strike', { usos: 20, level: 200 });
  assert.ok(alto.maximo > alto.minimo, 'o dano sorteia entre o mínimo e o máximo');
  const n20 = medirGema('spell-flame-strike', { usos: 20, nivel: 20 });
  assert.ok(n20.media > a.media, `${a.media} → ${n20.media}`);
});

test('o boneco não tem resistência: mesmo personagem, magias de elementos diferentes e mesmo dano de catálogo batem igual', () => {
  // Energy Strike e Terra Strike são strikes de 1º círculo (mesmo dano de catálogo); no troll, a resistência os separa.
  const o = { level: 100, usos: 40, classe: 'sorcerer' };
  // (Descontado o balanceamento de cada gema — `fatorDeDano`.)
  const fator = (id) => Gemas.DEFS.get(Gemas.ITEM_DA_ACAO.get(id)).fatorDeDano;
  const energia = medirGema('spell-energy-strike', o).media / fator('spell-energy-strike');
  const terra = medirGema('spell-terra-strike', o).media / fator('spell-terra-strike');
  assert.ok(Math.abs(energia - terra) / Math.max(energia, terra) < 0.15, `${energia} × ${terra}`);
});

test('cura: toda gema de cura cura no nível 1; o nível 20 cura mais; o level do personagem também escala', () => {
  const sem = medirTodasAsCuras({ usos: 5 }).filter((l) => !(l.media > 0)).map((l) => `${l.acao}: ${l.erro ?? l.media}`);
  assert.deepEqual(sem, []);
  const n1 = medirCura('spell-intense-healing', { usos: 20, level: 100, magicLevel: 0 });
  const n20 = medirCura('spell-intense-healing', { usos: 20, level: 100, nivel: 20, magicLevel: 0 });
  assert.ok(n20.media > n1.media * 1.3, `${n1.media} → ${n20.media}`);
  const alto = medirCura('spell-intense-healing', { usos: 20, level: 400, magicLevel: 0 });
  assert.ok(alto.media > n1.media * 1.3, `level 100 ${n1.media} → level 400 ${alto.media}`);
});
