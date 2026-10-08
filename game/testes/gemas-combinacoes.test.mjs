// Sockets, links e a COMBINAÇÃO dos efeitos das gemas (pedido do dono, 01/10):
//   - uma support só vale para as skills do MESMO grupo ligado, da mesma peça;
//     a mesma support duas vezes no grupo vale uma vez;
//   - a explosão é um quadrado 3×3 (configurável) centrado em CADA impacto e pega
//     TODOS dentro, inclusive o do impacto; explosões sobrepostas acumulam;
//   - os projéteis seguem Pierce → Fork → Chain → fim → retorno, cada um por conta
//     própria, e todo impacto explode; tetos de impactos/explosões por uso.
import * as L from '../systems/combate/limites.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Acoes from '../systems/acoes.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Ficha from '../systems/ficha.mjs';
import * as Treino from '../systems/treino.mjs';
import * as G from '../systems/skills/gemas.mjs';
import * as S from '../systems/skills/golpes-secundarios.mjs';
import { eventosDoQuadro } from '../websocket/quadro.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import { criarMonstro } from '../systems/hunt/monstros.mjs';
import { personagemDeTeste, PERSONAGEM, HUNT_DE_TESTE } from './apoio.mjs';
import { aAdaptar, doClassico } from './apoio-migracao.mjs';

const FLAME = 'spell-flame-strike';
const ENERGY = 'spell-energy-strike';
const GEMA = (acao) => G.ITEM_DA_ACAO.get(acao);
const SUP = (id) => [...G.DEFS.values()].find((d) => d.tipo === 'support' && d.id === id).itemId;
const idDe = (nome) => Number(Object.values(ITEM_CATALOG).find((i) => i.name === nome).id);
const HP = 1e12;

/** Personagem com as gemas na arma (até 4 sockets), `links` entre vizinhos (padrão: todos ligados). */
function montar(gemas, { links = [true, true, true], corpo = null } = {}) {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 300 });
  Treino.garantir(e);
  const lista = gemas.map((g) => (g ? G.novaGema(g.startsWith('spell-') ? GEMA(g) : SUP(g)) : null));
  e.equipment.weapon = { id: idDe('wand of vortex'), count: 1, soquetes: { abertos: 4, links, gemas: [...lista, ...Array(4 - lista.length).fill(null)] } };
  if (corpo) {
    const peca = Object.values(ITEM_CATALOG).find((i) => i.slot === 'body' && G.maximoDeSockets(i) >= 2 && !i.vocations?.length && !(i.minLevel > 1));
    const gc = corpo.map((g) => G.novaGema(g.startsWith('spell-') ? GEMA(g) : SUP(g)));
    const max = G.maximoDeSockets(peca);
    e.equipment.body = { id: Number(peca.id), count: 1, soquetes: { abertos: max, links: Array(max - 1).fill(true), gemas: [...gc, ...Array(max - gc.length).fill(null)] } };
  }
  Ficha.invalidar(e);
  assert.ok(Cacadas.entrar(e, { huntId: HUNT_DE_TESTE, mode: 'auto' }).ok);
  const h = e.hunt;
  delete h.instancia;
  h.respawns = [];
  h.monstros = [];
  e.maxHp = e.hp = 1e12;
  e.maxMana = e.mana = 1e12;
  return e;
}
const bicho = (e, dx, dy, extra = {}) => {
  const m = Object.assign(criarMonstro({ key: 'troll', x: e.hunt.pos.x + dx, y: e.hunt.pos.y + dy }, null), { hp: HP, maxHp: HP }, extra);
  e.hunt.monstros.push(m);
  return m;
};
function lancar(e, acao, alvo) {
  const h = e.hunt;
  e.actions = Array(Acoes.SLOTS).fill(null);
  const slot = Acoes.PAPEL_DO_SLOT.indexOf('attack');
  assert.equal(Acoes.definir(e, { slot, value: { id: acao } }).ok, true);
  h.cooldowns = {};
  delete h.ultimoAtaqueEm;
  delete h.conjurando;
  const r = Acoes.disparar(e, h, PERSONAGEM, slot, alvo);
  if (r.conjurando) {
    h.conjurando.fim = 0;
    return Acoes.concluirConjuracao(e, h, PERSONAGEM);
  }
  assert.notEqual(r.ok, false, r.erro);
  return r.eventos;
}
const golpesEm = (ev, m, fonte) => ev.filter((x) => x.t === 'dmg' && x.uid === m.uid && (fonte === undefined || (x.fonte ?? null) === fonte)).length;
const explosoes = (ev, e) => ev.filter((x) => x.t === 'explosao').map((x) => `${x.x - e.hunt.pos.x},${x.y - e.hunt.pos.y}`);
const supportsDe = (e, acao) => (G.efeitoNaSkill(e, acao)?.supports ?? []).sort();

// ---------------------------------------------------------------- sockets e links

test('links: um ataque e uma support ligados — o ataque recebe', () => {
  assert.deepEqual(supportsDe(montar([FLAME, 'pierce']), FLAME), ['Pierce']);
});

test('links: dois ataques e uma support ligados — os dois recebem (a support não é gasta)', () => {
  const e = montar([FLAME, ENERGY, 'pierce']);
  assert.deepEqual(supportsDe(e, FLAME), ['Pierce']);
  assert.deepEqual(supportsDe(e, ENERGY), ['Pierce']);
});

test('links: um ataque e duas supports ligadas — recebe as duas', () => {
  assert.deepEqual(supportsDe(montar([FLAME, 'pierce', 'explosion']), FLAME), ['Explosion', 'Pierce']);
});

test('links: grupos separados não conversam; socket sem link não vale', () => {
  // [Flame ─ Pierce]   [Energy ─ Explosion]
  const e = montar([FLAME, 'pierce', ENERGY, 'explosion'], { links: [true, false, true] });
  assert.deepEqual(supportsDe(e, FLAME), ['Pierce']);
  assert.deepEqual(supportsDe(e, ENERGY), ['Explosion']);
  assert.deepEqual(supportsDe(montar([FLAME, 'explosion'], { links: [false, true, true] }), FLAME), []);
});

test('links: support incompatível não pega naquela skill, e não impede a outra de receber', () => {
  const e = montar([FLAME, 'spell-fire-wave', 'pierce']);
  assert.deepEqual(supportsDe(e, FLAME), ['Pierce']);
  assert.deepEqual(supportsDe(e, 'spell-fire-wave'), [], 'Fire Wave não é projétil');
});

test('links: gemas em peças diferentes não compartilham efeitos', () => {
  const e = montar([FLAME], { corpo: ['pierce', 'explosion'] });
  assert.deepEqual(supportsDe(e, FLAME), []);
});

test('links: mudar os links durante o jogo e encaixar/tirar recalcula na hora', () => {
  const e = montar([FLAME, 'pierce', 'explosion']);
  assert.deepEqual(supportsDe(e, FLAME), ['Explosion', 'Pierce']);
  e.equipment.weapon.soquetes.links = [true, false, false];
  assert.deepEqual(supportsDe(e, FLAME), ['Pierce']);
  e.equipment.weapon.soquetes.links = [true, true, true];
  assert.ok(G.tirar(e, { slot: 'weapon', indice: 1 }).ok);
  assert.deepEqual(supportsDe(e, FLAME), ['Explosion']);
});

test('links: a mesma support duas vezes no grupo vale UMA vez', () => {
  const e = montar([FLAME, 'pierce', 'pierce']);
  const ef = G.efeitoNaSkill(e, FLAME);
  assert.deepEqual(ef.supports, ['Pierce']);
  assert.equal(ef.perfurar, 2);
  assert.equal(Math.round(ef.danoDaPerfuracaoPct), 70);
});

// ---------------------------------------------------------------- explosões

test('explosão sem outras supports: alvo sozinho leva o direto E a explosão; o evento é UM, no ponto do impacto, 3×3', { skip: doClassico("Suportes do Draevor (Explosion, Returning…) combinados em magia do Draevor") }, () => {
  const e = montar([FLAME, 'explosion']);
  const alvo = bicho(e, 3, 0);
  const ev = lancar(e, FLAME, alvo);
  assert.equal(golpesEm(ev, alvo, null), 1, 'direto');
  assert.equal(golpesEm(ev, alvo, 'explosao'), 1, 'explosão');
  const ex = ev.filter((x) => x.t === 'explosao');
  assert.equal(ex.length, 1);
  assert.deepEqual([ex[0].x, ex[0].y, ex[0].lado], [alvo.x, alvo.y, 3]);
});

test('explosão 3×3: as 9 casas levam; a 2 casas, não', { skip: doClassico("Suportes do Draevor (Explosion, Returning…) combinados em magia do Draevor") }, () => {
  const e = montar([FLAME, 'explosion']);
  const alvo = bicho(e, 3, 0);
  const dentro = [];
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (dx || dy) dentro.push(bicho(e, 3 + dx, dy));
  const fora = [bicho(e, 5, 0), bicho(e, 3, 2), bicho(e, 1, -2)];
  const ev = lancar(e, FLAME, alvo);
  for (const m of dentro) assert.equal(golpesEm(ev, m, 'explosao'), 1);
  for (const m of fora) assert.equal(golpesEm(ev, m), 0);
});

test('explosão em coordenadas diferentes: sempre no bicho do impacto', { skip: doClassico("Suportes do Draevor (Explosion, Returning…) combinados em magia do Draevor") }, () => {
  // (Dentro do alcance da Flame Strike, 3.)
  for (const [dx, dy] of [[2, -2], [-3, 1], [1, 3]]) {
    const e = montar([FLAME, 'explosion']);
    const alvo = bicho(e, dx, dy);
    assert.deepEqual(explosoes(lancar(e, FLAME, alvo), e), [`${dx},${dy}`]);
  }
});

test('explosão: dano ~40% de um golpe direto (rolagem própria) e passa pela resistência do bicho (teto de resistência do bicho)', { skip: doClassico("Suportes do Draevor (Explosion, Returning…) combinados em magia do Draevor") }, () => {
  const e = montar([FLAME, 'explosion']);
  const alvo = bicho(e, 3, 0);
  // Resistência 100% a fogo: o jogo limita no teto do bicho (`combate/limites.json`, 75%) — não há imunidade total.
  const resistente = bicho(e, 4, 0, { resist: { fire: 100 } });
  const comum = bicho(e, 3, 1);
  let direto = 0;
  let explosao = 0;
  for (let i = 0; i < 200; i++) {
    const ev = lancar(e, FLAME, alvo);
    direto += ev.filter((x) => x.t === 'dmg' && x.uid === alvo.uid && !x.fonte).reduce((a, x) => a + x.v, 0);
    explosao += ev.filter((x) => x.t === 'dmg' && x.uid === alvo.uid && x.fonte === 'explosao').reduce((a, x) => a + x.v, 0);
  }
  assert.ok(Math.abs(explosao / direto - 0.4) < 0.06, `explosão/direto = ${(explosao / direto).toFixed(3)}`);
  const perda = (m) => HP - m.hp;
  const passa = 1 - L.LIMITES.resistenciaDoMob.maximo / 100;
  assert.ok(Math.abs(perda(resistente) / perda(comum) - passa) < 0.05, `o resistente perdeu ${(perda(resistente) / perda(comum)).toFixed(3)} do comum (esperado ${passa})`);
});

// ---------------------------------------------------------------- combinações

test('Pierce sem explosão: atravessa na reta, até o limite de perfurações', { skip: aAdaptar("Pierce existe no PoE e a mecânica de projétil é da engine; o teste usa gema do Draevor") }, () => {
  const e = montar([FLAME, 'pierce']);
  const alvo = bicho(e, 1, 0);
  const reta = [bicho(e, 2, 0), bicho(e, 3, 0), bicho(e, 4, 0)];
  const lado = bicho(e, 2, 1);
  const ev = lancar(e, FLAME, alvo);
  assert.equal(golpesEm(ev, reta[0], 'perfuracao'), 1);
  assert.equal(golpesEm(ev, reta[1], 'perfuracao'), 1);
  assert.equal(golpesEm(ev, reta[2]), 0, 'Pierce 2: o terceiro da reta não leva');
  assert.equal(golpesEm(ev, lado), 0, 'fora da reta não leva');
  assert.equal(explosoes(ev, e).length, 0);
});

test('Explosion + Pierce: cada impacto da reta explode no ponto dele; o projétil segue depois da explosão', { skip: doClassico("Suportes do Draevor (Explosion, Returning…) combinados em magia do Draevor") }, () => {
  const e = montar([FLAME, 'pierce', 'explosion']);
  const alvo = bicho(e, 1, 0);
  const segundo = bicho(e, 3, 0);
  const terceiro = bicho(e, 5, 0);
  const soDaExplosao = bicho(e, 5, 1); // fora da reta, ao lado do terceiro impacto
  const ev = lancar(e, FLAME, alvo);
  assert.deepEqual(explosoes(ev, e), ['1,0', '3,0', '5,0']);
  assert.equal(golpesEm(ev, segundo, 'perfuracao'), 1);
  assert.equal(golpesEm(ev, terceiro, 'perfuracao'), 1);
  assert.equal(golpesEm(ev, soDaExplosao, 'explosao'), 1);
});

test('Explosion + Multiple Projectiles: cada projétil explode no seu impacto', { skip: doClassico("Suportes do Draevor (Explosion, Returning…) combinados em magia do Draevor") }, () => {
  const e = montar([FLAME, 'multiple-projectiles', 'explosion']);
  const alvo = bicho(e, 3, 0);
  const extra1 = bicho(e, -2, 0);
  const extra2 = bicho(e, 0, -2);
  const ev = lancar(e, FLAME, alvo);
  assert.deepEqual(explosoes(ev, e).sort(), ['-2,0', '0,-2', '3,0'].sort());
  for (const m of [extra1, extra2]) assert.equal(golpesEm(ev, m, 'projetil'), 1);
});

test('Explosion + Pierce + Multiple Projectiles: os extras também perfuram e explodem', { skip: doClassico("Suportes do Draevor (Explosion, Returning…) combinados em magia do Draevor") }, () => {
  const e = montar([FLAME, 'multiple-projectiles', 'pierce', 'explosion']);
  const alvo = bicho(e, 2, 0);
  bicho(e, 4, 0); // perfurado pelo principal
  bicho(e, -2, 0); // extra
  bicho(e, -4, 0); // perfurado pelo extra
  bicho(e, 0, 3); // outro extra
  const ev = lancar(e, FLAME, alvo);
  assert.deepEqual(explosoes(ev, e).sort(), ['-2,0', '-4,0', '0,3', '2,0', '4,0'].sort());
});

test('Explosion + Fork: o projétil se divide no impacto e cada filho explode onde acerta', { skip: doClassico("Suportes do Draevor (Explosion, Returning…) combinados em magia do Draevor") }, () => {
  const e = montar([FLAME, 'fork', 'explosion']);
  const alvo = bicho(e, 2, 0);
  const f1 = bicho(e, 4, 2);
  const f2 = bicho(e, 4, -2);
  const ev = lancar(e, FLAME, alvo);
  assert.equal(golpesEm(ev, f1, 'bifurcacao'), 1);
  assert.equal(golpesEm(ev, f2, 'bifurcacao'), 1);
  assert.deepEqual(explosoes(ev, e).sort(), ['2,0', '4,-2', '4,2'].sort());
});

test('Explosion + Chain: cada salto explode uma vez; com 2 bichos a cadeia acaba (não volta para quem já pegou)', { skip: doClassico("Suportes do Draevor (Explosion, Returning…) combinados em magia do Draevor") }, () => {
  const e = montar([FLAME, 'chain', 'explosion']);
  const alvo = bicho(e, 2, 0);
  const outro = bicho(e, 4, 0);
  const ev = lancar(e, FLAME, alvo);
  assert.equal(golpesEm(ev, outro, 'encadeamento'), 1);
  assert.equal(golpesEm(ev, alvo, 'encadeamento'), 0, 'sem voltar para o primeiro');
  assert.deepEqual(explosoes(ev, e), ['2,0', '4,0'], 'uma explosão por impacto, sem duplicar');
});

test('Explosion + Returning: na volta acerta cada um UMA vez e explode de novo', { skip: doClassico("Suportes do Draevor (Explosion, Returning…) combinados em magia do Draevor") }, () => {
  const e = montar([FLAME, 'pierce', 'returning-projectile', 'explosion']);
  const alvo = bicho(e, 2, 0);
  const atras = bicho(e, 4, 0);
  const ev = lancar(e, FLAME, alvo);
  assert.equal(golpesEm(ev, alvo, 'retorno'), 1);
  assert.equal(golpesEm(ev, atras, 'retorno'), 1);
  assert.equal(explosoes(ev, e).length, 4, '2 na ida + 2 na volta');
});

test('explosões sobrepostas acumulam: o vizinho de dois impactos leva duas explosões', { skip: doClassico("Suportes do Draevor (Explosion, Returning…) combinados em magia do Draevor") }, () => {
  const e = montar([FLAME, 'pierce', 'explosion']);
  const alvo = bicho(e, 1, 0);
  bicho(e, 3, 0);
  const meio = bicho(e, 2, 1); // a 1 casa dos dois impactos
  const ev = lancar(e, FLAME, alvo);
  assert.equal(golpesEm(ev, meio, 'explosao'), 2);
});

test('tetos por uso: muitos projéteis e muitos bichos — termina, respeita os limites e não duplica impacto do mesmo projétil', () => {
  const cfg = G.CONFIG.golpesSecundarios.limites;
  const vivos = [];
  for (let x = -6; x <= 6; x++) for (let y = -6; y <= 6; y++) if (x || y) vivos.push({ x, y, hp: 1 });
  const efeito = { alvosExtras: 6, danoDosExtrasPct: 50, perfurar: 3, danoDaPerfuracaoPct: 70, bifurcar: 2, danoDaBifurcacaoPct: 60, encadear: 3, danoDoEncadeamentoPct: 70, retornar: 1, danoDoRetornoPct: 50, explosaoPct: 50, segundaExplosaoPct: 35 };
  const inicio = performance.now();
  const r = S.resolver({ efeito, tags: ['projectile', 'hit', 'single'], origem: { x: 0, y: 0 }, alvo: vivos.find((b) => b.x === 1 && b.y === 0), atingidos: [vivos.find((b) => b.x === 1 && b.y === 0)], vivos, alcance: 7 });
  assert.ok(performance.now() - inicio < 100, 'rápido');
  assert.equal(r.cortado, true);
  assert.ok(r.golpes.filter((g) => g.tipo !== 'explosao').length <= cfg.impactosPorUso);
  assert.ok(r.explosoes.length <= cfg.explosoesPorUso);
  // Toda explosão pega no máximo as 9 casas dela.
  assert.ok(r.golpes.filter((g) => g.tipo === 'explosao').length <= r.explosoes.length * 9);
});

test('a explosão vai para a tela como evento próprio, e some fora da tela como os outros efeitos', () => {
  const longe = { t: 'explosao', id: 6, x: 500, y: 500, lado: 3 };
  const perto = { t: 'explosao', id: 6, x: 10, y: 10, lado: 3 };
  const filtrados = eventosDoQuadro([longe, perto], { x: 10, y: 10 }, false);
  assert.deepEqual(filtrados, [perto]);
});

test('caçada automática (idle/offline usam o mesmo tique): as explosões das supports saem no combate de verdade', { skip: doClassico("Suportes do Draevor (Explosion, Returning…) combinados em magia do Draevor") }, () => {
  const e = montar([FLAME, 'pierce', 'explosion']);
  e.actions = Array(Acoes.SLOTS).fill(null);
  assert.ok(Acoes.definir(e, { slot: Acoes.PAPEL_DO_SLOT.indexOf('attack'), value: { id: FLAME } }).ok);
  const h = e.hunt;
  h.assistencia = true;
  h.autoBarra = true;
  bicho(e, 1, 0);
  bicho(e, 2, 0);
  let t = Date.now();
  h.ultimoTique = t;
  let ex = 0;
  for (let i = 0; i < 40; i++) {
    t += 250;
    h.alvo = h.monstros[0].uid;
    // Os dois na reta, parados (sem isso eles andam e saem da linha do Pierce).
    h.monstros.forEach((m, k) => Object.assign(m, { hp: HP, x: h.pos.x + 1 + k, y: h.pos.y }));
    const r = Cacadas.tique(e, PERSONAGEM, t);
    ex += (r?.eventos ?? r ?? []).filter?.((x) => x.t === 'explosao').length ?? 0;
  }
  // ~5 usos em 10 s (global de 2 s), 2 impactos cada (o alvo e o perfurado): ~10 explosões.
  assert.ok(ex >= 8, `${ex} explosões em 10 s`);
});
