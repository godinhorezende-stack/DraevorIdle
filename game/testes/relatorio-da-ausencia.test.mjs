// O relatório de quem voltou de uma caçada offline: morte e loot são UM relatório só (`welcome.andamento`
// + `welcome.morte`), gravado no personagem até o OK (`ackAusencia`). Reconectar, atualizar ou perder a
// rede antes do OK mostra o mesmo relatório — sem aplicar a morte nem o loot duas vezes.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import * as B from '../database/banco.mjs';
import { Sessao, vivas } from '../websocket/sessao.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as SimulacaoOffline from '../systems/simulacao-offline.mjs';
import { personagemDeTeste, PERSONAGEM } from './apoio.mjs';

const HORA = 3_600_000;
const limpar = [];
after(async () => {
  for (const f of limpar.reverse()) await f();
  SimulacaoOffline.encerrar();
});

async function conta() {
  const c = await B.criarConta({ email: `ausencia-${randomUUID()}@teste.local`, senha: 'senha-123' });
  limpar.push(() => B.db.prepare('DELETE FROM contas WHERE id = ?').run(c.id));
  return c;
}

/** Um personagem caçando que saiu há `horas`. `morre`: sem vida — morre no primeiro golpe. `mexer` ajusta antes de gravar. */
async function personagem(c, { horas = 3, morre = false, mexer } = {}) {
  const e = personagemDeTeste({ vocacao: 'knight', level: morre ? 12 : 200 });
  assert.equal(Cacadas.entrar(e, { huntId: 'troll-cave', mode: 'auto', strategy: 'nearest' }).ok, true);
  if (morre) {
    e.xp = 5e6;
    e.hp = 0; // sem vida: o primeiro tique já encontra o personagem morto
    e.maxHp = 40;
  }
  e.hunt.offlineDesde = Date.now() - horas * HORA;
  mexer?.(e);
  const nome = 'Au' + randomUUID().replace(/[^a-z]/g, '').slice(0, 8);
  const p = await B.criarPersonagem({ conta: c.id, nome, vocacao: 'knight', sexo: 'male', estadoInicial: { ...e, hunt: Cacadas.huntParaGravar(e.hunt) } });
  limpar.push(async () => {
    vivas.get(nome)?.desconectar();
    vivas.delete(nome);
    await B.excluirPersonagem(p.id);
  });
  return nome;
}

async function entrar(c, nome) {
  const recebidas = [];
  const s = new Sessao({ readyState: 1, bufferedAmount: 0, send: (d) => recebidas.push(JSON.parse(d)) });
  s.conta = await B.contaPorId(c.id);
  await s.entrarNoPersonagem({ name: nome });
  return { s, recebidas, welcome: () => recebidas.find((m) => m.t === 'welcome') };
}

const noBanco = async (nome) => JSON.parse((await B.personagemPorNome(nome)).estado);
/** A gravação do relatório é disparada na entrada, sem esperar: espera ela chegar no banco. */
async function esperarNoBanco(nome, pronto) {
  for (let i = 0; i < 100; i++) {
    const e = await noBanco(nome);
    if (pronto(e)) return e;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('o banco não chegou ao estado esperado');
}
const sair = (a) => {
  a.s.desconectar();
  vivas.delete(a.s.personagem?.nome);
};

test('morre offline SEM loot: uma mensagem só, com a morte e as penalidades, gravada até o OK', async () => {
  const c = await conta();
  const nome = await personagem(c, { morre: true });
  const a = await entrar(c, nome);
  const w = a.welcome();
  assert.ok(w.andamento, 'o relatório vem no welcome');
  assert.match(w.andamento.motivo, /morreu caçando enquanto estava fora/);
  assert.ok(w.morte.lost > 0, 'a perda de experiência vem junto, para a mesma janela');
  assert.equal(w.andamento.kills, 0);
  assert.equal(a.recebidas.filter((m) => m.t === 'death' || m.t === 'runReport').length, 0, 'nenhuma segunda mensagem');
  const gravado = await esperarNoBanco(nome, (e) => e.relatorioDaAusencia);
  assert.equal(gravado.relatorioDaAusencia.morte.lost, w.morte.lost);
  assert.equal(gravado.hunt, null, 'a caçada acabou na morte');
  sair(a);
});

test('loot e DEPOIS a morte: o loot de antes da morte está no relatório, e o relatório diz até quando vai', async () => {
  const c = await conta();
  const T = Date.now() - 3 * HORA;
  const nome = await personagem(c, {
    horas: 3,
    mexer: (e) => {
      // 10 min vivo (o servidor consolida em pedaços: acumula loot), depois a vida acaba.
      const parcial = Cacadas.consolidarAusencia(e, PERSONAGEM, T + 10 * 60_000);
      assert.equal(parcial.avancou, true);
      assert.equal(parcial.morreu, false);
      e.level = 12;
      e.xp = 5e6;
      e.hp = 0;
      e.maxHp = 40;
    },
  });
  const a = await entrar(c, nome);
  const w = a.welcome();
  assert.ok(w.morte, 'morreu');
  assert.ok(w.andamento.kills > 0, 'os monstros mortos antes da morte contam');
  assert.ok(Object.keys(w.andamento.itens?.loot ?? {}).length > 0, 'o loot de antes da morte está no relatório');
  assert.ok(w.andamento.minutos >= 9 && w.andamento.minutos < 40, `o relatório vai da saída até a morte (${w.andamento.minutos} min), não até agora`);
  sair(a);
});

test('morre depois de caçada offline LONGA (5 h fora): a morte vale, o período do relatório é o da caçada', async () => {
  const c = await conta();
  const nome = await personagem(c, { horas: 5, morre: true });
  const a = await entrar(c, nome);
  const w = a.welcome();
  assert.ok(w.morte);
  assert.ok(w.andamento.minutos < 300, 'o relatório pára na morte, não conta as 5 h');
  sair(a);
});

test('NÃO morre: o relatório volta com o loot, sem morte, e some depois do OK', async () => {
  const c = await conta();
  const nome = await personagem(c);
  const a = await entrar(c, nome);
  const w = a.welcome();
  assert.ok(w.andamento.kills > 0);
  assert.equal(w.morte, undefined);
  await esperarNoBanco(nome, (e) => e.relatorioDaAusencia);
  a.s.confirmarRelatorioDaAusencia();
  await esperarNoBanco(nome, (e) => !e.relatorioDaAusencia);
  sair(a);
  const b = await entrar(c, nome);
  assert.equal(b.welcome().andamento, undefined, 'depois do OK ele não volta');
  sair(b);
});

test('reconecta ANTES do OK: o mesmo relatório, e a morte e o loot não são aplicados de novo', async () => {
  const c = await conta();
  const nome = await personagem(c, { morre: true });
  const a = await entrar(c, nome);
  const primeiro = a.welcome();
  const xpDepois = a.s.estado.xp;
  const mortes = a.s.estado.totais?.deaths ?? null;
  await esperarNoBanco(nome, (e) => e.relatorioDaAusencia);
  sair(a); // atualizou a página / caiu a rede antes do OK
  const b = await entrar(c, nome);
  const segundo = b.welcome();
  assert.deepEqual(segundo.andamento, primeiro.andamento, 'o mesmo relatório');
  assert.deepEqual(segundo.morte, primeiro.morte, 'com a mesma morte');
  assert.equal(b.s.estado.xp, xpDepois, 'a experiência não foi tirada duas vezes');
  assert.equal(b.s.estado.totais?.deaths ?? null, mortes, 'e a morte não foi contada duas vezes');
  // O OK repetido (duas abas, duplo clique) é inofensivo.
  b.s.confirmarRelatorioDaAusencia();
  b.s.confirmarRelatorioDaAusencia();
  assert.equal(b.s.estado.relatorioDaAusencia, undefined);
  sair(b);
});

test('duas sessões entrando ao mesmo tempo no mesmo personagem: a penalidade e o loot valem UMA vez', async () => {
  const c = await conta();
  const nome = await personagem(c, { morre: true });
  const xp0 = (await noBanco(nome)).xp;
  const [a, b] = await Promise.all([entrar(c, nome), entrar(c, nome)]);
  const donas = [a, b].filter((x) => x.s.personagem && x.welcome());
  assert.ok(donas.length >= 1);
  const e = donas[0].s.estado;
  const perda = donas[0].welcome().morte.lost;
  assert.equal(e.xp, xp0 - perda, 'uma perda só, nunca duas');
  assert.ok(donas.every((x) => x.welcome().morte.lost === perda || !x.welcome().morte));
  sair(a);
  sair(b);
  const final = await esperarNoBanco(nome, (s) => !s.hunt);
  assert.equal(final.xp, xp0 - perda, 'e no banco também');
});

test('relatório pendente não vaza para o cliente dentro do `character`', async () => {
  const c = await conta();
  const nome = await personagem(c);
  const a = await entrar(c, nome);
  assert.ok(!('relatorioDaAusencia' in a.welcome().character), 'o aviso é entregue por andamento/morte, uma vez');
  sair(a);
});
