// OS PARCIAIS MÉDIOS da árvore do PoE (dono, 13/10: "siga na 1 depois as outras" — o item 3 do relatório): a mana da Maestria de Mana ao longo
// do tempo, o dreno só do dano físico dos ataques, o "-X% extra" da Exposição também na das gemas e das auras, o veneno "mais rápido" só no
// Veneno e a Pândega (o efeito das auras nos inimigos — a marca do Orgulho).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste } = await import('./apoio.mjs');
const Acoes = await import('../systems/acoes.mjs');
const G = await import('../systems/itens-poe/gemas-poe.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const AfeccoesPoe = await import('../systems/itens-poe/afeccoes.mjs');
const Reforcos = await import('../systems/skills/reforcos.mjs');
const { traduzirParte } = await import('../systems/itens-poe/traduzir.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');

const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 70, rng: () => 0.5 }));
/** Um personagem do PoE numa caçada, com `af` na varinha. */
function personagem(af = {}) {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 80 });
  e.sistema = 'poe';
  e.classePoe = 'Witch';
  const arma = peca('Wands/Driftwood_Wand');
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
/** Todas as linhas da árvore com o texto que casa `re` existem, ficaram exatas (sem nota) e dão `stat`. */
function exata(re, stat) {
  const ls = P.arvore().nos.flatMap((n) => [n, ...(n.opcoes ?? [])].flatMap((o) => (o.textos ?? []).map((t, i) => ({ t, estado: o.estados?.[i], nota: o.notas?.[i] ?? null, efeitos: o.efeitos })))).filter((l) => re.test(l.t));
  assert.ok(ls.length > 0, `há linha ${re}`);
  for (const l of ls) {
    assert.ok(['equivalente', 'novo'].includes(l.estado), `${l.t}: ${l.estado} (${l.nota})`);
    assert.equal(l.nota, null, l.t);
    if (stat) assert.ok(l.efeitos.some((x) => x.add === stat), `${l.t}: ${JSON.stringify(l.efeitos)}`);
  }
  return ls.length;
}

test('a MAESTRIA DE MANA: "Recupera 10% da Mana por 1 segundo quando você usar uma Habilidade de Guarda" — ao longo do segundo, não na hora', { skip: SEM }, () => {
  assert.equal(exata(/^Recupera 10% da Mana por 1 segundo quando você usar uma Habilidade de Guarda$/, 'ev:usarGuarda:regenPct:mana:1'), 12, 'as 12 maestrias');
  const e = personagem({ 'ev:usarGuarda:regenPct:mana:1': 10 });
  e.maxMana = 1000;
  e.mana = 100;
  ModsPoe.evento(e, e.hunt, 'usarGuarda', ficha(e));
  assert.equal(e.mana, 100, 'nada na hora');
  const r = (e.hunt.recuperacoes ?? []).find((x) => x.recurso === 'mana');
  assert.ok(r, 'uma recuperação de mana');
  assert.ok(Math.abs(r.porMs * (r.ate - r.desde) - 100) < 1e-9, '10% da mana máxima, em 1 s');
  assert.equal(r.ate - r.desde, 1000);
});

test('o DRENO do "Dano de Ataques Físicos": só da parte física dos ataques (antes, de todo o dano) — e as peças com a linha', { skip: SEM }, () => {
  exata(/do Dano de Ataques Físicos é Drenado como Vida$/, 'life_leech_fisico_ataque');
  exata(/do Dano de Ataques Físicos é Drenado como Mana$/, 'mana_leech_fisico_ataque');
  assert.deepEqual(traduzirParte('{0}% do Dano de Ataques Físicos é Drenado como Vida', ['1']).efeitos.map((x) => x.stat), ['life_leech_fisico_ataque'], 'o mod das peças');
  const vida = (e) => (e.hunt.roubos ?? []).filter((x) => x.recurso === 'vida').reduce((n, x) => n + x.restante, 0);
  const mana = (e) => (e.hunt.roubos ?? []).filter((x) => x.recurso === 'mana').reduce((n, x) => n + x.restante, 0);
  const e = personagem({ life_leech_fisico_ataque: 2, mana_leech_fisico_ataque: 1 });
  e.maxHp = 1e6;
  e.maxMana = 1e6;
  const f = ficha(e);
  const baseVida = Math.floor(1000 * (f.lifeLeech ?? 0));
  Ficha.aplicarLeech(e, 1000, [], null, null, f, null, { ataque: true, danoFisico: 400 });
  assert.ok(Math.abs(vida(e) - (baseVida + 8)) <= 1, `2% dos 400 físicos: ${vida(e)}`);
  assert.ok(mana(e) >= 4 - 1e-9, `1% dos 400 físicos em mana: ${mana(e)}`);
  const s = personagem({ life_leech_fisico_ataque: 2 });
  s.maxHp = 1e6;
  Ficha.aplicarLeech(s, 1000, [], null, null, ficha(s), null, { ataque: true, danoFisico: 0 });
  assert.equal(vida(s), Math.floor(1000 * (ficha(s).lifeLeech ?? 0)), 'sem físico, o 2% não drena');
  const m = personagem({ life_leech_fisico_ataque: 2 });
  m.maxHp = 1e6;
  Ficha.aplicarLeech(m, 1000, [], null, null, ficha(m), null, { ataque: false, danoFisico: 400 });
  assert.equal(vida(m), 0, 'a magia não drena');
});

test('a EXPOSIÇÃO: o "-X% extra" das Maestrias vale também na Exposição das gemas, das auras e dos Vínculos (os 10% do PoE)', { skip: SEM }, () => {
  exata(/^Exposição a Fogo infligida por você aplica/, 'exposicao_extra_fogo');
  const agora = 1000;
  const alvo = { estados: { exposicao: { fire: agora + 4000, ice: agora + 4000 } } };
  assert.equal(ModsPoe.exposicao(alvo, agora, 'fire', {}), 10);
  assert.equal(ModsPoe.exposicao(alvo, agora, 'fire', { exposicao_extra_fogo: -5 }), 15, 'a da gema/aura: 10 + 5');
  assert.equal(ModsPoe.exposicao(alvo, agora, 'ice', { exposicao_extra_fogo: -5 }), 10, 'só no elemento dela');
  // (a do acerto já guarda o extra — `exposicaoPct` —: não soma de novo)
  alvo.estados.exposicaoPct = { fire: 20 };
  assert.equal(ModsPoe.exposicao(alvo, agora, 'fire', { exposicao_extra_fogo: -5 }), 20);
});

test('o VENENO "X% mais rápido": só o Veneno (antes, todas as afecções de dano)', { skip: SEM }, () => {
  assert.equal(exata(/^Envenenamentos infligidos por você causam Dano 20% mais rápido$/, 'veneno_mais_rapido'), 4);
  const duracoes = (af) => {
    const bicho = { hp: 1e6, maxHp: 1e6, x: 0, y: 0, estados: {} };
    AfeccoesPoe.aoAcertar(bicho, [{ elemento: 'physical', dano: 1000 }], { afeccoes: AfeccoesPoe.daSoma({ chance_poison: 100, chance_bleed: 100, ...af }), ataque: true, agora: 0, rng: () => 0 });
    return Object.fromEntries((bicho.dots ?? []).map((d) => [d.tipo, d.ate]));
  };
  const sem = duracoes({});
  const com = duracoes({ veneno_mais_rapido: 25 });
  assert.ok(sem.venenoPoe > 0 && sem.sangramento > 0, JSON.stringify(sem));
  assert.ok(Math.abs(com.venenoPoe - sem.venenoPoe / 1.25) <= 1, `o Veneno 25% mais rápido: ${sem.venenoPoe} → ${com.venenoPoe}`);
  assert.equal(com.sangramento, sem.sangramento, 'o Sangramento fica');
});

test('a PÂNDEGA: "Efeito de Auras Não-Maldição de suas Habilidades aumentado em 10% nos Inimigos" — a marca do Orgulho nos inimigos, maior', { skip: SEM }, () => {
  exata(/^Efeito de Auras Não-Maldição de suas Habilidades aumentado em 10% nos Inimigos$/, 'aura_efeito_nos_inimigos');
  const e = personagem({ aura_efeito_nos_inimigos: 10 });
  const h = e.hunt;
  const id = G.doSlug('Pride').acao;
  const efeitosPoe = G.buffNoNivel('Pride', 20).efeitos;
  const vuln = efeitosPoe.find((x) => x.efeito === 'marcaVulneravel');
  assert.ok(vuln?.pct > 0, 'o Orgulho marca os inimigos');
  h.buffs = { [id]: { ate: h.clock + 60_000, desde: h.clock, tipo: 'poe-aura', fator: 1, efeitosPoe } };
  const pct = (nosInimigos) => {
    h.poeAuraNosInimigosPct = nosInimigos;
    const bicho = { hp: 100, maxHp: 100, x: 1, y: 1, estados: {} };
    Reforcos.marcar(h, bicho, h.clock);
    return bicho.marcas?.vulneravel?.pct;
  };
  assert.equal(pct(0), vuln.pct);
  assert.ok(Math.abs(pct(10) - vuln.pct * 1.1) < 1e-9, '10% a mais');
  // (a foto do tique: o tique da caçada guarda o que a ficha dá)
  Cacadas.tique(e, null, h.clock + 250);
  assert.equal(e.hunt.poeAuraNosInimigosPct, 10);
});
