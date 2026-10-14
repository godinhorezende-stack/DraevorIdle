// O GUARDIAN (dono, 14/10: o próximo bloco do item 4, "Guardian"): a Chama Santificada (o Marechal da Divindade e o "Efeito da Chama
// Santificada"), o Sentinela do Resplendor (a Cruzada Radiante) e a Relíquia Elemental (a Cruzada Implacável) — os números do nível 20 do PoE
// (poedb). As habilidades saem sozinhas (o jogo usa as habilidades sozinho). E o Ódio, que passa a dar o "Físico como Gelo extra" dele.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
const Acoes = await import('../systems/acoes.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Arvore = await import('../systems/arvore.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const LacaiosPoe = await import('../systems/itens-poe/lacaios-poe.mjs');
const GemasPoe = await import('../systems/itens-poe/gemas-poe.mjs');
const { resistido } = await import('../systems/hunt/resistencia.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');

const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 70, rng: () => 0.5 }));
/** Um personagem do PoE numa caçada, com `af` na varinha. */
function personagem(af = {}) {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 80 });
  e.sistema = 'poe';
  e.classePoe = 'Templar';
  const arma = peca('Wands/Driftwood_Wand');
  arma.poe.af = { ...(arma.poe.af ?? {}), ...af };
  e.equipment = { ...(e.equipment ?? {}), weapon: arma };
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  e.actions = Array(Acoes.SLOTS).fill(null);
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.clock = 100_000;
  e.maxHp = e.hp = 1e6;
  P.garantir(e);
  return e;
}
/** A party: `dono` e os `aliados` na mesma sala, a `dx` casas dele (um a mais por aliado). */
function party(dono, aliados, dx = 2) {
  const membros = [{ estado: dono, nome: 'Ana' }, ...aliados.map((a, i) => ({ estado: a, nome: `Amiga${i}` }))];
  const naSala = membros.map((m) => m.estado);
  aliados.forEach((a, i) => { a.hunt.pos = { ...dono.hunt.pos, x: dono.hunt.pos.x + dx + i }; a.hunt.z = dono.hunt.z; a.hunt.clock = dono.hunt.clock; });
  for (const m of membros) m.estado.hunt.partilha = { ativa: true, bonus: 1, membros, naSala };
}
const ficha = (e) => { Ficha.invalidar(e); return Ficha.combate(e); };
const soma = (e) => { Ficha.invalidar(e); return Afixos.soma(e); };
/** Um bicho da caçada a `dx` casas do personagem (os outros, longe), com vida de sobra. */
function bichoPerto(e, dx = 1) {
  const [b, ...outros] = e.hunt.monstros;
  for (const o of outros) Object.assign(o, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60 });
  Object.assign(b, { x: e.hunt.pos.x + dx, y: e.hunt.pos.y, hp: 1e9, maxHp: 1e9, estados: {} });
  return b;
}

test('a ÁRVORE: as 7 linhas do Guardian com efeito (o Sentinela e a Relíquia, aproximados — o PoE não publica a vida dos lacaios)', { skip: SEM }, () => {
  const linhas = P.arvore().nos.filter((n) => n.ascendencia === 'Guardian').flatMap((n) => n.textos.map((t, i) => ({ t, estado: n.estados[i], nota: n.notas?.[i] })))
    .filter((l) => l.estado !== 'nota' && /Chamas? Santificadas?|Sentinela do Resplendor|Relíquia Elemental/.test(l.t));
  assert.equal(linhas.length, 7);
  for (const l of linhas) assert.ok(['novo', 'aproximado'].includes(l.estado), `${l.estado}: ${l.t}`);
  const aproximadas = linhas.filter((l) => l.estado === 'aproximado');
  assert.deepEqual(aproximadas.map((l) => /Convocar Sentinela|Relíquia Elemental/.test(l.t)), [true, true]);
  for (const l of aproximadas) assert.ok(l.nota, `a nota no balão: ${l.t}`);
});

test('a CHAMA SANTIFICADA: o acerto corpo a corpo a põe (6 s, +1 Chama, intensidade +20%); não beneficia quem pôs; o Ataque do aliado leva o Fogo extra e a tira; quem pôs ganha Raio extra por Chama removida (até 80%)', { skip: SEM }, () => {
  const ana = personagem({ chama_santificada_corpo: 1, chama_santificada_extra: 1, chama_santificada_efeito: 20, chama_santificada_raio: 10, chama_santificada_raio_max: 80 });
  const bia = personagem();
  party(ana, [bia]);
  const h = ana.hunt;
  const b = bichoPerto(ana);
  const t0 = h.clock;
  const f = ficha(ana);
  // (pelo acerto: só o corpo a corpo)
  ModsPoe.aoAcertar(ana, h, b, { ...f, tagsDoGolpe: ['ataque', 'projetil'] }, { dano: 1, agora: t0 });
  assert.equal(b.estados.chamas?.length ?? 0, 0, 'à distância, não');
  ModsPoe.aoAcertar(ana, h, b, { ...f, tagsDoGolpe: ['ataque', 'corpo'] }, { dano: 1, agora: t0 });
  assert.equal(b.estados.chamas.length, 1);
  assert.equal(b.estados.chamas[0].pct, 30, '25% × 1,2');
  assert.equal(b.estados.chamas[0].ate, t0 + 6000);
  ModsPoe.porChamaSantificada(h, b, f.afPoe, t0 + 100);
  ModsPoe.porChamaSantificada(h, b, f.afPoe, t0 + 200);
  assert.equal(b.estados.chamas.length, 2, '1 + "+1 Chama": a terceira renova a mais velha');
  assert.deepEqual(b.estados.chamas.map((c) => c.ate).sort(), [t0 + 6100, t0 + 6200]);
  // (quem pôs não se beneficia)
  assert.equal(ModsPoe.consumirChamas(ana, b, ModsPoe.idDaChama(h), t0 + 300), 0);
  assert.equal(b.estados.chamas.length, 2);
  // (o Ataque da companheira: as duas, e saem; cada uma conta para quem pôs)
  const antes = soma(ana).phys_as_extra_energy ?? 0;
  assert.equal(ModsPoe.consumirChamas(bia, b, ModsPoe.idDaChama(bia.hunt), t0 + 300), 60);
  assert.equal(b.estados.chamas.length, 0);
  assert.equal(h.poeChamasRemovidas.length, 2);
  h.clock = t0 + 300;
  assert.equal((soma(ana).phys_as_extra_energy ?? 0) - antes, 20, '10% por Chama removida');
  h.poeChamasRemovidas.push(...Array(10).fill(t0 + 300));
  assert.equal((soma(ana).phys_as_extra_energy ?? 0) - antes, 80, 'até 80%');
  h.clock = t0 + 300 + 4001;
  assert.equal((soma(ana).phys_as_extra_energy ?? 0) - antes, 0, 'passado o "recentemente" (4 s), nada');
  // (o lacaio — até o seu — é um aliado; a Chama que acabou não conta)
  ModsPoe.porChamaSantificada(h, b, f.afPoe, t0 + 1000);
  assert.equal(ModsPoe.consumirChamas(ana, b, `lacaio:${ModsPoe.idDaChama(h)}`, t0 + 1100), 30);
  ModsPoe.porChamaSantificada(h, b, f.afPoe, t0 + 1000);
  assert.equal(ModsPoe.consumirChamas(bia, b, ModsPoe.idDaChama(bia.hunt), t0 + 7001), 0, 'acabou (6 s)');
});

test('o SENTINELA DO RESPLENDOR: sai sozinho com o nó (0,75 s), volta depois de morrer, sai sem o nó; queima a até 2 casas (20% da vida por segundo, como Fogo); 20% do dano dos acertos na vida dele antes da sua', { skip: SEM }, () => {
  const e = personagem({ sentinela_do_resplendor: 20, sentinela_absorve: 20 });
  const h = e.hunt;
  const t0 = 5_000_000;
  const sentinelas = () => h.lacaios.filter((l) => l.sentinela && l.hp > 0);
  Acoes.tiqueDoGuardian(e, h, t0);
  Acoes.tiqueDoGuardian(e, h, t0 + 749);
  assert.equal(sentinelas().length, 0, 'o tempo de conjuração');
  Acoes.tiqueDoGuardian(e, h, t0 + 750);
  assert.equal(sentinelas().length, 1);
  const s = sentinelas()[0];
  assert.equal(s.maxHp, Math.round(LacaiosPoe.forcaDoNivel(80).vida));
  Acoes.tiqueDoGuardian(e, h, t0 + 1000);
  assert.equal(sentinelas().length, 1, 'só um');
  // (a queima: a até 2 casas, não a 3)
  const perto = bichoPerto(e, 2);
  const longe = h.monstros.find((m) => m !== perto);
  Object.assign(longe, { x: s.x + 3, y: s.y, hp: 1e9, maxHp: 1e9 });
  Object.assign(perto, { x: s.x + 2, y: s.y });
  const f = ficha(e);
  const eventos = Acoes.queimaDoSentinela(h, s, f, 250);
  assert.equal(1e9 - perto.hp, Math.round(resistido(h, perto, 'fire', (s.maxHp * 0.2) / 4, f)));
  assert.equal(longe.hp, 1e9);
  assert.equal(eventos.length, 1);
  // (o dano dos acertos: 20% na vida dele)
  const vidaAntes = s.hp;
  const com = Arvore.danoRecebido(e, 1000, [], h.pos, 'x', { ficha: f });
  const tirado = vidaAntes - s.hp;
  assert.equal(tirado, 200);
  s.hp = 0;
  const sem = Arvore.danoRecebido(e, 1000, [], h.pos, 'x', { ficha: f });
  assert.equal(sem - com, tirado, 'sem o Sentinela, tudo em você');
  // (morto: volta 0,75 s depois)
  Acoes.tiqueDoGuardian(e, h, t0 + 2000);
  assert.equal(sentinelas().length, 0);
  Acoes.tiqueDoGuardian(e, h, t0 + 2750);
  assert.equal(sentinelas().length, 1, 'voltou');
  // (sem o nó, sai)
  e.equipment.weapon.poe.af = {};
  Ficha.invalidar(e);
  Acoes.tiqueDoGuardian(e, h, t0 + 3000);
  assert.equal(sentinelas().length, 0);
});

test('o SENTINELA na caçada: aparece, ataca o bicho com as Chamas do dono (um aliado) e as tira', { skip: SEM }, () => {
  const e = personagem({ sentinela_do_resplendor: 20, chama_santificada_corpo: 1, chama_santificada_raio: 10, chama_santificada_raio_max: 80 });
  const h = e.hunt;
  const b = bichoPerto(e, 1);
  let t = Date.now();
  Cacadas.tique(e, PERSONAGEM, t);
  for (let i = 0; i < 4; i++) Cacadas.tique(e, PERSONAGEM, (t += 250));
  const s = h.lacaios.find((l) => l.sentinela && l.hp > 0);
  assert.ok(s, 'o Sentinela saiu sozinho');
  ModsPoe.porChamaSantificada(h, b, ficha(e).afPoe, h.clock);
  assert.equal(b.estados.chamas.length, 1);
  for (let i = 0; i < 40 && b.estados.chamas?.length; i++) Cacadas.tique(e, PERSONAGEM, (t += 250));
  assert.equal(b.estados.chamas?.length ?? 0, 0, 'o golpe do Sentinela tirou a Chama');
  assert.ok(h.poeChamasRemovidas?.length >= 1, 'e ela conta para o dono');
});

test('a RELÍQUIA ELEMENTAL: 25% a cada abate/acerto em Raro (seu ou de um aliado perto), recarga 0,3 s; 5 s com a aura (Cólera, Ódio ou Ira nível 20) em você e nos aliados; a do mesmo elemento renova; explode ao acabar', { skip: SEM }, () => {
  const ana = personagem({ reliquia_elemental: 25 });
  const bia = personagem();
  const longe = personagem();
  party(ana, [bia]);
  longe.hunt.partilha = bia.hunt.partilha;
  longe.hunt.pos = { ...ana.hunt.pos, x: ana.hunt.pos.x + 10 };
  bia.hunt.partilha.naSala.push(longe);
  const h = ana.hunt;
  const t0 = 5_000_000;
  const seq = (...v) => { let i = 0; return () => v[i++] ?? 0.99; };
  const reliquias = () => h.lacaios.filter((l) => l.reliquia && l.hp > 0);
  // (a ocasião: o seu abate, o acerto num Raro — e o abate da companheira perto; a de longe não conta)
  ModsPoe.evento(ana, h, 'matar', ficha(ana), { alvo: { estados: {} } });
  assert.equal(h.poeReliquiaPendente, 1);
  ModsPoe.notarParaReliquia(bia, bia.hunt);
  assert.equal(h.poeReliquiaPendente, 2, 'a companheira a 2 casas');
  ModsPoe.notarParaReliquia(longe, longe.hunt);
  assert.equal(h.poeReliquiaPendente, 2, 'a 10 casas, não');
  // (o sorteio: 0,3 ≥ 25% falha; 0,1 sai — o Gelo, o Ódio; a terceira cai na recarga)
  Acoes.tiqueDoGuardian(ana, h, t0, seq(0.3, 0.1, 0.5));
  assert.equal(reliquias().length, 1);
  const r = reliquias()[0];
  assert.equal(r.reliquia, 'ice');
  assert.equal(r.ate, t0 + 5000);
  assert.equal(h.poeReliquiaPendente ?? 0, 0);
  ModsPoe.notarParaReliquia(ana, h);
  Acoes.tiqueDoGuardian(ana, h, t0 + 200, seq(0.1, 0.0));
  assert.equal(reliquias().length, 1, 'na recarga (0,3 s), a ocasião se perde');
  // (a aura do Ódio nível 20: em você e nos aliados)
  const odio = GemasPoe.buffNoNivel('Hatred', 20).af.phys_as_extra_ice;
  assert.equal(odio, 39);
  const s = soma(ana);
  assert.equal(s.phys_as_extra_ice, odio);
  assert.equal(s['aliados:phys_as_extra_ice'], odio);
  // (o mesmo elemento: renova)
  ModsPoe.notarParaReliquia(ana, h);
  Acoes.tiqueDoGuardian(ana, h, t0 + 400, seq(0.1, 0.4));
  assert.equal(reliquias().length, 1);
  assert.equal(r.ate, t0 + 5400);
  // (outro elemento: outra Relíquia — o Fogo, a Cólera)
  ModsPoe.notarParaReliquia(ana, h);
  Acoes.tiqueDoGuardian(ana, h, t0 + 800, seq(0.1, 0.0));
  assert.deepEqual(reliquias().map((l) => l.reliquia).sort(), ['fire', 'ice']);
  assert.equal(soma(ana).added_fire_dmg_min, GemasPoe.buffNoNivel('Anger', 20).af.added_fire_dmg_min + (soma(personagem()).added_fire_dmg_min ?? 0));
  // (a explosão: 100% da vida dela no elemento, a até 2 casas)
  const b = bichoPerto(ana, 1);
  Object.assign(b, { x: r.x + 2, y: r.y });
  const eventos = Acoes.explosaoDaReliquia(h, r, ficha(ana));
  assert.equal(1e9 - b.hp, Math.round(resistido(h, b, 'ice', r.maxHp, ficha(ana))));
  assert.equal(eventos.length, 1);
});

test('a RELÍQUIA na caçada: ao acabar, explode e a aura sai', { skip: SEM }, () => {
  const e = personagem({ reliquia_elemental: 100 });
  const h = e.hunt;
  let t = Date.now();
  Cacadas.tique(e, PERSONAGEM, t);
  ModsPoe.notarParaReliquia(e, h);
  Acoes.tiqueDoGuardian(e, h, t, () => 0.5);
  const r = h.lacaios.find((l) => l.reliquia);
  assert.equal(r.reliquia, 'ice');
  assert.equal(soma(e).phys_as_extra_ice, 39);
  const b = bichoPerto(e, 1);
  r.ate = t + 100;
  const eventos = Cacadas.tique(e, PERSONAGEM, (t += 250));
  assert.ok(!h.lacaios.some((l) => l.reliquia), 'acabou');
  const esperado = Math.round(resistido(h, b, 'ice', r.maxHp, ficha(e)));
  assert.ok(eventos.some((x) => x.t === 'dmg' && x.uid === b.uid && x.v === esperado), JSON.stringify(eventos.filter((x) => x.t === 'dmg')));
  assert.equal(soma(e).phys_as_extra_ice ?? 0, 0, 'a aura saiu');
});

test('o ÓDIO: "Você e aliados próximos recebem X% de Dano Físico como Dano Extra de Gelo" vale (antes, "efeito não aplicado")', { skip: SEM }, () => {
  const b = GemasPoe.buffNoNivel('Hatred', 20);
  assert.equal(b.af.phys_as_extra_ice, 39);
  assert.ok(!(b.motivos ?? []).some((m) => /efeito não aplicado/.test(m)), JSON.stringify(b.motivos));
});
