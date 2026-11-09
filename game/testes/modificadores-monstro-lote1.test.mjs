// (09/11 — dono: "quero resolver os aproximados e parciais" dos modificadores de monstro) LOTE 1: o dano POR TIPO do monstro, como no PoE —
// a conversão do Físico ("25% do Dano Físico Convertido em Fogo"), o extra que sai do Físico ("Ganha X% do Dano Físico como Dano Extra de Fogo"),
// o "+X% de Dano de Fogo" só na parte de Fogo, o crítico aumentado (sobre a base) e o "Sempre Crita", e a velocidade de conjuração separada.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as M from '../systems/mobs/atributos.mjs';
import * as Raridade from '../systems/mobs/raridade.mjs';
import * as Ficha from '../systems/ficha.mjs';
import * as Afixos from '../systems/afixos.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import { criarMonstro } from '../systems/hunt/monstros.mjs';
import { contraAtaque } from '../systems/hunt/combate.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import { personagemDeTeste, PERSONAGEM, HUNT_DE_TESTE } from './apoio.mjs';

const troll = (extra = {}) => Object.assign(criarMonstro({ key: 'troll', x: 1, y: 1 }, null), extra);

function cena(extra = {}, { resFogo = 0 } = {}) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 100 });
  e.maxHp = e.hp = 1e9;
  if (resFogo) {
    const ANEL = Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'might ring').id);
    e.equipment.ring = { id: ANEL, count: 1, af: [{ id: 'fire_res', nivel: 5, value: resFogo }] };
    Afixos.sincronizarMaximos(e);
    Ficha.invalidar(e);
  }
  assert.ok(Cacadas.entrar(e, { huntId: HUNT_DE_TESTE, mode: 'auto' }).ok);
  const h = e.hunt;
  const m = Object.assign(criarMonstro({ key: 'troll', x: h.pos.x + 1, y: h.pos.y }, null), extra);
  h.monstros.splice(0, h.monstros.length, m);
  return { e, h, m };
}
const bater = ({ e, h, m }) => {
  const ev = [];
  const original = Math.random;
  Math.random = () => 0.5;
  try { contraAtaque(e, h, PERSONAGEM, m, ev); } finally { Math.random = original; }
  return ev.filter((x) => x.t === 'dmg' && !x.foe).reduce((n, x) => n + x.v, 0);
};

test('a CONVERSÃO do Físico: o golpe 100% convertido em Fogo passa pela resistência a Fogo (o físico some); sem conversão, a resistência a Fogo não muda nada', () => {
  const fisico = bater(cena());
  assert.equal(bater(cena({}, { resFogo: 60 })), fisico, 'golpe físico: a resistência a fogo não corta');
  const emFogo = bater(cena({ conversaoPct: { fire: 100 } }));
  const emFogoResistido = bater(cena({ conversaoPct: { fire: 100 } }, { resFogo: 60 }));
  assert.ok(emFogo > 0 && emFogoResistido < emFogo * 0.75, `${emFogo} → ${emFogoResistido} com 60% de resistência a fogo`);
  // passando de 100%, as conversões encolhem juntas: nada de dano a mais
  assert.ok(Math.abs(bater(cena({ conversaoPct: { fire: 150, ice: 150 } })) - emFogo) <= emFogo * 0.05);
});

test('o "+X% de Dano de Fogo" só vale na parte de Fogo; o "Dano Físico aumentado" vale na física e na convertida dela', () => {
  const base = bater(cena());
  assert.equal(bater(cena({ danoTipoPct: { fire: 100 } })), base, 'sem fogo no golpe, o +% de fogo não faz nada');
  assert.ok(bater(cena({ danoTipoPct: { physical: 100 } })) > base * 1.5, 'o físico dobra');
  const convertido = bater(cena({ conversaoPct: { fire: 100 } }));
  assert.ok(bater(cena({ conversaoPct: { fire: 100 }, danoTipoPct: { fire: 100 } })) > convertido * 1.5, 'o +% de fogo pega no convertido');
  assert.ok(bater(cena({ conversaoPct: { fire: 100 }, danoTipoPct: { physical: 100 } })) > convertido * 1.5, 'e o do físico também (de onde ele veio)');
});

test('o extra que sai do Físico ("Ganha X% do Dano Físico como Dano Extra de Fogo") soma ao golpe; o do elemento aleatório sorteia Fogo, Gelo ou Raio', () => {
  const base = bater(cena());
  assert.ok(bater(cena({ extraDoFisicoPct: { fire: 100 } })) > base * 1.5);
  assert.ok(bater(cena({ danoExtraAleatorioPct: 100 })) > base * 1.5);
  const sorteados = new Set([0, 0.4, 0.8].map((r) => M.extrasDoFisicoDoBicho(troll({ danoExtraAleatorioPct: 30 }), () => r)[0].elemento));
  assert.deepEqual([...sorteados].sort(), ['energy', 'fire', 'ice']);
  assert.deepEqual(M.extrasDoFisicoDoBicho(troll()), [], 'sem o modificador, nada');
});

test('o crítico do PoE: "+100% de Chance de Acerto Crítico" dobra a base da espécie (5% sem base); "Sempre Crita" crita em todo acerto', () => {
  assert.equal(M.critico(troll()).chance, 0, 'sem nada, o troll não crita');
  assert.equal(Math.round(M.critico(troll({ critChancePct: 100 })).chance * 100), 10, '5% × 2');
  assert.equal(M.critico(troll({ sempreCritico: true })).chance, 1);
  assert.equal(M.rolarCritico(troll({ sempreCritico: true }), null, () => 0.999).critico, true);
});

test('os modificadores do arquivo: o Manipulador do Fogo com o dano de Fogo, o extra e a conversão por elemento; o Atirador e o Assassino exatos; a raridade aplica os campos', () => {
  const d = JSON.parse(readFileSync(new URL('../gamedata/itens-poe/modificadores-monstro.json', import.meta.url), 'utf8'));
  const por = (id) => d.mods.find((m) => m.id === id);
  assert.deepEqual(por('MonsterArchnemesisFlameTouched').stats, { danoTipoPct: { fire: 50 }, danoExtraPct: { fire: 50 }, conversaoPct: { fire: 25 }, resist: { fire: 50 } });
  assert.equal(por('MonsterArchnemesisDeadeye').estado, 'efeito');
  assert.equal(por('MonsterArchnemesisDeadeye').stats.critChancePct, 100);
  // a raridade põe os campos no monstro (o mod registrado à mão, como o catálogo do PoE faz)
  Raridade.MODIFICADORES['teste:fogo'] = { nome: 'Teste', stats: { danoTipoPct: { fire: 50 }, danoExtraPct: { fire: 20 }, conversaoPct: { fire: 25 }, velocidadeDeConjuracaoPct: 30, critChancePct: 50 } };
  try {
    const m = Raridade.aplicar(troll(), { raridade: 'raro', modificadores: ['teste:fogo', 'teste:fogo'], multiplicadores: {} });
    assert.deepEqual(m.danoTipoPct, { fire: 100 }, 'somam como as resistências');
    assert.deepEqual(m.extraDoFisicoPct, { fire: 40 });
    assert.deepEqual(m.conversaoPct, { fire: 50 });
    assert.equal(Math.round(m.velocidadeDeConjuracao * 100), 160);
    assert.equal(m.critChancePct, 100);
  } finally {
    delete Raridade.MODIFICADORES['teste:fogo'];
  }
});

test('o Sangue Corrompido: o acerto novo renova a duração de todos os acúmulos em você, e cada um segue pagando o mesmo por segundo até o fim novo', async () => {
  const Dot = await import('../systems/combate/dot.mjs');
  const { renovarSangueCorrompido } = await import('../systems/mobs/mecanicas.mjs');
  const hunt = {};
  Dot.aplicarNoJogador(hunt, { tipo: 'sangueCorrompido', total: 400, duracaoMs: 4000 }, 0);
  Dot.aplicarNoJogador(hunt, { tipo: 'sangueCorrompido', total: 400, duracaoMs: 4000 }, 2000);
  const [velho, novo] = hunt.efeitosDoJogador.dots;
  const porPulso = velho.porPulso;
  renovarSangueCorrompido(hunt);
  assert.equal(velho.ate, novo.ate, 'o mais velho vai até o fim do novo');
  assert.equal(velho.porPulso, porPulso, 'o mesmo por pulso');
  assert.equal(velho.falta, 400 + porPulso * 2, 'com o dano dos 2 s a mais');
});
