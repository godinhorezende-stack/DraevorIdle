// LOTE 66 — as RAMIFICADORAS, os NOTÁVEIS (a 1ª parte): as linhas que ligam mecânicas que o jogo já tem (o crítico, o bloqueio, as cargas, os
// "Recentemente", os Arautos, a Canalização, o Dreno, o Totem, as afecções…) passam a ter efeito — 209 → 129 sem efeito. E as condições de
// ARMA EM QUALQUER MÃO do PoE ("enquanto portando uma Garra ou Adaga", "Machados ou Espadas", "Maça, Cetro ou Cajado"): a mão secundária
// também conta (as `comX` são da mão principal), sem contar duas vezes. O Impelido (que existe agora) com o Dano Dobrado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
await (await import('../systems/itens-poe/iniciar.mjs')).iniciarJogoDoPoe();
const A = await import('../systems/itens-poe/arvore.mjs');
const C = await import('../systems/itens-poe/condicoes-poe.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');

const efeitos = (linha) => Object.fromEntries(A.traduzirLinha(linha).efeitos.map((e) => [e.add, e.valor]));

test('os notáveis com mecânica que o jogo já tem: as linhas traduzidas', { skip: SEM }, () => {
  assert.deepEqual(efeitos('+15% de Multiplicador de Golpes Críticos com Garras ou Adagas'), { 'crit_dmg@comGarraOuAdaga': 15 });
  assert.deepEqual(efeitos('Dano Elemental aumentado em 25% enquanto afetado por um Arauto'), { 'fire_dmg@afetadoPorArauto': 25, 'ice_dmg@afetadoPorArauto': 25, 'energy_dmg@afetadoPorArauto': 25 });
  assert.deepEqual(efeitos('Velocidade de Ataque aumentada em 10% caso você tenha ao menos 600 de Força'), { 'atk_speed@atrMin:str:600': 10 });
  assert.deepEqual(efeitos('Dano de Gelo aumentado em 1% por cada 25 de Inteligência'), { 'ice_dmg%atr:int:25': 1 });
  assert.deepEqual(efeitos('Recupera 2% de Vida ao Matar um Inimigo Resfriado'), { 'ev:matar:vidaPct@alvoResfriado': 2 });
  assert.deepEqual(efeitos('Você tem Agressividade se Convocou um Totem Recentemente'), { 'sempre:agressividade@usouTag:totem': 1 });
  // (o português do poedb: "Velociade", "Bloquar", "Canalizanndo", "Recenemente")
  assert.deepEqual(efeitos('Velociade de Movimento aumentada em 5% caso você tenha causado um Golpe Crítico Recentemente'), { 'move_speed@criticoRecente': 5 });
  assert.deepEqual(efeitos('+5% de Chance de Bloquar o Dano de Ataques enquanto Canalizando'), { 'block@canalizando': 5 });
  // o Impelido existe: a regra antiga que pegava toda linha de "Impelido" como inerte vem depois
  assert.deepEqual(efeitos('Ataques Impelidos têm 8% de chance de causar Dano Dobrado'), { 'chance_dano_dobrado@impelido': 8 });
});

test('a ARMA EM QUALQUER MÃO: Garra ou Adaga, Machado ou Espada, Maça/Cetro/Cajado — a secundária também conta', { skip: SEM }, () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 60 });
  e.sistema = 'poe';
  const arma = (classe) => ({ id: 1, poe: { classe, base: `${classe}/x` } });
  e.equipment = { weapon: arma('One_Hand_Swords'), shield: arma('Claws') };
  let v = C.condicoesDe(e);
  assert.ok(v.has('comGarraOuAdaga'), 'a Garra na secundária');
  assert.ok(v.has('comMachadoOuEspada'), 'a Espada na principal');
  assert.ok(!v.has('comMacaCetroOuCajado'));
  e.equipment = { weapon: arma('Staves') };
  v = C.condicoesDe(e);
  assert.ok(v.has('comMacaCetroOuCajado'));
  assert.ok(!v.has('comGarraOuAdaga') && !v.has('comMachadoOuEspada'));
  for (const c of ['comGarraOuAdaga', 'comMachadoOuEspada', 'comMacaCetroOuCajado']) assert.ok(C.ehCondDeEstado(c), c);
});

test('o RELATÓRIO: os notáveis sem efeito caem de 209 para no máximo 129', { skip: SEM }, async () => {
  const { linhasDasRamificadoras } = await import('../tools/relatorio-arvore-poe.mjs');
  const { grupos } = await linhasDasRamificadoras(Catalogo.catalogo());
  assert.ok(grupos.notavel.sem <= 129, `${grupos.notavel.sem}`);
  assert.equal(grupos.encantamento.sem + grupos.tambem.sem, 0);
});
