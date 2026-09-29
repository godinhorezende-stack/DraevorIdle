// A Forja inteira — as quatro abas do client (Tier, Afixos, Craft, Desmanche) —
// confrontada com as fichas REAIS capturadas do original (`api-mapeada/servidor/`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as Forja from '../systems/forja.mjs';
import * as Afixos from '../systems/afixos.mjs';
import * as Craft from '../systems/craft.mjs';
import * as Desmanche from '../systems/desmanche.mjs';
import { contarGuardadas } from '../systems/inventario.mjs';
import { personagemDeTeste, comMarcaNova } from './apoio.mjs';

const API = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'api-mapeada', 'servidor');
const capturado = (arquivo) => comMarcaNova(JSON.parse(readFileSync(join(API, arquivo), 'utf8')));
const semT = ({ t, ...resto }) => resto;

function vazio(extra = {}) {
  return Object.assign(personagemDeTeste({ level: 400 }), { equipment: {}, inventory: [], pouch: [], gold: 0, bank: 0 }, extra);
}

/** O personagem da captura (Zotod), remontado peça por peça a partir das fichas reais. */
function oDaCaptura() {
  const tier = capturado('forja.json');
  const afixos = capturado('forjaAfixos.json');
  const e = vazio({ gold: tier.gold, coins: afixos.coins });
  const tierDe = new Map(tier.pecas.map((p) => [JSON.stringify(p.lugar), p.tier]));
  for (const p of afixos.pecas) {
    const peca = { ...p.peca };
    if (tierDe.get(JSON.stringify(p.lugar))) peca.tier = tierDe.get(JSON.stringify(p.lugar));
    if (p.lugar.onde === 'equip') e.equipment[p.lugar.slot] = peca;
    else (p.lugar.onde === 'pouch' ? e.pouch : e.inventory)[p.lugar.indice] = peca;
  }
  // Duas casas da bolsa não aparecem nas fichas (não são peça de forja): um item empilhável qualquer.
  e.pouch = Array.from({ length: e.pouch.length }, (_, i) => e.pouch[i] ?? { id: 3577, count: 5 });
  return { e, tier, afixos };
}

// ---- Fidelidade: a MESMA ficha que o original mandou ----

test('TIER: a ficha é idêntica à real (139 peças, com a bolsa de loot)', () => {
  const { e, tier } = oDaCaptura();
  assert.deepEqual(semT(Forja.viewDoTier(e)), tier);
});

/*
 * O sistema de itens (29/09) trocou DE PROPÓSITO a régua de cada atributo (o
 * teto dobrou, pedido do dono), os nomes ("Ataque" -> "ATK") e o "tier" do
 * atributo virou "nível" (1–5). O que continua tendo de ser igual ao original:
 * as peças, os slots, os custos, quantos atributos, quais, com que valor e se
 * é "torto" — os campos que dependem da régua saem da comparação.
 */
const DA_REGUA = ['min', 'max', 'pct', 'nome', 'texto', 'tier', 'nivel'];
// E o limite de atributos, que passou a ser o da raridade (Comum 1 ... Mítico 6).
// E a raridade: equipável sem drop é comum agora (o dono: "o que define é o
// drop"), e a captura trazia a do catálogo — ver `raridadeDaPeca`.
const DO_LIMITE = ['vagas', 'maxAfixos', 'rarity'];
function semRegua(o) {
  if (Array.isArray(o)) return o.map(semRegua);
  if (!o || typeof o !== 'object') return o;
  const ehAfixo = 'valor' in o && 'id' in o && typeof o.id === 'string';
  return Object.fromEntries(
    Object.entries(o)
      .filter(([k]) => !(ehAfixo && DA_REGUA.includes(k)) && !DO_LIMITE.includes(k))
      .map(([k, v]) => [k, semRegua(v)]),
  );
}

test('AFIXOS: a ficha é idêntica à real (145 peças, mochila incluída, "torto" por perícia da arma)', () => {
  const { e, afixos } = oDaCaptura();
  assert.deepEqual(semRegua(semT(Forja.viewDosAfixos(e))), semRegua(afixos));
});

test('CRAFT: as fichas das 5 vocações são idênticas às reais (Craftado e V2)', () => {
  for (const [voc, real] of Object.entries(capturado('craft-por-vocacao.json'))) {
    const e = vazio({ vocation: real.minha, gold: real.gold });
    assert.deepEqual(semT(Craft.view(e, { vocacao: voc })), real, voc);
  }
});

test('DESMANCHE: a ficha é idêntica à real (7 grupos, 134 peças)', () => {
  assert.deepEqual(semT(Desmanche.view(vazio())), capturado('desmanche.json'));
});

// ---- Afixos: a regra do "torto" também vale no sorteio ----

test('sorteio de afixo numa arma: a única perícia natural é a dela', () => {
  const HAND_AXE = 3268;
  for (let i = 0; i < 3000; i++) {
    for (const a of Afixos.rolarDrop(HAND_AXE)) {
      const v = Afixos.viewDoAfixo(a, 'weapon', HAND_AXE);
      if (a.id.startsWith('skill_')) assert.equal(v.torto, a.id !== 'skill_axe', a.id);
    }
  }
  assert.equal(Afixos.rolarDrop(2854), null, 'mochila não cai com afixo');
});

test('reroll mantendo o afixo SEMPRE sobe o número, mesmo numa régua curta (perícia 1–3)', () => {
  for (let i = 0; i < 2000; i++) {
    const af = [{ id: 'skill_shielding', tier: 2, value: 2 }, { id: 'crit_chance', tier: 1, value: 1.2 }];
    for (const indice of [0, 1]) {
      const novo = Afixos.rerrolar('weapon', af, indice, 3268);
      if (novo.id === af[indice].id) assert.ok(novo.value > af[indice].value, `${novo.id}: ${af[indice].value} → ${novo.value}`);
    }
  }
  // No topo ele não passa do máximo da régua (a do sistema de itens: o fim do Nível 5).
  const max = Afixos.FICHAS.skill_axe.max;
  const topo = Afixos.rerrolar('weapon', [{ id: 'skill_axe', nivel: 5, value: max }], 0, 3268);
  if (topo.id === 'skill_axe') assert.equal(topo.value, max);
});

// ---- Craft: fazer de verdade ----

const DRAEVOR_AXE = 55178;
const CRAFTED_AXE = 55197;

function comTudoParaOCraftedAxe(extraDaBase = {}) {
  const e = vazio({ vocation: 'knight', gold: 150_000_000, bank: 100_000_000 });
  const receita = Craft.view(e, { vocacao: 'knight' }).craftado.find((r) => r.id === CRAFTED_AXE);
  for (const m of receita.materiais) {
    if (m.dinheiro) continue;
    if (m.id === DRAEVOR_AXE) e.equipment.weapon = { id: DRAEVOR_AXE, count: 1, ...extraDaBase };
    else e.inventory.push({ id: m.id, count: m.precisa });
  }
  // Uma sobra que não pode sumir: o craft só tira o que a receita pede.
  e.inventory.push({ id: 22721, count: 7 });
  return { e, receita };
}

test('craft: com tudo em mãos, a peça sai HERDANDO tier, imbuements e afixos, no lugar da base', () => {
  const af = [{ id: 'crit_chance', tier: 2, value: 3 }];
  const { e } = comTudoParaOCraftedAxe({ tier: 4, imbu: [{ id: 1 }], af });
  const antes = Craft.view(e, { vocacao: 'knight' }).craftado.find((r) => r.id === CRAFTED_AXE);
  assert.equal(antes.pronto, true);
  assert.deepEqual(antes.herda, { id: DRAEVOR_AXE, nome: 'Draevor Knight Axe', tem: 1, tier: 4, imbuements: 1, afixos: 1, extras: { tier: 4, imbu: [{ id: 1 }], af } });

  const r = Craft.craftar(e, { vocacao: 'knight', geracao: 'craftado', id: CRAFTED_AXE });
  assert.ok(r.ok, r.erro);
  assert.deepEqual(e.equipment.weapon, { id: CRAFTED_AXE, count: 1, tier: 4, imbu: [{ id: 1 }], af });
  assert.deepEqual(r.craftou, { id: CRAFTED_AXE, nome: 'Crafted Draevor Knight Axe', base: 'Draevor Knight Axe', herdou: { tier: 4, imbu: [{ id: 1 }], af } });
  // 200 milhões: 150 do bolso, 50 do banco.
  assert.deepEqual([e.gold, e.bank], [0, 50_000_000]);
  // Os materiais sumiram; a sobra de gold token ficou.
  assert.deepEqual(e.inventory, [{ id: 22721, count: 7 }]);
});

test('craft: base vestida e peça nova de level alto demais → a nova vai para a mochila, não para o corpo', () => {
  const e = vazio({ vocation: 'knight', level: 43, gold: 1e9 });
  e.equipment.weapon = { id: CRAFTED_AXE, count: 1, tier: 10 };
  const v2 = Craft.view(e, { vocacao: 'knight' }).v2.find((r) => r.herda?.id === CRAFTED_AXE);
  for (const m of v2.materiais) if (!m.dinheiro && m.id !== CRAFTED_AXE) e.inventory.push({ id: m.id, count: m.precisa });
  const r = Craft.craftar(e, { vocacao: 'knight', geracao: 'v2', id: v2.id });
  assert.ok(r.ok, r.erro);
  assert.equal(e.equipment.weapon, null);
  assert.deepEqual(e.inventory.find((p) => p.id === v2.id), { id: v2.id, count: 1, tier: 10 });
});

test('craft: falta material → recusa sem tirar nada', () => {
  const { e } = comTudoParaOCraftedAxe();
  e.inventory = e.inventory.filter((p) => p.id !== 34109); // sem as Bag You Desire
  const antes = structuredClone(e);
  const r = Craft.craftar(e, { vocacao: 'knight', geracao: 'craftado', id: CRAFTED_AXE });
  assert.equal(r.ok, false);
  assert.match(r.erro, /Faltam 1 materiais/);
  assert.deepEqual(e, antes);
});

test('craft: o V2 exige o Craftado como base (e herda dele)', () => {
  const e = vazio({ vocation: 'knight' });
  const v2 = Craft.view(e, { vocacao: 'knight' }).v2.find((r) => r.herda?.id === CRAFTED_AXE);
  assert.ok(v2, 'existe o V2 do Crafted Axe');
  assert.equal(v2.materiais.find((m) => m.id === CRAFTED_AXE).ok, false);
  e.inventory.push({ id: CRAFTED_AXE, count: 1, tier: 2 });
  const depois = Craft.view(e, { vocacao: 'knight' }).v2.find((r) => r.id === v2.id);
  assert.equal(depois.materiais.find((m) => m.id === CRAFTED_AXE).ok, true);
  assert.equal(depois.herda.tier, 2);
});

test('craft: receita e vocação inexistentes são recusadas', () => {
  const e = vazio();
  assert.equal(Craft.craftar(e, { vocacao: 'bardo', geracao: 'craftado', id: CRAFTED_AXE }).ok, false);
  assert.equal(Craft.craftar(e, { vocacao: 'knight', geracao: 'craftado', id: 1 }).ok, false);
  // Consultar outra vocação vale (a tira de cima do client); vocação inválida cai na sua.
  assert.equal(Craft.view(e, { vocacao: 'druid' }).vocacao, 'druid');
  assert.equal(Craft.view(e, { vocacao: 'bardo' }).vocacao, 'knight');
});

// ---- Desmanche: fazer de verdade ----

const SOULCUTTER = 34082; // Soulwar: 5 tokens
const BLADE_DESTRUCTION = 27449; // Destructions: 2 tokens

test('desmanche: mostra só o que tem, separa as peças presas e desmancha várias de uma vez', () => {
  const e = vazio();
  e.inventory.push({ id: SOULCUTTER, count: 1 }, { id: SOULCUTTER, count: 1, tier: 3 });
  e.pouch.push({ id: SOULCUTTER, count: 1 }, { id: BLADE_DESTRUCTION, count: 1 }, { id: BLADE_DESTRUCTION, count: 1 });
  const soulwar = Desmanche.view(e).categorias.find((c) => c.nome === 'Soulwar');
  assert.deepEqual(soulwar.itens, [{ id: SOULCUTTER, nome: 'soulcutter', pode: 2, presas: 1, motivo: 'estão com tier, imbuement ou afixo', tokens: 5 }]);
  assert.equal(soulwar.todos.find((p) => p.id === SOULCUTTER).tem, 3);

  const r = Desmanche.desmanchar(e, { pedidos: [{ id: SOULCUTTER, quantidade: 2 }, { id: BLADE_DESTRUCTION, quantidade: 2 }] });
  assert.ok(r.ok, r.erro);
  assert.equal(r.notice, '4 peças viraram 14 Dismantle Token.');
  // A com tier ficou; as limpas saíram; 14 tokens na mochila.
  assert.deepEqual(contarGuardadas(e, SOULCUTTER), { limpas: 0, comExtras: 1 });
  assert.equal(contarGuardadas(e, BLADE_DESTRUCTION).limpas, 0);
  assert.equal(Desmanche.view(e).token, 14);
});

test('desmanche: é tudo ou nada, e nunca leva peça presa', () => {
  const e = vazio();
  e.inventory.push({ id: SOULCUTTER, count: 1 }, { id: SOULCUTTER, count: 1, af: [{ id: 'hp_max', tier: 1, value: 1 }] }, { id: BLADE_DESTRUCTION, count: 1 });
  const antes = structuredClone(e);
  for (const pedidos of [
    [{ id: SOULCUTTER, quantidade: 2 }], // só 1 limpa
    [{ id: BLADE_DESTRUCTION, quantidade: 1 }, { id: SOULCUTTER, quantidade: 2 }], // a primeira daria, a segunda não
    [{ id: 3268, quantidade: 1 }], // hand axe: a máquina não aceita
    [{ id: SOULCUTTER, quantidade: 0 }],
    [],
  ]) {
    assert.equal(Desmanche.desmanchar(e, { pedidos }).ok, false, JSON.stringify(pedidos));
    assert.deepEqual(e, antes);
  }
});
