// (07/11, lote 16 das inertes — dono: "Continue resolvendo até dar zero nos itens") a MARCA DA SUBMISSÃO (a maldição encaixada na peça ao Acertar), o CHAMADO DO
// VAZIO (todo o dano de um acerto pode te Resfriar) e o MUR'DITH'HAL (o Fantasma ao consumir um cadáver).
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
const Condicoes = await import('../systems/itens-poe/condicoes-poe.mjs');
const NoJogador = await import('../systems/itens-poe/monstros-no-jogador.mjs');
const Mecanicas = await import('../systems/mobs/mecanicas.mjs');
const GemasPoe = await import('../systems/itens-poe/gemas-poe.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');

if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
}

const tr = (modelo, valores = []) => T.traduzirMod({ modelo, valores });
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 70, rng: () => 0.5 }));
const MARCA = ['Amaldiçoa Inimigos com Gema de Maldição Feitiço Encaixada ao Acertar'];
const VAZIO = ['Todo o Dano Sofrido de Acertos podem te Resfriar'];
const MURDITHHAL = ['Ativa a Habilidade Convocar Fantasma Nível {0} ao Consumir um Corpo', [20]];

/** O personagem com as linhas na varinha (e a gema `encaixada` no encaixe dela), na Costa, com um alvo ao lado e os outros longe. */
function personagem(linhas, encaixada = null) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'sorcerer', level: 90 }), { classePoe: 'Witch', sistema: 'poe' });
  const arma = peca('Wands/Driftwood_Wand');
  const af = { ...(arma.poe.af ?? {}) };
  for (const [m, v] of linhas) for (const x of tr(m, v ?? []).efeitos) af[x.stat] = (af[x.stat] ?? 0) + Number(x.valor);
  arma.poe.af = af;
  e.equipment = { ...e.equipment, weapon: arma };
  if (encaixada) {
    arma.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
    e.inventory = [GS.itemDaGema({ id: GemasPoe.doSlug(encaixada).itemId, nivel: 20, xp: 0, raridade: 'comum' })];
    GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
  }
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  const h = e.hunt;
  h.clock = 100_000;
  e.maxHp = e.hp = 10_000;
  const [b, ...resto] = h.monstros;
  for (const m of resto) Object.assign(m, { x: h.pos.x + 60, y: h.pos.y + 60 });
  Object.assign(b, { x: h.pos.x + 1, y: h.pos.y, hp: 1e9, maxHp: 1e9, estados: {} });
  ModsPoe.definirFichaDaCacada(h, () => Ficha.combate(e));
  return { e, h, b };
}
const ficha = (e) => { Ficha.invalidar(e); return Ficha.combate(e); };

test('as linhas do lote saem com efeito', { skip: SEM }, () => {
  for (const [m, v] of [MARCA, VAZIO, MURDITHHAL]) assert.ok(!['inerte', 'registrado'].includes(tr(m, v ?? []).estado), m);
});

test('a MARCA DA SUBMISSÃO: ao Acertar, o alvo leva a Maldição encaixada na peça; sem a linha, não', { skip: SEM }, () => {
  const sem = personagem([], 'Vulnerability');
  ModsPoe.evento(sem.e, sem.h, 'acertar', ficha(sem.e), { alvo: sem.b, eventos: [], personagem: PERSONAGEM });
  assert.equal(Condicoes.maldicoesNoAlvo(sem.b, sem.h.clock), 0);
  const { e, h, b } = personagem([MARCA], 'Vulnerability');
  ModsPoe.evento(e, h, 'acertar', ficha(e), { alvo: b, eventos: [], personagem: PERSONAGEM });
  assert.equal(Condicoes.maldicoesNoAlvo(b, h.clock), 1);
});

test('o CHAMADO DO VAZIO: o Crítico Físico do monstro te Resfria pelo dano todo (50% × (3000 ÷ 10000)^0,4 = 30%, o teto); sem a linha, não', { skip: SEM }, () => {
  assert.equal(NoJogador.pctDoResfriamento(1000, 10_000), 19.9);
  assert.equal(NoJogador.pctDoResfriamento(10, 10_000), 0, 'abaixo de 5%');
  for (const [linhas, espera] of [[[], false], [[VAZIO], true]]) {
    const { e, h, b } = personagem(linhas);
    Mecanicas.aoAcertarJogador(e, h, PERSONAGEM, b, { dano: 3000, bruto: 3000, partes: { physical: 3000 }, brutas: { physical: 3000 }, critico: true, rng: () => 0.99 });
    assert.equal((h.controle?.lento?.ate ?? 0) > h.clock, espera, JSON.stringify(h.controle));
    if (espera) assert.equal(h.controle.lento.pct, 30);
  }
});

test("o MUR'DITH'HAL: o cadáver consumido convoca um Fantasma (um por tique); sem consumir, nada", { skip: SEM }, () => {
  const { e, h } = personagem([MURDITHHAL]);
  const fantasmas = () => (h.lacaios ?? []).filter((l) => l.fantasma && l.hp > 0).length;
  ModsPoe.tiqueDosAspectos(e, h, ficha(e), h.clock);
  assert.equal(fantasmas(), 0);
  Condicoes.marcar(h, 'consumiuCadaver', h.clock);
  ModsPoe.tiqueDosAspectos(e, h, ficha(e), h.clock);
  assert.equal(fantasmas(), 1);
  ModsPoe.tiqueDosAspectos(e, h, ficha(e), h.clock + 100);
  assert.equal(fantasmas(), 1, 'o mesmo consumo não convoca de novo');
});
