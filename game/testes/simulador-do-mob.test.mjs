// O SIMULADOR do lado do monstro, o detalhamento do editor e os ícones de efeito no jogador (etapa 5, dono 02/10).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Sim from '../systems/combate/simulador-mob.mjs';
import * as Mobs from '../systems/mobs/atributos.mjs';
import * as Dot from '../systems/combate/dot.mjs';
import * as Controle from '../systems/combate/controle.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Ficha from '../systems/ficha.mjs';
import * as Afixos from '../systems/afixos.mjs';
import { atributosDoMob } from '../admin/mapas.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import { personagemDeTeste } from './apoio.mjs';

const personagem = (vocacao = 'knight', level = 100, af = []) => {
  const e = personagemDeTeste({ vocacao, level });
  e.maxHp = e.maxHp ?? e.hp;
  if (af.length) {
    const ANEL = Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'might ring').id);
    e.equipment.ring = { id: ANEL, count: 1, af };
    Afixos.sincronizarMaximos(e);
    Ficha.invalidar(e);
  }
  return e;
};

test('a simulação é determinística (mesma entrada, mesmo resultado) e traz tempo para matar, dano recebido, defesas e chance de morte', () => {
  const e = personagem();
  const a = Sim.simularLuta(e, { mob: { key: 'troll' }, level: 100, lutas: 100, semente: 7 });
  const b = Sim.simularLuta(e, { mob: { key: 'troll' }, level: 100, lutas: 100, semente: 7 });
  assert.deepEqual(a, b);
  assert.ok(a.ok);
  assert.ok(a.jogador.dpsNoMob > 0 && a.jogador.segundosParaMatar > 0);
  assert.ok(a.mobNoJogador.dps >= 0 && a.chanceDeMorte >= 0 && a.chanceDeMorte <= 1);
  for (const d of ['esquiva', 'bloqueio', 'armadura', 'protecao', 'gemas']) assert.ok(d in a.defesas, d);
  assert.equal(Sim.simularLuta(e, { mob: { key: 'nao-existe' } }).ok, false);
  assert.match(a.aviso, /sem poções/);
});

test('o monstro se defende com os atributos finais: armadura, bloqueio e redução de dano alongam a luta; a vida e os modificadores contam', () => {
  const e = personagem();
  const base = Sim.simularLuta(e, { mob: { key: 'troll', raridade: 'raro' }, level: 100, lutas: 60 });
  const vigoroso = Sim.simularLuta(e, { mob: { key: 'troll', raridade: 'raro', modificadores: ['vigoroso'] }, level: 100, lutas: 60 });
  assert.ok(vigoroso.mob.vida > base.mob.vida);
  assert.ok(vigoroso.jogador.segundosParaMatar > base.jogador.segundosParaMatar);
  const escudado = Sim.simularLuta(e, { mob: { key: 'troll', raridade: 'raro', modificadores: ['escudado'] }, level: 100, lutas: 60 });
  assert.ok(escudado.jogador.dpsNoMob < base.jogador.dpsNoMob, 'o bloqueio do mob corta o dano do jogador');
  const temperado = Sim.simularLuta(e, { mob: { key: 'troll', raridade: 'raro', modificadores: ['temperado'] }, level: 100, lutas: 60 });
  assert.ok(temperado.jogador.dpsNoMob < base.jogador.dpsNoMob, 'a redução de dano do mob também');
});

test('o monstro ataca com os atributos dele: o Brutal sobe o dano recebido; as defesas do jogador (armadura, proteção) o reduzem', () => {
  const e = personagem();
  const base = Sim.simularLuta(e, { mob: { key: 'troll', raridade: 'raro' }, level: 100, lutas: 60 });
  const brutal = Sim.simularLuta(e, { mob: { key: 'troll', raridade: 'raro', modificadores: ['brutal'] }, level: 100, lutas: 60 });
  assert.ok(brutal.mobNoJogador.dps > base.mobNoJogador.dps);
  const blindada = personagem('knight', 100, [{ id: 'armor_flat', nivel: 5, value: 3000 }]);
  const comArmadura = Sim.simularLuta(blindada, { mob: { key: 'troll', raridade: 'raro' }, level: 100, lutas: 60 });
  assert.ok(comArmadura.mobNoJogador.dps < base.mobNoJogador.dps, `${comArmadura.mobNoJogador.dps} < ${base.mobNoJogador.dps}`);
  assert.ok(comArmadura.defesas.armadura > base.defesas.armadura, 'o efeito da armadura aparece em %');
});

test('chance de morte: um monstro fraco não mata; um absurdamente forte mata quase sempre', () => {
  const e = personagem();
  assert.equal(Sim.simularLuta(e, { mob: { key: 'troll' }, level: 100, lutas: 100 }).chanceDeMorte, 0);
  const forte = Sim.simularLuta(e, { mob: { key: 'troll', escala: { vida: 5000, dano: 5000 } }, level: 100, lutas: 100 });
  assert.ok(forte.chanceDeMorte > 0.9, `${forte.chanceDeMorte}`);
});

test('o dano de outros tipos do mob aparece por elemento no dano recebido', () => {
  const e = personagem();
  const antes = Mobs.CONFIG.porEspecie.especies;
  Mobs.CONFIG.porEspecie.especies = { troll: { danoExtra: [{ elemento: 'fire', min: 200, max: 400 }] } };
  try {
    const r = Sim.simularLuta(e, { mob: { key: 'troll' }, level: 100, lutas: 40 });
    assert.ok(r.mobNoJogador.porElemento.fire > 0, JSON.stringify(r.mobNoJogador.porElemento));
  } finally {
    Mobs.CONFIG.porEspecie.especies = antes;
  }
});

test('efeito dos modificadores, classes lado a lado e progressão por level', () => {
  const e = personagem();
  const m = Sim.efeitoDosModificadores(e, { key: 'troll', level: 100, raridade: 'raro', modificadores: ['brutal', 'blindado'], lutas: 40 });
  assert.ok(m.porModificador.brutal.danoRecebidoPorSegundo > m.base.danoRecebidoPorSegundo);
  assert.ok(m.porModificador.blindado.segundosParaMatar > m.base.segundosParaMatar);
  assert.ok(m.todos.segundosParaMatar >= m.base.segundosParaMatar);
  const classes = Sim.compararClasses(Object.fromEntries(['knight', 'paladin', 'sorcerer', 'druid', 'monk'].map((v) => [v, personagem(v)])), { mob: { key: 'troll' }, level: 100, lutas: 30 });
  assert.deepEqual(Object.keys(classes), ['knight', 'paladin', 'sorcerer', 'druid', 'monk']);
  for (const r of Object.values(classes)) assert.ok(r.dpsNoMob > 0);
  const p = Sim.progressao(e, { mob: { key: 'troll' }, niveis: [20, 100, 300], escalaPorLevel: (l) => ({ vida: l / 20, dano: 1 }), lutas: 30 });
  assert.equal(p.length, 3);
  assert.ok(p[2].vida > p[0].vida && p[2].segundosParaMatar > p[0].segundosParaMatar);
});

test('o editor recebe o detalhamento do monstro: atributos com origens, ataques, erros e avisos das regras', () => {
  const d = atributosDoMob({ key: 'troll', level: 100, raridade: 'raro', modificadores: ['vigoroso', 'brutal', 'frenetico'] });
  assert.ok(d.ok);
  assert.equal(d.raridade, 'raro');
  assert.equal(d.level, 100 + 3, 'o level da raridade soma');
  assert.ok(d.atributos.vida.origens.length >= 2);
  assert.equal(d.atributos.precisao.valor, 10 + 4 * 103);
  assert.ok(Array.isArray(d.ataques));
  assert.deepEqual(d.erros, []);
  assert.equal(d.avisos.length, 1, 'dano alto + ataque rápido + mitigação: aviso');
  assert.equal(atributosDoMob({ key: 'nao-existe' }).ok, false);
  const fora = atributosDoMob({ key: 'troll', raridade: 'modificado', modificadores: ['escudado'] });
  assert.ok(fora.erros.some((x) => /não entra em Mágico/.test(x)));
  assert.equal(atributosDoMob({ key: 'troll', level: 99999 }).level, 2000, 'o level é limitado');
});

test('os efeitos NO JOGADOR (controle e dano contínuo) vão no snapshot para o ícone ao lado do nome', () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 100 });
  assert.ok(Cacadas.entrar(e, { huntId: 'troll-cave', mode: 'auto' }).ok);
  const h = e.hunt;
  assert.equal(Cacadas.snapshotDaHunt(e, true).player.estados, undefined, 'sem efeito: nada no payload');
  Dot.aplicarNoJogador(h, { tipo: 'veneno', total: 500 }, h.clock ?? 0);
  Dot.aplicarNoJogador(h, { tipo: 'gelo', total: 300 }, h.clock ?? 0);
  h.controle = { lento: { ate: (h.clock ?? 0) + 3000, pct: 30 } };
  const snap = Cacadas.snapshotDaHunt(e, true);
  assert.deepEqual(snap.player.estados, ['lento', 'envenenado', 'enregelado']);
  assert.deepEqual(snap.player.controle, ['lento']);
  assert.equal(Dot.CONFIG.tipos.gelo.estado, 'enregelado');
  assert.deepEqual(Controle.ativosNoJogador(h), ['lento']);
});

test('o cliente: o editor e o mapa leem o que o servidor manda (as peças existem e a sintaxe está certa)', async () => {
  const { readFileSync } = await import('node:fs');
  const editor = readFileSync(new URL('../frontend/client/src/editor.mjs', import.meta.url), 'utf8');
  assert.match(editor, /atributos-do-mob/);
  assert.match(editor, /montarPainelDeAtributos/);
  const mapa = readFileSync(new URL('../frontend/client/src/map.mjs', import.meta.url), 'utf8');
  assert.match(mapa, /entity\.isPlayer\) && entity\.estados/);
  assert.match(mapa, /estado === 'enregelado'/);
  const backend = readFileSync(new URL('../backend/index.mjs', import.meta.url), 'utf8');
  assert.match(backend, /api\/mapas\/atributos-do-mob/);
});
