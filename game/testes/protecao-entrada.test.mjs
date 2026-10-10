// A PROTEÇÃO DE ENTRADA num mapa (dono, 10/10: "o jogador não pode começar a caçar nem ficar exposto aos ataques dos monstros antes que
// o mapa esteja pronto para jogar" — `systems/protecao.mjs` + `websocket/sessao.mjs`). Numa sessão de verdade, no relógio do tique: a caçada
// fica PARADA até as duas condições (a tela confirmou o carregamento desta entrada E passou o mínimo); a confirmação é validada; o prazo
// reenvia o mapa e, no fim, devolve à cidade; reconexão, troca de instância e saída do mapa não deixam invulnerável para sempre; e os
// monstros colados na entrada não batem antes da liberação.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { personagemDeTeste, HUNT_DE_TESTE } from './apoio.mjs';
import { Sessao } from '../websocket/sessao.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Protecao from '../systems/protecao.mjs';
import * as R from '../systems/regras.mjs';

const DIF = HUNT_DE_TESTE === 'troll-cave' ? 'medio' : 'facil';
const MINIMO = Protecao.config().minimoMs;
const ESPERA = Protecao.config().esperaMaximaMs;

// O relógio do teste: o tique da sessão e o da caçada leem `Date.now()`.
const relogioReal = Date.now;
let agora = relogioReal();
Date.now = () => agora;
afterEach(() => {
  agora = relogioReal();
});
process.on('exit', () => {
  Date.now = relogioReal;
});

/** Uma sessão (sem banco: o autosave não dispara) com a tela que confirma o carregamento (`carregamento`), ou sem ela. */
function sessao({ carregamento = true, estado = null, nome = 'Protegido' } = {}) {
  const enviados = [];
  const s = new Sessao({ readyState: 1, bufferedAmount: 0, send: (t) => enviados.push(JSON.parse(t)) });
  s.personagem = { id: 0, nome };
  s.estado = estado ?? personagemDeTeste({ level: 60 });
  s.gravadoEm = Infinity;
  if (carregamento) s.receber({ t: 'carregamento', versao: 1 });
  return { s, enviados };
}
const entrarNaCacada = (s) => s.receber({ t: 'startHunt', huntId: HUNT_DE_TESTE, mode: 'auto', dificuldade: DIF });
/** `ms` de jogo, tique a tique (250 ms). */
async function passar(s, ms) {
  for (let t = 0; t < ms; t += R.PASSO_MS) {
    agora += R.PASSO_MS;
    await s.tique();
  }
}
const posicoes = (h) => h.monstros.map((m) => `${m.uid}:${m.x},${m.y}`).join('|');

test('sem o aviso da tela (ferramentas, testes, abas velhas), nada muda: a caçada anda desde o primeiro tique', async () => {
  const { s } = sessao({ carregamento: false });
  entrarNaCacada(s);
  await passar(s, 1000);
  assert.equal(s.protegidoNaEntrada(), false);
  assert.ok(s.estado.hunt.clock >= 750, `o relógio da caçada andou (${s.estado.hunt.clock})`);
});

test('ao entrar, a caçada fica PARADA (relógio, monstros, golpes); a entrada e o mapa vão para a tela, com o escudo de protegido', async () => {
  const { s, enviados } = sessao();
  entrarNaCacada(s);
  const h = s.estado.hunt;
  assert.ok(h?.entrada, 'a caçada nova tem uma entrada');
  const comMapa = enviados.find((m) => m.hunt?.map);
  assert.equal(comMapa?.hunt?.entrada, h.entrada, 'o quadro com o mapa leva a entrada');
  const antes = posicoes(h);
  await passar(s, 5000);
  assert.equal(s.protegidoNaEntrada(), true, 'sem confirmação, segue protegido depois do mínimo');
  assert.equal(h.clock, 0, 'o relógio da caçada não andou');
  assert.equal(posicoes(h), antes, 'nenhum monstro andou');
  assert.equal(enviados.filter((m) => m.hunt).at(-1).hunt.protegido, true, 'a tela mostra o escudo');
});

test('carregamento RÁPIDO: confirmou com 0,5 s → segue protegido até o mínimo; depois, a caçada anda', async () => {
  const { s } = sessao();
  entrarNaCacada(s);
  const h = s.estado.hunt;
  await passar(s, 500);
  s.receber({ t: 'mapaPronto', entrada: h.entrada });
  await passar(s, MINIMO - 1000);
  assert.equal(s.protegidoNaEntrada(), true, `antes de ${MINIMO} ms, não libera só porque carregou`);
  assert.equal(h.clock, 0);
  await passar(s, 1000);
  assert.equal(s.protegidoNaEntrada(), false, 'carregado E o mínimo: liberado');
  // (A liberação caiu dentro deste segundo: o relógio da caçada conta só os tiques depois dela, nada dos 3 s parados.)
  assert.ok(h.clock <= 500, `o relógio recomeça da liberação, sem cobrar o tempo parado (${h.clock})`);
  const liberado = h.clock;
  await passar(s, 1000);
  assert.equal(h.clock - liberado, 1000, 'e daí anda no ritmo de sempre');
});

test('carregamento LENTO: passou o mínimo sem confirmar → continua protegido; confirmou aos 10 s → libera no tique seguinte', async () => {
  const { s } = sessao();
  entrarNaCacada(s);
  const h = s.estado.hunt;
  await passar(s, 10_000);
  assert.equal(s.protegidoNaEntrada(), true, 'o tempo sozinho não libera');
  s.receber({ t: 'mapaPronto', entrada: h.entrada });
  await passar(s, R.PASSO_MS);
  assert.equal(s.protegidoNaEntrada(), false);
});

test('a confirmação é VALIDADA: entrada errada não vale; antes de o mapa ir para esta conexão não vale; depois dele, vale', async () => {
  // A reconexão com a caçada em andamento: a sessão nova ainda não mandou o mapa.
  const estado = personagemDeTeste({ level: 60 });
  assert.ok(Cacadas.entrar(estado, { huntId: HUNT_DE_TESTE, mode: 'auto', dificuldade: DIF }).ok);
  const { s, enviados } = sessao({ estado });
  const entrada = estado.hunt.entrada;
  s.receber({ t: 'mapaPronto', entrada });
  assert.equal(s.protecao.confirmadoEm, null, 'o mapa ainda não foi: a confirmação é recusada');
  s.receber({ t: 'mapaPronto', entrada: 'outra-entrada' });
  assert.equal(s.protecao.confirmadoEm, null);
  // O primeiro tique protegido manda o mapa (a tela antiga não pede).
  await passar(s, R.PASSO_MS);
  assert.ok(enviados.some((m) => m.hunt?.map && m.hunt.entrada === entrada), 'o mapa foi para esta conexão');
  s.receber({ t: 'mapaPronto', entrada: 'outra-entrada' });
  assert.equal(s.protecao.confirmadoEm, null, 'a entrada errada segue recusada');
  s.receber({ t: 'mapaPronto', entrada });
  assert.notEqual(s.protecao.confirmadoEm, null, 'agora vale');
});

test('FALHA de carregamento: aos 30 s o mapa vai de novo (carregarDeNovo); acabadas as tentativas, volta para a cidade com aviso', async () => {
  const { s, enviados } = sessao();
  entrarNaCacada(s);
  const entrada = s.estado.hunt.entrada;
  await passar(s, ESPERA - 500);
  assert.ok(!enviados.some((m) => m.t === 'carregarDeNovo'), 'ainda no prazo');
  const antes = enviados.length;
  await passar(s, 750);
  const reenvio = enviados.slice(antes);
  assert.ok(reenvio.some((m) => m.t === 'carregarDeNovo' && m.entrada === entrada), 'a tela é avisada para carregar de novo');
  assert.ok(reenvio.some((m) => m.hunt?.map), 'e o mapa vai outra vez');
  assert.equal(s.protegidoNaEntrada(), true, 'nada de liberar por causa do prazo');
  await passar(s, ESPERA);
  assert.equal(s.estado.hunt, null, 'sem confirmação depois das tentativas: fora do mapa');
  assert.match(enviados.filter((m) => m.notice).at(-1)?.notice ?? '', /não carregou a tempo/);
  assert.equal(s.protegidoNaEntrada(), false, 'e ninguém fica protegido para sempre');
});

test('monstros COLADOS na entrada: durante a proteção nenhum golpe sai nem fere; liberado, o combate começa', async () => {
  const { s } = sessao();
  entrarNaCacada(s);
  const h = s.estado.hunt;
  // Um bicho imortal na casa ao lado da entrada (os outros, longe).
  const vivo = h.monstros.find((m) => m.hp > 0);
  for (const m of h.monstros) if (m !== vivo) m.hp = 0;
  h.monstros.splice(0, h.monstros.length, vivo);
  vivo.x = h.pos.x + 1;
  vivo.y = h.pos.y;
  vivo.hp = vivo.maxHp = 1e9;
  delete vivo.proximoGolpe;
  const hp = s.estado.hp;
  await passar(s, 6000);
  assert.equal(vivo.proximoGolpe, undefined, 'o bicho não tentou golpe nenhum');
  assert.equal(s.estado.hp, hp, 'nem um ponto de vida');
  s.receber({ t: 'mapaPronto', entrada: h.entrada });
  await passar(s, 3000);
  assert.notEqual(vivo.proximoGolpe, undefined, 'liberado: o bicho ataca');
});

test('RECONEXÃO: a sessão nova protege de novo (a de antes não carrega nada); confirmou e passou o mínimo, a caçada segue', async () => {
  const primeira = sessao();
  entrarNaCacada(primeira.s);
  const h = primeira.s.estado.hunt;
  primeira.s.receber({ t: 'mapaPronto', entrada: h.entrada });
  await passar(primeira.s, MINIMO + 500);
  assert.equal(primeira.s.protegidoNaEntrada(), false);
  await passar(primeira.s, 1000);
  const relogio = h.clock;
  // Cai a conexão; a tela volta numa sessão nova, com o mesmo personagem (a mesma caçada, a mesma entrada).
  const segunda = sessao({ estado: primeira.s.estado });
  await passar(segunda.s, 1000);
  assert.equal(segunda.s.protegidoNaEntrada(), true, 'protegido de novo na volta');
  assert.equal(h.clock, relogio, 'a caçada esperou');
  segunda.s.receber({ t: 'mapaPronto', entrada: h.entrada });
  await passar(segunda.s, MINIMO);
  assert.equal(segunda.s.protegidoNaEntrada(), false);
  await passar(segunda.s, 1000);
  assert.ok(h.clock > relogio, 'a caçada seguiu');
});

test('TROCA DE INSTÂNCIA: entrada nova → protege de novo (o mesmo mapa: a confirmação vale sem mandar o mapa outra vez)', async (t) => {
  const { s, enviados } = sessao();
  entrarNaCacada(s);
  const h = s.estado.hunt;
  s.receber({ t: 'mapaPronto', entrada: h.entrada });
  await passar(s, MINIMO + 500);
  assert.equal(s.protegidoNaEntrada(), false);
  const velha = h.entrada;
  if (!h.instancia) return t.skip('a hunt de teste não é uma instância (o clássico: a Troll Cave renasce)');
  assert.equal(Cacadas.novaInstancia(s.estado), true);
  assert.notEqual(h.entrada, velha, 'a instância nova é outra entrada');
  const antes = enviados.length;
  await passar(s, 1000);
  assert.equal(s.protegidoNaEntrada(), true, 'protegido na instância nova');
  assert.ok(!enviados.slice(antes).some((m) => m.hunt?.map), 'o mapa não vai de novo');
  // A confirmação da instância VELHA não serve.
  s.receber({ t: 'mapaPronto', entrada: velha });
  await passar(s, MINIMO);
  assert.equal(s.protegidoNaEntrada(), true);
  s.receber({ t: 'mapaPronto', entrada: h.entrada });
  await passar(s, R.PASSO_MS);
  assert.equal(s.protegidoNaEntrada(), false);
});

test('SAIR do mapa no meio: a proteção não fica pendurada; entrar de novo começa outra', async () => {
  const { s } = sessao();
  entrarNaCacada(s);
  await passar(s, 1000);
  assert.equal(s.protegidoNaEntrada(), true);
  s.receber({ t: 'stopHunt' });
  await passar(s, R.PASSO_MS);
  assert.equal(s.estado.hunt, null);
  assert.equal(s.protecao, null, 'fora do mapa, nada pendurado');
  s.estado.pos = { ...R.POSICAO_INICIAL };
  entrarNaCacada(s);
  await passar(s, R.PASSO_MS);
  assert.equal(s.protegidoNaEntrada(), true, 'a entrada nova protege desde o começo');
  assert.equal(s.protecao.entrada, s.estado.hunt.entrada);
});

test('sem aba (o char trazido para a party) e o duelo da Arena (que tem a largada dele): sem proteção', async () => {
  const semAba = sessao();
  entrarNaCacada(semAba.s);
  semAba.s.semAba = { desde: Date.now() };
  assert.equal(semAba.s.protecaoDaEntrada(semAba.s.estado.hunt), null);
  const duelo = sessao();
  entrarNaCacada(duelo.s);
  duelo.s.estado.hunt.pvp = { duelo: 1, adversario: 'Outro' };
  assert.equal(duelo.s.protecaoDaEntrada(duelo.s.estado.hunt), null);
});

test('enquanto protegido, a ação da barra na mão é recusada (o mapa ainda carrega)', async () => {
  const { s, enviados } = sessao();
  entrarNaCacada(s);
  await passar(s, R.PASSO_MS);
  s.receber({ t: 'huntAction', slot: 0 });
  assert.match(enviados.findLast((m) => m.t === 'error')?.message ?? '', /mapa ainda está carregando/);
});

test('o ciclo do portal vai para a tela no welcome (a mesma configuração do servidor)', () => {
  const c = Protecao.config();
  assert.deepEqual(Object.keys(c.portal).sort(), ['abertoMs', 'fechamentoMs']);
  assert.equal(c.minimoMs, 3000, 'o mínimo inicial pedido: 3 s');
  // A configuração vem do arquivo e aceita só números válidos.
  assert.deepEqual(Protecao.lerConfig({ minimoMs: -5, esperaMaximaMs: 'x', tentativas: 99, portal: { abertoMs: 1500 } }), { minimoMs: 3000, esperaMaximaMs: 30000, tentativas: 5, portal: { abertoMs: 1500, fechamentoMs: 3000 } });
});
