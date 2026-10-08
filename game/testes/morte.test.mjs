// A morte, as blessings e a promoção contra o ORIGINAL: a view `blessings` de
// dois personagens (Zotod, level 89; conta2, level 343 promovido) tem de sair
// IGUAL — preços, a conta da morte e o resumo. E a morte aplicada.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as Morte from '../systems/morte.mjs';
import * as Promocao from '../systems/promocao.mjs';
import * as R from '../systems/regras.mjs';
import { descerDeLevel } from '../systems/hunt/combate.mjs';
import * as Afixos from '../systems/afixos.mjs';
import { personagemDeTeste } from './apoio.mjs';
import { doClassico } from './apoio-migracao.mjs';

const ler = (p) => JSON.parse(readFileSync(new URL(`../../api-mapeada/${p}`, import.meta.url), 'utf8'));

function personagem(level, { promovido = false, gold = 0 } = {}) {
  const e = personagemDeTeste({ vocacao: 'knight', level });
  e.xp = R.expForLevel(level) + 1000;
  e.gold = gold;
  e.blessings = [];
  if (promovido) e.promovido = true;
  // Como ao entrar no jogo: a vida do STR (e os adds) já no máximo.
  Afixos.sincronizarMaximos(e);
  return e;
}

test('Zotod (level 89, sem promoção): a view de blessings igual à do original', { skip: doClassico("Blessings e penalidade de morte do Draevor (view do original)") }, () => {
  const original = ler('servidor/blessings.json');
  const nossa = Morte.vista(personagem(89, { gold: original.gold }));
  assert.deepEqual({ list: nossa.list, gold: nossa.gold, resumo: nossa.resumo }, original);
});

test('conta2 (level 343, promovido): 30% de desconto e teto de 80% de um level', { skip: doClassico("Blessings e penalidade de morte do Draevor (view do original)") }, () => {
  const original = ler('servidor/conta2/blessings.json');
  const nossa = Morte.vista(personagem(343, { promovido: true, gold: original.gold }));
  assert.deepEqual({ list: nossa.list, gold: nossa.gold, resumo: nossa.resumo }, original);
});

test('as 7 bênçãos com a promoção: sobram 14% da perda (o texto do cliente)', () => {
  const e = personagem(343, { promovido: true });
  e.blessings = Morte.BLESSINGS.map((b) => b.id);
  const c = Morte.conta(e);
  assert.equal(c.descontoPercent, 86);
  assert.equal(c.expPerdida, Math.round(c.teto * 0.14));
});

test('comprar: uma, as que faltam, e sem ouro não', () => {
  const e = personagem(89, { gold: 20000 });
  assert.ok(Morte.comprar(e, { id: 2 }).ok);
  assert.equal(e.gold, 20000 - 13800);
  assert.match(Morte.comprar(e, { id: 2 }).erro, /já tem/);
  assert.match(Morte.comprar(e, { all: true }).erro, /Faltam/);
  e.gold = 1e6;
  assert.ok(Morte.comprar(e, { all: true }).ok);
  assert.equal(e.blessings.length, 7);
  assert.equal(e.gold, 1e6 - (4 * 13800 + 2 * 27600));
});

test('morrer: tira a experiência (e o level), 20% do ouro carregado e queima as bênçãos', () => {
  const e = personagem(89, { gold: 1000 });
  e.bank = 5000;
  e.blessings = [2, 3];
  const antes = { xp: e.xp, maxHp: e.maxHp };
  const conta = Morte.conta(e);
  const morte = Morte.morrer(e, descerDeLevel);
  assert.equal(morte.lost, conta.expPerdida);
  assert.equal(morte.descontoPercent, 16);
  assert.equal(morte.blessings, 2);
  assert.equal(e.xp, antes.xp - conta.expPerdida);
  assert.equal(morte.goldLost, 200);
  assert.equal(e.gold, 800);
  assert.equal(e.bank, 5000, 'o banco não é tocado');
  assert.deepEqual(e.blessings, []);
  // Estava 1.000 acima do level 89: perder ~84% de um level cai para o 88.
  assert.equal(morte.levelPerdido, 1);
  assert.equal(e.level, 88);
  assert.ok(e.maxHp < antes.maxHp);
});

test('promoção: level 20, 20.000 gold, uma vez; acelera a regeneração', () => {
  const e = personagem(19, { gold: 50000 });
  assert.equal(Promocao.paraCliente(e).missing, 1);
  assert.match(Promocao.promover(e).erro, /level 20/);
  e.level = 20;
  assert.equal(Promocao.paraCliente(e).available, true);
  assert.ok(Promocao.promover(e).ok);
  assert.equal(e.gold, 30000);
  // Igual à captura do servidor original, menos a mana: a decisão do dono (29/09) é +50% de vida E de mana.
  assert.deepEqual(Promocao.paraCliente(e), { ...ler('captura-charms-0925/welcome-zoros.json').character.promotion, mana: 1.5 });
  assert.deepEqual(Promocao.fatorDeRegeneracao(e), { hp: 1.5, mana: 1.5 });
  assert.match(Promocao.promover(e).erro, /já foi/);
});
