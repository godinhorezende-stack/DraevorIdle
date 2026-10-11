// Os ÍCONES e as MOLDURAS dos nós da árvore do PoE (dono, 11/10: raspados do poeskilltree.com — tools/importar-arvore-poeskilltree.mjs),
// os FUNDOS DOS GRUPOS e a ARTE DAS CLASSES:
// todo nó da árvore principal tem arte (ícone ou encaixe de joia), cada ícone está DENTRO da folha dele, as folhas e os avulsos estão no
// repositório, e o jogo serve as folhas e o mapa (`/api/jogo/poe/icone/arvore/<folha>`, `/api/jogo/poe/arvore-sprites`). Refazer a árvore
// (tools/montar-arvore-poe.mjs) com nó novo sem rodar o importador quebra aqui.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

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

test('sprites da árvore: cada fundo de grupo fica onde estão os nós do grupo (a posição da árvore do jogo)', () => {
  const nos = P.arvore().nos.filter((n) => !n.ascendencia && n.tipo !== 'start');
  assert.ok(S.grupos.length > 400, `${S.grupos.length} grupos com fundo`);
  for (const [x, y, fundo, meio] of S.grupos) {
    const c = S.coords.groupBackground[fundo];
    assert.ok(c, fundo);
    assert.ok(meio === 0 || fundo === 'PSGroupBackground3', `${fundo} só o grande é meia-imagem`);
    // o raio do fundo em unidades da árvore (a folha está no zoom S.zoom): algum nó do jogo está dentro dele
    const raio = c[2] / 2 / S.zoom;
    assert.ok(nos.some((n) => Math.hypot(n.x - x, n.y - y) <= raio), `fundo ${fundo} em ${x},${y} sem nó dentro`);
  }
});

test('sprites da árvore: cada classe tem o medalhão do PoE, e a ilustração grande (menos a Herdeira) cobre o início dela', () => {
  const inicios = P.arvore().nos.filter((n) => n.tipo === 'start' && !n.ascendencia);
  assert.equal(inicios.length, 7);
  assert.ok(S.coords.startNode.PSStartNodeBackgroundInactive);
  for (const n of inicios) {
    const c = S.classes[n.classe];
    assert.ok(c && S.coords.startNode[c.centro], `${n.classe}: medalhão`);
    if (n.classe === 'Scion') { assert.equal(c.ilustracao, undefined, 'a Herdeira não tem ilustração no PoE'); continue; }
    assert.ok(existsSync(new URL(c.ilustracao, PASTA)), c.ilustracao);
    assert.ok(c.l > 1000 && c.a > 1000, `${n.classe}: ${c.l}×${c.a}`);
    assert.ok(n.x > c.x && n.x < c.x + c.l && n.y > c.y && n.y < c.y + c.a, `${n.classe}: o início (${n.x}, ${n.y}) dentro da ilustração ${c.ilustracao}`);
  }
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
const pedir = async (endereco, headers = {}) => {
  const res = resposta();
  const url = new URL(`http://x${endereco}`);
  const tratou = await Http.atenderPublico({ method: 'GET', headers }, res, decodeURIComponent(url.pathname), url, { json, fichaDaGema: () => null });
  assert.ok(tratou, endereco);
  await Promise.race([res.fim, new Promise((ok) => setTimeout(ok, 2000))]);
  return { status: res.status, tipo: res.cabecalho['content-type'], cabecalho: res.cabecalho, corpo: Buffer.concat(res.partes) };
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
  assert.equal((await pedir(`/api/jogo/poe/icone/arvore/${S.tipos.groupBackground}`)).status, 200);
  const il = await pedir(`/api/jogo/poe/icone/arvore/${S.classes.Witch.ilustracao}`);
  assert.equal(il.status, 200);
  assert.equal(il.tipo, 'image/webp');
  const avulso = Object.values(S.avulsos)[0];
  if (avulso) assert.equal((await pedir(`/api/jogo/poe/icone/arvore/${avulso}`)).status, 200);
  assert.equal((await pedir('/api/jogo/poe/icone/arvore/..%2F..%2Farvore-poe.json')).status, 404);
  assert.equal((await pedir('/api/jogo/poe/icone/arvore/../arvore-sprites.json')).status, 404);
});

test('sprites da árvore: o mapa vai com ETag e no-cache (304 se não mudou), e cada imagem com a versão do arquivo no endereço', async () => {
  const mapa = await pedir('/api/jogo/poe/arvore-sprites');
  assert.equal(mapa.status, 200);
  assert.equal(mapa.cabecalho['cache-control'], 'no-cache', 'o navegador confere antes de usar o guardado');
  assert.match(mapa.cabecalho.etag, /^"[0-9a-f]{16}"$/);
  const igual = await pedir('/api/jogo/poe/arvore-sprites', { 'if-none-match': mapa.cabecalho.etag });
  assert.equal(igual.status, 304);
  assert.equal(igual.corpo.length, 0);
  assert.equal((await pedir('/api/jogo/poe/arvore-sprites', { 'if-none-match': '"outra"' })).status, 200);
  // a versão de cada imagem é a do arquivo: trocou a imagem, trocou o endereço
  const { v } = JSON.parse(mapa.corpo.toString('utf8'));
  const imagens = [...Object.keys(S.folhas), ...Object.values(S.avulsos), ...Object.values(S.classes).map((c) => c.ilustracao).filter(Boolean)];
  assert.deepEqual(Object.keys(v).sort(), imagens.sort());
  for (const r of imagens) assert.equal(v[r], createHash('sha1').update(readFileSync(new URL(r, PASTA))).digest('hex').slice(0, 10), r);
  // com a versão, um ano; sem ela, o dia de sempre
  const comVersao = await pedir(`/api/jogo/poe/icone/arvore/${S.tipos.frame}?v=${v[S.tipos.frame]}`);
  assert.equal(comVersao.status, 200);
  assert.equal(comVersao.cabecalho['cache-control'], 'public, max-age=31536000, immutable');
  assert.equal((await pedir(`/api/jogo/poe/icone/arvore/${S.tipos.frame}`)).cabecalho['cache-control'], 'public, max-age=86400');
});
