// (lote PR3, dono 21/10) AS GEMAS ATIVAS DE PROJÉTIL QUE GERAM OUTROS GOLPES (o plano do grupo, as recomendações aceitas): os projéteis secundários do Tiro
// Tornado, a 2ª forma da Lança Gélida, as explosões da Explosão Cinética (e a da Ramificação, com os projéteis a mais virando explosões e o Físico pela Mana), o
// rodízio e o "menos após o primeiro acerto" do Aço Perfurador, os esporos por flecha da Flecha Virulenta da Ameaça, as erupções a mais da Fissura Vulcânica Vaal
// e o Pacto de Beidat (o buff que fortalece as próximas magias). Os números são os do PoE (o PoB, o poedb); os sorteios ficam travados.
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
const PR3 = await import('../systems/itens-poe/gemas-pr3.mjs');
const L = await import('../systems/itens-poe/linhas-das-gemas.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Secundarios = await import('../systems/skills/golpes-secundarios.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');

let J;
let gerarPeca;
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
const perto = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

/** Roda `fn` com o `Math.random` travado em `v`. */
function travado(v, fn) {
  const antes = Math.random;
  Math.random = () => v;
  try { return fn(); } finally { Math.random = antes; }
}
/** O personagem com a gema na arma, numa caçada; o alvo imortal a `dx` casas e os outros longe. */
async function montar(slug, { nivel = 20, qualidade = 0, arma = 'Wands/Driftwood_Wand', dx = 1 } = {}) {
  J ??= await import('../systems/itens-poe/jogo.mjs');
  gerarPeca ??= (await import('../systems/itens-poe/gerar.mjs')).gerarPeca;
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Scion', sistema: 'poe' });
  const a = peca(arma);
  a.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
  e.equipment = { ...e.equipment, weapon: a };
  delete e.equipment.shield;
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
  // (o alvo de treino não esquiva — os acertos dos ataques não erram; sem armadura: as razões são as do dano antes da redução)
  Object.assign(b, { x: e.hunt.pos.x + dx, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12, estados: {}, resist: {}, armaduraPct: -100 });
  return { e, b, resto, entry: Acoes.POR_ID_PUBLICO(G.doSlug(slug).acao) };
}
/** Usa a gema no alvo (com a conjuração concluída), com o sorteio travado. */
function usar(e, b, v = 0) {
  return travado(v, () => {
    const x = Acoes.disparar(e, e.hunt, PERSONAGEM, 0, b, { manual: true });
    // (a magia conjura: os eventos do uso são os do fim da conjuração)
    if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; return { ...x, eventos: Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM) }; }
    return x;
  });
}
/** Um outro monstro imortal em `(dx, dy)` de você. */
const outro = (e, m, dx, dy) => Object.assign(m, { x: e.hunt.pos.x + dx, y: e.hunt.pos.y + dy, hp: 1e12, maxHp: 1e12, estados: {}, resist: {}, armaduraPct: -100 });
/** Os valores dos golpes (`dmg`) em `m`, na ordem. */
const golpesEm = (r, m) => (r.eventos ?? []).filter((v) => v.t === 'dmg' && v.uid === m.uid).map((v) => v.v);
const efeitoDe = (slug, q = 0) => Acoes.comOsAlvosDaGema({ id: 'x', poeGema: { slug } }, { nivel: 20, qualidade: q });

// ---------------------------------------------------------------- o status e as linhas

test('PR3: as gemas do lote saem de parcial (as linhas do PoE têm leitor)', { skip: SEM }, () => {
  for (const s of ['Tornado_Shot', 'Ice_Spear', 'Kinetic_Blast', 'Kinetic_Blast_of_Clustering', 'Scourge_Arrow_of_Menace', 'Lancing_Steel', 'Lancing_Steel_of_Spraying', 'Vaal_Volcanic_Fissure', 'Pact_of_Beidat']) {
    const r = G.REGISTRO.get(s);
    assert.deepEqual([s, r.statusNoJogo, r.motivosNoJogo], [s, 'funciona', []]);
  }
});

test('PR3: os números das linhas no nível 20 (e a qualidade), como o PoB e o poedb', { skip: SEM }, () => {
  assert.deepEqual(G.tornadoDaGema('Tornado_Shot', 20), { n: 3 });
  assert.equal(G.tornadoDaGema('Tornado_Shot_of_Cloudburst', 20), null);
  assert.deepEqual(G.segundaFormaDaGema('Ice_Spear', 20), { casas: 2, critIncPct: 600, critMultPct: 49 });
  assert.deepEqual(G.segundaFormaDaGema('Ice_Spear', 20, 20), { casas: 2, critIncPct: 600, critMultPct: 89 });
  assert.deepEqual(G.cineticaDaGema('Kinetic_Blast', 20), { n: 4, menosAreaPct: 40, raioM: 1.4, raioSecM: 2, extrasNasExplosoes: false });
  assert.equal(G.cineticaDaGema('Kinetic_Blast', 20, 20).n, 5);
  assert.deepEqual(G.cineticaDaGema('Kinetic_Blast_of_Clustering', 20), { n: 3, menosAreaPct: 0, raioM: 1.9, raioSecM: 2.8, extrasNasExplosoes: true });
  assert.deepEqual([G.lancaDaGema('Lancing_Steel', 20), G.lancaDaGema('Lancing_Steel_of_Spraying', 20)], [{ menosPct: 60, raio: 1 }, { menosPct: 90, raio: 1 }]);
  assert.deepEqual(G.esporosPorFlechaDaGema('Scourge_Arrow_of_Menace', 20), { porFlecha: 1, flechas: 4, menosPct: 50, raio: 2 });
  assert.equal(G.esporosPorFlechaDaGema('Scourge_Arrow_of_Menace', 20, 20).flechas, 5);
  assert.equal(G.esporosPorFlechaDaGema('Scourge_Arrow', 20), null);
  assert.equal(G.erupcoesDaGema('Vaal_Volcanic_Fissure', 20), 2);
  assert.equal(G.erupcoesDaGema('Volcanic_Fissure', 20), 0);
  assert.deepEqual(G.pactoDaGema('Pact_of_Beidat', 20), { magias: 6, maisPct: 35, espiral: 8, feixes: 6, projeteis: 6 });
  assert.equal(G.pactoDaGema('Pact_of_Beidat', 20, 20).magias, 8);
  // o Físico adicional pela Mana da Ramificação (o PoB: PhysicalMin/Max BASE pelo PercentStat Mana)
  assert.deepEqual(L.atributosDaLinha('Causa Dano Físico Adicional igual a 15 % da Mana Máxima'), { 'added_physical_dmg_min%manaMax:1': 0.15, 'added_physical_dmg_max%manaMax:1': 0.15 });
});

test('PR3 no uso: o Tiro Tornado e o Aço Perfurador marcam o efeito; na Explosão Cinética da Ramificação os projéteis adicionais viram explosões', { skip: SEM }, () => {
  assert.deepEqual(efeitoDe('Tornado_Shot').tornado, { n: 3 });
  assert.deepEqual(efeitoDe('Lancing_Steel').lanca, { menosPct: 60, raio: 1 });
  assert.deepEqual(efeitoDe('Kinetic_Blast').cinetica, { n: 4, menosAreaPct: 40, raioM: 1.4, raioSecM: 2 });
  assert.deepEqual(PR3.cineticaNoUso({ alvosExtras: 2 }, G.cineticaDaGema('Kinetic_Blast_of_Clustering', 20)), { alvosExtras: 0, cinetica: { n: 5, menosAreaPct: 0, raioM: 1.9, raioSecM: 2.8 } });
  assert.deepEqual(PR3.cineticaNoUso({ alvosExtras: 2 }, G.cineticaDaGema('Kinetic_Blast', 20)).alvosExtras, 2);
  // os raios em casas no uso: os metros × √ da Área ÷ 2, a fração como a chance (o sorteio 0,3: 0,7 → 1; 1,0 → 1)
  const k = Acoes.cineticaDoUso({ poeGema: { slug: 'Kinetic_Blast' } }, efeitoDe('Kinetic_Blast'), 0, () => 0.3);
  assert.deepEqual(k, { n: 4, pct: 60, raio: 1, raioSec: 1 });
  assert.deepEqual(Acoes.cineticaDoUso({ poeGema: { slug: 'Kinetic_Blast' } }, efeitoDe('Kinetic_Blast'), 0, () => 0.9), { n: 4, pct: 60, raio: 0, raioSec: 1 });
});

// ---------------------------------------------------------------- o motor dos projéteis

test('PR3: o Tiro Tornado — o tiro atravessa até o alvo e lá solta os 3 secundários, um em cada fatia do círculo; não acertam o próprio alvo', { skip: SEM }, () => {
  const alvo = { uid: 'a', x: 3, y: 0, hp: 10 };
  const noCaminho = { uid: 'b', x: 1, y: 0, hp: 10 };
  const atras = { uid: 'c', x: 6, y: 0, hp: 10 };
  // (o sorteio 0: os ângulos 0, 2π/3 e 4π/3 a partir do rumo — o leste; o de trás, no leste do alvo)
  const r = Secundarios.resolver({ efeito: { tornado: { n: 3 }, perfurar: 0, encadear: 0 }, tags: ['projectile', 'hit'], origem: { x: 0, y: 0 }, alvo, atingidos: [alvo], vivos: [alvo, noCaminho, atras], alcance: 7, rng: () => 0 });
  assert.deepEqual(r.golpes.map((g) => [g.bicho.uid, g.tipo, g.pct]), [['b', 'perfuracao', 100], ['c', 'secundario', 100]]);
  assert.equal(r.emitidos.filter((p) => p.tipo === 'secundario').length, 3);
  assert.ok(r.emitidos.filter((p) => p.tipo === 'secundario').every((p) => p.de.x === 3 && p.de.y === 0));
  // as fatias: o k-ésimo de N no pedaço 2π/N × [k, k + 1)
  assert.ok(perto(PR3.anguloDoSecundario(1, 3, 0, () => 0.5), Math.PI));
  // os projéteis adicionais são mais tiros, cada um com os seus secundários
  const r2 = Secundarios.resolver({ efeito: { tornado: { n: 3 }, alvosExtras: 1 }, tags: ['projectile', 'hit'], origem: { x: 0, y: 0 }, alvo, atingidos: [alvo], vivos: [alvo], alcance: 7, rng: () => 0 });
  assert.equal(r2.emitidos.filter((p) => p.tipo === 'secundario').length, 6);
});

test('PR3: a Explosão Cinética — no impacto, a explosão do ponto e as N adicionais (no raio secundário) acertam todos dentro, com o "menos Dano em Área"', { skip: SEM }, () => {
  const alvo = { uid: 'a', x: 3, y: 0, hp: 10 };
  const ao = { uid: 'b', x: 4, y: 0, hp: 10 };
  const longe = { uid: 'c', x: 3, y: 5, hp: 10 };
  // (o sorteio 0,5: o ponto sorteado no quadrado é o próprio centro)
  const r = Secundarios.resolver({ efeito: {}, tags: ['projectile', 'hit'], origem: { x: 0, y: 0 }, alvo, atingidos: [alvo], vivos: [alvo, ao, longe], alcance: 7, rng: () => 0.5, cinetica: { n: 2, pct: 60, raio: 1, raioSec: 1 } });
  const ex = r.golpes.filter((g) => g.cinetica);
  assert.deepEqual(ex.map((g) => [g.bicho.uid, g.pct]), [['a', 60], ['b', 60], ['a', 60], ['b', 60], ['a', 60], ['b', 60]]);
  assert.equal(r.explosoes.filter((x) => x.cinetica).length, 3);
  // o ponto da explosão a mais: sorteado no quadrado do raio secundário
  assert.deepEqual(PR3.pontoDaExplosao({ x: 3, y: 0 }, 2, () => 0), { x: 1, y: -2 });
  assert.deepEqual(PR3.pontoDaExplosao({ x: 3, y: 0 }, 2, () => 0.999), { x: 5, y: 2 });
  // o projétil que erra explode no fim do voo (a exceção 5)
  const r2 = Secundarios.resolver({ efeito: { alvosExtras: 1 }, tags: ['projectile', 'hit'], origem: { x: 0, y: 0 }, alvo, atingidos: [alvo], vivos: [alvo], alcance: 7, rng: () => 0.5, cinetica: { n: 1, pct: 60, raio: 0, raioSec: 0 } });
  assert.equal(r2.explosoes.filter((x) => x.cinetica).length, 4);
});

test('PR3: o Aço Perfurador — os projéteis em rodízio no alvo e nos vizinhos dele; os acertos após o primeiro em cada inimigo com 60% menos', { skip: SEM }, () => {
  const alvo = { uid: 'a', x: 3, y: 0, hp: 10 };
  const viz = { uid: 'b', x: 3, y: 1, hp: 10 };
  const longe = { uid: 'c', x: 0, y: 5, hp: 10 };
  const r = Secundarios.resolver({ efeito: { projeteisBase: 4, lanca: { menosPct: 60, raio: 1 } }, tags: ['projectile', 'hit'], origem: { x: 0, y: 0 }, alvo, atingidos: [alvo], vivos: [alvo, viz, longe], alcance: 7, rng: () => 0 });
  assert.deepEqual(r.golpes.map((g) => [g.bicho.uid, Math.round(g.pct)]), [['b', 100], ['a', 40], ['b', 40]]);
  // sozinho: todos no alvo, o direto inteiro e os outros 3 com −60% (o PoB: a média "All Projectiles Hit" = 1 + 3 × 0,4)
  const s = Secundarios.resolver({ efeito: { projeteisBase: 4, lanca: { menosPct: 60, raio: 1 } }, tags: ['projectile', 'hit'], origem: { x: 0, y: 0 }, alvo, atingidos: [alvo], vivos: [alvo], alcance: 7, rng: () => 0 });
  assert.ok(perto(1 + s.golpes.reduce((t, g) => t + g.pct, 0) / 100, 2.2));
  assert.deepEqual(PR3.menosAposOPrimeiro([{ bicho: alvo, pct: 100 }, { bicho: viz, pct: 50 }, { bicho: viz, pct: 50 }], 90, []).map((g) => Math.round(g.pct * 1e6) / 1e6), [100, 50, 5]);
});

// ---------------------------------------------------------------- no jogo

test('PR3 no jogo: a Explosão Cinética — o alvo leva o projétil e as 5 explosões (−40% cada); o vizinho só as explosões', { skip: SEM }, async () => {
  const { e, b, resto } = await montar('Kinetic_Blast', { dx: 3 });
  const m2 = outro(e, resto[0], 4, 0);
  // (o sorteio 0,3: o raio 1,4 m → 1 casa; o secundário 2 m → 1; os pontos no centro)
  const r = usar(e, b, 0.3);
  assert.ok(r.ok, r.erro);
  const noAlvo = golpesEm(r, b);
  const noVizinho = golpesEm(r, m2);
  assert.equal(noAlvo.length, 6);
  assert.equal(noVizinho.length, 5);
  const proj = noAlvo[0];
  for (const v of noVizinho) assert.ok(perto(v / proj, 0.6, 0.15), `explosão ${v} / projétil ${proj}`);
});

test('PR3 no jogo: a Lança Gélida — o acerto a 2 casas ou mais é da 2ª forma (+600% de Chance e +49% de Multiplicador de crítico); a 1 casa, da 1ª', { skip: SEM }, async () => {
  // (o sorteio 0,45: a Chance de 7% da 1ª forma não critica; a da 2ª forma, 7% × 7 = 49%, sim)
  const perto1 = await montar('Ice_Spear', { dx: 1 });
  const r1 = usar(perto1.e, perto1.b, 0.45);
  assert.ok(r1.ok, r1.erro);
  const longe = await montar('Ice_Spear', { dx: 3 });
  const r3 = usar(longe.e, longe.b, 0.45);
  assert.ok(r3.ok, r3.erro);
  const [d1] = golpesEm(r1, perto1.b);
  const [d3] = golpesEm(r3, longe.b);
  assert.ok(d1 > 0 && d3 > 0);
  const mult = Ficha.combate(longe.e).critMultiplier ?? 1.5;
  assert.ok(perto(d3 / d1, mult + 0.49, 0.05), `razão ${d3 / d1}, multiplicador ${mult} + 0,49`);
  assert.ok(PR3.naSegundaForma({ casas: 2 }, { x: 0, y: 0 }, { x: 2, y: 1 }) && !PR3.naSegundaForma({ casas: 2 }, { x: 0, y: 0 }, { x: 1, y: 1 }));
});

test('PR3 no jogo: o Tiro Tornado — o secundário acerta quem está além do alvo; o do caminho leva o tiro que atravessa', { skip: SEM }, async () => {
  const { e, b, resto } = await montar('Tornado_Shot', { arma: 'Bows/Crude_Bow', dx: 3 });
  const noCaminho = outro(e, resto[0], 2, 0);
  const alem = outro(e, resto[1], 5, 0);
  const r = usar(e, b, 0);
  assert.ok(r.ok, r.erro);
  assert.equal(golpesEm(r, b).length, 1);
  assert.equal(golpesEm(r, noCaminho).length, 1);
  assert.equal(golpesEm(r, alem).length, 1);
});

test('PR3 no jogo: a Flecha Virulenta da Ameaça — a flecha deixa 1 esporo, que dispara 4 Flechas de Espinho com 50% menos Dano', { skip: SEM }, async () => {
  const { e, b } = await montar('Scourge_Arrow_of_Menace', { arma: 'Bows/Crude_Bow', dx: 3 });
  const r = usar(e, b, 0);
  assert.ok(r.ok, r.erro);
  const g = golpesEm(r, b);
  assert.equal(g.length, 5);
  for (const v of g.slice(1)) assert.ok(perto(v / g[0], 0.5, 0.15), `espinho ${v} / flecha ${g[0]}`);
  assert.equal(r.eventos.filter((v) => v.t === 'fx' && v.uid === 'player').length, 1);
});

test('PR3 no jogo: a Fissura Vulcânica Vaal — 2 erupções a mais, cada uma no vivo mais perto da anterior (o mesmo, se for o único)', { skip: SEM }, async () => {
  const so = await montar('Vaal_Volcanic_Fissure', { arma: 'One_Hand_Maces/Driftwood_Club', dx: 2 });
  const r1 = usar(so.e, so.b, 0);
  assert.ok(r1.ok, r1.erro);
  assert.equal(golpesEm(r1, so.b).length, 3);
  const dois = await montar('Vaal_Volcanic_Fissure', { arma: 'One_Hand_Maces/Driftwood_Club', dx: 2 });
  const m2 = outro(dois.e, dois.resto[0], 4, 0);
  const r2 = usar(dois.e, dois.b, 0);
  assert.ok(r2.ok, r2.erro);
  assert.deepEqual([golpesEm(r2, dois.b).length, golpesEm(r2, m2).length], [2, 1]);
});

test('PR3 no jogo: o Pacto de Beidat — o uso fortalece as próximas 6 magias; a de projétil ganha 35% mais dano e 6 projéteis em círculo, e gasta uma', { skip: SEM }, async () => {
  const p = await montar('Pact_of_Beidat', { dx: 2 });
  const rp = usar(p.e, p.b, 0);
  assert.ok(rp.ok, rp.erro);
  assert.equal(p.b.hp, 1e12, 'o Pacto não causa dano');
  assert.deepEqual(p.e.hunt.poePacto, { acao: p.entry.id, restantes: 6, maisPct: 35, espiral: 8, feixes: 6, projeteis: 6 });
  // a Bola de Fogo sem e com o Pacto (o mesmo sorteio)
  const f = await montar('Fireball', { dx: 2 });
  const sem = usar(f.e, f.b, 0);
  assert.ok(sem.ok, sem.erro);
  const [d0] = golpesEm(sem, f.b);
  f.e.hunt.clock += 10_000;
  f.e.hunt.poePacto = { ...p.e.hunt.poePacto };
  const com = usar(f.e, f.b, 0);
  assert.ok(com.ok, com.erro);
  const [d1] = golpesEm(com, f.b);
  assert.ok(perto(d1 / d0, 1.35, 0.05), `razão ${d1 / d0}`);
  assert.equal(com.eventos.filter((v) => v.t === 'shot').length, 7);
  assert.equal(f.e.hunt.poePacto.restantes, 5);
  // o que não se fortalece: a canalizada, o ataque, o próprio Pacto, a magia sem projétil, área no local ou feixe
  const pc = { restantes: 1, maisPct: 35, espiral: 8, feixes: 6, projeteis: 6 };
  assert.equal(PR3.pactoNoUso(pc, { tags: ['magia', 'canalizar', 'projetil'] }), null);
  assert.equal(PR3.pactoNoUso(pc, { tags: ['ataque', 'projetil'] }), null);
  assert.equal(PR3.pactoNoUso(pc, { tags: ['magia', 'pacto', 'projetil'] }), null);
  assert.equal(PR3.pactoNoUso(pc, { tags: ['magia', 'area'] }), null);
  assert.deepEqual(PR3.pactoNoUso(pc, { tags: ['magia', 'area'], noLocal: true }), { projeteis: 0, espiral: 8, feixes: 0, maisPct: 35 });
  assert.deepEqual(PR3.pactoNoUso(pc, { tags: ['magia', 'projetil', 'ricochete'], cadeia: true }), { projeteis: 0, espiral: 0, feixes: 6, maisPct: 35 });
  assert.equal(PR3.pactoNoUso({ ...pc, restantes: 0 }, { tags: ['magia', 'projetil'] }), null);
  // a espiral: 8 centros em volta, cada um a raio × (1 + k/8)
  const cs = PR3.centrosDaEspiral({ x: 0, y: 0 }, 8, 2, 0);
  assert.equal(cs.length, 8);
  assert.deepEqual(cs[7], { x: 4, y: 0 });
});

test('PR3 no jogo: o Pacto gasta a última magia e some; o Arco fortalecido salta mais 6 vezes', { skip: SEM }, async () => {
  const a = await montar('Arc', { dx: 1 });
  // (uma fila de inimigos, 1 casa um do outro: o Arco salta de um para o outro)
  for (let i = 0; i < 9; i++) outro(a.e, a.resto[i], 2 + i, 0);
  const sem = usar(a.e, a.b, 0);
  assert.ok(sem.ok, sem.erro);
  const nSem = sem.eventos.filter((v) => v.t === 'dmg').length;
  a.e.hunt.clock += 10_000;
  a.e.hunt.poePacto = { restantes: 1, maisPct: 35, espiral: 8, feixes: 6, projeteis: 6 };
  const com = usar(a.e, a.b, 0);
  assert.ok(com.ok, com.erro);
  assert.equal(com.eventos.filter((v) => v.t === 'dmg').length, Math.min(10, nSem + 6));
  assert.equal(a.e.hunt.poePacto, undefined);
});

test('PR3 no jogo: o Pacto na magia de área no local mirado — as 8 áreas a mais em espiral em volta do alvo; quem está numa delas leva o acerto dela', { skip: SEM }, async () => {
  const c = await montar('Reap', { dx: 2 });
  const sem = usar(c.e, c.b, 0);
  assert.ok(sem.ok, sem.erro);
  const areasSem = sem.eventos.filter((v) => v.t === 'area').length;
  // (o raio da área do uso, em volta do alvo: a casa mais longe dele no desenho — o desenho é relativo ao `x, y` do evento)
  const ev = sem.eventos.find((v) => v.t === 'area');
  const raio = Math.max(...ev.casas.map(([dx, dy]) => Math.max(Math.abs(ev.x + dx - c.b.x), Math.abs(ev.y + dy - c.b.y))));
  // o último centro da espiral: a 2 × o raio do alvo, no rumo do uso (o leste)
  const m2 = outro(c.e, c.resto[0], 2 + 2 * Math.max(1, raio), 0);
  c.e.hunt.clock += 10_000;
  const semDeNovo = usar(c.e, c.b, 0);
  assert.equal(golpesEm(semDeNovo, m2).length, 0, 'fora da área do uso');
  c.e.hunt.clock += 10_000;
  c.e.hunt.poePacto = { restantes: 2, maisPct: 35, espiral: 8, feixes: 6, projeteis: 6 };
  const com = usar(c.e, c.b, 0);
  assert.ok(com.ok, com.erro);
  assert.equal(com.eventos.filter((v) => v.t === 'area').length, areasSem + 8);
  assert.ok(golpesEm(com, m2).length >= 1, 'a área da espiral pega o de longe');
  assert.equal(c.e.hunt.poePacto.restantes, 1);
});
