// O SITE no jogo oficial (PoE, 08/10: "tá aparecendo itens antigos… quero arrumar para o modelo do PoE"): o ranking é de experiência e
// level (sem as perícias do Draevor), cada linha leva o nome da CLASSE do PoE, a capa mostra os Únicos do PoE (não os drops nem as bags do
// Draevor) e o personagem arquivado não aparece "caçando offline". O contrato do site do Draevor original fica em site.test.mjs (B).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import * as B from '../database/banco.mjs';
import * as Site from '../systems/site.mjs';
import * as DropsDoSite from '../systems/drops-do-site.mjs';
import * as Ranking from '../systems/ranking.mjs';
import * as Ausentes from '../systems/ausentes.mjs';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import { personagemDeTeste } from './apoio.mjs';

const SEM = !Catalogo.ligado() && 'jogo oficial desligado nesta máquina';
const sufixo = () => randomUUID().replace(/[^a-z]/g, '').slice(0, 6);
const NOME = `Sitepoe${sufixo()}`;
const s = { personagem: { nome: NOME }, estado: { ...personagemDeTeste({ vocacao: 'sorcerer', level: 30 }), classe: 'witch' } };
Site.ligar(new Map([[NOME, s]]));
Ranking.ligar(new Map([[NOME, s]]));
DropsDoSite.gravarNosTestes();
const contas = [];
after(async () => {
  B.db.prepare('DELETE FROM site_drops WHERE dados LIKE ?').run(`%"quem":"${NOME}"%`);
  for (const c of contas) {
    for (const p of await B.personagensDaConta(c)) B.db.prepare('DELETE FROM personagens WHERE id = ?').run(p.id);
    B.db.prepare('DELETE FROM contas WHERE id = ?').run(c);
  }
});

test('ranking do site: só experiência e level, e a linha leva o nome da classe do PoE', { skip: SEM }, async () => {
  const st = await Site.status('magic');
  assert.deepEqual(st.categorias, ['exp', 'level']);
  assert.equal(st.categoria, 'level', 'categoria do Draevor cai no level');
  // Na experiência, com o topo garantido (o banco de desenvolvimento tem gente acima dele no level).
  s.estado.xp = 9e15;
  const linha = (await Site.status('exp')).highscore.find((l) => l.name === NOME);
  assert.ok(linha, 'quem está online entra');
  assert.equal(linha.classe, 'Bruxa');
  assert.equal('vocationName' in linha, false);
});

test('/online: a classe do PoE; o arquivado não aparece caçando offline (e não conta no número)', { skip: SEM }, async () => {
  assert.equal(Site.jogadoresOnline().jogadores.find((j) => j.name === NOME)?.classe, 'Bruxa');
  const conta = await B.criarConta({ email: `sitepoe-${randomUUID()}@teste.local`, senha: 'x' });
  contas.push(conta.id);
  const antigo = await B.criarPersonagem({ conta: conta.id, nome: `Antigo${sufixo()}`, vocacao: 'knight', sexo: 'male', estadoInicial: { level: 1024, vocation: 'knight', frascos: [null] } });
  const doPoe = await B.criarPersonagem({ conta: conta.id, nome: `Poe${sufixo()}`, vocacao: 'knight', sexo: 'male', estadoInicial: { level: 12, vocation: 'knight', sistema: 'poe', classe: 'marauder' }, classe: 'marauder' });
  const ate = Date.now() + 3_600_000;
  for (const p of [antigo, doPoe]) B.db.prepare('UPDATE personagens SET caca_offline_desde = ?, caca_offline_ate = ? WHERE id = ?').run(Date.now() - 60_000, ate, p.id);
  await Ausentes.atualizar(Date.now());
  const nomes = Ausentes.agora().map((a) => a.nome);
  assert.equal(nomes.includes(antigo.nome), false, 'o arquivado (Draevor, level 1024) não caça offline no site');
  assert.ok(nomes.includes(doPoe.nome), 'o do PoE aparece');
  assert.equal(Ausentes.agora().find((a) => a.nome === doPoe.nome).classe, 'marauder');
});

test('capa: os Únicos do PoE entram; os drops e as bags do Draevor não aparecem no jogo oficial', { skip: SEM }, async () => {
  const base = Number(Object.keys(ITEM_CATALOG).find((k) => Number(k) >= 7_000_000 && ITEM_CATALOG[k].poe));
  await DropsDoSite.anotarDropPoe({ quem: NOME, onde: 'A Costa', bicho: 'Hillock', peca: { id: base, count: 1, poe: { raridade: 'unico', nome: 'Único de Teste' } } });
  await DropsDoSite.anotarDropPoe({ quem: NOME, onde: 'A Costa', bicho: 'Hillock', peca: { id: base, count: 1, poe: { raridade: 'raro', nome: 'Raro de Teste' } } });
  await DropsDoSite.anotarDrop({ quem: NOME, onde: 'Teste', bicho: 'Bicho', id: 34109 }); // uma bag do Draevor
  const vista = await DropsDoSite.vista();
  const meus = vista.drops.filter((d) => d.quem === NOME);
  assert.deepEqual(meus.map((d) => d.nome), ['Único de Teste'], 'só o Único do PoE (nem o Raro, nem a bag do Draevor)');
  assert.equal(meus[0].raridade, 'unico');
  assert.equal(meus[0].peca.poe.nome, 'Único de Teste', 'a peça inteira vai para o balão');
  assert.ok(vista.itens[base], 'o catálogo da base (o ícone do PoE)');
  assert.equal(vista.bags, null, 'sem bags: a capa esconde a faixa');
});

test('ficha do personagem: marcada do PoE, com a classe, a árvore do PoE e o catálogo das peças vestidas (o ícone do PoE)', { skip: SEM }, async () => {
  const base = Number(Object.keys(ITEM_CATALOG).find((k) => Number(k) >= 7_000_000 && ITEM_CATALOG[k].poe?.icone && ITEM_CATALOG[k].slot));
  const antes = s.estado.equipment;
  s.estado.equipment = { ...(antes ?? {}), [ITEM_CATALOG[base].slot]: { id: base, count: 1, poe: { raridade: 'normal', nome: ITEM_CATALOG[base].name } } };
  try {
    const { ok, personagem: p } = await Site.personagem(NOME);
    assert.equal(ok, true);
    assert.equal(p.poe, true);
    assert.equal(p.vocacaoNome, 'Bruxa');
    // A árvore: os nós liberados / os nós da árvore principal do PoE (sem início e ascendência) — era "0 / -4" no level 1, depois pontos.
    const Passivas = await import('../systems/passivas/arvore.mjs');
    const principais = [...Passivas.arvore().porId.values()].filter((no) => no.tipo !== 'start' && !no.ascendencia).length;
    assert.equal(p.draevor.arvoreTotal, principais);
    assert.ok(principais > 2000, `a árvore do PoE inteira: ${principais}`);
    assert.ok(p.draevor.arvoreUsados >= 0 && p.draevor.arvoreUsados <= principais);
    assert.ok(p.itens[base]?.poe?.icone, 'o catálogo da peça do PoE, com o ícone');
  } finally {
    s.estado.equipment = antes;
  }
});

test('wiki: o artigo de itens no jogo oficial é o do PoE (raridades, chance por peça, moedas com o status no jogo)', { skip: SEM }, async () => {
  const Wiki = await import('../systems/wiki.mjs');
  const d = Wiki.itensPoe();
  assert.equal(d.poe, true);
  assert.deepEqual(d.raridades.map((r) => r.nome), ['Normal', 'Mágico', 'Raro', 'Único']);
  assert.equal(d.raridades.find((r) => r.id === 'unico').fixos, true);
  const soma = Object.values(d.chances).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(soma - 1) < 1e-9, 'as chances somam 100%');
  assert.ok(d.totais.bases > 0 && d.totais.unicos > 0);
  assert.equal(d.moedas.length, d.totais.moedas);
  assert.ok(d.moedas.every((m) => ['funciona', 'parcial', 'nao'].includes(m.status)));
  assert.equal(d.moedas.filter((m) => m.status === 'funciona').length, d.totais.funcionam);
});

// A grade do equipamento do site no formato do jogo (dono, 08/10: a disposição "não está nesse formato", com a foto do inventário do jogo).
test('ficha do personagem: as luvas, o segundo anel e o cinto de frascos (a grade do PoE no site)', { skip: SEM }, async () => {
  const ItensPoeJogo = await import('../systems/itens-poe/jogo.mjs');
  const daCasa = (slot) => Number(Object.keys(ITEM_CATALOG).find((k) => Number(k) >= 7_000_000 && ITEM_CATALOG[k].slot === slot));
  const peca = (id) => ({ id, count: 1, poe: { raridade: 'normal', nome: ITEM_CATALOG[id].name } });
  const luva = daCasa('gloves');
  const anel = daCasa('ring');
  const frasco = ItensPoeJogo.frascoInicial();
  const antes = { equipment: s.estado.equipment, frascos: s.estado.frascos };
  s.estado.equipment = { ...(antes.equipment ?? {}), gloves: peca(luva), ring2: peca(anel) };
  s.estado.frascos = [frasco, null];
  const doCinto = JSON.stringify(s.estado.frascos);
  try {
    const { personagem: p } = await Site.personagem(NOME);
    assert.equal(p.equipamento.gloves?.id, luva);
    assert.equal(p.equipamento.ring2?.id, anel);
    assert.equal(p.frascos.length, 5, 'as 5 vagas do cinto');
    assert.equal(p.frascos[0].id, frasco.id);
    assert.ok(p.frascos[0].cargasMaximas > 0 && p.frascos[0].cargas === p.frascos[0].cargasMaximas, 'na cidade, o frasco cheio');
    assert.equal(p.frascos[0].peca.poe?.raridade, frasco.poe.raridade);
    assert.deepEqual(p.frascos.slice(1), [null, null, null, null]);
    assert.ok(p.itens[frasco.id], 'o catálogo do frasco (o ícone e o balão)');
    assert.equal(JSON.stringify(s.estado.frascos), doCinto, 'a página do site não mexe no cinto do personagem');
  } finally {
    s.estado.equipment = antes.equipment;
    s.estado.frascos = antes.frascos;
  }
});

test('a grade do PoE do site (balão do top 5, ficha e card da guilda) é a mesma do inventário do jogo', async () => {
  const { readFileSync } = await import('node:fs');
  const ler = (c) => readFileSync(new URL(`../frontend/${c}`, import.meta.url), 'utf8');
  const areas = (texto, seletor) => {
    const bloco = texto.slice(texto.indexOf('grid-template-areas', texto.indexOf(seletor)));
    return [...bloco.slice(0, bloco.indexOf(';')).matchAll(/"([^"]+)"/g)].map((m) => m[1].trim().split(/\s+/).join(' '));
  };
  const doJogo = areas(ler('client/balao-item.css'), '.equipment.poe {');
  const doSite = areas(ler('client/src/paperdoll.mjs'), '.pd-grade.pd-poe {');
  assert.deepEqual(doSite, doJogo.filter((linha) => !linha.startsWith('ammo')), 'as mesmas posições (o site não tem a munição)');
  // Cada casa do jogo (fora a mochila e os selos, que no jogo vão no rodapé) tem a dela no site.
  const inventario = ler('client/src/inventory.mjs');
  const casasDoJogo = JSON.parse(inventario.match(/const SLOT_LAYOUT_COM_LUVAS = (\[[^\]]+\])/)[1].replace(/'/g, '"')).filter((c) => c !== 'backpack' && !c.startsWith('@'));
  const casasDoSite = [...ler('client/src/paperdoll.mjs').match(/export const ORDEM_DO_POE = \[([\s\S]*?)\n\];/)[1].matchAll(/\['(\w+)'/g)].map((m) => m[1]);
  assert.deepEqual([...casasDoSite].sort(), [...casasDoJogo].sort());
  // Quem desenha a grade no jogo oficial pede a do PoE.
  assert.match(ler('client/site/top5.mjs'), /poe: !!p\.poe,/);
  assert.match(ler('personagem.html'), /gradeDeEquipamento\([\s\S]*?poe: true,/);
  assert.match(ler('client/src/guildas.mjs'), /\{ poe: !!ctx\.state\.classesPoe \}/);
});

// Dono, 08/10: "no status do personagem tem que aparecer qual ato, fase e dificuldade que ele está".
test('ficha do personagem: caçando na campanha, o status diz o ato, a fase (a ordem no ato, como no mapa) e a dificuldade', { skip: SEM }, async () => {
  const Campanha = await import('../systems/campanha.mjs');
  const area = Campanha.FASES.find((f) => f.huntId === 'poe-a1-the-ship-graveyard');
  assert.ok(area, 'a Necrópole de Navios é uma fase do Ato 1');
  const segundoAto = Campanha.FASES.filter((f) => f.ato === 2);
  const antes = { hunt: s.estado.hunt, campanha: s.estado.campanha };
  try {
    s.estado.hunt = { huntId: area.huntId, modo: 'automatica', campanha: { huntId: area.huntId, ato: 1, dificuldade: 'facil' } };
    let { personagem: p } = await Site.personagem(NOME);
    assert.equal(p.atividade.onde, 'automatica');
    assert.deepEqual(p.atividade.campanha, { ato: 1, fase: Campanha.FASES.filter((f) => f.ato === 1).findIndex((f) => f.huntId === area.huntId) + 1, area: 'Necrópole de Navios', dificuldade: 'Normal' });
    assert.equal(s.estado.campanha, antes.campanha, 'a página do site não mexe no progresso do personagem');

    // No Ato 2 a fase conta dentro do ato (a 3ª área do Ato 2 é a Fase 3, como no mapa — e não a posição na campanha inteira).
    const terceira = segundoAto[2];
    s.estado.hunt = { huntId: terceira.huntId, modo: 'automatica', campanha: { huntId: terceira.huntId, ato: 2, dificuldade: 'facil' } };
    ({ personagem: p } = await Site.personagem(NOME));
    assert.equal(p.atividade.campanha.ato, 2);
    assert.equal(p.atividade.campanha.fase, 3);

    // Na sala do chefe do ato: o chefe no lugar da fase.
    s.estado.hunt = { huntId: Campanha.bossDoAto(1).bossId, modo: 'automatica', campanha: { ato: 1, dificuldade: 'facil', bossDoAto: 1 } };
    ({ personagem: p } = await Site.personagem(NOME));
    assert.deepEqual(p.atividade.campanha, { ato: 1, chefe: Campanha.bossDoAto(1).nome, dificuldade: 'Normal' });

    // Na cidade: sem campanha no status.
    s.estado.hunt = null;
    ({ personagem: p } = await Site.personagem(NOME));
    assert.equal(p.atividade.campanha, undefined);
  } finally {
    s.estado.hunt = antes.hunt;
    s.estado.campanha = antes.campanha;
  }
});

// Dono, 08/10: a barra da caçada conta a fase DENTRO do ato, como o mapa da campanha e o site ("Ato 2 · Fase 3", e não "Fase 19").
test('a barra da caçada: a fase atual conta dentro do ato (a 3ª área do Ato 2 é a Fase 3)', { skip: SEM }, async () => {
  const Campanha = await import('../systems/campanha.mjs');
  const terceira = Campanha.FASES.filter((f) => f.ato === 2)[2];
  const e = { campanha: {} };
  const f = Campanha.faseAtual(e, { huntId: terceira.huntId, campanha: { huntId: terceira.huntId, ato: 2, dificuldade: 'facil' } });
  assert.equal(f.ato, 2);
  assert.equal(f.numero, 3);
  assert.equal(f.numero, Campanha.numeroNoAto(terceira.huntId), 'o mesmo número do site');
});
