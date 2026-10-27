// (revisão E1a/E1b/S1, 27/10) Os achados confirmados pela revisão adversarial dos lotes E1a (lacaios e totens), E1b (armadilhas, minas, auras) e S1 (suportes), no
// modo PoE: a duração secundária das Sentinelas do Golpe Dominador, os tipos da Vaal Convocar Esqueletos, a recarga dos golens sem habilidade com recarga, a
// Sangramento da qualidade do Ceifador, o adicionado do Golem da Carniça e da Reunião pelos modificadores do lacaio, o "menos Dano" do Ceifador e a vida de base;
// a Clareza Vaal (custo zero), as ondas e a ativação da Sísmica dos Poços e da Lança-Chamas; a Proliferação e as imunidades, o bônus do Convocar o Aço, o Impelir
// no golpe básico à distância e no Mago de Batalha, o Esforço Excessivo, o deslocamento, o Toque Maldito e a Cascata Mágica no totem. Os sorteios ficam travados.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
const Acoes = await import('../systems/acoes.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Combate = await import('../systems/hunt/combate.mjs');
const G = await import('../systems/itens-poe/gemas-poe.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const L = await import('../systems/itens-poe/linhas-das-gemas.mjs');
const LacaiosPoe = await import('../systems/itens-poe/lacaios-poe.mjs');
const GemasE1a = await import('../systems/itens-poe/gemas-e1a.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const Terreno = await import('../systems/hunt/terreno.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
}

function travado(v, fn) {
  const antes = Math.random;
  Math.random = () => v;
  try { return fn(); } finally { Math.random = antes; }
}
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
const itemDe = (s) => G.doSlug(s)?.itemId ?? [...GS.DEFS.values()].find((d) => d.poe?.slug === s)?.itemId;
/** O personagem com as gemas LIGADAS na arma (um grupo só), numa caçada; o alvo imortal a (`dx`, 0) e os outros longe. */
function montar(slugs, { nivel = 20, qualidade = 0, arma = 'Wands/Driftwood_Wand', dx = 1, vocacao = 'knight', classePoe = 'Scion' } = {}) {
  const lista = [slugs].flat();
  const e = Object.assign(personagemDeTeste({ vocacao, level: 90 }), { classePoe, sistema: 'poe' });
  const a = peca(arma);
  a.soquetes = { abertos: lista.length, links: lista.slice(1).map(() => true), gemas: lista.map(() => null), cores: lista.map(() => 'W') };
  e.equipment = { ...e.equipment, weapon: a };
  delete e.equipment.shield;
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
  for (const m of resto) Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60, hp: 1e12, maxHp: 1e12 });
  Object.assign(b, { x: e.hunt.pos.x + dx, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12, estados: {}, resist: {}, dots: [], armaduraPct: -100, evasao: 0 });
  e.hunt.lacaios = [];
  return { e, b, resto };
}
function usar(e, b, slot = 0, v = 0.5) {
  return travado(v, () => {
    const x = Acoes.disparar(e, e.hunt, PERSONAGEM, slot, b, { manual: true });
    if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; return { ...x, eventos: [...(x.eventos ?? []), ...(Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM) ?? [])] }; }
    return x;
  });
}
const liberar = (e, ms = 1) => { e.hunt.cooldowns = {}; delete e.hunt.conjurando; e.hunt.clock += ms; };
const golpeBasico = (e, b, v = 0.5) => { e.hunt.alvo = b.uid; return travado(v, () => Combate.round(e, PERSONAGEM)); };
const golpesEm = (ev, m) => (ev ?? []).filter((x) => x.t === 'dmg' && x.foe !== false && x.uid === m.uid && !x.dot).map((x) => x.v);
const vizinho = (e, m, dx, dy) => Object.assign(m, { x: e.hunt.pos.x + dx, y: e.hunt.pos.y + dy, hp: 1e12, maxHp: 1e12, estados: {}, resist: {}, dots: [], armaduraPct: -100, evasao: 0 });
const ativacoesDaArmadilha = (e) => (e.hunt.poeUsosRecentes?.['ev.armadilha'] ?? []).length;
const invocar = (slug, qualidade = 0, nivel = 20) => LacaiosPoe.oQueInvoca(slug, nivel, { nivel, qualidade }, {});

// ================================================================ E1a

test('revisão E1a (1): as Sentinelas do Golpe Dominador vivem a Duração Base SECUNDÁRIA (30 s — o PoB, base_secondary_skill_effect_duration); os 3 s são a do inimigo', { skip: SEM }, () => {
  assert.equal(invocar('Dominating_Blow').duracaoMs, 30_000);
  assert.equal(invocar('Dominating_Blow_of_Inspiring').duracaoMs, 30_000);
  // no uso de verdade (sem modificador de duração): a Sentinela some em 30 s
  const { e, b } = montar('Dominating_Blow', { arma: 'One_Hand_Swords/Rusted_Sword' });
  const r = usar(e, b, 0, 0.9);
  assert.ok(r.ok, r.erro);
  const s = e.hunt.lacaios.find((l) => l.gema === 'Dominating_Blow');
  assert.ok(s, 'a Sentinela');
  assert.ok(Math.abs(s.ate - s.desde - 30_000) < 1, String(s.ate - s.desde));
});

test('revisão E1a (2): a Vaal Convocar Esqueletos chama os tipos do PoB — 21 soldados, 9 arqueiros (de longe), 5 magos (magia) e o general (corpo a corpo)', { skip: SEM }, () => {
  const q = invocar('Vaal_Summon_Skeletons');
  assert.equal(q.porUso, 36);
  assert.deepEqual(q.grupos.map((g) => [g.n, g.q.pob, g.q.nome]), [
    [21, 'RaisedSkeletonMeleeVaal', 'Esqueleto Soldado'], [9, 'RaisedSkeletonArcherVaal', 'Esqueleto Arqueiro'], [5, 'RaisedSkeletonCaster', 'Esqueleto Mago'], [1, 'RaisedSkeletonMeleeVaal', 'Esqueleto General'],
  ]);
  const [sold, arq, mago] = q.grupos.map((g) => g.q);
  assert.equal(sold.estilo.alcance, 1);
  assert.ok(arq.estilo.alcance > 1 && arq.estilo.projetil, 'o arqueiro ataca de longe, com projétil');
  assert.ok(mago.estilo.magia && mago.poe.golpeDeMagia, 'o mago conjura magia');
  assert.equal(arq.intervaloMs, Math.round(LacaiosPoe.POB.lacaios.RaisedSkeletonArcherVaal.tempo * 1000));
  // a ordem por índice: os 21 primeiros soldados, os 9 seguintes arqueiros, os 5 magos e o general; além da soma, o 1º tipo
  assert.equal(LacaiosPoe.grupoDoUso(q, 0).nome, 'Esqueleto Soldado');
  assert.equal(LacaiosPoe.grupoDoUso(q, 21).nome, 'Esqueleto Arqueiro');
  assert.equal(LacaiosPoe.grupoDoUso(q, 30).nome, 'Esqueleto Mago');
  assert.equal(LacaiosPoe.grupoDoUso(q, 35).nome, 'Esqueleto General');
  assert.equal(LacaiosPoe.grupoDoUso(q, 36).nome, 'Esqueleto Soldado');
  // o máximo, a duração e as outras gemas: sem grupos
  assert.equal(invocar('Summon_Skeletons').grupos, undefined);
  // no uso de verdade: os 36 em campo, cada um do tipo dele
  const { e, b } = montar('Vaal_Summon_Skeletons', { vocacao: 'sorcerer', classePoe: 'Witch' });
  const r = usar(e, b, 0, 0.9);
  assert.ok(r.ok, r.erro);
  const vivos = e.hunt.lacaios.filter((l) => l.gema === 'Vaal_Summon_Skeletons' && l.hp > 0);
  const conta = (nome) => vivos.filter((l) => l.nome === nome).length;
  assert.deepEqual([vivos.length, conta('Esqueleto Soldado'), conta('Esqueleto Arqueiro'), conta('Esqueleto Mago'), conta('Esqueleto General')], [36, 21, 9, 5, 1]);
  assert.ok(vivos.filter((l) => l.nome === 'Esqueleto Arqueiro').every((l) => l.alcanceDeAtaque > 1 && l.pob === 'RaisedSkeletonArcherVaal'));
  assert.ok(vivos.filter((l) => l.nome === 'Esqueleto Mago').every((l) => l.estilo.magia && l.pob === 'RaisedSkeletonCaster'));
});

test('revisão E1a (3) — dono 27/10: os golens de Relâmpago e da Carniça têm as habilidades com recarga do PoB; a Recuperação da Recarga as encurta e a linha fica feita', { skip: SEM }, () => {
  for (const s of ['Summon_Lightning_Golem_of_Hordes', 'Summon_Carrion_Golem_of_Hordes']) {
    assert.ok(!G.statusNoJogo()[s].motivos.some((m) => /Recuperação da Recarga/.test(m)), s);
    assert.equal(GemasE1a.ehLinhaE1a(s, 'Lacaios têm Recuperação da Recarga aumentada em 40 %'), true);
  }
  // os números do PoB (Skills/minion.lua): o Orbe da Tempestade (8 s, 2 usos, 6% de crítico) e a Ira (12 s, 4 s de aura); a Cascata (6 s, 65%) e o Salto (4 s, 225%)
  const rel = invocar('Summon_Lightning_Golem');
  assert.deepEqual(rel.recargas.map((h) => [h.id, h.recargaMs, h.usos]), [['LightningGolemArcSummoned', 8000, 2], ['LightningGolemWrath', 12000, 1]]);
  // a eficácia do PoB (statInterpolation 3) no nível do golem: (3,885209 + 0,360246 × (N − 1)) × baseEffectiveness × (1 + incremental)^(N − 1)
  const n = rel.nivel;
  const efOrbe = (3.885209 + 0.360246 * (n - 1)) * 0.78420001268387 * 1.028500000014901 ** (n - 1);
  assert.deepEqual(rel.recargas[0].dano, [Math.round(0.2 * efOrbe), Math.round(1.8 * efOrbe)]);
  const efIra = (3.885209 + 0.360246 * (n - 1)) * 0.16249999403954 * 1.019999999552965 ** (n - 1);
  assert.deepEqual([rel.recargas[1].ataque, rel.recargas[1].magia], [[Math.round(0.2 * efIra), Math.round(1.8 * efIra)], [Math.round(0.12 * efIra), Math.round(1.08 * efIra)]]);
  assert.deepEqual(invocar('Summon_Carrion_Golem').recargas.map((h) => [h.id, h.recargaMs, h.mult]), [['BoneGolemCascade', 6000, 0.65], ['BoneGolemLeapSlam', 4000, 2.25]]);
  assert.equal(invocar('Summon_Carrion_Golem_of_Hordes').recargas.length, 2, 'as variantes também');
  assert.equal(invocar('Summon_Flame_Golem').recargas, undefined, 'só os dois');
});

test('revisão E1a (3) — no tique: o Orbe acerta e recarrega em 8 s ÷ (1 + a recuperação); a Cascata e o Salto ferem a área; a Ira dá Raio a você e aos lacaios no raio', { skip: SEM }, () => {
  const golem = (slug, poe = {}) => {
    const q = invocar(slug);
    return { ...q, recargas: q.recargas.map((h) => ({ ...h })), poe: { ...q.poe, ...poe }, proximoGolpe: Infinity };
  };
  // o Orbe: 2 usos guardados — dois tiques seguidos acertam, o terceiro espera a recarga
  const g = golem('Summon_Lightning_Golem', { recargaPct: 100 });
  const ev = (aj) => tiqueDoLacaioEv(aj);
  const r1 = ev(g);
  assert.ok(r1.golpes.some((x) => x.habilidade === 'LightningGolemArcSummoned'), 'o Orbe');
  assert.ok(r1.e.hunt.poeIraDoGolem?.ate > r1.e.hunt.clock, 'a Ira');
  const orbe = r1.l.recargas[0];
  assert.equal(r1.golpes.filter((x) => x.habilidade === 'LightningGolemArcSummoned').length, 2, 'os 2 usos guardados, um por tique');
  assert.equal(orbe.carga, 0);
  assert.equal(orbe.prontoEm - r1.agora, 4000, '8 s ÷ (1 + 100%)');
  // antes da recarga, nada; com ela, um uso volta
  const grade = Cacadas.andarDaGrade(Cacadas.gradeDaHunt(Terreno.huntOuMapaCustom(r1.e.hunt.huntId)), r1.e.hunt.z);
  const antes = travado(0.5, () => Cacadas.tiqueDosLacaios(r1.e, r1.e.hunt, null, grade, r1.agora + 3999)).filter((x) => x.habilidade === 'LightningGolemArcSummoned');
  assert.equal(antes.length, 0);
  const depois = travado(0.5, () => Cacadas.tiqueDosLacaios(r1.e, r1.e.hunt, null, grade, r1.agora + 4000)).filter((x) => x.habilidade === 'LightningGolemArcSummoned');
  assert.equal(depois.length, 1);
  // a Ira em você (no raio de 2 casas): o Raio adicionado nos ataques e nas magias
  const t = r1.e.hunt.poeTemporarios ?? {};
  assert.deepEqual([t['iraDoGolem:added_energy_dmg_min']?.valor, t['iraDoGolem:spell_added_energy_dmg_max']?.valor], [g.recargas[1].ataque[0], g.recargas[1].magia[1]]);
  // a Ira nos lacaios no raio do golem: o Raio adicionado ao golpe deles (o lacaio de teste sem dano próprio: 1 → o Raio da Ira)
  const semIra = tiqueDoLacaio({ poe: { fatorDoDano: 1 } }, [{ uid: 'gi' }]);
  const comIra = tiqueDoLacaio({ poe: { fatorDoDano: 1 } }, [{ uid: 'gi' }], { poeIraDoGolem: { ate: 1e15, uid: 'gi', raio: 2, ataque: [100, 100], magia: [60, 60] } });
  assert.ok(comIra > semIra + 50, `${semIra} → ${comIra}`);
  // a Cascata e o Salto: o alvo e o vizinho dele levam
  const c = golem('Summon_Carrion_Golem');
  const r2 = tiqueDoLacaioEv(c, true);
  assert.ok(r2.golpes.filter((x) => x.habilidade === 'BoneGolemLeapSlam').length >= 2, 'o Salto na área (o alvo e o vizinho)');
  assert.ok(r2.golpes.some((x) => x.habilidade === 'BoneGolemCascade'), 'a Cascata');
});

test('revisão E1a (4): o Ceifador — a chance de Sangramento da qualidade soma à do nível (o PoB: o mesmo stat BASE, 50 + 20)', { skip: SEM }, () => {
  assert.equal(invocar('Summon_Reaper', 0).sangrar, 50);
  assert.equal(invocar('Summon_Reaper', 20).sangrar, 70);
  assert.equal(invocar('Summon_Reaper', 10).sangrar, 60);
});

/** Um tique dos lacaios com o lacaio `l` (montado de `q`) colado no alvo; `outros`: mais lacaios (que não atacam). Devolve o dano no alvo. */
function tiqueDoLacaio(ajuste = {}, outros = [], hunt = {}) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'sorcerer', level: 80 }), { sistema: 'poe', classePoe: 'Witch' });
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  const h = e.hunt;
  h.clock = 100_000;
  Object.assign(e, { hp: 1e6, maxHp: 1e6 });
  const [b, ...resto] = h.monstros;
  resto.forEach((o) => Object.assign(o, { x: h.pos.x + 60, y: h.pos.y + 60 }));
  const q = LacaiosPoe.oQueInvoca('Raise_Zombie', 10, null, {});
  const l = { ...q, uid: 'l1', tipo: 'lacaio', x: h.pos.x + 2, y: h.pos.y, hp: q.vida, maxHp: q.vida, proximoGolpe: 0, alcanceDeAtaque: 1, perto: 6, estilo: { alcance: 1, impacto: 10, elemento: 'physical' },
    dano: { min: 0, max: 0 }, somado: [0, 0], critChance: 0, critChanceBase: 0, ...ajuste, poe: { ...q.poe, precisaoBase: null, ...(ajuste.poe ?? {}) } };
  Object.assign(b, { x: l.x + 1, y: l.y, hp: 1e9, maxHp: 1e9, resist: {}, armaduraPct: -100, armadura: 0, evasao: 0, estados: {}, dots: [] });
  h.lacaios = [l, ...outros.map((o) => ({ tipo: 'lacaio', hp: 100, maxHp: 100, x: l.x - 1, y: l.y, proximoGolpe: Infinity, dano: { min: 0, max: 0 }, ...o }))];
  Object.assign(h, hunt);
  if (h.poeReuniao) h.poeReuniao = { ...h.poeReuniao, z: h.z ?? 0 };
  const grade = Cacadas.andarDaGrade(Cacadas.gradeDaHunt(Terreno.huntOuMapaCustom(h.huntId)), h.z);
  const ev = travado(0.5, () => Cacadas.tiqueDosLacaios(e, h, null, grade, Date.now()));
  return golpesEm(ev, b).reduce((t, x) => t + x, 0);
}

/** Um tique com o golem `g` (de `oQueInvoca`) colado no alvo — com `vizinho`, outro bicho ao lado do alvo. Devolve os golpes (os eventos de dano). */
function tiqueDoLacaioEv(g, comVizinho = false) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'sorcerer', level: 80 }), { sistema: 'poe', classePoe: 'Witch' });
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  const h = e.hunt;
  h.clock = 100_000;
  Object.assign(e, { hp: 1e6, maxHp: 1e6 });
  const [b, v, ...resto] = h.monstros;
  resto.forEach((o) => Object.assign(o, { x: h.pos.x + 60, y: h.pos.y + 60 }));
  const l = { ...g, uid: 'g1', tipo: 'lacaio', x: h.pos.x + 1, y: h.pos.y, z: h.z, hp: g.vida, maxHp: g.vida, alcanceDeAtaque: 1, perto: 6 };
  Object.assign(b, { x: l.x + 1, y: l.y, z: h.z, hp: 1e9, maxHp: 1e9, resist: {}, estados: {}, dots: [] });
  if (comVizinho) Object.assign(v, { x: l.x + 2, y: l.y, z: h.z, hp: 1e9, maxHp: 1e9, resist: {}, estados: {}, dots: [] });
  else Object.assign(v, { x: h.pos.x + 60, y: h.pos.y + 60 });
  h.lacaios = [l];
  const grade = Cacadas.andarDaGrade(Cacadas.gradeDaHunt(Terreno.huntOuMapaCustom(h.huntId)), h.z);
  const agora = Date.now();
  const evs = travado(0.5, () => [...Cacadas.tiqueDosLacaios(e, h, null, grade, agora), ...Cacadas.tiqueDosLacaios(e, h, null, grade, agora + 1)]);
  return { e, l, agora, golpes: evs.filter((x) => x.t === 'dmg' && x.habilidade) };
}

test('revisão E1a (5): o Físico adicionado do Golem da Carniça passa pelo aumentado/mais do lacaio (`fatorDoDano`), como o resto do golpe', { skip: SEM }, () => {
  const golem = { uid: 'g', golem: true, porLacaioFisico: [100, 100] };
  const um = tiqueDoLacaio({ poe: { fatorDoDano: 1 } }, [golem]);
  const tres = tiqueDoLacaio({ poe: { fatorDoDano: 3 } }, [golem]);
  assert.ok(um > 0, 'o adicionado entra');
  assert.ok(Math.abs(tres / um - 3) < 0.05, `${um} → ${tres}`);
});

test('revisão E1b (12) / merge (20): o adicionado do Clamor de Reunião no lacaio passa pelos modificadores dele — o aumentado/mais, o "menos" do Ceifador, o "mais" do Golem da Carniça', { skip: SEM }, () => {
  const reuniao = { poeReuniao: { ate: 1e15, raio: 10, z: 0, af: { added_fire_dmg_min: 100, added_fire_dmg_max: 100 }, lacaiosMaisPct: 0 } };
  const base = tiqueDoLacaio({ poe: { fatorDoDano: 1 } }, [], reuniao);
  assert.ok(base > 0);
  assert.ok(Math.abs(tiqueDoLacaio({ poe: { fatorDoDano: 2 } }, [], reuniao) / base - 2) < 0.05, 'o aumentado/mais da invocação');
  // o Ceifador vivo: × 0,71
  const ceifador = { uid: 'r', ceifador: { menosDanoPct: 29, menosVidaPct: 0 } };
  assert.ok(Math.abs(tiqueDoLacaio({ poe: { fatorDoDano: 1 } }, [ceifador], reuniao) / base - 0.71) < 0.02, 'o "menos Dano" do Ceifador');
  // o Golem da Carniça com 3 não-golens perto: × 1,15 no golpe dele
  const carn = tiqueDoLacaio({ golem: true, maisPorNaoGolem: { pct: 5, max: 50 }, poe: { fatorDoDano: 1 } }, [{ uid: 'z1' }, { uid: 'z2' }, { uid: 'z3' }], reuniao);
  assert.ok(Math.abs(carn / base - 1.15) < 0.02, `${base} → ${carn}`);
});

test('revisão E1a (7): o "menos Vida" do Ceifador parte da vida de base guardada — com ele morto, a vida volta exata; sem desvio a cada ciclo', { skip: SEM }, () => {
  const ceifador = { uid: 'r', tipo: 'lacaio', hp: 100, maxHp: 100, ceifador: { menosDanoPct: 0, menosVidaPct: 20 } };
  const z = { uid: 'z', tipo: 'lacaio', hp: 52, maxHp: 52 };
  const todos = [ceifador, z];
  LacaiosPoe.aplicarCeifador(todos);
  assert.equal(z.maxHp, 42);
  ceifador.hp = 0;
  LacaiosPoe.aplicarCeifador(todos);
  assert.equal(z.maxHp, 52, 'antes: round(42 / 0,8) = 53');
  // muitos ciclos com o fator mudando (Ceifadores de níveis diferentes): sem desvio
  for (let i = 0; i < 50; i++) {
    ceifador.hp = 100;
    ceifador.ceifador.menosVidaPct = i % 2 ? 29 : 20;
    LacaiosPoe.aplicarCeifador(todos);
    ceifador.hp = 0;
    LacaiosPoe.aplicarCeifador(todos);
  }
  assert.equal(z.maxHp, 52);
});

// ================================================================ E1b

test('revisão E1b (8): a Clareza Vaal zera o custo de Mana de verdade — nenhum aumentado, mais, efeito da aura ou custo fixo o desfaz', { skip: SEM }, () => {
  assert.deepEqual(L.atributosDoBuff('Suas Habilidades e de seus aliados próximos não Custam Mana'), { sem_custo_mana: 1 });
  assert.equal(G.buffNoNivel('Vaal_Clarity', 20, 0).af.sem_custo_mana, 1);
  const custo = (comClareza) => {
    const { e, b } = montar(['Fireball'], { dx: 3 });
    const f = Ficha.combate(e);
    Object.assign(f.afPoe, { custo_mana_inc: 50, custo_mana_mais: 20, custo_mana_fixo: 10 }, comClareza ? { sem_custo_mana: 0.8 } : {});
    const antes = e.mana;
    assert.ok(usar(e, b).ok);
    return antes - e.mana;
  };
  assert.ok(custo(false) > 10, 'sem a Clareza, custa');
  assert.equal(custo(true), 0, 'com ela (mesmo com 80% do efeito da aura), nada');
});

test('revisão E1b (9): a Sísmica dos Poços — "quando sua Armadilha for ativada por um Inimigo" sai uma vez por ativação, não por acerto de onda', { skip: SEM }, () => {
  const { e, b } = montar('Seismic_Trap_of_Swells');
  const acertos = golpesEm(usar(e, b, 0, 0.3).eventos, b);
  assert.equal(acertos.length, 3, 'as 3 ondas acertam');
  assert.equal(ativacoesDaArmadilha(e), 1);
  // nenhuma onda acerta: a Armadilha foi ativada do mesmo jeito
  const n = montar('Seismic_Trap_of_Swells');
  assert.equal(golpesEm(usar(n.e, n.b, 0, 0.5).eventos, n.b).length, 0);
  assert.equal(ativacoesDaArmadilha(n.e), 1);
});

test('revisão E1b (10): a Sísmica dos Poços ativada uma vez adicional repete as ondas (não um golpe de área cheio)', { skip: SEM }, () => {
  const { e, b } = montar('Seismic_Trap_of_Swells');
  Ficha.combate(e).afPoe.armadilha_ativa_de_novo = 100;
  const acertos = golpesEm(usar(e, b, 0, 0.3).eventos, b);
  assert.equal(acertos.length, 6, `as 3 ondas de cada ativação: ${acertos}`);
  assert.equal(ativacoesDaArmadilha(e), 2, 'duas ativações');
  // com o sorteio fora da chance da onda (0,5): nenhuma das duas acerta (antes, a segunda acertava a área inteira)
  const n = montar('Seismic_Trap_of_Swells');
  Ficha.combate(n.e).afPoe.armadilha_ativa_de_novo = 100;
  assert.equal(golpesEm(usar(n.e, n.b, 0, 0.5).eventos, n.b).length, 0);
});

test('revisão E1b (11): a Lança-Chamas ativada dispara o "ativada por um Inimigo" (uma vez, não por pulso) e as Armadilhas Carregadas', { skip: SEM }, () => {
  const { e, b } = montar('Flamethrower_Trap');
  usar(e, b);
  assert.ok(e.hunt.poeTorres?.length, 'as chamas');
  assert.equal(ativacoesDaArmadilha(e), 1);
  // os pulsos seguintes não são ativações
  for (let i = 0; i < 5; i++) { e.hunt.clock += 100; travado(0.5, () => Acoes.tiqueDasPlantadas(e, e.hunt, PERSONAGEM, [], e.hunt.clock)); }
  assert.equal(ativacoesDaArmadilha(e), 1);
  // as Armadilhas Carregadas: a carga ao ativar (o sorteio dentro da chance)
  const c = montar(['Flamethrower_Trap', 'Charged_Traps_Support']);
  const chance = Number(GS.efeitoNaSkill(c.e, G.doSlug('Flamethrower_Trap').acao)?.['cargaAoAtivar:frenesi']) || 0;
  assert.ok(chance > 0, 'o suporte dá a chance');
  const antes = c.e.hunt.cargasPoe?.frenesi?.n ?? 0;
  usar(c.e, c.b, 0, 0.01);
  assert.equal(c.e.hunt.cargasPoe?.frenesi?.n ?? 0, antes + 1, `a carga de Frenesi: ${JSON.stringify(c.e.hunt.cargasPoe)}`);
});

// ================================================================ S1

const bicho = (extra = {}) => ({ uid: 'b' + Math.random(), name: 'Alvo', x: 10, y: 10, z: 0, hp: 1000, maxHp: 1000, estados: {}, dots: [], ...extra });
const huntCom = (monstros, extra = {}) => ({ clock: 10_000, z: 0, pos: { x: 0, y: 0 }, monstros, ...extra });

test('revisão S1 (13): a Proliferação respeita as imunidades do vizinho — o Chefe e o de 100% de resistência a controle não Congelam, o imune não fica Eletrizado', { skip: SEM }, () => {
  const agora = 10_000;
  const alvo = bicho({ estados: { congelado: { ate: agora + 900 }, chocado: { ate: agora + 2000, pct: 30 } } });
  const comum = bicho({ x: 11, y: 10 });
  const chefe = bicho({ x: 9, y: 10, boss: true });
  const resiste = bicho({ x: 10, y: 11, resistControle: 100 });
  const imune = bicho({ x: 10, y: 9, imuneChoque: true });
  const preso = bicho({ x: 11, y: 11, estados: { controleImuneAte: agora + 500 } });
  Acoes.aposAfeccoesS1(huntCom([alvo, comum, chefe, resiste, imune, preso], { clock: agora }), alvo, ['congelado', 'eletrizado'], { proliferarElementalM: 1.5 }, [], agora);
  assert.equal(comum.estados.congelado?.ate, agora + 900);
  assert.ok(comum.estados.controleImuneAte > agora + 900, 'a imunidade de controle depois');
  assert.equal(chefe.estados.congelado, undefined, 'o Chefe');
  assert.equal(resiste.estados.congelado, undefined, '100% de resistência a controle');
  assert.equal(preso.estados.congelado, undefined, 'na imunidade de controle');
  assert.equal(imune.estados.chocado, undefined, 'o imune a Eletrização');
  assert.equal(chefe.estados.chocado?.pct, 30, 'a Eletrização no Chefe vale');
  // na sala de boss, ninguém Congela
  const a2 = bicho({ estados: { congelado: { ate: agora + 900 } } });
  const v2 = bicho({ x: 11, y: 10 });
  Acoes.aposAfeccoesS1(huntCom([a2, v2], { clock: agora, isBoss: true }), a2, ['congelado'], { proliferarElementalM: 1.5 }, [], agora);
  assert.equal(v2.estados.congelado, undefined);
});

test('revisão S1 (14): o bônus de projéteis do Convocar o Aço não vira alvos extras de um Golpe sem projétil', { skip: SEM }, () => {
  const alvos = (slug, arma, comBonus) => {
    const { e } = montar(slug, { arma });
    Ficha.combate(e).afPoe.aco_proj_extra = 2;
    if (comBonus) e.hunt.aco = { bonusAte: e.hunt.clock + 5000, consumidos: 0 };
    const entry = Acoes.POR_ID_PUBLICO(G.doSlug(slug).acao);
    return Acoes.comOsAlvosDaGema(entry, GS.efeitoNaSkill(e, entry.id), e).alvosExtras ?? 0;
  };
  assert.equal(alvos('Heavy_Strike', 'One_Hand_Swords/Rusted_Sword', true), alvos('Heavy_Strike', 'One_Hand_Swords/Rusted_Sword', false), 'o Golpe Pesado');
  assert.equal(alvos('Ice_Shot', 'Bows/Crude_Bow', true), alvos('Ice_Shot', 'Bows/Crude_Bow', false) + 2, 'o projétil ganha os 2');
});

test('revisão S1 (15): o golpe básico à distância gasta UM Impelir por ataque, não um por flecha a mais', { skip: SEM }, () => {
  const { e, b, resto } = montar([], { arma: 'Bows/Crude_Bow', dx: 3 });
  Ficha.combate(e).afPoe.extra_projectiles = 2;
  const [v1, v2] = resto;
  vizinho(e, v1, 3, 1);
  vizinho(e, v2, 3, -1);
  e.hunt.impelidos = { n: 5, ate: e.hunt.clock + 20_000, de: 'Intimidating_Cry', outros: [{ n: 4, ate: e.hunt.clock + 20_000, de: 'Rallying_Cry' }] };
  const r = golpeBasico(e, b);
  assert.ok(golpesEm(r.eventos, b).length > 0, 'o alvo');
  assert.ok([v1, v2].some((m) => golpesEm(r.eventos, m).length > 0), 'as flechas a mais acertam');
  assert.deepEqual([e.hunt.impelidos.n, e.hunt.impelidos.outros[0].n], [4, 3], 'cada Clamor gastou 1');
});

test('revisão S1 (16): o Esforço Excessivo — os dois "mais" multiplicam: 1,14 × (1 + 10% × 2 Clamores) = 1,368', { skip: SEM }, () => {
  const { e } = montar(['Ground_Slam', 'Overexertion_Support'], { arma: 'One_Hand_Swords/Rusted_Sword' });
  e.hunt.impelidos = { n: 3, ate: e.hunt.clock + 20_000, de: 'Intimidating_Cry', outros: [{ n: 6, ate: e.hunt.clock + 20_000, de: 'Seismic_Cry', so: 'pancada' }] };
  const entry = Acoes.POR_ID_PUBLICO(G.doSlug('Ground_Slam').acao);
  const v = Acoes.comOsAlvosDaGema(entry, GS.efeitoNaSkill(e, entry.id), e)['af:mais_dano@impelido'];
  assert.ok(Math.abs(v - (1.14 * 1.2 - 1) * 100) < 1e-6, String(v));
});

test('revisão S1 (17): com "Clamores não Impelem Habilidades de Deslocamento", o ataque de deslocamento não recebe a área, os alvos nem o dano do Impelir', { skip: SEM }, () => {
  const { e } = montar(['Leap_Slam', 'Overexertion_Support'], { arma: 'One_Hand_Swords/Rusted_Sword' });
  e.hunt.impelidos = { n: 3, ate: e.hunt.clock + 20_000, de: 'Intimidating_Cry' };
  const entry = Acoes.POR_ID_PUBLICO(G.doSlug('Leap_Slam').acao);
  const com = Acoes.comOsAlvosDaGema(entry, GS.efeitoNaSkill(e, entry.id), e);
  assert.ok((com['af:mais_dano@impelido'] ?? 0) > 14, 'sem a passiva, Impelido');
  Ficha.combate(e).afPoe.clamor_nao_impele_movimento = 1;
  const sem = Acoes.comOsAlvosDaGema(entry, GS.efeitoNaSkill(e, entry.id), e);
  assert.ok(!((sem['af:mais_dano@impelido'] ?? 0) > 14), String(sem['af:mais_dano@impelido']));
});

test('revisão S1 (18): o Toque Maldito não amaldiçoa com o acerto da Armadilha (o PoB: "Cannot support totems, traps, or mines")', { skip: SEM }, () => {
  const { e, b } = montar(['Fire_Trap', 'Hextouch_Support', 'Vulnerability']);
  const vuln = G.doSlug('Vulnerability').acao;
  const r = usar(e, b);
  assert.ok(r.ok, r.erro);
  assert.ok(golpesEm(r.eventos, b).length > 0, 'a Armadilha acertou');
  assert.ok(!(b.maldicoes?.[vuln]?.ate > e.hunt.clock), JSON.stringify(Object.keys(b.maldicoes ?? {})));
});

test('revisão S1 (19): a Cascata Mágica não age no uso do totem (o PoB: excludeSkillTypes SummonsTotem)', { skip: SEM }, () => {
  const { e, b, resto } = montar(['Cold_Snap', 'Spell_Totem_Support', 'Spell_Cascade_Support']);
  e.mana = e.maxMana = 1e7;
  const r = usar(e, b);
  assert.ok(r.ok, r.erro);
  const totem = e.hunt.lacaios.find((l) => l.tipo === 'totem');
  assert.ok(totem, 'o totem');
  // os vizinhos em toda a volta do alvo, até 6 casas: nenhum leva o acerto da cópia
  const longe = resto.slice(0, 8);
  [[3, 0], [-3, 0], [0, 3], [0, -3], [5, 0], [-5, 0], [0, 5], [0, -5]].forEach(([dx, dy], i) => longe[i] && Object.assign(longe[i], { x: b.x + dx, y: b.y + dy, hp: 1e12, maxHp: 1e12, estados: {}, dots: [] }));
  const ev = travado(0.5, () => Acoes.usarComoTotem(e, e.hunt, PERSONAGEM, totem, b)) ?? [];
  const eventos = Array.isArray(ev) ? ev : ev.eventos ?? [];
  assert.ok(golpesEm(eventos, b).length > 0, 'o totem acertou o alvo');
  assert.equal(longe.filter((m) => m.hp < 1e12).length, 0, 'nenhuma cópia da área');
});

test('revisão merge (21): o golpe básico Impelido pelo Clamor do Mago de Batalha ativa as magias suportadas e gasta um Impelir', { skip: SEM }, () => {
  const { e, b } = montar(['Battlemages_Cry', 'Fireball'], { arma: 'One_Hand_Swords/Rusted_Sword', dx: 1 });
  e.hunt.impelidos = { n: 5, ate: e.hunt.clock + 20_000, de: 'Battlemages_Cry' };
  const r = golpeBasico(e, b);
  assert.equal((r.eventos ?? []).filter((x) => x.t === 'gatilho').length, 1, 'a Bola de Fogo ativada');
  assert.equal(e.hunt.impelidos.n, 4);
  // sem o Impelir: nada
  const s = montar(['Battlemages_Cry', 'Fireball'], { arma: 'One_Hand_Swords/Rusted_Sword', dx: 1 });
  assert.equal((golpeBasico(s.e, s.b).eventos ?? []).filter((x) => x.t === 'gatilho').length, 0);
});
