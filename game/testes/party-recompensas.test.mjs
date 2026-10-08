// As regras de recompensa da party (`systems/party-recompensas.mjs` + `matarMonstro`): XP por peso de nível, sorteio de item e ouro.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import * as B from '../database/banco.mjs';
import { Sessao, vivas } from '../websocket/sessao.mjs';
import * as Party from '../systems/party.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as R from '../systems/regras.mjs';
import * as Combate from '../systems/hunt/combate.mjs';
import * as PR from '../systems/party-recompensas.mjs';
import * as Boosts from '../systems/boosts.mjs';
import { VALOR_DA_MOEDA } from '../systems/inventario.mjs';
import { personagemDeTeste, HUNT_DE_TESTE } from './apoio.mjs';
import { aAdaptar } from './apoio-migracao.mjs';
// (C, docs/migracao-poe-matriz.md: a divisão da party não depende da dificuldade; no jogo oficial só o Normal existe — o Cruel não abre.)
const DIF_DE_TESTE = HUNT_DE_TESTE === 'troll-cave' ? 'medio' : 'facil';

const criadas = [];
after(async () => {
  for (const { s, nome, conta } of criadas) {
    s.desconectar();
    vivas.delete(nome);
    await B.db.prepare('DELETE FROM melhorias_da_conta WHERE conta = ?').run(conta);
    await B.db.prepare('DELETE FROM contas WHERE id = ?').run(conta);
  }
});

const pct = (x) => `${(x * 100).toFixed(1)}%`;
const lcg = (semente) => { let s = semente >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };

// ------------------------------------------------------------------ XP (puro)

test('X1. a fatia é nível^1,5 sobre a soma; soma 1; dois níveis iguais dividem igual; sem limite de diferença', () => {
  assert.equal(PR.PARTY_RECOMPENSAS.expoenteDeXp, 1.5);
  const f = PR.partesDeXp([10, 30, 60, 100], 1.5);
  assert.ok(Math.abs(f.reduce((a, b) => a + b, 0) - 1) < 1e-12);
  assert.deepEqual(f.map((x) => Math.round(x * 1000) / 10), [1.9, 9.9, 28, 60.2]);
  assert.deepEqual(PR.partesDeXp([50, 50], 1.5), [0.5, 0.5]);
  assert.ok(PR.partesDeXp([5, 300], 1.5)[1] > 0.99, 'sem limite: 5 e 300 formam party');
  assert.deepEqual(PR.partesDeXp([], 1.5), []);
  assert.deepEqual(PR.partesDeXp([77], 1.5), [1]);
});

test('X2. o expoente é configurável (ambiente), validado; inválido volta ao padrão', () => {
  assert.equal(PR.expoenteDeXp({ PARTY_XP_EXPOENTE: '1.25' }), 1.25);
  assert.equal(PR.expoenteDeXp({ PARTY_XP_EXPOENTE: '2' }), 2);
  assert.equal(PR.expoenteDeXp({ PARTY_XP_EXPOENTE: '9' }), 1.5);
  assert.equal(PR.expoenteDeXp({ PARTY_XP_EXPOENTE: 'abc' }), 1.5);
  assert.equal(PR.expoenteDeXp({}), 1.5);
  const por = (k) => PR.partesDeXp([10, 30, 60, 100], k)[0];
  assert.ok(por(1) > por(1.25) && por(1.25) > por(1.5) && por(1.5) > por(2), 'quanto maior o expoente, menos o iniciante recebe');
});

test('X3. o total distribuído é sempre o da exp do bicho (fatias somam 1) em qualquer composição', () => {
  const rng = lcg(7);
  for (let i = 0; i < 500; i++) {
    const n = 2 + Math.floor(rng() * 4);
    const niveis = Array.from({ length: n }, () => 1 + Math.floor(rng() * 400));
    for (const k of [1, 1.25, 1.5, 2]) assert.ok(Math.abs(PR.partesDeXp(niveis, k).reduce((a, b) => a + b, 0) - 1) < 1e-9);
  }
});

// ------------------------------------------------------------------ ouro (puro)

test('G1. o ouro divide em partes iguais e a soma é SEMPRE o original (divisões exatas e com resto)', () => {
  assert.deepEqual(PR.dividirOuro(1000, 4), [250, 250, 250, 250]);
  assert.deepEqual(PR.dividirOuro(1001, 4), [251, 250, 250, 250]);
  assert.deepEqual(PR.dividirOuro(1003, 4, 2), [251, 250, 251, 251], 'o resto começa em quem é a vez e dá a volta');
  const rng = lcg(11);
  for (let i = 0; i < 5000; i++) {
    const total = Math.floor(rng() * 100000);
    const n = 1 + Math.floor(rng() * 5);
    const inicio = Math.floor(rng() * n);
    const partes = PR.dividirOuro(total, n, inicio);
    assert.equal(partes.reduce((a, b) => a + b, 0), total, `${total}/${n}`);
    assert.ok(Math.max(...partes) - Math.min(...partes) <= 1);
  }
  assert.deepEqual(PR.dividirOuro(0, 3), [0, 0, 0]);
  assert.deepEqual(PR.dividirOuro(7, 1), [7]);
});

test('G2. o resto roda: em eventos seguidos ninguém é favorecido (1001 de ouro, 1000 eventos, quatro jogadores)', () => {
  const acumulado = [0, 0, 0, 0];
  let inicio = 0;
  for (let i = 0; i < 1000; i++) {
    PR.dividirOuro(1001, 4, inicio).forEach((v, k) => (acumulado[k] += v));
    inicio = PR.proximoInicioDoResto(1001, 4, inicio);
  }
  assert.equal(acumulado.reduce((a, b) => a + b, 0), 1001 * 1000);
  assert.ok(Math.max(...acumulado) - Math.min(...acumulado) <= 1, `${acumulado}`);
});

// ------------------------------------------------------------------ item (puro)

test('L1. o sorteio é uniforme: 100 mil drops, party de 2 a 5, ninguém se afasta de 3% do esperado; nunca dois donos', () => {
  const rng = lcg(2026);
  for (let n = 2; n <= 5; n++) {
    const candidatos = Array.from({ length: n }, (_, i) => `J${i}`);
    const levou = Object.fromEntries(candidatos.map((c) => [c, 0]));
    for (let i = 0; i < 100000; i++) levou[PR.sortearDono(candidatos, rng)]++;
    for (const c of candidatos) assert.ok(Math.abs(levou[c] / 100000 - 1 / n) < 0.03, `${n} jogadores: ${c} ${pct(levou[c] / 100000)}`);
    assert.equal(Object.values(levou).reduce((a, b) => a + b, 0), 100000, 'cada drop tem exatamente um dono');
  }
  assert.equal(PR.sortearDono([]), null);
  assert.equal(PR.sortearDono(['só']), 'só');
});

test('L2. a auditoria dos sorteios é um anel limitado e cada drop tem id único', () => {
  PR.limparAuditoria();
  const ids = new Set();
  for (let i = 0; i < 700; i++) ids.add(PR.registrarSorteio({ drop: PR.novoIdDeDrop(), item: 1, dono: 'A' }).drop);
  assert.equal(ids.size, 700);
  assert.equal(PR.auditoria().length, PR.PARTY_RECOMPENSAS.auditoriaMaxima);
  PR.limparAuditoria();
});

// ------------------------------------------------------------------ integração com `matarMonstro`

async function jogador(i, level) {
  const conta = await B.criarConta({ email: `partyr-${randomUUID()}@teste.local`, senha: 'senha-123' });
  await B.gravarMelhoriasDaConta(conta.id, { slotsDeParty: 3 });
  await B.lerMelhoriasDaConta(conta.id);
  const s = new Sessao({ readyState: 1, bufferedAmount: 0, send: () => {} });
  s.conta = { id: conta.id };
  const nome = `Pr${i}${randomUUID().replace(/[^a-z]/g, '').slice(0, 6)}`;
  const e = personagemDeTeste({ vocacao: 'knight', level });
  e.pos = { ...R.POSICAO_INICIAL };
  await s.concluirEntrada({ id: randomUUID(), nome }, e, null, null);
  criadas.push({ s, nome, conta: conta.id });
  return { s, nome };
}

async function partyCacando(...niveis) {
  const js = [];
  for (const [i, lv] of niveis.entries()) js.push(await jogador(i, lv));
  const [lider, ...outros] = js;
  for (const o of outros) {
    assert.equal(Party.comandoDoGrupo(lider.s, { action: 'convidar', name: o.nome }).ok, true);
    assert.equal(Party.comandoDoGrupo(o.s, { action: 'aceitar' }).ok, true);
  }
  assert.equal(Cacadas.entrar(lider.s.estado, { huntId: HUNT_DE_TESTE, mode: 'auto', dificuldade: DIF_DE_TESTE }).ok, true);
  for (const o of outros) {
    Party.comandoDaCaca(lider.s, { action: 'invite', name: o.nome });
    assert.equal(Party.comandoDaCaca(o.s, { action: 'accept' }).ok, true);
  }
  const partilhar = () => { for (const j of js) Object.defineProperty(j.s.estado.hunt, 'partilha', { value: Party.partilha(j.s), configurable: true, writable: true }); };
  partilhar();
  return { js, lider, partilhar };
}
function matar(quem, { loot = [], exp = 100, key = 'troll' } = {}) {
  const hunt = quem.s.estado.hunt;
  const alvo = hunt.monstros.find((m) => m.hp > 0) ?? hunt.monstros[0];
  Object.assign(alvo, { loot, exp, key });
  const eventos = [];
  Combate.matarMonstro(quem.s.estado, hunt, quem.s.personagem, alvo, eventos);
  return { eventos, alvo };
}

test('P1. na party sem limite de nível (25 e 100), cada um recebe a fatia nível^1,5 da exp do bicho (com os bônus PRÓPRIOS dele, como sempre)', async () => {
  const { js, lider, partilhar } = await partyCacando(100, 25);
  const fatias = PR.partesDeXp([100, 25], 1.5);
  assert.deepEqual(fatias.map((f) => Math.round(f * 100)), [89, 11]);
  const bonus = Party.partilha(lider.s).bonus;
  const esperado = js.map((j, i) => Boosts.expDoBicho(j.s.estado, 1000 * bonus * fatias[i]));
  const antes = js.map((j) => j.s.estado.xp ?? 0);
  for (let i = 0; i < 6; i++) {
    matar(lider, { exp: 1000 });
    partilhar();
  }
  const ganho = js.map((j, i) => ((j.s.estado.xp ?? 0) - antes[i]) / 6);
  assert.ok(ganho[1] > 0, 'o iniciante também ganha');
  for (const i of [0, 1]) assert.ok(Math.abs(ganho[i] - esperado[i]) / esperado[i] < 0.02, `jogador ${i}: ${ganho[i]} contra ${esperado[i]}`);
  // Quem mata não muda a divisão.
  const antes2 = js.map((j) => j.s.estado.xp ?? 0);
  for (let i = 0; i < 6; i++) matar(js[1], { exp: 1000 });
  const ganho2 = js.map((j, i) => ((j.s.estado.xp ?? 0) - antes2[i]) / 6);
  for (const i of [0, 1]) assert.ok(Math.abs(ganho2[i] - esperado[i]) / esperado[i] < 0.02, `matando o iniciante, jogador ${i}: ${ganho2[i]} contra ${esperado[i]}`);
});

test('P2. mesmo nível: partes iguais (como antes)', async () => {
  const { js, lider } = await partyCacando(60, 60, 60);
  const antes = js.map((j) => j.s.estado.xp ?? 0);
  for (let i = 0; i < 6; i++) matar(lider, { exp: 1000 });
  const ganho = js.map((j, i) => (j.s.estado.xp ?? 0) - antes[i]);
  assert.ok(Math.max(...ganho) - Math.min(...ganho) <= 6, `${ganho}`);
});

test('P3. o ouro de um bicho: a soma recebida pela party é EXATAMENTE o ouro do evento, e o resto roda entre os integrantes', async () => {
  const { js, lider } = await partyCacando(60, 60, 60, 60);
  const antes = js.map((j) => j.s.estado.gold ?? 0);
  let originalTotal = 0;
  for (let i = 0; i < 24; i++) {
    const { eventos } = matar(lider, { loot: [{ id: 3031, chance: 1 }] });
    for (const ev of eventos.filter((e) => e.t === 'loot')) for (const it of ev.items) if (VALOR_DA_MOEDA[it.id]) originalTotal += it.count * VALOR_DA_MOEDA[it.id];
  }
  const ganho = js.map((j, i) => (j.s.estado.gold ?? 0) - antes[i]);
  assert.equal(ganho.reduce((a, b) => a + b, 0), originalTotal, `soma ${ganho} contra ${originalTotal}`);
  assert.ok(Math.max(...ganho) - Math.min(...ganho) <= 1, `o resto roda: ${ganho}`);
});

test('P4. uma morte é processada UMA vez: repetir o evento de morte não paga exp, ouro nem item de novo', async () => {
  const { js, lider } = await partyCacando(60, 60);
  const hunt = lider.s.estado.hunt;
  const alvo = hunt.monstros.find((m) => m.hp > 0);
  Object.assign(alvo, { loot: [{ id: 3031, chance: 1 }], exp: 1000 });
  Combate.matarMonstro(lider.s.estado, hunt, lider.s.personagem, alvo, []);
  const depois = js.map((j) => [j.s.estado.xp, j.s.estado.gold]);
  PR.limparAuditoria();
  for (let i = 0; i < 5; i++) Combate.matarMonstro(lider.s.estado, hunt, lider.s.personagem, alvo, []);
  assert.deepEqual(js.map((j) => [j.s.estado.xp, j.s.estado.gold]), depois);
  assert.equal(PR.auditoria().length, 0, 'e nenhum sorteio novo');
});

test('P5. cada item sorteado vira um registro de auditoria com id, concorrentes e o único dono', { skip: aAdaptar("A auditoria do sorteio é da engine; o teste sorteia um item do Draevor, que não entra no jogo oficial") }, async () => {
  const { js, lider } = await partyCacando(60, 60, 60);
  PR.limparAuditoria();
  const item = Object.entries((await import('../systems/dados.mjs')).ITEM_CATALOG).find(([id, it]) => (it.weight ?? 0) > 0 && (it.weight ?? 0) <= 10 && it.pickupable !== false && ![3031, 3035, 3043].includes(Number(id)))[0];
  for (let i = 0; i < 6; i++) matar(lider, { loot: [{ id: Number(item), chance: 1 }] });
  const reg = PR.auditoria().filter((r) => r.item === Number(item));
  assert.equal(reg.length, 6);
  assert.equal(new Set(reg.map((r) => r.drop)).size, 6, 'ids únicos');
  for (const r of reg) {
    assert.equal(r.concorrentes.length, 3);
    assert.ok(r.concorrentes.includes(r.dono));
    assert.equal(r.resultado, 'entregue');
  }
  PR.limparAuditoria();
  void js;
});

test('P6. o jogador solo não muda: exp inteira, ouro inteiro e nenhum registro de sorteio', async () => {
  const solo = await jogador(9, 60);
  assert.equal(Cacadas.entrar(solo.s.estado, { huntId: HUNT_DE_TESTE, mode: 'auto', dificuldade: DIF_DE_TESTE }).ok, true);
  PR.limparAuditoria();
  const antes = [solo.s.estado.xp ?? 0, solo.s.estado.gold ?? 0];
  matar(solo, { loot: [{ id: 3031, chance: 1 }], exp: 1000 });
  assert.ok((solo.s.estado.xp ?? 0) > antes[0] && (solo.s.estado.gold ?? 0) > antes[1]);
  assert.equal(PR.auditoria().length, 0);
});
