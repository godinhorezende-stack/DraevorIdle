// O VOO DE VERDADE DOS PROJÉTEIS (lote "projetil", dono 02/11: "tem que estar tudo 100%"). Todo projétil VIAJA: sai de quem lança na velocidade do PoE (a do
// poedb da gema — "Projectile Speed: X metres per Second" —, ou a do ataque / da magia sem número) × a Velocidade de Projétil da ficha, anda pelo caminho dele e
// acerta o PRIMEIRO que encontra (o terreno o para; quem saiu da frente não leva). O golpe cai no tique mais perto da chegada (até meio tique, 125 ms, na hora).
// As contas puras em `itens-poe/projeteis-voo.mjs`; o registro dos projéteis no ar e os passos por tique em `hunt/voos.mjs`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const PV = await import('../systems/itens-poe/projeteis-voo.mjs');
const Voos = await import('../systems/hunt/voos.mjs');
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
const Acoes = await import('../systems/acoes.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const G = await import('../systems/itens-poe/gemas-poe.mjs');
const SP = await import('../systems/itens-poe/suportes-poe.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Poderes = await import('../systems/poderes.mjs');
const Secundarios = await import('../systems/skills/golpes-secundarios.mjs');
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
}

const sorte = (v, f) => { const o = Math.random; Math.random = () => v; try { return f(); } finally { Math.random = o; } };
const perto = (a, b, tol = 1) => Math.abs(a - b) <= tol;

/** O personagem com a arma e a ativa (nível 20), numa caçada; os bichos em `posicoes` ([dx, dy] de você), imortais (o mesmo de `area-no-impacto-a3c`). */
async function montar(arma, ativa, suportes = [], posicoes = [[1, 0]]) {
  const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Scion', sistema: 'poe' });
  const a = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: arma, raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
  const n = 1 + suportes.length;
  a.soquetes = { abertos: n, links: Array.from({ length: n - 1 }, () => true), gemas: Array(n).fill(null), cores: Array(n).fill('W') };
  e.equipment = { ...e.equipment, weapon: a };
  delete e.equipment.shield;
  e.inventory = [ativa, ...suportes].map((s) => GS.itemDaGema({ id: (G.doSlug(s) ?? SP.doSlug(s)).itemId, nivel: 20, xp: 0, raridade: 'comum' }));
  for (let i = 0; i < n; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: G.doSlug(ativa).acao, enabled: true, minMana: 0, conditions: [] };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(sorte(0.999, () => Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' })).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 1e7;
  e.maxHp = e.hp = 1e7;
  ModsPoe.definirGradeDoCombate(e.hunt, () => null);
  const modelo = structuredClone(e.hunt.monstros[0]);
  e.hunt.monstros.forEach((m, i) => {
    const p = posicoes[i];
    if (!p) return Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60 });
    const uid = m.uid;
    for (const k of Object.keys(m)) delete m[k];
    Object.assign(m, structuredClone(modelo), { uid, x: e.hunt.pos.x + p[0], y: e.hunt.pos.y + p[1], hp: 1e12, maxHp: 1e12, estados: {}, dots: [], resist: {}, mods: [], raridade: 'normal' });
  });
  return { e, bichos: e.hunt.monstros.slice(0, posicoes.length) };
}
/** Um uso no `alvo` com o sorteio fixo: os eventos do uso (o instante é `e.hunt.clock` depois do uso). */
function usar(e, alvo, v = 0.5) {
  e.hunt.clock += 10_000;
  const eventos = [];
  sorte(v, () => {
    const r = Acoes.disparar(e, e.hunt, PERSONAGEM, 0, alvo, { manual: true });
    assert.ok(r.ok, r.erro);
    eventos.push(...(r.eventos ?? []));
    if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; eventos.push(...(Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM) ?? [])); }
  });
  return eventos;
}
/** Os tiques do que está no ar, de 250 em 250 ms a partir de agora: `[{ ms, eventos }]`. */
function tiques(e, n = 8, v = 0.5) {
  const t0 = e.hunt.clock;
  const saida = [];
  for (let k = 1; k <= n; k++) { e.hunt.clock = t0 + 250 * k; saida.push({ ms: 250 * k, eventos: sorte(v, () => Voos.tique(e.hunt, e.hunt.clock)) }); }
  return saida;
}
const acertosEm = (ev, b) => ev.filter((x) => x.t === 'dmg' && x.foe && x.uid === b.uid);
/** O primeiro tique (ms depois do uso) em que `b` levou um acerto, ou 0 se foi no uso, ou null. */
function quandoAcertou(ev0, ts, b) {
  if (acertosEm(ev0, b).length) return 0;
  return ts.find((t) => acertosEm(t.eventos, b).length)?.ms ?? null;
}

// ---------------------------------------------------------------- as contas puras

test('a velocidade base vem do poedb (a coleção do jogo): a Bola de Fogo 10.4 m/s, a Flecha Dividida 32.6, o Disparo Congelante 3.75; sem número, o ataque 32.6 e a magia 10.4', { skip: SEM }, () => {
  assert.equal(PV.metrosDasProps(['Velocidade de Projétil: 10.4 metres per Second']), 10.4);
  assert.equal(G.vooDaGema('Fireball', 20).metros, 10.4);
  assert.equal(G.vooDaGema('Split_Arrow', 20).metros, 32.6);
  assert.equal(G.vooDaGema('Frostbolt', 20).metros, 3.75);
  assert.equal(G.vooDaGema('Ball_Lightning', 20).metros, 4, 'a Bola Relampejante: o projectileSpeed 40 do PoB em décimos de metro');
  assert.equal(G.vooDaGema('Ethereal_Knives', 20).metros, null, 'o poedb não publica a das Facas Etéreas');
  assert.equal(PV.metrosBase({ ataque: true }), 32.6);
  assert.equal(PV.metrosBase({ ataque: false }), 10.4);
  // (1 casa = 2 m; × o ProjectileSpeedMod)
  assert.equal(PV.casasPorSegundo(10.4, 1), 5.2);
  assert.ok(perto(PV.casasPorSegundo(10.4, 1.69), 8.788, 1e-9));
});

test('o perfil das linhas: a 2ª forma da Lança de Gelo (300% mais a partir de 2 casas), a desaceleração do Arremesso Espectral, o ziguezague do Raio Cinético, a espiral da Hélice e o orbe do Morto Volátil', { skip: SEM }, () => {
  assert.deepEqual(G.vooDaGema('Ice_Spear', 20).perfil.segundaForma, { casas: 2, maisPct: 300 });
  assert.equal(G.vooDaGema('Spectral_Throw_of_Materialising', 20).perfil.desacelera.reducaoPct, 30);
  assert.equal(G.vooDaGema('Spectral_Throw', 20).perfil.desacelera.reducaoPct, 0);
  assert.ok(G.vooDaGema('Kinetic_Bolt', 20).perfil.zigueZague >= 5);
  assert.equal(G.vooDaGema('Kinetic_Bolt_of_Fragmentation', 1).perfil.zigueZague, 3);
  assert.equal(G.vooDaGema('Spectral_Helix', 20).perfil.rotacoes, 4.25);
  assert.equal(G.vooDaGema('Volatile_Dead', 20, 20).perfil.orbeMaisPct, 40, 'a qualidade 20: +40%');
  assert.equal(G.vooDaGema('Fireball', 20).perfil.segundaForma, null);
  // (a Vaal Flecha Relampejante tem as mudanças de direção que acertam — as rebatidas —, não o ziguezague)
  assert.equal(G.vooDaGema('Vaal_Lightning_Arrow', 20).perfil.zigueZague, 0);
});

test('o tempo pelo caminho: reto (casas ÷ velocidade); a 2ª forma acelera depois de 2 casas; a desaceleração demora mais e a redução encurta; o ziguezague anda mais com mais mudanças', { skip: SEM }, () => {
  assert.equal(PV.tempoAte(5.2, 5.2, null), 1000);
  const lanca = { segundaForma: { casas: 2, maisPct: 300 } };
  // 2 casas a 5 c/s (400 ms) + 2 casas a 20 c/s (100 ms)
  assert.ok(perto(PV.tempoAte(4, 5, lanca), 500, 2));
  const st = { desacelera: { reducaoPct: 0 } };
  const mat = { desacelera: { reducaoPct: 30 } };
  assert.ok(PV.tempoAte(6, 16.3, st) > PV.tempoAte(6, 16.3, null));
  assert.ok(PV.tempoAte(6, 16.3, mat) < PV.tempoAte(6, 16.3, st), 'a desaceleração reduzida chega antes');
  // a volta acelera: os últimos 2 casas da volta são mais rápidos que as 2 casas antes da virada
  const ida = PV.tempoAte(7, 16.3, st) - PV.tempoAte(5, 16.3, st);
  const volta = PV.tempoAte(14, 16.3, st) - PV.tempoAte(12, 16.3, st);
  assert.ok(volta < ida);
  // o ziguezague (45°, sem passar de meia casa da reta): 3 mudanças 1,09× a reta, 5 mudanças 1,23×; a espiral: mais longo que a reta
  assert.ok(perto(PV.fatorDoCaminho({ zigueZague: 3 }, 7), 1.086, 0.01));
  assert.ok(perto(PV.fatorDoCaminho({ zigueZague: 5 }, 7), 1.229, 0.01));
  assert.ok(PV.fatorDoCaminho({ zigueZague: 8 }, 7) > PV.fatorDoCaminho({ zigueZague: 5 }, 7));
  assert.ok(PV.fatorDoCaminho({ rotacoes: 4.25 }, 7) > 1.3);
  assert.equal(PV.fatorDoCaminho(null, 7), 1);
  // a distância no tempo é o inverso do tempo
  assert.ok(perto(PV.distanciaNoTempo(PV.tempoAte(4, 5, lanca), 5, lanca), 4, 0.06));
  // o meio-ângulo da difusão: 30°; "reduzido em 50%": 15°
  assert.ok(perto(PV.meioAnguloDaDifusao(0), Math.PI / 6, 1e-9));
  assert.ok(perto(PV.meioAnguloDaDifusao(-50), Math.PI / 12, 1e-9));
});

test('os projéteis no ar: o contato em até meio tique sai na hora; o resto no tique em que chega; o terreno para; o teto de projéteis vivos', () => {
  const hunt = { clock: 0, instancia: null };
  const bicho = { x: 3, y: 0, hp: 1 };
  const golpes = [];
  const lancar = (b, v0, extra = {}) => Voos.lancar(hunt, { de: { x: 0, y: 0 }, para: { x: b.x, y: b.y }, alcance: 7, v0, agora: hunt.clock, colide: (c) => (b.hp > 0 && c.x === b.x && c.y === b.y ? b : null), aoContato: (m, casa, { adiado }) => { golpes.push({ m, adiado, t: hunt.clock }); return [{ t: 'dmg' }]; }, aoFim: (casa, { parede }) => { golpes.push({ fim: true, parede, casa }); return []; }, ...extra });
  // a 2,5 casas (a borda da casa) a 50 c/s: 50 ms — na hora
  let r = lancar(bicho, 50);
  assert.equal(r.noAr, false);
  assert.deepEqual(golpes.map((g) => g.adiado), [false]);
  // a 5 c/s: 500 ms — no tique de 500 (≤ 500 + 125)
  golpes.length = 0;
  r = lancar(bicho, 5);
  assert.equal(r.noAr, true);
  assert.equal(r.ms, 600, 'o tempo até o centro do alvo (o desenho na tela)');
  hunt.clock = 250;
  assert.deepEqual(Voos.tique(hunt, 250), []);
  hunt.clock = 500;
  const ev = Voos.tique(hunt, 500);
  assert.equal(golpes.length, 1);
  assert.equal(golpes[0].adiado, true);
  assert.equal(ev[0].voou, 1, 'os eventos da chegada levam a marca (a tela não espera o voo de novo)');
  // o terreno: a parede na casa 2 para o projétil (o fim na casa 1, a última livre)
  golpes.length = 0;
  hunt.clock = 1000;
  r = lancar(bicho, 50, { parede: (c) => c.x === 2 });
  assert.deepEqual(golpes, [{ fim: true, parede: true, casa: { x: 1, y: 0 } }]);
  // o teto: passou de VOO.maxVivos no ar, o novo anda o caminho todo na hora
  const longe = { x: 7, y: 0, hp: 1 };
  for (let i = 0; i < PV.VOO.maxVivos; i++) lancar(longe, 1);
  assert.equal(Voos.contar(hunt).voando, PV.VOO.maxVivos);
  golpes.length = 0;
  r = lancar(longe, 1);
  assert.equal(r.noAr, false);
  assert.equal(golpes.length, 1);
  Voos.limpar(hunt);
  assert.deepEqual(Voos.contar(hunt), { voando: 0, adiados: 0 });
});

// ---------------------------------------------------------------- no jogo

test('a Bola de Fogo voa: a 3 casas (10.4 m/s = 5,2 casas/s) o acerto não sai no uso; sai no tique de 500 ms (o contato a 2,5 casas, 481 ms); o tiro na tela leva os 577 ms do voo', { skip: SEM }, async () => {
  const { e, bichos: [alvo] } = await montar('Wands/Driftwood_Wand', 'Fireball', [], [[3, 0]]);
  const ev = usar(e, alvo);
  assert.equal(acertosEm(ev, alvo).length, 0);
  const tiro = ev.find((x) => x.t === 'shot');
  assert.equal(tiro.ms, 577);
  const ts = tiques(e);
  assert.equal(quandoAcertou(ev, ts, alvo), 500);
});

test('a Bola de Fogo colada (1 casa: 96 ms) acerta no uso, como antes', { skip: SEM }, async () => {
  const { e, bichos: [alvo] } = await montar('Wands/Driftwood_Wand', 'Fireball', [], [[1, 0]]);
  const ev = usar(e, alvo);
  assert.ok(acertosEm(ev, alvo).length > 0);
});

test('o primeiro do caminho leva: o bicho entre você e o alvo é acertado no lugar dele', { skip: SEM }, async () => {
  const { e, bichos: [alvo, naFrente] } = await montar('Wands/Driftwood_Wand', 'Fireball', [], [[3, 0], [2, 0]]);
  const ev = usar(e, alvo);
  const ts = tiques(e);
  assert.equal(quandoAcertou(ev, ts, naFrente), 250, 'o da frente: o contato a 1,5 casa (288 ms) — o tique de 250 (≤ 375)');
  assert.equal(acertosEm([...ev, ...ts.flatMap((t) => t.eventos)], alvo).filter((x) => x.fonte !== 'impacto').length, 0, 'o de trás não leva o projétil (a área do impacto, sim)');
});

test('quem sai da frente não leva: o alvo que andou para longe do caminho durante o voo não é acertado', { skip: SEM }, async () => {
  const { e, bichos: [alvo] } = await montar('Wands/Driftwood_Wand', 'Fireball', [], [[3, 0]]);
  const ev = usar(e, alvo);
  alvo.y += 3;
  const ts = tiques(e, 10);
  assert.equal(quandoAcertou(ev, ts, alvo), null);
});

test('o terreno para o projétil: a parede no caminho e ninguém é acertado', { skip: SEM }, async () => {
  const { e, bichos: [alvo] } = await montar('Wands/Driftwood_Wand', 'Fireball', [], [[3, 0]]);
  const parede = `${e.hunt.pos.x + 2},${e.hunt.pos.y}`;
  ModsPoe.definirGradeDoCombate(e.hunt, () => ({ andavel: { has: (k) => k !== parede } }));
  const ev = usar(e, alvo);
  const ts = tiques(e, 10);
  assert.equal(quandoAcertou(ev, ts, alvo), null);
});

test('a Velocidade de Projétil encurta o voo: com o Suporte de Projéteis Mais Rápidos (69% aumentada) a Bola de Fogo a 3 casas chega no tique de 250 (sem ele, 500)', { skip: SEM }, async () => {
  const sem = await montar('Wands/Driftwood_Wand', 'Fireball', [], [[3, 0]]);
  const ev0 = usar(sem.e, sem.bichos[0]);
  // 2,5 casas a 5,2 c/s = 481 ms → o tique de 500 (> 375, ≤ 625)
  assert.equal(quandoAcertou(ev0, tiques(sem.e), sem.bichos[0]), 500);
  const com = await montar('Wands/Driftwood_Wand', 'Fireball', ['Faster_Projectiles_Support'], [[3, 0]]);
  const ev1 = usar(com.e, com.bichos[0]);
  // 2,5 casas a 5,2 × 1,69 = 8,79 c/s = 284 ms → o tique de 250 (≤ 375)
  assert.equal(quandoAcertou(ev1, tiques(com.e), com.bichos[0]), 250);
});

test('a perfuração e a volta no caminho real: a Bola de Fogo atravessa o 1º (no uso), chega no 2º a 3 casas (577 ms) e volta no 1º (3 + 2 casas, 962 ms)', { skip: SEM }, async () => {
  const { e, bichos: [a, b] } = await montar('Wands/Driftwood_Wand', 'Fireball', ['Pierce_Support', 'Returning_Projectiles_Support'], [[1, 0], [3, 0]]);
  const ev = usar(e, a);
  assert.ok(acertosEm(ev, a).length > 0, 'o 1º: 0,5 casa = 96 ms — no uso');
  const ts = tiques(e, 6);
  assert.equal(quandoAcertou([], ts, b), 500, 'o 2º: 3 casas a 5,2 c/s');
  const daVolta = ts.find((t) => acertosEm(t.eventos, a).length);
  assert.equal(daVolta?.ms, 1000, 'a volta no 1º: 5 casas a 5,2 c/s = 962 ms');
});

test('o LEQUE: os projéteis a mais saem a 10° um do outro e acertam o primeiro do caminho — o que está atrás de você não leva', { skip: SEM }, async () => {
  const { e, bichos: [alvo, aoLado, atras] } = await montar('Bows/Crude_Bow', 'Split_Arrow', [], [[4, 0], [4, 1], [-3, 0]]);
  const ev = usar(e, alvo);
  const todos = [...ev, ...tiques(e).flatMap((t) => t.eventos)];
  assert.ok(acertosEm(todos, alvo).length > 0);
  assert.ok(acertosEm(todos, aoLado).length > 0, 'o do lado do alvo (14°) está no leque');
  assert.equal(acertosEm(todos, atras).length, 0, 'o de trás não');
});

test('o leque e a difusão no resolvedor: com o voo, os filhos saem nos ângulos da difusão (o "reduzido em 50%" fecha o ângulo)', () => {
  const TAGS = ['projectile', 'single', 'hit'];
  const b = (uid, x, y) => ({ uid, x, y, hp: 100 });
  const alvo = b('a', 3, 0);
  // os filhos da difusão a ±30° a partir do alvo: um bicho a 30° (5, 1) e outro a 4 casas atrás de você (−4, 0) — perto do ponto, fora do ângulo
  const noAngulo = b('n', 6, 2);
  const longe = b('l', 0, 0 + 4);
  const r = Secundarios.resolver({ efeito: { bifurcar: 2, difusaoMeioAngulo: Math.PI / 6 }, tags: TAGS, origem: { x: 0, y: 0 }, alvo, atingidos: [alvo], vivos: [alvo, noAngulo, longe], alcance: 7, rng: () => 0.99, voo: true });
  const difundidos = r.golpes.filter((g) => g.tipo === 'bifurcacao').map((g) => g.bicho.uid);
  assert.deepEqual(difundidos, ['n']);
  // sem o voo (o modo clássico): os mais perto do ponto, a até 4 casas
  const r0 = Secundarios.resolver({ efeito: { bifurcar: 2 }, tags: TAGS, origem: { x: 0, y: 0 }, alvo, atingidos: [alvo], vivos: [alvo, noAngulo, longe], alcance: 7, rng: () => 0.99 });
  assert.deepEqual(r0.golpes.filter((g) => g.tipo === 'bifurcacao').map((g) => g.bicho.uid).sort(), ['l', 'n']);
  // as distâncias andadas: o filho no (6, 2) andou 3 + √(9 + 4)
  const g = r.golpes.find((x) => x.bicho === noAngulo);
  assert.ok(perto(g.dist, 3 + Math.hypot(3, 2), 1e-9));
});

test('a magia do MONSTRO voa: você que sai do caminho não leva; parado, leva no tique em que chega', { skip: SEM }, async () => {
  const { e, bichos: [bicho] } = await montar('Wands/Driftwood_Wand', 'Fireball', [], [[4, 0]]);
  const a = { tipo: 'magia', forma: 'alvo', elemento: 'fire', min: 50, max: 50, tiro: 4, alcance: 7, chance: 100, intervalo: 1000 };
  const ctx = (ev) => ({ estado: e, hunt: e.hunt, personagem: PERSONAGEM, bicho, eventos: ev, agora: e.hunt.clock, ficha: Ficha.combate(e), temEscudo: false });
  // parado: a 4 casas (3,5 até a sua borda a 5,2 c/s = 673 ms) → o tique de 750
  const hp0 = e.hp;
  const ev = [];
  sorte(0.5, () => Poderes.voarDoBicho(ctx(ev), a, null));
  assert.equal(e.hp, hp0, 'não no lançamento');
  assert.ok(ev.find((x) => x.t === 'shot')?.ms > 0);
  const ts = tiques(e, 4);
  assert.ok(e.hp < hp0, 'chegou');
  assert.equal(ts.findIndex((t) => t.eventos.some((x) => x.t === 'dmg' && !x.foe)), 2, 'no tique de 750 ms');
  // andando para o lado: não leva
  const hp1 = e.hp;
  sorte(0.5, () => Poderes.voarDoBicho(ctx([]), a, null));
  e.hunt.pos.y += 2;
  tiques(e, 6);
  assert.equal(e.hp, hp1);
});

test('as linhas de trajetória das gemas valem (saem das "não se aplicam"); a árvore e a tradução: a velocidade "mais/menos", o ângulo da difusão e o Altar de Aceleração', { skip: SEM }, async () => {
  for (const [slug, l] of [['Ice_Spear', 'A Segunda forma possui 300 % mais Velocidade de Projétil'], ['Spectral_Throw_of_Materialising', 'Desaceleração do Projétil reduzida em 30 %'], ['Kinetic_Bolt', 'Projéteis mudam de direção 5 vezes'], ['Spectral_Helix', 'Gira por 4.25 rotações'], ['Volatile_Dead', 'Velocidade de Movimento do Orbe aumentada em 40 %']]) {
    assert.equal(G.ehLinhaQueNaoSeAplica(l), false, l);
    assert.equal(PV.ehLinhaDoVoo(slug, l), true, l);
  }
  // a Mina de Fumaça (de outro assunto) — aval do dono 03/11: 100% — combate, o jogo Re-arma as Minas e a linha vale (antes true)
  assert.equal(G.ehLinhaQueNaoSeAplica('Minas não podem ser Re-armadas'), false);
  const { traduzirLinha } = await import('../systems/itens-poe/arvore.mjs');
  assert.deepEqual(traduzirLinha('15% mais Velocidade de Projéteis').efeitos, [{ add: 'proj_vel_mais', valor: 15 }]);
  assert.deepEqual(traduzirLinha('15% menos Velocidade de Projéteis').efeitos, [{ add: 'proj_vel_mais', valor: -15 }]);
  assert.deepEqual(traduzirLinha('Ângulo da Difusão de Projéteis reduzido em 50%').efeitos, [{ add: 'proj_difusao_angulo_inc', valor: -50 }]);
  const { readFileSync } = await import('node:fs');
  const arvore = readFileSync(new URL('../gamedata/itens-poe/arvore-poe.json', import.meta.url), 'utf8');
  assert.equal(arvore.includes('o projétil do jogo vai direto ao alvo'), false, 'a árvore não tem mais a nota');
  const traducao = readFileSync(new URL('../gamedata/itens-poe/traducao.json', import.meta.url), 'utf8');
  assert.equal(traducao.includes('o projétil do jogo vai direto ao alvo'), false, 'a tradução não tem mais a nota');
  // (o Altar de Aceleração do poedb: "80% increased Projectile Speed")
  const Cond = await import('../systems/itens-poe/condicoes-poe.mjs');
  assert.equal(Cond.BUFFS.altarAceleracao.af.projectile_speed, 80);
  assert.equal(Cond.BUFFS.altarAceleracao.af.action_speed, 50);
});

test('o "15% mais Velocidade de Projéteis" da ficha multiplica o ProjectileSpeedMod do uso', { skip: SEM }, async () => {
  const { e } = await montar('Wands/Driftwood_Wand', 'Fireball', [], [[3, 0]]);
  const entry = Acoes.POR_ID_PUBLICO(G.doSlug('Fireball').acao);
  const ef = GS.efeitoNaSkill(e, entry.id);
  const antes = Acoes.velocidadeDoProjetil(e, entry, ef).mod;
  const combate = Ficha.combate(e);
  combate.afPoe = { ...(combate.afPoe ?? {}), proj_vel_mais: 15 };
  const depois = Acoes.velocidadeDoProjetil(e, entry, ef).mod;
  assert.ok(perto(depois / antes, 1.15, 1e-9));
});
