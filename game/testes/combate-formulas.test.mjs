// As fórmulas puras do combate (parâmetros em `combate/formulas.json`), o registro de golpe e o simulador (dono, 02/10). Nenhum número do
// jogo muda: a armadura de hoje, o crítico base e o Onslaught agora vêm da configuração e dão o MESMO resultado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as F from '../systems/combate/formulas.mjs';
import * as Registro from '../systems/combate/registro.mjs';
import * as Simulador from '../systems/combate/simulador.mjs';
import * as R from '../systems/regras.mjs';
import { armorReduction } from '../engine/formulas.mjs';
import * as Acoes from '../systems/acoes.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Ficha from '../systems/ficha.mjs';
import { resistenciaDe } from '../systems/hunt/resistencia.mjs';
import { criarMonstro } from '../systems/hunt/monstros.mjs';
import { personagemDeTeste, PERSONAGEM, comSkills } from './apoio.mjs';

test('increased/reduced SOMAM e more/less MULTIPLICAM: 100 × (1 + 0,5 + 0,3) × 1,4 × 0,8 = 201,6', () => {
  const r = F.combinarModificadores(100, { aumentos: [{ valor: 50, origem: 'árvore' }, { valor: 30, origem: 'anel' }], mais: [{ valor: 40, origem: 'gema' }], menos: [{ valor: 20, origem: 'efeito' }] });
  assert.ok(Math.abs(r.valor - 201.6) < 1e-9);
  assert.equal(r.aditivo, 1.8);
  assert.ok(Math.abs(r.multiplicativo - 1.12) < 1e-9);
  assert.equal(r.parcelas.aumentos[0].origem, 'árvore', 'cada modificador leva a origem');
  // Reduções entram no mesmo balde aditivo; o aditivo nunca fica negativo.
  assert.equal(F.combinarModificadores(100, { aumentos: [{ valor: 10 }], reducoes: [{ valor: 30 }] }).valor, 80);
  assert.equal(F.combinarModificadores(100, { reducoes: [{ valor: 400 }] }).valor, 0);
});

test('crítico: dano médio esperado = dano × [1 + chance × (fator − 1)] (1.000, 25%, 150% → 1.125); a chance fica entre 0 e 1', () => {
  assert.equal(F.danoMedioComCritico(1000, 0.25, F.fatorCritico(150)), 1125);
  assert.equal(F.danoMedioComCritico(1000, 5, 1.5), 1500, 'chance acima de 100% vale 100%');
  assert.equal(F.danoMedioComCritico(1000, -1, 1.5), 1000);
});

test('armadura (modo PoE, para a etapa futura): 1.000 contra 500 de dano físico reduz 28,57%; zero e dano zero não reduzem', () => {
  assert.ok(Math.abs(F.reducaoDeArmaduraPoe(1000, 500) - 0.285714) < 1e-5);
  assert.ok(Math.abs(500 * (1 - F.reducaoDeArmaduraPoe(1000, 500)) - 357.14) < 0.01);
  assert.equal(F.reducaoDeArmaduraPoe(0, 500), 0);
  assert.equal(F.reducaoDeArmaduraPoe(1000, 0), 0);
  assert.ok(F.reducaoDeArmaduraPoe(1000, 100) > F.reducaoDeArmaduraPoe(1000, 1000), 'a eficiência cai contra golpes mais fortes');
});

test('acerto (modo PoE): fica entre 5% e 95%; mais precisão acerta mais, mais evasão acerta menos', () => {
  assert.equal(F.chanceDeAcertoPoe(0, 1000), 0.05);
  assert.equal(F.chanceDeAcertoPoe(1e9, 0), 0.95);
  assert.ok(F.chanceDeAcertoPoe(800, 1000) > F.chanceDeAcertoPoe(500, 1000));
  assert.ok(F.chanceDeAcertoPoe(500, 2000) < F.chanceDeAcertoPoe(500, 1000));
  // 500 de precisão contra 1.000 de evasão: 500 / (500 + (1000/4)^0,8) ≈ 85,8% (a conta do próprio PoE).
  assert.ok(Math.abs(F.chanceDeAcertoPoe(500, 1000) - 0.8578) < 1e-3);
});

test('entropia do acerto: a taxa de longo prazo é a chance e as sequências de erros ficam mais curtas que as do sorteio puro', () => {
  let s = 12345;
  const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const rodar = (n, chance) => {
    let erros = 0, acertos = 0, seqAtual = 0, maiorSeq = 0;
    for (let i = 0; i < n; i++) {
      const r = F.acertoComEntropia(chance, erros, rng());
      erros = r.erros;
      if (r.acertou) { acertos++; seqAtual = 0; } else maiorSeq = Math.max(maiorSeq, ++seqAtual);
    }
    return { taxa: acertos / n, maiorSeq };
  };
  const e = rodar(40000, 0.3);
  assert.ok(Math.abs(e.taxa - 0.3) < 0.02, `taxa ${e.taxa}`);
  let puro = 0, seq = 0, maiorPuro = 0;
  for (let i = 0; i < 40000; i++) { if (rng() < 0.3) { puro++; seq = 0; } else maiorPuro = Math.max(maiorPuro, ++seq); }
  assert.ok(e.maiorSeq < maiorPuro, `entropia ${e.maiorSeq} vs puro ${maiorPuro}`);
  assert.equal(F.acertoComEntropia(1, 0, 0.99).acertou, true);
  assert.equal(F.acertoComEntropia(0, 0, 0).acertou, false);
  assert.ok(Math.abs(F.constanteDaEntropia(0.5) - 0.3) < 0.02, 'C(50%) ≈ 0,3');
});

test('bloqueio: zero, no teto e acima do teto (golpe e magia, com bônus de limite)', () => {
  assert.equal(F.bloqueioFinal(0), 0);
  assert.equal(F.bloqueioFinal(0.5), 0.5);
  assert.equal(F.bloqueioFinal(0.9), 0.75);
  assert.equal(F.bloqueioFinal(0.9, 'magia'), 0.75);
  assert.equal(F.bloqueioFinal(0.9, 'golpe', 0.05), 0.8, 'modificador que sobe o limite');
  assert.equal(F.bloqueioFinal(-1), 0);
});

test('a armadura de HOJE vem da configuração e dá o mesmo resultado: absorve de 60% a 120%, e `danoRecebido` não mudou', () => {
  assert.equal(F.absorcaoPorArmadura(1000, 0), 600);
  assert.equal(F.absorcaoPorArmadura(1000, 1), 1200);
  assert.equal(F.absorcaoPorArmadura(0, 0.5), 0);
  const original = Math.random;
  try {
    // Igual à conta original da engine (`armorReduction`), para qualquer sorteio.
    for (const roll of [0, 0.123, 0.5, 0.77, 0.999999]) {
      Math.random = () => roll;
      for (const armadura of [0, 7, 150, 1000, 99999]) assert.equal(R.danoRecebido(5000, armadura), Math.max(0, 5000 - armorReduction(armadura, roll)), `roll ${roll} armadura ${armadura}`);
    }
    Math.random = () => 0;
    assert.equal(R.danoRecebido(5000, 1000), 4400);
    Math.random = () => 0.999999;
    assert.equal(R.danoRecebido(500, 1000), 0);
  } finally {
    Math.random = original;
  }
  assert.equal(F.PARAMETROS.armadura.modo, 'tibia', 'a armadura do PoE existe, mas segue desligada');
  assert.equal(F.PARAMETROS.acerto.modo, 'draevor');
});

test('o crítico base e o Onslaught vêm da configuração (3%, +60%, ×1,6) — a ficha de um personagem novo não mudou', () => {
  const f = Ficha.combate(personagemDeTeste({ vocacao: 'knight', level: 10 }));
  assert.equal(F.PARAMETROS.critico.chanceBase, 0.03);
  assert.equal(F.PARAMETROS.critico.multiplicadorBase, 1.6);
  assert.equal(F.PARAMETROS.critico.onslaught, 1.6);
  assert.ok(f.critChance >= 0.03 && f.critMultiplier >= 1.6);
});

function naCacada(e) {
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
  return m;
}

function sorcerer() {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 300 });
  e.magic = { value: 80 };
  e.maxHp = e.hp = 1e9;
  e.maxMana = e.mana = 1e9;
  const alvo = naCacada(e);
  e.actions = Array(Acoes.SLOTS).fill(null);
  comSkills(e, ['spell-energy-strike']);
  const slot = Acoes.PAPEL_DO_SLOT.indexOf('attack');
  assert.ok(Acoes.definir(e, { slot, value: { id: 'spell-energy-strike' } }).ok);
  return { e, alvo, slot };
}

test('o registro de golpe fica DESLIGADO por padrão (produção) e, ligado, guarda o que a conta fez', () => {
  assert.equal(Registro.nivelDoRegistro(), 0);
  const { e, alvo, slot } = sorcerer();
  Registro.limparRegistro();
  e.hunt.cooldowns = {};
  Acoes.disparar(e, e.hunt, PERSONAGEM, slot, alvo);
  assert.equal(Registro.ultimosGolpes().length, 0, 'desligado: nada guardado');
  Registro.definirNivel(2);
  try {
    e.hunt.cooldowns = {};
    e.hunt.ultimoAtaqueEm = null;
    e.mana = e.maxMana;
    Acoes.disparar(e, e.hunt, PERSONAGEM, slot, alvo);
    const g = Registro.ultimosGolpes()[0];
    assert.equal(g.origem, 'gema');
    assert.equal(g.habilidade, 'spell-energy-strike');
    for (const campo of ['tipo', 'danoAntesDaResistencia', 'resistenciaDoAlvo', 'penetracao', 'resistenciaEfetiva', 'chanceCritica', 'critico', 'danoFinal', 'vidaRestante']) assert.ok(campo in g, campo);
    assert.ok(g.detalhe, 'o nível 2 traz o detalhe');
    Registro.definirNivel(1);
    Registro.limparRegistro();
    e.hunt.cooldowns = {};
    e.hunt.ultimoAtaqueEm = null;
    Acoes.disparar(e, e.hunt, PERSONAGEM, slot, alvo);
    assert.equal(Registro.ultimosGolpes()[0].detalhe, undefined, 'o nível 1 é só o resumo');
  } finally {
    Registro.definirNivel(0);
    Registro.limparRegistro();
  }
});

test('o registro guarda só a capacidade configurada (o mais antigo sai)', () => {
  Registro.definirNivel(1);
  try {
    Registro.limparRegistro();
    const cap = F.PARAMETROS.registro.capacidade;
    for (let i = 0; i < cap + 30; i++) Registro.registrarGolpe(() => ({ origem: 'teste', i }));
    assert.equal(Registro.ultimosGolpes(1e6).length, cap);
    assert.equal(Registro.ultimosGolpes(1)[0].i, cap + 29);
  } finally {
    Registro.definirNivel(0);
    Registro.limparRegistro();
  }
});

test('o simulador: min, máx, médio, crítico, DPS teórico e efetivo, golpes para derrotar — e o DPS TEÓRICO bate com o MEDIDO no motor', () => {
  const { e, alvo, slot } = sorcerer();
  const resEnergia = resistenciaDe(e.hunt, alvo, 'energy');
  const s = Simulador.simular(e, 'spell-energy-strike', { level: 300, hp: 5000, resistencias: { energy: resEnergia } });
  assert.ok(s.ok);
  assert.ok(s.dano.minimo > 0 && s.dano.maximo >= s.dano.minimo);
  assert.ok(s.dano.medioComCritico >= s.dano.medio);
  assert.ok(s.dano.critico >= s.dano.maximo);
  assert.ok(s.dpsTeorico > 0);
  assert.ok(s.alvo.dpsEfetivo <= s.dpsTeorico, 'com resistência o efetivo não passa do teórico');
  assert.ok(s.alvo.golpesParaDerrotar >= 1);
  // Medido no motor (muitos disparos): a média por golpe, depois da resistência, bate com a do simulador (o sorteio varia, a média não).
  const m = Simulador.medirNoMotor(e, 'spell-energy-strike', 600, { slot, alvo });
  const esperado = s.alvo.danoMedioPorGolpe;
  assert.ok(Math.abs(m.danoMedioPorGolpe - esperado) / esperado < 0.12, `medido ${m.danoMedioPorGolpe} vs simulado ${esperado}`);
  assert.ok(m.golpes >= 600);
});

test('o simulador: a penetração e a resistência do alvo mudam o dano efetivo; a mitigação do personagem mostra a proteção e a armadura', () => {
  const { e } = sorcerer();
  const sem = Simulador.simular(e, 'spell-energy-strike', { level: 300, resistencias: { energy: 60 } });
  e.equipment.ring = { id: Number(Object.values((await_catalogo()).values).find((i) => i.name === 'might ring').id), count: 1, af: [{ id: 'elem_pen', nivel: 5, value: 40 }] };
  Ficha.invalidar(e);
  const com = Simulador.simular(e, 'spell-energy-strike', { level: 300, resistencias: { energy: 60 } });
  assert.equal(sem.alvo.resistenciaEfetiva, 60);
  assert.equal(com.alvo.penetracao, 40);
  assert.equal(com.alvo.resistenciaEfetiva, 20);
  assert.ok(com.alvo.danoMedioPorGolpe > sem.alvo.danoMedioPorGolpe * 1.9);
  const mit = Simulador.mitigacao(e, { dano: 1000, tipo: 'physical' });
  assert.ok(mit.danoMedioRecebido <= 1000);
  assert.ok(mit.reducaoTotalPct >= 0);
  assert.equal(Simulador.simular(e, 'spell-que-nao-existe').ok, false);
});

function await_catalogo() {
  // O catálogo de itens (carregado na importação de `dados.mjs`).
  return { values: globalThis.__ITENS__ };
}
globalThis.__ITENS__ = (await import('../systems/dados.mjs')).ITEM_CATALOG;
