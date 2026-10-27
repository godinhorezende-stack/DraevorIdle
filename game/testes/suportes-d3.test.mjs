// (lote D3, decisões do dono 27/10) AS DECISÕES DO S2B: o Escudo de Carne ("Defensivos": só atacam a até 3 casas de você), o Predador (a Presa marcada sozinha a cada 0,8 s, o
// foco nela e o "mais Dano … às suas Presas"), a Legião Infernal (a queima em volta do lacaio e o dano nele), o Solo Maldito e o Sapo Enfeitiçado (o solo no alvo, o Feitiço
// sem duração dentro, o Sapo Explosivo), a Destruição Iminente na morte (e não na troca pelo limite) e a Carne Fresca nos permanentes (0 s). Os sorteios ficam travados.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste } = await import('./apoio.mjs');
const Acoes = await import('../systems/acoes.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const G = await import('../systems/itens-poe/gemas-poe.mjs');
const SP = await import('../systems/itens-poe/suportes-poe.mjs');
const S2B = await import('../systems/itens-poe/suportes-s2b.mjs');
const LacaiosPoe = await import('../systems/itens-poe/lacaios-poe.mjs');
const Reforcos = await import('../systems/skills/reforcos.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Combate = await import('../systems/hunt/combate.mjs');
const Terreno = await import('../systems/hunt/terreno.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');

let J;
let gerarPeca;
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
const perto = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
function travado(v, fn) {
  const antes = Math.random;
  Math.random = typeof v === 'function' ? v : () => v;
  try { return fn(); } finally { Math.random = antes; }
}
const doSlug = (s) => G.doSlug(s) ?? SP.doSlug(s);
const TAGS = (...t) => ({ tags: t.map((x) => `poe:${x}`) });
const TODAS = TAGS('Magia', 'Ataque', 'Área', 'Caos', 'Lacaio', 'Feitiço', 'Maldição', 'Duração');
const ef = (slug, nivel = 20, q = 20, tags = TODAS) => SP.efeitoNoNivel(slug, nivel, q, tags).efeito;
async function montar(slugs, { arma = 'One_Hand_Swords/Rusted_Sword', nivel = 20, qualidade = 0 } = {}) {
  J ??= await import('../systems/itens-poe/jogo.mjs');
  gerarPeca ??= (await import('../systems/itens-poe/gerar.mjs')).gerarPeca;
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Scion', sistema: 'poe' });
  const a = peca(arma);
  a.soquetes = { abertos: slugs.length, links: Array(Math.max(0, slugs.length - 1)).fill(true), gemas: Array(slugs.length).fill(null), cores: Array(slugs.length).fill('W') };
  e.equipment = { ...e.equipment, weapon: a };
  delete e.equipment.shield;
  e.inventory = slugs.map((s) => GS.itemDaGema({ id: doSlug(s).itemId, nivel, xp: 0, raridade: 'comum', qualidade }));
  for (let i = 0; i < slugs.length; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: G.doSlug(slugs[0]).acao, enabled: true, minMana: 0, conditions: [] };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(travado(0.5, () => Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' })).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 1e7;
  e.maxHp = e.hp = 1e7;
  const [b, ...resto] = e.hunt.monstros;
  for (const m of resto) Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60, hp: 1e12, maxHp: 1e12 });
  Object.assign(b, { x: e.hunt.pos.x + 1, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12, estados: {}, dots: [] });
  return { e, b, resto };
}
function usar(e, b, v = 0.5) {
  const eventos = [];
  const r = travado(v, () => Acoes.disparar(e, e.hunt, { nome: 'T' }, 0, b, { manual: true }));
  assert.ok(r.ok, JSON.stringify(r));
  eventos.push(...(r.eventos ?? []));
  if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; eventos.push(...(travado(v, () => Acoes.concluirConjuracao(e, e.hunt, { nome: 'T' })) ?? [])); }
  return eventos;
}
const bicho = (extra = {}) => ({ uid: 'b' + Math.random(), name: 'Alvo', x: 10, y: 10, z: 0, hp: 1000, maxHp: 1000, estados: {}, dots: [], ...extra });
const invocar = (slug, efeito = null) => LacaiosPoe.oQueInvoca(slug, 20, { nivel: 20, qualidade: 0, ...(efeito ?? {}) }, {});

test('D3: o Escudo de Carne, o Predador, a Legião Infernal, o Solo Maldito e o Sapo Enfeitiçado saem de "parcial"; os números (nível 20, o Sapo no 3)', { skip: SEM }, () => {
  for (const s of ['Meat_Shield_Support', 'Predator_Support', 'Infernal_Legion_Support', 'Cursed_Ground_Support', 'Hextoad_Support']) assert.equal(SP.doSlug(s)?.status, 'funciona', `${s}: ${(SP.doSlug(s)?.motivos ?? []).join(' | ')}`);
  assert.equal(ef('Meat_Shield_Support').lacaioDefensivo, 1);
  const p = ef('Predator_Support');
  assert.deepEqual([p.lacaioPredador, p.lacaioMaisPresaPct, p.presaMs, p.presaRecargaMs, p.lacaioMaisDanoPct], [1, 24, 8000, 800, 12]);
  const l = ef('Infernal_Legion_Support');
  assert.deepEqual([l.legiaoDegenPct, l.legiaoDps, l.legiaoRaioM], [40, 2468.6, 0.5]);
  assert.equal(ef('Cursed_Ground_Support').soloMalditoMs, 34_000);
  const h = ef('Hextoad_Support', 3, 20);
  assert.deepEqual([h.soloMalditoMs, h.sapoIntervaloMs, h.sapoMin, h.sapoMax, h.sapoRaioM, h.sapoDefinharMs, h.sapoCrit, h.sapoEficacia], [14_000, 800, 2504, 3757, 2.3, 2000, 5, 4]);
  // (nada disso vai para a habilidade suportada)
  for (const k of ['duracaoPct', 'recargaPct', 'somadoMin:chaos']) assert.equal(h[k], undefined, k);
});

test('D3: o Escudo de Carne — "Defensivos": o lacaio só pega inimigos a até 3 casas de você (o alvo do dono também)', { skip: SEM }, () => {
  const hunt = { clock: 1000, pos: { x: 0, y: 0 }, monstros: [], lacaios: [] };
  const mk = (s2b) => ({ x: 0, y: 1, perto: 3, poe: { s2b } });
  const longe = bicho({ uid: 'longe', x: 4, y: 0 });
  hunt.monstros = [longe];
  assert.equal(Cacadas.alvoDoFamiliar(hunt, mk(null), 1000), longe, 'sem o suporte, pega a 4 casas');
  const def = mk(S2B.doLacaio(ef('Meat_Shield_Support')));
  assert.equal(Cacadas.alvoDoFamiliar(hunt, def, 1000), null, 'Defensivo: a 4 casas de você, não');
  const perto3 = bicho({ uid: 'p3', x: 3, y: -3 });
  hunt.monstros = [longe, perto3];
  assert.equal(Cacadas.alvoDoFamiliar(hunt, def, 1000), perto3);
});

test('D3: o Predador — a Presa sozinha a cada 0,8 s no Raro/Único mais perto (sem nenhum, o alvo atual), o foco nela e o "24% mais Dano" só contra ela', { skip: SEM }, () => {
  const s2b = S2B.doLacaio(ef('Predator_Support'));
  const l = { tipo: 'lacaio', hp: 10, x: 0, y: 3, perto: 3, poe: { danoIncPct: 0, s2b } };
  const comum = bicho({ uid: 'c', x: 1, y: 0 });
  const raro = bicho({ uid: 'r', x: 5, y: 0, raridade: 'raro' });
  const unico = bicho({ uid: 'u', x: 7, y: 0, raridade: 'unico' });
  const hunt = { clock: 1000, pos: { x: 0, y: 0 }, monstros: [comum, raro, unico], lacaios: [l] };
  assert.equal(S2B.tiqueDaPresa(hunt, [], comum, 1000), null, 'sem lacaio com o Predador, nada');
  assert.equal(S2B.tiqueDaPresa(hunt, hunt.lacaios, comum, 1000), raro, 'o Raro mais perto (não o alvo atual)');
  assert.deepEqual(hunt.poeS2B.presa, { uid: 'r', ate: 9000 });
  // (na recarga: não troca)
  raro.hp = 0;
  assert.equal(S2B.tiqueDaPresa(hunt, hunt.lacaios, comum, 1500), null);
  assert.equal(S2B.tiqueDaPresa(hunt, hunt.lacaios, comum, 1800), unico, 'depois de 0,8 s, o Único');
  unico.hp = 0;
  assert.equal(S2B.tiqueDaPresa(hunt, hunt.lacaios, comum, 2600), comum, 'sem Raro/Único: o alvo atual');
  // o foco: a Presa antes do alvo do dono e do mais perto
  const outro = bicho({ uid: 'o', x: 0, y: 2 });
  unico.hp = 1000;
  hunt.monstros.push(outro);
  hunt.poeS2B.presa = { uid: 'u', ate: 5000 };
  hunt.clock = 3000;
  assert.equal(Cacadas.alvoDoFamiliar(hunt, l, 3000), unico);
  assert.notEqual(Cacadas.alvoDoFamiliar(hunt, { ...l, poe: { s2b: null } }, 3000), unico, 'sem o Predador: não foca a Presa (o alvo do dono ou o mais perto)');
  // o "mais Dano … às suas Presas": só nela
  assert.ok(perto(S2B.noGolpeDoLacaio(hunt, l, unico, 3000).fator, 1.24));
  assert.equal(S2B.noGolpeDoLacaio(hunt, l, outro, 3000).fator, 1);
  assert.equal(S2B.noGolpeDoLacaio(hunt, l, unico, 5001).fator, 1, 'a Presa acabou (8 s)');
});

/** O tique dos lacaios com o Math.random fixo e um Zumbi ao lado do bicho `b`. */
async function tiqueDoZumbi(efeito, { random = 0.5, antes = null } = {}) {
  const { e, b } = await montar(['Raise_Zombie']);
  const h = e.hunt;
  const q = invocar('Raise_Zombie', efeito);
  const l = { ...q, uid: 'l1', tipo: 'lacaio', x: h.pos.x + 2, y: h.pos.y, hp: q.vida, maxHp: q.vida, proximoGolpe: Infinity, alcanceDeAtaque: 1, perto: 6 };
  Object.assign(b, { x: l.x + 1, y: l.y, hp: 1e9, maxHp: 1e9, evasaoPct: 0 });
  h.lacaios = [l];
  antes?.(h, l);
  const grade = Cacadas.andarDaGrade(Cacadas.gradeDaHunt(Terreno.huntOuMapaCustom(h.huntId)), h.z);
  const ev = travado(random, () => Cacadas.tiqueDosLacaios(e, h, null, grade, Date.now()));
  return { e, h, b, l, ev };
}

test('D3: a Legião Infernal — o raio (2 m + 0,5 m = 1,25 casa: 25% de chance de 2), a queima por tique e os 40% da Vida máxima no lacaio (com a resistência a Fogo)', { skip: SEM }, async () => {
  const s2b = S2B.doLacaio(ef('Infernal_Legion_Support'));
  assert.deepEqual(s2b.legiao, { dps: 2468.6, raioM: 2.5, degenPct: 40 });
  const a = { poe: { s2b } };
  S2B.aoInvocar(a, 0, () => 0.2);
  assert.equal(a.s2bLegiaoRaio, 2, '0,2 < 0,25: 2 casas');
  const c = { poe: { s2b } };
  S2B.aoInvocar(c, 0, () => 0.3);
  assert.equal(c.s2bLegiaoRaio, 1);
  const l = { hp: 1000, maxHp: 1000, s2bLegiaoRaio: 1, poe: { fatorDoDano: 2, dotMulti: 10, s2b } };
  const q = S2B.queimaDaLegiao(l, 250, 40);
  assert.ok(perto(q.porInimigo, 2468.6 * 2 * 1.1 * 0.25));
  assert.ok(perto(q.noLacaio, 1000 * 0.4 * 0.25 * 0.6), String(q.noLacaio));
  assert.equal(q.raio, 1);
  // (de ponta a ponta: o Zumbi queima o bicho colado e perde Vida; sem o suporte, nada — o Zumbi não bate neste tique)
  const sem = await tiqueDoZumbi(null);
  assert.equal(sem.b.hp, 1e9);
  const com = await tiqueDoZumbi(ef('Infernal_Legion_Support'), { antes: (h, z) => { z.s2bLegiaoRaio = 1; } });
  assert.ok(com.b.hp < 1e9, 'a queima pegou o bicho a 1 casa');
  assert.ok(com.l.hp < com.l.maxHp, 'o Zumbi sofre o Fogo dele');
  assert.ok(com.ev.some((x) => x.t === 'dmg' && x.uid === com.b.uid && x.lacaio));
});

test('D3: o Solo Maldito — ligar a Vulnerabilidade cria o solo no alvo (34 s); o Feitiço não pega no acerto, pega dentro sem duração, sai ao sair; o novo tira o velho', { skip: SEM }, async () => {
  const { e, b, resto } = await montar(['Vulnerability', 'Cursed_Ground_Support']);
  const id = G.doSlug('Vulnerability').acao;
  usar(e, b);
  const agora = e.hunt.clock;
  const solo = S2B.soloAgora(e.hunt, agora);
  assert.ok(solo, 'o solo nasceu');
  assert.deepEqual([solo.id, solo.x, solo.y, solo.n], [id, b.x, b.y, 1]);
  assert.ok(solo.ate - agora >= 34_000, String(solo.ate - agora));
  // (o acerto não amaldiçoa: o Feitiço é do solo)
  const longe = resto[0];
  Object.assign(longe, { x: b.x + solo.raio + 3, y: b.y });
  Reforcos.marcar(e.hunt, longe, agora);
  assert.ok(!longe.maldicoes?.[id], 'fora do solo, o acerto não amaldiçoa');
  // (o tique: dentro, amaldiçoado sem duração)
  travado(0.5, () => Acoes.tiqueDosFeiticosS2B(e, e.hunt, null, [], agora));
  assert.ok(b.maldicoes?.[id]?.solo === 1, JSON.stringify(b.maldicoes));
  assert.ok(b.maldicoes[id].ate - agora > 1e11, 'sem duração');
  assert.ok(!longe.maldicoes?.[id]);
  // (saiu do solo: perde)
  b.x += solo.raio + 1;
  travado(0.5, () => Acoes.tiqueDosFeiticosS2B(e, e.hunt, null, [], agora + 100));
  assert.ok(!b.maldicoes?.[id], 'saiu: perdeu');
  b.x -= solo.raio + 1;
  travado(0.5, () => Acoes.tiqueDosFeiticosS2B(e, e.hunt, null, [], agora + 200));
  assert.ok(b.maldicoes?.[id]?.solo === 1, 'voltou: amaldiçoado de novo');
  // (o limite de 1 área: o novo solo tira o velho — quem estava no velho e não está no novo perde)
  e.hunt.clock = agora + 10_000;
  Object.assign(longe, { hp: 1e12 });
  S2B.criarSoloMaldito(e.hunt, { id, centro: longe, casas: 0, ms: 34_000, efeitos: solo.efeitos, fator: 1, lancado: e.hunt.clock }, e.hunt.clock, () => 0.5);
  travado(0.5, () => Acoes.tiqueDosFeiticosS2B(e, e.hunt, null, [], e.hunt.clock));
  assert.ok(!b.maldicoes?.[id], 'o velho acabou');
  assert.equal(longe.maldicoes?.[id]?.solo, 2);
  // (o solo acabou: todos perdem)
  travado(0.5, () => Acoes.tiqueDosFeiticosS2B(e, e.hunt, null, [], e.hunt.clock + 34_001));
  assert.ok(!longe.maldicoes?.[id]);
  assert.equal(S2B.soloAgora(e.hunt, e.hunt.clock + 34_001), null);
});

test('D3: o Sapo Enfeitiçado — o solo de 14 s; a cada 0,8 s o Sapo Explosivo no amaldiçoado do solo (Caos na área) e o Definhando de 2 s', { skip: SEM }, async () => {
  const { e, b, resto } = await montar(['Vulnerability', 'Hextoad_Support'], { nivel: 3 });
  // (a gema de maldição no nível 20 com o suporte no 3: a montagem põe o mesmo nível nas duas — o que importa é o do Sapo)
  usar(e, b);
  const agora = e.hunt.clock;
  const solo = S2B.soloAgora(e.hunt, agora);
  assert.ok(solo && solo.sapoMs === 800, JSON.stringify(solo));
  assert.ok(solo.ate - agora >= 14_000 && solo.ate - agora < 34_000);
  const vizinho = resto[0];
  Object.assign(vizinho, { x: b.x + 1, y: b.y });
  const ev0 = travado(0.5, () => Acoes.tiqueDosFeiticosS2B(e, e.hunt, null, [], agora));
  assert.ok(!ev0.some((x) => x.fonte === 'sapo-explosivo'), 'o primeiro Sapo sai um intervalo depois');
  const ev = travado(0.5, () => Acoes.tiqueDosFeiticosS2B(e, e.hunt, null, [], agora + 800));
  assert.ok(ev.some((x) => x.t === 'explosao' && x.fonte === 'sapo-explosivo'), 'o Sapo explodiu');
  assert.ok(b.hp < 1e12 && vizinho.hp < 1e12, 'o Caos na área');
  assert.ok(b.estados?.definhado || b.estados?.definhando || JSON.stringify(b.estados).includes('definh'), JSON.stringify(b.estados));
  assert.ok(!travado(0.5, () => Acoes.tiqueDosFeiticosS2B(e, e.hunt, null, [], agora + 900)).some((x) => x.fonte === 'sapo-explosivo'), 'a 0,1 s do anterior, não');
});

test('D3: a Destruição Iminente — sai na MORTE do amaldiçoado (no lugar dele, uma vez) e NÃO quando outro Feitiço o tira pelo limite', { skip: SEM }, async () => {
  const { e, b, resto } = await montar(['Vulnerability', 'Impending_Doom_Support']);
  const id = G.doSlug('Vulnerability').acao;
  const entry = Acoes.POR_ID_PUBLICO(id);
  const efe = GS.efeitoNaSkill(e, id);
  const regras = Acoes.efeitosDaMaldicao(G.buffNoNivel('Vulnerability', 20, 0).efeitos, efe, e, entry).find((x) => x.efeito === 'maldicaoRegras');
  const agora = e.hunt.clock;
  const vizinho = resto[0];
  Object.assign(vizinho, { x: b.x + 1, y: b.y, hp: 1e12, maxHp: 1e12 });
  // (a morte com o Feitiço ativo: pendente, e a explosão no tique)
  b.maldicoes = { [id]: { ate: agora + 5000, desde: agora, lancada: agora, dur: 6000, efeitos: [], s2b: regras.s2b } };
  b.hp = 0;
  assert.equal(S2B.feiticosNaMorte(e.hunt, b, agora), 1);
  assert.equal(S2B.feiticosNaMorte(e.hunt, b, agora), 0, 'uma vez só');
  const ev = travado(0.5, () => Acoes.tiqueDosFeiticosS2B(e, e.hunt, null, [], agora));
  assert.ok(ev.some((x) => x.t === 'explosao' && x.fonte === 'explosao-destruidora' && x.x === b.x));
  assert.ok(vizinho.hp < 1e12, 'o vizinho do morto levou o Caos');
  // (de ponta a ponta: a morte pelo processamento de mortes deixa a pendente)
  const m2 = await montar(['Vulnerability', 'Impending_Doom_Support']);
  m2.b.maldicoes = { [id]: { ate: m2.e.hunt.clock + 5000, desde: 0, lancada: 0, dur: 6000, efeitos: [], s2b: regras.s2b } };
  m2.b.hp = 0;
  travado(0.5, () => Combate.processarMortes(m2.e, { nome: 'T' }, []));
  assert.equal(m2.e.hunt.poeS2B?.doomPendentes?.length, 1);
  // (a troca pelo limite: a nova tira a velha sem a Explosão)
  const c = bicho({ x: 30, y: 30, maldicoes: { velha: { ate: agora + 5000, desde: 0, lancada: 0, dur: 6000, efeitos: [], s2b: regras.s2b } } });
  e.hunt.monstros.push(c);
  e.hunt.poeS2B.doomPendentes = [];
  Reforcos.marcarCom(e.hunt, c, [{ id: 'nova', def: { tipo: 'poe-maldicao', efeitos: [{ efeito: 'marcaVulneravel', pct: 10, durMarca: 6000 }, { efeito: 'maldicaoRegras', limite: 1, feitico: true }] }, fator: 1, lancado: agora, emAura: false }], agora);
  assert.ok(c.maldicoes.nova && !c.maldicoes.velha, 'trocou');
  assert.equal(S2B.feiticosQueTerminaram(e.hunt, agora).length, 0, 'a troca não ativa a Explosão');
});

test('D3: a Carne Fresca nos lacaios permanentes — 0 s (sem duração, sem a Fúria Desperta e a Adrenalina)', { skip: SEM }, () => {
  const permanente = { tipo: 'lacaio', poe: { s2b: S2B.doLacaio(ef('Fresh_Meat_Support')) } };
  S2B.aoInvocar(permanente, 10_000);
  assert.equal(permanente.s2bCarneFrescaAte, undefined);
  assert.equal(S2B.adrenalinaDoLacaio(permanente, 10_000), false);
});
