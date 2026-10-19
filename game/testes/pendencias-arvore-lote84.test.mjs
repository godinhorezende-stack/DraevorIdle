// LOTE 84 — as pontas da árvore (dono, 19/10): o RICOCHETE no terreno pelo PoE ("Seguir o PoE": a batida é um ricochete — só com ricochete
// sobrando, e gasta um); a RECARGA do Escudo de Energia do PoE a 33%/s ("33% como o PoB": Data.lua, EnergyShieldRechargeBase — você, os
// monstros e os lacaios); os NOMES dos nós em que a tradução pt-BR contradiz o efeito ("Corrigir os 26" — 29 nós, pelo id, com os 4 erros de digitação que a revisão achou); o EMPURRÃO com a
// base de 1 casa registrada como exceção ("Base de 1 casa, exceção"); o Emissário e os altares seguem parciais, com a nota da busca.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = !existsSync(Catalogo.ARQUIVO) && 'catálogo do PoE não está nesta máquina';
const Secundarios = await import('../systems/skills/golpes-secundarios.mjs');
const Defesa = await import('../systems/personagem/defesa.mjs');
const LacaiosPoe = await import('../systems/itens-poe/lacaios-poe.mjs');
const { traduzirLinha } = await import('../systems/itens-poe/arvore.mjs');
const ARVORE = JSON.parse(readFileSync(new URL('../gamedata/itens-poe/arvore-poe.json', import.meta.url), 'utf8'));

test('o RICOCHETE no terreno: só com ricochete sobrando, e a batida gasta um (o PoE: "chance to be able to Chain when colliding with terrain")', { skip: SEM }, () => {
  // o cenário do lote 42: a parede a partir de x = 12, você em (10, 10), o alvo a 2 casas; o projétil extra erra, bate na parede (o ponto da
  // batida: (11, 10)) e salta para o mais perto de lá. Contam só os saltos que saem da batida (o principal ricocheteia no alvo por conta própria).
  const andavel = new Set();
  for (let x = -20; x <= 11; x++) for (let y = -20; y <= 40; y++) andavel.add(`${x},${y}`);
  const alvo = { uid: 'alvo', x: 12, y: 10, hp: 100 };
  const perto = { uid: 'perto', x: 14, y: 12, hp: 100 };
  const tiro = (encadear) => Secundarios.resolver({ efeito: { projeteisBase: 1, alvosExtras: 1, ricocheteTerrenoChance: 100, ricochetePoe: true, encadear }, tags: ['projectile', 'single', 'hit'], origem: { x: 10, y: 10 }, alvo, atingidos: [alvo], vivos: [alvo, perto], alcance: 3, rng: () => 0.01, andavel });
  const daBatida = (r) => r.golpes.filter((g) => g.tipo === 'encadeamento' && g.de?.x === 11 && g.de?.y === 10).length;
  assert.equal(daBatida(tiro(0)), 0, 'sem ricochete, a batida não salta');
  assert.equal(daBatida(tiro(1)), 1, 'com 1: a batida salta (e gasta o único)');
  // a batida gasta um: o salto dela sai com os ricochetes menos 1 (e conta como 1 ricochete feito)
  const daParede = (r) => r.golpes.find((g) => g.tipo === 'encadeamento' && g.de?.x === 11 && g.de?.y === 10);
  assert.deepEqual([daParede(tiro(1)).ricochetes, daParede(tiro(1)).restantes], [1, 0]);
  assert.deepEqual([daParede(tiro(2)).ricochetes, daParede(tiro(2)).restantes], [1, 1]);
});

test('a RECARGA do Escudo de Energia do PoE: 33% por segundo depois de 2 s — você, o monstro e o lacaio', { skip: SEM }, () => {
  const ficha = { energyShield: 1000 };
  const e = { es: 1000 };
  Defesa.absorver(e, ficha, 1000, null, null);
  Defesa.recarregar(e, ficha, 3000);
  assert.equal(e.es, 330, '2 s de espera + 1 s a 33%');
  assert.equal(Defesa.recargaPorSegundo(), 0.33);
  const l = { maxEs: 1000, es: 0, esEspera: 0 };
  LacaiosPoe.recarregarEscudoDoLacaio(l, 1000);
  assert.ok(Math.abs(l.es - 330) < 1e-9, `${l.es}`);
});

test('os NOMES corrigidos (a tradução pt-BR contradizia o efeito); os outros seguem o PoE pt-BR', { skip: SEM }, () => {
  const no = (id) => ARVORE.nos.find((n) => n.id === id);
  for (const [id, nome] of [['31973', 'Efeito de Maldições'], ['40126', 'Efeito de Maldições'], ['17412', 'Vida de Lacaios'], ['30251', 'Dano com Machados'], ['36226', 'Dano de Gelo e Chance de Congelar'], ['22852', 'Dano de Projétil, Velocidade de Ataque'], ['33435', 'Domínio Sagrado']]) {
    assert.equal(no(id).nome, nome, id);
  }
  // o mesmo "Curse Effect" que já vinha certo, igual
  assert.equal(no('6109').nome, 'Efeito de Maldições');
  const corrigidos = JSON.parse(readFileSync(new URL('../gamedata/itens-poe/traducao-arvore.json', import.meta.url), 'utf8')).nomes;
  assert.equal(Object.keys(corrigidos).length, 29);
  assert.ok(!ARVORE.nos.some((n) => /Danod e| E Penetração/.test(n.nome ?? '')), 'sem os erros de digitação');
  for (const id of Object.keys(corrigidos)) assert.ok(no(id), `o nó ${id} existe`);
});

test('o EMPURRÃO: a base de 1 casa é a exceção registrada (com efeito); o Emissário e os altares seguem parciais, com a nota da busca', { skip: SEM }, () => {
  const t = traduzirLinha('Distância do Empurrão aumentada em 25%');
  assert.notEqual(t.estado, 'aproximado');
  assert.ok(t.efeitos.length);
  assert.match(t.nota ?? '', /exceção do dono/);
  const emissario = traduzirLinha('Concede a Habilidade Convocar Grande Emissário das Direções');
  assert.equal(emissario.estado, 'aproximado');
  assert.match(emissario.nota, /RECARGA do Convocar/);
  assert.match(traduzirLinha('Ganha um buff de altar aleatório a cada 10 segundos').nota, /CalcPerform/);
});
