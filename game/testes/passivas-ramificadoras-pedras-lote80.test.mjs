// LOTE 80 — as PEDRAS FUNDAMENTAIS das Ramificadoras únicas com efeito: o Discípulo de Kitava (consome um cadáver por segundo — Vida e Mana —, mais
// dano sofrido sem consumir), o Mensageiro Solitário (as 4 linhas viáveis — dono: "As duas coisas"; os acertos dos Arautos num lote próprio), a
// Paciência da Natureza (2 Vinhas por segundo parado, até 10 — o PoB), os Segredos do Sofrimento, o Cineticismo (e o golpe básico de longe que
// perfurava assim mesmo), a Astúcia do Veterano (a Guarda não Vaal pela tag da gema) e a Técnica da Palma Oca (não Sobrecarregado: os punhos como
// Dupla Empunhadura).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste } = await import('./apoio.mjs');
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
await (await import('../systems/itens-poe/iniciar.mjs')).iniciarJogoDoPoe();
const J = await import('../systems/itens-poe/jogo.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const Joias = await import('../systems/passivas/joias.mjs');
const Ficha = await import('../systems/ficha.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const GemasPoe = await import('../systems/itens-poe/gemas-poe.mjs');
const Lacaios = await import('../systems/itens-poe/lacaios-poe.mjs');
const Acoes = await import('../systems/acoes.mjs');
const { traduzirLinha } = await import('../systems/itens-poe/arvore.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');

J.iniciar(ITEM_CATALOG);
const cat = () => Catalogo.catalogo();
const unica = (slug) => {
  const u = cat().classes.Jewels.unicos.find((x) => x.slug === slug);
  const base = cat().classes.Jewels.bases.find((b) => b.nome === u.base);
  return J.pecaDoJogo(gerarPeca({ catalogo: cat(), regras: Catalogo.REGRAS, base: base.id, raridade: 'unico', ilvl: 84, rng: () => 0.3, unico: slug }));
};
/** O personagem com a pedra da única `slug` alocada (no 2491) — ou sem joia (`slug` null), com o mesmo caminho. */
function comPedra(slug, { vocacao = 'knight' } = {}) {
  const e = personagemDeTeste({ vocacao, level: 100 });
  e.sistema = 'poe';
  e.classePoe = 'Marauder';
  P.garantir(e);
  e.inventory = [];
  e.level = 100;
  for (const x of P.caminhoAte(e, '2491')) assert.ok(P.alocar(e, x).ok);
  if (slug) {
    e.inventory.push(unica(slug));
    assert.ok(Joias.encaixar(e, { no: '2491', pilha: 0, id: e.inventory[0].id }).ok);
    const [pedra] = P.nosDaRamificadora(e, '2491');
    assert.ok(P.alocar(e, pedra).ok);
  }
  e.hunt = { clock: 100_000, poeEntrou: 100_000, pos: { x: 0, y: 0 }, monstros: [], lacaios: [], buffs: {} };
  Ficha.invalidar(e);
  return e;
}
const ficha = (e) => { Ficha.invalidar(e); return Ficha.combate(e); };
const af = (e, k) => Number(ficha(e).afPoe?.[k]) || 0;

test('as LINHAS das 7 pedras: todas com efeito (lote 81: as 2 dos acertos dos Arautos também)', { skip: SEM }, () => {
  const pedras = Object.values(cat().ramificadoras.pedras).filter((p) => p.en !== 'Pitfighter');
  const sem = [];
  for (const p of pedras) for (const l of p.linhas.flatMap((x) => x.split('\n'))) {
    const t = traduzirLinha(l);
    if (!['novo', 'equivalente', 'aproximado'].includes(t.estado) || !t.efeitos.length) sem.push(l);
  }
  // (dono, 18/10, lote 81: "Pode trocar" — os acertos dos Arautos existem; antes as 2 linhas do Mensageiro ficavam de fora)
  assert.deepEqual(sem, []);
});

test('o DISCÍPULO DE KITAVA: a cada segundo consome o cadáver mais perto (a até 6 casas) e recupera 5% de Vida e de Mana; sem consumir, 10% mais dano sofrido', { skip: SEM }, () => {
  const e = comPedra('Kitavas_Teachings');
  Object.assign(e, { maxHp: 10000, hp: 1000, maxMana: 1000, mana: 100 });
  e.hunt.cadaveres = [{ key: 'rat', x: 20, y: 20 }, { key: 'rat', x: 2, y: 1 }, { key: 'rat', x: 1, y: 1 }];
  const sem = ficha(comPedra(null));
  assert.ok(Math.abs(ModsPoe.fatorDoDanoRecebido(ficha(e), 'physical') / ModsPoe.fatorDoDanoRecebido(sem, 'physical') - 1.1) < 1e-9, 'sem consumir: 10% mais');
  ModsPoe.aurasProximas(e, e.hunt, ficha(e));
  e.hunt.clock += 1000;
  ModsPoe.aurasProximas(e, e.hunt, ficha(e));
  assert.equal(e.hp, 1500);
  assert.equal(e.mana, 150);
  assert.deepEqual(e.hunt.cadaveres.map((c) => `${c.x},${c.y}`), ['20,20', '2,1'], 'o mais perto');
  assert.ok(ModsPoe.condicoesDe(e).has('consumiuCadaverRecente'));
  assert.ok(Math.abs(ModsPoe.fatorDoDanoRecebido(ficha(e), 'physical') / ModsPoe.fatorDoDanoRecebido(sem, 'physical') - 1) < 1e-9, 'consumiu: sem o a mais');
  e.hunt.clock += 1000;
  ModsPoe.aurasProximas(e, e.hunt, ficha(e));
  assert.equal(e.hp, 2000);
  e.hunt.clock += 1000;
  ModsPoe.aurasProximas(e, e.hunt, ficha(e));
  assert.equal(e.hp, 2000, 'o de (20,20) fica: longe');
  e.hunt.clock += 4000;
  assert.ok(ModsPoe.condicoesDe(e).has('naoConsumiuCadaverRecente'));
});

test('o MENSAGEIRO SOLITÁRIO: 50% mais efeito dos buffs de Arauto, 25% mais dano dos lacaios de Arauto, auras desabilitadas e um Arauto só', { skip: SEM }, () => {
  const e = comPedra('Calamitous_Visions');
  const s = comPedra(null);
  for (const x of [e, s]) x.hunt.buffs['poe-gema:Herald_of_Ash'] = { ate: 1e12, desde: 0, tipo: 'poe-arauto', afPoe: { phys_as_extra_fire: 20 } };
  assert.equal(GemasPoe.adds(s).phys_as_extra_fire, 20);
  assert.equal(GemasPoe.adds(e).phys_as_extra_fire, 30);
  // os lacaios de Arauto (a Sentinela da Pureza); os outros não
  const pureza = (a) => Lacaios.oQueInvoca('Herald_of_Purity', 20, null, a);
  assert.ok(Math.abs(pureza({ 'lacaio_mais_dano:arauto': 25 }).dano.max / pureza({}).dano.max - 1.25) < 0.02);
  const zumbi = (a) => Lacaios.oQueInvoca('Raise_Zombie', 20, null, a);
  assert.equal(zumbi({ 'lacaio_mais_dano:arauto': 25 }).dano.max, zumbi({}).dano.max);
  // as auras: nenhuma de gema
  assert.deepEqual([...Acoes.auraPermitida(ficha(e))], []);
  assert.equal(Acoes.auraPermitida(ficha(s)), null);
  // um Arauto só: com o das Cinzas ligado, o do Gelo passa do limite (o mesmo pode religar); sem a pedra, os dois
  const gelo = 'poe-gema:Herald_of_Ice';
  assert.equal(Acoes.POR_ID_PUBLICO(gelo)?.poeGema?.arquetipo, 'arauto');
  assert.equal(Acoes.arautoExcedente(e.hunt, gelo, ficha(e)), true);
  assert.equal(Acoes.arautoExcedente(e.hunt, 'poe-gema:Herald_of_Ash', ficha(e)), false);
  assert.equal(Acoes.arautoExcedente(s.hunt, gelo, ficha(s)), false);
  // os dois ligados: o mais novo sai
  e.hunt.buffs[gelo] = { ate: 1e12, desde: 50, tipo: 'poe-arauto', afPoe: {} };
  assert.equal(Acoes.arautoExcedente(e.hunt, gelo, ficha(e)), true);
  assert.equal(Acoes.arautoExcedente(e.hunt, 'poe-gema:Herald_of_Ash', ficha(e)), false);
});

test('a PACIÊNCIA DA NATUREZA: 2 Vinhas por segundo parado, até 10 — 2% de Dano Dobrado e 1% menos dano sofrido cada; andou, voltam a 0', { skip: SEM }, () => {
  const e = comPedra('Natural_Affinity');
  const base = comPedra(null);
  const medir = (ms, moveu = null) => {
    for (const x of [e, base]) { x.hunt.poeEntrou = x.hunt.clock - ms; x.hunt.poeRecente = moveu != null ? { moveu: x.hunt.clock - moveu } : {}; }
    return [af(e, 'chance_dano_dobrado') - af(base, 'chance_dano_dobrado'), af(e, 'dano_recebido_mais') - af(base, 'dano_recebido_mais')];
  };
  assert.deepEqual(medir(0), [0, 0]);
  assert.deepEqual(medir(3000), [12, -6]);
  assert.deepEqual(medir(6000), [20, -10], 'o teto: 10 vinhas');
  assert.deepEqual(medir(6000, 300), [0, 0], 'andou agora');
});

test('os SEGREDOS DO SOFRIMENTO e o CINETICISMO (e o golpe básico de longe que perfurava com "não podem Perfurar")', { skip: SEM }, () => {
  const s = comPedra('The_Interrogation');
  for (const k of ['incendio', 'resfriamento', 'congelamento', 'eletrizacao']) assert.equal(af(s, `nao_pode:${k}`), 1, k);
  assert.equal(af(s, 'keystone_sofrimento'), 1);
  const c = comPedra('The_Siege');
  const proj = ModsPoe.fichaDoGolpe(ficha(c), ['ataque', 'projetil', 'fisico']);
  assert.equal(ModsPoe.valor(proj, 'chance_mutilar'), 100);
  assert.equal(ModsPoe.valor(proj, 'chance_empurrar'), 100);
  const corpo = ModsPoe.fichaDoGolpe(ficha(c), ['ataque', 'corpo', 'fisico']);
  assert.equal(ModsPoe.valor(corpo, 'chance_mutilar'), 0);
  assert.equal(af(c, 'projeteis_param'), 1);
  // o golpe básico de longe: os projéteis a mais valem; a perfuração, não
  assert.equal(ModsPoe.projeteisDoGolpeBasico({ afPoe: { extra_projectiles: 1, perfurar: 2, projeteis_param: 1 } }), 1);
  assert.equal(ModsPoe.projeteisDoGolpeBasico({ afPoe: { extra_projectiles: 1, perfurar: 2 } }), 3);
});

test('a ASTÚCIA DO VETERANO: com uma Guarda não Vaal, +10% às resistências e ao máximo e +20% de redução física; ela acabou há pouco, 20% mais dano sofrido', { skip: SEM }, () => {
  const e = comPedra('The_Front_Line');
  const base = comPedra(null);
  const guarda = (x, b) => { x.hunt.buffs = b ? { 'poe-gema:Steelskin': b } : {}; };
  guarda(e, { tipo: 'poe-guarda', guarda: true, ate: e.hunt.clock + 5000 });
  guarda(base, { tipo: 'poe-guarda', guarda: true, ate: base.hunt.clock + 5000 });
  for (const k of ['fire_res', 'ice_res', 'energy_res', 'fire_res_max', 'ice_res_max', 'energy_res_max']) assert.equal(af(e, k) - af(base, k), 10, k);
  assert.equal(af(e, 'phys_res') - af(base, 'phys_res'), 20);
  // a Vaal não conta; a do arquétipo sem a tag (Sangue e Areia) também não
  guarda(e, { tipo: 'poe-guarda', guarda: true, vaal: true, ate: e.hunt.clock + 5000 });
  assert.ok(!ModsPoe.condicoesDe(e).has('afetadoPorGuardaNaoVaal'));
  guarda(e, { tipo: 'poe-guarda', ate: e.hunt.clock + 5000 });
  assert.ok(!ModsPoe.condicoesDe(e).has('afetadoPorGuardaNaoVaal'));
  // acabou há 2 s: 20% mais dano sofrido; há 5 s: nada
  guarda(e, { tipo: 'poe-guarda', guarda: true, ate: e.hunt.clock - 2000 });
  guarda(base, {});
  assert.ok(Math.abs(ModsPoe.fatorDoDanoRecebido(ficha(e), 'fire') / ModsPoe.fatorDoDanoRecebido(ficha(base), 'fire') - 1.2) < 1e-9);
  guarda(e, { tipo: 'poe-guarda', guarda: true, ate: e.hunt.clock - 5000 });
  assert.ok(!ModsPoe.condicoesDe(e).has('guardaNaoVaalTerminouRecente'));
  assert.ok(ModsPoe.ehCondDeEstado('afetadoPorGuardaNaoVaal') && ModsPoe.ehCondDeEstado('guardaNaoVaalTerminouRecente'));
});

test('a TÉCNICA DA PALMA OCA: sem arma, nada na secundária e sem luvas — Dupla Empunhadura (o bônus, os dois punhos), 40% mais Velocidade de Ataque e o dano pela Destreza', { skip: SEM }, () => {
  const e = comPedra('One_With_Nothing');
  const base = comPedra(null);
  for (const x of [e, base]) x.equipment = {};
  const f = ficha(e);
  const b = ficha(base);
  assert.ok(ModsPoe.condicoesDe(e, f.afPoe).has('naoSobrecarregado'));
  assert.equal(f.duasArmas, true);
  assert.equal(f.ataqueSecundarioMin, f.ataqueMin);
  assert.ok(Math.abs(f.blockChance - b.blockChance - 0.15) < 1e-9, 'o +15% de bloqueio da Dupla Empunhadura');
  assert.ok(Math.abs(b.intervaloDoGolpeMs / f.intervaloDoGolpeMs - 1.4 * 1.1) < 0.02, `${b.intervaloDoGolpeMs} / ${f.intervaloDoGolpeMs}`);
  assert.ok(f.ataqueMin > b.ataqueMin, 'o dano pela Destreza');
  // com luvas, Sobrecarregado: nada disso
  const luvas = cat().classes.Gloves.bases[0];
  e.equipment = { gloves: J.pecaDoJogo(gerarPeca({ catalogo: cat(), regras: Catalogo.REGRAS, base: luvas.id, raridade: 'normal', ilvl: 1, rng: () => 0.5 })) };
  base.equipment = { gloves: e.equipment.gloves };
  const fl = ficha(e);
  assert.ok(!ModsPoe.condicoesDe(e, fl.afPoe).has('naoSobrecarregado'));
  assert.ok(!fl.duasArmas);
  assert.equal(fl.intervaloDoGolpeMs, ficha(base).intervaloDoGolpeMs);
});

test('o MENSAGEIRO desabilita também o Orgulho e os Estandartes (a tag Aura) e a maldição em aura; a Pureza conta como Arauto', { skip: SEM }, () => {
  const e = comPedra('Calamitous_Visions');
  e.actions = [];
  e.hunt.buffs = {};
  const so = Acoes.auraPermitida(ficha(e));
  assert.ok(so && so.size === 0);
  // Orgulho e o Estandarte de Guerra só trazem a tag Aura (o tipo vem vazio); a Graça, o tipo
  for (const slug of ['Pride', 'War_Banner', 'Grace']) assert.equal(Acoes.auraDesabilitada(Acoes.POR_ID_PUBLICO(`poe-gema:${slug}`), so), true, slug);
  // a maldição só em aura (a Blasfêmia); o Arauto não é aura
  const desespero = Acoes.POR_ID_PUBLICO('poe-gema:Despair');
  assert.equal(Acoes.auraDesabilitada(desespero, so), false);
  assert.equal(Acoes.auraDesabilitada(desespero, so, true), true);
  assert.equal(Acoes.auraDesabilitada(Acoes.POR_ID_PUBLICO('poe-gema:Herald_of_Ash'), so), false);
  // a Pureza: com um Arauto de buff ligado, ela não sai; com Sentinela dela em campo, o Arauto de buff é o excedente
  e.hunt.buffs = { 'poe-gema:Herald_of_Ash': { ate: 1e12, desde: 0, tipo: 'poe-arauto', afPoe: {} } };
  assert.equal(Acoes.arautoExcedente(e.hunt, 'poe-gema:Herald_of_Purity', ficha(e)), true);
  e.hunt.buffs = {};
  // (aval do dono 27/10, R3: a Pureza é Arauto de buff — lote R3B —, conta pelo buff ligado, não pela Sentinela em campo)
  e.hunt.buffs = { 'poe-gema:Herald_of_Purity': { ate: 1e12, desde: 5, tipo: 'poe-arauto', afPoe: {} }, 'poe-gema:Herald_of_Ash': { ate: 1e12, desde: 10, tipo: 'poe-arauto', afPoe: {} } };
  assert.equal(Acoes.arautoExcedente(e.hunt, 'poe-gema:Herald_of_Ash', ficha(e)), true);
  assert.equal(Acoes.arautoExcedente(e.hunt, 'poe-gema:Herald_of_Purity', ficha(e)), false, 'religar a própria Pureza');
});
