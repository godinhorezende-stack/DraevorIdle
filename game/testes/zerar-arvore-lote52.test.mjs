// LOTE 52 — as ÚNICAS de JOIA (J30, a terceira leva): a Canção das Chamas, a Mortalha da Tormenta e a Visão Ancestral (um modificador estendido a
// todas as Afecções Elementais em você), a Desgraça das Bruxas (imune a Maldições pelo resto do Feitiço do Amaldiçoado que você matar), a
// Harmonia Primordial (o dano do Golem por tipo de Golem convocado), o Talento Puro (o bônus de cada classe cujo início a árvore alcança) e O
// Adornado (o efeito das Joias Mágicas Corrompidas da árvore).
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
const P = await import('../systems/passivas/arvore.mjs');
const Comandos = await import('../systems/passivas/comandos.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const LacaiosPoe = await import('../systems/itens-poe/lacaios-poe.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
}

const tr = (modelo, valores = []) => T.traduzirMod({ modelo, valores });
/** A linha da única `slug` que tem `trecho` (a das que este lote trata). */
const modelo = (slug, trecho) => Catalogo.catalogo().classes.Jewels.unicos.find((x) => x.slug === slug).modificadores.find((m) => m.modelo.includes(trecho));
const anel = (af) => ({ id: Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'might ring')?.id), count: 1, af: [], poe: { af } });
const encaixes = () => P.arvore().nos.filter((n) => P.ehEncaixeDeJoia(n)).slice(0, 2).map((n) => n.id);
/** O Marauder nível 90 com os 2 primeiros encaixes de joia alocados. */
function personagem() {
  const e = personagemDeTeste({ vocacao: 'knight', level: 90 });
  e.sistema = 'poe';
  e.classePoe = 'Marauder';
  P.garantir(e);
  e.passivas.alocados.push(...encaixes());
  P.garantir(e);
  e.inventory = [];
  return e;
}
const joia = (slug, raridade = 'unico') => {
  const lista = Catalogo.catalogo().classes.Jewels;
  const base = slug ? lista.bases.find((b) => b.nome === lista.unicos.find((u) => u.slug === slug).base) : lista.bases.find((b) => b.nome === 'Joia Carmesim');
  return J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: base.id, raridade, ilvl: 80, rng: () => 0, ...(slug ? { unico: slug } : {}) }));
};
const encaixar = (e, peca, no) => { e.inventory.push(peca); return Comandos.comando(e, { action: 'encaixarJoia', no, pilha: e.inventory.length - 1, id: peca.id }); };
const af = (e) => { Ficha.invalidar(e); return Ficha.combate(e).afPoe; };

test('as linhas com efeito', { skip: SEM }, () => {
  for (const [slug, trecho] of [['Firesong', 'se aplicam a Todas'], ['Stormshroud', 'se aplicam a Todas'], ['Ancestral_Vision', 'Suprimir'], ['Witchbane', 'Amaldiçoado'],
    ['Primordial_Harmony', 'Tipo de Golem'], ['Pure_Talent', 'outra classe'], ['The_Adorned', 'Corrompidas']]) {
    const m = modelo(slug, trecho);
    const r = tr(m.modelo, (m.faixas ?? []).map((f) => f[0]));
    assert.equal(r.estado, 'novo', slug);
  }
  assert.deepEqual(tr(modelo('Ancestral_Vision', 'Suprimir').modelo, [50]).efeitos, [{ stat: 'supressao_no_evitar_afeccoes', valor: 50 }]);
});

test('a CANÇÃO DAS CHAMAS, a MORTALHA DA TORMENTA e a VISÃO ANCESTRAL: o modificador vale em todas as Afecções Elementais em você', { skip: SEM }, () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 60 });
  e.equipment = { ...e.equipment, ring: anel({ duracao_incendio_propria: -40, evitar_eletrizacao: 30, spell_suppression: 20 }) };
  const sem = af(e);
  assert.ok(!(sem.duracao_congelamento_propria < 0) && !(sem.evitar_incendio > 0));
  e.equipment.ring = anel({ duracao_incendio_propria: -40, evitar_eletrizacao: 30, spell_suppression: 20, incendio_duracao_todas: 1, evitar_eletrizacao_todas: 1, supressao_no_evitar_afeccoes: 50 });
  const com = af(e);
  for (const n of ['congelamento', 'resfriamento', 'eletrizacao']) assert.equal(com[`duracao_${n}_propria`], -40, n);
  for (const n of ['incendio', 'congelamento', 'resfriamento']) assert.equal(com[`evitar_${n}`], 30, n);
  assert.equal((com.avoid_elem_ailments ?? 0) - (sem.avoid_elem_ailments ?? 0), 10, '50% dos 20% de Supressão');
  // (o Congelamento em você dura 40% menos)
  assert.ok(Math.abs(ModsPoe.controleNoJogador(Ficha.combate(e), 'congelado', () => 0.99).duracaoFator - 0.6) < 1e-9);
});

test('a DESGRAÇA DAS BRUXAS: matar o Amaldiçoado pelo seu Feitiço dá imunidade a Maldições pelo resto dele; a Marca e a aura, não', { skip: SEM }, () => {
  const ficha = { afPoe: { imune_maldicao_ao_matar_amaldicoado: 1 } };
  const hunt = { clock: 10_000 };
  assert.equal(ModsPoe.desgracaDasBruxas(hunt, ficha, { maldicoes: { m: { ate: 13_000, marca: true }, a: { ate: 14_000, aura: true } } }), 0);
  assert.equal(ModsPoe.desgracaDasBruxas(hunt, ficha, { maldicoes: { f: { ate: 12_500 } } }), 12_500);
  ModsPoe.amaldicoarJogador(hunt, 'enf:x', { nome: 'Enfraquecer', af: { y: 1 } }, 11_000);
  assert.equal(Object.keys(hunt.maldicoesNoJogador ?? {}).length, 0, 'imune');
  ModsPoe.amaldicoarJogador(hunt, 'enf:x', { nome: 'Enfraquecer', af: { y: 1 } }, 12_600);
  assert.deepEqual(Object.keys(hunt.maldicoesNoJogador), ['enf:x'], 'acabou o Feitiço, acabou a imunidade');
  assert.equal(ModsPoe.desgracaDasBruxas(hunt, { afPoe: {} }, { maldicoes: { f: { ate: 20_000 } } }), 0, 'sem a joia, nada');
});

test('a HARMONIA PRIMORDIAL: o "aumentado" do Golem × os tipos de Golem vivos (2 Golens de Chamas contam 1 tipo)', { skip: SEM }, () => {
  assert.equal(LacaiosPoe.oQueInvoca('Summon_Stone_Golem', 20, null, { golem_dano_por_tipo: 20 }).poe.danoPorTipoDeGolemPct, 20);
  const pedra = { golem: true, gema: 'Summon_Stone_Golem', hp: 10, poe: { danoPorTipoDeGolemPct: 20, danoIncPct: 50 } };
  const chamas = () => ({ golem: true, gema: 'Summon_Flame_Golem', hp: 10, poe: {} });
  const fator = (lacaios) => LacaiosPoe.golpeDoLacaio(pedra, {}, {}, 'physical', 0, () => 0.99, lacaios).fator;
  assert.ok(Math.abs(fator([pedra]) - (1 + (50 + 20) / 100) / 1.5) < 1e-9, 'só ele: 1 tipo');
  assert.ok(Math.abs(fator([pedra, chamas(), chamas()]) - (1 + (50 + 40) / 100) / 1.5) < 1e-9, '2 tipos');
  assert.ok(Math.abs(fator([pedra, { ...chamas(), hp: 0 }]) - (1 + (50 + 20) / 100) / 1.5) < 1e-9, 'o morto não conta');
  assert.equal(LacaiosPoe.golpeDoLacaio({ ...pedra, golem: false }, {}, {}, 'physical', 0, () => 0.99, [pedra]).fator, 1, 'só nos Golens');
});

test('o TALENTO PURO: o bônus da sua classe sempre; o de outra, com uma passiva sua encostada no início dela', { skip: SEM }, () => {
  const e = personagem();
  const antes = af(e);
  assert.equal(encaixar(e, joia('Pure_Talent'), encaixes()[0]).ok, true);
  const com = af(e);
  assert.equal((com['area_inc@corpo'] ?? 0) - (antes['area_inc@corpo'] ?? 0), 25, 'Marauder: a sua');
  assert.equal((com.move_speed ?? 0) - (antes.move_speed ?? 0), 0, 'a Caçadora, não');
  // uma passiva encostada no início da Caçadora
  const ranger = P.arvore().nos.find((n) => n.id === P.arvore().inicios.Ranger);
  e.passivas.alocados.push(ranger.conexoes[0]);
  P.garantir(e);
  assert.equal((af(e).move_speed ?? 0) - (antes.move_speed ?? 0), 7, 'agora a da Caçadora');
});

test('O ADORNADO: a Joia Mágica Corrompida da árvore vale X% a mais; a não corrompida, não', { skip: SEM }, () => {
  const e = personagem();
  const [a, b] = encaixes();
  const magica = joia(null, 'magico');
  const [k, v] = Object.entries(magica.poe.af).find(([, x]) => typeof x === 'number' && x !== 0);
  const adornado = joia('The_Adorned');
  adornado.poe.af = { ...adornado.poe.af, efeito_joias_magicas_corrompidas: 50 };
  assert.equal(encaixar(e, adornado, a).ok, true);
  const antes = af(e)[k] ?? 0;
  assert.equal(encaixar(e, magica, b).ok, true);
  assert.ok(Math.abs((af(e)[k] ?? 0) - antes - v) < 1e-9, 'não corrompida: o valor de sempre');
  magica.poe.corrompido = true;
  assert.ok(Math.abs((af(e)[k] ?? 0) - antes - v * 1.5) < 1e-9, `corrompida: ${k} × 1,5`);
});
