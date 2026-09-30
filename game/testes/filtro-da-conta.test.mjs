// O FILTRO DE LOOT (relato, 30/09: "parece que tá vendendo tudo independente do
// que eu marque"): a venda automática respeita "Não vender", "Não coletar" e as
// regras de guardar — e a caixinha "Toda a conta" leva o filtro para os outros
// chars da conta (antes era gravada e ninguém lia; na party com os chars da
// mesma conta, o loot deles era vendido pelo filtro vazio deles).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Bolsa from '../systems/bolsa.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Treino from '../systems/treino.mjs';
import * as FiltroDaConta from '../systems/filtro-da-conta.mjs';
import { personagemDeTeste, PERSONAGEM } from './apoio.mjs';

const HAND_AXE = 3268;
const SPEAR = 3277;

function cacar(ajustar, minutos = 5) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 120 });
  Treino.garantir(e);
  Bolsa.garantir(e);
  e.settings = { ...e.settings, autoSellPouch: true };
  ajustar(e);
  assert.ok(Cacadas.entrar(e, { huntId: 'troll-cave', mode: 'auto' }).ok);
  let t = Date.now();
  for (let i = 0; i < 240 * minutos; i++) {
    t += 250;
    Cacadas.tique(e, PERSONAGEM, t);
    if (e.hp <= 0) e.hp = e.maxHp;
  }
  return { e, itens: e.hunt.sessao.itens };
}

test('caçando: "Não vender" nunca é vendido, "Não coletar" fica no chão, o resto é vendido', () => {
  const { e, itens } = cacar((e) => {
    Bolsa.regraDeItem(e, { rule: 'noSell', id: HAND_AXE });
    Bolsa.regraDeItem(e, { rule: 'noLoot', id: SPEAR });
  });
  assert.equal(itens.vendido?.[HAND_AXE] ?? 0, 0, 'hand axe não foi vendido');
  assert.ok(e.pouch.some((p) => p.id === HAND_AXE), 'o hand axe ficou na bolsa');
  assert.ok((itens.ignorado?.[SPEAR] ?? 0) > 0, 'a spear ficou no chão');
  assert.equal(itens.loot?.[SPEAR] ?? 0, 0);
  assert.ok(Object.values(itens.vendido ?? {}).reduce((a, b) => a + b, 0) > 0, 'o resto foi vendido');
});

test('venda: a regra de raridade guarda "raro para cima" e vende o comum', () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 120 });
  Bolsa.garantir(e);
  e.settings = { guardarRaridade: 2, guardarNivel: 0 };
  e.pouch = [
    { id: HAND_AXE, count: 1, raridade: 'comum' },
    { id: HAND_AXE, count: 1, raridade: 'raro', af: [{ id: 'crit_chance', value: 1 }] },
    { id: HAND_AXE, count: 1, raridade: 'épico', af: [{ id: 'crit_chance', value: 1 }] },
  ];
  Bolsa.venderBolsa(e);
  assert.deepEqual(e.pouch.map((p) => p.raridade).sort(), ['raro', 'épico'].sort());
});

test('"Toda a conta": a cópia leva as três listas e as regras de guardar; aplicar põe tudo e marca a caixinha', () => {
  const a = personagemDeTeste({ vocacao: 'knight', level: 100 });
  Bolsa.garantir(a);
  Bolsa.regraDeItem(a, { rule: 'noSell', id: HAND_AXE });
  Bolsa.regraDeItem(a, { rule: 'noLoot', id: SPEAR });
  a.settings.guardarRaridade = 3;
  a.settings.guardarNivel = 2;
  const filtro = FiltroDaConta.copia(a);
  assert.deepEqual(filtro.itemRules, { noLoot: [SPEAR], noSell: [HAND_AXE], soAfixo: [] });
  assert.deepEqual(filtro.guardar, { ...(a.settings.guardarAfixo != null ? { guardarAfixo: a.settings.guardarAfixo } : {}), guardarRaridade: 3, guardarNivel: 2 });
  // A cópia não é o mesmo array (mexer num char não mexe no outro por referência).
  a.itemRules.noSell.push(1);
  assert.deepEqual(filtro.itemRules.noSell, [HAND_AXE]);

  const b = personagemDeTeste({ vocacao: 'druid', level: 100 });
  Bolsa.garantir(b);
  b.settings.guardarQuantos = 4; // o que não está no filtro da conta sai
  FiltroDaConta.aplicar(b, filtro);
  assert.deepEqual(b.itemRules.noSell, [HAND_AXE]);
  assert.deepEqual(b.itemRules.noLoot, [SPEAR]);
  assert.equal(b.settings.guardarRaridade, 3);
  assert.equal(b.settings.guardarQuantos, undefined);
  assert.equal(b.lootFiltro.paraTodos, true);
  assert.equal(Bolsa.ignora(b, SPEAR), true, 'o outro char também deixa a spear no chão');
});

test('"Toda a conta": só as mudanças de filtro se espalham (não qualquer setting)', () => {
  assert.equal(FiltroDaConta.mudaOFiltro({ t: 'itemRule', rule: 'noSell', id: 1 }), true);
  assert.equal(FiltroDaConta.mudaOFiltro({ t: 'lootPreset', preset: 'npc', ids: [] }), true);
  assert.equal(FiltroDaConta.mudaOFiltro({ t: 'settings', guardarRaridade: 2 }), true);
  assert.equal(FiltroDaConta.mudaOFiltro({ t: 'settings', autoSellPouch: false }), false);
  assert.equal(FiltroDaConta.mudaOFiltro({ t: 'settings', novidadesLidas: 3 }), false);
});
