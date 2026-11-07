// (07/11, lote 19 das inertes — dono: "Aproximar com números meus") o que o poedb e o PoB não trazem, com números do jogo e a nota "sem fonte": as gemas pelo NÚMERO (o
// Shako Proibido, a Pérola de Tsoatha, a Réplica do Voo do Dente Dracônico), a Estátua da Petrificação, a Onda de Choque Sangrenta, a Anomalia Volátil, as Dádivas dos
// Pactos, o Vinho do Profeta e o Legado da Rosa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Acoes = await import('../systems/acoes.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const GemasPoe = await import('../systems/itens-poe/gemas-poe.mjs');
const Frascos = await import('../systems/itens-poe/frascos.mjs');
const HI = await import('../systems/itens-poe/habilidades-de-itens.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');

if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
}

const tr = (modelo, valores = []) => T.traduzirMod({ modelo, valores });
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 70, rng: () => 0.5 }));
const comLinhas = (p, linhas) => {
  const af = { ...(p.poe.af ?? {}) };
  for (const [m, v] of linhas) for (const x of tr(m, v ?? []).efeitos) af[x.stat] = (af[x.stat] ?? 0) + Number(x.valor);
  p.poe.af = af;
  return p;
};
const encaixar = (e, p, slot, slug) => {
  p.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
  e.equipment[slot] = p;
  e.inventory = [GS.itemDaGema({ id: (GemasPoe.doSlug(slug) ?? GS.ativaPeloNome(slug)?.poeGema ?? {}).itemId ?? GS.suportePeloNome(slug)?.itemId, nivel: 20, xp: 0, raridade: 'comum' })];
  GS.encaixar(e, { de: 0, slot, indice: 0 });
};

function personagem(linhas = []) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'sorcerer', level: 90 }), { classePoe: 'Witch', sistema: 'poe' });
  e.equipment = { ...e.equipment, weapon: comLinhas(peca('Wands/Driftwood_Wand'), linhas) };
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  const h = e.hunt;
  h.clock = 100_000;
  const [b, ...resto] = h.monstros;
  for (const m of resto) Object.assign(m, { x: h.pos.x + 60, y: h.pos.y + 60 });
  Object.assign(b, { x: h.pos.x + 1, y: h.pos.y, hp: 1e9, maxHp: 1e9, estados: {} });
  ModsPoe.definirFichaDaCacada(h, () => Ficha.combate(e));
  return { e, h, b };
}
const LINHAS = [
  ['Gemas Encaixadas são Suportadas por {0} Nível {1}', [79, 4]], ['Gemas encaixadas no seu elmo recebem reforço de {0} nível {1}', [6, 20]], ['+{0} ao Nível de todas as Gemas de {1}', [3, 114]],
  ['Concede a Habilidade Estátua da Petrificação Nível {0}', [20]], ['Ativa Onda de Choque Sangrenta Nível {0} no Acerto Corpo a Corpo caso tenha ao menos {1} de Força', [20, 400]],
  ['{0}% de chance de Ativar Convocar Anomalia Volátil Nível {1} ao Matar', [25, 20]], ['Habilidades de pacto concedem Dádivas em vez de Aflições'],
  ['Concede Invocar Memória do Criador nível {0} / Concede Devastação do Criador nível {1}, usada pela Memória do Criador', [20, 20]],
  ['Ganha {0} Lembrança ao gastar um total de {1} de escudo de energia / e não tiver invocado nenhuma Memória do Criador', [1, 200]], ['Máximo de {0} Lembrança', [10]],
];

test('as linhas do lote saem com efeito (aproximadas)', { skip: SEM }, () => {
  for (const [m, v] of LINHAS) assert.ok(!['inerte', 'registrado'].includes(tr(m, v ?? []).estado), m);
});

test('as gemas pelo NÚMERO: o N é a N-ésima gema pelo slug — o Shako dá o suporte à gema encaixada; a Pérola, às do elmo; o Voo, o nível', { skip: SEM }, () => {
  // (o índice do Eco Mágico, um suporte que serve na Bola de Fogo)
  const idx = Array.from({ length: 300 }, (_, i) => i + 1).find((i) => GS.suportePeloNome(String(i))?.poe?.slug === 'Spell_Echo_Support');
  const sup = GS.suportePeloNome(String(idx));
  const atv114 = GS.ativaPeloNome('114');
  assert.ok(sup && atv114);
  const { e } = personagem();
  encaixar(e, comLinhas(peca('Wands/Driftwood_Wand'), [['Gemas Encaixadas são Suportadas por {0} Nível {1}', [idx, 4]]]), 'weapon', 'Fireball');
  Ficha.invalidar(e);
  assert.ok(GS.skillsAtivas(e).get(GemasPoe.doSlug('Fireball').acao)?.supports.some((s) => s.def.id === sup.id && s.nivel === 4));
  const elmo = personagem();
  elmo.e.equipment.ring = comLinhas(peca('Rings/Iron_Ring'), [['Gemas encaixadas no seu elmo recebem reforço de {0} nível {1}', [idx, 20]]]);
  encaixar(elmo.e, peca('Helmets/Iron_Hat'), 'head', 'Fireball');
  Ficha.invalidar(elmo.e);
  assert.ok(GS.skillsAtivas(elmo.e).get(GemasPoe.doSlug('Fireball').acao)?.supports.some((s) => s.def.id === sup.id && s.nivel === 20));
  const voo = personagem();
  voo.e.equipment.ring = comLinhas(peca('Rings/Iron_Ring'), [LINHAS[2]]);
  encaixar(voo.e, peca('Wands/Driftwood_Wand'), 'weapon', atv114.poe?.slug ?? atv114.poeGema?.slug);
  Ficha.invalidar(voo.e);
  assert.equal(GS.skillsAtivas(voo.e).get(atv114.acao)?.nivel, 23);
});

test('a ESTÁTUA, a ONDA DE CHOQUE e a ANOMALIA: Petrifica a até 3 casas; as ondas ferem em volta do alvo', { skip: SEM }, () => {
  const { e, h, b } = personagem();
  assert.ok(HI.usar(e, h, 'Petrification_Statue', { id: 'ps', agora: h.clock }).ok);
  assert.ok(b.estados.congelado?.ate > h.clock);
  for (const slug of ['Bloody_Shockwave', 'Summon_Volatile_Anomaly']) {
    const antes = b.hp;
    assert.ok(HI.usar(e, h, slug, { id: slug, alvo: b, nivel: 20, agora: h.clock, eventos: [] }).ok);
    assert.ok(b.hp < antes, slug);
  }
});

test('as DÁDIVAS DOS PACTOS: o uso de um Pacto dá a Dádiva (4 s); o Vinho do Profeta dá um bônus de Adivinhação ao acaso', { skip: SEM }, () => {
  const { e, h } = personagem([LINHAS[6]]);
  ModsPoe.evento(e, h, 'usarHabilidade', Ficha.combate(e), { tags: ['magia'], eventos: [], personagem: PERSONAGEM });
  assert.ok(!((h.poeBuffs?.dadivaDoPacto ?? 0) > h.clock));
  ModsPoe.evento(e, h, 'usarHabilidade', Ficha.combate(e), { tags: ['magia', 'pacto'], eventos: [], personagem: PERSONAGEM });
  assert.equal(h.poeBuffs.dadivaDoPacto, h.clock + 4000);
  const frasco = peca('Utility_Flasks/Quicksilver_Flask');
  frasco.poe.modificadores = [...(frasco.poe.modificadores ?? []), { modelo: 'Ao usar, concede um bônus de Adivinhação aleatório por {0} segundos', valores: [20] }];
  frasco.poe.cargas = 100;
  Frascos.cinto(e)[0] = frasco;
  assert.ok(Frascos.usar(e, 0, []));
  assert.ok(Object.keys(h.poeBuffs).some((k) => /^adivinhacao/.test(k) && h.poeBuffs[k] === h.clock + 20_000), JSON.stringify(h.poeBuffs));
});

test('o LEGADO DA ROSA: 200 de Escudo de Energia perdido = 1 Lembrança; com 10, a Memória do Criador usa a Devastação (fere em volta de você)', { skip: SEM }, () => {
  const { e, h, b } = personagem(LINHAS.slice(7));
  e.es = 5000;
  Acoes.tiqueDoGuardian(e, h, 1_000_000);
  e.es = 3100;
  Acoes.tiqueDoGuardian(e, h, 1_000_100);
  assert.equal(h.poeLembranca.n, 9);
  e.es = 2900;
  Acoes.tiqueDoGuardian(e, h, 1_000_200);
  assert.equal(h.poeMemoria?.ate, h.clock + 8000);
  const antes = b.hp;
  Acoes.tiqueDoGuardian(e, h, 1_000_300);
  assert.ok(b.hp < antes, 'a Devastação');
});

test('(a correção do lote 14) o COLHEDOR DE ALMAS: o "Ganha Almas Vaal igual às Cargas Consumidas" chega ao uso do frasco (os parâmetros o levam)', { skip: SEM }, () => {
  const frasco = peca('Utility_Flasks/Quicksilver_Flask');
  frasco.poe.modificadores = [...(frasco.poe.modificadores ?? []), { modelo: 'Ganha Almas Vaal igual às Cargas Consumidas ao usar', valores: [] }];
  assert.equal(Frascos.parametros(frasco).almasPorCarga, true);
});
