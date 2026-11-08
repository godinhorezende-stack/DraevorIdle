// (08/11 — o dono: "continue até os tooltips dos itens únicos derem 0 sem efeito") lotes B1–B5: as partes internas do item viram o efeito delas, os MODS SORTEADOS
// dos únicos saem do pool do poedb (`linhas-sorteadas.json`: 'faixa' e 'composicao' novos) e as linhas desses pools têm regra.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
}
const tr = (modelo, valores = []) => T.traduzirMod({ modelo, valores });
function unico(slug) {
  for (const cl of Object.values(Catalogo.catalogo().classes)) {
    const u = (cl.unicos ?? []).find((x) => x.slug === slug);
    if (u) return { u, base: cl.bases.find((b) => b.nome === u.base) };
  }
  return null;
}
/** As peças geradas do único (N sorteios), com o estado de cada linha. */
function sorteios(slug, n = 25) {
  const { base } = unico(slug);
  let s = 11;
  const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: n }, () => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: base.id, raridade: 'unico', ilvl: 84, rng, unico: slug }), Catalogo.REGRAS, rng));
}
const linhasDe = (p) => [...(p.poe.implicitos ?? []), ...(p.poe.prefixos ?? []), ...(p.poe.sufixos ?? []), ...(p.poe.modificadores ?? [])];

test('B1: as partes internas viram o efeito (a Tabula: sem requisitos, sem o Escudo da base, seis ligados e brancos)', { skip: SEM }, () => {
  assert.deepEqual(tr('local unique tabula rasa no requirement or energy shield [{0}]', [1]).efeitos.map((e) => e.stat), ['sem_requisitos', 'sem_es_da_base']);
  assert.deepEqual(tr('local six linked white sockets [{0}]', [1]).efeitos.map((e) => e.stat), ['encaixes_ligados', 'encaixes_brancos']);
  assert.deepEqual(tr('base should have unholy might [{0}]', [1]).efeitos.map((e) => e.stat), ['sempre:poderProfano']);
  const [p] = sorteios('Tabula_Rasa', 1);
  assert.equal(p.soquetes.links.every(Boolean), true, 'seis ligados');
  assert.ok(p.soquetes.cores.every((c) => c === 'W'), 'brancos');
});

test('B2–B5: os mods sorteados saem do pool e nenhuma linha fica sem efeito (fora a Síntese dos Círculos, que é da fase dos sistemas)', { skip: SEM }, () => {
  for (const slug of ['Auls_Uprising', 'Screams_of_the_Desiccated', 'Tombfist', 'Cinderswallow_Urn', 'Circle_of_Guilt', 'Circle_of_Fear', 'Circle_of_Nostalgia', 'Precursors_Emblem']) {
    for (const p of sorteios(slug)) {
      const ls = linhasDe(p);
      // (a marcação dos implícitos de Síntese dos Círculos é da fase dos sistemas — a Síntese)
      assert.ok(!ls.some((m) => /^\[/.test(m.texto) && !/synthesis/i.test(m.texto)), `${slug}: a marcação "[...]" saiu`);
      ls.forEach((m, k) => {
        if (/Sintetizador/.test(m.texto)) return;
        assert.ok(!['inerte', 'registrado'].includes(p.poe.estados[k]), `${slug}: ${m.texto} → ${p.poe.estados[k]}`);
      });
    }
  }
});

test('a quantidade pela faixa ("1-2 Random Shrine Buff") e a composição do Precursor ("Two Endurance … and one Power")', { skip: SEM }, () => {
  const gritos = sorteios('Screams_of_the_Desiccated', 40).map((p) => linhasDe(p).filter((m) => m.sorteada).length);
  assert.ok(gritos.every((n) => n >= 1 && n <= 2) && gritos.includes(1) && gritos.includes(2), JSON.stringify(gritos));
  const { u } = unico('Precursors_Emblem');
  assert.deepEqual(u.linhasSorteadas.composicao['[Two Endurance Charge mods and one Power Charge Mod]'], [['tolerancia', 2], ['poder', 1]]);
});

test('as frases novas: a escala "por Carga de X" e as condições', () => {
  assert.deepEqual(tr('+{0}% de Chance de Bloquear o Dano de Ataques por Carga de Frenesi', [1]).efeitos.map((e) => e.stat), ['block%carga:frenesi']);
  assert.deepEqual(tr('Você possui Reflexos de Ferro enquanto no máximo de Cargas de Frenesi').efeitos.map((e) => e.stat), ['keystone:reflexosDeFerro@cargasMax:frenesi']);
  assert.deepEqual(tr('Recebe Agressividade por {0} segundos ao Acertar enquanto no Máximo de Cargas de Frenesi', [4]).efeitos.map((e) => e.stat), ['ev:acertar:buff:agressividade@cargasMax:frenesi']);
  assert.deepEqual(tr('Você tem o bônus do Altar Diamante, se não estiver sob o efeito de frascos').efeitos.map((e) => e.stat), ['sempre:altarDiamante@semFrasco']);
});

test('B6, a Autoridade do Triunvirato: os efeitos do anel só nas gemas VAAL encaixadas nele (gema_local → o af: do uso)', { skip: SEM }, async () => {
  const GS = await import('../systems/skills/gemas.mjs');
  const anel = { poe: { af: { 'gema_local:acertos_ignoram_res@vaal': 1, 'gema_local:efeitoAuraPct@vaal': 50, 'gema_local:vaal_almas_menos@vaal': 30 } } };
  const def = (nome) => [...GS.DEFS.values()].find((d) => d.tipo === 'ativa' && (d.poe?.slug === nome || d.nome === nome));
  assert.deepEqual(GS.extrasDaGemaPoe(null, anel, def('Cutilada Vaal')).af, { acertos_ignoram_res: 1, efeitoAuraPct: 50, vaal_almas_menos: 30 });
  assert.equal(GS.extrasDaGemaPoe(null, anel, def('Cyclone')).af, undefined, 'a gema não-Vaal não leva');
  for (const [m, stat] of [['Acertos de Habilidades Vaal Encaixadas ignoram as Resistências dos Monstros Inimigos', 'gema_local:acertos_ignoram_res@vaal'], ['Habilidades Vaal Encaixadas requerem {0}% menos Almas por Uso', 'gema_local:vaal_almas_menos@vaal'], ['Habilidades Vaal Encaixadas causam {0}% mais Dano', 'mais_dano_local@vaal']]) {
    assert.deepEqual(tr(m, [30]).efeitos.map((e) => e.stat), [stat], m);
  }
});

test('B7, as Arbalistas da Marcha de Vorana: os efeitos lacaio_tipo:arbalista só na Arbalista (as chances novas e os projéteis a mais)', { skip: SEM }, async () => {
  const LacaiosPoe = await import('../systems/itens-poe/lacaios-poe.mjs');
  const af = { 'lacaio_tipo:arbalista:minion_chance_intimidar': 25, 'lacaio_tipo:arbalista:minion_extra_projectiles': 3, 'lacaio_tipo:arbalista:minion_perfurar': 2, 'lacaio_tipo:arbalista:minion_chance_congelar': 10 };
  const arb = LacaiosPoe.oQueInvoca('Summon_Arbalists', 20, null, af);
  assert.ok(arb, 'a Convocar Arbalistas invoca');
  assert.equal(arb.poe.chances.intimidar, 25);
  assert.equal(arb.poe.chances.congelar, 10);
  assert.deepEqual(arb.poe.projeteisExtra, { alvosExtras: 3, perfurar: 2, bifurcar: 0, encadear: 0, divisao: 0 });
  const zumbi = LacaiosPoe.oQueInvoca('Raise_Zombie', 20, null, af);
  assert.equal(zumbi.poe.chances.intimidar, 0, 'o Zumbi não é Arbalista');
  assert.equal(zumbi.poe.projeteisExtra, undefined);
});

test('B8, os velados da Traição: saem já revelados, do pool do poedb, com a magnitude da peça, e nenhuma linha fica sem efeito', { skip: SEM }, () => {
  for (const slug of ['Hyperboreus', 'Vivinsect', 'The_Queens_Hunger', 'The_Devouring_Diadem', 'Bitterbind_Point', 'The_Crimson_Storm', 'Cane_of_Kulemak', 'Paradoxica', 'Replica_Paradoxica']) {
    for (const p of sorteios(slug, 15)) {
      const ls = linhasDe(p);
      assert.ok(!ls.some((m) => /veiled|^\[/i.test(m.texto)), `${slug}: a marcação do velado saiu`);
      assert.ok(ls.some((m) => m.sorteada), `${slug}: o mod revelado entrou`);
      ls.forEach((m, k) => assert.ok(!['inerte', 'registrado'].includes(p.poe.estados[k]), `${slug}: ${m.texto} → ${p.poe.estados[k]}`));
    }
  }
  // (o Bastão de Kulemak: "Magnitude de Modificadores Revelados aumentada em X%" — o revelado sai com a magnitude; o valor sem ela fica guardado)
  for (const p of sorteios('Cane_of_Kulemak', 10)) {
    const pct = Number(linhasDe(p).find((m) => /^Magnitude de Modificadores Revelados/.test(m.modelo ?? ''))?.valores?.[0]) || 0;
    for (const m of linhasDe(p).filter((x) => x.sorteada && x.valoresSemMagnitude)) {
      m.valores.forEach((v, i) => assert.ok(Math.abs(Math.abs(v) - Math.abs(m.valoresSemMagnitude[i]) * (1 + pct / 100)) <= 1, `${m.texto}: ${m.valoresSemMagnitude[i]} × ${pct}%`));
    }
  }
});

test('B8: as frases da Concentração, da Anulação das Almas e dos Espectros', () => {
  const st = (m, v = [10, 10]) => tr(m, v).efeitos.map((e) => e.stat);
  assert.deepEqual(st('Sua Chance de Acerto Crítico é Sortuda enquanto Concentrado'), ['critico_sortudo@buff:concentrado']);
  assert.deepEqual(st('Recupera {0}% de Mana e Escudo de Energia ao se Concentrar'), ['ev:concentrar:manaPct', 'ev:concentrar:esPct']);
  assert.deepEqual(st('Ativa Magias Encaixadas quando você Focar, com Recarga de {0} segundo'), ['gatilho_local:concentrar:magia']);
  assert.deepEqual(st('+{0} de Armadura durante a Anulação do Ganho de Almas'), ['armor_flat@almasImpedidas']);
  assert.deepEqual(st('Espectros levantados têm +{0}% para a chance de golpe crítico'), ['lacaio_tipo:espectro:minion_crit_flat']);
  assert.deepEqual(st('Ataques com essa Arma Penetram {0}% da Resistência a Caos'), ['chaos_pen@ataque']);
  assert.deepEqual(st('Magnitude de Modificadores Revelados aumentada em {0}%'), ['magnitude_revelados']);
});

test('B8: a Evasão regenerada como Vida entra na regeneração; o crítico fixo do Espectro soma na base', { skip: SEM }, async () => {
  const Ficha = await import('../systems/ficha.mjs');
  const r0 = Ficha.regenDoPoe({ maxHp: 1000 }, {}, 2000);
  const r1 = Ficha.regenDoPoe({ maxHp: 1000 }, { evasao_regen_vida_pct: 1 }, 2000);
  assert.equal(r1.vidaPorSegundo - r0.vidaPorSegundo, 20, '1% de 2000 de Evasão');
  const LacaiosPoe = await import('../systems/itens-poe/lacaios-poe.mjs');
  const af = { 'lacaio_tipo:espectro:minion_crit_flat': 3 };
  const esp = LacaiosPoe.oQueInvoca('Raise_Spectre', 20, null, af);
  const zumbi = LacaiosPoe.oQueInvoca('Raise_Zombie', 20, null, af);
  if (esp) assert.equal(esp.poe.critFlat, 3);
  assert.equal(zumbi.poe.critFlat, 0, 'o Zumbi não é Espectro');
});

test('B9, as regras de criação: as Mãos do Alto Templário aceitam o Orbe Vaal corrompidas e somam os implícitos corrompidos até 5', { skip: SEM }, async () => {
  const M = await import('../systems/itens-poe/moedas.mjs');
  const { personagemDeTeste } = await import('./apoio.mjs');
  const [maos] = sorteios('Hands_of_the_High_Templar', 1);
  assert.equal(maos.poe.af.modificavel_corrompido, 1);
  assert.equal(maos.poe.af.implicitos_max > 0, true);
  const vaal = M.idDa('Vaal_Orb');
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 80 }), { inventory: [maos, { id: vaal, count: 20 }] });
  // (o Orbe Vaal com o sorteio do implícito: o primeiro número cai no último quarto)
  let s = 7;
  const rng = () => (s++ === 7 ? 0.9 : ((s * 7919) % 1000) / 1000);
  for (let i = 0; i < maos.poe.af.implicitos_max; i++) { s = 7; assert.ok(M.usar(e, { moeda: vaal, alvo: { onde: 'inventory', indice: 0 } }, rng).ok, `o ${i + 1}º Orbe Vaal vale na peça corrompida`); }
  const implicitos = e.inventory[0].poe.implicitos;
  assert.equal(implicitos.length, maos.poe.af.implicitos_max, 'até o máximo, e não mais');
  assert.ok(implicitos.every((m) => m.corrompido));
  // (cheia, o próximo implícito troca todos — o Orbe Vaal de sempre)
  s = 7;
  assert.ok(M.usar(e, { moeda: vaal, alvo: { onde: 'inventory', indice: 0 } }, rng).ok);
  assert.equal(e.inventory[0].poe.implicitos.length, 1);
  // (uma peça comum corrompida segue sem aceitar)
  const [outra] = sorteios('Tabula_Rasa', 1);
  outra.poe.corrompido = true;
  e.inventory.unshift(outra);
  assert.equal(M.usar(e, { moeda: vaal, alvo: { onde: 'inventory', indice: 0 } }, () => 0.9).ok, false);
});

test('as peças ANTIGAS: a marcação "[...]" que ficou na peça vira as linhas sorteadas ao entrar; o resto da peça fica', { skip: SEM }, () => {
  const { u } = unico('Screams_of_the_Desiccated');
  const [p] = sorteios('Screams_of_the_Desiccated', 1);
  const marca = u.modificadores.find((m) => u.linhasSorteadas.substitui[m.modelo]);
  const fixas = p.poe.modificadores.filter((m) => !m.sorteada);
  // (a peça como era antes: a marcação no lugar das sorteadas, numa versão de tradução já atual)
  p.poe.modificadores = [...fixas, { tipo: marca.tipo, modelo: marca.modelo, texto: marca.modelo, valores: [1, 2] }];
  p.poe.tv = J.VERSAO_DA_TRADUCAO;
  J.recalcular(p);
  assert.ok(p.poe.estados.some((e) => ['inerte', 'registrado'].includes(e)), 'antes: a marcação sem efeito');
  const e = { inventory: [p] };
  assert.equal(J.refazerPecasAntigas(e), 1);
  const ms = p.poe.modificadores;
  assert.ok(!ms.some((m) => m.modelo === marca.modelo), 'a marcação saiu');
  const n = ms.filter((m) => m.sorteada).length;
  assert.ok(n >= 1 && n <= 2, `${n} altar(es)`);
  assert.deepEqual(ms.filter((m) => !m.sorteada).map((m) => m.texto), fixas.map((m) => m.texto), 'as fixas, como estavam');
  assert.ok(!p.poe.estados.some((x) => ['inerte', 'registrado'].includes(x)));
  assert.equal(J.refazerPecasAntigas(e), 0, 'na segunda entrada, nada');
});

test('B10, os visuais e sons: as linhas saem com efeito, viajam no retrato da caçada e a carga leva a arte', { skip: SEM }, async () => {
  for (const [m, stat] of [['Pegadas de Mercúrio', 'visual:pegadas:mercurio'], ['Sanguinolência Extra', 'visual:sangue'], ['sound on rare kill ice whisper [{0}]', 'visual:som_gelo'], ['Inimigos mostram sua Categoria de Monstros', 'visual:categoria'], ['frenzy charge blood dance art variation [{0}]', 'visual:frenesi_sangue']]) {
    const r = tr(m, [1]);
    assert.equal(r.estado, 'equivalente', m);
    assert.deepEqual(r.efeitos.map((e) => e.stat), [stat]);
  }
  const Cacadas = await import('../systems/cacadas.mjs');
  assert.deepEqual(Cacadas.visuaisDoJogador({ 'visual:sangue': 1, 'visual:pegadas:mercurio': 1, life_inc: 10 }), { visuais: ['sangue', 'pegadas:mercurio'] });
  assert.deepEqual(Cacadas.visuaisDoJogador({ life_inc: 10 }), {});
  assert.equal(Cacadas.categoriaDoMonstro({ class: 'Undead' }), 'Morto-vivo');
  assert.equal(Cacadas.categoriaDoMonstro({ class: 'Mammal' }), 'Besta');
  assert.equal(Cacadas.categoriaDoMonstro({ class: 'Sem classe' }), null);
  const CargasPoe = await import('../systems/itens-poe/cargas.mjs');
  const e = { hunt: { clock: 0, cargasPoe: { frenesi: { n: 2, ate: 5000 }, poder: { n: 1, ate: 5000 } } } };
  const cartoes = CargasPoe.buffs(e, { 'visual:frenesi_sangue': 1 });
  assert.equal(cartoes.find((b) => b.carga === 'frenesi').arte, 'sangue');
  assert.equal(cartoes.find((b) => b.carga === 'poder').arte, undefined);
  assert.equal(CargasPoe.buffs(e).find((b) => b.carga === 'frenesi').arte, undefined);
});

test('B11, o Vínculo D\'alma: a morte porque o alvo Vinculado morreu não tira experiência; a morte comum tira', { skip: SEM }, async () => {
  assert.deepEqual(tr('Não Perde Experiência quando você morrer porque um alvo Vinculado morreu').efeitos.map((e) => e.stat), ['sem_perda_exp_vinculo']);
  const Morte = await import('../systems/morte.mjs');
  const R = await import('../systems/regras.mjs');
  const { personagemDeTeste } = await import('./apoio.mjs');
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 60 }), { hp: 0 });
  e.xp = R.expForLevel(60) + Math.round((R.expForLevel(61) - R.expForLevel(60)) * 0.8);
  e.hunt = { clock: 0 };
  assert.ok(Morte.conta(e).expPerdida > 0, 'a morte comum');
  e.hunt.morreuPeloVinculo = true;
  assert.equal(Morte.conta(e).expPerdida, 0, 'pelo vínculo');
  e.hp = 100;
  assert.ok(Morte.conta(e).expPerdida > 0, 'vivo, a conta mostra a de sempre');
});

test('B12, os Catalisadores: a qualidade da joia aumenta só os mods do tipo; outro tipo zera; a Tentação de Ixchel vai até 200%', { skip: SEM }, async () => {
  const M = await import('../systems/itens-poe/moedas.mjs');
  const C = await import('../systems/itens-poe/catalisadores.mjs');
  const { personagemDeTeste } = await import('./apoio.mjs');
  assert.ok(C.linhaDoTipo('+{0} de Vida máxima', 'vidaMana'));
  assert.ok(C.linhaDoTipo('+{0}% de Resistência a Fogo', 'resistencia'));
  assert.ok(!C.linhaDoTipo('+{0}% de Resistência a Fogo', 'elemental'), 'a resistência não é dano elemental');
  assert.ok(C.linhaDoTipo('Adiciona {0} a {1} de Dano de Fogo aos Ataques', 'elemental'));
  // um anel mágico com Vida e Resistência
  const g = gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Rings/Iron_Ring', raridade: 'normal', ilvl: 84, rng: () => 0.5 });
  g.raridade = 'magico';
  g.prefixos = [{ texto: '+50 de Vida máxima', modelo: '+{0} de Vida máxima', valores: [50] }];
  g.sufixos = [{ texto: '+30% de Resistência a Fogo', modelo: '+{0}% de Resistência a Fogo', valores: [30] }];
  const anel = J.pecaDoJogo(g);
  const vida0 = anel.poe.af.life_flat ?? anel.poe.af.life ?? null;
  const fertil = M.idDa('Fertile_Catalyst');
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 80 }), { inventory: [anel, { id: fertil, count: 30 }, { id: M.idDa('Prismatic_Catalyst'), count: 1 }] });
  for (let i = 0; i < 10; i++) assert.ok(M.usar(e, { moeda: fertil, alvo: { onde: 'inventory', indice: 0 } }).ok);
  const p = e.inventory[0].poe;
  assert.equal(p.qualidade, 20, '+2 por uso na mágica, até 20');
  assert.equal(p.qualidadeTipo, 'vidaMana');
  assert.equal(M.usar(e, { moeda: fertil, alvo: { onde: 'inventory', indice: 0 } }).ok, false, 'no teto');
  assert.equal(p.catalisados.prefixos[0], '+60 de Vida máxima', 'a Vida × 1,2');
  assert.equal(p.catalisados.sufixos[0], null, 'a Resistência fica');
  const chaveVida = Object.keys(p.af).find((k) => p.af[k] === 60);
  assert.ok(chaveVida, `o af com 60 de vida (antes ${vida0})`);
  assert.equal(p.af.fire_res, 30);
  // outro tipo: zera e troca
  assert.ok(M.usar(e, { moeda: M.idDa('Prismatic_Catalyst'), alvo: { onde: 'inventory', indice: 0 } }).ok);
  const p2 = e.inventory[0].poe;
  assert.equal(p2.qualidade, 2);
  assert.equal(p2.qualidadeTipo, 'resistencia');
  assert.equal(p2.af.fire_res, 31, 'agora a Resistência × 1,02');
  // a Tentação de Ixchel: "Qualidade Máxima é 200%"
  assert.deepEqual(tr('Qualidade Máxima é {0}%', [200]).efeitos.map((x) => [x.stat, x.valor]), [['qualidade_max', 200]]);
});

test('B13, a Identificação: o drop Mágico/Raro/Único vem sem identificar; o Pergaminho identifica; a moeda pede a peça identificada; o Manto identifica as Mágicas', { skip: SEM }, async () => {
  const M = await import('../systems/itens-poe/moedas.mjs');
  const Combate = await import('../systems/hunt/combate.mjs');
  const { personagemDeTeste } = await import('./apoio.mjs');
  let s = 5;
  const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const pecas = Array.from({ length: 30 }, () => J.dropsDoMonstro(70, 'unico', rng)).flat();
  assert.ok(pecas.length > 5);
  for (const p of pecas) assert.equal(p.poe.identificado === false, ['magico', 'raro', 'unico'].includes(p.poe.raridade) && p.poe.classe !== 'Maps', `${p.poe.raridade} ${p.poe.classe}`);
  const rara = pecas.find((p) => p.poe.raridade === 'raro');
  assert.ok(rara, 'uma rara no drop');
  assert.ok(Object.keys(rara.poe.af).length, 'os mods valem mesmo sem identificar');
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 80 }), { inventory: [rara, { id: M.idDa('Chaos_Orb'), count: 1 }, { id: M.idDa('Scroll_of_Wisdom'), count: 2 }] });
  assert.match(M.usar(e, { moeda: M.idDa('Chaos_Orb'), alvo: { onde: 'inventory', indice: 0 } }).erro, /Identifique/);
  assert.ok(M.usar(e, { moeda: M.idDa('Scroll_of_Wisdom'), alvo: { onde: 'inventory', indice: 0 } }).ok);
  assert.equal(e.inventory[0].poe.identificado, undefined);
  assert.equal(M.usar(e, { moeda: M.idDa('Scroll_of_Wisdom'), alvo: { onde: 'inventory', indice: 0 } }).ok, false, 'já identificada');
  assert.ok(M.usar(e, { moeda: M.idDa('Chaos_Orb'), alvo: { onde: 'inventory', indice: 0 } }).ok, 'agora o Caos vale');
  // o Manto de Tawm'r Isley
  assert.deepEqual(tr('Itens Mágicos encontrados são Identificados').efeitos.map((x) => x.stat), ['identifica_magicos']);
  const magica = pecas.find((p) => p.poe.raridade === 'magico');
  if (magica) {
    const comManto = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 80 }), { sistema: 'poe' });
    comManto.equipment = { ...comManto.equipment, ring: { id: 1, poe: { af: { identifica_magicos: 1 } } } };
    const copia = structuredClone(magica);
    Combate.identificarAoAchar(comManto, copia);
    assert.equal(copia.poe.identificado, undefined, 'a Mágica do Manto vem identificada');
    const semManto = structuredClone(magica);
    Combate.identificarAoAchar(personagemDeTeste({ vocacao: 'knight', level: 80 }), semManto);
    assert.equal(semManto.poe.identificado, false);
  }
});

test('B14, o Ungir e o Encantamento: 3 Óleos ungem o amuleto (o notável vale vestido), as outras moedas não tiram, "N extras" cabe mais; o Encantamento põe um do Labirinto', { skip: SEM }, async () => {
  const M = await import('../systems/itens-poe/moedas.mjs');
  const U = await import('../systems/itens-poe/ungir.mjs');
  const A = await import('../systems/passivas/arvore.mjs');
  const { personagemDeTeste } = await import('./apoio.mjs');
  assert.deepEqual(tr('Aloca Vingança Indiscriminada').efeitos.map((x) => x.stat), ['ungido:vinganca-indiscriminada']);
  assert.deepEqual(tr('Aloca Passive Skill se você possuir o modificador correspondente na Chama Proibida').efeitos.map((x) => x.stat), ['proibida_carne:passive-skill'], 'a Chama Proibida fica com a regra dela');
  assert.deepEqual(tr('Pode ter {0} Modificadores Encantados extras', [3]).efeitos.map((x) => [x.stat, x.valor]), [['encantamentos_extras', 3]]);
  assert.deepEqual(tr('Pode ser ungido').efeitos.map((x) => x.stat), ['pode_ser_ungido']);
  assert.equal(U.receitas().length, 441, 'as receitas dos 13 Óleos do poedb');
  const [claro, sepia, alquimia] = ['Clear_Oil', 'Sepia_Oil', 'Orb_of_Alchemy'].map((s) => M.idDa(s));
  const amuleto = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Amulets/Paua_Amulet', raridade: 'normal', ilvl: 84, rng: () => 0.5 }));
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 80 }), { inventory: [amuleto, { id: claro, count: 6 }, { id: sepia, count: 3 }, { id: alquimia, count: 1 }] });
  const alvo = { onde: 'inventory', indice: 0 };
  assert.equal(M.usar(e, { moeda: claro, alvo }).ok, false, 'sem os 3 Óleos escolhidos');
  const r = M.usar(e, { moeda: claro, alvo, oleos: [claro, claro, claro] });
  assert.ok(r.ok, r.erro);
  assert.equal(M.quantasTem(e, claro), 3, 'os 3 Óleos saem juntos');
  const vinganca = U.receita(['Clear_Oil', 'Clear_Oil', 'Clear_Oil']);
  let p = e.inventory[0].poe;
  assert.deepEqual(U.encantamentos(p).map((m) => [m.texto, m.ungido]), [[`Aloca ${vinganca.nome}`, vinganca.id]]);
  assert.equal(p.estados[p.implicitos.length - 1], 'equivalente');
  // a Alquimia refaz a peça e o encantamento fica
  assert.ok(M.usar(e, { moeda: alquimia, alvo }).ok);
  assert.equal(U.encantamentos(e.inventory[0].poe).length, 1, 'o encantamento fica');
  // cheia (1): a unção nova troca a antiga
  assert.ok(M.usar(e, { moeda: sepia, alvo, oleos: [claro, claro, sepia] }).ok);
  p = e.inventory[0].poe;
  assert.deepEqual(U.encantamentos(p).map((m) => m.ungido), [U.receita(['Clear_Oil', 'Clear_Oil', 'Sepia_Oil']).id]);
  // vestido, o notável vale como alocado
  const doNo = (x) => JSON.stringify({ ...x, habilidades: [...x.habilidades], fontes: null });
  const semNada = doNo(A.efeitos(e));
  e.equipment = { ...(e.equipment ?? {}), neck: e.inventory.shift() };
  const id = U.receita(['Clear_Oil', 'Clear_Oil', 'Sepia_Oil']).id;
  assert.deepEqual(A.alocadosPeloUngir(e), [id]);
  assert.notEqual(doNo(A.efeitos(e)), semNada, 'os efeitos do notável entram');
  // o Suspiro Estrangulador: "Pode ter 3 Modificadores Encantados extras" — 4 unções
  const [suspiro] = sorteios('Stranglegasp', 1);
  assert.equal(U.maximoDeEncantamentos(suspiro.poe), 4);
  const oleos = ['Clear_Oil', 'Sepia_Oil', 'Amber_Oil', 'Verdant_Oil', 'Teal_Oil'];
  for (let i = 0; i < 5; i++) assert.ok(U.ungir(suspiro.poe, [oleos[i], oleos[i], oleos[i]]).ok);
  assert.equal(U.encantamentos(suspiro.poe).length, 4, 'a quinta troca a mais antiga');
  assert.ok(!U.encantamentos(suspiro.poe).some((m) => m.ungido === U.receita(['Clear_Oil', 'Clear_Oil', 'Clear_Oil']).id));
  // só amuleto e as peças ungíveis
  const elmo = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Helmets/Iron_Hat', raridade: 'normal', ilvl: 84, rng: () => 0.5 }));
  assert.equal(U.ungir(elmo.poe, ['Clear_Oil', 'Clear_Oil', 'Clear_Oil']).ok, false);
  assert.ok(U.ungivel(sorteios('Cowl_of_the_Thermophile', 1)[0].poe), 'o Capote');
  // o Encantamento: um do Labirinto, com efeito no jogo; cheia, troca
  const enc = M.idDa('Enchant');
  const e2 = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 80 }), { inventory: [elmo, { id: enc, count: 2 }] });
  for (let i = 0; i < 2; i++) assert.ok(M.usar(e2, { moeda: enc, alvo }).ok);
  const pe = e2.inventory[0].poe;
  assert.equal(U.encantamentos(pe).length, 1);
  assert.ok(!['inerte', 'registrado'].includes(pe.estados[pe.implicitos.length - 1]), pe.implicitos.at(-1).texto);
  // os Óleos caem só do pináculo: de 2 a 4
  let s = 7;
  const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 20; i++) {
    const caiu = U.oleosDoPinaculo(rng);
    assert.ok(caiu.length >= 2 && caiu.length <= 4 && caiu.every(U.ehOleo), JSON.stringify(caiu));
  }
  assert.ok(!Object.keys(Catalogo.REGRAS.moedas.drop.pesos).some(U.ehOleo), 'fora do drop comum');
});

test('B17, o Rito da Lua (o Talismã do Grande Lobo): cada chefe de ato vencido na dificuldade é um Rito (o dono: "Chefes de ato mortos"), até 10', { skip: SEM }, async () => {
  const C = await import('../systems/itens-poe/condicoes-poe.mjs');
  assert.deepEqual(tr('Dano aumentado em {0}% por Rito da Lua concluído', [44]).efeitos.map((x) => [x.stat, x.valor]), [['dmg_inc%ritosDaLua', 44]]);
  const e = { campanha: { facil: { bosses: [1, 2, 3] }, medio: { bosses: [1] } } };
  assert.equal(C.fatorDaEscala(e, {}, {}, 'ritosDaLua'), 3, 'fora da caçada, a maior');
  assert.equal(C.fatorDaEscala({ ...e, hunt: { campanha: { dificuldade: 'medio' } } }, {}, {}, 'ritosDaLua'), 1, 'na caçada, a da dificuldade');
  assert.equal(C.fatorDaEscala({ campanha: { facil: { bosses: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] } } }, {}, {}, 'ritosDaLua'), 10);
  assert.ok(C.escalaValida('ritosDaLua'));
});

test('B18, a Síntese: os Círculos saem com 1 a 3 implícitos de Síntese; o Sintetizador junta 3 peças numa sintetizada e o Círculo põe o Modificador de Arauto', { skip: SEM }, async () => {
  const S = await import('../systems/itens-poe/sintese.mjs');
  const { personagemDeTeste } = await import('./apoio.mjs');
  const [circulo] = sorteios('Circle_of_Fear', 1);
  const sint = circulo.poe.implicitos.filter((m) => m.origem === 'synthesis');
  assert.ok(sint.length >= 1 && sint.length <= 3, 'os implícitos de Síntese');
  assert.ok(!circulo.poe.implicitos.some((m) => /^\[/.test(m.texto)), 'sem a marcação');
  assert.ok(circulo.poe.estados.every((x) => !['inerte', 'registrado'].includes(x)), JSON.stringify(circulo.poe.estados));
  assert.equal(circulo.poe.af.sintese_arauto_extra, 1);
  const arauto = linhasDe(circulo).find((m) => m.sorteada && /Arauto/.test(m.texto));
  assert.ok(arauto, 'o Modificador de Arauto sorteado no Círculo');
  const raro = (base) => {
    const g = gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'raro', ilvl: 80, rng: () => 0.3 });
    return J.pecaDoJogo(g);
  };
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 80 }), { inventory: [raro('Rings/Iron_Ring'), circulo, raro('Rings/Iron_Ring'), { id: 3031, count: 5 }] });
  assert.equal(S.sintetizar(e, [0, 1]).ok, false, 'três peças');
  const corrompido = raro('Rings/Iron_Ring');
  corrompido.poe.corrompido = true;
  e.inventory.push(corrompido);
  assert.match(S.sintetizar(e, [0, 1, 4]).erro, /corrompida/);
  e.inventory.pop();
  let s = 5;
  const r = S.sintetizar(e, [0, 1, 2], () => ((s = (s * 16807) % 2147483647) / 2147483647));
  assert.ok(r.ok, r.erro);
  assert.equal(e.inventory.length, 2, 'as três saem, a nova entra');
  const p = e.inventory.at(-1).poe;
  assert.equal(p.sintetizado, true);
  assert.equal(p.raridade, 'normal');
  assert.ok(p.implicitos.some((m) => m.arauto && m.texto === arauto.texto), 'o Arauto do Círculo como implícito');
  assert.ok(p.implicitos.filter((m) => m.origem === 'synthesis').length >= 1);
  assert.ok(p.estados.every((x) => !['inerte', 'registrado'].includes(x)), JSON.stringify(p.implicitos.map((m) => m.texto)));
  assert.equal(tr('Quando usado no Sintetizador, o novo item terá um Modificador de Arauto adicional').estado, 'equivalente');
});

test('B19, a Omnichama: os Ducados valem em peça Rara (e no Cutelo, "como se fosse raro"), dão 10% de Intangibilidade, a Intangibilidade falha a criação; Tzamoto e Metamorfo', { skip: SEM }, async () => {
  const M = await import('../systems/itens-poe/moedas.mjs');
  const D = await import('../systems/itens-poe/ducados.mjs');
  const { personagemDeTeste } = await import('./apoio.mjs');
  const raro = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'raro', ilvl: 80, rng: () => 0.3 }));
  const [cutelo] = sorteios('Dread_Captains_Cutlass', 1);
  assert.equal(cutelo.poe.af.omnichama_como_raro, 1);
  assert.equal(cutelo.poe.af.sem_intangibilidade, 1);
  const [cyax, tzam, meta, cav] = ['Cyaxans_Ducat', 'Tzamotos_Ducat', 'The_Changelings_Ducat', 'The_Genteels_Ducat'].map((s) => M.idDa(s));
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 80 }), { inventory: [raro('Rings/Iron_Ring'), cutelo, { id: cyax, count: 5 }, { id: tzam, count: 2 }, { id: meta, count: 1 }, { id: cav, count: 1 }] });
  const anel = { onde: 'inventory', indice: 0 };
  assert.ok(M.usar(e, { moeda: cyax, alvo: anel }, () => 0.5).ok);
  assert.equal(e.inventory[0].poe.intangibilidade, 10, '10% por criação');
  // com 10%: rng 0.05 → cópia fantasmagórica (a peça não muda, o Ducado é gasto)
  const antes = JSON.stringify(e.inventory[0].poe.prefixos);
  const r = M.usar(e, { moeda: cyax, alvo: anel }, () => 0.05);
  assert.match(r.notice, /cópia fantasmagórica/);
  assert.equal(JSON.stringify(e.inventory[0].poe.prefixos), antes);
  assert.equal(M.quantasTem(e, cyax), 3);
  // o Cutelo: vale como Raro e não ganha Intangibilidade
  assert.ok(M.usar(e, { moeda: cyax, alvo: { onde: 'inventory', indice: 1 } }, () => 0.5).ok);
  assert.ok(!(e.inventory[1].poe.intangibilidade > 0));
  // numa peça Mágica, não
  const magica = raro('Rings/Iron_Ring');
  magica.poe.raridade = 'magico';
  e.inventory.push(magica);
  assert.match(M.usar(e, { moeda: cyax, alvo: { onde: 'inventory', indice: e.inventory.length - 1 } }, () => 0.5).erro, /Rara/);
  // Tzamoto: zera (rng < 0.5)
  assert.ok(M.usar(e, { moeda: tzam, alvo: anel }, () => 0.2).ok);
  assert.equal(e.inventory[0].poe.intangibilidade, 0);
  // o Metamorfo vira outro Ducado
  assert.match(M.usar(e, { moeda: meta }, () => 0.1).notice, /virou/);
  assert.equal(M.quantasTem(e, meta), 0);
  assert.ok(D.DUCADOS.some((s) => M.quantasTem(e, M.idDa(s)) > (s === 'Cyaxans_Ducat' ? 2 : s === 'Tzamotos_Ducat' ? 1 : 0)));
  for (const s of ['Merricks_Ducat', 'Cyaxans_Ducat', 'The_Genteels_Ducat', 'Rotmothers_Ducat', 'Kisharas_Ducat', 'Tzamotos_Ducat', 'The_Changelings_Ducat']) assert.notEqual(M.STATUS[s].status, 'nao', s);
});
