// (dono, 20/10 — o lote PR2) O CAOS ATRAVESSA O ESCUDO DE ENERGIA, como no PoE: o golpe dos monstros (a parte de Caos dele), as magias e mecânicas deles, o
// degenerativo de Caos em você e o Ritual Proibido vão por um caminho só (`Defesa.absorverComOCaos`), com as exceções do PoE — "Dano de Caos sofrido não
// ultrapassa o Escudo de Energia" (a Carne Divina, os modificadores de mapa) e "X% do dano de caos sofrido não ignora o escudo de energia".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
const Defesa = await import('../systems/personagem/defesa.mjs');
const Poderes = await import('../systems/poderes.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const M = await import('../systems/mobs/atributos.mjs');
const { contraAtaque } = await import('../systems/hunt/combate.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');

const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 70, rng: () => 0.5 }));

test('absorverComOCaos: a parte de Caos vai direto à Vida (e reinicia a recarga); o resto pelo Escudo; as exceções do PoE', { skip: SEM }, () => {
  const caso = (afPoe) => {
    const estado = { es: 1000, esEspera: 0 };
    const ficha = { energyShield: 1000, afPoe };
    const vida = Defesa.absorverComOCaos(estado, ficha, 500, 300, [], { uid: 'player' });
    return { vida, es: estado.es, espera: estado.esEspera };
  };
  const comum = caso({});
  assert.deepEqual([comum.vida, comum.es], [300, 800], 'os 300 de Caos na Vida; os 200 no Escudo');
  assert.ok(comum.espera > 0);
  assert.deepEqual([caso({ caos_nao_atravessa_escudo: 1 }).vida, caso({ caos_nao_atravessa_escudo: 1 }).es], [0, 500], 'a Carne Divina: tudo pelo Escudo');
  const metade = caso({ caos_pelo_escudo_pct: 50 });
  assert.deepEqual([metade.vida, metade.es], [150, 650], '"50% do dano de caos sofrido não ignora o escudo": 150 direto, 350 no Escudo');
  // sem Caos: o caminho de sempre
  const est = { es: 1000 };
  assert.equal(Defesa.absorverComOCaos(est, { energyShield: 1000, afPoe: {} }, 500, 0, [], {}), 0);
  assert.equal(est.es, 500);
});

test('as magias e o degenerativo dos monstros (Poderes.aplicarNoJogador): o Caos atravessa o Escudo — o mesmo caminho', { skip: SEM }, () => {
  const estado = { es: 1000, hp: 5000, maxHp: 5000, mana: 0 };
  const ficha = { energyShield: 1000, afPoe: {} };
  const base = { uid: 'player', quem: 'x', x: 0, y: 0 };
  const hunt = { pos: { x: 0, y: 0 }, clock: 0 };
  Poderes.aplicarNoJogador({ estado, hunt, bicho: { key: 'k', hp: 1 }, dano: 400, elemento: 'chaos', eventos: [], base, ficha, temEscudo: false });
  assert.deepEqual([estado.hp, estado.es], [4600, 1000]);
  Poderes.aplicarNoJogador({ estado, hunt, bicho: { key: 'k', hp: 1 }, dano: 400, elemento: 'fire', eventos: [], base, ficha, temEscudo: false });
  assert.deepEqual([estado.hp, estado.es], [4600, 600]);
});

/** Um personagem do PoE com Escudo de Energia (a Veste Arcana) e o monstro colado com o golpe de Caos a mais; `af` na varinha. */
function golpeDeCaos(af = {}) {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 90 });
  e.sistema = 'poe';
  e.classePoe = 'Witch';
  const arma = peca('Wands/Driftwood_Wand');
  arma.poe.af = { ...(arma.poe.af ?? {}), ...af };
  e.equipment = { ...(e.equipment ?? {}), weapon: arma, body: peca('Body_Armours/Arcane_Vestment') };
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  // (o entrar sorteia a raridade e os mods do monstro: travado, o mesmo monstro nos dois casos)
  const sorteio = Math.random;
  Math.random = () => 0.5;
  try { assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok); } finally { Math.random = sorteio; }
  const h = e.hunt;
  h.clock = 100_000;
  e.maxHp = e.hp = 1e6;
  const es = Ficha.combate(e).energyShield;
  assert.ok(es > 0, 'a Veste Arcana dá Escudo');
  e.es = es;
  const [m, ...outros] = h.monstros;
  for (const o of outros) Object.assign(o, { x: h.pos.x + 60, y: h.pos.y + 60 });
  Object.assign(m, { x: h.pos.x + 1, y: h.pos.y, hp: 1e9, maxHp: 1e9 });
  const antes = M.CONFIG.porEspecie.especies;
  M.CONFIG.porEspecie.especies = { ...(antes ?? {}), [m.key]: { ...(antes?.[m.key] ?? {}), danoExtra: [{ elemento: 'chaos', min: 20_000, max: 20_000 }] } };
  const original = Math.random;
  try {
    Math.random = () => 0.99;
    for (let i = 0; i < 20 && e.hp === 1e6 && e.es === es; i++) contraAtaque(e, h, PERSONAGEM, m, []);
  } finally { Math.random = original; M.CONFIG.porEspecie.especies = antes; }
  return { vida: 1e6 - e.hp, escudo: es - e.es, es };
}

test('o golpe corpo a corpo do monstro: a parte de Caos vai à Vida (o Escudo só segura o resto); com "Dano de Caos sofrido não ultrapassa o Escudo", o Escudo segura', { skip: SEM }, () => {
  const atravessa = golpeDeCaos();
  const naoAtravessa = golpeDeCaos({ caos_nao_atravessa_escudo: 1 });
  assert.ok(atravessa.vida > 0 && naoAtravessa.vida > 0, JSON.stringify({ atravessa, naoAtravessa }));
  // sem a exceção, o Escudo fica (quase) inteiro — só a parte física passa por ele; com ela, os 20.000 de Caos o esgotam
  assert.equal(naoAtravessa.escudo, naoAtravessa.es);
  assert.ok(atravessa.escudo < atravessa.es, JSON.stringify(atravessa));
  // o mesmo golpe nos dois: o que o Escudo deixou de segurar foi para a Vida
  assert.equal(atravessa.vida + atravessa.escudo, naoAtravessa.vida + naoAtravessa.escudo, JSON.stringify({ atravessa, naoAtravessa }));
  assert.ok(atravessa.vida > naoAtravessa.vida);
});
