// (lote B2, dono 20/10) AS GEMAS ATIVAS DE CONTADORES PRÓPRIOS, CHÃO E ESPALHAR (o plano do grupo área/nova/chuva/orbe, as recomendações aceitas): as Cargas Sangrentas
// do Ceifar (D-B2.2), o debuff com cargas do Golpe Infernal (D-B2.3), a Febre Corrompedora (D-B2.4), o Contágio (D-B2.5), a Ruína da Barganha de Trarthus (D-B2.6), o lento
// por fonte da Chuva Tóxica (D-B2.1), a Explosão Voltáxica, o Vínculo de Mana, a Chama Purificadora, a Tormenta Flamejante Vaal e o Chicote Ardente. Os números são os do
// PoE (o PoB, o poedb); os sorteios ficam travados.
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
const SP = await import('../systems/itens-poe/suportes-poe.mjs');
const B2 = await import('../systems/itens-poe/gemas-b2.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Combate = await import('../systems/hunt/combate.mjs');
const Reforcos = await import('../systems/skills/reforcos.mjs');
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
/** O personagem com a gema na arma, numa caçada; o alvo imortal colado e os outros longe. */
async function montar(slug, { nivel = 20, qualidade = 0, arma = 'Wands/Driftwood_Wand' } = {}) {
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
  Object.assign(b, { x: e.hunt.pos.x + 1, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12, estados: {}, resist: {} });
  return { e, b, resto };
}
/** Usa a gema no alvo (com a conjuração concluída), com o sorteio travado. */
function usar(e, b, v = 0.5) {
  return travado(v, () => {
    const x = Acoes.disparar(e, e.hunt, PERSONAGEM, 0, b, { manual: true });
    if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM); }
    return x;
  });
}
/** O próximo uso pode sair (a recarga, o tempo de uso). */
const liberar = (e) => { e.hunt.clock += 10_000; e.hunt.cooldowns = {}; };
/** O tique das plantadas (os objetos, o lote B2) de `ms` em `ms`, até `total`. */
function tiques(e, total, ms = 100, v = 0.5) {
  const ev = [];
  travado(v, () => { for (let t = 0; t < total; t += ms) { e.hunt.clock += ms; ev.push(...Acoes.tiqueDasPlantadas(e, e.hunt, PERSONAGEM, [])); } });
  return ev;
}
/** Um vizinho do alvo (um dos monstros longe, trazido para `dx`, `dy` do alvo), imortal. */
function vizinho(m, dx = 1, dy = 0) {
  const v = m.resto[0];
  Object.assign(v, { x: m.b.x + dx, y: m.b.y + dy, hp: 1e12, maxHp: 1e12, estados: {}, resist: {}, dots: [] });
  return v;
}

// ---------------------------------------------------------------- o status

test('B2: as gemas do lote saem de parcial (as linhas do PoE têm leitor); as que esperam o dono seguem com só a linha dele', { skip: SEM }, () => {
  for (const s of ['Reap', 'Reap_of_Butchery', 'Vaal_Reap', 'Infernal_Blow', 'Corrupting_Fever', 'Dark_Bargain_of_Trarthus', 'Contagion', 'Contagion_of_Subsiding', 'Contagion_of_Transference', 'Vaal_Firestorm', 'Toxic_Rain', 'Toxic_Rain_of_Sporeburst', 'Purifying_Flame', 'Purifying_Flame_of_Revelations']) {
    const r = G.REGISTRO.get(s);
    assert.deepEqual([s, r.statusNoJogo, r.motivosNoJogo], [s, 'funciona', []]);
  }
  const so = (s, re) => { const r = G.REGISTRO.get(s); assert.equal(r.statusNoJogo, 'parcial', s); assert.ok(r.motivosNoJogo.every((m) => re.test(m)), `${s}: ${r.motivosNoJogo.join(' | ')}`); };
  so('Voltaxic_Burst', /Vida Máxima do cadáver/);
  so('Manabond', /de largura por cada 25/);
  so('Flame_Surge', /Solo Ardente/);
  so('Flame_Surge_of_Combusting', /Solo [Aa]rdente/);
  so('Blade_Blast_of_Unloading', /Vórtice de Lâminas/);
});

// ---------------------------------------------------------------- os leitores (os números do PoE)

test('B2: os leitores no nível 20 — os números do PoB e do poedb', { skip: SEM }, () => {
  assert.deepEqual(G.b2DaGema('Reap', 20, 20).ceifar, { ganha: true, perde: true, danoPorCargaPct: 20, custoPorCargaPct: 20 });
  assert.equal(G.b2DaGema('Reap_of_Butchery', 20, 0).ceifar.danoPorCargaPct, 25);
  assert.deepEqual(G.b2DaGema('Vaal_Reap', 20, 20).ceifar, { danoPorCargaPct: 5, vaal: { maxExtra: 4, daMax: true, perduraMs: 4000, secundariaMs: 8000, chaoMs: 5000 } });
  assert.deepEqual(G.b2DaGema('Infernal_Blow', 20, 0).infernal, { porCargaPct: 66, maxCargas: 6, raioM: 1.8, cadaverPct: 6, duracaoMs: 800 });
  assert.equal(G.b2DaGema('Infernal_Blow', 20, 20).infernal.porCargaPct, 76);
  // (o "mais" do debuff com N cargas: 66% × 6 = 396% do acerto — o PoB, act_str.lua:7052)
  assert.equal(B2.pctDaExplosaoInfernal(66, 6), 396);
  assert.deepEqual(G.b2DaGema('Corrupting_Fever', 20, 0).febre, { renovaVida: 205, penalidadeMs: 1500, duracaoMs: 6000 });
  assert.deepEqual([B2.fatorDaFebre(1), B2.fatorDaFebre(3), B2.fatorDaFebre(10), B2.fatorDaFebre(14)], [1, 3, 10, 10]);
  assert.deepEqual(G.b2DaGema('Dark_Bargain_of_Trarthus', 20, 20).ruina, { max: 7, sacrificioPct: 50, caosPct: 600, extraPct: 20 });
  assert.equal(G.b2DaGema('Manabond', 20, 20).manaQueFaltaPct, 54);
  assert.equal(B2.raioDaManaQueFalta(44, 1000, 200, 300), 220);
  assert.deepEqual(G.b2DaGema('Contagion', 20, 0).contagio, { aoMorrer: true, aoAcertar: false });
  assert.deepEqual(G.b2DaGema('Contagion_of_Transference', 20, 0).contagio, { aoMorrer: false, aoAcertar: true });
  assert.deepEqual(G.b2DaGema('Toxic_Rain_of_Sporeburst', 20, 0).esporos, { porEsporoPct: 5, maxPct: 30 });
  assert.deepEqual(G.b2DaGema('Purifying_Flame', 20, 20).purificadora, { sagradoExtraM: 0.8999999999999999, ondaRaioM: 5, ondaMaisPct: -25, duracaoMs: 4000 });
  assert.equal(G.b2DaGema('Purifying_Flame_of_Revelations', 20, 20).purificadora.ondaMaisPct, 180);
  assert.deepEqual(G.b2DaGema('Flame_Surge', 20, 20).chicote, { contraIncendiadoPct: 108, naoIncendeia: true, raioExtraM: 0.9 });
  assert.equal(G.b2DaGema('Voltaxic_Burst', 20, 0).raioEmCaosPct, 60);
  const t = G.objetoDaGema('Vaal_Firestorm', 20, 0);
  assert.deepEqual([t.tipo, t.total, t.intervaloMs, t.areaM, t.soloMs, t.impactoAreaMaisPct], ['tempestade', 16, 500, 2, 6000, 20]);
  const v = G.objetoDaGema('Voltaxic_Burst', 20, 20);
  assert.deepEqual([v.tipo, v.atrasoMs, v.porAguardandoPct], ['voltaxica', 2500, 2]);
  // (o raio-base do PoB que o poedb não publica: a Voltáxica 2,2 m + 0,3; a Barganha de Trarthus 2,6 m)
  assert.ok(perto(G.areaNoNivel('Voltaxic_Burst', 20, 0).raioM, 2.5));
  assert.ok(perto(G.areaNoNivel('Dark_Bargain_of_Trarthus', 20, 0).raioM, 2.6));
});

// ---------------------------------------------------------------- o Ceifar (D-B2.2)

test('B2 no jogo: o Ceifar ganha uma Carga Sangrenta quando acerta sem matar; cada carga dá 15% mais dano e 20% mais custo de Vida', { skip: SEM }, async () => {
  assert.equal(G.recursoDoCusto('Reap', 20), 'vida');
  const m = await montar('Reap');
  const vida0 = m.e.hp;
  const hp0 = m.b.hp;
  assert.ok(usar(m.e, m.b).ok);
  const custo0 = vida0 - m.e.hp;
  const dano0 = hp0 - m.b.hp;
  assert.equal(B2.cargasSangrentas(m.e.hunt).n, 1);
  liberar(m.e);
  m.e.hunt.poeSangue.n = 2;
  m.b.dots = [];
  const vida1 = m.e.hp;
  const hp1 = m.b.hp;
  assert.ok(usar(m.e, m.b).ok);
  assert.ok(perto((vida1 - m.e.hp) / custo0, 1.4, 0.02), `custo ${custo0} → ${vida1 - m.e.hp}`);
  assert.ok(perto((hp1 - m.b.hp) / dano0, 1.3, 0.001), `dano ${dano0} → ${hp1 - m.b.hp}`);
  assert.equal(B2.cargasSangrentas(m.e.hunt).n, 3);
  // (no máximo de 5)
  m.e.hunt.poeSangue.n = 5;
  liberar(m.e);
  assert.ok(usar(m.e, m.b).ok);
  assert.equal(B2.cargasSangrentas(m.e.hunt).n, 5);
});

test('B2 no jogo: o Ceifar perde uma Carga Sangrenta quando morre um inimigo com o debuff dele (por quem for)', { skip: SEM }, async () => {
  const m = await montar('Reap');
  assert.ok(usar(m.e, m.b).ok);
  assert.ok(m.b.dots.some((d) => d.chave === 'Reap'));
  m.e.hunt.poeSangue.n = 3;
  m.b.hp = 0;
  Combate.processarMortes(m.e, PERSONAGEM, []);
  assert.equal(B2.cargasSangrentas(m.e.hunt).n, 2);
});

test('B2 no jogo: o Ceifar Vaal dá até 9 Cargas Sangrentas por 8 s (o máximo volta a 5) e deixa o Sangue Fervendo, que perdura 4 s fora dele', { skip: SEM }, async () => {
  const m = await montar('Vaal_Reap');
  assert.ok(usar(m.e, m.b).ok);
  assert.deepEqual(B2.cargasSangrentas(m.e.hunt), { n: 9, max: 9 });
  const chao = m.e.hunt.poeObjetos.find((o) => o.sangueFervendo);
  assert.ok(chao, 'o chão de Sangue Fervendo');
  assert.equal(chao.ate - m.e.hunt.clock, 5000);
  assert.ok(!(m.b.dots ?? []).some((d) => d.chave === 'Vaal_Reap'), 'o degenerativo é o do chão, não o do acerto');
  const hp0 = m.b.hp;
  tiques(m.e, 1000);
  const porSegundo = hp0 - m.b.hp;
  assert.ok(porSegundo > 0, 'queima no chão');
  // (sai do chão: segue queimando por 4 s depois do último tique em que estava nele)
  m.b.x += 20;
  const sai = m.e.hunt.clock;
  const hp1 = m.b.hp;
  tiques(m.e, 6000);
  const fora = hp1 - m.b.hp;
  assert.ok(perto(fora / porSegundo, 4, 0.05), `fora ${fora} / ${porSegundo} por s`);
  assert.ok(!m.b.estados.poeSangueFervendo && m.e.hunt.clock - sai >= 4000);
  // (passados os 8 s, o máximo volta a 5)
  m.e.hunt.clock += 10_000;
  assert.deepEqual(B2.cargasSangrentas(m.e.hunt), { n: 5, max: 5 });
});

// ---------------------------------------------------------------- o Golpe Infernal (D-B2.3)

test('B2 no jogo: o Golpe Infernal — com 6 cargas o debuff explode na hora (396% do acerto) e o vizinho leva o descarregado; ao expirar, explode com as que tem', { skip: SEM }, async () => {
  const m = await montar('Infernal_Blow', { arma: 'One_Hand_Swords/Rusted_Sword' });
  const v = vizinho(m, 1, 0);
  for (let i = 1; i <= 5; i++) {
    assert.ok(usar(m.e, m.b, 0.01).ok);
    assert.deepEqual([m.b.estados.poeInfernal?.carregado, m.b.estados.poeInfernal?.n], [true, i]);
    liberar(m.e);
    m.e.hunt.clock -= 10_000 - 300;
  }
  const hpV = v.hp;
  const r = usar(m.e, m.b, 0.01);
  assert.ok(r.ok);
  assert.ok(r.eventos.some((x) => x.t === 'explosao'), 'a explosão');
  assert.ok(hpV - v.hp > 0, 'a explosão acerta o vizinho');
  assert.equal(v.estados.poeInfernal?.carregado, false, 'o vizinho leva o descarregado');
  // (o alvo foi acertado pela explosão também: o descarregado)
  assert.equal(m.b.estados.poeInfernal?.carregado, false);
  // ao expirar: 1 carga, 0,8 s depois explode (66% do acerto)
  const m2 = await montar('Infernal_Blow', { arma: 'One_Hand_Swords/Rusted_Sword' });
  const v2 = vizinho(m2, 1, 0);
  assert.ok(usar(m2.e, m2.b, 0.01).ok);
  assert.equal(m2.b.estados.poeInfernal.n, 1);
  const hp2 = v2.hp;
  const ev = tiques(m2.e, 1000, 100, 0.01);
  assert.ok(ev.some((x) => x.t === 'explosao'));
  assert.ok(hp2 - v2.hp > 0, 'explodiu ao expirar');
  assert.ok(!m2.b.estados.poeInfernal?.carregado);
});

test('B2 no jogo: o morto com o debuff do Golpe Infernal explode — o carregado com as cargas e o cadáver com 6% da Vida como Fogo', { skip: SEM }, async () => {
  const m = await montar('Infernal_Blow', { arma: 'One_Hand_Swords/Rusted_Sword' });
  const v = vizinho(m, 1, 0);
  assert.ok(usar(m.e, m.b, 0.01).ok);
  m.b.maxHp = 100_000;
  m.b.hp = 0;
  const hp = v.hp;
  const ev = [];
  travado(0.01, () => Combate.processarMortes(m.e, PERSONAGEM, ev));
  const danos = ev.filter((x) => x.t === 'dmg' && x.uid === v.uid);
  assert.ok(danos.length >= 2, `o golpe do carregado e o do cadáver: ${danos.length}`);
  assert.ok(hp - v.hp > 0);
});

// ---------------------------------------------------------------- a Febre Corrompedora (D-B2.4)

test('B2 no jogo: a Febre Corrompedora — o buff de 6 s; os seus acertos põem o Sangue Corrompido (até 10 estágios, n × o dano); 205 de Vida gasta renova', { skip: SEM }, async () => {
  const m = await montar('Corrupting_Fever');
  const r = usar(m.e, m.b);
  assert.ok(r.ok, r.erro);
  const f = m.e.hunt.poeFebre;
  assert.ok(f && f.ate - m.e.hunt.clock === 6000, 'o buff de 6 s');
  assert.ok(!(m.b.dots ?? []).length, 'o uso não acerta');
  const t = m.e.hunt.clock;
  Acoes.aoAcertarB2(m.e.hunt, m.b, 100, t);
  const um = m.b.dots.find((d) => d.chave === 'Corrupting_Fever').falta;
  assert.ok(perto(um, f.partes[0].porSegundo * 1.5, 1e-9));
  for (let i = 0; i < 12; i++) Acoes.aoAcertarB2(m.e.hunt, m.b, 100, t);
  assert.equal(m.b.estados.poeFebre.n, 10);
  assert.ok(perto(m.b.dots.find((d) => d.chave === 'Corrupting_Fever').falta, um * 10, 1e-9));
  // a Vida gasta: 204 não renova; 205 renova (a duração inteira)
  m.e.hunt.clock = t + 3000;
  Acoes.vidaGastaB2(m.e.hunt, 204, m.e.hunt.clock);
  assert.equal(f.ate, t + 6000);
  Acoes.vidaGastaB2(m.e.hunt, 1, m.e.hunt.clock);
  assert.equal(f.ate, t + 3000 + 6000);
});

// ---------------------------------------------------------------- a Explosão Voltáxica

test('B2 no jogo: a Explosão Voltáxica espera 2,5 s e solta em volta de você; 1% mais por cada outra que aguarda', { skip: SEM }, async () => {
  const dano = async (vezes) => {
    const m = await montar('Voltaxic_Burst');
    for (let i = 0; i < vezes; i++) { assert.ok(usar(m.e, m.b).ok); m.e.hunt.clock += 400; m.e.hunt.cooldowns = {}; }
    assert.equal(m.e.hunt.poeObjetos.filter((o) => o.tipo === 'voltaxica').length, vezes);
    const hp = m.b.hp;
    // (a primeira solta 2,5 s depois do uso dela; as outras aguardam)
    const ev = tiques(m.e, 2500 - 400 * vezes + 50, 50);
    assert.equal(ev.filter((x) => x.t === 'explosao').length, 1);
    return hp - m.b.hp;
  };
  const so = await dano(1);
  const comUma = await dano(2);
  assert.ok(so > 0);
  // (o dano é inteiro: 1% mais de 1561 é 1576,6 — 1577)
  assert.ok(Math.abs(comUma - so * 1.01) <= 1, `razão ${comUma / so} (${so} → ${comUma})`);
});

// ---------------------------------------------------------------- a Barganha de Trarthus (D-B2.6)

test('B2 no jogo: a Barganha de Trarthus — a sétima Ruína sacrifica 50% da Vida máxima e soma 600% dela ao Caos base; as Ruínas zeram', { skip: SEM }, async () => {
  const m = await montar('Dark_Bargain_of_Trarthus');
  assert.ok(usar(m.e, m.b, 0.99).ok);
  assert.equal(m.e.hunt.poeRuina, 1);
  // (a qualidade 0: sem a Ruína adicional)
  liberar(m.e);
  const hpSem = m.b.hp;
  assert.ok(usar(m.e, m.b, 0.99).ok);
  const sem = hpSem - m.b.hp;
  m.e.hunt.poeRuina = 6;
  liberar(m.e);
  m.e.maxHp = m.e.hp = 10_000;
  const hp = m.b.hp;
  assert.ok(usar(m.e, m.b, 0.99).ok);
  assert.equal(m.e.hunt.poeRuina, 0);
  assert.ok(m.e.hp <= 10_000 - 5000, `a Vida depois: ${m.e.hp}`);
  assert.ok(hp - m.b.hp > sem + 25_000, `o Caos do sacrifício (30 000 de base): ${hp - m.b.hp} vs ${sem}`);
  assert.deepEqual(B2.usarRuina(6, { max: 7, sacrificioPct: 50, caosPct: 600, extraPct: 0 }, 10_000, 0.5), { n: 0, sacrificio: 5000, caosBase: 30_000 });
  assert.deepEqual(B2.usarRuina(5, { max: 7, sacrificioPct: 50, caosPct: 600, extraPct: 20 }, 10_000, 0.1), { n: 0, sacrificio: 5000, caosBase: 30_000 });
});

// ---------------------------------------------------------------- o Vínculo de Mana

test('B2 no jogo: o Vínculo de Mana — o Raio base a mais de 44% da Mana Não Reservada que falta (× a eficácia)', { skip: SEM }, async () => {
  const dano = async (mana) => {
    const m = await montar('Manabond');
    m.e.maxMana = 100_000;
    m.e.mana = mana;
    const hp = m.b.hp;
    assert.ok(usar(m.e, m.b).ok);
    return hp - m.b.hp;
  };
  const cheia = await dano(100_000);
  const vazia = await dano(6000);
  assert.ok(vazia > cheia * 5, `${cheia} → ${vazia}`);
});

// ---------------------------------------------------------------- o Contágio (D-B2.5)

test('B2 no jogo: o Contágio espalha na morte do afetado — o dano que falta e a duração que resta, nos vizinhos no raio; o da Transferência, no acerto', { skip: SEM }, async () => {
  const m = await montar('Contagion');
  const v = vizinho(m, 1, 0);
  const longe = m.resto[1];
  Object.assign(longe, { x: m.b.x + 9, y: m.b.y, hp: 1e12, maxHp: 1e12, dots: [] });
  assert.ok(usar(m.e, m.b).ok);
  v.dots = [];
  const d = m.b.dots.find((x) => x.chave === 'Contagion');
  assert.ok(d?.contagio?.aoMorrer);
  m.e.hunt.clock += 1000;
  m.b.hp = 0;
  Combate.processarMortes(m.e, PERSONAGEM, []);
  const n = v.dots.find((x) => x.chave === 'Contagion');
  assert.ok(n, 'o vizinho pegou o Contágio');
  assert.equal(n.ate, d.ate);
  assert.ok(n.contagio?.aoMorrer, 'e espalha também');
  assert.ok(!(longe.dots ?? []).some((x) => x.chave === 'Contagion'), 'fora do raio, não');
  const t = await montar('Contagion_of_Transference');
  const vt = vizinho(t, 1, 0);
  assert.ok(usar(t.e, t.b).ok);
  vt.dots = [];
  Acoes.aoAcertarB2(t.e.hunt, t.b, 50, t.e.hunt.clock);
  assert.ok(vt.dots.some((x) => x.chave === 'Contagion_of_Transference'));
});

// ---------------------------------------------------------------- a Chuva Tóxica (D-B2.1)

test('B2: o lento por fonte dos esporos — 5% por esporo até 30%; a mesma fonte soma, fontes diferentes multiplicam', { skip: SEM }, () => {
  const m = { estados: {} };
  B2.porEsporos(m, 'Toxic_Rain', 5, 1000, 5, 30, 0);
  assert.equal(B2.lentoDaFonte(m.estados.poeLentoPorFonte.Toxic_Rain, 0), 25);
  B2.porEsporos(m, 'Toxic_Rain', 5, 1500, 5, 30, 500);
  assert.equal(B2.lentoDaFonte(m.estados.poeLentoPorFonte.Toxic_Rain, 500), 30);
  assert.equal(B2.lentoDaFonte(m.estados.poeLentoPorFonte.Toxic_Rain, 1200), 25);
  B2.porEsporos(m, 'Toxic_Rain_of_Sporeburst', 2, 2000, 5, 30, 1200);
  assert.ok(perto(B2.fatorDosLentosPorFonte(m, 1200), 1 / 0.75 / 0.9));
  assert.equal(B2.fatorDosLentosPorFonte(m, 3000), 1);
});

test('B2 no jogo: a Chuva Tóxica deixa os 5 esporos na área — o alvo anda 25% mais devagar pela duração deles', { skip: SEM }, async () => {
  const m = await montar('Toxic_Rain', { arma: 'Bows/Crude_Bow' });
  assert.ok(usar(m.e, m.b, 0.01).ok);
  const t = m.e.hunt.clock;
  assert.ok(perto(Reforcos.fatorDeDesaceleracao(m.b, t), 1 / 0.75), `fator ${Reforcos.fatorDeDesaceleracao(m.b, t)}`);
  assert.equal(Reforcos.fatorDeDesaceleracao(m.b, t + 1001), 1);
});

// ---------------------------------------------------------------- a Chama Purificadora

test('B2 no jogo: a Chama Purificadora cria o Solo Sagrado no alvo e a Onda de Choque acerta quem está num Solo Sagrado e não foi acertado (25% menos)', { skip: SEM }, async () => {
  const m = await montar('Purifying_Flame');
  const v = vizinho(m, 2, 0);
  // (um Solo Sagrado sob o vizinho, fora da área do acerto inicial)
  m.e.hunt.solosSagrados = [{ x: v.x, y: v.y, raio: 0, ate: m.e.hunt.clock + 60_000 }];
  const hpB = m.b.hp;
  const hpV = v.hp;
  assert.ok(usar(m.e, m.b).ok);
  const sg = m.e.hunt.solosSagrados.find((s) => s.x === m.b.x && s.y === m.b.y);
  assert.ok(sg, 'o Solo Sagrado no alvo');
  assert.equal(sg.ate - m.e.hunt.clock, 4000);
  const dB = hpB - m.b.hp;
  const dV = hpV - v.hp;
  assert.ok(dV > 0, 'a Onda acertou o vizinho');
  assert.ok(perto(dV / dB, 0.75, 0.001), `razão ${dV / dB}`);
});

// ---------------------------------------------------------------- a Tormenta Flamejante Vaal

test('B2 no jogo: a Tormenta Flamejante Vaal — 16 impactos, um a cada 0,5 s, cada um deixando o Solo Ardente por 6 s', { skip: SEM }, async () => {
  const m = await montar('Vaal_Firestorm');
  const hp = m.b.hp;
  const r = usar(m.e, m.b);
  assert.ok(r.ok, r.erro);
  assert.equal(hp, m.b.hp, 'o uso não acerta na hora');
  const ev = tiques(m.e, 8000, 100);
  assert.equal(ev.filter((x) => x.t === 'explosao').length, 16);
  assert.ok(hp - m.b.hp > 0);
  const solos = (m.e.hunt.poeObjetos ?? []).filter((o) => o.tipo === 'chao' && o.slug === 'Vaal_Firestorm');
  assert.equal(solos.length, 12, 'os solos de 6 s ainda no chão (os 4 primeiros já acabaram)');
  assert.ok(!(m.b.dots ?? []).some((d) => d.chave === 'Vaal_Firestorm'), 'o degenerativo é o do chão');
});

// ---------------------------------------------------------------- o Chicote Ardente

test('B2 no jogo: o Chicote Ardente — 88% mais contra o Incendiado; +0,9 m no raio (3 m → 3,9 m)', { skip: SEM }, async () => {
  const dano = async (incendiado) => {
    const m = await montar('Flame_Surge');
    if (incendiado) m.b.dots = [{ id: 'q', tipo: 'queimadura', elemento: 'fire', ate: m.e.hunt.clock + 60_000, falta: 1, porPulso: 0, proximo: m.e.hunt.clock + 60_000 }];
    const v = vizinho(m, 2, 0);
    const hp = m.b.hp;
    const hpV = v.hp;
    assert.ok(usar(m.e, m.b).ok);
    return { alvo: hp - m.b.hp, vizinho: hpV - v.hp };
  };
  const sem = await dano(false);
  const com = await dano(true);
  assert.ok(perto(com.alvo / sem.alvo, 1.88, 0.001), `razão ${com.alvo / sem.alvo}`);
  // (o raio de 3,9 m: 1,95 casas — com o sorteio em 0,5, 2 casas; o vizinho a 2 casas do alvo leva o golpe)
  assert.ok(sem.vizinho > 0, 'o vizinho a 2 casas');
});
