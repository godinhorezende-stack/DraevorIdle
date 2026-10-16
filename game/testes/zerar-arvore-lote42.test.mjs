// ZERAR A ÁRVORE — LOTE 42 (dono, 16/10: "Fazer todos" — os limites do motor): P074 a CANALIZAÇÃO CONTÍNUA (a mesma habilidade de Canalização
// usada de novo em seguida continua o canalizar; outra interrompe — a Infusão Espiritual ganha um acúmulo a cada 0,5 s canalizando); P067 as
// DIREÇÕES ALEATÓRIAS (todos os projéteis, o principal também, saem em direções sorteadas e acertam o primeiro do caminho); P053 o TERRENO (o
// projétil que erra e bate numa casa que não se anda ricocheteia, na chance, para o inimigo mais perto da batida).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Acoes = await import('../systems/acoes.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const GemasPoe = await import('../systems/itens-poe/gemas-poe.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const Secundarios = await import('../systems/skills/golpes-secundarios.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
}

/** Um sorteio repetível (mulberry32). */
const semente = (s) => () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 1, rng: () => 0.5 }));

test('as linhas com efeito: a Infusão Espiritual, as direções aleatórias e o ricochete no terreno', { skip: SEM }, () => {
  assert.equal(T.traduzirMod({ modelo: 'Ganha Infusão Espiritual a cada 0.5 segundos enquanto canaliza uma magia', valores: [] }).estado, 'novo');
  assert.equal(T.traduzirMod({ modelo: 'Projéteis são disparados em direções aleatórias', valores: [] }).estado, 'novo');
  assert.equal(T.traduzirMod({ modelo: 'Projéteis têm {0}% de chance de conseguirem Ricochetear ao colidirem com o terreno', valores: [30] }).estado, 'novo');
});

test('P074 — a CANALIZAÇÃO CONTÍNUA: o Flagelo usado em seguida continua o canalizar; outra habilidade interrompe; a Infusão a cada 0,5 s', { skip: SEM }, () => {
  const e = Object.assign(personagemDeTeste({ vocacao: 'sorcerer', level: 60 }), { classePoe: 'Witch' });
  const arma = peca('Wands/Driftwood_Wand');
  arma.soquetes = { abertos: 2, links: [false], gemas: [null, null], cores: ['W', 'W'] };
  e.equipment = { ...e.equipment, weapon: arma };
  e.inventory = ['Blight', 'Fireball'].map((s) => GS.itemDaGema({ id: GemasPoe.doSlug(s).itemId, nivel: 10, xp: 0, raridade: 'comum' }));
  GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
  GS.encaixar(e, { de: 0, slot: 'weapon', indice: 1 });
  e.equipment.ring = { id: Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'might ring')?.id), count: 1, af: [], poe: { af: { infusao_espiritual: 1 } } };
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: GemasPoe.doSlug('Blight').acao, enabled: true, minMana: 0, conditions: [] };
  e.actions[1] = { id: GemasPoe.doSlug('Fireball').acao, enabled: true, minMana: 0, conditions: [] };
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  Object.assign(e, { mana: 1e6, maxMana: 1e6 });
  const h = e.hunt;
  h.clock = 100_000;
  h.monstros = h.monstros.filter((m) => !m.dummy).slice(0, 1);
  const [alvo] = h.monstros;
  Object.assign(alvo, { x: h.pos.x + 1, y: h.pos.y, hp: 1e12, maxHp: 1e12 });
  const usar = (slot) => {
    const r = Acoes.disparar(e, h, PERSONAGEM, slot, alvo, { manual: true });
    assert.equal(r.ok, true, r.erro);
    if (h.conjurando) { h.clock = h.conjurando.fim; Acoes.concluirConjuracao(e, h, PERSONAGEM); }
  };
  usar(0);
  const c1 = { ...h.canalizacao };
  assert.equal(c1.magia, true);
  assert.ok(ModsPoe.canalizandoAgora(h, h.clock));
  // a infusão: um acúmulo a cada 0,5 s canalizando (desde o começo)
  const af = Ficha.combate(e).afPoe;
  // de novo, em seguida (dentro do fim do uso de antes): o mesmo canalizar
  h.clock = c1.ate - 10;
  delete h.cooldowns?.[Acoes.GRUPO_DO_POE];
  for (const k of Object.keys(h.cooldowns ?? {})) delete h.cooldowns[k];
  usar(0);
  assert.equal(h.canalizacao.desde, c1.desde, 'o mesmo canalizar');
  assert.ok(h.canalizacao.ate > c1.ate);
  for (let t = c1.desde; t <= h.canalizacao.ate; t += 250) ModsPoe.tiqueDaInfusao(h, af, t);
  const esperado = Math.floor((h.canalizacao.ate - c1.desde) / 500);
  assert.ok(Math.abs((h.infusaoEspiritual?.n ?? 0) - Math.min(10, esperado)) <= 1, `${h.infusaoEspiritual?.n} ~ ${esperado}`);
  // outra habilidade interrompe
  for (const k of Object.keys(h.cooldowns ?? {})) delete h.cooldowns[k];
  const antes = h.clock;
  usar(1);
  assert.ok(!ModsPoe.canalizandoAgora(h, antes + 1), 'a Bola de Fogo interrompeu');
});

const linha = (n, passo, y = 10) => Array.from({ length: n }, (_, i) => ({ uid: `b${i}`, x: 10 + passo * (i + 1), y, hp: 100 }));

test('P067 — as DIREÇÕES ALEATÓRIAS: todos os projéteis saem em direções sorteadas e acertam o primeiro do caminho (o alvo não é garantido)', { skip: SEM }, () => {
  // inimigos em volta, em todas as direções, a 3 casas
  const vivos = [];
  for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) if (Math.max(Math.abs(dx), Math.abs(dy)) === 3) vivos.push({ uid: `b${dx},${dy}`, x: 10 + dx, y: 10 + dy, hp: 100 });
  const alvo = vivos.find((b) => b.x === 13 && b.y === 10);
  const r = Secundarios.resolver({ efeito: { projeteisBase: 1, alvosExtras: 4, direcoesAleatorias: true }, tags: ['projectile', 'single', 'hit'], origem: { x: 10, y: 10 }, alvo, atingidos: [alvo], vivos, alcance: 7, rng: semente(3) });
  assert.equal(r.emitidos.length, 5, 'o principal e os 4 a mais');
  assert.ok(r.golpes.length >= 1 && r.golpes.length <= 5);
  assert.ok(r.golpes.every((g) => g.tipo === 'projetil'), 'nenhum golpe "direto"');
  // cada golpe foi num inimigo que está na reta do projétil dele
  for (const g of r.golpes) assert.ok(r.emitidos.some((p) => p.bicho === g.bicho));
  // sem a linha: o principal vai no alvo (o `disparar` dá o golpe direto) e os outros nos mais perto
  const n = Secundarios.resolver({ efeito: { projeteisBase: 1, alvosExtras: 4 }, tags: ['projectile', 'single', 'hit'], origem: { x: 10, y: 10 }, alvo, atingidos: [alvo], vivos, alcance: 7, rng: semente(3) });
  assert.equal(n.emitidos[0].bicho, alvo);
});

test('P053 — o TERRENO: o projétil que erra e bate numa casa que não se anda ricocheteia (na chance) para o inimigo mais perto da batida', { skip: SEM }, () => {
  // a parede a partir de x = 12 (as casas que se andam: x ≤ 11); você em (10, 10), o alvo a 2 casas a leste e um inimigo fora do alcance do
  // tiro (3 casas) — a 4 de você, mas a 3 do ponto da batida na parede
  const andavel = new Set();
  for (let x = -20; x <= 11; x++) for (let y = -20; y <= 40; y++) andavel.add(`${x},${y}`);
  const alvo = { uid: 'alvo', x: 12, y: 10, hp: 100 };
  const perto = { uid: 'perto', x: 14, y: 12, hp: 100 };
  const tiro = (efeito, chao = andavel) => Secundarios.resolver({ efeito: { projeteisBase: 1, alvosExtras: 1, ...efeito }, tags: ['projectile', 'single', 'hit'], origem: { x: 10, y: 10 }, alvo, atingidos: [alvo], vivos: [alvo, perto], alcance: 3, rng: () => 0.01, andavel: chao });
  // o extra sai e erra (ninguém no alcance dele), bate na parede em x = 12 (o ponto da batida, (11, 10)) e ricocheteia no inimigo mais perto
  // de lá — o alvo, a 1 casa (no PoE o ricochete só não volta em quem o MESMO projétil já acertou)
  const ricochetes = (r) => r.golpes.filter((g) => g.tipo === 'encadeamento');
  const com = tiro({ ricocheteTerrenoChance: 100, ricochetePoe: true });
  assert.equal(ricochetes(com).length, 1, JSON.stringify(com.emitidos.map((p) => p.para)));
  assert.deepEqual([ricochetes(com)[0].bicho.uid, ricochetes(com)[0].de], ['alvo', { x: 11, y: 10 }]);
  assert.equal(ricochetes(tiro({ ricocheteTerrenoChance: 0, ricochetePoe: true })).length, 0, 'sem a chance, não');
  // sem parede no caminho (o campo aberto): não bate, não ricocheteia
  const aberto = new Set();
  for (let x = -20; x <= 40; x++) for (let y = -20; y <= 40; y++) aberto.add(`${x},${y}`);
  assert.equal(ricochetes(tiro({ ricocheteTerrenoChance: 100, ricochetePoe: true }, aberto)).length, 0, 'sem terreno, não');
});
