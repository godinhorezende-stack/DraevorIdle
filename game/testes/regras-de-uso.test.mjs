// As REGRAS DE USO AUTOMÁTICO por tag (systems/skills/regras-de-uso.mjs, etapa 5):
// "Se bichos ≥ 3 → preferir área", "Se boss → só alvo único", "Se mana baixa → não usar buff".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Acoes from '../systems/acoes.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Treino from '../systems/treino.mjs';
import * as Regras from '../systems/skills/regras-de-uso.mjs';
import { tiqueDoCombo, SLOTS_DO_COMBO } from '../systems/combo.mjs';
import { criarMonstro } from '../systems/hunt/monstros.mjs';
import { personagemDeTeste, PERSONAGEM, comSkills } from './apoio.mjs';

function montar() {
  const e = comSkills(personagemDeTeste({ vocacao: 'sorcerer', level: 300 }), ['spell-flame-strike', 'spell-great-fire-wave']);
  Treino.garantir(e);
  assert.ok(Cacadas.entrar(e, { huntId: 'troll-cave', mode: 'auto' }).ok);
  const h = e.hunt;
  delete h.instancia;
  h.respawns = [];
  h.monstros = [];
  e.maxHp = e.hp = 1e9;
  e.maxMana = e.mana = 1e9;
  e.actions = Array(Acoes.SLOTS).fill(null);
  // A barra: alvo único no 1º slot da fileira, área no 2º.
  assert.equal(Acoes.definir(e, { slot: SLOTS_DO_COMBO[0], value: { id: 'spell-flame-strike' } }).ok, true);
  assert.equal(Acoes.definir(e, { slot: SLOTS_DO_COMBO[1], value: { id: 'spell-great-fire-wave' } }).ok, true);
  return e;
}
const bichos = (e, n) => {
  const h = e.hunt;
  for (let i = 0; i < n; i++) h.monstros.push(Object.assign(criarMonstro({ key: 'troll', x: h.pos.x + (i % 3) - 1, y: h.pos.y - 1 - Math.floor(i / 3) }, null), { hp: 1e12, maxHp: 1e12 }));
  return h.monstros[0];
};
const qualSaiu = (e, alvo) => {
  const h = e.hunt;
  h.cooldowns = {};
  delete h.ultimoAtaqueEm;
  delete h.conjurando;
  h.cursorDoCombo = 0;
  const ev = tiqueDoCombo(e, h, PERSONAGEM, alvo);
  if (h.conjurando) return h.conjurando.id;
  return ev.find((x) => x.spell)?.spell ?? null;
};

test('sanear: só regras bem formadas (tag conhecida, ação válida, condições do formato do slot)', () => {
  const r = Regras.sanear([
    { nome: 'área com muitos', quando: [{ kind: 'perto', op: 'gte', value: 3 }], acao: 'preferir', tags: ['area', 'xyz'] },
    { quando: [], acao: 'apagar-tudo', tags: ['single'] },
    { tags: ['nada'] },
  ]);
  assert.equal(r.length, 2);
  assert.deepEqual(r[0].tags, ['area']);
  assert.equal(r[1].acao, 'preferir', 'ação inválida vira preferir');
  assert.equal(Regras.sanear('lixo').length, 0);
});

test('sem regra, a rotação é a de sempre (o 1º slot sai primeiro)', () => {
  const e = montar();
  const alvo = bichos(e, 4);
  assert.equal(qualSaiu(e, alvo), 'Flame Strike');
});

test('"Se bichos por perto ≥ 3 → preferir ÁREA": com 4 bichos, a área sai antes; com 1, a rotação normal', () => {
  const e = montar();
  e.regrasDeUso = Regras.sanear([{ quando: [{ kind: 'perto', op: 'gte', value: 3 }], acao: 'preferir', tags: ['area', 'wave'] }]);
  const alvo = bichos(e, 4);
  assert.equal(qualSaiu(e, alvo), 'Great Fire Wave');
  e.hunt.monstros.splice(1);
  assert.equal(qualSaiu(e, alvo), 'Flame Strike');
});

test('"Se boss → só ALVO ÚNICO": na sala de boss a área não sai', () => {
  const e = montar();
  e.regrasDeUso = Regras.sanear([{ quando: [{ kind: 'boss', op: 'sim' }], acao: 'somente', tags: ['single'] }]);
  const alvo = bichos(e, 4);
  e.hunt.isBoss = true;
  // Mesmo com o cursor apontando para a área, só a de alvo único é tentada.
  e.hunt.cursorDoCombo = 1;
  assert.equal(Regras.permitida('spell-great-fire-wave', Regras.ativas(e, e.hunt, alvo)), false);
  assert.equal(qualSaiu(e, alvo), 'Flame Strike');
});

test('"Se mana ≤ 20% → não usar BUFF": bloquear vale fora do ataque; cura nunca é barrada', () => {
  const e = montar();
  e.regrasDeUso = Regras.sanear([{ quando: [{ kind: 'stat', who: 'self', stat: 'mana', op: 'lte', value: 20, percent: true }], acao: 'bloquear', tags: ['buff'] }]);
  e.mana = e.maxMana * 0.1;
  const ativas = Regras.ativas(e, e.hunt, null);
  assert.equal(ativas.length, 1);
  assert.equal(Regras.permitida('spell-haste', ativas, { ataque: false }), false);
  assert.equal(Regras.permitida('spell-light-healing', ativas, { ataque: false }), true, 'cura passa');
  e.mana = e.maxMana;
  assert.equal(Regras.ativas(e, e.hunt, null).length, 0, 'com mana, a regra não vale');
});

test('regra desligada não vale', () => {
  const e = montar();
  e.regrasDeUso = Regras.sanear([{ ativa: false, quando: [], acao: 'bloquear', tags: ['fire'] }]);
  assert.equal(Regras.ativas(e, e.hunt, null).length, 0);
});
