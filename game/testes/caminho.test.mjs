// A busca de caminho numa grade de números (fase 3) dá EXATAMENTE as mesmas
// distâncias que a versão antiga com "x,y" em texto — em mapas reais, com
// limite de profundidade, alvo, e casas ocupadas por bichos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOGO } from '../systems/dados.mjs';
import { bfsDistancias, bfsDistanciasAntiga, gradeDaHunt, VIZINHANCA_4, VIZINHANCA_8 } from '../systems/cacadas.mjs';
import { HUNT_DE_TESTE, huntDoPoe } from './apoio.mjs';

let semente = 12345;
const acaso = () => ((semente = (semente * 1103515245 + 12345) >>> 0) / 2 ** 32);

test('mesmas distâncias da versão antiga em 5 mapas, 60 buscas cada', () => {
  for (const id of [HUNT_DE_TESTE, huntDoPoe('werelions-1'), 'spike-8', 'winter-dream-court', 'magma-bubble']) {
    const grade = gradeDaHunt(CATALOGO.hunts.find((h) => h.id === id) ?? CATALOGO.bosses.find((b) => b.id === id) ?? { id });
    const casas = [...grade.andavel].map((k) => k.split(',').map(Number));
    for (let n = 0; n < 60; n++) {
      const [ox, oy] = casas[Math.floor(acaso() * casas.length)];
      const [ax, ay] = casas[Math.floor(acaso() * casas.length)];
      const limite = acaso() < 0.5 ? Infinity : 3 + Math.floor(acaso() * 15);
      const alvo = acaso() < 0.5 ? { x: ax, y: ay } : null;
      const vizinhos = acaso() < 0.5 ? VIZINHANCA_4 : VIZINHANCA_8;
      const bloqueado = acaso() < 0.5 ? new Set(Array.from({ length: 30 }, () => casas[Math.floor(acaso() * casas.length)].join(','))) : null;
      const velha = bfsDistanciasAntiga(grade, { x: ox, y: oy }, limite, alvo, vizinhos, bloqueado);
      const nova = bfsDistancias(grade, { x: ox, y: oy }, limite, alvo, vizinhos, bloqueado);
      for (const [chave, d] of velha) assert.equal(nova.get(chave), d, `${id} ${chave}`);
      let quantas = 0;
      for (const [x, y] of casas) if (nova.em(x, y) !== undefined) quantas++;
      assert.equal(quantas, velha.size, `${id}: a nova achou casas a mais`);
    }
  }
});
