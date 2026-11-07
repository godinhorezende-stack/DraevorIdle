// (08/11 — o dono: "continue resolvendo os itens") as APROXIMADAS dos únicos, lote A4: o "X% mais/menos" de duração e de Evasão multiplica, como no PoE
// (antes era somado como "aumentada/reduzida").
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.ITENS_POE = '1';
const Cargas = await import('../systems/itens-poe/cargas.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
const tr = (modelo, valores) => T.traduzirMod({ modelo, valores });

test('as linhas saem com as chaves de "mais/menos"', () => {
  assert.deepEqual(tr('{0}% mais Duração do Incêndio', [50]).efeitos.map((e) => [e.stat, e.valor]), [['duracao_incendio_mais', 50]]);
  assert.deepEqual(tr('{0}% menos Duração de Veneno', [50]).efeitos.map((e) => [e.stat, e.valor]), [['poison_duration_mais', -50]]);
  assert.deepEqual(tr('{0}% menos Duração de Cargas de Poder', [90]).efeitos.map((e) => [e.stat, e.valor]), [['duracao_poder_mais', -90]]);
  assert.deepEqual(tr('Mais {0}% de evasão por {1} de mana máximo', [20, 500]).efeitos.map((e) => [e.stat, e.valor]), [['evasion_mais%manaMax:500', 20]]);
});

test('o Vínculo Efêmero: 90% menos Duração das Cargas de Poder multiplica os aumentos (10 s × 1,5 × 0,1 = 1,5 s)', () => {
  assert.equal(Cargas.duracao({}, 'poder'), 10_000);
  assert.equal(Cargas.duracao({ duracao_poder: 50, duracao_poder_mais: -90 }, 'poder'), 1500);
  // (somado, como antes, seriam 10 s × (1 + 0,5 − 0,9) = 6 s)
});

test('o Veneno e o Incêndio: o "mais/menos Duração" multiplica a duração da afecção', async () => {
  const Afeccoes = await import('../systems/itens-poe/afeccoes.mjs');
  const dura = (af, elemento, tipo) => {
    const b = { hp: 1e9, maxHp: 1e9, dots: [], estados: {} };
    Afeccoes.aoAcertar(b, [{ elemento, dano: 1000 }], { afeccoes: Afeccoes.daSoma(af), agora: 0, rng: () => 0.5 });
    return b.dots.find((d) => d.tipo === tipo)?.ate ?? null;
  };
  const venenoSem = dura({ chance_poison: 100 }, 'physical', 'venenoPoe');
  const venenoMenos = dura({ chance_poison: 100, poison_duration: 100, poison_duration_mais: -50 }, 'physical', 'venenoPoe');
  assert.ok(venenoSem > 0, `veneno ${venenoSem}`);
  assert.equal(venenoMenos, venenoSem, '(1 + 100%) × (1 − 50%) = 1');
  const incendioSem = dura({ chance_ignite: 100 }, 'fire', 'queimadura');
  const incendioMais = dura({ chance_ignite: 100, duracao_incendio_mais: 50 }, 'fire', 'queimadura');
  assert.ok(incendioSem > 0, `incêndio ${incendioSem}`);
  assert.equal(incendioMais, Math.round(incendioSem * 1.5));
});
