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

// aval do dono 03/11: raio contínuo (revisão) — o título dizia que o círculo pegava os de trás dos colados; nesta montagem cada colado para o próprio projétil
test('no resolvedor (o voo de verdade): o leque simétrico acerta simétrico e, no círculo, cada colado para o próprio projétil (ninguém de trás leva)', () => {
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
  // o círculo de 4 (90°): o alvo a leste e um a 2 casas em cada direção, atrás de um colado — o projétil de oeste, o de norte e o de sul param no colado
  // da sua direção (sem perfurar); nenhum dos de trás leva, e o de trás do alvo também não (o principal parou nele). O "de trás" fiel está no teste das Facas Etéreas.
  {
    const alvo = bicho('a', 1, 0);
    const colados = [bicho('o1', -1, 0), bicho('n1', 0, -1), bicho('s1', 0, 1)];
    const longe = [bicho('l2', 2, 0), bicho('o2', -2, 0), bicho('n2', 0, -2), bicho('s2', 0, 2)];
    const vivos = [alvo, ...colados, ...longe];
    const r = Secundarios.resolver({ efeito: { alvosExtras: 3, emCirculo: true }, tags: TAGS, origem: O, alvo, atingidos: [alvo], vivos, alcance: 3, rng: () => 0.5, voo: true });
    const levam = [...new Set(r.golpes.map((g) => g.bicho.uid))].sort();
    // aval do dono 03/11: raio contínuo (revisão) — a lista exata (antes só conferia os colados e o l2)
    assert.deepEqual(levam, ['n1', 'o1', 's1'], 'só os colados; nenhum de trás (o2, n2, s2, l2)');
  }
});

// aval do dono 03/11: raio contínuo (revisão)
test('quem refaz o voo fora do resolvedor segue o mesmo raio do acerto (`casasDoEmitido`): o emitido guarda o ângulo exato', () => {
  const TAGS = ['projectile', 'hit'];
  const alvo = { uid: 'a', x: 1, y: 0, hp: 100 };
  const r = Secundarios.resolver({ efeito: { alvosExtras: 2 }, tags: TAGS, origem: O, alvo, atingidos: [alvo], vivos: [alvo], alcance: 7, rng: () => 0.5, voo: true });
  const errou = r.emitidos.filter((e) => e.tipo === 'projetil');
  assert.equal(errou.length, 2);
  for (const e of errou) {
    assert.ok(Number.isFinite(e.angulo), 'guarda o ângulo');
    assert.deepEqual(lista(Secundarios.casasDoEmitido(e)), raio((e.angulo * 180) / Math.PI, 7), 'o raio do ângulo exato, até o alcance');
  }
  // (o de +10° passa pela 3,1 — a casa de um Tornado ali; a reta até o fim arredondado, 7,1, não passa)
  const mais10 = errou.find((e) => e.angulo > 0);
  assert.deepEqual([mais10.para.x, mais10.para.y], [7, 1]);
  assert.ok(lista(Secundarios.casasDoEmitido(mais10)).includes('3,1'));
  assert.ok(!lista(Secundarios.casasDaReta(O, mais10.para, 7)).includes('3,1'), 'a reta antiga não passava');
  // o que acertou: o caminho para no bicho
  const b = { uid: 'b', x: 3, y: 1, hp: 100 };
  const r2 = Secundarios.resolver({ efeito: { alvosExtras: 2 }, tags: TAGS, origem: O, alvo, atingidos: [alvo], vivos: [alvo, b], alcance: 7, rng: () => 0.5, voo: true });
  const noB = r2.emitidos.find((e) => e.bicho === b);
  assert.ok(noB, 'o de +10° acerta o bicho na 3,1');
  assert.deepEqual(lista(Secundarios.casasDoEmitido(noB)), ['1,0', '2,0', '3,0', '3,1']);
});

// aval do dono 03/11: raio contínuo (revisão)
test('a explosão cinética do projétil que bate no terreno cai onde o raio bateu, não atrás da parede (o mesmo caminho do acerto e do terreno)', () => {
  const andavel = new Set();
  for (let x = -10; x <= 10; x++) for (let y = -10; y <= 10; y++) if (!(x === 3 && y === 1)) andavel.add(`${x},${y}`);
  const alvo = { uid: 'a', x: 1, y: 0, hp: 100 };
  const cinetica = { n: 0, pct: 60, raio: 0, raioSec: 0 };
  const r = Secundarios.resolver({ efeito: { alvosExtras: 2 }, tags: ['projectile', 'hit'], origem: O, alvo, atingidos: [alvo], vivos: [alvo], alcance: 7, rng: () => 0.5, voo: true, andavel, cinetica });
  const pontos = r.explosoes.filter((e) => e.cinetica).map((e) => `${e.x},${e.y}`);
  // (o de +10° bate na parede da 3,1 vindo da 3,0; o de −10° não tem parede e explode no fim, 7,−1)
  assert.ok(pontos.includes('3,0'), pontos.join(' '));
  assert.ok(!pontos.includes('7,1'), `não atrás da parede: ${pontos.join(' ')}`);
  assert.ok(pontos.includes('7,-1'), pontos.join(' '));
});

// aval do dono 03/11: raio contínuo (revisão)
test('as gemas de caminho curvo (o ziguezague, a espiral): o caminho de cada projétil a mais sai no ângulo exato dele, não na direção do fim arredondado', async () => {
  const GemasVoo = await import('../systems/itens-poe/projeteis-voo.mjs');
  // o resolvedor passa o ângulo exato do leque para `casasDoCaminho`
  const vistos = [];
  const alvo = { uid: 'a', x: 1, y: 0, hp: 100 };
  Secundarios.resolver({ efeito: { alvosExtras: 2 }, tags: ['projectile', 'hit'], origem: O, alvo, atingidos: [alvo], vivos: [alvo], alcance: 3, rng: () => 0.5, voo: true, casasDoCaminho: (de, fim, angulo) => { vistos.push(angulo); return []; } });
  assert.deepEqual(vistos.map((a) => Math.round((a * 180) / Math.PI)), [10, -10]);
  for (const perfil of [{ zigueZague: 3 }, { rotacoes: 2 }]) {
    const casas = (g, alcance) => lista(GemasVoo.casasDoCaminho(O, fimDoRaio(O, grau(g), alcance), { alcance, perfil, angulo: grau(g) })).join(' ');
    // com alcance 3, o +10° e o +20° têm o mesmo fim (3,1), mas caminhos diferentes
    assert.deepEqual(lista([fimDoRaio(O, grau(10), 3)]), lista([fimDoRaio(O, grau(20), 3)]));
    assert.notEqual(casas(10, 3), casas(20, 3), JSON.stringify(perfil));
    // e o caminho é o da direção exata: o mesmo de `caminho` com o ângulo
    const c = GemasVoo.caminho(O, null, { alcance: 7, perfil, angulo: grau(20) });
    const fim = GemasVoo.pontoEm(c, c.comprimento);
    assert.ok(Math.abs(Math.atan2(fim.y, fim.x) - grau(20)) < 0.1, `${JSON.stringify(perfil)}: ${fim.x},${fim.y}`);
  }
});
