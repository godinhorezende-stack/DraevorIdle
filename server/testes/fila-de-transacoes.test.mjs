// Fase 6: a fila global de transações (`emTransacao`, nucleo/sessao.mjs) tem
// de impedir que DUAS transações — de sessões diferentes — rodem ao mesmo
// tempo. Antes do banco virar assíncrono isso vinha de graça (nada mais roda
// no meio de um trecho síncrono); agora precisa de uma fila de verdade.
//
// O teste força a race: duas "transações" que fazem ler → esperar um tique →
// escrever a partir do que leram (um saldo compartilhado). Sem fila, as duas
// leem o saldo ANTES de qualquer uma escrever, e uma sobrescreve a outra
// (perde um incremento — o bug clássico de corrida). Com fila, elas nunca se
// sobrepõem: o resultado é sempre a soma dos dois incrementos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sessao } from '../nucleo/sessao.mjs';

function sessaoDeTeste() {
  const s = new Sessao({ readyState: 1, send() {} });
  s.conta = { id: 'teste-fila' };
  s.personagem = { id: 0, nome: 'FilaTeste' };
  s.estado = { pos: { x: 100, y: 100, z: 7 } };
  s.gravarAgora = () => {}; // não é o alvo deste teste — só a exclusão mútua
  return s;
}

test('emTransacao serializa: duas transações concorrentes não se intercalam (sem perder incremento)', async () => {
  let saldo = 0;
  const passos = []; // registra a ORDEM de entrada/saída de cada transação

  async function incrementar(s, nome) {
    return s.emTransacao(async () => {
      passos.push(`${nome}:entrou`);
      const lido = saldo;
      // A espera no meio é o ponto onde uma corrida de verdade apareceria —
      // sem fila, a OUTRA transação leria `saldo` antes desta escrever.
      await new Promise((r) => setTimeout(r, 20));
      saldo = lido + 1;
      passos.push(`${nome}:saiu`);
    });
  }

  const a = sessaoDeTeste();
  const b = sessaoDeTeste();
  await Promise.all([incrementar(a, 'A'), incrementar(b, 'B')]);

  assert.equal(saldo, 2, 'as duas transações têm de contar — perder uma é o bug de corrida');
  // Uma transação sai (COMMIT) antes da outra ENTRAR — nunca as duas "entrou" seguidas.
  const entrouSeguido = passos[0].endsWith('entrou') && passos[1].endsWith('entrou');
  assert.ok(!entrouSeguido, `transações se intercalaram: ${passos.join(', ')}`);
});

test('uma transação que lança erro não trava a fila para as próximas', async () => {
  const a = sessaoDeTeste();
  const b = sessaoDeTeste();
  await assert.rejects(a.emTransacao(async () => { throw new Error('falha de propósito'); }));
  // Se a fila tivesse travado, isto nunca resolveria — o teste "pendura" (timeout).
  let rodou = false;
  await b.emTransacao(async () => { rodou = true; });
  assert.ok(rodou);
});

test('reentrância: um comando dentro de outra transação (mesma sessão) não tenta abrir uma segunda', async () => {
  const a = sessaoDeTeste();
  let internoRodou = false;
  await a.emTransacao(async () => {
    // Chamar emTransacao de novo, na MESMA sessão, no meio de uma transação em
    // andamento, tem de só rodar a função — não pode esperar a fila (ela
    // mesma é quem está segurando a vez) nem abrir um 2º BEGIN.
    await a.emTransacao(async () => {
      internoRodou = true;
    });
  });
  assert.ok(internoRodou);
});
