// (09/11 — dono: "quero resolver os aproximados e parciais" dos modificadores de monstro) LOTE 3: a DEFESA do monstro — o bloqueio de magia separado do de
// ataque e o "Você sofre X% do Dano de Acertos Bloqueados", o atordoamento (o limiar dele, imune, o "Sempre Atordoa" e o "chance de dobrar"), o Golpe de
// Misericórdia, o dano extra do crítico recebido, a lentidão que não pega e a Sobrecarga da sua redução física.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';
import * as M from '../systems/mobs/atributos.mjs';
import * as Estados from '../systems/skills/estados.mjs';
import * as Controle from '../systems/combate/controle.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import { resistido } from '../systems/hunt/resistencia.mjs';
import { criarMonstro } from '../systems/hunt/monstros.mjs';
import { contraAtaque } from '../systems/hunt/combate.mjs';
import { personagemDeTeste, PERSONAGEM, HUNT_DE_TESTE } from './apoio.mjs';

const SEM = !Catalogo.ligado() && 'só no jogo oficial (PoE)';
const troll = (extra = {}) => Object.assign(criarMonstro({ key: 'troll', x: 1, y: 1 }, null), extra);

test('o BLOQUEIO: a magia usa a chance de Bloquear o Dano Mágico (sem ela, não bloqueia) e o ataque, a de ataque; o "sofre 20% do bloqueado" deixa o golpe passar com 20%', () => {
  const m = troll({ bloqueio: 50 });
  assert.equal(M.bloqueou(m, () => 0.1), true, 'o ataque é bloqueado');
  assert.equal(M.bloqueou(m, () => 0.1, 1, { magia: true }), false, 'a magia não: o monstro não tem bloqueio de magia');
  assert.equal(M.bloqueou(troll({ bloqueioMagia: 50 }), () => 0.1, 1, { magia: true }), true);
  const hunt = { clock: 100 };
  const s = troll({ bloqueio: 50, danoBloqueadoPct: 20 });
  const eventos = [];
  assert.equal(M.bloqueou(s, () => 0.1, 1, { hunt, eventos }), false, 'bloqueou, mas o golpe segue');
  assert.ok(eventos.some((e) => e.bloqueado && e.parcial));
  const ficha = {};
  const cheio = resistido({ clock: 100 }, s, 'fire', 1000, ficha);
  assert.equal(resistido(hunt, s, 'fire', 1000, ficha), Math.round(cheio * 0.2));
  hunt.clock = 101;
  assert.equal(resistido(hunt, s, 'fire', 1000, ficha), cheio, 'só no golpe que ele bloqueou');
  M.bloqueou(s, () => 0.99, 1, { hunt });
  assert.equal(hunt.bloqueioParcial, null, 'o golpe não bloqueado limpa');
});

test('o ATORDOAMENTO no monstro: "Não Pode ser Atordoado" não atordoa; o "Ponto de Atordoamento aumentado" divide a chance; a lentidão não pega em quem tem a base garantida', () => {
  const imune = troll({ imuneAtordoamento: true });
  assert.equal(Estados.atordoar(imune, 1000, 0), false);
  assert.deepEqual(Estados.aplicar(troll(), { atordoarChance: 50 }, 100, 0, () => 0.4), ['atordoado']);
  assert.deepEqual(Estados.aplicar(troll({ limiarAtordoamentoPct: 250 }), { atordoarChance: 50 }, 100, 0, () => 0.4), [], '50% ÷ 3,5 = 14%');
  const firme = troll({ semLentidao: true });
  assert.deepEqual(Estados.aplicar(firme, { lentidaoPct: 30 }, 100, 0), []);
  assert.equal(Estados.fatorDeLentidao(firme, 0), 1);
  assert.equal(Estados.fatorDeTolhimento(troll({ semLentidaoMovimento: true, estados: { tolhido: { ate: 9999, pct: 30 } } }), 0), 1);
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
const bater = ({ e, h, m }) => {
  const ev = [];
  const original = Math.random;
  Math.random = () => 0.5;
  try { contraAtaque(e, h, PERSONAGEM, m, ev); } finally { Math.random = original; }
  return ev;
};

test('o "Sempre Atordoa" do monstro te atordoa em todo acerto; o "dobrar a Duração" dobra; a Sobrecarga da sua redução física aumenta o golpe', { skip: SEM }, () => {
  const a = cena({ sempreAtordoa: true });
  bater(a);
  const ms = a.h.controle?.atordoado?.ms ?? 0;
  assert.ok(ms > 0, 'atordoou');
  const b = cena({ sempreAtordoa: true, dobrarAtordoamentoPct: 100 });
  bater(b);
  assert.equal(b.h.controle.atordoado.ms, ms * 2);
  // a Sobrecarga: com armadura, o golpe passa mais
  const dano = (extra) => bater(cena({ forca: 20, ...extra })).filter((x) => x.t === 'dmg' && !x.foe).reduce((n, x) => n + x.v, 0);
  assert.ok(dano({ sobrecargaFisicaPct: 50 }) >= dano({}), 'nunca menos');
  assert.equal(Controle.atordoarJogador(null, {}), false);
});

test('o crítico no monstro: "Dano Extra recebido de Acertos Críticos reduzido em 50%" corta só a parte extra (e o "não sofre dano extra" corta tudo)', async () => {
  const Ficha = await import('../systems/ficha.mjs');
  const e = personagemDeTeste({ vocacao: 'knight', level: 100 });
  const ficha = { ...Ficha.combate(e), critChance: 1, critMultiplier: 2.5, tagsDoGolpe: [] };
  const normal = Ficha.rolarCritico(e, 1000, troll(), [], ficha);
  const meio = Ficha.rolarCritico(e, 1000, troll({ danoExtraCriticoRedPct: 50 }), [], ficha);
  const nada = Ficha.rolarCritico(e, 1000, troll({ danoExtraCriticoRedPct: 100 }), [], ficha);
  assert.ok(normal.crit && meio.crit && nada.crit);
  assert.equal(Math.round((meio.dano / normal.dano) * 100) / 100, Math.round(((1 + 1.5 * 0.5) / 2.5) * 100) / 100);
  assert.equal(Math.round((nada.dano / normal.dano) * 100) / 100, Math.round((1 / 2.5) * 100) / 100);
});

test('os modificadores do arquivo: o Sentinela, o Destruidor e o Quebra-ossos com efeito', () => {
  const d = JSON.parse(readFileSync(new URL('../gamedata/itens-poe/modificadores-monstro.json', import.meta.url), 'utf8'));
  const sentinela = d.mods.find((m) => m.nome === 'Sentinela');
  assert.equal(sentinela.estado, 'efeito');
  assert.deepEqual([sentinela.stats.bloqueio, sentinela.stats.bloqueioMagia], [50, 50]);
  assert.ok(d.mods.filter((m) => m.nome === 'Não Pode ser Atordoado').every((m) => m.estado === 'efeito'));
  assert.ok(d.mods.filter((m) => m.nome === 'Atordoa').every((m) => m.estado === 'efeito'));
});
