// (06/11, lote 11 das inertes — dono: "Continue resolvendo até dar zero nos itens") os SOLOS: os que você cria (`itens-poe/solos-seus.mjs` —
// Eletrizado, Cáustico, Ardente, Piche, Fúngico), os dos monstros em você, as Áreas Resfriadas, a Fé Quebrada e o lembrete do Oni-Goroshi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste } = await import('./apoio.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Cargas = await import('../systems/itens-poe/cargas.mjs');
const Traduzir = await import('../systems/itens-poe/traduzir.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');

const t = (texto) => {
  const nums = [];
  const modelo = texto.replace(/-?\d+(?:[.,]\d+)?/g, (m) => { nums.push(Number(m)); return `{${nums.length - 1}}`; });
  return Traduzir.traduzirMod({ modelo, valores: nums });
};
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 70, rng: () => 0.5 }));
/** O personagem com as LINHAS do PoE na arma (traduzidas como no jogo). */
function personagem(linhas = []) {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 90 });
  e.sistema = 'poe';
  e.classePoe = 'Witch';
  const arma = peca('Wands/Driftwood_Wand');
  const af = { ...(arma.poe.af ?? {}) };
  for (const l of linhas) for (const x of t(l).efeitos) af[x.stat] = (af[x.stat] ?? 0) + Number(x.valor);
  arma.poe.af = af;
  e.equipment = { ...(e.equipment ?? {}), weapon: arma };
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.clock = 100_000;
  e.maxHp = e.hp = 10_000;
  P.garantir(e);
  ModsPoe.definirFichaDaCacada(e.hunt, () => Ficha.combate(e));
  return e;
}
const ficha = (e) => { Ficha.invalidar(e); return Ficha.combate(e); };
const soma = (e) => { Ficha.invalidar(e); return Afixos.soma(e); };
const cargas = (e, tipo) => { const c = e.hunt.cargasPoe?.[tipo]; return c && c.ate > e.hunt.clock ? c.n : 0; };

const ARN = ['Ganha Cargas Brutais ao invés de Cargas de Tolerância', 'Máximo de Cargas Brutais é igual ao Máximo de Cargas de Tolerância', 'Modificadores ao Mínimo de Cargas de Tolerância são aplicados ao Mínimo de Cargas Brutais ao invés'];
const SolosSeus = await import('../systems/itens-poe/solos-seus.mjs');
const tique = (e, ms = 0) => { e.hunt.clock += ms; ModsPoe.tiqueDosAspectos(e, e.hunt, ficha(e), e.hunt.clock); };
const bichos = (e) => {
  const h = e.hunt;
  const [a, ...outros] = h.monstros;
  for (const o of outros) Object.assign(o, { x: h.pos.x + 60, y: h.pos.y + 60 });
  Object.assign(a, { x: h.pos.x + 1, y: h.pos.y, hp: 1e9, maxHp: 1e9, estados: {}, dots: [] });
  return a;
};

test('os seus solos nos monstros: o Eletrizado Eletriza, o Piche Tolhe, o Cáustico queima (Caos por segundo)', { skip: SEM }, () => {
  const e = personagem();
  const h = e.hunt;
  const a = bichos(e);
  SolosSeus.criar(h, 'eletrizado', { x: a.x, y: a.y, agora: h.clock });
  SolosSeus.criar(h, 'piche', { x: a.x, y: a.y, agora: h.clock });
  SolosSeus.criar(h, 'caustico', { x: a.x, y: a.y, dps: 100, agora: h.clock });
  tique(e, 100);
  assert.equal(a.estados.chocado?.pct, 15);
  assert.ok(a.estados.tolhido?.ate > h.clock);
  assert.ok(a.dots.some((d) => d.tipo === 'degenCaos'));
  tique(e, 5000);
  assert.equal(h.solosSeus.length, 0, 'acabaram (4 s)');
});

test('o Despertar da Destruição deixa o rastro; o Quebra-cercos: o lacaio que morre deixa Solo Cáustico de 20% da Vida dele', { skip: SEM }, () => {
  const e = personagem(['Deixa Solo Eletrizado enquanto se move, durando 2 segundos', 'Seus Lacaios espalham Solo Cáustico ao Morrer, causando 20% de sua Vida máxima como Dano de Caos por segundo']);
  const h = e.hunt;
  tique(e, 0);
  h.pos = { ...h.pos, x: h.pos.x + 1 };
  tique(e, 100);
  assert.ok(h.solosSeus.some((s) => s.tipo === 'eletrizado' && s.ate === h.clock + 2000));
  h.lacaios = [{ uid: 'l1', hp: 100, maxHp: 500, x: 3, y: 4 }];
  tique(e, 100);
  h.lacaios = [];
  tique(e, 100);
  const s = h.solosSeus.find((x) => x.tipo === 'caustico');
  assert.ok(s && s.x === 3 && s.y === 4 && s.dps === 100);
});

test('o Guarda-esporo: Solo Fúngico em volta enquanto parado — os monstros nele causam 10% menos; você ganha 10% Não-Caótico como Caos', { skip: SEM }, () => {
  const e = personagem(['Você tem Solo Fúngico ao seu redor enquanto parado']);
  const h = e.hunt;
  const a = bichos(e);
  h.poeRecente = { ...(h.poeRecente ?? {}), moveu: -1e9 };
  tique(e, 100);
  assert.ok(Math.abs(ModsPoe.doBicho(a, h.clock).danoFator - 0.9) < 1e-9);
  assert.ok(ModsPoe.tagsDoAlvo(a, h.clock).includes('alvoNoSoloFungico'));
  assert.ok((soma(e).naocaos_as_extra_chaos ?? 0) >= 10);
});

test('sobre o Solo Ardente/Eletrizado dos monstros (o Passo Natal); a Fé Quebrada cria Profano no lugar do Sagrado', { skip: SEM }, () => {
  const e = personagem(['Dano em Solo Ardente aumentado em 50%', 'Cria Solo Profano ao invés de Solo Sagrado']);
  const h = e.hunt;
  const antes = soma(e).dmg_inc ?? 0;
  h.solosDosMonstros = [{ tipo: 'ardente', x: h.pos.x, y: h.pos.y, z: h.z ?? 0, raio: 1, ate: h.clock + 5000 }];
  assert.equal((soma(e).dmg_inc ?? 0) - antes, 50);
  ModsPoe.criarSoloSagrado(h, 4, h.clock);
  assert.ok(!(h.solosSagrados ?? []).length && h.solosProfanos?.length === 1);
});

test('o lembrete do Oni-Goroshi (o que o Vosso Abraço dá) é só lembrete: nenhuma linha dele vale sozinha', { skip: SEM }, () => {
  const m = t('(Vosso Abraço concede o seguinte: / Não pode ser Atordoado / 123% do Dano Físico da Espada ganhado como Dano de Fogo Extra / Não é Afetado por Solo Ardente / Imune a Congelamento, Resfriamento e Incêndio / Velocidade de Ataque, Conjuração e Movimento aumentada em 20%)');
  assert.equal(m.estado, 'lembrete');
  assert.deepEqual(m.efeitos.filter((x) => x.stat !== 'lembrete'), []);
});
