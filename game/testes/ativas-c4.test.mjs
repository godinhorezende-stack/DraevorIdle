// (lote C4, dono 21/10) AS GEMAS ATIVAS DE CORPO A CORPO, IMPACTO E CANALIZAÇÃO — os debuffs canalizados e as afecções específicas (o plano do grupo, as
// recomendações aceitas D4.1 a D4.4): a Praga e as variantes (o Tolhimento — D4.1 — e as camadas — D4.2), o Definhar (o Definhamento e o Tolhimento), o Golpe
// Pestilento (a duração do Veneno e o secundário na morte — D4.3), o Golpe da Víbora da Mamba (um Veneno por ataque, nada em quem já está Envenenado) e o Golpe
// Duplo Vaal (o clone parado — D4.4, limitação do idle). Os números são os do PoE (o PoB, o poedb); os sorteios ficam travados.
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
const Reforcos = await import('../systems/skills/reforcos.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');

let J;
let gerarPeca;
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 60, rng: () => 0.5 }));

/** Roda `fn` com o `Math.random` travado em `v`. */
function travado(v, fn) {
  const antes = Math.random;
  Math.random = () => v;
  try { return fn(); } finally { Math.random = antes; }
}
/** O personagem com a gema na arma, numa caçada; o alvo imortal colado (à direita, sem resistências) e os outros longe. */
async function montar(slug, { nivel = 20, qualidade = 20, arma = 'Staves/Gnarled_Branch' } = {}) {
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
  Object.assign(b, { x: e.hunt.pos.x + 1, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12, estados: {}, resist: {}, evasao: 0, armaduraPct: -100 });
  return { e, b, resto };
}
/** Usa a gema no alvo (com a conjuração concluída), com o sorteio travado; o relógio vai para quando o próximo uso pode sair. */
function usar(e, b, v = 0.5) {
  return travado(v, () => {
    let x = Acoes.disparar(e, e.hunt, PERSONAGEM, 0, b, { manual: true });
    if (e.hunt.conjurando) {
      e.hunt.clock = e.hunt.conjurando.fim;
      const fim = Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM);
      x = { ok: true, eventos: Array.isArray(fim) ? fim : fim?.eventos ?? [] };
    }
    e.hunt.clock = Math.max(e.hunt.clock, e.hunt.cooldowns?.['grupo:poe']?.ate ?? e.hunt.clock);
    return x;
  });
}
const doDot = (b, chave) => (b.dots ?? []).find((d) => d.chave === chave);
/** Os pulsos do dano contínuo `chave` no bicho, de `de` até `ate` (o relógio da caçada), com o dano de cada um (antes da resistência). */
function pulsos(e, b, chave, ate) {
  const saida = [];
  const d = doDot(b, chave);
  while (d && d.falta > 0 && d.proximo <= ate) {
    const antes = d.falta;
    e.hunt.clock = d.proximo;
    Dot.tique(e.hunt, [], e.hunt.clock);
    saida.push(Math.round(antes - d.falta));
  }
  return saida;
}

// ---------------------------------------------------------------- o status e os leitores

test('C4: as gemas do lote saem de parcial (as linhas do PoE têm leitor); a Praga Vaal e o Golpe Duplo Vaal ficam com o motivo do dono', { skip: SEM }, () => {
  for (const s of ['Blight', 'Blight_of_Contagion', 'Blight_of_Atrophy', 'Vaal_Blight', 'Wither', 'Pestilent_Strike', 'Viper_Strike_of_the_Mamba']) {
    const r = G.REGISTRO.get(s);
    assert.deepEqual([s, r.statusNoJogo, r.motivosNoJogo], [s, 'funciona', []]);
  }
  // (D4.4: o clone não anda no jogo — limitação do idle, não um efeito não simulado)
  assert.deepEqual(G.REGISTRO.get('Vaal_Double_Strike').motivosNoJogo, [C4.MOTIVOS_C4.Vaal_Double_Strike[0]]);
  assert.match(C4.MOTIVOS_C4.Vaal_Double_Strike[0], /^limitação do idle: /);
});

test('C4: os números das linhas no nível 20 e na qualidade 20 (os do PoB)', { skip: SEM }, () => {
  assert.deepEqual(G.c4DaGema('Blight', 20, 20).praga, { max: 20, tolhePct: 80, tolheMs: 1000, regenMenosPct: 0, caosSofridoPct: 0, soSemPraga: true });
  assert.deepEqual(G.c4DaGema('Blight_of_Contagion', 20, 20).praga, { max: 6, tolhePct: 80, tolheMs: 1000, regenMenosPct: 0, caosSofridoPct: 0, soSemPraga: true });
  // (a Atrofia: 3 s de Tolhimento + 50 ms por qualidade — base_secondary_skill_effect_duration; a regeneração do Tolhido −80%)
  assert.deepEqual(G.c4DaGema('Blight_of_Atrophy', 20, 20).praga, { max: 20, tolhePct: 80, tolheMs: 4000, regenMenosPct: 80, caosSofridoPct: 0, soSemPraga: true });
  assert.equal(G.c4DaGema('Blight_of_Atrophy', 20, 0).praga.tolheMs, 3000);
  assert.deepEqual(G.c4DaGema('Vaal_Blight', 20, 20).praga, { max: 20, tolhePct: 80, tolheMs: 3000, regenMenosPct: 0, caosSofridoPct: 30, soSemPraga: false, camadasExtras: 2, areaMaisPorCamadaPct: 50 });
  assert.deepEqual(G.c4DaGema('Wither', 20, 0).definhar, { definhadoMs: 2000, tolhePct: 36, tolheMs: 500, caosPorDefinhamentoPct: 6 });
  assert.equal(G.c4DaGema('Wither', 1, 0).definhar.tolhePct, 30);
  // (o Golpe Pestilento: 30% + 1 por qualidade do mesmo active_skill_poison_duration_+%_final; o raio da gema, 2,7 m — D4.3)
  assert.deepEqual(G.c4DaGema('Pestilent_Strike', 20, 20).pestilento, { venenoDuracaoMaisPct: 50, debuffMs: 1000, porSegundoPct: 50, secundarioMs: 1000, raioM: 2.7 });
  assert.deepEqual(G.c4DaGema('Pestilent_Strike', 20, 0).veneno, { venenoUnico: false, naoEnvenenaEnvenenado: false, venenoDuracaoMaisPct: 30 });
  assert.deepEqual(G.c4DaGema('Viper_Strike_of_the_Mamba', 20, 20).veneno, { venenoUnico: true, naoEnvenenaEnvenenado: true, venenoDuracaoMaisPct: 0 });
  assert.equal(G.c4DaGema('Viper_Strike', 20, 20).veneno, null);
  assert.equal(G.c4DaGema('Fireball', 20, 20).praga, null);
});

test('C4: as contas puras — as camadas (cada uma com o seu fim, a mais antiga sai no máximo) e o secundário do Pestilento', { skip: SEM }, () => {
  const d = { proximo: 1500, falta: 0 };
  assert.equal(C4.porCamada(d, { ate: 3000, max: 3, porPulsoCamada: 10, pulsoMs: 500, agora: 1000 }), 1);
  assert.equal(d.falta, 40, 'pulsos em 1500, 2000, 2500 e 3000');
  assert.equal(C4.porCamada(d, { ate: 4000, max: 3, porPulsoCamada: 10, pulsoMs: 500, agora: 2000 }), 2);
  assert.equal(d.falta, 40 + 60);
  assert.equal(d.ate, 4000);
  C4.porCamada(d, { ate: 4500, max: 3, porPulsoCamada: 10, pulsoMs: 500, agora: 2000 });
  assert.equal(C4.porCamada(d, { ate: 5000, max: 3, porPulsoCamada: 10, pulsoMs: 500, agora: 2000 }), 3, 'cheia: a de 3000 saiu');
  assert.deepEqual(d.camadas, [4000, 4500, 5000]);
  assert.equal(C4.camadasNoPulso(d, 4250), 2);
  // o secundário: 50%/s do que falta de todos os Venenos × 1 s
  const morto = { dots: [{ tipo: 'venenoPoe', falta: 300 }, { tipo: 'venenoPoe', falta: 100 }, { tipo: 'degenCaos', falta: 999 }] };
  assert.equal(C4.totalDoSecundario(morto, { porSegundoPct: 50 }, 1000), 200);
  assert.equal(C4.totalDoSecundario(morto, { porSegundoPct: 50 }, 2000), 400);
});

// ---------------------------------------------------------------- a Praga (D4.1 e D4.2)

/** O Tolhimento do bicho agora: `{ pct, ms }` (o que falta dele, a partir de `desde`), ou null. */
const tolhido = (b, desde) => (b.estados?.tolhido ? { pct: b.estados.tolhido.pct, ms: b.estados.tolhido.ate - desde } : null);

test('C4: a Praga — cada uso soma uma camada (o pulso é o de uma × as vivas), cada camada acaba no seu tempo; o Tolhimento só em quem não tinha a Praga', { skip: SEM }, async () => {
  const { e, b } = await montar('Blight');
  const t0 = e.hunt.clock;
  const r1 = usar(e, b);
  assert.ok(r1.ok);
  // (D4.1, dono 21/10) o Tolhimento de 80% — o estado próprio `tolhido`, sem o teto da lentidão — por 1 s × a Duração; o `lento` (a lentidão geral) não muda
  const tl = tolhido(b, t0);
  assert.equal(tl.pct, 80);
  assert.ok(tl.ms >= 1000 && tl.ms <= 1000 + 400, `${tl.ms}`);
  assert.equal(b.estados.lento, undefined);
  const d = doDot(b, 'Blight');
  assert.equal(d.camadas.length, 1);
  const porCamada = d.porPulsoCamada;
  assert.ok(porCamada > 0);
  const t1 = e.hunt.clock;
  // o segundo uso: mais uma camada; o Tolhimento não renova (o alvo já tem a Praga)
  delete b.estados.tolhido;
  usar(e, b);
  assert.equal(b.estados.tolhido, undefined, 'quem já tem a Praga não é Tolhido de novo');
  assert.equal(d.camadas.length, 2);
  usar(e, b);
  assert.equal(d.camadas.length, 3);
  assert.equal(d.porPulso, porCamada * 3);
  // os pulsos: 3 camadas enquanto todas vivem; depois a primeira acaba, e o pulso cai para 2 × e 1 ×
  const fim1 = d.camadas[0];
  const ps = pulsos(e, b, 'Blight', d.ate);
  assert.ok(ps.length > 3);
  assert.ok(Math.abs(ps[0] - 3 * porCamada) <= 1, `${ps[0]} vs ${3 * porCamada}`);
  // (cada camada paga nos pulsos do dano contínuo que caem até o fim dela: no fim, só as que ainda vivem — 1 ou 2 camadas)
  const ultimo = ps.at(-1) / porCamada;
  assert.ok(ps.at(-1) < ps[0] && Math.abs(ultimo - Math.round(ultimo)) < 0.02 && Math.round(ultimo) >= 1, `o último pulso, com as camadas que ainda vivem: ${JSON.stringify(ps)} (${porCamada})`);
  assert.ok(fim1 - t1 <= 2800 + 1, 'cada camada dura 2,8 s (2 s + 0,8 s da qualidade)');
});

test('C4: a Praga do Contágio — no máximo de 6 camadas, a nova entra no lugar da mais antiga', { skip: SEM }, async () => {
  const { e, b } = await montar('Blight_of_Contagion');
  for (let k = 0; k < 8; k++) usar(e, b);
  const d = doDot(b, 'Blight_of_Contagion');
  assert.equal(d.camadas.length, 6);
  assert.equal(d.porPulso, d.porPulsoCamada * 6);
});

test('C4: a Praga da Atrofia — o Tolhido tem a Regeneração de Vida reduzida em 80% pela Duração Secundária (3 s + 1 s da qualidade)', { skip: SEM }, async () => {
  const { e, b } = await montar('Blight_of_Atrophy');
  const antes = e.hunt.clock;
  usar(e, b);
  assert.equal(b.estados.regenMenosDebuff.pct, 80);
  assert.ok(b.estados.regenMenosDebuff.ate - antes >= 4000 && b.estados.regenMenosDebuff.ate - antes <= 4000 + 1000);
  assert.equal(b.estados.tolhido.pct, 80);
  assert.ok(b.estados.tolhido.ate - antes >= 4000 && b.estados.tolhido.ate - antes <= 4000 + 1000);
});

test('C4: a Praga Vaal — Tolhe sempre (3 s) e o Tolhido sofre +30% de Dano de Caos, também no pulso do dano contínuo', { skip: SEM }, async () => {
  const { e, b } = await montar('Vaal_Blight');
  const antes = e.hunt.clock;
  usar(e, b);
  assert.equal(b.estados.tolhidoCaos.pct, 30);
  assert.equal(b.estados.tolhido.pct, 80);
  assert.ok(b.estados.tolhido.ate - antes >= 3000 && b.estados.tolhido.ate - antes <= 3000 + 1000);
  const d = doDot(b, 'Vaal_Blight');
  const um = () => { const antes = b.hp; e.hunt.clock = d.proximo; Dot.tique(e.hunt, [], e.hunt.clock); return antes - b.hp; };
  const com = um();
  b.estados.tolhidoCaos.ate = 0;
  const sem = um();
  assert.ok(Math.abs(com / sem - 1.3) < 0.01, `${com} / ${sem}`);
  // (só no Caos: o fator do pulso de outro elemento não muda)
  assert.equal(ModsPoe.fatorRecebidoNoDot({ estados: { tolhidoCaos: { ate: 10, pct: 30 } } }, 'fire', 5), 1);
  assert.ok(Math.abs(ModsPoe.fatorRecebidoNoDot({ estados: { tolhidoCaos: { ate: 10, pct: 30 } } }, 'chaos', 5) - 1.3) < 1e-9);
});

// ---------------------------------------------------------------- o Definhar

test('C4: o Definhar — sem dano direto, põe um Definhamento por uso (2 s × a Duração, acumula) e Tolhe 36% por 0,5 s × a Duração', { skip: SEM }, async () => {
  const { e, b } = await montar('Wither');
  const antes = e.hunt.clock;
  for (let k = 0; k < 3; k++) usar(e, b);
  assert.equal(b.estados.definhado.n, 3);
  // (a qualidade 20: Duração do Efeito de Habilidades aumentada em 20% — 2 s → 2,4 s; 0,5 s → 0,6 s)
  assert.ok(b.estados.definhado.ate > antes + 2400);
  assert.equal(b.estados.tolhido.pct, 36);
  assert.ok(b.estados.tolhido.ate - e.hunt.clock <= 600);
  assert.equal(b.estados.lento, undefined);
});

// ---------------------------------------------------------------- o Golpe Pestilento (D4.3)

test('C4: o Golpe Pestilento — o Veneno dura 50% mais (30% + 20% da qualidade); na morte com o debuff e Envenenado, o secundário (50%/s do que faltava) nos vizinhos', { skip: SEM }, async () => {
  const { e, b, resto } = await montar('Pestilent_Strike', { arma: 'Daggers/Glass_Shank' });
  usar(e, b, 0);
  const veneno = (b.dots ?? []).filter((d) => d.tipo === 'venenoPoe');
  assert.ok(veneno.length >= 1, 'envenenou (sorteio travado em 0)');
  const ms = veneno[0].ate - (veneno[0].desde ?? 0);
  assert.ok(Math.abs(ms - 3000) <= 1, `o Veneno: 2 s × 1,5 = ${ms}`);
  assert.ok(b.estados.poePestilento.ate > e.hunt.clock);
  // o vizinho a 1 casa do morto (dentro de 2,7 m) recebe o secundário; o longe, não
  const [viz, longe] = resto;
  Object.assign(viz, { x: b.x + 1, y: b.y, hp: 1e12, maxHp: 1e12, estados: {}, dots: [] });
  Object.assign(longe, { x: b.x + 10, y: b.y, hp: 1e12, maxHp: 1e12, estados: {}, dots: [] });
  const falta = veneno.reduce((t, d) => t + d.falta, 0);
  b.estados.poePestilento.raio = 1;
  Acoes.aoMorrerC4(e.hunt, b, []);
  const sec = doDot(viz, 'Pestilent_Strike#secundario');
  assert.ok(sec, 'o vizinho recebeu o secundário');
  assert.ok(Math.abs(sec.falta - falta * 0.5) <= 1, `50%/s × 1 s do que faltava: ${sec.falta} vs ${falta * 0.5}`);
  assert.equal(sec.tipo, 'degenCaos');
  assert.equal(doDot(longe, 'Pestilent_Strike#secundario'), undefined);
  // sem Veneno no morto, nada
  const morto2 = { x: viz.x, y: viz.y, estados: { poePestilento: { ate: e.hunt.clock + 1000, raio: 1, porSegundoPct: 50, secundarioMs: 1000 } }, dots: [] };
  Object.assign(longe, { x: viz.x + 1, y: viz.y });
  Acoes.aoMorrerC4(e.hunt, morto2, []);
  assert.equal(doDot(longe, 'Pestilent_Strike#secundario'), undefined);
});

// ---------------------------------------------------------------- o Golpe da Víbora da Mamba

test('C4: a Víbora da Mamba — não envenena quem já está Envenenado, e um Veneno só por ataque (os adicionais não valem)', { skip: SEM }, async () => {
  const { e, b } = await montar('Viper_Strike_of_the_Mamba', { arma: 'Daggers/Glass_Shank' });
  usar(e, b, 0);
  assert.equal((b.dots ?? []).filter((d) => d.tipo === 'venenoPoe').length, 1);
  usar(e, b, 0);
  assert.equal((b.dots ?? []).filter((d) => d.tipo === 'venenoPoe').length, 1, 'o segundo ataque não envenena o Envenenado');
  // a regra pura: com "Inflige 2 envenenamentos adicionais", a Mamba põe um só; sem a regra, três
  const a = AfeccoesPoe.daSoma({ chance_poison: 100, venenos_extras: 2 });
  const alvo = () => ({ uid: 'x', hp: 1e9, maxHp: 1e9, estados: {} });
  const com = alvo();
  AfeccoesPoe.aoAcertar(com, [{ elemento: 'physical', dano: 1000 }], { afeccoes: C4.comOVenenoDaGema(a, { venenoUnico: true }), rng: () => 0, agora: 1 });
  const sem = alvo();
  AfeccoesPoe.aoAcertar(sem, [{ elemento: 'physical', dano: 1000 }], { afeccoes: a, rng: () => 0, agora: 1 });
  assert.equal(com.dots.length, 1);
  assert.equal(sem.dots.length, 3);
});

// ---------------------------------------------------------------- a segunda rodada (dono, 21/10)

test('C4 (dono, 21/10): o Tolhimento é o estado próprio — só o passo, sem teto, sem a metade do chefe, vale o mais forte; o lento segue com o teto', { skip: SEM }, () => {
  const m = { hp: 10, estados: {} };
  assert.ok(Estados.tolher(m, 80, 1000, 0));
  assert.ok(Math.abs(Estados.fatorDeTolhimento(m, 500) - 5) < 1e-9, 'o passo 5× mais lento (1 / (1 − 0,8))');
  assert.equal(Estados.fatorDeLentidao(m, 500), 1, 'o ataque (o lento) não muda');
  // o mais forte fica; o fim é o maior
  Estados.tolher(m, 30, 3000, 500);
  assert.deepEqual(m.estados.tolhido, { ate: 3500, pct: 80 });
  assert.equal(Estados.fatorDeTolhimento(m, 4000), 1);
  // o chefe: a mesma regra (o lento leva a metade; o Tolhimento, não)
  const chefe = { hp: 10, boss: true, estados: {} };
  Estados.tolher(chefe, 80, 1000, 0);
  assert.equal(chefe.estados.tolhido.pct, 80);
  Estados.aplicar(chefe, { lentidaoPct: 80 }, 1, 0, () => 0.5, true);
  assert.equal(chefe.estados.lento.pct, 20, 'a lentidão geral segue: teto de 40% e metade no chefe');
  // as condições: o Tolhido conta como "Desacelerado/Lento", não como Resfriado
  const tags = ModsPoe.tagsDoAlvo({ estados: { tolhido: { ate: 10, pct: 50 } } }, 5);
  assert.ok(tags.includes('alvoLento') && !tags.includes('alvoResfriado'));
});

test('C4 (dono, 21/10): as runas da Vinculação, a Esfera do Vazio e o Tornado Tolhem pelo estado próprio, sem o teto', { skip: SEM }, async () => {
  const { e, b } = await montar('Stormbind');
  e.hunt.poeObjetos = [{ tipo: 'runa_tempestade', x: b.x, y: b.y, z: e.hunt.z ?? 0, ate: e.hunt.clock + 10_000, desde: e.hunt.clock, nivel: 0, acao: G.doSlug('Stormbind').acao, dono: 'voce' }];
  Acoes.tiqueDasRunas(e, e.hunt, PERSONAGEM, []);
  Acoes.tiqueDasPlantadas(e, e.hunt, PERSONAGEM, []);
  assert.equal(b.estados.tolhido?.pct, 50, 'a runa: −50%, sem o teto de 40%');
  assert.equal(b.estados.lento, undefined);
});

test('C4 (dono, 21/10): o dano sofrido aumentado do alvo vale no pulso do dano contínuo — o Definhado no Caos, a Eletrização, a maldição no degenerativo da gema', { skip: SEM }, async () => {
  const { e, b } = await montar('Blight');
  usar(e, b);
  const d = doDot(b, 'Blight');
  const um = () => { const antes = b.hp; e.hunt.clock = d.proximo; Dot.tique(e.hunt, [], e.hunt.clock); return antes - b.hp; };
  const sem = um();
  b.estados.definhado = { ate: e.hunt.clock + 10_000, n: 5 };
  const comDefinhado = um();
  assert.ok(Math.abs(comDefinhado / sem - 1.3) < 0.01, `5 Definhamentos: +30% de Caos sofrido (${comDefinhado} / ${sem})`);
  delete b.estados.definhado;
  b.estados.chocado = { ate: e.hunt.clock + 10_000, pct: 20 };
  const comEletrizado = um();
  assert.ok(Math.abs(comEletrizado / sem - 1.2) < 0.01, `a Eletrização de 20% (${comEletrizado} / ${sem})`);
  delete b.estados.chocado;
  b.maldicoes = { teste: { ate: e.hunt.clock + 10_000, desde: e.hunt.clock, dur: 10_000, efeitos: [{ tipo: 'vulneravel', tipos: ['chaos'], pct: 25 }] } };
  const comMaldicao = um();
  assert.ok(Math.abs(comMaldicao / sem - 1.25) < 0.01, `a maldição de +25% de Caos sofrido, no degenerativo da gema (${comMaldicao} / ${sem})`);
  // (o que é do atacante ou só de acerto não entra: o Intimidado — dano de Ataque)
  assert.equal(ModsPoe.fatorRecebidoNoDot({ estados: { intimidado: { ate: 10 } } }, 'chaos', 5), 1);
  assert.ok(Reforcos.vulnerabilidade(b, 'chaos', e.hunt.clock) > 1);
});

test('C4 (dono, 21/10): a magia sem acerto não gera o acerto de 1 — a Praga, o Definhar, o Contágio, o Raio Abrasador', { skip: SEM }, async () => {
  for (const s of ['Blight', 'Wither', 'Contagion', 'Scorching_Ray', 'Vaal_Blight']) {
    assert.ok(G.magiaSemAcerto(s, 20, 20), s);
    const { e, b } = await montar(s);
    const r = usar(e, b);
    assert.ok(r.ok, s);
    assert.deepEqual((r.eventos ?? []).filter((x) => x.t === 'dmg' && x.uid === b.uid), [], `${s}: sem acerto`);
  }
  for (const s of ['Fireball', 'Essence_Drain', 'Cleave', 'Detonate_Dead']) assert.equal(G.magiaSemAcerto(s, 20, 0), false, s);
});

test('C4 (dono, 21/10): a Praga Vaal põe 3 camadas — a do uso e mais 2, cada uma numa área 50% maior que a anterior', { skip: SEM }, async () => {
  assert.ok(Math.abs(C4.fatorDaCamadaVaal(G.c4DaGema('Vaal_Blight', 20, 0).praga, 2) - 2.25) < 1e-9);
  const { e, b } = await montar('Vaal_Blight');
  usar(e, b);
  assert.equal(doDot(b, 'Vaal_Blight').camadas.length, 3, 'o alvo colado leva as 3');
});
