// As telas da engine para o PoE (Referência PoE): a Biblioteca de itens só com as bases do PoE, a Campanha (com a troca de mapa), a
// Árvore e os Chefes. Usa o catálogo importado de verdade (a coleção fica fora do repositório): sem ele nesta máquina, os testes são pulados.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = !existsSync(Catalogo.ARQUIVO) && 'catálogo do PoE não importado nesta máquina';
const { ITEM_CATALOG, CATALOGO } = await import('../systems/dados.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
if (!SEM) {
  Jogo.iniciar(ITEM_CATALOG);
  (await import('../systems/itens-poe/pinaculos.mjs')).iniciar();
  (await import('../systems/itens-poe/campanha.mjs')).iniciar();
}
const Biblioteca = await import('../admin/biblioteca.mjs');
const Telas = await import('../admin/itens-poe-telas.mjs');
const CampanhaPoe = await import('../systems/itens-poe/campanha.mjs');
const { mapaDe } = await import('../systems/hunt/terreno.mjs');

test('com o PoE ligado, a Biblioteca de itens só tem as bases do PoE (ícone da coleção, classe), e o detalhe é o da base do PoE', { skip: SEM }, () => {
  const l = Biblioteca.listar({ categoria: 'itens', limite: 2000 });
  assert.ok(l.total > 900);
  assert.ok(l.itens.every((i) => Number(i.id) >= Jogo.PRIMEIRO_ID && i.desenho?.tipo === 'imagem'), 'nenhum item do Tibia');
  const d = Biblioteca.detalhe('itens', l.itens[0].id);
  assert.ok(d.poe.base && d.poe.requisitos && Array.isArray(d.poe.atributos) && d.poe.regras.raridades);
  assert.ok(d.poe.atributos.every((a) => ['aplicado', 'fora'].includes(a.estado)));
});

test('Campanha: atos com grafo, área com monstros (status + habilidades convertidas) e chefe do ato; trocar o mapa vale na hora', { skip: SEM }, () => {
  const c = Telas.campanha();
  assert.equal(c.atos.length, 11);
  assert.ok(c.atos[0].conexoes.length && c.atos[0].chefe?.bossId);
  assert.ok(c.mapas.length > 10 && c.mapas.every((m) => !m.id.startsWith('poe-')));
  const a = Telas.area('poe-a1-the-coast');
  assert.ok(a.monstros.length && a.monstros.every((m) => m.chave.startsWith('poe-') && m.vida > 0));
  const antes = a.mapa;
  const outro = c.mapas.find((m) => m.id !== antes).id;
  assert.equal(CampanhaPoe.trocarMapa('poe-a1-the-coast', outro, { salvar: false }).ok, true);
  assert.equal(mapaDe('poe-a1-the-coast'), outro);
  assert.equal(CATALOGO.hunts.find((h) => h.id === 'poe-a1-the-coast').poeArea, true);
  assert.equal(CampanhaPoe.trocarMapa('poe-a1-the-coast', 'poe-a1-the-mud-flats', { salvar: false }).ok, false, 'área do PoE não é mapa');
  assert.equal(CampanhaPoe.trocarMapa('poe-a1-lioneyes-watch', outro, { salvar: false }).ok, false, 'cidade não tem mapa');
  CampanhaPoe.trocarMapa('poe-a1-the-coast', antes, { salvar: false });
  delete CampanhaPoe.MAPAS_TROCADOS['poe-a1-the-coast'];
  const ch = Telas.area(Object.values(Telas.campanha().areas).find((x) => x.ato === 1 && x.id === c.atos[0].faseDoChefe).id).chefeDoAto;
  assert.ok(ch?.noJogo?.vida > 0, 'a área antes do chefe mostra o chefe do ato');
});

test('Chefes e Árvore: pináculos e chefes de ato com status no jogo; a árvore inteira com textos e estados', { skip: SEM }, () => {
  const ch = Telas.chefes();
  assert.ok(ch.pinaculos.length >= 10 && ch.pinaculos.every((p) => p.noJogo?.vida > 0));
  assert.equal(ch.atos.length, 10);
  assert.ok(ch.atos.every((a) => a.status.vida > 0 && a.noJogo));
  const ar = Telas.arvore();
  assert.equal(ar.ligada, true);
  assert.ok(ar.nos.length > 2500 && ar.nos.some((n) => n.t === 'keystone' && n.keystone) && ar.nos.some((n) => n.opcoes?.length));
  const cob = Telas.coberturaDaArvore();
  assert.ok(cob.small.nos > 1000 && cob.ascendencia.nos > 300);
});
