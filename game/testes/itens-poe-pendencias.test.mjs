// A aba PENDÊNCIAS DE MODIFICADORES da engine (admin/itens-poe-pendencias.mjs): todo mod que pode cair numa peça do jogo, com o estado dele.
// Desde 08/10 isso inclui os POOLS ESPECIAIS que as moedas alcançam (a Vaal, as Oculta, os Exalted de influência, as Brasas/Icores) — antes
// a aba só via afixos, implícitos das bases, únicos e frascos, e os mods que as moedas já punham nas peças não apareciam nela.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import './apoio.mjs';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';
import * as P from '../admin/itens-poe-pendencias.mjs';

const SEM = !existsSync(Catalogo.ARQUIVO) && 'dados do PoE ausentes nesta máquina';

test('os pools que as moedas alcançam entram na aba, cada grupo com a sua origem', { skip: SEM }, () => {
  P.esquecer();
  const d = P.pendencias();
  for (const origem of ['corrompido', 'veiled', 'influencia', 'eldritch']) {
    const total = Object.values(d.resumo[origem] ?? {}).reduce((a, b) => a + b, 0);
    assert.ok(total > 0, `${origem}: nenhum mod`);
  }
  // Na coluna "onde" de um mod de influência: o nome da influência (do pool), para saber qual Exalted o põe.
  const inf = d.linhas.find((l) => l.origem === 'influencia');
  assert.ok(inf.itens.some((n) => /Influência/.test(n)), JSON.stringify(inf.itens));
  // As origens de sempre continuam.
  for (const origem of ['afixo', 'implicito', 'unico', 'frasco']) assert.ok(d.resumo[origem], origem);
});

test('a lista de pools da aba é a das moedas: um pool que uma moeda usa entra; um sem caminho no jogo, não', () => {
  const moedas = readFileSync(new URL('../systems/itens-poe/moedas.mjs', import.meta.url), 'utf8');
  const usados = new Set([...moedas.matchAll(/doPool\(p, '([a-z_]+)'/g)].map((m) => m[1]));
  for (const bloco of [/const INFLUENCIAS = \{([^}]*)\}/, /const ELDRITCH = \{([^}]*)\}/]) {
    const corpo = moedas.match(bloco)?.[1] ?? '';
    // INFLUENCIAS: { Moeda: 'pool' }; ELDRITCH: { pool: 'nome' }
    for (const m of corpo.matchAll(/(\w+):\s*'([^']+)'/g)) usados.add(/^[a-z]+$/.test(m[1]) ? m[1] : m[2]);
  }
  assert.deepEqual([...usados].sort(), Object.keys(P.POOLS_DO_JOGO).sort());
});
