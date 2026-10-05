// Incremento 4a: as 7 classes do PoE (só com ITENS_POE=1). A classe fica por cima da vocação: dá os atributos iniciais (For/Des/Int) e
// eles NÃO crescem com o level (como no PoE); quem não escolheu usa a padrão da vocação e escolhe uma vez.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const Classes = await import('../systems/itens-poe/classes.mjs');
const Atributos = await import('../systems/personagem/atributos.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');
const SEM = !existsSync(Catalogo.ARQUIVO) && 'catálogo do PoE não importado nesta máquina';

test('as 7 classes com os atributos iniciais do PoE', { skip: SEM }, () => {
  const l = Classes.paraCliente();
  assert.equal(l.length, 7);
  const por = Object.fromEntries(l.map((c) => [c.slug, c.atributos]));
  assert.deepEqual(por.Marauder, { str: 32, dex: 14, int: 14 });
  assert.deepEqual(por.Ranger, { str: 14, dex: 32, int: 14 });
  assert.deepEqual(por.Witch, { str: 14, dex: 14, int: 32 });
  assert.deepEqual(por.Scion, { str: 20, dex: 20, int: 20 });
  assert.equal(l.find((c) => c.slug === 'Duelist').ascendencias.length, 3);
});

test('sem escolha: a classe padrão da vocação; atributos da classe e SEM ganho por level', { skip: SEM }, () => {
  const k = personagemDeTeste({ vocacao: 'knight', level: 300 });
  assert.equal(Classes.classeDe(k).slug, 'Marauder');
  const a = Atributos.principais(k, {});
  assert.deepEqual([a.str, a.dex, a.int], [32, 14, 14], 'level 300 com os mesmos atributos do level 1');
  assert.deepEqual(Atributos.principais(k, { str: 10 }).str, 42, 'árvore/itens somam por cima');
  assert.equal(Classes.classeDe(personagemDeTeste({ vocacao: 'sorcerer', level: 50 })).slug, 'Witch');
});

test('escolher a classe: uma vez; inválida recusa', { skip: SEM }, () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 50 });
  assert.equal(Classes.escolher(e, 'Nada').ok, false);
  assert.equal(Classes.escolher(e, 'Witch').ok, true);
  assert.equal(Classes.classeDe(e).slug, 'Witch');
  assert.deepEqual(Atributos.principais(e, {}).int, 32, 'knight bruxa: os atributos são os da classe');
  const r = Classes.escolher(e, 'Ranger');
  assert.equal(r.ok, false);
  assert.match(r.erro, /já é Bruxa/);
});
