// O bônus de experiência da Caça Online: `catalog.bonusOnline` (15, do
// original), anunciado na placa da Caça Online e que o servidor nunca cobrava.
// Ver `fatorDaCacaOnline` em `game/systems/hunt/combate.mjs`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Boosts from '../systems/boosts.mjs';
import * as R from '../systems/regras.mjs';
import * as B from '../database/banco.mjs';
import { CATALOGO } from '../systems/dados.mjs';
import { matarMonstro, fatorDaCacaOnline } from '../systems/hunt/combate.mjs';
import { Sessao, vivas } from '../websocket/sessao.mjs';
import { personagemDeTeste, PERSONAGEM } from './apoio.mjs';

const BONUS = CATALOGO.bonusOnline;
let uid = 800_000;

/** Um bicho de `exp` conhecida, com 1 de vida, colado no personagem. */
const bicho = (hunt, exp = 1000, extra = {}) => ({
  uid: ++uid, key: null, name: 'Bicho de Teste', look: 0, x: hunt.pos.x + 1, y: hunt.pos.y, dir: 3,
  hp: 1, maxHp: 1, exp, loot: [], ...extra,
});

/** Um personagem numa caçada, no modo pedido; sem boosts nem premium, nada que mude entre os dois modos. */
function cacando(modo, level = 600) {
  const e = personagemDeTeste({ vocacao: 'knight', level });
  assert.equal(Cacadas.entrar(e, { huntId: 'troll-cave', mode: modo, strategy: 'nearest' }).ok, true);
  e.hunt.monstros = [];
  e.hunt.respawns = [];
  return e;
}

/** A exp que a MESMA morte pagaria na Caça Automática, pela conta de sempre. */
const expAutomatica = (e, base) => Math.round(Boosts.expDoBicho(e, base));

test('a regra existente: o bônus é o `bonusOnline` do catálogo (15%)', () => {
  assert.equal(BONUS, 15);
  assert.equal(fatorDaCacaOnline({ modo: 'online' }), 1.15);
  assert.equal(fatorDaCacaOnline({ modo: 'auto' }), 1);
  assert.equal(fatorDaCacaOnline(null), 1);
});

test('A/C/F. caça online solo: a morte paga a exp base + 15%', () => {
  const e = cacando('online');
  const alvo = bicho(e.hunt);
  e.hunt.monstros.push(alvo);
  const antes = e.xp;
  const eventos = [];
  matarMonstro(e, e.hunt, PERSONAGEM, alvo, eventos);
  const esperado = Math.round(Boosts.expDoBicho(e, 1000) * 1.15);
  assert.equal(e.xp - antes, esperado);
  // E a morte (o evento `kill`, que o client mostra) diz o mesmo número.
  assert.equal(eventos.find((ev) => ev.t === 'kill').exp, esperado);
  assert.ok(esperado > expAutomatica(e, 1000));
});

test('B. caça automática: nenhum bônus online (a XP base não mudou)', () => {
  const e = cacando('auto');
  const alvo = bicho(e.hunt);
  e.hunt.monstros.push(alvo);
  const antes = e.xp;
  matarMonstro(e, e.hunt, PERSONAGEM, alvo, []);
  assert.equal(e.xp - antes, expAutomatica(e, 1000));
});

test('B2. caçada OFFLINE de quem saiu da Caça Online: sem bônus online', () => {
  const e = cacando('online');
  e.hp = e.maxHp = 1e12;
  const agora = Date.now();
  e.hunt.ultimoTique = agora - 60_000;
  e.hunt.offlineDesde = agora - 60_000;
  // Três bichos de 1 de vida colados: a simulação offline mata todos.
  for (let i = 0; i < 3; i++) e.hunt.monstros.push(bicho(e.hunt, 1000, { x: e.hunt.pos.x + (i - 1), y: e.hunt.pos.y + 1 }));
  const xpAntes = e.xp;
  const r = Cacadas.simularAusencia(e, PERSONAGEM, agora);
  assert.ok(r, 'a simulação não rodou');
  const mortes = r.report.kills ?? e.hunt.sessao.kills;
  assert.ok(mortes >= 1, 'nenhum bicho morreu na simulação');
  assert.equal(e.xp - xpAntes, mortes * expAutomatica(e, 1000), 'a exp offline não pode ter o bônus online');
  // E a caçada volta a ser online depois da simulação.
  assert.equal(e.hunt.modo, 'online');
});

test('D. party online: cada membro recebe a parte dele com o bônus do PRÓPRIO modo', () => {
  const dono = cacando('online');
  const online = cacando('online');
  const auto = cacando('auto');
  const membros = [
    { estado: dono, nome: 'Dono' },
    { estado: online, nome: 'Online' },
    { estado: auto, nome: 'Auto' },
  ];
  dono.hunt.partilha = { ativa: true, bonus: 1, membros };
  const alvo = bicho(dono.hunt, 900);
  dono.hunt.monstros.push(alvo);
  const antes = membros.map((m) => m.estado.xp);
  matarMonstro(dono, dono.hunt, { nome: 'Dono' }, alvo, []);
  const parte = 900 / 3;
  const ganho = membros.map((m, i) => m.estado.xp - antes[i]);
  assert.equal(ganho[0], Math.round(Boosts.expDoBicho(dono, parte) * 1.15), 'quem matou');
  assert.equal(ganho[1], Math.round(Boosts.expDoBicho(online, parte) * 1.15), 'membro na Caça Online');
  assert.equal(ganho[2], Math.round(Boosts.expDoBicho(auto, parte)), 'membro na automática: a party de sempre, sem bônus');
});

test('E. vários bichos: cada morte com o bônus, uma vez só', () => {
  const e = cacando('online');
  const antes = e.xp;
  let soma = 0;
  for (const exp of [100, 250, 1000, 20]) {
    const alvo = bicho(e.hunt, exp);
    e.hunt.monstros.push(alvo);
    soma += Math.round(Boosts.expDoBicho(e, exp) * 1.15);
    matarMonstro(e, e.hunt, PERSONAGEM, alvo, []);
  }
  assert.equal(e.xp - antes, soma);
});

test('G/J. pelo tique de verdade: exp, sessão e ficha batem, e o bônus não é aplicado duas vezes', () => {
  const e = cacando('online');
  e.hp = e.maxHp = 1e12;
  const alvo = bicho(e.hunt, 1000);
  e.hunt.monstros.push(alvo);
  e.hunt.alvo = alvo.uid;
  const antes = e.xp;
  let agora = Date.now();
  e.hunt.ultimoTique = agora;
  const eventos = [];
  for (let i = 0; i < 12 && e.hunt.monstros.includes(alvo); i++) {
    agora += R.PASSO_MS;
    eventos.push(...Cacadas.tique(e, PERSONAGEM, agora));
  }
  const kill = eventos.find((ev) => ev.t === 'kill');
  assert.ok(kill, 'o bicho não morreu');
  const esperado = Math.round(Boosts.expDoBicho(e, 1000) * 1.15);
  // Uma vez só: 1,15 e não 1,15 x 1,15.
  assert.equal(kill.exp, esperado);
  assert.equal(e.xp - antes, esperado);
  assert.equal(e.hunt.sessao.exp, esperado, 'o Analisador (session.exp) soma o mesmo');
  assert.equal(e.hunt.sessao.expPorNome[PERSONAGEM.nome], esperado);
  // O level sai da exp nova (subirDeLevel).
  assert.equal(e.level, Math.max(e.level, R.levelFromExp(e.xp)));
});

test('G2. o bônus pode fazer subir de level — pela mesma conta do resto', () => {
  const e = cacando('online', 8);
  const falta = R.expForLevel(9) - e.xp;
  // A menor morte que SEM o bônus não chega no 9, mas COM ele chega.
  let base = 1;
  while (!(Math.round(Boosts.expDoBicho(e, base)) < falta && Math.round(Boosts.expDoBicho(e, base) * 1.15) >= falta)) base++;
  const alvo = bicho(e.hunt, base);
  e.hunt.monstros.push(alvo);
  matarMonstro(e, e.hunt, PERSONAGEM, alvo, []);
  assert.equal(e.level, 9);
  assert.equal(e.level, R.levelFromExp(e.xp));
});

test('H/I. persistência e o que vai ao cliente: a exp com bônus é gravada e é a do `character`', async (t) => {
  const conta = await B.criarConta({ email: `online-${randomUUID()}@teste.local`, senha: 'x' });
  const nome = `Onl${randomUUID().replace(/[^a-z]/g, '').slice(0, 8)}`;
  const inicial = personagemDeTeste({ level: 100 });
  const p = await B.criarPersonagem({ conta: conta.id, nome, vocacao: 'knight', sexo: 'male', estadoInicial: inicial });
  const enviados = [];
  const s = new Sessao({ readyState: 1, send: (texto) => enviados.push(JSON.parse(texto)) });
  s.conta = await B.contaPorId(conta.id);
  await s.receber({ t: 'play', name: nome });
  assert.equal(vivas.get(nome), s);
  t.after(() => {
    s.desconectar();
    B.db.prepare('DELETE FROM personagens WHERE id = ?').run(p.id);
    B.db.prepare('DELETE FROM sessoes WHERE conta = ?').run(conta.id);
    B.db.prepare('DELETE FROM contas WHERE id = ?').run(conta.id);
  });
  await s.receber({ t: 'startHunt', huntId: 'troll-cave', mode: 'online' });
  assert.equal(s.estado.hunt?.modo, 'online');
  s.estado.hunt.monstros = [];
  const alvo = bicho(s.estado.hunt, 500);
  s.estado.hunt.monstros.push(alvo);
  const antes = s.estado.xp;
  const esperado = Math.round(Boosts.expDoBicho(s.estado, 500) * 1.15);
  matarMonstro(s.estado, s.estado.hunt, { nome }, alvo, []);
  assert.equal(s.estado.xp - antes, esperado);
  await s.gravarAgora();
  const gravado = JSON.parse(B.db.prepare('SELECT estado FROM personagens WHERE id = ?').get(p.id).estado);
  assert.equal(gravado.xp, s.estado.xp, 'o banco tem a exp com o bônus');
  enviados.length = 0;
  s.mandarEstado(true); // o quadro inteiro (o de sempre vai por delta)
  const estadoEnviado = enviados.find((m) => m.t === 'state' && m.character);
  assert.ok(estadoEnviado, 'nenhum estado enviado');
  assert.equal(estadoEnviado.character.exp, s.estado.xp, 'o cliente recebe a mesma exp');
});

// ---------------------------------------------------------------- loot
//
// O mesmo `bonusOnline`, no loot: "15% a mais de chance em cada linha do loot"
// (o balão da Caça Online). O sorteio é fixo (`Math.random`) para provar a
// fronteira: 0,55 perde uma linha de 50% na automática e ganha na online
// (50% x 1,15 = 57,5%); 0,58 perde nas duas.

/**
 * Fixa o sorteio SÓ dentro de `matarMonstro` (o loot); o resto do jogo (nascer,
 * andar, a simulação offline) segue com o aleatório de verdade — um
 * `Math.random` constante em tudo prende laços que sorteiam até dar certo.
 */
const aleatorio = Math.random;
function sorteioDoLoot(t, valor) {
  t.mock.method(Math, 'random', () => (new Error().stack.includes('matarMonstro') ? valor : aleatorio()));
}

/** Um bicho com UMA linha de loot (rope, 50%). */
const comUmaLinha = (hunt) => bicho(hunt, 10, { loot: [{ id: 3003, name: 'rope', chance: 0.5 }] });
const ropes = (e) => (e.pouch ?? []).filter((p) => p.id === 3003).reduce((a, p) => a + (p.count ?? 1), 0);

test('loot: a Caça Online dá 15% mais CHANCE em cada linha; a automática não', (t) => {
  for (const [sorteio, esperado] of [
    [0.55, { online: 1, auto: 0 }],
    [0.58, { online: 0, auto: 0 }],
    [0.4, { online: 1, auto: 1 }],
  ]) {
    sorteioDoLoot(t, sorteio);
    for (const modo of ['online', 'auto']) {
      const e = cacando(modo);
      const alvo = comUmaLinha(e.hunt);
      e.hunt.monstros.push(alvo);
      const antes = ropes(e);
      matarMonstro(e, e.hunt, PERSONAGEM, alvo, []);
      assert.equal(ropes(e) - antes, esperado[modo], `sorteio ${sorteio}, ${modo}`);
    }
    t.mock.restoreAll();
  }
});

test('loot: a quantidade de moedas não muda — o bônus é só na chance', (t) => {
  sorteioDoLoot(t, 0.3);
  const ouro = {};
  for (const modo of ['online', 'auto']) {
    const e = cacando(modo);
    const alvo = bicho(e.hunt, 100, { loot: [{ id: 3031, name: 'gold coin', chance: 1 }] });
    e.hunt.monstros.push(alvo);
    const antes = e.gold;
    matarMonstro(e, e.hunt, PERSONAGEM, alvo, []);
    ouro[modo] = e.gold - antes;
  }
  assert.ok(ouro.auto > 0);
  assert.equal(ouro.online, ouro.auto);
});

test('loot na sala do boss (vitória): online 15% mais chance, automática não', (t) => {
  sorteioDoLoot(t, 0.55);
  const sacola = {};
  for (const modo of ['online', 'auto']) {
    const e = cacando(modo);
    e.hunt.isBoss = true;
    const alvo = comUmaLinha(e.hunt);
    e.hunt.monstros.push(alvo);
    matarMonstro(e, e.hunt, PERSONAGEM, alvo, []);
    sacola[modo] = (e.rewards ?? []).flatMap((s) => s.itens).filter((i) => i.id === 3003).length;
  }
  assert.deepEqual(sacola, { online: 1, auto: 0 });
});

test('loot OFFLINE de quem saiu da Caça Online: sem o bônus', (t) => {
  sorteioDoLoot(t, 0.55);
  const e = cacando('online');
  e.hp = e.maxHp = 1e12;
  const agora = Date.now();
  e.hunt.ultimoTique = agora - 60_000;
  e.hunt.offlineDesde = agora - 60_000;
  for (let i = 0; i < 3; i++) e.hunt.monstros.push({ ...comUmaLinha(e.hunt), x: e.hunt.pos.x + (i - 1), y: e.hunt.pos.y + 1 });
  const antes = ropes(e);
  const r = Cacadas.simularAusencia(e, PERSONAGEM, agora);
  assert.ok(r && e.hunt.sessao.kills >= 1, 'nada morreu na simulação');
  assert.equal(ropes(e) - antes, 0, 'offline a chance é a da automática (50% < 0,55)');
});
