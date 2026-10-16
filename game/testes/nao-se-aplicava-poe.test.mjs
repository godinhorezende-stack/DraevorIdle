// AS LINHAS QUE "NÃO SE APLICAVAM" (dono, 14/10: "faça todas que não se aplicam ao jogo" — o lote rápido): o Pacto Cadavérico (o jogo agora cria
// cadáveres), o Alcance do Ricochete, "Projéteis têm N% de chance de Retornarem a você", "… de Ricochetear ao colidirem com o terreno",
// "Projéteis são disparados em direções aleatórias", "Barragens de Projéteis não se propagam" e "Habilidades de Golpe também miram no local
// anterior que foram Usadas".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste } = await import('./apoio.mjs');
const Acoes = await import('../systems/acoes.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const G = await import('../systems/itens-poe/gemas-poe.mjs');
const Secundarios = await import('../systems/skills/golpes-secundarios.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');

const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 70, rng: () => 0.5 }));
function personagem(af = {}, gemas = []) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 80 });
  e.sistema = 'poe';
  e.classePoe = 'Duelist';
  const arma = peca('Two_Hand_Axes/Vaal_Axe');
  arma.poe.af = { ...(arma.poe.af ?? {}), ...af };
  const n = Math.max(1, gemas.length);
  arma.soquetes = { abertos: n, links: Array(Math.max(0, n - 1)).fill(true), gemas: Array(n).fill(null), cores: Array(n).fill('W') };
  e.equipment = { ...(e.equipment ?? {}), weapon: arma };
  e.inventory = gemas.map((s) => GS.itemDaGema({ id: G.doSlug(s).itemId, nivel: 20, xp: 0, raridade: 'comum' }));
  for (let i = 0; i < gemas.length; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.clock = 100_000;
  P.garantir(e);
  return e;
}
const ficha = (e) => { Ficha.invalidar(e); return Ficha.combate(e); };
const b = (x, y, uid) => ({ uid, x, y, hp: 10 });
const resolver = (efeito, vivos, alvo = vivos[0], rng = () => 0.5) => Secundarios.resolver({ efeito, tags: ['projectile', 'single'], origem: { x: 0, y: 0 }, alvo, atingidos: [alvo], vivos, alcance: 8, rng });

// (o total das que "não se aplicam" não fica amarrado: os lotes seguintes — o mercenário, as joias na árvore — o baixam; dono, 15/10: "Ajustar a linha")
test('a ÁRVORE: as 8 linhas com efeito (sobram no máximo 53 que não se aplicam: luz e visão, velocidade e ângulo do projétil…)', { skip: SEM }, () => {
  const linhas = P.arvore().nos.flatMap((n) => [n, ...(n.opcoes ?? [])].flatMap((o) => (o.textos ?? []).map((t, i) => ({ t, estado: o.estados?.[i], nota: o.notas?.[i] ?? '' }))));
  const re = /cadáveres Criados por você Recentemente|Alcance do Ricochete|Barragens de Projéteis|Ricochetear ao colidirem|Retornarem a você|direções aleatórias|local anterior que foram/;
  const estas = linhas.filter((l) => l.estado !== 'nota' && re.test(l.t));
  assert.ok(estas.length >= 8, String(estas.length));
  for (const l of estas) assert.ok(['novo', 'aproximado', 'equivalente'].includes(l.estado) && !/^não se aplica/.test(l.nota), `${l.estado}: ${l.t}`);
  const naoSeAplica = linhas.filter((l) => /^não se aplica ao jogo/.test(l.nota)).length;
  assert.ok(naoSeAplica <= 53, `${naoSeAplica} não se aplicam (eram 61 antes do lote; 53 depois)`);
});

test('o PACTO CADAVÉRICO: os inimigos a até 3 casas de um cadáver que você criou nos últimos 4 s ficam Resfriados (10%) e Eletrizados (15%)', { skip: SEM }, () => {
  const e = personagem({ pacto_cadaverico: 1 });
  const h = e.hunt;
  const [perto, longe, ...outros] = h.monstros;
  for (const o of outros) Object.assign(o, { x: h.pos.x + 60, y: h.pos.y + 60 });
  h.cadaveres = [];
  Acoes.criarCadaveres(e, h, 'Unearth', 20, { x: h.pos.x + 5, y: h.pos.y }, () => 0);
  Object.assign(perto, { x: h.pos.x + 7, y: h.pos.y, hp: 1e9, maxHp: 1e9, estados: {} });
  Object.assign(longe, { x: h.pos.x + 9, y: h.pos.y, hp: 1e9, maxHp: 1e9, estados: {} });
  const t0 = h.clock;
  ModsPoe.aurasProximas(e, h, ficha(e), t0 + 100);
  assert.equal(perto.estados.chocado?.pct, 15);
  assert.ok(perto.estados.lento?.pct >= 10);
  assert.equal(longe.estados.chocado, undefined, 'a 4 casas do cadáver, não');
  // (passados os 4 s, o cadáver não é mais "Recente")
  perto.estados = {};
  ModsPoe.aurasProximas(e, h, ficha(e), t0 + 4100);
  assert.equal(perto.estados.chocado, undefined);
  // (o morto da caçada não conta: não foi "Criado")
  h.cadaveres = [{ key: 'rat', nome: 'Rato', x: perto.x, y: perto.y }];
  ModsPoe.aurasProximas(e, h, ficha(e), t0 + 4200);
  assert.equal(perto.estados.chocado, undefined);
});

test('o ALCANCE DO RICOCHETE: a distância do salto × o aumento (a fração como chance) — na cadeia do projétil e na da magia', () => {
  assert.equal(Acoes.alcanceDoRicochete(4, { alcanceRicochetePct: 30 }, () => 0.99), 5);
  assert.equal(Acoes.alcanceDoRicochete(4, { alcanceRicochetePct: 30 }, () => 0), 6, '5,2: a fração 0,2 é a chance de mais uma casa');
  assert.equal(Acoes.alcanceDoRicochete(4, null), 4);
  const campo = [b(1, 0, 'a'), b(6, 0, 'b')];
  assert.equal(resolver({ encadear: 1 }, campo).golpes.filter((g) => g.tipo === 'encadeamento').length, 0, '5 casas: longe demais');
  assert.equal(resolver({ encadear: 1, alcanceRicochetePct: 30 }, campo, campo[0], () => 0.99).golpes.filter((g) => g.tipo === 'encadeamento').length, 1);
});

test('"RETORNAREM a você" e "RICOCHETEAR ao colidirem com o terreno": por projétil, pela chance', () => {
  const campo = [b(2, 0, 'a'), b(3, 1, 'b')];
  assert.ok(resolver({ retornarChance: 100 }, campo).golpes.some((g) => g.tipo === 'retorno'));
  assert.ok(!resolver({ retornarChance: 0 }, campo).golpes.some((g) => g.tipo === 'retorno'));
  assert.equal(resolver({ ricocheteTerrenoChance: 100 }, campo).golpes.filter((g) => g.tipo === 'encadeamento').length, 1, 'um ricochete a mais');
  assert.equal(resolver({}, campo).golpes.filter((g) => g.tipo === 'encadeamento').length, 0);
});

test('"DIREÇÕES ALEATÓRIAS" (os extras em bichos sorteados) e "BARRAGENS NÃO SE PROPAGAM" (a sequência toda no alvo)', () => {
  const campo = [b(1, 0, 'alvo'), b(2, 0, 'perto'), b(7, 0, 'longe')];
  const normal = resolver({ alvosExtras: 1 }, campo);
  assert.deepEqual(normal.golpes.filter((g) => g.tipo === 'projetil').map((g) => g.bicho.uid), ['perto'], 'o mais perto');
  const aleatorio = resolver({ alvosExtras: 1, direcoesAleatorias: true }, campo, campo[0], () => 0.99);
  assert.deepEqual(aleatorio.golpes.filter((g) => g.tipo === 'projetil').map((g) => g.bicho.uid), ['longe'], 'o sorteado');
  const barragem = resolver({ alvosExtras: 3, sequencia: true }, campo);
  assert.ok(barragem.golpes.some((g) => g.tipo === 'projetil' && g.bicho.uid !== 'alvo'), 'sem a linha, a barragem vai nos outros');
  const semPropagar = resolver({ alvosExtras: 3, sequencia: true, semPropagar: true }, campo);
  const projeteis = semPropagar.golpes.filter((g) => g.tipo === 'projetil');
  assert.equal(projeteis.length, 3);
  assert.ok(projeteis.every((g) => g.bicho.uid === 'alvo'));
});

test('"HABILIDADES DE GOLPE também miram no local anterior": a gema de Golpear pega mais um inimigo perto', { skip: SEM }, () => {
  const com = personagem({ golpe_local_anterior: 1 }, ['Heavy_Strike']);
  const sem = personagem({}, ['Heavy_Strike']);
  const entry = Acoes.POR_ID_PUBLICO(G.doSlug('Heavy_Strike').acao);
  const extras = (e) => Acoes.comOsAlvosDaGema(entry, GS.efeitoNaSkill(e, entry.id), e).alvosExtras ?? 0;
  assert.equal(extras(com) - extras(sem), 1);
});
