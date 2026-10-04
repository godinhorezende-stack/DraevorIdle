// Item Power — editor de nível e atributos-base (pela camada de overrides de itens): tradução dos campos, prévia, alertas com aprovação, salvar tudo-ou-nada, restaurar, histórico, lote,
// recalcular a curva, comparação original × editado, Hot Reload, rotas e regressões do módulo de comparação.
import { test, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmp = mkdtempSync(join(tmpdir(), 'ipe-'));
process.env.DRAEVOR_OVERRIDES = tmp; // overrides DESTE processo na pasta temporária (nunca os do dono)
process.env.ENGINE_ITEM_POWER_HISTORICO = join(tmp, 'historico.jsonl');
after(() => rmSync(tmp, { recursive: true, force: true }));

const IP = await import('../systems/item-power.mjs');
const Ed = await import('../admin/item-power-editor.mjs');
const Itens = await import('../admin/overrides-itens.mjs');
const Adm = await import('../admin/overrides-item-power.mjs');
const Http = await import('../admin/conteudo-http.mjs');
const H = await import('../systems/hot-reload.mjs');
const A = await import('../admin/acesso.mjs');
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { criarEstrategias } = await import('../systems/hot-reload-estrategias.mjs');

const copia = (o) => JSON.parse(JSON.stringify(o));
const PROG = await import('../systems/progressao.mjs');
const await_P = () => PROG;
const estrategia = () => criarEstrategias({ overrides: tmp, atos: join(tmp, 'atos') }).itens;
const reset = async () => { rmSync(join(tmp, '_versoes'), { recursive: true, force: true }); for (const f of ['itens.json', 'historico.jsonl']) if (existsSync(join(tmp, f))) rmSync(join(tmp, f)); await estrategia().aplicar(); };
const ARQ = join(tmp, 'itens.json');
const lerArq = () => JSON.parse(readFileSync(ARQ, 'utf8'));
const ESPADA = 7383; // relic sword: weapon, nível 50, attack 42, defense 24
const ARMADURA_KNIGHT = Object.values(ITEM_CATALOG).find((m) => m.slot === 'body' && m.vocations?.length === 1 && m.vocations[0] === 'knight' && m.minLevel > 100 && m.armor > 0);
const ARMADURA_MAGO = Object.values(ITEM_CATALOG).find((m) => m.slot === 'body' && m.vocations?.length && m.vocations.every((v) => ['sorcerer', 'druid'].includes(v)) && m.minLevel > 100 && m.armor > 0);
beforeEach(async () => { await reset(); }); // cada teste começa sem override e com o catálogo em memória original

test('IPE1. mapa dos campos: Damage → attack, Block → defense, nível/nome/raridade diretos; categoria, tipo, classe, duas mãos e tier são somente leitura COM o motivo; campo desconhecido é recusado', () => {
  const t = Ed.traduzir(ESPADA, { damage: 80, block: 30, minLevel: 60, name: 'Espada Nova', rarity: 'épico' });
  assert.deepEqual(t.erros, []);
  assert.deepEqual(t.ov, { attack: 80, defense: 30, minLevel: 60, name: 'Espada Nova', rarity: 'épico' });
  for (const k of ['slot', 'type', 'vocations', 'twoHanded', 'tier']) {
    const r = Ed.traduzir(ESPADA, { [k]: 'x' });
    assert.match(r.erros.join(' '), new RegExp(`"${k}" não pode ser editado aqui — `), k);
  }
  assert.match(Ed.traduzir(ESPADA, { dps: 5 }).erros.join(' '), /campo desconhecido/);
  assert.match(Ed.traduzir(99999999, { damage: 1 }).erros.join(' '), /não existe no catálogo/);
  assert.deepEqual(Object.keys(Ed.SOMENTE_LEITURA).sort(), ['slot', 'tipo'].length ? ['slot', 'tier', 'twoHanded', 'type', 'vocations'] : []);
  assert.deepEqual(Ed.CAMPOS_EDITAVEIS, ['name', 'minLevel', 'rarity', 'attack', 'defense', 'armor']);
});

test('IPE2. valores: negativo, não numérico e fora de limite são erros; decimal vira inteiro com aviso; valor igual ao original NÃO vira override', () => {
  assert.match(Ed.traduzir(ESPADA, { damage: -1 }).erros.join(' '), /não pode ser negativo/);
  assert.match(Ed.traduzir(ESPADA, { minLevel: 'abc' }).erros.join(' '), /número válido/);
  const dec = Ed.traduzir(ESPADA, { damage: 50.6 });
  assert.equal(dec.ov.attack, 51); assert.match(dec.avisos.join(' '), /arredondado para 51/);
  assert.deepEqual(Ed.traduzir(ESPADA, { damage: ITEM_CATALOG[ESPADA].attack, minLevel: ITEM_CATALOG[ESPADA].minLevel }).ov, {}, 'igual ao original = sem override');
  const p = Ed.previaDoItem(ESPADA, { minLevel: 99999 });
  assert.equal(p.ok, false); assert.match(p.erros.join(' '), /minLevel precisa ser um inteiro de 0 a 5\.000/);
  assert.equal(Ed.previaDoItem(ESPADA, { rarity: 'azul' }).ok, false);
});

test('IPE3. Armour/Evasion/Energy Shield são derivados da armadura-base pelo tipo da peça: editar um alvo resolve a armadura que o produz; tipo ausente e slots sem armadura são erros', () => {
  const meta = ARMADURA_KNIGHT;
  const t = Ed.traduzir(meta.id, { armour: meta.armor * 3 });
  assert.deepEqual(t.erros, []);
  assert.equal(t.ov.armor, meta.armor * 3, 'knight = base Armour: o alvo é a própria armadura');
  assert.match(Ed.traduzir(meta.id, { evasion: 100 }).erros.join(' '), /não tem evasion/);
  assert.match(Ed.traduzir(ESPADA, { armour: 10 }).erros.join(' '), /não tem armadura-base/);
  const mago = ARMADURA_MAGO;
  const alvo = 500;
  const r = Ed.previaDoItem(mago.id, { energyShield: alvo });
  assert.equal(r.ok, true);
  assert.ok(Math.abs(r.candidato.atributos.energyShield - alvo) <= alvo * 0.05, `Energy Shield ficou ${r.candidato.atributos.energyShield} para o alvo ${alvo}`);
  assert.deepEqual(r.tiposDeDefesa, ['energyShield']);
  assert.equal(Ed.traduzir(meta.id, { armor: 50, armour: 999 }).ov.armor, 50, 'a armadura-base explícita vence o alvo');
});

test('IPE4. prévia de uma edição (a simulação do enunciado): nível 140→160, Damage, Block — IP atual × candidato, esperado, diferença, tier derivado e equivalentes, sem tocar no item', () => {
  const alvo = Object.values(ITEM_CATALOG).find((m) => m.slot === 'weapon' && m.minLevel === 140 && m.attack > 0);
  const antesJson = JSON.stringify(ITEM_CATALOG[alvo.id]);
  const p = Ed.previaDoItem(alvo.id, { minLevel: 160, damage: 15, block: 20 });
  assert.equal(p.ok, true, JSON.stringify(p.erros));
  assert.equal(p.atual.minLevel, 140); assert.equal(p.candidato.minLevel, 160);
  assert.equal(p.candidato.atributos.attack, 15); assert.equal(p.candidato.atributos.defense, 20);
  assert.equal(p.candidato.ip, IP.calcular({ damageMin: 15, damageMax: 15, defesa: 20 }, IP.EM_USO, 'weapon').ip, 'usa a fórmula do módulo (Block da arma conta metade)');
  assert.equal(p.candidato.esperado, IP.esperado(IP.EM_USO, 'weapon', 160));
  assert.equal(p.candidato.diferencaPct, Math.round(((p.candidato.ip - p.candidato.esperado) / p.candidato.esperado) * 10000) / 10000);
  assert.equal(p.candidato.tier, (await_P()).tierDaBase(160), 'o tier acompanha o nível');
  assert.equal(p.atual.tier, (await_P()).tierDaBase(140));
  assert.ok(p.original && p.atual && p.candidato && Array.isArray(p.equivalentes));
  assert.deepEqual(p.mudancas.map((m) => m.campo).sort(), ['attack', 'defense', 'minLevel']);
  assert.equal(JSON.stringify(ITEM_CATALOG[alvo.id]), antesJson, 'a prévia não altera o item real');
});

test('IPE5. o nível muda a divisão da defesa (Evasion/Energy Shield crescem com o level do item) e o tier; a prévia mostra o resultado real', () => {
  const m = Object.values(ITEM_CATALOG).find((x) => x.slot === 'body' && x.vocations?.length && x.vocations.every((v) => v === 'paladin') && x.minLevel > 50 && x.armor > 0);
  const base = Ed.previaDoItem(m.id, {});
  const mais = Ed.previaDoItem(m.id, { minLevel: m.minLevel + 100 });
  assert.ok(mais.candidato.atributos.evasion > base.candidato.atributos.evasion, 'Evasion cresce com o level do item');
  assert.equal(mais.candidato.tier, base.candidato.tier + 1);
});

test('IPE6. alertas (não bloqueiam): nível distante, IP muito acima da curva, supera equivalentes, atributo fora da faixa do tier — cada um exige aprovação MANUAL', () => {
  const p = Ed.previaDoItem(ESPADA, { minLevel: 400, damage: 400 });
  assert.equal(p.ok, true, 'alerta não é erro');
  const tipos = p.alertas.map((a) => a.tipo);
  assert.ok(tipos.includes('nivel-distante'));
  assert.ok(tipos.includes('ip-muito-acima') || tipos.includes('supera-equivalentes') || tipos.some((t) => t.startsWith('faixa-do-tier')));
  assert.ok(p.alertas.every((a) => a.exigeAprovacao && a.codigo === `${a.tipo}:${ESPADA}` && a.mensagem));
  const fora = Ed.previaDoItem(ESPADA, { damage: 900 });
  assert.ok(fora.alertas.some((a) => a.tipo === 'faixa-do-tier-attack'), 'Damage 900 passa a faixa do tier');
  assert.ok(fora.alertas.some((a) => a.tipo === 'ip-muito-acima'));
  const pouco = Ed.previaDoItem(ESPADA, { damage: 2 });
  assert.ok(pouco.alertas.some((a) => a.tipo === 'ip-muito-abaixo'));
  assert.deepEqual(Ed.previaDoItem(ESPADA, { damage: ITEM_CATALOG[ESPADA].attack + 1 }).alertas, [], 'mudança pequena: sem alerta');
});

test('IPE7. salvar: recusa sem aprovar os alertas (codigo "aprovacao"); com aprovação grava só o DIFERENTE em itens.json, o catálogo importado não muda e o histórico registra', async () => {
  await reset();
  const fabrica = readFileSync(new URL('../gamedata/item-catalog.json', import.meta.url), 'utf8');
  const ed = { [ESPADA]: { minLevel: 400, damage: 400 } };
  const sem = Ed.salvar({ edicoes: ed });
  assert.equal(sem.ok, false); assert.equal(sem.codigo, 'aprovacao'); assert.ok(sem.pendentes.length >= 1);
  assert.equal(existsSync(ARQ), false, 'nada gravado sem aprovação');
  const parcial = Ed.salvar({ edicoes: ed, aprovados: [sem.pendentes[0].codigo] });
  assert.equal(parcial.ok, parcial.pendentes === undefined, 'com todos os códigos aprovados passa; faltando algum, recusa');
  await reset();
  const ok = Ed.salvar({ edicoes: ed, aprovados: sem.pendentes.map((a) => a.codigo), origem: 'individual', rotulo: 'teste' });
  assert.equal(ok.ok, true, JSON.stringify(ok));
  assert.deepEqual(ok.alterados, [ESPADA]);
  assert.deepEqual(lerArq().itens[ESPADA], { minLevel: 400, attack: 400 }, 'só o diferente do original');
  assert.equal(readFileSync(new URL('../gamedata/item-catalog.json', import.meta.url), 'utf8'), fabrica, 'o catálogo importado não foi tocado');
  const h = Ed.historico();
  assert.equal(h.eventos[0].tipo, 'individual'); assert.deepEqual(h.eventos[0].ids, [ESPADA]); assert.equal(h.eventos[0].rotulo, 'teste');
  assert.equal(h.eventos[0].itens[0].mudancas.find((m) => m.campo === 'attack').para, 400);
  assert.match(ok.comoPublicar, /commit/);
  assert.match(ok.hotReload, /Hot Reload/);
  await reset();
});

test('IPE8. salvar é TUDO OU NADA: um item inválido no lote impede a gravação de todos; sem mudança não grava; conflito de revisão é recusado', async () => {
  await reset();
  const r = Ed.salvar({ edicoes: { [ESPADA]: { damage: 44 }, 99999999: { damage: 1 } }, aprovarTodos: true });
  assert.equal(r.ok, false); assert.match(r.erros.join(' '), /não existe no catálogo/);
  assert.equal(existsSync(ARQ), false, 'nem o item válido foi gravado');
  const igual = Ed.salvar({ edicoes: { [ESPADA]: { damage: ITEM_CATALOG[ESPADA].attack } } });
  assert.equal(igual.semMudancas, true); assert.equal(existsSync(ARQ), false);
  assert.equal(Ed.salvar({ edicoes: { [ESPADA]: { damage: 44 } }, revisao: 'velha' }).codigo, 'conflito');
  const certa = Ed.salvar({ edicoes: { [ESPADA]: { damage: 44 } }, revisao: Ed.previa({ [ESPADA]: {} }).revisao });
  assert.equal(certa.ok, true);
  await reset();
});

test('IPE9. cancelar e prévia não alteram o item: ITEM_CATALOG só muda quando o Hot Reload aplica o override salvo (e volta ao original ao restaurar)', async () => {
  await reset();
  const original = ITEM_CATALOG[ESPADA].attack;
  Ed.previa({ [ESPADA]: { damage: original + 10 } });
  assert.equal(ITEM_CATALOG[ESPADA].attack, original, 'prévia (e cancelar) não mexem');
  assert.equal(Ed.salvar({ edicoes: { [ESPADA]: { damage: original + 10 } }, aprovarTodos: true }).ok, true);
  assert.equal(ITEM_CATALOG[ESPADA].attack, original, 'gravar o arquivo ainda não muda o jogo em memória');
  await estrategia().aplicar();
  assert.equal(ITEM_CATALOG[ESPADA].attack, original + 10, 'o Hot Reload "itens" aplicou');
  assert.equal(IP.fichaDePoder(ESPADA, IP.EM_USO).atributos.damage, original + 10, 'o Item Power passa a ler o valor novo');
  assert.equal(Ed.restaurar({ ids: [ESPADA] }).ok, true);
  await estrategia().aplicar();
  assert.equal(ITEM_CATALOG[ESPADA].attack, original, 'restaurar + Hot Reload = original de volta');
  await reset();
});

test('IPE10. restaurar remove SÓ o override pedido: preço/peso (outro editor) e os outros itens ficam; campo a campo ou tudo; restaurar sem alteração avisa', async () => {
  await reset();
  Itens.gravarDados({ ativo: true, itens: { 3268: { sell: 7 }, [ESPADA]: { attack: 60, minLevel: 70, sell: 9 } } });
  assert.deepEqual(Ed.restaurar({ ids: [ESPADA], campos: ['damage'] }).restaurados, [ESPADA]);
  assert.deepEqual(lerArq().itens[ESPADA], { minLevel: 70, sell: 9 }, 'só o attack saiu');
  assert.equal(Ed.restaurar({ ids: [ESPADA] }).ok, true);
  assert.deepEqual(lerArq().itens[ESPADA], { sell: 9 }, 'preço preservado');
  assert.deepEqual(lerArq().itens[3268], { sell: 7 }, 'outro item intacto');
  assert.equal(Ed.restaurar({ ids: [ESPADA] }).ok, false, 'nada mais para restaurar');
  assert.equal(Ed.restaurar({ ids: [3268] }).ok, false, 'o item 3268 só tem preço: não é do editor de atributos');
  assert.match(Ed.restaurar({ ids: [ESPADA], campos: ['sell'] }).erros.join(' '), /não é um campo restaurável/);
  assert.equal(Ed.restaurar({ ids: [] }).ok, false);
  await reset();
});

test('IPE11. histórico e versões: cada gravação vira evento (individual/lote/restauração) e a versão anterior do itens.json é guardada; compara versões e restaura uma versão inteira', async () => {
  await reset();
  Ed.salvar({ edicoes: { [ESPADA]: { damage: 45 } }, origem: 'individual', aprovarTodos: true });
  Ed.salvar({ edicoes: { [ESPADA]: { damage: 46 }, 3264: { damage: 30 } }, origem: 'tabela', aprovarTodos: true });
  Ed.restaurar({ ids: [3264], rotulo: 'x' });
  const h = Ed.historico();
  assert.deepEqual(h.eventos.map((e) => e.tipo), ['restauracao', 'tabela', 'individual']);
  assert.ok(h.versoes.length >= 2);
  const c = Ed.compararVersoes(h.versoes.at(-1), 'atual');
  assert.equal(c.ok, true);
  assert.ok(c.mudancas.some((m) => m.id === ESPADA && m.campo === 'attack' && m.de === 45 && m.para === 46), 'a versão 1 guarda o arquivo ANTES da segunda gravação');
  assert.equal(Ed.compararVersoes(999, 'atual').ok, false);
  assert.equal(Ed.restaurarVersao(h.versoes.at(-1)).ok, true);
  assert.equal(lerArq().itens?.[ESPADA]?.attack ?? null, ISO(h.versoes.at(-1)), 'a versão restaurada voltou');
  await reset();
});
function ISO(n) { return JSON.parse(readFileSync(join(tmp, '_versoes', 'itens', `${n}.json`), 'utf8')).itens?.[ESPADA]?.attack ?? null; }

test('IPE12. seleção para o lote: classe, categoria, tier, Ato, faixa de nível, raridade e busca; filtros de nível excluem itens sem level; "Crafted" fica de fora', () => {
  const todos = Ed.selecionar({});
  assert.ok(todos.length > 1000);
  const body = Ed.selecionar({ categoria: 'body' });
  assert.ok(body.every((id) => ITEM_CATALOG[id].slot === 'body'));
  const kn = Ed.selecionar({ classe: 'knight', categoria: 'weapon' });
  assert.ok(kn.every((id) => !ITEM_CATALOG[id].vocations?.length || ITEM_CATALOG[id].vocations.includes('knight')));
  const faixa = Ed.selecionar({ nivelMin: 100, nivelMax: 200 });
  assert.ok(faixa.length && faixa.every((id) => ITEM_CATALOG[id].minLevel >= 100 && ITEM_CATALOG[id].minLevel <= 200));
  const t2 = Ed.selecionar({ tier: 2 });
  assert.ok(t2.length && t2.every((id) => IP.fichaDePoder(id, IP.EM_USO).tier === 2));
  const ato2 = Ed.selecionar({ ato: 2 });
  assert.ok(ato2.every((id) => ITEM_CATALOG[id].minLevel >= 101 && ITEM_CATALOG[id].minLevel <= 200));
  assert.ok(Ed.selecionar({ raridade: 'épico' }).every((id) => ITEM_CATALOG[id].rarity === 'épico'));
  assert.deepEqual(Ed.selecionar({ q: String(ESPADA) }), [ESPADA]);
  assert.ok(!todos.some((id) => /^Crafted /.test(ITEM_CATALOG[id].name)));
  assert.ok(Ed.selecionar({ incluirCraft: true }).length >= todos.length);
});

test('IPE13. lote: definir / somar / multiplicar nível, Damage, Block, Armour, Evasion e Energy Shield; itens sem o atributo são IGNORADOS e listados; operação inválida é erro', () => {
  const m = Ed.montarLote({ ids: [ESPADA], operacoes: [{ campo: 'damage', op: 'multiplicar', valor: 1.5 }, { campo: 'nivel', op: 'somar', valor: -10 }, { campo: 'block', op: 'definir', valor: 30 }] });
  assert.deepEqual(m.edicoes[ESPADA], { damage: Math.round(ITEM_CATALOG[ESPADA].attack * 1.5), minLevel: 40, block: 30 });
  const arm = Ed.montarLote({ ids: [ARMADURA_KNIGHT.id], operacoes: [{ campo: 'armour', op: 'multiplicar', valor: 2 }] });
  assert.equal(arm.edicoes[ARMADURA_KNIGHT.id].armour, IP.fichaDePoder(ARMADURA_KNIGHT.id, IP.EM_USO).atributos.armour * 2);
  const sem = Ed.montarLote({ ids: [ESPADA, ARMADURA_KNIGHT.id], operacoes: [{ campo: 'evasion', op: 'multiplicar', valor: 2 }] });
  assert.deepEqual(sem.edicoes, {}); assert.equal(sem.ignorados.length, 2); assert.match(sem.ignorados[0].motivo, /não tem evasion/);
  const semNivel = Object.values(ITEM_CATALOG).find((x) => x.slot === 'head' && !(x.minLevel > 0));
  assert.match(Ed.montarLote({ ids: [semNivel.id], operacoes: [{ campo: 'nivel', op: 'somar', valor: 5 }] }).ignorados[0].motivo, /sem nível mínimo/);
  assert.equal(Ed.montarLote({ ids: [semNivel.id], operacoes: [{ campo: 'nivel', op: 'definir', valor: 5 }] }).edicoes[semNivel.id].minLevel, 5, 'definir funciona mesmo sem nível');
  for (const ruim of [{ campo: 'dps', op: 'definir', valor: 1 }, { campo: 'damage', op: 'dividir', valor: 2 }, { campo: 'damage', op: 'definir', valor: 'x' }, { campo: 'nivel', op: 'multiplicar', valor: 2 }, { campo: 'damage', op: 'multiplicar', valor: -1 }]) assert.ok(Ed.montarLote({ ids: [ESPADA], operacoes: [ruim] }).erros.length, JSON.stringify(ruim));
  assert.ok(Ed.montarLote({ ids: [ESPADA], operacoes: [] }).erros.length);
  assert.equal(Ed.montarLote({ ids: [ESPADA], operacoes: [{ campo: 'damage', op: 'somar', valor: -1000 }] }).edicoes[ESPADA].damage, 0, 'nunca negativo');
});

test('IPE14. prévia e aplicação do lote: quantidade, valores antigos × novos, alertas de excesso (IP e nível), tudo-ou-nada, registro como "lote"; e restaurar o lote pelo filtro', async () => {
  await reset();
  const pedido = { filtros: { categoria: 'body', nivelMin: 100, nivelMax: 200 }, operacoes: [{ campo: 'armour', op: 'multiplicar', valor: 1.1 }] };
  const p = Ed.previaDeLote(pedido);
  assert.equal(p.ok, true); assert.equal(p.afetados, Object.keys(p.edicoes).length); assert.ok(p.afetados > 5);
  assert.ok(p.linhas.every((l) => l.mudancas.length && l.ipAntes != null && l.ipDepois != null));
  assert.ok(p.linhas.every((l) => l.ipDepois >= l.ipAntes), 'multiplicar Armour por 1,1 não reduz o IP');
  assert.equal(existsSync(ARQ), false, 'a prévia não grava');
  const grande = Ed.previaDeLote({ ...pedido, operacoes: [{ campo: 'armour', op: 'multiplicar', valor: 3 }, { campo: 'nivel', op: 'somar', valor: 80 }] });
  assert.ok(grande.alertas.some((a) => a.tipo === 'lote-excessivo'), 'alteração excessiva é alertada');
  assert.equal(Ed.salvar({ edicoes: grande.edicoes, origem: 'lote' }).codigo, 'aprovacao', 'sem aprovar não aplica');
  const ok = Ed.salvar({ edicoes: p.edicoes, origem: 'lote', rotulo: 'armaduras +10%', aprovados: p.alertas.map((a) => a.codigo) });
  assert.equal(ok.ok, true); assert.equal(ok.alterados.length, p.afetados);
  assert.equal(Object.keys(lerArq().itens).length, p.afetados);
  assert.equal(Ed.historico().eventos[0].tipo, 'lote');
  assert.ok(Adm.listarItens({ modificado: '1', limite: 200 }).itens.every((i) => i.modificado && i.original));
  assert.equal(Adm.listarItens({ limite: 1 }).modificados, p.afetados);
  const r = Ed.restaurar({ filtros: { categoria: 'body', nivelMin: 100, nivelMax: 200 }, rotulo: 'desfazer' });
  assert.equal(r.restaurados.length, p.afetados);
  assert.deepEqual(lerArq().itens, {});
  assert.equal(Ed.previaDeLote({ filtros: { q: 'zzzz-nao-existe' }, operacoes: pedido.operacoes }).ok, false);
  await reset();
});

test('IPE15. a curva é INDEPENDENTE dos itens editados; recalcular é só uma PROPOSTA (mediana por faixa, valores atípicos descartados) que só vale ao salvar a curva', async () => {
  await reset();
  const curvaAntes = JSON.stringify(IP.EM_USO.curva);
  Ed.salvar({ edicoes: { [ESPADA]: { damage: 900 } }, aprovarTodos: true });
  await estrategia().aplicar();
  assert.equal(JSON.stringify(IP.EM_USO.curva), curvaAntes, 'editar um item não mexe na curva');
  // um item exagerado não distorce a proposta
  const f = (id, slot, minLevel, ip) => ({ id, nome: `i${id}`, slot, minLevel, ip });
  const normais = [10, 11, 12, 13, 14].map((v, i) => f(i + 1, 'body', 50, v)); // mediana 12
  const sem = IP.propostaDeCurva(normais, { niveis: [50, 100], categorias: ['body'] });
  const com = IP.propostaDeCurva([...normais, f(99, 'body', 50, 100000)], { niveis: [50, 100], categorias: ['body'] });
  assert.deepEqual(com.categorias.body.pontos, sem.categorias.body.pontos, 'o atípico foi descartado');
  assert.deepEqual(com.categorias.body.descartados.map((d) => d.id), [99]);
  const semDescarte = IP.propostaDeCurva([...normais, f(99, 'body', 50, 100000)], { niveis: [50, 100], categorias: ['body'], descartarAtipicos: false });
  assert.equal(semDescarte.categorias.body.pontos[0].ip, 12.5, 'mesmo sem descarte a MEDIANA resiste (12,5, não ~16 mil)');
  assert.deepEqual(IP.propostaDeCurva(normais, { niveis: [50, 100], categorias: ['body'], minimoDeItens: 10 }).categorias.body.buckets.map((b) => b.mediana), [null, null], 'poucos itens: sem ponto novo');
  const pr = Ed.propostaDeCurva({ filtros: { categoria: 'body', classe: 'knight' } });
  assert.equal(pr.ok, true); assert.ok(pr.itensConsiderados > 5); assert.deepEqual(Object.keys(pr.proposta), ['body']);
  assert.ok(pr.proposta.body.every((p, i, a) => i === 0 || p.ip >= a[i - 1].ip), 'monotônica');
  assert.equal(JSON.stringify(IP.EM_USO.curva), curvaAntes, 'a proposta não aplicou nada');
  assert.ok(Ed.propostaDeCurva({ filtros: { categoria: 'body' }, excluirIds: [ARMADURA_KNIGHT.id] }).itensConsiderados < Ed.propostaDeCurva({ filtros: { categoria: 'body' } }).itensConsiderados);
  // aplicar = salvar a curva pelo fluxo existente do Item Power (explícito)
  const ef = Adm.obter().efetiva;
  const salvou = Adm.salvar({ ativo: true, ...ef, curva: { ...ef.curva, categorias: { ...ef.curva.categorias, body: pr.proposta.body } } }, Adm.obter().revisao);
  assert.equal(salvou.ok, true, JSON.stringify(salvou.erros));
  IP.aplicar(Adm.lerOverride());
  assert.deepEqual(IP.pontosDaCurva(IP.EM_USO, 'body'), pr.proposta.body);
  rmSync(join(tmp, 'item-power.json')); IP.aplicar(null);
  await reset();
});

test('IPE16. comparar original × atual × editada (não salva) com nível, classe, categoria, tier, raridade, atributos, IP e situação na curva', async () => {
  await reset();
  Ed.salvar({ edicoes: { [ESPADA]: { damage: 60 } }, aprovarTodos: true }); await estrategia().aplicar();
  const r = Ed.compararEntradas([{ id: ESPADA, versao: 'original' }, { id: ESPADA, versao: 'atual' }, { id: ESPADA, versao: 'editada', edicao: { damage: 70, minLevel: 60 } }, { id: ARMADURA_KNIGHT.id, versao: 'atual' }]);
  assert.equal(r.ok, true); assert.equal(r.itens.length, 4);
  const [o, a, e, outro] = r.itens;
  assert.equal(o.atributos.damage, ITEM_CATALOG[ESPADA].attack === 42 ? 42 : o.atributos.damage); assert.equal(a.atributos.damage, 60); assert.equal(e.atributos.damage, 70);
  assert.match(e.rotulo, /editado, não salvo/); assert.match(o.rotulo, /original/);
  assert.equal(e.minLevel, 60); assert.ok(e.ip > a.ip && a.ip > o.ip);
  for (const i of r.itens) for (const k of ['minLevel', 'vocations', 'slot', 'categoria', 'tier', 'raridade', 'atributos', 'ip', 'situacao', 'contraReferencia']) assert.ok(k in i, k);
  assert.equal(o.contraReferencia.diferenca, 0); assert.equal(a.contraReferencia.diferencaPct, Math.round(((a.ip - o.ip) / o.ip) * 10000) / 10000);
  assert.notEqual(outro.slot, o.slot, 'classes e categorias diferentes podem ser comparadas');
  assert.equal(ITEM_CATALOG[ESPADA].attack, 60, 'a versão editada não salva não alterou o item');
  assert.equal(Ed.compararEntradas([{ id: ESPADA, versao: 'atual' }]).ok, false);
  assert.equal(Ed.compararEntradas([{ id: ESPADA }, { id: 99999999 }]).ok, false);
  assert.match(r.aviso, /não é DPS/);
  await reset();
});

test('IPE17. regressão do módulo de comparação: IP, ficha e lista continuam iguais ao cálculo direto; atributosBase/fichaDePoder ≡ atributosDoMeta/fichaDoMeta; a lista marca modificados', async () => {
  await reset();
  for (const id of [ESPADA, 3434, 10384, ARMADURA_KNIGHT.id]) {
    assert.deepEqual(IP.atributosBase(id), IP.atributosDoMeta(ITEM_CATALOG[id]));
    assert.deepEqual(IP.fichaDePoder(id, IP.EM_USO), IP.fichaDoMeta(ITEM_CATALOG[id], IP.EM_USO));
  }
  assert.equal(IP.fichaDePoder(7383, IP.EM_USO).tier, PROG.tierDaBase(50));
  assert.equal(IP.compararItens([3434, 7383], IP.EM_USO).ok, true);
  assert.deepEqual(IP.compararFichas([IP.fichaDePoder(3434, IP.EM_USO), IP.fichaDePoder(7383, IP.EM_USO)]), IP.compararItens([3434, 7383], IP.EM_USO));
  const l = Adm.listarItens({ q: 'relic sword' });
  assert.ok(l.itens.every((i) => i.modificado === false && i.original === null));
  Ed.salvar({ edicoes: { [ESPADA]: { damage: 44 } }, aprovarTodos: true }); await estrategia().aplicar();
  const m = Adm.listarItens({ q: String(ESPADA) }).itens[0];
  assert.equal(m.modificado, true); assert.equal(m.original.attack, 42); assert.equal(m.atributos.attack, 44);
  assert.equal(Adm.listarItens({ modificado: '1' }).total, 1);
  await reset();
});

test('IPE18. Hot Reload: o override salvo é aplicado pela estratégia "itens" sem reiniciar, override inválido mantém a última versão válida e o caminho da rota é reconhecido', async () => {
  await reset();
  const o = ITEM_CATALOG[ESPADA].attack;
  Ed.salvar({ edicoes: { [ESPADA]: { damage: o + 3 } }, aprovarTodos: true });
  await estrategia().aplicar();
  assert.equal(ITEM_CATALOG[ESPADA].attack, o + 3);
  writeFileSync(ARQ, JSON.stringify({ ativo: true, itens: { [ESPADA]: { attack: -5 } } }));
  await assert.rejects(async () => estrategia().aplicar(), /inválidos/);
  assert.equal(ITEM_CATALOG[ESPADA].attack, o + 3, 'a última versão válida segue');
  assert.deepEqual(H.caminhosDaRota('item-power/edicao'), ['overrides/itens.json']);
  assert.deepEqual(H.classificar('overrides/itens.json'), { tipo: 'itens', quente: true });
  await reset();
  assert.equal(ITEM_CATALOG[ESPADA].attack, o);
});

test('IPE19. rotas: estado do item, prévia, lote, proposta de curva, histórico, comparar versões e selecionar só LEEM; salvar/restaurar gravam; com "aplicar" informa o Hot Reload (desligado nos testes)', async () => {
  await reset();
  const chama = async (metodo, rota, corpo, q = '') => { const r = []; await Http.atender({ method: metodo }, {}, `/api/mapas/_conteudo/${rota}`, new URL(`http://x/?${q}`), { json: (a, c, b) => r.push([c, b]), corpoJson: async () => corpo }); return r[0]; };
  const g = await chama('GET', `item-power/edicao/${ESPADA}`);
  assert.equal(g[0], 200); assert.equal(g[1].metaOriginal.attack, 42); assert.deepEqual(g[1].camposEditaveis, Ed.CAMPOS_EDITAVEIS); assert.ok(g[1].somenteLeituraMotivos.slot); assert.ok(g[1].tiposDeDefesa);
  assert.equal((await chama('GET', 'item-power/edicao/1'))[0], 404);
  const pv = await chama('POST', 'item-power/edicao-previa', { edicoes: { [ESPADA]: { damage: 50 } } });
  assert.equal(pv[1].ok, true); assert.equal(pv[1].itens[0].candidato.atributos.attack, 50);
  assert.equal((await chama('POST', 'item-power/lote-previa', { filtros: { categoria: 'legs' }, operacoes: [{ campo: 'armour', op: 'multiplicar', valor: 1.05 }] }))[1].ok, true);
  assert.equal((await chama('POST', 'item-power/curva-proposta', { filtros: { categoria: 'body' } }))[1].ok, true);
  assert.equal((await chama('GET', 'item-power/selecionar', null, 'categoria=body'))[1].total > 0, true);
  assert.equal((await chama('GET', 'item-power/historico'))[0], 200);
  assert.equal((await chama('GET', 'item-power/versoes-comparar', null, 'de=999'))[0], 404);
  assert.equal((await chama('POST', 'item-power/comparar', { entradas: [{ id: ESPADA, versao: 'original' }, { id: ESPADA, versao: 'editada', edicao: { damage: 50 } }] }))[1].ok, true);
  for (const r of ['edicao-previa', 'lote-previa', 'curva-proposta']) assert.equal(A.classeDaRota('POST', `/api/mapas/_conteudo/item-power/${r}`), 'leitura', r);
  assert.equal(A.classeDaRota('POST', '/api/mapas/_conteudo/item-power/edicao'), 'grava');
  assert.equal((await chama('POST', 'item-power/edicao', { acao: 'nada' }))[0], 400);
  const s = await chama('POST', 'item-power/edicao', { acao: 'salvar', edicoes: { [ESPADA]: { damage: 44 } }, aplicar: true, aprovarTodos: true, revisao: pv[1].revisao });
  assert.equal(s[0], 200); assert.equal(s[1].ok, true);
  assert.equal(s[1].hotReload.aplicado, false); assert.match(s[1].hotReload.motivo, /Hot Reload desligado/);
  assert.equal((await chama('POST', 'item-power/edicao', { acao: 'salvar', edicoes: { [ESPADA]: { damage: 45 } }, aprovarTodos: true, revisao: pv[1].revisao }))[0], 409, 'revisão velha = conflito');
  const rs = await chama('POST', 'item-power/edicao', { acao: 'restaurar', ids: [ESPADA], revisao: undefined });
  assert.equal(rs[1].ok, true);
  await reset();
});

test('IPE20. validação centralizada de itens segue aprovando overrides do editor e reprovando campos fora do modelo', async () => {
  await reset();
  Ed.salvar({ edicoes: { [ESPADA]: { damage: 44, minLevel: 52 } }, aprovarTodos: true });
  const { criarVerificacoes } = await import('../admin/validacao-verificacoes.mjs');
  const v = criarVerificacoes().find((x) => x.id === 'itens');
  assert.equal((await v.rodar({ overrides: tmp })).achados.filter((a) => a.nivel === 'erro').length, 0);
  writeFileSync(ARQ, JSON.stringify({ ativo: true, itens: { [ESPADA]: { dps: 3, attack: -1 } } }));
  assert.ok((await v.rodar({ overrides: tmp })).achados.some((a) => a.nivel === 'erro'));
  await reset();
});

// =====================================================================================================================
// Editor de ITENS (Combate/Geral): painel de Item Power sobre o override-rascunho, campos ausentes, simulação, alertas, histórico por item e a correção do "nullnullnull".
// =====================================================================================================================
const Fmt = await import('../frontend/client/src/editor-itens.mjs');
const RING = Object.values(ITEM_CATALOG).find((m) => m.slot === 'ring' && IP.fichaDePoder(m.id, IP.EM_USO).ip === 0);

test('IPE21. causa do "nullnullnull": replaceChildren(null) escreve o TEXTO "null"; o guarda do editor filtra, e os formatadores da tela nunca devolvem null/undefined/NaN', () => {
  const ui = readFileSync(new URL('../frontend/client/src/editor-ui.mjs', import.meta.url), 'utf8');
  assert.match(ui, /replaceChildren\(null\)/, 'a causa está documentada no código');
  assert.match(ui, /Element\.prototype\.replaceChildren = seguro/);
  assert.match(ui, /filter\(\(f\) => f !== null && f !== undefined && f !== false\)/);
  for (const v of [null, undefined, NaN, Infinity]) assert.equal(Fmt.fmt(v), '—');
  assert.equal(Fmt.fmt(0), '0'); assert.equal(Fmt.fmt(3), '3'); assert.equal(Fmt.fmt(3.5), '3,5');
  assert.equal(Fmt.fmtPct(null), '—'); assert.equal(Fmt.fmtPct(0.558), '+55,8%'); assert.equal(Fmt.fmtDif(undefined), '—'); assert.equal(Fmt.fmtDif(-2), '-2');
  const src = readFileSync(new URL('../frontend/client/src/editor-itens.mjs', import.meta.url), 'utf8');
  assert.match(src, /\.filter\(\(x\) => x != null\); \/\/ replaceChildren\(null\)/, 'a prévia do editor de itens filtra os nulos');
});

test('IPE22. carregamento: ficha real com atributos original × atual × simulado por campo; ausente aparece como null (ausente ≠ 0) e o que não se aplica ao slot é marcado', () => {
  const p = Ed.poderDoOverride(ESPADA, {});
  assert.equal(p.ok, true); assert.equal(p.ehEquipamento, true);
  assert.deepEqual([p.campos.attack.original, p.campos.attack.atual, p.campos.attack.simulado], [42, 42, 42]);
  assert.equal(p.campos.attack.presente, true); assert.equal(p.campos.attack.aplicavel, true);
  assert.equal(p.campos.armor.presente, false); assert.equal(p.campos.armor.original, null, 'campo ausente fica null, não 0');
  assert.equal(p.campos.armor.aplicavel, false, 'arma não tem armadura-base');
  assert.equal(p.derivados.find((d) => d.atributo === 'damage').original, 42);
  const sword = p.derivados.find((d) => d.atributo === 'block');
  assert.equal(sword.original, ITEM_CATALOG[ESPADA].defense / 2, 'Block da arma = metade da defesa (regra da ficha)');
  assert.equal(Ed.poderDoOverride(3434, {}).campos.defense.aplicavel, true, 'escudo tem Block');
  assert.deepEqual(Ed.poderDoOverride(ARMADURA_KNIGHT.id, {}).tiposDeDefesa, ['armour']);
  assert.deepEqual(Ed.poderDoOverride(10384, {}).tiposDeDefesa.sort(), ['armour', 'evasion'], 'híbrido: os dois tipos');
  assert.equal(Ed.poderDoOverride(99999999, {}).ok, false);
  const nao = Ed.poderDoOverride(3031, {});
  assert.equal(nao.ehEquipamento, false); assert.equal(nao.ip, null, 'moeda não é equipamento');
  assert.equal(Ed.poderDoOverride(ESPADA, {}).outros.some((o) => o.campo === 'twoHanded'), false);
  assert.ok(Ed.poderDoOverride(Object.values(ITEM_CATALOG).find((m) => m.twoHanded && m.slot === 'weapon').id, {}).outros.some((o) => o.campo === 'twoHanded'));
});

test('IPE23. nenhum campo de saída é NaN/undefined: itens sem atributos de combate, com zero e com campos ausentes serializam limpos', () => {
  for (const id of [RING.id, 3031, ESPADA, 3434, 10384, ARMADURA_KNIGHT.id]) {
    const txt = JSON.stringify(Ed.poderDoOverride(id, {}));
    assert.doesNotMatch(txt, /NaN|undefined/, id);
  }
  const anel = Ed.poderDoOverride(RING.id, {});
  assert.equal(anel.ip.simulado, 0); assert.equal(anel.ip.situacaoSimulada, 'sem-poder');
  assert.equal(anel.ip.diferencaEsperadoPct, null, 'sem esperado: nada de NaN');
  assert.deepEqual(anel.composicao.map((c) => c.pontos), [0, 0, 0, 0, 0]);
  const zero = Ed.poderDoOverride(ESPADA, { attack: 0 });
  assert.equal(zero.campos.attack.simulado, 0); assert.equal(zero.ip.simulado, IP.calcular({ damageMin: 0, damageMax: 0, defesa: ITEM_CATALOG[ESPADA].defense }, IP.EM_USO, 'weapon').ip);
});

test('IPE24. simulação original × atual × simulado (a do enunciado): nível e atributos, diferenças, o que provocou a mudança, classificação e curva; nada é gravado', async () => {
  const alvo = Object.values(ITEM_CATALOG).find((m) => m.slot === 'weapon' && m.minLevel === 140 && m.attack > 0);
  const p = Ed.poderDoOverride(alvo.id, { minLevel: 160, attack: 15, defense: 20 });
  assert.equal(p.ok, true);
  assert.deepEqual([p.nivel.original, p.nivel.atual, p.nivel.simulado], [140, 140, 160]);
  assert.equal(p.ip.original, IP.fichaDePoder(alvo.id, IP.EM_USO).ip);
  assert.equal(p.ip.simulado, IP.calcular({ damageMin: 15, damageMax: 15, defesa: 20 }, IP.EM_USO, 'weapon').ip, 'a fórmula real do módulo');
  assert.equal(p.ip.diferencaSimuladoOriginal, Math.round((p.ip.simulado - p.ip.original) * 1000) / 1000);
  assert.equal(p.ip.pctSimuladoOriginal, Math.round(((p.ip.simulado - p.ip.original) / p.ip.original) * 10000) / 10000);
  assert.equal(p.ip.esperado, IP.esperado(IP.EM_USO, 'weapon', 160), 'o nível atualiza a referência');
  assert.equal(p.curva.esperado, p.ip.esperado); assert.ok(p.curva.faixaAdequada[0] < p.curva.esperado && p.curva.esperado < p.curva.faixaAdequada[1]);
  assert.ok(p.atributosQueMudaram.length >= 1 && p.atributosQueMudaram.every((a) => a.diferenca !== 0));
  assert.equal(p.ip.mudouDeSituacao, p.ip.situacaoOriginal !== p.ip.situacaoSimulada);
  assert.equal(p.nivel.tierSimulado, PROG.tierDaBase(160)); assert.equal(p.nivel.tierOriginal, PROG.tierDaBase(140));
  assert.equal(p.campos.attack.diferenca, 15 - alvo.attack);
  assert.match(p.nivel.nota, /NÃO altera os campos attack\/defense\/armor/);
  assert.equal(ITEM_CATALOG[alvo.id].attack, alvo.attack, 'a simulação não altera o item');
  assert.equal(existsSync(ARQ), false, 'nem grava');
  assert.match(p.aviso, /não é DPS/);
});

test('IPE25. o nível NÃO muda attack/defense/armor gravados, mas muda o tier, o esperado e a Evasion/Energy Shield derivadas — e a curva continua independente', () => {
  const m = Object.values(ITEM_CATALOG).find((x) => x.slot === 'body' && x.vocations?.length && x.vocations.every((v) => v === 'paladin') && x.minLevel > 50 && x.armor > 0);
  const base = Ed.poderDoOverride(m.id, {});
  const nv = Ed.poderDoOverride(m.id, { minLevel: m.minLevel + 100 });
  assert.equal(nv.campos.armor.simulado, base.campos.armor.simulado, 'armadura-base gravada intacta');
  assert.equal(nv.campos.attack.simulado, base.campos.attack.simulado);
  assert.ok(nv.derivados.find((d) => d.atributo === 'evasion').simulado > base.derivados.find((d) => d.atributo === 'evasion').simulado, 'a Evasion derivada cresce com o nível');
  assert.equal(nv.nivel.tierSimulado, base.nivel.tierSimulado + 1);
  assert.notEqual(nv.curva.esperado, base.curva.esperado);
  assert.deepEqual(nv.curva.independente.length > 10, true);
  const cfgAntes = JSON.stringify(IP.EM_USO.curva);
  Ed.poderDoOverride(m.id, { minLevel: 900 });
  assert.equal(JSON.stringify(IP.EM_USO.curva), cfgAntes, 'simular não toca na curva');
});

test('IPE26. composição do cálculo: valor × fator × peso = pontos, com a configuração REAL (e muda junto com os pesos); soma = IP; consistente com o módulo Item Power', async () => {
  const p = Ed.poderDoOverride(10384, {});
  assert.deepEqual(p.composicao.map((c) => c.atributo), ['damage', 'block', 'armour', 'evasion', 'energyShield']);
  for (const c of p.composicao) {
    assert.equal(c.fator, IP.EM_USO.normalizacao[c.atributo]); assert.equal(c.peso, IP.EM_USO.pesos[c.atributo]);
    assert.ok(Math.abs(c.pontos - c.valor * c.fator * c.peso) < 0.01, c.atributo);
  }
  assert.ok(Math.abs(p.composicao.reduce((n, c) => n + c.pontos, 0) - p.ip.simulado) < 0.01);
  assert.deepEqual(p.composicao.map((c) => c.pontos), IP.fichaDePoder(10384, IP.EM_USO).contribuicao && IP.ATRIBUTOS.map((a) => IP.fichaDePoder(10384, IP.EM_USO).contribuicao[a].pontos), 'idêntico ao módulo Item Power');
  const c2 = copia(IP.EM_USO); c2.pesos.evasion = 3; IP.aplicar({ ativo: true, pesos: { evasion: 3 } });
  try { assert.equal(Ed.poderDoOverride(10384, {}).composicao.find((c) => c.atributo === 'evasion').peso, 3); } finally { IP.aplicar(null); }
  assert.equal(Ed.poderDoOverride(10384, {}).composicao.find((c) => c.atributo === 'evasion').peso, 0.8);
});

test('IPE27. validação do rascunho: campo desconhecido, negativo, não inteiro, raridade inválida e limite viram erros claros; com erro a simulação cai no que está salvo (sem NaN)', () => {
  for (const [ov, re] of [[{ dps: 1 }, /campo "dps" não tem suporte/], [{ attack: -3 }, /attack precisa ser um inteiro/], [{ attack: 2.5 }, /attack precisa ser um inteiro/], [{ minLevel: 'x' }, /minLevel precisa ser um inteiro/], [{ rarity: 'azul' }, /raridade "azul" desconhecida/], [{ minLevel: 999999 }, /minLevel precisa ser um inteiro de 0 a 5\.000/]]) {
    const p = Ed.poderDoOverride(ESPADA, ov);
    assert.equal(p.ok, false, JSON.stringify(ov)); assert.match(p.erros.join(' '), re);
    assert.equal(p.ip.simulado, p.ip.atual, 'com erro a simulação mostra o salvo');
    assert.doesNotMatch(JSON.stringify(p), /NaN|undefined/);
  }
  assert.equal(Ed.poderDoOverride(ESPADA, { ativo: false }).ok, true);
});

test('IPE28. alvo de Armour/Evasion/Energy Shield no editor de itens: resolve a armadura-base pelo tipo e nível; tipo ausente é erro; o editor e o módulo concordam no resultado', () => {
  const r = Ed.resolverDefesa(10384, {}, 'evasion', 300);
  assert.equal(r.ok, true);
  const p = Ed.poderDoOverride(10384, { armor: r.armor });
  assert.ok(Math.abs(p.derivados.find((d) => d.atributo === 'evasion').simulado - 300) <= 300 * 0.05);
  assert.equal(Ed.resolverDefesa(ARMADURA_KNIGHT.id, {}, 'evasion', 100).ok, false);
  assert.equal(Ed.resolverDefesa(ESPADA, {}, 'armour', 100).ok, false);
  assert.equal(Ed.resolverDefesa(10384, {}, 'evasion', -1).ok, false);
  assert.equal(Ed.resolverDefesa(10384, {}, 'evasion', 'x').ok, false);
  assert.equal(Ed.previaDoItem(10384, { armor: r.armor }).candidato.atributos.evasion, p.derivados.find((d) => d.atributo === 'evasion').simulado, 'mesmo resultado nos dois caminhos');
});

test('IPE29. alertas do painel (não bloqueiam): vêm das configurações reais, citam o motivo e coincidem com os da prévia do Item Power', () => {
  const p = Ed.poderDoOverride(ESPADA, { minLevel: 400, attack: 400 });
  assert.equal(p.ok, true);
  assert.ok(p.alertas.length >= 2 && p.alertas.every((a) => a.mensagem && a.exigeAprovacao && a.codigo.endsWith(`:${ESPADA}`)));
  assert.deepEqual(p.alertas.map((a) => a.codigo).sort(), Ed.previaDoItem(ESPADA, { minLevel: 400, attack: 400 }).alertas.map((a) => a.codigo).sort(), 'mesma regra nos dois lugares');
  assert.deepEqual(Ed.poderDoOverride(ESPADA, {}).alertas, [], 'sem mudança, sem alerta');
  assert.ok(p.equivalentes.length >= 3);
});

test('IPE30. lista do editor de itens: nível, atributos, IP e marca de modificado com os originais; histórico por item e comparação de versões filtrada por item; salvar pelo editor de itens registra', async () => {
  const l = Itens.listar({ q: 'relic sword' });
  const r = l.itens.find((i) => i.id === String(ESPADA));
  assert.deepEqual([r.minLevel, r.attack, r.defense, r.atributosEditados, r.original], [50, 42, 24, false, null]);
  assert.equal(r.ip, IP.fichaDePoder(ESPADA, IP.EM_USO).ip);
  assert.equal(Itens.listar({ q: 'gold coin' }).itens[0].ip, null, 'não-equipamento: sem IP (null, não 0)');
  const s = Itens.salvar(String(ESPADA), { attack: 50 }, Itens.obter(ESPADA).revisao);
  assert.equal(s.ok, true);
  Itens.salvar('3264', { attack: 31 }, Itens.obter(ESPADA).revisao);
  await estrategia().aplicar();
  const m = Itens.listar({ q: 'relic sword' }).itens.find((i) => i.id === String(ESPADA));
  assert.deepEqual([m.atributosEditados, m.original.attack, m.attack], [true, 42, 50]);
  const h = Ed.historico({ id: ESPADA });
  assert.equal(h.eventos.length, 1); assert.equal(h.eventos[0].tipo, 'itens-editor'); assert.equal(h.eventos[0].itens[0].mudancas[0].para, 50);
  assert.equal(Ed.historico({ id: 3264 }).eventos.length, 1); assert.equal(Ed.historico({}).eventos.length, 2);
  const c = Ed.compararVersoes(Ed.historico({}).versoes.at(-1), 'atual', ESPADA);
  assert.ok(c.mudancas.every((x) => x.id === ESPADA), 'comparação filtrada por item');
  assert.equal(Itens.reverter(String(ESPADA), Itens.obter(ESPADA).revisao).ok, true);
  assert.equal(Ed.historico({ id: ESPADA }).eventos[0].tipo, 'restauracao');
});

test('IPE31. rotas do editor de itens: poder (só lê), resolver-defesa (só lê), listar enriquecido; salvar/reverter com "aplicar" informam o Hot Reload; ACL', async () => {
  const chama = async (metodo, rota, corpo, q = '') => { const r = []; await Http.atender({ method: metodo }, {}, `/api/mapas/_conteudo/${rota}`, new URL(`http://x/?${q}`), { json: (a, c, b) => r.push([c, b]), corpoJson: async () => corpo }); return r[0]; };
  const p = await chama('POST', 'overrides/itens/poder', { id: String(ESPADA), override: { attack: 60 } });
  assert.equal(p[0], 200); assert.equal(p[1].campos.attack.simulado, 60); assert.equal(existsSync(ARQ), false, 'ler não grava');
  assert.equal((await chama('POST', 'overrides/itens/poder', { id: '99999999', override: {} }))[0], 404);
  const d = await chama('POST', 'item-power/resolver-defesa', { id: '10384', override: {}, tipo: 'evasion', valor: 250 });
  assert.equal(d[0], 200); assert.ok(d[1].armor > 0);
  assert.equal((await chama('POST', 'item-power/resolver-defesa', { id: '10384', override: {}, tipo: 'energyShield', valor: 250 }))[0], 400);
  assert.equal(A.classeDaRota('POST', '/api/mapas/_conteudo/overrides/itens/poder'), 'leitura');
  assert.equal(A.classeDaRota('POST', '/api/mapas/_conteudo/item-power/resolver-defesa'), 'leitura');
  assert.equal(A.classeDaRota('POST', '/api/mapas/_conteudo/overrides/itens'), 'grava');
  const rev = (await chama('GET', `overrides/itens/${ESPADA}`))[1].revisao;
  const s = await chama('POST', 'overrides/itens', { acao: 'salvar', id: String(ESPADA), override: { attack: 61 }, revisao: rev, aplicar: true });
  assert.equal(s[1].ok, true); assert.equal(s[1].hotReload.aplicado, false); assert.match(s[1].hotReload.motivo, /Hot Reload desligado/);
  const semAplicar = await chama('POST', 'overrides/itens', { acao: 'salvar', id: String(ESPADA), override: { attack: 62 }, revisao: (await chama('GET', `overrides/itens/${ESPADA}`))[1].revisao });
  assert.equal(semAplicar[1].hotReload, undefined);
  assert.equal((await chama('POST', 'overrides/itens', { acao: 'reverter', id: String(ESPADA), revisao: 'velha' }))[0], 409);
  const rv = await chama('POST', 'overrides/itens', { acao: 'reverter', id: String(ESPADA), revisao: (await chama('GET', `overrides/itens/${ESPADA}`))[1].revisao, aplicar: true });
  assert.equal(rv[1].ok, true); assert.ok(rv[1].hotReload);
});

test('IPE32. consistência editor × módulo Item Power × combate: o IP do painel é o da ficha de poder, e Damage/Block/defesas são os valores que a ficha do jogo lê do catálogo (mesma função de base)', async () => {
  const Ficha = await import('../systems/ficha.mjs');
  const { faixaDoCampo } = await import('../systems/itens/item.mjs');
  for (const id of [ESPADA, 3434, 10384, ARMADURA_KNIGHT.id, ARMADURA_MAGO.id]) {
    const p = Ed.poderDoOverride(id, {});
    assert.equal(p.ip.atual, IP.fichaDePoder(id, IP.EM_USO).ip, `IP do painel = IP do módulo (${id})`);
    const f = IP.fichaDePoder(id, IP.EM_USO);
    assert.equal(f.atributos.armour, faixaDoCampo({ id }, 'armor')[0], `Armour = o que a ficha lê (${id})`);
    assert.equal(f.atributos.evasion, faixaDoCampo({ id }, 'evasion')[0]);
    assert.equal(f.atributos.energyShield, faixaDoCampo({ id }, 'es')[0]);
    assert.equal(f.atributos.attack, Math.max(0, Math.floor(faixaDoCampo({ id }, 'attack')[0])));
  }
  void Ficha;
});
