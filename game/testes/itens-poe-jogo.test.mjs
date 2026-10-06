// Incremento 3c do sistema de itens do PoE: a peça entra no JOGO local — as bases viram itens do catálogo, a peça carrega a base e o
// `poe` pela mochila e pela bolsa de loot, equipada muda a ficha de verdade, e o drop segue os números do dono (quantidade pela raridade
// do bicho, raridade da peça pelos pesos). Usa o catálogo importado de verdade (a coleção fica fora do repositório): sem ele nesta máquina, os testes são pulados.
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
  assert.equal(luva.slot, 'gloves', 'luvas no slot próprio (decisão do dono, 05/10)');
  const cinto = ITEM_CATALOG[Jogo.idDaBase(Catalogo.catalogo().classes.Belts.bases[0].id)];
  assert.equal(cinto.slot, 'legs', 'cintos no lugar das pernas (decisão do dono, 05/10)');
  const espada = Catalogo.catalogo().classes.Two_Hand_Swords.bases[0];
  assert.deepEqual([ITEM_CATALOG[Jogo.idDaBase(espada.id)].skill, ITEM_CATALOG[Jogo.idDaBase(espada.id)].twoHanded], ['sword', true]);
  for (const c of ['Jewels', 'Tinctures']) assert.ok(r.naoEquipaveis.includes(c), c);
  // Os frascos entram (sem slot de equipamento: vão para o cinto de frascos — `itens-poe/frascos.mjs`).
  for (const c of ['Life_Flasks', 'Mana_Flasks', 'Utility_Flasks']) assert.ok(!r.naoEquipaveis.includes(c), c);
  assert.ok(!r.naoEquipaveis.includes('Belts') && !r.naoEquipaveis.includes('Gloves'));
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
  assert.equal(Jogo.pecaDoJogo(gerar(Catalogo.catalogo().classes.Jewels.bases[0].id)), null, 'joia: sem slot');
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

test('quantas peças caem (regra do dono, 05/10): 0,16 × (1 + bônus da raridade do bicho); de 1 para cima é garantido e o excedente rola mais uma', { skip: SEM }, () => {
  Jogo.iniciar(ITEM_CATALOG);
  const q = (t) => Math.round(Jogo.quantidadeDoDrop(t) * 100) / 100;
  assert.deepEqual(['normal', 'modificado', 'raro', 'elite', 'unico', 'boss'].map(q), [0.16, 0.4, 1.36, 1.36, 4.72, 4.72]);
  assert.equal(q('desconhecido'), 0.16, 'tipo sem bônus = normal');
  // O exemplo do dono: mapa/personagem com +50% de Quantidade → 0,16 × 1,5 = 0,24.
  assert.ok(Math.abs(Jogo.quantidadeDoDrop('normal', Catalogo.REGRAS, 1.5) - 0.24) < 1e-9);
  assert.ok(Math.abs(Jogo.quantidadeDoDrop('raro', Catalogo.REGRAS, 1.5) - 2.04) < 1e-9);
  const rng = semente(7);
  const media = (t, n = 4000) => Array.from({ length: n }, () => Jogo.quantasPecas(t, rng)).reduce((a, b) => a + b, 0) / n;
  assert.ok(Math.abs(media('normal') - 0.16) < 0.03);
  for (let i = 0; i < 300; i++) assert.ok([1, 2].includes(Jogo.quantasPecas('raro', rng)), 'raro: 1 garantida + 36% de outra');
  for (let i = 0; i < 300; i++) assert.ok([4, 5].includes(Jogo.quantasPecas('boss', rng)));
  const nada = { ...Catalogo.REGRAS, drop: { ...Catalogo.REGRAS.drop, chanceBase: 0 } };
  for (let i = 0; i < 100; i++) assert.deepEqual(Jogo.dropsDoMonstro(80, 'boss', rng, nada), [], 'chanceBase 0 = nada cai');
});

test('a peça que cai é válida, registrada e no Item Level do bicho', { skip: SEM }, () => {
  Jogo.iniciar(ITEM_CATALOG);
  const regras = { ...Catalogo.REGRAS, drop: { ...Catalogo.REGRAS.drop, raridades: { normal: 0, magico: 1, raro: 1, unico: 1 } } };
  const rng = semente(5);
  const pecas = Array.from({ length: 30 }, () => Jogo.dropsDoMonstro(30, 'boss', rng, regras)).flat();
  assert.ok(pecas.length >= 120);
  for (const p of pecas) {
    assert.ok(ITEM_CATALOG[p.id]?.poe, 'peça do PoE registrada');
    assert.ok(['magico', 'raro', 'unico'].includes(p.poe.raridade));
    assert.equal(p.poe.ilvl, 30);
  }
});

test('os pesos de raridade do dono (05/10): a peça que cai é quase sempre Normal, Mágica às vezes, Rara pouco e Única raríssima', { skip: SEM }, () => {
  Jogo.iniciar(ITEM_CATALOG);
  const R = Catalogo.REGRAS.drop.raridades;
  assert.deepEqual([R.normal, R.magico, R.raro, R.unico], [0.85, 0.125, 0.03, 0.00055]);
  const rng = semente(11);
  const n = 2000;
  const conta = { normal: 0, magico: 0, raro: 0, unico: 0 };
  for (let i = 0; i < n; i++) conta[Jogo.pecaSorteada(60, rng).poe.raridade]++;
  assert.ok(conta.normal / n > 0.8 && conta.normal / n < 0.9, `normal ${conta.normal}`);
  assert.ok(conta.magico / n > 0.09 && conta.magico / n < 0.16, `mágico ${conta.magico}`);
  assert.ok(conta.raro / n > 0.01 && conta.raro / n < 0.05, `raro ${conta.raro}`);
  assert.ok(conta.unico <= 5, `único ${conta.unico}`);
});

test('luvas e cinto do PoE se equipam de verdade (slot gloves e slot legs) e somam na ficha; luva não entra nas pernas', { skip: SEM }, () => {
  Jogo.iniciar(ITEM_CATALOG);
  const e = personagemDeTeste({ vocacao: 'knight', level: 100 });
  Treino.garantir(e);
  delete e.equipment.legs;
  const luva = Jogo.pecaDoJogo(gerar(Catalogo.catalogo().classes.Gloves.bases[0].id, 'magico'));
  luva.poe.af = { ...luva.poe.af, life: 33 };
  const cinto = Jogo.pecaDoJogo(gerar(Catalogo.catalogo().classes.Belts.bases[0].id, 'magico'));
  cinto.poe.af = { ...cinto.poe.af, fire_res: 7 };
  Inventario.darPeca(e, luva);
  Inventario.darPeca(e, cinto);
  assert.equal(Inventario.equipar(e, { id: luva.id, slot: 'legs' }).ok, false, 'luva nas pernas: recusa');
  assert.equal(Inventario.equipar(e, { id: luva.id }).ok, true);
  assert.equal(Inventario.equipar(e, { id: cinto.id }).ok, true);
  assert.deepEqual([e.equipment.gloves?.id, e.equipment.legs?.id], [luva.id, cinto.id]);
  assert.deepEqual(e.equipment.gloves.poe, luva.poe, 'a luva vestida mantém o poe');
  const s = Afixos.somaDeItens(e);
  assert.ok(s.life >= 33 && s.fire_res >= 7);
  assert.equal(Inventario.desequipar(e, { slot: 'gloves' }).ok, true);
  assert.ok(e.inventory.some((p) => p.id === luva.id && p.poe));
});

test('a chance de crítico da base da arma do PoE entra na ficha (e o crítico relativo dos mods multiplica por cima)', { skip: SEM }, () => {
  Jogo.iniciar(ITEM_CATALOG);
  const arma = Catalogo.catalogo().classes.Daggers.bases.find((b) => b.atributos?.chance_critico_pct >= 6);
  assert.equal(ITEM_CATALOG[Jogo.idDaBase(arma.id)].critChance, Math.round(arma.atributos.chance_critico_pct * 100));
  const e = personagemDeTeste({ vocacao: 'knight', level: 100 });
  Treino.garantir(e);
  e.equipment.weapon = { id: Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'fire sword').id), count: 1 };
  Ficha.invalidar(e);
  const antes = Ficha.combate(e).critChance;
  const p = Jogo.pecaDoJogo(gerar(arma.id, 'normal'));
  p.poe.af = {}; // só a base (o implícito da adaga também mexe no crítico)
  e.equipment.weapon = p;
  Ficha.invalidar(e);
  const comBase = Ficha.combate(e).critChance;
  assert.ok(Math.abs(comBase - (antes + arma.atributos.chance_critico_pct / 100)) < 1e-9, `${antes} → ${comBase}`);
  p.poe.af = { crit_chance_inc: 100 };
  Ficha.invalidar(e);
  assert.ok(Math.abs(Ficha.combate(e).critChance - Math.min(comBase * 2, 1)) < 1e-9);
});

test('a venda automática da bolsa não vende peça do PoE (sem preço de NPC definido: a peça fica, nada se perde por 0 de ouro)', { skip: SEM }, () => {
  Jogo.iniciar(ITEM_CATALOG);
  const e = personagemDeTeste({ vocacao: 'knight', level: 50 });
  const p = Jogo.pecaDoJogo(gerar('Body_Armours/Plate_Vest', 'normal'));
  assert.equal(Bolsa.porNaBolsa(e, p.id, 1, p), 1);
  const r = Bolsa.venderBolsa(e);
  assert.equal(r.gold, 0);
  assert.ok(e.pouch.some((x) => x.id === p.id && x.poe), 'a peça continua na bolsa');
});

test('4d — requisitos do PoE: todos os atributos da base valem (com o +For da árvore/itens a peça entra)', { skip: SEM }, () => {
  Jogo.iniciar(ITEM_CATALOG);
  const cat = Catalogo.catalogo();
  const placa = cat.classes.Body_Armours.bases.find((b) => b.id === 'Body_Armours/Glorious_Plate');
  const meta = ITEM_CATALOG[Jogo.idDaBase(placa.id)];
  assert.deepEqual(meta.poe.requisitos, { str: placa.requisitos.forca });
  const e = personagemDeTeste({ vocacao: 'knight', level: 100 });
  Treino.garantir(e);
  delete e.equipment.body;
  const p = Jogo.pecaDoJogo(gerar(placa.id, 'normal'));
  Inventario.darPeca(e, p);
  const r = Inventario.equipar(e, { id: p.id });
  assert.equal(r.ok, false);
  assert.match(r.erro, new RegExp(`Requer ${placa.requisitos.forca} STR`));
  // +For de uma peça vestida (o mesmo caminho da árvore): com STR suficiente, entra.
  e.equipment.ring = { id: Jogo.idDaBase(cat.classes.Rings.bases[0].id), count: 1, poe: { af: { str: 300 } } };
  Ficha.invalidar(e);
  assert.equal(Inventario.equipar(e, { id: p.id }).ok, true);
  // Híbrida: os dois atributos valem.
  const hib = cat.classes.Body_Armours.bases.find((b) => b.requisitos?.forca > 0 && b.requisitos?.destreza > 50);
  const h = Jogo.pecaDoJogo(gerar(hib.id, 'normal'));
  delete e.equipment.body;
  e.equipment.ring.poe.af = { str: 300 };
  Inventario.darPeca(e, h);
  const rh = Inventario.equipar(e, { id: h.id });
  assert.equal(rh.ok, false, 'só STR não basta para a híbrida');
  assert.match(rh.erro, /DEX/);
});

test('bicho de nível 11 só solta mod de iLvl até 11 (regra do dono, 05/10), e o iLvl é o nível do monstro do PoE, sem o nível extra da raridade', { skip: SEM }, async () => {
  const regras = { ...Catalogo.REGRAS, drop: { ...Catalogo.REGRAS.drop, chanceBase: 50, pesos: { magico: 1, raro: 1 } } };
  const rng = semente(11);
  const pecas = Array.from({ length: 60 }, () => Jogo.dropsDoMonstro(11, 'boss', rng, regras)).flat();
  assert.ok(pecas.some((p) => p.poe.prefixos.length + p.poe.sufixos.length > 0), 'saíram peças com mods');
  for (const p of pecas) {
    assert.equal(p.poe.ilvl, 11);
    for (const m of [...p.poe.prefixos, ...p.poe.sufixos]) assert.ok((m.ilvl ?? 1) <= 11, `${m.nome} (iLvl ${m.ilvl}) num bicho nível 11`);
  }
  const { nivelDoDropPoe } = await import('../systems/hunt/combate.mjs');
  const { BESTIARY } = await import('../systems/hunt/monstros.mjs');
  BESTIARY['poe-teste-ilvl-11'] = { name: 'teste', hp: 1, exp: 999999, poe: { nivel: 11 } };
  assert.equal(nivelDoDropPoe({ escala: { nivel: 40 } }, { key: 'poe-teste-ilvl-11', levelExtra: 5 }), 11);
  assert.equal(nivelDoDropPoe({ escala: { nivel: 23 } }, { key: 'rat', levelExtra: 5 }), 23, 'fora do PoE: o nível da fase, sem o extra da raridade');
  delete BESTIARY['poe-teste-ilvl-11'];
});

test('o peso da peça do PoE é o de um item do Draevor do mesmo tipo (antes 50 oz para tudo: poucas peças estouravam a capacidade e iam para o Depósito)', { skip: SEM }, () => {
  const peso = (base) => ITEM_CATALOG[Jogo.idDaBase(base)].weight;
  assert.ok(peso('Rings/Iron_Ring') < 2, 'anel pesa menos de 2 oz');
  assert.ok(peso('Amulets/Coral_Amulet') < 10);
  assert.ok(peso('Body_Armours/Astral_Plate') > peso('Gloves/Wool_Gloves'), 'armadura pesa mais que luva');
  const e = personagemDeTeste({ level: 1 });
  for (const base of ['Rings/Iron_Ring', 'Belts/Rustic_Sash', 'Gloves/Wool_Gloves', 'Rings/Iron_Ring', 'Belts/Rustic_Sash', 'Gloves/Wool_Gloves']) Inventario.darPeca(e, Jogo.pecaDoJogo(gerar(base, 'magico')));
  assert.ok(Inventario.pesoDoInventario(e) > 0);
});
