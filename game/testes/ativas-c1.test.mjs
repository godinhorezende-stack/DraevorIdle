// (lote C1, dono 20/10) AS GEMAS ATIVAS DE CORPO A CORPO, IMPACTO E CANALIZAÇÃO — a forma do golpe, o raio condicional e os buffs da gema (o plano do grupo, as
// recomendações aceitas): a Cutilada (o raio por inimigo perto — D1.1), a da Fúria (o raio pela Fúria), a Vaal (o buff do golpe final num Raro/Único), o Acerto
// Elemental (o raio contra a afecção do elemento escolhido), a Corrente de Anzol para Pesca (D1.2), o Impacto Sísmico Vaal (Impelido), as Lâminas Velozes Vaal
// (a Cegueira), o Frenesi da Agressividade, a Tormenta de Espadas (8 acertos), a Evisceração (a onda retangular), o Esmagar Escudos do Chefe Guerreiro (a
// Onda Central — D1.6), o Escudo de Luz (as ondas dos aliados — D1.3), o Castigo do Julgamento Divino (o raio em 3 alvos — D1.4), o Estilhaçar a Terra da
// Proeminência (a estaca grande) e a Pancada de Gelo da Cadência (o raio de cada mão — D1.5). Os números são os do PoE (o PoB, o poedb); os sorteios ficam
// travados.
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
const C1 = await import('../systems/itens-poe/gemas-c1.mjs');
const L = await import('../systems/itens-poe/linhas-das-gemas.mjs');
const Areas = await import('../engine/areas.mjs');
const CargasPoe = await import('../systems/itens-poe/cargas.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');

let J;
let gerarPeca;
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 60, rng: () => 0.5 }));

/** Roda `fn` com o `Math.random` travado em `v`. */
function travado(v, fn) {
  const antes = Math.random;
  Math.random = () => v;
  try { return fn(); } finally { Math.random = antes; }
}
/** O personagem com a gema na arma (e a peça da outra mão), numa caçada; o alvo imortal colado e os outros longe. */
async function montar(slug, { nivel = 20, qualidade = 0, arma = 'One_Hand_Swords/Rusted_Sword', outra = null } = {}) {
  J ??= await import('../systems/itens-poe/jogo.mjs');
  gerarPeca ??= (await import('../systems/itens-poe/gerar.mjs')).gerarPeca;
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Scion', sistema: 'poe' });
  const a = peca(arma);
  a.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
  e.equipment = { ...e.equipment, weapon: a };
  if (outra) e.equipment.shield = peca(outra);
  else delete e.equipment.shield;
  e.inventory = [GS.itemDaGema({ id: G.doSlug(slug).itemId, nivel, xp: 0, raridade: 'comum', qualidade })];
  GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: G.doSlug(slug).acao, enabled: true, minMana: 0, conditions: [] };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(travado(0.5, () => Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' })).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 1e7;
  e.maxHp = e.hp = 1e7;
  const [b, ...resto] = e.hunt.monstros;
  for (const m of resto) Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60 });
  Object.assign(b, { x: e.hunt.pos.x + 1, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12, estados: {}, resist: {}, evasao: 0 });
  return { e, b, resto };
}
/** Põe o bicho `m` (imortal, sem evasão) na casa (dx, dy) de você. */
const por = (e, m, dx, dy, extra = {}) => Object.assign(m, { x: e.hunt.pos.x + dx, y: e.hunt.pos.y + dy, hp: 1e12, maxHp: 1e12, estados: {}, resist: {}, evasao: 0, ...extra });
/** Usa a gema no alvo (com a conjuração concluída), com o sorteio travado. */
function usar(e, b, v = 0.5) {
  return travado(v, () => {
    const x = Acoes.disparar(e, e.hunt, PERSONAGEM, 0, b, { manual: true });
    if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM); }
    return x;
  });
}
const acertos = (r, b) => (r.eventos ?? []).filter((ev) => ev.t === 'dmg' && ev.uid === b.uid).length;

// ---------------------------------------------------------------- o status

test('C1: as gemas do lote saem de parcial (as linhas do PoE têm leitor)', { skip: SEM }, () => {
  for (const s of ['Cleave', 'Cleave_of_Rage', 'Vaal_Cleave', 'Elemental_Hit', 'Chain_Hook_of_Angling', 'Vaal_Ground_Slam', 'Vaal_Blade_Flurry', 'Frenzy_of_Onslaught', 'Swordstorm', 'Eviscerate', 'Shield_Crush_of_the_Chieftain', 'Shield_of_Light', 'Smite_of_Divine_Judgement', 'Earthshatter_of_Prominence']) {
    const r = G.REGISTRO.get(s);
    assert.deepEqual([s, r.statusNoJogo, r.motivosNoJogo], [s, 'funciona', []]);
  }
  // (a Cadência: só o "Físico como Gelo Extra" da qualidade, que é da família 5 — o A6)
  assert.deepEqual(G.REGISTRO.get('Ice_Crash_of_Cadence').motivosNoJogo, ['efeito não simulado: Receba 20 % do Dano Físico como Dano de Gelo Extra']);
});

// ---------------------------------------------------------------- as Cutiladas

test('C1 (D1.1): a Cutilada — +0,1 m de raio por inimigo perto na qualidade 20, até 10 inimigos (o PoB: 0,05 por ponto, limit 10)', { skip: SEM }, async () => {
  assert.equal(G.c1DaGema('Cleave', 20, 20).raioPorInimigoM, 0.1);
  assert.equal(G.c1DaGema('Cleave', 20, 0).raioPorInimigoM, 0);
  assert.equal(G.c1DaGema('Vaal_Cleave', 20, 20).raioPorInimigoM, 0.1);
  assert.equal(C1.raioPelosInimigos(0.1, 3), 0.30000000000000004);
  assert.equal(C1.raioPelosInimigos(0.1, 14), 1, 'até 10 inimigos');
  // no jogo: o raio de 3 m (1,5 casa) com 10 inimigos a até 2 casas vira 4 m (2 casas): o inimigo a 2 casas à frente entra (com a fração travada em 0,9 — sem a casa a mais)
  const { e, b, resto } = await montar('Cleave', { qualidade: 20 });
  por(e, b, 0, -1);
  const longe = por(e, resto[0], 0, -2);
  const r0 = usar(e, b, 0.9);
  assert.ok(r0.ok, r0.erro);
  assert.equal(acertos(r0, longe), 0, 'sem inimigos perto: 1 casa');
  // (os 9 a mais à frente, a até 2 casas: o golpe segue virado para o alvo)
  [[-2, -1], [-1, -1], [1, -1], [2, -1], [-2, -2], [-1, -2], [1, -2], [2, -2], [2, 0]].forEach(([dx, dy], i) => por(e, resto[i + 1], dx, dy));
  e.hunt.clock += 10_000;
  const r1 = usar(e, b, 0.9);
  assert.ok(r1.ok, r1.erro);
  assert.equal(acertos(r1, longe), 1, 'com 11 inimigos perto: 2 casas');
});

test('C1: a Cutilada da Fúria — +0,1 m de raio por 5 de Fúria', { skip: SEM }, () => {
  assert.deepEqual(G.raioPorFuriaDaGema('Cleave_of_Rage', 20), { metros: 0.1, cada: 5 });
  assert.equal(G.raioPorFuriaDaGema('Cleave', 20), null);
});

test('C1: a Cutilada Vaal — o buff de 20 s no golpe final num Raro; a Cutilada com ele: Golpe de Misericórdia, 60% mais Área e 60% mais Dano contra Vida Baixa', { skip: SEM }, async () => {
  assert.deepEqual(G.c1DaGema('Vaal_Cleave', 20, 0).buffDaVaal, { areaMaisPct: 60, maisVidaBaixaPct: 60, culling: true });
  assert.equal(G.areaNoNivel('Vaal_Cleave', 20, 0).raioM, G.areaNoNivel('Cleave', 20, 0).raioM, 'o raio da Cutilada (radius 20 + o do nível)');
  assert.deepEqual(['Cleave', 'Cleave_of_Rage', 'Vaal_Cleave'].map(C1.melhoradaPelaCutiladaVaal), [true, true, false]);
  // o golpe final da Vaal num Raro dá o buff; num Normal, não
  const v = await montar('Vaal_Cleave');
  Object.assign(v.b, { hp: 1, maxHp: 1e6, raridade: 'normal' });
  assert.ok(usar(v.e, v.b).ok);
  assert.equal(v.e.hunt.poeCutiladaVaal, undefined, 'o Normal não dá o buff');
  const v2 = await montar('Vaal_Cleave');
  Object.assign(v2.b, { hp: 1, maxHp: 1e6, raridade: 'raro' });
  assert.ok(usar(v2.e, v2.b).ok);
  assert.ok(v2.e.hunt.poeCutiladaVaal, 'o Raro dá o buff');
  assert.equal(v2.e.hunt.poeCutiladaVaal.ate - v2.e.hunt.clock, 20_000);
  // a Cutilada com o buff mata o alvo a 9% da vida (o Golpe de Misericórdia); sem ele, não
  const sem = await montar('Cleave');
  Object.assign(sem.b, { maxHp: 1e12, hp: 0.09e12 });
  assert.ok(usar(sem.e, sem.b).ok);
  assert.ok(sem.b.hp > 0, 'sem o buff: vivo');
  const com = await montar('Cleave');
  Object.assign(com.b, { maxHp: 1e12, hp: 0.09e12 });
  com.e.hunt.poeCutiladaVaal = { ate: com.e.hunt.clock + 20_000, areaMaisPct: 60, maisVidaBaixaPct: 60, culling: true };
  assert.ok(usar(com.e, com.b).ok);
  assert.ok(com.b.hp <= 0, 'com o buff: o Golpe de Misericórdia');
});

// ---------------------------------------------------------------- o Acerto Elemental

test('C1: o Acerto Elemental — 80% mais raio contra o alvo com a afecção do elemento escolhido; o elemento não se repete', { skip: SEM }, async () => {
  assert.equal(G.c1DaGema('Elemental_Hit', 20, 0).raioContraAfeccaoPct, 80);
  assert.equal(C1.escolherElemento('fire', () => 0), 'ice');
  assert.equal(C1.escolherElemento('fire', () => 0.99), 'energy');
  assert.equal(C1.escolherElemento(null, () => 0), 'fire');
  const b = { estados: { lento: { ate: 10, pct: 30 } }, dots: [{ tipo: 'queimadura', ate: 10 }] };
  assert.deepEqual(['fire', 'ice', 'energy'].map((el) => C1.temAfeccaoDoElemento(b, el, 5)), [true, true, false]);
  // no jogo: o elemento do uso fica guardado como o anterior, e o próximo é outro
  const { e, b: alvo } = await montar('Elemental_Hit');
  assert.ok(usar(e, alvo, 0).ok);
  const id = G.doSlug('Elemental_Hit').acao;
  assert.equal(e.hunt.poeElementoAnterior?.[id], 'fire');
  e.hunt.clock += 10_000;
  assert.ok(usar(e, alvo, 0).ok);
  assert.equal(e.hunt.poeElementoAnterior[id], 'ice', 'não repete o Fogo');
});

// ---------------------------------------------------------------- a Corrente de Anzol para Pesca

test('C1 (D1.2): a Corrente de Anzol para Pesca — até 7 inimigos no alcance de 6 m (+40% da qualidade 20)', { skip: SEM }, async () => {
  assert.deepEqual(G.c1DaGema('Chain_Hook_of_Angling', 20, 0).anzol, { n: 7, alcanceM: 6 });
  assert.ok(Math.abs(G.c1DaGema('Chain_Hook_of_Angling', 20, 20).anzol.alcanceM - 8.4) < 1e-9);
  const { e, b, resto } = await montar('Chain_Hook_of_Angling', { arma: 'One_Hand_Axes/Rusted_Hatchet' });
  const outros = resto.slice(0, 7).map((m, i) => por(e, m, -3 + i, -2));
  const r = usar(e, b);
  assert.ok(r.ok, r.erro);
  assert.equal([b, ...outros].filter((m) => acertos(r, m)).length, 7, 'o alvo e os 6 mais perto');
});

// ---------------------------------------------------------------- as linhas lidas no uso

test('C1: as Lâminas Velozes Vaal — 100% de chance de Cegar e o Efeito da Cegueira +68%; o Impacto Sísmico Vaal pode ser Impelido', { skip: SEM }, () => {
  assert.deepEqual(L.atributosDaLinha('100 % de chance de Cegar inimigos ao acertá-los'), { chance_cegar: 100 });
  assert.deepEqual(L.atributosDaLinha('Efeito da Cegueira aumentado em 68 %'), { efeito_cegueira: 68 });
  assert.equal(C1.ehLinhaC1('Vaal_Ground_Slam', 'Este Ataque pode ser Impelido como se não fosse uma Habilidade Vaal'), true);
});

// ---------------------------------------------------------------- o Frenesi da Agressividade

test('C1: o Frenesi da Agressividade — no máximo de Frenesi o acerto consome todas e dá 1 s de Agressividade por carga; fora dele, ganha 1 Frenesi', { skip: SEM }, async () => {
  assert.deepEqual(G.c1DaGema('Frenzy_of_Onslaught', 20, 0).frenesi, { frenesiNoAcerto: true, agressividadePorCargaS: 1 });
  const { e, b } = await montar('Frenzy_of_Onslaught');
  assert.ok(usar(e, b).ok);
  assert.equal(CargasPoe.ativas(e).frenesi, 1, 'fora do máximo: +1 Frenesi');
  const max = CargasPoe.maximo(Ficha.combate(e).afPoe ?? {}, 'frenesi');
  e.hunt.cargasPoe = { frenesi: { n: max, ate: e.hunt.clock + 10_000 } };
  Ficha.invalidar(e);
  e.hunt.clock += 10_000;
  e.hunt.cargasPoe.frenesi.ate = e.hunt.clock + 10_000;
  assert.ok(usar(e, b).ok);
  assert.equal(CargasPoe.ativas(e).frenesi, 0, 'no máximo: consome todas');
  assert.equal(e.hunt.poeBuffs?.agressividade - e.hunt.clock, max * 1000, 'a Agressividade: 1 s por carga');
});

// ---------------------------------------------------------------- a Tormenta de Espadas

test('C1: a Tormenta de Espadas — oito acertos em cada inimigo da área (swordstorm_num_hits 8), com as duas armas', { skip: SEM }, async () => {
  assert.equal(G.c1DaGema('Swordstorm', 20, 0).golpesPorAlvo, 8);
  assert.equal(G.danoComAsDuasArmas('Swordstorm'), 100);
  const { e, b } = await montar('Swordstorm', { outra: 'One_Hand_Swords/Rusted_Sword' });
  por(e, b, 0, -1);
  // (a Retaliação: a janela aberta pelo bloqueio)
  ModsPoe.abrirRetaliacao(e.hunt, 'bloquear', {}, e.hunt.clock);
  const r = usar(e, b);
  assert.ok(r.ok, r.erro);
  assert.equal(acertos(r, b), 8);
});

// ---------------------------------------------------------------- as ondas

test('C1: a Evisceração — a onda retangular de 10 m (5 casas) de extensão e 5 m de largura (1 casa de cada lado, a fração de 0,25 como chance)', { skip: SEM }, () => {
  assert.deepEqual(G.c1DaGema('Eviscerate', 20, 0).onda, { comprimentoM: 10, larguraM: 5 });
  const f = C1.formaRetangular(5, 1);
  assert.equal(f.length, 15);
  assert.equal(Areas.raioDaForma(f), 5);
  assert.ok(f.every(([dx, dy]) => Math.abs(dx) <= 1 && dy <= -1 && dy >= -5));
});

test('C1 (D1.6): o Esmagar Escudos do Chefe Guerreiro — o cone de 2,9 m (o PoB) e a Onda Central (o terço do meio) com 88% + 40% mais Área', { skip: SEM }, () => {
  assert.equal(G.c1DaGema('Shield_Crush_of_the_Chieftain', 20, 0).ondaCentralMaisPct, 88);
  assert.equal(G.c1DaGema('Shield_Crush_of_the_Chieftain', 20, 20).ondaCentralMaisPct, 128);
  assert.equal(G.areaNoNivel('Shield_Crush_of_the_Chieftain', 20, 0).raioM, 2.9);
  // o cone de 1 casa (3 casas coladas) e a onda central até 2 casas: só a coluna do meio cresce
  const f = C1.formaComOndaCentral([[-1, -1], [0, -1], [1, -1]], 2);
  assert.deepEqual(f.map((c) => c.join(',')).sort(), ['-1,-1', '0,-1', '0,-2', '1,-1']);
});

test('C1 (D1.3): o Escudo de Luz — as ondas dos aliados a até 4 m do primeiro atingido (até 4), na direção dele', { skip: SEM }, async () => {
  assert.deepEqual(G.c1DaGema('Shield_of_Light', 20, 0).escudosDeLuz, { raioM: 4, max: 4 });
  const { e, b, resto } = await montar('Shield_of_Light', { outra: 'Shields/Splintered_Tower_Shield' });
  por(e, b, 0, -1);
  // o lacaio a 2 casas do alvo, do outro lado: a onda dele sai na direção do alvo e pega quem está atrás dele (longe da sua onda)
  const atras = por(e, resto[0], 0, -6);
  e.hunt.lacaios = [{ uid: 'l1', tipo: 'lacaio', x: e.hunt.pos.x, y: e.hunt.pos.y - 3, hp: 100, maxHp: 100 }];
  ModsPoe.abrirRetaliacao(e.hunt, 'bloquear', {}, e.hunt.clock);
  const r = usar(e, b);
  assert.ok(r.ok, r.erro);
  assert.ok(acertos(r, b) >= 2, 'a sua onda e a do lacaio no alvo');
  assert.equal(acertos(r, atras), 0, 'a onda do lacaio vai na direção do alvo (para você), não para trás dele');
});

test('C1 (D1.4): o Castigo do Julgamento Divino — o raio nos 3 inimigos mais perto a até 5 m (+2 m da qualidade 20), com 38% mais Dano em Área', { skip: SEM }, async () => {
  assert.deepEqual(G.c1DaGema('Smite_of_Divine_Judgement', 20, 0).raioDoCastigo, { alvos: 3, alcanceM: 5, maisAreaPct: 38 });
  assert.deepEqual(G.c1DaGema('Smite_of_Divine_Judgement', 20, 20).raioDoCastigo, { alvos: 3, alcanceM: 7, maisAreaPct: 38 });
  const { e, b, resto } = await montar('Smite_of_Divine_Judgement');
  por(e, b, 0, -1);
  // atrás de você (fora do golpe), a 2 casas: 4 inimigos — o raio pega 3, uma vez cada
  const atras = [por(e, resto[0], -1, 2), por(e, resto[1], 0, 2), por(e, resto[2], 1, 2), por(e, resto[3], 2, 2)];
  const r = usar(e, b);
  assert.ok(r.ok, r.erro);
  assert.equal(acertos(r, b), 1, 'o alvo do golpe só uma vez');
  assert.equal(atras.filter((m) => acertos(r, m) === 1).length, 3);
});

// ---------------------------------------------------------------- o Estilhaçar a Terra da Proeminência

test('C1: o Estilhaçar a Terra da Proeminência — 1 fissura, máximo de 5 estacas; a estaca: 100% (+1% por ponto de qualidade) mais Dano e 157% mais Área', { skip: SEM }, async () => {
  const s = G.sequenciaDaGema('Earthshatter_of_Prominence', 20, 20);
  assert.deepEqual([s.forma, s.areas, s.estacasMax, s.explosaoMaisPct, s.areaDaEstacaMaisPct], ['estrela', 1, 5, 120, 157]);
  assert.equal(G.sequenciaDaGema('Earthshatter_of_Prominence', 20, 0).explosaoMaisPct, 100);
  assert.equal(G.sequenciaDaGema('Earthshatter', 20, 0).explosaoMaisPct, -30, 'o comum segue com o −30% do PoB');
  const { e, b } = await montar('Earthshatter_of_Prominence', { arma: 'One_Hand_Axes/Rusted_Hatchet' });
  assert.ok(usar(e, b, 0.1).ok);
  assert.equal(e.hunt.poeEstacas?.length, 1);
  // a explosão: 1 casa × √2,57 = 1,6 casa → 2 com a fração travada em 0,1
  assert.deepEqual([e.hunt.poeEstacas[0].maisPct, e.hunt.poeEstacas[0].raio], [100, 2]);
});

// ---------------------------------------------------------------- a Pancada de Gelo da Cadência

test('C1 (D1.5): a Pancada de Gelo da Cadência — o raio de 1,1 m na mão principal e 3,1 m na secundária, alternando', { skip: SEM }, async () => {
  assert.deepEqual(G.c1DaGema('Ice_Crash_of_Cadence', 20, 0).maos, { principalM: 1.1, secundariaM: 3.1 });
  const { e, b, resto } = await montar('Ice_Crash_of_Cadence', { arma: 'One_Hand_Axes/Rusted_Hatchet', outra: 'One_Hand_Axes/Rusted_Hatchet' });
  por(e, b, 0, -1);
  // o centro é a casa do alvo (à sua frente); a 1 casa dele: só a secundária pega (3,1 m = 1,55 casa; a principal, 0,55)
  const lado = por(e, resto[0], 1, -2);
  const uso = (v) => { e.hunt.clock += 10_000; const r = usar(e, b, v); assert.ok(r.ok, r.erro); return acertos(r, lado); };
  const daVez = e.hunt.golpeDaSecundaria ? 'principal' : 'secundaria';
  const a1 = uso(0.9);
  const a2 = uso(0.9);
  assert.deepEqual(daVez === 'secundaria' ? [a1, a2] : [a2, a1], [1, 0], 'a secundária pega a casa ao lado; a principal, não');
});

// ---------------------------------------------------------------- a Ruptura de Trarthus (dono, 20/10)

test('C1 (dono 20/10): a Ruptura de Trarthus — 4 áreas, +0,1 m por área anterior, recomeça até 3 vezes; a comum não recomeça', { skip: SEM }, () => {
  const s = G.sequenciaDaGema('Sunder_of_Trarthus', 20, 0);
  assert.deepEqual([s.forma, s.areas, s.porAreaM, s.recomecos, s.choques, s.choqueMenos], ['linha', 4, 0.1, 3, 5, 40]);
  assert.equal(G.sequenciaDaGema('Sunder', 20, 0).recomecos, 0);
  assert.deepEqual(G.REGISTRO.get('Sunder_of_Trarthus').motivosNoJogo, []);
});

test('C1 (dono 20/10): a Ruptura de Trarthus no jogo — recomeça na direção do inimigo mais perto a até 4 casas (8 m) do fim da onda, até 3 vezes', { skip: SEM }, async () => {
  const { e, b, resto } = await montar('Sunder_of_Trarthus', { arma: 'One_Hand_Axes/Rusted_Hatchet' });
  // (o raio de 1,3 m = 0,65 casa, com a fração travada em 0,9: só a casa do centro — os choques não alcançam ninguém)
  // a 1ª onda vai de (0,-1) a (0,-4), onde está o alvo (a 0 casa do fim, não conta); o 1º recomeço vai até o a 4 casas do fim, (4,-4); o 2º anda 4 casas na direção
  // do mais perto, (4,-7), e para em (4,-8); o 3º volta para o mais perto dali, (4,-7), e anda até (4,-4) — pega os dois de novo; depois do 3º, para: o que está
  // a 5 casas (4,-13) não é alcançado
  por(e, b, 0, -4);
  const r1 = por(e, resto[0], 4, -4);
  const r2 = por(e, resto[1], 4, -7);
  const longe = por(e, resto[2], 4, -13);
  const r = usar(e, b, 0.9);
  assert.ok(r.ok, r.erro);
  assert.deepEqual([acertos(r, b), acertos(r, r1), acertos(r, r2), acertos(r, longe)], [1, 2, 2, 0]);
});
