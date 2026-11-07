// (07/11, lote 18 das inertes — dono: "Aproximar o possível") a PIRA FUNESTA (o comprimento do Raio Escaldante), o CHAMADO DO CRUSTÁCEO (o Totem de Caranguejo = o
// Totem de Magia do nível 1) e o SINO DO MONASTÉRIO (o primeiro acertado do ataque com escudo conta como bloqueio).
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
const PIRA = ['Comprimento do Raio Escaldante aumentado em {0}%', [100]];
const CRAB = ['Magias encaixadas recebem reforço de Totem de Caranguejo nível {0}', [20]];
const SINO = ['Conta como dano de ataque bloqueado do primeiro alvo atingido por cada ataque com escudo'];

function personagem(linhas, encaixada = null) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'sorcerer', level: 90 }), { classePoe: 'Witch', sistema: 'poe' });
  const arma = peca('Wands/Driftwood_Wand');
  const af = { ...(arma.poe.af ?? {}) };
  for (const [m, v] of linhas) for (const x of tr(m, v ?? []).efeitos) af[x.stat] = (af[x.stat] ?? 0) + Number(x.valor);
  arma.poe.af = af;
  e.equipment = { ...e.equipment, weapon: arma };
  if (encaixada) {
    arma.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
    e.inventory = [GS.itemDaGema({ id: GemasPoe.doSlug(encaixada).itemId, nivel: 20, xp: 0, raridade: 'comum' })];
    GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
  }
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.clock = 100_000;
  ModsPoe.definirFichaDaCacada(e.hunt, () => Ficha.combate(e));
  return e;
}

test('as linhas do lote saem com efeito', { skip: SEM }, () => {
  for (const [m, v] of [PIRA, CRAB, SINO]) assert.ok(!['inerte', 'registrado'].includes(tr(m, v ?? []).estado), m);
});

test('a PIRA FUNESTA: com 100% de comprimento, o feixe do Raio Escaldante vai de 3 para 6 fileiras; sem a linha (ou noutra gema), igual', { skip: SEM }, () => {
  const entry = Acoes.POR_ID_PUBLICO(GemasPoe.doSlug('Scorching_Ray').acao);
  const prof = (f) => Math.max(...f.map(([, y]) => -y));
  assert.equal(prof(entry.forma), 3);
  assert.equal(Acoes.formaComComprimento(personagem([]), entry), entry);
  assert.equal(prof(Acoes.formaComComprimento(personagem([PIRA]), entry).forma), 6);
  const outra = Acoes.POR_ID_PUBLICO(GemasPoe.doSlug('Fireball').acao);
  assert.equal(Acoes.formaComComprimento(personagem([PIRA]), outra), outra);
});

test('o CHAMADO DO CRUSTÁCEO: a magia encaixada na peça é Suportada pelo Totem de Magia (nível 1: 50% menos Dano)', { skip: SEM }, () => {
  const e = personagem([CRAB], 'Fireball');
  const a = GS.skillsAtivas(e).get(GemasPoe.doSlug('Fireball').acao);
  assert.ok(a?.supports.some((s) => /Totem de Magia/.test(s.def.nome) && s.nivel === 1), JSON.stringify(a?.supports.map((s) => s.def.nome)));
});

test('o SINO DO MONASTÉRIO: o primeiro acertado do ataque com escudo dispara o "ao Bloquear" (uma vez por uso); sem a tag, não', { skip: SEM }, () => {
  const e = personagem([SINO, ['+{0} de Vida recebida ao Bloquear', [1000]]]);
  const h = e.hunt;
  const f = Ficha.combate(e);
  e.maxHp = 10_000;
  e.hp = 1000;
  const alvo = h.monstros[0];
  ModsPoe.evento(e, h, 'acertar', f, { alvo, eventos: [], personagem: PERSONAGEM, tags: ['ataque'] });
  assert.equal(e.hp, 1000, 'sem ser ataque com escudo');
  ModsPoe.evento(e, h, 'acertar', f, { alvo, eventos: [], personagem: PERSONAGEM, tags: ['ataque', 'ataqueDeEscudo'] });
  assert.equal(e.hp, 2000);
  assert.ok(h.poeRecente?.bloqueou != null);
  ModsPoe.evento(e, h, 'acertar', f, { alvo, eventos: [], personagem: PERSONAGEM, tags: ['ataque', 'ataqueDeEscudo'] });
  assert.equal(e.hp, 2000, 'o segundo acertado do mesmo uso, não');
});
