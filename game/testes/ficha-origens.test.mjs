// A ficha reformulada (dono, 02/10): as ORIGENS por categoria são as MESMAS parcelas da conta (somam o valor bruto = efetivo + excedente), a
// arma equipada e o XP exato das skills vêm do servidor, e a comparação marca o que passa do limite. Nenhuma fórmula nova.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Ficha from '../systems/ficha.mjs';
import * as Afixos from '../systems/afixos.mjs';
import * as Treino from '../systems/treino.mjs';
import * as Comparar from '../systems/itens/comparar.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import { personagemDeTeste } from './apoio.mjs';

const idDe = (nome) => Number(Object.values(ITEM_CATALOG).find((i) => i.name === nome).id);
const ANEL = idDe('might ring');
const soma = (partes) => (partes ?? []).reduce((n, p) => n + p.valor, 0);

function personagem(af, voc = 'sorcerer') {
  const e = personagemDeTeste({ vocacao: voc, level: 300 });
  e.equipment.weapon = { id: idDe('shimmer wand'), count: 1, raridade: 'raro', af: [{ id: 'elem_pen', nivel: 5, value: 12 }] };
  e.equipment.ring = { id: ANEL, count: 1, af };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  return e;
}

test('somaDeItens + os adds da árvore + o altar = a soma de sempre (refatoração sem mudar o resultado)', () => {
  const e = personagem([{ id: 'crit_chance', nivel: 5, value: 20 }]);
  assert.equal(Afixos.somaDeItens(e).crit_chance, 20);
  assert.equal(Afixos.soma(e).crit_chance, 20);
});

test('as origens do crítico somam o valor BRUTO (efetivo + excedente) e dizem de onde vem, por categoria', () => {
  const e = personagem([{ id: 'crit_chance', nivel: 5, value: 115 }]);
  const f = Ficha.combate(e);
  const bruto = (f.critChance + f.excedentes.critChance) * 100;
  assert.ok(Math.abs(soma(f.origens.critChance) - bruto) < 0.02, `${soma(f.origens.critChance)} vs ${bruto}`);
  assert.equal(f.critChance, 1, 'o efetivo para no limite');
  assert.ok(f.excedentes.critChance > 0.1);
  const fontes = f.origens.critChance.map((p) => p.fonte);
  assert.ok(fontes.includes('Base do personagem'));
  assert.ok(fontes.includes('Equipamento (afixos)'));
});

test('as origens de cada resistência somam proteção + excedente (o balão mostra o bruto, o limite e o efetivo)', () => {
  const e = personagem([{ id: 'fire_res', nivel: 5, value: 130 }, { id: 'ice_res', nivel: 5, value: 30 }]);
  const f = Ficha.combate(e);
  for (const el of ['fire', 'ice', 'earth', 'physical']) {
    const bruto = f.protection[el] + f.excedentes.protection[el];
    assert.ok(Math.abs(soma(f.origens[`protection.${el}`]) - bruto) < 0.02, el);
  }
  assert.equal(f.protection.fire, 100);
  assert.ok(f.excedentes.protection.fire >= 30);
  assert.equal(f.origens['protection.earth'], undefined, 'o que o personagem não tem não ganha origem');
});

test('as origens da penetração e do ataque duplo vêm dos afixos reais', () => {
  const e = personagem([{ id: 'double_attack', nivel: 5, value: 20 }, { id: 'phys_pen', nivel: 5, value: 15 }]);
  const f = Ficha.combate(e);
  assert.equal(soma(f.origens.ataqueDuplo), 20);
  assert.equal(soma(f.origens['penetracao.fisica']), 15);
  assert.equal(soma(f.origens['penetracao.elemental']), 12, 'o afixo da wand');
  assert.equal(f.penetracao.elemental, 12);
});

test('o multiplicador de crítico tem origens e não tem limite', () => {
  const e = personagem([{ id: 'crit_dmg', nivel: 5, value: 300 }]);
  const f = Ficha.combate(e);
  assert.ok(Math.abs(soma(f.origens.critMultiplier) - f.critMultiplier * 100) < 0.02);
  assert.ok(f.critMultiplier > 4);
});

test('a ficha traz a arma equipada: nome, level exigido e o Magic Attack da wand (com a raridade)', () => {
  const f = Ficha.combate(personagem([]));
  assert.equal(f.armaEquipada.nome, 'shimmer wand');
  assert.equal(f.armaEquipada.nivelRequerido, 40);
  assert.equal(f.armaEquipada.ehMagicAttack, true);
  assert.ok(f.armaEquipada.poder > 0);
  const nua = personagem([]);
  nua.equipment.weapon = null;
  Ficha.invalidar(nua);
  assert.equal(Ficha.combate(nua).armaEquipada, null);
});

test('as skills mandam o progresso exato (tentativas de agora e as que faltam), sem mudar o percentual', () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 50 });
  Treino.garantir(e);
  Treino.treinar(e, 'melee', 7);
  Treino.gastarMana(e, 12);
  const c = Treino.paraCliente(e);
  assert.equal(c.skills.melee.tries, 7);
  assert.ok(c.skills.melee.precisa > 7);
  assert.ok(Math.abs(c.skills.melee.percent - 7 / c.skills.melee.precisa) < 1e-12);
  assert.equal(c.magic.mana, 12);
  assert.ok(c.magic.precisa > 12);
  assert.ok(Math.abs(c.magic.percent - 12 / c.magic.precisa) < 1e-12);
});

test('a comparação marca a parte que passa do limite (não vale)', () => {
  const e = personagem([{ id: 'crit_chance', nivel: 5, value: 90 }]);
  // O anel novo põe o crítico acima de 100%: o efetivo sobe pouco e o excedente aparece como linha própria.
  const r = Comparar.comparar(e, { id: ANEL, af: [{ id: 'crit_chance', nivel: 5, value: 150 }] });
  assert.ok(r.ok);
  const linha = (chave) => r.todos.find((l) => l.chave === chave);
  assert.ok(linha('critChance'));
  assert.ok(linha('excedentes.critChance')?.para > 0, 'o excedente aparece, nomeado');
  assert.match(linha('excedentes.critChance').nome, /não vale/);
});
