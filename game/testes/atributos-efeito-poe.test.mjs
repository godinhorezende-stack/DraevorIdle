// Os BÔNUS DOS ATRIBUTOS no PoE (inspeção da árvore, 11/10): são por CADA N pontos inteiros — "+1 de Vida a cada 2 de Força", "1% de Dano
// Físico Corpo a Corpo a cada 5 de Força", "1% de Evasão a cada 5 de Destreza", "+1 de Mana a cada 2 de Inteligência", "1% de Escudo de
// Energia a cada 5 de Inteligência". Com 137 de Inteligência o PoE dá 68 de mana e 27% de ES (e não 68,5 e 27,4%).
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.ITENS_POE = '1';
const Atributos = await import('../systems/personagem/atributos.mjs');

test('PoE: o bônus de cada atributo conta só os grupos inteiros de pontos (para baixo)', () => {
  const ef = Atributos.efeitos({ str: 23, dex: 23, int: 137 });
  assert.equal(ef.vida, 11, '23 de Força → +11 de vida (a cada 2)');
  assert.equal(ef.danoFisicoPct, 4, '23 de Força → 4% de dano físico corpo a corpo (a cada 5)');
  assert.equal(ef.precisao, 46, '23 de Destreza → +46 de precisão (2 por ponto)');
  assert.equal(ef.evasaoPct, 4, '23 de Destreza → 4% de evasão (a cada 5)');
  assert.equal(ef.mana, 68, '137 de Inteligência → +68 de mana (a cada 2)');
  assert.equal(ef.energyShieldPct, 27, '137 de Inteligência → 27% de escudo de energia (a cada 5)');
});

test('PoE: nos múltiplos exatos o bônus é o inteiro, sem erro de arredondamento', () => {
  for (const n of [5, 10, 15, 25, 35, 45, 55, 65, 75, 85, 95, 105, 115, 125, 135, 145, 155, 165, 175, 185, 195, 205, 215, 225, 235, 245, 255]) {
    const ef = Atributos.efeitos({ str: n, dex: n, int: n });
    assert.equal(ef.energyShieldPct, n / 5, `${n} de Inteligência`);
    assert.equal(ef.evasaoPct, n / 5, `${n} de Destreza`);
    assert.equal(ef.danoFisicoPct, n / 5, `${n} de Força`);
  }
});

test('PoE: as keystones que tiram o bônus inerente continuam tirando', () => {
  assert.equal(Atributos.efeitos({ str: 0, dex: 50, int: 50 }, { sem_es_da_int: 1, sem_evasao_da_des: 1 }).energyShieldPct, 0);
  assert.equal(Atributos.efeitos({ str: 0, dex: 50, int: 50 }, { sem_es_da_int: 1, sem_evasao_da_des: 1 }).evasaoPct, 0);
});
