// Os MODIFICADORES DOS ÚNICOS (armas e armaduras) que não funcionavam — rodada 1 (dono, 10/10: "verifique todos os itens únicos para
// resolver todos os modificadores que ainda não funcionam"): o que só precisava de regra, porque o atributo, a condição ou o evento já
// existem no jogo. A frase que o poedb quebra em duas linhas volta a ser uma; "quando na Mão Principal/Secundária" vale peça a peça (como o
// anel); "{n}% de aumento do X" vira a forma das regras; os suportes com outro nome na coleção; e as regras novas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';

const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no jogo oficial (PoE)';
await import('./apoio.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
const C = await import('../systems/itens-poe/condicoes-poe.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Pendencias = await import('../admin/itens-poe-pendencias.mjs');

const COM_EFEITO = ['equivalente', 'aproximado', 'novo'];
const traduz = (texto) => T.traduzirParte(texto, (texto.match(/\{(\d+)\}/g) ?? []).map(() => 10));

test('a frase que o poedb quebrou em duas linhas volta a ser uma; os mods híbridos e as linhas internas continuam separados', () => {
  assert.deepEqual(T.partesDoModelo('Inimigos com Sangramento Explodem quando você matá-los, / causando {0}% de suas Vidas Máximas com Dano Físico'), ['Inimigos com Sangramento Explodem quando você matá-los, causando {0}% de suas Vidas Máximas com Dano Físico']);
  assert.deepEqual(T.partesDoModelo('Golpes corpo a corpo dos lacaios animados e manifestados causam / dano propagado aos inimigos ao redor'), ['Golpes corpo a corpo dos lacaios animados e manifestados causam dano propagado aos inimigos ao redor']);
  assert.deepEqual(T.partesDoModelo('+{0} de Vida máxima / +{1}% de Resistência a Fogo'), ['+{0} de Vida máxima', '+{1}% de Resistência a Fogo'], 'híbrido: duas frases');
  assert.deepEqual(T.partesDoModelo('Ativa uma magia encaixada ao bloquear / local use skill on hit % [{0}]'), ['Ativa uma magia encaixada ao bloquear', 'local use skill on hit % [{0}]'], 'a linha interna fica sozinha');
});

test('a frase juntada casa a regra que já existia (o Sangramento que explode)', { skip: SEM }, () => {
  const r = T.traduzirMod({ modelo: 'Inimigos com Sangramento Explodem quando você matá-los, / causando {0}% de suas Vidas Máximas com Dano Físico', valores: [10] });
  assert.equal(r.partes.length, 1);
  assert.ok(COM_EFEITO.includes(r.estado), r.estado);
  assert.match(r.efeitos[0].stat, /^ev:matar:explodirChance:10@alvoSangrando$/);
});

test('"quando na Mão Principal / na Mão Secundária": vale só com a peça naquela mão (como o anel esquerdo/direito)', { skip: SEM }, () => {
  assert.deepEqual(traduz('{0}% de chance de Incendiar quando na Mão Principal').efeitos.map((e) => e.stat), ['chance_ignite@naMaoPrincipal']);
  assert.deepEqual(traduz('Adiciona {0} a {1} de Dano de Fogo na Mão Principal').efeitos.map((e) => e.stat), ['added_fire_dmg_min@naMaoPrincipal', 'added_fire_dmg_max@naMaoPrincipal']);
  assert.deepEqual(traduz('+{0}% de Chance de Bloquear o Dano de Ataques quando na Mão Secundária').efeitos.map((e) => e.stat), ['block@naMaoSecundaria']);
  assert.equal(C.doAnel('chance_ignite@naMaoPrincipal', 'weapon'), 'chance_ignite');
  assert.equal(C.doAnel('chance_ignite@naMaoPrincipal', 'shield'), null, 'na outra mão, nada');
  assert.equal(C.doAnel('block@naMaoSecundaria', 'shield'), 'block');
  // Na soma do personagem: a mesma peça nas duas mãos — só a da mão certa conta.
  const peca = { poe: { af: { 'chance_ignite@naMaoPrincipal': 20, 'block@naMaoSecundaria': 7 } } };
  const total = Afixos.somaDeItens({ equipment: { weapon: peca, shield: peca } });
  assert.equal(total.chance_ignite, 20);
  assert.equal(total.block, 7);
});

test('"{n}% de aumento do X" vira a forma das regras ("X aumentado em {n}%"), com a condição do fim da frase', { skip: SEM }, () => {
  assert.deepEqual(traduz('{0}% de aumento da Velocidade de Movimento caso tenha Acertado um Inimigo Recentemente').efeitos.map((e) => e.stat), ['move_speed@acertouRecente']);
  assert.deepEqual(traduz('{0}% de aumento do Dano Elemental se você causou um Acerto Crítico Recentemente').efeitos.map((e) => e.stat), ['fire_dmg@criticoRecente', 'ice_dmg@criticoRecente', 'energy_dmg@criticoRecente']);
  assert.equal(traduz('{0}% de aumento do Pulo Duplo').estado, 'registrado', 'sem regra para o X: continua sem efeito');
});

test('os suportes com outro nome na coleção (Ataques Rápidos = Ataques Acelerados…) e o tipo de gema de mais de uma palavra', { skip: SEM }, () => {
  const casos = {
    'Gemas Encaixadas são Suportadas por Ataques Rápidos nível {0}': 'suporte_local:ataques-acelerados',
    'Gemas Encaixadas são Suportadas por Golpe Múltiplo nível {0}': 'suporte_local:ataques-multiplos',
    'Gemas Encaixadas são Suportadas por Efeito em Área Aumentado Nível {0}': 'suporte_local:area-de-efeito-aumentada',
    'Gemas Encaixadas são Suportadas por Gelo para Fogo nível {0}': 'suporte_local:gelo-a-fogo',
    'Gemas de Maldição Encaixadas são Suportadas por Blasfêmia Nível {0}': 'suporte_local:blasfemia',
    'Gemas Encaixadas são Suportadas por Bênção Divina {0}': 'suporte_local:bencao-divina',
  };
  for (const [texto, stat] of Object.entries(casos)) {
    const r = traduz(texto);
    assert.ok(COM_EFEITO.includes(r.estado), `${texto}: ${r.estado} ${r.nota ?? ''}`);
    assert.equal(r.efeitos[0].stat, stat);
  }
});

test('as regras novas: o atributo, a condição ou o evento que o jogo já tem', { skip: SEM }, () => {
  const casos = {
    'Habilidades de Clamor têm Efeito em Área aumentado em {0}%': ['area_inc@clamor'],
    'Velocidade de Recarga do Clamor aumentada em {0}%': ['cooldown_recovery@clamor'],
    'Ganha uma Carga de Frenesi ao atingir o máximo de Cargas de Poder': ['ev:maxPoder:carga:frenesi'],
    'Ganha {0}% do dano físico como dano de frio adicional se você usou um Frasco de Safira recentemente': ['phys_as_extra_ice@usouSafiraRecente'],
    'Evasão aumentada em {0}% enquanto Agressividade estiver ativo': ['evasion_pct@buff:agressividade'],
    'Cada Fúria também concede +{0}% ao multiplicador de dano de fogo degenerativo': ['dot_multi_fire%furia'],
    '+{0} de Armadura por cada {1} de Evasão no Escudo Equipado': ['armor_flat%evasaoEscudo:10'],
    'Dano de Ataques aumentado em {0}% a cada {1} de Evasão': ['dmg_inc%evasao:10@ataque'],
    'Recupere {0} da Vida quando sua Armadilha for ativada por um Inimigo': ['ev:armadilha:vida'],
    'Perde {0}% de Vida ao causar um Golpe Crítico': ['ev:critico:perdeVidaPct'],
    'Imune à Maldições': ['imune_maldicao'],
    'Não Pode Drenar quando em Vida Baixa': ['sem_roubo_vida@vidaBaixa', 'sem_roubo_mana@vidaBaixa'],
    'Ataques Custam Vida ao invés de Mana': ['custo_em_vida_pct@ataque'],
    'Habilidades de Fogo têm {0}% de chance de Envenear ao Acertar': ['chance_poison@fogo'],
    '+{0} ao número máximo de Zumbis a cada {1} de Força': ['max_lacaio:zumbi%atr:str:10'],
    'Ganha {0}% do Dano Físico como Dano Extra de um Elemental aleatório enquanto estiver Incendiado': ['phys_as_extra_random@ardendo'],
    'Dano Penetra {0}% das Resistências Elementais enquanto você estiver Resfriado': ['elem_pen@resfriadoProprio'],
    'Adiciona {0} a {1} de Dano de Caos em Magias e Ataques durante qualquer Efeito de Frasco': ['added_chaos_dmg_min@duranteFrasco', 'added_chaos_dmg_max@duranteFrasco', 'spell_added_chaos_dmg_min@duranteFrasco', 'spell_added_chaos_dmg_max@duranteFrasco'],
  };
  for (const [texto, stats] of Object.entries(casos)) {
    const r = traduz(texto);
    assert.ok(COM_EFEITO.includes(r.estado), `${texto}: ${r.estado}`);
    assert.deepEqual(r.efeitos.map((e) => e.stat), stats, texto);
  }
  // O que é aproximado diz a diferença.
  assert.match(traduz('Inimigos Congelados por você têm {0}% de Dano sofrido aumentado').nota, /dos seus acertos/);
});

test('trava contra regressão: as linhas de armas e armaduras únicas que não funcionam não voltam a subir (rodada 1: 960 → 838)', { skip: SEM }, () => {
  const ARMAS = /One_Hand|Two_Hand|Thrusting|Sceptres|Staves|Warstaves|Claws|Daggers|Rune_Daggers|Bows|Wands/;
  const ARMADURAS = /Body_Armours|Helmets|Gloves|Boots|Shields|Quivers/;
  const d = Pendencias.pendencias();
  const ruins = d.linhas.filter((l) => l.origem === 'unico' && l.classes.some((c) => ARMAS.test(c) || ARMADURAS.test(c)) && ['pendente', 'inexiste'].includes(l.estado));
  assert.ok(ruins.length <= 838, `${ruins.length} linhas sem funcionar (eram 838 depois da rodada 1)`);
  assert.ok(d.unicos.completos >= 553, `${d.unicos.completos} únicos com todos os mods funcionando (eram 553)`);
});
