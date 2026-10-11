// Os ÍCONES e as MOLDURAS dos nós da árvore do PoE (dono, 11/10: raspados do poeskilltree.com — tools/importar-arvore-poeskilltree.mjs):
// todo nó da árvore principal tem arte (ícone ou encaixe de joia), cada ícone está DENTRO da folha dele, as folhas e os avulsos estão no
// repositório, e o jogo serve as folhas e o mapa (`/api/jogo/poe/icone/arvore/<folha>`, `/api/jogo/poe/arvore-sprites`). Refazer a árvore
// (tools/montar-arvore-poe.mjs) com nó novo sem rodar o importador quebra aqui.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const P = await import('../systems/passivas/arvore.mjs');
const Http = await import('../admin/itens-poe-http.mjs');

const PASTA = new URL('../gamedata/itens-poe/arvore-sprites/', import.meta.url);
const S = JSON.parse(readFileSync(new URL('../gamedata/itens-poe/arvore-sprites.json', import.meta.url), 'utf8'));
const MAESTRIA = ['mastery', 'masteryConnected', 'masteryActiveSelected'];
const DO_TIPO = { small: 'normal', notable: 'notable', keystone: 'keystone' };

test('sprites da árvore: todo nó da árvore principal tem ícone (ou é encaixe de joia), e a ascendência fica com a arte dela', () => {
  const joias = new Set(S.joias);
  const sem = [];
  for (const n of P.arvore().nos) {
    if (n.tipo === 'start') continue;
    if (n.ascendencia) {
      assert.ok(!S.nos[n.id], `${n.id}: nó de ascendência usa o próprio ícone`);
      continue;
    }
    if (!S.nos[n.id] && !joias.has(n.id)) sem.push(`${n.id} ${n.nome}`);
  }
  assert.deepEqual(sem, []);
});

test('sprites da árvore: cada ícone e cada moldura estão dentro da folha deles, e as folhas estão no repositório', () => {
  for (const [tipo, arquivo] of Object.entries(S.tipos)) {
    assert.ok(existsSync(new URL(arquivo, PASTA)), arquivo);
    const { w, h } = S.folhas[arquivo];
    for (const [chave, [x, y, l, a]] of Object.entries(S.coords[tipo])) assert.ok(x >= 0 && y >= 0 && l > 0 && a > 0 && x + l <= w && y + a <= h, `${tipo} ${chave}`);
  }
  for (const relativo of Object.values(S.avulsos)) assert.ok(existsSync(new URL(relativo, PASTA)), relativo);
  const arvore = P.arvore();
  for (const [id, arte] of Object.entries(S.nos)) {
    const n = arvore.porId.get(id);
    assert.ok(n, `${id} existe na árvore`);
    if (Array.isArray(arte)) arte.forEach((c, i) => assert.ok(S.coords[MAESTRIA[i]][c], `${id} maestria ${MAESTRIA[i]} ${c}`));
    else {
      const t = DO_TIPO[n.tipo];
      assert.ok((S.coords[`${t}Active`]?.[arte] && S.coords[`${t}Inactive`]?.[arte]) || S.avulsos[arte], `${id} ${n.nome}: ${arte}`);
    }
  }
  for (const m of ['PSSkillFrame', 'PSSkillFrameHighlighted', 'PSSkillFrameActive', 'NotableFrameAllocated', 'KeystoneFrameCanAllocate', 'JewelFrameUnallocated']) assert.ok(S.coords.frame[m], m);
});

/** Uma resposta falsa: o que o servidor escreveu (cabeçalho e corpo). */
function resposta() {
  const r = { status: 0, cabecalho: {}, partes: [], fim: null };
  r.fim = new Promise((ok) => {
    Object.assign(r, {
      writeHead(s, c) { r.status = s; r.cabecalho = c ?? {}; },
      write(p) { r.partes.push(Buffer.from(p)); return true; },
      end(p) { if (p) r.partes.push(Buffer.from(p)); ok(); },
      on() { return r; }, once() { return r; }, emit() { return true; }, removeListener() { return r; },
    });
  });
  return r;
}
const json = (res, status, corpo) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(corpo)); };
const pedir = async (caminho) => {
  const res = resposta();
  const tratou = await Http.atenderPublico({ method: 'GET' }, res, caminho, new URL(`http://x${caminho}`), { json, fichaDaGema: () => null });
  assert.ok(tratou, caminho);
  await Promise.race([res.fim, new Promise((ok) => setTimeout(ok, 2000))]);
  return { status: res.status, tipo: res.cabecalho['content-type'], corpo: Buffer.concat(res.partes) };
};

test('sprites da árvore: o jogo serve o mapa, as folhas e os avulsos — e nada fora da pasta', async () => {
  const mapa = await pedir('/api/jogo/poe/arvore-sprites');
  assert.equal(mapa.status, 200);
  const dados = JSON.parse(mapa.corpo.toString('utf8'));
  assert.equal(dados._nota, undefined, 'a nota fica no arquivo');
  assert.deepEqual(Object.keys(dados.nos).length, Object.keys(S.nos).length);
  const folha = await pedir(`/api/jogo/poe/icone/arvore/${S.tipos.frame}`);
  assert.equal(folha.status, 200);
  assert.equal(folha.tipo, 'image/png');
  const avulso = Object.values(S.avulsos)[0];
  if (avulso) assert.equal((await pedir(`/api/jogo/poe/icone/arvore/${avulso}`)).status, 200);
  assert.equal((await pedir('/api/jogo/poe/icone/arvore/..%2F..%2Farvore-poe.json')).status, 404);
  assert.equal((await pedir('/api/jogo/poe/icone/arvore/../arvore-sprites.json')).status, 404);
});
