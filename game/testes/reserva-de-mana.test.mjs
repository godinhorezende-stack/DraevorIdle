// A RESERVA de mana das auras do PoE (dono, 08/10: "as magias do tipo Aura bloqueiam uma quantidade de mana — a Mana Reservada"):
// a aura não custa; liga trancando a % da mana máxima (ou o valor fixo) enquanto está na barra, só se couber na parte livre; a mana atual
// para na parte livre; a Eficácia da Reserva e os suportes mudam o tamanho; com o suporte de Vida, a reserva sai da vida.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = !existsSync(Catalogo.ARQUIVO) && 'catálogo do PoE não importado nesta máquina';
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
const Acoes = await import('../systems/acoes.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const G = await import('../systems/itens-poe/gemas-poe.mjs');
const Reserva = await import('../systems/itens-poe/reserva.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const { traduzirParte } = await import('../systems/itens-poe/traduzir.mjs');

/** Uma Bruxa level 60 com as gemas encaixadas numa varinha (sockets brancos, sem links) e na barra, caçando na Costa. */
async function bruxa(slugs, { nivel = 1, eficacia = 0 } = {}) {
  const J = await import('../systems/itens-poe/jogo.mjs');
  const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 60 });
  e.sistema = 'poe';
  e.classePoe = 'Witch';
  const arma = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Wands/Driftwood_Wand', raridade: 'normal', ilvl: 20, rng: () => 0.99 }));
  arma.soquetes = { abertos: slugs.length, links: slugs.slice(1).map(() => false), gemas: slugs.map(() => null), cores: slugs.map(() => 'W') };
  if (eficacia) arma.poe.af = { ...(arma.poe.af ?? {}), eficiencia_reserva_mana: eficacia };
  e.equipment = { ...(e.equipment ?? {}), weapon: arma };
  e.inventory = slugs.map((s) => GS.itemDaGema({ id: G.doSlug(s).itemId, nivel, xp: 0, raridade: 'comum' }));
  slugs.forEach((_, i) => GS.encaixar(e, { de: 0, slot: 'weapon', indice: i }));
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  e.mana = e.maxMana;
  e.actions = Array(Acoes.SLOTS).fill(null);
  slugs.forEach((s, i) => (e.actions[i] = { id: G.doSlug(s).acao, enabled: true, minMana: 0, conditions: [] }));
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  e.mana = e.maxMana;
  return e;
}
/** Liga a aura do slot (com o relógio da caçada andando o bastante para o tempo de uso da anterior). */
function ligar(e, slot) {
  e.hunt.clock = (e.hunt.clock ?? 0) + 10_000;
  return Acoes.disparar(e, e.hunt, PERSONAGEM, slot, null, {});
}

test('a reserva de cada gema, como no PoE: % da máxima (auras fortes, Purezas, Arautos) ou valor fixo que sobe com o nível (Clareza)', { skip: SEM }, () => {
  assert.deepEqual(Reserva.daGema('Determination', 1), { pct: 50 });
  assert.deepEqual(Reserva.daGema('Purity_of_Fire', 1), { pct: 35 });
  assert.deepEqual(Reserva.daGema('Herald_of_Ash', 1), { pct: 25 });
  assert.deepEqual(Reserva.daGema('Clarity', 1), { fixo: 34 });
  assert.ok(Reserva.daGema('Clarity', 20).fixo > 34, 'sobe com o nível');
  assert.equal(Reserva.daGema('War_Banner', 1), null, 'a bandeira não reserva');
  assert.equal(Reserva.daGema('Fireball', 1), null);
});

test('ligar a aura não gasta mana: tranca 50% da máxima, a atual para na parte livre e a aura fica ligada sem expirar', { skip: SEM }, async () => {
  const e = await bruxa(['Determination']);
  const max = e.maxMana;
  const r = ligar(e, 0);
  assert.equal(r.ok, true, r.erro);
  const b = e.hunt.buffs[G.doSlug('Determination').acao];
  assert.equal(b.ate, Reserva.LIGADA_ATE, 'não expira');
  assert.deepEqual({ recurso: b.reserva.recurso, pct: b.reserva.pct }, { recurso: 'mana', pct: 50 });
  assert.equal(Reserva.reservadas(e).mana, Math.ceil(max * 0.5));
  assert.equal(e.mana, max - Math.ceil(max * 0.5), 'a atual vai para a parte livre (e nada foi gasto além disso)');
  // A regeneração enche só até a parte livre.
  e.mana = 0;
  Cacadas.regenerar(e, 600_000);
  assert.equal(e.mana, max - Math.ceil(max * 0.5));
  // A tela: o cartão mostra quanto reserva, sem relógio.
  const cartao = Acoes.buffsAtivos(e.hunt, e).find((x) => x.reserva);
  assert.deepEqual(cartao.reserva, { recurso: 'mana', valor: Math.ceil(max * 0.5), pct: 50 });
  assert.equal(ligar(e, 0).motivo, 'EFEITO_ATIVO', 'já ligada');
});

test('duas auras de 50% cabem (a mana livre vai a zero); a terceira não liga — "sem mana livre"', { skip: SEM }, async () => {
  const e = await bruxa(['Determination', 'Hatred', 'Grace']);
  assert.equal(ligar(e, 0).ok, true);
  assert.equal(ligar(e, 1).ok, true);
  assert.equal(Reserva.livre(e).mana, e.maxMana - 2 * Math.ceil(e.maxMana * 0.5));
  const terceira = ligar(e, 2);
  assert.equal(terceira.ok, false);
  assert.equal(terceira.motivo, 'RESERVA');
  assert.match(terceira.erro, /Sem mana livre para reservar/);
});

test('a Clareza (valor fixo) reserva o número dela e não custa nada a cada lançamento', { skip: SEM }, async () => {
  const e = await bruxa(['Clarity']);
  const max = e.maxMana;
  assert.equal(ligar(e, 0).ok, true);
  assert.equal(Reserva.reservadas(e).mana, 34);
  assert.equal(e.mana, max - 34);
  // A barra (o catálogo das ações para a tela) mostra custo 0 — antes cobrava os 34 a cada lançamento.
  const naBarra = Acoes.catalogo(e).spells.find((a) => a.id === G.doSlug('Clarity').acao);
  assert.ok(naBarra, 'a Clareza está no catálogo');
  assert.equal(naBarra.mana, 0, 'custo 0');
});

test('a Eficácia da Reserva de Mana (passivas e peças) reduz a reserva: 50% ÷ 1,5 = 33,3% da máxima', { skip: SEM }, async () => {
  const e = await bruxa(['Determination'], { eficacia: 50 });
  assert.equal(ligar(e, 0).ok, true);
  assert.equal(Reserva.reservadas(e).mana, Math.ceil(e.maxMana * 0.5 / 1.5));
  // E a frase do PoE vira o atributo (antes era inerte: "as auras do jogo não reservam mana").
  const t = traduzirParte('Eficácia da Reserva de Mana das Habilidades aumentada em {0}%', [20]);
  assert.deepEqual(t.efeitos.map((x) => [x.stat, x.valor]), [['eficiencia_reserva_mana', 20]]);
  assert.deepEqual(traduzirParte('Eficácia da Reserva das Habilidades aumentada em {0}%', [8]).efeitos.map((x) => x.stat), ['eficiencia_reserva']);
  assert.deepEqual(traduzirParte('Eficácia da Reserva de Vida das Habilidades aumentada em {0}%', [8]).efeitos.map((x) => x.stat), ['eficiencia_reserva_vida']);
  assert.deepEqual(traduzirParte('Eficácia da Reserva de Mana das Habilidades Arauto aumentada em {0}%', [30]).efeitos.map((x) => x.stat), ['eficiencia_reserva_arauto']);
});

test('com o suporte que reserva Vida (Arrogância) ou o Magia Sanguínea, a reserva sai da VIDA', { skip: SEM }, async () => {
  const e = await bruxa(['Determination']);
  e.hunt.clock = (e.hunt.clock ?? 0) + 10_000;
  const entry = { id: 'x', name: 'Teste', poeGema: { slug: 'Determination', buff: true, arquetipo: 'aura' } };
  const r = Reserva.pedida(e, entry, { nivel: 1, custoEmVida: 1 }, Ficha.combate(e), true);
  assert.equal(r.recurso, 'vida');
  assert.equal(r.valor, Math.ceil(e.maxHp * 0.5));
  assert.equal(Reserva.cabe(e, 'x', r), true);
  (e.hunt.buffs ??= {}).x = { ate: Reserva.LIGADA_ATE, reserva: { recurso: 'vida', pct: 50, fator: 1 } };
  e.hp = e.maxHp;
  Reserva.cortarNoLivre(e);
  assert.equal(e.hp, e.maxHp - Math.ceil(e.maxHp * 0.5), 'a vida atual para na parte livre');
});

test('a gema saiu da barra (ou foi desligada no slot): a aura desliga e a mana volta a ser livre', { skip: SEM }, async () => {
  const e = await bruxa(['Determination']);
  assert.equal(ligar(e, 0).ok, true);
  assert.ok(Reserva.reservadas(e).mana > 0);
  e.actions[0].enabled = false;
  assert.equal(Acoes.desligarAurasForaDaBarra(e, e.hunt), true);
  assert.equal(Reserva.reservadas(e).mana, 0);
  e.mana = 0;
  Cacadas.regenerar(e, 600_000);
  assert.equal(e.mana, e.maxMana, 'enche até a máxima de novo');
});
