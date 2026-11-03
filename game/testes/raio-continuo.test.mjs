// (03/11, revisão do leque) O RAIO CONTÍNUO de cada projétil (`Secundarios.casasDoRaio`): as casas que o segmento do ângulo EXATO atravessa até o alcance
// (Chebyshev, como o voo), com o arredondamento simétrico (a meia casa vai para fora dos dois lados). Antes o projétil seguia a reta até o fim arredondado
// (`Math.round`): montagens simétricas saíam assimétricas e, com alcance curto, o leque de 10° fundia ângulos diferentes na mesma reta.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const Secundarios = await import('../systems/skills/golpes-secundarios.mjs');
const { casasDoRaio, fimDoRaio, arredondarSimetrico } = Secundarios;
const O = { x: 0, y: 0 };
const grau = (g) => (g * Math.PI) / 180;
const lista = (casas) => casas.map((c) => `${c.x},${c.y}`);
const raio = (g, alcance = 3, de = O) => lista(casasDoRaio(de, grau(g), alcance));

test('o arredondamento simétrico: a meia casa vai para longe do zero dos dois lados (o Math.round dava 1 e −0)', () => {
  assert.deepEqual([0.5, -0.5, 1.5, -1.5, 0.49, -0.49, 0].map(arredondarSimetrico), [1, -1, 2, -2, 0, 0, 0]);
  assert.ok(Object.is(arredondarSimetrico(-0.2), 0), 'sem −0');
});

test('simetria nos 4 quadrantes: o raio de −a, de 180° − a e de 180° + a é o espelho do de a; o de 90° − a troca os eixos', () => {
  for (let g = 0; g <= 90; g += 2.5) for (const alcance of [1, 2, 3, 5, 7]) {
    const base = casasDoRaio(O, grau(g), alcance);
    const espelho = (fx, fy) => lista(base.map((c) => ({ x: fx * c.x || 0, y: fy * c.y || 0 })));
    assert.deepEqual(raio(-g, alcance), espelho(1, -1), `−${g}° a ${alcance}`);
    assert.deepEqual(raio(180 - g, alcance), espelho(-1, 1), `${180 - g}° a ${alcance}`);
    assert.deepEqual(raio(180 + g, alcance), espelho(-1, -1), `${180 + g}° a ${alcance}`);
    assert.deepEqual(raio(90 - g, alcance), lista(base.map((c) => ({ x: c.y, y: c.x }))), `${90 - g}° a ${alcance}`);
    // (o fim do raio é a última casa dele, e fica no alcance em Chebyshev)
    const fim = fimDoRaio(O, grau(g), alcance);
    assert.deepEqual(lista([fim]), [raio(g, alcance).at(-1)], `o fim de ${g}° a ${alcance}`);
    assert.equal(Math.max(Math.abs(fim.x), Math.abs(fim.y)), alcance);
  }
});

test('os eixos e a diagonal: as casas do meio do caminho, sem pegar as vizinhas no canto exato', () => {
  assert.deepEqual(raio(0), ['1,0', '2,0', '3,0']);
  assert.deepEqual(raio(90), ['0,1', '0,2', '0,3']);
  assert.deepEqual(raio(180), ['-1,0', '-2,0', '-3,0']);
  assert.deepEqual(raio(-90), ['0,-1', '0,-2', '0,-3']);
  assert.deepEqual(raio(45), ['1,1', '2,2', '3,3']);
  assert.deepEqual(raio(-135), ['-1,-1', '-2,-2', '-3,-3']);
  // (a partir de outra casa: o mesmo raio, deslocado)
  assert.deepEqual(raio(45, 3, { x: 10, y: -4 }), ['11,-3', '12,-2', '13,-1']);
});

test('ângulos distintos do leque não se fundem com alcance 3 (o fim arredondado juntava o +10° e o +20° na reta até 3,1)', () => {
  const angulos = [0, 10, 20, 30, -10, -20, -30];
  const raios = angulos.map((g) => raio(g).join(' '));
  assert.equal(new Set(raios).size, angulos.length, raios.join(' | '));
  assert.deepEqual(raio(10), ['1,0', '2,0', '3,0', '3,1']);
  assert.deepEqual(raio(20), ['1,0', '1,1', '2,1', '3,1']);
  assert.deepEqual(raio(-10), ['1,0', '2,0', '3,0', '3,-1']);
  assert.deepEqual(raio(-20), ['1,0', '1,-1', '2,-1', '3,-1']);
  // (o de +10° fica na fila do eixo até a 3ª casa: é ele, e não um raio a 26,6°, que chega ao 2,0)
  assert.ok(raio(10).includes('2,0') && !raio(10).includes('2,1'));
});

test('no resolvedor (o voo de verdade): o leque simétrico acerta simétrico e o círculo pega os de trás dos colados, menos o de trás do alvo', () => {
  const TAGS = ['projectile', 'hit'];
  const bicho = (uid, x, y) => ({ uid, x, y, hp: 100 });
  // (o principal, no alvo, o chamador já deu) o alvo a leste, um atrás dele na fila e um ao lado (acima ou abaixo, espelhados): o de ±10° pega o da fila (o raio do ângulo exato fica nela até a 3ª
  // casa), não o do lado — igual nos dois espelhos (antes, o fim arredondado mandava o +10° para o 2,1 e o −10° para o 2,0)
  for (const lado of [1, -1]) {
    const alvo = bicho('a', 1, 0);
    const fila = bicho('f', 2, 0);
    const doLado = bicho('l', 2, lado);
    const r = Secundarios.resolver({ efeito: { alvosExtras: 2 }, tags: TAGS, origem: O, alvo, atingidos: [alvo], vivos: [alvo, fila, doLado], alcance: 3, rng: () => 0.5, voo: true });
    assert.deepEqual([...new Set(r.golpes.map((g) => g.bicho.uid))].sort(), ['f'], `o do lado em 2,${lado}`);
  }
  // o círculo de 4 (90°): o alvo a leste e um a 2 casas em cada direção, atrás de um colado — os de oeste, norte e sul levam todos; o de trás do alvo, não
  {
    const alvo = bicho('a', 1, 0);
    const colados = [bicho('o1', -1, 0), bicho('n1', 0, -1), bicho('s1', 0, 1)];
    const longe = [bicho('l2', 2, 0), bicho('o2', -2, 0), bicho('n2', 0, -2), bicho('s2', 0, 2)];
    const vivos = [alvo, ...colados, ...longe];
    const r = Secundarios.resolver({ efeito: { alvosExtras: 3, emCirculo: true }, tags: TAGS, origem: O, alvo, atingidos: [alvo], vivos, alcance: 3, rng: () => 0.5, voo: true });
    const levam = new Set(r.golpes.map((g) => g.bicho.uid));
    assert.ok(['o1', 'n1', 's1'].every((u) => levam.has(u)), [...levam].join(','));
    assert.ok(!levam.has('l2'), 'o de trás do alvo: o principal parou nele');
  }
});
