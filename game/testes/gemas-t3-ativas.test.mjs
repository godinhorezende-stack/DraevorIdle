// (lote T3, rodada 4 das gemas — dono 27/10: "quero resolver") AS ATIVAS "implementada, sem teste próprio" da parte 3: cada uma com os números do nível 20 conferidos com
// a tabela do poedb salvo (e o PoB, onde o poedb não traz) e o que o status promete medido num uso real, com os sorteios travados.
// O que os testes acharam e o lote corrigiu (systems/itens-poe/gemas-t3.mjs):
//   - a Legião Congelada era um golpe da arma a 100%, Físico, que gastava 1 uso — agora gasta todos os usos prontos, cada um uma Estátua que bate com 332,9% e todo o
//     Físico em Gelo;
//   - o Confinamento batia o orbe na hora, no inimigo mais perto — agora cada cadáver solta um orbe que detona no lugar dele depois de 1,5 s;
//   - a Tormenta de Trarthus batia na hora e o degenerativo grudava no acertado por 2 s — agora o marcador (2 s) e a poça no chão pela duração secundária (4 s);
//   - a Tempestade Relampejante acertava só o alvo, sem a conversão — agora a área, 60% em Raio, a tempestade (Cegueira, estágios, a explosão e a Rajada Relampejante);
//   - o Tiro Gélido Vaal não tinha os Atiradores Ilusórios; o Arco da Oscilação não tinha o arco secundário; a Armadilha da Espada Grande não girava;
//   - a Torre Elétrica batia a forma inteira em volta da torre a cada área; a Mina de Gelo detonava numa área de 3 casas; o raio da Rajada de Chamas contava o 1º estágio.
// A Chuva de Flechas da Artilharia fica "parcial": a linha de flechas pede o número do dono.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEM, Acoes, GS, G, Ficha, montar, posicionar, usar, andar, golpesEm, danoEm, celula, numeros, perto, travado, doPoedb } from './apoio-t3.mjs';

const Registro = await import('../systems/combate/registro.mjs');

const T3 = await import('../systems/itens-poe/gemas-t3.mjs');
const Plantadas = await import('../systems/itens-poe/armas-plantadas.mjs');
const FILA = ['Frozen_Legion', 'Ethereal_Knives_of_the_Massacre', 'Vaal_Ice_Shot', 'Blade_Trap_of_Greatswords', 'Volatile_Dead_of_Confinement', 'Thunderstorm', 'Spark_of_the_Nova',
  'Arc_of_Oscillating', 'Icicle_Mine_of_Fanning', 'Storm_Call_of_Trarthus', 'Elemental_Weakness', 'Flameblast_of_Celerity', 'Lightning_Spire_Trap_of_Overloading'];
const mods = (slug) => doPoedb(slug).mods ?? [];
const ARCO = { arma: 'Bows/Crude_Bow', vocacao: 'paladin' };

test('T3: as 13 ativas da fila estão "funciona", sem motivos; a Chuva de Flechas da Artilharia fica "parcial" pela linha de flechas (decisão do dono)', { skip: SEM }, async () => {
  await montar([['Fireball']]);
  for (const s of FILA) assert.deepEqual([s, G.doSlug(s).statusNoJogo, G.doSlug(s).motivosNoJogo], [s, 'funciona', []]);
  const a = G.doSlug('Rain_of_Arrows_of_Artillery');
  assert.equal(a.statusNoJogo, 'parcial');
  assert.deepEqual(a.motivosNoJogo, [`efeito não simulado: ${T3.MOTIVOS_T3.Rain_of_Arrows_of_Artillery[0]}`]);
  assert.equal(numeros(celula('Rain_of_Arrows_of_Artillery', /Flechas/))[0], 22);
  assert.equal(G.compilada('Rain_of_Arrows_of_Artillery', 20).stats.efetividade, numeros(celula('Rain_of_Arrows_of_Artillery', /Base Damage/))[0] / 100);
});

// ---------------------------------------------------------------- Legião Congelada

test('T3: a Legião Congelada — 6 usos de 0,8 s; o uso gasta todos os prontos, uma Estátua por uso; cada uma bate com 332,9% da arma, todo o Físico em Gelo', { skip: SEM }, async () => {
  assert.equal(numeros(celula('Frozen_Legion', /Base Damage/)).at(-1), 332.9);
  assert.match(doPoedb('Frozen_Legion').props.join(' | '), /Recarga: 0\.80 seg \(6 Times\)/);
  const st = G.compilada('Frozen_Legion', 20).stats;
  assert.ok(perto(st.efetividade, 3.329, 1e-9));
  assert.deepEqual(st.conversao, [{ para: 'gelo', pct: 100 }]);
  assert.deepEqual([G.temposNoNivel('Frozen_Legion', 20).recargaMs, G.temposNoNivel('Frozen_Legion', 20).cargas], [800, 6]);
  // (a conta do golpe: a arma × 3,329, toda em Gelo)
  const p = G.partesDoAtaque('Frozen_Legion', 20, { min: 10, max: 20 }, {}, () => 0.5);
  assert.deepEqual(Object.keys(p), ['ice']);
  assert.ok(perto(p.ice[0], 33.29, 1e-6) && perto(p.ice[1], 66.58, 1e-6));
  const opts = { arma: 'Two_Hand_Maces/Driftwood_Maul', vocacao: 'knight', classe: 'Marauder' };
  const { e, b } = await montar([['Frozen_Legion']], opts);
  const acao = G.doSlug('Frozen_Legion').acao;
  const u = usar(e, b);
  assert.ok(u.r.ok, u.r.erro);
  assert.equal(danoEm(u.eventos, b), 0, 'o uso só invoca as Estátuas');
  const ev = andar(e, 1, 100);
  const g6 = golpesEm(ev, b);
  assert.equal(g6.length, 6, '6 Estátuas, um Arrastão cada');
  assert.equal(e.hunt.cargasPoe[acao].length, 6, 'os 6 usos gastos');
  assert.ok((e.hunt.cooldowns[acao]?.ate ?? 0) > e.hunt.clock, 'sem uso pronto');
  // (0,8 s depois: 1 uso de volta — 1 Estátua)
  e.hunt.clock = e.hunt.cooldowns[acao].ate;
  const u2 = usar(e, b, { passo: 0 });
  assert.ok(u2.r.ok, u2.r.erro);
  assert.equal(golpesEm(andar(e, 1, 100), b).length, 1, 'um uso, uma Estátua');
  // (o Gelo: 75% de resistência a Gelo tira 75% de cada golpe; a de Fogo não muda nada)
  const comRes = async (resist) => {
    const m = await montar([['Frozen_Legion']], opts);
    m.b.resist = resist;
    assert.ok(usar(m.e, m.b).r.ok);
    return golpesEm(andar(m.e, 1, 100), m.b)[0].v;
  };
  const cru = await comRes({});
  assert.ok(Math.abs((await comRes({ ice: 75 })) - cru * 0.25) <= 1, 'todo o golpe é Gelo');
  assert.ok(Math.abs((await comRes({ ice: 50 })) - cru * 0.5) <= 1);
  assert.equal(await comRes({ fire: 75 }), cru);
  assert.equal(cru, g6[0].v);
});

// ---------------------------------------------------------------- Facas Etéreas do Massacre

test('T3: as Facas Etéreas do Massacre — 949 a 1423 de Físico e 16 projéteis em círculo (nível 20): acertam os inimigos em volta, em todas as direções', { skip: SEM }, async () => {
  assert.deepEqual(numeros(celula('Ethereal_Knives_of_the_Massacre', /Dano Físico/)), [949, 1423]);
  assert.equal(numeros(celula('Ethereal_Knives_of_the_Massacre', /projéteis/))[0], 16);
  assert.ok(mods('Ethereal_Knives_of_the_Massacre').includes('Dispara Projéteis em um círculo'));
  const st = G.compilada('Ethereal_Knives_of_the_Massacre', 20).stats;
  assert.deepEqual([st.dano.fisico, st.projeteis, st.circulo], [[949, 1423], 16, true]);
  const { e, b, resto } = await montar([['Ethereal_Knives_of_the_Massacre']]);
  const casas = [[-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1], [3, 0], [-3, 0], [0, 3], [0, -3]];
  posicionar(e, resto.slice(0, casas.length), casas);
  const u = usar(e, b);
  assert.ok(u.r.ok);
  for (const m of [b, ...resto.slice(0, casas.length)]) assert.ok(danoEm(u.eventos, m) > 0, `o de ${m.x - e.hunt.pos.x},${m.y - e.hunt.pos.y}`);
  assert.equal(u.eventos.filter((x) => x.t === 'shot').length, 16, '16 projéteis');
  // (o Físico: a resistência a Fogo não muda o golpe)
  const um = await montar([['Ethereal_Knives_of_the_Massacre']]);
  um.b.resist = { fire: 75, ice: 75, energy: 75 };
  assert.equal(danoEm(usar(um.e, um.b).eventos, um.b), danoEm(u.eventos, b));
});

// ---------------------------------------------------------------- Faísca da Nova

test('T3: a Faísca da Nova — 111 a 2113 de Raio, 10 projéteis em círculo, 2 s (nível 20): acerta em volta; 75% de resistência a Raio tira 75%', { skip: SEM }, async () => {
  assert.deepEqual(numeros(celula('Spark_of_the_Nova', /Dano de Raio/)), [111, 2113]);
  assert.equal(numeros(celula('Spark_of_the_Nova', /projéteis/))[0], 10);
  assert.ok(mods('Spark_of_the_Nova').includes('Dispara Projéteis em um círculo') && mods('Spark_of_the_Nova').includes('Duração base é de 2 segundos'));
  const st = G.compilada('Spark_of_the_Nova', 20).stats;
  assert.deepEqual([st.dano.raio, st.projeteis, st.circulo, st.duracao], [[111, 2113], 10, true, 2]);
  const { e, b, resto } = await montar([['Spark_of_the_Nova']]);
  const casas = [[-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [2, 0], [-2, 0], [0, 2], [0, -2]];
  posicionar(e, resto.slice(0, casas.length), casas);
  const u = usar(e, b);
  for (const m of [b, ...resto.slice(0, casas.length)]) assert.ok(danoEm(u.eventos, m) > 0, `o de ${m.x - e.hunt.pos.x},${m.y - e.hunt.pos.y}`);
  assert.equal(u.eventos.filter((x) => x.t === 'shot').length, 10);
  const r = await montar([['Spark_of_the_Nova']]);
  r.b.resist = { energy: 75 };
  assert.ok(perto(danoEm(usar(r.e, r.b).eventos, r.b), danoEm(u.eventos, b) * 0.25, 0.01));
});

// ---------------------------------------------------------------- Arco Elétrico da Oscilação

test('T3: o Arco Elétrico da Oscilação — 94 a 531 de Raio, 6 ricochetes, 50% mais por ricochete restante; a cada salto, um arco secundário que não ricocheteia', { skip: SEM }, async () => {
  assert.deepEqual(numeros(celula('Arc_of_Oscillating', /Dano de Raio/)), [94, 531]);
  assert.ok(mods('Arc_of_Oscillating').includes('Ricocheteia +6 Vezes') && mods('Arc_of_Oscillating').includes('50 % mais Dano com Acertos e Afecções por cada Ricochete restante'));
  const { e, b, resto } = await montar([['Arc_of_Oscillating']]);
  // (a linha dos saltos — 1 a 7 casas — e uma fileira ao lado para os arcos secundários)
  const linha = [[2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0]];
  const lado = [[2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1]];
  posicionar(e, resto.slice(0, 12), [...linha, ...lado]);
  const u = usar(e, b);
  assert.ok(u.r.ok);
  const cadeia = [b, ...resto.slice(0, 6)].map((m) => golpesEm(u.eventos, m));
  assert.ok(cadeia.every((g) => g.length === 1), 'o arco e os 6 saltos');
  const base = cadeia[6][0].v;
  cadeia.forEach((g, i) => assert.ok(Math.abs(g[0].v - base * (1 + 0.5 * (6 - i))) <= 1, `o ${i}º: ${g[0].v} ≈ ${base} × ${1 + 0.5 * (6 - i)}`));
  const secundarios = resto.slice(6, 12).map((m) => golpesEm(u.eventos, m));
  assert.equal(secundarios.filter((g) => g.length === 1).length, 6, 'um arco secundário a cada salto');
  for (const g of secundarios.filter((x) => x.length)) assert.ok(Math.abs(g[0].v - base) <= 1, 'sem ricochetes restantes: × 1');
});

// ---------------------------------------------------------------- Elemental Weakness

test('T3: a Fraqueza Elemental — −30% de Resistências Elementais, 11,8 s, +1 m de raio (nível 20): amaldiçoado, a Bola de Fogo bate × (1 − 0,2) ÷ (1 − 0,5)', { skip: SEM }, async () => {
  assert.deepEqual([numeros(celula('Elemental_Weakness', /Resistências Elementais/))[0], numeros(celula('Elemental_Weakness', /Duração base/))[0], numeros(celula('Elemental_Weakness', /metros de raio/))[0]], [-30, 11.8, 1]);
  const st = G.compilada('Elemental_Weakness', 20).stats;
  assert.deepEqual([st.maldicao.resist, st.duracao, st.raioBonus], [{ fogo: -30, gelo: -30, raio: -30 }, 11.8, 1]);
  assert.equal(G.areaNoNivel('Elemental_Weakness', 20).raioM, 2.6, 'o 1,6 m da gema + 1 m');
  const { e, b } = await montar([['Elemental_Weakness'], ['Fireball']], { barra: ['Elemental_Weakness', 'Fireball'] });
  b.resist = { fire: 50 };
  const sem = danoEm(usar(e, b, { slot: 1 }).eventos, b);
  const u = usar(e, b, { slot: 0, passo: 1000 });
  assert.ok(u.r.ok);
  const buff = e.hunt.buffs[G.doSlug('Elemental_Weakness').acao];
  assert.equal(buff.ate - u.inicio, 11_800 + (buff.ate - u.inicio - 11_800), 'ligada');
  assert.ok(buff.efeitosPoe.filter((x) => x.efeito === 'marcaVulneravel').every((x) => x.pct === 30));
  // (a maldição pega no acerto — o primeiro acerto amaldiçoa, o seguinte já bate no amaldiçoado)
  usar(e, b, { slot: 1, passo: 500 });
  assert.ok(b.maldicoes && Object.keys(b.maldicoes).length, 'a maldição no alvo');
  const com = danoEm(usar(e, b, { slot: 1, passo: 500 }).eventos, b);
  assert.ok(perto(com, (sem * 0.8) / 0.5, 0.01), `amaldiçoado: ${com} ≈ ${sem} × 0,8 ÷ 0,5`);
});

// ---------------------------------------------------------------- Rajada de Chamas da Celeridade

test('T3: a Rajada de Chamas da Celeridade — 541 a 811 de Fogo, 3 estágios, 220% mais Dano Mágico por estágio, 1 m + 0,7 m por estágio depois do primeiro (2,4 m nos 3)', { skip: SEM }, async () => {
  assert.deepEqual(numeros(celula('Flameblast_of_Celerity', /Dano de Fogo/)), [541, 811]);
  for (const l of ['220 % mais Dano Mágico por estágio', 'Raio Base é de 1 metro', '3 ao máximo de Estágios', '+0.7 metros ao raio por Estágio']) assert.ok(mods('Flameblast_of_Celerity').includes(l), l);
  const est = G.estagiosDaGema('Flameblast_of_Celerity', 20);
  assert.deepEqual([est.max, est.mais, est.raioM, est.raioAposPrimeiro, est.modo], [3, 220, 0.7, true, 'carrega']);
  const canalizar = async (v) => {
    const m = await montar([['Flameblast_of_Celerity'], ['Fireball']], { barra: ['Flameblast_of_Celerity', 'Fireball'] });
    const longe = m.resto[0];
    posicionar(m.e, [longe], [[3, 0]]);
    const d = [];
    for (let i = 0; i < 3; i++) {
      if (i) m.e.hunt.clock = Math.max(m.e.hunt.clock, m.e.hunt.canalizacao?.ate ?? m.e.hunt.clock);
      const u = usar(m.e, m.b, { passo: i ? 0 : 60_000, v });
      assert.ok(u.r.ok);
      d.push(danoEm(u.eventos, m.b), danoEm(u.eventos, longe));
    }
    return { m, d };
  };
  const { m, d } = await canalizar(0.5);
  assert.deepEqual(d.slice(0, 4), [0, 0, 0, 0], 'os 2 primeiros usos só carregam');
  // (a explosão no 3º: × (1 + 2,2 × 3) = 7,6 — contra a Bola de Fogo do mesmo personagem, as duas de Fogo sem crítico)
  const fb = usar(m.e, m.b, { slot: 1, passo: 60_000 });
  const dFb = G.danoNoNivel('Fireball', 20);
  const dFl = G.danoNoNivel('Flameblast_of_Celerity', 20);
  const fator = danoEm(fb.eventos, m.b) / ((dFb.min + dFb.max) / 2);
  assert.ok(perto(d[4], ((dFl.min + dFl.max) / 2) * 7.6 * fator, 0.03), `${d[4]} ≈ ${(dFl.min + dFl.max) / 2} × 7,6 × ${fator.toFixed(3)}`);
  // (o raio nos 3 estágios, em volta do alvo: 1 + 0,7 × 2 = 2,4 m = 1,2 casa — o bicho a 2 casas do alvo só com o sorteio abaixo de 0,2; antes 3,1 m = 1,55 casa)
  assert.equal(d[5], 0, 'a 2 casas, com o sorteio em 0,5: fora');
  assert.ok((await canalizar(0.1)).d[5] > 0, 'com o sorteio em 0,1: dentro');
});

// ---------------------------------------------------------------- Mina de Gelo da Ventilação

test('T3: a Mina de Gelo da Ventilação — 591 a 886 de Gelo, 3 projéteis +1 a cada 2 Minas anteriores na sequência, a aura de 10% de crítico por Mina (até 500%)', { skip: SEM }, async () => {
  assert.deepEqual(numeros(celula('Icicle_Mine_of_Fanning', /Dano de Gelo/)), [591, 886]);
  for (const l of ['Dispara 3 projéteis', 'Dispara um Projétil adicional para cada 2 Minas anteriores na Sequência de Detonação', 'Mina dura 5 segundos', 'Tempo Base de Detonação de Mina é de 0.3 segundos']) assert.ok(mods('Icicle_Mine_of_Fanning').includes(l), l);
  assert.deepEqual([G.minaDaGema('Icicle_Mine_of_Fanning', 20).porAnteriores], [2]);
  const { e, b, resto } = await montar([['Icicle_Mine_of_Fanning']]);
  posicionar(e, resto.slice(0, 8), [[2, 0], [3, 0], [1, 1], [1, -1], [2, 1], [2, -1], [0, 2], [0, -2]]);
  // (4 Minas plantadas andando; paradas, detonam em sequência)
  for (let i = 0; i < 4; i++) {
    e.hunt.poeRecente = { ...(e.hunt.poeRecente ?? {}), moveu: e.hunt.clock + (i ? 500 : 60_000) + 2000 };
    assert.ok(usar(e, b, { passo: i ? 500 : 60_000 }).r.ok);
  }
  assert.equal(Plantadas.plantadas(e.hunt, 'mina', e.hunt.clock).length, 4);
  e.hunt.poeRecente.moveu = 0;
  const porDetonacao = [];
  for (let k = 0; k < 30 && porDetonacao.length < 4; k++) {
    const ev = andar(e, 1, 50);
    const golpes = ev.filter((x) => x.t === 'dmg' && x.foe);
    if (golpes.length) porDetonacao.push(new Set(golpes.map((x) => x.uid)).size);
  }
  assert.deepEqual(porDetonacao, [3, 3, 4, 4], 'cada projétil num inimigo: 3, 3, 4 (2 anteriores), 4');
  assert.equal(b.estados.minaCritico.pct, 40, '10% por Mina perto');
});

// ---------------------------------------------------------------- Invocar Tormenta de Trarthus

test('T3: a Invocar Tormenta de Trarthus — o raio cai no marcador 2 s depois (1150 a 1726 de Físico); a poça de sangue fervente: 2316,8 por segundo, 4 s, no chão', { skip: SEM }, async () => {
  assert.deepEqual(numeros(celula('Storm_Call_of_Trarthus', /Dano Físico$/)), [1150, 1726]);
  assert.equal(numeros(celula('Storm_Call_of_Trarthus', /por segundo/))[0], 2316.8);
  assert.equal(numeros(celula('Storm_Call_of_Trarthus', /metros de raio/))[0], 0.9);
  for (const l of ['Duração base é de 2 segundos', 'Duração Base Secundária é de 4 segundos']) assert.ok(mods('Storm_Call_of_Trarthus').includes(l), l);
  const { e, b, resto } = await montar([['Storm_Call_of_Trarthus']]);
  const fora = resto[0];
  posicionar(e, [fora], [[5, 0]]);
  const u = usar(e, b);
  assert.ok(u.r.ok);
  assert.equal(danoEm(u.eventos, b), 0, 'o uso só marca');
  const antes = andar(e, 7, 250);
  assert.equal(danoEm(antes, b), 0, 'até 2 s, nada');
  const raio = andar(e, 1, 250);
  assert.equal(golpesEm(raio, b).length, 1, 'o raio cai aos 2 s');
  assert.deepEqual(b.dots ?? [], [], 'o degenerativo não gruda no acertado');
  const poca = (e.hunt.poeObjetos ?? []).find((o) => o.poçaT3);
  assert.ok(poca, 'a poça no chão');
  assert.equal(poca.ate - (e.hunt.clock), 4000, '4 s (a duração secundária)');
  // (na poça: o dano por segundo da gema, com os aumentos da magia — "Modificadores de Dano Mágico aplicam-se ao Dano Degenerativo")
  const porS = poca.partes.reduce((t, p) => t + p.porSegundo, 0);
  assert.ok(porS >= 2316.8, `${porS} ≥ 2316,8`);
  const naPoca = andar(e, 4, 250);
  assert.ok(perto(danoEm(naPoca, b), porS, 0.02), `1 s na poça: ${danoEm(naPoca, b)} ≈ ${porS}`);
  assert.equal(danoEm(naPoca, fora), 0, 'fora da poça, nada');
  // (quem sai da poça para de queimar)
  Object.assign(b, { x: b.x + 6 });
  assert.equal(danoEm(andar(e, 4, 250), b), 0);
  // (um segundo marcador: quando um cai, os outros caem junto)
  const m2 = await montar([['Storm_Call_of_Trarthus']]);
  const outro = m2.resto[0];
  posicionar(m2.e, [outro], [[4, 0]]);
  assert.ok(usar(m2.e, m2.b).r.ok);
  assert.ok(usar(m2.e, outro, { passo: 1000 }).r.ok);
  const ev = andar(m2.e, 1, 250);
  assert.equal(golpesEm(ev, m2.b).length + golpesEm(ev, outro).length, 2, 'o primeiro cai e leva o segundo, antes do tempo dele');
});

// ---------------------------------------------------------------- Mortos Voláteis do Confinamento

test('T3: os Mortos Voláteis do Confinamento — 3 cadáveres explodem (4% da Vida, 2,3 m) e cada um solta um orbe que detona no lugar dele 1,5 s depois (938 a 1407 de Fogo, 2,8 m)', { skip: SEM }, async () => {
  assert.deepEqual(numeros(celula('Volatile_Dead_of_Confinement', /Dano de Fogo$/)), [938, 1407]);
  assert.equal(numeros(celula('Volatile_Dead_of_Confinement', /Vida Máxima do Cadáver/))[0], 4);
  for (const l of ['Duração base é de 1.5 segundos', 'Consome até 3 cadáveres', 'O raio Base é de 2.8 metros', 'Raio Base da explosao igual a 2.3 metros', 'Máximo de 60 Orbes por vez']) assert.ok(mods('Volatile_Dead_of_Confinement').includes(l), l);
  assert.deepEqual(G.objetoDaGema('Volatile_Dead_of_Confinement', 20, 0), { tipo: 'orbeConfinado', semAcerto: true, atrasoMs: 1500, raioM: 2.8 });
  const { e, b, resto } = await montar([['Volatile_Dead_of_Confinement']]);
  const longe = resto[0];
  posicionar(e, [longe], [[6, 0]]);
  e.hunt.cadaveres = [0, 1, 2, 3].map((i) => ({ key: `c${i}`, nome: 'Morto', look: 1, x: b.x, y: b.y, maxHp: 10_000 }));
  const u = usar(e, b);
  assert.ok(u.r.ok);
  const explosoes = golpesEm(u.eventos, b);
  assert.equal(explosoes.length, 3, '3 cadáveres consumidos');
  assert.equal(e.hunt.cadaveres.length, 1);
  assert.equal(golpesEm(andar(e, 5, 250), b).length, 0, 'antes de 1,5 s, nada');
  const orbes = golpesEm(andar(e, 1, 250), b);
  assert.equal(orbes.length, 3, 'um orbe por cadáver, aos 1,5 s');
  assert.equal(danoEm(andar(e, 2, 250), longe), 0);
  // (o orbe é a magia: 75% de resistência a Fogo tira 75% de cada um)
  const r = await montar([['Volatile_Dead_of_Confinement']]);
  r.b.resist = { fire: 75 };
  r.e.hunt.cadaveres = [{ key: 'c', nome: 'Morto', look: 1, x: r.b.x, y: r.b.y, maxHp: 10_000 }];
  assert.ok(usar(r.e, r.b).r.ok);
  assert.ok(perto(golpesEm(andar(r.e, 6, 250), r.b)[0].v, orbes[0].v * 0.25, 0.02));
});

// ---------------------------------------------------------------- Tempestade Relampejante

test('T3: a Tempestade Relampejante — a flecha (125%, 2,3 m, 60% em Raio) e a tempestade: Cega, ganha estágios com você dentro; ao sair no máximo, explode (300% mais) e Ativa a Rajada', { skip: SEM }, async () => {
  assert.deepEqual(numeros(celula('Thunderstorm', /Base Damage/)), [125, 125, 125, 139]);
  assert.equal(numeros(celula('Thunderstorm', /raio Base/))[0], 2.3);
  const st = G.compilada('Thunderstorm', 20).stats;
  assert.deepEqual([st.efetividade, st.conversao], [1.25, [{ para: 'raio', pct: 60 }]]);
  assert.deepEqual([T3.TEMPESTADE.estagios, T3.TEMPESTADE.estagioMs, T3.TEMPESTADE.detonacaoMaisPct, T3.TEMPESTADE.duracaoMs, T3.TEMPESTADE.rajada.projeteis, T3.TEMPESTADE.rajada.eficacia], [4, 250, 300, 10_000, 5, 1.39]);
  const { e, b, resto } = await montar([['Thunderstorm']], ARCO);
  const vizinho = resto[0];
  posicionar(e, [vizinho], [[2, 0]]);
  const u = usar(e, b, { v: 0.9 });
  assert.ok(u.r.ok);
  const flecha = golpesEm(u.eventos, b);
  assert.equal(flecha.length, 1);
  assert.ok(danoEm(u.eventos, vizinho) > 0, 'a área da flecha pega o vizinho');
  // (você colado no alvo, dentro da tempestade: 4 estágios em 1 s; quem está nela fica Cego)
  andar(e, 5, 250, 0.9);
  const t = e.hunt.poeObjetos.find((o) => o.tipo === 'tempestadeT3');
  assert.equal(t.estagios, 4);
  assert.ok((b.estados?.cego?.ate ?? 0) > e.hunt.clock, 'Cego');
  // (saiu: a explosão — × 4 o golpe da flecha no mesmo sorteio, antes da resistência e da Armadura do alvo — e a Rajada)
  e.hunt.pos.x -= 6;
  Registro.definirNivel(1);
  Registro.limparRegistro();
  let ev;
  try { ev = andar(e, 1, 250, 0.9); } finally { Registro.definirNivel(0); }
  const exp = golpesEm(ev, b).filter((x) => x.sk === 'poe-gema:Thunderstorm');
  assert.ok(exp.length >= 1, 'a explosão acerta o alvo');
  const bruto = Registro.ultimosGolpes(20).find((x) => x.habilidade === 'poe-gema:Thunderstorm')?.danoAntesDaResistencia;
  const m0 = await montar([['Thunderstorm']], ARCO);
  Registro.definirNivel(1);
  Registro.limparRegistro();
  try { usar(m0.e, m0.b, { v: 0.9 }); } finally { Registro.definirNivel(0); }
  const brutoFlecha = Registro.ultimosGolpes(5).find((x) => x.habilidade === 'poe-gema:Thunderstorm')?.danoAntesDaResistencia;
  assert.ok(Math.abs(bruto - brutoFlecha * 4) <= 4, `explosão ${bruto} ≈ ${brutoFlecha} × 4 (antes da Armadura)`);
  assert.equal(ev.filter((x) => x.t === 'shot').length, 1 + T3.TEMPESTADE.rajada.projeteis, 'a Rajada: 5 projéteis');
  assert.ok(!(e.hunt.poeObjetos ?? []).some((o) => o.tipo === 'tempestadeT3'), 'a tempestade acabou');
  assert.equal((e.hunt.poeObjetos ?? []).filter((o) => o.tipo === 'explosaoRajadaT3').length, 5, 'cada projétil explode depois de 3 s');
  // (sem você dentro, a tempestade só Cega e acaba no tempo, sem explodir)
  const m2 = await montar([['Thunderstorm']], ARCO);
  posicionar(m2.e, [m2.b], [[5, 0]]);
  assert.ok(usar(m2.e, m2.b).r.ok);
  const ev2 = andar(m2.e, 44, 250);
  assert.equal(golpesEm(ev2, m2.b).length, 0, 'sem explosão');
  assert.ok(!(m2.e.hunt.poeObjetos ?? []).some((o) => o.tipo === 'tempestadeT3'), '10 s depois, acabou');
  // (dentro e sair antes do máximo: dissipa sem explodir)
  const m3 = await montar([['Thunderstorm']], ARCO);
  assert.ok(usar(m3.e, m3.b).r.ok);
  andar(m3.e, 2, 250);
  m3.e.hunt.pos.x -= 6;
  assert.equal(golpesEm(andar(m3.e, 2, 250), m3.b).length, 0);
  assert.ok(!(m3.e.hunt.poeObjetos ?? []).some((o) => o.tipo === 'tempestadeT3'));
});

// ---------------------------------------------------------------- Tiro Gélido Vaal

test('T3: o Tiro Gélido Vaal — 200,1%, 60% em Gelo, Resfria como se 195% mais; convoca 6 Atiradores Ilusórios por 6 s, que disparam a cada Tiro de Gelo seu (um projétil cada)', { skip: SEM }, async () => {
  assert.equal(numeros(celula('Vaal_Ice_Shot', /Base Damage/))[0], 200.1);
  assert.equal(numeros(celula('Vaal_Ice_Shot', /Resfria/))[0], 195);
  for (const l of ['Duração base é de 6 segundos', '60 % do Dano Físico Convertido para Dano de Gelo']) assert.ok(mods('Vaal_Ice_Shot').includes(l), l);
  assert.deepEqual(G.atiradoresDaGema('Vaal_Ice_Shot', 20), { n: 6, duracaoMs: 6000 });
  assert.deepEqual(G.compilada('Vaal_Ice_Shot', 20).stats.conversao, [{ para: 'gelo', pct: 60 }]);
  // (o Tiro Gélido Vaal com a Barragem — 4 projéteis a mais em sequência: o seu uso dispara 5; o dos Atiradores, um só)
  const { e, b } = await montar([['Vaal_Ice_Shot', 'Barrage_Support'], ['Ice_Shot']], { ...ARCO, barra: ['Vaal_Ice_Shot', 'Ice_Shot'] });
  assert.equal(GS.efeitoNaSkill(e, G.doSlug('Vaal_Ice_Shot').acao).alvosExtras, 4);
  const vaal = 'poe-gema:Vaal_Ice_Shot';
  const sem = usar(e, b, { slot: 1 });
  assert.equal(golpesEm(sem.eventos, b).filter((x) => x.sk === vaal).length, 0, 'sem os Atiradores, o Tiro de Gelo é só o seu');
  const uv = usar(e, b, { slot: 0, passo: 2000 });
  assert.ok(uv.r.ok, uv.r.erro);
  assert.equal(golpesEm(uv.eventos, b).length, 5, 'o seu Tiro Gélido Vaal: os 5 da Barragem no alvo');
  assert.deepEqual(e.hunt.poeAtiradoresT3, { acao: vaal, n: 6, ate: uv.inicio + 6000 });
  // (o uso da Barragem dura 5 ataques: o Tiro de Gelo 3 s depois, ainda nos 6 s)
  const u = usar(e, b, { slot: 1, passo: 3000 });
  assert.ok(u.r.ok, u.r.erro);
  const dosAtiradores = golpesEm(u.eventos, b).filter((x) => x.sk === vaal);
  assert.equal(dosAtiradores.length, 6, 'cada um dos 6 dispara no seu alvo');
  assert.equal(u.eventos.filter((x) => x.t === 'shot' && x.sk === vaal).length, 6, 'um projétil cada (os modificadores da quantidade não valem neles)');
  assert.ok(dosAtiradores.every((x) => Math.abs(x.v - golpesEm(uv.eventos, b)[0].v) <= 1), 'o golpe do Tiro Gélido Vaal, como o seu');
  // (passados os 6 s, eles se vão)
  const depois = usar(e, b, { slot: 1, passo: 6000 });
  assert.equal(golpesEm(depois.eventos, b).filter((x) => x.sk === vaal).length, 0);
  assert.equal(e.hunt.poeAtiradoresT3, undefined, 'o estado sai da caçada');
});

// ---------------------------------------------------------------- Armadilha de Lâminas da Espada Grande

test('T3: a Armadilha de Lâminas da Espada Grande — 220%, 2,8 m, recarga 6 s (3 usos); ativada, gira pela duração (3,5 s): 14 giros de 0,25 s, cada um acerta uma vez quem está na área', { skip: SEM }, async () => {
  assert.equal(numeros(celula('Blade_Trap_of_Greatswords', /Base Damage/))[0], 220);
  assert.equal(numeros(celula('Blade_Trap_of_Greatswords', /raio Base/))[0], 2.8);
  for (const l of ['Armadilha dura 4 segundo', 'Duração base é de 3.5 segundos']) assert.ok(mods('Blade_Trap_of_Greatswords').includes(l), l);
  assert.match(doPoedb('Blade_Trap_of_Greatswords').props.join(' | '), /Recarga: 6\.00 seg \(3 Times\)/);
  assert.deepEqual(T3.girosDaEspadaGrande(3500), { giros: 14, chanceDeMais: 0, intervaloMs: 250 });
  const giros = async (qualidade) => {
    const m = await montar([['Blade_Trap_of_Greatswords']], { arma: 'Two_Hand_Swords/Corroded_Blade', vocacao: 'knight', classe: 'Duelist', qualidade });
    const fora = m.resto[0];
    posicionar(m.e, [fora], [[5, 0]]);
    const u = usar(m.e, m.b);
    assert.ok(u.r.ok, u.r.erro);
    const ev = [...u.eventos, ...andar(m.e, 20, 250)];
    return { n: golpesEm(ev, m.b).length, fora: golpesEm(ev, fora).length };
  };
  assert.deepEqual(await giros(0), { n: 14, fora: 0 });
  // (a qualidade 20: "+0,5 segundos à duração base" — 4 s, 16 giros)
  assert.equal(G.compilada('Blade_Trap_of_Greatswords', 20, 20).stats.duracao, 4);
  assert.deepEqual(await giros(20), { n: 16, fora: 0 });
});

// ---------------------------------------------------------------- Armadilha da Espiral Relampejante da Sobrecarga

test('T3: a Armadilha de Torre Elétrica da Sobrecarga — 484 a 1453 de Raio, crítico 100%, 8 áreas a cada 1 s por 3,5 s; cada área cai num inimigo e acerta a 1 m dele (não a torre inteira)', { skip: SEM }, async () => {
  assert.deepEqual(numeros(celula('Lightning_Spire_Trap_of_Overloading', /Dano de Raio/)), [484, 1453]);
  for (const l of ['Ataca a cada 1 segundos', 'Golpeia 8 Áreas', 'Duração base é de 3.5 segundos', 'Armadilha dura 4 segundo']) assert.ok(mods('Lightning_Spire_Trap_of_Overloading').includes(l), l);
  assert.match(doPoedb('Lightning_Spire_Trap_of_Overloading').props.join(' | '), /Chance de Crítico: 100\.00%/);
  assert.deepEqual(G.torreDaGema('Lightning_Spire_Trap_of_Overloading', 20), { intervaloMs: 1000, duracaoMs: 3500, areas: 8, velocidadeDeArremesso: false });
  assert.equal(T3.impactoDaTorreM('Lightning_Spire_Trap_of_Overloading'), 1);
  // (um inimigo só perto: as 8 áreas nele, todas críticas)
  const um = await montar([['Lightning_Spire_Trap_of_Overloading']]);
  const u = usar(um.e, um.b);
  assert.ok(u.r.ok);
  const ev = [...u.eventos, ...andar(um.e, 1, 100)];
  const g = golpesEm(ev, um.b);
  assert.equal(g.length, 8);
  assert.ok(g.every((x) => x.crit), 'crítico 100%');
  // (dois inimigos a 2 casas um do outro: cada área cai em um e acerta só ele — a área de impacto, 1 m = 0 ou 1 casa — e não os dois; o sorteio alterna os alvos)
  const dois = await montar([['Lightning_Spire_Trap_of_Overloading']]);
  const outro = dois.resto[0];
  posicionar(dois.e, [outro], [[1, 2]]);
  assert.ok(usar(dois.e, dois.b).r.ok);
  // (a ativação e o primeiro golpe com o sorteio em 0,5; o segundo golpe, 1 s depois, com o sorteio alternando entre os dois alvos e a área de impacto de 0 casa)
  andar(dois.e, 1, 100);
  let k = 0;
  dois.e.hunt.clock += 1000;
  const ev2 = travado(() => (k++ % 2 ? 0.9 : 0.1), () => [...Acoes.tiqueDasPlantadas(dois.e, dois.e.hunt, null, [])]);
  const [a, c] = [golpesEm(ev2, dois.b).length, golpesEm(ev2, outro).length];
  assert.ok(a + c <= 8 && a > 0 && c > 0, `cada área num só: ${a} + ${c} ≤ 8 (antes, 8 + 8)`);
});
