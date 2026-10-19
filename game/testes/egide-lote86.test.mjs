// A ÉGIDE NECROMÂNTICA — LOTE 86 (dono, 19/10: "Fazer tudo do PoE"; a parte A): "Todos os bônus do Escudo equipado se aplicam aos seus Lacaios e
// não a você" com o que faltava — A1 o máximo de UMA resistência do escudo no lacaio (e o Caos que não sobe com o "todas as Elementais"); A2 os
// efeitos "ao Bloquear" do escudo (Causticar, Intimidar, a vida) e o "se Bloqueou Recentemente" (a armadura, 4 s) no lacaio que bloqueou; A3 o
// "+N ao Nível de todas as Gemas de …" do escudo, que deixa de ser seu (como no PoB), e o das gemas encaixadas NO escudo, que fica.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');
await import('../systems/acoes.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Gemas = await import('../systems/skills/gemas.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const Comandos = await import('../systems/passivas/comandos.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const LacaiosPoe = await import('../systems/itens-poe/lacaios-poe.mjs');
const Terreno = await import('../systems/hunt/terreno.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
}

const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 70, rng: () => 0.5 }));
/** Uma Bruxa com uma Varinha e um Escudo de Torre Cedro (com `afEscudo`), e a Égide Necromântica alocada (`egide`). */
function personagem({ afEscudo = {}, egide = true } = {}) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'sorcerer', level: 80 }), { sistema: 'poe', classePoe: 'Witch' });
  const escudo = peca('Shields/Cedar_Tower_Shield');
  escudo.poe.af = { ...(escudo.poe.af ?? {}), ...afEscudo };
  e.equipment = { ...(e.equipment ?? {}), weapon: peca('Wands/Driftwood_Wand'), shield: escudo };
  P.garantir(e);
  if (egide) {
    const no = P.arvore().nos.find((n) => !n.ascendencia && (n.efeitos ?? []).some((x) => /^egide_necromantica$/.test(x.add ?? '')));
    const caminho = P.caminhoAte(e, no.id);
    if (caminho.length > 1) Comandos.comando(e, { action: 'alocar', ids: caminho.slice(0, -1) });
    assert.ok(Comandos.comando(e, { action: 'alocar', id: no.id }).ok);
  }
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  return e;
}
const af = (e) => { Ficha.invalidar(e); return Ficha.combate(e).afPoe; };
const zumbi = (a) => LacaiosPoe.oQueInvoca('Raise_Zombie', 10, null, a);

test('A1 — a máxima de Fogo do escudo sobe só o teto do Fogo do lacaio; a de Caos, só o do Caos; e sai de você', { skip: SEM }, () => {
  const e = personagem({ afEscudo: { fire_res_max: 3, chaos_res_max: 4 } });
  const sem = personagem({});
  const a = af(e);
  assert.equal(a.minion_fire_res_max, 3);
  assert.equal(a.minion_chaos_res_max, 4);
  assert.equal((a.fire_res_max ?? 0) - (af(sem).fire_res_max ?? 0), 0, 'a máxima de Fogo do escudo não é sua');
  const l = { poe: zumbi(a).poe };
  assert.equal(LacaiosPoe.tetoDaResDoLacaio(l, 'fire'), 78);
  assert.equal(LacaiosPoe.tetoDaResDoLacaio(l, 'ice'), 75);
  assert.equal(LacaiosPoe.tetoDaResDoLacaio(l, 'energy'), 75);
  assert.equal(LacaiosPoe.tetoDaResDoLacaio(l, 'chaos'), 79);
  assert.equal(LacaiosPoe.tetoDaResDoLacaio(l), 78, 'sem elemento: o de Fogo (a chamada antiga)');
});

test('A1 — o "+X% a todas as máximas Elementais" do escudo (as três chaves) sobe os três tetos elementais e NÃO o do Caos; o minion_res_max também não', { skip: SEM }, () => {
  const e = personagem({ afEscudo: { fire_res_max: 2, ice_res_max: 2, energy_res_max: 2 } });
  const l = { poe: zumbi(af(e)).poe };
  for (const el of ['fire', 'ice', 'energy']) assert.equal(LacaiosPoe.tetoDaResDoLacaio(l, el), 77, el);
  assert.equal(LacaiosPoe.tetoDaResDoLacaio(l, 'chaos'), 75);
  // (a correção do Caos vale para todo lacaio: "Lacaios têm +X% ao máximo de todas as Resistências Elementais")
  const q = { poe: zumbi({ minion_res_max: 5 }).poe };
  assert.equal(LacaiosPoe.tetoDaResDoLacaio(q, 'ice'), 80);
  assert.equal(LacaiosPoe.tetoDaResDoLacaio(q, 'chaos'), 75);
  assert.equal(LacaiosPoe.tetoDaResDoLacaio({ poe: { resMax: 30 } }, 'fire'), 90, 'o teto de 90');
});

test('A2 — o lacaio bloqueia: Causticar e Intimidar no bicho, a vida ao bloquear; os eventos do escudo saem de você', { skip: SEM }, () => {
  const e = personagem({ afEscudo: { bloqueio_causticar: 1, 'ev:bloquear:alvo:intimidado:600': 100, 'ev:bloquear:vida': 50 } });
  const a = af(e);
  assert.equal(a.minion_bloqueio_causticar, 1);
  assert.equal(a['minion_ev:bloquear:alvo:intimidado:600'], 100);
  assert.ok(!(a.bloqueio_causticar > 0), 'o Causticar ao bloquear não é seu');
  Ficha.invalidar(e);
  assert.ok(!(Ficha.combate(e).eventosPoe ?? []).some((x) => x.evento === 'bloquear'), 'nem os eventos de bloqueio');
  const q = zumbi(a);
  assert.ok(q.poe.bloqueio > 0, 'o bloqueio do escudo no lacaio');
  const agora = 10_000;
  const bicho = { uid: 'b1', name: 'Bicho', x: 1, y: 0, hp: 100, maxHp: 100 };
  const hunt = { clock: agora, monstros: [bicho] };
  const l = { uid: 'l1', x: 0, y: 0, hp: 50, maxHp: 1000, poe: q.poe };
  const eventos = [];
  assert.equal(Cacadas.lacaioBloqueia(l, null, eventos, () => 0, null, 0, { hunt, bicho, agora }), true);
  assert.ok(bicho.estados?.causticado?.ate > agora, 'Causticado');
  assert.equal(bicho.estados?.intimidado?.ate, agora + 600_000, 'Intimidado (o "permanente" do PoE: 600 s)');
  assert.equal(l.hp, 100, '+50 de vida ao bloquear');
  assert.equal(l.bloqueouEm, agora);
  // (sem a Égide, o lacaio não recebe nada disso)
  const sem = zumbi(af(personagem({ afEscudo: { bloqueio_causticar: 1 }, egide: false })));
  assert.equal(sem.poe.aoBloquear.causticar, 0);
});

test('A2 — a armadura "se Bloqueou Recentemente" do escudo vale no lacaio só nos 4 s depois do bloqueio; o bloqueio Sortudo rola duas vezes', { skip: SEM }, () => {
  const e = personagem({ afEscudo: { 'armor_flat@bloqueouRecente': 500, 'bloqueio_sortudo@bloqueouRecente': 1 } });
  const a = af(e);
  assert.equal(a['minion_se_bloqueou:armor_flat'], 500);
  assert.ok(!(a.armor_flat > (af(personagem({})).armor_flat ?? 0)), 'a armadura não é sua');
  const p = zumbi(a).poe;
  assert.equal(p.seBloqueou.armadura, 500);
  const golpe = (agora) => LacaiosPoe.danoNoLacaio({ hp: 1000, maxHp: 1000, bloqueouEm: 10_000, poe: p }, { fisico: 100, agora, rng: () => 0.99 }).dano;
  const esperado = (arm) => 100 * (1 - Math.min(90, (p.reducaoFisica ?? 0) + (arm > 0 ? (100 * arm) / (arm + 500) : 0)) / 100);
  assert.ok(Math.abs(golpe(13_000) - esperado(p.armadura + 500)) < 1e-9, 'dentro dos 4 s: + 500 de armadura');
  assert.ok(Math.abs(golpe(15_000) - esperado(p.armadura)) < 1e-9, 'depois dos 4 s: sem ela');
  assert.ok(golpe(13_000) < golpe(15_000));
  // o Sortudo: 30% de bloqueio, a 1ª jogada erra (0,5) e a 2ª acerta (0,1) — só se bloqueou nos últimos 4 s
  const rolagens = () => { const xs = [0.5, 0.1]; return () => xs.shift() ?? 0.99; };
  const l = { uid: 'l', x: 0, y: 0, hp: 10, maxHp: 10, bloqueouEm: 10_000, poe: { bloqueio: 30, seBloqueou: { sortudo: 1 } } };
  assert.equal(Cacadas.lacaioBloqueia(l, null, [], rolagens(), null, 0, { agora: 12_000 }), true);
  assert.equal(Cacadas.lacaioBloqueia({ ...l }, null, [], rolagens(), null, 0, { agora: 20_000 }), false);
});

test('A3 — o "+1 às Gemas" do escudo não sobe a sua gema com a Égide; sem a Égide sobe; o gem_level_local encaixado no escudo sobe', { skip: SEM }, () => {
  const fogo = { tipo: 'ativa', tags: ['poe:Magia', 'poe:Fogo', 'poe:Projétil'] };
  const afEscudo = { 'gem_level@magia+fogo': 1, gem_level_local: 2 };
  const com = personagem({ afEscudo });
  const sem = personagem({ afEscudo, egide: false });
  assert.equal(Gemas.extrasDaGemaPoe(com, com.equipment.weapon, fogo).nivel, 0, 'com a Égide: o do escudo vai aos lacaios');
  assert.equal(Gemas.extrasDaGemaPoe(sem, sem.equipment.weapon, fogo).nivel, 1, 'sem a Égide: é seu');
  assert.equal(Gemas.extrasDaGemaPoe(com, com.equipment.shield, fogo).nivel, 2, 'com a Égide: o das gemas encaixadas no escudo fica');
  assert.equal(Gemas.extrasDaGemaPoe(sem, sem.equipment.shield, fogo).nivel, 3);
});

// ---- a correção do lote 86 (a revisão, 19/10): o relógio da caçada, o Sortudo na magia, o Svalinn, o "se (não) Bloqueou Recentemente" no
// bloqueio e no crítico, o escudo de energia pela armadura, o Fogo adicional escalado como o golpe

/** Roda `fn` com o Math.random fixo em `v` (o golpe do bicho no lacaio e o bloqueio dele saem sempre). */
function comRandom(v, fn) {
  const r = Math.random;
  Math.random = () => v;
  try { return fn(); } finally { Math.random = r; }
}
/** A caçada com o relógio LÓGICO longe do de parede (`hunt.clock` = 100 s; o tique recebe `Date.now()`), um bicho colado no lacaio `l`. */
function naCacada(e, poe) {
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  const h = e.hunt;
  h.clock = 100_000;
  Object.assign(e, { hp: 1e6, maxHp: 1e6 });
  const [b, ...outros] = h.monstros;
  for (const o of outros) Object.assign(o, { x: h.pos.x + 60, y: h.pos.y + 60 });
  const l = { uid: 'l1', tipo: 'lacaio', nome: 'Zumbi', x: h.pos.x + 2, y: h.pos.y, hp: 1e6, maxHp: 1e6, nivel: 10, proximoGolpe: Infinity, poe };
  Object.assign(b, { x: l.x + 1, y: l.y, hp: 1e9, maxHp: 1e9, estados: {} });
  h.lacaios = [l];
  return { h, b, l };
}
const sequencia = (...xs) => () => xs.shift() ?? 0.99;

test('correção — o bloqueio do lacaio no TIQUE usa o relógio da caçada: o Causticado expira por ele, e o "se Bloqueou Recentemente" vale 4 s dele', { skip: SEM }, () => {
  const e = personagem({ afEscudo: { bloqueio_causticar: 1, 'armor_flat@bloqueouRecente': 500 } });
  const poe = zumbi(af(e)).poe;
  const { h, b, l } = naCacada(e, poe);
  const parede = Date.now();
  assert.ok(Math.abs(parede - h.clock) > 1e6, 'os dois relógios são bem diferentes');
  comRandom(0.001, () => Cacadas.tiqueDosLacaios(e, h, null, Cacadas.andarDaGrade(Cacadas.gradeDaHunt(Terreno.huntOuMapaCustom(h.huntId)), h.z), parede));
  assert.equal(l.bloqueouEm, h.clock, 'o bloqueio marcado no relógio da caçada');
  assert.equal(b.estados.causticado?.ate, h.clock + 4000, 'o Causticado vai até o relógio da caçada + 4 s');
  assert.equal(LacaiosPoe.armaduraDoLacaio(l, h.clock + 3999), poe.armadura + 500);
  assert.equal(LacaiosPoe.armaduraDoLacaio(l, h.clock + 4001), poe.armadura);
  assert.equal(LacaiosPoe.armaduraDoLacaio(l, parede), poe.armadura, 'pelo relógio de parede, não');
});

test('correção — a MAGIA no lacaio: o bloqueio mágico marca o relógio da caçada e Caustica até ele + 4 s', { skip: SEM }, () => {
  const e = personagem({ afEscudo: { bloqueio_causticar: 1 } });
  const poe = { ...zumbi(af(e)).poe, bloqueioMagico: 50 };
  const { h, b, l } = naCacada(e, poe);
  const ev = [];
  const d = comRandom(0.001, () => Cacadas.magiaNoLacaio({ estado: e, hunt: h, bicho: b, l, a: { elemento: 'fire', min: 10, max: 10 }, eventos: ev, agora: Date.now(), ficha: Ficha.combate(e) }));
  assert.equal(d, 0);
  assert.ok(ev.some((x) => x.t === 'block' && x.uid === 'l1'));
  assert.equal(l.bloqueouEm, h.clock);
  assert.equal(b.estados.causticado?.ate, h.clock + 4000);
});

test('correção — o Sortudo no bloqueio de MAGIA ("se Bloqueou Recentemente") e o do Svalinn (sem condição), no ataque e na magia', { skip: SEM }, () => {
  // o Svalinn no escudo: vai ao lacaio
  const a = af(personagem({ afEscudo: { bloqueio_sortudo: 1 } }));
  assert.equal(a.minion_bloqueio_sortudo, 1);
  assert.ok(!(a.bloqueio_sortudo > 0), 'não é seu');
  const svalinn = zumbi(a).poe.bloqueioSortudo;
  assert.equal(svalinn, 1);
  // 30%: a 1ª jogada erra (0,5), a 2ª acerta (0,1)
  const magia = (poe, relogio) => LacaiosPoe.danoNoLacaio({ hp: 10, maxHp: 10, bloqueouEm: 10_000, poe }, { outros: 5, magia: true, rng: sequencia(0.5, 0.1), relogio }).bloqueou;
  assert.equal(magia({ bloqueioMagico: 30, seBloqueou: { sortudo: 1 } }, 12_000), true, 'Bloqueou Recentemente: Sortudo');
  assert.equal(magia({ bloqueioMagico: 30, seBloqueou: { sortudo: 1 } }, 20_000), false, 'depois dos 4 s: uma jogada só');
  assert.equal(magia({ bloqueioMagico: 30, bloqueioSortudo: 1 }, 20_000), true, 'o Svalinn: sempre');
  const ataque = (poe) => Cacadas.lacaioBloqueia({ uid: 'l', x: 0, y: 0, hp: 10, maxHp: 10, poe }, null, [], sequencia(0.5, 0.1), null, 0, { agora: 20_000 });
  assert.equal(ataque({ bloqueio: 30, bloqueioSortudo: 1 }), true);
  assert.equal(ataque({ bloqueio: 30 }), false);
});

test('correção — o bloqueio "se Bloqueou Recentemente" (ataque e magia) e o crítico do escudo; o "no máximo se não Bloqueou Recentemente"', { skip: SEM }, () => {
  const a = af(personagem({ afEscudo: { 'block@bloqueouRecente': 20, 'spell_block@bloqueouRecente': 15, 'crit_dmg@bloqueouRecente': 40, 'bloqueio_no_maximo@naoBloqueouRecente': 1, 'bloqueio_magia_no_maximo@naoBloqueouRecente': 1, block_max: 5 } }));
  const p = zumbi(a).poe;
  assert.deepEqual([p.seBloqueou.bloqueio, p.seBloqueou.bloqueioMagico, p.seBloqueou.critMult, p.naoBloqueou.noMaximo, p.naoBloqueou.magiaNoMaximo, p.bloqueioMax], [20, 15, 40, 1, 1, 5]);
  const l = { uid: 'l', x: 0, y: 0, hp: 10, maxHp: 10, bloqueouEm: 10_000, poe: { ...p, bloqueio: 10, bloqueioMagico: 0 } };
  // nos 4 s: 10 + 20 = 30% de ataque e 15% de magia; o crítico +40%
  assert.equal(LacaiosPoe.chanceDeBloquearDoLacaio(l, 10, { relogio: 12_000 }), 30);
  assert.equal(LacaiosPoe.chanceDeBloquearDoLacaio(l, 0, { magia: true, relogio: 12_000 }), 15);
  assert.equal(Cacadas.lacaioBloqueia({ ...l }, null, [], () => 0.29, null, 0, { agora: 12_000 }), true);
  const crit = (relogio) => LacaiosPoe.criticoDoLacaio(l, null, relogio).mult;
  assert.ok(Math.abs(crit(12_000) - crit(20_000) - 0.4) < 1e-9, '+40% de multiplicador só nos 4 s');
  // depois dos 4 s: no máximo — 75% + 5% de ataque, 75% de magia
  assert.equal(LacaiosPoe.chanceDeBloquearDoLacaio(l, 10, { relogio: 20_000 }), 80);
  assert.equal(LacaiosPoe.chanceDeBloquearDoLacaio(l, 0, { magia: true, relogio: 20_000 }), 75);
  assert.equal(Cacadas.lacaioBloqueia({ ...l }, null, [], () => 0.79, null, 0, { agora: 20_000 }), true);
  assert.equal(LacaiosPoe.danoNoLacaio({ ...l }, { outros: 5, magia: true, rng: () => 0.7, relogio: 20_000 }).bloqueou, true);
});

test('correção — "Recupera Escudo de Energia igual a X% da Armadura quando você Bloquear" do escudo: o escudo do lacaio pela armadura dele', { skip: SEM }, () => {
  const a = af(personagem({ afEscudo: { 'ev:bloquear:esDaArmadura': 10 } }));
  const poe = zumbi(a).poe;
  assert.ok(poe.armadura > 0 && poe.aoBloquear.eventos.some((x) => x.acao === 'esDaArmadura'));
  const l = { uid: 'l', x: 0, y: 0, hp: 10, maxHp: 10, es: 0, maxEs: 1e6, poe };
  Cacadas.aoBloquearDoLacaio({ clock: 5000, monstros: [] }, l, null, [], 5000, () => 0);
  assert.ok(Math.abs(l.es - poe.armadura * 0.1) < 1e-9, `${l.es} = 10% de ${poe.armadura}`);
});

test('correção — o Fogo adicional "se Bloqueou Recentemente" escala com o aumentado/mais do lacaio (`fatorDoDano`)', { skip: SEM }, () => {
  const com = zumbi({ minion_dmg: 50 }).poe.fatorDoDano;
  const sem = zumbi({}).poe.fatorDoDano;
  assert.ok(sem > 0 && Math.abs(com / sem - 1.5) < 1e-9, `${com} / ${sem} = 1,5`);
  const l = { hp: 10, maxHp: 10, bloqueouEm: 10_000, poe: { seBloqueou: { fogo: [10, 10], penFogo: 20 } } };
  const g = LacaiosPoe.golpeDoLacaio(l, {}, {}, 'physical', Date.now(), () => 0.5, null, 12_000);
  assert.equal(g.fogoExtra, 10);
  assert.equal(g.ficha.penetracao.porElemento.fire, 20);
  assert.equal(LacaiosPoe.golpeDoLacaio(l, {}, {}, 'physical', Date.now(), () => 0.5, null, 20_000).fogoExtra, 0, 'depois dos 4 s do relógio da caçada');
});
