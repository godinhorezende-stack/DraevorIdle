// Os MODIFICADORES DOS ÚNICOS — rodada 9: armas, armaduras e amuletos (dono, 11/10: "quero tentar resolver todos os modificadores únicos";
// depois da rodada 8: "seguir sem commitar"). O Excomungado (sem dano de Caos, mais crítico contra ele), o dreno de escudo por maldição no
// inimigo, a Fúria Arcana no movimento, a recuperação do escudo a menos, o dano pela mana gasta, o Decaimento de quem você amaldiçoa, a
// Atrofia nos envenenados, as auras que já são só suas, a Nebulis, os venenos com mais dano e o dreno máximo pela vida reservada. Lote B: a
// conjuração mais lenta dos eletrizados, os clamores (empurram; sem recarga), o bloqueio e a armadura contra projéteis, o Físico como Gelo ou
// Raio extra e o Raio a mais por eletrizado morto. Lote C: as cargas ao acertar inimigos sem Armadura / sem Evasão e ao empurrar, o
// Combatente Versátil e o bônus da Força da Fortaleza de Ferro. Lote D: as redações novas da auditoria dos únicos (`unicos-correcoes.json`)
// para efeitos que o jogo já tem — o elemento como Caos extra, a escala por gema encaixada e por encaixe vazio da própria peça, a redução
// física zero, a evasão no Dano Mágico e o multiplicador do Incêndio crítico. Lote E: as Cargas de Salmoura do Divisor de Águas e o tempo
// de ataque dos lacaios igual ao da arma (a Réplica: Ensinamentos de Maata).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';

const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no jogo oficial (PoE)';
const { personagemDeTeste } = await import('./apoio.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afeccoes = await import('../systems/itens-poe/afeccoes.mjs');
const Afixos = await import('../systems/afixos.mjs');
const CargasPoe = await import('../systems/itens-poe/cargas.mjs');
const Pendencias = await import('../admin/itens-poe-pendencias.mjs');
const Poderes = await import('../systems/poderes.mjs');
const Acoes = await import('../systems/acoes.mjs');
const GP = await import('../systems/itens-poe/gemas-poe.mjs');
const { PERSONAGEM } = await import('./apoio.mjs');
await import('../systems/hunt/combate.mjs'); // (registra as defesas do bicho para as condições do PoE)

const traduz = (texto) => T.traduzirParte(texto, (texto.match(/\{(\d+)\}/g) ?? []).map(() => 10));
function comAf(af) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 90 });
  e.equipment = { ring: { id: 1, poe: { af } } };
  Ficha.invalidar(e);
  return e;
}

test('as frases da rodada 9 viram os atributos', { skip: SEM }, () => {
  const casos = {
    'Excomunga inimigos ao Atingir Corpo a Corpo por {0} segundos': ['ev:acertar:alvo:excomungado:10@corpo'],
    'Ataques corpo a corpo têm +{0}% de chance de causar golpe crítico contra inimigos excomungados': ['crit_chance@corpo+alvoExcomungado'],
    '{0}% do Dano Mágico é Drenado como Escudo de Energia para cada Maldição no Inimigo': ['es_leech_magia_por_maldicao'],
    'Aumento da velocidade de conjuração causado por Fúria Arcana também se aplica à velocidade de movimento': ['move_speed@buff:furiaArcana'],
    '{0}% menos Recuperação do Escudo de Energia': ['es_recarga_menos', 'recuperacao_es_menos'],
    'Suas Habilidades causam {0}% da Mana Gasta no Custo de Mana Direto da Habilidade como Dano Físico': ['ev:gastarMana:danoPorMana'],
    'Inflige Decaimento em Inimigos que Amaldiçoar com Feitiços ou Habilidades de Marca, causando {0} de Dano de Caos por Segundo por {1} Segundo': ['ev:conjurarMaldicao:degenNoAlvo:degenCaos:10'],
    'Inflige Atrofia aos inimigos que já tenham pelo menos {0} envenenamentos ao atingir com esta arma': ['ev:acertar:alvo:definhado:2@alvoVenenos:10'],
    '{0}% de chance dos Envenenamentos inflingidos por esta Arma causarem {1}% mais Dano': ['veneno_mais_chance', 'veneno_mais_pct'],
    'Recuperação máxima aumentada em {0}% por roubo de vida para cada {1}% de vida reservada': ['roubo_teto_vida_inc%vidaReservada:10'],
  };
  for (const [texto, stats] of Object.entries(casos)) {
    const t = traduz(texto);
    assert.deepEqual(t.efeitos.map((x) => x.stat), stats, texto);
    assert.notEqual(t.estado, 'registrado', `${texto}: com efeito`);
  }
  assert.equal(traduz('Os Buffs das Suas Auras não afetam aliados').estado, 'lembrete', 'no jogo as auras já são só suas');
  assert.equal(traduz('Dano elemental aumentado em {0}% por {1}% de resistência a dano de fogo, frio ou elétrico acima de {2}%').efeitos.length, 9);
});

test('o Excomungado: posto pelo acerto corpo a corpo, não causa dano de Caos e leva mais crítico corpo a corpo', { skip: SEM }, () => {
  const e = comAf({ 'ev:acertar:alvo:excomungado:3@corpo': 100, 'crit_chance@corpo+alvoExcomungado': 2 });
  e.hunt = { clock: 1000, pos: { x: 0, y: 0 }, monstros: [] };
  const alvo = { uid: 'a', x: 1, y: 0, hp: 100, maxHp: 100, estados: {}, dots: [] };
  const f = Ficha.combate(e);
  ModsPoe.aoAcertar(e, e.hunt, alvo, { ...f, tagsDoGolpe: ['magia'] }, { dano: 10 });
  assert.equal(alvo.estados.excomungado, undefined, 'a magia não excomunga');
  ModsPoe.aoAcertar(e, e.hunt, alvo, { ...f, tagsDoGolpe: ['ataque', 'corpo'] }, { dano: 10 });
  assert.ok(alvo.estados.excomungado?.ate >= 4000, 'o golpe corpo a corpo, por 3 s');
  assert.ok(ModsPoe.tagsDoAlvo(alvo, 1000).includes('alvoExcomungado'));
  assert.equal(ModsPoe.semCaos(alvo, 1000), true);
  assert.equal(ModsPoe.semCaos(alvo, 5000), false, 'acabou');
  // O crítico a mais: só no corpo a corpo contra o excomungado.
  const g = (tags, a) => ModsPoe.fichaDoGolpe(f, tags, { alvo: a, estado: e }).critChance;
  const solto = { x: 1, y: 0, hp: 100, maxHp: 100, estados: {} };
  assert.ok(g(['ataque', 'corpo'], alvo) > g(['ataque', 'corpo'], solto), 'contra o excomungado, mais crítico');
});

test('o dreno de escudo por maldição, a Fúria Arcana no movimento e a recuperação do escudo a menos', { skip: SEM }, () => {
  const e = comAf({ energy_shield: 1000, es_leech_magia_por_maldicao: 2 });
  e.hunt = { clock: 1000 };
  Ficha.aplicarLeech(e, 100, [], 'x', { x: 0, y: 0 }, Ficha.combate(e), null, { ataque: false, danoVezesMaldicoes: 300 });
  const roubo = (e.hunt.roubos ?? []).find((r) => r.recurso === 'es');
  assert.ok(roubo && Math.abs(roubo.restante - 6) < 1e-9, `300 × 2% = 6 (${roubo?.restante})`);
  // A Fúria Arcana: +10% de Velocidade de Movimento enquanto ela está em você.
  const m = comAf({ 'move_speed@buff:furiaArcana': 10 });
  m.hunt = { clock: 1000 };
  const sem = Ficha.combate(m).afPoe.move_speed ?? 0;
  ModsPoe.ganharBuff(m.hunt, 'furiaArcana', 4);
  Ficha.invalidar(m);
  assert.equal((Ficha.combate(m).afPoe.move_speed ?? 0) - sem, 10);
  // A recuperação do escudo a menos: a regeneração pela metade.
  const regen = (af) => {
    const r = comAf({ energy_shield: 1000, es_regen: 100, ...af });
    const f = Ficha.combate(r);
    r.es = 0; r.hunt = { clock: 1000 };
    ModsPoe.tique(r, r.hunt, f, 1000);
    return r.es;
  };
  assert.equal(regen({ recuperacao_es_menos: 50 }), regen({}) / 2);
});

test('o dano pela mana gasta, o Decaimento de quem você amaldiçoa e a Atrofia nos envenenados', { skip: SEM }, () => {
  const e = comAf({ 'ev:gastarMana:danoPorMana': 50, 'ev:conjurarMaldicao:degenNoAlvo:degenCaos:2': 30, 'ev:acertar:alvo:definhado:2@alvoVenenos:3': 100 });
  e.hunt = { clock: 1000, pos: { x: 0, y: 0 }, monstros: [] };
  const f = Ficha.combate(e);
  e.hp = 500;
  ModsPoe.evento(e, e.hunt, 'gastarMana', f, { quantidade: 100 });
  assert.equal(e.hp, 450, '50% de 100 de mana');
  const alvo = { uid: 'a', x: 1, y: 0, hp: 1000, maxHp: 1000, estados: {}, dots: [] };
  ModsPoe.evento(e, e.hunt, 'conjurarMaldicao', f, { alvo });
  const decaimento = alvo.dots.find((d) => d.tipo === 'degenCaos');
  assert.ok(decaimento && Math.abs(decaimento.falta - 60) < 1e-9, `30 por segundo por 2 s (${decaimento?.falta})`);
  // A Atrofia: com 3 venenos, sim; com 2, não.
  const veneno = () => ({ tipo: 'venenoPoe', falta: 100, ate: 9000 });
  const dois = { uid: 'b', x: 1, y: 0, hp: 1000, maxHp: 1000, estados: {}, dots: [veneno(), veneno()] };
  ModsPoe.aoAcertar(e, e.hunt, dois, { ...f, tagsDoGolpe: ['ataque'] }, { dano: 10 });
  assert.equal(dois.estados.definhado, undefined);
  const tres = { uid: 'c', x: 1, y: 0, hp: 1000, maxHp: 1000, estados: {}, dots: [veneno(), veneno(), veneno()] };
  ModsPoe.aoAcertar(e, e.hunt, tres, { ...f, tagsDoGolpe: ['ataque'] }, { dano: 10 });
  assert.ok(tres.estados.definhado?.ate > 1000);
});

test('a Nebulis (dano elemental pela resistência que passa do máximo) e os venenos com mais dano', { skip: SEM }, () => {
  const linha = traduz('Dano elemental aumentado em {0}% por {1}% de resistência a dano de fogo, frio ou elétrico acima de {2}%');
  const af = Object.fromEntries(linha.efeitos.map((x) => [x.stat.replace(/:\d+$/, ':1'), 2]));
  const sem = Ficha.combate(comAf({ fire_res: 200 })).afPoe;
  const com = Ficha.combate(comAf({ fire_res: 200, ...af }));
  const excedente = com.excedentes?.protection?.fire ?? 0;
  assert.ok(excedente > 0, `Fogo acima do máximo: ${excedente}`);
  assert.equal((com.afPoe.ice_dmg ?? 0) - (sem.ice_dmg ?? 0), 2 * Math.floor(excedente), 'o Gelo também ganha, pelo Fogo que passou');
  // O veneno com X% de chance de Y% mais Dano.
  const veneno = (a) => {
    const alvo = { uid: 'a', hp: 1e6, maxHp: 1e6, estados: {}, dots: [] };
    Afeccoes.aoAcertar(alvo, [{ elemento: 'chaos', dano: 100 }], { afeccoes: Afeccoes.daSoma({ chance_poison: 100, ...a }), agora: 0, rng: () => 0 });
    return alvo.dots.find((d) => d.tipo === 'venenoPoe')?.falta ?? 0;
  };
  assert.ok(Math.abs(veneno({ veneno_mais_chance: 50, veneno_mais_pct: 100 }) / veneno({}) - 2) < 0.01);
});

test('lote B: as frases viram os atributos', { skip: SEM }, () => {
  const casos = {
    'Velocidade de Conjuração dos Inimigos Eletrizados por você reduzida em {0}%': ['eletrizados_conjuracao_lenta'],
    'Clamores Empurram e Interrompem Inimigos em uma pequena Área': ['ev:usarClamor:empurrarProximos'],
    'Clamores não instantâneos ignoram o tempo de recarga ao serem utilizados': ['clamor_sem_recarga'],
    '+{0}% de chance de Bloquear o Dano de Ataques de Projéteis': ['bloqueio_projetil'],
    'Armadura contra Projéteis aumentada em {0}%': ['armadura_projetil_inc'],
    'Acertos com esta Arma ganham {0}% de Dano Físico como Dano de Gelo ou Raio Extra': ['phys_as_extra_gelo_ou_raio'],
    'Adiciona {0} a {1} de Dano de Raio por cada Inimigo Eletrizado que você Matou Recentemente': ['added_energy_dmg_min%eletrizadosMortosRecente', 'added_energy_dmg_max%eletrizadosMortosRecente'],
  };
  for (const [texto, stats] of Object.entries(casos)) {
    const t = traduz(texto);
    assert.deepEqual(t.efeitos.map((x) => x.stat), stats, texto);
    assert.notEqual(t.estado, 'registrado', `${texto}: com efeito`);
  }
});

test('o eletrizado conjura mais devagar, o clamor sem recarga e o que empurra', { skip: SEM }, () => {
  const proxima = (af, chocado) => {
    const e = comAf(af);
    e.hp = e.maxHp;
    const h = { clock: 1000, pos: { x: 0, y: 0 }, monstros: [] };
    e.hunt = h;
    const i = Poderes.poderesDe('amazon').ataques.findIndex((a) => a.tipo === 'magia');
    const bicho = { key: 'amazon', uid: 'm', name: 'Amazon', x: 1, y: 0, hp: 100, maxHp: 100, estados: chocado ? { chocado: { ate: 9000, pct: 10 } } : {}, proximoPoder: { [i]: 0 } };
    h.monstros = [bicho];
    const rnd = Math.random;
    Math.random = () => 0.99; // a magia não sai (a chance falha): só a próxima hora
    try { Poderes.lancar(e, h, PERSONAGEM, bicho, [], 1000, Ficha.combate(e), false); } finally { Math.random = rnd; }
    return bicho.proximoPoder[i] - 1000;
  };
  const normal = proxima({ eletrizados_conjuracao_lenta: 50 }, false);
  assert.ok(normal > 0, `intervalo ${normal}`);
  assert.equal(proxima({ eletrizados_conjuracao_lenta: 50 }, true), normal * 2, 'eletrizado: o dobro do tempo');
  assert.equal(proxima({}, true), normal, 'sem o mod: igual');
  // "Clamores não instantâneos ignoram o tempo de recarga".
  const grito = GP.doSlug('Enduring_Cry') && Acoes.POR_ID_PUBLICO(GP.doSlug('Enduring_Cry').acao);
  if (grito) {
    assert.ok(Acoes.temposDaGemaPoe(comAf({}), grito).recarga > 0);
    assert.equal(Acoes.temposDaGemaPoe(comAf({ clamor_sem_recarga: 1 }), grito).recarga, 0);
  }
  // "Clamores Empurram … em uma pequena Área": quem está a até 2 casas vai uma casa para longe.
  const c = comAf({ 'ev:usarClamor:empurrarProximos': 100 });
  const perto = { uid: 'p', x: 1, y: 0, hp: 10, estados: {} };
  const longe = { uid: 'l', x: 5, y: 0, hp: 10, estados: {} };
  c.hunt = { clock: 0, pos: { x: 0, y: 0 }, monstros: [perto, longe] };
  ModsPoe.definirFichaDaCacada(c.hunt, () => Ficha.combate(c));
  ModsPoe.evento(c, c.hunt, 'usarClamor', Ficha.combate(c), {});
  assert.equal(perto.x, 2);
  assert.equal(longe.x, 5);
});

test('o Físico como Gelo ou Raio extra e o Raio a mais por eletrizado morto recentemente', { skip: SEM }, () => {
  const f = Ficha.combate(comAf({ phys_as_extra_gelo_ou_raio: 20 }));
  assert.deepEqual(Object.keys(ModsPoe.extrasDoFisico(f, 100, () => 0.1).extras), ['ice']);
  assert.deepEqual(Object.keys(ModsPoe.extrasDoFisico(f, 100, () => 0.9).extras), ['energy']);
  assert.deepEqual(ModsPoe.extrasDoFisico(f, 100, () => 0.9).extras.energy, [20, 20]);
  const e = comAf({ 'added_energy_dmg_min%eletrizadosMortosRecente': 5, 'added_energy_dmg_max%eletrizadosMortosRecente': 10 });
  e.hunt = { clock: 10_000, poeEletrizadosMortos: [9000, 9500, 1000] };
  Ficha.invalidar(e);
  assert.deepEqual(Ficha.combate(e).danoSomado.energy, [10, 20], 'dois nos últimos 4 s');
});

test('lote C: as frases viram os atributos', { skip: SEM }, () => {
  const casos = {
    '{0}% de chance de ganhar uma Carga de Tolerâncio ao Acertar um Inimigo sem Armadura': ['ev:acertar:carga:tolerancia@alvoSemArmadura'],
    '{0}% de chance de ganhar uma Carga de Frenesi ao Acertar um Inimigo sem Evasão': ['ev:acertar:carga:frenesi@alvoSemEvasao'],
    '{0}% de chance de ganhar uma Carga de Poder se Empurrar um Inimigo com Dano Corpo a Corpo': ['ev:empurrar:carga:poder@corpo'],
    'Combatente Versátil': ['block_max', 'spell_block_max', 'bloqueio_magico_por_excedente'],
    'O Bônus de Dano da Força concede {0}% de aumento do Dano Físoc Corpo a Corpo por cada {1} de Força': ['forca_dano_pct', 'forca_dano_cada'],
  };
  for (const [texto, stats] of Object.entries(casos)) {
    const t = traduz(texto);
    assert.deepEqual(t.efeitos.map((x) => x.stat), stats, texto);
    assert.notEqual(t.estado, 'registrado', `${texto}: com efeito`);
  }
});

test('o inimigo sem Armadura / sem Evasão (as defesas do bestiário) e a carga ao empurrar corpo a corpo', { skip: SEM }, () => {
  const tags = (m) => ModsPoe.tagsDoAlvo({ hp: 10, estados: {}, ...m }, 0);
  assert.ok(tags({ key: 'poe-hillock-1' }).includes('alvoSemEvasao'), 'o Hillock não tem evasão');
  assert.ok(!tags({ key: 'poe-hillock-1' }).includes('alvoSemArmadura'), 'mas tem armadura');
  assert.ok(!tags({ key: 'poe-quru-22' }).includes('alvoSemEvasao'));
  assert.ok(tags({ key: 'poe-hillock-1', armaduraPct: -100 }).includes('alvoSemArmadura'), 'a armadura zerada');
  // A Carga de Poder ao empurrar com o golpe corpo a corpo.
  const e = comAf({ chance_empurrar: 100, 'ev:empurrar:carga:poder@corpo': 100 });
  e.hunt = { clock: 1000, pos: { x: 0, y: 0 }, monstros: [] };
  const alvo = { uid: 'a', x: 1, y: 0, hp: 100, maxHp: 100, estados: {}, dots: [] };
  const f = Ficha.combate(e);
  ModsPoe.aoAcertar(e, e.hunt, alvo, { ...f, tagsDoGolpe: ['ataque', 'projetil'] }, { dano: 10, mover: () => true });
  assert.equal(e.hunt.cargasPoe?.poder, undefined, 'o projétil não conta');
  ModsPoe.aoAcertar(e, e.hunt, alvo, { ...f, tagsDoGolpe: ['ataque', 'corpo'] }, { dano: 10, mover: () => true });
  assert.equal(e.hunt.cargasPoe?.poder?.n, 1);
  ModsPoe.aoAcertar(e, e.hunt, alvo, { ...f, tagsDoGolpe: ['ataque', 'corpo'] }, { dano: 10, mover: () => false });
  assert.equal(e.hunt.cargasPoe?.poder?.n, 1, 'sem empurrar: nada');
});

test('o Combatente Versátil (o bloqueio de ataque excedente vira bloqueio mágico) e o bônus da Força da Fortaleza de Ferro', { skip: SEM }, () => {
  const sem = Ficha.combate(comAf({ block: 90 }));
  const com = Ficha.combate(comAf({ block: 90, block_max: -10, spell_block_max: -10, bloqueio_magico_por_excedente: 2 }));
  assert.ok(com.blockChance < sem.blockChance, `o teto do bloqueio de ataque menor (${com.blockChance} × ${sem.blockChance})`);
  assert.equal(sem.bloqueioDeMagia, 0);
  assert.ok(com.bloqueioDeMagia > 0, `o excedente vira bloqueio mágico (${com.bloqueioDeMagia})`);
  assert.ok(Math.abs(com.bloqueioDeMagia - Math.min(com.bloqueioExcedente * 2, 0.65)) < 1e-9);
  // A Força: 3% a cada 10 (no lugar do bônus de sempre).
  const e = comAf({ forca_dano_pct: 3, forca_dano_cada: 10 });
  const f = Ficha.combate(e);
  assert.equal(f.danoFisicoDaForca, Math.floor(f.atributos.str / 10) * 3);
});

test('lote D: as redações novas da auditoria viram os atributos', { skip: SEM }, () => {
  const casos = {
    'Receba {0}% do Dano de Raio como Dano de Gelo Extra': ['energy_as_extra_ice'],
    'Receba {0}% do Dano de Fogo como Dano de Caos Extra': ['fire_as_extra_chaos'],
    'Eficiência de custo de mana aumentada em {0}% por carga de tolerância': ['eficiencia_custo_mana%carga:tolerancia'],
    'Eficiência de custo de mana de habilidades de lacaio aumentada em {0}%': ['eficiencia_custo_mana@lacaio'],
    'Lacaios convertem {0}% do dano físico em dano de fogo por gema vermelha encaixada': ['minion_conv_fire%gemaLocal:R'],
    'Lacaios convertem {0}% do dano físico em dano de caos por encaixe vazio': ['minion_conv_chaos%encaixeVazioLocal'],
    'Área de efeito aumentada em {0}% por encaixe vermelho': ['area_inc%encaixeLocal:R'],
    'Defesas globais aumentadas em {0}% por encaixe vazio': ['armour_pct%encaixeVazioLocal', 'evasion_pct%encaixeVazioLocal', 'es_pct%encaixeVazioLocal'],
    'Aumentos e reduções à sua evasão também se aplicam ao seu dano mágico': ['evasao_no_dano_magico'],
    'Redução de dano físico é zero': ['reducao_fisica_zero'],
    'Duração do Totem aumentada em {0}%': ['lacaio_duracao:totem'],
    '+{0}% de Multiplicador de Dano Degenerativoto para Incêndio dos Golpes Críticos': ['dot_multi_ignite_critico'],
  };
  for (const [texto, stats] of Object.entries(casos)) {
    const t = traduz(texto);
    assert.deepEqual(t.efeitos.map((x) => x.stat), stats, texto);
    assert.notEqual(t.estado, 'registrado', `${texto}: com efeito`);
  }
});

test('lote D: por gema encaixada e por encaixe vazio da peça, o Fogo como Caos extra, a redução física zero, a evasão no Dano Mágico e o Incêndio crítico', { skip: SEM }, () => {
  const luvas = { id: 9, soquetes: { abertos: 3, cores: ['R', 'R', 'B'], gemas: [{ id: 1 }, null, null] }, poe: { af: { 'minion_conv_fire%gemaLocal:R': 10, 'minion_conv_chaos%encaixeVazioLocal': 5 } } };
  const soma = Afixos.somaDeItens({ equipment: { gloves: luvas } });
  assert.equal(soma.minion_conv_fire, 10, 'um encaixe vermelho com gema');
  assert.equal(soma.minion_conv_chaos, 10, 'dois encaixes vazios');
  const f = Ficha.combate(comAf({ fire_as_extra_chaos: 50 }));
  assert.deepEqual(ModsPoe.transformarPartes(f, { fire: [100, 100] }).chaos, [50, 50]);
  assert.equal(ModsPoe.fracaoFisicaRecebida(Ficha.combate(comAf({ reducao_fisica_zero: 1 })), 100, 5000), 1, 'a armadura não corta');
  assert.ok(ModsPoe.fracaoFisicaRecebida(Ficha.combate(comAf({})), 100, 5000) < 1);
  const sem = Ficha.combate(comAf({ evasion_pct: 80 })).afPoe;
  const com = Ficha.combate(comAf({ evasion_pct: 80, evasao_no_dano_magico: 100 })).afPoe;
  assert.equal((com.spell_dmg ?? 0) - (sem.spell_dmg ?? 0), 80);
  const queima = (af, crit) => {
    const alvo = { uid: 'a', hp: 1e6, maxHp: 1e6, estados: {}, dots: [] };
    Afeccoes.aoAcertar(alvo, [{ elemento: 'fire', dano: 100 }], { afeccoes: Afeccoes.daSoma({ chance_ignite: 100, ...af }), crit, agora: 0, rng: () => 0 });
    return alvo.dots.find((d) => d.tipo === 'queimadura')?.falta ?? 0;
  };
  assert.ok(queima({ dot_multi_ignite_critico: 50 }, true) > queima({}, true), 'no crítico, mais');
  assert.equal(queima({ dot_multi_ignite_critico: 50 }, false), queima({}, false), 'fora do crítico, igual');
});

test('lote E: as Cargas de Salmoura (no lugar da Tolerância, até o máximo dela, 4% do Físico como Gelo e Raio extras cada) e o tempo de ataque dos lacaios', { skip: SEM }, () => {
  const linha = traduz('{0}% de chance de ganhar {1} carga de salmoura em vez de {2} carga de tolerância');
  assert.deepEqual(linha.efeitos.map((x) => x.stat), ['salmoura_chance', 'phys_as_extra_ice%carga:salmoura', 'phys_as_extra_energy%carga:salmoura']);
  assert.deepEqual(traduz('Tempo de ataque base dos lacaios não espectrais é equivalente ao tempo de ataque da arma da sua mão principal').efeitos.map((x) => x.stat), ['lacaio_tempo_da_arma']);
  const e = comAf({ salmoura_chance: 100, 'phys_as_extra_ice%carga:salmoura': 4, 'phys_as_extra_energy%carga:salmoura': 4 });
  e.hunt = { clock: 0 };
  const regras = Ficha.combate(e).cargas;
  for (let i = 0; i < 5; i++) CargasPoe.ganhar(e, 'tolerancia', regras);
  assert.equal(e.hunt.cargasPoe.tolerancia, undefined, 'no lugar da Tolerância');
  assert.equal(e.hunt.cargasPoe.salmoura.n, CargasPoe.maximo(regras, 'tolerancia'), 'até o máximo de Tolerância');
  Ficha.invalidar(e);
  const af = Ficha.combate(e).afPoe;
  assert.equal(af.phys_as_extra_ice, 4 * e.hunt.cargasPoe.salmoura.n);
  assert.equal(af.phys_as_extra_energy, 4 * e.hunt.cargasPoe.salmoura.n);
  // Vencem como as outras.
  e.hunt.clock = 60_000;
  CargasPoe.tique(e, regras);
  assert.equal(e.hunt.cargasPoe.salmoura, undefined);
});

test('trava contra regressão: as linhas de armas, armaduras e amuletos únicos que não funcionam não voltam a subir (rodada 9)', { skip: SEM }, () => {
  const ARMAS = /One_Hand|Two_Hand|Thrusting|Sceptres|Staves|Warstaves|Claws|Daggers|Rune_Daggers|Bows|Wands/;
  const OUTRAS = /Body_Armours|Helmets|Gloves|Boots|Shields|Quivers|Amulets/;
  const d = Pendencias.pendencias();
  const ruins = d.linhas.filter((l) => l.origem === 'unico' && l.classes.some((c) => ARMAS.test(c) || OUTRAS.test(c)) && ['pendente', 'inexiste'].includes(l.estado));
  assert.ok(ruins.length <= 559, `${ruins.length} linhas sem funcionar (eram 584 antes da rodada 9)`);
});
