// ZERAR A ÁRVORE — LOTE 37 (dono, 16/10: o "Mercenário completo" — "Contratar por ouro", o nível "Preso na contratação", "Arquétipos com gemas",
// "Reviver por ouro"; a auditoria em docs/arvore-poe-auditoria.md, P005/P057–P059): os candidatos sorteados (arquétipo, nível e equipamento),
// contratar por ouro (até 3, um ao seu lado), equipar com as regras do PoE (70% do nível da peça, os atributos do arquétipo, as armas dele, os
// únicos só nos tipos que os nós liberam; as peças dele se perdem, as suas voltam), a ficha dele (o nível, a classe e as peças, com o
// "aumentado" dos seus nós), as gemas do arquétipo na caçada (alternando), a morte (só volta revivido por ouro) e o "recuperado como vida" em 4 s.
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
const M = await import('../systems/itens-poe/mercenarios.mjs');
const R = await import('../systems/regras.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
}

const ANEL = Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'might ring')?.id);
/** Um sorteio repetível (mulberry32). */
const semente = (s) => () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const peca = (base, raridade = 'normal', ilvl = 60, unico = null) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade, ilvl, rng: () => 0.5, unico }));
/** Uma personagem do PoE de nível `level` com os nós do Luminary (`af`, num anel), ouro e uma mochila vazia. */
function dono(af = { mercenario: 1 }, level = 50) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level }), { sistema: 'poe', classePoe: 'Marauder', gold: 1_000_000, bank: 0, inventory: [] });
  e.equipment.ring = { id: ANEL, count: 1, af: [], poe: { af } };
  P.garantir(e);
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  return e;
}
const af = (e) => { Ficha.invalidar(e); return Ficha.combate(e).afPoe; };
/** Um mercenário do arquétipo `arquetipo`, nível `nivel`, sem equipamento (contratado e ativo). */
function contratado(e, arquetipo = 'barbaro', nivel = 50) {
  const d = M.dados(e);
  const merc = { ...M.candidato(nivel, semente(7)), arquetipo, equipment: {}, doJogador: {} };
  d.contratados.push(merc);
  d.ativo = merc.id;
  return merc;
}

// (o dono, 16/10 — lote 39, "Uma aura por arquétipo": a linha das auras passou a ter efeito sem diferença; antes, parcial)
test('as linhas do mercenário com efeito', { skip: SEM }, () => {
  for (const modelo of ['Você pode contratar um mercenário de forma permanente', 'Seu mercenário pode equipar anéis únicos', 'Seu mercenário pode equipar aljavas, armas e escudos únicos']) assert.equal(T.traduzirMod({ modelo, valores: [] }).estado, 'novo', modelo);
  assert.equal(T.traduzirMod({ modelo: 'Seu mercenário e os lacaios dele causam +{0}% de dano para cada item único equipado por ele', valores: [8] }).estado, 'novo');
  assert.equal(T.traduzirMod({ modelo: 'Se a vida do seu mercenário for menor que a sua, {0}% do dano sofrido por ele é recuperado como vida', valores: [40] }).estado, 'novo');
  assert.equal(T.traduzirMod({ modelo: 'Seu mercenário tem o efeito das auras não maldições das habilidades aumentado em {0}%', valores: [50] }).estado, 'novo');
});

test('os ATRIBUTOS das peças: um atributo, as que o têm; dois, só as feitas deles; as sem requisito servem a todos', { skip: SEM }, () => {
  assert.ok(M.poolServe('int', ['int']) && M.poolServe('str_int', ['int']) && !M.poolServe('str', ['int']) && !M.poolServe('str_dex', ['int']));
  assert.ok(M.poolServe('str', ['str', 'dex']) && M.poolServe('str_dex', ['str', 'dex']) && !M.poolServe('str_int', ['str', 'dex']));
  assert.ok(M.poolServe('*', ['dex']) && M.poolServe('str_dex_int', ['str', 'dex', 'int']));
});

test('os CANDIDATOS: 3, no seu nível, com as armas e os atributos do arquétipo (mágicos ou raros, sem únicos); novos a cada hora', { skip: SEM }, () => {
  const e = dono({ mercenario: 1 }, 40);
  const agora = 1_000_000_000;
  const cs = M.candidatos(e, agora, semente(1));
  assert.equal(cs.length, 3);
  for (const c of cs) {
    const a = M.ARQUETIPOS[c.arquetipo];
    assert.equal(c.nivel, 40);
    assert.ok(a.armas.includes(c.equipment.weapon.poe.classe), `${c.arquetipo}: ${c.equipment.weapon.poe.classe}`);
    for (const [slot, p] of Object.entries(c.equipment)) {
      const base = Catalogo.catalogo().classes[p.poe.classe].bases.find((b) => b.id === p.poe.base);
      assert.ok((base.requisitos?.nivel ?? 0) <= 40, `${slot}: nível ${base.requisitos?.nivel}`);
      assert.ok(M.poolServe(base.pool, a.atributos), `${slot}: ${base.pool} para ${a.atributos}`);
      assert.ok(['magico', 'raro'].includes(p.poe.raridade), `${slot}: ${p.poe.raridade}`);
    }
  }
  assert.equal(M.candidatos(e, agora + 59 * 60_000, semente(2))[0].id, cs[0].id, 'antes de uma hora, os mesmos');
  assert.notEqual(M.candidatos(e, agora + 60 * 60_000, semente(2))[0].id, cs[0].id, 'depois de uma hora, novos');
});

test('CONTRATAR: pede o nó; custa 1000 de ouro × o nível dele (o bolso e depois o banco); até 3; o primeiro vai ao seu lado', { skip: SEM }, () => {
  const sem = dono({}, 50);
  M.candidatos(sem, Date.now(), semente(3));
  assert.equal(M.comando(sem, { action: 'contratar', id: M.dados(sem).candidatos[0].id }, af(sem)).ok, false, 'sem o nó');
  const e = dono({ mercenario: 1 }, 50);
  Object.assign(e, { gold: 30_000, bank: 30_000 });
  const [c] = M.candidatos(e, Date.now(), semente(3));
  assert.equal(M.custoDeContratar(c.nivel), 50_000);
  const r = M.comando(e, { action: 'contratar', id: c.id }, af(e));
  assert.equal(r.ok, true, r.erro);
  assert.equal(e.gold + e.bank, 10_000);
  assert.equal(e.gold, 0, 'o bolso primeiro');
  assert.equal(M.ativo(e).id, c.id);
  assert.equal(M.comando(e, { action: 'contratar', id: M.dados(e).candidatos[0].id }, af(e)).ok, false, 'sem ouro');
  e.gold = 1e7;
  for (const x of [...M.dados(e).candidatos]) M.comando(e, { action: 'contratar', id: x.id }, af(e));
  assert.equal(M.dados(e).contratados.length, 3);
  M.dados(e).candidatos = [M.candidato(50, semente(9))];
  assert.match(M.comando(e, { action: 'contratar', id: M.dados(e).candidatos[0].id }, af(e)).erro, /máximo/);
  assert.equal(M.ativo(e).id, c.id, 'o primeiro segue ao seu lado');
});

test('EQUIPAR: 70% do nível da peça, os atributos e as armas do arquétipo, únicos só com o nó; as peças dele se perdem, as suas voltam', { skip: SEM }, () => {
  const e = dono({ mercenario: 1 }, 50);
  const merc = contratado(e, 'barbaro', 20);
  const dar = (p, extra = {}) => { e.inventory.push(p); return M.comando(e, { action: 'equipar', id: merc.id, item: p.id, pilha: e.inventory.length - 1, ...extra }, af(e)); };
  // o nível: as Placas de Guerra pedem 21 → o mercenário de nível 20 veste (70% = 15)
  assert.equal(dar(peca('Body_Armours/War_Plate')).ok, true);
  // uma peça de nível 35 pede 25: não
  const alta = peca('Body_Armours/Full_Plate');
  const nivelAlta = Catalogo.catalogo().classes.Body_Armours.bases.find((b) => b.id === 'Body_Armours/Full_Plate').requisitos.nivel;
  const r1 = dar(alta);
  assert.equal(r1.ok, Math.ceil(nivelAlta * 0.7) <= 20, r1.erro);
  e.inventory = [];
  // os atributos: o bárbaro (Força) não veste a de Destreza
  assert.match(dar(peca('Body_Armours/Shabby_Jerkin')).erro, /atributos/);
  e.inventory = [];
  // a arma: o bárbaro não usa arco
  assert.match(dar(peca('Bows/Crude_Bow')).erro, /arma/);
  e.inventory = [];
  // o único: sem o nó, não; com o nó dos anéis, sim
  const anel = peca('Rings/Iron_Ring', 'unico', 60);
  assert.equal(anel.poe.raridade, 'unico');
  assert.match(dar(anel).erro, /únicos/);
  e.equipment.ring.poe.af = { mercenario: 1, mercenario_equipa_anel: 1 };
  assert.equal(M.comando(e, { action: 'equipar', id: merc.id, item: anel.id, pilha: 0 }, af(e)).ok, true);
  assert.equal(M.unicosEquipados(merc), 1);
  // a peça DELE se perde quando outra entra; a SUA volta para a mochila
  merc.equipment.head = peca('Helmets/Iron_Hat');
  delete merc.doJogador.head;
  assert.match(M.comando(e, { action: 'tirar', id: merc.id, slot: 'head' }, af(e)).erro, /dele/);
  const meu = peca('Helmets/Iron_Hat');
  e.inventory = [meu];
  assert.equal(M.comando(e, { action: 'equipar', id: merc.id, item: meu.id, pilha: 0 }, af(e)).ok, true);
  assert.equal(e.inventory.length, 0, 'o elmo dele se perdeu (o PoE)');
  assert.equal(M.comando(e, { action: 'tirar', id: merc.id, slot: 'head' }, af(e)).ok, true);
  assert.equal(e.inventory.length, 1, 'o seu voltou');
  // despedir: as suas voltam todas
  const antes = e.inventory.length;
  assert.equal(M.comando(e, { action: 'despedir', id: merc.id }, af(e)).ok, true);
  assert.equal(e.inventory.length, antes + 2, 'as Placas e o anel único');
  assert.equal(M.ativo(e), null);
});

test('a FICHA: a vida do nível e das peças dele com a "vida aumentada" dos seus nós; o golpe das gemas com o "dano aumentado"; +8% mais por único', { skip: SEM }, () => {
  const e = dono({ mercenario: 1 }, 50);
  const merc = contratado(e, 'barbaro', 30);
  const f0 = Acoes.fichaDoMercenario(e, merc, af(e));
  assert.equal(f0.vida, R.statsBase('knight', 30).maxHp + Math.floor(32 / 2), 'a vida do nível 30 do PoE + a Força do Marauder (32 ÷ 2)');
  assert.deepEqual(f0.habilidades.map((h) => h.gema), ['Ground_Slam', 'Molten_Strike']);
  assert.ok(f0.habilidades.every((h) => h.nivel === M.nivelDaGema(h.gema, 30) && h.suportes.length === 2));
  e.equipment.ring.poe.af = { mercenario: 1, mercenario_vida_inc: 20, mercenario_dano_inc: 50 };
  const f1 = Acoes.fichaDoMercenario(e, merc, af(e));
  assert.equal(f1.vida, Math.round(f0.vida * 1.2));
  assert.ok(f1.habilidades[0].dano.max > f0.habilidades[0].dano.max * 1.2, 'o dano aumentado');
  // o "+8% mais" por único equipado nele (o mesmo único, com e sem o nó)
  merc.equipment.ring = peca('Rings/Iron_Ring', 'unico', 60);
  e.equipment.ring.poe.af = { mercenario: 1, mercenario_dano_por_unico: 8 };
  const f2 = Acoes.fichaDoMercenario(e, merc, af(e));
  e.equipment.ring.poe.af = { mercenario: 1 };
  const f3 = Acoes.fichaDoMercenario(e, merc, af(e));
  assert.ok(Math.abs(f2.habilidades[1].dano.max / f3.habilidades[1].dano.max - 1.08) < 0.03, `${f2.habilidades[1].dano.max} / ${f3.habilidades[1].dano.max}`);
});

test('na CAÇADA: o ativo sai e alterna as gemas; deixado, sai sem morrer; morto, só volta revivido por 250 de ouro × o nível', { skip: SEM }, () => {
  const e = dono({ mercenario: 1 }, 50);
  const merc = contratado(e, 'arqueiro', 40);
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  const h = e.hunt;
  const t = Date.now();
  const lacaio = () => h.lacaios.find((l) => l.mercenario && l.hp > 0);
  Acoes.tiqueDoMercenario(e, h, t);
  const l = lacaio();
  assert.ok(l, 'saiu');
  assert.equal(l.nome, merc.nome);
  assert.equal(l.alcanceDeAtaque, 7, 'a Flecha Dividida alcança 7 casas');
  Acoes.depoisDoGolpeDoMercenario(l);
  assert.equal(l.habilidade, 1);
  // (dono, 17/10 — lote G17: confere a habilidade que entrou, não o dano arredondado; com os Projéteis Viciosos do PoE — 49% mais no acerto — a
  // Flecha Dividida e a Relampejante do mercenário de nível 40 sem arma dão as duas 4–10)
  assert.equal(l.habilidades[l.habilidade].gema, 'Lightning_Arrow', 'a Flecha Relampejante');
  assert.equal(l.dano, l.habilidades[1].dano, 'com o dano dela');
  // deixado: sai sem contar como morte
  M.comando(e, { action: 'deixar' }, af(e));
  Acoes.tiqueDoMercenario(e, h, t + 250);
  assert.equal(lacaio(), undefined);
  assert.equal(merc.morto, false);
  // de novo ao seu lado; morre: fica morto
  M.comando(e, { action: 'levar', id: merc.id }, af(e));
  Acoes.tiqueDoMercenario(e, h, t + 500);
  const l2 = lacaio();
  l2.hp = 0;
  Acoes.mercenarioMorreu(e, l2);
  h.lacaios = h.lacaios.filter((x) => x.hp > 0);
  Acoes.tiqueDoMercenario(e, h, t + 60_000);
  assert.equal(lacaio(), undefined, 'não volta sozinho');
  e.gold = 9_999;
  assert.match(M.comando(e, { action: 'reviver', id: merc.id }, af(e)).erro, /Faltam/);
  e.gold = 10_000;
  assert.equal(M.comando(e, { action: 'reviver', id: merc.id }, af(e)).ok, true);
  assert.equal(e.gold, 0, '250 × 40');
  Acoes.tiqueDoMercenario(e, h, t + 60_250);
  assert.ok(lacaio(), 'revivido');
});

test('P057 — o "recuperado como vida" do mercenário cai ao longo de 4 s (o Recoup do PoE)', { skip: SEM }, () => {
  const l = { hp: 100, maxHp: 1000, recoup: [{ porMs: 400 / 4000, ate: 4000 }] };
  l.recoupEm = 0;
  Cacadas.recuperarDoMercenario(l, 1000);
  assert.ok(Math.abs(l.hp - 200) < 1e-9, 'um quarto em 1 s');
  Cacadas.recuperarDoMercenario(l, 5000);
  assert.ok(Math.abs(l.hp - 500) < 1e-9, 'o resto até os 4 s, e não mais');
  assert.equal(l.recoup.length, 0);
});

test('a TRANSIÇÃO (dono: "1ª contratação grátis"): quem já tinha o nó na primeira entrada contrata o primeiro de graça; quem pega o nó depois paga', { skip: SEM }, () => {
  const antigo = dono({ mercenario: 1 }, 40);
  delete antigo.mercenarios;
  assert.equal(M.migrar(antigo, af(antigo)), true);
  assert.equal(M.migrar(antigo, af(antigo)), false, 'uma vez só');
  const [c] = M.candidatos(antigo, Date.now(), semente(4));
  antigo.gold = 0;
  assert.equal(M.comando(antigo, { action: 'contratar', id: c.id }, af(antigo)).ok, true, 'de graça');
  assert.equal(antigo.gold, 0);
  assert.equal(M.dados(antigo).primeiraGratis, undefined, 'só a primeira');
  assert.match(M.comando(antigo, { action: 'contratar', id: M.dados(antigo).candidatos[0].id }, af(antigo)).erro, /Faltam/);
  // quem entra sem o nó e o pega depois
  const novo = dono({}, 40);
  delete novo.mercenarios;
  M.migrar(novo, af(novo));
  novo.equipment.ring.poe.af = { mercenario: 1 };
  novo.gold = 0;
  const [c2] = M.candidatos(novo, Date.now(), semente(5));
  assert.match(M.comando(novo, { action: 'contratar', id: c2.id }, af(novo)).erro, /Faltam/);
});
