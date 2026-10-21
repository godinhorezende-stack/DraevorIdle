// (revisão adversarial dos lotes B2, PR2 e C2 das gemas ativas — 21/10) Os achados confirmados, corrigidos pela regra do PoE: o Contágio (o mais forte fica; o
// Drenar Essência vai junto), o Solo Sagrado (o teto por fonte), os debuffs com dono na party (o Golpe Infernal, o Ceifar, o Sangue Fervendo), o Chicote Ardente
// (o estado Queimando do jogo), o Caos que atravessa o Escudo (a Proteção Perversa, a Mente sobre a Matéria, o recebido como Caos, a magia por parte) e a
// Explosão de Runas (o revezamento com a barra, a casa andável, o raio do jogo, a qualidade e o custo).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
const Acoes = await import('../systems/acoes.mjs');
const Dot = await import('../systems/combate/dot.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const G = await import('../systems/itens-poe/gemas-poe.mjs');
const B2 = await import('../systems/itens-poe/gemas-b2.mjs');
const C2 = await import('../systems/itens-poe/gemas-c2.mjs');
const Cond = await import('../systems/itens-poe/condicoes-poe.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Defesa = await import('../systems/personagem/defesa.mjs');
const Poderes = await import('../systems/poderes.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');

let J;
let gerarPeca;
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
const perto = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

function travado(v, fn) {
  const antes = Math.random;
  Math.random = () => v;
  try { return fn(); } finally { Math.random = antes; }
}
async function montar(slug, { nivel = 20, qualidade = 0, arma = 'Wands/Driftwood_Wand' } = {}) {
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
function usar(e, b, v = 0.5) {
  return travado(v, () => {
    let x = Acoes.disparar(e, e.hunt, PERSONAGEM, 0, b, { manual: true });
    if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM); }
    e.hunt.clock = Math.max(e.hunt.clock, e.hunt.cooldowns?.['grupo:poe']?.ate ?? e.hunt.clock);
    return x;
  });
}
const runas = (e) => (e.hunt.poeObjetos ?? []).filter((o) => o.tipo === 'runa_tempestade');

// ---------------------------------------------------------------- B2

test('revisão B2 (achado 1): o Contágio espalhado mais fraco não encurta o do vizinho nem tira o dano que falta (o mais forte fica)', { skip: SEM }, () => {
  const agora = 10_000;
  const de = { uid: 'a', x: 0, y: 0, hp: 100, maxHp: 100 };
  const viz = { uid: 'b', x: 1, y: 0, hp: 1e9, maxHp: 1e9 };
  const hunt = { monstros: [de, viz], z: 0, clock: agora };
  Dot.aplicar(viz, { tipo: 'degenCaos', total: 1000, duracaoMs: 5000, chave: 'Contagion' }, agora);
  Dot.aplicar(de, { tipo: 'degenCaos', total: 200, duracaoMs: 1000, chave: 'Contagion' }, agora);
  de.dots[0].contagio = { aoMorrer: true, raio: 2 };
  const antes = { ...viz.dots[0] };
  Acoes.espalharContagio(hunt, de, agora, { morte: true });
  assert.deepEqual([viz.dots[0].falta, viz.dots[0].ate], [antes.falta, antes.ate], 'o vizinho segue com 1000 em 5 s');
  // o espalhado MAIS FORTE troca o dele
  const forte = { uid: 'c', x: 0, y: 1, hp: 100, maxHp: 100 };
  hunt.monstros.push(forte);
  Dot.aplicar(forte, { tipo: 'degenCaos', total: 3000, duracaoMs: 2000, chave: 'Contagion' }, agora);
  forte.dots[0].contagio = { aoMorrer: true, raio: 2 };
  Acoes.espalharContagio(hunt, forte, agora, { morte: true });
  assert.equal(viz.dots.find((d) => d.chave === 'Contagion').falta, 3000);
});

test('revisão PR2 (achado 12): "O debuff é espalhado por Contágio" — o Drenar Essência vai junto (com o dreno), o da Maldade não', { skip: SEM }, () => {
  assert.deepEqual(['Essence_Drain', 'Essence_Drain_of_Desperation', 'Essence_Drain_of_Wickedness', 'Contagion'].map(G.espalhadoPeloContagio), [true, true, false, false]);
  const agora = 10_000;
  const de = { uid: 'a', x: 0, y: 0, hp: 100, maxHp: 100 };
  const viz = { uid: 'b', x: 1, y: 0, hp: 1e9, maxHp: 1e9 };
  const longe = { uid: 'c', x: 9, y: 0, hp: 1e9, maxHp: 1e9 };
  const hunt = { monstros: [de, viz, longe], z: 0, clock: agora };
  Dot.aplicar(de, { tipo: 'degenCaos', total: 500, duracaoMs: 3000, chave: 'Essence_Drain' }, agora);
  de.dots[0].dreno = { vidaPct: 1 };
  Dot.aplicar(de, { tipo: 'degenCaos', total: 200, duracaoMs: 3000, chave: 'Contagion' }, agora);
  de.dots.find((d) => d.chave === 'Contagion').contagio = { aoMorrer: true, raio: 2 };
  // sem o Contágio espalhando, o Drenar Essência não sai
  Acoes.espalharContagio(hunt, de, agora, { morte: false });
  assert.ok(!(viz.dots ?? []).length);
  Acoes.espalharContagio(hunt, de, agora, { morte: true });
  const ed = viz.dots.find((d) => d.chave === 'Essence_Drain');
  assert.ok(ed && ed.falta === 500 && ed.dreno?.vidaPct === 1, 'o vizinho leva o Drenar Essência com o dreno');
  assert.ok(!ed.contagio, 'sem a marca do Contágio');
  assert.ok(viz.dots.some((d) => d.chave === 'Contagion'));
  assert.ok(!(longe.dots ?? []).length, 'fora do raio, nada');
});

test('revisão B2 (achado 2): o teto de 5 Solos Sagrados é por fonte — a Chama Purificadora não expulsa o do Totem nem o seu', { skip: SEM }, () => {
  const h = { pos: { x: 0, y: 0 }, clock: 1000, lacaios: [{ uid: 't1', hp: 10 }], solosSagrados: [{ x: 0, y: 0, raio: 2, ate: Infinity, dono: 't1', imuneMaldicao: true }] };
  Cond.criarSoloSagrado(h, 4, 1000);
  for (let i = 0; i < 7; i++) Cond.criarSoloSagrado(h, 4, 1000 + i, { x: 10 + i, y: 10, raio: 1, fonte: 'Purifying_Flame' });
  assert.ok(Cond.soloImuneAMaldicoes(h, 1010), 'o do Totem segue');
  assert.equal(h.solosSagrados.filter((s) => s.fonte === 'Purifying_Flame').length, 5);
  assert.equal(h.solosSagrados.filter((s) => !s.dono && !s.fonte).length, 1, 'o seu também segue');
  // o do totem morto sai da lista
  h.lacaios[0].hp = 0;
  Cond.criarSoloSagrado(h, 4, 1010);
  assert.ok(!h.solosSagrados.some((s) => s.dono));
});

test('revisão B2 (achados 3 e 4): na party, o Golpe Infernal e a Carga Sangrenta do Ceifar de OUTRO membro ficam para ele (a fila da sala)', { skip: SEM }, () => {
  const agora = 50_000;
  const hunt = { pos: { x: 0, y: 0 }, clock: agora, z: 0, monstros: [] };
  const eu = { nome: 'Eu' };
  const outro = { nome: 'Outro' };
  const estado = { hp: 100, hunt };
  B2.mudarSangrentas(hunt, 3, agora);
  const morto = { uid: 'm', x: 1, y: 0, hp: 0, maxHp: 100, estados: { poeInfernal: { carregado: true, n: 3, ate: agora + 5000, acao: 'x', quem: 'Outro' } } };
  morto.dots = [{ id: 'r', tipo: 'degenFisico', elemento: 'physical', chave: 'Reap', falta: 50, porPulso: 5, ate: agora + 2000, proximo: agora + 500, origem: { fonte: 'gema', quem: 'Outro' } }];
  const ev = Acoes.aoMorrerB2(estado, hunt, eu, morto, []);
  assert.equal(ev.length, 0, 'quem matou não explode o debuff do outro com a ficha dele');
  assert.equal(B2.cargasSangrentas(hunt, agora).n, 3, 'nem perde a carga dele');
  assert.ok(!morto.estados.poeInfernal);
  assert.deepEqual(hunt.poeB2Pendentes.map((p) => [p.quem, !!p.infernal, p.sangrenta ?? 0]).sort(), [['Outro', false, -1], ['Outro', true, 0]]);
  // o tique de quem não é o dono não mexe na fila; o do dono a consome (a carga dele)
  Acoes.tiqueDasGemasB2(estado, hunt, eu, [], agora);
  assert.equal(hunt.poeB2Pendentes.length, 2);
  Acoes.tiqueDasGemasB2(estado, hunt, outro, [], agora);
  assert.ok(!hunt.poeB2Pendentes);
  assert.equal(B2.cargasSangrentas(hunt, agora).n, 2);
  // o debuff vencido de OUTRO no bicho vivo: o meu tique não o apaga
  const vivo = { uid: 'v', x: 2, y: 0, hp: 10, maxHp: 10, estados: { poeInfernal: { carregado: true, n: 2, ate: agora - 1, acao: 'x', quem: 'Outro' } } };
  hunt.monstros.push(vivo);
  Acoes.tiqueDasGemasB2(estado, hunt, eu, [], agora);
  assert.ok(vivo.estados.poeInfernal, 'fica para o dono');
});

test('revisão B2 (achado 4): o Ceifar perde a carga só pelo debuff ainda ativo (a folga de um pulso), não até 1 s depois', { skip: SEM }, () => {
  const agora = 50_000;
  const hunt = { pos: { x: 0, y: 0 }, clock: agora, z: 0, monstros: [] };
  B2.mudarSangrentas(hunt, 3, agora);
  const morto = (ate) => ({ uid: 'm', x: 1, y: 0, hp: 0, maxHp: 100, estados: {}, dots: [{ id: 'r', tipo: 'degenFisico', chave: 'Reap', falta: 10, ate, proximo: ate, origem: { fonte: 'gema' } }] });
  Acoes.aoMorrerB2({ hp: 1 }, hunt, PERSONAGEM, morto(agora - 900), []);
  assert.equal(B2.cargasSangrentas(hunt, agora).n, 3, 'acabou há 0,9 s (o pulso é de 0,5 s): não conta');
  Acoes.aoMorrerB2({ hp: 1 }, hunt, PERSONAGEM, morto(agora - 200), []);
  assert.equal(B2.cargasSangrentas(hunt, agora).n, 2, 'no último pulso: conta');
});

test('revisão B2 (achado 4, no jogo): o Ceifar guarda quem o pôs no debuff', { skip: SEM }, async () => {
  const m = await montar('Reap');
  assert.ok(usar(m.e, m.b).ok);
  assert.equal(m.b.dots.find((d) => d.chave === 'Reap')?.origem?.quem, PERSONAGEM.nome);
});

test('revisão B2 (achado 3, dono 21/10, no jogo): o Golpe Infernal — um debuff por jogador, cada um com as próprias cargas', { skip: SEM }, async () => {
  const m = await montar('Infernal_Blow', { arma: 'Two_Hand_Maces/Driftwood_Maul' });
  assert.ok(usar(m.e, m.b).ok);
  assert.deepEqual([m.b.estados.poeInfernal?.quem, m.b.estados.poeInfernal?.n], [PERSONAGEM.nome, 1]);
  // o debuff de outro membro (com 4 cargas) no lugar do primeiro: o meu acerto põe o MEU, ao lado, sem mexer no dele
  m.b.estados.poeInfernal.quem = 'Outro';
  m.b.estados.poeInfernal.n = 4;
  m.e.hunt.cooldowns = {};
  assert.ok(usar(m.e, m.b).ok);
  assert.deepEqual([m.b.estados.poeInfernal.quem, m.b.estados.poeInfernal.n], ['Outro', 4]);
  const meu = m.b.estados.poeInfernaisDeOutros?.[PERSONAGEM.nome];
  assert.deepEqual([meu?.carregado, meu?.n], [true, 1]);
  m.e.hunt.cooldowns = {};
  assert.ok(usar(m.e, m.b).ok);
  assert.equal(m.b.estados.poeInfernaisDeOutros[PERSONAGEM.nome].n, 2, 'as minhas cargas sobem; as do outro, não');
  assert.equal(m.b.estados.poeInfernal.n, 4);
  // o meu expira e explode no meu tique; o do outro fica para ele
  const ev = [];
  m.e.hunt.clock = Math.max(meu.ate, m.b.estados.poeInfernaisDeOutros[PERSONAGEM.nome].ate) + 1;
  m.b.estados.poeInfernal.ate = m.e.hunt.clock - 1;
  travado(0.01, () => Acoes.tiqueDasGemasB2(m.e, m.e.hunt, PERSONAGEM, ev, m.e.hunt.clock));
  assert.ok(ev.some((x) => x.t === 'explosao'), 'o meu explodiu');
  assert.ok(!m.b.estados.poeInfernaisDeOutros?.[PERSONAGEM.nome]?.carregado, 'o meu saiu (a explosão deixa o descarregado)');
  assert.equal(m.b.estados.poeInfernal?.quem, 'Outro', 'o do outro segue, para o tique dele');
});

test('revisão B2 (achado 6): o "mais contra Incendiado" do Chicote Ardente — o estado Queimando do jogo, só o ativo (o degenerativo de Fogo conta; o Incêndio vencido, não)', { skip: SEM }, async () => {
  const dano = async (dots) => {
    const m = await montar('Flame_Surge');
    const agora = m.e.hunt.clock;
    if (dots) m.b.dots = dots(agora);
    const hp = m.b.hp;
    assert.ok(usar(m.e, m.b).ok);
    return hp - m.b.hp;
  };
  const sem = await dano(null);
  const degen = await dano((t) => [{ id: 'd', tipo: 'degenFogo', elemento: 'fire', ate: t + 60_000, falta: 1, porPulso: 0, proximo: t + 60_000 }]);
  const vencido = await dano((t) => [{ id: 'q', tipo: 'queimadura', elemento: 'fire', ate: t - 5000, falta: 1, porPulso: 0, proximo: t + 60_000 }]);
  assert.ok(perto(degen / sem, 1.88, 0.001), `o degenerativo de Fogo: ${degen / sem}`);
  assert.ok(perto(vencido / sem, 1, 0.001), `o Incêndio vencido: ${vencido / sem}`);
});

// ---------------------------------------------------------------- PR2

test('revisão PR2 (achado 7): o Caos que atravessa o Escudo respeita a Proteção Perversa (a recarga começada há pouco não para)', { skip: SEM }, () => {
  const estado = { es: 1000, esEspera: 0, esRecargaDesde: 9000, hunt: { clock: 10_000 } };
  const ficha = { energyShield: 1000, afPoe: { recarga_nao_interrompida: 1 } };
  const vida = Defesa.absorverComOCaos(estado, ficha, 500, 300, [], { uid: 'player' });
  assert.deepEqual([vida, estado.es, estado.esEspera], [300, 800, 0]);
  // sem a Perversa, a espera reinicia
  const e2 = { es: 1000, esEspera: 0, esRecargaDesde: 9000, hunt: { clock: 10_000 } };
  Defesa.absorverComOCaos(e2, { energyShield: 1000, afPoe: {} }, 500, 500, [], {});
  assert.ok(e2.esEspera > 0);
});

test('revisão PR2 (achado 8): a Mente sobre a Matéria vale para o Caos que atravessa o Escudo', { skip: SEM }, () => {
  const estado = { es: 1000, mana: 1000, esEspera: 0 };
  const vida = Defesa.absorverComOCaos(estado, { energyShield: 1000, afPoe: { dano_pela_mana_pct: 40 } }, 100, 100, [], { uid: 'player' });
  assert.deepEqual([vida, estado.mana, estado.es], [60, 960, 1000]);
});

test('revisão PR2 (achado 9): o dano recebido COMO Caos atravessa o Escudo (a fração depois da resistência a Caos)', { skip: SEM }, () => {
  const ficha = { energyShield: 1000, protection: { chaos: 20, fire: 0 }, afPoe: { recebe_physical_como_chaos: 50, recebe_fire_como_chaos: 100 } };
  assert.ok(perto(Cond.parteCaosRecebida(ficha, 'physical'), 0.5 * 0.8));
  assert.ok(perto(Cond.fracaoCaosDoTipo(ficha, 'fire'), 1));
  assert.ok(perto(Cond.caosNasPartes(ficha, { physical: 100 }, { physical: 70 }), 40));
  assert.equal(Cond.parteCaosRecebida({ afPoe: {}, protection: {} }, 'fire'), 0);
  // a magia de Fogo toda recebida como Caos: atravessa o Escudo
  const estado = { es: 1000, hp: 5000, maxHp: 5000, mana: 0 };
  Poderes.aplicarNoJogador({ estado, hunt: { pos: { x: 0, y: 0 }, clock: 0 }, bicho: { key: 'k', hp: 1 }, dano: 400, elemento: 'fire', eventos: [], base: { uid: 'player', x: 0, y: 0 }, ficha, temEscudo: false });
  assert.deepEqual([estado.hp, estado.es], [4600, 1000]);
  // a Carne Divina (Caos não atravessa): tudo pelo Escudo
  const e2 = { es: 1000, hp: 5000, maxHp: 5000, mana: 0 };
  Poderes.aplicarNoJogador({ estado: e2, hunt: { pos: { x: 0, y: 0 }, clock: 0 }, bicho: { key: 'k', hp: 1 }, dano: 400, elemento: 'fire', eventos: [], base: { uid: 'player', x: 0, y: 0 }, ficha: { ...ficha, afPoe: { ...ficha.afPoe, caos_nao_atravessa_escudo: 1 } }, temEscudo: false });
  assert.deepEqual([e2.hp, e2.es], [5000, 600]);
});

test('revisão PR2 (achado 10): na magia de várias partes, só a de Caos atravessa o Escudo (`caos`)', { skip: SEM }, () => {
  const base = { uid: 'player', x: 0, y: 0 };
  const hunt = { pos: { x: 0, y: 0 }, clock: 0 };
  const ficha = { energyShield: 1000, afPoe: {} };
  const a = { es: 1000, hp: 5000, maxHp: 5000, mana: 0 };
  Poderes.aplicarNoJogador({ estado: a, hunt, bicho: { key: 'k', hp: 1 }, dano: 400, elemento: 'chaos', eventos: [], base, ficha, temEscudo: false, caos: 100 });
  assert.deepEqual([a.hp, a.es], [4900, 700], 'a de Caos com Fogo do mapa: só os 100 de Caos na Vida');
  const b = { es: 1000, hp: 5000, maxHp: 5000, mana: 0 };
  Poderes.aplicarNoJogador({ estado: b, hunt, bicho: { key: 'k', hp: 1 }, dano: 400, elemento: 'fire', eventos: [], base, ficha, temEscudo: false, caos: 150 });
  assert.deepEqual([b.hp, b.es], [4850, 750], 'a de Fogo com Caos a mais: os 150 de Caos atravessam');
});

// ---------------------------------------------------------------- C2

test('revisão C2 (achado 13, dono 21/10): na caçada, a Explosão de Runas reveza com a barra em cada volta — a Vinculação segue espalhando, mais de uma runa no chão, e detona', { skip: SEM }, async () => {
  const { e, b } = await montar('Stormbind');
  void b;
  let max = 0;
  let explosoes = 0;
  let t = Date.now();
  travado(0.5, () => {
    for (let i = 0; i < 80; i++) {
      t += 250;
      const ev = Cacadas.tique(e, PERSONAGEM, t) ?? [];
      e.mana = e.maxMana;
      max = Math.max(max, runas(e).length);
      explosoes += ev.filter((x) => x.t === 'explosao').length;
    }
  });
  assert.ok(max > 1, `mais de uma runa no chão (${max})`);
  assert.ok(explosoes > 0, 'detonou');
});

test('revisão C2 (dono 21/10): no laço da barra, a Velocidade de Conjuração encurta de verdade os 0,16 s da Explosão (o relógio lógico: mais usos no mesmo tique)', { skip: SEM }, async () => {
  const usosNoTique = async (cs) => {
    const { e, b } = await montar('Stormbind');
    if (cs) { e.equipment.weapon.poe.af = { ...(e.equipment.weapon.poe.af ?? {}), cast_speed: cs }; Ficha.invalidar(e); }
    assert.ok(usar(e, b).ok);
    for (let k = 0; k < 3; k++) { e.hunt.cooldowns = {}; usar(e, b); }
    const agora = e.hunt.clock + 1000;
    e.hunt.relogioAnterior = agora - 250;
    e.hunt.cooldowns = { 'grupo:poe': { ate: agora - 240, total: 0 } };
    let n = 0;
    travado(0.5, () => {
      for (let k = 0; k < 8; k++) {
        const antes = e.hunt.poeExplosaoDeRunas?.ultimoUso;
        Acoes.explosaoDeRunas(e, e.hunt, PERSONAGEM, agora, { logico: true });
        if (e.hunt.poeExplosaoDeRunas?.ultimoUso === antes) break;
        n++;
      }
    });
    return { n, cs: Ficha.combate(e).castSpeed ?? 0 };
  };
  const sem = await usosNoTique(0);
  const com = await usosNoTique(100);
  assert.ok(com.cs >= sem.cs + 90, `a conjuração subiu (${sem.cs} → ${com.cs})`);
  assert.ok(sem.n >= 1 && com.n > sem.n, `usos no tique: ${sem.n} → ${com.n}`);
});

test('revisão C2 (achado 13): a canalização melhora as runas de quando começou — a runa nova não a prolonga; ela libera', { skip: SEM }, async () => {
  const { e, b } = await montar('Stormbind');
  assert.ok(usar(e, b).ok);
  const [primeira] = runas(e);
  e.hunt.clock += 200;
  travado(0.5, () => Acoes.explosaoDeRunas(e, e.hunt, PERSONAGEM, e.hunt.clock));
  // a Vinculação espalha outra no meio da canalização
  e.hunt.cooldowns = {};
  assert.ok(usar(e, b).ok);
  assert.equal(runas(e).length, 2);
  for (let k = 0; k < 40 && runas(e).includes(primeira); k++) { e.hunt.clock += 200; e.hunt.cooldowns = {}; travado(0.5, () => Acoes.explosaoDeRunas(e, e.hunt, PERSONAGEM, e.hunt.clock)); }
  assert.ok(!runas(e).includes(primeira), 'a primeira detonou');
});

test('revisão C2 (achado 14): a runa só fica em casa andável do jogo (e o Teletransporte herda isso)', { skip: SEM }, async () => {
  assert.deepEqual(C2.casaDaProximaRuna({ x: 5, y: 5 }, [], 8, (c) => c.x !== 5), { x: 4, y: 4 });
  const { e, b } = await montar('Stormbind_of_Teleportation');
  // (a grade do combate: uma parede logo à direita do alvo — só as casas até ele são andáveis)
  const p0 = { ...e.hunt.pos };
  const andavel = new Set();
  for (let dx = -10; dx <= 1; dx++) for (let dy = -10; dy <= 10; dy++) andavel.add(`${p0.x + dx},${p0.y + dy}`);
  ModsPoe.definirGradeDoCombate(e.hunt, () => ({ andavel }));
  for (let k = 0; k < 12; k++) { e.hunt.cooldowns = {}; usar(e, b); }
  assert.ok(runas(e).length >= 12);
  for (const r of runas(e)) assert.ok(andavel.has(`${r.x},${r.y}`), `runa em ${r.x - p0.x},${r.y - p0.y}`);
  // a runa que já estava numa casa que não é andável (um estado salvo): o Teletransporte não leva você para lá
  const r = runas(e)[0];
  for (const o of runas(e)) if (o !== r) o.ate = 0;
  Object.assign(r, { x: p0.x + 3, y: p0.y, nivel: 3 });
  Object.assign(b, { x: p0.x + 2, y: p0.y });
  const pos = { ...e.hunt.pos };
  e.hunt.clock += 200;
  e.hunt.cooldowns = {};
  e.mana = 0;
  travado(0.5, () => Acoes.explosaoDeRunas(e, e.hunt, PERSONAGEM, e.hunt.clock));
  assert.ok(!runas(e).includes(r) || r.ate <= e.hunt.clock, 'a runa detonou');
  assert.deepEqual(e.hunt.pos, pos, 'fica onde está');
});

test('revisão C2 (achado 15): o raio da runa pela regra do jogo — a fração de m ÷ 2 vira a chance de uma casa a mais', { skip: SEM }, async () => {
  // nível 0, sem Área: 1,6 m → 0,8 casa — com o sorteio em 0,3 (< 0,8), 1 casa: o vizinho a 1 casa é atingido
  const { e, b } = await montar('Stormbind');
  assert.ok(usar(e, b).ok);
  const r = runas(e)[0];
  Object.assign(b, { x: r.x + 1, y: r.y });
  e.mana = 0;
  e.hunt.clock += 200;
  const hp = b.hp;
  travado(0.3, () => Acoes.explosaoDeRunas(e, e.hunt, PERSONAGEM, e.hunt.clock));
  assert.ok(b.hp < hp, 'a explosão pegou a 1 casa');
  assert.deepEqual([r.raioSorteado?.nivel, r.raioSorteado?.casas], [0, 1]);
});

test('revisão C2 (achado 16): a Explosão de Runas — 0,5% de conjuração por qualidade (o PoB) e o custo com os modificadores do custo', { skip: SEM }, async () => {
  const total = async (qualidade, af = null) => {
    const { e, b } = await montar('Stormbind', { qualidade });
    assert.ok(usar(e, b).ok);
    if (af) { e.equipment.weapon.poe.af = { ...(e.equipment.weapon.poe.af ?? {}), ...af }; Ficha.invalidar(e); }
    e.hunt.clock += 200;
    e.hunt.cooldowns = {};
    const mana = e.mana;
    travado(0.5, () => Acoes.explosaoDeRunas(e, e.hunt, PERSONAGEM, e.hunt.clock));
    return { ms: e.hunt.cooldowns['grupo:poe'].total, custo: mana - e.mana, cs: Ficha.combate(e).castSpeed ?? 0 };
  };
  const q0 = await total(0);
  const q20 = await total(20);
  assert.equal(q0.ms, Math.round(160 / (1 + q0.cs / 100)));
  assert.equal(q20.ms, Math.round(160 / (1 + (q20.cs + 10) / 100)));
  assert.equal(q0.custo, 18);
  const caro = await total(0, { custo_mana_inc: 50 });
  assert.equal(caro.custo, 27, '"Custo de Mana aumentado em 50%": 18 → 27');
});

test('revisão B2 (achado 1, dono 21/10): o mais forte do Contágio é pelo DANO POR SEGUNDO — o espalhado mais forte troca o do vizinho, mesmo durando menos', { skip: SEM }, () => {
  const agora = 10_000;
  const de = { uid: 'a', x: 0, y: 0, hp: 100, maxHp: 100 };
  const viz = { uid: 'b', x: 1, y: 0, hp: 1e9, maxHp: 1e9 };
  const hunt = { monstros: [de, viz], z: 0, clock: agora };
  Dot.aplicar(viz, { tipo: 'degenCaos', total: 1000, duracaoMs: 5000, chave: 'Contagion' }, agora);
  Dot.aplicar(de, { tipo: 'degenCaos', total: 400, duracaoMs: 1000, chave: 'Contagion' }, agora);
  de.dots[0].contagio = { aoMorrer: true, raio: 2 };
  Acoes.espalharContagio(hunt, de, agora, { morte: true });
  const d = viz.dots.filter((x) => x.chave === 'Contagion');
  assert.equal(d.length, 1);
  assert.deepEqual([d[0].falta, d[0].ate], [400, agora + 1000], '400/s troca os 200/s');
  assert.ok(d[0].contagio, 'e espalha também');
  // o mais fraco por segundo (com mais dano que falta) não troca
  const v2 = { uid: 'c', x: 0, y: 1, hp: 1e9, maxHp: 1e9 };
  hunt.monstros.push(v2);
  Dot.aplicar(v2, { tipo: 'degenCaos', total: 500, duracaoMs: 1000, chave: 'Contagion' }, agora);
  const de2 = { uid: 'd', x: 1, y: 1, hp: 100, maxHp: 100 };
  hunt.monstros.push(de2);
  Dot.aplicar(de2, { tipo: 'degenCaos', total: 2000, duracaoMs: 8000, chave: 'Contagion' }, agora);
  de2.dots[0].contagio = { aoMorrer: true, raio: 1 };
  Acoes.espalharContagio(hunt, de2, agora, { morte: true });
  assert.equal(v2.dots.find((x) => x.chave === 'Contagion').falta, 500, '250/s não troca os 500/s');
});

test('revisão B2 (achado 6, dono 21/10): no chão de fogo (o Solo Ardente, a Tormenta) ou no Sangue Fervendo, o monstro conta como Queimando', { skip: SEM }, () => {
  const agora = 1000;
  const m = { uid: 'm', x: 5, y: 5, hp: 10, estados: {} };
  const hunt = { z: 0, clock: agora, poeObjetos: [], monstros: [m] };
  assert.equal(Acoes.queimandoAgora(hunt, m, agora), false);
  hunt.poeObjetos.push({ efeito: 'solo', x: 6, y: 5, raio: 1, z: 0, ate: agora + 1000, partes: [{ elemento: 'fire', porSegundo: 10 }] });
  assert.equal(Acoes.queimandoAgora(hunt, m, agora), true, 'o Solo Ardente a 1 casa');
  hunt.poeObjetos[0].partes = [{ elemento: 'chaos', porSegundo: 10 }];
  assert.equal(Acoes.queimandoAgora(hunt, m, agora), false, 'o chão de Caos não queima');
  hunt.solosDoJogador = [{ casas: ['5,5'], z: 0, ate: agora + 1000, partes: [{ tipo: 'degenFogo', elemento: 'fire', porSegundo: 5 }] }];
  assert.equal(Acoes.queimandoAgora(hunt, m, agora), true, 'o Solo Ardente do Avanço Flamejante');
  delete hunt.solosDoJogador;
  m.estados.poeSangueFervendo = { ate: agora + 500, partes: [{ elemento: 'physical', porSegundo: 5 }] };
  assert.equal(Acoes.queimandoAgora(hunt, m, agora), true, 'o Sangue Fervendo');
  m.estados.poeSangueFervendo.ate = agora - 1;
  assert.equal(Acoes.queimandoAgora(hunt, m, agora), false);
});

test('revisão B2 (achado 6, dono 21/10, no jogo): o Chicote Ardente dá o "mais" ao monstro num chão de fogo', { skip: SEM }, async () => {
  const dano = async (chao) => {
    const m = await montar('Flame_Surge');
    if (chao) (m.e.hunt.poeObjetos ??= []).push({ id: 'x', tipo: 'chao', efeito: 'inerte_teste', x: m.b.x, y: m.b.y, z: m.b.z ?? m.e.hunt.z ?? 0, raio: 0, ate: m.e.hunt.clock + 60_000, partes: [{ elemento: 'fire', porSegundo: 0.0001 }], ...chao });
    const hp = m.b.hp;
    assert.ok(usar(m.e, m.b).ok);
    return hp - m.b.hp;
  };
  const sem = await dano(null);
  const com = await dano({ efeito: 'solo' });
  assert.ok(perto(com / sem, 1.88, 0.01), `razão ${com / sem}`);
});

test('revisão PR2 (dono 21/10): o Físico que ignora o Escudo também é reduzido pelo Escudo Gélido, na proporção (o resto do golpe passa pelo Escudo)', { skip: SEM }, async () => {
  const M = await import('../systems/mobs/atributos.mjs');
  const { contraAtaque } = await import('../systems/hunt/combate.mjs');
  const golpe = async (gelido) => {
    const { e, b } = await montar('Flame_Surge');
    e.equipment.weapon.poe.af = { ...(e.equipment.weapon.poe.af ?? {}), fisico_ignora_escudo: 1 };
    e.equipment.body = peca('Body_Armours/Arcane_Vestment');
    Ficha.invalidar(e);
    Afixos.sincronizarMaximos(e);
    e.maxHp = e.hp = 1e7;
    const es = Ficha.combate(e).energyShield;
    e.es = es;
    const h = e.hunt;
    if (gelido) (h.a2 ??= {}).escudoGelido = { x: h.pos.x, y: h.pos.y, z: h.z ?? 0, ate: h.clock + 60_000, vida: 1e9, a2: { dentroPct: 50, foraPct: 50 } };
    const antes = M.CONFIG.porEspecie.especies;
    M.CONFIG.porEspecie.especies = { ...(antes ?? {}), [b.key]: { ...(antes?.[b.key] ?? {}), danoExtra: [{ elemento: 'fire', min: 60, max: 60 }] } };
    try { travado(0.99, () => { for (let i = 0; i < 20 && e.hp === 1e7; i++) contraAtaque(e, h, PERSONAGEM, b, []); }); } finally { M.CONFIG.porEspecie.especies = antes; }
    return { vida: 1e7 - e.hp, escudo: es - e.es };
  };
  const sem = await golpe(false);
  const com = await golpe(true);
  assert.ok(sem.vida > 0 && com.vida > 0, JSON.stringify({ sem, com }));
  // a fração que vai direto à Vida (o Físico) é a mesma com e sem o Gélido: ele leva a parte dele de cada tipo
  const fr = (x) => x.vida / (x.vida + x.escudo);
  assert.ok(sem.escudo < 200 && Math.abs(fr(com) - fr(sem)) < 0.05, JSON.stringify({ sem, com, frSem: fr(sem), frCom: fr(com) }));
});
