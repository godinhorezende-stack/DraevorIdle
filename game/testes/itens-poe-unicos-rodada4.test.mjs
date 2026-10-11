// Os MODIFICADORES DOS ÚNICOS — rodada 4: armas, armaduras e amuletos (dono, 11/10: "quero tentar resolver todos os modificadores únicos,
// das armas, armaduras e amuletos"). A RESERVA das auras (a Eficácia por gema, da peça, por atributos; "não tem Reserva"; o Arauto fixo; a
// "Reserva X% da Vida"; as escalas por vida/mana reservada — e as regras novas entram ANTES da regra genérica de "Reserva", que as engoliria),
// a cor do ENCAIXE e as gemas na peça no nível das gemas (e a escala dos níveis locais, que era ignorada), e o dreno que enche a vida. E o
// ESCUDO DE ENERGIA (o Físico que o ignora, o escudo da Armadura, a vida trocada por escudo), o dano na MANA antes da vida, o dano por afecção
// e por maldição no alvo, e o Empalamento no crítico das magias. E os PROJÉTEIS das peças (difundir, perfurar todos, parar ao colidir), os
// dos monstros (evitar, o físico fixo a menos) e os cadáveres próximos. E os eventos com ESCALA, o crítico sofrido, a aura sem crítico, o
// bloqueio contra amaldiçoados, as durações em você, as gemas da peça (dano dobrado, custo) e as magias conjuradas recentemente. E os
// TOTENS (o máximo de uma gema por atributo, o teto do mesmo tipo) e o dano recebido desviado para o totem e para os Espectros.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';

const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no jogo oficial (PoE)';
const { personagemDeTeste } = await import('./apoio.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Reserva = await import('../systems/itens-poe/reserva.mjs');
const Pendencias = await import('../admin/itens-poe-pendencias.mjs');
const { ACTION_CATALOG } = await import('../systems/dados.mjs');
const Arvore = await import('../systems/arvore.mjs');

const COM_EFEITO = ['equivalente', 'aproximado', 'novo'];
const traduz = (texto) => T.traduzirParte(texto, (texto.match(/\{(\d+)\}/g) ?? []).map(() => 10));
function comAf(af) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 90 });
  e.equipment = { ring: { id: 1, poe: { af } } };
  Ficha.invalidar(e);
  return e;
}
const gema = (slug) => ACTION_CATALOG.spells.find((x) => x.id === `poe-gema:${slug}`);

test('as regras de reserva casam antes da genérica: cada frase vira o atributo dela', { skip: SEM }, () => {
  const casos = {
    'Eficácia da Reserva das Habilidades reduzida em {0}%': [['eficiencia_reserva', -10]],
    'Eficácia da Reserva de Mana de Habilidades aumentada em {0}%': [['eficiencia_reserva_mana', 10]],
    'Ódio tem Eficácia da Reserva de Mana aumentada em {0}%': [['eficiencia_reserva_gema:odio', 10]],
    'Congelabilidade não tem Reserva se Conjurada como Aura': [['sem_reserva:congelabilidade', 1]],
    'Reserva de Mana de Habilidades de Arauto é sempre {0}%': [['reserva_arauto_fixa', 10]],
    'Reserva {0}% da Vida': [['reserva_vida_pct', 10]],
    'Gemas Encaixadas Custam e Reservam Vida ao invés de Mana': [['custo_vida_local', 1]],
  };
  for (const [texto, esperado] of Object.entries(casos)) {
    const r = traduz(texto);
    assert.ok(COM_EFEITO.includes(r.estado), `${texto}: ${r.estado}`);
    assert.deepEqual(r.efeitos.map((x) => [x.stat, x.valor]), esperado, texto);
  }
  assert.equal(traduz('Inveja não tem Reserva').estado, 'inerte', 'a gema que o jogo não tem continua "não existe", com o nome');
});

test('a reserva: "não tem Reserva" zera, a Eficácia de UMA gema e a do Arauto fixo', { skip: SEM }, () => {
  const odio = gema('Hatred');
  const arauto = gema('Herald_of_Ice');
  if (!odio || !arauto) return; // (sem a coleção de gemas)
  const pedida = (af, entry) => Reserva.pedida(comAf(af), entry, { nivel: 1 }, Ficha.combate(comAf(af)));
  const base = pedida({}, odio);
  assert.ok(base?.valor > 0, 'o Ódio reserva mana');
  assert.equal(pedida({ 'sem_reserva:odio': 1 }, odio).valor, 0, '"Ódio não tem Reserva"');
  assert.ok(pedida({ 'eficiencia_reserva_gema:odio': 100 }, odio).valor < base.valor, 'a Eficácia do Ódio: reserva menos');
  assert.equal(pedida({ 'eficiencia_reserva_gema:precisao': 100 }, odio).valor, base.valor, 'a de outra gema não mexe');
  assert.equal(pedida({ reserva_arauto_fixa: 10 }, arauto).pct, 10, 'o Arauto reserva os 10% fixos');
  assert.equal(pedida({ reserva_arauto_fixa: 10 }, odio).pct, base.pct, 'a aura que não é Arauto, não');
});

test('a "Reserva X% da Vida" e as escalas por vida/mana reservada', { skip: SEM }, () => {
  const e = comAf({ reserva_vida_pct: 20 });
  e.hunt = { clock: 1000, buffs: { aura: { ate: 99_999, reserva: { recurso: 'mana', pct: 50, fator: 1 } } } };
  ModsPoe.definirFichaDaCacada(e.hunt, () => Ficha.combate(e));
  const r = Reserva.reservadas(e);
  assert.equal(r.vida, Math.ceil(e.maxHp * 0.2));
  assert.equal(r.mana, Math.ceil(e.maxMana * 0.5));
  assert.equal(ModsPoe.fatorDaEscala(e, Ficha.combate(e).afPoe, null, 'vidaReservada:10'), Math.floor(Math.ceil(e.maxHp * 0.2) / 10));
  assert.equal(ModsPoe.fatorDaEscala(e, Ficha.combate(e).afPoe, null, 'manaReservada:10'), Math.floor(Math.ceil(e.maxMana * 0.5) / 10));
  assert.deepEqual(traduz('Armadura aumentada em {0}% por cada {1} de Mana Reservada').efeitos.map((x) => x.stat), ['armour_pct%manaReservada:10']);
});

test('o nível das gemas: a cor do ENCAIXE, as gemas na peça e a escala dos níveis locais (antes "+1 a cada 25 níveis" dava sempre +1)', { skip: SEM }, async () => {
  const GS = await import('../systems/skills/gemas.mjs');
  const J = await import('../systems/itens-poe/jogo.mjs');
  const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
  const ativa = [...GS.DEFS.values()].find((d) => d.tipo === 'ativa' && d.poe);
  if (!ativa) return;
  // (a gema só fica no encaixe em que cabe — o jogo troca a cor do encaixe pela da gema; o branco aceita qualquer uma)
  const peca = (af, cores = ['W', 'G', 'B'], comGema = [0]) => {
    const p = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Wands/Driftwood_Wand', raridade: 'normal', ilvl: 60, rng: () => 0.99 }));
    p.poe.af = af;
    p.soquetes = { abertos: cores.length, links: cores.slice(1).map(() => false), gemas: cores.map((_, i) => (comGema.includes(i) ? { id: ativa.itemId, nivel: 1 } : null)), cores };
    return p;
  };
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 90 });
  const vermelho = peca({ 'gem_level_local@encaixeVermelho': 2 }, ['R', 'G', 'B'], []);
  assert.equal(GS.extrasDaGemaPoe(e, vermelho, ativa, 0).nivel, 2, 'no encaixe vermelho');
  assert.equal(GS.extrasDaGemaPoe(e, vermelho, ativa, 1).nivel, 0, 'no verde, nada');
  assert.equal(GS.extrasDaGemaPoe(e, peca({ 'gem_level_local%nivel:25': 1 }), ativa, 0).nivel, 3, 'nível 90: +3 (a cada 25)');
  assert.equal(GS.extrasDaGemaPoe(e, peca({ 'gem_level_local%gemasNaPeca@habilidade': -1 }, ['W', 'W', 'W'], [0, 1, 2]), ativa, 0).nivel, -3, '3 gemas na peça: -3');
  assert.equal(GS.extrasDaGemaPoe(e, peca({ 'gem_quality_local@encaixeVerde': 10 }, ['R', 'G', 'B'], []), ativa, 1).qualidade, 10);
  // A reserva e o custo locais vão para o efeito da gema.
  const local = GS.extrasDaGemaPoe(e, peca({ eficiencia_reserva_local: 30, custo_vida_local: 1 }), ativa, 0);
  assert.deepEqual([local.eficienciaReserva, local.custoEmVida], [30, true]);
});

test('o dreno que enche a vida dispara "quando o Dreno for removido Preenchendo a Vida Não Reservada"', { skip: SEM }, () => {
  const e = comAf({ 'ev:drenoCheio:buffChance:adrenalina:5': 100 });
  e.hp = e.maxHp;
  e.hunt = { clock: 1000, roubos: [{ recurso: 'vida', restante: 50, porSegundo: 500 }] };
  ModsPoe.definirFichaDaCacada(e.hunt, () => Ficha.combate(e));
  Ficha.recuperarRoubo(e, 250);
  assert.ok((e.hunt.poeBuffs?.adrenalina ?? 0) > 1000, 'a Adrenalina por 5 s');
});

test('o escudo: o escudo da Armadura ao bloquear e a vida trocada por escudo ao conjurar', { skip: SEM }, () => {
  const e = comAf({ 'ev:bloquear:esDaArmadura': 10, 'ev:usarMagia:vidaParaEs': 10, energy_shield: 5000 });
  e.hunt = { clock: 1000, pos: { x: 0, y: 0 }, monstros: [] };
  const f = Ficha.combate(e);
  e.es = 0;
  ModsPoe.evento(e, e.hunt, 'bloquear', f, {});
  assert.equal(e.es, Math.floor((f.armor * 10) / 100), '10% da Armadura');
  e.es = 0;
  e.hp = e.maxHp;
  ModsPoe.evento(e, e.hunt, 'usarMagia', f, {});
  const perdida = e.maxHp - e.hp;
  assert.ok(perdida > 0 && Math.abs(perdida - Math.round(e.maxHp * 0.1)) <= 1, `perdeu ${perdida}`);
  assert.equal(e.es, perdida, 'a mesma quantidade em escudo');
});

test('o dano na mana antes da vida (por carga e por elemento) e o Físico que ignora o escudo', { skip: SEM }, () => {
  const tirar = (af, dano, elemento) => {
    const e = comAf(af);
    e.mana = 1000;
    e.hunt = { clock: 1000, cargasPoe: { poder: { n: 3, ate: 99_999 } } };
    const f = Ficha.combate(e);
    const v = Arvore.danoRecebido(e, dano, [], { x: 0, y: 0 }, 'x', { ficha: f, elemento });
    return { vida: v, mana: 1000 - e.mana };
  };
  assert.deepEqual(tirar({ 'dano_na_mana_pct%carga:poder': 10 }, 100, 'physical'), { vida: 70, mana: 30 }, '3 cargas × 10%');
  assert.deepEqual(tirar({ dano_na_mana_pct_chaos: 100 }, 100, 'chaos'), { vida: 0, mana: 100 });
  assert.deepEqual(tirar({ dano_na_mana_pct_chaos: 100 }, 100, 'fire'), { vida: 100, mana: 0 }, 'o Fogo não');
  assert.deepEqual(traduz('Dano Físico sofrido ignora o Escudo de Energia').efeitos.map((x) => x.stat), ['fisico_ignora_escudo']);
});

test('o dano por afecção e por maldição no alvo, e o Empalamento no crítico das magias', { skip: SEM }, () => {
  const alvo = { uid: 1, hp: 100, maxHp: 100, estados: { chocado: { ate: 5000 }, lento: { ate: 5000, pct: 10 } }, dots: [{ tipo: 'sangramento', falta: 1000 }], maldicoes: { a: { ate: 5000 }, b: { ate: 5000, marca: true }, c: { ate: 10 } } };
  assert.equal(ModsPoe.afeccoesNoAlvo(alvo, 1000), 3, 'Eletrizado, Resfriado e Sangrando');
  assert.equal(ModsPoe.maldicoesNoAlvo(alvo, 1000), 2, 'as duas que valem (a vencida não)');
  const ficha = Ficha.combate(comAf({ dano_por_afeccao_no_alvo: 10 }));
  assert.ok(Math.abs(ModsPoe.fatorRecebidoPeloBicho(alvo, 'physical', ficha, 1000) - 1.3) < 1e-9, '3 afecções × 10%');
  // O Caos somado por maldição: 2 maldições × (5 a 9).
  const f = Ficha.combate(comAf({ added_chaos_por_maldicao_min: 5, added_chaos_por_maldicao_max: 9 }));
  const golpe = ModsPoe.fichaDoGolpe(f, ['ataque'], { alvo, estado: { hunt: { clock: 1000 } } });
  const base = f.danoSomado?.chaos ?? [0, 0];
  assert.deepEqual(golpe.danoSomado?.chaos, [base[0] + 10, base[1] + 18]);
  assert.deepEqual(traduz('Golpes Críticos com Magias infligem Empalamento').efeitos.map((x) => x.stat), ['chance_empalar@critico+magia']);
  assert.equal(T.atributoTemEfeito('chance_empalar@critico'), true);
});

test('os projéteis das peças (difundir, perfurar, parar ao colidir) e os cadáveres próximos', { skip: SEM }, () => {
  const alvos = (af, tags = ['ataque', 'projetil', 'arco']) => {
    const e = comAf(af);
    return ModsPoe.alvosDasPecas(e, Ficha.combate(e), null, tags, 'ring', () => 0.99);
  };
  assert.equal(alvos({ 'bifurcar@arco': 1 }).bifurcar, 1, '"Flechas Difundem"');
  assert.equal(alvos({ 'bifurcar@arco': 1 }, ['magia', 'projetil']).bifurcar, 0, 'a magia não é flecha');
  assert.equal(alvos({ 'perfurar@arco': 99 }).perfurar, 99);
  assert.equal(alvos({ projeteis_param: 1 }).param, true);
  assert.equal(alvos({ projeteis_param: 1 }, ['magia', 'area']).param, false, 'sem projétil, nada');
  // Os cadáveres: os mortos da caçada no chão, a até 4 casas.
  const e = comAf({ 'move_speed%cadaveresPerto': 5 });
  e.hunt = { clock: 1000, pos: { x: 10, y: 10 }, cadaveres: [{ x: 11, y: 10 }, { x: 13, y: 13 }, { x: 30, y: 30 }] };
  assert.equal(ModsPoe.fatorDaEscala(e, {}, null, 'cadaveresPerto'), 2);
  const base = Ficha.combate(comAf({})).afPoe.move_speed ?? 0;
  Ficha.invalidar(e);
  assert.equal((Ficha.combate(e).afPoe.move_speed ?? 0) - base, 10);
});

test('os eventos com escala ("N de Vida por Carga de Frenesi ao Matar", "Agressividade por N s por Carga de Tolerância") e o crítico sofrido', { skip: SEM }, () => {
  const e = comAf({ 'ev:matar:vida%carga:frenesi': 10, 'ev:serAcertado:buff:agressividade%carga:tolerancia': 2, 'ev:serAcertadoCritico:cargaMax:tolerancia': 100 });
  e.hp = 1;
  e.hunt = { clock: 1000, pos: { x: 0, y: 0 }, monstros: [], cargasPoe: { frenesi: { n: 3, ate: 99_999 }, tolerancia: { n: 2, ate: 99_999 } } };
  const f = Ficha.combate(e);
  ModsPoe.evento(e, e.hunt, 'matar', f, {});
  assert.equal(e.hp, 31, '3 cargas × 10');
  ModsPoe.evento(e, e.hunt, 'serAcertado', f, {});
  assert.equal(e.hunt.poeBuffs?.agressividade, 1000 + 4000, '2 cargas × 2 s');
  assert.deepEqual(traduz('Ganha até o máximo de Cargas de Tolerância ao sofrer um Golpe Crítico').efeitos.map((x) => x.stat), ['ev:serAcertadoCritico:cargaMax:tolerancia']);
});

test('o evento com condição de estado sai UMA vez (antes: a soma também o resolvia e ele saía duas vezes quando a condição valia)', { skip: SEM }, () => {
  const e = comAf({ 'ev:matar:vida@naoManaBaixa': 10 });
  e.hp = 1;
  e.hunt = { clock: 1000, pos: { x: 0, y: 0 }, monstros: [] };
  const f = Ficha.combate(e);
  assert.deepEqual(f.eventosPoe.map((x) => [x.evento, x.acao, x.conds]), [['matar', 'vida', ['naoManaBaixa']]], 'só a condicional');
  ModsPoe.evento(e, e.hunt, 'matar', f, {});
  assert.equal(e.hp, 11);
  e.mana = 1;
  Ficha.invalidar(e);
  ModsPoe.evento(e, e.hunt, 'matar', Ficha.combate(e), {});
  assert.equal(e.hp, 11, 'em Mana Baixa, nada');
});

test('a aura sem crítico, o bloqueio contra amaldiçoados e as durações em você (maldição, atordoamento)', { skip: SEM }, () => {
  const bicho = { estados: { semCritico: { ate: 5000 } } };
  assert.deepEqual(ModsPoe.criticoDoBicho({ chance: 1, fator: 2 }, bicho, Ficha.combate(comAf({})), 1000, () => 0), { critico: false, fator: 1 });
  // A Maldição em você dura o dobro com "+100%".
  const e = comAf({ duracao_maldicao_propria: 100, duracao_atordoamento_propria: 50 });
  e.hunt = { clock: 1000 };
  ModsPoe.definirFichaDaCacada(e.hunt, () => Ficha.combate(e));
  ModsPoe.amaldicoarJogador(e.hunt, 'x', { nome: 'X', af: { fire_res: -10 }, ms: 6000 }, 1000);
  assert.equal(e.hunt.maldicoesNoJogador.x.ate, 1000 + 12000);
  const base = ModsPoe.controleNoJogador(Ficha.combate(comAf({})), 'atordoado', () => 0.99).duracaoFator;
  assert.ok(Math.abs(ModsPoe.controleNoJogador(Ficha.combate(e), 'atordoado', () => 0.99).duracaoFator - base * 1.5) < 1e-9);
  assert.deepEqual(traduz('+{0}% de Chance de Bloquear o Dano de Ataques de Inimigos Amaldiçoados').efeitos.map((x) => x.stat), ['block_vs_amaldicoado']);
});

test('as gemas da peça: "Habilidades Encaixadas causam Dano Dobrado" e "Gemas encaixadas custam -50% de mana"; as magias recentes', { skip: SEM }, async () => {
  const GS = await import('../systems/skills/gemas.mjs');
  const J = await import('../systems/itens-poe/jogo.mjs');
  const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
  const G = await import('../systems/itens-poe/gemas-poe.mjs');
  if (!G.doSlug('Fireball')) return;
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 40 });
  const efeito = (af) => {
    const arma = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Wands/Driftwood_Wand', raridade: 'normal', ilvl: 20, rng: () => 0.99 }));
    arma.poe.af = af;
    arma.soquetes = { abertos: 1, links: [], gemas: [{ id: G.doSlug('Fireball').itemId, nivel: 1 }], cores: ['W'] };
    e.equipment = { weapon: arma };
    return GS.efeitoNaSkill(e, G.doSlug('Fireball').acao);
  };
  const base = efeito({});
  assert.equal(efeito({ mais_dano_local: 100 }).fatorDeDano, base.fatorDeDano * 2);
  assert.ok(Math.abs(efeito({ custo_local: -50 }).custoPct - (((1 + base.custoPct / 100) * 0.5 - 1) * 100)) < 1e-9);
  // As magias conjuradas recentemente (os últimos 4 s).
  const m = comAf({});
  m.hunt = { clock: 10_000, poeMagiasRecentes: [5000, 7000, 9000, 9500] };
  assert.equal(ModsPoe.fatorDaEscala(m, {}, null, 'magiasRecentes'), 3);
});

test('os totens: o máximo de UMA gema por atributo e o teto do mesmo tipo; o dano desviado para o totem mais próximo', { skip: SEM }, async () => {
  const Lacaios = await import('../systems/itens-poe/lacaios-poe.mjs');
  const base = Lacaios.oQueInvoca('Shrapnel_Ballista', 10, null, {});
  if (!base) return; // (sem a gema nesta máquina)
  assert.equal(base.tipo, 'totem');
  assert.equal(Lacaios.oQueInvoca('Shrapnel_Ballista', 10, null, { 'max_totem_gema:balista-estilhacante': 2 }).maximo, base.maximo + 2);
  assert.equal(Lacaios.oQueInvoca('Shrapnel_Ballista', 10, null, { 'max_totem_gema:balista-de-cerco': 2 }).maximo, base.maximo, 'a de outra gema não');
  assert.equal(Lacaios.oQueInvoca('Shrapnel_Ballista', 10, null, { 'max_lacaio:totem': 3, max_totem_mesmo_tipo: 1 }).maximo, 1, 'o teto do mesmo tipo');
  // O dano desviado: metade do acerto vai para o totem mais perto (até a vida dele).
  const e = comAf({ dano_no_totem_pct: 50 });
  const totem = { uid: 't', tipo: 'totem', x: 1, y: 0, hp: 30 };
  e.hunt = { clock: 1000, pos: { x: 0, y: 0 }, lacaios: [totem] };
  const v = Arvore.danoRecebido(e, 100, [], { x: 0, y: 0 }, 'x', { ficha: Ficha.combate(e) });
  assert.equal(totem.hp, 0, 'o totem segurou 30 (a vida dele)');
  assert.equal(v, 70);
});

test('trava contra regressão: as linhas de armas, armaduras e amuletos únicos que não funcionam não voltam a subir (rodada 4)', { skip: SEM }, () => {
  const ARMAS = /One_Hand|Two_Hand|Thrusting|Sceptres|Staves|Warstaves|Claws|Daggers|Rune_Daggers|Bows|Wands/;
  const OUTRAS = /Body_Armours|Helmets|Gloves|Boots|Shields|Quivers|Amulets/;
  const d = Pendencias.pendencias();
  const ruins = d.linhas.filter((l) => l.origem === 'unico' && l.classes.some((c) => ARMAS.test(c) || OUTRAS.test(c)) && ['pendente', 'inexiste'].includes(l.estado));
  assert.ok(ruins.length <= 719, `${ruins.length} linhas sem funcionar (eram 800 antes da rodada 4)`);
});
