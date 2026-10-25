// (lotes G-A e G-C, dono 25/10) AS GEMAS ATIVAS DE MALDIÇÃO, MARCA E CLAMOR (o plano "ativas 3", as recomendações aceitas): as Marcas no acerto (as Cargas, as Cargas de
// Frasco), a Redução Física a menos do Caçador, a Precisão a menos e a qualidade do Enfraquecer, a do Desespero, a Corrente Temporal (a velocidade de ação, o "expira
// mais devagar"), a Punição (a Vida Baixa, o Debilitar), a Marca do Atirador (o projétil, a divisão), a Alquimista (os solos), a Detonação de Feitiços e a Ruína como magias
// de área com dano, o Impelir restrito dos clamores, o Intimidador, a Runa que não pode ser Convocada e a qualidade das guardas. Os números são os do PoE (o PoB, o poedb);
// os sorteios ficam travados.
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
const GAC = await import('../systems/itens-poe/gemas-gac.mjs');
const Reforcos = await import('../systems/skills/reforcos.mjs');
const Estados = await import('../systems/skills/estados.mjs');
const Res = await import('../systems/hunt/resistencia.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Runas = await import('../systems/itens-poe/runas-vinculadas.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');

let J;
let gerarPeca;
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
const perto = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

function travado(v, fn) {
  const antes = Math.random;
  Math.random = () => v;
  try { return fn(); } finally { Math.random = antes; }
}
/** O personagem com as gemas LIGADAS na arma (um grupo só), numa caçada; o alvo imortal a (`dx`, 0) e os outros longe. */
async function montar(slugs, { nivel = 20, qualidade = 0, arma = 'Wands/Driftwood_Wand', dx = 2 } = {}) {
  J ??= await import('../systems/itens-poe/jogo.mjs');
  gerarPeca ??= (await import('../systems/itens-poe/gerar.mjs')).gerarPeca;
  const lista = [slugs].flat();
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Scion', sistema: 'poe' });
  const a = peca(arma);
  a.soquetes = { abertos: lista.length, links: lista.slice(1).map(() => true), gemas: lista.map(() => null), cores: lista.map(() => 'W') };
  e.equipment = { ...e.equipment, weapon: a };
  delete e.equipment.shield;
  e.inventory = lista.map((s) => GS.itemDaGema({ id: G.doSlug(s).itemId, nivel, xp: 0, raridade: 'comum', qualidade }));
  for (let i = 0; i < lista.length; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  e.actions = Array(Acoes.SLOTS).fill(null);
  lista.forEach((s, i) => { e.actions[i] = { id: G.doSlug(s).acao, enabled: true, minMana: 0, conditions: [] }; });
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(travado(0.5, () => Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' })).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 1e7;
  e.maxHp = e.hp = 1e7;
  const [b, ...resto] = e.hunt.monstros;
  for (const m of resto) Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60 });
  Object.assign(b, { x: e.hunt.pos.x + dx, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12, estados: {}, resist: {}, dots: [], armaduraPct: -100, evasao: 0 });
  return { e, b, resto };
}
function usar(e, b, { slot = 0, v = 0.5 } = {}) {
  return travado(v, () => {
    const x = Acoes.disparar(e, e.hunt, PERSONAGEM, slot, b, { manual: true });
    if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; return { ...x, eventos: [...(x.eventos ?? []), ...(Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM) ?? [])] }; }
    return x;
  });
}
const liberar = (e, ms = 1) => { e.hunt.cooldowns = {}; delete e.hunt.conjurando; e.hunt.clock += ms; };
const golpesEm = (ev, m) => (ev ?? []).filter((x) => x.t === 'dmg' && x.foe !== false && x.uid === m.uid && !x.dot).map((x) => x.v);
const outro = (e, m, dx, dy) => Object.assign(m, { x: e.hunt.pos.x + dx, y: e.hunt.pos.y + dy, hp: 1e12, maxHp: 1e12, estados: {}, resist: {}, dots: [], armaduraPct: -100, evasao: 0 });

/** A maldição da gema `slug` (nível/qualidade) posta no monstro `b` como o buff dela a poria (`Reforcos.marcarCom`), sem a caçada. */
function amaldicoar(b, slug, { nivel = 20, qualidade = 0, agora = 1000 } = {}) {
  const r = G.doSlug(slug);
  const doPoe = G.buffNoNivel(slug, nivel, qualidade);
  const efeitos = Acoes.efeitosDaMaldicao(doPoe.efeitos, { nivel, qualidade }, null, Acoes.POR_ID_PUBLICO(r.acao));
  const hunt = { monstros: [b], clock: agora };
  Reforcos.marcarCom(hunt, b, [{ id: r.acao, def: { tipo: 'poe-maldicao', efeitos }, fator: 1, lancado: agora, emAura: false }], agora);
  return { hunt, id: r.acao, efeitos };
}
const bicho = (extra = {}) => ({ uid: 'm1', x: 0, y: 0, hp: 1000, maxHp: 1000, estados: {}, dots: [], raridade: 'normal', ...extra });

// ---------------------------------------------------------------- o status

test('G-A/G-C: as gemas do lote saem de parcial (as linhas do PoE têm leitor)', { skip: SEM }, () => {
  for (const s of ['Warlords_Mark', 'Assassins_Mark', 'Poachers_Mark', 'Despair', 'Enfeeble', 'Intimidating_Cry', 'Ancestral_Cry', 'Armageddon_Brand_of_Volatility', 'Storm_Brand_of_Indecision',
    'Temporal_Chains', 'Punishment', 'Snipers_Mark', 'Alchemists_Mark', 'Hexblast', 'Hexblast_of_Contradiction', 'Hexblast_of_Havoc', 'Bane', 'Bane_of_Condemnation']) {
    const r = G.REGISTRO.get(s);
    assert.equal(r.statusNoJogo, 'funciona', `${s}: ${JSON.stringify(r.motivosNoJogo)}`);
  }
  // o Sísmico fica só com o empurrão da "pequena Área" (o raio é decisão do dono)
  assert.deepEqual(G.REGISTRO.get('Seismic_Cry').motivosNoJogo.map((m) => m.replace(/^efeito não simulado: /, '')), ['200 % de aumento da Distância do Empurrão', 'Empurra e Interrompe Inimigos em uma pequena Área']);
  // a qualidade das guardas ("Duração do Efeito de Habilidades aumentada", "Efeito do Buff aumentado") saiu dos motivos
  for (const s of ['Molten_Shell', 'Vaal_Molten_Shell', 'Vaal_Immortal_Call', 'Old_Arctic_Armour', 'Vaal_Arctic_Armour', 'Arcane_Cloak']) {
    assert.ok(!G.REGISTRO.get(s).motivosNoJogo.some((m) => /Duração do Efeito de Habilidades aumentada|Efeito do Buff aumentado/.test(m)), s);
  }
});

test('G-C: a Detonação de Feitiços e a Ruína são magias de área com dano (D11, D13)', { skip: SEM }, () => {
  for (const s of ['Hexblast', 'Hexblast_of_Contradiction', 'Hexblast_of_Havoc', 'Bane', 'Bane_of_Condemnation']) {
    const r = G.REGISTRO.get(s);
    assert.equal(r.arquetipo, 'area', s);
    assert.ok(!r.buff, s);
  }
  assert.equal(G.areaNoNivel('Bane_of_Condemnation', 20).raioM, 1.2);
  assert.ok(perto(G.areaNoNivel('Hexblast', 20).raioM, 3.2));
  // a Ruína: 2 s de base (a da Condenação 1 s + 0,01 s por qualidade)
  assert.equal(G.degenerativoNoNivel('Bane', 20).duracaoMs, 2000);
  assert.equal(G.degenerativoNoNivel('Bane_of_Condemnation', 20, 20).duracaoMs, 1200);
});

// ---------------------------------------------------------------- as linhas e os números

test('G-A/G-C: os números das maldições no nível 20 (o PoB)', { skip: SEM }, () => {
  const por = (slug, q = 0) => Object.fromEntries(G.buffNoNivel(slug, 20, q).efeitos.filter((e) => e.efeito === 'marcaGac').map((e) => [e.tipo, e]));
  const tc = por('Temporal_Chains');
  assert.equal(tc.acao.pct, 29);
  assert.equal(tc.acao.pctRaro, 18);
  assert.equal(tc.expira.pct, 25);
  const pu = por('Punishment', 20);
  assert.equal(pu.vidaBaixa.pct, 58);
  assert.equal(pu.debilitar.ms, 3000);
  const sn = por('Snipers_Mark', 20);
  assert.equal(sn.projetil.pct, 34);
  assert.equal(sn.divisao.n, 2);
  assert.equal(por('Poachers_Mark').reducaoFisica.pct, 20);
  assert.equal(por('Enfeeble').precisao.pct, 19);
  assert.deepEqual(por('Warlords_Mark', 20).carga.cargas, { tolerancia: 5 });
  assert.deepEqual(por('Assassins_Mark', 20).carga.cargas, { poder: 5 });
  assert.deepEqual(por('Poachers_Mark', 20).carga.cargas, { frenesi: 5 });
  const al = por('Alchemists_Mark');
  assert.equal(al.alquimista.incendioPct, 26);
  assert.equal(al.alquimista.venenoPct, 79);
  assert.equal(al.frasco.n, 1);
  assert.equal(al.frasco.cadaMs, 3000);
});

test('G-A: a qualidade da maldição — o efeito (Desespero, Alquimista) e a duração (Enfraquecer, Corrente Temporal)', { skip: SEM }, () => {
  const ent = (s) => Acoes.POR_ID_PUBLICO(G.doSlug(s).acao);
  const vul = (s, q) => Acoes.efeitosDaMaldicao(G.buffNoNivel(s, 20, q).efeitos, { nivel: 20, qualidade: q }, null, ent(s)).find((e) => e.efeito === 'marcaVulneravel');
  assert.equal(vul('Despair', 0).pct, 30);
  assert.ok(perto(vul('Despair', 20).pct, 33));
  const enf = (q) => Acoes.efeitosDaMaldicao(G.buffNoNivel('Enfeeble', 20, q).efeitos, { nivel: 20, qualidade: q }, null, ent('Enfeeble')).find((e) => e.efeito === 'marcaEnfraquece');
  assert.equal(enf(20).durMarca, Math.round(enf(0).durMarca * 1.2));
  // a Alquimista: "Efeito da Marca aumentado em 10%" — os % dos solos × 1,1
  const al = Acoes.efeitosDaMaldicao(G.buffNoNivel('Alchemists_Mark', 20, 20).efeitos, { nivel: 20, qualidade: 20 }, null, ent('Alchemists_Mark')).find((e) => e.tipo === 'alquimista');
  assert.ok(perto(GAC.efeitoNoBicho(al).incendioPct, 26 * 1.1));
});

// ---------------------------------------------------------------- no amaldiçoado

test('G-C: a Corrente Temporal — a velocidade de ação (29% / 18% no Raro), separada do lento e do tolhido (D10)', { skip: SEM }, () => {
  const b = bicho();
  amaldicoar(b, 'Temporal_Chains');
  assert.ok(perto(GAC.fatorDeAcao(b, 1500), 1 / 0.71));
  const raro = bicho({ raridade: 'raro' });
  amaldicoar(raro, 'Temporal_Chains');
  assert.ok(perto(GAC.fatorDeAcao(raro, 1500), 1 / 0.82));
  // o lento e o tolhido não mudam
  assert.equal(Estados.fatorDeLentidao(b, 1500), 1);
  assert.equal(Estados.fatorDeTolhimento(b, 1500), 1);
  // sem a maldição, nada
  assert.equal(GAC.fatorDeAcao(bicho(), 1500), 1);
});

test('G-C: a Corrente Temporal — os outros efeitos expiram 25% mais devagar e o dano por segundo fica o mesmo (D10)', { skip: SEM }, () => {
  const b = bicho();
  amaldicoar(b, 'Temporal_Chains', { agora: 1000 });
  b.estados.cego = { ate: 5000 };
  b.dots = [{ tipo: 'queimadura', falta: 400, porPulso: 100, ate: 5000, proximo: 2000 }];
  GAC.expirarMaisDevagar(b, 1000);
  GAC.expirarMaisDevagar(b, 2000, () => 1000);
  // 1 s passou: o Cego ganhou 0,25 s, o Incêndio também e o que falta cresceu 0,25 s do pulso de 100/s
  assert.equal(b.estados.cego.ate, 5250);
  assert.equal(b.dots[0].ate, 5250);
  assert.ok(perto(b.dots[0].falta, 425));
  // a própria Corrente não se estende
  const tc = Object.values(b.maldicoes)[0];
  assert.equal(tc.ate, 1000 + G.buffNoNivel('Temporal_Chains', 20).dur);
});

test('G-C: a Punição — +58% de dano sofrido na Vida Baixa e o Debilitar em quem acerta você', { skip: SEM }, () => {
  const b = bicho();
  amaldicoar(b, 'Punishment', { qualidade: 20 });
  assert.equal(Reforcos.vulnerabilidade(b, 'fire', 1500), 1);
  b.hp = 500;
  assert.ok(perto(Reforcos.vulnerabilidade(b, 'fire', 1500), 1.58));
  assert.equal(GAC.debilitarAoAcertar(b, 1500), 3000);
  const hunt = { clock: 1500, pos: { x: 0, y: 0 } };
  ModsPoe.aoSerAcertado({ hunt }, hunt, b, { afPoe: {} }, { dano: 10, agora: 1500 });
  assert.equal(b.estados.debilitado.ate, 4500);
  // o Debilitado causa 10% menos dano (o do jogo)
  assert.ok(perto(ModsPoe.doBicho(b, 1600).danoFator, 0.9));
});

test('G-A: a Marca do Caçador — −20% de Redução de Dano Física somados à armadura (D4) e o Enfraquecer — −19% de Precisão', { skip: SEM }, () => {
  const b = bicho({ key: 'x' });
  const antes = Res.fracaoFisicaDoPoe({ clock: 1500 }, b, 100, null);
  amaldicoar(b, 'Poachers_Mark');
  // sem armadura nem redução: a redução fica −20% — o monstro sofre 20% mais
  assert.ok(perto(Res.fracaoFisicaDoPoe({ clock: 1500 }, b, 100, null), antes * 1.2));
  const c = bicho();
  amaldicoar(c, 'Enfeeble');
  assert.ok(perto(ModsPoe.doBicho(c, 1500).precisaoFator, 0.81));
});

test('G-A: as Marcas no acerto — as Cargas pela chance (a qualidade) e as Cargas de Frasco da Alquimista (uma vez a cada 3 s)', { skip: SEM }, () => {
  const b = bicho();
  const { hunt } = amaldicoar(b, 'Warlords_Mark', { qualidade: 20 });
  assert.deepEqual(GAC.noAcertoDoAmaldicoado(hunt, b, 1500, () => 0.01).cargas, ['tolerancia']);
  assert.deepEqual(GAC.noAcertoDoAmaldicoado(hunt, b, 1500, () => 0.06).cargas, []);
  const c = bicho();
  const h2 = amaldicoar(c, 'Alchemists_Mark').hunt;
  assert.equal(GAC.noAcertoDoAmaldicoado(h2, c, 1500).frascos, 1);
  assert.equal(GAC.noAcertoDoAmaldicoado(h2, c, 3000).frascos, 0);
  assert.equal(GAC.noAcertoDoAmaldicoado(h2, c, 4500).frascos, 1);
});

test('G-C: a Marca do Atirador — os acertos de projéteis no marcado e a divisão em 2', { skip: SEM }, () => {
  const b = bicho();
  amaldicoar(b, 'Snipers_Mark', { qualidade: 20 });
  assert.ok(perto(GAC.fatorDoProjetil(b, 1500), 1.34));
  assert.equal(GAC.divisaoDaMarca(b, 1500), 2);
  assert.equal(GAC.fatorDoProjetil(bicho(), 1500), 1);
});

test('G-C: a Marca do Alquimista — o acerto que Incendeia o marcado cria o Solo Ardente com 26% do dps do Incêndio (D12)', { skip: SEM }, () => {
  const b = bicho({ x: 5, y: 5, z: 0 });
  const { hunt } = amaldicoar(b, 'Alchemists_Mark');
  b.dots = [{ tipo: 'queimadura', falta: 1000, porPulso: 250, ate: 5500, proximo: 2500 }];
  assert.equal(Acoes.soloDaAlquimista(hunt, b, ['queimando'], 1500), 1);
  const solo = hunt.poeObjetos.find((o) => o.alquimista === 'ardente');
  assert.equal(solo.raio, 1);
  assert.ok(perto(solo.partes[0].porSegundo, (1000 / 4) * 0.26));
  // uma vez por segundo
  assert.equal(Acoes.soloDaAlquimista(hunt, b, ['queimando'], 2000), 0);
});

// ---------------------------------------------------------------- a Detonação de Feitiços (D11)

test('G-C: a Detonação de Feitiços — os números, a resistência do Caos e o Feitiço consumido', { skip: SEM }, () => {
  const d = G.detonacaoNoNivel('Hexblast', 20, 20);
  assert.equal(d.maisAcertoPct, 200);
  assert.equal(d.maisAfeccaoPct, 90);
  assert.equal(d.resistencia, 'menor');
  assert.equal(d.naoConsomePct, 10);
  const c = G.detonacaoNoNivel('Hexblast_of_Contradiction', 20);
  assert.equal(c.maisAcertoPct, 300);
  assert.equal(c.resistencia, 'maior');
  assert.equal(G.detonacaoNoNivel('Hexblast_of_Havoc', 20).consome, false);
  const res = { fire: 40, ice: 10, energy: 30, chaos: 20 };
  assert.equal(GAC.resistenciaDoCaos('menor', (t) => res[t]), 10);
  assert.equal(GAC.resistenciaDoCaos('maior', (t) => res[t]), 40);
  // o consumo: um Feitiço (não a Marca) que já estava antes; na chance de não consumir, fica
  const b = bicho({ maldicoes: { a: { ate: 9e9 }, m: { ate: 9e9, marca: true } } });
  assert.deepEqual(GAC.feiticosNoBicho(b, 0), ['a']);
  assert.equal(GAC.consumirFeitico(b, d, ['a'], 0, () => 0.05), null);
  assert.equal(GAC.consumirFeitico(b, d, ['a'], 0, () => 0.5), 'a');
  assert.ok(!b.maldicoes.a && b.maldicoes.m);
});

test('G-C: a Detonação de Feitiços no uso — +200% no Enfeitiçado, a área só com o alvo Enfeitiçado, e o Feitiço sai', { skip: SEM }, async () => {
  const { e, b, resto } = await montar('Hexblast');
  const v = outro(e, resto[0], 3, 0);
  const ev0 = usar(e, b).eventos;
  const sem = golpesEm(ev0, b);
  assert.equal(sem.length, 1);
  // o vizinho não leva: o alvo não estava Enfeitiçado
  assert.equal(golpesEm(ev0, v).length, 0);
  liberar(e, 5000);
  b.maldicoes = { feitico: { ate: e.hunt.clock + 60_000, efeitos: [] } };
  const ev = usar(e, b).eventos;
  const com = golpesEm(ev, b);
  assert.equal(com.length, 1);
  assert.ok(perto(com[0] / sem[0], 3, 0.02), `${com[0]} / ${sem[0]}`);
  // a área saiu: o vizinho levou (sem Feitiço, o dano dele é o normal)
  assert.equal(golpesEm(ev, v).length, 1);
  assert.ok(perto(golpesEm(ev, v)[0], sem[0], 0.02));
  // o Feitiço do alvo foi consumido
  assert.ok(!b.maldicoes.feitico);
});

// ---------------------------------------------------------------- a Ruína (D13)

test('G-C: a Ruína — os números do PoB e o dano/duração por maldição', { skip: SEM }, () => {
  const r = G.ruinaNoNivel('Bane', 20, 20);
  assert.equal(r.maisPorMaldicaoPct, 42);
  assert.equal(r.duracaoPorMaldicaoPct, 100);
  assert.equal(r.efeitoLigadasMaisPct, -25);
  assert.equal(r.efeitoLigadasPct, 20);
  assert.equal(r.nivelMax, 70);
  const x = GAC.ruinaComMaldicoes(r, 2);
  assert.ok(perto(x.fatorDano, 1.42 * 1.42));
  assert.equal(x.duracaoIncPct, 200);
  assert.equal(G.ruinaNoNivel('Bane_of_Condemnation', 20).maisPorMaldicaoPct, 100);
});

test('G-C: a Ruína no uso — aplica a maldição ligada (Desespero, com o −25% final) e o debuff com +42% e +100% de duração', { skip: SEM }, async () => {
  const { e, b } = await montar(['Bane', 'Despair']);
  usar(e, b);
  const desespero = b.maldicoes?.[G.doSlug('Despair').acao];
  assert.ok(desespero, JSON.stringify(Object.keys(b.maldicoes ?? {})));
  assert.ok(perto(desespero.efeitos.find((x) => x.tipo === 'vulneravel').pct, 30 * 0.75));
  const dot = b.dots.find((d) => d.chave === 'Bane');
  assert.ok(dot);
  // 2 s × (1 + 100%) = 4 s
  assert.equal(dot.ate - (e.hunt.clock), 4000);
  // a Ruína sozinha: 2 s e sem o "mais"
  const so = await montar('Bane');
  usar(so.e, so.b);
  const dot1 = so.b.dots.find((d) => d.chave === 'Bane');
  assert.equal(dot1.ate - so.e.hunt.clock, 2000);
  // o dps: × 1,42 (o total em 4 s é o dobro do tempo e 42% mais por segundo)
  assert.ok(perto(dot.falta / dot1.falta, 2 * 1.42, 0.02), `${dot.falta} / ${dot1.falta}`);
});

// ---------------------------------------------------------------- os clamores (D2)

test('G-A: o Impelir restrito — o Sísmico só nas Pancadas, o Ancestral só nos Golpes (e no golpe básico corpo a corpo)', { skip: SEM }, () => {
  assert.equal(G.impeleSoDaGema('Seismic_Cry'), 'pancada');
  assert.equal(G.impeleSoDaGema('Ancestral_Cry'), 'golpe');
  assert.equal(G.impeleSoDaGema('Intimidating_Cry'), null);
  assert.equal(G.alvosDoImpelidoDaGema('Ancestral_Cry', 20), 2);
  const sis = { n: 6, so: 'pancada' };
  assert.ok(GAC.impeleEste(sis, ['ataque', 'corpo', 'pancada', 'habilidade']));
  assert.ok(!GAC.impeleEste(sis, ['ataque', 'corpo', 'golpe', 'habilidade']));
  assert.ok(!GAC.impeleEste(sis, ['ataque', 'corpo', 'fisico']));
  const anc = { n: 8, so: 'golpe' };
  assert.ok(GAC.impeleEste(anc, ['ataque', 'corpo', 'golpe', 'habilidade']));
  assert.ok(GAC.impeleEste(anc, ['ataque', 'corpo', 'fisico']));
  assert.ok(!GAC.impeleEste(anc, ['ataque', 'corpo', 'pancada', 'habilidade']));
  assert.ok(GAC.impeleEste({ n: 2 }, ['ataque', 'projetil', 'habilidade']));
});

test('G-A: o Sísmico — o Ponto de Atordoamento por Poder e o "50% mais Área" do Impelido; o Intimidador intimida o provocado', { skip: SEM }, () => {
  assert.equal(G.clamorPeloPoder('Seismic_Cry', 20, 25).af.ponto_atordoamento_inc, 75);
  assert.equal(G.clamorPeloPoder('Seismic_Cry', 20, 0).af['area_mais@impelidoClamor'], 50);
  const prov = G.buffNoNivel('Intimidating_Cry', 20).efeitos.find((x) => x.efeito === 'provocar');
  assert.equal(prov.intimida, true);
  const m = { hp: 10, x: 1, y: 0, estados: {} };
  const hunt = { clock: 1000, pos: { x: 0, y: 0 }, monstros: [m] };
  Reforcos.provocar(hunt, { efeitos: [prov], dur: 3400 }, (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)));
  assert.equal(m.estados.intimidado.ate, 4400);
});

// ---------------------------------------------------------------- as Runas e as guardas

test('G-A: a Runa do Armagedom da Volatilidade não pode ser Convocada', { skip: SEM }, () => {
  assert.equal(Runas.daGema(G.textosDaGema('Armageddon_Brand_of_Volatility', 20).linhas).naoConvocavel, true);
  assert.ok(!Runas.daGema(G.textosDaGema('Armageddon_Brand', 20).linhas).naoConvocavel);
});

test('G-A: a qualidade das guardas — a duração do efeito e o efeito do buff', { skip: SEM }, () => {
  assert.deepEqual(G.qualidadeDoBuffDaGema('Molten_Shell', 20), { duracaoIncPct: 20, efeitoPct: 0 });
  assert.deepEqual(G.qualidadeDoBuffDaGema('Arcane_Cloak', 20), { duracaoIncPct: 0, efeitoPct: 20 });
});

test('G-A: a guarda com a qualidade dura 20% mais no uso', { skip: SEM }, async () => {
  const dur = async (q) => {
    const { e, b } = await montar('Molten_Shell', { qualidade: q });
    usar(e, b);
    const buff = e.hunt.buffs[G.doSlug('Molten_Shell').acao];
    return buff.ate - buff.desde;
  };
  const d0 = await dur(0);
  const d20 = await dur(20);
  assert.ok(perto(d20 / d0, 1.2, 0.01), `${d20} / ${d0}`);
});
