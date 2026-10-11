// A MAGNITUDE DOS EXPLÍCITOS da base (dono, 11/10: "corrija a magnitude dos explícitos do Amuleto Simples"). No PoE o Amuleto Simples e
// o Focal têm "Magnitudes dos Modificadores Explícitos aumentada em 100%", e os anéis Engrenado, Geodésico, Coletor e Helicoidal +25–50%
// nos sufixos ou nos prefixos: o valor do mod é sempre o do tier multiplicado. O gerador já multiplicava, mas:
//   - multiplicava também o número da DESCRIÇÃO ("Dano aumentado em 1% a cada 15 de Força" virava "2% a cada 30");
//   - o Orbe Divino, a Lágrima Divina Maculada e o Orbe do Domínio sorteavam o valor de novo SEM a magnitude (voltava à metade). (O
//     Domínio não tem caso aqui: os pools de influência de amuleto e de anel não têm tier Elevado nos dados.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';
import * as Jogo from '../systems/itens-poe/jogo.mjs';
import { gerarPeca, tierDoMod, sortearDoPool } from '../systems/itens-poe/gerar.mjs';
import * as M from '../systems/itens-poe/moedas.mjs';
import { personagemDeTeste } from './apoio.mjs';
import { soNoOficial } from './apoio-migracao.mjs';

const SKIP = { skip: soNoOficial('as bases são do PoE') };
const SIMPLES = 'Amulets/Simplex_Amulet';
const GEODESICO = 'Rings/Geodesic_Ring';
const rngDe = (s) => { let x = s; return () => ((x = (x * 16807) % 2147483647) / 2147483647); };
const peca = (base, s, ilvl = 84) => Jogo.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'raro', ilvl, rng: rngDe(s) }));
const mods = (p) => [...p.poe.prefixos, ...p.poe.sufixos];
function usar(p, slug, s = 11) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 80 }), { inventory: [structuredClone(p), { id: M.idDa(slug), count: 1 }] });
  const r = M.usar(e, { moeda: M.idDa(slug), alvo: { onde: 'inventory', indice: 0 } }, rngDe(s));
  return { r, peca: e.inventory[0] };
}
const comPct = (v, pct) => (Number.isInteger(v) ? Math.round(v * (1 + pct / 100)) : Math.round(v * (1 + pct / 100) * 100) / 100);
const constantes = (modelo) => new Set([...modelo.matchAll(/(?:por cada|a cada) \{(\d+)\}|por \{(\d+)\} segundos?/g)].map((x) => Number(x[1] ?? x[2])));
/** Cada valor dentro da faixa do tier × a magnitude (o número da descrição, igual ao do tier). */
function naFaixaComMagnitude(m, faixas, pct) {
  const fixos = constantes(m.modelo);
  m.valores.forEach((v, i) => {
    const [a, b] = [Math.min(...faixas[i]), Math.max(...faixas[i])];
    if (fixos.has(i)) assert.ok(v >= a && v <= b, `${m.texto}: o ${i}º número é da descrição`);
    else assert.ok(v >= comPct(a, pct) && v <= comPct(b, pct), `${m.texto} (faixa ${a}–${b} × ${1 + pct / 100})`);
  });
}
const faixasDo = (p, m) => tierDoMod(Catalogo.catalogo(), p.poe, m)?.tier?.faixas;

test('Amuleto Simples: o explícito sai com o dobro do tier, e o Orbe Divino mantém o dobro', SKIP, () => {
  for (let s = 1; s <= 30; s++) {
    const p = peca(SIMPLES, s * 7919);
    assert.ok(mods(p).length >= 1);
    for (const m of mods(p)) naFaixaComMagnitude(m, faixasDo(p, m), 100);
    const { r, peca: d } = usar(p, 'Divine_Orb', s);
    assert.equal(r.ok, true, r.erro);
    for (const m of mods(d)) naFaixaComMagnitude(m, faixasDo(d, m), 100);
  }
});

test('Lágrima Divina Maculada no Amuleto Simples corrompido: o tier novo também sai em dobro', SKIP, () => {
  const p = peca(SIMPLES, 31);
  p.poe.corrompido = true;
  const { r, peca: d } = usar(p, 'Tainted_Divine_Teardrop', 5);
  assert.equal(r.ok, true, r.erro);
  for (const m of mods(d)) naFaixaComMagnitude(m, faixasDo(d, m), 100);
});

test('Anel Geodésico (+25% nos prefixos): o Divino aumenta só os prefixos; os sufixos ficam na faixa', SKIP, () => {
  for (let s = 1; s <= 20; s++) {
    const { r, peca: d } = usar(peca(GEODESICO, s * 104_729), 'Divine_Orb', s);
    assert.equal(r.ok, true, r.erro);
    for (const m of d.poe.prefixos) naFaixaComMagnitude(m, faixasDo(d, m), 25);
    for (const m of d.poe.sufixos) naFaixaComMagnitude(m, faixasDo(d, m), 0);
  }
});

test('o número da descrição não dobra: "Dano aumentado em X% a cada 15 de Força" (Ancião) no Amuleto Simples', SKIP, () => {
  const p = peca(SIMPLES, 3);
  const pagina = Catalogo.poolEspecialDa('elder', 'Amulets', '*');
  const alvo = /^Dano aumentado em \{0\}% a cada \{1\} de Força$/;
  const n = sortearDoPool({ pagina, poe: { ...p.poe, prefixos: [], sufixos: [] }, regras: Catalogo.REGRAS, origem: 'elder', rng: rngDe(9), filtro: (t) => alvo.test(t.modelo) });
  assert.ok(n, 'o mod do Ancião saiu');
  const t = [...pagina.prefixos, ...pagina.sufixos].find((g) => g.familia === n.mod.familia).tiers.find((x) => x.tier === n.mod.tier && x.modelo === n.mod.modelo);
  assert.equal(n.mod.valores[1], t.faixas[1][0], `${n.mod.texto}: o "a cada N" fica`);
  naFaixaComMagnitude(n.mod, t.faixas, 100);
});
