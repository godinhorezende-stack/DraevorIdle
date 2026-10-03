import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Atos from '../admin/atos.mjs';
import * as Http from '../admin/conteudo-http.mjs';
import * as M from '../systems/atos-modelo.mjs';
import * as Campanha from '../systems/campanha.mjs';

const rec = (extra = {}) => ({ drops: [{ id: 3268, chance: 25 }, { id: 3577, chance: 5 }], rolagens: 2, moedasMedia: 40, primeiraConclusao: { gold: 100, exp: 50, itens: [] }, ...extra });

test('D1. prévia: item, chance, esperado por execução, origem e condição; deixa claro o modelo (chance individual) e o que não existe', () => {
  const p = Atos.previa(rec(), { origem: 'fase' });
  assert.match(p.modelo, /INDIVIDUAL/);
  assert.match(p.modelo, /Não há peso/);
  const l = p.linhas.find((x) => x.item === 3268);
  assert.equal(l.chancePct, 25);
  assert.equal(l.esperadoPorExecucao, 0.5, '25% × 2 rolagens');
  assert.equal(l.origem, 'fase (loot)');
  assert.ok(p.linhas.some((x) => x.nome === 'ouro' && x.quantidade === 100));
  assert.ok(p.valorEsperadoPorExecucao > 0);
});

test('D2. simulador: estatístico, com semente (repetível), perto da chance configurada, e avisa que não garante uma execução real', () => {
  const a = Atos.simular(rec({ drops: [{ id: 3268, chance: 25 }], rolagens: 1 }), { execucoes: 40000, semente: 7 });
  const b = Atos.simular(rec({ drops: [{ id: 3268, chance: 25 }], rolagens: 1 }), { execucoes: 40000, semente: 7 });
  assert.deepEqual(a, b);
  assert.ok(Math.abs(a.itens[0].quedasPorExecucao - 0.25) < 0.01);
  assert.match(a.aviso, /não garante/);
  assert.equal(Atos.simular(rec(), { execucoes: 10 ** 9 }).execucoes, 100000, 'teto de execuções');
});

test('D3. alertas: chance inválida, item inexistente, rolagens fora do teto, duplicado e fonte dupla', () => {
  const erros = (r) => Atos.validarRecompensa(r).filter((p) => p.nivel === 'erro').map((p) => p.mensagem).join('|');
  assert.match(erros({ drops: [{ id: 3268, chance: 0 }], rolagens: 1 }), /chance/);
  assert.match(erros({ drops: [{ id: 3268, chance: 101 }], rolagens: 1 }), /chance/);
  assert.match(erros({ drops: [{ id: 99999999, chance: 5 }], rolagens: 1 }), /não existe no catálogo/);
  assert.match(erros({ drops: [{ id: 3268, chance: 5 }], rolagens: 99 }), /rolagens/);
  assert.match(erros({ drops: [{ id: 3268, chance: 5 }], rolagens: 1, primeiraConclusao: { gold: -5 } }), /gold/);
  const avisos = Atos.validarRecompensa({ drops: [{ id: 3268, chance: 5 }, { id: 3268, chance: 5 }], rolagens: 1, primeiraConclusao: { itens: [{ id: 3268, count: 1 }] } }).filter((p) => p.nivel === 'aviso').map((p) => p.mensagem).join('|');
  assert.match(avisos, /mais de uma vez/);
  assert.match(avisos, /primeira conclusão/);
});

test('D4. economia: recompensa grande demais perto do valor de limpar a fase vira aviso/erro (o mesmo teto dos encontros); fase sem spawns avisa que não há base', () => {
  const huntLegada = Campanha.FASES.find((f) => f.huntId === 'troll-cave');
  assert.ok(huntLegada);
  const enorme = { drops: [{ id: 3031, chance: 100 }], rolagens: 5, moedasMedia: 1_000_000 };
  const probs = Atos.validarRecompensa(enorme, 'troll-cave');
  assert.ok(probs.some((p) => p.nivel === 'erro'), JSON.stringify(probs));
  const pequena = { drops: [{ id: 3268, chance: 1 }], rolagens: 1 };
  assert.equal(Atos.validarRecompensa(pequena, 'troll-cave').filter((p) => p.nivel === 'erro').length, 0);
});

test('D5. rota de prévia: devolve prévia, simulação opcional e os alertas; o modelo puro aceita recompensas só com contexto injetado', async () => {
  const resp = [];
  const json = (r, c, b) => resp.push([c, b]);
  await Http.atender({ method: 'POST' }, {}, '/api/mapas/_conteudo/atos-editor/previa', new URL('http://x/'), { json, corpoJson: async () => ({ recompensa: rec(), origem: 'boss', simular: true, execucoes: 2000 }) });
  assert.equal(resp[0][0], 200);
  assert.equal(resp[0][1].previa.linhas[0].origem, 'boss final (loot)');
  assert.equal(resp[0][1].simulacao.execucoes, 2000);
  const a = { id: 'ato-teste', nome: 'T', inicio: 'fase-1', fases: [{ id: 'fase-1', nome: 'U', huntId: 'x', recompensas: rec({ drops: [{ id: 1, chance: 5 }] }) }], conexoes: [] };
  const sem = M.validarAto(a, {});
  assert.ok(!sem.some((p) => /catálogo/.test(p.mensagem)), 'sem ctx.validarRecompensa o modelo puro não consulta o catálogo');
  const com = M.validarAto(a, { validarRecompensa: () => ['item 1 não existe'] });
  assert.ok(com.some((p) => p.onde === 'fase fase-1' && /item 1/.test(p.mensagem)));
});
