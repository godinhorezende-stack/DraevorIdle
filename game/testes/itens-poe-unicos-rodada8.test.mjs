// Os MODIFICADORES DOS ÚNICOS — rodada 8: armas, armaduras e amuletos (dono, 11/10: "quero tentar resolver todos os modificadores únicos";
// "seguir nas avulsas"). As KEYSTONES que só os únicos dão, pelos textos de lembrete do poedb: o Mago de Batalha (o dano da arma nas magias),
// a Fúria (o Rampage: o contador de abates, os bônus a cada 20, as faixas — "na Fúria", "quando Enfurecido"), a Ambição Imortal (o escudo que
// começa do zero, não recarrega nem regenera, perde 5% por segundo e recebe o dreno de vida com a vida cheia), a Convicção Interior (Poder no
// lugar do Frenesi, 3% mais Dano Mágico por Poder), as Transfigurações e O Agnóstico. E a Nuvem de Fumaça dos eventos, que passa a cegar.
// Lote B: a armadura contra Raio e Caos, as Resistências Elementais aumentadas, o "só pode Matar Congelados/Incendiados", o gatilho pela
// mana gasta (a Sede de Kitava), a Marca do Assassino só sem Marca e o Disfarce do Doppelgänger (sempre São). Lote C: o Tiro Distante e o
// Queima-Roupa (pela distância), o "Não pode Empurrar", os Incêndios (mais dano, espalhados), o Congelamento em Resfriados, o Sacrifício
// Eterno, o Sangramento em Caos e o Caos degenerativo que cura enquanto drena.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';

const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no jogo oficial (PoE)';
const { personagemDeTeste } = await import('./apoio.mjs');
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const Gerar = await import('../systems/itens-poe/gerar.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const CargasPoe = await import('../systems/itens-poe/cargas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Pendencias = await import('../admin/itens-poe-pendencias.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const GP = await import('../systems/itens-poe/gemas-poe.mjs');
const { PERSONAGEM } = await import('./apoio.mjs');
const Afeccoes = await import('../systems/itens-poe/afeccoes.mjs');
const Mecanicas = await import('../systems/mobs/mecanicas.mjs');
const Acoes = await import('../systems/acoes.mjs');
const Registro = await import('../systems/combate/registro.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  Jogo.iniciar(ITEM_CATALOG);
}

const traduz = (texto) => T.traduzirParte(texto, (texto.match(/\{(\d+)\}/g) ?? []).map(() => 10));
function comAf(af, extra = {}) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 90 });
  e.equipment = { ring: { id: 1, poe: { af } }, ...extra };
  Ficha.invalidar(e);
  return e;
}

test('as keystones dos únicos e as linhas da Fúria viram os atributos', { skip: SEM }, () => {
  const casos = {
    'Mago de Batalha': ['magia_dano_da_arma'],
    'Fúria': ['rampage'],
    'Ambição Imortal': ['es_comeca_zero', 'sem_recarga_es', 'sem_regen_es', 'perde_es_pct_s', 'roubo_vida_nao_para_no_cheio', 'dreno_vida_no_es_cheio'],
    'Convicção Interior': ['mais_dano%carga:poder@magia', 'frenesi_vira_poder'],
    'Transfiguração da Alma': ['transf_es_magia'],
    'Transfiguração do Corpo': ['transf_vida_ataque'],
    'Transfiguração da Mente': ['transf_mana_dano'],
    'O Agnóstico': ['sem_escudo', 'mana_vira_vida_pct_s'],
    'Raridade de Itens encontrados aumentada em {0}% a cada {1} Mortes de Fúria': ['item_rarity%rampage:10'],
    'Recebe uma Carga de Frenesi a cada {0} Mortes com Fúria': ['rampage_frenesi_cada'],
    'Acertos Corpo a Corpo contam como Mortes com Fúria': ['rampage_acerto_corpo'],
    'Ganha Fúria quando no Máximo de Cargas de Tolerância': ['rampage@cargasMax:tolerancia'],
    'Recupera {0}% de Vida na Fúria': ['ev:rampage:vidaPct'],
    'Ganha Imunidade a Dano Físico durante {0} segundos quando Enfurecido': ['ev:rampage:buff:imunidadeFisica'],
    'Cria uma Nuvem de Fumaça quando Enfurecido': ['ev:rampage:fumaca'],
  };
  for (const [texto, stats] of Object.entries(casos)) {
    const t = traduz(texto);
    assert.deepEqual(t.efeitos.map((x) => x.stat), stats, texto);
    assert.notEqual(t.estado, 'registrado', `${texto}: com efeito`);
  }
});

test('a Fúria (o Rampage): o contador de abates, +2% de Dano e +1% de Movimento a cada 20 (sem dobrar), as faixas e o fim', { skip: SEM }, () => {
  const e = comAf({ rampage: 1, 'ev:rampage:vidaPct': 10, rampage_perde_tolerancia: 1 }, { amulet: { id: 2, poe: { af: { rampage: 1 } } } });
  e.hunt = { clock: 1000, pos: { x: 0, y: 0 }, monstros: [] };
  const base = Ficha.combate(e).afPoe;
  e.hp = 100;
  for (let i = 0; i < 20; i++) if (ModsPoe.contarRampage(e, e.hunt, Ficha.combate(e))) Ficha.invalidar(e);
  assert.equal(e.hunt.rampage.n, 20);
  const com = Ficha.combate(e).afPoe;
  assert.equal(com.dmg_inc - (base.dmg_inc ?? 0), 2, '+2% de Dano (duas peças com a keystone: não dobra)');
  assert.equal(com.move_speed - (base.move_speed ?? 0), 1, '+1% de Velocidade de Movimento');
  // A faixa dos 15 abates: o "Recupera 10% de Vida na Fúria".
  assert.ok(e.hp > 100, `a vida recuperada na faixa (${e.hp})`);
  // 5 s sem matar: a Fúria termina — o contador zera e as Cargas de Tolerância vão embora.
  e.hunt.cargasPoe = { tolerancia: { n: 3, ate: 99_000 } };
  e.hunt.clock += 5001;
  ModsPoe.tique(e, e.hunt, Ficha.combate(e), 100);
  assert.equal(e.hunt.rampage, undefined);
  assert.equal(e.hunt.cargasPoe.tolerancia, undefined);
  assert.equal(e.hunt.poeFichaMudou, true, 'a ficha é refeita (os bônus saem)');
  // Sem a keystone, o abate não conta.
  const sem = comAf({});
  sem.hunt = { clock: 0 };
  assert.equal(ModsPoe.contarRampage(sem, sem.hunt, Ficha.combate(sem)), false);
  assert.equal(sem.hunt.rampage, undefined);
});

test('a Convicção Interior: Poder no lugar do Frenesi', { skip: SEM }, () => {
  const e = comAf({});
  e.hunt = { clock: 0 };
  CargasPoe.ganhar(e, 'frenesi', { frenesi_vira_poder: 1 });
  assert.equal(e.hunt.cargasPoe.poder?.n, 1);
  assert.equal(e.hunt.cargasPoe.frenesi, undefined);
});

test('as Transfigurações: os aumentos de Escudo, Vida e Mana também no dano, em 30%', { skip: SEM }, () => {
  const base = Ficha.combate(comAf({ es_pct: 100, life_inc: 50, mana_inc: 40 })).afPoe;
  const f = Ficha.combate(comAf({ es_pct: 100, life_inc: 50, mana_inc: 40, transf_es_magia: 30, transf_vida_ataque: 30, transf_mana_dano: 30 })).afPoe;
  assert.equal((f.spell_dmg ?? 0) - (base.spell_dmg ?? 0), 30);
  assert.equal((f['dmg_inc@ataque'] ?? 0) - (base['dmg_inc@ataque'] ?? 0), 15);
  assert.equal((f.dmg_inc ?? 0) - (base.dmg_inc ?? 0), 12);
});

test('o Mago de Batalha: o dano da arma da mão principal somado às magias', { skip: SEM }, () => {
  const arma = Jogo.pecaDoJogo(Gerar.gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'One_Hand_Swords/Rusted_Sword', raridade: 'normal', ilvl: 1, rng: () => 0.5 }));
  const sem = Ficha.combate(comAf({}, { weapon: arma }));
  const com = Ficha.combate(comAf({ magia_dano_da_arma: 1 }, { weapon: arma }));
  const fisico = com.danoSomadoMagia.physical;
  assert.ok(fisico?.[1] > 0, `a faixa física da arma nas magias (${JSON.stringify(com.danoSomadoMagia)})`);
  assert.deepEqual(fisico, [com.arma.danoMin, com.arma.danoMax]);
  assert.equal(sem.danoSomadoMagia.physical, undefined);
});

test('a Ambição Imortal: o dreno de vida vai para o escudo com a vida cheia; o escudo não regenera', { skip: SEM }, () => {
  const e = comAf({ energy_shield: 200, roubo_vida_nao_para_no_cheio: 1, dreno_vida_no_es_cheio: 1, sem_regen_es: 1, es_regen: 50 });
  const f = Ficha.combate(e);
  e.hp = e.maxHp;
  e.es = 10;
  e.hunt = { clock: 1000, roubos: [{ recurso: 'vida', restante: 50, porSegundo: 50 }] };
  Ficha.recuperarRoubo(e, 1000);
  assert.equal(e.hp, e.maxHp);
  assert.ok(e.es > 10, `o escudo recebeu o dreno (${e.es})`);
  const es = e.es;
  e.hunt.roubos = [];
  ModsPoe.tique(e, e.hunt, f, 1000);
  assert.equal(e.es, es, 'sem regenerar');
});

test('O Agnóstico: fora da vida cheia, 20% da mana por segundo viram vida', { skip: SEM }, () => {
  const e = comAf({ mana_vira_vida_pct_s: 20 });
  const f = Ficha.combate(e);
  e.maxMana = 500; e.mana = 500; e.hp = Math.max(1, e.maxHp - 300);
  e.hunt = { clock: 1000 };
  const hp = e.hp;
  ModsPoe.tique(e, e.hunt, f, 1000);
  assert.equal(e.hp - hp, 100);
  assert.equal(e.mana, 400);
  // Na vida cheia, nada.
  e.hp = e.maxHp;
  ModsPoe.tique(e, e.hunt, f, 1000);
  assert.equal(e.mana, 400);
});

test('a Nuvem de Fumaça dos eventos cega quem está em volta', { skip: SEM }, () => {
  const e = comAf({ 'ev:serAcertado:fumaca': 100 });
  const perto = { uid: 'p', x: 1, y: 0, hp: 10, estados: {} };
  const longe = { uid: 'l', x: 9, y: 0, hp: 10, estados: {} };
  e.hunt = { clock: 1000, pos: { x: 0, y: 0 }, monstros: [perto, longe] };
  ModsPoe.evento(e, e.hunt, 'serAcertado', Ficha.combate(e), {});
  assert.ok(perto.estados.cego?.ate > 1000, 'o de perto, cego');
  assert.equal(longe.estados.cego, undefined);
});

test('lote B: as frases viram os atributos', { skip: SEM }, () => {
  const casos = {
    'Armadura também se aplica ao Dano de Caos sofrido de Acertos': ['armadura_no_chaos'],
    'Armadura também é aplicada no Dano de Raio sofrido de Acertos': ['armadura_no_energy'],
    'Resistências Elementais aumentadas em {0}%': ['res_elemental_inc'],
    'Seus Acertos só podem Matar Inimigos Congelados': ['so_mata_congelados'],
    'Acertos de Lacaios só podem Matar Inimigos Incendiados': ['lacaio_so_mata_incendiados'],
    '{0}% de ativar Magias Encaixadas quando você Gastar ao menos {1} de Mana em um Custo Direto para Usar ou Ativar uma Habilidade, com {2} segundo de Recarga': ['gatilho_local:gastarMana:magia', 'gatilho_chance_local', 'gatilho_mana_min_local', 'gatilho_recarga_local'],
    'Ativa Chuva de Flexas Nível {0} quando Atacar com um Arco': ['ev:usarAtaque:gatilho:chuva-de-flechas@comArco'],
    'Ativa Marca do Assassino Nível {0} quando você Acertar um Inimigo Raro ou Único e não tiver Marca': ['ev:acertar:gatilho:marca-do-assassino@alvoRaro+semMarca', 'ev:acertar:gatilho:marca-do-assassino@alvoUnico+semMarca'],
    '{0}% menos Dano Físico e de Caos sofrido enquanto São': ['dano_physical_recebido_mais', 'dano_chaos_recebido_mais'],
    'Regenera {0}% de Vida por um segundo quando Acertado enquanto São': ['ev:serAcertado:vidaPct'],
  };
  for (const [texto, stats] of Object.entries(casos)) {
    const t = traduz(texto);
    assert.deepEqual(t.efeitos.map((x) => x.stat), stats, texto);
    assert.notEqual(t.estado, 'registrado', `${texto}: com efeito`);
  }
  assert.equal(traduz('{0}% mais Chance de Golpe Crítico enquanto Insano').estado, 'inerte', 'sem o Perturbar, nunca Insano');
});

test('a armadura contra Raio e Caos, as Resistências Elementais aumentadas e o "menos" de um tipo de dano', { skip: SEM }, () => {
  const f = Ficha.combate(comAf({ armadura_no_chaos: 1, armor_flat: 2000 }));
  assert.ok(f.armor >= 2000);
  const fator = ModsPoe.armaduraNoElemento(f, 'chaos', 200);
  assert.ok(fator < 1 && fator > 0, `a armadura corta o golpe de Caos (${fator})`);
  assert.equal(ModsPoe.armaduraNoElemento(f, 'energy', 200), 1, 'o Raio, não (sem o mod dele)');
  assert.equal(ModsPoe.armaduraNoElemento(Ficha.combate(comAf({ armor_flat: 2000 })), 'chaos', 200), 1, 'sem o mod: nada');
  // Resistências aumentadas: o total (com a penalidade da campanha) × 1,2, até o máximo.
  const sem = Ficha.combate(comAf({ fire_res: 90, chaos_res: 90 })).protection;
  const com = Ficha.combate(comAf({ fire_res: 90, chaos_res: 90, res_elemental_inc: 20 })).protection;
  assert.ok(Math.abs(com.fire - Math.min(75, sem.fire * 1.2)) < 1e-9, `Fogo: ${sem.fire} → ${com.fire}`);
  assert.equal(com.chaos, sem.chaos, 'o Caos não é elemental');
  // O Disfarce do Doppelgänger: "30% menos Dano Físico e de Caos sofrido enquanto São" (sempre São).
  const sao = Ficha.combate(comAf({ dano_physical_recebido_mais: -30, dano_chaos_recebido_mais: -30 }));
  const base = Ficha.combate(comAf({}));
  assert.ok(Math.abs(ModsPoe.fatorDoDanoRecebido(sao, 'physical') / ModsPoe.fatorDoDanoRecebido(base, 'physical') - 0.7) < 1e-9);
  assert.ok(Math.abs(ModsPoe.fatorDoDanoRecebido(sao, 'chaos') / ModsPoe.fatorDoDanoRecebido(base, 'chaos') - 0.7) < 1e-9);
  assert.equal(ModsPoe.fatorDoDanoRecebido(sao, 'fire'), ModsPoe.fatorDoDanoRecebido(base, 'fire'));
});

test('"Seus Acertos só podem Matar Inimigos Congelados" (menos os chefes, que não congelam) e "Acertos de Lacaios só … Incendiados"', { skip: SEM }, () => {
  const f = Ficha.combate(comAf({ so_mata_congelados: 1, lacaio_so_mata_incendiados: 1 }));
  const hunt = { clock: 1000 };
  const solto = { hp: -5, estados: {} };
  ModsPoe.poupar(f, hunt, solto);
  assert.equal(solto.hp, 1, 'não congelado: fica com 1');
  const congelado = { hp: -5, estados: { congelado: { ate: 2000 } } };
  ModsPoe.poupar(f, hunt, congelado);
  assert.equal(congelado.hp, -5, 'congelado: morre');
  const chefe = { hp: -5, boss: true, estados: {} };
  ModsPoe.poupar(f, hunt, chefe);
  assert.equal(chefe.hp, -5, 'o chefe não congela no jogo: morre');
  const doLacaio = { hp: -5, estados: {}, dots: [] };
  ModsPoe.poupar(f, hunt, doLacaio, { lacaio: true });
  assert.equal(doLacaio.hp, 1, 'o lacaio: só o Incendiado');
  const incendiado = { hp: -5, estados: {}, dots: [{ tipo: 'queimadura', falta: 10 }] };
  ModsPoe.poupar(f, hunt, incendiado, { lacaio: true });
  assert.equal(incendiado.hp, -5);
  const semMod = { hp: -5, estados: {} };
  ModsPoe.poupar(Ficha.combate(comAf({})), hunt, semMod);
  assert.equal(semMod.hp, -5, 'sem o mod: morre');
});

test('"não tiver Marca" (`semMarca`) e o gatilho pela mana gasta (a Sede de Kitava: o mínimo de mana e a chance)', { skip: SEM }, () => {
  const e = comAf({});
  e.hunt = { clock: 1000, monstros: [{ hp: 10, maldicoes: {} }] };
  assert.ok(ModsPoe.condicoesDe(e, Ficha.combate(e).afPoe).has('semMarca'));
  e.hunt.monstros[0].maldicoes = { x: { marca: true, ate: 5000 } };
  assert.ok(!ModsPoe.condicoesDe(e, Ficha.combate(e).afPoe).has('semMarca'), 'um inimigo com a sua Marca');
  if (!GP.doSlug('Fireball')) return; // (sem a coleção de gemas nesta máquina)
  const k = personagemDeTeste({ vocacao: 'sorcerer', level: 40 });
  k.classePoe = 'Witch';
  const elmo = Jogo.pecaDoJogo(Gerar.gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Helmets/Iron_Hat', raridade: 'normal', ilvl: 20, rng: () => 0.99 }));
  elmo.poe.af = { ...(elmo.poe.af ?? {}), 'gatilho_local:gastarMana:magia': 0, gatilho_chance_local: 100, gatilho_mana_min_local: 100, gatilho_recarga_local: 0.1 };
  elmo.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
  k.equipment = { ...(k.equipment ?? {}), head: elmo };
  k.inventory = [GS.itemDaGema({ id: GP.doSlug('Fireball').itemId, nivel: 10, xp: 0, raridade: 'comum' })];
  GS.encaixar(k, { de: 0, slot: 'head', indice: 0 });
  Ficha.invalidar(k); Afixos.sincronizarMaximos(k); k.mana = k.maxMana = 99999;
  Cacadas.entrar(k, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' });
  const bicho = k.hunt.monstros.find((b) => b.hp > 0);
  k.hunt.pos = { ...k.hunt.pos, x: bicho.x + 1, y: bicho.y };
  const gastar = (quantidade) => {
    const ev = [];
    ModsPoe.evento(k, k.hunt, 'gastarMana', Ficha.combate(k), { quantidade, personagem: PERSONAGEM, eventos: ev });
    return ev.filter((x) => x.t === 'gatilho').length;
  };
  assert.equal(gastar(50), 0, 'menos de 100 de mana: nada');
  assert.equal(gastar(120), 1, '100 ou mais: a magia encaixada sai');
  assert.equal(gastar(120), 0, 'na recarga');
});

test('lote C: as frases viram os atributos', { skip: SEM }, () => {
  const casos = {
    'Tiro Distante': ['tiro_distante'], 'Queima Roupa': ['queima_roupa'],
    'O Dano de Raio dos Inimigos Acertando você é Sortudo': ['dano_raio_recebido_sortudo'],
    'Não pode Empurrar Inimigos': ['sem_empurrao'],
    'A cada {0} segundos, receba Avatar de Fogo a cada {1} segundos': ['buff_periodico:avatarDoFogo:10'],
    '+{0} de Armadura enquanto você não tiver Avatar do Fogo': ['armor_flat@semBuff:avatarDoFogo'],
    'Incêndios infligidos com esta Arma causam {0}% mais Dano': ['incendio_mais'],
    'ㅤ{0}% de duração dos seus incêndios': ['duracao_incendio'],
    'Incêndios infligidos por você com esta arma se alastram para outros inimigos em até {0} metros': ['ev:incendiar:espalhar:incendioRaio'],
    'Congela Inimigos Resfriados como se causasse {0}% mais Dano': ['duracao_congelamento@alvoResfriado'],
    'Sacrifício Eterno': ['sacrificio_eterno'],
    'Você sofre Dano de Caos ao invés de Dano Físico do Sangramento': ['sangramento_em_caos'],
    'Sofrer Dano de Caos Degenerativo te cura ao invés enquanto Drenando Vida': ['caos_degen_cura_drenando'],
  };
  for (const [texto, stats] of Object.entries(casos)) {
    const t = traduz(texto);
    assert.deepEqual(t.efeitos.map((x) => x.stat), stats, texto);
    assert.notEqual(t.estado, 'registrado', `${texto}: com efeito`);
  }
});

test('o Tiro Distante e o Queima-Roupa: o dano do projétil de ataque pela distância (a tabela da wiki; 1 casa = 20 unidades)', { skip: SEM }, () => {
  const fator = (af, casas, tags = ['ataque', 'projetil']) => {
    const e = comAf(af);
    e.hunt = { clock: 0, pos: { x: 0, y: 0 } };
    const f = Ficha.combate(e);
    const g = ModsPoe.fichaDoGolpe(f, tags, { alvo: { x: casas, y: 0, hp: 100, maxHp: 100, estados: {} }, estado: e, rng: () => 0.99 });
    return (g.fatorDasCargas ?? 1) / (f.fatorDasCargas ?? 1);
  };
  const perto = (a, b) => Math.abs(a - b) < 1e-9;
  assert.ok(perto(fator({ tiro_distante: 1 }, 0), 0.8), 'colado: 20% menos');
  assert.ok(perto(fator({ tiro_distante: 1 }, 2), 1.2 + (5 / 35) * 0.4), '40 unidades');
  assert.ok(perto(fator({ tiro_distante: 1 }, 4), 1.6), 'de 70 em diante: 60% mais');
  assert.ok(perto(fator({ queima_roupa: 1 }, 0), 1.3));
  assert.ok(perto(fator({ queima_roupa: 1 }, 8), 0.7));
  assert.ok(perto(fator({ tiro_distante: 1, queima_roupa: 1 }, 0), 0.8 * 1.3), 'as duas multiplicam');
  assert.equal(fator({ tiro_distante: 1 }, 4, ['magia', 'projetil']), 1, 'magia: não');
  assert.equal(fator({ tiro_distante: 1 }, 4, ['ataque', 'corpo']), 1, 'corpo a corpo: não');
});

test('"Não pode Empurrar Inimigos", os Incêndios (mais dano, espalhados) e o Congelamento mais longo em Resfriados', { skip: SEM }, () => {
  const e = comAf({ sem_empurrao: 1 });
  e.hunt = { clock: 0, pos: { x: 0, y: 0 }, monstros: [] };
  ModsPoe.definirFichaDaCacada(e.hunt, () => Ficha.combate(e));
  const bicho = { x: 1, y: 0, hp: 10 };
  e.hunt.monstros = [bicho];
  assert.equal(ModsPoe.empurrar(e.hunt, bicho), false);
  assert.equal(bicho.x, 1);
  // O Incêndio "X% mais Dano".
  const queima = (af) => {
    const alvo = { uid: 'a', hp: 1e6, maxHp: 1e6, estados: {}, dots: [] };
    Afeccoes.aoAcertar(alvo, [{ elemento: 'fire', dano: 100 }], { afeccoes: Afeccoes.daSoma({ chance_ignite: 100, ...af }), agora: 0, rng: () => 0 });
    return alvo.dots.find((d) => d.tipo === 'queimadura')?.falta ?? 0;
  };
  assert.ok(Math.abs(queima({ incendio_mais: 50 }) / queima({}) - 1.5) < 0.01, `${queima({ incendio_mais: 50 })} × ${queima({})}`);
  // Os Incêndios espalhados (até 2 metros = 1 casa).
  const f = comAf({ 'ev:incendiar:espalhar:incendioRaio': 2 });
  const alvo = { uid: 'a', x: 5, y: 5, hp: 100, maxHp: 100, estados: {}, dots: [{ tipo: 'queimadura', falta: 40, ate: 4000 }] };
  const vizinho = { uid: 'v', x: 6, y: 5, hp: 100, maxHp: 100, estados: {}, dots: [] };
  const longe = { uid: 'l', x: 9, y: 5, hp: 100, maxHp: 100, estados: {}, dots: [] };
  f.hunt = { clock: 0, pos: { x: 0, y: 0 }, monstros: [alvo, vizinho, longe] };
  ModsPoe.evento(f, f.hunt, 'incendiar', Ficha.combate(f), { alvo });
  assert.ok(vizinho.dots.some((d) => d.tipo === 'queimadura'), 'o vizinho pega fogo');
  assert.equal(longe.dots.length, 0);
  // "Congela Inimigos Resfriados como se causasse X% mais Dano": a duração do Congelamento contra o Resfriado.
  const g = comAf({ 'duracao_congelamento@alvoResfriado': 100 });
  g.hunt = { clock: 0, pos: { x: 0, y: 0 } };
  const fg = Ficha.combate(g);
  const resfriado = ModsPoe.fichaDoGolpe(fg, ['magia'], { alvo: { x: 1, y: 0, hp: 9, maxHp: 10, estados: { lento: { ate: 5000, pct: 10 } } }, estado: g });
  const solto = ModsPoe.fichaDoGolpe(fg, ['magia'], { alvo: { x: 1, y: 0, hp: 9, maxHp: 10, estados: {} }, estado: g });
  assert.equal((resfriado.afeccoes?.duracaoCongelamento ?? 0) - (solto.afeccoes?.duracaoCongelamento ?? 0), 100);
});

test('o Sacrifício Eterno, o Sangramento em Caos e o Caos degenerativo que cura enquanto drena', { skip: SEM }, () => {
  const e = comAf({ energy_shield: 300, sacrificio_eterno: 1 });
  const f = Ficha.combate(e);
  e.hunt = { clock: 1000 };
  e.es = Math.round(f.energyShield);
  ModsPoe.tique(e, e.hunt, f, 100);
  assert.equal(e.es, 0, 'o escudo cheio é sacrificado');
  assert.equal(e.hunt.poeTemporarios?.fire_res_max?.valor, 5);
  assert.equal(e.hunt.poeTemporarios?.chaos_res_max?.valor, 5);
  // O Sangramento em você como Caos: a resistência a Caos o corta (a Física, não).
  const sangra = (af) => {
    const p = comAf(af);
    p.hunt = { clock: 0, pos: { x: 0, y: 0 }, monstros: [], efeitosDoJogador: { hp: 1, dots: [] } };
    ModsPoe.definirFichaDaCacada(p.hunt, () => Ficha.combate(p));
    Ficha.invalidar(p);
    ModsPoe.dotNoJogador(p.hunt, { tipo: 'sangramento', total: 400, duracaoMs: 4000, origem: { fonte: 'mob', mob: 'Rato', uid: 1, key: 'rat' } }, 0, () => 0.99);
    p.hp = p.maxHp;
    let perdeu = 0;
    for (const t of [0, 1000, 2000]) { p.hunt.clock = t; const a = p.hp; Mecanicas.tique(p, p.hunt, PERSONAGEM, []); perdeu += a - p.hp; }
    return { perdeu, p };
  };
  const fisico = sangra({ chaos_res: 75 }).perdeu;
  const emCaos = sangra({ chaos_res: 75, sangramento_em_caos: 1 }).perdeu;
  assert.ok(fisico > 0 && emCaos < fisico, `em Caos, a resistência a Caos corta (${emCaos} < ${fisico})`);
  // O Caos degenerativo cura enquanto um dreno de vida corre.
  const c = comAf({ caos_degen_cura_drenando: 1 });
  c.hunt = { clock: 0, pos: { x: 0, y: 0 }, monstros: [], efeitosDoJogador: { hp: 1, dots: [] }, roubos: [{ recurso: 'vida', restante: 1e6, porSegundo: 0.0001 }] };
  ModsPoe.definirFichaDaCacada(c.hunt, () => Ficha.combate(c));
  Ficha.invalidar(c);
  ModsPoe.dotNoJogador(c.hunt, { tipo: 'venenoPoe', total: 400, duracaoMs: 4000, origem: { fonte: 'mob', mob: 'Rato', uid: 1, key: 'rat' } }, 0, () => 0.99);
  c.hp = Math.max(1, c.maxHp - 500);
  const antes = c.hp;
  for (const t of [0, 1000, 2000]) { c.hunt.clock = t; Mecanicas.tique(c, c.hunt, PERSONAGEM, []); }
  assert.ok(c.hp > antes, `o veneno do PoE (Caos) curou (${antes} → ${c.hp})`);
});

test('o dano SORTUDO: "Dano de Raio com Golpes Não-Críticos é Sortudo" (o Arco, numa caçada de verdade, sem crítico)', { skip: SEM }, () => {
  if (!GP.doSlug('Arc')) return; // (sem a coleção de gemas nesta máquina)
  // A média do golpe do Arco em 60 s contra um alvo imortal colado, com e sem a linha (o mesmo sorteio: um gerador com semente).
  const media = (af) => {
    const e = personagemDeTeste({ vocacao: 'sorcerer', level: 60 });
    e.classePoe = 'Witch';
    const varinha = Jogo.pecaDoJogo(Gerar.gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Wands/Driftwood_Wand', raridade: 'normal', ilvl: 20, rng: () => 0.99 }));
    varinha.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
    e.equipment = { ...(e.equipment ?? {}), weapon: varinha, ring: { id: 77, poe: { af: { nunca_critico: 1, ...af } } } };
    e.inventory = [GS.itemDaGema({ id: GP.doSlug('Arc').itemId, nivel: 10, xp: 0, raridade: 'comum' })];
    GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
    e.actions = Array(Acoes.SLOTS).fill(null);
    e.actions[0] = { id: GP.doSlug('Arc').acao, enabled: true, minMana: 0, conditions: [] };
    Afixos.sincronizarMaximos(e);
    Ficha.invalidar(e);
    // (a semente ANTES de entrar: o monstro que nasce na área é o mesmo nas duas rodadas — dono, 12/10)
    const aleatorio = Math.random;
    let semente = 12345;
    Math.random = () => ((semente = (semente * 1103515245 + 12345) % 2147483648) / 2147483648);
    assert.equal(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok, true);
    const antes = Registro.nivelDoRegistro();
    Registro.definirNivel(1);
    Registro.limparRegistro();
    try {
      let t = Date.now();
      for (let i = 0; i < 240; i++) {
        const h = e.hunt;
        h.monstros = h.monstros.slice(0, 1);
        Object.assign(h.monstros[0], { hp: 1e12, maxHp: 1e12, x: h.pos.x + 1, y: h.pos.y });
        h.alvo = h.monstros[0].uid;
        Object.assign(e, { hp: e.maxHp, mana: 1e6, maxMana: 1e6 });
        Cacadas.tique(e, PERSONAGEM, (t += 250));
      }
      const golpes = Registro.ultimosGolpes(500).filter((g) => g.origem === 'gema' && !g.critico);
      assert.ok(golpes.length >= 20, `golpes do Arco: ${golpes.length}`);
      return golpes.reduce((n, g) => n + g.danoFinal, 0) / golpes.length;
    } finally {
      Math.random = aleatorio;
      Registro.limparRegistro();
      Registro.definirNivel(antes);
    }
  };
  const normal = media({});
  const sortudo = media({ raio_nao_critico_sortudo: 1 });
  assert.ok(sortudo > normal * 1.05, `o golpe sortudo é maior em média (${sortudo.toFixed(1)} × ${normal.toFixed(1)})`);
});

test('"Ataques executados por você se repetem mais 1 vez": a Pancada sai duas vezes por uso (numa caçada de verdade)', { skip: SEM }, () => {
  if (!GP.doSlug('Heavy_Strike')) return; // (sem a coleção de gemas nesta máquina)
  const usos = (af) => {
    const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 60 }), { classePoe: 'Duelist' });
    const espada = Jogo.pecaDoJogo(Gerar.gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'One_Hand_Swords/Rusted_Sword', raridade: 'normal', ilvl: 1, rng: () => 0.5 }));
    espada.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
    e.equipment = { ...e.equipment, weapon: espada, ring: { id: 78, poe: { af: { nunca_erra: 1, ...af } } } };
    delete e.equipment.shield;
    e.inventory = [GS.itemDaGema({ id: GP.doSlug('Heavy_Strike').itemId, nivel: 10, xp: 0, raridade: 'comum' })];
    GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
    e.actions = Array(Acoes.SLOTS).fill(null);
    e.actions[0] = { id: GP.doSlug('Heavy_Strike').acao, enabled: true, minMana: 0, conditions: [] };
    Afixos.sincronizarMaximos(e);
    Ficha.invalidar(e);
    assert.equal(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok, true);
    const antes = Registro.nivelDoRegistro();
    Registro.definirNivel(1);
    Registro.limparRegistro();
    try {
      let t = Date.now();
      for (let i = 0; i < 48; i++) {
        const h = e.hunt;
        h.monstros = h.monstros.slice(0, 1);
        Object.assign(h.monstros[0], { hp: 1e12, maxHp: 1e12, x: h.pos.x + 1, y: h.pos.y });
        h.alvo = h.monstros[0].uid;
        Object.assign(e, { hp: e.maxHp, mana: 1e6, maxMana: 1e6 });
        Cacadas.tique(e, PERSONAGEM, (t += 250));
      }
      return Registro.ultimosGolpes(500).filter((g) => g.origem === 'gema').length;
    } finally {
      Registro.limparRegistro();
      Registro.definirNivel(antes);
    }
  };
  const uma = usos({});
  const duas = usos({ repeticoes_ataque_proprio: 1 });
  assert.ok(uma >= 4, `${uma} golpes`);
  assert.ok(duas >= uma * 1.8, `com a repetição, o dobro de golpes (${duas} × ${uma})`);
});

test('trava contra regressão: as linhas de armas, armaduras e amuletos únicos que não funcionam não voltam a subir (rodada 8)', { skip: SEM }, () => {
  const ARMAS = /One_Hand|Two_Hand|Thrusting|Sceptres|Staves|Warstaves|Claws|Daggers|Rune_Daggers|Bows|Wands/;
  const OUTRAS = /Body_Armours|Helmets|Gloves|Boots|Shields|Quivers|Amulets/;
  const d = Pendencias.pendencias();
  const ruins = d.linhas.filter((l) => l.origem === 'unico' && l.classes.some((c) => ARMAS.test(c) || OUTRAS.test(c)) && ['pendente', 'inexiste'].includes(l.estado));
  assert.ok(ruins.length <= 584, `${ruins.length} linhas sem funcionar (eram 631 antes da rodada 8)`);
});
