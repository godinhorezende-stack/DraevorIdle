// (07/11, lote 22 das inertes — o dono: "Continue então resolvendo") a ECONOMIA e a EXPERIÊNCIA: as Cinzas das Estrelas (Experiência das Gemas), o Crime de Dialla (as dos
// Encaixes Azuis), o Lar do Além (Experiência reduzida), o Anel do Lorde dos Bandidos (o Ouro) e o Sinete de Perandus (o Pergaminho da Sabedoria).
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
const Combate = await import('../systems/hunt/combate.mjs');
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
const comLinhas = (p, linhas) => {
  const af = { ...(p.poe.af ?? {}) };
  for (const [m, v] of linhas) for (const x of tr(m, v ?? []).efeitos) af[x.stat] = (af[x.stat] ?? 0) + Number(x.valor);
  p.poe.af = af;
  return p;
};
/** A Bruxa com a Bola de Fogo (nível 1) na varinha, no encaixe da cor `cor`, e as linhas na varinha. */
function personagem(linhas = [], cor = 'W') {
  const e = Object.assign(personagemDeTeste({ vocacao: 'sorcerer', level: 90 }), { classePoe: 'Witch', sistema: 'poe' });
  const arma = comLinhas(peca('Wands/Driftwood_Wand'), linhas);
  arma.soquetes = { abertos: 1, links: [], gemas: [null], cores: [cor] };
  e.equipment = { ...e.equipment, weapon: arma };
  e.inventory = [GS.itemDaGema({ id: GemasPoe.doSlug('Fireball').itemId, nivel: 1, xp: 0, raridade: 'comum' })];
  GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  return e;
}
const xpDaGema = (e) => e.equipment.weapon.soquetes.gemas[0].xp;

test('as linhas do lote saem com efeito', { skip: SEM }, () => {
  for (const [m, v] of [['Ganho de Experiência das Gemas aumentado em {0}%', [10]], ['Gemas Encaixadas nos Encaixes Azuis ganham {0}% de Experiência aumentada', [100]], ['Experiência adquirida reduzida em {0}%', [25]], ['Quantidade de Ouro Derrubada por Inimigos Mortos aumentada em {0}%', [30]], ['{0}% de chance de monstros Mortos derrubarem um Pergaminho da Sabedoria adicional', [3]]]) {
    assert.ok(!['inerte', 'registrado'].includes(tr(m, v).estado), m);
  }
  assert.deepEqual(tr('Experiência adquirida reduzida em {0}%', [25]).efeitos, [{ stat: 'exp_bonus', valor: -25 }]);
  assert.deepEqual(tr('Quantidade de Ouro Derrubada por Inimigos Mortos aumentada em {0}%', [30]).efeitos, [{ stat: 'gold_find', valor: 30 }]);
});

test('a EXPERIÊNCIA DAS GEMAS: +100% dobra a da gema; os Encaixes Azuis só valem na gema do encaixe azul', { skip: SEM }, () => {
  const base = personagem();
  GS.ganharXp(base, 10);
  const x = xpDaGema(base);
  assert.ok(x > 0);
  const geral = personagem([['Ganho de Experiência das Gemas aumentado em {0}%', [100]]]);
  GS.ganharXp(geral, 10);
  assert.equal(xpDaGema(geral), x * 2);
  const azul = personagem([['Gemas Encaixadas nos Encaixes Azuis ganham {0}% de Experiência aumentada', [100]]], 'B');
  GS.ganharXp(azul, 10);
  assert.equal(xpDaGema(azul), x * 2);
  const branco = personagem([['Gemas Encaixadas nos Encaixes Azuis ganham {0}% de Experiência aumentada', [100]]], 'W');
  GS.ganharXp(branco, 10);
  assert.equal(xpDaGema(branco), x);
});

test('o SINETE DE PERANDUS: com 100%, o abate deixa um Pergaminho da Sabedoria', { skip: SEM }, () => {
  const e = personagem([['{0}% de chance de monstros Mortos derrubarem um Pergaminho da Sabedoria adicional', [100]]]);
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  const h = e.hunt;
  const b = h.monstros.find((m) => !m.dummy);
  b.hp = 0;
  const eventos = [];
  Combate.matarMonstro(e, h, PERSONAGEM, b, eventos);
  assert.ok((h.sessao?.itens?.loot?.['915154'] ?? 0) >= 1, 'o Pergaminho da Sabedoria (915154) no loot da sessão');
});
