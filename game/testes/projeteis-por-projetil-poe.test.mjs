// Os PROJÉTEIS POR PROJÉTIL da árvore do PoE (dono, 13/10: "pode seguir com os projéteis por projétil") de ponta a ponta: cada projétil conta
// os inimigos que atravessou e as vezes que ricocheteou ("Projéteis causam Dano aumentado em X% … para cada Inimigo Atravessado / para cada
// vez que Ricochetearam"), a difusão com um projétil a mais, o Caos extra nos que ricochetearam (a Presa Sombria) e o dano pela distância nas
// habilidades (o Tiro Longo) — com a gema real (a Perfuração, um projétil só) e os nós reais da árvore.
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
const Secundarios = await import('../systems/skills/golpes-secundarios.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');

/** Um arqueiro com a Perfuração (um projétil só) no arco, na barra, numa caçada do PoE; `af`: atributos no arco. */
function arqueiro(af = {}) {
  const e = personagemDeTeste({ vocacao: 'paladin', level: 60 });
  e.sistema = 'poe';
  e.classePoe = 'Ranger';
  const arco = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Bows/Crude_Bow', raridade: 'normal', ilvl: 20, rng: () => 0.99 }));
  arco.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
  // (o golpe forte, para o arredondamento não pesar nas proporções)
  arco.poe.af = { ...(arco.poe.af ?? {}), phys_add: 3000, ...af };
  e.equipment = { ...(e.equipment ?? {}), weapon: arco };
  e.inventory = [GS.itemDaGema({ id: G.doSlug('Puncture').itemId, nivel: 1, xp: 0, raridade: 'comum' })];
  GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: G.doSlug('Puncture').acao, enabled: true, minMana: 0, conditions: [] };
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 100_000;
  e.maxHp = e.hp = 1e6;
  P.garantir(e);
  return e;
}
/**
 * Os bichos da caçada em `posicoes` ([dx, dy] de você): todos IGUAIS a um modelo — um monstro Normal sem modificadores (a raridade e os mods são
 * sorteados ao entrar na caçada: cada personagem do teste teria bichos diferentes) —, com muita vida; os outros longe.
 */
let MODELO = null;
function bichos(e, posicoes) {
  MODELO ??= structuredClone(e.hunt.monstros.find((m) => (m.raridade ?? 'normal') === 'normal' && !m.mods?.length && !m.esPoe) ?? e.hunt.monstros[0]);
  const lista = e.hunt.monstros;
  lista.forEach((m, i) => {
    const p = posicoes[i];
    if (!p) return Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60 });
    const uid = m.uid;
    for (const k of Object.keys(m)) delete m[k];
    Object.assign(m, structuredClone(MODELO), { uid, x: e.hunt.pos.x + p[0], y: e.hunt.pos.y + p[1], hp: 1e9, maxHp: 1e9, estados: {}, dots: [] });
  });
  return lista.slice(0, posicoes.length);
}
/** Um disparo da Perfuração no primeiro bicho, com o acaso fixo; o dano em cada bicho (por uid). */
function disparo(e, alvos) {
  const antes = Math.random;
  Math.random = () => 0.5;
  try {
    e.hunt.clock += 10_000;
    const r = Acoes.disparar(e, e.hunt, PERSONAGEM, 0, alvos[0], {});
    assert.ok(r.ok, r.erro);
    return alvos.map((b) => (r.eventos ?? []).filter((x) => x.t === 'dmg' && x.foe && x.uid === b.uid).reduce((t, x) => t + x.v, 0));
  } finally {
    Math.random = antes;
  }
}

test('o RESOLVEDOR marca em cada golpe o que o projétil já fez: os inimigos que atravessou e as vezes que ricocheteou; a difusão ganha um filho a mais com a chance', () => {
  const b = (x, y, uid) => ({ uid, x, y, hp: 10 });
  const fila = [b(2, 0, 'a'), b(3, 0, 'b'), b(4, 0, 'c')];
  const p = Secundarios.resolver({ efeito: { perfurar: 5 }, tags: ['projectile', 'single'], origem: { x: 0, y: 0 }, alvo: fila[0], atingidos: [fila[0]], vivos: fila, alcance: 8 });
  assert.deepEqual(p.golpes.filter((g) => g.tipo === 'perfuracao').map((g) => [g.bicho.uid, g.atravessados]), [['b', 1], ['c', 2]]);
  const c = Secundarios.resolver({ efeito: { encadear: 2 }, tags: ['projectile', 'single'], origem: { x: 0, y: 0 }, alvo: fila[0], atingidos: [fila[0]], vivos: fila, alcance: 8 });
  assert.deepEqual(c.golpes.filter((g) => g.tipo === 'encadeamento').map((g) => [g.bicho.uid, g.ricochetes]), [['b', 1], ['c', 2]]);
  const volta = [b(2, 0, 'a'), b(2, 2, 'b'), b(2, -2, 'c'), b(4, 1, 'd')];
  const dois = Secundarios.resolver({ efeito: { bifurcar: 2 }, tags: ['projectile', 'single'], origem: { x: 0, y: 0 }, alvo: volta[0], atingidos: [volta[0]], vivos: volta, alcance: 8 });
  const tres = Secundarios.resolver({ efeito: { bifurcar: 2, bifurcarExtraChance: 100 }, tags: ['projectile', 'single'], origem: { x: 0, y: 0 }, alvo: volta[0], atingidos: [volta[0]], vivos: volta, alcance: 8, rng: () => 0 });
  assert.equal(dois.golpes.filter((g) => g.tipo === 'bifurcacao').length, 2);
  assert.equal(tres.golpes.filter((g) => g.tipo === 'bifurcacao').length, 3, 'um projétil a mais ao Difundir');
});

test('"Dano aumentado em 20% … para cada Inimigo Atravessado": o 2º bicho da fila leva +20% (somado aos aumentos), o 3º +40%; o 1º, nada', { skip: SEM }, () => {
  const com = arqueiro({ perfurar: 5, proj_inc_por_atravessado: 20 });
  const sem = arqueiro({ perfurar: 5 });
  const posicoes = [[2, 0], [3, 0], [4, 0]];
  const dCom = disparo(com, bichos(com, posicoes));
  const dSem = disparo(sem, bichos(sem, posicoes));
  assert.ok(dSem.every((d) => d > 0), `${dSem}`);
  const r = dCom.map((d, i) => d / dSem[i]);
  assert.ok(Math.abs(r[0] - 1) < 0.02, `o primeiro sem bônus: ${r}`);
  assert.ok(r[1] > 1.02, `o segundo com bônus: ${r}`);
  assert.ok(Math.abs((r[2] - 1) - 2 * (r[1] - 1)) < 0.03, `o terceiro com o dobro do aumento: ${r}`);
});

test('"… para cada vez que Ricochetearam" e a Presa Sombria ("Projéteis que Ricochetearam ganham 20% de Dano Não-Caótico como Caos extra")', { skip: SEM }, () => {
  const posicoes = [[2, 0], [2, 3], [2, 6]];
  const sem = arqueiro({ ricochetes: 2 });
  const dSem = disparo(sem, bichos(sem, posicoes));
  assert.ok(dSem.every((d) => d > 0), `${dSem}`);
  const ric = arqueiro({ ricochetes: 2, proj_inc_por_ricochete: 20 });
  const r = disparo(ric, bichos(ric, posicoes)).map((d, i) => d / dSem[i]);
  assert.ok(Math.abs(r[0] - 1) < 0.02 && r[1] > 1.02 && Math.abs((r[2] - 1) - 2 * (r[1] - 1)) < 0.03, `${r}`);
  const caos = arqueiro({ ricochetes: 2, proj_ricochete_caos_extra: 20 });
  const c = disparo(caos, bichos(caos, posicoes)).map((d, i) => d / dSem[i]);
  assert.ok(Math.abs(c[0] - 1) < 0.02, `o primeiro não ricocheteou: ${c}`);
  assert.ok(c[1] > 1.05 && c[2] > 1.05, `os outros, com o Caos extra: ${c}`);
});

test('o TIRO LONGO nas habilidades: "Dano aumentado em até 60% com Acertos" — a 6 casas, todo; colado, nada (e no golpe básico, pela ficha do golpe)', { skip: SEM }, () => {
  const longe = (af) => { const e = arqueiro(af); return disparo(e, bichos(e, [[6, 0]]))[0]; };
  const perto = (af) => { const e = arqueiro(af); return disparo(e, bichos(e, [[1, 0]]))[0]; };
  assert.ok(longe({ projetil_longe_inc: 60 }) / longe({}) > 1.1, 'longe: com o aumento');
  assert.ok(Math.abs(perto({ projetil_longe_inc: 60 }) / perto({}) - 1) < 0.02, 'colado: sem');
  const e = arqueiro({ projetil_longe_inc: 60 });
  const [b] = bichos(e, [[6, 0]]);
  const f = ModsPoe.fichaDoGolpe(Ficha.combate(e), ['ataque', 'projetil', 'arco'], { alvo: b, estado: e });
  const f0 = ModsPoe.fichaDoGolpe(Ficha.combate(arqueiro()), ['ataque', 'projetil', 'arco'], { alvo: b, estado: e });
  assert.equal((f.danoDoElemento?.physical ?? 0) - (f0.danoDoElemento?.physical ?? 0), 60);
});

test('a ÁRVORE: as 10 linhas dos projéteis por projétil têm efeito no balão', { skip: SEM }, () => {
  const linhas = P.arvore().nos.flatMap((n) => [n, ...(n.opcoes ?? [])].flatMap((o) => (o.textos ?? []).map((t, i) => ({ t, estado: o.estados?.[i] }))));
  const achadas = linhas.filter((l) => /Inimigo Atravessado|vez que Ricochetearam|quando Difundindo|Projéteis que Ricochetearam|conforme viajam adiante/.test(l.t));
  assert.equal(achadas.length, 10);
  for (const l of achadas) assert.ok(['equivalente', 'novo', 'aproximado'].includes(l.estado), `${l.t}: ${l.estado}`);
});
