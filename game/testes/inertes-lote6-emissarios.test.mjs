// (06/11, lote 6 das inertes — dono: "Continue resolvendo até dar zero nos itens") os outros cinco Emissários (o Menor e o Grande do Tempo, da Brutalidade,
// do Foco, do Arcano e das Tormentas): um lacaio imortal de cada que lança o buff dele em você. Os números: o poedb em inglês e o poewiki (`acoes.EMISSARIOS`).
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
const Traduzir = await import('../systems/itens-poe/traduzir.mjs');
const traduzirLinha = (texto) => Traduzir.traduzirMod({ modelo: texto, valores: [] });
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');

const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 70, rng: () => 0.5 }));
function personagem(af = {}) {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 90 });
  e.sistema = 'poe';
  e.classePoe = 'Witch';
  const arma = peca('Wands/Driftwood_Wand');
  arma.poe.af = { ...(arma.poe.af ?? {}), ...af };
  e.equipment = { ...(e.equipment ?? {}), weapon: arma };
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.clock = 100_000;
  e.maxHp = e.hp = 1e6;
  P.garantir(e);
  return e;
}
const soma = (e) => { Ficha.invalidar(e); return Afixos.soma(e); };
const emissarios = (h) => h.lacaios.filter((l) => l.emissario && l.hp > 0).map((l) => l.nome).sort();

test('as linhas dos Emissários têm efeito (aproximado, com a nota)', { skip: SEM }, () => {
  for (const [x, k] of [['do Tempo', 'tempo'], ['da Brutalidade', 'brutalidade'], ['do Foco', 'foco'], ['do Arcano', 'arcano'], ['das Tormentas', 'tormentas']]) {
    const m = traduzirLinha(`Concede a Habilidade Convocar Emissário ${x}`);
    assert.equal(m.estado, 'aproximado', x);
    assert.deepEqual(m.efeitos, [{ stat: `emissario_${k}_menor`, valor: 1 }]);
    const g = traduzirLinha(`Concede a Habilidade Convocar Grande Emissário ${x}`);
    assert.deepEqual(g.efeitos, [{ stat: `emissario_${k}`, valor: 1 }]);
  }
});

test('o Tempo: um lacaio imortal; +10% de Velocidade de Ação por 8 s a cada 20 s (o Grande, a cada 10 s)', { skip: SEM }, () => {
  const e = personagem({ emissario_tempo_menor: 1 });
  const h = e.hunt;
  const t0 = h.clock;
  const antes = soma(e).action_speed ?? 0;
  Acoes.tiqueDoEmissario(e, h, t0, () => 0);
  assert.deepEqual(emissarios(h), ['Emissário do Tempo']);
  assert.ok(h.lacaios.find((l) => l.emissario === 'tempo').intocavel);
  assert.equal(h.poeBuffs.emissarioTempo, t0 + 8000);
  assert.equal((soma(e).action_speed ?? 0) - antes, 10);
  Acoes.tiqueDoEmissario(e, h, t0 + 10_000, () => 0);
  assert.equal(h.poeEmissarios.tempo, t0 + 20_000, 'o Menor: a cada 20 s');
  // o Grande toma o lugar do Menor (com os dois, vale o Grande)
  e.equipment.weapon.poe.af.emissario_tempo = 1;
  Ficha.invalidar(e);
  Acoes.tiqueDoEmissario(e, h, t0 + 20_000, () => 0);
  assert.deepEqual(emissarios(h), ['Grande Emissário do Tempo']);
  assert.equal(h.poeEmissarios.tempo, t0 + 30_000, 'o Grande: a cada 10 s');
});

test('a Brutalidade: só com um Raro ou Único perto — 50% de Dano, 30% de Ataque e Movimento, 15% de Dano sofrido reduzido; o Grande, os Sangrando explodem', { skip: SEM }, () => {
  const e = personagem({ emissario_brutalidade: 1 });
  const h = e.hunt;
  for (const m of h.monstros) m.raridade = 'normal';
  const t0 = h.clock;
  Acoes.tiqueDoEmissario(e, h, t0, () => 0);
  assert.equal(h.poeBuffs?.emissarioBrutalidade, undefined, 'sem Raro perto, nada');
  Object.assign(h.monstros[0], { raridade: 'raro', x: h.pos.x + 1, y: h.pos.y, hp: 100 });
  const antes = soma(e);
  Acoes.tiqueDoEmissario(e, h, t0 + 1000, () => 0);
  assert.equal(h.poeBuffs.emissarioBrutalidade, t0 + 9000);
  const s = soma(e);
  assert.equal((s.dmg_inc ?? 0) - (antes.dmg_inc ?? 0), 50);
  assert.equal((s.atk_speed ?? 0) - (antes.atk_speed ?? 0), 30);
  assert.equal((s.move_speed ?? 0) - (antes.move_speed ?? 0), 30);
  assert.equal((s.dano_recebido_inc ?? 0) - (antes.dano_recebido_inc ?? 0), -15);
  assert.equal(s['ev:matar:explodirChance:10:physical@alvoSangrando'], 100);
});

test('o Foco: só canalizando — 20% menos Dano sofrido e imune a Atordoamento e Afecções Elementais; o Grande, a Maldições', { skip: SEM }, () => {
  const e = personagem({ emissario_foco_menor: 1 });
  const h = e.hunt;
  const t0 = h.clock;
  Acoes.tiqueDoEmissario(e, h, t0, () => 0);
  assert.equal(h.poeBuffs?.emissarioFoco, undefined, 'sem canalizar, nada');
  h.canalizacao = { ate: t0 + 5000, desde: t0 };
  Acoes.tiqueDoEmissario(e, h, t0 + 1000, () => 0);
  assert.equal(h.poeBuffs.emissarioFoco, t0 + 5000);
  const s = soma(e);
  assert.equal(s.imune_atordoamento, 1);
  assert.equal(s.imune_congelamento, 1);
  assert.ok(!(s.imune_maldicao > 0), 'o Menor não tira Maldição');
});

test('o Arcano: a Fúria Arcana; o Grande, junto, +15% de chance de Eletrizar e 10% de Penetração de Raio', { skip: SEM }, () => {
  const e = personagem({ emissario_arcano: 1 });
  const h = e.hunt;
  const t0 = h.clock;
  const antes = soma(e);
  Acoes.tiqueDoEmissario(e, h, t0, () => 0);
  assert.equal(h.poeBuffs.furiaArcana, t0 + 4000);
  assert.equal(h.poeBuffs.emissarioArcanoRaio, t0 + 4000);
  const s = soma(e);
  assert.equal((s.chance_shock ?? 0) - (antes.chance_shock ?? 0), 15);
  assert.equal((s.energy_pen ?? 0) - (antes.energy_pen ?? 0), 10);
});

test('as Tormentas: a cada 4 s, Resfria ou Eletriza um inimigo e os perto dele (até 5) por 4 s', { skip: SEM }, () => {
  const e = personagem({ emissario_tormentas_menor: 1 });
  const h = e.hunt;
  const [a, b, ...outros] = h.monstros;
  for (const o of outros) Object.assign(o, { x: h.pos.x + 60, y: h.pos.y + 60 });
  Object.assign(a, { x: h.pos.x + 1, y: h.pos.y, hp: 1e9, maxHp: 1e9, estados: {} });
  Object.assign(b, { x: h.pos.x + 2, y: h.pos.y, hp: 1e9, maxHp: 1e9, estados: {} });
  const t0 = h.clock;
  Acoes.tiqueDoEmissario(e, h, t0, () => 0.9); // 0.9: Resfria
  assert.ok(a.estados.lento?.ate >= t0 + 3999 && b.estados.lento, JSON.stringify(a.estados));
  Acoes.tiqueDoEmissario(e, h, t0 + 4000, () => 0.1); // 0.1: Eletriza
  assert.equal(a.estados.chocado?.pct, 10);
  assert.equal(a.estados.chocado?.ate, t0 + 8000);
});

test('um lacaio de cada tipo, juntos; sem a peça, saem', { skip: SEM }, () => {
  const e = personagem({ emissario_tempo: 1, emissario_arcano_menor: 1, emissario_direcoes: 1 });
  const h = e.hunt;
  Acoes.tiqueDoEmissario(e, h, h.clock, () => 0);
  assert.deepEqual(emissarios(h), ['Emissário do Arcano', 'Grande Emissário das Direções', 'Grande Emissário do Tempo']);
  e.equipment.weapon.poe.af = {};
  Ficha.invalidar(e);
  Acoes.tiqueDoEmissario(e, h, h.clock + 1, () => 0);
  assert.deepEqual(emissarios(h), []);
});
