// A REDUÇÃO DE DANO FÍSICO do PoE 1 (dono, 10/10): a da armadura e a redução física adicional SOMAM, e o total fica no teto de 90% — o
// mesmo para o jogador e para o monstro; a penetração física (Overwhelm) tira depois do teto, sem passar de 0. Antes, no jogo, as duas
// MULTIPLICAVAM (cada uma com o seu teto, e a armadura sem teto nenhum): 90% de armadura × 75% de redução deixava passar 2,5% (um golpe de
// 10 virava 0); no PoE passa 10% (1). Vale no golpe do jogador no monstro, no golpe e na magia física do monstro no jogador e no simulador.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Limites from '../systems/combate/limites.mjs';
import * as ModsPoe from '../systems/itens-poe/condicoes-poe.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Ficha from '../systems/ficha.mjs';
import * as Afixos from '../systems/afixos.mjs';
import * as Registro from '../systems/combate/registro.mjs';
import { resistido } from '../systems/hunt/resistencia.mjs';
import { criarMonstro, BESTIARY } from '../systems/hunt/monstros.mjs';
import { contraAtaque } from '../systems/hunt/combate.mjs';
import { dispararMagia } from '../systems/poderes.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import { ligado as jogoOficial } from '../systems/itens-poe/catalogo.mjs';
import { personagemDeTeste, PERSONAGEM, HUNT_DE_TESTE } from './apoio.mjs';

const soNoPoe = !jogoOficial() && 'só no jogo oficial (PoE)';
/** A fração que a armadura corta de um golpe (a fórmula do PoE). */
const daArmadura = (armadura, golpe) => armadura / (armadura + 5 * golpe);
/** A fração de um golpe físico que passa pela regra do PoE 1, escrita à parte (o teste não confia na conta do jogo): soma no teto de 90%. */
const passaNoPoe = (armadura, adicional, golpe) => 1 - Math.min(90, daArmadura(armadura, golpe) * 100 + adicional) / 100;

test('a conta pura: armadura + adicional somam, teto de 90% (jogador e monstro), Overwhelm depois do teto e nunca abaixo de 0', () => {
  assert.equal(Limites.LIMITES.armadura.reducaoMaxima, 90, 'o teto da soma é o mesmo da armadura (`combate/limites.json`)');
  assert.equal(Limites.reducaoFisicaTotal(0.5, 30), 80);
  assert.equal(Limites.reducaoFisicaTotal(0.9, 75), 90, 'o total para no teto');
  assert.equal(Limites.reducaoFisicaTotal(0.9, 75, 10), 80, 'o Overwhelm tira do total JÁ no teto');
  assert.equal(Limites.reducaoFisicaTotal(0.2, 0, 50), 0, 'sem passar de 0');
  assert.equal(Limites.reducaoFisicaTotal(0.5, -40), 50, 'a adicional negativa (fraqueza) fica de fora');
});

// Um monstro do PoE de mentira, com a armadura que o teste quer (a armadura do PoE não passa pela curva do Draevor).
function comMonstroDoPoe(armadura, fn) {
  BESTIARY.__teste_reducao_fisica = { name: 'Teste', hp: 1, elements: {}, poe: { nivel: 60, armadura, evasao: 0 } };
  try { return fn((physical) => ({ key: '__teste_reducao_fisica', uid: 1, hp: 1, maxHp: 1, resist: { physical } })); } finally { delete BESTIARY.__teste_reducao_fisica; }
}
const H = { clock: 0, escala: { nivel: 60 } };

test('golpe do JOGADOR no monstro: armadura + redução física adicional do bicho SOMADAS no teto de 90%', { skip: soNoPoe }, () => {
  // 5.000 de armadura contra 1.000 = 50%; + 30% (Infundido com Aço) = 80%: passam 200 (antes, 1.000 × 0,5 × 0,7 = 350).
  comMonstroDoPoe(5000, (bicho) => {
    assert.equal(resistido(H, bicho(30), 'physical', 1000, { penetracao: {} }), 200);
    // Overwhelm de 10%: depois do teto — 80 − 10 = 70%.
    assert.equal(resistido(H, bicho(30), 'physical', 1000, { penetracao: { fisica: 10 } }), 300);
    // A fraqueza física (a janela de vulnerabilidade do boss: adicional negativa) segue aumentando o dano por cima: 1.000 × 0,5 × 1,5.
    assert.equal(resistido(H, bicho(-50), 'physical', 1000, { penetracao: {} }), 750);
    // O elemental não muda (sem armadura; a resistência de sempre).
    assert.equal(resistido(H, bicho(30), 'fire', 1000, { penetracao: {} }), 1000);
  });
  // O exemplo do pedido: 90% de armadura (45.000 contra 1.000) + 75% de redução → 90%, passam 100 (antes, 1.000 × 0,1 × 0,25 = 25).
  comMonstroDoPoe(45000, (bicho) => {
    assert.equal(resistido(H, bicho(75), 'physical', 1000, { penetracao: {} }), 100);
    assert.equal(resistido(H, bicho(75), 'physical', 10, { penetracao: {} }), 1, 'um golpe de 10 deixa 1, não 0');
    assert.equal(resistido(H, bicho(75), 'physical', 1000, { penetracao: { fisica: 20 } }), 300, 'Overwhelm de 20 depois do teto: 70%');
  });
  // Sem a ficha do golpe (dano contínuo, charm): só a adicional, no MESMO teto de 90% (antes, 75%).
  comMonstroDoPoe(5000, (bicho) => assert.equal(resistido(H, bicho(80), 'physical', 1000), 200));
});

test('golpe do MONSTRO no jogador (a conta): armadura sobre o golpe físico bruto + a adicional inteira, no teto; conversões e fixo à parte', { skip: soNoPoe }, () => {
  const ficha = (physical, extra = {}) => ({ protection: { physical, fire: 75 }, afPoe: {}, ...extra });
  // 5.000 contra 1.000 = 50% + 12% (3 Cargas de Tolerância) = 62%: passam 380 (antes: 1.000 × 0,88 = 880, e a armadura contra 880 → 412).
  assert.ok(Math.abs(ModsPoe.acertoFisicoRecebido(ficha(12), 1000, 5000) - 380) < 1e-9);
  assert.ok(Math.abs(ModsPoe.acertoFisicoRecebido(ficha(12), 1000, 45000) - 100) < 1e-9, 'teto de 90%');
  // A adicional acima de 75% (o teto das resistências da ficha) volta inteira: 75 + 10 de excedente + 50% da armadura → 90%.
  assert.ok(Math.abs(ModsPoe.acertoFisicoRecebido(ficha(75, { excedentes: { protection: { physical: 10 } } }), 1000, 5000) - 100) < 1e-9);
  // "50% do Dano Físico sofrido como Dano de Fogo": a metade vai para o fogo (75%: passam 125) e só a outra metade (500) vê a armadura,
  // calculada sobre ELA: 5.000 / (5.000 + 2.500) = 66,7% + 12% = 78,7% → 106,7.
  const convertido = ModsPoe.acertoFisicoRecebido(ficha(12, { afPoe: { recebe_physical_como_fire: 50 } }), 1000, 5000);
  assert.ok(Math.abs(convertido - (125 + 500 * (1 - (daArmadura(5000, 500) * 100 + 12) / 100))) < 1e-9, `${convertido}`);
  // O fixo ("−25 de Dano Físico sofrido dos Acertos") vem DEPOIS da defesa.
  assert.ok(Math.abs(ModsPoe.acertoFisicoRecebido(ficha(12), 1000, 5000, { fixo: -25 }) - 355) < 1e-9);
});

// ---------------------------------------------------------------- pelo caminho de verdade da caçada

const ANEL = Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'might ring').id);
// (`forca`: o multiplicador de dano do bicho — o golpe do troll de teste é pequeno demais para medir uma fração.)
function cena(af, forca = 1) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 100 });
  e.maxHp = e.hp = 1e9;
  if (af) e.equipment.ring = { id: ANEL, count: 1, af };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(Cacadas.entrar(e, { huntId: HUNT_DE_TESTE, mode: 'auto' }).ok);
  const h = e.hunt;
  const m = criarMonstro({ key: 'troll', x: h.pos.x + 1, y: h.pos.y }, null);
  m.forca = (m.forca ?? 1) * forca;
  h.monstros.splice(0, h.monstros.length, m);
  return { e, h, m };
}
const comSorte = (valor, fn) => {
  const original = Math.random;
  Math.random = () => valor;
  try { return fn(); } finally { Math.random = original; }
};
const comRegistro = (fn) => {
  const antes = Registro.nivelDoRegistro();
  Registro.definirNivel(1);
  Registro.limparRegistro();
  try { return fn(); } finally { Registro.definirNivel(antes); Registro.limparRegistro(); }
};

test('golpe corpo a corpo do monstro no jogador (contraAtaque): a defesa física é a SOMA da armadura e da adicional, no teto', { skip: soNoPoe }, () => {
  // O tamanho do golpe do troll aqui: sem defesa física nenhuma.
  const bruto = comRegistro(() => {
    const { e, h, m } = cena(null, 25);
    comSorte(0.5, () => contraAtaque(e, h, PERSONAGEM, m, []));
    return Registro.ultimosGolpes(5).filter((g) => g.origem === 'mob').at(-1)?.danoAntesDaResistencia;
  });
  assert.ok(bruto >= 100, `o golpe do troll precisa ter tamanho para medir (${bruto})`);
  // Armadura que corta ~50% desse golpe + 30% de redução física adicional: o PoE soma (~80%); a conta antiga multiplicava (~65%).
  const g = comRegistro(() => {
    const { e, h, m } = cena([{ id: 'armor_flat', nivel: 5, value: 5 * bruto }, { id: 'phys_res', nivel: 5, value: 30 }], 25);
    comSorte(0.5, () => contraAtaque(e, h, PERSONAGEM, m, []));
    const golpe = Registro.ultimosGolpes(5).filter((x) => x.origem === 'mob').at(-1);
    return { ...golpe, adicional: Ficha.combate(e).protection.physical };
  });
  assert.equal(g.adicional, 30);
  const b = g.danoAntesDaResistencia;
  const soma = b * passaNoPoe(g.armadura, 30, b);
  const produto = b * 0.7 * (1 - daArmadura(g.armadura, b * 0.7));
  assert.ok(produto - soma >= 3, `as duas contas precisam se separar para o teste valer (${soma} × ${produto})`);
  // (O dano que chegou no jogador: sem Escudo de Energia, prey nem gemas no personagem de teste.)
  assert.ok(Math.abs(g.danoFinal - soma) <= 1, `soma no teto: ${g.danoFinal} ≈ ${soma.toFixed(2)} (a conta antiga dava ${produto.toFixed(2)})`);
});

test('magia FÍSICA do monstro no jogador: passa pela armadura (somada à adicional, no teto), como o golpe corpo a corpo', { skip: soNoPoe }, () => {
  const magia = { tipo: 'magia', elemento: 'physical', min: 1000, max: 1000, chance: 100, intervalo: 2000, alcance: 10 };
  const lancar = (af) => {
    const { e, h, m } = cena(af);
    const ficha = Ficha.combate(e);
    const dano = comSorte(0.999999, () => dispararMagia({ estado: e, hunt: h, personagem: PERSONAGEM, bicho: m, eventos: [], agora: 0, ficha, temEscudo: false }, magia));
    return { dano, ficha };
  };
  const sem = lancar(null);
  assert.ok(sem.dano > 0, 'a magia acerta');
  const forte = lancar([{ id: 'armor_flat', nivel: 5, value: 5000 }, { id: 'phys_res', nivel: 5, value: 20 }]);
  assert.equal(sem.ficha.protection.physical, 0);
  assert.equal(forte.ficha.protection.physical, 20);
  // O golpe da magia (o personagem de teste quase não tem armadura: ~1.000 passa) × a fração que a soma deixa passar; antes, a armadura
  // não cortava nada da magia (só os 20%).
  const golpe = sem.dano / passaNoPoe(sem.ficha.armor ?? 0, 0, sem.dano);
  const esperado = golpe * passaNoPoe(forte.ficha.armor, 20, golpe);
  assert.ok(Math.abs(forte.dano - esperado) <= 2, `${forte.dano} ≈ ${esperado.toFixed(1)}`);
  assert.ok(forte.dano < golpe * 0.8 - 5, `a armadura corta além dos 20% (${forte.dano} < ${(golpe * 0.8).toFixed(1)})`);
});
