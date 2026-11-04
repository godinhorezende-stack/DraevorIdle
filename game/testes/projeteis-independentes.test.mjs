// OS PROJÉTEIS INDEPENDENTES (03/11 — a revisão do voo de verdade, lote "projetil" do dono 02/11). No PoE cada projétil do uso é independente: o projétil a mais
// voa e cai no tempo DELE (o bicho perto no leque leva antes do alvo longe), os tiros saem no uso, e o principal que se perde (o fim do alcance, a parede, o alvo
// que saiu da reta) não leva os outros junto. E o que NÃO é projétil não voa: a Absolvição do Juiz (a área no alvo), a nova do chefe em volta dele. O lacaio e o
// mercenário voam na velocidade da gema da vez (o poedb) e com a Velocidade de Projétil dos suportes; o totem e o orbe do Morto Volátil voam como antes.
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
const LH = await import('../systems/itens-poe/lacaios-habilidades.mjs');
const M = await import('../systems/itens-poe/mercenarios.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const Areas = await import('../engine/areas.mjs');
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const BOSSES = (await import('../gamedata/boss-poderes.json', { with: { type: 'json' } })).default.bosses;
if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
}

const sorte = (v, f) => { const o = Math.random; Math.random = () => v; try { return f(); } finally { Math.random = o; } };
const perto = (a, b, tol = 1) => Math.abs(a - b) <= tol;

/** O personagem com a arma e a ativa (nível 20), numa caçada; os bichos em `posicoes` ([dx, dy] de você), imortais (o mesmo de `projeteis-voo`). */
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
  e.hunt.cadaveres = [];
  return { e, bichos: e.hunt.monstros.slice(0, posicoes.length) };
}
/** Um uso no `alvo` com o sorteio fixo: os eventos do uso. */
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
/** A 1ª casa (a `n` casas de você, Chebyshev) do projétil a mais do leque a `graus` do rumo leste (D7b de `projeteis-voo.mjs`: 10° entre os vizinhos) fora da reta leste. */
function casaDoLeque(n, graus = 10) {
  const a = (graus * Math.PI) / 180;
  const fim = { x: Math.round(Math.cos(a) * 7), y: Math.round(Math.sin(a) * 7) };
  const c = Areas.reta({ x: 0, y: 0 }, fim, 7).find((q) => Math.max(Math.abs(q.x), Math.abs(q.y)) >= n && q.y !== 0);
  return [c.x, c.y];
}

// ---------------------------------------------------------------- 1 e 2: cada projétil no tempo dele; o principal perdido não leva os outros

test('o projétil a mais cai no tempo DELE: o bicho perto no leque leva antes do alvo longe, e os tiros dos a mais saem no uso (as Facas Etéreas, 10,4 m/s, alcance 7)', { skip: SEM }, async () => {
  // (o 1º a mais sai a +10°: a casa (4, 1))
  const [dx, dy] = casaDoLeque(4, 10);
  const { e, bichos: [alvo, noLeque] } = await montar('Wands/Driftwood_Wand', 'Ethereal_Knives', [], [[6, 0], [dx, dy]]);
  const ev = usar(e, alvo);
  // os tiros: o principal e os a mais, todos no uso, cada um com o tempo do voo dele
  const tiros = ev.filter((x) => x.t === 'shot');
  assert.ok(tiros.length > 2, `os tiros no uso (${tiros.length})`);
  assert.ok(tiros.every((x) => x.ms > 0), 'cada um com o tempo do voo dele');
  const ts = tiques(e, 8);
  const tAlvo = quandoAcertou(ev, ts, alvo);
  const tLeque = quandoAcertou(ev, ts, noLeque);
  // o alvo: o contato a 5,5 casas a 5,2 c/s = 1058 ms → o tique de 1000; o do leque: √17 = 4,12 casas → 793 ms → o tique de 750 (antes: junto do alvo, 1000)
  assert.equal(tAlvo, 1000);
  assert.ok(tLeque != null && tLeque < tAlvo, `o do leque (${tLeque}) antes do alvo (${tAlvo})`);
  assert.equal(tLeque, 750);
});

test('o principal que se perde (o alvo saiu da reta no voo) não leva os outros: o bicho no leque é acertado assim mesmo, o alvo não', { skip: SEM }, async () => {
  const [dx, dy] = casaDoLeque(4, 10);
  const { e, bichos: [alvo, noLeque] } = await montar('Wands/Driftwood_Wand', 'Ethereal_Knives', [], [[6, 0], [dx, dy]]);
  const ev = usar(e, alvo);
  alvo.y -= 5;
  const ts = tiques(e, 10);
  assert.equal(quandoAcertou(ev, ts, alvo), null, 'o alvo saiu da frente');
  assert.equal(quandoAcertou(ev, ts, noLeque), 750, 'o do leque leva no tempo dele');
});

test('o resolvedor com o principal perdido (alvo null, o rumo do tiro): os projéteis a mais saem no leque e acertam quem está no caminho deles', () => {
  const TAGS = ['projectile', 'single', 'hit'];
  const b = (uid, x, y) => ({ uid, x, y, hp: 100 });
  const [dx, dy] = casaDoLeque(4);
  const noLeque = b('n', dx, dy);
  const atras = b('t', -3, 0);
  const r = Secundarios.resolver({ efeito: { alvosExtras: 2 }, tags: TAGS, origem: { x: 0, y: 0 }, alvo: null, atingidos: [], vivos: [noLeque, atras], alcance: 7, rumo: { x: 6, y: 0 }, rng: () => 0.5, voo: true });
  assert.deepEqual(r.golpes.filter((g) => g.tipo === 'projetil').map((g) => g.bicho.uid), ['n']);
  assert.equal(r.emitidos.length, 3, 'o principal (perdido) e os 2 a mais');
  assert.equal(r.emitidos[0].bicho, null);
  // as partes do voo: 'extras' só os a mais; 'principal' só o principal
  const soExtras = Secundarios.resolver({ efeito: { alvosExtras: 2 }, tags: TAGS, origem: { x: 0, y: 0 }, alvo: null, atingidos: [], vivos: [noLeque, atras], alcance: 7, rumo: { x: 6, y: 0 }, rng: () => 0.5, voo: true, parte: 'extras' });
  assert.equal(soExtras.emitidos.length, 2);
  assert.deepEqual(soExtras.golpes.map((g) => g.bicho.uid), ['n']);
  const soPrincipal = Secundarios.resolver({ efeito: { alvosExtras: 2 }, tags: TAGS, origem: { x: 0, y: 0 }, alvo: null, atingidos: [], vivos: [noLeque, atras], alcance: 7, rumo: { x: 6, y: 0 }, rng: () => 0.5, voo: true, parte: 'principal' });
  assert.equal(soPrincipal.emitidos.length, 1);
  assert.equal(soPrincipal.golpes.length, 0);
  // sem o voo (o modo clássico): como antes, os que saem sem alvo erram todos
  const classico = Secundarios.resolver({ efeito: { alvosExtras: 2 }, tags: TAGS, origem: { x: 0, y: 0 }, alvo: null, atingidos: [], vivos: [noLeque, atras], alcance: 7, rumo: { x: 6, y: 0 }, rng: () => 0.5 });
  assert.equal(classico.golpes.length, 0);
});

test('o caminho da gema vale nos a mais: o resolvedor usa `casasDoCaminho` no leque (o ziguezague, a espiral)', () => {
  const TAGS = ['projectile', 'single', 'hit'];
  const b = (uid, x, y) => ({ uid, x, y, hp: 100 });
  const fora = b('f', 3, 3);
  // um caminho de mentira que passa pela casa (3, 3): só com ele o a mais acerta ali
  const casasDoCaminho = () => [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }];
  const com = Secundarios.resolver({ efeito: { alvosExtras: 1 }, tags: TAGS, origem: { x: 0, y: 0 }, alvo: null, atingidos: [], vivos: [fora], alcance: 7, rumo: { x: 6, y: 0 }, voo: true, casasDoCaminho });
  assert.deepEqual(com.golpes.map((g) => g.bicho.uid), ['f']);
  const sem = Secundarios.resolver({ efeito: { alvosExtras: 1 }, tags: TAGS, origem: { x: 0, y: 0 }, alvo: null, atingidos: [], vivos: [fora], alcance: 7, rumo: { x: 6, y: 0 }, voo: true });
  assert.equal(sem.golpes.length, 0);
});

// ---------------------------------------------------------------- 3 e 4: o que não é projétil não voa

test('a Absolvição Fortalecida do Juiz (e o cone do Elemental de Fogo, a Absolvição Vaal) não voa: cai na hora; o Morteiro do Golem de Chamas (projétil) voa', () => {
  const qualquer = Object.keys(LH.DADOS.lacaios)[0];
  const alvo = { uid: 'a', x: 4, y: 0, hp: 100 };
  const l = { x: 0, y: 0, poe: {} };
  for (const [id, voa] of [['AbsolutionMinionEmpowered', false], ['FireElementalConeSummoned', false], ['VaalAbsolutionDelayedBlast', false], ['FireElementalMortarSummoned', true]]) {
    const h = LH.habilidade(id, qualquer, 20);
    assert.ok(h, id);
    const golpes = [];
    let voos = 0;
    LH.usar(l, h, alvo, { hunt: {}, vivos: [alvo], golpe: (m) => { golpes.push(m.uid); return { bruto: 1 }; }, partesDoLacaio: () => [{ tipo: 'fire', f: 1 }], depoisDoVoo: (m, o, go) => { voos++; return 100; }, relogio: 0, agora: 0, rng: () => 0.5 });
    assert.equal(voos > 0, voa, `${id}: ${voa ? 'voa' : 'não voa'}`);
    if (!voa) assert.ok(golpes.includes('a'), `${id}: o golpe na hora`);
  }
});

test('a nova do chefe em volta dele não voa (Devorador do Medo, Verme Pálido, Indesejado, Urmahlullu): você perto leva na hora; a magia no alvo com projétil voa', { skip: SEM }, async () => {
  for (const k of ['the-fear-feaster', 'the-pale-worm', 'the-unwelcome', 'urmahlullu-the-immaculate']) {
    const emVolta = BOSSES[k].ataques.filter((a) => a.tipo === 'magia' && a.forma === 'area' && !a.noAlvo);
    assert.ok(emVolta.length, k);
    for (const a of emVolta) assert.equal(Poderes.voaDoBicho(a), false, `${k}: a área em volta dele não voa`);
  }
  assert.equal(Poderes.voaDoBicho({ tipo: 'magia', forma: 'alvo', tiro: 4 }), true);
  assert.equal(Poderes.voaDoBicho({ tipo: 'magia', forma: 'area', noAlvo: true, tiro: 4 }), true);
  // no jogo: a nova de raio 2 com o tiro 39 (a do Devorador), você a 2 casas — leva no lançamento, sem tique
  const { e, bichos: [bicho] } = await montar('Wands/Driftwood_Wand', 'Fireball', [], [[2, 0]]);
  const a = { tipo: 'magia', elemento: 'physical', min: 50, max: 50, intervalo: 1000, chance: 100, forma: 'area', raio: 2, alcance: 0, noAlvo: false, efeito: 17, tiro: 39 };
  const hp0 = e.hp;
  const ev = [];
  sorte(0.5, () => Poderes.magiaDoBicho({ estado: e, hunt: e.hunt, personagem: PERSONAGEM, bicho, eventos: ev, agora: e.hunt.clock, ficha: Ficha.combate(e), temEscudo: false }, a));
  assert.ok(e.hp < hp0, 'na hora');
  assert.equal(Voos.contar(e.hunt).voando, 0, 'nada no ar');
});

// ---------------------------------------------------------------- 5 e 6: o voo dos lacaios, do mercenário, do totem e do orbe

/** O dono do mercenário (o anel com "mercenario") e o mercenário do arquétipo, com a habilidade `i` da vez (o mesmo de `area-no-impacto-a3c`). */
function comMercenario(arquetipo, i) {
  const anel = Number(Object.values(ITEM_CATALOG).find((x) => x.name === 'might ring')?.id);
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 50 }), { sistema: 'poe', classePoe: 'Scion' });
  e.equipment.ring = { id: anel, count: 1, af: [], poe: { af: { mercenario: 1 } } };
  P.garantir(e);
  Ficha.invalidar(e);
  const merc = { ...M.candidato(50, () => 0.5), arquetipo, equipment: {}, doJogador: {} };
  const d = M.dados(e);
  d.contratados = [merc];
  d.ativo = merc.id;
  const f = Acoes.fichaDoMercenario(e, merc);
  return { e, l: { mercenario: true, mercId: merc.id, x: 10, y: 10, habilidades: f.habilidades, habilidade: i } };
}

test('o MERCENÁRIO voa na velocidade da gema da vez (o poedb): o Disparo Congelante do criomante a 3,75 m/s, a Faísca do eletromante a 4,2 — não os 10,4 de toda magia', { skip: SEM }, () => {
  const cr = comMercenario('criomante', 0);
  assert.equal(cr.l.habilidades[0].gema, 'Frostbolt');
  const v = Acoes.vooDoLacaio(cr.e, cr.l, { magia: true });
  assert.ok(v.v0 < PV.casasPorSegundo(10.4, 1), `${v.v0}`);
  assert.ok(perto(v.v0 / PV.casasPorSegundo(3.75, 1), 1, 0.5), `${v.v0} ≈ 1,875 × a Velocidade de Projétil dele`);
  const el = comMercenario('eletromante', 0);
  assert.equal(el.l.habilidades[0].gema, 'Spark');
  const vf = Acoes.vooDoLacaio(el.e, el.l, { magia: true });
  assert.ok(vf.v0 < PV.casasPorSegundo(10.4, 1));
  assert.ok(vf.v0 > v.v0 * 0.5, 'a Faísca (4,2 m/s) não mais lenta que metade do Disparo (3,75)');
});

test('o LACAIO voa na base (D1) × a Velocidade de Projétil dos suportes da gema que o invocou (o Projéteis Mais Rápidos no Erguer Espectro); sem suporte, a base', { skip: SEM }, async () => {
  const sem = await montar('Wands/Driftwood_Wand', 'Raise_Spectre', [], [[3, 0]]);
  const l0 = { acao: G.doSlug('Raise_Spectre').acao, x: 0, y: 0 };
  assert.equal(Acoes.vooDoLacaio(sem.e, l0, { magia: false }).v0, PV.casasPorSegundo(32.6, 1));
  assert.equal(Acoes.vooDoLacaio(sem.e, l0, { magia: true }).v0, PV.casasPorSegundo(10.4, 1));
  const com = await montar('Wands/Driftwood_Wand', 'Raise_Spectre', ['Faster_Projectiles_Support'], [[3, 0]]);
  const ef = GS.efeitoNaSkill(com.e, l0.acao);
  const mod = (1 + (Number(ef?.['af:projectile_speed']) || 0) / 100) * (1 + (Number(ef?.velProjetilMaisPct) || 0) / 100);
  assert.ok(mod > 1, `o suporte dá Velocidade de Projétil ao lacaio (${mod})`);
  assert.ok(perto(Acoes.vooDoLacaio(com.e, l0, { magia: true }).v0, PV.casasPorSegundo(10.4, mod), 1e-9));
});

test('o TOTEM (Totem de Magia) voa: a Bola de Fogo dele a 3 casas não acerta no golpe, acerta no tique em que chega', { skip: SEM }, async () => {
  const { e, bichos: [alvo] } = await montar('Wands/Driftwood_Wand', 'Fireball', ['Spell_Totem_Support'], [[3, 0]]);
  usar(e, alvo);
  const l = (e.hunt.lacaios ?? []).find((x) => x.tipo === 'totem' && x.hp > 0);
  assert.ok(l, 'o totem foi posto');
  Voos.limpar(e.hunt);
  Object.assign(alvo, { x: l.x + 3, y: l.y });
  const ev = sorte(0.5, () => Cacadas.golpeDoTotem(e, e.hunt, l, alvo, Ficha.combate(e), PERSONAGEM, e.hunt.clock));
  assert.equal(acertosEm(ev ?? [], alvo).length, 0, 'não no golpe');
  const ts = tiques(e, 4);
  assert.equal(quandoAcertou([], ts, alvo), 500, '2,5 casas a 5,2 c/s = 481 ms');
});

test('o ORBE do Morto Volátil voa do cadáver até o inimigo (10,4 m/s): a 5 casas do cadáver, a explosão não sai no uso, sai no tique em que chega', { skip: SEM }, async () => {
  const { e, bichos: [b] } = await montar('Wands/Driftwood_Wand', 'Volatile_Dead', [], [[6, 0]]);
  e.hunt.cadaveres = [{ key: 'x', nome: 'Morto', look: 1, x: e.hunt.pos.x + 1, y: e.hunt.pos.y, maxHp: 100000 }];
  const ev = usar(e, b);
  assert.equal(acertosEm(ev, b).length, 0, 'não no uso');
  const ts = tiques(e, 6);
  // 5 casas a 5,2 c/s = 962 ms → o tique de 1000
  assert.equal(quandoAcertou([], ts, b), 1000);
});

test('o golpe principal do lacaio é o do CONTATO: o bicho que entrou na frente e esquivou é o principal errado — não conta o acerto (a área a cada N)', { skip: SEM }, async () => {
  const LacaiosPoe = await import('../systems/itens-poe/lacaios-poe.mjs');
  const Terreno = await import('../systems/hunt/terreno.mjs');
  const { BESTIARY } = await import('../systems/hunt/monstros.mjs');
  const rodar = (esquiva) => {
    const e = Object.assign(personagemDeTeste({ vocacao: 'sorcerer', level: 80 }), { sistema: 'poe', classePoe: 'Witch' });
    assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
    const h = e.hunt;
    h.clock = 100_000;
    Object.assign(e, { hp: 1e6, maxHp: 1e6 });
    const [alvo, frente, ...outros] = h.monstros;
    for (const o of outros) Object.assign(o, { x: h.pos.x + 60, y: h.pos.y + 60 });
    // o lacaio de longe (o golpe de ataque da tabela, sem a habilidade do PoB): o alvo do dono a 4 casas dele; o outro na frente, a 1 casa
    const q = LacaiosPoe.oQueInvoca('Raise_Zombie', 10, null, {});
    const l = { ...q, habPob: null, recargas: [], uid: 'l1', tipo: 'lacaio', x: h.pos.x + 1, y: h.pos.y, hp: q.vida, maxHp: q.vida, proximoGolpe: 0, alcanceDeAtaque: 5, perto: 8 };
    Object.assign(alvo, { x: l.x + 4, y: l.y, hp: 1e9, maxHp: 1e9 });
    Object.assign(frente, { x: l.x + 1, y: l.y, hp: 1e9, maxHp: 1e9 });
    if (esquiva) Object.assign(frente, { key: Object.keys(BESTIARY).find((k) => BESTIARY[k].poe), evasaoPct: 100_000 });
    h.alvo = alvo.uid;
    h.lacaios = [l];
    const grade = Cacadas.andarDaGrade(Cacadas.gradeDaHunt(Terreno.huntOuMapaCustom(h.huntId)), h.z);
    const ev = sorte(0.99, () => Cacadas.tiqueDosLacaios(e, h, null, grade, Date.now()));
    return { l, alvo, frente, ev };
  };
  const errou = rodar(true);
  assert.ok(errou.ev.some((x) => x.t === 'block' && x.errou && x.lacaio && x.uid === errou.frente.uid), 'o da frente esquivou');
  assert.equal(errou.alvo.hp, 1e9, 'o alvo de trás não leva (o projétil parou no da frente)');
  assert.equal(errou.l.acertos ?? 0, 0, 'o principal errou: não contou o acerto');
  const acertou = rodar(false);
  assert.ok(acertou.frente.hp < 1e9, 'o da frente levou');
  assert.equal(acertou.l.acertos, 1, 'o principal acertou: contou');
});
