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
    assert.ok(p.draevor.arvoreTotal >= 0, `a árvore do PoE (era "0 / -4" no level 1): ${p.draevor.arvoreTotal}`);
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
