import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as Campanha from '../systems/campanha.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Beta from '../systems/modo-beta.mjs';
import { lerExecutaveis } from '../systems/atos-carregar.mjs';
import { personagemDeTeste, PERSONAGEM } from './apoio.mjs';

// Cada hunt pertence a um ato só: o ato de teste usa 6 hunts "emprestadas" do Ato 2 legado (este processo é só deste arquivo).
const EMPRESTADAS = Campanha.FASES.filter((f) => f.ato === 2 && !f.pular).slice(0, 6).map((f) => f.huntId);
Campanha._liberarHuntsParaTestes(EMPRESTADAS);
const [h1, h2, h3, h4, h5, h6] = EMPRESTADAS;
const BOSS = 'ahau';

const fase = (id, huntId, extra = {}) => ({ id, nome: id.toUpperCase(), huntId, tipo: 'hunt-normal', nivel: { facil: 20, medio: 120, dificil: 620 }, ...extra });
const ato5 = (mod = {}) => ({
  id: 'ato-cinco', nome: 'Ato Cinco', estado: 'publicado', ordem: 5, anterior: 'legado-4', inicio: 'fase-1',
  fases: [fase('fase-1', h1, { ordem: 1 }), fase('fase-2', h2, { ordem: 2 }), fase('fase-3', h3, { ordem: 3 }), fase('fase-4', h4, { ordem: 4 }), fase('fase-5', h5, { ordem: 5 }), fase('fase-6', h6, { ordem: 6, obrigatoria: false })],
  conexoes: [['fase-1', 'fase-2'], ['fase-2', 'fase-3'], ['fase-2', 'fase-4'], ['fase-3', 'fase-5'], ['fase-4', 'fase-5']].map(([de, para]) => ({ de, para })).concat([{ de: 'fase-1', para: 'fase-6' }]),
  bossFinal: { bossId: BOSS, faseAnterior: 'fase-5' },
  ...mod,
});
const registrar = (mod) => Campanha.registrarAto(ato5(mod));
afterEach(() => { Campanha._desregistrarAto(5); Beta.definir(false); });

const novo = (bosses = [4]) => personagemDeTeste({ level: 300, campanha: { facil: { limpezas: {}, completas: [], bosses } } });
const vivos = (e) => [...e.hunt.monstros, ...Object.values(e.hunt.outrosAndares ?? {}).flat()];
function limpar(e) {
  for (let i = 0; i < 12 && e.hunt?.instancia?.status !== 'limpa'; i++) {
    for (const m of vivos(e)) m.hp = 0;
    Cacadas.tique(e, PERSONAGEM, Date.now() + 500 * (i + 1));
  }
}
const jogar = (e, huntId) => {
  const r = Cacadas.entrar(e, { huntId, mode: 'auto', dificuldade: 'facil' });
  assert.equal(r.ok, true, `${huntId}: ${r.erro}`);
  limpar(e);
  assert.equal(e.hunt.instancia.status, 'limpa', huntId);
};
const abertas = (e) => ['fase-1', 'fase-2', 'fase-3', 'fase-4', 'fase-5', 'fase-6'].filter((id) => Campanha.faseLiberada(e, 'facil', ato5().fases.find((f) => f.id === id).huntId));

test('R1. o ato do editor entra na campanha (fases com grafo, boss final, cliente vê o ato 5) e os legados seguem iguais', () => {
  const antes = Campanha.FASES.filter((f) => !f.grafo).length;
  const r = registrar();
  assert.equal(r.ok, true, JSON.stringify(r.problemas));
  assert.equal(r.numero, 5);
  assert.equal(Campanha.ATOS, 4, 'a dificuldade segue o fim do Ato 4 legado');
  assert.equal(Campanha.FASES.filter((f) => !f.grafo).length, antes);
  assert.equal(Campanha.ultimaFaseDoAto(5).huntId, h5);
  assert.equal(Campanha.ehBossDeAto(BOSS), true);
  const cli = Campanha.paraCliente(novo()).dificuldades[0];
  assert.equal(cli.fases.filter((f) => f.ato === 5).length, 6);
  assert.equal(cli.bosses.find((b) => b.ato === 5).bossId, BOSS);
});

test('R2. a porta do ato: sem o boss do ato anterior vencido nada abre; com ele, só a fase inicial', () => {
  registrar();
  assert.deepEqual(abertas(novo([])), []);
  assert.match(Campanha.motivoParaNaoEntrar(novo([]), 'facil', h1), /Derrote o boss do Ato 4/);
  assert.deepEqual(abertas(novo([4])), ['fase-1']);
});

test('R3. progressão pelo grafo de verdade: bifurcação (2→3 e 2→4), ramal opcional, convergência em 5, e o boss só com as obrigatórias', () => {
  registrar();
  const e = novo();
  jogar(e, h1);
  assert.deepEqual(abertas(e), ['fase-1', 'fase-2', 'fase-6'], 'a fase 1 abriu a 2 e o ramal opcional 6');
  jogar(e, h2);
  assert.deepEqual(abertas(e), ['fase-1', 'fase-2', 'fase-3', 'fase-4', 'fase-6']);
  assert.equal(Campanha.bossLiberado(e, 'facil', 5), false);
  jogar(e, h4); // só o caminho B
  assert.ok(Campanha.faseLiberada(e, 'facil', h5), 'convergência: um dos caminhos basta');
  assert.match(Campanha.motivoParaNaoEntrar(novo(), 'facil', h5), /Derrote|Complete/);
  jogar(e, h5);
  assert.equal(Campanha.bossLiberado(e, 'facil', 5), false, 'faltam obrigatórias (fase 3)');
  jogar(e, h3);
  assert.equal(Campanha.bossLiberado(e, 'facil', 5), true, 'a fase 6 é opcional: não conta');
});

test('R4. portal do boss final do ato do editor: só abre limpando a hunt NESTA execução, entra pelo portal, sem recarga, e a vitória não mexe na dificuldade', () => {
  registrar();
  const e = novo();
  for (const h of [h1, h2, h3, h4]) jogar(e, h);
  assert.equal(Cacadas.entrar(e, { huntId: h5, mode: 'auto', dificuldade: 'facil' }).ok, true);
  assert.equal(e.hunt.portalDoBoss, undefined, 'entrar na última fase não abre o portal');
  limpar(e);
  assert.ok(e.hunt.portalDoBoss, 'limpou: portal aberto');
  assert.equal(e.hunt.portalDoBoss.bossId, BOSS);
  const d = Cacadas.entrar(e, { huntId: BOSS, mode: 'auto', dificuldade: 'facil', campanha: true });
  assert.equal(d.ok, false, 'direto no boss é recusado');
  const r = Cacadas.entrarNoPortalDoBoss(e);
  assert.equal(r.ok, true, r.erro);
  assert.equal(e.hunt.campanha.bossDoAto, 5);
  const aviso = Campanha.venceuBoss(e, 'facil', 5);
  assert.match(aviso, /Ato Cinco concluído/);
  assert.equal(Campanha.bossVencido(e, 'facil', 5), true);
  assert.doesNotMatch(aviso, /Campanha concluída/);
  assert.equal(Campanha.dificuldadeLiberada(e, 'dificil'), false, 'vencer um ato do editor não abre dificuldade: isso é só o Ato 4 legado');
  e.hunt = null;
  assert.equal(Cacadas.entrar(e, { huntId: h5, mode: 'auto', dificuldade: 'facil' }).ok, true);
  assert.equal(e.hunt.portalDoBoss, undefined, 'ato já concluído: precisa limpar de novo');
});

test('R5. "Seguir" (Caça Automática) anda pelo grafo: a próxima aberta e ainda não feita', () => {
  registrar();
  const e = novo();
  jogar(e, h1);
  assert.equal(Campanha.proximaParaSeguir(e, 'facil', h1).huntId, h2);
  jogar(e, h2);
  assert.equal(Campanha.proximaParaSeguir(e, 'facil', h2).huntId, h3, 'na bifurcação, o primeiro caminho');
  jogar(e, h3);
  assert.equal(Campanha.proximaParaSeguir(e, 'facil', h3).huntId, h5);
});

test('R6. estado beta só vale com o modo beta ligado; desligado, o ato some do cliente e fecha', () => {
  registrar({ estado: 'beta' });
  assert.equal(Campanha.atoAtivo(5), false);
  assert.equal(Campanha.faseLiberada(novo(), 'facil', h1), false);
  assert.equal(Campanha.paraCliente(novo()).dificuldades[0].fases.some((f) => f.ato === 5), false);
  Beta.definir(true);
  assert.equal(Campanha.faseLiberada(novo(), 'facil', h1), true);
  assert.equal(Campanha.paraCliente(novo()).dificuldades[0].bosses.some((b) => b.ato === 5), true);
});

test('R7. ato inválido NÃO entra (nenhum efeito): hunt de outro ato, boss repetido, ordem de legado, ciclo', () => {
  const n = Campanha.FASES.length;
  const legada = Campanha.FASES.find((f) => !f.grafo).huntId;
  for (const mod of [
    { fases: ato5().fases.map((f) => (f.id === 'fase-2' ? { ...f, huntId: legada } : f)) },
    { bossFinal: { bossId: Campanha.bossDoAto(1).bossId, faseAnterior: 'fase-5' } },
    { ordem: 3 },
    { conexoes: [...ato5().conexoes, { de: 'fase-5', para: 'fase-2' }] },
    { fases: ato5().fases.map((f) => ({ ...f, nivel: null })) },
  ]) {
    const r = registrar(mod);
    assert.equal(r.ok, false);
    assert.equal(Campanha.FASES.length, n);
    assert.equal(Campanha.ATOS_DO_EDITOR.size, 0);
  }
});

test('R8. o carregador do boot lê só beta/publicado e ignora rascunho, desativado e arquivo corrompido', () => {
  const pasta = mkdtempSync(join(tmpdir(), 'atos-boot-'));
  try {
    for (const [nome, estado] of [['a', 'publicado'], ['b', 'beta'], ['c', 'rascunho'], ['d', 'desativado']]) writeFileSync(join(pasta, `${nome}.json`), JSON.stringify({ ...ato5(), id: `ato-${nome}-x`, estado }));
    writeFileSync(join(pasta, 'quebrado.json'), '{ não é json');
    assert.deepEqual(lerExecutaveis(pasta).map((a) => a.estado).sort(), ['beta', 'publicado']);
  } finally {
    rmSync(pasta, { recursive: true, force: true });
  }
});
