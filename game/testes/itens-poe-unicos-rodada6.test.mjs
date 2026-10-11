// Os MODIFICADORES DOS ÚNICOS — rodada 6: armas, armaduras e amuletos (dono, 11/10: "quero tentar resolver todos os modificadores únicos";
// depois da rodada 5: "seguir nas avulsas"). A Velocidade de Conjuração no ataque, os CUSTOS (em escudo, o a mais em vida/escudo), o crítico
// da REPETIÇÃO final, a magnitude dos IMPLÍCITOS, os FRASCOS (a mana que recupera vida, o de mana que não para, as cargas por segundo e dos
// mortos sangrando), o "sem modificador de Vida nos outros itens" e os sockets que não mudam. E a MANA gasta (o evento passa a acontecer: os
// bônus temporários "após Gastar um total de N de Mana", a Fúria, as escalas) e a recarga a mais das gemas da peça. E as MALDIÇÕES: a lentidão
// e o dano a mais depois de Y% da duração, e os Feitiços e a Marca que passam quando o amaldiçoado morre.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';

const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no jogo oficial (PoE)';
const { personagemDeTeste } = await import('./apoio.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Pendencias = await import('../admin/itens-poe-pendencias.mjs');

const traduz = (texto) => T.traduzirParte(texto, (texto.match(/\{(\d+)\}/g) ?? []).map(() => 10));
function comAf(af) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 90 });
  e.equipment = { ring: { id: 1, poe: { af } } };
  Ficha.invalidar(e);
  return e;
}

test('a Velocidade de Conjuração também na de Ataque', { skip: SEM }, () => {
  const sem = Ficha.combate(comAf({ cast_speed: 30 }));
  const com = Ficha.combate(comAf({ cast_speed: 30, conj_em_ataque: 1 }));
  assert.equal(com.velocidadeDeAtaque - sem.velocidadeDeAtaque, 30);
  assert.ok(com.intervaloDoGolpeMs < sem.intervaloDoGolpeMs, 'o golpe fica mais rápido');
});

test('a magnitude dos implícitos do único ("Magnitudes dos Modificadores Implícitos são dobradas", "aumentadas em X%")', { skip: SEM }, async () => {
  const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
  // (um catálogo mínimo: a base com um implícito fixo e dois únicos nela)
  const implicito = { texto: '+10 de Vida máxima', modelo: '+{0} de Vida máxima', faixas: [[10, 10]] };
  const unico = (slug, modelo, faixas = []) => ({ slug, nome: slug, base: 'Base X', modificadores: [{ tipo: 'explicit', texto: modelo, modelo, faixas }] });
  const cat = { classes: { Amulets: { id: 'Amulets', bases: [{ id: 'Amulets/X', nome: 'Base X', implicitos: [implicito] }], unicos: [unico('Dobra', 'Magnitudes dos Modificadores Implícitos são dobradas'), unico('Mais', 'Magnitudes dos Implícitos dos Modificadores aumentadas em {0}%', [[50, 50]])] } } };
  const regras = { raridades: { unico: { fixos: true } } };
  const gerar = (u) => gerarPeca({ catalogo: cat, regras, base: 'Amulets/X', raridade: 'unico', ilvl: 80, rng: () => 0.5, unico: u });
  assert.deepEqual(gerar('Dobra').implicitos[0].valores, [20], 'dobrado');
  assert.deepEqual(gerar('Mais').implicitos[0].valores, [15], '+50%');
  assert.deepEqual(traduz('Magnitudes dos Modificadores Implícitos são dobradas').efeitos.map((x) => [x.stat, x.valor]), [['magnitude_implicitos', 100]]);
});

test('os frascos: a mana que também recupera vida, as cargas dos mortos sangrando; "se você Acertou um Inimigo Único Recentemente"', { skip: SEM }, async () => {
  const Frascos = await import('../systems/itens-poe/frascos.mjs');
  assert.equal(typeof Frascos.aoMatar, 'function');
  // A condição: acertou um Único recentemente.
  const e = comAf({ 'frasco_regen_n:todos@acertouUnicoRecente': 2, 'frasco_regen_s:todos': 1 });
  e.hunt = { clock: 10_000, poeRecente: { acertouUnico: 9_000 } };
  assert.equal(Ficha.combate(e).afPoe['frasco_regen_n:todos'], 2);
  e.hunt.poeRecente.acertouUnico = -100_000;
  Ficha.invalidar(e);
  assert.equal(Ficha.combate(e).afPoe['frasco_regen_n:todos'], undefined);
  // O acerto num Único marca o "recentemente".
  const h = { clock: 5000 };
  ModsPoe.aoAcertar(null, h, { uid: 'u', hp: 10, maxHp: 10, raridade: 'unico', estados: {} }, Ficha.combate(comAf({})), { dano: 1 });
  assert.equal(h.poeRecente?.acertouUnico, 5000);
  assert.deepEqual(traduz('A Mana não-instantânea recuperada dos Frascos também recupera Vida').efeitos.map((x) => x.stat), ['mana_frasco_tambem_vida']);
});

test('"+N de Vida se não houverem Modificadores de Vida em outros Itens Equipados" e os sockets que não mudam', { skip: SEM }, () => {
  const soma = (outras) => Afixos.somaDeItens({ equipment: { ring: { id: 1, poe: { af: { 'life@semVidaNosOutros': 50 } } }, ...outras } });
  assert.equal(soma({}).life, 50, 'sem outras peças: vale');
  assert.equal(soma({ ring2: { id: 2, poe: { af: {}, prefixos: [{ modelo: '+{0} de Vida máxima', valores: [30] }] } } }).life, undefined, 'outra peça com Vida: não');
  assert.equal(soma({ ring2: { id: 2, poe: { af: {}, prefixos: [{ modelo: '+{0} de Mana máxima', valores: [30] }] } } }).life, 50, 'outra sem Vida: vale');
  assert.deepEqual(traduz('Encaixes não podem ser modificados').efeitos.map((x) => x.stat), ['encaixes_inalteraveis']);
});

test('os custos e o crítico da repetição final: as frases viram os atributos', { skip: SEM }, () => {
  const casos = {
    'Habilidades custam escudo de energia em vez de mana ou vida': 'custo_em_es',
    'Habilidades ganham Custo Base de Vida Base igual a {0}% do Custo Base de Mana': 'custo_vida_extra_pct',
    'Habilidades ganham um Custo de Escudo de Energia Base igual a {0}% do Custo de Mana Base': 'custo_es_extra_pct',
    'Habilidades Mágicas sempre causam Golpes Críticos na Repetição final': 'critico_repeticao_final',
    'Habilidades Mágicas não podem causar Golpes Críticos exceto na Repetição final': 'sem_critico_fora_da_final',
  };
  for (const [texto, stat] of Object.entries(casos)) assert.deepEqual(traduz(texto).efeitos.map((x) => x.stat), [stat], texto);
});

test('a mana gasta: o bônus temporário depois de gastar N de mana, a Fúria e a escala pela mana gasta recentemente', { skip: SEM }, () => {
  const e = comAf({ 'ev:gastarMana:statTempPorMana:crit_chance:4:200': 30, 'ev:gastarMana:furiaPorMana:100': 5, 'spell_dmg%manaGastaRecente:50~40': 10 });
  e.hunt = { clock: 1000, pos: { x: 0, y: 0 }, monstros: [] };
  ModsPoe.definirFichaDaCacada(e.hunt, () => Ficha.combate(e));
  const gastar = (n) => ModsPoe.evento(e, e.hunt, 'gastarMana', Ficha.combate(e), { quantidade: n });
  gastar(150);
  assert.equal(e.hunt.poeTemporarios?.crit_chance, undefined, '150 de 200: ainda não');
  assert.equal(e.hunt.furia?.n, 5, 'a cada 100 de mana: 5 de Fúria');
  gastar(60);
  assert.deepEqual(e.hunt.poeTemporarios.crit_chance, { stat: 'crit_chance', valor: 30, ate: 1000 + 4000 }, '210: +30% de chance de crítico por 4 s');
  Ficha.invalidar(e);
  const base = Ficha.combate(comAf({})).afPoe.crit_chance ?? 0;
  assert.equal((Ficha.combate(e).afPoe.crit_chance ?? 0) - base, 30, 'na soma, enquanto dura');
  // A escala: 210 de mana gasta nos últimos 4 s ÷ 50 = 4 × 10% (o teto: 40%).
  e.hunt.poeManaGasta = [{ t: 900, n: 150 }, { t: 1000, n: 60 }];
  Ficha.invalidar(e);
  const sem = Ficha.combate(comAf({})).afPoe.spell_dmg ?? 0;
  assert.equal((Ficha.combate(e).afPoe.spell_dmg ?? 0) - sem, 40);
  assert.deepEqual(traduz('Projéteis Mágicos Encaixados têm +{0} segundos de Recarga').efeitos.map((x) => x.stat), ['recarga_local@magia+projetil']);
});

test('as maldições: a lentidão e o dano a mais depois de Y% da duração; os Feitiços e a Marca que passam quando o amaldiçoado morre', { skip: SEM }, async () => {
  const Reforcos = await import('../systems/skills/reforcos.mjs');
  const bicho = { maldicoes: { f: { ate: 10_000, desde: 0, dur: 10_000, lentoApos: { apos: 0.5, pct: 30 }, danoApos: { apos: 0.5, pct: 20 } } } };
  assert.equal(Reforcos.fatorDeDesaceleracao(bicho, 2000), 1, 'antes da metade: nada');
  assert.ok(Math.abs(Reforcos.fatorDeDesaceleracao(bicho, 6000) - 1 / 0.7) < 1e-9, 'depois: 30% de lentidão');
  const f = Ficha.combate(comAf({}));
  assert.equal(ModsPoe.fatorRecebidoPeloBicho({ ...bicho, estados: {} }, 'physical', f, 2000), 1);
  assert.ok(Math.abs(ModsPoe.fatorRecebidoPeloBicho({ ...bicho, estados: {} }, 'physical', f, 6000) - 1.2) < 1e-9);
  // Os Feitiços do morto passam aos de perto; a Marca, ao vivo mais perto.
  const e = comAf({ 'ev:matar:transferirMaldicoes:4': 1, 'ev:matar:transferirMarca': 1 });
  const morto = { uid: 'm', x: 5, y: 5, hp: 0, maldicoes: { fei: { ate: 9_000, dur: 6_000, desde: 1_000 }, mar: { ate: 9_000, dur: 6_000, desde: 1_000, marca: true } } };
  const perto = { uid: 'p', x: 6, y: 5, hp: 10 };
  const longe = { uid: 'l', x: 20, y: 20, hp: 10 };
  e.hunt = { clock: 2000, pos: { x: 0, y: 0 }, monstros: [morto, perto, longe] };
  ModsPoe.evento(e, e.hunt, 'matar', Ficha.combate(e), { alvo: morto });
  assert.ok(perto.maldicoes?.fei && perto.maldicoes?.mar, 'o de perto ganha o Feitiço e a Marca');
  assert.equal(longe.maldicoes?.fei, undefined, 'o longe (a mais de 2 casas) não ganha o Feitiço');
});

test('trava contra regressão: as linhas de armas, armaduras e amuletos únicos que não funcionam não voltam a subir (rodada 6)', { skip: SEM }, () => {
  const ARMAS = /One_Hand|Two_Hand|Thrusting|Sceptres|Staves|Warstaves|Claws|Daggers|Rune_Daggers|Bows|Wands/;
  const OUTRAS = /Body_Armours|Helmets|Gloves|Boots|Shields|Quivers|Amulets/;
  const d = Pendencias.pendencias();
  const ruins = d.linhas.filter((l) => l.origem === 'unico' && l.classes.some((c) => ARMAS.test(c) || OUTRAS.test(c)) && ['pendente', 'inexiste'].includes(l.estado));
  assert.ok(ruins.length <= 653, `${ruins.length} linhas sem funcionar (eram 681 antes da rodada 6)`);
});
