// (dono, 02/11: o jogo "100%" — nenhuma linha sem efeito) As linhas da SALVAGUARDA (Ward; no poedb pt "Proteção") que ficaram sem efeito no 02/11 passam a valer, como
// no PoE / no PoB (`personagem/salvaguarda.mjs`): o Dano de Caos igual a 10% da Proteção (o Aperto Noturno — o PoB: PercentStat Ward), a Decisão de Olroth ("Proteção não
// Quebra durante o Efeito" — WardNotBreak — e "85% menos Proteção durante o Efeito"), a Preparação de Vorana ("Efeito é removido quando a Proteção Quebrar"), a Postura de
// Ynda (ConvertBodyArmourArmourEvasionToWard) e as das Joias Atemporais: "enquanto Intacta/Rompida" (UnbrokenWard), "+N por N de Armadura/Evasão/Escudo da peça" (PerStat),
// a Evasão e a redução física pela Salvaguarda, "60% de chance de não se Romper" (WardAvoidBreakChance), o ataque que rompe, os Frascos de Ferro e a Afecção removida.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
const Acoes = await import('../systems/acoes.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const Frascos = await import('../systems/itens-poe/frascos.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Condicoes = await import('../systems/itens-poe/condicoes-poe.mjs');
const Salvaguarda = await import('../systems/personagem/salvaguarda.mjs');
const Defesa = await import('../systems/personagem/defesa.mjs');
const { armorDoPersonagem } = await import('../systems/hunt/combate.mjs');
const { traduzirLinha } = await import('../systems/itens-poe/arvore.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const { faixaDoCampo } = await import('../systems/itens/item.mjs');

const peca = (base, extra = {}) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 70, rng: () => 0.5, ...extra }));
const unico = (base, slug) => peca(base, { raridade: 'unico', unico: slug });
const comAf = (p, af) => { p.poe.af = { ...p.poe.af, ...af }; return p; };
const meio = (p, campo) => { const [a, b] = faixaDoCampo(p, campo); return (a + b) / 2; };

/** O personagem do PoE com as peças `equip` vestidas, numa caçada (o mesmo do salvaguarda-poe). */
function montar(equip = {}) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'sorcerer', level: 90 }), { classePoe: 'Witch', sistema: 'poe' });
  e.equipment = { ...e.equipment, weapon: peca('Wands/Driftwood_Wand', { ilvl: 60 }), ...equip };
  delete e.equipment.shield;
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.inventory = [];
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  const antes = Math.random;
  Math.random = () => 0.5;
  try { assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok); } finally { Math.random = antes; }
  e.hunt.clock = 100_000;
  e.maxHp = e.hp = 1e6;
  Ficha.invalidar(e);
  return e;
}

// ---------------------------------------------------------------- a tradução: nenhuma fica sem efeito

test('as linhas da Salvaguarda dos únicos e das Atemporais têm regra com efeito (nenhuma inerte nem registrada), sem a nota de "sem efeito"', { skip: SEM }, () => {
  const linhas = [
    'Ganha Dano de Caos Adicional igual a 10% da Proteção', 'Proteção não Quebra durante o Efeito', '85% menos Proteção durante o Efeito', 'Restaura Proteção ao usar',
    'Efeito é removido quando a Proteção Quebrar', 'Ganhe Proteção ao invés de 50% da Armadura e Evasão do Peitoral Equipado',
    'Armadura aumentada em 30% enquanto você tiver Salvaguarda Intacta', 'Evasão aumentada em 30% enquanto você tiver Salvaguarda Intacta', 'Dano aumentado em 30% enquanto você tiver Salvaguarda Intacta',
    'Dano Penetra 8% das Resistências Elementais enquanto sua Salvaguarda estiver Rompida', 'Efeito das Auras Não-Maldição das suas habilidades aumentado em 12% enquanto sua Salvaguarda estiver Rompida',
    '+2 de Salvaguarda por 10 de Armadura no Elmo Equipado', '+4 de Salvaguarda por 10 de Evasão nas Luvas Equipadas', '+8 de Salvaguarda por 10 de Escudo de Energia nas Botas Equipadas',
    'Remove uma Afecção Danificadora aleatória quando a Salvaguarda é Restaurada', 'Frascos de Ferro ganham 2 cargas quando sua Salvaguarda se Rompe',
    'A Chance de Evadir Acertos se baseia em 200% da sua Salvaguarda em vez da sua Evasão', 'A Redução de Dano Físico de Acertos se baseia em 200% da sua Salvaguarda em vez da sua Armadura',
    'A Salvaguarda tem 60% de chance de não se Romper',
    'Enquanto você tiver Salvaguarda Intacta, seu próximo Ataque sem canalização usado por você rompe sua Salvaguarda para ganhar Dano de Gelo Adicional igual a 25% da Salvaguarda',
  ];
  for (const l of linhas) {
    const t = traduzirLinha(l);
    assert.ok(['equivalente', 'novo', 'aproximado'].includes(t.estado), `${l}: ${t.estado}`);
    assert.ok(t.efeitos.length > 0, l);
    assert.doesNotMatch(t.nota ?? '', /sem efeito|não tem efeito|não se aplica/, l);
  }
  const ef = (l) => Object.fromEntries(traduzirLinha(l).efeitos.map((x) => [x.add, x.valor]));
  assert.deepEqual(ef('Ganha Dano de Caos Adicional igual a 10% da Proteção'), { 'added_chaos_dmg_min%pctSalvaguarda:10': 1, 'added_chaos_dmg_max%pctSalvaguarda:10': 1, 'spell_added_chaos_dmg_min%pctSalvaguarda:10': 1, 'spell_added_chaos_dmg_max%pctSalvaguarda:10': 1 });
  assert.deepEqual(ef('+2 de Salvaguarda por 10 de Armadura no Elmo Equipado'), { 'salvaguarda%armaduraElmo:10': 2 });
  assert.deepEqual(ef('Dano Penetra 8% das Resistências Elementais enquanto sua Salvaguarda estiver Rompida'), { 'elem_pen@salvaguardaRompida': 8 });
  assert.deepEqual(ef('A Salvaguarda tem 60% de chance de não se Romper'), { salvaguarda_chance_nao_romper: 60 });
  // a peça única recalculada (a tradução 75) leva os atributos
  assert.equal(J.VERSAO_DA_TRADUCAO, 84); // aval do dono 03/11: a tradução subiu nos lotes 100% (75 → 83); 04/11: 84 (as Réplicas e o Filho da Violência)
  const ynda = unico('Belts/Studded_Belt', 'Yndas_Stand');
  assert.equal(ynda.poe.af.peitoral_em_salvaguarda_pct, 50);
});

// ---------------------------------------------------------------- o Aperto Noturno

test('o Aperto Noturno: o Dano de Caos adicionado aos ataques e às magias é 10% da Salvaguarda máxima (a segunda passada da ficha)', { skip: SEM }, () => {
  const luvas = unico('Gloves/Runic_Gages', 'Nightgrip');
  const coroa = peca('Helmets/Runic_Crown');
  const e = montar({ gloves: luvas, head: coroa });
  const f = Ficha.combate(e);
  assert.ok(f.salvaguarda > 100, `Salvaguarda ${f.salvaguarda}`);
  const dez = Math.floor(f.salvaguarda / 10);
  assert.equal(f.afPoe.added_chaos_dmg_min, dez);
  assert.equal(f.afPoe.added_chaos_dmg_max, dez);
  assert.equal(f.afPoe.spell_added_chaos_dmg_min, dez);
  assert.equal(f.afPoe.spell_added_chaos_dmg_max, dez);
  assert.deepEqual(f.danoSomadoMagia?.chaos?.slice?.(0, 2) ?? [dez, dez], [dez, dez]);
});

// ---------------------------------------------------------------- a Decisão de Olroth e a Preparação de Vorana

test('a Decisão de Olroth: durante o efeito a Salvaguarda tem 85% menos e não quebra — segura cada acerto até o que tem, sem descer', { skip: SEM }, () => {
  const coroa = peca('Helmets/Runic_Crown');
  const e = montar({ head: coroa });
  const cheia = Ficha.combate(e).salvaguarda;
  const olroth = unico('Utility_Flasks/Iron_Flask', 'Olroths_Resolve');
  const par = Frascos.parametros(olroth);
  assert.deepEqual(par.linhas.filter((l) => /Proteção/.test(l.texto)).map((l) => l.estado), ['efeito', 'efeito', 'efeito']);
  assert.ok(par.estadosPorMod.every((x) => x === 'equivalente'), par.estadosPorMod.join());
  e.frascos = [olroth, null, null, null, null];
  // (só à mão: o uso automático o usaria de novo no tique)
  assert.ok(Frascos.configurar(e, { vaga: 0, emCombate: false }).ok);
  assert.equal(Frascos.usar(e, 0), true);
  Ficha.invalidar(e);
  const f = Ficha.combate(e);
  assert.equal(f.salvaguarda, Math.round(cheia * 0.15), '85% menos');
  assert.equal(Salvaguarda.naoQuebra(f), true);
  const max = f.salvaguarda;
  for (let i = 0; i < 5; i++) assert.equal(Salvaguarda.absorver(e, e.hunt, f, max + 40, [], null, PERSONAGEM), 40, 'cada acerto: só o que passa da Salvaguarda');
  assert.equal(Salvaguarda.atual(e, f), max, 'não desceu');
  assert.ok(!e.salvaguardaQuebrada && !(e.salvaguardaEspera > 0));
  assert.ok(Condicoes.condicoesDe(e, f.afPoe).has('salvaguardaIntacta'), 'intacta (o PoB: UnbrokenWard durante o efeito)');
  assert.ok(!Condicoes.condicoesDe(e, f.afPoe).has('salvaguardaRompivel'), 'o ataque da Atemporal não a rompe');
  // o efeito acaba: a Salvaguarda volta ao máximo de sempre e quebra de novo
  e.hunt.clock += 10_000;
  Frascos.tique(e);
  Ficha.invalidar(e);
  const g = Ficha.combate(e);
  assert.equal(g.salvaguarda, cheia);
  assert.equal(Salvaguarda.naoQuebra(g), false);
  Salvaguarda.absorver(e, e.hunt, g, cheia + 1, [], null, PERSONAGEM);
  assert.equal(e.salvaguarda, 0);
});

test('a Preparação de Vorana: o efeito do frasco (o Golpe Abatedor) acaba quando a Salvaguarda quebra', { skip: SEM }, () => {
  const e = montar({ head: peca('Helmets/Runic_Crown') });
  const vorana = unico('Utility_Flasks/Iron_Flask', 'Voranas_Preparation');
  const par = Frascos.parametros(vorana);
  assert.equal(par.saiNaQuebra, true);
  assert.equal(par.linhas.find((l) => /Proteção Quebrar/.test(l.texto)).estado, 'efeito');
  e.frascos = [vorana, null, null, null, null];
  assert.ok(Frascos.configurar(e, { vaga: 0, emCombate: false }).ok);
  assert.equal(Frascos.usar(e, 0), true);
  Ficha.invalidar(e);
  assert.ok(Number(Ficha.combate(e).afPoe.culling) > 0, 'o Golpe Abatedor durante o efeito');
  const f = Ficha.combate(e);
  Salvaguarda.absorver(e, e.hunt, f, f.salvaguarda + 1, [], null, PERSONAGEM);
  assert.equal(e.salvaguarda, 0, 'quebrou');
  assert.equal(e.hunt.poeFichaMudou, true, 'a ficha é refeita');
  assert.equal(Frascos.tique(e), true, 'o efeito saiu');
  assert.equal(e.hunt.frascosPoe.ativos[0], undefined);
  Ficha.invalidar(e);
  assert.ok(!(Number(Ficha.combate(e).afPoe.culling) > 0), 'sem o Golpe Abatedor');
});

// ---------------------------------------------------------------- a Postura de Ynda

test('a Postura de Ynda: 50% da Armadura e da Evasão do peitoral saem delas e viram Salvaguarda da base (× a Salvaguarda aumentada)', { skip: SEM }, () => {
  const corpo = peca('Body_Armours/Scale_Doublet');
  const ar = meio(corpo, 'armor');
  const ev = meio(corpo, 'evasion');
  assert.ok(ar > 0 && ev > 0, `a túnica: ${ar}/${ev}`);
  const sem = Ficha.combate(montar({ body: corpo, belt: peca('Belts/Studded_Belt') }));
  const com = Ficha.combate(montar({ body: corpo, belt: unico('Belts/Studded_Belt', 'Yndas_Stand') }));
  assert.equal(sem.salvaguarda, 0);
  assert.equal(com.salvaguarda, Math.round((ar + ev) * 0.5));
  assert.ok(com.armor < sem.armor && com.evasion < sem.evasion, 'a Armadura e a Evasão do peitoral caem');
  // com "Salvaguarda aumentada em 20%" (uma Atemporal), a parte convertida cresce
  const comMais = Ficha.combate(montar({ body: corpo, belt: comAf(unico('Belts/Studded_Belt', 'Yndas_Stand'), { salvaguarda_pct: 20 }) }));
  assert.equal(comMais.salvaguarda, Math.round((ar + ev) * 0.5 * 1.2));
});

// ---------------------------------------------------------------- as Joias Atemporais

test('Atemporais: "+2/+4/+8 de Salvaguarda por 10 de Armadura no Elmo / Evasão nas Luvas / Escudo nas Botas" — pela defesa de cada peça', { skip: SEM }, () => {
  const elmo = peca('Helmets/Iron_Hat');
  const luvas = peca('Gloves/Goathide_Gloves');
  const botas = peca('Boots/Wool_Shoes');
  const anel = comAf(peca('Rings/Iron_Ring'), { 'salvaguarda%armaduraElmo:10': 2, 'salvaguarda%evasaoLuvas:10': 4, 'salvaguarda%esBotas:10': 8 });
  const e = montar({ head: elmo, gloves: luvas, feet: botas, ring: anel });
  const esperado = 2 * Math.floor(meio(elmo, 'armor') / 10) + 4 * Math.floor(meio(luvas, 'evasion') / 10) + 8 * Math.floor(meio(botas, 'es') / 10);
  assert.ok(esperado > 0, `as peças: ${meio(elmo, 'armor')}/${meio(luvas, 'evasion')}/${meio(botas, 'es')}`);
  assert.equal(Ficha.combate(e).salvaguarda, esperado);
});

test('Atemporais: "enquanto Intacta" vale até a quebra, "enquanto Rompida" depois dela (e sem Salvaguarda, como no PoB), até a restauração', { skip: SEM }, () => {
  const anel = comAf(peca('Rings/Iron_Ring'), { 'armour_pct@salvaguardaIntacta': 30, 'elem_pen@salvaguardaRompida': 8 });
  const coroa = peca('Helmets/Runic_Crown');
  const e = montar({ head: coroa, ring: anel });
  let f = Ficha.combate(e);
  assert.equal(f.afPoe.armour_pct ?? 0, 30, 'intacta: a Armadura aumentada');
  assert.ok(!(f.afPoe.elem_pen > 0));
  Salvaguarda.absorver(e, e.hunt, f, f.salvaguarda + 1, [], null, PERSONAGEM);
  assert.equal(e.hunt.poeFichaMudou, true);
  Ficha.invalidar(e);
  f = Ficha.combate(e);
  assert.ok(!(f.afPoe.armour_pct > 0), 'rompida: sem a Armadura');
  assert.equal(f.afPoe.elem_pen, 8, 'rompida: a penetração');
  Salvaguarda.recarregar(e, f, Salvaguarda.espera(f));
  Ficha.invalidar(e);
  assert.equal(Ficha.combate(e).afPoe.armour_pct ?? 0, 30, 'restaurada: intacta de novo');
  // sem Salvaguarda nenhuma: "Rompida" (o PoB: a negação de UnbrokenWard)
  const s = montar({ ring: comAf(peca('Rings/Iron_Ring'), { 'elem_pen@salvaguardaRompida': 8 }) });
  assert.equal(Ficha.combate(s).afPoe.elem_pen, 8);
});

test('Atemporais: a chance de Evadir e a redução física pela Salvaguarda (200%) — a Evasão e a Armadura da ficha seguem', { skip: SEM }, () => {
  const coroa = peca('Helmets/Runic_Crown');
  const anel = comAf(peca('Rings/Iron_Ring'), { evasao_pela_salvaguarda_pct: 200, armadura_pela_salvaguarda_pct: 200 });
  const e = montar({ head: coroa, ring: anel });
  const f = Ficha.combate(e);
  assert.equal(f.evasaoDaEsquiva, Math.round(f.salvaguarda * 2));
  assert.equal(f.armaduraDaReducao, Math.round(f.salvaguarda * 2));
  assert.equal(armorDoPersonagem(e), f.armaduraDaReducao, 'o golpe do monstro usa a Salvaguarda');
  // a esquiva usa a Evasão da Salvaguarda: com 0 de Evasão na ficha, ainda evade
  const b = e.hunt.monstros[0];
  const antes = Math.random;
  let evadiu = 0;
  try { Math.random = () => 0.001; for (let i = 0; i < 3; i++) if (Defesa.esquivou({ ...f, evasion: 0 }, e.hunt, b)) evadiu++; } finally { Math.random = antes; }
  assert.ok(evadiu > 0, 'evade pela Salvaguarda');
});

test('Atemporais: "A Salvaguarda tem 60% de chance de não se Romper" — o acerto que a levaria a 0 não a tira (sorte), e quebra no resto', { skip: SEM }, () => {
  const ficha = { salvaguarda: 500, afPoe: { salvaguarda_chance_nao_romper: 60 } };
  const hunt = { clock: 0 };
  const antes = Math.random;
  try {
    const a = {};
    Math.random = () => 0.5;
    assert.equal(Salvaguarda.absorver(a, hunt, ficha, 700, [], null), 200, 'absorve os 500');
    assert.equal(a.salvaguarda, 500, 'não rompeu');
    assert.ok(!a.salvaguardaQuebrada);
    assert.equal(a.salvaguardaEspera, 2000, 'a espera começa');
    const b = {};
    Math.random = () => 0.7;
    Salvaguarda.absorver(b, hunt, ficha, 700, [], null);
    assert.equal(b.salvaguarda, 0, 'rompeu');
    // o acerto que não a leva a 0 desce como sempre
    const c = {};
    Math.random = () => 0;
    Salvaguarda.absorver(c, hunt, ficha, 100, [], null);
    assert.equal(c.salvaguarda, 400);
  } finally { Math.random = antes; }
});

test('Atemporais: o ataque com a Salvaguarda Intacta leva o Gelo (25% da Salvaguarda) e a rompe; com ela rompida, nada', { skip: SEM }, () => {
  const coroa = peca('Helmets/Runic_Crown');
  const anel = comAf(peca('Rings/Iron_Ring'), {
    'added_ice_dmg_min%pctSalvaguarda:25@salvaguardaRompivel+naoCanalizar': 1, 'added_ice_dmg_max%pctSalvaguarda:25@salvaguardaRompivel+naoCanalizar': 1, 'ataque_rompe_salvaguarda@salvaguardaRompivel': 1,
  });
  const e = montar({ head: coroa, ring: anel });
  const f = Ficha.combate(e);
  const q = Math.floor(f.salvaguarda / 4);
  assert.equal(f.afPoe['added_ice_dmg_min@naoCanalizar'], q, '25% da Salvaguarda, nos ataques sem canalização');
  assert.equal(ModsPoe.valor(f, 'ataque_rompe_salvaguarda'), 1);
  assert.equal(Salvaguarda.romper(e, e.hunt, f, PERSONAGEM, []), true);
  assert.equal(e.salvaguarda, 0);
  Ficha.invalidar(e);
  const g = Ficha.combate(e);
  assert.ok(!(g.afPoe['added_ice_dmg_min@naoCanalizar'] > 0), 'rompida: sem o Gelo');
  assert.equal(ModsPoe.valor(g, 'ataque_rompe_salvaguarda'), 0);
});

test('Atemporais: "Frascos de Ferro ganham 2 cargas" na quebra e "Remove uma Afecção Danificadora aleatória" na restauração', { skip: SEM }, () => {
  const coroa = peca('Helmets/Runic_Crown');
  const anel = comAf(peca('Rings/Iron_Ring'), { 'ev:salvaguardaQuebra:frasco:ferro': 2, 'ev:salvaguardaRestaurada:removerAfeccao:danificadoraAleatoria': 100 });
  const e = montar({ head: coroa, ring: anel });
  const ferro = peca('Utility_Flasks/Iron_Flask');
  const rubi = peca('Utility_Flasks/Ruby_Flask');
  ferro.poe.cargas = 10;
  rubi.poe.cargas = 10;
  e.frascos = [ferro, rubi, null, null, null];
  const f = Ficha.combate(e);
  Salvaguarda.absorver(e, e.hunt, f, f.salvaguarda + 1, [], null, PERSONAGEM);
  assert.equal(ferro.poe.cargas, 12, 'o Frasco de Ferro');
  assert.equal(rubi.poe.cargas, 10, 'o outro não');
  // um Sangramento em você: a restauração o tira
  (e.hunt.efeitosDoJogador ??= {}).dots = [{ tipo: 'sangramento', falta: 4000, dano: 10 }];
  assert.ok(ModsPoe.AFECCOES_NO_JOGADOR.find((a) => a.nome === 'sangramento').tem(e.hunt, e.hunt.clock));
  assert.equal(Salvaguarda.recarregar(e, f, Salvaguarda.espera(f)), true);
  assert.ok(!ModsPoe.AFECCOES_NO_JOGADOR.find((a) => a.nome === 'sangramento').tem(e.hunt, e.hunt.clock), 'o Sangramento saiu');
});
