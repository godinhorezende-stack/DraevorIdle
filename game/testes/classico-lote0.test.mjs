// LOTE 0 da remoção do Draevor clássico (08/11 — o dono: "quero tirar essas coisas do classico", "Tire o 0"): no jogo do PoE os comandos
// dos sistemas clássicos (a Forja de tier e afixos, o Craft, o Desmanche, o Gem Atelier) são recusados sem mexer no personagem, o catálogo
// não leva o drop do Gem Atelier, e o mapa do treino (morto) saiu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';

const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no jogo oficial (PoE)';
const { personagemDeTeste } = await import('./apoio.mjs');
const { Sessao } = await import('../websocket/sessao.mjs');
const Dados = await import('../systems/dados.mjs');

test('no PoE, os comandos dos sistemas clássicos são recusados e o personagem não muda', { skip: SEM }, () => {
  const enviados = [];
  const s = new Sessao({ readyState: 1, send: (t) => enviados.push(JSON.parse(t)) });
  s.personagem = { id: 0, nome: 'SemClassico' };
  s.estado = personagemDeTeste({ level: 30 });
  s.estado.gold = 100000;
  const antes = JSON.stringify(s.estado);
  for (const t of ['forja', 'forjaSubir', 'forjaTransferir', 'craft', 'craftFazer', 'desmanche', 'desmancharPeca', 'forjaAfixos', 'forjaAfixoReroll', 'forjaAfixoFundir', 'gemas']) {
    enviados.length = 0;
    s.receber({ t, slot: 'weapon', action: 'revelar' });
    assert.deepEqual(enviados.map((m) => [m.t, m.message]), [['error', 'Isso não existe no jogo do Path of Exile.']], t);
  }
  assert.equal(JSON.stringify(s.estado), antes);
});

test('no PoE, o catálogo não leva o drop do Gem Atelier; o mapa do treino não é mais carregado', { skip: SEM }, () => {
  assert.equal(Dados.CATALOGO.gemas, null);
  assert.equal('TREINO_MAP' in Dados, false);
});
