// As BASES do catálogo do PoE têm id ÚNICO (`Classe/Slug`). O PoE tem bases DIFERENTES com o mesmo nome em inglês (as 3 Botas de Dois
// Tons, os 6 Talismãs das Aves Gêmeas, o Talismã do Lobo Grandioso de 2.1.0 e o do "Rito da Lua", a Aljava da Flecha Serrada antiga…) e a
// coleção do poedb repete o slug: o importador dava o mesmo id às duas, `gerar.acharBase` achava só a primeira e o único da outra nunca
// era gerado ("nenhum único com a base Talismã do Lobo Grandioso" para os Olhos do Lobo Grandioso). Agora a N-ésima ganha `_N`, como os
// ícones da própria coleção (tools/importar-poe-itens.mjs `slugsDistintos`), e cada uma fica com o ícone dela.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { importar, slugsDistintos } from '../../tools/importar-poe-itens.mjs';
import { gerarPeca, acharBase } from '../systems/itens-poe/gerar.mjs';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';
import { soNoOficial } from './apoio-migracao.mjs';

const SKIP = { skip: soNoOficial('o catálogo carregado é o do PoE') };
const rng = () => 0.5;
const gerarUnico = (cat, base, unico) => gerarPeca({ catalogo: cat, regras: Catalogo.REGRAS, base, raridade: 'unico', ilvl: 84, rng, unico });

function idsRepetidos(cat) {
  const vistos = new Set();
  const repetidos = [];
  for (const c of Object.values(cat.classes)) {
    for (const b of c.bases ?? []) {
      if (vistos.has(b.id)) repetidos.push(b.id);
      vistos.add(b.id);
    }
  }
  return repetidos;
}
/** Os únicos que NÃO geram pela base do nome deles (é assim que o drop, as moedas e os pináculos acham a base do único). */
function unicosQueNaoGeram(cat) {
  const erros = [];
  for (const c of Object.values(cat.classes)) {
    for (const u of c.unicos ?? []) {
      const base = c.bases.find((b) => b.nome === u.base);
      if (!base) continue;
      const g = gerarUnico(cat, base.id, u.slug);
      if (g.erro) erros.push(`${u.slug}: ${g.erro}`);
    }
  }
  return erros;
}

test('importador: o slug repetido ganha _N na ordem (a 1ª ocorrência fica igual) e nunca toma o slug de outra base', () => {
  const s = (lista) => slugsDistintos(lista.map((slug) => ({ slug }))).map((x) => x.slug);
  assert.deepEqual(s(['A', 'B', 'A', 'A']), ['A', 'B', 'A_2', 'A_3']);
  assert.deepEqual(s(['A', 'A_2', 'A']), ['A', 'A_2', 'A_3']);
  assert.deepEqual(s(['A', 'B']), ['A', 'B']);
});

test('importador: duas bases com o mesmo slug saem com ids distintos, cada uma com o seu ícone — e o único da segunda gera', () => {
  const raiz = mkdtempSync(join(tmpdir(), 'importar-poe-itens-'));
  try {
    const dir = join(raiz, 'Acessorios', 'Amulets');
    mkdirSync(dir, { recursive: true });
    const base = (nome, implicitos) => ({ slug: 'Greatwolf_Talisman', nome, requisitos: {}, atributos: {}, implicitos });
    writeFileSync(join(dir, 'atributos-bases.json'), JSON.stringify([base('Talismã do Lobo Grandioso', []), base('Talismã do Grande Lobo', ['Dano aumentado em 44% por Rito da Lua concluído'])]));
    writeFileSync(join(dir, 'bases.json'), JSON.stringify([{ slug: 'Greatwolf_Talisman', icone: 'icones/Greatwolf_Talisman.png' }, { slug: 'Greatwolf_Talisman', icone: 'icones/Greatwolf_Talisman_2.png' }]));
    writeFileSync(join(dir, 'modificadores-tiers.json'), JSON.stringify({ paginas: { Amulets: { normal: { prefixos: { grupos: [] }, sufixos: { grupos: [] } } } } }));
    writeFileSync(join(dir, 'atributos-unicos.json'), JSON.stringify([{ slug: 'Eyes_of_the_Greatwolf', nome: 'Olhos do Lobo Grandioso', base: 'Talismã do Grande Lobo', modificadores: [{ tipo: 'explicit', texto: 'Magnitudes dos Modificadores Implícitos são dobradas' }] }]));
    const cat = importar(raiz);
    assert.deepEqual(cat.classes.Amulets.bases.map((b) => [b.id, b.nome, b.icone]), [
      ['Amulets/Greatwolf_Talisman', 'Talismã do Lobo Grandioso', 'poe-itens/Acessorios/Amulets/icones/Greatwolf_Talisman.png'],
      ['Amulets/Greatwolf_Talisman_2', 'Talismã do Grande Lobo', 'poe-itens/Acessorios/Amulets/icones/Greatwolf_Talisman_2.png'],
    ]);
    assert.deepEqual(idsRepetidos(cat), []);
    const g = gerarUnico(cat, 'Amulets/Greatwolf_Talisman_2', 'Eyes_of_the_Greatwolf');
    assert.equal(g.erro, undefined);
    assert.equal(g.nome, 'Olhos do Lobo Grandioso');
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('o catálogo do repositório não repete id de base (o id é a classe + o slug) e todo único dele gera pela base do nome', () => {
  const cru = JSON.parse(readFileSync(Catalogo.ARQUIVO, 'utf8'));
  assert.deepEqual(idsRepetidos(cru), []);
  for (const [id, c] of Object.entries(cru.classes)) for (const b of c.bases) assert.equal(b.id, `${id}/${b.slug}`);
  assert.deepEqual(unicosQueNaoGeram(cru), []);
  // As variantes de mesmo nome são bases distintas, cada uma com o implícito e o ícone dela.
  const botas = cru.classes.Boots.bases.filter((b) => b.nome === 'Botas de Dois Tons');
  assert.deepEqual(botas.map((b) => b.id), ['Boots/Two-Toned_Boots', 'Boots/Two-Toned_Boots_2', 'Boots/Two-Toned_Boots_3']);
  assert.equal(new Set(botas.map((b) => b.icone)).size, 3);
  assert.equal(new Set(botas.map((b) => b.implicitos[0].texto)).size, 3);
  // (A coleção põe os Olhos do Lobo Grandioso no Talismã do "Rito da Lua": no catálogo cru, ele gera nele.)
  const olhos = cru.classes.Amulets.unicos.find((u) => u.slug === 'Eyes_of_the_Greatwolf');
  assert.equal(cru.classes.Amulets.bases.find((b) => b.nome === olhos.base)?.id, 'Amulets/Greatwolf_Talisman_2');
});

test('o catálogo do jogo (com os mapas e as correções do poedb) não repete id; os Olhos do Lobo Grandioso geram na base do poedb', SKIP, () => {
  const cat = Catalogo.catalogo();
  assert.deepEqual(idsRepetidos(cat), []);
  assert.deepEqual(unicosQueNaoGeram(cat), []);
  // O poedb dá o Talismã de 2.1.0 como `BaseType` dos Olhos (unicos-correcoes.json): o mesmo pedido que antes dava o erro agora gera.
  const g = gerarUnico(cat, 'Amulets/Greatwolf_Talisman', 'Eyes_of_the_Greatwolf');
  assert.equal(g.erro, undefined);
  assert.equal(g.nome, 'Olhos do Lobo Grandioso');
  // E o do "Rito da Lua" é outra base, com o implícito dela.
  const rito = acharBase(cat, 'Amulets/Greatwolf_Talisman_2')?.base;
  assert.equal(rito?.nome, 'Talismã do Grande Lobo');
  assert.match(rito.implicitos[0].texto, /Rito da Lua/);
  assert.equal(acharBase(cat, 'Amulets/Greatwolf_Talisman').base.nome, 'Talismã do Lobo Grandioso');
});
