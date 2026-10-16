// ZERAR A ÁRVORE — LOTE 32 (dono, 15/10: "zerar as pendências da árvore passiva do PoE"; a auditoria em docs/arvore-poe-auditoria.md): o resto
// da lista A — P024 a Armadura na Recarga do Escudo (os aumentos resolvidos), P026/P051/P075 que já eram a conta do PoE, P028 as Oferendas em
// você (e nos lacaios), P031 o Dançarino do Vento (20% menos, também no projétil), P035 o teto da redução em todo tipo, P038 as Forças
// Profanadas ao amaldiçoar, P039 o Vínculo Ancestral na Praga e no Aço, P041/P042 o relógio (parado há N s, os segundos sob o Clamor), P046 o
// Desafio antes do acerto, P048 o Ritual da Ruína, P049 o piso do movimento, P056 o Solo de 8 s, P071 o adicionado às magias de todo tipo × a
// eficácia, P073 a Convergência só no Elemental; e a ficha refeita quando um "Recentemente" começa ou acaba.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const C = await import('../systems/itens-poe/condicoes-poe.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const LacaiosPoe = await import('../systems/itens-poe/lacaios-poe.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Poderes = await import('../systems/poderes.mjs');
const Reforcos = await import('../systems/skills/reforcos.mjs');
const Estados = await import('../systems/skills/estados.mjs');
const Acoes = await import('../systems/acoes.mjs');
const GemasPoe = await import('../systems/itens-poe/gemas-poe.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
const R = await import('../systems/regras.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
  (await import('../systems/itens-poe/campanha.mjs')).iniciar();
}

const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 70, rng: () => 0.5 }));
function personagem(af = {}, base = 'One_Hand_Swords/Rusted_Sword') {
  const e = personagemDeTeste({ vocacao: 'knight', level: 60 });
  e.sistema = 'poe';
  e.classePoe = 'Duelist';
  const arma = peca(base);
  arma.poe.af = { ...(arma.poe.af ?? {}), ...af };
  e.equipment = { ...(e.equipment ?? {}), weapon: arma };
  delete e.equipment.shield;
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  P.garantir(e);
  return e;
}
const ficha = (e) => { Ficha.invalidar(e); return Ficha.combate(e); };
const traduzir = (modelo, valores = []) => T.traduzirMod({ modelo, valores });
const naCosta = (e) => {
  assert.equal(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok, true);
  return e.hunt;
};
function comSorte(valor, fn) {
  const antes = Math.random;
  Math.random = () => valor;
  try { return fn(); } finally { Math.random = antes; }
}

test('as linhas do lote 32 com efeito (e as que já eram a conta do PoE)', { skip: SEM }, () => {
  const linhas = [
    ['Aumentos e Reduções à Armadura também se aplicam à Recarga do Escudo de Energia em {0}% de seu valor', [20], 'armadura_na_recarga_es'],
    ['{0} menos dano de Ataque sofrido se você não foi Acertado por um Ataque Recentemente', [20], 'dano_ataque_recebido_mais@naoAcertadoAtaqueRecente'],
    ['Inimigos Próximos são Cobertos em Cinzas se você não se moveu nos últimos {0} segundos', [2], 'aura_proximos:cinzas@paradoHa:2'],
    ['Dano Corpo a Corpo aumentado em {0}% para cada segundo que você for afetado por um Buff de Clamor, máximo de {1}%', [10, 60], 'dmg_inc%afetadoPorClamor~60@corpo'],
    ['Perca {0}% de Vida por segundo por Fúria enquanto não estiver perdendo Fúria', [0.1], 'perde_vida_pct_s_por_furia'],
    ['Velocidade de Movimento não pode ser modificada para abaixo do valor base', [], 'movimento_minimo_base'],
    ['{0}% de chance de criar Solo Sagrado ao Acertar um Inimigo Raro ou Único', [10], 'ev:acertar:soloSagrado:8@alvoRaro'],
  ];
  for (const [modelo, v, stat] of linhas) {
    const t = traduzir(modelo, v);
    assert.equal(t.estado, 'novo', modelo);
    assert.equal(t.efeitos[0].stat, stat, modelo);
  }
  assert.equal(traduzir('{0} menos dano de Ataque sofrido se você não foi Acertado por um Ataque Recentemente', [20]).efeitos[0].valor, -20, '"20% less" no inglês');
  assert.equal(traduzir('Perde toda a sua Força dos Ventos ao Acertar').estado, 'equivalente', 'já era "when Hit"');
  for (const modelo of ['Ganhe {0}% de Chance de Bloquear com o Escudo Equipado ao invés do valor do Escudo', 'Chance de bloquear magias aumenta o seu escudo de energia máximo', 'Suas Habilidades de Oferenda também afetam você', 'Mago de Batalha', 'Redefine a duração de esfriamentos e eletrificações em inimigos amaldiçoados por você']) {
    assert.ok(['novo', 'equivalente'].includes(traduzir(modelo, [50]).estado), modelo);
  }
});

test('P024 — "Aumentos e Reduções à Armadura também se aplicam à Recarga do Escudo": todo o aumentado de Armadura que vale (o condicional também)', { skip: SEM }, () => {
  const sem = personagem({ armour_pct: 30, 'armour_pct@comEspada': 20, 'armour_pct@comMachado': 40 });
  const com = personagem({ armour_pct: 30, 'armour_pct@comEspada': 20, 'armour_pct@comMachado': 40, armadura_na_recarga_es: 20 });
  // (30 + 20 da espada na mão; os 40 do machado não valem): 50 × 20% = 10
  assert.equal((Afixos.soma(com).es_recharge ?? 0) - (Afixos.soma(sem).es_recharge ?? 0), 10);
  const reducao = personagem({ armour_pct: -25, armadura_na_recarga_es: 20 });
  assert.equal(Afixos.soma(reducao).es_recharge ?? 0, -5, 'as reduções também');
});

test('P028 — as Oferendas em você: a Carnal (ataque, conjuração, movimento), a Óssea (bloqueio de ataque e de magia; a regeneração só se bloqueou há pouco)', { skip: SEM }, () => {
  const carnal = LacaiosPoe.oQueInvoca('Flesh_Offering', 1);
  const ossea = LacaiosPoe.oQueInvoca('Bone_Offering', 1);
  assert.equal(carnal.tipo, 'oferenda');
  assert.deepEqual([carnal.bonus.velAtaquePct, carnal.bonus.velConjPct, carnal.bonus.velMovPct], [20, 20, 20]);
  assert.deepEqual([ossea.bonus.bloqueioPct, ossea.bonus.bloqueioMagicoPct, ossea.bonus.regenPct, ossea.bonus.regenSeBloqueou], [25, 25, 4, true]);
  const e = personagem({ oferenda_em_voce: 1, oferenda_efeito_reduzido: 50 });
  const h = naCosta(e);
  const base = Afixos.soma(e);
  h.oferendaEmVoce = { ...carnal.bonus, ate: (h.clock ?? 0) + 5000 };
  const comCarnal = Afixos.soma(e);
  for (const k of ['atk_speed', 'cast_speed', 'move_speed']) assert.equal((comCarnal[k] ?? 0) - (base[k] ?? 0), 10, `${k}: 20 × 50% em você`);
  h.oferendaEmVoce = { ...ossea.bonus, ate: (h.clock ?? 0) + 5000 };
  const comOssea = Afixos.soma(e);
  assert.equal((comOssea.spell_block ?? 0) - (base.spell_block ?? 0), 12.5);
  assert.equal((comOssea.life_regen_max_pct ?? 0) - (base.life_regen_max_pct ?? 0), 0, 'sem bloquear: sem regeneração');
  C.marcar(h, 'bloqueou');
  assert.equal((Afixos.soma(e).life_regen_max_pct ?? 0) - (base.life_regen_max_pct ?? 0), 2, 'bloqueou há pouco: 4 × 50%');
});

test('P031 — o Dançarino do Vento: 20% MENOS dano de Ataque sem ter sido acertado por Ataque há pouco — também no projétil do monstro', { skip: SEM }, () => {
  const dano = (af, acertado) => {
    const e = personagem(af);
    const h = naCosta(e);
    if (acertado) C.marcar(h, 'acertadoAtaque');
    const f = ficha(e);
    const bicho = { uid: 'b', name: 'Arqueiro', key: h.monstros[0]?.key, x: h.pos.x + 4, y: h.pos.y, hp: 100, maxHp: 100 };
    e.hp = e.maxHp = 100000;
    e.es = 0;
    comSorte(0.999, () => Poderes.dispararMagia({ estado: e, hunt: h, personagem: PERSONAGEM, bicho, eventos: [], agora: h.clock ?? 0, ficha: f, temEscudo: false }, { tiro: 1, elemento: 'fire', min: 1000, max: 1000 }));
    return 100000 - e.hp;
  };
  const linha = { 'dano_ataque_recebido_mais@naoAcertadoAtaqueRecente': -20 };
  const normal = dano({}, false);
  assert.ok(normal > 0);
  assert.ok(Math.abs(dano(linha, false) - normal * 0.8) <= 1, `${dano(linha, false)} × ${normal}`);
  assert.equal(dano(linha, true), dano({}, true), 'acertado por um Ataque há pouco: nada');
});

test('P035 — a Guarda Desequilibrada: o teto de 50% também na redução da Armadura contra outro tipo e na adicional elemental', { skip: SEM }, () => {
  const f = (af) => ({ armor: 1e6, protection: { chaos: 75 }, afPoe: af });
  assert.ok(Math.abs(C.armaduraNoElemento(f({ armadura_no_chaos: 1 }), 'chaos', 100) - 0.1) < 1e-9, 'sem a Guarda: o teto de 90%');
  assert.ok(Math.abs(C.armaduraNoElemento(f({ armadura_no_chaos: 1, reducao_maxima: 50 }), 'chaos', 100) - 0.5) < 1e-9, 'com ela: 50%');
  // "Redução de Dano Elemental adicional igual a metade da sua Resistência a Caos": 37,5% — abaixo de 50, igual; com o teto de 30, 30
  const meia = (teto) => C.fatorDoDanoRecebido(f({ reducao_elemental_meia_res_caos: 1, ...(teto ? { reducao_maxima: teto } : {}) }), 'fire');
  assert.ok(Math.abs(meia(0) - 0.625) < 1e-9);
  assert.ok(Math.abs(meia(50) - 0.625) < 1e-9);
  assert.ok(Math.abs(meia(30) - 0.7) < 1e-9);
});

test('P038 — as Forças Profanadas: ao AMALDIÇOAR, o Resfriamento e a Eletrização voltam à duração cheia; o acerto num amaldiçoado não renova mais', { skip: SEM }, () => {
  const agora = 10000;
  const bicho = { uid: 'b', x: 1, y: 0, hp: 1e6, maxHp: 1e6, estados: {} };
  // o Resfriamento das gemas grava a duração (3 s base) e a Eletrização das afecções também
  Estados.aplicar(bicho, { lentidaoPct: 30 }, 100, agora, () => 0, false, 100);
  assert.equal(bicho.estados.lento.dur, bicho.estados.lento.ate - agora);
  const durLento = bicho.estados.lento.dur;
  bicho.estados.chocado = { ate: agora + 2000, pct: 15, dur: 2000 };
  const depois = agora + 1500;
  ModsPoe.aoAmaldicoar({ afPoe: { renova_frio_choque_amaldicoado: 1 } }, bicho, depois);
  assert.equal(bicho.estados.lento.ate, depois + durLento);
  assert.equal(bicho.estados.chocado.ate, depois + 2000);
  // sem a linha, nada; o acerto (sem amaldiçoar) também não
  const outro = { uid: 'c', x: 1, y: 0, hp: 1e6, maxHp: 1e6, estados: { lento: { ate: agora + 500, pct: 30, dur: 3000 } } };
  ModsPoe.aoAmaldicoar({ afPoe: {} }, outro, agora);
  assert.equal(outro.estados.lento.ate, agora + 500);
  const e = personagem({ renova_frio_choque_amaldicoado: 1 });
  e.hunt = { clock: agora, monstros: [], lacaios: [], pos: { x: 0, y: 0 } };
  outro.maldicoes = { x: { ate: agora + 5000, desde: agora - 100 } };
  ModsPoe.aoAcertar(e, e.hunt, outro, ficha(e), { dano: 1, rng: () => 0.99 });
  assert.equal(outro.estados.lento.ate, agora + 500, 'o acerto não renova');
  // e a maldição da peça que pega no inimigo (`Reforcos.amaldicoar`) chama a renovação pela ficha da caçada
  const caca = { clock: agora, monstros: [], lacaios: [], pos: { x: 0, y: 0 } };
  ModsPoe.definirFichaDaCacada(caca, () => ({ afPoe: { renova_frio_choque_amaldicoado: 1 } }));
  const marcado = { uid: 'd', hp: 10, estados: { chocado: { ate: agora + 100, pct: 15, dur: 2000 } } };
  assert.equal(Reforcos.amaldicoar(marcado, 'x', [{ efeito: 'marcaVulneravel', pct: 10, tipos: ['physical'] }], { agora, hunt: caca }), true);
  assert.equal(marcado.estados.chocado.ate, agora + 2000);
});

test('P041/P042 e o relógio da ficha: "não se moveu nos últimos N segundos", os segundos sob um Buff de Clamor, os "Recentemente"', { skip: SEM }, () => {
  const e = personagem();
  const h = naCosta(e);
  const t0 = h.clock ?? 0;
  const conds = (agora) => { h.clock = agora; return C.condicoesDe(e, ficha(e).afPoe); };
  C.marcar(h, 'moveu', t0);
  assert.equal(C.vale(conds(t0 + 1500), 'paradoHa:2'), false);
  assert.equal(C.vale(conds(t0 + 2000), 'paradoHa:2'), true);
  // os segundos SEGUIDOS sob algum Buff de Clamor
  h.clock = t0;
  h.buffs = { clamor: { ate: t0 + 8000, tipo: 'poe-clamor' } };
  h.poeSobClamorDesde = t0;
  assert.equal(C.fatorDaEscala(e, ficha(e).afPoe, null, 'afetadoPorClamor'), 0);
  h.clock = t0 + 3500;
  assert.equal(C.fatorDaEscala(e, ficha(e).afPoe, null, 'afetadoPorClamor'), 3);
  h.clock = t0 + 9000;
  assert.equal(C.fatorDaEscala(e, ficha(e).afPoe, null, 'afetadoPorClamor'), 0, 'acabou o Buff');
  assert.equal(C.sobBuffDeClamor(h, t0 + 1000), true);
  // a ficha é refeita quando um "Recentemente" começa e quando acaba
  h.clock = t0 + 20000;
  C.tique(e, h, ficha(e), 250);
  delete h.poeFichaMudou;
  C.tique(e, h, ficha(e), 250);
  assert.equal(h.poeFichaMudou, undefined, 'nada mudou');
  C.marcar(h, 'acertadoAtaque');
  C.tique(e, h, ficha(e), 250);
  assert.equal(h.poeFichaMudou, true, 'acertado agora');
  delete h.poeFichaMudou;
  h.clock += 4500;
  C.tique(e, h, ficha(e), 250);
  assert.equal(h.poeFichaMudou, true, 'saiu da janela');
});

test('P046 — o Desafio do Berserker: a vida é ganha ANTES do acerto, da Vida NÃO RESERVADA que falta; o golpe que mataria pode não matar', { skip: SEM }, () => {
  const e = personagem({ desafio_cura_faltante_pct: 3 });
  const h = naCosta(e);
  const agora = h.clock ?? 0;
  h.desafio = { n: 5, ate: agora + 5000, ultimo: agora };
  Object.assign(e, { maxHp: 1000, hp: 200 });
  const ganho = ModsPoe.antesDeSerAcertado(e, h, ficha(e));
  assert.equal(ganho, Math.round(800 * 0.03 * 5), '3% × 5 Desafios dos 800 que faltam');
  assert.equal(e.hp, 320);
  // com Vida reservada (uma aura com 30% de Vida): o teto é o não reservado
  h.buffs = { aura: { ate: agora + 1e6, reserva: { recurso: 'vida', pct: 30 } } };
  Object.assign(e, { hp: 200 });
  const naoReservada = 1000 - C.reservadoAgora(e, 'vida', ficha(e).afPoe);
  assert.ok(naoReservada < 1000);
  assert.equal(ModsPoe.antesDeSerAcertado(e, h, ficha(e)), Math.round((naoReservada - 200) * 0.15));
  // sem Desafio, nada; e o ganhar Desafio segue no "ao perder Vida para um Acerto"
  h.desafio = { n: 0, ate: 0, ultimo: -Infinity };
  assert.equal(ModsPoe.antesDeSerAcertado(e, h, ficha(e)), 0);
});

test('P048 — o Ritual da Ruína: X% de Vida por segundo POR Fúria, só enquanto a Fúria não está caindo', { skip: SEM }, () => {
  const e = personagem({ perde_vida_pct_s_por_furia: 0.1 });
  const h = naCosta(e);
  const agora = h.clock ?? 0;
  h.furia = { n: 20, ganhou: agora, perdeu: agora };
  assert.equal(C.furiaSemPerder(h, ficha(e).afPoe, agora + 1000), 20);
  assert.equal(C.furiaSemPerder(h, ficha(e).afPoe, agora + 2500), 0, 'depois de 2 s sem ganhar, ela cai');
  assert.equal(C.furiaSemPerder(h, { furia_perde_por_s: 1 }, agora + 500), 0, '"Perde N de Fúria por segundo": sempre caindo');
  Object.assign(e, { maxHp: 10000, hp: 10000 });
  h.clock = agora + 1000;
  C.tique(e, h, ficha(e), 1000, agora + 1000);
  assert.equal(10000 - e.hp, 10000 * 0.001 * 20, '0,1% × 20 Fúria em 1 s');
});

test('P049 — o Juggernaut: a Velocidade de Movimento não fica abaixo da base (nenhuma redução), mas os aumentos valem', { skip: SEM }, () => {
  const lento = personagem({ move_speed: -40 });
  const comPiso = personagem({ move_speed: -40, movimento_minimo_base: 1 });
  const rapido = personagem({ move_speed: 30, movimento_minimo_base: 1 });
  for (const e of [lento, comPiso, rapido]) naCosta(e);
  assert.ok(Cacadas.razaoDeVelocidade(lento) < 1);
  assert.equal(Cacadas.razaoDeVelocidade(comPiso), 1);
  assert.ok(Cacadas.razaoDeVelocidade(rapido) > 1);
  // (a ficha — o que a tela mostra — também fica na base)
  assert.equal(ficha(comPiso).speed, R.baseSpeed(comPiso.level));
  assert.ok(ficha(lento).speed < R.baseSpeed(lento.level));
  // a lentidão (o Resfriamento em você) também não o põe abaixo da base
  comPiso.hunt.controle = { lento: { ate: (comPiso.hunt.clock ?? 0) + 5000, pct: 30 } };
  assert.equal(Cacadas.razaoDeVelocidade(comPiso), 1);
});

test('P071 — o dano adicionado às MAGIAS de todo tipo (o Fogo numa magia de Gelo), × a eficácia do dano adicionado', { skip: SEM }, () => {
  const gema = GemasPoe.doSlug('Freezing_Pulse') ?? GemasPoe.doSlug('Ice_Nova');
  if (!gema) return; // (sem a coleção de gemas nesta máquina)
  const mostrado = (af) => {
    const e = personagem(af, 'Wands/Driftwood_Wand');
    e.equipment.weapon.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
    e.inventory = [GS.itemDaGema({ id: gema.itemId, nivel: 10, xp: 0, raridade: 'comum' })];
    GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
    Ficha.invalidar(e);
    return Acoes.danoMostrado(e, Acoes.POR_ID_PUBLICO(gema.acao));
  };
  const sem = mostrado({});
  const com = mostrado({ spell_added_fire_dmg_min: 100, spell_added_fire_dmg_max: 100 });
  assert.ok(com.min > sem.min + 50, `o Fogo entra na magia de Gelo (${com.min} × ${sem.min})`);
  // (a eficácia multiplica o adicionado como o dos suportes; o número dela por nível ainda falta nos dados das gemas — o achado S002 da
  // auditoria: a página do poedb só traz a faixa, "(300 — 480)%", e o jogo usa 1)
});

test('P073 — a Convergência: 30% mais Dano ELEMENTAL (as partes de Fogo, Gelo e Raio), não o golpe inteiro', { skip: SEM }, () => {
  const f = { afPoe: { mais_dano_elemental_convergencia: 30 } };
  assert.ok(Math.abs(C.fatorDoDanoElemental(f, null, 'golpe', 'fire') - 1.3) < 1e-9);
  assert.equal(C.fatorDoDanoElemental(f, null, 'golpe', 'physical'), 1);
  assert.deepEqual(C.BUFFS.convergencia.af, { mais_dano_elemental_convergencia: 30 });
  // com o "mais Dano Elemental" de outra fonte: multiplicam
  assert.ok(Math.abs(C.fatorDoDanoElemental({ afPoe: { mais_dano_elemental_convergencia: 30, mais_dano_elemental: 100 } }, null, 'golpe', 'ice') - 2.6) < 1e-9);
});
