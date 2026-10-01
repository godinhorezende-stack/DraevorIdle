// O motor de PROJÉTIL e ÁREA (systems/skills/golpes-secundarios.mjs, etapa 3): as
// supports de projétil (mais projéteis, perfurar, bifurcar, encadear, retornar),
// de golpe (explosão, impacto) e de área (aumentar, concentrar) — genéricas por tag,
// e a combinação pedida: Fireball + Multiple Projectiles + Pierce + Explosion + Faster Casting.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Acoes from '../systems/acoes.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Ficha from '../systems/ficha.mjs';
import * as Treino from '../systems/treino.mjs';
import * as G from '../systems/skills/gemas.mjs';
import * as S from '../systems/skills/golpes-secundarios.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import { criarMonstro } from '../systems/hunt/monstros.mjs';
import { personagemDeTeste, PERSONAGEM } from './apoio.mjs';

const GEMA = (acao) => G.ITEM_DA_ACAO.get(acao);
const SUP = (id) => [...G.DEFS.values()].find((d) => d.tipo === 'support' && d.id === id).itemId;
const idDe = (nome) => Number(Object.values(ITEM_CATALOG).find((i) => i.name === nome).id);
const HP = 1e12;

/** Personagem com a skill e as supports LIGADAS na arma (4 sockets). */
function montar(vocacao, acao, supports = []) {
  const e = personagemDeTeste({ vocacao, level: 300 });
  Treino.garantir(e);
  const arma = vocacao === 'knight' ? 'fire sword' : 'wand of vortex';
  const gemas = [G.novaGema(GEMA(acao)), ...supports.map((s) => G.novaGema(SUP(s)))];
  e.equipment.weapon = { id: idDe(arma), count: 1, soquetes: { abertos: 4, links: [true, true, true], gemas: [...gemas, ...Array(4 - gemas.length).fill(null)] } };
  Ficha.invalidar(e);
  assert.ok(Cacadas.entrar(e, { huntId: 'troll-cave', mode: 'auto' }).ok);
  const h = e.hunt;
  delete h.instancia;
  h.respawns = [];
  h.monstros = [];
  e.maxHp = e.hp = 1e12;
  e.maxMana = e.mana = 1e12;
  return e;
}
const bicho = (e, dx, dy) => {
  const m = Object.assign(criarMonstro({ key: 'troll', x: e.hunt.pos.x + dx, y: e.hunt.pos.y + dy }, null), { hp: HP, maxHp: HP });
  e.hunt.monstros.push(m);
  return m;
};
function lancar(e, acao, alvo) {
  const h = e.hunt;
  e.actions = Array(Acoes.SLOTS).fill(null);
  const slot = Acoes.PAPEL_DO_SLOT.indexOf('attack');
  assert.equal(Acoes.definir(e, { slot, value: { id: acao } }).ok, true);
  h.cooldowns = {};
  delete h.ultimoAtaqueEm;
  delete h.conjurando;
  const r = Acoes.disparar(e, h, PERSONAGEM, slot, alvo);
  if (r.conjurando) {
    h.conjurando.fim = 0;
    return Acoes.concluirConjuracao(e, h, PERSONAGEM);
  }
  assert.notEqual(r.ok, false, r.erro);
  return r.eventos;
}
const quantasVezes = (eventos, m) => eventos.filter((ev) => ev.t === 'dmg' && ev.uid === m.uid).length;
const FLAME = 'spell-flame-strike'; // fire, projectile, single, hit

test('as tags que as supports leem: Flame Strike é projectile + single + hit; Fire Wave é área (wave)', () => {
  assert.deepEqual(['fire', 'hit', 'projectile', 'single', 'spell'].every((t) => G.DEFS.get(GEMA(FLAME)).tags.includes(t)), true);
  const onda = G.DEFS.get(GEMA('spell-fire-wave')).tags;
  assert.ok(onda.some((t) => ['area', 'wave', 'line'].includes(t)));
});

test('Extra Projectile / Greater Multiple Projectiles: mais bichos levam o projétil, com menos dano cada', () => {
  const e = montar('sorcerer', FLAME, ['greater-multiple-projectiles']);
  const alvo = bicho(e, 1, 0);
  const outros = [bicho(e, 2, 1), bicho(e, -1, 1), bicho(e, 0, 2), bicho(e, -2, 0), bicho(e, 2, -2)];
  const ev = lancar(e, FLAME, alvo);
  assert.equal(outros.filter((m) => quantasVezes(ev, m) === 1).length, 4, '+4 projéteis');
  assert.equal(quantasVezes(ev, alvo), 1);
});

test('Pierce: o projétil atravessa o alvo e acerta quem está atrás, na mesma reta', () => {
  const e = montar('sorcerer', FLAME, ['pierce']);
  const alvo = bicho(e, 1, 0);
  const atras1 = bicho(e, 2, 0);
  const atras2 = bicho(e, 3, 0);
  const atras3 = bicho(e, 4, 0);
  const fora = bicho(e, 2, 2);
  const ev = lancar(e, FLAME, alvo);
  assert.equal(quantasVezes(ev, atras1), 1);
  assert.equal(quantasVezes(ev, atras2), 1);
  assert.equal(quantasVezes(ev, atras3), 0, 'perfura 2');
  assert.equal(quantasVezes(ev, fora), 0, 'fora da reta');
});

test('Fork: no alvo, o projétil se divide em dois; Chain: salta de bicho em bicho', () => {
  const e = montar('sorcerer', FLAME, ['fork']);
  const alvo = bicho(e, 2, 0);
  const a = bicho(e, 3, 1);
  const b = bicho(e, 3, -1);
  const longe = bicho(e, 2, 9);
  const ev = lancar(e, FLAME, alvo);
  assert.equal(quantasVezes(ev, a) + quantasVezes(ev, b), 2);
  assert.equal(quantasVezes(ev, longe), 0);

  const c = montar('sorcerer', FLAME, ['chain']);
  const x0 = bicho(c, 1, 0);
  const x1 = bicho(c, 4, 0);
  const x2 = bicho(c, 7, 0);
  const x3 = bicho(c, 10, 0);
  const ev2 = lancar(c, FLAME, x0);
  assert.deepEqual([x1, x2, x3].map((m) => quantasVezes(ev2, m)), [1, 1, 0], 'encadeia 2, a até 4 do último');
});

test('Returning Projectile: o projétil volta e acerta o alvo de novo', () => {
  const e = montar('sorcerer', FLAME, ['returning-projectile']);
  const alvo = bicho(e, 2, 0);
  assert.equal(quantasVezes(lancar(e, FLAME, alvo), alvo), 2);
});

test('Explosion: o golpe explode 3×3 em volta do impacto — o alvo (direto + explosão) e os vizinhos', () => {
  const e = montar('sorcerer', FLAME, ['explosion']);
  const alvo = bicho(e, 3, 0);
  const vizinho = bicho(e, 4, 1);
  const longe = bicho(e, 6, 0);
  const ev = lancar(e, FLAME, alvo);
  // Decisão do dono (01/10): a explosão pega TODOS no 3×3, inclusive o do impacto.
  assert.equal(quantasVezes(ev, alvo), 2);
  assert.equal(quantasVezes(ev, vizinho), 1);
  assert.equal(quantasVezes(ev, longe), 0);
});

test('Impact: skill física corpo a corpo de alvo único bate também em volta do alvo', () => {
  const e = montar('knight', 'spell-brutal-strike', ['impact']);
  const alvo = bicho(e, 1, 0);
  const vizinho = bicho(e, 2, 1);
  const ev = lancar(e, 'spell-brutal-strike', alvo);
  assert.equal(quantasVezes(ev, vizinho), 1);
});

test('Area of Effect / Concentrated Effect: a área cresce ou encolhe; concentrar bate mais', () => {
  const quadrado = [];
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) quadrado.push({ x: dx, y: dy });
  assert.equal(S.mudarArea(quadrado, 1).length, 25);
  assert.equal(S.mudarArea(quadrado, -1).length, 1);
  assert.equal(S.mudarArea([{ x: 0, y: 0 }], -1).length, 1, 'concentrar não apaga a área');
  const def = G.DEFS.get(SUP('concentrated-effect'));
  assert.ok(def.suporte.efeito.danoPct > 0 && def.suporte.efeito.areaExtra < 0);
});

test('as supports só valem na skill com as tags delas: Pierce não pega na Fire Wave (sem projectile)', () => {
  const pierce = G.DEFS.get(SUP('pierce')).suporte;
  assert.equal(G.compativel(pierce, G.DEFS.get(GEMA('spell-fire-wave')).tags), false);
  assert.equal(G.compativel(pierce, G.DEFS.get(GEMA(FLAME)).tags), true);
});

test('COMBINAÇÃO: Flame Strike + Multiple Projectiles + Pierce + Explosion — todos os efeitos juntos', () => {
  const e = montar('sorcerer', FLAME, ['multiple-projectiles', 'pierce', 'explosion']);
  const efeito = G.efeitoNaSkill(e, FLAME);
  assert.deepEqual(efeito.supports.sort(), ['Explosion', 'Multiple Projectiles', 'Pierce']);
  const alvo = bicho(e, 1, 0);
  const atras = bicho(e, 2, 0); // perfuração
  const extra1 = bicho(e, -1, 0); // projéteis extras (os mais perto de quem lança)
  const extra2 = bicho(e, 0, -1);
  const vizinhoDoAlvo = bicho(e, 1, 1); // explosão em volta do alvo
  const ev = lancar(e, FLAME, alvo);
  for (const m of [alvo, atras, extra1, extra2, vizinhoDoAlvo]) assert.ok(quantasVezes(ev, m) >= 1, `${m.x - e.hunt.pos.x},${m.y - e.hunt.pos.y} levou`);
  // A explosão também pega os vizinhos do alvo que já levaram outro golpe (ela é em área).
  assert.ok(ev.filter((x) => x.t === 'dmg').length > 5);
});

test('COMBINAÇÃO com Faster Casting: a conjuração fica mais curta e os efeitos de projétil continuam', () => {
  const sem = montar('sorcerer', FLAME, ['multiple-projectiles', 'pierce', 'explosion']);
  const com = montar('sorcerer', FLAME, ['multiple-projectiles', 'pierce', 'faster-casting']);
  assert.ok(G.tempoDeConjuracao(com, FLAME) < G.tempoDeConjuracao(sem, FLAME));
  assert.ok(G.efeitoNaSkill(com, FLAME).perfurar > 0 && G.efeitoNaSkill(com, FLAME).alvosExtras > 0);
});

test('os % dos golpes secundários se multiplicam entre supports (Multiple 60% × Extra 80% = 48%); contagens somam', () => {
  const e = montar('sorcerer', FLAME, ['multiple-projectiles', 'extra-projectile']);
  const ef = G.efeitoNaSkill(e, FLAME);
  assert.equal(ef.alvosExtras, 3);
  assert.equal(Math.round(ef.danoDosExtrasPct), 48);
});

test('Area of Effect no disparo de verdade: a Fire Wave pega mais bichos com a support', () => {
  const pegos = (supports) => {
    const e = montar('sorcerer', 'spell-fire-wave', supports);
    const todos = [];
    for (let dx = -6; dx <= 6; dx++) for (let dy = -6; dy <= 6; dy++) if (dx || dy) todos.push(bicho(e, dx, dy));
    const ev = lancar(e, 'spell-fire-wave', todos.find((m) => m.x === e.hunt.pos.x && m.y === e.hunt.pos.y - 1));
    return todos.filter((m) => quantasVezes(ev, m) > 0).length;
  };
  const normal = pegos([]);
  assert.ok(pegos(['area-of-effect']) > normal, 'maior');
  assert.ok(pegos(['concentrated-effect']) < normal, 'menor');
});
