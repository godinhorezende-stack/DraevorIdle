// O índice de artes do cliente (`client/src/artes.mjs`) lista EXATAMENTE os PNGs
// que existem em `client/assets/icons/` e `client/assets/ui/`.
//
// É por ele que `artOrUiIcon`/`uiIcon` decidem, sem ir à rede, de que pasta
// pedir um ícone — ou que não há arte nenhuma (a auditoria do celular contou
// 30 pedidos 404 por sessão antes dele). Um índice velho esconde uma arte
// nova (o nome não aparece) ou volta a pedir uma apagada.
// Conserto: `node tools/indice-de-artes.mjs`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { conteudo, DESTINO } from '../../tools/indice-de-artes.mjs';

test('client/src/artes.mjs está em dia com as pastas de arte', () => {
  assert.equal(readFileSync(DESTINO, 'utf8'), conteudo(), 'rode: node tools/indice-de-artes.mjs');
});

test('os nomes que a interface pede sem arte ficam fora do índice (nada de 404)', async () => {
  const { ARTES } = await import('../frontend/client/src/artes.mjs');
  // coin-store só existe em ui/: o índice manda direto para lá.
  assert.equal(ARTES.icons.has('coin-store'), false);
  assert.equal(ARTES.ui.has('coin-store'), true);
  // Arte que ainda não foi desenhada: nenhuma das duas pastas.
  for (const nome of ['aba-body', 'aba-jogo', 'prey-defense', 'viagem-partida']) {
    assert.equal(ARTES.icons.has(nome) || ARTES.ui.has(nome), false, nome);
  }
});
