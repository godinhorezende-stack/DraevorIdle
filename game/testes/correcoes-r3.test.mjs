// (correções R3, 27/10) A REVISÃO ADVERSARIAL DA RODADA 3 (os lotes R3A–R3D): o ataque ativado converte o Físico das peças, das auras e dos suportes; a habilidade concedida
// tem as tags dela e só os suportes que a suportariam; a Pira pede o incendiado de ANTES do acerto; o Relâmpago Vivo ataca no tempo do PoB; o mínimo de Poder do Clamor do
// General vale no total; a Mina Local cai no lugar mirado e a habilidade dela mira em você; duas Bênçãos não se revezam; o Fluxo Cinético rola o crítico da varinha; a
// Armadilha Conversora mexe na lista dos monstros no lugar e o convertido morto volta à fila de renascimento; o provocado pelo Chamariz conjura no totem. Os sorteios ficam
// travados.
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
const R3A = await import('../systems/itens-poe/gemas-r3a.mjs');
const R3C = await import('../systems/itens-poe/gemas-r3c.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Plantadas = await import('../systems/itens-poe/armas-plantadas.mjs');
const Poderes = await import('../systems/poderes.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Terreno = await import('../systems/hunt/terreno.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');

const P = { nome: 'T' };
function travado(v, fn) {
  const antes = Math.random;
  Math.random = typeof v === 'function' ? v : () => v;
  try { return fn(); } finally { Math.random = antes; }
}
const perto = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const doSlug = (s) => G.doSlug(s) ?? SP.doSlug(s);
const grade = (h) => Cacadas.andarDaGrade(Cacadas.gradeDaHunt(Terreno.huntOuMapaCustom(h.huntId)), h.z);

/** O personagem com a arma e os grupos de gemas ligados (cada grupo: a ativa primeiro), numa caçada; o primeiro monstro colado, os outros longe (imortais). */
async function montar(arma, grupos, { nivel = 20, qualidade = 0 } = {}) {
  const J = await import('../systems/itens-poe/jogo.mjs');
  const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Scion', sistema: 'poe' });
  const a = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: arma, raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
  const todas = grupos.flat();
  const links = grupos.flatMap((g) => g.map((_, i) => i < g.length - 1)).slice(0, todas.length - 1);
  a.soquetes = { abertos: todas.length, links, gemas: Array(todas.length).fill(null), cores: Array(todas.length).fill('W') };
  e.equipment = { ...e.equipment, weapon: a };
  delete e.equipment.shield;
  e.inventory = todas.map((s) => GS.itemDaGema({ id: doSlug(s).itemId, nivel, xp: 0, raridade: 'comum', qualidade }));
  for (let i = 0; i < todas.length; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  e.actions = Array(Acoes.SLOTS).fill(null);
  grupos.forEach((g, i) => { e.actions[i] = { id: G.doSlug(g[0]).acao, enabled: true, minMana: 0, conditions: [] }; });
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(travado(0.999, () => Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' })).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 1e7;
  e.maxHp = e.hp = 1e7;
  const ms = e.hunt.monstros;
  ms.forEach((m, i) => Object.assign(m, i === 0 ? { x: e.hunt.pos.x + 1, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12, estados: {}, dots: [], resist: {} } : { x: e.hunt.pos.x + 60 + i, y: e.hunt.pos.y + 60, hp: 1e12, maxHp: 1e12 }));
  return { e, b: ms[0], ms };
}
function usar(e, slot, alvo, v = 0.5, manual = true) {
  return travado(v, () => {
    const r = Acoes.disparar(e, e.hunt, P, slot, alvo, { manual });
    const ev = [...(r.eventos ?? [])];
    if (r.ok && e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; ev.push(...(Acoes.concluirConjuracao(e, e.hunt, P) ?? [])); }
    return { ...r, ev };
  });
}
const daFonte = (ev, fonte) => ev.filter((x) => x.t === 'dmg' && x.fonte === fonte);

// ---------------------------------------------------------------- achado 1 (alta): a conversão do Físico no ataque ativado

test('R3 #1: o ataque ativado converte o Físico das peças/auras (só no que a habilidade deixou) e dos suportes; o "Físico como Extra" sobre o Físico de antes', () => {
  const ficha = { afPoe: { phys_conv_fire: 40, phys_as_extra_ice: 20 } };
  const outras = (fis, teto) => ModsPoe.extrasDoFisico(ficha, fis, () => 0.5, teto);
  // a Fenda (60% própria) + 40% das peças: 100% de Fogo; o Gelo extra é 20% dos 100 de Físico de antes
  const p = R3A.partesDoAtivado({ arma: { min: 100, max: 100 }, basePct: 100, conversao: { fire: 60 }, outras, rng: () => 0.5 });
  assert.equal(p.physical, undefined, JSON.stringify(p));
  assert.ok(perto(p.fire, 100) && perto(p.ice, 20), JSON.stringify(p));
  // a própria (60%) + a do suporte (30% em Raio) = 90% da habilidade; as peças (40%) só nos 10% que sobraram
  const q = R3A.partesDoAtivado({ arma: { min: 100, max: 100 }, basePct: 100, conversao: { fire: 60 }, conversoesExtras: [{ para: 'energy', pct: 30 }], outras, rng: () => 0.5 });
  assert.equal(q.physical, undefined, JSON.stringify(q));
  assert.ok(perto(q.fire, 70) && perto(q.energy, 30) && perto(q.ice, 20), JSON.stringify(q));
  // sem conversão própria: só as peças (40%), o Físico que sobra fica
  const r = R3A.partesDoAtivado({ arma: { min: 100, max: 100 }, basePct: 100, outras, rng: () => 0.5 });
  assert.ok(perto(r.physical, 60) && perto(r.fire, 40) && perto(r.ice, 20), JSON.stringify(r));
  // a conversão do suporte no efeito (`af:conv_hab_physical_<el>`) sai no nome da Arena; o jogo a lê como elemento do jogo
  assert.deepEqual(G.conversoesDosSuportes({ 'af:conv_hab_physical_energy': 25 }), [{ para: 'raio', pct: 25 }]);
});

// ---------------------------------------------------------------- achado 2 (média): as tags e os suportes da habilidade concedida

test('R3 #2: a Rajada de Vento não leva o suporte corpo a corpo do Golpe Pesado (só os suportes que a suportariam, pelas tags dela)', { skip: SEM }, async () => {
  const { e } = await montar('Two_Hand_Maces/Driftwood_Maul', [['Heavy_Strike', 'Windburst_Support', 'Melee_Physical_Damage_Support']]);
  const id = G.doSlug('Heavy_Strike').acao;
  const naSuportada = GS.efeitoNaSkill(e, id);
  assert.ok((naSuportada?.fatorDeDano ?? 1) > 1, `o suporte corpo a corpo vale no Golpe Pesado: ${naSuportada?.fatorDeDano}`);
  const naRajada = Acoes.efeitoNoAtivadoR3A(e, id, ['ataque', 'projetil', 'area', 'fisico', 'habilidade']);
  assert.ok(naRajada, 'o efeito existe');
  assert.equal(naRajada.fatorDeDano ?? 1, 1, 'o "mais Dano Físico Corpo a Corpo" não suporta a Rajada (Ataque, Projétil, Área)');
  // num ataque concedido corpo a corpo (o Cristal em Queda), o mesmo suporte vale
  const noCristal = Acoes.efeitoNoAtivadoR3A(e, id, ['ataque', 'area', 'corpo', 'pancada', 'fisico', 'habilidade']);
  assert.ok((noCristal?.fatorDeDano ?? 1) > 1, `no Cristal (corpo a corpo) vale: ${noCristal?.fatorDeDano}`);
});

// ---------------------------------------------------------------- achado 3 (média): a Pira pede o incendiado de antes do acerto

test('R3 #3: a Pira — o inimigo que o próprio golpe incendeia não ativa o Chamado da Fogueira; o que já queimava, sim', { skip: SEM }, async () => {
  const { e, b } = await montar('Two_Hand_Maces/Driftwood_Maul', [['Heavy_Strike', 'Pyre_Support']]);
  // o golpe com Fogo e 100% de chance de Incendiar (os bônus temporários da ficha)
  e.hunt.poeTemporarios = { t1: { stat: 'phys_conv_fire', valor: 50, ate: 1e15 }, t2: { stat: 'chance_ignite', valor: 100, ate: 1e15 } };
  Ficha.invalidar(e);
  const r1 = usar(e, 0, b, 0.1);
  assert.ok(r1.ok, JSON.stringify(r1));
  assert.ok((b.dots ?? []).some((d) => d.tipo === 'queimadura' && d.falta > 0), 'o golpe incendiou');
  assert.equal(daFonte(r1.ev, 'chamado-da-fogueira').length, 0, 'incendiado por este golpe: não conta');
  // o segundo golpe acha o inimigo já incendiado
  e.hunt.cooldowns = {};
  e.hunt.clock += 2000;
  const r2 = usar(e, 0, b, 0.1);
  assert.ok(daFonte(r2.ev, 'chamado-da-fogueira').length >= 1, 'já queimava antes: o Chamado sai');
});

// ---------------------------------------------------------------- achado 6 (média): o intervalo do Relâmpago Vivo

test('R3 #6: o Relâmpago Vivo ataca no tempo de ataque do PoB (1,17 s), não na recarga do golpe (0,25 s)', { skip: SEM }, async () => {
  const { e, b } = await montar('Wands/Driftwood_Wand', [['Arc', 'Living_Lightning_Support']], { qualidade: 20 });
  usar(e, 0, b);
  const l = (e.hunt.lacaios ?? []).find((x) => x.r3bRelampago && x.hp > 0);
  assert.ok(l, 'invocou');
  assert.equal(l.intervaloMs, 1170);
});

// ---------------------------------------------------------------- achado 7 (baixa, simples): o mínimo de Poder do Clamor

test('R3 #7: o mínimo de Poder do Clamor vale sobre inimigos + cadáveres (não somado por cima)', () => {
  const hunt = { pos: { x: 0, y: 0 }, monstros: [{ x: 1, y: 0, hp: 10, raridade: 'normal' }] };
  const ficha = { afPoe: { clamor_poder_minimo: 10 } };
  assert.equal(ModsPoe.poderDoClamor(hunt, ficha, 5), 10, 'max(10, 1 + 5)');
  assert.equal(ModsPoe.poderDoClamor(hunt, ficha, 12), 13, 'max(10, 1 + 12)');
  assert.equal(ModsPoe.poderDoClamor(hunt, { afPoe: { clamor_poder_inc: 100 } }, 4), 10, '(1 + 4) × 2');
});

// ---------------------------------------------------------------- achado 9 (alta): a Mina Local

test('R3 #9: a Mina Local cai no lugar mirado (em arco) e detona; a habilidade dela mira em você', { skip: SEM }, () => {
  const e1 = SP.efeitoNoNivel('Locus_Mine_Support', 20, 0, { tags: ['poe:Mina', 'poe:Magia', 'poe:Projétil'] }).efeito;
  assert.equal(e1.minaEmVoceR3c, 1);
  assert.deepEqual(R3C.lugarDaMina(e1, { x: 9, y: 9 }, { x: 1, y: 2 }), { x: 9, y: 9 }, 'a Mina vai para onde foi mirada');
  assert.deepEqual(R3C.focoDaMina({ focaEmVoceR3c: true }, { x: 1, y: 2 }), { x: 1, y: 2 }, 'a mira da habilidade da Mina: você');
  assert.equal(R3C.focoDaMina({}, { x: 1, y: 2 }), null);
  // as 3 Minas no arco em volta do mirado (4 casas à sua frente) — longe de você, detonam com você parado
  const casas = R3C.casasDoArco({ x: 4, y: 0 }, 1, 3);
  const hunt = { clock: 10_000, pos: { x: 0, y: 0, dir: 1 }, z: 0, monstros: [{ uid: 'm', x: 5, y: 0, z: 0, hp: 10 }], plantadas: [] };
  for (const c of casas) {
    const p = Plantadas.plantar(hunt, {}, { tipo: 'mina', acao: 'a', slot: 0, x: c.x, y: c.y, duracaoMs: 5000, detonacaoMs: 250, agora: 9000, maximoExtra: 5 });
    p.semDetonarCasas = travado(0.4, () => R3C.raioSemDetonar(e1));
  }
  assert.ok(casas.every((c) => Math.max(Math.abs(c.x), Math.abs(c.y)) > 2), JSON.stringify(casas));
  assert.ok(Plantadas.minasQueDetonam(hunt, {}, 10_000).length >= 1, 'detonam');
});

// ---------------------------------------------------------------- achado 10 (média): duas auras de Bênção

test('R3 #10: duas auras com Bênção não se revezam — o automático não conjura a segunda; o manual troca', { skip: SEM }, async () => {
  const { e, b } = await montar('Two_Hand_Maces/Driftwood_Maul', [['Hatred', 'Eternal_Blessing_Support'], ['Wrath', 'Eternal_Blessing_Support']]);
  const odio = G.doSlug('Hatred').acao;
  const colera = G.doSlug('Wrath').acao;
  assert.ok(usar(e, 0, b).ok);
  assert.equal(e.hunt.buffs[odio]?.bencaoR3c, 'eterna');
  e.hunt.clock += 2000;
  const auto = usar(e, 1, b, 0.5, false);
  assert.equal(auto.ok, false);
  assert.equal(auto.motivo, 'OUTRA_BENCAO');
  assert.ok(e.hunt.buffs[odio], 'o Ódio segue ligado');
  e.hunt.clock += 2000;
  const manual = usar(e, 1, b, 0.5, true);
  assert.ok(manual.ok, JSON.stringify(manual));
  assert.equal(e.hunt.buffs[colera]?.bencaoR3c, 'eterna');
  assert.equal(e.hunt.buffs[odio], undefined, 'a nova tirou a velha');
  e.hunt.clock += 2000;
  assert.equal(usar(e, 0, b, 0.5, false).motivo, 'OUTRA_BENCAO', 'e o automático não religa o Ódio');
});

// ---------------------------------------------------------------- achado 11 (média): o crítico do Fluxo Cinético

test('R3 #11: a explosão do Fluxo Cinético rola o crítico da varinha (o ataque ativado)', { skip: SEM }, async () => {
  const { e, b, ms } = await montar('Wands/Driftwood_Wand', [['Kinetic_Bolt', 'Kinetic_Instability_Support']]);
  const ficha = Ficha.combate(e);
  assert.ok(ficha.critChance > 0, 'a varinha tem crítico');
  R3C.criarAnomalia(e.hunt, { acao: G.doSlug('Kinetic_Bolt').acao, c: { x: b.x, y: b.y }, z: e.hunt.z ?? 0, raio: 0, ms: 6000 }, e.hunt.clock);
  const ev = travado(0.0001, () => Acoes.tiqueR3C(e, e.hunt, P, [], e.hunt.clock));
  const acertos = daFonte(ev, 'fluxo-cinetico');
  assert.ok(acertos.length >= 1, 'explodiu');
  assert.ok(acertos.some((x) => x.crit), 'com o sorteio 0,0001, a chance da varinha dá crítico');
  assert.ok(ms.length);
});

// ---------------------------------------------------------------- achado 14 (alta) e 15/18: a Armadilha Conversora

test('R3 #14/#15/#18: a Conversora tira o monstro da lista NO LUGAR; o conjurador convertido bate com a magia dele; morto como aliado, o spawn volta à fila', { skip: SEM }, async () => {
  const { e, ms } = await montar('Wands/Driftwood_Wand', [['Conversion_Trap']]);
  const h = e.hunt;
  const lista = h.monstros;
  const [b] = ms;
  Object.assign(b, { x: h.pos.x + 2, y: h.pos.y, raridade: 'normal', key: 'lost-husher', spawn: b.spawn ?? { key: 'lost-husher', x: b.x, y: b.y } });
  h.alvo = b.uid;
  Plantadas.plantar(h, Ficha.combate(e), { tipo: 'armadilha', acao: G.doSlug('Conversion_Trap').acao, slot: 0, x: b.x, y: b.y, duracaoMs: 4000, agora: h.clock });
  travado(0.5, () => Acoes.tiqueDasPlantadas(e, h, P, [], h.clock, { soPlantadas: true }));
  assert.equal(h.monstros, lista, 'a mesma lista (na sala de grupo ela é de todos)');
  assert.ok(!lista.includes(b), 'saiu dos inimigos');
  assert.equal(h.alvo, null, 'o alvo travado nele saiu');
  const l = h.lacaios.find((x) => x.convertido?.monstro === b);
  assert.ok(l, 'virou aliado');
  // sem golpe corpo a corpo no arquivo: a maior magia dele (150–300), não a metade da vida (1e12 / 2)
  assert.deepEqual([l.dano.min, l.dano.max], [150, 300]);
  // morre como aliado: não volta, mas o spawn entra na fila de renascimento
  const antes = (h.respawns ?? []).length;
  l.hp = 0;
  travado(0.5, () => Cacadas.tiqueDosLacaios(e, h, P, grade(h), l.desde + 1000));
  assert.ok(!h.monstros.includes(b));
  assert.equal((h.respawns ?? []).length, antes + 1, 'o ponto de spawn volta à fila');
});

// ---------------------------------------------------------------- achado 16 (média): o provocado pelo Chamariz conjura no totem

test('R3 #16: o monstro provocado (o Chamariz) lança as magias de dano no totem, nunca em você', { skip: SEM }, async () => {
  const { e, b } = await montar('Wands/Driftwood_Wand', [['Arc']]);
  const h = e.hunt;
  assert.ok(Poderes.poderesDe('lost-husher'), 'o conjurador do arquivo');
  const totem = { uid: 'lacaio:isca', tipo: 'totem', nome: 'Chamariz', x: h.pos.x + 3, y: h.pos.y, z: h.z ?? 0, hp: 1e6, maxHp: 1e6, poe: null };
  h.lacaios = [totem];
  Object.assign(b, { key: 'lost-husher', x: h.pos.x + 2, y: h.pos.y, proximoPoder: { 0: 0, 1: 0, 2: 0 }, estados: { provocado: { alvoUid: totem.uid, ate: h.clock + 5000 } } });
  const hp0 = e.hp;
  const ev = [];
  travado(0, () => Poderes.lancar(e, h, P, b, ev, h.clock, Ficha.combate(e), false, { isca: totem }));
  assert.equal(e.hp, hp0, 'nada em você');
  assert.ok(totem.hp < 1e6, `o totem levou a magia (${totem.hp})`);
});
