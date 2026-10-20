// (lote A1b, dono 19/10) A INVESTIDA CARREGADA (o Avanço Fantasma e o Impulso Energizado da Projeção) e o resto das gemas de movimento do PoE que o A1
// deixou parciais. As decisões do dono: I1 (a miragem libera quando para; "Segurar a miragem no alvo" a mantém pulsando com +150%), I2 (3,8 m/s × a
// Velocidade de Movimento × 1,3), I3 (rumo ao alvo, contorna, a parede a para), I4/I5/I6 (o pulso em volta dela, nos usos 1, 3, 5…, no raio de 1,2 m
// + 0,2 m por estágio até 2,2 m), I7 (outra habilidade libera), D-a (a carga que pula a recarga), D-b (a Emboscada), D-c (a fila do Teleporte
// Relampejante), D-d (Trespassar), D-e (a Corrida de Fase), D-f (a Causticação do Avanço Ardente do Retorno). Os sorteios ficam travados.
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
const M = await import('../systems/itens-poe/movimento-a1b.mjs');
const CargasPoe = await import('../systems/itens-poe/cargas.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Registro = await import('../systems/combate/registro.mjs');

let J;
let gerarPeca;
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const perto = (a, b, tol = 0.02) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

/** Roda `fn` com o `Math.random` travado em `v` (os sorteios do golpe, do raio e das chances). */
function travado(v, fn) {
  const antes = Math.random;
  Math.random = () => v;
  try { return fn(); } finally { Math.random = antes; }
}
/**
 * O personagem com as gemas (nível 20, `qualidade`) na arma (a espada com escudo, ou `arma`), numa caçada; o alvo imortal a `dx` casas a leste (a 8,
 * a nordeste — as casas andáveis da praia) e os outros bichos longe.
 */
async function montar(slugs, dx = 2, { qualidade = 0, arma = 'One_Hand_Swords/Rusted_Sword', escudo = 'Shields/Splintered_Tower_Shield', acao = {} } = {}) {
  J ??= await import('../systems/itens-poe/jogo.mjs');
  gerarPeca ??= (await import('../systems/itens-poe/gerar.mjs')).gerarPeca;
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Scion', sistema: 'poe' });
  const a = peca(arma);
  a.soquetes = { abertos: slugs.length, links: Array(Math.max(0, slugs.length - 1)).fill(false), gemas: Array(slugs.length).fill(null), cores: Array(slugs.length).fill('W') };
  e.equipment = { ...e.equipment, weapon: a };
  if (escudo) e.equipment.shield = peca(escudo);
  else delete e.equipment.shield;
  e.inventory = slugs.map((s) => GS.itemDaGema({ id: G.doSlug(s).itemId, nivel: 20, xp: 0, raridade: 'comum', qualidade }));
  for (let i = 0; i < slugs.length; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  e.actions = Array(Acoes.SLOTS).fill(null);
  slugs.forEach((s, i) => (e.actions[i] = { id: G.doSlug(s).acao, enabled: true, minMana: 0, conditions: [], ...acao }));
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  // (os bichos nascem com a raridade sorteada no entrar: travada, para os dois personagens de uma comparação terem o mesmo alvo)
  assert.ok(travado(0.5, () => Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' })).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 1e7;
  e.maxHp = e.hp = 1e7;
  const [b, ...resto] = e.hunt.monstros;
  for (const m of resto) Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60 });
  Object.assign(b, { x: e.hunt.pos.x + dx, y: e.hunt.pos.y - (dx > 5 ? 6 : 0), hp: 1e12, maxHp: 1e12, estados: {} });
  return { e, b, resto, de: { x: e.hunt.pos.x, y: e.hunt.pos.y } };
}
/** Usa o slot no instante em que o relógio comum libera (com a conjuração até o fim): `{ r, eventos }`. */
function usar(e, slot, alvo, { manual = true, esperar = true } = {}) {
  if (esperar) e.hunt.clock = Math.max(e.hunt.clock, e.hunt.cooldowns?.[Acoes.GRUPO_DO_POE]?.ate ?? 0);
  const r = Acoes.disparar(e, e.hunt, PERSONAGEM, slot, alvo, { manual });
  const eventos = [...(r.eventos ?? [])];
  if (r.ok && e.hunt.conjurando && esperar) {
    e.hunt.clock = e.hunt.conjurando.fim;
    eventos.push(...Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM));
  }
  return { r, eventos };
}
/** Os % de golpe dos acertos da gema em `b` durante `fn` (o registro dos golpes — `porcentagemDoGolpe`: o 100% do pulso, o +150%, a onda final). */
function pctsEm(b, fn) {
  Registro.definirNivel(2);
  Registro.limparRegistro();
  try { fn(); } finally { Registro.definirNivel(0); }
  return Registro.ultimosGolpes(200).filter((g) => g.origem === 'gema' && g.alvo === b.name).map((g) => Math.round(g.detalhe?.porcentagemDoGolpe ?? 0));
}
const danoNo = (eventos, b) => eventos.filter((x) => x.t === 'dmg' && x.uid === b.uid && x.foe).reduce((t, x) => t + (x.v ?? 0), 0);
const primeiroDano = (eventos, b) => eventos.find((x) => x.t === 'dmg' && x.uid === b.uid && x.foe)?.v ?? 0;

test('A1b: os números da Investida Carregada no nível 20 — 15 estágios, a onda de 75% (125% e 145% na Projeção), o raio de 1,2 a 2,2 m, a velocidade 1,3/1,5', { skip: SEM }, () => {
  const m = G.miragemDaGema('Charged_Dash', 20, 0);
  assert.deepEqual([m.maxEstagios, m.finalPorEstagioPct, m.paradaMaisPct, m.teleporta, m.distanciaM], [15, 75, 150, true, 6.2]);
  assert.ok(perto(m.velMult, 1.3, 1e-9) && perto(G.miragemDaGema('Charged_Dash', 20, 20).velMult, 1.5, 1e-9), 'a qualidade: +1% da velocidade da miragem por ponto');
  const p = G.miragemDaGema('Charged_Dash_of_Projection', 20, 0);
  assert.deepEqual([p.finalPorEstagioPct, G.miragemDaGema('Charged_Dash_of_Projection', 20, 20).finalPorEstagioPct, p.teleporta], [125, 145, false]);
  assert.ok(perto(p.velMult, 1.5, 1e-9));
  // (I6: o poedb 3.29 — "AoE Radius 12-22, 2/stage")
  assert.deepEqual([0, 1, 5, 15].map((n) => Math.round(M.raioDaMiragemM(m, n) * 10) / 10), [1.2, 1.4, 2.2, 2.2]);
  // (I2: 3,8 m/s × (1 + a Velocidade de Movimento aumentada) × 1,3)
  assert.ok(perto(M.velocidadeDaMiragem(m, 1), 4.94, 1e-9) && perto(M.velocidadeDaMiragem(m, 1.5), 7.41, 1e-9));
  // (I5: os usos 1, 3, 5…)
  assert.deepEqual([1, 2, 3, 4, 5].map((n) => M.pulsaNoUso(m, n)), [true, false, true, false, true]);
  assert.equal(G.miragemDaGema('Cleave', 20), null);
});

test('A1b (I3): a miragem anda rumo ao alvo pela grade (1 casa = 2 m), contorna o alvo até os 6,2 m e para na parede', () => {
  const zero = { pos: { x: 0, y: 0 }, andadoM: 0, caminho: [{ x: 0, y: 0 }], parou: false, chegou: false, rumo: null };
  // (o alvo longe: 2 m por uso, uma casa por uso; nos 6,2 m, para)
  let m = M.andarMiragem(zero, 2, { alvo: { x: 9, y: 0 } });
  assert.deepEqual([m.pos, m.moveu, m.parou], [{ x: 1, y: 0 }, true, false]);
  m = M.andarMiragem(M.andarMiragem(m, 2, { alvo: { x: 9, y: 0 } }), 2.5, { alvo: { x: 9, y: 0 } });
  assert.deepEqual([m.pos, m.parou, Math.round(m.andadoM * 10) / 10], [{ x: 3, y: 0 }, true, 6.2]);
  assert.equal(M.andarMiragem(m, 2, { alvo: { x: 9, y: 0 } }).moveu, false, 'parada, não anda mais');
  // (o alvo colado: chega nele e contorna — as casas em volta, no sentido horário, seguindo o rumo)
  let c = M.andarMiragem(zero, 2, { alvo: { x: 1, y: 0 } });
  assert.deepEqual([c.pos, c.chegou], [{ x: 1, y: 0 }, true]);
  c = M.andarMiragem(c, 2, { alvo: { x: 1, y: 0 } });
  assert.deepEqual(c.pos, { x: 2, y: 0 });
  c = M.andarMiragem(c, 2.2, { alvo: { x: 1, y: 0 } });
  assert.deepEqual([c.pos, c.parou], [{ x: 2, y: 1 }, true]);
  // (a parede em x = 2: para na casa de antes, com os metros até a metade do caminho — o uso ainda andou)
  const parede = (x) => x !== 2;
  let w = M.andarMiragem(zero, 2, { alvo: { x: 9, y: 0 }, andavel: parede });
  w = M.andarMiragem(w, 2, { alvo: { x: 9, y: 0 }, andavel: parede });
  assert.deepEqual([w.pos, w.parou, w.moveu], [{ x: 1, y: 0 }, true, true]);
});

test('A1b (I1/I4/I5): o estágio sobe a cada uso que a miragem anda; o pulso cai em volta dela nos usos 1 e 3; parada, libera — a onda final dá estágios × 75% e você teleporta sem "moveu"', { skip: SEM }, async () => {
  const { e, b } = await montar(['Charged_Dash'], 2);
  let usos;
  const pcts = pctsEm(b, () => { usos = travado(0.5, () => Array.from({ length: 4 }, () => usar(e, 0, b, { manual: false }))); });
  assert.ok(usos.every((u) => u.r.ok), usos.map((u) => u.r.motivo).join());
  const danos = usos.map((u) => danoNo(u.eventos, b));
  assert.deepEqual(danos.map((d) => d > 0), [true, false, true, true], `o pulso nos usos 1 e 3, a onda no 4: ${danos}`);
  // (o pulso sem "mais"; a onda final do 4º uso: 4 estágios × 75% do mesmo golpe — o dano segue o %, a menos do arredondamento)
  assert.deepEqual(pcts, [100, 100, 300], `os % dos acertos: ${pcts}`);
  assert.ok(perto(danos[3] / danos[0], 4 * 0.75, 0.1), `a onda final: ${danos[3]} / ${danos[0]}`);
  // (os 6,2 m a ~1,9 m por uso: 4 usos, 4 estágios; a liberação o leva para a miragem — colada no alvo — sem contar como movimento)
  assert.equal(e.hunt.miragem, null, 'liberada');
  assert.equal(e.hunt.teleportes, 1);
  assert.ok(cheb(e.hunt.pos, b) <= 1, `teleportou para perto do alvo: ${JSON.stringify(e.hunt.pos)}`);
  assert.equal(e.hunt.poeRecente?.moveu, undefined, 'o teleporte da Investida não marca "moveu"');
  // (revisão: nem o tique das condições depois — `hunt.poeUltimaPos` acompanha o teleporte)
  ModsPoe.tique(e, e.hunt, Ficha.combate(e), 250);
  assert.equal(e.hunt.poeRecente?.moveu, undefined, 'o tique das condições não conta o teleporte como passo');
  assert.equal(e.hunt.canalizacao.liberou, true, 'o próximo uso começa um canalizar novo');
  // (o ciclo novo: a miragem nasce de novo em você, no estágio 1)
  travado(0.5, () => usar(e, 0, b, { manual: false }));
  assert.equal(e.hunt.miragem.estagios, 1);
});

test('A1b (I1): "Segurar a miragem no alvo" — parada, o pulso leva +150% (×2,5) enquanto há inimigo na área; sem ninguém, libera', { skip: SEM }, async () => {
  const { e, b } = await montar(['Charged_Dash'], 2, { acao: { segurarMiragem: true } });
  let usos;
  const pcts = pctsEm(b, () => { usos = travado(0.5, () => Array.from({ length: 6 }, () => usar(e, 0, b, { manual: false }))); });
  const danos = usos.map((u) => danoNo(u.eventos, b));
  assert.deepEqual(danos.map((d) => d > 0), [true, false, true, false, true, false], `segurando, sem onda no 4º: ${danos}`);
  assert.ok(e.hunt.miragem?.parou, 'a miragem parou e ficou');
  assert.deepEqual(pcts, [100, 100, 250], `parada, +150%: ${pcts}`);
  assert.ok(perto(danos[4] / danos[0], 2.5, 0.1), `${danos[4]} / ${danos[0]}`);
  assert.equal(e.hunt.teleportes ?? 0, 0);
  // (o alvo foi embora: sem ninguém na área, o uso libera — a onda e o teleporte)
  Object.assign(b, { x: b.x + 30, y: b.y + 30 });
  const solto = travado(0.5, () => usar(e, 0, b, { manual: false }));
  assert.ok(solto.r.ok, solto.r.motivo);
  assert.equal(e.hunt.miragem, null);
  assert.equal(e.hunt.teleportes, 1);
});

test('A1b: a da Projeção libera a miragem sem teleportar você', { skip: SEM }, async () => {
  const { e, b, de } = await montar(['Charged_Dash_of_Projection'], 2);
  const usos = travado(0.5, () => Array.from({ length: 6 }, () => usar(e, 0, b, { manual: false })));
  assert.ok(usos.every((u) => u.r.ok));
  assert.ok(usos.some((u) => danoNo(u.eventos, b) > 0));
  assert.equal(e.hunt.teleportes ?? 0, 0);
  assert.deepEqual({ x: e.hunt.pos.x, y: e.hunt.pos.y }, de);
});

test('A1b (I7): outra habilidade no meio libera a miragem (a onda e o teleporte) e sai de onde você ficou; o canalizar que acaba também libera', { skip: SEM }, async () => {
  const { e, b } = await montar(['Charged_Dash', 'Cleave'], 1);
  travado(0.5, () => { usar(e, 0, b, { manual: false }); usar(e, 0, b, { manual: false }); });
  assert.equal(e.hunt.miragem.estagios, 2);
  const outra = travado(0.5, () => usar(e, 1, b));
  assert.ok(outra.r.ok, outra.r.motivo);
  assert.equal(e.hunt.miragem, null, 'liberada pela Cutilada');
  assert.equal(e.hunt.teleportes, 1);
  assert.ok(danoNo(e.hunt.poeEventosDoTempo ?? [], b) > 0, 'a onda final acertou (os eventos vão no tique)');
  assert.ok(danoNo(outra.eventos, b) > 0, 'a Cutilada saiu');
  // (o canalizar que acabou — nenhum uso dela por mais de um tique — libera no tique da canalização)
  const m2 = await montar(['Charged_Dash'], 2);
  travado(0.5, () => usar(m2.e, 0, m2.b, { manual: false }));
  m2.e.hunt.clock += 2000;
  const ev = [];
  travado(0.5, () => Acoes.tiqueDaCanalizacao(m2.e, m2.e.hunt, PERSONAGEM, ev));
  assert.equal(m2.e.hunt.miragem, null);
  assert.equal(m2.e.hunt.teleportes, 1);
  assert.ok(danoNo(ev, m2.b) > 0);
  // (revisão: andar para longe encerra o canalizar na hora — a onda sai da miragem, sem puxar você de volta)
  const m3 = await montar(['Charged_Dash'], 2);
  travado(0.5, () => { usar(m3.e, 0, m3.b, { manual: false }); usar(m3.e, 0, m3.b, { manual: false }); });
  m3.e.hunt.pos.x -= 6;
  const longe = { x: m3.e.hunt.pos.x, y: m3.e.hunt.pos.y };
  const ev3 = [];
  travado(0.5, () => Acoes.tiqueDaCanalizacao(m3.e, m3.e.hunt, PERSONAGEM, ev3));
  assert.equal(m3.e.hunt.miragem, null, 'andou: liberada');
  assert.deepEqual({ x: m3.e.hunt.pos.x, y: m3.e.hunt.pos.y }, longe, 'sem o teleporte de volta');
  assert.equal(m3.e.hunt.teleportes ?? 0, 0);
});

test('A1b (D-a): na recarga, com a carga, a gema gasta uma e sai — a recarga em curso não recomeça; sem carga, segue na recarga', { skip: SEM }, async () => {
  for (const [slug, tipo] of [['Flicker_Strike', 'frenesi'], ['Flicker_Strike_of_Power', 'poder'], ['Consecrated_Path_of_Endurance', 'tolerancia']]) {
    const { e, b } = await montar([slug], 3);
    const id = G.doSlug(slug).acao;
    e.hunt.cooldowns = { [id]: { ate: e.hunt.clock + 1500, total: 2000 } };
    assert.equal(usar(e, 0, b).r.motivo, 'COOLDOWN', `${slug}: sem carga`);
    e.hunt.cargasPoe = { [tipo]: { n: 1, ate: e.hunt.clock + 10_000 } };
    const ate = e.hunt.cooldowns[id].ate;
    const u = travado(0.5, () => usar(e, 0, b, { esperar: false }));
    assert.ok(u.r.ok, `${slug}: ${u.r.motivo}`);
    assert.equal(CargasPoe.ativas(e)[tipo], 0, `${slug}: gastou a carga`);
    assert.equal(e.hunt.cooldowns[id].ate, ate, `${slug}: a recarga não recomeçou`);
  }
  assert.ok(!G.doSlug('Flicker_Strike').motivosNoJogo.some((m) => /recarga pode ser pulada/.test(m)));
});

test('A1b: o Golpe Súbito — a Velocidade de Ataque por Frenesi e a Frenesi no acerto; o do Poder — o Poder no crítico', { skip: SEM }, async () => {
  const { e, b } = await montar(['Flicker_Strike'], 3);
  const entry = Acoes.POR_ID_PUBLICO(G.doSlug('Flicker_Strike').acao);
  const daGema = () => ModsPoe.somaPorTags(Acoes.comAsLinhasDaGema(e, Ficha.combate(e), entry), Acoes.tagsPoeDaSkill(entry)).atk_speed ?? 0;
  assert.equal(daGema(), 0);
  e.hunt.cargasPoe = { frenesi: { n: 3, ate: e.hunt.clock + 10_000 } };
  Ficha.invalidar(e);
  assert.equal(daGema(), 30, '"Velocidade de Ataque aumentada em 10% por Carga de Frenesi" × 3');
  // (a Frenesi no acerto: 15% — o sorteio travado em 5 ganha, em 99 não)
  const ganha = await montar(['Flicker_Strike'], 3);
  travado(0.05, () => usar(ganha.e, 0, ganha.b));
  assert.equal(CargasPoe.ativas(ganha.e).frenesi, 1);
  const naoGanha = await montar(['Flicker_Strike'], 3);
  travado(0.99, () => usar(naoGanha.e, 0, naoGanha.b));
  assert.equal(CargasPoe.ativas(naoGanha.e).frenesi, 0);
  // (o do Poder: 30% de Poder no crítico — o sorteio em 0 é crítico e ganha; em 99 não é crítico)
  const poder = await montar(['Flicker_Strike_of_Power'], 3);
  travado(0, () => usar(poder.e, 0, poder.b));
  assert.equal(CargasPoe.ativas(poder.e).poder, 1);
  const semPoder = await montar(['Flicker_Strike_of_Power'], 3);
  travado(0.99, () => usar(semPoder.e, 0, semPoder.b));
  assert.equal(CargasPoe.ativas(semPoder.e).poder, 0);
  void b;
});

test('A1b (D-b): a Emboscada — o próximo ataque corpo a corpo de uma mão leva o crítico dela e a gasta, sem gastar o Impelir do Clamor; o alvo fica Cego 3 s', { skip: SEM }, async () => {
  const chance = (e, b, slot) => {
    Registro.definirNivel(1);
    Registro.limparRegistro();
    try { travado(0.5, () => usar(e, slot, b)); } finally { Registro.definirNivel(0); }
    return Registro.ultimosGolpes(20).find((g) => g.origem === 'gema' && g.alvo === b.name)?.chanceCritica;
  };
  const { e, b } = await montar(['Ambush', 'Cleave'], 3);
  const u = travado(0.5, () => usar(e, 0, b));
  assert.ok(u.r.ok, u.r.motivo);
  assert.ok(e.hunt.emboscada?.ate > e.hunt.clock, 'o buff da Emboscada');
  assert.ok(cheb(e.hunt.pos, b) <= 1, 'teleportou para o alvo');
  assert.equal(b.estados.cego?.ate - e.hunt.clock >= 2900, true, `o alvo Cego por 3 s: ${b.estados.cego?.ate - e.hunt.clock}`);
  e.hunt.impelidos = { n: 3, ate: e.hunt.clock + 20_000 };
  const comEmboscada = chance(e, b, 1);
  assert.equal(e.hunt.emboscada, undefined, 'o ataque a gastou');
  assert.equal(e.hunt.impelidos.n, 3, 'o Impelir do Clamor não foi gasto');
  const semEmboscada = chance(e, b, 1);
  assert.equal(e.hunt.impelidos.n, 2, 'o ataque seguinte gasta o do Clamor');
  // (a espada enferrujada: 5% de base; a Emboscada soma +25% na BASE — 30%, × os "aumentados", aqui nenhum)
  assert.ok(perto(semEmboscada, 0.05, 1e-6) && perto(comEmboscada, 0.3, 1e-6), `o crítico da Emboscada (+25% na base): ${semEmboscada} → ${comEmboscada}`);
  // (revisão do dono: a Emboscada IMPELE — os "Ataques Impelidos …" genéricos, como o "se Impelidos" do Sobre-esforço, valem nela; os bônus do buff do
  // Clamor — "Ataques Impelidos causam Dano Dobrado" do Clamor Intimidador — só no Impelido pelo Clamor)
  // (a ficha do ataque corpo a corpo com os atributos `af` como condicionais — `stat@tag` —, pelo caminho do golpe)
  const fichaDoAtaque = (e2, af) => {
    const f = Ficha.combate(e2);
    const extra = Object.entries(af).map(([k, valor]) => { const [stat, cond] = k.split('@'); return { stat, tags: [cond], valor }; });
    return ModsPoe.fichaDoGolpe({ ...f, porTag: [...(f.porTag ?? []), ...extra] }, ['ataque', 'corpo'], { estado: e2 });
  };
  const doClamor = G.clamorPeloPoder('Intimidating_Cry', 20, 0).af;
  assert.equal(doClamor['chance_dano_dobrado@impelidoClamor'], 100, 'o Dano Dobrado do buff do Clamor Intimidador exige o Impelir do Clamor');
  const generico = { 'mais_dano@impelido': 40 };
  e.hunt.impelidos = { n: 2, ate: e.hunt.clock + 20_000 };
  e.hunt.emboscada = { ate: e.hunt.clock + 1000, critPontos: 25, critMultPct: 138, golpe: true };
  const naEmboscada = fichaDoAtaque(e, { ...generico, ...doClamor });
  assert.deepEqual(['impelido', 'impelidoEmboscada', 'impelidoClamor'].map((t) => naEmboscada.tagsDoGolpe.includes(t)), [true, true, false]);
  assert.deepEqual([ModsPoe.valor(naEmboscada, 'mais_dano'), ModsPoe.valor(naEmboscada, 'chance_dano_dobrado')], [40, 0], 'na Emboscada: o genérico vale, o do Clamor não');
  delete e.hunt.emboscada;
  const noClamor = fichaDoAtaque(e, { ...generico, ...doClamor });
  assert.deepEqual(['impelido', 'impelidoEmboscada', 'impelidoClamor'].map((t) => noClamor.tagsDoGolpe.includes(t)), [true, false, true]);
  assert.deepEqual([ModsPoe.valor(noClamor, 'mais_dano'), ModsPoe.valor(noClamor, 'chance_dano_dobrado')], [40, 100], 'no Impelido pelo Clamor: os dois')
  // (com arma de duas mãos, o ataque não a gasta)
  const duas = await montar(['Ambush', 'Cleave'], 3, { arma: 'Two_Hand_Axes/Stone_Axe', escudo: null });
  travado(0.5, () => usar(duas.e, 0, duas.b));
  assert.ok(duas.e.hunt.emboscada);
  travado(0.5, () => usar(duas.e, 1, duas.b));
  assert.ok(duas.e.hunt.emboscada, 'duas mãos: segue');
});

test('A1b: o Teleporte Gélido da Explosão Invernal — ×1,9 contra 30% de Resfriamento (no q0), o Resfriamento some e ele não resfria', { skip: SEM }, async () => {
  const resfriado = await montar(['Frostblink_of_Wintry_Blast'], 1);
  resfriado.b.estados.lento = { ate: resfriado.e.hunt.clock + 60_000, pct: 30 };
  const comFrio = travado(0.5, () => usar(resfriado.e, 0, resfriado.b));
  const normal = await montar(['Frostblink_of_Wintry_Blast'], 1);
  const semFrio = travado(0.5, () => usar(normal.e, 0, normal.b));
  assert.ok(comFrio.r.ok && semFrio.r.ok, `${comFrio.r.motivo} ${semFrio.r.motivo}`);
  const doFrio = comFrio.eventos.filter((x) => x.t === 'dmg' && x.uid === resfriado.b.uid).map((x) => x.v);
  assert.ok(perto(primeiroDano(comFrio.eventos, resfriado.b) / primeiroDano(semFrio.eventos, normal.b), 1.9, 0.03), `${doFrio} / ${primeiroDano(semFrio.eventos, normal.b)}`);
  // (as duas pontas acertam o alvo: a primeira com o Resfriamento — × 1,9 —, a segunda já sem ele)
  assert.ok(doFrio.length === 2 && perto(doFrio[0] / doFrio[1], 1.9, 0.03), `${doFrio}`);
  assert.equal(resfriado.b.estados.lento, undefined, '"Remove Resfriamentos após Causar Dano"');
  assert.equal(normal.b.estados.lento, undefined, '"Não pode infligir Resfriamento"');
  assert.equal(G.explosaoInvernalDaGema('Frostblink_of_Wintry_Blast', 20, 20).porCada5Pct, 19, 'a qualidade: +4% por degrau no q20');
});

test('A1b (D-c): o Teleporte Relampejante na fila — o segundo, lançado na espera do primeiro, parte do destino dele e sai em seguida', { skip: SEM }, async () => {
  const { e, b, de } = await montar(['Lightning_Warp'], 8);
  const primeiro = travado(0.5, () => usar(e, 0, b, { esperar: false }));
  assert.ok(primeiro.r.ok && e.hunt.conjurando, primeiro.r.motivo);
  const c1 = e.hunt.conjurando;
  assert.ok(c1.castFim < c1.fim, 'a conjuração e a espera');
  // (ainda conjurando: não entra na fila)
  assert.equal(travado(0.5, () => usar(e, 0, b, { esperar: false })).r.motivo, 'CONJURANDO');
  e.hunt.clock = c1.castFim;
  const segundo = travado(0.5, () => usar(e, 0, b, { esperar: false }));
  assert.ok(segundo.r.ok && segundo.r.conjurando, segundo.r.motivo);
  assert.equal(e.hunt.filaDoTeleporte.length, 1);
  const c2 = e.hunt.filaDoTeleporte[0];
  assert.deepEqual(c2.deslocamento.de, c1.deslocamento.para, 'parte do destino do primeiro');
  assert.ok(c2.fim > c1.fim);
  e.hunt.clock = c1.fim;
  travado(0.5, () => Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM));
  assert.deepEqual({ x: e.hunt.pos.x, y: e.hunt.pos.y }, c1.deslocamento.para);
  assert.equal(e.hunt.conjurando, c2, 'o da fila assume');
  e.hunt.clock = c2.fim;
  travado(0.5, () => Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM));
  assert.deepEqual({ x: e.hunt.pos.x, y: e.hunt.pos.y }, c2.deslocamento.para);
  assert.equal(e.hunt.teleportes, 2);
  assert.ok(cheb(e.hunt.pos, de) > cheb(c1.deslocamento.para, de));
  assert.equal(G.filaDoTeleporteDaGema('Lightning_Warp', 20), 50);
});

test('A1b: a Corrente com Gancho com 30 de Fúria tem 3,0 m de raio (+0,1 m por 5 de Fúria)', { skip: SEM }, async () => {
  assert.ok(perto(G.areaNoNivel('Chain_Hook', 20).raioM + M.raioExtraPelaFuria(G.raioPorFuriaDaGema('Chain_Hook', 20), 30), 3.0, 1e-9));
  assert.equal(M.raioExtraPelaFuria(G.raioPorFuriaDaGema('Chain_Hook', 20), 9), 0.1);
  // (na caçada: 3,0 m = 1,5 casa — o sorteio travado em 0,4 dá 2 casas; 2,4 m = 1,2 casa dá 1: o bicho a 2 casas do alvo só leva com a Fúria)
  const acertou = async (furia) => {
    const { e, b, resto } = await montar(['Chain_Hook'], 3);
    const outro = resto[0];
    Object.assign(outro, { x: b.x + 2, y: b.y, hp: 1e12, maxHp: 1e12, estados: {} });
    if (furia) e.hunt.furia = { n: furia, ganhou: e.hunt.clock, perdeu: e.hunt.clock };
    const u = travado(0.4, () => usar(e, 0, b));
    assert.ok(u.r.ok, u.r.motivo);
    return danoNo(u.eventos, outro) > 0;
  };
  assert.deepEqual([await acertou(0), await acertou(30)], [false, true]);
});

test('A1b: a Investida com Escudo — o atordoamento na distância máxima (75% × casas ÷ máximo)', { skip: SEM }, async () => {
  assert.equal(G.atordoamentoDaInvestidaDaGema('Shield_Charge', 20), 75);
  // (o golpe da investida de 3 casas — o máximo —: primeiro sem poder atordoar, para saber o dano; depois, com a vida em que o atordoamento sem a redução
  // ficaria em 40% — o sorteio travado em 50 não atordoaria —, e com os 75% vira 160%: atordoa)
  const passo1 = await montar(['Shield_Charge'], 4);
  passo1.b.imuneAtordoamento = true;
  const d = primeiroDano(travado(0.5, () => usar(passo1.e, 0, passo1.b)).eventos, passo1.b);
  assert.ok(d > 0);
  const passo2 = await montar(['Shield_Charge'], 4);
  const vida = Math.round((200 * d) / 40);
  Object.assign(passo2.b, { hp: vida, maxHp: vida });
  const u = travado(0.5, () => usar(passo2.e, 0, passo2.b));
  assert.ok(u.r.ok, u.r.motivo);
  assert.ok(passo2.b.estados.atordoado?.ate > passo2.e.hunt.clock - 1000, 'atordoou');
});

test('A1b (D-e): a Corrida de Fase — 3 Frenesis dão 7,2 s; o próximo uso troca o buff pelos 30% de Dano Físico Corpo a Corpo e já os recebe', { skip: SEM }, async () => {
  const { e, b } = await montar(['Old_Phase_Run', 'Cleave'], 1);
  const id = G.doSlug('Old_Phase_Run').acao;
  e.hunt.cargasPoe = { frenesi: { n: 3, ate: e.hunt.clock + 10_000 } };
  const u = usar(e, 0, b);
  assert.ok(u.r.ok, u.r.motivo);
  assert.equal(CargasPoe.ativas(e).frenesi, 0, 'removeu as Frenesis');
  assert.equal(e.hunt.buffs[id].ate - e.hunt.clock, 7200, '1,8 s × (1 + 3)');
  assert.equal(Acoes.trespassando(e, e.hunt), true, 'o buff concede Trespassar');
  const comFase = travado(0.5, () => usar(e, 1, b));
  assert.ok(e.hunt.buffs[id].faseDois, 'trocou');
  assert.ok(e.hunt.buffs[id].ate - e.hunt.clock <= 200);
  assert.equal(Acoes.trespassando(e, e.hunt), false);
  const sem = await montar(['Old_Phase_Run', 'Cleave'], 1);
  const semFase = travado(0.5, () => usar(sem.e, 1, sem.b));
  assert.ok(perto(danoNo(comFase.eventos, b) / danoNo(semFase.eventos, sem.b), 1.3, 0.03), `${danoNo(comFase.eventos, b)} / ${danoNo(semFase.eventos, sem.b)}`);
});

test('A1b (D-d): Trespassar — o passo pula por cima do bicho no corredor (sem ele, fica parado)', () => {
  const grade = { andavel: new Set(Array.from({ length: 8 }, (_, x) => `${x},0`)), minX: 0, maxX: 7, minY: 0, maxY: 0 };
  const bichos = new Set(['2,0']);
  assert.deepEqual(Acoes.passoTrespassando(grade, { x: 1, y: 0 }, { x: 7, y: 0 }, bichos), { x: 3, y: 0 });
  assert.deepEqual(Acoes.passoTrespassando(grade, { x: 0, y: 0 }, { x: 7, y: 0 }, bichos), { x: 1, y: 0 });
  // (revisão: o destino livre logo depois do bicho é o passo — o clique atrás dele; o destino que é casa de alguém — o aliado seguido, outro bicho —, não)
  assert.deepEqual(Acoes.passoTrespassando(grade, { x: 1, y: 0 }, { x: 3, y: 0 }, bichos), { x: 3, y: 0 });
  assert.equal(Acoes.passoTrespassando(grade, { x: 1, y: 0 }, { x: 3, y: 0 }, bichos, { destinoOcupado: true }), null);
  assert.equal(Acoes.passoTrespassando(grade, { x: 1, y: 0 }, { x: 3, y: 0 }, new Set(['2,0', '3,0'])), null);
});

test('A1b (D-d, revisão): na caçada, com a Corrida de Fase ligada, a tecla e o clique passam por cima do bicho no caminho', { skip: SEM }, async () => {
  const pela = async (como) => {
    const { e, b } = await montar(['Old_Phase_Run'], 1);
    e.hunt.modo = 'online';
    assert.ok(usar(e, 0, b).r.ok);
    assert.equal(Acoes.trespassando(e, e.hunt), true);
    const de = { x: e.hunt.pos.x, y: e.hunt.pos.y };
    if (como === 'tecla') Object.assign(e.hunt, { rumo: { dx: 1, dy: 0 }, rumoValidoAte: Infinity });
    else assert.ok(Cacadas.andarAte(e, { x: de.x + 2, y: de.y }).ok);
    e.hunt.proximoPassoEm = 0;
    b.imuneAtordoamento = true;
    Cacadas.tique(e, PERSONAGEM, Date.now());
    return { de, pos: { x: e.hunt.pos.x, y: e.hunt.pos.y }, b: { x: b.x, y: b.y } };
  };
  for (const como of ['tecla', 'clique']) {
    const r = await pela(como);
    assert.ok(r.pos.x >= r.de.x + 2 && r.pos.y === r.de.y, `${como}: ${JSON.stringify(r)}`);
  }
});

test('A1b (D-f): o Avanço Ardente do Retorno no q20 — 20% de chance de Causticar (o sorteio travado em 5 causticou)', { skip: SEM }, async () => {
  assert.equal(G.chanceDeCausticarDaGema('Flame_Dash_of_Return', 20, 20), 20);
  const { e, b } = await montar(['Flame_Dash_of_Return'], 2, { qualidade: 20 });
  // (a força da Causticação é pelo dano de Fogo × a vida do alvo: a vida máxima pequena, a vida que não acaba)
  Object.assign(b, { maxHp: 5000, hp: 1e9 });
  const u = travado(0.05, () => usar(e, 0, b));
  assert.ok(u.r.ok, u.r.motivo);
  assert.ok(b.estados.causticado?.ate > e.hunt.clock, JSON.stringify([b.estados, danoNo(u.eventos, b), u.eventos.map((x) => x.t), b.x - e.hunt.pos.x]));
});

test('A1b: o status — as 13 gemas saem de parcial', { skip: SEM }, () => {
  const slugs = ['Charged_Dash', 'Charged_Dash_of_Projection', 'Flicker_Strike', 'Flicker_Strike_of_Power', 'Consecrated_Path_of_Endurance', 'Ambush', 'Frostblink_of_Wintry_Blast', 'Lightning_Warp', 'Chain_Hook', 'Shield_Charge', 'Old_Phase_Run', 'Withering_Step', 'Flame_Dash_of_Return'];
  for (const s of slugs) assert.equal(G.doSlug(s).statusNoJogo, 'funciona', `${s}: ${G.doSlug(s).motivosNoJogo.join(' | ')}`);
  assert.equal(Acoes.POR_ID_PUBLICO(G.doSlug('Charged_Dash').acao).poeGema.miragem, true, 'o "Configurar ação" mostra a opção da miragem');
});
