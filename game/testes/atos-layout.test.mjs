// O "Organizar" do editor de atos (dono, 09/10: "o Ato 1 está organizado, os outros estão assim" — fases umas sobre as outras): o fluxo do
// início (embaixo à esquerda, a cidade ao lado) à fase do chefe (em cima à direita, o BOSS logo depois), sem nada sobreposto e sem nome
// encostando em nome. E os atos 2 a 10 do PoE gravados assim, cada um com a sua cidade (o Ato 1 é o montado à mão sobre a ilustração).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { organizarAto, LARGURA, ALTURA } from '../frontend/client/src/atos-layout.mjs';

const ato = (n) => JSON.parse(readFileSync(new URL(`../gamedata/atos/poe-ato-${n}.json`, import.meta.url), 'utf8'));
const NOME = 115; // a largura de um nome sob a fase
/** Os problemas de um conjunto de posições: perto demais, nomes se tocando, fora da área. */
function problemas(posicoes) {
  const p = [...posicoes];
  const saida = [];
  for (let i = 0; i < p.length; i++) {
    const [a, pa] = p[i];
    if (pa.x < 40 || pa.x > LARGURA - 40 || pa.y < 40 || pa.y > ALTURA - 50) saida.push(`${a} fora da área (${pa.x}, ${pa.y})`);
    for (let j = i + 1; j < p.length; j++) {
      const [b, pb] = p[j];
      if (Math.hypot(pa.x - pb.x, pa.y - pb.y) < 75) saida.push(`${a} e ${b} perto demais`);
      if (Math.abs(pa.x - pb.x) < NOME && Math.abs(pa.y - pb.y) < 30) saida.push(`os nomes de ${a} e ${b} se tocam`);
    }
  }
  return saida;
}

test('organizar: nos 10 atos do PoE, nada sobreposto, nenhum nome encostando, tudo na área; a fase do chefe na última coluna, em cima', () => {
  for (let n = 1; n <= 10; n++) {
    const a = ato(n);
    const { fases, cidade } = organizarAto({ ...a, cidade: a.cidade ?? { nome: 'Cidade', conexoes: [a.inicio] } });
    assert.equal(fases.size, a.fases.length, `Ato ${n}: todas as fases têm lugar`);
    assert.deepEqual(problemas(fases), [], `Ato ${n}`);
    const fim = fases.get(a.bossFinal.faseAnterior);
    assert.equal(fim.x, Math.max(...[...fases.values()].map((p) => p.x)), `Ato ${n}: a fase do chefe é a mais à direita`);
    assert.ok(fim.x + 110 <= LARGURA - 50, `Ato ${n}: cabe o BOSS à direita dela`);
    const inicio = fases.get(a.inicio);
    assert.ok(inicio.x < fim.x && inicio.y > fim.y, `Ato ${n}: do canto de baixo à esquerda ao de cima à direita`);
    assert.ok(cidade.x < inicio.x, `Ato ${n}: a cidade à esquerda do início`);
  }
});

test('organizar é estável: o mesmo ato dá as mesmas posições (o botão não embaralha a cada clique)', () => {
  const a = ato(2);
  const um = organizarAto(a);
  const dois = organizarAto({ ...a, fases: a.fases.map((f) => ({ ...f, posicao: { x: 1, y: 1 } })) });
  assert.deepEqual([...um.fases], [...dois.fases]);
});

test('os atos 2 a 10 gravados organizados, cada um com a sua cidade do PoE ligada ao início', () => {
  const cidades = { 2: 'Acampamento da Floresta', 3: 'Acampamento de Sarn', 4: 'Highgate', 5: 'Torre do Capataz', 6: 'Vigília de Lioneye', 7: 'Acampamento da Ponte', 8: 'Acampamento de Sarn', 9: 'Highgate', 10: 'Docas de Oriath' };
  for (let n = 2; n <= 10; n++) {
    const a = ato(n);
    assert.deepEqual(problemas(a.fases.map((f) => [f.id, f.posicao])), [], `Ato ${n}`);
    assert.equal(a.cidade?.nome, cidades[n], `Ato ${n}: a cidade`);
    assert.deepEqual(a.cidade.conexoes, [a.inicio]);
    assert.ok(a.cidade.posicao && a.cidade.posicao.x >= 70, `Ato ${n}: a cidade posicionada (o nome não passa da borda)`);
  }
});
