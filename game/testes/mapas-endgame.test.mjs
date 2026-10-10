// Os MAPAS do endgame do PoE (T1–T16, dono 10/10): a peça (tiers, níveis e ids fixos), a progressão dos drops (Tn → Tn ou Tn+1, o T16 se
// sustenta, o chefe do Ato 10 garante o T1), o Dispositivo de Mapas (liberado depois do Ato 10, tudo ou nada, sem consumo em dobro), a
// instância (isolada, com os efeitos dos afixos nos monstros e em você), os 6 portais, a conclusão, a persistência e a party.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';

const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no jogo oficial (PoE)';
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Campanha = await import('../systems/campanha.mjs');
const Dispositivo = await import('../systems/mapas-dispositivo.mjs');
const Mapas = await import('../systems/itens-poe/mapas.mjs');
const MapasAreas = await import('../systems/itens-poe/mapas-areas.mjs');
const MapaAberto = await import('../systems/itens-poe/mapa-aberto.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const Instancia = await import('../systems/hunt/instancia.mjs');
const Bolsa = await import('../systems/bolsa.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Estados = await import('../systems/skills/estados.mjs');
const { vitoriaNoBoss } = await import('../systems/hunt/combate.mjs');
const { BESTIARY } = await import('../systems/hunt/monstros.mjs');
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');

/** Um rng que devolve a sequência dada (e repete o último). */
const sequencia = (...v) => {
  let i = 0;
  return () => v[Math.min(i++, v.length - 1)];
};

/**
 * Um personagem com a campanha do PoE vencida até o Ato `ate` (o Ato 10 libera o dispositivo), com vida que não acaba e um Machado Vaal
 * (o de sempre dos testes que caçam no PoE: desarmado, o golpe dele não passa da armadura dos monstros de mapa).
 */
function personagem({ ate = 10 } = {}) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 90 });
  e.equipment = { ...(e.equipment ?? {}), weapon: Jogo.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Two_Hand_Axes/Vaal_Axe', raridade: 'normal', ilvl: 64, rng: () => 0.5 })) };
  e.hp = e.maxHp = 1e9;
  for (const d of Object.keys(e.campanha)) e.campanha[d].bosses = Array.from({ length: ate }, (_, i) => i + 1);
  Bolsa.garantir(e);
  return e;
}

/**
 * Um mapa do tier com EXATAMENTE os mods dados: `[[familia, /texto/?, [valores]]]` (o grupo da página do tier, com o modelo de texto dele).
 */
function mapaCom(tier, mods = [], raridade = mods.length ? 'raro' : 'normal') {
  const p = Jogo.mapaSorteado(tier, { raridade });
  const pool = Mapas.bases().find((b) => b.atributos.tier === tier).pool;
  const pagina = Mapas.DADOS.classe.paginas[pool];
  const escolhidos = mods.map(([familia, re, valores = []]) => {
    const g = [...pagina.prefixos, ...pagina.sufixos].find((x) => x.familia === familia && (!re || re.test(x.tiers[0].texto)));
    assert.ok(g, `o mod ${familia} existe no tier ${tier}`);
    const t = g.tiers[0];
    return { lado: g.lado, m: { familia, tier: 1, nome: t.nome, ilvl: 1, modelo: t.modelo, texto: t.modelo.replace(/\{(\d+)\}/g, (_, k) => String(valores[k])), valores } };
  });
  p.poe.prefixos = escolhidos.filter((x) => x.lado === 'prefixo').map((x) => x.m);
  p.poe.sufixos = escolhidos.filter((x) => x.lado === 'sufixo').map((x) => x.m);
  p.poe.mapa = Mapas.resumo({ poe: p.poe });
  return p;
}

/** Põe a peça na mochila e abre pelo dispositivo, como a tela faz (a assinatura que a tela mostrou). */
function abrir(e, peca) {
  e.inventory.push(peca);
  const m = Dispositivo.mapasCarregados(e).find((x) => x.peca === peca);
  return Dispositivo.abrir(e, { onde: m.onde, indice: m.indice, assinatura: m.assinatura, mode: 'auto' });
}
const todos = (e) => [...e.hunt.monstros, ...Object.values(e.hunt.outrosAndares ?? {}).flat()];
const vivos = (e) => todos(e).filter((m) => m.hp > 0);
/** Anda a caçada `n` tiques de 250 ms. */
function andar(e, n, relogio) {
  for (let i = 0; i < n && e.hunt; i++) Cacadas.tique(e, PERSONAGEM, (relogio.agora += 250));
}

test('tiers: T1 = nível 68 … T16 = nível 83, ids fixos (7.700.000 + tier) no catálogo, nada fora de T1–T16', { skip: SEM }, () => {
  assert.equal(Mapas.TIER_MAXIMO, 16);
  for (let t = 1; t <= 16; t++) {
    assert.equal(Mapas.nivelDoTier(t), 67 + t, `T${t}`);
    assert.equal(Mapas.idDoTier(t), 7_700_000 + t);
    assert.equal(Mapas.baseDoTier(t), `Maps/Map_Tier_${t}`);
    assert.ok(ITEM_CATALOG[7_700_000 + t], `o item do T${t} está no catálogo`);
    assert.ok(MapasAreas.huntIdDoTier(t), `a área do T${t}`);
    assert.ok(MapasAreas.comunsDoTier(t).length > 0 && MapasAreas.chefeDoTier(t), `os monstros e o chefe do T${t}`);
  }
  for (const t of [0, 17, -1, 'x', null]) {
    assert.equal(Mapas.nivelDoTier(t), null);
    assert.equal(Mapas.baseDoTier(t), null);
    assert.equal(Jogo.mapaSorteado(t), null, `nenhum mapa de tier ${t}`);
  }
  // Os monstros ficam no nível do mapa (a chave do bestiário leva o nível): o T16 é bem mais forte que o T1.
  assert.match(MapasAreas.chefeDoTier(16), /-83$/);
  assert.ok(BESTIARY[MapasAreas.comunsDoTier(16)[0]].hp > BESTIARY[MapasAreas.comunsDoTier(1)[0]].hp);
});

test('drops: o comum só dá o tier da área; magia/raro/chefe podem subir um; T15 → T16; o T16 só dá T16; fora de mapa, nada', { skip: SEM }, () => {
  for (let t = 1; t <= 16; t++) {
    for (let i = 0; i < 20; i++) assert.equal(Mapas.tierDoDrop(t, 'normal', Math.random), t, 'o comum nunca sobe');
    assert.equal(Mapas.tierDoDrop(t, 'boss', () => 0), Math.min(16, t + 1), 'o chefe pode subir um');
    assert.equal(Mapas.tierDoDrop(t, 'boss', () => 0.99), t);
    for (const tipo of ['modificado', 'raro', 'unico', 'boss']) for (let i = 0; i < 20; i++) assert.ok([t, Math.min(16, t + 1)].includes(Mapas.tierDoDrop(t, tipo, Math.random)));
  }
  assert.equal(Mapas.tierDoDrop(15, 'raro', () => 0), 16);
  for (let i = 0; i < 50; i++) assert.equal(Mapas.tierDoDrop(16, 'boss', Math.random), 16);
  // O chefe do mapa GARANTE (a progressão não depende só da sorte) — e nunca um tier inválido.
  for (let i = 0; i < 50; i++) {
    const d = Mapas.sortearDrops({ tierDaArea: 16, tipo: 'unico', chefeDoMapa: true });
    assert.ok(d.length >= 1 && d.every(({ tier }) => tier === 16));
  }
  assert.deepEqual(Mapas.sortearDrops({ tierDaArea: null, tipo: 'raro', rng: () => 0 }), [], 'fora de um mapa não cai mapa');
  // O comum: chanceBase; o raro: × (1 + o bônus de quantidade); a Quantidade de Itens do mapa multiplica.
  const base = Mapas.DROP.chanceBase;
  assert.equal(Mapas.sortearDrops({ tierDaArea: 3, rng: sequencia(base * 0.99) }).length, 1);
  assert.equal(Mapas.sortearDrops({ tierDaArea: 3, rng: sequencia(base * 1.01) }).length, 0);
  assert.equal(Mapas.sortearDrops({ tierDaArea: 3, quantidadePct: 100, rng: sequencia(base * 1.9) }).length, 1, '+100% de quantidade dobra a chance');
});

test('o chefe do Ato 10 garante o T1: Mágico na primeira vitória, Normal nas outras — e cada um da party leva o seu', { skip: SEM }, () => {
  assert.deepEqual(Mapas.mapaDoChefeDoAto(10, { primeiraVitoria: true }), { tier: 1, raridade: 'magico' });
  assert.deepEqual(Mapas.mapaDoChefeDoAto(10, { primeiraVitoria: false }), { tier: 1, raridade: 'normal' });
  assert.equal(Mapas.mapaDoChefeDoAto(9, { primeiraVitoria: true }), null);
  const e = personagem({ ate: 9 });
  const mapasDaSacola = () => e.rewards.flatMap((s) => s.itens).filter((p) => Mapas.ehMapa(p));
  const alvo = () => ({ key: 'demon', name: 'Kitava', loot: [], uid: 1, hp: 0, maxHp: 1 });
  const sala = () => ({ huntId: 'x', isBoss: true, bossId: null, campanha: { bossDoAto: 10, dificuldade: 'facil', ato: 10 }, monstros: [], clock: 0 });
  vitoriaNoBoss(e, sala(), alvo(), PERSONAGEM);
  assert.equal(mapasDaSacola().length, 1, 'um mapa na sacola do chefe');
  assert.equal(Mapas.tierDaBase(mapasDaSacola()[0].poe.base), 1);
  assert.equal(mapasDaSacola()[0].poe.raridade, 'magico', 'a primeira vitória: o T1 mágico');
  assert.ok(e.campanha.facil.bosses.includes(10), 'a vitória foi registrada');
  vitoriaNoBoss(e, sala(), alvo(), PERSONAGEM);
  assert.equal(mapasDaSacola().length, 2);
  assert.equal(mapasDaSacola()[1].poe.raridade, 'normal', 'as outras vitórias: o T1 normal');
  // Outro chefe de ato não dá mapa.
  const antes = mapasDaSacola().length;
  vitoriaNoBoss(e, { ...sala(), campanha: { bossDoAto: 9, dificuldade: 'facil', ato: 9 } }, alvo(), PERSONAGEM);
  assert.equal(mapasDaSacola().length, antes);
});

test('dispositivo: fechado antes do Ato 10; a peça errada, a trocada de lugar ou o tier inválido não abrem nem gastam nada', { skip: SEM }, () => {
  const fechado = personagem({ ate: 9 });
  const peca = Jogo.mapaSorteado(1, { raridade: 'normal' });
  assert.equal(Dispositivo.liberado(fechado), false);
  assert.match(abrir(fechado, peca).erro, /Ato 10/);
  assert.equal(fechado.hunt ?? null, null);
  assert.ok(fechado.inventory.includes(peca), 'a peça continua com ele');
  assert.equal(Dispositivo.paraTela(fechado).liberado, false);

  const e = personagem();
  assert.equal(Dispositivo.liberado(e), true);
  const mapa = Jogo.mapaSorteado(2, { raridade: 'magico' });
  e.inventory.push(mapa);
  const naTela = Dispositivo.mapasCarregados(e).find((m) => m.peca === mapa);
  const inventario = [...e.inventory];
  for (const pedido of [
    { onde: naTela.onde, indice: naTela.indice, assinatura: 'outra' },
    { onde: naTela.onde, indice: naTela.indice },
    { onde: 'depot', indice: naTela.indice, assinatura: naTela.assinatura },
    { onde: naTela.onde, indice: 0, assinatura: naTela.assinatura },
    { onde: naTela.onde, indice: 999, assinatura: naTela.assinatura },
  ]) {
    const r = Dispositivo.abrir(e, pedido);
    assert.equal(r.ok, false, JSON.stringify(pedido));
    assert.deepEqual(e.inventory, inventario, 'nada saiu da mochila');
    assert.equal(e.mapas?.aberto ?? null, null, 'nenhum mapa aberto');
    assert.equal(e.hunt ?? null, null);
  }
  // Um mapa de tier que não existe (a peça de uma base fora de T1–T16).
  const estranho = structuredClone(mapa);
  estranho.poe.base = 'Maps/Map_Tier_99';
  e.inventory.push(estranho);
  const s = Dispositivo.mapasCarregados(e).find((m) => m.peca === estranho);
  assert.equal(Dispositivo.abrir(e, { onde: s.onde, indice: s.indice, assinatura: s.assinatura }).ok, false);
  assert.ok(e.inventory.includes(estranho));
});

test('abrir consome a peça só depois de a instância nascer; com um mapa aberto não se abre outro (nem a mesma peça duas vezes)', { skip: SEM }, () => {
  const e = personagem();
  const peca = mapaCom(4, [['MapMonsterLife', null, [40]]]);
  const outro = Jogo.mapaSorteado(4, { raridade: 'normal' });
  e.inventory.push(outro);
  const antes = e.inventory.length;
  const r = abrir(e, peca);
  assert.ok(r.ok, r.erro);
  assert.equal(e.inventory.length, antes, 'a peça aberta saiu (a outra ficou)');
  assert.ok(!e.inventory.includes(peca) && e.inventory.includes(outro));
  assert.equal(e.hunt.huntId, MapasAreas.huntIdDoTier(4));
  assert.equal(e.hunt.mapa.id, e.mapas.aberto.id);
  assert.equal(e.hunt.mapa.tier, 4);
  assert.equal(e.mapas.aberto.portais, 6);
  assert.equal(e.hunt.instancia.status, 'ativa');
  assert.equal(e.hunt.instancia.objetivos.total, todos(e).length, 'todo monstro é objetivo da limpeza');
  // De novo (o clique duplo, o pedido repetido): recusado, nada sai.
  const m = Dispositivo.mapasCarregados(e).find((x) => x.peca === outro);
  const id = e.mapas.aberto.id;
  assert.match(Dispositivo.abrir(e, { onde: m.onde, indice: m.indice, assinatura: m.assinatura }).erro, /já tem um mapa aberto/);
  assert.ok(e.inventory.includes(outro));
  assert.equal(e.mapas.aberto.id, id);
  // A hunt do mapa não se alcança por `startHunt` (sem a peça).
  const intruso = personagem();
  assert.match(Cacadas.entrar(intruso, { huntId: MapasAreas.huntIdDoTier(4), mode: 'auto' }).erro, /Dispositivo de Mapas/);
});

test('a instância é de quem abriu: dois personagens no mesmo tier têm instâncias e monstros separados', { skip: SEM }, () => {
  const a = personagem();
  const b = personagem();
  assert.ok(abrir(a, Jogo.mapaSorteado(5, { raridade: 'normal' })).ok);
  assert.ok(abrir(b, Jogo.mapaSorteado(5, { raridade: 'normal' })).ok);
  assert.notEqual(a.hunt.instancia.id, b.hunt.instancia.id);
  assert.notEqual(a.hunt.monstros, b.hunt.monstros);
  const uidsA = new Set(todos(a).map((m) => m.uid));
  assert.ok(!todos(b).some((m) => uidsA.has(m.uid)), 'nenhum monstro em comum');
  for (const m of todos(a)) m.hp = 0;
  assert.ok(vivos(b).length > 0, 'matar no mapa de um não mexe no do outro');
});

test('os afixos agem: vida e escudo dos monstros, dano extra, imunidade a atordoamento, resistências, chefe, e em você', { skip: SEM }, () => {
  const e = personagem();
  const peca = mapaCom(11, [
    ['MapMonsterLife', null, [40]],
    ['MapMonsterCannotBeStunned', null, [25]],
    ['MapMonsterFireDamage', null, [100]],
    ['MapMonstersAllResistances', null, [25, 40]],
    ['MapMassiveBoss', null, [35, 70]],
    ['MapPlayerMaxResists', null, [-10]],
    ['MapPlayerVulnerability'],
  ]);
  for (const l of peca.poe.mapa.linhas) assert.notEqual(l.estado, 'inerte', l.texto);
  const semMapa = Afixos.soma(e);
  assert.ok(abrir(e, peca).ok);
  const comuns = todos(e).filter((m) => !m.chefeDoMapa && (m.raridade ?? 'normal') === 'normal' && !m.mods?.length);
  assert.ok(comuns.length > 0);
  for (const m of comuns) {
    // 40% mais vida × 25% mais vida (o "não podem ser Atordoados" traz a vida dele): dois "mais" do PoE MULTIPLICAM (×1,75, não ×1,65),
    // sobre a vida do bestiário no nível do mapa.
    assert.equal(m.maxHp, Math.round(BESTIARY[m.key].hp * 1.75), m.key);
    assert.equal(m.imuneAtordoamento, true);
    assert.deepEqual(m.danoExtraPct, { fire: 100 });
    assert.equal(m.resist.chaos, 25);
    assert.equal(m.resist.fire, 40);
  }
  assert.equal(Estados.atordoar(comuns[0], 2000, 0), false, 'não atordoa');
  const chefe = todos(e).find((m) => m.chefeDoMapa);
  assert.ok(chefe, 'o chefe do mapa nasceu');
  assert.equal(chefe.raridade, 'unico');
  assert.equal(chefe.maxHp, Math.round(Math.round(BESTIARY[chefe.key].hp * 1.75) * 1.35), 'o chefe: os efeitos dos monstros e os dele (a "Vida aumentada" do chefe)');
  assert.equal(peca.poe.mapa.efeitos.monstros.vidaPct, 75, 'o resumo: os dois "mais" multiplicados');
  // Em você: o máximo de resistência e a Vulnerabilidade (só enquanto está no mapa).
  const noMapa = Afixos.soma(e);
  assert.equal(Ficha.maximoDaResistencia(noMapa, 'fire'), Ficha.maximoDaResistencia(semMapa, 'fire') - 10);
  assert.equal(Ficha.maximoDaResistencia(noMapa, 'chaos'), Ficha.maximoDaResistencia(semMapa, 'chaos') - 10);
  assert.equal((noMapa.dano_physical_recebido_inc ?? 0) - (semMapa.dano_physical_recebido_inc ?? 0), 20, 'Vulnerabilidade');
  Cacadas.sair(e);
  assert.deepEqual(Afixos.soma(e), semMapa, 'fora do mapa, nada');
});

test('as maldições do mapa são as do texto (Fraqueza Elemental, Vulnerabilidade, Debilitar); Grilhões Temporais não sorteia', { skip: SEM }, () => {
  const casos = [[/Fraqueza Elemental/, 'fraquezaElemental'], [/Vulnerabilidade/, 'vulnerabilidade'], [/Debilitar/, 'enfraquecer']];
  for (const [re, id] of casos) assert.deepEqual(mapaCom(8, [['MapPlayerCurse', re]]).poe.mapa.efeitos.maldicoes, [id], String(re));
  const todosOsTextos = Object.values(Mapas.DADOS.classe.paginas).flatMap((p) => [...p.prefixos, ...p.sufixos]).map((g) => g.tiers[0].texto);
  assert.ok(!todosOsTextos.some((t) => /Grilhões Temporais/.test(t)), 'fora do pool');
  assert.ok(Mapas.DADOS.naoImplementados.some((n) => /Grilhões Temporais/.test(n.texto)), 'listado como não implementado, com o motivo');
});

test('o mapa muda a área: mais Raros, tamanho do grupo e dois chefes', { skip: SEM }, () => {
  const f = Mapas.fatoresDaInstancia(mapaCom(12, [['MapNemesisModOnRares', null, [30]], ['MapTwoBosses']]).poe.mapa);
  assert.equal(f.chefes, 2);
  assert.equal(f.chancesDaRaridade.raro, 1.3);
  assert.equal(f.fatorDoGrupo, 1 + (5 + 7) / 100, 'o tamanho do grupo dos dois mods');
  const e = personagem();
  assert.ok(abrir(e, mapaCom(12, [['MapTwoBosses']])).ok);
  assert.equal(todos(e).filter((m) => m.chefeDoMapa).length, 2, 'dois chefes');
});

test('6 portais: cada morte gasta um e guarda o mapa como ficou (o chefe se cura); no sexto, o mapa se perde', { skip: SEM }, () => {
  const e = personagem();
  assert.ok(abrir(e, Jogo.mapaSorteado(3, { raridade: 'normal' })).ok);
  const total = e.hunt.instancia.objetivos.total;
  const idDaInstancia = e.hunt.instancia.id;
  vivos(e).slice(0, 4).forEach((m) => (m.hp = 0));
  const limpeza = Instancia.progresso(e.hunt).percentual;
  assert.ok(limpeza > 0);
  const chefe = todos(e).find((m) => m.chefeDoMapa);
  chefe.hp = 10;
  const restam = vivos(e).length;
  for (let morte = 1; morte <= 5; morte++) {
    const r = MapaAberto.guardarAoSair(e, { morreu: true });
    e.hunt = null;
    assert.deepEqual(r, { portais: 6 - morte, falhou: false });
    assert.ok(Dispositivo.voltar(e, { mode: 'auto' }).ok);
    assert.equal(vivos(e).length, restam, 'os mesmos monstros vivos');
    assert.equal(e.hunt.instancia.objetivos.total, total);
    assert.equal(e.hunt.instancia.id, idDaInstancia, 'a mesma instância');
    assert.equal(Instancia.progresso(e.hunt).percentual, limpeza, 'o progresso da limpeza continua');
    assert.equal(todos(e).find((m) => m.chefeDoMapa).hp, todos(e).find((m) => m.chefeDoMapa).maxHp, 'o chefe se curou');
  }
  const r = MapaAberto.guardarAoSair(e, { morreu: true });
  assert.deepEqual(r, { portais: 0, falhou: true });
  assert.equal(e.mapas.aberto, null);
  assert.equal(e.mapas.falhos, 1);
  assert.equal(e.mapas.ultimo.resultado, 'falhou');
  assert.match(Dispositivo.voltar(e, {}).erro, /não tem um mapa aberto/);
});

test('sair (parar, outra caçada) não gasta portal e volta de onde parou — inclusive depois de gravar e ler o personagem', { skip: SEM }, () => {
  const e = personagem();
  assert.ok(abrir(e, Jogo.mapaSorteado(6, { raridade: 'normal' })).ok);
  vivos(e).slice(0, 6).forEach((m) => (m.hp = 0));
  const restam = vivos(e).length;
  Cacadas.sair(e);
  assert.equal(e.mapas.aberto.portais, 6, 'parar não gasta portal');
  // O personagem vai para o banco e volta (JSON), como no save.
  const lido = JSON.parse(JSON.stringify(e));
  assert.ok(Dispositivo.voltar(lido, { mode: 'auto' }).ok);
  assert.equal(vivos(lido).length, restam);
  assert.ok(vivos(lido).every((m) => m.name && m.look != null), 'os monstros completos de novo (o que a gravação tirou volta do bestiário)');
  assert.equal(lido.mapas.aberto.cacada, null, 'a cópia guardada é usada uma vez só');
  // Outra caçada no meio também guarda.
  const fase = Campanha.FASES[0].huntId;
  assert.ok(Cacadas.entrar(lido, { huntId: fase, mode: 'auto', dificuldade: 'facil' }).ok);
  assert.equal(lido.hunt.huntId, fase);
  assert.ok(lido.mapas.aberto.cacada, 'o mapa ficou guardado');
  assert.equal(lido.mapas.aberto.portais, 6);
});

test('limpar 100% (o chefe junto) conclui o mapa: estatísticas, o chefe garante mapa do tier ou um acima, e volta para a cidade', { skip: SEM }, () => {
  const e = personagem();
  assert.ok(abrir(e, Jogo.mapaSorteado(7, { raridade: 'normal' })).ok);
  const relogio = { agora: Date.now() };
  for (const m of todos(e)) m.hp = 0;
  andar(e, 2, relogio);
  assert.equal(e.hunt.instancia.status, 'limpa');
  assert.match(e.avisoDaHunt ?? '', /Mapa \(Nível 7\) concluído/);
  assert.equal(e.mapas.aberto, null);
  assert.equal(e.mapas.concluidos, 1);
  assert.deepEqual(e.mapas.porTier, { 7: 1 });
  assert.equal(e.mapas.maiorTier, 7);
  assert.equal(e.mapas.ultimo.resultado, 'concluido');
  const caidos = e.pouch.filter((p) => Mapas.ehMapa(p));
  assert.ok(caidos.length >= 1, 'o chefe garante');
  for (const p of caidos) assert.ok([7, 8].includes(Mapas.tierDaBase(p.poe.base)), p.poe.nome);
  // Nenhuma instância nova: depois do aviso, a cidade.
  const id = e.hunt.instancia.id;
  andar(e, 20, relogio);
  if (e.hunt) assert.equal(e.hunt.instancia.id, id);
  andar(e, 60, relogio);
  assert.equal(e.hunt, null, 'voltou para a cidade');
});

test('o mapa concluído não abre outra instância, por mais que o aviso demore', { skip: SEM }, () => {
  const pausa = MapasAreas.CONFIG.pausaAoConcluirMs;
  MapasAreas.CONFIG.pausaAoConcluirMs = 180_000;
  try {
    const e = personagem();
    assert.ok(abrir(e, Jogo.mapaSorteado(2, { raridade: 'normal' })).ok);
    const relogio = { agora: Date.now() };
    const id = e.hunt.instancia.id;
    for (const m of todos(e)) m.hp = 0;
    andar(e, 4 * 120, relogio);
    assert.ok(e.hunt, 'ainda no aviso');
    assert.equal(e.hunt.instancia.id, id, 'a mesma instância (limpa)');
    assert.equal(e.hunt.instancia.viajaEm ?? null, null, 'nenhum portal para outra instância');
    assert.equal(vivos(e).length, 0, 'nenhum monstro novo');
  } finally {
    MapasAreas.CONFIG.pausaAoConcluirMs = pausa;
  }
});

test('party: a caçada que ficou com o mapa sem quem o abriu fecha (o mesmo mapa nunca roda duas vezes)', { skip: SEM }, () => {
  const dono = personagem();
  assert.ok(abrir(dono, Jogo.mapaSorteado(2, { raridade: 'normal' })).ok);
  // A cópia que outro ficaria (a sala passada, quem saiu da party): a caçada com o `mapa` de outro personagem.
  const outro = personagem();
  outro.hunt = { ...dono.hunt, monstros: dono.hunt.monstros.map((m) => ({ ...m })), mapa: structuredClone(dono.hunt.mapa), ultimoTique: Date.now() };
  Cacadas.tique(outro, PERSONAGEM, Date.now() + 250);
  assert.equal(outro.hunt, null);
  assert.match(outro.avisoDaHunt, /de quem o abriu/);
  // O dono segue normalmente.
  Cacadas.tique(dono, PERSONAGEM, Date.now() + 250);
  assert.ok(dono.hunt?.mapa);
});

test('a tela: o dispositivo vai junto com a campanha (mapas carregados com a assinatura, o aberto, as estatísticas)', { skip: SEM }, () => {
  const e = personagem();
  const p = Jogo.mapaSorteado(9, { raridade: 'raro' });
  e.inventory.push(p);
  e.pouch.push(Jogo.mapaSorteado(10, { raridade: 'normal' }));
  const t = Dispositivo.paraTela(e);
  assert.equal(t.liberado, true);
  assert.equal(t.portais, 6);
  assert.equal(t.mapas.length, 2);
  assert.deepEqual(t.mapas.map((m) => [m.tier, m.onde]), [[10, 'pouch'], [9, 'inventory']], 'do tier maior para o menor');
  assert.equal(t.mapas[1].assinatura, Dispositivo.assinatura(p));
  assert.equal(t.tiers.length, 16);
  assert.ok(abrir(e, Jogo.mapaSorteado(1, { raridade: 'normal' })).ok);
  const depois = Dispositivo.paraTela(e);
  assert.ok(depois.aberto?.naCacada);
  assert.equal(depois.aberto.portais, 6);
});

test('offline: a caçada segue até limpar o mapa — concluído offline, ela acaba ali (nada projetado depois)', { skip: SEM }, () => {
  const e = personagem();
  assert.ok(abrir(e, Jogo.mapaSorteado(1, { raridade: 'normal' })).ok);
  // A experiência que o mapa inteiro tem (cada monstro morre uma vez).
  const doMapa = todos(e).reduce((n, m) => n + (m.exp ?? 0), 0);
  // Sobram dois monstros de um golpe: o personagem offline vai até eles e limpa.
  const sobram = vivos(e).slice(0, 2);
  for (const m of todos(e)) if (!sobram.includes(m)) m.hp = 0;
  for (const m of sobram) m.hp = m.maxHp = 1;
  const inicio = Date.now();
  e.hunt.offlineDesde = inicio;
  const xpAntes = e.xp;
  Cacadas.simularAusencia(e, PERSONAGEM, inicio + 3 * 3_600_000);
  assert.equal(e.hunt, null, 'a caçada acabou com o mapa');
  assert.equal(e.mapas.aberto, null);
  assert.equal(e.mapas.concluidos, 1);
  assert.equal(e.mapas.ultimo.resultado, 'concluido');
  // Só o que o mapa tinha (com folga para os bônus de experiência): as 2,5 h depois dos 30 min simulados NÃO viram projeção (que daria
  // ~5× o ritmo medido a mais).
  assert.ok(e.xp - xpAntes <= doMapa * 2, `${e.xp - xpAntes} de experiência (o mapa inteiro vale ${doMapa})`);
});

test('offline: o mapa não se projeta — passados os 30 min simulados, a mesma instância espera a volta', { skip: SEM }, () => {
  const e = personagem();
  assert.ok(abrir(e, Jogo.mapaSorteado(1, { raridade: 'normal' })).ok);
  // Monstros que ele não derruba: o mapa não acaba nos 30 min.
  for (const m of todos(e)) m.hp = m.maxHp = 1e12;
  const id = e.hunt.instancia.id;
  const inicio = Date.now();
  e.hunt.offlineDesde = inicio;
  Cacadas.consolidarAusencia(e, PERSONAGEM, inicio + 3 * 3_600_000);
  assert.ok(e.hunt?.mapa, 'continua no mapa');
  assert.equal(e.hunt.instancia.id, id, 'a mesma instância (nenhuma nova pela projeção)');
  assert.equal(e.hunt.ausencia.base, null, 'sem base de projeção');
  assert.ok(e.hunt.offlineDesde <= inicio + 30 * 60_000 + 1000, 'parou nos 30 min simulados');
  assert.ok(e.mapas.aberto, 'o mapa segue aberto');
});

test('o filtro de loot: o mapa é coletado com qualquer seção ligada (como o frasco) e nunca vai para o NPC; só uma regra da classe Mapas o deixa', { skip: SEM }, () => {
  const e = personagem();
  const normal = Jogo.mapaSorteado(5, { raridade: 'normal' });
  e.settings = { ...(e.settings ?? {}), guardarRaridadePoe: 2, guardarModsPoe: 3, guardarIlvlPoe: 90 };
  assert.equal(Bolsa.ignora(e, normal.id, normal), false, 'o mapa Normal não fica no chão');
  assert.equal(Afixos.decisaoDoLoot(e, normal).acao, 'naoVender');
  // Uma peça de equipar Normal, com as mesmas seções, fica no chão (a regra das seções segue valendo para elas).
  const espada = Jogo.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Two_Hand_Axes/Vaal_Axe', raridade: 'normal', ilvl: 64, rng: () => 0.5 }));
  assert.equal(Bolsa.ignora(e, espada.id, espada), true);
});
