// LOTE 48 — as JOIAS ATEMPORAIS pelo Path of Building (dono, 16/10: "Pode baixar agora" as tabelas, "As 6 joias, ~33 MB" no repositório e
// a tradução pela árvore do poedb): a peça sorteia o líder e a semente; no encaixe, as passivas alocadas no raio (Grande) são Conquistadas —
// o notável pela tabela (a passiva da legião no lugar, ou a adição somada), a pequena pelo conquistador (Karui +2/+4 de Força, Templários
// Devoção, Império Eterno nada), a keystone pela do líder; "Limitado a: 1 Histórico".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste } = await import('./apoio.mjs');
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const Comandos = await import('../systems/passivas/comandos.mjs');
const AT = await import('../systems/itens-poe/atemporais.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');

J.iniciar(ITEM_CATALOG);
const unicos = () => Catalogo.catalogo().classes.Jewels.unicos;
/** A Atemporal `slug` (o sorteio `rng`: 0 → o primeiro líder e a menor semente). */
function atemporal(slug, rng = () => 0) {
  const u = unicos().find((x) => x.slug === slug);
  const base = Catalogo.catalogo().classes.Jewels.bases.find((b) => b.nome === u.base);
  return J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: base.id, raridade: 'unico', ilvl: 80, rng, unico: slug }));
}
function personagem(alocados, encaixe) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 90 });
  e.sistema = 'poe';
  e.classePoe = 'Marauder';
  P.garantir(e);
  e.passivas.alocados.push(encaixe, ...alocados);
  P.garantir(e);
  e.inventory = [];
  return e;
}
const encaixar = (e, peca, no) => { e.inventory.push(peca); return Comandos.comando(e, { action: 'encaixarJoia', no, pilha: e.inventory.length - 1, id: peca.id }); };
const ehPassiva = (n) => !n.ascendencia && ['small', 'notable', 'keystone'].includes(n.tipo) && !/Jewel Socket|Proxy/i.test(`${n.nomeEn ?? ''} ${n.nome ?? ''}`);
const dist = (n, x) => Math.hypot(n.x - x.x, n.y - x.y);
/** O primeiro encaixe com um nó de cada filtro no raio Grande: `{ encaixe, nos }`. */
function acharEncaixe(filtros) {
  for (const x of P.arvore().nos.filter((n) => P.ehEncaixeDeJoia(n))) {
    const nos = filtros.map((f) => P.arvore().nos.find((n) => ehPassiva(n) && dist(n, x) <= P.RAIOS_DE_JOIA.grande && f(n)));
    if (nos.every(Boolean) && new Set(nos.map((n) => n.id)).size === nos.length) return { encaixe: x.id, nos };
  }
  return null;
}
const adds = (e) => ({ ...P.efeitos(e).adds });

test('os DADOS do PoB: os 23 líderes, as 337 adições, os 454 notáveis da tabela e as sementes de cada joia', { skip: SEM }, () => {
  const d = AT.dados();
  assert.equal(Object.keys(d.lideres).length, 23);
  assert.deepEqual(d.lideres.kaom, { tipo: 'karui', id: '1' });
  assert.deepEqual(d.lideres.akoya, { tipo: 'karui', id: '3_v2' });
  assert.equal(d.adicoesTotal, 337);
  assert.equal(d.notaveis, 454);
  assert.deepEqual(d.sementes[2], [10000, 18000]);
  // a tabela do Orgulho Letal: um byte por notável e semente; fora da faixa, nada
  const notavel = Object.keys(d.indice).find((k) => d.indice[k] === 0);
  assert.equal(AT.lerTabela(2, 12345, notavel).length, 1);
  assert.deepEqual(AT.lerTabela(2, 9999, notavel), []);
  // a Arrogância Elegante: a semente de 20 em 20
  assert.deepEqual(AT.lerTabela(5, 40001, notavel), []);
  assert.equal(AT.lerTabela(5, 40000, notavel).length, 1);
});

test('a PEÇA sorteia o líder e a semente — a linha com o nome dele e o atributo da conquista; a Arrogância Elegante de 20 em 20', { skip: SEM }, () => {
  const lp = atemporal('Lethal_Pride');
  const linha = lp.poe.mods?.find?.((m) => /Liderança comandada/.test(m.modelo ?? m.texto ?? '')) ?? null;
  assert.equal(AT.conquistaDaPeca(lp)?.tipo, 'karui');
  assert.deepEqual(AT.conquistaDaPeca(lp), { tipo: 'karui', id: '3_v2', semente: 10000 }, 'rng 0: Akoya, a menor semente');
  void linha;
  const eh = atemporal('Elegant_Hubris', () => 0.37);
  assert.equal(AT.conquistaDaPeca(eh).semente % 20, 0);
  for (const slug of ['Glorious_Vanity', 'Brutal_Restraint', 'Militant_Faith', 'Heroic_Tragedy']) assert.ok(AT.conquistaDaPeca(atemporal(slug)), slug);
  assert.equal(Number(lp.poe.af.historico), 1);
});

test('a CONQUISTA dos Karui nos nós alocados do raio: o notável ganha a adição da tabela; a pequena +4 de Força; a de atributo +2', { skip: SEM }, () => {
  const d = AT.dados();
  const achado = acharEncaixe([(n) => n.tipo === 'notable' && d.indice[n.id] != null, (n) => n.tipo === 'small' && n.nomeEn !== 'Strength' && n.nomeEn !== 'Dexterity' && n.nomeEn !== 'Intelligence', (n) => n.tipo === 'small' && n.nomeEn === 'Strength']);
  assert.ok(achado, 'um encaixe com os três tipos no raio');
  const [notavel, pequeno, atributo] = achado.nos;
  const e = personagem(achado.nos.map((n) => n.id), achado.encaixe);
  const antes = adds(e);
  const lp = atemporal('Lethal_Pride');
  assert.equal(encaixar(e, lp, achado.encaixe).ok, true);
  const depois = adds(e);
  const c = AT.conquistaDaPeca(lp);
  const doNotavel = AT.conquista(notavel, c);
  assert.equal(doNotavel.substitui, false, 'os Karui somam ao notável');
  // a Força: +4 da pequena e +2 da de atributo, mais a do notável se a adição dele for Força
  const forcaDoNotavel = AT.efeitosDasLinhas(doNotavel.linhas).filter((x) => x.add === 'str').reduce((t, x) => t + x.valor, 0);
  assert.equal((depois.str ?? 0) - (antes.str ?? 0), 4 + 2 + forcaDoNotavel);
  assert.deepEqual(AT.conquista(pequeno, c).linhas, ['+4 de Força']);
  assert.deepEqual(AT.conquista(atributo, c).linhas, ['+2 de Força']);
});

test('a CONQUISTA que SUBSTITUI: o Império Eterno apaga as pequenas; os Templários trocam a de atributo pelo nó de Devoção (+10)', { skip: SEM }, () => {
  const achado = acharEncaixe([(n) => n.tipo === 'small' && n.nomeEn === 'Strength', (n) => n.tipo === 'small' && (n.efeitos ?? []).some((x) => x.add)]);
  const [atributo, pequeno] = achado.nos;
  const eh = personagem([atributo.id, pequeno.id], achado.encaixe);
  const antes = adds(eh);
  assert.equal(encaixar(eh, atemporal('Elegant_Hubris'), achado.encaixe).ok, true);
  const depois = adds(eh);
  for (const ef of pequeno.efeitos.filter((x) => x.add)) assert.equal(Math.round(((depois[ef.add] ?? 0) - (antes[ef.add] ?? 0)) * 100) / 100, -ef.valor, `a pequena some: ${ef.add}`);
  const mf = personagem([atributo.id], achado.encaixe);
  const a2 = adds(mf);
  assert.equal(encaixar(mf, atemporal('Militant_Faith'), achado.encaixe).ok, true);
  assert.equal((adds(mf).devocao ?? 0) - (a2.devocao ?? 0), 10);
  assert.equal((a2.str ?? 0) - (adds(mf).str ?? 0), 10, 'os +10 de Força do nó de atributo saem');
});

test('a KEYSTONE no raio vira a do líder: a mecânica da de antes sai', { skip: SEM }, () => {
  const achado = acharEncaixe([(n) => n.tipo === 'keystone' && n.keystone && (n.keystone.regra === 'poe' || n.keystone.regra === 'habilidade')]);
  assert.ok(achado, 'um encaixe com uma keystone de mecânica no raio');
  const [ks] = achado.nos;
  const e = personagem([ks.id], achado.encaixe);
  assert.equal(P.temHabilidade(e, ks.keystone.id), true);
  assert.equal(encaixar(e, atemporal('Brutal_Restraint'), achado.encaixe).ok, true);
  assert.equal(P.temHabilidade(e, ks.keystone.id), false, 'conquistada: a de antes sai');
  const k = P.efeitos(e).keystones.find((x) => x.no === ks.id);
  assert.equal(k.conquistada, true);
  assert.equal(k.nome, 'Dance with Death', 'rng 0: Asenath (Maraketh 2) — a Dança com a Morte');
});

test('"Limitado a: 1 Histórico": a segunda Atemporal não entra em outro encaixe', { skip: SEM }, () => {
  const encaixes = P.arvore().nos.filter((n) => P.ehEncaixeDeJoia(n)).slice(0, 2).map((n) => n.id);
  const e = personagem([encaixes[1]], encaixes[0]);
  assert.equal(encaixar(e, atemporal('Lethal_Pride'), encaixes[0]).ok, true);
  const r = encaixar(e, atemporal('Glorious_Vanity'), encaixes[1]);
  assert.equal(r.ok, false);
  assert.equal(r.motivo, 'LIMITE');
});

test('as LINHAS das Atemporais com efeito (o líder e a semente; o "Conquistadas" e o "Histórico")', { skip: SEM }, () => {
  const t = (modelo, valores = []) => T.traduzirMod({ modelo, valores });
  assert.equal(t('Liderança comandada de {0} guerreiros de Kaom / Passivas no raio são Conquistadas pelos Karui', [12000]).estado, 'novo');
  assert.equal(t('Liderança comandada de {0} guerreiros de Kaom / Passivas no raio são Conquistadas pelos Karui', [12000]).partes[0].efeitos[0].stat, 'atemporal_karui_1');
  assert.equal(t('Lembrança de {0} feitos dignos de canções da linhagem de Uhtred / Passivas no raio de alcance são conquistadas pelos kalguuranos', [300]).partes[0].efeitos[0].stat, 'atemporal_kalguur_2');
  assert.equal(t('Banhado no sangue de {0} sacrificados em nome de Doryani / Passivas no raio são Conquistadas pelos Vaal', [500]).partes[0].efeitos[0].stat, 'atemporal_vaal_3');
  assert.equal(t('Histórico').estado, 'novo');
});
