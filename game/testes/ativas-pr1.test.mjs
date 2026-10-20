// (lote PR1, dono 20/10) AS GEMAS ATIVAS DE PROJÉTIL QUE REUSAM O QUE JÁ EXISTE (o plano do grupo, as recomendações aceitas): o dano adicional pela Vida/Mana
// máxima (a Flecha Ardente do Vigor, o Sifão de Poder do Arquimago), a Carga de Poder do Sifão de Poder (as três), as ESTILHAS do Arremesso de Escudo
// Espectral (a correção: os projéteis adicionais são as estilhas, com o "menos Dano" delas; o de Trarthus as solta 6 por vez, cada intervalo 40% mais rápido),
// o cone da Flecha Galvânica com a Velocidade de Projéteis na Área, a Vida dos cadáveres do Desenterrar, a Hélice ("não se aplica") e o Ensanguentar da
// Transmissão. Os números são os do PoE (o PoB, o poedb); os sorteios ficam travados.
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
const PR1 = await import('../systems/itens-poe/gemas-pr1.mjs');
const L = await import('../systems/itens-poe/linhas-das-gemas.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const CargasPoe = await import('../systems/itens-poe/cargas.mjs');
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
/** O personagem com a gema na arma (e o escudo, se pedido), numa caçada; o alvo imortal colado e os outros longe. */
async function montar(slug, { nivel = 20, qualidade = 0, arma = 'Wands/Driftwood_Wand', escudo = null } = {}) {
  J ??= await import('../systems/itens-poe/jogo.mjs');
  gerarPeca ??= (await import('../systems/itens-poe/gerar.mjs')).gerarPeca;
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Scion', sistema: 'poe' });
  const a = peca(arma);
  a.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
  e.equipment = { ...e.equipment, weapon: a };
  delete e.equipment.shield;
  if (escudo) e.equipment.shield = peca(escudo);
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
  // (sem armadura: a redução física do PoE cai mais nos acertos menores, e as contas de razão dos testes são do dano antes dela)
  Object.assign(b, { x: e.hunt.pos.x + 1, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12, estados: {}, resist: {}, armaduraPct: -100 });
  return { e, b, resto, entry: Acoes.POR_ID_PUBLICO(G.doSlug(slug).acao) };
}
/** Usa a gema no alvo (com a conjuração concluída), com o sorteio travado. */
function usar(e, b, v = 0) {
  return travado(v, () => {
    const x = Acoes.disparar(e, e.hunt, PERSONAGEM, 0, b, { manual: true });
    if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM); }
    return x;
  });
}
/** Um segundo monstro imortal em `(dx, dy)` de você. */
const outro = (e, resto, dx, dy) => Object.assign(resto[0], { x: e.hunt.pos.x + dx, y: e.hunt.pos.y + dy, hp: 1e12, maxHp: 1e12, estados: {}, resist: {}, armaduraPct: -100 });

// ---------------------------------------------------------------- o status

test('PR1: as gemas do lote saem de parcial (as linhas do PoE têm leitor); a Hélice registra o "não se aplica"', { skip: SEM }, () => {
  for (const s of ['Burning_Arrow_of_Vigour', 'Power_Siphon', 'Power_Siphon_of_the_Archmage', 'Vaal_Power_Siphon', 'Galvanic_Arrow', 'Spectral_Shield_Throw', 'Spectral_Shield_Throw_of_Shattering', 'Spectral_Shield_Throw_of_Trarthus', 'Unearth', 'Spectral_Helix', 'Exsanguinate_of_Transmission']) {
    const r = G.REGISTRO.get(s);
    assert.deepEqual([s, r.statusNoJogo, r.motivosNoJogo], [s, 'funciona', []]);
  }
  assert.ok(G.REGISTRO.get('Spectral_Helix').linhasNaoSeAplicam.some((n) => /Gira por N rotações/.test(n)));
});

// ---------------------------------------------------------------- o dano adicional pela Vida/Mana máxima

test('PR1: a Flecha Ardente do Vigor — Fogo adicional igual a 32% da Vida Máxima; o Arquimago — Raio igual a 24% (+0,15 por qualidade) da Mana máxima', { skip: SEM }, async () => {
  assert.deepEqual(L.atributosDaLinha('Causa Dano de Fogo Adicional igual a 32 % da Vida Máxima'), { 'added_fire_dmg_min%vidaMax:1': 0.32, 'added_fire_dmg_max%vidaMax:1': 0.32 });
  const arq = G.linhasLocaisNoNivel('Power_Siphon_of_the_Archmage', 20, 20).af;
  assert.ok(perto(arq['added_energy_dmg_min%manaMax:1'], 0.27) && perto(arq['added_energy_dmg_max%manaMax:1'], 0.27), JSON.stringify(arq));
  // no uso: a ficha da gema tem o adicional de 32% da Vida de agora (mínimo = máximo)
  const { e, entry } = await montar('Burning_Arrow_of_Vigour', { arma: 'Bows/Crude_Bow' });
  e.maxHp = 5000;
  Ficha.invalidar(e);
  const f = Acoes.comAsLinhasDaGema(e, Ficha.combate(e), entry);
  const s = ModsPoe.somaPorTags(f, Acoes.tagsPoeDaSkill(entry));
  assert.ok(perto(s.added_fire_dmg_min, 1600) && perto(s.added_fire_dmg_max, 1600), `${s.added_fire_dmg_min}–${s.added_fire_dmg_max}`);
});

// ---------------------------------------------------------------- o Sifão de Poder

test('PR1: o Sifão de Poder — 20% de chance de Carga de Poder por projétil que acerta Raro ou Único (a Vaal: sempre); no Normal, nada', { skip: SEM }, async () => {
  assert.deepEqual(['Power_Siphon', 'Power_Siphon_of_the_Archmage', 'Vaal_Power_Siphon', 'Spark'].map((s) => G.cargaDoSifaoDaGema(s, 20)), [20, 20, 100, 0]);
  const poder = async (raridade, v) => {
    const { e, b } = await montar('Power_Siphon');
    b.raridade = raridade;
    const r = usar(e, b, v);
    assert.ok(r.ok, r.erro);
    return CargasPoe.ativas(e).poder;
  };
  assert.equal(await poder('raro', 0), 1);
  assert.equal(await poder('unico', 0), 1);
  assert.equal(await poder('normal', 0), 0);
  // (o sorteio de 0,5: 50 ≥ 20 — sem carga)
  assert.equal(await poder('raro', 0.5), 0);
});

// ---------------------------------------------------------------- o Arremesso de Escudo Espectral

test('PR1: as estilhas no uso — os projéteis adicionais viram estilhas (3 + 0,1 por qualidade; 12 no Despedaçamento; 23 no de Trarthus), o escudo não perfura e ricocheteia 3', { skip: SEM }, () => {
  const efeito = (slug, q = 0) => Acoes.comOsAlvosDaGema({ id: 'x', poeGema: { slug } }, { nivel: 20, qualidade: q });
  const base = efeito('Spectral_Shield_Throw');
  assert.deepEqual([base.alvosExtras, base.perfurar, base.encadear, base.estilhas], [0, 0, 3, { n: 3, pct: 50 }]);
  assert.deepEqual(efeito('Spectral_Shield_Throw', 20).estilhas, { n: 5, pct: 50 });
  const sh = efeito('Spectral_Shield_Throw_of_Shattering');
  assert.deepEqual([sh.alvosExtras, sh.perfurar, sh.estilhas], [0, 0, { n: 12, pct: 75 }]);
  const tr = efeito('Spectral_Shield_Throw_of_Trarthus');
  // (o de Trarthus para no local mirado: nada adiante do alvo; as estilhas é que perfuram)
  assert.deepEqual([tr.alvosExtras, tr.perfurar, tr.estilhas, tr.estilhasDoObjeto, tr.estilhasMenosPct], [0, 0, undefined, 23, 50]);
  assert.deepEqual(G.objetoDaGema('Spectral_Shield_Throw_of_Trarthus', 20), { tipo: 'escudo', menosPct: 50, porVez: 6, intervaloMs: 600, aceleraPct: 40 });
  assert.equal(G.objetoDaGema('Spectral_Shield_Throw', 20), null);
});

test('PR1: no motor dos projéteis, cada colisão do escudo solta as estilhas em direções sorteadas — perfuram todos, com o % delas, e não acertam o colidido', { skip: SEM }, () => {
  const alvo = { uid: 'a', x: 3, y: 0, hp: 10 };
  const m1 = { uid: 'b', x: 3, y: 2, hp: 10 };
  const m2 = { uid: 'c', x: 3, y: 5, hp: 10 };
  // (o sorteio 0,25: o ângulo π/2 — o sul, y+)
  const r = Secundarios.resolver({ efeito: { estilhas: { n: 2, pct: 50 }, perfurar: 0, encadear: 0 }, tags: ['projectile', 'hit'], origem: { x: 0, y: 0 }, alvo, atingidos: [alvo], vivos: [alvo, m1, m2], alcance: 7, rng: () => 0.25 });
  const estilhas = r.golpes.filter((g) => g.tipo === 'estilha' || (g.tipo === 'perfuracao' && g.pct === 50));
  assert.deepEqual(estilhas.map((g) => [g.bicho.uid, g.pct]), [['b', 50], ['c', 50], ['b', 50], ['c', 50]]);
  assert.ok(!r.golpes.some((g) => g.bicho === alvo));
  assert.equal(r.emitidos.filter((p) => p.tipo === 'estilha').length, 2);
});

test('PR1 no jogo: o Arremesso de Escudo Espectral — as 3 estilhas da colisão no alvo acertam o de trás com 50% cada (1,5 × o escudo)', { skip: SEM }, async () => {
  const { e, b, resto } = await montar('Spectral_Shield_Throw', { arma: 'One_Hand_Swords/Rusted_Sword', escudo: 'Shields/Splintered_Tower_Shield' });
  // (o sorteio 0: o ângulo 0 — o leste; o de trás está a 5 casas do alvo, longe do ricochete de 3)
  const m2 = outro(e, resto, 6, 0);
  const vidaB = b.hp;
  const vidaM = m2.hp;
  const r = usar(e, b, 0);
  assert.ok(r.ok, r.erro);
  const noAlvo = vidaB - b.hp;
  const atras = vidaM - m2.hp;
  assert.ok(noAlvo > 0);
  assert.ok(perto(atras / noAlvo, 1.5, 0.02), `razão ${atras / noAlvo}`);
});

test('PR1: o de Trarthus — o escudo para no alvo; as rajadas de 6, a primeira aos 0,6 s e cada intervalo ÷ 1,4, até as 23; cada estilha com 50% menos Dano', { skip: SEM }, async () => {
  const rj = PR1.rajadasDoEscudo(23);
  assert.deepEqual(rj.map((x) => x.n), [6, 6, 6, 5]);
  assert.ok(perto(rj[0].em, 600) && perto(rj[1].em, 600 + 600 / 1.4) && perto(rj[2].em, 600 + 600 / 1.4 + 600 / 1.96) && perto(rj[3].em, 600 + 600 / 1.4 + 600 / 1.96 + 600 / 2.744));
  const { e, b, resto } = await montar('Spectral_Shield_Throw_of_Trarthus', { arma: 'One_Hand_Swords/Rusted_Sword', escudo: 'Shields/Splintered_Tower_Shield' });
  // (o de trás, a 3 casas do alvo no rumo do tiro: o escudo não o acerta; as estilhas do sorteio 0 — o leste — sim)
  const m2 = outro(e, resto, 4, 0);
  const t0 = e.hunt.clock;
  const vidaB = b.hp;
  const r = usar(e, b, 0);
  assert.ok(r.ok, r.erro);
  const doEscudo = vidaB - b.hp;
  assert.ok(doEscudo > 0);
  assert.equal(m2.hp, 1e12, 'o escudo não passa do local mirado');
  const o = e.hunt.poeObjetos.find((x) => x.tipo === 'escudo');
  assert.deepEqual([o.n, o.porVez, o.maisPct, o.x, o.y], [23, 6, -50, b.x, b.y]);
  const tique = (dt) => travado(0, () => Acoes.tiqueDosObjetos(e, e.hunt, PERSONAGEM, [], t0 + dt));
  tique(599);
  assert.equal(o.feitos, 0);
  tique(600);
  assert.equal(o.feitos, 6);
  // (6 estilhas × 50% = 3 × o golpe do escudo)
  assert.ok(perto((1e12 - m2.hp) / doEscudo, 3, 0.02), `razão ${(1e12 - m2.hp) / doEscudo}`);
  tique(1028);
  assert.equal(o.feitos, 6);
  tique(1029);
  assert.equal(o.feitos, 12);
  tique(2000);
  assert.equal(o.feitos, 23);
  assert.ok(!(e.hunt.poeObjetos ?? []).includes(o), 'o escudo some depois da última rajada');
});

// ---------------------------------------------------------------- a Flecha Galvânica

test('PR1: a Flecha Galvânica — o cone na sua frente (2,8 m + a qualidade), a Velocidade de Projéteis aumentada soma na Área; quem está nele leva o acerto do cone', { skip: SEM }, async () => {
  assert.equal(G.areaNoNivel('Galvanic_Arrow', 20, 20).raioM, 3.3);
  assert.ok(perto(PR1.metrosDoConeGalvanico(3.3, 0, 40, 0), 3.3 * Math.sqrt(1.4)));
  assert.ok(perto(PR1.metrosDoConeGalvanico(2.8, 10, -20, 0), 2.8 * Math.sqrt(0.9)));
  const { e, b, resto } = await montar('Galvanic_Arrow', { arma: 'Bows/Crude_Bow' });
  const m2 = outro(e, resto, 1, 1);
  const r = usar(e, b, 0);
  assert.ok(r.ok, r.erro);
  const golpesEm = (m) => r.eventos.filter((ev) => ev.t === 'dmg' && ev.uid === m.uid).length;
  // (o alvo: a flecha e o cone; o do lado: a flecha a mais e o cone)
  assert.deepEqual([golpesEm(b), golpesEm(m2)], [2, 2]);
});

// ---------------------------------------------------------------- o Desenterrar

test('PR1: o Desenterrar — "Cadáveres Criados têm Vida Máxima aumentada em 20%" na qualidade 20', { skip: SEM }, async () => {
  assert.deepEqual([G.vidaDoCadaverDaGema('Unearth', 20), G.vidaDoCadaverDaGema('Unearth', 10), G.vidaDoCadaverDaGema('Unearth', 0)], [20, 10, 0]);
  const vida = async (qualidade) => {
    const { e } = await montar('Unearth');
    e.hunt.cadaveres = [];
    Acoes.criarCadaveres(e, e.hunt, 'Unearth', 20, e.hunt.pos, () => 0.5, { qualidade });
    return e.hunt.cadaveres.at(-1).maxHp;
  };
  const sem = await vida(0);
  const com = await vida(20);
  assert.ok(sem > 0);
  assert.ok(Math.abs(com - sem * 1.2) <= 1, `${sem} → ${com}`);
});
