// Os GATILHOS que faltavam e os suportes de CANALIZAÇÃO (lote G15, 17/10): Conjurar enquanto Canaliza (as magias do grupo saem a cada intervalo
// enquanto a habilidade canalizada do grupo canaliza), Conjurar ao ser Atordoado (a chance, no atordoamento do acerto), Conjurar ao Morrer, a
// Canalização Focada (mais dano/custo por segundo canalizando) e a Infundida (menos dano dos acertos enquanto canaliza).
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
const SP = await import('../systems/itens-poe/suportes-poe.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');

async function com(base, gemas) {
  const J = await import('../systems/itens-poe/jogo.mjs');
  const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 80 }), { classePoe: 'Duelist', sistema: 'poe' });
  const n = gemas.length;
  // (nível de item 60: a arma abre os 3 encaixes — no 1, só 2)
  const arma = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
  arma.soquetes = { abertos: n, links: Array.from({ length: n - 1 }, () => true), gemas: Array(n).fill(null), cores: Array(n).fill('W') };
  e.equipment = { ...e.equipment, weapon: arma };
  e.inventory = gemas.map((s) => GS.itemDaGema({ id: (G.doSlug(s) ?? SP.doSlug(s)).itemId, nivel: 20, xp: 0, raridade: 'comum' }));
  for (let i = 0; i < n; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  e.actions = Array(Acoes.SLOTS).fill(null);
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 1e6;
  const [b, ...resto] = e.hunt.monstros;
  for (const m of resto) Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60 });
  Object.assign(b, { x: e.hunt.pos.x + 1, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12 });
  return e;
}
const gatilhos = (ev) => ev.filter((x) => x.t === 'gatilho');

test('G15: os gatilhos no nível 20 e o status', { skip: SEM }, () => {
  assert.deepEqual(SP.fichaNoNivel('Cast_while_Channelling_Support', 20).gatilho, { quando: 'canalizar', recargaMs: 320 });
  assert.equal(SP.fichaNoNivel('Cast_when_Stunned_Support', 20).gatilho.quando, 'atordoado');
  assert.equal(SP.fichaNoNivel('Cast_on_Death_Support', 20).gatilho.quando, 'morte');
  assert.deepEqual([SP.efeitoNoNivel('Focused_Channelling_Support', 20).efeito.focadoDanoMax, SP.efeitoNoNivel('Focused_Channelling_Support', 20).efeito.focadoCustoMax], [60, 100]);
  for (const s of ['Cast_while_Channelling_Support', 'Cast_when_Stunned_Support', 'Cast_on_Death_Support', 'Infused_Channelling_Support', 'Focused_Channelling_Support']) assert.equal(SP.doSlug(s).status, 'funciona', `${s}: ${SP.doSlug(s).motivos.join(' | ')}`);
});

test('G15: Conjurar enquanto Canaliza — canalizando o Ciclone, a Bola de Fogo do grupo sai a cada 0,32 s', { skip: SEM }, async () => {
  const e = await com('One_Hand_Swords/Rusted_Sword', ['Cyclone', 'Fireball', 'Cast_while_Channelling_Support']);
  const ciclone = G.doSlug('Cyclone').acao;
  const g = GS.gruposComGatilho(e).find((x) => x.gatilho.quando === 'canalizar');
  assert.deepEqual([g.ataques, g.magias], [[ciclone], [G.doSlug('Fireball').acao]]);
  e.hunt.canalizacao = { acao: ciclone, desde: e.hunt.clock, ate: e.hunt.clock + 1000, magia: false };
  const ev = [];
  assert.equal(Acoes.tiqueDaCanalizacao(e, e.hunt, PERSONAGEM, ev), 1);
  assert.equal(gatilhos(ev).length, 1);
  // na recarga do gatilho (0,32 s), não sai de novo; depois, sai
  assert.equal(Acoes.tiqueDaCanalizacao(e, e.hunt, PERSONAGEM, []), 0);
  e.hunt.clock += 330;
  assert.equal(Acoes.tiqueDaCanalizacao(e, e.hunt, PERSONAGEM, []), 1);
  // sem canalizar, nada
  e.hunt.clock += 2000;
  assert.equal(Acoes.tiqueDaCanalizacao(e, e.hunt, PERSONAGEM, []), 0);
});

test('G15: Conjurar ao ser Atordoado — o atordoamento deste acerto ativa a magia (uma vez)', { skip: SEM }, async () => {
  const e = await com('One_Hand_Swords/Rusted_Sword', ['Fireball', 'Cast_when_Stunned_Support']);
  e.hunt.controle = { ...(e.hunt.controle ?? {}), atordoado: { desde: e.hunt.clock, ate: e.hunt.clock + 500, ms: 500 } };
  const a = Math.random;
  Math.random = () => 0;
  try {
    const ev = [];
    assert.equal(Acoes.depoisDeSerAcertado(e, e.hunt, PERSONAGEM, ev), 1);
    assert.equal(Acoes.depoisDeSerAcertado(e, e.hunt, PERSONAGEM, []), 0, 'o mesmo atordoamento não ativa de novo');
  } finally { Math.random = a; }
});

test('G15: a Canalização Infundida — 12% menos dano dos acertos enquanto canaliza a habilidade suportada', { skip: SEM }, async () => {
  const e = await com('One_Hand_Swords/Rusted_Sword', ['Cyclone', 'Infused_Channelling_Support']);
  const ciclone = G.doSlug('Cyclone').acao;
  assert.equal(Acoes.menosDanoDaCanalizacao(e, e.hunt), 0, 'sem canalizar');
  e.hunt.canalizacao = { acao: ciclone, desde: e.hunt.clock, ate: e.hunt.clock + 500 };
  assert.equal(Acoes.menosDanoDaCanalizacao(e, e.hunt), 12);
});
