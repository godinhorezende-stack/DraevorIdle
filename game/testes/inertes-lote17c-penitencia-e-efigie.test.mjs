// (07/11, lote 17 das inertes — dono: "Fazer todas pelo PoB") a MARCA DA PENITÊNCIA (o marcado, acertado, cria 2 Fantasmas Acorrentados hostis — uma vez por segundo) e a
// EFÍGIE DA DOEDRE (as Maldições encaixadas valem como aura em volta dela).
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
const Condicoes = await import('../systems/itens-poe/condicoes-poe.mjs');
const GemasPoe = await import('../systems/itens-poe/gemas-poe.mjs');
const HI = await import('../systems/itens-poe/habilidades-de-itens.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');

if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
}

const tr = (modelo, valores = []) => T.traduzirMod({ modelo, valores });
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 70, rng: () => 0.5 }));
const DOEDRE = ['Concede a Habilidade Convocar Efígie de Doedre Nível {0} / Habilidades de Feitiço Encaixadas são Ativadas por Efígie de Doedre quando convocadas', [20]];
const ACUSADOR = ['Concede a Habilidade Marca da Penitência Nível {0}', [20]];

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
  const h = e.hunt;
  h.clock = 100_000;
  const [b, longe, ...resto] = h.monstros;
  for (const m of resto) Object.assign(m, { x: h.pos.x + 60, y: h.pos.y + 60 });
  Object.assign(b, { x: h.pos.x + 2, y: h.pos.y, hp: 1e9, maxHp: 1e9, estados: {} });
  Object.assign(longe, { x: h.pos.x + 12, y: h.pos.y, hp: 1e9, maxHp: 1e9, estados: {} });
  ModsPoe.definirFichaDaCacada(h, () => Ficha.combate(e));
  return { e, h, b, longe };
}

test('as linhas do lote saem com efeito (as habilidades, aproximadas)', { skip: SEM }, () => {
  for (const [m, v] of [DOEDRE, ACUSADOR]) assert.ok(!['inerte', 'registrado'].includes(tr(m, v ?? []).estado), m);
});

test('a MARCA DA PENITÊNCIA: o marcado, acertado, cria 2 Fantasmas Acorrentados (hostis, sem experiência nem loot) — no máximo uma vez por segundo', { skip: SEM }, () => {
  const { e, h, b } = personagem([ACUSADOR]);
  const f = Ficha.combate(e);
  const fantasmas = () => h.monstros.filter((m) => m.fantasmaAcorrentado && m.hp > 0);
  ModsPoe.aoAcertar(e, h, b, f, { dano: 10, eventos: [] });
  assert.equal(fantasmas().length, 0, 'sem a marca');
  assert.ok(HI.usar(e, h, 'Penance_Mark', { id: 'pm', alvo: b, agora: h.clock }).ok);
  ModsPoe.aoAcertar(e, h, b, f, { dano: 10, eventos: [] });
  assert.equal(fantasmas().length, 2);
  assert.equal(fantasmas()[0].exp, 0);
  assert.deepEqual(fantasmas()[0].loot, []);
  ModsPoe.aoAcertar(e, h, b, f, { dano: 10, eventos: [], agora: h.clock + 500 });
  assert.equal(fantasmas().length, 2, 'uma vez por segundo');
  ModsPoe.aoAcertar(e, h, b, f, { dano: 10, eventos: [], agora: h.clock + 1000 });
  assert.equal(fantasmas().length, 4);
});

test('a EFÍGIE DA DOEDRE: a Maldição encaixada vale nos monstros a até 3 casas dela; longe, não', { skip: SEM }, () => {
  const { e, h, b, longe } = personagem([DOEDRE], 'Vulnerability');
  assert.ok(HI.usar(e, h, 'Summon_Doedres_Effigy', { id: 'ef', alvo: b, agora: h.clock }).ok);
  Acoes.tiqueDoGuardian(e, h, 1_000_000);
  assert.equal(Condicoes.maldicoesNoAlvo(b, h.clock), 1);
  assert.equal(Condicoes.maldicoesNoAlvo(longe, h.clock), 0);
  h.clock += 11_000;
  Acoes.tiqueDoGuardian(e, h, 1_000_100);
  assert.equal(h.poeEfigies.length, 0, 'a Efígie dura 10 s');
});
