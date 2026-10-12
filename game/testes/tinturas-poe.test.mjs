// As TINTURAS do PoE (dono, 12/10: "pode seguir com a tintura" — o bloco "criar a Tintura") de ponta a ponta: o item (cai Normal, Mágica ou
// Única, sem qualidade, ids depois dos frascos), o cinto, ativar e desativar, a Queima de Mana (a mana que ela tira, a desativação com a mana
// acabando, a recarga), os mods "com Armas Corpo a Corpo", o automático, os únicos e os nós REAIS da árvore de cada linha (uma opção da
// Maestria de Tinturas por personagem, como no PoE).
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
const Comandos = await import('../systems/passivas/comandos.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const Frascos = await import('../systems/itens-poe/frascos.mjs');
const Tinturas = await import('../systems/itens-poe/tinturas.mjs');
const Moedas = await import('../systems/itens-poe/moedas.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const { ITEM_CATALOG } = await import('../systems/dados.mjs');

/** A peça do jogo de uma base do PoE (`raridade`; o único da base sai com 'unico'). */
const peca = (base, raridade = 'normal', rng = () => 0.5) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade, ilvl: 70, rng }));
/** Uma Duelista com um Machado Vaal (corpo a corpo) — ou `arma` — e as `pecas` no cinto, numa caçada do PoE, com 1000 de mana. */
function duelista(pecas = [], { arma = 'Two_Hand_Axes/Vaal_Axe' } = {}) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 70 });
  e.sistema = 'poe';
  e.classePoe = 'Duelist';
  e.equipment = { ...(e.equipment ?? {}), weapon: peca(arma) };
  e.inventory = [];
  for (const p of pecas) {
    e.inventory.push(p);
    assert.ok(Frascos.por(e, { pilha: e.inventory.length - 1 }).ok);
  }
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  e.actions = Array(Acoes.SLOTS).fill(null);
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.clock = 100_000;
  e.maxMana = e.mana = 1000;
  e.maxHp = e.hp = 1e6;
  P.garantir(e);
  const [b, ...outros] = e.hunt.monstros;
  for (const o of outros) Object.assign(o, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60 });
  Object.assign(b, { x: e.hunt.pos.x + 1, y: e.hunt.pos.y, hp: 1e9, maxHp: 1e9 });
  return e;
}
const tinturas = (e) => e.hunt.frascosPoe?.tinturas ?? {};
const af = (e) => { Ficha.invalidar(e); return Ficha.combate(e).afPoe; };
/** O valor de um atributo num ATAQUE (as tags do golpe). */
const noAtaque = (e, k) => { Ficha.invalidar(e); return ModsPoe.valor({ ...Ficha.combate(e), tagsDoGolpe: ['ataque', 'corpo'] }, k); };
/** Passa `ms` de caçada, um tique dos frascos a cada 250 ms (o automático só se `auto`). */
function passar(e, ms) {
  for (let t = 0; t < ms; t += 250) {
    e.hunt.clock += 250;
    Ficha.invalidar(e);
    Frascos.tique(e, [], 'Ana');
  }
}
/** Liga a Tintura da vaga `v` na mão (com a regra "só na tecla", para o automático não mexer). */
function ativarNaMao(e, v = 0) {
  Frascos.cinto(e)[v].poe.usarEmCombate = false;
  return Frascos.usar(e, v);
}

/** Aloca o nó (principal, maestria ou ascendência) com um efeito cuja chave casa `re`. */
function alocar(e, re) {
  const tem = (efs) => (efs ?? []).some((x) => re.test(x.add ?? ''));
  const arv = P.arvore();
  let no = arv.nos.find((n) => !n.ascendencia && n.tipo !== 'mastery' && tem(n.efeitos));
  let opcao = null;
  if (!no) for (const n of arv.nos.filter((x) => x.tipo === 'mastery' && !x.ascendencia)) { const o = (n.opcoes ?? []).find((x) => tem(x.efeitos)); if (o) { no = n; opcao = o.id; break; } }
  if (!no) {
    no = arv.nos.find((n) => n.ascendencia && tem(n.efeitos));
    assert.ok(no, `há nó com ${re}`);
    e.classePoe = arv.ascendencias[no.ascendencia].classe;
    P.garantir(e);
    e.passivas.ascendencia = no.ascendencia;
    Comandos.depoisDeMudar(e);
    assert.ok(Comandos.comando(e, { action: 'alocar', ids: P.caminhoAte(e, no.id) }).ok);
    Ficha.invalidar(e);
    return;
  }
  const ate = no.tipo === 'mastery' ? arv.nos.find((n) => n.tipo === 'notable' && n.grupo === no.grupo && !n.ascendencia).id : no.id;
  const caminho = P.caminhoAte(e, ate);
  const antes = no.tipo === 'mastery' ? caminho : caminho.slice(0, -1);
  if (antes.length) assert.equal(Comandos.comando(e, { action: 'alocar', ids: antes }).feitos, antes.length);
  assert.ok(Comandos.comando(e, { action: 'alocar', id: no.id, ...(opcao ? { opcao } : {}) }).ok);
  Ficha.invalidar(e);
}

test('o ITEM: as 10 bases entram no jogo DEPOIS dos frascos (nenhum id existente muda), no cinto, sem Raro nem qualidade; o balão com a Queima de Mana e a recarga', { skip: SEM }, () => {
  const ids = Catalogo.catalogo().classes.Tinctures.bases.map((b) => J.idDaBase(b.id));
  assert.equal(ids.filter(Boolean).length, 10);
  const outros = [...J.registro().porBase.entries()].filter(([b]) => !b.startsWith('Tinctures/')).map(([, id]) => id);
  assert.ok(Math.min(...ids) > Math.max(...outros), 'os ids das Tinturas vêm depois de todas as bases que já existiam');
  assert.equal(ITEM_CATALOG[ids[0]].frasco, true);
  assert.equal(ITEM_CATALOG[ids[0]].tintura, true);
  // (o drop: o Raro sorteado vira Mágico, como no frasco; e nada de qualidade)
  let semente = 7;
  const rng = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 300; i++) {
    const p = J.pecaSorteada(70, rng, Catalogo.REGRAS, 0, 'Tinctures/Ashbark_Tincture');
    if (!p) continue;
    assert.notEqual(p.poe.raridade, 'raro');
    assert.ok(!(p.poe.qualidade > 0), 'Tintura sem qualidade');
  }
  const t = peca('Tinctures/Ashbark_Tincture');
  assert.deepEqual(t.poe.frasco, { tipo: 'tintura', queimaCadaS: 0.6, recargaS: 7, efeitoPct: 0, semPeriodica: false, queimasAoAcertar: 0 });
  assert.deepEqual(t.poe.estados, ['equivalente'], 'as duas partes do implícito agem');
  const e = duelista([t]);
  assert.equal(Frascos.cinto(e)[0].poe.base, 'Tinctures/Ashbark_Tincture');
  // (a Bolha do Vidreiro não vale na Tintura — a qualidade do frasco não tem o que fazer nela)
  const bolha = Moedas.idDa('Glassblowers_Bauble');
  e.inventory.push(peca('Tinctures/Prismatic_Tincture'), { id: bolha, count: 1 });
  const r = Moedas.usar(e, { moeda: bolha, alvo: { onde: 'inventory', indice: e.inventory.length - 2 } });
  assert.equal(r.ok, false, r.notice);
  assert.match(r.erro, /vale em frasco/);
});

test('ATIVAR: a Queima de Mana a cada 0,6 s (1% da Mana máxima por segundo cada); a mana ACABA: desativa, a Queima sai e começa a recarga de 7 s', { skip: SEM }, () => {
  const e = duelista([peca('Tinctures/Ashbark_Tincture')]);
  assert.equal(noAtaque(e, 'chance_ignite'), 0);
  assert.ok(ativarNaMao(e));
  assert.equal(noAtaque(e, 'chance_ignite'), 25, 'o implícito vale nos ataques');
  assert.ok(noAtaque(e, 'ignite_dmg_inc') >= 60);
  passar(e, 3000);
  assert.equal(tinturas(e)[0].queimas, 5, '3 s ÷ 0,6 s');
  const antes = e.mana;
  passar(e, 250);
  assert.ok(Math.abs(antes - e.mana - 1000 * 0.05 * 0.25) < 1e-6, '5 Queimas: 5% da mana por segundo');
  e.mana = 1;
  passar(e, 500);
  assert.equal(tinturas(e)[0].ativa, false);
  assert.equal(tinturas(e)[0].recargaAte, e.hunt.clock - 250 + 7000);
  assert.equal(noAtaque(e, 'chance_ignite'), 0, 'desativada: sem o efeito');
  e.mana = 1000;
  assert.equal(Frascos.usar(e, 0), false, 'na recarga, não ativa');
  passar(e, 7000);
  assert.ok(Frascos.usar(e, 0), 'pronta de novo');
  assert.equal(tinturas(e)[0].queimas, 0, 'a Queima de Mana começa do zero');
  assert.ok(Frascos.usar(e, 0), 'usar de novo desativa');
  assert.equal(tinturas(e)[0].ativa, false);
});

test('"com Armas Corpo a Corpo": com Arco, o efeito não vale; e só 1 Tintura ativa por vez', { skip: SEM }, () => {
  const e = duelista([peca('Tinctures/Ashbark_Tincture')], { arma: 'Bows/Crude_Bow' });
  assert.ok(ativarNaMao(e));
  assert.equal(noAtaque(e, 'chance_ignite'), 0, 'o Arco não é Arma Corpo a Corpo');
  const d = duelista([peca('Tinctures/Ashbark_Tincture'), peca('Tinctures/Prismatic_Tincture')]);
  assert.ok(ativarNaMao(d, 0));
  assert.equal(ativarNaMao(d, 1), false, 'a segunda não ativa');
});

test('o AUTOMÁTICO: ativa em combate; desativa sem monstro vivo e com a mana abaixo da regra (30%); "só na tecla" não mexe', { skip: SEM }, () => {
  const e = duelista([peca('Tinctures/Ashbark_Tincture')]);
  passar(e, 250);
  assert.equal(tinturas(e)[0].ativa, true);
  e.mana = 299;
  passar(e, 250);
  assert.equal(tinturas(e)[0].ativa, false, 'mana abaixo de 30%');
  const s = duelista([peca('Tinctures/Ashbark_Tincture')]);
  passar(s, 250);
  for (const m of s.hunt.monstros) m.hp = 0;
  passar(s, 250);
  assert.equal(tinturas(s)[0].ativa, false, 'sem combate');
  const m = duelista([peca('Tinctures/Ashbark_Tincture')]);
  assert.ok(Frascos.configurar(m, { vaga: 0, emCombate: false }).ok);
  passar(m, 1000);
  assert.equal(tinturas(m)[0], undefined);
  assert.ok(Frascos.configurar(m, { vaga: 0, emCombate: true, abaixoPct: 0 }).ok);
  passar(m, 250);
  m.mana = 100;
  passar(m, 250);
  assert.equal(tinturas(m)[0].ativa, true, 'com 0%, só quando a mana acabar');
  const c = Frascos.paraCliente(m)[0];
  assert.deepEqual([c.tipo, c.ativa, c.regra.abaixoPct, c.regra.emCombate], ['tintura', true, 0, true]);
  assert.deepEqual(Frascos.buffs(m).map((b) => b.tintura?.queimas), [tinturas(m)[0].queimas]);
});

test('os ÚNICOS: A Batalha Interna (sem a Queima periódica, 1 ao Acertar, Raridade por Queima); Ceiva das Estações (Penetração por Queima); A Lâmina Viva (+1 ativa, tira Queima ao Matar)', { skip: SEM }, () => {
  const batalha = peca('Tinctures/Oakbranch_Tincture', 'unico');
  assert.equal(batalha.poe.nome, 'A Batalha Interna');
  const e = duelista([batalha]);
  assert.ok(ativarNaMao(e));
  passar(e, 3000);
  assert.equal(tinturas(e)[0].queimas, 0, '"Não inflige Queima de Mana degenerativa"');
  e.hunt.tinturaAcertos = 4;
  passar(e, 250);
  assert.equal(tinturas(e)[0].queimas, 4, '1 a cada acerto');
  const porQueima = batalha.poe.modificadores.find((m) => /Raridade/.test(m.texto)).valores[0];
  assert.equal(af(e).item_rarity, Math.min(100, porQueima * 4));
  const ceiva = peca('Tinctures/Prismatic_Tincture', 'unico');
  assert.equal(ceiva.poe.nome, 'Ceiva das Estações');
  const c = duelista([ceiva]);
  assert.ok(ativarNaMao(c));
  passar(c, 1400);
  assert.equal(noAtaque(c, 'elem_pen'), tinturas(c)[0].queimas, '1% por Queima de Mana');
  const v = duelista([peca('Tinctures/Ashbark_Tincture'), peca('Tinctures/Prismatic_Tincture')]);
  v.equipment.weapon.poe.af = { ...(v.equipment.weapon.poe.af ?? {}), tintura_ativas_extra: 1, tintura_remover_queima_chance: 100, tintura_remover_queima_n: 1 };
  Ficha.invalidar(v);
  assert.ok(ativarNaMao(v, 0));
  assert.ok(ativarNaMao(v, 1), '"Você pode ter uma Tintura adicional ativa"');
  passar(v, 1200);
  const antes = Tinturas.queimasEmVoce(v.hunt.frascosPoe);
  Frascos.aoMatar(v, 'normal', null);
  assert.equal(Tinturas.queimasEmVoce(v.hunt.frascosPoe), antes - 1);
});

test('a ÁRVORE (1): Efeito +10%, Queima de Mana reduzida 5%, Recuperação da Recarga +25%, 15% de mana ao ativar, Mana ao Matar com Tintura', { skip: SEM }, () => {
  const efeito = duelista([peca('Tinctures/Ashbark_Tincture')]);
  alocar(efeito, /^tintura_efeito_inc$/);
  assert.ok(ativarNaMao(efeito));
  passar(efeito, 250);
  assert.ok(Math.abs(noAtaque(efeito, 'chance_ignite') - 25 * (1 + af(efeito).tintura_efeito_inc / 100)) < 0.01);
  const queima = duelista([peca('Tinctures/Ashbark_Tincture')]);
  alocar(queima, /^tintura_queima_inc$/);
  assert.equal(Tinturas.parametros(Frascos.cinto(queima)[0], af(queima)).intervaloMs, Math.round(600 / 0.95));
  const recarga = duelista([peca('Tinctures/Ashbark_Tincture')]);
  alocar(recarga, /^tintura_recarga_inc$/);
  assert.equal(Tinturas.parametros(Frascos.cinto(recarga)[0], af(recarga)).recargaMs, Math.round(7000 / 1.25));
  const mana = duelista([peca('Tinctures/Ashbark_Tincture')]);
  alocar(mana, /^tintura_mana_ativar_pct$/);
  mana.mana = 500;
  assert.ok(ativarNaMao(mana));
  assert.ok(Math.abs(mana.mana - (500 + mana.maxMana * 0.15)) < 1e-9, '15% da Mana máxima');
  const matar = duelista([peca('Tinctures/Ashbark_Tincture')]);
  alocar(matar, /^mana_ao_matar_pct@tinturaAtiva$/);
  assert.equal(af(matar).mana_ao_matar_pct ?? 0, 0);
  assert.ok(ativarNaMao(matar));
  assert.equal(af(matar).mana_ao_matar_pct, 1, 'com uma Tintura ativa');
});

test('a ÁRVORE (2), uma opção da Maestria de Tinturas por personagem: as 6 primeiras Queimas sem efeito, Evasão +30% com Tintura ativa, Cargas por Queima, o frasco ao lado +10%, desativa com 12', { skip: SEM }, () => {
  const gratis = duelista([peca('Tinctures/Ashbark_Tincture')]);
  alocar(gratis, /^tintura_queimas_gratis$/);
  assert.ok(ativarNaMao(gratis));
  // (o tique põe as Queimas pelo intervalo — aqui, o número fica fixo para medir só a mana)
  const st = gratis.hunt.frascosPoe;
  const medir = (q) => { st.tinturas[0].queimas = q; st.tinturas[0].proxima = Infinity; const antes = gratis.mana; passar(gratis, 1000); return antes - gratis.mana; };
  assert.equal(medir(6), 0, '6 Queimas: nenhuma tira mana');
  assert.ok(Math.abs(medir(7) - gratis.maxMana * 0.01) < 1e-6, 'a 7ª tira 1% por segundo');
  const evasao = duelista([peca('Tinctures/Ashbark_Tincture')]);
  alocar(evasao, /^evasion_pct@tinturaAtiva$/);
  const sem = af(evasao).evasion_pct ?? 0;
  assert.ok(ativarNaMao(evasao));
  assert.equal(af(evasao).evasion_pct, sem + 30);
  const cargas = duelista([peca('Tinctures/Ashbark_Tincture')]);
  alocar(cargas, /^frasco_cargas_por_queima$/);
  assert.ok(ativarNaMao(cargas));
  passar(cargas, 1800);
  assert.equal(af(cargas).frasco_cargas_recebidas, tinturas(cargas)[0].queimas);
  const lado = duelista([peca('Tinctures/Ashbark_Tincture'), peca('Utility_Flasks/Ruby_Flask')]);
  alocar(lado, /^tintura_frasco_adjacente_efeito$/);
  assert.ok(ativarNaMao(lado));
  ModsPoe.marcar(lado.hunt, 'acertou');
  assert.ok(Frascos.usar(lado, 1));
  const rubi = Frascos.parametros(Frascos.cinto(lado)[1], af(lado)).af;
  for (const [k, v] of Object.entries(rubi)) assert.ok(Math.abs(lado.hunt.frascosPoe.ativos[1].af[k] - v * 1.1) < 0.02, `${k}: +10% de Efeito`);
  const teto = duelista([peca('Tinctures/Ashbark_Tincture')]);
  alocar(teto, /^tintura_desativa_queimas$/);
  assert.ok(ativarNaMao(teto));
  const intervalo = Tinturas.parametros(Frascos.cinto(teto)[0], af(teto)).intervaloMs;
  passar(teto, 11 * intervalo + 100);
  assert.equal(tinturas(teto)[0].queimas, 11);
  assert.equal(tinturas(teto)[0].ativa, true, 'com 11, segue');
  passar(teto, intervalo);
  assert.equal(tinturas(teto)[0].ativa, false, 'desativou com 12 Queimas');
});

test('a ÁRVORE (3): Composto da Natureza (2 cargas nos frascos ao lado ao Acertar, 1 vez por segundo), Mistura Coloidal (Frasco de Vida recente), Fórmula Aperfeiçoada, Lâmina Ensanguentada', { skip: SEM }, () => {
  const comp = duelista([peca('Life_Flasks/Small_Life_Flask'), peca('Tinctures/Ashbark_Tincture'), peca('Utility_Flasks/Ruby_Flask')]);
  alocar(comp, /^tintura_cargas_adjacentes$/);
  assert.ok(ativarNaMao(comp, 1));
  passar(comp, 250);
  for (const v of [0, 2]) Frascos.cinto(comp)[v].poe.cargas = 0;
  comp.hunt.tinturaAcertos = 3;
  passar(comp, 250);
  comp.hunt.tinturaAcertos = 3;
  passar(comp, 250);
  assert.deepEqual([0, 2].map((v) => Frascos.cinto(comp)[v].poe.cargas), [2, 2], '2 cargas, uma vez por segundo');
  const mist = duelista([peca('Tinctures/Ashbark_Tincture'), peca('Life_Flasks/Small_Life_Flask')]);
  alocar(mist, /^tintura_efeito_inc@usouFrascoVidaRecente$/);
  const base = af(mist).tintura_efeito_inc ?? 0;
  mist.hp = 1;
  assert.ok(Frascos.usar(mist, 1));
  assert.equal(af(mist).tintura_efeito_inc, base + 15, 'usou o Frasco de Vida');
  const formula = duelista([peca('Tinctures/Ashbark_Tincture')]);
  alocar(formula, /^tintura_sem_queima_chance$/);
  assert.equal(af(formula).tintura_sem_queima_chance, 15);
  const st = { tinturas: {} };
  const t = Frascos.cinto(formula)[0];
  assert.ok(Tinturas.ativar(formula, st, 0, t, { tintura_sem_queima_chance: 100 }, 0));
  Tinturas.tique(formula, st, [t], { tintura_sem_queima_chance: 100 }, 6000);
  assert.equal(st.tinturas[0].queimas, 0, 'com 100%, nenhuma');
  const lamina = duelista([peca('Tinctures/Ashbark_Tincture')]);
  alocar(lamina, /^tintura_ferimentos$/);
  lamina.maxHp = lamina.hp = 1000;
  assert.ok(ativarNaMao(lamina));
  passar(lamina, 3000);
  const vida = lamina.hp;
  const mana = lamina.mana;
  passar(lamina, 250);
  assert.ok(lamina.hp < vida, 'Ferimentos Abertos tiram vida');
  assert.equal(lamina.mana, mana, 'e não mana');
  lamina.hp = 2;
  passar(lamina, 2000);
  assert.equal(lamina.hp, 1);
  assert.equal(tinturas(lamina)[0].ativa, false, 'desativa com 1 de vida');
});

test('a ÁRVORE (4), a Caçadora: +1 Tintura ativa; também nas Armas à Distância; o efeito Perdura 0,5 s por Queima (e 30% menos Queima de Mana)', { skip: SEM }, () => {
  const duas = duelista([peca('Tinctures/Ashbark_Tincture'), peca('Tinctures/Prismatic_Tincture')]);
  alocar(duas, /^tintura_ativas_extra$/);
  assert.ok(ativarNaMao(duas, 0));
  assert.ok(ativarNaMao(duas, 1));
  const arco = duelista([peca('Tinctures/Ashbark_Tincture')], { arma: 'Bows/Crude_Bow' });
  alocar(arco, /^tintura_distancia$/);
  assert.ok(ativarNaMao(arco));
  passar(arco, 250);
  // (o caminho até a Caçadora passa pelo "Efeito de Tinturas" dela)
  const comEfeito = (e) => 25 * (1 + (af(e).tintura_efeito_inc ?? 0) / 100);
  assert.ok(Math.abs(noAtaque(arco, 'chance_ignite') - comEfeito(arco)) < 0.01, 'com o Arco também');
  const perdura = duelista([peca('Tinctures/Ashbark_Tincture')]);
  alocar(perdura, /^tintura_perdura$/);
  const a = af(perdura);
  assert.equal(a.tintura_queima_menos, 30);
  assert.equal(Tinturas.parametros(Frascos.cinto(perdura)[0], a).intervaloMs, Math.round(600 / 0.7));
  assert.ok(ativarNaMao(perdura));
  const intervalo = Tinturas.parametros(Frascos.cinto(perdura)[0], af(perdura)).intervaloMs;
  passar(perdura, 3 * intervalo + 100);
  const q = tinturas(perdura)[0].queimas;
  assert.ok(q >= 3, `${q}`);
  assert.ok(Frascos.usar(perdura, 0));
  assert.ok(Math.abs(noAtaque(perdura, 'chance_ignite') - comEfeito(perdura)) < 0.01, 'perdura');
  passar(perdura, q * 500);
  assert.equal(noAtaque(perdura, 'chance_ignite'), 0, 'acabou depois de 0,5 s por Queima');
});

test('a ÁRVORE: as 58 linhas de Tintura têm efeito no balão', { skip: SEM }, () => {
  const linhas = P.arvore().nos.flatMap((n) => [n, ...(n.opcoes ?? [])].flatMap((o) => (o.textos ?? []).map((t, i) => ({ t, estado: o.estados?.[i] }))));
  const achadas = linhas.filter((l) => /Tintura|Queimas? de Mana|Ferimentos Abertos/.test(l.t) && !/^\(/.test(l.t));
  assert.ok(achadas.length >= 58, `${achadas.length}`);
  for (const l of achadas) assert.ok(['equivalente', 'novo', 'aproximado'].includes(l.estado), `${l.t}: ${l.estado}`);
});
