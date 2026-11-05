// O REGISTRO DE MISSÕES do PoE (dono, 05/11: "verifique se todas essas missões e assets de itens de missões estão implementadas, se não
// implemente" — https://poedb.tw/pt/Quest; a aba Missões no lugar da aba Tasks; Atlas e liga entram, o que não tem caminho fica marcado).
// A conclusão vem do progresso da campanha; os Livros de Habilidade somam pontos de passiva; os Bandidos são uma escolha; as recompensas
// de item são escolhidas na aba; os itens de missão (244 do poedb) entram no catálogo com o ícone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = !existsSync(Catalogo.ARQUIVO) && 'o catálogo do PoE não está nesta máquina';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const M = await import('../systems/itens-poe/missoes.mjs');
const Passivas = await import('../systems/passivas/arvore.mjs');
const Inventario = await import('../systems/inventario.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');
if (!SEM) Jogo.iniciar(ITEM_CATALOG);

const personagem = (completas = [], bosses = []) => Object.assign(personagemDeTeste({ vocacao: 'knight', level: 20 }), { classePoe: 'Marauder', campanha: { facil: { completas, bosses } } });
const injetar = {
  criarPeca: (base) => Jogo.pecaNormalDaBase(base, 20),
  darItem: Inventario.darItem,
  darPeca: Inventario.darPeca,
  darGema: (estado, id) => (estado.inventory ??= []).push({ id, count: 1 }),
};
const BANDIDOS = ['poe-a2-the-broken-bridge', 'poe-a2-the-western-forest', 'poe-a2-the-wetlands'];

test('as 179 missões do poedb: toda a campanha tem um gatilho numa fase ou num chefe que existe; o resto tem o motivo do "sem caminho"', { skip: SEM }, () => {
  assert.equal(M.MISSOES.length, 179);
  const fases = new Set();
  for (let i = 1; i <= 10; i++) for (const f of JSON.parse(readFileSync(new URL(`../gamedata/atos/poe-ato-${i}.json`, import.meta.url), 'utf8')).fases) fases.add(f.id);
  for (const m of M.MISSOES) {
    if (m.semCaminho) {
      assert.ok(m.semCaminho.length > 10, `${m.slug}: o motivo`);
      continue;
    }
    const g = m.gatilho;
    assert.ok(g, m.slug);
    if (g.fase) assert.ok(fases.has(g.fase), `${m.slug}: ${g.fase}`);
    if (g.fases) for (const f of g.fases) assert.ok(fases.has(f), `${m.slug}: ${f}`);
    if (g.chefeDoAto) assert.ok(g.chefeDoAto >= 1 && g.chefeDoAto <= 10, m.slug);
    assert.ok(m.comoConclui, `${m.slug}: o texto do gatilho`);
  }
  const campanha = M.MISSOES.filter((m) => m.categoria === 'campanha');
  assert.equal(campanha.length, 78);
  assert.ok(campanha.every((m) => !m.semCaminho), 'toda missão da campanha tem caminho');
  assert.equal(M.missao('The_Sirens_Cadence').gatilho.chefeDoAto, 1);
  assert.equal(M.missao('Mercy_Mission').gatilho.fase, 'poe-a1-the-tidal-island');
});

test('os 244 itens de missão no catálogo, com o ícone; os 16 que já caíam dos monstros ficam com o mesmo id e ganham o ícone', { skip: SEM }, () => {
  assert.equal(M.ITENS.length, 244);
  for (const it of M.ITENS) {
    const meta = ITEM_CATALOG[it.itemId];
    assert.equal(meta?.type, 'quest items', it.tipo);
    assert.ok(meta.poe?.icone && existsSync(`${Catalogo.PASTA_DAS_IMAGENS}/${meta.poe.icone}`), `${it.tipo}: o ícone`);
  }
  assert.equal(ITEM_CATALOG[7600001].name, 'Baú de Remédios');
  assert.equal(ITEM_CATALOG[7600001].missaoPoe.slug, 'Medicine_Chest');
  assert.ok(ITEM_CATALOG[7600001].missao, 'o item antigo continua com a missão da fase (o drop)');
  const ids = JSON.parse(readFileSync(new URL('../gamedata/itens-poe/missoes-itens-ids.json', import.meta.url), 'utf8')).ids;
  assert.equal(new Set(Object.values(ids)).size, Object.keys(ids).length, 'ids sem repetição');
});

test('os Livros de Habilidade: a missão concluída soma pontos de passiva (personagem novo: nenhum)', { skip: SEM }, () => {
  const novo = personagem();
  assert.equal(M.pontos(novo), 0);
  const base = Passivas.pontos(novo).total;
  const e = personagem(['poe-a1-the-flooded-depths', 'poe-a2-the-western-forest']);
  assert.equal(M.pontos(e), 2, 'Habitante das Profundezas + O Caminho Adiante');
  assert.equal(Passivas.pontos(e).total, base + 2);
  assert.ok(M.concluida(e, M.missao('The_Dweller_of_the_Deep')));
  assert.ok(!M.concluida(e, M.missao('The_Marooned_Mariner')));
});

test('os Bandidos: a escolha só depois das três fases, uma vez; ajudar o Oak dá +40 de Vida, matar todos dá o ponto', { skip: SEM }, () => {
  const cedo = personagem(BANDIDOS.slice(0, 2));
  assert.equal(M.comando(cedo, { action: 'bandido', bandido: 'oak' }, injetar).ok, false);
  const e = personagem(BANDIDOS);
  // (a Floresta Ocidental também conclui O Caminho Adiante — 1 ponto — antes de qualquer escolha)
  const semEscolha = M.pontos(e);
  assert.ok(M.bandidoPendente(e));
  assert.equal(M.pendentes(e), 1);
  const r = M.comando(e, { action: 'bandido', bandido: 'oak' }, injetar);
  assert.ok(r.ok, r.erro);
  assert.equal(Passivas.efeitos(e).adds.life, 40);
  assert.equal(M.comando(e, { action: 'bandido', bandido: 'todos' }, injetar).ok, false, 'não volta atrás');
  assert.ok(M.concluida(e, M.missao('The_Bandit_Lord_Oak')));
  assert.ok(!M.concluida(e, M.missao('Deal_with_the_Bandits')));
  assert.equal(M.pontos(e), semEscolha, 'ajudar um bandido não dá ponto');
  const todos = personagem(BANDIDOS);
  M.comando(todos, { action: 'bandido', bandido: 'todos' }, injetar);
  assert.equal(M.pontos(todos), semEscolha + M.missao('Deal_with_the_Bandits').recompensas.pontos);
  assert.ok(!Passivas.efeitos(todos).adds.life);
});

test('a recompensa de item: escolhida uma vez na aba, entra na mochila (Missão de Caridade → um frasco Normal)', { skip: SEM }, () => {
  const e = personagem(['poe-a1-the-tidal-island']);
  const m = M.missao('Mercy_Mission');
  assert.ok(M.escolhaPendente(e, m));
  const antes = (e.inventory ?? []).length;
  const r = M.comando(e, { action: 'escolher', missao: 'Mercy_Mission', opcao: 0 }, injetar);
  assert.ok(r.ok, r.erro);
  assert.equal(e.inventory.length, antes + 1);
  assert.equal(e.inventory.at(-1).poe?.base, m.recompensas.escolha[0].base);
  assert.equal(M.comando(e, { action: 'escolher', missao: 'Mercy_Mission', opcao: 1 }, injetar).ok, false, 'uma vez');
  assert.equal(M.comando(personagem(), { action: 'escolher', missao: 'Mercy_Mission', opcao: 0 }, injetar).ok, false, 'só concluída');
  assert.equal(M.ficha(e).missoes.Mercy_Mission.escolhida, 0);
});

test('o Atlas: o primeiro mapa conclui O Atlas dos Mundos; o pináculo vencido conclui a missão dele', { skip: SEM }, () => {
  const e = personagem();
  assert.ok(!M.concluida(e, M.missao('The_Atlas_of_Worlds')));
  e.mapas = { concluidos: 1 };
  assert.ok(M.concluida(e, M.missao('The_Atlas_of_Worlds')));
  M.aoVencerPinaculo(e, 'poe-the-elder');
  assert.ok(M.concluida(e, M.missao('The_Elder')));
  assert.ok(!M.concluida(e, M.missao('The_Maven')));
});

test('a tela: no jogo do PoE a janela Tarefas abre as Missões no lugar das Tasks (o arquivo estático e a aba)', () => {
  const painel = readFileSync(new URL('../frontend/client/src/panels.mjs', import.meta.url), 'utf8');
  assert.match(painel, /missoes: 'Missões', mounts: 'Tasks de Montarias'/);
  assert.match(painel, /renderMissoes\(body, ctx\)/);
  const aba = readFileSync(new URL('../frontend/client/src/aba-missoes.mjs', import.meta.url), 'utf8');
  assert.match(aba, /\/gamedata\/itens-poe\/missoes\.json/);
  assert.ok(existsSync(new URL('../gamedata/itens-poe/missoes.json', import.meta.url)));
});
