// Regeneração e stamina na cidade: uma vez por segundo, não a cada tique
// (250 ms) — são só matemática proporcional ao tempo, então o total ao longo
// de vários segundos tem de ser EXATAMENTE o mesmo de antes, só que calculado
// em menos chamadas. `Exercicio.tique` continua a cada tique (o efeito de
// cada golpe no boneco não pode ficar represado 1s).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sessao } from '../../game/websocket/sessao.mjs';
import * as Cacadas from '../../game/systems/cacadas.mjs';
import * as Stamina from '../../game/systems/stamina.mjs';
import * as R from '../../game/systems/regras.mjs';
import { personagemDeTeste } from './apoio.mjs';

/** Uma sessão na cidade (sem hunt), com hp/mana/stamina longe do teto para o regen ter o que fazer. */
function sessaoNaCidade() {
  const s = new Sessao({ readyState: 1, send() {} });
  s.conta = { id: 'teste-do-regen' };
  s.personagem = { id: 0, nome: 'Regen' };
  s.estado = personagemDeTeste({ vocacao: 'knight', level: 200 });
  s.estado.pos = { ...R.POSICAO_INICIAL };
  s.estado.hp = Math.floor(s.estado.maxHp / 2);
  s.estado.mana = Math.floor(s.estado.maxMana / 2);
  s.estado.stamina = 0;
  return s;
}

/**
 * Roda `s.tique()` a cada `dt` de `intervalos`, com Date.now() controlado —
 * UM relógio só, do primeiro ao último intervalo (`rodar` não pode ser
 * chamado várias vezes na mesma sessão: cada chamada reinicia o relógio no
 * "agora" de verdade, e o represamento de 1s do regen depende de continuar
 * de onde parou). `aCada`, se dado, é chamado depois de cada tique com o
 * `agora` relativo (desde o início desta chamada) e o estado.
 */
function rodar(s, intervalos, aCada = null) {
  const original = Date.now;
  let agora = original();
  const inicio = agora;
  Date.now = () => agora;
  try {
    for (const dt of intervalos) {
      agora += dt;
      s.tique();
      aCada?.(agora - inicio, s.estado);
    }
  } finally {
    Date.now = original;
  }
}

test('não regenera antes de 1s (desde o 1º tique, que só estabelece a janela), regenera ao completar', () => {
  const s = sessaoNaCidade();
  let hpNoPrimeiro = null;
  const vistos = [];
  // 5 tiques de 250ms: o 1º estabelece o início da janela de 1s (sem
  // regenerar); 1000ms de NOVO elapsed só se completam no 5º.
  rodar(s, [250, 250, 250, 250, 250], (relativo, estado) => {
    if (relativo === 250) hpNoPrimeiro = estado.hp;
    vistos.push(estado.hp);
  });
  assert.equal(vistos[1], hpNoPrimeiro, 'regenerou em +500ms (desde a janela)');
  assert.equal(vistos[2], hpNoPrimeiro, 'regenerou em +750ms (desde a janela)');
  assert.equal(vistos[3], hpNoPrimeiro, 'regenerou em +1000ms — represado errado, um tique cedo demais');
  assert.ok(vistos[4] > hpNoPrimeiro, 'não regenerou em +1250ms (1000ms desde a janela)');
});

test('o total ao longo de 4s é o MESMO de chamar Cacadas.regenerar/Stamina.recuperar direto', () => {
  const s = sessaoNaCidade();
  const comparar = personagemDeTeste({ vocacao: 'knight', level: 200 });
  comparar.hp = s.estado.hp;
  comparar.mana = s.estado.mana;
  comparar.maxHp = s.estado.maxHp;
  comparar.maxMana = s.estado.maxMana;
  comparar.stamina = s.estado.stamina;
  comparar.equipment = s.estado.equipment;
  comparar.outfit = s.estado.outfit;

  // O 1º tique só estabelece a janela (sem regenerar) — o cálculo de
  // comparação usa os mesmos ms que os tiques SEGUINTES somam (4000ms: 16
  // tiques de 250ms, com o mesmo jitter 249/251 que testes/andar.test.mjs
  // já usa para o relógio de verdade).
  const intervalos = [250, ...Array.from({ length: 16 }, (_, i) => (i % 2 ? 251 : 249))];
  rodar(s, intervalos);
  Cacadas.regenerar(comparar, intervalos.slice(1).reduce((a, b) => a + b, 0));
  Stamina.recuperar(comparar, intervalos.slice(1).reduce((a, b) => a + b, 0));

  assert.equal(s.estado.hp, comparar.hp, 'hp final diferente do cálculo direto');
  assert.equal(s.estado.mana, comparar.mana, 'mana final diferente do cálculo direto');
  assert.ok(Math.abs(s.estado.stamina - comparar.stamina) < 1e-9, 'stamina final diferente do cálculo direto');
});

test('regen ao longo de 3s (depois da janela) não perde nem dobra o resto fracionário', () => {
  // Chamar Cacadas.regenerar 1x com 3000ms tem de dar o MESMO resultado que
  // os tiques (depois do 1º, que só estabelece a janela) passando pelo
  // represamento de 1s — é o mesmo `regenResto` dos dois lados.
  const s = sessaoNaCidade();
  s.estado.hp = 1;
  s.estado.mana = 1;

  const a = personagemDeTeste({ vocacao: 'knight', level: 200 });
  a.hp = 1;
  a.mana = 1;
  a.equipment = s.estado.equipment;
  Cacadas.regenerar(a, 3000);

  rodar(s, [250, ...Array.from({ length: 12 }, () => 250)]);
  assert.equal(s.estado.hp, a.hp);
  assert.equal(s.estado.mana, a.mana);
});
