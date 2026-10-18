// LOTE 60 — as RAMIFICADORAS, o passo 2 (o começo do servidor): a árvore montada ganha a EXPANSÃO do poedb (os encaixes de expansão com o tamanho, o
// índice e o proxy; os proxies com o centro do grupo, a órbita e os encaixes internos; as órbitas da árvore) — o que o PoB usa para montar a
// Ramificadora — e o PROXY e o encaixe interno (Pequeno, Médio) deixam de ser alocáveis soltos: no PoE eles só existem com uma Joia Ramificadora.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const P = await import('../systems/passivas/arvore.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');

test('a EXPANSÃO na árvore: os 6 encaixes Grandes, os proxies com o centro do grupo e os encaixes internos, as órbitas', { skip: SEM }, () => {
  const nos = P.arvore().nos;
  const grandes = nos.filter((n) => n.expansao?.tamanho === 2);
  assert.equal(grandes.length, 6);
  for (const g of grandes) {
    const proxy = nos.find((n) => n.id === g.expansao.proxy);
    assert.ok(proxy?.proxy?.grupo, `${g.id}: o proxy ${g.expansao.proxy}`);
    assert.ok(proxy.proxy.encaixes.length >= 1);
  }
  assert.deepEqual(P.arvore().orbitas.nos, [1, 6, 16, 16, 40, 72, 72]);
  assert.equal(nos.filter((n) => n.expansao).length, 42);
});

test('o PROXY e o ENCAIXE INTERNO não se alocam soltos; o encaixe Grande, sim (é um encaixe de joia)', { skip: SEM }, () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 95 });
  e.sistema = 'poe';
  e.classePoe = 'Marauder';
  P.garantir(e);
  const nos = P.arvore().nos;
  const grande = nos.find((n) => n.expansao?.tamanho === 2);
  const caminho = P.caminhoAte(e, grande.id);
  assert.ok(caminho?.length, 'há caminho até o encaixe Grande');
  assert.ok(caminho.every((id) => !P.soDaRamificadora(nos.find((n) => n.id === id))), 'o caminho não passa por proxy nem encaixe interno');
  e.passivas.alocados.push(...caminho);
  P.garantir(e);
  const proxy = nos.find((n) => n.id === grande.expansao.proxy);
  assert.ok((grande.conexoes ?? []).includes(proxy.id) || (proxy.conexoes ?? []).includes(grande.id), 'o proxy encosta no encaixe');
  const r = P.podeAlocar(e, proxy.id);
  assert.equal(r.ok, false);
  assert.equal(r.motivo, 'RAMIFICADORA');
  assert.match(r.erro, /Ramificadora/);
  // os 78 (42 proxies e 36 encaixes internos — 18 Médios, 18 Pequenos): todos recusados (a auditoria da árvore não os aloca — dono: "Pular como o início")
  const so = nos.filter((n) => P.soDaRamificadora(n));
  assert.equal(so.length, 78);
  assert.equal(so.filter((n) => n.placeholder).length, 42);
  assert.equal(so.filter((n) => n.expansao?.tamanho === 1).length, 18);
  assert.equal(so.filter((n) => n.expansao?.tamanho === 0).length, 18);
  for (const n of so) assert.equal(P.podeAlocar(e, n.id).motivo, 'RAMIFICADORA', `${n.id} ${n.nome}`);
  assert.equal(P.ehEncaixeDeJoia(grande), true);
  // a tela recebe a marca (o cliente não oferece o nó nem passa por ele no caminho)
  const doCliente = P.arvoreParaCliente().nos;
  assert.equal(doCliente.filter((n) => n.soDaRamificadora).length, 78);
  assert.ok(!doCliente.find((n) => n.id === grande.id).soDaRamificadora);
});
