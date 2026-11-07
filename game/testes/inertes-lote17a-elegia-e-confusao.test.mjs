// (07/11, lote 17 das inertes — dono: "Fazer todas pelo PoB") a ELEGIA PARTIDA (a Carne Incessante e o Paredão Podre) e a CONFUSÃO DE FERRO (os Esqueletos com a arma
// e o Dano Triplicado).
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
const T = await import('../systems/itens-poe/traduzir.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');

if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
}

const tr = (modelo, valores = []) => T.traduzirMod({ modelo, valores });
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 70, rng: () => 0.5 }));
const CARNE = ['Ativa Carne Incessante nível {0} uma vez por segundo', [25]];
const PAREDAO = ['Ao morrer, um lacaio próximo concede Paredão Podre equivalente a {0}% da própria vida máxima', [9]];
const PORTA = ['Guerreiros e Soldados Esqueletos Convocados portam esta Arma enquanto ela estiver em sua Mão Principal'];
const TRIPLO = ['Guerreiros e Soldados Esqueletos Convocados causam Dano Triplicado com esta / Arma se você Acertou com esta Arma Recentemente'];

function personagem(linhas, base = 'Staves/Gnarled_Branch') {
  const e = Object.assign(personagemDeTeste({ vocacao: 'sorcerer', level: 90 }), { classePoe: 'Witch', sistema: 'poe' });
  const arma = peca(base);
  const af = { ...(arma.poe.af ?? {}) };
  for (const [m, v] of linhas) for (const x of tr(m, v ?? []).efeitos) af[x.stat] = (af[x.stat] ?? 0) + Number(x.valor);
  arma.poe.af = af;
  e.equipment = { ...e.equipment, weapon: arma };
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.clock = 100_000;
  e.hunt.lacaios = [];
  ModsPoe.definirFichaDaCacada(e.hunt, () => Ficha.combate(e));
  return e;
}

test('as linhas do lote saem com efeito', { skip: SEM }, () => {
  for (const [m, v] of [CARNE, PAREDAO, PORTA, TRIPLO]) assert.ok(!['inerte', 'registrado'].includes(tr(m, v ?? []).estado), m);
});

test('a CARNE INCESSANTE: um cadáver a até 3 casas vira o zumbi do PoB por 5 s, um por segundo; sem cadáver, nada', { skip: SEM }, () => {
  const e = personagem([CARNE]);
  const h = e.hunt;
  const t0 = 1_000_000;
  h.cadaveres = [{ key: 'x', nome: 'Morto', x: h.pos.x + 2, y: h.pos.y, z: h.z ?? 0, maxHp: 100 }, { key: 'y', nome: 'Morto', x: h.pos.x + 1, y: h.pos.y, z: h.z ?? 0, maxHp: 100 }];
  Acoes.tiqueDoGuardian(e, h, t0);
  const zumbis = () => h.lacaios.filter((l) => l.carneIncessante);
  assert.equal(zumbis().length, 1);
  assert.equal(zumbis()[0].pob, 'ShamblingUndead');
  assert.equal(zumbis()[0].ate, t0 + 5000);
  assert.equal(h.cadaveres.length, 1);
  Acoes.tiqueDoGuardian(e, h, t0 + 500);
  assert.equal(zumbis().length, 1, 'um por segundo');
  Acoes.tiqueDoGuardian(e, h, t0 + 1000);
  assert.equal(zumbis().length, 2);
  Acoes.tiqueDoGuardian(e, h, t0 + 2000);
  assert.equal(zumbis().length, 2, 'sem cadáver, nada');
});

test('o PAREDÃO PODRE: o lacaio que morre perto dá 9% da vida dele; o próximo ataque sai dele primeiro e o quebra', { skip: SEM }, () => {
  const e = personagem([PAREDAO]);
  const h = e.hunt;
  h.lacaios.push({ uid: 'z1', tipo: 'lacaio', hp: 1000, maxHp: 1000, x: h.pos.x + 1, y: h.pos.y });
  Acoes.tiqueDoGuardian(e, h, 1_000_000);
  h.lacaios[0].hp = 0;
  Acoes.tiqueDoGuardian(e, h, 1_000_100);
  assert.equal(h.poeParedao?.valor, 90);
  assert.equal(ModsPoe.absorverNoParedao(h, 50, [], {}), 0);
  assert.equal(h.poeParedao, undefined, 'qualquer dano o quebra');
  assert.equal(ModsPoe.absorverNoParedao(h, 50, [], {}), 50);
});

test('a CONFUSÃO DE FERRO: os Esqueletos golpeiam com o dano e o tempo da arma; × 3 com um acerto de ataque seu nos últimos 4 s; sem a linha, o golpe deles', { skip: SEM }, () => {
  const e = personagem([PORTA, TRIPLO]);
  const h = e.hunt;
  const arma = Ficha.armasEquipadas(e).find((a) => a.slot === 'weapon');
  const fator = 1 + (Number(Ficha.combate(e).afPoe?.minion_dmg) || 0) / 100;
  h.lacaios.push({ uid: 's1', tipo: 'lacaio', gema: 'Summon_Skeletons', hp: 100, maxHp: 100, x: h.pos.x, y: h.pos.y, dano: { min: 7, max: 9 }, intervaloMs: 1250 });
  Acoes.tiqueDoGuardian(e, h, 1_000_000);
  const s = h.lacaios[0];
  assert.deepEqual(s.dano, { min: Math.max(1, Math.round(arma.min * fator)), max: Math.max(1, Math.round(arma.max * fator)) });
  assert.equal(s.intervaloMs, arma.intervaloMs);
  Condicoes.marcar(h, 'ev:acertar', h.clock);
  Condicoes.marcar(h, 'usou:ataque', h.clock);
  Acoes.tiqueDoGuardian(e, h, 1_000_100);
  assert.equal(s.dano.max, Math.max(1, Math.round(arma.max * fator * 3)));
  e.equipment.weapon.poe.af = {};
  Ficha.invalidar(e);
  Acoes.tiqueDoGuardian(e, h, 1_000_200);
  assert.deepEqual(s.dano, { min: 7, max: 9 });
  assert.equal(s.intervaloMs, 1250);
});
