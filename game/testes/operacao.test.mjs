import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as Op from '../admin/operacao.mjs';
import * as Http from '../admin/conteudo-http.mjs';
import * as Beta from '../systems/modo-beta.mjs';
import * as Manutencao from '../systems/modo-de-manutencao.mjs';
import * as Premium from '../systems/premium.mjs';
import { CATALOGO } from '../systems/dados.mjs';
import { personagemDeTeste } from './apoio.mjs';

afterEach(() => {
  Beta.definir(false);
  Manutencao.definir(false);
  Op._limparRegistroParaTestes();
});

const chamar = async (metodo, rota, corpo = {}) => {
  const resp = [];
  await Http.atender({ method: metodo }, {}, `/api/mapas/_conteudo/${rota}`, new URL('http://x/'), { json: (r, c, b) => resp.push([c, b]), corpoJson: async () => corpo });
  return resp[0];
};

test('O1. modo beta: a tela liga/desliga e o JOGO muda de verdade (a regra de acesso responde), sem tocar no personagem', () => {
  const e = personagemDeTeste({ level: 1 });
  const antes = JSON.stringify(e);
  const vip = CATALOGO.vips[0];
  assert.equal(Premium.podeEntrar(e, vip).ok, false);
  assert.deepEqual(Op.definirBeta(true), { ok: true, ativo: true, mudou: true });
  assert.equal(Premium.podeEntrar(e, vip).ok, true, 'o jogo passou a liberar');
  assert.equal(Op.estadoDoBeta().ativo, true);
  assert.equal(Op.definirBeta(true).mudou, false, 'repetir não registra de novo');
  Op.definirBeta(false);
  assert.equal(Premium.podeEntrar(e, vip).ok, false, 'desligar devolve a regra normal na hora');
  assert.equal(JSON.stringify(e), antes, 'nada foi gravado no personagem');
  assert.equal(Op.definirBeta('sim').ok, false);
  assert.equal(Op.definirBeta(undefined).ok, false);
});

test('O2. estado do beta: padrão do boot e de onde vem, o que libera/não muda, alcance real e os atos do editor', () => {
  const s = Op.estadoDoBeta();
  assert.equal(typeof s.padraoDoBoot, 'boolean');
  assert.match(s.origemDoPadrao, /testes|arquivo|ambiente/);
  assert.ok(s.libera.length >= 3 && s.naoMuda.some((t) => /portal/.test(t)) && s.naoMuda.some((t) => /economia real/.test(t)), 'avisa que o ganho entra na economia real');
  assert.deepEqual(s.alcance, { vips: CATALOGO.vips.length, especiais: CATALOGO.especiais.length, divinas: CATALOGO.divinas.length, bosses: CATALOGO.bosses.length });
  assert.ok(Array.isArray(s.atosDoEditor));
});

test('O3. manutenção: liga/desliga o bloqueio de verdade (o que a sessão consulta), valida a mensagem e registra a ação', () => {
  const r = Op.definirManutencao(true, '  Volta em 10 min  ');
  assert.deepEqual([r.ok, r.ativa, r.mensagem], [true, true, 'Volta em 10 min']);
  assert.equal(Manutencao.bloqueada(), true, 'é o MESMO estado que a entrada no jogo consulta');
  assert.equal(Manutencao.mensagemDeBloqueio(), 'Volta em 10 min');
  assert.equal(Op.definirManutencao(true, 'x'.repeat(Op.MAX_MENSAGEM + 1)).ok, false);
  assert.equal(Op.definirManutencao('sim').ok, false);
  Op.definirManutencao(false);
  assert.equal(Manutencao.bloqueada(), false);
  const reg = Op.registro();
  assert.deepEqual(reg.map((x) => x.acao), ['manutenção', 'manutenção']);
  assert.match(reg[1].detalhe, /ligada: Volta em 10 min/);
  assert.match(reg[0].detalhe, /desligada/);
});

test('O4. Server Save: sem o sistema rodando a tela diz isso (não inventa), e executar é recusado; o estado geral reúne tudo', async () => {
  const g = await Op.estadoGeral();
  assert.equal(g.serverSave.rodando, false);
  assert.equal(g.serverSave.situacao, null);
  assert.equal(g.serverSave.proximoSlot, null);
  assert.ok(Array.isArray(g.serverSave.ciclos));
  assert.equal(g.manutencao.maxMensagem, Op.MAX_MENSAGEM);
  const r = await Op.executarServerSave();
  assert.equal(r.ok, false);
  assert.match(r.erros[0], /não está rodando/);
  assert.equal(Op.registro().length, 0, 'recusado não vira ação registrada');
});

test('O5. rotas HTTP novas e as antigas (compatíveis): estado, beta, manutenção e Server Save; entrada inválida volta 200 com ok:false (sem derrubar)', async () => {
  assert.equal((await chamar('GET', 'operacao/beta'))[1].ativo, false);
  assert.equal((await chamar('POST', 'operacao/beta', { ativo: true }))[1].ativo, true);
  assert.equal(Beta.ativo(), true);
  assert.equal((await chamar('POST', 'operacao/beta', { ativo: 1 }))[1].ok, false);
  const m = (await chamar('POST', 'operacao/manutencao', { ativo: true, mensagem: 'olá' }))[1];
  assert.deepEqual([m.ok, m.ativa], [true, true]);
  const geral = (await chamar('GET', 'operacao'))[1];
  assert.equal(geral.manutencao.ativa, true);
  assert.equal(geral.beta.ativo, true);
  assert.equal(geral.registro.length, 2);
  assert.equal((await chamar('POST', 'operacao/server-save'))[1].ok, false);
  const idx = readFileSync(new URL('../backend/index.mjs', import.meta.url), 'utf8');
  assert.match(idx, /\/api\/mapas\/_conteudo\/modo-beta/, 'a rota antiga continua');
  assert.match(idx, /Operacao\.definirBeta/, 'e usa o mesmo módulo (sem lógica duplicada)');
});

test('O6. as telas estão no menu (Recursos), ligadas às rotas e sem editar arquivo; o menu continua só com itens que têm tela', () => {
  const ed = readFileSync(new URL('../frontend/client/src/editor-conteudo.mjs', import.meta.url), 'utf8');
  assert.match(ed, /\['beta', 'Testes e beta'\]/);
  assert.match(ed, /\['config', 'Configurações'\]/);
  assert.match(ed, /criarTelasDeOperacao/);
  const tela = readFileSync(new URL('../frontend/client/src/editor-operacao.mjs', import.meta.url), 'utf8');
  for (const rota of ["'operacao/beta'", "'operacao'", "'operacao/manutencao'", "'operacao/server-save'"]) assert.ok(tela.includes(rota), rota);
  assert.match(tela, /confirmar\(/, 'toda ação de risco pede confirmação');
  assert.doesNotMatch(readFileSync(new URL('../admin/operacao.mjs', import.meta.url), 'utf8'), /writeFileSync|unlinkSync/, 'operação não grava arquivo');
});
