// (lote C2 da rodada 4 das gemas, 28/10 — dono: "quero resolver") As regras do PoE e a Artilharia (`systems/itens-poe/gemas-r4c2.mjs`):
//   1. o "mais" e o "aumentado" de um tipo dos suportes só na parte daquele tipo do golpe (o PoB: FireDamage MORE…);
//   2. o Pacto de Lycia como no PoB (o uso fortalece as 3 magias de canalização seguintes, 40% mais Dano, e o Flagelo Celestial cai enquanto você canaliza);
//   3. o cone do Aço Estraçalhador e os projéteis do Tiro Cinético da Fragmentação no mesmo alvo;
//   4. a Bomba Congelante explode depois da duração;
//   5. a linha de flechas da Chuva de Flechas da Artilharia;
//   6. a área numa conta só (os metros × √(1 + Área) ÷ 2, a fração como chance).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEM, Acoes, G, SP, Ficha, PERSONAGEM, montar, usar, danoEm, sorte, perto, celula, TAGS } from './gemas-t1-apoio.mjs';

const C2 = await import('../systems/itens-poe/gemas-r4c2.mjs');
const ef = (slug, nivel, q, ...tags) => SP.efeitoNoNivel(slug, nivel, q, TAGS(...tags)).efeito;
const numero = (x) => Number(String(x).match(/-?\d+(?:\.\d+)?/)[0]);
const VARINHA = 'Wands/Driftwood_Wand';
const MACA = 'Two_Hand_Maces/Driftwood_Maul';
const ESPADA = 'One_Hand_Swords/Rusted_Sword';
const ARCO = 'Bows/Crude_Bow';
/** Põe os monstros `ms` nas casas `[dx, dy]` relativas a você (imortais, sem estados). */
function posicionar(e, ms, casas) {
  ms.forEach((m, i) => Object.assign(m, { x: e.hunt.pos.x + casas[i][0], y: e.hunt.pos.y + casas[i][1], hp: 1e12, maxHp: 1e12, estados: {}, dots: [], resist: {} }));
}
/** Os golpes (balões) no monstro. */
const golpesEm = (ev, m) => ev.filter((x) => x.t === 'dmg' && x.uid === m.uid && x.foe);
/** O tique dos objetos até `ms` depois, de `passo` em `passo` ms. */
function andar(e, ms, passo = 50) {
  const ev = [];
  for (let t = 0; t < ms; t += passo) { e.hunt.clock += passo; Acoes.tiqueDosObjetos(e, e.hunt, PERSONAGEM, ev, e.hunt.clock); }
  return ev;
}

// ---------------------------------------------------------------- 1. o "mais" e o "aumentado" de um tipo

test('C2 (1): as regras — o "mais Dano de <tipo>" vira `maisDoTipoPct:<tipo>` (sem `maisDanoPct`), o do acerto corpo a corpo/projétil vira `maisDoTipoAcertoPct`, o "aumentado" vai ao do tipo', { skip: SEM }, () => {
  const comb = ef('Combustion_Support', 20, 0, 'Magia', 'Fogo');
  assert.equal(comb['maisDoTipoPct:fire'], numero(celula('Combustion_Support', 20, /mais Dano de Fogo/)));
  assert.equal(comb.maisDanoPct, undefined);
  const foco = ef('Elemental_Focus_Support', 20, 20, 'Magia', 'Fogo');
  assert.equal(foco['maisDoTipoPct:elemental'], numero(celula('Elemental_Focus_Support', 20, /mais Dano Elemental/)));
  assert.deepEqual([foco['af:fire_dmg'], foco['af:ice_dmg'], foco['af:energy_dmg'], foco.danoPct, foco.maisDanoPct], [10, 10, 10, undefined, undefined]);
  // (o "Dano Elemental com Ataques": só nos ataques)
  assert.equal(ef('Elemental_Damage_with_Attacks_Support', 20, 20, 'Magia', 'Fogo')['maisDoTipoPct:elemental'], undefined);
  const edwa = ef('Elemental_Damage_with_Attacks_Support', 20, 20, 'Ataque');
  assert.ok(edwa['maisDoTipoPct:elemental'] > 0 && edwa['af:fire_dmg'] === 10, JSON.stringify(edwa));
  // (o "Físico Corpo a Corpo" e o "Físico de Ataque de Projétil": só no acerto da parte Física)
  assert.equal(ef('Melee_Physical_Damage_Support', 20, 0, 'Ataque', 'Corpo a Corpo')['maisDoTipoAcertoPct:physical@corpo'], 49);
  assert.equal(ef('Vicious_Projectiles_Support', 20, 0, 'Ataque', 'Projétil')['maisDoTipoAcertoPct:physical@projetil+ataque'], 49);
  const mutilar = ef('Maim_Support', 20, 20, 'Ataque');
  // (aval do dono: o "Inimigos Mutilados sofrem X% de Dano Físico aumentado" é o debuff no inimigo — `af:mutilados_fisico_sofrido`, de toda fonte)
  assert.deepEqual([mutilar['maisDoTipoPct:physical'] > 0, mutilar['af:mutilados_fisico_sofrido'], mutilar.danoPct, mutilar.maisDanoPct], [true, 10, undefined, undefined]);
  assert.ok(ef('Void_Manipulation_Support', 20, 0, 'Magia', 'Caos')['maisDoTipoPct:chaos'] > 0);
  // (a conta: um tipo do caminho uma vez; o Elemental uma vez; o do acerto só com as tags)
  const e = { 'maisDoTipoPct:fire': 20, 'maisDoTipoPct:elemental': 10, 'maisDoTipoPct:physical': 50, 'maisDoTipoAcertoPct:physical@corpo': 30 };
  assert.ok(perto(C2.maisDosSuportesNosTipos(e, ['fire']), 1.2 * 1.1, 1e-9));
  assert.ok(perto(C2.maisDosSuportesNosTipos(e, ['physical', 'fire']), 1.5 * 1.2 * 1.1, 1e-9));
  assert.ok(perto(C2.maisDosSuportesNosTipos(e, ['chaos']), 1, 1e-9));
  assert.ok(perto(C2.maisDosSuportesNoAcerto(e, ['physical'], ['ataque', 'corpo']), 1.3, 1e-9));
  assert.equal(C2.maisDosSuportesNoAcerto(e, ['physical'], ['ataque', 'projetil']), 1);
});

test('C2 (1): na conta do golpe — a Combustão (19% mais Fogo) e o Foco Elemental só na parte de Fogo do Golpe Pesado com Fogo; o Físico Corpo a Corpo na Física (e no Fogo que veio dela)', { skip: SEM }, async () => {
  const partes = async (grupo) => {
    const m = await montar(MACA, [grupo]);
    // (o dano da arma fixo e alto: as razões não se perdem no arredondamento das partes)
    const a = m.e.equipment.weapon;
    if (a.poe?.atributos?.dano_fisico) { a.poe.atributos.dano_fisico = { min: 1000, max: 1000 }; a.base = { ...a.base, attack: [1000, 1000] }; }
    Ficha.invalidar(m.e);
    const u = usar(m, 0.5);
    return u.golpes[0].detalhe.porElemento;
  };
  const base = await partes(['Heavy_Strike', 'Added_Fire_Damage_Support']);
  assert.ok(base.physical > 0 && base.fire > 0, JSON.stringify(base));
  const comb = await partes(['Heavy_Strike', 'Added_Fire_Damage_Support', 'Combustion_Support']);
  const pctComb = numero(celula('Combustion_Support', 20, /mais Dano de Fogo/));
  assert.ok(perto(comb.fire, base.fire * (1 + pctComb / 100), 0.01), `${comb.fire} / ${base.fire}`);
  assert.ok(perto(comb.physical, base.physical, 0.01), `${comb.physical} / ${base.physical}: o Físico não ganha o "mais Dano de Fogo"`);
  const foco = await partes(['Heavy_Strike', 'Added_Fire_Damage_Support', 'Elemental_Focus_Support']);
  const pctFoco = numero(celula('Elemental_Focus_Support', 20, /mais Dano Elemental/));
  assert.ok(perto(foco.fire, base.fire * (1 + pctFoco / 100), 0.01) && perto(foco.physical, base.physical, 0.01), `${JSON.stringify(foco)} / ${JSON.stringify(base)}`);
  const corpo = await partes(['Heavy_Strike', 'Added_Fire_Damage_Support', 'Melee_Physical_Damage_Support']);
  // (o Fogo do Dano Adicional de Fogo é o Físico "como Extra": veio do Físico, e o "mais Físico" vale nele também — a regra do PoE, `ModsPoe.maisDaOrigem`)
  assert.ok(perto(corpo.physical, base.physical * 1.49, 0.01) && perto(corpo.fire, base.fire * 1.49, 0.01), `${JSON.stringify(corpo)} / ${JSON.stringify(base)}`);
  // (o Golpe Pesado sem o Fogo: × 1,49 no Físico)
  const so = await partes(['Heavy_Strike', 'Melee_Physical_Damage_Support']);
  const soBase = await partes(['Heavy_Strike']);
  assert.ok(perto(so.physical, soBase.physical * 1.49, 0.01), `${so.physical} / ${soBase.physical}`);
});

// ---------------------------------------------------------------- 2. o Pacto de Lycia

test('C2 (2): o Pacto de Lycia — o uso não fere; as 3 magias de canalização seguintes com 40% mais Dano; o Flagelo Celestial cai 10 vezes por canalização', { skip: SEM }, async () => {
  assert.equal(G.REGISTRO.get('Pact_of_Lycia').statusNoJogo, 'funciona');
  assert.deepEqual(G.REGISTRO.get('Pact_of_Lycia').motivosNoJogo ?? [], []);
  const m = await montar(VARINHA, [['Pact_of_Lycia'], ['Incinerate'], ['Fireball']]);
  const { e, b } = m;
  const sem = danoEm(usar(m, 0.5, 1).eventos, b);
  assert.ok(sem > 0);
  e.hunt.clock += 5000;
  const pacto = usar(m, 0.5, 0);
  assert.equal(danoEm(pacto.eventos, b), 0, 'o uso não causa dano');
  assert.deepEqual([e.hunt.poeLycia?.restantes, e.hunt.poeLycia?.maisPct], [3, 40]);
  // (a magia que não canaliza não gasta)
  e.hunt.clock += 5000;
  usar(m, 0.5, 2);
  assert.equal(e.hunt.poeLycia.restantes, 3, 'a Bola de Fogo não é de canalização');
  e.hunt.clock += 5000;
  const com = danoEm(usar(m, 0.5, 1).eventos, b);
  assert.ok(perto(com, sem * 1.4, 0.02), `${com} ≈ ${sem} × 1,4`);
  assert.equal(e.hunt.poeLycia.restantes, 2, 'o canalizar novo gastou uma');
  assert.equal(e.hunt.canalizacao.lycia?.maisPct, 40);
  // (o canalizar que continua segue fortalecido e não gasta outra)
  const ev = [];
  for (let i = 0; i < 3; i++) { ev.push(...usar(m, 0.5, 1).eventos); Acoes.tiqueDosObjetos(e, e.hunt, PERSONAGEM, ev, e.hunt.clock); }
  assert.equal(e.hunt.poeLycia.restantes, 2);
  const flagelo = (e.hunt.poeObjetos ?? []).find((o) => o.tipo === 'flageloLycia');
  assert.ok(flagelo && flagelo.feitos > 0 && flagelo.feitos < 10, JSON.stringify(flagelo));
  assert.ok(perto(flagelo.raioM, 1.2, 1e-9));
  // (parado: os que faltam caem a cada 0,05 s — 10 no total)
  e.hunt.clock += 1000;
  const fim = andar(e, 1000, 25);
  assert.equal(flagelo.feitos, 10);
  assert.ok(danoEm(fim, b) > 0, 'o Flagelo fere o alvo perto de você');
});

// ---------------------------------------------------------------- 3. o Aço Estraçalhador e o Tiro Cinético da Fragmentação

test('C2 (3): o Aço Estraçalhador — cada projétil que acerta despedaça num cone à frente do acertado (2,8 m); quem está atrás leva o cone', { skip: SEM }, async () => {
  assert.equal(C2.ACO_ESTRACALHADOR.raioM, G.areaNoNivel('Shattering_Steel', 20).raioM);
  const m = await montar(ESPADA, [['Shattering_Steel']]);
  const [atras, lado] = m.resto;
  posicionar(m.e, [m.b, atras, lado], [[2, 0], [3, 0], [2, 4]]);
  const u = usar(m, 0.5);
  // (o alvo: o projétil; o de trás: um projétil (o extra mais perto) e o cone do alvo — o do próprio projétil não o acerta)
  assert.equal(golpesEm(u.eventos, m.b).length, 1);
  assert.equal(golpesEm(u.eventos, atras).length, 2, 'o projétil e o cone');
  assert.ok(u.eventos.some((x) => x.t === 'area'), 'o cone na tela');
});

test('C2 (3): o Tiro Cinético da Fragmentação — os projéteis podem acertar o mesmo alvo: contra um alvo sozinho, os 3 acertam', { skip: SEM }, async () => {
  const m = await montar(VARINHA, [['Kinetic_Bolt_of_Fragmentation']]);
  assert.equal(golpesEm(usar(m, 0.5).eventos, m.b).length, 3);
  // (o Tiro Cinético comum segue um projétil por alvo)
  const n = await montar(VARINHA, [['Kinetic_Bolt']]);
  assert.equal(golpesEm(usar(n, 0.5).eventos, n.b).length, 1);
});

// ---------------------------------------------------------------- 4. a Bomba Congelante

for (const [slug, ms] of [['Frost_Bomb', 2000], ['Frost_Bomb_of_Instability', 1500], ['Frost_Bomb_of_Forthcoming', 2000]]) {
  test(`C2 (4): ${slug} — o cristal explode ${ms / 1000} s (a duração) depois do uso; o dano e o debuff vêm na explosão`, { skip: SEM }, async () => {
    const m = await montar(VARINHA, [[slug]]);
    const u = usar(m, 0.5);
    assert.equal(danoEm(u.eventos, m.b), 0, 'o uso só põe o cristal');
    const cristal = (m.e.hunt.poeObjetos ?? []).find((o) => o.tipo === 'explosaoDivina');
    assert.ok(cristal, 'o cristal');
    assert.equal(cristal.proxima - m.e.hunt.clock, ms);
    assert.equal(danoEm(andar(m.e, ms - 100, 100), m.b), 0, 'antes da duração, nada');
    const ev = andar(m.e, 200, 100);
    assert.ok(danoEm(ev, m.b) > 0, 'a explosão');
    if (slug === 'Frost_Bomb') {
      assert.equal(m.b.estados.exposicaoPct?.ice, 15, 'a Exposição a Gelo na explosão');
      assert.equal(m.b.estados.regenMenosDebuff?.pct, 75, 'a Regeneração reduzida na explosão');
    }
    // (a da Aproximação: o "10% mais por 0,1 s de Duração" segue na explosão — 2 s, 200% mais: 3× o balão)
    if (slug === 'Frost_Bomb_of_Forthcoming') {
      const mostrado = Acoes.danoMostrado(m.e, Acoes.POR_ID_PUBLICO(G.doSlug(slug).acao));
      const d = danoEm(ev, m.b);
      assert.ok(d >= mostrado.min * 3 * 0.99 && d <= mostrado.max * 3 * 1.01, `${d} em ${mostrado.min * 3}–${mostrado.max * 3}`);
    }
  });
}

// ---------------------------------------------------------------- 5. a Chuva de Flechas da Artilharia

test('C2 (5): a Chuva de Flechas da Artilharia — as 22 flechas em linha da casa à sua frente até o alvo, distribuídas igualmente, cada uma na casa dela (1 m)', { skip: SEM }, async () => {
  assert.equal(G.REGISTRO.get('Rain_of_Arrows_of_Artillery').statusNoJogo, 'funciona');
  assert.deepEqual(C2.casasDasFlechas([1, 2, 3, 4], 22).reduce((o, c) => ({ ...o, [c]: (o[c] ?? 0) + 1 }), {}), { 1: 6, 2: 5, 3: 6, 4: 5 });
  const m = await montar(ARCO, [['Rain_of_Arrows_of_Artillery']]);
  const [perto1, fora] = m.resto;
  // (o alvo a 4 casas; um a 1 casa na linha; um ao lado da linha)
  posicionar(m.e, [m.b, perto1, fora], [[4, 0], [1, 0], [2, 2]]);
  const u = usar(m, 0.5);
  assert.equal(golpesEm(u.eventos, m.b).length, 5, 'as 5 flechas da última casa');
  assert.equal(golpesEm(u.eventos, perto1).length, 6, 'as 6 flechas da primeira casa');
  assert.equal(golpesEm(u.eventos, fora).length, 0, 'fora da linha');
});

// ---------------------------------------------------------------- 6. a área numa conta só

test('C2 (6): a área numa conta só — os metros × √(1 + Área) ÷ 2, a fração como chance pelo mesmo sorteio do raio', { skip: SEM }, async () => {
  assert.equal(C2.raioComAArea(1.5, 0.05, 1.64), 2);
  assert.equal(C2.raioComAArea(1.5, 0.95, 1.64), 1);
  assert.equal(C2.raioComAArea(1.5, 0.95, 1), 1);
  assert.equal(C2.raioComAArea(1.5, 0.05, 1), 2);
  assert.equal(C2.raioComAArea(0.4, 0.9, 1, 1), 1, 'o mínimo da armadilha');
  // (o sorteio coerente com o raio já fixado)
  assert.ok(C2.sorteioDoRaio(1.5, 2, () => 0.99) < 0.5 && C2.sorteioDoRaio(1.5, 1, () => 0) >= 0.5);
  // (a Nova de Gelo, 3 m, com a Área de Efeito Aumentada Desperta, +64%: 1,5 × √1,64 = 1,92 casas — 2 com o sorteio 0,5, 1 com 0,95; antes, 2 + 1 casa com 0,05)
  const alcance = async (v, d) => {
    const m = await montar(VARINHA, [['Ice_Nova', 'Awakened_Increased_Area_of_Effect_Support']]);
    const longe = m.resto[0];
    posicionar(m.e, [longe], [[d, 0]]);
    return golpesEm(usar(m, v).eventos, longe).length > 0;
  };
  assert.deepEqual([await alcance(0.5, 2), await alcance(0.95, 2), await alcance(0.05, 3)], [true, false, false]);
});
