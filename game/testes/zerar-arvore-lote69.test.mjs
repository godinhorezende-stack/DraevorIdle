// LOTE 69 — as RAMIFICADORAS, os NOTÁVEIS (a 4ª parte): 57 → 42 sem efeito. Os LACAIOS: os "criados Recentemente" (os primeiros 4 s — o
// movimento, as velocidades e "não podem sofrer Dano"), o Dano Dobrado em Vida Cheia, o dano contra Incendiados, o Empurrar, o movimento por
// Arauto, e por TIPO (os Esqueletos convertem para Caos e Definham, os Zumbis Provocam, as Sentinelas recarregam mais rápido). Os INIMIGOS:
// os Incendiados com −X% de Resistência a Fogo, os Envenenados sem regeneração, as Magias de Caos que Desaceleram. E as exceções do dono (17/10):
// "Inafetado por Solo Congelado" e "Punição pode afetar…" — não se aplicam.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
await (await import('../systems/itens-poe/iniciar.mjs')).iniciarJogoDoPoe();
const A = await import('../systems/itens-poe/arvore.mjs');
const L = await import('../systems/itens-poe/lacaios-poe.mjs');
const Afeccoes = await import('../systems/itens-poe/afeccoes.mjs');
const C = await import('../systems/itens-poe/condicoes-poe.mjs');

const efeitos = (linha) => Object.fromEntries(A.traduzirLinha(linha).efeitos.map((e) => [e.add, e.valor]));

test('as linhas dos lacaios e dos inimigos; as 2 exceções do dono como "não se aplica"', { skip: SEM }, () => {
  assert.deepEqual(efeitos('Lacaios criados Recentemente não podem sofrer Dano'), { minion_invulneravel_recente: 1 });
  assert.deepEqual(efeitos('Esqueletos Convocados possuem 30% do Dano Físico Convertido para Dano de Caos'), { 'lacaio_conv_caos:esqueleto': 30 });
  assert.deepEqual(efeitos('Lacaios têm Velocidade de Movimento aumentada em 10% para cada Arauto afetando você'), { 'minion_move%arautosAtivos': 10 });
  assert.deepEqual(efeitos('Inimigos Incendiados por você têm -5% de Resistêcia a Fogo'), { res_menos_fogo_incendiado: -5 });
  assert.deepEqual(efeitos('Magias de Caos têm 10% de chance de Desacelerar Inimigos ao Acertar'), { 'chance_desacelerar@magia+caos': 10 });
  for (const l of ['Inafetado por Solo Congelado', 'Punição pode afetar Inimigos Infeitiçáveis']) {
    const t = A.traduzirLinha(l);
    assert.equal(t.estado, 'inerte', l);
    assert.match(t.nota, /^não se aplica ao jogo:/, l);
  }
});

test('os LACAIOS: os criados Recentemente (4 s), o Dano Dobrado em Vida Cheia, o dano contra Incendiados, por tipo', { skip: SEM }, () => {
  const l = { nome: 'Esqueleto', hp: 100, maxHp: 100, desde: 1000, poe: { velRecentePct: 10, movimentoRecentePct: 30, movimentoPct: 5, invulneravelRecente: 1, danoDobradoVidaCheia: 100, danoContraIncendiadosPct: 20 } };
  assert.equal(L.criadoRecentemente(l, 4999), true);
  assert.equal(L.criadoRecentemente(l, 5001), false);
  assert.equal(L.velocidadeDoLacaio(l, 2000), 10);
  assert.equal(L.velocidadeDoLacaio(l, 6000), 0);
  assert.equal(L.movimentoDoLacaio(l, 2000), 35);
  assert.equal(L.movimentoDoLacaio(l, 6000), 5);
  assert.equal(L.danoNoLacaio(l, { fisico: 50, agora: 2000 }).dano, 0, 'criado há pouco: não sofre dano');
  assert.ok(L.danoNoLacaio(l, { fisico: 50, agora: 6000 }).dano > 0);
  const alvo = { estados: {}, dots: [] };
  assert.equal(L.golpeDoLacaio(l, alvo, {}, 'physical', 2000, () => 0).fator, 2, 'Vida Cheia: Dano Dobrado');
  l.hp = 50;
  assert.equal(L.golpeDoLacaio(l, alvo, {}, 'physical', 2000, () => 0).fator, 1);
  alvo.dots.push({ tipo: 'queimadura', falta: 10 });
  assert.ok(Math.abs(L.golpeDoLacaio(l, alvo, {}, 'physical', 2000, () => 0).fator - 1.2) < 1e-9, 'contra Incendiado: +20%');
  // por TIPO: o Esqueleto converte o Físico em Caos e Definha; o Zumbi não
  const esqueleto = L.oQueInvoca('Summon_Skeletons', 1, null, { 'lacaio_conv_caos:esqueleto': 30, 'lacaio_definhar:esqueleto': 10, 'lacaio_provocar:zumbi': 5 });
  assert.equal(esqueleto.conversao?.chaos, 30);
  assert.equal(esqueleto.poe.chances.definhar, 10);
  assert.equal(esqueleto.poe.chances.provocar, 0);
  const zumbi = L.oQueInvoca('Raise_Zombie', 1, null, { 'lacaio_conv_caos:esqueleto': 30, 'lacaio_provocar:zumbi': 5 });
  assert.equal(zumbi.poe.chances.provocar, 5);
  assert.ok(!(zumbi.conversao?.chaos > 0));
});

test('os INIMIGOS: o Incendiado com −X% de Resistência a Fogo; o Envenenado sem regeneração', { skip: SEM }, () => {
  const a = Afeccoes.daSoma({ res_menos_fogo_incendiado: -5, envenenados_sem_regen: 1, chance_ignite: 100, chance_poison: 100 });
  assert.equal(a.resMenosFogoIncendiado, 5);
  assert.equal(a.envenenadosSemRegen, true);
  const bicho = { uid: 1, hp: 1000, maxHp: 1000, estados: {}, dots: [] };
  Afeccoes.aoAcertar(bicho, [{ elemento: 'fire', dano: 100 }, { elemento: 'chaos', dano: 100 }], { afeccoes: a, agora: 1000, rng: () => 0 });
  assert.equal(C.resMenosDasAfeccoes(bicho, 1000, 'fire'), 5, 'Incendiado: −5% de Fogo');
  assert.equal(C.resMenosDasAfeccoes(bicho, 1000, 'ice'), 0);
  assert.equal(bicho.estados.semRegenEnvenenado, true);
});

test('o RELATÓRIO: os notáveis sem efeito caem para no máximo 42', { skip: SEM }, async () => {
  const { linhasDasRamificadoras } = await import('../tools/relatorio-arvore-poe.mjs');
  const { grupos } = await linhasDasRamificadoras(Catalogo.catalogo());
  assert.ok(grupos.notavel.sem <= 42, `${grupos.notavel.sem}`);
});
