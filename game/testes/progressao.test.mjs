import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmp = mkdtempSync(join(tmpdir(), 'prog-'));
process.env.DRAEVOR_OVERRIDES = tmp; // overrides DESTE processo ficam na pasta temporária (nunca os do dono)
after(() => rmSync(tmp, { recursive: true, force: true }));

const P = await import('../systems/progressao.mjs');
const C = await import('../systems/itens/config.mjs');
const G = await import('../systems/itens/gerar.mjs');
const S = await import('../systems/itens/simulador-de-loot.mjs');
const Adm = await import('../admin/overrides-progressao.mjs');
const Http = await import('../admin/conteudo-http.mjs');
const A = await import('../admin/acesso.mjs');
const { ITEM_CATALOG, CATALOGO } = await import('../systems/dados.mjs');
const { criarEstrategias } = await import('../systems/hot-reload-estrategias.mjs');
const { criarVerificacoes } = await import('../admin/validacao-verificacoes.mjs');

const TABELA = [[1, 1, 100, [1, 2]], [2, 101, 200, [2, 3]], [3, 201, 300, [3, 4]], [4, 301, 400, [4, 5]], [5, 401, 500, [5, 6]], [6, 501, 600, [6, 7]], [7, 601, 700, [7, 8]], [8, 701, 800, [8, 9]], [9, 801, 900, [9, 10]], [10, 901, 1000, [10, 11]]];
const copia = (o) => JSON.parse(JSON.stringify(o));
const cfg = () => ({ progressao: copia(P.EM_USO.progressao), dificuldades: copia(P.EM_USO.dificuldades), loot: copia(P.EM_USO.loot) });
const NEUTRO = { chanceDeDrop: 1, pesosDeRaridade: {}, chanceDeModificadorExtra: 0, pesosDeTier: {}, tierMaximo: null };
const BASE_COM_POOL = Number(Object.values(ITEM_CATALOG).find((i) => i.slot === 'weapon' && i.skill === 'sword' && G.aceitaAtributos(i.id) && (i.minLevel ?? 0) > 0)?.id);

test('PG1. a tabela de progressão: 10 Atos, level 1–1000, tiers T1–T2 … T10–T11 — a MESMA para Normal, Cruel e Merciless; a faixa independe da dificuldade', () => {
  assert.equal(P.nivelMaximo(), 1000);
  assert.equal(P.atos().length, 10);
  for (const [ato, de, ate, tiers] of TABELA) {
    const f = P.faixaDoAto(ato);
    assert.deepEqual([f.ato, f.de, f.ate, f.tiers], [ato, de, ate, tiers], `Ato ${ato}`);
    assert.equal(P.atoDoNivel(de), ato); assert.equal(P.atoDoNivel(ate), ato);
    assert.equal(P.tierDaBase(de), tiers[0]); assert.equal(P.tierDaBase(ate), tiers.at(-1));
  }
  assert.equal(P.faixaDoAto.length, 1, 'a consulta da faixa não recebe dificuldade: é compartilhada');
  assert.equal(P.atoDoNivel(1000), 10); assert.equal(P.tierDaBase(1000), 11);
  assert.equal(P.atoDoNivel(1001), null, 'acima do level 1000 não existe Ato de equipamento');
  assert.equal(P.atoDoNivel(0), null); assert.equal(P.atoDoNivel(3000), null);
  assert.equal(P.faixaDoAto(11), null);
  // os dados de fábrica não têm nada acima de 1000 nem faixas por dificuldade
  const original = JSON.parse(readFileSync(new URL('../gamedata/progressao.json', import.meta.url), 'utf8'));
  assert.equal(Math.max(...original.progressao.atos.map((a) => a.ate)), 1000);
  assert.deepEqual(Object.keys(original.progressao.atos[0]).sort(), ['ate', 'ato', 'de', 'tiers']);
  assert.deepEqual(Object.keys(original.dificuldades), ['facil', 'medio', 'dificil']);
  assert.deepEqual(P.EM_USO.dificuldades, { facil: { nome: 'Normal' }, medio: { nome: 'Cruel' }, dificil: { nome: 'Merciless' } });
});

test('PG2. progressão e dificuldade são DIMENSÕES SEPARADAS: o loot é por dificuldade e neutro de fábrica; a progressão não tem campo de dificuldade', () => {
  for (const d of P.DIFICULDADES) assert.deepEqual(P.lootDa(d), NEUTRO, d);
  assert.deepEqual(P.lootDa('qualquer'), NEUTRO, 'dificuldade desconhecida = Normal');
  assert.ok(!JSON.stringify(P.EM_USO.progressao).includes('facil') && !JSON.stringify(P.EM_USO.progressao).includes('dificil'), 'a progressão não menciona dificuldade');
  assert.equal(P.fatorDeDropDe('dificil', BASE_COM_POOL), 1);
});

test('PG3. validações: level acima de 1000, faixas inconsistentes, tiers declarados errados, estágio de raridade, dificuldade sem loot, chances inválidas, pesos zerados, tierMaximo e tabela de tiers', () => {
  const v = (mut) => { const c = cfg(); mut(c); return P.validarConfiguracao(c); };
  assert.deepEqual(v(() => {}).erros, []);
  assert.match(v((c) => { c.progressao.nivelMaximoDeEquipamento = 2000; }).erros.join(' '), /passa do limite de 1000.*Cruel e Merciless não criam levels novos/);
  assert.match(v((c) => { c.progressao.atos[9].ate = 1500; }).erros.join(' '), /Ato 10 vai até o level 1500/);
  assert.match(v((c) => { c.progressao.atos[3].de = 305; }).erros.join(' '), /Ato 4 começa no level 305, mas devia ser 301/);
  assert.match(v((c) => { c.progressao.atos[2].ate = 350; }).erros.join(' '), /começa no level 301|devia ser 351/);
  assert.match(v((c) => { c.progressao.atos[1].tiers = [2, 4]; }).erros.join(' '), /Ato 2 declara os tiers T2–T4.*dá T2–T3/);
  assert.match(v((c) => { c.progressao.atos[0].ato = 7; }).erros.join(' '), /numerado 7/);
  assert.match(v((c) => { c.progressao.estagioDeRaridade['4'] = 1; }).erros.join(' '), /nunca cai ao avançar de Ato/);
  assert.match(v((c) => { c.progressao.estagioDeRaridade['4'] = 9; }).erros.join(' '), /estágio de raridade de 1 a 4/);
  assert.match(v((c) => { delete c.loot.dificil; }).erros.join(' '), /falta a configuração da dificuldade dificil/);
  assert.match(v((c) => { delete c.dificuldades.medio; }).erros.join(' '), /falta a dificuldade medio/);
  assert.match(v((c) => { c.loot.medio.chanceDeDrop = 0; }).erros.join(' '), /chanceDeDrop/);
  assert.match(v((c) => { c.loot.medio.chanceDeDrop = -1; }).erros.join(' '), /chanceDeDrop/);
  assert.match(v((c) => { c.loot.medio.chanceDeDrop = 99; }).erros.join(' '), /chanceDeDrop/);
  assert.match(v((c) => { c.loot.medio.chanceDeModificadorExtra = 1.5; }).erros.join(' '), /entre 0 e 1/);
  assert.match(v((c) => { c.loot.medio.pesosDeRaridade = { azul: 2 }; }).erros.join(' '), /peso de raridade inválido \(azul/);
  assert.match(v((c) => { c.loot.medio.pesosDeRaridade = { raro: -1 }; }).erros.join(' '), /peso de raridade inválido/);
  assert.match(v((c) => { c.loot.medio.pesosDeRaridade = Object.fromEntries(P.RARIDADES.map((r) => [r, 0])); }).erros.join(' '), /todos os pesos de raridade são 0/);
  assert.match(v((c) => { c.loot.medio.pesosDeTier = { 9: 2 }; }).erros.join(' '), /peso de tier inválido/);
  assert.match(v((c) => { c.loot.medio.pesosDeTier = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }; }).erros.join(' '), /todos os pesos de tier são 0/);
  assert.match(v((c) => { c.loot.medio.tierMaximo = 7; }).erros.join(' '), /tierMaximo/);
  assert.match(v((c) => { c.loot.extra = {}; }).erros.join(' '), /"extra" não é uma dificuldade/);
  assert.match(v((c) => { c.progressao.tiersDeModificador = { itemLevel: [{ ate: 100, tiers: [1, 2] }, { ate: 50, tiers: [1, 2, 3] }, { ate: null, tiers: [1] }] }; }).erros.join(' '), /precisa crescer|nunca cai/);
  assert.match(v((c) => { c.progressao.tiersDeModificador = { itemLevel: [{ ate: 100, tiers: [1, 2, 3, 4] }, { ate: null, tiers: [1, 2] }] }; }).erros.join(' '), /nunca cai com o level/);
  assert.match(v((c) => { c.progressao.tiersDeModificador = { itemLevel: [{ ate: 100, tiers: [1, 9] }, { ate: null, tiers: [1, 2] }] }; }).erros.join(' '), /inteiros de 1 a 5/);
  assert.match(v((c) => { c.progressao.tiersDeModificador = { itemLevel: [{ ate: 100, tiers: [1] }, { ate: 500, tiers: [1, 2] }] }; }).erros.join(' '), /da última faixa precisa ser vazio/);
  assert.match(v((c) => { c.progressao.tier.deslocamento = 100; }).erros.join(' '), /tier precisa de/);
});

test('PG4. avisos (não bloqueiam): dificuldade inferior mais vantajosa, e os 49 equipamentos do catálogo acima do level 1000 (exceções do craft)', () => {
  const c = cfg(); c.loot.facil.chanceDeDrop = 2; c.loot.medio.chanceDeModificadorExtra = 0;
  c.loot.facil.chanceDeModificadorExtra = 0.2;
  const r = P.validarConfiguracao(c, { catalogo: ITEM_CATALOG, distribuicao: (d) => ({ raroOuMelhor: d === 'facil' ? 0.5 : 0.1 }) });
  assert.deepEqual(r.erros, []);
  const txt = r.avisos.join(' | ');
  assert.match(txt, /Normal tem chance de drop de equipamento \(2×\) maior que Cruel/);
  assert.match(txt, /Normal dá mais chance de modificador extra/);
  assert.match(txt, /Normal tem mais chance de item raro ou melhor.*dificuldade inferior ficou mais vantajosa/);
  assert.match(txt, /equipamento\(s\) do catálogo exigem level acima de 1000.*Crafted.*exceções intencionais/);
  const acima = Object.values(ITEM_CATALOG).filter((i) => i.slot && !i.stackable && (i.minLevel ?? 0) > 1000);
  assert.ok(acima.length > 0 && acima.every((i) => /^Crafted /.test(i.name)), 'os únicos acima de 1000 são peças de craft');
  assert.equal(P.atoDoNivel(acima[0].minLevel), null);
  assert.ok(!P.basesDoAto(10, { incluirCraft: true, limite: 100000 }).bases.some((b) => b.minLevel > 1000), 'nenhuma base de Ato passa de 1000');
});

test('PG5. neutro de fábrica: o gerador devolve EXATAMENTE os mesmos itens de antes (mesma semente), com ou sem a configuração explícita', () => {
  const run = (extra) => Array.from({ length: 1500 }, (_, i) => { const rng = S.criarRng(1000 + i); return G.gerarItem({ itemId: BASE_COM_POOL, ato: 1 + (i % 4), dificuldade: P.DIFICULDADES[i % 3], itemLevel: 20 + (i * 7) % 900, boss: i % 11 === 0, rng, ...extra }); });
  assert.deepEqual(run({}), run({ lootConfig: NEUTRO }));
});

test('PG6. a DIFICULDADE influencia o gerador real: pesos de raridade, +1 modificador, pesos e teto de tier, e a chance de drop só de EQUIPAMENTO', () => {
  const contar = (cfgDoLoot, n = 6000, extra = {}) => { const m = { raridade: {}, mods: 0, tiers: {}, itens: [] }; for (let i = 0; i < n; i++) { const it = G.gerarItem({ itemId: BASE_COM_POOL, ato: 3, dificuldade: 'medio', itemLevel: 700, rng: S.criarRng(i + 1), lootConfig: { ...NEUTRO, ...cfgDoLoot }, ...extra }); m.itens.push(it); const r = it.raridade ?? 'comum'; m.raridade[r] = (m.raridade[r] ?? 0) + 1; m.mods += it.af?.length ?? 0; for (const a of it.af ?? []) m.tiers[a.nivel] = (m.tiers[a.nivel] ?? 0) + 1; } return m; };
  const base = contar({});
  const mitico = contar({ pesosDeRaridade: { mítico: 5000 } });
  assert.ok((mitico.raridade['mítico'] ?? 0) > 100 * (base.raridade['mítico'] ?? 0.1), `mítico ${base.raridade['mítico'] ?? 0} → ${mitico.raridade['mítico']}`);
  const so1 = contar({ tierMaximo: 1 });
  assert.deepEqual(Object.keys(so1.tiers), ['1'], 'tierMaximo 1: só T1');
  const sem5 = contar({ pesosDeTier: { 5: 0 } });
  assert.ok(!sem5.tiers[5]);
  const alto = contar({ pesosDeTier: { 1: 0.0001, 2: 0.0001, 3: 0.0001, 4: 50 } }, 3000);
  assert.ok((alto.tiers[4] ?? 0) > 0.9 * Object.values(alto.tiers).reduce((a, b) => a + b, 0), 'pesos puxam para o tier alto (T4 é o maior que o level 700 libera)');
  assert.ok(!alto.tiers[5], 'T5 não é liberado nesse Item Level, mesmo com peso');
  const extra = contar({ chanceDeModificadorExtra: 1 });
  assert.ok(extra.mods > base.mods * 1.3, `+1 modificador: ${base.mods} → ${extra.mods}`);
  for (const it of extra.itens) assert.ok((it.af?.length ?? 0) <= Math.max(...Object.keys(C.RARIDADES.raridades[it.raridade ?? 'comum'].atributos).map(Number)) + 1, 'nunca passa do teto da raridade + 1');
  // chance de drop: só equipamento
  P.comConfiguracao({ ...cfg(), loot: { ...cfg().loot, dificil: { ...NEUTRO, chanceDeDrop: 3 } } }, () => {
    assert.equal(P.fatorDeDropDe('dificil', BASE_COM_POOL), 3);
    assert.equal(P.fatorDeDropDe('dificil', 3031), 1, 'moeda não muda');
    assert.equal(P.fatorDeDropDe('medio', BASE_COM_POOL), 1, 'outra dificuldade não muda');
  });
  assert.equal(P.fatorDeDropDe('dificil', BASE_COM_POOL), 1, 'a configuração provisória foi desfeita');
});

test('PG7. a dificuldade NÃO libera mais do que o Item Level libera: pesos/teto de tier só inclinam entre os tiers que o level já permite', () => {
  const tiersDoLevel = C.tiersLiberados(50);
  for (let i = 0; i < 4000; i++) {
    const it = G.gerarItem({ itemId: BASE_COM_POOL, ato: 1, dificuldade: 'dificil', itemLevel: 50, rng: S.criarRng(i + 1), lootConfig: { ...NEUTRO, pesosDeTier: { 5: 1000, 4: 1000 }, chanceDeModificadorExtra: 1, pesosDeRaridade: { mítico: 100 } } });
    for (const a of it.af ?? []) assert.ok(tiersDoLevel.includes(a.nivel), `tier ${a.nivel} acima do liberado (${tiersDoLevel}) no level 50`);
  }
  assert.deepEqual(C.tiersLiberados(50, [{ ate: null, tiers: [1, 2, 3] }]), [1, 2, 3], 'a tabela da progressão remapeia o desbloqueio');
});

test('PG8. elegibilidade: modificador nunca aparece em base incompatível nem acima do Item Level (milhares de itens, todas as dificuldades e slots)', () => {
  const slots = ['weapon', 'shield', 'head', 'body', 'legs', 'feet', 'ring', 'neck'];
  let conferidos = 0;
  for (const slot of slots) {
    const bases = Object.values(ITEM_CATALOG).filter((i) => i.slot === slot && !i.stackable && G.aceitaAtributos(i.id)).slice(0, 12);
    for (const b of bases) for (const d of P.DIFICULDADES) for (let k = 0; k < 15; k++) {
      const il = [1, 80, 250, 600, 900][k % 5];
      const it = G.gerarItem({ itemId: b.id, ato: 1 + (k % 4), dificuldade: d, itemLevel: il, rng: S.criarRng(b.id * 31 + k), lootConfig: { ...NEUTRO, chanceDeModificadorExtra: 1, pesosDeRaridade: { mítico: 50, lendário: 50 } } });
      if (!it.af?.length) continue;
      const pool = G.poolDe(b.id, { itemLevel: il, raridade: it.raridade, base: it.base });
      for (const a of it.af) { assert.ok(pool.includes(a.id), `${a.id} não é elegível em ${b.name} (${slot}) no level ${il}`); conferidos++; }
      assert.equal(new Set(it.af.map((a) => a.id)).size, it.af.length, 'sem modificador repetido');
    }
  }
  assert.ok(conferidos > 2000, `${conferidos} modificadores conferidos`);
  // defesa que a base não tem não sai (armadura sem evasion/es)
  const semEvasao = Object.values(ITEM_CATALOG).find((i) => i.slot === 'body' && G.aceitaAtributos(i.id) && !(i.armor > 0));
  if (semEvasao) for (let k = 0; k < 200; k++) { const it = G.gerarItem({ itemId: semEvasao.id, ato: 1, dificuldade: 'dificil', itemLevel: 500, rng: S.criarRng(k), lootConfig: { ...NEUTRO, chanceDeModificadorExtra: 1 } }); for (const a of it.af ?? []) assert.ok(!['armor_flat', 'armour_pct'].includes(a.id), 'armadura sem Armour não rola add de Armour'); }
});

test('PG9. Atos 1, 5 e 10 nas três dificuldades: mesma faixa e mesmos tiers; distribuição teórica soma 1; Normal < Cruel < Merciless em itens raros; nível 1000 tratado', () => {
  for (const ato of [1, 5, 10]) {
    const r = P.DIFICULDADES.map((d) => S.resumoAnalitico({ ato, dificuldade: d }));
    assert.deepEqual(new Set(r.map((x) => x.itemLevel)).size, 1, `Ato ${ato}: o Item Level é o mesmo nas dificuldades`);
    for (const x of r) { assert.ok(Math.abs(Object.values(x.raridade).reduce((a, b) => a + b, 0) - 1) < 1e-9); assert.ok(Math.abs(Object.values(x.tiersFracao).reduce((a, b) => a + b, 0) - 1) < 1e-9); }
    assert.ok(r[0].raroOuMelhor < r[1].raroOuMelhor && r[1].raroOuMelhor < r[2].raroOuMelhor, `Ato ${ato}: ${r.map((x) => x.raroOuMelhor.toFixed(3))}`);
    assert.deepEqual(P.faixaDoAto(ato).tiers, TABELA[ato - 1][3]);
  }
  assert.equal(S.itemLevelDoAto(10), 951);
  assert.ok(S.resumoAnalitico({ ato: 10, dificuldade: 'dificil', itemLevel: 1000 }).raroOuMelhor > 0, 'level 1000');
  assert.equal(P.estagioDeRaridadeDoAto(1), 1); assert.equal(P.estagioDeRaridadeDoAto(5), 3); assert.equal(P.estagioDeRaridadeDoAto(10), 3);
});

test('PG10. o SIMULADOR: determinístico por semente, a amostra bate com a teoria, usa o gerador real, cobre monstro e hunt, avisa quando o Ato não tem bases, e a proposta é simulada sem ser aplicada', () => {
  const a = S.simular({ ato: 5, dificuldade: 'medio', n: 4000, semente: 99 });
  const b = S.simular({ ato: 5, dificuldade: 'medio', n: 4000, semente: 99 });
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.raridade, S.simular({ ato: 5, dificuldade: 'medio', n: 4000, semente: 100 }).raridade);
  for (const ato of [1, 5]) for (const d of P.DIFICULDADES) { const r = S.simular({ ato, dificuldade: d, n: 40000, semente: 5 }); assert.ok(Math.abs(r.raroOuMelhor - r.teorica.raridade.raroOuMelhor) < 0.012, `Ato ${ato} ${d}: amostra ${r.raroOuMelhor.toFixed(4)} × teoria ${r.teorica.raridade.raroOuMelhor.toFixed(4)}`); }
  const alto = S.simular({ ato: 10, dificuldade: 'facil', n: 500, semente: 1 });
  assert.equal(alto.basesUsadas.fallback, true, 'o catálogo não tem bases no Ato 10');
  assert.equal(alto.semBase, 0);
  assert.equal(S.compararDificuldades({ ato: 2, n: 500 }).dificuldades.length, 3);
  const m = S.simularMonstro({ monstro: 'troll', ato: 1, dificuldade: 'facil', abates: 3000, semente: 3 });
  assert.equal(m.ok, true);
  assert.ok(m.equipamentosPorAbate > 0 && m.basesDoLoot > 0);
  assert.equal(S.simularMonstro({ monstro: 'nao-existe' }).ok, false);
  const hunt = S.simularHunt({ huntId: 'troll-cave', ato: 1, dificuldade: 'dificil', abates: 2000, semente: 3 });
  assert.equal(hunt.ok, true);
  assert.ok(hunt.equipamentosPorAbate > 0);
  assert.equal(S.simularHunt({ huntId: 'nao-existe' }).ok, false);
  // proposta simulada com o gerador real, sem aplicar
  const antes = copia(P.EM_USO);
  const proposta = cfg(); proposta.loot.medio = { ...NEUTRO, chanceDeModificadorExtra: 1, pesosDeTier: { 3: 5 } };
  const normal = S.simular({ ato: 7, dificuldade: 'medio', n: 3000, semente: 8 });
  const comProposta = P.comConfiguracao(proposta, () => S.simular({ ato: 7, dificuldade: 'medio', n: 3000, semente: 8 }));
  assert.ok(comProposta.mediaDeModificadores > normal.mediaDeModificadores * 1.3);
  assert.deepEqual(P.EM_USO, antes, 'a configuração em uso voltou ao que era');
  assert.throws(() => P.comConfiguracao(proposta, () => { throw new Error('x'); }), /x/);
  assert.deepEqual(P.EM_USO, antes, 'mesmo se a simulação lançar');
});

test('PG11. bases por Ato: só equipamento cujo level mínimo cai na faixa (independe da dificuldade); craft fora; slot/tier/contagens; level incompatível nunca entra', () => {
  for (const ato of [1, 3, 5]) {
    const b = P.basesDoAto(ato, { limite: 100000 });
    const f = P.faixaDoAto(ato);
    assert.ok(b.total > 0);
    for (const x of b.bases) { assert.ok(x.minLevel <= f.ate && (ato === 1 || x.minLevel >= f.de), `${x.nome} nv ${x.minLevel} no Ato ${ato}`); assert.ok(f.tiers.includes(x.tier), `tier ${x.tier} fora de ${f.tiers}`); assert.ok(!/^Crafted /.test(x.nome)); }
    assert.equal(Object.values(b.porSlot).reduce((s, n) => s + n, 0), b.total);
  }
  assert.ok(P.basesDoAto(1, { slot: 'ring', limite: 100000 }).bases.every((x) => x.slot === 'ring'));
  assert.equal(P.basesDoAto(99), null);
  assert.equal(P.basesDoAto(10).total, 0, 'o catálogo importado não tem peça no Ato 10');
  const todas = new Set(); for (let a = 1; a <= 10; a++) for (const x of P.basesDoAto(a, { limite: 100000 }).bases) { assert.ok(!todas.has(x.id), 'uma base pertence a UM Ato só'); todas.add(x.id); }
});

test('PG12. boss e hunt: o boss usa a tabela da dificuldade de cima mas o loot CONFIGURADO da dificuldade do conteúdo; o drop de equipamento da caçada consulta o fator da dificuldade; peça garantida do boss segue funcionando', async () => {
  const { origemDoDrop } = G;
  assert.deepEqual(origemDoDrop({ ato: 2, dificuldade: 'facil', boss: true }), { ato: '2', dificuldade: 'medio' }, 'degrau do boss inalterado');
  const forte = { ...NEUTRO, pesosDeRaridade: { mítico: 100000 } };
  const normalBoss = Array.from({ length: 300 }, (_, i) => G.gerarItem({ itemId: BASE_COM_POOL, ato: 2, dificuldade: 'facil', boss: true, origem: 'boss', itemLevel: 200, rng: S.criarRng(i), lootConfig: forte }));
  assert.ok(normalBoss.filter((x) => x.raridade === 'mítico').length > 280, 'a config da dificuldade do conteúdo vale também para o boss');
  const { pecasGarantidas } = await import('../systems/itens/equipamento-do-boss.mjs');
  const pecas = pecasGarantidas({ ato: 4, dificuldade: 'dificil', itemLevel: 380 }, 'knight', S.criarRng(4));
  assert.equal(pecas.length, 3, 'o equipamento garantido do boss de Ato segue valendo');
  const combate = readFileSync(new URL('../systems/hunt/combate.mjs', import.meta.url), 'utf8');
  assert.match(combate, /chance \* Progressao\.fatorDeDropDe\(contextoDoDrop\(hunt\)\.dificuldade, drop\.id\)/);
  assert.match(combate, /gerarItem\(\{ itemId: drop\.id, \.\.\.contextoDoDrop\(hunt\), raridadeDoMob/);
  assert.ok(CATALOGO.bestiary.troll.loot.length > 0, 'os drops cadastrados do monstro seguem intactos');
});

test('PG13. overrides: o arquivo de fábrica nunca é editado; salvar grava só a DIFERENÇA, valida antes, tem prévia de impacto, versões, restaurar, desligar, conflito (409)', () => {
  const fabrica = readFileSync(new URL('../gamedata/progressao.json', import.meta.url), 'utf8');
  assert.equal(Adm.obter().revisao, 'ausente');
  const invalido = Adm.propor({ loot: { medio: { chanceDeDrop: -3 } } });
  assert.equal(invalido.ok, false);
  assert.match(invalido.erros[0], /chanceDeDrop/);
  assert.equal(Adm.propor({ campoInventado: 1 }).ok, false);
  assert.equal(Adm.propor(null).ok, false);
  const ov = { ativo: true, loot: { dificil: { chanceDeDrop: 1.2, chanceDeModificadorExtra: 0.1, pesosDeTier: { 4: 2 }, pesosDeRaridade: {} }, facil: { chanceDeDrop: 1 } }, progressao: { nivelMaximoDeEquipamento: 1000, estagioDeRaridade: { 10: 4 } } };
  const prev = Adm.propor(ov);
  assert.equal(prev.ok, true, prev.erros.join('|'));
  assert.deepEqual(prev.override.loot, { dificil: { chanceDeDrop: 1.2, chanceDeModificadorExtra: 0.1, pesosDeTier: { 4: 2 } } }, 'o igual ao original é podado: só a diferença');
  assert.equal(prev.override.progressao.nivelMaximoDeEquipamento, undefined);
  assert.ok(prev.impacto.some((l) => l.ato === 10 && l.dificuldade === 'dificil'), 'a prévia mostra o impacto');
  assert.ok(prev.distribuicoes.length === 10);
  assert.equal(existsSync(join(tmp, 'progressao.json')), false, 'propor não grava');
  const rev0 = Adm.obter().revisao;
  const r = Adm.salvar(ov, rev0);
  assert.equal(r.ok, true, JSON.stringify(r.erros));
  const gravado = JSON.parse(readFileSync(join(tmp, 'progressao.json'), 'utf8'));
  assert.deepEqual(gravado.loot, { dificil: { chanceDeDrop: 1.2, chanceDeModificadorExtra: 0.1, pesosDeTier: { 4: 2 } } });
  assert.equal(readFileSync(new URL('../gamedata/progressao.json', import.meta.url), 'utf8'), fabrica, 'o original não foi tocado');
  assert.equal(Adm.salvar(ov, rev0).codigo, 'conflito', 'revisão velha');
  assert.equal(Adm.salvar({ loot: { dificil: { chanceDeDrop: 0 } } }, Adm.obter().revisao).ok, false);
  assert.equal(Adm.definirAtivo(false, Adm.obter().revisao).ok, true);
  assert.equal(Adm.lerOverride().ativo, false);
  assert.equal(Adm.definirAtivo(true, Adm.obter().revisao).ok, true);
  assert.equal(Adm.salvar({ ativo: true, loot: { dificil: { chanceDeDrop: 1.5 } } }, Adm.obter().revisao).ok, true);
  assert.ok(Adm.versoes().length >= 2);
  assert.equal(Adm.restaurar(Adm.versoes().at(-1), Adm.obter().revisao).ok, true, 'restaurar uma versão anterior');
  assert.equal(Adm.reverter(Adm.obter().revisao).ok, true);
  assert.deepEqual(Object.keys(Adm.lerOverride()).filter((k) => k !== '_nota'), ['ativo']);
  assert.equal(Adm.reverter('velha').codigo, 'conflito');
});

test('PG14. o BOOT aplica o override gravado (processo novo), ignora o inválido com aviso e o original segue; o jogo gera com o que o arquivo diz', () => {
  const pasta = mkdtempSync(join(tmpdir(), 'prog-boot-'));
  const rodar = (conteudo) => {
    writeFileSync(join(pasta, 'progressao.json'), conteudo);
    const r = spawnSync(process.execPath, ['-e', `import('${new URL('../systems/progressao.mjs', import.meta.url).href}').then((P) => console.log('@@' + JSON.stringify({ aplicado: P.resultadoDaCarga.aplicado, drop: P.lootDa('dificil').chanceDeDrop, extra: P.lootDa('dificil').chanceDeModificadorExtra, estagio10: P.estagioDeRaridadeDoAto(10), max: P.nivelMaximo() })))`], { env: { ...process.env, DRAEVOR_OVERRIDES: pasta }, encoding: 'utf8' });
    return { dados: JSON.parse(r.stdout.split('@@')[1]), saida: r.stdout + r.stderr };
  };
  const bom = rodar(JSON.stringify({ ativo: true, loot: { dificil: { chanceDeDrop: 1.4, chanceDeModificadorExtra: 0.2 } }, progressao: { estagioDeRaridade: { 10: 4 } } }));
  assert.deepEqual(bom.dados, { aplicado: true, drop: 1.4, extra: 0.2, estagio10: 4, max: 1000 });
  const ruim = rodar(JSON.stringify({ ativo: true, progressao: { nivelMaximoDeEquipamento: 3000 } }));
  assert.deepEqual(ruim.dados, { aplicado: false, drop: 1, extra: 0, estagio10: 3, max: 1000 });
  assert.match(ruim.saida, /progressao\.json ignorado.*passa do limite de 1000/);
  const quebrado = rodar('{ não é json');
  assert.equal(quebrado.dados.max, 1000);
  assert.match(quebrado.saida, /progressao\.json ignorado/);
  assert.equal(rodar(JSON.stringify({ ativo: false, loot: { dificil: { chanceDeDrop: 9 } } })).dados.drop, 1, 'camada desligada = original');
  rmSync(pasta, { recursive: true, force: true });
});

test('PG15. Hot Reload: a estratégia "progressao" aplica sem reiniciar, mantém a última versão válida se o arquivo for inválido e voltar ao original quando o override some', async () => {
  const est = criarEstrategias({ overrides: tmp, atos: join(tmp, 'atos') }).progressao;
  writeFileSync(join(tmp, 'progressao.json'), JSON.stringify({ ativo: true, loot: { medio: { chanceDeDrop: 1.3 } } }));
  assert.equal((await est.aplicar()).ids[0], 'progressao');
  assert.equal(P.lootDa('medio').chanceDeDrop, 1.3);
  writeFileSync(join(tmp, 'progressao.json'), JSON.stringify({ ativo: true, loot: { medio: { chanceDeDrop: -2 } } }));
  await assert.rejects(async () => est.aplicar(), /Overrides de progressão inválidos/);
  assert.equal(P.lootDa('medio').chanceDeDrop, 1.3, 'a última versão válida segue');
  writeFileSync(join(tmp, 'progressao.json'), '{ quebrado');
  await assert.rejects(async () => est.aplicar(), /não é um JSON válido/);
  assert.equal(P.lootDa('medio').chanceDeDrop, 1.3);
  rmSync(join(tmp, 'progressao.json'));
  await est.aplicar();
  assert.equal(P.lootDa('medio').chanceDeDrop, 1, 'sem arquivo = original');
  const H = await import('../systems/hot-reload.mjs');
  assert.deepEqual(H.classificar('overrides/progressao.json'), { tipo: 'progressao', quente: true });
  assert.equal(H.classificar('progressao.json').quente, false, 'o arquivo de fábrica não recarrega a quente');
  assert.deepEqual(H.caminhosDaRota('progressao'), ['overrides/progressao.json']);
});

test('PG16. validação centralizada: a verificação "progressao" existe, passa no estado de fábrica (com os avisos do catálogo) e reprova um override com level acima de 1000', async () => {
  const v = criarVerificacoes().find((x) => x.id === 'progressao');
  assert.ok(v);
  const limpo = await v.rodar({ overrides: join(tmp, 'vazio') });
  assert.equal(limpo.achados.filter((a) => a.nivel === 'erro').length, 0);
  assert.ok(limpo.achados.some((a) => /equipamento\(s\) do catálogo exigem level acima de 1000/.test(a.mensagem)));
  assert.ok(limpo.achados.some((a) => /Atos sem nenhuma base/.test(a.mensagem)));
  writeFileSync(join(tmp, 'progressao.json'), JSON.stringify({ ativo: true, progressao: { nivelMaximoDeEquipamento: 3000 } }));
  const ruim = await v.rodar({ overrides: tmp });
  assert.ok(ruim.achados.some((a) => a.nivel === 'erro' && /limite de 1000/.test(a.mensagem)));
  rmSync(join(tmp, 'progressao.json'));
  const Git = await import('../admin/git-local.mjs');
  assert.equal(Git.moduloDe('game/gamedata/overrides/progressao.json'), 'progressao');
});

test('PG17. rotas: configuração, bases do Ato (com marcos), prévia e simulador só LEEM; salvar é "grava" (bloqueado em produção); o simulador tem teto de 50 mil e aceita proposta', async () => {
  const chama = async (metodo, rota, corpo, q = '') => { const r = []; await Http.atender({ method: metodo }, {}, `/api/mapas/_conteudo/${rota}`, new URL(`http://x/?${q}`), { json: (a, c, b) => r.push([c, b]), corpoJson: async () => corpo }); return r[0]; };
  const g = await chama('GET', 'progressao');
  assert.equal(g[0], 200);
  assert.deepEqual([g[1].nivelMaximo, g[1].efetivo.progressao.atos.length, g[1].distribuicoes.length, g[1].cobertura.length], [1000, 10, 10, 10]);
  assert.ok(g[1].perfis['proposta-1'], 'os perfis propostos vêm do arquivo de fábrica (não aplicados)');
  assert.deepEqual(P.lootDa('dificil'), NEUTRO, 'e a proposta NÃO está em uso');
  const a = await chama('GET', 'progressao/ato/3', null, 'slot=legs');
  assert.equal(a[1].ato, 3); assert.ok(a[1].bases.every((b) => b.slot === 'legs')); assert.ok(Array.isArray(a[1].marcos));
  assert.equal((await chama('GET', 'progressao/ato/77'))[0], 404);
  const v = await chama('POST', 'progressao/validar', { override: { loot: { dificil: { chanceDeDrop: 1.5 } } } });
  assert.equal(v[1].ok, true);
  const s = await chama('POST', 'simulador/loot', { modo: 'equipamentos', ato: 4, dificuldade: 'todas', n: 999999, semente: 3 });
  assert.equal(s[1].dificuldades.length, 3);
  assert.equal(s[1].dificuldades[0].amostras, 50000, 'teto de 50 mil por pedido');
  const prop = await chama('POST', 'simulador/loot', { modo: 'equipamentos', ato: 4, dificuldade: 'dificil', n: 2000, semente: 3, override: { loot: { dificil: { chanceDeModificadorExtra: 1 } } } });
  assert.equal(prop[1].entrada.dificuldade, 'dificil');
  assert.deepEqual(P.lootDa('dificil'), NEUTRO, 'simular a proposta não a aplica');
  assert.equal((await chama('POST', 'simulador/loot', { modo: 'equipamentos', n: 100, override: { progressao: { nivelMaximoDeEquipamento: 5000 } } }))[0], 409);
  assert.equal((await chama('POST', 'simulador/loot', { modo: 'monstro', monstro: 'troll', ato: 1, n: 500 }))[1].ok, true);
  assert.equal((await chama('POST', 'simulador/loot', { modo: 'hunt', huntId: 'troll-cave', ato: 1, n: 500 }))[1].ok, true);
  assert.equal(A.classeDaRota('GET', '/api/mapas/_conteudo/progressao'), 'leitura');
  assert.equal(A.classeDaRota('POST', '/api/mapas/_conteudo/progressao/validar'), 'leitura');
  assert.equal(A.classeDaRota('POST', '/api/mapas/_conteudo/simulador/loot'), 'leitura');
  assert.equal(A.classeDaRota('POST', '/api/mapas/_conteudo/progressao'), 'grava');
  assert.equal(A.configuracao({ env: { NODE_ENV: 'production' }, existe: () => false, arquivoDeAdmins: '/x' }).grava, false);
});

test('PG18. a tela: menu, aviso do level 1000, abas (Atos, Regras, Comparar, Simulador, Perfis), nada de 1001–3000, e os helpers puros de edição', async () => {
  const ler = (a) => readFileSync(new URL(`../frontend/client/src/${a}`, import.meta.url), 'utf8');
  const tela = ler('editor-progressao.mjs');
  const conteudo = ler('editor-conteudo.mjs');
  assert.match(conteudo, /\{ id: 'progressao', nome: 'Progressão e loot'/);
  assert.match(conteudo, /progressao: criarTelaDeProgressao\(/);
  assert.match(conteudo, /\['progressao', 'Progressão e loot'\]/);
  for (const t of ['Os equipamentos vão somente até o level', 'NÃO criam levels de equipamento novos', 'Atos e bases', 'Regras de loot', 'Comparar dificuldades', 'Simulador', 'Perfis propostos', 'Salvar override', 'Reverter ao original', 'usar as minhas edições', 'Carregar no editor']) assert.ok(tela.includes(t), t);
  assert.doesNotMatch(tela, /\b(1001|2000|3000)\b/, 'não exibe níveis 1001–3000 como progressão de equipamentos');
  assert.match(tela, /api\('progressao\/validar'/);
  assert.match(tela, /api\('simulador\/loot'/);
  const { ler: lerCaminho, gravar } = await import('../frontend/client/src/editor-progressao.mjs');
  const o = {};
  gravar(o, ['loot', 'medio', 'chanceDeDrop'], 1.2); gravar(o, ['loot', 'medio', 'pesosDeTier', '4'], 2);
  assert.deepEqual(o, { loot: { medio: { chanceDeDrop: 1.2, pesosDeTier: { 4: 2 } } } });
  assert.equal(lerCaminho(o, ['loot', 'medio', 'chanceDeDrop']), 1.2);
  assert.equal(lerCaminho(o, ['loot', 'facil', 'x']), undefined);
  gravar(o, ['loot', 'medio', 'pesosDeTier', '4'], undefined); gravar(o, ['loot', 'medio', 'chanceDeDrop'], undefined);
  assert.deepEqual(o, {}, 'apagar poda os objetos que ficam vazios');
  gravar(o, ['a', 'b'], undefined);
  assert.deepEqual(o, {});
});
