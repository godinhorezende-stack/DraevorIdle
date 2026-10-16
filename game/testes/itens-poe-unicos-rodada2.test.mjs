// Os MODIFICADORES DOS ÚNICOS — rodada 2: armas, armaduras e AMULETOS (dono, 11/10: "quero tentar resolver todos os modificadores únicos,
// das armas, armaduras e amuletos"). As mecânicas que entraram: o TETO do bloqueio ("+X% à Chance máxima de Bloquear"), SORTUDO/AZARADO
// (o bloqueio, o crítico, o dano que os inimigos causam em você), o NÍVEL das gemas pela cor ("Gemas de Força Encaixadas") e pelo nome
// ("todas as Gemas Erguer Zumbi"), a MALDIÇÃO posta por item ("Amaldiçoa Inimigos com Vulnerabilidade ao Bloquear"), os LACAIOS (a
// resistência a Fogo/Gelo, o dano extra) e as regras novas dos amuletos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';

const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no jogo oficial (PoE)';
const { personagemDeTeste } = await import('./apoio.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Atributos = await import('../systems/personagem/atributos.mjs');
const Formulas = await import('../systems/combate/formulas.mjs');
const Gemas = await import('../systems/skills/gemas.mjs');
const Reforcos = await import('../systems/skills/reforcos.mjs');
const Lacaios = await import('../systems/itens-poe/lacaios-poe.mjs');
const Pendencias = await import('../admin/itens-poe-pendencias.mjs');
await import('../systems/acoes.mjs'); // registra a maldição por item (`ModsPoe.definirMaldicao`)

const COM_EFEITO = ['equivalente', 'aproximado', 'novo'];
const traduz = (texto) => T.traduzirParte(texto, (texto.match(/\{(\d+)\}/g) ?? []).map(() => 10));
/** Um personagem com uma peça do PoE no anel que soma `af`. */
function comAf(af) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 90 });
  e.equipment = { ...(e.equipment ?? {}), ring: { id: 1, poe: { af } } };
  Ficha.invalidar(e);
  return e;
}

test('o teto do bloqueio: "+X% à Chance máxima de Bloquear" soma no limite do bloqueio de ataques e no de magia', { skip: SEM }, () => {
  assert.deepEqual(traduz('+{0}% à Chance máxima de Bloquear o Dano de Ataques').efeitos.map((e) => e.stat), ['block_max']);
  assert.deepEqual(traduz('{0}% à Chance máxima de Bloquear Dano Mágico').efeitos.map((e) => e.stat), ['spell_block_max']);
  const sem = Ficha.combate(comAf({ block: 200, spell_block: 200 }));
  const com = Ficha.combate(comAf({ block: 200, spell_block: 200, block_max: 5, spell_block_max: 4 }));
  assert.equal(sem.blockChance, Atributos.CONFIG.bloqueio.MAX, 'sem o mod: no teto');
  assert.ok(Math.abs(com.blockChance - (Atributos.CONFIG.bloqueio.MAX + 0.05)) < 1e-9, `com +5%: ${com.blockChance}`);
  assert.ok(Math.abs(com.bloqueioDeMagia - (Formulas.PARAMETROS.bloqueio.limiteDaMagia + 0.04)) < 1e-9);
});

test('SORTUDO / AZARADO: a chance rola duas vezes (o melhor / o pior); os dois juntos se anulam', () => {
  const seq = (...v) => { let i = 0; return () => v[i++]; };
  assert.equal(ModsPoe.sorteado(0.5, 1, 0, seq(0.9, 0.1)), true, 'sortudo: a segunda rolagem salva');
  assert.equal(ModsPoe.sorteado(0.5, 0, 1, seq(0.1, 0.9)), false, 'azarado: a segunda rolagem estraga');
  assert.equal(ModsPoe.sorteado(0.5, 1, 1, seq(0.9, 0.1)), false, 'os dois: uma rolagem só');
  assert.equal(ModsPoe.sorteado(0.5, 0, 0, seq(0.1)), true);
});

test('o crítico sortudo do personagem ("Sua Chance de Golpe Crítico é Sortuda enquanto em Vida Baixa") e os textos de sorte/azar', { skip: SEM }, () => {
  assert.deepEqual(traduz('Sua Chance de Golpe Crítico é Sortuda enquanto em Vida Baixa').efeitos.map((e) => e.stat), ['critico_sortudo@vidaBaixa']);
  assert.deepEqual(traduz('Chance de Bloquear é Sortuda').efeitos.map((e) => e.stat), ['bloqueio_sortudo']);
  assert.deepEqual(traduz('A Chance de Bloquear o Dano Mágico é Azarada').efeitos.map((e) => e.stat), ['bloqueio_magia_azarado']);
  assert.deepEqual(traduz('O Dano dos Inimigos Acertando você é Azarado enquanto você estiver em Vida Cheia').efeitos.map((e) => e.stat), ['dano_recebido_azarado@vidaCheia']);
  // No golpe: com a chance em 50% e as rolagens 0,9 e 0,1, o sortudo crita e o comum não.
  const e = comAf({});
  const alvo = { uid: 1, x: 0, y: 0, hp: 100, maxHp: 100, key: null };
  const base = Ficha.combate(e);
  const rolar = (afPoe) => {
    const antes = Math.random;
    const v = [0.9, 0.1];
    let i = 0;
    Math.random = () => v[i++ % 2];
    try { return Ficha.rolarCritico(e, 100, alvo, [], { ...base, critChance: 0.5, afPoe }).crit; } finally { Math.random = antes; }
  };
  assert.equal(rolar({}), false);
  assert.equal(rolar({ critico_sortudo: 1 }), true);
});

test('o nível das gemas pela COR ("Gemas de Força Encaixadas") e pelo NOME ("todas as Gemas Erguer Zumbi" = Evocar Zumbi)', { skip: SEM }, () => {
  assert.deepEqual(traduz('+{0} ao Nível das Gemas de Força Encaixadas').efeitos.map((e) => e.stat), ['gem_level_local@forca']);
  assert.deepEqual(traduz('+{0} ao Nível de todas as Gemas Erguer Zumbi').efeitos.map((e) => e.stat), ['gem_level@gema:evocar-zumbi']);
  const def = (re) => [...Gemas.DEFS.values()].find((d) => re.test(d.poe?.cor ?? '') && d.tipo === 'ativa');
  const vermelha = def(/verm/i);
  const azul = def(/azul/i);
  assert.ok(vermelha && azul, 'há gemas vermelhas e azuis na coleção');
  const peca = { poe: { af: { 'gem_level_local@forca': 2 } } };
  assert.equal(Gemas.extrasDaGemaPoe({ equipment: {} }, peca, vermelha).nivel, 2, 'a vermelha (Força) sobe');
  assert.equal(Gemas.extrasDaGemaPoe({ equipment: {} }, peca, azul).nivel, 0, 'a azul não');
  const zumbi = [...Gemas.DEFS.values()].find((d) => d.nome === 'Evocar Zumbi');
  const estado = { equipment: { neck: { poe: { af: { 'gem_level@gema:evocar-zumbi': 1 } } } } };
  assert.equal(Gemas.extrasDaGemaPoe(estado, null, zumbi).nivel, 1, 'o amuleto sobe o Evocar Zumbi onde ele estiver');
  assert.equal(Gemas.extrasDaGemaPoe(estado, null, azul === zumbi ? vermelha : azul).nivel, 0, 'e só ele');
});

test('a MALDIÇÃO do item: "Amaldiçoa Inimigos com Vulnerabilidade ao Bloquear" amaldiçoa o atacante com a gema (o limite de 1 vale)', { skip: SEM }, () => {
  const r = traduz('Amaldiçoa Inimigos com Vulnerabilidade ao Bloquear');
  assert.ok(COM_EFEITO.includes(r.estado), r.estado);
  assert.equal(r.efeitos[0].stat, 'ev:bloquear:maldicao:vulnerabilidade:10');
  // O evento de verdade: a ficha com o mod, o bloqueio dispara, o monstro fica amaldiçoado com os efeitos da Vulnerabilidade.
  const e = comAf({ 'ev:bloquear:maldicao:vulnerabilidade:10': 100 });
  e.hunt = { clock: 1000, monstros: [], pos: { x: 0, y: 0 } };
  const bicho = { uid: 7, hp: 100, maxHp: 100, x: 1, y: 0 };
  ModsPoe.evento(e, e.hunt, 'bloquear', Ficha.combate(e), { alvo: bicho, eventos: [], agora: 1000 });
  const ativas = Reforcos.maldicoesAtivas(bicho, 1000);
  assert.equal(ativas.length, 1);
  assert.equal(ativas[0].efeitos[0].tipo, 'vulneravel');
  assert.ok(ativas[0].efeitos[0].tipos.includes('physical'));
  // O limite: outra maldição tira a primeira; "ignorando o Limite" soma.
  const efeito = [{ efeito: 'marcaVulneravel', pct: 20, tipos: ['fire'], durMarca: 5000 }];
  Reforcos.amaldicoar(bicho, 'outra', efeito, { agora: 1100, dur: 5000 });
  assert.deepEqual(Reforcos.maldicoesAtivas(bicho, 1100).map((m) => m.id), ['outra']);
  Reforcos.amaldicoar(bicho, 'terceira', efeito, { agora: 1200, dur: 5000, ignorarLimite: true });
  assert.deepEqual(Reforcos.maldicoesAtivas(bicho, 1200).map((m) => m.id).sort(), ['outra', 'terceira']);
  // A maldição que o jogo não tem fica sem efeito, com o porquê.
  assert.equal(traduz('Amaldiçoa Inimigos com Punição quando você Bloquear seu Dano Corpo a Corpo, ignorando o Limite de Maldições').estado, 'inerte');
});

test('os lacaios: a resistência a Fogo/Gelo e o dano extra do lacaio físico', { skip: SEM }, () => {
  assert.deepEqual(traduz('Lacaios possuem +{0}% de Resistência a Gelo').efeitos.map((e) => e.stat), ['minion_ice_res']);
  assert.deepEqual(traduz('Lacaios têm +{0}% de Resistência a Fogo').efeitos.map((e) => e.stat), ['minion_fire_res']);
  assert.ok(COM_EFEITO.includes(traduz('Lacaios têm +{0}% de Resistência a Fogo').estado));
  const sem = Lacaios.oQueInvoca('Raise_Zombie', 10, null, {});
  const com = Lacaios.oQueInvoca('Raise_Zombie', 10, null, { minion_phys_as_extra: 50, minion_fire_res: 30 });
  assert.ok(sem && com, 'o zumbi existe');
  assert.ok(com.dano.max > sem.dano.max, `dano ${sem.dano.max} → ${com.dano.max}`);
  // (lote 44: + os 40% de base do Zumbi no PoB)
  assert.equal(com.poe.resFogo - sem.poe.resFogo, 30);
});

test('as regras novas dos amuletos e das sobras: o atributo, a condição, a escala ou o evento que o jogo já tem', { skip: SEM }, () => {
  const casos = {
    '{0} a {1} de Dano de Raio por Carga de Poder': ['added_energy_dmg_min%carga:poder', 'added_energy_dmg_max%carga:poder'],
    '{0}% de aumento da Velocidade de Movimento caso você tenha utilizado uma Habilidade Vaal Recentemente': ['move_speed@usouVaalRecente'],
    '+{0}% de Multiplicador de Dano Crítico se você ganhou uma Carga de Poder Recentemente': ['crit_dmg@ganhouPoderRecente'],
    '+{0}% de resistência a dano de caos por {1}% de resistência a dano de frio': ['chaos_res%resGelo:10'],
    'Em vida baixa, frascos de vida ganham {0} cargas a cada {1} segundos': ['frasco_regen_n:vida@vidaBaixa', 'frasco_regen_s:vida@vidaBaixa'],
    'Ganhe até o máximo de Cargas de Poder quando você usar uma Habilidade Vaal': ['ev:usarVaal:cargaMax:poder'],
    '{0}% de chance da Recarga do Escudo de Energia iniciar quando você Bloquear': ['ev:bloquear:recargaEs'],
    '{0}% de chance de causar Exposição a Fogo ao Acertar': ['ev:acertar:alvo:exposicaoFogo'],
  };
  for (const [texto, stats] of Object.entries(casos)) {
    const r = traduz(texto);
    assert.ok(COM_EFEITO.includes(r.estado), `${texto}: ${r.estado}`);
    assert.deepEqual(r.efeitos.map((x) => x.stat), stats, texto);
  }
});

test('trava contra regressão: as linhas de armas, armaduras e amuletos únicos que não funcionam não voltam a subir (rodada 2: 946 → 898)', { skip: SEM }, () => {
  const ESCOPO = /One_Hand|Two_Hand|Thrusting|Sceptres|Staves|Warstaves|Claws|Daggers|Rune_Daggers|Bows|Wands|Body_Armours|Helmets|Gloves|Boots|Shields|Quivers|Amulets/;
  const d = Pendencias.pendencias();
  const ruins = d.linhas.filter((l) => l.origem === 'unico' && l.classes.some((c) => ESCOPO.test(c)) && ['pendente', 'inexiste'].includes(l.estado));
  assert.ok(ruins.length <= 898, `${ruins.length} linhas sem funcionar (eram 898 depois da rodada 2)`);
});
