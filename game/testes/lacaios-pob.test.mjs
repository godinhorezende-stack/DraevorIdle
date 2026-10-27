// RODADA 4 DAS GEMAS, LOTE L (27/10) — o MOTOR DAS HABILIDADES DOS LACAIOS pelo PoB (`itens-poe/lacaios-habilidades.mjs`; o dono: "quero resolver" a limitação "o
// lacaio ataca do jeito do tipo dele"). Cada lacaio usa as habilidades dele do PoB (Minions.lua → skillList; Skills/minion.lua → os números de cada uma): o golpe
// principal, as com recarga, a do início e a da Vida Baixa — o tipo (ataque/magia, corpo a corpo/projétil/área), o dano (o multiplicador do ataque, o dano base da
// magia pela eficácia do nível), o tempo, a recarga, o raio e o alcance. Uma família por bloco.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { ITEM_CATALOG, CATALOGO } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
const Acoes = await import('../systems/acoes.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const G = await import('../systems/itens-poe/gemas-poe.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const LacaiosPoe = await import('../systems/itens-poe/lacaios-poe.mjs');
const H = await import('../systems/itens-poe/lacaios-habilidades.mjs');
const Terreno = await import('../systems/hunt/terreno.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
}

const perto = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const invocar = (slug, nivel = 20, qualidade = 0) => LacaiosPoe.oQueInvoca(slug, nivel, { nivel, qualidade }, {});
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 1, rng: () => 0.5 }));
/** Uma Bruxa numa caçada de verdade com a gema na varinha; dois bichos (o alvo a 2 casas de você e um vizinho dele), sem armadura e sem resistência. */
function cacadaComGema(gema, { nivel = 20, arma = 'Wands/Driftwood_Wand' } = {}) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'sorcerer', level: 80 }), { sistema: 'poe', classePoe: 'Witch' });
  const p = peca(arma);
  p.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
  e.equipment = { ...e.equipment, weapon: p };
  delete e.equipment.shield;
  e.inventory = [GS.itemDaGema({ id: G.doSlug(gema).itemId, nivel, xp: 0, raridade: 'comum' })];
  GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: G.doSlug(gema).acao, enabled: true, minMana: 0, conditions: [] };
  assert.equal(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok, true);
  Object.assign(e, { mana: 1e6, maxMana: 1e6, hp: 1e6, maxHp: 1e6 });
  const h = e.hunt;
  h.clock = 10000;
  h.monstros = h.monstros.slice(0, 2);
  for (const [i, m] of h.monstros.entries()) Object.assign(m, { hp: 1e12, maxHp: 1e12, x: h.pos.x + 2, y: h.pos.y + i, estados: {}, dots: [], resist: { fire: 0, ice: 0, energy: 0, chaos: 0 } });
  h.lacaios = [];
  h.cadaveres = [];
  return { e, h, alvo: h.monstros[0], vizinho: h.monstros[1] };
}
const grade = (h) => Cacadas.andarDaGrade(Cacadas.gradeDaHunt(Terreno.huntOuMapaCustom(h.huntId)), h.z);
/** Um tique dos lacaios com o lacaio da gema `slug` colado no alvo (ou a `dx` dele). */
function tiqueDe(slug, { random = 0.5, nivel = 20, dx = 1, antes = null, c = null } = {}) {
  c ??= cacadaComGema('Raise_Zombie');
  const h = c.h;
  const q = LacaiosPoe.oQueInvoca(slug, nivel, { nivel, qualidade: 0 }, {});
  const l = { ...q, recargas: (q.recargas ?? []).map((x) => ({ ...x })), uid: 'l1', gema: slug, tipo: 'lacaio', x: c.alvo.x - dx, y: c.alvo.y, hp: q.vida, maxHp: q.vida, proximoGolpe: 0, alcanceDeAtaque: Math.max(1, q.estilo?.alcance ?? 1), perto: 6, acertos: 0 };
  h.lacaios = [l];
  antes?.(c, l);
  const r = Math.random;
  Math.random = () => random;
  let ev;
  try { ev = Cacadas.tiqueDosLacaios(c.e, h, null, grade(h), Date.now()); } finally { Math.random = r; }
  return { c, l, ev, q };
}
const danoEm = (ev, m, habilidade) => ev.filter((x) => x.t === 'dmg' && x.uid === m.uid && x.foe && (habilidade === undefined || x.habilidade === habilidade)).reduce((t, x) => t + x.v, 0);

// ---- as gemas que passam para o motor ----
const DO_MOTOR = ['Raise_Zombie', 'Raise_Zombie_of_Slamming', 'Raise_Zombie_of_Falling', 'Summon_Skeletons', 'Summon_Skeletons_of_Archers', 'Summon_Skeletons_of_Mages', 'Vaal_Summon_Skeletons',
  'Raise_Spectre', 'Raise_Spectre_of_Transience', 'Summon_Flame_Golem', 'Summon_Flame_Golem_of_the_Meteor', 'Summon_Flame_Golem_of_Hordes', 'Summon_Ice_Golem', 'Summon_Ice_Golem_of_Shattering',
  'Summon_Ice_Golem_of_Hordes', 'Summon_Lightning_Golem', 'Summon_Lightning_Golem_of_Hordes', 'Summon_Chaos_Golem', 'Summon_Chaos_Golem_of_Hordes', 'Summon_Chaos_Golem_of_the_Maelstr%C3%B6m',
  'Summon_Stone_Golem', 'Summon_Stone_Golem_of_Hordes', 'Summon_Stone_Golem_of_Safeguarding', 'Summon_Carrion_Golem', 'Summon_Carrion_Golem_of_Hordes', 'Summon_Carrion_Golem_of_Scavenging',
  'Summon_Holy_Relic', 'Summon_Holy_Relic_of_Conviction', 'Herald_of_Purity', 'Dominating_Blow', 'Dominating_Blow_of_Inspiring', 'Vaal_Domination', 'Absolution', 'Absolution_of_Inspiring',
  'Vaal_Absolution', 'Summon_Raging_Spirit', 'Summon_Raging_Spirit_of_Enormity', 'Summon_Reaper', 'Summon_Reaper_of_Eviscerating', 'Summon_Reaper_of_Revenants', 'Blink_Arrow',
  'Blink_Arrow_of_Bombarding_Clones', 'Blink_Arrow_of_Prismatic_Clones', 'Mirror_Arrow', 'Mirror_Arrow_of_Bombarding_Clones', 'Mirror_Arrow_of_Prismatic_Clones', 'Holy_Strike',
  'Animate_Weapon_of_Self_Reflection', 'Summon_Skitterbots', 'Bone_Offering', 'Flesh_Offering', 'Spirit_Offering', 'Convocation'];

test('L — status: as 53 gemas que seguem o PoB ficam sem o motivo do lacaio (funcionam); as 5 de Animar seguem com ele (a arma animada é um item)', { skip: SEM }, () => {
  const st = G.statusNoJogo();
  for (const s of DO_MOTOR) {
    assert.ok(H.segueOPob(s), s);
    assert.deepEqual(st[s].motivos, [], s);
    assert.equal(st[s].status, 'funciona', s);
  }
  for (const s of ['Animate_Weapon', 'Vaal_Animate_Weapon', 'Animate_Weapon_of_Ranged_Arms', 'Animate_Guardian', 'Animate_Guardian_of_Smiting']) {
    assert.equal(H.segueOPob(s), false, s);
    assert.ok(st[s].motivos.some((m) => /^o lacaio ataca do jeito do tipo dele/.test(m)), s);
  }
});

test('L — os dados do PoB: a lista de habilidades do lacaio, o alcance e a arma; cada habilidade com as flags, a recarga, o raio e os stats do nível', { skip: SEM }, () => {
  assert.deepEqual(H.DADOS.lacaios.RaisedZombie.habilidades, ['Melee', 'ZombieSlam', 'GAZombieCorpseGroundImpact']);
  assert.deepEqual([H.DADOS.lacaios.RaisedSkeletonArcher.alcance, H.DADOS.lacaios.RaisedSkeletonArcher.arma], [60, 'Bow']);
  assert.deepEqual(H.DADOS.lacaios.SummonedRagingSpirit.conversao, { fire: 100 });
  assert.equal(H.DADOS.lacaios.SummonedRagingSpirit.velMaisPct, 40);
  const slam = H.DADOS.habilidades.ZombieSlam;
  assert.deepEqual([slam.ataque, slam.corpo, slam.area, slam.raio, slam.niveis[0].cd, slam.niveis[0].mult], [true, true, true, 18, 6, 1.5]);
  const frio = H.DADOS.habilidades.SkeletonMinionProjectileCold;
  assert.deepEqual([frio.magia, frio.projetil, frio.baseEf, frio.niveis[0].v], [true, true, 2.158, [0.8, 1.2]]);
  // a eficácia da magia de lacaio (statInterpolation 3)
  assert.ok(perto(H.eficacia(1, 2.158, 0.0409), 3.885209 * 2.158));
  assert.ok(perto(H.eficacia(20, 2.158, 0.0409), (3.885209 + 0.360246 * 19) * 2.158 * 1.0409 ** 19));
});

test('L — os ZUMBIS: o golpe padrão e a Pancada do PoB (ataque em área, 150%, recarga 6 s, raio 1,8 m × 1,25); a do Zumbi da Pancada com +76% de área e de recarga', { skip: SEM }, () => {
  const q = invocar('Raise_Zombie');
  assert.deepEqual(q.habPob.principal.map((h) => h.id), ['Melee']);
  assert.equal(q.estilo.alcance, 1);
  assert.equal(q.estilo.area, undefined, 'sem o golpe em área "a cada N acertos"');
  const slam = q.recargas.find((h) => h.id === 'ZombieSlam');
  assert.deepEqual([slam.tipo, slam.recargaMs, slam.usos, slam.mult, slam.magia, slam.area], ['pob', 6000, 1, 1.5, false, true]);
  assert.ok(perto(slam.raioM, 2.25));
  // o Zumbi da Pancada: a recarga ÷ 1,76 e +76% de área só na Pancada
  const sq = invocar('Raise_Zombie_of_Slamming', 20, 20).recargas.find((h) => h.id === 'ZombieSlam');
  assert.equal(sq.recargaMs, Math.round(6000 / 1.76));
  assert.equal(sq.areaExtraPct, 76);
  // no tique: com a Pancada pronta, o zumbi a usa — o alvo e o vizinho (a 1 casa dele) levam 150% do golpe
  // (o sorteio baixo: o ataque acerta — o erro do ataque do lacaio é pela evasão do bicho)
  const { c, ev, l } = tiqueDe('Raise_Zombie', { random: 0.3 });
  const noAlvo = danoEm(ev, c.alvo, 'ZombieSlam');
  const noVizinho = danoEm(ev, c.vizinho, 'ZombieSlam');
  assert.ok(noAlvo > 0 && noVizinho > 0, JSON.stringify(ev.filter((x) => x.t === 'dmg')));
  assert.equal(l.recargas.find((h) => h.id === 'ZombieSlam').carga, 0, 'gastou o uso');
  // o próximo tique logo depois: a Pancada em recarga
  const r = Math.random;
  Math.random = () => 0.3;
  let ev2;
  try { l.proximoGolpe = 0; c.alvo.hp = c.alvo.maxHp; ev2 = Cacadas.tiqueDosLacaios(c.e, c.h, null, grade(c.h), Date.now()); } finally { Math.random = r; }
  assert.equal(danoEm(ev2, c.vizinho, 'ZombieSlam'), 0);
  const golpe = danoEm(ev2, c.alvo);
  assert.ok(golpe > 0, 'o golpe padrão segue');
  // (no mesmo bicho, com o mesmo sorteio: a Pancada ≈ 1,5 × o golpe — a armadura do bicho mexe um pouco)
  assert.ok(noAlvo > golpe * 1.2 && noAlvo < golpe * 2.2, `a Pancada ${noAlvo} ≈ 1,5 × o golpe ${golpe}`);
});

test('L — os ESQUELETOS: o guerreiro de perto; o arqueiro de longe (o ataque do arco do PoB); o mago com a magia de projétil de um elemento (o dano base do PoB pela eficácia); os da Vaal pelo tipo', { skip: SEM }, () => {
  const g = invocar('Summon_Skeletons');
  assert.deepEqual([g.habPob.principal[0].id, g.estilo.alcance, !!g.estilo.magia], ['Melee', 1, false]);
  const a = invocar('Summon_Skeletons_of_Archers');
  assert.deepEqual([a.habPob.principal[0].projetil, a.estilo.alcance, a.estilo.projetil], [true, 5, 3]);
  assert.equal(a.intervaloMs, Math.round(LacaiosPoe.POB.lacaios.RaisedSkeletonArcher.tempo * 1000));
  const m = invocar('Summon_Skeletons_of_Mages');
  assert.equal(m.habPob.fixa, true);
  assert.deepEqual(m.habPob.principal.map((h) => h.elemento), ['ice', 'fire', 'energy']);
  const frio = m.habPob.principal[0];
  const ef = H.eficacia(m.nivel, 2.158, 0.0409);
  assert.ok(perto(frio.dano[0], 0.8 * ef) && perto(frio.dano[1], 1.2 * ef), JSON.stringify(frio.dano));
  assert.equal(frio.tempoMs, 1200, 'o castTime 1,2 s');
  assert.deepEqual([m.estilo.alcance, m.estilo.magia], [5, true]);
  // no tique: o mago conjura a magia de Gelo (o elemento sorteado na invocação), com o dano base dela, e não erra
  const { c, ev, l } = tiqueDe('Summon_Skeletons_of_Mages', { random: 0.1, dx: 3 });
  assert.equal(l.habPobIndice, 0, 'o Gelo (a primeira das três)');
  const v = danoEm(ev, c.alvo, 'SkeletonMinionProjectileCold');
  assert.ok(v > 0, JSON.stringify(ev.filter((x) => x.t === 'dmg')));
  const fator = l.poe?.fatorDoDano ?? 1;
  assert.ok(v >= frio.dano[0] * fator * 0.9 && v <= frio.dano[1] * fator * 1.6, `${v} na faixa ${frio.dano.map((x) => Math.round(x * fator))}`);
  // a Vaal: cada tipo com o ataque padrão do PoB dele
  const vaal = invocar('Vaal_Summon_Skeletons');
  assert.ok(vaal.grupos.every((x) => x.q.habPob?.principal?.length));
  assert.ok(vaal.grupos.some((x) => x.q.habPob.principal[0].projetil), 'o arqueiro da Vaal: o arco');
});

test('L — o ESPECTRO pelo PoB: o monstro erguido leva os multiplicadores dele às tabelas de aliado do nível do Espectro; as magias sobem pela tabela de dano de monstro', { skip: SEM }, () => {
  const T = H.DADOS.tabelas;
  const A = LacaiosPoe.POB.tabelas;
  const poe = { nivel: 10, dano: T.danoMonstro[9] * 2, tempoAtaque: 1.5 };
  const r = H.espectroPeloPob(poe, T.vidaMonstro[9] * 3, 40);
  assert.ok(perto(r.vida, A.vida[39] * 3));
  assert.ok(perto(r.golpe, A.dano[39] * 2));
  assert.equal(r.tempoMs, 1500);
  assert.ok(perto(r.fatorDasMagias, T.danoMonstro[39] / T.danoMonstro[9]));
  assert.equal(H.espectroPeloPob(null, 100, 40), null);
  // na invocação: o Espectro ergue o cadáver de um monstro do PoE e fica com a força dele pelo PoB
  const c = cacadaComGema('Raise_Spectre');
  const chave = Object.keys(CATALOGO.bestiary).find((k) => CATALOGO.bestiary[k]?.poe?.dano > 0 && (CATALOGO.bestiary[k]?.poe?.nivel ?? 0) >= 5);
  const b = CATALOGO.bestiary[chave];
  c.h.cadaveres = [{ key: chave, nome: b.name, look: b.look, x: c.alvo.x, y: c.alvo.y, maxHp: b.hp }];
  const u = Acoes.disparar(c.e, c.h, PERSONAGEM, 0, c.alvo, { manual: true });
  if (u.ok && c.h.conjurando) { c.h.clock = c.h.conjurando.fim; Acoes.concluirConjuracao(c.e, c.h, PERSONAGEM); }
  const esp = c.h.lacaios.find((l) => l.espectro);
  assert.ok(esp, `ergueu: ${u.motivo ?? u.erro ?? ''}`);
  const pob = H.espectroPeloPob(b.poe, b.hp, esp.nivel);
  const f = esp.poe?.fatorDoDano ?? 1;
  assert.ok(perto(esp.espectro.fator, pob.fatorDasMagias * f), `${esp.espectro.fator} ≈ ${pob.fatorDasMagias * f}`);
  assert.equal(esp.intervaloMs, pob.tempoMs);
  assert.equal(esp.dano.max, Math.max(1, Math.round(pob.golpe * f * 1.2)));
});

test('L — os GOLENS: o Flamejante (o Imolar de magia + a Onda e a Bola de Magma com recarga; o do Meteoro: o Meteoro ao chegar), o Glacial (o Ciclone e a Lança; o do Despedaçamento explode na Vida Baixa), o Pétreo (a Pancada que Provoca e o Rolamento), o de Relâmpago e o da Carniça', { skip: SEM }, () => {
  const fogo = invocar('Summon_Flame_Golem');
  const imolar = fogo.habPob.principal[0];
  assert.deepEqual([imolar.id, imolar.magia, imolar.elemento, imolar.tempoMs], ['FireElementalFlameRedSummoned', true, 'fire', Math.round(250 / 0.11)]);
  assert.deepEqual(fogo.recargas.filter((h) => h.tipo === 'pob').map((h) => [h.id, h.recargaMs, h.usos]), [['FireElementalConeSummoned', 2000, 1], ['FireElementalMortarSummoned', 6000, 3]]);
  const meteoro = invocar('Summon_Flame_Golem_of_the_Meteor').recargas.find((h) => h.id === 'FireElementalMeteorSummoned');
  assert.deepEqual([meteoro.umaVez, meteoro.usos, meteoro.elemento, meteoro.mult], [true, 1, 'fire', 6.8]);
  assert.ok(meteoro.dotPorSegundo > 0);
  assert.ok(!invocar('Summon_Flame_Golem_of_the_Meteor').recargas.some((h) => h.id === 'FireElementalMortarSummoned'), 'o do Meteoro não tem a Bola de Magma');
  // o Meteoro sai uma vez (no alvo e no vizinho) e queima o chão
  const met = tiqueDe('Summon_Flame_Golem_of_the_Meteor', { dx: 2, random: 0.1 });
  assert.ok(danoEm(met.ev, met.c.alvo, 'FireElementalMeteorSummoned') > 0 && danoEm(met.ev, met.c.vizinho, 'FireElementalMeteorSummoned') > 0, JSON.stringify({ ev: met.ev.filter((x) => ['dmg', 'block', 'explosao'].includes(x.t)), l: [met.l.x, met.l.y, met.l.proximoGolpe], a: [met.c.alvo.x, met.c.alvo.y], v: [met.c.vizinho.x, met.c.vizinho.y], r: met.l.recargas.map((h) => [h.id, h.carga, h.prontoEm]) }));
  assert.ok(met.c.alvo.dots.some((d) => d.tipo === 'queimadura'), 'o Fogo no chão');
  // o Glacial: o Ciclone (2 acertos em volta dele) e a Lança de Gelo (magia de Gelo); o do Despedaçamento na Vida Baixa: a explosão e a nova, e ele some
  const gelo = invocar('Summon_Ice_Golem');
  const ciclone = gelo.recargas.find((h) => h.id === 'IceElementalIceCyclone');
  assert.deepEqual([ciclone.hits, ciclone.centro, ciclone.recargaMs], [2, 'lacaio', 6000]);
  assert.deepEqual(gelo.recargas.find((h) => h.id === 'IceElementalSpearSummoned').elemento, 'ice');
  const sh = tiqueDe('Summon_Ice_Golem_of_Shattering', { antes: (c, l) => { l.hp = l.maxHp * 0.4; for (const h of l.recargas) if (!h.vidaBaixa) h.carga = 0; } });
  assert.ok(danoEm(sh.ev, sh.c.alvo, 'DeathExplodeIceElementalSummoned') > 0, 'a explosão');
  assert.ok(danoEm(sh.ev, sh.c.alvo, 'IceElementalSpearSummonedDeathNova') > 0, 'a nova');
  assert.equal(sh.l.hp, 0, 'destruído');
  const cheio = tiqueDe('Summon_Ice_Golem_of_Shattering', { antes: (c, l) => { for (const h of l.recargas) if (!h.vidaBaixa) h.carga = 0; } });
  assert.equal(danoEm(cheio.ev, cheio.c.alvo, 'DeathExplodeIceElementalSummoned'), 0, 'com a vida cheia, não');
  // o Pétreo: a Pancada (200%, raio +200%, 33% de Provocar) e o Rolamento
  const pedra = invocar('Summon_Stone_Golem');
  const slam = pedra.recargas.find((h) => h.id === 'RockGolemSlam');
  assert.deepEqual([slam.mult, slam.recargaMs, slam.chances.provocar], [2, 4000, 33]);
  assert.ok(perto(slam.raioM, 6));
  const pd = tiqueDe('Summon_Stone_Golem', { random: 0.1 });
  assert.ok(danoEm(pd.ev, pd.c.alvo, 'RockGolemSlam') > 0);
  assert.ok(pd.c.alvo.estados.provocado, 'provocou');
  // o de Relâmpago: o projétil de magia do PoB (as recargas do Orbe e da Ira seguem as dele); o da Carniça: o Combo de 160%
  const raio = invocar('Summon_Lightning_Golem');
  assert.deepEqual([raio.habPob.principal[0].id, raio.habPob.principal[0].magia, raio.estilo.alcance], ['MonsterProjectileSpellLightningGolemSummoned', true, 3]);
  assert.ok(raio.recargas.some((h) => h.id === 'LightningGolemArcSummoned'));
  // (o Combo: 160% × a média da série do PoB — +20% ÷ 1,5 de dano e +200% ÷ 1,5 de velocidade depois do terceiro golpe)
  const combo = invocar('Summon_Carrion_Golem').habPob.principal[0];
  assert.ok(perto(combo.mult, 1.6 * (1 + 20 / 1.5 / 100)));
  assert.equal(combo.tempoMs, Math.round((LacaiosPoe.POB.lacaios.SummonedCarrionGolem.tempo / (1 + 200 / 1.5 / 100)) * 1000));
  assert.equal(invocar('Summon_Chaos_Golem').habPob.principal[0].id, 'Melee');
});

test('L — as SENTINELAS e o JUIZ: a da Pureza alterna o golpe e o golpe em área e usa a Pancada da Cruzada; a do Domínio, a Investida (sem crítico) e a Pancada; o Juiz conjura a Absolvição em área', { skip: SEM }, () => {
  const pureza = invocar('Herald_of_Purity');
  assert.deepEqual(pureza.habPob.principal.map((h) => [h.id, h.area]), [['Melee', false], ['HeraldOfLightMinionSlam', true]]);
  assert.deepEqual(pureza.recargas.filter((h) => h.tipo === 'pob').map((h) => [h.id, h.mult, h.recargaMs]), [['SentinelHolySlam', 2, 5000]]);
  const dom = invocar('Dominating_Blow');
  const inv = dom.recargas.find((h) => h.id === 'DominatingBlowMinionCharge');
  assert.deepEqual([inv.semCritico, inv.investidaMaxPct, inv.recargaMs], [true, 30, 4000]);
  const vaal = invocar('Vaal_Domination');
  assert.deepEqual([vaal.habPob.principal[0].mult, vaal.recargas.find((h) => h.id === 'GAVaalDominationLargeSlam').mult], [3, 3.5]);
  const juiz = invocar('Absolution');
  const abs = juiz.habPob.principal[0];
  assert.deepEqual([abs.id, abs.magia, abs.area, abs.elemento], ['AbsolutionMinion', true, true, 'physical']);
  assert.ok(perto(abs.raioM, 1.5), 'o raio 2 m × (1 − 25%)');
  // no tique: a Absolvição do Juiz pega o alvo e o vizinho (a área em volta do alvo)
  const t = tiqueDe('Absolution', { dx: 2, random: 0.1, antes: (c, l) => { for (const h of l.recargas) h.carga = 0; } });
  assert.ok(danoEm(t.ev, t.c.alvo, 'AbsolutionMinion') > 0 && danoEm(t.ev, t.c.vizinho, 'AbsolutionMinion') > 0, JSON.stringify(t.ev.filter((x) => x.t === 'dmg')));
  assert.ok(invocar('Vaal_Absolution').recargas.some((h) => h.id === 'VaalAbsolutionDelayedBlast'));
});

test('L — o ESPÍRITO FURIOSO e o CEIFADOR: o Espírito com 100% do Físico em Fogo, +40% de velocidade e 4 a 5 de Físico adicionado (o PoB); o Ceifador com o golpe de 50% × o "+% final" do nível', { skip: SEM }, () => {
  const e = invocar('Summon_Raging_Spirit');
  assert.equal(e.habPob.principal[0].elemento, 'fire');
  assert.equal(e.intervaloMs, Math.round((LacaiosPoe.POB.lacaios.SummonedRagingSpirit.tempo / 1.4) * 1000));
  assert.ok(e.somado[0] > 0 && e.somado[1] > e.somado[0]);
  const t = tiqueDe('Summon_Raging_Spirit');
  assert.ok(t.ev.some((x) => x.t === 'dmg' && x.uid === t.c.alvo.uid && x.color === Acoes.COR_DO_ELEMENTO.fire), 'o golpe de Fogo');
  const c = invocar('Summon_Reaper');
  const g = c.habPob.principal[0];
  // a linha do nível 28 (+1%) até a do 80 (+60%), linear pelo nível do Ceifador
  const n = c.nivel;
  const pct = 1 + ((60 - 1) * Math.min(1, (n - 28) / (80 - 28)));
  assert.ok(perto(g.mult, 0.5 * (1 + pct / 100)), `${g.mult}`);
  // o Ultimate (150%, área) no uso da gema com o Ceifador em campo; o da Evisceração não ataca sozinho, só o Ultimate; o dos Fantasmas não tem o Ultimate
  assert.ok(c.recargas.some((h) => h.id === 'SummonedReaperUltimate' && h.porUso && perto(h.mult, 1.5 * (1 + pct / 100))));
  assert.equal(H.temUltimate('Summon_Reaper_of_Revenants'), false);
  const ev = invocar('Summon_Reaper_of_Eviscerating');
  assert.deepEqual([ev.habPob.semGolpe, ev.habPob.principal.length], [true, 0]);
  const parado = tiqueDe('Summon_Reaper_of_Eviscerating');
  assert.equal(danoEm(parado.ev, parado.c.alvo), 0, 'segue você sem atacar');
  // o uso da gema com ele em campo: avança até o alvo e solta o Ultimate (o alvo e o vizinho, na área em volta dele)
  const usado = tiqueDe('Summon_Reaper_of_Eviscerating', { dx: 4, antes: (cc) => { assert.equal(H.pedirUltimate(cc.h, 'Summon_Reaper_of_Eviscerating', cc.alvo), true); } });
  assert.ok(danoEm(usado.ev, usado.c.alvo, 'SummonedReaperUltimate') > 0, JSON.stringify(usado.ev.filter((x) => x.t === 'dmg')));
  assert.ok(Math.max(Math.abs(usado.l.x - usado.c.alvo.x), Math.abs(usado.l.y - usado.c.alvo.y)) <= 1, 'avançou até o alvo');
  assert.equal(usado.l.ultimatePedido, undefined, 'o pedido foi usado');
});

test('L — os que usam a SUA arma: o clone das Flechas (175% do arco), o Armamento do Golpe Sagrado e a cópia da Auto-reflexão', { skip: SEM }, () => {
  const q = invocar('Mirror_Arrow');
  assert.deepEqual([q.habPob.arma, q.habPob.principal[0].mult, q.estilo.alcance], ['sua', 1.75, 5]);
  assert.equal(invocar('Holy_Strike').habPob.arma, 'sua');
  assert.equal(invocar('Animate_Weapon_of_Self_Reflection').habPob.arma, 'sua');
  // na invocação: o golpe é a faixa da sua arma × o "aumentado/mais" do lacaio, no tempo dela
  const l = { ...q, habPob: q.habPob, poe: { ...q.poe, fatorDoDano: 2 } };
  H.aoInvocar(l, { armas: [{ slot: 'weapon', min: 10, max: 30, intervaloMs: 700 }] });
  assert.deepEqual([l.dano.min, l.dano.max, l.intervaloMs, l.habPob.principal[0].tempoMs], [20, 60, 700, 700]);
  const sem = { ...q };
  H.aoInvocar(sem, { armas: [] });
  assert.deepEqual(sem.dano, q.dano, 'sem arma, a força de antes');
});

test('L — as gemas que não seguem o motor ficam como estavam: o totem não tem habilidades do PoB; o Animar Arma segue o jeito do tipo', { skip: SEM }, () => {
  assert.equal(invocar('Animate_Weapon').habPob, undefined);
  assert.equal(invocar('Shrapnel_Ballista')?.habPob, undefined);
  assert.equal(H.doLacaio('Raise_Zombie_of_Falling', 'RaisedZombie', 20), null, 'a Queda é do lote E2A');
  assert.equal(H.doLacaio('Summon_Holy_Relic', 'HolyLivingRelic', 20), null, 'a Relíquia é do lote R3B');
});

test('L — cada lacaio do motor luta pelas habilidades do PoB: colado no alvo, em poucos tiques, causa dano nele (os que não atacam no PoE ficam de fora: a Queda, a Relíquia, os Robôs)', { skip: SEM }, () => {
  const falhas = [];
  const NAO_ATACAM = new Set(['Raise_Zombie_of_Falling', 'Summon_Holy_Relic', 'Summon_Holy_Relic_of_Conviction', 'Summon_Skitterbots', 'Summon_Reaper_of_Eviscerating', 'Bone_Offering', 'Flesh_Offering', 'Spirit_Offering', 'Convocation', 'Raise_Spectre', 'Raise_Spectre_of_Transience']);
  for (const s of DO_MOTOR) {
    if (NAO_ATACAM.has(s)) continue;
    const c = cacadaComGema('Raise_Zombie');
    let total = 0;
    const r = Math.random;
    Math.random = () => 0.3;
    try {
      const q = invocar(s);
      const base = q.grupos ? LacaiosPoe.grupoDoUso(q, 0) : q;
      const l = { ...base, recargas: (base.recargas ?? []).map((x) => ({ ...x })), uid: 'l1', gema: s, tipo: 'lacaio', x: c.alvo.x - 1, y: c.alvo.y, hp: base.vida, maxHp: base.vida, proximoGolpe: 0, alcanceDeAtaque: Math.max(1, base.estilo?.alcance ?? 1), perto: 6, acertos: 0 };
      c.h.lacaios = [l];
      let agora = Date.now();
      for (let i = 0; i < 12 && !total; i++) {
        agora += 1000;
        c.h.clock += 1000;
        total += danoEm(Cacadas.tiqueDosLacaios(c.e, c.h, null, grade(c.h), agora), c.alvo);
      }
    } finally { Math.random = r; }
    if (!(total > 0)) falhas.push(s);
  }
  assert.deepEqual(falhas, []);
});

test('L — pela caçada de verdade: o zumbi, o esqueleto, o golem e o espírito invocados pelo uso da gema batem no alvo com as habilidades do PoB', { skip: SEM }, () => {
  for (const s of ['Raise_Zombie', 'Summon_Skeletons_of_Mages', 'Summon_Stone_Golem', 'Summon_Raging_Spirit']) {
    const c = cacadaComGema(s);
    c.h.cadaveres = [{ key: c.alvo.key, nome: 'Morto', look: 1, x: c.alvo.x, y: c.alvo.y + 1, maxHp: 100 }];
    const u = Acoes.disparar(c.e, c.h, PERSONAGEM, 0, c.alvo, { manual: true });
    if (u.ok && c.h.conjurando) { c.h.clock = c.h.conjurando.fim; Acoes.concluirConjuracao(c.e, c.h, PERSONAGEM); }
    const l = c.h.lacaios.find((x) => x.gema === s);
    assert.ok(l?.habPob, `${s}: invocou com as habilidades do PoB (${u.motivo ?? u.erro ?? ''})`);
    let total = 0;
    let agora = Date.now();
    for (let i = 0; i < 30 && !total; i++) {
      agora += 500;
      c.h.clock += 500;
      total += danoEm(Cacadas.tiqueDosLacaios(c.e, c.h, null, grade(c.h), agora), c.alvo);
    }
    assert.ok(total > 0, `${s}: bateu`);
  }
});
