// LOTE 75 — o ARAUTO DA AGONIA com a VIRULÊNCIA (dono, 17/10: "No máximo, como o PoB") e o notável Pura Agonia das Ramificadoras: 1 → 0 sem
// efeito (os notáveis das Ramificadoras zerados). A gema vira um Arauto (reserva 25% de Mana; o buff: 20% de chance de Envenenar e 10% mais
// Dano com Veneno); a Virulência fica no máximo — 40 + floor(qualidade × 0,25) + "+N de Virulência Máxima" — enquanto o Arauto está ligado e
// você Envenenou com ele há até 4 s; o Rastejador Agonizante vem ao Envenenar, escala pela Virulência e some sem ela.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
await (await import('../systems/itens-poe/iniciar.mjs')).iniciarJogoDoPoe();
const A = await import('../systems/itens-poe/arvore.mjs');
const C = await import('../systems/itens-poe/condicoes-poe.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Virulencia = await import('../systems/itens-poe/virulencia.mjs');
const L = await import('../systems/itens-poe/lacaios-poe.mjs');
const AfeccoesPoe = await import('../systems/itens-poe/afeccoes.mjs');
const Reserva = await import('../systems/itens-poe/reserva.mjs');
const Acoes = await import('../systems/acoes.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const G = await import('../systems/itens-poe/gemas-poe.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
if (!SEM) J.iniciar(ITEM_CATALOG);

const efeitos = (linha) => Object.fromEntries(A.traduzirLinha(linha).efeitos.map((e) => [e.add, e.valor]));
const anel = (af) => ({ id: 3357, count: 1, poe: { classe: 'Rings', base: 'Rings/X', af, prefixos: [], sufixos: [], implicitos: [] } });
/** Uma Bruxa do PoE com o Arauto da Agonia (nível `nivel`, qualidade `qualidade`) na barra 0, um anel com `af`, numa caçada do PoE. */
function bruxa(af = {}, { nivel = 20, qualidade = 20 } = {}) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'sorcerer', level: 90 }), { sistema: 'poe', classePoe: 'Witch' });
  const arma = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Wands/Driftwood_Wand', raridade: 'normal', ilvl: 20, rng: () => 0.99 }));
  arma.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
  e.equipment = { ...(e.equipment ?? {}), weapon: arma, ring: anel(af) };
  e.inventory = [GS.itemDaGema({ id: G.doSlug(Virulencia.SLUG).itemId, nivel, xp: 0, raridade: 'comum', qualidade })];
  GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: Virulencia.ID, enabled: true, minMana: 0, conditions: [] };
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 1e6;
  e.maxHp = e.hp = 1e6;
  P.garantir(e);
  return e;
}
const ligar = (e) => { e.hunt.clock += 10_000; return Acoes.disparar(e, e.hunt, PERSONAGEM, 0, null, { manual: true }); };
const rastejadores = (e) => (e.hunt.lacaios ?? []).filter((l) => l.gema === Virulencia.SLUG && l.hp > 0 && !(l.ate && l.ate <= (e.hunt.ultimoTique ?? Date.now())));
/** Um veneno seu agora (o evento do PoE — `mods-poe.aoPorAfeccoes`). */
const envenenar = (e) => ModsPoe.evento(e, e.hunt, 'envenenar', Ficha.combate(e), {});

test('a linha: "+5 de Virulência Máxima"', { skip: SEM }, () => {
  assert.deepEqual(efeitos('+5 de Virulência Máxima'), { virulencia_max: 5 });
});

test('a GEMA: Arauto (não lacaio); o buff com a chance de Envenenar e o mais do Veneno (não "mais Dano" em tudo); parcial com o motivo da Virulência', { skip: SEM }, () => {
  const g = G.doSlug(Virulencia.SLUG);
  assert.equal(g.arquetipo, 'arauto');
  const entry = Acoes.POR_ID_PUBLICO(Virulencia.ID);
  assert.equal(entry.poeGema.buff, true);
  assert.equal(entry.poeGema.lacaio, undefined);
  const b = G.buffNoNivel(Virulencia.SLUG, 20);
  assert.deepEqual(b.af, { chance_poison: 20, veneno_mais_final: 10 });
  assert.deepEqual(b.efeitos, []);
  assert.equal(b.dur, 60000);
  assert.equal(g.statusNoJogo, 'parcial');
  assert.ok(g.motivosNoJogo.some((m) => /Virulência fica no máximo/.test(m)));
  assert.ok(!g.motivosNoJogo.some((m) => /efeito não simulado/.test(m) && /Virulência|Rastejador/.test(m)));
});

test('LIGAR o Arauto: o buff com a reserva (25% de Mana), sem lacaio; conta como habilidade de Lacaio; afetado por Arauto', { skip: SEM }, () => {
  const e = bruxa();
  const r = ligar(e);
  assert.ok(r.ok, r.erro);
  const b = e.hunt.buffs[Virulencia.ID];
  assert.equal(b.tipo, 'poe-arauto');
  assert.equal(b.ate, Reserva.LIGADA_ATE);
  assert.equal(b.reserva?.pct, 25);
  assert.equal(rastejadores(e).length, 0, 'o Rastejador só vem ao Envenenar');
  assert.ok(C.condicoesDe(e).has('usouLacaioRecente') || e.hunt.poeRecente?.usouLacaio != null, 'usou uma habilidade de Lacaio');
  assert.ok(C.condicoesDe(e).has('afetadoPorArauto'));
  const de = ligar(e);
  assert.equal(de.ok, false, 'já ligado');
});

test('a VIRULÊNCIA MÁXIMA: 40 + floor(qualidade × 0,25) + "+N de Virulência Máxima"', { skip: SEM }, () => {
  assert.equal(Virulencia.maxima(20, 20, { virulencia_max: 5 }), 50);
  assert.equal(Virulencia.maxima(20, 10, {}), 42);
  assert.equal(Virulencia.maxima(1, 0, {}), 40);
  assert.equal(Virulencia.maxima(20, 23, {}), 45);
});

test('a VIRULÊNCIA agora: no máximo se você Envenenou com o Arauto ligado há até 4 s; o veneno de antes de ligar não conta', { skip: SEM }, () => {
  const hunt = { clock: 10_000, buffs: { [Virulencia.ID]: { tipo: 'poe-arauto', desde: 10_000, ate: Infinity } }, poeRecente: {} };
  hunt.poeRecente['ev:envenenar'] = 9_000;
  assert.equal(Virulencia.atual(hunt, 50), 0, 'antes de ligar');
  hunt.poeRecente['ev:envenenar'] = 10_500;
  assert.equal(Virulencia.atual(hunt, 50, 14_500), 50);
  assert.equal(Virulencia.atual(hunt, 50, 14_501), 0, 'depois dos 4 s');
  assert.equal(Virulencia.atual({ ...hunt, buffs: {} }, 50, 11_000), 0, 'sem o Arauto');
});

test('o RASTEJADOR pela Virulência (gema 20, Virulência 50): +200% de velocidade, +450% de Físico, o adicionado escalado; Físico com 40% em Caos, intocável, não Provoca', { skip: SEM }, () => {
  const q = L.oQueInvoca(Virulencia.SLUG, 20, { nivel: 20, virulencia: 50 }, {});
  const sem = L.oQueInvoca(Virulencia.SLUG, 20, { nivel: 20 }, {});
  assert.equal(q.velAtaquePct, 200);
  assert.equal(q.poe.danoIncPct, 450);
  assert.deepEqual(q.somado.map(Math.round), [2250 * 5.5, 4200 * 5.5]);
  assert.ok(Math.abs(q.dano.max / sem.dano.max - 5.5) < 0.01, 'o golpe × (1 + 450%)');
  assert.equal(q.intocavel, true);
  assert.equal(q.elemento, 'physical');
  assert.equal(q.conversao?.chaos, 40);
  assert.equal(q.poe.chances.provocar, 0);
  assert.equal(q.nome, 'Rastejador da Agonia');
  // os outros lacaios não mudam
  assert.deepEqual(L.oQueInvoca('Raise_Zombie', 10, { nivel: 10, virulencia: 50 }, {}), L.oQueInvoca('Raise_Zombie', 10, { nivel: 10 }, {}));
});

test('ao ENVENENAR com o Arauto ligado, o Rastejador vem (sem contar como uso de Lacaio) com a Virulência no máximo; 4 s sem envenenar, some; envenenar de novo, volta', { skip: SEM }, () => {
  const e = bruxa({ virulencia_max: 5 });
  assert.ok(ligar(e).ok);
  const usou = e.hunt.poeRecente?.usouLacaio;
  assert.equal(Acoes.tiqueDoArautoDaAgonia(e, e.hunt).length, 0, 'sem veneno: nada');
  assert.equal(rastejadores(e).length, 0);
  envenenar(e);
  Acoes.tiqueDoArautoDaAgonia(e, e.hunt);
  const [l] = rastejadores(e);
  assert.ok(l, 'o Rastejador veio');
  assert.equal(l.virulencia, 50, 'gema 20, qualidade 20, +5');
  assert.equal(e.hunt.poeRecente?.usouLacaio, usou, 'não é uso de Lacaio');
  // um tique depois, ainda com Virulência: o mesmo
  e.hunt.clock += 1000;
  Acoes.tiqueDoArautoDaAgonia(e, e.hunt);
  assert.equal(rastejadores(e).length, 1);
  // 4 s sem envenenar: some (pelo `ate`, não é morte)
  e.hunt.clock += 3001;
  Acoes.tiqueDoArautoDaAgonia(e, e.hunt);
  assert.ok(l.ate > 0 && l.hp > 0, 'sai pelo ate');
  assert.equal(rastejadores(e).length, 0);
  // o tique dos lacaios o tira; um veneno novo o chama de novo
  e.hunt.lacaios = e.hunt.lacaios.filter((x) => x !== l);
  envenenar(e);
  Acoes.tiqueDoArautoDaAgonia(e, e.hunt);
  assert.equal(rastejadores(e).length, 1);
});

test('DESLIGAR o Arauto (a gema sai da barra): o Rastejador some', { skip: SEM }, () => {
  const e = bruxa();
  assert.ok(ligar(e).ok);
  envenenar(e);
  Acoes.tiqueDoArautoDaAgonia(e, e.hunt);
  assert.equal(rastejadores(e).length, 1);
  e.actions[0] = null;
  Acoes.desligarAurasForaDaBarra(e, e.hunt);
  assert.equal(e.hunt.buffs[Virulencia.ID], undefined);
  Acoes.tiqueDoArautoDaAgonia(e, e.hunt);
  assert.equal(rastejadores(e).length, 0);
});

test('o MAIS do Veneno do buff: o Veneno × 1,1', { skip: SEM }, () => {
  const total = (af) => {
    const bicho = { uid: 1, hp: 1e9, maxHp: 1e9, estados: {}, dots: [] };
    AfeccoesPoe.aoAcertar(bicho, [{ elemento: 'physical', dano: 1000 }], { afeccoes: AfeccoesPoe.daSoma({ chance_poison: 100, ...af }), agora: 1000, rng: () => 0 });
    return (bicho.dots ?? []).filter((d) => d.tipo === 'venenoPoe').reduce((n, d) => n + d.falta, 0);
  };
  const sem = total({});
  assert.ok(sem > 0);
  assert.ok(Math.abs(total({ veneno_mais_final: 10 }) / sem - 1.1) < 0.01);
});

test('o RELATÓRIO: os notáveis das Ramificadoras sem efeito chegam a 0', { skip: SEM }, async () => {
  const { linhasDasRamificadoras } = await import('../tools/relatorio-arvore-poe.mjs');
  const { grupos } = await linhasDasRamificadoras(Catalogo.catalogo());
  assert.equal(grupos.notavel.sem, 0);
});
