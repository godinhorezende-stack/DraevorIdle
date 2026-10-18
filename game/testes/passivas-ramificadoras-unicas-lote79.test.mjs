// LOTE 79 — as RAMIFICADORAS ÚNICAS (o passo 4): a Vozes (Grande: 3 encaixes + N pequenas que não concedem nada), o Megalomaníaco (Média: 4 nós,
// as pequenas sem nada e 3 notáveis sorteados de TODOS os tamanhos — o poedb: "All non-unique notables from any size cluster jewels have a chance
// to roll", 287 mods de peso 1000, com o nível de cada um) e as 7 Pequenas da pedra fundamental (1 nó, no centro do grupo do proxy, ligado ao
// encaixe — o PoB). A única não leva os implícitos da base nem encantamento, e é Ramificadora (só em encaixe de expansão, monta os nós).
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
const Joias = await import('../systems/passivas/joias.mjs');
await import('../systems/passivas/ramificadoras.mjs');
const Gerar = await import('../systems/itens-poe/gerar.mjs');
const { gerarPeca } = Gerar;
await (await import('../systems/itens-poe/iniciar.mjs')).iniciarJogoDoPoe();

J.iniciar(ITEM_CATALOG);
const semeado = (s) => {
  let x = (s * 7919 + 104729) % 2147483647;
  const proximo = () => ((x = (x * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < 4; i++) proximo();
  return proximo;
};
const cat = () => Catalogo.catalogo();
const unica = (slug, s = 1, ilvl = 84) => {
  const u = cat().classes.Jewels.unicos.find((x) => x.slug === slug);
  const base = cat().classes.Jewels.bases.find((b) => b.nome === u.base);
  return J.pecaDoJogo(gerarPeca({ catalogo: cat(), regras: Catalogo.REGRAS, base: base.id, raridade: 'unico', ilvl, rng: semeado(s), unico: slug }));
};
function comEncaixe() {
  const e = personagemDeTeste({ vocacao: 'knight', level: 100 });
  e.sistema = 'poe';
  e.classePoe = 'Marauder';
  P.garantir(e);
  e.inventory = [];
  e.level = 100;
  for (const x of P.caminhoAte(e, '2491')) assert.ok(P.alocar(e, x).ok);
  return e;
}
const encaixar = (e, no, peca) => {
  e.inventory.push(peca);
  return Joias.encaixar(e, { no, pilha: e.inventory.length - 1, id: peca.id });
};
const PEQUENAS = { One_With_Nothing: 'Hollow Palm Technique', Kitavas_Teachings: 'Disciple of Kitava', The_Interrogation: 'Secrets of Suffering', Calamitous_Visions: 'Lone Messenger', Natural_Affinity: "Nature's Patience", The_Siege: 'Kineticism', The_Front_Line: "Veteran's Awareness" };

test('a PEÇA única: sem os implícitos da base nem encantamento; é Ramificadora do tamanho da base', { skip: SEM }, () => {
  for (const [slug, tamanho] of [['Voices', 'Large'], ['Megalomaniac', 'Medium'], ...Object.keys(PEQUENAS).map((s) => [s, 'Small'])]) {
    const { poe } = unica(slug);
    assert.deepEqual(poe.implicitos, [], slug);
    assert.deepEqual(poe.ramificadora, { tamanho, encantamento: null, tag: null, unico: true }, slug);
    assert.ok(!poe.modificadores.some((m) => /\[.*random/i.test(m.texto)), `${slug}: sem a marcação`);
  }
});

test('o MEGALOMANÍACO: 3 notáveis distintos do pool de todos os tamanhos (287), pelo nível do mod; o Orbe Divino mantém os notáveis', { skip: SEM }, () => {
  const pool = cat().classes.Jewels.unicos.find((u) => u.slug === 'Megalomaniac').linhasSorteadas.linhas;
  assert.equal(pool.length, 287);
  assert.equal(new Set(pool.map((l) => l.notavel)).size, 286);
  const tamanhos = new Set();
  for (let s = 1; s <= 40; s++) {
    const { poe } = unica('Megalomaniac', s);
    const ns = poe.modificadores.filter((m) => m.notavel).map((m) => m.notavel);
    assert.equal(ns.length, 3, `semente ${s}`);
    assert.equal(new Set(ns).size, 3);
    for (const n of ns) assert.ok(cat().ramificadoras.notaveis[n], n);
    for (const n of ns) for (const [t, d] of Object.entries(cat().ramificadoras.tamanhos)) if (d.encantamentos.some((e) => (e.notaveis ?? []).some((x) => x.nome === n))) tamanhos.add(t);
  }
  assert.ok(tamanhos.has('Large') && tamanhos.has('Small'), `notáveis de ${[...tamanhos]}`);
  // Item Level baixo: só os mods de nível ≤ ele
  const baixos = new Set(pool.filter((l) => l.nivel <= 1).map((l) => l.notavel));
  for (let s = 1; s <= 10; s++) for (const m of unica('Megalomaniac', s, 1).poe.modificadores.filter((x) => x.notavel)) assert.ok(baixos.has(m.notavel), m.notavel);
  // o Divino
  const peca = unica('Megalomaniac', 5);
  const antes = peca.poe.modificadores.filter((m) => m.notavel).map((m) => m.notavel).sort();
  // (o Orbe Divino sorteia de novo só os valores das linhas que a peça tem — `gerar.modificadoresDoUnico` com `manter`)
  const u = cat().classes.Jewels.unicos.find((x) => x.slug === 'Megalomaniac');
  const novos = Gerar.modificadoresDoUnico(u, semeado(9), new Set(peca.poe.modificadores.map((m) => m.modelo))).filter((m) => m.notavel).map((m) => m.notavel).sort();
  assert.deepEqual(novos, antes);
});

test('na ÁRVORE: a Vozes (3 encaixes + 7 "Nada"), o Megalomaníaco (4 nós, 3 notáveis) e a pedra da Pequena (1 nó no centro do grupo do proxy)', { skip: SEM }, () => {
  const e = comEncaixe();
  assert.ok(encaixar(e, '2491', unica('Voices')).ok);
  const g = () => P.grafoDe(e);
  let nos = P.nosDaRamificadora(e, '2491').map((id) => g().porId.get(id));
  assert.equal(nos.length, 10);
  assert.equal(nos.filter((n) => n.encaixeInterno).length, 3);
  assert.ok(nos.filter((n) => !n.encaixeInterno).every((n) => n.nome === 'Nada' && !n.efeitos.length));
  // o Megalomaníaco num encaixe interno da Vozes; a pedra noutro
  const [i1, i2] = nos.filter((n) => n.encaixeInterno).map((n) => n.id);
  for (const x of P.caminhoAte(e, i1)) assert.ok(P.alocar(e, x).ok);
  for (const x of P.caminhoAte(e, i2)) assert.ok(P.alocar(e, x).ok);
  assert.ok(encaixar(e, i1, unica('Megalomaniac', 3)).ok);
  const mega = P.nosDaRamificadora(e, i1).map((id) => g().porId.get(id));
  assert.equal(mega.length, 4);
  assert.equal(mega.filter((n) => n.tipo === 'notable').length, 3);
  assert.ok(mega.filter((n) => n.tipo === 'notable').every((n) => n.efeitos.length > 0));
  assert.ok(encaixar(e, i2, unica('The_Siege')).ok);
  const [pedra] = P.nosDaRamificadora(e, i2).map((id) => g().porId.get(id));
  assert.equal(pedra.tipo, 'keystone');
  assert.equal(pedra.nome, 'Cineticismo');
  assert.equal(pedra.nomeEn, 'Kineticism');
  assert.deepEqual(pedra.conexoes, [i2]);
  const proxy = P.arvore().porId.get(String(P.arvore().porId.get(i2).expansao.proxy));
  assert.ok(Math.abs(pedra.x - proxy.proxy.grupo.x) < 0.01 && Math.abs(pedra.y - proxy.proxy.grupo.y) < 0.01, 'no centro do grupo do proxy');
  // aloca-se pelo encaixe; tirar com a pedra alocada custa (o PoE: o reembolso de 1 ponto)
  assert.deepEqual(P.caminhoAte(e, pedra.id), [pedra.id]);
  assert.ok(P.alocar(e, pedra.id).ok);
  // a tela recebe a pedra com a arte
  const naVista = P.vista(e).ramificadoras.nos.find((n) => n.id === pedra.id);
  assert.equal(naVista.tipo, 'keystone');
  assert.ok(naVista.arte);
});

test('as 7 PEQUENAS: cada uma a sua pedra (por slug — "Mensageiro" é o Mensageiro Solitário); só em encaixe de expansão; a linha leva o estado da pedra', { skip: SEM }, () => {
  for (const [slug, en] of Object.entries(PEQUENAS)) {
    const e = comEncaixe();
    const peca = unica(slug);
    assert.ok(encaixar(e, '2491', peca).ok, slug);
    const nos = P.nosDaRamificadora(e, '2491').map((id) => P.grafoDe(e).porId.get(id));
    assert.equal(nos.length, 1, slug);
    assert.equal(nos[0].nomeEn, en);
    const linhas = nos[0].textos;
    assert.ok(linhas.length >= 1 && linhas.every((l) => !l.includes('\n')), `${slug}: as linhas separadas`);
    assert.equal(peca.poe.estados.length, 1);
  }
  // num encaixe que não é de expansão, não entra (é Ramificadora)
  const e = comEncaixe();
  const basico = P.arvore().nos.find((n) => n.nomeEn === 'Basic Jewel Socket' && P.caminhoAte(e, n.id)?.length < 14);
  for (const x of P.caminhoAte(e, basico.id)) assert.ok(P.alocar(e, x).ok);
  assert.equal(encaixar(e, basico.id, unica('The_Siege')).motivo, 'RAMIFICADORA_FORA');
});

test('o ORBE DIVINO de verdade: o Megalomaníaco com um modelo repetido (Olho Perverso, Inspiração Ancestral) fica com os mesmos notáveis; a Vozes, na variante dela', { skip: SEM }, async () => {
  const M = await import('../systems/itens-poe/moedas.mjs');
  const usar = (p, s) => {
    const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { inventory: [structuredClone(p), { id: M.idDa('Divine_Orb'), count: 1 }] });
    const r = M.usar(e, { moeda: M.idDa('Divine_Orb'), alvo: { onde: 'inventory', indice: 0 } }, semeado(s));
    return { r, peca: e.inventory[0] };
  };
  const REPETIDOS = new Set(['Olho Perverso', 'Inspiração Ancestral', 'Inspiração Ancestral (Eldritch Inspiration)']);
  let conferidas = 0;
  for (let s = 1; s <= 600 && conferidas < 4; s++) {
    const p = unica('Megalomaniac', s);
    const ns = p.poe.modificadores.filter((m) => m.notavel).map((m) => m.notavel);
    if (!ns.some((n) => REPETIDOS.has(n))) continue;
    conferidas++;
    for (let k = 1; k <= 5; k++) {
      const { r, peca } = usar(p, s * 10 + k);
      assert.ok(r.ok, JSON.stringify(r));
      assert.deepEqual(peca.poe.modificadores.filter((m) => m.notavel).map((m) => m.notavel).sort(), [...ns].sort(), `semente ${s}`);
    }
  }
  assert.ok(conferidas >= 2, `${conferidas} Megalomaníacos com notável de modelo repetido`);
  // a Vozes de 5 pequenas (a 2ª variante do catálogo) continua com 5 depois do Divino
  const variantes = cat().classes.Jewels.unicos.filter((u) => u.slug === 'Voices');
  const de5 = variantes.find((u) => u.modificadores.some((m) => /Pequenas Habilidades Passivas que não concedem nada/.test(m.modelo) && m.faixas?.[0]?.[0] === 5));
  const base = cat().classes.Jewels.bases.find((b) => b.nome === de5.base);
  const vozes = J.pecaDoJogo(gerarPeca({ catalogo: cat(), regras: Catalogo.REGRAS, base: base.id, raridade: 'unico', ilvl: 84, rng: semeado(2), unico: de5 }));
  const nada = (p) => p.poe.modificadores.find((m) => /que não concedem nada/.test(m.modelo)).valores[0];
  assert.equal(nada(vozes), 5);
  assert.equal(nada(usar(vozes, 3).peca), 5);
});
