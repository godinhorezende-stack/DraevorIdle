// (07/11, lote 21 das inertes) os IMPLÍCITOS que ficaram: os Talismãs de Aspecto (Craicic, Fenumal, Farric — os Aspectos existem desde o lote 7), o Impacto Ardente das
// Maças Quebradora e Explosiva (o PoB, FieryImpactHeistMaceImplicit) e o Avanço Ardente das Lâminas Incendiária e Infernal (o Avanço Ardente do jogo).
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
const T = await import('../systems/itens-poe/traduzir.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');

if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
}

const tr = (modelo, valores = []) => T.traduzirMod({ modelo, valores });
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 70, rng: () => 0.5 }));
const IMPACTO = ['Ativa Impacto Ardente Nível {0} no Acerto Corpo a Corpo com esta Arma / local use skill on melee hit % [{1}]', [15, 100]];
const AVANCO = ['Ativa Avanço Ardente Nível {0} ao usar uma Habilidade Encaixada / Recuperação da Recarga de Habilidades de Deslocamento aumentada {1}% / local skills granted by item are supported by level x unique trigger support [{2}]', [20, 20, 2]];

function personagem(linhas = [], base = 'One_Hand_Maces/Driftwood_Club') {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Marauder', sistema: 'poe' });
  const arma = peca(base);
  const af = { ...(arma.poe.af ?? {}) };
  for (const [m, v] of linhas) for (const x of tr(m, v ?? []).efeitos) af[x.stat] = (af[x.stat] ?? 0) + Number(x.valor);
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

test('os implícitos saem com efeito (a parte interna do gatilho é lembrete)', { skip: SEM }, () => {
  for (const [m, v] of [IMPACTO, AVANCO, ['Efeito de bônus de Aspecto do Caranguejo aumentado em {0}%', [100]], ['Efeito da penalidade de Aspecto da Aranha aumentado em {0}%', [100]], ['Efeito de bônus de Aspecto do Gato aumentado em {0}%', [100]]]) {
    assert.ok(!['inerte', 'registrado'].includes(tr(m, v).estado), m);
  }
});

test('o IMPACTO ARDENTE pelo PoB: 280/350/420% de base nos níveis 10/15/20, recarga 1,8/1,6/1,4 s; sai no acerto corpo a corpo', { skip: SEM }, () => {
  assert.deepEqual([10, 15, 20].map((n) => GemasPoe.eficaciaNoNivel('Fiery_Impact', n)), [2.8, 3.5, 4.2]);
  assert.deepEqual([10, 15, 20].map((n) => GemasPoe.temposNoNivel('Fiery_Impact', n).recargaMs), [1800, 1600, 1400]);
  assert.equal(GemasPoe.eficaciaNoNivel('Void_Shot', 20), 0.65, '(a correção do Tiro do Vazio: 65% de base)');
  const { e, h, b } = personagem([IMPACTO]);
  const eventos = [];
  ModsPoe.evento(e, h, 'acertar', Ficha.combate(e), { alvo: b, eventos, personagem: PERSONAGEM, tags: ['ataque', 'corpo'] });
  assert.ok(eventos.some((x) => x.t === 'gatilho' && x.skill === 'Impacto Ardente'), JSON.stringify(eventos.slice(0, 2)));
});

test('o AVANÇO ARDENTE: o uso de uma habilidade solta o Avanço Ardente do jogo', { skip: SEM }, () => {
  const { e, h, b } = personagem([AVANCO], 'One_Hand_Swords/Rusted_Sword');
  const eventos = [];
  ModsPoe.evento(e, h, 'usarHabilidade', Ficha.combate(e), { alvo: b, eventos, personagem: PERSONAGEM, tags: ['ataque'] });
  assert.ok(eventos.some((x) => x.t === 'gatilho' && x.skill === 'Avanço Ardente'), JSON.stringify(eventos.slice(0, 2)));
});

test('os TALISMÃS: o Caranguejo dobra a Redução Física por Barreira; o Gato, o efeito da Furtividade Felina', { skip: SEM }, () => {
  const sem = personagem();
  const com = personagem([['Efeito de bônus de Aspecto do Caranguejo aumentado em {0}%', [100]], ['Efeito de bônus de Aspecto do Gato aumentado em {0}%', [100]]]);
  for (const x of [sem, com]) x.h.barreiras = { n: 5 };
  const fis = (x) => { Ficha.invalidar(x.e); return Afixos.soma(x.e).phys_res ?? 0; };
  assert.equal(fis(com) - fis(sem), 10, '5 Barreiras: +10% a mais (2% × 5 × 100%)');
  assert.equal(Ficha.combate(com.e).afPoe['efeito_buff:furtividadeFelina'], 100);
});
