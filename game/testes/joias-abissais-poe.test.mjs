// AS JOIAS ABISSAIS (dono, 15/10: "faça as pendências e os efeitos que não funcionam"): os 4 Olhos entram no catálogo (ids fixos, caem como as
// outras joias), vão nos encaixes da árvore e nos ENCAIXES ABISSAIS das peças ("Tem N Encaixes Abissal" — o Torno Estígio e os únicos), e as
// linhas que dependem delas passam a valer: o efeito das encaixadas, "por Joia Abissal afetando você", "enquanto afetado por uma Joia
// Abissal Rara/Mágica/Única", "por joia Olho X encaixada" (locais da arma no Rasgacarne), "Com uma joia Olho X encaixada", os 4 Olhos
// únicos, o Elmo Fiel que consome as Raras, e o pool delas (o Poder Profano ao Matar Corpo a Corpo e a resistência dos Definhados).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste } = await import('./apoio.mjs');
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const Comandos = await import('../systems/passivas/comandos.mjs');
const Abissais = await import('../systems/itens-poe/abissais.mjs');
const Afixos = await import('../systems/afixos.mjs');
const C = await import('../systems/itens-poe/condicoes-poe.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');

J.iniciar(ITEM_CATALOG);
const gerar = (base, raridade = 'raro', unico = null, rng = () => 0) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade, ilvl: 80, rng, unico }));
const olho = (slug, raridade = 'raro', af = { life: 10 }) => {
  const p = gerar(`Abyss_Jewels/${slug}`, raridade, null, () => 0.5);
  p.poe.af = { ...af };
  return p;
};
function personagem() {
  const e = personagemDeTeste({ vocacao: 'knight', level: 90 });
  e.sistema = 'poe';
  e.classePoe = 'Marauder';
  P.garantir(e);
  e.inventory = [];
  e.equipment = { ...(e.equipment ?? {}) };
  return e;
}
const encaixar = (e, slot, indice, joia) => {
  e.inventory.push(joia);
  return Abissais.encaixar(e, { slot, indice, pilha: e.inventory.length - 1, id: joia.id }, () => 0);
};

test('o CATÁLOGO: os 4 Olhos com ids fixos (7.800.011–014), joia e abissal, sem slot; caem; a linha "Tem N Encaixes Abissal" vale', { skip: SEM }, () => {
  const olhos = ['Murderous_Eye_Jewel', 'Searching_Eye_Jewel', 'Hypnotic_Eye_Jewel', 'Ghastly_Eye_Jewel'];
  olhos.forEach((s, i) => {
    const id = J.idDaBase(`Abyss_Jewels/${s}`);
    assert.equal(id, 7_800_011 + i);
    assert.deepEqual([ITEM_CATALOG[id].joia, ITEM_CATALOG[id].abissal, ITEM_CATALOG[id].slot], [true, true, undefined]);
  });
  assert.equal(J.pecaSorteada(70, () => 0.98, Catalogo.REGRAS, 0, 'Abyss_Jewels/Ghastly_Eye_Jewel')?.id, 7_800_014);
  const torno = gerar('Belts/Stygian_Vise', 'normal');
  assert.equal(Abissais.encaixesAbissais(torno), 1);
  assert.equal(torno.poe.estados[0], 'equivalente');
});

test('nos ENCAIXES ABISSAIS da peça vestida: só Joia Abissal; soma como peça; trocar e retirar devolvem; vai junto com a peça', { skip: SEM }, () => {
  const e = personagem();
  e.equipment.legs = gerar('Belts/Stygian_Vise', 'normal');
  const vida = Afixos.soma(e).life ?? 0;
  e.inventory.push(gerar('Jewels/Crimson_Jewel'));
  assert.match(Abissais.encaixar(e, { slot: 'legs', indice: 0, pilha: 0, id: e.inventory[0].id }).erro, /Só Joias Abissais/);
  e.inventory = [];
  assert.ok(encaixar(e, 'legs', 0, olho('Murderous_Eye_Jewel', 'raro', { life: 40 })).ok);
  assert.equal(e.inventory.length, 0);
  assert.equal((Afixos.soma(e).life ?? 0) - vida, 40);
  assert.match(Abissais.encaixar(e, { slot: 'legs', indice: 1, pilha: 0 }).erro, /não existe/);
  // (trocar)
  assert.ok(encaixar(e, 'legs', 0, olho('Searching_Eye_Jewel', 'magico', { life: 5 })).ok);
  assert.equal(e.inventory.length, 1);
  assert.equal(e.inventory[0].poe.af.life, 40);
  assert.equal((Afixos.soma(e).life ?? 0) - vida, 5);
  // (a peça tirada do corpo leva a joia; sem a peça vestida, a joia não soma)
  const cinto = e.equipment.legs;
  e.equipment.legs = null;
  assert.equal(Afixos.soma(e).life ?? 0, vida);
  assert.equal(cinto.poe.abissais[0].poe.af.life, 5, 'a joia continua dentro da peça');
  e.equipment.legs = cinto;
  assert.ok(Abissais.retirar(e, { slot: 'legs', indice: 0 }).ok);
  assert.equal(e.inventory.length, 2);
  assert.match(Abissais.retirar(e, { slot: 'legs', indice: 0 }).erro, /vazio/);
});

test('o Torno Estígio único (Darkness Enthroned): "% de aumento do Efeito das Joias Abissais Encaixadas" multiplica o que a joia dá', { skip: SEM }, () => {
  const e = personagem();
  e.equipment.legs = gerar('Belts/Stygian_Vise', 'unico', 'Darkness_Enthroned');
  const efeito = Number(e.equipment.legs.poe.af.efeito_joias_abissais);
  assert.ok(efeito >= 50 && efeito <= 100, String(efeito));
  const vida = Afixos.soma(e).life ?? 0;
  assert.ok(encaixar(e, 'legs', 0, olho('Murderous_Eye_Jewel', 'raro', { life: 40 })).ok);
  assert.equal((Afixos.soma(e).life ?? 0) - vida, 40 * (1 + efeito / 100));
});

test('"por Joia Abissal afetando você" (as das peças e as da árvore) e "enquanto afetado por uma Joia Abissal Rara/Mágica/Única"', { skip: SEM }, () => {
  const e = personagem();
  e.equipment.legs = gerar('Belts/Stygian_Vise', 'normal');
  assert.ok(encaixar(e, 'legs', 0, olho('Murderous_Eye_Jewel', 'raro')).ok);
  const total = Afixos.soma(e);
  assert.equal(C.fatorDaEscala(e, total, null, 'joiasAbissais'), 1);
  // (a da árvore também afeta você)
  e.passivas.alocados.push('6230');
  e.inventory.push(olho('Ghastly_Eye_Jewel', 'magico'));
  assert.ok(Comandos.comando(e, { action: 'encaixarJoia', no: '6230', pilha: 0, id: e.inventory[0].id }).ok);
  assert.equal(C.fatorDaEscala(e, total, null, 'joiasAbissais'), 2);
  assert.equal(C.fatorDaEscala(e, total, null, 'joiasAbissais:Murderous_Eye_Jewel'), 1);
  assert.equal(C.fatorDaEscala(e, total, null, 'joiasAbissais:Hypnotic_Eye_Jewel'), 0);
  const conds = C.condicoesDe(e, total);
  assert.equal(C.vale(conds, 'afetadoPorAbissal:raro'), true);
  assert.equal(C.vale(conds, 'afetadoPorAbissal:magico'), true);
  assert.equal(C.vale(conds, 'afetadoPorAbissal:unico'), false);
});

test('na PEÇA: "por joia Olho X encaixada" (o Rasgacarne: locais da arma) e "Com uma joia Olho X encaixada" (as Luvas Rebitadas)', { skip: SEM }, () => {
  const arma = gerar('Two_Hand_Axes/Vaal_Axe', 'normal');
  arma.poe.af = { encaixes_abissais: 6, 'phys_dmg_local%abissalLocal:Murderous_Eye_Jewel': 30, 'atk_speed_local%abissalLocal:Searching_Eye_Jewel': 10, 'crit_chance_local%abissalLocal:Hypnotic_Eye_Jewel': 25 };
  arma.poe.abissais = [olho('Murderous_Eye_Jewel'), olho('Murderous_Eye_Jewel'), olho('Searching_Eye_Jewel'), null, null, null];
  assert.deepEqual(C.locaisAbissais(arma), { phys_dmg_local: 60, atk_speed_local: 10, crit_chance_local: 0 });
  const luvas = { poe: { abissais: [olho('Ghastly_Eye_Jewel'), null] } };
  assert.deepEqual(C.daPeca('minion_poder_profano_ao_acertar_magia@comAbissalLocal:Ghastly_Eye_Jewel', 25, luvas), ['minion_poder_profano_ao_acertar_magia', 25]);
  assert.deepEqual(C.daPeca('ev:acertar:buff:furiaArcana@magia+comAbissalLocal:Hypnotic_Eye_Jewel', 4, luvas), ['ev:acertar:buff:furiaArcana@magia+comAbissalLocal:Hypnotic_Eye_Jewel', 0], 'sem Olho Hipnótico, nada');
  luvas.poe.abissais[1] = olho('Hypnotic_Eye_Jewel');
  assert.deepEqual(C.daPeca('ev:acertar:buff:furiaArcana@magia+comAbissalLocal:Hypnotic_Eye_Jewel', 4, luvas), ['ev:acertar:buff:furiaArcana@magia', 4]);
});

test('o Elmo Fiel (Subsume the Source): a Rara encaixada é consumida e um mod dela fica no elmo (× a magnitude); a Mágica encaixa', { skip: SEM }, () => {
  const e = personagem();
  e.equipment.head = gerar('Helmets/Faithful_Helmet', 'unico', 'Subsume_the_Source');
  const elmo = e.equipment.head;
  assert.equal(Abissais.encaixesAbissais(elmo), 4);
  assert.ok(Number(elmo.poe.af.consome_abissais_raras) > 0);
  const rara = olho('Murderous_Eye_Jewel', 'raro');
  const mod = [...rara.poe.prefixos, ...rara.poe.sufixos][0];
  const antes = elmo.poe.modificadores.length;
  const r = encaixar(e, 'head', 0, rara);
  assert.ok(r.ok && /consumida/.test(r.notice), JSON.stringify(r));
  assert.equal(e.inventory.length, 0, 'a Rara sumiu');
  assert.equal(elmo.poe.modificadores.length, antes + 1);
  const novo = elmo.poe.modificadores.at(-1);
  assert.equal(novo.modelo, mod.modelo);
  const mag = Number(elmo.poe.af.magnitude_explicitos) || 0;
  assert.ok(mag >= 120, String(mag));
  assert.ok(Math.abs(novo.valores[0]) >= Math.abs(mod.valores[0]), 'com a magnitude');
  assert.equal((elmo.poe.abissais ?? []).filter(Boolean).length, 0);
  assert.ok(encaixar(e, 'head', 0, olho('Searching_Eye_Jewel', 'magico')).ok);
  assert.equal(elmo.poe.abissais[0].poe.raridade, 'magico');
});

test('os LACAIOS: empalam com ataques (não com magia); o Definhado por você tem −X% de todas as Resistências', { skip: SEM }, () => {
  const hunt = { clock: 1000, monstros: [] };
  const alvo = { uid: 'b', x: 0, y: 0, hp: 500, maxHp: 1000, estados: {} };
  const l = { poe: { chances: { empalar: 100 }, roubo: 0 }, hp: 10, maxHp: 10 };
  Cacadas.efeitosDoLacaioNoAcerto(hunt, l, alvo, 100, 'physical', { magia: true });
  assert.equal(alvo.estados.empalado, undefined, 'magia não empala');
  Cacadas.efeitosDoLacaioNoAcerto(hunt, l, alvo, 100, 'physical', {});
  assert.equal(alvo.estados.empalado.length, 1);
  assert.equal(alvo.estados.empalado[0].valor, 10);
  // (o Definhado: o evento do personagem põe o Definhamento com o −2%)
  const af = { 'ev:acertar:alvo:definhado:2': 100, res_definhados: -2 };
  const ficha = { afPoe: af, eventosPoe: C.eventosDa(af) };
  const e = personagem();
  e.hunt = { clock: 5000, pos: { x: 0, y: 0 }, monstros: [] };
  const bicho = { uid: 'c', x: 1, y: 0, hp: 100, maxHp: 100, estados: {} };
  ModsPoe.evento(e, e.hunt, 'acertar', ficha, { alvo: bicho, rng: () => 0 });
  assert.ok(bicho.estados.definhado?.ate > 5000);
  for (const tipo of ['fire', 'ice', 'energy', 'chaos']) assert.equal(C.resMenosDasAfeccoes(bicho, 5000, tipo), 2, tipo);
  assert.equal(C.resMenosDasAfeccoes(bicho, 5000, 'physical'), 0);
  assert.equal(C.resMenosDasAfeccoes(bicho, 9000, 'fire'), 0, 'acabou o Definhamento');
});
