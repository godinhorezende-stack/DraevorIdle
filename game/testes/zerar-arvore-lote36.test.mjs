// ZERAR A ÁRVORE — LOTE 36 (dono, 16/10: "Toda área em metros"; a auditoria em docs/arvore-poe-auditoria.md): P002 a ÁREA DE EFEITO do PoE
// no jogo — o raio da forma × √(1 + o "aumentado") × √ de cada "mais/menos", a fração como chance de uma casa (antes, +1 casa a cada 25%,
// fosse qual fosse o raio). Vale nas gemas (as peças, a ficha e os suportes do PoE), na Repetição Final, na Intensidade, nas Runas, no
// Convocar o Aço e no golpe em área dos lacaios.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const GemasPoe = await import('../systems/itens-poe/gemas-poe.mjs');
const SP = await import('../systems/itens-poe/suportes-poe.mjs');
const Acoes = await import('../systems/acoes.mjs');
const Gerar = await import('../systems/itens-poe/gerar.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Runas = await import('../systems/itens-poe/runas-vinculadas.mjs');
const Aco = await import('../systems/itens-poe/convocar-o-aco.mjs');
const LacaiosPoe = await import('../systems/itens-poe/lacaios-poe.mjs');
const Areas = await import('../engine/areas.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  Jogo.iniciar(ITEM_CATALOG);
}

const peca = (base) => Jogo.pecaDoJogo(Gerar.gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 1, rng: () => 0.5 }));
const ANEL = Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'might ring')?.id);
function comSorte(valor, fn) {
  const antes = Math.random;
  Math.random = () => valor;
  try { return fn(); } finally { Math.random = antes; }
}
/** A Bruxa com a Nova de Gelo (a forma de raio 5, em volta de quem conjura) e os `suportes` na varinha; `longe`: monstros imortais nessas casas. */
function nova({ suportes = [], af = null, longe = [] } = {}) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 60 }), { classePoe: 'Witch' });
  const arma = peca('Wands/Driftwood_Wand');
  const n = 1 + suportes.length;
  arma.soquetes = { abertos: n, links: Array(n - 1).fill(true), gemas: Array(n).fill(null), cores: Array(n).fill('W') };
  e.equipment = { ...e.equipment, weapon: arma };
  delete e.equipment.shield;
  e.inventory = ['Ice_Nova', ...suportes].map((s) => GS.itemDaGema({ id: (GemasPoe.doSlug(s) ?? SP.doSlug(s)).itemId, nivel: 10, xp: 0, raridade: 'comum' }));
  for (let i = 0; i < n; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  if (af) e.equipment.ring = { id: ANEL, count: 1, af: [], poe: { af } };
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: GemasPoe.doSlug('Ice_Nova').acao, enabled: true, minMana: 0, conditions: [] };
  assert.equal(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok, true);
  Object.assign(e, { mana: 1e6, maxMana: 1e6 });
  const h = e.hunt;
  h.clock = 10000;
  h.monstros = h.monstros.filter((m) => !m.dummy).slice(0, 1 + longe.length);
  h.monstros.forEach((m, i) => Object.assign(m, { hp: 1e12, maxHp: 1e12, x: h.pos.x + (i ? longe[i - 1] : 1), y: h.pos.y, raridade: 'normal' }));
  return { e, h, alvo: h.monstros[0], longe: h.monstros.slice(1) };
}
/** Usa a Nova (conclui a conjuração) com o Math.random fixo; devolve quantas vezes cada monstro de `longe` foi atingido. */
function usar({ e, h, alvo, longe }, sorte) {
  const antes = longe.map((m) => m.hp);
  const acertos = longe.map(() => 0);
  comSorte(sorte, () => {
    const r = Acoes.disparar(e, h, PERSONAGEM, 0, alvo, { manual: true });
    assert.equal(r.ok, true, r.erro);
    if (h.conjurando) { h.clock = h.conjurando.fim; Acoes.concluirConjuracao(e, h, PERSONAGEM); }
  });
  longe.forEach((m, i) => { acertos[i] = m.hp < antes[i] ? 1 : 0; });
  h.clock += 5000;
  return acertos;
}

test('a linha da Repetição Final com efeito, sem a diferença', { skip: SEM }, () => {
  const t = T.traduzirMod({ modelo: 'Repetição Final das Magias têm Efeito em Área aumentado em {0}%', valores: [40] });
  assert.equal(t.estado, 'novo');
  assert.equal(t.efeitos[0].stat, 'repeticao_final_area');
});

test('a conta do PoE: o raio × √(1 + aumentado) × √(1 + mais), a fração como chance de uma casa', { skip: SEM }, () => {
  assert.equal(Areas.raioDaForma([[0, 0], [1, 0], [-2, 1]]), 2);
  assert.ok(Math.abs(ModsPoe.fatorDaArea(50, 20) - 1.8) < 1e-12, '(1 + 50%) × (1 + 20%)');
  assert.ok(Math.abs(ModsPoe.fatorDaArea(39, -30) - 1.39 * 0.7) < 1e-12);
  // a forma de 3 casas com +40%: 3 × (√1,4 − 1) = 0,55 casa — antes, 1,6
  assert.equal(ModsPoe.casasPelaArea(3, ModsPoe.fatorDaArea(40), () => 0.54), 1);
  assert.equal(ModsPoe.casasPelaArea(3, ModsPoe.fatorDaArea(40), () => 0.56), 0);
  // +100%: 3 × 0,414 = 1,24 — antes, 4
  assert.equal(ModsPoe.casasPelaArea(3, ModsPoe.fatorDaArea(100), () => 0.99), 1);
  assert.equal(ModsPoe.casasPelaArea(3, ModsPoe.fatorDaArea(100), () => 0.2), 2);
  // +300%: o raio dobra, exato
  assert.equal(ModsPoe.casasPelaArea(3, ModsPoe.fatorDaArea(300), () => 0), 3);
  // o "menos" encolhe: 3 × (√0,7 − 1) = −0,49
  assert.equal(ModsPoe.casasPelaArea(3, ModsPoe.fatorDaArea(0, -30), () => 0.48), -1);
  assert.equal(ModsPoe.casasPelaArea(3, ModsPoe.fatorDaArea(0, -30), () => 0.5), 0);
  assert.equal(ModsPoe.casasPelaArea(0, ModsPoe.fatorDaArea(100), () => 0), 0, 'sem raio, nada');
});

test('as PEÇAS e os SUPORTES em %: o "aumentado" soma e o "mais/menos" multiplica', { skip: SEM }, () => {
  const iaoe = SP.efeitoNoNivel('Increased_Area_of_Effect_Support', 10).efeito;
  const conc = SP.efeitoNoNivel('Concentrated_Effect_Support', 10).efeito;
  assert.ok(iaoe.areaIncPct > 0 && iaoe.areaExtra == null, 'Área de Efeito Aumentada: o aumentado em %');
  assert.ok(conc.areaMaisPct === -30 && conc.areaExtra == null, 'Efeito Concentrado: 30% menos');
  // (a varinha de nível 1 tem 2 encaixes: um suporte por vez)
  const entry = Acoes.POR_ID_PUBLICO(GemasPoe.doSlug('Ice_Nova').acao);
  const efeito = (suporte) => { const { e } = nova({ suportes: [suporte], af: { area_inc: 50, area_mais: 20 } }); return Acoes.comOsAlvosDaGema(entry, GS.efeitoNaSkill(e, entry.id), e); };
  const a = efeito('Increased_Area_of_Effect_Support');
  assert.ok(Math.abs(a.areaIncPct - (iaoe.areaIncPct + 50)) < 1e-9, 'o do suporte + o do anel');
  assert.ok(Math.abs(a.areaMaisPct - 20) < 1e-9);
  const c = efeito('Concentrated_Effect_Support');
  assert.ok(Math.abs(c.areaIncPct - 50) < 1e-9);
  assert.ok(Math.abs(c.areaMaisPct - (0.7 * 1.2 - 1) * 100) < 1e-9, '30% menos × 20% mais');
});

test('a FORMA estica até o raio novo e segue a mesma (o losango da Nova segue losango)', { skip: SEM }, () => {
  const forma = Acoes.POR_ID_PUBLICO(GemasPoe.doSlug('Ice_Nova').acao).forma;
  const tem = (f, x, y) => f.some(([dx, dy]) => dx === x && dy === y);
  assert.equal(Areas.raioDaForma(forma), 5);
  assert.ok(forma.every(([dx, dy]) => Math.abs(dx) + Math.abs(dy) <= 5), 'a Nova é um losango de 5');
  const maior = Areas.escalarForma(forma, 7);
  assert.equal(Areas.raioDaForma(maior), 7);
  assert.ok(tem(maior, 7, 0) && tem(maior, 0, -7) && tem(maior, 4, 3) && !tem(maior, 4, 4) && !tem(maior, 5, 5), 'o losango de 7');
  const menor = Areas.escalarForma(forma, 4);
  assert.ok(tem(menor, 4, 0) && !tem(menor, 5, 0) && tem(menor, 2, 2) && !tem(menor, 3, 2), 'o losango de 4 (o `mudar` tirava duas no eixo)');
  assert.deepEqual(Areas.escalarForma(forma, 0), [[0, 0]]);
  assert.equal(Areas.escalarForma(forma, 5), forma);
});

// (17/10, lote G2 — o dono: "Aplicar raio do PoE") a Nova de Gelo nível 10 tem o raio do PoE — "O raio Base é de 2.8 metros" = 1,4 casa: a
// forma de 1 casa, ou de 2 com 40% de chance (`Acoes.formaNoRaioDoPoe`) — no lugar das 5 casas da magia-molde. A conta da área é a mesma.
test('P002 — a Nova de Gelo (1,4 casa no PoE) com +100% de área: o raio × √2 (a fração é a chance de uma casa a mais)', { skip: SEM }, () => {
  const cena = (sorte) => usar(nova({ af: { area_inc: 100 }, longe: [2, 3, 4] }), sorte);
  // sorte 0,5: a forma de 1 casa; 1 × (√2 − 1) = 0,41 de casa a mais — o sorteio 0,5 não a pega
  assert.deepEqual(cena(0.5), [0, 0, 0], 'o raio 1');
  // sorte 0,41: a forma de 1 casa (0,41 ≥ 0,4) e a fração 0,414 pega a casa 2
  assert.deepEqual(cena(0.41), [1, 0, 0], 'a fração de 1 × (√2 − 1) alcança a 2');
  // sorte 0,05: a forma de 2 casas (os 40%) e 2 × (√2 − 1) = 0,83 → a 3
  assert.deepEqual(cena(0.05), [1, 1, 0], 'a forma de 2 + 0,83 → a 3; a 4, não');
  assert.deepEqual(usar(nova({ longe: [2, 3] }), 0.05), [1, 0], 'sem a área: o raio 2');
  // o Efeito Concentrado (30% menos): 2 × (√0,7 − 1) = −0,33 → o raio 1 (no sorteio 0,05)
  assert.deepEqual(usar(nova({ suportes: ['Concentrated_Effect_Support'], longe: [2] }), 0.05), [0]);
});

test('P002 — a REPETIÇÃO FINAL soma o X no aumentado da última repetição (o Eco de Magia)', { skip: SEM }, () => {
  // +100% e a Repetição Final de 40% (sorte 0,5, a forma de 1 casa): 1 × (√2 − 1) = 0,41 nas outras (não pega a 2), 1 × (√2,4 − 1) = 0,55 na
  // última (pega)
  const cena = (af) => usar(nova({ suportes: ['Spell_Echo_Support'], af, longe: [2, 3] }), 0.5);
  assert.deepEqual(cena({ area_inc: 100 }), [0, 0], 'sem a linha: o raio 1');
  assert.deepEqual(cena({ area_inc: 100, repeticao_final_area: 40 }), [1, 0], 'a última repetição alcança a 2');
});

test('P002 — as RUNAS, o CONVOCAR O AÇO e o golpe em área dos LACAIOS pela mesma conta', { skip: SEM }, () => {
  // "Runas têm Área de Efeito aumentada em 30% caso 50% da Duração do Vínculo tenha expirado": o 30% vai para o aumentado do uso
  const b = { uid: 'b', x: 1, y: 0, hp: 10, maxHp: 10 };
  const r = { id: 1, acao: 'x', slot: 0, x: 1, y: 0, alvo: 'b', em: 0, proxima: 0, vinculadaPassou: 3000, vinculadaMs: 4000, soltaPassou: 0, soltaMs: 4000, intervaloMs: 1000 };
  const fichaDaRuna = { afPoe: { runa_area_tardia_pct: 30, runa_area_tardia_apos: 50 } };
  assert.equal(Runas.tique({ clock: 0, monstros: [b], runas: [{ ...r }] }, fichaDaRuna, 0).ativar[0].areaPct, 30);
  assert.equal(Runas.tique({ clock: 0, monstros: [b], runas: [{ ...r, vinculadaPassou: 1000 }] }, fichaDaRuna, 0).ativar[0].areaPct, 0, 'antes dos 50%');
  // o Convocar o Aço: a chamada de 6 casas e o reflexo de 1, com +100%
  const f = { afPoe: { area_inc: 100 } };
  assert.equal(Aco.raioDaChamada(f, () => 0.99), 8, '6 × √2 = 8,49');
  assert.equal(Aco.raioDaChamada(f, () => 0), 9);
  assert.equal(Aco.raioDoReflexo(f, () => 0.99), 1, '1 × √2 = 1,41');
  assert.equal(Aco.raioDoReflexo(f, () => 0), 2);
  assert.equal(Aco.raioDaChamada({ afPoe: {} }, () => 0), 6);
  // o lacaio: 1 casa × √(1 + "Lacaios têm Efeito em Área aumentado")
  assert.equal(LacaiosPoe.raioDaAreaDoLacaio({ poe: { areaPct: 100 } }, () => 0.99), 1);
  assert.equal(LacaiosPoe.raioDaAreaDoLacaio({ poe: { areaPct: 100 } }, () => 0), 2);
  assert.equal(LacaiosPoe.raioDaAreaDoLacaio({ poe: { areaPct: 300 } }, () => 0.99), 2, '+300%: o raio dobra');
});
