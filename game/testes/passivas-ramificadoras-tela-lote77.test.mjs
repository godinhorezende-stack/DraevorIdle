// LOTE 77 — as RAMIFICADORAS na TELA (o passo 3, parte 1): a árvore do personagem no cliente (`frontend/client/src/passivas-grafo.mjs`, sem
// DOM) é a mesma do servidor (`passivas/arvore.grafoDe`) — as mesmas ligações em todo nó, o mesmo caminho, o mesmo estado, o mesmo "sem este
// nó" e os mesmos nós da joia. Como no PoE (o PoB tira da árvore os proxies e os encaixes internos), o que só existe com a joia não aparece sem
// ela, nem o fundo do grupo do proxy; com ela, o fundo do tamanho da joia. O quadro do encaixe oferece só a joia que cabe (os textos do
// servidor) e a prévia de tirar a Ramificadora é a do servidor. E a regra do PoE: o encaixe que a Ramificadora cria não tem raio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste } = await import('./apoio.mjs');
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const Joias = await import('../systems/passivas/joias.mjs');
await import('../systems/passivas/ramificadoras.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
await (await import('../systems/itens-poe/iniciar.mjs')).iniciarJogoDoPoe();
const G = await import('../frontend/client/src/passivas-grafo.mjs');

J.iniciar(ITEM_CATALOG);
const semeado = (s) => {
  let x = (s * 7919 + 104729) % 2147483647;
  const proximo = () => ((x = (x * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < 4; i++) proximo();
  return proximo;
};
const gerar = (base, raridade = 'raro', s = 1) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade, ilvl: 84, rng: semeado(s) }));
const ramificadora = (tamanho, s = 1) => gerar(`Jewels/${tamanho}_Cluster_Jewel`, 'raro', s);
function unica(slug) {
  const u = Catalogo.catalogo().classes.Jewels.unicos.find((x) => x.slug === slug);
  const base = Catalogo.catalogo().classes.Jewels.bases.find((b) => b.nome === u.base);
  return J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: base.id, raridade: 'unico', ilvl: 80, rng: () => 0, unico: slug }));
}
function personagem() {
  const e = personagemDeTeste({ vocacao: 'knight', level: 100 });
  e.sistema = 'poe';
  e.classePoe = 'Marauder';
  P.garantir(e);
  e.inventory = [];
  e.level = 100;
  return e;
}
const alocarAte = (e, id) => {
  const caminho = P.caminhoAte(e, id);
  assert.ok(caminho?.length, `há caminho até ${id}`);
  for (const x of caminho) assert.ok(P.alocar(e, x).ok, `${x}: ${JSON.stringify(P.podeAlocar(e, x))}`);
  return caminho;
};
const encaixar = (e, no, joia) => {
  e.inventory.push(joia);
  return Joias.encaixar(e, { no, pilha: e.inventory.length - 1, id: joia.id });
};
// o que o navegador recebe (pelo fio: JSON) — a árvore uma vez, a vista a cada resposta
const doFio = (x) => JSON.parse(JSON.stringify(x));
let BASE_JSON = null;
const base = () => G.prepararArvore(doFio(BASE_JSON ??= P.arvoreParaCliente()), (n) => String(n.nome ?? '').toLowerCase());
const naTela = (e, b = base()) => {
  const v = doFio(P.vista(e));
  return { v, a: G.arvoreDoPersonagem(b, v), b };
};
/** O personagem com a Grande no 2491, o encaixe interno dela alocado com a Média e um nó da Média alocado. */
function comAsDuas() {
  const e = personagem();
  alocarAte(e, '2491');
  assert.ok(encaixar(e, '2491', ramificadora('Large', 5)).ok);
  const interno = P.nosDaRamificadora(e, '2491').find((id) => P.grafoDe(e).internos.has(id));
  alocarAte(e, interno);
  assert.ok(encaixar(e, interno, ramificadora('Medium', 4)).ok);
  const daMedia = P.nosDaRamificadora(e, interno);
  alocarAte(e, daMedia.find((id) => !P.grafoDe(e).internos.has(id)));
  return { e, interno };
}

test('a ÁRVORE BASE na tela: os 42 encaixes de expansão com o tamanho e o proxy, os 42 fundos dos proxies marcados e as arestas de sempre', { skip: SEM }, () => {
  const b = base();
  const exp = b.nos.filter((n) => n.expansao);
  assert.equal(exp.length, 42);
  assert.deepEqual([2, 1, 0].map((t) => exp.filter((n) => n.expansao.tamanho === t).length), [6, 18, 18]);
  for (const n of exp) assert.ok(b.porId.get(n.expansao.proxy)?.grupoDoProxy, `${n.id}: o proxy ${n.expansao.proxy} tem o centro do grupo`);
  // os centros dos grupos dos proxies são fundos de grupo das folhas (a tela os esconde sem a joia)
  const sprites = JSON.parse(readFileSync(new URL('../gamedata/itens-poe/arvore-sprites.json', import.meta.url), 'utf8'));
  const fundos = new Set(sprites.grupos.map(([x, y]) => `${x},${y}`));
  assert.ok(b.gruposDeProxy.size > 0 && b.gruposDeProxy.size <= 42);
  for (const k of b.gruposDeProxy) assert.ok(fundos.has(k), k);
  // as arestas: as mesmas pares de antes (n.id < c), cada um uma vez
  const antes = new Set();
  for (const n of b.nos) for (const c of n.conexoes) if (n.id < c) antes.add(`${n.id}|${c}`);
  const agora = b.arestas.map(([x, y]) => (x.id < y.id ? `${x.id}|${y.id}` : `${y.id}|${x.id}`));
  assert.equal(new Set(agora).size, agora.length, 'nenhuma aresta repetida');
  assert.deepEqual(new Set(agora), antes);
  // sem Ramificadora, a árvore do personagem é a base; os 78 só com a joia ficam escondidos
  const { a } = naTela(personagem(), b);
  assert.equal(a, b);
  assert.equal(b.nos.filter(G.escondido).length, 78);
  assert.ok(!G.escondido(b.porId.get('2491')));
});

test('ENCAIXADAS a Grande e a Média: a árvore da tela é a do servidor — as ligações de todo nó, o caminho, o estado e o "sem este nó"', { skip: SEM }, () => {
  const { e, interno } = comAsDuas();
  const { v, a, b } = naTela(e);
  const g = P.grafoDe(e);
  assert.notEqual(a, b);
  // as mesmas ligações em TODO nó da árvore do personagem (a base, os da joia, o encaixe da borda com a entrada)
  assert.equal(a.porId.size, g.porId.size);
  for (const [id, n] of g.porId) assert.deepEqual(new Set(a.porId.get(id)?.conexoes ?? []), new Set(n.conexoes ?? []), `as ligações de ${id}`);
  // os da joia aparecem (o encaixe interno dela como encaixe de joia, com o tamanho); o resto que só existe com a joia, não
  for (const id of g.extras.keys()) assert.ok(!G.escondido(a.porId.get(id)), `${id} aparece`);
  const internoNaTela = a.porId.get(interno);
  assert.equal(internoNaTela.encaixeDeJoia, true);
  assert.equal(internoNaTela.encaixeInterno, true);
  assert.equal(internoNaTela.expansao.tamanho, 1);
  const escondidos = a.nos.filter(G.escondido).map((n) => n.id);
  assert.ok(escondidos.every((id) => P.soDaRamificadora(g.porId.get(id)) && !g.internos.has(id)));
  assert.equal(escondidos.length, 78 - [...g.internos].filter((id) => P.soDaRamificadora(P.arvore().porId.get(id))).length);
  // a busca acha os nós da joia
  const notavel = [...g.extras.values()].find((n) => n.tipo === 'notable');
  if (notavel) assert.ok(a.porId.get(notavel.id).busca.includes(notavel.nome.toLowerCase()));
  // o CAMINHO: o mesmo do servidor (os da joia, os vizinhos deles e uma amostra da árvore)
  const amostra = new Set([...g.extras.keys(), ...[...g.extras.values()].flatMap((n) => n.conexoes), ...P.arvore().nos.filter((_, i) => i % 15 === 0).map((n) => n.id)]);
  for (const id of amostra) assert.deepEqual(G.caminhoAte(a, v, id), P.caminhoAte(e, id), `o caminho até ${id}`);
  // o ESTADO: "disponível" é o que o servidor deixa alocar pela ligação (sem contar ponto nem level)
  const meus = new Set(e.passivas.alocados);
  for (const n of a.nos) {
    if (meus.has(n.id) || n.tipo === 'start' || n.tipo === 'mastery' || n.ascendencia) continue;
    const motivo = P.podeAlocar(e, n.id).motivo;
    assert.equal(G.estadoDoNo(a, v, n) === 'disponivel', !['SEM_CAMINHO', 'RAMIFICADORA'].includes(motivo), `${n.id} ${n.nome}: ${motivo}`);
  }
  // o "SEM ESTE NÓ": o que fica é o que o servidor não ilha
  for (const id of e.passivas.alocados) {
    if (P.arvore().porId.get(id)?.tipo === 'start') continue;
    const ilhados = new Set(P.ilhadosSemEles(e, [id]));
    assert.deepEqual(new Set(G.ficamSem(a, v, id)), new Set(e.passivas.alocados.filter((x) => x !== id && !ilhados.has(x))), `sem ${id}`);
  }
  // os nós de cada joia (com os da Média dentro da Grande)
  assert.deepEqual(new Set(G.nosDaJoia(a, '2491')), new Set(P.nosDaRamificadora(e, '2491')));
  assert.deepEqual(new Set(G.nosDaJoia(a, interno)), new Set(P.nosDaRamificadora(e, interno)));
  // os FUNDOS: o da Grande (o meio-fundo grande) no centro do grupo do proxy do 2491 e o da Média no do proxy do encaixe interno
  const fundo = (encaixe) => a.ativas.find((x) => x.encaixe === encaixe);
  const centro = (encaixe) => a.porId.get(a.porId.get(encaixe).expansao.proxy).grupoDoProxy;
  assert.equal(a.ativas.length, 2);
  assert.deepEqual(fundo('2491'), { encaixe: '2491', tamanho: 'Large', x: centro('2491')[0], y: centro('2491')[1], fundo: 'PSGroupBackground3', meio: true });
  assert.deepEqual(fundo(interno), { encaixe: interno, tamanho: 'Medium', x: centro(interno)[0], y: centro(interno)[1], fundo: 'PSGroupBackground2', meio: false });
  for (const x of a.ativas) assert.ok(b.gruposDeProxy.has(`${x.x},${x.y}`));
  // memorizada: a mesma vista (ou uma igual, de outra resposta) dá a mesma árvore; a base não muda
  assert.equal(G.arvoreDoPersonagem(b, v), a);
  assert.equal(G.arvoreDoPersonagem(b, doFio(v)), a);
  assert.deepEqual(b.porId.get('2491').conexoes, P.arvore().porId.get('2491').conexoes);
  assert.ok(G.escondido(b.porId.get(interno)), 'na base, o encaixe interno segue só com a joia');
});

test('TIRAR a Grande: a prévia da tela (os nós que saem, o preço e a joia de dentro) é o que o servidor faz', { skip: SEM }, () => {
  const { e, interno } = comAsDuas();
  const { v, a } = naTela(e);
  const prev = G.soltarJoia(a, v, '2491');
  const dela = new Set(P.nosDaRamificadora(e, '2491'));
  assert.deepEqual(new Set(prev.sai), new Set(e.passivas.alocados.filter((x) => dela.has(x))));
  assert.ok(prev.sai.includes(interno));
  // (um encaixe interno alocado nela: custa o preço de 1 nó no respec — de graça no jogo oficial)
  assert.equal(prev.preco, P.precoDoRespec(e, 1));
  assert.deepEqual(prev.menores.map((p) => p.poe.ramificadora.tamanho), ['Medium']);
  // a Média sozinha (sem nada alocado dentro dela, sem joia dentro): nada a confirmar
  const soMedia = G.soltarJoia(a, v, interno);
  assert.equal(soMedia.menores.length, 0);
  assert.equal(soMedia.sai.length, 1);
  const usados = P.pontos(e).usados;
  assert.ok(Joias.retirar(e, { no: '2491' }).ok);
  P.garantir(e);
  assert.equal(P.pontos(e).usados, usados - prev.sai.length, 'saem os nós da prévia');
  // sem a joia, a árvore da tela volta a ser a base
  const depois = naTela(e);
  assert.equal(depois.a, depois.b);
  assert.equal(G.soltarJoia(depois.a, depois.v, '2491'), null);
});

test('CABE no encaixe: a tela recusa o que o servidor recusa, com o texto dele; o que cada encaixe de expansão aceita', { skip: SEM }, () => {
  const { e, interno } = comAsDuas();
  const { a } = naTela(e);
  const basico = P.arvore().nos.find((n) => n.nomeEn === 'Basic Jewel Socket' && P.caminhoAte(e, n.id)?.length < 14);
  alocarAte(e, basico.id);
  const pequenoDaMedia = P.nosDaRamificadora(e, interno).find((id) => P.grafoDe(e).internos.has(id));
  const casos = [[basico.id, 'Small'], [interno, 'Large'], ...(pequenoDaMedia ? [[pequenoDaMedia, 'Medium']] : [])];
  if (pequenoDaMedia) alocarAte(e, pequenoDaMedia);
  const naTelaAgora = naTela(e).a;
  for (const [no, tamanho] of casos) {
    const joia = ramificadora(tamanho, 7);
    const r = encaixar(e, no, joia);
    assert.equal(r.ok, false, `${tamanho} em ${no}`);
    assert.equal(G.porqueNaoCabe(naTelaAgora.porId.get(no), joia), r.erro, `${tamanho} em ${no}: ${r.motivo}`);
  }
  // o que cabe: a joia comum em todos; a Ramificadora até o tamanho do encaixe
  assert.equal(G.porqueNaoCabe(a.porId.get(basico.id), gerar('Jewels/Crimson_Jewel')), null);
  assert.equal(G.porqueNaoCabe(a.porId.get(interno), ramificadora('Small', 2)), null);
  assert.equal(G.porqueNaoCabe(a.porId.get('2491'), ramificadora('Medium', 2)), null);
  assert.equal(G.textoDoEncaixe(a.porId.get('2491')), 'Encaixe Grande de expansão: aceita joias comuns e Joias Ramificadoras Grandes, Médias e Pequenas.');
  assert.equal(G.textoDoEncaixe(a.porId.get(interno)), 'Encaixe Médio de expansão: aceita joias comuns e Joias Ramificadoras Médias e Pequenas.');
  if (pequenoDaMedia) assert.equal(G.textoDoEncaixe(naTelaAgora.porId.get(pequenoDaMedia)), 'Encaixe Pequeno de expansão: aceita joias comuns e Joias Ramificadoras Pequenas.');
  assert.equal(G.textoDoEncaixe(a.porId.get(basico.id)), null);
});

test('o RAIO no encaixe que a Ramificadora cria não vale (o PoE: o encaixe dela não tem raio) — no encaixe da árvore, sim', { skip: SEM }, () => {
  const e = personagem();
  alocarAte(e, '2491');
  assert.ok(encaixar(e, '2491', ramificadora('Large', 5)).ok);
  const interno = P.nosDaRamificadora(e, '2491').find((id) => P.grafoDe(e).internos.has(id));
  alocarAte(e, interno);
  const salto = unica('Intuitive_Leap');
  assert.deepEqual(P.raioDaJoia(salto), { min: 0, max: 960 });
  assert.ok(encaixar(e, interno, salto).ok, 'a joia comum entra no encaixe interno');
  assert.ok(P.joiasAtivas(e).some((j) => j.no.id === interno), 'as linhas dela valem');
  assert.ok(!P.joiasComRaio(e).some((j) => j.no.id === interno));
  assert.equal(P.vista(e).raios?.[interno], undefined, 'a tela não desenha raio ali');
  assert.equal(P.liberadosPorJoias(e).size, 0, 'o Salto Intuitivo não libera nada dali');
  // a mesma joia no Grande da borda (encaixe da árvore): o raio vale
  assert.ok(Joias.retirar(e, { no: interno }).ok);
  assert.ok(Joias.retirar(e, { no: '2491' }).ok);
  P.garantir(e);
  const i = e.inventory.findIndex((p) => p?.poe?.unico === 'Intuitive_Leap');
  assert.ok(Joias.encaixar(e, { no: '2491', pilha: i, id: e.inventory[i].id }).ok);
  assert.deepEqual(P.vista(e).raios?.['2491'], { min: 0, max: 960 });
  assert.ok(P.liberadosPorJoias(e).size > 0);
});

test('no encaixe da Ramificadora, o que NÃO é raio do encaixe vale: o Talento Puro e a Fuga Impossível (em volta da pedra fundamental — o PoB)', { skip: SEM }, () => {
  const comInterno = () => {
    const e = personagem();
    alocarAte(e, '2491');
    assert.ok(encaixar(e, '2491', ramificadora('Large', 5)).ok);
    const interno = P.nosDaRamificadora(e, '2491').find((id) => P.grafoDe(e).internos.has(id));
    alocarAte(e, interno);
    return { e, interno };
  };
  // o Talento Puro (Marauder: a sua classe) — +25% de Área corpo a corpo de qualquer encaixe
  const t = comInterno();
  const antes = P.efeitos(t.e).adds['area_inc@corpo'] ?? 0;
  assert.ok(encaixar(t.e, t.interno, unica('Pure_Talent')).ok);
  assert.equal((P.efeitos(t.e).adds['area_inc@corpo'] ?? 0) - antes, 25);
  // a Fuga Impossível: os nós em volta da pedra sorteada ficam livres também dali
  const f = comInterno();
  const fuga = unica('Impossible_Escape');
  assert.ok(Object.keys(fuga.poe.af ?? {}).some((k) => k.startsWith('fuga_impossivel:')), 'a pedra sorteada');
  assert.ok(encaixar(f.e, f.interno, fuga).ok);
  assert.ok(P.liberadosPorJoias(f.e).size > 0, 'a Fuga libera os nós da pedra');
  assert.ok([...P.liberadosPorJoias(f.e).values()].every((s) => s === f.interno));
});
