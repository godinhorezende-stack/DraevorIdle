// O Gem Atelier contra o ORIGINAL: o personagem capturado (Zoros e os outros
// da conta, 2026-09-25, api-mapeada/captura-gemas-0925/) remontado aqui tem de
// receber a MESMA view, campo a campo. E as ações, pelas regras de gemas.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as Gemas from '../sistemas/gemas.mjs';
import * as Ficha from '../sistemas/ficha.mjs';
import * as Bolsa from '../sistemas/bolsa.mjs';
import { CATALOGO } from '../nucleo/dados.mjs';
import { personagemDeTeste } from './apoio.mjs';

const CAP = new URL('../../api-mapeada/captura-gemas-0925/', import.meta.url);
const ler = (n) => JSON.parse(readFileSync(new URL(n, CAP), 'utf8'));

/** O Zoros de 2026-09-25: level, árvore, gemas na mochila e na bolsa, fragmentos. */
function zoros() {
  const e = personagemDeTeste({ vocacao: 'knight', level: 588 });
  const arvore = ler('arvore-zoros.json').view;
  e.arvore = { graus: Object.fromEntries(arvore.nos.filter((n) => n.gasto).map((n) => [n.id, n.gasto])), escolhidas: [], montagens: [null, null, null] };
  const w = ler('welcome-zoros-gemas.json').character;
  e.inventory = w.inventory;
  e.pouch = w.pouch;
  e.deposito = w.deposito;
  e.gemas = { lista: [], ativas: { verde: null, vermelho: null, roxo: null, azul: null }, graus: {}, fragmentos: { menor: 11, maior: 6 }, proximoId: 1 };
  return e;
}

test('a view do Zoros é IGUAL à do original, campo a campo', () => {
  assert.deepEqual(Gemas.vista(zoros()), ler('gemas-zoros.json').view);
});

test('as outras 4 vocações (level 8 e 116): a mesma view do original', () => {
  const nomes = { paladin: 'Biro', sorcerer: 'Tmparv sorcerer', druid: 'Tmparv druid', monk: 'Tmparv monk' };
  for (const voc of Object.keys(nomes)) {
    const original = ler(`gemas-${voc}.json`).view;
    const e = personagemDeTeste({ vocacao: voc, level: voc === 'paladin' ? 116 : 8 });
    e.inventory = [];
    e.pouch = [];
    e.arvore = { graus: {}, escolhidas: [], montagens: [null, null, null] };
    const nossa = Gemas.vista(e);
    // O que depende do que ELE tem (a árvore, as gemas guardadas) fica de fora;
    // o resto — regras, preços, oficina inteira — tem de bater.
    for (const campo of ['level', 'folha', 'pode', 'motivo', 'vocacao', 'nomeDaVocacao', 'marcas', 'itensDosFragmentos', 'precos', 'oficina']) {
      assert.deepEqual(nossa[campo], original[campo], `${voc}.${campo}`);
    }
  }
});

function comGema(qualidade = 'greater') {
  const e = zoros();
  e.gold = 1e9;
  const r = Gemas.comando(e, { action: 'revelar', qualidade });
  assert.ok(r.ok, r.erro);
  return { e, gema: e.gemas.lista.at(-1) };
}

test('revelar: cobra, gasta a gema fechada e sai no formato da qualidade', () => {
  for (const [q, nb, ns, preco] of [['lesser', 1, 0, 125000], ['regular', 2, 0, 1000000], ['greater', 2, 1, 6000000]]) {
    const e = zoros();
    e.gold = 1e9;
    const antes = Gemas.vista(e).fechadas[q].quantas;
    assert.ok(Gemas.comando(e, { action: 'revelar', qualidade: q }).ok);
    const g = e.gemas.lista[0];
    assert.equal(g.mods.filter((m) => m.tipo === 'basico').length, nb);
    assert.equal(g.mods.filter((m) => m.tipo === 'supremo').length, ns);
    assert.equal(new Set(g.mods.map((m) => `${m.tipo}:${m.id}`)).size, g.mods.length, 'sem repetir');
    assert.equal(e.gold, 1e9 - preco);
    assert.equal(Gemas.vista(e).fechadas[q].quantas, antes - 1);
  }
});

test('abaixo do level 51 nada anda, com a frase do original', () => {
  const e = personagemDeTeste({ level: 50 });
  assert.equal(Gemas.comando(e, { action: 'revelar', qualidade: 'lesser' }).erro, 'O Gem Atelier abre no level 51.');
});

test('encaixar acende pelos vessels: o Zoros (Fôlego a 21%) acende 1 modificador no azul', () => {
  const { e, gema } = comGema('greater');
  gema.dominio = 'azul';
  assert.ok(Gemas.comando(e, { action: 'encaixar', id: gema.id }).ok);
  const v = Gemas.vista(e);
  const minha = v.lista.find((g) => g.id === gema.id);
  assert.equal(minha.ativa, true);
  assert.deepEqual(minha.modificadores.map((m) => m.aceso), [true, false, false]);
  assert.equal(v.totais.modificadores, 1);
  // Tirar do vessel apaga tudo.
  Gemas.comando(e, { action: 'encaixar', id: gema.id });
  assert.equal(Gemas.vista(e).totais.modificadores, 0);
});

test('os efeitos acesos entram na ficha (resistência e vida máxima)', () => {
  const { e, gema } = comGema('lesser');
  gema.dominio = 'azul';
  gema.mods = [{ tipo: 'basico', id: 38 }]; // +150 vida e +1% fogo (knight, grau I)
  const antes = { hp: e.maxHp, fogo: Ficha.combate(e).protection.fire };
  Gemas.comando(e, { action: 'encaixar', id: gema.id });
  assert.equal(e.maxHp, antes.hp + 150);
  // Ficha por tique (sistemas/ficha.mjs): encaixar a gema não passa pela
  // sessão, então quem quer ver o efeito precisa invalidar à mão.
  Ficha.invalidar(e);
  assert.equal(Ficha.combate(e).protection.fire, antes.fogo + 1);
  Gemas.comando(e, { action: 'encaixar', id: gema.id });
  assert.equal(e.maxHp, antes.hp);
});

test('oficina: sobe o grau com ouro e fragmentos, e o efeito sobe junto', () => {
  const e = zoros();
  e.gold = 1e9;
  e.gemas.fragmentos.menor = 60;
  assert.ok(Gemas.comando(e, { action: 'melhorar', tipo: 'basico', modId: 31 }).ok);
  assert.equal(e.gemas.fragmentos.menor, 55);
  assert.equal(e.gold, 1e9 - 2000000);
  const vida = Gemas.vista(e).oficina.basicos.find((m) => m.id === 31);
  assert.equal(vida.grau, 1);
  assert.equal(vida.texto, '+330 vida');
  Gemas.comando(e, { action: 'melhorar', tipo: 'basico', modId: 31 });
  Gemas.comando(e, { action: 'melhorar', tipo: 'basico', modId: 31 });
  assert.match(Gemas.comando(e, { action: 'melhorar', tipo: 'basico', modId: 31 }).erro, /máximo/);
  e.gemas.fragmentos.maior = 0;
  assert.match(Gemas.comando(e, { action: 'melhorar', tipo: 'supremo', modId: 'dodge' }).erro, /Greater Fragments/);
});

test('destruir: fragmentos na faixa do cliente; trancada não destrói nem troca de domínio', () => {
  const { e, gema } = comGema('greater');
  assert.ok(Gemas.comando(e, { action: 'trancar', id: gema.id }).ok);
  assert.match(Gemas.comando(e, { action: 'destruir', id: gema.id }).erro, /Destranque/);
  assert.match(Gemas.comando(e, { action: 'trocarDominio', id: gema.id }).erro, /Destranque/);
  Gemas.comando(e, { action: 'trancar', id: gema.id });
  const antes = e.gemas.fragmentos.maior;
  assert.ok(Gemas.comando(e, { action: 'destruir', id: gema.id }).ok);
  const ganhou = e.gemas.fragmentos.maior - antes;
  assert.ok(ganhou >= 1 && ganhou <= 5, `${ganhou}`);
  assert.equal(e.gemas.lista.length, 0);
});

test('trocar domínio: cobra, anda na roda e tira do encaixe', () => {
  const { e, gema } = comGema('regular');
  gema.dominio = 'verde';
  Gemas.comando(e, { action: 'encaixar', id: gema.id });
  const ouro = e.gold;
  assert.ok(Gemas.comando(e, { action: 'trocarDominio', id: gema.id }).ok);
  assert.equal(gema.dominio, 'vermelho');
  assert.equal(e.gold, ouro - 250000);
  assert.equal(e.gemas.ativas.verde, null);
});

test('triturar: 50 de ouro, gasta a gema fechada de qualquer vocação e dá fragmentos', () => {
  const e = zoros();
  const antes = Gemas.vista(e).paraTriturar.find((g) => g.itemId === 44608).quantas;
  assert.ok(Gemas.comando(e, { action: 'triturar', itemId: 44608 }).ok);
  assert.equal(Gemas.vista(e).paraTriturar.find((g) => g.itemId === 44608).quantas, antes - 1);
  assert.ok(e.gemas.fragmentos.menor > 11);
});

test('drop: só bicho com 1.000+ de exp solta gema; boss tem a tabela dele', () => {
  const forte = Object.values(CATALOGO.bestiary).find((b) => b.exp >= 1000 && !b.boss);
  const fraco = Object.values(CATALOGO.bestiary).find((b) => b.exp > 0 && b.exp < 1000);
  assert.equal(Gemas.dropDoBicho(forte).length, 15);
  assert.equal(Gemas.dropDoBicho(fraco).length, 0);
  assert.equal(Gemas.DROP.boss.length, 10);
});

test('a venda automática não vende gema', () => {
  const e = personagemDeTeste({ level: 100 });
  e.pouch = [{ id: 44602, count: 3 }];
  Bolsa.venderBolsa(e);
  assert.deepEqual(e.pouch, [{ id: 44602, count: 3 }]);
});

test('a vida das gemas acesas sobrevive ao level up', async () => {
  const { subirDeLevel } = await import('../sistemas/cacadas.mjs');
  const R = await import('../nucleo/regras.mjs');
  const { e, gema } = comGema('lesser');
  gema.dominio = 'azul';
  gema.mods = [{ tipo: 'basico', id: 38 }]; // +150 vida (knight, grau I)
  Gemas.comando(e, { action: 'encaixar', id: gema.id });
  e.xp = R.expForLevel(e.level + 1);
  subirDeLevel(e);
  assert.equal(e.maxHp, R.statsBase('knight', e.level).maxHp + 150 + (e.afixoMax?.hp ?? 0) + (e.arvoreMax?.hp ?? 0));
});
