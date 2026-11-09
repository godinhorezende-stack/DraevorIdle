// O motor de PROJÉTIL e ÁREA (systems/skills/golpes-secundarios.mjs, etapa 3): as
// supports de projétil (mais projéteis, perfurar, bifurcar, encadear, retornar),
// de golpe (explosão, impacto) e de área (aumentar, concentrar) — genéricas por tag,
// e a combinação pedida: Fireball + Multiple Projectiles + Pierce + Explosion + Faster Casting.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Acoes from '../systems/acoes.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Ficha from '../systems/ficha.mjs';
import * as Treino from '../systems/treino.mjs';
import * as G from '../systems/skills/gemas.mjs';
import * as S from '../systems/skills/golpes-secundarios.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import { criarMonstro } from '../systems/hunt/monstros.mjs';
import { personagemDeTeste, PERSONAGEM, HUNT_DE_TESTE, pousarVoos } from './apoio.mjs';
import { doClassico, soNoOficial } from './apoio-migracao.mjs';

const GEMA = (acao) => G.ITEM_DA_ACAO.get(acao);
const SUP = (id) => [...G.DEFS.values()].find((d) => d.tipo === 'support' && d.id === id).itemId;
const idDe = (nome) => Number(Object.values(ITEM_CATALOG).find((i) => i.name === nome).id);
const HP = 1e12;

/** Personagem com a skill e as supports LIGADAS na arma (4 sockets). */
function montar(vocacao, acao, supports = []) {
  const e = personagemDeTeste({ vocacao, level: 300 });
  Treino.garantir(e);
  const arma = vocacao === 'knight' ? 'fire sword' : 'wand of vortex';
  const gemas = [G.novaGema(GEMA(acao)), ...supports.map((s) => G.novaGema(SUP(s)))];
  e.equipment.weapon = { id: idDe(arma), count: 1, soquetes: { abertos: 4, links: [true, true, true], gemas: [...gemas, ...Array(4 - gemas.length).fill(null)] } };
  Ficha.invalidar(e);
  assert.ok(Cacadas.entrar(e, { huntId: HUNT_DE_TESTE, mode: 'auto' }).ok);
  const h = e.hunt;
  delete h.instancia;
  h.respawns = [];
  h.monstros = [];
  e.maxHp = e.hp = 1e12;
  e.maxMana = e.mana = 1e12;
  return e;
}
const bicho = (e, dx, dy) => {
  const m = Object.assign(criarMonstro({ key: 'troll', x: e.hunt.pos.x + dx, y: e.hunt.pos.y + dy }, null), { hp: HP, maxHp: HP });
  e.hunt.monstros.push(m);
  return m;
};
function lancar(e, acao, alvo) {
  const h = e.hunt;
  e.actions = Array(Acoes.SLOTS).fill(null);
  const slot = Acoes.PAPEL_DO_SLOT.indexOf('attack');
  assert.equal(Acoes.definir(e, { slot, value: { id: acao } }).ok, true);
  h.cooldowns = {};
  delete h.ultimoAtaqueEm;
  delete h.conjurando;
  const r = Acoes.disparar(e, h, PERSONAGEM, slot, alvo);
  if (r.conjurando) {
    h.conjurando.fim = 0;
    return Acoes.concluirConjuracao(e, h, PERSONAGEM);
  }
  assert.notEqual(r.ok, false, r.erro);
  return r.eventos;
}
const quantasVezes = (eventos, m) => eventos.filter((ev) => ev.t === 'dmg' && ev.uid === m.uid).length;
const FLAME = 'spell-flame-strike'; // fire, projectile, single, hit

// (08/11, adaptado ao PoE — o dono: "Adaptar antes") As gemas do PoE numa varinha do PoE (a ativa e os suportes ligados): a Flame Strike → o Dreno de
// Essência (um projétil só, sem área no impacto e que não atravessa sozinho), a Fire Wave → a Nova de Gelo (a área em volta de você); os suportes, os do PoE
// (no nível 1). O golpe do projétil cai quando ele chega (`pousarVoos`).
const PROJETIL = 'Essence_Drain';
async function montarPoe(ativa, suportes = []) {
  const GP = await import('../systems/itens-poe/gemas-poe.mjs');
  const SP = await import('../systems/itens-poe/suportes-poe.mjs');
  const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
  const J = await import('../systems/itens-poe/jogo.mjs');
  const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 90 });
  const a = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Wands/Driftwood_Wand', raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
  const slugs = [ativa, ...suportes];
  a.soquetes = { abertos: slugs.length, links: Array(slugs.length - 1).fill(true), gemas: Array(slugs.length).fill(null), cores: Array(slugs.length).fill('W') };
  e.equipment = { ...e.equipment, weapon: a };
  delete e.equipment.shield;
  e.inventory = slugs.map((s) => G.itemDaGema({ id: (GP.doSlug(s) ?? SP.doSlug(s)).itemId, nivel: 1, xp: 0, raridade: 'comum' }));
  for (let i = 0; i < slugs.length; i++) G.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  Ficha.invalidar(e);
  assert.ok(Cacadas.entrar(e, { huntId: HUNT_DE_TESTE, mode: 'auto' }).ok);
  const h = e.hunt;
  delete h.instancia;
  h.respawns = [];
  h.monstros = [];
  e.maxHp = e.hp = 1e12;
  e.maxMana = e.mana = 1e12;
  e.acaoPoe = GP.doSlug(ativa).acao;
  return e;
}
function lancarPoe(e, alvo) {
  const h = e.hunt;
  e.actions = Array(Acoes.SLOTS).fill(null);
  assert.equal(Acoes.definir(e, { slot: 0, value: { id: e.acaoPoe } }).ok, true);
  h.cooldowns = {};
  delete h.ultimoAtaqueEm;
  delete h.conjurando;
  const r = Acoes.disparar(e, h, PERSONAGEM, 0, alvo);
  const ev = [...(r.eventos ?? [])];
  if (r.conjurando) {
    h.conjurando.fim = 0;
    ev.push(...(Acoes.concluirConjuracao(e, h, PERSONAGEM) ?? []));
  } else assert.notEqual(r.ok, false, r.erro);
  ev.push(...pousarVoos(h));
  return ev;
}

test('as tags que as supports leem: Flame Strike é projectile + single + hit; Fire Wave é área (wave)', () => {
  assert.deepEqual(['fire', 'hit', 'projectile', 'single', 'spell'].every((t) => G.DEFS.get(GEMA(FLAME)).tags.includes(t)), true);
  const onda = G.DEFS.get(GEMA('spell-fire-wave')).tags;
  assert.ok(onda.some((t) => ['area', 'wave', 'line'].includes(t)));
});

test('Extra Projectile / Greater Multiple Projectiles: mais bichos levam o projétil, com menos dano cada', { skip: soNoOficial('as gemas do PoE (Dreno de Essência + Projéteis Múltiplos Maiores)') }, async () => {
  const e = await montarPoe(PROJETIL, ['Greater_Multiple_Projectiles_Support']);
  const alvo = bicho(e, 1, 0);
  // (no PoE os projéteis a mais saem num LEQUE para o alvo — 10° entre vizinhos —, não para os bichos em volta: os 5 outros nas casas por onde o leque passa,
  // 4 deles, e um atrás de você, fora do leque)
  const outros = [bicho(e, 1, 1), bicho(e, 1, -1), bicho(e, 2, 0), bicho(e, 3, 0), bicho(e, -2, 0)];
  const ev = lancarPoe(e, alvo);
  assert.equal(outros.filter((m) => quantasVezes(ev, m) === 1).length, 4, '+4 projéteis');
  assert.equal(quantasVezes(ev, alvo), 1);
});

test('Pierce: o projétil atravessa o alvo e acerta quem está atrás, na mesma reta', { skip: soNoOficial('as gemas do PoE (Dreno de Essência + Perfuração)') }, async () => {
  const e = await montarPoe(PROJETIL, ['Pierce_Support']);
  const alvo = bicho(e, 1, 0);
  const atras1 = bicho(e, 2, 0);
  const atras2 = bicho(e, 3, 0);
  const atras3 = bicho(e, 4, 0);
  const fora = bicho(e, 2, 2);
  const ev = lancarPoe(e, alvo);
  assert.equal(quantasVezes(ev, atras1), 1);
  assert.equal(quantasVezes(ev, atras2), 1);
  assert.equal(quantasVezes(ev, atras3), 0, 'perfura 2');
  assert.equal(quantasVezes(ev, fora), 0, 'fora da reta');
});

test('Fork: no alvo, o projétil se divide em dois; Chain: salta de bicho em bicho', { skip: soNoOficial('as gemas do PoE (Dreno de Essência + Bifurcação / Ricochete)') }, async () => {
  const e = await montarPoe(PROJETIL, ['Fork_Support']);
  const alvo = bicho(e, 2, 0);
  const a = bicho(e, 3, 1);
  const b = bicho(e, 3, -1);
  const longe = bicho(e, 2, 9);
  const ev = lancarPoe(e, alvo);
  assert.equal(quantasVezes(ev, a) + quantasVezes(ev, b), 2);
  assert.equal(quantasVezes(ev, longe), 0);

  const c = await montarPoe(PROJETIL, ['Chain_Support']);
  const x0 = bicho(c, 1, 0);
  const x1 = bicho(c, 4, 0);
  const x2 = bicho(c, 7, 0);
  const x3 = bicho(c, 10, 0);
  const ev2 = lancarPoe(c, x0);
  assert.deepEqual([x1, x2, x3].map((m) => quantasVezes(ev2, m)), [1, 1, 0], 'encadeia 2, a até 4 do último');
});

test('Returning Projectile: o projétil volta e acerta o alvo de novo', { skip: soNoOficial('as gemas do PoE (Dreno de Essência + Projéteis Retornáveis)') }, async () => {
  const e = await montarPoe(PROJETIL, ['Returning_Projectiles_Support']);
  const alvo = bicho(e, 2, 0);
  assert.equal(quantasVezes(lancarPoe(e, alvo), alvo), 2);
});

test('Explosion: o golpe explode 3×3 em volta do impacto — o alvo (direto + explosão) e os vizinhos', { skip: doClassico("Suportes só do Draevor (Explosion, Impact) e a combinação com Flame Strike") }, () => {
  const e = montar('sorcerer', FLAME, ['explosion']);
  const alvo = bicho(e, 3, 0);
  const vizinho = bicho(e, 4, 1);
  const longe = bicho(e, 6, 0);
  const ev = lancar(e, FLAME, alvo);
  // Decisão do dono (01/10): a explosão pega TODOS no 3×3, inclusive o do impacto.
  assert.equal(quantasVezes(ev, alvo), 2);
  assert.equal(quantasVezes(ev, vizinho), 1);
  assert.equal(quantasVezes(ev, longe), 0);
});

test('Impact: skill física corpo a corpo de alvo único bate também em volta do alvo', { skip: doClassico("Suportes só do Draevor (Explosion, Impact) e a combinação com Flame Strike") }, () => {
  const e = montar('knight', 'spell-brutal-strike', ['impact']);
  const alvo = bicho(e, 1, 0);
  const vizinho = bicho(e, 2, 1);
  const ev = lancar(e, 'spell-brutal-strike', alvo);
  assert.equal(quantasVezes(ev, vizinho), 1);
});

test('Area of Effect / Concentrated Effect: a área cresce ou encolhe; concentrar bate mais', () => {
  const quadrado = [];
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) quadrado.push({ x: dx, y: dy });
  assert.equal(S.mudarArea(quadrado, 1).length, 25);
  assert.equal(S.mudarArea(quadrado, -1).length, 1);
  assert.equal(S.mudarArea([{ x: 0, y: 0 }], -1).length, 1, 'concentrar não apaga a área');
  const def = G.DEFS.get(SUP('concentrated-effect'));
  assert.ok(def.suporte.efeito.danoPct > 0 && def.suporte.efeito.areaExtra < 0);
});

test('as supports só valem na skill com as tags delas: Pierce não pega na Fire Wave (sem projectile)', () => {
  const pierce = G.DEFS.get(SUP('pierce')).suporte;
  assert.equal(G.compativel(pierce, G.DEFS.get(GEMA('spell-fire-wave')).tags), false);
  assert.equal(G.compativel(pierce, G.DEFS.get(GEMA(FLAME)).tags), true);
});

test('COMBINAÇÃO: Flame Strike + Multiple Projectiles + Pierce + Explosion — todos os efeitos juntos', { skip: doClassico("Suportes só do Draevor (Explosion, Impact) e a combinação com Flame Strike") }, () => {
  const e = montar('sorcerer', FLAME, ['multiple-projectiles', 'pierce', 'explosion']);
  const efeito = G.efeitoNaSkill(e, FLAME);
  assert.deepEqual(efeito.supports.sort(), ['Explosion', 'Multiple Projectiles', 'Pierce']);
  const alvo = bicho(e, 1, 0);
  const atras = bicho(e, 2, 0); // perfuração
  const extra1 = bicho(e, -1, 0); // projéteis extras (os mais perto de quem lança)
  const extra2 = bicho(e, 0, -1);
  const vizinhoDoAlvo = bicho(e, 1, 1); // explosão em volta do alvo
  const ev = lancar(e, FLAME, alvo);
  for (const m of [alvo, atras, extra1, extra2, vizinhoDoAlvo]) assert.ok(quantasVezes(ev, m) >= 1, `${m.x - e.hunt.pos.x},${m.y - e.hunt.pos.y} levou`);
  // A explosão também pega os vizinhos do alvo que já levaram outro golpe (ela é em área).
  assert.ok(ev.filter((x) => x.t === 'dmg').length > 5);
});

test('COMBINAÇÃO com Faster Casting: a conjuração fica mais curta e os efeitos de projétil continuam', () => {
  const sem = montar('sorcerer', FLAME, ['multiple-projectiles', 'pierce', 'explosion']);
  const com = montar('sorcerer', FLAME, ['multiple-projectiles', 'pierce', 'faster-casting']);
  assert.ok(G.tempoDeConjuracao(com, FLAME) < G.tempoDeConjuracao(sem, FLAME));
  assert.ok(G.efeitoNaSkill(com, FLAME).perfurar > 0 && G.efeitoNaSkill(com, FLAME).alvosExtras > 0);
});

test('os % dos golpes secundários se multiplicam entre supports (Multiple 60% × Extra 80% = 48%); contagens somam', () => {
  const e = montar('sorcerer', FLAME, ['multiple-projectiles', 'extra-projectile']);
  const ef = G.efeitoNaSkill(e, FLAME);
  assert.equal(ef.alvosExtras, 3);
  assert.equal(Math.round(ef.danoDosExtrasPct), 48);
});

test('Area of Effect no disparo de verdade: a Fire Wave pega mais bichos com a support', { skip: soNoOficial('as gemas do PoE (Nova de Gelo + Área de Efeito Aumentada / Efeito Concentrado)') }, async () => {
  // (no PoE o raio da área é em metros — 2 m a casa — e a fração vira a CHANCE de uma casa a mais, sorteada uma vez por uso: os bichos pegos são contados
  // num leque fixo de 20 sorteios (0,025 … 0,975), o mesmo nos três — sem a sorte decidir, e a área média é a que cresce ou encolhe)
  const pegos = async (supports) => {
    const e = await montarPoe('Ice_Nova', supports);
    const todos = [];
    for (let dx = -6; dx <= 6; dx++) for (let dy = -6; dy <= 6; dy++) if (dx || dy) todos.push(bicho(e, dx, dy));
    const antes = Math.random;
    let n = 0;
    try {
      for (let i = 0; i < 20; i++) {
        Math.random = () => (i + 0.5) / 20;
        const ev = lancarPoe(e, todos.find((m) => m.x === e.hunt.pos.x && m.y === e.hunt.pos.y - 1));
        n += todos.filter((m) => quantasVezes(ev, m) > 0).length;
      }
    } finally {
      Math.random = antes;
    }
    return n;
  };
  const normal = await pegos([]);
  assert.ok((await pegos(['Increased_Area_of_Effect_Support'])) > normal, 'maior');
  assert.ok((await pegos(['Concentrated_Effect_Support'])) < normal, 'menor');
});
