// AS LINHAS DAS ATIVAS QUE O COMPILADOR LIA E NINGUÉM USAVA (lote G18a, 17/10): o "mais/menos Dano de Afecções" e o "com Sangramento" da gema,
// o "como se causasse" / Efeito / Duração das afecções de Gelo e da Eletrização, o terceiro golpe do Martelo Glacial, o "até X% mais Dano com
// Acertos aos alvos próximos", os projéteis secundários do Golpe Vulcânico (e o quinto ataque do Zênite), o "mais Dano Mágico" do Fogo Justo (só
// no acerto), os estágios pela flag do PoB (o Incinerar, a Rajada de Chamas), o ricochete restante do Chicote da Naja e as afecções da explosão
// dos cadáveres. Antes iam a `stats.maisDano`, `afeccaoMais`, `danoPorEstagio`… e sumiam do status como "aplicadas". Mede no jogo.
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
const Registro = await import('../systems/combate/registro.mjs');
const AfeccoesPoe = await import('../systems/itens-poe/afeccoes.mjs');

const sorte = (v, f) => { const o = Math.random; Math.random = () => v; try { return f(); } finally { Math.random = o; } };
const perto = (a, b, tol = 0.02) => Math.abs(a / b - 1) < tol;

/**
 * O personagem com a arma e as gemas (cada grupo `[ativa, ...suportes]` ligado entre si; os grupos em soquetes soltos), a ativa do grupo i no slot
 * i da barra, numa caçada com o alvo imortal colado (o resto longe; o sorteio da entrada fixo e o alvo sem resistência própria).
 */
async function montar(arma, grupos, { qualidade = 0 } = {}) {
  const J = await import('../systems/itens-poe/jogo.mjs');
  const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Scion', sistema: 'poe' });
  const a = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: arma, raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
  const todas = grupos.flat();
  // (cada gema ligada à seguinte do mesmo grupo; entre grupos, solta)
  const links = grupos.flatMap((g) => g.map((_, i) => i < g.length - 1)).slice(0, todas.length - 1);
  a.soquetes = { abertos: todas.length, links, gemas: Array(todas.length).fill(null), cores: Array(todas.length).fill('W') };
  e.equipment = { ...e.equipment, weapon: a };
  delete e.equipment.shield;
  e.inventory = todas.map((s) => GS.itemDaGema({ id: (G.doSlug(s) ?? SP.doSlug(s)).itemId, nivel: 20, xp: 0, raridade: 'comum', ...(qualidade && G.doSlug(s) ? { qualidade } : {}) }));
  for (let i = 0; i < todas.length; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  e.actions = Array(Acoes.SLOTS).fill(null);
  grupos.forEach((g, i) => { e.actions[i] = { id: G.doSlug(g[0]).acao, enabled: true, minMana: 0, conditions: [] }; });
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(sorte(0.999, () => Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' })).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 1e7;
  e.maxHp = e.hp = 1e7;
  const [b, ...resto] = e.hunt.monstros;
  for (const m of resto) Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60 });
  Object.assign(b, { x: e.hunt.pos.x + 1, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12, estados: {}, dots: [], resist: {} });
  return { e, b, resto };
}
/** Um uso do slot com o sorteio fixo em `v`: os golpes da gema (o registro), os eventos e os dots no alvo. */
function usar({ e, b }, v, slot = 0, alvo = b) {
  Registro.definirNivel(2);
  Registro.limparRegistro();
  try {
    const eventos = [];
    sorte(v, () => {
      const r = Acoes.disparar(e, e.hunt, PERSONAGEM, slot, alvo, { manual: true });
      assert.ok(r.ok, r.erro);
      eventos.push(...(r.eventos ?? []));
      if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; eventos.push(...(Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM) ?? [])); }
    });
    return { golpes: Registro.ultimosGolpes(300).filter((g) => g.origem === 'gema'), eventos, dots: b.dots ?? [] };
  } finally { Registro.definirNivel(0); }
}
const totalDo = (dots, tipo) => dots.filter((d) => d.tipo === tipo).reduce((t, d) => t + (d.falta ?? 0), 0);
const fisicoDe = (g) => g.detalhe?.porElemento?.physical ?? (g.tipo === 'physical' ? g.danoAntesDaResistencia : 0);

test('G18a: as linhas das ativas vão a chaves que o jogo lê (nenhuma chave morta no compilador) e o status fica honesto', { skip: SEM }, () => {
  for (const [slug] of G.REGISTRO) {
    const st = G.compilada(slug, 20, 20)?.stats ?? {};
    for (const k of ['maisDano', 'afeccaoMais', 'danoPorEstagio', 'danoPorRicochete', 'afeccaoDuracao']) assert.equal(st[k], undefined, `${slug}: ${k}`);
  }
  assert.deepEqual(G.maisNasAfeccoesDaGema('Crushing_Fist', 20), { maisAfeccaoPct: -60, maisSangramentoPct: 0 });
  assert.deepEqual([G.maisNasAfeccoesDaGema('Puncture', 20).maisSangramentoPct, G.maisNasAfeccoesDaGema('Puncture', 20, 20).maisSangramentoPct], [49, 69], 'o nível e a qualidade somam');
  assert.equal(G.linhasLocaisNoNivel('Ice_Shot', 20).af.resfriamento_como_mais, 195);
  assert.equal(G.linhasLocaisNoNivel('Lightning_Trap', 20).af.efeito_eletrizacao, 19);
  assert.deepEqual([G.linhasLocaisNoNivel('Glacial_Hammer', 20).af.duracao_congelamento, G.linhasLocaisNoNivel('Glacial_Hammer', 20).af['congelamento_como_mais@terceiroGolpe']], [35, 390]);
  assert.deepEqual(G.maisPertoNoNivel('Ground_Slam', 20), { pct: 49, rampa: 'perto' });
  assert.deepEqual(G.projeteisDaGema('Molten_Strike_of_the_Zenith', 20), { pct: -60, quintoPct: 600, quintoProjeteis: 5 });
  // (as gemas cujos estágios não existem no jogo ficam parciais, com a linha não feita — antes pareciam feitas)
  for (const s of ['Snipe', 'Divine_Ire', 'Vaal_Flameblast']) assert.ok(G.doSlug(s).motivosNoJogo.some((m) => /por Estágio|por estágio/.test(m)), `${s}: ${G.doSlug(s).motivosNoJogo.join(' | ')}`);
  // (a Troca de Corpos do Sacrifício não acerta: o "menos Dano de Afecções" dela fica não feito)
  assert.ok(G.doSlug('Bodyswap_of_Sacrifice').motivosNoJogo.some((m) => /menos Dano de Afecções/.test(m)));
});

test('G18a: o Punho Esmagador — o Sangramento sai 60% menor em relação ao acerto (o Golpe Pesado de referência, com a Chance de Sangramento)', { skip: SEM }, async () => {
  const razao = async (ativa) => {
    const m = await montar('Two_Hand_Maces/Driftwood_Maul', [[ativa, 'Chance_to_Bleed_Support']]);
    // (a Retaliação do Punho: a janela aberta)
    const ret = G.gatilhoDeRetaliacao(ativa);
    if (ret) m.e.hunt.retaliacao = { [ret]: { ate: Infinity, usados: [] } };
    const u = usar(m, 0.01);
    const fis = u.golpes.reduce((t, g) => t + fisicoDe(g), 0);
    assert.ok(fis > 0 && totalDo(u.dots, 'sangramento') > 0, `${ativa}: ${fis} / ${totalDo(u.dots, 'sangramento')}`);
    return totalDo(u.dots, 'sangramento') / fis;
  };
  assert.ok(perto((await razao('Crushing_Fist')) / (await razao('Heavy_Strike')), 0.4), 'o Sangramento ×0,4');
});

test('G18a: a Punctura — o "mais Dano com Sangramento" da qualidade soma com o do nível (1,69 ÷ 1,49 no Sangramento por acerto)', { skip: SEM }, async () => {
  const razao = async (qualidade) => {
    const u = usar(await montar('Daggers/Sai', [['Puncture']], { qualidade }), 0.01);
    return totalDo(u.dots, 'sangramento') / u.golpes.reduce((t, g) => t + fisicoDe(g), 0);
  };
  assert.ok(perto((await razao(20)) / (await razao(0)), 1.69 / 1.49), 'a qualidade 20 soma 20 pontos');
});

test('G18a: o Tiro Gélido — o Resfriamento "como se causasse 195% mais Dano" (a força pelo Gelo × 2,95)', { skip: SEM }, async () => {
  const m = await montar('Bows/Crude_Bow', [['Ice_Shot']]);
  const gelo = usar(m, 0.99).golpes.reduce((t, g) => t + (g.detalhe?.porElemento?.ice ?? (g.tipo === 'ice' ? g.danoAntesDaResistencia : 0)), 0);
  assert.ok(gelo > 0, 'o Tiro Gélido acerta com Gelo');
  // (o mesmo acerto num alvo com o limiar = 100 × o Gelo: sem a linha, 7,9%; com ela, ~12,2%)
  m.b.maxHp = m.b.hp = gelo * 100;
  m.b.estados = {};
  m.e.hunt.clock += 10_000;
  usar(m, 0.99);
  const esperado = AfeccoesPoe.forca(gelo * 2.95, gelo * 100, AfeccoesPoe.BASE.resfriamento);
  assert.ok(Math.abs((m.b.estados.lento?.pct ?? 0) - esperado) < 1, `o Resfriamento: ${m.b.estados.lento?.pct} contra ${esperado}`);
});

test('G18a: o Golpe no Chão — 49% mais no acerto do alvo perto (até 2 casas), nada no de longe', { skip: SEM }, async () => {
  const acerto = async (dist) => {
    const m = await montar('Two_Hand_Maces/Driftwood_Maul', [['Ground_Slam']]);
    m.b.x = m.e.hunt.pos.x + dist;
    // (o raio do PoE: 4,5 m = 2,25 casas — o sorteio em 0,01 dá a casa a mais, e a área chega a 3 casas)
    return usar(m, 0.01, 0).golpes.filter((g) => g.alvo === m.b.name).reduce((t, g) => t + g.danoAntesDaResistencia, 0);
  };
  const longe = await acerto(3);
  assert.ok(longe > 0, 'a área do Golpe no Chão pega a 3 casas');
  assert.ok(perto((await acerto(1)) / longe, 1.49), 'perto: ×1,49');
});

test('G18a: o Golpe Vulcânico — o golpe direto a 100%, os projéteis secundários a 40%; o quinto ataque do Zênite: 5 projéteis a mais a ×2,8', { skip: SEM }, async () => {
  const m = await montar('Two_Hand_Maces/Driftwood_Maul', [['Molten_Strike']]);
  Object.assign(m.resto[0], { x: m.e.hunt.pos.x + 2, y: m.e.hunt.pos.y, hp: 1e12, maxHp: 1e12, resist: {}, dots: [], estados: {} });
  const g = usar(m, 0.99).golpes.map((x) => x.danoAntesDaResistencia);
  assert.ok(g.length >= 2, `os golpes: ${g}`);
  assert.ok(g.slice(1).every((x) => perto(x / g[0], 0.4)), `os projéteis a 40% do direto: ${g}`);
  const z = await montar('Two_Hand_Maces/Driftwood_Maul', [['Molten_Strike_of_the_Zenith']]);
  // (alvos perto para os projéteis — os 5 a mais do quinto ataque procuram os mais perto de você)
  z.resto.slice(0, 9).forEach((x, i) => Object.assign(x, { x: z.e.hunt.pos.x + 2 + (i % 3), y: z.e.hunt.pos.y - 1 + Math.floor(i / 3), hp: 1e12, maxHp: 1e12, resist: {}, dots: [], estados: {} }));
  const usos = [];
  for (let i = 0; i < 5; i++) { z.e.hunt.clock += 10_000; usos.push(usar(z, 0.99).golpes.map((x) => x.danoAntesDaResistencia)); }
  const [d, ...p] = usos[4];
  assert.ok(p.length > usos[0].length - 1, `o quinto uso dispara mais: ${usos[0].length} → ${usos[4].length}`);
  assert.ok(p.every((x) => perto(x / d, 0.4 * 7)), `os projéteis do quinto uso a ×2,8 do direto: ${usos[4]}`);
});

test('G18a: o Fogo Justo — o "mais Dano Mágico" sem a queima em você seria de graça: fica não feito até a queima existir (a revisão do lote)', { skip: SEM }, () => {
  const r = G.doSlug('Righteous_Fire');
  assert.ok(r.motivosNoJogo.some((m) => /Concede [\d.]+ % mais Dano Mágico/.test(m)), r.motivosNoJogo.join(' | '));
  assert.equal(G.buffNoNivel('Righteous_Fire', 20).af['mais_dano_acerto@magia'], undefined);
});

test('G18a: o Incinerar — a onda final ×6 só no acerto; o Incêndio dela ×3,5 (250% mais com Incêndio) e sempre Incendeia', { skip: SEM }, async () => {
  const serie = async (v) => {
    const m = await montar('Wands/Driftwood_Wand', [['Incinerate']]);
    const max = G.estagiosDaGema('Incinerate', 20).max;
    const r = [];
    for (let i = 0; i < max; i++) {
      if (i) m.e.hunt.clock = Math.max(m.e.hunt.clock, m.e.hunt.canalizacao?.ate ?? m.e.hunt.clock);
      m.b.dots = [];
      const u = usar(m, v);
      r.push({ acerto: u.golpes.reduce((t, g) => t + g.danoAntesDaResistencia, 0), incendio: totalDo(u.dots, 'queimadura') });
    }
    return { r, max };
  };
  const { r, max } = await serie(0.01);
  const mais = G.estagiosDaGema('Incinerate', 20).mais / 100;
  assert.ok(perto(r[max - 1].acerto / r[0].acerto, ((1 + mais * max) * 6) / (1 + mais)), `o acerto da onda final: ${r[max - 1].acerto / r[0].acerto}`);
  assert.ok(perto(r[max - 1].incendio / r[0].incendio, ((1 + mais * max) * 3.5) / (1 + mais)), `o Incêndio da onda final: ${r[max - 1].incendio / r[0].incendio}`);
  // (sem crítico e sem chance: só a onda final Incendeia)
  const sem = (await serie(0.99)).r;
  assert.deepEqual(sem.map((x) => x.incendio > 0), [...Array(max - 1).fill(false), true]);
});

test('G18a: a Rajada de Chamas — o "Mágico por estágio" só no acerto, o "com Afecções por estágio" só no Incêndio (×17,5 e ×7 na liberação)', { skip: SEM }, async () => {
  const m = await montar('Wands/Driftwood_Wand', [['Flameblast'], ['Fireball']]);
  const ref = usar(m, 0.01, 1);
  const razaoRef = totalDo(ref.dots, 'queimadura') / ref.golpes.reduce((t, g) => t + g.danoAntesDaResistencia, 0);
  m.e.hunt.clock += 10_000;
  const max = G.estagiosDaGema('Flameblast', 20).max;
  let u;
  for (let i = 0; i < max; i++) {
    if (i) m.e.hunt.clock = Math.max(m.e.hunt.clock, m.e.hunt.canalizacao?.ate ?? m.e.hunt.clock);
    m.b.dots = [];
    u = usar(m, 0.01, 0);
  }
  const razao = totalDo(u.dots, 'queimadura') / u.golpes.reduce((t, g) => t + g.danoAntesDaResistencia, 0);
  const e = G.estagiosDaGema('Flameblast', 20);
  assert.ok(perto(razao / razaoRef, (1 + (e.maisAfeccao * max) / 100) / (1 + (e.mais * max) / 100), 0.03), `o Incêndio por acerto na liberação: ${razao / razaoRef}`);
});

test('G18a: o Chicote da Naja — 8% mais por Ricochete restante: o primeiro acerto 1,40× o golpe-base, o primeiro ricochete 1,32×', { skip: SEM }, async () => {
  const m = await montar('Daggers/Sai', [['Cobra_Lash']]);
  // (uma fila de alvos a 2 casas uns dos outros, para os ricochetes)
  m.resto.slice(0, 6).forEach((x, i) => Object.assign(x, { x: m.e.hunt.pos.x + 3 + 2 * i, y: m.e.hunt.pos.y, hp: 1e12, maxHp: 1e12, resist: {}, dots: [], estados: {} }));
  const g = usar(m, 0.99).golpes.map((x) => x.danoAntesDaResistencia);
  const saltos = G.alvosNoNivel('Cobra_Lash', 20)?.saltos ?? 5;
  assert.ok(g.length >= 2, `os acertos: ${g}`);
  assert.ok(perto(g[0] / g[1], (1 + (8 * saltos) / 100) / (1 + (8 * (saltos - 1)) / 100)), `${g[0]} / ${g[1]}`);
});

test('G18a: a explosão dos cadáveres incendeia — o Detonar Mortos da Limpeza com 70% menos Dano de Afecções', { skip: SEM }, async () => {
  const m = await montar('Wands/Driftwood_Wand', [['Detonate_Dead_of_Scavenging', 'Combustion_Support']]);
  m.e.hunt.cadaveres = [{ key: 'x', nome: 'Morto', look: 1, x: m.b.x, y: m.b.y, maxHp: 10_000 }];
  const u = usar(m, 0.01);
  const explosao = u.eventos.filter((x) => x.t === 'dmg' && x.uid === m.b.uid).reduce((t, x) => t + x.v, 0);
  assert.ok(explosao > 0, 'a explosão acerta');
  const def = G.cadaverDaGema('Detonate_Dead_of_Scavenging', 20);
  const bruto = (def.pct / 100) * 10_000 * Math.max(0, 1 + (Ficha.combate(m.e).danoDoElemento?.fire ?? 0) / 100);
  const esperado = bruto * AfeccoesPoe.BASE.incendio.porSegundo * (AfeccoesPoe.BASE.incendio.duracaoMs / 1000) * 0.3;
  assert.ok(perto(totalDo(u.dots, 'queimadura'), esperado, 0.05), `o Incêndio: ${totalDo(u.dots, 'queimadura')} contra ${esperado}`);
});

test('G18a: o Martelo Glacial — só o TERCEIRO golpe seguido congela "como se houvesse causado 390% mais Dano" (o Gelo a 2% do limiar)', { skip: SEM }, async () => {
  const m = await montar('Two_Hand_Maces/Driftwood_Maul', [['Glacial_Hammer']]);
  const gelo = usar(m, 0.01).golpes.reduce((t, g) => t + (g.detalhe?.porElemento?.ice ?? (g.tipo === 'ice' ? g.danoAntesDaResistencia : 0)), 0);
  assert.ok(gelo > 0, 'o Martelo Glacial acerta com Gelo');
  // (outra habilidade no meio zera a contagem: o próximo uso é o 1º)
  m.e.hunt.poeSeguidos = null;
  m.b.maxHp = m.b.hp = gelo * 50;
  const congelou = [];
  for (let i = 0; i < 3; i++) {
    m.e.hunt.clock += 10_000;
    m.b.estados = {};
    usar(m, 0.01);
    congelou.push(!!m.b.estados.congelado);
  }
  assert.deepEqual(congelou, [false, false, true], `${congelou}`);
});

test('G18a (revisão): a qualidade nos estágios — o máximo inteiro (a Rajada de Chamas q10: 10) e a onda final do Incinerar da Expansão q20 (850% e 480%)', { skip: SEM }, () => {
  assert.equal(G.estagiosDaGema('Flameblast', 20, 10).max, 10);
  assert.equal(G.estagiosDaGema('Flameblast', 20, 20).max, 11);
  const ex = G.estagiosDaGema('Incinerate_of_Expanse', 20, 20);
  assert.deepEqual([ex.final, ex.finalIncendio], [850, 480]);
  // (a coluna mal rotulada do Martelo Glacial Vaal: sem o "terceiro golpe" em dobro)
  assert.equal(G.linhasLocaisNoNivel('Vaal_Glacial_Hammer', 20).af['congelamento_como_mais@terceiroGolpe'], undefined);
});

test('G18a (revisão): o Golpe Vulcânico solta as 4 bolas ALÉM do golpe direto (o direto não ocupa um dos projéteis)', { skip: SEM }, async () => {
  const m = await montar('Two_Hand_Maces/Driftwood_Maul', [['Molten_Strike']]);
  m.resto.slice(0, 9).forEach((x, i) => Object.assign(x, { x: m.e.hunt.pos.x + 2 + (i % 3), y: m.e.hunt.pos.y - 1 + Math.floor(i / 3), hp: 1e12, maxHp: 1e12, resist: {}, dots: [], estados: {} }));
  const g = usar(m, 0.99).golpes;
  assert.equal(g.length, 1 + (G.alvosNoNivel('Molten_Strike', 20)?.base ?? 4), `os golpes: ${g.length}`);
});

test('G18a (revisão): o terceiro golpe zera com QUALQUER habilidade no meio (a aura também)', { skip: SEM }, async () => {
  const m = await montar('Two_Hand_Maces/Driftwood_Maul', [['Glacial_Hammer'], ['Clarity']]);
  const seq = [];
  for (const slot of [0, 0, 1, 0, 0, 0]) { m.e.hunt.clock += 10_000; usar(m, 0.99, slot); if (slot === 0) seq.push(!!m.e.hunt.poeTerceiroGolpe); }
  assert.deepEqual(seq, [false, false, false, false, true], `${seq}`);
});

test('G18a (revisão): o degenerativo "mágico" (Drenar Essência) leva o "mais Dano Mágico" da Destruição Controlada; o da Flecha Cáustica não', { skip: SEM }, async () => {
  const dot = async (ativa, suportes) => {
    const tipo = G.DEGEN_DO_ELEMENTO.chaos;
    return totalDo(usar(await montar(ativa === 'Caustic_Arrow' ? 'Bows/Crude_Bow' : 'Wands/Driftwood_Wand', [[ativa, ...suportes]]), 0.99).dots.filter((d) => d.chave === ativa), tipo);
  };
  const mais = SP.efeitoNoNivel('Controlled_Destruction_Support', 20, 0, { tags: ['poe:Magia'] }).efeito.maisDanoMagicoPct;
  assert.ok(mais > 0, 'a Destruição Controlada: o "mais Dano Mágico"');
  assert.ok(perto((await dot('Essence_Drain', ['Controlled_Destruction_Support'])) / (await dot('Essence_Drain', [])), 1 + mais / 100), 'o DoT da Drenar Essência leva o mais mágico');
});
