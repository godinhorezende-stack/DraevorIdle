// (07/11, lote 24 das inertes — o dono: "Só a marca nos itens") as INFLUÊNCIAS: a marca no drop Raro, as condições (todos os itens, o anel, o Eldritch dominante, os tipos
// de influência), a Mortalha, as Marcas do Ancião e do Criador, o Desintegrador (as Cargas de Sifão), a Eterna Batalha, a Vigília do Solstício e o Farol da Loucura.
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
const Cacadas = await import('../systems/cacadas.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const HI = await import('../systems/itens-poe/habilidades-de-itens.mjs');
const Resistencia = await import('../systems/hunt/resistencia.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');

if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
}

const tr = (modelo, valores = []) => T.traduzirMod({ modelo, valores });
const peca = (base, raridade = 'normal') => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade, ilvl: 70, rng: () => 0.5 }));
const comLinhas = (p, linhas, influencias = null) => {
  const af = { ...(p.poe.af ?? {}) };
  for (const [m, v] of linhas) for (const x of tr(m, v ?? []).efeitos) af[x.stat] = (af[x.stat] ?? 0) + Number(x.valor);
  p.poe.af = af;
  if (influencias) p.poe.influencias = influencias;
  return p;
};
function personagem(equip) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'sorcerer', level: 90 }), { classePoe: 'Witch', sistema: 'poe' });
  e.equipment = Object.fromEntries(Object.entries(equip));
  Ficha.invalidar(e);
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.clock = 100_000;
  ModsPoe.definirFichaDaCacada(e.hunt, () => Ficha.combate(e));
  return e;
}
const soma = (e) => { Ficha.invalidar(e); return Afixos.soma(e); };

test('a marca de influência no drop Raro (2%): sai com uma das seis; a Normal e o frasco, não', { skip: SEM }, () => {
  const rara = peca('Rings/Iron_Ring', 'raro');
  J.influenciaDoDrop(rara, () => 0);
  assert.equal(rara.poe.influencias.length, 1);
  const outra = peca('Rings/Iron_Ring', 'raro');
  J.influenciaDoDrop(outra, () => 0.5);
  assert.equal(outra.poe.influencias, undefined);
  const normal = peca('Rings/Iron_Ring');
  J.influenciaDoDrop(normal, () => 0);
  assert.equal(normal.poe.influencias, undefined);
});

test('as MARCAS DO ANCIÃO E DO CRIADOR: o outro anel com a influência liga a linha', { skip: SEM }, () => {
  const marca = comLinhas(peca('Rings/Iron_Ring'), [['Dano mágico aumentado em {0}% se o seu anel oposto for um Item do Ancião', [76]]]);
  const sem = personagem({ ring: marca, ring2: peca('Rings/Iron_Ring') });
  const com = personagem({ ring: comLinhas(peca('Rings/Iron_Ring'), [['Dano mágico aumentado em {0}% se o seu anel oposto for um Item do Ancião', [76]]]), ring2: comLinhas(peca('Rings/Iron_Ring'), [], ['elder']) });
  assert.equal((soma(com).spell_dmg ?? 0) - (soma(sem).spell_dmg ?? 0), 76);
});

test('a MORTALHA DA ETERNIDADE: 5% do Elemental como Caos por Item Remodelado; todos Remodelados ignoram a Resistência a Caos', { skip: SEM }, () => {
  const linhas = [['Receba {0}% do Dano Elemental como Dano de Caos Extra por Item Remodelado Equipado', [5]], ['Acertos ignoram a Resistência a Caos do Monstro Inimigo caso todos os Itens Equipados sejam Itens Remodelados']];
  const e = personagem({ body: comLinhas(peca('Body_Armours/Plate_Vest'), linhas, ['shaper']), ring: comLinhas(peca('Rings/Iron_Ring'), [], ['shaper']) });
  assert.equal(soma(e).elem_as_extra_chaos, 10);
  assert.equal(soma(e).ignora_res_caos, 1);
  const f = Ficha.combate(e);
  const bicho = { key: 'x', resist: { chaos: 40 }, estados: {} };
  assert.equal(Resistencia.resistenciaEfetivaDe(e.hunt, bicho, 'chaos', f), Math.min(0, Resistencia.resistenciaEfetivaDe(e.hunt, bicho, 'chaos', null)));
  e.equipment.ring = peca('Rings/Iron_Ring');
  assert.equal(soma(e).ignora_res_caos ?? 0, 0, 'um item sem a influência desliga');
});

test('o DESINTEGRADOR: +1 Carga de Sifão máxima por Item Ancião ou Remodelado; o dano por carga', { skip: SEM }, () => {
  const linhas = [['+{0} ao Máximo de Cargas de Sifão por Item Ancião ou Remodelado Equipado', [1]], ['Adiciona de {0} a {1} de Dano Físico aos Ataques e Magias por Carga de Sifão', [20, 26]]];
  const e = personagem({ weapon: comLinhas(peca('Staves/Gnarled_Branch'), linhas), ring: comLinhas(peca('Rings/Iron_Ring'), [], ['elder']), ring2: comLinhas(peca('Rings/Iron_Ring'), [], ['shaper']) });
  assert.equal(soma(e).max_sifao, 2);
  e.hunt.cargasPoe = { sifao: { n: 2, ate: e.hunt.clock + 10_000 } };
  assert.equal(soma(e).spell_added_physical_dmg_min, 40);
});

test('a ETERNA BATALHA: o Devorador dominante (degrau maior) dá a Loucura Malígna no Crítico; o Exarca, não', { skip: SEM }, () => {
  const linhas = [['Golpes Críticos infligem Loucura Malígna se o Devorador de Mundos for dominante']];
  for (const [degraus, inflige] of [[{ searing: 1, eater: 4 }, true], [{ searing: 5, eater: 2 }, false]]) {
    const amuleto = comLinhas(peca('Amulets/Onyx_Amulet'), linhas);
    amuleto.poe.eldritchDegraus = degraus;
    const e = personagem({ amulet: amuleto });
    const alvo = { uid: 'a', hp: 100, maxHp: 100, estados: {} };
    ModsPoe.evento(e, e.hunt, 'critico', Ficha.combate(e), { alvo, eventos: [], personagem: PERSONAGEM });
    assert.equal((alvo.estados.insanidadeR3c?.ate ?? 0) > e.hunt.clock, inflige, JSON.stringify(degraus));
  }
});

test('a VIGÍLIA DO SOLSTÍCIO (Presença do Criador ao matar um Raro) e o FAROL DA LOUCURA (Abraçar a Loucura alterna a Loucura Gloriosa, que imuniza às Afecções Elementais)', { skip: SEM }, () => {
  const e = personagem({ amulet: comLinhas(peca('Amulets/Onyx_Amulet'), [['Recebe Presença do Criador por {0} segundos ao matar um Inimigo Raro ou Único', [10]]]), body: comLinhas(peca('Body_Armours/Plate_Vest'), [['Imune a Afecções Elementais enquanto afetado por Loucura Gloriosa']]) });
  ModsPoe.evento(e, e.hunt, 'matar', Ficha.combate(e), { alvo: { uid: 'r', hp: 0, raridade: 'raro', raridadePoe: 'raro', estados: {} }, eventos: [], personagem: PERSONAGEM });
  assert.equal(e.hunt.poeBuffs.presencaDoCriador, e.hunt.clock + 10_000);
  assert.ok(!(soma(e).imune_congelamento > 0));
  HI.usar(e, e.hunt, 'Embrace_Madness', { id: 'poe-gema:Embrace_Madness', agora: e.hunt.clock });
  assert.ok(soma(e).imune_congelamento > 0, 'com a Loucura Gloriosa');
  e.hunt.clock += 2000;
  HI.usar(e, e.hunt, 'Embrace_Madness', { id: 'poe-gema:Embrace_Madness', agora: e.hunt.clock });
  assert.ok(!(soma(e).imune_congelamento > 0), 'tirada');
  assert.equal(e.hunt.cooldowns['poe-gema:Embrace_Madness'].ate, e.hunt.clock + 8000);
});
