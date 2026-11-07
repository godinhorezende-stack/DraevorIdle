// (07/11, lote 20 das inertes — dono: "Criar as mecânicas") as mecânicas de monstro que o jogo não tinha: os ANIMAIS (pela raça), o SILÊNCIO e o SOLO PROFANADO (dois
// modificadores de monstro raro do jogo), o projétil que ATRAVESSA você, o ESPORO INFESTADO, os ESPÍRITOS ATORMENTADOS e os VERMES (o Retorcido e os Contorcidos).
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
const Condicoes = await import('../systems/itens-poe/condicoes-poe.mjs');
const Mecanicas = await import('../systems/mobs/mecanicas.mjs');
const Raridade = await import('../systems/mobs/raridade.mjs');
const Frascos = await import('../systems/itens-poe/frascos.mjs');
const GemasPoe = await import('../systems/itens-poe/gemas-poe.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const { BESTIARY } = await import('../systems/hunt/monstros.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
const Poderes = await import('../systems/poderes.mjs');

if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
}

const tr = (modelo, valores = []) => T.traduzirMod({ modelo, valores });
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 70, rng: () => 0.5 }));
const LINHAS = {
  animais: ['{0} de Dano Físico sofrido quando acertado por Animais', [-46]], profanado: ['Inafetado por Solo Profanado'], silencio: ['Você não pode ser Amaldiçoado com Silêncio'],
  perfuram: ['Projéteis Inimigos Perfuram você'], esporo: ['Cria um Esporo Infestado quando suas Habilidades ou Lacaios Matarem um Monstro Raro'],
  espiritos: ['Você pode ser Tocado por Espíritos Atormentados'], verme: ['Um Verme Retorcido inimigo surge a cada {0} segundos', [20]],
};

function personagem(linhas = [], encaixada = null) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'sorcerer', level: 90 }), { classePoe: 'Witch', sistema: 'poe' });
  const arma = peca('Wands/Driftwood_Wand');
  const af = { ...(arma.poe.af ?? {}) };
  for (const [m, v] of linhas) for (const x of tr(m, v ?? []).efeitos) af[x.stat] = (af[x.stat] ?? 0) + Number(x.valor);
  arma.poe.af = af;
  e.equipment = { ...e.equipment, weapon: arma };
  if (encaixada) {
    arma.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
    e.inventory = [GS.itemDaGema({ id: GemasPoe.doSlug(encaixada).itemId, nivel: 20, xp: 0, raridade: 'comum' })];
    GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
    e.actions = Array(Acoes.SLOTS).fill(null);
    e.actions[0] = { id: GemasPoe.doSlug(encaixada).acao, enabled: true, minMana: 0, conditions: [] };
  }
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  const h = e.hunt;
  h.clock = 100_000;
  e.mana = e.maxMana = 1e7;
  e.maxHp = e.hp = 1e6;
  const [b, ...resto] = h.monstros;
  for (const m of resto) Object.assign(m, { x: h.pos.x + 60, y: h.pos.y + 60 });
  Object.assign(b, { x: h.pos.x + 1, y: h.pos.y, hp: 1e9, maxHp: 1e9, estados: {} });
  ModsPoe.definirFichaDaCacada(h, () => Ficha.combate(e));
  return { e, h, b };
}

test('as linhas do lote saem com efeito; os dois modificadores novos de monstro existem (Profanador, Silenciador)', { skip: SEM }, () => {
  for (const [m, v] of Object.values(LINHAS)) assert.ok(!['inerte', 'registrado'].includes(tr(m, v ?? []).estado), m);
  assert.equal(Raridade.MODIFICADORES['poe:Draevor_DesecratedGroundOnDeath']?.mecanicas?.[0]?.solo, 'profanado');
  assert.deepEqual(Raridade.MODIFICADORES['poe:Draevor_SilencingCurse']?.mecanicas?.[0]?.maldicoes, ['silencio']);
});

test('os ANIMAIS: o Mamífero que acerta leva os -46 do fixo; o Morto-vivo, não', { skip: SEM }, () => {
  const { e } = personagem([LINHAS.animais]);
  const f = Ficha.combate(e);
  const animal = Object.keys(BESTIARY).find((k) => k.startsWith('poe-') && BESTIARY[k].race === 'BESTY_RACE_MAMMAL');
  const morto = Object.keys(BESTIARY).find((k) => k.startsWith('poe-') && BESTIARY[k].race === 'BESTY_RACE_UNDEAD');
  assert.equal(ModsPoe.fixoRecebido(f, 'physical', { ataque: true, de: { key: animal } }), -46);
  assert.equal(ModsPoe.fixoRecebido(f, 'physical', { ataque: true, de: { key: morto } }), 0);
});

test('o SILÊNCIO: amaldiçoado, você não usa habilidades; com a Estrela de Wraeclast, a maldição não pega', { skip: SEM }, () => {
  const { e, h, b } = personagem([], 'Fireball');
  Condicoes.amaldicoarJogador(h, 'silencio:x', { ...ModsPoe.MALDICOES_DOS_MONSTROS.silencio, ms: 2000 }, h.clock);
  Ficha.invalidar(e);
  assert.equal(Acoes.disparar(e, h, PERSONAGEM, 0, b, { manual: true }).motivo, 'SILENCIADO');
  const imune = personagem([LINHAS.silencio], 'Fireball');
  Condicoes.amaldicoarJogador(imune.h, 'silencio:x', { ...ModsPoe.MALDICOES_DOS_MONSTROS.silencio, ms: 2000 }, imune.h.clock);
  Ficha.invalidar(imune.e);
  assert.notEqual(Acoes.disparar(imune.e, imune.h, PERSONAGEM, 0, imune.b, { manual: true }).motivo, 'SILENCIADO');
});

test('o SOLO PROFANADO: queima Caos por segundo; com o Passo Natal, nada', { skip: SEM }, () => {
  for (const [linhas, fere] of [[[], true], [[LINHAS.profanado], false]]) {
    const { e, h, b } = personagem(linhas);
    h.solosDosMonstros = [{ tipo: 'profanado', x: h.pos.x, y: h.pos.y, z: h.z ?? 0, raio: 1, ate: Date.now() + 60_000, proximo: 0, dps: 500, de: b }];
    const antes = e.hp;
    Mecanicas.tique(e, h, PERSONAGEM, []);
    assert.equal(e.hp < antes, fere);
  }
});

test('o projétil que ATRAVESSA, o ESPORO INFESTADO, os ESPÍRITOS ATORMENTADOS e o VERME RETORCIDO', { skip: SEM }, () => {
  // o Esporo: o Raro morto deixa o Esporo com uma aura que vale em você perto dele
  const esp = personagem([LINHAS.esporo]);
  const raro = { uid: 'r', hp: 0, maxHp: 10, raridade: 'raro', raridadePoe: 'raro', x: esp.h.pos.x + 1, y: esp.h.pos.y, estados: {} };
  ModsPoe.evento(esp.e, esp.h, 'matar', Ficha.combate(esp.e), { alvo: raro, eventos: [], personagem: PERSONAGEM, rng: () => 0 });
  const esporo = esp.h.lacaios.find((l) => l.esporo);
  assert.ok(esporo && Object.keys(esporo.auraAf).length);
  // os Espíritos: 10% — com o sorteio em 0, o toque
  const sp = personagem([LINHAS.espiritos]);
  ModsPoe.evento(sp.e, sp.h, 'matar', Ficha.combate(sp.e), { alvo: { ...raro }, eventos: [], personagem: PERSONAGEM, rng: () => 0 });
  assert.ok(Object.keys(sp.h.poeBuffs ?? {}).some((k) => /^tocadoEspirito/.test(k)));
  // o Verme Retorcido: a cada 20 s, um verme hostil perto de você
  const vm = personagem([LINHAS.verme]);
  Acoes.tiqueDoGuardian(vm.e, vm.h, 1_000_000);
  assert.equal(vm.h.monstros.filter((m) => m.vermeRetorcido).length, 0);
  vm.h.clock += 20_000;
  Acoes.tiqueDoGuardian(vm.e, vm.h, 1_000_100);
  assert.equal(vm.h.monstros.filter((m) => m.vermeRetorcido && m.hp > 0).length, 1);
  // os Vermes Contorcidos do Jarro: 2 vermes de 1 de vida ao usar o frasco
  const jr = personagem();
  const frasco = peca('Utility_Flasks/Quicksilver_Flask');
  frasco.poe.modificadores = [...(frasco.poe.modificadores ?? []), { modelo: '{0} Vermes Contorcidos Inimigos escapam do Frasco quando utilizado Vermes Contorcidos são destruídos quando Acertados', valores: [2] }];
  frasco.poe.cargas = 100;
  Frascos.cinto(jr.e)[0] = frasco;
  assert.ok(Frascos.usar(jr.e, 0, []));
  const contorcidos = jr.h.monstros.filter((m) => m.vermeContorcido);
  assert.equal(contorcidos.length, 2);
  assert.equal(contorcidos[0].maxHp, 1);
});

test('a VISÃO DE LIONEYE: o projétil do monstro que te acerta segue e acerta o seu lacaio atrás de você; sem a linha, não', { skip: SEM }, () => {
  for (const [linhas, fere] of [[[], false], [[LINHAS.perfuram], true]]) {
    const { e, h, b } = personagem(linhas);
    Object.assign(b, { x: h.pos.x + 3, y: h.pos.y });
    h.lacaios = [{ uid: 'l1', tipo: 'lacaio', hp: 10_000, maxHp: 10_000, x: h.pos.x - 1, y: h.pos.y }];
    Poderes.dispararMagia({ estado: e, hunt: h, personagem: PERSONAGEM, bicho: b, eventos: [], agora: h.clock, ficha: Ficha.combate(e), temEscudo: false }, { elemento: 'fire', min: 500, max: 500, tiro: 1, nome: 'Bola' }, { semTiro: true });
    assert.equal(h.lacaios[0].hp < 10_000, fere);
  }
});
