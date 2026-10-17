// LOTE 51 — as ÚNICAS de JOIA (J30), as decisões do dono (16/10): as ALMAS VAAL viram a recarga das Vaal (o Reino de Atziri: na chance, a Vaal
// usada não entra em recarga; o Calafrio da Corrupção: o inimigo Estilhaçado anda uma alma da recarga), os lacaios AGRESSIVOS (procuram alvo 3
// casas mais longe), a DISSOLUÇÃO DA CARNE (a Vida perdida fica Reservada e volta depois de 2 s sem dano) e o APRENDIZADO INSPIRADO (com 4
// Notáveis no raio, o Raro morto dá 1 dos modificadores dele por 20 s — só entre os que têm equivalente em você).
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
const Arvore = await import('../systems/arvore.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const Comandos = await import('../systems/passivas/comandos.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const LacaiosPoe = await import('../systems/itens-poe/lacaios-poe.mjs');
const GemasPoe = await import('../systems/itens-poe/gemas-poe.mjs');
const Aprendizado = await import('../systems/itens-poe/aprendizado-inspirado.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
}

const tr = (modelo, valores = []) => T.traduzirMod({ modelo, valores });
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 1, rng: () => 0.5 }));
const anel = (af) => ({ id: Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'might ring')?.id), count: 1, af: [], poe: { af } });

test('as linhas com efeito', { skip: SEM }, () => {
  assert.equal(tr('Habilidades Vaal tem {0}% de chance de ganharem as Almas consumidas novamente quando usadas', [10]).estado, 'equivalente');
  assert.equal(tr('{0}% de chance de ganhar uma Alma Vaal adicional por Inimigo Estilhaçado', [10]).estado, 'equivalente');
  assert.equal(tr('Lacaios Convocados são Agressivos').estado, 'equivalente');
  assert.deepEqual(tr('Vida que seria perdida ao sofrer Dano é, ao invés, Reservada até que você não sofra mais Dano na Vida por {0} segundos', [2]).efeitos, [{ stat: 'dissolucao_reserva_s', valor: 2 }]);
  const a = tr('Com {0} Notáveis Alocados no Raio, Ao Matar um monstro Raro, você recebe {1} de seus Modificadores por {2} segundos', [4, 1, 20]);
  assert.equal(a.estado, 'equivalente');
  assert.deepEqual(a.efeitos, [{ stat: 'raio_aprendizado_notaveis', valor: 4 }, { stat: 'raio_aprendizado_n', valor: 1 }, { stat: 'raio_aprendizado_s', valor: 20 }]);
});

/** A Bruxa com a Bola de Fogo Vaal na varinha (nível 10: 30 Almas, 6 s de recarga), na Costa, com um alvo ao lado. */
function comVaal(af) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'sorcerer', level: 60 }), { classePoe: 'Witch' });
  const arma = peca('Wands/Driftwood_Wand');
  arma.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
  e.equipment = { ...e.equipment, weapon: arma, ring: anel(af) };
  e.inventory = [GS.itemDaGema({ id: GemasPoe.doSlug('Vaal_Fireball').itemId, nivel: 10, xp: 0, raridade: 'comum' })];
  GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: GemasPoe.doSlug('Vaal_Fireball').acao, enabled: true, minMana: 0, conditions: [] };
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  Object.assign(e, { mana: 1e6, maxMana: 1e6 });
  const h = e.hunt;
  h.clock = 100_000;
  h.monstros = h.monstros.filter((m) => !m.dummy).slice(0, 1);
  Object.assign(h.monstros[0], { x: h.pos.x + 1, y: h.pos.y, hp: 1e12, maxHp: 1e12 });
  const usar = () => {
    const r = Acoes.disparar(e, h, PERSONAGEM, 0, h.monstros[0], { manual: true });
    assert.equal(r.ok, true, r.erro);
    if (h.conjurando) { h.clock = h.conjurando.fim; Acoes.concluirConjuracao(e, h, PERSONAGEM); }
  };
  return { e, h, usar, id: e.actions[0].id };
}

test('o REINO DE ATZIRI: com 100% de chance de ganhar as Almas de volta, a Vaal usada não entra em recarga; sem a linha, entra (6 s)', { skip: SEM }, () => {
  const sem = comVaal({});
  sem.usar();
  assert.equal(sem.h.cooldowns[sem.id]?.total, 6000);
  const com = comVaal({ vaal_almas_de_volta_chance: 100 });
  com.usar();
  assert.equal(com.h.cooldowns[com.id], undefined);
});

test('o CALAFRIO DA CORRUPÇÃO: o inimigo Estilhaçado (morto Congelado) anda UMA alma da recarga da Vaal — 6 s ÷ 30 almas = 0,2 s', { skip: SEM }, () => {
  const { e, h, usar, id } = comVaal({ alma_vaal_ao_estilhacar: 100 });
  usar();
  const antes = h.cooldowns[id].ate;
  const congelado = { uid: 'x', hp: 0, estados: { congelado: { ate: h.clock + 5000 } } };
  ModsPoe.evento(e, h, 'matar', Ficha.combate(e), { alvo: congelado, rng: () => 0 });
  assert.equal(h.cooldowns[id].ate, antes - 200);
  // (o morto que não estava Congelado não é estilhaço)
  ModsPoe.evento(e, h, 'matar', Ficha.combate(e), { alvo: { uid: 'y', hp: 0, estados: {} }, rng: () => 0 });
  assert.equal(h.cooldowns[id].ate, antes - 200);
});

test('os lacaios AGRESSIVOS: o bicho a 3 casas além do alcance de sempre vira alvo; sem a linha, não', { skip: SEM }, () => {
  assert.equal(LacaiosPoe.oQueInvoca('Raise_Zombie', 20, null, { lacaios_agressivos: 1 }).poe.agressivo, true);
  assert.equal(LacaiosPoe.oQueInvoca('Raise_Zombie', 20, null, {}).poe.agressivo, false);
  const bicho = { uid: 'b', hp: 10, x: 10 + 2 + 5 + Cacadas.CASAS_DO_AGRESSIVO, y: 10 };
  const hunt = { pos: { x: 10, y: 10 }, monstros: [bicho], clock: 0 };
  assert.equal(Cacadas.alvoDoFamiliar(hunt, { perto: 2, x: 10, y: 10, poe: { agressivo: false } }, 0), null);
  assert.equal(Cacadas.alvoDoFamiliar(hunt, { perto: 2, x: 10, y: 10, poe: { agressivo: true } }, 0), bicho);
});

test('a DISSOLUÇÃO DA CARNE: a Vida perdida fica Reservada (não regenera acima) e volta depois de 2 s sem dano na Vida', { skip: SEM }, () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 60 });
  Object.assign(e, { hp: 1000, maxHp: 1000, hunt: { clock: 10_000 } });
  const ficha = { afPoe: { dissolucao_reserva_s: 2 } };
  const v = Arvore.danoRecebido(e, 300, [], null, null, { ficha });
  e.hp -= v;
  assert.equal(e.hunt.dissolucao.reservado, v);
  e.hp = 950; // (o que regenerasse não passa da Vida não Reservada)
  e.hunt.clock = 11_000;
  ModsPoe.tiqueDaDissolucao(e, e.hunt, ficha);
  assert.equal(e.hp, 1000 - v);
  e.hunt.clock = 12_000;
  ModsPoe.tiqueDaDissolucao(e, e.hunt, ficha);
  assert.equal(e.hp, 1000, 'a Reservada volta');
  assert.equal(e.hunt.dissolucao, undefined);
});

/** O Aprendizado Inspirado encaixado no encaixe com mais Notáveis no raio pequeno; `n` notáveis dele alocados. */
function comAprendizado(n) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 90 });
  e.sistema = 'poe';
  e.classePoe = 'Marauder';
  P.garantir(e);
  const nos = P.arvore().nos;
  const notaveis = (s) => nos.filter((x) => x.tipo === 'notable' && !x.ascendencia && Math.hypot(x.x - s.x, x.y - s.y) <= P.RAIOS_DE_JOIA.pequeno);
  const s = nos.filter((x) => P.ehEncaixeDeJoia(x)).sort((a, b) => notaveis(b).length - notaveis(a).length)[0];
  assert.ok(notaveis(s).length >= 4);
  e.passivas.alocados.push(s.id, ...notaveis(s).slice(0, n).map((x) => x.id));
  P.garantir(e);
  const u = Catalogo.catalogo().classes.Jewels.unicos.find((x) => x.slug === 'Inspired_Learning');
  const base = Catalogo.catalogo().classes.Jewels.bases.find((b) => b.nome === u.base);
  const joia = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: base.id, raridade: 'unico', ilvl: 80, rng: () => 0, unico: 'Inspired_Learning' }));
  e.inventory = [joia];
  assert.equal(Comandos.comando(e, { action: 'encaixarJoia', no: s.id, pilha: 0, id: joia.id }).ok, true);
  Ficha.invalidar(e);
  return e;
}

test('o APRENDIZADO INSPIRADO na árvore: com 4 Notáveis alocados no raio, o "ao matar um Raro" (1 modificador, 20 s); com 3, nada', { skip: SEM }, () => {
  const com4 = Ficha.combate(comAprendizado(4)).afPoe;
  assert.equal(com4.aprendizado_inspirado_n, 1);
  assert.equal(com4.aprendizado_inspirado_s, 20);
  assert.ok(!(Ficha.combate(comAprendizado(3)).afPoe.aprendizado_inspirado_n > 0));
});

test('o APRENDIZADO INSPIRADO no abate: o Raro dá 1 dos modificadores que têm equivalente em você, por 20 s; o Mágico, não', { skip: SEM }, () => {
  // (os modificadores do monstro em você: as linhas traduzidas — o Anti-Maldições não tem equivalente e fica de fora do sorteio)
  assert.deepEqual(Aprendizado.efeitosNoJogador('poe:Sem_Hexer'), []);
  assert.deepEqual(Aprendizado.efeitosNoJogador('poe:Sem_Frostweaver'), [{ stat: 'ice_dmg', valor: 50 }, { stat: 'ice_res', valor: 50 }, { stat: 'phys_as_extra_ice', valor: 50 }, { stat: 'phys_conv_ice', valor: 25 }]);
  const e = comAprendizado(4);
  e.actions = Array(Acoes.SLOTS).fill(null);
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  const h = e.hunt;
  h.clock = 100_000;
  Ficha.invalidar(e);
  const antes = Ficha.combate(e).afPoe.ice_res ?? 0;
  const mods = ['poe:Sem_Hexer', 'poe:Sem_Frostweaver'];
  ModsPoe.evento(e, h, 'matar', Ficha.combate(e), { alvo: { uid: 'm', hp: 0, raridade: 'modificado', mods: ['poe:Sem_Frostweaver'], estados: {} }, rng: () => 0 });
  assert.equal(Object.keys(h.poeTemporarios ?? {}).length, 0, 'o Mágico não dá');
  ModsPoe.evento(e, h, 'matar', Ficha.combate(e), { alvo: { uid: 'r', hp: 0, raridade: 'raro', mods, estados: {} }, rng: () => 0 });
  Ficha.invalidar(e);
  assert.equal((Ficha.combate(e).afPoe.ice_res ?? 0) - antes, 50, 'o Manipulador do Gelo (o único com equivalente)');
  // o mesmo modificador de outro Raro renova o tempo, não acumula
  h.clock += 10_000;
  ModsPoe.evento(e, h, 'matar', Ficha.combate(e), { alvo: { uid: 'r2', hp: 0, raridade: 'raro', mods, estados: {} }, rng: () => 0 });
  Ficha.invalidar(e);
  assert.equal((Ficha.combate(e).afPoe.ice_res ?? 0) - antes, 50);
  h.clock += 19_000;
  Ficha.invalidar(e);
  assert.equal((Ficha.combate(e).afPoe.ice_res ?? 0) - antes, 50, 'ainda dentro dos 20 s do segundo');
  h.clock += 2_000;
  Ficha.invalidar(e);
  assert.equal((Ficha.combate(e).afPoe.ice_res ?? 0) - antes, 0, 'acabou');
});
