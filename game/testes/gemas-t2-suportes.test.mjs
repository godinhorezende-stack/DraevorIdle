// (lote T2, rodada 4 — 27/10) OS SUPORTES da fila T2 (os que estavam "implementada, sem teste próprio"): o número de cada linha no nível máximo de verdade (20; os
// Despertos no 5, as Excepcionais no 3 — o Iluminar Desperto no 4), conferido com o poedb, e o efeito medido numa caçada com e sem o suporte, os sorteios travados.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEM, G, SP, Acoes, Ficha, montar, usar, danoEm, golpesEm, ef, perto, acao } from './gemas-t2-apoio.mjs';

const { resistenciaDe } = await import('../systems/hunt/resistencia.mjs');
const entryDe = (slug) => Acoes.POR_ID_PUBLICO(acao(slug));
function semResistencia(e, b) {
  b.resist = {};
  for (const el of ['fire', 'ice', 'energy', 'chaos']) b.resist[el] = -resistenciaDe(e.hunt, b, el);
}
/** Os inimigos `resto[i]` nas casas `[dx, dy]` em volta do alvo. */
const perto_ = (b, resto, casas) => casas.forEach(([dx, dy], i) => Object.assign(resto[i], { x: b.x + dx, y: b.y + dy, estados: {}, dots: [] }));

const FILA = ['Damage_on_Full_Life_Support', 'Pulverise_Support', 'Awakened_Burning_Damage_Support', 'Awakened_Melee_Splash_Support', 'Multiple_Projectiles_Support', 'Mana_Leech_Support',
  'Greater_Volley_Support', 'Awakened_Chain_Support', 'Awakened_Greater_Multiple_Projectiles_Support', 'Enlighten_Support', 'Minion_Life_Support', 'Lightning_Penetration_Support',
  'Awakened_Added_Lightning_Damage_Support', 'Awakened_Enlighten_Support', 'Awakened_Unbound_Ailments_Support', 'Greater_Spell_Echo_Support'];
test('T2: os suportes da fila seguem "funciona", sem linha não feita no nível máximo', { skip: SEM }, () => {
  const falhas = FILA.filter((s) => SP.doSlug(s)?.status !== 'funciona' || SP.efeitoNoNivel(s, 20, 20, { tags: ['poe:Ataque', 'poe:Magia'] }).naoFeitas.length).map((s) => `${s}: ${SP.doSlug(s)?.status}`);
  assert.deepEqual(falhas, []);
});

// ---------------------------------------------------------------- Dano com Vida Cheia

test('T2 Damage_on_Full_Life: 34% mais Dano de Ataque com Vida Cheia no 20 (poedb) — só com a Vida no máximo (antes, sempre); custo 130%', { skip: SEM }, async () => {
  const e20 = ef('Damage_on_Full_Life_Support', 20, 0, 'Ataque');
  assert.deepEqual([e20['af:mais_dano@vidaCheia'], e20.custoPct, e20.maisDanoPct], [34, 30, undefined]);
  assert.equal(ef('Damage_on_Full_Life_Support', 20, 20, 'Ataque').danoPct, 10, 'a qualidade: Dano aumentado em 10%, sem condição');
  assert.equal(ef('Damage_on_Full_Life_Support', 20, 0, 'Magia')['af:mais_dano@vidaCheia'], undefined, 'só Ataques');
  const golpe = async (slugs, vidaPct = 1) => { const { e, b } = await montar(slugs); e.hp = e.maxHp * vidaPct; return danoEm(usar(e, 0, b).ev, b); };
  const sem = await golpe(['Cleave']);
  assert.ok(perto((await golpe(['Cleave', 'Damage_on_Full_Life_Support'])) / sem, 1.34, 0.01), 'Vida Cheia');
  assert.ok(perto((await golpe(['Cleave', 'Damage_on_Full_Life_Support'], 0.9)) / sem, 1, 0.01), 'com 90% da Vida, nada');
});

// ---------------------------------------------------------------- Pulverizar

test('T2 Pulverise: 49% mais Dano Corpo a Corpo em Área, 15% menos Velocidade de Ataque e 34% de Área (+10% na qualidade 20) — poedb, nível 20', { skip: SEM }, async () => {
  const p = ef('Pulverise_Support', 20, 0, 'Ataque', 'Área', 'Corpo a Corpo');
  assert.deepEqual([p.maisDanoAcertoPct, p.areaIncPct, p.custoPct], [49, 34, 30]);
  assert.ok(perto(p.castTimePct, (1 / 0.85 - 1) * 100));
  assert.equal(ef('Pulverise_Support', 20, 20, 'Ataque', 'Área', 'Corpo a Corpo').areaIncPct, 44);
  const { e, b } = await montar(['Ground_Slam']);
  const { e: e2, b: b2 } = await montar(['Ground_Slam', 'Pulverise_Support']);
  // (o sorteio 0,3: a fração da casa a mais do raio — 2,25 casas sem, 2,6 com — sai a favor nos dois)
  const sem = usar(e, 0, b, 0.3);
  const com = usar(e2, 0, b2, 0.3);
  assert.ok(perto(danoEm(com.ev, b2) / danoEm(sem.ev, b), 1.49, 0.01), `${danoEm(com.ev, b2)} / ${danoEm(sem.ev, b)}`);
  // a velocidade: o tempo do ataque ÷ 0,85
  assert.ok(Math.abs(Acoes.temposDaGemaPoe(e2, entryDe('Ground_Slam')).uso - Acoes.temposDaGemaPoe(e, entryDe('Ground_Slam')).uso / 0.85) <= 1);
  // a área: mais casas na forma do golpe (34% de Área = × √1,34 no raio)
  const casas = (ev) => ev.filter((x) => x.t === 'area').reduce((t, x) => t + (x.casas?.length ?? 0), 0);
  assert.ok(casas(com.ev) > casas(sem.ev), `${casas(com.ev)} > ${casas(sem.ev)}`);
});

// ---------------------------------------------------------------- Suporte Desperto: Dano Incendiário

test('T2 Awakened_Burning_Damage: no 5, 39% mais Dano Incendiário e +1 ao nível das gemas de Fogo (poedb); a qualidade, +10% de Dano Incendiário aumentado', { skip: SEM }, async () => {
  const a = ef('Awakened_Burning_Damage_Support', 5, 0, 'Magia', 'Fogo');
  assert.deepEqual([a.maisDotFogoPct, a.nivelExtra, a.custoPct], [39, 1, 30]);
  assert.equal(ef('Awakened_Burning_Damage_Support', 5, 0, 'Magia', 'Gelo').nivelExtra, undefined, 'o +1 só nas de Fogo');
  assert.equal(ef('Awakened_Burning_Damage_Support', 5, 20, 'Magia', 'Fogo')['af:ignite_dmg_inc'], 10);
  assert.equal(ef('Awakened_Burning_Damage_Support', 4, 0, 'Magia', 'Fogo').nivelExtra ?? 0, 0, 'no 4, +0');
  // o Incêndio da Bola de Fogo (o sorteio de 0,05 incendeia): × 1,39 — comparado com a Bola de Fogo no 21 (o +1 do suporte)
  const incendio = async (slugs, nivelDe = {}) => {
    const { e, b } = await montar(slugs, { arma: 'Wands/Driftwood_Wand', nivelDe: { Awakened_Burning_Damage_Support: 5, ...nivelDe } });
    Object.assign(b, { hp: 1e6, maxHp: 1e6 });
    usar(e, 0, b, 0.05);
    return b.dots.find((d) => d.tipo === 'queimadura' || d.tipo === 'incendio' || d.elemento === 'fire');
  };
  const sem = await incendio(['Fireball'], { Fireball: 21 });
  const com = await incendio(['Fireball', 'Awakened_Burning_Damage_Support']);
  assert.ok(sem && com, 'incendiou');
  assert.ok(perto(com.porPulso / sem.porPulso, 1.39, 0.01), `${com.porPulso} / ${sem.porPulso}`);
});

// ---------------------------------------------------------------- Suporte Desperto: Propagar Dano

test('T2 Awakened_Melee_Splash: no 5, Propaga com 37% menos Dano (antes, "1% menos": a célula "37, 1" do poedb lida pelo fim), 72% mais Área da Propagação, +1 nas de Golpe', { skip: SEM }, async () => {
  const s = ef('Awakened_Melee_Splash_Support', 5, 0, 'Ataque', 'Corpo a Corpo', 'Golpear');
  assert.deepEqual([s.propagar, s.propagaMaisPct, s.propagaAreaMaisPct, s.custoPct], [1, -37, 72, 30]);
  assert.equal(ef('Awakened_Melee_Splash_Support', 1, 0, 'Ataque').propagaMaisPct, -39);
  assert.equal(ef('Awakened_Melee_Splash_Support', 20, 0, 'Ataque').propagaMaisPct, -33);
  const { e, b, resto } = await montar(['Heavy_Strike', 'Awakened_Melee_Splash_Support'], { nivelDe: { Awakened_Melee_Splash_Support: 5 } });
  perto_(b, resto, [[0, 1], [1, 0]]);
  const { ev } = usar(e, 0, b);
  const alvo = danoEm(ev, b);
  assert.ok(alvo > 0);
  for (const m of resto.slice(0, 2)) assert.ok(perto(danoEm(ev, m) / alvo, 0.63, 0.02), `propagado ${danoEm(ev, m)} / ${alvo}`);
});

// ---------------------------------------------------------------- Projéteis Múltiplos

test('T2 Multiple_Projectiles: +2 projéteis e 6% menos Dano de Projétil no 20 (poedb); a qualidade, +10% de Dano de Projétil', { skip: SEM }, async () => {
  const m = ef('Multiple_Projectiles_Support', 20, 0, 'Projétil');
  assert.deepEqual([m.alvosExtras, m.maisDanoAcertoPct, m.custoPct], [2, -6, 30]);
  assert.equal(ef('Multiple_Projectiles_Support', 1, 0, 'Projétil').maisDanoAcertoPct, -15);
  const tiro = async (slugs) => { const { e, b, resto } = await montar(slugs, { arma: 'Bows/Crude_Bow' }); perto_(b, resto, [[0, 1], [1, 0], [0, -1], [1, 1]]); const { ev } = usar(e, 0, b); const ms = [b, ...resto.slice(0, 4)].filter((x) => danoEm(ev, x) > 0); return { alvo: danoEm(ev, b), n: ms.length, quem: ms.map((x) => `${x.x - b.x},${x.y - b.y}`) }; };
  const sem = await tiro(['Burning_Arrow']);
  const com = await tiro(['Burning_Arrow', 'Multiple_Projectiles_Support']);
  assert.deepEqual([sem.n, com.n], [1, 2]); // aval do dono 03/11: a geometria do leque — o de 10° não chega a todos em volta do alvo (3 → 2)
  // aval do dono 03/11: raio contínuo (revisão) — o de +10° segue o raio do ângulo exato e pega o que está atrás do alvo na fila (o 2,0 de você); o de −10°
  // passa pelo mesmo (D7b: não o acerta de novo) e não acha outro. Antes o fim arredondado a 3 casas mandava o +10° para o (2,1), a 26,6°
  assert.deepEqual(com.quem, ['0,0', '1,0']); // aval do dono 03/11: raio contínuo (revisão)
  assert.ok(perto(com.alvo / sem.alvo, 0.94, 0.01), `${com.alvo} / ${sem.alvo}`);
});

// ---------------------------------------------------------------- Grande Rajada

test('T2 Greater_Volley: +4 projéteis, de até 4 pontos de cada lado, 21% menos Dano de Projétil no 20 (poedb); custo 150%', { skip: SEM }, async () => {
  const g = ef('Greater_Volley_Support', 20, 0, 'Projétil');
  assert.deepEqual([g.alvosExtras, g.origensLaterais, g.maisDanoAcertoPct, g.custoPct], [4, 4, -21, 50]);
  assert.equal(ef('Greater_Volley_Support', 20, 20, 'Projétil').danoPct, 20);
  // os 4 a mais saem de pontos ao LADO de você (1 e 2 casas, alternando os lados) e voam paralelos ao principal: um inimigo em cada uma dessas linhas; o 6º, fora delas
  const tiro = async (slugs) => {
    const { e, b, resto } = await montar(slugs, { arma: 'Bows/Crude_Bow' });
    perto_(b, resto, [[1, 1], [1, -1], [2, 2], [2, -2], [0, 4]]);
    const { ev } = usar(e, 0, b);
    return { alvo: danoEm(ev, b), n: [b, ...resto.slice(0, 4)].filter((x) => danoEm(ev, x) > 0).length, fora: danoEm(ev, resto[4]) };
  };
  const sem = await tiro(['Burning_Arrow']);
  const com = await tiro(['Burning_Arrow', 'Greater_Volley_Support']);
  assert.equal(sem.n, 1);
  assert.equal(com.n, 5);
  assert.equal(com.fora, 0);
  assert.ok(perto(com.alvo / sem.alvo, 0.79, 0.01), `${com.alvo} / ${sem.alvo}`);
});

// ---------------------------------------------------------------- Suporte Desperto: Projéteis Múltiplos Melhorado

test('T2 Awakened_Greater_Multiple_Projectiles: no 5, +5 projéteis e 21% menos Dano de Projétil (poedb: 25% no 1); custo 150%', { skip: SEM }, async () => {
  const g = ef('Awakened_Greater_Multiple_Projectiles_Support', 5, 0, 'Projétil');
  assert.deepEqual([g.alvosExtras, g.maisDanoAcertoPct, g.custoPct], [5, -21, 50]);
  assert.equal(ef('Awakened_Greater_Multiple_Projectiles_Support', 1, 0, 'Projétil').maisDanoAcertoPct, -25);
  const tiro = async (slugs) => { const { e, b, resto } = await montar(slugs, { arma: 'Bows/Crude_Bow', nivelDe: { Awakened_Greater_Multiple_Projectiles_Support: 5 } }); perto_(b, resto, [[0, 1], [1, 0], [0, -1], [1, 1], [1, -1], [2, 0], [2, 1]]); const { ev } = usar(e, 0, b); return { alvo: danoEm(ev, b), n: [b, ...resto.slice(0, 7)].filter((x) => danoEm(ev, x) > 0).length }; };
  const sem = await tiro(['Burning_Arrow']);
  const com = await tiro(['Burning_Arrow', 'Awakened_Greater_Multiple_Projectiles_Support']);
  assert.equal(com.n, 6); // aval do dono 03/11: raio contínuo (revisão) — o leque a 10° no raio do ângulo exato pega 6 (o +10° e o +20° não se fundem mais na mesma reta)
  assert.ok(perto(com.alvo / sem.alvo, 0.79, 0.01), `${com.alvo} / ${sem.alvo}`);
});

// ---------------------------------------------------------------- Suporte Desperto: Ricochete

test('T2 Awakened_Chain: no 5, Ricocheteia +3 vezes e 6% menos Dano com Acertos (poedb: 10% no 1); a qualidade, alcance do Ricochete', { skip: SEM }, async () => {
  const c = ef('Awakened_Chain_Support', 5, 0, 'Projétil');
  assert.deepEqual([c.encadear, c.maisDanoAcertoPct, c.custoPct], [3, -6, 50]);
  assert.equal(ef('Awakened_Chain_Support', 5, 20, 'Projétil').alcanceRicochetePct, 10);
  const tiro = async (slugs) => { const { e, b, resto } = await montar(slugs, { arma: 'Bows/Crude_Bow', nivelDe: { Awakened_Chain_Support: 5 } }); perto_(b, resto, [[1, 1], [2, 0], [3, 1], [4, 0]]); const { ev } = usar(e, 0, b); return { alvo: danoEm(ev, b), n: [b, ...resto.slice(0, 4)].filter((x) => danoEm(ev, x) > 0).length }; };
  const sem = await tiro(['Burning_Arrow']);
  const com = await tiro(['Burning_Arrow', 'Awakened_Chain_Support']);
  assert.deepEqual([sem.n, com.n], [1, 4], 'o alvo + 3 ricochetes');
  assert.ok(perto(com.alvo / sem.alvo, 0.94, 0.01), `${com.alvo} / ${sem.alvo}`);
});

// ---------------------------------------------------------------- Dreno de Mana

test('T2 Mana_Leech: 3,9% do Dano de Ataque Drenado como Mana no 20 (poedb); a qualidade "Dano aumentado enquanto Drenando Mana" só com o Dreno ativo (antes, sempre)', { skip: SEM }, async () => {
  const m = ef('Mana_Leech_Support', 20, 20, 'Ataque');
  assert.deepEqual([m['af:mana_leech'], m.leechManaPct, m['af:dmg_inc@drenandoMana'], m.danoPct], [3.9, undefined, 10, undefined], 'o Dreno do PoE (antes, a cura na hora)');
  const { e, b } = await montar(['Cleave', 'Mana_Leech_Support'], { qualidade: 20 });
  e.mana = e.maxMana / 2;
  e.hunt.roubos = [];
  const g1 = danoEm(usar(e, 0, b).ev, b);
  const mana = (e.hunt.roubos ?? []).filter((r) => r.recurso === 'mana');
  assert.ok(mana.length, JSON.stringify(e.hunt.roubos));
  assert.ok(perto(mana.reduce((t, r) => t + (r.total ?? r.restante), 0), g1 * 0.039, 0.02), `${JSON.stringify(mana)} vs ${g1 * 0.039}`);
  // o primeiro golpe: sem Dreno de Mana ativo, sem os 10%; o segundo (drenando), com — a razão 1,1 (o personagem não tem outro "aumentado")
  e.hunt.clock += 1000;
  assert.ok((e.hunt.roubos ?? []).some((r) => r.recurso === 'mana' && r.restante > 0), 'ainda drenando');
  const g2 = danoEm(usar(e, 0, b).ev, b);
  const { e: e0, b: b0 } = await montar(['Cleave', 'Mana_Leech_Support'], { qualidade: 20 });
  const sozinho = danoEm(usar(e0, 0, b0).ev, b0);
  assert.ok(perto(g1 / sozinho, 1, 0.005), 'o primeiro golpe, sem drenar');
  assert.ok(g2 > g1 * 1.05, `drenando: ${g2} > ${g1}`);
});

// ---------------------------------------------------------------- Iluminar e Iluminar Desperto

test('T2 Enlighten e Awakened_Enlighten: o Multiplicador de Custo & Reserva 92% (Iluminar, nível 3) e 88% (Desperto, nível 4) — o custo de Mana da suportada cai', { skip: SEM }, async () => {
  assert.equal(ef('Enlighten_Support', 3).custoPct, -8);
  assert.equal(ef('Awakened_Enlighten_Support', 4).custoPct, -12);
  const custo = async (slugs, nivelDe = {}) => { const { e, b } = await montar(slugs, { nivelDe }); const antes = e.mana; usar(e, 0, b); return antes - e.mana; };
  const sem = await custo(['Cleave']);
  assert.ok(sem > 0);
  assert.ok(Math.abs((await custo(['Cleave', 'Enlighten_Support'], { Enlighten_Support: 3 })) - sem * 0.92) <= 1);
  assert.ok(Math.abs((await custo(['Cleave', 'Awakened_Enlighten_Support'], { Awakened_Enlighten_Support: 4 })) - sem * 0.88) <= 1);
  // a reserva também (a Vitalidade: 233 × 0,92)
  const { e, b } = await montar(['Vitality', 'Enlighten_Support'], { nivelDe: { Enlighten_Support: 3 } });
  usar(e, 0, b);
  const Reserva = await import('../systems/itens-poe/reserva.mjs');
  assert.ok(Math.abs(Reserva.reservadas(e).mana - 233 * 0.92) <= 1, String(Reserva.reservadas(e).mana));
});

// ---------------------------------------------------------------- Vida do Lacaio

test('T2 Minion_Life: 49% mais Vida de Lacaio máxima no 20 (poedb); +20% aumentada na qualidade 20', { skip: SEM }, async () => {
  assert.equal(ef('Minion_Life_Support', 20, 0, 'Lacaio').lacaioVidaPct, 49);
  assert.equal(ef('Minion_Life_Support', 20, 20, 'Lacaio').lacaioVidaPct, 69);
  const zumbi = async (slugs) => { const { e, b } = await montar(slugs, { arma: 'Wands/Driftwood_Wand' }); e.hunt.cadaveres = [{ key: 'x', nome: 'Morto', look: 1, x: b.x, y: b.y, maxHp: 10000 }]; assert.ok(usar(e, 0, b).r.ok); return (e.hunt.lacaios ?? []).find((l) => l.hp > 0); };
  const sem = await zumbi(['Raise_Zombie']);
  const com = await zumbi(['Raise_Zombie', 'Minion_Life_Support']);
  assert.ok(sem && com);
  assert.ok(perto(com.maxHp / sem.maxHp, 1.49, 0.01), `${com.maxHp} / ${sem.maxHp}`);
});

// ---------------------------------------------------------------- Penetração de Raio

test('T2 Lightning_Penetration: Penetra 34% de Resistência a Raio no 20 (poedb) — com 50% de resistência, o Raio passa como com 16%', { skip: SEM }, async () => {
  assert.equal(ef('Lightning_Penetration_Support', 20, 0, 'Raio')['af:energy_pen'], 34);
  assert.equal(ef('Lightning_Penetration_Support', 20, 20, 'Raio')['af:energy_dmg'], 10);
  const faisca = async (slugs) => { const { e, b } = await montar(slugs, { arma: 'Wands/Driftwood_Wand' }); semResistencia(e, b); b.resist.energy += 50; return danoEm(usar(e, 0, b).ev, b); };
  const sem = await faisca(['Spark']);
  const com = await faisca(['Spark', 'Lightning_Penetration_Support']);
  assert.ok(perto(com / sem, 0.84 / 0.5, 0.01), `${com} / ${sem}`);
});

// ---------------------------------------------------------------- Suporte Desperto: Dano Adicional de Raio

test('T2 Awakened_Added_Lightning_Damage: no 5, 24 a 449 de Dano de Raio adicional e +1 nas gemas de Raio (poedb); no ataque, × a eficácia da gema', { skip: SEM }, async () => {
  const a = ef('Awakened_Added_Lightning_Damage_Support', 5, 0, 'Ataque');
  assert.deepEqual([a.somadoMin, a.somadoMax, a.nivelExtra, a.custoPct], [24, 449, undefined, 20], 'a Cutilada não é de Raio: sem o +1 (antes, valia em qualquer gema)');
  assert.equal(ef('Awakened_Added_Lightning_Damage_Support', 5, 0, 'Magia', 'Raio').nivelExtra, 1);
  assert.equal(ef('Awakened_Added_Lightning_Damage_Support', 4, 0, 'Magia', 'Raio').nivelExtra ?? 0, 0);
  // a Cutilada (sem a tag Raio: sem o +1): o Raio adicionado, a resistência zerada — (24 + 449) / 2 × a eficácia da Cutilada a mais
  const golpe = async (slugs) => { const { e, b } = await montar(slugs, { nivelDe: { Awakened_Added_Lightning_Damage_Support: 5 } }); semResistencia(e, b); b.resist.physical = 0; return danoEm(usar(e, 0, b).ev, b); };
  const sem = await golpe(['Cleave']);
  const com = await golpe(['Cleave', 'Awakened_Added_Lightning_Damage_Support']);
  const eficacia = G.eficaciaNoNivel('Cleave', 20);
  assert.ok(Math.abs(com - sem - ((24 + 449) / 2) * eficacia) <= 3, `${com} − ${sem} vs ${((24 + 449) / 2) * eficacia}`);
});

// ---------------------------------------------------------------- Suporte Desperto: Afecções Libertas

test('T2 Awakened_Unbound_Ailments: no 5, Duração das Afecções +X%, Efeito das não Danificantes +X% e Y% mais Dano de Afecções (poedb) — no Incêndio e no Resfriamento', { skip: SEM }, async () => {
  const u = ef('Awakened_Unbound_Ailments_Support', 5, 0, 'Magia');
  const X = u['af:ailment_duration'];
  const Y = u.maisAfeccaoPct;
  assert.deepEqual([X, u['af:efeito_nao_dano'], u['af:efeito_resfriamento'], u['af:efeito_eletrizacao'], Y], [69, 69, 69, 69, 22]);
  assert.equal(ef('Awakened_Unbound_Ailments_Support', 5, 20, 'Magia')['af:ailment_duration'], 79, 'a qualidade 20: +10%');
  assert.deepEqual([ef('Awakened_Unbound_Ailments_Support', 1, 0, 'Magia')['af:ailment_duration'], ef('Awakened_Unbound_Ailments_Support', 1, 0, 'Magia').maisAfeccaoPct], [55, 20]);
  const fogo = async (slugs) => {
    const { e, b } = await montar(slugs, { arma: 'Wands/Driftwood_Wand', nivelDe: { Awakened_Unbound_Ailments_Support: 5 } });
    Object.assign(b, { hp: 1e6, maxHp: 1e6 });
    usar(e, 0, b, 0.05);
    return b.dots.find((d) => d.elemento === 'fire');
  };
  const sem = await fogo(['Fireball']);
  const com = await fogo(['Fireball', 'Awakened_Unbound_Ailments_Support']);
  assert.ok(sem && com);
  assert.ok(Math.abs((com.ate - com.desde) - (sem.ate - sem.desde) * (1 + X / 100)) <= 2, `${com.ate - com.desde} vs ${(sem.ate - sem.desde) * (1 + X / 100)}`);
  // (o dano por segundo: o total ÷ a duração — o pulso muda com a duração mais longa)
  const dps = (d) => d.falta / ((d.ate - d.desde) / 1000);
  assert.ok(perto(dps(com) / dps(sem), 1 + Y / 100, 0.01), `${dps(com)} / ${dps(sem)}`);
  // o Resfriamento da Nova Glacial: o Efeito × (1 + X%)
  const frio = async (slugs) => { const { e, b } = await montar(slugs, { arma: 'Wands/Driftwood_Wand', nivelDe: { Awakened_Unbound_Ailments_Support: 5 } }); Object.assign(b, { hp: 60_000, maxHp: 60_000 }); usar(e, 0, b, 0.9); return b.estados.lento; };
  const l0 = await frio(['Ice_Nova']);
  const l1 = await frio(['Ice_Nova', 'Awakened_Unbound_Ailments_Support']);
  assert.ok(l0?.pct > 0 && l1?.pct > 0, JSON.stringify([l0, l1]));
  assert.ok(Math.abs(l1.pct - l0.pct * (1 + X / 100)) <= 0.2, `${l1.pct} vs ${l0.pct} × ${1 + X / 100}`);
});

// ---------------------------------------------------------------- Eco Mágico Maior

test('T2 Greater_Spell_Echo: no 3, Repete 2 vezes, 62% mais Velocidade de Conjuração, +14% de dano mágico e +24% de Área por repetição (poedb); custo 160%', { skip: SEM }, async () => {
  const g = ef('Greater_Spell_Echo_Support', 3, 0, 'Magia', 'Área');
  assert.deepEqual([g.repeticoes, g.repeticaoMaisPorPct, g.repeticaoAreaT2Pct, g.custoPct, g.areaIncPct], [2, 14, 24, 60, undefined]);
  assert.ok(perto(g.castTimePct, (1 / 1.62 - 1) * 100));
  const nova = async (slugs) => {
    const { e, b } = await montar(slugs, { arma: 'Wands/Driftwood_Wand', nivelDe: { Greater_Spell_Echo_Support: 3 } });
    semResistencia(e, b);
    const { ev } = usar(e, 0, b);
    return { e, golpes: golpesEm(ev, b).map((x) => x.v), areas: ev.filter((x) => x.t === 'area').map((x) => x.casas.length) };
  };
  const sem = await nova(['Ice_Nova']);
  const com = await nova(['Ice_Nova', 'Greater_Spell_Echo_Support']);
  assert.equal(sem.golpes.length, 1);
  assert.equal(com.golpes.length, 3, 'o uso + 2 repetições');
  // o dano: o uso como sem o suporte; a 1ª repetição × 1,14, a 2ª × 1,28
  com.golpes.forEach((v, k) => assert.ok(perto(v / sem.golpes[0], 1 + 0.14 * k, 0.01), `${k}: ${v} / ${sem.golpes[0]}`));
  // a conjuração: ÷ 1,62
  assert.ok(Math.abs(Acoes.temposDaGemaPoe(com.e, entryDe('Ice_Nova')).uso - Acoes.temposDaGemaPoe(sem.e, entryDe('Ice_Nova')).uso / 1.62) <= 1);
});

test('T2 Greater_Spell_Echo: a Área cresce a cada repetição (k × 24%) — o primeiro uso sem o aumento (antes, +37% fixo em todo o uso)', { skip: SEM }, async () => {
  // (aval do dono 28/10: a área numa conta só — a Nova, 3,2 m ÷ 2 = 1,6 casa; o uso 1,6, a 1ª repetição 1,6 × √1,24 = 1,78, a 2ª 1,6 × √1,48 = 1,95; a fração como
  // chance pelo mesmo sorteio: com 0,7, o uso fica em 1 casa (0,7 ≥ 0,6); as repetições seguem o sorteio coerente com esse raio (`GemasR4C2.sorteioDoRaio`:
  // 0,6 + 0,7 × 0,4 = 0,88) — a 1ª fica em 1 casa (0,78 < 0,88) e a 2ª vai a 2 (0,95 > 0,88). O inimigo a 2 casas leva só a 2ª repetição)
  const { e, b, resto } = await montar(['Ice_Nova', 'Greater_Spell_Echo_Support'], { arma: 'Wands/Driftwood_Wand', nivelDe: { Greater_Spell_Echo_Support: 3 } });
  const longe = resto[0];
  Object.assign(longe, { x: e.hunt.pos.x - 2, y: e.hunt.pos.y, estados: {}, dots: [] });
  const { ev } = usar(e, 0, b, 0.7);
  assert.equal(golpesEm(ev, b).length, 3);
  assert.equal(golpesEm(ev, longe).length, 1, 'a 2ª repetição');
  // sem o suporte, o mesmo sorteio: a 2 casas, nada
  const { e: e2, b: b2, resto: r2 } = await montar(['Ice_Nova'], { arma: 'Wands/Driftwood_Wand' });
  Object.assign(r2[0], { x: e2.hunt.pos.x - 2, y: e2.hunt.pos.y, estados: {}, dots: [] });
  assert.equal(golpesEm(usar(e2, 0, b2, 0.7).ev, r2[0]).length, 0);
});
