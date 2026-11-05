// A ENTRADA DOS PINÁCULOS como no PoE (dono, 05/11: "quero igual do poe" — etapa 1: Shaper, Elder e Sirus). Sem level: o pináculo abre no
// Dispositivo de Mapas com os 4 itens dele (gastos só depois de a arena nascer), com 6 portais; os itens saem garantidos dos 12 chefes
// intermediários (Guardiões do Criador e do Ancião, Conquistadores), que nascem nos mapas com encontro — e esses mapas caem dos chefes T14+.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';

const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no jogo oficial (PoE)';
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Dispositivo = await import('../systems/mapas-dispositivo.mjs');
const Acesso = await import('../systems/itens-poe/pinaculos-acesso.mjs');
const Pinaculos = await import('../systems/itens-poe/pinaculos.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const Bolsa = await import('../systems/bolsa.mjs');
const Combate = await import('../systems/hunt/combate.mjs');
const Beta = await import('../systems/modo-beta.mjs');
const { bossUnico } = await import('../systems/bosses-unicos/catalogo.mjs');
const { BESTIARY } = await import('../systems/hunt/monstros.mjs');
const { ITEM_CATALOG } = await import('../systems/dados.mjs');

const SHAPER = 'poe-the-shaper';
/** Um personagem com o Ato 10 vencido (o Dispositivo liberado) e vida que não acaba. */
function personagem() {
  const e = personagemDeTeste({ vocacao: 'knight', level: 90 });
  e.hp = e.maxHp = 1e9;
  for (const d of Object.keys(e.campanha)) e.campanha[d].bosses = Array.from({ length: 10 }, (_, i) => i + 1);
  Bolsa.garantir(e);
  return e;
}
const todos = (e) => [...e.hunt.monstros, ...Object.values(e.hunt.outrosAndares ?? {}).flat()];
/** Põe a peça de mapa na mochila e abre pelo dispositivo, como a tela faz. */
function abrirMapa(e, peca) {
  e.inventory.push(peca);
  const m = Dispositivo.mapasCarregados(e).find((x) => x.peca === peca);
  return Dispositivo.abrir(e, { onde: m.onde, indice: m.indice, assinatura: m.assinatura, mode: 'auto' });
}

test('os dados do poedb: 12 fragmentos/coroas e 4 convites (ícone no disco), 4 mapas dos Guardiões do Criador, 12 chefes registrados como bosses únicos', { skip: SEM }, () => {
  assert.equal(Acesso.DADOS.itens.length, 29, '12 fragmentos/coroas + 4 convites (etapa 2) + Fragmento Crescente, Citação e 4 convites da Maven (etapa 3) + Córtex, 3 Ecos e 3 Memórias (etapa 4)');
  assert.equal(Acesso.DADOS.mapas.length, 7, 'os 4 dos Guardiões do Criador + os 3 mapas finais das Memórias (etapa 4)');
  assert.deepEqual(Object.keys(Acesso.DADOS.entradas).sort(), ['poe-a-estrela-negra', 'poe-a-fome-infinita', 'poe-crisol-atlas', 'poe-crisol-deformados', 'poe-crisol-distorcidos', 'poe-crisol-matadores', 'poe-incarnation-of-dread', 'poe-incarnation-of-fear', 'poe-incarnation-of-neglect', 'poe-sirus', 'poe-the-eater-of-worlds', 'poe-the-elder', 'poe-the-maven', 'poe-the-searing-exarch', SHAPER, 'poe-venarius'].sort());
  for (const it of Acesso.DADOS.itens) {
    const meta = ITEM_CATALOG[it.itemId];
    assert.equal(meta?.type, 'fragmento', it.nome);
    assert.ok(existsSync(`${Catalogo.PASTA_DAS_IMAGENS}/${meta.poe.icone}`), `${it.nome}: o ícone`);
  }
  assert.equal(ITEM_CATALOG[Acesso.DADOS.entradas[SHAPER][0]].name, 'Fragmento da Hidra');
  for (const c of Acesso.DADOS.chefes) {
    assert.ok(BESTIARY[c.base], `${c.nome}: a criatura-base ${c.base}`);
    assert.ok(bossUnico(c.id), `${c.nome}: registrado`);
    assert.deepEqual(c.resistencias, { fire: 50, ice: 50, energy: 50, chaos: 30 });
  }
  assert.equal(Acesso.chefe('poe-guardiao-da-hidra').vidaPct, 1000);
  assert.equal(Acesso.quantidadeDosItens(Acesso.entrada(SHAPER)), 20, '5% de Quantidade de Itens por fragmento');
  assert.equal(Acesso.quantidadeDosItens(Acesso.entrada('poe-sirus')), 40, '10% por Coroa');
});

test('sem level: o pináculo só entra aberto no Dispositivo (mesmo no modo beta); os que não têm itens ainda ficam fechados', { skip: SEM }, () => {
  const e = personagem();
  e.level = 100;
  assert.match(Cacadas.entrar(e, { huntId: SHAPER, mode: 'auto' }).erro, /Dispositivo de Mapas/);
  assert.match(Cacadas.entrar(e, { huntId: 'poe-nucleus-of-the-maven', mode: 'auto' }).erro, /próxima etapa/);
  const beta = Beta.ativo();
  Beta.definir(true);
  try {
    assert.match(Cacadas.entrar(e, { huntId: SHAPER, mode: 'auto' }).erro, /Dispositivo de Mapas/, 'o beta não dispensa os fragmentos');
  } finally {
    Beta.definir(beta);
  }
  assert.match(Dispositivo.abrirPinaculo(e, { pinaculo: SHAPER, mode: 'auto' }).erro, /Faltam: Fragmento da Hidra/);
  assert.ok(!e.hunt);
});

test('abrir o Shaper: os 4 fragmentos (da bolsa e do depósito) saem só depois de a arena nascer, com 6 portais; a morte gasta um; a vitória fecha', { skip: SEM }, () => {
  const e = personagem();
  e.level = 20; // (level nenhum importa)
  const ids = Acesso.entrada(SHAPER);
  Bolsa.porNaBolsa(e, ids[0], 2);
  for (const id of ids.slice(1)) e.inventory.push({ id, count: 1 });
  const tela = Dispositivo.pinaculosParaTela(e).find((p) => p.id === SHAPER);
  assert.ok(tela.pronto);
  assert.equal(Dispositivo.pinaculosParaTela(e).find((p) => p.id === 'poe-nucleus-of-the-maven').itens, null, 'o Nucleus of the Maven ainda não abre');
  const r = Dispositivo.abrirPinaculo(e, { pinaculo: SHAPER, mode: 'auto' });
  assert.equal(r.ok, true, r.erro);
  assert.equal(e.hunt.bossId, SHAPER);
  assert.equal(e.hunt.quantidadeDoPinaculo, 20);
  assert.ok(todos(e).some((m) => m.boss?.id === SHAPER), 'o Shaper nasceu');
  assert.deepEqual(ids.map((id) => [...e.inventory, ...e.pouch].filter((x) => x.id === id).reduce((t, x) => t + (x.count ?? 1), 0)), [1, 0, 0, 0], 'um de cada gasto');
  assert.equal(e.pinaculoAberto.portais, 6);
  assert.match(Dispositivo.abrirPinaculo(e, { pinaculo: SHAPER }).erro, /já tem um pináculo aberto/);
  // morreu: um portal a menos, volta pela arena
  assert.deepEqual(Acesso.aoMorrer(e, SHAPER), { portais: 5, falhou: false });
  e.hunt = null;
  assert.equal(Dispositivo.voltarAoPinaculo(e, { mode: 'auto' }).ok, true);
  const shaper = todos(e).find((m) => m.boss?.id === SHAPER);
  Combate.vitoriaNoBoss(e, e.hunt, shaper, PERSONAGEM);
  assert.equal(e.pinaculoAberto, null, 'venceu: o pináculo fecha');
  assert.equal(e.pinaculosVencidos[SHAPER], 1, 'a vitória contada (a tela mostra)');
  assert.equal(Dispositivo.pinaculosParaTela(e).find((p) => p.id === SHAPER).vitorias, 1);
  assert.match(Cacadas.entrar(e, { huntId: SHAPER, mode: 'auto' }).erro, /Dispositivo de Mapas/, 'a próxima luta pede os itens de novo');
});

test('o último portal fecha o pináculo; a entrada que falha não gasta os itens', { skip: SEM }, () => {
  const e = personagem();
  const ids = Acesso.entrada('poe-sirus');
  for (const id of ids) e.inventory.push({ id, count: 1 });
  e.pinaculoAberto = { id: 'poe-sirus', portais: 1, portaisMax: 6, mortes: 5 };
  assert.deepEqual(Acesso.aoMorrer(e, 'poe-sirus'), { portais: 0, falhou: true });
  assert.equal(e.pinaculoAberto, null);
  const r = Acesso.abrir(e, 'poe-sirus', { contar: () => 1, gastar: () => assert.fail('não gasta'), entrar: () => ({ ok: false, erro: 'a arena não abriu' }) });
  assert.equal(r.ok, false);
  assert.equal(e.pinaculoAberto, null);
});

test('o mapa do Guardião da Hidra: T16 com o desenho dele; o guardião é o chefe do mapa e solta o Fragmento da Hidra garantido', { skip: SEM }, () => {
  const e = personagem();
  const hidra = Acesso.chefe('poe-guardiao-da-hidra');
  const peca = Acesso.comEncontro(Jogo.mapaSorteado(16, { raridade: 'normal' }), hidra);
  assert.equal(peca.id, hidra.mapa);
  assert.equal(peca.poe.nome, 'Covil da Hidra');
  assert.equal(peca.poe.encontro, hidra.id);
  assert.deepEqual(peca.poe.implicitos.map((i) => i.texto), ['Área é influenciada pelo Criador']);
  const r = abrirMapa(e, peca);
  assert.equal(r.ok, true, r.erro);
  const chefes = todos(e).filter((m) => m.chefeDoMapa);
  assert.equal(chefes.length, 1, 'um chefe: o guardião');
  assert.equal(chefes[0].boss?.id, hidra.id);
  assert.equal(chefes[0].maxHp, Math.round(BESTIARY[hidra.base].hp * hidra.vidaMult));
  Combate.matarMonstro(e, e.hunt, PERSONAGEM, chefes[0], []);
  assert.ok(e.pouch.some((x) => x.id === hidra.fragmento), 'o Fragmento da Hidra na bolsa');
});

test('o mapa "ocupado"/"com a Cidadela": o chefe do tier continua e o do encontro nasce a mais, com a Coroa garantida', { skip: SEM }, () => {
  const e = personagem();
  const baran = Acesso.chefe('poe-baran');
  const peca = Acesso.comEncontro(Jogo.mapaSorteado(14, { raridade: 'normal' }), baran);
  assert.equal(peca.id, Jogo.mapaSorteado(14, { raridade: 'normal' }).id, 'o desenho do mapa comum');
  assert.deepEqual(peca.poe.implicitos.map((i) => i.texto), ['Mapa contém a Cidadela de Baran']);
  assert.equal(abrirMapa(e, peca).ok, true);
  assert.equal(todos(e).filter((m) => m.chefeDoMapa).length, 1, 'o chefe do tier');
  const doEncontro = todos(e).find((m) => m.boss?.id === baran.id);
  assert.ok(doEncontro && !doEncontro.chefeDoMapa);
  Combate.matarMonstro(e, e.hunt, PERSONAGEM, doEncontro, []);
  assert.ok(e.pouch.some((x) => x.id === baran.fragmento), 'a Coroa de Baran na bolsa');
});

test('o drop: só os chefes de mapa T14+ soltam os mapas com encontro, um sorteio por grupo', { skip: SEM }, () => {
  assert.deepEqual(Acesso.sortearEncontros(13, () => 0), []);
  const todosOsGrupos = Acesso.sortearEncontros(14, () => 0);
  assert.deepEqual(todosOsGrupos.map((x) => x.grupo), ['criador', 'anciao', 'conquistador']);
  assert.deepEqual(Acesso.sortearEncontros(16, () => 0.99), []);
  // a chance de cada grupo (`drop.chancePorChefe`): logo abaixo, cai; logo acima, não
  const c = Acesso.DADOS.drop.chancePorChefe.criador;
  let i = 0;
  const rng = () => [c - 0.001, 0, 1, 1][i++] ?? 1;
  assert.deepEqual(Acesso.sortearEncontros(16, rng).map((x) => x.chefe.id), ['poe-guardiao-da-hidra']);
  // o mapa Único não leva encontro
  const unico = Jogo.mapaSorteado(14, { raridade: 'unico' });
  if (unico?.poe?.unico) assert.equal(Acesso.comEncontro(unico, Acesso.chefe('poe-drox')), null);
});

test('a tela: o Dispositivo lista os 11 pináculos e as 2 arenas da etapa 2 com os itens (e quantos você tem)', { skip: SEM }, () => {
  const e = personagem();
  const tela = Dispositivo.paraTela(e);
  assert.equal(tela.pinaculos.length, Pinaculos.todos().length + Pinaculos.arenas().length + Acesso.crisois().length);
  const sirus = tela.pinaculos.find((p) => p.id === 'poe-sirus');
  assert.deepEqual(sirus.itens.map((i) => [i.nome, i.tem]), [['Coroa de Baran', 0], ['Coroa de Veritania', 0], ['Coroa de Al-Hezmin', 0], ['Coroa de Drox', 0]]);
  assert.equal(tela.pinaculoAberto, null);
});

// ---------------------------------------------------------------- etapa 2: o Exarca e o Devorador
const POLARIZADO = Acesso.entrada('poe-a-estrela-negra')[0];
const INCANDESCENTE = Acesso.entrada('poe-the-searing-exarch')[0];
const CONTORCIDO = Acesso.entrada('poe-a-fome-infinita')[0];

test('etapa 2 — os convites do poedb (a variante de moeda) e as duas arenas registradas como os pináculos, com os Únicos delas', { skip: SEM }, () => {
  assert.deepEqual([POLARIZADO, INCANDESCENTE, CONTORCIDO].map((id) => ITEM_CATALOG[id].name), ['Convite Polarizado', 'Convite Incandescente', 'Convite Contorcido']);
  for (const id of [POLARIZADO, INCANDESCENTE]) assert.ok(existsSync(`${Catalogo.PASTA_DAS_IMAGENS}/${ITEM_CATALOG[id].poe.icone}`));
  assert.deepEqual(ITEM_CATALOG[POLARIZADO].fragmentoPoe.abre, ['A Estrela Negra']);
  const estrela = Pinaculos.arena('poe-a-estrela-negra');
  assert.equal(estrela.vidaPct, 1400);
  assert.deepEqual(estrela.unicos.map((u) => u.slug).sort(), ['Polaric_Devastation', 'Sudden_Dawn', 'The_Eternal_Struggle']);
  assert.ok(bossUnico('poe-a-fome-infinita'));
  assert.equal(Pinaculos.todos().length, 11, 'os 11 pináculos continuam os mesmos');
  const p = Pinaculos.dropExclusivo('poe-a-fome-infinita');
  assert.ok(['Black_Zenith', 'Ceaseless_Feast'].includes(p.poe.unico), p.poe.unico);
});

test('etapa 2 — a influência: cada chefe T14+ conta; a cada 14 o Polarizado; o Incandescente só conta depois da Estrela Negra vencida, a cada 28', { skip: SEM }, () => {
  const e = personagem();
  assert.equal(Acesso.definirInfluencia(e, 'nada').ok, false);
  assert.equal(Acesso.definirInfluencia(e, 'exarca').ok, true);
  const vencer = (tier = 14, influencia = 'exarca') => Acesso.aoVencerChefeDeMapa(e, { tier, influencia });
  assert.deepEqual(vencer(13), [], 'abaixo do T14 não conta');
  assert.deepEqual(vencer(16, null), [], 'sem influência não conta');
  for (let i = 1; i < 14; i++) assert.deepEqual(vencer(), []);
  assert.deepEqual(vencer(), [POLARIZADO], 'o 14º');
  assert.equal(e.atlas.contagem[INCANDESCENTE] ?? 0, 0, 'antes da Estrela Negra o Incandescente não conta');
  Acesso.aoVencer(e, 'poe-a-estrela-negra');
  for (let i = 1; i < 28; i++) vencer();
  const caiu = vencer();
  assert.ok(caiu.includes(INCANDESCENTE), 'o 28º depois da Estrela Negra');
  assert.ok(caiu.includes(POLARIZADO), 'e o Polarizado segue a cada 14');
  assert.deepEqual(vencer(15, 'devorador'), [], 'a outra influência conta à parte');
  const tela = Acesso.influenciaParaTela(e);
  assert.equal(tela.escolhida, 'exarca');
  assert.deepEqual(tela.convites.find((c) => c.id === CONTORCIDO), { id: CONTORCIDO, nome: 'Convite Contorcido', influencia: 'devorador', abre: 'A Fome Infinita', feitos: 1, aCada: 14, conta: true });
});

test('etapa 2 — no jogo: o mapa T14 aberto com a influência conta o chefe; o 14º solta o Polarizado, que abre a Estrela Negra no Dispositivo', { skip: SEM }, () => {
  const e = personagem();
  Dispositivo.definirInfluencia(e, 'exarca');
  e.atlas.contagem[POLARIZADO] = 13;
  assert.equal(abrirMapa(e, Jogo.mapaSorteado(14, { raridade: 'normal' })).ok, true);
  assert.equal(e.hunt.mapa.influencia, 'exarca');
  const chefe = todos(e).find((m) => m.chefeDoMapa);
  Combate.matarMonstro(e, e.hunt, PERSONAGEM, chefe, []);
  assert.ok(e.pouch.some((x) => x.id === POLARIZADO), 'o Convite Polarizado na bolsa');
  Dispositivo.abandonar(e);
  e.hunt = null;
  const r = Dispositivo.abrirPinaculo(e, { pinaculo: 'poe-a-estrela-negra', mode: 'auto' });
  assert.equal(r.ok, true, r.erro);
  const estrela = todos(e).find((m) => m.boss?.id === 'poe-a-estrela-negra');
  assert.ok(estrela, 'A Estrela Negra nasceu');
  assert.ok(!e.pouch.some((x) => x.id === POLARIZADO), 'o convite foi gasto');
  Combate.vitoriaNoBoss(e, e.hunt, estrela, PERSONAGEM);
  assert.equal(e.pinaculosVencidos['poe-a-estrela-negra'], 1);
  assert.equal(e.pinaculoAberto, null);
  const slugs = new Set(Pinaculos.arena('poe-a-estrela-negra').unicos.map((u) => u.slug));
  assert.ok(e.rewards.at(-1).itens.some((i) => i.poe?.raridade === 'unico' && slugs.has(i.poe.unico)), 'o Único exclusivo da Estrela Negra');
  // a tela lista a arena logo antes do Exarca
  const ids = Dispositivo.pinaculosParaTela(e).map((p) => p.id);
  assert.equal(ids.indexOf('poe-a-estrela-negra') + 1, ids.indexOf('poe-the-searing-exarch'));
});

// ---------------------------------------------------------------- etapa 3: a Maven
const ATLAS = Acesso.entrada('poe-crisol-atlas')[0];
const DEFORMADOS = Acesso.entrada('poe-crisol-deformados')[0];
const CITACAO = Acesso.entrada('poe-the-maven')[0];
const CRESCENTE = Acesso.MAVEN?.fragmento;

test('etapa 3 — os itens da Maven do poedb (Fragmento Crescente, A Citação, os 4 convites, com ícone) e os 4 Calvários na arena da Maven', { skip: SEM }, () => {
  assert.deepEqual([CRESCENTE, CITACAO, ATLAS, DEFORMADOS].map((id) => ITEM_CATALOG[id].name), ['Fragmento Crescente', 'A Citação de Maven', 'Convite da Maven: Atlas', 'Convite de Maven: Deformados']);
  for (const id of [CRESCENTE, CITACAO, ATLAS, DEFORMADOS]) assert.ok(existsSync(`${Catalogo.PASTA_DAS_IMAGENS}/${ITEM_CATALOG[id].poe.icone}`), ITEM_CATALOG[id].name);
  assert.deepEqual(Acesso.crisois().map((c) => [c.id, c.fragmentos]), [['poe-crisol-atlas', [6, 7]], ['poe-crisol-deformados', [3, 4]], ['poe-crisol-distorcidos', [3, 4]], ['poe-crisol-matadores', [3, 4]]]);
  assert.deepEqual(Acesso.crisol('poe-crisol-deformados').chefes, ['poe-guardiao-da-hidra', 'poe-guardiao-da-fenix', 'poe-guardiao-do-minotauro', 'poe-guardiao-da-quimera']);
  for (const c of Acesso.crisois()) assert.ok(Pinaculos.crisol(c.id), `${c.nome}: registrado`);
  assert.equal(Pinaculos.todos().length, 11, 'os 11 pináculos continuam os mesmos');
});

test('etapa 3 — a Maven testemunha: só ligada e T14+; cada chefe de mapa soma 1 até 10 e o 10º solta o Atlas; os 4 Guardiões do Criador soltam os Deformados', { skip: SEM }, () => {
  const e = personagem();
  const chefeDoMapa = { chefeDoMapa: true, key: 'x', name: 'Chefe' };
  assert.deepEqual(Acesso.aoVencerComMaven(e, { tier: 16, maven: false }, chefeDoMapa), [], 'sem a Maven não conta');
  assert.deepEqual(Acesso.aoVencerComMaven(e, { tier: 13, maven: true }, chefeDoMapa), [], 'abaixo do T14 não conta');
  for (let i = 1; i < 10; i++) assert.deepEqual(Acesso.aoVencerComMaven(e, { tier: 14, maven: true }, chefeDoMapa), []);
  assert.deepEqual(Acesso.aoVencerComMaven(e, { tier: 14, maven: true }, chefeDoMapa), [ATLAS], 'o 10º');
  assert.deepEqual(Acesso.aoVencerComMaven(e, { tier: 14, maven: true }, chefeDoMapa), [], 'depois do 10º não soma (o convite cai uma vez por ciclo)');
  assert.equal(e.maven.contador, 10);
  assert.equal(e.maven.testemunhados.length, 10);
  const guardioes = Acesso.crisol('poe-crisol-deformados').chefes;
  for (const id of guardioes.slice(0, 3)) assert.deepEqual(Acesso.aoVencerComMaven(e, { tier: 16, maven: true }, { boss: { id }, name: id, fragmentoPoe: 1 }), []);
  assert.deepEqual(Acesso.aoVencerComMaven(e, { tier: 16, maven: true }, { boss: { id: guardioes[3] }, name: 'Quimera', fragmentoPoe: 1 }), [DEFORMADOS], 'os 4 vistos');
  assert.ok(!guardioes.some((id) => e.maven.vistos[id]), 'o grupo recomeça');
  const tela = Acesso.mavenParaTela(e);
  assert.equal(tela.contador, 10);
  assert.equal(tela.grupos.length, 3);
  Acesso.aoFecharCrisol(e, 'poe-crisol-atlas');
  assert.deepEqual([e.maven.contador, e.maven.testemunhados.length, e.maven.conviteDoAtlas], [0, 0, false], 'o Calvário do Atlas fechado: a Maven esquece');
});

test('etapa 3 — no jogo: o mapa T14 com a Maven conta o chefe; o 10º solta o Atlas; o Calvário nasce com os 10 em pares e solta 6–7 Fragmentos Crescentes', { skip: SEM }, () => {
  const e = personagem();
  assert.equal(Dispositivo.definirMaven(e, true).ok, true);
  assert.match(Dispositivo.abrirPinaculo(e, { pinaculo: 'poe-crisol-atlas', mode: 'auto' }).erro, /0 de 10/, 'o Atlas pede os 10');
  for (let i = 0; i < 10; i++) {
    assert.equal(abrirMapa(e, Jogo.mapaSorteado(14 + (i % 3), { raridade: 'normal' })).ok, true);
    assert.equal(e.hunt.mapa.maven, true);
    const chefe = todos(e).find((m) => m.chefeDoMapa);
    Combate.matarMonstro(e, e.hunt, PERSONAGEM, chefe, []);
    Dispositivo.abandonar(e);
    e.hunt = null;
  }
  assert.equal(e.maven.contador, 10);
  assert.ok(e.pouch.some((x) => x.id === ATLAS), 'o Convite: Atlas na bolsa');
  const r = Dispositivo.abrirPinaculo(e, { pinaculo: 'poe-crisol-atlas', mode: 'auto' });
  assert.equal(r.ok, true, r.erro);
  assert.ok(!e.pouch.some((x) => x.id === ATLAS), 'o convite foi gasto');
  assert.equal(e.hunt.crisol.total, 10);
  for (let par = 0; par < 5; par++) {
    const vivos = e.hunt.monstros.filter((m) => m.doCrisol && m.hp > 0);
    assert.equal(vivos.length, 2, `o par ${par + 1}`);
    for (const m of vivos) {
      m.hp = 0;
      Combate.vitoriaNoBoss(e, e.hunt, m, PERSONAGEM);
    }
  }
  assert.ok(e.hunt.vitoria, 'os 10 vencidos: a vitória');
  const fragmentos = e.rewards.at(-1).itens.find((i) => i.id === CRESCENTE)?.count;
  assert.ok(fragmentos >= 6 && fragmentos <= 7, `6–7 Fragmentos Crescentes (${fragmentos})`);
  assert.equal(e.pinaculoAberto, null);
  assert.equal(e.maven.contador, 0, 'a Maven esqueceu os testemunhados');
});

test('etapa 3 — 10 Fragmentos Crescentes valem A Citação: a Maven abre com eles (gastos ao abrir)', { skip: SEM }, () => {
  const e = personagem();
  e.inventory.push({ id: CRESCENTE, count: 9 });
  assert.equal(Dispositivo.pinaculosParaTela(e).find((p) => p.id === 'poe-the-maven').pronto, false, '9 não bastam');
  e.inventory.find((x) => x.id === CRESCENTE).count = 12;
  assert.equal(Dispositivo.pinaculosParaTela(e).find((p) => p.id === 'poe-the-maven').pronto, true);
  const r = Dispositivo.abrirPinaculo(e, { pinaculo: 'poe-the-maven', mode: 'auto' });
  assert.equal(r.ok, true, r.erro);
  assert.ok(todos(e).some((m) => m.boss?.id === 'poe-the-maven'), 'The Maven nasceu');
  assert.equal(e.inventory.find((x) => x.id === CRESCENTE)?.count, 2, 'gastou 10');
});

// ---------------------------------------------------------------- etapa 4: o Venarius e as Encarnações
const CORTEX = Acesso.entrada('poe-venarius')[0];
const SOLIDAO = Acesso.memorias().find((m) => m.slug === 'Memory_of_Loneliness').itemId;
const ECO_SOLIDAO = Acesso.entrada('poe-incarnation-of-neglect')[0];

test('etapa 4 — os itens do poedb (Córtex, 3 Memórias, 3 Ecos, com ícone), os 3 chefes das Memórias registrados e os ids antigos no lugar', { skip: SEM }, () => {
  assert.deepEqual([CORTEX, SOLIDAO, ECO_SOLIDAO].map((id) => ITEM_CATALOG[id].name), ['Córtex', 'Memória da Solidão', 'Eco da Solidão']);
  for (const it of Acesso.DADOS.itens.filter((i) => i.cortex || i.memoria || Acesso.chefe(i.chefe)?.grupo === 'memoria')) assert.ok(existsSync(`${Catalogo.PASTA_DAS_IMAGENS}/${ITEM_CATALOG[it.itemId].poe.icone}`), it.nome);
  for (const id of ['poe-a-chama-abandonada', 'poe-o-deus-enganador', 'poe-o-cardeal-do-medo']) {
    assert.ok(bossUnico(id), id);
    assert.equal(Acesso.chefe(id).vidaPct, 1120);
  }
  assert.equal(Acesso.entrada('poe-a-estrela-negra')[0], 7750013, 'os ids das etapas anteriores não mudaram');
  assert.equal(Acesso.entrada('poe-the-maven')[0], 7750018);
});

test('etapa 4 — o drop: só os chefes T14+; o Córtex com 2% e uma Memória com 3%', { skip: SEM }, () => {
  assert.deepEqual(Acesso.sortearDoAtlas(13, () => 0), [], 'abaixo do T14 nada');
  const tudo = Acesso.sortearDoAtlas(14, () => 0);
  assert.equal(tudo[0], CORTEX);
  assert.ok(Acesso.memoria(tudo[1]));
  assert.deepEqual(Acesso.sortearDoAtlas(16, () => 0.025), [Acesso.memorias()[0].itemId], '2,5%: só a Memória (o Córtex é 2%)');
  assert.deepEqual(Acesso.sortearDoAtlas(16, () => 0.05), [], '5%: nada');
});

test('etapa 4 — no jogo: a Memória vira o mapa final (T16); o chefe dele solta o Eco garantido, e o Eco abre a Encarnação no Dispositivo', { skip: SEM }, () => {
  const e = personagem();
  e.inventory.push({ id: SOLIDAO, count: 1 });
  const r = Dispositivo.usarMemoria(e, { memoria: SOLIDAO, mode: 'auto' });
  assert.equal(r.ok, true, r.erro);
  assert.ok(!e.inventory.some((x) => x.id === SOLIDAO), 'a Memória foi gasta');
  assert.equal(e.hunt.mapa.tier, 16);
  assert.equal(e.hunt.mapa.encontro, 'poe-a-chama-abandonada');
  const chefes = todos(e).filter((m) => m.chefeDoMapa);
  assert.equal(chefes.length, 1, 'o chefe da Memória é o chefe do mapa');
  assert.equal(chefes[0].boss?.id, 'poe-a-chama-abandonada');
  Combate.matarMonstro(e, e.hunt, PERSONAGEM, chefes[0], []);
  assert.ok(e.pouch.some((x) => x.id === ECO_SOLIDAO), 'o Eco da Solidão na bolsa');
  Dispositivo.abandonar(e);
  e.hunt = null;
  const p = Dispositivo.abrirPinaculo(e, { pinaculo: 'poe-incarnation-of-neglect', mode: 'auto' });
  assert.equal(p.ok, true, p.erro);
  assert.ok(todos(e).some((m) => m.boss?.id === 'poe-incarnation-of-neglect'), 'a Encarnação do Abandono nasceu');
});

test('etapa 4 — o Córtex abre o Venarius no Dispositivo', { skip: SEM }, () => {
  const e = personagem();
  assert.equal(Dispositivo.pinaculosParaTela(e).find((p) => p.id === 'poe-venarius').pronto, false);
  e.inventory.push({ id: CORTEX, count: 1 });
  const r = Dispositivo.abrirPinaculo(e, { pinaculo: 'poe-venarius', mode: 'auto' });
  assert.equal(r.ok, true, r.erro);
  assert.ok(todos(e).some((m) => m.boss?.id === 'poe-venarius'), 'o Venarius nasceu');
  assert.ok(!e.inventory.some((x) => x.id === CORTEX), 'o Córtex foi gasto');
});
