// (08/11 — o dono: "continue resolvendo os itens") as APROXIMADAS dos únicos, lotes A1 e A2: as defesas locais das peças de armadura, o Golpe de
// Misericórdia contra Amaldiçoados (caía na regra dos Incendiados), as janelas "nos últimos N segundos" e a recuperação "ao longo de N segundos".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const Condicoes = await import('../systems/itens-poe/condicoes-poe.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');

if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
}
const tr = (modelo, valores = []) => T.traduzirMod({ modelo, valores });
/** A base Normal com os mods dados (`[modelo, valor]`). */
function comMods(base, mods) {
  const g = gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 84, rng: () => 0.5 });
  g.raridade = 'magico';
  g.prefixos = mods.map(([modelo, v]) => ({ texto: modelo.replace('{0}', v), modelo, valores: [v] }));
  return J.pecaDoJogo(g);
}

test('A1: no Peitoral, o "+X de Armadura" e o "% aumentada" são locais — (base + X) × (1 + %); no amuleto, o "+X" segue global', { skip: SEM }, () => {
  const p = comMods('Body_Armours/Glorious_Plate', [['+{0} de Armadura', 50], ['Armadura aumentada em {0}%', 100]]);
  const base = p.poe.atributos.armadura;
  assert.deepEqual(p.base.armor, [(base + 50) * 2, (base + 50) * 2]);
  assert.equal(p.poe.af.armor_flat, undefined);
  assert.equal(p.poe.af.armour_pct, undefined);
  assert.deepEqual(p.poe.estados, ['equivalente', 'equivalente']);
  // (o "Escudo de Energia MÁXIMO aumentado" é global no PoE, mesmo na armadura)
  const es = comMods('Body_Armours/Glorious_Plate', [['Escudo de Energia máximo aumentado em {0}%', 10]]);
  assert.equal(es.poe.af.es_pct, 10);
  const amuleto = comMods('Amulets/Paua_Amulet', [['+{0} de Armadura', 50]]);
  assert.equal(amuleto.poe.af.armor_flat, 50);
  assert.equal(amuleto.base?.armor, undefined);
});

test('A1: o "+X" local entra na peça sem a defesa na base (a Evasão numa armadura de placas)', { skip: SEM }, () => {
  const p = comMods('Body_Armours/Glorious_Plate', [['+{0} de Evasão', 40], ['Evasão aumentada em {0}%', 50]]);
  assert.deepEqual(p.base.evasion, [60, 60]);
  assert.equal(p.poe.af.evasion, undefined);
});

test('A2: Golpe de Misericórdia contra Amaldiçoados não é mais o dos Incendiados', () => {
  assert.deepEqual(tr('Você tem Golpe de Misericórdia contra Inimigos Amaldiçoados').efeitos.map((e) => e.stat), ['culling@alvoAmaldicoado']);
  assert.deepEqual(tr('Golpe de Misericórdia contra Inimigos Incendiados').efeitos.map((e) => e.stat), ['culling@alvoIncendiado']);
});

test('A2: "nos últimos N segundos" é a janela de N segundos (não os 4 s do Recentemente)', { skip: SEM }, () => {
  const r = tr('+{0}% ao Multiplicador de Dano Degenerativo se você tiver causado um Golpe Crítico nos últimos {1} segundos', [55, 8]);
  assert.deepEqual(r.efeitos.map((e) => [e.stat, e.valor]), [['dot_multi@nosUltimos:8:critico', 55]]);
  const h = { clock: 100_000, poeRecente: { critico: 100_000 - 6000 } };
  const conds = Object.assign(new Set(), { parametros: { estado: { hunt: h }, total: {}, principais: {} } });
  assert.equal(Condicoes.vale(conds, 'nosUltimos:8:critico'), true, '6 s atrás: dentro dos 8 (o Recentemente, 4 s, já teria passado)');
  h.poeRecente.critico = 100_000 - 9000;
  assert.equal(Condicoes.vale(conds, 'nosUltimos:8:critico'), false);
});

test('A2: "Regenera X de Vida por 1 segundo" vem ao longo do segundo, não de uma vez', () => {
  assert.deepEqual(tr('Regenera {0} da Vida por {1} segundo quando você Conjurar uma Magia', [8, 1]).efeitos.map((e) => [e.stat, e.valor]), [['ev:usarMagia:vidaAoLongo:1', 8]]);
  const h = { clock: 1000 };
  const e = { hp: 100, maxHp: 1000 };
  Condicoes.recuperarAoLongo(h, 'hp', 80, 1000, 1000);
  Condicoes.tique(e, h, { afPoe: {} }, 250, 1500);
  assert.equal(e.hp, 140, 'metade no meio do segundo');
  Condicoes.tique(e, h, { afPoe: {} }, 250, 2500);
  assert.equal(e.hp, 180, 'o resto no fim, e não mais');
  assert.equal(h.poeAoLongo, undefined);
});
