// Os MODIFICADORES DOS ÚNICOS — rodada 3: armas, armaduras e amuletos (dono, 11/10: "quero tentar resolver todos os modificadores únicos,
// das armas, armaduras e amuletos"). As mecânicas que entraram: as KEYSTONES que os únicos concedem (os atributos da árvore, e o "Você tem
// X se…" condicional), o buff "sempre" com condição (antes ficava ativo sem somar nada), o TETO "até N%" das escalas, o CRÍTICO (o dano dos
// golpes críticos e não críticos, o teto da chance, o multiplicador fixo, o Golpe de Misericórdia no crítico), o BLOQUEIO no máximo e o
// mágico dobrado, as CARGAS (o máximo fixo, Frenesi = Poder), os itens CORROMPIDOS e o alvo MARCADO. E os LACAIOS: a conversão do dano
// (geral, por Encaixe da própria peça, o Avatar do Fogo de um tipo), as chances no acerto, a vida ao bloquear e ao matar, a explosão, a
// duração renovada, o dreno para o dono, o dano somado dos Golens, o crítico por carga, a restrição de tipo e o "aumentado" dos lacaios em você.
// E a RESISTÊNCIA: a dos monstros pelas regras dos únicos (a mais baixa, invertida, sem penetração), as escalas pela resistência EXCEDENTE, o
// dreno no crítico, a vida perdida por inimigo acertado e as magias desabilitadas. E as AFECÇÕES em você (ao ser acertado, a chance a mais, a
// imunidade depois), as ARMADILHAS e as MINAS (o evento da armadilha ativada passa a acontecer; ao lançar; a mina detonada). E os GATILHOS
// das peças ("Ativa uma Magia Encaixada quando você Atacar com esta Arma": as gemas encaixadas na própria peça, com a recarga do mod).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';

const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no jogo oficial (PoE)';
const { personagemDeTeste } = await import('./apoio.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const CargasPoe = await import('../systems/itens-poe/cargas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Atributos = await import('../systems/personagem/atributos.mjs');
const Formulas = await import('../systems/combate/formulas.mjs');
const Pendencias = await import('../admin/itens-poe-pendencias.mjs');
const Lacaios = await import('../systems/itens-poe/lacaios-poe.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Resistencia = await import('../systems/hunt/resistencia.mjs');
const MonstrosDoJogo = await import('../systems/hunt/monstros.mjs');
const Controle = await import('../systems/combate/controle.mjs');

const COM_EFEITO = ['equivalente', 'aproximado', 'novo'];
const traduz = (texto) => T.traduzirParte(texto, (texto.match(/\{(\d+)\}/g) ?? []).map(() => 10));
/** Um personagem só com uma peça do PoE no anel que soma `af` (`extra`: mais campos da peça, como `corrompido`). */
function comAf(af, extra = {}) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 90 });
  e.equipment = { ring: { id: 1, poe: { af, ...extra } } };
  Ficha.invalidar(e);
  return e;
}
const afPoe = (e) => { Ficha.invalidar(e); return Ficha.combate(e).afPoe; };

test('as keystones que os únicos concedem: os mesmos atributos da keystone da árvore; "Você tem X se…" vira o buff com a condição', { skip: SEM }, () => {
  const casos = {
    'Empunhadura de Ferro': ['forca_em_projeteis'],
    'Juventude Eterna': ['regen_vida_menos', 'roubo_teto_vida_menos', 'recarga_es_na_vida'],
    'Você tem Agonia Perfeita se causou um Golpe Crítico recentemente': ['sempre:agoniaPerfeita@criticoRecente'],
    'Você tem Pacto Vaal se você causou um Golpe Crítico Recentemente': ['sempre:pactoVaal@criticoRecente'],
    'Você tem Juramento do Zelote caso não tenha sido acertado recentemente': ['sempre:juramentoDoZelote@naoAcertadoRecente'],
  };
  for (const [texto, stats] of Object.entries(casos)) {
    const r = traduz(texto);
    assert.ok(COM_EFEITO.includes(r.estado), `${texto}: ${r.estado}`);
    assert.deepEqual(r.efeitos.map((e) => e.stat), stats, texto);
  }
  // A Agonia Perfeita do único: vale com o crítico recente, e soma o que a keystone soma.
  const e = comAf({ 'sempre:agoniaPerfeita@criticoRecente': 1 });
  e.hunt = { clock: 10_000, poeRecente: { critico: 9_000 } };
  const com = afPoe(e);
  assert.equal(com.agonia_perfeita, 1);
  assert.equal(com.critico_sem_dano_extra, 1);
  e.hunt.poeRecente.critico = -100_000;
  assert.equal(afPoe(e).agonia_perfeita, undefined, 'sem crítico recente, nada');
});

test('o buff "sempre" com CONDIÇÃO soma o que o buff dá (antes: ficava ativo sem somar nada) — "Agressividade enquanto não em Mana Baixa"', { skip: SEM }, () => {
  const sem = afPoe(comAf({}));
  const cheia = afPoe(comAf({ 'sempre:agressividade@naoManaBaixa': 1 }));
  assert.equal((cheia.atk_speed ?? 0) - (sem.atk_speed ?? 0), 20, 'a Agressividade: +20% de velocidade de ataque');
  const baixa = comAf({ 'sempre:agressividade@naoManaBaixa': 1 });
  baixa.mana = 1;
  assert.equal((afPoe(baixa).atk_speed ?? 0) - (sem.atk_speed ?? 0), 0, 'em Mana Baixa, nada');
  // e o "Efeito do Elusivo aumentado por Carga de Poder" (efeito do buff escalado — também só existe depois das condições)
  assert.deepEqual(traduz('Efeito de Elusivo em você aumentado em {0}% por Carga de Poder').efeitos.map((x) => x.stat), ['efeito_buff:elusivo%carga:poder']);
  const elusivo = comAf({ 'sempre:elusivo': 1, 'efeito_buff:elusivo%carga:poder': 50 });
  elusivo.hunt = { clock: 1000, cargasPoe: { poder: { n: 2, ate: 99_999 } } };
  const base = afPoe(comAf({ 'sempre:elusivo': 1 }));
  assert.equal(afPoe(elusivo).move_speed - base.move_speed, 30, 'o Elusivo (+30% de movimento) × (1 + 2 × 50%) = +60%: 30 a mais');
});

test('o TETO "até N%" das escalas: o total escalado não passa dele (para o lado do sinal)', { skip: SEM }, () => {
  assert.deepEqual(ModsPoe.partir('move_speed%evasao:500~20@movendo'), { stat: 'move_speed', escala: 'evasao:500', conds: ['movendo'], teto: 20 });
  assert.equal(ModsPoe.partir('dmg_inc%furia').teto, null);
  assert.equal(ModsPoe.comTeto(5, 10, 20), 20);
  assert.equal(ModsPoe.comTeto(5, 3, 20), 15);
  assert.equal(ModsPoe.comTeto(-5, 10, 20), -20);
  assert.deepEqual(traduz('Velocidade de Movimento aumentada em {0}% a cada {1} de Evasão, até {2}%').efeitos.map((x) => x.stat), ['move_speed%evasao:10~10']);
  assert.deepEqual(traduz('Dano aumentado em {0}% por cada Envenenamento em você, até um máximo de {1}%').efeitos.map((x) => x.stat), ['dmg_inc%venenoEmVoce~10']);
  // Na soma: +1% de Vida por nível, até 7% — no nível 90, 7.
  const sem = afPoe(comAf({}));
  const com = afPoe(comAf({ 'life_inc%nivel~7': 1 }));
  assert.equal((com.life_inc ?? 0) - (sem.life_inc ?? 0), 7);
});

test('o crítico: o dano dos golpes críticos e não críticos, o teto da chance, o multiplicador fixo e o Golpe de Misericórdia no crítico', { skip: SEM }, () => {
  const casos = {
    'Golpes Críticos não causam Dano': ['mais_dano_critico', -100],
    'Golpes Não Críticos não causam Dano': ['mais_dano_nao_critico', -100],
    'Golpes não-críticos causam {0}% menos Dano': ['mais_dano_nao_critico', -10],
    'Chance de Golpe Crítico Mácima é {0}%': ['crit_chance_teto', 10],
    'Seu Multiplicador de Acerto Crítico é {0}%': ['crit_multi_fixo', 10],
    'Acertos Críticos possuem Golpe de Misericórdia': ['culling@critico', 1],
  };
  for (const [texto, [stat, valor]] of Object.entries(casos)) {
    const r = traduz(texto);
    assert.ok(COM_EFEITO.includes(r.estado), `${texto}: ${r.estado}`);
    assert.deepEqual(r.efeitos.map((x) => [x.stat, x.valor]), [[stat, valor]], texto);
  }
  // A tag `critico` só vale para o que o acerto lê assim (o Golpe de Misericórdia); para o resto, o balão não diz que funciona.
  assert.equal(T.atributoTemEfeito('culling@critico'), true);
  assert.equal(T.atributoTemEfeito('dmg_inc@critico'), false);
  // O dano do golpe: a mesma rolagem, com e sem o mod.
  const e = comAf({});
  const ficha = Ficha.combate(e);
  const alvo = { uid: 1, x: 0, y: 0, hp: 100, maxHp: 100, key: null };
  const dano = (af, crit) => Ficha.rolarCritico(e, 1000, alvo, [], { ...ficha, afPoe: { ...ficha.afPoe, ...af } }, { crit, onslaught: false }).dano;
  assert.equal(dano({ mais_dano_nao_critico: -100 }, false), 0);
  assert.equal(dano({ mais_dano_nao_critico: -40 }, false), Math.round(dano({}, false) * 0.6));
  assert.equal(dano({ mais_dano_nao_critico: -100 }, true), dano({}, true), 'o crítico não muda');
  assert.equal(dano({ mais_dano_critico: -100 }, true), 0);
  // O teto da chance (Os Ventos do Destino: 50%) e o multiplicador fixo (Virtuosidade de Maligaro: 300%).
  const teto = Ficha.combate(comAf({ crit_chance: 90, crit_chance_teto: 50 }));
  assert.equal(teto.critTeto, 0.5);
  assert.ok(teto.critChance <= 0.5 && teto.critChance > 0.4, `${teto.critChance}`);
  assert.equal(Ficha.rolarCritico(e, 100, alvo, [], teto).chance, 0.5);
  assert.equal(Ficha.combate(comAf({ crit_multi_fixo: 300, crit_dmg: 100 })).critMultiplier, 3);
  const golpe = ModsPoe.fichaDoGolpe(Ficha.combate(comAf({ crit_multi_fixo: 300, 'crit_dmg@ataque': 50 })), ['ataque']);
  assert.equal(golpe.critMultiplier, 3, 'o multiplicador do golpe não soma no fixo');
});

test('o bloqueio: no máximo "caso não tenha Bloqueado Recentemente", e o mágico dobrado', { skip: SEM }, () => {
  const e = comAf({ 'bloqueio_no_maximo@naoBloqueouRecente': 1, 'bloqueio_magia_no_maximo@naoBloqueouRecente': 1 });
  e.hunt = { clock: 100_000, poeRecente: {} };
  let f = Ficha.combate(e);
  assert.equal(f.blockChance, Atributos.CONFIG.bloqueio.MAX);
  assert.equal(f.bloqueioDeMagia, Formulas.PARAMETROS.bloqueio.limiteDaMagia);
  e.hunt.poeRecente.bloqueou = 99_000;
  Ficha.invalidar(e);
  f = Ficha.combate(e);
  assert.ok(f.blockChance < Atributos.CONFIG.bloqueio.MAX, 'bloqueou recentemente: o normal');
  assert.equal(f.bloqueioDeMagia, 0);
  assert.ok(Math.abs(Ficha.combate(comAf({ spell_block: 20, spell_block_dobrado: 1 })).bloqueioDeMagia - 0.4) < 1e-9, '20% dobrado');
});

test('as cargas: "Máximo de Cargas de Tolerância, Frenesi e Poder é 0" e "Máximo de Frenesi igual ao de Poder"', { skip: SEM }, () => {
  assert.deepEqual(traduz('Máximo de Cargas de Tolerância, Frenesi e Poder é {0}').efeitos.map((x) => x.stat), ['cargas_max_fixo', 'cargas_max_fixo_tem']);
  const zero = { cargas_max_fixo: 0, cargas_max_fixo_tem: 1, max_poder: 2 };
  for (const t of CargasPoe.TIPOS) assert.equal(CargasPoe.maximo(zero, t), 0, t);
  assert.equal(CargasPoe.maximo({ max_poder: 2, max_frenesi_igual_poder: 1, max_frenesi: 1 }, 'frenesi'), 5);
  assert.deepEqual(CargasPoe.regrasDaSoma({ max_frenesi_igual_poder: 1, cargas_max_fixo_tem: 1 }), { max_frenesi_igual_poder: 1, cargas_max_fixo_tem: 1 });
  // a condição "no máximo de cargas" usa o mesmo máximo
  const e = comAf({ max_frenesi_igual_poder: 1, max_poder: 1, 'dmg_inc@cargasMax:frenesi': 10 });
  e.hunt = { clock: 1000, cargasPoe: { frenesi: { n: 4, ate: 99_999 } } };
  const sem = comAf({ max_frenesi_igual_poder: 1, max_poder: 1 });
  sem.hunt = { clock: 1000, cargasPoe: { frenesi: { n: 4, ate: 99_999 } } };
  assert.equal((afPoe(e).dmg_inc ?? 0) - (afPoe(sem).dmg_inc ?? 0), 10, '4 de Frenesi = o máximo (o de Poder: 4)');
});

test('os itens corrompidos: "se nenhum Item Equipado for Corrompido" / "se todos os Itens Equipados forem Corrompidos"; o alvo Marcado', { skip: SEM }, () => {
  const limpo = afPoe(comAf({ 'life_regen@semItemCorrompido': 10, 'mana_regen@todosCorrompidos': 7 }));
  const base = afPoe(comAf({}));
  assert.equal((limpo.life_regen ?? 0) - (base.life_regen ?? 0), 10);
  assert.equal((limpo.mana_regen ?? 0) - (base.mana_regen ?? 0), 0);
  const corrompido = afPoe(comAf({ 'life_regen@semItemCorrompido': 10, 'mana_regen@todosCorrompidos': 7 }, { corrompido: true }));
  assert.equal((corrompido.life_regen ?? 0) - (base.life_regen ?? 0), 0);
  assert.equal((corrompido.mana_regen ?? 0) - (base.mana_regen ?? 0), 7);
  // a Marca posta por você
  assert.ok(ModsPoe.tagsDoAlvo({ maldicoes: { x: { marca: true, ate: 100 } } }, 50).includes('alvoMarcado'));
  assert.ok(!ModsPoe.tagsDoAlvo({ maldicoes: { x: { ate: 100 } } }, 50).includes('alvoMarcado'), 'a maldição comum não é marca');
  assert.deepEqual(traduz('Dano com Acertos e Afecções contra Inimigos Marcados aumentado em {0}%').efeitos.map((x) => x.stat), ['dmg_inc@alvoMarcado', 'ailment_dmg_inc@alvoMarcado']);
});

test('lacaios: a conversão do dano Físico (acima de 100% cai na proporção), o "só causa dano de X" e o Avatar do Fogo de um tipo', { skip: SEM }, () => {
  const partes = (l, tipo = 'physical') => Cacadas.partesDoGolpeDoLacaio(l, tipo).map((x) => [x.tipo, Math.round(x.f * 100)]);
  assert.deepEqual(partes({}), [['physical', 100]]);
  assert.deepEqual(partes({ conversao: { ice: 40 } }), [['ice', 40], ['physical', 60]]);
  assert.deepEqual(partes({ conversao: { fire: 100, ice: 100 } }), [['fire', 50], ['ice', 50]], 'acima de 100%: na proporção');
  assert.deepEqual(partes({ conversao: { ice: 40 }, soDano: 'ice' }), [['ice', 40]], 'só Gelo: o resto some');
  assert.deepEqual(partes({ conversao: { ice: 40 } }, 'fire'), [['fire', 100]], 'só converte o Físico');
  // Na gema: o Sopro dos Sidhe (converte para Gelo, só Gelo) e o Avatar do Fogo dos Zumbis (50% vira Fogo, o resto não causa dano).
  const sidhe = Lacaios.oQueInvoca('Raise_Zombie', 10, null, { minion_conv_ice: 100, minion_so_gelo: 1 });
  assert.deepEqual([sidhe.conversao.ice, sidhe.soDano], [100, 'ice']);
  const avatar = { 'lacaio_so_fogo:zumbi': 1 };
  const zumbi = Lacaios.oQueInvoca('Raise_Zombie', 10, null, avatar);
  assert.deepEqual([zumbi.conversao.fire, zumbi.soDano], [50, 'fire']);
  assert.deepEqual(partes(zumbi), [['fire', 50]], 'metade do golpe, de Fogo');
  assert.equal(Lacaios.oQueInvoca('Summon_Skeletons', 10, null, avatar).conversao, undefined, 'o Avatar dos Zumbis não vale no Esqueleto');
  // "por Encaixe Vermelho" da PRÓPRIA peça (o Punho da Tríade): 2 vermelhos × 25%.
  const luva = { id: 1, soquetes: { abertos: 4, cores: ['R', 'R', 'G', 'B'] }, poe: { af: { 'minion_conv_fire%encaixeLocal:R': 25, 'minion_conv_ice%encaixeLocal:G': 25 } } };
  assert.deepEqual(ModsPoe.daPeca('minion_conv_fire%encaixeLocal:R', 25, luva), ['minion_conv_fire', 50]);
  const soma = Afixos.somaDeItens({ equipment: { gloves: luva, ring: { id: 2, soquetes: { abertos: 3, cores: ['R', 'R', 'R'] }, poe: { af: {} } } } });
  assert.equal(soma.minion_conv_fire, 50, 'os encaixes de outra peça não contam');
  assert.equal(soma.minion_conv_ice, 25);
});

test('lacaios: dano somado dos Golens, crítico por carga, chances por tipo e a restrição ("Você não pode ter Lacaios não-Golens")', { skip: SEM }, () => {
  const golem = Lacaios.oQueInvoca('Summon_Stone_Golem', 10, null, { 'lacaio_somado_min:golem': 5, 'lacaio_somado_max:golem': 9 });
  const semNada = Lacaios.oQueInvoca('Summon_Stone_Golem', 10, null, {});
  assert.deepEqual([golem.somado[0] - semNada.somado[0], golem.somado[1] - semNada.somado[1]], [5, 9]);
  assert.equal(Lacaios.oQueInvoca('Raise_Zombie', 10, null, { 'lacaio_somado_min:golem': 5 }).somado[0], Lacaios.oQueInvoca('Raise_Zombie', 10, null, {}).somado[0], 'só no Golem');
  assert.equal(Lacaios.oQueInvoca('Raise_Zombie', 10, null, { minion_crit_inc: 100 }).critChance, 10);
  const espirito = Lacaios.oQueInvoca('Summon_Raging_Spirit', 10, null, { 'lacaio_incendiar:espirito': 100, minion_chance_definhar: 30, 'lacaio_cinzas:zumbi': 100 });
  assert.deepEqual([espirito.poe.chances.incendiar, espirito.poe.chances.definhar, espirito.poe.chances.cinzas], [100, 30, 0]);
  const restrito = { 'so_lacaio:golem': 1 };
  assert.ok(Lacaios.oQueInvoca('Raise_Zombie', 10, null, restrito).proibido, 'o Zumbi não vem');
  assert.equal(Lacaios.oQueInvoca('Summon_Stone_Golem', 10, null, restrito).proibido, undefined, 'o Golem vem');
  assert.deepEqual(traduz('Você não pode ter Lacaios Não-Espectrais').efeitos.map((x) => x.stat), ['so_lacaio:espectro']);
});

test('lacaios no acerto: a vida ao bloquear e ao matar um envenenado, a explosão dos mortos pelos Zumbis, a duração renovada e o dreno para o dono', { skip: SEM }, () => {
  const l = { uid: 'l1', x: 0, y: 0, hp: 50, maxHp: 100, ate: 5000, duracaoMs: 8000, poe: { bloqueio: 100, vidaAoBloquear: 20, vidaAoMatarEnvenenado: 30, explodir: 10, renova: 100, drenoDono: 0, roubo: 0, chances: {} } };
  const eventos = [];
  assert.equal(Cacadas.lacaioBloqueia(l, null, eventos, () => 0.5), true);
  assert.equal(l.hp, 70, '+20% da vida ao bloquear');
  assert.equal(Cacadas.lacaioBloqueia({ ...l, poe: { ...l.poe, bloqueio: 0 } }, null, [], () => 0), false, 'sem chance, não bloqueia');
  // O acerto que mata um envenenado de 1000 de vida: o lacaio recupera 30%, o morto explode (10% = 100) no vizinho; o acerto num Raro
  // renova a duração.
  const morto = { uid: 'm1', x: 5, y: 5, hp: 0, maxHp: 1000 };
  const vizinho = { uid: 'm2', x: 6, y: 5, hp: 500, maxHp: 500 };
  const longe = { uid: 'm3', x: 9, y: 9, hp: 500, maxHp: 500 };
  const hunt = { clock: 1000, pos: { x: 0, y: 0 }, monstros: [morto, vizinho, longe] };
  Cacadas.efeitosDoLacaioNoAcerto(hunt, l, morto, 10, 'physical', { envenenado: true, raroOuUnico: true });
  assert.equal(l.hp, 100);
  assert.equal(vizinho.hp, 400);
  assert.equal(longe.hp, 500);
  assert.equal(l.ate, 9000, 'a duração renovada: agora + 8 s');
  // O dreno para o dono ("X% do Dano causado pelos seus Zumbis é Drenado para você como Vida").
  const dono = comAf({});
  dono.hp = 1;
  dono.hunt = { clock: 1000, pos: { x: 0, y: 0 }, monstros: [] };
  const ficha = Ficha.combate(dono);
  const vivo = { uid: 'm4', x: 1, y: 0, hp: 100, maxHp: 100 };
  Cacadas.efeitosDoLacaioNoAcerto(dono.hunt, { ...l, poe: { ...l.poe, drenoDono: 50, renova: 0 } }, vivo, 40, 'physical', { estado: dono, ficha });
  const drenado = (dono.hunt.roubos ?? []).reduce((n, r) => n + (r.restante ?? 0), 0) + (dono.hp - 1);
  assert.ok(drenado > 0, `o dono recebeu o dreno (${drenado})`);
});

test('o "aumentado" dos lacaios também em você ("Aumentos e reduções à vida máxima de lacaio também se aplicam a você em N%")', { skip: SEM }, () => {
  const base = afPoe(comAf({ minion_life: 40, minion_dmg: 30 }));
  const com = afPoe(comAf({ minion_life: 40, minion_dmg: 30, lacaio_vida_em_voce: 50, lacaio_dano_em_voce: 10 }));
  assert.equal((com.life_inc ?? 0) - (base.life_inc ?? 0), 20);
  assert.equal((com.dmg_inc ?? 0) - (base.dmg_inc ?? 0), 3);
});

test('a resistência dos monstros pelas regras dos únicos: a mais baixa, invertida e sem penetração', { skip: SEM }, () => {
  const key = Object.keys(MonstrosDoJogo.BESTIARY).find((k) => MonstrosDoJogo.BESTIARY[k]?.elements);
  const alvo = { key, resist: { fire: 40, ice: 10, energy: -20, chaos: 30 } };
  const base = (t) => Resistencia.resistenciaDe({ clock: 0 }, alvo, t);
  const ef = (t, afPoe = {}, penetracao = null) => Resistencia.resistenciaEfetivaDe({ clock: 0 }, alvo, t, { afPoe, penetracao });
  assert.ok(base('energy') < base('fire') && base('energy') < base('ice'), 'a de Raio é a menor');
  assert.equal(ef('fire', { resistido_pela_menor: 1 }), ef('energy'), 'o Fogo resistido pela menor (a de Raio)');
  assert.equal(ef('physical', { resistido_pela_menor: 1 }), ef('physical'), 'o Físico não muda');
  assert.equal(ef('fire', { res_elemental_invertida: 1 }), -ef('fire'), 'invertida');
  assert.equal(ef('chaos', { res_caos_invertida: 1 }), -ef('chaos'));
  assert.equal(ef('chaos', { res_elemental_invertida: 1 }), ef('chaos'), 'a elemental invertida não mexe no Caos');
  const pen = { fisica: 0, elemental: 20, porElemento: {} };
  assert.equal(ef('fire', {}, pen), ef('fire') - 20, 'com a penetração');
  assert.equal(ef('fire', { sem_penetracao_elemental: 1 }, pen), ef('fire'), '"não podem Penetrar": sem ela');
});

test('as escalas pela resistência EXCEDENTE, o dreno no crítico, a vida perdida por inimigo acertado e as magias desabilitadas', { skip: SEM }, () => {
  const f = Ficha.combate(comAf({ fire_res: 120, 'armour_pct%resFogoExcedente:1': 1, 'minion_life%resFogoExcedente:1': 1 }));
  const exc = f.excedentes.protection.fire;
  assert.ok(exc > 0, `há excedente (${exc})`);
  const base = Ficha.combate(comAf({ fire_res: 120 }));
  assert.equal((f.afPoe.armour_pct ?? 0) - (base.afPoe.armour_pct ?? 0), exc);
  assert.equal((f.afPoe.minion_life ?? 0) - (base.afPoe.minion_life ?? 0), exc, 'e o lacaio invocado lê a mesma soma');
  // O dreno: só a parte crítica do dano drena com "X% do Dano de Golpes Críticos é Drenado como Vida"; "Não pode Drenar Vida com Golpes
  // Críticos" tira a parte crítica do dreno de sempre.
  const drenado = (af, danoCritico) => {
    const e = comAf(af);
    e.hp = 1;
    e.hunt = { clock: 0, pos: { x: 0, y: 0 }, monstros: [] };
    Ficha.aplicarLeech(e, 1000, [], 'x', e.hunt.pos, Ficha.combate(e), null, { danoCritico });
    return (e.hunt.roubos ?? []).filter((r) => r.recurso === 'vida').reduce((n, r) => n + r.restante, 0) + (e.hp - 1);
  };
  assert.equal(drenado({ roubo_vida_critico: 10 }, 0), 0, 'sem crítico, nada');
  assert.ok(Math.abs(drenado({ roubo_vida_critico: 10 }, 400) - 40) < 1, '10% dos 400 do crítico');
  const comum = drenado({ life_leech: 5 }, 0);
  const semCrit = drenado({ life_leech: 5, sem_roubo_vida_critico: 1 }, 1000);
  assert.ok(comum > 0 && semCrit === 0, `o golpe todo crítico não drena (${comum} → ${semCrit})`);
  // A vida perdida por inimigo acertado: a ação `perdeVida` (não mata).
  assert.deepEqual(traduz('Perde {0} de Vida para cada Inimigo acertado por seus Ataques').efeitos.map((x) => x.stat), ['ev:acertar:perdeVida@ataque']);
  const e = comAf({ 'ev:acertar:perdeVida@ataque': 30 });
  e.hp = 100;
  e.hunt = { clock: 0, pos: { x: 0, y: 0 }, monstros: [] };
  const fe = Ficha.combate(e);
  ModsPoe.evento(e, e.hunt, 'acertar', fe, { alvo: { hp: 10, maxHp: 10 }, tags: ['ataque'], eventos: [] });
  assert.equal(e.hp, 70);
  ModsPoe.evento(e, e.hunt, 'acertar', fe, { alvo: { hp: 10, maxHp: 10 }, tags: ['magia'], eventos: [] });
  assert.equal(e.hp, 70, 'a magia não perde');
  e.hp = 10;
  ModsPoe.evento(e, e.hunt, 'acertar', fe, { alvo: { hp: 10, maxHp: 10 }, tags: ['ataque'], eventos: [] });
  assert.equal(e.hp, 1, 'não mata');
  assert.deepEqual(traduz('Suas Magias são desabilitadas').efeitos.map((x) => x.stat), ['magias_desabilitadas']);
  assert.deepEqual(traduz('Habilidades de Magia não causam Dano').efeitos.map((x) => [x.stat, x.valor]), [['mais_dano@magia', -100]]);
});

test('as afecções em você: o Sangramento quando acertado por ataque, a chance a mais de ser Envenenado e a imunidade depois da afecção', { skip: SEM }, () => {
  const dots = (e) => (e.hunt.efeitosDoJogador?.dots ?? []).filter((d) => d.falta > 0).map((d) => d.tipo);
  const novo = (af) => {
    const e = comAf(af);
    e.hunt = { clock: 1000, pos: { x: 0, y: 0 }, monstros: [] };
    // (a caçada registra a ficha do personagem a cada tique — `definirFichaDaCacada`; aqui, à mão)
    ModsPoe.definirFichaDaCacada(e.hunt, () => Ficha.combate(e));
    return e;
  };
  // Acertado por ATAQUE (corpo a corpo) com 100%: sangra; por magia, não.
  const e = novo({ sangrar_ao_ser_atacado: 100 });
  ModsPoe.aoSerAcertado(e, e.hunt, null, Ficha.combate(e), { dano: 100, corpoACorpo: true, rng: () => 0 });
  assert.deepEqual(dots(e), ['sangramento']);
  const m = novo({ sangrar_ao_ser_atacado: 100, veneno_ao_ser_magia: 100 });
  ModsPoe.aoSerAcertado(m, m.hunt, null, Ficha.combate(m), { dano: 100, corpoACorpo: false, rng: () => 0 });
  assert.deepEqual(dots(m), ['venenoPoe'], 'a magia envenena e não sangra');
  // "+X% de chance de ser Envenenado": soma à chance do efeito do monstro.
  assert.equal(ModsPoe.chanceExtraDeSer(Ficha.combate(comAf({ chance_ser_veneno: 25 })), 'venenoPoe'), 25);
  assert.equal(ModsPoe.chanceExtraDeSer(Ficha.combate(comAf({ chance_ser_veneno: 25 })), 'choque'), 0);
  // "Você não pode ser Incendiado durante 4 segundos depois de ter sido Incendiado": o segundo incêndio, dentro dos 4 s, não entra.
  const i = novo({ imune_apos_incendio: 4 });
  assert.ok(ModsPoe.dotNoJogador(i.hunt, { tipo: 'queimadura', total: 10, origem: { fonte: 'teste' } }, 1000, () => 0.99));
  assert.equal(i.hunt.imunidadesPoe.incendio, 5000);
  i.hunt.clock = 2000;
  assert.equal(ModsPoe.dotNoJogador(i.hunt, { tipo: 'queimadura', total: 10, origem: { fonte: 'teste' } }, 2000, () => 0.99), null);
  // e o Congelamento pelo controle do monstro
  const c = novo({ imune_apos_congelamento: 3 });
  const ficha = Ficha.combate(c);
  ModsPoe.imunidadeApos(c.hunt, ficha, 'congelamento', 1000);
  assert.equal(ModsPoe.controleNoJogador(ficha, 'congelado', () => 0.99, c.hunt).evitou, true);
  assert.equal(typeof Controle.tentar, 'function');
});

test('armadilhas e minas: o evento da armadilha ativada, ao lançar, a Carga de Poder perdida sem detonar minas e o dreno das minas', { skip: SEM }, () => {
  assert.ok(ModsPoe.EVENTOS.has('lancarArmadilha') && ModsPoe.EVENTOS.has('detonarMina') && ModsPoe.EVENTOS.has('armadilha'));
  assert.deepEqual(traduz('{0}% de chance de ganhar uma Carga de Poder ao Lançar uma Armadilha').efeitos.map((x) => x.stat), ['ev:lancarArmadilha:carga:poder']);
  assert.deepEqual(traduz('Perca uma Carga de Poder por segundo caso não tenha Detonado Minas Recentemente').efeitos.map((x) => x.stat), ['poder_perde_a_cada_s@naoDetonouMinaRecente']);
  // A Carga de Poder perdida a cada segundo (até o mínimo).
  const e = comAf({});
  e.hunt = { clock: 0, cargasPoe: { poder: { n: 3, ate: 99_999 } } };
  const regras = { poder_perde_a_cada_s: 1 };
  CargasPoe.tique(e, regras);
  e.hunt.clock = 1000;
  CargasPoe.tique(e, regras);
  assert.equal(e.hunt.cargasPoe.poder.n, 2);
  e.hunt.clock = 2000;
  CargasPoe.tique(e, regras);
  assert.equal(e.hunt.cargasPoe.poder.n, 1);
  assert.equal(CargasPoe.regrasDaSoma({ poder_perde_a_cada_s: 1 }).poder_perde_a_cada_s, 1);
  // "Perca … caso não tenha Detonado Minas Recentemente": detonou há pouco, a condição não vale.
  const m = comAf({ 'poder_perde_a_cada_s@naoDetonouMinaRecente': 1 });
  m.hunt = { clock: 10_000, poeRecente: { detonouMina: 9_000 } };
  assert.equal(afPoe(m).poder_perde_a_cada_s, undefined);
  m.hunt.poeRecente.detonouMina = -100_000;
  assert.equal(afPoe(m).poder_perde_a_cada_s, 1);
  // O dreno das MINAS: o dano da magia com a tag Mina drena vida (`vida_leech_magia@mina`).
  const d = comAf({ 'vida_leech_magia@mina': 10 });
  d.hp = 1;
  d.hunt = { clock: 0, pos: { x: 0, y: 0 }, monstros: [] };
  const fichaMina = ModsPoe.fichaDoGolpe(Ficha.combate(d), ['magia', 'mina']);
  Ficha.aplicarLeech(d, 1000, [], 'x', d.hunt.pos, fichaMina, null, { ataque: false });
  const fichaOutra = ModsPoe.fichaDoGolpe(Ficha.combate(d), ['magia']);
  const antes = (d.hunt.roubos ?? []).length;
  Ficha.aplicarLeech(d, 1000, [], 'x', d.hunt.pos, fichaOutra, null, { ataque: false });
  assert.ok(antes > 0, 'a mina drenou');
  assert.equal((d.hunt.roubos ?? []).length, antes, 'a magia sem a tag Mina não drena');
});

test('os gatilhos das peças: a magia encaixada na arma sai quando você ataca, com a recarga do mod; o filtro e o evento valem', { skip: SEM }, async () => {
  const GS = await import('../systems/skills/gemas.mjs');
  const G = await import('../systems/itens-poe/gemas-poe.mjs');
  const J = await import('../systems/itens-poe/jogo.mjs');
  const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
  const { PERSONAGEM } = await import('./apoio.mjs');
  if (!G.doSlug('Fireball')) return; // (sem a coleção de gemas nesta máquina)
  (await import('../systems/itens-poe/campanha.mjs')).iniciar();
  const comGatilho = (af) => {
    const e = personagemDeTeste({ vocacao: 'sorcerer', level: 40 });
    e.classePoe = 'Witch';
    const arma = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Wands/Driftwood_Wand', raridade: 'normal', ilvl: 20, rng: () => 0.99 }));
    arma.poe.af = { ...(arma.poe.af ?? {}), ...af };
    arma.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
    e.equipment = { ...(e.equipment ?? {}), weapon: arma };
    e.inventory = [GS.itemDaGema({ id: G.doSlug('Fireball').itemId, nivel: 10, xp: 0, raridade: 'comum' })];
    GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
    Ficha.invalidar(e); Afixos.sincronizarMaximos(e); e.mana = e.maxMana = 99999;
    Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' });
    const bicho = e.hunt.monstros.find((b) => b.hp > 0);
    e.hunt.pos = { ...e.hunt.pos, x: bicho.x + 1, y: bicho.y };
    return { e, bicho };
  };
  assert.deepEqual(GS.encaixadasNaPeca(comGatilho({}).e.equipment.weapon, 'magia'), [G.doSlug('Fireball').acao]);
  assert.deepEqual(GS.encaixadasNaPeca(comGatilho({}).e.equipment.weapon, 'raio'), [], 'a Bola de Fogo não é de Raio');
  const { e, bicho } = comGatilho({ 'gatilho_local:usarAtaque:magia': 0.25 });
  const disparar = (nome) => {
    const ev = [];
    ModsPoe.evento(e, e.hunt, nome, Ficha.combate(e), { alvo: bicho, tags: ['ataque'], personagem: PERSONAGEM, eventos: ev });
    return ev.filter((x) => x.t === 'gatilho').length;
  };
  assert.equal(disparar('usarMagia'), 0, 'outro evento: nada');
  assert.equal(disparar('usarAtaque'), 1, 'o ataque ativa a Bola de Fogo encaixada');
  assert.equal(disparar('usarAtaque'), 0, 'dentro da recarga (0,25 s): espera');
  e.hunt.clock = (e.hunt.clock ?? 0) + 300;
  assert.equal(disparar('usarAtaque'), 1, 'depois da recarga, de novo');
  // O filtro: "Ativa uma Magia de Raio Encaixada ao Acertar" não ativa a Bola de Fogo.
  const raio = comGatilho({ 'gatilho_local:acertar:raio': 0.25 });
  const ev = [];
  ModsPoe.evento(raio.e, raio.e.hunt, 'acertar', Ficha.combate(raio.e), { alvo: raio.bicho, tags: ['ataque'], personagem: PERSONAGEM, eventos: ev });
  assert.equal(ev.filter((x) => x.t === 'gatilho').length, 0);
});

test('trava contra regressão: as linhas de armas, armaduras e amuletos únicos que não funcionam não voltam a subir (rodada 3)', { skip: SEM }, () => {
  const ARMAS = /One_Hand|Two_Hand|Thrusting|Sceptres|Staves|Warstaves|Claws|Daggers|Rune_Daggers|Bows|Wands/;
  const OUTRAS = /Body_Armours|Helmets|Gloves|Boots|Shields|Quivers|Amulets/;
  const d = Pendencias.pendencias();
  const ruins = d.linhas.filter((l) => l.origem === 'unico' && l.classes.some((c) => ARMAS.test(c) || OUTRAS.test(c)) && ['pendente', 'inexiste'].includes(l.estado));
  assert.ok(ruins.length <= 800, `${ruins.length} linhas sem funcionar (eram 898 antes da rodada 3)`);
});
