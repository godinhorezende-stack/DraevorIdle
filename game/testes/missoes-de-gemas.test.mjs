// As MISSÕES do PoE que dão gemas (dono, 06/10: "implemente as gemas de suporte e suas missões" — "como no PoE"): concluir a missão
// na campanha deixa UMA gema da lista da classe para escolher, nível 1; só gemas ativas e suportes; uma vez por personagem.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !existsSync('/home/deploy/referencias-poe/poe-suportes-poedb/suportes.json')) && 'coleções do PoE não estão nesta máquina';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const Acoes = await import('../systems/acoes.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const R = await import('../systems/skills/reforcos.mjs');
const G = await import('../systems/itens-poe/gemas-poe.mjs');
const SP = await import('../systems/itens-poe/suportes-poe.mjs');
const M = await import('../systems/itens-poe/missoes-de-gemas.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');
if (!SEM) {
  (await import('../systems/itens-poe/jogo.mjs')).iniciar(ITEM_CATALOG);
  await G.iniciar({ registrarGema: (g) => (Acoes.registrarAcao(g.entry), GS.registrarAtiva(g)), registrarReforco: R.registrar });
  SP.iniciar({ registrarSuporte: GS.registrarSuporte });
}
const bruxa = () => Object.assign(personagemDeTeste({ vocacao: 'sorcerer', level: 20 }), { classePoe: 'Witch' });

test('as 8 missões do PoE com gatilho e recompensa, e os 262 suportes no jogo (com Coursing Current e Eclipse)', { skip: SEM }, () => {
  assert.equal(M.MISSOES.length, 8);
  assert.ok(SP.doSlug('Coursing_Current_Support')?.itemId && SP.doSlug('Eclipse_Support')?.itemId);
  for (const m of M.MISSOES) {
    assert.ok(m.gatilho.fase || m.gatilho.bossDoAto, m.slug);
    for (const [classe, lista] of Object.entries(m.recompensas)) assert.ok(M.opcoes(m, classe).length === new Set(lista.map((g) => g.slug)).size, `${m.slug}/${classe}: toda gema da lista existe no jogo`);
  }
  // O Bruto Enjaulado, Bruxa: os suportes da lista do PoE (Added Lightning, Minion Damage...).
  const bruto = M.MISSOES.find((m) => m.slug === 'The_Caged_Brute');
  const nomes = M.opcoes(bruto, 'Witch').map((id) => GS.defDaGema(id)?.poe?.en ?? GS.defDaGema(id)?.nome);
  assert.ok(nomes.some((n) => /Added Lightning Damage/.test(n)) && nomes.some((n) => /Minion Damage/.test(n)), nomes.join(', '));
});

test('completar a fase da missão deixa a escolha pendente; escolher entrega a gema nível 1; não repete; recusa gema de fora', { skip: SEM }, () => {
  const e = bruxa();
  assert.equal(M.aoCompletarFase(e, 'poe-a1-the-twilight-strand-outra'), '');
  const aviso = M.aoCompletarFase(e, 'poe-a1-the-upper-prison');
  assert.match(aviso, /Missão concluída: O Bruto Enjaulado/);
  const [p] = M.pendentes(e);
  assert.equal(p.slug, 'The_Caged_Brute');
  assert.ok(p.opcoes.length >= 10);
  // A mesma fase de novo (outra dificuldade): não abre outra recompensa.
  assert.equal(M.aoCompletarFase(e, 'poe-a1-the-upper-prison'), '');
  const fora = [...GS.DEFS.values()].find((d) => !p.opcoes.includes(d.itemId)).itemId;
  assert.ok(!M.escolher(e, { missao: p.slug, itemId: fora }).ok, 'gema fora da lista');
  const antes = e.inventory.length;
  const r = M.escolher(e, { missao: p.slug, itemId: p.opcoes[0] });
  assert.ok(r.ok, r.erro);
  assert.equal(e.inventory.length, antes + 1);
  const gema = e.inventory.at(-1);
  assert.deepEqual([gema.id, gema.gema.nivel, gema.gema.qualidade], [p.opcoes[0], 1, 0]);
  assert.equal(M.pendentes(e).length, 0);
  assert.ok(!M.escolher(e, { missao: p.slug, itemId: p.opcoes[1] }).ok, 'só uma por missão');
});

test('o chefe do Ato 4 conclui O Eterno Pesadelo; classe sem recompensa na missão conclui sem nada para escolher', { skip: SEM }, () => {
  const e = bruxa();
  assert.match(M.aoVencerBoss(e, 4), /O Eterno Pesadelo/);
  const duelista = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 30 }), { classePoe: 'Duelist' });
  // "A Raiz do Problema" só dá gema para Templar, Marauder e Witch.
  assert.equal(M.aoCompletarFase(duelista, 'poe-a2-the-vaal-ruins'), '');
  assert.equal(duelista.missoesPoe.The_Root_of_the_Problem.escolhida, 0);
  assert.equal(M.pendentes(duelista).length, 0);
});

test('a campanha chama as missões ao completar a fase (o aviso da tela leva a missão)', { skip: SEM }, async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../systems/campanha.mjs', import.meta.url), 'utf8');
  assert.match(src, /MissoesDeGemas\.aoCompletarFase\(estado, f\.huntId\)/);
  assert.match(src, /MissoesDeGemas\.aoVencerBoss\(estado, ato\)/);
});
