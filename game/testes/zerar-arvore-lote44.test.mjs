// ZERAR A ÁRVORE — LOTE 44 (dono, 16/10: "Procurar os números" do grupo idle → "Aplicar o PoB" e "Incluir no lote 44"): a FORÇA dos lacaios
// pelo Path of Building — a tabela de aliados do nível × o multiplicador do tipo (a vida, o golpe, o tempo de ataque, o escudo de energia, a
// armadura e as resistências de base) — no Sentinela do Resplendor (P068), nas Relíquias Elementais (P069), nas Aranhas Espectrais (P065, com
// o veneno do Golpe da Víbora em 4 s), no Fantasma e no PODER FANTASMAL pelo nível do suporte (P064) e nos lacaios das gemas; a ÉGIDE
// PRIMITIVA volta em 5 s (P072); as Magias Ativadas saem do LUGAR de cada ROBÔ ATIVADOR, que corre até os inimigos (P066).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
const Acoes = await import('../systems/acoes.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const LacaiosPoe = await import('../systems/itens-poe/lacaios-poe.mjs');
const SuportesPoe = await import('../systems/itens-poe/suportes-poe.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
}

const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 70, rng: () => 0.5 }));
/** Um personagem do PoE de nível `level` numa caçada, com `af` na varinha. */
function personagem(af = {}, level = 70) {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level });
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
const soma = (e) => { Ficha.invalidar(e); return Afixos.soma(e); };
// As tabelas de aliados do PoB no nível 70 (`Data/Misc.lua`: monsterAllyLifeTable, monsterAllyDamageTable, monsterArmourTable).
const VIDA_70 = 1478;
const DANO_70 = 332.05;
const ARMADURA_70 = 14047;

test('as linhas: o Poder Fantasmal, as Aranhas, os Robôs, a Égide Primitiva e a Relíquia com efeito; o Sentinela equivalente (a exceção do idle)', { skip: SEM }, () => {
  const estado = (modelo, valores = []) => T.traduzirMod({ modelo, valores });
  for (const [m, v] of [['Cada Fantasma Convocado concede a Você Poder Fantasmal'], ['Ativa Erguer Aranhas Nível {0} ao Matar', [20]], ['{0}% de chance de Ativar Erguer Aranhas Nível {1} ao Matar', [100, 20]],
    ['Ativa Convocar Robôs Ativadores Nível {0} quando Alocado', [20]], ['Ativa Égide Primitiva Nível {0} quando Alocado', [20]],
    ['{0}% de chance de Ativar Convocar Relíquia Elemental Nível {1} quando você ou um Aliado próximo Matar um Inimigo, ou Acertar um Inimigo Raro ou Único', [25, 20]]]) {
    assert.equal(estado(m, v).estado, 'novo', m);
  }
  const s = estado('Concede a Habilidade Convocar Sentinela do Resplendor Nível {0}', [20]);
  assert.equal(s.estado, 'equivalente');
  assert.match(s.partes[0].nota, /exceção do dono/);
});

test('o PoB: a tabela de aliados × o multiplicador do lacaio — o Sentinela (12 de vida; o golpe × 20 × 3 a cada 0,83 ÷ 0,28 s; a armadura), o Poder Fantasmal pelo nível do suporte', { skip: SEM }, () => {
  assert.equal(LacaiosPoe.POB.tabelas.vida.length, 100);
  const s = LacaiosPoe.forcaDoPob('GuardianSentinel', 70);
  assert.equal(s.vida, VIDA_70 * 12);
  assert.ok(Math.abs(s.dano - DANO_70 * 20 * 3) < 1e-6);
  assert.ok(Math.abs(s.tempo - 0.83 / 0.28) < 1e-9);
  assert.equal(s.armadura, ARMADURA_70);
  assert.deepEqual(s.res, { fire: 40, ice: 40, energy: 40, chaos: 20 });
  const r = LacaiosPoe.forcaDoPob('GuardianRelicFire', 70);
  assert.equal(r.vida, VIDA_70 * 4);
  assert.ok(Math.abs(r.es - VIDA_70 * 4 * 0.6) < 1e-6, 'o escudo de energia: 60% da vida');
  assert.equal(LacaiosPoe.forcaDoPob('SpiderMinion', 70).imune, true);
  assert.deepEqual(LacaiosPoe.poderFantasmalNoNivel(1), [2, 3]);
  assert.deepEqual(LacaiosPoe.poderFantasmalNoNivel(20), [42, 65]);
  assert.deepEqual(LacaiosPoe.poderFantasmalNoNivel(40), [62, 92]);
  // o nível do suporte vai no efeito dele
  assert.equal(SuportesPoe.efeitoNoNivel('Summon_Phantasm_Support', 12).efeito.fantasmaNivel, 12);
});

test('os LACAIOS DAS GEMAS pelo PoB: o Zumbi (3,75 de vida × os 38% mais da gema; o golpe × 1,65, ±40%, a cada 1,17 s; 40% de resistências), o Golem de Pedra (a armadura), os Robôs Rastejantes (não sofrem dano); o Espectro segue com a força de monstro', { skip: SEM }, () => {
  const z = LacaiosPoe.oQueInvoca('Raise_Zombie', 20, null, {});
  assert.equal(z.nivel, 70);
  assert.equal(z.pob, 'RaisedZombie');
  assert.equal(z.vida, Math.round(VIDA_70 * 3.75 * 1.38));
  assert.deepEqual(z.dano, { min: Math.round(DANO_70 * 1.65 * 0.6), max: Math.round(DANO_70 * 1.65 * 1.4) });
  assert.equal(z.intervaloMs, 1170);
  assert.deepEqual([z.poe.resFogo, z.poe.resGelo, z.poe.resRaio, z.poe.resCaos], [40, 40, 40, 20]);
  assert.equal(LacaiosPoe.oQueInvoca('Summon_Stone_Golem', 20, null, {}).poe.armadura, ARMADURA_70);
  assert.equal(LacaiosPoe.oQueInvoca('Summon_Skitterbots', 20, null, {}).intocavel, true);
  // o Espírito Furioso: o tempo do PoB (0,57 s) já é o rápido — sem o "rápido" do jeito por cima
  const esp = LacaiosPoe.oQueInvoca('Summon_Raging_Spirit', 20, null, {});
  assert.equal(esp.intervaloMs, 570);
  assert.equal(esp.estilo.rapido, undefined);
  // o Espectro (o monstro erguido) não tem tipo no PoB
  const espectro = LacaiosPoe.oQueInvoca('Raise_Spectre', 20, null, {});
  assert.equal(espectro.pob, undefined);
  assert.equal(espectro.vida, Math.round(LacaiosPoe.forcaDoNivel(espectro.nivel).vida));
});

test('P068/P069 — o SENTINELA e a RELÍQUIA com a força do PoB no seu nível (até 85)', { skip: SEM }, () => {
  const e = personagem({ sentinela_do_resplendor: 20, reliquia_elemental: 100 });
  const h = e.hunt;
  const t0 = h.ultimoTique ?? 0;
  Acoes.tiqueDoGuardian(e, h, t0);
  Acoes.tiqueDoGuardian(e, h, t0 + 750);
  const s = h.lacaios.find((l) => l.sentinela && l.hp > 0);
  assert.ok(s, 'o Sentinela');
  assert.equal(s.maxHp, VIDA_70 * 12);
  assert.equal(s.intervaloMs, Math.round((0.83 / 0.28) * 1000));
  assert.ok(Math.abs((s.dano.min + s.dano.max) / 2 - DANO_70 * 60) <= 1, 'o golpe × 20 × 3');
  assert.equal(s.poe.armadura, ARMADURA_70);
  assert.equal(s.poe.resFogo, 40);
  h.poeReliquiaPendente = 1;
  Acoes.tiqueDoGuardian(e, h, t0 + 1000, () => 0);
  const r = h.lacaios.find((l) => l.reliquia && l.hp > 0);
  assert.ok(r, 'a Relíquia');
  assert.equal(r.maxHp, VIDA_70 * 4);
  assert.equal(r.maxEs, Math.round(VIDA_70 * 4 * 0.6));
  // no nível 90, o Sentinela é do 85
  const e90 = personagem({ sentinela_do_resplendor: 20 }, 90);
  Acoes.tiqueDoGuardian(e90, e90.hunt, 0);
  Acoes.tiqueDoGuardian(e90, e90.hunt, 750);
  assert.equal(e90.hunt.lacaios.find((l) => l.sentinela).maxHp, LacaiosPoe.POB.tabelas.vida[84] * 12);
});

test('P064 — o PODER FANTASMAL é o do nível do Suporte: Convocar Fantasma (a tabela do PoB), não o golpe do Fantasma', { skip: SEM }, () => {
  const e = personagem({ poder_fantasmal: 1 });
  const h = e.hunt;
  const [a] = h.monstros;
  assert.equal(Acoes.convocarFantasmas(e, h, { fantasmaAoMatarPct: 100, fantasmaMax: 5, fantasmaNivel: 20 }, [{ ...a, hp: 0 }, { ...a, uid: 'y', hp: 0 }], () => 0), 2);
  const vivos = h.lacaios.filter((l) => l.fantasma && l.hp > 0);
  assert.equal(vivos.length, 2);
  assert.ok(vivos.every((l) => l.pob === 'SummonedPhantasm' && l.maxHp === Math.round(VIDA_70 * 1.58)));
  const s = soma(e);
  assert.equal(s.spell_added_physical_dmg_min, 2 * 42);
  assert.equal(s.spell_added_physical_dmg_max, 2 * 65);
});

test('P065 — as ARANHAS: o golpe do PoB (× 1,76 a cada 0,96 s) e o veneno do Golpe da Víbora em 4 s (30% do golpe por segundo)', { skip: SEM }, () => {
  const e = personagem({ erguer_aranhas: 20, erguer_aranhas_chance: 100 });
  const h = e.hunt;
  const [a, ...outros] = h.monstros;
  for (const o of outros) Object.assign(o, { x: h.pos.x + 60, y: h.pos.y + 60 });
  Object.assign(a, { x: h.pos.x + 2, y: h.pos.y, hp: 1e9, maxHp: 1e9, estados: {}, dots: [] });
  let t = Date.now();
  Cacadas.tique(e, PERSONAGEM, t);
  h.cadaveres = [{ key: 'rat', nome: 'Rato', x: a.x, y: a.y + 1 }];
  ModsPoe.evento(e, h, 'matar', Ficha.combate(e), { alvo: a });
  Acoes.tiqueDasAranhas(e, h, t, () => 0);
  const aranhas = h.lacaios.filter((l) => l.aranha);
  assert.equal(aranhas.length, 2);
  assert.ok(aranhas.every((l) => l.pob === 'SpiderMinion' && l.intervaloMs === 960 && l.intocavel));
  assert.ok(Math.abs((aranhas[0].dano.min + aranhas[0].dano.max) / 2 - DANO_70 * 1.76) <= 1, 'o golpe (o mínimo e o máximo arredondados)');
  for (let i = 0; i < 40 && !(a.dots ?? []).some((d) => d.tipo === 'venenoPoe'); i++) Cacadas.tique(e, PERSONAGEM, (t += 250));
  const veneno = (a.dots ?? []).find((d) => d.tipo === 'venenoPoe');
  assert.ok(veneno, 'o veneno das aranhas');
  assert.equal(Acoes.ARANHAS.venenoMs, 4000);
  const falta = veneno.ate - (h.clock ?? 0);
  assert.ok(falta > 3000 && falta <= 4000, `o veneno dura 4 s (antes, 2 s): ${falta} ms`);
});

test('P072 — a ÉGIDE PRIMITIVA volta cheia 5 s depois do último dano elemental (as dos únicos, 10 s)', { skip: SEM }, () => {
  assert.equal(ModsPoe.EGIDE.recargaPrimitivaMs, 5000);
  assert.equal(ModsPoe.EGIDE.recargaMs, 10000);
  const e = personagem({ egide_primitiva: 20, egide_primitiva_por_notavel: 75 });
  const h = e.hunt;
  e.passivas = { ...(e.passivas ?? {}), alocados: [...(e.passivas?.alocados ?? []), ...P.arvore().nos.filter((n) => n.tipo === 'notable' && !n.ascendencia).slice(0, 4).map((n) => n.id)] };
  Acoes.tiqueDasEgides(e, h, 0);
  const eg = h.egides.primitiva;
  assert.ok(eg.max > 0);
  eg.valor = 0;
  eg.ultimoDano = 1000;
  Acoes.tiqueDasEgides(e, h, 5999);
  assert.equal(eg.valor, 0, 'antes dos 5 s');
  Acoes.tiqueDasEgides(e, h, 6000);
  assert.equal(eg.valor, eg.max, 'cheia aos 5 s');
});

test('P066 — os ROBÔS ATIVADORES: a Magia Ativada sai do lugar do robô (a sua posição trocada só no disparo); o robô corre até o inimigo', { skip: SEM }, () => {
  const e = personagem({ robos_ativadores: 20 });
  const h = e.hunt;
  Acoes.tiqueDosRobos(e, h, h.ultimoTique ?? 0);
  const robos = h.lacaios.filter((l) => l.robo && l.hp > 0);
  assert.equal(robos.length, 2);
  Object.assign(robos[0], { x: h.pos.x + 3, y: h.pos.y });
  Object.assign(robos[1], { x: h.pos.x, y: h.pos.y + 2 });
  const antes = h.pos;
  const vistos = [0, 1].map((i) => Acoes.doLugarDoRobo(h, i, () => ({ x: h.pos.x, y: h.pos.y })));
  assert.deepEqual(vistos, [{ x: robos[0].x, y: robos[0].y }, { x: robos[1].x, y: robos[1].y }]);
  assert.equal(h.pos, antes, 'a sua posição volta');
  // sem robô vivo, do seu lugar
  for (const r of robos) r.hp = 0;
  assert.deepEqual(Acoes.doLugarDoRobo(h, 0, () => ({ x: h.pos.x, y: h.pos.y })), { x: antes.x, y: antes.y });
});
