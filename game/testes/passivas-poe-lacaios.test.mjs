// Os LACAIOS de ponta a ponta (auditoria de dependências, 09/10 — docs/auditorias/dependencias-arvore-gemas-itens-combate.md): o nó da árvore
// ("Senhor dos Mortos": +1 Zumbi, +1 Esqueleto, Lacaios com +20% de dano e +15% de vida) → a soma do dono → a gema de lacaio (Erguer Zumbi)
// → os zumbis INVOCADOS de verdade pela caçada (quantos, a vida e o dano deles).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = !existsSync(Catalogo.ARQUIVO) && 'catálogo do PoE não está nesta máquina';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const Acoes = await import('../systems/acoes.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const Reforcos = await import('../systems/skills/reforcos.mjs');
const G = await import('../systems/itens-poe/gemas-poe.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const Comandos = await import('../systems/passivas/comandos.mjs');
const LacaiosPoe = await import('../systems/itens-poe/lacaios-poe.mjs');
if (!SEM) {
  (await import('../systems/itens-poe/jogo.mjs')).iniciar(ITEM_CATALOG);
  await G.iniciar({ registrarGema: (g) => (Acoes.registrarAcao(g.entry), GS.registrarAtiva(g)), registrarReforco: Reforcos.registrar });
}

/** Uma Bruxa com Erguer Zumbi na varinha e na barra, numa área do Ato 1, com um bicho imortal; `comNo`: o "Senhor dos Mortos" alocado. */
async function montar(comNo) {
  const J = await import('../systems/itens-poe/jogo.mjs');
  const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
  const Cacadas = await import('../systems/cacadas.mjs');
  const Ficha = await import('../systems/ficha.mjs');
  const Afixos = await import('../systems/afixos.mjs');
  const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
  (await import('../systems/itens-poe/campanha.mjs')).iniciar();
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 90 });
  e.classePoe = 'Witch';
  delete e.classe;
  P.garantir(e);
  if (comNo) assert.ok(Comandos.comando(e, { action: 'alocar', ids: P.caminhoAte(e, '27611') }).ok);
  const arma = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Wands/Driftwood_Wand', raridade: 'normal', ilvl: 20, rng: () => 0.99 }));
  arma.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
  e.equipment = { ...(e.equipment ?? {}), weapon: arma };
  e.inventory = [GS.itemDaGema({ id: G.doSlug('Raise_Zombie').itemId, nivel: 10, xp: 0, raridade: 'comum' })];
  GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: G.doSlug('Raise_Zombie').acao, enabled: true, minMana: 0, conditions: [] };
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  let t = Date.now();
  // (determinístico: o sorteio com semente fixa, e os zumbis não morrem — conta-se quantos a gema INVOCA, não quantos sobrevivem)
  const original = Math.random;
  let semente = 7;
  // (o PICO de zumbis ao mesmo tempo: eles vencem por tempo e a gema invoca de novo — os vivos no último tique dependem de em que ponto
  // desse ciclo a caçada acaba, e o "uma ação por vez" do PoE, 09/10, mudou o ritmo da gema)
  let pico = 0;
  Math.random = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);
  try {
    for (let i = 0; i < 240 && e.hunt; i++) {
      const h = e.hunt;
      h.monstros = h.monstros.slice(0, 1);
      Object.assign(h.monstros[0], { hp: Math.max(h.monstros[0].hp, 1e11), maxHp: 1e12, x: h.pos.x + 3, y: h.pos.y });
      h.alvo = h.monstros[0].uid;
      for (const l of h.lacaios ?? []) if (l.hp > 0) l.hp = l.maxHp;
      e.hp = e.maxHp; e.mana = 1e6; e.maxMana = 1e6;
      Cacadas.tique(e, PERSONAGEM, (t += 250));
      pico = Math.max(pico, (e.hunt?.lacaios ?? []).filter((l) => l.gema === 'Raise_Zombie' && l.hp > 0).length);
    }
  } finally {
    Math.random = original;
  }
  Ficha.invalidar(e);
  const q = LacaiosPoe.oQueInvoca('Raise_Zombie', 10, null, Ficha.combate(e).afPoe);
  const zumbis = (e.hunt?.lacaios ?? []).filter((l) => l.gema === 'Raise_Zombie' && l.hp > 0);
  return { e, q, zumbis, pico };
}

test('"+1 ao número Máximo de Zumbis" (a árvore): a caçada invoca o zumbi a MAIS — antes a checagem "todos em campo" usava o máximo sem a árvore', { skip: SEM }, async () => {
  const sem = await montar(false);
  const com = await montar(true);
  assert.ok(sem.zumbis.length >= 1, 'a gema invoca');
  assert.equal(sem.pico, sem.q.maximo, `sem o nó: ${sem.pico}/${sem.q.maximo}`);
  assert.equal(com.q.maximo, sem.q.maximo + 1);
  assert.equal(com.pico, com.q.maximo, `com o nó: ${com.pico}/${com.q.maximo}`);
});

test('"Lacaios causam Dano aumentado" e "Vida máxima dos Lacaios aumentada" (a árvore) chegam aos zumbis INVOCADOS: o zumbi em campo tem a vida e o dano da soma do dono', { skip: SEM }, async () => {
  const Ficha = await import('../systems/ficha.mjs');
  const sem = await montar(false);
  const com = await montar(true);
  const soma = (x, k) => Number((Ficha.invalidar(x.e), Ficha.combate(x.e)).afPoe[k]) || 0;
  const [vida0, vida1, dano0, dano1] = [soma(sem, 'minion_life'), soma(com, 'minion_life'), soma(sem, 'minion_dmg'), soma(com, 'minion_dmg')];
  assert.ok(vida1 - vida0 >= 15 && dano1 - dano0 >= 20, 'o nó (e o caminho) somam vida e dano de lacaio');
  // o zumbi INVOCADO tem exatamente o que a gema calcula com a soma do dono (`oQueInvoca` com o `afPoe`)
  for (const x of [sem, com]) assert.equal(x.zumbis[0].maxHp, x.q.vida, 'a vida do zumbi invocado');
  // e a vida sobe na razão dos % de lacaio do dono: (1 + vida1/100) / (1 + vida0/100)
  assert.ok(Math.abs(com.q.vida / sem.q.vida - (1 + vida1 / 100) / (1 + vida0 / 100)) < 0.01, `vida ${sem.q.vida} → ${com.q.vida}`);
  const medio = (q) => (q.dano.min + q.dano.max) / 2;
  assert.ok(Math.abs(medio(com.q) / medio(sem.q) - (1 + dano1 / 100) / (1 + dano0 / 100)) < 0.02, `dano ${medio(sem.q)} → ${medio(com.q)}`);
  const golpeDoZumbi = (z) => (z.dano?.min ?? z.danoMin ?? 0) + (z.dano?.max ?? z.danoMax ?? 0);
  if (golpeDoZumbi(com.zumbis[0])) assert.equal(golpeDoZumbi(com.zumbis[0]), com.q.dano.min + com.q.dano.max, 'o dano do zumbi invocado');
});
