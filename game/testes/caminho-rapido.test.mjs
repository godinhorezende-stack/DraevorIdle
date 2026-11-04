// (04/11, velocidade da caçada offline) A busca sem alocar a grade a cada vez (`hunt/caminho.mjs`: a fila de rascunho, as casas
// bloqueadas como marca numérica, a distância de rascunho do `proximoPassoAte`) dá EXATAMENTE o resultado da versão antiga — as
// distâncias, as casas achadas e o próximo passo —, inclusive com buscas intercaladas e chaves estranhas no `Set` de bloqueadas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOGO } from '../systems/dados.mjs';
import { bfsDistancias, bfsDistanciasAntiga, gradeDaHunt, VIZINHANCA_4, VIZINHANCA_8 } from '../systems/cacadas.mjs';
import { proximoPassoAte } from '../systems/hunt/caminho.mjs';
import { HUNT_DE_TESTE, huntDoPoe } from './apoio.mjs';

let semente = 424242;
const acaso = () => ((semente = (semente * 1103515245 + 12345) >>> 0) / 2 ** 32);
const MAPAS = [HUNT_DE_TESTE, huntDoPoe('werelions-1'), 'spike-8', 'winter-dream-court'];
const gradeDe = (id) => gradeDaHunt(CATALOGO.hunts.find((h) => h.id === id) ?? CATALOGO.bosses.find((b) => b.id === id) ?? { id });

/** O `proximoPassoAte` de antes, com a busca antiga (o `Map` de "x,y"). */
function proximoPassoAntigo(grade, origem, destino, ocupado = null, bloqueado = null) {
  const tentativas = [[VIZINHANCA_4, bloqueado], [VIZINHANCA_8, bloqueado], [VIZINHANCA_4, null], [VIZINHANCA_8, null]].filter(([, b], k) => b || k >= 2);
  for (const [vizinhos, bloq] of tentativas) {
    const dist = bfsDistanciasAntiga(grade, destino, Infinity, origem, vizinhos, bloq);
    let melhor = null;
    let melhorD = dist.get(`${origem.x},${origem.y}`) ?? Infinity;
    for (const [dx, dy] of vizinhos) {
      const viz = { x: origem.x + dx, y: origem.y + dy };
      const d = dist.get(`${viz.x},${viz.y}`);
      if (d == null || d >= melhorD || ocupado?.(viz)) continue;
      melhorD = d;
      melhor = viz;
    }
    if (melhor) return melhor;
  }
  return null;
}

const casaAoAcaso = (casas) => casas[Math.floor(acaso() * casas.length)];
/** Bloqueadas como o jogo monta ("x,y") e, às vezes, com chaves que a busca nunca escreve (andar, sinal, espaço, número) — que não bloqueiam. */
function bloqueadasAoAcaso(casas, n) {
  const s = new Set(Array.from({ length: n }, () => casaAoAcaso(casas).join(',')));
  if (acaso() < 0.5) {
    const [x, y] = casaAoAcaso(casas);
    for (const k of [`${x},${y},0`, `+${x},${y}`, ` ${x},${y}`, `${x}.0,${y}`, `${x}`, x * 1000 + y]) s.add(k);
  }
  return s;
}

test('o próximo passo é o mesmo da busca antiga (perto, longe, sem caminho, com bloqueadas)', () => {
  for (const id of MAPAS) {
    const grade = gradeDe(id);
    const casas = [...grade.andavel].map((k) => k.split(',').map(Number));
    for (let n = 0; n < 80; n++) {
      const [ox, oy] = casaAoAcaso(casas);
      // metade das vezes o destino é perto (o lacaio que segue você), metade em qualquer lugar
      const [dx, dy] = acaso() < 0.5 ? [ox + Math.floor(acaso() * 9) - 4, oy + Math.floor(acaso() * 9) - 4] : casaAoAcaso(casas);
      const bloq = acaso() < 0.7 ? bloqueadasAoAcaso(casas, 5 + Math.floor(acaso() * 40)) : null;
      const ocupado = bloq ? (c) => bloq.has(`${c.x},${c.y}`) : null;
      const origem = { x: ox, y: oy };
      const destino = { x: dx, y: dy };
      assert.deepEqual(proximoPassoAte(grade, origem, destino, ocupado, bloq), proximoPassoAntigo(grade, origem, destino, ocupado, bloq), `${id} ${ox},${oy} → ${dx},${dy}`);
    }
  }
});

test('buscas intercaladas: a distância guardada de uma não muda com as seguintes (o rascunho não vaza)', () => {
  const grade = gradeDe(HUNT_DE_TESTE);
  const casas = [...grade.andavel].map((k) => k.split(',').map(Number));
  const guardadas = [];
  for (let n = 0; n < 30; n++) {
    const o = casaAoAcaso(casas);
    const limite = acaso() < 0.5 ? Infinity : 1 + Math.floor(acaso() * 12);
    const bloq = acaso() < 0.5 ? bloqueadasAoAcaso(casas, 30) : null;
    const viz = acaso() < 0.5 ? VIZINHANCA_4 : VIZINHANCA_8;
    guardadas.push([bfsDistancias(grade, { x: o[0], y: o[1] }, limite, null, viz, bloq), bfsDistanciasAntiga(grade, { x: o[0], y: o[1] }, limite, null, viz, bloq)]);
    // uma busca de rascunho no meio (o passo do lacaio)
    proximoPassoAte(grade, { x: o[0], y: o[1] }, { x: casaAoAcaso(casas)[0], y: casaAoAcaso(casas)[1] }, null, bloq);
  }
  for (const [nova, velha] of guardadas) {
    let quantas = 0;
    for (const [x, y] of casas) {
      const d = nova.em(x, y);
      if (d !== undefined) quantas++;
      assert.equal(d, velha.get(`${x},${y}`));
    }
    assert.equal(quantas, velha.size);
  }
});

test('a origem fora da grade e o bloqueado que não é Set (só `has`) seguem como antes', () => {
  const grade = gradeDe(HUNT_DE_TESTE);
  const fora = bfsDistancias(grade, { x: -9999, y: -9999 });
  assert.equal(fora.em(-9999, -9999), undefined);
  const casas = [...grade.andavel].map((k) => k.split(',').map(Number));
  const [ox, oy] = casas[0];
  const proibidas = new Set(casas.slice(1, 40).map((c) => c.join(',')));
  const soHas = { has: (k) => proibidas.has(k) };
  const nova = bfsDistancias(grade, { x: ox, y: oy }, Infinity, null, VIZINHANCA_8, soHas);
  const velha = bfsDistanciasAntiga(grade, { x: ox, y: oy }, Infinity, null, VIZINHANCA_8, soHas);
  for (const [x, y] of casas) assert.equal(nova.em(x, y), velha.get(`${x},${y}`));
});
