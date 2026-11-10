// (09/11 — dono: "quero resolver os aproximados e parciais" dos modificadores de monstro) LOTE 6: as CARGAS do monstro pelo PoB (o "if not player minion": Frenesi +11%
// de Ataque e Conjuração, +5% de Movimento, 4% mais Dano; Tolerância 11% de Redução Física e +15% Elementais; Poder +150% de Crítico), o Maldito, o Executor, o
// Equilíbrio Elemental em você, o Sangue Corrompido em quem o acerta, o Combardeiro (o dano pela distância) e o sangue na tela.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';
import * as M from '../systems/mobs/atributos.mjs';
import * as Buffs from '../systems/mobs/buffs.mjs';
import * as Mecanicas from '../systems/mobs/mecanicas.mjs';
import * as Reforcos from '../systems/skills/reforcos.mjs';
import * as NoJogador from '../systems/itens-poe/monstros-no-jogador.mjs';
import * as Raridade from '../systems/mobs/raridade.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import { criarMonstro } from '../systems/hunt/monstros.mjs';
import { contraAtaque } from '../systems/hunt/combate.mjs';
import { personagemDeTeste, PERSONAGEM, HUNT_DE_TESTE } from './apoio.mjs';

const SEM = !Catalogo.ligado() && 'só no jogo oficial (PoE)';
const troll = (extra = {}) => Object.assign(criarMonstro({ key: 'troll', x: 1, y: 1 }, null), extra);

test('as CARGAS do monstro pelo PoB: 3 de Frenesi = (1,04)³ de dano e +33% de ataque; Tolerância +33% físico e +45% elementais; Poder +450% de crítico', () => {
  const m = troll();
  for (let i = 0; i < 3; i++) for (const t of ['frenesi', 'tolerancia', 'poder']) Mecanicas.ganharCarga(m, t, 0);
  assert.equal(Math.round(Buffs.produto(m, 0, 'danoMaisPct') * 1e4) / 1e4, Math.round(1.04 ** 3 * 1e4) / 1e4);
  assert.equal(Buffs.soma(m, 0, 'velocidadeDeAtaquePct'), 33);
  assert.equal(Buffs.soma(m, 0, 'velocidadeDeConjuracaoPct'), 33);
  assert.equal(Buffs.soma(m, 0, 'velocidadePct'), 15);
  assert.deepEqual(['physical', 'fire', 'ice', 'energy'].map((el) => Buffs.resistencia(m, 0, el)), [33, 45, 45, 45]);
  assert.equal(Buffs.soma(m, 0, 'critAumentadoPct'), 450);
  assert.ok(Reforcos.forcaDoBicho(m, 0) > Reforcos.forcaDoBicho(troll(), 0) * 1.12);
  assert.ok(Reforcos.fatorDeDesaceleracao(m, 0) < 1, 'o passo encurta');
});

test('o Maldito causa 30% menos dano (final); o Executor bate mais por cada 10% da sua vida faltando', () => {
  Raridade.MODIFICADORES['teste:maldito'] = { nome: 'Teste', stats: { danoFinalPct: -30 } };
  try {
    const m = Raridade.aplicar(troll(), { raridade: 'raro', modificadores: ['teste:maldito'], multiplicadores: { dano: 1 } });
    assert.equal(Math.round((m.forca ?? 1) * 100), 70);
  } finally {
    delete Raridade.MODIFICADORES['teste:maldito'];
  }
  const ex = troll({ executorPct: 15 });
  assert.equal(M.fatorDoExecutor(ex, { hp: 100, maxHp: 100 }), 1);
  assert.equal(Math.round(M.fatorDoExecutor(ex, { hp: 35, maxHp: 100 }) * 100), 190, '65% faltando = 6 × 15%');
});

function cena(extra = {}) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 100 });
  e.maxHp = e.hp = 1e9;
  assert.ok(Cacadas.entrar(e, { huntId: HUNT_DE_TESTE, mode: 'auto' }).ok);
  const h = e.hunt;
  const m = Object.assign(criarMonstro({ key: 'troll', x: h.pos.x + 1, y: h.pos.y }, null), extra);
  h.monstros.splice(0, h.monstros.length, m);
  return { e, h, m };
}

test('o EQUILÍBRIO ELEMENTAL do monstro em você: o acerto de Fogo deixa +25% de Resistência a Fogo e −50% a Gelo e Raio, 5 s', { skip: SEM }, () => {
  const { e, h, m } = cena({ equilibrioElemental: true, conversaoPct: { fire: 100 } });
  const original = Math.random;
  Math.random = () => 0.5;
  try { contraAtaque(e, h, PERSONAGEM, m, []); } finally { Math.random = original; }
  assert.deepEqual(h.debuffsDoJogador?.equilibrio?.els, ['fire']);
  assert.deepEqual(NoJogador.addsDosDebuffsNoJogador(e), { fire_res: 25, ice_res: -50, energy_res: -50 });
});

test('o Sangue Corrompido em quem o acerta (o Corrompedor): o seu acerto nele põe um acúmulo em você', { skip: SEM }, () => {
  const { e, h, m } = cena({ sangueAoSerAcertadoPct: 60, mods: ['x'] });
  Mecanicas.aoReceberDano(e, h, PERSONAGEM, m, 100, 'physical', []);
  const d = (h.efeitosDoJogador?.dots ?? []).filter((x) => x.tipo === 'sangueCorrompido');
  assert.equal(d.length, 1);
  assert.ok(d[0].falta > 0);
});

test('os modificadores do arquivo: nenhum stat aproximado; o Assassino, o Combardeiro e o Quebra-ossos com os campos novos', () => {
  const d = JSON.parse(readFileSync(new URL('../gamedata/itens-poe/modificadores-monstro.json', import.meta.url), 'utf8'));
  const comStats = d.mods.filter((m) => (m.statsPoe ?? []).length);
  assert.deepEqual(comStats.filter((m) => m.estado === 'aproximado').map((m) => m.nome), [], 'os aproximados que sobram são só as habilidades sem stat');
  assert.equal(d.mods.find((m) => m.nome === 'Combardeiro').stats.danoPorDistanciaPct, 60);
  assert.equal(d.mods.find((m) => m.nome === 'Infundido com Aço').stats.sangueRobo, 1);
});
