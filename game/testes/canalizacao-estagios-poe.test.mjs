// Os ESTÁGIOS DE CANALIZAÇÃO (lote G10, 17/10): cada uso seguido da mesma habilidade canalizada ganha um estágio, até o máximo; no máximo a
// canalização se LIBERA (a abstração do idle — no PoE, soltar o botão). A Rajada de Chamas e a Flecha Flagelante só carregam até lá e então
// explodem com "X% mais Dano por estágio" × os estágios; as Lâminas Velozes e o Incinerar acertam a cada uso com o dano do estágio e, no
// máximo, soltam os golpes finais / a onda final; outra habilidade no meio zera os estágios.
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

async function com(gema, base) {
  const J = await import('../systems/itens-poe/jogo.mjs');
  const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
  const e = Object.assign(personagemDeTeste({ vocacao: 'sorcerer', level: 80 }), { classePoe: 'Shadow', sistema: 'poe' });
  const arma = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 1, rng: () => 0.5 }));
  arma.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
  e.equipment = { ...e.equipment, weapon: arma };
  delete e.equipment.shield;
  e.inventory = [GS.itemDaGema({ id: G.doSlug(gema).itemId, nivel: 20, xp: 0, raridade: 'comum' })];
  GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: G.doSlug(gema).acao, enabled: true, minMana: 0, conditions: [] };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 1e7;
  e.hunt.monstros.forEach((m, i) => Object.assign(m, i ? { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60 } : { x: e.hunt.pos.x + 1, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12 }));
  return e;
}
function comSorte(v, fn) { const a = Math.random; Math.random = () => v; try { return fn(); } finally { Math.random = a; } }
/** Um uso (com a conjuração) seguido do anterior; o dano no alvo pelos eventos deste uso. */
function usar(e) {
  const b = e.hunt.monstros[0];
  return comSorte(0.5, () => {
    const r = Acoes.disparar(e, e.hunt, PERSONAGEM, 0, b, { manual: true });
    assert.ok(r.ok, r.erro);
    const ev = [...(r.eventos ?? [])];
    if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; ev.push(...(Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM) ?? [])); }
    // o próximo uso logo depois do fim deste (a canalização continua)
    e.hunt.clock = Math.max(e.hunt.clock, (e.hunt.canalizacao?.ate ?? e.hunt.clock));
    return ev.filter((x) => x.t === 'dmg' && x.uid === b.uid && x.foe).reduce((t, x) => t + x.v, 0);
  });
}

test('G10: os estágios no nível 20 (o PoE)', { skip: SEM }, () => {
  assert.deepEqual([G.estagiosDaGema('Flameblast', 20).max, G.estagiosDaGema('Flameblast', 20).mais, G.estagiosDaGema('Flameblast', 20).modo], [10, 165, 'carrega']);
  assert.deepEqual([G.estagiosDaGema('Blade_Flurry', 20).max, G.estagiosDaGema('Blade_Flurry', 20).mais, G.estagiosDaGema('Blade_Flurry', 20).modo], [6, 25, 'intensifica']);
  assert.equal(G.estagiosDaGema('Incinerate', 20).final, 500);
  assert.equal(G.estagiosDaGema('Cyclone_of_Tumult', 20).modo, 'tempo');
  assert.ok(!G.doSlug('Flameblast').motivosNoJogo.some((m) => /estágios de canalização/.test(m)));
  // o compilador não lê mais o "Área aumentada por cada 0,1 metro de Alcance" como fixo
  assert.equal(G.compilada('Cyclone_of_Tumult', 20).stats.areaInc ?? 0, 0);
});

test('G10: a Rajada de Chamas carrega 9 usos sem dano e explode no 10º; depois recomeça do 1', { skip: SEM }, async () => {
  const e = await com('Flameblast', 'Wands/Driftwood_Wand');
  const danos = Array.from({ length: 11 }, () => usar(e));
  assert.deepEqual(danos.slice(0, 9).map((d) => d > 0), Array(9).fill(false), `carregando: ${danos}`);
  assert.ok(danos[9] > 0, `a explosão no 10º: ${danos}`);
  assert.equal(danos[10], 0, 'recomeça carregando');
});

test('G10: as Lâminas Velozes ganham 25% mais dano por estágio a cada uso; no 6º soltam um golpe por estágio', { skip: SEM }, async () => {
  const e = await com('Blade_Flurry', 'Daggers/Sai');
  const d = Array.from({ length: 6 }, () => usar(e));
  assert.ok(d.every((x) => x > 0), String(d));
  // do estágio 1 ao 2: (1 + 0,5) / (1 + 0,25) = 1,2
  assert.ok(Math.abs(d[1] / d[0] - 1.5 / 1.25) < 0.03, `${d[1] / d[0]}`);
  // a liberação no 6: (1 + 1,5) × (1 + 6 golpes) contra o estágio 5 (1 + 1,25)
  // (5% relativo: o dano-base do personagem de teste cresce ~1% a cada uso — algum acúmulo dele; o "mais" do estágio é o que se mede)
  assert.ok(Math.abs(d[5] / d[4] / ((2.5 * 7) / 2.25) - 1) < 0.05, `${d[5] / d[4]}`);
});
