// O IMPLÍCITO SORTEADO do Talismã do Lobo Grandioso (dono, 11/10: "corrija o implícito aleatório do Talismã do Lobo Grandioso"). No PoE
// a base (Talisman4) não tem implícito fixo: "Greatwolf Talisman - has two randomly chosen talisman implicits" (poedb › Modifiers), da
// lista de 33 da aba Modificadores dos Olhos do Lobo Grandioso — e os Olhos dobram os implícitos ("Magnitudes dos Modificadores Implícitos
// são dobradas"). Antes a base saía sem implícito nenhum, e a linha dos Olhos não tinha o que dobrar. Os dados: gamedata/itens-poe/
// implicitos-sorteados.json (aplicado por cima do catálogo em systems/itens-poe/catalogo.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';
import * as Jogo from '../systems/itens-poe/jogo.mjs';
import { gerarPeca } from '../systems/itens-poe/gerar.mjs';
import * as M from '../systems/itens-poe/moedas.mjs';
import { personagemDeTeste } from './apoio.mjs';
import { soNoOficial } from './apoio-migracao.mjs';

const SKIP = { skip: soNoOficial('o Talismã do Lobo Grandioso é do PoE') };
const LOBO = 'Amulets/Greatwolf_Talisman';
const DADOS = JSON.parse(readFileSync(new URL('../gamedata/itens-poe/implicitos-sorteados.json', import.meta.url), 'utf8'));
const LISTA = DADOS.bases[LOBO].implicitos;
const rngDe = (s) => { let x = s; return () => ((x = (x * 16807) % 2147483647) / 2147483647); };
const gerar = (base, raridade, s, unico = null) => gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade, ilvl: 70, rng: rngDe(s), unico });
const molde = (modelo) => LISTA.find((t) => t.modelo === modelo);
const naFaixa = (valores, faixas, fator = 1) => valores.every((v, i) => v >= Math.min(...faixas[i]) * fator && v <= Math.max(...faixas[i]) * fator);
/** Usa a moeda pela Forja de verdade (`moedas.usar`); devolve `{ r, peca }` (a peça depois). */
function usar(p, slug, s = 11) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 80 }), { inventory: [structuredClone(p), { id: M.idDa(slug), count: 1 }] });
  const r = M.usar(e, { moeda: M.idDa(slug), alvo: { onde: 'inventory', indice: 0 } }, rngDe(s));
  return { r, peca: e.inventory[0] };
}

test('os dados: o Lobo Grandioso sorteia 2 dos 33 implícitos de talismã do poedb, com o MESMO texto dos talismãs do catálogo', () => {
  assert.deepEqual(Object.keys(DADOS.bases), [LOBO]);
  assert.equal(DADOS.bases[LOBO].quantidade, 2);
  assert.equal(LISTA.length, 33);
  assert.equal(new Set(LISTA.map((t) => t.modelo)).size, 33, 'cada implícito uma vez');
  const cru = JSON.parse(readFileSync(Catalogo.ARQUIVO, 'utf8'));
  const amuletos = cru.classes.Amulets.bases;
  assert.deepEqual(amuletos.find((b) => b.id === LOBO).implicitos, [], 'a base não tem implícito fixo');
  const dosTalismas = new Set(amuletos.filter((b) => /Talisman/.test(b.slug)).flatMap((b) => b.implicitos.map((i) => i.texto)));
  for (const t of LISTA) assert.ok(dosTalismas.has(t.texto), `"${t.texto}" é o texto de um talismã do catálogo (a tradução que o jogo já converte)`);
});

test('o Lobo Grandioso sai com 2 implícitos distintos da lista, nas faixas — e todos os 33 aparecem', SKIP, () => {
  const vistos = new Set();
  for (let s = 1; s <= 300; s++) {
    const p = gerar(LOBO, s % 2 ? 'normal' : 'raro', s * 7919);
    assert.equal(p.implicitos.length, 2, `semente ${s}`);
    assert.notEqual(p.implicitos[0].modelo, p.implicitos[1].modelo);
    for (const i of p.implicitos) {
      const t = molde(i.modelo);
      assert.ok(t, i.texto);
      assert.ok(naFaixa(i.valores, t.faixas), i.texto);
      vistos.add(i.modelo);
    }
  }
  assert.equal(vistos.size, 33);
  // A peça do jogo traduz os dois (a ficha recebe os atributos).
  const jogo = Jogo.pecaDoJogo(gerar(LOBO, 'normal', 3));
  assert.equal(jogo.poe.implicitos.length, 2);
  assert.ok(Object.keys(jogo.poe.af).length > 0);
});

test('só o Lobo Grandioso muda: o Talismã do Grande Lobo segue com o Rito da Lua, e toda outra base sai com os implícitos fixos dela', SKIP, () => {
  const cat = Catalogo.catalogo();
  const rito = gerar('Amulets/Greatwolf_Talisman_2', 'normal', 5);
  assert.equal(rito.implicitos.length, 1);
  assert.match(rito.implicitos[0].texto, /Rito da Lua/);
  for (const [classe, c] of Object.entries(cat.classes)) {
    if (classe === 'Maps') continue;
    for (const b of c.bases) {
      if (b.id === LOBO) continue;
      const p = gerar(b.id, 'normal', 13);
      // (lote 61, dono 17/10: "Conferir a troca nele") a RAMIFICADORA troca a marcação "concedem #" da base pelo encantamento sorteado — no
      // PoE ela sempre cai com ele; os outros implícitos seguem os da base
      if (/_Cluster_Jewel$/.test(b.id)) {
        const marcacao = 'Habilidades Passivas Adicionadas concedem #';
        assert.ok(b.implicitos.some((i) => i.modelo === marcacao), b.id);
        assert.deepEqual(p.implicitos.filter((i) => !i.encantamento).map((i) => i.modelo), b.implicitos.map((i) => i.modelo).filter((m) => m !== marcacao), b.id);
        assert.ok(p.implicitos.some((i) => i.encantamento && /^Habilidades Passivas Adicionadas concedem .+[^#]$/.test(i.modelo)), b.id);
        continue;
      }
      assert.deepEqual(p.implicitos.map((i) => i.modelo), b.implicitos.map((i) => i.modelo), b.id);
    }
  }
});

test('os Olhos do Lobo Grandioso dobram os 2 implícitos (a linha é equivalente); o Orbe Abençoado sorteia de novo sem dobrar duas vezes', SKIP, () => {
  for (let s = 1; s <= 40; s++) {
    const g = gerar(LOBO, 'unico', s * 104_729, 'Eyes_of_the_Greatwolf');
    assert.equal(g.erro, undefined);
    assert.equal(g.implicitos.length, 2);
    for (const i of g.implicitos) {
      assert.ok(naFaixa(i.valoresSemMagnitude, molde(i.modelo).faixas), i.texto);
      assert.deepEqual(i.valores, i.valoresSemMagnitude.map((v) => v * 2), i.texto);
    }
  }
  const olhos = Jogo.pecaDoJogo(gerar(LOBO, 'unico', 5, 'Eyes_of_the_Greatwolf'));
  const linha = olhos.poe.modificadores.findIndex((m) => m.texto === 'Magnitudes dos Modificadores Implícitos são dobradas');
  assert.equal(olhos.poe.estados[olhos.poe.implicitos.length + linha], 'equivalente');
  assert.equal(olhos.poe.af.magnitude_implicitos, 100);

  const modelos = olhos.poe.implicitos.map((i) => i.modelo);
  let p = olhos;
  for (const s of [3, 17, 29]) {
    const { r, peca } = usar(p, 'Blessed_Orb', s);
    assert.equal(r.ok, true, r.erro);
    assert.deepEqual(peca.poe.implicitos.map((i) => i.modelo), modelos, 'os mesmos implícitos');
    for (const i of peca.poe.implicitos) {
      assert.ok(naFaixa(i.valoresSemMagnitude, molde(i.modelo).faixas), i.texto);
      assert.deepEqual(i.valores, i.valoresSemMagnitude.map((v) => v * 2), i.texto);
    }
    p = peca;
  }
});

test('Orbe Abençoado no Lobo Grandioso: os mesmos implícitos, valores novos na faixa; a peça antiga, sem implícito, é recusada sem mudar', SKIP, () => {
  const lobo = Jogo.pecaDoJogo(gerar(LOBO, 'raro', 21));
  const { r, peca } = usar(lobo, 'Blessed_Orb', 7);
  assert.equal(r.ok, true, r.erro);
  assert.deepEqual(peca.poe.implicitos.map((i) => i.modelo), lobo.poe.implicitos.map((i) => i.modelo));
  for (const i of peca.poe.implicitos) {
    assert.ok(naFaixa(i.valores, molde(i.modelo).faixas), i.texto);
    assert.equal(i.valoresSemMagnitude, undefined, 'peça que não é dos Olhos não dobra');
  }
  // (Peça que caiu antes desta correção: sem implícito. O Abençoado não inventa implícito — só sorteia os valores dos que existem.)
  const antiga = structuredClone(lobo);
  antiga.poe.implicitos = [];
  const recusa = usar(antiga, 'Blessed_Orb', 7);
  assert.equal(recusa.r.ok, false);
  assert.deepEqual(recusa.peca.poe.implicitos, []);
});

test('Orbe Vaal nos Olhos: o implícito corrompido também sai dobrado', SKIP, () => {
  const olhos = Jogo.pecaDoJogo(gerar(LOBO, 'unico', 5, 'Eyes_of_the_Greatwolf'));
  let achou = null;
  for (let s = 1; s < 300 && !achou; s++) {
    const { r, peca } = usar(olhos, 'Vaal_Orb', s * 104_729);
    assert.equal(r.ok, true, r.erro);
    if (peca.poe.implicitos?.[0]?.corrompido && peca.poe.implicitos[0].valores?.length) achou = peca;
  }
  assert.ok(achou, 'o implícito corrompido com número saiu');
  const [i] = achou.poe.implicitos;
  assert.deepEqual(i.valores, i.valoresSemMagnitude.map((v) => (Number.isInteger(v) ? Math.round(v * 2) : Math.round(v * 200) / 100)), i.texto);
});
