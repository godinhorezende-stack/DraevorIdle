// As GEMAS DO PoE no jogo (itens-poe/gemas-poe.mjs): as 562 da coleção do dono viram magias do Draevor (o molde do mesmo formato e elemento,
// os números do PoE pelo nível da gema), substituem as gemas ativas do Draevor no modo PoE, e cada uma tem o status no jogo. Precisa da
// coleção (`poe-gemas-poedb`) e do catálogo do PoE nesta máquina: sem eles, os testes são pulados.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !existsSync('/home/deploy/referencias-poe/poe-gemas-poedb/engine/dados/gemas.js')) && 'coleção de gemas / catálogo do PoE não estão nesta máquina';
const { ITEM_CATALOG, ACTION_CATALOG } = await import('../systems/dados.mjs');
const Acoes = await import('../systems/acoes.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const R = await import('../systems/skills/reforcos.mjs');
const G = await import('../systems/itens-poe/gemas-poe.mjs');
if (!SEM) {
  (await import('../systems/itens-poe/jogo.mjs')).iniciar(ITEM_CATALOG);
  await G.iniciar({ registrarGema: (g) => (Acoes.registrarAcao(g.entry), GS.registrarAtiva(g)), registrarReforco: R.registrar });
}

test('as 562 gemas viram magias do jogo com o molde do Draevor, item com ícone, e um status no jogo', { skip: SEM }, () => {
  assert.equal(G.REGISTRO.size, 562);
  const bola = G.doSlug('Fireball');
  const e = ACTION_CATALOG.spells.find((x) => x.id === bola.acao);
  assert.equal(bola.molde, 'spell-flame-strike', 'Bola de Fogo = o projétil de fogo do Draevor');
  assert.deepEqual([e.element, e.kind, !!e.projetil], ['fire', 'spell', true]);
  assert.equal(ITEM_CATALOG[bola.itemId].poeGema.icone, 'icones/Fireball.png');
  assert.equal(G.doSlug('Arc').molde, 'spell-forked-thorns', 'Arco = a corrente');
  assert.equal(G.doSlug('Raise_Zombie').statusNoJogo, 'nao', 'lacaio ainda não existe no jogo');
  const st = [...G.REGISTRO.values()].reduce((o, r) => ((o[r.statusNoJogo] = (o[r.statusNoJogo] ?? 0) + 1), o), {});
  assert.ok(st.funciona > 30 && st.parcial > 300 && st.nao < 120, JSON.stringify(st));
  for (const r of G.REGISTRO.values()) if (r.statusNoJogo !== 'funciona') assert.ok(r.motivosNoJogo.length, `${r.gema.slug}: sem motivo`);
});

test('os números do PoE pelo nível da gema: dano, custo, eficácia de ataque, chances de afecção', { skip: SEM }, () => {
  const d1 = G.danoNoNivel('Fireball', 1);
  const d20 = G.danoNoNivel('Fireball', 20);
  assert.ok(d20.min > d1.min * 10, `${d1.min} → ${d20.min}`);
  assert.ok(G.custoNoNivel('Fireball', 20) > G.custoNoNivel('Fireball', 1));
  assert.ok(G.eficaciaNoNivel('Cleave', 20) > 1, 'ataque: a arma × a eficácia');
  const af = G.afeccoesComAGema({ chance: { incendio: 0 } }, 'Fireball', 10);
  assert.equal(af.chance.incendio, 25, 'a chance de incendiar da gema entra no acerto');
});

test('aura e maldição viram reforço: os efeitos e os atributos do nível ficam no buff (dano adicionado, marca de vulnerável)', { skip: SEM }, () => {
  const ira = G.buffNoNivel('Wrath', 10);
  assert.ok(ira.af.added_energy_dmg_max > 0 && ira.efeitos.some((x) => x.efeito === 'dano'));
  const mordida = G.buffNoNivel('Frostbite', 10);
  assert.deepEqual(mordida.efeitos[0].tipos, ['ice']);
  assert.ok(mordida.efeitos[0].efeito === 'marcaVulneravel' && mordida.efeitos[0].pct > 0);
  const e = { hunt: { clock: 0, buffs: { 'poe-gema:Wrath': { ate: 1000, afPoe: ira.af } } } };
  assert.deepEqual(G.adds(e), ira.af);
  e.hunt.clock = 2000;
  assert.equal(G.adds(e), null, 'venceu: sai da ficha');
});

test('no modo PoE as gemas ativas do Draevor saem do drop (os suportes ficam) e o drop respeita o nível', { skip: SEM }, () => {
  let s = 1;
  const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  let n = 0;
  for (let i = 0; i < 4000; i++) {
    const g = GS.sortearDrop({ ato: 10, levelDaFase: 5, fatorDeChance: 1000 }, rng);
    if (!g) continue;
    const def = GS.defDaGema(g.id);
    if (def.tipo === 'support') continue;
    n++;
    assert.ok(def.poe, `${def.nome}: ativa do Draevor no drop do PoE`);
    assert.ok(def.levelMinimo <= 5, `${def.nome}: nível ${def.levelMinimo}`);
  }
  assert.ok(n > 50);
});

test('a ficha da gema para o balão: as propriedades e os modificadores com os números DO NÍVEL, e a qualidade', { skip: SEM }, () => {
  const f = G.fichaNoNivel('Fireball', 8, 10);
  assert.equal(f.nome, 'Bola de Fogo');
  assert.deepEqual(f.props.find(([r]) => r === 'Nível'), ['Nível', '8']);
  assert.deepEqual(f.props.find(([r]) => r === 'Custo'), ['Custo', `${G.custoNoNivel('Fireball', 8)} Mana`]);
  assert.ok(f.mods.some((m) => /^Causa \d+ a \d+ de Dano de Fogo$/.test(m)), f.mods.join(' | '));
  assert.ok(!f.mods.some((m) => m.includes('—')), 'sem faixa "(a — b)" no balão');
  assert.equal(f.qualidade, 10);
  assert.ok(f.modsDaQualidade.every((m) => !m.includes('—')));
  assert.equal(f.status, 'funciona');
  const max = G.fichaNoNivel('Fireball', 99);
  assert.match(max.props.find(([r]) => r === 'Nível')[1], /Máx/);
});
