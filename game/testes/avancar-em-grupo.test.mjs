// "Avançar sozinho" na party. Quem DECIDE é o LÍDER (dono, 10/10: "em party o avançar tem que funcionar seguindo o líder; se o líder
// marcar avançar, tem que funcionar"): com o "Avançar sozinho" dele ligado, ele avança — mesmo convidado na sala de outro membro — e a
// sala inteira vai junto, com ou sem a marca; na sala do líder, o membro não sai sozinho. Sem o líder na sala, vale a regra de 29/09:
// avança o dono da sala, e vão junto os da sala que também marcaram "Avançar sozinho".
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
import { aAdaptar, soNoOficial } from './apoio-migracao.mjs';

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

test('os dois com "Avançar sozinho": vão JUNTOS para a próxima fase', { skip: aAdaptar("\"Avançar sozinho\" em grupo vale nas áreas do PoE; o teste lê a campanha do Draevor") }, async () => {
  const { lider, outro, proxima } = await partyNaFase('seguir', 'seguir');
  lider.s.seguirParaAProximaFase();
  assert.equal(lider.s.estado.hunt.huntId, proxima.huntId, 'o líder foi para a próxima');
  assert.equal(outro.s.estado.hunt?.huntId, proxima.huntId, 'o outro foi junto');
  assert.equal(Cacadas.salaDe(lider.s.estado.hunt), Cacadas.salaDe(outro.s.estado.hunt), 'na MESMA sala');
});

// (Dono, 10/10: a sala vai com o líder. Antes, quem estava em "Ficar na fase" ficava, e o líder avançava sozinho.)
test('o outro em "Ficar na fase": o líder avança e a sala vai JUNTO (o líder decide)', { skip: aAdaptar("\"Avançar sozinho\" em grupo vale nas áreas do PoE; o teste lê a campanha do Draevor") }, async () => {
  const { lider, outro, proxima } = await partyNaFase('seguir', 'repetir');
  lider.s.seguirParaAProximaFase();
  assert.equal(lider.s.estado.hunt.huntId, proxima.huntId);
  assert.equal(outro.s.estado.hunt?.huntId, proxima.huntId, 'foi junto, mesmo em "Ficar na fase"');
  assert.equal(Cacadas.salaDe(lider.s.estado.hunt), Cacadas.salaDe(outro.s.estado.hunt), 'na MESMA sala');
});

// ---- No jogo oficial (as áreas do PoE): o Ato 1 com a fase 1 feita; a próxima pela numeração é a 2 (A Costa). ----
const F1 = () => Campanha.FASES.find((f) => f.ato === 1 && Campanha.numeroNoAto(f.huntId) === 1);
const F2 = () => Campanha.FASES.find((f) => f.ato === 1 && Campanha.numeroNoAto(f.huntId) === 2);
/** A party no Ato 1 do PoE: `dono` ('lider' ou 'outro') abre a sala da fase 1 (feita pelos dois) e chama o outro. */
async function partyNoAto1(aoLider, aoOutro, dono = 'lider') {
  const [lider, outro] = [await jogador(0, aoLider), await jogador(1, aoOutro)];
  for (const j of [lider, outro]) j.s.estado.campanha = { [Campanha.DIFICULDADES[0]]: { completas: [F1().huntId] } };
  assert.equal(Party.comandoDoGrupo(lider.s, { action: 'convidar', name: outro.nome }).ok, true);
  assert.equal(Party.comandoDoGrupo(outro.s, { action: 'aceitar' }).ok, true);
  const [abre, vem] = dono === 'lider' ? [lider, outro] : [outro, lider];
  const r = Cacadas.entrar(abre.s.estado, { huntId: F1().huntId, mode: 'auto', dificuldade: Campanha.DIFICULDADES[0] });
  assert.equal(r.ok, true, r.erro);
  assert.equal(Party.comandoDaCaca(abre.s, { action: 'invite', name: vem.nome }).ok, true);
  assert.equal(Party.comandoDaCaca(vem.s, { action: 'accept' }).ok, true);
  assert.equal(Cacadas.salaDe(lider.s.estado.hunt), Cacadas.salaDe(outro.s.estado.hunt), 'começam na mesma sala');
  return { lider, outro };
}

test('o líder CONVIDADO na sala de outro, com "Avançar sozinho": avança, e o dono da sala (em "Ficar na fase") vai junto', { skip: soNoOficial('as áreas do Ato 1 do PoE') }, async () => {
  const { lider, outro } = await partyNoAto1('seguir', 'repetir', 'outro');
  assert.notEqual(Cacadas.salaDe(lider.s.estado.hunt), lider.s.estado.hunt, 'o líder é convidado (a sala é do outro)');
  assert.equal(Party.quemDecideOAvancar(lider.s), 'eu');
  assert.equal(Party.quemDecideOAvancar(outro.s), 'lider');
  lider.s.seguirParaAProximaFase();
  assert.equal(lider.s.estado.hunt?.huntId, F2().huntId, 'antes, o "Avançar" do líder convidado não fazia nada');
  assert.equal(outro.s.estado.hunt?.huntId, F2().huntId, 'a sala foi com o líder');
  assert.equal(Cacadas.salaDe(lider.s.estado.hunt), Cacadas.salaDe(outro.s.estado.hunt));
});

test('na sala do líder, o membro com "Avançar sozinho" NÃO sai sozinho (o líder está em "Ficar na fase")', { skip: soNoOficial('as áreas do Ato 1 do PoE') }, async () => {
  const { lider, outro } = await partyNoAto1('repetir', 'seguir', 'outro');
  assert.equal(Cacadas.salaDe(outro.s.estado.hunt), outro.s.estado.hunt, 'a sala é do membro');
  outro.s.seguirParaAProximaFase();
  assert.equal(outro.s.estado.hunt?.huntId, F1().huntId, 'segue a decisão do líder: fica');
  assert.equal(lider.s.estado.hunt?.huntId, F1().huntId);
  lider.s.seguirParaAProximaFase();
  assert.equal(lider.s.estado.hunt?.huntId, F1().huntId, 'o líder em "Ficar na fase": ninguém avança');
});

test('sem o líder na sala (a party caçando separada), o membro com "Avançar sozinho" avança como antes', { skip: soNoOficial('as áreas do Ato 1 do PoE') }, async () => {
  const { lider, outro } = await partyNoAto1('repetir', 'seguir', 'outro');
  Party.antesDeSairDaCacada(lider.s);
  lider.s.estado.hunt = null;
  assert.equal(Party.quemDecideOAvancar(outro.s), null);
  outro.s.seguirParaAProximaFase();
  assert.equal(outro.s.estado.hunt?.huntId, F2().huntId);
});
