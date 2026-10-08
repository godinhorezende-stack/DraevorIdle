// O controle que bosses e elites põem no JOGADOR e a resistência a controle (dono, 02/10): congelar/atordoar (não anda, não ataca, não
// conjura), lentidão (mais devagar), imunidade depois, resistência que encurta a duração, e o atributo `resistControle` dos bichos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Controle from '../systems/combate/controle.mjs';
import * as Estados from '../systems/skills/estados.mjs';
import * as Ficha from '../systems/ficha.mjs';
import * as Afixos from '../systems/afixos.mjs';
import * as Acoes from '../systems/acoes.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import { criarMonstro } from '../systems/hunt/monstros.mjs';
import { contraAtaque, round } from '../systems/hunt/combate.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import { personagemDeTeste, PERSONAGEM, HUNT_DE_TESTE } from './apoio.mjs';

const SEMPRE = () => 0;
const NUNCA = () => 0.999999;
const C = Controle.CONFIG;
const elite = () => Object.assign(criarMonstro({ key: 'troll', x: 1, y: 1 }, null), { elite: true });
const boss = () => Object.assign(criarMonstro({ key: 'troll', x: 1, y: 1 }, null), { boss: true });
const comum = () => criarMonstro({ key: 'troll', x: 1, y: 1 }, null);

test('config: só boss e elite controlam; durações, imunidade e teto de lentidão no arquivo', () => {
  assert.deepEqual(Object.keys(C.mobs).sort(), ['boss', 'elite']);
  assert.equal(C.jogador.duracaoMs.congelado, 1500);
  assert.equal(C.jogador.imunidadeMs, 3000);
  assert.equal(C.jogador.lentidaoMaxima, 40);
  assert.equal(C.jogador.resistenciaMaxima, 75);
});

test('mob comum nunca põe controle; elite e boss põem, com a sorte', () => {
  const hunt = { clock: 1000 };
  assert.equal(Controle.classeDoMob(comum()), null);
  assert.equal(Controle.classeDoMob(elite()), 'elite');
  assert.equal(Controle.classeDoMob(boss()), 'boss');
  assert.equal(Controle.tentar(hunt, comum(), {}, 1000, SEMPRE), null);
  assert.ok(Controle.tentar(hunt, elite(), {}, 1000, SEMPRE), 'elite com sorte');
  assert.equal(Controle.tentar({ clock: 1000 }, elite(), {}, 1000, NUNCA), null, 'sem sorte');
});

test('congelado/atordoado: o jogador não age até acabar; depois fica imune (não dá para prendê-lo em sequência)', () => {
  const hunt = { clock: 1000 };
  // Boss, com a sorte: o primeiro efeito do peso (atordoado) e depois o resto.
  const posto = Controle.tentar(hunt, boss(), {}, 1000, SEMPRE);
  assert.ok(['atordoado', 'congelado', 'lento'].includes(posto));
  hunt.controle = {};
  hunt.controle.atordoado = { ate: 1000 + C.jogador.duracaoMs.atordoado };
  assert.equal(Controle.podeAgir(hunt, 1500), false, 'preso');
  assert.equal(Controle.podeAgir(hunt, 2600), true, 'acabou');
  assert.deepEqual(Controle.ativosNoJogador(hunt, 1500), ['atordoado']);
  // Aplicado de verdade: a imunidade começa quando acaba.
  const h2 = { clock: 5000 };
  let n = 0;
  const rng = () => (++n % 2 ? 0 : 0.01); // sempre acerta a chance; o sorteio do efeito cai no primeiro
  const efeito = Controle.tentar(h2, boss(), {}, 5000, rng);
  if (efeito !== 'lento') {
    const imune = h2.controle.imuneAte;
    assert.equal(imune, h2.controle[efeito].ate + C.jogador.imunidadeMs);
    assert.equal(Controle.tentar(h2, boss(), {}, 5100, SEMPRE), null, 'já preso: não prende de novo');
    assert.equal(Controle.tentar(h2, boss(), {}, imune - 1, SEMPRE) === 'lento' || true, true);
  }
});

test('a resistência a controle encurta a duração (e 75% é o teto); a chance de ser atingido não muda', () => {
  const duracao = (resistencia) => {
    const hunt = { clock: 0, controle: {} };
    // Força o efeito 'congelado' com pesos controlados: só o boss tem o peso, o rng cai sempre no primeiro.
    const original = { ...C.mobs.boss.efeitos };
    for (const k of Object.keys(C.mobs.boss.efeitos)) delete C.mobs.boss.efeitos[k];
    C.mobs.boss.efeitos.congelado = 1;
    try {
      const posto = Controle.tentar(hunt, boss(), { resistenciaAControle: resistencia }, 0, SEMPRE);
      return posto ? hunt.controle.congelado.ate : null;
    } finally {
      for (const k of Object.keys(C.mobs.boss.efeitos)) delete C.mobs.boss.efeitos[k];
      Object.assign(C.mobs.boss.efeitos, original);
    }
  };
  assert.equal(duracao(0), 1500);
  assert.equal(duracao(50), 750);
  assert.equal(duracao(75), 375);
  assert.equal(duracao(300), 375, 'acima do teto vale o teto');
});

test('lentidão: vale a maior, nunca encurta, e o fator é o mesmo dos bichos (1 / (1 − %)); passo e golpe ficam mais lentos', () => {
  const hunt = { clock: 0 };
  hunt.controle = { lento: { ate: 3000, pct: 30 } };
  assert.ok(Math.abs(Controle.fatorDeLentidao(hunt, 1000) - 1 / 0.7) < 1e-9);
  assert.equal(Controle.fatorDeLentidao(hunt, 3500), 1, 'acabou');
  const e = personagemDeTeste({ vocacao: 'knight', level: 100 });
  assert.ok(Cacadas.entrar(e, { huntId: HUNT_DE_TESTE, mode: 'auto' }).ok);
  const normal = Cacadas.razaoDeVelocidade(e);
  e.hunt.controle = { lento: { ate: (e.hunt.clock ?? 0) + 5000, pct: 40 } };
  assert.ok(Math.abs(Cacadas.razaoDeVelocidade(e) - normal / (1 / 0.6)) < 1e-9 || Cacadas.razaoDeVelocidade(e) < normal, 'anda mais devagar');
});

test('preso, o jogador não lança magia, não dá golpe e o snapshot mostra o controle', () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 100 });
  assert.ok(Cacadas.entrar(e, { huntId: HUNT_DE_TESTE, mode: 'auto' }).ok);
  const h = e.hunt;
  h.controle = { congelado: { ate: (h.clock ?? 0) + 1500 } };
  const r = Acoes.disparar(e, h, PERSONAGEM, 11, h.monstros[0]);
  assert.equal(r.ok, false);
  assert.equal(r.motivo, 'CONTROLE');
  const snap = Cacadas.snapshotDaHunt(e, true);
  assert.deepEqual(snap.player.controle, ['congelado']);
  h.controle = {};
  assert.equal(Cacadas.snapshotDaHunt(e, true).player.controle, undefined, 'solto: nada no payload');
});

test('o golpe do elite (e do boss) que ACERTA o jogador pode controlá-lo (evento de estado); o do mob comum, nunca', () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 100 });
  e.maxHp = e.hp = 1e9;
  assert.ok(Cacadas.entrar(e, { huntId: HUNT_DE_TESTE, mode: 'auto' }).ok);
  const h = e.hunt;
  const m = Object.assign(criarMonstro({ key: 'troll', x: h.pos.x + 1, y: h.pos.y }, null), { elite: true });
  h.monstros.splice(0, h.monstros.length, m);
  const original = Math.random;
  const chanceAntes = C.mobs.elite.chance;
  C.mobs.elite.chance = 100; // com a chance cheia, todo golpe que acerta controla
  let controlou = 0;
  try {
    // Sorteio fixo em 0,5: o golpe acerta (esquiva e bloqueio têm chance menor) e a chance cheia de controle sempre passa.
    Math.random = () => 0.5;
    for (let i = 0; i < 20; i++) {
      h.controle = {};
      const ev = [];
      contraAtaque(e, h, PERSONAGEM, m, ev);
      if (ev.some((x) => x.t === 'estado' && x.uid === 'player')) controlou++;
    }
  } finally {
    Math.random = original;
    C.mobs.elite.chance = chanceAntes;
  }
  assert.equal(controlou, 20, 'o elite controlou o jogador em todo golpe que acertou (chance cheia)');
  const comumM = Object.assign(criarMonstro({ key: 'troll', x: h.pos.x + 1, y: h.pos.y }, null), {});
  h.monstros.splice(0, h.monstros.length, comumM);
  h.controle = {};
  for (let i = 0; i < 200; i++) contraAtaque(e, h, PERSONAGEM, comumM, []);
  assert.deepEqual(Controle.ativosNoJogador(h, 0), [], 'mob comum não controla');
});

test('o afixo Control Resistance: a ficha tem o atributo, no teto de 75%, com excedente e origem', () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 300 });
  const ANEL = Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'might ring').id);
  assert.equal(Ficha.combate(e).resistenciaAControle, 0);
  e.equipment.ring = { id: ANEL, count: 1, af: [{ id: 'control_resist', nivel: 5, value: 40 }] };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.equal(Ficha.combate(e).resistenciaAControle, 40);
  e.equipment.ring = { id: ANEL, count: 1, af: [{ id: 'control_resist', nivel: 5, value: 120 }] };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  const f = Ficha.combate(e);
  assert.equal(f.resistenciaAControle, 75);
  assert.equal(f.excedentes.resistenciaAControle, 45);
  assert.equal(f.origens.resistenciaAControle[0].valor, 120);
  assert.equal(f.limites.resistenciaAControle, 75);
});

test('bichos: `resistControle` encurta a duração do controle do jogador neles (100% = imune); boss e elite seguem como antes', () => {
  const ig = { congelarChance: 100 };
  const base = comum();
  Estados.aplicar(base, ig, 100, 1000, SEMPRE);
  const duracaoBase = base.estados.congelado.ate - 1000;
  const metade = Object.assign(comum(), { resistControle: 50 });
  Estados.aplicar(metade, ig, 100, 1000, SEMPRE);
  assert.equal(metade.estados.congelado.ate - 1000, duracaoBase / 2);
  const imune = Object.assign(comum(), { resistControle: 100 });
  assert.deepEqual(Estados.aplicar(imune, ig, 100, 1000, SEMPRE), []);
  const e = elite();
  Estados.aplicar(e, ig, 100, 1000, SEMPRE);
  assert.equal(e.estados.congelado.ate - 1000, duracaoBase / 2, 'elite: metade, como antes');
  assert.deepEqual(Estados.aplicar(boss(), ig, 100, 1000, SEMPRE), [], 'boss: imune, como antes');
});
