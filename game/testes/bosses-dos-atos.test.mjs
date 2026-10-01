// Os ATAQUES ESPECIAIS dos bosses das Acts (auditoria de 01/10): cada magia do arquivo
// (`gamedata/boss-poderes.json`, os `monster.lua` do Canary) sai pelo fluxo real
// (`Poderes.lancar`, chamado por `golpesDosMonstros` a cada tique), acerta na área
// prevista (a geometria compartilhada, `engine/areas.mjs`), respeita o intervalo e o
// alcance, e não bate em quem já morreu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Treino from '../systems/treino.mjs';
import * as Poderes from '../systems/poderes.mjs';
import * as Campanha from '../systems/campanha.mjs';
import * as Areas from '../engine/areas.mjs';
import { personagemDeTeste, PERSONAGEM } from './apoio.mjs';

const BP = JSON.parse(readFileSync(new URL('../gamedata/boss-poderes.json', import.meta.url), 'utf8')).bosses;
const BOSSES = Array.from({ length: Campanha.ATOS }, (_, i) => Campanha.bossDoAto(i + 1)).filter(Boolean);
// Ficha sem esquiva, sem evitar dano, sem Energy Shield e sem proteção: o golpe chega inteiro.
const FICHA = { protection: {}, esquiva: 0, evitarDano: 0, energyShield: 0, danoRecebidoDasGemas: 0 };
const NOME = { physical: 'físico', fire: 'de fogo', ice: 'de gelo', earth: 'de terra', energy: 'de energia', death: 'de morte', holy: 'sagrado', lifedrain: 'de dreno de vida', manadrain: 'de dreno de mana', drown: 'de afogamento' };
const FORMA = { area: ' em área', feixe: ' em feixe', alvo: '' };
const nomeDoGolpe = (a) => (a.elemento === 'physical' && a.forma === 'alvo' ? 'à distância' : `${NOME[a.elemento]}${FORMA[a.forma]}`);

function sala(bossId) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 1100 });
  Treino.garantir(e);
  const r = Cacadas.entrar(e, { huntId: bossId, mode: 'auto' });
  assert.ok(r.ok, `${bossId}: ${r.erro}`);
  e.hunt.assistencia = false;
  e.hunt.autoBarra = false;
  e.hp = e.maxHp = 1e9;
  e.mana = e.maxMana = 1e9;
  return { e, h: e.hunt, boss: e.hunt.monstros.find((m) => m.key === bossId) };
}

/** Uma casa onde a magia `a` do boss alcança o jogador (perto, no feixe, ou no alvo a 3 casas). */
function ondeAlcanca(a, boss) {
  if (a.forma === 'feixe') return { x: boss.x + Math.min(3, a.comprimento), y: boss.y };
  if (a.forma === 'area' && !a.noAlvo) return { x: boss.x + 1, y: boss.y };
  return { x: boss.x + 3, y: boss.y };
}

/** Lança SÓ a magia `i` (as outras esperando), com a chance garantida. */
function lancarSo(e, h, boss, i, agora) {
  boss.proximoPoder = Object.fromEntries(BP[boss.key].ataques.map((_, k) => [k, k === i ? 0 : Infinity]));
  const ev = [];
  const rnd = Math.random;
  Math.random = () => 0.001;
  try {
    Poderes.lancar(e, h, PERSONAGEM, boss, ev, agora, FICHA, false);
  } finally {
    Math.random = rnd;
  }
  return ev;
}

test('as Acts têm bosses, e cada um tem os poderes do arquivo (o melee e as magias)', () => {
  assert.equal(BOSSES.length, Campanha.ATOS);
  for (const b of BOSSES) {
    assert.ok(BP[b.bossId], `${b.nome}: sem poderes`);
    assert.ok(BP[b.bossId].ataques.some((a) => a.tipo === 'melee'), `${b.nome}: sem corpo a corpo`);
    assert.ok(BP[b.bossId].ataques.some((a) => a.tipo === 'magia'), `${b.nome}: sem magia`);
    const { boss } = sala(b.bossId);
    assert.ok(boss && Poderes.temPoderes(boss), `${b.nome}: o boss da sala não está ligado aos poderes`);
  }
});

for (const b of BOSSES) {
  test(`${b.nome}: cada magia, isolada — sai, acerta na área prevista, dano na faixa do arquivo e respeita o intervalo`, () => {
    BP[b.bossId].ataques.forEach((a, i) => {
      if (a.tipo !== 'magia') return;
      const { e, h, boss } = sala(b.bossId);
      Object.assign(h.pos, ondeAlcanca(a, boss));
      const ev = lancarSo(e, h, boss, i, 10);
      const golpes = ev.filter((x) => x.t === 'dmg' && x.uid === 'player');
      const rotulo = `${b.nome} #${i} (${nomeDoGolpe(a)}${a.estimado ? ', estimado' : ''})`;
      assert.equal(golpes.length, 1, `${rotulo}: ${golpes.length} golpes`);
      assert.equal(golpes[0].golpe, nomeDoGolpe(a), rotulo);
      // Com a sorte no mínimo, o dano é o mínimo do arquivo (sem proteção, sem força extra).
      assert.ok(golpes[0].v >= a.min - 1 && golpes[0].v <= a.max, `${rotulo}: ${golpes[0].v} fora de ${a.min}..${a.max}`);
      // O desenho: a área (ou o efeito no alvo) contém a casa do jogador.
      const area = ev.find((x) => x.t === 'area');
      const casas = area ? Areas.casasDoEvento(area) : ev.filter((x) => x.t === 'fx' && x.uid !== 'player').map((x) => ({ x: x.x, y: x.y }));
      assert.ok(casas.some((c) => c.x === h.pos.x && c.y === h.pos.y), `${rotulo}: o desenho não passa pelo jogador`);
      // O intervalo: um instante antes não sai; no intervalo, sai de novo.
      const antes = [];
      const rnd = Math.random;
      Math.random = () => 0.001;
      try {
        Poderes.lancar(e, h, PERSONAGEM, boss, antes, 10 + a.intervalo - 1, FICHA, false);
        assert.equal(antes.filter((x) => x.t === 'dmg').length, 0, `${rotulo}: saiu antes do intervalo`);
        const depois = [];
        Poderes.lancar(e, h, PERSONAGEM, boss, depois, 10 + a.intervalo, FICHA, false);
        assert.equal(depois.filter((x) => x.t === 'dmg' && x.uid === 'player').length, 1, `${rotulo}: não saiu no intervalo`);
      } finally {
        Math.random = rnd;
      }
    });
  });
}

test('alcance: a área em volta do boss não pega quem está longe; o feixe não pega na diagonal', () => {
  const { e, h, boss } = sala('bakragore');
  const ataques = BP.bakragore.ataques;
  const feixe = ataques.findIndex((a) => a.forma === 'feixe');
  Object.assign(h.pos, { x: boss.x + 3, y: boss.y + 3 });
  assert.equal(lancarSo(e, h, boss, feixe, 10).filter((x) => x.t === 'dmg').length, 0, 'feixe na diagonal');
  const u = sala('urmahlullu-the-immaculate');
  const areaNoBoss = BP['urmahlullu-the-immaculate'].ataques.findIndex((a) => a.forma === 'area' && !a.noAlvo && a.raio === 3);
  Object.assign(u.h.pos, { x: u.boss.x + 5, y: u.boss.y });
  assert.equal(lancarSo(u.e, u.h, u.boss, areaNoBoss, 10).filter((x) => x.t === 'dmg').length, 0, 'área de raio 3 com o jogador a 5');
});

test('morto no meio do tique: as magias seguintes não batem (sem dano depois da morte)', () => {
  const { e, h, boss } = sala('bakragore');
  Object.assign(h.pos, { x: boss.x + 1, y: boss.y });
  e.hp = 1;
  boss.proximoPoder = Object.fromEntries(BP.bakragore.ataques.map((_, k) => [k, 0]));
  const ev = [];
  const rnd = Math.random;
  Math.random = () => 0.001;
  try {
    Poderes.lancar(e, h, PERSONAGEM, boss, ev, 10, FICHA, false);
  } finally {
    Math.random = rnd;
  }
  assert.equal(e.hp, 0);
  assert.equal(ev.filter((x) => x.t === 'dmg' && x.uid === 'player').length, 1);
});

test('Bakragore se cura (a defesa do arquivo) quando está abaixo da vida máxima', () => {
  const { e, h, boss } = sala('bakragore');
  Object.assign(h.pos, { x: boss.x + 1, y: boss.y });
  boss.hp = boss.maxHp - 10_000;
  boss.proximoPoder = Object.fromEntries(BP.bakragore.ataques.map((_, k) => [k, Infinity]));
  const rnd = Math.random;
  Math.random = () => 0.001;
  try {
    Poderes.lancar(e, h, PERSONAGEM, boss, [], 10, FICHA, false);
  } finally {
    Math.random = rnd;
  }
  const cura = BP.bakragore.curas[0];
  assert.ok(boss.hp >= boss.maxHp - 10_000 + cura.min, `curou ${boss.hp - (boss.maxHp - 10_000)}`);
});

for (const b of BOSSES) {
  test(`${b.nome}: luta longa pelo tique de verdade (10 min) — todas as magias saem, o corpo a corpo bate e a IA não trava`, () => {
    const { e, h, boss } = sala(b.bossId);
    const golpes = {};
    let ultimosMin = 0;
    let t = Date.now();
    h.ultimoTique = t;
    const ticks = 4 * 600;
    for (let i = 0; i < ticks; i++) {
      t += 250;
      e.hp = e.maxHp = 1e9;
      boss.hp = boss.maxHp - 1;
      Object.assign(h.pos, { x: boss.x + 1, y: boss.y });
      h.alvo = null;
      for (const x of Cacadas.tique(e, PERSONAGEM, t)) {
        if (x.t !== 'dmg' || x.uid !== 'player' || x.de !== boss.name) continue;
        golpes[x.golpe] = (golpes[x.golpe] ?? 0) + 1;
        if (i > ticks - 4 * 60) ultimosMin++;
      }
    }
    assert.ok(golpes['corpo a corpo'] > 0, `${b.nome}: sem corpo a corpo`);
    for (const a of BP[b.bossId].ataques.filter((x) => x.tipo === 'magia')) assert.ok(golpes[nomeDoGolpe(a)] > 0, `${b.nome}: "${nomeDoGolpe(a)}" nunca saiu (${JSON.stringify(golpes)})`);
    assert.ok(ultimosMin > 0, `${b.nome}: parou de atacar no último minuto`);
  });
}
