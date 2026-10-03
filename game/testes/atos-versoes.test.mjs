import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as Atos from '../admin/atos.mjs';
import * as Http from '../admin/conteudo-http.mjs';
import * as M from '../systems/atos-modelo.mjs';

const pasta = mkdtempSync(join(tmpdir(), 'atos-v-'));
Atos.CAMINHOS.atos = pasta;
after(() => rmSync(pasta, { recursive: true, force: true }));
const base = (extra = {}) => ({ id: 'ato-versoes', nome: 'Ato v', inicio: 'fase-1', fases: [{ id: 'fase-1', nome: 'Um', huntId: 'troll-cave' }], conexoes: [], bossFinal: null, ...extra });

test('V1. cada gravação deixa uma versão (só acréscimo); a lista vem da mais nova para a mais antiga', () => {
  Atos.salvar(base());
  Atos.salvar(base({ nome: 'Ato v2' }));
  Atos.salvar(base({ nome: 'Ato v3', descricao: 'x' }));
  const v = Atos.versoes('ato-versoes');
  assert.deepEqual(v.map((x) => x.versao), [3, 2, 1]);
  assert.equal(Atos.versao('ato-versoes', 1).nome, 'Ato v');
  assert.equal(Atos.versao('ato-versoes', 9), null);
  assert.equal(Atos.versao('../etc', 1), null);
  assert.equal(readdirSync(join(pasta, '_versoes', 'ato-versoes')).length, 3);
});

test('V2. as versões não aparecem como atos nem são lidas pelo jogo; excluir e recriar não reaproveita número', () => {
  assert.deepEqual(Atos.listar().filter((a) => !a.somenteLeitura).map((a) => a.id), ['ato-versoes']);
  assert.equal(Atos.excluir('ato-versoes').ok, true);
  assert.ok(existsSync(join(pasta, '_versoes', 'ato-versoes', '3.json')), 'o histórico fica');
  const r = Atos.salvar(base({ nome: 'Recriado' }));
  assert.equal(r.ato.versao, 4);
});

test('V3. comparar: campos do ato, fases novas/removidas/alteradas, ligações, boss final; arrastar fase é só posição', () => {
  const antes = base({ fases: [{ id: 'fase-1', nome: 'Um', huntId: 'troll-cave', posicao: { x: 1, y: 1 } }, { id: 'fase-2', nome: 'Dois', huntId: 'a-a' }], conexoes: [{ de: 'fase-1', para: 'fase-2' }], bossFinal: { bossId: 'ahau', faseAnterior: 'fase-2' } });
  const depois = base({ nome: 'Outro nome', fases: [{ id: 'fase-1', nome: 'Um!', huntId: 'troll-cave', posicao: { x: 9, y: 9 } }, { id: 'fase-3', nome: 'Três', huntId: 'b-b' }], conexoes: [{ de: 'fase-1', para: 'fase-3', rotulo: 'A' }], bossFinal: { bossId: 'ahau', faseAnterior: 'fase-3', recompensas: { drops: [] } } });
  const d = M.diffDeAtos(antes, depois);
  assert.equal(d.iguais, false);
  assert.deepEqual(d.ato.map((c) => c.campo), ['nome']);
  assert.deepEqual([d.fasesNovas, d.fasesRemovidas], [['fase-3'], ['fase-2']]);
  assert.deepEqual(d.fasesAlteradas[0].campos.map((c) => c.campo), ['nome']);
  assert.deepEqual([d.ligacoesNovas, d.ligacoesRemovidas], [['fase-1>fase-3'], ['fase-1>fase-2']]);
  assert.deepEqual(d.bossFinal.map((c) => c.campo).sort(), ['faseAnterior', 'recompensas']);
  const soPos = M.diffDeAtos(antes, { ...antes, fases: antes.fases.map((f) => ({ ...f, posicao: { x: 50, y: 50 } })) });
  assert.equal(soPos.iguais, true);
  assert.ok(soPos.soPosicao >= 1);
});

test('V4. restaurar grava uma versão NOVA com o conteúdo antigo, SEMPRE como rascunho (nunca publica sozinho)', () => {
  Atos.salvar(base({ nome: 'Publicável' }));
  const atual = Atos.obter('ato-versoes').versao;
  Atos.salvar(base({ nome: 'Mudou' }));
  const r = Atos.restaurar('ato-versoes', atual);
  assert.equal(r.ok, true);
  assert.equal(r.ato.nome, 'Publicável');
  assert.equal(r.ato.estado, 'rascunho');
  assert.equal(r.ato.versao, atual + 2);
  assert.equal(Atos.restaurar('ato-versoes', 999).ok, false);
  const c = Atos.comparar('ato-versoes', atual);
  assert.equal(c.ok, true);
  assert.equal(c.ato.length, 0, 'a restaurada é igual à versão de origem');
});

test('V5. checklist de publicação: aponta o que falta, diz se o ato já está no jogo e como publicar (arquivo + reinício)', () => {
  const c = Atos.checklistDePublicacao('ato-versoes');
  assert.equal(c.pronto, false);
  assert.ok(c.itens.some((i) => !i.ok && /Validação/.test(i.texto)));
  assert.ok(c.itens.some((i) => !i.ok && /Estado atual/.test(i.texto)));
  assert.equal(c.noJogoAgora, false);
  assert.match(c.comoPublicar, /próximo boot/);
  assert.equal(Atos.checklistDePublicacao('nao-existe'), null);
  assert.equal(Atos.checklistDePublicacao('legado-1').itens[0].ok, false);
});

test('V6. rotas HTTP: versões, versão, comparar, publicação e restaurar', async () => {
  const resp = [];
  const json = (r, c, b) => resp.push([c, b]);
  const chama = (metodo, rota, q = '', corpo = {}) => Http.atender({ method: metodo }, {}, `/api/mapas/_conteudo/${rota}`, new URL(`http://x/?${q}`), { json, corpoJson: async () => corpo });
  const n = Atos.versoes('ato-versoes')[0].versao;
  await chama('GET', 'atos-editor/ato-versoes/versoes');
  await chama('GET', `atos-editor/ato-versoes/versao/${n}`);
  await chama('GET', 'atos-editor/ato-versoes/versao/999');
  await chama('GET', 'atos-editor/ato-versoes/comparar', `de=1&para=${n}`);
  await chama('GET', 'atos-editor/ato-versoes/publicacao');
  await chama('POST', 'atos-editor/ato-versoes/restaurar', '', { versao: 1 });
  assert.deepEqual(resp.map((r) => r[0]), [200, 200, 404, 200, 200, 200]);
  assert.ok(resp[0][1].versoes.length >= 3);
  assert.equal(resp[5][1].ato.estado, 'rascunho');
});

test('V7. vistas: a ordem das fases segue o grafo (soltas no fim), o resumo de recompensa é legível e a tela usa só o servidor', async () => {
  const { ordemDasFases, resumoDeRecompensa } = await import('../frontend/client/src/editor-atos-vistas.mjs');
  const ato = M.normalizar({ id: 'ato-x-x', inicio: 'a-a', fases: ['a-a', 'b-b', 'c-c', 'd-d', 'solta'].map((id) => ({ id, nome: id })), conexoes: [{ de: 'a-a', para: 'b-b' }, { de: 'a-a', para: 'c-c' }, { de: 'b-b', para: 'd-d' }, { de: 'c-c', para: 'd-d' }] });
  assert.deepEqual(ordemDasFases(ato).map((f) => f.id), ['a-a', 'b-b', 'c-c', 'd-d', 'solta']);
  assert.equal(resumoDeRecompensa(null), null);
  assert.match(resumoDeRecompensa({ drops: [{ id: 1, chance: 5 }], rolagens: 2, primeiraConclusao: { gold: 1500, exp: 20, itens: [{ id: 1, count: 1 }] } }), /1 drop\(s\) × 2 rolagem.*1\.500 de ouro.*20 de exp.*1 item/);
  const fonte = (await import('node:fs')).readFileSync(new URL('../frontend/client/src/editor-atos.mjs', import.meta.url), 'utf8');
  for (const rota of ['restaurar', 'vistaVersoes', 'vistaPublicacao', 'vistaValidacao', 'vistaPrevia']) assert.ok(fonte.includes(rota), rota);
});
