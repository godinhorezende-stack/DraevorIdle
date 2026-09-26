// Arena x1: a fila do lobby do cliente de 26/09 (alistar / enfrentar / arenaPar),
// a sala (pronto, líder começa) e o DUELO de verdade — os dois lado a lado, sem
// bichos, trocando golpes até um cair — e o que fica depois (ponto, moeda,
// ticket, level de volta, nenhuma morte).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../../game/database/banco.mjs';
import * as Arena from '../../game/systems/arena.mjs';
import * as Cacadas from '../../game/systems/cacadas.mjs';
import { personagemDeTeste } from './apoio.mjs';
import * as R from '../../game/systems/regras.mjs';

const NOMES = ['Arenatesteum', 'Arenatestedois', 'Arenatestetres'];
after(() => {
  for (const n of NOMES) B.db.prepare('DELETE FROM arena_historico WHERE vencedor LIKE ? OR perdedor LIKE ?').run(`%"${n}"%`, `%"${n}"%`);
});

const sessao = (nome, vocacao, level) => {
  const s = { personagem: { nome }, estado: personagemDeTeste({ vocacao, level }), msgs: [] };
  s.enviar = (m) => s.msgs.push(m);
  return s;
};
const knight = sessao(NOMES[0], 'knight', 600);
const paladin = sessao(NOMES[1], 'paladin', 600);
const baixo = sessao(NOMES[2], 'druid', 120);
Arena.ligar(new Map([knight, paladin, baixo].map((s) => [s.personagem.nome, s])));
const vista = async (s) => (await Arena.vista(s)).view;
const ultima = (s, t) => s.msgs.filter((m) => m.t === t).at(-1);
/** `terminar` (arena.mjs) roda em segundo plano depois de `antesDoTique`/`saiuDoJogo` (fogo e esquece, de propósito — ver o comentário lá). Espera ela de fato terminar antes de olhar `msgs`/`vista`. */
const tique = () => new Promise((r) => setImmediate(r));
const arenaId = (await vista(knight)).arenas.find((a) => a.level === 500).id;

test('fila do lobby: alistar, aparecer para os outros, sair', async () => {
  assert.match(await Arena.comando(baixo, { action: 'alistar', arenaId }), /level 500/);
  assert.equal(await Arena.comando(paladin, { action: 'alistar', arenaId }), null);
  assert.equal((await vista(paladin)).euAlistado, true);
  assert.deepEqual((await vista(knight)).gente.map((g) => g.nome), [NOMES[1]]);
  assert.deepEqual((await vista(paladin)).gente, [], 'ninguém vê o próprio card');
  await Arena.comando(paladin, { action: 'desalistar' });
  assert.deepEqual([(await vista(paladin)).euAlistado, (await vista(knight)).gente.length], [false, 0]);
  assert.match(await Arena.comando(knight, { action: 'enfrentar', quem: NOMES[1], arenaId }), /não está mais na fila/);
});

test('enfrentar abre a sala dos dois e manda arenaPar aos dois', async () => {
  await Arena.comando(paladin, { action: 'alistar', arenaId });
  assert.equal(await Arena.comando(knight, { action: 'enfrentar', quem: NOMES[1], arenaId }), null);
  assert.equal(ultima(knight, 'arenaPar').de, NOMES[1]);
  assert.equal(ultima(paladin, 'arenaPar').de, NOMES[0]);
  assert.equal(ultima(paladin, 'arenaPar').arenaId, arenaId);
  const sala = (await vista(knight)).sala;
  assert.deepEqual(sala.lados.map((l) => [l.nome, l.lider]), [[NOMES[0], true], [NOMES[1], false]]);
  assert.equal((await vista(paladin)).euAlistado, false, 'sair da fila ao formar o par');
  assert.match(await Arena.comando(knight, { action: 'comecar' }), /prontos/);
  await Arena.comando(knight, { action: 'pronto' });
  await Arena.comando(paladin, { action: 'pronto' });
  assert.match(await Arena.comando(paladin, { action: 'comecar' }), /líder/);
});

test('o duelo: lado a lado, sem bichos, até um cair — e o depois', async () => {
  const antes = { k: { ...knight.estado.arena }, p: { ...paladin.estado.arena } };
  assert.equal(await Arena.comando(knight, { action: 'comecar' }), null);
  const [hk, hp] = [knight.estado.hunt, paladin.estado.hunt];
  assert.ok(hk?.pvp && hp?.pvp, 'os dois na arena, com pvp');
  assert.deepEqual([knight.estado.level, paladin.estado.level], [500, 500], 'a força do level da arena');
  // Sem bichos e colados: só o golpe de um no outro decide.
  hk.monstros.length = 0;
  hp.monstros.length = 0;
  Object.assign(hp.pos, { x: hk.pos.x + 1, y: hk.pos.y });
  Cacadas.definirAlvo(knight.estado, { uid: `aliado:${NOMES[1]}` });
  Cacadas.definirAlvo(paladin.estado, { uid: `aliado:${NOMES[0]}` });

  let agora = Date.now();
  // Largada: ninguém bate nos primeiros 5 s.
  Arena.antesDoTique(knight, agora);
  Arena.antesDoTique(paladin, agora);
  await tique();
  assert.equal(knight.msgs.filter((m) => m.t === 'events').length, 0);

  const golpes = { k: 0, p: 0 };
  for (agora += 6000; agora < Date.now() + 30 * 60_000 && !ultima(knight, 'arenaFim'); agora += 250) {
    for (const s of [knight, paladin]) {
      if (!s.estado.hunt) continue;
      const n = s.msgs.length;
      Arena.antesDoTique(s, agora);
      await tique();
      const deu = s.msgs.slice(n).some((m) => m.t === 'events' && m.events.some((e) => e.t === 'dmg' && e.alvo));
      if (deu) golpes[s === knight ? 'k' : 'p']++;
    }
  }
  const [fk, fp] = [ultima(knight, 'arenaFim')?.fim, ultima(paladin, 'arenaFim')?.fim];
  assert.ok(fk && fp, 'os dois recebem o fim');
  assert.ok(golpes.k > 0 && golpes.p > 0, `os dois trocaram golpes (${golpes.k} x ${golpes.p})`);
  assert.equal(fk.venceu, !fp.venceu);
  assert.equal(fk.motivo, 'caiu');
  const [ganhou, perdeu, aG, aP] = fk.venceu ? [knight, paladin, antes.k, antes.p] : [paladin, knight, antes.p, antes.k];
  console.log(`  duelo: ${ganhou.personagem.nome} venceu (${golpes.k} golpes do knight x ${golpes.p} do paladin)`);

  // Ponto e moeda: +1 para quem vence, -1 (nunca abaixo de 0) para quem perde; o ticket sai dos dois.
  assert.equal(ganhou.estado.arena.pontos, aG.pontos + 1);
  assert.equal(ganhou.estado.arena.moedas, aG.moedas + 1);
  assert.equal(ganhou.estado.arena.vitorias, aG.vitorias + 1);
  assert.equal(perdeu.estado.arena.pontos, Math.max(0, aP.pontos - 1));
  assert.equal(perdeu.estado.arena.moedas, Math.max(0, aP.moedas - 1));
  assert.equal(perdeu.estado.arena.derrotas, aP.derrotas + 1);
  for (const [s, a] of [[ganhou, aG], [perdeu, aP]]) {
    assert.equal(s.estado.arena.tickets, a.tickets - 1);
    // Volta com o level e a vida de antes, fora da arena, e sem a caixa de morte.
    assert.equal(s.estado.level, 600);
    assert.equal(s.estado.hunt, null);
    assert.equal(s.estado.hp, s.estado.maxHp);
    assert.equal(s.msgs.some((m) => m.t === 'death'), false);
  }
  assert.equal((await vista(knight)).historico[0].vencedor.nome, ganhou.personagem.nome);
  // A tela de fim: level de volta, o antes/depois de pontos, moedas e patente, e o placar.
  const fimG = ultima(ganhou, 'arenaFim').fim;
  const fimP = ultima(perdeu, 'arenaFim').fim;
  assert.equal(fimG.level, 600);
  assert.deepEqual(fimG.pontos, { antes: aG.pontos, agora: aG.pontos + 1 });
  assert.deepEqual(fimG.moedas, { antes: aG.moedas, agora: aG.moedas + 1 });
  assert.deepEqual(fimG.placar, { vitorias: aG.vitorias + 1, derrotas: aG.derrotas });
  assert.equal(fimG.patente.agora.pontos, aG.pontos + 1);
  assert.deepEqual(fimP.pontos, { antes: aP.pontos, agora: Math.max(0, aP.pontos - 1) });
  // Quem perde acorda no templo.
  assert.deepEqual([perdeu.estado.pos.x, perdeu.estado.pos.y], [R.POSICAO_INICIAL.x, R.POSICAO_INICIAL.y]);
});

test('o degrau dos bichos avisa os dois (arenaOnda)', async () => {
  await Arena.comando(paladin, { action: 'alistar', arenaId });
  await Arena.comando(knight, { action: 'enfrentar', quem: NOMES[1], arenaId });
  await Arena.comando(knight, { action: 'pronto' });
  await Arena.comando(paladin, { action: 'pronto' });
  await Arena.comando(knight, { action: 'comecar' });
  const inicio = Date.now();
  // Ninguém mira ninguém: 2 min depois da largada, o 1º degrau (+15%).
  Arena.antesDoTique(knight, inicio + 5000 + 120_000 + 10);
  await tique();
  const onda = (s) => s.msgs.flatMap((m) => (m.t === 'events' ? m.events : [])).find((e) => e.t === 'arenaOnda');
  assert.deepEqual(onda(knight), { t: 'arenaOnda', degrau: 1, passo: 15, total: 15 });
  assert.deepEqual(onda(paladin), onda(knight));
  assert.ok(knight.estado.hunt.monstros.every((m) => m.forca === 1.15));
  // Sair no meio conta como derrota.
  Arena.saiuDoJogo(paladin);
  await tique();
  assert.equal(ultima(knight, 'arenaFim').fim.venceu, true);
  assert.equal(knight.estado.level, 600);
});

test('cada um nasce numa ponta da arena e os dois se encontram pela caverna', async () => {
  knight.msgs.length = 0;
  paladin.msgs.length = 0;
  await Arena.comando(paladin, { action: 'alistar', arenaId });
  await Arena.comando(knight, { action: 'enfrentar', quem: NOMES[1], arenaId });
  await Arena.comando(knight, { action: 'pronto' });
  await Arena.comando(paladin, { action: 'pronto' });
  assert.equal(await Arena.comando(knight, { action: 'comecar' }), null);
  const [hk, hp] = [knight.estado.hunt, paladin.estado.hunt];
  hk.monstros.length = 0;
  hp.monstros.length = 0;
  const longe = Math.max(Math.abs(hk.pos.x - hp.pos.x), Math.abs(hk.pos.y - hp.pos.y));
  assert.ok(longe > 30, `as pontas ficam longe (${longe} casas)`);
  Cacadas.definirAlvo(knight.estado, { uid: `aliado:${NOMES[1]}` });
  Cacadas.definirAlvo(paladin.estado, { uid: `aliado:${NOMES[0]}` });
  let agora = Date.now() + 6000;
  let primeiroGolpe = null;
  for (let i = 0; i < 4 * 120 && !ultima(knight, 'arenaFim'); i++, agora += 250) {
    for (const s of [knight, paladin]) {
      if (!s.estado.hunt) continue;
      s.estado.hunt.guia = null; // a sessão recalcula o guia (party) a cada tique
      const n = s.msgs.length;
      Arena.antesDoTique(s, agora);
      await tique();
      if (!s.estado.hunt) continue;
      Cacadas.tique(s.estado, s.personagem, agora);
      if (primeiroGolpe == null && s.msgs.slice(n).some((m) => m.t === 'events' && m.events.some((e) => e.t === 'dmg' && e.alvo))) primeiroGolpe = (i * 250) / 1000;
    }
  }
  console.log(`  perseguição: ${longe} casas, primeiro golpe em ${primeiroGolpe}s de duelo`);
  assert.ok(primeiroGolpe != null, 'chegaram a trocar golpe');
  assert.ok(primeiroGolpe < 60, 'em menos de 1 minuto');
  if (knight.estado.hunt) {
    Arena.saiuDoJogo(paladin);
    await tique();
  }
});
