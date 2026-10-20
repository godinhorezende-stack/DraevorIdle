// (lote A5, dono 20/10) OS SUPORTES SIMPLES E AS LINHAS DAS FAMÍLIAS 1–4 (os planos f12 e f34, todas as recomendações aceitas): os atributos lidos no uso
// (o dreno, a Fortificação, o Empalamento, o Golpe de Misericórdia, o reflexo, o alcance, as duas armas, a Eletrização, o Resfriamento, a Exposição e a
// resistência), a qualidade acima de 20 (D2), o dano da arma como magia (D7), a janela de Retaliação por gema (D8), o Empalamento refletido (D4), o
// Condutor Elétrico (D1/D2), o Resfriamento Ósseo (D5), o Coursing Current (D6) e a Exposição numa função só (D10). Os sorteios ficam travados.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
const Acoes = await import('../systems/acoes.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const G = await import('../systems/itens-poe/gemas-poe.mjs');
const SP = await import('../systems/itens-poe/suportes-poe.mjs');
const L = await import('../systems/itens-poe/linhas-das-gemas.mjs');
const A5 = await import('../systems/itens-poe/gemas-a5.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const AfeccoesPoe = await import('../systems/itens-poe/afeccoes.mjs');
const NoJogador = await import('../systems/itens-poe/monstros-no-jogador.mjs');
const QuemFeriu = await import('../systems/hunt/quem-feriu.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');

let J;
let gerarPeca;
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
const perto = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

/** Roda `fn` com o `Math.random` travado em `v`. */
function travado(v, fn) {
  const antes = Math.random;
  Math.random = () => v;
  try { return fn(); } finally { Math.random = antes; }
}
const doSlug = (s) => G.doSlug(s) ?? SP.doSlug(s);
/** O personagem com as gemas na arma (e na secundária), numa caçada; o alvo imortal colado e os outros longe. */
async function montar(slugs, { arma = 'One_Hand_Swords/Rusted_Sword', escudo = 'Shields/Splintered_Tower_Shield', nivel = 20, niveis = {} } = {}) {
  J ??= await import('../systems/itens-poe/jogo.mjs');
  gerarPeca ??= (await import('../systems/itens-poe/gerar.mjs')).gerarPeca;
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Scion', sistema: 'poe' });
  const a = peca(arma);
  a.soquetes = { abertos: slugs.length, links: Array(Math.max(0, slugs.length - 1)).fill(true), gemas: Array(slugs.length).fill(null), cores: Array(slugs.length).fill('W') };
  e.equipment = { ...e.equipment, weapon: a };
  if (escudo) e.equipment.shield = peca(escudo);
  else delete e.equipment.shield;
  e.inventory = slugs.map((s) => GS.itemDaGema({ id: doSlug(s).itemId, nivel: niveis[s] ?? nivel, xp: 0, raridade: 'comum' }));
  for (let i = 0; i < slugs.length; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: G.doSlug(slugs[0]).acao, enabled: true, minMana: 0, conditions: [] };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(travado(0.5, () => Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' })).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 1e7;
  e.maxHp = e.hp = 1e7;
  const [b, ...resto] = e.hunt.monstros;
  for (const m of resto) Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60 });
  Object.assign(b, { x: e.hunt.pos.x + 1, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12, estados: {} });
  return { e, b, entry: Acoes.entradaDaAcao?.(G.doSlug(slugs[0]).acao) ?? null };
}
const efeito = (e, slug) => GS.efeitoNaSkill(e, G.doSlug(slug).acao);
const ATIVA = (...t) => ({ tags: t.map((x) => `poe:${x}`) });
const bicho = (extra = {}) => ({ uid: 'b', name: 'Alvo', x: 10, y: 10, hp: 1000, maxHp: 1000, estados: {}, ...extra });
const fichaCom = (af = {}, porTag = [], tags = ['habilidade']) => ({ afPoe: af, porTag, tagsDoGolpe: tags });

// ---------------------------------------------------------------- as linhas viram atributos (família 1 a 4)

test('A5: as linhas das gemas e dos suportes viram os atributos lidos no uso', { skip: SEM }, () => {
  const casos = {
    '1.9% do Dano Drenado como Escudo de Energia': { es_leech: 1.9 },
    '4 % do Dano Mágico Drenado como Escudo de Energia': { es_leech_magia: 4 },
    '24% de Duração de Efeito da Habilidade aumentada': { duracao_habilidades: 24 },
    'Duração da Fortificação aumentada em 20%': { fortificacao_duracao_inc: 20 },
    'Acertos Corpo a Corpo Fortificam por 8 segundos': { 'chance_fortificar@corpo': 100, fortificacao_base_s: 8 },
    '60% de chance de Empalar Inimigos ao Acertar': { chance_empalar: 60 },
    'O Efeito de Empalamento aumentdo em 28%': { efeito_empalamento: 28 },
    'Golpe Críticos infligem Empalamento': { 'chance_empalar@critico': 100 },
    'Golpes Críticos não causam Dano extra': { critico_sem_dano_extra: 1 },
    'Mata inimigos de raridade normal e mágica com 34% de vida ou menos quando atingidos por habilidades reforçadas': { culling_normal_magico: 34 },
    'Dano Elemental não pode ser Refletido': { imune_reflexo_elemental: 1 },
    '20% de Duração de Atordoamentos em Inimigos aumentada': { stun_duration: 20 },
    'Golpes Finais fazem com que os Empalamentos em Inimigos Reflitam o Dano aos Inimigos ao redor': { empalar_reflete_ao_matar: 1 },
    '+2.1 metros ao Alcance de Golpes Corpo a Corpo': { alcance_corpo_m: 2.1 },
    'Quando em Empunhadura Dupla, 30 % Menos Velocidade de Ataque': { 'atk_speed_mais@duasArmas': -30 },
    'ㅤ- 20 % de dano de ataque com duas armas': { 'mais_dano_acerto@duasArmas': -20 },
    '+10 % ao Máximo de Efeito da Eletrização': { eletrizacao_maximo: 10 },
    'Anel sempre Eletriza': { chance_shock: 100 },
    'Eletrizam Inimigos como se causassem 690% mais Dano': { eletrizacao_como_mais: 690 },
    '20% de Duração de Eletrização aumentada em Inimigos': { duracao_eletrizacao: 20 },
    'Efeito dos Resfriamentos aumentado em 44%': { efeito_resfriamento: 44 },
    '20 % mais Efeito de Resfriamento': { efeito_resfriamento_mais: 20 },
    '+20% de chance de Congelar Inimigos Resfriados': { 'chance_freeze@alvoResfriado': 20 },
    '10% de chance de infligirem Exposição a Fogo ao Acertar': { exposicao_chance_fogo: 10 },
    '10% de chance de infligir Exposição a Raio ao Acertar': { exposicao_chance_raio: 10 },
    'Acertos tratam os valores da Resistência Elemental dos Monstros Inimigos como invertidos': { chance_res_invertida: 100 },
    'Inimigos Incendiados possuem -10% de Resistência a Fogo': { res_menos_fogo_incendiado: 10 },
    'Penetra 30 % da Resistência a Fogo': { fire_pen: 30 },
  };
  for (const [linha, af] of Object.entries(casos)) assert.deepEqual(L.atributosDaLinha(linha), af, linha);
  // (lote A5b, dono 20/10 — aval: a D1 feita, a Precisão Adicional vale no uso)
  assert.deepEqual(L.atributosDaLinha('+1034 de Precisão'), { accuracy: 1034 });
  assert.equal(SP.doSlug('Additional_Accuracy_Support').status, 'funciona');
});

test('A5: os efeitos dos suportes no nível — o Dreno (D3), a qualidade (D2), o nível de Caos, a Vida ao matar, a Retaliação (D8), as armas (D6), a Inversão (D7)', { skip: SEM }, () => {
  const ef = (slug, nivel, ativa, q = 0) => SP.efeitoNoNivel(slug, nivel, q, ativa).efeito;
  // o Dreno: o do PoE nos ataques e nas magias, sem a cura instantânea do Draevor
  const doAtaque = ef('Life_Leech_Support', 20, ATIVA('Ataque', 'Corpo a Corpo'));
  const daMagia = ef('Life_Leech_Support', 20, ATIVA('Magia', 'Fogo'));
  assert.deepEqual([doAtaque['af:life_leech'], doAtaque['af:vida_leech_magia'], doAtaque.leechVidaPct], [3.9, undefined, undefined]);
  assert.deepEqual([daMagia['af:life_leech'], daMagia['af:vida_leech_magia'], daMagia.leechVidaPct], [undefined, 3.9, undefined]);
  assert.equal(ef('Energy_Leech_Support', 20, ATIVA('Magia'))['af:es_leech'], 1.9);
  // a qualidade das gemas suportadas: o Aprimorar no nível 3 (16), o Desperto no 4 (24), o Eclipse no 3 (12, e +1 ao nível)
  assert.equal(ef('Enhance_Support', 3, ATIVA('Magia')).qualidadeExtra, 16);
  assert.equal(ef('Awakened_Enhance_Support', 4, ATIVA('Magia')).qualidadeExtra, 24);
  assert.deepEqual([ef('Eclipse_Support', 3, ATIVA('Magia')).qualidadeExtra, ef('Eclipse_Support', 3, ATIVA('Magia')).nivelExtra], [12, 1]);
  // o Manipulação do Vazio Desperto: +1 só nas gemas de Caos
  assert.equal(ef('Awakened_Void_Manipulation_Support', 5, ATIVA('Magia', 'Caos')).nivelExtra, 1);
  assert.equal(ef('Awakened_Void_Manipulation_Support', 5, ATIVA('Magia', 'Fogo')).nivelExtra, undefined);
  // o Golpe de Misericórdia e o Abater o Fraco
  const golpe = ef('Culling_Strike_Support', 20, ATIVA('Ataque'), 20);
  assert.deepEqual([golpe['af:culling'], golpe.vidaAoMatarPct], [1, 2]);
  assert.equal(ef('Cull_the_Weak_Support', 3, ATIVA('Ataque'))['af:culling_normal_magico'], 34);
  assert.equal(ef('Expert_Retaliation_Support', 20, ATIVA('Ataque')).retaliacaoJanelaPct, 39);
  // as restrições de arma (a Onda de Choque do Vazio segue com a dela)
  assert.equal(ef('Fissure_Support', 1, ATIVA('Ataque', 'Corpo a Corpo')).soMachadoMacaCetroCajado, 1);
  assert.equal(ef('Trauma_Support', 1, ATIVA('Ataque', 'Corpo a Corpo')).soMachadoMacaCetroCajado, 1);
  assert.equal(ef('Shockwave_Support', 1, ATIVA('Ataque', 'Corpo a Corpo')).soMacaCetroCajado, 1);
  assert.equal(ef('Close_Combat_Support', 1, ATIVA('Ataque', 'Corpo a Corpo')).soMachadoEspada, 1);
  assert.equal(ef('Void_Shockwave_Support', 1, ATIVA('Ataque', 'Corpo a Corpo')).soMachadoMacaCetroCajado, 1);
  // a Inversão de Regras (D7: qualquer acerto), a Sobrecarga, o Coursing Current, o Resfriamento Ósseo, a Hipotermia, a Combustão, a Desperta
  assert.equal(ef('Invert_the_Rules_Support', 15, ATIVA('Magia'))['af:chance_res_invertida'], 60);
  assert.deepEqual([ef('Overcharge_Support', 20, ATIVA('Magia'), 20)['af:eletrizacao_como_mais'], ef('Overcharge_Support', 20, ATIVA('Magia'), 20)['af:duracao_eletrizacao']], [690, 20]);
  const corrente = ef('Coursing_Current_Support', 15, ATIVA('Ataque'));
  assert.deepEqual([corrente['af:efeito_resfriamento'], corrente['af:efeito_eletrizacao'], corrente['af:resfria_ao_eletrizar'], corrente['af:eletriza_ao_resfriar']], [76, 76, 2, 2]);
  const osseo = ef('Bonechill_Support', 20, ATIVA('Magia', 'Gelo'));
  assert.deepEqual([osseo['af:efeito_resfriamento'], osseo['af:resfriado_fragil_gelo'], osseo.areaFriaFragilGelo], [44, 1, 1]);
  assert.equal(ef('Hypothermia_Support', 20, ATIVA('Magia', 'Gelo'), 20)['af:chance_freeze@alvoResfriado'], 40);
  assert.equal(ef('Combustion_Support', 20, ATIVA('Magia', 'Fogo'))['af:res_menos_fogo_incendiado'], 10);
  assert.equal(ef('Awakened_Fire_Penetration_Support', 5, ATIVA('Magia', 'Fogo'))['af:exposicao_chance_fogo'], 10);
  assert.equal(ef('Awakened_Fire_Penetration_Support', 4, ATIVA('Magia', 'Fogo'))['af:exposicao_chance_fogo'], undefined);
  assert.equal(ef('Spellblade_Support', 20, ATIVA('Magia')).laminaMagicaPct, 135);
  // os suportes deste lote saíram de "parcial"
  for (const s of ['Life_Leech_Support', 'Energy_Leech_Support', 'Efficacy_Support', 'Fortify_Support', 'Impale_Support', 'Culling_Strike_Support', 'Cull_the_Weak_Support', 'Expert_Retaliation_Support', 'Enhance_Support', 'Awakened_Enhance_Support', 'Eclipse_Support', 'Awakened_Void_Manipulation_Support', 'Awakened_Elemental_Damage_with_Attacks_Support', 'Spellblade_Support', 'Overcharge_Support', 'Bonechill_Support', 'Hypothermia_Support', 'Coursing_Current_Support', 'Awakened_Fire_Penetration_Support', 'Awakened_Cold_Penetration_Support', 'Awakened_Lightning_Penetration_Support', 'Invert_the_Rules_Support', 'Combustion_Support']) {
    assert.equal(SP.doSlug(s).status, 'funciona', `${s}: ${SP.doSlug(s).motivos.join(' | ')}`);
  }
});

// ---------------------------------------------------------------- família 1: o motor

test('A5: a Fortificação do uso — a base de 8 s da Golpe Vigilante e a duração aumentada da qualidade do suporte', { skip: SEM }, () => {
  const h = { clock: 0 };
  ModsPoe.ganharFortificacao(h, 5, {}, 0, { baseS: 8, incPct: 20 });
  assert.equal(h.fortificacao.ate, 9600);
  ModsPoe.ganharFortificacao(h, 5, { fortificacao_duracao_inc: 50 }, 1000);
  assert.equal(h.fortificacao.ate, 1000 + 9000);
});

test('A5: o Abater o Fraco mata o Normal e o Mágico no limiar, não o Raro; o Golpe de Misericórdia segue em 10%', { skip: SEM }, () => {
  const hunt = { clock: 0, monstros: [] };
  const ficha = fichaCom({}, [{ stat: 'culling_normal_magico', tags: ['habilidade'], valor: 34 }]);
  for (const [raridade, morre] of [['normal', true], ['magico', true], ['raro', false], ['elite', false]]) {
    const b = bicho({ hp: 330, raridade });
    travado(0.99, () => ModsPoe.aoAcertar({}, hunt, b, ficha, { dano: 10, agora: 0 }));
    assert.equal(b.hp <= 0, morre, raridade);
  }
  const b = bicho({ hp: 150, raridade: 'normal' });
  travado(0.99, () => ModsPoe.aoAcertar({}, hunt, b, fichaCom({}, [{ stat: 'culling', tags: ['habilidade'], valor: 1 }]), { dano: 10, agora: 0 }));
  assert.equal(b.hp, 150, 'acima de 10%');
});

test('A5: o Golpe Final do Golpe Duplo do Empalamento reflete os Empalamentos do morto a 1 casa (D4)', { skip: SEM }, () => {
  const morto = bicho({ hp: -5, x: 10, y: 10, estados: { empalado: [{ valor: 100, acertos: 3, ate: 10_000 }, { valor: 50, acertos: 1, ate: 10_000 }, { valor: 999, acertos: 2, ate: -1 }] } });
  const vizinho = bicho({ uid: 'v', x: 11, y: 11, hp: 10_000 });
  const longe = bicho({ uid: 'l', x: 12, y: 10, hp: 10_000 });
  const hunt = { clock: 0, monstros: [morto, vizinho, longe] };
  const eventos = [];
  travado(0.99, () => ModsPoe.aoAcertar({}, hunt, morto, fichaCom({}, [{ stat: 'empalar_reflete_ao_matar', tags: ['habilidade'], valor: 1 }]), { dano: 10, agora: 0, eventos }));
  assert.equal(vizinho.hp, 10_000 - 350, '100 × 3 + 50 × 1 (o vencido não conta)');
  assert.equal(longe.hp, 10_000, 'a 2 casas não');
  assert.equal(QuemFeriu.abateSeu(vizinho), true);
  // sem a linha, nada
  const m2 = bicho({ hp: -5, estados: { empalado: [{ valor: 100, acertos: 3, ate: 10_000 }] } });
  const v2 = bicho({ uid: 'v2', x: 11, y: 10, hp: 10_000 });
  travado(0.99, () => ModsPoe.aoAcertar({}, { clock: 0, monstros: [m2, v2] }, m2, fichaCom(), { dano: 10, agora: 0 }));
  assert.equal(v2.hp, 10_000);
});

test('A5: o reflexo elemental pela ficha do golpe (o Ataques Elementais Desperto)', { skip: SEM }, () => {
  const ficha = fichaCom({}, [{ stat: 'imune_reflexo_elemental', tags: ['habilidade'], valor: 1 }]);
  assert.equal(NoJogador.fatorDoReflexo(ficha, 'fire'), 0);
  assert.equal(NoJogador.fatorDoReflexo(ficha, 'physical'), 1);
  assert.equal(NoJogador.fatorDoReflexo(fichaCom(), 'fire'), 1);
});

test('A5: a janela de Retaliação por gema — o "39% maior" da Retaliação Experiente só na suportada (D8)', { skip: SEM }, () => {
  const h = { clock: 0 };
  ModsPoe.abrirRetaliacao(h, 'bloquear', {}, 0);
  assert.equal(ModsPoe.retaliacaoUsavel(h, 'bloquear', 'A', 2500), false);
  assert.equal(ModsPoe.retaliacaoUsavel(h, 'bloquear', 'B', 2500, 39), true);
  assert.equal(ModsPoe.retaliacaoUsavel(h, 'bloquear', 'B', 2790, 39), false);
});

test('A5: a Vida ao matar do suporte — 2% da Vida máxima por inimigo morto por você', { skip: SEM }, async () => {
  const { e } = await montar(['Fireball']);
  e.maxHp = 1000;
  e.hp = 500;
  const mortos = [bicho({ hp: 0 }), bicho({ uid: 'x', hp: -3 }), bicho({ uid: 'y', hp: 20 }), bicho({ uid: 'z', hp: 0 })];
  for (const m of mortos) QuemFeriu.carimbar(m, QuemFeriu.VOCE);
  QuemFeriu.carimbar(mortos[3], QuemFeriu.TOTEM);
  assert.equal(Acoes.vidaAoMatarDoSuporte(e, e.hunt, PERSONAGEM, 2, mortos, []), 40);
  assert.equal(e.hp, 540);
});

test('A5: a qualidade acima de 20 pelo suporte, linear (D2) — o Estalo Gélido com 36% de qualidade', { skip: SEM }, async () => {
  assert.equal(G.linhasLocaisNoNivel('Cold_Snap', 20, 20).af.efeito_resfriamento_mais, 20);
  assert.equal(G.linhasLocaisNoNivel('Cold_Snap', 20, 36).af.efeito_resfriamento_mais, 36);
  const { e } = await montar(['Frostbolt', 'Enhance_Support'], { niveis: { Enhance_Support: 3 } });
  const ef = efeito(e, 'Frostbolt');
  assert.equal(ef.qualidade, 16, 'a gema de qualidade 0 + 16 do Aprimorar nível 3');
});

// ---------------------------------------------------------------- família 2: a arma

test('A5: o alcance corpo a corpo das linhas da gema (as Lâminas Gélidas)', { skip: SEM }, async () => {
  const { e } = await montar(['Frost_Blades']);
  const entry = { poeGema: { slug: 'Frost_Blades', ataque: true } };
  const r = Acoes.alcanceCorpoDoUso(e, entry, efeito(e, 'Frost_Blades'));
  assert.ok(perto(r.metrosExtra, 2.1), `metros a mais: ${r.metrosExtra}`);
  assert.equal(r.casas, Math.floor(Ficha.alcanceCorpoEmMetros(e.equipment.weapon, { alcance_corpo_m: r.metrosExtra }) / 2));
  assert.ok(r.casas >= Ficha.combate(e).alcanceCorpoExtra + 1, 'uma casa a mais que a ficha');
});

test('A5: a restrição de arma dos suportes (D6: a mão principal) — a Onda de Choque só com Maça, o Combate Próximo só com Machado e Espada', { skip: SEM }, async () => {
  const { e, b } = await montar(['Cleave', 'Shockwave_Support']);
  const r = Acoes.disparar(e, e.hunt, PERSONAGEM, 0, b, { manual: true });
  assert.equal(r.motivo, 'ARMA');
  const c = await montar(['Cleave', 'Close_Combat_Support']);
  const r2 = Acoes.disparar(c.e, c.e.hunt, PERSONAGEM, 0, c.b, { manual: true });
  assert.notEqual(r2.motivo, 'ARMA', 'a espada vale');
});

test('A5: o Golpe da Víbora com duas armas soma as duas num acerto (D5) e tem −30% de velocidade e −20% de dano', { skip: SEM }, async () => {
  assert.equal(G.danoComAsDuasArmas('Viper_Strike'), 100);
  assert.equal(G.danoComAsDuasArmas('Viper_Strike_of_the_Mamba'), 100);
  const { e } = await montar(['Viper_Strike'], { escudo: 'One_Hand_Swords/Rusted_Sword' });
  const entry = { poeGema: { slug: 'Viper_Strike', ataque: true } };
  const f = Acoes.comAsLinhasDaGema(e, Ficha.combate(e), entry, efeito(e, 'Viper_Strike'));
  const porTag = f.porTag.filter((x) => x.tags.includes('habilidade'));
  assert.ok(porTag.some((x) => x.stat === 'atk_speed_mais' && x.valor === -30));
  assert.ok(porTag.some((x) => x.stat === 'mais_dano_acerto' && x.valor === -20));
  // com escudo (uma arma), nada disso
  const um = await montar(['Viper_Strike']);
  const f1 = Acoes.comAsLinhasDaGema(um.e, Ficha.combate(um.e), entry, efeito(um.e, 'Viper_Strike'));
  assert.ok(!(f1.porTag ?? []).some((x) => x.tags.includes('habilidade') && (x.stat === 'atk_speed_mais' || x.stat === 'mais_dano_acerto')));
});

test('A5: o Golpe Duplo da Ambidestria usa o tempo da arma secundária', { skip: SEM }, async () => {
  const { e } = await montar(['Dual_Strike_of_Ambidexterity'], { arma: 'One_Hand_Swords/Rusted_Sword', escudo: 'Daggers/Sai' });
  const [p, s] = Ficha.armasEquipadas(e);
  assert.ok(p && s && p.intervaloMs !== s.intervaloMs, 'duas armas com tempos diferentes');
  const f = Acoes.fatorDoTempoDaSecundaria(e, Ficha.combate(e));
  assert.ok(perto(f, s.intervaloMs / ((p.intervaloMs + s.intervaloMs) / 2)), `fator ${f}`);
});

test('A5: a Lâmina Mágica e a Detonação da Adaga — o dano da arma como magia, 60% de cada com duas (D7)', { skip: SEM }, async () => {
  const { e } = await montar(['Fireball'], { arma: 'One_Hand_Swords/Rusted_Sword', escudo: 'Shields/Splintered_Tower_Shield' });
  const [espada] = Ficha.armasEquipadas(e);
  const bola = { poeGema: { slug: 'Fireball', ataque: false } };
  const um = Acoes.danoDeArmaNaMagia(e, bola, { laminaMagicaPct: 135 });
  assert.ok(perto(um.physical[0], espada.min * 1.35) && perto(um.physical[1], espada.max * 1.35));
  const d = await montar(['Fireball'], { arma: 'Daggers/Sai', escudo: 'Daggers/Sai' });
  const [a1, a2] = Ficha.armasEquipadas(d.e);
  const dois = Acoes.danoDeArmaNaMagia(d.e, bola, { laminaMagicaPct: 100 });
  assert.ok(perto(dois.physical[1], (a1.max + a2.max) * 0.6), 'duas armas: 60% de cada');
  const det = Acoes.danoDeArmaNaMagia(d.e, { poeGema: { slug: 'Blade_Blast_of_Dagger_Detonation', ataque: false } }, { nivel: 20 });
  assert.ok(perto(det.physical[0], (a1.min + a2.min) * 6.75 * 0.6), `a Detonação: ${det.physical}`);
  // a de duas mãos não vale na Lâmina Mágica
  const m = await montar(['Fireball'], { arma: 'Two_Hand_Maces/Driftwood_Maul', escudo: null });
  assert.deepEqual(Acoes.danoDeArmaNaMagia(m.e, bola, { laminaMagicaPct: 135 }), {});
});

// ---------------------------------------------------------------- família 3: a Eletrização e o Resfriamento

test('A5: o Condutor Elétrico — 24% mais por cada 5% de Eletrização (D1): × 3,4 com 50%', { skip: SEM }, () => {
  const d = G.condutorDaGema('Lightning_Conduit', 20, 20);
  assert.deepEqual(d, { porCada5Pct: 24, tiraEletrizacao: true, soEletrizados: true, segurarEletrizacao: true });
  assert.ok(perto(A5.maisContraEletrizado(d, 50), 3.4));
  assert.ok(perto(A5.maisContraEletrizado(d, 9.9), 1.24));
  assert.equal(A5.maisContraEletrizado(d, 0), 1);
});

test('A5: o máximo da Eletrização das linhas (a Nova Elétrica: +10 e +10 da qualidade) e o "Anel sempre Eletriza"', { skip: SEM }, () => {
  const af = G.linhasLocaisNoNivel('Shock_Nova', 20, 20).af;
  assert.deepEqual([af.eletrizacao_maximo, af.chance_shock], [20, 100]);
  const b = bicho({ maxHp: 10, hp: 1e6 });
  AfeccoesPoe.aoAcertar(b, [{ elemento: 'energy', dano: 1e6 }], { afeccoes: AfeccoesPoe.daSoma(af), agora: 0, rng: () => 0.99 });
  assert.equal(b.estados.chocado.pct, 70);
});

test('A5: o "mais Efeito de Resfriamento" do Estalo Gélido multiplica no teto; o Resfriamento Ósseo deixa o Gelo sofrido aumentado (D5)', { skip: SEM }, () => {
  const base = bicho({ maxHp: 1000, hp: 1e6 });
  AfeccoesPoe.aoAcertar(base, [{ elemento: 'ice', dano: 100 }], { afeccoes: AfeccoesPoe.daSoma({}), agora: 0, rng: () => 0.99 });
  const b = bicho({ maxHp: 1000, hp: 1e6 });
  AfeccoesPoe.aoAcertar(b, [{ elemento: 'ice', dano: 100 }], { afeccoes: AfeccoesPoe.daSoma({ efeito_resfriamento_mais: 20, resfriado_fragil_gelo: 1 }), agora: 0, rng: () => 0.99 });
  assert.ok(perto(b.estados.lento.pct, Math.round(base.estados.lento.pct * 1.2 * 10) / 10, 1e-9), `${b.estados.lento.pct} vs ${base.estados.lento.pct}`);
  assert.ok(b.estados.fragilGelo?.ate === b.estados.lento.ate);
  assert.equal(base.estados.fragilGelo, undefined);
  // o Gelo sofrido: × (1 + o Resfriamento), uma vez só, mesmo com o da árvore
  const alvo = bicho({ estados: { lento: { ate: 5000, pct: 30 }, fragilGelo: { ate: 5000 } } });
  const ficha = { afPoe: {} };
  assert.ok(perto(ModsPoe.fatorRecebidoPeloBicho(alvo, 'ice', ficha, 0), 1.3));
  assert.ok(perto(ModsPoe.fatorRecebidoPeloBicho(alvo, 'ice', { afPoe: { resfriado_fragil: 1 } }, 0), 1.3));
  assert.ok(perto(ModsPoe.fatorRecebidoPeloBicho(alvo, 'fire', ficha, 0), 1));
  assert.ok(perto(ModsPoe.fatorRecebidoPeloBicho(bicho({ estados: { lento: { ate: 5000, pct: 30 } } }), 'ice', ficha, 0), 1));
});

test('A5: o Coursing Current — a Eletrização que nasce do Resfriamento e o Resfriamento que nasce da Eletrização, sem cascata (D6)', { skip: SEM }, () => {
  const b = bicho({ maxHp: 1000, hp: 1e6 });
  AfeccoesPoe.aoAcertar(b, [{ elemento: 'ice', dano: 100 }], { afeccoes: AfeccoesPoe.daSoma({ eletriza_ao_resfriar: 1 }), agora: 0, rng: () => 0.99 });
  assert.ok(b.estados.lento.pct > 0);
  assert.equal(b.estados.chocado?.pct, b.estados.lento.pct);
  const c = bicho({ maxHp: 1000, hp: 1e6 });
  AfeccoesPoe.aoAcertar(c, [{ elemento: 'energy', dano: 100 }], { afeccoes: AfeccoesPoe.daSoma({ chance_shock: 100, resfria_ao_eletrizar: 1 }), agora: 0, rng: () => 0.5 });
  assert.ok(c.estados.chocado.pct > 0);
  assert.equal(c.estados.lento?.pct, Math.min(30, c.estados.chocado.pct));
  // sem a linha, só a do acerto; o imune a Eletrização não ganha a que nasce
  const d = bicho({ maxHp: 1000, hp: 1e6, imuneChoque: true });
  AfeccoesPoe.aoAcertar(d, [{ elemento: 'ice', dano: 100 }], { afeccoes: AfeccoesPoe.daSoma({ eletriza_ao_resfriar: 1 }), agora: 0, rng: () => 0.99 });
  assert.equal(d.estados.chocado, undefined);
});

test('A5: o −10% de Fogo dos Incendiados da Combustão', { skip: SEM }, () => {
  const b = bicho({ maxHp: 1000, hp: 1e6 });
  AfeccoesPoe.aoAcertar(b, [{ elemento: 'fire', dano: 100 }], { afeccoes: AfeccoesPoe.daSoma({ chance_ignite: 100, res_menos_fogo_incendiado: 10 }), agora: 0, rng: () => 0.5 });
  assert.equal(b.estados.resMenosFogo, 10);
});

test('A5: o Solo Resfriado do Estalo Gélido sai da linha (3 m) e a área do Resfriamento Ósseo marca o Gelo sofrido', { skip: SEM }, () => {
  assert.equal(G.raioDaAreaFriaDaGema('Cold_Snap', 20), 3);
  const h = { clock: 0, monstros: [bicho({ x: 5, y: 5, hp: 100 })] };
  ModsPoe.criarAreaFria(h, { x: 5, y: 5, raioM: 3, segundos: 4, agora: 0, efeitoPct: 12, fragilGelo: true });
  Cacadas.resfriarNasAreasFrias(h, 0);
  const m = h.monstros[0];
  assert.equal(m.estados.lento.pct, 12);
  assert.ok(m.estados.fragilGelo?.ate > 0);
});

// ---------------------------------------------------------------- família 4: a Exposição e a resistência

test('A5: a Exposição numa função só — a mais forte vale; a vencida não conta (D10)', { skip: SEM }, () => {
  const b = bicho();
  ModsPoe.porExposicao(b, 'fire', 25, 2000, 0);
  ModsPoe.porExposicao(b, 'fire', 10, 4000, 1000);
  assert.deepEqual([b.estados.exposicao.fire, b.estados.exposicaoPct.fire], [5000, 25]);
  ModsPoe.porExposicao(b, 'fire', 10, 4000, 6000);
  assert.deepEqual([b.estados.exposicao.fire, b.estados.exposicaoPct.fire], [10_000, 10], 'a de 25 já tinha vencido');
});

test('A5: a Exposição da Bomba Congelante (Gelo −15, 5 s, antes) e da Onda de Convicção (o elemento do maior dano, 4 s, depois)', { skip: SEM }, () => {
  assert.deepEqual(G.exposicaoDaGema('Frost_Bomb', 20), { el: 'ice', pct: 15, duracaoMs: 5000, antes: true });
  assert.deepEqual(G.exposicaoDaGema('Wave_of_Conviction', 20), { el: 'maior', pct: 15, duracaoMs: 4000, antes: false });
  assert.equal(A5.elementoDoMaiorDano({ fire: 30, energy: 50, physical: 900 }), 'energy');
  assert.equal(A5.elementoDoMaiorDano({ physical: 900 }), null);
});

test('A5: a Bomba Congelante no jogo — o alvo fica com −15% de Gelo por 5 s × a Duração', { skip: SEM }, async () => {
  const { e, b } = await montar(['Frost_Bomb']);
  const r = travado(0.5, () => Acoes.disparar(e, e.hunt, PERSONAGEM, 0, b, { manual: true }));
  if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; travado(0.5, () => Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM)); }
  assert.ok(r.ok, r.erro);
  assert.equal(b.estados.exposicaoPct?.ice, 15);
  assert.ok(b.estados.exposicao.ice > e.hunt.clock);
});

test('A5: a resistência invertida do Golpe Selvagem dos Extremos e a penetração da Chuva Explosiva', { skip: SEM }, () => {
  assert.equal(G.linhasLocaisNoNivel('Wild_Strike_of_Extremes', 20, 0).af.chance_res_invertida, 100);
  assert.equal(G.linhasLocaisNoNivel('Blast_Rain', 20, 0).af.fire_pen, 30);
  const ficha = { afPoe: {}, porTag: [{ stat: 'chance_res_invertida', tags: ['habilidade'], valor: 100 }] };
  assert.equal(ModsPoe.fichaDoGolpe(ficha, ['habilidade'], { rng: () => 0.5 }).resInvertida, true);
});

test('A5: o crítico sem dano extra da gema (a Queda de Lâminas do Empalamento)', { skip: SEM }, () => {
  const ficha = { afPoe: {}, critMultiplier: 1.8, porTag: [{ stat: 'critico_sem_dano_extra', tags: ['habilidade'], valor: 1 }] };
  assert.equal(ModsPoe.fichaDoGolpe(ficha, ['habilidade', 'magia']).critMultiplier, 1);
});

// ---------------------------------------------------------------- no jogo (o uso de verdade)

test('A5 no jogo: a Lâmina Mágica soma o dano da espada à Bola de Fogo (× a eficácia)', { skip: SEM }, async () => {
  const { e } = await montar(['Fireball', 'Spellblade_Support']);
  const bola = Acoes.POR_ID_PUBLICO(G.doSlug('Fireball').acao);
  const ef = efeito(e, 'Fireball');
  assert.equal(ef.laminaMagicaPct, 135);
  const com = Acoes.danoMostrado(e, bola, ef);
  const sem = Acoes.danoMostrado(e, bola, { ...ef, laminaMagicaPct: 0 });
  assert.ok(com.max > sem.max, `${com.max} > ${sem.max}`);
});

test('A5 no jogo: o Condutor Elétrico só acerta o Eletrizado, mais forte por cada 5% (D1), e tira a Eletrização (D2); a Eletrização não expira na conjuração', { skip: SEM }, async () => {
  const golpe = async (pct, ate = Infinity) => {
    const { e, b } = await montar(['Lightning_Conduit']);
    if (pct) b.estados.chocado = { ate: e.hunt.clock + ate, pct, dur: 2000 };
    const vida = b.hp;
    const r = travado(0.5, () => {
      const x = Acoes.disparar(e, e.hunt, PERSONAGEM, 0, b, { manual: true });
      if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM); }
      return x;
    });
    assert.ok(r.ok, r.erro);
    return { dano: vida - b.hp, chocado: b.estados.chocado };
  };
  const sem = await golpe(0);
  assert.equal(sem.dano, 0, 'sem Eletrização, o raio não acerta');
  const fraca = await golpe(5);
  const forte = await golpe(50);
  assert.ok(fraca.dano > 0);
  // (a gema de qualidade 0: 20% por cada 5% — × 1,2 com 5%, × 3 com 50% —, e a própria Eletrização no dano sofrido)
  assert.ok(perto(forte.dano / fraca.dano, (3 * 1.5) / (1.2 * 1.05), 0.02), `razão ${forte.dano / fraca.dano}`);
  assert.equal(forte.chocado, undefined, 'a Eletrização saiu');
  // a Eletrização que acabaria no meio da conjuração segue até o raio cair
  const curta = await golpe(50, 1);
  assert.ok(curta.dano > 0, 'acertou mesmo com a Eletrização vencendo durante a conjuração');
  // a dos Céus não tira a Eletrização (só a base)
  assert.equal(G.condutorDaGema('Lightning_Conduit_of_the_Heavens', 20, 0).tiraEletrizacao, false);
});

test('A5 no jogo: a Onda de Convicção põe a Exposição no elemento do maior dano depois da resistência, depois do acerto (D8)', { skip: SEM }, async () => {
  // (lote A5c, com o aval do dono: o Gelo e o Raio vêm dos suportes de dano adicionado e, agora, também da conversão do Físico da Onda — 25% em Raio e 25% em
  // Fogo, `GemasPoe.partesDaMagia`; o Gelo dos suportes segue o maior com o Raio resistido)
  const usar = async (resist) => {
    const { e, b } = await montar(['Wave_of_Conviction', 'Added_Lightning_Damage_Support', 'Added_Cold_Damage_Support']);
    b.resist = resist;
    const r = travado(0.5, () => {
      const x = Acoes.disparar(e, e.hunt, PERSONAGEM, 0, b, { manual: true });
      if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM); }
      return x;
    });
    assert.ok(r.ok, r.erro);
    return { pct: b.estados.exposicaoPct ?? {}, ate: b.estados.exposicao ?? {}, agora: e.hunt.clock };
  };
  // (lote A5c, com o aval do dono: a conversão do Físico das magias entrou — `GemasPoe.partesDaMagia` —, o motivo saiu e a gema não é mais parcial por ele)
  assert.ok(!G.REGISTRO.get('Wave_of_Conviction').motivosNoJogo.some((m) => /conversão do Físico das magias/.test(m)));
  const raioResiste = await usar({ energy: 75 });
  assert.deepEqual(raioResiste.pct, { ice: 15 });
  assert.ok(raioResiste.ate.ice >= raioResiste.agora + 4000);
  const geloResiste = await usar({ ice: 75 });
  assert.deepEqual(geloResiste.pct, { energy: 15 });
});

test('A5 no jogo: o Golpe Duplo da Ambidestria leva o tempo da arma secundária', { skip: SEM }, async () => {
  const { e } = await montar(['Dual_Strike_of_Ambidexterity'], { arma: 'One_Hand_Swords/Rusted_Sword', escudo: 'Daggers/Sai' });
  const entry = Acoes.POR_ID_PUBLICO(G.doSlug('Dual_Strike_of_Ambidexterity').acao);
  const ef = efeito(e, 'Dual_Strike_of_Ambidexterity');
  const ficha = Ficha.combate(e);
  const fator = Acoes.fatorDoTempoDaSecundaria(e, ficha);
  const t = Acoes.temposDaGemaPoe(e, entry, ef, ficha);
  const semFlag = Acoes.temposDaGemaPoe(e, entry, ef, { ...ficha, duasArmas: false });
  assert.ok(fator !== 1);
  const chave = Object.keys(t).find((k) => typeof t[k] === 'number' && typeof semFlag[k] === 'number' && t[k] !== semFlag[k]);
  assert.ok(chave, `o tempo mudou: ${JSON.stringify(t)} / ${JSON.stringify(semFlag)}`);
});

test('A5 no jogo: as Lâminas Gélidas alcançam o alvo a 2 casas (o +2.1 m da gema)', { skip: SEM }, async () => {
  const { e, b } = await montar(['Frost_Blades']);
  b.x = e.hunt.pos.x + 2;
  const r = travado(0.5, () => Acoes.disparar(e, e.hunt, PERSONAGEM, 0, b, { manual: true }));
  assert.notEqual(r.motivo, 'FORA_DE_ALCANCE', r.erro);
});

test('A5 (revisão): a Fortificação de duração menor não encurta a que corre', { skip: SEM }, () => {
  const h = { clock: 0 };
  ModsPoe.ganharFortificacao(h, 5, {}, 0, { baseS: 8 });
  ModsPoe.ganharFortificacao(h, 5, {}, 100);
  assert.deepEqual(h.fortificacao, { n: 10, ate: 8000 });
});

test('A5 (revisão): o Empalamento refletido também quando o Golpe de Misericórdia mata', { skip: SEM }, () => {
  const alvo = bicho({ hp: 80, x: 10, y: 10, estados: { empalado: [{ valor: 5, acertos: 3, ate: 10_000 }] } });
  const vizinho = bicho({ uid: 'v', x: 11, y: 10, hp: 10_000 });
  const ficha = fichaCom({}, [{ stat: 'empalar_reflete_ao_matar', tags: ['habilidade'], valor: 1 }, { stat: 'culling', tags: ['habilidade'], valor: 1 }]);
  travado(0.99, () => ModsPoe.aoAcertar({}, { clock: 0, monstros: [alvo, vizinho] }, alvo, ficha, { dano: 10, agora: 0 }));
  assert.equal(alvo.hp, 0, 'o Golpe de Misericórdia matou (75 de 1000)');
  // (o acerto solta o empalamento no vivo — 5, um acerto a menos —, e o culling reflete o que sobrou: 5 × 2)
  assert.equal(vizinho.hp, 10_000 - 10);
});

test('A5 (revisão): a Manipulação do Vazio tira só a parte elemental; os bônus condicionais do Dreno', { skip: SEM }, async () => {
  const ef = (slug, nivel, ativa, q = 0) => SP.efeitoNoNivel(slug, nivel, q, ativa).efeito;
  const v = ef('Void_Manipulation_Support', 20, ATIVA('Magia', 'Raio', 'Caos'));
  assert.deepEqual([v.semDanoElemental, v.maisDanoPct > 0], [1, true]);
  const { e } = await montar(['Fireball', 'Void_Manipulation_Support']);
  const bola = Acoes.POR_ID_PUBLICO(G.doSlug('Fireball').acao);
  assert.deepEqual(Acoes.danoMostrado(e, bola, efeito(e, 'Fireball')), { min: 0, max: 0 }, 'a Bola de Fogo, só Fogo, não fere');
  const vida = ef('Life_Leech_Support', 20, ATIVA('Ataque'), 20);
  assert.deepEqual([vida['af:dmg_inc@drenandoVida'], vida.danoPct], [10, undefined]);
  const es = ef('Energy_Leech_Support', 20, ATIVA('Magia'), 20);
  assert.deepEqual([es['af:mais_dano@escudoCheio'], es['af:dmg_inc@drenandoEs'], es.maisDanoPct, es.danoPct], [24, 20, undefined, undefined]);
});

test('A5 (revisão): o Golpe Selvagem dos Extremos paga Mana, Vida e Escudo de Energia; o Golpe Vigilante pula a recarga com Tolerância', { skip: SEM }, async () => {
  assert.equal(G.recursoDoCusto('Wild_Strike_of_Extremes', 20), 'todos');
  const { e, b } = await montar(['Wild_Strike_of_Extremes']);
  e.es = 1000;
  const antes = { mana: e.mana, hp: e.hp, es: e.es };
  const r = travado(0.5, () => Acoes.disparar(e, e.hunt, PERSONAGEM, 0, b, { manual: true }));
  assert.ok(r.ok, r.erro);
  const gasto = [antes.mana - e.mana, antes.hp - e.hp, antes.es - e.es];
  assert.ok(gasto[0] > 0 && gasto[1] === gasto[0] && gasto[2] === gasto[0], `gastos ${gasto}`);
  const { CARGA_QUE_PULA_A_RECARGA } = await import('../systems/itens-poe/movimento-a1b.mjs');
  assert.equal(CARGA_QUE_PULA_A_RECARGA.Vigilant_Strike, 'tolerancia');
});

test('A5 (revisão): a qualidade acima de 20 também no bônus por afecção e no balão (D2)', { skip: SEM }, () => {
  assert.equal(G.extrasDoAtaque('Elemental_Hit_of_the_Spectrum', 20, 20).porAfeccao, 15);
  assert.equal(G.extrasDoAtaque('Elemental_Hit_of_the_Spectrum', 20, 36).porAfeccao, 19);
  const f = G.fichaNoNivel('Cold_Snap', 20, 36);
  assert.equal(f.qualidade, 36);
  assert.ok(f.modsDaQualidade.some((m) => /36 % mais Efeito de Resfriamento/.test(m)), f.modsDaQualidade.join(' | '));
});

// ---------------------------------------------------------------- o status

test('A5: as gemas ativas deste lote saíram de "parcial"', { skip: SEM }, () => {
  for (const s of ['Vigilant_Strike', 'Double_Strike_of_Impaling', 'Dual_Strike_of_Ambidexterity', 'Frost_Blades', 'Frost_Blades_of_Katabasis', 'Viper_Strike', 'Blade_Blast_of_Dagger_Detonation', 'Bladefall_of_Impaling', 'Blast_Rain', 'Wild_Strike_of_Extremes', 'Lightning_Tendrils_of_Escalation', 'Crackling_Lance_of_Disintegration', 'Shock_Nova', 'Soulrend', 'Soulrend_of_Reaping']) {
    assert.equal(G.REGISTRO.get(s).statusNoJogo, 'funciona', `${s}: ${G.REGISTRO.get(s).motivosNoJogo.join(' | ')}`);
  }
  // as que seguem parciais por outras linhas, sem as deste lote
  // (lote B1, com o aval do dono 20/10: o Condutor Elétrico ficou completo — a conjuração vai para a recarga quando ativado, `GemasPoe.conjuracaoNaRecargaSeAtivada`)
  assert.deepEqual(G.REGISTRO.get('Lightning_Conduit').motivosNoJogo, []);
  assert.ok(!G.REGISTRO.get('Frost_Bomb').motivosNoJogo.some((m) => /Exposição/.test(m)));
  assert.ok(!G.REGISTRO.get('Cold_Snap').motivosNoJogo.some((m) => /Solo Resfriado|Efeito de Resfriamento/.test(m)));
});
