// O RELIQUARIAN (dono, 14/10: "Reliquarian" — as 5 últimas linhas sem efeito da árvore): a Rajada Vulcânica, o Grande Emissário das Direções,
// o Poder Fantasmal (com o suporte Convocar Fantasma, que passa a convocar), Erguer Aranhas e Suspender no Tempo — e os únicos que dão as mesmas
// habilidades. Os números do PoE: poedb (Molten_Burst, Raise_Spiders, Suspend_in_Time, Summon_Greater_Harbinger_of_Directions,
// Summon_Phantasm_Support, Phantasmal_Might) e RePoE.
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
const SuportesPoe = await import('../systems/itens-poe/suportes-poe.mjs');
const Secundarios = await import('../systems/skills/golpes-secundarios.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');

const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 70, rng: () => 0.5 }));
/** Um personagem do PoE numa caçada com a arma `base` (`af` nela) e as `gemas` (nível 20) encaixadas e ligadas, na barra. */
function personagem({ base = 'Wands/Driftwood_Wand', af = {}, gemas = [] } = {}) {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 90 });
  e.sistema = 'poe';
  e.classePoe = 'Witch';
  const arma = peca(base);
  arma.poe.af = { ...(arma.poe.af ?? {}), ...af };
  const n = Math.max(1, gemas.length);
  arma.soquetes = { abertos: n, links: Array(Math.max(0, n - 1)).fill(true), gemas: Array(n).fill(null), cores: Array(n).fill('W') };
  e.equipment = { ...(e.equipment ?? {}), weapon: arma };
  e.inventory = gemas.map((s) => GS.itemDaGema({ id: G.doSlug(s).itemId, nivel: 20, xp: 0, raridade: 'comum' }));
  for (let i = 0; i < gemas.length; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  e.actions = Array(Acoes.SLOTS).fill(null);
  gemas.forEach((s, i) => (e.actions[i] = { id: G.doSlug(s).acao, enabled: true, minMana: 0, conditions: [] }));
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 10_000;
  e.maxHp = e.hp = 1e6;
  P.garantir(e);
  return e;
}
const ficha = (e) => { Ficha.invalidar(e); return Ficha.combate(e); };
const soma = (e) => { Ficha.invalidar(e); return Afixos.soma(e); };
/** Os bichos da caçada: o primeiro a `dx` casas, um segundo colado nele, os outros longe — com vida de sobra. */
function bichos(e, dx = 1) {
  const h = e.hunt;
  const [a, b, ...outros] = h.monstros;
  for (const o of outros) Object.assign(o, { x: h.pos.x + 60, y: h.pos.y + 60 });
  Object.assign(a, { x: h.pos.x + dx, y: h.pos.y, hp: 1e9, maxHp: 1e9, estados: {}, dots: [] });
  Object.assign(b, { x: h.pos.x + dx + 1, y: h.pos.y, hp: 1e9, maxHp: 1e9, estados: {}, dots: [] });
  return [a, b];
}

test('a ÁRVORE: as 5 linhas do Reliquarian com efeito — nenhuma linha sem efeito na árvore', { skip: SEM }, () => {
  const linhas = P.arvore().nos.flatMap((n) => [n, ...(n.opcoes ?? [])].flatMap((o) => (o.textos ?? []).map((t, i) => ({ t, estado: o.estados?.[i], nota: o.notas?.[i] ?? '', asc: n.ascendencia }))));
  const do21 = linhas.filter((l) => l.asc === 'Reliquarian' && l.estado !== 'nota' && /Rajada Vulcânica|Emissário das Direções|Poder Fantasmal|Erguer Aranhas|Suspender no Tempo/.test(l.t));
  assert.equal(do21.length, 5);
  for (const l of do21) assert.ok(['novo', 'aproximado'].includes(l.estado), `${l.estado}: ${l.t}`);
  const semEfeito = linhas.filter((l) => ['inerte', 'registrado'].includes(l.estado) && !/^não se aplica ao jogo/.test(l.nota));
  assert.deepEqual(semEfeito.map((l) => l.t), []);
});

test('a RAJADA VULCÂNICA: no acerto corpo a corpo (100% no nível 20, 20% no 16), recarga de 0,15 s; 4 projéteis de magma em área, 60% do Físico em Fogo', { skip: SEM }, () => {
  const e = personagem({ base: 'Two_Hand_Axes/Vaal_Axe', af: { rajada_vulcanica: 20 } });
  const h = e.hunt;
  const [a, b] = bichos(e);
  const eventos = [];
  const total = Acoes.rajadaVulcanica(e, h, a, eventos, () => 0);
  assert.ok(total > 0);
  assert.equal(eventos.filter((x) => x.t === 'shot').length, 4);
  // (rng 0: os 4 caem no primeiro bicho perto — a área pega ele e o vizinho; cada bicho leva 4 golpes iguais, pela resistência dele — a
  // raridade de cada um é sorteada ao entrar)
  const golpes = eventos.filter((x) => x.t === 'dmg');
  assert.equal(golpes.length, 8);
  for (const m of [a, b]) {
    const dele = golpes.filter((x) => x.uid === m.uid);
    assert.equal(dele.length, 4);
    assert.ok(dele.every((x) => x.v === dele[0].v && x.v > 0));
    assert.equal(1e9 - m.hp, 4 * dele[0].v);
  }
  assert.equal(Acoes.rajadaVulcanica(e, h, a, [], () => 0), 0, 'na recarga');
  h.clock += 150;
  assert.ok(Acoes.rajadaVulcanica(e, h, a, [], () => 0) > 0);
  // (o nível 16: 20%)
  e.equipment.weapon.poe.af.rajada_vulcanica = 16;
  Ficha.invalidar(e);
  h.clock += 150;
  assert.equal(Acoes.rajadaVulcanica(e, h, a, [], () => 0.25), 0);
  assert.ok(Acoes.rajadaVulcanica(e, h, a, [], () => 0.15) > 0);
  // (sem o nó, nada)
  e.equipment.weapon.poe.af.rajada_vulcanica = 0;
  Ficha.invalidar(e);
  h.clock += 1000;
  assert.equal(Acoes.rajadaVulcanica(e, h, a, [], () => 0), 0);
});

test('a RAJADA VULCÂNICA na caçada: o golpe básico corpo a corpo que acerta a dispara', { skip: SEM }, () => {
  const e = personagem({ base: 'Two_Hand_Axes/Vaal_Axe', af: { rajada_vulcanica: 20 } });
  const h = e.hunt;
  bichos(e);
  let t = Date.now();
  for (let i = 0; i < 40 && !h.poeRajadaAte; i++) Cacadas.tique(e, PERSONAGEM, (t += 250));
  assert.ok(h.poeRajadaAte > 0, 'saiu');
});

test('ERGUER ARANHAS: ao matar (a chance; recarga de 2 s), 2 aranhas de cada cadáver a até 4 casas (até 20, 30 s), imunes, que envenenam; +2% de Velocidade de Ataque e +15% de Dano com Veneno cada', { skip: SEM }, () => {
  const e = personagem({ af: { erguer_aranhas: 20, erguer_aranhas_chance: 100 } });
  const h = e.hunt;
  const [a] = bichos(e, 2);
  h.cadaveres = [0, 1, 2].map((i) => ({ key: 'rat', nome: 'Rato', x: h.pos.x + i, y: h.pos.y + 1 }));
  h.cadaveres.push({ key: 'rat', nome: 'Longe', x: h.pos.x + 10, y: h.pos.y });
  const antes = soma(e);
  const t0 = 5_000_000;
  ModsPoe.evento(e, h, 'matar', ficha(e), { alvo: a });
  Acoes.tiqueDasAranhas(e, h, t0, () => 0);
  const aranhas = () => h.lacaios.filter((l) => l.aranha && l.hp > 0);
  assert.equal(aranhas().length, 6);
  assert.ok(aranhas().every((l) => l.intocavel && l.envenenar && l.ate === t0 + 30_000));
  assert.deepEqual(h.cadaveres.map((c) => c.nome), ['Longe'], 'os cadáveres perto foram consumidos');
  const s = soma(e);
  assert.equal((s.atk_speed ?? 0) - (antes.atk_speed ?? 0), 12);
  assert.equal((s.poison_dmg_inc ?? 0) - (antes.poison_dmg_inc ?? 0), 90);
  // (na recarga, o abate não ergue; depois, sim — até 20)
  h.cadaveres = Array.from({ length: 10 }, (_, i) => ({ key: 'rat', nome: `r${i}`, x: h.pos.x, y: h.pos.y + 1 }));
  ModsPoe.evento(e, h, 'matar', ficha(e), { alvo: a });
  Acoes.tiqueDasAranhas(e, h, t0 + 1000, () => 0);
  assert.equal(aranhas().length, 6);
  ModsPoe.evento(e, h, 'matar', ficha(e), { alvo: a });
  Acoes.tiqueDasAranhas(e, h, t0 + 2000, () => 0);
  assert.equal(aranhas().length, 20);
  // (a chance da linha: 0% não ergue)
  e.equipment.weapon.poe.af.erguer_aranhas_chance = 0;
  Ficha.invalidar(e);
  for (const l of aranhas()) l.hp = 0;
  h.cadaveres = [{ key: 'rat', nome: 'Rato', x: h.pos.x, y: h.pos.y + 1 }];
  ModsPoe.evento(e, h, 'matar', ficha(e), { alvo: a });
  Acoes.tiqueDasAranhas(e, h, t0 + 10_000, () => 0);
  assert.equal(aranhas().length, 0);
});

test('as ARANHAS na caçada: atacam e envenenam o bicho; acabam em 30 s', { skip: SEM }, () => {
  const e = personagem({ af: { erguer_aranhas: 20, erguer_aranhas_chance: 100 } });
  const h = e.hunt;
  const [a] = bichos(e, 2);
  let t = Date.now();
  Cacadas.tique(e, PERSONAGEM, t);
  h.cadaveres = [{ key: 'rat', nome: 'Rato', x: a.x, y: a.y + 1 }];
  ModsPoe.evento(e, h, 'matar', ficha(e), { alvo: a });
  Acoes.tiqueDasAranhas(e, h, t, () => 0);
  assert.equal(h.lacaios.filter((l) => l.aranha).length, 2);
  for (let i = 0; i < 40 && !(a.dots ?? []).some((d) => d.tipo === 'venenoPoe'); i++) Cacadas.tique(e, PERSONAGEM, (t += 250));
  assert.ok((a.dots ?? []).some((d) => d.tipo === 'venenoPoe'), 'o veneno das aranhas');
  for (const l of h.lacaios.filter((x) => x.aranha)) l.ate = t + 100;
  Cacadas.tique(e, PERSONAGEM, (t += 250));
  assert.equal(h.lacaios.filter((l) => l.aranha && l.hp > 0).length, 0, 'acabaram');
});

test('SUSPENDER NO TEMPO: cada magia não instantânea cria uma Miragem; na terceira, as três soltam a magia (50% menos dano no nível 1, 20% no 20)', { skip: SEM }, () => {
  assert.equal(Acoes.menosDaMiragem(1), 50);
  assert.equal(Acoes.menosDaMiragem(20), 20);
  const e = personagem({ gemas: ['Fireball'], af: { suspender_no_tempo: 1 } });
  const h = e.hunt;
  const [a] = bichos(e, 3);
  // (a Miragem dura 5 s: as três conjurações dentro disso)
  const lancar = () => {
    h.clock += 1000;
    const r = Acoes.disparar(e, h, PERSONAGEM, 0, a, {});
    if (r.conjurando) { h.clock += 1000; return Acoes.concluirConjuracao(e, h, PERSONAGEM); }
    return r.eventos ?? [];
  };
  lancar();
  assert.equal(h.miragens?.length, 1);
  lancar();
  assert.equal(h.miragens?.length, 2);
  const eventos = lancar();
  const lista = Array.isArray(eventos) ? eventos : eventos?.eventos ?? [];
  assert.equal(h.miragens, undefined, 'soltaram');
  assert.equal(lista.filter((x) => x.t === 'gatilho' && x.suporte === 'Miragem Suspensa').length, 3, JSON.stringify(lista.map((x) => x.t)).slice(0, 300));
});

test('o GRANDE EMISSÁRIO DAS DIREÇÕES: sai sozinho (imortal); a cada 6 s, um buff de 6 s ao acaso — +2 Projéteis, +2 Ricochetes, +2 Perfurações, Difundir duas vezes, ou todos', { skip: SEM }, () => {
  const e = personagem({ af: { emissario_direcoes: 1 } });
  const h = e.hunt;
  const t0 = h.clock;
  const antes = soma(e);
  Acoes.tiqueDoEmissario(e, h, t0, () => 0);
  assert.ok(h.lacaios.some((l) => l.emissario && l.intocavel && l.semAtaque));
  assert.equal(h.poeBuffs.emissarioProjeteis, t0 + 6000);
  assert.equal((soma(e).extra_projectiles ?? 0) - (antes.extra_projectiles ?? 0), 2);
  Acoes.tiqueDoEmissario(e, h, t0 + 3000, () => 0.99);
  assert.equal(h.poeBuffs.emissarioTodos, undefined, 'só a cada 6 s');
  Acoes.tiqueDoEmissario(e, h, t0 + 6000, () => 0.99);
  assert.equal(h.poeBuffs.emissarioProjeteis, undefined, 'o anterior sai');
  h.clock = t0 + 6000;
  const s = soma(e);
  for (const k of ['extra_projectiles', 'ricochetes', 'perfurar', 'bifurcar']) assert.equal((s[k] ?? 0) - (antes[k] ?? 0), 2, k);
  assert.ok(ModsPoe.buffsDoCliente(e).some((c) => c.nome === 'Direções: Todos'));
  // ("Difundem e Difundem de novo": os filhos difundem outra vez)
  const b = (x, y, uid) => ({ uid, x, y, hp: 10 });
  const campo = [b(2, 0, 'a'), b(3, 1, 'b'), b(3, -1, 'c'), b(4, 2, 'd'), b(4, 0, 'e'), b(4, -2, 'f'), b(5, 1, 'g'), b(5, -1, 'h')];
  const uma = Secundarios.resolver({ efeito: { bifurcar: 2 }, tags: ['projectile', 'single'], origem: { x: 0, y: 0 }, alvo: campo[0], atingidos: [campo[0]], vivos: campo, alcance: 8 });
  const duas = Secundarios.resolver({ efeito: { bifurcar: 2, bifurcarDeNovo: 1 }, tags: ['projectile', 'single'], origem: { x: 0, y: 0 }, alvo: campo[0], atingidos: [campo[0]], vivos: campo, alcance: 8 });
  assert.equal(uma.golpes.filter((g) => g.tipo === 'bifurcacao').length, 2);
  assert.ok(duas.golpes.filter((g) => g.tipo === 'bifurcacao').length > 2, 'os filhos difundem de novo');
  // (sem o nó, o Emissário sai)
  e.equipment.weapon.poe.af.emissario_direcoes = 0;
  Ficha.invalidar(e);
  Acoes.tiqueDoEmissario(e, h, t0 + 20_000);
  assert.ok(!h.lacaios.some((l) => l.emissario && l.hp > 0));
});

test('o CONVOCAR FANTASMA e o PODER FANTASMAL: o suporte convoca no golpe fatal e no Raro/Único (até o máximo, 15 s); cada Fantasma vivo dá o golpe dele como Dano Físico Mágico Adicional', { skip: SEM }, () => {
  const suporte = SuportesPoe.efeitoNoNivel('Summon_Phantasm_Support', 20);
  assert.deepEqual({ ...suporte.efeito, custoPct: undefined }, { custoPct: undefined, fantasmaAoMatarPct: 69, fantasmaMax: 10, fantasmaRaroPct: 20, fantasmaDuracaoMs: 15000 });
  assert.deepEqual(suporte.naoFeitas, []);
  const e = personagem({ af: { poder_fantasmal: 1 } });
  const h = e.hunt;
  const [a, b] = bichos(e, 2);
  const mortos = [{ ...a, hp: 0 }, { ...b, hp: 0 }, { ...a, uid: 'x', hp: 0 }];
  const efeito = { fantasmaAoMatarPct: 100, fantasmaMax: 2, fantasmaDuracaoMs: 15000 };
  assert.equal(Acoes.convocarFantasmas(e, h, efeito, mortos, () => 0), 3);
  const fantasmas = () => h.lacaios.filter((l) => l.fantasma && l.hp > 0);
  assert.equal(fantasmas().length, 2, 'o máximo: o mais velho sai');
  assert.ok(fantasmas().every((l) => l.alcanceDeAtaque === 4 && l.duracaoMs === 15000));
  // (o Raro/Único acertado)
  assert.equal(Acoes.convocarFantasmas(e, h, { fantasmaRaroPct: 100, fantasmaMax: 10 }, [{ ...a, raridade: 'raro' }], () => 0), 1);
  // (o Poder Fantasmal: o golpe de cada Fantasma vivo, somado)
  const s = soma(e);
  const vivos = fantasmas();
  assert.equal(s.spell_added_physical_dmg_min, vivos.reduce((n, l) => n + l.dano.min, 0));
  assert.equal(s.spell_added_physical_dmg_max, vivos.reduce((n, l) => n + l.dano.max, 0));
  // (sem o nó, os Fantasmas não dão nada)
  e.equipment.weapon.poe.af.poder_fantasmal = 0;
  assert.equal(soma(e).spell_added_physical_dmg_min ?? 0, 0);
});
