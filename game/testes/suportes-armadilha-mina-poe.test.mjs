// Os SUPORTES DE ARMADILHA E MINA do PoE (lote G3, 17/10): antes travados ("armadilhas e minas ainda não existem no jogo") — as plantadas
// existem desde 12/10 (`itens-poe/armas-plantadas.mjs`). O Suporte de Armadilha e os de Mina transformam a habilidade suportada em
// Armadilha/Mina; as Armadilhas Múltiplas/Agrupadas e a Montagem Ágil arremessam mais; a velocidade de arremesso e a recarga valem só no tipo
// que a habilidade planta; as Carregadas dão cargas ao ativar/detonar; a Invenção e a Explosão em Cadeia mudam o dano do uso que sai da
// plantada. Mede no jogo: o arremesso planta, a plantada ativa e o dano sai dela.
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
const P = await import('../systems/passivas/arvore.mjs');
const Plantadas = await import('../systems/itens-poe/armas-plantadas.mjs');

/** Uma Bruxa com a ativa e os suportes ligados na varinha, a ativa no slot 1, numa caçada do PoE. */
async function bruxaCom(ativa, suportes = [], { nivel = 20 } = {}) {
  const J = await import('../systems/itens-poe/jogo.mjs');
  const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 80 });
  e.sistema = 'poe';
  e.classePoe = 'Witch';
  const n = 1 + suportes.length;
  const arma = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Wands/Driftwood_Wand', raridade: 'normal', ilvl: 20, rng: () => 0.99 }));
  arma.soquetes = { abertos: n, links: Array.from({ length: n - 1 }, () => true), gemas: Array(n).fill(null), cores: Array(n).fill('W') };
  e.equipment = { ...(e.equipment ?? {}), weapon: arma };
  e.inventory = [ativa, ...suportes].map((s) => GS.itemDaGema({ id: (G.doSlug(s) ?? SP.doSlug(s)).itemId, nivel, xp: 0, raridade: 'comum' }));
  for (let i = 0; i < n; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: G.doSlug(ativa).acao, enabled: true, minMana: 0, conditions: [] };
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 1e6;
  e.maxHp = e.hp = 1e6;
  P.garantir(e);
  return e;
}
function bichoEm(e, dx, dy) {
  const [b, ...outros] = e.hunt.monstros;
  for (const o of outros) Object.assign(o, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60 });
  Object.assign(b, { x: e.hunt.pos.x + dx, y: e.hunt.pos.y + dy, hp: 1e9, maxHp: 1e9 });
  return b;
}
function usar(e, alvo) {
  e.hunt.clock += 10_000;
  const r = Acoes.disparar(e, e.hunt, PERSONAGEM, 0, alvo, {});
  assert.ok(r.ok, r.erro);
  if (!r.conjurando) return r.eventos ?? [];
  e.hunt.clock += 3000;
  return Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM);
}
const danoEm = (eventos, b) => eventos.filter((x) => x.t === 'dmg' && x.uid === b.uid && x.foe).reduce((t, x) => t + x.v, 0);

test('G3: os suportes de Armadilha/Mina saem da trava "ainda não existem no jogo" e leem as linhas', { skip: SEM }, () => {
  for (const s of ['Trap_Support', 'Multiple_Traps_Support', 'Cluster_Traps_Support', 'Swift_Assembly_Support', 'Trap_and_Mine_Damage_Support', 'Advanced_Traps_Support', 'Charged_Traps_Support', 'Blastchain_Mine_Support']) {
    const r = SP.doSlug(s);
    assert.ok(r, s);
    assert.ok(!r.motivos.some((m) => /ainda não existem no jogo/.test(m)), `${s}: ${r.motivos.join(' | ')}`);
    assert.notEqual(r.status, 'nao', s);
  }
  const trap = SP.efeitoNoNivel('Trap_Support', 20).efeito;
  assert.equal(trap.plantaArmadilha, 1);
  assert.equal(trap.plantaDuracaoMs, 4000);
  assert.ok(trap.ataqueSemArmaCorpo > 0);
  const mult = SP.efeitoNoNivel('Multiple_Traps_Support', 20).efeito;
  assert.equal(mult.armadilhasExtras, 2);
  assert.equal(mult.maxArmadilhasExtra, 3);
  assert.ok(mult.maisDanoPct < 0, 'menos dano');
  const agil = SP.efeitoNoNivel('Swift_Assembly_Support', 20).efeito;
  assert.ok(agil['arremessoChance:1'] > 0 && agil['arremessoChance:2'] > 0 && agil['arremessoChance:3'] > 0, JSON.stringify(agil));
  const cadeia = SP.efeitoNoNivel('Blastchain_Mine_Support', 20).efeito;
  assert.equal(cadeia.plantaMina, 1);
  assert.equal(cadeia.plantaDetonacaoMs, 250);
  assert.equal(cadeia.maisPorMinaAnteriorPct, 5);
  // A linha repetida com "\n" literal das Minas Carregadas não soma de novo.
  assert.equal(SP.efeitoNoNivel('Charged_Mines_Support', 20).efeito['af:crit_chance_inc%carga:poder'], 20);
});

test('G3: o tipo plantado pelo suporte, as Armadilhas/Minas a mais e as faixas da Montagem Ágil', { skip: SEM }, () => {
  const bola = Acoes.POR_ID_PUBLICO(G.doSlug('Fireball').acao);
  assert.equal(Plantadas.tipoDaGema(bola), null, 'a Bola de Fogo sozinha não planta');
  assert.equal(Plantadas.tipoDaGema(bola, { plantaArmadilha: 1 }), 'armadilha');
  assert.equal(Plantadas.tipoDaGema(bola, { plantaMina: 1 }), 'mina');
  const ficha = { afPoe: {} };
  assert.equal(Plantadas.extrasDoArremesso(ficha, 'armadilha', () => 0.99, { armadilhasExtras: 2 }), 2);
  assert.equal(Plantadas.extrasDoArremesso(ficha, 'mina', () => 0.99, { minasExtras: 2 }), 2);
  // a maior faixa que acerta o sorteio vale: sorteio 0,05 → a de 3 (6%); 0,10 → a de 2 (12%); 0,15 → a de 1 (18%); 0,5 → nenhuma
  const agil = { 'arremessoChance:1': 18, 'arremessoChance:2': 12, 'arremessoChance:3': 6 };
  assert.equal(Plantadas.extrasDoArremesso(ficha, 'armadilha', () => 0.05, agil), 3);
  assert.equal(Plantadas.extrasDoArremesso(ficha, 'mina', () => 0.1, agil), 2);
  assert.equal(Plantadas.extrasDoArremesso(ficha, 'armadilha', () => 0.15, agil), 1);
  assert.equal(Plantadas.extrasDoArremesso(ficha, 'armadilha', () => 0.5, agil), 0);
  assert.equal(Plantadas.maximo(ficha, 'armadilha', 3), 18);
});

test('G3: a Bola de Fogo com o Suporte de Armadilha vira Armadilha: com o alvo em cima ela ativa na hora; plantada longe, espera o inimigo a 1 casa', { skip: SEM }, async () => {
  const e = await bruxaCom('Fireball', ['Trap_Support']);
  // o arremesso cai no alvo (a 3 casas): ele está em cima, ativa na hora — o dano sai e nada fica plantado
  const b = bichoEm(e, 3, 0);
  const ev = usar(e, b);
  assert.ok(danoEm(ev, b) > 0, 'a Armadilha ativou');
  assert.equal(Plantadas.plantadas(e.hunt, 'armadilha').length, 0);
  // a duração é a do suporte ("Armadilha dura 4 segundo"): a mesma conta que o arremesso usa
  assert.equal(GS.efeitoNaSkill(e, G.doSlug('Fireball').acao).plantaDuracaoMs, 4000);
  // plantada longe (como o arremesso deixaria sem ninguém em cima): espera; o inimigo chega a 1 casa e a Bola de Fogo sai DELA
  Object.assign(b, { x: e.hunt.pos.x + 20, y: e.hunt.pos.y });
  Plantadas.plantar(e.hunt, Ficha.combate(e), { tipo: 'armadilha', acao: e.actions[0].id, slot: 0, x: e.hunt.pos.x + 2, y: e.hunt.pos.y, duracaoMs: 4000, agora: e.hunt.clock });
  assert.deepEqual(Acoes.tiqueDasPlantadas(e, e.hunt, PERSONAGEM, []), [], 'ninguém perto: nada');
  Object.assign(b, { x: e.hunt.pos.x + 3, y: e.hunt.pos.y });
  assert.ok(danoEm(Acoes.tiqueDasPlantadas(e, e.hunt, PERSONAGEM, []), b) > 0, 'o inimigo a 1 casa ativa');
});

test('G3: Armadilhas Múltiplas arremessam 3 (1 + 2); a velocidade de arremesso vale só no que planta', { skip: SEM }, async () => {
  const e = await bruxaCom('Fireball', ['Trap_Support', 'Multiple_Traps_Support']);
  const b = bichoEm(e, 3, 0);
  const ev = usar(e, b);
  // as 3 caem no alvo e em volta dele (a 1 casa): todas ativam — 3 Bolas de Fogo nele
  assert.ok(ev.filter((x) => x.t === 'dmg' && x.uid === b.uid && x.foe).length >= 3, `acertos: ${ev.filter((x) => x.t === 'dmg' && x.uid === b.uid && x.foe).length}`);
  // Armadilhas Avançadas: "(15 — 34)% de Velocidade de Armação de Armadilhas aumentada" — encurta o uso da Bola de Fogo que planta; sem o Suporte
  // de Armadilha (a Bola de Fogo normal) o mesmo efeito não muda nada.
  const comArmadilha = await bruxaCom('Fireball', ['Trap_Support', 'Advanced_Traps_Support']);
  const soArmadilha = await bruxaCom('Fireball', ['Trap_Support']);
  const bola = Acoes.POR_ID_PUBLICO(G.doSlug('Fireball').acao);
  const uso = (x) => Acoes.temposDaGemaPoe(x, bola).uso;
  assert.ok(uso(comArmadilha) < uso(soArmadilha), `${uso(comArmadilha)} < ${uso(soArmadilha)}`);
  const ef = GS.efeitoNaSkill(comArmadilha, bola.id);
  assert.ok(ef.velArremessoArmadilhaPct > 0);
  const semPlantar = { ...ef, plantaArmadilha: 0 };
  assert.equal(Acoes.temposDaGemaPoe(comArmadilha, bola, semPlantar).uso, Acoes.temposDaGemaPoe(comArmadilha, bola, { ...semPlantar, velArremessoArmadilhaPct: 0 }).uso, 'sem plantar, a velocidade de armação não vale');
});

test('G3: as restrições de arma — o ataque com o Suporte de Armadilha não sai com arma corpo a corpo', { skip: SEM }, async () => {
  const e = await bruxaCom('Fireball', ['Trap_Support']);
  const ef = GS.efeitoNaSkill(e, Acoes.POR_ID_PUBLICO(G.doSlug('Fireball').acao).id);
  assert.ok(ef.ataqueSemArmaCorpo > 0);
  // (a Bola de Fogo é magia: a restrição é só dos ataques — ela sai com a varinha e sairia com qualquer arma)
  bichoEm(e, 3, 0);
  assert.doesNotThrow(() => usar(e, e.hunt.monstros[0]));
});

test('G3: a compatibilidade pelo tipo acrescentado — as Armadilhas Múltiplas só suportam a Bola de Fogo com o Suporte de Armadilha no grupo', { skip: SEM }, async () => {
  const bola = G.doSlug('Fireball').acao;
  const nomes = (e) => GS.efeitoNaSkill(e, bola).supports;
  const sem = await bruxaCom('Fireball', ['Multiple_Traps_Support']);
  assert.equal(nomes(sem).length, 0, `sem o Suporte de Armadilha: ${nomes(sem)}`);
  const com = await bruxaCom('Fireball', ['Trap_Support', 'Multiple_Traps_Support']);
  assert.equal(nomes(com).length, 2, `com ele: ${nomes(com)}`);
  // (a Mina também: o Dano de Armadilha e Mina vale com a Explosão em Cadeia)
  const mina = await bruxaCom('Fireball', ['Blastchain_Mine_Support', 'Trap_and_Mine_Damage_Support']);
  assert.equal(nomes(mina).length, 2, `${nomes(mina)}`);
});
