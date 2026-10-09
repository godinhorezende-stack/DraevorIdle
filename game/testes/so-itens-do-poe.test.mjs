// O jogo oficial é o do PoE (dono, 07/10): SÓ CONTEÚDO DO PoE — as hunts e os bosses do Draevor ficam de fora — e SÓ ITENS DO PoE
// ENTRAM NO PERSONAGEM, em todo caminho (loot, caçada offline, chão, mercado, Store, lojas, máquinas, recompensas). O ouro passa; o
// que já é do personagem nunca some por causa da regra (ela só olha o que ENTRA).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';
import * as So from '../systems/itens-poe/so-itens-do-poe.mjs';
import { iniciarJogoDoPoe } from '../systems/itens-poe/iniciar.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Inventario from '../systems/inventario.mjs';
import * as Mercado from '../systems/mercado.mjs';
import * as Loja from '../systems/loja.mjs';
import * as Desmanche from '../systems/desmanche.mjs';
import * as Forja from '../systems/forja.mjs';
import * as Recompensas from '../systems/recompensas.mjs';
import * as GemasDeSkill from '../systems/skills/gemas.mjs';
import * as SimulacaoOffline from '../systems/simulacao-offline.mjs';
import { matarMonstro } from '../systems/hunt/combate.mjs';
import { criarMonstro } from '../systems/hunt/monstros.mjs';
import { CATALOGO, ITEM_CATALOG } from '../systems/dados.mjs';
import { gerarPeca } from '../systems/itens-poe/gerar.mjs';
import * as JogoDoPoe from '../systems/itens-poe/jogo.mjs';
import * as B from '../database/banco.mjs';
import { personagemDeTeste, PERSONAGEM, HUNT_DE_TESTE } from './apoio.mjs';

const SEM = !existsSync(Catalogo.ARQUIVO) && 'dados do PoE ausentes nesta máquina';
if (!SEM) await iniciarJogoDoPoe();
after(() => SimulacaoOffline.encerrar());

const ESPADA_DO_DRAEVOR = 3264; // sword
const AREA = 'poe-a1-the-coast';
/** Um personagem do PoE (a marca do jogo oficial) que não morre, com a mochila e a bolsa vazias. */
function doPoe() {
  const e = personagemDeTeste({ vocacao: 'knight', level: 20 });
  Object.assign(e, { sistema: 'poe', hp: 1e9, maxHp: 1e9, inventory: [], pouch: [] });
  return e;
}
const naArea = (e) => {
  const r = Cacadas.entrar(e, { huntId: AREA, mode: 'auto', strategy: 'nearest' });
  assert.ok(r.ok, r.erro);
  return e.hunt;
};
const tudoQueTem = (e) => [...(e.inventory ?? []), ...(e.pouch ?? [])];

test('a regra: é do PoE o que tem id do PoE (bases, suportes, moedas, gemas) ou a peça do PoE; o ouro e a mochila passam', { skip: SEM }, () => {
  for (const id of [7_000_022, 7_600_001, 914_001, 915_002, 916_001]) assert.equal(So.podeEntrar(id), true, String(id));
  for (const id of [ESPADA_DO_DRAEVOR, 912_001, 911_041, 55_729]) assert.equal(So.podeEntrar(id), false, String(id));
  assert.equal(So.podeEntrar(3031), true, 'gold coin vira ouro');
  assert.equal(So.podeEntrar(2854), true, 'a mochila do personagem');
  assert.equal(So.podeEntrar(123, { poe: { nome: 'x' } }), true, 'peça gerada pelo sistema do PoE');
  // No clássico (a transição), tudo entra como antes.
  process.env.DRAEVOR_CLASSICO = '1';
  try {
    assert.equal(So.podeEntrar(ESPADA_DO_DRAEVOR), true);
  } finally {
    delete process.env.DRAEVOR_CLASSICO;
  }
});

test('A1 — só conteúdo do PoE: hunt e boss do Draevor recusados; área, chefe de ato, pináculo e arena PvP entram', { skip: SEM }, () => {
  const recusa = /Draevor clássico/;
  assert.match(Cacadas.entrar(doPoe(), { huntId: 'troll-cave', mode: 'auto' }).erro, recusa);
  const bossDoDraevor = CATALOGO.bosses.find((b) => !b.poePinaculo && b.poeChefeDeAto == null);
  assert.match(Cacadas.entrar(doPoe(), { huntId: bossDoDraevor.id, mode: 'auto' }).erro, recusa);
  assert.equal(Cacadas.entrar(doPoe(), { huntId: AREA, mode: 'auto' }).ok, true);
  const pinaculo = CATALOGO.bosses.find((b) => b.poePinaculo);
  const alto = Object.assign(doPoe(), { level: Math.max(100, pinaculo.level ?? 0) });
  const r = Cacadas.entrar(alto, { huntId: pinaculo.id, mode: 'auto' });
  assert.equal(r.ok, true, r.erro);
  assert.equal(Cacadas.entrar(doPoe(), { huntId: CATALOGO.bosses.find((b) => b.poeChefeDeAto != null).id, mode: 'auto' }).ok, true);
  assert.equal(Cacadas.entrar(doPoe(), { huntId: 'arena-livraria-de-fogo', mode: 'auto', arenaPvp: true }).ok, true, 'a arena PvP (o servidor marca)');
  assert.match(Cacadas.entrar(doPoe(), { huntId: 'arena-livraria-de-fogo', mode: 'auto' }).erro, recusa, 'sem a marca do servidor, não');
});

test('loot: a tabela do Draevor do bicho-base não solta item do Draevor (o ouro dela continua)', { skip: SEM }, () => {
  const e = doPoe();
  const h = naArea(e);
  const m = criarMonstro({ key: h.monstros[0].key, x: h.pos.x + 1, y: h.pos.y }, null);
  Object.assign(m, { loot: [{ id: ESPADA_DO_DRAEVOR, chance: 1 }, { id: 3031, chance: 1 }] });
  h.monstros.push(m);
  const ouro = e.gold;
  matarMonstro(e, h, PERSONAGEM, m, []);
  assert.ok(!tudoQueTem(e).some((p) => p.id === ESPADA_DO_DRAEVOR), 'a espada do Draevor não entrou');
  assert.ok(e.gold > ouro, 'o ouro entrou');
});

test('caçando de verdade (online e a projeção offline de 3 h): só peça do PoE, e toda base do PoE com raridade e mods do PoE', { skip: SEM }, () => {
  const e = doPoe();
  // (C — o PoE puro, decisão do dono, 09/10: o escudo de energia dos monstros do PoE RECARREGA. Desarmado, o cavaleiro dava ~12 a cada
  // 2 s e não vencia o Elite/Raro com "Início da Recarga 150% mais rápido" (0,8 s sem dano): ficava 20 dos 30 min simulados no mesmo
  // bicho — 2 de 40 sementes abaixo dos 50 abates. Como no encontros-etapa6, ele caça com uma arma de verdade, um Machado Vaal: 0 de 40.)
  JogoDoPoe.iniciar(ITEM_CATALOG);
  e.equipment = { ...(e.equipment ?? {}), weapon: JogoDoPoe.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Two_Hand_Axes/Vaal_Axe', raridade: 'normal', ilvl: 64, rng: () => 0.5 })) };
  naArea(e);
  e.settings = { ...(e.settings ?? {}), autoSellPouch: false };
  e.hunt.offlineDesde = Date.now() - 3 * 3_600_000;
  const r = Cacadas.simularAusencia(e, PERSONAGEM, Date.now());
  assert.ok(r.report.kills > 50, `${r.report.kills} abates`);
  const pecas = tudoQueTem(e);
  assert.ok(pecas.length > 20, `${pecas.length} peças`);
  assert.deepEqual(pecas.filter((p) => !So.ehDoPoe(p.id, p)).map((p) => p.id), [], 'nada do Draevor');
  // A projeção (além da meia hora simulada) gerava a base CRUA: sem raridade nem mods do PoE.
  const bases = pecas.filter((p) => p.id >= 7_000_000 && p.id < 7_600_000);
  assert.ok(bases.length > 20);
  assert.deepEqual(bases.filter((p) => !p.poe).map((p) => p.id), [], 'toda base do PoE é peça do PoE');
});

test('chão: o item do Draevor não se pega (fica lá); o do PoE, sim', { skip: SEM }, () => {
  const e = doPoe();
  const { x, y } = e.pos;
  const largou = doPoe();
  largou.pos = { ...e.pos };
  largou.inventory = [{ id: ESPADA_DO_DRAEVOR, count: 1 }];
  assert.equal(Inventario.largar(largou, { id: ESPADA_DO_DRAEVOR, count: 1, x, y }).ok, true, 'largar o que já é seu: livre');
  const r = Inventario.pegar(e, { x, y, indice: null });
  assert.match(r.erro ?? '', /Path of Exile/);
  assert.equal(e.inventory.length, 0);
  largou.inventory = [{ id: 915_001, count: 3 }];
  assert.equal(Inventario.largar(largou, { id: 915_001, count: 3, x, y }).ok, true);
  assert.equal(Inventario.pegar(e, { x, y, indice: null }).ok, true);
  assert.ok(e.inventory.some((p) => p.id === 915_001));
});

test('mercado: não se anuncia, compra nem vê item do Draevor', { skip: SEM }, async (t) => {
  const e = doPoe();
  e.inventory = [{ id: ESPADA_DO_DRAEVOR, count: 1 }];
  e.gold = 10_000;
  const eu = { id: `so-poe-${randomUUID()}`, nome: 'SoPoe' };
  assert.match((await Mercado.anunciar(e, eu, { kind: 'sell', id: ESPADA_DO_DRAEVOR, count: 1, price: 10 })).erro, /Path of Exile/);
  assert.match((await Mercado.anunciar(e, eu, { kind: 'buy', id: ESPADA_DO_DRAEVOR, count: 1, price: 10 })).erro, /Path of Exile/);
  assert.equal(e.inventory.length, 1, 'a espada continua na mochila');
  assert.equal(e.gold, 10_000, 'nada foi cobrado');
  const outro = `so-poe-outro-${randomUUID()}`;
  const oferta = B.db.prepare("INSERT INTO mercado_ofertas (personagem, vendedor, kind, item, count, price, moeda, peca, criada) VALUES (?, 'Outro', 'sell', ?, 1, 5, 'gold', NULL, ?)").run(outro, ESPADA_DO_DRAEVOR, Date.now()).lastInsertRowid;
  t.after(() => B.db.prepare('DELETE FROM mercado_ofertas WHERE personagem = ?').run(outro));
  assert.ok(!(await Mercado.balcao(e, eu.id)).list.some((l) => l.id === ESPADA_DO_DRAEVOR), 'não aparece no balcão');
  assert.ok(!(await Mercado.ofertas(eu.id, { kind: 'sell' })).offers.some((o) => o.id === Number(oferta)), 'nem nas ofertas');
  assert.match((await Mercado.aceitar(e, eu, { offerId: oferta, count: 1 }, () => null)).erro, /Path of Exile/);
});

test('Store: o produto que entrega item do Draevor e o Buff Power não se compram; o resto sim; a Inbox não solta item do Draevor', { skip: SEM }, () => {
  const e = { ...doPoe(), coins: 1e9 };
  for (const id of ['item-28723', 'boost-55343', 'tier-up', 'buffpower-trio', 'buffpower-55711']) {
    const antes = e.coins;
    assert.equal(Loja.comprar(e, { id }).ok, false, id);
    assert.equal(e.coins, antes, `${id}: nada cobrado`);
  }
  assert.equal(Loja.comprar(e, { id: 'premium-30' }).ok, true, 'premium continua');
  e.storeInbox = [{ id: ESPADA_DO_DRAEVOR, count: 1 }];
  assert.match(Loja.moverDaInbox(e, { mover: { id: ESPADA_DO_DRAEVOR, count: 1 } }, () => true).erro, /Path of Exile/);
  assert.equal(e.storeInbox.length, 1, 'fica na Inbox');
});

test('máquinas e lojas do Draevor recusam ANTES de tirar ou cobrar: desmanche, Forja do Draevor, loja de gemas (suporte do Draevor)', { skip: SEM }, () => {
  const e = doPoe();
  e.inventory = [{ id: ESPADA_DO_DRAEVOR, count: 1 }];
  const antes = JSON.stringify(e);
  assert.match(Desmanche.desmanchar(e, { pedidos: [{ id: ESPADA_DO_DRAEVOR, quantidade: 1 }] }).erro, /Draevor clássico/);
  assert.match(Forja.retirar(e, { slot: 'weapon', indice: 0, moeda: 'gold' }).erro, /Forja do Draevor/);
  assert.match(Forja.fundir(e, { moeda: 'gold' }).erro, /Forja do Draevor/);
  const suporteDoDraevor = [...GemasDeSkill.DEFS.values()].find((d) => !So.ehDoPoe(d.itemId));
  if (suporteDoDraevor) assert.equal(GemasDeSkill.comprarNaLoja(e, { id: suporteDoDraevor.itemId }).ok, false);
  assert.equal(JSON.stringify(e), antes, 'nada mudou no personagem');
});

test('recompensa: o dia do calendário com item do Draevor passa sem entregar (o calendário não trava)', { skip: SEM }, () => {
  const e = doPoe();
  const dia = { dia: 3, itens: [ESPADA_DO_DRAEVOR], pego: false };
  e.diario = { dia: 3, sequencia: 2, pendente: dia, dias: [dia, { dia: 4, pego: false }] };
  assert.equal(Recompensas.escolherDiario(e, { escolha: ESPADA_DO_DRAEVOR }).ok, true);
  assert.equal(e.diario.pendente, null);
  assert.equal(e.diario.dia, 4, 'o calendário andou');
  assert.ok(!tudoQueTem(e).some((p) => p.id === ESPADA_DO_DRAEVOR));
});
