// Incremento 4b: a árvore de passivas do PoE convertida para o formato da árvore do Draevor, com os efeitos traduzidos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { traduzirLinha, converterArvore, paraModelo } from '../systems/itens-poe/arvore.mjs';
import { validar } from '../systems/passivas/arvore.mjs';

test('as linhas da árvore viram efeitos da árvore do Draevor (atributo somado ou dano por tag); parênteses viram nota', () => {
  assert.deepEqual(paraModelo('Evasão aumentada em 14%'), { modelo: 'Evasão aumentada em {0}%', valores: [14] });
  assert.deepEqual(traduzirLinha('Vida máxima aumentada em 8%').efeitos, [{ add: 'hp_max', valor: 8 }]);
  assert.deepEqual(traduzirLinha('+10 de Força').efeitos, [{ add: 'str', valor: 10 }], 'as regras dos mods valem também');
  assert.deepEqual(traduzirLinha('Dano de Projétil aumentado em 12%').efeitos, [{ tag: 'projectile', dano: 12 }]);
  assert.deepEqual(traduzirLinha('Evasão e Armadura aumentadas em 6%').efeitos, [{ add: 'armour_pct', valor: 6 }, { add: 'evasion_pct', valor: 6 }]);
  const nota = traduzirLinha('(Recentemente se refere aos últimos 4 segundos)');
  assert.deepEqual([nota.estado, nota.efeitos.length], ['nota', 0]);
  const reg = traduzirLinha('Lacaios causam Dano aumentado em 10%');
  assert.equal(reg.estado, 'registrado');
  assert.equal(reg.efeitos.length, 0, 'sem regra: registrado, sem efeito (a chave automática não entra na árvore)');
  assert.ok(reg.registrados[0].stat.startsWith('poe.'));
});

test('converter: início por classe, custo 1, só o que um início alcança, ligações nos dois sentidos, keystone de texto', () => {
  const poe = {
    classes_iniciais: { Marauder: { no: 1 }, Witch: { no: 5 } },
    nos: [
      { id: 1, x: 0, y: 0, tipo: 'comum', nome: 'M', efeitos: [], vizinhos: [2] },
      { id: 2, x: 1, y: 0, tipo: 'comum', nome: 'Força', efeitos: ['+10 de Força'], vizinhos: [] },
      { id: 3, x: 2, y: 0, tipo: 'keystone', nome: 'Resoluto', efeitos: ['Não pode Evadir'], vizinhos: [2] },
      { id: 4, x: 9, y: 9, tipo: 'notavel', nome: 'Solto', efeitos: [], vizinhos: [] },
      { id: 5, x: 3, y: 0, tipo: 'comum', nome: 'W', efeitos: [], vizinhos: [3] },
    ],
    ligacoes: [],
  };
  const { arvore, relatorio } = converterArvore(poe);
  assert.deepEqual(arvore.inicios, { Marauder: '1', Witch: '5' });
  assert.equal(relatorio.foraDaArvore, 1, 'o nó solto fica de fora');
  const p = new Map(arvore.nos.map((n) => [n.id, n]));
  assert.equal(p.get('1').tipo, 'start');
  assert.deepEqual(p.get('2').efeitos, [{ add: 'str', valor: 10 }]);
  assert.equal(p.get('2').custo, 1);
  assert.deepEqual(p.get('3').keystone, { regra: 'texto', texto: 'Não pode Evadir' });
  assert.ok(p.get('2').conexoes.includes('1') && p.get('2').conexoes.includes('3'));
  assert.deepEqual(validar(arvore), []);
});

test('o arquivo gerado (gamedata/itens-poe/arvore-poe.json) é uma árvore válida do Draevor, com as 7 classes', () => {
  const a = JSON.parse(readFileSync(new URL('../gamedata/itens-poe/arvore-poe.json', import.meta.url), 'utf8'));
  assert.deepEqual(validar(a), []);
  assert.deepEqual(Object.keys(a.inicios).sort(), ['Duelist', 'Marauder', 'Ranger', 'Scion', 'Shadow', 'Templar', 'Witch']);
  assert.ok(a.nos.length > 2000);
  assert.ok(a.relatorio.estados.equivalente > 700);
});
