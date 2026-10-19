// O LOTE A3c (dono, 19/10: "Fazer como o PoE"): a ÁREA NO IMPACTO dos projéteis das gemas com raio-base no PoB — a Bola de Fogo, o Magma Rolante (o
// primeiro impacto também), o Aço Divisor, a Fuzilaria Cinética… Todo impacto do projétil que acerta (o principal, os extras, a perfuração, a
// divisão, o ricochete, o retorno) é um acerto em área com o raio do PoE em casas (metros ÷ 2 × √ da área, a fração como chance de uma casa); o
// atingido leva UM acerto (o do projétil é o da área); o mesmo bicho não leva duas vezes do MESMO projétil na ida. Os sorteios ficam travados.
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
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Secundarios = await import('../systems/skills/golpes-secundarios.mjs');
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const M = await import('../systems/itens-poe/mercenarios.mjs');
const P = await import('../systems/passivas/arvore.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
}

const sorte = (v, f) => { const o = Math.random; Math.random = () => v; try { return f(); } finally { Math.random = o; } };
const TAGS = ['projectile', 'single', 'hit'];
const bicho = (uid, x, y, extra = {}) => ({ uid, x, y, hp: 100, ...extra });
const resolver = (efeito, alvo, vivos, raio, extra = {}) => Secundarios.resolver({ efeito, tags: TAGS, origem: { x: 0, y: 0 }, alvo, atingidos: [alvo], vivos, alcance: 7, rng: () => 0.99, areaNoImpacto: raio == null ? null : { raio, soNosExtras: false }, ...extra });
const deTipo = (r, tipo) => r.golpes.filter((g) => g.tipo === tipo);
const quantos = (r, b) => r.golpes.filter((g) => g.bicho === b).length;

/** O personagem com a arma e a ativa (nível 20), numa caçada; os bichos em `posicoes` ([dx, dy] de você), imortais. (O mesmo de `projeteis-a3`.) */
async function montar(arma, ativa, suportes = [], posicoes = [[1, 0]]) {
  const J = await import('../systems/itens-poe/jogo.mjs');
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
/** Um uso no `alvo` com o sorteio fixo: os eventos. */
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
const acertosEm = (ev, b) => ev.filter((x) => x.t === 'dmg' && x.foe && x.uid === b.uid);
const danoEm = (ev, b) => acertosEm(ev, b).reduce((t, x) => t + x.v, 0);

// ---------------------------------------------------------------- o raio do PoE

test('o raio no impacto pelo PoB: a Bola de Fogo 1,8 m (q20: +0,3), o Magma 1,4 + 0,4, a Cáustica a explosão de 1,2 m (+0,6), o Vulcânico só nas bolas', { skip: SEM }, () => {
  assert.equal(G.areaNoImpacto('Fireball', 20, 0).raioM, 1.8);
  assert.ok(Math.abs(G.areaNoImpacto('Fireball', 20, 20).raioM - 2.1) < 1e-9);
  assert.equal(G.areaNoImpacto('Fireball', 1, 0).raioM, 1);
  assert.ok(Math.abs(G.areaNoImpacto('Rolling_Magma', 20, 0).raioM - 1.8) < 1e-9);
  assert.ok(Math.abs(G.areaNoImpacto('Caustic_Arrow', 20, 0).raioM - 1.8) < 1e-9, 'o da explosão, não o do chão (2 m)');
  assert.equal(G.areaNoImpacto('Splitting_Steel', 20, 0).raioM, 1.2);
  assert.equal(G.areaNoImpacto('Kinetic_Fusillade_of_Detonation', 20, 0).raioM, 2.4);
  assert.ok(Math.abs(G.areaNoImpacto('Vaal_Molten_Strike', 20, 0).raioM - 1.3) < 1e-9);
  assert.equal(G.areaNoImpacto('Molten_Strike', 20, 0).soNosExtras, true);
  assert.equal(G.areaNoImpacto('Fireball', 20, 0).soNosExtras, false);
  // (o PoB dá o raio a outra coisa: a área em volta da bola que voa, o cone, os alvos próximos)
  for (const s of ['Ball_Lightning', 'Ice_Shot', 'Lightning_Arrow', 'Ice_Spear', 'Kinetic_Blast', 'Explosive_Arrow']) assert.equal(G.areaNoImpacto(s, 20, 0), null, s);
  for (const s of G.GEMAS_COM_AREA_NO_IMPACTO) assert.ok(G.REGISTRO.has(s) && G.areaNoImpacto(s, 20, 0)?.raioM > 0, s);
});

// ---------------------------------------------------------------- o motor (`Secundarios.resolver`)

test('o impacto é em área: quem está no quadrado do raio em volta do atingido leva um acerto com o % do projétil; o atingido, nenhum a mais', () => {
  const a = bicho('a', 3, 0);
  const b = bicho('b', 4, 0);
  const c = bicho('c', 3, 1);
  const d = bicho('d', 5, 0);
  const r = resolver({}, a, [a, b, c, d], 1);
  assert.deepEqual(deTipo(r, 'impacto').map((g) => g.bicho.uid).sort(), ['b', 'c']);
  assert.ok(deTipo(r, 'impacto').every((g) => g.pct === 100 && g.doImpacto === null && g.de.x === 3 && g.de.y === 0));
  assert.equal(quantos(r, a), 0, 'o golpe direto é o do disparar: a área não soma outro');
  assert.equal(quantos(r, d), 0);
  assert.equal(r.explosoes.filter((x) => x.impacto).length, 1);
  assert.equal(r.explosoes[0].lado, 3);
  // raio 0: só o atingido; sem a área (outra gema), nada
  assert.equal(deTipo(resolver({}, a, [a, b, c, d], 0), 'impacto').length, 0);
  assert.equal(resolver({}, a, [a, b, c, d], null).golpes.length, 0);
  // raio 2: o d entra
  assert.deepEqual(deTipo(resolver({}, a, [a, b, c, d], 2), 'impacto').map((g) => g.bicho.uid).sort(), ['b', 'c', 'd']);
});

test('a área respeita o andar e os vivos', () => {
  const a = bicho('a', 3, 0);
  const outroAndar = bicho('z', 4, 0, { z: 1 });
  const morto = bicho('m', 3, 1, { hp: 0 });
  const r = resolver({}, a, [a, outroAndar, morto], 1);
  assert.equal(deTipo(r, 'impacto').length, 0);
});

test('o mesmo projétil não acerta duas vezes: a área pega o de trás, e a perfuração não o atravessa de novo (segue para o próximo)', () => {
  const a = bicho('a', 2, 0);
  const b = bicho('b', 3, 0);
  const c = bicho('c', 5, 0);
  const r = resolver({ perfurar: 2 }, a, [a, b, c], 1);
  assert.equal(quantos(r, b), 1, 'só a área');
  assert.equal(deTipo(r, 'impacto').find((g) => g.bicho === b).doImpacto, null);
  // a perfuração vai ao c (fora da área do a) e o impacto nele também é em área (nada em volta)
  assert.deepEqual(deTipo(r, 'perfuracao').map((g) => g.bicho.uid), ['c']);
  assert.equal(quantos(r, c), 1);
});

test('o ricochete, a divisão e os extras: cada impacto é uma área, com o tipo de onde veio (o dano do projétil)', () => {
  const a = bicho('a', 3, 0);
  const b = bicho('b', 6, 0);
  const vizinhoDoB = bicho('vb', 7, 1);
  const r = resolver({ encadear: 1, ricochetePoe: true }, a, [a, b, vizinhoDoB], 1);
  assert.deepEqual(deTipo(r, 'encadeamento').map((g) => g.bicho.uid), ['b']);
  const doB = deTipo(r, 'impacto');
  assert.deepEqual(doB.map((g) => [g.bicho.uid, g.doImpacto, g.ricochetes]), [['vb', 'encadeamento', 1]], 'a área leva o que o projétil já fez');
  // os extras: dois projéteis em dois bichos colados — cada projétil tem a sua área (projéteis diferentes podem acertar o mesmo bicho)
  const x = bicho('x', 3, 0);
  const y = bicho('y', 3, 1);
  const r2 = resolver({ alvosExtras: 1 }, x, [x, y], 1);
  assert.equal(quantos(r2, y), 2, 'o projétil extra em y e a área do principal');
  assert.equal(quantos(r2, x), 1, 'a área do extra');
  // a divisão: os filhos são projéteis novos, com as suas áreas
  const p = bicho('p', 2, 0);
  const f = bicho('f', 5, 0);
  const vf = bicho('vf', 6, 0);
  const r3 = resolver({ divisao: 1 }, p, [p, f, vf], 1);
  assert.deepEqual(deTipo(r3, 'divisao').map((g) => g.bicho.uid), ['f']);
  assert.deepEqual(deTipo(r3, 'impacto').map((g) => [g.bicho.uid, g.doImpacto]), [['vf', 'divisao']]);
});

test('o retorno é outra passada: a área volta a acertar os vizinhos uma vez, e quem uma área da volta pegou não leva o retorno de novo', () => {
  const a = bicho('a', 3, 0);
  const b = bicho('b', 4, 0);
  const r = resolver({ retornar: 1 }, a, [a, b], 1);
  assert.deepEqual(r.golpes.map((g) => [g.bicho.uid, g.tipo, g.doImpacto ?? null]), [['b', 'impacto', null], ['a', 'retorno', null], ['b', 'impacto', 'retorno']]);
  // na ida o a e o c, colados: a área do a pega o c (o c sai dos alvos da ida); na volta o a leva o retorno, e a área dele o c — o c não leva outro
  const a2 = bicho('a', 2, 0);
  const c2 = bicho('c', 3, 0);
  const r2 = resolver({ retornar: 1, perfurar: 1 }, a2, [a2, c2], 1);
  assert.equal(quantos(r2, c2), 2, 'uma vez na ida (a área) e uma na volta (a área)');
  assert.equal(deTipo(r2, 'retorno').length, 1, 'o retorno só no a');
});

test('o Magma Rolante: o primeiro impacto em área; os saltos no solo seguem a área deles (exceção 2), sem outra por cima', () => {
  const a = bicho('a', 3, 0);
  const vizinho = bicho('v', 3, 1);
  const noSalto = bicho('s', 6, 0);
  const r = resolver({ encadear: 1, saltoNoSolo: true }, a, [a, vizinho, noSalto], 1);
  assert.deepEqual(deTipo(r, 'impacto').map((g) => g.bicho.uid), ['v']);
  assert.deepEqual(deTipo(r, 'encadeamento').map((g) => g.bicho.uid), ['s']);
  assert.equal(r.explosoes.filter((x) => x.impacto).length, 1);
});

test('o Golpe Vulcânico (só nas bolas): o golpe direto não é em área; as bolas, sim', () => {
  const a = bicho('a', 1, 0);
  const vizinho = bicho('v', 1, 1);
  const longe = bicho('l', 2, 3);
  const vizinhoDoLonge = bicho('vl', 3, 3);
  const efeito = { alvosExtras: 1 };
  const r = Secundarios.resolver({ efeito, tags: TAGS, origem: { x: 0, y: 0 }, alvo: a, atingidos: [a], vivos: [a, vizinho, longe, vizinhoDoLonge], alcance: 7, rng: () => 0.99, areaNoImpacto: { raio: 1, soNosExtras: true } });
  // (o extra vai no mais perto de você fora o alvo: o vizinho — a área dele pega o a; o direto não pega o vizinho)
  assert.deepEqual(r.golpes.map((g) => [g.bicho.uid, g.tipo, g.doImpacto ?? null]), [['v', 'projetil', null], ['a', 'impacto', 'projetil']]);
});

// ---------------------------------------------------------------- no jogo (`Acoes.disparar`)

test('a Bola de Fogo no jogo: o vizinho do alvo leva o mesmo dano do alvo (um acerto, a fonte "impacto"); o alvo, um acerto só', { skip: SEM }, async () => {
  // (raio 1,8 m = 0,9 casa: o sorteio 0,5 dá 1 casa)
  const { e, bichos: [alvo, vizinho, longe] } = await montar('Wands/Driftwood_Wand', 'Fireball', [], [[2, 0], [3, 1], [5, 0]]);
  const ev = usar(e, alvo);
  assert.equal(acertosEm(ev, alvo).length, 1);
  assert.equal(acertosEm(ev, vizinho).length, 1);
  assert.equal(acertosEm(ev, vizinho)[0].fonte, 'impacto');
  assert.equal(danoEm(ev, vizinho), danoEm(ev, alvo), 'o mesmo dano do projétil');
  assert.equal(acertosEm(ev, longe).length, 0);
  assert.ok(ev.some((x) => x.t === 'explosao' && x.x === alvo.x && x.y === alvo.y && x.lado === 3));
  // o sorteio da fração: 0,95 > 0,9 — raio 0, só o alvo
  const de0 = await montar('Wands/Driftwood_Wand', 'Fireball', [], [[2, 0], [3, 1]]);
  const ev0 = usar(de0.e, de0.bichos[0], 0.95);
  assert.equal(acertosEm(ev0, de0.bichos[1]).length, 0);
  assert.equal(acertosEm(ev0, de0.bichos[0]).length, 1);
});

test('a área cresce com a Área de Efeito do uso (× √): com o Suporte de Área de Efeito Aumentada (+49%) a Bola de Fogo vai a 2,2 m — 1 casa e 10% de chance da 2ª', { skip: SEM }, async () => {
  assert.equal(SP.efeitoNoNivel('Increased_Area_of_Effect_Support', 20, 0, { tags: ['poe:Área', 'poe:Magia'] }).efeito.areaIncPct, 49);
  const { e, bichos: [alvo, aDuas] } = await montar('Wands/Driftwood_Wand', 'Fireball', ['Increased_Area_of_Effect_Support'], [[2, 0], [4, 0]]);
  const ef = Acoes.comOsAlvosDaGema(Acoes.POR_ID_PUBLICO(G.doSlug('Fireball').acao), GS.efeitoNaSkill(e, G.doSlug('Fireball').acao), e);
  const casas = (1.8 * Math.sqrt(1 + (ef.areaIncPct ?? 0) / 100)) / 2;
  assert.ok(casas > 1 && casas < 1.2, `${casas}`);
  assert.equal(acertosEm(usar(e, alvo, 0.05), aDuas).length, 1, 'o sorteio 0,05 cai na fração: 2 casas');
  assert.equal(acertosEm(usar(e, alvo, 0.5), aDuas).length, 0, 'o 0,5, não: 1 casa');
});

test('uma gema sem raio no impacto (a Lança Gélida) segue sem área', { skip: SEM }, async () => {
  const { e, bichos: [alvo, vizinho] } = await montar('Wands/Driftwood_Wand', 'Ice_Spear', [], [[2, 0], [3, 0]]);
  const ev = usar(e, alvo);
  assert.equal(ev.filter((x) => x.t === 'dmg' && x.foe && x.fonte === 'impacto').length, 0);
  assert.ok(acertosEm(ev, vizinho).every((x) => x.fonte !== 'impacto'));
});

// ---------------------------------------------------------------- (revisão do A3c) o Golpe Vulcânico, o totem e o mercenário

test('o Golpe Vulcânico no jogo: a bola que cai no vizinho explode e pega o alvo com o dano da BOLA (os 60% menos do projétil — `doImpacto`); o golpe direto não explode', { skip: SEM }, async () => {
  assert.equal(G.projeteisDaGema('Molten_Strike', 20).pct, -60);
  // (raio 0,9 m = 0,45 casa: o sorteio 0,3 dá 1 casa)
  const { e, bichos: [alvo, vizinho] } = await montar('Two_Hand_Maces/Driftwood_Maul', 'Molten_Strike', [], [[1, 0], [1, 1]]);
  const ev = usar(e, alvo, 0.3);
  const doAlvo = acertosEm(ev, alvo);
  const doVizinho = acertosEm(ev, vizinho);
  assert.deepEqual(doAlvo.map((x) => x.fonte ?? null), [null, 'impacto'], 'o golpe e a área da bola do vizinho');
  assert.deepEqual(doVizinho.map((x) => x.fonte ?? null), ['projetil'], 'a bola; o golpe direto não tem área');
  const golpe = doAlvo[0].v;
  const daArea = doAlvo[1].v;
  assert.equal(daArea, doVizinho[0].v, 'a área tem o dano da bola que a causou');
  assert.ok(Math.abs(daArea / golpe - 0.4) < 0.05, `${daArea} / ${golpe}`);
});

test('o TOTEM (Totem de Magia): a Bola de Fogo lançada por ele explode igual — o vizinho do alvo leva o acerto da área', { skip: SEM }, async () => {
  const { e, bichos: [alvo, vizinho] } = await montar('Wands/Driftwood_Wand', 'Fireball', ['Spell_Totem_Support'], [[3, 0], [60, 60]]);
  usar(e, alvo);
  const l = (e.hunt.lacaios ?? []).find((x) => x.tipo === 'totem' && x.hp > 0);
  assert.ok(l, 'o totem foi posto');
  Object.assign(alvo, { x: l.x + 2, y: l.y });
  Object.assign(vizinho, { x: l.x + 3, y: l.y + 1 });
  const ev = sorte(0.5, () => Cacadas.golpeDoTotem(e, e.hunt, l, alvo, Ficha.combate(e), PERSONAGEM, e.hunt.clock));
  assert.equal(acertosEm(ev, alvo).length, 1);
  assert.deepEqual(acertosEm(ev, vizinho).map((x) => [x.fonte, x.lacaio]), [['impacto', true]]);
  assert.equal(danoEm(ev, vizinho), danoEm(ev, alvo));
});

/** O dono do mercenário (o anel com "mercenario") e o mercenário do arquétipo, com a habilidade `i` da vez. (O mesmo de `zerar-arvore-lote39`.) */
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

test('o MERCENÁRIO (dono, 19/10: "Sim, igual"): a Bola de Fogo do piromante explode no alvo; as bolas do Golpe Vulcânico do bárbaro, nos atingidos — o direto não', { skip: SEM }, () => {
  const { e, l } = comMercenario('piromante', 0);
  assert.equal(l.habilidades[0].gema, 'Fireball');
  const alvo = bicho('a', 12, 10);
  const vizinho = bicho('v', 13, 11);
  const longe = bicho('l', 16, 10);
  const r = Acoes.alvosDoGolpeDoMercenario(e, l, alvo, [alvo, vizinho, longe], () => 0.01);
  assert.deepEqual(r.golpes.map((g) => [g.bicho.uid, g.tipo, g.impacto, g.pct]), [['v', 'area', true, 100]]);
  assert.ok(r.explosoes.some((x) => x.impacto && x.x === 12 && x.y === 10));
  // a fração: com o sorteio 0,99 o raio fica em 0 casa — só o alvo
  assert.equal(Acoes.alvosDoGolpeDoMercenario(e, l, alvo, [alvo, vizinho, longe], () => 0.99).golpes.length, 0);
  // o bárbaro: o Golpe Vulcânico — a bola no vizinho explode e pega o alvo; o golpe direto no alvo não pega o vizinho
  const b = comMercenario('barbaro', 1);
  assert.equal(b.l.habilidades[1].gema, 'Molten_Strike');
  const a2 = bicho('a', 11, 10);
  const v2 = bicho('v', 11, 11);
  const r2 = Acoes.alvosDoGolpeDoMercenario(b.e, b.l, a2, [a2, v2], () => 0.01);
  assert.deepEqual(r2.golpes.map((g) => [g.bicho.uid, g.tipo, g.doImpacto ?? null]), [['v', 'projetil', null], ['a', 'area', 'projetil']]);
});
