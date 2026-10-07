// A BARRA DO PoE (dono, 07/10: "frascos 1 a 5 e mais 8 que podem ser ataques, auras, suporte etc"): 8 slots de habilidade numa fileira,
// qualquer gema em qualquer um; as teclas 1 a 5 são dos frascos; quem vem da barra de 22 entra com as ações compactadas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = !existsSync(Catalogo.ARQUIVO) && 'catálogo do PoE não está nesta máquina';
const Acoes = await import('../systems/acoes.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');

test('B1. com o PoE: 8 slots numa fileira, todos de habilidade; o catálogo manda as 5 vagas de frasco e as teclas 1-5', { skip: SEM }, () => {
  assert.equal(Acoes.SLOTS, 8);
  assert.equal(Acoes.SLOTS_POR_FILEIRA, 8);
  assert.deepEqual(Acoes.PAPEL_DO_SLOT, Array(8).fill('skill'));
  assert.equal(Acoes.FRASCOS_NA_BARRA, 5);
  assert.deepEqual(Acoes.TECLAS_DOS_FRASCOS, ['1', '2', '3', '4', '5']);
  assert.equal(Acoes.TECLAS_PADRAO.length, 8);
  assert.ok(!Acoes.TECLAS_PADRAO.some((t) => ['w', 'a', 's', 'd', '1', '2', '3', '4', '5'].includes(t)), 'as teclas de fábrica não andam nem usam frasco');
  const c = Acoes.catalogo(personagemDeTeste({ vocacao: 'knight', level: 10 }));
  assert.equal(c.slots, 8);
  assert.equal(c.frascos, 5);
  assert.deepEqual(c.teclasDosFrascos, ['1', '2', '3', '4', '5']);
});

test('B2. a tecla de um slot não pode ser 1 a 5 (são dos frascos); as outras valem', { skip: SEM }, () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 10 });
  assert.match(Acoes.trocarTecla(e, { slot: 0, key: '3' }).erro, /frascos/);
  assert.ok(Acoes.trocarTecla(e, { slot: 0, key: 'z' }).ok);
  assert.equal(e.hotkeys[0], 'z');
});

test('B3. a barra antiga (22 slots, poções) vira a de 8: as ações compactadas na ordem, as que não cabem saem, teclas de fábrica; os arranjos também', { skip: SEM }, () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 10 });
  e.actions = Array(22).fill(null);
  e.actions[11] = { id: 'a' };
  e.actions[15] = { id: 'b' };
  e.actions[3] = { id: 'c' };
  e.hotkeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', ...Array(11).fill(null)];
  e.actionPresets = [{ name: 'x', actions: Array(22).fill({ id: 'p' }), hotkeys: Array(22).fill('1') }];
  assert.equal(Acoes.ajustarBarra(e), true);
  assert.equal(e.actions.length, 8);
  assert.deepEqual(e.actions.slice(0, 3).map((a) => a.id), ['c', 'a', 'b']);
  assert.deepEqual(e.hotkeys, Acoes.TECLAS_PADRAO);
  assert.equal(e.actionPresets[0].actions.length, 8);
  assert.equal(e.actionPresets[0].actions.filter(Boolean).length, 8, 'as 8 primeiras ficam');
  assert.equal(Acoes.ajustarBarra(e), false, 'já do tamanho certo: não mexe');
});

test('B4. recompensas de nível no PoE: só o Frasco de Vida Pequeno no level 1; pegar põe no cinto (pede level 3, mas o inicial entra); os marcos antigos saem', { skip: SEM }, async () => {
  const R = await import('../systems/recompensas.mjs');
  const F = await import('../systems/itens-poe/frascos.mjs');
  const { ITEM_CATALOG } = await import('../systems/dados.mjs');
  (await import('../systems/itens-poe/jogo.mjs')).iniciar(ITEM_CATALOG);
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 1 }), R.estadoInicial());
  assert.equal(e.presentes.marcos.length, 1);
  const c = R.presentesParaCliente(e);
  assert.deepEqual([c.marcos[0].tipo, c.marcos[0].level, c.marcos[0].aberto, c.marcos[0].itens.length, c.marcos[0].id], ['frasco-poe', 1, true, 1, 'frasco-poe-1']);
  const r = R.coletarMarco(e, { id: 'frasco-poe-1' });
  assert.ok(r.ok, r.erro);
  assert.match(r.notice, /na mochila/);
  const frasco = e.inventory.at(-1);
  assert.ok(frasco?.poe?.inicial && /Life/.test(frasco.poe.base), 'o frasco inicial está na mochila');
  assert.equal(e.presentes.marcos[0].pego, true);
  assert.ok(!R.coletarMarco(e, { id: 'frasco-poe-1' }).ok, 'não repete');
  // Pôr no cinto no level 1: o inicial não pede o level 3. E a regra de uso: vida abaixo de X%.
  assert.ok(F.por(e, { pilha: e.inventory.length - 1 }).ok);
  assert.equal(F.regraDe(F.cinto(e)[0]).abaixoPct, 50, 'padrão: vida abaixo de 50%');
  assert.ok(F.configurar(e, { vaga: 0, abaixoPct: 35 }).ok);
  assert.equal(F.paraCliente(e)[0].regra.abaixoPct, 35);
  assert.ok(!F.configurar(e, { vaga: 0, abaixoPct: 0 }).ok);
  assert.match(F.configurar(e, { vaga: 0, emCombate: true }).erro ?? '', /porcentagem/);
  // Um personagem com os marcos do Draevor (baú 50...) fica só com o do frasco.
  const velho = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 60 }), { presentes: { ...R.estadoInicial().presentes, marcos: [{ level: 50, custo: 50000, tipo: 'bau', titulo: 'Baú' }, { level: 120, tipo: 'montaria', mount: 1 }] } });
  R.abrirProximas(velho);
  assert.deepEqual(velho.presentes.marcos.map((m) => m.tipo), ['frasco-poe']);
});
