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

test('regras do PoE (dono, 07/10): vida/mana base 50/40 no nível 1, vida sem regeneração de base, mana 1,8%/s, penalidade de resistência por ato e supressão', { skip: SEM }, async () => {
  const R = await import('../systems/regras.mjs');
  assert.deepEqual(R.statsBase('sorcerer', 1), { maxHp: 50, maxMana: 40 });
  assert.deepEqual(R.statsBase('sorcerer', 10), { maxHp: 158, maxMana: 94 });
  const e = Object.assign(personagemDeTeste({ vocacao: 'sorcerer', level: 20 }), { classePoe: 'Witch' });
  e.maxHp = 500; e.maxMana = 200;
  let f = Ficha.combate(e);
  assert.equal(f.regenPoe.vidaPorSegundo, 0, 'sem regeneração de vida de base');
  assert.equal(Math.round(f.regenPoe.manaPorSegundo * 100) / 100, 3.6, '1,8% de 200');
  assert.equal(f.penalidadeDeResistencia, 0);
  assert.equal(f.protection.fire, 0);
  // Venceu o chefe do Ato 5: −30% em tudo (o Caos também), podendo ficar negativo.
  e.campanha = { facil: { bosses: [1, 2, 3, 4, 5] } };
  Ficha.invalidar(e);
  f = Ficha.combate(e);
  assert.equal(f.penalidadeDeResistencia, 30);
  assert.deepEqual(['fire', 'ice', 'energy', 'chaos'].map((el) => f.protection[el]), [-30, -30, -30, -30]);
  e.campanha.facil.bosses.push(6, 7, 8, 9, 10);
  Ficha.invalidar(e);
  assert.equal(Ficha.combate(e).protection.fire, -60, 'depois do Ato 10, −60%');
  // A regeneração do PoE com os mods: 2% da vida/s e +50% de velocidade de regeneração = 500 × 2% × 1,5 = 15/s.
  const vida = Ficha.regenDoPoe({ maxHp: 500, maxMana: 200 }, { life_regen_max_pct: 2, life_regen_pct: 50, mana_regen_pct: 100 });
  assert.equal(vida.vidaPorSegundo, 15);
  assert.equal(Math.round(vida.manaPorSegundo * 100) / 100, 7.2, '1,8% × 2');
  // A ficha mostra as cargas ativas / máximo e a penalidade.
  const fp = FichaPoe.montar(e, Ficha.combate(e));
  const cargas = fp.secoes.find((s) => s.id === 'cargas').linhas.map((l) => l.valor);
  assert.deepEqual(cargas, ['0 / 3', '0 / 3', '0 / 3']);
  assert.ok(fp.secoes.find((s) => s.id === 'defesa').linhas.some((l) => /Penalidade/.test(l.rotulo) && l.valor === '−60%'));
  assert.ok(fp.resistencias.find((r) => r.id === 'fire').fontes.some((x) => /Penalidade da campanha/.test(x.fonte) && x.valor === -60));
});

test('na cidade (fora da caçada), modo PoE: vida, mana, Escudo de Energia e frascos cheios', async () => {
  const S = await import('../websocket/sessao.mjs');
  const e = { maxHp: 76, hp: 64, maxMana: 54, mana: 10, es: 3, frascos: [] };
  S.encherNaCidade(e);
  assert.deepEqual([e.hp, e.mana, e.es], [76, 54, null]);
  const morto = { maxHp: 76, hp: 0, maxMana: 54, mana: 0, frascos: [] };
  S.encherNaCidade(morto);
  assert.equal(morto.hp, 0, 'morto não ressuscita por aqui (a morte cuida disso)');
});
