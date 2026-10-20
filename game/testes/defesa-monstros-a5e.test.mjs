// (lote A5e, dono 20/10) A ARMADURA dos monstros do PoE como no poedb: round(tabela de armadura do poedb no nível efetivo × o multiplicador do tipo),
// o `armaduraPct` por cima e o teto de antes (`L.armaduraMaxima`). A tabela do poedb NÃO é a `monsterArmourTable` do PoB (no 68: 28790 × 12009):
// 1–90 da Base por nível do bestiário do poedb (conferida com as Base Stat dos tooltips), 91–100 extrapolados. Os números do poedb: o Hillock no 68,
// "28790(Base Stat) * 1"; o Chefe Guerreiro Sanguinário (Blood_Chieftain) no 83, "92477(Base Stat) * 1".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const Monstros = await import('../systems/itens-poe/monstros.mjs');
const { noNivel } = await import('../systems/itens-poe/mapas-areas.mjs');
const Atributos = await import('../systems/personagem/atributos.mjs');
const AtributosDoMob = await import('../systems/mobs/atributos.mjs');
const { BESTIARY } = await import('../systems/hunt/monstros.mjs');

/** O monstro do PoE `slug` da campanha (o de nível mais alto, ou o do `daCampanha`) levado ao `nivel` — como os mapas o registram. A chave do bestiário. */
function noNivelDe(slug, nivel, daCampanha = null) {
  let achado = null;
  for (const a of Object.values(Monstros.CAMPANHA.areas)) for (const m of a.monstros ?? []) if (m.slug === slug && (daCampanha ? m.nivel === daCampanha : !achado || m.nivel > achado.nivel)) achado = m;
  assert.ok(achado, slug);
  return Monstros.registrar(noNivel(achado, nivel ?? achado.nivel), 'skeleton');
}
const bicho = (key, extra = {}) => ({ key, ...extra });
const nivelDe = (m) => Atributos.levelDoBicho({}, m);

test('A5e: a tabela de armadura do poedb (não a do PoB) e a origem de cada nível', { skip: SEM }, () => {
  const D = AtributosDoMob.DEFESA_POE;
  assert.equal(D.tabelas.armadura.length, 100);
  assert.deepEqual([1, 10, 30, 50, 68, 83, 90].map((n) => AtributosDoMob.tabelaPoe('armadura', n)), [16, 115, 1120, 6656, 28790, 92477, 157600]);
  for (let n = 2; n <= 100; n++) assert.ok(D.tabelas.armadura[n - 1] > D.tabelas.armadura[n - 2], `cresce no ${n}`);
  assert.deepEqual(D.origemDasTabelas.armadura.extrapolados, [91, 92, 93, 94, 95, 96, 97, 98, 99, 100]);
  assert.ok(D.origemDasTabelas.armadura.tooltips.includes(68) && D.origemDasTabelas.armadura.tooltips.includes(83));
  // a campanha já trazia a tabela × o multiplicador: bate em quase todos (o Vaal_Oversoul do 23 fica de fora — 924 na campanha, 556 × 1,5 = 834)
  assert.ok(D.conferenciaDaArmadura.batem >= D.conferenciaDaArmadura.total - 1, JSON.stringify(D.conferenciaDaArmadura.naoBatem));
});

test('A5e: o Hillock no nível 68 — 28790 de armadura (o poedb); no 1 da campanha, 16 (o mesmo de antes)', { skip: SEM }, () => {
  const m = bicho(noNivelDe('Hillock', 68));
  assert.equal(nivelDe(m), 68);
  assert.equal(AtributosDoMob.armaduraDe(m, nivelDe(m)), 28790);
  const a = AtributosDoMob.atributosFinais(m, 68);
  assert.equal(a.armadura.valor, 28790);
  assert.ok(a.armadura.origens.some((o) => o.valor === 28790) && a.armadura.origens.some((o) => o.fator === 1));
  const em1 = bicho(noNivelDe('Hillock', null, 1));
  assert.equal(AtributosDoMob.armaduraDe(em1, nivelDe(em1)), 16);
  assert.equal(BESTIARY[em1.key].poe.armadura, 16);
});

test('A5e: o Blood_Chieftain no nível 83 — 92477 de armadura (o poedb); o admin mostra a mesma conta', { skip: SEM }, async () => {
  const key = noNivelDe('Blood_Chieftain', 83);
  assert.equal(nivelDe(bicho(key)), 83);
  assert.equal(AtributosDoMob.armaduraDe(bicho(key), 83), 92477);
  const Admin = await import('../admin/mapas.mjs');
  const r = Admin.atributosDoMob({ key, level: 100 });
  assert.ok(r.ok);
  assert.equal(r.atributos.armadura.valor, 92477);
  assert.equal(AtributosDoMob.armaduraPoeDoSlug('Blood_Chieftain', 83), 92477);
});

test('A5e: o nível do mapa sobe a armadura (a tabela, sem a curva à parte); o levelExtra, o armaduraPct e o teto por cima', { skip: SEM }, () => {
  const em70 = bicho(noNivelDe('Blood_Chieftain', 70));
  const em80 = bicho(noNivelDe('Blood_Chieftain', 80));
  assert.equal(AtributosDoMob.armaduraDe(em70, nivelDe(em70)), 33714);
  assert.equal(AtributosDoMob.armaduraDe(em80, nivelDe(em80)), 73441);
  assert.ok(AtributosDoMob.armaduraDe(em80, nivelDe(em80)) > AtributosDoMob.armaduraDe(em70, nivelDe(em70)));
  // o número do monstro no mapa (o `noNivel`) é o da tabela, não a curva de crescimento à parte
  assert.equal(BESTIARY[em80.key].poe.armadura, 73441);
  assert.equal(BESTIARY[em80.key].poe.evasao, AtributosDoMob.defesaPoeDoSlug('Blood_Chieftain', 80).evasao);
  // o multiplicador do tipo: o Arqueiro Ensanguentado (× 2 nos mapas)
  const arqueiro = bicho(noNivelDe('Bloodstained_Archer', 83));
  assert.equal(AtributosDoMob.armaduraDe(arqueiro, 83), Math.round(92477 * AtributosDoMob.multiplicadorDoSlug('armadura', 'Bloodstained_Archer', 83)));
  // a raridade com Lv +2: o nível 72 da tabela
  const raro = bicho(em70.key, { levelExtra: 2 });
  assert.equal(nivelDe(raro), 72);
  assert.equal(AtributosDoMob.armaduraDe(raro, nivelDe(raro)), 39449);
  assert.equal(AtributosDoMob.armaduraDe(bicho(em70.key, { armaduraPct: 50 }), 70), Math.round(33714 * 1.5));
  assert.equal(AtributosDoMob.armaduraDe(bicho(em70.key, { armaduraPct: 10_000 }), 70), AtributosDoMob.CONFIG.limites.armaduraMaxima, 'o teto');
});

test('A5e: o multiplicador por nível da armadura (o Savage_Crab do 2 é a variante × 1,5: 23 → 35) e o sem página pela campanha', { skip: SEM }, () => {
  assert.equal(AtributosDoMob.multiplicadorDoSlug('armadura', 'Savage_Crab', 2), 1.5);
  assert.equal(AtributosDoMob.armaduraPoeDoSlug('Savage_Crab', 2), 35);
  assert.equal(AtributosDoMob.armaduraPoeDoSlug('Grinning_Totem', 6), 118, 'sem página: × 2, o da campanha (118 ÷ 59)');
});

test('A5e: a redução física do golpe usa a armadura nova', { skip: SEM }, async () => {
  const Formulas = await import('../systems/combate/formulas.mjs');
  const key = noNivelDe('Hillock', 68);
  const r = AtributosDoMob.reducaoDeArmadura(bicho(key), 68, 1000);
  if (AtributosDoMob.CONFIG.armaduraDoMob.ativa) assert.equal(r, Formulas.reducaoDeArmaduraPoe(28790, 1000));
  else assert.equal(r, 0);
});

test('A5e: o monstro do Draevor segue pela curva de antes', { skip: SEM }, () => {
  const k = Object.keys(BESTIARY).find((x) => !BESTIARY[x].poe && !x.startsWith('poe-'));
  assert.equal(AtributosDoMob.armaduraDe(bicho(k), 50), Math.min(AtributosDoMob.CONFIG.limites.armaduraMaxima, AtributosDoMob.atributosFinais(bicho(k), 50).armadura.valor));
});

test('A5e (revisão): o CHEFE DE ATO na arena (base de um desenho do Draevor) — a armadura, a evasão e a precisão pela tabela do PoE × o multiplicador', { skip: SEM }, async () => {
  const PC = await import('../systems/itens-poe/campanha.mjs');
  PC.iniciar();
  const BU = await import('../systems/bosses-unicos/catalogo.mjs');
  const { criarBossUnico } = await import('../systems/bosses-unicos/boss.mjs');
  const def = BU.bossUnico(PC.idDoChefe(10));
  assert.ok(def, 'o chefe do ato 10 registrado');
  assert.equal(def.poe?.slug, Monstros.CAMPANHA.chefes[10].monstro.slug);
  assert.ok(!BESTIARY[def.base]?.poe, `a base (${def.base}) é um desenho do Draevor, sem o poe`);
  const m = criarBossUnico(def, { x: 0, y: 0, z: 7 });
  assert.ok(m?.poe, 'o monstro leva o poe do chefe');
  const slug = def.poe.slug;
  const nivel = Atributos.levelDoBicho(null, m);
  assert.equal(nivel, def.poe.nivel + (m.levelExtra ?? 0));
  const conta = (qual) => Math.round(AtributosDoMob.tabelaPoe(qual, nivel) * AtributosDoMob.multiplicadorDoSlug(qual, slug, def.poe.nivel));
  assert.equal(AtributosDoMob.armaduraDe(m, nivel), Math.min(AtributosDoMob.CONFIG.limites.armaduraMaxima, conta('armadura')));
  assert.equal(AtributosDoMob.evasaoDe(m, nivel), conta('evasao'));
  assert.equal(AtributosDoMob.precisaoDe(m, nivel), conta('precisao'));
  if (nivel === 67) assert.deepEqual([AtributosDoMob.armaduraDe(m, 67), AtributosDoMob.evasaoDe(m, 67), AtributosDoMob.precisaoDe(m, 67)], [26597, 4575, 558], 'o Kitava no 67');
  assert.equal(AtributosDoMob.atributosFinais(m, nivel).armadura.valor, AtributosDoMob.armaduraDe(m, nivel), 'o detalhamento com a mesma conta');
});
