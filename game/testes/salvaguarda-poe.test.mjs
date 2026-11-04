// (dono, 02/11: "resolva essa que não se aplica" — a SALVAGUARDA (Ward) como o PoE, `personagem/salvaguarda.mjs`) A Salvaguarda das bases Rúnicas (com a qualidade e os
// locais dos únicos), o máximo na ficha (o aumentado global das Joias Atemporais, o Guardião da Fé), a absorção no acerto em você antes do Escudo de Energia (o golpe
// corpo a corpo, a magia e a explosão do monstro; o dano contínuo não), a parte que a ignora (o Aperto Noturno), a quebra (o evento e o Conjurar ao Perder Salvaguarda,
// com a recarga pela Salvaguarda máxima e o "mais/menos Dano Mágico" do nível), a restauração depois de 2 s (o PoB: WardRechargeDelay) e o Frasco de Ferro.
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
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const Frascos = await import('../systems/itens-poe/frascos.mjs');
const Poderes = await import('../systems/poderes.mjs');
const Salvaguarda = await import('../systems/personagem/salvaguarda.mjs');
const { traduzirLinha } = await import('../systems/itens-poe/arvore.mjs');
const { contraAtaque } = await import('../systems/hunt/combate.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');

const peca = (base, extra = {}) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 70, rng: () => 0.5, ...extra }));
const unico = (base, slug) => peca(base, { raridade: 'unico', unico: slug });
function travado(v, fn) {
  const antes = Math.random;
  Math.random = typeof v === 'function' ? v : () => v;
  try { return fn(); } finally { Math.random = antes; }
}

/** O personagem do PoE com as peças `equip` vestidas (e as gemas `gemas` ligadas na varinha), numa caçada; o monstro colado, imortal. */
function montar(equip = {}, { gemas = [] } = {}) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'sorcerer', level: 90 }), { classePoe: 'Witch', sistema: 'poe' });
  const arma = peca('Wands/Driftwood_Wand', { ilvl: 60 });
  if (gemas.length) {
    const n = gemas.length;
    arma.soquetes = { abertos: n, links: Array.from({ length: n - 1 }, () => true), gemas: Array(n).fill(null), cores: Array(n).fill('W') };
  }
  e.equipment = { ...e.equipment, weapon: arma, ...equip };
  delete e.equipment.shield;
  if (equip.shield) e.equipment.shield = equip.shield;
  e.inventory = gemas.map(([s, nivel]) => GS.itemDaGema({ id: (G.doSlug(s) ?? SP.doSlug(s)).itemId, nivel, xp: 0, raridade: 'comum' }));
  for (let i = 0; i < gemas.length; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  e.actions = Array(Acoes.SLOTS).fill(null);
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(travado(0.5, () => Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' })).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 1e6;
  e.maxHp = e.hp = 1e6;
  const [b, ...resto] = e.hunt.monstros;
  for (const m of resto) Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60 });
  Object.assign(b, { x: e.hunt.pos.x + 1, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12 });
  return { e, b };
}

// ---------------------------------------------------------------- 1. a Salvaguarda das peças

test('a Salvaguarda da base Rúnica na peça (`base.ward`), × a qualidade; os locais dos únicos: "Proteção aumentada em X%" e o "+N de Proteção" de Svalinn', { skip: SEM }, () => {
  const coroa = peca('Helmets/Runic_Crown');
  assert.ok(coroa.poe.atributos.protecao > 0);
  assert.deepEqual(coroa.base.ward, [coroa.poe.atributos.protecao, coroa.poe.atributos.protecao], 'a Salvaguarda sorteada da base');
  coroa.poe.qualidade = 20;
  J.recalcular(coroa);
  assert.equal(coroa.base.ward[0], Math.round(coroa.poe.atributos.protecao * 1.2), 'a qualidade 20: × 1,2');
  // o Guardião da Fé: 44 (o meio de 41–47) × (1 + 30%) = 57,2 → 57; a restauração 50% mais rápida e o Escudo aumentado na Salvaguarda
  const fe = unico('Helmets/Runic_Helm', 'Faithguard');
  assert.equal(fe.poe.af.salvaguarda_pct_local, 30);
  assert.deepEqual(fe.base.ward, [Math.round(fe.poe.atributos.protecao * 1.3), Math.round(fe.poe.atributos.protecao * 1.3)]);
  assert.equal(fe.poe.af.salvaguarda_restauracao_pct, 50);
  assert.equal(fe.poe.af.es_inc_na_salvaguarda, 1);
  // Svalinn (um escudo sem Salvaguarda na base): o "+(100—150) de Proteção" é LOCAL — a Salvaguarda do escudo
  const sv = unico('Shields/Girded_Tower_Shield', 'Svalinn');
  assert.deepEqual(sv.base.ward, [sv.poe.af.salvaguarda_local, sv.poe.af.salvaguarda_local]);
  assert.ok(sv.base.ward[0] >= 100 && sv.base.ward[0] <= 150);
  // a Investida de Olroth: "mais lento" com o sinal; a Adrenalina na quebra; o Aperto Noturno: 75% do dano ignora a Salvaguarda
  const ol = unico('Boots/Runic_Sollerets', 'Olroths_Charge');
  assert.ok(ol.poe.af.salvaguarda_restauracao_pct < 0);
  assert.equal(ol.poe.af['ev:salvaguardaQuebra:buff:adrenalina'], 3);
  assert.equal(unico('Gloves/Runic_Gages', 'Nightgrip').poe.af.salvaguarda_ignorada_pct, 75);
});

test('as linhas da Salvaguarda das Joias Atemporais (a Tragédia Heroica) têm efeito', { skip: SEM }, () => {
  const ef = (l) => traduzirLinha(l).efeitos.map((x) => [x.add ?? x.stat, x.valor]);
  assert.deepEqual(ef('Salvaguarda aumentada em 2%'), [['salvaguarda_pct', 2]]);
  assert.deepEqual(ef('Restauração da Salvaguarda 15% mais rápida'), [['salvaguarda_restauracao_pct', 15]]);
  assert.deepEqual(ef('Salvaguarda 40% menor'), [['salvaguarda_mais', -40]]);
  assert.deepEqual(ef('Ganha 1 Carga de Poder quando a Salvaguarda se Rompe'), [['ev:salvaguardaQuebra:carga:poder', 100]]);
  assert.deepEqual(ef('10% de chance de Restaurar a Salvaguarda ao Bloquear'), [['ev:bloquear:salvaguarda', 10]]);
  // aval do dono 03/11: a chance de não se Romper passou a valer (o PoB: WardAvoidBreakChance)
  assert.equal(traduzirLinha('A Salvaguarda tem 60% de chance de não se Romper').estado, 'equivalente');
  assert.deepEqual(ef('A Salvaguarda tem 60% de chance de não se Romper'), [['salvaguarda_chance_nao_romper', 60]]);
});

test('a ficha soma a Salvaguarda das peças vestidas, × o aumentado global; o Guardião da Fé leva o Escudo aumentado para a Salvaguarda', { skip: SEM }, () => {
  const coroa = peca('Helmets/Runic_Crown');
  const luvas = peca('Gloves/Runic_Gauntlets');
  const { e } = montar({ head: coroa, gloves: luvas });
  const soma = coroa.base.ward[0] + luvas.base.ward[0];
  assert.equal(Ficha.combate(e).salvaguarda, soma);
  // "+20% de Salvaguarda" global (a joia) multiplica a soma
  luvas.poe.af = { ...luvas.poe.af, salvaguarda_pct: 20 };
  Ficha.invalidar(e);
  assert.equal(Ficha.combate(e).salvaguarda, Math.round(soma * 1.2));
  // o Guardião da Fé: com Escudo aumentado (a Inteligência da Bruxa e +50% numa peça), o Escudo não cresce e a Salvaguarda sim
  const veste = peca('Body_Armours/Arcane_Vestment');
  veste.poe.af = { ...veste.poe.af, es_pct: 50 };
  const sem = montar({ body: veste, head: coroa });
  const esSem = Ficha.combate(sem.e).energyShield;
  const fe = unico('Helmets/Runic_Helm', 'Faithguard');
  const com = montar({ body: veste, head: fe });
  const f = Ficha.combate(com.e);
  assert.ok(f.energyShield < esSem, 'o Escudo perde os aumentos');
  assert.equal(f.energyShield, veste.base.es[0], 'só a base da Veste');
  assert.ok(f.salvaguarda > fe.base.ward[0], 'a Salvaguarda ganha os aumentos do Escudo');
});

// ---------------------------------------------------------------- 2. a absorção, a quebra e a restauração

test('Salvaguarda.absorver: o acerto sai dela até o que ela tem; a espera de 2 s começa no primeiro dano e não reinicia; no fim, volta inteira', { skip: SEM }, () => {
  const ficha = { salvaguarda: 500, afPoe: {} };
  const estado = {};
  const hunt = { clock: 0 };
  const ev = [];
  assert.equal(Salvaguarda.absorver(estado, hunt, ficha, 200, ev, { uid: 'player' }), 0, 'os 200 ficam nela');
  assert.equal(estado.salvaguarda, 300);
  assert.equal(estado.salvaguardaEspera, 2000);
  assert.deepEqual(ev.map((x) => [x.v, x.salvaguarda]), [[200, true]]);
  Salvaguarda.recarregar(estado, ficha, 1500);
  assert.equal(Salvaguarda.absorver(estado, hunt, ficha, 400, [], null), 100, 'quebra: os 100 que passam seguem');
  assert.equal(estado.salvaguarda, 0);
  assert.equal(estado.salvaguardaQuebrada, true);
  assert.equal(estado.salvaguardaEspera, 500, 'o dano no meio não reinicia a espera');
  assert.equal(Salvaguarda.absorver(estado, hunt, ficha, 50, [], null), 50, 'quebrada: nada absorve');
  assert.equal(Salvaguarda.recarregar(estado, ficha, 499), false);
  assert.equal(Salvaguarda.recarregar(estado, ficha, 1), true, 'os 2 s: volta inteira');
  assert.deepEqual([Salvaguarda.atual(estado, ficha), estado.salvaguardaQuebrada], [500, false]);
  // a restauração 50% mais rápida: 2 s ÷ 1,5; a 40% mais lenta: 2 s ÷ 0,6
  assert.equal(Salvaguarda.espera({ afPoe: { salvaguarda_restauracao_pct: 50 } }), 1333);
  assert.equal(Salvaguarda.espera({ afPoe: { salvaguarda_restauracao_pct: -40 } }), 3333);
  // "75% do Dano sofrido ignora a Proteção": de 400, só 100 contra ela
  const est2 = {};
  assert.equal(Salvaguarda.absorver(est2, hunt, { salvaguarda: 500, afPoe: { salvaguarda_ignorada_pct: 75 } }, 400, [], null), 300);
  assert.equal(est2.salvaguarda, 400);
});

test('o golpe corpo a corpo do monstro: a Salvaguarda segura antes do Escudo de Energia e da Vida; a magia e a explosão do monstro também; o dano contínuo não', { skip: SEM }, () => {
  const coroa = peca('Helmets/Runic_Crown');
  const { e, b } = montar({ head: coroa, body: peca('Body_Armours/Arcane_Vestment') });
  const f = Ficha.combate(e);
  assert.ok(f.salvaguarda > 0 && f.energyShield > 0);
  e.es = f.energyShield;
  const ev = [];
  travado(0.99, () => { for (let i = 0; i < 30 && Salvaguarda.atual(e, f) === f.salvaguarda; i++) contraAtaque(e, e.hunt, PERSONAGEM, b, ev); });
  const daSalvaguarda = ev.filter((x) => x.t === 'dmg' && x.salvaguarda).reduce((n, x) => n + x.v, 0);
  assert.ok(daSalvaguarda > 0, 'o golpe tirou da Salvaguarda');
  assert.equal(f.salvaguarda - (e.salvaguarda ?? f.salvaguarda), daSalvaguarda);
  if (e.salvaguarda > 0) assert.equal(e.es, f.energyShield, 'enquanto ela segura o golpe inteiro, o Escudo não desce');
  // a explosão do monstro (um acerto) passa por ela; a aura (dano contínuo), não
  Salvaguarda.restaurar(e, f);
  const ficha = Ficha.combate(e);
  const base = Salvaguarda.atual(e, ficha);
  Poderes.danoDeElementoNoJogador(e, e.hunt, PERSONAGEM, b, 50, 'fire', [], 'Explosão', ficha, false, { acerto: true });
  assert.ok(e.salvaguarda < base, 'a explosão');
  Salvaguarda.restaurar(e, ficha);
  Poderes.danoDeElementoNoJogador(e, e.hunt, PERSONAGEM, b, 50, 'fire', [], 'Aura', ficha, false);
  assert.equal(Salvaguarda.atual(e, ficha), base, 'a aura não');
});

test('a quebra dispara o evento "quando a Salvaguarda se Rompe" (a Carga de Poder) e o Frasco de Ferro a restaura', { skip: SEM }, () => {
  const coroa = peca('Helmets/Runic_Crown');
  coroa.poe.af = { ...coroa.poe.af, 'ev:salvaguardaQuebra:carga:poder': 100 };
  const { e } = montar({ head: coroa });
  const f = Ficha.combate(e);
  const poder = () => e.hunt?.cargasPoe?.poder?.n ?? 0;
  const antes = poder();
  Salvaguarda.absorver(e, e.hunt, f, f.salvaguarda + 10, [], null, PERSONAGEM);
  assert.equal(e.salvaguarda, 0);
  assert.equal(poder(), antes + 1, 'a Carga de Poder');
  // o Frasco de Ferro: "Restaura Proteção ao usar"
  const ferro = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Utility_Flasks/Iron_Flask', raridade: 'normal', ilvl: 70, rng: () => 0.5 }));
  assert.equal(Frascos.parametros(ferro).restauraSalvaguarda, true);
  assert.ok(Frascos.resumo(ferro) != null);
  e.frascos = [ferro, null, null, null, null];
  assert.equal(Frascos.usar(e, 0), true);
  assert.equal(Salvaguarda.atual(e, Ficha.combate(e)), f.salvaguarda, 'cheia de novo');
});

// ---------------------------------------------------------------- 3. o Conjurar ao Perder Salvaguarda

test('o Conjurar ao Perder Salvaguarda: funciona (saiu do "não se aplica"); o gatilho "salvaguarda" com a recarga de 1 s e os 5% por 100 de Salvaguarda, até 400%', { skip: SEM }, () => {
  const r = SP.doSlug('Cast_on_Ward_Break_Support');
  assert.equal(r.status, 'funciona', r.motivos.join(' | '));
  assert.equal(SP.NAO_SE_APLICA.Cast_on_Ward_Break_Support, undefined);
  assert.deepEqual(SP.fichaNoNivel('Cast_on_Ward_Break_Support', 1).gatilho, { quando: 'salvaguarda', recargaMs: 1000, porSalvaguardaPct: 5, porSalvaguardaMaxPct: 400 });
  // o "mais/menos Dano Mágico" do nível (a coluna do poedb): −30 no 1, −22 no 3, 0 no 13, +4 no 15; a recarga do gatilho não vira "Recuperação da Recarga" da magia
  const magia = { tags: ['poe:Magia', 'poe:Fogo', 'poe:Projétil'] };
  assert.equal(SP.efeitoNoNivel('Cast_on_Ward_Break_Support', 1, 0, magia).efeito.maisDanoMagicoPct, -30);
  assert.equal(SP.efeitoNoNivel('Cast_on_Ward_Break_Support', 3, 0, magia).efeito.maisDanoMagicoPct, -22);
  assert.equal(SP.efeitoNoNivel('Cast_on_Ward_Break_Support', 13, 0, magia).efeito.maisDanoMagicoPct, undefined);
  assert.equal(SP.efeitoNoNivel('Cast_on_Ward_Break_Support', 15, 0, magia).efeito.maisDanoMagicoPct, 4);
  assert.equal(SP.efeitoNoNivel('Cast_on_Ward_Break_Support', 1, 0, magia).efeito.recargaPct, undefined);
  assert.deepEqual(SP.efeitoNoNivel('Cast_on_Ward_Break_Support', 1, 0, magia).naoFeitas, []);
  // a recarga pela Salvaguarda máxima: 650 → 6 × 5% = 30% → 1000 ÷ 1,3 = 769 ms; 10 000 → 400% → 200 ms
  assert.equal(Salvaguarda.recargaDoGatilho(1000, { salvaguarda: 650 }, { porCemPct: 5, maxPct: 400 }), 769);
  assert.equal(Salvaguarda.recargaDoGatilho(1000, { salvaguarda: 10_000 }, { porCemPct: 5, maxPct: 400 }), 200);
});

test('o Conjurar ao Perder Salvaguarda no jogo: a Bola de Fogo ligada sai quando a Salvaguarda quebra — uma vez, e não de novo na recarga', { skip: SEM }, () => {
  const coroa = peca('Helmets/Runic_Crown');
  const { e } = montar({ head: coroa }, { gemas: [['Fireball', 20], ['Cast_on_Ward_Break_Support', 1]] });
  const g = GS.gruposComGatilho(e).find((x) => x.gatilho.quando === 'salvaguarda');
  assert.ok(g, 'o grupo do gatilho');
  assert.deepEqual(g.magias, [G.doSlug('Fireball').acao]);
  const f = Ficha.combate(e);
  const ev = [];
  Salvaguarda.absorver(e, e.hunt, f, f.salvaguarda, ev, { uid: 'player' }, PERSONAGEM);
  assert.equal(e.salvaguarda, 0, 'quebrou');
  assert.equal(ev.filter((x) => x.t === 'gatilho').length, 1, 'a Bola de Fogo saiu');
  const cd = e.hunt.cooldowns[`gatilho:${g.chave}`];
  assert.equal(cd.total, Salvaguarda.recargaDoGatilho(1000, f, { porCemPct: 5, maxPct: 400 }), 'a recarga pela Salvaguarda máxima');
  // restaurada e quebrada de novo dentro da recarga: não sai
  Salvaguarda.restaurar(e, f);
  const ev2 = [];
  Salvaguarda.absorver(e, e.hunt, f, f.salvaguarda, ev2, { uid: 'player' }, PERSONAGEM);
  assert.equal(ev2.filter((x) => x.t === 'gatilho').length, 0, 'na recarga');
});
