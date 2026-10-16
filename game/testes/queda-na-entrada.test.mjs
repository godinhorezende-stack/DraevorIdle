// A conexão que cai NO MEIO da entrada no personagem (`play`). Logo depois de um deploy todo mundo reconecta junto, e quem fechava a aba
// (ou perdia a rede) enquanto a entrada esperava o banco caía em `this.estado` nulo — em produção, 16/10/2026, logo depois do PR #241:
// `sessao play -> Cannot read properties of null (reading 'relatorioDaAusencia')`. A entrada abandonada sai em silêncio: não estoura, não
// deixa sessão "fantasma" em `vivas`, não grava nada a mais — e o relatório da ausência continua no personagem até o OK.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import * as B from '../database/banco.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as SimulacaoOffline from '../systems/simulacao-offline.mjs';
import { Sessao, vivas, estaNoJogo } from '../websocket/sessao.mjs';
import { personagemDeTeste, HUNT_DE_TESTE } from './apoio.mjs';

const HORA = 3_600_000;
const limpar = [];
after(async () => {
  for (const f of limpar.reverse()) await f();
  SimulacaoOffline.encerrar();
});

/*
 * O banco espiado: cada `prepare` é uma consulta (`aoConsultar` vê cada uma — ver `cairNaConsulta`), e cada `run` (uma escrita) fica
 * guardado, para o teste esperar as gravações que o jogo dispara sem `await`.
 */
const prepareDeVerdade = B.banco.prepare;
const espia = { consultas: 0, pendentes: [], gravacoesDePersonagem: 0, aoConsultar: null };
B.banco.prepare = function (sql) {
  espia.consultas++;
  espia.aoConsultar?.(sql, espia.consultas);
  const st = prepareDeVerdade.call(this, sql);
  return {
    get: (...p) => st.get(...p),
    all: (...p) => st.all(...p),
    run: (...p) => {
      if (/^UPDATE personagens SET estado/.test(sql)) espia.gravacoesDePersonagem++;
      const r = st.run(...p);
      espia.pendentes.push(r);
      return r;
    },
  };
};
after(() => {
  B.banco.prepare = prepareDeVerdade;
});

/** Espera as gravações disparadas sem `await` (o relatório, a saída) chegarem ao banco. */
async function escritasNoBanco() {
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setImmediate(r));
    if (!espia.pendentes.length) return;
    await Promise.allSettled(espia.pendentes.splice(0));
  }
}

async function conta() {
  const c = await B.criarConta({ email: `queda-${randomUUID()}@teste.local`, senha: 'senha-123' });
  limpar.push(() => B.db.prepare('DELETE FROM contas WHERE id = ?').run(c.id));
  return B.contaPorId(c.id);
}

async function personagem(c, e) {
  const nome = 'Qd' + randomUUID().replace(/[^a-z]/g, '').slice(0, 8);
  const p = await B.criarPersonagem({ conta: c.id, nome, vocacao: 'knight', sexo: 'male', estadoInicial: e.hunt ? { ...e, hunt: Cacadas.huntParaGravar(e.hunt) } : e });
  limpar.push(async () => {
    for (const s of [...vivas.values()]) if (s.personagem?.nome === nome) s.desconectar();
    vivas.delete(nome);
    await B.excluirPersonagem(p.id);
  });
  return { nome, id: p.id };
}

/** Caçando, saiu há 3 h, sem vida: a caçada offline morre no primeiro tique (o relatório da ausência traz a morte). */
function morreOffline() {
  const e = personagemDeTeste({ vocacao: 'knight', level: 12 });
  assert.equal(Cacadas.entrar(e, { huntId: HUNT_DE_TESTE, mode: 'auto', strategy: 'nearest' }).ok, true);
  e.xp = 5e6;
  e.hp = 0;
  e.maxHp = 40;
  e.hunt.offlineDesde = Date.now() - 3 * HORA;
  return e;
}

const noBanco = (id) => B.db.prepare('SELECT estado FROM personagens WHERE id = ?').get(id).estado;

/** Um socket de mentira: guarda o texto de cada mensagem (o `welcome` leva o catálogo inteiro — só é lido quando o teste pede). */
function sessao(c) {
  const textos = [];
  const ws = { readyState: 1, bufferedAmount: 0, send: (t) => textos.push(t) };
  const s = new Sessao(ws);
  s.conta = c;
  const welcome = () => {
    const t = textos.find((x) => x.startsWith('{"t":"welcome"'));
    return t ? JSON.parse(t) : null;
  };
  return { s, ws, welcome };
}

/** A queda de verdade: o socket fecha (nada mais sai por ele) e o servidor recebe o `close` (`index.mjs` → `desconectar`). */
function cair(x) {
  x.ws.readyState = 3;
  x.s.desconectar();
}

/*
 * A queda chega enquanto a entrada espera a consulta que `qual(sql, n)` escolher (`n`: a n-ésima desde agora). O `close` de verdade vem
 * pelo event loop, nunca no meio de um trecho síncrono: por isso a queda vai numa microtask — antes de a entrada voltar do `await` daquela
 * consulta, e, numa gravação disparada sem `await`, só depois do trecho síncrono em que ela saiu. Devolve `() => caiu`.
 */
function cairNaConsulta(x, qual) {
  const base = espia.consultas;
  let caiu = false;
  espia.aoConsultar = (sql, k) => {
    if (!qual(sql, k - base)) return;
    espia.aoConsultar = null;
    caiu = true;
    queueMicrotask(() => cair(x));
  };
  return () => caiu;
}

/** Sai como quem fecha a aba depois de entrar, e espera a gravação da saída. */
async function sair(x) {
  await x.s.soltarPersonagem();
  x.s.desconectar();
  await escritasNoBanco();
}

/** Roda `fn` guardando o que foi logado como erro (e a exceção dela, se houver). */
async function errosDe(fn) {
  const original = console.error;
  const erros = [];
  console.error = (...a) => erros.push(a.map(String).join(' '));
  try {
    await fn(erros);
  } catch (e) {
    erros.push(e?.stack ?? String(e));
  } finally {
    console.error = original;
  }
  return erros;
}

/** Nada da sessão que caiu ficou no jogo: nem em `vivas`, nem "entrando", nem com o personagem pendurado. */
function semFantasma(x, nome, quando) {
  assert.notEqual(vivas.get(nome), x.s, `${quando}: a sessão que caiu ficou em \`vivas\``);
  assert.equal(estaNoJogo(nome), false, `${quando}: o personagem ficou "no jogo"`);
  assert.equal(x.s.personagem, null, `${quando}: a sessão que caiu ficou com o personagem`);
  assert.equal(x.s.estado, null, `${quando}: a sessão que caiu ficou com o estado`);
}

const RELATORIO = { kills: 12, minutos: 30, motivo: 'Teste: a ausência de antes da queda.' };

test('relatório pendente (voltou sem o OK): a queda em QUALQUER ponto da entrada sai em silêncio, sem gravar, e o relatório fica', async () => {
  const c = await conta();
  const e = personagemDeTeste({ level: 30 });
  e.relatorioDaAusencia = { report: RELATORIO, morte: null, em: Date.now() - 60_000 };
  const { nome, id } = await personagem(c, e);

  // Uma entrada inteira e a saída: aquece os caches (a conta, o ranking) e deixa no banco o estado de quem já entrou uma vez.
  const inteira = sessao(c);
  await inteira.s.entrarNoPersonagem({ name: nome });
  assert.deepEqual(inteira.welcome()?.andamento, RELATORIO, 'o relatório pendente vem no welcome');
  await sair(inteira);

  /*
   * A queda depois de `giros` voltas de microtask: no banco de teste (SQLite) cada `await` da entrada é uma volta, não I/O — então, de 0
   * até a entrada terminar antes da queda, a conexão cai em CADA ponto em que a entrada espera, um por um.
   */
  let abandonadas = 0;
  let chegouAoFim = false;
  for (let giros = 0; giros < 3000 && !chegouAoFim; giros++) {
    const quando = `queda depois de ${giros} voltas`;
    const antes = noBanco(id);
    const gravacoes = espia.gravacoesDePersonagem;
    const x = sessao(c);
    const erros = await errosDe(async () => {
      let terminou = false;
      const entrada = x.s.entrarNoPersonagem({ name: nome }).then(() => {
        terminou = true;
      });
      for (let i = 0; i < giros; i++) await null;
      chegouAoFim = terminou;
      cair(x);
      await entrada;
      await escritasNoBanco();
    });
    assert.deepEqual(erros, [], `${quando}: a entrada estourou`);
    semFantasma(x, nome, quando);
    assert.deepEqual(JSON.parse(noBanco(id)).relatorioDaAusencia?.report, RELATORIO, `${quando}: o relatório saiu do personagem antes do OK`);
    if (!x.welcome()) {
      abandonadas++;
      assert.equal(espia.gravacoesDePersonagem, gravacoes, `${quando}: a entrada abandonada gravou o personagem`);
      assert.equal(noBanco(id), antes, `${quando}: a entrada abandonada mudou o banco`);
    }
  }
  assert.ok(chegouAoFim, 'a entrada nunca terminou antes da queda (ela espera algo além do banco?)');
  assert.ok(abandonadas >= 5, `só ${abandonadas} quedas caíram antes do welcome`);

  // E a volta de verdade: o mesmo relatório, até o OK.
  const volta = sessao(c);
  await volta.s.entrarNoPersonagem({ name: nome });
  assert.deepEqual(volta.welcome()?.andamento, RELATORIO);
  assert.equal(vivas.get(nome), volta.s);
  await sair(volta);
});

test('caçada offline recém-simulada: a queda em cada consulta da entrada não perde o relatório nem grava a ausência pela metade', async () => {
  const c = await conta();
  let quedasAntesDoWelcome = 0;
  for (let n = 1; n < 60; n++) {
    const quando = `queda na consulta ${n}`;
    const { nome, id } = await personagem(c, morreOffline());
    const antes = noBanco(id);
    const gravacoes = espia.gravacoesDePersonagem;
    const x = sessao(c);
    const caiu = cairNaConsulta(x, (_sql, k) => k === n);
    const erros = await errosDe(async () => {
      await x.s.entrarNoPersonagem({ name: nome });
      await escritasNoBanco();
    });
    espia.aoConsultar = null;
    assert.deepEqual(erros, [], `${quando}: a entrada estourou`);
    if (!caiu()) {
      // A entrada inteira fez menos de `n` consultas: todas já foram testadas.
      assert.ok(x.welcome(), 'sem queda, a entrada chega ao welcome');
      await sair(x);
      break;
    }
    semFantasma(x, nome, quando);
    if (!x.welcome()) {
      quedasAntesDoWelcome++;
      assert.equal(espia.gravacoesDePersonagem, gravacoes, `${quando}: a entrada abandonada gravou o personagem`);
      assert.equal(noBanco(id), antes, `${quando}: a entrada abandonada mudou o banco`);
    }
    // A volta: o relatório da ausência (com a morte) aparece — simulado de novo, ou o que ficou gravado até o OK.
    const volta = sessao(c);
    await volta.s.entrarNoPersonagem({ name: nome });
    const w = volta.welcome();
    assert.match(w?.andamento?.motivo ?? '', /morreu caçando enquanto estava fora/, `${quando}: a volta perdeu o relatório da ausência`);
    assert.ok(w.morte?.lost > 0, `${quando}: a volta perdeu a morte do relatório`);
    await sair(volta);
  }
  assert.ok(quedasAntesDoWelcome >= 2, `só ${quedasAntesDoWelcome} quedas caíram antes do welcome`);
});

test('o Mercado já tinha entregado o crédito quando a conexão caiu: o crédito e o relatório ficam no personagem, uma vez só', async () => {
  const c = await conta();
  const { nome, id } = await personagem(c, morreOffline());
  await B.banco.prepare("INSERT INTO creditos (personagem, gold, coins, itens) VALUES (?, 777, 3, '[]')").run(id);
  const { gold: ouro0, coins: coins0 } = JSON.parse(noBanco(id));
  const x = sessao(c);
  // A queda chega enquanto a entrada lê os créditos: quando a leitura volta, o crédito já é do personagem (e sai do banco).
  const caiu = cairNaConsulta(x, (sql) => /FROM creditos/.test(sql));
  const erros = await errosDe(async () => {
    await x.s.entrarNoPersonagem({ name: nome });
    await escritasNoBanco();
  });
  espia.aoConsultar = null;
  assert.deepEqual(erros, []);
  assert.ok(caiu(), 'a entrada leu os créditos');
  semFantasma(x, nome, 'queda na leitura dos créditos');
  assert.equal(x.welcome(), null, 'o socket fechado não recebe nada');
  const restam = await B.banco.prepare('SELECT COUNT(*) AS n FROM creditos WHERE personagem = ?').get(id);
  assert.equal(Number(restam.n), 0, 'o crédito saiu do banco');
  assert.ok(JSON.parse(noBanco(id)).relatorioDaAusencia, 'o relatório foi gravado junto com o crédito');

  // A volta: o mesmo relatório (a morte aplicada uma vez) e o crédito no bolso.
  const volta = sessao(c);
  await volta.s.entrarNoPersonagem({ name: nome });
  const w = volta.welcome();
  assert.match(w.andamento.motivo, /morreu caçando enquanto estava fora/);
  assert.equal(volta.s.estado.coins, coins0 + 3, 'os coins do crédito');
  assert.equal(volta.s.estado.gold, ouro0 + 777 - (w.morte.goldLost ?? 0), 'o ouro do crédito (menos a perda da morte, uma vez)');
  await sair(volta);
});
