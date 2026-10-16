// ZERAR A ÁRVORE — LOTE 45: P061 a RAJADA VULCÂNICA (as Chamas de Ngamahu do Reliquarian: "Ativa Rajada Vulcânica nível 20 ao atingir corpo a
// corpo") — cada acerto rola o CRÍTICO do ataque (a chance e o multiplicador da ficha do golpe; o "sempre"/"nunca" crítico e a Sorte das linhas
// do PoE) e a área de cada queda cresce com a "Área de Efeito aumentada", como toda área (dono, 16/10: "Toda área em metros").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste } = await import('./apoio.mjs');
const Acoes = await import('../systems/acoes.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Plantadas = await import('../systems/itens-poe/armas-plantadas.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');

const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 70, rng: () => 0.5 }));
/** Um personagem do PoE numa caçada com um Machado Vaal (`af` nele). */
function personagem(af = {}) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 80 });
  e.sistema = 'poe';
  e.classePoe = 'Marauder';
  const arma = peca('Two_Hand_Axes/Vaal_Axe');
  arma.poe.af = { ...(arma.poe.af ?? {}), rajada_vulcanica: 20, ...af };
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
/** O alvo a 1 casa e um bicho a `dx` casas dele (os outros, longe), com vida de sobra e sem resistência. */
function bichos(e, dx = 1) {
  const h = e.hunt;
  const [a, b, ...outros] = h.monstros;
  for (const o of outros) Object.assign(o, { x: h.pos.x + 60, y: h.pos.y + 60 });
  Object.assign(a, { x: h.pos.x + 1, y: h.pos.y, hp: 1e9, maxHp: 1e9, estados: {}, dots: [] });
  Object.assign(b, { x: a.x + dx, y: a.y, hp: 1e9, maxHp: 1e9, estados: {}, dots: [] });
  return [a, b];
}

test('P061 — a RAJADA VULCÂNICA rola o CRÍTICO do ataque em cada acerto: o "sempre crítico" multiplica pelo multiplicador da ficha; o "nunca", não', { skip: SEM }, () => {
  // (o mesmo personagem e o mesmo bicho — a raridade dele é sorteada ao entrar —, só a linha trocada)
  const e0 = personagem({ nunca_critico: 1 });
  const [a0] = bichos(e0, 1);
  const golpe = (af) => {
    Object.assign(e0.equipment.weapon.poe.af, { nunca_critico: 0, critico_sempre: 0, ...af });
    Ficha.invalidar(e0);
    e0.hunt.clock += 1000;
    const eventos = [];
    Acoes.rajadaVulcanica(e0, e0.hunt, a0, eventos, () => 0.5);
    return eventos.filter((x) => x.t === 'dmg' && x.uid === a0.uid);
  };
  const sem = golpe({ nunca_critico: 1 });
  const com = golpe({ critico_sempre: 1 });
  assert.equal(sem.length, 4);
  assert.ok(sem.every((g) => g.crit === false));
  assert.ok(com.every((g) => g.crit === true));
  const mult = ModsPoe.fichaDoGolpe(Ficha.combate(e0), ['ataque', 'projetil', 'area', 'fogo', 'fisico'], { alvo: a0, estado: e0 }).critMultiplier;
  assert.ok(mult > 1, `o multiplicador da ficha: ${mult}`);
  assert.ok(Math.abs(com[0].v / sem[0].v - mult) < 0.01, `${com[0].v} ÷ ${sem[0].v} = ${mult}`);
  // (com a chance de verdade: o sorteio abaixo da chance é crítico; acima, não)
  const e = personagem();
  const [a] = bichos(e, 1);
  const chance = ModsPoe.fichaDoGolpe(Ficha.combate(e), ['ataque', 'projetil', 'area', 'fogo', 'fisico'], { alvo: a, estado: e }).critChance;
  assert.ok(chance > 0 && chance < 1);
  const ev = [];
  Acoes.rajadaVulcanica(e, e.hunt, a, ev, () => Math.min(0.999, chance + 0.01));
  assert.ok(ev.filter((x) => x.t === 'dmg').every((g) => g.crit === false), 'acima da chance: sem crítico');
});

test('P061 — a ÁREA de cada queda (a casa e as vizinhas) cresce com a "Área de Efeito aumentada": +300% (× 2 no raio) pega o bicho a 2 casas', { skip: SEM }, () => {
  const acerta = (af) => {
    const e = personagem(af);
    const [a, b] = bichos(e, 2);
    const eventos = [];
    // (rng 0: os 4 caem no alvo — o primeiro dos que estão perto; +300% dá exatamente 1 casa a mais, sem fração)
    Acoes.rajadaVulcanica(e, e.hunt, a, eventos, () => 0);
    return eventos.filter((x) => x.t === 'dmg' && x.uid === b.uid).length;
  };
  assert.equal(acerta({}), 0, 'a 2 casas, fora da área de 1');
  assert.equal(acerta({ area_inc: 300 }), 4, 'raio 1 × √4 = 2');
});

test('as linhas: a Rajada Vulcânica e o Detonar Minas andando, equivalentes (as exceções registradas pelo dono)', { skip: SEM }, () => {
  for (const [modelo, valores] of [['Ativa Rajada Vulcânica nível {0} ao atingir corpo a corpo', [20]], ['Detonar Minas é Ativado enquanto você se mover', []]]) {
    const t = T.traduzirMod({ modelo, valores });
    assert.equal(t.estado, 'equivalente', modelo);
    assert.match(t.partes[0].nota, /exceção do dono/);
  }
});

test('P012 — o DETONAR MINAS automático respeita a recarga de 0,2 s do poedb: a Mina plantada logo depois de um uso espera', { skip: SEM }, () => {
  assert.equal(Plantadas.PADRAO.mina.recargaMs, 200);
  const e = personagem();
  const h = e.hunt;
  const [a] = bichos(e, 1);
  const ficha = Ficha.combate(e);
  const t0 = h.clock;
  Plantadas.plantar(h, ficha, { tipo: 'mina', acao: 'x', slot: 0, x: a.x, y: a.y + 1, duracaoMs: 5000, agora: t0 });
  assert.equal(Plantadas.minasQueDetonam(h, ficha, t0).length, 1, 'a primeira, na hora');
  // (a detonada sai — o que o tique das plantadas faz)
  h.plantadas = h.plantadas.filter((p) => p.detonaEm == null);
  Plantadas.plantar(h, ficha, { tipo: 'mina', acao: 'x', slot: 0, x: a.x, y: a.y + 1, duracaoMs: 5000, agora: t0 + 100 });
  Plantadas.minasQueDetonam(h, ficha, t0 + 100);
  const nova = () => Plantadas.plantadas(h, 'mina', t0 + 100).find((p) => p.desde === t0 + 100);
  assert.equal(nova().detonaEm, undefined, 'na recarga: o atalho ainda não pode');
  Plantadas.minasQueDetonam(h, ficha, t0 + 200);
  assert.equal(nova().detonaEm, t0 + 200, 'passados 0,2 s, detona');
});
