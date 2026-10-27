// (correções F3, 27/10) A REVISÃO DOS SUPORTES DOS LOTES S2B E D3: a magia ativada (a Explosão Prismática, a Explosão Destruidora) só com os suportes que a suportariam
// (a Brutalidade a deixa sem dano elemental) e o raio com a fração; a Destruição Iminente e o Solo Maldito fora da maldição em aura (a Blasfêmia — o PoB, excludeSkillTypes
// Aura); a Destruição Iminente também na morte pelo golpe básico; o Escudo de Carne e o Predador também nas magias do espectro e nas habilidades com recarga; a Adrenalina
// somada aos aumentados das suas auras; a queima da Legião Infernal sem a sua penetração; as chances "por acerto" da Tríade Profana. Os sorteios ficam travados.
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
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
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
const PERSONAGEM = { nome: 'T' };
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
  const r = travado(v, () => Acoes.disparar(e, e.hunt, PERSONAGEM, 0, b, { manual: true }));
  assert.ok(r.ok, JSON.stringify(r));
  eventos.push(...(r.eventos ?? []));
  if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; eventos.push(...(travado(v, () => Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM)) ?? [])); }
  return eventos;
}
const bicho = (extra = {}) => ({ uid: 'b' + Math.random(), name: 'Alvo', x: 10, y: 10, z: 0, hp: 1000, maxHp: 1000, estados: {}, dots: [], ...extra });
const invocar = (slug, efeito = null) => LacaiosPoe.oQueInvoca(slug, 20, { nivel: 20, qualidade: 0, ...(efeito ?? {}) }, {});

/** A Explosão Prismática do Golpe Pesado (com `extra` no grupo) no alvo colado: o dano dela (rng 0). */
async function prisma(extra = []) {
  const { e, b } = await montar(['Heavy_Strike', 'Prismatic_Burst_Support', ...extra]);
  const entry = Acoes.POR_ID_PUBLICO(G.doSlug('Heavy_Strike').acao);
  const ev = Acoes.prismaNoAcerto(e, e.hunt, null, entry, GS.efeitoNaSkill(e, entry.id), b, () => 0);
  return { ev, dano: ev.filter((x) => x.t === 'dmg' && x.fonte === 'prisma').reduce((t, x) => t + x.v, 0) };
}

test('F3: a Explosão Prismática só leva os suportes que a suportariam — o "mais Dano Elemental com Ataques" e o Multigolpe não; a Brutalidade a deixa sem dano', { skip: SEM }, async () => {
  const base = await prisma();
  assert.ok(base.dano > 0, 'a explosão causa dano');
  const edwa = await prisma(['Elemental_Damage_with_Attacks_Support']);
  assert.equal(edwa.dano, base.dano, `o "mais Dano Elemental com Ataques" só vale em ataque: ${edwa.dano} vs ${base.dano}`);
  const multi = await prisma(['Multistrike_Support']);
  assert.equal(multi.dano, base.dano, `o Multigolpe não suporta magia: ${multi.dano} vs ${base.dano}`);
  const brut = await prisma(['Brutality_Support']);
  assert.ok(brut.ev.some((x) => x.t === 'explosao' && x.fonte === 'prisma'), 'a explosão sai');
  assert.equal(brut.dano, 0, 'a Brutalidade suporta a magia e a deixa sem dano elemental');
  // (o efeito recalculado pelas tags da magia: o suporte que só suporta ataques sai da lista e o "mais" dele não entra)
  const { e } = await montar(['Heavy_Strike', 'Prismatic_Burst_Support', 'Elemental_Damage_with_Attacks_Support']);
  const id = G.doSlug('Heavy_Strike').acao;
  const naMagia = Acoes.efeitoNaMagiaAtivada(e, id, ['magia', 'area', 'elemental', 'fogo', 'habilidade']);
  assert.ok(!naMagia.supports.includes(SP.doSlug('Elemental_Damage_with_Attacks_Support').suporte.nome), naMagia.supports.join(','));
  assert.equal(naMagia.fatorDeDano, 1);
});

test('F3: o raio da magia ativada — os metros ÷ 2 × √ da Área, a fração como chance (o "+0,9 m" da Explosão Prismática conta)', { skip: SEM }, async () => {
  const { e, b } = await montar(['Heavy_Strike', 'Prismatic_Burst_Support']);
  const entry = Acoes.POR_ID_PUBLICO(G.doSlug('Heavy_Strike').acao);
  const efe = GS.efeitoNaSkill(e, entry.id);
  assert.ok(perto(efe.prismaRaioM, 2.2), String(efe.prismaRaioM));
  // 2,2 m = 1,1 casa: o sorteio abaixo de 0,1 dá 2 casas; acima, 1 (antes, sempre 1)
  const raio = (r) => { e.hunt.poeS2B = {}; return Acoes.prismaNoAcerto(e, e.hunt, null, entry, efe, b, r).find((x) => x.t === 'explosao')?.raio; };
  assert.equal(raio(() => 0.05), 2);
  assert.equal(raio(() => 0.5), 1);
  // 1,3 m (sem o "+X metros") = 0,65 casa: o mínimo é 1
  assert.equal(raio(() => 0.5), raio(() => 0.99));
  const sem = { ...efe, prismaRaioM: 1.3 };
  e.hunt.poeS2B = {};
  assert.equal(Acoes.prismaNoAcerto(e, e.hunt, null, entry, sem, b, () => 0.05).find((x) => x.t === 'explosao')?.raio, 1);
});

test('F3: a Destruição Iminente não suporta a maldição em aura (a Blasfêmia): sem o doom nas regras e nenhuma explosão quando a da aura vence', { skip: SEM }, async () => {
  const { e, b, resto } = await montar(['Vulnerability', 'Blasphemy_Support', 'Impending_Doom_Support']);
  const id = G.doSlug('Vulnerability').acao;
  const entry = Acoes.POR_ID_PUBLICO(id);
  const efe = GS.efeitoNaSkill(e, id);
  assert.ok(efe.maldicaoEmAura > 0 && efe.doomBlast > 0, JSON.stringify({ aura: efe.maldicaoEmAura, doom: efe.doomBlast }));
  const regras = Acoes.efeitosDaMaldicao(G.buffNoNivel('Vulnerability', 20, 0).efeitos, efe, e, entry).find((x) => x.efeito === 'maldicaoRegras');
  assert.ok(!regras?.s2b?.doom, JSON.stringify(regras?.s2b));
  // (e a guarda: a maldição posta pela aura, mesmo com um doom gravado, não ativa a Explosão — nem ao vencer, nem ao apagar, nem na morte)
  const agora = e.hunt.clock;
  Object.assign(resto[0], { x: b.x + 1, y: b.y });
  b.maldicoes = { [id]: { ate: agora - 1, desde: agora - 6000, lancada: agora - 6000, dur: 6000, efeitos: [], aura: true, s2b: { doom: true } } };
  const ev = travado(0.5, () => Acoes.tiqueDosFeiticosS2B(e, e.hunt, PERSONAGEM, [], agora));
  assert.ok(!ev.some((x) => x.fonte === 'explosao-destruidora'), 'a da aura não explode');
  S2B.antesDeApagar(e.hunt, b, id, b.maldicoes[id], agora);
  b.maldicoes[id].ate = agora + 5000;
  assert.equal(S2B.feiticosNaMorte(e.hunt, b, agora), 0);
  assert.equal(S2B.feiticosQueTerminaram(e.hunt, agora).length, 0);
  // (sem a Blasfêmia, o doom continua)
  const sem = await montar(['Vulnerability', 'Impending_Doom_Support']);
  const r2 = Acoes.efeitosDaMaldicao(G.buffNoNivel('Vulnerability', 20, 0).efeitos, GS.efeitoNaSkill(sem.e, id), sem.e, entry).find((x) => x.efeito === 'maldicaoRegras');
  assert.equal(r2.s2b?.doom, true);
});

test('F3: o Solo Maldito não suporta a maldição em aura (a Blasfêmia): o solo não nasce e a aura continua amaldiçoando em volta de você', { skip: SEM }, async () => {
  const { e, b } = await montar(['Vulnerability', 'Blasphemy_Support', 'Cursed_Ground_Support']);
  const id = G.doSlug('Vulnerability').acao;
  const entry = Acoes.POR_ID_PUBLICO(id);
  const efe = GS.efeitoNaSkill(e, id);
  assert.ok(efe.maldicaoEmAura > 0 && efe.soloMalditoMs > 0);
  const regras = Acoes.efeitosDaMaldicao(G.buffNoNivel('Vulnerability', 20, 0).efeitos, efe, e, entry).find((x) => x.efeito === 'maldicaoRegras');
  assert.ok(!regras?.s2b?.soloMaldito, JSON.stringify(regras?.s2b));
  usar(e, b);
  assert.equal(S2B.soloAgora(e.hunt, e.hunt.clock), null, 'o solo não nasce');
  // (a aura: o marcarCom em aura amaldiçoa o vizinho — antes, o solo pulava toda aplicação sem `solo`)
  const buff = e.hunt.buffs?.[id];
  assert.ok(buff?.efeitosPoe, 'o buff da Blasfêmia ligou');
  b.maldicoes = {};
  Reforcos.marcarCom(e.hunt, b, [{ id, def: { tipo: 'poe-maldicao', efeitos: buff.efeitosPoe }, fator: 1, lancado: e.hunt.clock, emAura: true }], e.hunt.clock);
  assert.ok(b.maldicoes[id]?.aura, JSON.stringify(b.maldicoes));
  // (sem a Blasfêmia, o Solo Maldito segue: o solo nasce)
  const sem = await montar(['Vulnerability', 'Cursed_Ground_Support']);
  usar(sem.e, sem.b);
  assert.ok(S2B.soloAgora(sem.e.hunt, sem.e.hunt.clock));
});

test('F3: a Destruição Iminente e o Propagar Feitiço também quando o golpe BÁSICO mata o amaldiçoado', { skip: SEM }, async () => {
  const { e, b, resto } = await montar(['Vulnerability', 'Hex_Bloom_Support', 'Impending_Doom_Support']);
  const id = G.doSlug('Vulnerability').acao;
  const entry = Acoes.POR_ID_PUBLICO(id);
  const regras = Acoes.efeitosDaMaldicao(G.buffNoNivel('Vulnerability', 20, 0).efeitos, GS.efeitoNaSkill(e, id), e, entry).find((x) => x.efeito === 'maldicaoRegras');
  assert.ok(regras.s2b?.doom && regras.s2b.transfereCasas > 0);
  const vizinho = resto[0];
  Object.assign(vizinho, { x: b.x + 1, y: b.y, hp: 1e12, maxHp: 1e12, maldicoes: {} });
  Object.assign(b, { hp: 1, maxHp: 1e12, evasao: 0, evasaoPct: 0, maldicoes: { [id]: { ate: e.hunt.clock + 5000, desde: e.hunt.clock, lancada: e.hunt.clock, dur: 6000, efeitos: [], s2b: regras.s2b } } });
  e.hunt.alvo = b.uid;
  for (let i = 0; i < 20 && b.hp > 0; i++) { travado(0.5, () => Combate.round(e, PERSONAGEM)); e.hunt.clock += 2000; b.maldicoes[id].ate = e.hunt.clock + 5000; }
  assert.ok(!(b.hp > 0), 'o golpe básico matou');
  assert.ok(!e.hunt.monstros.includes(b), 'saiu da sala (matarMonstro)');
  assert.equal(e.hunt.poeS2B?.doomPendentes?.length, 1, 'a Explosão Destruidora ficou pendente');
  assert.ok(vizinho.maldicoes?.[id], 'o Propagar Feitiço passou ao vizinho');
});

test('F3: o Escudo de Carne e o Predador na escolha de quem o lacaio ataca sozinho — `alvoDoLacaio` (as magias do espectro, as habilidades com recarga)', { skip: SEM }, () => {
  const hunt = { clock: 1000, pos: { x: 0, y: 0 }, monstros: [] };
  const a = bicho({ uid: 'a', x: 6, y: 0 });
  const c = bicho({ uid: 'c', x: 2, y: 0 });
  assert.equal(S2B.alvoDoLacaio(hunt, { poe: {} }, [a, c]), a, 'sem o suporte: o primeiro (o mais perto do lacaio)');
  const def = { poe: { s2b: S2B.doLacaio(ef('Meat_Shield_Support')) } };
  assert.equal(S2B.alvoDoLacaio(hunt, def, [a, c]), c, 'Defensivo: só a até 3 casas de você');
  assert.equal(S2B.alvoDoLacaio(hunt, def, [a]), null);
  const pred = { poe: { s2b: S2B.doLacaio(ef('Predator_Support')) } };
  hunt.monstros = [a, c];
  hunt.poeS2B = { presa: { uid: 'c', ate: 5000 } };
  assert.equal(S2B.alvoDoLacaio(hunt, pred, [a, c]), c, 'a Presa antes do mais perto');
  hunt.poeS2B.presa.ate = 900;
  assert.equal(S2B.alvoDoLacaio(hunt, pred, [a, c]), a, 'a Presa acabou');
});

test('F3: de ponta a ponta — o Orbe do Golem de Relâmpago com o Escudo de Carne não sai num inimigo a mais de 3 casas de você (sai sem o suporte)', { skip: SEM }, async () => {
  const orbe = async (s2b) => {
    const { e, b } = await montar(['Raise_Zombie']);
    const h = e.hunt;
    const q = invocar('Summon_Lightning_Golem');
    const g = { ...q, recargas: q.recargas.map((x) => ({ ...x })), poe: { ...q.poe, ...(s2b ? { s2b } : {}) }, uid: 'g1', tipo: 'lacaio', x: h.pos.x + 4, y: h.pos.y, hp: q.vida, maxHp: q.vida, proximoGolpe: Infinity, alcanceDeAtaque: 1, perto: 6 };
    Object.assign(b, { x: h.pos.x + 5, y: h.pos.y, hp: 1e9, maxHp: 1e9 });
    h.lacaios = [g];
    const grade = Cacadas.andarDaGrade(Cacadas.gradeDaHunt(Terreno.huntOuMapaCustom(h.huntId)), h.z);
    return travado(0.5, () => Cacadas.tiqueDosLacaios(e, h, null, grade, Date.now())).filter((x) => x.habilidade === 'LightningGolemArcSummoned').length;
  };
  assert.ok((await orbe(null)) > 0, 'sem o suporte, o Orbe sai');
  assert.equal(await orbe(S2B.doLacaio(ef('Meat_Shield_Support'))), 0, 'Defensivo: a 5 casas de você, não');
});

test('F3: a Adrenalina soma aos aumentados das suas auras (uma conta só): 1 + 0,5 + 1 = 2,5, não 1,5 × 2', { skip: SEM }, () => {
  const l = { tipo: 'lacaio', poe: { danoIncPct: 0 }, s2bCarneFrescaAte: 5000 };
  const hunt = { clock: 1000, pos: { x: 0, y: 0 } };
  const doAliado = (1 + 50 / 100) / 1;
  assert.ok(perto(S2B.noGolpeDoLacaio(hunt, l, null, 1000).fator, 2), 'sem aura: 100% aumentado');
  assert.ok(perto(doAliado * S2B.noGolpeDoLacaio(hunt, l, null, 1000, { incExtra: 50 }).fator, 2.5));
});

test('F3: a queima da Legião Infernal sem a sua penetração e só com o fator de Fogo do lacaio', { skip: SEM }, async () => {
  const q = invocar('Raise_Zombie', { ...ef('Infernal_Legion_Support') });
  assert.ok(q.poe.fatorDoFogo > 0 && q.poe.s2b?.legiao, JSON.stringify(q.poe.s2b));
  // (o fator do golpe com o extra Físico não entra na queima)
  const comExtra = { ...q, hp: 100, maxHp: 100, poe: { ...q.poe, fatorDoDano: q.poe.fatorDoDano * 3 } };
  assert.equal(S2B.queimaDaLegiao(comExtra, 1000).porInimigo, S2B.queimaDaLegiao({ ...q, hp: 100, maxHp: 100 }, 1000).porInimigo);
  // (de ponta a ponta: a sua penetração de Fogo não muda a queima no bicho)
  const queima = async (pen) => {
    const { e, b } = await montar(['Raise_Zombie']);
    const h = e.hunt;
    const l = { ...q, uid: 'l1', tipo: 'lacaio', x: h.pos.x + 2, y: h.pos.y, hp: q.vida, maxHp: q.vida, proximoGolpe: Infinity, alcanceDeAtaque: 1, perto: 6, s2bLegiaoRaio: 1 };
    Object.assign(b, { x: l.x + 1, y: l.y, hp: 1e9, maxHp: 1e9, resist: { fire: 40 } });
    h.lacaios = [l];
    const ficha = Ficha.combate(e);
    if (pen) ficha.penetracao = { ...(ficha.penetracao ?? {}), elemental: 20, porElemento: { ...(ficha.penetracao?.porElemento ?? {}), fire: 20 } };
    assert.equal(Ficha.combate(e), ficha, 'a mesma ficha que o tique usa');
    const grade = Cacadas.andarDaGrade(Cacadas.gradeDaHunt(Terreno.huntOuMapaCustom(h.huntId)), h.z);
    travado(0.5, () => Cacadas.tiqueDosLacaios(e, h, null, grade, Date.now()));
    return 1e9 - b.hp;
  };
  const [com, sem] = [await queima(true), await queima(false)];
  assert.ok(sem > 0, 'a queima pegou');
  assert.equal(com, sem);
});

test('F3: a Tríade Profana — cada alvo do mesmo uso sorteia o seu (o 1º pelo `fichaDoGolpe`, os outros por `resortearPorAcerto`)', { skip: SEM }, () => {
  const f = { chancesPorAcerto: { caosRaio: 90, fisico: 90 }, ignoraResDe: ['chaos', 'energy'], ignoraReducaoFisica: true };
  const copia = { ...f };
  ModsPoe.resortearPorAcerto(f, [copia], () => 0.95);
  assert.deepEqual([f.ignoraResDe, f.ignoraReducaoFisica, copia.ignoraResDe, copia.ignoraReducaoFisica], [undefined, undefined, undefined, undefined], 'o azar dos 10%');
  ModsPoe.resortearPorAcerto(f, [copia], () => 0.5);
  assert.deepEqual([f.ignoraResDe, f.ignoraReducaoFisica, copia.ignoraResDe], [['chaos', 'energy'], true, ['chaos', 'energy']]);
  // (sem a chance, nada muda)
  const g = { ignoraReducaoFisica: true };
  ModsPoe.resortearPorAcerto(g, [], () => 0.99);
  assert.equal(g.ignoraReducaoFisica, true);
});
