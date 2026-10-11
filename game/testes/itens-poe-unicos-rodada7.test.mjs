// Os MODIFICADORES DOS ÚNICOS — rodada 7: armas, armaduras e amuletos (dono, 11/10: "quero tentar resolver todos os modificadores únicos";
// "seguir nas avulsas"). O crítico das magias pela ARMA, a SUPRESSÃO (o quanto previne, o que ignora o escudo, sem atordoamento), os VENENOS
// (o teto no alvo, "afetado por menos de N"), as magias ATIVADAS por gatilho (a tag `ativada`), os eletrizados lentos e o crítico sofrido
// por inimigo envenenado. E o escudo que começa do zero, os mortos destruídos, a redução elemental pela Resistência a Caos, as Eletrizações
// refletidas, as resistências zeradas de quem te acerta, o bônus da aljava e o Incêndio que volta para você.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';

const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no jogo oficial (PoE)';
const { personagemDeTeste } = await import('./apoio.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Controle = await import('../systems/combate/controle.mjs');
const Afeccoes = await import('../systems/itens-poe/afeccoes.mjs');
const Pendencias = await import('../admin/itens-poe-pendencias.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Resistencia = await import('../systems/hunt/resistencia.mjs');

const traduz = (texto) => T.traduzirParte(texto, (texto.match(/\{(\d+)\}/g) ?? []).map(() => 10));
function comAf(af) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 90 });
  e.equipment = { ring: { id: 1, poe: { af } } };
  Ficha.invalidar(e);
  return e;
}

test('as frases da rodada 7 viram os atributos', { skip: SEM }, () => {
  const casos = {
    'Chance de Golpe Crítico Mágico de Magias é igual ao da sua Arma Principal': ['critico_magia_da_arma'],
    'Ignora +{0}% do Dano Mágico Suprimido': ['supressao_prevenida'],
    '{0}% de quantidade de Dano Mágico Suprimido Ignorado': ['supressao_prevenida'],
    'Não pode ser Atordoado por Dano Mágico Suprimido': ['suprimido_sem_atordoamento'],
    'Não pode envenenar inimigos que já tenham pelo menos {0} envenenamentos': ['veneno_max_no_alvo'],
    'Magias ativadas envenenam ao atingir': ['chance_poison@magia+ativada'],
    'Velocidade de Movimento dos Inimigos Eletrizados por você reduzida em {0}%': ['eletrizados_lentos'],
    'Você sofre Dano Extra de Golpes Críticos reduzido em {0}% por Inimigo Envenenado': ['crit_dmg_taken_red%inimigosEnvenenados'],
  };
  for (const [texto, stats] of Object.entries(casos)) assert.deepEqual(traduz(texto).efeitos.map((x) => x.stat), stats, texto);
});

test('a supressão: "não pode ser Atordoado por Dano Mágico Suprimido"', { skip: SEM }, () => {
  const e = comAf({ suprimido_sem_atordoamento: 1 });
  const hunt = { clock: 1000, controle: {} };
  const bicho = { key: 'troll', raridade: 'unico', boss: true };
  // (o controle sorteia o efeito: forçamos o Atordoamento com um rng que sempre dá 0)
  const sem = Controle.tentar(hunt, bicho, Ficha.combate(e), 1000, () => 0, { semAtordoamento: true });
  assert.notEqual(sem, 'atordoado');
});

test('os venenos: o teto no alvo e "afetado por menos de N Venenos"', { skip: SEM }, () => {
  const alvo = { uid: 'a', hp: 1000, maxHp: 1000, estados: {}, dots: [{ tipo: 'venenoPoe', falta: 1000 }, { tipo: 'venenoPoe', falta: 1000 }] };
  const afeccoes = Afeccoes.daSoma({ chance_poison: 100, veneno_max_no_alvo: 2 });
  Afeccoes.aoAcertar(alvo, [{ elemento: 'physical', dano: 100 }], { afeccoes, agora: 500, rng: () => 0 });
  const sem = { uid: 'b', hp: 1000, maxHp: 1000, estados: {}, dots: [] };
  Afeccoes.aoAcertar(sem, [{ elemento: 'physical', dano: 100 }], { afeccoes, agora: 500, rng: () => 0 });
  assert.ok(sem.dots.some((d) => d.tipo === 'venenoPoe'), 'sem venenos: envenena (o teste do teto vale)');
  assert.equal(alvo.dots.filter((d) => d.tipo === 'venenoPoe').length, 2, 'com 2 venenos: não envenena mais');
  // "ao Matar um Inimigo afetado por menos de N Venenos": a condição pelo número de venenos no morto.
  const e = comAf({ 'ev:matar:vida@alvoMenosVenenos:3': 10 });
  e.hp = 1;
  e.hunt = { clock: 1000, pos: { x: 0, y: 0 }, monstros: [] };
  ModsPoe.evento(e, e.hunt, 'matar', Ficha.combate(e), { alvo });
  assert.equal(e.hp, 11, '2 venenos < 3');
  ModsPoe.evento(e, e.hunt, 'matar', Ficha.combate(e), { alvo: { ...alvo, dots: [...alvo.dots, { tipo: 'venenoPoe', falta: 1000 }] } });
  assert.equal(e.hp, 11, '3 venenos: não');
});

test('os eletrizados lentos e o crítico sofrido por inimigo envenenado', { skip: SEM }, () => {
  const e = comAf({ 'crit_dmg_taken_red%inimigosEnvenenados': 10 });
  e.hunt = { clock: 1000, pos: { x: 0, y: 0 }, monstros: [{ hp: 10, x: 1, y: 0, dots: [{ tipo: 'venenoPoe', falta: 500 }] }, { hp: 10, x: 2, y: 0, dots: [{ tipo: 'veneno', falta: 500 }] }, { hp: 10, x: 1, y: 1, dots: [] }] };
  Ficha.invalidar(e);
  assert.equal(Ficha.combate(e).afPoe.crit_dmg_taken_red, 20, '2 envenenados × 10%');
});

test('a redução elemental pela Resistência a Caos, o bônus da aljava e as resistências zeradas', { skip: SEM }, () => {
  const f = Ficha.combate(comAf({ reducao_elemental_meia_res_caos: 1, chaos_res: 40 }));
  const base = Ficha.combate(comAf({ chaos_res: 40 }));
  const caos = f.protection.chaos;
  assert.ok(caos > 0, `resistência a caos ${caos}`);
  assert.ok(Math.abs(ModsPoe.fatorDoDanoRecebido(f, 'fire') / ModsPoe.fatorDoDanoRecebido(base, 'fire') - (1 - caos / 200)) < 1e-9, 'no Fogo: menos a metade da resistência a Caos');
  assert.equal(ModsPoe.fatorDoDanoRecebido(f, 'physical'), ModsPoe.fatorDoDanoRecebido(base, 'physical'), 'no Físico, não');
  // A aljava: os números dela × (1 + X%).
  const soma = Afixos.somaDeItens({ equipment: { weapon: { id: 1, poe: { af: { bonus_aljava: 50 } } }, shield: { id: 2, poe: { classe: 'Quivers', af: { atk_speed: 10 } } } } });
  assert.equal(soma.atk_speed, 15);
  // As resistências zeradas de quem te acertou com Fogo.
  const bicho = { resist: { fire: 40, ice: 40 }, estados: { resZerada: { fire: true, ate: 5000 } } };
  assert.equal(Resistencia.resistenciaDe({ clock: 1000 }, bicho, 'fire'), 0);
  assert.equal(Resistencia.resistenciaDe({ clock: 1000 }, bicho, 'ice'), 40);
});

test('o Incêndio que você causa volta para você e as Eletrizações em você voltam para os de perto', { skip: SEM }, () => {
  const e = comAf({ incendio_refletido: 1, reflete_eletrizacao: 1 });
  e.hunt = { clock: 1000, pos: { x: 0, y: 0 }, monstros: [] };
  ModsPoe.definirFichaDaCacada(e.hunt, () => Ficha.combate(e));
  const alvo = { uid: 'a', hp: 100, maxHp: 100, estados: {}, dots: [{ tipo: 'queimadura', falta: 40, ate: 5000 }] };
  ModsPoe.aoPorAfeccoes(e, e.hunt, alvo, Ficha.combate(e), ['queimando']);
  assert.ok((e.hunt.efeitosDoJogador?.dots ?? []).some((d) => d.tipo === 'queimadura'), 'o Incêndio em você');
  const perto = { uid: 'p', x: 1, y: 0, hp: 10, estados: {} };
  e.hunt.monstros = [perto];
  ModsPoe.dotNoJogador(e.hunt, { tipo: 'choque', total: 5, origem: { fonte: 'teste' } }, 1000, () => 0.99);
  assert.ok(perto.estados.chocado?.ate > 1000, 'o de perto eletrizado');
});

test('trava contra regressão: as linhas de armas, armaduras e amuletos únicos que não funcionam não voltam a subir (rodada 7)', { skip: SEM }, () => {
  const ARMAS = /One_Hand|Two_Hand|Thrusting|Sceptres|Staves|Warstaves|Claws|Daggers|Rune_Daggers|Bows|Wands/;
  const OUTRAS = /Body_Armours|Helmets|Gloves|Boots|Shields|Quivers|Amulets/;
  const d = Pendencias.pendencias();
  const ruins = d.linhas.filter((l) => l.origem === 'unico' && l.classes.some((c) => ARMAS.test(c) || OUTRAS.test(c)) && ['pendente', 'inexiste'].includes(l.estado));
  assert.ok(ruins.length <= 631, `${ruins.length} linhas sem funcionar (eram 653 antes da rodada 7)`);
});
