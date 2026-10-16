// ÉGIDE E AS PEQUENAS (dono, 14/10: o próximo bloco do item 4, "Égide e as pequenas"): a Égide Primitiva do Elementalist (e as Égides dos
// únicos, pelo mesmo caminho), a Infusão Mística do Assassin (o crítico mágico que Bifurca), os Robôs Ativadores do Saboteur e a Infusão
// Espiritual do Occultist — os números do PoE (poedb: Keywords, Primal_Aegis, Summon_Triggerbots, Spirit_Infusion; RePoE: as Égides).
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
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const M = await import('../systems/mobs/atributos.mjs');
const { contraAtaque } = await import('../systems/hunt/combate.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');

const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 70, rng: () => 0.5 }));
/** Um personagem do PoE numa caçada com uma varinha (`af` nela) e as `gemas` (nível 20) encaixadas e ligadas; `naBarra`: as da barra. */
function personagem({ af = {}, gemas = [], naBarra = gemas } = {}) {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 90 });
  e.sistema = 'poe';
  e.classePoe = 'Witch';
  const arma = peca('Wands/Driftwood_Wand');
  arma.poe.af = { ...(arma.poe.af ?? {}), ...af };
  const n = Math.max(1, gemas.length);
  arma.soquetes = { abertos: n, links: Array(Math.max(0, n - 1)).fill(true), gemas: Array(n).fill(null), cores: Array(n).fill('W') };
  e.equipment = { ...(e.equipment ?? {}), weapon: arma };
  e.inventory = gemas.map((s) => GS.itemDaGema({ id: G.doSlug(s).itemId, nivel: 20, xp: 0, raridade: 'comum' }));
  for (let i = 0; i < gemas.length; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  e.actions = Array(Acoes.SLOTS).fill(null);
  naBarra.forEach((s, i) => (e.actions[i] = { id: G.doSlug(s).acao, enabled: true, minMana: 0, conditions: [] }));
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 10_000;
  e.maxHp = e.hp = 1e6;
  P.garantir(e);
  return e;
}
const ficha = (e) => { Ficha.invalidar(e); return Ficha.combate(e); };
const soma = (e) => { Ficha.invalidar(e); return Afixos.soma(e); };
/** Aloca (na lista) os `n` primeiros Notáveis da árvore — para a conta da Égide Primitiva. */
const comNotaveis = (e, n) => { e.passivas.alocados = P.arvore().nos.filter((x) => x.tipo === 'notable' && !x.ascendencia).slice(0, n).map((x) => x.id); Ficha.invalidar(e); };

test('a ÁRVORE: as 7 linhas do bloco com efeito; nenhuma linha sem efeito na árvore (o Reliquarian, desde o lote 21)', { skip: SEM }, () => {
  const linhas = P.arvore().nos.flatMap((n) => [n, ...(n.opcoes ?? [])].flatMap((o) => (o.textos ?? []).map((t, i) => ({ t, estado: o.estados?.[i], nota: o.notas?.[i] ?? '', asc: n.ascendencia }))));
  const do20 = linhas.filter((l) => l.estado !== 'nota' && /Égide Primitiva|Outras Habilidades de Égides|golpe mágico crítico|Robôs Ativadores Nível|Infusão Espiritual a cada/.test(l.t));
  assert.equal(do20.length, 7);
  for (const l of do20) assert.ok(['novo', 'aproximado'].includes(l.estado), `${l.estado}: ${l.t}`);
  const semEfeito = linhas.filter((l) => ['inerte', 'registrado'].includes(l.estado) && !/^não se aplica ao jogo/.test(l.nota));
  // (dono, 14/10, "Ajustar a linha": o lote 21 deu efeito às 5 do Reliquarian — não sobra nenhuma)
  assert.deepEqual(semEfeito.map((l) => l.t), []);
});

test('a ÉGIDE PRIMITIVA: 75 por Notável alocado; toma o Fogo, o Gelo e o Raio dos acertos (não o Físico); esgotada, volta cheia 5 s depois do último dano elemental (lote 44: o PoB e o poedb — 5000 ms)', { skip: SEM }, () => {
  const e = personagem({ af: { egide_primitiva: 20, egide_primitiva_por_notavel: 75 } });
  comNotaveis(e, 4);
  assert.equal(Acoes.notaveisAlocados(e), 4);
  const h = e.hunt;
  const t0 = h.clock;
  Acoes.tiqueDasEgides(e, h, t0);
  const eg = h.egides.primitiva;
  assert.equal(eg.max, 300);
  assert.equal(eg.valor, 300);
  const porTipo = { fire: 200, physical: 100 };
  assert.equal(ModsPoe.absorverNaEgide(h, porTipo, t0), 200);
  assert.deepEqual(porTipo, { fire: 0, physical: 100 }, 'o Físico passa');
  const gelo = { ice: 150 };
  assert.equal(ModsPoe.absorverNaEgide(h, gelo, t0 + 1000), 100);
  assert.equal(gelo.ice, 50);
  assert.equal(eg.valor, 0);
  Acoes.tiqueDasEgides(e, h, t0 + 1000 + 4999);
  assert.equal(eg.valor, 0, 'ainda na espera');
  Acoes.tiqueDasEgides(e, h, t0 + 1000 + 5000);
  assert.equal(eg.valor, 300, 'volta cheia');
  // (o HUD)
  assert.ok(ModsPoe.buffsDoCliente(e).some((c) => c.nome === 'Égide Primitiva' && c.contador === 300));
  // (sem o nó, sai)
  e.equipment.weapon.poe.af.egide_primitiva = 0;
  Ficha.invalidar(e);
  Acoes.tiqueDasEgides(e, h, t0 + 20_000);
  assert.equal(h.egides, undefined);
});

test('a ÉGIDE no golpe do monstro: a parte de Fogo sai da Égide antes do Escudo e da Vida', { skip: SEM }, () => {
  const e = personagem({ af: { egide_primitiva: 20, egide_primitiva_por_notavel: 75 } });
  comNotaveis(e, 10);
  const h = e.hunt;
  Acoes.tiqueDasEgides(e, h, h.clock);
  const [m, ...outros] = h.monstros;
  for (const o of outros) Object.assign(o, { x: h.pos.x + 60, y: h.pos.y + 60 });
  Object.assign(m, { x: h.pos.x + 1, y: h.pos.y, hp: 1e9, maxHp: 1e9 });
  const antes = M.CONFIG.porEspecie.especies;
  M.CONFIG.porEspecie.especies = { ...(antes ?? {}), [m.key]: { ...(antes?.[m.key] ?? {}), danoExtra: [{ elemento: 'fire', min: 400, max: 400 }] } };
  const original = Math.random;
  const ev = [];
  try {
    Math.random = () => 0.5;
    for (let i = 0; i < 10 && !ev.some((x) => x.color === '#c8a2ff'); i++) contraAtaque(e, h, PERSONAGEM, m, ev);
  } finally { Math.random = original; M.CONFIG.porEspecie.especies = antes; }
  const daEgide = ev.filter((x) => x.t === 'dmg' && x.color === '#c8a2ff').reduce((n, x) => n + x.v, 0);
  assert.ok(daEgide > 0, JSON.stringify(ev.filter((x) => x.t === 'dmg').slice(0, 5)));
  assert.equal(h.egides.primitiva.valor, 750 - daEgide);
});

test('as ÉGIDES dos únicos (1000 do tipo; a Elemental 1000 no nível 20); "Outras Habilidades de Égides são Desabilitadas" as desliga; "enquanto a Égide Física estiver esgotada"', { skip: SEM }, () => {
  const e = personagem({ af: { egide_fogo: 20, egide_elemental: 20, egide_fisica: 20, 'crit_chance_inc@egideFisicaEsgotada': 60, 'atk_speed@egideFisicaEsgotada': 10 } });
  const h = e.hunt;
  Acoes.tiqueDasEgides(e, h, h.clock);
  assert.deepEqual(Object.keys(h.egides).sort(), ['elemental', 'fisica', 'fogo']);
  assert.equal(h.egides.fogo.max, 1000);
  assert.equal(h.egides.elemental.max, 1000);
  assert.deepEqual(h.egides.fisica.tipos, ['physical']);
  // (o Fogo: a de Fogo primeiro, depois a Elemental)
  const porTipo = { fire: 1500, physical: 300 };
  assert.equal(ModsPoe.absorverNaEgide(h, porTipo, h.clock), 1800);
  assert.equal(h.egides.fogo.valor, 0);
  assert.equal(h.egides.elemental.valor, 500);
  assert.equal(h.egides.fisica.valor, 700);
  // (a Física esgotada: as linhas "enquanto … esgotada" valem)
  const semNada = soma(e);
  assert.equal(semNada.atk_speed ?? 0, soma(personagem()).atk_speed ?? 0, 'com a Física de pé, não');
  ModsPoe.absorverNaEgide(h, { physical: 5000 }, h.clock);
  const esgotada = soma(e);
  assert.equal((esgotada.atk_speed ?? 0) - (semNada.atk_speed ?? 0), 10);
  assert.equal((esgotada.crit_chance_inc ?? 0) - (semNada.crit_chance_inc ?? 0), 60);
  // (a Primitiva desliga as outras)
  e.equipment.weapon.poe.af = { ...e.equipment.weapon.poe.af, egide_primitiva: 20, egide_primitiva_por_notavel: 75, egides_desabilitadas: 1 };
  Ficha.invalidar(e);
  Acoes.tiqueDasEgides(e, h, h.clock);
  assert.deepEqual(Object.keys(h.egides), ['primitiva']);
});

test('a INFUSÃO MÍSTICA: o crítico mágico Bifurca (duas rolagens; as duas dobram o dano extra do crítico; o "sempre crítico" não bifurca) e 30% menos chance de crítico mágico', { skip: SEM }, () => {
  const e = personagem({ af: { critico_magia_bifurca: 1, crit_magia_mais: -30 } });
  assert.equal(ficha(e).critMagiaPoe.mais, 0.7);
  const f = { ...ficha(e), critChance: 0.5, critMultiplier: 1.5, tagsDoGolpe: ['magia', 'habilidade'] };
  const alvo = { ...e.hunt.monstros[0], hp: 1e9, maxHp: 1e9 };
  const rolar = (sequencia, fx = f) => {
    const original = Math.random;
    let i = 0;
    Math.random = () => sequencia[i++] ?? 0.99;
    try { return Ficha.rolarCritico(e, 1000, alvo, [], fx); } finally { Math.random = original; }
  };
  const duas = rolar([0.1, 0.1]);
  const uma = rolar([0.1, 0.9]);
  const segunda = rolar([0.9, 0.1]);
  const nenhuma = rolar([0.9, 0.9]);
  assert.ok(duas.crit && duas.bifurcado);
  assert.ok(uma.crit && !uma.bifurcado);
  assert.ok(segunda.crit && !segunda.bifurcado, 'a segunda rolagem também crita');
  assert.ok(!nenhuma.crit);
  assert.ok(Math.abs(duas.dano / uma.dano - 2 / 1.5) < 0.01, `${duas.dano} / ${uma.dano}: 1 + 2 × 50% contra 150%`);
  // (o ataque não bifurca)
  assert.ok(!rolar([0.9, 0.1], { ...f, tagsDoGolpe: ['ataque'] }).crit);
  // (o "sempre crítico" não rola: não bifurca)
  const sempre = rolar([0.1, 0.1], { ...f, afPoe: { ...f.afPoe, critico_sempre: 1 } });
  assert.ok(sempre.crit && !sempre.bifurcado);
});

test('os ROBÔS ATIVADORES: dois robôs que não tomam dano; as Magias Ativadas saem duas vezes (a segunda ignora a recarga); sem o nó, saem', { skip: SEM }, () => {
  const e = personagem({ gemas: ['Spellslinger', 'Fireball'], naBarra: ['Spellslinger'], af: { robos_ativadores: 20 } });
  const h = e.hunt;
  Acoes.tiqueDosRobos(e, h);
  const robos = h.lacaios.filter((l) => l.robo && l.hp > 0);
  assert.equal(robos.length, 2);
  assert.ok(robos.every((l) => l.intocavel && l.semAtaque));
  const [b, ...outros] = h.monstros;
  for (const o of outros) Object.assign(o, { x: h.pos.x + 60, y: h.pos.y + 60 });
  Object.assign(b, { x: h.pos.x + 2, y: h.pos.y, hp: 1e9, maxHp: 1e9 });
  h.clock += 10_000;
  assert.ok(Acoes.disparar(e, h, PERSONAGEM, 0, b, {}).ok, 'o Feiticeiro liga');
  const eventos = [];
  assert.equal(Acoes.ativarGatilhos(e, h, PERSONAGEM, 'ataqueDeVarinha', { alvo: b }, eventos), 2);
  assert.deepEqual(eventos.filter((x) => x.t === 'gatilho').map((x) => x.suporte), ['Feiticeiro', 'Robô Ativador']);
  // (na caçada: os robôs ao lado dos bichos não perdem vida)
  for (const r of robos) Object.assign(r, { x: b.x, y: b.y + 1 });
  let t = Date.now();
  for (let i = 0; i < 20; i++) Cacadas.tique(e, PERSONAGEM, (t += 250));
  assert.ok(robos.every((r) => r.hp === r.maxHp), 'intocáveis');
  // (sem o nó: saem; o gatilho volta a ser um)
  e.equipment.weapon.poe.af.robos_ativadores = 0;
  Ficha.invalidar(e);
  Acoes.tiqueDosRobos(e, h);
  assert.equal(h.lacaios.filter((l) => l.robo && l.hp > 0).length, 0);
  h.clock += 10_000;
  assert.equal(Acoes.ativarGatilhos(e, h, PERSONAGEM, 'ataqueDeVarinha', { alvo: b }, []), 1);
});

test('a INFUSÃO ESPIRITUAL: ao canalizar uma magia, um acúmulo a cada 0,5 s, até 10; perde um a cada 0,5 s sem ganhar há 4 s; 15% de início mais rápido da Recarga do Escudo, 5% mais Dano e 10% mais Custo nas Magias Canalizadas por acúmulo', { skip: SEM }, () => {
  const e = personagem({ gemas: ['Blight'], af: { infusao_espiritual: 1 } });
  const h = e.hunt;
  const af = ficha(e).afPoe;
  // (a Magia de Canalização usada marca o "canalizando uma magia")
  const [b, ...outros] = h.monstros;
  for (const o of outros) Object.assign(o, { x: h.pos.x + 60, y: h.pos.y + 60 });
  Object.assign(b, { x: h.pos.x + 2, y: h.pos.y, hp: 1e9, maxHp: 1e9 });
  h.clock += 10_000;
  const r = Acoes.disparar(e, h, PERSONAGEM, 0, b, {});
  if (r.conjurando) { h.clock += 3000; Acoes.concluirConjuracao(e, h, PERSONAGEM); }
  // (o dono, 16/10 — lote 42, "Fazer todos": a CANALIZAÇÃO CONTÍNUA — o canalizar vai do começo ao fim do uso do Flagelo, e o Flagelo usado de
  // novo em seguida o continua; o 1º acúmulo vem 0,5 s depois de começar. Antes: um acúmulo na hora e 1 s fixo depois de cada uso.)
  assert.ok(h.canalizacao?.magia && ModsPoe.canalizandoAgora(h, h.canalizacao.desde, { magia: true }), JSON.stringify(r).slice(0, 200));
  const t0 = h.canalizacao.desde;
  h.canalizacao.ate = t0 + 1000; // (o Flagelo de novo em seguida: um canalizar de 1 s)
  ModsPoe.tiqueDaInfusao(h, af, t0);
  assert.equal(h.infusaoEspiritual?.n ?? 0, 0, 'na hora, ainda não');
  ModsPoe.tiqueDaInfusao(h, af, t0 + 500);
  assert.equal(h.infusaoEspiritual.n, 1, 'a cada 0,5 s');
  ModsPoe.tiqueDaInfusao(h, af, t0 + 750);
  assert.equal(h.infusaoEspiritual.n, 1);
  ModsPoe.tiqueDaInfusao(h, af, t0 + 1000);
  assert.equal(h.infusaoEspiritual.n, 2);
  ModsPoe.tiqueDaInfusao(h, af, t0 + 1500);
  assert.equal(h.infusaoEspiritual.n, 2, 'acabou o canalizar: não ganha mais');
  // (até 10: um canalizar contínuo longo)
  h.canalizacao = { ...h.canalizacao, desde: t0 + 2000, ate: t0 + 2000 + 29 * 500 };
  for (let i = 0; i < 30; i++) ModsPoe.tiqueDaInfusao(h, af, t0 + 2000 + i * 500);
  assert.equal(h.infusaoEspiritual.n, 10);
  // (os efeitos de 10 acúmulos)
  h.clock = t0 + 2000 + 29 * 500;
  const s = soma(e);
  const sem = soma(personagem({ gemas: ['Blight'] }));
  assert.equal((s.es_recharge_start ?? 0) - (sem.es_recharge_start ?? 0), 150);
  const porTag = ModsPoe.somaPorTags(ficha(e), ['canalizar', 'magia']);
  assert.equal(porTag.mais_dano, 50);
  assert.equal(porTag.custo_mana_mais, 100);
  assert.equal(ModsPoe.somaPorTags(ficha(e), ['magia']).mais_dano ?? 0, 0, 'só nas Canalizadas');
  // (sem ganhar há 4 s: perde um a cada 0,5 s)
  const ultimo = h.infusaoEspiritual.ultimoGanho;
  ModsPoe.tiqueDaInfusao(h, af, ultimo + 4000);
  assert.equal(h.infusaoEspiritual.n, 10);
  ModsPoe.tiqueDaInfusao(h, af, ultimo + 4001);
  assert.equal(h.infusaoEspiritual.n, 9);
  ModsPoe.tiqueDaInfusao(h, af, ultimo + 4200);
  assert.equal(h.infusaoEspiritual.n, 9);
  ModsPoe.tiqueDaInfusao(h, af, ultimo + 4501);
  assert.equal(h.infusaoEspiritual.n, 8);
  assert.ok(ModsPoe.buffsDoCliente(e).some((c) => c.nome === 'Infusão Espiritual' && c.contador === 8));
});
