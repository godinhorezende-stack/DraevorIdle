// A RETALIAÇÃO DOS ÚNICOS (dono, 14/10: "A Retaliação dos únicos"): as linhas que caíam na regra velha "as habilidades de Retaliação não
// existem no jogo" (a Retaliação existe desde 11/10 — a janela depois do bloqueio ou do Acerto Selvagem) passam a valer: o Gelo adicionado, a
// Recuperação da Recarga, o "usáveis a cada N segundos" e o Poder Arcano das Habilidades de Retaliação.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste } = await import('./apoio.mjs');
const Acoes = await import('../systems/acoes.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const { traduzirMod } = await import('../systems/itens-poe/traduzir.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');

const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 70, rng: () => 0.5 }));
/** Um personagem do PoE numa caçada, com um machado (`af` nele). */
function personagem(af = {}) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 80 });
  e.sistema = 'poe';
  e.classePoe = 'Duelist';
  const arma = peca('Two_Hand_Axes/Vaal_Axe');
  arma.poe.af = { ...(arma.poe.af ?? {}), ...af };
  e.equipment = { ...(e.equipment ?? {}), weapon: arma };
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  e.actions = Array(Acoes.SLOTS).fill(null);
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.clock = 100_000;
  P.garantir(e);
  return e;
}
const ficha = (e) => { Ficha.invalidar(e); return Ficha.combate(e); };
const traduzida = (modelo, valores) => { const t = traduzirMod({ modelo, valores, texto: modelo }); return { estado: t.estado, efeitos: Object.fromEntries(t.efeitos.map((x) => [x.stat, x.valor])) }; };

test('as LINHAS: as 4 que caíam na regra velha passam a ter efeito (e as 2 que já tinham regra seguem)', { skip: SEM }, () => {
  assert.deepEqual(traduzida('Adiciona {0} a {1} de Dano de Gelo às Habilidades de Retaliação', [250, 300]).efeitos, { 'added_ice_dmg_min@retaliacao': 250, 'added_ice_dmg_max@retaliacao': 300 });
  assert.deepEqual(traduzida('Habilidades de Retaliação têm Recuperação da Recarga aumentada em {0} %', [30]).efeitos, { 'cooldown_recovery@retaliacao': 30 });
  assert.deepEqual(traduzida('Habilidades de retaliação se tornam usáveis a cada {0} segundos', [4]).efeitos, { retaliacao_cada_s: 4 });
  assert.deepEqual(traduzida('Habilidades de retaliação têm {0} % de Poder Arcano', [200]).efeitos, { 'poder_arcano@retaliacao': 200 });
  assert.deepEqual(traduzida('Habilidades de Retaliação causam Dano aumentado em {0}%', [80]).efeitos, { 'dmg_inc@retaliacao': 80 });
  assert.deepEqual(traduzida('Habilidades de Retaliação se tornam Utilizáveis por um tempo {0}% maior', [60]).efeitos, { retaliacao_janela_inc: 60 });
  for (const [m, v] of [['Adiciona {0} a {1} de Dano de Gelo às Habilidades de Retaliação', [250, 300]], ['Habilidades de retaliação se tornam usáveis a cada {0} segundos', [4]]]) assert.notEqual(traduzida(m, v).estado, 'inerte', m);
});

test('"USÁVEIS A CADA N SEGUNDOS": as duas janelas (a do bloqueio e a do Acerto Selvagem) abrem sozinhas a cada N s, e voltam a ser usáveis', { skip: SEM }, () => {
  const e = personagem({ retaliacao_cada_s: 4 });
  const h = e.hunt;
  const t0 = h.clock;
  ModsPoe.tique(e, h, ficha(e), 250, t0);
  assert.equal(h.retaliacao.bloquear.ate, t0 + ModsPoe.RETALIACAO.janelaMs);
  assert.equal(h.retaliacao.selvagem.ate, t0 + ModsPoe.RETALIACAO.janelaMs);
  assert.ok(ModsPoe.retaliacaoUsavel(h, 'bloquear', 'Riposte', t0 + 1000));
  ModsPoe.usarRetaliacao(h, 'bloquear', 'Riposte', ficha(e).afPoe, t0 + 1000, () => 0.99);
  assert.ok(!ModsPoe.retaliacaoUsavel(h, 'bloquear', 'Riposte', t0 + 1000), 'usada');
  ModsPoe.tique(e, h, ficha(e), 250, t0 + 3000);
  assert.ok(!ModsPoe.retaliacaoUsavel(h, 'bloquear', 'Riposte', t0 + 3000), 'antes dos 4 s, não reabre');
  ModsPoe.tique(e, h, ficha(e), 250, t0 + 4000);
  assert.ok(ModsPoe.retaliacaoUsavel(h, 'bloquear', 'Riposte', t0 + 4000), 'reabriu');
  // (sem a linha, nada abre sozinho)
  const sem = personagem();
  ModsPoe.tique(sem, sem.hunt, ficha(sem), 250, sem.hunt.clock);
  assert.equal(sem.hunt.retaliacao?.bloquear, undefined);
});

test('no GOLPE de Retaliação: o Gelo adicionado, o Poder Arcano (200%) e a Recuperação da Recarga — só nas Habilidades de Retaliação', { skip: SEM }, () => {
  const e = personagem({ spell_dmg: 40, 'added_ice_dmg_min@retaliacao': 250, 'added_ice_dmg_max@retaliacao': 300, 'poder_arcano@retaliacao': 200, 'cooldown_recovery@retaliacao': 30 });
  const sem = personagem({ spell_dmg: 40 });
  const retaliacao = ['ataque', 'retaliacao', 'corpo', 'fisico'];
  const comum = ['ataque', 'corpo', 'fisico'];
  const gelo = (x, tags) => ModsPoe.fichaDoGolpe(ficha(x), tags).danoSomado?.ice ?? [0, 0];
  assert.deepEqual(gelo(e, retaliacao).map((v, i) => v - gelo(sem, retaliacao)[i]), [250, 300]);
  assert.deepEqual(gelo(e, comum), gelo(sem, comum), 'fora da Retaliação, nada');
  const fisico = (x, tags) => ModsPoe.fichaDoGolpe(ficha(x), tags).danoDoElemento?.physical ?? 0;
  assert.equal(fisico(e, retaliacao) - fisico(sem, retaliacao), ficha(e).danoDeMagiaDoPoe * 2, '200% do Dano Mágico aumentado');
  assert.equal(fisico(e, comum) - fisico(sem, comum), 0);
  assert.equal(ModsPoe.somaPorTags(ficha(e), retaliacao).cooldown_recovery, 30);
  assert.equal(ModsPoe.somaPorTags(ficha(e), comum).cooldown_recovery ?? 0, 0);
});
