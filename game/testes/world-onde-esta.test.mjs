// ONDE O PERSONAGEM ESTÁ no mapa da campanha — o nó azul (dono, 10/10: "aqui aparece Ruínas do Santuário azul, mas na verdade tem que marcar
// azul onde o boneco está; no meu caso agora ele está na cidade"). A regra (`world-dados.ondeEstaNoMapa`) e a cidade que o servidor guarda
// (o ato da última fase em que ele caçou — `estado.atoDaCidade`, que vai na campanha da tela).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';

const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no jogo oficial (PoE)';
const { ondeEstaNoMapa, faseDaFronteira } = await import('../frontend/client/src/world-dados.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Campanha = await import('../systems/campanha.mjs');

const ESCOLHIDA = {
  fases: [
    { huntId: 'a1-1', ato: 1, liberada: true, completa: true },
    { huntId: 'a1-2', ato: 1, liberada: true, completa: true },
    { huntId: 'a2-1', ato: 2, liberada: true, completa: true },
    { huntId: 'a2-2', ato: 2, liberada: true, completa: false },
    { huntId: 'a3-1', ato: 3, liberada: false, completa: false },
  ],
  bosses: [{ ato: 1, bossId: 'chefe-1' }, { ato: 2, bossId: 'chefe-2' }],
};

test('o nó azul é onde ele está: a fase em que caça (não a próxima a fazer), o boss da sala, ou a cidade do ato em que estava', () => {
  assert.equal(faseDaFronteira(ESCOLHIDA).huntId, 'a2-2', 'a próxima fase a fazer é outra coisa');
  assert.deepEqual(ondeEstaNoMapa({ huntId: 'a1-1', escolhida: ESCOLHIDA }), { tipo: 'fase', id: 'a1-1', ato: 1 }, 'caçando numa fase velha: ela, não a fronteira');
  assert.deepEqual(ondeEstaNoMapa({ huntId: 'chefe-2', escolhida: ESCOLHIDA }), { tipo: 'boss', id: 'boss:2', ato: 2 });
  // Na cidade: a do ato da última fase em que caçou…
  assert.deepEqual(ondeEstaNoMapa({ huntId: null, escolhida: ESCOLHIDA, atoDaCidade: 1 }), { tipo: 'cidade', id: 'cidade:1', ato: 1 });
  // …sem nenhuma (personagem novo), a do ato da próxima fase.
  assert.deepEqual(ondeEstaNoMapa({ huntId: null, escolhida: ESCOLHIDA }), { tipo: 'cidade', id: 'cidade:2', ato: 2 });
  // Caçando fora da campanha (um mapa do endgame): nenhum nó da campanha fica azul.
  assert.equal(ondeEstaNoMapa({ huntId: 'poe-mapa-3', escolhida: ESCOLHIDA, atoDaCidade: 2 }), null);
});

test('o servidor guarda a cidade: entrar numa fase põe o ato dela; parar mantém (ele volta para aquela cidade); a tela recebe', { skip: SEM }, () => {
  const e = personagemDeTeste({ level: 30 });
  assert.equal(Campanha.paraCliente(e).atoDaCidade, null, 'nunca caçou: a tela usa o ato da próxima fase');
  const fase = Campanha.FASES.find((f) => f.ato === 1);
  assert.ok(Cacadas.entrar(e, { huntId: fase.huntId, mode: 'auto', dificuldade: 'facil' }).ok);
  assert.equal(e.atoDaCidade, 1);
  Cacadas.sair(e);
  assert.equal(e.hunt, null);
  assert.equal(Campanha.paraCliente(e).atoDaCidade, 1, 'na cidade do Ato 1');
  // Gravado e lido (o estado vai inteiro para o banco).
  assert.equal(Campanha.paraCliente(JSON.parse(JSON.stringify(e))).atoDaCidade, 1);
});
