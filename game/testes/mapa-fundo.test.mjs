// Imagem de fundo do mapa mundo por Ato: validação (assinatura, tamanho, dimensões), gravação (arquivo com hash + referência no Ato), troca, remoção, rotas e cliente.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmp = mkdtempSync(join(tmpdir(), 'fundo-'));
after(() => rmSync(tmp, { recursive: true, force: true }));
const C = await import('../admin/conteudo.mjs');
const Http = await import('../admin/conteudo-http.mjs');
const A = await import('../admin/acesso.mjs');
const Mapa = await import('../systems/campanha-mapa.mjs');
const { codificarPng } = await import('../engine/png-minimo.mjs');
const Campanha = await import('../systems/campanha.mjs');

// NUNCA toca nos arquivos do jogo: o conteúdo e a pasta das imagens apontam para a pasta temporária.
const original = readFileSync(C.CAMINHOS.fases, 'utf8');
C.CAMINHOS.fases = join(tmp, 'campanha-conteudo.json'); writeFileSync(C.CAMINHOS.fases, original);
C.CAMINHOS.fundo = join(tmp, 'mapa-mundo');
const ATO = Campanha.FASES[0].ato;
const png = (w, h, v = 100) => codificarPng({ w, h, data: new Uint8Array(w * h * 4).fill(v) });
const b64 = (b) => b.toString('base64');
const jpeg = (w, h) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0, 0, 0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255]), Buffer.alloc(40)]);
const webpX = (w, h) => { const b = Buffer.alloc(40); b.write('RIFF', 0); b.write('WEBP', 8); b.write('VP8X', 12); b.writeUIntLE(w - 1, 24, 3); b.writeUIntLE(h - 1, 27, 3); return b; };

test('MF1. tipo pela ASSINATURA e dimensões de PNG, JPEG e WEBP; lixo não é imagem', () => {
  assert.equal(C.tipoDaImagem(png(10, 10)), 'png'); assert.equal(C.tipoDaImagem(jpeg(10, 10)), 'jpeg'); assert.equal(C.tipoDaImagem(webpX(10, 10)), 'webp'); assert.equal(C.tipoDaImagem(Buffer.from('GIF89a......')), null);
  assert.deepEqual(C.dimensoesDaImagem(png(640, 480)), { w: 640, h: 480 }); assert.deepEqual(C.dimensoesDaImagem(jpeg(1000, 640)), { w: 1000, h: 640 }); assert.deepEqual(C.dimensoesDaImagem(webpX(1500, 960)), { w: 1500, h: 960 });
  assert.equal(C.dimensoesDaImagem(Buffer.from([0xff, 0xd8, 0xff])), null);
});

test('MF2. análise: tamanho, tipo, dimensões e proporção (aviso, não erro); aceita data URL; extensão mentirosa é recusada', () => {
  assert.equal(C.analisarFundo(`data:image/png;base64,${b64(png(1000, 640))}`).ok, true);
  assert.deepEqual(C.analisarFundo(b64(png(1000, 640))).avisos, []);
  assert.match(C.analisarFundo(b64(png(1000, 150))).erros.join(' '), /de 200 a 4096px por lado/);
  assert.match(C.analisarFundo(b64(png(5000, 640))).erros.join(' '), /de 200 a 4096px/);
  assert.match(C.analisarFundo(b64(png(1600, 400))).avisos.join(' '), /proporção/);
  assert.match(C.analisarFundo(b64(Buffer.from('isto nao e imagem'))).erros.join(' '), /não é uma imagem PNG, JPG ou WEBP/);
  assert.match(C.analisarFundo(b64(Buffer.alloc(C.LIMITES_DO_FUNDO.bytes + 10, 1))).erros.join(' '), /passa de 3 MB/);
  assert.match(C.analisarFundo('').erros.join(' '), /Falta a imagem/); assert.match(C.analisarFundo(undefined).erros.join(' '), /Falta a imagem/);
});

test('MF3. salvar: grava o arquivo com hash no nome, aponta atos[n].fundo, preserva os outros campos do Ato; o mesmo conteúdo dá o mesmo arquivo', () => {
  const antes = JSON.parse(readFileSync(C.CAMINHOS.fases, 'utf8'));
  const r = C.salvarFundoDoAto(ATO, b64(png(1000, 640)));
  assert.equal(r.ok, true); assert.match(r.fundo.arquivo, new RegExp(`^ato-${ATO}-[0-9a-f]{8}\\.png$`)); assert.equal(r.url, `/gamedata/mapa-mundo/${r.fundo.arquivo}`);
  assert.ok(existsSync(join(C.CAMINHOS.fundo, r.fundo.arquivo)));
  const dep = JSON.parse(readFileSync(C.CAMINHOS.fases, 'utf8'));
  assert.deepEqual(dep.atos[ATO].fundo, { arquivo: r.fundo.arquivo, tipo: 'png', w: 1000, h: 640, bytes: png(1000, 640).length });
  assert.deepEqual(dep.fases, antes.fases, 'as fases não mudaram');
  assert.equal(C.salvarFundoDoAto(ATO, b64(png(1000, 640))).fundo.arquivo, r.fundo.arquivo, 'conteúdo igual = mesmo nome');
  assert.deepEqual(Mapa.validarAtos(dep.atos, [ATO]), []);
});

test('MF4. trocar apaga a imagem antiga; cada Ato tem a sua; JPEG e WEBP funcionam; Ato inexistente e imagem ruim são recusados sem gravar', () => {
  const a = C.salvarFundoDoAto(ATO, b64(png(1000, 640, 10))); const b = C.salvarFundoDoAto(ATO, b64(png(1000, 640, 20)));
  assert.notEqual(a.fundo.arquivo, b.fundo.arquivo); assert.equal(existsSync(join(C.CAMINHOS.fundo, a.fundo.arquivo)), false, 'a antiga saiu'); assert.ok(existsSync(join(C.CAMINHOS.fundo, b.fundo.arquivo)));
  const outro = Campanha.FASES.find((f) => f.ato !== ATO)?.ato;
  if (outro != null) { const o = C.salvarFundoDoAto(outro, b64(jpeg(1000, 640))); assert.match(o.fundo.arquivo, /\.jpg$/); assert.ok(existsSync(join(C.CAMINHOS.fundo, b.fundo.arquivo)), 'o fundo do outro Ato não mexe neste'); }
  assert.match(C.salvarFundoDoAto(ATO, b64(webpX(1000, 640))).fundo.arquivo, /\.webp$/);
  const arquivos = readdirSync(C.CAMINHOS.fundo).filter((n) => n.startsWith(`ato-${ATO}-`)); assert.equal(arquivos.length, 1, 'só a imagem atual do Ato fica em disco');
  const antes = readFileSync(C.CAMINHOS.fases, 'utf8');
  assert.equal(C.salvarFundoDoAto(9999, b64(png(1000, 640))).ok, false); assert.equal(C.salvarFundoDoAto(ATO, b64(Buffer.from('lixo'))).ok, false);
  assert.equal(readFileSync(C.CAMINHOS.fases, 'utf8'), antes, 'recusado não grava');
});

test('MF5. remover: volta ao fundo desenhado, apaga o arquivo e limpa o Ato; sem imagem é erro claro', () => {
  const r = C.salvarFundoDoAto(ATO, b64(png(1000, 640)));
  assert.equal(C.removerFundoDoAto(ATO).ok, true);
  assert.equal(existsSync(join(C.CAMINHOS.fundo, r.fundo.arquivo)), false); assert.equal(JSON.parse(readFileSync(C.CAMINHOS.fases, 'utf8')).atos?.[ATO]?.fundo, undefined);
  assert.match(C.removerFundoDoAto(ATO).erros.join(' '), /não tem imagem de fundo/);
});

test('MF6. o mapa salvo pela tela (salvarMapa) preserva o fundo; referência inválida é recusada', () => {
  const r = C.salvarFundoDoAto(ATO, b64(png(1000, 640)));
  const lido = C.lerMapa(); assert.equal(lido.atos[ATO].fundo.arquivo, r.fundo.arquivo);
  const s = C.salvarMapa({ atos: { [ATO]: { ...lido.atos[ATO], nome: 'Com fundo' } } });
  assert.equal(s.ok, true); assert.equal(C.lerMapa().atos[ATO].fundo.arquivo, r.fundo.arquivo); assert.equal(C.lerMapa().atos[ATO].nome, 'Com fundo');
  assert.match(Mapa.validarAtos({ [ATO]: { fundo: { arquivo: '../../etc/passwd' } } }, [ATO]).join(' '), /imagem de fundo é inválida/);
  assert.match(Mapa.validarAtos({ [ATO]: { fundo: 'x' } }, [ATO]).join(' '), /imagem de fundo é inválida/);
});

test('MF7. rotas: validar (só lê), salvar e remover (gravam), 400 para ação/Ato/imagem inválidos; ACL', async () => {
  const chama = async (rota, corpo) => { const r = []; await Http.atender({ method: 'POST' }, {}, `/api/mapas/_conteudo/${rota}`, new URL('http://x/'), { json: (a, c, b) => r.push([c, b]), corpoJson: async () => corpo }); return r[0]; };
  const v = await chama('mapa/fundo/validar', { imagem: b64(png(1000, 640)) }); assert.equal(v[1].ok, true); assert.equal(v[1].buffer, undefined);
  const s = await chama('mapa/fundo', { acao: 'salvar', ato: ATO, imagem: b64(png(1000, 640)) }); assert.equal(s[0], 200); assert.equal(s[1].ok, true);
  assert.equal((await chama('mapa/fundo', { acao: 'salvar', ato: ATO, imagem: 'lixo' }))[0], 400); assert.equal((await chama('mapa/fundo', { acao: 'nada' }))[0], 400);
  assert.equal((await chama('mapa/fundo', { acao: 'remover', ato: ATO }))[1].ok, true); assert.equal((await chama('mapa/fundo', { acao: 'remover', ato: ATO }))[0], 400);
  assert.equal(A.classeDaRota('POST', '/api/mapas/_conteudo/mapa/fundo/validar'), 'leitura'); assert.equal(A.classeDaRota('POST', '/api/mapas/_conteudo/mapa/fundo'), 'grava');
});

test('MF8. cliente: o Ato leva o fundo até a tela WORLD (dados), que desenha a imagem cobrindo o mapa; o editor tem o bloco de carregar/salvar/remover; os arquivos são públicos (fora da lista de privados)', async () => {
  const dados = readFileSync(new URL('../frontend/client/src/world-dados.mjs', import.meta.url), 'utf8'); assert.match(dados, /fundo: meta\.fundo\?\.url \|\| meta\.fundo\?\.arquivo \? meta\.fundo : null/);
  const arte = readFileSync(new URL('../frontend/client/src/world-arte.mjs', import.meta.url), 'utf8'); assert.match(arte, /fundo\.url \?\? `\/gamedata\/mapa-mundo\/\$\{fundo\.arquivo\}`/); assert.match(arte, /preserveAspectRatio: 'xMidYMid slice'/);
  const w = readFileSync(new URL('../frontend/client/src/world.mjs', import.meta.url), 'utf8'); assert.match(w, /pontos, a\.fundo\)/);
  const ed = readFileSync(new URL('../frontend/client/src/editor-conteudo.mjs', import.meta.url), 'utf8');
  for (const t of ["'Salvar imagem neste Ato'", "'Remover imagem'", "'mapa/fundo/validar'", "acao: 'salvar', ato: MW.ato", "meta.fundo));"]) assert.ok(ed.includes(t), t);
  const { ehPrivado } = await import('../backend/privados.mjs'); assert.equal(ehPrivado('mapa-mundo/ato-1-abcdef12.png'), false); assert.equal(ehPrivado('campanha-conteudo.json'), true);
  const camp = readFileSync(new URL('../systems/campanha.mjs', import.meta.url), 'utf8'); // A imagem do ato do editor vem primeiro (dono, 07/10); sem ela, a do Mapa do mundo.
  assert.match(camp, /fundo: imagemDoAto \?\? atosDoConteudo\(\)\[String\(numero\)\]\?\.fundo \?\? null/);
  assert.equal(ehPrivado('atos/imagens/poe-ato-1.png'), false, 'a imagem do ato é pública');
});

test('MF9. o mapa do jogo segue a ENGINE à risca (dono, 07/10): as ligações são só as do ato do editor (sem cadeia implícita), o boss só da fase anterior, o número é a ordem', async () => {
  const { conexoesDoAto, tipoDaFase } = await import('../frontend/client/src/world-dados.mjs');
  const fases = [{ huntId: 'a', completa: true }, { huntId: 'b', liberada: true }, { huntId: 'c' }];
  const boss = { ato: 5 };
  const mundo = { a: { grafo: { ordem: 1, tipo: 'inicio', conexoes: ['b', 'c'], aoBoss: false } }, b: { grafo: { ordem: 2, tipo: 'comum', conexoes: [], aoBoss: true } }, c: { grafo: { ordem: 3, tipo: 'boss-fase', conexoes: [], aoBoss: false } } };
  const lig = conexoesDoAto(fases, boss, mundo).map((c) => `${c.de}>${c.para}:${c.tipo}`);
  assert.deepEqual(lig, ['a>b:cadeia', 'a>c:cadeia', 'b>boss:5:boss'], 'nada de b>c (a cadeia implícita) nem c>boss');
  assert.equal(tipoDaFase(mundo.c), 'boss-fase');
  assert.equal(tipoDaFase(mundo.a), 'comum');
  // sem `grafo` (ato legado): a cadeia de sempre
  assert.ok(conexoesDoAto(fases, boss, {}).some((c) => c.de === 'b' && c.para === 'c'));
  const camp = readFileSync(new URL('../systems/campanha.mjs', import.meta.url), 'utf8');
  assert.match(camp, /\.\.\.\(f\.grafo \? \{ grafo: grafoDaFase\(f\) \} : \{\}\)/);
});
