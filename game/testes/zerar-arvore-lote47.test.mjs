// LOTE 47 (S002 — achado no lote 32; dono, 16/10: "Pode baixar" os `act_*.lua` do PoB): a EFICÁCIA DO DANO ADICIONADO das magias por nível —
// antes 1 em todas (a tabela de níveis do poedb não traz a coluna) —, a do PoB (`damageEffectiveness`): a Bola de Fogo 300% no nível 1 e 480%
// no 20 (a faixa "(300 — 480)%" do poedb), o Arauto do Gelo 80%; o dano adicionado às magias (peças, suportes, varinhas) entra × ela.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const Ficha = await import('../systems/ficha.mjs');
const GemasPoe = await import('../systems/itens-poe/gemas-poe.mjs');
const Acoes = await import('../systems/acoes.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Gerar = await import('../systems/itens-poe/gerar.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  Jogo.iniciar(ITEM_CATALOG);
}

const peca = (base) => Jogo.pecaDoJogo(Gerar.gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 1, rng: () => 0.5 }));
const ANEL = Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'might ring')?.id);
/** Uma Bruxa com a `gema` (nível `nivel`) numa varinha e, se `af`, um anel com ele. Devolve o dano que o balão mostra. */
function dano(gema, nivel, af = null) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'sorcerer', level: 80 }), { classePoe: 'Witch' });
  const arma = peca('Wands/Driftwood_Wand');
  arma.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
  e.equipment = { ...e.equipment, weapon: arma };
  if (af) e.equipment.ring = { id: ANEL, count: 1, af: [], poe: { af } };
  e.inventory = [GS.itemDaGema({ id: GemasPoe.doSlug(gema).itemId, nivel, xp: 0, raridade: 'comum' })];
  GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  return Acoes.danoMostrado(e, Acoes.POR_ID_PUBLICO(GemasPoe.doSlug(gema).acao));
}

test('S002 — a eficácia do dano adicionado das magias pelo PoB: a Bola de Fogo 3 → 4,8 (nível 1 → 20), a Nova de Gelo 2,5, o Arauto do Gelo 0,8; o ataque segue o "Dano de Ataque" do poedb', { skip: SEM }, () => {
  assert.equal(GemasPoe.eficaciaDoAdicionado('Fireball', 1), 3);
  assert.equal(GemasPoe.eficaciaDoAdicionado('Fireball', 20), 4.8);
  assert.equal(GemasPoe.eficaciaDoAdicionado('Ice_Nova', 20), 2.5);
  assert.equal(GemasPoe.eficaciaDoAdicionado('Herald_of_Ice', 20), 0.8);
  // acima da tabela, o último nível dela
  assert.equal(GemasPoe.eficaciaDoAdicionado('Fireball', 45), GemasPoe.eficaciaDoAdicionado('Fireball', 40));
  // sem a gema no PoB, a da tabela do poedb
  assert.equal(GemasPoe.eficaciaDoAdicionado('Heavy_Strike', 20), GemasPoe.eficaciaNoNivel('Heavy_Strike', 20));
});

test('S002 — no golpe: o "Adiciona 10 a 20 de Dano de Fogo a Magias" do anel entra na Bola de Fogo nível 20 × 4,8', { skip: SEM }, () => {
  const sem = dano('Fireball', 20);
  const com = dano('Fireball', 20, { spell_added_fire_dmg_min: 10, spell_added_fire_dmg_max: 20 });
  const base = GemasPoe.danoNoNivel('Fireball', 20);
  // o anel só soma dano plano: os multiplicadores são os mesmos — (com − sem) ÷ sem = (adicionado × 4,8) ÷ a base da gema
  assert.ok(Math.abs((com.max - sem.max) / sem.max - (20 * 4.8) / base.max) < 0.02, `${com.max} vs ${sem.max} (base ${base.max})`);
  assert.ok(Math.abs((com.min - sem.min) / sem.min - (10 * 4.8) / base.min) < 0.02, `${com.min} vs ${sem.min} (base ${base.min})`);
});
