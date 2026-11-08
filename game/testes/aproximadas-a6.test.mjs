// (08/11 — o dono: "CONTINUE") as APROXIMADAS dos únicos, lote A6: a Carícia Vaal ("-N ao Nível de Gemas Não-Vaal Encaixadas") não tira das gemas Vaal.
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = !Catalogo.ligado() && 'só no modo PoE';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
}

test('a Carícia Vaal: −5 nas gemas não-Vaal encaixadas; as Vaal ficam', { skip: SEM }, () => {
  const t = T.traduzirMod({ modelo: '{0} ao Nível de Gemas Não-Vaal Encaixadas', valores: [-5] });
  assert.deepEqual(t.efeitos.map((e) => [e.stat, e.valor]), [['gem_level_local@naoVaal', -5]]);
  assert.equal(t.estado, 'equivalente');
  const peca = { poe: { af: { 'gem_level_local@naoVaal': -5 } } };
  const def = (slugOuNome) => [...GS.DEFS.values()].find((d) => d.tipo === 'ativa' && (d.poe?.slug === slugOuNome || d.nome === slugOuNome));
  assert.equal(GS.extrasDaGemaPoe(null, peca, def('Cyclone')).nivel, -5, 'o Ciclone');
  assert.equal(GS.extrasDaGemaPoe(null, peca, def('Cutilada Vaal')).nivel, 0, 'a Cutilada Vaal');
});

test('"Amaldiçoa Inimigos com X ao Acertar/Bloquear": a maldição no nível 1, como o PoB (ModParser: triggerExtraSkill(skill, 1))', { skip: SEM }, () => {
  assert.deepEqual(T.traduzirMod({ modelo: 'Amaldiçoa Inimigos com Vulnerabilidade ao Acertar', valores: [] }).efeitos.map((e) => e.stat), ['ev:acertar:maldicao:vulnerabilidade:1']);
});

test('a Luz de Lunaris: o "+X% de Multiplicador de Crítico" vale com um acerto NÃO Crítico recente (o crítico não conta)', { skip: SEM }, async () => {
  const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
  const t = T.traduzirMod({ modelo: '+{0}% de Multiplicador de Crítico se você causou um Golpe Não Crítico Recentemente', valores: [25] });
  assert.deepEqual(t.efeitos.map((e) => [e.stat, e.valor]), [['crit_dmg@nosUltimos:4:naoCritico', 25]]);
  const h = { clock: 10_000, poeRecente: { critico: 10_000 } };
  const conds = (hunt) => Object.assign(new Set(), { parametros: { estado: { hunt }, total: {}, principais: {} } });
  assert.equal(ModsPoe.vale(conds(h), 'nosUltimos:4:naoCritico'), false, 'só o crítico');
  h.poeRecente.naoCritico = 8000;
  assert.equal(ModsPoe.vale(conds(h), 'nosUltimos:4:naoCritico'), true);
});
