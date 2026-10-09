// As GEMAS contra o poedb (dono, 09/10: "ao entrar em cada gema verifique tudo — a missão, o level effect e a imagem tanto da gema quanto
// da skill que vai ficar na barra de slot"; "colocar todas as gemas para funcionar, visualmente e efetivamente"): a tabela por nível do
// poedb no lugar da antiga (a coleção deixava 278 gemas sem Experiência — a transfigurada não subia de nível), o ícone da HABILIDADE na
// barra (o da gema fica para o item) e o manifesto da aba Gemas × PoEDB.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const N = await import('../systems/itens-poe/gemas-niveis.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Object.keys(N.niveisDoPoedb()).length) && 'sem os dados do PoE/poedb nesta máquina';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const Acoes = await import('../systems/acoes.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const R = await import('../systems/skills/reforcos.mjs');
const G = await import('../systems/itens-poe/gemas-poe.mjs');
/** As entradas de ação que as gemas registram (o que vai ao cliente). */
const capturadas = new Map();
if (!SEM) {
  (await import('../systems/itens-poe/jogo.mjs')).iniciar(ITEM_CATALOG);
  await G.iniciar({ registrarGema: (g) => (capturadas.set(g.entry.id, g.entry), Acoes.registrarAcao(g.entry), GS.registrarAtiva(g)), registrarReforco: R.registrar });
}

test('a gema transfigurada ganha a Experiência do poedb: sobe de nível como a base (antes, presa no 1)', { skip: SEM }, () => {
  const g = G.doSlug('Cleave_of_Rage')?.gema;
  assert.ok(g, 'a Cutilada da Fúria');
  assert.equal(g.niveisDoPoedb, true);
  const ix = g.colunas.indexOf('Experiência');
  assert.ok(ix >= 0 && g.linhas.filter((l) => Number(String(l[ix]).replace(/,/g, '')) > 0).length >= 19, 'a XP de cada nível até o 20');
  assert.ok(g.colunas.includes('RequerNível') && g.colunas.includes('For'), 'o requisito de nível e de atributo');
  const def = GS.defDaGema(G.doSlug('Cleave_of_Rage').itemId);
  assert.ok(GS.levelDoNivel(def, 10) > 1, 'o nível 10 pede um level de personagem');
  assert.equal(GS.maximoDaGema(def), 20, 'sobe até o 20 pela própria XP');
});

test('nenhuma gema do jogo perde coluna nem nível com a tabela do poedb', { skip: SEM }, () => {
  const niveis = N.niveisDoPoedb();
  const antigas = [...JSON.parse(readFileSync(new URL('../gamedata/itens-poe/gemas-poe.json', import.meta.url), 'utf8')), ...JSON.parse(readFileSync(new URL('../gamedata/itens-poe/suportes-poe.json', import.meta.url), 'utf8'))];
  for (const g of antigas) {
    const n = niveis[g.slug];
    if (!n) continue;
    assert.ok(n.linhas.length >= g.linhas.length, `${g.slug}: níveis`);
    // (o texto EXATO do jogo: o leitor dos suportes casa a coluna com o mod pelo texto)
    for (const c of g.colunas) assert.ok(n.colunas.includes(c), `${g.slug}: a coluna "${c}"`);
  }
});

test('a habilidade da gema leva o ÍCONE DA HABILIDADE (a barra de slots desenha com ele)', { skip: SEM }, () => {
  const mapa = JSON.parse(readFileSync(new URL('../gamedata/itens-poe/icones-habilidades.json', import.meta.url), 'utf8')).icones;
  assert.ok(mapa.Cleave, 'o ícone da Cutilada');
  assert.ok(existsSync(new URL(`../gamedata/itens-poe/icones-habilidades/${mapa.Cleave}`, import.meta.url)), 'o arquivo no repositório');
  // A ação da gema (o que o cliente recebe no catálogo — \`...entry\`) traz o ícone: a barra desenha a imagem da habilidade.
  const entrada = capturadas.get(G.doSlug('Cleave').acao);
  assert.equal(entrada?.poeGema?.iconeHabilidade, mapa.Cleave);
});

