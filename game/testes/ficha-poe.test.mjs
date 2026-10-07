// A FICHA no estilo do PoE (dono, 07/10: "melhore a ficha do personagem ... com todos os atributos importantes e de onde vem"):
// as seções da tela de personagem do PoE e a ORIGEM de cada número — a soma das fontes fecha com o total.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = !existsSync(Catalogo.ARQUIVO) && 'catálogo do PoE não está nesta máquina';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const Ficha = await import('../systems/ficha.mjs');
const FichaPoe = await import('../systems/personagem/ficha-poe.mjs');
const Afixos = await import('../systems/afixos.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');
if (!SEM) (await import('../systems/itens-poe/jogo.mjs')).iniciar(ITEM_CATALOG);
const soma = (fontes) => fontes.filter((f) => !f.pct).reduce((n, f) => n + f.valor, 0);

test('a ficha do PoE: cabeçalho com classe e atributos, Vida/ES/Mana, as 4 resistências e as seções da tela do PoE', { skip: SEM }, () => {
  const e = Object.assign(personagemDeTeste({ vocacao: 'sorcerer', level: 20 }), { classePoe: 'Witch' });
  Afixos.sincronizarMaximos(e);
  const f = FichaPoe.montar(e, Ficha.combate(e));
  assert.equal(f.cabecalho.classe, 'Bruxa');
  assert.deepEqual(f.cabecalho.atributos.map((a) => a.id), ['str', 'dex', 'int']);
  assert.deepEqual(f.grandes.map((g) => g.id), ['vida', 'es', 'mana']);
  assert.deepEqual(f.resistencias.map((r) => r.nome), ['Fogo', 'Gelo', 'Raio', 'Caos']);
  assert.deepEqual(f.secoes.map((s) => s.titulo), ['Vida', 'Escudo de Energia', 'Mana', 'Ataque', 'Magia', 'Defesa', 'Cargas', 'Diversos']);
  // De onde vem: a vida fecha com a soma das fontes (nível + Força + equipamento + árvore + o resto).
  const vida = f.grandes[0];
  assert.equal(Math.round(soma(vida.fontes)), vida.valor);
  assert.ok(vida.fontes.some((x) => /Nível 20/.test(x.fonte)) && vida.fontes.some((x) => /Força/.test(x.fonte)));
  const mana = f.grandes[2];
  assert.equal(Math.round(soma(mana.fontes)), mana.valor);
  // A Inteligência vem da classe (Bruxa: 32).
  const int = f.cabecalho.atributos[2];
  assert.equal(int.valor, 32);
  assert.ok(int.fontes.some((x) => /Classe \(Bruxa\)/.test(x.fonte) && x.valor === 32));
});

test('a redução da Armadura segue a fórmula do PoE (A / (A + 5 × dano)), até 90%', () => {
  assert.equal(Math.round(FichaPoe.reducaoDaArmadura(500, 100) * 100), 50);
  assert.equal(Math.round(FichaPoe.reducaoDaArmadura(250, 100) * 100), 33);
  assert.equal(FichaPoe.reducaoDaArmadura(1e9, 1), 0.9);
});
