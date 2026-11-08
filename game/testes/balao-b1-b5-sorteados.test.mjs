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
