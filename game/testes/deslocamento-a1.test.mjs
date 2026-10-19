// (lote A1, dono 19/10) O DESLOCAMENTO das gemas de movimento do PoE: o salto, a investida e o teleporte movem o personagem (antes era o golpe na
// área a até 7 casas, sem sair do lugar). As decisões do dono: D1 (o ataque salta até o alvo fora do alcance corpo a corpo; colado, golpe no
// lugar; a viagem cobre distância até o alvo a pelo menos a distância do salto), D2 (fugir só com a opção "para longe" do slot), D3 (as
// distâncias), D4 (não atravessa parede, passa por cima de bicho, não pousa em casa ocupada), D5 (o de Retorno volta), D6 (a Vaal do Teleporte
// leva os bichos), D7 (a Corrida de Fase e o Passo Definhante são buffs).
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
const D = await import('../systems/itens-poe/deslocamento.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const { resistido } = await import('../systems/hunt/resistencia.mjs');

let J;
let gerarPeca;
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/**
 * O personagem com as gemas (nível 20) na espada com escudo, numa caçada; o alvo imortal a `dx` casas (a leste; a 8, a nordeste — as casas
 * andáveis da praia, perto da entrada) e os outros bichos longe.
 */
async function montar(slugs, dx = 1, { direcao = null } = {}) {
  J ??= await import('../systems/itens-poe/jogo.mjs');
  gerarPeca ??= (await import('../systems/itens-poe/gerar.mjs')).gerarPeca;
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Scion', sistema: 'poe' });
  const a = peca('One_Hand_Swords/Rusted_Sword');
  a.soquetes = { abertos: slugs.length, links: Array(Math.max(0, slugs.length - 1)).fill(false), gemas: Array(slugs.length).fill(null), cores: Array(slugs.length).fill('W') };
  e.equipment = { ...e.equipment, weapon: a, shield: peca('Shields/Splintered_Tower_Shield') };
  e.inventory = slugs.map((s) => GS.itemDaGema({ id: G.doSlug(s).itemId, nivel: 20, xp: 0, raridade: 'comum' }));
  for (let i = 0; i < slugs.length; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  e.actions = Array(Acoes.SLOTS).fill(null);
  slugs.forEach((s, i) => (e.actions[i] = { id: G.doSlug(s).acao, enabled: true, minMana: 0, conditions: [], ...(direcao ? { direcao } : {}) }));
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 1e7;
  e.maxHp = e.hp = 1e7;
  const [b, ...resto] = e.hunt.monstros;
  for (const m of resto) Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60 });
  Object.assign(b, { x: e.hunt.pos.x + dx, y: e.hunt.pos.y - (dx > 5 ? 6 : 0), hp: 1e12, maxHp: 1e12, estados: {} });
  return { e, b, de: { x: e.hunt.pos.x, y: e.hunt.pos.y } };
}
/** Usa o slot (com a conjuração até o fim) e devolve `{ r, eventos }`. */
function usar(e, slot, alvo, { manual = true } = {}) {
  const r = Acoes.disparar(e, e.hunt, PERSONAGEM, slot, alvo, { manual });
  const eventos = [...(r.eventos ?? [])];
  if (r.ok && e.hunt.conjurando) {
    e.hunt.clock = e.hunt.conjurando.fim;
    eventos.push(...Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM));
  }
  return { r, eventos };
}
const danoNo = (eventos, b) => eventos.filter((x) => x.t === 'dmg' && x.uid === b.uid && x.foe).reduce((t, x) => t + (x.v ?? 0), 0);

test('A1 (D3): as distâncias — com fonte (Salto 6 m, Piscar Gélido 4,2 m +2%/nível) e as do dono (3 casas; Teleporte 4; o Salto Fendedor 2)', { skip: SEM }, async () => {
  await import('../systems/itens-poe/gemas-poe.mjs').then((m) => m.iniciar?.({ registrarGema: () => {}, registrarReforco: () => {} }));
  const m = (s, n) => G.deslocamentoDaGema(s, n, 0).maxM;
  assert.equal(m('Leap_Slam', 20), 6);
  assert.equal(m('Shield_Charge', 20), 6);
  assert.equal(m('Leap_Slam_of_Groundbreaking', 20), 4);
  assert.equal(m('Lightning_Warp', 20), 8);
  assert.equal(m('Quickstep', 20), 6);
  assert.ok(Math.abs(m('Frostblink', 1) - 4.2) < 1e-9, 'Piscar Gélido nível 1: 4,2 m');
  assert.ok(Math.abs(m('Frostblink', 20) - 4.2 * 1.38) < 1e-9, 'Piscar Gélido nível 20: 5,8 m (+38%)');
  assert.ok(Math.abs(m('Dash', 20) - 6 * 1.57) < 1e-9, 'Avanço nível 20: +57% de distância');
  // (em casas: os metros ÷ 2, a fração é a chance de uma casa a mais)
  assert.equal(D.casasDosMetros(5.8, () => 0.95), 2);
  assert.equal(D.casasDosMetros(5.8, () => 0.5), 3);
  assert.equal(G.deslocamentoDaGema('Old_Phase_Run', 20), null, 'a Corrida de Fase não desloca (D7)');
  assert.equal(G.deslocamentoDaGema('Withering_Step', 20), null, 'o Passo Definhante não desloca (D7)');
});

test('A1 (D4): não atravessa parede, passa por cima de bicho, não pousa em casa ocupada nem fora da grade (a zona segura)', () => {
  // uma parede em x = 2 (sem porta perto): o alvo do outro lado não se alcança em 3 casas
  const parede = (x, y) => x !== 2 || Math.abs(y) > 20;
  assert.equal(D.escolherDestino({ pos: { x: 0, y: 0 }, alvo: { x: 4, y: 0 }, max: 3, modo: 'ate_alvo', andavel: parede }).motivo, 'FORA_DE_ALCANCE');
  // sem a parede, com dois bichos no caminho: passa por cima e pousa colado no alvo
  const bichos = [{ x: 1, y: 0 }, { x: 2, y: 0 }];
  const ocupada = (x, y) => bichos.some((b) => b.x === x && b.y === y);
  const r = D.escolherDestino({ pos: { x: 0, y: 0 }, alvo: { x: 4, y: 0 }, max: 3, modo: 'ate_alvo', ocupada });
  assert.deepEqual(r.para, { x: 3, y: 0 });
  // as casas coladas no alvo, ao alcance, todas ocupadas: não pousa
  const cerco = [{ x: 3, y: 0 }, { x: 3, y: 1 }, { x: 3, y: -1 }];
  assert.equal(D.escolherDestino({ pos: { x: 0, y: 0 }, alvo: { x: 4, y: 0 }, max: 3, modo: 'ate_alvo', ocupada: (x, y) => cerco.some((b) => b.x === x && b.y === y) }).motivo, 'FORA_DE_ALCANCE');
  // a casa fora da grade (a zona segura sai da grade do jogador) não é destino
  const semSegura = (x, y) => !(x === 3 && y === 0);
  const s = D.escolherDestino({ pos: { x: 0, y: 0 }, alvo: { x: 4, y: 0 }, max: 3, modo: 'ate_alvo', andavel: semSegura });
  assert.notDeepEqual(s.para, { x: 3, y: 0 });
  assert.ok(cheb(s.para, { x: 4, y: 0 }) <= 1);
});

test('A1 (D1/D2): a viagem cobre a distância até o alvo; perto, não sai; "para longe" só com a opção; o Passo Rápido para no bicho', () => {
  const viagem = D.escolherDestino({ pos: { x: 0, y: 0 }, alvo: { x: 10, y: 0 }, max: 3, modo: 'viagem', querDistancia: 1 });
  assert.deepEqual(viagem.para, { x: 3, y: 0 });
  // a "Distância" da barra: pousa sem passar dela
  const deLonge = D.escolherDestino({ pos: { x: 0, y: 0 }, alvo: { x: 4, y: 0 }, max: 3, modo: 'viagem', querDistancia: 3 });
  assert.ok(cheb(deLonge.para, { x: 4, y: 0 }) >= 3, JSON.stringify(deLonge));
  assert.equal(D.escolherDestino({ pos: { x: 0, y: 0 }, alvo: { x: 2, y: 0 }, max: 3, modo: 'viagem' }).motivo, 'ALVO_PERTO');
  const colado = [{ x: 1, y: 0 }];
  // sem a opção de fuga na gema (`fuga`), "longe" não vale: o alvo colado não faz a viagem sair
  assert.equal(D.escolherDestino({ pos: { x: 0, y: 0 }, alvo: colado[0], max: 3, modo: 'viagem', direcao: 'longe', vivos: colado }).motivo, 'ALVO_PERTO');
  const foge = D.escolherDestino({ pos: { x: 0, y: 0 }, alvo: colado[0], max: 3, modo: 'viagem', direcao: 'longe', fuga: true, vivos: colado, ocupada: (x, y) => x === 1 && y === 0 });
  assert.ok(cheb(foge.para, colado[0]) >= 3, `fugiu para ${JSON.stringify(foge.para)}`);
  assert.equal(D.escolherDestino({ pos: { x: 0, y: 0 }, alvo: { x: 9, y: 0 }, max: 3, modo: 'viagem', direcao: 'longe', fuga: true, vivos: [{ x: 9, y: 0 }] }).motivo, 'SEM_BICHO_PERTO');
  // o Passo Rápido: um bicho na reta, a 2 casas — para antes dele
  const passo = D.escolherDestino({ pos: { x: 0, y: 0 }, alvo: { x: 10, y: 0 }, max: 3, modo: 'viagem', paraNoBicho: true, vivos: [{ x: 2, y: 0 }] });
  assert.deepEqual(passo.para, { x: 1, y: 0 });
});

test('A1 (D1): o Salto Impactante salta até o alvo fora do alcance corpo a corpo; colado, golpe no lugar; longe demais, não sai', { skip: SEM }, async () => {
  const longe = await montar(['Leap_Slam'], 4);
  const ondeEstava = { x: longe.b.x, y: longe.b.y };
  const { r } = usar(longe.e, 0, longe.b);
  assert.ok(r.ok, r.erro);
  // (colado na casa em que o alvo estava — o empurrão da queda pode tê-lo afastado uma casa)
  assert.ok(cheb(longe.e.hunt.pos, ondeEstava) <= 1, `pousou colado no alvo: ${JSON.stringify(longe.e.hunt.pos)}`);
  assert.equal(longe.e.hunt.teleportes, 1);
  // (o snapshot leva o contador, para a tela desenhar o teleporte)
  assert.equal(Cacadas.snapshotDaHunt(longe.e).player.teleporte, 1);
  const demais = await montar(['Leap_Slam'], 8);
  assert.equal(usar(demais.e, 0, demais.b).r.motivo, 'FORA_DE_ALCANCE');
  assert.deepEqual({ x: demais.e.hunt.pos.x, y: demais.e.hunt.pos.y }, demais.de);
  let dano = 0;
  for (let i = 0; i < 4 && !dano; i++) {
    const perto = await montar(['Leap_Slam'], 1);
    const u = usar(perto.e, 0, perto.b);
    assert.ok(u.r.ok, u.r.erro);
    assert.deepEqual({ x: perto.e.hunt.pos.x, y: perto.e.hunt.pos.y }, perto.de, 'colado: não sai do lugar');
    dano += danoNo(u.eventos, perto.b);
  }
  assert.ok(dano > 0, 'o golpe no lugar acerta o alvo colado');
  // o empurrão do Salto (o PoB: `leap_slam_always_knockback_within_range`): o alvo acertado vai uma casa para longe
  let empurrou = false;
  for (let i = 0; i < 6 && !empurrou; i++) {
    const k = await montar(['Leap_Slam'], 4);
    const antes = { x: k.b.x, y: k.b.y };
    const u = usar(k.e, 0, k.b);
    if (u.r.ok && danoNo(u.eventos, k.b) > 0) empurrou = k.b.x !== antes.x || k.b.y !== antes.y;
  }
  assert.ok(empurrou, 'empurrou o alvo');
});

test('A1 (D1): a viagem automática do Avanço cobre a distância até o alvo longe e não sai com ele perto', { skip: SEM }, async () => {
  const longe = await montar(['Dash'], 8);
  const { r } = usar(longe.e, 0, longe.b, { manual: false });
  assert.ok(r.ok, r.erro);
  assert.ok(cheb(longe.e.hunt.pos, longe.b) < 8, `chegou mais perto: ${JSON.stringify(longe.e.hunt.pos)}`);
  const perto = await montar(['Dash'], 2);
  assert.equal(usar(perto.e, 0, perto.b, { manual: false }).r.motivo, 'ALVO_PERTO');
  assert.deepEqual({ x: perto.e.hunt.pos.x, y: perto.e.hunt.pos.y }, perto.de);
});

test('A1 (D2): "para longe" é guardado no slot e faz o Avanço fugir do bicho colado; sem a opção, nunca foge', { skip: SEM }, async () => {
  const m = await montar(['Dash'], 1);
  const id = G.doSlug('Dash').acao;
  assert.ok(Acoes.definir(m.e, { slot: 0, value: { id, direcao: 'longe', conditions: [{ kind: 'stat', who: 'self', stat: 'hp', op: 'lte', value: 100, percent: true }] } }).ok);
  assert.equal(m.e.actions[0].direcao, 'longe');
  assert.ok(Acoes.definir(m.e, { slot: 1, value: { id, direcao: 'qualquer' } }).ok);
  assert.equal(m.e.actions[1].direcao, undefined, 'o valor desconhecido não entra');
  const { r } = usar(m.e, 0, m.b, { manual: false });
  assert.ok(r.ok, r.erro);
  assert.ok(cheb(m.e.hunt.pos, m.b) > 1, `fugiu: ${JSON.stringify(m.e.hunt.pos)}`);
  const sem = await montar(['Dash'], 1);
  assert.equal(usar(sem.e, 0, sem.b, { manual: false }).r.motivo, 'ALVO_PERTO');
});

test('A1: o Piscar Gélido bate e deixa a área fria nas duas pontas; a recarga cai pelos inimigos na área', { skip: SEM }, async () => {
  const m = await montar(['Frostblink'], 4);
  // (com o aval do dono, 19/10: a Piscada vai 2,9 casas — 3 com 90%, 2 com 10% —; o sorteio da fração travado, para ela pousar colada no alvo)
  const sorteio = Math.random;
  Math.random = () => 0.01;
  let r;
  try { ({ r } = usar(m.e, 0, m.b)); } finally { Math.random = sorteio; }
  assert.ok(r.ok, r.erro);
  assert.ok(cheb(m.e.hunt.pos, m.de) >= 2, 'teleportou');
  const frias = m.e.hunt.areasFrias ?? [];
  assert.ok(frias.some((a) => a.x === m.de.x && a.y === m.de.y), 'área fria na origem');
  assert.ok(frias.some((a) => a.x === m.e.hunt.pos.x && a.y === m.e.hunt.pos.y), 'área fria no destino');
  // (o alvo colado no destino, normal: +19% de Recuperação no nível 20 — 2,6 s ÷ 1,19; Raro, e a 'elite' é o Raro do PoE: +99%)
  const entry = Acoes.POR_ID_PUBLICO(G.doSlug('Frostblink').acao);
  const base = Acoes.temposDaGemaPoe(m.e, entry).recarga;
  assert.equal(m.e.hunt.cooldowns[entry.id].total, Math.round(base / 1.19), `${m.e.hunt.cooldowns[entry.id].total} × ${base}`);
  const r2 = await montar(['Frostblink'], 4);
  r2.b.raridade = 'elite';
  Math.random = () => 0.01;
  try { assert.ok(usar(r2.e, 0, r2.b).r.ok); } finally { Math.random = sorteio; }
  assert.equal(r2.e.hunt.cooldowns[entry.id].total, Math.round(base / 1.99));
});

test('A1: o Avanço Flamejante deixa o Solo Ardente no rastro (quem pisa queima) e põe as outras Ilusões na recarga dele', { skip: SEM }, async () => {
  const m = await montar(['Flame_Dash', 'Dash'], 8);
  const { r } = usar(m.e, 0, m.b);
  assert.ok(r.ok, r.erro);
  const solo = m.e.hunt.solosDoJogador?.[0];
  assert.ok(solo, 'o solo ardente');
  assert.ok(solo.casas.includes(`${m.de.x},${m.de.y}`) && solo.casas.includes(`${m.e.hunt.pos.x},${m.e.hunt.pos.y}`), 'do começo ao fim do rastro');
  // um bicho entra no rastro depois: queima no tique — o dps EXATO pelo tempo nele (1 s em 4 tiques de 250 ms)
  const [cx, cy] = solo.casas[1].split(',').map(Number);
  Object.assign(m.b, { x: cx, y: cy, dots: [] });
  let queimou = 0;
  for (let i = 0; i < 4; i++) {
    m.e.hunt.clock += 250;
    queimou += danoNo(Acoes.tiqueDasPlantadas(m.e, m.e.hunt, PERSONAGEM, []), m.b);
  }
  const esperado = resistido(m.e.hunt, m.b, 'fire', solo.partes[0].porSegundo);
  assert.ok(Math.abs(queimou - esperado) <= Math.max(2, esperado * 0.01), `queimou ${queimou} em 1 s; o dps do solo é ${esperado}`);
  // a recarga compartilhada das Ilusões
  const dash = m.e.hunt.cooldowns?.[G.doSlug('Dash').acao];
  assert.ok(dash && dash.ate > m.e.hunt.clock - 250, 'o Avanço entrou na recarga do Avanço Flamejante');
  assert.equal(Acoes.disparar(m.e, m.e.hunt, PERSONAGEM, 1, m.b, { manual: true }).motivo, 'COOLDOWN');
  // sem assimetria: o Piscar Gélido gasta UM uso do Avanço Flamejante (3 usos) — os outros dois seguem prontos
  const f = await montar(['Frostblink', 'Flame_Dash'], 8);
  assert.ok(usar(f.e, 0, f.b).r.ok);
  const fd = G.doSlug('Flame_Dash').acao;
  assert.equal(f.e.hunt.cargasPoe?.[fd]?.length, 1);
  assert.ok(!(f.e.hunt.cooldowns[fd]?.ate > f.e.hunt.clock), 'o Avanço Flamejante ainda tem uso');
});

test('A1: o Teleporte Relampejante espera o atraso (a distância ÷ a velocidade × a redução) e só então teleporta e bate nas duas pontas', { skip: SEM }, async () => {
  const m = await montar(['Lightning_Warp'], 8);
  const r = Acoes.disparar(m.e, m.e.hunt, PERSONAGEM, 0, m.b, { manual: true });
  assert.ok(r.ok && m.e.hunt.conjurando, 'conjurando');
  const c = m.e.hunt.conjurando;
  const conjuracao = Acoes.temposDaGemaPoe(m.e, Acoes.POR_ID_PUBLICO(G.doSlug('Lightning_Warp').acao)).conjuracaoMs;
  assert.ok(c.fim - c.inicio > conjuracao, `o atraso entra na espera: ${c.fim - c.inicio} > ${conjuracao}`);
  assert.deepEqual({ x: m.e.hunt.pos.x, y: m.e.hunt.pos.y }, m.de, 'ainda não teleportou');
  m.e.hunt.clock = c.fim;
  Acoes.concluirConjuracao(m.e, m.e.hunt, PERSONAGEM);
  assert.equal(cheb(m.e.hunt.pos, m.de), c.deslocamento.para ? cheb(c.deslocamento.para, m.de) : -1);
  assert.equal(m.e.hunt.teleportes, 1);
  // o dano nas DUAS pontas: um bicho colado na origem e o alvo a 4 casas (o raio de 2 m do nível 20 é 1 casa, sem sorteio)
  const d = await montar(['Lightning_Warp'], 4);
  const outro = d.e.hunt.monstros[1];
  Object.assign(outro, { x: d.de.x - 1, y: d.de.y, hp: 1e12, maxHp: 1e12, estados: {} });
  const u = usar(d.e, 0, d.b);
  assert.ok(u.r.ok, u.r.erro);
  assert.ok(danoNo(u.eventos, outro) > 0, 'acertou na origem');
  assert.ok(danoNo(u.eventos, d.b) > 0, 'acertou no destino');
  // o alvo morre na espera: o destino já foi escolhido — o teleporte sai
  const morre = await montar(['Lightning_Warp'], 8);
  assert.ok(Acoes.disparar(morre.e, morre.e.hunt, PERSONAGEM, 0, morre.b, { manual: false }).ok);
  morre.b.hp = 0;
  morre.e.hunt.clock = morre.e.hunt.conjurando.fim;
  Acoes.concluirConjuracao(morre.e, morre.e.hunt, PERSONAGEM);
  assert.equal(morre.e.hunt.teleportes, 1, 'teleportou sem o alvo');
  // a posição mudou na espera: o destino guardado não vale (é refeito daqui)
  const mudou = await montar(['Lightning_Warp'], 8);
  assert.ok(Acoes.disparar(mudou.e, mudou.e.hunt, PERSONAGEM, 0, mudou.b, { manual: true }).ok);
  const guardado = { ...mudou.e.hunt.conjurando.deslocamento.para };
  mudou.e.hunt.pos.x -= 1;
  mudou.e.hunt.clock = mudou.e.hunt.conjurando.fim;
  Acoes.concluirConjuracao(mudou.e, mudou.e.hunt, PERSONAGEM);
  assert.ok(cheb(mudou.e.hunt.pos, { x: mudou.de.x - 1, y: mudou.de.y }) <= 5, 'o salto é contado da casa nova');
  assert.ok(guardado);
});

test('A1 (D6): a Vaal do Teleporte leva os bichos perto de você para o destino; (D5) o de Retorno volta para onde começou', { skip: SEM }, async () => {
  // (o raio de 1,6 m é sorteado — 0 ou 1 casa: fixo em 1 casa, o sorteio guardado da caçada, no começo e no fim da conjuração)
  const raio1 = (m) => { m.e.hunt.poeRaioPendente = { [`Vaal_Lightning_Warp@${G.areaNoNivel('Vaal_Lightning_Warp', 20).raioM}`]: 1 }; return m; };
  const usarComRaio1 = (m) => {
    const r = Acoes.disparar(m.e, m.e.hunt, PERSONAGEM, 0, m.b, { manual: true });
    if (r.ok && m.e.hunt.conjurando) {
      raio1(m);
      m.e.hunt.clock = m.e.hunt.conjurando.fim;
      Acoes.concluirConjuracao(m.e, m.e.hunt, PERSONAGEM);
    }
    return { r };
  };
  const m = raio1(await montar(['Vaal_Lightning_Warp'], 1));
  const u0 = usarComRaio1(m);
  assert.ok(u0.r.ok, u0.r.erro);
  assert.deepEqual({ x: m.e.hunt.pos.x, y: m.e.hunt.pos.y }, m.de, 'você fica');
  assert.ok(cheb(m.b, m.de) > 1, 'o bicho colado foi levado');
  assert.equal(m.b.teleportes, 1, 'o contador do bicho, para a tela');
  assert.equal(Cacadas.snapshotDaHunt(m.e).monsters.find((x) => x.uid === m.b.uid).teleporte, 1);
  // o chefe (o do mapa, o Único) não vai
  const c = raio1(await montar(['Vaal_Lightning_Warp'], 1));
  c.b.raridade = 'unico';
  assert.ok(usarComRaio1(c).r.ok);
  assert.equal(c.e.hunt.cooldowns[G.doSlug('Vaal_Lightning_Warp').acao]?.total > 0, true, 'a Vaal saiu');
  assert.equal(cheb(c.b, c.de), 1, 'o Único ficou');
  const v = await montar(['Flame_Dash_of_Return'], 3);
  const u = usar(v.e, 0, v.b);
  assert.ok(u.r.ok, u.r.erro);
  assert.deepEqual({ x: v.e.hunt.pos.x, y: v.e.hunt.pos.y }, v.de, 'terminou onde começou');
  assert.equal(v.e.hunt.teleportes, 2, 'foi e voltou');
});

test('A1: a Investida com Escudo ganha o "mais Dano" pelas casas percorridas; o Caminho Consagrado deixa o Solo Sagrado na chegada', { skip: SEM }, async () => {
  const m = await montar(['Shield_Charge'], 4);
  const entry = Acoes.POR_ID_PUBLICO(G.doSlug('Shield_Charge').acao);
  const p3 = Acoes.planoDoDeslocamento(m.e, m.e.hunt, entry, m.e.actions[0], m.b, G.deslocamentoDaGema('Shield_Charge', 20), { manual: true });
  assert.equal(p3.casas, 3);
  assert.equal(p3.maisDanoPct, 100);
  const m2 = await montar(['Shield_Charge'], 3);
  const p2 = Acoes.planoDoDeslocamento(m2.e, m2.e.hunt, entry, m2.e.actions[0], m2.b, G.deslocamentoDaGema('Shield_Charge', 20), { manual: true });
  assert.equal(p2.casas, 2);
  assert.ok(Math.abs(p2.maisDanoPct - 200 / 3) < 1e-9);
  const c = await montar(['Consecrated_Path'], 4);
  assert.ok(usar(c.e, 0, c.b).r.ok);
  assert.ok((c.e.hunt.solosSagrados ?? []).some((s) => s.x === c.e.hunt.pos.x && s.y === c.e.hunt.pos.y), 'o Solo Sagrado onde chegou');
});

test('A1: a recarga do Passo Rápido é 10 s; o +200% só sem inimigos na presença (ou com um Único nela)', { skip: SEM }, async () => {
  const m = await montar(['Quickstep'], 4);
  const entry = Acoes.POR_ID_PUBLICO(G.doSlug('Quickstep').acao);
  assert.equal(G.temposNoNivel('Quickstep', 20).recargaMs, 10000);
  assert.equal(Acoes.temposDaGemaPoe(m.e, entry).recarga, 10000, 'com um inimigo normal na presença');
  m.b.x += 30;
  assert.equal(Acoes.temposDaGemaPoe(m.e, entry).recarga, 3333, 'sem inimigos na presença');
  m.b.x -= 30;
  m.b.raridade = 'unico';
  assert.equal(Acoes.temposDaGemaPoe(m.e, entry).recarga, 3333, 'com um Único na presença');
});

test('A1 (D7): a Corrida de Fase Antiga e o Passo Definhante são buffs; o Passo dá o Elusivo e Definha quem está na área', { skip: SEM }, async () => {
  assert.equal(G.REGISTRO.get('Old_Phase_Run').arquetipo, 'guarda');
  assert.equal(G.REGISTRO.get('Withering_Step').arquetipo, 'guarda');
  const m = await montar(['Withering_Step'], 1);
  const { r } = usar(m.e, 0, m.b);
  assert.ok(r.ok, r.erro);
  assert.ok(ModsPoe.buffAtivo(m.e, 'elusivo'), 'Elusivo');
  assert.ok((m.b.estados?.definhado?.n ?? 0) >= 2, `Definhado: ${JSON.stringify(m.b.estados?.definhado)}`);
  assert.deepEqual({ x: m.e.hunt.pos.x, y: m.e.hunt.pos.y }, m.de, 'não desloca');
  // "A Recarga desta Habilidade não é recuperada durante seu efeito": a recarga começa quando o Elusivo acaba
  const cd = m.e.hunt.cooldowns[G.doSlug('Withering_Step').acao];
  assert.equal(cd.ate, m.e.hunt.poeBuffs.elusivo + cd.total);
  m.e.hunt.clock += 3500;
  assert.equal(Acoes.disparar(m.e, m.e.hunt, PERSONAGEM, 0, m.b, { manual: true }).motivo, 'COOLDOWN');
  delete m.e.hunt.cooldowns[G.doSlug('Withering_Step').acao];
  assert.equal(Acoes.disparar(m.e, m.e.hunt, PERSONAGEM, 0, m.b, { manual: true }).motivo, 'ELUSIVO');
});

test('A1: o status — nenhuma das gemas que deslocam diz mais "o deslocamento não existe"', { skip: SEM }, () => {
  for (const slug of Object.keys(D.DESLOCAMENTO)) {
    const r = G.REGISTRO.get(slug);
    assert.ok(r, slug);
    assert.ok(!(r.motivosNoJogo ?? []).some((x) => /o deslocamento .* não existe/.test(x)), slug);
    assert.ok(!(r.motivosNoJogo ?? []).some((x) => /Distância de Deslocamento/.test(x)), `${slug}: a distância é feita`);
  }
});
