// LOTE 49 — as ÚNICAS de JOIA (J30, a primeira leva): o "por Espectro Grandioso" (cada um conta os encaixados — o acúmulo do PoE), os
// Esqueletos e os Golens das joias (velocidades, armadura, recarga, regeneração), o Pacto da Velocidade, a Atziri (a duração das Vaal), a
// Dissolução da Carne ("mais Vida"), o Potencial Oculto (por Item Mágico), a Regra de Ouro (por Veneno em você), o Primordial e a Pedra Anima;
// a linha interna do acúmulo vira lembrete; o tamanho do personagem e as Habilidades Prismáticas não se aplicam ao jogo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste } = await import('./apoio.mjs');
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const Comandos = await import('../systems/passivas/comandos.mjs');
const Ficha = await import('../systems/ficha.mjs');
const LacaiosPoe = await import('../systems/itens-poe/lacaios-poe.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');

J.iniciar(ITEM_CATALOG);
/** A joia única `slug` (a variação `i` — o Espectro Grandioso tem uma por linha), com as linhas no menor valor. */
function unica(slug, i = 0) {
  const lista = Catalogo.catalogo().classes.Jewels.unicos.filter((x) => x.slug === slug);
  const u = lista[i];
  const base = Catalogo.catalogo().classes.Jewels.bases.find((b) => b.nome === u.base);
  const g = gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: base.id, raridade: 'unico', ilvl: 80, rng: () => 0, unico: slug });
  return J.pecaDoJogo(g);
}
const encaixes = () => P.arvore().nos.filter((n) => P.ehEncaixeDeJoia(n)).slice(0, 4).map((n) => n.id);
function personagem() {
  const e = personagemDeTeste({ vocacao: 'knight', level: 90 });
  e.sistema = 'poe';
  e.classePoe = 'Marauder';
  P.garantir(e);
  e.passivas.alocados.push(...encaixes());
  P.garantir(e);
  e.inventory = [];
  return e;
}
const encaixar = (e, peca, no) => { e.inventory.push(peca); return Comandos.comando(e, { action: 'encaixarJoia', no, pilha: e.inventory.length - 1, id: peca.id }); };
const af = (e) => { Ficha.invalidar(e); return Ficha.combate(e).afPoe; };
const estado = (modelo, valores = [10]) => T.traduzirMod({ modelo, valores });

test('o ESPECTRO GRANDIOSO: cada um conta os Espectros Grandiosos encaixados — 1: +7% de resistências; 2: +14% cada, 28%', { skip: SEM }, () => {
  const e = personagem();
  const [a, b] = encaixes();
  const antes = af(e).fire_res ?? 0;
  assert.equal(encaixar(e, unica('Grand_Spectrum'), a).ok, true);
  assert.equal((af(e).fire_res ?? 0) - antes, 7);
  assert.equal(encaixar(e, unica('Grand_Spectrum'), b).ok, true);
  assert.equal((af(e).fire_res ?? 0) - antes, 28);
  assert.equal(estado('number of stackable unique jewels [{0}]', [1]).estado, 'lembrete');
});

test('os ESQUELETOS e os GOLENS das joias: velocidades (a de Conjuração só no que conjura), armadura, recarga e regeneração', { skip: SEM }, () => {
  const mods = { 'lacaio_vel_ataque:esqueleto': 7, 'lacaio_vel_conj:esqueleto': 9 };
  const magos = LacaiosPoe.oQueInvoca('Summon_Skeletons_of_Mages', 20, null, mods);
  const magos0 = LacaiosPoe.oQueInvoca('Summon_Skeletons_of_Mages', 20, null, {});
  assert.equal(magos.velAtaquePct - magos0.velAtaquePct, 16, 'o mago: ataque e conjuração');
  const guerreiros = LacaiosPoe.oQueInvoca('Summon_Skeletons', 20, null, mods);
  const guerreiros0 = LacaiosPoe.oQueInvoca('Summon_Skeletons', 20, null, {});
  assert.equal(guerreiros.velAtaquePct - guerreiros0.velAtaquePct, 7, 'o guerreiro: só o ataque');
  const golem = LacaiosPoe.oQueInvoca('Summon_Stone_Golem', 20, null, { 'lacaio_armadura:golem': 800, 'lacaio_cdr:golem': 30, 'lacaio_regen_pct:golem': 2 });
  const golem0 = LacaiosPoe.oQueInvoca('Summon_Stone_Golem', 20, null, {});
  assert.equal(golem.poe.armadura - golem0.poe.armadura, 800);
  assert.equal(golem.poe.recargaPct, 30);
  assert.equal(golem.poe.regenPct, 2);
  // (o Zumbi não é Golem nem Esqueleto)
  assert.equal(LacaiosPoe.oQueInvoca('Raise_Zombie', 20, null, { 'lacaio_armadura:golem': 800 }).poe.armadura, LacaiosPoe.oQueInvoca('Raise_Zombie', 20, null, {}).poe.armadura);
});

test('as LINHAS da primeira leva com efeito; o tamanho do personagem e as Habilidades Prismáticas "não se aplicam ao jogo"', { skip: SEM }, () => {
  for (const m of ['Velocidade de Ataque dos Esqueletos aumentada em {0}%', 'Velocidade de Conjuração dos Esqueletos aumentada em {0}%', 'Velocidade de Movimento dos Esqueletos aumentada em {0}%',
    'Velocidade de Ataque e Conjuração dos Golens aumentada em {0}%', 'Golens têm +{0} de Armadura', 'Golens Convocados Regeneram {0}% de sua Vida por segundo', 'Lacaios têm +{0}% de chance de Suprimirem o Dano Mágico',
    'Duração do efeito das habilidades vaal aumentada em {0}%', '{0}% mais Vida Máxima', 'Dano aumentado em {0}% para cada Item Mágico equipado', '+{0}% de Resistência a Caos por Veneno em você', 'Primordial',
    'Vida Máxima aumentada em {0}% por Espectro Grandioso', 'Lacaios têm +{0}% de Multiplicador de Golpe Crítico por Espectro Grandioso']) {
    assert.ok(['novo', 'equivalente'].includes(estado(m).estado), m);
  }
  const tam = estado('Tamanho do Personagem aumentado em {0}%', [3]);
  assert.equal(tam.estado, 'inerte');
  assert.match(tam.partes[0].nota, /^não se aplica ao jogo/);
  const pri = estado('Com um total de {0} de Destreza no Raio, Habilidades Prismáticas não podem escolher Fogo', [40]);
  assert.match(pri.partes[0].nota, /^não se aplica ao jogo/);
});

test('a PEDRA ANIMA: +1 ao máximo de Golens só com 3 Itens Primordiais encaixados ou vestidos', { skip: SEM }, () => {
  const e = personagem();
  const [a, b, c, d] = encaixes();
  assert.equal(encaixar(e, unica('The_Anima_Stone'), a).ok, true);
  assert.equal(encaixar(e, unica('Primordial_Might'), b).ok, true);
  assert.ok(!(af(e)['max_lacaio:golem'] > 0), 'com 1 Primordial, não');
  assert.equal(encaixar(e, unica('Primordial_Harmony'), c).ok, true);
  assert.ok(!(af(e)['max_lacaio:golem'] > 0), 'com 2, não (a Pedra Anima não é Primordial)');
  assert.equal(encaixar(e, unica('Primordial_Eminence'), d).ok, true);
  assert.equal(af(e)['max_lacaio:golem'], 1, 'com 3 Primordiais');
});
