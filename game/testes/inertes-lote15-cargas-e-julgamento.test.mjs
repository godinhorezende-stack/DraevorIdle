// (07/11, lote 15 das inertes — dono: "Importar e fazer à mão") as habilidades de item das CARGAS PRÓPRIAS (o Larápio da Luz: a Explosão Espiritual gasta uma Carga
// Espiritual; o Atirador do Vazio: o Tiro do Vazio gasta uma Carga do Vazio) e a EXIGÊNCIA DA RAINHA do Mandado de Atziri (alterna as Chamas e a Tormenta do Julgamento).
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
const GemasPoe = await import('../systems/itens-poe/gemas-poe.mjs');
const HI = await import('../systems/itens-poe/habilidades-de-itens.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');

if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
}

const tr = (modelo, valores = []) => T.traduzirMod({ modelo, valores });
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 70, rng: () => 0.5 }));

/** O personagem com as linhas na arma (`base`), na Costa, com um alvo imortal ao lado e os outros longe. */
function personagem(linhas, base = 'Wands/Driftwood_Wand') {
  const e = Object.assign(personagemDeTeste({ vocacao: 'sorcerer', level: 90 }), { classePoe: 'Witch', sistema: 'poe' });
  const arma = peca(base);
  const af = { ...(arma.poe.af ?? {}) };
  for (const [m, v] of linhas) for (const x of tr(m, v).efeitos) af[x.stat] = (af[x.stat] ?? 0) + Number(x.valor);
  arma.poe.af = af;
  e.equipment = { ...e.equipment, weapon: arma };
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  const h = e.hunt;
  h.clock = 100_000;
  e.mana = e.maxMana = 1e7;
  const [b, ...resto] = h.monstros;
  for (const m of resto) Object.assign(m, { x: h.pos.x + 60, y: h.pos.y + 60 });
  Object.assign(b, { x: h.pos.x + 1, y: h.pos.y, hp: 1e12, maxHp: 1e12, estados: {} });
  ModsPoe.definirFichaDaCacada(h, () => Ficha.combate(e));
  return { e, h, b };
}
const ficha = (e) => { Ficha.invalidar(e); return Ficha.combate(e); };
const ESPIRITUAL = ['Ativa Explosão Espiritual Nível {0} quando você Usar uma Habilidade enquanto possuir uma Carga Espiritual', [20]];
const VAZIO = ['Consome uma Carga do Vazio para Ativar Tiro do Vazio Nível {0} ao disparar Flechas com uma Habilidade não Ativada', [20]];

test('as habilidades novas: a Explosão Espiritual e as Chamas do Julgamento compilam inteiras; as linhas do lote saem com efeito', { skip: SEM }, () => {
  assert.equal(GemasPoe.doSlug('Spirit_Burst').statusNoJogo, 'funciona');
  assert.equal(GemasPoe.doSlug('Flames_of_Judgement').statusNoJogo, 'funciona');
  assert.equal(HI.feita('Queens_Demand')?.nome, 'Exigência da Rainha');
  for (const [m, v] of [ESPIRITUAL, VAZIO, ['Ordem da Rainha pode Ativar Chamas do Julgamento Nível {0}', [20]], ['Ordem da Rainha pode Ativar Tormenta do Julgamento Nível {0}', [20]]]) {
    assert.ok(!['inerte', 'registrado'].includes(tr(m, v).estado), m);
  }
});

test('o LARÁPIO DA LUZ: ao usar uma habilidade com Carga Espiritual, gasta UMA e solta a Explosão Espiritual; sem carga, nada', { skip: SEM }, () => {
  const { e, h, b } = personagem([ESPIRITUAL]);
  const eventos = [];
  ModsPoe.evento(e, h, 'usarHabilidade', ficha(e), { alvo: b, eventos, personagem: PERSONAGEM });
  assert.ok(!eventos.some((x) => x.t === 'gatilho'), 'sem carga');
  h.cargasPoe = { espiritual: { n: 2, ate: h.clock + 60_000 } };
  ModsPoe.evento(e, h, 'usarHabilidade', ficha(e), { alvo: b, eventos, personagem: PERSONAGEM });
  assert.ok(eventos.some((x) => x.t === 'gatilho' && x.skill === 'Explosão Espiritual'), JSON.stringify(eventos.slice(0, 3)));
  assert.equal(h.cargasPoe.espiritual?.n, 1, 'gastou uma');
});

test('o ATIRADOR DO VAZIO: o ataque com Arco e Carga do Vazio gasta uma e solta o Tiro do Vazio', { skip: SEM }, () => {
  const { e, h, b } = personagem([VAZIO], 'Bows/Crude_Bow');
  h.cargasPoe = { vazio: { n: 1, ate: h.clock + 60_000 } };
  const eventos = [];
  ModsPoe.evento(e, h, 'usarAtaque', ficha(e), { alvo: b, eventos, personagem: PERSONAGEM });
  assert.ok(eventos.some((x) => x.t === 'gatilho' && x.skill === 'Tiro do Vazio'), JSON.stringify(eventos.slice(0, 3)));
  assert.equal(h.cargasPoe.vazio?.n ?? 0, 0);
});

test('a EXIGÊNCIA DA RAINHA: alterna as Chamas do Julgamento e a Tormenta do Julgamento no nível das linhas da peça', { skip: SEM }, () => {
  const { e, h, b } = personagem([['Ordem da Rainha pode Ativar Chamas do Julgamento Nível {0}', [20]], ['Ordem da Rainha pode Ativar Tormenta do Julgamento Nível {0}', [20]]]);
  const af = ficha(e).afPoe;
  const nomes = [];
  for (let i = 0; i < 2; i++) {
    const eventos = [];
    h.clock += 1000;
    assert.ok(HI.usar(e, h, 'Queens_Demand', { id: `q${i}`, alvo: b, eventos, agora: h.clock, af }).ok);
    nomes.push(eventos.find((x) => x.t === 'gatilho')?.skill);
  }
  assert.deepEqual(nomes, ['Chamas do Julgamento', 'Tormenta do Julgamento']);
});
