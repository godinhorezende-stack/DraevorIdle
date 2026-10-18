// Os CLAMORES pelo PODER (lote G5, 17/10): "Conta o Poder total de Inimigos no Alcance" (cada inimigo perto vale 1, Mágico 2, Raro 10, Único
// 20 — `ModsPoe.poderDoClamor`), e o buff "por cada N de Poder, contando um máximo de M" (Resistente: vida regenerada; Ancestral:
// resistências e o máximo delas; Sísmico: mais Armadura; Vingativo: Fúria por segundo, máximo, sem perda), as Cargas de Tolerância por Poder
// e o "Ataques Impelidos causam Dano Dobrado". Mede no jogo: o clamor usado, o buff com os atributos e as cargas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
const Acoes = await import('../systems/acoes.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const G = await import('../systems/itens-poe/gemas-poe.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');

async function guerreiroCom(gema, nivel = 20) {
  const J = await import('../systems/itens-poe/jogo.mjs');
  const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 80 }), { classePoe: 'Marauder', sistema: 'poe' });
  const arma = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'One_Hand_Axes/Rusted_Hatchet', raridade: 'normal', ilvl: 1, rng: () => 0.5 }));
  arma.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
  e.equipment = { ...e.equipment, weapon: arma };
  e.inventory = [GS.itemDaGema({ id: G.doSlug(gema).itemId, nivel, xp: 0, raridade: 'comum' })];
  GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: G.doSlug(gema).acao, enabled: true, minMana: 0, conditions: [] };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 1e6;
  return e;
}
/** `n` inimigos normais colados em você (o resto longe): Poder n. */
function cercar(e, n, raridade = 'normal') {
  e.hunt.monstros.forEach((m, i) => Object.assign(m, i < n ? { x: e.hunt.pos.x + 1 + (i % 3), y: e.hunt.pos.y + Math.floor(i / 3), hp: 1e9, maxHp: 1e9, raridade } : { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60 }));
}
function clamar(e) {
  const r = Acoes.disparar(e, e.hunt, PERSONAGEM, 0, e.hunt.monstros[0], {});
  assert.ok(r.ok, r.erro);
  if (r.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM); }
  return Object.values(e.hunt.buffs ?? {})[0];
}

test('G5: os números por Poder de cada clamor', { skip: SEM }, () => {
  // Resistente nível 20: 2% da Vida por segundo por 5 de Poder (até 25) e 1 Carga de Tolerância por 5 de Poder
  assert.deepEqual(G.clamorPeloPoder('Enduring_Cry', 20, 12), { af: { life_regen_pct: 4 }, tolerancia: 2 });
  assert.deepEqual(G.clamorPeloPoder('Enduring_Cry', 20, 100).af, { life_regen_pct: 10 }, 'o máximo de 25 de Poder');
  assert.equal(G.clamorPeloPoder('Enduring_Cry', 20, 100).tolerancia, 20, 'as cargas não têm o máximo de Poder (o teto é o das cargas)');
  const ancestral = G.clamorPeloPoder('Ancestral_Cry', 20, 30).af;
  assert.equal(ancestral.fire_res, 30);
  assert.equal(ancestral.ice_res_max, 3);
  assert.equal(G.clamorPeloPoder('Seismic_Cry', 20, 50).af.armour_mais, 25);
  const vingativo = G.clamorPeloPoder('Vengeful_Cry', 20, 10).af;
  assert.equal(vingativo['periodico:1:furia'], 6);
  assert.equal(vingativo.furia_max, 25);
  assert.equal(G.clamorPeloPoder('Intimidating_Cry', 20, 0).af['chance_dano_dobrado@impelido'], 100);
  for (const s of ['Enduring_Cry', 'Ancestral_Cry', 'Vengeful_Cry']) assert.ok(!G.doSlug(s).motivosNoJogo.some((m) => /Poder|Fúria/.test(m)), `${s}: ${G.doSlug(s).motivosNoJogo.join(' | ')}`);
});

test('G5: o Clamor Resistente com 10 inimigos colados — o buff regenera 4% da vida por segundo e você ganha 2 Cargas de Tolerância', { skip: SEM }, async () => {
  const e = await guerreiroCom('Enduring_Cry');
  cercar(e, 10);
  const b = clamar(e);
  assert.equal(b?.afPoe?.life_regen_pct, 4, JSON.stringify(b?.afPoe));
  assert.equal(e.hunt.cargasPoe?.tolerancia?.n, 2);
  // com 1 inimigo só: Poder 1 — nada por Poder
  const so = await guerreiroCom('Enduring_Cry');
  cercar(so, 1);
  const b1 = clamar(so);
  assert.equal(b1?.afPoe?.life_regen_pct ?? 0, 0);
});
