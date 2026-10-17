// LOTE 65 — as RAMIFICADORAS, as linhas das PEQUENAS (o encantamento e os "também concedem" da peça): as 84 que podem sair na peça passam a ter
// efeito pelo tradutor da árvore — o português do poedb nos mods da joia ("+3 de Vida Máxima", "de Todos os Atributos", "por Segundo"), o Dano
// Degenerativo de UM tipo (Caos no Veneno, Físico no Sangramento, o degenerativo das gemas do elemento), "enquanto (você for) afetado por um
// Arauto" (a condição `afetadoPorArauto`: uma gema de Arauto ligada), a velocidade de ataque e conjuração por tipo de habilidade… E o relatório
// conta só o que pode sair na peça (sem os mods e notáveis dos encantamentos descontinuados).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
await (await import('../systems/itens-poe/iniciar.mjs')).iniciarJogoDoPoe();
const A = await import('../systems/itens-poe/arvore.mjs');
const Afeccoes = await import('../systems/itens-poe/afeccoes.mjs');
const C = await import('../systems/itens-poe/condicoes-poe.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');

const efeitos = (linha) => Object.fromEntries(A.traduzirLinha(linha).efeitos.map((e) => [e.add, e.valor]));

test('as linhas das pequenas com efeito: o português do poedb e as mecânicas do jogo', { skip: SEM }, () => {
  assert.deepEqual(efeitos('+3 de Vida Máxima'), { life: 3 });
  assert.deepEqual(efeitos('+11 de Escudo de Energia Máximo'), { energy_shield: 11 });
  assert.deepEqual(efeitos('+2 de Todos os Atributos'), { str: 2, dex: 2, int: 2 });
  assert.deepEqual(efeitos('Regenera 0.2% de Vida por Segundo'), { life_regen_max_pct: 0.2 });
  assert.deepEqual(efeitos('Lacaios Regeneram 0.15% de Vida por Segundo'), { minion_regen_pct: 0.15 });
  assert.deepEqual(efeitos('Dano de Caos Degenerativo aumentado em 12%'), { dot_dmg_inc_caos: 12 });
  assert.deepEqual(efeitos('Velocidade de Ataque e Conjuração com Habilidades de Fogo aumentada em 3%'), { 'atk_speed@fogo': 3, 'cast_speed_tag@fogo': 3 });
  assert.deepEqual(efeitos('Velocidade de Arremesso de Armadilha e Mina aumentada em 2%'), { 'cast_speed_tag@armadilha': 2, 'cast_speed_tag@mina': 2 });
  assert.deepEqual(efeitos('Lacaios têm Velocidade de Ataque e Conjuração aumentada em 2% enquanto você for afetado por um Arauto'), { 'minion_atk_speed@afetadoPorArauto': 2, 'minion_cast_speed@afetadoPorArauto': 2 });
  assert.deepEqual(efeitos('+2% de Multiplicador de Golpes Críticos'), { crit_dmg: 2 });
});

test('o RELATÓRIO: nenhuma linha das pequenas sem efeito; só o que pode sair na peça', { skip: SEM }, async () => {
  const { linhasDasRamificadoras } = await import('../tools/relatorio-arvore-poe.mjs');
  const { grupos, sem } = await linhasDasRamificadoras(Catalogo.catalogo());
  assert.equal(grupos.encantamento.sem, 0, JSON.stringify(sem.filter((x) => x.grupo === 'encantamento')));
  assert.equal(grupos.tambem.sem, 0, JSON.stringify(sem.filter((x) => x.grupo === 'tambem')));
  // os mods dos encantamentos descontinuados (a Área das Auras, a dos Feitiços) não saem na peça: fora da conta
  assert.ok(!sem.some((x) => /Habilidades de Aura|Habilidades Feitiço/.test(x.linha)));
});

test('o DANO DEGENERATIVO de um tipo: Caos no Veneno, Físico no Sangramento, e o do elemento nas gemas', { skip: SEM }, () => {
  const a = Afeccoes.daSoma({ dot_dmg_inc_caos: 12, dot_dmg_inc_fisico: 10, dot_dmg_inc_gelo: 8, poison_dmg_inc: 5, bleed_dmg_inc: 3 });
  assert.equal(a.danoVeneno, 17);
  assert.equal(a.danoSangramento, 13);
  assert.deepEqual(a.danoDegenDoElemento, { chaos: 12, physical: 10, ice: 8 });
});

test('"enquanto afetado por um Arauto": a condição vale com uma gema de Arauto ligada', { skip: SEM }, () => {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 60 });
  e.sistema = 'poe';
  e.hunt = { clock: 1000, pos: { x: 0, y: 0 }, monstros: [], buffs: {} };
  assert.ok(!C.condicoesDe(e).has('afetadoPorArauto'));
  e.hunt.buffs['poe-gema:Herald_of_Ice'] = { tipo: 'poe-arauto', ate: 5000 };
  assert.ok(C.condicoesDe(e).has('afetadoPorArauto'));
  e.hunt.buffs['poe-gema:Herald_of_Ice'].ate = 500;
  assert.ok(!C.condicoesDe(e).has('afetadoPorArauto'), 'o Arauto desligado');
  assert.ok(C.ehCondDeEstado('afetadoPorArauto'));
});
