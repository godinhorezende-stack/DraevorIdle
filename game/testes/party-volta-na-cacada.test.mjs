// A party caçando junto sobrevive à atualização do servidor (dono, 08/10: "estou numa pt e quando o servidor atualiza meu char vai para
// city; tinha que ter uma tolerância de 2 min para reconectar"):
//   - a caçada de quem está na sala de outro é gravada COM a instância da sala (antes ia sem, e na volta era tomada por uma caçada "de
//     antes das instâncias": a instância se perdia e, com a fase fechada para ele, ia para a cidade);
//   - e só entra na instância de alguém quem tem o caminho até a fase, o ato e a dificuldade liberados (dono, 08/10: "eu só posso entrar na
//     instância de alguém na party se eu tiver a possibilidade do caminho da fase desbloqueada, as act liberada e a dificuldade");
//   - o desligamento espera o banco gravar (`gravarTodosAntesDeSair`);
//   - quem volta em até 2 min entra de novo na sala de quem do grupo já está caçando na mesma área.
import { test, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
// Uma tabela SÓ deste teste (os outros arquivos de teste, em outros processos, também gravam parties no banco compartilhado).
const TABELA = `parties_salvas_v${process.pid}`;
process.env.PARTY_TABELA = TABELA;
const B = await import('../database/banco.mjs');
const { Sessao, vivas, gravarTodosAntesDeSair } = await import('../websocket/sessao.mjs');
const Party = await import('../systems/party.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const R = await import('../systems/regras.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');

const SEM = !existsSync(Catalogo.ARQUIVO) && 'dados do PoE ausentes nesta máquina';
const AREA = 'poe-a1-the-coast'; // a 2ª área do Ato 1: fechada para quem não fez a 1ª
const PRIMEIRA = { facil: { completas: ['poe-a1-the-twilight-strand'] } }; // a 1ª feita: a 2ª liberada

const contas = [];
after(async () => {
  for (const s of [...vivas.values()]) s.desconectar?.();
  for (const c of contas) {
    for (const p of await B.personagensDaConta(c)) await B.db.prepare('DELETE FROM personagens WHERE id = ?').run(p.id);
    await B.db.prepare('DELETE FROM melhorias_da_conta WHERE conta = ?').run(c);
    await B.db.prepare('DELETE FROM contas WHERE id = ?').run(c);
  }
  await B.banco.exec(`DROP TABLE IF EXISTS ${TABELA}`);
});
beforeEach(async () => {
  Party._esquecerParaTeste();
  await B.banco.prepare(`DELETE FROM ${TABELA}`).run();
});

const nomeNovo = (p) => `${p}${randomUUID().replace(/[^a-z]/g, '').slice(0, 7)}`;
/** Um personagem do PoE DE VERDADE no banco (o desligamento grava nele e a volta lê dele), sem progresso na campanha. */
async function criar(prefixo) {
  const c = await B.criarConta({ email: `partyv-${randomUUID()}@teste.local`, senha: 'senha-123' });
  contas.push(c.id);
  await B.gravarMelhoriasDaConta(c.id, { slotsDeParty: 3 });
  await B.lerMelhoriasDaConta(c.id);
  const e = { ...personagemDeTeste({ vocacao: 'knight', level: 30 }), sistema: 'poe', campanha: {}, pos: { ...R.POSICAO_INICIAL } };
  const nome = nomeNovo(prefixo);
  const p = await B.criarPersonagem({ conta: c.id, nome, vocacao: 'knight', sexo: 'male', estadoInicial: e });
  return { conta: c.id, personagem: { id: p.id, nome } };
}
/** Entra no jogo com o estado que está NO BANCO (como a volta depois de um reinício). */
async function entrar(j, recebidas = null) {
  const s = new Sessao({ readyState: 1, bufferedAmount: 0, send: (d) => recebidas?.push(JSON.parse(d)) });
  s.conta = { id: j.conta };
  const linha = await B.banco.prepare('SELECT estado FROM personagens WHERE id = ?').get(j.personagem.id);
  const estado = JSON.parse(linha.estado);
  if (estado.hunt) estado.hunt = Cacadas.huntAoCarregar(estado.hunt);
  await s.concluirEntrada(j.personagem, estado, null, null);
  return s;
}
const lerDoBanco = async (j) => JSON.parse((await B.banco.prepare('SELECT estado FROM personagens WHERE id = ?').get(j.personagem.id)).estado);

/** A (dono da sala, na 2ª área do Ato 1) e B na party, B caçando na sala de A (os dois com a fase liberada). */
async function caçandoJuntos() {
  const a = await criar('Va');
  const b = await criar('Vb');
  const sa = await entrar(a);
  const sb = await entrar(b);
  assert.ok(Party.comandoDoGrupo(sa, { action: 'convidar', name: b.personagem.nome }).ok);
  assert.ok(Party.comandoDoGrupo(sb, { action: 'aceitar' }).ok);
  sa.estado.campanha = structuredClone(PRIMEIRA);
  sb.estado.campanha = structuredClone(PRIMEIRA);
  assert.ok(Cacadas.entrar(sa.estado, { huntId: AREA, mode: 'auto', strategy: 'nearest' }).ok, 'A entrou');
  assert.ok(Party.comandoDaCaca(sa, { action: 'invite', name: b.personagem.nome }).ok);
  assert.ok(Party.comandoDaCaca(sb, { action: 'accept' }).ok, 'B entrou na sala de A');
  assert.equal(Cacadas.salaDe(sb.estado.hunt), sa.estado.hunt);
  assert.equal(sb.estado.hunt.instancia, undefined, 'o convidado lê a instância da sala (não tem a dele)');
  return { a, b, sa, sb };
}

test('a atualização do servidor: os dois voltam caçando (nada de cidade) e o segundo a voltar entra de novo na sala do primeiro', { skip: SEM }, async () => {
  const { a, b, sa } = await caçandoJuntos();
  const instanciaDaSala = sa.estado.hunt.instancia.id;
  // O desligamento (o SIGTERM do deploy): grava todo mundo e a party, e espera o banco.
  await gravarTodosAntesDeSair();
  assert.equal(vivas.size, 0);
  const gravadoB = await lerDoBanco(b);
  assert.equal(gravadoB.hunt?.huntId, AREA, 'B foi gravado caçando');
  assert.ok(gravadoB.hunt.instancia, 'com a instância da sala (antes: sem, e a volta o mandava para a cidade)');
  assert.ok(gravadoB.hunt.offlineDesde > 0);
  assert.ok((await lerDoBanco(a)).hunt?.instancia, 'A também');

  // O servidor sobe de novo: a party volta do banco, com o grupo que caçava junto.
  Party._esquecerParaTeste();
  assert.equal(await Party.carregar(), 1);
  const na = await entrar(a);
  assert.equal(na.estado.hunt?.huntId, AREA, 'A volta caçando');
  const nb = await entrar(b);
  assert.equal(nb.estado.hunt?.huntId, AREA, 'B volta caçando (antes ia para a cidade)');
  assert.equal(Cacadas.salaDe(nb.estado.hunt), na.estado.hunt, 'e de novo na sala de A, sem convite');
  assert.match(nb.avisoPendente ?? '', /voltou para a caçada do grupo com/);
  void instanciaDaSala;
});

test('quem volta depois dos 2 minutos não é puxado (o convite de caçada de sempre refaz a sala); quem volta noutra área também não', { skip: SEM }, async () => {
  const { a, b } = await caçandoJuntos();
  await gravarTodosAntesDeSair();
  Party._esquecerParaTeste();
  await Party.carregar();
  const na = await entrar(a);
  const nb = await entrar(b);
  // (A segunda entrada já puxou B: para provar o prazo, B sai da sala e a conta é feita 3 minutos depois.)
  Cacadas.separar(nb.estado.hunt);
  assert.notEqual(Cacadas.salaDe(nb.estado.hunt), na.estado.hunt);
  assert.equal(Party.voltarParaACacadaJunta(nb, Date.now() + 3 * 60_000), null, 'passou do prazo');
  assert.notEqual(Cacadas.salaDe(nb.estado.hunt), na.estado.hunt);
  // Noutra área: não é puxado.
  nb.estado.hunt.huntId = 'poe-a1-the-twilight-strand';
  assert.equal(Party.voltarParaACacadaJunta(nb), null);
  assert.equal(Party.VOLTA_NA_CACADA_MS, 2 * 60_000);
});

test('na party, só entra na instância de alguém quem tem a fase liberada (o caminho, o ato e a dificuldade) — o amigo não "carrega" mais', { skip: SEM }, async () => {
  const a = await criar('Vc');
  const b = await criar('Vd');
  const sa = await entrar(a);
  const sb = await entrar(b);
  assert.ok(Party.comandoDoGrupo(sa, { action: 'convidar', name: b.personagem.nome }).ok);
  assert.ok(Party.comandoDoGrupo(sb, { action: 'aceitar' }).ok);
  sa.estado.campanha = structuredClone(PRIMEIRA);
  assert.ok(Cacadas.entrar(sa.estado, { huntId: AREA, mode: 'auto', strategy: 'nearest' }).ok);
  // O chamado já é recusado: B não fez a 1ª área, a 2ª está fechada para ele.
  const chamado = Party.comandoDaCaca(sa, { action: 'invite', name: b.personagem.nome });
  assert.equal(chamado.ok, false);
  assert.match(chamado.erro, new RegExp(`${b.personagem.nome} ainda não liberou .*Costa.*Complete`));
  // Chamado com a fase liberada, mas sem ela na hora de aceitar: o aceite também confere.
  sb.estado.campanha = structuredClone(PRIMEIRA);
  assert.ok(Party.comandoDaCaca(sa, { action: 'invite', name: b.personagem.nome }).ok);
  sb.estado.campanha = {};
  const aceite = Party.comandoDaCaca(sb, { action: 'accept' });
  assert.equal(aceite.ok, false);
  assert.match(aceite.erro, /ainda não liberou/);
  assert.ok(!sb.estado.hunt, 'fica onde estava (na cidade)');
  // Com a fase liberada, entra.
  sb.estado.campanha = structuredClone(PRIMEIRA);
  assert.ok(Party.comandoDaCaca(sa, { action: 'invite', name: b.personagem.nome }).ok);
  assert.ok(Party.comandoDaCaca(sb, { action: 'accept' }).ok);
  assert.equal(Cacadas.salaDe(sb.estado.hunt), sa.estado.hunt);
});

test('caçada gravada SEM a instância da sala (de antes desta correção): com a fase liberada, segue na mesma fase numa instância nova', { skip: SEM }, () => {
  const e = { ...personagemDeTeste({ vocacao: 'knight', level: 30 }), sistema: 'poe', campanha: structuredClone(PRIMEIRA) };
  assert.ok(Cacadas.entrar(e, { huntId: AREA, mode: 'auto', strategy: 'nearest' }).ok);
  const gravada = JSON.parse(JSON.stringify(Cacadas.huntParaGravar(e.hunt)));
  delete gravada.instancia;
  const volta = { ...personagemDeTeste({ vocacao: 'knight', level: 30 }), sistema: 'poe', campanha: structuredClone(PRIMEIRA), hunt: Cacadas.huntAoCarregar(gravada) };
  assert.equal(Cacadas.adotarNaCampanha(volta), null, 'sem aviso');
  assert.equal(volta.hunt?.huntId, AREA, 'continua caçando na área');
  assert.equal(volta.hunt.instancia?.status, 'ativa', 'numa instância nova');
  assert.equal(volta.hunt.campanha.dificuldade, gravada.campanha.dificuldade, 'na mesma dificuldade');
});

test('quem volta para a party e para a caçada do grupo recebe o `welcome` antes de qualquer `state` (o client só monta a tela no welcome)', { skip: SEM }, async () => {
  const { a, b } = await caçandoJuntos();
  await gravarTodosAntesDeSair();
  Party._esquecerParaTeste();
  await Party.carregar();
  const deA = [];
  const deB = [];
  await entrar(a, deA);
  const nb = await entrar(b, deB); // volta à party (`entrouNoJogo` atualiza todos) e à sala de A (`juntar`)
  assert.equal(Cacadas.salaDe(nb.estado.hunt).huntId, AREA, 'voltou para a caçada do grupo');
  for (const [quem, lista] of [['A', deA], ['B', deB]]) {
    const tipos = lista.map((m) => m.t);
    const welcome = tipos.indexOf('welcome');
    assert.ok(welcome >= 0, `${quem}: recebeu o welcome`);
    const antes = tipos.slice(0, welcome).filter((t) => t === 'state' || t === 'actionCatalog');
    assert.deepEqual(antes, [], `${quem}: nada de estado antes do welcome (${tipos.slice(0, welcome + 1).join(', ')})`);
  }
  // O aviso da volta segue para o primeiro `state` depois do welcome.
  deB.length = 0;
  nb.mandarEstado();
  assert.match(deB.find((m) => m.t === 'state')?.notice ?? '', /voltou para a caçada do grupo com/);
});
