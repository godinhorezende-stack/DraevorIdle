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

test('B4. recompensas de nível no PoE: só o Baú de itens do nível 1 (uma peça comum de nível 1 na mochila); os marcos antigos (o frasco, os do Draevor) viram ele', { skip: SEM }, async () => {
  const R = await import('../systems/recompensas.mjs');
  const { ITEM_CATALOG } = await import('../systems/dados.mjs');
  (await import('../systems/itens-poe/jogo.mjs')).iniciar(ITEM_CATALOG);
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 1 }), R.estadoInicial(), { inventory: [] });
  const c = R.presentesParaCliente(e);
  assert.deepEqual([c.marcos.length, c.marcos[0].tipo, c.marcos[0].level, c.marcos[0].aberto, c.marcos[0].id], [1, 'bau-poe', 1, true, 'bau-poe-1']);
  const r = R.coletarMarco(e, { id: 'bau-poe-1' });
  assert.ok(r.ok, r.erro);
  const peca = e.inventory.at(-1);
  assert.equal(peca.poe.raridade, 'normal');
  assert.ok((ITEM_CATALOG[peca.id].minLevel ?? 1) <= 1, 'peça de nível 1');
  assert.ok(!/Flask/.test(peca.poe.classe), 'não é frasco');
  assert.match(r.notice, /baú abriu/);
  assert.ok(!R.coletarMarco(e, { id: 'bau-poe-1' }).ok, 'não repete');
  // Quem tinha o marco do frasco (ou os do Draevor) fica com o baú.
  const velho = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 60 }), { presentes: { ...R.estadoInicial().presentes, marcos: [{ level: 1, tipo: 'frasco-poe', pego: true }, { level: 50, tipo: 'bau', titulo: 'Baú' }] } });
  R.abrirProximas(velho);
  assert.deepEqual(velho.presentes.marcos.map((m) => [m.tipo, !!m.pego]), [['bau-poe', false]]);
});

test('B4b. todo personagem novo do PoE nasce com 2 Frascos de Vida Pequenos no cinto (vagas 1 e 2)', { skip: SEM }, async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../websocket/sessao.mjs', import.meta.url), 'utf8');
  assert.match(src, /frascos: \[ItensPoeJogo\.frascoInicial\(\), ItensPoeJogo\.frascoInicial\(\), null, null, null\]/);
  const J = await import('../systems/itens-poe/jogo.mjs');
  const f = J.frascoInicial();
  assert.ok(f.poe.inicial && /Small_Life_Flask/.test(f.poe.base));
});

test('B5. o lure vai até 8 monstros (e o "voltar em" até 7), no servidor também (dono, 07/10)', async () => {
  const Cacadas = await import('../systems/cacadas.mjs');
  assert.equal(Cacadas.MAX_LURE, 8);
  const e = personagemDeTeste({ vocacao: 'knight', level: 30 });
  Cacadas.definirLure?.(e, { value: 10, volta: 9 });
  if (Cacadas.definirLure) {
    assert.equal(e.settings.lure, 8);
    assert.equal(e.settings.lureVolta, 7);
  }
});
