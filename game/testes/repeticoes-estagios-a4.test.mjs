// O LOTE A4 das gemas do PoE (dono, 19/10): as REPETIÇÕES do golpe (D1: o uso dura (1 + r) tempos de uso — o PoB; a Procissão, a Nova de Gelo Vaal,
// o Eco Desperto, o Golpe Cintilante Vaal), a SEQUÊNCIA DE ÁREAS num uso (a Chuva de Lâminas, a Colisão de Gelo, o Estilhaçar a Terra e as estacas),
// os ESTÁGIOS que faltavam (a Rajada de Chamas Vaal, a Ira Divina, o Atirar, as Lâminas Velozes, as Gavinhas, o Devastar, o Golpe Duplo do Ímpeto),
// os ÂNGULOS (D7), a área do Ciclone pelo alcance e os objetos no tempo (o Orbe Invernal, a Maré Invernal, o Raio Abrasador). Os sorteios são
// travados (`sorte`): nenhum teste depende de sorte.
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
const G4 = await import('../systems/itens-poe/gemas-a4.mjs');
const SP = await import('../systems/itens-poe/suportes-poe.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Areas = await import('../engine/areas.mjs');
const Registro = await import('../systems/combate/registro.mjs');

const sorte = (v, f) => { const o = Math.random; Math.random = typeof v === 'function' ? v : () => v; try { return f(); } finally { Math.random = o; } };
const perto = (a, b, tol = 0.02) => Math.abs(a / b - 1) < tol;

/**
 * O personagem com a arma, a ativa (e os suportes ligados a ela), numa caçada; os monstros nas casas `onde` (deslocamentos de você, imortais), o
 * resto longe. `classe`/`vocacao` do personagem de teste.
 */
async function montar(arma, ativa, { suportes = [], onde = [[1, 0]], qualidade = 0, vocacao = 'knight', classe = 'Scion', nivel = 20 } = {}) {
  const J = await import('../systems/itens-poe/jogo.mjs');
  const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
  const e = Object.assign(personagemDeTeste({ vocacao, level: 90 }), { classePoe: classe, sistema: 'poe' });
  const a = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: arma, raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
  const n = 1 + suportes.length;
  a.soquetes = { abertos: n, links: Array.from({ length: n - 1 }, () => true), gemas: Array(n).fill(null), cores: Array(n).fill('W') };
  e.equipment = { ...e.equipment, weapon: a };
  delete e.equipment.shield;
  e.inventory = [ativa, ...suportes].map((s) => GS.itemDaGema({ id: (G.doSlug(s) ?? SP.doSlug(s)).itemId, nivel, xp: 0, raridade: 'comum', ...(qualidade ? { qualidade } : {}) }));
  for (let i = 0; i < n; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: G.doSlug(ativa).acao, enabled: true, minMana: 0, conditions: [] };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(sorte(0.999, () => Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' })).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 1e7;
  e.maxHp = e.hp = 1e7;
  const ms = e.hunt.monstros;
  ms.forEach((m, i) => Object.assign(m, i < onde.length ? { x: e.hunt.pos.x + onde[i][0], y: e.hunt.pos.y + onde[i][1], hp: 1e12, maxHp: 1e12, estados: {}, dots: [], resist: {} } : { x: e.hunt.pos.x + 60 + i, y: e.hunt.pos.y + 60 }));
  for (const m of ms) if (!onde.length || ms.indexOf(m) >= onde.length) m.hp = m.hp > 0 ? m.hp : 1;
  return { e, bs: ms.slice(0, onde.length) };
}
/** Um uso (com a conjuração) com o sorteio travado; devolve os eventos e os golpes da gema no registro. */
function usar({ e, bs }, v = 0.5, alvo = bs[0]) {
  Registro.definirNivel(2);
  Registro.limparRegistro();
  try {
    return sorte(v, () => {
      const r = Acoes.disparar(e, e.hunt, PERSONAGEM, 0, alvo, { manual: true });
      assert.ok(r.ok, r.erro);
      const ev = [...(r.eventos ?? [])];
      if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; ev.push(...(Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM) ?? [])); }
      return { ev, golpes: Registro.ultimosGolpes(500).filter((g) => g.origem === 'gema') };
    });
  } finally { Registro.definirNivel(0); }
}
const danoEm = (ev, b) => ev.filter((x) => x.t === 'dmg' && x.uid === b.uid && x.foe).reduce((t, x) => t + x.v, 0);
const acertosEm = (ev, b) => ev.filter((x) => x.t === 'dmg' && x.uid === b.uid && x.foe).length;
const tempoDoGrupo = (e) => e.hunt.cooldowns?.[Acoes.GRUPO_DO_POE]?.total;
const usoDaGema = (e) => Acoes.temposDaGemaPoe(e, Acoes.POR_ID_PUBLICO(e.actions[0].id), GS.efeitoNaSkill(e, e.actions[0].id)).uso;

// ---------------------------------------------------------------- D1 e R1

test('A4 D1: o uso com repetições dura (1 + r) tempos de uso — o Golpe Múltiplo 3×, o Eco de Magia 2× (e as repetições saem dentro dele)', { skip: SEM }, async () => {
  const m = await montar('Two_Hand_Maces/Driftwood_Maul', 'Heavy_Strike', { suportes: ['Multistrike_Support'] });
  const u = usar(m, 0.99);
  assert.equal(u.golpes.length, 3, 'o uso e as 2 repetições, no mesmo uso');
  assert.equal(tempoDoGrupo(m.e), Math.round(usoDaGema(m.e) * 3));
  const s = await montar('Wands/Driftwood_Wand', 'Fireball', { suportes: ['Spell_Echo_Support'], vocacao: 'sorcerer', classe: 'Witch' });
  const us = usar(s, 0.99);
  assert.equal(us.golpes.length, 2);
  assert.equal(tempoDoGrupo(s.e), Math.round(usoDaGema(s.e) * 2));
  // o balão mostra o mesmo tempo
  const sem = await montar('Two_Hand_Maces/Driftwood_Maul', 'Heavy_Strike');
  usar(sem, 0.99);
  assert.equal(tempoDoGrupo(sem.e), usoDaGema(sem.e), 'sem repetição: 1 tempo de uso');
  assert.equal(Acoes.fatorDoTempoDoUso(Acoes.POR_ID_PUBLICO(m.e.actions[0].id), GS.efeitoNaSkill(m.e, m.e.actions[0].id), Ficha.combate(m.e)), 3);
});

test('A4 R1 (D2): a Nova Elétrica da Procissão repete 2 vezes, cada repetição 1 raio da nova à frente, até o alcance +50%; o uso dura 3 tempos', { skip: SEM }, async () => {
  assert.deepEqual(G.repeticoesDaGema('Shock_Nova_of_Procession', 20), { n: 2, deslocaRaios: 1, alcanceMaisPct: 50 });
  const m = await montar('Wands/Driftwood_Wand', 'Shock_Nova_of_Procession', { vocacao: 'sorcerer', classe: 'Witch', onde: [[2, 0], [40, 0]] });
  const pos = { ...m.e.hunt.pos };
  const u = usar(m, 0.5);
  const areas = u.ev.filter((x) => x.t === 'area');
  assert.equal(areas.length, 3, 'a nova e as 2 repetições');
  const raio = Math.max(...areas[0].casas.map(([dx, dy]) => Math.max(Math.abs(dx), Math.abs(dy))));
  const alcance = Math.floor(7 * 1.5);
  assert.deepEqual(areas.map((a) => a.x - pos.x), [0, Math.min(alcance, raio), Math.min(alcance, 2 * raio)], 'cada repetição anda 1 raio na direção do alvo, até o alcance');
  assert.ok(areas.every((a) => a.y === pos.y));
  assert.equal(tempoDoGrupo(m.e), Math.round(usoDaGema(m.e) * 3));
  assert.ok(!G.doSlug('Shock_Nova_of_Procession').motivosNoJogo.some((x) => /Repete/.test(x)), G.doSlug('Shock_Nova_of_Procession').motivosNoJogo.join(' | '));
});

test('A4 R1: a Nova de Gelo Vaal se repete a partir dos acertados, até 5 vezes, com o raio 15% menor a cada uma (sem gastar tempo)', { skip: SEM }, async () => {
  assert.deepEqual(G.repeticoesDaGema('Vaal_Ice_Nova', 20), { n: 0, deInimigo: 5, raioPorRepPct: -15 });
  // (a nova de 3 m: o losango de 1 casa — os 4 vizinhos; o de 2 casas fora dela)
  const m = await montar('Wands/Driftwood_Wand', 'Vaal_Ice_Nova', { vocacao: 'sorcerer', classe: 'Witch', onde: [[1, 0], [0, 1], [-1, 0], [0, -1], [2, 0]] });
  // (o sorteio alto: o último acertado vivo é o centro; a fração do raio nunca dá a casa a mais — cada repetição, de 0,85 casa, pega só o centro)
  const u = usar(m, 0.999999);
  const areas = u.ev.filter((x) => x.t === 'area');
  assert.equal(areas.length, 5, 'a nova e 4 repetições — uma de cada acertado (o de fora nunca é acertado)');
  assert.equal(acertosEm(u.ev, m.bs[4]), 0);
  for (const b of m.bs.slice(0, 4)) assert.equal(acertosEm(u.ev, b), 2, 'a nova e a repetição dele');
  const raios = areas.map((a) => Math.max(...a.casas.map(([dx, dy]) => Math.max(Math.abs(dx), Math.abs(dy)))));
  for (let i = 1; i < raios.length; i++) assert.ok(raios[i] <= raios[i - 1], `o raio cai: ${raios}`);
  // cada repetição sai de um inimigo acertado
  for (const a of areas.slice(1)) assert.ok(m.bs.some((b) => b.x === a.x && b.y === a.y), 'o centro é um inimigo');
  assert.equal(tempoDoGrupo(m.e), usoDaGema(m.e), 'as explosões menores não são RepeatCount: 1 tempo de uso');
  assert.ok(!G.doSlug('Vaal_Ice_Nova').motivosNoJogo.length, G.doSlug('Vaal_Ice_Nova').motivosNoJogo.join(' | '));
});

test('A4 R1: o Eco Desperto — a Repetição Final tem 20% de chance de Dano Dobrado (o sorteio travado: abaixo dobra, acima não)', { skip: SEM }, async () => {
  const ef = SP.efeitoNoNivel('Awakened_Spell_Echo_Support', 5, 0, { tags: ['poe:Magia'] });
  assert.equal(ef.efeito.repeticaoFinalDobroPct, 20);
  assert.ok(!ef.naoFeitas.length, ef.naoFeitas.join(' | '));
  const golpes = async (v) => usar(await montar('Wands/Driftwood_Wand', 'Fireball', { suportes: ['Awakened_Spell_Echo_Support'], vocacao: 'sorcerer', classe: 'Witch' }), v).golpes.map((g) => g.danoAntesDaResistencia);
  // (0,15: abaixo dos 20% do Dano Dobrado; o crítico da Bola de Fogo — 6% — não sai)
  const dobra = await golpes(0.15);
  assert.equal(dobra.length, 2);
  assert.ok(perto(dobra[1] / dobra[0], 2), `a repetição final dobra: ${dobra}`);
  const nao = await golpes(0.5);
  assert.ok(perto(nao[1] / nao[0], 1), `acima dos 20%: igual — ${nao}`);
});

test('A4 R1 (D3): o Golpe Cintilante Vaal — 25 golpes nos vivos perto, o dano somado entra no fim (um dano por inimigo), o uso dura 25 tempos', { skip: SEM }, async () => {
  const m = await montar('Two_Hand_Maces/Driftwood_Maul', 'Vaal_Flicker_Strike', { onde: [[4, 0], [5, 1], [5, -1]] });
  // (o sorteio em sequência: os alvos rodam entre os três)
  let i = 0;
  const seq = () => [0.1, 0.5, 0.9][i++ % 3];
  const u = usar(m, seq, m.bs[0]);
  assert.equal(u.golpes.length, 25, 'os 25 golpes');
  for (const b of m.bs) assert.ok(acertosEm(u.ev, b) <= 1, 'um dano só por inimigo: o total dos ferimentos');
  const total = m.bs.reduce((t, b) => t + danoEm(u.ev, b), 0);
  assert.ok(Math.abs(total - u.golpes.reduce((t, g) => t + g.danoFinal, 0)) <= 1, 'o dano no fim é a soma dos golpes');
  assert.ok(m.bs.filter((b) => acertosEm(u.ev, b) === 1).length >= 2, 'os golpes vão a alvos diferentes');
  assert.equal(tempoDoGrupo(m.e), Math.round(usoDaGema(m.e) * 25));
  assert.ok(!G.doSlug('Vaal_Flicker_Strike').motivosNoJogo.some((x) => /25 repetições/.test(x)));
});

// ---------------------------------------------------------------- R2: a sequência de áreas num uso

test('A4 R2: os números da sequência no nível 20 (a Chuva de Lâminas, a Colisão de Gelo, o Estilhaçar a Terra) — a Ruptura segue a `linha`', { skip: SEM }, () => {
  assert.deepEqual(G.sequenciaDaGema('Bladefall', 20), { forma: 'retangulo', areas: 5, larguraM: 4.4, porAreaM: 0.6, maisPorAreaPct: 0, critPorAreaPct: 0 });
  assert.equal(G.sequenciaDaGema('Bladefall', 20, 20).areas, 6, 'a qualidade: +1 Rajada');
  const vol = G.sequenciaDaGema('Bladefall_of_Volleys', 20);
  assert.deepEqual([vol.areas, vol.maisPorAreaPct, vol.critPorAreaPct], [6, 10, 25]);
  assert.deepEqual(G.sequenciaDaGema('Ice_Crash', 20), { forma: 'concentrica', areas: 3, raiosM: [1.1, 2.1, 3.1], pcts: [100, 85, 70] });
  assert.deepEqual(G.sequenciaDaGema('Earthshatter', 20, 20), { forma: 'estrela', areas: 6, estacasMax: 18, explosaoMaisPct: -30, raioDaExplosao: 1, quebraSozinha: false });
  assert.equal(G.sequenciaDaGema('Earthshatter_of_Fragility', 20).quebraSozinha, true);
  assert.equal(G.sequenciaDaGema('Sunder', 20).forma, 'linha');
  assert.equal(G.sequenciaDaGema('Cleave', 20), null);
  for (const s of ['Bladefall', 'Bladefall_of_Volleys', 'Ice_Crash', 'Earthshatter', 'Earthshatter_of_Fragility']) {
    assert.ok(!G.doSlug(s).motivosNoJogo.some((m) => /repetições do golpe|Rajada|Estágio causa|terciário|fissura|Estacas/.test(m)), `${s}: ${G.doSlug(s).motivosNoJogo.join(' | ')}`);
  }
});

test('A4 R2 (D4): a Chuva de Lâminas — 5 rajadas à frente, a i-ésima a i+1 casas, 1 casa de fundo e 3 de largura (4,4 m + 0,6 m por rajada)', { skip: SEM }, async () => {
  // (o sorteio alto: a fração da largura não dá a casa a mais — a meia-largura de 1,1 a 1,7 casa fica em 1)
  const m = await montar('Wands/Driftwood_Wand', 'Bladefall', { vocacao: 'sorcerer', classe: 'Witch', onde: [[3, 0], [1, 1], [5, -1], [6, 0], [2, 2]] });
  const pos = { ...m.e.hunt.pos };
  const u = usar(m, 0.999);
  assert.deepEqual(m.bs.map((b) => acertosEm(u.ev, b)), [1, 1, 1, 0, 0], 'as faixas de 1 a 5 casas, 3 de largura; a 6 casas e a 2 de lado, fora');
  const area = u.ev.find((x) => x.t === 'area');
  assert.equal(area.casas.length, 15, 'a tela desenha as 5 faixas de 3 casas');
  assert.ok(area.casas.every(([dx, dy]) => area.x + dx - pos.x >= 1 && area.x + dx - pos.x <= 5 && Math.abs(area.y + dy - pos.y) <= 1));
});

test('A4 R2: as Saraivadas — cada rajada 10% mais dano que a primeira (× a ordem)', { skip: SEM }, async () => {
  const m = await montar('Wands/Driftwood_Wand', 'Bladefall_of_Volleys', { vocacao: 'sorcerer', classe: 'Witch', onde: [[1, 0], [3, 0], [5, 0]] });
  const u = usar(m, 0.999);
  const d = m.bs.map((b) => danoEm(u.ev, b));
  assert.deepEqual(m.bs.map((b) => acertosEm(u.ev, b)), [1, 1, 1]);
  assert.ok(perto(d[1] / d[0], 1.2) && perto(d[2] / d[0], 1.4), `as rajadas 1, 3 e 5: ${d}`);
});

test('A4 R2: a Colisão de Gelo — 3 acertos no mesmo centro (à sua frente), 100% / 85% / 70%; quem está no meio leva os três', { skip: SEM }, async () => {
  // (o sorteio alto: os raios de 1,1 / 2,1 / 3,1 m ficam em 0 / 1 / 1 casa)
  const m = await montar('Two_Hand_Maces/Driftwood_Maul', 'Ice_Crash', { onde: [[1, 0], [2, 0], [3, 0]] });
  const u = usar(m, 0.99);
  assert.deepEqual(m.bs.map((b) => acertosEm(u.ev, b)), [3, 2, 0]);
  const meio = u.ev.filter((x) => x.t === 'dmg' && x.uid === m.bs[0].uid).map((x) => x.v);
  assert.ok(perto(meio[1] / meio[0], 0.85) && perto(meio[2] / meio[0], 0.7), `${meio}`);
});

test('A4 R2 (D5): o Estilhaçar a Terra — 5 fissuras em estrela, uma estaca na ponta de cada; o próximo Impacto nelas as explode com 30% menos', { skip: SEM }, async () => {
  const m = await montar('Two_Hand_Maces/Driftwood_Maul', 'Earthshatter', { onde: [[1, 0], [2, 0], [-2, 0]] });
  const pos = { ...m.e.hunt.pos };
  const u = usar(m, 0.999);
  assert.equal(m.e.hunt.poeEstacas?.length, 5, 'as 5 estacas');
  assert.ok(acertosEm(u.ev, m.bs[0]) === 1 && acertosEm(u.ev, m.bs[2]) === 0, 'a fissura acerta à frente; a de trás não sai (as 5 direções mais perto do alvo)');
  const pontas = m.e.hunt.poeEstacas.map((e) => [e.x - pos.x, e.y - pos.y]);
  assert.ok(pontas.some(([dx, dy]) => dx > 0 && dy === 0), `uma estaca à frente: ${JSON.stringify(pontas)}`);
  // o segundo uso (Impacto) pega as velhas na área dele: elas explodem (a explosão é a gema saindo da estaca — 70% do golpe), e as novas ficam
  m.e.hunt.clock += 5000;
  const u2 = usar(m, 0.999);
  const explosoes = u2.ev.filter((x) => x.t === 'explosao').length;
  assert.equal(explosoes, 5, 'as 5 estacas velhas explodem');
  assert.equal(m.e.hunt.poeEstacas.length, 5, 'as 5 novas ficam (as velhas saíram)');
  const naPonta = u2.ev.filter((x) => x.t === 'dmg' && x.uid === m.bs[1].uid).map((x) => x.v).sort((a, b) => a - b);
  assert.equal(naPonta.length, 2, 'na ponta da fissura: a fissura e a explosão da estaca');
  assert.ok(perto(naPonta[0] / naPonta[1], 0.7, 0.05), `a explosão com 30% menos (o PoB; o dano pequeno arredonda): ${naPonta}`);
  assert.ok(m.e.hunt.poeEstacas.every((e) => e.ate === m.e.hunt.clock + 6000), 'a duração: 6 s');
  // passada a duração, somem (a de Fragilidade explodiria)
  m.e.hunt.clock += 7000;
  Acoes.tiqueDasPlantadas(m.e, m.e.hunt, PERSONAGEM, []);
  assert.equal(m.e.hunt.poeEstacas, undefined);
});

// ---------------------------------------------------------------- E1 e E2: os estágios

/** N usos seguidos (a canalização continua: o próximo logo no fim do anterior). */
function seguidos(m, n, v = 0.5, alvo = m.bs[0]) {
  const usos = [];
  for (let i = 0; i < n; i++) {
    usos.push(usar(m, v, alvo));
    const h = m.e.hunt;
    h.clock = Math.max(h.clock, h.canalizacao?.ate ?? h.clock, (h.cooldowns?.[Acoes.GRUPO_DO_POE]?.ate ?? h.clock));
  }
  return usos;
}

test('A4 E1/E2: os estágios no nível 20 — o máximo do PoB, os modos e os "mais" novos', { skip: SEM }, () => {
  const e = (s, q = 0) => G.estagiosDaGema(s, 20, q);
  assert.deepEqual([e('Vaal_Flameblast').max, e('Vaal_Flameblast').modo, e('Vaal_Flameblast').mais, e('Vaal_Flameblast').maisAfeccao, e('Vaal_Flameblast').raioAposPrimeiro, e('Vaal_Flameblast').explodeCada], [15, 'carrega', 200, 110, true, 3]);
  assert.deepEqual([e('Divine_Ire').max, e('Divine_Ire').modo, e('Divine_Ire').maisAcertoAposPrimeiro, e('Divine_Ire').maisAfeccaoAposPrimeiro], [10, 'carrega', 250, 105], 'D8: a afecção do PoB');
  assert.deepEqual([e('Divine_Ire_of_Disintegration').maisAfeccaoAposPrimeiro, e('Divine_Ire_of_Holy_Lightning').maisAfeccaoAposPrimeiro], [60, 90]);
  assert.deepEqual([e('Snipe').max, e('Snipe', 20).max, e('Snipe').modo, e('Snipe').mais, e('Snipe').maisAfeccao], [6, 7, 'carrega', 108, 80]);
  assert.deepEqual([e('Vaal_Blade_Flurry').max, e('Vaal_Blade_Flurry').modo], [16, 'carrega']);
  assert.equal(e('Blade_Flurry', 20).maisNoMax, 20);
  assert.equal(e('Blade_Flurry_of_Incision', 20).critMultNoMax, 40);
  assert.deepEqual([e('Lightning_Tendrils_of_Escalation').modo, e('Lightning_Tendrils_of_Escalation').porMs, e('Lightning_Tendrils_of_Escalation').raioM, e('Lightning_Tendrils_of_Escalation').raioMaxM, e('Lightning_Tendrils_of_Escalation').max], ['tempo', 1000, 1, 2, 2]);
  assert.deepEqual([e('Reave').max, e('Reave', 20).max, e('Vaal_Reave').max, e('Vaal_Reave', 20).max, e('Vaal_Reave').iniciais, e('Reave').modo, e('Reave').areaMaisPorEstagioPct, e('Reave').raioM], [8, 10, 8, 10, 4, 'acerto', 50, 0], 'D6: o 8 do PoB (o Vaal: 4 + 4, começando com 4)');
  assert.deepEqual([e('Double_Strike_of_Momentum').max, e('Double_Strike_of_Momentum').modo, e('Double_Strike_of_Momentum').velMais, e('Double_Strike_of_Momentum', 20).velMais], [10, 'usos', 10, 14]);
  assert.equal(e('Cyclone_of_Tumult').menosMovimentoPct, 10);
  // (a Maré Invernal e o Orbe Invernal têm os estágios do debuff e do orbe — não da canalização; a Investida Carregada fica para o A1b — D9)
  assert.equal(e('Wintertide_Brand'), null);
  assert.equal(e('Winter_Orb'), null);
  for (const s of ['Vaal_Flameblast', 'Divine_Ire', 'Divine_Ire_of_Disintegration', 'Snipe', 'Blade_Flurry', 'Blade_Flurry_of_Incision', 'Reave', 'Reave_of_Refraction', 'Vaal_Reave', 'Double_Strike_of_Momentum', 'Lightning_Tendrils_of_Escalation', 'Vaal_Blade_Flurry']) {
    assert.ok(!G.doSlug(s).motivosNoJogo.some((m) => /[Ee]stágio|Estágios Máximos|do máximo/.test(m)), `${s}: ${G.doSlug(s).motivosNoJogo.join(' | ')}`);
  }
  assert.ok(G.doSlug('Charged_Dash').motivosNoJogo.some((m) => /onda final/.test(m)), 'D9: a Investida Carregada segue não simulada');
});

test('A4 E1: a Rajada de Chamas Vaal cai no local mirado e explode a cada 3 estágios até 15 (o PoB), com 200% mais Mágico por estágio; o ciclo novo paga a recarga', { skip: SEM }, async () => {
  assert.equal(G.areaNoNivel('Vaal_Flameblast', 20).raioM, 4.5, 'D8: o raio do PoB');
  // (o alvo a 3 casas: a área cai nele — o de perto de você, fora dela, não leva)
  const m = await montar('Wands/Driftwood_Wand', 'Vaal_Flameblast', { vocacao: 'sorcerer', classe: 'Witch', onde: [[4, 0], [0, 1]] });
  const usos = seguidos(m, 15, 0.999);
  const danos = usos.map((u) => danoEm(u.ev, m.bs[0]));
  assert.deepEqual(danos.map((d) => d > 0), Array.from({ length: 15 }, (_, i) => (i + 1) % 3 === 0), `explode no 3, 6, 9, 12 e 15: ${danos}`);
  assert.ok(perto(danos[5] / danos[2], (1 + 2 * 6) / (1 + 2 * 3), 0.05), `o "mais" do estágio: ${danos[5]} / ${danos[2]}`);
  assert.ok(usos.every((u) => acertosEm(u.ev, m.bs[1]) === 0), 'cai no alvo, não em volta de você');
  const area = usos[2].ev.find((x) => x.t === 'area');
  const cs = area.casas.map(([dx, dy]) => [area.x + dx, area.y + dy]);
  const meio = [cs.reduce((t, c) => t + c[0], 0) / cs.length, cs.reduce((t, c) => t + c[1], 0) / cs.length];
  assert.deepEqual(meio, [m.bs[0].x, m.bs[0].y], 'o centro é o alvo');
  // depois da liberação do 15º, o ciclo seguinte é novo: paga a recarga (as Almas)
  const id = m.e.actions[0].id;
  m.e.hunt.cooldowns[id] = { ate: m.e.hunt.clock + 60_000, total: 60_000 };
  const r = sorte(0.5, () => Acoes.disparar(m.e, m.e.hunt, PERSONAGEM, 0, m.bs[0], { manual: true }));
  assert.equal(r.motivo, 'COOLDOWN', 'a canalização liberada não continua de graça');
});

test('A4 E1: a Ira Divina — cada estágio ganho acerta os 5 inimigos mais perto; a liberação no 10º (a explosão e o feixe) com 250% mais por estágio após o primeiro', { skip: SEM }, async () => {
  const onde = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, -1], [5, 0]];
  const m = await montar('Wands/Driftwood_Wand', 'Divine_Ire', { vocacao: 'sorcerer', classe: 'Witch', onde });
  const usos = seguidos(m, 10, 0.999, m.bs[6]);
  const acertadosNoUso = (u) => m.bs.filter((b) => acertosEm(u.ev, b) > 0).length;
  for (const u of usos.slice(0, 9)) assert.equal(acertadosNoUso(u), 5, 'os 5 mais perto a cada estágio');
  assert.equal(acertosEm(usos[0].ev, m.bs[6]), 0, 'o de longe não leva o toque');
  const lib = usos[9];
  assert.ok(acertosEm(lib.ev, m.bs[6]) === 1, 'o feixe vai até o alvo à frente');
  assert.ok(m.bs.slice(0, 6).every((b) => acertosEm(lib.ev, b) === 1), 'a explosão em volta');
  // (o toque e a liberação: o mesmo golpe; a liberação × (1 + 2,5 × 9))
  const toque = danoEm(usos[0].ev, m.bs[0]);
  assert.ok(perto(danoEm(lib.ev, m.bs[0]) / toque, 1 + 2.5 * 9, 0.03), `${danoEm(lib.ev, m.bs[0])} / ${toque}`);
});

test('A4 E1 (D10): o Atirar — sem suportada, a flecha própria no 6º estágio (108% mais por estágio); com o Tiro Gélido ligado, 6 ativações dele e sem a flecha própria', { skip: SEM }, async () => {
  const sem = await montar('Bows/Crude_Bow', 'Snipe', { onde: [[3, 0]] });
  const d = seguidos(sem, 6, 0.999).map((u) => danoEm(u.ev, sem.bs[0]));
  assert.deepEqual(d.slice(0, 5).map((x) => x > 0), Array(5).fill(false), `carregando: ${d}`);
  assert.ok(d[5] > 0, `a flecha própria no 6º: ${d}`);
  const com = await montar('Bows/Crude_Bow', 'Snipe', { suportes: ['Ice_Shot'], onde: [[3, 0]] });
  const usos = seguidos(com, 6, 0.999);
  const lib = usos[5];
  assert.equal(lib.ev.filter((x) => x.t === 'gatilho').length, 6, 'uma ativação por estágio');
  assert.ok(lib.ev.filter((x) => x.t === 'dmg' && x.foe && x.spell === 'Atirar').length === 0, 'a flecha própria não sai');
  assert.ok(danoEm(lib.ev, com.bs[0]) > 0, 'o Tiro Gélido acerta');
});

test('A4 E1: as Lâminas Velozes Vaal — a liberação acerta cada inimigo no círculo (1 m + 0,5 m por estágio); canalizando, 50% menos dano sofrido', { skip: SEM }, async () => {
  const m = await montar('Daggers/Glass_Shank', 'Vaal_Blade_Flurry', { onde: [[1, 0], [4, 0], [9, 0]] });
  const usos = seguidos(m, 16, 0.999);
  assert.ok(usos.slice(0, 15).every((u) => m.bs.every((b) => acertosEm(u.ev, b) === 0)), 'carregando, sem acerto');
  // (no 16º: 1 + 0,5 × 16 = 9 m → 4 casas e meia → 4 com o sorteio alto)
  assert.deepEqual(m.bs.map((b) => acertosEm(usos[15].ev, b)), [1, 1, 0]);
  // canalizando: o "menos dano sofrido" na ficha
  const m2 = await montar('Daggers/Glass_Shank', 'Vaal_Blade_Flurry', { onde: [[1, 0]] });
  usar(m2, 0.999);
  Ficha.invalidar(m2.e);
  assert.equal(Ficha.combate(m2.e).afPoe.dano_recebido_mais, -50);
});

test('A4 E1: as Gavinhas Elétricas da Escalada — +1 m de raio por segundo canalizando, até +2 m', { skip: SEM }, async () => {
  const m = await montar('Wands/Driftwood_Wand', 'Lightning_Tendrils_of_Escalation', { vocacao: 'sorcerer', classe: 'Witch', onde: [[0, -1]] });
  const tamanho = (u) => u.ev.find((x) => x.t === 'area')?.casas.length ?? 0;
  const primeiro = usar(m, 0.999);
  // o canal contínuo por 2 s (os usos seguidos)
  let ultimo = primeiro;
  for (let t = 0; t < 40 && (m.e.hunt.clock - m.e.hunt.canalizacao.desde) < 2100; t++) {
    m.e.hunt.clock = Math.max(m.e.hunt.clock, m.e.hunt.canalizacao.ate, m.e.hunt.cooldowns?.[Acoes.GRUPO_DO_POE]?.ate ?? 0);
    ultimo = usar(m, 0.999);
  }
  assert.ok(tamanho(ultimo) > tamanho(primeiro), `o raio cresce: ${tamanho(primeiro)} → ${tamanho(ultimo)}`);
});

test('A4 E2 (D6): o Devastar — cada uso que acerta ganha 1 estágio (50% mais área por estágio, até 8); 2 s sem acertar zeram', { skip: SEM }, async () => {
  const m = await montar('Daggers/Glass_Shank', 'Reave', { onde: [[1, -1], [3, -3]] });
  const tamanho = (u) => u.ev.find((x) => x.t === 'area')?.casas.length ?? 0;
  const usos = seguidos(m, 9, 0.999);
  const st = m.e.hunt.poeEstagios[m.e.actions[0].id];
  assert.equal(st.n, 8, 'o máximo do PoB');
  assert.ok(tamanho(usos[8]) > tamanho(usos[0]), `a área cresce: ${usos.map(tamanho)}`);
  m.e.hunt.clock += 2500;
  const depois = usar(m, 0.999);
  assert.equal(tamanho(depois), tamanho(usos[0]), 'depois de 2 s sem acertar, recomeça');
  assert.equal(m.e.hunt.poeEstagios[m.e.actions[0].id].n, 1);
});

test('A4 E2: o Golpe Duplo do Ímpeto — 1 estágio a cada ataque par (10% mais Velocidade de Ataque por estágio); mover-se zera', { skip: SEM }, async () => {
  const m = await montar('One_Hand_Swords/Rusted_Sword', 'Double_Strike_of_Momentum', { onde: [[1, 0]] });
  const base = usoDaGema(m.e);
  seguidos(m, 4, 0.999);
  assert.equal(m.e.hunt.poeEstagios[m.e.actions[0].id].n, 2);
  assert.ok(perto(base / usoDaGema(m.e), 1.2, 0.03), `2 estágios: ${base} → ${usoDaGema(m.e)}`);
  m.e.hunt.pos.x += 1;
  m.bs[0].x += 1;
  assert.equal(usoDaGema(m.e), base, 'moveu: sem estágios');
});

test('A4: o Ciclone canalizando — 20% menos Velocidade de Movimento (só enquanto canaliza)', { skip: SEM }, async () => {
  const m = await montar('Two_Hand_Swords/Corroded_Blade', 'Cyclone', { onde: [[1, 0]] });
  Ficha.invalidar(m.e);
  const antes = Ficha.combate(m.e).afPoe.move_speed_mais ?? 0;
  usar(m, 0.999);
  assert.equal((Ficha.combate(m.e).afPoe.move_speed_mais ?? 0) - antes, -20);
  m.e.hunt.clock += 5000;
  Ficha.invalidar(m.e);
  assert.equal(Ficha.combate(m.e).afPoe.move_speed_mais ?? 0, antes, 'parou de canalizar');
});

// ---------------------------------------------------------------- A e C: o ângulo e a área do Ciclone

test('A4 A (D7): Areas.abrirForma — o ângulo × o fator no mesmo raio; 1 = a mesma forma; até 360°', () => {
  const varredura = [[-1, -1], [0, -1], [1, -1]];
  assert.deepEqual(Areas.abrirForma(varredura, 1), varredura);
  const dobro = Areas.abrirForma(varredura, 2).map((c) => c.join(',')).sort();
  assert.deepEqual(dobro, ['-1,-1', '-1,0', '0,-1', '1,-1', '1,0'].sort(), 'de 45° para 90°: as casas do lado');
  const cone = [[-2, -3], [-1, -3], [0, -3], [1, -3], [2, -3], [-1, -2], [0, -2], [1, -2], [-1, -1], [0, -1], [1, -1], [0, 0]];
  const todo = Areas.abrirForma(cone, 4);
  assert.ok(todo.some(([dx, dy]) => dy > 0), 'o cone de 4× vira para trás (360°)');
  assert.ok(Areas.abrirForma(cone, 1.8).length > cone.length);
  assert.ok(Areas.abrirForma(cone, 1.8).every(([dx, dy]) => Math.max(Math.abs(dx), Math.abs(dy)) <= 3), 'o mesmo raio');
});

test('A4 A (D7): o Golpe no Chão do Tremor (+100%), a Laceração do Abate (+50%) e a Laceração na Postura da Areia; o Incinerar por estágio', { skip: SEM }, async () => {
  assert.deepEqual(G.anguloDaGema('Ground_Slam_of_Earthshaking', 20), { incPct: 100, naAreiaPct: 0, porEstagioPct: 0, maxPct: null });
  assert.equal(G.anguloDaGema('Lacerate', 20).naAreiaPct, 50);
  assert.deepEqual([G.anguloDaGema('Incinerate', 20).porEstagioPct, G.anguloDaGema('Incinerate', 20).maxPct], [100, 300]);
  assert.equal(G4.anguloNoUso(G.anguloDaGema('Incinerate', 20), { estagio: 5 }), 300, 'até 300%');
  const area = async (gema, antes) => {
    const m = await montar('Two_Hand_Maces/Driftwood_Maul', gema, { onde: [[0, -1]] });
    antes?.(m);
    return usar(m, 0.999).ev.find((x) => x.t === 'area').casas;
  };
  const comum = await area('Ground_Slam');
  const tremor = await area('Ground_Slam_of_Earthshaking');
  assert.ok(tremor.some(([dx, dy]) => dy >= 0 && dx !== 0) && !comum.some(([, dy]) => dy > 0), `o Tremor abre para os lados: ${JSON.stringify(tremor)}`);
  // (a Laceração: a varredura de 1 casa — 45° —, a 67,5° no mesmo raio, é a mesma; com a área de 300% a mais — 2 casas — a casa de 63° entra)
  const comArea = (m) => { m.e.equipment.ring = { id: 0, count: 1, af: [], poe: { af: { area_inc: 300 } } }; Ficha.invalidar(m.e); };
  const lac = await area('Lacerate', comArea);
  const naAreia = await area('Lacerate', (m) => { comArea(m); m.e.hunt.buffs = { ...(m.e.hunt.buffs ?? {}), 'poe-gema:Blood_and_Sand': { ate: 1e12, tipo: 'poe-aura' } }; });
  assert.ok(naAreia.length > lac.length, `na Postura da Areia, 50% mais ângulo: ${lac.length} → ${naAreia.length}`);
  for (const s of ['Ground_Slam_of_Earthshaking', 'Lacerate_of_Butchering', 'Incinerate', 'Ice_Shot']) assert.ok(!G.doSlug(s).motivosNoJogo.some((x) => /[Ââ]ngulo/.test(x)), `${s}: ${G.doSlug(s).motivosNoJogo.join(' | ')}`);
});

test('A4 A (D7): o Tiro Gélido — o cone sai do alvo na direção do tiro (o de trás leva, o do lado não), todo o Físico do cone como Gelo', { skip: SEM }, async () => {
  const m = await montar('Bows/Crude_Bow', 'Ice_Shot', { onde: [[2, 0], [3, 0], [2, 3]], qualidade: 20 });
  Registro.definirNivel(2);
  const u = usar(m, 0.999);
  assert.deepEqual(m.bs.map((b) => acertosEm(u.ev, b)), [1, 1, 0], 'a flecha no alvo; o cone atrás dele');
  const cone = u.golpes.filter((g) => g.detalhe?.porElemento).at(-1);
  assert.ok(cone && !(cone.detalhe.porElemento.physical > 0) && cone.detalhe.porElemento.ice > 0, `o cone sem Físico: ${JSON.stringify(cone?.detalhe?.porElemento)}`);
  const flecha = u.golpes[0];
  assert.ok(flecha.detalhe.porElemento.physical > 0, 'a flecha mantém os 40% de Físico');
});

test('A4 C: o Ciclone — "Área de Efeito aumentada em 15% por cada 0.1 metro de Alcance adicional" (o alcance a mais das peças)', { skip: SEM }, async () => {
  assert.equal(G.areaPorAlcanceDaGema('Cyclone', 20), 15);
  assert.equal(G.areaPorAlcanceDaGema('Cyclone', 20, 20), 20, 'a qualidade: +5');
  const area = async (metros) => {
    const m = await montar('Two_Hand_Swords/Corroded_Blade', 'Cyclone', { onde: [[1, 0]] });
    if (metros) { m.e.equipment.ring = { id: 0, count: 1, af: [], poe: { af: { alcance_corpo_m: metros } } }; Ficha.invalidar(m.e); }
    return usar(m, 0.999).ev.find((x) => x.t === 'area').casas.length;
  };
  // (o raio do Ciclone, 1,6 m, fica na varredura de 1 casa; +2 m de alcance = +300% de área: o dobro do raio)
  const sem = await area(0);
  const com = await area(2);
  assert.ok(com > sem, `+2 m de alcance = +300% de área: ${sem} → ${com}`);
  assert.ok(!G.doSlug('Cyclone').motivosNoJogo.some((x) => /Alcance de Golpe|Velocidade de Movimento/.test(x)), G.doSlug('Cyclone').motivosNoJogo.join(' | '));
});

// ---------------------------------------------------------------- os objetos no tempo

test('A4: o Orbe Invernal — cada uso canalizando soma 1 estágio ao orbe (até 8) e renova a duração; ele dispara 3 projéteis a cada intervalo', { skip: SEM }, async () => {
  const o = G.orbeDaGema('Winter_Orb', 20);
  assert.deepEqual([o.intervaloMs, o.projeteis, o.duracaoPorEstagioPct, o.frequenciaPorEstagioPct, o.canalizandoMaisPct], [1200, 3, 30, 20, 80]);
  const m = await montar('Wands/Driftwood_Wand', 'Winter_Orb', { vocacao: 'sorcerer', classe: 'Witch', onde: [[2, 0]] });
  const usos = seguidos(m, 3, 0.999);
  assert.ok(usos.every((u) => m.bs.every((b) => acertosEm(u.ev, b) === 0)), 'o uso só carrega o orbe');
  const orbe = m.e.hunt.poeOrbes?.[0];
  assert.equal(orbe?.estagios, 3);
  assert.ok(orbe.ate - m.e.hunt.clock > 1600, 'a duração com 30% por estágio após o primeiro');
  // o tique: o orbe dispara (canalizando, 80% mais frequência)
  const ev = [];
  m.e.hunt.clock = orbe.proxima;
  sorte(0.5, () => Acoes.tiqueDasPlantadas(m.e, m.e.hunt, PERSONAGEM, ev));
  assert.equal(ev.filter((x) => x.t === 'dmg' && x.foe).length, 3, 'os 3 projéteis, no único inimigo perto');
  m.e.hunt.clock += 10_000;
  Acoes.tiqueDasPlantadas(m.e, m.e.hunt, PERSONAGEM, []);
  assert.equal(m.e.hunt.poeOrbes, undefined, 'acabou a duração');
  assert.ok(!G.doSlug('Winter_Orb').motivosNoJogo.some((x) => /Estágio|projéteis a cada|Frequência|canalização não/.test(x)), G.doSlug('Winter_Orb').motivosNoJogo.join(' | '));
});

test('A4: o Raio Abrasador — cada uso que acerta soma 1 estágio ao debuff (até 8; cada estágio a mais = +80% do dano); no 8º, a Exposição a Fogo de −25%', { skip: SEM }, async () => {
  assert.deepEqual(G.debuffDaGema('Scorching_Ray', 20), { max: 8, porEstagioPct: 80, aposPrimeiro: true, duracaoMs: null, exposicaoPct: -25 });
  assert.deepEqual([G.debuffDaGema('Wintertide_Brand', 20).max, G.debuffDaGema('Wintertide_Brand', 20).porEstagioPct, G.debuffDaGema('Wintertide_Brand', 20).duracaoMs, G.debuffDaGema('Wintertide_Brand', 20, 20).porEstagioPct], [20, 20, 2000, 25]);
  const m = await montar('Wands/Driftwood_Wand', 'Scorching_Ray', { vocacao: 'sorcerer', classe: 'Witch', onde: [[0, -1]] });
  const dot = () => (m.bs[0].dots ?? []).filter((d) => d.chave === 'Scorching_Ray').reduce((t, d) => t + d.falta, 0);
  usar(m, 0.999);
  const um = dot();
  assert.ok(um > 0);
  m.bs[0].dots = [];
  m.e.hunt.clock += 100;
  usar(m, 0.999);
  assert.ok(perto(dot() / um, 1.8, 0.03), `2 estágios: ${dot()} / ${um}`);
  for (let i = 0; i < 6; i++) { m.e.hunt.clock += 100; usar(m, 0.999); }
  assert.equal(m.bs[0].estados.poeEstagiosDoDebuff.Scorching_Ray.n, 8);
  assert.ok(m.bs[0].estados.exposicao?.fire > m.e.hunt.clock && m.bs[0].estados.exposicaoPct.fire === 25, 'a Exposição a Fogo no máximo');
});

test('A4: as Excepcionais do Vazio — a Onda de Choque no acerto corpo a corpo (e as repetições dos acertados, com −50%); a Tormenta onde o ataque cai, que explode quando um inimigo entra', { skip: SEM }, async () => {
  const m = await montar('Two_Hand_Maces/Driftwood_Maul', 'Heavy_Strike', { suportes: ['Void_Shockwave_Support'], onde: [[1, 0], [2, 0], [2, 1]], nivel: 3 });
  const u = usar(m, 0.999);
  const ondas = u.ev.filter((x) => x.t === 'dmg' && x.fonte === 'onda-do-vazio');
  assert.ok(ondas.length >= 3, `a onda e as repetições: ${ondas.length}`);
  assert.ok(u.ev.filter((x) => x.t === 'explosao').length >= 2, 'a onda do alvo e a dos acertados');
  // a recarga de 0,5 s da onda
  assert.equal(m.e.hunt.poeOndaDoVazioAte, 100_000 + 500);
  // fora de Machado/Maça/Cetro/Cajado, não sai
  const espada = await montar('Two_Hand_Swords/Corroded_Blade', 'Heavy_Strike', { suportes: ['Void_Shockwave_Support'], nivel: 3 });
  const r = sorte(0.5, () => Acoes.disparar(espada.e, espada.e.hunt, PERSONAGEM, 0, espada.bs[0], { manual: true }));
  assert.equal(r.motivo, 'ARMA');
  // a Tormenta: a Chuva de Flechas cai no alvo (a mais de 3 m de você); o inimigo nela a explode
  const t = await montar('Bows/Crude_Bow', 'Rain_of_Arrows', { suportes: ['Voidstorm_Support'], onde: [[4, 0]], nivel: 3 });
  usar(t, 0.999);
  assert.equal(t.e.hunt.poeTormentas?.length, 1, 'a tormenta onde o ataque caiu');
  const ev = [];
  t.e.hunt.clock += 1000;
  sorte(0.999, () => Acoes.tiqueDasPlantadas(t.e, t.e.hunt, PERSONAGEM, ev));
  assert.ok(ev.some((x) => x.t === 'dmg' && x.fonte === 'tormenta-do-vazio'), 'explodiu no inimigo dentro dela');
  assert.equal(t.e.hunt.poeTormentas, undefined);
});

test('A4: a Maré Invernal — cada Ativação da Marca soma 1 estágio ao debuff no inimigo (20% mais por estágio, até 20), pela duração de 2 s do debuff', { skip: SEM }, async () => {
  const m = await montar('Wands/Driftwood_Wand', 'Wintertide_Brand', { vocacao: 'sorcerer', classe: 'Witch', onde: [[3, 0]] });
  const dot = () => (m.bs[0].dots ?? []).filter((d) => d.chave === 'Wintertide_Brand').reduce((t, d) => t + d.falta, 0);
  usar(m, 0.999);
  const st = () => m.bs[0].estados?.poeEstagiosDoDebuff?.Wintertide_Brand;
  assert.equal(st()?.n, 1, 'a primeira Ativação');
  const um = dot();
  m.bs[0].dots = [];
  m.e.hunt.clock += 260;
  sorte(0.999, () => Acoes.tiqueDasRunas(m.e, m.e.hunt, PERSONAGEM, []));
  assert.equal(st().n, 2);
  assert.ok(perto(dot() / um, 1.4 / 1.2, 0.03), `${dot()} / ${um}`);
  assert.ok(st().ate - m.e.hunt.clock <= 2000 * 1.5 && st().ate > m.e.hunt.clock, 'a duração do debuff');
});

test('A4: a Flecha Flagelante liberada deixa 1 esporo por estágio na linha até o alvo; cada um dispara 9 Flechas de Espinho (50% menos dano) nos vivos perto', { skip: SEM }, async () => {
  assert.deepEqual(G.esporosDaGema('Scourge_Arrow', 20), { porEstagio: 1, flechas: 9, menosPct: 50, raio: 2 });
  assert.equal(G.esporosDaGema('Scourge_Arrow', 20, 20).flechas, 11);
  const m = await montar('Bows/Crude_Bow', 'Scourge_Arrow', { onde: [[3, 0]] });
  const usos = seguidos(m, 5, 0.999);
  const lib = usos[4];
  const espinhos = lib.ev.filter((x) => x.t === 'dmg' && x.foe && x.fonte === 'espinho');
  assert.equal(espinhos.length, 5 * 9, 'os 5 esporos × 9 flechas');
  const flecha = lib.ev.find((x) => x.t === 'dmg' && x.foe && !x.fonte);
  assert.ok(flecha && perto(espinhos[0].v / flecha.v, 0.5, 0.05), `os espinhos com 50% menos: ${espinhos[0]?.v} / ${flecha?.v}`);
});

// ---------------------------------------------------------------- a revisão do A4

test('A4 (revisão): o totem, a estaca e o orbe não repetem; o balão só põe o (1 + r) onde o motor põe', { skip: SEM }, async () => {
  const m = await montar('Two_Hand_Maces/Driftwood_Maul', 'Heavy_Strike', { suportes: ['Multistrike_Support'] });
  const entry = Acoes.POR_ID_PUBLICO(m.e.actions[0].id);
  const ef = GS.efeitoNaSkill(m.e, m.e.actions[0].id);
  const f = Ficha.combate(m.e);
  assert.equal(Acoes.repeticoesDoUso(entry, ef, f), 2);
  for (const tipo of ['totem', 'estaca', 'orbe']) assert.equal(Acoes.repeticoesDoUso(entry, ef, f, { plantada: { tipo } }), 0, tipo);
  // (o Altar Ecoante — repeticoes_extra — num Clamor: o motor não repete o buff, e o balão também não)
  const c = await montar('Two_Hand_Maces/Driftwood_Maul', 'Enduring_Cry');
  c.e.equipment.ring = { id: 0, count: 1, af: [], poe: { af: { repeticoes_extra: 1 } } };
  Ficha.invalidar(c.e);
  const b = Acoes.catalogo(c.e).spells.find((x) => x.id === c.e.actions[0].id);
  assert.equal(b.groupCooldown, b.tempoPoe.uso);
});

test('A4 (revisão): o Estilhaçar a Terra com o Golpe Múltiplo — cada repetição deixa as estacas dela; a explosão da estaca não repete', { skip: SEM }, async () => {
  const m = await montar('Two_Hand_Maces/Driftwood_Maul', 'Earthshatter', { suportes: ['Multistrike_Support'], onde: [[1, 0], [2, 0]] });
  usar(m, 0.999);
  assert.equal(m.e.hunt.poeEstacas.length, 15, 'as 5 estacas × 3 impactos (o máximo é 15)');
  // uma estaca só, perto do bicho: a explosão acerta uma vez
  m.e.hunt.poeEstacas = [{ ...m.e.hunt.poeEstacas[0], x: m.bs[1].x, y: m.bs[1].y }];
  const ev = [];
  m.e.hunt.clock += 7000;
  m.e.hunt.poeEstacas[0].quebraSozinha = true;
  sorte(0.999, () => Acoes.tiqueDasPlantadas(m.e, m.e.hunt, PERSONAGEM, ev));
  assert.equal(acertosEm(ev, m.bs[1]), 1, 'a quebra da estaca não é repetida');
});

test('A4 (revisão): o Tiro Gélido da Penetração — dois cones perpendiculares ao alvo (o de trás não leva)', { skip: SEM }, async () => {
  // (o raio de 3,1 m com o sorteio alto: o cone de 1 casa — a casa colada de cada lado do alvo; o de trás leva só a flecha que atravessa)
  const m = await montar('Bows/Crude_Bow', 'Ice_Shot_of_Penetration', { onde: [[2, 0], [3, 0], [2, 1], [2, -1]] });
  const u = usar(m, 0.999);
  assert.equal(acertosEm(u.ev, m.bs[0]), 1);
  assert.ok(acertosEm(u.ev, m.bs[2]) >= 1 && acertosEm(u.ev, m.bs[3]) >= 1, `os dois lados: ${m.bs.map((b) => acertosEm(u.ev, b))}`);
  assert.equal(acertosEm(u.ev, m.bs[1]), 1, 'o de trás: só a flecha (a perfuração), sem o cone do alvo');
});

test('A4 (revisão): o Raio Abrasador na qualidade — a Exposição −0,25% por ponto (−30% na 20)', { skip: SEM }, () => {
  assert.deepEqual([0, 1, 10, 20].map((q) => G.debuffDaGema('Scorching_Ray', 20, q).exposicaoPct), [-25, -25.25, -27.5, -30]);
});

test('A4 (revisão): o Orbe Invernal fora da canalização perde 1 estágio por duração (a frequência cai), em vez de sumir', { skip: SEM }, async () => {
  const m = await montar('Wands/Driftwood_Wand', 'Winter_Orb', { vocacao: 'sorcerer', classe: 'Witch', onde: [[2, 0]] });
  seguidos(m, 4, 0.999);
  const o = m.e.hunt.poeOrbes[0];
  assert.equal(o.estagios, 4);
  const fim = o.ate;
  m.e.hunt.clock = fim + 10;
  sorte(0.5, () => Acoes.tiqueDasPlantadas(m.e, m.e.hunt, PERSONAGEM, []));
  assert.equal(m.e.hunt.poeOrbes?.[0]?.estagios, 3, 'perdeu 1 estágio e segue');
  m.e.hunt.clock += 60_000;
  sorte(0.5, () => Acoes.tiqueDasPlantadas(m.e, m.e.hunt, PERSONAGEM, []));
  assert.equal(m.e.hunt.poeOrbes, undefined, 'com 1 estágio, no fim da duração, acaba');
});

test('A4 (revisão): o Devastar Vaal começa com 4 estágios (reave_additional_starting_stacks) e vai até 8', { skip: SEM }, async () => {
  const m = await montar('Daggers/Glass_Shank', 'Vaal_Reave', { onde: [[1, -1]] });
  usar(m, 0.999);
  assert.equal(m.e.hunt.poeEstagios[m.e.actions[0].id].n, 5, 'começou com 4 e o acerto deu mais 1');
});
