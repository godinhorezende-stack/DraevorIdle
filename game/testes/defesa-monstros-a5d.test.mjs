// (lote A5d, dono 20/10) A EVASÃO e a PRECISÃO dos monstros do PoE como no PoE 1: a tabela do PoE no nível do monstro (`data.monsterEvasionTable` /
// `data.monsterAccuracyTable` do PoB) × o multiplicador do TIPO dele (o "Monster Type Multiplier" do poedb — `gamedata/itens-poe/monstros-defesa-poe.json`);
// os aumentos do monstro (o Evasivo, `evasaoPct`; `precisaoPct`) por cima. Nos mapas, o nível do mapa. E a RAJADA VULCÂNICA rola o acerto (`Defesa.errou`).
// Os números do poedb: o Hillock no 68, "290(Base Stat) * 2" = 580 de precisão e "4739 * 1" de evasão; o Arqueiro Ensanguentado no 83, 518 × 2 = 1036
// e 7860 × 1,1 = 8646.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste } = await import('./apoio.mjs');
const Acoes = await import('../systems/acoes.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const Monstros = await import('../systems/itens-poe/monstros.mjs');
const { noNivel } = await import('../systems/itens-poe/mapas-areas.mjs');
const Atributos = await import('../systems/personagem/atributos.mjs');
const AtributosDoMob = await import('../systems/mobs/atributos.mjs');
const { BESTIARY } = await import('../systems/hunt/monstros.mjs');

/** O monstro do PoE `slug` (o da campanha de nível mais alto) levado ao `nivel` — como os mapas o registram. A chave do bestiário. */
function noNivelDe(slug, nivel) {
  let achado = null;
  for (const a of Object.values(Monstros.CAMPANHA.areas)) for (const m of a.monstros ?? []) if (m.slug === slug && (!achado || m.nivel > achado.nivel)) achado = m;
  assert.ok(achado, slug);
  return Monstros.registrar(noNivel(achado, nivel), 'skeleton');
}
const bicho = (key, extra = {}) => ({ key, ...extra });
const nivelDe = (m) => Atributos.levelDoBicho({}, m);

test('A5d: as tabelas do PoB e os multiplicadores importados', { skip: SEM }, () => {
  const D = AtributosDoMob.DEFESA_POE;
  assert.equal(D.tabelas.evasao.length, 100);
  assert.equal(D.tabelas.precisao.length, 100);
  assert.deepEqual([AtributosDoMob.tabelaPoe('evasao', 68), AtributosDoMob.tabelaPoe('precisao', 68)], [4739, 290]);
  assert.deepEqual([AtributosDoMob.tabelaPoe('evasao', 83), AtributosDoMob.tabelaPoe('precisao', 83)], [7860, 518]);
  assert.deepEqual([AtributosDoMob.tabelaPoe('evasao', 0), AtributosDoMob.tabelaPoe('evasao', 500)], [67, 13445], 'fora de 1–100: a ponta');
  assert.deepEqual(D.monstros.Hillock, { precisao: 2, evasao: 1, armadura: 1 });
  assert.equal(D.monstros.Bloodstained_Archer.evasao, 1.1);
  assert.equal(D.monstros.Bloodstained_Archer.precisao, 2);
});

test('A5d: o Hillock no nível 68 — 4739 de evasão e 580 de precisão (o poedb)', { skip: SEM }, () => {
  const m = bicho(noNivelDe('Hillock', 68));
  assert.equal(BESTIARY[m.key].poe.slug, 'Hillock');
  assert.equal(nivelDe(m), 68, 'o nível dele, não a estimativa pela exp');
  assert.equal(AtributosDoMob.evasaoDe(m, nivelDe(m)), 4739);
  assert.equal(AtributosDoMob.precisaoDe(m, nivelDe(m)), 580);
});

test('A5d: o Arqueiro Ensanguentado no nível 83 — 8646 de evasão (7860 × 1,1) e 1036 de precisão (518 × 2)', { skip: SEM }, () => {
  const m = bicho(noNivelDe('Bloodstained_Archer', 83));
  assert.equal(nivelDe(m), 83);
  assert.equal(AtributosDoMob.evasaoDe(m, 83), 8646);
  assert.equal(AtributosDoMob.precisaoDe(m, 83), 1036);
  // o detalhamento (a tela do editor e o simulador) mostra as mesmas contas
  const a = AtributosDoMob.atributosFinais(m, 83);
  assert.equal(a.evasao.valor, 8646);
  assert.equal(a.precisao.valor, 1036);
  assert.ok(a.evasao.origens.some((o) => o.fator === 1.1));
});

test('A5d: o nível do mapa sobe a evasão e a precisão; o levelExtra da raridade também', { skip: SEM }, () => {
  const em70 = bicho(noNivelDe('Bloodstained_Archer', 70));
  const em80 = bicho(noNivelDe('Bloodstained_Archer', 80));
  assert.equal(AtributosDoMob.evasaoDe(em70, nivelDe(em70)), Math.round(5081 * 1.1));
  assert.equal(AtributosDoMob.evasaoDe(em80, nivelDe(em80)), Math.round(7124 * 1.1));
  assert.ok(AtributosDoMob.evasaoDe(em80, nivelDe(em80)) > AtributosDoMob.evasaoDe(em70, nivelDe(em70)));
  assert.equal(AtributosDoMob.precisaoDe(em80, nivelDe(em80)), 462 * 2);
  // (a raridade com Lv +2: o nível 72 da tabela)
  const raro = bicho(em70.key, { levelExtra: 2 });
  assert.equal(nivelDe(raro), 72);
  assert.equal(AtributosDoMob.evasaoDe(raro, nivelDe(raro)), Math.round(5444 * 1.1));
});

test('A5d: o Evasivo (+100% de evasão) e o precisaoPct por cima', { skip: SEM }, () => {
  const key = noNivelDe('Hillock', 68);
  assert.equal(AtributosDoMob.evasaoDe(bicho(key, { evasaoPct: 100 }), 68), 4739 * 2);
  assert.equal(AtributosDoMob.precisaoDe(bicho(key, { precisaoPct: 50 }), 68), 870);
  assert.equal(AtributosDoMob.evasaoDe(bicho(key, { evasaoPct: -100 }), 68), 0);
});

test('A5d: o monstro do Draevor segue pela curva de antes', { skip: SEM }, () => {
  const k = Object.keys(BESTIARY).find((x) => !BESTIARY[x].poe && !x.startsWith('poe-'));
  const curva = AtributosDoMob.atributosFinais(bicho(k), 50);
  assert.equal(AtributosDoMob.evasaoDe(bicho(k), 50), curva.evasao.valor);
  assert.equal(AtributosDoMob.precisaoDe(bicho(k), 50), curva.precisao.valor);
});

test('A5d: a RAJADA VULCÂNICA rola o acerto — erra contra a evasão alta (o evento do erro, sem dano); contra evasão 0, acerta', { skip: SEM }, () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 90 });
  Object.assign(e, { sistema: 'poe', classePoe: 'Marauder' });
  const arma = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Two_Hand_Axes/Vaal_Axe', raridade: 'normal', ilvl: 70, rng: () => 0.5 }));
  arma.poe.af = { ...(arma.poe.af ?? {}), rajada_vulcanica: 20 };
  e.equipment = { ...(e.equipment ?? {}), weapon: arma };
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  const h = e.hunt;
  h.clock = 100_000;
  const key = noNivelDe('Bloodstained_Archer', 83);
  const [a, b, ...outros] = h.monstros;
  for (const o of outros) Object.assign(o, { x: h.pos.x + 60, y: h.pos.y + 60 });
  for (const [m, dx] of [[a, 1], [b, 2]]) Object.assign(m, { key, x: h.pos.x + dx, y: h.pos.y, hp: 1e9, maxHp: 1e9, estados: {}, dots: [], evasaoPct: 100_000, levelExtra: 0 });
  const eventos = [];
  // (o sorteio em 0,5: a chance do nível 20 é 100%; o acerto contra ~8,6 milhões de evasão é o mínimo do PoE, 5%)
  assert.equal(Acoes.rajadaVulcanica(e, h, a, eventos, () => 0.5), 0, 'errou todos');
  assert.equal(eventos.filter((x) => x.t === 'shot').length, 4, 'os 4 projéteis saem');
  assert.equal(eventos.filter((x) => x.t === 'dmg').length, 0);
  assert.ok(eventos.filter((x) => x.t === 'block' && x.errou && x.fonte === 'rajada-vulcanica').length >= 4);
  assert.deepEqual([a.hp, b.hp], [1e9, 1e9]);
  // evasão 0: acerta sempre
  for (const m of [a, b]) { m.evasaoPct = -100; m.errosDoJogador = 0; }
  h.clock += 1000;
  const ev2 = [];
  assert.ok(Acoes.rajadaVulcanica(e, h, a, ev2, () => 0.5) > 0);
  assert.equal(ev2.filter((x) => x.t === 'block').length, 0);
  assert.ok(ev2.filter((x) => x.t === 'dmg').length > 0);
});

test('A5d: o multiplicador POR NÍVEL — o Lurking_Venom do 18 é a variante × 1,5 (493 → 740); no 54 e nos mapas, × 1', { skip: SEM }, () => {
  assert.deepEqual(AtributosDoMob.DEFESA_POE.monstros.Lurking_Venom.porNivel, { 18: { evasao: 1.5 } });
  const em18 = bicho(noNivelDe('Lurking_Venom', 18));
  const em54 = bicho(noNivelDe('Lurking_Venom', 54));
  const em68 = bicho(noNivelDe('Lurking_Venom', 68));
  assert.equal(AtributosDoMob.evasaoDe(em18, nivelDe(em18)), 740);
  assert.equal(AtributosDoMob.evasaoDe(em54, nivelDe(em54)), 2837);
  assert.equal(AtributosDoMob.evasaoDe(em68, nivelDe(em68)), 4739, 'o mapa: o geral (a variante de nível 68+)');
  assert.deepEqual(AtributosDoMob.defesaPoeDoSlug('Lurking_Venom', 18), { evasao: 740, precisao: AtributosDoMob.tabelaPoe('precisao', 18) * 2 });
  // (os outros da revisão: o Hatchling e o The_Animal_Pack no nível da campanha)
  assert.equal(AtributosDoMob.multiplicadorDoSlug('evasao', 'Hatchling', 18), 1);
  assert.equal(AtributosDoMob.multiplicadorDoSlug('evasao', 'The_Animal_Pack', 48), 1.8);
  assert.equal(AtributosDoMob.multiplicadorDoSlug('evasao', 'Kraityns_Thrall', 16), 1.2);
});

test('A5d: a FICHA do modo PoE contra o monstro típico do PoE do nível (a tabela × o padrão), como o combate; o Evasivo por cima', { skip: SEM }, async () => {
  const Formulas = await import('../systems/combate/formulas.mjs');
  const c = AtributosDoMob.chancesNoLevelPoe(1000, 1000, 68, 100);
  assert.equal(c.acerto, Formulas.chanceDeAcertoPoe(1000, 4739));
  assert.equal(c.acerto, 0.85);
  assert.equal(c.acertoEvasivo, Formulas.chanceDeAcertoPoe(1000, 4739 * 2));
  assert.equal(c.acertoEvasivo, 0.66);
  assert.equal(c.esquiva, 1 - Formulas.chanceDeAcertoPoe(580, 1000));
  // o 4º parâmetro do Evasivo: sem ele, a curva do Draevor (como antes)
  assert.equal(Atributos.chanceDeAcertoEvasivo(1000, 68, 100, 4739), c.acertoEvasivo);
  assert.ok(Atributos.chanceDeAcertoEvasivo(1000, 68, 100) > c.acertoEvasivo);
});

test('A5d: o simulador do mob e o detalhamento do editor usam o nível do combate no monstro do PoE (não o digitado)', { skip: SEM }, async () => {
  const Admin = await import('../admin/mapas.mjs');
  const key = noNivelDe('Bloodstained_Archer', 83);
  const r = Admin.atributosDoMob({ key, level: 100 });
  assert.ok(r.ok);
  assert.equal(r.level, 83);
  assert.equal(r.atributos.evasao.valor, 8646);
  assert.equal(r.atributos.precisao.valor, 1036);
});
