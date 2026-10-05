import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import * as O from '../systems/overrides.mjs';
import * as E from '../admin/overrides-itens.mjs';
import * as Http from '../admin/conteudo-http.mjs';
import * as A from '../admin/acesso.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';

const pasta = mkdtempSync(join(tmpdir(), 'ovi-'));
E.CAMINHOS.arquivo = join(pasta, 'itens.json');
E.CAMINHOS.versoes = join(pasta, '_versoes', 'itens');
after(() => rmSync(pasta, { recursive: true, force: true }));
const limpa = () => rmSync(pasta, { recursive: true, force: true });
const arquivo = () => JSON.parse(readFileSync(E.CAMINHOS.arquivo, 'utf8'));
const REAL = JSON.parse(readFileSync(new URL('../gamedata/item-catalog.json', import.meta.url), 'utf8'));
const MACHADO = '3268';

test('OI1. validação: só itens que existem, só campos com suporte, tipos e faixas certos, raridade conhecida, avisos de preço', () => {
  const v = (id, ov) => O.validarItem(id, ov, { original: REAL[id] ?? null });
  assert.deepEqual(v(MACHADO, { attack: 20, sell: 5, rarity: 'raro', name: 'Machado', weight: 18.5 }).erros, []);
  const erros = (ov) => v(MACHADO, ov).erros.join(' | ');
  assert.match(erros({ voa: 1 }), /campo "voa" não tem suporte/);
  assert.match(erros({ attack: -1 }), /attack precisa ser um inteiro/);
  assert.match(erros({ attack: 1.5 }), /inteiro/);
  assert.match(erros({ weight: -2 }), /peso/);
  assert.match(erros({ name: '' }), /nome/);
  assert.match(erros({ rarity: 'divino' }), /raridade "divino" desconhecida/);
  assert.match(v('999999999', { attack: 1 }).erros.join(), /não existe no catálogo/);
  assert.ok(v(MACHADO, { sell: 500 }).avisos.some((a) => /maior que o de compra/.test(a)));
  assert.ok(v(MACHADO, { buy: 1 }).avisos.some((a) => /menor que o de venda/.test(a)));
});

test('OI2. aplicar: efetivo = original + diferenças (original intacto); override desligado ou camada desligada não se aplica; inválido é ignorado', () => {
  const orig = structuredClone(REAL[MACHADO]);
  const m = O.aplicarNoItem({ ...orig, sellCalculado: true }, { attack: 99, sell: 7 });
  assert.equal(m.attack, 99);
  assert.equal(m.sell, 7);
  assert.equal(m.sellCalculado, undefined, 'preço explícito tira a marca de preço calculado');
  assert.equal(orig.attack, REAL[MACHADO].attack);
  const cat = { [MACHADO]: structuredClone(REAL[MACHADO]), 3031: structuredClone(REAL[3031]) };
  const r = O.aplicarNosItens(cat, { ativo: true, itens: { [MACHADO]: { attack: 50 }, 3031: { attack: -4 }, 99999999: { attack: 1 }, 139: { ativo: false, attack: 1 } } }, () => {});
  assert.deepEqual(r.aplicados, [MACHADO]);
  assert.deepEqual(r.ignorados.map((i) => i.id).sort(), ['3031', '99999999']);
  assert.equal(cat[MACHADO].attack, 50);
  assert.equal(cat[3031].attack, undefined, 'inválido não altera');
  assert.equal(O.aplicarNosItens(cat, { ativo: false, itens: { [MACHADO]: { attack: 1 } } }).aplicados.length, 0);
});

test('OI3. propor não grava: mudanças com variação %, avisos de balanceamento e de uso; salvar grava só a diferença com versão; reverter apaga', () => {
  limpa();
  const p = E.propor(MACHADO, { attack: 20, rarity: 'raro' });
  assert.equal(p.ok, true);
  assert.deepEqual(p.mudancas.find((m) => m.campo === 'attack'), { campo: 'attack', antes: 10, depois: 20, variacaoPct: 100 });
  assert.ok(p.avisos.some((a) => /BALANCEAMENTO — attack: \+100%/.test(a)));
  assert.ok(p.avisos.some((a) => /raridade-base/.test(a)));
  assert.ok(p.avisos.some((a) => /USO — o item aparece em \d+ lugar/.test(a)));
  assert.equal(existsSync(E.CAMINHOS.arquivo), false);
  assert.equal(E.propor(MACHADO, { attack: -1 }).ok, false);
  assert.equal(E.propor(MACHADO, null).semMudancas, true);
  assert.equal(E.salvar(MACHADO, { attack: 20 }).ok, true);
  assert.deepEqual(arquivo().itens, { [MACHADO]: { attack: 20 } });
  E.salvar('139', { weight: 3 });
  assert.equal(E.versoes().length, 1);
  const antes = readFileSync(E.CAMINHOS.arquivo, 'utf8');
  assert.equal(E.salvar(MACHADO, { attack: -9 }).ok, false);
  assert.equal(readFileSync(E.CAMINHOS.arquivo, 'utf8'), antes, 'erro não grava');
  assert.equal(E.obter(MACHADO).efetivo.attack, 20);
  assert.equal(E.reverter(MACHADO).ok, true);
  assert.equal(E.obter(MACHADO).efetivo.attack, 10);
  assert.equal(E.reverter(MACHADO).ok, false);
  assert.equal(JSON.parse(readFileSync(new URL('../gamedata/item-catalog.json', import.meta.url), 'utf8'))[MACHADO].attack, 10, 'o catálogo importado nunca é tocado');
});

test('OI4. desligar uma entrada ou a camada não apaga nada; restaurar volta uma versão; listar exige busca (ou slot) e mostra os com override', () => {
  limpa();
  E.salvar(MACHADO, { attack: 20 });
  assert.equal(E.definirAtivo(false, MACHADO).ok, true);
  assert.equal(arquivo().itens[MACHADO].ativo, false);
  assert.equal(E.definirAtivo(true, MACHADO).ok, true);
  assert.equal(E.definirAtivo(false).ok, true);
  assert.equal(arquivo().ativo, false);
  assert.equal(Object.keys(arquivo().itens).length, 1);
  assert.equal(E.definirAtivo('sim').ok, false);
  assert.equal(E.listar({}).itens.length, 1, 'sem busca só os que têm override');
  assert.ok(E.listar({ q: 'hand axe' }).itens.some((i) => i.id === MACHADO));
  assert.ok(E.listar({ slot: 'head', limite: 5 }).itens.length >= 1);
  E.salvar('139', { weight: 5 });
  E.salvar('139', { weight: 6 });
  assert.equal(E.restaurar(1).ok, true);
  assert.equal(E.restaurar(99).ok, false);
});

test('OI5. O JOGO APLICA o que foi salvo: um processo novo enxerga o item alterado (e ignora o inválido); sem arquivo é o original', () => {
  limpa();
  E.salvar(MACHADO, { attack: 77, sell: 9, name: 'Machado Draevor' });
  const d = arquivo();
  d.itens['99999999'] = { attack: 1 };
  writeFileSync(E.CAMINHOS.arquivo, JSON.stringify(d));
  const codigo = `const D = await import(${JSON.stringify(new URL('../systems/dados.mjs', import.meta.url).href)}); const m = D.ITEM_CATALOG[${MACHADO}];
    console.log(JSON.stringify({ attack: m.attack, sell: m.sell, name: m.name, calc: m.sellCalculado, ign: D.resultadoDosOverridesDeItens.ignorados.map((i) => i.id), ok: D.resultadoDosOverridesDeItens.aplicados }));`;
  const roda = (pastaDeOverrides) => JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', codigo], { env: { ...process.env, DRAEVOR_OVERRIDES: pastaDeOverrides }, encoding: 'utf8' }).trim().split('\n').at(-1));
  const com = roda(pasta);
  assert.deepEqual([com.attack, com.sell, com.name], [77, 9, 'Machado Draevor']);
  assert.deepEqual(com.ign, ['99999999']);
  assert.deepEqual(com.ok, [MACHADO]);
  assert.equal(com.calc, undefined);
  const sem = roda(join(pasta, 'nao-existe'));
  assert.deepEqual([sem.attack, sem.name], [10, 'hand axe']);
  assert.equal(ITEM_CATALOG[MACHADO].attack, 10, 'o jogo DESTE processo não mudou (só vale no boot): salvar não é publicar');
});

test('OI6. rotas e acesso: leitura, pré-visualização (não grava) e ações (gravam); em produção o salvar é recusado', async () => {
  limpa();
  const chama = async (metodo, rota, corpo = {}, query = '') => { const r = []; await Http.atender({ method: metodo }, {}, `/api/mapas/_conteudo/${rota}`, new URL(`http://x/?${query}`), { json: (a, c, b) => r.push([c, b]), corpoJson: async () => corpo }); return r[0]; };
  assert.ok((await chama('GET', 'overrides/itens', {}, 'q=hand axe'))[1].total >= 1);
  assert.equal((await chama('GET', `overrides/itens/${MACHADO}`))[1].id, MACHADO);
  assert.equal((await chama('GET', 'overrides/itens/99999999'))[0], 404);
  assert.equal((await chama('POST', 'overrides/itens/validar', { id: MACHADO, override: { attack: 12 } }))[1].ok, true);
  assert.equal(existsSync(E.CAMINHOS.arquivo), false);
  assert.equal((await chama('POST', 'overrides/itens', { acao: 'salvar', id: MACHADO, override: { attack: 12 } }))[1].ok, true);
  assert.equal((await chama('POST', 'overrides/itens', { acao: 'xx' }))[0], 400);
  assert.equal(A.classeDaRota('POST', '/api/mapas/_conteudo/overrides/itens/validar'), 'leitura');
  assert.equal(A.classeDaRota('POST', '/api/mapas/_conteudo/overrides/itens'), 'grava');
});

test('OI7. a tela de itens está ligada: Itens (Biblioteca de consulta + "Editar itens" + "Editar este item"), menu "parcial", só rotas do servidor, confirmação nas ações de risco', () => {
  const conteudo = readFileSync(new URL('../frontend/client/src/editor-conteudo.mjs', import.meta.url), 'utf8');
  assert.match(conteudo, /criarEditorDeItens/);
  assert.match(conteudo, /Editar itens \(overrides\)/);
  assert.match(conteudo, /Editar este item \(override\)/);
  assert.match(conteudo, /\{ id: 'itens', nome: 'Itens', icone: 'espada', modo: 'parcial'/);
  const bib = readFileSync(new URL('../frontend/client/src/editor-biblioteca.mjs', import.meta.url), 'utf8');
  assert.match(bib, /itens: \(\) => fichaDoItem\(d, \{ abrir, api \}\),/);
  assert.match(bib, /acaoDaFicha\?\.\(d\) \?\? null,/);
  const tela = readFileSync(new URL('../frontend/client/src/editor-itens.mjs', import.meta.url), 'utf8');
  for (const r of ["'overrides/itens/validar'", "'overrides/itens'", 'overrides/itens/${encodeURIComponent(id)}']) assert.ok(tela.includes(r), r);
  assert.match(tela, /confirmar\(/);
  assert.match(tela, /original: \$\{orig\(\)\[c\] \?\? '—'\}/, 'o original aparece ao lado de cada campo');
});
