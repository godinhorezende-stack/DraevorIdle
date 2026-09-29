// "Avançar sozinho" na party: quem completa a fase e tem o "Avançar sozinho" vai para a próxima, e o da
// party que está na mesma sala e TAMBÉM marcou "Avançar sozinho" vai junto. Quem ficou em "Ficar na fase" fica.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import * as B from '../database/banco.mjs';
import { Sessao, vivas } from '../websocket/sessao.mjs';
import * as Party from '../systems/party.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Campanha from '../systems/campanha.mjs';
import * as R from '../systems/regras.mjs';
import { personagemDeTeste } from './apoio.mjs';

const criadas = [];
after(async () => {
  for (const { s, nome, conta } of criadas) {
    s.desconectar();
    vivas.delete(nome);
    await B.db.prepare('DELETE FROM melhorias_da_conta WHERE conta = ?').run(conta);
    await B.db.prepare('DELETE FROM contas WHERE id = ?').run(conta);
  }
});

async function jogador(i, aoCompletar) {
  const conta = await B.criarConta({ email: `avanca-${randomUUID()}@teste.local`, senha: 'senha-123' });
  await B.lerMelhoriasDaConta(conta.id);
  const s = new Sessao({ readyState: 1, bufferedAmount: 0, send: () => {} });
  s.conta = { id: conta.id };
  const nome = `Av${i}${randomUUID().replace(/[^a-z]/g, '').slice(0, 6)}`;
  const e = personagemDeTeste({ vocacao: 'knight', level: 60 });
  e.pos = { ...R.POSICAO_INICIAL };
  e.settings = { ...e.settings, aoCompletarFase: aoCompletar, seguirLider: false };
  await s.concluirEntrada({ id: randomUUID(), nome }, e, null, null);
  criadas.push({ s, nome, conta: conta.id });
  return { s, nome };
}

async function partyNaFase(aoCompletarDele, aoCompletarDoOutro) {
  const [lider, outro] = [await jogador(0, aoCompletarDele), await jogador(1, aoCompletarDoOutro)];
  assert.equal(Party.comandoDoGrupo(lider.s, { action: 'convidar', name: outro.nome }).ok, true);
  assert.equal(Party.comandoDoGrupo(outro.s, { action: 'aceitar' }).ok, true);
  const fase = Campanha.FASES[0];
  assert.equal(Cacadas.entrar(lider.s.estado, { huntId: fase.huntId, mode: 'auto', dificuldade: 'facil' }).ok, true);
  assert.equal(Party.comandoDaCaca(lider.s, { action: 'invite', name: outro.nome }).ok, true);
  assert.equal(Party.comandoDaCaca(outro.s, { action: 'accept' }).ok, true);
  assert.equal(Cacadas.salaDe(lider.s.estado.hunt), Cacadas.salaDe(outro.s.estado.hunt), 'começam na mesma sala');
  return { lider, outro, proxima: Campanha.FASES[1] };
}

test('os dois com "Avançar sozinho": vão JUNTOS para a próxima fase', async () => {
  const { lider, outro, proxima } = await partyNaFase('seguir', 'seguir');
  lider.s.seguirParaAProximaFase();
  assert.equal(lider.s.estado.hunt.huntId, proxima.huntId, 'o líder foi para a próxima');
  assert.equal(outro.s.estado.hunt?.huntId, proxima.huntId, 'o outro foi junto');
  assert.equal(Cacadas.salaDe(lider.s.estado.hunt), Cacadas.salaDe(outro.s.estado.hunt), 'na MESMA sala');
});

test('o outro em "Ficar na fase": o líder avança e ele NÃO vai junto', async () => {
  const { lider, outro, proxima } = await partyNaFase('seguir', 'repetir');
  lider.s.seguirParaAProximaFase();
  assert.equal(lider.s.estado.hunt.huntId, proxima.huntId);
  assert.notEqual(outro.s.estado.hunt?.huntId, proxima.huntId, 'quem ficou em "Ficar na fase" fica na fase dele');
});
