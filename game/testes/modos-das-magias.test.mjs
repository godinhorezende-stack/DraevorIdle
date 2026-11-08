// Os MODOS de execução da fileira de ataque (fase B da revisão, decisões do dono, 01/10):
// Prioridade (padrão), Limite N (1–3, padrão 2) e Rotação. Só a ORDEM muda — quem decide
// se a magia sai continua sendo `Acoes.disparar` (global, recargas, mana, alvo).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Acoes from '../systems/acoes.mjs';
import * as Combo from '../systems/combo.mjs';
import { personagemDeTeste, PERSONAGEM, comSkills, HUNT_DE_TESTE } from './apoio.mjs';
import { aAdaptar, soNoOficial } from './apoio-migracao.mjs';
import * as GemasPoe from '../systems/itens-poe/gemas-poe.mjs';

function montar(magias, settings = null) {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 600 });
  comSkills(e, magias.filter(Boolean));
  magias.forEach((id, i) => id && assert.ok(Acoes.definir(e, { slot: Combo.SLOTS_DO_COMBO[i], value: { id } }).ok, id));
  if (settings) assert.ok(Combo.definirModo(e, settings).ok);
  assert.ok(Cacadas.entrar(e, { huntId: HUNT_DE_TESTE, mode: 'auto' }).ok);
  e.hunt.assistencia = true;
  e.hunt.autoBarra = true;
  return e;
}

/*
 * (08/11, adaptado ao PoE — o dono: "Adaptar antes") Os modos na barra do PoE, com as GEMAS do PoE: os 8 slots são de 'skill' e a fileira de
 * ataque é a dos slots com gema de ataque, na ordem da barra (`Combo.slotsDoCombo`). Sem o global do Draevor: o que segura a próxima é o TEMPO
 * DE USO da gema que saiu (o grupo único do PoE) e a recarga própria dela. No clássico (o irmão `.classico`) as gemas do PoE não existem.
 * As quatro de ataque sem recarga (sempre disponíveis): o Pulso Congelante, a Bola de Fogo, a Faísca e o Disparo Congelante.
 */
const POE = (slug) => GemasPoe.doSlug(slug)?.acao;
const QUATRO_POE = ['Freezing_Pulse', 'Fireball', 'Spark', 'Frostbolt'];
function montarPoe(slugs, settings = null) {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 600 });
  const ids = slugs.map((s) => (s ? POE(s) : null));
  comSkills(e, ids.filter(Boolean));
  e.actions = Array(Acoes.SLOTS).fill(null);
  ids.forEach((id, i) => id && assert.ok(Acoes.definir(e, { slot: i, value: { id } }).ok, id));
  if (settings) assert.ok(Combo.definirModo(e, settings).ok);
  assert.ok(Cacadas.entrar(e, { huntId: HUNT_DE_TESTE, mode: 'auto' }).ok);
  e.hunt.assistencia = true;
  e.hunt.autoBarra = true;
  return e;
}
/** O tempo de uso da gema (o que segura a fileira depois dela no PoE) — o mesmo do servidor (`temposDaGemaPoe`). */
const usoDe = (e, id) => Acoes.temposDaGemaPoe(e, Acoes.POR_ID_PUBLICO(id)).uso;

function rodar(e, segundos) {
  const h = e.hunt;
  const ex = [];
  Combo.ouvirCombo((l) => l.resultado === 'EXECUTADA' && ex.push(l));
  let t = Date.now();
  h.ultimoTique = t;
  try {
    for (let i = 0; i < (segundos * 1000) / 250; i++) {
      t += 250;
      h.monstros = h.monstros.slice(0, 1);
      Object.assign(h.monstros[0], { hp: 1e12, maxHp: 1e12, x: h.pos.x + 1, y: h.pos.y });
      // (no PoE o bloqueio do golpe do bicho segura a próxima ação — a recuperação do bloqueio, sorteada: o bicho não bate, e a conta da
      // fileira não depende da sorte)
      if (GemasPoe.ligadas()) h.monstros[0].proximoGolpe = Infinity;
      h.alvo = h.monstros[0].uid;
      e.hp = e.maxHp;
      e.mana = e.maxMana;
      Cacadas.tique(e, PERSONAGEM, t);
    }
  } finally {
    Combo.ouvirCombo(null);
  }
  return ex;
}
const slots = (ex, n = ex.length) => ex.slice(0, n).map((x) => x.slot);

/** Em toda volta de W execuções seguidas: a de maior prioridade (`topo`) no máximo N vezes, cada outra no máximo 1. */
function conferirLimite(ex, w, n, topo) {
  for (let i = 0; i + w <= ex.length; i++) {
    const conta = {};
    for (const x of ex.slice(i, i + w)) conta[x.skill] = (conta[x.skill] ?? 0) + 1;
    for (const [id, c] of Object.entries(conta)) assert.ok(c <= (id === topo ? n : 1), `${id} saiu ${c}x numa volta de ${w} (limite ${id === topo ? n : 1})`);
  }
}

test('sem escolher nada, o modo é Prioridade: o slot de cima sai sempre que puder', { skip: soNoOficial('as gemas do PoE na barra do PoE') }, () => {
  const e = montarPoe(QUATRO_POE);
  assert.deepEqual(Combo.modoDe(e), { modo: 'prioridade', limite: 2 });
  assert.deepEqual([...new Set(slots(rodar(e, 30)))], [1]);
});

test('definirModo: só os três modos e limite de 1 a 3; trocar de modo zera a memória do anterior', { skip: soNoOficial('as gemas do PoE na barra do PoE') }, () => {
  const e = montarPoe(QUATRO_POE);
  assert.equal(Combo.definirModo(e, { modo: 'xpto' }).ok, false);
  assert.equal(Combo.definirModo(e, { modo: 'limite', limite: 4 }).ok, false);
  assert.equal(Combo.definirModo(e, { modo: 'limite', limite: 0 }).ok, false);
  assert.ok(Combo.definirModo(e, { modo: 'limite', limite: 3 }).ok);
  assert.deepEqual(Combo.modoDe(e), { modo: 'limite', limite: 3 });
  e.hunt.cursorDoCombo = 5;
  e.hunt.ultimasDoCombo = [POE('Freezing_Pulse')];
  assert.ok(Combo.definirModo(e, { modo: 'rotacao' }).ok);
  assert.equal(e.hunt.cursorDoCombo, undefined);
  assert.equal(e.hunt.ultimasDoCombo, undefined);
  assert.equal(Combo.modoDe(e).limite, 3, 'o limite escolhido fica guardado');
  // Valor estranho salvo (de um cliente antigo, por exemplo) vira o padrão.
  e.settings.modoDasMagias = 'turbo';
  e.settings.limiteDasMagias = 9;
  assert.deepEqual(Combo.modoDe(e), { modo: 'prioridade', limite: 2 });
});

test('Limite 1: cada magia uma vez por volta, e a volta começa sempre pelo slot 1', { skip: soNoOficial('as gemas do PoE na barra do PoE') }, () => {
  const ex = rodar(montarPoe(QUATRO_POE, { modo: 'limite', limite: 1 }), 40);
  assert.deepEqual(slots(ex, 8), [1, 2, 3, 4, 1, 2, 3, 4]);
  conferirLimite(ex, 4, 1, POE('Freezing_Pulse'));
});

test('Limite 2: o slot 1 sai até 2 vezes a cada 4, e as outras entram nas brechas', { skip: soNoOficial('as gemas do PoE na barra do PoE') }, () => {
  const ex = rodar(montarPoe(QUATRO_POE, { modo: 'limite', limite: 2 }), 60);
  // O exemplo aprovado pelo dono: "Fire, Fire, Ice, Death, Fire, Fire, Light, Ice...".
  assert.deepEqual(slots(ex, 12), [1, 1, 2, 3, 1, 1, 4, 2, 1, 1, 3, 4]);
  conferirLimite(ex, 4, 2, POE('Freezing_Pulse'));
  const s1 = ex.filter((x) => x.slot === 1).length;
  assert.ok(Math.abs(s1 / ex.length - 0.5) < 0.05, `slot 1 em ${s1}/${ex.length}`);
  for (const s of [2, 3, 4]) assert.ok(ex.some((x) => x.slot === s), `slot ${s} nunca saiu`);
  assert.equal(ex[0].slot, 1, 'começa pelo slot 1');
});

test('Limite 3: o slot 1 domina (3 de cada 4)', { skip: soNoOficial('as gemas do PoE na barra do PoE') }, () => {
  const ex = rodar(montarPoe(QUATRO_POE, { modo: 'limite', limite: 3 }), 60);
  assert.deepEqual(slots(ex, 8), [1, 1, 1, 2, 1, 1, 1, 3]);
  conferirLimite(ex, 4, 3, POE('Freezing_Pulse'));
  const s1 = ex.filter((x) => x.slot === 1).length;
  assert.ok(Math.abs(s1 / ex.length - 0.75) < 0.05, `slot 1 em ${s1}/${ex.length}`);
});

test('Limite: se nenhuma outra pode sair, a que bateu o limite sai mesmo assim (a janela não fica vazia)', { skip: soNoOficial('as gemas do PoE na barra do PoE') }, () => {
  // Só uma magia na barra: ela bate o limite 1 sempre — e sai em toda janela.
  // (no PoE a janela é o tempo de uso da gema: o Chicote Ardente e a Bomba Congelante usam os mesmos 0,5 s — as contagens se comparam)
  const sozinha = rodar(montarPoe(['Flame_Surge'], { modo: 'limite', limite: 1 }), 20);
  const prioridade = rodar(montarPoe(['Flame_Surge']), 20);
  assert.equal(sozinha.length, prioridade.length);
  // Slot 2 com recarga de 2,5 s (Bomba Congelante): enquanto ela recarrega, a do slot 1
  // sai de novo mesmo acima do limite — nenhuma janela perdida.
  const duas = rodar(montarPoe(['Flame_Surge', 'Frost_Bomb'], { modo: 'limite', limite: 1 }), 20);
  assert.equal(duas.length, prioridade.length, 'nenhuma janela perdida');
  assert.deepEqual(slots(duas, 4), [1, 2, 1, 1], 'o slot 1 repetiu com a outra em recarga');
});

test('Rotação: todas se revezam, pulando a que não pode sair', { skip: soNoOficial('as gemas do PoE na barra do PoE') }, () => {
  const ex = rodar(montarPoe(QUATRO_POE, { modo: 'rotacao' }), 40);
  assert.deepEqual(slots(ex, 8), [1, 2, 3, 4, 1, 2, 3, 4]);
  // Bomba Congelante (2,5 s) no slot 2: na volta em que está em recarga, a vez passa para o 3.
  const comLonga = rodar(montarPoe(['Freezing_Pulse', 'Frost_Bomb', 'Fireball'], { modo: 'rotacao' }), 40);
  const porSlot = [1, 2, 3].map((s) => comLonga.filter((x) => x.slot === s).length);
  assert.ok(porSlot.every((n) => n > 0), porSlot.join(' '));
  for (let i = 1; i < comLonga.length; i++) assert.notEqual(comLonga[i].slot, comLonga[i - 1].slot, 'na rotação, nunca a mesma duas vezes seguidas aqui');
});

test('em todos os modos: nunca duas magias no mesmo instante, nunca antes do global, recarga individual respeitada', { skip: soNoOficial('as gemas do PoE na barra do PoE') }, () => {
  // (no PoE, sem o global do Draevor: "nunca antes do tempo de uso da que saiu antes" — o que segura a fileira)
  for (const settings of [null, { modo: 'limite', limite: 1 }, { modo: 'limite', limite: 2 }, { modo: 'rotacao' }]) {
    const e = montarPoe(['Void_Sphere', 'Frost_Bomb', ...QUATRO_POE], settings);
    const ex = rodar(e, 60);
    const instantes = ex.map((x) => x.relogio);
    assert.equal(new Set(instantes).size, instantes.length, `${settings?.modo ?? 'prioridade'}: duas no mesmo instante`);
    for (let i = 1; i < ex.length; i++) assert.ok(ex[i].logico - ex[i - 1].logico >= usoDe(e, ex[i - 1].skill), `${settings?.modo ?? 'prioridade'}: abaixo do tempo de uso`);
    const ultimaDe = {};
    for (const x of ex) {
      const total = e.hunt.cooldowns[x.skill].total;
      if (ultimaDe[x.skill] != null) assert.ok(x.logico - ultimaDe[x.skill] >= total, `${x.skill} antes da recarga`);
      ultimaDe[x.skill] = x.logico;
    }
  }
});

test('Regras de Uso + Limite: a preferida vai na frente, mas o limite vale também para ela', { skip: aAdaptar("Os modos Prioridade/Limite/Rotação valem na barra do PoE (pedido do dono); o teste usa magias do Draevor") }, () => {
  const e = montar(['spell-buzz', 'spell-great-fire-wave', 'spell-energy-strike'], { modo: 'limite', limite: 1 });
  // "Sempre: preferir área" — a Great Fire Wave (slot 2) passa à frente do slot 1.
  e.regrasDeUso = [{ nome: 'área', ativa: true, quando: [], acao: 'preferir', tags: ['area', 'wave'] }];
  const ex = rodar(e, 40);
  assert.equal(ex[0].slot, 2, 'a preferida primeiro');
  conferirLimite(ex, 3, 1, 'spell-great-fire-wave');
});

test('o modo fica no personagem: sai e entra de novo na caçada com o mesmo modo', { skip: soNoOficial('as gemas do PoE na barra do PoE') }, () => {
  const e = montarPoe(QUATRO_POE, { modo: 'limite', limite: 1 });
  Cacadas.sair(e);
  assert.ok(Cacadas.entrar(e, { huntId: HUNT_DE_TESTE, mode: 'auto' }).ok);
  e.hunt.assistencia = true;
  e.hunt.autoBarra = true;
  assert.deepEqual(slots(rodar(e, 20), 4), [1, 2, 3, 4]);
});
