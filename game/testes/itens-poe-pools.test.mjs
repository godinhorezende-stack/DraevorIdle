// Os POOLS do PoE e o drop (dono, 08/10: "corrija o bug dos raros sem mod e importe os pools"). (1) A base sem pool de mods (as Golden,
// que no PoE só existem como recompensa, e as Rúnicas/Ward, da Expedição) não cai Normal, Mágica nem Rara — só como Único, se tiver; antes
// caíam Raras sem mod nenhum. (2) Os pools especiais (influências, corrompido, bancada, essência, fósseis, velado, eldritch, síntese,
// encantamento…) estão no repositório, um arquivo por pool, lidos sob demanda, e FORA do drop comum (como na campanha do PoE).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';
import * as Jogo from '../systems/itens-poe/jogo.mjs';
import './apoio.mjs';

const SEM = !existsSync(Catalogo.ARQUIVO) && 'dados do PoE ausentes nesta máquina';

/** Um sorteio repetível (mulberry32). */
const rngDe = (semente) => () => {
  semente = (semente + 0x6d2b79f5) >>> 0;
  let t = semente;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

test('base sem pool de mods: nunca Normal, Mágica nem Rara; Único só se a base tiver Único', { skip: SEM }, () => {
  const cat = Catalogo.catalogo();
  const boots = cat.classes.Boots;
  const golden = boots.bases.find((b) => b.id === 'Boots/Golden_Caligae');
  assert.equal(golden.pool, null, 'a coleção não traz o pool dela');
  for (const r of ['normal', 'magico', 'raro', 'unico']) assert.equal(Jogo.podeCairComo(boots, golden, r), false, r);
  const helmets = cat.classes.Helmets;
  const runica = helmets.bases.find((b) => b.id === 'Helmets/Runic_Crown');
  assert.equal(Jogo.podeCairComo(helmets, runica, 'raro'), false);
  assert.equal(Jogo.podeCairComo(helmets, runica, 'unico'), true, 'a Coroa de Cadigan é dessa base');
  const comum = boots.bases.find((b) => b.pool);
  assert.equal(Jogo.podeCairComo(boots, comum, 'raro'), true);
  // A base fixa (a projeção da caçada offline) segue a mesma regra.
  assert.equal(Jogo.pecaSorteada(70, rngDe(1), undefined, 0, 'Boots/Golden_Caligae'), null);
});

test('drop de verdade: nenhum Raro sem mod, nenhuma base sem pool fora do Único, e o raro tem 4–6 mods (salvo o que o implícito da base muda)', { skip: SEM }, () => {
  const cat = Catalogo.catalogo();
  const rng = rngDe(7);
  let raros = 0;
  for (let i = 0; i < 20_000; i++) {
    const p = Jogo.pecaSorteada([10, 40, 70, 84][i % 4], rng, undefined, 400);
    if (!p?.poe) continue;
    const [classe] = p.poe.base.split('/');
    const base = cat.classes[classe].bases.find((b) => b.id === p.poe.base);
    if (!base.pool) assert.equal(p.poe.raridade, 'unico', `${p.poe.base} caiu ${p.poe.raridade}`);
    if (p.poe.raridade !== 'raro') continue;
    raros++;
    const n = p.poe.prefixos.length + p.poe.sufixos.length;
    const mudaOLimite = (base.implicitos ?? []).some((l) => /Modificador(es)? (Prefixo|Sufixo) permitidos?/.test(l.texto ?? ''));
    assert.ok(n > 0, `${p.poe.base} raro sem mod`);
    if (!mudaOLimite) assert.ok(n >= 4 && n <= 6, `${p.poe.base}: ${n} mods`);
  }
  assert.ok(raros > 300, `${raros} raros`);
});

test('os 23 pools especiais estão no repositório, um arquivo por pool, na forma do pool normal', { skip: SEM }, () => {
  const nomes = Catalogo.poolsEspeciais();
  for (const p of ['corrupted', 'master', 'essence', 'delve', 'veiled', 'elder', 'shaper', 'crusader', 'redeemer', 'hunter', 'warlord', 'searing', 'eater', 'synthesis', 'enchant']) {
    assert.ok(nomes.includes(p), p);
  }
  assert.equal(nomes.length, 23);
  const corrompido = Catalogo.poolEspecialDa('corrupted', 'Body_Armours', 'str');
  assert.ok(corrompido.implicitos.length > 0, 'o corrompido é de implícitos');
  const criador = Catalogo.poolEspecialDa('shaper', 'Body_Armours', 'str');
  assert.ok(criador.prefixos.length > 0 && criador.sufixos.length > 0, 'influência tem prefixos e sufixos');
  const tier = criador.prefixos[0].tiers[0];
  assert.ok(tier.modelo && Array.isArray(tier.faixas) && tier.ilvl != null && tier.peso != null, JSON.stringify(tier));
  assert.equal(Catalogo.poolEspecial('../catalogo-itens'), null, 'só nome de pool, nada de caminho');
  assert.equal(Catalogo.poolEspecial('nao-existe'), null);
});

test('o drop comum usa SÓ o pool normal (como na campanha do PoE): nenhum mod de influência, corrompido ou velado numa peça que cai', { skip: SEM }, () => {
  const cat = Catalogo.catalogo();
  const rng = rngDe(11);
  for (let i = 0; i < 5_000; i++) {
    const p = Jogo.pecaSorteada([20, 70][i % 2], rng, undefined, 800);
    if (!p?.poe || !['magico', 'raro'].includes(p.poe.raridade)) continue;
    const [classe] = p.poe.base.split('/');
    const pagina = cat.classes[classe].paginas[cat.classes[classe].bases.find((b) => b.id === p.poe.base).pool];
    const familias = new Set([...pagina.prefixos, ...pagina.sufixos].map((g) => g.familia));
    for (const m of [...p.poe.prefixos, ...p.poe.sufixos]) assert.ok(familias.has(m.familia), `${p.poe.base}: ${m.familia} não é do pool normal`);
  }
});
