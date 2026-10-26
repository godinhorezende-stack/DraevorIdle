// O LOTE A2 das gemas do PoE (dono, 19/10: "as gemas SEM EFEITO do PoE"): as 11 ativas e os 6 suportes que o relatório dava sem efeito — cada um
// com a regra do PoE (o PoB, o poedb) ou a decisão do dono. Cada teste usa a gema de verdade (encaixada, na caçada) e confere o número.
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
const A2 = await import('../systems/itens-poe/gemas-a2.mjs');
const ModsPoe = await import('../systems/itens-poe/condicoes-poe.mjs');
const Reserva = await import('../systems/itens-poe/reserva.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Combate = await import('../systems/hunt/combate.mjs');
const AtributosDoMob = await import('../systems/mobs/atributos.mjs');
const Reforcos = await import('../systems/skills/reforcos.mjs');
const Arvore = await import('../systems/arvore.mjs');

let J;
let gerarPeca;
const pecas = new Map();
async function carregar() {
  J ??= await import('../systems/itens-poe/jogo.mjs');
  gerarPeca ??= (await import('../systems/itens-poe/gerar.mjs')).gerarPeca;
}
const peca = (base) => {
  if (!pecas.has(base)) pecas.set(base, J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 60, rng: () => 0.5 })));
  return structuredClone(pecas.get(base));
};
const acao = (slug) => G.doSlug(slug).acao;
/**
 * Um personagem com a arma, as gemas ligadas na arma (a 1ª no slot 1 da barra, as outras como suportes ou magias do grupo), numa caçada, com um
 * alvo imortal colado e os outros longe — o molde do G16 (`gemas-todas-funcionam-poe.test.mjs`).
 */
function montar(gemas, { arma = 'One_Hand_Swords/Rusted_Sword', escudo = null, nivel = 20, qualidade = 0, barra = null } = {}) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Scion', sistema: 'poe' });
  const a = peca(arma);
  const n = gemas.length;
  a.soquetes = { abertos: n, links: Array.from({ length: Math.max(0, n - 1) }, () => true), gemas: Array(n).fill(null), cores: Array(n).fill('W') };
  e.equipment = { ...e.equipment, weapon: a };
  if (escudo) e.equipment.shield = peca(escudo);
  else delete e.equipment.shield;
  e.inventory = gemas.map((s) => GS.itemDaGema({ id: (G.doSlug(s) ?? SP.doSlug(s)).itemId, nivel, xp: 0, raridade: 'comum', qualidade }));
  for (let i = 0; i < n; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  e.actions = Array(Acoes.SLOTS).fill(null);
  (barra ?? [gemas[0]]).forEach((s, i) => { e.actions[i] = { id: acao(s), enabled: true, minMana: 0, conditions: [] }; });
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok, 'entrou na caçada');
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 10_000;
  e.maxHp = e.hp = 10_000;
  const [b, ...resto] = e.hunt.monstros;
  for (const m of resto) Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60 });
  Object.assign(b, { x: e.hunt.pos.x + 1, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12, estados: {} });
  return { e, b };
}
// (os eventos do uso: os do disparo e, com conjuração, os do fim dela — onde o golpe sai)
const usar = ({ e, b }, slot = 0, opcoes = { manual: true }) => {
  const r = Acoes.disparar(e, e.hunt, PERSONAGEM, slot, b, opcoes);
  if (r.ok && e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; r.eventos = [...(r.eventos ?? []), ...(Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM) ?? [])]; }
  return r;
};

test('A2: as 10 ativas viram buff com efeito e o Portal não se aplica; os 6 suportes têm efeito', { skip: SEM }, () => {
  for (const s of ['Blood_Rage', 'Berserk', 'Petrified_Blood', 'Temporal_Rift', 'Automation', 'Energy_Blade', 'Frost_Shield', 'Mana-Infused_Staff', 'Sigil_of_Power', 'Wall_of_Force']) {
    const r = G.doSlug(s);
    assert.equal(r.arquetipo, 'guarda', s);
    assert.notEqual(r.statusNoJogo, 'nao', `${s}: ${r.motivosNoJogo.join(' | ')}`);
  }
  const portal = G.doSlug('Portal');
  assert.equal(portal.statusNoJogo, 'nao');
  assert.match(portal.naoSeAplica, /^não se aplica/);
  for (const s of ['Item_Rarity_Support', 'Chance_to_Flee_Support', 'Block_Chance_Reduction_Support', 'Pacifism_Support', 'Bonespire_Support', 'Divine_Sentinel_Support']) assert.notEqual(SP.doSlug(s).status, 'nao', s);
});

test('A2: a Fúria segue o PoB — 1% de dano MAIS por Fúria (× o Efeito da Fúria) e a perda inerente de 10 por segundo depois de 2 s', { skip: SEM }, async () => {
  await carregar();
  const { e } = montar(['Blood_Rage']);
  const f = Ficha.combate(e);
  e.hunt.furia = { n: 0, ganhou: e.hunt.clock, perdeu: e.hunt.clock };
  const sem = ModsPoe.fichaDoGolpe(f, ['ataque'], { estado: e });
  e.hunt.furia.n = 20;
  const com = ModsPoe.fichaDoGolpe(f, ['ataque'], { estado: e });
  assert.equal(Math.round(((com.fatorDasCargas ?? 1) / (sem.fatorDasCargas ?? 1)) * 1000) / 1000, 1.2, '20 de Fúria = 20% mais');
  assert.deepEqual(com.danoDoElemento ?? {}, sem.danoDoElemento ?? {}, 'não é "aumentado"');
  assert.equal(ModsPoe.efeitoDaFuria(e, { efeito_furia: 59 }), Math.floor(20 * 1.59), 'o Efeito da Fúria: floor(Fúria × (1 + X%))');
  // a perda: nada nos 2 s; depois, 10 por segundo
  const h = { clock: 0, furia: { n: 30, ganhou: 0, perdeu: 0 } };
  ModsPoe.tiqueDaFuria(h, 1999);
  assert.equal(h.furia.n, 30);
  ModsPoe.tiqueDaFuria(h, 3000);
  assert.equal(h.furia.n, 20, '10 em 1 s');
});

test('A2: a Fúria Sangrenta — a velocidade de ataque, o dreno, a perda de 4%/s, a Carga de Frenesi; custa Vida; matar renova a duração', { skip: SEM }, async () => {
  await carregar();
  const m = montar(['Blood_Rage'], { qualidade: 20 });
  const { e } = m;
  const antes = { atk: Ficha.combate(e).afPoe.atk_speed ?? 0, hp: e.hp, mana: e.mana };
  assert.ok(usar(m).ok);
  const b = e.hunt.buffs[acao('Blood_Rage')];
  assert.ok(b && b.ate > e.hunt.clock, 'ligou');
  const af = Ficha.combate(e).afPoe;
  assert.equal((af.atk_speed ?? 0) - antes.atk, 20, '15% + 5% da qualidade 20');
  assert.equal(af.life_leech_fisico_ataque, 1.2);
  // (lote G-B, com o aval do dono 26/10 — D8: a perda é o Dano Físico degenerativo do PoB, 4% da Vida + 4% do ES máximos por segundo, que pode matar — no lugar da
  // perda do jogo, `perde_vida_pct_s`/`perde_es_pct_s`)
  assert.equal(af.perde_vida_pct_s, undefined);
  assert.deepEqual([b.a2.degenVidaPct, b.a2.degenEsPct], [4, 4]);
  Acoes.tiqueDasGemasGBD(e, e.hunt, PERSONAGEM, [], e.hunt.clock);
  const dot = e.hunt.efeitosDoJogador.dots.find((d) => d.tipo === 'degenFisico');
  const es = Math.round(Ficha.combate(e).energyShield ?? 0);
  assert.ok(Math.abs(dot.falta - ((e.maxHp * 4 + es * 4) / 100) * 0.5) < 1e-6, 'o degenerativo por meio segundo: (4% da Vida + 4% do ES) × 0,5 s');
  assert.equal(af.carga_frenesi_ao_matar, 25);
  assert.ok(e.hp < antes.hp && e.mana === antes.mana, `o custo é de Vida (${antes.hp} → ${e.hp}; mana ${e.mana})`);
  b.ate = e.hunt.clock + 100;
  Acoes.aoMatarA2(e, e.hunt, e.hunt.clock);
  assert.equal(b.ate, e.hunt.clock + b.durMs, 'matar reinicia a duração');
});

test('A2: o Berserk — precisa de 5 de Fúria; no automático só com a Fúria no máximo ou com a condição "Fúria ≥ N"; a perda acelera e o fim liga a recarga', { skip: SEM }, async () => {
  await carregar();
  const m = montar(['Berserk']);
  const { e } = m;
  e.hunt.furia = { n: 3, ganhou: e.hunt.clock, perdeu: e.hunt.clock };
  assert.equal(usar(m).motivo, 'FURIA', 'com 3 de Fúria não entra');
  e.hunt.furia.n = 10;
  assert.equal(usar(m, 0, {}).motivo, 'FURIA', 'o automático, sem a condição: só com a Fúria no máximo (30)');
  e.actions[0].conditions = [Acoes.sanearCondicao({ kind: 'furia', op: 'gte', value: 8 })];
  assert.deepEqual(e.actions[0].conditions[0], { kind: 'furia', op: 'gte', value: 8 });
  const r = usar(m, 0, {});
  assert.ok(r.ok, `com a condição Fúria ≥ 8: ${r.motivo ?? ''}`);
  const b = e.hunt.buffs[acao('Berserk')];
  assert.ok(b, 'ligou');
  assert.equal(Ficha.combate(e).afPoe.efeito_furia, 59);
  // a perda: 5/s no 1º segundo, 6/s no 2º (20% mais por segundo)
  const t0 = e.hunt.clock;
  e.hunt.furia = { n: 40, ganhou: t0 + 100_000, perdeu: t0 + 100_000 };
  A2.tiqueDoBerserk(e.hunt, t0 + 1000);
  assert.equal(e.hunt.furia.n, 35);
  A2.tiqueDoBerserk(e.hunt, t0 + 2000);
  assert.equal(e.hunt.furia.n, 29);
  e.hunt.furia.n = 1;
  e.hunt.clock = t0 + 3000;
  Acoes.tiqueDasGemasA2(e, e.hunt, PERSONAGEM, [], e.hunt.clock);
  assert.equal(e.hunt.buffs[acao('Berserk')], undefined, 'acabou com a Fúria em 0');
  assert.equal(e.hunt.cooldowns[acao('Berserk')].ate, e.hunt.clock + b.recargaMs, 'a recarga só começa no fim');
});

test('A2: o Sangue Petrificado — reserva 35%; 40% da Vida perdida abaixo da metade é impedida, 81% dela se perde em 1 s; o teto em Vida Baixa; o custo de Vida', { skip: SEM }, async () => {
  await carregar();
  const m = montar(['Petrified_Blood']);
  const { e } = m;
  assert.ok(usar(m).ok);
  const b = e.hunt.buffs[acao('Petrified_Blood')];
  assert.equal(b.ate, Reserva.LIGADA_ATE);
  assert.deepEqual({ recurso: b.reserva.recurso, pct: b.reserva.pct }, { recurso: 'mana', pct: 35 });
  // um acerto de 2000 com 6000 de 10000: 1000 abaixo da metade → 400 impedidos, 324 (81%) em 1 s
  e.hp = 6000;
  const v = A2.impedirNoSangue(e, e.hunt, 2000, e.hunt.clock);
  assert.equal(v, 1600);
  e.hp -= v;
  e.hunt.clock += 1000;
  A2.tiqueDoSangue(e, e.hunt, e.hunt.clock);
  assert.equal(e.hp, 4400 - 324);
  // acima da metade a perda não muda
  e.hp = 9000;
  assert.equal(A2.impedirNoSangue(e, e.hunt, 1000, e.hunt.clock), 1000);
  // o teto: a Vida que sobe sem frasco para em Vida Baixa (50%)
  e.hp = 3000;
  A2.fimDoTiqueDoSangue(e, e.hunt);
  e.hp = 7000;
  A2.tetoDoSangue(e, e.hunt);
  assert.equal(e.hp, 5000);
  // o custo de Vida acima de Vida Baixa: 40% do custo de mana base
  e.hp = 9000;
  assert.equal(A2.custoDeVidaDoSangue(e, e.hunt), 40);
  e.hp = 4000;
  assert.equal(A2.custoDeVidaDoSangue(e, e.hunt), 0);
});

test('A2: a Fenda Temporal — reserva 10%; guarda os últimos 4 s e volta a Vida, a Mana e a casa quando a Vida de 4 s atrás é 30 pontos maior', { skip: SEM }, async () => {
  await carregar();
  const m = montar(['Temporal_Rift']);
  const { e } = m;
  assert.ok(usar(m).ok);
  const b = e.hunt.buffs[acao('Temporal_Rift')];
  assert.equal(b.reserva.pct, 10);
  assert.equal(Ficha.combate(e).afPoe.imune_grilhoes_temporais, 1);
  delete e.hunt.cooldowns[acao('Temporal_Rift')];
  const casa = { x: e.hunt.pos.x, y: e.hunt.pos.y };
  e.hp = 9000;
  A2.fotografarFenda(e, e.hunt, e.hunt.clock);
  e.hunt.pos.x += 1;
  e.hp = 5000;
  e.hunt.clock += 4000;
  Acoes.tiqueDasGemasA2(e, e.hunt, PERSONAGEM, [], e.hunt.clock);
  assert.equal(e.hp, 9000, 'a Vida de 4 s atrás');
  assert.deepEqual({ x: e.hunt.pos.x, y: e.hunt.pos.y }, casa, 'a casa de 4 s atrás');
  assert.ok(e.hunt.cooldowns[acao('Temporal_Rift')].ate > e.hunt.clock, 'a recarga');
});

test('A2: a Automação — liga e desliga no clique; a magia instantânea do grupo sai sozinha a cada 0,6 s com 150% do custo', { skip: SEM }, async () => {
  await carregar();
  const m = montar(['Automation', 'Blood_Rage']);
  const { e } = m;
  assert.ok(usar(m).ok);
  assert.equal(e.hunt.buffs[acao('Automation')].ate, Reserva.LIGADA_ATE);
  const g = GS.gruposComGatilho(e).find((x) => x.automacao);
  assert.deepEqual(g.magias, [acao('Blood_Rage')]);
  const hp = e.hp;
  e.hunt.clock += 100;
  Acoes.tiqueDasGemasA2(e, e.hunt, PERSONAGEM, [], e.hunt.clock);
  assert.ok(e.hunt.buffs[acao('Blood_Rage')], 'a Fúria Sangrenta saiu sozinha');
  const custo = G.custoNoNivel('Blood_Rage', 20);
  assert.equal(hp - e.hp, Math.round(custo * 1.5), 'o custo × 1,5');
  // o clique desliga (passada a recarga dela)
  e.hunt.clock += 1000;
  const r = usar(m);
  assert.ok(r.ok && r.desligou, r.motivo);
  assert.equal(e.hunt.buffs[acao('Automation')], undefined);
});

test('A2: a Lâmina de Energia — só com espada; 50% menos ES; o golpe vira o Raio do ES (2% + 12 a 40% + 235 no nível 20); o clique desliga', { skip: SEM }, async () => {
  await carregar();
  const semEspada = montar(['Energy_Blade'], { arma: 'Two_Hand_Maces/Driftwood_Maul' });
  assert.equal(usar(semEspada).motivo, 'ARMA');
  const m = montar(['Energy_Blade']);
  const { e } = m;
  e.es = 10_000;
  const esAntes = Ficha.combate(e).energyShield ?? 0;
  const r = usar(m);
  assert.ok(r.ok, r.motivo);
  const esDepois = Ficha.combate(e).energyShield ?? 0;
  assert.equal(esDepois, Math.round(esAntes * 0.5));
  const l = Acoes.laminaDeEnergia(e);
  assert.equal(l.elemento, 'energy');
  assert.equal(Math.round(l.min), Math.round(esDepois * 0.02 + 12));
  assert.equal(Math.round(l.max), Math.round(esDepois * 0.4 + 235));
  e.hunt.clock += 1500;
  const off = usar(m);
  assert.ok(off.ok && off.desligou, off.motivo);
  assert.equal(Acoes.laminaDeEnergia(e), null);
  // ligada de novo, a gema saindo da barra a desliga
  e.hunt.clock += 1500;
  assert.ok(usar(m).ok);
  e.actions[0] = null;
  assert.equal(Acoes.desligarAurasForaDaBarra(e, e.hunt), true);
  assert.equal(Acoes.laminaDeEnergia(e), null);
});

test('A2: o Escudo Gélido — o globo drena o ES e ganha estágios (910 de Vida cada); absorve 20%/60% dos acertos com você na área', { skip: SEM }, async () => {
  await carregar();
  const m = montar(['Frost_Shield']);
  const { e, b } = m;
  e.es = 5000;
  assert.ok(usar(m).ok);
  const g = A2.escudoGelido(e.hunt);
  assert.ok(g, 'o globo no chão');
  e.hunt.clock += 1000;
  A2.tiqueDoEscudoGelido(e, e.hunt, e.hunt.clock);
  assert.equal(g.estagios, 3, '1 estágio a cada 0,3 s por 1 s');
  assert.equal(g.vida, 3 * 910);
  assert.equal(e.es, 5000 - 730);
  // o inimigo colado (na área): 20%; o de longe: 60%
  assert.equal(A2.absorverNoEscudoGelido(e.hunt, 1000, b, e.hunt.clock), 200);
  assert.equal(A2.absorverNoEscudoGelido(e.hunt, 1000, { x: e.hunt.pos.x + 9, y: e.hunt.pos.y }, e.hunt.clock), 600);
  assert.ok(Math.abs((G.adds(e)?.['crit_chance@magia'] ?? 0) - 3 * 0.38) < 1e-9, 'o crítico por estágio na área');
});

test('A2: o Cajado Impregnado de Mana — só com cajado; reserva sempre 30%; 30% menos custo; bloqueio "mais"; a Onda Arcana ao bloquear', { skip: SEM }, async () => {
  await carregar();
  assert.equal(usar(montar(['Mana-Infused_Staff'])).motivo, 'ARMA');
  const m = montar(['Mana-Infused_Staff'], { arma: 'Staves/Gnarled_Branch' });
  const { e, b } = m;
  const antes = Ficha.combate(e).blockChance ?? 0;
  assert.ok(usar(m).ok);
  const bf = e.hunt.buffs[acao('Mana-Infused_Staff')];
  assert.deepEqual({ pct: bf.reserva.pct, fator: bf.reserva.fator }, { pct: 30, fator: 1 });
  const f = Ficha.combate(e);
  assert.equal(f.afPoe.custo_mana_mais, -30);
  assert.equal(f.afPoe.bloqueio_mais, 24, 'o "+24%" do pt é o BlockChance MORE do PoB');
  assert.ok((f.blockChance ?? 0) >= antes);
  const hp = b.hp;
  const eventos = [];
  assert.ok(Acoes.ondaArcana(e, e.hunt, PERSONAGEM, eventos, e.hunt.clock) > 0, 'a onda acerta o colado');
  assert.ok(b.hp < hp);
  assert.equal(Acoes.ondaArcana(e, e.hunt, PERSONAGEM, [], e.hunt.clock + 500), 0, 'no máximo uma vez por segundo');
});

test('A2: o Emblema do Poder — 1 estágio a cada 400 de mana gasta na área (1 s entre eles); o Raio por estágio; os inimigos causam menos dano no máximo', { skip: SEM }, async () => {
  await carregar();
  const m = montar(['Sigil_of_Power'], { qualidade: 20 });
  const { e, b } = m;
  assert.ok(usar(m).ok);
  const em = A2.emblema(e.hunt);
  assert.ok(em);
  for (let i = 0; i < 4; i++) { e.hunt.clock += 1000; A2.aoGastarManaNoEmblema(e.hunt, 400, e.hunt.clock); }
  assert.equal(em.estagios, 4);
  const ad = G.adds(e);
  assert.deepEqual([ad.added_energy_dmg_min, ad.added_energy_dmg_max, ad.spell_added_energy_dmg_min], [28, 564, 28]);
  Acoes.tiqueDasGemasA2(e, e.hunt, PERSONAGEM, [], e.hunt.clock);
  assert.equal(b.estados.emblema.pct, 23, '19% + 4% da qualidade 20');
  const sem = Reforcos.forcaDoBicho({ ...b, estados: {} }, e.hunt.clock);
  assert.ok(Math.abs(Reforcos.forcaDoBicho(b, e.hunt.clock) / sem - 0.77) < 1e-9);
});

test('A2: a Parede de Força — entre você e o alvo; o projétil que a cruza ganha +1 ricochete com −20% de dano, até 17 colisões', { skip: SEM }, async () => {
  await carregar();
  const m = montar(['Wall_of_Force']);
  const { e } = m;
  const longe = { x: e.hunt.pos.x + 6, y: e.hunt.pos.y };
  e.hunt.a2 = {};
  const p = A2.porParede(e.hunt, longe, G.daGemaA2('Wall_of_Force', 20).a2, 7000, e.hunt.clock);
  assert.equal(p.casas.length, 3, '6 m = 3 casas');
  assert.ok(p.casas.every((c) => c.x === e.hunt.pos.x + 3), 'atravessada na casa do meio');
  assert.equal(p.colisoes, 17);
  assert.ok(A2.cruzaAParede(e.hunt, e.hunt.pos, longe));
  assert.equal(A2.cruzaAParede(e.hunt, e.hunt.pos, { x: e.hunt.pos.x - 6, y: e.hunt.pos.y }), null, 'do outro lado, não');
  assert.ok(usar(m).ok, 'a gema liga');
  // o projétil (a Bola de Fogo) no alvo do outro lado da parede: +1 ricochete (o segundo bicho é acertado) e −20% de dano no alvo; gasta uma colisão
  // (o mesmo personagem e os mesmos bichos nos dois usos — a raridade e os modificadores dos bichos são sorteados ao entrar)
  const f = montar(['Fireball'], { arma: 'Wands/Driftwood_Wand' });
  const outro = f.e.hunt.monstros[1];
  const bola = (comParede) => {
    Object.assign(f.b, { x: f.e.hunt.pos.x + 3, y: f.e.hunt.pos.y, hp: 1e12, maxHp: 1e12, estados: {}, dots: [] });
    Object.assign(outro, { x: f.e.hunt.pos.x + 3, y: f.e.hunt.pos.y + 2, hp: 1e12, maxHp: 1e12, estados: {}, dots: [] });
    f.e.hunt.a2 = {};
    f.e.hunt.cooldowns = {};
    f.e.hunt.clock += 5000;
    const p2 = comParede ? A2.porParede(f.e.hunt, f.b, G.daGemaA2('Wall_of_Force', 20).a2, 7000, f.e.hunt.clock) : null;
    const rnd = Math.random;
    Math.random = () => 0.5;
    let r;
    try { r = usar(f); } finally { Math.random = rnd; }
    assert.ok(r.ok, r.motivo);
    const dano = (uid) => r.eventos.filter((x) => x.t === 'dmg' && x.foe && x.uid === uid).reduce((t, x) => t + x.v, 0);
    return { noAlvo: dano(f.b.uid), noOutro: dano(outro.uid), p2 };
  };
  const sem = bola(false);
  const com = bola(true);
  assert.equal(com.p2.colisoes, 16, 'a Bola de Fogo cruzou a parede');
  assert.equal(sem.noOutro, 0, 'sem a parede, o segundo bicho não é acertado');
  assert.ok(com.noOutro > 0, 'com a parede, o ricochete acerta o segundo');
  assert.ok(Math.abs(com.noAlvo / sem.noAlvo - 0.8) < 0.02, `−20% no alvo: ${sem.noAlvo} → ${com.noAlvo}`);
});

test('A2: os suportes — a Raridade do abate, a fuga (o Raro não foge), o Pacifismo (1 de Vida), o bloqueio reduzido e o Subjugado', { skip: SEM }, async () => {
  await carregar();
  const ef = (s, n = 20) => SP.efeitoNoNivel(s, n, 0, { tags: ['poe:Ataque', 'poe:Magia'] }).efeito;
  assert.equal(ef('Item_Rarity_Support').raridadeAoMatarPct, 59);
  assert.equal(ef('Chance_to_Flee_Support').chanceFugirPct, 44);
  assert.equal(ef('Pacifism_Support', 3).chanceFugirPct, 20, 'Excepcional: o nível 3 é o máximo — 20%');
  // (o 3 é o máximo da GEMA; o bônus de nível das peças soma acima, pelas linhas do poedb)
  assert.ok(ef('Pacifism_Support', 4).chanceFugirPct > 20, 'com +1 nível das peças, o nível 4');
  assert.equal(SP.nivelMaximoDe(SP.doSlug('Pacifism_Support').suporte), 3);
  assert.equal(ef('Pacifism_Support').naoMata, 1);
  assert.deepEqual([ef('Block_Chance_Reduction_Support').bloqueioInimigoMenos, ef('Block_Chance_Reduction_Support').subjugadoMs, ef('Block_Chance_Reduction_Support').subjugadoPct], [20, 4000, 5]);
  // a raridade do golpe que matou
  const { e, b } = montar(['Blood_Rage']);
  const base = Combate.raridadeDoDrop(e, b);
  b.poeRaridadeDoGolpe = 59;
  assert.equal(Combate.raridadeDoDrop(e, b) - base, 59);
  // a fuga: 2 s; o Raro não foge
  assert.ok(Acoes.fugir({ estados: {} }, 100, 0, () => 0));
  const normal = { estados: {} };
  Acoes.fugir(normal, 100, 1000, () => 0);
  assert.equal(normal.estados.fugindo.ate, 3000);
  assert.equal(Acoes.fugir({ raridade: 'raro', estados: {} }, 100, 0, () => 0), false);
  // o bloqueio: os pontos a menos e o Subjugado acumulando
  const bicho = { bloqueio: 30, estados: {} };
  assert.equal(AtributosDoMob.bloqueou(bicho, () => 0.25, 1, { menosPontos: 20 }), false, '30% − 20 pontos = 10%: 0,25 não bloqueia');
  AtributosDoMob.subjugar(bicho, 4000, 5, 0);
  AtributosDoMob.subjugar(bicho, 4000, 5, 100);
  assert.equal(AtributosDoMob.subjugadoPontos(bicho, 200), 10);
  assert.equal(AtributosDoMob.subjugadoPontos(bicho, 4050), 5);
  // as Excepcionais não recebem o "+1 nível de suportes não excepcionais"
  const pac = GS.defDaGema(SP.doSlug('Pacifism_Support').itemId);
  assert.ok(pac?.poe?.excepcional, 'o Pacifismo é Excepcional');
});

test('A2: o Pacifismo no golpe — o ataque deixa o monstro com 1 de Vida e, no automático, troca de alvo', { skip: SEM }, async () => {
  await carregar();
  const m = montar(['Double_Strike', 'Pacifism_Support'], { nivel: 3 });
  const { e, b } = m;
  Object.assign(b, { hp: 5, maxHp: 1000 });
  const outro = e.hunt.monstros[1];
  Object.assign(outro, { x: e.hunt.pos.x - 1, y: e.hunt.pos.y, hp: 1000, maxHp: 1000 });
  for (let i = 0; i < 5 && b.hp > 1; i++) { delete e.hunt.cooldowns?.['grupo:poe']; usar(m); e.hunt.clock += 2000; }
  assert.equal(b.hp, 1, 'não morre');
  e.hunt.clock += 2000;
  delete e.hunt.cooldowns?.[Acoes.GRUPO_DO_POE];
  const r = Acoes.disparar(e, e.hunt, PERSONAGEM, 0, b, {});
  assert.equal(r.motivo, 'PACIFISMO');
  assert.equal(e.hunt.alvo, outro.uid, 'o alvo passa a ser o outro');
});

test('A2: a Torre Óssea — o Clamor ergue as torres; a Pancada que pega a casa delas as explode', { skip: SEM }, async () => {
  await carregar();
  const ef = SP.efeitoNoNivel('Bonespire_Support', 3, 0, { tags: ['poe:Clamor'] }).efeito;
  assert.deepEqual([ef.torresOsseas, ef.torres, ef.torresMax, ef.torresMs, ef.torresRaioM], [1, 6, 20, 8000, 4.5]);
  // o mesmo personagem: o Clamor (com a Torre Óssea) ergue as torres e a Pancada (o Golpe no Chão) as explode
  const m = montar(['Enduring_Cry', 'Bonespire_Support', 'Ground_Slam'], { nivel: 3, arma: 'Two_Hand_Maces/Driftwood_Maul', barra: ['Enduring_Cry', 'Ground_Slam'] });
  const { e, b } = m;
  assert.ok(usar(m).ok);
  assert.equal(e.hunt.a2?.torres?.length, 6, 'as 6 torres');
  const t = e.hunt.a2.torres.find((x) => Math.max(Math.abs(x.x - e.hunt.pos.x), Math.abs(x.y - e.hunt.pos.y)) === 1);
  Object.assign(b, { x: t.x, y: t.y });
  e.hunt.clock += 2000;
  const r = usar(m, 1);
  assert.ok(r.ok, r.motivo);
  assert.ok(!e.hunt.a2.torres.includes(t), 'a torre explodiu');
  assert.ok(r.eventos.some((x) => x.t === 'dmg' && x.fonte === 'torre-ossea' && x.uid === b.uid && x.v > 0), 'a explosão da torre acertou o bicho');
});

test('A2: a Sentinela Divina — as auras templárias valem em você no raio da sentinela', { skip: SEM }, async () => {
  await carregar();
  const ef = SP.efeitoNoNivel('Divine_Sentinel_Support', 3, 0, { tags: ['poe:Lacaio'] }).efeito;
  assert.deepEqual([ef.areaLacaioPct, ef.auraTemplaria], [46, 1]);
  const { e } = montar(['Blood_Rage']);
  e.hunt.lacaios = [{ uid: 's', hp: 10, x: e.hunt.pos.x + 1, y: e.hunt.pos.y, auraTemplaria: { nome: 'x', af: { chaos_res: 23 }, raio: 2 } }];
  assert.equal(A2.adds(e).chaos_res, 23);
  e.hunt.lacaios[0].x += 5;
  assert.equal(A2.adds(e), null, 'fora do raio');
  assert.equal(A2.AURAS_TEMPLARIAS.length, 6);
  // a sentinela invocada pela gema suportada nasce com uma aura templária (sorteada) e a área dos lacaios maior
  const m = montar(['Herald_of_Purity', 'Divine_Sentinel_Support'], { nivel: 20 });
  m.e.inventory = [];
  assert.ok(usar(m).ok);
  const s0 = (m.e.hunt.lacaios ?? []).find((l) => /sentinela|sentinel/i.test(l.nome ?? ''));
  assert.ok(s0, 'a sentinela em campo');
  assert.ok(A2.AURAS_TEMPLARIAS.some((a) => a.nome === s0.auraTemplaria?.nome), 'com uma aura templária');
  assert.equal(s0.auraTemplaria.raio, 2);
});

test('A2 (revisão): a Fenda não revive morto e define a Vida (o teto do Sangue parte dela); a Lâmina vira a base; a Autoexerção fora da Automação', { skip: SEM }, async () => {
  await carregar();
  const m = montar(['Temporal_Rift']);
  const { e } = m;
  assert.ok(usar(m).ok);
  delete e.hunt.cooldowns[acao('Temporal_Rift')];
  e.hp = 9000;
  A2.fotografarFenda(e, e.hunt, e.hunt.clock);
  e.hp = 0;
  e.hunt.clock += 4000;
  Acoes.tiqueDasGemasA2(e, e.hunt, PERSONAGEM, [], e.hunt.clock);
  assert.equal(e.hp, 0, 'morto não volta');
  e.hp = 5000;
  Acoes.tiqueDasGemasA2(e, e.hunt, PERSONAGEM, [], e.hunt.clock);
  assert.equal(e.hp, 9000);
  assert.equal(e.hunt.a2.sangueVida, 9000, 'o teto do Sangue Petrificado parte da Vida que a Fenda definiu');
  // a Lâmina de Energia: a ficha é a da base (1,7 ataques/s, 7% de crítico) e o Raio é o dano adicionado aos ataques
  const l = montar(['Energy_Blade']);
  l.e.es = 1e6;
  assert.ok(usar(l).ok);
  const f = Ficha.combate(l.e);
  assert.equal(f.critChance, 0.07);
  assert.equal(f.intervaloDoGolpeMs, Math.round(1000 / 1.7 / (1 + (f.afPoe.atk_speed ?? 0) / 100)));
  const raio = Acoes.laminaDeEnergia(l.e);
  assert.deepEqual(f.danoSomado.energy.map(Math.round), [Math.round(raio.min), Math.round(raio.max)]);
  // a Automação não suporta a Autoexerção (Ativação, com a reserva própria no PoB)
  const a = montar(['Automation', 'Autoexertion']);
  assert.deepEqual(GS.gruposComGatilho(a.e).find((x) => x.automacao).magias, []);
});

test('A2 (revisão): a Fúria — teto no máximo de agora; a espera dos 2 s conta do último acerto recebido; o Berserk; o cartão no HUD', { skip: SEM }, async () => {
  await carregar();
  const m = montar(['Berserk']);
  const { e } = m;
  ModsPoe.definirFichaDaCacada(e.hunt, () => Ficha.combate(e));
  const t = e.hunt.clock;
  e.hunt.furia = { n: 40, ganhou: t, perdeu: t };
  ModsPoe.tiqueDaFuria(e.hunt, t + 100);
  assert.equal(e.hunt.furia.n, 30, 'o máximo de agora (30)');
  // acertado há 1 s: a perda inerente ainda não começou
  e.hunt.furia = { n: 20, ganhou: t - 10_000, perdeu: t - 10_000 };
  (e.hunt.poeRecente ??= {}).acertado = t - 1000;
  ModsPoe.tiqueDaFuria(e.hunt, t);
  assert.equal(e.hunt.furia.n, 20);
  assert.ok(ModsPoe.buffsDoCliente(e).some((c) => c.tipo === 'furia' && c.contador === 20), 'a Fúria no HUD');
  // o Berserk: a Fúria cai o tempo todo (o Ritual da Ruína não vale); desligado pela barra, a recarga começa
  assert.ok(usar(m).ok);
  assert.equal(ModsPoe.furiaSemPerder(e.hunt, {}, e.hunt.clock), 0);
  e.hunt.buffs[acao('Berserk')].recargaMs = 5000;
  e.actions[0] = null;
  assert.equal(Acoes.desligarAurasForaDaBarra(e, e.hunt), true);
  assert.equal(e.hunt.cooldowns[acao('Berserk')].ate, e.hunt.clock + 5000);
});

test('A2 (revisão): a Raridade de Itens sai no golpe sem o suporte; a Regeneração templária é % da Vida máxima; a Onda só com cajado', { skip: SEM }, async () => {
  await carregar();
  const QuemFeriu = await import('../systems/hunt/quem-feriu.mjs');
  const bicho = {};
  QuemFeriu.carimbar(bicho, QuemFeriu.VOCE, null, { raridade: 59 });
  assert.equal(bicho.poeRaridadeDoGolpe, 59);
  QuemFeriu.carimbar(bicho, QuemFeriu.VOCE, null);
  assert.equal(bicho.poeRaridadeDoGolpe, undefined);
  assert.deepEqual(A2.AURAS_TEMPLARIAS.find((a) => /Regenera/.test(a.nome)).af, { life_regen_max_pct: 1.5 });
  const c = montar(['Mana-Infused_Staff'], { arma: 'Staves/Gnarled_Branch' });
  assert.ok(usar(c).ok);
  c.e.equipment.weapon = peca('One_Hand_Swords/Rusted_Sword');
  assert.equal(Acoes.ondaArcana(c.e, c.e.hunt, PERSONAGEM, [], c.e.hunt.clock), 0);
  Acoes.desligarAurasForaDaBarra(c.e, c.e.hunt);
  assert.equal(c.e.hunt.buffs[acao('Mana-Infused_Staff')], undefined, 'sem cajado, desliga');
});
