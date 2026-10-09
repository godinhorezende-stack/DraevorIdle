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
import { personagemDeTeste, HUNT_DE_TESTE } from './apoio.mjs';
import { aAdaptar, doClassico } from './apoio-migracao.mjs';

const bicho = () => criarMonstro({ key: 'troll', x: 0, y: 0 }, null);

test('dados: toda raridade tem cor e multiplicadores; todo modificador tem nome e stats/mecânicas conhecidos', () => {
  for (const [id, r] of Object.entries(Raridade.CONFIG.raridades)) {
    assert.match(r.cor, /^#[0-9a-f]{6}$/i, id);
    for (const k of ['vida', 'dano', 'exp', 'loot']) assert.ok(Number.isFinite(r[k]), `${id}.${k}`);
  }
  // (+ os do PoE que o mob aplica desde 09/10: o escudo de energia, a espera da recarga, à prova de maldições e "Reflete Feitiços" — `raridade.aplicar`)
  const STATS = new Set(['vidaPct', 'danoPct', 'velocidadePct', 'velocidadeDeAtaquePct', 'regenPct', 'resist', 'precisaoPct', 'evasaoPct', 'armaduraPct', 'bloqueio', 'reducaoDeDano', 'critChance', 'critMultiplicador',
    'esPct', 'esAtrasoMenosPct', 'aProvaDeMaldicoes', 'refleteFeiticos']);
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

test('raro com "Vigoroso" e "Brutal": vida, dano, exp e loot nos MESMOS campos do combate', { skip: doClassico("Raridade de monstro do Draevor (Vigoroso, Brutal, Blindado, levelExtra, spawn do editor)") }, () => {
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

test('resistência e velocidade entram nos cálculos que já existem (Blindado = resistência física)', { skip: doClassico("Raridade de monstro do Draevor (Vigoroso, Brutal, Blindado, levelExtra, spawn do editor)") }, () => {
  const base = bicho();
  const m = Raridade.aplicar(bicho(), { raridade: 'modificado', modificadores: ['ignifugo', 'veloz'] });
  assert.equal(resistenciaDe(null, m, 'fire'), resistenciaDe(null, base, 'fire') + 40, 'a resistência soma à do bestiário');
  assert.equal(resistenciaDe(null, m, 'ice'), resistenciaDe(null, base, 'ice'));
  assert.ok(passoDoBicho(m) < passoDoBicho(base), 'o passo fica mais curto');
  const b = Raridade.aplicar(bicho(), { raridade: 'modificado', modificadores: ['blindado'] });
  assert.equal(resistenciaDe(null, b, 'physical'), resistenciaDe(null, base, 'physical') + 30, 'a armadura do mob não entra no dano: o Blindado resiste ao físico');
});

test('o level do mob sobe só o `levelExtra` da raridade (a exp a mais não conta), e vale no acerto do jogador', { skip: doClassico("Raridade de monstro do Draevor (Vigoroso, Brutal, Blindado, levelExtra, spawn do editor)") }, () => {
  const base = bicho();
  for (const r of ['modificado', 'raro', 'elite', 'unico', 'boss']) {
    const m = Raridade.aplicar(bicho(), { raridade: r });
    const extra = Raridade.CONFIG.raridades[r].levelExtra;
    assert.ok(extra > 0, r);
    assert.equal(Atributos.levelDoBicho(null, m), Atributos.levelDoBicho(null, base) + extra, r);
  }
  // Na campanha o level vem da fase: a raridade soma por cima.
  const hunt = { escala: { nivel: 40 } };
  const boss = Raridade.aplicar(bicho(), { raridade: 'boss' });
  assert.equal(Atributos.levelDoBicho(hunt, boss), 40 + Raridade.CONFIG.raridades.boss.levelExtra);
  assert.equal(Atributos.levelDoBicho(hunt, base), 40);
  assert.ok(Atributos.chanceDeAcerto(30, Atributos.levelDoBicho(hunt, boss)) < Atributos.chanceDeAcerto(30, 40), 'mais difícil de acertar');
  assert.equal(Raridade.aplicar(bicho(), { raridade: 'normal', modificadores: [] }).levelExtra, undefined);
});

test('elite e boss contam para os adds "Damage vs Elite/Boss" do jogador', () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 200 });
  const ficha = { danoContra: { monstros: 0, elite: 20, boss: 30 } };
  assert.equal(Ficha.fatorContraOAlvo(e, bicho(), ficha), 1);
  assert.equal(Ficha.fatorContraOAlvo(e, Raridade.aplicar(bicho(), { raridade: 'elite' }), ficha), 1.2);
  assert.equal(Ficha.fatorContraOAlvo(e, Raridade.aplicar(bicho(), { raridade: 'boss' }), ficha), 1.3);
});

test('spawn: a raridade vem do `raridade` ou do `tipo` de antes; modificador num normal vira "modificado"; teto por raridade', { skip: doClassico("Raridade de monstro do Draevor (Vigoroso, Brutal, Blindado, levelExtra, spawn do editor)") }, () => {
  assert.deepEqual(Raridade.doSpawn({ tipo: 'normal' }), { raridade: 'normal', modificadores: [] });
  assert.equal(Raridade.doSpawn({ tipo: 'elite' }).raridade, 'elite');
  assert.equal(Raridade.doSpawn({ tipo: 'miniboss' }).raridade, 'raro');
  assert.deepEqual(Raridade.doSpawn({ tipo: 'normal', modificadores: ['explosivo'] }), { raridade: 'modificado', modificadores: ['explosivo'] });
  const muitos = ['vigoroso', 'brutal', 'veloz', 'blindado', 'regenerador'];
  assert.equal(Raridade.doSpawn({ raridade: 'modificado', modificadores: muitos }).modificadores.length, Raridade.CONFIG.raridades.modificado.maxModificadores);
  assert.deepEqual(Raridade.doSpawn({ raridade: 'raro', modificadores: ['xpto', 'brutal'] }).modificadores, ['brutal'], 'o desconhecido sai');
});

test('spawn: o editor de mapas recusa raridade/modificador desconhecido e passa do teto', { skip: doClassico("Raridade de monstro do Draevor (Vigoroso, Brutal, Blindado, levelExtra, spawn do editor)") }, () => {
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

test('instância: o mob do spawn configurado nasce raro, com os modificadores, e continua um objetivo da limpeza', { skip: doClassico("Raridade de monstro do Draevor (Vigoroso, Brutal, Blindado, levelExtra, spawn do editor)") }, () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 200 });
  Treino.garantir(e);
  assert.ok(Cacadas.entrar(e, { huntId: HUNT_DE_TESTE, mode: 'auto' }).ok);
  const grade = Cacadas.gradeDaHunt({ id: HUNT_DE_TESTE });
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

test('a tela recebe o level, a raridade e os NOMES dos modificadores; as cores vão no config', { skip: doClassico("Raridade de monstro do Draevor (Vigoroso, Brutal, Blindado, levelExtra, spawn do editor)") }, () => {
  const m = Raridade.aplicar(bicho(), { raridade: 'raro', modificadores: ['explosivo', 'regenerador'] });
  assert.deepEqual(Raridade.paraCliente(m), { raridade: 'raro', mods: ['Explosivo', 'Regenerador'], lvExtra: Raridade.CONFIG.raridades.raro.levelExtra });
  assert.deepEqual(Raridade.paraCliente(bicho()), {});
  const cores = Raridade.coresParaCliente();
  assert.equal(cores.raro.cor, Raridade.CONFIG.raridades.raro.cor);
  assert.ok(cores.normal && cores.elite && cores.boss);
});

test('fase 3: todo modificador tem uma descrição gerada dos dados (os números do JSON aparecem no texto)', { skip: aAdaptar("Os 204 modificadores de monstro do PoE mostram o texto do PoE; em 36 deles o jogo aplica uma aproximação com outros números (falta mostrar o que vale no jogo)") }, () => {
  for (const [id, m] of Object.entries(Raridade.MODIFICADORES)) {
    const d = Raridade.descricaoDe(id);
    assert.ok(d.length > 5, `${id} sem descrição`);
    const numeros = [...JSON.stringify({ s: m.stats, m: (m.mecanicas ?? []).map(({ gatilho, efeito, elemento, tipos, mesmaCriatura, ...resto }) => resto) }).matchAll(/\d+(\.\d+)?/g)]
      .map((x) => x[0])
      .filter((n) => !['1000'].includes(n));
    for (const n of numeros) {
      const comoTexto = n.replace('.', ',');
      // ms viram segundos no texto.
      assert.ok(d.includes(comoTexto) || d.includes(String(Number(n) / 1000).replace('.', ',')), `${id}: "${n}" não está em "${d}"`);
    }
  }
  assert.equal(Raridade.descricaoDe('xpto'), '');
});

test('fase 3: o cliente recebe o texto pelo NOME do modificador e o resumo da raridade; o editor recebe ids, tetos e o tipo antigo', { skip: doClassico("Raridade de monstro do Draevor (Vigoroso, Brutal, Blindado, levelExtra, spawn do editor)") }, () => {
  const textos = Raridade.modificadoresParaCliente();
  assert.equal(textos.Explosivo, Raridade.descricaoDe('explosivo'));
  const raro = Raridade.coresParaCliente().raro;
  assert.match(raro.resumo, /vida ×/);
  assert.match(raro.resumo, /Lv \+3/);
  assert.equal(Raridade.coresParaCliente().normal.resumo, '');
  const op = Raridade.opcoesParaEditor();
  assert.deepEqual(op.raridades.map((r) => r.id), Raridade.RARIDADES);
  assert.equal(op.raridades.find((r) => r.id === 'modificado').maxModificadores, Raridade.CONFIG.raridades.modificado.maxModificadores);
  assert.ok(op.modificadores.every((m) => m.id && m.nome && m.descricao));
  assert.equal(op.tipoDoSpawn.elite, 'elite');
});
