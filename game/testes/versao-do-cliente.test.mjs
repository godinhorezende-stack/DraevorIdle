// A versão do jogo é automática e vai já no `hello` — é ela que abre a janela "Nova versão disponível" nas abas que estavam abertas
// durante um deploy. Muda quando o código do CLIENTE muda e (dono, 08/10: "veja se quando faz o deploy está aparecendo a aba de atualizar")
// também quando o SERVIDOR muda (código e dados do jogo); não muda com o site, os .br/.gz, a Engine, os testes, as ferramentas e a doc.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { calcular, calcularDoServidor, versaoDoJogo, VERSAO_DO_CLIENTE } from '../systems/versao-do-cliente.mjs';
import { Sessao } from '../websocket/sessao.mjs';

function frontendDeMentira() {
  const raiz = mkdtempSync(join(tmpdir(), 'versao-'));
  mkdirSync(join(raiz, 'client', 'src'), { recursive: true });
  mkdirSync(join(raiz, 'client', 'site'), { recursive: true });
  writeFileSync(join(raiz, 'jogar.html'), '<html></html>');
  writeFileSync(join(raiz, 'client', 'style.css'), 'body{}');
  writeFileSync(join(raiz, 'client', 'src', 'main.mjs'), 'export const a = 1;');
  return raiz;
}

test('muda quando o código do jogo muda; não muda com o site nem com os .br/.gz', (t) => {
  const raiz = frontendDeMentira();
  t.after(() => rmSync(raiz, { recursive: true, force: true }));
  const v1 = calcular(raiz);
  assert.match(v1, /^[0-9a-f]{12}$/);
  assert.equal(calcular(raiz), v1, 'estável');

  writeFileSync(join(raiz, 'client', 'site', 'site.css'), 'a{}');
  writeFileSync(join(raiz, 'client', 'src', 'main.mjs.br'), 'xx');
  assert.equal(calcular(raiz), v1, 'site e pré-comprimidos não contam');

  writeFileSync(join(raiz, 'client', 'src', 'main.mjs'), 'export const a = 2;');
  const v2 = calcular(raiz);
  assert.notEqual(v2, v1, 'módulo do jogo mudou');
  writeFileSync(join(raiz, 'client', 'style.css'), 'body{color:red}');
  assert.notEqual(calcular(raiz), v2, 'a folha de estilo também');
});

test('toda folha de estilo que a página do jogo carrega conta (a balao-item.css ficava de fora)', (t) => {
  const raiz = frontendDeMentira();
  t.after(() => rmSync(raiz, { recursive: true, force: true }));
  writeFileSync(join(raiz, 'jogar.html'), '<link rel="stylesheet" href="/client/style.css?v=auto"><link rel="stylesheet" href="/client/balao-item.css?v=auto">');
  writeFileSync(join(raiz, 'client', 'balao-item.css'), '.tip{}');
  const v1 = calcular(raiz);
  writeFileSync(join(raiz, 'client', 'balao-item.css'), '.tip{color:red}');
  assert.notEqual(calcular(raiz), v1, 'a folha do balão mudou');
  const v2 = calcular(raiz);
  writeFileSync(join(raiz, 'client', 'editor-tema.css'), 'x{}');
  assert.equal(calcular(raiz), v2, 'folha que a página do jogo não carrega não conta');
});

test('o servidor também: código e dados do jogo mudam a versão; testes, ferramentas, mapas, versões do Engine e .br/.gz não', (t) => {
  const jogo = mkdtempSync(join(tmpdir(), 'versao-jogo-'));
  t.after(() => rmSync(jogo, { recursive: true, force: true }));
  for (const d of ['systems', 'websocket', 'gamedata/hunts', 'gamedata/atos/_versoes', 'testes', 'tools', 'database/dados']) mkdirSync(join(jogo, d), { recursive: true });
  writeFileSync(join(jogo, 'systems', 'bolsa.mjs'), 'export const a = 1;');
  writeFileSync(join(jogo, 'gamedata', 'regras.json'), '{"a":1}');
  const s1 = calcularDoServidor(jogo);
  for (const [f, c] of [['testes/x.test.mjs', 'x'], ['tools/y.mjs', 'y'], ['gamedata/hunts/mapa.json', '{}'], ['gamedata/atos/_versoes/1.json', '{}'], ['systems/bolsa.mjs.br', 'xx'], ['database/dados/jogo.db', 'db']]) writeFileSync(join(jogo, f), c);
  assert.equal(calcularDoServidor(jogo), s1, 'nada disso conta');
  writeFileSync(join(jogo, 'systems', 'bolsa.mjs'), 'export const a = 2;');
  const s2 = calcularDoServidor(jogo);
  assert.notEqual(s2, s1, 'o código do servidor mudou (a correção da bolsa, por exemplo)');
  writeFileSync(join(jogo, 'gamedata', 'regras.json'), '{"a":2}');
  assert.notEqual(calcularDoServidor(jogo), s2, 'os dados do jogo também');
  // A versão anunciada junta as duas metades.
  const front = frontendDeMentira();
  t.after(() => rmSync(front, { recursive: true, force: true }));
  const v1 = versaoDoJogo(front, jogo);
  writeFileSync(join(jogo, 'websocket', 'sessao.mjs'), 'export const b = 1;');
  assert.notEqual(versaoDoJogo(front, jogo), v1, 'deploy só de servidor muda a versão — a janela de atualizar aparece');
});

test('o `hello` leva a versão do jogo', (t) => {
  const recebidas = [];
  const s = new Sessao({ readyState: 1, bufferedAmount: 0, send: (d) => recebidas.push(d) });
  t.after(() => s.desconectar());
  s.ola();
  const hello = JSON.parse(recebidas[0]);
  assert.equal(hello.t, 'hello');
  assert.equal(hello.versao, VERSAO_DO_CLIENTE);
});
