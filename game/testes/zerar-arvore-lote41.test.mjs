// ZERAR A ÁRVORE — LOTE 41 (dono, 16/10: "Fazer todos" — os limites do motor): P032 as ÁREAS FRIAS das suas gemas de frio (o Solo Gelado do
// PoE: quem está dentro fica Resfriado, 10%; a Geada Cortante lê o Resfriamento); P047 a Fúria Ancestral ("Habilidades de Golpe também miram no
// local anterior que foram Usadas" — o local de verdade); P019 as MAGIAS dos monstros no lacaio mais perto (o bloqueio mágico dele vale; o
// golpe corpo a corpo do conjurador é ataque).
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
const Poderes = await import('../systems/poderes.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const GemasPoe = await import('../systems/itens-poe/gemas-poe.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
}

const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 1, rng: () => 0.5 }));
const ANEL = Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'might ring')?.id);
/** A personagem numa caçada com a gema `gema` na arma `base` (a habilidade no slot 1) e `af` num anel; `monstros` imortais em fila. */
function cacada({ gema, base = 'One_Hand_Swords/Rusted_Sword', af = null, monstros = 1 }) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 60 }), { classePoe: 'Duelist' });
  const arma = peca(base);
  arma.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
  e.equipment = { ...e.equipment, weapon: arma };
  delete e.equipment.shield;
  e.inventory = [GS.itemDaGema({ id: GemasPoe.doSlug(gema).itemId, nivel: 10, xp: 0, raridade: 'comum' })];
  GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
  if (af) e.equipment.ring = { id: ANEL, count: 1, af: [], poe: { af } };
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: GemasPoe.doSlug(gema).acao, enabled: true, minMana: 0, conditions: [] };
  assert.equal(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok, true);
  Object.assign(e, { mana: 1e6, maxMana: 1e6 });
  const h = e.hunt;
  h.clock = 10000;
  h.monstros = h.monstros.filter((m) => !m.dummy).slice(0, monstros);
  h.monstros.forEach((m, i) => Object.assign(m, { hp: 1e12, maxHp: 1e12, x: h.pos.x + 1 + i, y: h.pos.y, raridade: 'normal', estados: {} }));
  return { e, h };
}
function usar({ e, h }, alvo) {
  const r = Acoes.disparar(e, h, PERSONAGEM, 0, alvo, { manual: true });
  assert.equal(r.ok, true, r.erro);
  if (h.conjurando) { h.clock = h.conjurando.fim; Acoes.concluirConjuracao(e, h, PERSONAGEM); }
  h.clock += 5000;
  Object.assign(e, { mana: 1e6 });
}

test('as linhas com efeito: a das áreas frias, a do local anterior e a do bloqueio mágico dos lacaios', { skip: SEM }, () => {
  assert.equal(T.traduzirMod({ modelo: 'Inimigos nas suas áreas frias sofrem dano de frio aumentado pelo esfriamento', valores: [] }).estado, 'novo');
  assert.equal(T.traduzirMod({ modelo: 'Habilidades de Golpe também miram no local anterior que foram Usadas', valores: [] }).estado, 'novo');
  assert.equal(T.traduzirMod({ modelo: 'Lacaios tem +{0}% de Chance de Bloquear o Dano Mágico', valores: [12] }).estado, 'novo');
});

test('P032 — a ÁREA FRIA: a gema que a cria deixa no chão (o raio em metros, a duração da gema); dentro, Resfriado 10%; a Geada Cortante lê', { skip: SEM }, () => {
  const o = cacada({ gema: 'Vortex', base: 'Wands/Driftwood_Wand', monstros: 2 });
  const [perto, longe] = o.h.monstros;
  Object.assign(longe, { x: o.h.pos.x + 6 });
  usar(o, perto);
  const [a] = o.h.areasFrias ?? [];
  assert.ok(a, 'o Vórtice deixou a área fria');
  assert.equal(a.raio, 1, '2,3 m: 1 casa');
  // dentro, Resfriado (10%); fora, não
  o.h.clock = a.ate - 1500;
  perto.estados = {};
  Object.assign(perto, { x: a.x, y: a.y });
  Cacadas.resfriarNasAreasFrias(o.h);
  assert.equal(perto.estados.lento?.pct, ModsPoe.AREAS_FRIAS.efeitoPct);
  assert.equal(longe.estados.lento, undefined);
  // a Geada Cortante: o dano de frio no Resfriado da área aumentado pelo Resfriamento (10%)
  const f = ModsPoe.fatorRecebidoPeloBicho(perto, 'ice', { afPoe: { resfriado_fragil: 1 } }, o.h.clock);
  const sem = ModsPoe.fatorRecebidoPeloBicho(perto, 'ice', { afPoe: {} }, o.h.clock);
  assert.ok(Math.abs(f / sem - 1.1) < 1e-9);
  // vencida, sai
  o.h.clock = a.ate + 1;
  Cacadas.resfriarNasAreasFrias(o.h);
  assert.equal(o.h.areasFrias.length, 0);
});

test('P047 — a FÚRIA ANCESTRAL: o Golpe acerta também quem está no local do uso anterior (sem o nó, não)', { skip: SEM }, () => {
  const tenta = (af) => {
    const o = cacada({ gema: 'Heavy_Strike', af, monstros: 2 });
    const [a, b] = o.h.monstros;
    Object.assign(b, { x: o.h.pos.x, y: o.h.pos.y + 1 });
    usar(o, a); // o primeiro uso, em A: o local anterior é o de A
    // A sai do lugar; B fica colado em você, e um terceiro... não: o segundo uso é em B — e o golpe mira o local de A também
    const antesA = a.hp;
    usar(o, b);
    return antesA - a.hp;
  };
  assert.ok(tenta({ golpe_local_anterior: 1 }) > 0, 'com o nó: A, no local anterior, leva o golpe');
  assert.equal(tenta({}), 0, 'sem o nó: só B');
});

test('P019 — a MAGIA do monstro vai no lacaio mais perto dele que você; o bloqueio mágico do lacaio vale; o golpe corpo a corpo é ataque', { skip: SEM }, () => {
  Poderes.registrarPoderes('teste-mago-lote41', { ataques: [{ tipo: 'magia', elemento: 'fire', min: 50, max: 50, intervalo: 1000, chance: 100, forma: 'alvo', alcance: 7 }], curas: [] }, { forcar: true });
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 60 }), { classePoe: 'Duelist' });
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  const h = e.hunt;
  Object.assign(e, { hp: 1e6, maxHp: 1e6 });
  // (o relógio da magia já pronto: o primeiro `lancar` de um bicho novo só sorteia quando cada magia começa)
  const bicho = { uid: 'mago', key: 'teste-mago-lote41', name: 'Mago', x: h.pos.x + 4, y: h.pos.y, hp: 100, maxHp: 100, estados: {}, proximoPoder: { 0: 0 } };
  const l = { uid: 'l1', tipo: 'lacaio', nome: 'Zumbi', x: h.pos.x + 3, y: h.pos.y, hp: 1000, maxHp: 1000, poe: { bloqueio: 0, bloqueioMagico: 0, res: 0 } };
  h.lacaios = [l];
  const ficha = Ficha.combate(e);
  const vidaAntes = e.hp;
  const ev = [];
  Poderes.lancar(e, h, PERSONAGEM, bicho, ev, h.clock + 5000, ficha, false);
  assert.ok(l.hp < 1000, 'o lacaio (a 1 casa do mago) levou a magia');
  assert.equal(e.hp, vidaAntes, 'você (a 4 casas), não');
  // o bloqueio mágico do lacaio
  l.hp = 1000;
  l.poe.bloqueioMagico = 100;
  const ev2 = [];
  // (lote 86, com o aval do dono — "Teto 75% e ajustar o teste": o bloqueio do lacaio para no teto do PoE, 75%; o sorteio abaixo dele)
  const sorteio = Math.random;
  Math.random = () => 0.1;
  try {
    Poderes.lancar(e, h, PERSONAGEM, bicho, ev2, h.clock + 10000, ficha, false);
  } finally {
    Math.random = sorteio;
  }
  assert.equal(l.hp, 1000);
  assert.ok(ev2.some((x) => x.t === 'block' && x.uid === 'l1'), 'bloqueou a magia');
  // o lacaio mais longe do mago que você (do outro lado, a 6 casas dele; você a 4): a magia vai em você
  Object.assign(l, { x: h.pos.x - 2, hp: 1000 });
  l.poe.bloqueioMagico = 0;
  Poderes.lancar(e, h, PERSONAGEM, bicho, [], h.clock + 15000, ficha, false);
  assert.equal(l.hp, 1000);
});
