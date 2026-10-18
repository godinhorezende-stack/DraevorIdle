// LOTE 64 — as RAMIFICADORAS, o passo 2 (o servidor): a joia LIGADA à árvore do personagem (`passivas/arvore.grafoDe`). Encaixada num encaixe
// Grande da borda, os nós dela existem para o personagem: o caminho, alocar (1 ponto cada), os efeitos somados, o encaixe interno que recebe a
// joia menor (que monta os nós dela a partir dele) e a tela recebe os nós (`vista().ramificadoras`). As regras do PoE (o PoB:
// `IsItemValidForSlot`): a Ramificadora só num encaixe de expansão do tamanho dela ou maior; a joia comum em todos. Tirar a joia devolve os
// pontos dela (e a joia menor volta à mochila). As linhas da peça não somam no personagem (valem pelos nós). E ela ainda não cai (lote 82: cai, nos mapas — Item Level 68 para cima).
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
const Afixos = await import('../systems/afixos.mjs');
await import('../systems/passivas/ramificadoras.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
await (await import('../systems/itens-poe/iniciar.mjs')).iniciarJogoDoPoe();

J.iniciar(ITEM_CATALOG);
const semeado = (s) => {
  let x = (s * 7919 + 104729) % 2147483647;
  const proximo = () => ((x = (x * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < 4; i++) proximo();
  return proximo;
};
const gerar = (base, raridade = 'raro', s = 1) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade, ilvl: 84, rng: semeado(s) }));
/** Uma Ramificadora do tamanho com `encaixes` encaixes (a Grande: 2; a Média: 1). */
const ramificadora = (tamanho, s = 1) => gerar(`Jewels/${tamanho}_Cluster_Jewel`, 'raro', s);
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

test('o CATÁLOGO: as 3 Ramificadoras com ids fixos (7.800.021–023), joia, sem slot; (lote 82) caem do Item Level 68 para cima', { skip: SEM }, () => {
  ['Large', 'Medium', 'Small'].forEach((t, i) => {
    const id = J.idDaBase(`Jewels/${t}_Cluster_Jewel`);
    assert.equal(id, 7_800_021 + i);
    assert.equal(ITEM_CATALOG[id].joia, true);
  });
  const cat = Catalogo.catalogo();
  const base = cat.classes.Jewels.bases.find((b) => b.id === 'Jewels/Large_Cluster_Jewel');
  // (dono, 18/10, lote 82: "Só nos mapas" e "Pode ajustar" — as Ramificadoras caem, do Item Level 68 para cima; antes, "ainda não caem")
  for (const r of ['normal', 'magico', 'raro', 'unico']) assert.equal(J.podeCairComo(cat.classes.Jewels, base, r), true, r);
  assert.equal(J.pecaSorteada(80, semeado(3), Catalogo.REGRAS, 0, 'Jewels/Large_Cluster_Jewel')?.poe?.base, 'Jewels/Large_Cluster_Jewel');
  assert.equal(J.pecaSorteada(60, semeado(3), Catalogo.REGRAS, 0, 'Jewels/Large_Cluster_Jewel'), null, 'abaixo do Item Level 68, não');
});

test('ENCAIXADA na borda: os nós dela existem para o personagem — o caminho, alocar (1 ponto cada) e os efeitos somados', { skip: SEM }, () => {
  const e = personagem();
  alocarAte(e, '2491');
  const joia = ramificadora('Large', 5);
  assert.ok(encaixar(e, '2491', joia).ok);
  const nos = P.nosDaRamificadora(e, '2491');
  assert.ok(nos.length >= 8, `${nos.length} nós`);
  const g = P.grafoDe(e);
  const pequena = nos.map((id) => g.porId.get(id)).find((n) => n.tipo === 'small' && !n.encaixeInterno && n.efeitos.length);
  const antes = P.pontos(e).usados;
  const caminho = alocarAte(e, pequena.id);
  assert.equal(P.pontos(e).usados, antes + caminho.length, '1 ponto por nó');
  const ef = P.efeitos(e);
  for (const x of pequena.efeitos.filter((y) => y.add)) assert.ok((ef.adds[x.add] ?? 0) >= x.valor, `${x.add}: ${ef.adds[x.add]}`);
  // a tela recebe os nós (e a entrada no encaixe da borda)
  const v = P.vista(e);
  assert.ok(v.ramificadoras.nos.some((n) => n.id === pequena.id));
  assert.ok(v.ramificadoras.encaixes['2491'].includes(g.porId.get('2491').conexoes.at(-1)));
  // as linhas da peça não somam no personagem: só os nós alocados
  assert.ok(!Object.keys(Afixos.somaDeItens(e)).some((k) => /^poe\./.test(k)), 'nenhum atributo automático das linhas da joia');
});

test('as REGRAS do encaixe (o PoE): a Ramificadora só em encaixe de expansão do tamanho dela ou maior; a joia comum em todos', { skip: SEM }, () => {
  const e = personagem();
  // um encaixe Básico (não é de expansão)
  const basico = P.arvore().nos.find((n) => n.nomeEn === 'Basic Jewel Socket' && P.caminhoAte(e, n.id)?.length < 12);
  alocarAte(e, basico.id);
  assert.equal(encaixar(e, basico.id, ramificadora('Small')).motivo, 'RAMIFICADORA_FORA');
  alocarAte(e, '2491');
  assert.ok(encaixar(e, '2491', ramificadora('Large', 5)).ok);
  const interno = P.nosDaRamificadora(e, '2491').find((id) => P.grafoDe(e).internos.has(id));
  alocarAte(e, interno);
  assert.equal(encaixar(e, interno, ramificadora('Large', 2)).motivo, 'RAMIFICADORA_GRANDE');
  assert.ok(encaixar(e, interno, gerar('Jewels/Crimson_Jewel')).ok, 'a joia comum no encaixe interno');
});

test('a joia MENOR no encaixe interno (os nós dela a partir dele); TIRAR a Grande devolve os pontos e a joia menor volta à mochila', { skip: SEM }, () => {
  const e = personagem();
  alocarAte(e, '2491');
  assert.ok(encaixar(e, '2491', ramificadora('Large', 5)).ok);
  const interno = P.nosDaRamificadora(e, '2491').find((id) => P.grafoDe(e).internos.has(id));
  alocarAte(e, interno);
  const media = ramificadora('Medium', 4);
  assert.ok(encaixar(e, interno, media).ok);
  const daMedia = P.nosDaRamificadora(e, interno);
  assert.ok(daMedia.length >= 4);
  const alvo = daMedia.find((id) => P.grafoDe(e).porId.get(id).tipo !== 'small' || !P.grafoDe(e).internos.has(id));
  alocarAte(e, alvo);
  const usados = P.pontos(e).usados;
  const daGrande = new Set(P.nosDaRamificadora(e, '2491'));
  const naJoia = e.passivas.alocados.filter((x) => daGrande.has(x)).length;
  assert.ok(naJoia >= 3);
  assert.ok(Joias.retirar(e, { no: '2491' }).ok);
  P.garantir(e);
  assert.equal(P.pontos(e).usados, usados - naJoia, 'os pontos dos nós da joia voltam');
  assert.ok(!e.passivas.alocados.some((x) => daGrande.has(x)));
  assert.ok(!e.passivas.joias?.[interno], 'a Média saiu do encaixe interno');
  assert.ok(e.inventory.some((x) => x?.poe?.ramificadora?.tamanho === 'Medium'), 'e voltou para a mochila');
  assert.ok(e.inventory.some((x) => x?.poe?.ramificadora?.tamanho === 'Large'));
  assert.equal(P.podeAlocar(e, interno).motivo, 'RAMIFICADORA', 'sem a joia, o encaixe interno não existe');
});
