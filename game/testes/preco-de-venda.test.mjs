// O PREÇO DE VENDA que o catálogo não tinha (relato, 30/09: "staff, green tunic,
// grapes, scarf não estão sendo vendidos independente da raridade") — ver
// systems/itens/preco-de-venda.mjs e gamedata/itens/precos-de-venda.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import * as Bolsa from '../systems/bolsa.mjs';
import * as PrecoDeVenda from '../systems/itens/preco-de-venda.mjs';
import * as GemasDeSkill from '../systems/skills/gemas.mjs';
import { personagemDeTeste } from './apoio.mjs';

const porNome = (nome) => {
  const [id, m] = Object.entries(ITEM_CATALOG).find(([, x]) => x.name === nome);
  return { id: Number(id), m };
};

test('os itens do relato ganham preço e a venda automática vende (com qualquer raridade)', () => {
  for (const nome of ['green tunic', 'grapes', 'scarf']) {
    const { id, m } = porNome(nome);
    assert.ok(m.sell > 0, `${nome}: ${m.sell}`);
    assert.equal(m.sellCalculado, true);
    const e = personagemDeTeste({ vocacao: 'knight', level: 100 });
    Bolsa.garantir(e);
    e.settings = { guardarAtributos: 0, guardarRaridade: 0 };
    const peca = m.stackable ? { id, count: 3 } : { id, count: 1, raridade: 'raro', af: [] };
    e.pouch = [peca];
    const ouro = e.gold ?? 0;
    const venda = Bolsa.venderBolsa(e);
    assert.equal(e.pouch.length, 0, `${nome} foi vendido`);
    assert.ok(venda.gold > 0 && e.gold > ouro);
  }
});

test('a staff tem preço no catálogo (1 de ouro): continua o do catálogo', () => {
  const { m } = porNome('staff');
  assert.equal(m.sell, 1);
  assert.ok(!m.sellCalculado);
});

test('equipamento sem preço nenhum sai pela curva de level: o de level alto vale mais', () => {
  const baixo = porNome('crystalline sword').m;
  const alto = porNome('lion plate').m;
  assert.ok(baixo.sellCalculado && alto.sellCalculado);
  assert.ok(alto.sell > baixo.sell, `${alto.sell} > ${baixo.sell}`);
  assert.equal(porNome('red robe').m.sell, PrecoDeVenda.CONFIG.semLevel, 'sem level: o preço base');
});

test('moeda, token, item de quest e gema de skill continuam sem venda', () => {
  for (const nome of ['gold coin', 'crystal coin', 'Boss Token']) assert.ok(!(porNome(nome).m.sell > 0), nome);
  for (const m of Object.values(ITEM_CATALOG).filter((x) => ['quest items', 'taming items'].includes(x.type))) assert.ok(!m.sellCalculado, m.name);
  for (const id of GemasDeSkill.DEFS.keys()) assert.ok(!ITEM_CATALOG[id]?.sellCalculado, `gema ${id}`);
});

test('nenhum preço calculado passa do preço de compra (não dá para comprar e revender com lucro)', () => {
  for (const m of Object.values(ITEM_CATALOG)) {
    if (m.sellCalculado && Number(m.buy) > 0) assert.ok(m.sell <= m.buy, `${m.name}: vende ${m.sell}, compra ${m.buy}`);
  }
});

test('a raridade não muda o preço (decisão do dono)', () => {
  const { id } = porNome('scarf');
  const vende = (raridade) => {
    const e = personagemDeTeste({ vocacao: 'knight', level: 100 });
    Bolsa.garantir(e);
    e.settings = { guardarAtributos: 0, guardarRaridade: 0 };
    e.pouch = [{ id, count: 1, raridade, af: [] }];
    return Bolsa.venderBolsa(e).gold;
  };
  assert.equal(vende('comum'), vende('mítico'));
});

test('o scroll comum vende (a exclusão é só dos itens especiais: Divine Scroll, premium scroll...)', () => {
  const { id, m } = porNome('scroll');
  assert.equal(m.sell, Math.floor(m.buy * PrecoDeVenda.CONFIG.fracaoDoPrecoDeCompra));
  const e = personagemDeTeste({ vocacao: 'knight', level: 100 });
  Bolsa.garantir(e);
  e.pouch = [{ id, count: 3 }];
  assert.ok(Bolsa.venderBolsa(e).gold > 0);
  assert.equal(e.pouch.length, 0);
  for (const nome of ['Divine Scroll', 'Divine Hunts Scroll', 'premium scroll', 'Scroll Speed Exercise']) assert.ok(!(porNome(nome).m.sell > 0), nome);
});

test('loot comum sem preço nenhum (lixo, produto de bicho, comida, decoração, sem tipo, enferrujados) vende por 1', () => {
  for (const nome of ['bone', 'mysterious remains', 'energy bar', 'piggy bank', 'teddy bear', 'flask of demonic blood', 'skull', 'rusted armor', 'slightly rusted legs', 'burnt scroll']) {
    const { m } = porNome(nome);
    assert.equal(m.sell, PrecoDeVenda.CONFIG.precoFixo.valor, nome);
  }
  // Os especiais continuam de fora (a lista `nunca` e os tipos de quest/montaria valem por cima).
  for (const nome of ['gold coin', 'Boss Token', 'Bag You Desire', 'Summon Upgrade Dropped', 'death toll', 'bamboo leaves']) assert.ok(!(porNome(nome).m.sell > 0), nome);
  const e = personagemDeTeste({ vocacao: 'knight', level: 100 });
  Bolsa.garantir(e);
  e.pouch = [{ id: porNome('bone').id, count: 5 }];
  assert.equal(Bolsa.venderBolsa(e).gold, 5);
});
