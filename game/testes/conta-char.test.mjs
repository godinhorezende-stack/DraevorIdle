// "+ Party", "➜ Hunt" e "⚙ Config" na troca de personagem (`contaChar`): o
// cliente mandava o comando e o servidor não tinha nada para ele — os três
// botões não faziam nada. Aqui, com personagens de verdade no banco.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import * as B from '../database/banco.mjs';
import { Sessao, vivas } from '../websocket/sessao.mjs';
import * as Party from '../systems/party.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as R from '../systems/regras.mjs';
import * as Acoes from '../systems/acoes.mjs';
import { personagemDeTeste } from './apoio.mjs';

const limpar = [];
after(async () => {
  for (const f of limpar.reverse()) await f();
});

const nomeNovo = (p) => `${p}${randomUUID().replace(/[^a-z]/g, '').slice(0, 8)}`;

async function conta({ slots = 0 } = {}) {
  const c = await B.criarConta({ email: `contachar-${randomUUID()}@teste.local`, senha: 'senha-123' });
  if (slots) await B.gravarMelhoriasDaConta(c.id, { slotsDeParty: slots });
  limpar.push(async () => {
    await B.db.prepare('DELETE FROM melhorias_da_conta WHERE conta = ?').run(c.id);
    await B.db.prepare('DELETE FROM contas WHERE id = ?').run(c.id);
  });
  return c;
}

async function char(c, { vocacao = 'knight', level = 60, estado: mexer } = {}) {
  const e = personagemDeTeste({ vocacao, level });
  e.pos = { ...R.POSICAO_INICIAL };
  mexer?.(e);
  const nome = nomeNovo('Cc');
  const p = await B.criarPersonagem({ conta: c.id, nome, vocacao, sexo: 'male', estadoInicial: { ...e, hunt: e.hunt ? Cacadas.huntParaGravar(e.hunt) : null } });
  limpar.push(async () => {
    const s = vivas.get(nome);
    if (s) s.desconectar();
    vivas.delete(nome);
    await B.excluirPersonagem(p.id);
  });
  return nome;
}

/** Uma aba logada na conta, dentro de `nome`. */
async function aba(c, nome) {
  const recebidas = [];
  const s = new Sessao({ readyState: 1, bufferedAmount: 0, send: (d) => recebidas.push(JSON.parse(d)) });
  s.conta = await B.contaPorId(c.id);
  await s.entrarNoPersonagem({ name: nome });
  assert.ok(s.personagem, `entrou em ${nome}`);
  limpar.push(() => s.desconectar());
  return { s, recebidas, ultima: (t) => recebidas.findLast((m) => m.t === t) };
}

const estadoNoBanco = async (nome) => JSON.parse((await B.personagemPorNome(nome)).estado);

test('⚙ Config de um char FORA do mundo: os dados chegam e a mudança vai para o banco', async () => {
  const c = await conta();
  const [eu, outro] = [await char(c), await char(c, { vocacao: 'druid' })];
  const a = await aba(c, eu);

  await a.s.contaChar({ name: outro, op: 'dados' });
  const dados = a.ultima('contaCharDados');
  assert.equal(dados.name, outro);
  assert.equal(dados.character.name, outro);
  assert.ok(dados.catalog?.spells, 'com o catálogo de ações da vocação dele');

  await a.s.contaChar({ name: outro, op: 'cmd', cmd: { t: 'distance', value: 3 } });
  await a.s.contaChar({ name: outro, op: 'cmd', cmd: { t: 'strategy', value: 'lowest' } });
  await a.s.contaChar({ name: outro, op: 'cmd', cmd: { t: 'lure', value: 4 } });
  await a.s.contaChar({ name: outro, op: 'cmd', cmd: { t: 'settings', seguirLider: true } });
  // Uma magia e um slot que a barra dele aceita (cada slot tem o seu papel: ataque, cura...).
  const { magia, slot } = (() => {
    const copia = personagemDeTeste({ vocacao: 'druid', level: 60 });
    for (const m of [...dados.catalog.spells, ...(dados.catalog.runes ?? [])]) {
      for (let slot = 0; slot < 22; slot++) if (Acoes.definir(copia, { slot, value: { id: m.id } }).ok) return { magia: m, slot };
    }
    return {};
  })();
  assert.ok(magia, 'alguma magia cabe em algum slot');
  await a.s.contaChar({ name: outro, op: 'cmd', cmd: { t: 'actions', action: 'set', slot, value: { id: magia.id } } });
  const e = await estadoNoBanco(outro);
  assert.equal(e.settings.distance, 3);
  assert.equal(e.settings.strategy, 'lowest');
  assert.equal(e.settings.lure, 4);
  assert.equal(e.settings.seguirLider, true);
  assert.equal(e.actions[slot]?.id, magia.id, 'a barra de ações também');
  // A resposta traz a configuração nova (a tela não supõe que pegou).
  assert.equal(a.ultima('contaCharDados').character.settings.distance, 3);
  assert.equal(vivas.has(outro), false, 'configurar não traz ninguém para o mundo');

  // Fora da lista: recusado, e nada muda.
  const antes = (await B.personagemPorNome(outro)).estado;
  await a.s.contaChar({ name: outro, op: 'cmd', cmd: { t: 'store', action: 'buy' } });
  assert.match(a.ultima('error').message, /não dá para mudar daqui/);
  assert.equal((await B.personagemPorNome(outro)).estado, antes);
});

test('de outra conta, ou o próprio char: recusado', async () => {
  const c1 = await conta();
  const c2 = await conta();
  const eu = await char(c1);
  const alheio = await char(c2);
  const a = await aba(c1, eu);
  await a.s.contaChar({ name: alheio, op: 'dados' });
  assert.match(a.ultima('error').message, /não é desta conta/);
  await a.s.contaChar({ name: alheio, op: 'party' });
  assert.match(a.ultima('error').message, /não é desta conta/);
  assert.equal(vivas.has(alheio), false);
  await a.s.contaChar({ name: eu, op: 'party' });
  assert.match(a.ultima('error').message, /em que você está/);
});

test('+ Party num char caçando OFFLINE: ele volta ao mundo sem aba, entra na party e sai quando ela acaba', async () => {
  const c = await conta();
  const eu = await char(c, { level: 60 });
  const outro = await char(c, {
    vocacao: 'paladin',
    level: 60,
    estado: (e) => {
      assert.equal(Cacadas.entrar(e, { huntId: 'troll-cave', mode: 'auto' }).ok, true);
      e.hunt.offlineDesde = Date.now() - 20 * 60_000; // caçando offline há 20 min
    },
  });
  const a = await aba(c, eu);
  const xpAntes = (await estadoNoBanco(outro)).xp;

  await a.s.contaChar({ name: outro, op: 'party' });
  const sem = vivas.get(outro);
  assert.ok(sem?.personagem, `está no mundo — ${JSON.stringify(a.recebidas.filter((m) => m.t === 'error'))}`);
  assert.ok(sem.semAba, 'sem aba');
  assert.equal(Party.camposDoPersonagem(a.s).party.membros.length, 2);
  assert.ok(sem.estado.xp > xpAntes, 'a ausência offline foi consolidada ao entrar');
  assert.ok(sem.estado.hunt, 'e segue caçando onde estava');
  assert.equal(sem.estado.hunt.offlineDesde, undefined, 'agora ao vivo');
  const fora = a.ultima('runReport');
  assert.equal(fora?.titulo, `${outro}: enquanto esteve fora`, 'o que ele rendeu offline vem para quem chamou');
  assert.ok(fora.report);
  assert.match(a.recebidas.filter((m) => m.t === 'state').map((m) => JSON.stringify(m)).join(''), /entrou na sua party/);

  // Ele tica sem erro (e não manda quadro para ninguém).
  for (let i = 0; i < 4; i++) await sem.tique();
  assert.ok(vivas.get(outro), 'numa party, fica');

  // A party acaba: no tique seguinte (passada a carência) ele sai como quem fecha a aba.
  Party.comandoDoGrupo(a.s, { action: 'sair' });
  sem.semAba.desde -= 60_000;
  await sem.tique();
  assert.equal(vivas.has(outro), false, 'saiu do mundo');
  await new Promise((r) => setTimeout(r, 50));
  const gravado = await estadoNoBanco(outro);
  assert.ok(gravado.hunt?.offlineDesde > 0, 'e a caçada segue offline');
});

test('➜ Hunt: traz para a party E para a sua caçada; sem caçada, recusa', async () => {
  const c = await conta();
  const eu = await char(c);
  const outro = await char(c, { vocacao: 'sorcerer' });
  const a = await aba(c, eu);

  await a.s.contaChar({ name: outro, op: 'hunt' });
  assert.match(a.ultima('error').message, /Entre numa caçada/);
  assert.equal(vivas.has(outro), false, 'nem foi trazido');

  assert.equal(Cacadas.entrar(a.s.estado, { huntId: 'troll-cave', mode: 'auto' }).ok, true);
  await a.s.contaChar({ name: outro, op: 'hunt' });
  const sem = vivas.get(outro);
  assert.ok(sem?.estado?.hunt, 'está caçando');
  assert.equal(Cacadas.salaDe(sem.estado.hunt), Cacadas.salaDe(a.s.estado.hunt), 'na MINHA sala');
  assert.equal(sem.estado.hunt.monstros, a.s.estado.hunt.monstros, 'com os mesmos bichos');
  assert.equal(Party.partilha(a.s).ativa, true);
  for (let i = 0; i < 6; i++) {
    await a.s.tique();
    await sem.tique();
  }

  // Com ele no mundo, a ⚙ Config vale na hora, na sessão dele.
  await a.s.contaChar({ name: outro, op: 'cmd', cmd: { t: 'distance', value: 4 } });
  assert.equal(sem.estado.hunt.distancia, 4);
  // E os dados trazem a formação da party (quem vai na frente...).
  await a.s.contaChar({ name: outro, op: 'dados' });
  assert.ok(a.ultima('contaCharDados').grupo?.membros?.length === 2);
  await a.s.contaChar({ name: outro, op: 'cmd', cmd: { t: 'party', action: 'coleira', valor: 3 } });
  assert.equal(Party.extrasDoRetrato(sem).party.coleira, 3);

  // Eu saio do jogo: a party acaba, e ele fica com a caçada, offline.
  a.s.soltarPersonagem();
  sem.semAba.desde -= 60_000;
  await sem.tique();
  assert.equal(vivas.has(outro), false);
});

test('o teto de chars da conta vale: sem Slot de party, o terceiro não vem', async () => {
  const c = await conta();
  const eu = await char(c);
  const dois = await char(c, { vocacao: 'druid' });
  const tres = await char(c, { vocacao: 'paladin' });
  const a = await aba(c, eu);
  await a.s.contaChar({ name: dois, op: 'party' });
  assert.ok(vivas.get(dois)?.personagem);
  await a.s.contaChar({ name: tres, op: 'party' });
  assert.match(a.ultima('error').message, /limite é 2/);
  assert.equal(vivas.has(tres), false);
  Party.comandoDoGrupo(a.s, { action: 'sair' });
});

test('com Slots: a conta leva até cinco chars para a mesma party', async () => {
  const c = await conta({ slots: 3 });
  const eu = await char(c);
  const outros = [];
  for (const v of ['druid', 'paladin', 'sorcerer', 'monk']) outros.push(await char(c, { vocacao: v }));
  const sexto = await char(c);
  const a = await aba(c, eu);
  assert.equal(Cacadas.entrar(a.s.estado, { huntId: 'troll-cave', mode: 'auto' }).ok, true);
  for (const o of outros) {
    await a.s.contaChar({ name: o, op: 'hunt' });
    assert.ok(vivas.get(o)?.estado?.hunt, `${o} veio para a caçada`);
  }
  assert.equal(Party.camposDoPersonagem(a.s).party.membros.length, 5);
  const p = Party.partilha(a.s);
  assert.equal(p.membros.length, 5);
  assert.equal(p.bonus, 2, 'cinco vocações diferentes');
  await a.s.contaChar({ name: sexto, op: 'party' });
  assert.match(a.ultima('error').message, /limite é 5/);
  assert.equal(vivas.has(sexto), false);
  for (let i = 0; i < 4; i++) for (const n of [eu, ...outros]) await vivas.get(n)?.tique();
  // Entrar num deles por uma aba: o sem-aba cede o lugar (e sai do relógio).
  const aba2 = await aba(c, outros[0]).catch((e) => e);
  assert.ok(!(aba2 instanceof Error), String(aba2?.message));
  assert.equal(vivas.get(outros[0]), aba2.s, 'agora é a aba quem está nele');
  Party.comandoDoGrupo(a.s, { action: 'sair' });
});

test('➜ Hunt num char que caçava em OUTRO lugar: a caçada dele acaba e o extrato vem para quem chamou', async () => {
  const c = await conta();
  const eu = await char(c);
  const outro = await char(c, {
    vocacao: 'druid',
    estado: (e) => {
      assert.equal(Cacadas.entrar(e, { huntId: 'amazon-camp', mode: 'auto' }).ok, true);
      // Saiu há pouco (sem tempo de morrer offline sem nenhuma magia na barra).
      e.hunt.offlineDesde = Date.now() - 5_000;
    },
  });
  const a = await aba(c, eu);
  assert.equal(Cacadas.entrar(a.s.estado, { huntId: 'troll-cave', mode: 'auto' }).ok, true);
  // Primeiro na party: ele volta ao mundo ainda na caçada dele.
  await a.s.contaChar({ name: outro, op: 'party' });
  const sem = vivas.get(outro);
  assert.equal(sem.estado.hunt?.huntId, 'amazon-camp', 'caçando no lugar dele');
  for (let i = 0; i < 8; i++) await sem.tique();
  await a.s.contaChar({ name: outro, op: 'hunt' });
  assert.equal(Cacadas.salaDe(sem.estado.hunt), Cacadas.salaDe(a.s.estado.hunt), 'veio para a minha');
  const extrato = a.ultima('runReport');
  assert.ok(extrato, 'o extrato chegou para quem chamou');
  assert.equal(extrato.titulo, `Extrato de ${outro}`);
  assert.match(extrato.motivo, /saiu de .+ para vir para a sua caçada/);
  assert.ok(extrato.report, 'com o relatório da caçada que acabou');

  // Chamar de novo quem já está na minha caçada não gera extrato nenhum.
  const antes = a.recebidas.filter((m) => m.t === 'runReport').length;
  await a.s.contaChar({ name: outro, op: 'hunt' });
  assert.equal(a.recebidas.filter((m) => m.t === 'runReport').length, antes);
  Party.comandoDoGrupo(a.s, { action: 'sair' });
});

test('➜ Hunt direto num char caçando offline: UMA janela só, a do que ele rendeu fora', async () => {
  const c = await conta();
  const eu = await char(c);
  const outro = await char(c, {
    vocacao: 'paladin',
    estado: (e) => {
      assert.equal(Cacadas.entrar(e, { huntId: 'troll-cave', mode: 'auto' }).ok, true);
      e.hunt.offlineDesde = Date.now() - 20 * 60_000;
    },
  });
  const a = await aba(c, eu);
  assert.equal(Cacadas.entrar(a.s.estado, { huntId: 'amazon-camp', mode: 'auto' }).ok, true);
  await a.s.contaChar({ name: outro, op: 'hunt' });
  const janelas = a.recebidas.filter((m) => m.t === 'runReport');
  assert.equal(janelas.length, 1);
  assert.equal(janelas[0].titulo, `${outro}: enquanto esteve fora`);
  assert.equal(Cacadas.salaDe(vivas.get(outro).estado.hunt), Cacadas.salaDe(a.s.estado.hunt));
  Party.comandoDoGrupo(a.s, { action: 'sair' });
});
