// A versão do jogo é automática: muda quando o código do CLIENTE muda (e só
// então), e vai já no `hello` — é ela que abre a janela "Nova versão
// disponível" nas abas que estavam abertas durante um deploy.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { calcular, VERSAO_DO_CLIENTE } from '../systems/versao-do-cliente.mjs';
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

test('o `hello` leva a versão do jogo', (t) => {
  const recebidas = [];
  const s = new Sessao({ readyState: 1, bufferedAmount: 0, send: (d) => recebidas.push(d) });
  t.after(() => s.desconectar());
  s.ola();
  const hello = JSON.parse(recebidas[0]);
  assert.equal(hello.t, 'hello');
  assert.equal(hello.versao, VERSAO_DO_CLIENTE);
});
