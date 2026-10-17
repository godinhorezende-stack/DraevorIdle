// LOTE 68 — as RAMIFICADORAS, os NOTÁVEIS (a 3ª parte): 86 → 57 sem efeito. As afecções contra o ALVO (o golpe refaz as afecções com as tags
// dele e do alvo — "Dano com Incêndios infligidos em Inimigos Amaldiçoados", "Sangramento em Inimigos Mutilados"…), a tag `alvoComAfeccao`
// ("contra Inimigos afetados por Afecções"), "Canalizado por ao menos N segundo" (`canalizandoHa:N`), "durante o Efeito do Frasco de Vida",
// "foi Congelado/Eletrizado/Incendiado Recentemente" (a imunidade por 4 s, o "Recentemente" do PoE), o crítico de Arauto recentemente.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
await (await import('../systems/itens-poe/iniciar.mjs')).iniciarJogoDoPoe();
const A = await import('../systems/itens-poe/arvore.mjs');
const C = await import('../systems/itens-poe/condicoes-poe.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');

const efeitos = (linha) => Object.fromEntries(A.traduzirLinha(linha).efeitos.map((e) => [e.add, e.valor]));

test('as linhas: afecções contra o alvo, "foi X Recentemente", a Canalização, o crítico de Arauto', { skip: SEM }, () => {
  assert.deepEqual(efeitos('Dano com Incêndios infligidos em Inimigos Amaldiçoados aumentado em 30%'), { 'ignite_dmg_inc@alvoAmaldicoado': 30 });
  assert.deepEqual(efeitos('Dano com Acertos e Afecções contra Inimigos afetados por Afecções aumentado em 20%'), { 'dmg_inc@alvoComAfeccao': 20, 'ailment_dmg_inc@alvoComAfeccao': 20 });
  assert.deepEqual(efeitos('Você não pode ser Congelado se você foi Congelado Recentemente'), { imune_apos_congelamento: 4 });
  assert.deepEqual(efeitos('Ganhe Fúria Arcana após Canalizar por 1 segundo'), { 'sempre:furiaArcana@canalizandoHa:1': 1 });
  assert.deepEqual(efeitos('+20% de Multiplicador de Golpes Críticos caso você tenha Canalizado por ao menos 1 segundo'), { 'crit_dmg@canalizandoHa:1': 20 });
  assert.deepEqual(efeitos('+15% de Multiplicador de Golpes Críticos caso você tenha causado um Golpe Crítico com uma Habilidade Arauto Recentemente'), { 'crit_dmg@nosUltimos:4:critico:arauto': 15 });
  assert.deepEqual(efeitos('Inimigos mortos por seus Acertos com Varinhas têm chance de 10% de Explodir, causando um quarto de sua Vida como Dano de Caos'), { 'ev:matar:explodirChance:25:chaos@comVarinha': 10 });
});

test('as condições: Canalizando há N s, durante o Frasco de Vida, o crítico de Arauto recentemente', { skip: SEM }, () => {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 60 });
  e.sistema = 'poe';
  e.hunt = { clock: 10_000, pos: { x: 0, y: 0 }, monstros: [], buffs: {}, poeRecente: {}, canalizacao: { acao: 'x', desde: 9_500, ate: 10_500 } };
  assert.equal(C.vale(C.condicoesDe(e), 'canalizandoHa:1'), false, 'há 0,5 s');
  e.hunt.canalizacao.desde = 8_900;
  assert.equal(C.vale(C.condicoesDe(e), 'canalizandoHa:1'), true);
  e.hunt.canalizacao.ate = 9_000;
  assert.equal(C.vale(C.condicoesDe(e), 'canalizandoHa:1'), false, 'parou de canalizar');
  assert.ok(!C.condicoesDe(e).has('duranteFrascoVida'));
  e.hunt.frascosPoe = { ativos: { 0: { recurso: 'vida', ate: 12_000 } } };
  assert.ok(C.condicoesDe(e).has('duranteFrascoVida'));
  assert.ok(!C.condicoesDe(e).has('duranteFrascoMana'));
  // o crítico de uma habilidade de Arauto marca o "recentemente"
  const ficha = { afPoe: {}, porTag: [], tagsDoGolpe: ['arauto', 'magia'] };
  ModsPoe.aoAcertar(e, e.hunt, { uid: 3, hp: 100, maxHp: 100, x: 1, y: 0, estados: {} }, ficha, { crit: true, rng: () => 0.99 });
  assert.equal(C.vale(C.condicoesDe(e), 'nosUltimos:4:critico:arauto'), true);
});

test('a tag do alvo com Afecção ("contra Inimigos afetados por Afecções")', { skip: SEM }, () => {
  const agora = 5000;
  const alvo = (estados = {}, dots = []) => ({ uid: 1, hp: 50, maxHp: 100, estados, dots });
  assert.ok(!C.tagsDoAlvo(alvo(), agora).includes('alvoComAfeccao'));
  assert.ok(C.tagsDoAlvo(alvo({ lento: { ate: 9000 } }), agora).includes('alvoComAfeccao'), 'Resfriado');
  assert.ok(C.tagsDoAlvo(alvo({}, [{ tipo: 'sangramento', falta: 10 }]), agora).includes('alvoComAfeccao'), 'Sangrando');
  assert.ok(C.ehCondDeEstado('duranteFrascoVida'));
});

test('o RELATÓRIO: os notáveis sem efeito caem para no máximo 57', { skip: SEM }, async () => {
  const { linhasDasRamificadoras } = await import('../tools/relatorio-arvore-poe.mjs');
  const { grupos } = await linhasDasRamificadoras(Catalogo.catalogo());
  assert.ok(grupos.notavel.sem <= 57, `${grupos.notavel.sem}`);
});
