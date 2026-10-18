// LOTE 83 — a ÁREA das MALDIÇÕES (dono, 18/10: "Área como no PoE"): no PoE o Feitiço amaldiçoa todos os inimigos no raio dele, e a aura de
// maldição (a Blasfêmia) os que estão em volta de você. No jogo a maldição pega no acerto (`Reforcos.marcar`): agora pega também nos vizinhos a
// até o raio — os metros da gema ÷ 2 (1 casa = 2 m) × √ da "Área de Efeito aumentada" (a geral e a das Maldições: "Efeito em Área de Habilidades
// de Maldição aumentado em X%", o notável Palavras Proibidas, que só o Megalomaníaco sorteia); a fração, a chance de uma casa a mais. A Marca é
// de um alvo só. E o relatório da árvore: as Ramificadoras únicas pelo estado do balão (`estadosDaRamificadora`), os notáveis do Megalomaníaco
// na seção dos nós.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = !existsSync(Catalogo.ARQUIVO) && 'catálogo do PoE não está nesta máquina';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Acoes = await import('../systems/acoes.mjs');
const Reforcos = await import('../systems/skills/reforcos.mjs');
const GemasPoe = await import('../systems/itens-poe/gemas-poe.mjs');
const { traduzirLinha } = await import('../systems/itens-poe/arvore.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');
if (!SEM) {
  Jogo.iniciar(ITEM_CATALOG);
  await (await import('../systems/itens-poe/iniciar.mjs')).iniciarJogoDoPoe();
}

const PECA = (classe, af = {}) => ({ id: 3357, count: 1, poe: { classe, base: `${classe}/X`, af, prefixos: [], sufixos: [], implicitos: [] } });
function novo() {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 100 }), { sistema: 'poe', classePoe: 'Scion' });
  delete e.classe;
  P.garantir(e);
  e.equipment = {};
  return e;
}
/** Liga a gema de maldição `slug` (nível 20) no `hunt` — o mesmo buff que `Acoes.disparar` grava (`reserva`: lançada como aura, a Blasfêmia). */
function ligar(e, hunt, slug, { reserva = false } = {}) {
  const r = GemasPoe.doSlug(slug);
  assert.ok(r?.buff, `${slug}: gema de maldição com reforço`);
  const entry = { id: r.acao, poeGema: { slug, arquetipo: r.arquetipo } };
  Ficha.invalidar(e);
  (hunt.buffs ??= {})[entry.id] = { ate: Number.MAX_SAFE_INTEGER, desde: 0, tipo: 'poe-maldicao', fator: 1, ...(reserva ? { reserva: 1 } : {}), efeitosPoe: Acoes.efeitosDaMaldicao(GemasPoe.buffNoNivel(slug, 20).efeitos, { nivel: 20 }, e, entry) };
  return entry.id;
}
const regras = (hunt, id) => hunt.buffs[id].efeitosPoe.find((x) => x.efeito === 'maldicaoRegras');
const bicho = (uid, x, y) => ({ uid, key: 'rat', x, y, hp: 100, maxHp: 100 });

test('a linha "Efeito em Área de Habilidades de Maldição" soma na área das Maldições; o Palavras Proibidas inteiro com efeito', { skip: SEM }, () => {
  const t = traduzirLinha('Efeito em Área de Habilidades de Maldição aumentado em 25%');
  assert.deepEqual(t.efeitos.map((x) => [x.add, x.valor]), [['area_inc@maldicao', 25]]);
  const n = Catalogo.catalogo().ramificadoras.notaveis['Palavras Proibidas'];
  assert.ok(n, 'o notável está nos dados');
  for (const l of n.linhas) assert.ok(traduzirLinha(l).efeitos.length, l);
});

test('o Feitiço amaldiçoa os vizinhos do atingido a até o raio da gema (2,6 m = 1,3 casa); quem está longe, não', { skip: SEM }, () => {
  const e = novo();
  const alvo = bicho(1, 10, 10);
  const vizinho = bicho(2, 11, 10);
  const longe = bicho(3, 14, 10);
  const hunt = { clock: 0, pos: { x: 0, y: 0 }, z: 0, buffs: {}, monstros: [alvo, vizinho, longe] };
  const id = ligar(e, hunt, 'Vulnerability');
  const casas = regras(hunt, id).raioCasas;
  assert.ok(Math.abs(casas - GemasPoe.areaNoNivel('Vulnerability', 20).raioM / 2) < 1e-9, `${casas}`);
  const r = Reforcos.marcar(hunt, alvo, 0);
  assert.ok(alvo.maldicoes?.[id] && vizinho.maldicoes?.[id], 'o atingido e o vizinho a 1 casa');
  assert.ok(!longe.maldicoes?.[id], 'a 4 casas, não');
  assert.deepEqual(r.espalhou.map((x) => [x.bicho.uid, x.amaldicoouSemMaldicao, x.semMaldicaoNaoAura]), [[2, true, true]]);
});

test('a área aumentada (a geral e a das Maldições) aumenta o raio: × √(1 + X%)', { skip: SEM }, () => {
  const e = novo();
  e.equipment = { ring: PECA('Rings', { 'area_inc@maldicao': 200, area_inc: 100 }) };
  const alvo = bicho(1, 10, 10);
  const a3 = bicho(2, 13, 10);
  const hunt = { clock: 0, pos: { x: 0, y: 0 }, z: 0, buffs: {}, monstros: [alvo, a3] };
  const id = ligar(e, hunt, 'Vulnerability');
  const base = GemasPoe.areaNoNivel('Vulnerability', 20).raioM / 2;
  assert.ok(Math.abs(regras(hunt, id).raioCasas - base * 2) < 1e-9, `${regras(hunt, id).raioCasas}`);
  // 2,6 casas: a 3 casas só com a fração (60%) — com o sorteio fixo abaixo dela, pega
  const original = Math.random;
  Math.random = () => 0.1;
  try { Reforcos.marcar(hunt, alvo, 0); } finally { Math.random = original; }
  assert.ok(a3.maldicoes?.[id], 'a 3 casas com a área ×4');
});

test('a área não depende do atingido: já amaldiçoado, à prova de maldições — os vizinhos pegam igual', { skip: SEM }, () => {
  const e = novo();
  const alvo = bicho(1, 10, 10);
  const hunt = { clock: 0, pos: { x: 0, y: 0 }, z: 0, buffs: {}, monstros: [alvo] };
  const id = ligar(e, hunt, 'Vulnerability');
  Reforcos.marcar(hunt, alvo, 0);
  const chegou = bicho(2, 11, 10);
  hunt.monstros.push(chegou);
  const r = Reforcos.marcar(hunt, alvo, 100);
  assert.ok(chegou.maldicoes?.[id], 'quem chegou perto do atingido já amaldiçoado');
  assert.equal(r.amaldicoouSemMaldicao, false);
  assert.deepEqual(r.espalhou.map((x) => x.bicho.uid), [2]);

  const imune = Object.assign(bicho(1, 10, 10), { aProvaDeMaldicoes: true });
  const vizinho = bicho(2, 10, 11);
  const hunt2 = { clock: 0, pos: { x: 0, y: 0 }, z: 0, buffs: {}, monstros: [imune, vizinho] };
  const id2 = ligar(novo(), hunt2, 'Vulnerability');
  Reforcos.marcar(hunt2, imune, 0);
  assert.ok(!imune.maldicoes?.[id2] && vizinho.maldicoes?.[id2], 'o Feitiço não pega no à prova; no vizinho, sim');
});

test('a aura de maldição (a Blasfêmia): em volta de VOCÊ — o atingido longe de você não pega, quem está perto de você pega; a área da Blasfêmia e a de Aura contam; a Marca é de um alvo só', { skip: SEM }, () => {
  const e = novo();
  const longe = bicho(1, 6, 0);
  const pertoDoAlvo = bicho(2, 7, 0);
  const pertoDeVoce = bicho(3, 0, 1);
  const hunt = { clock: 0, pos: { x: 0, y: 0 }, z: 0, buffs: {}, monstros: [longe, pertoDoAlvo, pertoDeVoce] };
  const id = ligar(e, hunt, 'Vulnerability', { reserva: true });
  const original = Math.random;
  Math.random = () => 0.99;
  try { Reforcos.marcar(hunt, longe, 0); } finally { Math.random = original; }
  assert.ok(!longe.maldicoes?.[id], 'o atingido a 6 casas de você');
  assert.ok(!pertoDoAlvo.maldicoes?.[id], 'colado no atingido, mas longe de você');
  assert.ok(pertoDeVoce.maldicoes?.[id]?.aura, 'a 1 casa de você');

  // a Blasfêmia 20 ("Efeito em Área de Habilidades Maldição Suportadas aumentado em X%") e a área de Aura entram no raio
  const S = GemasPoe.doSlug('Vulnerability');
  const entry = { id: S.acao, poeGema: { slug: 'Vulnerability', arquetipo: S.arquetipo } };
  const e2 = novo();
  e2.equipment = { ring: PECA('Rings', { 'area_inc@aura': 100 }) };
  Ficha.invalidar(e2);
  const base = GemasPoe.areaNoNivel('Vulnerability', 20).raioM / 2;
  const raioCom = (ef) => Acoes.efeitosDaMaldicao(GemasPoe.buffNoNivel('Vulnerability', 20).efeitos, ef, e2, entry).find((x) => x.efeito === 'maldicaoRegras').raioCasas;
  assert.ok(Math.abs(raioCom({ nivel: 20 }) - base) < 1e-9, 'sem a Blasfêmia, a área de Aura não conta');
  assert.ok(Math.abs(raioCom({ nivel: 20, maldicaoEmAura: 1, areaMaldicaoPct: 60 }) - base * Math.sqrt(2.6)) < 1e-9, `${raioCom({ nivel: 20, maldicaoEmAura: 1, areaMaldicaoPct: 60 })}`);

  const e3 = novo();
  const m1 = bicho(1, 10, 10);
  const m2 = bicho(2, 11, 10);
  const hunt3 = { clock: 0, pos: { x: 0, y: 0 }, z: 0, buffs: {}, monstros: [m1, m2] };
  const marca = ligar(e3, hunt3, 'Assassins_Mark');
  assert.equal(regras(hunt3, marca).raioCasas, undefined);
  const r = Reforcos.marcar(hunt3, m1, 0);
  assert.ok(m1.maldicoes?.[marca] && !m2.maldicoes?.[marca]);
  assert.equal(r.espalhou, undefined, 'sem vizinhos amaldiçoados');
});

test('a linha da área da Blasfêmia vira a área da maldição do suporte', { skip: SEM }, async () => {
  const SuportesPoe = await import('../systems/itens-poe/suportes-poe.mjs');
  const r = SuportesPoe.efeitoNoNivel('Blasphemy_Support', 20, 0);
  assert.ok(r.efeito?.areaMaldicaoPct > 0, JSON.stringify(r.efeito));
  assert.ok(!(r.naoFeitas ?? []).some((l) => /Efeito em Área/.test(l)), JSON.stringify(r.naoFeitas));
});

test('o relatório: as Ramificadoras únicas pelo leitor do balão (o pool do Megalomaníaco inteiro, a Vozes, a pedra), e os notáveis do Megalomaníaco na seção dos nós', { skip: SEM }, async () => {
  const Rel = await import('../tools/relatorio-arvore-poe.mjs');
  const T = await import('../systems/itens-poe/traduzir.mjs');
  const cat = Catalogo.catalogo();
  const ler = await Rel.leitorDaRamificadoraUnica(cat, Catalogo, T);
  const u = (slug) => cat.classes.Jewels.unicos.find((x) => x.slug === slug);
  const mega = u('Megalomaniac');
  const pool = ler(mega, { modelo: Object.keys(mega.linhasSorteadas.substitui)[0] });
  assert.equal(pool.pool, 287);
  assert.deepEqual(pool.sem, []);
  assert.equal(pool.efeito, 287);
  for (const slug of ['Voices', 'Megalomaniac', 'Calamitous_Visions']) for (const m of u(slug).modificadores) {
    const r = ler(u(slug), m);
    assert.deepEqual(r.sem, [], `${slug}: ${m.texto}`);
    assert.equal(r.lembrete, /^\(/.test(m.texto), `${slug}: ${m.texto}`);
  }
  const { grupos, sem } = await Rel.linhasDasRamificadoras(cat);
  assert.equal(grupos.notavel.sem, 0, JSON.stringify(sem));
  assert.ok(grupos.notavel.total >= 676, `${grupos.notavel.total}`);
});
