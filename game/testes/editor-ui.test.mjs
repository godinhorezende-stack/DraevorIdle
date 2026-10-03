// Os componentes da Engine (/editor/conteudo) que têm regra própria: o editor JSON diz ONDE está o erro e nunca
// grava texto inválido; a tela não duplica validação do servidor; a navegação só lista abas que existem.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lerJson, linhaColuna } from '../frontend/client/src/editor-ui.mjs';

test('lerJson: JSON válido devolve o valor', () => {
  assert.deepEqual(lerJson('[{"tipo":"magia","min":1}]'), { ok: true, valor: [{ tipo: 'magia', min: 1 }] });
});

test('lerJson: erro com linha e coluna, sem repetir a posição na mensagem', () => {
  const r = lerJson('[\n  { "tipo": "magia",\n  }\n]');
  assert.equal(r.ok, false);
  assert.deepEqual(r.onde, { linha: 3, coluna: 3 });
  assert.doesNotMatch(r.erro, /position|line \d/);
  assert.ok(r.erro.length > 5);
});

test('linhaColuna conta a partir de 1', () => {
  assert.deepEqual(linhaColuna('ab\ncd', 0), { linha: 1, coluna: 1 });
  assert.deepEqual(linhaColuna('ab\ncd', 4), { linha: 2, coluna: 2 });
});

test('a navegação só tem itens com tela de verdade e mantém as rotas antigas', () => {
  const ed = readFileSync(new URL('../frontend/client/src/editor-conteudo.mjs', import.meta.url), 'utf8');
  const abas = [...ed.matchAll(/\['(\w+)', '[^']+'\]/g)].map((m) => m[1]);
  for (const a of ['geral', 'fase', 'mapa', 'bosses', 'biblioteca', 'atos']) assert.ok(abas.includes(a), a);
  const ids = [...ed.slice(ed.indexOf('const GRUPOS'), ed.indexOf('function desenharAbas')).matchAll(/id: '([\w-]+)'/g)].map((m) => m[1]);
  for (const id of ids) assert.ok(abas.includes(id) || id === 'mapas-antigo', `item de navegação sem tela: ${id}`);
  assert.match(ed, /href: '\/editor'/, 'o editor de mapas continua em /editor');
});

test('a tela não usa confirm/prompt do navegador (os modais seguem o tema e não travam a página)', () => {
  for (const arq of ['editor-conteudo.mjs', 'editor-atos.mjs']) {
    const src = readFileSync(new URL(`../frontend/client/src/${arq}`, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /[^.\w](confirm|prompt|alert)\(/, arq);
  }
});

test('o tema: [hidden] sempre esconde (um display do componente não pode anular o atributo)', () => {
  const css = readFileSync(new URL('../frontend/client/editor-tema.css', import.meta.url), 'utf8');
  assert.match(css, /\[hidden\]\s*\{\s*display:\s*none\s*!important/);
});

// ------------------------------------------------------------------ Etapa 4: Mobs e editor de Bosses únicos

import { abaDoErro } from '../frontend/client/src/editor-bosses.mjs';
import { ELEMENTOS } from '../frontend/client/src/editor-fichas.mjs';
import * as CatalogoDeBosses from '../systems/bosses-unicos/catalogo.mjs';

test('os erros REAIS do validador de bosses levam à aba certa do editor', () => {
  const base = { id: 'x-teste', nome: 'X', categoria: 'miniboss', base: 'troll', atributos: {}, comportamentos: [], fases: [], recompensas: { loot: [] } };
  const casos = [
    [{ ...base, comportamentos: [{ tipo: 'area-telegrafada', elemento: 'fire', min: 1, max: 2, raio: 1, avisoMs: 1 }] }, 'comportamentos'],
    [{ ...base, fases: [{ nome: 'F', ate: 150, comportamentos: [] }] }, 'fases'],
    [{ ...base, fases: [{ nome: 'F', ate: 50, comportamentos: [{ tipo: 'magia', elemento: 'xx', min: 1, max: 2 }] }] }, 'fases'],
    [{ ...base, recompensas: { loot: [{ id: 999999999, chance: 10 }] } }, 'recompensas'],
    [{ ...base, recompensas: { loot: [{ id: 3031, chance: 300 }] } }, 'recompensas'],
    [{ ...base, recompensas: { loot: [], primeiraVitoria: { gold: -1 } } }, 'recompensas'],
    [{ ...base, melee: { min: 9, max: 1 } }, 'combate'],
    [{ ...base, atributos: { vidaMult: -1 } }, 'atributos'],
    [{ ...base, base: 'nao-existe' }, 'identidade'],
  ];
  for (const [def, aba] of casos) {
    const erros = CatalogoDeBosses.validar(def);
    assert.ok(erros.length, `sem erro para ${aba}`);
    assert.equal(abaDoErro(erros[0]), aba, erros[0]);
  }
});

test('a ficha conhece todos os elementos que o editor oferece (nome e cor)', async () => {
  const { opcoes } = await import('../admin/conteudo.mjs');
  for (const e of opcoes().elementos) assert.ok(ELEMENTOS[e]?.nome && ELEMENTOS[e]?.cor, e);
});

test('Mobs e Bosses únicos estão na navegação (Entidades) e o editor de bosses não duplica regra do servidor', () => {
  const ed = readFileSync(new URL('../frontend/client/src/editor-conteudo.mjs', import.meta.url), 'utf8');
  assert.match(ed, /\['mobs', 'Mobs'\]/);
  assert.match(ed, /categoriaFixa: 'monstros', rota: 'mobs'/);
  const bosses = readFileSync(new URL('../frontend/client/src/editor-bosses.mjs', import.meta.url), 'utf8');
  assert.match(bosses, /'bosses\/validar'/, 'a validação é pedida ao servidor');
  assert.doesNotMatch(bosses, /avisoMs de 500|LIMITES\s*=|TIPOS_DE_COMPORTAMENTO/, 'os tetos e tipos são do catálogo, não da tela');
});
