// O LOTE A3 (dono, 19/10): os PROJÉTEIS das gemas do PoE — os três erros (o Suporte de Atravessar que não atravessava, o Pulso Congelante com 1
// projétil e a linha da rampa contada como feita, o Ponto Cego com 30% fixo), a velocidade de projétil (D1), as rampas de distância (D2), o
// atravessar e o retorno (D3, D4), a divisão como no PoE (D5), as rebatidas e o salto no solo (D6), a geometria da emissão (D7), o Ponto Cego
// pela rampa do Queima-Roupa (D9) e a perfuração que soma (D10).
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
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Secundarios = await import('../systems/skills/golpes-secundarios.mjs');

const sorte = (v, f) => { const o = Math.random; Math.random = () => v; try { return f(); } finally { Math.random = o; } };
const efeitoDo = (slug, nivel = 20, q = 0, tags = ['Projétil', 'Ataque', 'Magia', 'Arco']) => SP.efeitoNoNivel(slug, nivel, q, { tags: tags.map((t) => `poe:${t}`) });

/** O personagem com a arma, a ativa e os suportes ligados (nível 20), numa caçada; os bichos em `posicoes` ([dx, dy] de você), imortais. */
async function montar(arma, ativa, suportes = [], posicoes = [[1, 0]], { qualidade = 0, af = {} } = {}) {
  const J = await import('../systems/itens-poe/jogo.mjs');
  const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Scion', sistema: 'poe' });
  const a = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: arma, raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
  const n = 1 + suportes.length;
  a.soquetes = { abertos: n, links: Array.from({ length: n - 1 }, () => true), gemas: Array(n).fill(null), cores: Array(n).fill('W') };
  a.poe.af = { ...(a.poe.af ?? {}), ...af };
  e.equipment = { ...e.equipment, weapon: a };
  delete e.equipment.shield;
  e.inventory = [ativa, ...suportes].map((s, i) => GS.itemDaGema({ id: (G.doSlug(s) ?? SP.doSlug(s)).itemId, nivel: 20, xp: 0, raridade: 'comum', ...(i === 0 && qualidade ? { qualidade } : {}) }));
  for (let i = 0; i < n; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: G.doSlug(ativa).acao, enabled: true, minMana: 0, conditions: [] };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(sorte(0.999, () => Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' })).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 1e7;
  e.maxHp = e.hp = 1e7;
  const modelo = structuredClone(e.hunt.monstros[0]);
  e.hunt.monstros.forEach((m, i) => {
    const p = posicoes[i];
    if (!p) return Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60 });
    const uid = m.uid;
    for (const k of Object.keys(m)) delete m[k];
    Object.assign(m, structuredClone(modelo), { uid, x: e.hunt.pos.x + p[0], y: e.hunt.pos.y + p[1], hp: 1e12, maxHp: 1e12, estados: {}, dots: [], resist: {}, mods: [], raridade: 'normal' });
  });
  return { e, bichos: e.hunt.monstros.slice(0, posicoes.length) };
}
/** Um uso no `alvo` com o sorteio fixo: os eventos. */
function usar(e, alvo, v = 0.5) {
  e.hunt.clock += 10_000;
  const eventos = [];
  sorte(v, () => {
    const r = Acoes.disparar(e, e.hunt, PERSONAGEM, 0, alvo, { manual: true });
    assert.ok(r.ok, r.erro);
    eventos.push(...(r.eventos ?? []));
    // (a magia com tempo de conjuração: conclui)
    if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; eventos.push(...(Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM) ?? [])); }
  });
  return eventos;
}
const danoEm = (ev, b) => ev.filter((x) => x.t === 'dmg' && x.foe && x.uid === b.uid).reduce((t, x) => t + x.v, 0);
const tiros = (ev) => ev.filter((x) => x.t === 'shot');

// ---------------------------------------------------------------- os três erros

test('erro 1: o Suporte de Atravessar ATRAVESSA ("Atravessam 4 Alvos adicionais" → perfurar 4) e sai de parcial', { skip: SEM }, () => {
  const { efeito, naoFeitas } = efeitoDo('Pierce_Support');
  assert.equal(efeito.perfurar, 4);
  assert.deepEqual(naoFeitas, []);
  assert.equal(SP.REGISTRO.get('Pierce_Support').status, 'funciona');
});

test('erro 2: o Pulso Congelante dispara 5 projéteis no nível 20 (o PoB) e a linha da rampa não conta como o "25% de chance de Congelar" fixo', { skip: SEM }, async () => {
  const a = G.alvosNoNivel('Freezing_Pulse', 20);
  assert.equal(a.base, 5, '"Dispara 5 projétil" — o singular');
  assert.equal(a.rampaMaisPct, -50);
  assert.equal(a.rampaCongelar, 25);
  assert.equal(G.compilada('Freezing_Pulse', 20)?.stats?.chances?.congelar ?? 0, 0, 'o congelamento não fica fixo em 25%');
  assert.ok(!G.doSlug('Freezing_Pulse').motivosNoJogo.length, G.doSlug('Freezing_Pulse').motivosNoJogo.join(' | '));
  const { e, bichos: [b] } = await montar('Wands/Driftwood_Wand', 'Freezing_Pulse', [], [[2, 0]]);
  assert.equal(tiros(usar(e, b)).length, 5, 'os 5 saem — 1 no alvo e 4 que erram');
});

test('erro 3 (D9): o Ponto Cego é a flag do Queima-Roupa (af:queima_roupa), não 30% mais a qualquer distância', { skip: SEM }, async () => {
  const { efeito, naoFeitas } = efeitoDo('Point_Blank_Support');
  assert.equal(efeito['af:queima_roupa'], 1);
  assert.equal(efeito.maisDanoPct, undefined, 'sem o "30% mais" fixo');
  assert.deepEqual(naoFeitas, []);
  // o dano no alvo colado e a 7 casas, com e sem o suporte: ×1,18 e ×0,73 (a rampa do Queima-Roupa: 1,3 até 10 u, 1,0 a 35, 0,7 a 150)
  const razao = async (dx) => {
    // (o golpe forte, para o arredondamento não pesar nas proporções)
    const sem = await montar('Bows/Crude_Bow', 'Split_Arrow', [], [[dx, 0]], { af: { phys_add: 3000 } });
    const com = await montar('Bows/Crude_Bow', 'Split_Arrow', ['Point_Blank_Support'], [[dx, 0]], { af: { phys_add: 3000 } });
    const aumentado = 1; // (o "Dano de Projétil aumentado" do suporte é o mesmo nas duas distâncias: a razão entre as distâncias o cancela)
    return (danoEm(usar(com.e, com.bichos[0]), com.bichos[0]) / danoEm(usar(sem.e, sem.bichos[0]), sem.bichos[0])) * aumentado;
  };
  const perto = await razao(1);
  const longe = await razao(7);
  assert.ok(Math.abs(perto / longe - 1.18 / 0.73) < 0.03, `colado ÷ 7 casas: ${(perto / longe).toFixed(3)} (esperado ${(1.18 / 0.73).toFixed(3)})`);
});

// ---------------------------------------------------------------- F1 e F2: a velocidade e as rampas

test('D1: a VELOCIDADE DE PROJÉTIL do uso — o "aumentada" da gema e dos suportes soma, o "mais/menos" multiplica; vai no vel do tiro', { skip: SEM }, async () => {
  assert.equal(G.alvosNoNivel('Freezing_Pulse', 20, 20).velInc, 40, 'a qualidade: "Velocidade de Projéteis aumentada em 40%"');
  assert.ok(Math.abs(G.alvosNoNivel('Eye_of_Winter_of_Transience', 20).velMais - 1.5) < 1e-9);
  assert.equal(efeitoDo('Faster_Projectiles_Support', 20, 0).efeito['af:projectile_speed'], 69);
  assert.equal(efeitoDo('Slower_Projectiles_Support').efeito.velProjetilMaisPct, -30);
  const { e, bichos: [b] } = await montar('Wands/Driftwood_Wand', 'Freezing_Pulse', ['Faster_Projectiles_Support', 'Slower_Projectiles_Support'], [[2, 0]]);
  const efeito = Acoes.comOsAlvosDaGema(Acoes.POR_ID_PUBLICO(G.doSlug('Freezing_Pulse').acao), GS.efeitoNaSkill(e, G.doSlug('Freezing_Pulse').acao), e);
  const v = Acoes.velocidadeDoProjetil(e, Acoes.POR_ID_PUBLICO(G.doSlug('Freezing_Pulse').acao), efeito);
  assert.equal(v.localIncPct, 69);
  assert.ok(Math.abs(v.mod - 1.69 * 0.7) < 1e-9, `mod ${v.mod}`);
  const ev = usar(e, b);
  assert.ok(tiros(ev).length && tiros(ev).every((t) => Math.abs(t.vel - 1.69 * 0.7) < 1e-9), JSON.stringify(tiros(ev).map((t) => t.vel)));
  assert.equal(SP.REGISTRO.get('Faster_Projectiles_Support').status, 'funciona');
  assert.equal(SP.REGISTRO.get('Slower_Projectiles_Support').status, 'funciona');
});

test('D2: as RAMPAS do PoB em unidades (o colado = 20 u) — o Pulso −17/−33/−50%, com a qualidade 20 (×1,4) −12% colado; o Olho +200% a 3 casas', () => {
  const pulso = (u, modVel = 1) => ModsPoe.rampaDoUso({ rampaMaisPct: -50, modVel }, u);
  assert.ok(Math.abs(pulso(20) - (1 - 50 / 3 / 100)) < 1e-9, 'colado: −16,7%');
  assert.ok(Math.abs(pulso(40) - (1 - 100 / 3 / 100)) < 1e-9, '2 casas: −33%');
  assert.equal(pulso(60), 0.5, '3 casas: −50%');
  assert.equal(pulso(140), 0.5, '7 casas: o teto');
  assert.ok(Math.abs(pulso(20, 1.4) - (1 - (50 * 20) / 84 / 100)) < 1e-9, 'q20: a rampa vai a 84 u');
  assert.equal(ModsPoe.rampaDoUso({ rampaMaisPct: 200, modVel: 1 }, 60), 3);
  assert.equal(ModsPoe.rampaDoUso(null, 60), 1);
  // o congelamento: 25% em 0 u, 0 em 15 u × o mod — colado (20 u) não congela com ×1, e quase nada com ×1,4
  assert.equal(ModsPoe.congelarDaRampa({ rampaCongelar: 25, modVel: 1 }, 20), 0);
  assert.ok(Math.abs(ModsPoe.congelarDaRampa({ rampaCongelar: 25, modVel: 1.4 }, 20) - 25 * (1 - 20 / 21)) < 1e-9);
});

test('D2 no jogo: o Pulso Congelante causa ~50% menos a 3 casas que a 0 (a razão 3 casas ÷ colado = 0,5 ÷ 0,833)', { skip: SEM }, async () => {
  const em = async (dx) => { const m = await montar('Wands/Driftwood_Wand', 'Freezing_Pulse', [], [[dx, 0]]); return danoEm(usar(m.e, m.bichos[0]), m.bichos[0]); };
  const colado = await em(1);
  const tres = await em(3);
  assert.ok(Math.abs(tres / colado - 0.5 / (1 - 1 / 6)) < 0.02, `${(tres / colado).toFixed(3)}`);
  assert.equal(G.alvosNoNivel('Eye_of_Winter', 20).rampaMaisPct, 200);
  assert.equal(G.alvosNoNivel('Eye_of_Winter_of_Finality', 20, 20).rampaMaisPct, 120, '100 + a qualidade');
});

// ---------------------------------------------------------------- F3 e F4: o atravessar e o retorno

test('D10: a perfuração SOMA — a do suporte (4) + a das peças (2); com a gema que atravessa todos, 99', { skip: SEM }, async () => {
  const { e } = await montar('Bows/Crude_Bow', 'Split_Arrow', ['Pierce_Support'], [[1, 0]], { af: { perfurar: 2 } });
  const entry = Acoes.POR_ID_PUBLICO(G.doSlug('Split_Arrow').acao);
  assert.equal(Acoes.comOsAlvosDaGema(entry, GS.efeitoNaSkill(e, entry.id), e).perfurar, 6);
  const m = await montar('Wands/Driftwood_Wand', 'Freezing_Pulse', ['Pierce_Support'], [[1, 0]]);
  const ep = Acoes.POR_ID_PUBLICO(G.doSlug('Freezing_Pulse').acao);
  assert.equal(Acoes.comOsAlvosDaGema(ep, GS.efeitoNaSkill(m.e, ep.id), m.e).perfurar, 99);
});

test('F3: "Projéteis que Atravessaram causam X% mais Dano" — no jogo, o 2º da reta (que o projétil atravessou para chegar) leva ×1,2 (o Disparo Congelante com qualidade 20)', { skip: SEM }, async () => {
  assert.equal(G.alvosNoNivel('Frostbolt', 20, 20).atravessouMaisPct, 20);
  const b = (x, y, uid) => ({ uid, x, y, hp: 10 });
  const vivos = [b(1, 0, 'a'), b(2, 0, 'b')];
  const { golpes } = Secundarios.resolver({ efeito: { perfurar: 99 }, tags: ['projectile'], origem: { x: 0, y: 0 }, alvo: vivos[0], atingidos: [vivos[0]], vivos, alcance: 7 });
  assert.equal(golpes.find((g) => g.bicho.uid === 'b').atravessados, 1, 'o acerto do 2º sabe que o projétil atravessou 1');
  // o multiplicador de verdade: a razão do dano no 2º e no 1º, com e sem a qualidade (a distância diferente se cancela)
  const razao = async (qualidade) => {
    const { e, bichos: [x, y] } = await montar('Wands/Driftwood_Wand', 'Frostbolt', [], [[1, 0], [2, 0]], { qualidade });
    const ev = usar(e, x);
    return danoEm(ev, y) / danoEm(ev, x);
  };
  const sem = await razao(0);
  const com = await razao(20);
  assert.ok(Math.abs(com / sem - 1.2) < 0.02, `com ÷ sem a qualidade: ${(com / sem).toFixed(3)}`);
});

test('D3: o Arremesso Espectral atravessa todos e RETORNA (a volta atravessa); a Materialização só acerta na volta; a Hélice atravessa', { skip: SEM }, async () => {
  for (const s of ['Spectral_Throw', 'Spectral_Throw_of_Trarthus', 'Vaal_Spectral_Throw']) {
    const a = G.alvosNoNivel(s, 20);
    assert.equal(a.perfurar, 99, s);
    assert.equal(a.retornar, 1, s);
    assert.ok(a.voltaAtravessa, s);
  }
  assert.ok(G.alvosNoNivel('Spectral_Throw_of_Materialising', 20).soNaVolta);
  assert.equal(G.alvosNoNivel('Spectral_Helix', 20).perfurar, 99);
  assert.ok(!G.alvosNoNivel('Spectral_Helix', 20).retornar, 'a descrição da Hélice não fala em retorno');
  // no jogo: dois bichos na reta — a ida e a volta em cada um
  const { e, bichos: [a, b] } = await montar('One_Hand_Swords/Rusted_Sword', 'Spectral_Throw', [], [[1, 0], [3, 0]]);
  const ev = usar(e, a);
  const fontes = (x) => ev.filter((d) => d.t === 'dmg' && d.foe && d.uid === x.uid).map((d) => d.fonte ?? 'direto');
  assert.deepEqual(fontes(a).sort(), ['direto', 'retorno']);
  assert.deepEqual(fontes(b).sort(), ['perfuracao', 'retorno']);
  const mat = await montar('One_Hand_Swords/Rusted_Sword', 'Spectral_Throw_of_Materialising', [], [[1, 0], [3, 0]]);
  const ev2 = usar(mat.e, mat.bichos[0]);
  const f2 = ev2.filter((d) => d.t === 'dmg' && d.foe).map((d) => d.fonte ?? 'direto');
  assert.deepEqual(f2, ['retorno', 'retorno'], 'a ida não acerta ninguém; a volta, os dois');
});

test('F4/D4: o Suporte de Retorno — volta a você com 34% (66% menos) e a volta atravessa TODOS os vivos do caminho, não só os da ida', { skip: SEM }, () => {
  const { efeito, naoFeitas } = efeitoDo('Returning_Projectiles_Support');
  assert.deepEqual(naoFeitas, []);
  assert.equal(efeito.retornar, 1);
  assert.equal(efeito.danoDoRetornoPct, 34);
  assert.equal(efeito.voltaAtravessa, 1);
  const b = (x, y, uid) => ({ uid, x, y, hp: 10 });
  // o alvo em (4,0); um bicho em (2,0) no caminho da volta, que o projétil (sem perfurar) não acertou na ida
  const vivos = [b(4, 0, 'alvo'), b(2, 0, 'meio')];
  const sem = Secundarios.resolver({ efeito: { retornar: 1, danoDoRetornoPct: 34 }, tags: ['projectile'], origem: { x: 0, y: 0 }, alvo: vivos[0], atingidos: [vivos[0]], vivos, alcance: 7 });
  assert.deepEqual(sem.golpes.map((g) => [g.bicho.uid, g.tipo, g.pct]), [['alvo', 'retorno', 34]]);
  const com = Secundarios.resolver({ efeito: { retornar: 1, danoDoRetornoPct: 34, voltaAtravessa: 1 }, tags: ['projectile'], origem: { x: 0, y: 0 }, alvo: vivos[0], atingidos: [vivos[0]], vivos, alcance: 7 });
  assert.deepEqual(com.golpes.map((g) => [g.bicho.uid, g.tipo, g.pct]), [['alvo', 'retorno', 34], ['meio', 'retorno', 34]]);
  // o Giro Venenoso: 25% na volta (75% menos), atravessando
  const gv = G.alvosNoNivel('Venom_Gyre', 20);
  assert.equal(gv.retornar, 1);
  assert.equal(gv.danoDoRetornoPct, 25);
  assert.ok(gv.voltaAtravessa);
});

// ---------------------------------------------------------------- F7: a quantidade e a emissão

test('D7: a Nova de Flechas sai em CÍRCULO do ponto do alvo; a Saraivada, de origens laterais na perpendicular', () => {
  const b = (x, y, uid) => ({ uid, x, y, hp: 10 });
  // o alvo em (5,0); um bicho a norte dele (5,-3) e um a leste (8,0): da nova (3 projéteis a mais: 4 no total, a 90° um do outro)
  const vivos = [b(5, 0, 'alvo'), b(5, -3, 'n'), b(8, 0, 'l')];
  const r = Secundarios.resolver({ efeito: { alvosExtras: 3, emCirculo: 1, doPontoDoAlvo: 1 }, tags: ['projectile'], origem: { x: 0, y: 0 }, alvo: vivos[0], atingidos: [vivos[0]], vivos, alcance: 7 });
  assert.ok(r.emitidos.slice(1).every((p) => p.de.x === 5 && p.de.y === 0), 'os outros saem do ponto do alvo');
  assert.equal(r.emitidos.length, 4);
  // (4 no total: 0°, 90°, 180°, 270° a partir do rumo — leste: o de 0° é o principal; 90° (sul), 180° (oeste), 270° (norte))
  assert.ok(r.golpes.some((g) => g.bicho.uid === 'n'), 'o de 270° pega o bicho ao norte do alvo');
  // a Saraivada: 2 a mais, de (0,1) e (0,−1), paralelos ao principal
  const v2 = [b(4, 0, 'alvo'), b(4, 1, 'sul'), b(4, -1, 'norte')];
  const s = Secundarios.resolver({ efeito: { alvosExtras: 2, origensLaterais: 2 }, tags: ['projectile'], origem: { x: 0, y: 0 }, alvo: v2[0], atingidos: [v2[0]], vivos: v2, alcance: 7 });
  assert.deepEqual(s.emitidos.slice(1).map((p) => [p.de.x, p.de.y]).sort(), [[0, -1], [0, 1]]);
  assert.deepEqual(s.golpes.map((g) => g.bicho.uid).sort(), ['norte', 'sul']);
  for (const slug of ['Volley_Support', 'Arrow_Nova_Support']) assert.deepEqual(efeitoDo(slug).naoFeitas, [], slug);
});

test('F7: o Rito Proibido em até N inimigos ao redor (só os que existem); a ordem do projétil; os simultâneos da Saraivada de Projéteis à parte', { skip: SEM }, () => {
  assert.equal(G.alvosNoNivel('Forbidden_Rite', 20, 20).aoRedor, 9);
  const b = (x, y, uid) => ({ uid, x, y, hp: 10 });
  const vivos = [b(3, 0, 'alvo'), b(-2, 0, 'x'), b(0, 2, 'y')];
  const r = Secundarios.resolver({ efeito: { aoRedor: 7 }, tags: ['projectile'], origem: { x: 0, y: 0 }, alvo: vivos[0], atingidos: [vivos[0]], vivos, alcance: 7 });
  assert.equal(r.emitidos.length, 3, '1 + os 2 bichos em volta (não 8)');
  assert.deepEqual(r.golpes.map((g) => g.ordem), [1, 2]);
  assert.equal(G.alvosNoNivel('Kinetic_Fusillade', 20, 20).porProjetilAnteriorPct, 12, '8 + 4 da qualidade');
  const bv = G.alvosNoNivel('Barrage_of_Volley_Fire', 20, 0);
  assert.equal(bv.simultaneos, 6, 'o primeiro e o último: 6 cada');
  assert.equal(bv.projeteis, 0, 'não entram na sequência (o PoB: não são ProjectileCount)');
});

test('revisão: a Saraivada de Projéteis — num alvo único, os 4 acertos da sequência; os simultâneos vão em leque nos OUTROS, sem repetir', { skip: SEM }, async () => {
  const so = await montar('Bows/Crude_Bow', 'Barrage_of_Volley_Fire', [], [[3, 0]], { af: { phys_add: 3000 } });
  const ev = usar(so.e, so.bichos[0]);
  assert.equal(ev.filter((x) => x.t === 'dmg' && x.foe && x.uid === so.bichos[0].uid).length, 4);
  const v = await montar('Bows/Crude_Bow', 'Barrage_of_Volley_Fire', [], [[3, 0], [2, 3], [2, -3], [4, 2]], { af: { phys_add: 3000 } });
  const ev2 = usar(v.e, v.bichos[0]);
  const n = (b) => ev2.filter((x) => x.t === 'dmg' && x.foe && x.uid === b.uid).length;
  assert.equal(n(v.bichos[0]), 4, 'o alvo: só a sequência');
  for (const b of v.bichos.slice(1)) assert.equal(n(b), 1, 'cada um dos outros: um simultâneo');
});

test('revisão: a Fuzilaria Cinética num alvo único — os extras vão no alvo, cada um maior que o anterior (+16% por projétil anterior)', { skip: SEM }, async () => {
  const { e, bichos: [b] } = await montar('Wands/Driftwood_Wand', 'Kinetic_Fusillade_of_Detonation', [], [[3, 0]], { af: { phys_add: 3000 } });
  const acertos = usar(e, b).filter((x) => x.t === 'dmg' && x.foe && x.uid === b.uid).map((x) => x.v);
  assert.equal(acertos.length, 3);
  assert.ok(Math.abs(acertos[1] / acertos[0] - 1.16) < 0.03 && Math.abs(acertos[2] / acertos[0] - 1.32) < 0.03, acertos.join(' '));
});

test('F7: o Localizar — +3 projéteis, um a menos por Intensidade (até 3), 20% mais por Intensidade, ao menos 1; a Mina Locus: 30% menos, para baixo', { skip: SEM }, () => {
  const p = efeitoDo('Pinpoint_Support').efeito;
  assert.equal(p.intensidadeMax, 3);
  assert.equal(p.intensidadeMenosProjetil, 1);
  assert.equal(p.intensidadeMaisProjetilPct, 20);
  assert.equal(p.projeteisMinimo, 1);
  assert.equal(SP.REGISTRO.get('Pinpoint_Support').status, 'funciona');
  const l = efeitoDo('Locus_Mine_Support').efeito;
  assert.equal(l.menosProjeteisPct, 30);
});

test('F7 no jogo: o Localizar no Pulso Congelante — 5 + 3 projéteis sem Intensidade; com 3 de Intensidade, 5 (um a menos por Intensidade)', { skip: SEM }, async () => {
  const { e, bichos: [b] } = await montar('Wands/Driftwood_Wand', 'Freezing_Pulse', ['Pinpoint_Support'], [[2, 0]]);
  const id = G.doSlug('Freezing_Pulse').acao;
  delete e.hunt.poeIntensidade;
  assert.equal(tiros(usar(e, b)).length, 8);
  e.hunt.poeIntensidade = { [id]: { n: 3, em: e.hunt.clock + 10_000 } };
  assert.equal(tiros(usar(e, b)).length, 5);
});

test('D1: o "dano com Arcos" pela velocidade de projétil — o "aumentada" do USO (os 69% do Projéteis Mais Rápidos) entra × o atributo da soma', { skip: SEM }, async () => {
  const { e } = await montar('Bows/Crude_Bow', 'Split_Arrow', ['Faster_Projectiles_Support'], [[1, 0]], { af: { 'dmg_inc%stat:projectile_speed@arco': 1 } });
  const entry = Acoes.POR_ID_PUBLICO(G.doSlug('Split_Arrow').acao);
  const efeito = GS.efeitoNaSkill(e, entry.id);
  const ficha = Acoes.comAsLinhasDaGema(e, Ficha.combate(e), entry, efeito);
  const doUso = (ficha.porTag ?? []).filter((x) => x.stat === 'dmg_inc' && x.tags.includes('arco') && x.tags.includes('habilidade'));
  assert.deepEqual(doUso.map((x) => x.valor), [efeito['af:projectile_speed']]);
});

// ---------------------------------------------------------------- F5 e F6: a divisão, as rebatidas, o salto no solo

test('D5: a DIVISÃO do PoE — o projétil se divide no alvo atingido em N para os mais próximos dele; os que sobram saem e erram', () => {
  const b = (x, y, uid) => ({ uid, x, y, hp: 10 });
  const vivos = [b(3, 0, 'alvo'), b(5, 1, 'perto'), b(-6, 0, 'atras')];
  const r = Secundarios.resolver({ efeito: { divisao: 3 }, tags: ['projectile'], origem: { x: 0, y: 0 }, alvo: vivos[0], atingidos: [vivos[0]], vivos, alcance: 7 });
  const divisao = r.golpes.filter((g) => g.tipo === 'divisao');
  assert.deepEqual(divisao.map((g) => [g.bicho.uid, g.de.x, g.de.y, g.pct]), [['perto', 3, 0, 100]], 'do alvo para o mais perto dele (o de trás de você está a 9 dele)');
  assert.equal(r.emitidos.filter((p) => p.tipo === 'divisao').length, 2, 'os 2 sem bicho saem do alvo e erram');
  // "Projéteis podem se Dividir sem acertar um alvo": o que erra se divide no fim do voo
  const s = Secundarios.resolver({ efeito: { divisao: 2, dividirSemAcertar: true }, tags: ['projectile'], origem: { x: 0, y: 0 }, alvo: null, atingidos: [], vivos: [b(7, 1, 'fim')], alcance: 7, rumo: { x: 1, y: 0 } });
  assert.deepEqual(s.golpes.map((g) => [g.bicho.uid, g.tipo]), [['fim', 'divisao']]);
});

test('D5 no jogo: o Aço Violento e a Flecha Dividida da Divisão — os projéteis a mais viram alvos da divisão; "não podem se Partir" zera', { skip: SEM }, async () => {
  const a = G.alvosNoNivel('Split_Arrow_of_Splitting', 20, 20);
  assert.equal(a.partir, 8);
  assert.ok(a.extrasNaDivisao && a.partirSemAcertar);
  assert.ok(G.alvosNoNivel('Vaal_Lightning_Arrow', 20).semPartir);
  const { e, bichos: [alvo, x, y] } = await montar('Bows/Crude_Bow', 'Split_Arrow_of_Splitting', [], [[2, 0], [3, 1], [3, -1]]);
  const entry = Acoes.POR_ID_PUBLICO(G.doSlug('Split_Arrow_of_Splitting').acao);
  const ef = Acoes.comOsAlvosDaGema(entry, GS.efeitoNaSkill(e, entry.id), e);
  assert.equal(ef.alvosExtras, 0, 'nenhum projétil a mais de você');
  assert.equal(ef.divisao, 6);
  const ev = usar(e, alvo);
  assert.ok(danoEm(ev, x) > 0 && danoEm(ev, y) > 0, 'os dois perto do alvo levam a divisão');
  assert.equal(tiros(ev).length, 7, '1 + 6 da divisão (4 erram)');
});

test('D6: a Hélice só rebate em PAREDE (100%); a Vaal Flecha Relampejante muda de direção 9 vezes nos mais perto; o Magma salta no solo a cada 3 casas', { skip: SEM }, () => {
  assert.equal(G.alvosNoNivel('Spectral_Helix', 20).rebatidas, 3);
  assert.ok(G.alvosNoNivel('Spectral_Helix', 20).rebatidasNoTerreno);
  assert.ok(!G.alvosNoNivel('Vaal_Lightning_Arrow', 20).rebatidasNoTerreno);
  assert.ok(G.alvosNoNivel('Rolling_Magma', 20).saltoNoSolo);
  const b = (x, y, uid) => ({ uid, x, y, hp: 10 });
  const vivos = [b(2, 0, 'alvo'), b(4, 1, 'r1'), b(6, 2, 'r2'), b(20, 0, 'longe')];
  // a Hélice em campo aberto: sem parede, não rebate
  const aberto = Secundarios.resolver({ efeito: { rebatidas: 3, rebatidasNoTerreno: true, ricochetePoe: true }, tags: ['projectile'], origem: { x: 0, y: 0 }, alvo: vivos[0], atingidos: [vivos[0]], vivos, alcance: 7, rng: () => 0.9 });
  assert.deepEqual(aberto.golpes, []);
  // com uma parede em x = 5 (as casas x ≥ 5 não se andam): bate em (4,0) e salta para o mais perto da batida (r1 em (4,1))
  const andavel = new Set();
  for (let x = -10; x < 5; x++) for (let y = -10; y <= 10; y++) andavel.add(`${x},${y}`);
  const comParede = Secundarios.resolver({ efeito: { rebatidas: 1, rebatidasNoTerreno: true, ricochetePoe: true }, tags: ['projectile'], origem: { x: 0, y: 0 }, alvo: vivos[0], atingidos: [vivos[0]], vivos, alcance: 7, rng: () => 0.9, andavel });
  assert.deepEqual(comParede.golpes.map((g) => [g.bicho.uid, g.tipo, g.pct, g.de.x, g.de.y]), [['r1', 'rebatida', 100, 4, 0]]);
  // a Vaal Flecha Relampejante de verdade: 9 mudanças de direção, para os mais perto a 3 casas (sem parede)
  const vla = Acoes.comOsAlvosDaGema(Acoes.POR_ID_PUBLICO(G.doSlug('Vaal_Lightning_Arrow').acao), { nivel: 20, qualidade: 0 }, null);
  assert.equal(vla.rebatidas, 9);
  assert.ok(!vla.rebatidasNoTerreno);
  const r = Secundarios.resolver({ efeito: { ...vla, alvosExtras: 0, projeteisBase: 1, perfurar: 0, ricochetePoe: true }, tags: ['projectile'], origem: { x: 0, y: 0 }, alvo: vivos[0], atingidos: [vivos[0]], vivos, alcance: 7, rng: () => 0.9 });
  assert.deepEqual(r.golpes.map((g) => [g.bicho.uid, g.tipo, g.pct]), [['r1', 'rebatida', 100], ['r2', 'rebatida', 100]], 'sem bicho a 3 casas, as outras se perdem');
  // o salto no solo: alvo em (2,0) → áreas em (5,0) e (8,0), 3×3
  const v2 = [b(2, 0, 'alvo'), b(5, 1, 's1'), b(8, -1, 's2'), b(6, 3, 'fora')];
  const m = Secundarios.resolver({ efeito: { encadear: 2, saltoNoSolo: true }, tags: ['projectile'], origem: { x: 0, y: 0 }, alvo: v2[0], atingidos: [v2[0]], vivos: v2, alcance: 7 });
  assert.deepEqual(m.golpes.map((g) => [g.bicho.uid, g.de.x, g.de.y]), [['s1', 5, 0], ['s2', 8, 0]]);
  // (revisão: um extra que voa reto no eixo y segue no eixo y, mesmo com o rumo principal no eixo x)
  const v3 = [b(5, 0, 'A'), b(0, 4, 'B'), b(0, 7, 'C'), b(3, 7, 'D')];
  const m3 = Secundarios.resolver({ efeito: { alvosExtras: 1, encadear: 1, saltoNoSolo: true }, tags: ['projectile'], origem: { x: 0, y: 0 }, alvo: v3[0], atingidos: [v3[0]], vivos: v3, alcance: 7 });
  const doExtra = m3.golpes.filter((g) => g.tipo === 'encadeamento' && g.de.x === 0);
  assert.ok(doExtra.some((g) => g.bicho.uid === 'C') && !m3.golpes.some((g) => g.bicho.uid === 'D'), JSON.stringify(m3.golpes.map((g) => [g.bicho.uid, g.de])));
});

test('revisão: o projétil que se difundiu não rebate nem retorna; com "atravessa todos" (99) não difunde', () => {
  const b = (x, y, uid) => ({ uid, x, y, hp: 10 });
  const vivos = [b(1, 0, 'A'), b(2, 0, 'B'), b(3, 2, 'C'), b(4, 4, 'D')];
  const r = Secundarios.resolver({ efeito: { perfurar: 99, rebatidas: 3, bifurcar: 2, ricochetePoe: true }, tags: ['projectile'], origem: { x: 0, y: 0 }, alvo: vivos[0], atingidos: [vivos[0]], vivos, alcance: 7, rng: () => 0.9 });
  assert.ok(!r.golpes.some((g) => g.tipo === 'bifurcacao'), 'o atravessar tem prioridade');
  const f = Secundarios.resolver({ efeito: { bifurcar: 2, rebatidas: 3, retornar: 1, ricochetePoe: true }, tags: ['projectile'], origem: { x: 0, y: 0 }, alvo: vivos[0], atingidos: [vivos[0]], vivos, alcance: 7, rng: () => 0.9 });
  assert.ok(f.golpes.some((g) => g.tipo === 'bifurcacao'));
  assert.ok(!f.golpes.some((g) => g.tipo === 'rebatida' || g.tipo === 'retorno'), JSON.stringify(f.golpes.map((g) => g.tipo)));
});

test('revisão: na Materialização a ida não atravessa ninguém — a volta conta os atravessados dela (0, 1, 2)', () => {
  const b = (x, y, uid) => ({ uid, x, y, hp: 10 });
  const vivos = [b(1, 0, 'A'), b(2, 0, 'B'), b(3, 0, 'C')];
  const r = Secundarios.resolver({ efeito: { perfurar: 99, retornar: 1, voltaAtravessa: 1, soNaVolta: true }, tags: ['projectile'], origem: { x: 0, y: 0 }, alvo: vivos[0], atingidos: [vivos[0]], vivos, alcance: 7 });
  assert.deepEqual(r.golpes.map((g) => [g.bicho.uid, g.tipo, g.atravessados]), [['C', 'retorno', 0], ['B', 'retorno', 1], ['A', 'retorno', 2]]);
});

test('revisão: o Raio Cinético não se difunde (a Difusão viraria mudança de direção, que não se aplica); a Vaal Flecha Relampejante segue o PoB; a Flecha Galvânica fica parcial', { skip: SEM }, async () => {
  const { e } = await montar('Wands/Driftwood_Wand', 'Kinetic_Bolt', ['Greater_Fork_Support'], [[2, 0]]);
  const entry = Acoes.POR_ID_PUBLICO(G.doSlug('Kinetic_Bolt').acao);
  const ef = Acoes.comOsAlvosDaGema(entry, GS.efeitoNaSkill(e, entry.id), e);
  assert.equal(ef.bifurcar, 0);
  assert.equal(ef.bifurcarDeNovo, 0);
  const vla = G.alvosNoNivel('Vaal_Lightning_Arrow', 20);
  assert.equal(vla.base, 5);
  assert.equal(vla.projeteis, 0, 'sem os "Projéteis adicionais" da tabela errada');
  assert.ok(Math.abs(G.eficaciaNoNivel('Vaal_Lightning_Arrow', 20) - 0.897) < 1e-9);
  assert.ok(Math.abs(G.eficaciaNoNivel('Vaal_Lightning_Arrow', 1) - 0.713) < 1e-9);
  // (lote PR1, dono 20/10 — aval: o cone da Galvânica existe, com a Velocidade de Projéteis na Área: ela fica completa)
  assert.equal(G.doSlug('Galvanic_Arrow').statusNoJogo, 'funciona');
});

test('os triviais: a Vaal Faísca em direções aleatórias; o feixe com "+"; a Difusão Maior soma o "Difundir de novo" e a chance', { skip: SEM }, async () => {
  assert.ok(G.alvosNoNivel('Vaal_Spark', 20).direcoesAleatorias);
  // (lote B1, dono 20/10 — aval: a tabela do poedb dá 9 no nível 20, não os 7 da tabela copiada)
  assert.equal(G.alvosNoNivel('Arc_of_Surging', 20, 20).divide, 11, '9 + 2 da qualidade');
  const { e } = await montar('Bows/Crude_Bow', 'Split_Arrow', ['Greater_Fork_Support'], [[1, 0]]);
  const entry = Acoes.POR_ID_PUBLICO(G.doSlug('Split_Arrow').acao);
  const doSuporte = GS.efeitoNaSkill(e, entry.id);
  const ef = Acoes.comOsAlvosDaGema(entry, doSuporte, e);
  assert.equal(ef.bifurcarDeNovo, 1);
  assert.ok(doSuporte.bifurcarExtraChance > 0);
  assert.equal(ef.bifurcarExtraChance, doSuporte.bifurcarExtraChance, 'o do suporte (antes a linha das peças o sobrescrevia com 0)');
  assert.deepEqual(efeitoDo('Greater_Fork_Support').naoFeitas, []);
});

test('as linhas que não se aplicam (só a trajetória) saem dos motivos e ficam como nota', { skip: SEM }, () => {
  assert.ok(!G.doSlug('Ice_Spear').motivosNoJogo.some((m) => /Segunda forma possui [\d.]+ ?% mais Velocidade/.test(m)));
  assert.ok(G.doSlug('Ice_Spear').linhasNaoSeAplicam?.some((n) => /^não se aplica:/.test(n)));
  assert.ok(!G.doSlug('Spectral_Throw_of_Materialising').motivosNoJogo.length, G.doSlug('Spectral_Throw_of_Materialising').motivosNoJogo.join(' | '));
  assert.ok(!G.doSlug('Kinetic_Bolt').motivosNoJogo.some((m) => /mudam de direção/.test(m)));
  // (aval do dono, 26/10 — lote E1a: a velocidade de projétil da gema de totem vale no tiro do totem, que sai pelo seu uso desde o G20a; a linha saiu dos motivos)
  assert.ok(!G.doSlug('Holy_Flame_Totem_of_Ire').motivosNoJogo.includes('efeito não simulado: 128 % mais Velocidade de Projétil'));
});
