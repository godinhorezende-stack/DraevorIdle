import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../systems/atos-modelo.mjs';
import * as Legado from '../systems/atos-legado.mjs';
import * as Campanha from '../systems/campanha.mjs';

const fase = (id, extra = {}) => ({ id, nome: id.toUpperCase(), huntId: `hunt-${id}`, tipo: 'hunt-normal', ...extra });
const ato5 = (mod = {}) => ({
  id: 'ato-cinco', nome: 'Ato Cinco', estado: 'rascunho', inicio: 'fase-1',
  fases: ['fase-1', 'fase-2', 'fase-3', 'fase-4', 'fase-5', 'fase-6', 'fase-7'].map((i) => fase(i)),
  conexoes: [['fase-1', 'fase-2'], ['fase-2', 'fase-3'], ['fase-3', 'fase-4'], ['fase-4', 'fase-5'], ['fase-4', 'fase-6'], ['fase-5', 'fase-7'], ['fase-6', 'fase-7']].map(([de, para]) => ({ de, para })),
  bossFinal: { bossId: 'urmahlullu-the-immaculate', faseAnterior: 'fase-7' },
  ...mod,
});
const ctx = { huntExiste: () => true, bossExiste: (b) => b === 'urmahlullu-the-immaculate' };
const erros = (a, c = ctx) => M.validarAto(a, c).filter((p) => p.nivel === 'erro');

test('G1. o exemplo do dono (1→2→3→4, bifurca em 5 e 6, converge em 7) é válido, com caminhos alternativos e convergência', () => {
  assert.deepEqual(erros(ato5()), []);
  const a = M.normalizar(ato5());
  assert.equal(M.alcancaveis(a).size, 7);
  assert.equal(M.acharCiclo(a), null);
});

test('G2. detecta fase isolada, ciclo, referência quebrada e ligação para si mesma', () => {
  const iso = ato5({ fases: [...ato5().fases, fase('fase-8')] });
  assert.ok(erros(iso).some((e) => e.onde === 'fase fase-8' && /isolada/.test(e.mensagem)));
  const ciclo = ato5({ conexoes: [...ato5().conexoes, { de: 'fase-6', para: 'fase-2' }] });
  assert.ok(erros(ciclo).some((e) => /Ciclo/.test(e.mensagem)));
  const quebrada = ato5({ conexoes: [...ato5().conexoes, { de: 'fase-3', para: 'nada' }] });
  assert.ok(erros(quebrada).some((e) => /"nada" não existe/.test(e.mensagem)));
  assert.ok(erros(ato5({ conexoes: [...ato5().conexoes, { de: 'fase-2', para: 'fase-2' }] })).some((e) => /si mesma/.test(e.mensagem)));
});

test('G3. boss final: fase anterior precisa ser terminal, existir e ser hunt; boss inexistente e fim de caminho sem boss são erros', () => {
  assert.ok(erros(ato5({ bossFinal: { bossId: 'urmahlullu-the-immaculate', faseAnterior: 'fase-4' } })).some((e) => /tem saídas/.test(e.mensagem)));
  assert.ok(erros(ato5({ bossFinal: { bossId: 'nao-existe', faseAnterior: 'fase-7' } })).some((e) => /não existe no cadastro/.test(e.mensagem)));
  assert.ok(erros(ato5({ bossFinal: { bossId: 'urmahlullu-the-immaculate', faseAnterior: 'zzz' } })).some((e) => /fase anterior/.test(e.mensagem)));
  const solto = ato5({ conexoes: ato5().conexoes.filter((c) => c.de !== 'fase-6' || c.para !== 'fase-7') });
  assert.ok(erros(solto).some((e) => /Fim de caminho/.test(e.mensagem)));
  const opt = ato5({ fases: ato5().fases.map((f) => (f.id === 'fase-6' ? { ...f, obrigatoria: false } : f)), conexoes: solto.conexoes });
  assert.ok(!erros(opt).some((e) => /Fim de caminho/.test(e.mensagem)), 'ramal opcional pode terminar sem o boss');
});

test('G4. tipos sem suporte no runtime são só aviso no rascunho e ERRO ao pôr em beta/publicado; hunt de outro ato e id/nome inválidos', () => {
  const vip = ato5({ fases: ato5().fases.map((f) => (f.id === 'fase-2' ? { ...f, tipo: 'fase-com-bau' } : f)) });
  assert.deepEqual(erros(vip), []);
  assert.ok(M.validarAto(vip, ctx).some((p) => p.nivel === 'aviso' && /suporte/.test(p.mensagem)));
  assert.ok(erros({ ...vip, estado: 'beta' }).some((e) => /ainda não tem suporte/.test(e.mensagem)));
  assert.ok(erros(ato5(), { ...ctx, huntsEmUso: new Map([['hunt-fase-3', 'legado-1']]) }).some((e) => /já é usada no ato/.test(e.mensagem)));
  assert.ok(erros(ato5({ id: 'X', nome: '' })).length >= 2);
  assert.ok(erros(ato5(), { ...ctx, huntExiste: (h) => h !== 'hunt-fase-5' }).some((e) => e.onde === 'fase fase-5'));
});

test('G5. fasesAbertas segue o grafo: bifurcação abre os dois caminhos; a convergência abre com qualquer um; requisito de caminho bloqueia', () => {
  const a = M.normalizar(ato5());
  assert.deepEqual([...M.fasesAbertas(a, [])], ['fase-1']);
  assert.deepEqual([...M.fasesAbertas(a, ['fase-1', 'fase-2', 'fase-3', 'fase-4'])].sort(), ['fase-1', 'fase-2', 'fase-3', 'fase-4', 'fase-5', 'fase-6']);
  assert.ok(M.fasesAbertas(a, ['fase-1', 'fase-2', 'fase-3', 'fase-4', 'fase-6']).has('fase-7'));
  const com = M.normalizar(ato5({ conexoes: ato5().conexoes.map((c) => (c.de === 'fase-4' && c.para === 'fase-6' ? { ...c, requisito: { exige: ['fase-1', 'fase-9'] } } : c)) }));
  assert.ok(!M.fasesAbertas(com, ['fase-1', 'fase-2', 'fase-3', 'fase-4']).has('fase-6'));
});

test('G6. atos legados: 4 atos de 12 fases (a travada fora do grafo), válidos, e a regra do grafo dá o MESMO que o runtime linear atual', () => {
  const legados = Legado.atosLegados();
  assert.equal(legados.length, Campanha.ATOS);
  const todasAsHunts = new Set(Campanha.FASES.map((f) => f.huntId));
  const emUso = new Map(); // hunts de cada ato não conflitam com o próprio ato
  for (const a of legados) {
    assert.equal(a.fases.length, Campanha.FASES.filter((f) => f.ato === a.ordem && !f.pular).length);
    assert.deepEqual(erros(a, { huntExiste: (h) => todasAsHunts.has(h), bossExiste: () => true, huntsEmUso: emUso }), [], a.id);
    assert.equal(a.bossFinal.faseAnterior, Campanha.ultimaFaseDoAto(a.ordem).huntId);
    assert.equal(a.legado.somenteLeitura, true);
  }
  assert.deepEqual(legados[0].legado.travadas.concat(legados.flatMap((a) => a.legado.travadas)).filter(Boolean), ['dark-thais']);
  // Equivalência: toda progressão alcançável (completar sempre a próxima aberta) abre as mesmas fases nos dois sistemas.
  for (const a of legados) {
    const estado = { campanha: { facil: { limpezas: {}, completas: [], bosses: Array.from({ length: a.ordem - 1 }, (_, i) => i + 1) } } };
    const feitas = new Set();
    for (let passo = 0; passo <= a.fases.length; passo++) {
      const runtime = new Set(a.fases.filter((f) => Campanha.faseLiberada(estado, 'facil', f.huntId)).map((f) => f.id));
      assert.deepEqual([...M.fasesAbertas(a, feitas)].sort(), [...runtime].sort(), `${a.id} passo ${passo}`);
      const proxima = a.fases.find((f) => runtime.has(f.id) && !feitas.has(f.id));
      if (!proxima) break;
      feitas.add(proxima.id);
      estado.campanha.facil.completas.push(proxima.id);
    }
    assert.equal(feitas.size, a.fases.length, `${a.id}: dá para completar o ato inteiro`);
  }
});
