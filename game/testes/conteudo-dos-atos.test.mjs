// O PACOTE de conteúdo dos 4 Atos (gamedata/encontros/*.json, bosses-unicos.json, campanha-conteudo.json): ele passa por TODAS
// as regras do jogo e do editor, e o jogo o enxerga como está nos arquivos. Gerado por `tools/gerar-conteudo-dos-atos.mjs`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import * as Conteudo from '../admin/conteudo.mjs';
import * as Campanha from '../systems/campanha.mjs';
import * as Catalogo from '../systems/bosses-unicos/catalogo.mjs';
import * as Modelo from '../systems/encontros/modelo.mjs';
import * as Estado from '../systems/encontros/estado.mjs';
import { conteudoDaFase } from '../systems/campanha-conteudo.mjs';
import { encontrosDaHunt } from '../systems/hunt/terreno.mjs';
import { CONFIG } from '../systems/encontros/config.mjs';
import { PASTA } from '../systems/encontros/arquivos.mjs';

const jogaveis = Campanha.FASES.filter((f) => !f.pular);

test('o cadastro de bosses do pacote é válido: 15 minibosses e 4 secretos, todos usados por um encontro', () => {
  assert.deepEqual(Catalogo.ERROS_DO_ARQUIVO, []);
  const bosses = Catalogo.todos();
  assert.equal(bosses.filter((b) => b.categoria === 'miniboss').length, 15);
  assert.equal(bosses.filter((b) => b.categoria === 'secreto').length, 4);
  for (const b of bosses) {
    assert.deepEqual(Catalogo.validar(b), [], b.id);
    assert.ok(b.lore && b.descricao && b.melee !== undefined, `${b.id}: lore, descrição e melee definidos`);
    assert.ok(b.fases.length >= 1, `${b.id}: tem fase de combate`);
  }
  const usos = Conteudo.usosDosBosses();
  for (const b of bosses) assert.ok(usos[b.id]?.length === 1, `${b.id}: usado por exatamente um encontro`);
});

test('as 47 fases jogáveis têm descrição, ambiente e encontros; a travada (Dark Thais) segue sem nada', () => {
  assert.equal(jogaveis.length, 47);
  for (const f of jogaveis) {
    const c = conteudoDaFase(f.huntId);
    assert.ok(c.descricao?.length > 40 && c.ambiente, `${f.huntId}: descrição e ambiente`);
    assert.ok(encontrosDaHunt(f.huntId).length >= 1, `${f.huntId}: encontros`);
    assert.ok(c.mundo?.todos?.length >= 1, `${f.huntId}: índice do WORLD`);
  }
  const travada = Campanha.FASES.find((f) => f.pular);
  assert.equal(conteudoDaFase(travada.huntId).descricao, undefined);
});

test('todo o conteúdo passa na validação do editor (pontos andáveis e alcançáveis, economia) — sem erros; a economia fica abaixo do alvo', () => {
  const a = Conteudo.auditar();
  assert.equal(a.totais.erros, 0, JSON.stringify(a.problemas.filter((p) => p.nivel === 'erro')));
  assert.equal(a.totais.comEncontros, 47);
  assert.equal(a.totais.comBoss, 19);
  assert.equal(a.problemas.some((p) => /índice da tela WORLD/.test(p.mensagem)), false, 'o índice do WORLD está em dia');
  for (const f of a.fases) {
    if (!f.resumo.total) continue;
    const v = Conteudo.validarFase(f.huntId, Conteudo.carregarFase(f.huntId).encontros);
    assert.deepEqual(v.erros, [], f.huntId);
    assert.ok(v.economia.fracao <= 0.25, `${f.huntId}: encontros = ${(v.economia.fracao * 100).toFixed(1)}% do valor da fase`);
  }
});

test('o jogo enxerga o pacote como está nos arquivos: cada fase cria a instância com os encontros sorteados pela semente (e nenhum é obrigatório: a campanha anda como antes)', () => {
  for (const f of jogaveis) {
    const defs = encontrosDaHunt(f.huntId);
    assert.deepEqual(Modelo.validar(defs), [], f.huntId);
    assert.equal(defs.filter((d) => d.obrigatorio).length, 0, `${f.huntId}: nada obrigatório — o ritmo da campanha não muda`);
    const inst = Estado.criar({}, defs, { semente: 12345 });
    const existentes = Object.keys(inst.encontros).length;
    assert.ok(existentes >= 1 && existentes <= defs.length * 1, `${f.huntId}: ${existentes} encontros nesta instância`);
    assert.equal(Estado.obrigatoriosPendentes(inst), 0);
  }
});

test('o pacote cabe nos limites: probabilidades de minibosses (20%) e segredos (5%), segredo só depois de um baú raro, e nada de arquivo órfão', () => {
  const arquivos = readdirSync(PASTA).filter((n) => n.endsWith('.json')).map((n) => n.slice(0, -5));
  for (const id of arquivos) assert.ok(Campanha.faseDe(id) && !Campanha.faseDe(id).pular, `${id}: arquivo de encontros de uma fase que não existe/está travada`);
  assert.equal(arquivos.length, 47);
  for (const id of arquivos) {
    const lista = JSON.parse(readFileSync(new URL(`../gamedata/encontros/${id}.json`, import.meta.url), 'utf8')).encontros;
    for (const e of lista) {
      if (e.tipo === 'miniboss') assert.equal(e.probabilidade, 20, `${id}/${e.id}`);
      if (e.tipo === 'boss-secreto') {
        assert.equal(e.probabilidade, 5, `${id}/${e.id}`);
        assert.equal(e.condicao.tipo, 'apos-encontro');
        assert.equal(lista.find((x) => x.id === e.condicao.encontro)?.tipo, 'bau-raro', 'o segredo se revela ao abrir o baú raro');
      }
      if (e.recompensa) assert.ok((e.recompensa.rolagens ?? 1) <= CONFIG.limites.rolagensMax);
    }
  }
});
