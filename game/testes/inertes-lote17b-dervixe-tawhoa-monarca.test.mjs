// (07/11, lote 17 das inertes — dono: "Fazer todas pelo PoB") o DERVIXE DANÇANTE (os 2 Dervixes na Fúria, você desarmado, a Agressividade), o ESCOLHIDO DE TAWHOA (o ataque
// de Pancada repetido, recarga de 1 s) e o MONARCA SANTIFICADO (o lacaio Vinculado com os modificadores do raro morto).
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
const Acoes = await import('../systems/acoes.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
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
const DERVIXE = [['Ativa Manifesto dos Dervixes Dançarinos Nível {0} na Fúria', [15]], ['O Dervixe Dançarino Manifestado desativa ambos espaços de arma'], ['O Dervixe Dançarino Manifestado morre quando a Fúria termina']];
const TAWHOA = ['Ativa Escolhido de Tawhoa Nível {0} quando você Atacar com / uma Habilidade de Pancada ou Golpe Não Vaal', [20]];
const MONARCA = ['Ao abater um monstro raro, um lacaio conectado aleatório ganha seus modificadores por {0} segundos', [60]];

function personagem(linhas, base, encaixada = null) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Marauder', sistema: 'poe' });
  const arma = peca(base);
  const af = { ...(arma.poe.af ?? {}) };
  for (const [m, v] of linhas) for (const x of tr(m, v ?? []).efeitos) af[x.stat] = (af[x.stat] ?? 0) + Number(x.valor);
  arma.poe.af = af;
  e.equipment = { ...e.equipment, weapon: arma };
  delete e.equipment.shield;
  if (encaixada) {
    arma.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
    e.inventory = [GS.itemDaGema({ id: GemasPoe.doSlug(encaixada).itemId, nivel: 20, xp: 0, raridade: 'comum' })];
    GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
    e.actions = Array(Acoes.SLOTS).fill(null);
    e.actions[0] = { id: GemasPoe.doSlug(encaixada).acao, enabled: true, minMana: 0, conditions: [] };
  }
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  const h = e.hunt;
  h.clock = 100_000;
  h.lacaios = [];
  e.mana = e.maxMana = 1e7;
  const [b, ...resto] = h.monstros;
  for (const m of resto) Object.assign(m, { x: h.pos.x + 60, y: h.pos.y + 60 });
  Object.assign(b, { x: h.pos.x + 1, y: h.pos.y, hp: 1e12, maxHp: 1e12, estados: {} });
  ModsPoe.definirFichaDaCacada(h, () => Ficha.combate(e));
  return { e, h, b };
}

test('as linhas do lote saem com efeito', { skip: SEM }, () => {
  for (const [m, v] of [...DERVIXE, TAWHOA, MONARCA]) assert.ok(!['inerte', 'registrado'].includes(tr(m, v ?? []).estado), m);
});

test('o DERVIXE DANÇANTE: na Fúria saem 2 Dervixes com o golpe da arma; você fica desarmado e com Agressividade; no fim da Fúria, somem e a arma volta', { skip: SEM }, () => {
  const { e, h } = personagem(DERVIXE, 'One_Hand_Swords/Rusted_Sword');
  const armado = Ficha.combate(e).intervaloDoGolpeMs;
  Acoes.tiqueDoGuardian(e, h, 1_000_000);
  assert.equal(h.lacaios.filter((l) => l.dervixe).length, 0, 'fora da Fúria, nada');
  h.rampage = { n: 15, ate: h.clock + 5000 };
  Acoes.tiqueDoGuardian(e, h, 1_000_100);
  const dervixes = h.lacaios.filter((l) => l.dervixe && l.hp > 0);
  assert.equal(dervixes.length, 2);
  assert.equal(dervixes[0].pob, 'UniqueAnimatedWeapon');
  const arma = Ficha.armasEquipadas(e).find((a) => a.slot === 'weapon');
  assert.ok(dervixes[0].dano.max > arma.max * 3, 'o golpe da arma com +110% e 70% mais');
  assert.ok((h.poeBuffs?.agressividade ?? 0) > h.clock);
  Ficha.invalidar(e);
  assert.notEqual(Ficha.combate(e).intervaloDoGolpeMs, armado, 'desarmado: o golpe é o desarmado');
  Acoes.tiqueDoGuardian(e, h, 1_000_200);
  assert.equal(h.lacaios.filter((l) => l.dervixe && l.hp > 0).length, 2, 'não saem mais enquanto vivem');
  h.rampage.ate = h.clock - 1;
  Acoes.tiqueDoGuardian(e, h, 1_000_300);
  assert.equal(h.lacaios.filter((l) => l.dervixe && l.hp > 0).length, 0);
  // (passada a Agressividade, que durava 1 s)
  h.clock += 2000;
  Ficha.invalidar(e);
  assert.equal(Ficha.combate(e).intervaloDoGolpeMs, armado);
});

test('o ESCOLHIDO DE TAWHOA: o ataque de Pancada sai de novo, de graça (uma vez por segundo)', { skip: SEM }, () => {
  const { e, h, b } = personagem([TAWHOA], 'Two_Hand_Maces/Driftwood_Maul', 'Ground_Slam');
  const r = Acoes.disparar(e, h, PERSONAGEM, 0, b, { manual: true });
  assert.ok(r.ok, r.erro);
  if (h.conjurando) { h.clock = h.conjurando.fim; r.eventos.push(...(Acoes.concluirConjuracao(e, h, PERSONAGEM) ?? [])); }
  assert.equal(r.eventos.filter((x) => x.t === 'gatilho' && x.suporte === 'Escolhido de Tawhoa').length, 1, JSON.stringify(r.eventos.filter((x) => x.t === 'gatilho')));
});

test('o MONARCA SANTIFICADO: matar um raro dá ao lacaio Vinculado o Dano dos modificadores dele por 60 s; depois, volta', { skip: SEM }, () => {
  const { e, h } = personagem([MONARCA], 'Wands/Driftwood_Wand');
  h.lacaios.push({ uid: 'l1', tipo: 'lacaio', hp: 100, maxHp: 100, x: h.pos.x, y: h.pos.y, dano: { min: 100, max: 200 }, intervaloMs: 1000 });
  h.vinculos = [{ acao: 'x', ate: h.clock + 60_000, alvos: [{ tipo: 'lacaio', uid: 'l1' }] }];
  const raro = { uid: 'r', hp: 0, maxHp: 10, raridade: 'raro', raridadePoe: 'raro', mods: ['poe:Sem_Frostweaver'], estados: {} };
  ModsPoe.evento(e, h, 'matar', Ficha.combate(e), { alvo: raro, eventos: [], personagem: PERSONAGEM, rng: () => 0 });
  Acoes.tiqueDoGuardian(e, h, 1_000_000);
  assert.deepEqual(h.lacaios[0].dano, { min: 175, max: 350 }, '+75% de Dano do Tecelão de Gelo');
  h.clock += 61_000;
  Acoes.tiqueDoGuardian(e, h, 1_000_100);
  assert.deepEqual(h.lacaios[0].dano, { min: 100, max: 200 });
});
