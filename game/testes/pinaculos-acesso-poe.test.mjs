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
  assert.equal(Acesso.DADOS.itens.length, 16, '12 fragmentos/coroas + 4 convites (etapa 2)');
  assert.equal(Acesso.DADOS.mapas.length, 4);
  assert.deepEqual(Object.keys(Acesso.DADOS.entradas).sort(), ['poe-a-estrela-negra', 'poe-a-fome-infinita', 'poe-sirus', 'poe-the-eater-of-worlds', 'poe-the-elder', 'poe-the-searing-exarch', SHAPER]);
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
  assert.match(Cacadas.entrar(e, { huntId: 'poe-the-maven', mode: 'auto' }).erro, /próxima etapa/);
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
  assert.equal(Dispositivo.pinaculosParaTela(e).find((p) => p.id === 'poe-the-maven').itens, null, 'a Maven ainda não abre');
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
  assert.equal(tela.pinaculos.length, Pinaculos.todos().length + Pinaculos.arenas().length);
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
