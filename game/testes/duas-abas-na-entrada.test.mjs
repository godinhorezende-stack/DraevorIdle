// Duas abas entrando no MESMO personagem. A entrada (`play`) espera o banco em `concluirEntrada` (baú, ranking, créditos do Mercado,
// presentes), e a sessão só entrava em `vivas` depois desses `await`s — mas já tinha saído de `carregandoAgora` (ou nem tinha entrado
// lá, sem caçada offline para simular). Nessa janela ela ficava invisível: a segunda aba não a achava, lia o mesmo estado do banco,
// simulava a mesma ausência, e as duas terminavam vivas com cópias do mesmo personagem (gravando uma por cima da outra, e podendo
// duplicar o que saísse delas). Em produção (Postgres) a janela é de alguns ms por consulta; aqui a consulta é SEGURADA até o teste
// soltar. O certo: a sessão que está entrando fica visível do começo ao fim, a segunda aba ganha (a primeira recebe `released` e não
// grava nada pela metade), e o que a primeira já tinha tirado do banco (o crédito do Mercado) chega à segunda.
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
 * O banco espiado: a consulta escolhida por `segurarNaConsulta` só roda quando o teste soltar (a entrada que a fez fica parada no
 * `await` dela), e cada escrita fica guardada, para o teste esperar as gravações que o jogo dispara sem `await`.
 */
const prepareDeVerdade = B.banco.prepare;
const espia = { pendentes: [], segurar: null };
B.banco.prepare = function (sql) {
  const st = prepareDeVerdade.call(this, sql);
  const rodar = (metodo, p) => {
    const portao = espia.segurar?.(sql);
    return portao ? portao.then(() => st[metodo](...p)) : st[metodo](...p);
  };
  return {
    get: (...p) => rodar('get', p),
    all: (...p) => rodar('all', p),
    run: (...p) => {
      const r = rodar('run', p);
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

/** A PRÓXIMA consulta que `qual(sql)` escolher fica parada até `soltar()`. `segurou()`: ela já chegou lá. */
function segurarNaConsulta(qual) {
  let soltar;
  const portao = new Promise((r) => (soltar = r));
  let segurou = false;
  espia.segurar = (sql) => {
    if (!qual(sql)) return null;
    espia.segurar = null;
    segurou = true;
    return portao;
  };
  return {
    soltar: () => {
      espia.segurar = null;
      soltar();
    },
    segurou: () => segurou,
  };
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
async function esperar(condicao, quando, limite = 20_000) {
  const ate = Date.now() + limite;
  while (!condicao()) {
    if (Date.now() > ate) throw new Error(`esperou demais: ${quando}`);
    await dormir(5);
  }
}

async function conta() {
  const c = await B.criarConta({ email: `duas-abas-${randomUUID()}@teste.local`, senha: 'senha-123' });
  limpar.push(() => B.db.prepare('DELETE FROM contas WHERE id = ?').run(c.id));
  return B.contaPorId(c.id);
}

async function personagem(c, e) {
  const nome = 'Da' + randomUUID().replace(/[^a-z]/g, '').slice(0, 8);
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

const noBanco = (id) => JSON.parse(B.db.prepare('SELECT estado FROM personagens WHERE id = ?').get(id).estado);

/** Uma aba: um socket de mentira que guarda o que recebeu (o `welcome` leva o catálogo inteiro — só é lido quando o teste pede). */
function aba(c) {
  const textos = [];
  const ws = { readyState: 1, bufferedAmount: 0, send: (t) => textos.push(t) };
  const s = new Sessao(ws);
  s.conta = c;
  const recebeu = (t) => textos.some((x) => x.startsWith(`{"t":"${t}"`));
  const welcome = () => {
    const t = textos.find((x) => x.startsWith('{"t":"welcome"'));
    return t ? JSON.parse(t) : null;
  };
  return { s, ws, recebeu, welcome };
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
    await fn();
  } catch (e) {
    erros.push(e?.stack ?? String(e));
  } finally {
    console.error = original;
  }
  return erros;
}

/*
 * A corrida: a aba `a` entra e fica parada na consulta que `qual` escolher (dentro de `concluirEntrada`); a aba `b` manda `play` do
 * mesmo personagem nesse meio-tempo; depois a consulta de `a` é solta e as duas entradas terminam.
 */
async function corrida(c, nome, qual) {
  const a = aba(c);
  const b = aba(c);
  const consulta = segurarNaConsulta(qual);
  let entradaDeA;
  let entradaDeB;
  let visivelEntrando = null;
  const erros = await errosDe(async () => {
    entradaDeA = a.s.entrarNoPersonagem({ name: nome });
    await esperar(consulta.segurou, 'a entrada de `a` chegar à consulta segurada');
    // `a` está no meio da entrada: o personagem está "no jogo" para quem pergunta (a consolidação offline, a outra aba).
    visivelEntrando = estaNoJogo(nome);
    entradaDeB = b.s.entrarNoPersonagem({ name: nome });
    // `b` acha `a` no meio e a solta — ou, sem achar, entra sozinha.
    await esperar(() => a.recebeu('released') || b.welcome(), '`b` achar `a` ou entrar');
    consulta.soltar();
    await Promise.all([entradaDeA, entradaDeB]);
    await escritasNoBanco();
  });
  consulta.soltar();
  return { a, b, erros, visivelEntrando };
}

/** Só `b` (a última a mandar `play`) terminou com o personagem; `a` foi solta e não entrou. */
function soUmaComOPersonagem({ a, b, erros, visivelEntrando }, nome) {
  assert.deepEqual(erros, [], 'a entrada estourou');
  const comOPersonagem = [a, b].filter((x) => x.s.personagem);
  assert.equal(comOPersonagem.length, 1, `${comOPersonagem.length} sessões terminaram com o personagem`);
  assert.equal(visivelEntrando, true, 'a sessão que estava entrando não aparecia como "no jogo"');
  assert.equal(vivas.get(nome), b.s, 'a segunda aba não ficou com o personagem');
  assert.ok(b.welcome(), 'a segunda aba não recebeu o welcome');
  assert.ok(a.recebeu('released'), 'a primeira aba não recebeu `released`');
  assert.equal(a.welcome(), null, 'a primeira aba também entrou');
  assert.equal(a.s.personagem, null);
  assert.equal(a.s.estado, null);
  assert.equal(a.s.carregando, null, 'a primeira aba ficou "entrando"');
  assert.equal(b.s.carregando, null, 'a segunda aba ficou "entrando" depois de entrar');
}

const bauDaConta = (sql) => /FROM bau_da_conta/.test(sql);

test('sem ausência para simular (na cidade): a segunda aba no meio da entrada da primeira fica com o personagem, e só ela', async () => {
  const c = await conta();
  const { nome } = await personagem(c, personagemDeTeste({ level: 30 }));
  const r = await corrida(c, nome, bauDaConta);
  soUmaComOPersonagem(r, nome);
  await sair(r.b);
  assert.equal(estaNoJogo(nome), false);
});

test('caçada offline simulada: a segunda aba no meio da entrada da primeira fica com o personagem e com o relatório da ausência', async () => {
  const c = await conta();
  const { nome, id } = await personagem(c, morreOffline());
  const r = await corrida(c, nome, bauDaConta);
  soUmaComOPersonagem(r, nome);
  const w = r.b.welcome();
  assert.match(w.andamento?.motivo ?? '', /morreu caçando enquanto estava fora/, 'a segunda aba perdeu o relatório da ausência');
  assert.ok(w.morte?.lost > 0, 'a segunda aba perdeu a morte do relatório');
  await sair(r.b);
  // O relatório fica no personagem até o OK — uma vez, o da segunda aba.
  assert.deepEqual(noBanco(id).relatorioDaAusencia?.report?.motivo, w.andamento.motivo);
  assert.equal(estaNoJogo(nome), false);
});

test('a primeira aba já tinha tirado do banco o crédito do Mercado (e ia pegar o presente) quando a segunda chegou: os dois chegam à segunda, uma vez só', async () => {
  const c = await conta();
  const { nome, id } = await personagem(c, morreOffline());
  await B.banco.prepare("INSERT INTO creditos (personagem, gold, coins, itens) VALUES (?, 777, 3, '[]')").run(id);
  await B.banco.prepare("INSERT INTO presentes_entregues (chave, conta, personagem, coins, gold, em, modo) VALUES ('teste-duas-abas', ?, '', 5, 0, ?, 'conta')").run(c.id, Date.now());
  limpar.push(() => B.db.prepare('DELETE FROM presentes_entregues WHERE conta = ?').run(c.id));
  const { gold: ouro0, coins: coins0 } = noBanco(id);
  // `a` para na leitura dos presentes: o crédito do Mercado já saiu do banco e está só no estado que ela carrega.
  const r = await corrida(c, nome, (sql) => /FROM presentes_entregues/.test(sql));
  soUmaComOPersonagem(r, nome);
  const restam = await B.banco.prepare('SELECT COUNT(*) AS n FROM creditos WHERE personagem = ?').get(id);
  assert.equal(Number(restam.n), 0, 'o crédito ficou no banco');
  const presente = await B.banco.prepare('SELECT recebido_por FROM presentes_entregues WHERE conta = ?').get(c.id);
  assert.equal(presente.recebido_por, id, 'o presente não foi reivindicado');
  const w = r.b.welcome();
  assert.match(w.andamento?.motivo ?? '', /morreu caçando enquanto estava fora/, 'a segunda aba perdeu o relatório da ausência');
  assert.equal(r.b.s.estado.coins, coins0 + 3 + 5, 'os coins do crédito e do presente');
  assert.equal(r.b.s.estado.gold, ouro0 + 777 - (w.morte?.goldLost ?? 0), 'o ouro do crédito (menos a perda da morte, uma vez)');
  await sair(r.b);
  assert.equal(noBanco(id).coins, coins0 + 3 + 5, 'os coins do crédito e do presente não ficaram gravados');
});
