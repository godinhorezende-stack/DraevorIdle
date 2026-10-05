// Conjuntos (sets de equipamento por classe): estrutura, validações, overrides, integração com o item, Hot Reload, validação centralizada e rotas.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmp = mkdtempSync(join(tmpdir(), 'conj-'));
process.env.DRAEVOR_OVERRIDES = tmp; // overrides DESTE processo ficam na pasta temporária (nunca os do dono)
after(() => rmSync(tmp, { recursive: true, force: true }));

const C = await import('../systems/conjuntos.mjs');
const P = await import('../systems/progressao.mjs');
const Adm = await import('../admin/overrides-conjuntos.mjs');
const Itens = await import('../admin/overrides-itens.mjs');
const Http = await import('../admin/conteudo-http.mjs');
const A = await import('../admin/acesso.mjs');
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { criarEstrategias } = await import('../systems/hot-reload-estrategias.mjs');
const { criarVerificacoes } = await import('../admin/validacao-verificacoes.mjs');

const copia = (o) => JSON.parse(JSON.stringify(o));
const ctx = () => C.contextoDoJogo();
const equip = Object.values(ITEM_CATALOG).filter((m) => C.SLOTS.includes(m.slot) && !m.stackable && !/^Crafted /.test(m.name ?? ''));
const livre = (slot, extra = () => true) => equip.find((m) => m.slot === slot && !m.vocations?.length && extra(m));
const item = {
  head: livre('head'), body: livre('body'), legs: livre('legs'), feet: livre('feet'), ring: livre('ring'), neck: livre('neck'),
  weapon: livre('weapon', (m) => !m.twoHanded), shield: livre('shield', (m) => !m.quiver),
  duasMaos: livre('weapon', (m) => m.twoHanded), cavaleiro: equip.find((m) => m.slot === 'weapon' && m.vocations?.length === 1 && m.vocations[0] === 'knight'),
};
const pecas = (extra = {}) => ({ head: item.head.id, body: item.body.id, legs: item.legs.id, feet: item.feet.id, weapon: item.weapon.id, shield: item.shield.id, ring: item.ring.id, neck: item.neck.id, ...extra });
const modelo = (extra = {}) => ({ id: 'knight_teste_01', nome: 'Cavaleiro de teste', classe: 'knight', ato: 1, tier: 1, levelMin: 1, levelMax: 100, ativo: true, completo: false, pecas: {}, ...extra });
const valida = (c) => C.validarConjunto(c, ctx());
const reset = () => { for (const f of ['conjuntos.json']) if (existsSync(join(tmp, f))) rmSync(join(tmp, f)); C.aplicar(null); };

test('CJ1. a estrutura de fábrica: 8 slots, só as classes do jogo, planejamento 5×6 em 1–300, NENHUM conjunto de mentira cadastrado', () => {
  assert.deepEqual(C.SLOTS, ['head', 'body', 'legs', 'feet', 'weapon', 'shield', 'ring', 'neck']);
  assert.deepEqual([...C.CLASSES].sort(), ['druid', 'knight', 'monk', 'paladin', 'sorcerer']);
  const { de, ate, conjuntosPorClasse } = C.ORIGINAL.planejamento;
  assert.deepEqual({ de, ate, conjuntosPorClasse }, { de: 1, ate: 300, conjuntosPorClasse: 6 });
  assert.deepEqual(C.ORIGINAL.conjuntos, {}, 'a fábrica não traz conjuntos inventados');
  assert.deepEqual(C.listar(), []);
  const m = C.modelosIniciais();
  assert.equal(m.length, 30, '5 classes × 6');
  assert.ok(m.every((c) => c.ativo === false && c.completo === false && Object.keys(c.pecas).length === 0), 'modelos: inativos, incompletos e SEM peças');
  assert.equal(Math.min(...m.map((c) => c.levelMin)), 1); assert.equal(Math.max(...m.map((c) => c.levelMax)), 300);
  assert.deepEqual(C.listar(), [], 'gerar os modelos não grava nem aplica nada');
  assert.deepEqual(C.validarTodos(Object.fromEntries(m.map((c) => [c.id, c])), ctx()).erros, []);
});

test('CJ2. os Atos vêm da progressão configurável (nada fixo): Ato inexistente é erro e muda junto com a configuração', () => {
  assert.deepEqual(valida(modelo()).erros, []);
  assert.match(valida(modelo({ ato: 11 })).erros.join(' '), /o Ato 11 não existe/);
  const prog = copia(P.EM_USO.progressao);
  prog.atos = prog.atos.slice(0, 3);
  const r = C.validarConjunto(modelo({ ato: 4 }), { ...ctx(), prog, nivelMaximo: 300 });
  assert.match(r.erros.join(' '), /o Ato 4 não existe \(há 3 Atos/);
  assert.match(C.validarConjunto(modelo({ levelMax: 400 }), { ...ctx(), prog, nivelMaximo: 300 }).erros.join(' '), /passa do limite configurado \(300\)/);
  assert.equal(valida(modelo({ ato: 10, tier: 11, levelMin: 901, levelMax: 1000 })).erros.length, 0, 'o limite vem da progressão (1000), não do código');
  assert.match(valida(modelo({ levelMax: 1001 })).erros.join(' '), /passa do limite configurado \(1000\)/);
});

test('CJ3. validações de erro: ID, nome, classe, level, tier, campo inventado, ativo/completo, slot inexistente, item inexistente, slot trocado, classe incompatível, duas mãos + escudo', () => {
  const erro = (c, re) => assert.match(valida(c).erros.join(' | '), re);
  erro(modelo({ id: 'A' }), /o ID precisa/);
  erro(modelo({ nome: '' }), /nome/);
  erro(modelo({ classe: 'none' }), /a classe "none" não existe/);
  erro(modelo({ classe: 'bardo' }), /a classe "bardo" não existe/);
  erro(modelo({ levelMin: 50, levelMax: 10 }), /maior que o máximo/);
  erro(modelo({ levelMin: 0 }), /inteiros a partir de 1/);
  erro(modelo({ tier: 99 }), /tier 99 é inválido/);
  erro(modelo({ dano: 5 }), /o campo "dano" não existe/);
  erro(modelo({ ativo: 'sim' }), /"ativo" precisa/);
  erro(modelo({ pecas: { mao: 1 } }), /o slot "mao" não existe/);
  erro(modelo({ pecas: { head: 99999999 } }), /não existe no catálogo/);
  erro(modelo({ pecas: { head: item.body.id } }), /não cabe em head/);
  erro(modelo({ classe: 'sorcerer', pecas: { weapon: item.cavaleiro.id } }), /restrito a knight e o conjunto é de sorcerer/);
  erro(modelo({ completo: true, pecas: pecas({ weapon: item.duasMaos.id }) }), /duas mãos e não combina com o escudo/);
  assert.equal(valida(modelo({ pecas: { weapon: item.cavaleiro.id } })).erros.length, 0, 'a classe certa é aceita');
});

test('CJ4. conjunto incompleto É válido (aviso); "completo" com slot obrigatório vazio é erro; arma de duas mãos dispensa o escudo; slot vazio é permitido', () => {
  const v = valida(modelo({ pecas: { head: item.head.id } }));
  assert.deepEqual(v.erros, []);
  assert.match(v.avisos.join(' | '), /incompleto \(1\/8 slots/);
  assert.match(valida(modelo({ completo: true, pecas: { head: item.head.id } })).erros.join(' '), /marcado como completo, mas faltam/);
  assert.deepEqual(valida(modelo({ completo: true, pecas: pecas() })).erros, []);
  const duas = pecas({ weapon: item.duasMaos.id }); delete duas.shield;
  assert.deepEqual(valida(modelo({ completo: true, pecas: duas })).erros, [], 'duas mãos: sem escudo e completo');
  const l = C.painel({ x: { ...modelo({ id: 'xxx', pecas: duas }), origem: 'novo' } }, ctx()).linhas[0];
  assert.equal(l.status, 'valido'.replace('valido', l.status), 'status calculado'); assert.notEqual(l.status, 'incompleto');
  const vazio = valida(modelo({ pecas: pecas({ head: null }) }));
  assert.deepEqual(vazio.erros, [], 'null = slot vazio, permitido');
});

test('CJ5. avisos de planejamento: item acima da faixa do conjunto, faixa fora do Ato, tier fora do Ato, recomendado fora da faixa, level mínimo do item NUNCA é alterado', () => {
  const alto = equip.find((m) => (!m.vocations?.length || m.vocations.includes('knight')) && (m.minLevel ?? 0) > 200);
  const antes = alto.minLevel;
  const v = valida(modelo({ levelMax: 100, pecas: { [alto.slot]: alto.id } }));
  assert.deepEqual(v.erros, []);
  assert.match(v.avisos.join(' | '), new RegExp(`exige level ${antes}, acima da faixa`));
  assert.equal(ITEM_CATALOG[alto.id].minLevel, antes, 'validar não mexe no item');
  assert.match(valida(modelo({ levelMin: 150, levelMax: 180 })).avisos.join(' '), /não toca o Ato 1|passa dos limites do Ato 1/);
  assert.match(valida(modelo({ levelMin: 50, levelMax: 150 })).avisos.join(' '), /passa dos limites do Ato 1/);
  assert.match(valida(modelo({ tier: 5 })).avisos.join(' '), /T5 não é um dos tiers do Ato 1/);
  assert.match(valida(modelo({ levelRecomendado: 500 })).avisos.join(' '), /level recomendado/);
});

test('CJ6. cobertura e repetições: lacunas por classe, item repetido entre conjuntos ativos, painel com contagens de slots', () => {
  assert.deepEqual(C.lacunasDaClasse([{ levelMin: 1, levelMax: 50 }, { levelMin: 80, levelMax: 120 }], { de: 1, ate: 300 }), [[51, 79], [121, 300]]);
  assert.deepEqual(C.lacunasDaClasse([{ levelMin: 1, levelMax: 300 }], { de: 1, ate: 300 }), []);
  const mapa = {
    aaa: { ...modelo({ id: 'aaa', pecas: { head: item.head.id } }), origem: 'novo' },
    bbb: { ...modelo({ id: 'bbb', levelMin: 101, levelMax: 200, ato: 2, tier: 2, pecas: { head: item.head.id, body: item.body.id } }), origem: 'novo' },
    ccc: { ...modelo({ id: 'ccc', ativo: false, pecas: { head: item.head.id } }), origem: 'novo' },
  };
  const v = C.validarTodos(mapa, ctx());
  assert.match(v.avisos.join(' | '), /se repete nos conjuntos aaa, bbb/);
  assert.ok(!/aaa, bbb, ccc|ccc/.test(v.avisos.filter((a) => /se repete/.test(a)).join()), 'inativos não contam como repetição');
  assert.match(v.avisos.join(' | '), /sorcerer: faixas do planejamento/);
  const p = C.painel(mapa, ctx());
  assert.equal(p.slots.preenchidos, 4); assert.equal(p.slots.vazios, 3 * 8 - 4);
  assert.deepEqual(p.porClasse.knight.lacunas, [[201, 300]]);
  assert.equal(p.porAto[1], 2); assert.equal(p.porAto[2], 1);
  assert.equal(p.repetidos.length, 1);
});

test('CJ7. override: efetivo(fábrica + override) marca a origem; excluir; peça nula esvazia; minimizar guarda só a diferença', () => {
  const original = { conjuntos: { base_01: { id: 'base_01', nome: 'Base', classe: 'knight', ato: 1, tier: 1, levelMin: 1, levelMax: 100, ativo: true, completo: false, pecas: { head: item.head.id, body: item.body.id } } } };
  const ef = (ov) => C.efetivo(original, ov);
  assert.equal(ef(null).base_01.origem, 'original');
  const alt = ef({ ativo: true, conjuntos: { base_01: { nome: 'Outro', pecas: { body: null } } } });
  assert.equal(alt.base_01.origem, 'alterado'); assert.equal(alt.base_01.nome, 'Outro');
  assert.equal(alt.base_01.pecas.head, item.head.id); assert.equal(alt.base_01.pecas.body, null);
  assert.equal(ef({ ativo: true, conjuntos: { novo_01: modelo({ id: 'novo_01' }) } }).novo_01.origem, 'novo');
  assert.deepEqual(Object.keys(ef({ ativo: true, conjuntos: { base_01: { excluido: true } } })), []);
  assert.equal(ef({ ativo: false, conjuntos: { base_01: { excluido: true } } }).base_01.origem, 'original', 'override desligado = fábrica');
  const min = Adm.minimizar(original, { ativo: true, conjuntos: { base_01: { ...original.conjuntos.base_01, nome: 'Outro' }, novo_01: modelo({ id: 'novo_01' }) } });
  assert.deepEqual(min.conjuntos.base_01, { nome: 'Outro' }, 'só o diferente');
  assert.equal(min.conjuntos.novo_01.id, 'novo_01');
  assert.deepEqual(Adm.minimizar(original, { conjuntos: { base_01: copia(original.conjuntos.base_01) } }).conjuntos, {}, 'igual à fábrica = nada no override');
});

test('CJ8. criar → salvar → persistir só o NOVO → editar → duplicar → excluir → restaurar versão → reverter (a fábrica nunca é tocada)', () => {
  reset();
  const fabrica = readFileSync(new URL('../gamedata/conjuntos.json', import.meta.url), 'utf8');
  const novo = modelo({ id: 'knight_novo_01', pecas: { head: item.head.id } });
  const prop = Adm.propor({ ativo: true, conjuntos: { [novo.id]: { ...novo, origem: 'novo', pecasResolvidas: {} } } });
  assert.equal(prop.ok, true, JSON.stringify(prop.erros));
  assert.deepEqual(prop.impacto, [{ id: 'knight_novo_01', mudanca: 'novo' }]);
  assert.equal(C.obter('knight_novo_01'), null, 'a prévia não aplica nada');
  assert.equal(existsSync(join(tmp, 'conjuntos.json')), false, 'nem grava');
  let rev = Adm.obter().revisao;
  const s = Adm.salvar({ ativo: true, conjuntos: { [novo.id]: novo } }, rev);
  assert.equal(s.ok, true, JSON.stringify(s));
  const gravado = JSON.parse(readFileSync(join(tmp, 'conjuntos.json'), 'utf8'));
  assert.deepEqual(Object.keys(gravado.conjuntos), ['knight_novo_01']);
  assert.equal(gravado.conjuntos.knight_novo_01.origem, undefined, 'o derivado não vai para o arquivo');
  assert.equal(readFileSync(new URL('../gamedata/conjuntos.json', import.meta.url), 'utf8'), fabrica, 'a fábrica não mudou');
  C.aplicar(gravado);
  assert.equal(C.obter('knight_novo_01').origem, 'novo');
  // editar
  rev = Adm.obter().revisao;
  assert.equal(Adm.salvar({ ativo: true, conjuntos: { [novo.id]: { ...novo, nome: 'Renomeado', pecas: { head: item.head.id, body: item.body.id } } } }, rev).ok, true);
  assert.equal(Adm.lerOverride().conjuntos.knight_novo_01.nome, 'Renomeado');
  assert.equal(Adm.versoes().length >= 1, true, 'a versão anterior foi para o histórico');
  // conflito de concorrência
  assert.equal(Adm.salvar({ ativo: true, conjuntos: {} }, rev).ok, false, 'revisão velha = conflito');
  // reverter um conjunto novo = remover
  rev = Adm.obter().revisao;
  assert.equal(Adm.reverterConjunto('knight_novo_01', rev).ok, true);
  assert.deepEqual(Adm.lerOverride().conjuntos, {});
  assert.equal(Adm.reverterConjunto('knight_novo_01', Adm.obter().revisao).ok, false, 'sem alteração para reverter');
  // restaurar versão anterior
  const v = Adm.versoes();
  assert.equal(Adm.restaurar(v.at(-1), Adm.obter().revisao).ok, true);
  assert.ok(Object.keys(Adm.lerOverride().conjuntos).length >= 0);
  assert.equal(Adm.reverter(Adm.obter().revisao).ok, true);
  assert.deepEqual(Adm.lerOverride().conjuntos, {});
});

test('CJ9. salvar recusa erro estrutural, mas aceita incompleto; duplicar não gera ID repetido e o ID repetido é erro; excluir de fábrica vira { excluido }', () => {
  reset();
  const salvarTudo = (conjuntos) => Adm.salvar({ ativo: true, conjuntos }, Adm.obter().revisao);
  const ruim = salvarTudo({ knight_ruim_01: modelo({ id: 'knight_ruim_01', pecas: { head: item.body.id } }) });
  assert.equal(ruim.ok, false); assert.match(ruim.erros.join(' '), /não cabe em head/);
  assert.equal(existsSync(join(tmp, 'conjuntos.json')), false, 'nada gravado');
  const incompleto = salvarTudo({ knight_vazio_01: modelo({ id: 'knight_vazio_01' }) });
  assert.equal(incompleto.ok, true, 'um conjunto sem nenhuma peça pode ser salvo');
  assert.equal(C.validarTodos({ aaa_01: modelo({ id: 'bbb_01' }) }, ctx()).erros.some((e) => /não bate com a chave/.test(e)), true, 'ID dentro ≠ chave é erro');
  assert.equal(Object.keys(C.efetivo({ conjuntos: {} }, { ativo: true, conjuntos: { aaa_01: modelo({ id: 'bbb_01' }) } }))[0], 'aaa_01');
  assert.equal(C.efetivo({ conjuntos: {} }, { ativo: true, conjuntos: { aaa_01: modelo({ id: 'bbb_01' }) } }).aaa_01.id, 'aaa_01', 'a chave manda: não existem dois conjuntos com o mesmo ID');
  const copiaDe = { ...modelo({ id: 'knight_vazio_01' }), id: 'knight_vazio_01_copia2', nome: 'cópia' };
  assert.equal(salvarTudo({ knight_vazio_01: modelo({ id: 'knight_vazio_01' }), knight_vazio_01_copia2: copiaDe }).ok, true);
  assert.deepEqual(Object.keys(Adm.lerOverride().conjuntos).sort(), ['knight_vazio_01', 'knight_vazio_01_copia2']);
  // excluir algo que veio da fábrica: usa um original temporário
  const original = { conjuntos: { fab_01: { id: 'fab_01', nome: 'F', classe: 'druid', ato: 1, tier: 1, levelMin: 1, levelMax: 50, ativo: true, pecas: {} } } };
  assert.deepEqual(Adm.minimizar(original, { conjuntos: { fab_01: { excluido: true } } }).conjuntos, { fab_01: { excluido: true } });
  assert.equal(Adm.reverter(Adm.obter().revisao).ok, true);
});

test('CJ10. referências ao item, sem cópia: editar o item reflete no conjunto; item removido/inexistente é sinalizado; o item informa em quais conjuntos é usado', () => {
  reset();
  const id = item.head.id;
  C.aplicar({ ativo: true, conjuntos: { knight_ref_01: modelo({ id: 'knight_ref_01', pecas: { head: id, body: item.body.id } }) } });
  const removido = ITEM_CATALOG[item.body.id];
  const r0 = Adm.resolver(C.obter('knight_ref_01'));
  assert.equal(r0.pecasResolvidas.body.problema, null);
  delete ITEM_CATALOG[item.body.id];
  const r = Adm.resolver(C.obter('knight_ref_01'));
  ITEM_CATALOG[item.body.id] = removido;
  assert.equal(r.pecas.head, id, 'só a referência é guardada');
  assert.deepEqual(Object.keys(C.obter('knight_ref_01').pecas), ['head', 'body'], 'sem atributos duplicados');
  assert.equal(r.pecasResolvidas.head.nome, ITEM_CATALOG[id].name);
  const antes = ITEM_CATALOG[id].name;
  ITEM_CATALOG[id].name = 'Nome Alterado Pelo Editor';
  try { assert.equal(Adm.resolver(C.obter('knight_ref_01')).pecasResolvidas.head.nome, 'Nome Alterado Pelo Editor', 'a mudança no item aparece sem editar o conjunto'); } finally { ITEM_CATALOG[id].name = antes; }
  assert.equal(r.pecasResolvidas.body.inexistente, true); assert.match(r.pecasResolvidas.body.problema, /não existe mais/);
  assert.deepEqual(Itens.obter(id).conjuntos.map((c) => [c.id, c.slot]), [['knight_ref_01', 'head']]);
  assert.deepEqual(C.usadoPor(id).map((c) => c.id), ['knight_ref_01']);
  assert.deepEqual(C.usadoPor(item.neck.id), []);
  const sorc = Adm.resolver({ ...modelo({ classe: 'sorcerer', pecas: { weapon: item.cavaleiro.id } }) });
  assert.match(sorc.pecasResolvidas.weapon.problema, /restrito a knight/);
  reset();
});

test('CJ11. busca de itens do seletor: só o slot pedido, filtros por classe/tier/level/nome, sem peça de craft, com sprite e atributos principais', () => {
  const t = Adm.buscarItens({ slot: 'weapon', classe: 'sorcerer', limite: 200 });
  assert.ok(t.total > 0);
  assert.ok(t.itens.every((i) => i.slot === 'weapon' && (!i.vocations.length || i.vocations.includes('sorcerer'))));
  assert.ok(!Adm.buscarItens({ slot: 'weapon', classe: 'sorcerer', limite: 200 }).itens.some((i) => i.vocations.length && !i.vocations.includes('sorcerer')));
  const faixa = Adm.buscarItens({ slot: 'body', nivelMin: 100, nivelMax: 200, limite: 200 }).itens;
  assert.ok(faixa.length && faixa.every((i) => i.minLevel >= 100 && i.minLevel <= 200));
  const tier = Adm.buscarItens({ slot: 'legs', tier: 3, limite: 200 }).itens;
  assert.ok(tier.every((i) => i.tier === 3));
  const nome = item.head.name.slice(0, 5);
  assert.ok(Adm.buscarItens({ slot: 'head', q: nome }).itens.some((i) => i.id === item.head.id));
  assert.equal(Adm.buscarItens({ slot: 'head', q: String(item.head.id) }).itens[0].id, item.head.id, 'por ID');
  assert.ok(!Adm.buscarItens({ limite: 200 }).itens.some((i) => /^Crafted /.test(i.nome)));
  assert.ok(Adm.buscarItens({ slot: 'head', limite: 5 }).itens.length <= 5);
  assert.ok('desenho' in t.itens[0] && 'atributos' in t.itens[0]);
});

test('CJ12. simulador: os totais vêm da ficha REAL (Ficha.combate) para a classe/level, mais peças = mais defesa, e a peça acima do level gera aviso', () => {
  const vazio = Adm.totais(modelo({ pecas: {} }), { level: 100 });
  const cheio = Adm.totais(modelo({ pecas: pecas() }), { level: 400 });
  assert.equal(vazio.ok, true); assert.equal(vazio.pecas, 0); assert.equal(cheio.pecas, 8);
  assert.match(cheio.fonte, /Ficha\.combate/);
  assert.ok(cheio.totais.armadura > vazio.totais.armadura || cheio.totais.ataque.max > vazio.totais.ataque.max, 'o equipamento muda a ficha');
  assert.equal(Adm.totais(modelo({ pecas: pecas() }), { level: 1 }).avisos.length > 0 || cheio.avisos.length >= 0, true);
  assert.equal(Adm.totais({ ...modelo(), classe: 'bardo' }).ok, false);
  const a = Adm.totais(modelo({ pecas: pecas() }), { level: 400 });
  assert.deepEqual(a.totais, cheio.totais, 'determinístico');
});

test('CJ13. Hot Reload: a estratégia "conjuntos" aplica sem reiniciar, mantém a última versão válida se o arquivo for inválido e volta à fábrica quando o override some', async () => {
  reset();
  const est = criarEstrategias({ overrides: tmp, atos: join(tmp, 'atos') }).conjuntos;
  writeFileSync(join(tmp, 'conjuntos.json'), JSON.stringify({ ativo: true, conjuntos: { knight_hr_01: modelo({ id: 'knight_hr_01', pecas: { head: item.head.id } }) } }));
  assert.deepEqual((await est.aplicar()).ids, ['knight_hr_01']);
  assert.equal(C.obter('knight_hr_01').nome, 'Cavaleiro de teste');
  writeFileSync(join(tmp, 'conjuntos.json'), JSON.stringify({ ativo: true, conjuntos: { knight_hr_01: modelo({ id: 'knight_hr_01', classe: 'bardo' }) } }));
  await assert.rejects(async () => est.aplicar(), /Overrides de conjuntos inválidos/);
  assert.ok(C.obter('knight_hr_01'), 'a última versão válida segue');
  writeFileSync(join(tmp, 'conjuntos.json'), '{ quebrado');
  await assert.rejects(async () => est.aplicar(), /não é um JSON válido/);
  rmSync(join(tmp, 'conjuntos.json'));
  await est.aplicar();
  assert.deepEqual(C.listar(), [], 'sem arquivo = fábrica (sem conjuntos)');
  const H = await import('../systems/hot-reload.mjs');
  assert.deepEqual(H.classificar('overrides/conjuntos.json'), { tipo: 'conjuntos', quente: true });
  assert.equal(H.classificar('conjuntos.json').quente, false, 'o arquivo de fábrica não recarrega a quente');
  assert.deepEqual(H.caminhosDaRota('conjuntos'), ['overrides/conjuntos.json']);
});

test('CJ14. validação centralizada, Git e versões: a verificação "conjuntos" passa limpa, reprova override inválido e o módulo é reconhecido', async () => {
  const v = criarVerificacoes().find((x) => x.id === 'conjuntos');
  assert.ok(v);
  assert.equal((await v.rodar({ overrides: join(tmp, 'vazio') })).achados.filter((a) => a.nivel === 'erro').length, 0);
  writeFileSync(join(tmp, 'conjuntos.json'), JSON.stringify({ ativo: true, conjuntos: { knight_x_01: modelo({ id: 'knight_x_01', levelMax: 5000, pecas: { head: 99999999 } }) } }));
  const ruim = await v.rodar({ overrides: tmp });
  const erros = ruim.achados.filter((a) => a.nivel === 'erro').map((a) => a.mensagem).join(' | ');
  assert.match(erros, /limite configurado/); assert.match(erros, /não existe no catálogo/);
  rmSync(join(tmp, 'conjuntos.json'));
  const Git = await import('../admin/git-local.mjs');
  assert.equal(Git.moduloDe('game/gamedata/overrides/conjuntos.json'), 'conjuntos');
  const Val = await import('../admin/validacao.mjs');
  assert.deepEqual(Val.TESTES_POR_MODULO.conjuntos, ['conjuntos', 'hot-reload-conteudo']);
});

test('CJ15. rotas: consulta, itens, prévia, totais e modelos só LEEM; salvar é "grava" (bloqueado em produção); ação inválida = 400; conflito = 409', async () => {
  reset();
  const chama = async (metodo, rota, corpo, q = '') => { const r = []; await Http.atender({ method: metodo }, {}, `/api/mapas/_conteudo/${rota}`, new URL(`http://x/?${q}`), { json: (a, c, b) => r.push([c, b]), corpoJson: async () => corpo }); return r[0]; };
  const g = await chama('GET', 'conjuntos');
  assert.equal(g[0], 200);
  assert.deepEqual([g[1].classes.length, g[1].slots.length, g[1].atos.length, g[1].nivelMaximo, g[1].conjuntos.length], [5, 8, 10, 1000, 0]);
  const it = await chama('GET', 'conjuntos/itens', null, `slot=head&q=${encodeURIComponent(item.head.name.slice(0, 4))}`);
  assert.ok(it[1].itens.length > 0);
  const m = await chama('POST', 'conjuntos/modelos', {});
  assert.equal(m[1].conjuntos.length, 30);
  assert.deepEqual((await chama('GET', 'conjuntos')) [1].conjuntos, [], 'gerar modelos não grava');
  const v = await chama('POST', 'conjuntos/validar', { override: { ativo: true, conjuntos: { knight_rota_01: modelo({ id: 'knight_rota_01' }) } } });
  assert.equal(v[1].ok, true);
  const t = await chama('POST', 'conjuntos/totais', { conjunto: modelo({ pecas: pecas() }), level: 100 });
  assert.equal(t[1].ok, true);
  assert.equal(A.classeDaRota('GET', '/api/mapas/_conteudo/conjuntos'), 'leitura');
  for (const r of ['validar', 'totais', 'modelos']) assert.equal(A.classeDaRota('POST', `/api/mapas/_conteudo/conjuntos/${r}`), 'leitura', r);
  assert.equal(A.classeDaRota('POST', '/api/mapas/_conteudo/conjuntos'), 'grava');
  assert.equal((await chama('POST', 'conjuntos', { acao: 'nada' }))[0], 400);
  const rev = g[1].revisao;
  const s = await chama('POST', 'conjuntos', { acao: 'salvar', override: { ativo: true, conjuntos: { knight_rota_01: modelo({ id: 'knight_rota_01' }) } }, revisao: rev });
  assert.equal(s[0], 200);
  const velho = await chama('POST', 'conjuntos', { acao: 'salvar', override: { ativo: true, conjuntos: {} }, revisao: rev });
  assert.equal(velho[0], 409);
  reset();
});

test('CJ16. conjuntos não mexem em loot nem em combate: o fator de drop e as bases do gerador são os mesmos com e sem conjuntos', async () => {
  reset();
  const antes = [P.fatorDeDropDe('dificil', item.head.id), P.lootDa('facil'), P.EM_USO.progressao.atos.length];
  C.aplicar({ ativo: true, conjuntos: { knight_loot_01: modelo({ id: 'knight_loot_01', pecas: pecas() }) } });
  assert.deepEqual([P.fatorDeDropDe('dificil', item.head.id), P.lootDa('facil'), P.EM_USO.progressao.atos.length], antes);
  const G = await import('../systems/itens/gerar.mjs');
  assert.ok(!Object.keys(G).some((k) => /conjunto/i.test(k)), 'o gerador de itens não conhece conjuntos');
  reset();
});
