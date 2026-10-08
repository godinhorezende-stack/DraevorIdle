// A Etapa 3 do combate (dono, 02/10): a defesa no formato Path of Exile — armadura, acerto/evasão (com entropia), bloqueio depois do acerto,
// glancing blow e bloqueio de magia —, cada uma atrás do seu interruptor em `combate/formulas.json` (por padrão a conta de hoje).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as F from '../systems/combate/formulas.mjs';
import * as Limites from '../systems/combate/limites.mjs';
import * as R from '../systems/regras.mjs';
import * as Atributos from '../systems/personagem/atributos.mjs';
import * as Defesa from '../systems/personagem/defesa.mjs';
import * as Ficha from '../systems/ficha.mjs';
import * as Afixos from '../systems/afixos.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import { criarMonstro } from '../systems/hunt/monstros.mjs';
import { contraAtaque } from '../systems/hunt/combate.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import { personagemDeTeste, PERSONAGEM, HUNT_DE_TESTE } from './apoio.mjs';

const P = F.PARAMETROS;
const com = (parte, chave, valor, fn) => {
  const antes = P[parte][chave];
  P[parte][chave] = valor;
  try { return fn(); } finally { P[parte][chave] = antes; }
};

test('por padrão a defesa é a do PoE (decisão do dono, 02/10): armadura, acerto/evasão e bloqueio em \'poe\', sem glancing nem entropia; teto de resistência 75%', () => {
  assert.equal(P.armadura.modo, 'poe');
  assert.equal(P.acerto.modo, 'poe');
  assert.equal(P.acerto.entropia, false);
  assert.equal(P.bloqueio.modo, 'poe');
  assert.equal(P.bloqueio.glancingPct, 0);
  assert.equal(Limites.LIMITES.resistenciaDoJogador.maximo, 75);
  assert.equal(Limites.LIMITES.resistenciaDoMob.maximo, 75);
});

test('armadura no modo PoE: 1.000 contra 500 de dano físico dá 357,14 (sem sorteio); armadura zero não muda; golpe forte reduz menos', () => {
  com('armadura', 'modo', 'poe', () => {
    assert.ok(Math.abs(R.danoRecebido(500, 1000) - 357.142857) < 1e-4);
    assert.equal(R.danoRecebido(500, 0), 500);
    assert.equal(R.danoRecebido(0, 1000), 0);
    assert.equal(R.danoRecebido(500, 1000), R.danoRecebido(500, 1000), 'determinística');
    const fraco = 1 - R.danoRecebido(100, 1000) / 100;
    const forte = 1 - R.danoRecebido(5000, 1000) / 5000;
    assert.ok(fraco > forte, `reduz ${fraco.toFixed(3)} do golpe fraco e ${forte.toFixed(3)} do forte`);
  });
});

test('acerto no modo PoE: o golpe do jogador e a esquiva dele usam a fórmula do PoE (5–95%); sem evasão não esquiva', () => {
  com('acerto', 'modo', 'poe', () => {
    const evBicho = 10 + 2 * 100;
    assert.equal(Atributos.chanceDeAcerto(1000, 100), F.chanceDeAcertoPoe(1000, evBicho));
    assert.ok(Atributos.chanceDeAcerto(0, 100) === 0.05);
    assert.ok(Atributos.chanceDeAcerto(1e9, 100) <= 0.95);
    const precBicho = 10 + 4 * 100;
    assert.ok(Math.abs(Atributos.chanceDeEsquiva(2000, 100) - (1 - F.chanceDeAcertoPoe(precBicho, 2000))) < 1e-12);
    assert.equal(Atributos.chanceDeEsquiva(0, 100), 0);
    assert.ok(Atributos.chanceDeEsquiva(5000, 100) > Atributos.chanceDeEsquiva(500, 100));
  });
});

test('entropia ligada: o acerto do jogador mantém a taxa e guarda os erros seguidos no alvo', () => {
  com('acerto', 'entropia', true, () => {
    const ficha = { accuracy: 600 };
    const hunt = { escala: { nivel: 100 } };
    const alvo = { x: 1, y: 1 };
    let s = 777;
    const original = Math.random;
    Math.random = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    try {
      const chance = Atributos.chanceDeAcerto(600, 100);
      let acertos = 0;
      let maiorErros = 0;
      let seq = 0;
      for (let i = 0; i < 20000; i++) {
        if (Defesa.errou(ficha, hunt, alvo)) maiorErros = Math.max(maiorErros, ++seq);
        else { acertos++; seq = 0; }
      }
      assert.ok(Math.abs(acertos / 20000 - chance) < 0.03, `${acertos / 20000} vs ${chance}`);
      assert.equal(typeof alvo.errosDoJogador, 'number', 'a contagem fica no alvo');
    } finally {
      Math.random = original;
    }
  });
});

test('o bloqueio de magia: a chance da ficha é do add `spell_block`, no teto da magia, e zero sem ele', () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 300 });
  assert.equal(Ficha.combate(e).bloqueioDeMagia, 0);
  const ANEL = Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'might ring').id);
  e.equipment.ring = { id: ANEL, count: 1, af: [{ id: 'spell_block', nivel: 5, value: 20 }] };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.equal(Ficha.combate(e).bloqueioDeMagia, 0.2);
  e.equipment.ring = { id: ANEL, count: 1, af: [{ id: 'spell_block', nivel: 5, value: 300 }] };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.equal(Ficha.combate(e).bloqueioDeMagia, F.bloqueioFinal(3, 'magia'));
});

function golpeDoBicho(af) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 300 });
  const ANEL = Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'might ring').id);
  e.equipment.ring = { id: ANEL, count: 1, af };
  e.maxHp = e.hp = 1e9;
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(Cacadas.entrar(e, { huntId: HUNT_DE_TESTE, mode: 'auto' }).ok);
  const h = e.hunt;
  const m = criarMonstro({ key: 'troll', x: h.pos.x + 1, y: h.pos.y }, null);
  h.monstros.splice(0, h.monstros.length, m);
  const ev = [];
  const original = Math.random;
  // As duas primeiras rolagens são do bloqueio (a faixa e o teste): acontece. As outras, não — só o que o teste quer ver.
  let chamadas = 0;
  Math.random = () => (++chamadas <= 2 ? 0 : 0.999999);
  try { contraAtaque(e, h, PERSONAGEM, m, ev); } finally { Math.random = original; }
  return ev;
}

test('bloqueio: no modo de hoje bloqueia ANTES da esquiva; no modo PoE a esquiva (acerto) vem primeiro e o bloqueio depois', () => {
  const af = [{ id: 'block', nivel: 5, value: 70 }, { id: 'evasion', nivel: 5, value: 5000 }];
  const antes = com('bloqueio', 'modo', 'draevor', () => golpeDoBicho(af).find((x) => x.t === 'block'));
  assert.ok(antes, 'bloqueou');
  assert.equal(antes.esquiva, undefined, 'no modo de antes o bloqueio vem primeiro');
  const depois = com('bloqueio', 'modo', 'poe', () => golpeDoBicho(af).find((x) => x.t === 'block'));
  assert.equal(depois.esquiva, true, 'no modo PoE o golpe foi esquivado antes de chegar ao bloqueio');
});

test('glancing blow: com 40% o golpe bloqueado ainda causa 40% do dano; com 0 o bloqueio anula', () => {
  const af = [{ id: 'block', nivel: 5, value: 70 }];
  const dano = (ev) => ev.filter((x) => x.t === 'dmg' && !x.foe).reduce((n, x) => n + x.v, 0);
  // (No modo 'draevor' o bloqueio é a primeira coisa sorteada — o teste controla as duas rolagens dele.)
  const antes = P.bloqueio.modo;
  P.bloqueio.modo = 'draevor';
  try {
    assert.equal(dano(golpeDoBicho(af)), 0, 'bloqueado: nada');
    const meio = com('bloqueio', 'glancingPct', 40, () => golpeDoBicho(af));
    assert.ok(meio.some((x) => x.t === 'block'), 'ainda mostra o bloqueio');
    assert.ok(dano(meio) > 0, 'e causa dano parcial');
  } finally {
    P.bloqueio.modo = antes;
  }
});
