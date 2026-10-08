// O objetivo da fase vale para a PARTY na sala (dono, 08/10: "só quem mata vence o ato? e se tiver na pt?" — a regra do PoE: o progresso
// da missão vale para quem da party está na instância). Antes só quem dava o golpe final concluía a fase do chefe (o Kraityn, o Kitava no
// Telhado da Catedral, que vence o Ato 5) e ganhava o item da missão; os outros da sala tinham de voltar e matar de novo, sozinhos.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
// Uma tabela de parties SÓ deste teste (os outros arquivos, em outros processos, também gravam parties no banco compartilhado).
process.env.PARTY_TABELA = `parties_salvas_o${process.pid}`;
const B = await import('../database/banco.mjs');
const { Sessao, vivas } = await import('../websocket/sessao.mjs');
const Party = await import('../systems/party.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Campanha = await import('../systems/campanha.mjs');
const Combate = await import('../systems/hunt/combate.mjs');
const Bolsa = await import('../systems/bolsa.mjs');
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const R = await import('../systems/regras.mjs');
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');

const SEM = !existsSync(Catalogo.ARQUIVO) && 'dados do PoE ausentes nesta máquina';
const contas = [];
after(async () => {
  for (const s of [...vivas.values()]) s.desconectar?.();
  for (const c of contas) {
    await B.db.prepare('DELETE FROM melhorias_da_conta WHERE conta = ?').run(c);
    await B.db.prepare('DELETE FROM contas WHERE id = ?').run(c);
  }
  await B.banco.exec(`DROP TABLE IF EXISTS ${process.env.PARTY_TABELA}`);
});

/** Um jogador conectado com a campanha aberta até `huntId` (as fases deste ato e dos anteriores feitas, menos ela; os chefes `bosses` vencidos). */
async function jogador(prefixo, huntId, bosses) {
  const c = await B.criarConta({ email: `partyo-${randomUUID()}@teste.local`, senha: 'senha-123' });
  contas.push(c.id);
  await B.gravarMelhoriasDaConta(c.id, { slotsDeParty: 3 });
  await B.lerMelhoriasDaConta(c.id);
  const s = new Sessao({ readyState: 1, bufferedAmount: 0, send: () => {} });
  s.conta = { id: c.id };
  const nome = `${prefixo}${randomUUID().replace(/[^a-z]/g, '').slice(0, 7)}`;
  const f = Campanha.faseDe(huntId);
  const completas = Campanha.FASES.filter((x) => x.ato <= f.ato && x.huntId !== huntId).map((x) => x.huntId);
  const e = { ...personagemDeTeste({ vocacao: 'knight', level: 60 }), sistema: 'poe', pos: { ...R.POSICAO_INICIAL }, campanha: { facil: { completas, bosses } } };
  Bolsa.garantir(e);
  await s.concluirEntrada({ id: randomUUID(), nome }, e, null, null);
  return { s, nome, e: s.estado };
}

/** A e B na party, B na sala de A em `huntId`, com a partilha que o tique da sessão põe na caçada (`Party.partilha`). */
async function naMesmaSala(huntId, bosses = []) {
  const a = await jogador('Oa', huntId, bosses);
  const b = await jogador('Ob', huntId, bosses);
  assert.ok(Party.comandoDoGrupo(a.s, { action: 'convidar', name: b.nome }).ok);
  assert.ok(Party.comandoDoGrupo(b.s, { action: 'aceitar' }).ok);
  const r = Cacadas.entrar(a.e, { huntId, mode: 'auto', strategy: 'nearest', dificuldade: 'facil' });
  assert.ok(r.ok, r.erro);
  assert.ok(Party.comandoDaCaca(a.s, { action: 'invite', name: b.nome }).ok);
  const aceite = Party.comandoDaCaca(b.s, { action: 'accept' });
  assert.ok(aceite.ok, aceite.erro);
  assert.equal(Cacadas.salaDe(b.e.hunt), a.e.hunt, 'B na sala de A');
  for (const j of [a, b]) Object.defineProperty(j.e.hunt, 'partilha', { value: Party.partilha(j.s), enumerable: false, writable: true, configurable: true });
  return { a, b };
}
const bichos = (e) => [...e.hunt.monstros, ...Object.values(e.hunt.outrosAndares ?? {}).flat()];
const alvoDaFase = (e, huntId) => bichos(e).find((m) => Campanha.ehOMonstro(m.key, Campanha.conclusaoDa(huntId).monstro));

test('Ponte Quebrada: A mata o Kraityn e a fase conclui para os dois da party na sala', { skip: SEM }, async () => {
  const huntId = 'poe-a2-the-broken-bridge';
  const { a, b } = await naMesmaSala(huntId, [1]);
  const kraityn = alvoDaFase(a.e, huntId);
  assert.ok(kraityn, 'o Kraityn nasceu');
  Combate.matarMonstro(a.e, a.e.hunt, PERSONAGEM, kraityn, []);
  assert.equal(Campanha.faseCompleta(a.e, 'facil', huntId), true, 'quem matou');
  assert.equal(Campanha.faseCompleta(b.e, 'facil', huntId), true, 'e o outro da party na sala (antes: só quem matou)');
  assert.match(b.e.avisoDaHunt ?? '', /Fase completa: Ponte Quebrada/, 'o aviso sai na tela dele também');
});

test('Telhado da Catedral: A mata o Kitava e os dois vencem o Ato 5 (o Ato 6 abre para os dois)', { skip: SEM }, async () => {
  const huntId = 'poe-a5-the-cathedral-rooftop';
  const { a, b } = await naMesmaSala(huntId, [1, 2, 3, 4]);
  const kitava = alvoDaFase(a.e, huntId);
  assert.ok(kitava, 'o Kitava nasceu');
  const primeiraDoAto6 = Campanha.FASES.find((f) => f.ato === 6).huntId;
  Combate.matarMonstro(a.e, a.e.hunt, PERSONAGEM, kitava, []);
  for (const [quem, e] of [['A', a.e], ['B', b.e]]) {
    assert.equal(Campanha.faseCompleta(e, 'facil', huntId), true, `${quem}: a fase conclui`);
    assert.equal(Campanha.bossVencido(e, 'facil', 5), true, `${quem}: o Ato 5 vencido`);
    assert.equal(Campanha.faseLiberada(e, 'facil', primeiraDoAto6), true, `${quem}: o Ato 6 abre`);
  }
});

test('Lago Seco: A mata o Voll e cada um da party na sala ganha o PRÓPRIO item da missão (como no PoE)', { skip: SEM }, async () => {
  const huntId = 'poe-a4-the-dried-lake';
  const c = Campanha.conclusaoDa(huntId);
  assert.equal(c.tipo, 'item-de-missao');
  const { a, b } = await naMesmaSala(huntId, [1, 2, 3]);
  const voll = alvoDaFase(a.e, huntId);
  assert.ok(voll, 'o Voll nasceu');
  Combate.matarMonstro(a.e, a.e.hunt, PERSONAGEM, voll, []);
  const temOItem = (e) => [...(e.pouch ?? []), ...(e.inventory ?? [])].some((p) => Number(p.id) === Number(c.item));
  for (const [quem, e] of [['A', a.e], ['B', b.e]]) {
    assert.equal(Campanha.faseCompleta(e, 'facil', huntId), true, `${quem}: a fase conclui`);
    assert.ok(temOItem(e), `${quem}: o item da missão na bolsa dele`);
  }
});

test('quem da party saiu da sala não ganha (o objetivo é de quem está na instância)', { skip: SEM }, async () => {
  const huntId = 'poe-a2-the-broken-bridge';
  const { a, b } = await naMesmaSala(huntId, [1]);
  Cacadas.separar(b.e.hunt);
  assert.notEqual(Cacadas.salaDe(b.e.hunt), a.e.hunt, 'B saiu da sala de A');
  Object.defineProperty(a.e.hunt, 'partilha', { value: Party.partilha(a.s), enumerable: false, writable: true, configurable: true });
  Combate.matarMonstro(a.e, a.e.hunt, PERSONAGEM, alvoDaFase(a.e, huntId), []);
  assert.equal(Campanha.faseCompleta(a.e, 'facil', huntId), true);
  assert.equal(Campanha.faseCompleta(b.e, 'facil', huntId), false, 'B, fora da sala, não conclui');
});
