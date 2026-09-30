// O FILTRO DE LOOT com a lógica nova (pedido do dono, 30/09): uma decisão só
// (`Afixos.decisaoDoLoot`), na ordem — listas por item → valor próprio → regras
// específicas (a primeira que bate) → atributos do item → sockets → raridade →
// vende. Atributos, sockets e raridade valem com OU; a raridade não decide
// sozinha quando há regra de atributo. Os atributos são os REAIS da peça.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Afixos from '../systems/afixos.mjs';
import * as Bolsa from '../systems/bolsa.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Treino from '../systems/treino.mjs';
import * as FiltroDaConta from '../systems/filtro-da-conta.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import { personagemDeTeste, PERSONAGEM } from './apoio.mjs';

const PECA = Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'leather helmet').id);
const ATRS = ['hp_max', 'mana_max', 'crit_chance', 'crit_dmg', 'atk_speed', 'fire_dmg'];
const peca = (raridade, ...niveis) => ({ id: PECA, count: 1, raridade, af: niveis.map((nivel, i) => ({ id: ATRS[i], nivel, value: 1 })) });
function quem(settings = {}, extra = {}) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 100 });
  Bolsa.garantir(e);
  e.settings = { ...settings };
  Object.assign(e, extra);
  return e;
}
const decide = (e, p) => Afixos.decisaoDoLoot(e, p).acao;

test('padrão: Comum com 0 atributos VENDE; Comum com 1+ atributo NÃO VENDE', () => {
  const e = quem();
  assert.equal(decide(e, peca('comum')), 'vender');
  assert.equal(decide(e, peca('comum', 1)), 'naoVender');
  assert.equal(decide(e, peca('comum', 1, 1)), 'naoVender');
});

test('o exemplo do dono: COMUM/INCOMUM 0 atr → vende, 1+ → não vende; RARO+ → não vende (mesmo sem atributo)', () => {
  const e = quem({ guardarAtributos: 1, guardarNivelMinimo: 1, guardarRaridade: 2 });
  assert.equal(decide(e, peca('comum')), 'vender');
  assert.equal(decide(e, peca('comum', 1)), 'naoVender');
  assert.equal(decide(e, peca('incomum')), 'vender');
  assert.equal(decide(e, peca('incomum', 2)), 'naoVender');
  for (const r of ['raro', 'épico', 'lendário', 'mítico']) assert.equal(decide(e, peca(r)), 'naoVender', r);
});

test('"Qualquer raridade + 2+ atributos + 1 atributo N3+ → não vender"', () => {
  const e = quem({ guardarAtributos: 2, guardarNivelMinimo: 3, guardarRaridade: 0 });
  assert.equal(decide(e, peca('comum', 1, 3)), 'naoVender', 'comum com 2 atributos, um N3');
  assert.equal(decide(e, peca('raro', 2, 2)), 'vender', '2 atributos, nenhum N3+');
  assert.equal(decide(e, peca('lendário', 5)), 'vender', 'só 1 atributo');
  assert.equal(decide(e, peca('raro')), 'vender', 'raro sem atributo: a raridade não está ligada');
});

test('a raridade não decide sozinha: Comum + 2 atributos bons fica, mesmo com "Raro para cima"', () => {
  const e = quem({ guardarAtributos: 2, guardarNivelMinimo: 3, guardarRaridade: 2 });
  assert.equal(decide(e, peca('comum', 4, 4)), 'naoVender');
  assert.equal(decide(e, peca('raro')), 'naoVender', 'e o raro sem atributo fica pela raridade');
  assert.equal(Afixos.decisaoDoLoot(e, peca('comum', 4, 4)).motivo, 'atributos do item');
});

test('regras específicas com OU: "Raro+ OU 2+ atributos OU atributo N4+" → não vender', () => {
  const e = quem({ guardarAtributos: 0 }, {
    lootRegras: [
      { raridade: 'raro', acima: true, quantos: null, nivel: 1, acao: 'naoVender' },
      { raridade: null, quantos: 2, nivel: 1, acao: 'naoVender' },
      { raridade: null, quantos: 1, nivel: 4, acao: 'naoVender' },
    ].map(Afixos.sanearRegraDeLoot),
  });
  assert.equal(decide(e, peca('raro')), 'naoVender');
  assert.equal(decide(e, peca('comum', 1, 1)), 'naoVender');
  assert.equal(decide(e, peca('incomum', 4)), 'naoVender');
  assert.equal(decide(e, peca('incomum', 3)), 'vender');
  assert.equal(decide(e, peca('comum')), 'vender');
});

test('regra específica com E: "Comum E 1+ atributo E um atributo N3+" (raridade exata)', () => {
  const e = quem({ guardarAtributos: 0 }, { lootRegras: [Afixos.sanearRegraDeLoot({ raridade: 'comum', quantos: 1, nivel: 3, acao: 'naoVender' })] });
  assert.equal(decide(e, peca('comum', 3)), 'naoVender');
  assert.equal(decide(e, peca('comum', 2)), 'vender', 'N2 não basta');
  assert.equal(decide(e, peca('incomum', 3)), 'vender', 'não é comum (exata)');
});

test('"0 atributos" numa regra é "SEM atributo" (e não "qualquer")', () => {
  const r = Afixos.sanearRegraDeLoot({ raridade: 'comum', quantos: 0, acao: 'naoColetar' });
  assert.equal(Afixos.regraBate(r, peca('comum')), true);
  assert.equal(Afixos.regraBate(r, peca('comum', 1)), false);
  const qualquer = Afixos.sanearRegraDeLoot({ raridade: 'comum', quantos: null });
  assert.equal(Afixos.regraBate(qualquer, peca('comum', 1)), true);
});

test('precedência: "Não coletar" (lista) > "Não vender" (lista) > regra específica > atributos > raridade', () => {
  const rNaoColeta = Afixos.sanearRegraDeLoot({ raridade: null, quantos: null, acao: 'naoColetar' });
  let e = quem({ guardarAtributos: 1, guardarRaridade: 1 }, { itemRules: { noLoot: [PECA], noSell: [PECA], soAfixo: [] }, lootRegras: [] });
  assert.equal(decide(e, peca('mítico', 5)), 'naoColetar', 'a lista "Não coletar" vem primeiro');
  e = quem({ guardarAtributos: 1 }, { itemRules: { noLoot: [], noSell: [PECA], soAfixo: [] }, lootRegras: [rNaoColeta] });
  assert.equal(decide(e, peca('comum')), 'naoVender', '"Não vender" (lista) vence a regra de não coletar');
  e = quem({ guardarAtributos: 1 }, { lootRegras: [rNaoColeta] });
  assert.equal(decide(e, peca('raro', 3, 3)), 'naoColetar', 'regra específica vence a seção de atributos');
  // A primeira regra que bate decide.
  e = quem({}, { lootRegras: [Afixos.sanearRegraDeLoot({ quantos: 1, acao: 'naoVender' }), rNaoColeta] });
  assert.equal(decide(e, peca('comum', 1)), 'naoVender');
  assert.equal(decide(e, peca('comum')), 'naoColetar');
  // Regra desligada não vale.
  e = quem({ guardarAtributos: 0 }, { lootRegras: [{ ...rNaoColeta, ativa: false }] });
  assert.equal(decide(e, peca('comum')), 'vender');
});

test('valor próprio (tier, imbuement, gema encaixada) fica sempre, antes das regras', () => {
  const e = quem({ guardarAtributos: 0 }, { lootRegras: [Afixos.sanearRegraDeLoot({ acao: 'naoColetar' })] });
  assert.equal(decide(e, { ...peca('comum'), tier: 1 }), 'naoVender');
  assert.equal(decide(e, { ...peca('comum'), soquetes: { abertos: 1, links: [], gemas: [{ id: 1 }] } }), 'naoVender');
});

test('atributos REAIS: valor 0, nulo, NaN ou id desconhecido não contam', () => {
  const base = { id: PECA, count: 1, raridade: 'comum' };
  const invalidos = [{ id: 'crit_chance', value: 0 }, { id: 'crit_dmg', value: null }, { id: 'fire_dmg', value: 'abc' }, { id: 'nao_existe', value: 5 }, null];
  assert.equal(Afixos.atributosReais({ ...base, af: invalidos }).length, 0);
  assert.equal(decide(quem(), { ...base, af: invalidos }), 'vender', 'comum com atributos inválidos vende');
  assert.equal(Afixos.atributosReais({ ...base, af: [...invalidos, { id: 'crit_chance', value: 1.5 }] }).length, 1);
  // Genérico: qualquer atributo do catálogo conta, sem lista fixa.
  for (const id of Object.keys(Afixos.FICHAS)) assert.equal(Afixos.atributosReais({ ...base, af: [{ id, value: 1 }] }).length, 1, id);
});

test('regra de "não coletar" só vale para equipamento (poção e produto de bicho não somem)', () => {
  const pocao = Number(Object.values(ITEM_CATALOG).find((i) => i.stackable && /potion/i.test(i.name)).id);
  const r = Afixos.sanearRegraDeLoot({ raridade: 'comum', quantos: 0, acao: 'naoColetar' });
  assert.equal(Afixos.regraBate(r, { id: pocao, count: 1 }), false);
});

test('caçando: "Comum sem atributo → não coletar" deixa essas peças no chão e coleta o resto', () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 120 });
  Treino.garantir(e);
  Bolsa.garantir(e);
  e.settings = { ...e.settings, autoSellPouch: false };
  assert.equal(Bolsa.definirRegrasDeLoot(e, { regras: [{ raridade: 'comum', quantos: 0, acao: 'naoColetar' }] }).ok, true);
  assert.ok(Cacadas.entrar(e, { huntId: 'troll-cave', mode: 'auto' }).ok);
  let t = Date.now();
  for (let i = 0; i < 240 * 6; i++) {
    t += 250;
    Cacadas.tique(e, PERSONAGEM, t);
    if (e.hp <= 0) e.hp = e.maxHp;
  }
  const equipamentos = e.pouch.filter((p) => Afixos.aceitaAfixo(p.id));
  assert.ok(equipamentos.length > 0, 'coletou equipamento com atributo');
  for (const p of equipamentos) assert.ok(p.raridade !== 'comum' || Afixos.atributosReais(p).length > 0, `${ITEM_CATALOG[p.id].name} comum sem atributo não devia estar na bolsa`);
  assert.ok(Object.values(e.hunt.sessao.itens.ignorado ?? {}).reduce((a, b) => a + b, 0) > 0, 'deixou peça no chão');
  assert.ok(e.pouch.some((p) => !Afixos.aceitaAfixo(p.id)), 'o que não é equipamento continua sendo coletado');
});

test('regras vindas do cliente são limpas; mais de 12 não entram', () => {
  const e = quem();
  Bolsa.definirRegrasDeLoot(e, { regras: [{ raridade: 'xyz', quantos: '9', nivel: 99, acao: 'apagar' }, 'lixo', ...Array(20).fill({ quantos: 1 })] });
  assert.equal(e.lootRegras.length, 11, '12 no máximo, e o lixo sai');
  assert.deepEqual(e.lootRegras[0], { raridade: null, acima: false, quantos: 6, nivel: 5, acao: 'naoVender', ativa: true });
  assert.equal(Bolsa.definirRegrasDeLoot(e, { regras: 'x' }).ok, false);
});

test('a prévia da tela usa a mesma decisão, e o filtro da conta leva as regras', () => {
  const e = quem({ guardarAtributos: 1, guardarRaridade: 2 });
  const previa = Afixos.previaDoFiltro(e);
  const linha = (rotulo) => previa.find((l) => l.rotulo === rotulo);
  assert.equal(linha('Comum, 0 atributos').acao, 'vender');
  assert.equal(linha('Comum, 1 atributo N1').acao, 'naoVender');
  assert.equal(linha('Raro, 0 atributos').acao, 'naoVender');
  e.lootRegras = [Afixos.sanearRegraDeLoot({ quantos: 3, acao: 'naoVender' })];
  const b = quem();
  FiltroDaConta.aplicar(b, FiltroDaConta.copia(e));
  assert.deepEqual(b.lootRegras, e.lootRegras);
  assert.equal(b.settings.guardarAtributos, 1);
  assert.equal(FiltroDaConta.mudaOFiltro({ t: 'lootRegras', regras: [] }), true);
});

test('as regras de antes continuam valendo (guardarNivel/guardarQuantos viram quantidade + nível)', () => {
  assert.deepEqual(Afixos.regraDeAtributos({}), { quantos: 1, nivel: 1 }, 'padrão: qualquer atributo');
  assert.deepEqual(Afixos.regraDeAtributos({ guardarNivel: 0 }), { quantos: 0, nivel: 1 }, '"Não olhar"');
  assert.deepEqual(Afixos.regraDeAtributos({ guardarNivel: 3, guardarQuantos: 2 }), { quantos: 2, nivel: 3 });
  assert.deepEqual(Afixos.regraDeAtributos({ guardarNivel: 3, guardarAtributos: 4, guardarNivelMinimo: 2 }), { quantos: 4, nivel: 2 }, 'a regra nova manda');
});
