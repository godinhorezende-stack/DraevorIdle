// (16/10, lote 37: o dono escolheu o "Mercenário completo" — contratado por ouro, a ficha e as gemas dele; os testes do simples foram ajustados
// com o aval dele.) O MERCENÁRIO do Luminary (dono, 14/10: "Mercenário simples"): com o nó, um mercenário permanente "do seu nível" (a sua vida máxima, o golpe
// da sua arma) segue você e ataca; a vida e o dano dele (+15%), "+8% mais Dano por único equipado por ele" (os seus únicos nos tipos de peça
// que os nós "pode equipar" liberam), o guarda-costas (20% do dano dos acertos nele quando a vida dele é maior; 40% do dano dele recuperado
// quando é menor), o provocar ao acertar, as suas auras nele (+50%), o Vínculo nele ("o dono da conexão não morrerá") e os Vínculos com
// duração infinita. Os textos em inglês do PoE desfazem as dúvidas da tradução ("Damage from Hits", "Recouped as Life", "more Damage").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
const Acoes = await import('../systems/acoes.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const G = await import('../systems/itens-poe/gemas-poe.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Arvore = await import('../systems/arvore.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const Vinculos = await import('../systems/itens-poe/vinculos.mjs');
const M = await import('../systems/itens-poe/mercenarios.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');

const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 70, rng: () => 0.5 }));
/** Uma personagem do PoE numa caçada com uma varinha (`af` nela) e as `gemas` (na varinha e na barra). */
function personagem(af = {}, gemas = []) {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 60 });
  e.sistema = 'poe';
  e.classePoe = 'Ranger';
  const arma = peca('Wands/Driftwood_Wand');
  arma.poe.af = { ...(arma.poe.af ?? {}), ...af };
  const n = Math.max(1, gemas.length);
  arma.soquetes = { abertos: n, links: Array(Math.max(0, n - 1)).fill(true), gemas: Array(n).fill(null), cores: Array(n).fill('W') };
  e.equipment = { ...(e.equipment ?? {}), weapon: arma };
  e.inventory = gemas.map((s) => GS.itemDaGema({ id: G.doSlug(s).itemId, nivel: 1, xp: 0, raridade: 'comum' }));
  for (let i = 0; i < gemas.length; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  e.actions = Array(Acoes.SLOTS).fill(null);
  gemas.forEach((s, i) => (e.actions[i] = { id: G.doSlug(s).acao, enabled: true, minMana: 0, conditions: [] }));
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 100_000;
  e.maxHp = e.hp = 5000;
  P.garantir(e);
  return e;
}
const ficha = (e) => { Ficha.invalidar(e); return Ficha.combate(e); };
const mercenario = (e) => e.hunt.lacaios?.find((l) => l.mercenario && l.hp > 0);
/** (o dono, 16/10 — lote 37, "Mercenário completo": o mercenário é CONTRATADO — antes saía sozinho com o nó) Um bárbaro de nível 30, ao seu lado. */
function contratar(e, arquetipo = 'barbaro', nivel = 30) {
  const d = M.dados(e);
  const merc = { ...M.candidato(nivel, () => 0.5), arquetipo, equipment: {}, doJogador: {} };
  d.contratados.push(merc);
  d.ativo = merc.id;
  return merc;
}

test('a ÁRVORE: as linhas do Luminary com efeito — fica só a Glória Dourada (o Raio de Iluminação) e as de luz', { skip: SEM }, () => {
  const linhas = P.arvore().nos.filter((n) => n.ascendencia === 'Luminary').flatMap((n) => n.textos.map((t, i) => ({ t, estado: n.estados[i], nota: n.notas?.[i] ?? '' }))).filter((l) => l.estado !== 'nota');
  const semEfeito = linhas.filter((l) => !['novo', 'aproximado', 'equivalente'].includes(l.estado));
  for (const l of semEfeito) assert.match(l.t, /Raio de Iluminação|campo de visão/i, l.t);
  assert.ok(linhas.filter((l) => /mercenário|conexão/i.test(l.t) && !/campo de visão/.test(l.t)).every((l) => ['novo', 'aproximado', 'equivalente'].includes(l.estado)));
});

// (o dono, 16/10 — lote 37, "Mercenário completo": o mercenário CONTRATADO, com a ficha DELE — o nível e as peças dele, × a vida e o dano dos seus
// nós; os únicos equipados nele. Antes: saía com o nó, com a sua vida máxima e o golpe da sua arma, e os seus únicos contavam como dele.)
test('o MERCENÁRIO contratado sai na caçada: a ficha dele × a vida e o dano dos seus nós; os únicos equipados nele; deixado ou sem o nó, sai', { skip: SEM }, () => {
  const e = personagem({ mercenario: 1, mercenario_vida_inc: 15, mercenario_dano_inc: 15 });
  const merc = contratar(e);
  const h = e.hunt;
  const t = Date.now();
  Acoes.tiqueDoMercenario(e, h, t);
  const m = mercenario(e);
  assert.ok(m, 'saiu');
  const semNos = Acoes.fichaDoMercenario(e, merc, { mercenario: 1 });
  assert.equal(m.maxHp, Math.round(semNos.vida * 1.15));
  assert.ok(m.dano.max > semNos.habilidades[0].dano.max, 'o dano aumentado');
  // (os únicos dele: os equipados nele)
  assert.equal(Acoes.unicosDoMercenario(e), 0);
  merc.equipment.neck = { poe: { raridade: 'unico' } };
  assert.equal(Acoes.unicosDoMercenario(e), 1);
  delete merc.equipment.neck;
  // (deixado, sai)
  M.comando(e, { action: 'deixar' }, ficha(e).afPoe);
  Acoes.tiqueDoMercenario(e, h, t + 500);
  assert.equal(mercenario(e), undefined);
  // (sem o nó, sai)
  M.comando(e, { action: 'levar', id: merc.id }, ficha(e).afPoe);
  Acoes.tiqueDoMercenario(e, h, t + 750);
  assert.ok(mercenario(e));
  e.equipment.weapon.poe.af.mercenario = 0;
  Ficha.invalidar(e);
  Acoes.tiqueDoMercenario(e, h, t + 1000);
  assert.equal(mercenario(e), undefined);
});

// (o dono, 16/10 — lote 37, "Reviver por ouro": antes, o morto voltava em 10 s.)
test('o MERCENÁRIO morto não volta sozinho; revivido por ouro (250 × o nível dele), volta', { skip: SEM }, () => {
  const e = personagem({ mercenario: 1 });
  const merc = contratar(e);
  const h = e.hunt;
  const t = Date.now();
  Acoes.tiqueDoMercenario(e, h, t);
  const m = mercenario(e);
  m.hp = 0;
  Acoes.mercenarioMorreu(e, m);
  h.lacaios = h.lacaios.filter((l) => l.hp > 0);
  Acoes.tiqueDoMercenario(e, h, t + 100 + 10_000);
  assert.equal(mercenario(e), undefined);
  Object.assign(e, { gold: 7_500, bank: 0 });
  assert.equal(M.comando(e, { action: 'reviver', id: merc.id }, ficha(e).afPoe).ok, true);
  assert.equal(e.gold, 0);
  Acoes.tiqueDoMercenario(e, h, t + 20_000);
  assert.ok(mercenario(e), 'voltou');
});

test('o GUARDA-COSTAS: com a vida dele maior que a sua, 20% do dano dos acertos sai dele; menor, não', { skip: SEM }, () => {
  const e = personagem({ mercenario: 1, mercenario_vida_inc: 50, mercenario_guarda_pct: 20 });
  contratar(e);
  const h = e.hunt;
  Acoes.tiqueDoMercenario(e, h, Date.now());
  const m = mercenario(e);
  // (lote 37: a vida dele é a da ficha dele — aqui, maior que a sua, para o guarda-costas valer)
  m.hp = m.maxHp = 7500;
  const f = ficha(e);
  Object.assign(m, { x: h.pos.x, y: h.pos.y });
  e.hp = 4000;
  const antes = m.hp;
  const levou = Arvore.danoRecebido(e, 1000, [], h.pos, 'x', { ficha: f });
  assert.equal(antes - m.hp, 200);
  assert.equal(levou, Arvore.danoRecebido({ ...e, hunt: { ...h, lacaios: [] } }, 1000, [], h.pos, 'x', { ficha: f }) - 200);
  m.hp = 3000;
  const antes2 = m.hp;
  Arvore.danoRecebido(e, 1000, [], h.pos, 'x', { ficha: f });
  assert.equal(m.hp, antes2, 'a vida dele (3000) menor que a sua (4000): nada');
});

test('na caçada: com a vida dele menor que a sua, 40% do dano que ele leva volta como a vida dele; ele provoca quem acerta', { skip: SEM }, () => {
  const e = personagem({ mercenario: 1, mercenario_recupera_pct: 40, mercenario_provoca: 1 });
  const merc = contratar(e);
  const h = e.hunt;
  e.maxHp = e.hp = 1e7;
  const [b, ...outros] = h.monstros;
  for (const o of outros) Object.assign(o, { x: h.pos.x + 60, y: h.pos.y + 60 });
  Object.assign(b, { x: h.pos.x + 1, y: h.pos.y, hp: 1e9, maxHp: 1e9, estados: {} });
  let t = Date.now();
  const original = Math.random;
  const golpes = [];
  let m = null;
  try {
    Math.random = () => 0;
    for (let i = 0; i < 16; i++) {
      const ev = Cacadas.tique(e, PERSONAGEM, (t += 250));
      m ??= mercenario(e);
      if (m) golpes.push(...ev.filter((x) => x.t === 'dmg' && x.uid === m.uid && !x.foe));
    }
    // (lote 37, P057: o recuperado cai ao longo de 4 s — o bicho vai embora e a recuperação termina)
    Object.assign(b, { x: h.pos.x + 60, y: h.pos.y + 60 });
    for (let i = 0; i < 17; i++) Cacadas.tique(e, PERSONAGEM, (t += 250));
  } finally { Math.random = original; }
  assert.ok(m, 'o mercenário saiu');
  assert.ok(golpes.length > 0, 'o bicho acertou o mercenário');
  const levou = golpes.reduce((n, g) => n + g.v, 0);
  assert.ok(Math.abs(m.maxHp - m.hp - levou * 0.6) <= golpes.length, `${m.maxHp - m.hp} ~ 60% de ${levou}`);
  assert.equal(b.estados.provocado?.por, merc.nome, 'provocado pelo mercenário (lote 37: pelo nome dele)');
});

test('os VÍNCULOS no mercenário: ele é alvo sem o nó dos lacaios; com o Juramento, a morte dele vinculado não leva você; a duração infinita', { skip: SEM }, () => {
  const e = personagem({ mercenario: 1, mercenario_sem_morte_junto: 1, vinculo_duracao_infinita: 1 }, ['Soul_Link']);
  contratar(e);
  const h = e.hunt;
  Acoes.tiqueDoMercenario(e, h, Date.now());
  const m = mercenario(e);
  Object.assign(m, { x: h.pos.x + 1, y: h.pos.y });
  const cand = Vinculos.candidatos(e, h, ficha(e).afPoe);
  assert.ok(cand.some((a) => a.uid === m.uid && a.mercenario), 'o mercenário é alvo');
  const [b, ...outros] = h.monstros;
  for (const o of outros) Object.assign(o, { x: h.pos.x + 60, y: h.pos.y + 60 });
  Object.assign(b, { x: h.pos.x - 2, y: h.pos.y, hp: 1e9, maxHp: 1e9 });
  h.clock += 10_000;
  const r = Acoes.disparar(e, h, PERSONAGEM, 0, null, {});
  if (r.conjurando) { h.clock += 2000; Acoes.concluirConjuracao(e, h, PERSONAGEM); }
  const lk = h.vinculos?.find((x) => x.alvos.some((a) => a.uid === m.uid));
  assert.ok(lk, JSON.stringify(r).slice(0, 200));
  assert.ok(lk.ate - h.clock > 1e11, 'a duração infinita');
  // (a morte dele vinculado não leva você)
  m.hp = 0;
  assert.equal(Vinculos.tique(e, h, ficha(e).afPoe, h.clock + 250).morreu, false);
  // (sem o Juramento, leva — a regra dos Vínculos)
  const sem = { ...h, vinculos: [{ ...lk, alvos: [{ tipo: 'lacaio', uid: m.uid, mercenario: true, vivo: true }], em: h.clock }] };
  assert.equal(Vinculos.tique(e, sem, { ...ficha(e).afPoe, mercenario_sem_morte_junto: 0 }, h.clock + 500).morreu, true);
});
