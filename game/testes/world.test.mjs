// Etapa 5: a tela WORLD — o conteúdo que o servidor manda (sem revelar segredos), os requisitos de entrada
// (progresso, não level), o registro de bosses derrotados, os encontros visíveis na caçada e as contas do desenho.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import * as Campanha from '../systems/campanha.mjs';
import * as Conteudo from '../systems/campanha-conteudo.mjs';
import * as Entrega from '../systems/encontros/entrega.mjs';
import * as Estado from '../systems/encontros/estado.mjs';
import * as Modelo from '../systems/encontros/modelo.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Arquivos from '../systems/encontros/arquivos.mjs';
import * as Instancia from '../systems/hunt/instancia.mjs';
import { layoutDoAto, colunasPara, estadoDoNo, RAIO_DA_FASE, RAIO_DO_BOSS } from '../frontend/client/src/world.mjs';
import { encontroNaCasa, encontroPerto, assinaturaDosEncontros, ALCANCE_DE_INTERACAO } from '../frontend/client/src/encontros-na-tela.mjs';
import { personagemDeTeste, HUNT_DE_TESTE } from './apoio.mjs';
import { aAdaptar } from './apoio-migracao.mjs';

const [F1, F2, F3] = Campanha.FASES;
let restaurar = () => {};
after(() => restaurar());
const comConteudo = (dados) => {
  restaurar();
  restaurar = Conteudo._definirParaTestes(dados);
};
const CONTEUDO = {
  [F1.huntId]: {
    descricao: 'Uma caverna escura.', ambiente: 'caverna', conexoes: [F3.huntId], requisitos: { levelMin: 500 },
    mundo: {
      bossPrincipal: { bossId: 'guardiao', nome: 'Guardião da Fortaleza' },
      obrigatorios: [{ id: 'chefe', nome: 'Guardião da Fortaleza', tipo: 'boss' }],
      todos: [
        { id: 'chefe', nome: 'Guardião da Fortaleza', tipo: 'boss', bossId: 'guardiao', bossNome: 'Guardião da Fortaleza' },
        { id: 'cofre-secreto', nome: 'Cofre Esquecido', tipo: 'bau-raro' },
        { id: 'sombra', nome: 'A Sombra', tipo: 'boss-secreto', bossId: 'sombra', bossNome: 'A Sombra' },
      ],
    },
  },
  [F3.huntId]: { requisitos: { exige: [F1.huntId] } },
};

test('o WORLD recebe descrição, ambiente, conexões, boss principal e a condição de conclusão — e NENHUM segredo', { skip: aAdaptar("O WORLD (descrição, requisito, payload) é da engine; o teste usa a campanha do Draevor") }, () => {
  comConteudo(CONTEUDO);
  const e = personagemDeTeste({ level: 50 });
  const m = Campanha.paraCliente(e).mundo[F1.huntId];
  assert.equal(m.descricao, 'Uma caverna escura.');
  assert.equal(m.ambiente, 'caverna');
  assert.deepEqual(m.conexoes, [F3.huntId]);
  assert.equal(m.levelRecomendado, 500);
  assert.equal(m.bossPrincipal, 'Guardião da Fortaleza');
  assert.deepEqual(m.obrigatorios, [{ nome: 'Guardião da Fortaleza', tipo: 'boss' }]);
  assert.equal(m.descobertos, undefined, 'nada encontrado ainda');
  const texto = JSON.stringify(Campanha.paraCliente(e));
  assert.ok(!texto.includes('Cofre Esquecido') && !texto.includes('A Sombra') && !texto.includes('cofre-secreto'), 'o baú e o boss secretos não vão para a tela');
  assert.equal(Campanha.paraCliente(e).mundo[F2.huntId], undefined, 'fase sem conteúdo nem entra no payload');
});

test('o que o jogador ENCONTROU aparece (só isso): o registro de concluídos revela o nome, e os bosses derrotados são listados', () => {
  comConteudo(CONTEUDO);
  const e = personagemDeTeste({ level: 50 });
  Entrega.registrarConclusao(e, F1.huntId, 'cofre-secreto');
  Entrega.registrarConclusao(e, F1.huntId, 'cofre-secreto');
  Entrega.registrarConclusao(e, 'boss', 'sombra');
  const p = Campanha.paraCliente(e);
  assert.deepEqual(p.mundo[F1.huntId].descobertos, [{ nome: 'Cofre Esquecido', tipo: 'bau-raro', vezes: 2 }]);
  assert.deepEqual(p.bossesDerrotados, [{ id: 'sombra', nome: 'A Sombra', vezes: 1 }]);
  assert.ok(!JSON.stringify(p).includes('Guardião da Fortaleza') || p.mundo[F1.huntId].bossPrincipal, 'o principal é público');
  // Nome desconhecido não quebra: cai no id.
  Entrega.registrarConclusao(e, 'boss', 'sem-indice');
  assert.equal(Campanha.paraCliente(e).bossesDerrotados.find((b) => b.id === 'sem-indice').nome, 'sem-indice');
});

test('requisito de entrada = PROGRESSO (exige completar fases), e o level é só RECOMENDADO: nível baixo entra, falta de fase não', { skip: aAdaptar("O WORLD (descrição, requisito, payload) é da engine; o teste usa a campanha do Draevor") }, () => {
  comConteudo(CONTEUDO);
  const e = personagemDeTeste({ level: 8 });
  assert.equal(Campanha.faseLiberada(e, 'facil', F1.huntId), true, 'level 8 < recomendado 500: entra mesmo assim (regra do dono)');
  // F3 exige F1 além da cadeia do ato: sem a cadeia nem chega aqui; com a cadeia completa mas sem F1... F1 já faz parte dela,
  // então o teste usa uma exigência fora da cadeia (fase de outro ato).
  const comIndice = Campanha.FASES.map((f, indice) => ({ ...f, indice }));
  const outroAto = comIndice.find((f) => f.ato === 2 && !f.pular);
  const alvo = comIndice.find((f) => f.ato === 1 && f.indice === 3 && !f.pular) ?? F3;
  comConteudo({ [alvo.huntId]: { requisitos: { exige: [outroAto.huntId] } } });
  const x = personagemDeTeste({ level: 60 });
  x.campanha = { facil: { limpezas: {}, completas: comIndice.filter((f) => f.ato === 1 && f.indice < alvo.indice).map((f) => f.huntId), bosses: [] } };
  assert.equal(Campanha.faseLiberada(x, 'facil', alvo.huntId), false, 'a cadeia do ato está completa, mas falta a exigência de fora');
  assert.match(Campanha.motivoParaNaoEntrar(x, 'facil', alvo.huntId), /Complete antes/);
  x.campanha.facil.completas.push(outroAto.huntId);
  assert.equal(Campanha.faseLiberada(x, 'facil', alvo.huntId), true, 'cumpriu: abre');
  assert.equal(Campanha.motivoParaNaoEntrar(x, 'facil', alvo.huntId), null);
  // E o servidor recusa mesmo mandando o comando na mão.
  const y = personagemDeTeste({ level: 60 });
  y.campanha = { facil: { limpezas: {}, completas: x.campanha.facil.completas.filter((id) => id !== outroAto.huntId), bosses: [] } };
  assert.equal(Cacadas.entrar(y, { huntId: alvo.huntId, mode: 'auto', strategy: 'nearest', dificuldade: 'facil' }).ok, false);
});

test('sem conteúdo cadastrado (produção hoje), o payload da campanha é o de sempre, com `mundo` vazio', { skip: aAdaptar("O WORLD (descrição, requisito, payload) é da engine; o teste usa a campanha do Draevor") }, () => {
  comConteudo({});
  const e = personagemDeTeste({ level: 50 });
  const p = Campanha.paraCliente(e);
  assert.deepEqual(p.mundo, {});
  assert.deepEqual(p.bossesDerrotados, []);
  assert.equal(p.dificuldades.length, 3);
  assert.equal(p.dificuldades[0].fases.length, 48);
});

test('encontros visíveis na caçada: baú/altar com posição, disponível ou em andamento — nunca boss, dormindo, concluído ou sem posição', () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 60 });
  assert.equal(Cacadas.entrar(e, { huntId: HUNT_DE_TESTE, mode: 'online', strategy: 'nearest', dificuldade: 'facil' }).ok, true);
  const defs = [
    { id: 'bau', tipo: 'bau-comum', nome: 'Baú', x: 10, y: 11, recompensa: { drops: [{ id: 3031, chance: 100 }] } },
    { id: 'altar', tipo: 'altar', nome: 'Altar', x: 12, y: 13, efeitos: [{ afixo: 'phys_dmg', valor: 5 }], duracaoMs: 1000 },
    { id: 'sem-pos', tipo: 'bau-comum', nome: 'Sem posição', recompensa: { drops: [{ id: 3031, chance: 100 }] } },
    { id: 'dorme', tipo: 'bau-comum', nome: 'Dorme', x: 1, y: 1, condicao: { tipo: 'monstros-limpos' }, recompensa: { drops: [{ id: 3031, chance: 100 }] } },
  ];
  Estado.criar(e.hunt.instancia, defs.map((d) => Modelo.normalizar(d)), { semente: 1 });
  const ids = () => (Instancia.paraCliente(e.hunt).encontros ?? []).map((x) => x.id).sort();
  assert.deepEqual(ids(), ['altar', 'bau']);
  const item = Instancia.paraCliente(e.hunt).encontros.find((x) => x.id === 'bau');
  assert.deepEqual(item, { id: 'bau', tipo: 'bau-comum', nome: 'Baú', x: 10, y: 11, estado: 'disponivel' });
  assert.ok(!JSON.stringify(Instancia.paraCliente(e.hunt)).includes('recompensa'), 'a tabela de recompensa não vai para a tela');
  Estado.ativar(e.hunt.instancia, 'bau', { hunt: e.hunt, estado: e, personagem: { nome: 'x' } });
  assert.deepEqual(ids(), ['altar'], 'concluído sai');
});

test('o desenho do mapa: serpentina sem sobreposição, dentro dos limites, boss embaixo; colunas por largura; estado de cada nó', () => {
  for (const colunas of [3, 4, 5, 6]) {
    const L = layoutDoAto(12, colunas);
    const todos = [...L.pontos, L.boss];
    for (const p of todos) assert.ok(p.x >= RAIO_DO_BOSS && p.y >= RAIO_DO_BOSS && p.x <= L.largura - RAIO_DO_BOSS && p.y <= L.altura - RAIO_DO_BOSS, `${colunas} col: dentro da caixa`);
    for (let i = 0; i < todos.length; i++) for (let j = i + 1; j < todos.length; j++) {
      assert.ok(Math.hypot(todos[i].x - todos[j].x, todos[i].y - todos[j].y) >= 2 * RAIO_DA_FASE + 4, `${colunas} col: nós ${i} e ${j} não se tocam`);
    }
    // Caminho contínuo: cada fase está encostada (vizinha) na anterior.
    for (let i = 1; i < 12; i++) assert.ok(Math.hypot(L.pontos[i].x - L.pontos[i - 1].x, L.pontos[i].y - L.pontos[i - 1].y) <= 78 + 0.01, `${colunas} col: caminho contínuo`);
    assert.ok(L.boss.y > L.pontos.at(-1).y && L.boss.x === L.pontos.at(-1).x, 'o boss continua o caminho, embaixo da última fase');
  }
  assert.deepEqual([colunasPara(100), colunasPara(320), colunasPara(360), colunasPara(412), colunasPara(1200)], [3, 4, 5, 5, 6], 'mais largura, mais colunas (3 a 6)');
  assert.equal(estadoDoNo({ pular: true }), 'travada');
  assert.equal(estadoDoNo({ completa: true, liberada: true }), 'completa');
  assert.equal(estadoDoNo({ liberada: true }), 'aberta');
  assert.equal(estadoDoNo({ liberado: true }), 'aberta');
  assert.equal(estadoDoNo({ vencido: true }), 'completa');
  assert.equal(estadoDoNo({}), 'fechada');
});

test('na tela da caçada: o encontro na casa, o mais perto ao alcance e a assinatura do mapa', () => {
  const lista = [{ id: 'a', tipo: 'bau-comum', x: 5, y: 5, estado: 'disponivel' }, { id: 'b', tipo: 'altar', x: 8, y: 5, estado: 'ativo' }, { id: 'c', tipo: 'bau-raro', x: 6, y: 6, z: 9, estado: 'disponivel' }];
  assert.equal(encontroNaCasa(lista, 5, 5, 7).id, 'a');
  assert.equal(encontroNaCasa(lista, 6, 6, 7), null, 'outro andar');
  assert.equal(encontroNaCasa(lista, 6, 6, 9).id, 'c');
  assert.equal(encontroPerto(lista, { x: 6, y: 5 }, 7).id, 'a');
  assert.equal(encontroPerto(lista, { x: 5 + ALCANCE_DE_INTERACAO + 1, y: 5 }, 7), null, 'longe: sem botão');
  assert.equal(encontroPerto(lista, { x: 8, y: 5 }, 7), null, 'em andamento não é para abrir de novo');
  assert.notEqual(assinaturaDosEncontros(lista), assinaturaDosEncontros([{ ...lista[0], estado: 'ativo' }, ...lista.slice(1)]), 'mudar de estado muda a assinatura (o mapa redesenha)');
  assert.equal(assinaturaDosEncontros(undefined), '');
});

test('WORLD etapa 5: o servidor anuncia só o opcional FIXO e não secreto (boss/miniboss/evento); aleatório, baú e segredo ficam por descobrir', () => {
  const [F1] = Campanha.FASES;
  const todos = [
    { id: 'm-fixo', nome: 'Capitão Orc', tipo: 'miniboss', obrigatorio: false, probabilidade: 100, bossNome: 'Capitão Orc', categoria: 'miniboss' },
    { id: 'm-sorte', nome: 'Raro', tipo: 'miniboss', obrigatorio: false, probabilidade: 20, bossNome: 'Raro', categoria: 'miniboss' },
    { id: 'secreto', nome: 'Rei Oculto', tipo: 'boss-secreto', obrigatorio: false, probabilidade: 100 },
    { id: 'bau', nome: 'Baú', tipo: 'bau-comum', obrigatorio: false, probabilidade: 100 },
    { id: 'obr', nome: 'Chefe', tipo: 'boss', obrigatorio: true, probabilidade: 100, bossNome: 'Chefe', categoria: 'principal' },
    { id: 'fenda', nome: 'Fenda', tipo: 'fenda', obrigatorio: false, probabilidade: 100 },
  ];
  const restaurar = Conteudo._definirParaTestes({ [F1.huntId]: { mundo: { bossPrincipal: null, obrigatorios: [], todos } } });
  try {
    const est = personagemDeTeste({ vocacao: 'knight', level: 50 });
    const m = Campanha.paraCliente(est).mundo[F1.huntId];
    assert.deepEqual(m.conhecidos.map((c) => c.nome).sort(), ['Capitão Orc', 'Fenda']);
    assert.ok(!JSON.stringify(m).includes('Rei Oculto'), 'o segredo não vai para a tela antes de ser encontrado');
    assert.ok(!JSON.stringify(m).includes('Raro'), 'o aleatório também não');
    // depois de encontrar o segredo, ele aparece em "descobertos" (como antes)
    est.encontros = { concluidos: { [F1.huntId]: { secreto: 1 } } };
    assert.ok(Campanha.paraCliente(est).mundo[F1.huntId].descobertos.some((d) => d.nome === 'Rei Oculto'));
  } finally {
    restaurar();
  }
});
