// LOTE 78 — as RAMIFICADORAS na TELA (o passo 3, parte 2): a PEÇA mostra cada linha com o estado das linhas dos nós que ela cria (a joia não soma
// no personagem: vale pelos nós) — não mais "registrado" (✗) —, e a peça antiga é refeita (a versão da tradução sobe); os ÍCONES dos nós da joia
// nas folhas da árvore (os notáveis, as pequenas de cada encantamento, as pedras das únicas e a moldura do encaixe de expansão — sem imagem nova)
// e a chave do ícone no nó (`arte`).
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
const { traduzirLinha } = await import('../systems/itens-poe/arvore.mjs');
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
const ramificadora = (tamanho, s = 1) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: `Jewels/${tamanho}_Cluster_Jewel`, raridade: 'raro', ilvl: 84, rng: semeado(s) }));
const dados = () => Catalogo.catalogo().ramificadoras;
const linhasDa = (poe) => [...poe.implicitos, ...poe.prefixos, ...poe.sufixos, ...poe.modificadores];
const COM_EFEITO = new Set(['equivalente', 'aproximado', 'novo']);

test('a PEÇA: cada linha da Ramificadora com o estado das linhas dos nós — nenhuma "registrado"; a versão da tradução sobe para 64', { skip: SEM }, () => {
  assert.equal(J.VERSAO_DA_TRADUCAO, 64);
  let notaveis = 0;
  let encantamentos = 0;
  for (const t of ['Large', 'Medium', 'Small']) {
    for (let s = 1; s <= 25; s++) {
      const { poe } = ramificadora(t, s);
      const linhas = linhasDa(poe);
      assert.equal(poe.estados.length, linhas.length);
      linhas.forEach((m, i) => {
        const e = poe.estados[i];
        assert.ok(COM_EFEITO.has(e), `${t} ${s}: ${e} — ${m.texto}`);
        if (/^Adiciona \{0\} Habilidades Passivas$|são Encaixes de Joia$/.test(m.modelo ?? '')) assert.equal(e, 'equivalente', m.texto);
        if (m.encantamento) {
          encantamentos++;
          assert.equal(e, traduzirLinha(m.texto.replace(/^Habilidades Passivas Adicionadas concedem /, '')).estado, m.texto);
        }
        if (m.notavel) {
          notaveis++;
          const dele = dados().notaveis[m.notavel].linhas.map((l) => traduzirLinha(l).estado);
          assert.ok(dele.includes(e), `${m.notavel}: ${e} ∈ ${dele}`);
        }
      });
    }
  }
  assert.ok(notaveis > 40 && encantamentos >= 75, `${notaveis} notáveis, ${encantamentos} encantamentos`);
});

test('a peça ANTIGA (versão 63, as linhas "registrado") é refeita na entrada com os estados dos nós', { skip: SEM }, () => {
  const peca = ramificadora('Large', 3);
  const certos = [...peca.poe.estados];
  peca.poe.estados = certos.map(() => 'registrado');
  peca.poe.tv = 63;
  const e = personagemDeTeste({ vocacao: 'knight', level: 90 });
  e.sistema = 'poe';
  e.inventory = [peca];
  assert.ok(J.refazerPecasAntigas(e) >= 1);
  assert.deepEqual(e.inventory[0].poe.estados, certos);
  assert.equal(e.inventory[0].poe.tv, 64);
});

test('os ÍCONES: os notáveis, as pequenas, as pedras e a moldura do encaixe de expansão nas folhas da árvore; o nó da joia traz a chave', { skip: SEM }, () => {
  const S = JSON.parse(readFileSync(new URL('../gamedata/itens-poe/arvore-sprites.json', import.meta.url), 'utf8'));
  const chave = (c) => c.replace(/^Art\/2DArt\/SkillIcons\/passives\//, '').replace(/\.png$/i, '');
  const d = dados();
  for (const n of Object.values(d.notaveis)) if (n.icone) assert.ok(S.coords.notableActive[chave(n.icone)] && S.coords.notableInactive[chave(n.icone)], n.icone);
  for (const t of Object.values(d.tamanhos)) for (const enc of t.encantamentos) if (enc.icone) assert.ok(S.coords.normalActive[chave(enc.icone)] && S.coords.normalInactive[chave(enc.icone)], enc.icone);
  for (const p of Object.values(d.pedras ?? {})) if (p.icone) assert.ok(S.coords.keystoneActive[chave(p.icone)], p.icone);
  for (const m of ['JewelSocketAltNormal', 'JewelSocketAltCanAllocate', 'JewelSocketAltActive']) assert.ok(S.coords.frame[m], m);
  // o nó da Ramificadora na vista: `arte` com as coordenadas dele
  const e = personagemDeTeste({ vocacao: 'knight', level: 100 });
  e.sistema = 'poe';
  e.classePoe = 'Marauder';
  P.garantir(e);
  e.inventory = [];
  e.level = 100;
  for (const x of P.caminhoAte(e, '2491')) assert.ok(P.alocar(e, x).ok);
  const joia = ramificadora('Large', 5);
  e.inventory.push(joia);
  assert.ok(Joias.encaixar(e, { no: '2491', pilha: 0, id: joia.id }).ok);
  const nos = P.vista(e).ramificadoras.nos;
  const comIcone = nos.filter((n) => !n.encaixeInterno);
  assert.ok(comIcone.length >= 6);
  for (const n of comIcone) {
    const tipo = n.tipo === 'notable' ? 'notable' : 'normal';
    assert.ok(n.arte && S.coords[`${tipo}Active`][n.arte], `${n.id} ${n.nome}: ${n.arte}`);
  }
  assert.ok(nos.filter((n) => n.encaixeInterno).every((n) => !n.arte && n.expansao));
});

test('a ENGINE (o gerador de itens e as fichas): a Ramificadora com os mesmos estados do jogo', { skip: SEM }, async () => {
  const Http = await import('../admin/itens-poe-http.mjs');
  let corpo = null;
  const json = (_res, _s, c) => { corpo = c; };
  const url = new URL('http://x/api/mapas/_engine/itens-poe/gerar?base=Jewels/Large_Cluster_Jewel&raridade=raro&n=4&semente=3');
  assert.ok(await Http.atender({ method: 'GET', headers: {} }, {}, url.pathname, url, { json, corpoJson: async () => ({}) }));
  assert.equal(corpo.pecas.length, 4);
  for (const p of corpo.pecas) {
    const estados = p.traducao.linhas.map((l) => l.estado);
    assert.ok(estados.length && estados.every((e) => COM_EFEITO.has(e)), JSON.stringify(estados));
  }
});
