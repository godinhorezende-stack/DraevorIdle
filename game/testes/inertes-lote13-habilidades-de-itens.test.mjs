// (07/11, lote 13 das inertes — dono: "Importar e fazer à mão") as HABILIDADES que só os únicos concedem viram gemas OCULTAS (`soDoItem`,
// `gamedata/itens-poe/habilidades-de-itens.json`): existem pela peça ("Concede a Habilidade…", "Ativa… quando…"), mas não caem, não são vendidas e não saem da
// Lente do Lapidário; a linha do único segue o status da habilidade no jogo (sem comportamento: inerte com o motivo; em parte: aproximada, com o que falta).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
await import('./apoio.mjs');
const Gemas = await import('../systems/skills/gemas.mjs');
const GemasPoe = await import('../systems/itens-poe/gemas-poe.mjs');
const Traduzir = await import('../systems/itens-poe/traduzir.mjs');
const { ITEM_CATALOG } = await import('../systems/dados.mjs');

const t = (texto) => {
  const nums = [];
  const modelo = texto.replace(/-?\d+(?:[.,]\d+)?/g, (m) => { nums.push(Number(m)); return `{${nums.length - 1}}`; });
  return Traduzir.traduzirMod({ modelo, valores: nums });
};
const ocultas = () => [...Gemas.DEFS.values()].filter((d) => d.soDoItem);

test('as habilidades de item estão no jogo como gemas ocultas (a peça as concede pelo nome)', { skip: SEM }, () => {
  assert.ok(ocultas().length >= 40, String(ocultas().length));
  const raio = Gemas.ativaPeloNome('disparo-eletrico');
  assert.ok(raio?.soDoItem);
  assert.equal(ITEM_CATALOG[raio.itemId].poeGema.soDoItem, true);
  assert.equal(GemasPoe.doSlug('Lightning_Bolt').statusNoJogo, 'funciona', 'o gatilho é da peça');
});

test('as ocultas não caem, não são vendidas, não se compram e não saem da Lente', { skip: SEM }, () => {
  const so = new Set(ocultas().map((d) => d.itemId));
  for (let i = 0; i < 400; i++) {
    let k = i;
    const rng = () => ((k = (k * 16807 + 7) % 2147483647) / 2147483647);
    const g = Gemas.sortearDrop({ ato: 10, levelDaFase: 100, fatorDeChance: 1e9 }, rng);
    if (g) assert.ok(!so.has(g.id), `caiu ${g.id}`);
  }
  const loja = Gemas.catalogoDaLoja({ level: 100, sistema: 'poe' });
  for (const x of loja.gemas ?? loja ?? []) assert.ok(!so.has(x.id));
  const oculta = ocultas()[0];
  const r = Gemas.comprarNaLoja({ gold: 1e12, bank: 0, inventory: [] }, { id: oculta.itemId });
  assert.equal(r.ok, false);
});

test('a linha do único segue o status: a que funciona tem efeito; a sem comportamento fica inerte com o motivo; a parcial, aproximada', { skip: SEM }, () => {
  assert.notEqual(t('Ativa Disparo Elétrico Nível 30 quando você causar um Golpe Crítico').estado, 'inerte');
  const inveja = t('Concede a Habilidade Inveja nível 25');
  if (GemasPoe.doSlug('Envy').statusNoJogo === 'nao') { assert.equal(inveja.estado, 'inerte'); assert.match(inveja.nota ?? inveja.partes?.[0]?.nota ?? '', /só os únicos a concedem/); }
  else assert.notEqual(inveja.estado, 'inerte');
});
