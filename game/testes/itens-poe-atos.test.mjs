// Os Acts do PoE no editor (pedido do dono, 05/10: "o editor manda"): os 10 atos importados do Drive (`tools/importar-atos-poe.mjs` →
// `gamedata/atos/poe-ato-*.json`) são os que o jogo executa com o PoE ligado; a fase conclui por objetivo (limpar, matar o chefe, matar N,
// o item da missão) e cada monstro tem a tabela de drop editável. Usa o catálogo importado de verdade (fora do repositório): sem ele, pula.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = !existsSync(Catalogo.ARQUIVO) && 'catálogo do PoE não importado nesta máquina';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const Campanha = await import('../systems/campanha.mjs');
const Modelo = await import('../systems/atos-modelo.mjs');
const Drops = await import('../systems/itens-poe/drops-por-monstro.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');
if (!SEM) {
  (await import('../systems/itens-poe/jogo.mjs')).iniciar(ITEM_CATALOG);
  (await import('../systems/itens-poe/pinaculos.mjs')).iniciar();
  (await import('../systems/itens-poe/campanha.mjs')).iniciar();
}
const hunt = (huntId) => ({ campanha: { huntId, dificuldade: 'facil' } });
const fase = (huntId) => [...Campanha.ATOS_DO_EDITOR.values()].flatMap((g) => g.ato.fases).find((f) => f.huntId === huntId);

test('os 10 atos do PoE vêm dos arquivos do editor (com as ramificações e o chefe), e os itens de missão estão no catálogo', { skip: SEM }, () => {
  const atos = [...Campanha.ATOS_DO_EDITOR.values()].filter((g) => g.ato.id.startsWith('poe-ato-'));
  assert.equal(atos.length, 10);
  assert.ok(atos.every((g) => g.ato.bossFinal?.bossId?.startsWith('poe-chefe-ato-') && g.ato.conexoes.length >= g.ato.fases.length - 1));
  assert.ok(atos.some((g) => g.ato.conexoes.some((c, i, l) => l.filter((x) => x.de === c.de).length > 1)), 'há ramificação (uma área abre duas)');
  assert.equal(ITEM_CATALOG[7600001].name, 'Baú de Remédios');
  assert.equal(ITEM_CATALOG[7600001].weight, 0);
});

test('matar o chefe: limpar a área sem ele não conclui; matar o Hillock conclui a Costa do Crepúsculo', { skip: SEM }, () => {
  const e = personagemDeTeste({ level: 5, campanha: {} });
  const id = 'poe-a1-the-twilight-strand';
  assert.equal(Campanha.conclusaoDa(id).tipo, 'matar-chefe');
  assert.match(Campanha.limpou(e, hunt(id)), /Para concluir: matar Hillock/);
  assert.equal(Campanha.faseCompleta(e, 'facil', id), false);
  assert.equal(Campanha.matou(e, hunt(id), { key: 'poe-zombie-1' }), null, 'outro bicho não conclui');
  assert.match(Campanha.matou(e, hunt(id), { key: 'poe-hillock-1' }), /Fase completa: Costa do Crepúsculo/);
  assert.equal(Campanha.faseCompleta(e, 'facil', id), true);
});

test('item da missão: a tabela do Hailrake solta o Baú de Remédios só com a missão aberta, e pegá-lo conclui a Ilha da Maré', { skip: SEM }, () => {
  const id = 'poe-a1-the-tidal-island';
  const conc = Campanha.conclusaoDa(id);
  assert.equal(conc.tipo, 'item-de-missao');
  assert.deepEqual(Drops.soltar('poe-hailrake-3', { missaoAberta: () => true }), [{ id: conc.item, count: 1 }]);
  assert.deepEqual(Drops.soltar('poe-hailrake-3', { missaoAberta: () => false }), [], 'missão concluída: o item não cai mais');
  const e = personagemDeTeste({ level: 5, campanha: {} });
  assert.equal(Campanha.matou(e, hunt(id), { key: 'poe-hailrake-3' }, { ganhou: [] }), null, 'sem o item e sem quem dê, não conclui');
  assert.ok(Campanha.matou(e, hunt(id), { key: 'poe-hailrake-3' }, { ganhou: [{ id: conc.item }] }));
  assert.equal(Campanha.faseCompleta(e, 'facil', id), true);
  const e2 = personagemDeTeste({ level: 5, campanha: {} });
  let dado = null;
  assert.ok(Campanha.matou(e2, hunt(id), { key: 'poe-hailrake-3' }, { dar: (item) => ((dado = item), true) }), 'sem a linha na tabela, o alvo dá o item do mesmo jeito');
  assert.equal(dado, conc.item);
});

test('matar N: conta as mortes (do monstro escolhido ou de qualquer um) e conclui na quantidade', { skip: SEM }, () => {
  const id = 'poe-a1-the-coast';
  const f = fase(id);
  const antes = f.conclusao;
  try {
    f.conclusao = { tipo: 'matar-n', quantidade: 3 };
    const e = personagemDeTeste({ level: 5, campanha: {} });
    assert.equal(Campanha.matou(e, hunt(id), { key: 'poe-zombie-2' }), null);
    assert.equal(Campanha.matou(e, hunt(id), { key: 'poe-crab-2' }), null);
    assert.deepEqual(Campanha.progressoDoObjetivo(e, 'facil', id), { feito: 2, total: 3 });
    assert.ok(Campanha.matou(e, hunt(id), { key: 'poe-zombie-2' }));
    assert.equal(Campanha.faseCompleta(e, 'facil', id), true);
  } finally {
    f.conclusao = antes;
  }
});

test('o modelo valida a conclusão (monstro, quantidade, item que existe) e a tabela de drop recusa linha inválida', () => {
  const base = { id: 'ato-teste', nome: 'T', ordem: 50, estado: 'rascunho', inicio: 'fase-a', fases: [{ id: 'fase-a', nome: 'A', huntId: 'x', nivel: { facil: 1, medio: 1, dificil: 1 } }], conexoes: [] };
  const erros = (conclusao) => Modelo.validarAto(Modelo.normalizar({ ...base, fases: [{ ...base.fases[0], conclusao }] }), { itemExiste: (id) => id === 7 }).filter((p) => /onclus|monstro|quantidade|item/.test(p.mensagem)).map((p) => p.mensagem);
  assert.deepEqual(erros({ tipo: 'limpar-hunt' }), []);
  assert.equal(erros({ tipo: 'matar-chefe' }).length, 1);
  assert.equal(erros({ tipo: 'matar-n', quantidade: 0 }).length, 1);
  assert.equal(erros({ tipo: 'item-de-missao', monstro: 'x', item: 8 }).length, 1);
  assert.deepEqual(erros({ tipo: 'item-de-missao', monstro: 'x', item: 7 }), []);
  assert.equal(erros({ tipo: 'voar' }).length, 1);
  assert.equal(Drops.salvar('rat', [{ id: 1, chance: 0 }], { gravar: false }).ok, false);
  assert.equal(Drops.salvar('rat', [{ id: 1, chance: 5 }, { id: 1, chance: 5 }], { gravar: false }).ok, false);
  assert.equal(Drops.salvar('rat', [{ id: 99, chance: 5 }], { existe: () => false, gravar: false }).ok, false);
});

test('modelo do PoE: monstro comum não tem item próprio (cai pela tabela global); só único/chefe tem drop próprio', { skip: SEM }, async () => {
  const Telas = await import('../admin/itens-poe-telas.mjs');
  assert.equal(Telas.temDropProprio('hailrake'), true);
  assert.equal(Telas.temDropProprio('drowned'), false);
  const r = Drops.salvar('drowned', [{ id: 7600001, chance: 5 }], { podeTer: Telas.temDropProprio, gravar: false });
  assert.equal(r.ok, false);
  assert.match(r.erros[0], /tabela global/);
  assert.equal(Drops.salvar('hailrake', [{ id: 7600001, chance: 100, missao: true }], { podeTer: Telas.temDropProprio, gravar: false }).ok, true);
});
