// (08/11 — o dono: "continue até os tooltips dos itens únicos derem 0 sem efeito") lotes B1–B5: as partes internas do item viram o efeito delas, os MODS SORTEADOS
// dos únicos saem do pool do poedb (`linhas-sorteadas.json`: 'faixa' e 'composicao' novos) e as linhas desses pools têm regra.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
}
const tr = (modelo, valores = []) => T.traduzirMod({ modelo, valores });
function unico(slug) {
  for (const cl of Object.values(Catalogo.catalogo().classes)) {
    const u = (cl.unicos ?? []).find((x) => x.slug === slug);
    if (u) return { u, base: cl.bases.find((b) => b.nome === u.base) };
  }
  return null;
}
/** As peças geradas do único (N sorteios), com o estado de cada linha. */
function sorteios(slug, n = 25) {
  const { base } = unico(slug);
  let s = 11;
  const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: n }, () => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: base.id, raridade: 'unico', ilvl: 84, rng, unico: slug }), Catalogo.REGRAS, rng));
}
const linhasDe = (p) => [...(p.poe.implicitos ?? []), ...(p.poe.prefixos ?? []), ...(p.poe.sufixos ?? []), ...(p.poe.modificadores ?? [])];

test('B1: as partes internas viram o efeito (a Tabula: sem requisitos, sem o Escudo da base, seis ligados e brancos)', { skip: SEM }, () => {
  assert.deepEqual(tr('local unique tabula rasa no requirement or energy shield [{0}]', [1]).efeitos.map((e) => e.stat), ['sem_requisitos', 'sem_es_da_base']);
  assert.deepEqual(tr('local six linked white sockets [{0}]', [1]).efeitos.map((e) => e.stat), ['encaixes_ligados', 'encaixes_brancos']);
  assert.deepEqual(tr('base should have unholy might [{0}]', [1]).efeitos.map((e) => e.stat), ['sempre:poderProfano']);
  const [p] = sorteios('Tabula_Rasa', 1);
  assert.equal(p.soquetes.links.every(Boolean), true, 'seis ligados');
  assert.ok(p.soquetes.cores.every((c) => c === 'W'), 'brancos');
});

test('B2–B5: os mods sorteados saem do pool e nenhuma linha fica sem efeito (fora a Síntese dos Círculos, que é da fase dos sistemas)', { skip: SEM }, () => {
  for (const slug of ['Auls_Uprising', 'Screams_of_the_Desiccated', 'Tombfist', 'Cinderswallow_Urn', 'Circle_of_Guilt', 'Circle_of_Fear', 'Circle_of_Nostalgia', 'Precursors_Emblem']) {
    for (const p of sorteios(slug)) {
      const ls = linhasDe(p);
      // (a marcação dos implícitos de Síntese dos Círculos é da fase dos sistemas — a Síntese)
      assert.ok(!ls.some((m) => /^\[/.test(m.texto) && !/synthesis/i.test(m.texto)), `${slug}: a marcação "[...]" saiu`);
      ls.forEach((m, k) => {
        if (/Sintetizador/.test(m.texto)) return;
        assert.ok(!['inerte', 'registrado'].includes(p.poe.estados[k]), `${slug}: ${m.texto} → ${p.poe.estados[k]}`);
      });
    }
  }
});

test('a quantidade pela faixa ("1-2 Random Shrine Buff") e a composição do Precursor ("Two Endurance … and one Power")', { skip: SEM }, () => {
  const gritos = sorteios('Screams_of_the_Desiccated', 40).map((p) => linhasDe(p).filter((m) => m.sorteada).length);
  assert.ok(gritos.every((n) => n >= 1 && n <= 2) && gritos.includes(1) && gritos.includes(2), JSON.stringify(gritos));
  const { u } = unico('Precursors_Emblem');
  assert.deepEqual(u.linhasSorteadas.composicao['[Two Endurance Charge mods and one Power Charge Mod]'], [['tolerancia', 2], ['poder', 1]]);
});

test('as frases novas: a escala "por Carga de X" e as condições', () => {
  assert.deepEqual(tr('+{0}% de Chance de Bloquear o Dano de Ataques por Carga de Frenesi', [1]).efeitos.map((e) => e.stat), ['block%carga:frenesi']);
  assert.deepEqual(tr('Você possui Reflexos de Ferro enquanto no máximo de Cargas de Frenesi').efeitos.map((e) => e.stat), ['keystone:reflexosDeFerro@cargasMax:frenesi']);
  assert.deepEqual(tr('Recebe Agressividade por {0} segundos ao Acertar enquanto no Máximo de Cargas de Frenesi', [4]).efeitos.map((e) => e.stat), ['ev:acertar:buff:agressividade@cargasMax:frenesi']);
  assert.deepEqual(tr('Você tem o bônus do Altar Diamante, se não estiver sob o efeito de frascos').efeitos.map((e) => e.stat), ['sempre:altarDiamante@semFrasco']);
});

test('B6, a Autoridade do Triunvirato: os efeitos do anel só nas gemas VAAL encaixadas nele (gema_local → o af: do uso)', { skip: SEM }, async () => {
  const GS = await import('../systems/skills/gemas.mjs');
  const anel = { poe: { af: { 'gema_local:acertos_ignoram_res@vaal': 1, 'gema_local:efeitoAuraPct@vaal': 50, 'gema_local:vaal_almas_menos@vaal': 30 } } };
  const def = (nome) => [...GS.DEFS.values()].find((d) => d.tipo === 'ativa' && (d.poe?.slug === nome || d.nome === nome));
  assert.deepEqual(GS.extrasDaGemaPoe(null, anel, def('Cutilada Vaal')).af, { acertos_ignoram_res: 1, efeitoAuraPct: 50, vaal_almas_menos: 30 });
  assert.equal(GS.extrasDaGemaPoe(null, anel, def('Cyclone')).af, undefined, 'a gema não-Vaal não leva');
  for (const [m, stat] of [['Acertos de Habilidades Vaal Encaixadas ignoram as Resistências dos Monstros Inimigos', 'gema_local:acertos_ignoram_res@vaal'], ['Habilidades Vaal Encaixadas requerem {0}% menos Almas por Uso', 'gema_local:vaal_almas_menos@vaal'], ['Habilidades Vaal Encaixadas causam {0}% mais Dano', 'mais_dano_local@vaal']]) {
    assert.deepEqual(tr(m, [30]).efeitos.map((e) => e.stat), [stat], m);
  }
});

test('B7, as Arbalistas da Marcha de Vorana: os efeitos lacaio_tipo:arbalista só na Arbalista (as chances novas e os projéteis a mais)', { skip: SEM }, async () => {
  const LacaiosPoe = await import('../systems/itens-poe/lacaios-poe.mjs');
  const af = { 'lacaio_tipo:arbalista:minion_chance_intimidar': 25, 'lacaio_tipo:arbalista:minion_extra_projectiles': 3, 'lacaio_tipo:arbalista:minion_perfurar': 2, 'lacaio_tipo:arbalista:minion_chance_congelar': 10 };
  const arb = LacaiosPoe.oQueInvoca('Summon_Arbalists', 20, null, af);
  assert.ok(arb, 'a Convocar Arbalistas invoca');
  assert.equal(arb.poe.chances.intimidar, 25);
  assert.equal(arb.poe.chances.congelar, 10);
  assert.deepEqual(arb.poe.projeteisExtra, { alvosExtras: 3, perfurar: 2, bifurcar: 0, encadear: 0, divisao: 0 });
  const zumbi = LacaiosPoe.oQueInvoca('Raise_Zombie', 20, null, af);
  assert.equal(zumbi.poe.chances.intimidar, 0, 'o Zumbi não é Arbalista');
  assert.equal(zumbi.poe.projeteisExtra, undefined);
});
