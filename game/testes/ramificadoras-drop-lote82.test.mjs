// LOTE 82 — as RAMIFICADORAS no DROP (dono, 18/10: "Só nos mapas"): no PoE elas caem do Delirium e do Simulacro, que o jogo não tem; aqui caem no
// loot comum do Item Level 68 para cima (o endgame) — as Normais, Mágicas e Raras pelo gerador delas (sem pool; até 2 Prefixos e 2 Sufixos), e as
// Únicas —; abaixo dele e no baú inicial, não. A peça que cai é Ramificadora (monta os nós no encaixe de expansão).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
await (await import('../systems/itens-poe/iniciar.mjs')).iniciarJogoDoPoe();
const J = await import('../systems/itens-poe/jogo.mjs');
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
if (!SEM) J.iniciar(ITEM_CATALOG);
const rngDe = (s) => { let x = s; return () => ((x = (x * 16807) % 2147483647) / 2147483647); };
const RAMIFICADORA = /^Jewels\/(?:Large|Medium|Small)_Cluster_Jewel$/;

test('as Ramificadoras caem do Item Level 68 para cima (Normais, Mágicas, Raras e Únicas), como Ramificadoras; abaixo, não', { skip: SEM }, () => {
  const rng = rngDe(17);
  const vistas = { normal: 0, magico: 0, raro: 0, unico: 0 };
  let nos68 = 0;
  let comuns = 0;
  for (let i = 0; i < 15_000; i++) {
    const p = J.pecaSorteada(84, rng);
    if (p?.poe && /^Jewels\//.test(p.poe.base) && !RAMIFICADORA.test(p.poe.base)) comuns++;
    if (!p?.poe || !RAMIFICADORA.test(p.poe.base)) continue;
    vistas[p.poe.raridade]++;
    assert.ok(p.poe.ramificadora?.tamanho, `${p.poe.base} ${p.poe.raridade}: Ramificadora`);
    assert.ok(p.poe.prefixos.length <= 2 && p.poe.sufixos.length <= 2);
    nos68++;
  }
  assert.ok(nos68 > 0 && vistas.normal > 0 && vistas.magico > 0 && vistas.raro > 0, JSON.stringify(vistas));
  // (dono: "As 3 valem uma base") as três juntas têm a vaga de UMA base: ~1/3 das 3 joias comuns (Carmesim, Viridiana, Cobalto)
  assert.ok(nos68 / comuns > 0.2 && nos68 / comuns < 0.5, `${nos68} Ramificadoras / ${comuns} joias comuns`);
  for (let i = 0; i < 6_000; i++) {
    const p = J.pecaSorteada([10, 40, 67][i % 3], rng);
    assert.ok(!(p?.poe && RAMIFICADORA.test(p.poe.base)), `caiu no Item Level baixo: ${p?.poe?.base}`);
  }
  // as ÚNICAS no drop (o peso só com o Único: o caminho da Única): as três bases, Ramificadoras únicas
  const soUnico = { ...Catalogo.REGRAS, drop: { ...Catalogo.REGRAS.drop, raridades: { unico: 1 } } };
  for (const t of ['Large', 'Medium', 'Small']) {
    const u = J.pecaSorteada(84, rngDe(3), soUnico, 0, `Jewels/${t}_Cluster_Jewel`);
    assert.equal(u?.poe?.raridade, 'unico', t);
    assert.equal(u.poe.ramificadora?.unico, true, t);
    if (t === 'Medium') assert.equal(u.poe.modificadores.filter((m) => m.notavel).length, 3, 'o Megalomaníaco com os 3 notáveis');
  }
});

test('o Loot Filter: o mod da Ramificadora conta como T1 (um tier só, como no PoE)', { skip: SEM }, async () => {
  const Afixos = await import('../systems/afixos.mjs');
  const p = J.pecaSorteada(84, rngDe(9), { ...Catalogo.REGRAS, drop: { ...Catalogo.REGRAS.drop, raridades: { raro: 1 } } }, 0, 'Jewels/Large_Cluster_Jewel');
  assert.equal(p?.poe?.raridade, 'raro');
  assert.equal(Afixos.melhorTierPoe(p), 1);
});

test('o baú inicial não dá Ramificadora; o Item Level mínimo é 68', { skip: SEM }, async () => {
  const rng = rngDe(5);
  for (let i = 0; i < 3000; i++) assert.ok(!RAMIFICADORA.test(J.pecaDoBauInicial(rng)?.poe?.base ?? ''));
  assert.equal(J.caiNoNivel('Jewels/Large_Cluster_Jewel', 67), false);
  assert.equal(J.caiNoNivel('Jewels/Large_Cluster_Jewel', 68), true);
  assert.equal(J.caiNoNivel('Jewels/Crimson_Jewel', 1), true);
});
