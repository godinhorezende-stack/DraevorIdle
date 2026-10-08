import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as Atos from '../admin/atos.mjs';
import * as Http from '../admin/conteudo-http.mjs';
import { doClassico } from './apoio-migracao.mjs';

const pasta = mkdtempSync(join(tmpdir(), 'atos-'));
Atos.CAMINHOS.atos = pasta;
after(() => rmSync(pasta, { recursive: true, force: true }));

const rascunho = (extra = {}) => ({
  id: 'ato-teste', nome: 'Ato de teste', inicio: 'fase-1',
  fases: [{ id: 'fase-1', nome: 'Um', huntId: 'hunt-inexistente' }],
  conexoes: [], bossFinal: null, ...extra,
});

test('A1. lista os 4 legados (somente leitura) e nenhum arquivo é gravado fora da pasta do armazém', { skip: doClassico("Os 4 atos legados do Draevor no armazém") }, () => {
  const l = Atos.listar();
  assert.deepEqual(l.filter((a) => a.somenteLeitura).map((a) => a.id), ['legado-1', 'legado-2', 'legado-3', 'legado-4']);
  assert.equal(Atos.obter('legado-1').fases.length, 12);
});

test('A2. salvar rascunho: grava, sobe a versão, aponta erros (hunt inexistente) sem bloquear o rascunho', () => {
  const r = Atos.salvar(rascunho());
  assert.equal(r.ok, true);
  assert.equal(r.ato.versao, 1);
  assert.equal(r.ok && r.problemas.some((p) => /não existe no cadastro/.test(p.mensagem)), true);
  assert.equal(Atos.salvar(rascunho({ nome: 'Novo nome' })).ato.versao, 2);
  assert.ok(existsSync(join(pasta, 'ato-teste.json')));
});

test('A3. recusa: id de legado, id inválido e beta/publicado (ainda sem runtime)', () => {
  assert.equal(Atos.salvar(rascunho({ id: 'legado-1' })).ok, false);
  assert.equal(Atos.salvar(rascunho({ id: 'X' })).ok, false);
  assert.match(Atos.salvar(rascunho({ estado: 'publicado' })).erros[0], /Não dá para pôr em publicado/);
  assert.equal(Atos.excluir('legado-2').ok, false);
});

test('A4. duplicar um legado cria rascunho novo e não altera o original; as hunts em uso aparecem como erro', { skip: doClassico("Os 4 atos legados do Draevor no armazém") }, () => {
  const antes = JSON.stringify(Atos.obter('legado-1'));
  const r = Atos.duplicar('legado-1', 'copia-ato-um');
  assert.equal(r.ok, true);
  assert.equal(r.ato.estado, 'rascunho');
  assert.equal(r.ato.fases.length, 12);
  assert.equal(r.problemas.some((p) => /já é usada no ato "legado-1"/.test(p.mensagem)), true, 'o progresso é por hunt: a cópia não pode dividir hunts com o original');
  assert.equal(JSON.stringify(Atos.obter('legado-1')), antes);
  assert.equal(Atos.duplicar('legado-1', 'copia-ato-um').ok, false, 'id repetido');
  assert.equal(Atos.excluir('copia-ato-um').ok, true);
});

test('A5. rotas HTTP: lista, detalhe com validação, validar sem gravar, 404', { skip: doClassico("Os 4 atos legados do Draevor no armazém") }, async () => {
  const resp = [];
  const json = (r, cod, corpo) => resp.push([cod, corpo]);
  const chama = (metodo, rota, corpo = {}) => Http.atender({ method: metodo }, {}, `/api/mapas/_conteudo/${rota}`, new URL('http://x/'), { json, corpoJson: async () => corpo });
  await chama('GET', 'atos-editor');
  await chama('GET', 'atos-editor/legado-1');
  await chama('GET', 'atos-editor/nao-existe');
  await chama('POST', 'atos-editor/validar', rascunho({ id: 'so-validar' }));
  assert.deepEqual(resp.map((r) => r[0]), [200, 200, 404, 200]);
  assert.equal(resp[0][1].tiposDeFase.find((t) => t.id === 'hunt-normal').suportado, true);
  assert.equal(resp[1][1].ok, true, 'o legado 1 valida sem erro');
  assert.equal(existsSync(join(pasta, 'so-validar.json')), false);
});

test('A6. o runtime só usa o modelo puro e o carregador: nunca o armazém do editor (admin) nem o importador de legados', () => {
  for (const arq of ['systems/campanha.mjs', 'systems/cacadas.mjs', 'websocket/sessao.mjs']) {
    assert.doesNotMatch(readFileSync(new URL(`../${arq}`, import.meta.url), 'utf8'), /admin\/atos|atos-legado/);
  }
});
