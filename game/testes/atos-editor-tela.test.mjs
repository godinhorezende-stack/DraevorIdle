import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { posicoesAutomaticas } from '../frontend/client/src/editor-atos.mjs';
import * as Legado from '../systems/atos-legado.mjs';
import * as M from '../systems/atos-modelo.mjs';

const distintas = (pos) => {
  const l = [...pos.values()];
  for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) if (Math.hypot(l[i].x - l[j].x, l[i].y - l[j].y) < 48) return false;
  return true;
};

test('T1. layout automático: os 4 atos legados cabem na tela sem nós sobrepostos e dentro da área', () => {
  for (const a of Legado.atosLegados()) {
    const pos = posicoesAutomaticas(a);
    assert.equal(pos.size, a.fases.length);
    assert.ok(distintas(pos), a.id);
    for (const p of pos.values()) assert.ok(p.x >= 30 && p.x <= 920 && p.y >= 20 && p.y <= 520, `${a.id} ${JSON.stringify(p)}`);
  }
});

test('T2. layout: bifurcação e convergência (o exemplo do dono) põem os caminhos A e B em linhas diferentes e fases isoladas ficam visíveis', () => {
  const fases = ['fase-1', 'fase-2', 'fase-3', 'fase-4', 'fase-5', 'fase-6', 'fase-7', 'fase-8'].map((id) => ({ id, nome: id, posicao: null }));
  const ato = M.normalizar({ inicio: 'fase-1', fases, conexoes: [['1', '2'], ['2', '3'], ['3', '4'], ['4', '5'], ['4', '6'], ['5', '7'], ['6', '7']].map(([d, p]) => ({ de: `fase-${d}`, para: `fase-${p}` })) });
  const pos = posicoesAutomaticas(ato);
  assert.notEqual(pos.get('fase-5').y, pos.get('fase-6').y);
  assert.equal(pos.get('fase-5').x, pos.get('fase-6').x, 'mesma coluna (mesmo passo desde o início)');
  assert.ok(pos.get('fase-7').x > pos.get('fase-5').x);
  assert.ok(pos.has('fase-8'), 'a fase isolada aparece no canvas para o dono ver o erro');
});

test('T3. layout respeita a posição gravada e não trava com ciclo', () => {
  const ato = M.normalizar({ inicio: 'a-a', fases: [{ id: 'a-a', nome: 'A', posicao: { x: 300, y: 200 } }, { id: 'b-b', nome: 'B' }], conexoes: [{ de: 'a-a', para: 'b-b' }, { de: 'b-b', para: 'a-a' }] });
  const pos = posicoesAutomaticas(ato);
  assert.deepEqual(pos.get('a-a'), { x: 300, y: 200 });
  assert.equal(pos.size, 2);
});

test('T4. a aba Atos está ligada ao editor de conteúdo e a tela só chama as rotas do servidor (a validação é do servidor)', () => {
  const ed = readFileSync(new URL('../frontend/client/src/editor-conteudo.mjs', import.meta.url), 'utf8');
  assert.match(ed, /criarEditorDeAtos/);
  assert.match(ed, /\['atos', 'Acts e campanhas'\]/);
  const tela = readFileSync(new URL('../frontend/client/src/editor-atos.mjs', import.meta.url), 'utf8');
  for (const r of ["'atos-editor'", "'atos-editor/validar'", 'biblioteca/lista', 'biblioteca/detalhe']) assert.ok(tela.includes(r), r);
  assert.doesNotMatch(tela, /ID_VALIDO|TIPOS_DE_FASE\b/, 'nenhuma regra duplicada na tela');
});
