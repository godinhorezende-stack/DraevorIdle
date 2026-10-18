// OS SUPORTES QUE VIRAM TOTEM (lote G20b, 18/10): o Totem de Magia, o Totem Balista e o Devastador — o seu uso da habilidade suportada COLOCA um
// totem (0,6 s; 0,5 s na balista), que a usa sozinho com o "menos Dano/Velocidade" do suporte (o PoB: sup_str.lua:5034, 4513; other.lua:1468); a
// habilidade fica com o tipo Totem (os Totens Múltiplos ligam nela); os Totens Múltiplos põem dois por uso; a Balista Focada só ataca depois de um
// projétil de ataque seu; o totem ancestral do Devastador só usa com você a até 7 m dele.
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
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Registro = await import('../systems/combate/registro.mjs');

const sorte = (v, f) => { const o = Math.random; Math.random = () => v; try { return f(); } finally { Math.random = o; } };

async function montar(arma, grupos) {
  const J = await import('../systems/itens-poe/jogo.mjs');
  const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Scion', sistema: 'poe' });
  const a = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: arma, raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
  const todas = grupos.flat();
  const links = grupos.flatMap((g) => g.map((_, i) => i < g.length - 1)).slice(0, todas.length - 1);
  a.soquetes = { abertos: todas.length, links, gemas: Array(todas.length).fill(null), cores: Array(todas.length).fill('W') };
  e.equipment = { ...e.equipment, weapon: a };
  delete e.equipment.shield;
  e.inventory = todas.map((s) => GS.itemDaGema({ id: (G.doSlug(s) ?? SP.doSlug(s)).itemId, nivel: 20, xp: 0, raridade: 'comum' }));
  for (let i = 0; i < todas.length; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  e.actions = Array(Acoes.SLOTS).fill(null);
  grupos.forEach((g, i) => { e.actions[i] = { id: G.doSlug(g[0]).acao, enabled: true, minMana: 0, conditions: [] }; });
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(sorte(0.999, () => Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' })).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 1e7;
  e.maxHp = e.hp = 1e7;
  const ms = e.hunt.monstros;
  for (const m of ms) Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60, hp: 1e12, maxHp: 1e12, estados: {}, dots: [], resist: {} });
  Object.assign(ms[0], { x: e.hunt.pos.x + 3, y: e.hunt.pos.y });
  return { e, b: ms[0], ms };
}
/** O seu uso do slot (com a conjuração até o fim): os eventos e o resultado. */
function usar(e, slot, alvo, v = 0.5) {
  const ev = [];
  const r = sorte(v, () => Acoes.disparar(e, e.hunt, PERSONAGEM, slot, alvo, { manual: true }));
  if (!r.ok) return { r, ev };
  ev.push(...(r.eventos ?? []));
  if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; ev.push(...(sorte(v, () => Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM)) ?? [])); }
  return { r, ev };
}
const totens = (e) => (e.hunt.lacaios ?? []).filter((l) => l.tipo === 'totem' && l.hp > 0);
const golpe = (e, l, alvo, v = 0.5) => sorte(v, () => Cacadas.golpeDoTotem(e, e.hunt, l, alvo, Ficha.combate(e), PERSONAGEM, e.hunt.clock));

test('G20b: a Bola de Fogo com o Totem de Magia — o seu uso COLOCA o totem em 600 ms (sem dano seu); o totem lança com 50% do dano e a cada 1250 ms', { skip: SEM }, async () => {
  const { e, b } = await montar('Wands/Driftwood_Wand', [['Fireball', 'Spell_Totem_Support']]);
  const entry = Acoes.POR_ID_PUBLICO(G.doSlug('Fireball').acao);
  const ef = GS.efeitoNaSkill(e, entry.id);
  assert.equal(ef.viraTotem, 1);
  const { r, ev } = usar(e, 0, b);
  assert.ok(r.ok, r.erro);
  assert.equal(r.conjurando, true, 'o seu uso conjura a colocação');
  assert.ok(!ev.some((x) => x.t === 'dmg' && x.foe), 'nenhum dano seu');
  const [l] = totens(e);
  assert.ok(l, 'o totem foi posto');
  assert.deepEqual([l.gema, l.acao, l.duracaoMs, l.nome], ['Fireball', entry.id, 8000, `Totem de ${G.doSlug('Fireball').gema.nome}`]);
  // o tempo de colocar e o do totem
  assert.equal(Acoes.temposDaGemaPoe(e, { ...entry, papeis: ['suporte'], poeGema: { ...entry.poeGema, lacaio: 'totem' } }, ef).conjuracaoMs, 600);
  assert.equal(Acoes.temposDaGemaPoe(e, entry, ef, Ficha.combate(e), { doJogador: false }).conjuracaoMs, 1250, '750 / 0,6 (40% menos Velocidade de Conjuração)');
  // o dano: 50% do da sua Bola de Fogo sem o suporte (o mesmo sorteio)
  Object.assign(b, { x: l.x + 2, y: l.y });
  Registro.definirNivel(2);
  Registro.limparRegistro();
  try {
    golpe(e, l, b);
    const doTotem = Registro.ultimosGolpes(50).find((g) => g.origem === 'gema')?.danoAntesDaResistencia;
    const s = await montar('Wands/Driftwood_Wand', [['Fireball']]);
    Object.assign(s.b, { x: s.e.hunt.pos.x + 2, y: s.e.hunt.pos.y });
    Registro.limparRegistro();
    usar(s.e, 0, s.b);
    const seu = Registro.ultimosGolpes(50).find((g) => g.origem === 'gema')?.danoAntesDaResistencia;
    assert.ok(doTotem > 0 && seu > 0, `${doTotem} / ${seu}`);
    assert.ok(Math.abs(doTotem / seu - 0.5) < 0.02, `o totem: ${doTotem}; você sem o suporte: ${seu}`);
  } finally { Registro.definirNivel(0); }
  // com o totem vivo, o segundo uso não sai (o máximo é 1)
  e.hunt.cooldowns = {};
  assert.equal(usar(e, 0, b).r.motivo, 'LACAIOS_COMPLETOS');
});

test('G20b: a Flecha Ardente com o Totem Balista — colocar em 500 ms; até 3 balistas (1 + 2); o ataque dela com 70% do dano e o dobro do tempo', { skip: SEM }, async () => {
  const { e, b } = await montar('Bows/Crude_Bow', [['Burning_Arrow', 'Ballista_Totem_Support']]);
  const entry = Acoes.POR_ID_PUBLICO(G.doSlug('Burning_Arrow').acao);
  const ef = GS.efeitoNaSkill(e, entry.id);
  assert.deepEqual([ef.viraTotem, ef.totensExtras], [2, 2]);
  const vista = { ...entry, papeis: ['suporte'], poeGema: { ...entry.poeGema, lacaio: 'totem' } };
  assert.equal(Acoes.temposDaGemaPoe(e, vista, ef).conjuracaoMs, 500);
  for (let i = 0; i < 3; i++) { e.hunt.cooldowns = {}; assert.ok(usar(e, 0, b).r.ok); }
  assert.equal(totens(e).length, 3);
  e.hunt.cooldowns = {};
  assert.equal(usar(e, 0, b).r.motivo, 'LACAIOS_COMPLETOS');
  const sem = { ...ef, viraTotem: 0, maisDanoPct: 0, castTimePct: 0, fatorDeDano: ef.fatorDeDano / 0.7 };
  const t = (x) => Acoes.temposDaGemaPoe(e, entry, x, Ficha.combate(e), { doJogador: false }).uso;
  assert.ok(Math.abs(t(ef) / t(sem) - 2) < 0.02, `${t(ef)} contra ${t(sem)}`);
  assert.ok(Math.abs(ef.fatorDeDano / sem.fatorDeDano - 0.7) < 1e-9);
});

test('G20b: os Totens Múltiplos ligam na habilidade que virou totem e põem DOIS por uso (o Golpe Sísmico: 1 uso → 2 totens; o máximo 1 + 2)', { skip: SEM }, async () => {
  const { e, b } = await montar('Wands/Driftwood_Wand', [['Shockwave_Totem', 'Multiple_Totems_Support']]);
  assert.equal(GS.efeitoNaSkill(e, G.doSlug('Shockwave_Totem').acao).totensPorUso, 2);
  assert.ok(usar(e, 0, b).r.ok);
  assert.equal(totens(e).length, 2);
  e.hunt.cooldowns = {};
  assert.ok(usar(e, 0, b).r.ok);
  assert.equal(totens(e).length, 3, 'o máximo (1 + 2): o mais velho sai');
  // a Bola de Fogo com o Totem de Magia e os Totens Múltiplos no mesmo grupo: o Totem acrescentado deixa o Múltiplos ligar
  const m = await montar('Wands/Driftwood_Wand', [['Fireball', 'Spell_Totem_Support', 'Multiple_Totems_Support']]);
  const ef = GS.efeitoNaSkill(m.e, G.doSlug('Fireball').acao);
  assert.ok(ef.supports.includes(SP.doSlug('Multiple_Totems_Support').nome ?? ef.supports.at(-1)), ef.supports.join(', '));
  assert.equal(ef.totensPorUso, 2);
});

test('G20b: a Balista Focada só ataca depois de um projétil de ataque seu', { skip: SEM }, async () => {
  const { e, b } = await montar('Bows/Crude_Bow', [['Siege_Ballista', 'Focused_Ballista_Support'], ['Burning_Arrow']]);
  assert.ok(usar(e, 0, b).r.ok);
  const [l] = totens(e);
  assert.equal(l.focada, true);
  Object.assign(l, { x: e.hunt.pos.x + 1, y: e.hunt.pos.y });
  Object.assign(b, { x: l.x + 2, y: l.y });
  const tiros = () => {
    l.proximoGolpe = 0;
    const ev = sorte(0.001, () => Cacadas.tiqueDosLacaios(e, e.hunt, PERSONAGEM, null, e.hunt.clock));
    return ev.filter((x) => x.t === 'dmg' && x.foe && x.lacaio).length;
  };
  delete e.hunt.poeProjetilDeAtaqueEm;
  assert.equal(tiros(), 0, 'sem projétil seu, a balista não ataca');
  e.hunt.clock += 1000;
  e.hunt.cooldowns = {};
  assert.ok(usar(e, 1, b, 0.001).r.ok, 'a sua Flecha Ardente');
  e.hunt.clock += 10;
  assert.ok(tiros() > 0, 'depois do seu projétil, ataca');
  assert.equal(tiros(), 0, 'e só uma vez por projétil seu');
});

test('G20b: o Devastador põe um totem ancestral que só usa a habilidade com você a até 7 m (3 casas e meia)', { skip: SEM }, async () => {
  const { e, b } = await montar('Two_Hand_Maces/Driftwood_Maul', [['Ground_Slam', 'Earthbreaker_Support']]);
  const ef = GS.efeitoNaSkill(e, G.doSlug('Ground_Slam').acao);
  assert.deepEqual([ef.viraTotem, ef.ativacaoM, ef.totemDuracaoMs], [1, 7, 12000]);
  const r = usar(e, 0, b, 0.9);
  assert.ok(r.r.ok, r.r.erro);
  const [l] = totens(e);
  assert.equal(l.ativacao, 3, 'com o sorteio 0,9 (≥ 0,5), 3 casas');
  assert.equal(l.duracaoMs, 12000);
});

test('G20b: o status — o Totem de Magia, o Totem Balista, os Totens Múltiplos e a Balista Focada "funciona"; o Devastador lista a área sem número no PoB', { skip: SEM }, () => {
  for (const s of ['Spell_Totem_Support', 'Ballista_Totem_Support', 'Multiple_Totems_Support', 'Focused_Ballista_Support']) assert.equal(SP.doSlug(s).statusNoJogo ?? SP.doSlug(s).status, 'funciona', `${s}: ${(SP.doSlug(s).motivos ?? []).join(' | ')}`);
  const dev = SP.doSlug('Earthbreaker_Support');
  assert.ok((dev.motivos ?? []).some((m) => /Área de Efeito aumentada para Habilidades Corpo a Corpo/.test(m)));
});
