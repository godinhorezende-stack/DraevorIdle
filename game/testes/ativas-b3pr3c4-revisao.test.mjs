// (revisão adversarial dos lotes B3, PR3 e C4 das gemas ativas, 21/10) Os achados confirmados, corrigidos pela regra do PoE (o PoB, o poedb):
//  B3 — a Chuva de Lâminas de Trarthus desliga no clique sem alvo ao alcance, não sai por gatilho, totem ou armadilha, desliga com o slot desmarcado; a Invocar Tormenta
//       Vaal com o raio fixo de 1,6 m do PoB;
//  PR3 — a Explosão Cinética do projétil que erra explode na parede; o teto das explosões conta explosões; a 1ª forma da Lança Gélida atravessa;
//  C4 — a magia sem acerto não é bloqueada nem dispara os efeitos "no acerto"; a afecção do acerto do totem não conta a maldição duas vezes; o dano sofrido do atacante
//       no pulso; a Regeneração reduzida em todo Tolhimento seu; vale a instância mais forte do Tolhimento inteira;
//  o merge — o Pacto de Beidat só gasta quando fortalece; a Praga espalhada pelo Contágio leva as camadas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
const Acoes = await import('../systems/acoes.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const G = await import('../systems/itens-poe/gemas-poe.mjs');
const C4 = await import('../systems/itens-poe/gemas-c4.mjs');
const Dot = await import('../systems/combate/dot.mjs');
const AfeccoesPoe = await import('../systems/itens-poe/afeccoes.mjs');
const ModsPoe = await import('../systems/itens-poe/condicoes-poe.mjs');
const Estados = await import('../systems/skills/estados.mjs');
const Secundarios = await import('../systems/skills/golpes-secundarios.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');

let J;
let gerarPeca;
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
const perto = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

/** Roda `fn` com o `Math.random` travado em `v`. */
function travado(v, fn) {
  const antes = Math.random;
  Math.random = () => v;
  try { return fn(); } finally { Math.random = antes; }
}
/** O personagem com a gema na arma, numa caçada; o alvo imortal a `dx` casas (sem resistências) e os outros longe. */
async function montar(slug, { nivel = 20, qualidade = 0, arma = 'Wands/Driftwood_Wand', dx = 1 } = {}) {
  J ??= await import('../systems/itens-poe/jogo.mjs');
  gerarPeca ??= (await import('../systems/itens-poe/gerar.mjs')).gerarPeca;
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Scion', sistema: 'poe' });
  const a = peca(arma);
  a.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
  e.equipment = { ...e.equipment, weapon: a };
  delete e.equipment.shield;
  e.inventory = [GS.itemDaGema({ id: G.doSlug(slug).itemId, nivel, xp: 0, raridade: 'comum', qualidade })];
  GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: G.doSlug(slug).acao, enabled: true, minMana: 0, conditions: [] };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(travado(0.5, () => Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' })).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 1e7;
  e.maxHp = e.hp = 1e7;
  const [b, ...resto] = e.hunt.monstros;
  for (const m of resto) Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60 });
  Object.assign(b, { x: e.hunt.pos.x + dx, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12, estados: {}, resist: {}, dots: [], evasao: 0, armaduraPct: -100 });
  e.hunt.cadaveres = [];
  return { e, b, resto };
}
/** Usa a gema no alvo (com a conjuração concluída), com o sorteio travado. */
function usar(e, b, v = 0.5, opcoes = {}) {
  return travado(v, () => {
    const x = Acoes.disparar(e, e.hunt, PERSONAGEM, 0, b, { manual: true, ...opcoes });
    if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; const fim = Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM); return { ...x, eventos: [...(x.eventos ?? []), ...(Array.isArray(fim) ? fim : fim?.eventos ?? [])] }; }
    return x;
  });
}
const liberar = (e) => { e.hunt.clock += 10_000; e.hunt.cooldowns = {}; };
/** O tique das plantadas (os objetos, os gêiseres, o lote B3) de `ms` em `ms`, até `total`. */
function tiques(e, total, ms = 100, v = 0.5) {
  const ev = [];
  travado(v, () => { for (let t = 0; t < total; t += ms) { e.hunt.clock += ms; ev.push(...Acoes.tiqueDasPlantadas(e, e.hunt, PERSONAGEM, [])); } });
  return ev;
}
const golpesEm = (ev, b) => (ev ?? []).filter((x) => x.t === 'dmg' && x.foe && x.uid === b.uid);

// ---------------------------------------------------------------- B3: a Chuva de Lâminas de Trarthus

test('revisão B3: a Chuva de Lâminas de Trarthus ligada desliga no clique sem ninguém ao alcance (longe, sem alvo, todos mortos)', { skip: SEM }, async () => {
  for (const caso of ['longe', 'sem alvo', 'mortos']) {
    const m = await montar('Bladefall_of_Trarthus', { dx: 1 });
    assert.ok(usar(m.e, m.b).ok);
    assert.ok(m.e.hunt.poeTrarthus, caso);
    liberar(m.e);
    let alvo = m.b;
    if (caso === 'longe') Object.assign(m.b, { x: m.e.hunt.pos.x + 60 });
    if (caso === 'sem alvo') alvo = null;
    if (caso === 'mortos') for (const x of m.e.hunt.monstros) x.hp = 0;
    const off = usar(m.e, alvo);
    assert.ok(off.ok && off.desligou, `${caso}: ${off.motivo}`);
    assert.ok(!m.e.hunt.poeTrarthus, caso);
  }
});

test('revisão B3: a Chuva de Lâminas de Trarthus não sai por gatilho, totem nem armadilha — o PoB: "cannot be triggered or used by Totems, Traps, or Mines"', { skip: SEM }, async () => {
  const m = await montar('Bladefall_of_Trarthus', { dx: 1 });
  const id = m.e.actions[0].id;
  const porGatilho = travado(0.5, () => Acoes.disparar(m.e, m.e.hunt, PERSONAGEM, null, m.b, { gatilho: { acao: { id, enabled: true, minMana: 0, minTargets: 1, conditions: [] }, semCusto: true } }));
  assert.equal(porGatilho.motivo, 'NAO_ATIVAVEL');
  const z = m.e.hunt.z ?? 0;
  for (const tipo of ['totem', 'armadilha', 'mina']) {
    const r = travado(0.5, () => Acoes.disparar(m.e, m.e.hunt, PERSONAGEM, null, m.b, { plantada: { tipo, acao: id, x: m.e.hunt.pos.x, y: m.e.hunt.pos.y, z } }));
    assert.equal(r.motivo, 'NAO_ATIVAVEL', tipo);
  }
  assert.equal(golpesEm([], m.b).length, 0);
  assert.equal(m.b.hp, 1e12, 'nenhum golpe direto');
  assert.ok(!m.e.hunt.poeTrarthus);
  // a sua: liga, e a rajada (o objeto seu) segue acertando
  m.e.maxMana = m.e.mana = 1000;
  liberar(m.e);
  const r = usar(m.e, m.b);
  assert.ok(r.ok, r.erro);
  assert.ok(m.e.hunt.poeTrarthus, JSON.stringify(r));
  assert.equal(golpesEm(tiques(m.e, 1000), m.b).length, 1);
});

test('revisão B3: a Chuva de Lâminas de Trarthus desliga com o slot desmarcado', { skip: SEM }, async () => {
  const m = await montar('Bladefall_of_Trarthus', { dx: 1 });
  m.e.maxMana = m.e.mana = 1000;
  assert.ok(usar(m.e, m.b).ok);
  assert.ok(m.e.hunt.poeTrarthus);
  m.e.actions[0].enabled = false;
  const ev = tiques(m.e, 1000);
  assert.ok(!m.e.hunt.poeTrarthus);
  assert.equal(golpesEm(ev, m.b).length, 0, 'sem rajadas');
  assert.equal(m.e.mana, 1000, 'sem gastar Mana');
});

test('revisão B3: a Invocar Tormenta Vaal — cada golpe no raio fixo de 1,6 m do PoB (radius 16, sem "+raio" nos níveis)', { skip: SEM }, () => {
  for (const [n, q] of [[1, 0], [10, 0], [20, 0], [20, 20]]) assert.equal(G.areaNoNivel('Vaal_Storm_Call', n, q).raioM, 1.6, `nível ${n}, qualidade ${q}`);
  // a Invocar Tormenta comum segue com o "+raio" dela
  assert.ok(G.areaNoNivel('Storm_Call', 20, 0).raioM > 2);
});

// ---------------------------------------------------------------- PR3: a Explosão Cinética e a Lança Gélida

test('revisão PR3: a Explosão Cinética — o projétil que erra e bate no terreno explode na parede, não do outro lado', { skip: SEM }, () => {
  const andavel = new Set();
  for (let x = -10; x <= 10; x++) for (let y = -10; y <= 10; y++) if (x !== 2) andavel.add(`${x},${y}`);
  const atras = { uid: 'atras', x: 6, y: 0, hp: 10 };
  const r = Secundarios.resolver({ efeito: {}, tags: ['projectile', 'hit'], origem: { x: 0, y: 0 }, alvo: null, atingidos: [], vivos: [atras], alcance: 6, rumo: { x: 1, y: 0 }, rng: () => 0.5, andavel, cinetica: { n: 4, pct: 60, raio: 1, raioSec: 1 } });
  const ex = r.explosoes.filter((x) => x.cinetica);
  assert.equal(ex.length, 5);
  for (const x of ex) assert.ok(x.x < 2, `a explosão em (${x.x}, ${x.y}), antes da parede`);
  assert.equal(r.golpes.filter((g) => g.bicho === atras).length, 0, 'o de trás da parede não leva nada');
  // sem terreno no caminho, o fim do voo (a exceção 5 do lote)
  const livre = Secundarios.resolver({ efeito: {}, tags: ['projectile', 'hit'], origem: { x: 0, y: 0 }, alvo: null, atingidos: [], vivos: [atras], alcance: 6, rumo: { x: 1, y: 0 }, rng: () => 0.5, cinetica: { n: 4, pct: 60, raio: 1, raioSec: 1 } });
  assert.equal(livre.golpes.filter((g) => g.bicho === atras).length, 5);
});

test('revisão PR3: o teto das explosões cinéticas do fim do voo começa pelas EXPLOSÕES dos impactos, não pelos golpes', { skip: SEM }, () => {
  // 9 inimigos colados (o quadrado de 3 × 3), 10 projéteis: 9 acertam (5 explosões cada, ~5 golpes por explosão) e 1 erra
  const vivos = [];
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) vivos.push({ uid: `m${dx}${dy}`, x: 3 + dx, y: dy, hp: 10 });
  const alvo = vivos.find((v) => v.x === 3 && v.y === 0);
  const r = Secundarios.resolver({ efeito: { projeteisBase: 10 }, tags: ['projectile', 'hit'], origem: { x: 0, y: 0 }, alvo, atingidos: [alvo], vivos, alcance: 7, rng: () => 0.5, cinetica: { n: 4, pct: 60, raio: 1, raioSec: 1 } });
  assert.equal(r.emitidos.filter((p) => !p.bicho).length, 1);
  assert.ok(r.golpes.filter((g) => g.cinetica).length > 90, 'mais golpes que o teto (90)');
  assert.equal(r.explosoes.filter((x) => x.cinetica).length, 50, '45 dos impactos + 5 do que errou');
  assert.ok(!r.cortado);
});

test('revisão PR3: a Lança Gélida — a 1ª forma atravessa (o PoB: PierceChance 100 na "First Form"); a 2ª, não', { skip: SEM }, () => {
  const daGema = Acoes.comOsAlvosDaGema({ id: 'x', poeGema: { slug: 'Ice_Spear' } }, { nivel: 20, qualidade: 0 });
  assert.equal(daGema.perfuraNaPrimeiraForma, 2);
  assert.equal(daGema.perfurar ?? 0, 0, 'a perfuração dos suportes não muda');
  // (a geometria de um projétil só)
  const efeito = { perfuraNaPrimeiraForma: daGema.perfuraNaPrimeiraForma };
  // o primeiro a 1 casa (1ª forma): atravessa e acerta o de 3 casas (já na 2ª forma)
  const a = { uid: 'a', x: 1, y: 0, hp: 10 };
  const b = { uid: 'b', x: 3, y: 0, hp: 10 };
  const c = { uid: 'c', x: 4, y: 0, hp: 10 };
  const r1 = Secundarios.resolver({ efeito, tags: ['projectile', 'hit'], origem: { x: 0, y: 0 }, alvo: a, atingidos: [a], vivos: [a, b, c], alcance: 7, rng: () => 0.5 });
  assert.deepEqual(r1.golpes.map((g) => [g.bicho.uid, g.tipo]), [['b', 'perfuracao']], 'o de 3 casas é a 2ª forma: para nele');
  // o primeiro a 3 casas (2ª forma): para nele
  const r2 = Secundarios.resolver({ efeito, tags: ['projectile', 'hit'], origem: { x: 0, y: 0 }, alvo: b, atingidos: [b], vivos: [b, c], alcance: 7, rng: () => 0.5 });
  assert.deepEqual(r2.golpes, []);
  // com um suporte de Perfurar (1): a 2ª forma atravessa um
  const r3 = Secundarios.resolver({ efeito: { ...efeito, perfurar: 1 }, tags: ['projectile', 'hit'], origem: { x: 0, y: 0 }, alvo: a, atingidos: [a], vivos: [a, b, c], alcance: 7, rng: () => 0.5 });
  assert.deepEqual(r3.golpes.map((g) => g.bicho.uid), ['b', 'c'], 'a 1ª forma não gasta a perfuração do suporte');
  // as outras gemas de projétil não ganham
  assert.equal(Acoes.comOsAlvosDaGema({ id: 'y', poeGema: { slug: 'Fireball' } }, { nivel: 20, qualidade: 0 }).perfuraNaPrimeiraForma, undefined);
});

// ---------------------------------------------------------------- C4: a magia sem acerto

test('revisão C4: a magia sem acerto não é bloqueada — a Praga, o Definhar, o Contágio, o Raio Abrasador e a Praga Vaal põem o efeito contra 75% de bloqueio', { skip: SEM }, async () => {
  for (const s of ['Blight', 'Wither', 'Contagion', 'Scorching_Ray', 'Vaal_Blight']) {
    const { e, b } = await montar(s, { arma: 'Staves/Gnarled_Branch', qualidade: 20 });
    b.bloqueio = 75;
    const r = usar(e, b, 0.5);
    assert.ok(r.ok, `${s}: ${r.erro}`);
    assert.deepEqual((r.eventos ?? []).filter((x) => x.t === 'block'), [], `${s}: sem bloqueio`);
    const posto = (b.dots ?? []).some((d) => d.falta > 0) || !!b.estados?.tolhido || !!b.estados?.definhado;
    assert.ok(posto, `${s}: o efeito entrou`);
    if (s === 'Vaal_Blight') assert.equal((b.dots ?? []).find((d) => d.chave === 'Vaal_Blight')?.camadas?.length, 3);
  }
});

test('revisão C4: a magia sem acerto não dispara os efeitos "no acerto" — o Empalamento guardado fica inteiro', { skip: SEM }, async () => {
  for (const s of ['Blight', 'Wither', 'Vaal_Blight']) {
    const { e, b } = await montar(s, { arma: 'Staves/Gnarled_Branch', qualidade: 20 });
    b.estados.empalado = [{ valor: 1000, acertos: 5, ate: e.hunt.clock + 60_000 }];
    const r = usar(e, b, 0.5);
    assert.ok(r.ok, s);
    assert.equal(b.estados.empalado[0].acertos, 5, `${s}: o Empalamento não gastou`);
    assert.deepEqual((r.eventos ?? []).filter((x) => x.t === 'dmg' && x.uid === b.uid), [], `${s}: nenhum golpe`);
  }
});

// ---------------------------------------------------------------- C4: o pulso do dano contínuo

test('revisão C4: a afecção do ACERTO do totem não conta a maldição de dano sofrido de novo no pulso; o degenerativo da gema conta', { skip: SEM }, () => {
  const m = { uid: 'm', hp: 1000, maxHp: 1000, estados: {}, marcas: { vulneravel: { ate: 10_000, pct: 50, tipos: ['fire'] } } };
  const pulso = (origem) => Dot.recebidoNoPulso(m, { elemento: 'fire', origem }, 5);
  assert.ok(perto(pulso({ fonte: 'gema' }), 1.5));
  assert.ok(perto(pulso({ fonte: 'totem' }), 1.5), 'o degenerativo do totem: a base não traz a maldição');
  assert.equal(pulso({ fonte: 'totem', doAcerto: true }), 1, 'a afecção do acerto do totem: já na base');
  assert.equal(pulso({ fonte: 'poe' }), 1);
  // a afecção posta pelo acerto sai marcada
  const b = { uid: 'b', hp: 1000, maxHp: 1000, estados: {}, dots: [] };
  const a = AfeccoesPoe.daSoma({ chance_ignite: 100 });
  AfeccoesPoe.aoAcertar(b, [{ elemento: 'fire', dano: 1000 }], { afeccoes: a, rng: () => 0, agora: 1, fonte: 'totem' });
  const d = (b.dots ?? []).find((x) => x.tipo === 'queimadura');
  assert.ok(d, 'incendiou');
  assert.equal(d.origem.fonte, 'totem');
  assert.equal(d.origem.doAcerto, true);
});

test('revisão C4: no pulso, o Definhado com o "Efeito do Definhamento aumentado" e os "Inimigos … sofrem Dano aumentado" de quem pôs', { skip: SEM }, () => {
  const m = { uid: 'm', hp: 1000, maxHp: 1000, estados: { definhado: { ate: 10, n: 5 } } };
  // 5 acúmulos × 6%: +30%; com +100% de efeito: +60%
  assert.ok(perto(ModsPoe.fatorRecebidoNoDot(m, 'chaos', 5), 1.3));
  assert.ok(perto(ModsPoe.fatorRecebidoNoDot(m, 'chaos', 5, { efeito_definhamento: 100 }), 1.6));
  // só as chaves de dano SOFRIDO: o "mais" do tipo e as só de acerto ficam de fora
  assert.deepEqual(ModsPoe.sofridoDoAtacante({ efeito_definhamento: 100, dano_por_afeccao_no_alvo: 5, mais_dano_caos: 50, dano_elemental_por_definhamento: 10, life_on_hit: 3 }), { efeito_definhamento: 100, dano_por_afeccao_no_alvo: 5 });
  assert.equal(ModsPoe.sofridoDoAtacante({}), null);
  // o pulso lê a `origem.sofrido`
  assert.ok(perto(Dot.recebidoNoPulso(m, { elemento: 'chaos', origem: { fonte: 'poe', sofrido: { efeito_definhamento: 100 } } }, 5), 1.6));
  // a afecção posta pelo acerto leva o `sofrido`
  const b = { uid: 'b', hp: 1000, maxHp: 1000, estados: {}, dots: [] };
  AfeccoesPoe.aoAcertar(b, [{ elemento: 'fire', dano: 1000 }], { afeccoes: AfeccoesPoe.daSoma({ chance_ignite: 100 }), rng: () => 0, agora: 1, sofrido: { dano_por_afeccao_no_alvo: 5 } });
  assert.deepEqual(b.dots.find((x) => x.tipo === 'queimadura').origem.sofrido, { dano_por_afeccao_no_alvo: 5 });
});

test('revisão C4: a Praga com o "Efeito do Definhamento aumentado" no jogo — o degenerativo leva o `sofrido` de quem pôs', { skip: SEM }, async () => {
  const { e, b } = await montar('Blight', { arma: 'Staves/Gnarled_Branch', qualidade: 20 });
  const ficha = Ficha.combate(e);
  ficha.afPoe = { ...(ficha.afPoe ?? {}), efeito_definhamento: 50 };
  const r = usar(e, b, 0.5);
  assert.ok(r.ok);
  const d = (b.dots ?? []).find((x) => x.chave === 'Blight');
  assert.ok(d);
  assert.deepEqual(d.origem.sofrido, { efeito_definhamento: 50 });
});

// ---------------------------------------------------------------- C4: o Tolhimento

test('revisão C4: vale a instância mais forte do Tolhimento inteira — o % e a duração dela; o fraco segue depois, até o fim dele', { skip: SEM }, () => {
  const m = { hp: 10, estados: {} };
  Estados.tolher(m, 80, 1000, 0);
  Estados.tolher(m, 30, 3000, 500);
  assert.ok(perto(Estados.fatorDeTolhimento(m, 800), 5), 'até 1 s: os 80%');
  assert.ok(perto(Estados.fatorDeTolhimento(m, 2000), 1 / 0.7), 'de 1 s a 3,5 s: os 30%');
  assert.equal(Estados.fatorDeTolhimento(m, 4000), 1);
  assert.equal(m.estados.tolhido.ate, 3500, 'o estado fica ativo até o fim do último');
  // ao contrário: o fraco primeiro, o forte depois — o forte vale até o fim DELE, depois volta o fraco
  const n = { hp: 10, estados: {} };
  Estados.tolher(n, 30, 3000, 0);
  Estados.tolher(n, 80, 1000, 500);
  assert.ok(perto(Estados.fatorDeTolhimento(n, 1000), 5));
  assert.ok(perto(Estados.fatorDeTolhimento(n, 1600), 1 / 0.7));
  assert.equal(Estados.fatorDeTolhimento(n, 3100), 1);
  // o mesmo %: um só, com o fim maior; o mais forte e mais longo cobre o fraco (sai da lista)
  const o = { hp: 10, estados: {} };
  Estados.tolher(o, 30, 1000, 0);
  Estados.tolher(o, 30, 2000, 0);
  assert.deepEqual(o.estados.tolhido, { ate: 2000, pct: 30 });
  Estados.tolher(o, 80, 5000, 100);
  assert.deepEqual(o.estados.tolhido, { ate: 5100, pct: 80 });
  // a lista não cresce sem fim com o Tolhimento repetido
  const p = { hp: 10, estados: {} };
  Estados.tolher(p, 80, 1000, 0);
  for (let t = 0; t < 5000; t += 500) Estados.tolher(p, 30, 4000, t);
  assert.ok((p.estados.tolhido.lista ?? [p.estados.tolhido]).length <= 2);
});

test('revisão C4: "Inimigos Desacelerados por você têm Regeneração de Vida reduzida" vale em todo Tolhimento seu (a Praga, as runas, a Esfera), sem contar duas vezes', { skip: SEM }, () => {
  const regen = (estados) => {
    const m = { uid: 'm', x: 0, y: 0, hp: 500, maxHp: 1000, regen: 10, proximaRegen: 0, estados };
    Estados.tique({ monstros: [m], clock: 0 }, [], 0);
    return m.hp - 500;
  };
  const tolhido = (regenMenosPct) => { const m = { hp: 10, estados: {} }; Estados.tolher(m, 30, 4000, -1, regenMenosPct); return m.estados.tolhido; };
  assert.equal(regen({}), 100);
  assert.equal(regen({ tolhido: tolhido(20) }), 80, 'o Tolhimento com 20% a menos');
  assert.equal(regen({ tolhido: tolhido(0) }), 100, 'sem o mod: nada');
  // o Desacelerar das magias (o `desacelerado`) e o Tolhimento juntos: o maior dos dois
  assert.equal(regen({ tolhido: tolhido(20), desacelerado: { ate: 5000, regenMenosPct: 20 } }), 80);
  // a redução acaba com a instância que a trouxe
  const m = { hp: 10, estados: {} };
  Estados.tolher(m, 30, 1000, 0, 20);
  Estados.tolher(m, 10, 3000, 0);
  assert.equal(Estados.regenMenosDoTolhimento(m, 500), 20);
  assert.equal(Estados.regenMenosDoTolhimento(m, 2000), 0);
});

test('revisão C4: a Praga no jogo leva a Regeneração reduzida de quem Tolheu', { skip: SEM }, async () => {
  const { e, b } = await montar('Blight', { arma: 'Staves/Gnarled_Branch', qualidade: 20 });
  const ficha = Ficha.combate(e);
  ficha.afPoe = { ...(ficha.afPoe ?? {}), desacelerados_regen_red: 20 };
  assert.ok(usar(e, b, 0.5).ok);
  assert.equal(b.estados.tolhido.pct, 80);
  assert.equal(Estados.regenMenosDoTolhimento(b, e.hunt.clock - 1), 20);
});

// ---------------------------------------------------------------- o merge: o Pacto de Beidat e a Praga do Contágio

test('revisão do merge: o Pacto de Beidat não gasta com a Cremação do Vulcão, a Chuva de Lâminas de Trarthus e a Invocar Tormenta Vaal (não as fortalece); com a Bola de Fogo, gasta', { skip: SEM }, async () => {
  const pacto = () => ({ acao: 'x', restantes: 3, maisPct: 35, espiral: 8, feixes: 6, projeteis: 6 });
  for (const s of ['Cremation_of_the_Volcano', 'Bladefall_of_Trarthus', 'Vaal_Storm_Call']) {
    const m = await montar(s, { dx: 2 });
    m.e.hunt.poePacto = pacto();
    const r = usar(m.e, m.b, 0.5);
    assert.ok(r.ok, `${s}: ${r.erro}`);
    assert.equal(m.e.hunt.poePacto?.restantes, 3, s);
  }
  const f = await montar('Fireball', { dx: 2 });
  f.e.hunt.poePacto = pacto();
  assert.ok(usar(f.e, f.b, 0).ok);
  assert.equal(f.e.hunt.poePacto.restantes, 2);
});

test('revisão do merge: a Praga do Contágio espalhada pelo Contágio leva as camadas; a próxima camada no vizinho soma, não apaga o espalhado', { skip: SEM }, () => {
  const pulsoMs = Dot.CONFIG.tipos.degenCaos?.pulsoMs ?? 500;
  const agora = 10_000;
  const de = { uid: 'de', x: 0, y: 0, z: 0, hp: 1000, maxHp: 1000, estados: {}, dots: [] };
  const viz = { uid: 'viz', x: 1, y: 0, z: 0, hp: 1000, maxHp: 1000, estados: {}, dots: [] };
  const hunt = { z: 0, clock: agora, monstros: [de, viz] };
  // o Contágio (marcado para espalhar na morte) e a Praga do Contágio com 4 camadas
  Dot.aplicar(de, { tipo: 'degenCaos', total: 4000, duracaoMs: 4000, chave: 'Contagion', origem: { fonte: 'gema' } }, agora - 1000);
  de.dots[0].contagio = { raio: 3, aoMorrer: true };
  const porPulso = 100;
  for (let k = 0; k < 4; k++) {
    const t = agora - 1000 + k * 250;
    Dot.aplicar(de, { tipo: 'degenCaos', total: porPulso * 6, duracaoMs: 3000, chave: 'Blight_of_Contagion', origem: { fonte: 'gema' } }, t);
    const d = de.dots.find((x) => x.chave === 'Blight_of_Contagion');
    C4.porCamada(d, { ate: t + 3000, max: 6, porPulsoCamada: porPulso, pulsoMs, agora: t });
  }
  const origem = de.dots.find((x) => x.chave === 'Blight_of_Contagion');
  assert.equal(origem.camadas.length, 4);
  Acoes.espalharContagio(hunt, de, agora, { morte: true });
  const d = viz.dots.find((x) => x.chave === 'Blight_of_Contagion');
  assert.ok(d, 'espalhou');
  assert.equal(d.camadas?.length, 4, 'as 4 camadas foram junto');
  assert.equal(d.porPulsoCamada, porPulso);
  const espalhado = d.falta;
  assert.ok(espalhado > 0);
  // a próxima camada canalizada no vizinho: 5 camadas, e o que falta cresce
  Dot.aplicar(viz, { tipo: 'degenCaos', total: porPulso * 6, duracaoMs: 3000, chave: 'Blight_of_Contagion', origem: { fonte: 'gema' } }, agora);
  C4.porCamada(d, { ate: agora + 3000, max: 6, porPulsoCamada: porPulso, pulsoMs, agora });
  assert.equal(d.camadas.length, 5);
  assert.ok(d.falta > espalhado, `${espalhado} → ${d.falta}`);
});

// ---------------------------------------------------------------- as decisões do dono (21/10) depois da revisão

/** O personagem com as gemas ligadas na arma (a 1ª na barra; as outras no grupo), numa caçada — para os grupos de gatilho. */
async function montarGrupo(gemas, { arma = 'Wands/Driftwood_Wand' } = {}) {
  J ??= await import('../systems/itens-poe/jogo.mjs');
  gerarPeca ??= (await import('../systems/itens-poe/gerar.mjs')).gerarPeca;
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Scion', sistema: 'poe' });
  const a = peca(arma);
  const n = gemas.length;
  a.soquetes = { abertos: n, links: Array.from({ length: n - 1 }, () => true), gemas: Array(n).fill(null), cores: Array(n).fill('W') };
  e.equipment = { ...e.equipment, weapon: a };
  delete e.equipment.shield;
  e.inventory = gemas.map((s) => GS.itemDaGema({ id: G.doSlug(s).itemId, nivel: 20, xp: 0, raridade: 'comum', qualidade: 0 }));
  for (let i = 0; i < n; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: G.doSlug(gemas[0]).acao, enabled: true, minMana: 0, conditions: [] };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  return e;
}

test('dono (21/10): a Chuva de Lâminas de Trarthus fora das magias do Feiticeiro e da Automação (não pode ser ativada por gatilho)', { skip: SEM }, async () => {
  const trarthus = G.doSlug('Bladefall_of_Trarthus').acao;
  const fei = GS.gruposComGatilho(await montarGrupo(['Spellslinger', 'Bladefall_of_Trarthus', 'Fireball'])).find((x) => x.feiticeiro);
  assert.ok(fei, 'o grupo do Feiticeiro');
  assert.ok(!fei.magias.includes(trarthus), 'sem a Trarthus');
  assert.ok(fei.magias.includes(G.doSlug('Fireball').acao), 'a Bola de Fogo segue');
  const auto = GS.gruposComGatilho(await montarGrupo(['Automation', 'Bladefall_of_Trarthus', 'Blood_Rage'])).find((x) => x.automacao);
  assert.ok(auto, 'o grupo da Automação');
  assert.deepEqual(auto.magias, [G.doSlug('Blood_Rage').acao]);
});

test('dono (21/10): a Lança Gélida da Divisão — o fragmento (a 1ª forma) atravessa no voo todo; os da divisão (a 2ª forma) não', { skip: SEM }, () => {
  const daGema = Acoes.comOsAlvosDaGema({ id: 'x', poeGema: { slug: 'Ice_Spear_of_Splitting' } }, { nivel: 20, qualidade: 0 });
  assert.equal(daGema.perfuraNaPrimeiraForma, 99);
  // o principal: atravessa o de 1 casa, o de 3 e o de 5 (todos na reta)
  const a = { uid: 'a', x: 1, y: 0, hp: 10 };
  const b = { uid: 'b', x: 3, y: 0, hp: 10 };
  const c = { uid: 'c', x: 5, y: 0, hp: 10 };
  const r = Secundarios.resolver({ efeito: { perfuraNaPrimeiraForma: 99 }, tags: ['projectile', 'hit'], origem: { x: 0, y: 0 }, alvo: a, atingidos: [a], vivos: [a, b, c], alcance: 7, rng: () => 0.5 });
  assert.deepEqual(r.golpes.map((g) => [g.bicho.uid, g.tipo]), [['b', 'perfuracao'], ['c', 'perfuracao']]);
  // com a divisão: o filho que acerta não atravessa (só o principal)
  const d = { uid: 'd', x: 1, y: 3, hp: 10 };
  const e = { uid: 'e', x: 1, y: 5, hp: 10 };
  const s = Secundarios.resolver({ efeito: { perfuraNaPrimeiraForma: 99, divisao: 1 }, tags: ['projectile', 'hit'], origem: { x: 0, y: 0 }, alvo: a, atingidos: [a], vivos: [a, d, e], alcance: 7, rng: () => 0.5 });
  assert.deepEqual(s.golpes.map((g) => [g.bicho.uid, g.tipo]), [['d', 'divisao']], 'o filho para no primeiro');
});

test('dono (21/10): a explosão cinética sorteada só cai em casa andável e com a linha livre até o ponto do impacto', { skip: SEM }, () => {
  // a parede na coluna x = 4; o impacto em (3, 0); o raio secundário 2
  const andavel = new Set();
  for (let x = -10; x <= 10; x++) for (let y = -10; y <= 10; y++) if (x !== 4) andavel.add(`${x},${y}`);
  const alvo = { uid: 'a', x: 3, y: 0, hp: 10 };
  for (const v of [0, 0.2, 0.5, 0.8, 0.999]) {
    const r = Secundarios.resolver({ efeito: {}, tags: ['projectile', 'hit'], origem: { x: 0, y: 0 }, alvo, atingidos: [alvo], vivos: [alvo], alcance: 7, rng: () => v, andavel, cinetica: { n: 6, pct: 60, raio: 0, raioSec: 2 } });
    for (const x of r.explosoes.filter((q) => q.cinetica)) assert.ok(x.x < 4, `sorteio ${v}: a explosão em (${x.x}, ${x.y}) não fica na parede nem atrás dela`);
  }
  // sem o terreno, o sorteio é o de antes (pode cair em x = 5)
  const livre = Secundarios.resolver({ efeito: {}, tags: ['projectile', 'hit'], origem: { x: 0, y: 0 }, alvo, atingidos: [alvo], vivos: [alvo], alcance: 7, rng: () => 0.999, cinetica: { n: 1, pct: 60, raio: 0, raioSec: 2 } });
  assert.ok(livre.explosoes.some((q) => q.cinetica && q.x === 5));
});
