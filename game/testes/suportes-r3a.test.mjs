// (lote R3A, 27/10) O ATAQUE ATIVADO COMPLETO (a Onda de Choque, a Onda de Choque do Vazio, a Torre Óssea, a Tormenta do Vazio — a arma com os locais × o "Dano de
// Ataque", o adicionado × a eficácia, o crítico da arma, a Área) e as HABILIDADES CONCEDIDAS (o Cristal em Queda, a Fenda, o Chamado da Fogueira da Pira, a Rajada de
// Vento). Os sorteios ficam travados.
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
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');

const PERSONAGEM = { nome: 'T' };
function travado(v, fn) {
  const antes = Math.random;
  Math.random = typeof v === 'function' ? v : () => v;
  try { return fn(); } finally { Math.random = antes; }
}
const perto = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const TAGS = (...t) => ({ tags: t.map((x) => `poe:${x}`) });
const ef = (slug, nivel = 3, q = 0, tags = TAGS('Ataque', 'Corpo a Corpo', 'Área', 'Projétil')) => SP.efeitoNoNivel(slug, nivel, q, tags).efeito;

/** O personagem com a arma, a ativa e os suportes ligados, numa caçada; os monstros nas casas `onde` (deslocamentos de você, imortais), o resto longe. */
async function montar(arma, ativa, { suportes = [], onde = [[1, 0]], nivel = 3 } = {}) {
  const J = await import('../systems/itens-poe/jogo.mjs');
  const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Scion', sistema: 'poe' });
  const a = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: arma, raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
  const n = 1 + suportes.length;
  a.soquetes = { abertos: n, links: Array.from({ length: n - 1 }, () => true), gemas: Array(n).fill(null), cores: Array(n).fill('W') };
  e.equipment = { ...e.equipment, weapon: a };
  delete e.equipment.shield;
  e.inventory = [ativa, ...suportes].map((s) => GS.itemDaGema({ id: (G.doSlug(s) ?? SP.doSlug(s)).itemId, nivel: G.doSlug(s) ? 20 : nivel, xp: 0, raridade: 'comum' }));
  for (let i = 0; i < n; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: G.doSlug(ativa).acao, enabled: true, minMana: 0, conditions: [] };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(travado(0.999, () => Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' })).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 1e7;
  e.maxHp = e.hp = 1e7;
  const ms = e.hunt.monstros;
  ms.forEach((m, i) => Object.assign(m, i < onde.length ? { x: e.hunt.pos.x + onde[i][0], y: e.hunt.pos.y + onde[i][1], hp: 1e12, maxHp: 1e12, estados: {}, dots: [], resist: {} } : { x: e.hunt.pos.x + 60 + i, y: e.hunt.pos.y + 60 }));
  return { e, bs: ms.slice(0, onde.length) };
}
function usar({ e, bs }, v = 0.5, alvo = bs[0]) {
  return travado(v, () => {
    const r = Acoes.disparar(e, e.hunt, PERSONAGEM, 0, alvo, { manual: true });
    assert.ok(r.ok, JSON.stringify(r));
    const ev = [...(r.eventos ?? [])];
    if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; ev.push(...(Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM) ?? [])); }
    return ev;
  });
}
const daFonte = (ev, fonte) => ev.filter((x) => x.t === 'dmg' && x.fonte === fonte);

// ---------------------------------------------------------------- as contas puras

test('R3A: as partes do ataque ativado — a arma × o "Dano de Ataque", o adicionado × a eficácia, a conversão própria sobre o Físico', () => {
  const p = R3A.partesDoAtivado({ arma: { min: 10, max: 20 }, fisicoAdicionado: [2, 2], danoSomado: { fire: [10, 10] }, somadoDoSuporte: { ice: [4, 6] }, basePct: 300, eficaciaPct: 300, rng: () => 0.5 });
  // arma 15 × 3 = 45, + Físico adicionado 2 × 3 = 6; Fogo 10 × 3; Gelo 5 × 3
  assert.ok(perto(p.physical, 51) && perto(p.fire, 30) && perto(p.ice, 15), JSON.stringify(p));
  const c = R3A.partesDoAtivado({ arma: { min: 10, max: 20 }, basePct: 200, conversao: { fire: 60 }, rng: () => 0.5 });
  assert.ok(perto(c.physical, 12) && perto(c.fire, 18), JSON.stringify(c));
  const tudo = R3A.partesDoAtivado({ arma: { min: 10, max: 10 }, basePct: 100, conversao: { fire: 100 }, rng: () => 0.5 });
  assert.deepEqual(Object.keys(tudo), ['fire'], '100% convertido: só Fogo (a Pira)');
  // a eficácia, sem número, é a do "Dano de Ataque"
  assert.ok(perto(R3A.partesDoAtivado({ danoSomado: { fire: [10, 10] }, basePct: 250, rng: () => 0.5 }).fire, 25));
  assert.deepEqual(R3A.somadoDoEfeito({ 'somadoMin:fire': 3, 'somadoMax:fire': 7, danoPct: 10 }), { fire: [3, 7] });
  assert.equal(R3A.chanceDoAtivado({ critChance: 0.08, critTeto: 1 }, { critChance: 2 }), 0.1, 'o crítico da arma + o dos suportes');
});

test('R3A: o raio em casas (m × √ da Área ÷ 2, a fração é a chance), a recarga com usos, a distância percorrida da Rajada', () => {
  assert.equal(R3A.casasDoRaio(2.3, 1, () => 0.1), 2, '1,15 casa: 15% de chance de 2');
  assert.equal(R3A.casasDoRaio(2.3, 1, () => 0.2), 1);
  assert.equal(R3A.casasDoRaio(2.3, 4, () => 0.99), 2, '× √4: 2,3 casas');
  assert.equal(R3A.casasDoRaio(1.5, 1, () => 0.9), 0, '1,5 m: 0,75 casa');
  let l = null;
  for (let i = 0; i < 3; i++) { l = R3A.usarRecarga(l, 1000, 1000, 3); assert.ok(l, `o uso ${i + 1}`); }
  assert.deepEqual(l, [2000, 3000, 4000], 'recuperados um de cada vez');
  assert.equal(R3A.usarRecarga(l, 1000, 1000, 3), null, 'sem uso: os 3 gastos');
  assert.ok(R3A.usarRecarga(l, 2000, 1000, 3), 'o primeiro voltou');
  const v = { x: 0, y: 0, z: 0, andadoM: 0 };
  assert.ok(R3A.ventoPode(null), 'a primeira vale');
  R3A.andar(v, { x: 3, y: 0, z: 0 });
  assert.equal(v.andadoM, 6);
  assert.equal(R3A.ventoPode(v, 10), false);
  R3A.andar(v, { x: 3, y: 2, z: 0 });
  assert.ok(R3A.ventoPode(v, 10), '10 m andados');
  R3A.andar(v, { x: 50, y: 50, z: 1 });
  assert.equal(v.andadoM, 10, 'noutro andar recomeça dali, sem contar o salto');
  assert.deepEqual(R3A.direcoesDasFendas({ x: 0, y: 0 }, { x: 1, y: 0 }, 3), [[1, 0], [1, 1], [1, -1]], 'as 3 mais perto da direção do golpe');
  assert.equal(R3A.direcoesDasFendas({ x: 0, y: 0 }, { x: 1, y: 0 }, 9).length, 9);
  assert.equal(R3A.virar(2, () => 0.3), 2);
  assert.equal(R3A.virar(2, () => 0.6), 3);
  assert.equal(R3A.virar(0, () => 0.9), 7);
  const p = R3A.casasDosPilares({ x: 5, y: 5 }, [{ x: 6, y: 5 }, { x: 4, y: 5 }], 4, () => 0);
  assert.deepEqual(p, [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 4, y: 5 }, { x: 5, y: 5 }], 'o primeiro no acertado; sem casa livre, de novo nele');
});

// ---------------------------------------------------------------- as linhas e o status

test('R3A: as linhas das habilidades concedidas são delas (não da suportada) e os oito saem de parcial (a Torre Óssea fica só com o caminho dos monstros)', { skip: SEM }, () => {
  const cr = ef('Crystalfall_Support', 1, 20);
  assert.deepEqual([cr.cristal, cr.cristalRecargaMs, cr.cristalUsos, cr.cristalDanoPct, cr.cristalEficaciaPct, cr.cristalRaioM, cr.cristalIncPct, cr.danoPct], [1, 1000, 3, 616, 616, 2.3, 10, 10], 'a qualidade da suportada (10%) e a do cristal (10%) separadas');
  const fi = ef('Fissure_Support', 1, 20);
  assert.deepEqual([fi.fenda, fi.fendaRecargaMs, fi.fendaDanoPct, fi.fendaVelM, fi.fendaConvFogoPct, fi.fendas, fi.soMachadoMacaCetroCajado], [1, 500, 340, 6, 60, 4, 1]);
  const py = ef('Pyre_Support', 1, 20);
  assert.deepEqual([py.piraChancePct, py.piraRecargaMs, py.piraDanoPct, py.piraConvFogoPct, py.piraRaioM, py.piraCinzas, py.pilares], [50, 1000, 220, 100, 1.2, 1, 4]);
  const wb = ef('Windburst_Support', 1, 0);
  assert.deepEqual([wb.vento, wb.ventoMetros, wb.ventoDanoPct, wb.ventoVelM, wb.ventoPerfura, wb.ventoMs, wb.ventoProjeteis, wb.ventoAreaMaisPct, wb.ventoRaioM], [1, 10, 118, 4, 1, 4000, 3, 40, 1.5]);
  for (const s of ['Shockwave_Support', 'Void_Shockwave_Support', 'Voidstorm_Support', 'Crystalfall_Support', 'Fissure_Support', 'Pyre_Support', 'Windburst_Support']) assert.equal(SP.doSlug(s).status, 'funciona', `${s}: ${SP.doSlug(s).motivos.join(' | ')}`);
  assert.equal(SP.doSlug('Bonespire_Support').status, 'parcial');
  assert.deepEqual(SP.doSlug('Bonespire_Support').motivos.length, 1);
  assert.match(SP.doSlug('Bonespire_Support').motivos[0], /caminho dos monstros/);
});

// ---------------------------------------------------------------- o ataque ativado

test('R3A: o ataque ativado — o adicionado sai × a eficácia (o dobro do "Dano de Ataque", o dobro do adicionado) e rola o crítico da arma', { skip: SEM }, async () => {
  const m = await montar('Two_Hand_Maces/Driftwood_Maul', 'Heavy_Strike', { suportes: ['Shockwave_Support'] });
  const { e, bs: [b] } = m;
  const entry = Acoes.POR_ID_PUBLICO(e.actions[0].id);
  const tags = ['ataque', 'area', 'corpo', 'fisico', 'habilidade'];
  const golpe = (pct, rng = 0.5) => travado(rng, () => { const antes = b.hp; Acoes.acertoDoArauto(e, e.hunt, entry.id, b, 1, 'physical', { tags, ataque: true, ativado: { danoPct: pct, conversao: { fire: 100 } } }); return antes - b.hp; });
  const sem300 = golpe(300);
  const sem600 = golpe(600);
  assert.ok(sem300 > 0 && Math.abs(sem600 / sem300 - 2) < 0.02, `${sem300} → ${sem600}`);
  // (tudo em Fogo: a armadura do bicho não entra na conta — a reta)
  // o Fogo da própria arma (o elemental local) entra junto, × a eficácia
  e.equipment.weapon.poe.af = { ...(e.equipment.weapon.poe.af ?? {}), added_fire_dmg_min: 50, added_fire_dmg_max: 50 };
  Ficha.invalidar(e);
  const com300 = golpe(300);
  const com600 = golpe(600);
  assert.ok(com300 > sem300, 'o Fogo da arma entrou');
  assert.ok(Math.abs((com600 - sem600) / (com300 - sem300) - 2) < 0.03, `o Fogo × a eficácia: ${com300 - sem300} → ${com600 - sem600}`);
  // o crítico da arma: com o sorteio no fundo, o acerto é crítico (antes, a chance era só a fixa das tags — 0)
  const ev = [];
  travado(0.0001, () => Acoes.acertoDoArauto(e, e.hunt, entry.id, b, 1, 'physical', { tags, eventos: ev, ataque: true, ativado: { danoPct: 300 } }));
  assert.ok(ev.some((x) => x.t === 'dmg' && x.crit), 'crítico pela chance da arma');
  assert.ok(R3A.chanceDoAtivado(Ficha.combate(e), null) > 0);
});

test('R3A: a Onda de Choque sai pelo ataque ativado (crítico da arma) e a Tormenta do Vazio cega quem está nela', { skip: SEM }, async () => {
  const m = await montar('Two_Hand_Maces/Driftwood_Maul', 'Heavy_Strike', { suportes: ['Shockwave_Support'], nivel: 20 });
  const ev = usar(m, 0.0001);
  const ondas = daFonte(ev, 'onda-do-vazio');
  assert.ok(ondas.length >= 1, 'a onda');
  assert.ok(ondas.some((x) => x.crit), 'a onda rola o crítico da arma');
  const t = await montar('Bows/Crude_Bow', 'Rain_of_Arrows', { suportes: ['Voidstorm_Support'], onde: [[4, 0]] });
  usar(t, 0.999);
  assert.equal(t.e.hunt.poeTormentas?.length, 1);
  t.e.hunt.clock += 1000;
  const ev2 = [];
  travado(0.999, () => Acoes.tiqueDasPlantadas(t.e, t.e.hunt, PERSONAGEM, ev2));
  assert.ok(daFonte(ev2, 'tormenta-do-vazio').length, 'explodiu');
  assert.ok(t.bs[0].estados.cego?.ate > t.e.hunt.clock, 'Cego dentro da tormenta');
});

// ---------------------------------------------------------------- as habilidades concedidas

test('R3A: o Cristal em Queda — cai no acertado ao atingir, com 3 usos na recarga', { skip: SEM }, async () => {
  const m = await montar('Two_Hand_Maces/Driftwood_Maul', 'Ground_Slam', { suportes: ['Crystalfall_Support'], onde: [[1, 0], [2, 0]] });
  const ev = usar(m, 0.1);
  assert.ok(daFonte(ev, 'cristal-em-queda').length >= 1, 'o cristal acertou');
  assert.equal(m.e.hunt.poeR3A.cristal.length, 1, 'gastou 1 dos 3 usos');
  m.e.hunt.poeR3A.cristal = [m.e.hunt.clock + 1000, m.e.hunt.clock + 2000, m.e.hunt.clock + 3000];
  m.e.hunt.cooldowns = {};
  const ev2 = usar(m, 0.1);
  assert.equal(daFonte(ev2, 'cristal-em-queda').length, 0, 'sem uso, sem cristal');
});

test('R3A: a Fenda — as fendas saem do impacto da pancada (60% do Físico em Fogo), uma vez a cada 0,5 s', { skip: SEM }, async () => {
  const m = await montar('Two_Hand_Maces/Driftwood_Maul', 'Ground_Slam', { suportes: ['Fissure_Support'], onde: [[1, 0], [3, 0]] });
  const ev = usar(m, 0.1);
  assert.ok(daFonte(ev, 'fenda').length >= 1, 'a fenda acertou');
  assert.equal(m.e.hunt.poeR3A.fendaAte, m.e.hunt.clock + 500);
});

test('R3A: a Pira — o corpo a corpo que acerta um Incendiado ativa o Chamado da Fogueira (50%): os pilares de Fogo cobrem em Cinzas', { skip: SEM }, async () => {
  const m = await montar('Two_Hand_Maces/Driftwood_Maul', 'Heavy_Strike', { suportes: ['Pyre_Support'] });
  const b = m.bs[0];
  const t = m.e.hunt.clock;
  // sem Incendiar, nada
  assert.equal(daFonte(usar(m, 0.1), 'chamado-da-fogueira').length, 0);
  m.e.hunt.cooldowns = {};
  b.dots = [{ id: 'q', tipo: 'queimadura', elemento: 'fire', ate: t + 60_000, falta: 60_000, porPulso: 0, proximo: t + 60_000 }];
  const ev = usar(m, 0.1);
  assert.ok(daFonte(ev, 'chamado-da-fogueira').length >= 1, 'o pilar acertou');
  assert.ok(b.estados.cinzas?.ate > t, 'Coberto de Cinzas');
  assert.equal(m.e.hunt.poeR3A.piraAte, m.e.hunt.clock + 1000);
});

test('R3A: a Rajada de Vento — 3 projéteis que andam, perfuram e explodem no fim; depois, só com 10 m percorridos', { skip: SEM }, async () => {
  const m = await montar('Bows/Crude_Bow', 'Rain_of_Arrows', { suportes: ['Windburst_Support'], onde: [[3, 0]] });
  usar(m, 0.3);
  const st = m.e.hunt.poeR3A;
  assert.equal(st.rajadas?.length, 3, 'os 3 projéteis');
  assert.equal(st.vento.andadoM, 0);
  // parado, o próximo acerto não solta outra
  m.e.hunt.cooldowns = {};
  usar(m, 0.3);
  assert.equal(st.rajadas.length, 3);
  // no fim da duração (4 s), andam 8 casas e explodem
  m.e.hunt.clock += 4000;
  const ev = [];
  travado(0.3, () => Acoes.tiqueDasPlantadas(m.e, m.e.hunt, PERSONAGEM, ev));
  assert.ok(ev.filter((x) => x.t === 'shot' && x.fonte === 'rajada-de-vento').length >= 3, 'os passos');
  assert.ok(ev.some((x) => x.t === 'explosao' && x.fonte === 'rajada-de-vento'), 'a explosão no fim');
  assert.equal(st.rajadas, undefined, 'os vencidos saem');
  // andou 10 m: a próxima vale
  m.e.hunt.pos = { x: m.e.hunt.pos.x, y: m.e.hunt.pos.y + 5 };
  travado(0.3, () => Acoes.tiqueDasPlantadas(m.e, m.e.hunt, PERSONAGEM, []));
  assert.ok(st.vento.andadoM >= 10, String(st.vento.andadoM));
  m.e.hunt.cooldowns = {};
  m.bs[0].y = m.e.hunt.pos.y;
  usar(m, 0.3);
  assert.equal(st.rajadas?.length, 3, 'outra Rajada');
});
