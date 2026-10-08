import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, copyFileSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as CE from '../admin/campanha-editor.mjs';
import * as Http from '../admin/conteudo-http.mjs';
import * as Campanha from '../systems/campanha.mjs';
import { propostoDasEdicoes } from '../frontend/client/src/editor-campanha.mjs';
import { doClassico } from './apoio-migracao.mjs';

const REAL = fileURLToPath(new URL('../gamedata/campanha.json', import.meta.url));
const pasta = mkdtempSync(join(tmpdir(), 'camp-'));
CE.CAMINHOS.arquivo = join(pasta, 'campanha.json');
CE.CAMINHOS.versoes = join(pasta, 'versoes');
copyFileSync(REAL, CE.CAMINHOS.arquivo);
const original = readFileSync(REAL, 'utf8');
after(() => rmSync(pasta, { recursive: true, force: true }));
const lerSalvo = () => JSON.parse(readFileSync(CE.CAMINHOS.arquivo, 'utf8'));
const restauraArquivo = () => { writeFileSync(CE.CAMINHOS.arquivo, original); rmSync(CE.CAMINHOS.versoes, { recursive: true, force: true }); };

test('CE1. ler: as 48 fases e os 4 bosses de ato editáveis; escala e dificuldades vêm só para leitura; nada foi tocado no arquivo real', { skip: doClassico("Editor da campanha do Draevor (48 fases, 4 bosses de ato)") }, () => {
  const l = CE.ler();
  assert.equal(l.fases.length, Campanha.FASES.length);
  assert.equal(l.bosses.length, 4);
  assert.deepEqual(l.fases[0], { indice: 0, huntId: 'troll-cave', nome: 'Troll Cave', ato: 1, levelOriginal: 8, nivel: { facil: 8, medio: 101, dificil: 601 }, pular: false });
  assert.equal(l.escala.vida, 1.2);
  assert.equal(l.fases.filter((f) => f.pular).length, 1, 'a fase travada atual (dark-thais) aparece');
  assert.equal(readFileSync(REAL, 'utf8'), original);
});

test('CE2. pré-visualizar: o impacto é a MESMA conta do jogo (Campanha.escala), sem gravar; mudança grande de vida vira aviso de balanceamento', { skip: doClassico("Editor da campanha do Draevor (48 fases, 4 bosses de ato)") }, () => {
  const r = CE.propor({ fases: [{ huntId: 'troll-cave', nivel: { medio: 150 } }] });
  assert.deepEqual(r.erros, []);
  assert.equal(r.mudancas.length, 1);
  const f = Campanha.faseDe('troll-cave');
  const antes = Campanha.escala(f.levelOriginal, 101);
  const depois = Campanha.escala(f.levelOriginal, 150);
  const i = r.mudancas[0].impacto.medio;
  assert.equal(i.vida.antes, Number(antes.vida.toFixed(3)));
  assert.equal(i.vida.depois, Number(depois.vida.toFixed(3)));
  assert.equal(i.vida.variacaoPct, Math.round((depois.vida / antes.vida - 1) * 100));
  assert.ok(r.avisos.some((a) => /BALANCEAMENTO — Troll Cave no Cruel: a vida dos bichos muda \+\d+%/.test(a)));
  assert.equal(readFileSync(CE.CAMINHOS.arquivo, 'utf8'), original, 'pré-visualizar não grava');
  assert.equal(CE.propor({}).semMudancas, true);
  assert.equal(CE.propor({ fases: [{ huntId: 'troll-cave', nivel: { medio: 101 } }] }).semMudancas, true, 'valor igual ao atual não é mudança');
});

test('CE3. validação: não cria nem remove fase, level inteiro 1–5000, Normal ≤ Cruel ≤ Merciless, hunt/boss existem; escada que desce e fora da faixa são avisos', { skip: doClassico("Editor da campanha do Draevor (48 fases de campanha.json); a campanha do PoE vem de campanha-poe.json") }, () => {
  const erros = (p) => CE.propor(p).erros.join(' | ');
  assert.match(erros({ fases: [{ huntId: 'fase-fantasma', nivel: { facil: 5 } }] }), /não é uma fase da campanha.*Acts/);
  assert.match(erros({ fases: [{ huntId: 'troll-cave', nivel: { facil: 0 } }] }), /inteiro de 1 a 5000/);
  assert.match(erros({ fases: [{ huntId: 'troll-cave', nivel: { facil: 5.5 } }] }), /inteiro/);
  assert.match(erros({ fases: [{ huntId: 'troll-cave', nivel: { facil: 200 } }] }), /precisam crescer do Normal ao Cruel/);
  assert.match(erros({ fases: [{ huntId: 'troll-cave', levelOriginal: 'x' }] }), /level original/);
  assert.match(erros({ fases: [{ huntId: 'troll-cave', pular: 'sim' }] }), /verdadeiro ou falso/);
  assert.match(erros({ bosses: [{ ato: 9, nivel: { facil: 1 } }] }), /não existe na campanha/);
  const fora = CE.propor({ fases: [{ huntId: 'troll-cave', nivel: { facil: 150, medio: 160 } }] });
  assert.deepEqual(fora.erros, []);
  assert.ok(fora.avisos.some((a) => /fora da faixa da dificuldade \(8–100\)/.test(a)));
  const escada = CE.propor({ fases: [{ huntId: 'troll-cave', nivel: { facil: 60, medio: 150 } }] });
  assert.ok(escada.avisos.some((a) => /Ato 1, Normal: Amazon Camp \(10\) tem level alvo MENOR que Troll Cave \(60\)/.test(a)));
  assert.equal(CE.ler().fases.length, 48, 'a estrutura é a mesma');
});

test('CE4. travar/destravar fase é mudança de PROGRESSÃO e avisa com todas as letras', { skip: doClassico("Editor da campanha do Draevor (48 fases de campanha.json); a campanha do PoE vem de campanha-poe.json") }, () => {
  const travar = CE.propor({ fases: [{ huntId: 'troll-cave', pular: true }] });
  assert.ok(travar.avisos.some((a) => /PROGRESSÃO — Troll Cave: fica TRAVADA/.test(a)));
  const destravar = CE.propor({ fases: [{ huntId: 'dark-thais', pular: false }] });
  assert.ok(destravar.avisos.some((a) => /PROGRESSÃO — .*DESTRAVADA/.test(a)));
  const boss = CE.propor({ bosses: [{ ato: 1, nivel: { facil: 40 } }] });
  assert.ok(boss.avisos.some((a) => /boss do Ato 1.*item level do loot/.test(a)));
});

test('CE5. salvar: grava SÓ os campos pedidos (o resto do arquivo idêntico), guarda a versão anterior e recusa erro sem gravar nada', { skip: doClassico("Editor da campanha do Draevor (48 fases de campanha.json); a campanha do PoE vem de campanha-poe.json") }, () => {
  restauraArquivo();
  const r = CE.salvar({ fases: [{ huntId: 'troll-cave', nivel: { facil: 9, medio: 110 } }], bosses: [{ ato: 2, nivel: { dificil: 1500 } }] });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.match(r.comoPublicar, /commit e publique pelo deploy/);
  const novo = lerSalvo();
  const velho = JSON.parse(original);
  assert.equal(novo.fases[0].nivel.facil, 9);
  assert.equal(novo.fases[0].nivel.medio, 110);
  assert.equal(novo.bosses['2'].nivel.dificil, 1500);
  // tudo o mais é idêntico
  novo.fases[0].nivel = velho.fases[0].nivel;
  novo.bosses['2'].nivel = velho.bosses['2'].nivel;
  assert.deepEqual(novo, velho, 'só os campos editados mudaram (notas, escala, dificuldades, outras fases)');
  assert.equal(readdirSync(CE.CAMINHOS.versoes).length, 1);
  assert.equal(readFileSync(join(CE.CAMINHOS.versoes, '1.json'), 'utf8'), original, 'a versão guardada é a de antes');
  const antesDoErro = readFileSync(CE.CAMINHOS.arquivo, 'utf8');
  const ruim = CE.salvar({ fases: [{ huntId: 'troll-cave', nivel: { facil: 500, medio: 10 } }] });
  assert.equal(ruim.ok, false);
  assert.equal(readFileSync(CE.CAMINHOS.arquivo, 'utf8'), antesDoErro, 'erro não grava');
  assert.equal(readdirSync(CE.CAMINHOS.versoes).length, 1, 'nem cria versão');
  assert.equal(CE.salvar({}).semMudancas, true);
  assert.equal(CE.salvar({ fases: [{ huntId: 'troll-cave', nivel: { facil: 9 } }] }).semMudancas, true, 'igual ao salvo: não grava');
});

test('CE6. o que o editor SALVA é o que o JOGO LÊ: um processo novo do jogo, apontado para o arquivo salvo, enxerga os levels e a escala novos', { skip: doClassico("Editor da campanha do Draevor (48 fases, 4 bosses de ato)") }, () => {
  restauraArquivo();
  CE.salvar({ fases: [{ huntId: 'troll-cave', levelOriginal: 10, nivel: { facil: 12, medio: 130, dificil: 700 } }], bosses: [{ ato: 1, nivel: { facil: 35 } }] });
  const codigo = `import * as C from ${JSON.stringify(new URL('../systems/campanha.mjs', import.meta.url).href)};
    const f = C.faseDe('troll-cave');
    console.log(JSON.stringify({ nivel: f.nivel, levelOriginal: f.levelOriginal, escala: C.escalaDaFase('troll-cave', 'medio'), boss: C.bossDoAto(1).nivel, fases: C.FASES.length, atos: C.ATOS }));`;
  const saida = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', codigo], { env: { ...process.env, DRAEVOR_CAMPANHA: CE.CAMINHOS.arquivo }, encoding: 'utf8' }).trim().split('\n').at(-1));
  assert.deepEqual(saida.nivel, { facil: 12, medio: 130, dificil: 700 });
  assert.equal(saida.levelOriginal, 10);
  assert.equal(saida.escala.nivel, 130);
  assert.equal(Number(saida.escala.vida.toFixed(3)), Number(Math.pow(130 / 10, 1.2).toFixed(3)));
  assert.equal(saida.boss.facil, 35);
  assert.deepEqual([saida.fases, saida.atos], [48, 4], 'a estrutura da campanha segue igual');
  assert.equal(Campanha.faseDe('troll-cave').nivel.medio, 101, 'o jogo DESTE processo não mudou (só vale no boot): salvar não é publicar');
});

test('CE7. restaurar: grava a versão antiga como atual e guarda a atual; versão inexistente é recusada', { skip: doClassico("Editor da campanha do Draevor (48 fases de campanha.json); a campanha do PoE vem de campanha-poe.json") }, () => {
  restauraArquivo();
  CE.salvar({ fases: [{ huntId: 'troll-cave', nivel: { medio: 120 } }] });
  CE.salvar({ fases: [{ huntId: 'troll-cave', nivel: { medio: 140 } }] });
  assert.deepEqual(CE.versoes(), [2, 1]);
  assert.equal(CE.restaurar(9).ok, false);
  assert.equal(CE.restaurar(1).ok, true);
  assert.equal(lerSalvo().fases[0].nivel.medio, 101, 'voltou ao original');
  assert.deepEqual(CE.versoes(), [3, 2, 1], 'a atual antes de restaurar ficou guardada');
});

test('CE8. rotas: leitura, pré-visualizar (não grava) e salvar (grava); a tela só edita o PROPOSTO (diferenças) e o acesso classifica certo', { skip: doClassico("Editor da campanha do Draevor (48 fases de campanha.json); a campanha do PoE vem de campanha-poe.json") }, async () => {
  restauraArquivo();
  const chama = async (metodo, rota, corpo = {}) => { const r = []; await Http.atender({ method: metodo }, {}, `/api/mapas/_conteudo/${rota}`, new URL('http://x/'), { json: (a, c, b) => r.push([c, b]), corpoJson: async () => corpo }); return r[0]; };
  assert.equal((await chama('GET', 'campanha'))[1].fases.length, 48);
  const v = (await chama('POST', 'campanha/validar', { fases: [{ huntId: 'troll-cave', nivel: { medio: 120 } }] }))[1];
  assert.equal(v.ok, true);
  assert.equal(v.mudancas.length, 1);
  assert.equal(readFileSync(CE.CAMINHOS.arquivo, 'utf8'), original, 'validar não grava');
  assert.equal((await chama('POST', 'campanha', { fases: [{ huntId: 'troll-cave', nivel: { medio: 120 } }] }))[1].ok, true);
  assert.equal(lerSalvo().fases[0].nivel.medio, 120);
  assert.equal((await chama('GET', 'campanha/versoes'))[1].versoes.length, 1);
  const A = await import('../admin/acesso.mjs');
  assert.equal(A.classeDaRota('POST', '/api/mapas/_conteudo/campanha/validar'), 'leitura');
  assert.equal(A.classeDaRota('POST', '/api/mapas/_conteudo/campanha'), 'grava', 'em produção o salvar é recusado');
  const orig = { fases: [{ huntId: 'a', levelOriginal: 8, nivel: { facil: 8, medio: 101, dificil: 601 }, pular: false }], bosses: [{ ato: 1, levelOriginal: 100, nivel: { facil: 30, medio: 225, dificil: 950 } }] };
  const ed = structuredClone(orig);
  assert.deepEqual(propostoDasEdicoes(orig, ed), { fases: [], bosses: [] });
  ed.fases[0].nivel.medio = 120;
  ed.fases[0].pular = true;
  ed.bosses[0].nivel.facil = 40;
  assert.deepEqual(propostoDasEdicoes(orig, ed), { fases: [{ huntId: 'a', nivel: { medio: 120 }, pular: true }], bosses: [{ ato: 1, nivel: { facil: 40 } }] });
});

test('CE9. a vista está ligada em Hunts e áreas (botão, rota #hunts/niveis, "salvar ≠ publicar" explícito) e usa só as rotas do servidor', () => {
  const tela = readFileSync(new URL('../frontend/client/src/editor-campanha.mjs', import.meta.url), 'utf8');
  for (const r of ["'campanha'", "'campanha/validar'", "'campanha/restaurar'", "'campanha/versoes'"]) assert.ok(tela.includes(r), r);
  assert.match(tela, /Publicar \(commit \+ deploy\)/);
  assert.match(tela, /confirmar\(/);
  const hunts = readFileSync(new URL('../frontend/client/src/editor-hunts.mjs', import.meta.url), 'utf8');
  assert.match(hunts, /criarEditorDeNiveis/);
  assert.match(hunts, /#hunts\/niveis/);
  assert.equal(JSON.stringify(Object.keys(readFileSync(REAL, 'utf8') && JSON.parse(original))), JSON.stringify(['_nota', 'dificuldades', '_escala', 'escala', 'fases', 'bosses']), 'o arquivo real segue como estava');
});
