// (lote E2B, 26/10) AS PARCIAIS MAIS DIFÍCEIS de Armadilhas, Minas, Auras e Arautos, pelo PoE 1 (o PoB): as explosões menores das Armadilhas Explosivas, os pulsos
// da Armadilha Sísmica, a Regeneração da Sifão de Gelo, o debuff da Armadilha de Urso, o Solo Eletrizado da Relampejante Vaal, o Sangramento mais rápido da Laceração,
// o Estandarte da Guerra e o Fogo Justo base. Os sorteios ficam travados.
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
const E1b = await import('../systems/itens-poe/gemas-e1b.mjs');
const L = await import('../systems/itens-poe/linhas-das-gemas.mjs');
const Res = await import('../systems/hunt/resistencia.mjs');
const Defesa = await import('../systems/personagem/defesa.mjs');
const Plantadas = await import('../systems/itens-poe/armas-plantadas.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');

let J;
let gerarPeca;
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
function travado(v, fn) {
  const antes = Math.random;
  Math.random = () => v;
  try { return fn(); } finally { Math.random = antes; }
}
/** O personagem com as gemas LIGADAS na arma (um grupo só), numa caçada; o alvo imortal a (dx, 0) e os outros longe. */
async function montar(slugs, { nivel = 20, qualidade = 0, arma = 'Wands/Driftwood_Wand', dx = 1 } = {}) {
  J ??= await import('../systems/itens-poe/jogo.mjs');
  gerarPeca ??= (await import('../systems/itens-poe/gerar.mjs')).gerarPeca;
  const lista = [slugs].flat();
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Scion', sistema: 'poe' });
  const a = peca(arma);
  a.soquetes = { abertos: lista.length, links: lista.slice(1).map(() => true), gemas: lista.map(() => null), cores: lista.map(() => 'W') };
  e.equipment = { ...e.equipment, weapon: a };
  delete e.equipment.shield;
  const itemDe = (s) => G.doSlug(s)?.itemId ?? [...GS.DEFS.values()].find((d) => d.poe?.slug === s)?.itemId;
  e.inventory = lista.map((s) => GS.itemDaGema({ id: itemDe(s), nivel, xp: 0, raridade: 'comum', qualidade }));
  for (let i = 0; i < lista.length; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  e.actions = Array(Acoes.SLOTS).fill(null);
  lista.forEach((s, i) => { if (G.doSlug(s)) e.actions[i] = { id: G.doSlug(s).acao, enabled: true, minMana: 0, conditions: [] }; });
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(travado(0.5, () => Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' })).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 10_000;
  e.maxHp = e.hp = 100_000;
  const [b, ...resto] = e.hunt.monstros;
  for (const m of resto) Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60 });
  Object.assign(b, { x: e.hunt.pos.x + dx, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12, estados: {}, resist: {}, dots: [], armaduraPct: -100, evasao: 0 });
  return { e, b, resto };
}
function usar(e, b, slot = 0, v = 0.5) {
  return travado(v, () => {
    const x = Acoes.disparar(e, e.hunt, PERSONAGEM, slot, b, { manual: true });
    if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; return { ...x, eventos: [...(x.eventos ?? []), ...(Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM) ?? [])] }; }
    return x;
  });
}
const golpesEm = (ev, m) => (ev ?? []).filter((x) => x.t === 'dmg' && x.foe !== false && x.uid === m.uid && !x.dot).map((x) => x.v);
const soma = (l) => l.reduce((t, x) => t + x, 0);
const E2b = await import('../systems/itens-poe/gemas-e2b.mjs');
const Cond = await import('../systems/itens-poe/condicoes-poe.mjs');
const id = (slug) => G.doSlug(slug).acao;
const perto = (a, b, tol = 0.01) => Math.abs(a - b) <= Math.max(1e-6, Math.abs(b) * tol);

const FEITAS = ['Smite', 'Vaal_Smite', 'Detonate_Mines', 'War_Banner', 'Explosive_Trap', 'Explosive_Trap_of_Shrapnel', 'Bear_Trap', 'Seismic_Trap', 'Siphoning_Trap', 'Vaal_Lightning_Trap', 'Righteous_Fire'];

test('E2B: as gemas do lote ficam completas (funciona, sem motivo)', { skip: SEM }, () => {
  for (const s of FEITAS) assert.deepEqual([G.doSlug(s)?.statusNoJogo, G.doSlug(s)?.motivosNoJogo], ['funciona', []], s);
  // a Laceração: o Sangramento mais rápido sai; o giro: feito no D1 (decisão do dono) — aval do dono (revisão F1): sem motivo
  assert.deepEqual(G.doSlug('Blade_Trap_of_Laceration').motivosNoJogo, []);
});

test('E2B: as Armadilhas Explosivas — os raios pela posição da coluna (1,8 m; a menor 1,3 m) e as explosões menores (7, + 0,1 por qualidade)', { skip: SEM }, () => {
  assert.equal(G.areaNoNivel('Explosive_Trap', 20, 0).raioM, 1.8);
  assert.equal(G.areaNoNivel('Explosive_Trap', 1, 0).raioM, 1.2);
  assert.deepEqual(G.explosoesDaGema('Explosive_Trap', 20, 0), { n: 7, raioSecundarioM: 1.8, raioMenorM: 1.3, variacaoPct: 30 });
  assert.equal(G.explosoesDaGema('Explosive_Trap', 20, 20).n, 9);
  assert.equal(G.explosoesDaGema('Explosive_Trap', 20, 19).n, 8);
  assert.equal(G.explosoesDaGema('Explosive_Trap_of_Shrapnel', 20, 0).raioSecundarioM, 3);
  assert.equal(G.explosoesDaGema('Explosive_Trap', 1, 0).n, 3);
  assert.equal(G.explosoesDaGema('Fire_Trap', 20, 0), null);
  const d = G.explosoesDaGema('Explosive_Trap', 20, 0);
  assert.ok(perto(E2b.raioDaExplosaoMenor(d, () => 0), 1.3 * 0.7) && perto(E2b.raioDaExplosaoMenor(d, () => 1), 1.3 * 1.3));
});

test('E2B: a Armadilha Explosiva ativada — a explosão principal e as 7 menores (o sorteio 0,5: todas na casa da Armadilha, raio de 1 casa)', { skip: SEM }, async () => {
  const { e, b } = await montar('Explosive_Trap');
  const r = usar(e, b);
  assert.ok(r.ok, r.erro);
  const g = golpesEm(r.eventos, b);
  assert.equal(g.length, 8, String(g));
  // longe da área secundária, só a principal
  const { e: e2, b: b2, resto } = await montar('Explosive_Trap');
  const r2 = travado(0.999, () => { const x = Acoes.disparar(e2, e2.hunt, PERSONAGEM, 0, b2, { manual: true }); if (e2.hunt.conjurando) { e2.hunt.clock = e2.hunt.conjurando.fim; return [...(x.eventos ?? []), ...(Acoes.concluirConjuracao(e2, e2.hunt, PERSONAGEM) ?? [])]; } return x.eventos; });
  assert.ok(golpesEm(r2, b2).length >= 1);
  assert.equal(resto.filter((m) => golpesEm(r2, m).length).length, 0);
});

test('E2B: a Armadilha Sísmica — pulsos a cada 0,9 s pela duração (⌊3,5 × 1/0,9⌋ = 3), 5 ondas (+1 na qualidade 20) com a chance da sobreposição', { skip: SEM }, async () => {
  const d = G.sismicaDaGema('Seismic_Trap', 20, 0);
  assert.deepEqual(d, { intervaloMs: 900, ondas: 5, chance: 121 / 324, raioM: 1.8 });
  assert.equal(G.sismicaDaGema('Seismic_Trap', 20, 20).ondas, 6);
  assert.deepEqual(E2b.pulsosDaSismica(d, 3500), { intervaloMs: 900, pulsos: 3 });
  assert.deepEqual(E2b.pulsosDaSismica(d, 3500, 50), { intervaloMs: 600, pulsos: 5 });
  const { e, b } = await montar('Seismic_Trap');
  const r = usar(e, b, 0, 0.3);
  assert.ok(r.ok, r.erro);
  assert.equal(golpesEm(r.eventos, b).length, 0, 'a ativação não acerta: o primeiro pulso é depois de um intervalo');
  const t = e.hunt.poeTorres?.find((x) => x.ondasE2b);
  assert.ok(t, 'o objeto que pulsa');
  const pulsos = Math.round((t.ate - e.hunt.clock) / t.intervaloMs);
  assert.ok(pulsos >= 3, String(pulsos));
  e.hunt.clock = t.proxima;
  const ev = travado(0.3, () => Acoes.tiqueDasPlantadas(e, e.hunt, PERSONAGEM, [], e.hunt.clock));
  assert.equal(golpesEm(ev, b).length, 5, 'um pulso: 5 ondas, todas pegam no sorteio 0,3 (< 37,3%)');
  e.hunt.clock = t.ate + 10;
  const resto = travado(0.3, () => Acoes.tiqueDasPlantadas(e, e.hunt, PERSONAGEM, [], e.hunt.clock));
  assert.equal(golpesEm(resto, b).length, 5 * (pulsos - 1));
  assert.ok(!(e.hunt.poeTorres ?? []).some((x) => x.ondasE2b), 'acabou');
});

test('E2B: a Armadilha Sifão de Gelo — Regeneração com 1 inimigo afetado e por inimigo (até 10)', { skip: SEM }, async () => {
  const d = G.sifaoDaGema('Siphoning_Trap', 20);
  assert.deepEqual(d, { vida: 324.4, mana: 17.2, vidaPor: 32.4, manaPor: 1.7 });
  assert.ok(perto(E2b.regeneracaoDoSifao(d, 3).life_regen, 324.4 + 3 * 32.4));
  assert.ok(perto(E2b.regeneracaoDoSifao(d, 15).mana_regen, 17.2 + 10 * 1.7));
  assert.deepEqual(E2b.regeneracaoDoSifao(d, 0), { life_regen: 0, mana_regen: 0 });
  const { e, b } = await montar('Siphoning_Trap');
  assert.ok(usar(e, b).ok);
  assert.ok((b.dots ?? []).some((x) => x.chave === 'Siphoning_Trap' && x.falta > 0), 'o debuff');
  travado(0.5, () => Acoes.tiqueDasPlantadas(e, e.hunt, PERSONAGEM, [], e.hunt.clock));
  assert.ok(perto(G.adds(e).life_regen, 324.4 + 32.4), String(G.adds(e)?.life_regen));
  assert.ok(perto(G.adds(e).mana_regen, 17.2 + 1.7));
  b.dots = [];
  travado(0.5, () => Acoes.tiqueDasPlantadas(e, e.hunt, PERSONAGEM, [], e.hunt.clock));
  assert.equal(e.hunt.poeSifaoE2b, undefined);
  assert.equal(G.adds(e)?.life_regen ?? 0, 0);
});

test('E2B: a Armadilha de Urso — o debuff (25% de dano dos acertos de Armadilha/Mina; −80% de movimento que cai até 0) depois da Imobilização', { skip: SEM }, async () => {
  assert.deepEqual(G.ursoDaGema('Bear_Trap', 20), { danoPct: 25, passoPct: 80 });
  const { e, b } = await montar('Bear_Trap');
  assert.ok(usar(e, b).ok);
  const u = b.estados.ursoE2b;
  assert.ok(u, 'o debuff');
  const agora = e.hunt.clock;
  assert.ok(Math.abs(u.desde - agora - 3000) <= 1000 && u.ate - u.desde === u.desde - agora, `${u.desde - agora} / ${u.ate - u.desde}`);
  assert.equal(E2b.passoDoUrsoPct(b, u.desde), 80);
  assert.ok(perto(E2b.passoDoUrsoPct(b, (u.desde + u.ate) / 2), 40));
  assert.equal(E2b.passoDoUrsoPct(b, u.ate), 0);
  assert.ok(perto(E2b.fatorDoPassoDoUrso(b, u.desde), 5));
  const daArmadilha = Cond.fatorRecebidoPeloBicho(b, 'physical', { tagsDoGolpe: ['armadilha', 'magia'] }, agora + 10);
  const outro = Cond.fatorRecebidoPeloBicho(b, 'physical', { tagsDoGolpe: ['magia'] }, agora + 10);
  assert.ok(perto(daArmadilha / outro, 1.25), `${daArmadilha} / ${outro}`);
  assert.ok(perto(Cond.fatorRecebidoPeloBicho(b, 'physical', { tagsDoGolpe: ['mina'] }, u.ate + 1), Cond.fatorRecebidoPeloBicho(b, 'physical', { tagsDoGolpe: [] }, u.ate + 1)), 'acabou');
});

test('E2B: a Relampejante Vaal — o Solo Eletrizado no caminho dos projéteis (15%, + 0,25 por qualidade), pela duração', { skip: SEM }, async () => {
  assert.deepEqual(G.soloEletrizadoDaGema('Vaal_Lightning_Trap', 20, 0), { efeitoPct: 15 });
  assert.deepEqual(G.soloEletrizadoDaGema('Vaal_Lightning_Trap', 20, 20), { efeitoPct: 20 });
  // 4 projéteis em círculo, alcance 3: a cruz
  assert.deepEqual(E2b.casasDoSolo({ x: 0, y: 0 }, 0, 4, 3).sort(), ['0,0', '1,0', '2,0', '3,0', '0,1', '0,2', '0,3', '-1,0', '-2,0', '-3,0', '0,-1', '0,-2', '0,-3'].sort());
  assert.equal(E2b.casasDoSolo({ x: 0, y: 0 }, 0, 9, 6).length > 9 * 5, true);
  const m = { hp: 10, x: 2, y: 0, z: 0, estados: {} };
  const forte = { hp: 10, x: 1, y: 0, z: 0, estados: { chocado: { ate: 9999, pct: 30 } } };
  assert.equal(E2b.eletrizarNoSolo([m, forte], [{ casas: ['1,0', '2,0'], z: 0, ate: 5000, efeitoPct: 15 }], 1000), 1);
  assert.equal(m.estados.chocado.pct, 15);
  assert.equal(forte.estados.chocado.pct, 30, 'a Eletrização mais forte fica');
  const { e, b } = await montar('Vaal_Lightning_Trap', { dx: 2 });
  const r = usar(e, b);
  assert.ok(r.ok, r.erro);
  assert.ok(e.hunt.poeSolosE2b?.length, 'o Solo');
  const s = e.hunt.poeSolosE2b[0];
  assert.ok(s.ate - e.hunt.clock >= 4000 && s.casas.length > 9, `${s.ate - e.hunt.clock} ${s.casas.length}`);
  // um inimigo numa casa do Solo fica Eletrizado
  const [cx, cy] = s.casas.find((c) => c !== `${b.x},${b.y}`).split(',').map(Number);
  Object.assign(b, { x: cx, y: cy, estados: {} });
  travado(0.5, () => Acoes.tiqueDasPlantadas(e, e.hunt, PERSONAGEM, [], e.hunt.clock + 10));
  assert.equal(b.estados.chocado?.pct, 15);
});

test('E2B: a Laceração — "Sangramentos … causam Dano X% mais rápido" (50, + 10 na qualidade 20) é linha local do uso', { skip: SEM }, () => {
  assert.deepEqual(L.atributosDaLinha('Sangramentos inflingidos por esta Habilidade causam Dano 50 % mais rápido'), { sangramento_mais_rapido: 50 });
  const loc = G.linhasLocaisNoNivel('Blade_Trap_of_Laceration', 20, 20);
  assert.equal(loc.af.sangramento_mais_rapido, 60);
});

test('E2B: o Estandarte da Guerra — 8% de Precisão aumentada e 4% mais Dano Físico corpo a corpo no buff', { skip: SEM }, () => {
  const b = G.buffNoNivel('War_Banner', 20, 0);
  assert.equal(b.af.accuracy_inc, 8);
  assert.equal(b.af['mais_dano_fisico@corpo'], 4);
});

test('E2B: o Fogo Justo — queima em volta 70% da Vida + 70% do ES por segundo; você queima 90% + 70% sem morrer; 39% mais Dano Mágico', { skip: SEM }, async () => {
  const d = G.daGemaGBD('Righteous_Fire', 20, 0).fogoJusto;
  assert.deepEqual(d, { modo: 'vida', vidaPct: 70, esPct: 70, queimaVidaPct: 90, queimaEsPct: 70, raioM: 2.3, magicoMaisPct: 39, conjuracaoMaisPct: 0, dotMagico: false });
  assert.ok(perto(G.daGemaGBD('Righteous_Fire', 20, 20).fogoJusto.raioM, 2.6));
  assert.equal(E2b.fogoJustoBasePorS(d, { maxHp: 1000, maxEs: 500 }), 1050);
  assert.equal(E2b.queimaDoFogoJustoBasePorS(d, { maxHp: 1000, maxEs: 500 }), 1250);
  assert.equal(G.buffNoNivel('Righteous_Fire', 20, 0).af['mais_dano_acerto@magia'], 39);
  const { e, b, resto } = await montar('Righteous_Fire');
  const longe = Object.assign(resto[0], { x: e.hunt.pos.x + 5, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12, estados: {} });
  assert.ok(usar(e, b).ok);
  const rf = id('Righteous_Fire');
  assert.ok(e.hunt.buffs[rf].ate > 1e12, 'ligado até desligar');
  e.hunt.clock += 250;
  e.es = 0;
  const vida = e.hp;
  Acoes.tiqueDasGemasGBD(e, e.hunt, PERSONAGEM, [], e.hunt.clock);
  const q = (b.dots ?? []).find((x) => x.tipo === 'degenFogo' && x.chave === 'Righteous_Fire');
  const maxEs = Math.round(Ficha.combate(e).energyShield ?? 0);
  assert.ok(q && q.falta >= (e.maxHp + maxEs) * 0.7 * 0.5 * 0.99, 'a queima em volta: 70% (Vida + ES) × 0,5 s, com os aumentos');
  assert.equal((longe.dots ?? []).length, 0, 'fora do raio, não');
  const esperado = (e.maxHp * 0.9 + maxEs * 0.7) * 0.25 * Cond.fatorDaResistenciaRecebida(Ficha.combate(e), 'fire');
  assert.ok(Math.abs(vida - e.hp - esperado) <= 1, `a queima em você (${vida - e.hp} ≈ ${esperado})`);
  e.hp = 5;
  e.hunt.clock += 1000;
  Acoes.tiqueDasGemasGBD(e, e.hunt, PERSONAGEM, [], e.hunt.clock);
  assert.equal(e.hp, 1, 'não mata');
  assert.equal(e.hunt.buffs[rf], undefined, 'com 1 de Vida, acaba');
});


test('E2B: o Castigo — o raio (1 alvo a 5 m; 20% menos Dano em Área, + 0,5 por qualidade) e o Castigo Vaal (30 alvos a 10 m; +1 alvo ao Castigo na aura dela)', { skip: SEM }, () => {
  assert.deepEqual(G.c1DaGema('Smite', 20, 0).raioDoCastigo, { alvos: 1, alcanceM: 5, maisAreaPct: -20 });
  assert.deepEqual(G.c1DaGema('Smite', 20, 20).raioDoCastigo, { alvos: 1, alcanceM: 5, maisAreaPct: -10 });
  assert.deepEqual(G.c1DaGema('Vaal_Smite', 20, 20).raioDoCastigo, { alvos: 30, alcanceM: 10, maisAreaPct: 10 });
  assert.equal(E2b.alvosDaAuraVaal(G.textosDaGema('Vaal_Smite', 20).linhas), 1);
  assert.equal(G.linhasLocaisNoNivel('Vaal_Smite', 20, 0).af.nunca_erra, 1, 'a Vaal não pode ser Evadida');
});

test('E2B: o Castigo é um ATAQUE corpo a corpo — o alvo, o raio no inimigo perto, e a aura ao acertar (4 s); usa de novo com a aura ligada', { skip: SEM }, async () => {
  const { e, b, resto } = await montar('Smite', { arma: 'One_Hand_Maces/Driftwood_Club' });
  const outro = Object.assign(resto[0], { x: e.hunt.pos.x + 2, y: e.hunt.pos.y + 1, hp: 1e12, maxHp: 1e12, estados: {}, resist: {}, dots: [], armaduraPct: -100, evasao: 0 });
  const r = usar(e, b, 0, 0.01);
  assert.ok(r.ok, r.erro);
  assert.equal(golpesEm(r.eventos, b).length, 1, 'o golpe corpo a corpo');
  assert.equal(golpesEm(r.eventos, outro).length, 1, 'o raio no inimigo perto');
  const aura = e.hunt.buffs[id('Smite')];
  assert.ok(aura && aura.ate - e.hunt.clock === Math.round(4000 * Acoes.fatorDeDuracao(e, Acoes.POR_ID_PUBLICO(id('Smite')), GS.efeitoNaSkill(e, id('Smite')))), 'a aura por 4 s');
  assert.ok(aura.afPoe && Object.keys(aura.afPoe).length, 'o Raio adicional da aura');
  e.hunt.clock += 2000;
  delete e.hunt.conjurando;
  e.hunt.cooldowns = {};
  const r2 = usar(e, b, 0, 0.01);
  assert.ok(r2.ok, r2.erro ?? r2.motivo);
  assert.ok(golpesEm(r2.eventos, b).length >= 1, 'ataca de novo com a aura ligada');
});

test('E2B: o Castigo Vaal — ataca, raios em até 30 perto, a aura de 8 s; com ela, o Castigo põe o raio em +1 inimigo e a aura dele não liga', { skip: SEM }, async () => {
  const { e, b, resto } = await montar(['Vaal_Smite', 'Smite'], { arma: 'One_Hand_Maces/Driftwood_Club' });
  const [o1, o2] = resto;
  for (const [m, dy] of [[o1, 1], [o2, -1]]) Object.assign(m, { x: e.hunt.pos.x + 2, y: e.hunt.pos.y + dy, hp: 1e12, maxHp: 1e12, estados: {}, resist: {}, dots: [], armaduraPct: -100, evasao: 0 });
  const r = usar(e, b, 0, 0.01);
  assert.ok(r.ok, r.erro ?? r.motivo);
  assert.equal(golpesEm(r.eventos, o1).length + golpesEm(r.eventos, o2).length, 2, 'os raios nos dois perto');
  const vaal = e.hunt.buffs[id('Vaal_Smite')];
  assert.ok(vaal && vaal.ate - e.hunt.clock >= 8000, 'a aura do Vaal');
  e.hunt.clock += 1000;
  delete e.hunt.conjurando;
  e.hunt.cooldowns = {};
  const r2 = usar(e, b, 1, 0.01);
  assert.ok(r2.ok, r2.erro ?? r2.motivo);
  assert.equal(golpesEm(r2.eventos, o1).length + golpesEm(r2.eventos, o2).length, 2, 'o Castigo: 1 + 1 alvo da aura do Vaal');
  assert.equal(e.hunt.buffs[id('Smite')], undefined, 'a aura do Castigo não vale com a do Vaal');
});

test('E2B: a gema Detonar Minas — o uso detona as suas Minas (andando também) e não planta; a qualidade dá Velocidade de Detonação', { skip: SEM }, async () => {
  assert.equal(G.detonacaoDaGemaDetonar(20), 20);
  assert.equal(G.detonacaoDaGemaDetonar(0), 0);
  const { e, b } = await montar(['Detonate_Mines', 'Pyroclast_Mine'], { dx: 3 });
  e.hunt.poeRecente = { ...(e.hunt.poeRecente ?? {}), moveu: e.hunt.clock };
  const ficha = Ficha.combate(e);
  Plantadas.plantar(e.hunt, ficha, { tipo: 'mina', acao: id('Pyroclast_Mine'), slot: 1, x: b.x - 1, y: b.y, duracaoMs: 5000, agora: e.hunt.clock });
  travado(0.5, () => Acoes.tiqueDasPlantadas(e, e.hunt, PERSONAGEM, [], e.hunt.clock));
  assert.equal(Plantadas.plantadas(e.hunt, 'mina').length, 1, 'andando, o jogo não detona sozinho');
  e.hunt.clock += 300;
  const r = usar(e, b, 0);
  assert.ok(r.ok, r.erro ?? r.motivo);
  assert.equal(Plantadas.plantadas(e.hunt, 'mina').length, 0, 'o uso detonou (e não plantou outra)');
  assert.ok(soma(golpesEm(r.eventos, b)) > 0, 'a Mina detonada fere');
});
