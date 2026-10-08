// O FILTRO DE LOOT do PoE (dono, 07/10: "arrume o filtro de loot de acordo com o PoE; só vai ter itens do PoE"). Só com ITENS_POE=1:
// a peça do PoE é decidida pela raridade do PoE, mods e tier (T1 é o melhor), Item Level, sockets (até 6, ligados, R-G-B) e classe.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Bolsa = await import('../systems/bolsa.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');
const SEM = !existsSync(Catalogo.ARQUIVO) && 'catálogo do PoE não importado nesta máquina';

/** Uma peça do PoE de teste: raridade, os tiers dos mods, Item Level, sockets (`ligados` = o 1º grupo), cores e classe. */
function peca({ raridade = 'normal', tiers = [], ilvl = 50, abertos = 1, ligados = 1, cores = null, classe = 'Body_Armours', id = 7000001 } = {}) {
  return {
    id, count: 1,
    soquetes: { abertos, links: Array.from({ length: Math.max(0, abertos - 1) }, (_, i) => i < ligados - 1), gemas: [], cores: cores ?? Array(abertos).fill('R') },
    poe: { raridade, classe, ilvl, prefixos: tiers.slice(0, 3).map((tier) => ({ tier })), sufixos: tiers.slice(3).map((tier) => ({ tier })) },
  };
}
function quem(settings = {}) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 50 });
  Bolsa.garantir(e);
  e.settings = { ...settings };
  return e;
}
const acao = (e, p) => Afixos.decisaoDoLoot(e, p).acao;

test('padrão do PoE: só os Únicos ficam; o resto vai para o NPC', { skip: SEM }, () => {
  const e = quem();
  assert.equal(acao(e, peca({ raridade: 'unico' })), 'naoVender');
  assert.equal(acao(e, peca({ raridade: 'raro', tiers: [1, 2, 3, 4, 5, 6] })), 'vender');
  assert.equal(Afixos.decisaoDoLoot(quem({ guardarRaridadePoe: 0 }), peca({ raridade: 'unico' })).acao, 'vender', '"Não olhar": até o Único vai');
  assert.equal(acao(quem({ guardarRaridadePoe: 2 }), peca({ raridade: 'raro' })), 'naoVender', 'Raro para cima');
  assert.equal(acao(quem({ guardarRaridadePoe: 2 }), peca({ raridade: 'magico', tiers: [7] })), 'vender');
});

test('mods e tier: quantos mods e um deles T-N ou melhor (T1 é o melhor)', { skip: SEM }, () => {
  const e = quem({ guardarModsPoe: 4, guardarTierPoe: 2 });
  assert.equal(acao(e, peca({ raridade: 'raro', tiers: [2, 5, 6, 7] })), 'naoVender');
  assert.equal(acao(e, peca({ raridade: 'raro', tiers: [3, 5, 6, 7] })), 'vender', 'sem T2 ou melhor');
  assert.equal(acao(e, peca({ raridade: 'raro', tiers: [1, 5, 6] })), 'vender', 'só 3 mods');
  assert.equal(acao(quem({ guardarTierPoe: 1 }), peca({ raridade: 'magico', tiers: [1] })), 'naoVender', 'só o tier: um mod T1 basta');
  assert.equal(Afixos.decisaoDoLoot(e, peca({ raridade: 'raro', tiers: [2, 5, 6, 7] })).motivo, 'mods da peça');
});

test('sockets (até 6, ligados, R-G-B ligados) e Item Level guardam com OU, mesmo Normal', { skip: SEM }, () => {
  assert.equal(acao(quem({ guardarSockets: 6 }), peca({ abertos: 6 })), 'naoVender');
  assert.equal(acao(quem({ guardarLigados: 5 }), peca({ abertos: 6, ligados: 5 })), 'naoVender');
  assert.equal(acao(quem({ guardarLigados: 5 }), peca({ abertos: 6, ligados: 4 })), 'vender');
  assert.equal(acao(quem({ guardarRgbPoe: true }), peca({ abertos: 3, ligados: 3, cores: ['R', 'G', 'B'] })), 'naoVender', 'o Cromático');
  assert.equal(acao(quem({ guardarRgbPoe: true }), peca({ abertos: 3, ligados: 2, cores: ['R', 'G', 'B'] })), 'vender', 'B solto: não conta');
  assert.equal(acao(quem({ guardarIlvlPoe: 84 }), peca({ ilvl: 84 })), 'naoVender');
  assert.equal(acao(quem({ guardarIlvlPoe: 84 }), peca({ ilvl: 83 })), 'vender');
});

test('regras específicas do PoE: raridade E classe E mods E tier E Item Level E ligados; a primeira decide, antes das seções', { skip: SEM }, () => {
  const e = quem();
  assert.equal(Bolsa.definirRegrasDeLoot(e, { regras: [
    { raridade: 'unico', acao: 'naoColetar' },
    { raridade: 'magico', acima: true, classe: 'Rings', tier: 3, acao: 'naoVender' },
    { raridade: 'xyz', classe: 'nada<script>', ilvl: 999 },
  ] }).ok, true);
  assert.deepEqual(e.lootRegras.map((r) => [r.poe, r.raridade, r.classe, r.ilvl]), [[true, 'unico', null, 0], [true, 'magico', 'Rings', 0], [true, null, null, 100]], 'saneadas: raridade e classe inválidas viram "qualquer", o ilvl tem teto');
  e.lootRegras.pop();
  assert.equal(acao(e, peca({ raridade: 'unico' })), 'naoColetar', 'a regra vem antes da seção de raridade');
  assert.equal(acao(e, peca({ raridade: 'raro', classe: 'Rings', tiers: [3, 8] })), 'naoVender');
  assert.equal(acao(e, peca({ raridade: 'raro', classe: 'Amulets', tiers: [3, 8] })), 'vender', 'outra classe');
  // As listas por base continuam valendo primeiro.
  e.itemRules.noSell.push(7000001);
  assert.equal(Afixos.decisaoDoLoot(e, peca({ raridade: 'normal' })).motivo, 'lista "Não vender"');
});

test('a tela recebe o modo PoE e a prévia com peças do PoE', { skip: SEM }, () => {
  const e = quem({ guardarRgbPoe: true });
  const estado = Bolsa.paraCliente(e);
  const previa = Afixos.previaDoFiltro(e);
  assert.ok(previa.some((l) => /Único/.test(l.rotulo) && l.acao === 'naoVender'));
  assert.ok(previa.some((l) => /R-G-B/.test(l.rotulo) && l.acao === 'naoVender'));
  assert.equal(estado.filtroPoe, true);
});

// (Dono, 08/10: "o máximo de slot na bag é 20" — como no inventário do PoE, a pilha também ocupa uma vaga. De 07/10 a 08/10 as pilhas não
// contavam, e a mochila passava de 20 entradas.)
test('mochila do PoE: 20 vagas no total — a peça e a pilha ocupam uma cada (como no PoE); cheia, não entra mais nada — e nada se perde', { skip: SEM }, async () => {
  const Inventario = await import('../systems/inventario.mjs');
  const { ITEM_CATALOG } = await import('../systems/dados.mjs');
  const naoEmpilha = Number(Object.keys(ITEM_CATALOG).find((id) => ITEM_CATALOG[id].slot === 'body' && !ITEM_CATALOG[id].stackable));
  const empilha = Number(Object.keys(ITEM_CATALOG).find((id) => ITEM_CATALOG[id].stackable && !ITEM_CATALOG[id].moeda));
  const e = quem();
  e.inventory = Array.from({ length: Inventario.vagasDaMochila(e) - 1 }, () => ({ id: naoEmpilha, count: 1 }));
  assert.equal(Inventario.cabeNaMochila(e, naoEmpilha), true, 'a última vaga');
  assert.equal(Inventario.cabeNaMochila(e, empilha, 50), true, 'a última vaga serve também para uma pilha');
  assert.equal(Inventario.cabeNaMochila(e, naoEmpilha, 2), false, 'duas peças, uma vaga');
  e.inventory.push({ id: naoEmpilha, count: 1 });
  assert.equal(Inventario.pecasNaMochila(e), 20);
  assert.equal(Inventario.cabeNaMochila(e, naoEmpilha), false, 'cheia');
  assert.equal(Inventario.cabeNaMochila(e, empilha, 50), false, 'cheia: a pilha nova também pede vaga');
  // A pilha que já está lá recebe mais do mesmo item sem pedir vaga, até 100; o que passar disso pede vaga nova.
  e.inventory[19] = { id: empilha, count: 30 };
  assert.equal(Inventario.cabeNaMochila(e, empilha, 70), true, 'junta na pilha que já está lá (30 + 70 = 100)');
  assert.equal(Inventario.cabeNaMochila(e, empilha, 71), false, 'passa de 100: pediria uma vaga');
  assert.match(Inventario.erroDeEspaco(e, naoEmpilha), /mochila está cheia \(20 vagas\)/);
  e.inventory[19] = { id: naoEmpilha, count: 1 };
  // Tirar do corpo com a mochila cheia: recusado, a peça fica vestida.
  e.equipment.body = { id: naoEmpilha, count: 1 };
  const r = Inventario.desequipar(e, { slot: 'body' });
  assert.equal(r.ok, false);
  assert.ok(e.equipment.body, 'continua vestida');
  // Da bolsa de loot para a mochila: recusado, fica na bolsa.
  e.pouch = [{ id: naoEmpilha, count: 1, poe: { raridade: 'raro' } }];
  assert.equal(Bolsa.moverBolsa(e, { id: naoEmpilha, to: 'bag', pilha: 0 }).ok, false);
  assert.equal(e.pouch.length, 1);
});

test('mochila do PoE: o que passar das 20 peças (compra, recompensa, engine…) vai para o Depósito, as mais recentes primeiro', { skip: SEM }, async () => {
  const Inventario = await import('../systems/inventario.mjs');
  const Deposito = await import('../systems/deposito.mjs');
  const { ITEM_CATALOG } = await import('../systems/dados.mjs');
  const naoEmpilha = Number(Object.keys(ITEM_CATALOG).find((id) => ITEM_CATALOG[id].slot === 'body' && !ITEM_CATALOG[id].stackable));
  const e = quem();
  e.inventory = [];
  for (let i = 0; i < 23; i++) Inventario.darItem(e, naoEmpilha, 1);
  e.inventory.forEach((p, i) => (p.marca = i));
  const foi = Deposito.excessoParaODeposito(e);
  assert.equal(foi.length, 3);
  assert.equal(Inventario.pecasNaMochila(e), 20);
  assert.deepEqual(e.inventory.map((p) => p.marca).slice(-1), [19], 'as 3 mais recentes saíram');
  assert.match(Deposito.avisoDoExcesso(foi), /Mochila cheia: 3 item\(ns\) foram para o Depósito/);
});

test('mochila do PoE: a pilha também conta — a 21ª entrada, mesmo pilha, vai para o Depósito (nada se perde)', { skip: SEM }, async () => {
  const Inventario = await import('../systems/inventario.mjs');
  const Deposito = await import('../systems/deposito.mjs');
  const { ITEM_CATALOG } = await import('../systems/dados.mjs');
  const naoEmpilha = Number(Object.keys(ITEM_CATALOG).find((id) => ITEM_CATALOG[id].slot === 'body' && !ITEM_CATALOG[id].stackable));
  const empilhaveis = Object.keys(ITEM_CATALOG).filter((id) => ITEM_CATALOG[id].stackable && !ITEM_CATALOG[id].moeda).slice(0, 2).map(Number);
  const e = quem();
  e.inventory = Array.from({ length: 19 }, () => ({ id: naoEmpilha, count: 1 }));
  for (const id of empilhaveis) Inventario.darItem(e, id, 5);
  assert.equal(e.inventory.length, 21);
  const foi = Deposito.excessoParaODeposito(e);
  assert.deepEqual(foi.map((f) => [f.id, f.count]), [[empilhaveis[1], 5]], 'a pilha mais recente');
  assert.equal(Inventario.pecasNaMochila(e), 20);
  const noDeposito = Deposito.garantir(e).flatMap((c) => c.itens).filter((p) => p.id === empilhaveis[1]).reduce((s, p) => s + (p.count ?? 1), 0);
  assert.equal(noDeposito, 5, 'as 5 estão no Depósito');
});
