// AS HABILIDADES PRISMÁTICAS DO PoE (100% — lote "dados", 03/11: "nada pode ficar como 'não se aplica ao jogo'"): o Acerto Elemental e o Golpe
// Selvagem (e as transfiguradas — o Acerto Elemental do Espectro, o Golpe Selvagem dos Extremos) na coleção, com a origem; a tag Prismático; o
// elemento sorteado sem repetir ("Ela evitará escolher o mesmo elemento duas vezes consecutivas") e sem os que o FOCO DE COMBATE proíbe; a forma do
// Golpe Selvagem pelo elemento (o PoB: a explosão de fogo, o raio que ricocheteia, a onda de gelo); e as linhas do Foco de Combate na árvore.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
await import('./apoio.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const Comandos = await import('../systems/passivas/comandos.mjs');
const Pr = await import('../systems/itens-poe/prismaticas.mjs');
const GemasPoe = await import('../systems/itens-poe/gemas-poe.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const LacaiosHab = await import('../systems/itens-poe/lacaios-habilidades.mjs');
const { traduzirLinha } = await import('../systems/itens-poe/arvore.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');

J.iniciar(ITEM_CATALOG);
const ler = (arq) => JSON.parse(readFileSync(new URL(`../gamedata/itens-poe/${arq}`, import.meta.url), 'utf8'));
const seq = (...xs) => { let i = 0; return () => xs[i++ % xs.length]; };

test('a COLEÇÃO: o Acerto Elemental, o Golpe Selvagem e as transfiguradas (o Espectro, os Extremos), com a tag Prismático e a origem na campanha', { skip: SEM }, () => {
  const gemas = ler('gemas-poe.json');
  for (const slug of ['Elemental_Hit', 'Elemental_Hit_of_the_Spectrum', 'Wild_Strike', 'Wild_Strike_of_Extremes']) {
    const g = gemas.find((x) => x.slug === slug);
    assert.ok(g, slug);
    // (o do Espectro não é prismático no PoE: causa os três elementos)
    assert.equal(g.tags.includes('Prismático'), slug !== 'Elemental_Hit_of_the_Spectrum', `${slug}: a tag`);
    assert.ok(GemasPoe.doSlug(slug), `${slug} no jogo`);
  }
  const origem = JSON.stringify(ler('origem-das-gemas.json'));
  for (const slug of ['Elemental_Hit', 'Wild_Strike']) assert.ok(origem.includes(`"${slug}"`), `${slug}: a origem`);
  assert.ok(ModsPoe.tagsDoPoe(['Ataque', 'Prismático']).includes('prismatico'));
  for (const slug of ['Elemental_Hit', 'Wild_Strike', 'Wild_Strike_of_Extremes', 'Tornado_of_Elemental_Turbulence', 'Summon_Skeletons_of_Mages']) assert.ok(Pr.ehPrismatica(slug), slug);
});

test('a ESCOLHA do elemento: sem repetir o anterior, sem os proibidos; com só um livre, ele (repetindo); com os três proibidos, a regra cai', { skip: SEM }, () => {
  for (let i = 0; i < 30; i++) assert.notEqual(Pr.escolherElemento('fire', new Set(), seq(i / 30)), 'fire');
  for (let i = 0; i < 30; i++) assert.equal(Pr.escolherElemento('ice', new Set(['fire']), seq(i / 30)), 'energy');
  assert.equal(Pr.escolherElemento('ice', new Set(['fire', 'energy']), () => 0.7), 'ice');
  assert.ok(Pr.ELEMENTOS.includes(Pr.escolherElemento(null, new Set(['fire', 'ice', 'energy']), () => 0.5)));
  // os pesos (a Explosão Prismática pelos atributos), sem o proibido
  for (let i = 0; i < 20; i++) assert.notEqual(Pr.elementoPorPesos([['fire', 100], ['ice', 1], ['energy', 1]], new Set(['fire']), seq(i / 20)), 'fire');
  assert.deepEqual([...Pr.proibidos({ afPoe: { prisma_nao_escolhe_ice: 1 } })], ['ice']);
});

test('o GOLPE SELVAGEM converte o Físico no elemento do uso e, com o Fogo e o Raio proibidos, é sempre Gelo', { skip: SEM }, () => {
  const arma = { min: 10, max: 20 };
  for (const el of ['fire', 'ice', 'energy']) assert.deepEqual(Object.keys(GemasPoe.partesDoAtaque('Wild_Strike', 20, arma, {}, Math.random, { escolhido: el })), [el]);
  for (let i = 0; i < 20; i++) assert.deepEqual(Object.keys(GemasPoe.partesDoAtaque('Wild_Strike', 20, arma, {}, seq(i / 20), { proibidos: new Set(['fire', 'energy']) })), ['ice']);
  // o Acerto Elemental: "Apenas Causa Dano do Elemento escolhido" — sem o proibido
  for (let i = 0; i < 20; i++) assert.notDeepEqual(Object.keys(GemasPoe.partesDoAtaque('Elemental_Hit', 20, arma, {}, seq(i / 20), { proibidos: new Set(['ice']) })), ['ice']);
});

test('a FORMA do Golpe Selvagem pelo elemento (o PoB): Fogo — a explosão em volta do alvo; Raio — o raio que ricocheteia; Gelo — os projéteis que perfuram', { skip: SEM }, () => {
  const entry = { id: 'x', projetil: 5, forma: null, cadeia: null };
  const efeito = { encadear: 7, projeteisBase: 3, perfurar: 99, alvosExtras: 0 };
  const circ = (r) => [[0, 0], [r, 0]];
  const fogo = Pr.usoDoGolpeSelvagem(entry, efeito, 'fire', circ);
  assert.equal(fogo.parte, 'explosao');
  assert.equal(fogo.entry.projetil, null);
  assert.ok(fogo.entry.forma && fogo.entry.alvoNoCentro);
  assert.equal(fogo.efeito.encadear, 0);
  assert.equal(fogo.efeito.perfurar, 0);
  const raio = Pr.usoDoGolpeSelvagem(entry, efeito, 'energy', circ);
  assert.equal(raio.parte, 'raio');
  assert.equal(raio.entry.projetil, null);
  assert.ok(raio.entry.cadeia);
  assert.equal(raio.efeito.cadeiaPoe.saltos, 7);
  const gelo = Pr.usoDoGolpeSelvagem(entry, efeito, 'ice', circ);
  assert.equal(gelo.parte, 'onda');
  assert.equal(gelo.entry.projetil, 5);
  assert.equal(gelo.efeito.projeteisBase, 3);
  assert.equal(gelo.efeito.perfurar, 99);
  assert.equal(gelo.efeito.encadear, 0);
  assert.equal(Pr.RAIO_DA_EXPLOSAO_M, 2.4);
  assert.equal(GemasPoe.areaNoNivel('Wild_Strike', 1).raioM, 2.4);
});

test('o ESQUELETO MAGO: a magia do elemento proibido não sai', { skip: SEM }, () => {
  const l = { habPob: { fixa: true, principal: [{ id: 'SkeletonMinionProjectileCold' }, { id: 'SkeletonMinionProjectileFire' }, { id: 'SkeletonMinionProjectileLightning' }] } };
  for (let i = 0; i < 12; i++) {
    delete l.habPobIndice;
    assert.equal(LacaiosHab.principalDaVez(l, seq(i / 12), new Set(['ice', 'fire'])).id, 'SkeletonMinionProjectileLightning');
  }
  l.habPobIndice = 0;
  assert.notEqual(LacaiosHab.principalDaVez(l, () => 0, new Set(['ice'])).id, 'SkeletonMinionProjectileCold', 'a escolhida que ficou proibida é refeita');
});

// ---------------------------------------------------------------- o FOCO DE COMBATE na árvore
test('as LINHAS do Foco de Combate valem (sem "não se aplica"): "não podem escolher" e "menos Dano" — também a de Fogo, que o poedb pt escreve "de Destreza"', { skip: SEM }, () => {
  const linhas = [
    'Com um total de 40 de Destreza no Raio, Habilidades Prismáticas não podem escolher Fogo',
    'Com um total de 40 de Força e Inteligência no Raio, Habilidades Prismáticas não podem escolher Gelo',
    'Com um total de 40 de Destreza e Força no Raio, Habilidades Prismáticas não podem escolher Raio',
  ];
  assert.deepEqual(linhas.map((l) => traduzirLinha(l).efeitos[0]), [
    { add: 'raio_prisma_nao_escolhe_fire', valor: 40 }, { add: 'raio_prisma_nao_escolhe_ice', valor: 40 }, { add: 'raio_prisma_nao_escolhe_energy', valor: 40 },
  ]);
  const menos = traduzirLinha('Com um total de 40 de Força e Inteligência no Raio, Habilidades Prismáticas causam 50% menos Dano de Gelo');
  assert.deepEqual(menos.efeitos, [{ add: 'raio_prisma_menos_ice_limiar', valor: 40 }, { add: 'raio_prisma_menos_ice', valor: 50 }]);
  for (const l of [...linhas, 'Com um total de 40 de Força e Inteligência no Raio, Habilidades Prismáticas causam 50% menos Dano de Gelo']) assert.ok(!/não se aplica/.test(traduzirLinha(l).nota ?? ''), l);
});

test('o FOCO DE COMBATE (Carmesim) no encaixe: com 40 de Força + Inteligência alocadas no raio, as prismáticas não escolhem Gelo e têm "50% menos Dano de Gelo"', { skip: SEM }, () => {
  const u = Catalogo.catalogo().classes.Jewels.unicos.find((x) => x.slug === 'Combat_Focus' && x.base === 'Joia Carmesim');
  const b = Catalogo.catalogo().classes.Jewels.bases.find((x) => x.nome === 'Joia Carmesim');
  assert.ok(u && b);
  const peca = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: b.id, raridade: 'unico', ilvl: 80, rng: () => 0, unico: 'Combat_Focus' }));
  const textos = JSON.stringify(peca.poe);
  const linhaGelo = /Força e Inteligência no Raio/.test(textos);
  const r = P.raioDaJoia(peca);
  assert.ok(r?.max > 0, 'o Foco de Combate tem raio');
  // o encaixe com nós de Força e Inteligência (+10 cada) no raio que somem 40
  const ehAtr = (n, a) => n.tipo === 'small' && !n.ascendencia && n.efeitos?.length === 1 && n.efeitos[0].add === a && n.efeitos[0].valor === 10;
  const dentro = (n, s) => { const d = Math.hypot(n.x - s.x, n.y - s.y); return d <= r.max && d >= r.min; };
  let achado = null;
  for (const s of P.arvore().nos.filter((n) => P.ehEncaixeDeJoia(n))) {
    const nos = P.arvore().nos.filter((n) => (ehAtr(n, 'str') || ehAtr(n, 'int')) && dentro(n, s));
    if (nos.length >= 4) { achado = { s, nos: nos.slice(0, 4) }; break; }
  }
  assert.ok(achado, 'um encaixe com 4 nós de Força/Inteligência no raio');
  const el = linhaGelo ? 'ice' : null;
  assert.equal(el, 'ice', 'a Carmesim é a do Gelo');
  const e = personagemDeTeste({ vocacao: 'knight', level: 90 });
  e.sistema = 'poe';
  e.classePoe = 'Marauder';
  P.garantir(e);
  e.passivas.alocados.push(achado.s.id, ...achado.nos.slice(0, 3).map((n) => n.id));
  P.garantir(e);
  e.inventory = [peca];
  assert.equal(Comandos.comando(e, { action: 'encaixarJoia', no: achado.s.id, pilha: 0, id: peca.id }).ok, true);
  assert.ok(!(P.efeitos(e).adds.prisma_nao_escolhe_ice > 0), 'com 30, não');
  e.passivas.alocados.push(achado.nos[3].id);
  const a = P.efeitos(e).adds;
  assert.equal(a.prisma_nao_escolhe_ice, 1, 'com 40, não escolhe Gelo');
  assert.equal(a['mais_dano_gelo@prismatico'], -50);
});

test('na CAÇADA (a Arena): o Golpe Selvagem não repete o elemento de um uso para o outro', { skip: SEM }, async () => {
  const { ACTION_CATALOG } = await import('../systems/dados.mjs');
  const Acoes = await import('../systems/acoes.mjs');
  const GS = await import('../systems/skills/gemas.mjs');
  const R = await import('../systems/skills/reforcos.mjs');
  const SP = await import('../systems/itens-poe/suportes-poe.mjs');
  await GemasPoe.iniciar({ registrarGema: (g) => (Acoes.registrarAcao(g.entry), GS.registrarAtiva(g)), registrarReforco: R.registrar });
  SP.iniciar({ registrarSuporte: GS.registrarSuporte });
  const Reg = await import('../systems/combate/registro.mjs');
  Reg.definirNivel(2);
  Reg.limparRegistro();
  const Arena = await import('../admin/arena-efeitos.mjs');
  const acao = GemasPoe.doSlug('Wild_Strike').acao;
  assert.ok(ACTION_CATALOG.spells.some((x) => x.id === acao));
  const r = Arena.combate({ skill: acao, nivel: 20, mobs: 6, segundos: 12 });
  assert.ok(r.ok !== false);
  // a FORMA de cada uso pelos eventos: o tiro (a onda de Gelo), a área (a explosão de Fogo) ou só os golpes nos alvos (o raio que ricocheteia)
  const formas = [];
  for (const e of (r.quadros ?? []).flatMap((q) => q.eventos ?? [])) {
    if (e.sk !== acao) continue;
    if (e.t === 'skill') formas.push(null);
    else if (formas.length && formas[formas.length - 1] == null && (e.t === 'shot' || e.t === 'area')) formas[formas.length - 1] = e.t === 'shot' ? 'onda' : 'explosao';
  }
  const seqF = formas.map((f) => f ?? 'raio');
  assert.ok(seqF.length >= 4, seqF.join(','));
  assert.ok(seqF.every((f, i) => i === 0 || f !== seqF[i - 1]), `sem repetir: ${seqF.join(',')}`);
  assert.ok(new Set(seqF).size >= 2);
});
