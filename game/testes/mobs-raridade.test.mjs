// RARIDADE e MODIFICADORES dos mobs (pedido do dono, 01/10): data-driven, só o
// que o SPAWN do mapa configura, e entrando nos MESMOS campos que o combate lê.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Raridade from '../systems/mobs/raridade.mjs';
import * as Spawns from '../systems/mapa/spawns.mjs';
import * as Instancia from '../systems/hunt/instancia.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Treino from '../systems/treino.mjs';
import * as Ficha from '../systems/ficha.mjs';
import * as Atributos from '../systems/personagem/atributos.mjs';
import { criarMonstro, passoDoBicho, BESTIARY } from '../systems/hunt/monstros.mjs';
import { resistenciaDe } from '../systems/hunt/resistencia.mjs';
import { personagemDeTeste } from './apoio.mjs';

const bicho = () => criarMonstro({ key: 'troll', x: 0, y: 0 }, null);

test('dados: toda raridade tem cor e multiplicadores; todo modificador tem nome e stats/mecânicas conhecidos', () => {
  for (const [id, r] of Object.entries(Raridade.CONFIG.raridades)) {
    assert.match(r.cor, /^#[0-9a-f]{6}$/i, id);
    for (const k of ['vida', 'dano', 'exp', 'loot']) assert.ok(Number.isFinite(r[k]), `${id}.${k}`);
  }
  const STATS = new Set(['vidaPct', 'danoPct', 'armaduraPct', 'velocidadePct', 'velocidadeDeAtaquePct', 'regenPct', 'resist']);
  const GATILHOS = new Set(['aoMorrer', 'vidaBaixa', 'aoReceberDano', 'aoAtacar', 'aliadoMorreu', 'aura']);
  for (const [id, m] of Object.entries(Raridade.MODIFICADORES)) {
    assert.ok(m.nome, id);
    for (const k of Object.keys(m.stats ?? {})) assert.ok(STATS.has(k), `${id}: stat ${k}`);
    for (const x of m.mecanicas ?? []) assert.ok(GATILHOS.has(x.gatilho) && x.efeito, `${id}: mecânica ${JSON.stringify(x)}`);
  }
});

test('mob normal sem modificador não ganha campo nenhum (o banco não cresce)', () => {
  const m = bicho();
  const antes = JSON.stringify(m);
  Raridade.aplicar(m, { raridade: 'normal', modificadores: [] });
  assert.equal(JSON.stringify(m), antes);
});

test('raro com "Vigoroso" e "Brutal": vida, dano, exp e loot nos MESMOS campos do combate', () => {
  const base = bicho();
  const m = Raridade.aplicar(bicho(), { raridade: 'raro', modificadores: ['vigoroso', 'brutal'] });
  const r = Raridade.CONFIG.raridades.raro;
  assert.equal(m.maxHp, Math.round(base.maxHp * r.vida * 1.5));
  assert.equal(m.hp, m.maxHp);
  assert.ok(Math.abs(m.forca - r.dano * 1.25) < 1e-9, 'dano no `forca` (o mesmo de Reforcos.forcaDoBicho)');
  assert.equal(m.exp, Math.round(base.exp * r.exp));
  assert.equal(m.lootMult, r.loot);
  assert.equal(m.raridade, 'raro');
  assert.deepEqual(m.mods, ['vigoroso', 'brutal']);
});

test('resistência, velocidade e armadura entram nos cálculos que já existem', () => {
  const base = bicho();
  const m = Raridade.aplicar(bicho(), { raridade: 'modificado', modificadores: ['ignifugo', 'veloz'] });
  assert.equal(resistenciaDe(null, m, 'fire'), resistenciaDe(null, base, 'fire') + 40, 'a resistência soma à do bestiário');
  assert.equal(resistenciaDe(null, m, 'ice'), resistenciaDe(null, base, 'ice'));
  assert.ok(passoDoBicho(m) < passoDoBicho(base), 'o passo fica mais curto');
  const b = Raridade.aplicar(bicho(), { raridade: 'modificado', modificadores: ['blindado'] });
  assert.equal(b.armor, Math.round((base.armor ?? 0) * 1.6));
});

test('o level do mob não sobe com a exp a mais da raridade', () => {
  const base = bicho();
  const m = Raridade.aplicar(bicho(), { raridade: 'elite' });
  assert.equal(Atributos.levelDoBicho(null, m), Atributos.levelDoBicho(null, base));
});

test('elite e boss contam para os adds "Damage vs Elite/Boss" do jogador', () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 200 });
  const ficha = { danoContra: { monstros: 0, elite: 20, boss: 30 } };
  assert.equal(Ficha.fatorContraOAlvo(e, bicho(), ficha), 1);
  assert.equal(Ficha.fatorContraOAlvo(e, Raridade.aplicar(bicho(), { raridade: 'elite' }), ficha), 1.2);
  assert.equal(Ficha.fatorContraOAlvo(e, Raridade.aplicar(bicho(), { raridade: 'boss' }), ficha), 1.3);
});

test('spawn: a raridade vem do `raridade` ou do `tipo` de antes; modificador num normal vira "modificado"; teto por raridade', () => {
  assert.deepEqual(Raridade.doSpawn({ tipo: 'normal' }), { raridade: 'normal', modificadores: [] });
  assert.equal(Raridade.doSpawn({ tipo: 'elite' }).raridade, 'elite');
  assert.equal(Raridade.doSpawn({ tipo: 'miniboss' }).raridade, 'raro');
  assert.deepEqual(Raridade.doSpawn({ tipo: 'normal', modificadores: ['explosivo'] }), { raridade: 'modificado', modificadores: ['explosivo'] });
  const muitos = ['vigoroso', 'brutal', 'veloz', 'blindado', 'regenerador'];
  assert.equal(Raridade.doSpawn({ raridade: 'modificado', modificadores: muitos }).modificadores.length, Raridade.CONFIG.raridades.modificado.maxModificadores);
  assert.deepEqual(Raridade.doSpawn({ raridade: 'raro', modificadores: ['xpto', 'brutal'] }).modificadores, ['brutal'], 'o desconhecido sai');
});

test('spawn: o editor de mapas recusa raridade/modificador desconhecido e passa do teto', () => {
  const base = { x: 1, y: 1, criaturas: [{ key: 'troll' }] };
  assert.deepEqual(Spawns.validar([{ ...base, raridade: 'raro', modificadores: ['brutal'] }]), []);
  assert.ok(Spawns.validar([{ ...base, raridade: 'lendario' }]).some((e) => e.includes('raridade desconhecida')));
  assert.ok(Spawns.validar([{ ...base, modificadores: ['xpto'] }]).some((e) => e.includes('modificador desconhecido')));
  assert.ok(Spawns.validar([{ ...base, raridade: 'modificado', modificadores: ['vigoroso', 'brutal', 'veloz'] }]).some((e) => e.includes('aceita até')));
  // E o spawn normalizado leva os campos para a instância.
  const n = Spawns.normalizar({ ...base, raridade: 'raro', modificadores: ['brutal'] }, 7);
  assert.equal(n.raridade, 'raro');
  assert.deepEqual(n.modificadores, ['brutal']);
});

test('instância: o mob do spawn configurado nasce raro, com os modificadores, e continua um objetivo da limpeza', () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 200 });
  Treino.garantir(e);
  assert.ok(Cacadas.entrar(e, { huntId: 'troll-cave', mode: 'auto' }).ok);
  const grade = Cacadas.gradeDaHunt({ id: 'troll-cave' });
  const inicio = { x: e.hunt.pos.x, y: e.hunt.pos.y, z: e.hunt.z };
  const spawns = [{ id: 's-raro', x: inicio.x, y: inicio.y, z: inicio.z, raio: 3, quantidade: 2, tipo: 'normal', raridade: 'raro', modificadores: ['vigoroso', 'explosivo'], criaturas: [{ key: 'troll', peso: 1 }] }];
  const bichos = Instancia.comporBichos({ grade, spawns, dadosDaHunt: null, inicio, escala: null, aplicarEscala: (m) => m, instanciaId: 'inst-1', rng: () => 0 });
  assert.equal(bichos.length, 2);
  for (const { m } of bichos) {
    assert.equal(m.raridade, 'raro');
    assert.deepEqual(m.mods, ['vigoroso', 'explosivo']);
    assert.equal(m.instancia, 'inst-1');
    assert.equal(m.objetivo, 1);
    assert.ok(m.maxHp > BESTIARY.troll.hp);
  }
  assert.deepEqual(Raridade.mecanicasDe(bichos[0].m).map((x) => x.efeito), ['explosao'], 'a mecânica vem dos dados do modificador');
});

test('a tela recebe o level, a raridade e os NOMES dos modificadores; as cores vão no config', () => {
  const m = Raridade.aplicar(bicho(), { raridade: 'raro', modificadores: ['explosivo', 'regenerador'] });
  assert.deepEqual(Raridade.paraCliente(m), { raridade: 'raro', mods: ['Explosivo', 'Regenerador'] });
  assert.deepEqual(Raridade.paraCliente(bicho()), {});
  const cores = Raridade.coresParaCliente();
  assert.equal(cores.raro.cor, Raridade.CONFIG.raridades.raro.cor);
  assert.ok(cores.normal && cores.elite && cores.boss);
});
