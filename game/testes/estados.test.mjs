// Os ESTADOS das supports (Freeze, Slow, Ignite, Stun) — regras da auditoria de 02/10 (decididas pelo dono):
// Freeze 1,5 s / Slow 3 s e teto de 40%; congelar e atordoar não renovam e deixam o bicho imune por 3 s; boss imune, elite com metade
// da duração; UMA queimação por bicho (a maior) e o relógio dos pulsos que não reinicia; só os estados ATIVOS vão para o cliente.
import * as Dot from '../systems/combate/dot.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Estados from '../systems/skills/estados.mjs';
import { CONFIG } from '../systems/skills/gemas.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import { personagemDeTeste, HUNT_DE_TESTE } from './apoio.mjs';

const SEMPRE = () => 0; // o sorteio sempre acerta
const NUNCA = () => 0.999;
const mob = (extra = {}) => ({ uid: 1, hp: 1e9, maxHp: 1e9, x: 0, y: 0, name: 'm', ...extra });
const FREEZE = { congelarChance: 100 };

test('config: Freeze 1,5 s, Slow 3 s com teto de 40%, imunidade de controle de 3 s, elite com metade e boss imune', () => {
  const c = CONFIG.estados;
  assert.equal(c.congelado.duracao, 1500);
  assert.equal(c.lento.duracao, 3000);
  assert.equal(c.lento.maximo, 40);
  assert.equal(c.controle.imunidade, 3000);
  assert.equal(c.elite.duracao, 0.5);
  assert.equal(c.chefe.controle, 0);
});

test('Freeze: dura 1,5 s e NÃO renova enquanto ativo', () => {
  const m = mob();
  assert.deepEqual(Estados.aplicar(m, FREEZE, 100, 1000, SEMPRE), ['congelado']);
  assert.equal(m.estados.congelado.ate, 2500);
  assert.deepEqual(Estados.aplicar(m, FREEZE, 100, 1500, SEMPRE), [], 'ativo: não renova');
  assert.equal(m.estados.congelado.ate, 2500);
  assert.equal(Estados.podeAgir(m, 2000), false);
  assert.equal(Estados.podeAgir(m, 2600), true);
});

test('Freeze: depois de acabar o bicho fica imune 3 s (e depois pode congelar de novo)', () => {
  const m = mob();
  Estados.aplicar(m, FREEZE, 100, 1000, SEMPRE);
  assert.deepEqual(Estados.aplicar(m, FREEZE, 100, 2600, SEMPRE), [], '0,1 s depois de descongelar: imune');
  assert.deepEqual(Estados.aplicar(m, FREEZE, 100, 5400, SEMPRE), [], 'ainda na janela (acaba em 5500)');
  assert.deepEqual(Estados.aplicar(m, FREEZE, 100, 5600, SEMPRE), ['congelado'], 'passou a imunidade');
});

test('o tempo congelado nunca passa de ~1/3, mesmo com 100% de chance e acertos a cada 0,25 s', () => {
  const m = mob();
  let congelado = 0;
  const total = 60000;
  for (let t = 0; t < total; t += 250) {
    Estados.aplicar(m, FREEZE, 100, t, SEMPRE);
    if (!Estados.podeAgir(m, t)) congelado += 250;
  }
  assert.ok(congelado / total <= 0.36, `${((100 * congelado) / total).toFixed(0)}% do tempo congelado`);
  assert.ok(congelado / total >= 0.28, 'e o efeito ainda existe');
});

test('Stun e Freeze dividem a mesma imunidade (um depois do outro não prende o bicho)', () => {
  const m = mob();
  Estados.aplicar(m, { atordoarChance: 100 }, 100, 1000, SEMPRE);
  assert.ok(m.estados.atordoado);
  assert.deepEqual(Estados.aplicar(m, FREEZE, 100, 2600, SEMPRE), [], 'imune depois do stun');
  assert.deepEqual(Estados.aplicar(m, { atordoarChance: 100 }, 100, 2600, SEMPRE), []);
});

test('Boss é imune a congelar e atordoar; boss de sala também; Slow pega só metade', () => {
  for (const chefe of [mob({ boss: { id: 'x' } }), mob({ chefe: true })]) {
    assert.deepEqual(Estados.aplicar(chefe, { congelarChance: 100, atordoarChance: 100 }, 100, 1000, SEMPRE), []);
    assert.equal(Estados.podeAgir(chefe, 1001), true);
    Estados.aplicar(chefe, { lentidaoPct: 40 }, 100, 1000, SEMPRE);
    assert.equal(chefe.estados.lento.pct, 20);
  }
  const naSala = mob();
  assert.deepEqual(Estados.aplicar(naSala, FREEZE, 100, 1000, SEMPRE, true), [], 'sala de boss');
});

test('Elite: metade da duração de congelar, atordoar e lentidão', () => {
  const e = mob({ elite: true });
  Estados.aplicar(e, FREEZE, 100, 1000, SEMPRE);
  assert.equal(e.estados.congelado.ate, 1750);
  const e2 = mob({ elite: true });
  Estados.aplicar(e2, { lentidaoPct: 30 }, 100, 1000, SEMPRE);
  assert.equal(e2.estados.lento.ate, 2500);
  assert.equal(e2.estados.lento.pct, 30);
});

test('Slow: dura 3 s, teto de 40%, vale a MAIOR (a mais fraca depois não sobrescreve) e nunca encurta', () => {
  const m = mob();
  Estados.aplicar(m, { lentidaoPct: 90 }, 100, 1000, SEMPRE);
  assert.equal(m.estados.lento.pct, 40, 'o teto');
  assert.equal(m.estados.lento.ate, 4000);
  assert.ok(Math.abs(Estados.fatorDeLentidao(m, 1500) - 1 / 0.6) < 1e-9);
  Estados.aplicar(m, { lentidaoPct: 20 }, 100, 2000, SEMPRE);
  assert.equal(m.estados.lento.pct, 40, 'a mais fraca não troca a maior');
  assert.equal(m.estados.lento.ate, 5000, 'renova a duração');
  assert.equal(Estados.fatorDeLentidao(m, 5100), 1, 'acabou');
});

test('Ignite: UMA queimação por bicho — a maior vale, a mais fraca é ignorada', () => {
  const m = mob();
  const ig = { igniteChance: 100, ignitePct: 40 };
  Estados.aplicar(m, ig, 1000, 1000, SEMPRE);
  assert.equal(Dot.restante(m, 'queimadura'), 400);
  assert.deepEqual(Estados.aplicar(m, ig, 500, 1100, SEMPRE), [], 'mais fraca: ignorada');
  assert.equal(Dot.restante(m, 'queimadura'), 400);
  assert.deepEqual(Estados.aplicar(m, ig, 2000, 1200, SEMPRE), ['queimando']);
  assert.equal(Dot.restante(m, 'queimadura'), 800, 'a maior substitui (não soma)');
});

test('Ignite: o relógio dos pulsos NÃO reinicia — com acertos a cada 0,4 s a queimação paga (antes: dano zero)', () => {
  const m = mob();
  const hunt = { monstros: [m] };
  const ev = [];
  let dot = 0;
  const ig = { igniteChance: 100, ignitePct: 40 };
  for (let t = 0; t <= 20000; t += 100) {
    if (t % 400 === 0) Estados.aplicar(m, ig, 1000, t, SEMPRE);
    dot += Estados.tique(hunt, ev, t);
  }
  assert.ok(dot > 0, 'a queimação causou dano');
  // 400 por queimação em 4 pulsos de 100: ≈100 por segundo, e não mais que isso (sem somar sem limite)
  assert.ok(dot / 20 >= 70 && dot / 20 <= 130, `${(dot / 20).toFixed(0)} por segundo`);
});

test('Ignite: o dano total que sai é no máximo o da maior queimação por duração (não soma sem limite)', () => {
  const m = mob();
  const hunt = { monstros: [m] };
  const ig = { igniteChance: 100, ignitePct: 138 };
  let dot = 0;
  for (let t = 0; t <= 10000; t += 100) {
    for (let k = 0; k < 5; k++) if (t % 500 === 0) Estados.aplicar(m, ig, 1000, t, SEMPRE); // cinco acertos juntos (projéteis/explosão)
    dot += Estados.tique(hunt, [], t);
  }
  // 1380 por queimação em 4 s ≈ 345/s: nunca os 5×
  assert.ok(dot / 10 <= 420, `${(dot / 10).toFixed(0)} por segundo`);
});

test('queimação não continua depois da morte do bicho', () => {
  const m = mob({ hp: 100 });
  const hunt = { monstros: [m] };
  Estados.aplicar(m, { igniteChance: 100, ignitePct: 400 }, 1000, 1000, SEMPRE);
  Estados.tique(hunt, [], 2000);
  assert.ok(m.hp <= 0);
  const antes = m.hp;
  Estados.tique(hunt, [], 3000);
  assert.equal(m.hp, antes, 'morto: sem mais pulsos');
});

test('sem sorteio ganho nada é posto', () => {
  const m = mob();
  assert.deepEqual(Estados.aplicar(m, { congelarChance: 20, atordoarChance: 20 }, 100, 1000, NUNCA), []);
});

test('ativosDe: só os estados ativos agora vão para o cliente (e ficam fora do payload quando não há)', () => {
  const m = mob();
  Estados.aplicar(m, { congelarChance: 100, lentidaoPct: 30, igniteChance: 100, ignitePct: 40 }, 1000, 1000, SEMPRE);
  assert.deepEqual(Estados.ativosDe(m, 1100), ['congelado', 'lento', 'queimando']);
  assert.deepEqual(Estados.ativosDe(m, 2600), ['lento', 'queimando'], 'o congelamento acabou');
  assert.deepEqual(Estados.ativosDe(m, 9000), []);
  assert.deepEqual(Estados.ativosDe(mob(), 0), []);
});

test('o payload da caçada leva os estados ativos do mob (e nada quando não há)', () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 100 });
  assert.ok(Cacadas.entrar(e, { huntId: HUNT_DE_TESTE, mode: 'online' }).ok);
  const h = e.hunt;
  assert.ok(h.monstros.length > 0);
  const [a, b] = h.monstros;
  a.estados = { congelado: { ate: (h.clock ?? 0) + 1000 }, lento: { ate: (h.clock ?? 0) + 1000, pct: 30 } };
  const snap = Cacadas.snapshotDaHunt(e, true);
  const ma = snap.monsters.find((m) => m.uid === a.uid);
  const mb = snap.monsters.find((m) => m.uid === b.uid);
  assert.deepEqual(ma.estados, ['congelado', 'lento']);
  assert.equal(mb.estados, undefined);
});

test('persistência: o estado do mob grava e volta com a caçada (a duração continua no relógio dela)', () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 100 });
  assert.ok(Cacadas.entrar(e, { huntId: HUNT_DE_TESTE, mode: 'auto' }).ok);
  const h = e.hunt;
  const m = h.monstros[0];
  m.estados = { congelado: { ate: 5000 }, controleImuneAte: 8000, lento: { ate: 4000, pct: 30 } };
  const volta = JSON.parse(JSON.stringify(Cacadas.huntParaGravar(h)));
  Cacadas.huntAoCarregar(volta);
  const carregado = volta.monstros.find((x) => x.uid === m.uid);
  assert.deepEqual(carregado.estados, m.estados);
});

test('o balão das gemas (Freeze, Slow, Ignite, Stun) diz a duração e as regras que a config usa', async () => {
  const { readFileSync } = await import('node:fs');
  const fonte = readFileSync(new URL('../frontend/client/src/tooltip.mjs', import.meta.url), 'utf8');
  const s = (ms) => `${ms / 1000}`.replace('.', ',') + ' s';
  const c = CONFIG.estados;
  const linha = (chave) => fonte.split('\n').find((l) => l.trim().startsWith(`${chave}:`) && l.includes("'")) ?? '';
  assert.ok(linha('ignitePct').includes(s(Dot.CONFIG.tipos.queimadura.duracaoMs)), 'Ignite: duração');
  assert.ok(linha('venenoPct').includes(s(Dot.CONFIG.tipos.veneno.duracaoMs)) && linha('venenoPct').includes(`${Dot.CONFIG.tipos.veneno.maxPilhas}×`), 'Poison: duração e pilhas');
  assert.ok(linha('sangramentoPct').includes(s(Dot.CONFIG.tipos.sangramento.duracaoMs)), 'Bleed: duração');
  assert.ok(linha('congelarChance').includes(s(c.congelado.duracao)), 'Freeze: duração');
  assert.ok(linha('congelarChance').includes(s(c.controle.imunidade)), 'Freeze: imunidade');
  assert.ok(linha('lentidaoPct').includes(s(c.lento.duracao)), 'Slow: duração');
  assert.ok(linha('lentidaoPct').includes(`${c.lento.maximo}%`), 'Slow: teto');
  assert.ok(linha('atordoarChance').includes(s(c.atordoado.duracao)), 'Stun: duração');
  assert.match(fonte, new RegExp(`const LENTIDAO_MAXIMA = ${c.lento.maximo};`), 'o balão limita o % da lentidão ao teto');
});
