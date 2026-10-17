// ZERAR A ÁRVORE — LOTE 39 (dono, 16/10: "fiz o merge, faça o deploy e depois siga" — o Mercenário completo, as GEMAS em área e com projéteis):
// o golpe do mercenário com a gema da vez acerta como a gema — a ÁREA da forma (em volta dele ou no alvo, esticada pela Área de Efeito das
// peças dele, como a sua), os SALTOS da cadeia (o Arco) e os PROJÉTEIS a mais dos suportes e da gema (a Flecha Dividida) pelo mesmo motor do
// seu disparo; na caçada, os outros monstros levam o golpe.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Acoes = await import('../systems/acoes.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const M = await import('../systems/itens-poe/mercenarios.mjs');
const GemasPoe = await import('../systems/itens-poe/gemas-poe.mjs');
const Areas = await import('../engine/areas.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
}

const ANEL = Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'might ring')?.id);
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 40, rng: () => 0.5 }));
function dono() {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 50 }), { sistema: 'poe', classePoe: 'Scion' });
  e.equipment.ring = { id: ANEL, count: 1, af: [], poe: { af: { mercenario: 1 } } };
  P.garantir(e);
  Ficha.invalidar(e);
  return e;
}
function mercenario(e, arquetipo, habilidade = 0) {
  const merc = { ...M.candidato(50, () => 0.5), arquetipo, equipment: {}, doJogador: {} };
  const d = M.dados(e);
  d.contratados = [merc];
  d.ativo = merc.id;
  const f = Acoes.fichaDoMercenario(e, merc);
  return { merc, l: { mercenario: true, mercId: merc.id, x: 10, y: 10, habilidades: f.habilidades, habilidade } };
}
/** Monstros numa grade a cada 2 casas em volta de (10, 10), até 6 casas. */
const grade = () => {
  const vivos = [];
  for (let dx = -6; dx <= 6; dx += 2) for (let dy = -6; dy <= 6; dy += 2) if (dx || dy) vivos.push({ uid: `b${dx},${dy}`, x: 10 + dx, y: 10 + dy, hp: 100 });
  return vivos;
};

// (17/10, lote G2 — o dono: "Aplicar raio do PoE") a Nova de Gelo tem o raio do PoE (2,6 a 3 m = 1,3 a 1,5 casa: no sorteio 0,5, o losango de
// 1 casa — `Acoes.formaNoRaioDoPoe`), não as 5 casas da magia-molde.
test('a ÁREA: a Nova de Gelo do criomante pega o losango do raio do PoE em volta dele; com +300% de Área de Efeito nas peças dele, o raio dobra', { skip: SEM }, () => {
  const e = dono();
  const { merc, l } = mercenario(e, 'criomante', 1);
  assert.equal(l.habilidades[1].gema, 'Ice_Nova');
  const vivos = grade();
  const alvo = vivos.find((b) => b.x === 12 && b.y === 10);
  const dentro = (r) => vivos.filter((b) => b !== alvo && Math.abs(b.x - 10) + Math.abs(b.y - 10) <= r).length;
  const r = Acoes.alvosDoGolpeDoMercenario(e, l, alvo, vivos, () => 0.5);
  assert.equal(r.golpes.length, dentro(1));
  assert.ok(r.golpes.every((g) => g.tipo === 'area'));
  assert.equal(r.eventos[0].t, 'area');
  // um amuleto com +300% de Área de Efeito NELE: × √4 = o raio 2 (1 × (2 − 1) = 1 casa inteira, sem sorteio — `Areas.escalarForma`)
  const amuleto = peca('Amulets/Coral_Amulet');
  amuleto.poe.af = { ...amuleto.poe.af, area_inc: 300 };
  merc.equipment.neck = amuleto;
  merc.v = 1;
  const r2 = Acoes.alvosDoGolpeDoMercenario(e, l, alvo, vivos, () => 0.5);
  const forma = Areas.escalarForma(Acoes.POR_ID_PUBLICO(GemasPoe.doSlug('Ice_Nova').acao).forma, 1);
  const esticada = Areas.dentro(Areas.daForma(Areas.escalarForma(forma, 2), { x: 10, y: 10 }), vivos).filter((b) => b !== alvo).length;
  assert.equal(r2.golpes.length, esticada);
  assert.ok(esticada > dentro(1));
});

test('os PROJÉTEIS: a Flecha Dividida do arqueiro dispara os projéteis da gema, cada um num inimigo', { skip: SEM }, () => {
  const e = dono();
  const { l } = mercenario(e, 'arqueiro', 0);
  assert.equal(l.habilidades[0].gema, 'Split_Arrow');
  const vivos = grade();
  const alvo = vivos.find((b) => b.x === 12 && b.y === 10);
  const r = Acoes.alvosDoGolpeDoMercenario(e, l, alvo, vivos, () => 0.5);
  // ("Dispara 8 projéteis": a base da gema — `alvosNoNivel(...).base` — o principal e os outros 7)
  const n = GemasPoe.alvosNoNivel('Split_Arrow', l.habilidades[0].nivel).base;
  assert.ok(n >= 2);
  assert.equal(r.emitidos.length, n);
  assert.equal(new Set(r.golpes.map((g) => g.bicho)).size, n - 1, 'os outros, cada um num inimigo diferente');
});

test('a CADEIA: o Arco do eletromante salta pelos inimigos perto, quantos a gema diz', { skip: SEM }, () => {
  const e = dono();
  const { l } = mercenario(e, 'eletromante', 1);
  assert.equal(l.habilidades[1].gema, 'Arc');
  const vivos = grade();
  const alvo = vivos.find((b) => b.x === 12 && b.y === 10);
  const r = Acoes.alvosDoGolpeDoMercenario(e, l, alvo, vivos, () => 0.5);
  const { saltos } = GemasPoe.alvosNoNivel('Arc', l.habilidades[1].nivel);
  assert.equal(r.golpes.length, saltos, `${saltos} saltos`);
  assert.ok(r.golpes.every((g) => g.tipo === 'cadeia' && g.de));
  assert.ok(!r.golpes.some((g) => g.bicho === alvo), 'não volta no alvo');
});

test('na CAÇADA: o golpe da Nova de Gelo do mercenário fere os monstros em volta, não só o alvo', { skip: SEM }, () => {
  const e = dono();
  const { merc } = mercenario(e, 'criomante');
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  const h = e.hunt;
  Object.assign(e, { hp: 1e7, maxHp: 1e7 });
  let t = Date.now();
  Acoes.tiqueDoMercenario(e, h, t);
  const l = h.lacaios.find((x) => x.mercenario && x.mercId === merc.id);
  assert.ok(l);
  // a Nova (a 2ª gema), e três monstros colados nele, imortais
  l.habilidade = 1;
  Acoes.depoisDoGolpeDoMercenario(l);
  Acoes.depoisDoGolpeDoMercenario(l);
  assert.equal(l.habilidades[l.habilidade].gema, 'Ice_Nova');
  const ms = h.monstros.filter((m) => !m.dummy).slice(0, 3);
  h.monstros = ms;
  ms.forEach((m, i) => Object.assign(m, { x: l.x + [1, -1, 0][i], y: l.y + [0, 0, 1][i], hp: 1e9, maxHp: 1e9, estados: {} }));
  const original = Math.random;
  let feridos = 0;
  try {
    Math.random = () => 0.5;
    for (let i = 0; i < 12 && feridos < 2; i++) {
      l.proximoGolpe = 0;
      l.habilidade = l.habilidades.findIndex((x) => x.gema === 'Ice_Nova');
      Cacadas.tique(e, PERSONAGEM, (t += 250));
      feridos = ms.filter((m) => m.hp < 1e9).length;
    }
  } finally { Math.random = original; }
  assert.ok(feridos >= 2, `feridos: ${feridos}`);
});

test('P060 — a AURA do arquétipo vale em você enquanto ele vive (a ficha e os efeitos); com o nó, 50% mais; com a mesma aura sua, vale a sua', { skip: SEM }, async () => {
  const Reforcos = await import('../systems/skills/reforcos.mjs');
  const T = await import('../systems/itens-poe/traduzir.mjs');
  assert.equal(T.traduzirMod({ modelo: 'Seu mercenário tem o efeito das auras não maldições das habilidades aumentado em {0}%', valores: [50] }).estado, 'novo');
  const cena = (arquetipo, af = {}) => {
    const e = dono();
    e.equipment.ring.poe.af = { mercenario: 1, ...af };
    Ficha.invalidar(e);
    const { merc } = mercenario(e, arquetipo);
    assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
    return { e, merc };
  };
  // o Ódio do criomante: o "Físico como Gelo extra" na sua ficha
  const { e } = cena('criomante');
  const aura = M.auraDoMercenario(M.ativo(e), Ficha.combate(e).afPoe);
  assert.equal(aura.gema, 'Hatred');
  const antes = Number(Ficha.combate(e).afPoe.phys_as_extra_ice) || 0;
  Acoes.tiqueDoMercenario(e, e.hunt, Date.now());
  assert.equal((Number(Ficha.combate(e).afPoe.phys_as_extra_ice) || 0) - antes, aura.af.phys_as_extra_ice);
  // morto: sai da sua ficha
  const l = e.hunt.lacaios.find((x) => x.mercenario);
  l.hp = 0;
  Acoes.mercenarioMorreu(e, l);
  e.hunt.lacaios = e.hunt.lacaios.filter((x) => x.hp > 0);
  Ficha.invalidar(e);
  assert.equal(Number(Ficha.combate(e).afPoe.phys_as_extra_ice) || 0, antes);
  // a Ira do eletromante com a Sagração à Cavalaria (+50%): o raio adicionado × 1,5 e o dano (o efeito) × 1,5, nos reforços
  const { e: e2 } = cena('eletromante', { mercenario_auras_inc: 50 });
  const a2 = M.auraDoMercenario(M.ativo(e2), Ficha.combate(e2).afPoe);
  assert.equal(a2.fator, 1.5);
  const base = M.auraDoMercenario(M.ativo(e2), {});
  assert.ok(Math.abs(a2.af.added_energy_dmg_max - base.af.added_energy_dmg_max * 1.5) < 1e-9);
  Acoes.tiqueDoMercenario(e2, e2.hunt, Date.now());
  const dano = base.efeitos.find((x) => x.efeito === 'dano').pct;
  assert.ok(Math.abs(Reforcos.bonus(e2.hunt, 'dano', []) - dano * 1.5) < 1e-9);
  // vale NELE também: o golpe dele com a Ira a +50% (o nó) é maior que com a Ira a +0%
  const merc2 = M.ativo(e2);
  const com = Acoes.fichaDoMercenario(e2, merc2, { mercenario: 1, mercenario_auras_inc: 50 }).habilidades[0].dano.max;
  const sem = Acoes.fichaDoMercenario(e2, merc2, { mercenario: 1 }).habilidades[0].dano.max;
  assert.ok(com > sem, `${com} > ${sem}`);
  // a mesma aura sua ligada: vale a sua (uma vez cada)
  const { e: e3 } = cena('criomante');
  const a3 = M.auraDoMercenario(M.ativo(e3), Ficha.combate(e3).afPoe);
  e3.hunt.buffs = { ...(e3.hunt.buffs ?? {}), [a3.acao]: { ate: (e3.hunt.clock ?? 0) + 1e9 } };
  Acoes.tiqueDoMercenario(e3, e3.hunt, Date.now());
  const l3 = e3.hunt.lacaios.find((x) => x.mercenario);
  assert.equal(l3.afDono, null);
  assert.equal(l3.auraEfeitos, null);
});
