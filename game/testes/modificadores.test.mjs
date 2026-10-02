// O motor único de modificadores (flat / increased / more, local e global, condição, validade, limite): as contas do prompt do dono.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcular, valorDe, simples, semFonte, vale } from '../systems/combate/modificadores.mjs';

const inc = (valor, fonte, extra = {}) => ({ tipo: 'increased', valor, fonte, ...extra });
const mais = (valor, fonte, extra = {}) => ({ tipo: 'more', valor, fonte, ...extra });
const plano = (valor, fonte, extra = {}) => ({ tipo: 'flat', valor, fonte, ...extra });

test('increased soma numa conta só: 1.000 de armadura com +20%, +30% e +50% dá 2.000', () => {
  assert.equal(valorDe(1000, [inc(20, 'Equipamento'), inc(30, 'Passivas'), inc(50, 'Buff')]), 2000);
});

test('more é independente: 1.000 × (1 + 100% aumentado) × 1,30 × 1,20 = 3.120 (e não 30% + 20% somados)', () => {
  assert.equal(valorDe(1000, [inc(100, 'Aumentos'), mais(30, 'Habilidade'), mais(20, 'Buff')]), 3120);
  assert.notEqual(valorDe(1000, [inc(100, 'a'), mais(50, 'somado errado')]), 3120);
});

test('less (more negativo) multiplica por fora e reduced (increased negativo) entra na soma', () => {
  assert.equal(valorDe(1000, [mais(-20, 'Less'), mais(-50, 'Less 2')]), 400);
  assert.equal(valorDe(1000, [inc(50, 'a'), inc(-20, 'Reduced')]), 1300);
  assert.equal(valorDe(1000, [inc(-300, 'muito reduced')], {}, { min: 0 }), 0, 'o limite mínimo segura o negativo');
});

test('flat entra antes dos aumentos: (base + planos) × (1 + aumentos)', () => {
  assert.equal(valorDe(1000, [plano(500, 'Equip'), plano(200, 'Atributos'), inc(30, 'Equip %')]), 2210);
});

test('local antes do global: o aumento local só vale na peça; o global vale em tudo, inclusive no plano global', () => {
  // Arma 100 + 20 local, +50% local → 180. Global: +30 plano e +10% → (180 + 30) × 1,1 = 231.
  const mods = [plano(20, 'arma', { escopo: 'local' }), inc(50, 'arma', { escopo: 'local' }), plano(30, 'anel'), inc(10, 'árvore')];
  assert.equal(valorDe(100, mods), 231);
  // O mesmo +50% como GLOBAL entra na soma dos aumentos (+60%) e o plano global não é multiplicado pelo local.
  const global = [plano(20, 'arma'), inc(50, 'arma'), plano(30, 'anel'), inc(10, 'árvore')];
  assert.equal(valorDe(100, global), (100 + 20 + 30) * 1.6);
  assert.ok(valorDe(100, mods) !== valorDe(100, global), 'local e global são contas diferentes');
});

test('more local multiplica só a peça, antes dos planos globais', () => {
  assert.equal(valorDe(100, [mais(100, 'arma', { escopo: 'local' }), plano(50, 'anel')]), 250);
  assert.equal(valorDe(100, [mais(100, 'arma'), plano(50, 'anel')]), 300);
});

test('condição, validade e alvo: o modificador que não vale não conta', () => {
  const cheio = inc(20, 'Enquanto cheio', { condicao: (c) => c.vidaCheia });
  assert.equal(valorDe(100, [cheio], { vidaCheia: true }), 120);
  assert.equal(valorDe(100, [cheio], { vidaCheia: false }), 100);
  const buff = inc(50, 'Buff', { ate: 1000 });
  assert.equal(valorDe(100, [buff], { agora: 999 }), 150);
  assert.equal(valorDe(100, [buff], { agora: 1000 }), 100, 'expirou');
  const proj = inc(40, 'Projétil', { alvo: 'projectile' });
  assert.equal(valorDe(100, [proj], { tags: ['projectile'] }), 140);
  assert.equal(valorDe(100, [proj], { tags: ['melee'] }), 100, 'habilidade incompatível');
  assert.equal(vale({ tipo: 'flat', valor: NaN }), false);
});

test('remover a fonte (peça tirada, buff acabado) devolve o valor sem ela, sem mexer na lista original', () => {
  const lista = [inc(20, 'espada'), inc(30, 'buff')];
  assert.equal(valorDe(1000, semFonte(lista, 'buff')), 1200);
  assert.equal(valorDe(1000, lista), 1500, 'a lista original segue igual');
});

test('limite e arredondamento: o excedente fica à parte e a conta mostra as partes', () => {
  const r = calcular(100, [inc(150, 'Equip'), mais(10, 'Skill')], {}, { max: 200 });
  assert.equal(r.valor, 200);
  assert.ok(Math.abs(r.bruto - 275) < 1e-9);
  assert.ok(Math.abs(r.excedente - 75) < 1e-9);
  assert.deepEqual(r.partes.map((p) => p.fonte), ['Base', 'Equip', 'Skill']);
  assert.equal(valorDe(10, [inc(33.333, 'a')], {}, { casas: 2 }), 13.33);
  assert.equal(valorDe(10, [inc(33.333, 'a')]), 13);
});

test('`simples` reproduz a conta antiga (base + fixos) × (1 + %): ficha e monstros dão o mesmo número de sempre', () => {
  for (const [base, fixos, pct] of [[1000, 200, 30], [0, 150, 0], [18, 0, -10], [250, 40, 125]]) {
    assert.equal(simples(base, { fixos, pct }).bruto, (base + fixos) * (1 + pct / 100));
  }
  assert.equal(simples(100, { pct: 100, mores: [30, 20] }).valor, 312);
});
