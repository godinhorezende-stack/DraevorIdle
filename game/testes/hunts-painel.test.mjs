import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as Hunts from '../admin/hunts.mjs';
import * as Http from '../admin/conteudo-http.mjs';
import * as Campanha from '../systems/campanha.mjs';
import { CATALOGO } from '../systems/dados.mjs';
import { spawnsDaHunt } from '../systems/hunt/terreno.mjs';

test('H1. a lista cobre todas as categorias de hunt e diz quantas têm spawns no mapa', () => {
  const l = Hunts.listar();
  assert.equal(l.length, CATALOGO.hunts.length + CATALOGO.vips.length + CATALOGO.especiais.length + CATALOGO.divinas.length);
  assert.equal(l.filter((h) => h.categoria === 'vips').length, CATALOGO.vips.length);
  assert.ok(l.filter((h) => h.spawns > 0).length >= 40);
  assert.ok(l.find((h) => h.id === 'troll-cave').doCampanha);
});

test('H2. painel da hunt da campanha: mapa, spawns, monstros, distribuição e dificuldade conferem com o jogo', () => {
  const p = Hunts.painel('troll-cave', 'medio');
  const spawns = spawnsDaHunt('troll-cave');
  assert.equal(p.spawns.total, spawns.length);
  assert.equal(p.spawns.bichos, spawns.reduce((n, s) => n + s.quantidade, 0));
  assert.equal(p.spawns.pontos.length, spawns.length);
  assert.equal(p.mapa.arquivo, 'troll-cave-map.json');
  assert.ok(p.mapa.largura > 0 && p.mapa.altura > 0);
  const soma = p.monstros.definidosPeloMapa.reduce((n, m) => n + m.mortesPorLimpeza, 0);
  assert.ok(Math.abs(soma - p.spawns.bichos) < 0.5, 'as mortes esperadas somam os bichos');
  assert.equal(p.distribuicao.totalDeBichos, p.spawns.bichos);
  assert.equal(p.distribuicao.linhas.reduce((n, l) => n + l.spawns, 0), p.spawns.total);
  assert.equal(p.dificuldade.tipo, 'campanha');
  const f = Campanha.faseDe('troll-cave');
  const medio = p.dificuldade.porDificuldade.find((x) => x.id === 'medio');
  assert.equal(medio.levelAlvo, f.nivel.medio);
  assert.equal(medio.vida, Number(Campanha.escala(f.levelOriginal, f.nivel.medio).vida.toFixed(3)));
  assert.equal(p.dificuldade.porDificuldade.find((x) => x.id === 'facil').vida, 1);
});

test('H3. drops esperados: queda por limpeza = mortes × chance do bestiário; ordenado por valor; avisa que é estimativa', () => {
  const p = Hunts.painel('troll-cave', 'facil');
  assert.match(p.drops.modelo, /Estimativa por chance/);
  assert.match(p.drops.modelo, /não garante/);
  const axe = p.drops.itens.find((i) => i.item === 3268);
  const troll = p.monstros.definidosPeloMapa.find((m) => m.key === 'troll');
  const chance = CATALOGO.bestiary.troll.loot.find((l) => l.id === 3268).chance;
  assert.ok(Math.abs(axe.quedasPorLimpeza - Number((troll.mortesPorLimpeza * chance).toFixed(4))) < 0.01);
  const valores = p.drops.itens.map((i) => i.valorPorLimpeza);
  assert.deepEqual(valores, [...valores].sort((a, b) => b - a));
  assert.ok(p.drops.ouroEsperado > 0);
  assert.ok(Math.abs(p.drops.valorTotalEsperado - (p.drops.ouroEsperado + p.drops.valorDosItensEsperado)) <= 1, 'total = ouro + itens');
  assert.ok(p.drops.deEncontros?.some((e) => e.tipo === 'bau-comum'), 'os encontros da fase aparecem à parte');
});

test('H4. a escala da dificuldade entra na conta: o ouro esperado sobe no Cruel (exp dos bichos escalada)', () => {
  const facil = Hunts.painel('troll-cave', 'facil').drops.ouroEsperado;
  const medio = Hunts.painel('troll-cave', 'medio').drops.ouroEsperado;
  assert.ok(medio > facil * 5);
  assert.equal(Hunts.painel('troll-cave', 'xyz').dificuldadeEscolhida, 'facil', 'dificuldade inválida cai no padrão');
});

test('H5. hunt VIP sem spawns no mapa: mostra o que o cadastro diz, sem inventar quantidade nem distribuição', () => {
  const p = Hunts.painel('vip-rotworm');
  assert.equal(p.spawns.total, 0);
  assert.equal(p.distribuicao, null);
  assert.ok(p.monstros.doCadastro.length > 0);
  assert.equal(p.dificuldade.tipo, 'sem campanha');
  assert.equal(p.drops.bichosPorLimpeza, 0);
  assert.equal(Hunts.painel('nao-existe'), null);
});

test('H6. rotas HTTP do painel e leitura apenas (o módulo não escreve nada)', async () => {
  const resp = [];
  const json = (r, c, b) => resp.push([c, b]);
  const chama = (rota, q = '') => Http.atender({ method: 'GET' }, {}, `/api/mapas/_conteudo/${rota}`, new URL(`http://x/?${q}`), { json, corpoJson: async () => ({}) });
  await chama('hunts');
  await chama('hunts/painel', 'id=troll-cave&dif=dificil');
  await chama('hunts/painel', 'id=nada');
  assert.deepEqual(resp.map((r) => r[0]), [200, 200, 404]);
  assert.equal(resp[1][1].dificuldadeEscolhida, 'dificil');
  assert.doesNotMatch(readFileSync(new URL('../admin/hunts.mjs', import.meta.url), 'utf8'), /writeFileSync|unlinkSync|mkdirSync/);
});

test('H7. a tela está ligada ao /editor/conteudo e o link leva ao editor de mapas com o mapa pedido', () => {
  const ed = readFileSync(new URL('../frontend/client/src/editor-conteudo.mjs', import.meta.url), 'utf8');
  assert.match(ed, /criarPainelDeHunts/);
  assert.match(ed, /\['hunts', 'Hunts'\]/);
  assert.match(readFileSync(new URL('../frontend/client/src/editor-hunts.mjs', import.meta.url), 'utf8'), /\/editor\?mapa=/);
  assert.match(readFileSync(new URL('../frontend/client/src/editor.mjs', import.meta.url), 'utf8'), /get\('mapa'\)/);
  assert.match(readFileSync(new URL('../frontend/client/src/editor-atos.mjs', import.meta.url), 'utf8'), /tabelaDeDrops/, 'a prévia da recompensa do ato usa a mesma tabela visual');
});
