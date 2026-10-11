// A MAGNITUDE DOS IMPLÍCITOS dos únicos e a regra que TROCA o implícito (dono, 11/10: "agora faça o Cordão da Servidão e o Nebulis",
// com as opções recomendadas). No PoE (poedb, Community Wiki):
//   - a Corda da Servidão "is inherently corrupted with a random corrupted implicit already on it. It always replaces the basetype implicit
//     +(25-35) to Strength", e "The displayed magnitude of the implicit on String of Servitude is already tripled";
//   - o Nebulis "drops with between one and three of the following synthesised implicit modifiers, replacing the ordinary implicit
//     modifier" (Sceptre Mods), com "Magnitudes dos Implícitos dos Modificadores aumentadas em (60—120)%" — o pool de síntese tem os
//     pesos 0, então a quantidade, a família e o tier saem com a mesma chance (decisão do dono);
//   - a Réplica: Nebulis fica com o implícito do Cetro do Além (Dano Elemental 40%), aumentado em 60–120% (64–88%).
// Antes as duas linhas de magnitude eram só "registrado", a Corda saía com a Força e sem corromper, e o Nebulis com o marcador
// "[One to three random synthesis implicit modifiers]" sem efeito. Os dados: gamedata/itens-poe/implicitos-sorteados.json (`unicos`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';
import * as Jogo from '../systems/itens-poe/jogo.mjs';
import { gerarPeca, comMagnitudeNosImplicitos } from '../systems/itens-poe/gerar.mjs';
import * as M from '../systems/itens-poe/moedas.mjs';
import { personagemDeTeste } from './apoio.mjs';
import { soNoOficial } from './apoio-migracao.mjs';

const SKIP = { skip: soNoOficial('os únicos são do PoE') };
const rngDe = (s) => { let x = s; return () => ((x = (x * 16807) % 2147483647) / 2147483647); };
const doUnico = (classe, slug) => {
  const c = Catalogo.catalogo().classes[classe];
  const u = c.unicos.find((x) => x.slug === slug);
  return { u, base: c.bases.find((b) => b.nome === u.base).id };
};
const gerar = (classe, slug, s, ilvl = 84) => gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: doUnico(classe, slug).base, raridade: 'unico', ilvl, rng: rngDe(s), unico: slug });
/** O valor com a magnitude `pct`, como o PoE mostra (o inteiro arredondado; o decimal com 2 casas); o número da descrição ("a cada 10") fica. */
const comPct = (v, pct) => (Number.isInteger(v) ? Math.round(v * (1 + pct / 100)) : Math.round(v * (1 + pct / 100) * 100) / 100);
const constantes = (modelo) => new Set([...modelo.matchAll(/(?:por cada|a cada) \{(\d+)\}|por \{(\d+)\} segundos?/g)].map((x) => Number(x[1] ?? x[2])));
const conferirMagnitude = (m, pct) => {
  const fixos = constantes(m.modelo);
  assert.deepEqual(m.valores, m.valoresSemMagnitude.map((v, i) => (fixos.has(i) ? v : comPct(v, pct))), m.texto);
};
/** O tier do pool especial de onde o implícito saiu (pela família e pelo texto). */
const tierDoPool = (pool, classe, m) => Catalogo.poolEspecialDa(pool, classe, '*').implicitos.find((g) => g.familia === m.familia)?.tiers.filter((t) => t.modelo === m.modelo) ?? [];
const naFaixaDeUm = (tiers, valores) => tiers.some((t) => valores.every((v, i) => v >= Math.min(...t.faixas[i]) && v <= Math.max(...t.faixas[i])));
const magnitudeDe = (g) => Number(g.modificadores.find((m) => /^Magnitudes dos Implícitos dos Modificadores aumentadas em/.test(m.modelo)).valores[0]);
function usar(p, slug, s = 11) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 80 }), { inventory: [structuredClone(p), { id: M.idDa(slug), count: 1 }] });
  const r = M.usar(e, { moeda: M.idDa(slug), alvo: { onde: 'inventory', indice: 0 } }, rngDe(s));
  return { r, peca: e.inventory[0] };
}

test('a magnitude não muda o número da descrição ("a cada 10 de Destreza", "por cada 500 de Mana", "por 4 segundos") e não multiplica duas vezes', () => {
  const modificadores = [{ tipo: 'explicit', modelo: 'Magnitudes dos Implícitos dos Modificadores aumentadas em {0}%', valores: [70] }];
  const implicitos = [
    { modelo: 'Adiciona {0} a {1} de Dano de Gelo aos Ataques com esta Arma a cada {2} de Destreza', valores: [1, 3, 10], texto: '' },
    { modelo: 'Dano Mágico aumentado em {0}% por cada {1} de Mana Máxima', valores: [7, 500], texto: '' },
    { modelo: '{0}% de chance de Intimidar Inimigos por {1} segundos ao Acertar', valores: [5, 4], texto: '' },
    { modelo: 'Dano Elemental aumentado em {0}%', valores: [40], texto: '' },
  ];
  const r = comMagnitudeNosImplicitos({ implicitos, modificadores });
  assert.deepEqual(r.implicitos.map((m) => m.texto), [
    'Adiciona 2 a 5 de Dano de Gelo aos Ataques com esta Arma a cada 10 de Destreza',
    'Dano Mágico aumentado em 12% por cada 500 de Mana Máxima',
    '9% de chance de Intimidar Inimigos por 4 segundos ao Acertar',
    'Dano Elemental aumentado em 68%',
  ]);
  assert.deepEqual(comMagnitudeNosImplicitos(r), r, 'de novo: igual (parte do valor sem a magnitude)');
});

test('Corda da Servidão: cai corrompida, sem a Força, com 1 implícito corrompido de cinto (iLvl ≤ o da peça) triplicado', SKIP, () => {
  const familias = new Set();
  for (let s = 1; s <= 80; s++) {
    const ilvl = s % 2 ? 84 : 30;
    const g = gerar('Belts', 'String_of_Servitude', s * 7919, ilvl);
    assert.equal(g.erro, undefined);
    assert.equal(g.corrompido, true);
    assert.ok(!g.modificadores.some((m) => m.modelo === '+{0} de Força'), 'a Força sai');
    assert.equal(g.implicitos.length, 1);
    const [i] = g.implicitos;
    assert.equal(i.origem, 'corrupted');
    assert.equal(i.corrompido, true);
    const tiers = tierDoPool('corrupted', 'Belts', i);
    assert.ok(tiers.length && tiers.every((t) => (t.ilvl ?? 1) <= ilvl), `${i.texto} (iLvl ${ilvl})`);
    if (i.valores.length) {
      assert.ok(naFaixaDeUm(tiers, i.valoresSemMagnitude), i.texto);
      conferirMagnitude(i, 200);
    }
    familias.add(i.familia);
  }
  assert.ok(familias.size >= 10, `famílias sorteadas: ${familias.size}`);
  const p = Jogo.pecaDoJogo(gerar('Belts', 'String_of_Servitude', 5));
  assert.equal(p.poe.corrompido, true);
  assert.equal(p.poe.af.magnitude_implicitos, 200);
  const linha = p.poe.modificadores.findIndex((m) => m.modelo === 'Magnitudes dos Modificadores Implícitos são triplicadas');
  assert.equal(p.poe.estados[p.poe.implicitos.length + linha], 'equivalente');
  // Corrompida: moeda comum não vale (como no PoE).
  assert.equal(usar(p, 'Blessed_Orb').r.ok, false);
  assert.equal(usar(p, 'Divine_Orb').r.ok, false);
});

test('Nebulis: 1 a 3 implícitos de Síntese de cetro (famílias diferentes), sem o marcador, aumentados pela magnitude dele (60–120%)', SKIP, () => {
  const quantos = new Set();
  for (let s = 1; s <= 150; s++) {
    const g = gerar('Sceptres', 'Nebulis', s * 104_729);
    assert.equal(g.erro, undefined);
    assert.ok(!g.modificadores.some((m) => m.modelo === '[One to three random synthesis implicit modifiers]'), 'o marcador sai');
    assert.ok(g.implicitos.length >= 1 && g.implicitos.length <= 3, `${g.implicitos.length} implícitos`);
    assert.equal(new Set(g.implicitos.map((i) => i.familia)).size, g.implicitos.length, 'famílias diferentes');
    quantos.add(g.implicitos.length);
    const pct = magnitudeDe(g);
    assert.ok(pct >= 60 && pct <= 120);
    for (const i of g.implicitos) {
      assert.equal(i.origem, 'synthesis');
      const tiers = tierDoPool('synthesis', 'Sceptres', i);
      assert.ok(tiers.length, i.texto);
      if (!i.valores.length) continue;
      assert.ok(naFaixaDeUm(tiers, i.valoresSemMagnitude), i.texto);
      conferirMagnitude(i, pct);
    }
  }
  assert.deepEqual([...quantos].sort(), [1, 2, 3]);
  const p = Jogo.pecaDoJogo(gerar('Sceptres', 'Nebulis', 9));
  assert.equal(p.poe.corrompido, undefined, 'o Nebulis não cai corrompido');
  assert.equal(p.poe.af.magnitude_implicitos, magnitudeDe(p.poe));
});

test('Réplica: Nebulis: o "Dano Elemental aumentado em 40%" sai entre 64% e 88% (40% × 1,6–2,2)', SKIP, () => {
  for (let s = 1; s <= 40; s++) {
    const g = gerar('Sceptres', 'Replica_Nebulis', s * 7919);
    const imp = g.modificadores.find((m) => m.tipo === 'implicit');
    assert.deepEqual(imp.valoresSemMagnitude, [40]);
    assert.equal(imp.valores[0], comPct(40, magnitudeDe(g)));
    assert.ok(imp.valores[0] >= 64 && imp.valores[0] <= 88, imp.texto);
    assert.deepEqual(g.implicitos, [], 'sem o implícito da base somado');
  }
});

test('Nebulis nas moedas: o Divino muda a magnitude e os implícitos acompanham; o Abençoado sorteia os mesmos implícitos de novo', SKIP, () => {
  const p = Jogo.pecaDoJogo(gerar('Sceptres', 'Nebulis', 21));
  const familias = p.poe.implicitos.map((i) => i.familia);
  const base = p.poe.implicitos.map((i) => i.valoresSemMagnitude);
  const divino = usar(p, 'Divine_Orb', 5);
  assert.equal(divino.r.ok, true, divino.r.erro);
  const d = divino.peca.poe;
  assert.ok(!d.modificadores.some((m) => m.modelo === '[One to three random synthesis implicit modifiers]'), 'o marcador não volta');
  assert.deepEqual(d.implicitos.map((i) => i.valoresSemMagnitude), base, 'o implícito não muda — só a magnitude');
  for (const i of d.implicitos) if (i.valores.length) conferirMagnitude(i, magnitudeDe(d));

  const bencao = usar(divino.peca, 'Blessed_Orb', 7);
  assert.equal(bencao.r.ok, true, bencao.r.erro);
  const b = bencao.peca.poe;
  assert.deepEqual(b.implicitos.map((i) => i.familia), familias, 'os mesmos implícitos');
  for (const i of b.implicitos) {
    if (!i.valores.length) continue;
    assert.ok(naFaixaDeUm(tierDoPool('synthesis', 'Sceptres', i), i.valoresSemMagnitude), i.texto);
    conferirMagnitude(i, magnitudeDe(b));
  }
});

test('a peça de ANTES da regra (Nebulis com o marcador, sem implícito) não perde a linha no Orbe Divino', SKIP, () => {
  const { u } = doUnico('Sceptres', 'Nebulis');
  const p = Jogo.pecaDoJogo(gerar('Sceptres', 'Nebulis', 3));
  p.poe.implicitos = [];
  p.poe.modificadores = u.modificadores.map((m) => ({ tipo: m.tipo, modelo: m.modelo, texto: m.texto, valores: (m.faixas ?? []).map((f) => f[0]) }));
  const { r, peca } = usar(p, 'Divine_Orb', 5);
  assert.equal(r.ok, true, r.erro);
  assert.equal(peca.poe.modificadores.length, u.modificadores.length);
  assert.ok(peca.poe.modificadores.some((m) => m.modelo === '[One to three random synthesis implicit modifiers]'));
  assert.deepEqual(peca.poe.implicitos, []);
});
