// GEMAS DE SKILL, SUPPORTS e SOCKETS (systems/skills/gemas.mjs): a skill vem da gema encaixada numa
// peça vestida; as supports ligadas a modificam; XP e nível próprios; conjuração de verdade; migração.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Acoes from '../systems/acoes.mjs';
import * as Afixos from '../systems/afixos.mjs';
import * as Ficha from '../systems/ficha.mjs';
import * as Treino from '../systems/treino.mjs';
import * as Inventario from '../systems/inventario.mjs';
import * as G from '../systems/skills/gemas.mjs';
import { converterPersonagem, converterTudo } from '../systems/itens/item.mjs';
import { gerarItem } from '../systems/itens/gerar.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import { criarMonstro } from '../systems/hunt/monstros.mjs';
import { personagemDeTeste, PERSONAGEM } from './apoio.mjs';

const idDe = (nome) => Number(Object.values(ITEM_CATALOG).find((i) => i.name === nome).id);
const GEMA = (acao) => G.ITEM_DA_ACAO.get(acao);
const SUPPORT = (id) => [...G.DEFS.values()].find((d) => d.tipo === 'support' && d.id === id).itemId;
const FLAME = 'spell-flame-strike';
/** Uma gema já num nível (nos testes; de verdade toda gema nasce no 1). */
const gemaNv = (itemId, nivel, raridade = 'comum') => ({ ...G.novaGema(itemId, raridade), nivel });

/** Uma peça no slot com sockets (abertos, links) e as gemas. */
function vestir(e, slot, nome, { abertos, links = [], gemas = [] } = {}) {
  const id = idDe(nome);
  const max = G.maximoDeSockets(ITEM_CATALOG[id]);
  e.equipment[slot] = { id, count: 1, soquetes: { abertos: abertos ?? max, links: Array.from({ length: max - 1 }, (_, i) => !!links[i]), gemas: Array.from({ length: max }, (_, i) => gemas[i] ?? null) } };
  Ficha.invalidar(e);
  return e.equipment[slot];
}
function naCacada(e) {
  Treino.garantir(e);
  e.magic.value = 60;
  e.maxMana = e.mana = 1e9;
  Cacadas.entrar(e, { huntId: 'troll-cave', mode: 'auto' });
  const h = e.hunt;
  delete h.instancia;
  h.respawns = [];
  h.outrosAndares = {};
  const m = criarMonstro({ key: 'troll', x: h.pos.x + 1, y: h.pos.y }, null);
  m.hp = m.maxHp = 1e12;
  delete m.spawn;
  h.monstros.splice(0, h.monstros.length, m);
  h.alvo = m.uid;
  return m;
}
function comSemente(fn) {
  const original = Math.random;
  let s = 11;
  Math.random = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}
/** O dano de 30 lançamentos da Flame Strike com o arranjo de sockets `montar(e)` (conjuração zerada: mede só o dano). */
function danoDaFlame(montar) {
  G.DEFS.get(GEMA(FLAME)).castTime = 0;
  return comSemente(() => {
    const e = personagemDeTeste({ vocacao: 'sorcerer', level: 200 });
    montar(e);
    const bicho = naCacada(e);
    e.actions = Array(Acoes.SLOTS).fill(null);
    const slot = Acoes.PAPEL_DO_SLOT.indexOf('attack');
    assert.ok(Acoes.definir(e, { slot, value: { id: FLAME } }).ok);
    for (let i = 0; i < 30; i++) {
      e.hunt.cooldowns = {};
      e.hunt.ultimoAtaqueEm = null;
      Acoes.disparar(e, e.hunt, PERSONAGEM, slot, bicho);
    }
    return 1e12 - bicho.hp;
  });
}

// ---------------------------------------------------------------- sockets por slot (14–22)

test('14–22. máximo de sockets por slot: Weapon 4, Head 2, Body 4, Shield 3, Legs 2 (no lugar de Gloves), Boots 2, Ring 1, Amulet 1 — 19 no total', () => {
  const porSlot = { weapon: 4, head: 2, body: 4, shield: 3, legs: 2, feet: 2, ring: 1, neck: 1 };
  for (const [slot, n] of Object.entries(porSlot)) {
    const meta = Object.values(ITEM_CATALOG).find((i) => i.slot === slot && !i.stackable);
    assert.equal(G.maximoDeSockets(meta), n, slot);
  }
  assert.equal(Object.values(G.CONFIG.sockets.maximo).reduce((a, b) => a + b, 0), 19);
  assert.equal(G.maximoDeSockets(Object.values(ITEM_CATALOG).find((i) => i.slot === 'ammo')), 0, 'munição não tem');
  assert.equal(G.maximoDeSockets(Object.values(ITEM_CATALOG).find((i) => i.slot === 'backpack')), 0, 'mochila não tem');
  // Um anel só (não existe Ring 1 / Ring 2).
  assert.ok(!Object.keys(G.CONFIG.sockets.maximo).some((k) => /ring\d/.test(k)));
});

test('drop: os sockets abertos saem sorteados (nunca acima do máximo do slot) e não contam como mod', () => {
  const ESPADA = idDe('fire sword');
  let algum = false;
  for (let i = 0; i < 300; i++) {
    const p = gerarItem({ itemId: ESPADA, itemLevel: 700, raridade: 'raro' });
    if (!p.soquetes) continue;
    algum ||= p.soquetes.abertos > 0;
    assert.ok(p.soquetes.abertos <= 4);
    assert.ok(p.af.length >= 2 && p.af.length <= 3, 'raro continua com 2–3 mods');
  }
  assert.ok(algum);
});

// ---------------------------------------------------------------- sem gema, sem skill (26, 28)

test('sem a gema a skill não existe (Action Bar); encaixada, existe; tirada, some de novo', () => {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 200 });
  const ver = () => Acoes.catalogo(e).spells.find((x) => x.id === FLAME).blocked;
  assert.equal(ver(), 'sem a gema');
  vestir(e, 'weapon', 'wand of vortex', { abertos: 1 });
  e.inventory.push(G.itemDaGema(gemaNv(GEMA(FLAME), 3)));
  assert.equal(G.encaixar(e, { de: e.inventory.length - 1, slot: 'weapon', indice: 0 }).ok, true);
  assert.equal(ver(), null);
  assert.equal(Acoes.catalogo(e).spells.find((x) => x.id === FLAME).gema.nivel, 3);
  // 28. tirada do socket: deixa de valer, e a gema volta para a mochila com o nível dela.
  assert.equal(G.tirar(e, { slot: 'weapon', indice: 0 }).ok, true);
  assert.equal(ver(), 'sem a gema');
  assert.deepEqual(e.inventory.at(-1), { id: GEMA(FLAME), count: 1, raridade: 'comum', gema: { nivel: 3, xp: 0, qualidade: 0 } });
});

test('10–11. socket aberto aceita; socket bloqueado recusa encaixar', () => {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 200 });
  vestir(e, 'weapon', 'wand of vortex', { abertos: 2 });
  e.inventory.push(G.itemDaGema(G.novaGema(GEMA(FLAME))));
  const k = e.inventory.length - 1;
  assert.match(G.encaixar(e, { de: k, slot: 'weapon', indice: 2 }).erro, /bloqueado/);
  assert.match(G.encaixar(e, { de: k, slot: 'weapon', indice: 9 }).erro, /inexistente/);
  assert.equal(G.encaixar(e, { de: k, slot: 'weapon', indice: 1 }).ok, true);
  assert.equal(e.equipment.weapon.soquetes.gemas[1].id, GEMA(FLAME));
  // Encaixar em socket ocupado troca: a que estava volta para a mochila.
  e.inventory.push(G.itemDaGema(G.novaGema(GEMA('spell-energy-strike'))));
  assert.equal(G.encaixar(e, { de: e.inventory.length - 1, slot: 'weapon', indice: 1 }).ok, true);
  assert.equal(e.inventory.at(-1).id, GEMA(FLAME));
  e.inventory.push({ id: idDe('fire sword'), count: 1 });
  assert.match(G.encaixar(e, { de: e.inventory.length - 1, slot: 'weapon', indice: 0 }).erro, /não é uma gema/);
});

// ---------------------------------------------------------------- links e supports (12, 13, 29)

test('12–13. support LIGADA à gema ativa modifica a skill; a mesma support sem link, não', () => {
  const GD = SUPPORT('greater-damage');
  const sem = danoDaFlame((e) => vestir(e, 'weapon', 'wand of vortex', { gemas: [G.novaGema(GEMA(FLAME))] }));
  const ligada = danoDaFlame((e) => vestir(e, 'weapon', 'wand of vortex', { links: [true], gemas: [G.novaGema(GEMA(FLAME)), G.novaGema(GD)] }));
  const solta = danoDaFlame((e) => vestir(e, 'weapon', 'wand of vortex', { links: [false], gemas: [G.novaGema(GEMA(FLAME)), G.novaGema(GD)] }));
  assert.ok(Math.abs(ligada / sem - 1.25) < 0.03, `ligada ${sem} → ${ligada}`);
  assert.equal(solta, sem, 'sem link a support não faz nada');
  // Numa OUTRA peça também não (link é dentro da peça).
  const outraPeca = danoDaFlame((e) => {
    vestir(e, 'weapon', 'wand of vortex', { gemas: [G.novaGema(GEMA(FLAME))] });
    vestir(e, 'ring', 'might ring', { gemas: [G.novaGema(GD)] });
  });
  assert.equal(outraPeca, sem);
});

test('29. support removida deixa de modificar; compatibilidade por tags (Multiple Projectiles só em Projectile)', () => {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 200 });
  vestir(e, 'weapon', 'wand of vortex', { links: [true, true], gemas: [G.novaGema(GEMA(FLAME)), G.novaGema(SUPPORT('greater-damage')), G.novaGema(SUPPORT('multiple-projectiles'))] });
  assert.deepEqual(G.efeitoNaSkill(e, FLAME).supports, ['Greater Damage', 'Multiple Projectiles']);
  G.tirar(e, { slot: 'weapon', indice: 1 });
  assert.deepEqual(G.efeitoNaSkill(e, FLAME).supports, ['Multiple Projectiles']);
  assert.equal(G.efeitoNaSkill(e, FLAME).danoPct, 0);
  // Brutal Strike (corpo a corpo, sem Projectile): Multiple Projectiles ligada não vale.
  const k = personagemDeTeste({ vocacao: 'knight', level: 200 });
  vestir(k, 'weapon', 'fire sword', { links: [true], gemas: [G.novaGema(GEMA('spell-brutal-strike')), G.novaGema(SUPPORT('multiple-projectiles'))] });
  assert.deepEqual(G.efeitoNaSkill(k, 'spell-brutal-strike').supports, []);
});

test('Multiple Projectiles: os bichos ao alcance levam o projétil também', () => {
  G.DEFS.get(GEMA(FLAME)).castTime = 0;
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 200 });
  vestir(e, 'weapon', 'wand of vortex', { links: [true], gemas: [G.novaGema(GEMA(FLAME)), G.novaGema(SUPPORT('multiple-projectiles'))] });
  const alvo = naCacada(e);
  const outros = [2, 3].map((dx) => Object.assign(criarMonstro({ key: 'troll', x: e.hunt.pos.x + dx, y: e.hunt.pos.y }, null), { hp: 1e9, maxHp: 1e9 }));
  e.hunt.monstros.push(...outros);
  const slot = Acoes.PAPEL_DO_SLOT.indexOf('attack');
  e.actions = Array(Acoes.SLOTS).fill(null);
  assert.ok(Acoes.definir(e, { slot, value: { id: FLAME } }).ok);
  const r = Acoes.disparar(e, e.hunt, PERSONAGEM, slot, alvo);
  assert.ok(r.ok);
  assert.ok(outros.every((b) => b.hp < 1e9), 'os dois extras apanharam');
});

// ---------------------------------------------------------------- XP e nível (8, 9)

test('8–9. XP da gema: as encaixadas em peça vestida ganham a exp das mortes; sobe de nível, com teto no level do personagem', () => {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 30 });
  const def = G.DEFS.get(GEMA(FLAME));
  const peca = vestir(e, 'weapon', 'wand of vortex', { gemas: [G.novaGema(GEMA(FLAME))] });
  const naMochila = G.itemDaGema(G.novaGema(GEMA('spell-energy-strike')));
  e.inventory.push(naMochila);
  const subiram = G.ganharXp(e, G.xpParaSubir(1) + 10);
  assert.deepEqual(subiram, [{ nome: 'Flame Strike', nivel: 2 }]);
  assert.equal(peca.soquetes.gemas[0].xp, 10);
  assert.equal(naMochila.gema.xp, 0, 'gema fora de socket não ganha XP');
  // O level 30 deixa até o nível `nivelPermitido`; a XP para no que falta para o próximo.
  G.ganharXp(e, 1e9);
  const g = peca.soquetes.gemas[0];
  assert.equal(g.nivel, G.nivelPermitido(def, 30));
  assert.equal(g.xp, G.xpParaSubir(g.nivel), 'guardada até o personagem subir');
  e.level = 200;
  G.ganharXp(e, 1);
  assert.ok(g.nivel > G.nivelPermitido(def, 30), 'o personagem subiu: a gema também');
  // Por XP, para no 30 (decisão do dono); acima, só bônus de item.
  e.level = 5000;
  for (let i = 0; i < 40; i++) G.ganharXp(e, 1e15);
  assert.equal(g.nivel, G.CONFIG.niveis.maximo);
  assert.equal(G.CONFIG.niveis.maximo, 30);
});

test('o nível da gema aumenta o dano da skill (a tabela por nível da gema, não o level)', () => {
  const n1 = danoDaFlame((e) => vestir(e, 'weapon', 'wand of vortex', { gemas: [gemaNv(GEMA(FLAME), 1)] }));
  const n11 = danoDaFlame((e) => vestir(e, 'weapon', 'wand of vortex', { gemas: [gemaNv(GEMA(FLAME), 11)] }));
  const esperado = G.CONFIG.dano.crescimento ** 10;
  assert.ok(Math.abs(n11 / n1 / esperado - 1) < 0.03, `${n1} → ${n11} (×${esperado})`);
});

test('a XP das gemas vem da morte de verdade (matarMonstro)', async () => {
  const { matarMonstro } = await import('../systems/hunt/combate.mjs');
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 200 });
  const peca = vestir(e, 'weapon', 'wand of vortex', { gemas: [G.novaGema(GEMA(FLAME))] });
  naCacada(e);
  const m = criarMonstro({ key: 'troll', x: 1, y: 1 }, null);
  e.hunt.monstros.push(m);
  matarMonstro(e, e.hunt, PERSONAGEM, m, []);
  assert.ok(peca.soquetes.gemas[0].xp > 0 || peca.soquetes.gemas[0].nivel > 1);
});

// ---------------------------------------------------------------- vestir / tirar a peça (27)

test('27. tirar a peça tira as skills das gemas dela; vestir de novo, voltam (as gemas vão junto com a peça)', () => {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 200 });
  vestir(e, 'ring', 'might ring', { gemas: [gemaNv(GEMA(FLAME), 4)] });
  assert.ok(G.temSkill(e, FLAME));
  assert.notEqual(Inventario.desequipar(e, { slot: 'ring' }).ok, false);
  assert.ok(!G.temSkill(e, FLAME));
  const naMochila = e.inventory.find((p) => p.id === idDe('might ring'));
  assert.equal(naMochila.soquetes.gemas[0].nivel, 4, 'a gema continua na peça');
  assert.notEqual(Inventario.equipar(e, { id: idDe('might ring') }).ok, false);
  assert.ok(G.temSkill(e, FLAME));
});

// ---------------------------------------------------------------- conjuração

test('conjuração de verdade: a skill só sai no fim do Cast Time; durante ela nada mais sai; cancela se o alvo morre', () => {
  const def = G.DEFS.get(GEMA(FLAME));
  def.castTime = 800;
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 200 });
  vestir(e, 'weapon', 'wand of vortex', { gemas: [G.novaGema(GEMA(FLAME)), G.novaGema(GEMA('spell-energy-strike'))] });
  const alvo = naCacada(e);
  e.actions = Array(Acoes.SLOTS).fill(null);
  const [s1, s2] = [11, 12];
  assert.ok(Acoes.definir(e, { slot: s1, value: { id: FLAME } }).ok);
  assert.ok(Acoes.definir(e, { slot: s2, value: { id: 'spell-energy-strike' } }).ok);
  const h = e.hunt;
  h.clock = 10_000;
  const r = Acoes.disparar(e, h, PERSONAGEM, s1, alvo);
  assert.ok(r.ok && r.conjurando);
  assert.equal(r.eventos[0].t, 'cast');
  const ms = r.eventos[0].ms;
  assert.ok(ms > 0 && ms <= 800);
  assert.equal(alvo.hp, alvo.maxHp, 'ainda não saiu');
  assert.equal(Acoes.disparar(e, h, PERSONAGEM, s2, alvo).motivo, 'CONJURANDO', 'outra skill espera');
  // (o relógio tem meio tique de folga — `R.jaPode` —, por isso a margem de 200 ms)
  h.clock += ms - 200;
  assert.deepEqual(Acoes.concluirConjuracao(e, h, PERSONAGEM), [], 'ainda conjurando');
  h.clock += 200;
  const fim = Acoes.concluirConjuracao(e, h, PERSONAGEM);
  assert.equal(fim[0].t, 'castFim');
  assert.ok(alvo.hp < alvo.maxHp, 'saiu no fim');
  assert.equal(h.conjurando, null);
  // Cancela: o alvo morre no meio.
  h.cooldowns = {};
  h.ultimoAtaqueEm = null;
  h.clock += 5000;
  assert.ok(Acoes.disparar(e, h, PERSONAGEM, s1, alvo).conjurando);
  alvo.hp = 0;
  assert.equal(Acoes.concluirConjuracao(e, h, PERSONAGEM)[0].t, 'castCancel');
  // Faster Casting + Cast Speed encurtam.
  const sem = G.tempoDeConjuracao(e, FLAME, 0);
  vestir(e, 'weapon', 'wand of vortex', { links: [true], gemas: [G.novaGema(GEMA(FLAME)), G.novaGema(SUPPORT('faster-casting'))] });
  assert.equal(G.tempoDeConjuracao(e, FLAME, 0), Math.round(sem * 0.8));
  assert.equal(G.tempoDeConjuracao(e, FLAME, 25), Math.round((sem * 0.8) / 1.25));
});

test('runa virou gema: não gasta mais item nem ouro', () => {
  const RUNA = 'rune-fireball-rune';
  G.DEFS.get(GEMA(RUNA)).castTime = 0;
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 200 });
  vestir(e, 'weapon', 'wand of vortex', { gemas: [G.novaGema(GEMA(RUNA))] });
  const alvo = naCacada(e);
  e.gold = 0;
  e.actions = Array(Acoes.SLOTS).fill(null);
  const slot = Acoes.PAPEL_DO_SLOT.indexOf('attack');
  assert.ok(Acoes.definir(e, { slot, value: { id: RUNA } }).ok);
  assert.equal(Acoes.disparar(e, e.hunt, PERSONAGEM, slot, alvo).ok, true);
  assert.ok(alvo.hp < alvo.maxHp);
  assert.equal(e.gold, 0);
});

// ---------------------------------------------------------------- migração v5

test('migração v5: peças que existiam ganham todos os sockets abertos e ligados; as magias/runas da barra viram gemas encaixadas', () => {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 120 });
  for (const p of Object.values(e.equipment)) if (p) delete p.soquetes;
  e.versaoDosItens = 4;
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[11] = { id: FLAME };
  e.actions[12] = { id: 'spell-energy-strike' };
  e.actions[13] = { id: 'rune-fireball-rune' };
  const pocao = Acoes.catalogo(e).items[0];
  e.actions[0] = { id: pocao.id };
  e.inventory.push({ id: idDe('fire sword'), count: 1 });
  converterPersonagem(e);
  const arma = e.equipment.weapon;
  const max = G.maximoDeSockets(ITEM_CATALOG[arma.id]);
  assert.equal(arma.soquetes.abertos, max);
  assert.ok(arma.soquetes.links.every(Boolean));
  assert.ok(e.inventory.find((p) => p.id === idDe('fire sword')).soquetes, 'a da mochila também');
  for (const id of [FLAME, 'spell-energy-strike', 'rune-fireball-rune']) {
    assert.ok(G.temSkill(e, id), `${id} encaixada`);
    assert.equal(G.skillsAtivas(e).get(id).nivel, 1, 'toda gema começa no nível 1');
  }
  assert.ok(!G.ITEM_DA_ACAO.has(pocao.id), 'poção não vira gema');
  // Uma vez só.
  assert.equal(converterPersonagem(e), 0);
  // Peça sem sockets vinda de outro caminho (loja, mercado) não ganha: só a migração do personagem abre.
  const solta = { id: idDe('fire sword'), count: 1 };
  converterTudo({ x: [solta] });
  assert.equal(solta.soquetes, undefined);
});

test('drop de gema: sai no nível 1, entre as skills do level da fase; parte são supports', () => {
  let ativas = 0;
  let supports = 0;
  for (let i = 0; i < 4000; i++) {
    const g = G.sortearDrop({ ato: 4, levelDaFase: 50, fatorDeChance: 100 });
    if (!g) continue;
    const def = G.DEFS.get(g.id);
    assert.equal(g.gema.nivel, 1);
    if (def.tipo === 'support') supports++;
    else {
      ativas++;
      assert.ok(def.levelMinimo <= 50);
    }
  }
  assert.ok(ativas > 0 && supports > 0);
  assert.equal(G.sortearDrop({ ato: 1 }, () => 0.99), null, 'a chance é baixa');
});

// ---------------------------------------------------------------- loja da Zuma Magehide

test('loja da Zuma: lista gemas ativas (preço pelo level) e supports (preço fixo)', () => {
  const e = personagemDeTeste({ level: 50 });
  const lista = G.catalogoDaLoja(e);
  const flame = lista.find((l) => l.chave === `${GEMA(FLAME)}:comum`);
  const def = G.DEFS.get(GEMA(FLAME));
  assert.equal(flame.buy, G.CONFIG.loja.precoBase + G.CONFIG.loja.precoPorLevel * def.levelMinimo);
  assert.equal(lista.find((l) => l.chave === `${SUPPORT('greater-damage')}:comum`).buy, G.CONFIG.loja.precoDoSupport);
  // Só comum e incomum (decisão do dono); a incomum custa mais.
  assert.deepEqual([...new Set(lista.map((l) => l.raridade))], ['comum', 'incomum']);
  assert.equal(lista.find((l) => l.chave === `${GEMA(FLAME)}:incomum`).buy, flame.buy * G.CONFIG.loja.precoPorRaridade.incomum);
  assert.equal(G.CONFIG.loja.npc, 'zuma');
});

test('loja da Zuma: compra paga do bolso e depois do banco; gema nível 1 na mochila', () => {
  const e = personagemDeTeste({ level: 50 });
  const preco = G.precoNaLoja(G.DEFS.get(GEMA(FLAME)));
  e.gold = preco;
  e.bank = preco;
  e.inventory = [];
  const r = G.comprarNaLoja(e, { id: GEMA(FLAME), count: 2 });
  assert.equal(r.ok, true);
  assert.equal(e.gold, 0);
  assert.equal(e.bank, 0);
  assert.equal(e.inventory.filter((p) => p.id === GEMA(FLAME) && p.gema?.nivel === 1).length, 2);
  assert.equal(G.comprarNaLoja(e, { id: GEMA(FLAME) }).ok, false, 'sem ouro');
  assert.equal(G.comprarNaLoja(e, { id: 3031 }).ok, false, 'não é gema');
  e.gold = 1e9;
  assert.match(G.comprarNaLoja(e, { id: GEMA(FLAME), raridade: 'raro' }).erro, /comuns e incomuns/);
  assert.equal(G.comprarNaLoja(e, { id: GEMA(FLAME), raridade: 'incomum' }).ok, true);
  assert.equal(e.inventory.at(-1).raridade, 'incomum');
  assert.equal(e.inventory.at(-1).gema.nivel, 1);
});

// ---------------------------------------------------------------- uso automático por tags

test('condição "bichos por perto": inimigos ≥ 3 libera a área; menos, não', () => {
  const e = personagemDeTeste({ level: 50 });
  const bicho = (x) => ({ hp: 10, x, y: 0 });
  const hunt = { pos: { x: 0, y: 0 }, monstros: [bicho(1), bicho(2), bicho(30)] };
  const acao = { conditions: [{ kind: 'perto', op: 'gte', value: 3 }] };
  assert.equal(Acoes.condicoesDoSlotBatem(acao, e, null, hunt), false, 'só 2 no raio');
  hunt.monstros.push(bicho(3));
  assert.equal(Acoes.condicoesDoSlotBatem(acao, e, null, hunt), true);
  hunt.monstros[0].hp = 0;
  assert.equal(Acoes.condicoesDoSlotBatem(acao, e, null, hunt), false, 'morto não conta');
  assert.equal(Acoes.condicoesDoSlotBatem(acao, e, null, null), false, 'sem hunt não bate');
});

test('condição "boss": só na sala do boss (ou só fora dela)', () => {
  const e = personagemDeTeste({ level: 50 });
  const so = { conditions: [{ kind: 'boss', op: 'sim' }] };
  const fora = { conditions: [{ kind: 'boss', op: 'nao' }] };
  assert.equal(Acoes.condicoesDoSlotBatem(so, e, null, { isBoss: true }), true);
  assert.equal(Acoes.condicoesDoSlotBatem(so, e, null, { isBoss: false }), false);
  assert.equal(Acoes.condicoesDoSlotBatem(fora, e, null, { isBoss: false }), true);
});

// ---------------------------------------------------------------- raridade e nível sem teto

test('raridade da gema multiplica o crescimento do dano (acima do nível 1) e o efeito da support', () => {
  const def = G.DEFS.get(GEMA(FLAME));
  const media = (n, r) => { const d = G.danoDaGema(def, n, r); return (d.min + d.max) / 2; };
  const D = G.CONFIG.dano;
  const b1 = D.base * def.efetividade, b11 = D.base * D.crescimento ** 10 * def.efetividade;
  assert.ok(Math.abs(media(11, 'comum') - b11) <= 1);
  assert.ok(Math.abs(media(11, 'mítico') - (b1 + (b11 - b1) * 2)) <= 1);
  // No nível 1 a raridade não muda nada ainda (só multiplica o que cresce acima dele).
  assert.deepEqual(G.danoDaGema(def, 1, 'mítico'), G.danoDaGema(def, 1, 'comum'));
  // A support: o efeito inteiro × a raridade.
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 200 });
  const gd = G.DEFS.get(SUPPORT('greater-damage')).suporte.efeito.danoPct;
  vestir(e, 'weapon', 'wand of vortex', { links: [true], gemas: [gemaNv(GEMA(FLAME), 11), gemaNv(SUPPORT('greater-damage'), 1, 'raro')] });
  assert.equal(G.efeitoNaSkill(e, FLAME).danoPct, gd * 1.3);
});

test('gema que cai de bicho: nível 1 e raridade sorteada pelos pesos (a loja não passa da incomum)', () => {
  let i = 0;
  const seq = [0, 0.5, 0.999999, 0.999999]; // cai; ativa; a gema; raridade no fim da tabela (mítico)
  const rng = () => seq[i++ % seq.length];
  const g = G.sortearDrop({ ato: 1, levelDaFase: 100 }, rng);
  assert.equal(g.gema.nivel, 1);
  assert.equal(g.raridade, 'mítico');
  const cont = {};
  for (let k = 0; k < 20000; k++) {
    const r = G.sortearRaridade();
    cont[r] = (cont[r] ?? 0) + 1;
  }
  assert.ok(cont.comum > cont.incomum && cont.incomum > cont.raro && cont.raro > (cont['épico'] ?? 0));
});

test('curva de XP: 1–10 fácil, 10–20 normal, 20–30 difícil (fração da exp do personagem no mesmo trecho)', async () => {
  const R = await import('../systems/regras.mjs');
  const N = G.CONFIG.niveis;
  const trecho = (n) => R.expForLevel(1 + n * N.levelsPorNivel) - R.expForLevel(1 + (n - 1) * N.levelsPorNivel);
  const parte = (n) => G.xpParaSubir(n) / trecho(n);
  const [facil, normal, dificil] = N.faixas.map((f) => f.parteDaExpDoPersonagem);
  assert.ok(Math.abs(parte(3) - facil) < 0.001, '1–10: fácil');
  assert.ok(Math.abs(parte(14) - normal) < 0.001, '10–20: normal');
  assert.ok(Math.abs(parte(25) - dificil) < 0.001, '20–30: difícil');
  assert.ok(facil < normal && normal < dificil);
  assert.ok(G.xpParaSubir(29) > G.xpParaSubir(28));
});

// ---------------------------------------------------------------- modelo Path of Exile: 20 + qualidade + nível de item

test('qualidade: +1% de dano por 1% na ativa; a support rende × (1 + qualidade%)', () => {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 200 });
  vestir(e, 'weapon', 'wand of vortex', { links: [true], gemas: [{ ...G.novaGema(GEMA(FLAME)), qualidade: 20 }, { ...G.novaGema(SUPPORT('greater-damage')), qualidade: 10 }] });
  const gd = G.DEFS.get(SUPPORT('greater-damage')).suporte.efeito.danoPct;
  assert.equal(Math.round(G.efeitoNaSkill(e, FLAME).danoPct * 100) / 100, Math.round((20 + gd * 1.1) * 100) / 100);
});

test('Lapidadora: sobe a qualidade (até 20%) da gema na mochila ou no socket, e é consumida', () => {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 200 });
  e.inventory = [{ id: G.LAPIDADORA, count: 2 }, G.itemDaGema({ ...G.novaGema(GEMA(FLAME)), qualidade: 18 })];
  const r = G.lapidar(e, { de: 1 }, () => 0.99);
  assert.equal(r.ok, true);
  assert.equal(e.inventory[1].gema.qualidade, 20, 'não passa de 20');
  assert.equal(e.inventory[0].count, 1);
  assert.match(G.lapidar(e, { de: 1 }).erro, /20%/);
  vestir(e, 'weapon', 'wand of vortex', { gemas: [G.novaGema(GEMA(FLAME))] });
  assert.equal(G.lapidar(e, { slot: 'weapon', indice: 0 }, () => 0).ok, true);
  assert.equal(e.equipment.weapon.soquetes.gemas[0].qualidade, G.CONFIG.qualidade.lapidadora.ganho[0]);
  assert.ok(!e.inventory.some((p) => p.id === G.LAPIDADORA), 'a última foi gasta');
  assert.match(G.lapidar(e, { de: 0 }).erro, /não tem Lapidadora/);
});

test('nível 31+: o add "+N ao nível das gemas" da peça soma no nível de todas as gemas dela', () => {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 5000 });
  const peca = vestir(e, 'weapon', 'wand of vortex', { links: [true], gemas: [gemaNv(GEMA(FLAME), 30), gemaNv(SUPPORT('greater-damage'), 30)] });
  peca.af = [{ id: 'gem_level', nivel: 3, value: 2 }];
  Ficha.invalidar(e);
  const a = G.skillsAtivas(e).get(FLAME);
  assert.equal(a.nivel, 32);
  assert.equal(a.nivelBase, 30);
  assert.equal(a.supports[0].nivel, 32);
  // Por XP a gema continua parada no 30.
  G.ganharXp(e, 1e15);
  assert.equal(peca.soquetes.gemas[0].nivel, 30);
});

test('o add de nível das gemas sai pela raridade da peça (+1; épica e acima +2) e só em peça com socket', async () => {
  const { gerarItem } = await import('../systems/itens/gerar.mjs');
  const { poolDe } = await import('../systems/itens/gerar.mjs');
  assert.ok(poolDe(idDe('wand of vortex')).includes('gem_level'));
  let visto = {};
  for (let i = 0; i < 4000 && Object.keys(visto).length < 2; i++) {
    for (const raridade of ['raro', 'épico']) {
      const p = gerarItem({ itemId: idDe('wand of vortex'), raridade, itemLevel: 500 });
      const a = p.af?.find((x) => x.id === 'gem_level');
      if (a) visto[raridade] = a.value;
    }
  }
  assert.deepEqual(visto, { raro: 1, 'épico': 2 });
});

test('dano da gema: tabela × efetividade (recarga, área, runa) × `fatorDeDano`; sem level de skill', () => {
  const def = G.DEFS.get(GEMA(FLAME));
  assert.equal(def.levelMinimo, 1, 'a skill não tem level próprio');
  assert.equal(G.levelNecessario(def, 20), 1 + 19 * G.CONFIG.niveis.levelsPorNivel);
  const x = { ...def, fatorDeDano: 2 };
  const um = G.danoDaGema(def, 20), dois = G.danoDaGema(x, 20);
  assert.ok(Math.abs(dois.max / um.max - 2) < 0.03);
  // Recarga longa rende mais por uso (√recarga); runa rende 0,8; área rende menos por alvo.
  const ef = (id) => G.DEFS.get(GEMA(id)).efetividade;
  assert.ok(ef('spell-ultimate-flame-strike') > ef(FLAME));
  assert.ok(ef('rune-great-fireball-rune') < ef('rune-sudden-death-rune'));
});
