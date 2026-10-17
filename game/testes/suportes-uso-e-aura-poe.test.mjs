// Suportes do lote G14 (17/10): os que mexem em modificadores do USO (`af:<atributo>` — empurrão, atordoamento, vida por acerto, velocidade de
// clamor, multiplicador degenerativo dos críticos, duração das afecções), no ricochete, na maldição (a duração) e na AURA suportada (o efeito,
// a área, "não afeta você"). Mede no jogo: a vida por acerto do suporte num ataque de gema; o efeito da aura na ficha; a Generosidade.
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
const SP = await import('../systems/itens-poe/suportes-poe.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');

async function com(base, ativa, suportes = [], classePoe = 'Marauder') {
  const J = await import('../systems/itens-poe/jogo.mjs');
  const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 80 }), { classePoe, sistema: 'poe' });
  const n = 1 + suportes.length;
  const arma = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 1, rng: () => 0.5 }));
  arma.soquetes = { abertos: n, links: Array.from({ length: n - 1 }, () => true), gemas: Array(n).fill(null), cores: Array(n).fill('W') };
  e.equipment = { ...e.equipment, weapon: arma };
  e.inventory = [ativa, ...suportes].map((s) => GS.itemDaGema({ id: (G.doSlug(s) ?? SP.doSlug(s)).itemId, nivel: 20, xp: 0, raridade: 'comum' }));
  for (let i = 0; i < n; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: G.doSlug(ativa).acao, enabled: true, minMana: 0, conditions: [] };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 1e6;
  return e;
}
function usar(e, alvo) {
  const r = Acoes.disparar(e, e.hunt, PERSONAGEM, 0, alvo, { manual: true });
  assert.ok(r.ok, r.erro);
  if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM); }
  return r;
}

test('G14: os efeitos dos suportes no nível 20', { skip: SEM }, () => {
  assert.deepEqual(SP.efeitoNoNivel('Knockback_Support', 20).efeito, { 'af:chance_empurrar': 44, 'af:distancia_empurrao': 50 });
  assert.equal(SP.efeitoNoNivel('Life_Gain_on_Hit_Support', 20, 0, { tags: ['poe:Ataque'] }).efeito['af:life_on_hit'], 44);
  assert.equal(SP.efeitoNoNivel('Arrogance_Support', 20).efeito.efeitoAuraPct, 19);
  assert.equal(SP.efeitoNoNivel('Generosity_Support', 20).efeito.auraSoAliados, 1);
  for (const s of ['Knockback_Support', 'Arrogance_Support', 'Life_Gain_on_Hit_Support', 'Urgent_Orders_Support', 'Critical_Strike_Affliction_Support']) assert.equal(SP.doSlug(s).status, 'funciona', `${s}: ${SP.doSlug(s).motivos.join(' | ')}`);
});

test('G14: a Vida no Acerto do suporte cura a cada inimigo acertado pela gema de ataque', { skip: SEM }, async () => {
  const e = await com('One_Hand_Axes/Rusted_Hatchet', 'Cleave', ['Life_Gain_on_Hit_Support']);
  const [b, ...resto] = e.hunt.monstros;
  for (const m of resto) Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60 });
  Object.assign(b, { x: e.hunt.pos.x + 1, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12 });
  e.hp = Math.max(1, e.maxHp - 500);
  const antes = e.hp;
  usar(e, b);
  assert.ok(e.hp - antes >= 44, `curou ${e.hp - antes}`);
});

test('G14: a Arrogância aumenta o efeito da aura suportada; a Generosidade tira a aura de você', { skip: SEM }, async () => {
  // (a Pureza do Fogo: a reserva cabe dobrada pela Arrogância — a Determinação, 50% × 2,01, passaria de 100%, como no PoE)
  const nivelDe = (e) => Ficha.combate(e).afPoe.fire_res_max ?? 0;
  const so = await com('One_Hand_Axes/Rusted_Hatchet', 'Purity_of_Fire');
  usar(so, so.hunt.monstros[0]);
  Ficha.invalidar(so);
  const base = nivelDe(so);
  assert.ok(base > 0, 'a Pureza do Fogo dá o máximo de Resistência a Fogo');
  const arr = await com('One_Hand_Axes/Rusted_Hatchet', 'Purity_of_Fire', ['Arrogance_Support']);
  // (a Arrogância reserva Vida no lugar da Mana: vida de sobra para a reserva — o que se mede é o efeito da aura)
  arr.maxHp = arr.hp = 1e6;
  usar(arr, arr.hunt.monstros[0]);
  Ficha.invalidar(arr);
  assert.ok(Math.abs(nivelDe(arr) / base - 1.19) < 0.01, `${nivelDe(arr)} / ${base}`);
  const gen = await com('One_Hand_Axes/Rusted_Hatchet', 'Purity_of_Fire', ['Generosity_Support']);
  usar(gen, gen.hunt.monstros[0]);
  Ficha.invalidar(gen);
  assert.equal(nivelDe(gen), 0, 'a Generosidade: a aura não afeta você');
});
