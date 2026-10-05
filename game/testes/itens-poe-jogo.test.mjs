// Incremento 3c do sistema de itens do PoE: a peça entra no JOGO local — as bases viram itens do catálogo, a peça carrega a base e o
// `poe` pela mochila e pela bolsa de loot, equipada muda a ficha de verdade, e o drop só acontece com os números do dono (chance 0 =
// nada). Usa o catálogo importado de verdade (a coleção fica fora do repositório): sem ele nesta máquina, os testes são pulados.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const { camposDaPeca } = await import('../systems/itens/item.mjs');
const Inventario = await import('../systems/inventario.mjs');
const Bolsa = await import('../systems/bolsa.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Treino = await import('../systems/treino.mjs');
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');

const SEM = !existsSync(Catalogo.ARQUIVO) && 'catálogo do PoE não importado nesta máquina';
const semente = (s = 1) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
const gerar = (base, raridade = 'raro', s = 3) => gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade, ilvl: 84, rng: semente(s) });

test('as bases equipáveis entram no catálogo de itens como itens virtuais (slot, perícia, duas mãos); as sem slot ficam de fora', { skip: SEM }, () => {
  const r = Jogo.iniciar(ITEM_CATALOG);
  assert.ok(r.porBase.size > 800, `${r.porBase.size} bases`);
  const colete = ITEM_CATALOG[Jogo.idDaBase('Body_Armours/Plate_Vest')];
  assert.deepEqual([colete.slot, colete.name, colete.poe.base], ['body', 'Colete de Placas', 'Body_Armours/Plate_Vest']);
  const luva = ITEM_CATALOG[Jogo.idDaBase(Catalogo.catalogo().classes.Gloves.bases[0].id)];
  assert.equal(luva.slot, 'legs', 'luvas no slot de pernas (o Draevor troca luvas por pernas)');
  const espada = Catalogo.catalogo().classes.Two_Hand_Swords.bases[0];
  assert.deepEqual([ITEM_CATALOG[Jogo.idDaBase(espada.id)].skill, ITEM_CATALOG[Jogo.idDaBase(espada.id)].twoHanded], ['sword', true]);
  for (const c of ['Belts', 'Life_Flasks', 'Jewels']) assert.ok(r.naoEquipaveis.includes(c), c);
  assert.ok([...r.porBase.values()].every((id) => id >= Jogo.PRIMEIRO_ID));
});

test('a peça do jogo: base (defesa sorteada / faixa de dano) + poe (raridade, mods, af traduzido, o bloqueio da base)', { skip: SEM }, () => {
  Jogo.iniciar(ITEM_CATALOG);
  const p = Jogo.pecaDoJogo(gerar('Body_Armours/Plate_Vest'));
  assert.equal(p.id, Jogo.idDaBase('Body_Armours/Plate_Vest'));
  assert.ok(p.base.armor[0] >= 19 && p.base.armor[0] <= 27);
  assert.equal(p.poe.raridade, 'raro');
  assert.ok(p.poe.prefixos.length + p.poe.sufixos.length >= 4);
  assert.equal(p.poe.estados.length, p.poe.implicitos.length + p.poe.prefixos.length + p.poe.sufixos.length);
  assert.equal('raridade' in p, false, 'a peça do PoE não usa a raridade do Draevor');
  const escudo = Catalogo.catalogo().classes.Shields.bases.find((b) => b.atributos?.chance_bloqueio_pct);
  const pe = Jogo.pecaDoJogo(gerar(escudo.id, 'normal'));
  assert.equal(pe.poe.af.block, escudo.atributos.chance_bloqueio_pct, 'o bloqueio da base do escudo vira o block do Draevor');
  const arma = Catalogo.catalogo().classes.One_Hand_Swords.bases[3];
  assert.deepEqual(Jogo.pecaDoJogo(gerar(arma.id, 'normal')).base.attack, [arma.atributos.dano_fisico.min, arma.atributos.dano_fisico.max]);
  assert.equal(Jogo.pecaDoJogo(gerar('Belts/' + (Catalogo.catalogo().classes.Belts?.bases[0]?.slug ?? 'x'))), null, 'cinto: sem slot');
});

test('a peça não perde o poe na mochila, na bolsa de loot nem ao copiar campos', { skip: SEM }, () => {
  Jogo.iniciar(ITEM_CATALOG);
  const p = Jogo.pecaDoJogo(gerar('Body_Armours/Plate_Vest', 'magico'));
  assert.deepEqual(camposDaPeca(p).poe, p.poe);
  const e = personagemDeTeste({ vocacao: 'knight', level: 50 });
  Inventario.darPeca(e, p);
  const naMochila = e.inventory.find((x) => x.id === p.id);
  assert.deepEqual(naMochila.poe, p.poe);
  assert.deepEqual(naMochila.base, p.base);
  assert.equal(Bolsa.porNaBolsa(e, p.id, 1, p), 1);
  assert.deepEqual(e.pouch.find((x) => x.id === p.id).poe, p.poe);
});

test('equipada, a peça muda a ficha: a armadura da base e os mods traduzidos (vida, resistência, crítico relativo)', { skip: SEM }, () => {
  Jogo.iniciar(ITEM_CATALOG);
  const e = personagemDeTeste({ vocacao: 'knight', level: 100 });
  Treino.garantir(e);
  delete e.equipment.armor;
  delete e.equipment.body;
  Ficha.invalidar(e);
  const antes = Ficha.combate(e);
  const p = Jogo.pecaDoJogo(gerar('Body_Armours/Plate_Vest'));
  p.poe.af = { ...p.poe.af, life: 100, fire_res: 20, crit_chance_inc: 50 };
  e.equipment.body = p;
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  const depois = Ficha.combate(e);
  assert.ok(depois.armor > antes.armor, `armadura ${antes.armor} → ${depois.armor}`);
  assert.ok(depois.protection.fire >= antes.protection.fire + 20 - 1e-9 || depois.protection.fire === 80, 'resistência a fogo');
  assert.ok(depois.critChance > antes.critChance, 'crítico relativo');
  assert.ok(Afixos.soma(e).life >= 100, 'vida dos mods');
});

test('o drop: chance 0 (o padrão, sem os números do dono) nunca dá; com números, sai peça válida no Item Level do bicho', { skip: SEM }, () => {
  Jogo.iniciar(ITEM_CATALOG);
  assert.equal(Catalogo.REGRAS.drop.chancePorMonstro, 0, 'o padrão é não cair nada até o dono definir');
  for (let i = 0; i < 200; i++) assert.equal(Jogo.dropDoMonstro(80), null);
  const regras = { ...Catalogo.REGRAS, drop: { chancePorMonstro: 1, raridades: { normal: 0, magico: 1, raro: 1, unico: 1 }, ilvlMaximo: 100 } };
  const rng = semente(5);
  for (let i = 0; i < 60; i++) {
    const p = Jogo.dropDoMonstro(30, rng, regras);
    assert.ok(p && ITEM_CATALOG[p.id]?.poe, 'peça do PoE registrada');
    assert.ok(['magico', 'raro', 'unico'].includes(p.poe.raridade));
    assert.equal(p.poe.ilvl, 30);
  }
});

test('os pesos de raridade do dono (05/10): a peça que cai é quase sempre Normal, Mágica às vezes, Rara pouco e Única raríssima', { skip: SEM }, () => {
  Jogo.iniciar(ITEM_CATALOG);
  const R = Catalogo.REGRAS.drop.raridades;
  assert.deepEqual([R.normal, R.magico, R.raro, R.unico], [0.85, 0.125, 0.03, 0.00055]);
  const regras = { ...Catalogo.REGRAS, drop: { ...Catalogo.REGRAS.drop, chancePorMonstro: 1 } };
  const rng = semente(11);
  const n = 2000;
  const conta = { normal: 0, magico: 0, raro: 0, unico: 0 };
  for (let i = 0; i < n; i++) conta[Jogo.dropDoMonstro(60, rng, regras).poe.raridade]++;
  assert.ok(conta.normal / n > 0.8 && conta.normal / n < 0.9, `normal ${conta.normal}`);
  assert.ok(conta.magico / n > 0.09 && conta.magico / n < 0.16, `mágico ${conta.magico}`);
  assert.ok(conta.raro / n > 0.01 && conta.raro / n < 0.05, `raro ${conta.raro}`);
  assert.ok(conta.unico <= 5, `único ${conta.unico}`);
});
