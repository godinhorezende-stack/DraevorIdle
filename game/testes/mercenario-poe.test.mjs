// O MERCENÁRIO do Luminary (dono, 14/10: "Mercenário simples"): com o nó, um mercenário permanente "do seu nível" (a sua vida máxima, o golpe
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

test('a ÁRVORE: as linhas do Luminary com efeito — fica só a Glória Dourada (o Raio de Iluminação) e as de luz', { skip: SEM }, () => {
  const linhas = P.arvore().nos.filter((n) => n.ascendencia === 'Luminary').flatMap((n) => n.textos.map((t, i) => ({ t, estado: n.estados[i], nota: n.notas?.[i] ?? '' }))).filter((l) => l.estado !== 'nota');
  const semEfeito = linhas.filter((l) => !['novo', 'aproximado', 'equivalente'].includes(l.estado));
  for (const l of semEfeito) assert.match(l.t, /Raio de Iluminação|campo de visão/i, l.t);
  assert.ok(linhas.filter((l) => /mercenário|conexão/i.test(l.t) && !/campo de visão/.test(l.t)).every((l) => ['novo', 'aproximado', 'equivalente'].includes(l.estado)));
});

test('o MERCENÁRIO sai com o nó: a sua vida máxima e o golpe da sua arma, × a vida e o dano dele e × "8% mais Dano por único"; sem o nó, sai', { skip: SEM }, () => {
  const e = personagem({ mercenario: 1, mercenario_vida_inc: 15, mercenario_dano_inc: 15 });
  const h = e.hunt;
  const t = Date.now();
  Acoes.tiqueDoMercenario(e, h, t);
  const m = mercenario(e);
  assert.ok(m, 'saiu');
  assert.equal(m.maxHp, Math.round(5000 * 1.15));
  const f = ficha(e);
  assert.equal(m.dano.min, Math.max(1, Math.round(f.ataqueMin * 1.15)));
  assert.equal(m.dano.max, Math.max(1, Math.round(f.ataqueMax * 1.15)));
  // (os únicos "dele": os seus nos tipos de peça que os nós liberam)
  const comUnicos = { equipment: { neck: { poe: { raridade: 'unico' } }, ring: { poe: { raridade: 'unico' } }, ring2: { poe: { raridade: 'raro' } }, feet: { poe: { raridade: 'unico' } } } };
  assert.equal(Acoes.unicosDoMercenario(comUnicos, { mercenario_equipa_amuleto: 1, mercenario_equipa_anel: 1 }), 2, 'o amuleto e um anel (as botas não foram liberadas)');
  assert.equal(Acoes.unicosDoMercenario(comUnicos, {}), 0);
  // (sem o nó, sai)
  e.equipment.weapon.poe.af.mercenario = 0;
  Ficha.invalidar(e);
  Acoes.tiqueDoMercenario(e, h, t + 1000);
  assert.equal(mercenario(e), undefined);
});

test('o MERCENÁRIO morto volta em 10 s', { skip: SEM }, () => {
  const e = personagem({ mercenario: 1 });
  const h = e.hunt;
  const t = Date.now();
  Acoes.tiqueDoMercenario(e, h, t);
  mercenario(e).hp = 0;
  Acoes.mercenarioMorreu(h, t + 100);
  Acoes.tiqueDoMercenario(e, h, t + 100 + 9999);
  assert.equal(mercenario(e), undefined);
  Acoes.tiqueDoMercenario(e, h, t + 100 + 10_000);
  assert.ok(mercenario(e), 'voltou');
});

test('o GUARDA-COSTAS: com a vida dele maior que a sua, 20% do dano dos acertos sai dele; menor, não', { skip: SEM }, () => {
  const e = personagem({ mercenario: 1, mercenario_vida_inc: 50, mercenario_guarda_pct: 20 });
  const h = e.hunt;
  Acoes.tiqueDoMercenario(e, h, Date.now());
  const m = mercenario(e);
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
  } finally { Math.random = original; }
  assert.ok(m, 'o mercenário saiu');
  assert.ok(golpes.length > 0, 'o bicho acertou o mercenário');
  const levou = golpes.reduce((n, g) => n + g.v, 0);
  assert.ok(Math.abs(m.maxHp - m.hp - levou * 0.6) <= golpes.length, `${m.maxHp - m.hp} ~ 60% de ${levou}`);
  assert.equal(b.estados.provocado?.por, 'Mercenário', 'provocado pelo mercenário');
});

test('os VÍNCULOS no mercenário: ele é alvo sem o nó dos lacaios; com o Juramento, a morte dele vinculado não leva você; a duração infinita', { skip: SEM }, () => {
  const e = personagem({ mercenario: 1, mercenario_sem_morte_junto: 1, vinculo_duracao_infinita: 1 }, ['Soul_Link']);
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
