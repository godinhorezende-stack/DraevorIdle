import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as B from '../admin/biblioteca.mjs';
import * as Http from '../admin/conteudo-http.mjs';
import { CATALOGO } from '../systems/dados.mjs';
import { HUNT_DE_TESTE } from './apoio.mjs';
import { aAdaptar, doClassico, soNoOficial } from './apoio-migracao.mjs';

test('L1. o resumo traz todas as categorias com a contagem dos cadastros reais', () => {
  const r = Object.fromEntries(B.resumo().map((c) => [c.id, c.total]));
  assert.equal(r.hunts, CATALOGO.hunts.length);
  assert.equal(r.vips, CATALOGO.vips.length);
  assert.equal(r.especiais, CATALOGO.especiais.length);
  assert.equal(r.bosses, CATALOGO.bosses.length);
  assert.equal(r.monstros, Object.keys(CATALOGO.bestiary).length);
  for (const id of ['divinas', 'mapas', 'itens', 'drops', 'encontros']) assert.ok(id in r, id);
});

test('L2. busca por nome (sem acento/caixa) e por id, filtro de nível, ordem e categoria inválida', { skip: doClassico("A Biblioteca no oficial mostra só as bases do PoE; o teste busca itens do Draevor") }, () => {
  assert.ok(B.listar({ categoria: 'vips', q: 'ROTWORM' }).itens.some((i) => i.id === 'vip-rotworm'));
  assert.equal(B.listar({ categoria: 'bosses', q: 'urmahlullu-the-immaculate' }).itens[0].id, 'urmahlullu-the-immaculate');
  const faixa = B.listar({ categoria: 'hunts', nivelMin: 10, nivelMax: 20 });
  assert.ok(faixa.itens.length > 0 && faixa.itens.every((i) => i.nivel >= 10 && i.nivel <= 20));
  const nomes = B.listar({ categoria: 'hunts', ordem: 'nome', limite: 200 }).itens.map((i) => i.nome.toLowerCase());
  assert.deepEqual(nomes, [...nomes].sort());
  assert.equal(B.listar({ categoria: 'xyz' }).ok, false);
  assert.ok(B.listar({ categoria: 'itens', limite: 9999 }).itens.length <= 200);
});

test('L3. detalhe da hunt VIP, da especial e do boss: dados reais, e o que falta sai como null (nada inventado)', { skip: doClassico("A Biblioteca no oficial mostra só as bases do PoE (biblioteca.mjs:104); o teste espera hunt VIP, raridade \"lendário\", sockets e o ato-1 do Draevor") }, () => {
  const vip = B.detalhe('vips', 'vip-rotworm');
  assert.equal(vip.requisitos.acesso.tipo, 'vip');
  assert.ok(vip.monstros.length > 0);
  assert.equal(vip.cooldowns.horas, null);
  const esp = B.detalhe('especiais', CATALOGO.especiais[0].id);
  assert.equal(esp.requisitos.acesso.tipo, 'instance');
  const boss = B.detalhe('bosses', 'urmahlullu-the-immaculate');
  assert.equal(boss.cooldowns.horas, 0);
  assert.equal(boss.especiais.bossDeAto.ato, 1);
  assert.ok(boss.atributos.hp > 0);
  assert.equal(B.detalhe('bosses', 'nao-existe'), null);
});

test('L4. é só leitura: não há escrita no módulo e as rotas HTTP novas respondem GET', async () => {
  const fonte = readFileSync(new URL('../admin/biblioteca.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(fonte, /writeFileSync|unlinkSync|mkdirSync/);
  const respostas = [];
  const res = {};
  const json = (r, cod, corpo) => respostas.push([cod, corpo]);
  const atender = (rota, q = '') => Http.atender({ method: 'GET' }, res, `/api/mapas/_conteudo/${rota}`, new URL(`http://x/?${q}`), { json, corpoJson: async () => ({}) });
  assert.equal(await atender('biblioteca'), true);
  await atender('biblioteca/lista', 'categoria=bosses&q=ahau');
  await atender('biblioteca/detalhe', 'categoria=bosses&id=ahau');
  await atender('biblioteca/detalhe', 'categoria=bosses&id=nope');
  assert.deepEqual(respostas.map((r) => r[0]), [200, 200, 200, 404]);
  assert.ok(respostas[0][1].categorias.length >= 10);
});

test('L5. auditoria de referências: aponta item inexistente em drop (real) sem corrigir nada', () => {
  const p = B.auditarReferencias();
  assert.ok(Array.isArray(p));
  for (const x of p) assert.ok(x.itensInexistentes.length > 0);
});

// ------------------------------------------------------------------ Etapa 3 (biblioteca visual): desenho, filtros e "onde é usado"

const OUTFITS = JSON.parse(readFileSync(new URL('../gamedata/outfits.json', import.meta.url), 'utf8'));
const SPRITES = JSON.parse(readFileSync(new URL('../gamedata/item-sprites.json', import.meta.url), 'utf8'));

test('L6. desenho de cada linha: só o que existe nos atlas do cliente (nada inventado)', { skip: aAdaptar("Desenho de cada linha só do atlas: vale para as bases do PoE") }, () => {
  for (const cat of ['monstros', 'itens', 'bosses', 'hunts']) {
    for (const l of B.listar({ categoria: cat, limite: 200 }).itens) {
      if (!l.desenho) continue;
      if (l.desenho.tipo === 'criatura') assert.ok(OUTFITS[l.desenho.look], `${cat}/${l.id}: look ${l.desenho.look} sem folha`);
      else assert.ok(SPRITES[l.desenho.id], `${cat}/${l.id}: item ${l.desenho.id} sem sprite`);
    }
  }
  const sem = B.listar({ categoria: 'itens', situacao: 'sem-desenho', limite: 200 });
  assert.ok(sem.total > 0 && sem.itens.every((i) => i.desenho === null && !SPRITES[i.id]));
});

test('L7. filtros combináveis: raridade + tipo + texto, e paginação por deslocamento sem repetir', { skip: doClassico("A Biblioteca no oficial mostra só as bases do PoE (biblioteca.mjs:104); o teste espera hunt VIP, raridade \"lendário\", sockets e o ato-1 do Draevor") }, () => {
  const r = B.listar({ categoria: 'itens', raridade: 'lendário', limite: 200 });
  assert.ok(r.total > 0 && r.itens.every((i) => i.raridade === 'lendário'));
  assert.ok(r.raridades.includes('comum'));
  const tipo = r.itens[0].tipo;
  assert.ok(B.listar({ categoria: 'itens', raridade: 'lendário', tipo, limite: 200 }).itens.every((i) => i.tipo === tipo && i.raridade === 'lendário'));
  const p1 = B.listar({ categoria: 'monstros', limite: 60 }).itens.map((i) => i.id);
  const p2 = B.listar({ categoria: 'monstros', limite: 60, deslocamento: 60 }).itens.map((i) => i.id);
  assert.equal(p1.length, 60);
  assert.equal(new Set([...p1, ...p2]).size, 120, 'a segunda página não repete a primeira');
  const usos = B.listar({ categoria: 'itens', ordem: 'usos', limite: 20 }).itens.map((i) => i.usos);
  assert.deepEqual(usos, [...usos].sort((a, b) => b - a));
  assert.equal(B.listar({ categoria: 'hunts' }).temNivel, true);
  assert.equal(B.listar({ categoria: 'itens' }).temNivel, true, 'item: o nível é o mínimo para usar (minLevel)');
  assert.equal(B.listar({ categoria: 'mapas' }).temNivel, false);
});

test('L8. onde é usado: monstro da hunt, item no loot, hunt na campanha, boss final do ato — e o detalhe traz a lista', { skip: doClassico("A Biblioteca no oficial mostra só as bases do PoE (biblioteca.mjs:104); o teste espera hunt VIP, raridade \"lendário\", sockets e o ato-1 do Draevor") }, () => {
  assert.ok(B.usosDe('monstros', 'troll').some((u) => u.categoria === 'hunts' && u.id === HUNT_DE_TESTE));
  const moeda = B.usosDe('itens', '3031');
  assert.ok(moeda.length > 50 && moeda.every((u) => u.como));
  assert.ok(B.usosDe('hunts', HUNT_DE_TESTE).some((u) => u.categoria === 'atos' && u.id === 'ato-1'));
  assert.ok(B.usosDe('bosses', 'urmahlullu-the-immaculate').some((u) => u.como === 'boss final do ato'));
  const d = B.detalhe('monstros', 'troll');
  assert.deepEqual(d.usadoEm, B.usosDe('monstros', 'troll'));
  assert.equal(B.listar({ categoria: 'monstros', q: 'troll', limite: 200 }).itens.find((i) => i.id === 'troll').usos, d.usadoEm.length);
  assert.deepEqual(B.usosDe('drops', 'x'), []);
});

// ------------------------------------------------------------------ Etapa 5: itens, outfits e montarias

test('L9. itens por slot, com o máximo de sockets do slot e o nível mínimo do catálogo', { skip: doClassico("A Biblioteca no oficial mostra só as bases do PoE (biblioteca.mjs:104); o teste espera hunt VIP, raridade \"lendário\", sockets e o ato-1 do Draevor") }, () => {
  const r = B.listar({ categoria: 'itens', slot: 'body', limite: 200 });
  assert.ok(r.total > 50 && r.itens.every((i) => i.slot === 'body' && i.sockets === 4));
  assert.ok(r.slots.includes('weapon') && r.slots.includes('ring'));
  assert.equal(B.listar({ categoria: 'itens', q: 'gold coin', limite: 5 }).itens.find((i) => i.id === '3031').sockets, null, 'moeda não tem socket');
  const fogo = B.detalhe('itens', '3280');
  assert.equal(fogo.base.ataque, 24);
  assert.deepEqual(fogo.base.elemento, { type: 'fire', value: 11 });
  assert.equal(fogo.requisitos.nivelMinimo, 30);
});

test('L10. regras do item vêm do arquivo de raridades/pools (nada inventado) e a moeda não tem regra de peça', () => {
  const mpa = B.detalhe('itens', '3366');
  const R = JSON.parse(readFileSync(new URL('../gamedata/itens/raridades.json', import.meta.url), 'utf8'));
  assert.deepEqual(mpa.regras.porRaridade.raro.quantosAtributos, R.raridades.raro.atributos);
  assert.deepEqual(mpa.regras.porRaridade.raro.faixaDaBase.armor, [Math.max(1, Math.round(17 * R.raridades.raro.base.piso[0])), Math.max(1, Math.round(17 * R.raridades.raro.base.teto[1]))]);
  assert.equal(mpa.regras.sockets.maximo, 4);
  assert.ok(mpa.regras.atributosPossiveis.length > 10 && mpa.regras.atributosPossiveis.every((a) => a.nome && a.faixasPorTier));
  assert.equal(B.detalhe('itens', '3031').regras, null);
});

test('L11. tooltip: exemplos do gerador real por raridade, a mesma semente dá as mesmas peças', () => {
  const a = B.dadosDoTooltip('3366', { itemLevel: 200, semente: 5 });
  const b = B.dadosDoTooltip('3366', { itemLevel: 200, semente: 5 });
  const c = B.dadosDoTooltip('3366', { itemLevel: 200, semente: 6 });
  assert.deepEqual(a.exemplos, b.exemplos);
  assert.notDeepEqual(a.exemplos, c.exemplos);
  assert.deepEqual(a.exemplos.map((x) => x.raridade), ['comum', 'incomum', 'raro', 'épico', 'lendário', 'mítico']);
  for (const x of a.exemplos) if (x.peca.raridade) assert.equal(x.peca.raridade, x.raridade);
  assert.ok(a.itens['3366'] && a.catalogo.afixos);
  assert.deepEqual(B.dadosDoTooltip('3031').exemplos, [], 'item sem atributos não sorteia exemplo');
  assert.equal(B.dadosDoTooltip('nao-existe'), null);
});

test('L12. outfits e montarias reais (mounts-real.json), com o desenho só quando há folha', () => {
  const real = JSON.parse(readFileSync(new URL('../gamedata/mounts-real.json', import.meta.url), 'utf8'));
  const res = Object.fromEntries(B.resumo().map((c) => [c.id, c.total]));
  assert.equal(res.outfits, real.outfits.length);
  assert.equal(res.montarias, real.mounts.length);
  const o = B.detalhe('outfits', '136');
  assert.equal(o.nome, 'Citizen');
  assert.equal(o.tipo, 'feminino');
  assert.equal(o.gratis, true);
  assert.equal(B.detalhe('montarias', '1').nome, 'Widow Queen');
  assert.ok(B.listar({ categoria: 'montarias', limite: 200 }).itens.every((m) => !m.desenho || OUTFITS[m.desenho.look]));
});

test('L9. com o PoE ligado, as moedas empilháveis entram na Biblioteca de itens como "Stackable Currency", com ícone, estado no jogo e ficha própria', { skip: soNoOficial("as moedas do PoE na Biblioteca") }, async () => {
  const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
  if (!(await import('node:fs')).existsSync(Catalogo.ARQUIVO)) return;
  const M = await import('../systems/itens-poe/moedas.mjs');
  const { ITEM_CATALOG } = await import('../systems/dados.mjs');
  if (!M.MOEDAS.length) return;
  const antes = process.env.ITENS_POE;
  process.env.ITENS_POE = '1';
  try {
    (await import('../systems/itens-poe/jogo.mjs')).iniciar(ITEM_CATALOG);
    M.iniciar();
    const r = B.listar({ categoria: 'itens', tipo: B.TIPO_DA_MOEDA, limite: 500 });
    assert.equal(r.total, 195, 'as 195 moedas');
    const caos = r.itens.find((i) => i.id === String(M.idDa('Chaos_Orb')));
    assert.ok(caos, 'o Orbe do Caos está na lista');
    assert.equal(caos.tipo, 'Stackable Currency');
    assert.equal(caos.raridade, 'funciona');
    assert.match(caos.desenho.url, /icone\/moeda\/Chaos_Orb\.png$/);
    assert.ok(r.tipos.includes('Stackable Currency'), 'o filtro de tipo oferece a classe');
    const d = B.detalhe('itens', String(M.idDa('Cartographers_Chisel')));
    assert.equal(d.tipo, 'Stackable Currency');
    assert.equal(d.moeda.status, 'nao');
    assert.match(d.moeda.descricao, /sem efeito no jogo/);
    assert.equal(d.moeda.pilha, 20);
  } finally {
    if (antes == null) delete process.env.ITENS_POE; else process.env.ITENS_POE = antes;
  }
});
