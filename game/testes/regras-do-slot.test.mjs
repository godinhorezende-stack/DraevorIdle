// TODAS as regras do "Configurar ação" (o slot da barra), uma por uma — relato de
// jogador (30/09): "tem várias regras para aplicar nas magias, de mín e máx,
// condições etc." Cada campo que a tela oferece tem que valer no servidor:
//   ligado/desligado · mana mínima (%) · mínimo e máximo de criaturas ·
//   condições (Vida/Mana sua ou do alvo, % ou número; Criatura; Bichos por perto; Boss) ·
//   curar quem (eu / o mais ferido / um nome) e "com a vida em até %" ·
//   desafio (quando chamar, quantos bichos em cima, "no máximo a cada N s") ·
//   distâncias do familiar · "tirar o escudo quando" · "só tirar se o utamo vita já puder voltar".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Acoes from '../systems/acoes.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Treino from '../systems/treino.mjs';
import { criarMonstro } from '../systems/hunt/monstros.mjs';
import { personagemDeTeste, PERSONAGEM, comSkills, HUNT_DE_TESTE } from './apoio.mjs';
import { aAdaptar, doClassico } from './apoio-migracao.mjs';

function montar(vocacao, skills) {
  const e = comSkills(personagemDeTeste({ vocacao, level: 300 }), skills);
  Treino.garantir(e);
  assert.ok(Cacadas.entrar(e, { huntId: HUNT_DE_TESTE, mode: 'auto' }).ok);
  const h = e.hunt;
  delete h.instancia;
  h.respawns = [];
  h.monstros = [];
  e.maxHp = e.hp = 10_000;
  e.maxMana = e.mana = 10_000;
  e.actions = Array(Acoes.SLOTS).fill(null);
  return e;
}
const bicho = (e, dx, dy, extra = {}) => {
  const m = Object.assign(criarMonstro({ key: 'troll', x: e.hunt.pos.x + dx, y: e.hunt.pos.y + dy }, null), { hp: 1e9, maxHp: 1e9 }, extra);
  e.hunt.monstros.push(m);
  return m;
};
// O slot onde a skill já está ou o primeiro livre do papel dela.
function slotDo(e, id) {
  const ja = e.actions.findIndex((a) => a?.id === id);
  if (ja >= 0) return ja;
  const papel = [...Acoes.catalogo(e).spells, ...Acoes.catalogo(e).runes].find((x) => x.id === id).papeis[0];
  return Acoes.PAPEL_DO_SLOT.findIndex((p, i) => p === papel && !e.actions[i]);
}
function por(e, id, extra = {}) {
  const slot = slotDo(e, id);
  const r = Acoes.definir(e, { slot, value: { id, ...extra } });
  assert.equal(r.ok, true, r.erro);
  return slot;
}
function tentar(e, slot, alvo = null) {
  const h = e.hunt;
  h.cooldowns = {};
  delete h.ultimoAtaqueEm;
  delete h.conjurando;
  return Acoes.disparar(e, h, PERSONAGEM, slot, alvo);
}
const FLAME = 'spell-flame-strike';
const WAVE = 'spell-great-fire-wave';

// ---------- o que o slot GUARDA ----------

test('definir guarda todos os campos da tela (e limpa os fora da faixa)', { skip: aAdaptar("Regras do slot (condições, mana mínima, mínimo/máximo de criaturas, Vida/Mana, \"Não usar quando\", motivo na tela) valem na barra do PoE; o teste põe magia do Draevor em slot do Draevor (\"Slot inválido.\")") }, () => {
  const e = montar('druid', ['spell-heal-friend', 'spell-summon-druid-familiar']);
  const s = por(e, 'spell-heal-friend', { curarQuem: 'nome', curarNome: '  Fulano ', curarAte: 150, minMana: 30, maxTargets: 4, lixo: 1 });
  const a = e.actions[s];
  assert.equal(a.curarQuem, 'nome');
  assert.equal(a.curarNome, 'Fulano');
  assert.equal(a.curarAte, 100, 'teto de 100%');
  assert.equal(a.minMana, 30);
  assert.equal(a.maxTargets, 4);
  assert.equal(a.lixo, undefined, 'campo desconhecido não entra');
  const f = por(e, 'spell-summon-druid-familiar', { summonPerto: 5, summonAlcance: 2 });
  assert.equal(e.actions[f].summonPerto, 5);
  assert.equal(e.actions[f].summonAlcance, 2);
});

test('condições gravadas são higienizadas: tipo desconhecido sai, número em texto vira número', { skip: aAdaptar("Regras do slot (condições, mana mínima, mínimo/máximo de criaturas, Vida/Mana, \"Não usar quando\", motivo na tela) valem na barra do PoE; o teste põe magia do Draevor em slot do Draevor (\"Slot inválido.\")") }, () => {
  const e = montar('sorcerer', [FLAME]);
  const s = por(e, FLAME, {
    conditions: [{ kind: 'stat', who: 'self', stat: 'hp', op: 'lte', value: '40', percent: true }, { kind: 'xpto' }, { kind: 'perto', op: 'gte', value: 99 }, 'lixo'],
  });
  const c = e.actions[s].conditions;
  assert.equal(c.length, 2);
  assert.equal(c[0].value, 40);
  assert.equal(c[1].value, 25, 'bichos por perto tem teto 25');
});

// ---------- ligado / mana mínima ----------

test('slot desligado não sai', { skip: aAdaptar("Regras do slot (condições, mana mínima, mínimo/máximo de criaturas, Vida/Mana, \"Não usar quando\", motivo na tela) valem na barra do PoE; o teste põe magia do Draevor em slot do Draevor (\"Slot inválido.\")") }, () => {
  const e = montar('sorcerer', [FLAME]);
  const m = bicho(e, 2, 0);
  const s = por(e, FLAME, { enabled: false });
  assert.equal(tentar(e, s, m).motivo, 'DESLIGADA');
});

test('mana mínima (%): abaixo dela a magia não sai; acima sai', { skip: aAdaptar("Regras do slot (condições, mana mínima, mínimo/máximo de criaturas, Vida/Mana, \"Não usar quando\", motivo na tela) valem na barra do PoE; o teste põe magia do Draevor em slot do Draevor (\"Slot inválido.\")") }, () => {
  const e = montar('sorcerer', [FLAME]);
  const m = bicho(e, 2, 0);
  const s = por(e, FLAME, { minMana: 50 });
  e.mana = 4000;
  assert.equal(tentar(e, s, m).ok, false);
  e.mana = 6000;
  assert.equal(tentar(e, s, m).ok, true);
});

// ---------- mínimo e máximo de criaturas ----------

test('mínimo de criaturas na magia de ALVO ÚNICO: conta quem está a até 4 sqm', { skip: aAdaptar("Regras do slot (condições, mana mínima, mínimo/máximo de criaturas, Vida/Mana, \"Não usar quando\", motivo na tela) valem na barra do PoE; o teste põe magia do Draevor em slot do Draevor (\"Slot inválido.\")") }, () => {
  const e = montar('sorcerer', [FLAME]);
  const m = bicho(e, 2, 0);
  const s = por(e, FLAME, { minTargets: 3 });
  assert.equal(tentar(e, s, m).ok, false, 'só 1 bicho');
  bicho(e, 3, 0);
  bicho(e, 0, 3);
  { const r = tentar(e, s, m); assert.equal(r.ok, true, '3 bichos: ' + r.motivo); }
  bicho(e, 7, 7);
  e.hunt.monstros.splice(1, 2);
  assert.equal(tentar(e, s, m).ok, false, 'o de longe não conta');
});

test('máximo de criaturas: com mais que o teto a magia não sai (0 = sem teto)', { skip: aAdaptar("Regras do slot (condições, mana mínima, mínimo/máximo de criaturas, Vida/Mana, \"Não usar quando\", motivo na tela) valem na barra do PoE; o teste põe magia do Draevor em slot do Draevor (\"Slot inválido.\")") }, () => {
  const e = montar('sorcerer', [FLAME, WAVE]);
  const m = bicho(e, 1, 0);
  bicho(e, 2, 0);
  bicho(e, 3, 0);
  const s = por(e, FLAME, { maxTargets: 2 });
  assert.equal(tentar(e, s, m).ok, false, 'alvo único: 3 por perto > 2');
  por(e, FLAME, { maxTargets: 0 });
  assert.equal(tentar(e, s, m).ok, true, 'zero = sem teto');
  const w = por(e, WAVE, { maxTargets: 1 });
  assert.equal(tentar(e, w, m).ok, false, 'área: pega 3 > 1');
  por(e, WAVE, { maxTargets: 3 });
  assert.equal(tentar(e, w, m).ok, true);
  por(e, WAVE, { minTargets: 4 });
  assert.equal(tentar(e, w, m).ok, false, 'área: pega 3 < mínimo 4');
});

// ---------- condições ----------

test('condição Vida/Mana: sua ou do alvo, em % ou em número, ≤ e ≥', { skip: aAdaptar("Regras do slot (condições, mana mínima, mínimo/máximo de criaturas, Vida/Mana, \"Não usar quando\", motivo na tela) valem na barra do PoE; o teste põe magia do Draevor em slot do Draevor (\"Slot inválido.\")") }, () => {
  const e = montar('sorcerer', [FLAME]);
  const m = bicho(e, 2, 0);
  const cond = (c) => Acoes.condicoesDoSlotBatem({ conditions: [c] }, e, m, e.hunt);
  e.hp = 3000;
  assert.equal(cond({ kind: 'stat', who: 'self', stat: 'hp', op: 'lte', value: 30, percent: true }), true);
  assert.equal(cond({ kind: 'stat', who: 'self', stat: 'hp', op: 'gte', value: 31, percent: true }), false);
  assert.equal(cond({ kind: 'stat', who: 'self', stat: 'hp', op: 'lte', value: 2999, percent: false }), false);
  e.mana = 500;
  assert.equal(cond({ kind: 'stat', who: 'self', stat: 'mana', op: 'lte', value: 500, percent: false }), true);
  m.hp = m.maxHp / 4;
  assert.equal(cond({ kind: 'stat', who: 'target', stat: 'hp', op: 'lte', value: 25, percent: true }), true);
  assert.equal(cond({ kind: 'stat', who: 'target', stat: 'hp', op: 'gte', value: 50, percent: true }), false);
  assert.equal(Acoes.condicoesDoSlotBatem({ conditions: [{ kind: 'stat', who: 'target', stat: 'hp', op: 'lte', value: 100, percent: true }] }, e, null, e.hunt), false, 'sem alvo não bate');
  // A condição travada no slot segura o disparo de verdade.
  const s = por(e, FLAME, { conditions: [{ kind: 'stat', who: 'target', stat: 'hp', op: 'gte', value: 50, percent: true }] });
  assert.equal(tentar(e, s, m).motivo, 'CONDICAO');
});

test('condição Criatura (é uma de / não é nenhuma de), Bichos por perto e Boss', () => {
  const e = montar('sorcerer', [FLAME]);
  const m = bicho(e, 2, 0);
  const cond = (c) => Acoes.condicoesDoSlotBatem({ conditions: [c] }, e, m, e.hunt);
  assert.equal(cond({ kind: 'nome', op: 'igual', names: [m.name] }), true);
  assert.equal(cond({ kind: 'nome', op: 'diferente', names: [m.name] }), false);
  assert.equal(cond({ kind: 'nome', op: 'igual', names: [m.name.toUpperCase()] }), true, 'sem diferença de maiúscula');
  assert.equal(cond({ kind: 'perto', op: 'gte', value: 2 }), false);
  bicho(e, 3, 3);
  assert.equal(cond({ kind: 'perto', op: 'gte', value: 2 }), true);
  assert.equal(cond({ kind: 'perto', op: 'lte', value: 1 }), false);
  assert.equal(cond({ kind: 'boss', op: 'sim' }), false);
  assert.equal(cond({ kind: 'boss', op: 'nao' }), true);
  e.hunt.isBoss = true;
  assert.equal(cond({ kind: 'boss', op: 'sim' }), true);
});

test('cura com condição do ALVO: o bicho mirado conta (não fica sempre falso)', { skip: aAdaptar("Regras do slot (condições, mana mínima, mínimo/máximo de criaturas, Vida/Mana, \"Não usar quando\", motivo na tela) valem na barra do PoE; o teste põe magia do Draevor em slot do Draevor (\"Slot inválido.\")") }, () => {
  const e = montar('sorcerer', ['spell-light-healing']);
  const m = bicho(e, 2, 0);
  e.hunt.alvo = m.uid;
  e.hp = 5000;
  const s = por(e, 'spell-light-healing', { conditions: [{ kind: 'nome', op: 'igual', names: [m.name] }] });
  assert.equal(tentar(e, s, m).ok, true);
});

// ---------- curar quem ----------

function comAliado(e, nome, hp) {
  const outro = { name: nome, level: e.level, hp, maxHp: 10_000, mana: 100, maxMana: 100, hunt: { pos: { x: e.hunt.pos.x + 1, y: e.hunt.pos.y } } };
  Object.defineProperty(e.hunt, 'partilha', { value: { membros: [{ estado: e, nome: 'Eu' }, { estado: outro, nome }] }, enumerable: false, configurable: true, writable: true });
  return outro;
}

test('curar amigo — "Eu mesmo": cura quem lança', { skip: doClassico("Magias/papéis do Draevor (utamo/exana vita, cura de aliado, Chivalrous Challenge); não existem no PoE") }, () => {
  const e = montar('druid', ['spell-heal-friend']);
  bicho(e, 3, 0);
  const s = por(e, 'spell-heal-friend', { curarQuem: 'eu' });
  e.hp = 100;
  const r = tentar(e, s);
  assert.equal(r.ok, true, r.erro);
  assert.ok(e.hp > 100);
});

test('curar amigo — "o mais ferido": cura o aliado da caçada, e só abaixo do "até %"', { skip: doClassico("Magias/papéis do Draevor (utamo/exana vita, cura de aliado, Chivalrous Challenge); não existem no PoE") }, () => {
  const e = montar('druid', ['spell-heal-friend']);
  bicho(e, 3, 0);
  const amigo = comAliado(e, 'Fulano', 9_000);
  const s = por(e, 'spell-heal-friend', { curarQuem: 'ferido', curarAte: 60 });
  assert.equal(tentar(e, s).ok, false, 'ninguém a 60% ou menos');
  amigo.hp = 3000;
  const r = tentar(e, s);
  assert.equal(r.ok, true, r.erro);
  assert.ok(amigo.hp > 3000, 'curou o amigo');
  assert.equal(e.hp, 10_000);
});

test('curar amigo — "pelo nome": só essa pessoa; fora da caçada, não sai', { skip: doClassico("Magias/papéis do Draevor (utamo/exana vita, cura de aliado, Chivalrous Challenge); não existem no PoE") }, () => {
  const e = montar('druid', ['spell-heal-friend']);
  bicho(e, 3, 0);
  const amigo = comAliado(e, 'Fulano', 3000);
  e.hp = 1000;
  const s = por(e, 'spell-heal-friend', { curarQuem: 'nome', curarNome: 'fulano', curarAte: 100 });
  assert.equal(tentar(e, s).ok, true);
  assert.ok(amigo.hp > 3000);
  assert.equal(e.hp, 1000, 'não curou quem lança');
  por(e, 'spell-heal-friend', { curarQuem: 'nome', curarNome: 'Ciclano' });
  assert.equal(tentar(e, s).ok, false);
});

// ---------- desafio ----------

test('desafio — "quando alguém da party estiver apanhando": conta os bichos colados NELE', { skip: doClassico("Magias/papéis do Draevor (utamo/exana vita, cura de aliado, Chivalrous Challenge); não existem no PoE") }, () => {
  const e = montar('knight', ['spell-challenge']);
  const amigo = comAliado(e, 'Mago', 10_000);
  amigo.hunt.pos = { x: e.hunt.pos.x + 3, y: e.hunt.pos.y };
  bicho(e, 1, 1);
  const s = por(e, 'spell-challenge', { desafiarQuem: 'qualquer', desafiarMinimo: 2 });
  assert.equal(tentar(e, s).ok, false, 'ninguém no mago');
  bicho(e, 4, 0);
  bicho(e, 4, 1);
  assert.equal(tentar(e, s).ok, true, '2 bichos no mago');
  por(e, 'spell-challenge', { desafiarQuem: 'nome', desafiarNome: 'Outro', desafiarMinimo: 1 });
  assert.equal(tentar(e, s).ok, false, 'o nome não está apanhando');
});

test('desafio — "no máximo uma vez a cada N s"', { skip: doClassico("Magias/papéis do Draevor (utamo/exana vita, cura de aliado, Chivalrous Challenge); não existem no PoE") }, () => {
  const e = montar('knight', ['spell-challenge']);
  bicho(e, 1, 0);
  const s = por(e, 'spell-challenge', { desafiarCada: 10 });
  const h = e.hunt;
  h.clock = 100_000;
  assert.equal(tentar(e, s).ok, true);
  delete h.buffs;
  h.clock += 5_000;
  assert.equal(tentar(e, s).ok, false, 'só 5 s depois');
  h.clock += 5_000;
  assert.equal(tentar(e, s).ok, true, '10 s depois');
});

// ---------- escudo ----------

test('utamo vita com "tirar o escudo quando mana ≤ 25%": o tique tira o escudo e não relança', { skip: doClassico("Magias/papéis do Draevor (utamo/exana vita, cura de aliado, Chivalrous Challenge); não existem no PoE") }, () => {
  const e = montar('sorcerer', ['spell-magic-shield', 'spell-cancel-magic-shield']);
  bicho(e, 2, 0);
  const s = por(e, 'spell-magic-shield', { tirarQuando: [{ kind: 'stat', who: 'self', stat: 'mana', op: 'lte', value: 25, percent: true }] });
  assert.equal(tentar(e, s).ok, true);
  assert.ok(Acoes.temBuff(e.hunt, 'shield'));
  e.mana = 2000;
  const ev = Acoes.tirarEscudoSePreciso(e, e.hunt, PERSONAGEM, null);
  assert.ok(ev.length, 'tirou');
  assert.equal(Acoes.temBuff(e.hunt, 'shield'), false);
  assert.equal(tentar(e, s).ok, false, 'com a mana baixa não relança');
});

test('exana vita com "só se o utamo vita já puder voltar"', { skip: doClassico("Magias/papéis do Draevor (utamo/exana vita, cura de aliado, Chivalrous Challenge); não existem no PoE") }, () => {
  const e = montar('sorcerer', ['spell-magic-shield', 'spell-cancel-magic-shield']);
  bicho(e, 2, 0);
  const utamo = por(e, 'spell-magic-shield');
  const exana = por(e, 'spell-cancel-magic-shield', { soComUtamoPronto: true });
  const h = e.hunt;
  h.clock = 50_000;
  h.cooldowns = {};
  assert.equal(Acoes.disparar(e, h, PERSONAGEM, utamo, null).ok, true);
  delete h['grupo:grupo:support'];
  for (const k of Object.keys(h.cooldowns)) if (k.startsWith('grupo:')) delete h.cooldowns[k];
  assert.equal(Acoes.disparar(e, h, PERSONAGEM, exana, null).ok, false, 'utamo recarregando');
  h.cooldowns = {};
  assert.equal(Acoes.disparar(e, h, PERSONAGEM, exana, null).ok, true);
});

// ---------- todas as combinações de Vida/Mana e o resto da tela ----------

test('Vida/Mana: as 16 combinações (você/alvo × vida/mana × ≤/≥ × %/número)', () => {
  const e = montar('sorcerer', [FLAME]);
  const m = bicho(e, 2, 0, { hp: 400, maxHp: 1000, mana: 300, maxMana: 1000 });
  e.hp = 4000; // 40%
  e.mana = 3000; // 30%
  const atual = { self: { hp: [4000, 40], mana: [3000, 30] }, target: { hp: [400, 40], mana: [300, 30] } };
  for (const who of ['self', 'target'])
    for (const stat of ['hp', 'mana'])
      for (const percent of [true, false]) {
        const [n, pct] = atual[who][stat];
        if (who === 'target' && stat === 'mana') continue; // bicho real não tem mana: teste abaixo
        const v = percent ? pct : n;
        for (const [op, abaixo, igual, acima] of [['lte', false, true, true], ['gte', true, true, false]]) {
          const bate = (value) => Acoes.condicoesDoSlotBatem({ conditions: [{ kind: 'stat', who, stat, op, value, percent }] }, e, m, e.hunt);
          const nome = `${who} ${stat} ${op} ${percent ? '%' : 'nº'}`;
          assert.equal(bate(v - 1), abaixo, `${nome} com valor abaixo`);
          assert.equal(bate(v), igual, `${nome} no valor`);
          assert.equal(bate(v + 1), acima, `${nome} com valor acima`);
        }
      }
});

test('várias condições: TODAS precisam bater', () => {
  const e = montar('sorcerer', [FLAME]);
  const m = bicho(e, 2, 0);
  const c = [{ kind: 'boss', op: 'nao' }, { kind: 'perto', op: 'gte', value: 1 }, { kind: 'nome', op: 'igual', names: [m.name] }];
  assert.equal(Acoes.condicoesDoSlotBatem({ conditions: c }, e, m, e.hunt), true);
  e.hunt.isBoss = true;
  assert.equal(Acoes.condicoesDoSlotBatem({ conditions: c }, e, m, e.hunt), false);
});

test('o resto da tela: prioridade (trocar), tecla, limpar o slot, conjuntos salvos', { skip: aAdaptar("Regras do slot (condições, mana mínima, mínimo/máximo de criaturas, Vida/Mana, \"Não usar quando\", motivo na tela) valem na barra do PoE; o teste põe magia do Draevor em slot do Draevor (\"Slot inválido.\")") }, () => {
  const e = montar('sorcerer', [FLAME, WAVE]);
  const a = por(e, FLAME, { minMana: 20 });
  const b = por(e, WAVE);
  assert.equal(Acoes.trocarTecla(e, { slot: a, key: 'F1' }).ok, true);
  assert.equal(e.hotkeys[a], 'f1');
  assert.equal(Acoes.trocar(e, { from: a, to: b }).ok, true);
  assert.equal(e.actions[b].id, FLAME);
  assert.equal(e.actions[b].minMana, 20, 'a configuração vai junto');
  assert.equal(e.hotkeys[b], 'f1', 'a tecla vai junto');
  assert.equal(Acoes.salvarPreset(e, { name: 'caça' }).ok, true);
  assert.equal(Acoes.definir(e, { slot: b, value: null }).ok, true);
  assert.equal(e.actions[b], null);
  assert.equal(Acoes.aplicarPreset(e, { name: 'caça' }).ok, true);
  assert.equal(e.actions[b].minMana, 20, 'o conjunto devolve a configuração');
});

test('Alvo · Mana: bicho não tem mana, então a condição não bate (nem "≤")', () => {
  const e = montar('sorcerer', [FLAME]);
  const m = bicho(e, 2, 0);
  for (const op of ['lte', 'gte']) assert.equal(Acoes.condicoesDoSlotBatem({ conditions: [{ kind: 'stat', who: 'target', stat: 'mana', op, value: 50, percent: true }] }, e, m, e.hunt), false);
});

// ---------- "Não usar quando", comparadores novos e o motivo na tela ----------

test('"Não usar quando": a condição ao contrário — "Não usar quando Você · Mana ≤ 20%"', { skip: aAdaptar("Regras do slot (condições, mana mínima, mínimo/máximo de criaturas, Vida/Mana, \"Não usar quando\", motivo na tela) valem na barra do PoE; o teste põe magia do Draevor em slot do Draevor (\"Slot inválido.\")") }, () => {
  const e = montar('sorcerer', [FLAME]);
  const m = bicho(e, 2, 0);
  const s = por(e, FLAME, { conditions: [{ nao: true, kind: 'stat', who: 'self', stat: 'mana', op: 'lte', value: 20, percent: true }] });
  assert.equal(e.actions[s].conditions[0].nao, true, 'guardado');
  e.mana = 1500;
  assert.equal(tentar(e, s, m).motivo, 'CONDICAO', 'mana 15%: não usa');
  e.mana = 5000;
  assert.equal(tentar(e, s, m).ok, true, 'mana 50%: usa');
  // Vale para qualquer tipo: "Não usar quando Criatura é uma de troll".
  const c = { nao: true, kind: 'nome', op: 'igual', names: [m.name] };
  assert.equal(Acoes.condicoesDoSlotBatem({ conditions: [c] }, e, m, e.hunt), false);
});

test('comparadores: menor que, igual a, maior que e ENTRE (vida/mana e bichos por perto)', () => {
  const e = montar('sorcerer', [FLAME]);
  const m = bicho(e, 2, 0);
  e.hp = 5000; // 50%
  const vida = (op, value, value2) => Acoes.condicoesDoSlotBatem({ conditions: [Acoes.sanearCondicao({ kind: 'stat', who: 'self', stat: 'hp', op, value, value2, percent: true })] }, e, m, e.hunt);
  assert.equal(vida('lt', 50), false);
  assert.equal(vida('lt', 51), true);
  assert.equal(vida('eq', 50), true);
  assert.equal(vida('eq', 49), false);
  assert.equal(vida('gt', 50), false);
  assert.equal(vida('gt', 49), true);
  assert.equal(vida('entre', 30, 70), true);
  assert.equal(vida('entre', 70, 30), true, 'em qualquer ordem');
  assert.equal(vida('entre', 51, 70), false);
  e.hp = 5004; // 50,04% conta como 50%
  assert.equal(vida('eq', 50), true);
  bicho(e, 3, 0);
  bicho(e, 0, 3);
  const perto = (op, value, value2) => Acoes.condicoesDoSlotBatem({ conditions: [Acoes.sanearCondicao({ kind: 'perto', op, value, value2 })] }, e, m, e.hunt);
  assert.equal(perto('eq', 3), true);
  assert.equal(perto('gt', 3), false);
  assert.equal(perto('lt', 4), true);
  assert.equal(perto('entre', 2, 4), true);
  assert.equal(perto('entre', 4, 9), false);
  assert.equal(Acoes.sanearCondicao({ kind: 'stat', op: 'xyz', value: 1 }).op, 'lte', 'comparador inválido vira o padrão');
  assert.equal(Acoes.sanearCondicao({ kind: 'stat', op: 'lte', value: 1, value2: 9 }).value2, undefined, 'value2 só no "entre"');
});

test('o motivo de o slot não sair vai para a tela (qual condição), e some quando ele sai', { skip: aAdaptar("Regras do slot (condições, mana mínima, mínimo/máximo de criaturas, Vida/Mana, \"Não usar quando\", motivo na tela) valem na barra do PoE; o teste põe magia do Draevor em slot do Draevor (\"Slot inválido.\")") }, () => {
  const e = montar('sorcerer', [FLAME]);
  const m = bicho(e, 2, 0);
  const s = por(e, FLAME, { conditions: [{ kind: 'boss', op: 'nao' }, { kind: 'stat', who: 'target', stat: 'hp', op: 'lte', value: 30, percent: true }] });
  e.hunt.alvo = m.uid;
  tentar(e, s, m);
  let p = Acoes.paradosParaCliente(e.hunt)[s];
  assert.equal(p.motivo, 'CONDICAO');
  assert.match(p.texto, /condição 2/);
  assert.deepEqual(Acoes.condicoesParaCliente(e, e.hunt, m)[s].conditions, [true, false], 'o ✔/✖ de cada uma');
  por(e, FLAME, { minMana: 90, conditions: [] });
  e.mana = 1000;
  tentar(e, s, m);
  assert.equal(Acoes.paradosParaCliente(e.hunt)[s].motivo, 'MANA_MINIMA');
  e.mana = e.maxMana;
  assert.equal(tentar(e, s, m).ok, true);
  assert.equal(Acoes.paradosParaCliente(e.hunt)[s], undefined, 'saiu: o motivo some');
  // Recarga não é "parado" (o leque do slot já mostra).
  const h = e.hunt;
  Acoes.disparar(e, h, PERSONAGEM, s, m);
  assert.equal(Acoes.paradosParaCliente(h)[s], undefined);
});
