// (07/11, lote 25 das inertes — o dono: "Fazer todos") as GEMAS CORROMPIDAS (o Orbe Vaal na gema; a Pele dos Lordes só as aceita, e a keystone sorteada dela), o CICLO
// DA FOME (consome o suporte que chega ao máximo), a VÁLVULA DA FÚRIA (os projéteis a mais viram a divisão) e o SUSSURRO SERPENTEANTE (as almas pelo Feitiço).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Moedas = await import('../systems/itens-poe/moedas.mjs');
const GemasPoe = await import('../systems/itens-poe/gemas-poe.mjs');
const SP = await import('../systems/itens-poe/suportes-poe.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');
const await_acoes = await import('../systems/acoes.mjs');

if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
}

const tr = (modelo, valores = []) => T.traduzirMod({ modelo, valores });
const peca = (base, extra = {}) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 70, rng: () => 0.5, ...extra }));
const comLinhas = (p, linhas) => {
  const af = { ...(p.poe.af ?? {}) };
  for (const [m, v] of linhas) for (const x of tr(m, v ?? []).efeitos) af[x.stat] = (af[x.stat] ?? 0) + Number(x.valor);
  p.poe.af = af;
  return p;
};
const sequencia = (...xs) => { let i = 0; return () => xs[Math.min(i++, xs.length - 1)]; };
function personagem() {
  const e = Object.assign(personagemDeTeste({ vocacao: 'sorcerer', level: 90 }), { classePoe: 'Witch', sistema: 'poe' });
  Ficha.invalidar(e);
  return e;
}

test('as linhas saem com efeito', { skip: SEM }, () => {
  for (const [m, v] of [['Você só pode Encaixar Gemas Corrompidas neste item'], ['Pode Consumir {0} Gemas de Suporte Não Corrompidas', [4]], ['Modificadores do número de Projéteis são aplicados ao número de alvos nos quais os Projéteis Partidos se focam ao invés'], ['Quando {0}% da duração do seu feitiço expira em um inimigo, consome {1} alma por cada poder dele', [90, 1]], ['[Six Linked]']]) {
    assert.ok(!['inerte', 'registrado'].includes(tr(m, v ?? []).estado), m);
  }
});

test('o ORBE VAAL na gema: corrompe (+1 nível, a versão Vaal…); a corrompida não aceita moeda; a PELE DOS LORDES só aceita corrompida', { skip: SEM }, () => {
  const e = personagem();
  const vaal = Moedas.idDa('Vaal_Orb');
  e.inventory = [GS.itemDaGema({ id: GemasPoe.doSlug('Fireball').itemId, nivel: 10, xp: 0, raridade: 'comum' }), { id: vaal, count: 5 }];
  assert.ok(Moedas.usar(e, { moeda: vaal, alvo: { indice: 0 } }, sequencia(0.3, 0.2)).ok);
  assert.equal(e.inventory[0].gema.corrompida, true);
  assert.equal(e.inventory[0].gema.nivel, 11, '+1 nível');
  assert.equal(Moedas.usar(e, { moeda: vaal, alvo: { indice: 0 } }, () => 0).ok, false, 'já corrompida');
  e.inventory.unshift(GS.itemDaGema({ id: GemasPoe.doSlug('Fireball').itemId, nivel: 10, xp: 0, raridade: 'comum' }));
  assert.ok(Moedas.usar(e, { moeda: vaal, alvo: { indice: 0 } }, () => 0.9).ok);
  assert.equal(GS.defDaGema(e.inventory[0].id)?.poe?.slug, 'Vaal_Fireball', 'a versão Vaal');
  // a Pele dos Lordes
  const pele = comLinhas(peca('Body_Armours/Simple_Robe'), [['Você só pode Encaixar Gemas Corrompidas neste item']]);
  pele.soquetes = { abertos: 2, links: [true], gemas: [null, null], cores: ['W', 'W'] };
  e.equipment = { ...e.equipment, body: pele };
  e.inventory = [GS.itemDaGema({ id: GemasPoe.doSlug('Fireball').itemId, nivel: 1, xp: 0, raridade: 'comum' }), { ...GS.itemDaGema({ id: GemasPoe.doSlug('Fireball').itemId, nivel: 1, xp: 0, raridade: 'comum' }), gema: { nivel: 1, xp: 0, corrompida: true } }];
  assert.equal(GS.encaixar(e, { de: 0, slot: 'body', indice: 0 }).ok, false);
  assert.ok(GS.encaixar(e, { de: 1, slot: 'body', indice: 0 }).ok);
});

test('o [Random Keystone] da Pele dos Lordes: uma keystone sorteada na peça, com os efeitos dela', { skip: SEM }, () => {
  const p = peca('Body_Armours/Simple_Robe', { raridade: 'unico', unico: 'Skin_of_the_Lords' });
  assert.ok(p.poe.keystoneSorteada && p.poe.keystoneNome, JSON.stringify(Object.keys(p.poe)));
  const p2 = J.pecaDoJogo({ ...gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Body_Armours/Simple_Robe', raridade: 'unico', ilvl: 70, rng: () => 0.5, unico: 'Skin_of_the_Lords' }), keystoneSorteada: p.poe.keystoneSorteada });
  assert.equal(p2.poe.keystoneSorteada, p.poe.keystoneSorteada, 'a mesma keystone ao refazer');
});

test('o CICLO DA FOME: o suporte que chega ao máximo sai do encaixe e passa a suportar a gema que for encaixada na peça', { skip: SEM }, () => {
  const e = personagem();
  const anel = comLinhas(peca('Rings/Unset_Ring'), [['Pode Consumir {0} Gemas de Suporte Não Corrompidas', [4]]]);
  anel.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
  e.equipment = { ...e.equipment, ring: anel };
  e.inventory = [GS.itemDaGema({ id: SP.doSlug('Spell_Echo_Support').itemId, nivel: 19, xp: 0, raridade: 'comum' })];
  assert.ok(GS.encaixar(e, { de: 0, slot: 'ring', indice: 0 }).ok);
  GS.ganharXp(e, 1e12);
  assert.equal(GS.soquetesDe(anel).gemas[0], null, 'o suporte saiu do encaixe');
  assert.equal(anel.poe.suportesConsumidos.length, 1);
  e.inventory = [GS.itemDaGema({ id: GemasPoe.doSlug('Fireball').itemId, nivel: 1, xp: 0, raridade: 'comum' })];
  assert.ok(GS.encaixar(e, { de: 0, slot: 'ring', indice: 0 }).ok);
  Ficha.invalidar(e);
  assert.ok(GS.skillsAtivas(e).get(GemasPoe.doSlug('Fireball').acao)?.supports.some((s) => s.def.poe?.slug === 'Spell_Echo_Support'));
});

test('o SUSSURRO SERPENTEANTE: com 90% da duração da sua maldição passados, o Raro dá 10 almas (uma vez)', { skip: SEM }, () => {
  const e = personagem();
  e.equipment = { ...e.equipment, ring: comLinhas(peca('Rings/Iron_Ring'), [['Quando {0}% da duração do seu feitiço expira em um inimigo, consome {1} alma por cada poder dele', [90, 1]]]) };
  Ficha.invalidar(e);
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  const h = e.hunt;
  h.clock = 100_000;
  ModsPoe.definirFichaDaCacada(h, () => Ficha.combate(e));
  const m = h.monstros.find((x) => !x.dummy);
  Object.assign(m, { raridade: 'raro', hp: 1000, maldicoes: { 'poe-gema:Despair': { ate: h.clock + 1000, desde: h.clock - 9000, dur: 10_000 } } });
  ModsPoe.tiqueDosAspectos(e, h, Ficha.combate(e), h.clock);
  assert.equal(ModsPoe.almasDoJogador(h, h.clock), 10);
  ModsPoe.tiqueDosAspectos(e, h, Ficha.combate(e), h.clock);
  assert.equal(ModsPoe.almasDoJogador(h, h.clock), 10, 'uma vez');
});

test('a VÁLVULA DA FÚRIA: os projéteis a mais das peças viram a divisão do projétil (sai um, que se parte)', { skip: SEM }, () => {
  const Acoes = await_acoes;
  const e = personagem();
  const arma = comLinhas(peca('Wands/Driftwood_Wand'), [['Habilidades disparam {0} Projéteis adicionais', [2]]]);
  arma.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
  e.equipment = { ...e.equipment, weapon: arma };
  e.inventory = [GS.itemDaGema({ id: GemasPoe.doSlug('Fireball').itemId, nivel: 1, xp: 0, raridade: 'comum' })];
  GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
  Ficha.invalidar(e);
  const entry = Acoes.POR_ID_PUBLICO(GemasPoe.doSlug('Fireball').acao);
  const ef = GS.efeitoNaSkill(e, entry.id) ?? {};
  const sem = Acoes.comOsAlvosDaGema(entry, ef, e);
  e.equipment.ring = comLinhas(peca('Rings/Iron_Ring'), [['Modificadores do número de Projéteis são aplicados ao número de alvos nos quais os Projéteis Partidos se focam ao invés']]);
  Ficha.invalidar(e);
  const com = Acoes.comOsAlvosDaGema(entry, ef, e);
  assert.equal((com.alvosExtras ?? 0), (sem.alvosExtras ?? 0) - 2);
  assert.equal((com.divisao ?? 0), (sem.divisao ?? 0) + 2);
});
