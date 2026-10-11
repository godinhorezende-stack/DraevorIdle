// Os MODIFICADORES DOS ÚNICOS — rodada 5: armas, armaduras e amuletos (dono, 11/10: "quero tentar resolver todos os modificadores únicos,
// das armas, armaduras e amuletos"). As auras com VALOR nos inimigos próximos (a lentidão, as resistências, a de Raio igual à sua), o buff a
// cada N segundos, a FÚRIA (o máximo pela metade, a perda por segundo, a chance de ir ao máximo), "Conta como ter o máximo de Cargas de
// Poder", os CLAMORES (a recarga fixa, os usos a mais) e a Técnica Resoluta inteira (sem crítico). E a sorte de três jogadas, as escalas do
// ALVO (o efeito do Resfriamento/da Eletrização nele), os Anéis Mágicos, as garras no desarmado, o dano por segundo em você, os Resfriados que
// sofrem mais, o Definhamento, os Amaldiçoados sem afecção elemental em você, o morto Eletrizado e as condições novas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';

const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no jogo oficial (PoE)';
const { personagemDeTeste } = await import('./apoio.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Resistencia = await import('../systems/hunt/resistencia.mjs');
const Pendencias = await import('../admin/itens-poe-pendencias.mjs');

const traduz = (texto) => T.traduzirParte(texto, (texto.match(/\{(\d+)\}/g) ?? []).map(() => 10));
function comAf(af) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 90 });
  e.equipment = { ring: { id: 1, poe: { af } } };
  Ficha.invalidar(e);
  return e;
}

test('as auras com valor nos inimigos próximos: a lentidão de X%, as resistências e a de Raio igual à sua', { skip: SEM }, () => {
  const e = comAf({ aura_proximos_lento: 25, 'aura_proximos_res:todas': -10, 'aura_proximos_res_igual:energy': 1, energy_res: 40 });
  const perto = { uid: 1, x: 1, y: 0, hp: 10, maxHp: 10, resist: { fire: 30, energy: 70 } };
  const longe = { uid: 2, x: 9, y: 9, hp: 10, maxHp: 10, resist: { fire: 30 } };
  e.hunt = { clock: 1000, pos: { x: 0, y: 0 }, monstros: [perto, longe] };
  const f = Ficha.combate(e);
  ModsPoe.aurasProximas(e, e.hunt, f, 1000);
  assert.equal(perto.estados.lento.pct, 25);
  assert.equal(longe.estados?.lento, undefined, 'longe, nada');
  const h = { clock: 1500 };
  assert.equal(Resistencia.resistenciaDe(h, perto, 'fire'), Resistencia.resistenciaDe(h, { ...perto, estados: {} }, 'fire') - 10, '-10% de todas');
  assert.equal(Resistencia.resistenciaDe(h, perto, 'energy'), (f.protection.energy ?? 0) - 10, 'a de Raio: a sua (e o -10% de todas)');
  assert.equal(Resistencia.resistenciaDe({ clock: 3000 }, perto, 'fire'), 30, 'a aura passou: a dele de volta');
});

test('o buff a cada N segundos ("Sobrecarga Elemental por 8 s a cada 16 s") e a Técnica Resoluta sem Sobrecarga', { skip: SEM }, () => {
  const e = comAf({ 'buff_periodico:sobrecargaElemental:16': 8 });
  e.hunt = { clock: 1000, pos: { x: 0, y: 0 }, monstros: [] };
  const f = Ficha.combate(e);
  ModsPoe.aurasProximas(e, e.hunt, f, 1000);
  assert.equal(e.hunt.poeBuffs?.sobrecargaElemental, 9000);
  ModsPoe.aurasProximas(e, e.hunt, f, 5000);
  assert.equal(e.hunt.poeBuffs.sobrecargaElemental, 9000, 'antes dos 16 s, não renova');
  ModsPoe.aurasProximas(e, e.hunt, f, 17000);
  assert.equal(e.hunt.poeBuffs.sobrecargaElemental, 25000);
  // A Técnica Resoluta: os acertos não erram e nunca são críticos.
  const rt = comAf({ 'sempre:tecnicaResoluta@semBuff:sobrecargaElemental': 1, crit_chance: 50 });
  rt.hunt = { clock: 1000 };
  const fr = Ficha.combate(rt);
  assert.equal(fr.afPoe.nunca_erra, 1);
  assert.equal(fr.afPoe.nunca_critico, 1);
  rt.hunt.poeBuffs = { sobrecargaElemental: 99_999 };
  Ficha.invalidar(rt);
  assert.equal(Ficha.combate(rt).afPoe.nunca_erra, undefined, 'com a Sobrecarga, sem a Técnica');
});

test('a Fúria: o máximo pela metade, a perda por segundo e a chance de ir ao máximo; "Conta como no máximo de Cargas de Poder"', { skip: SEM }, () => {
  assert.equal(ModsPoe.maximoDeFuria({}), 30);
  assert.equal(ModsPoe.maximoDeFuria({ furia_max_metade: 1 }), 15);
  assert.equal(ModsPoe.maximoDeFuria({ furia_max: 10, furia_max_metade: 1 }), 20);
  const e = comAf({ furia_max_metade: 1, furia_perde_por_s: 2 });
  e.hunt = { clock: 1000 };
  ModsPoe.definirFichaDaCacada(e.hunt, () => Ficha.combate(e));
  ModsPoe.ganharFuria(e.hunt, 40, 1000);
  assert.equal(e.hunt.furia.n, 15, 'até a metade');
  ModsPoe.tiqueDaFuria(e.hunt, 1000);
  ModsPoe.tiqueDaFuria(e.hunt, 2000);
  assert.equal(e.hunt.furia.n, 13, '-2 em 1 s (ainda dentro da espera da perda inerente)');
  // "Conta como ter o número máximo de cargas de poder": a condição "no máximo de Cargas de Poder" vale sem as cargas.
  const c = comAf({ conta_max_poder: 1, 'dmg_inc@cargasMax:poder': 10 });
  c.hunt = { clock: 1000 };
  const base = Ficha.combate(comAf({})).afPoe.dmg_inc ?? 0;
  assert.equal((Ficha.combate(c).afPoe.dmg_inc ?? 0) - base, 10);
  assert.deepEqual(traduz('{0}% de chance de que se você fosse ganhar Fúria ao Acertar, você ganha até o seu máximo de fúria ao invés').efeitos.map((x) => x.stat), ['furia_max_ao_acertar_chance']);
});

test('os clamores: a recarga fixa ("A Recarga de Habilidades Clamor é de 4 segundos") e os usos a mais da peça', { skip: SEM }, async () => {
  const Acoes = await import('../systems/acoes.mjs');
  const { ACTION_CATALOG } = await import('../systems/dados.mjs');
  const clamor = ACTION_CATALOG.spells.find((x) => x.poeGema?.arquetipo === 'clamor');
  if (!clamor) return;
  const e = comAf({ recarga_clamor_fixa: 4 });
  const t = Acoes.temposDaGemaPoe(e, clamor, { nivel: 1 }, Ficha.combate(e), { doJogador: false });
  assert.equal(t.recarga, Math.round(4000 / Math.max(0.1, 1 + (Ficha.combate(e).recuperacaoDeRecarga ?? 0) / 100)));
  const u = Acoes.temposDaGemaPoe(e, clamor, { nivel: 1, usosExtra: 1 }, Ficha.combate(e), { doJogador: false });
  const sem = Acoes.temposDaGemaPoe(e, clamor, { nivel: 1 }, Ficha.combate(e), { doJogador: false });
  assert.equal(u.cargas, Math.max(1, sem.cargas ?? 1) + 1);
  assert.deepEqual(traduz('Habilidades de Clamor Encaixadas têm +{0} Usos de Recarga').efeitos.map((x) => x.stat), ['usos_local@clamor']);
});

test('a sorte de três jogadas e as escalas do alvo (o efeito do Resfriamento e da Eletrização nele)', { skip: SEM }, () => {
  const seq = (...v) => { let i = 0; return () => v[i++]; };
  assert.equal(ModsPoe.sorteado(0.5, 1, 0, seq(0.9, 0.9, 0.1)), false, 'duas jogadas: não');
  assert.equal(ModsPoe.sorteado(0.5, 1, 0, seq(0.9, 0.9, 0.1), true), true, 'três: a terceira salva');
  assert.equal(ModsPoe.sorteado(0.5, 0, 1, seq(0.1, 0.1, 0.9), true), false, 'azarado de três: a terceira estraga');
  const f = Ficha.combate(comAf({ 'ice_as_extra_fire%resfriamentoNoAlvo:10': 5 }));
  const alvo = { estados: { lento: { ate: 9999, pct: 30 } } };
  const golpe = ModsPoe.fichaDoGolpe(f, ['magia'], { alvo, estado: { hunt: { clock: 1000 } } });
  assert.equal(ModsPoe.valor(golpe, 'ice_as_extra_fire'), 15, 'o golpe nesse alvo');
  assert.equal(ModsPoe.valor(ModsPoe.fichaDoGolpe(f, ['magia'], { alvo: {}, estado: { hunt: { clock: 1000 } } }), 'ice_as_extra_fire'), 0, 'sem Resfriamento, nada');
  const partes = ModsPoe.transformarPartes(golpe, { ice: [100, 100] });
  assert.deepEqual(partes.fire, [15, 15], '30% de Resfriamento ÷ 10 × 5% = 15% do Gelo como Fogo');
});

test('os Anéis Mágicos, as garras no desarmado, o dano por segundo em você e as condições novas', { skip: SEM }, () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 90 });
  e.equipment = { ring: { id: 1, poe: { raridade: 'magico', af: {} } }, ring2: { id: 2, poe: { raridade: 'raro', af: { 'imune_maldicao@anelMagicoDireito': 1, 'crit_dmg_taken_red@anelMagicoEsquerdo': 100 } } } };
  Ficha.invalidar(e);
  const f = Ficha.combate(e);
  assert.equal(f.afPoe.imune_maldicao, undefined, 'o direito não é mágico');
  assert.equal(f.afPoe.crit_dmg_taken_red, 100, 'o esquerdo é');
  const d = comAf({ garra_desarmado: 1, 'atk_speed@comGarra': 10 });
  const base = Ficha.combate(comAf({})).afPoe.atk_speed ?? 0;
  assert.equal((Ficha.combate(d).afPoe.atk_speed ?? 0) - base, 10, 'desarmado: conta como Garra');
  // O dano de Gelo por segundo por Carga de Frenesi enquanto se move: 10 × 2 cargas, pela resistência a Gelo, em 1 s.
  const g = comAf({ 'degen_proprio_ice%carga:frenesi@movendo': 10 });
  g.hunt = { clock: 1000, cargasPoe: { frenesi: { n: 2, ate: 99_999 } }, poeRecente: { moveu: 900 } };
  const fg = Ficha.combate(g);
  g.hp = 1000;
  assert.ok(Math.abs((fg.afPoe.degen_proprio_ice ?? 0) - 20) < 1e-9, `${fg.afPoe.degen_proprio_ice}`);
  // As condições: a Vida e a Mana perto; drenando Escudo / Mana.
  const v = comAf({ 'imune_incendio@vidaManaPerto:100000': 1 });
  assert.equal(Ficha.combate(v).afPoe.imune_incendio, 1);
  const r = comAf({ 'imune_eletrizacao@drenandoEs': 1 });
  r.hunt = { clock: 1000, roubos: [{ recurso: 'es', restante: 10, porSegundo: 1 }] };
  assert.equal(Ficha.combate(r).afPoe.imune_eletrizacao, 1);
});

test('os Resfriados sofrem mais, o Definhamento no dano elemental, os Amaldiçoados sem afecção elemental e o morto Eletrizado', { skip: SEM }, () => {
  const f = Ficha.combate(comAf({ resfriados_sofrem_mais: 1, dano_elemental_por_definhamento: 5 }));
  const alvo = { estados: { lento: { ate: 9999, pct: 20 }, definhado: { ate: 9999, n: 4 } } };
  assert.ok(Math.abs(ModsPoe.fatorRecebidoPeloBicho(alvo, 'physical', f, 1000) - 1.2) < 1e-9, 'Resfriado de 20%: +20%');
  assert.ok(Math.abs(ModsPoe.fatorRecebidoPeloBicho(alvo, 'fire', f, 1000) - 1.2 * 1.2) < 1e-9, '+ 4 Definhamentos × 5% no Fogo');
  // O monstro amaldiçoado por você não põe afecção elemental em você.
  const e = comAf({ amaldicoados_sem_afeccao_elemental: 1 });
  const bicho = { uid: 'b', maldicoes: { x: { ate: 99_999 } } };
  e.hunt = { clock: 1000, monstros: [bicho] };
  ModsPoe.definirFichaDaCacada(e.hunt, () => Ficha.combate(e));
  assert.equal(ModsPoe.dotNoJogador(e.hunt, { tipo: 'queimadura', total: 10, origem: { uid: 'b' } }, 1000, () => 0.99), null);
  assert.ok(ModsPoe.dotNoJogador(e.hunt, { tipo: 'sangramento', total: 10, origem: { uid: 'b' } }, 1000, () => 0.99), 'o Sangramento não é elemental');
  assert.deepEqual(traduz('Inimigos mortos por você são Eletrizados').efeitos.map((x) => x.stat), ['mortos_eletrizados']);
});

test('trava contra regressão: as linhas de armas, armaduras e amuletos únicos que não funcionam não voltam a subir (rodada 5)', { skip: SEM }, () => {
  const ARMAS = /One_Hand|Two_Hand|Thrusting|Sceptres|Staves|Warstaves|Claws|Daggers|Rune_Daggers|Bows|Wands/;
  const OUTRAS = /Body_Armours|Helmets|Gloves|Boots|Shields|Quivers|Amulets/;
  const d = Pendencias.pendencias();
  const ruins = d.linhas.filter((l) => l.origem === 'unico' && l.classes.some((c) => ARMAS.test(c) || OUTRAS.test(c)) && ['pendente', 'inexiste'].includes(l.estado));
  assert.ok(ruins.length <= 681, `${ruins.length} linhas sem funcionar (eram 719 antes da rodada 5)`);
});
