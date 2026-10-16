// LOTE 46 (os três achados de ÁREA — dono, 16/10: "Toda área em metros"): o PROPAGAR DANO (Melee Splash) propaga o golpe aos vizinhos de cada
// atingido com "40% menos Dano Propagado", e o "mais Efeito em Área da Propagação" é só da propagação (antes crescia a área da habilidade); o
// PUNHO DE GUERRA (Fist of War) só Maximiza um ataque a cada N segundos — o "mais Dano" e a área dos Impactos só nele (antes, em todo ataque);
// o RAIO do CLAMOR em casas (os metros da gema ÷ 2 — antes, os metros como casas) × √ da "Área de Efeito aumentada" (a dos Clamores também).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const Ficha = await import('../systems/ficha.mjs');
const GemasPoe = await import('../systems/itens-poe/gemas-poe.mjs');
const SP = await import('../systems/itens-poe/suportes-poe.mjs');
const Acoes = await import('../systems/acoes.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Gerar = await import('../systems/itens-poe/gerar.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Registro = await import('../systems/combate/registro.mjs');
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  Jogo.iniciar(ITEM_CATALOG);
}

const peca = (base) => Jogo.pecaDoJogo(Gerar.gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 1, rng: () => 0.5 }));
const ANEL = Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'might ring')?.id);
/** O Math.random fixo durante `fn`. */
function comSorte(valor, fn) {
  const antes = Math.random;
  Math.random = () => valor;
  try { return fn(); } finally { Math.random = antes; }
}
/** Um personagem numa caçada com a `gema` e os `suportes` ligados na arma (o slot 1 da barra) e `monstros` imortais em fila a partir do lado. */
function cacada({ base = 'One_Hand_Swords/Rusted_Sword', gema, suportes = [], nivel = 20, monstros = 1, af = null }) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 70 }), { classePoe: 'Duelist' });
  const arma = peca(base);
  const n = 1 + suportes.length;
  arma.soquetes = { abertos: n, links: Array(n - 1).fill(true), gemas: Array(n).fill(null), cores: Array(n).fill('W') };
  e.equipment = { ...e.equipment, weapon: arma };
  delete e.equipment.shield;
  e.inventory = [gema, ...suportes].map((s) => GS.itemDaGema({ id: (GemasPoe.doSlug(s) ?? SP.doSlug(s)).itemId, nivel, xp: 0, raridade: 'comum' }));
  for (let i = 0; i < n; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  if (af) e.equipment.ring = { id: ANEL, count: 1, af: [], poe: { af } };
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: GemasPoe.doSlug(gema).acao, enabled: true, minMana: 0, conditions: [] };
  assert.equal(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok, true);
  Object.assign(e, { mana: 1e6, maxMana: 1e6 });
  const h = e.hunt;
  h.clock = 10000;
  h.monstros = h.monstros.slice(0, monstros);
  h.monstros.forEach((m, i) => Object.assign(m, { hp: 1e12, maxHp: 1e12, x: h.pos.x + 1 + i, y: h.pos.y, raridade: 'normal', estados: {}, dots: [] }));
  return { e, h, alvo: h.monstros[0], entry: Acoes.POR_ID_PUBLICO(GemasPoe.doSlug(gema).acao) };
}
/** Usa a habilidade do slot 1 no alvo; o relógio anda `depois` ms. */
function usar({ e, h, alvo }, depois = 5000) {
  const r = Acoes.disparar(e, h, PERSONAGEM, 0, alvo, { manual: true });
  assert.equal(r.ok, true, r.erro);
  if (h.conjurando) { h.clock = h.conjurando.fim; Acoes.concluirConjuracao(e, h, PERSONAGEM); }
  h.clock += depois;
  Object.assign(e, { hp: e.maxHp, mana: 1e6 });
}
/** Os acertos da gema durante `fn` (o registro de golpes): o dano antes das defesas do monstro (`bruto`) e em quem (`uid`). */
function golpes(fn) {
  const nivel = Registro.nivelDoRegistro();
  Registro.definirNivel(2);
  Registro.limparRegistro();
  try {
    fn();
    return Registro.ultimosGolpes(1000).filter((g) => g.origem === 'gema').map((g) => ({ bruto: g.danoAntesDaResistencia, uid: g.alvoUid ?? g.uid ?? g.alvo }));
  } finally {
    Registro.definirNivel(nivel);
  }
}
const perto = (a, b, tol = 0.01) => Math.abs(a - b) <= Math.max(2, Math.abs(b) * tol);

test('as regras dos suportes: o Propagar Dano (propaga, 40% menos, mais Área da Propagação — não a da habilidade) e o Punho de Guerra (a Maximização a cada 1,8 s)', { skip: SEM }, () => {
  const p = SP.efeitoNoNivel('Melee_Splash_Support', 20);
  assert.deepEqual(p.naoFeitas, []);
  assert.equal(p.efeito.propagar, 1);
  assert.equal(p.efeito.propagaMaisPct, -40);
  assert.equal(p.efeito.propagaAreaMaisPct, 57);
  assert.equal(p.efeito.areaMaisPct, undefined, 'a área da habilidade não cresce');
  const f = SP.efeitoNoNivel('Fist_of_War_Support', 20);
  assert.deepEqual(f.naoFeitas, []);
  assert.deepEqual([f.efeito.maximizadoMs, f.efeito.maximizadoMaisDanoPct, f.efeito.maximizadoAreaIncPct], [1800, 98, 59]);
  assert.equal(f.efeito.maisDanoPct, undefined, 'o "mais Dano" não vale em todo ataque');
  assert.ok(!(f.efeito.areaIncPct > 0), 'nem a área');
});

test('o PROPAGAR DANO no golpe: o vizinho do alvo leva 60% do golpe (40% menos Dano Propagado)', { skip: SEM }, () => {
  const o = cacada({ gema: 'Heavy_Strike', suportes: ['Melee_Splash_Support'], monstros: 2 });
  const vizinho = o.h.monstros[1];
  const antes = vizinho.hp;
  const gs = golpes(() => comSorte(0.5, () => usar(o)));
  assert.ok(antes - vizinho.hp > 0, 'o vizinho levou a propagação');
  const brutos = gs.map((g) => g.bruto).sort((a, b) => b - a);
  assert.equal(brutos.length, 2);
  assert.ok(perto(brutos[1], brutos[0] * 0.6), `${brutos[1]} ≈ 60% de ${brutos[0]}`);
  // sem o suporte, só o alvo
  const s = cacada({ gema: 'Heavy_Strike', monstros: 2 });
  const v2 = s.h.monstros[1];
  const a2 = v2.hp;
  comSorte(0.5, () => usar(s));
  assert.equal(a2 - v2.hp, 0);
});

test('o PUNHO DE GUERRA: um ataque a cada 1,8 s é Maximizado (98% mais dano); o seguinte, dentro dos 1,8 s, não; passados, de novo', { skip: SEM }, () => {
  const o = cacada({ base: 'One_Hand_Maces/Driftwood_Club', gema: 'Ground_Slam', suportes: ['Fist_of_War_Support'] });
  const no = () => golpes(() => comSorte(0.5, () => usar(o, 1000))).filter((g) => g.bruto > 0).map((g) => g.bruto)[0];
  const primeiro = no();
  const segundo = no();
  const terceiro = no();
  assert.ok(perto(primeiro, segundo * 1.98), `o Maximizado: ${primeiro} ≈ ${segundo} × 1,98`);
  assert.ok(perto(terceiro, primeiro), `passados 1,8 s, de novo: ${terceiro}`);
});

test('o RAIO do CLAMOR em casas (6 m = 3 casas) × √ da "Área de Efeito aumentada" (a dos Clamores também); só os bichos no raio são provocados', { skip: SEM }, () => {
  const provocar = (GemasPoe.buffNoNivel('Enduring_Cry', 20)?.efeitos ?? []).find((e) => e.efeito === 'provocar');
  assert.deepEqual([provocar.raio, provocar.raioM], [3, 6]);
  const sem = cacada({ gema: 'Enduring_Cry' });
  assert.equal(Acoes.raioDoClamor(sem.e, sem.entry, 3, () => 0), 3);
  const com = cacada({ gema: 'Enduring_Cry', af: { 'area_inc@clamor': 300 } });
  assert.equal(Acoes.raioDoClamor(com.e, com.entry, 3, () => 0), 6, '3 × √4');
  // a fração: +21% → 3 × 1,1 = 3,3 casas → 30% de chance de uma a mais
  const fr = cacada({ gema: 'Enduring_Cry', af: { area_inc: 21 } });
  assert.equal(Acoes.raioDoClamor(fr.e, fr.entry, 3, () => 0.5), 3);
  assert.equal(Acoes.raioDoClamor(fr.e, fr.entry, 3, () => 0.1), 4);
  // no uso: o bicho a 3 casas é provocado; o a 5, não (antes, o raio era 6)
  const o = cacada({ gema: 'Enduring_Cry', monstros: 2 });
  const [a, b] = o.h.monstros;
  Object.assign(a, { x: o.h.pos.x + 3, y: o.h.pos.y, perseguindo: false });
  Object.assign(b, { x: o.h.pos.x + 5, y: o.h.pos.y, perseguindo: false });
  comSorte(0.5, () => usar(o));
  assert.equal(a.perseguindo, true);
  assert.notEqual(b.perseguindo, true);
});
