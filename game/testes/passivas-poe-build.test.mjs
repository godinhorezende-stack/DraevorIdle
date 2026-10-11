// A BUILD DO DONO na árvore do PoE (inspeção de 11/10, https://poeskilltree.com/?v=3.25.0 — Bruxa, 22 passivas): alocada pelo servidor nó a
// nó, a ficha efetiva muda exatamente o que as passivas dizem, com as contas do PoE — a Inteligência dá a mana e o ES a cada 2 e 5 pontos
// inteiros, a mana fixa entra antes do "aumentada", a regeneração aumentada multiplica a base. Cobre de uma vez as linhas que a cobertura
// genérica (`passivas-poe-cobertura`) não alcança por não haver nó só com elas (a mana fixa) e o encaixe de joia (alocável, sem efeito).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = !existsSync(Catalogo.ARQUIVO) && 'catálogo do PoE não está nesta máquina';
const P = await import('../systems/passivas/arvore.mjs');
const Comandos = await import('../systems/passivas/comandos.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');

// AAAABgMAFghnES0YPBhWHNwhwyj6NAo3ZlfhfIOCx46-kNaSwZM6uJO9J9-w6-75ZfnoAAA= (versão 6, classe 3 = Bruxa, sem ascendência)
const BUILD = ['2151', '4397', '6204', '6230', '7388', '8643', '10490', '13322', '14182', '22497', '31875', '33479', '36542', '37078', '37569', '37690', '47251', '48423', '57264', '60398', '63845', '63976'];

function bruxa() {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 30 }), { sistema: 'poe', classePoe: 'Witch' });
  delete e.classe;
  P.garantir(e);
  Comandos.depoisDeMudar(e);
  return e;
}
function foto(e) {
  Ficha.invalidar(e);
  const f = Ficha.combate(e);
  return { f, af: Afixos.soma(e), maxMana: e.maxMana, maxHp: e.maxHp };
}
/** Aloca a build na ordem do caminho (cada nó só quando já se liga ao que está alocado), como o jogador faria. */
function alocarBuild(e) {
  let falta = [...BUILD];
  for (let volta = 0; volta < BUILD.length && falta.length; volta++) {
    for (const id of [...falta]) if (Comandos.comando(e, { action: 'alocar', id }).ok) falta = falta.filter((x) => x !== id);
  }
  return falta;
}

test('build da Bruxa: os 22 nós alocam pelo caminho, e o encaixe de joia não muda nada', { skip: SEM }, () => {
  const e = bruxa();
  assert.deepEqual(alocarBuild(e), [], 'todos os nós da build alocados');
  for (const id of BUILD) assert.ok(e.passivas.alocados.includes(id), id);
  const comJoia = foto(e);
  assert.ok(Comandos.comando(e, { action: 'respec', ids: ['6230'] }).ok, 'tira o encaixe de joia (é folha)');
  const semJoia = foto(e);
  assert.equal(semJoia.maxMana, comJoia.maxMana);
  assert.equal(semJoia.f.energyShield, comJoia.f.energyShield);
});

test('build da Bruxa: a ficha muda o que as passivas dizem, com as contas do PoE', { skip: SEM }, () => {
  const e = bruxa();
  const antes = foto(e);
  assert.equal(alocarBuild(e).length, 0);
  const depois = foto(e);
  const { f } = depois;
  // Atributos: 8 × (+10 Int), +5 (Inteligência e Regeneração de Mana), +20 (Caminho do Sábio); +10 de Força.
  assert.equal(f.atributos.int, antes.f.atributos.int + 105);
  assert.equal(f.atributos.str, antes.f.atributos.str + 10);
  // Mana máxima = (base + ⌊Int/2⌋ + 36 fixa) × (1 + 24%): a base sai da ficha de antes, sem passivas.
  const base = antes.maxMana - Math.floor(antes.f.atributos.int / 2);
  assert.equal(depois.maxMana, Math.round((base + Math.floor(f.atributos.int / 2) + 20 + 16) * (1 + (8 + 8 + 8) / 100)));
  // Vida: ⌊Força/2⌋.
  assert.equal(depois.maxHp - antes.maxHp, Math.floor(f.atributos.str / 2) - Math.floor(antes.f.atributos.str / 2));
  // Escudo de energia: 2 × 6% dos nós + 1% a cada 5 de Inteligência.
  assert.equal(depois.af.es_pct, 12);
  assert.equal(f.efeitosDosAtributos.energyShieldPct, Math.floor(f.atributos.int / 5));
  // Velocidade de conjuração 3 × 3%; dano mágico 16% + 16%.
  assert.equal(f.castSpeed - antes.f.castSpeed, 9);
  assert.equal(f.danoDeMagiaDoPoe - antes.f.danoDeMagiaDoPoe, 32);
  // Regeneração: mana aumentada em 20% + 40% (sobre a base, que é % da mana máxima); vida 1% da máxima por segundo (Modelador).
  assert.equal(f.regenPoe.manaAumentada, 60);
  const taxaBase = antes.f.regenPoe.manaPorSegundo / antes.maxMana;
  assert.ok(Math.abs(f.regenPoe.manaPorSegundo - depois.maxMana * taxaBase * 1.6) < 0.01, `${f.regenPoe.manaPorSegundo} ≈ ${depois.maxMana} × ${taxaBase} × 1,6`);
  assert.equal(f.regenPoe.vidaPctDoMax, 1);
  assert.ok(Math.abs(f.regenPoe.vidaPorSegundo - depois.maxHp / 100) < 0.01);
});
