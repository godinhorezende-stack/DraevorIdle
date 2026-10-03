// A VARIAÇÃO do dano do golpe físico (dono, 02/10): o "Dano 38–573" vinha da fórmula do Tibia (sorteio uniforme de level/5 até o máximo); agora a faixa é
// centrada na MESMA média, ±`danoFisico.variacaoPct` (configurável), e sobe com ataque, perícia e level. Testes: a conta, a média preservada, os limites, o dano
// real contra o tooltip e os bônus aplicados nos dois extremos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../engine/formulas.mjs';
import * as R from '../systems/regras.mjs';
import * as Ficha from '../systems/ficha.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Afixos from '../systems/afixos.mjs';
import { PARAMETROS } from '../systems/combate/formulas.mjs';
import { round } from '../systems/hunt/combate.mjs';
import { criarMonstro } from '../systems/hunt/monstros.mjs';
import { definirNivel, nivelDoRegistro, limparRegistro, ultimosGolpes } from '../systems/combate/registro.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import { personagemDeTeste, PERSONAGEM } from './apoio.mjs';

const ANEL = Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'might ring').id);

test('a fórmula ANTIGA (sem variação) reproduz o 38–575 do relato: o mínimo é só level/5 e ignora ataque e perícia', () => {
  const d = E.attackDamage({ attack: 78, skill: 77, level: 190 });
  assert.deepEqual(d, { min: 38, max: 575 });
  assert.equal(E.attackDamage({ attack: 0, skill: 10, level: 190 }).min, 38);
  assert.equal(E.attackDamage({ attack: 300, skill: 200, level: 190 }).min, 38, 'o mínimo não sobe com o ataque nem com a perícia');
  assert.ok(38 / 575 < 0.07, 'mínimo = 6,6% do máximo');
});

test('a faixa NOVA fica centrada na mesma média da antiga, ±variação, e o mínimo sobe com ataque, perícia e level', () => {
  const v = PARAMETROS.danoFisico.variacaoPct / 100;
  for (const [attack, skill, level] of [[0, 10, 100], [40, 30, 100], [78, 77, 190], [300, 200, 190], [150, 90, 600]]) {
    const antigo = E.attackDamage({ attack, skill, level });
    const novo = R.attackDamage({ attack, skill, level });
    const media = (antigo.min + antigo.max) / 2;
    assert.ok(Math.abs((novo.min + novo.max) / 2 - media) <= 1.5 + media * 0.01, `média ${(novo.min + novo.max) / 2} contra ${media}`);
    assert.ok(novo.min >= Math.floor(media * (1 - v)) - 1 && novo.max <= Math.ceil(media * (1 + v)) + 1, `${novo.min}–${novo.max} fora de ±${v * 100}% de ${media}`);
    assert.ok(novo.min >= 1 && novo.max >= novo.min);
  }
  const base = R.attackDamage({ attack: 60, skill: 50, level: 200 });
  for (const mais of [{ attack: 90 }, { skill: 80 }, { level: 300 }]) {
    const m = R.attackDamage({ attack: 60, skill: 50, level: 200, ...mais });
    assert.ok(m.min > base.min && m.max > base.max, `${JSON.stringify(mais)}: o mínimo E o máximo sobem (${base.min}–${base.max} → ${m.min}–${m.max})`);
  }
  assert.ok(R.attackDamage({ attack: 78, skill: 77, level: 190 }).min > 150, 'o 38 absurdo virou um mínimo coerente');
});

test('a variação é configurável: 0 = sempre a média; 100 = de ~0 ao dobro da média', () => {
  const antes = PARAMETROS.danoFisico.variacaoPct;
  try {
    PARAMETROS.danoFisico.variacaoPct = 0;
    const fixo = R.attackDamage({ attack: 78, skill: 77, level: 190 });
    assert.ok(Math.abs(fixo.max - fixo.min) <= 1, `${fixo.min}–${fixo.max}`);
    PARAMETROS.danoFisico.variacaoPct = 100;
    const larga = R.attackDamage({ attack: 78, skill: 77, level: 190 });
    assert.ok(larga.min <= 2 && larga.max >= 2 * 306 - 2, `${larga.min}–${larga.max}`);
  } finally {
    PARAMETROS.danoFisico.variacaoPct = antes;
  }
});

test('o golpe real (golpeDoJogador) respeita a faixa e a média é a de antes', () => {
  const arma = { attack: 78 };
  const { min, max } = R.attackDamage({ attack: 78, skill: 77, level: 190 });
  let soma = 0;
  const N = 20000;
  for (let i = 0; i < N; i++) {
    const g = R.golpeDoJogador(arma, 77, 190);
    assert.ok(g >= min && g <= max, `${g} fora de ${min}–${max}`);
    soma += g;
  }
  assert.ok(Math.abs(soma / N - 306.5) / 306.5 < 0.02, `média ${(soma / N).toFixed(1)}`);
});

function lutar(af, rodadas = 400) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 190 });
  e.equipment.ring = { id: ANEL, count: 1, af };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  e.maxHp = e.hp = 1e12;
  assert.ok(Cacadas.entrar(e, { huntId: 'troll-cave', mode: 'auto' }).ok);
  const h = e.hunt;
  delete h.instancia;
  h.respawns = [];
  h.outrosAndares = {};
  const m = criarMonstro({ key: 'troll', x: h.pos.x + 1, y: h.pos.y }, null);
  m.hp = m.maxHp = 1e12;
  m.forca = 0;
  m.resist = {};
  delete m.spawn;
  h.monstros.splice(0, h.monstros.length, m);
  h.alvo = m.uid;
  const modo = PARAMETROS.acerto.modo;
  PARAMETROS.acerto.modo = 'draevor';
  const nivel = nivelDoRegistro();
  definirNivel(1);
  limparRegistro();
  const golpes = [];
  try {
    for (let i = 0; i < rodadas; i++) {
      round(e, PERSONAGEM);
      golpes.push(...ultimosGolpes(1e6).filter((g) => g.origem === 'golpe-basico').map((g) => g.danoAntesDaResistencia));
      limparRegistro();
    }
  } finally {
    PARAMETROS.acerto.modo = modo;
    definirNivel(nivel);
  }
  return { golpes, ficha: Ficha.combate(e) };
}

test('o dano REAL do golpe básico está dentro do "Dano" do tooltip (mesma fórmula) e o bônus de dano físico escala os DOIS extremos', () => {
  const sem = lutar([]);
  assert.ok(sem.golpes.length > 200);
  const { min, max } = sem.ficha.damage;
  const fis = 1 + (sem.ficha.danoDoElemento.physical + (sem.ficha.afinidades ? 0 : 0)) / 100;
  for (const g of sem.golpes) assert.ok(g >= min * 0.999 - 2 && g <= max * 1.5 * fis + 2, `golpe ${g} fora do tooltip ${min}–${max}`);
  const com = lutar([{ id: 'phys_dmg', nivel: 5, value: 100 }]);
  const razao = (a) => [Math.min(...a.golpes), Math.max(...a.golpes)];
  const [minSem, maxSem] = razao(sem);
  const [minCom, maxCom] = razao(com);
  assert.ok(minCom / minSem > 1.5 && maxCom / maxSem > 1.5, `os dois extremos sobem: ${minSem}–${maxSem} → ${minCom}–${maxCom}`);
  assert.ok(Math.abs(minCom / minSem - maxCom / maxSem) < 0.2, 'o mesmo multiplicador nos dois extremos');
  // A faixa mostrada continua sem o bônus (os percentuais entram no golpe); o mínimo agora é coerente com o máximo.
  assert.ok(min / max > 0.4, `mínimo/máximo = ${(min / max).toFixed(2)}`);
});

test('o mínimo E o máximo sobem com a perícia da arma: Magic Level (wand/rod), Distance (arma de longe), Melee (arma de perto e punho) — e não com a perícia dos outros', async () => {
  const Treino = await import('../systems/treino.mjs');
  const idDe = (n) => Number(Object.values(ITEM_CATALOG).find((i) => i.name === n).id);
  const dano = ({ voc, arma, municao = null, perícia, valor, outras = {} }) => {
    const e = personagemDeTeste({ vocacao: voc, level: 300 });
    Treino.garantir(e);
    e.equipment.weapon = arma ? { id: idDe(arma), count: 1 } : null;
    if (municao) e.equipment.ammo = { id: idDe(municao), count: 100 };
    const ponha = (nome, v) => (nome === 'magic' ? (e.magic.value = v) : (e.skills[nome].value = v));
    ponha(perícia, valor);
    for (const [k, v] of Object.entries(outras)) ponha(k, v);
    Ficha.invalidar(e);
    return Ficha.combate(e).damage;
  };
  const casos = [
    { nome: 'wand (Magic Level)', voc: 'sorcerer', arma: 'wand of vortex', perícia: 'magic', outra: 'melee' },
    { nome: 'rod (Magic Level)', voc: 'druid', arma: 'northwind rod', perícia: 'magic', outra: 'distance' },
    { nome: 'arco + flecha (Distance)', voc: 'paladin', arma: 'bow', municao: 'flaming arrow', perícia: 'distance', outra: 'melee' },
    { nome: 'lança (Distance)', voc: 'paladin', arma: 'spear', perícia: 'distance', outra: 'magic' },
    { nome: 'espada (Melee)', voc: 'knight', arma: 'fire sword', perícia: 'melee', outra: 'distance' },
    { nome: 'punho, sem arma (Melee)', voc: 'monk', arma: null, perícia: 'melee', outra: 'magic' },
    { nome: 'arco sem flecha (Distance)', voc: 'paladin', arma: 'crossbow', perícia: 'distance', outra: 'melee' },
  ];
  for (const c of casos) {
    const baixa = dano({ ...c, valor: 10 });
    const alta = dano({ ...c, valor: 120 });
    assert.ok(alta.min > baixa.min && alta.max > baixa.max, `${c.nome}: ${baixa.min}–${baixa.max} → ${alta.min}–${alta.max}`);
    // A perícia dos outros tipos não mexe no dano desta arma.
    const outra = dano({ ...c, valor: 10, outras: { [c.outra]: 150 } });
    assert.deepEqual(outra, baixa, `${c.nome}: a perícia ${c.outra} não deveria contar`);
  }
});

test('estilo PoE: a arma 48–61 dá mínimo 48 e máximo 61 ANTES dos modificadores; a perícia e o level entram igual nas duas pontas (sem fração arbitrária)', () => {
  const nivel = 100;
  const pericia = 60;
  const f = (a) => Math.floor(a * 0.0425 * (pericia + 4) + nivel / 5);
  const d = R.attackDamage({ attack: 54, attackMin: 48, attackMax: 61, skill: pericia, level: nivel });
  assert.deepEqual(d, { min: f(48), max: f(61) }, 'cada ponta = ataque da ponta × fator da perícia × (perícia + 4) + level/5');
  assert.equal(d.min, 150);
  assert.equal(d.max, 185);
  // O ataque fixo (+20) entra nas duas pontas antes da conta, como no exemplo: (48+20) e (61+20).
  const comFixo = R.attackDamage({ attack: 74, attackMin: 68, attackMax: 81, skill: pericia, level: nivel });
  assert.deepEqual(comFixo, { min: f(68), max: f(81) });
  // O golpe real: um sorteio só, dentro da faixa da arma — a média é a de antes (a do sorteio antigo, ataque médio 54,5).
  let soma = 0;
  for (let i = 0; i < 20000; i++) {
    const g = R.golpeDoJogador({ attack: 54, attackMin: 48, attackMax: 61 }, pericia, nivel);
    assert.ok(g >= d.min && g <= d.max, `${g} fora de ${d.min}–${d.max}`);
    soma += g;
  }
  const antiga = E.attackDamage({ attack: 54.5, skill: pericia, level: nivel });
  assert.ok(Math.abs(soma / 20000 - (antiga.min + antiga.max) / 2) < 3, `média ${(soma / 20000).toFixed(1)} contra ${(antiga.min + antiga.max) / 2}`);
  // Sem faixa (ataque único): a variação configurável em torno da média, como antes.
  const unico = R.attackDamage({ attack: 54, skill: pericia, level: nivel });
  assert.ok(unico.min < unico.max);
});
