// LOTE 70 — as RAMIFICADORAS, os NOTÁVEIS (a 5ª parte): 41 → 36 sem efeito, com as decisões do dono (17/10). "Implementar os 2 solos": os
// monstros com o mod do PoE "Solo Ardente/Eletrizado ao Morrer" deixam o solo (6 s, raio 1,6 m — o poedb); o Ardente queima 62,5% do maior
// golpe do monstro por segundo, o Eletrizado eletriza em 20%; "Inafetado por Solo Ardente/Eletrizado" tira o efeito. "Alcance do totem em
// casas": o totem nasce na direção do alvo, a até X% da distância, nas casas andáveis. E os totens "ao Convocar": a Fúria Arcana (4 s) e a
// Lentidão (30% por 4 s) nos inimigos próximos — os lembretes do catálogo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
await (await import('../systems/itens-poe/iniciar.mjs')).iniciarJogoDoPoe();
const A = await import('../systems/itens-poe/arvore.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const NoJogador = await import('../systems/itens-poe/monstros-no-jogador.mjs');
const Mecanicas = await import('../systems/mobs/mecanicas.mjs');
const Poderes = await import('../systems/poderes.mjs');
const Acoes = await import('../systems/acoes.mjs');
const { criarMonstro } = await import('../systems/hunt/monstros.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');

const efeitos = (linha) => Object.fromEntries(A.traduzirLinha(linha).efeitos.map((e) => [e.add, e.valor]));
const fichaCom = (af) => ({ afPoe: af, eventosPoe: ModsPoe.eventosDa(af) });

test('as linhas: os solos dos monstros, o alcance do posicionamento e os totens ao Convocar', { skip: SEM }, () => {
  assert.deepEqual(efeitos('Inafetado por Solo Ardente'), { imune_solo_ardente: 1 });
  assert.deepEqual(efeitos('Inafetado por Solo Eletrizado'), { imune_solo_eletrizado: 1 });
  assert.deepEqual(efeitos('Alcance do Posicionamento de Totens aumentado em 25%'), { totem_alcance_posicionamento: 25 });
  assert.deepEqual(efeitos('Ganhe Fúria Arcana ao Convocar um Totem'), { 'ev:convocarTotem:buff:furiaArcana': 4 });
  assert.deepEqual(efeitos('Totens Desaceleram Inimigos próximos deles quando Convocados'), { totem_desacelera_ao_convocar: 1 });
  // os outros solos seguem sem existir no jogo
  assert.equal(A.traduzirLinha('Inafetado por Solo Profano').estado, 'inerte');
});

/** Um personagem do PoE numa caçada mínima, com um monstro com o mod de solo do PoE a 1 casa. */
function cena(mod, af = {}) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 100 }), { sistema: 'poe', classePoe: 'Scion' });
  e.maxHp = e.hp = 1e6;
  e.hunt = { clock: 10000, monstros: [], lacaios: [], pos: { x: 0, y: 0 }, z: 7 };
  ModsPoe.definirFichaDaCacada(e.hunt, () => fichaCom(af));
  const m = criarMonstro({ key: 'troll', x: 1, y: 0 }, null);
  m.mods = [`poe:${mod}`];
  e.hunt.monstros.push(m);
  return { e, hunt: e.hunt, m };
}

test('o SOLO ARDENTE: o monstro com o mod deixa o solo ao morrer; queima 62,5% do maior golpe dele por segundo; "Inafetado" não queima', { skip: SEM }, () => {
  const { e, hunt, m } = cena('MonsterModBurningGroundOnDeath');
  m.hp = 0;
  const ev = [];
  Mecanicas.aoMorrer(e, hunt, null, m, ev);
  const [solo] = hunt.solosDosMonstros ?? [];
  assert.ok(solo, 'o solo ficou');
  assert.equal(solo.tipo, 'ardente');
  assert.equal(solo.ate, 10000 + 6000, '6 s');
  assert.equal(solo.raio, 1, '1,6 m → 1 casa');
  const golpe = Poderes.golpeMaximoDoBicho(m) * (m.forca ?? 1);
  assert.ok(golpe > 0);
  assert.ok(Math.abs(solo.dps - golpe * 0.625) < 1e-9, '62,5% do maior golpe por segundo');
  assert.ok(ev.some((x) => x.t === 'area'), 'a tela vê o solo');
  const antes = e.hp;
  Mecanicas.tique(e, hunt, null, []);
  assert.ok(e.hp < antes, 'no solo: queima');
  const depois = e.hp;
  hunt.clock += 500;
  Mecanicas.tique(e, hunt, null, []);
  assert.equal(e.hp, depois, 'uma vez por segundo');
  hunt.clock += 600;
  Mecanicas.tique(e, hunt, null, []);
  assert.ok(e.hp < depois);
  // fora do raio, nada; e o solo some depois dos 6 s
  hunt.pos = { x: 5, y: 0 };
  const fora = e.hp;
  hunt.clock += 1000;
  Mecanicas.tique(e, hunt, null, []);
  assert.equal(e.hp, fora);
  hunt.clock = 16001;
  Mecanicas.tique(e, hunt, null, []);
  assert.equal(hunt.solosDosMonstros.length, 0);
  // "Inafetado por Solo Ardente"
  const imune = cena('MonsterModBurningGroundOnDeath', { imune_solo_ardente: 1 });
  imune.m.hp = 0;
  Mecanicas.aoMorrer(imune.e, imune.hunt, null, imune.m, []);
  const hp = imune.e.hp;
  Mecanicas.tique(imune.e, imune.hunt, null, []);
  assert.equal(imune.e.hp, hp, 'Inafetado: não queima');
});

test('o SOLO ELETRIZADO: Eletriza (20%) quem está nele; "Inafetado por Solo Eletrizado" não', { skip: SEM }, () => {
  const { e, hunt, m } = cena('MonsterModShockedGroundOnDeath');
  m.hp = 0;
  Mecanicas.aoMorrer(e, hunt, null, m, []);
  assert.equal(hunt.solosDosMonstros?.[0]?.tipo, 'eletrizado');
  assert.equal(NoJogador.eletrizadoPeloMonstro(hunt), false);
  Mecanicas.tique(e, hunt, null, []);
  assert.equal(NoJogador.eletrizadoPeloMonstro(hunt), true);
  assert.equal(hunt.debuffsDoJogador.eletrizado.pct, 20);
  const imune = cena('MonsterModShockedGroundOnDeath', { imune_solo_eletrizado: 1 });
  imune.m.hp = 0;
  Mecanicas.aoMorrer(imune.e, imune.hunt, null, imune.m, []);
  Mecanicas.tique(imune.e, imune.hunt, null, []);
  assert.equal(NoJogador.eletrizadoPeloMonstro(imune.hunt), false, 'Inafetado: não eletriza');
});

test('o ALCANCE DO POSICIONAMENTO: o totem nasce na direção do alvo, a até X% da distância, só nas casas andáveis', { skip: SEM }, () => {
  const hunt = { pos: { x: 0, y: 0 } };
  assert.deepEqual(Acoes.lugarDoTotem(hunt, { x: 8, y: 0 }, 0), { x: 0, y: 0 }, 'sem o mod: na sua casa');
  assert.deepEqual(Acoes.lugarDoTotem(hunt, null, 25), { x: 0, y: 0 }, 'sem alvo: na sua casa');
  assert.deepEqual(Acoes.lugarDoTotem(hunt, { x: 8, y: 0 }, 25), { x: 2, y: 0 }, '25% de 8 casas');
  assert.deepEqual(Acoes.lugarDoTotem(hunt, { x: -8, y: -4 }, 25), { x: -2, y: -2 });
  assert.deepEqual(Acoes.lugarDoTotem(hunt, { x: 3, y: 0 }, 100), { x: 2, y: 0 }, 'nunca na casa do alvo');
  ModsPoe.definirGradeDoCombate(hunt, () => ({ andavel: new Set(['0,0', '1,0']) }));
  assert.deepEqual(Acoes.lugarDoTotem(hunt, { x: 8, y: 0 }, 50), { x: 1, y: 0 }, 'para na parede');
});

test('ao CONVOCAR um totem: a Fúria Arcana (4 s) e a Lentidão de 30% por 4 s nos inimigos a até 3 casas', { skip: SEM }, () => {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 100 }), { sistema: 'poe', classePoe: 'Scion' });
  const perto = { uid: 'p', hp: 100, maxHp: 100, x: 3, y: 1, estados: {} };
  const longe = { uid: 'l', hp: 100, maxHp: 100, x: 4, y: 0, estados: {} };
  e.hunt = { clock: 20000, monstros: [perto, longe], lacaios: [], pos: { x: 0, y: 0 } };
  const totem = { uid: 't', tipo: 'totem', nome: 'Totem', x: 0, y: 0 };
  const ficha = fichaCom({ 'ev:convocarTotem:buff:furiaArcana': 4, totem_desacelera_ao_convocar: 1 });
  const ev = Acoes.aoConvocarTotem(e, e.hunt, totem, ficha, 5000);
  assert.equal(e.hunt.poeBuffs?.furiaArcana, 20000 + 4000, 'Fúria Arcana por 4 s');
  // (com o aval do dono, 26/10 — lote E1b: "Totens Desaceleram…" é o Tolhimento do PoE, `Estados.tolher` — 30% por 4 s —, não a lentidão)
  assert.deepEqual(perto.estados.tolhido, { ate: 9000, pct: 30 });
  assert.equal(perto.estados.desacelerado.ate, 9000);
  assert.equal(longe.estados.tolhido, undefined, 'a 4 casas: não');
  assert.ok(ev.some((x) => x.t === 'estado' && x.uid === 'p' && x.estado === 'tolhido'));
  // sem as linhas: nada
  const outro = { uid: 'o', hp: 100, maxHp: 100, x: 1, y: 0, estados: {} };
  e.hunt = { clock: 20000, monstros: [outro], lacaios: [], pos: { x: 0, y: 0 } };
  Acoes.aoConvocarTotem(e, e.hunt, totem, fichaCom({}), 5000);
  assert.equal(e.hunt.poeBuffs?.furiaArcana, undefined);
  assert.equal(outro.estados.lento, undefined);
});

test('o RELATÓRIO: os notáveis sem efeito caem para no máximo 36', { skip: SEM }, async () => {
  const { linhasDasRamificadoras } = await import('../tools/relatorio-arvore-poe.mjs');
  const { grupos } = await linhasDasRamificadoras(Catalogo.catalogo());
  assert.ok(grupos.notavel.sem <= 36, `${grupos.notavel.sem}`);
});
