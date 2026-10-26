// O LOTE A3b das gemas do PoE (dono, 19/10): os projéteis e os objetos que FICAM NO CHÃO ou no TEMPO, pelo PoE — o mecanismo único `hunt.poeObjetos`
// (pulsar, emitir, chão, inerte consumível — `itens-poe/gemas-a3b.mjs`, `Acoes.tiqueDosObjetos`): a Bola Relampejante (D4), o Tornado (D7), as espirais
// (D10), o Olho Invernal (D11), o Disparo Congelante e quem explode dele (D1/D2), o chão do Vórtice e da Geada Rastejante (D5/D6), as Lâminas Persistentes
// e a Explosão de Lâminas (D8), a Espiral Venenosa e as Lâminas Giratórias (D9), os tetos (D12) e a tela (D13). Os sorteios são travados (`sorte`).
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
const G3b = await import('../systems/itens-poe/gemas-a3b.mjs');
const SP = await import('../systems/itens-poe/suportes-poe.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');

const sorte = (v, f) => { const o = Math.random; Math.random = typeof v === 'function' ? v : () => v; try { return f(); } finally { Math.random = o; } };

/**
 * O personagem com a arma e as ativas (cada uma num slot da barra, sem ligação entre elas), numa caçada sem paredes por perto (a grade do andar
 * desligada: `andavel` nulo); os monstros nas casas `onde` (deslocamentos de você, imortais), o resto longe.
 */
async function montar(arma, ativas, { onde = [[1, 0]], qualidade = 0, nivel = 20, vocacao = 'sorcerer', classe = 'Witch', ligar = false } = {}) {
  const J = await import('../systems/itens-poe/jogo.mjs');
  const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
  const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
  const e = Object.assign(personagemDeTeste({ vocacao, level: 90 }), { classePoe: classe, sistema: 'poe' });
  const a = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: arma, raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
  const lista = [ativas].flat();
  const n = lista.length;
  a.soquetes = { abertos: n, links: Array.from({ length: n - 1 }, () => ligar), gemas: Array(n).fill(null), cores: Array(n).fill('W') };
  e.equipment = { ...e.equipment, weapon: a };
  delete e.equipment.shield;
  e.inventory = lista.map((s) => GS.itemDaGema({ id: (G.doSlug(s) ?? SP.doSlug(s)).itemId, nivel, xp: 0, raridade: 'comum', ...(qualidade ? { qualidade } : {}) }));
  for (let i = 0; i < n; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  e.actions = Array(Acoes.SLOTS).fill(null);
  lista.forEach((s, i) => { if (G.doSlug(s)) e.actions[i] = { id: G.doSlug(s).acao, enabled: true, minMana: 0, conditions: [] }; });
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(sorte(0.999, () => Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' })).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 1e7;
  e.maxHp = e.hp = 1e7;
  const ms = e.hunt.monstros;
  ms.forEach((m, i) => Object.assign(m, i < onde.length ? { x: e.hunt.pos.x + onde[i][0], y: e.hunt.pos.y + onde[i][1], hp: 1e12, maxHp: 1e12, estados: {}, dots: [], resist: {} } : { x: e.hunt.pos.x + 80 + i, y: e.hunt.pos.y + 80 }));
  // (sem terreno no caminho: a reta do objeto não bate em parede)
  ModsPoe.definirGradeDoCombate(e.hunt, () => null);
  return { e, bs: ms.slice(0, onde.length) };
}
/** O uso do slot `i` (com a conjuração), o sorteio travado em `v`. */
function usar({ e, bs }, i = 0, v = 0.5, alvo = bs[0]) {
  return sorte(v, () => {
    const r = Acoes.disparar(e, e.hunt, PERSONAGEM, i, alvo, { manual: true });
    assert.ok(r.ok, `${r.motivo} ${r.erro}`);
    const ev = [...(r.eventos ?? [])];
    if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; ev.push(...(Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM) ?? [])); }
    // (a próxima ação já pode sair: o relógio do grupo fica para trás)
    delete e.hunt.cooldowns?.[Acoes.GRUPO_DO_POE];
    return ev;
  });
}
/** `ms` milissegundos de tique dos objetos (passos de `passo` ms), o sorteio travado; devolve os eventos. */
function correr({ e }, ms, { passo = 50, v = 0.5, prender = null } = {}) {
  const ev = [];
  sorte(v, () => {
    for (let t = 0; t < ms; t += passo) {
      e.hunt.clock += passo;
      if (prender) prender();
      ev.push(...Acoes.tiqueDasPlantadas(e, e.hunt, PERSONAGEM, []));
    }
  });
  return ev;
}
const danoEm = (ev, b) => ev.filter((x) => x.t === 'dmg' && x.uid === b.uid && x.foe).reduce((t, x) => t + x.v, 0);
const acertosEm = (ev, b) => ev.filter((x) => x.t === 'dmg' && x.uid === b.uid && x.foe).length;
const objetos = (e, tipo) => (e.hunt.poeObjetos ?? []).filter((o) => !tipo || o.tipo === tipo);

// ---------------------------------------------------------------- D4: a Bola Relampejante

test('A3b D4: a Bola Relampejante é uma bola de verdade — o uso não acerta; ela anda 2 s pela velocidade dela e acerta a cada 0,15 s todos no raio', { skip: SEM }, async () => {
  const m = await montar('Wands/Driftwood_Wand', 'Ball_Lightning', { onde: [[2, 0], [2, 1]] });
  const x0 = m.e.hunt.pos.x;
  const ev = usar(m);
  assert.equal(danoEm(ev, m.bs[0]), 0, 'o uso só solta a bola');
  const [bola] = objetos(m.e, 'bola');
  assert.ok(bola, 'a bola está no chão');
  assert.equal(bola.mov, 'reta');
  assert.equal(bola.intervaloMs, 150);
  assert.equal(bola.ate - m.e.hunt.clock, 2000);
  // a velocidade: 40 u/s × 1,33 ÷ 20 u por casa (o PoB) × o mod do uso (1)
  assert.ok(Math.abs(bola.vel - (40 * 1.33) / 20) < 1e-9, String(bola.vel));
  // o raio: 2,0 m = 1 casa
  assert.equal(bola.raio, 1);
  const ate = correr(m, 140);
  assert.equal(acertosEm(ate, m.bs[0]), 0, 'nada antes dos 0,15 s');
  const depois = correr(m, 2000);
  const n0 = acertosEm(depois, m.bs[0]);
  assert.ok(n0 >= 3, `a bola acerta várias vezes quem está no caminho: ${n0}`);
  assert.equal(n0, acertosEm(depois, m.bs[1]), 'todos no raio levam cada golpe');
  assert.ok(n0 <= 13, 'no máximo os 13 golpes de 2 s');
  assert.equal(objetos(m.e, 'bola').length, 0, 'a bola acabou');
  assert.ok(bola.x > x0 + 3, `a bola andou ~5 casas: ${bola.x - x0}`);
});

test('A3b D4: a Estática fica parada no alvo e acerta os 13 golpes de 2 s; a Orbital gira em volta de você', { skip: SEM }, async () => {
  const m = await montar('Wands/Driftwood_Wand', 'Ball_Lightning_of_Static', { onde: [[3, 0]] });
  usar(m);
  const [bola] = objetos(m.e, 'bola');
  assert.equal(bola.mov, 'parado');
  assert.deepEqual([bola.x, bola.y], [m.bs[0].x, m.bs[0].y]);
  const ev = correr(m, 2100);
  assert.equal(acertosEm(ev, m.bs[0]), 13, '2000 ÷ 150 = 13 golpes, o primeiro aos 0,15 s');
  const o = await montar('Wands/Driftwood_Wand', 'Ball_Lightning_of_Orbiting', { onde: [[2, 0]] });
  usar(o);
  const [orb] = objetos(o.e, 'bola');
  assert.equal(orb.mov, 'orbita');
  const casas = new Set();
  sorte(0.5, () => { for (let t = 0; t < 2000; t += 50) { o.e.hunt.clock += 50; Acoes.tiqueDasPlantadas(o.e, o.e.hunt, PERSONAGEM, []); if (orb.ate > o.e.hunt.clock) casas.add(`${orb.x - o.e.hunt.pos.x},${orb.y - o.e.hunt.pos.y}`); } });
  assert.ok(casas.size >= 4, `a orbital passa por várias casas em volta de você: ${[...casas]}`);
  for (const k of casas) { const [dx, dy] = k.split(',').map(Number); assert.ok(Math.max(Math.abs(dx), Math.abs(dy)) <= 2, k); }
});

// ---------------------------------------------------------------- D7: o Tornado

test('A3b D7: o Tornado anda para a frente 1,5 s e persegue por 4 s, acerta a cada 0,25 s, tolhe no raio e é 1 por vez (a Turbulência: 3, só persegue)', { skip: SEM }, async () => {
  const d = G.objetoDaGema('Tornado', 20, 20);
  assert.equal(d.intervaloMs, 250);
  assert.equal(d.fase1Ms, 1500);
  assert.equal(d.fase2Ms, 4000);
  assert.equal(d.max, 1);
  assert.equal(d.velIncPct, 57 + 20, 'o "+%" da gema e o da qualidade');
  assert.deepEqual(d.absorve, { max: 20, pct: 10 });
  const t = G.objetoDaGema('Tornado_of_Elemental_Turbulence', 20, 0);
  assert.equal(t.fase1Ms, 0, 'a Turbulência só persegue');
  assert.equal(t.fase2Ms, 4000);
  assert.equal(t.max, 3);
  assert.equal(t.absorve, null);
  const m = await montar('Wands/Driftwood_Wand', 'Tornado', { onde: [[1, 0]] });
  assert.equal(danoEm(usar(m), m.bs[0]), 0, 'o uso só cria o tornado');
  const [o] = objetos(m.e, 'tornado');
  assert.equal(o.mov, 'reta');
  const ev = correr(m, 1000, { prender: () => Object.assign(m.bs[0], { x: o.x + 1, y: o.y }) });
  assert.equal(acertosEm(ev, m.bs[0]), 4, 'um golpe a cada 0,25 s com o bicho no raio');
  // (revisão do A3b: o "-1 %" da linha é a bandeira `tornado_hinder`; o Tolhimento é o do PoE, 30%)
  assert.equal(o.lentidaoPct, 30);
  // (aval do dono, 21/10: o Tolhimento agora é um estado próprio, como no PoE — `estados.tolhido`, não o `lento`)
  assert.equal(m.bs[0].estados?.tolhido?.pct, 30, 'o Tolhimento no raio');
  correr(m, 600);
  assert.equal(o.mov, 'persegue', 'depois da duração inicial, persegue');
  assert.equal(o.fase, 2);
  // o bicho longe (a 5 casas do tornado): ele vai até lá, 1 casa a cada 0,5 s ÷ (1 + 57%)
  Object.assign(m.bs[0], { x: o.x + 5, y: o.y });
  const x0 = o.x;
  correr(m, 1000);
  assert.ok(o.x - x0 >= 2 && o.x - x0 <= 4, `andou ${o.x - x0} casas em 1 s`);
  // 1 por vez: o segundo uso tira o primeiro
  Object.assign(m.bs[0], { x: m.e.hunt.pos.x + 1, y: m.e.hunt.pos.y });
  usar(m);
  assert.equal(objetos(m.e, 'tornado').length, 1);
  assert.notEqual(objetos(m.e, 'tornado')[0].id, o.id);
});

test('A3b D7: o Tornado absorve os SEUS projéteis que passam pela casa dele na fase inicial (até 20) e soma 10% do dano deles a cada golpe da perseguição', { skip: SEM }, async () => {
  const m = await montar('Wands/Driftwood_Wand', ['Tornado', 'Spark'], { onde: [[3, 0]] });
  usar(m, 0);
  const [o] = objetos(m.e, 'tornado');
  assert.equal(o.fase, 1);
  // (os disparos no mesmo instante — a conjuração de cada um não conta aqui: o tornado fica na fase inicial)
  const t0 = m.e.hunt.clock;
  for (let i = 0; i < 25; i++) { usar(m, 1, 0.5); m.e.hunt.clock = t0; }
  assert.equal(o.absorve.n, 20, 'até 20');
  assert.ok(o.absorve.guardado > 0);
  // na perseguição, cada golpe soma o guardado (o golpe do tornado e o refletido)
  correr(m, 1600);
  assert.equal(o.fase, 2);
  Object.assign(m.bs[0], { x: o.x + 1, y: o.y });
  const ev = correr(m, 500, { prender: () => Object.assign(m.bs[0], { x: o.x + 1, y: o.y }) });
  const refletidos = ev.filter((x) => x.t === 'dmg' && x.uid === m.bs[0].uid && x.fonte === 'tornado');
  assert.equal(refletidos.length, 2, `em cada um dos 2 golpes de 0,5 s: ${JSON.stringify(o)} ${JSON.stringify(ev.filter((x) => x.t === 'dmg').map((x) => [x.fonte, x.v]))}`);
  assert.ok(Math.abs(refletidos[0].v - Math.round(o.absorve.guardado)) <= 1, `${refletidos[0].v} ≈ ${o.absorve.guardado}`);
});

// ---------------------------------------------------------------- D10/D11: as espirais e o Olho Invernal

const tiros = (ev) => ev.filter((x) => x.t === 'shot');
/** O centro de um evento de área (o meio das casas dele — `Areas.casasDoEvento`). */
const centroDaArea = (a) => { const cs = a.casas.map(([dx, dy]) => [a.x + dx, a.y + dy]); const xs = cs.map((c) => c[0]); const ys = cs.map((c) => c[1]); return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]; };

test('A3b D10: a Faísca Vaal solta 100 projéteis em 3 s (+ os "+N projéteis"), em direções aleatórias; o uso não acerta na hora', { skip: SEM }, async () => {
  const m = await montar('Wands/Driftwood_Wand', 'Vaal_Spark', { onde: [[1, 0]], qualidade: 20 });
  const ev = usar(m);
  assert.equal(danoEm(ev, m.bs[0]), 0);
  const [esp] = objetos(m.e, 'espiral');
  const extras = Acoes.comOsAlvosDaGema(Acoes.POR_ID_PUBLICO(G.doSlug('Vaal_Spark').acao), GS.efeitoNaSkill(m.e, G.doSlug('Vaal_Spark').acao), m.e).alvosExtras;
  assert.ok(extras >= 2, 'a qualidade: "+2 projéteis"');
  assert.equal(esp.n, 100 + extras);
  assert.equal(esp.angulo, null, 'as direções aleatórias da gema');
  // (o sorteio travado no leste: todas no alvo)
  const depois = correr(m, 3100, { v: () => 0 });
  assert.equal(tiros(depois).length, esp.n, 'todos os projéteis saem em 3 s');
  assert.equal(acertosEm(depois, m.bs[0]), esp.n);
  assert.equal(objetos(m.e, 'espiral').length, 0);
});

test('A3b D10: a Bola de Fogo Vaal (32 em 2 s, −720°), o Rasgalma da Espiral (5 em 0,8 s, 300°) e o Arremesso Espectral Vaal (8 em cada uma das duas espirais espelhadas)', { skip: SEM }, async () => {
  const angulos = (ev, de) => tiros(ev).map((s) => Math.round((Math.atan2(s.ty - de.y, s.tx - de.x) * 180) / Math.PI));
  const f = await montar('Wands/Driftwood_Wand', 'Vaal_Fireball', { onde: [[3, 0]] });
  usar(f);
  const de = { ...f.e.hunt.pos };
  const evf = correr(f, 2100);
  assert.equal(tiros(evf).length, 32);
  assert.equal(angulos(evf, de)[0], 0, 'a primeira no rumo do alvo');
  const passo = G3b.anguloDaEspiral(1, 32, 0, -720) * 180 / Math.PI;
  assert.ok(Math.abs(passo + 22.5) < 1e-9, '−720° ÷ 32 = −22,5° a cada uma');
  assert.ok(acertosEm(evf, f.bs[0]) >= 2, 'as duas voltas passam pelo alvo');
  const s = await montar('Wands/Driftwood_Wand', 'Soulrend_of_the_Spiral', { onde: [[3, 0]] });
  usar(s);
  assert.equal(tiros(correr(s, 900)).length, 5);
  const v = await montar('One_Hand_Axes/Rusted_Hatchet', 'Vaal_Spectral_Throw', { onde: [[3, 0]], vocacao: 'knight', classe: 'Marauder' });
  usar(v);
  const dv = { ...v.e.hunt.pos };
  const evv = correr(v, 2100).filter((x) => x.t === 'shot' && x.x === dv.x && x.y === dv.y);
  assert.ok(evv.length >= 16, `8 em cada espiral: ${evv.length}`);
  const [a, b] = angulos(evv, dv);
  // (o ponto do tiro é a casa: o ângulo dela, ±3°)
  assert.ok(Math.abs(a + 15) <= 3, `começa a −15°: ${a}`);
  assert.ok(Math.abs(b - 15) <= 3, `o espelho: ${b}`);
});

test('A3b D11: o Olho Invernal não causa dano; solta 1 fragmento a cada 0,1 s no voo e a espiral do fim (8 / 16 / 12, os "+N projéteis" só nela)', { skip: SEM }, async () => {
  assert.equal(G.objetoDaGema('Eye_of_Winter', 20, 0).fim, 8);
  assert.equal(G.objetoDaGema('Eye_of_Winter', 20, 20).fim, 10, '+2 da qualidade');
  assert.equal(G.objetoDaGema('Eye_of_Winter_of_Finality', 20, 0).fim, 16);
  assert.equal(G.objetoDaGema('Eye_of_Winter_of_Transience', 20, 0).fim, 12);
  const m = await montar('Wands/Driftwood_Wand', 'Eye_of_Winter', { onde: [[1, 1]] });
  const ev = usar(m);
  assert.equal(danoEm(ev, m.bs[0]), 0, 'o olho não acerta');
  const [olho] = objetos(m.e, 'olho');
  const voo = olho.ate - m.e.hunt.clock;
  assert.equal(voo, Math.round((1000 * 7) / 4), 'até 7 casas, a 4 casas/s');
  const evo = correr(m, voo + 200);
  const doVoo = Math.floor(voo / 100);
  assert.equal(tiros(evo).length, doVoo + 8, `${doVoo} no voo + 8 no fim`);
  assert.ok(acertosEm(evo, m.bs[0]) >= 1, 'os fragmentos acertam');
  assert.equal(objetos(m.e, 'olho').length, 0);
  // (revisão do A3b) a Transitoriedade: os 12 saem DURANTE o voo (360° ÷ 12), sem a espiral do fim
  assert.equal(G.objetoDaGema('Eye_of_Winter_of_Transience', 20, 0).noVoo, true);
  const t = await montar('Wands/Driftwood_Wand', 'Eye_of_Winter_of_Transience', { onde: [[1, 1]] });
  usar(t);
  const [ot] = objetos(t.e, 'olho');
  assert.equal(ot.fim, 0);
  const vooT = ot.ate - t.e.hunt.clock;
  const meio = tiros(correr(t, Math.floor(vooT / 2)));
  assert.ok(meio.length >= 5 && meio.length <= 7, `metade dos 12 na metade do voo: ${meio.length}`);
  const resto = tiros(correr(t, vooT));
  assert.equal(meio.length + resto.length, 12, 'os 12, e nenhum no fim');
});

// ---------------------------------------------------------------- D1/D2: o Disparo Congelante e quem explode dele

test('A3b D1/D2: o Disparo Congelante acerta na hora e deixa um marcador no fim do voo (2 s ÷ o mod); a Nova Glacial dos Disparos explode dele com 50% mais dano, sem o destruir', { skip: SEM }, async () => {
  const m = await montar('Wands/Driftwood_Wand', ['Frostbolt', 'Ice_Nova_of_Frostbolts'], { onde: [[2, 0]] });
  const ev = usar(m, 0);
  assert.ok(danoEm(ev, m.bs[0]) > 0, 'o acerto na hora');
  const [marca] = objetos(m.e, 'marcador');
  assert.ok(marca, 'o marcador');
  assert.deepEqual([marca.x - m.e.hunt.pos.x, marca.y - m.e.hunt.pos.y], [7, 0], 'a 7 casas, no rumo do projétil');
  assert.equal(marca.ate - m.e.hunt.clock, 2000);
  // a nova no alvo perto do marcador: a nova sai dele, com 50% mais dano
  Object.assign(m.bs[0], { x: marca.x, y: marca.y });
  const comMarca = usar(m, 1, 0.5);
  const area = comMarca.find((x) => x.t === 'area');
  assert.deepEqual(centroDaArea(area), [marca.x, marca.y], 'a nova sai do Disparo');
  assert.equal(objetos(m.e, 'marcador').length, 1, 'a Nova Glacial não destrói o Disparo');
  const danoComMarca = danoEm(comMarca, m.bs[0]);
  // sem marcador: a nova em você (o bicho colado), sem o "mais"
  m.e.hunt.poeObjetos = [];
  Object.assign(m.bs[0], { x: m.e.hunt.pos.x + 1, y: m.e.hunt.pos.y });
  const semMarca = usar(m, 1, 0.5);
  assert.ok(Math.abs(danoComMarca / danoEm(semMarca, m.bs[0]) - 1.5) < 0.02, `${danoComMarca} ÷ ${danoEm(semMarca, m.bs[0])}`);
});

test('A3b D2: o Vórtice da Projeção explode de até 5 Disparos e os destrói, com 50% mais área e 50% mais dano; deixa o chão em cada um', { skip: SEM }, async () => {
  const c = G.consomeDisparosDaGema('Vortex_of_Projection', 20);
  assert.deepEqual(c, { max: 5, destruir: true, maisDanoPct: 50, maisAreaPct: 50 });
  assert.deepEqual(G.consomeDisparosDaGema('Ice_Nova_of_Frostbolts', 20), { max: 2, destruir: false, maisDanoPct: 50, maisAreaPct: 0 });
  const m = await montar('Wands/Driftwood_Wand', ['Frostbolt', 'Vortex_of_Projection'], { onde: [[2, 0]] });
  usar(m, 0);
  const [marca] = objetos(m.e, 'marcador');
  Object.assign(m.bs[0], { x: marca.x, y: marca.y });
  const ev = usar(m, 1, 0.5);
  assert.deepEqual(centroDaArea(ev.find((x) => x.t === 'area')), [marca.x, marca.y], 'a nova sai do Disparo');
  assert.equal(objetos(m.e, 'marcador').length, 0, 'o Vórtice da Projeção destrói');
  const [chao] = objetos(m.e, 'chao');
  assert.deepEqual([chao.x, chao.y], [marca.x, marca.y], 'o chão no Disparo');
});

// ---------------------------------------------------------------- D5/D6: o chão

test('A3b D5: o Vórtice é CHÃO — o degenerativo não fica no acertado; só quem está dentro leva, o dano exato pelo tempo', { skip: SEM }, async () => {
  const m = await montar('Wands/Driftwood_Wand', 'Vortex', { onde: [[1, 0]] });
  usar(m);
  assert.ok(!(m.bs[0].dots ?? []).some((d) => d.tipo === 'degenGelo'), 'sem o degenerativo no acertado');
  const [chao] = objetos(m.e, 'chao');
  assert.ok(chao && chao.efeito === 'solo');
  assert.equal(chao.mov, 'parado');
  assert.equal(chao.ate - m.e.hunt.clock, 3000, 'a duração da gema');
  assert.equal(chao.raio, 1, 'o alcance secundário (2,3 m) em casas');
  const porS = chao.partes[0].porSegundo;
  assert.ok(porS > 0);
  const ev = correr(m, 1000).filter((x) => x.dot);
  const levou = danoEm(ev, m.bs[0]);
  assert.ok(Math.abs(levou - porS) <= 2, `1 s dentro: ${levou} ≈ ${porS}`);
  // fora do chão, nada
  Object.assign(m.bs[0], { x: chao.x + 4, y: chao.y });
  assert.equal(danoEm(correr(m, 1000).filter((x) => x.dot), m.bs[0]), 0);
  correr(m, 1100);
  assert.equal(objetos(m.e, 'chao').length, 0, 'acaba com a duração');
});

test('A3b D5/D6: a Geada Rastejante deixa o chão onde o projétil parou e PERSEGUE (1 casa a cada 0,5 s até o vivo mais perto a até 4 casas); a área fria anda junto; teto de 10 (5 nas Banquisas)', { skip: SEM }, async () => {
  const d = G.objetoDaGema('Creeping_Frost', 20, 0);
  assert.equal(d.max, 10);
  assert.deepEqual(d.persegue, { passoMs: 500, buscaCasas: 4, velIncPct: 0 });
  const f = G.objetoDaGema('Creeping_Frost_of_Floes', 20, 20);
  assert.equal(f.max, 5);
  assert.equal(f.persegue.velIncPct, 140, '100% da gema + 40% da qualidade');
  const m = await montar('Wands/Driftwood_Wand', 'Creeping_Frost', { onde: [[2, 0], [2, 3]] });
  usar(m);
  const [chao] = objetos(m.e, 'chao');
  assert.equal(chao.mov, 'persegue');
  assert.deepEqual([chao.x, chao.y], [m.bs[0].x, m.bs[0].y], 'onde o projétil parou');
  const fria = m.e.hunt.areasFrias.find((a) => a.obj === chao.id);
  assert.ok(fria, 'a área fria do chão');
  // o primeiro bicho sai do alcance; o chão vai atrás do outro (a 3 casas)
  Object.assign(m.bs[0], { x: chao.x + 20, y: chao.y });
  correr(m, 1000);
  assert.deepEqual([chao.x, chao.y], [m.bs[1].x, m.bs[1].y - 1], '2 passos em 1 s');
  assert.deepEqual([fria.x, fria.y], [chao.x, chao.y], 'a área fria anda junto');
  // o teto: 12 usos, ficam os 10 mais novos
  for (let i = 0; i < 12; i++) { Object.assign(m.bs[0], { x: m.e.hunt.pos.x + 2, y: m.e.hunt.pos.y }); usar(m); }
  assert.equal(objetos(m.e, 'chao').length, 10);
});

// ---------------------------------------------------------------- D8: as Lâminas Persistentes

test('A3b D8: a Chuva de Lâminas deixa 1 Lâmina Persistente por saraivada (no centro dela), 6 s, sem dano; a Explosão de Lâminas detona as que toca, em cadeia', { skip: SEM }, async () => {
  const m = await montar('Wands/Driftwood_Wand', ['Bladefall', 'Blade_Blast'], { onde: [[3, 0]] });
  usar(m, 0);
  const laminas = objetos(m.e, 'lamina');
  assert.equal(laminas.length, 5, '5 rajadas, uma lâmina por rajada');
  assert.deepEqual(laminas.map((l) => l.x - m.e.hunt.pos.x), [1, 2, 3, 4, 5], 'no centro de cada rajada');
  assert.equal(laminas[0].ate - m.e.hunt.clock, 6000);
  assert.deepEqual(Acoes.laminasPersistentes(m.e.hunt).map((l) => l.id), laminas.map((l) => l.id), 'a lista para a Arma Animada dos Arcos');
  assert.equal(danoEm(correr(m, 500), m.bs[0]), 0, 'as lâminas não causam dano');
  // a Explosão no alvo (3 casas à frente): a área dela toca a lâmina 3 e as vizinhas; cada detonação toca as do lado — todas as 5 em cadeia
  const ev = usar(m, 1, 0.5);
  assert.equal(objetos(m.e, 'lamina').length, 0, 'todas detonadas e destruídas');
  assert.equal(ev.filter((x) => x.t === 'area').length, 1 + 5, 'a explosão e uma detonação em cada lâmina');
  assert.ok(acertosEm(ev, m.bs[0]) >= 2);
});

test('A3b D8: as Facas Etéreas das Lâminas Persistentes deixam 1 a cada N facas, onde a faca parou; o teto de 40', { skip: SEM }, async () => {
  const d = G.objetoDaGema('Ethereal_Knives_of_Lingering_Blades', 20, 0);
  assert.deepEqual([d.tipo, d.por, d.cada, d.max], ['laminas', 'faca', 1, 40]);
  const m = await montar('Wands/Driftwood_Wand', 'Ethereal_Knives_of_Lingering_Blades', { onde: [[2, 0]] });
  usar(m);
  const n = objetos(m.e, 'lamina').length;
  assert.ok(n >= 10, `uma por faca: ${n}`);
  for (let i = 0; i < 6; i++) usar(m);
  assert.equal(objetos(m.e, 'lamina').length, 40, 'no máximo 40, saem as mais velhas');
});

// ---------------------------------------------------------------- D9: a Espiral Venenosa

test('A3b D9: a Espiral Venenosa captura cada projétil que voltou (até 30 + 0,5 por qualidade, 12 s); as Lâminas Giratórias soltam todos em leque, sem voltar, e 40% ficam', { skip: SEM }, async () => {
  assert.equal(G.objetoDaGema('Venom_Gyre', 20, 20).max, 40, '30 + 10 da qualidade');
  const v = G.objetoDaGema('Vaal_Venom_Gyre', 20, 0);
  assert.deepEqual([v.max, v.iniciais, v.porS, v.emitirMs], [50, 50, 15, 6000]);
  const m = await montar('Claws/Nailed_Fist', ['Venom_Gyre', 'Whirling_Blades'], { onde: [[2, 0], [3, 3]], vocacao: 'knight', classe: 'Shadow' });
  usar(m, 0);
  const n = objetos(m.e, 'capturado').length;
  const proj = Acoes.comOsAlvosDaGema(Acoes.POR_ID_PUBLICO(G.doSlug('Venom_Gyre').acao), GS.efeitoNaSkill(m.e, G.doSlug('Venom_Gyre').acao), m.e);
  assert.equal(n, Math.max(1, Math.round(proj.projeteisBase ?? 1)) + Math.round(proj.alvosExtras ?? 0), 'um por projétil do uso');
  assert.equal(objetos(m.e, 'capturado')[0].ate - m.e.hunt.clock, 12000);
  for (let i = 0; i < 40; i++) usar(m, 0);
  assert.equal(objetos(m.e, 'capturado').length, 30, 'o teto da gema');
  // as Lâminas Giratórias: todos saem (o sorteio dos 40%: 0,5 — nenhum fica; 0,1 — todos ficam)
  Object.assign(m.bs[1], { x: m.e.hunt.pos.x + 3, y: m.e.hunt.pos.y });
  const ev = usar(m, 1, 0.5);
  const soltos = ev.filter((x) => x.t === 'shot');
  assert.ok(soltos.length >= 30, `os 30 em leque: ${soltos.length}`);
  assert.equal(objetos(m.e, 'capturado').length, 0, 'nenhum ficou (o sorteio acima de 40%)');
  for (let i = 0; i < 10; i++) usar(m, 0);
  const antes = objetos(m.e, 'capturado').length;
  Object.assign(m.bs[1], { x: m.e.hunt.pos.x + 3, y: m.e.hunt.pos.y });
  usar(m, 1, 0.1);
  assert.equal(objetos(m.e, 'capturado').length, antes, 'com o sorteio abaixo de 40%, todos ficam');
});

test('A3b D9: a Espiral Venenosa Vaal cria 50 capturados na hora e mais 15 por segundo por 6 s, até 50; o uso não acerta', { skip: SEM }, async () => {
  const m = await montar('Claws/Nailed_Fist', 'Vaal_Venom_Gyre', { onde: [[2, 0]], vocacao: 'knight', classe: 'Shadow' });
  const ev = usar(m);
  assert.equal(danoEm(ev, m.bs[0]), 0);
  assert.equal(objetos(m.e, 'capturado').length, 50);
  // tirar 20 (como se soltos): em 1 s voltam 15
  Acoes.consumirObjetos(m.e.hunt, objetos(m.e, 'capturado').slice(0, 20));
  correr(m, 1000);
  assert.equal(objetos(m.e, 'capturado').length, 45);
  correr(m, 6000);
  assert.equal(objetos(m.e, 'capturado').length, 50, 'até o máximo');
  assert.equal(objetos(m.e, 'captador').length, 0, 'o captador acaba em 6 s');
});

// ---------------------------------------------------------------- D3, D12, D13 e o status

test('A3b D3: o totem também deixa o objeto (a bola sai do lugar dele e o golpe é do totem); o mercenário não', { skip: SEM }, async () => {
  const m = await montar('Wands/Driftwood_Wand', ['Ball_Lightning', 'Spell_Totem_Support'], { onde: [[3, 0]], ligar: true });
  usar(m, 0);
  const [l] = (m.e.hunt.lacaios ?? []).filter((x) => x.tipo === 'totem' && x.hp > 0);
  assert.ok(l, 'o totem foi posto');
  assert.equal(objetos(m.e, 'bola').length, 0, 'o seu uso só coloca o totem');
  const ev = sorte(0.5, () => Cacadas.golpeDoTotem(m.e, m.e.hunt, l, m.bs[0], Ficha.combate(m.e), PERSONAGEM, m.e.hunt.clock));
  assert.equal(danoEm(ev, m.bs[0]), 0);
  const [bola] = objetos(m.e, 'bola');
  assert.equal(bola?.dono, 'totem');
  assert.deepEqual([bola.x, bola.y], [l.x, l.y], 'do lugar do totem');
  const golpes = correr(m, 2100, { prender: () => Object.assign(m.bs[0], { x: bola.x + 1, y: bola.y }) }).filter((x) => x.t === 'dmg' && x.uid === m.bs[0].uid && x.foe);
  assert.ok(golpes.length >= 10, `os golpes da bola do totem: ${golpes.length}`);
  assert.ok(golpes.every((x) => x.lacaio), 'o golpe é do totem (marcado como o dos lacaios)');
});

test('A3b D12: teto de 60 golpes por objeto por tique e de 20 objetos ativos por gema', { skip: SEM }, async () => {
  const m = await montar('Wands/Driftwood_Wand', 'Ball_Lightning_of_Static', { onde: [[2, 0]] });
  usar(m);
  const [bola] = objetos(m.e, 'bola');
  // um tique enorme (a caçada offline): a bola de 100 s com 650 golpes devidos sai só com 60
  bola.ate = m.e.hunt.clock + 100_000;
  m.e.hunt.clock += 99_000;
  const ev = sorte(0.5, () => Acoes.tiqueDasPlantadas(m.e, m.e.hunt, PERSONAGEM, []));
  assert.equal(acertosEm(ev, m.bs[0]), 60);
  const b = await montar('Wands/Driftwood_Wand', 'Ball_Lightning', { onde: [[2, 0]] });
  for (let i = 0; i < 25; i++) usar(b);
  assert.equal(objetos(b.e, 'bola').length, 20, 'ficam as 20 mais novas');
});

test('A3b D13: o retrato da caçada leva os objetos (o tipo, a casa, o raio, o que falta), os capturados juntos em você; o cliente os desenha', { skip: SEM }, async () => {
  const m = await montar('Claws/Nailed_Fist', ['Venom_Gyre', 'Ball_Lightning'], { onde: [[2, 0]], vocacao: 'knight', classe: 'Shadow' });
  const vazio = Cacadas.snapshotDaHunt(m.e);
  assert.deepEqual(vazio.poeObjetos, [], 'sempre presente (o quadro em delta limpa quando somem)');
  usar(m, 0);
  usar(m, 1);
  const snap = Cacadas.snapshotDaHunt(m.e);
  const bola = snap.poeObjetos.find((o) => o.t === 'bola');
  // (revisão do A3b: o FIM absoluto, no relógio da caçada — a lista não muda a cada tique só pelo tempo)
  assert.ok(bola && bola.r === 1 && bola.ate === m.e.hunt.clock + 2000 && bola.el === 'energy', JSON.stringify(bola));
  assert.equal(bola.falta, undefined);
  const capt = snap.poeObjetos.find((o) => o.t === 'capturados');
  assert.ok(capt && capt.n >= 1 && capt.x === m.e.hunt.pos.x && capt.segue === 'player', JSON.stringify(capt));
  // o mesmo retrato um tique depois, sem nada mudar de lugar: a mesma lista (o quadro em delta não a manda de novo)
  const [b] = objetos(m.e, 'bola');
  m.e.hunt.clock += 1;
  assert.deepEqual(Acoes.objetosParaCliente(m.e.hunt).find((o) => o.t === 'bola'), { ...bola, x: b.x, y: b.y });
  // recortado pela tela: o objeto longe não vai
  b.x += 60;
  assert.ok(!Acoes.objetosParaCliente(m.e.hunt).some((o) => o.t === 'bola'), 'fora da tela');
});

/** Um contexto de canvas falso que grava cada chamada de desenho (o nome e os argumentos) e cada atribuição de estilo. */
function ctxFalso() {
  const chamadas = [];
  const ctx = { chamadas };
  for (const k of ['save', 'restore', 'beginPath', 'arc', 'ellipse', 'fill', 'stroke', 'fillRect', 'strokeRect', 'moveTo', 'lineTo', 'closePath', 'fillText']) ctx[k] = (...a) => chamadas.push([k, ...a]);
  for (const k of ['fillStyle', 'strokeStyle', 'lineWidth', 'globalAlpha', 'font', 'textAlign']) Object.defineProperty(ctx, k, { set: (v) => chamadas.push([`=${k}`, v]), get: () => undefined });
  return ctx;
}
test('A3b D13: o cliente desenha cada um dos 10 tipos com a forma dele (o véu do raio, a figura), na posição andando de quem ele acompanha, e esmaece no fim', { skip: SEM }, async () => {
  const D = await import('../frontend/client/src/objetos-do-poe.mjs');
  assert.deepEqual([...D.TIPOS].sort(), ['bola', 'capturados', 'chao', 'esfera', 'lamina', 'marcador', 'olho', 'tempestade', 'tornado', 'vortice']);
  for (const t of D.TIPOS) assert.ok(D.estiloDoObjeto({ t, el: 'ice' })?.forma, t);
  assert.equal(D.estiloDoObjeto({ t: 'nada' }), null);
  const FIGURA = { bola: 'arc', esfera: 'arc', tornado: 'ellipse', lamina: 'closePath', marcador: 'closePath', olho: 'ellipse', chao: 'lineTo', tempestade: 'lineTo', vortice: 'lineTo', capturados: 'arc' };
  for (const t of D.TIPOS) {
    const ctx = ctxFalso();
    const o = { id: t, t, x: 3, y: 4, r: ['bola', 'tornado', 'chao', 'esfera', 'tempestade', 'vortice'].includes(t) ? 1 : 0, ate: 10_000, el: 'ice', n: 3 };
    D.desenharObjetosDoPoe(ctx, [o], { camX: 0, camY: 0, tile: 32, agora: 0, relogio: 0 });
    const nomes = ctx.chamadas.map((c) => c[0]);
    assert.ok(nomes.includes(FIGURA[t]), `${t}: ${nomes.join(',')}`);
    const veu = ctx.chamadas.find((c) => c[0] === 'fillRect' && c[3] === 3 * 32);
    if (D.estiloDoObjeto(o).veu && o.r) assert.deepEqual(veu, ['fillRect', 2 * 32, 3 * 32, 96, 96], `${t}: o véu nas casas do raio`);
    assert.deepEqual(ctx.chamadas.find((c) => c[0] === '=globalAlpha'), ['=globalAlpha', 1]);
  }
  // o que acompanha você vai na posição andando do boneco, não na casa
  const ctx = ctxFalso();
  D.desenharObjetosDoPoe(ctx, [{ id: 'c', t: 'capturados', x: 3, y: 4, r: 0, ate: 0, n: 1, segue: 'player' }], { tile: 32, agora: 0, relogio: 0, posDe: (uid) => (uid === 'player' ? { x: 100, y: 200 } : null) });
  const [, ax, ay] = ctx.chamadas.find((c) => c[0] === 'arc');
  assert.ok(Math.abs(ax - 116) <= 32 * 0.5 && Math.abs(ay - 216) <= 32 * 0.5, `perto do boneco andando: ${ax},${ay}`);
  // o que falta pouco esmaece
  const fim = ctxFalso();
  D.desenharObjetosDoPoe(fim, [{ id: 'b', t: 'bola', x: 0, y: 0, r: 1, ate: 1250 }], { tile: 32, agora: 0, relogio: 1000 });
  assert.deepEqual(fim.chamadas.find((c) => c[0] === '=globalAlpha'), ['=globalAlpha', 0.5]);
});

test('A3b: o status — as gemas do lote (e as do A3b-2 feitas) saem de parcial', { skip: SEM }, () => {
  for (const s of ['Vaal_Spark', 'Vaal_Fireball', 'Soulrend_of_the_Spiral', 'Vaal_Spectral_Throw', 'Eye_of_Winter', 'Eye_of_Winter_of_Finality', 'Eye_of_Winter_of_Transience', 'Creeping_Frost', 'Creeping_Frost_of_Floes', 'Ice_Nova_of_Frostbolts', 'Vortex_of_Projection', 'Tornado', 'Tornado_of_Elemental_Turbulence', 'Bladefall', 'Ethereal_Knives_of_Lingering_Blades', 'Venom_Gyre', 'Void_Sphere', 'Void_Sphere_of_Rending', 'Firestorm', 'Firestorm_of_Pelting', 'Blade_Vortex', 'Blade_Vortex_of_the_Scythe', 'Vaal_Blade_Vortex', 'Vaal_Venom_Gyre']) {
    assert.equal(G.doSlug(s).statusNoJogo, 'funciona', `${s}: ${(G.doSlug(s).motivosNoJogo ?? []).join(' | ')}`);
  }
});

// ---------------------------------------------------------------- A3b-2: a Esfera do Vazio, a Tormenta Flamejante, o Vórtice de Lâminas

test('A3b-2: a Esfera do Vazio fica no lugar mirado, pulsa a cada 0,4 s pela duração e tolhe pela distância; uma por vez', { skip: SEM }, async () => {
  const d = G.objetoDaGema('Void_Sphere', 20, 0);
  assert.deepEqual([d.tipo, d.intervaloMs, d.tolhePct, d.max], ['esfera', 400, 39, 1]);
  assert.equal(G.objetoDaGema('Void_Sphere_of_Rending', 20, 0).intervaloMs, 250);
  const m = await montar('Wands/Driftwood_Wand', 'Void_Sphere', { onde: [[3, 0]] });
  assert.equal(danoEm(usar(m), m.bs[0]), 0);
  const [esf] = objetos(m.e, 'esfera');
  assert.deepEqual([esf.x, esf.y], [m.bs[0].x, m.bs[0].y]);
  assert.equal(esf.ate - m.e.hunt.clock, 5000);
  const ev = correr(m, 5100);
  assert.equal(acertosEm(ev, m.bs[0]), 12, '5000 ÷ 400 = 12 pulsos');
  // (aval do dono, 21/10: o Tolhimento agora é um estado próprio, como no PoE — `estados.tolhido`, não o `lento`)
  assert.equal(m.bs[0].estados?.tolhido?.pct, 39, 'colado nela, o Tolhimento todo');
});

test('A3b-2: a Tormenta Flamejante — um impacto a cada 0,15 s pela duração, em pontos sorteados da área; o primeiro com 325% mais dano', { skip: SEM }, async () => {
  const d = G.objetoDaGema('Firestorm', 20, 0);
  assert.deepEqual([d.intervaloMs, d.areaM, d.primeiroMaisPct, d.primeiroAreaPct, d.max], [150, 2.5, 325, 100, 3]);
  assert.equal(G.objetoDaGema('Firestorm_of_Pelting', 20, 20).max, 12, '10 + 2 da qualidade');
  const m = await montar('Wands/Driftwood_Wand', 'Firestorm', { onde: [[3, 0]] });
  usar(m);
  const [t] = objetos(m.e, 'tempestade');
  const n = Math.floor((t.ate - m.e.hunt.clock) / 150);
  // (o sorteio no meio: todos os impactos caem no centro, onde o bicho está)
  const ev = correr(m, 1500, { v: 0.5 });
  const golpes = ev.filter((x) => x.t === 'dmg' && x.uid === m.bs[0].uid && x.foe);
  assert.equal(golpes.length, n, `${n} impactos`);
  assert.ok(golpes[0].v / golpes[1].v > 3.5, `o primeiro com 325% mais: ${golpes[0].v} / ${golpes[1].v}`);
  assert.equal(ev.filter((x) => x.t === 'explosao').length, n);
});

test('A3b-2: o Vórtice de Lâminas — cada uso põe uma lâmina em você (até 10, 4 s); acerta a cada 0,6 s ÷ (1 + 30% × lâminas) com 30% mais por lâmina; a Vaal anda até os inimigos', { skip: SEM }, async () => {
  const d = G.objetoDaGema('Blade_Vortex', 20, 20);
  assert.deepEqual([d.baseMs, d.incPorLaminaPct, d.maisPorLaminaPct, d.max], [600, 35, 30, 10]);
  assert.equal(G3b.intervaloDoVortice(600, 30, 5), 240);
  const m = await montar('Wands/Driftwood_Wand', 'Blade_Vortex', { onde: [[1, 0]] });
  // (os usos no mesmo instante — a conjuração de cada um não conta aqui: nenhuma lâmina vence no meio)
  assert.equal(danoEm(usar(m), m.bs[0]), 0);
  const t0 = m.e.hunt.clock;
  for (let i = 0; i < 11; i++) { m.e.hunt.clock = t0; usar(m); }
  const [v] = objetos(m.e, 'vortice');
  assert.equal(objetos(m.e, 'vortice').length, 1, 'um vórtice só, em você');
  assert.equal(v.laminas.length, 10, 'até 10 lâminas');
  const ev = correr(m, 1000);
  const golpes = ev.filter((x) => x.t === 'dmg' && x.uid === m.bs[0].uid && x.foe);
  const esperados = Math.floor(1000 / G3b.intervaloDoVortice(600, 30, 10));
  assert.ok(golpes.length >= esperados && golpes.length <= esperados + 1, `com 10 lâminas, a cada 150 ms: ${golpes.length}`);
  const s = await montar('Wands/Driftwood_Wand', 'Blade_Vortex', { onde: [[1, 0]] });
  usar(s);
  const um = correr(s, 600).filter((x) => x.t === 'dmg' && x.uid === s.bs[0].uid && x.foe);
  assert.equal(um.length, 1, 'com 1 lâmina, a cada 0,6 ÷ 1,3 s');
  assert.ok(golpes[0].v / um[0].v > 2.5, `10 lâminas: 4× (1 + 300%) ÷ 1,3: ${golpes[0].v} / ${um[0].v}`);
  const va = await montar('Wands/Driftwood_Wand', 'Vaal_Blade_Vortex', { onde: [[4, 0]] });
  usar(va);
  const [vv] = objetos(va.e, 'vortice');
  assert.equal(vv.laminas.length, 10);
  assert.equal(vv.mov, 'persegue');
  correr(va, 1000);
  assert.ok(Math.abs(vv.x - va.bs[0].x) <= 2, 'a Vaal foi até o inimigo');
});

// ---------------------------------------------------------------- a revisão do A3b

test('revisão A3b: o golpe do objeto não depende de você estar perto (a bola parada longe de você acerta os 13); a Safe Zone barra o golpe e o chão', { skip: SEM }, async () => {
  const m = await montar('Wands/Driftwood_Wand', 'Ball_Lightning_of_Static', { onde: [[3, 0]] });
  usar(m);
  m.e.hunt.pos.x -= 12;
  assert.equal(acertosEm(correr(m, 2100), m.bs[0]), 13, 'com você a 15 casas da bola');
  // na Safe Zone (você nela): o chão do Vórtice não fere, e o guardado do Tornado não sai sem o golpe
  const v = await montar('Wands/Driftwood_Wand', 'Vortex', { onde: [[1, 0]] });
  usar(v);
  v.e.hunt.imune = true;
  assert.equal(danoEm(correr(v, 1000), v.bs[0]), 0);
  v.e.hunt.imune = false;
  assert.ok(danoEm(correr(v, 1000), v.bs[0]) > 0);
});

test('revisão A3b: os chãos da mesma gema não somam no mesmo bicho — só o mais forte queima (a Geada, o Vórtice)', { skip: SEM }, async () => {
  const m = await montar('Wands/Driftwood_Wand', 'Creeping_Frost', { onde: [[2, 0]] });
  usar(m);
  const porS = objetos(m.e, 'chao')[0].partes[0].porSegundo;
  usar(m);
  usar(m);
  const chaos = objetos(m.e, 'chao');
  assert.equal(chaos.length, 3);
  assert.ok(chaos.every((c) => c.x === m.bs[0].x && c.y === m.bs[0].y), 'os 3 no mesmo bicho');
  // (o primeiro tique paga o tempo das conjurações entre os usos; depois, 1 s)
  correr(m, 50);
  const levou = danoEm(correr(m, 1000).filter((x) => x.dot), m.bs[0]);
  assert.ok(Math.abs(levou - porS) <= 3, `1 s: o de um chão só (${levou} ≈ ${porS})`);
});

test('revisão A3b: a Bola Orbital do totem gira em volta DO TOTEM', { skip: SEM }, async () => {
  const m = await montar('Wands/Driftwood_Wand', ['Ball_Lightning_of_Orbiting', 'Spell_Totem_Support'], { onde: [[3, 0]], ligar: true });
  usar(m, 0);
  const [l] = (m.e.hunt.lacaios ?? []).filter((x) => x.tipo === 'totem' && x.hp > 0);
  sorte(0.5, () => Cacadas.golpeDoTotem(m.e, m.e.hunt, l, m.bs[0], Ficha.combate(m.e), PERSONAGEM, m.e.hunt.clock));
  const [bola] = objetos(m.e, 'bola');
  assert.deepEqual([bola.dono, bola.cx, bola.cy], ['totem', l.x, l.y]);
  m.e.hunt.pos.x -= 10;
  sorte(0.5, () => { for (let t = 0; t < 1500; t += 50) { m.e.hunt.clock += 50; Acoes.tiqueDasPlantadas(m.e, m.e.hunt, PERSONAGEM, []); if (bola.ate > m.e.hunt.clock) assert.ok(Math.max(Math.abs(bola.x - l.x), Math.abs(bola.y - l.y)) <= 2, `em volta do totem: ${bola.x},${bola.y}`); } });
});

test('revisão A3b: as Lâminas Giratórias soltam no máximo 30 por vez (o PoB); os outros seguem capturados', { skip: SEM }, async () => {
  assert.equal(G3b.ESPIRAL_VENENOSA.maxSoltos, 30);
  const m = await montar('Claws/Nailed_Fist', ['Vaal_Venom_Gyre', 'Whirling_Blades'], { onde: [[2, 0], [3, 3]], vocacao: 'knight', classe: 'Shadow' });
  usar(m, 0);
  assert.equal(objetos(m.e, 'capturado').length, 50);
  Object.assign(m.bs[1], { x: m.e.hunt.pos.x + 3, y: m.e.hunt.pos.y });
  const ev = usar(m, 1, 0.5);
  assert.equal(ev.filter((x) => x.t === 'shot').length >= 30, true);
  assert.equal(objetos(m.e, 'capturado').length, 20, '50 − os 30 soltos (o sorteio acima de 40%: nenhum fica)');
});

test('revisão A3b: a instância nova começa sem os objetos; os do aliado vão para a sua tela, recortados e com o nome dele', { skip: SEM }, async () => {
  const m = await montar('Wands/Driftwood_Wand', 'Bladefall', { onde: [[3, 0]] });
  usar(m);
  assert.ok(objetos(m.e).length > 0);
  if (m.e.hunt.instancia) {
    assert.equal(Cacadas.novaInstancia(m.e), true);
    assert.equal(m.e.hunt.poeObjetos, undefined, 'a instância nova sem os objetos da outra');
  }
  const a = await montar('Wands/Driftwood_Wand', 'Bladefall', { onde: [[3, 0]] });
  usar(a);
  const ve = { pos: { ...a.e.hunt.pos }, z: a.e.hunt.z, clock: a.e.hunt.clock + 500 };
  const doAliado = Cacadas.objetosDoPoeDoAliado(a.e.hunt, ve, 'Fulano');
  assert.equal(doAliado.length, 5);
  assert.ok(doAliado.every((o) => o.id.endsWith(':Fulano') && o.ate === objetos(a.e).find((x) => `${x.id}:Fulano` === o.id).ate + 500), 'o fim no relógio de quem vê');
  assert.deepEqual(Cacadas.objetosDoPoeDoAliado(a.e.hunt, { ...ve, pos: { x: ve.pos.x + 80, y: ve.pos.y } }, 'Fulano'), [], 'fora da sua tela');
  assert.deepEqual(Cacadas.objetosDoPoeDoAliado(a.e.hunt, { ...ve, z: (ve.z ?? 0) + 1 }, 'Fulano'), [], 'outro andar');
});
