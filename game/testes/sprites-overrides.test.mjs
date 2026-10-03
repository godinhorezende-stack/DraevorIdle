import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decodificarPng, codificarPng, cabecalhoDoPng } from '../engine/png-minimo.mjs';
import * as F from '../engine/sprite-folha.mjs';
import * as S from '../admin/overrides-sprites.mjs';
import * as Http from '../admin/conteudo-http.mjs';
import * as A from '../admin/acesso.mjs';

const pasta = mkdtempSync(join(tmpdir(), 'sprites-'));
after(() => rmSync(pasta, { recursive: true, force: true }));
S.CAMINHOS.arquivo = join(pasta, 'ov', 'sprites.json');
S.CAMINHOS.versoes = join(pasta, 'ov', '_v', 'sprites');
S.CAMINHOS.pasta = join(pasta, 'ov', 'sprites');
S.CAMINHOS.historico = join(pasta, 'ov', '_v', 'sprites-png');

const RAIZ = new URL('../gamedata/', import.meta.url);
const OUTFITS = JSON.parse(readFileSync(new URL('outfits.json', RAIZ), 'utf8'));
const lerFolha = (look) => decodificarPng(readFileSync(new URL(`sprites/outfits/${look}.png`, RAIZ)));
const sha = (b) => createHash('sha1').update(b).digest('hex');
const MONTARIA = String(JSON.parse(readFileSync(new URL('mounts-real.json', RAIZ), 'utf8')).mounts[0].look);
const OUTFIT = '128';
const MONSTRO = Object.values(JSON.parse(readFileSync(new URL('mobs/atributos.json', RAIZ), 'utf8')).monstros ?? {}).find?.((m) => m.look)?.look;

test('SP1. PNG mínimo: ida e volta idêntica; recusa o que não é PNG, 16 bits e entrelaçado; lê paleta com transparência', () => {
  const b = F.criarBitmap(3, 2);
  b.data.set([255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 255, 0, 1, 2, 3, 255, 4, 5, 6, 255, 0, 0, 0, 0]);
  const png = codificarPng(b);
  assert.deepEqual(cabecalhoDoPng(png), { w: 3, h: 2, profundidade: 8, tipoCor: 6, entrelacado: false });
  assert.deepEqual([...decodificarPng(png).data], [...b.data]);
  assert.throws(() => decodificarPng(Buffer.from('nao sou png nem de longe, juro, tenho mais de 33 bytes ok')), /não é um PNG/);
  const adulterar = (fn) => { const c = Buffer.from(png); fn(c); return c; };
  assert.throws(() => decodificarPng(adulterar((c) => { c[24] = 16; })), /16 bits/);
  assert.throws(() => decodificarPng(adulterar((c) => { c[28] = 1; })), /entrelaçado/);
  // PNG de paleta (tipo 3) com tRNS: índice 1 transparente
  const crcDe = (t, d) => { const buf = Buffer.concat([Buffer.from(t), d]); let c = 0xffffffff; for (const x of buf) { c ^= x; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; } const o = Buffer.alloc(4); o.writeUInt32BE((c ^ 0xffffffff) >>> 0); return o; };
  const blk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); return Buffer.concat([l, Buffer.from(t), d, crcDe(t, d)]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(2, 0); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 3;
  const pal = Buffer.concat([Buffer.from(png.subarray(0, 8)), blk('IHDR', ihdr), blk('PLTE', Buffer.from([10, 20, 30, 40, 50, 60])), blk('tRNS', Buffer.from([255, 0])), blk('IDAT', deflateSync(Buffer.from([0, 0, 1]))), blk('IEND', Buffer.alloc(0))]);
  assert.deepEqual([...decodificarPng(pal).data], [10, 20, 30, 255, 40, 50, 60, 0]);
});

test('SP2. a geometria bate com o renderer do jogo em TODOS os 1307 desenhos (colunas, linhas, tamanho da folha) e com a fórmula de coluna do sprites.mjs', () => {
  let n = 0;
  for (const [look, meta] of Object.entries(OUTFITS)) {
    const e = F.estruturaDe(meta);
    assert.equal(e.w, meta.w, `look ${look}: largura`);
    assert.equal(e.h, meta.h, `look ${look}: altura`);
    for (const [gi, g] of meta.groups.entries()) {
      for (const pos of F.posicoesDoGrupo(g)) {
        // a fórmula do renderer (sprites.mjs → outfitFrame): column = (((z*addons + addon)*dirs + dir)*layers + layer) * cw
        const render = (((pos.z * g.addons + pos.addon) * g.dirs + pos.dir) * g.layers + pos.layer) * meta.cw;
        assert.equal(F.retanguloDaCelula(meta, gi, 0, pos).x, render);
        assert.equal(F.retanguloDaCelula(meta, gi, 0, pos).y, g.row * meta.ch);
        n++;
      }
    }
  }
  assert.ok(n > 10000);
  const fonte = readFileSync(new URL('../frontend/client/src/sprites.mjs', import.meta.url), 'utf8');
  assert.match(fonte, /\(\(\(z \* addonCount \+ addon\) \* dirs \+ safeDir\) \* group\.layers \+ layer\) \* cw/, 'a fórmula do renderer ainda é a que o editor assume');
  assert.match(fonte, /const sy = \(group\.row \+ safeFrame\) \* ch;/);
});

test('SP3. desmontar → montar devolve a MESMA imagem (monstro, outfit de personagem com máscara/addons/montada, montaria); inserir/remover quadro refaz linhas e altura', () => {
  for (const look of [MONTARIA, OUTFIT, '2', '130']) {
    const meta = OUTFITS[look];
    const folha = lerFolha(look);
    const q = F.desmontar(meta, folha);
    const r = F.montar(meta, q);
    assert.equal(r.folha.w, folha.w);
    assert.equal(r.folha.h, folha.h);
    assert.ok(r.folha.data.every((v, i) => v === folha.data[i]), `look ${look}: ida e volta idêntica`);
    assert.deepEqual(r.meta.groups.map((g) => g.row), meta.groups.map((g) => g.row));
  }
  const meta = OUTFITS[MONTARIA];
  const q = F.desmontar(meta, lerFolha(MONTARIA));
  q[1].splice(2, 0, structuredClone(q[1][0]));
  const r = F.montar(meta, q);
  assert.equal(r.meta.groups[1].frames, meta.groups[1].frames + 1);
  assert.equal(r.meta.h, meta.h + meta.ch);
  assert.equal(F.estruturaDe(r.meta).h, r.folha.h);
});

test('SP4. validar o cadastro (meta): estrutura que o jogo lê não pode mudar; durações, linhas e tamanho conferem; avisos para o que muda sem quebrar', () => {
  const meta = OUTFITS[OUTFIT];
  const ok = F.validarMeta(meta, meta);
  assert.deepEqual(ok.erros, []);
  const m = (fn) => { const c = structuredClone(meta); fn(c); return F.validarMeta(c, meta); };
  assert.match(m((c) => c.groups.forEach((g) => { g.layers = 1; })).erros.join(' '), /Camadas.*não pode mudar/);
  assert.match(m((c) => c.groups.forEach((g) => { g.dirs = 1; })).erros.join(' '), /Direções/);
  assert.match(m((c) => { c.groups[1].row = 5; }).erros.join(' '), /começa na linha 5/);
  assert.match(m((c) => { c.groups[1].animation.durations.pop(); }).erros.join(' '), /durações para 8 quadros/);
  assert.match(m((c) => { c.groups[1].animation.durations[0] = [-5, 10]; }).erros.join(' '), /inteiro de 0 a 60000/);
  assert.match(m((c) => { c.cw = 4; }).erros.join(' '), /Tamanho do quadro inválido/);
  assert.match(m((c) => { c.shift = [1]; }).erros.join(' '), /deslocamento/);
  assert.match(m((c) => { c.groups[1].frames = 9; c.groups[1].animation.durations.push([300, 300]); }).erros.join(' '), /não bate com a conta/);
  const mais = m((c) => { c.groups[1].frames = 9; c.groups[1].animation.durations.push([300, 300]); c.h += c.ch; });
  assert.deepEqual(mais.erros, []);
  assert.match(mais.avisos.join(' '), /8 → 9 quadros/);
  assert.match(m((c) => { c.groups.pop(); c.h -= c.ch * 8; }).avisos.join(' '), /sem o grupo de caminhada/);
});

test('SP5. validar os pixels: folha vazia, fundo sólido, direção perdida, quadro vazio, suavização e máscara fora do padrão — cada um com mensagem que diz o que fazer', () => {
  const meta = OUTFITS[OUTFIT];
  const orig = { folha: lerFolha(OUTFIT), meta };
  assert.deepEqual(F.validarPixels(orig.folha, meta, orig).erros, [], 'o original passa nele mesmo');
  assert.match(F.validarPixels(F.criarBitmap(meta.w, meta.h), meta, orig).erros.join(' '), /completamente vazia/);
  assert.match(F.validarPixels(F.criarBitmap(10, 10), meta, orig).erros.join(' '), /a imagem tem 10×10/i);
  const solida = F.clonarBitmap(orig.folha);
  for (let i = 3; i < solida.data.length; i += 4) solida.data[i] = 255;
  assert.match(F.validarPixels(solida, meta, orig).erros.join(' '), /nenhum pixel transparente/);
  const q = F.desmontar(meta, orig.folha);
  const semLeste = structuredClone(q);
  for (const g of semLeste) for (const quadro of g) delete quadro[F.chaveDaPosicao({ dir: 1 })];
  const r1 = F.validarPixels(F.montar(meta, semLeste).folha, meta, orig);
  assert.match(r1.erros.join(' '), /Direção leste \(parado\) sem nenhum desenho\. O original tinha/);
  const quadroVazio = structuredClone(q);
  delete quadroVazio[1][3][F.chaveDaPosicao({ dir: 2 })];
  const r2 = F.validarPixels(F.montar(meta, quadroVazio).folha, meta, orig);
  assert.deepEqual(r2.erros, []);
  assert.match(r2.avisos.join(' '), /Direção sul \(caminhada\): quadro\(s\) 4 vazio\(s\).*pisca/);
  const suave = F.clonarBitmap(orig.folha);
  for (let i = 3; i < suave.data.length; i += 4) if (suave.data[i] === 255) suave.data[i] = 120;
  assert.match(F.validarPixels(suave, meta, orig).avisos.join(' '), /semitransparentes/);
  const mascara = structuredClone(q);
  const cel = mascara[0][0][F.chaveDaPosicao({ dir: 2, layer: 1 })];
  cel.data.set([10, 20, 30, 255], 4 * (10 * meta.cw + 10));
  const r3 = F.validarPixels(F.montar(meta, mascara).folha, meta, orig);
  assert.match(r3.avisos.join(' '), /Máscara de cores.*fora das 4 cores-chave/);
});

test('SP6. quem usa o look e a categoria: monstro, outfit de personagem e montaria', () => {
  const m = S.obter(MONTARIA);
  assert.equal(m.categoria, 'montarias');
  assert.ok(m.usos.montarias.length >= 1);
  assert.equal(S.obter(OUTFIT).categoria, 'outfits');
  assert.equal(S.obter('99999999'), null);
  assert.equal(S.obter('abc'), null);
  const comMonstro = Object.entries(OUTFITS).map(([k]) => k).find((k) => S.categoriaDoLook(k) === 'monstros');
  assert.ok(comMonstro, 'há looks de monstro');
  assert.ok(S.usosDoLook(comMonstro).monstros.length >= 1);
});

test('SP7. propor NÃO grava; mostra o que muda, os arquivos afetados e quem usa; recusa o inválido com a mensagem certa', () => {
  const folha = lerFolha(MONTARIA);
  const png = codificarPng(folha).toString('base64');
  const r = S.propor(MONTARIA, { png });
  assert.equal(r.ok, true, r.erros.join('|'));
  assert.deepEqual(r.mudancasNoCadastro, []);
  assert.deepEqual(r.arquivosAfetados, [`game/gamedata/overrides/sprites/${MONTARIA}.png`, 'game/gamedata/overrides/sprites.json']);
  assert.equal(existsSync(S.CAMINHOS.arquivo), false, 'propor não gravou nada');
  assert.match(S.propor('99999999', { png }).erros[0], /não existe nos desenhos do jogo/);
  assert.match(S.propor(MONTARIA, {}).erros[0], /Falta a imagem/);
  assert.match(S.propor(MONTARIA, { png: Buffer.from('lixo').toString('base64') }).erros[0], /não é um PNG/);
  const pequeno = codificarPng(F.criarBitmap(8, 8)).toString('base64');
  assert.match(S.propor(MONTARIA, { png: pequeno }).erros.join(' '), /A imagem tem 8×8/);
  const mudou = structuredClone(OUTFITS[MONTARIA]);
  mudou.groups[1].animation.durations = mudou.groups[1].animation.durations.map(() => [150, 150]);
  assert.match(S.propor(MONTARIA, { png, meta: mudou }).mudancasNoCadastro.join(' '), /tempos\/loop da animação/);
});

test('SP8. salvar grava imagem + cadastro SEM tocar no original; hash/versão; versão anterior guardada; reverter apaga; restaurar volta; revisão velha é conflito', () => {
  const originalAntes = sha(readFileSync(new URL(`sprites/outfits/${MONTARIA}.png`, RAIZ)));
  const jsonAntes = sha(readFileSync(new URL('outfits.json', RAIZ)));
  const folha = lerFolha(MONTARIA);
  const q = F.desmontar(OUTFITS[MONTARIA], folha);
  const editada = structuredClone(q);
  editada[1][0][F.chaveDaPosicao({ dir: 2 })].data.set([255, 0, 255, 255], 4 * (40 * 64 + 30));
  const png1 = codificarPng(F.montar(OUTFITS[MONTARIA], editada).folha).toString('base64');
  const rev0 = S.listar().revisao;
  assert.equal(rev0, 'ausente');
  const a = S.salvar(MONTARIA, { png: png1, nota: 'ponto magenta' }, rev0);
  assert.equal(a.ok, true, a.erros?.join('|'));
  assert.equal(readFileSync(join(S.CAMINHOS.pasta, `${MONTARIA}.png`)).toString('base64'), png1);
  const reg = JSON.parse(readFileSync(S.CAMINHOS.arquivo, 'utf8'));
  assert.equal(reg.sprites[MONTARIA].hash, sha(Buffer.from(png1, 'base64')).slice(0, 12));
  assert.equal(reg.sprites[MONTARIA].nota, 'ponto magenta');
  assert.equal(reg.sprites[MONTARIA].meta.w, OUTFITS[MONTARIA].w);
  assert.equal(sha(readFileSync(new URL(`sprites/outfits/${MONTARIA}.png`, RAIZ))), originalAntes, 'o PNG original não foi tocado');
  assert.equal(sha(readFileSync(new URL('outfits.json', RAIZ))), jsonAntes, 'o outfits.json original não foi tocado');
  assert.equal(S.salvar(MONTARIA, { png: png1 }, rev0).codigo, 'conflito', 'revisão velha');
  // segunda gravação: a primeira vai para o histórico
  editada[1][0][F.chaveDaPosicao({ dir: 2 })].data.set([0, 255, 255, 255], 4 * (40 * 64 + 30));
  const png2 = codificarPng(F.montar(OUTFITS[MONTARIA], editada).folha).toString('base64');
  assert.equal(S.salvar(MONTARIA, { png: png2 }, S.listar().revisao).ok, true);
  const v = S.obter(MONTARIA).versoes;
  assert.equal(v.length, 1);
  assert.equal(readFileSync(join(S.CAMINHOS.historico, MONTARIA, '1.png')).toString('base64'), png1);
  assert.equal(S.restaurarVersao(MONTARIA, 1, S.listar().revisao).ok, true);
  assert.equal(readFileSync(join(S.CAMINHOS.pasta, `${MONTARIA}.png`)).toString('base64'), png1, 'restaurar devolve a imagem');
  assert.equal(S.obter(MONTARIA).versoes.length, 2, 'restaurar também guarda a atual no histórico');
  assert.equal(S.definirAtivo(MONTARIA, false, S.listar().revisao).ok, true);
  assert.equal(S.listar().itens[0].ativo, false);
  assert.equal(S.reverter(MONTARIA, S.listar().revisao).ok, true);
  assert.equal(existsSync(join(S.CAMINHOS.pasta, `${MONTARIA}.png`)), false);
  assert.deepEqual(S.listar().itens, []);
  assert.equal(S.reverter(MONTARIA, S.listar().revisao).ok, false, 'sem override não há o que reverter');
});

test('SP9. erros que o ORIGINAL já tem viram avisos (look 1882: folha menor que o cadastro) e não impedem salvar a imagem como está', () => {
  const r = S.propor('1882', { png: readFileSync(new URL('sprites/outfits/1882.png', RAIZ)).toString('base64') });
  assert.equal(r.ok, true, r.erros.join('|'));
  assert.match(r.avisos.join(' '), /\(já existe no original\)/);
});

test('SP10. resolverOverrides (o que o cliente do jogo aplica): só override ligado, completo e de look existente; interruptor geral desliga tudo', () => {
  const meta = OUTFITS[MONTARIA];
  const dados = { ativo: true, sprites: { [MONTARIA]: { ativo: true, hash: 'abc123', meta }, [OUTFIT]: { ativo: false, hash: 'x', meta: OUTFITS[OUTFIT] }, 999999: { ativo: true, hash: 'y', meta }, 2: { ativo: true, hash: 'z' } } };
  const r = F.resolverOverrides(dados, OUTFITS);
  assert.deepEqual(Object.keys(r.metas), [MONTARIA]);
  assert.equal(r.urls[MONTARIA], `/gamedata/overrides/sprites/${MONTARIA}.png?v=abc123`);
  assert.deepEqual(F.resolverOverrides({ ...dados, ativo: false }, OUTFITS), { metas: {}, urls: {} });
  assert.deepEqual(F.resolverOverrides(null, OUTFITS), { metas: {}, urls: {} });
  const fonte = readFileSync(new URL('../frontend/client/src/sprites.mjs', import.meta.url), 'utf8');
  assert.match(fonte, /resolverOverrides\(d, outfitMeta\)/);
  assert.match(fonte, /const sheet = folhaDe\(look\);/);
  assert.match(readFileSync(new URL('../frontend/client/src/main.mjs', import.meta.url), 'utf8'), /src: urlDaFolha\(look\)/);
});

test('SP11. rotas: leitura, validar (POST de leitura, não grava) e ações; em produção a gravação é recusada mas validar passa; conflito = 409', async () => {
  const chama = async (metodo, rota, corpo) => { const r = []; await Http.atender({ method: metodo }, {}, `/api/mapas/_conteudo/${rota}`, new URL('http://x/'), { json: (a, c, b) => r.push([c, b]), corpoJson: async () => corpo }); return r[0]; };
  const png = codificarPng(lerFolha(MONTARIA)).toString('base64');
  assert.equal((await chama('GET', 'overrides/sprites'))[0], 200);
  assert.equal((await chama('GET', `overrides/sprites/${MONTARIA}`))[1].categoria, 'montarias');
  assert.equal((await chama('GET', 'overrides/sprites/999999999'))[0], 404);
  const revAntes = S.listar().revisao;
  const v = await chama('POST', 'overrides/sprites/validar', { look: MONTARIA, png });
  assert.equal(v[1].ok, true);
  assert.equal(S.listar().revisao, revAntes, 'validar não gravou');
  const s = await chama('POST', 'overrides/sprites', { acao: 'salvar', look: MONTARIA, png, revisao: revAntes });
  assert.equal(s[0], 200);
  assert.equal((await chama('POST', 'overrides/sprites', { acao: 'salvar', look: MONTARIA, png, revisao: revAntes }))[0], 409);
  assert.equal((await chama('POST', 'overrides/sprites', { acao: 'xx', look: MONTARIA }))[0], 400);
  assert.equal((await chama('POST', 'overrides/sprites', { acao: 'reverter', look: MONTARIA, revisao: S.listar().revisao }))[0], 200);
  const classe = (metodo, rota) => A.classeDaRota(metodo, `/api/mapas/_conteudo/${rota}`);
  assert.equal(classe('POST', 'overrides/sprites/validar'), 'leitura');
  assert.equal(classe('POST', 'overrides/sprites'), 'grava');
  assert.equal(classe('GET', 'overrides/sprites'), 'leitura');
});
