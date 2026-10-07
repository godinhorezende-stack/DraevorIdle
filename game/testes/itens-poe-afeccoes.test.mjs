// As afecções do PoE nos acertos do jogador (só com ITENS_POE=1): números base do PoE sobre o motor de estados/DoT do Draevor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const A = await import('../systems/itens-poe/afeccoes.mjs');
const Dot = await import('../systems/combate/dot.mjs');
const SEM = !existsSync(Catalogo.ARQUIVO) && 'catálogo do PoE não importado nesta máquina';
const bicho = (hp = 10000, extra = {}) => ({ uid: 1, hp, maxHp: hp, x: 0, y: 0, ...extra });
const nunca = () => 0.99; // o sorteio nunca passa (chance < 99%)
const sempre = () => 0; // o sorteio sempre passa (chance > 0)
const afeccoes = (over = {}) => ({ ...A.daSoma({}), ...over, chance: { ...A.daSoma({}).chance, ...(over.chance ?? {}) }, chanceAtaque: { ...A.daSoma({}).chanceAtaque, ...(over.chanceAtaque ?? {}) } });

test('a força da Eletrização/Resfriamento é a fórmula do PoE: 50% × (dano ÷ limiar)^0,4, com mínimo e teto', () => {
  assert.equal(A.forca(1000, 1000, A.BASE.eletrizacao), 50);
  assert.equal(A.forca(1000, 1000, A.BASE.resfriamento), 30, 'o resfriamento para em 30%');
  assert.ok(Math.abs(A.forca(100, 10000, A.BASE.eletrizacao) - 50 * Math.pow(0.01, 0.4)) < 0.1);
  assert.equal(A.forca(1, 1e6, A.BASE.eletrizacao), 0, 'abaixo de 5%: nada');
});

test('incêndio (90%/s × 4 s do fogo), sangramento (70%/s × 5 s do físico) e veneno de Caos (30%/s × 2 s, acumula), com multiplicador e duração', { skip: SEM }, () => {
  const b = bicho();
  A.aoAcertar(b, [{ elemento: 'fire', dano: 100 }, { elemento: 'physical', dano: 200 }], { afeccoes: afeccoes({ chance: { incendio: 100, sangramento: 100, veneno: 100 }, multiplicador: 50 }), rng: sempre, agora: 0 });
  const q = Dot.dosDoTipo(b, 'queimadura')[0];
  assert.ok(Math.abs(q.falta - 100 * 0.9 * 4 * 1.5) < 1e-6, `incêndio ${q.falta}`);
  assert.ok(Math.abs(Dot.dosDoTipo(b, 'sangramento')[0].falta - 200 * 0.7 * 5 * 1.5) < 1e-6);
  const v = Dot.dosDoTipo(b, 'venenoPoe');
  assert.equal(v[0].elemento, 'chaos');
  assert.ok(Math.abs(v[0].falta - 200 * 0.3 * 2 * 1.5) < 1e-6);
  A.aoAcertar(b, [{ elemento: 'physical', dano: 200 }], { afeccoes: afeccoes({ chance: { veneno: 100 } }), rng: sempre, agora: 100 });
  assert.equal(Dot.dosDoTipo(b, 'venenoPoe').length, 2, 'o veneno acumula');
  // duração +100%: o dobro do total (mesmo dano por segundo)
  const c = bicho();
  A.aoAcertar(c, [{ elemento: 'fire', dano: 100 }], { afeccoes: afeccoes({ chance: { incendio: 100 }, duracao: 100 }), rng: sempre, agora: 0 });
  assert.ok(Math.abs(Dot.dosDoTipo(c, 'queimadura')[0].falta - 100 * 0.9 * 8) < 1e-6);
});

test('as chances "com Ataques" só valem em ataque; o crítico incendeia/congela/eletriza de forma inerente; gelo sempre resfria', { skip: SEM }, () => {
  const a = afeccoes({ chanceAtaque: { sangramento: 100 } });
  const magia = bicho();
  A.aoAcertar(magia, [{ elemento: 'physical', dano: 100 }], { afeccoes: a, rng: sempre, ataque: false });
  assert.equal(Dot.dosDoTipo(magia, 'sangramento').length, 0);
  const golpe = bicho();
  A.aoAcertar(golpe, [{ elemento: 'physical', dano: 100 }], { afeccoes: a, rng: sempre, ataque: true });
  assert.equal(Dot.dosDoTipo(golpe, 'sangramento').length, 1);
  const crit = bicho(1000);
  const postos = A.aoAcertar(crit, [{ elemento: 'fire', dano: 50 }, { elemento: 'ice', dano: 50 }, { elemento: 'energy', dano: 300 }], { afeccoes: afeccoes(), crit: true, rng: nunca, agora: 0 });
  assert.ok(postos.includes('queimando') && postos.includes('congelado') && postos.includes('eletrizado'), postos.join(','));
  const frio = bicho(1000);
  assert.ok(A.aoAcertar(frio, [{ elemento: 'ice', dano: 100 }], { afeccoes: afeccoes(), rng: nunca, agora: 0 }).includes('lento'), 'gelo sempre resfria');
  assert.ok(frio.estados.lento.pct > 5 && frio.estados.lento.pct <= 30);
  // eletrizado: o alvo recebe mais dano
  assert.ok(A.fatorDeEletrizacao(crit, 1000) > 1.3);
  assert.equal(A.fatorDeEletrizacao(crit, 5000), 1, 'acabou');
});

test('no combate de verdade: a peça com chance de incendiar e dano de fogo somado incendeia o bicho no golpe da arma', { skip: SEM }, async () => {
  const Cacadas = await import('../systems/cacadas.mjs');
  const Afixos = await import('../systems/afixos.mjs');
  const Ficha = await import('../systems/ficha.mjs');
  const Treino = await import('../systems/treino.mjs');
  const { ITEM_CATALOG } = await import('../systems/dados.mjs');
  const { criarMonstro } = await import('../systems/hunt/monstros.mjs');
  const { round } = await import('../systems/hunt/combate.mjs');
  const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
  const e = personagemDeTeste({ vocacao: 'knight', level: 300 });
  Treino.garantir(e);
  e.equipment.weapon = { id: Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'fire sword').id), count: 1 };
  e.equipment.ring = { id: Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'might ring').id), count: 1, af: [], poe: { af: { added_fire_dmg_min: 50, added_fire_dmg_max: 60, chance_ignite: 100 } } };
  e.maxHp = e.hp = 1e9;
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.equal(Ficha.combate(e).afeccoes.chance.incendio, 100);
  assert.ok(Cacadas.entrar(e, { huntId: 'troll-cave', mode: 'auto' }).ok);
  const h = e.hunt;
  delete h.instancia;
  h.respawns = [];
  h.outrosAndares = {};
  const m = criarMonstro({ key: 'troll', x: h.pos.x + 1, y: h.pos.y }, null);
  m.hp = m.maxHp = 1e12;
  delete m.spawn;
  h.monstros.splice(0, h.monstros.length, m);
  h.alvo = m.uid;
  let incendiou = false;
  for (let i = 0; i < 40 && !incendiou; i++) incendiou = round(e, PERSONAGEM).eventos.some((x) => x.t === 'estado' && x.estado === 'queimando');
  assert.ok(incendiou, 'o bicho pegou fogo');
  assert.ok(Dot.dosDoTipo(m, 'queimadura').length === 1);
});

test('a afecção de dano posta por um golpe CRÍTICO causa 50% mais (incêndio, sangramento, veneno — como na tela do PoE)', { skip: SEM }, () => {
  const partes = [{ elemento: 'fire', dano: 100 }, { elemento: 'physical', dano: 200 }];
  const a = afeccoes({ chance: { incendio: 100, sangramento: 100, veneno: 100 } });
  const normal = bicho();
  A.aoAcertar(normal, partes, { afeccoes: a, rng: sempre, agora: 0 });
  const critico = bicho();
  A.aoAcertar(critico, partes, { afeccoes: a, crit: true, rng: sempre, agora: 0 });
  for (const tipo of ['queimadura', 'sangramento', 'venenoPoe']) {
    const n = Dot.dosDoTipo(normal, tipo)[0].falta;
    assert.ok(Math.abs(Dot.dosDoTipo(critico, tipo)[0].falta - n * 1.5) < 1e-6, `${tipo}: 1,5× no crítico`);
  }
});
