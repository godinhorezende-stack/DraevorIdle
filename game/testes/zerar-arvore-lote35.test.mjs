// ZERAR A ÁRVORE — LOTE 35 (dono, 16/10: "fiz o merge, faça o deploy e depois siga"; a auditoria em docs/arvore-poe-auditoria.md): as decisões
// do dono nos limites estruturais — P001/P033 "Medir em metros" no alcance corpo a corpo (o alcance da ARMA, da base do PoE, + os "+X metros";
// o vizinho colado sempre ao alcance e cada casa a mais pedindo 2 m; também no golpe da gema corpo a corpo) e P004 "Como no PoE: todo bloqueio"
// (a Recuperação de Bloqueio trava em todo bloqueio, de qualquer monstro).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Controle = await import('../systems/combate/controle.mjs');
const Acoes = await import('../systems/acoes.mjs');
const GemasPoe = await import('../systems/itens-poe/gemas-poe.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
  (await import('../systems/itens-poe/campanha.mjs')).iniciar();
}

const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 70, rng: () => 0.5 }));
function personagem(af = {}, base = 'One_Hand_Swords/Rusted_Sword') {
  const e = personagemDeTeste({ vocacao: 'knight', level: 60 });
  e.sistema = 'poe';
  e.classePoe = 'Duelist';
  if (base) {
    const arma = peca(base);
    arma.poe.af = { ...(arma.poe.af ?? {}), ...af };
    e.equipment = { ...(e.equipment ?? {}), weapon: arma };
  } else {
    e.equipment = { ...(e.equipment ?? {}), ring: { id: 77, poe: { af } } };
    delete e.equipment.weapon;
  }
  delete e.equipment.shield;
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  P.garantir(e);
  return e;
}
const ficha = (e) => { Ficha.invalidar(e); return Ficha.combate(e); };
const alcance = (e) => Cacadas.alcanceDaArma(Cacadas.armaDoPersonagem(e), e);

test('as linhas do alcance em metros e da Recuperação de Bloqueio com efeito', { skip: SEM }, () => {
  for (const [modelo, v] of [['+{0} metros ao Alcance de Golpes Corpo a Corpo', [0.2]], ['+{0} metros ao Alcance de Golpes Corpo a Corpo com Espadas', [0.3]], ['Recuperação de Bloqueio aumentada em {0}%', [30]]]) {
    assert.equal(T.traduzirMod({ modelo, valores: v }).estado, 'novo', modelo);
  }
});

test('P001 — o alcance corpo a corpo em metros: o da arma (a base do PoE) + os "+X metros"; cada casa a mais pede 2 m', { skip: SEM }, () => {
  const espada = personagem();
  assert.equal(espada.equipment.weapon.poe.atributos.alcance_metros, 1.1);
  assert.equal(ficha(espada).alcanceCorpoM, 1.1);
  assert.equal(alcance(espada), 1, '1,1 m: o vizinho colado');
  assert.equal(alcance(personagem({ alcance_corpo_m: 0.9 })), 2, '1,1 + 0,9 = 2,0 m: uma casa a mais (antes: 0,9 m sozinho não dava nada)');
  assert.equal(alcance(personagem({ alcance_corpo_m: 0.8 })), 1, '1,9 m: ainda não');
  assert.equal(alcance(personagem({ alcance_corpo_m: 2.9 })), 3, '4,0 m: duas casas a mais');
  // o machado de duas mãos (1,3 m) e a faca (1,0 m)
  assert.equal(alcance(personagem({ alcance_corpo_m: 0.7 }, 'Two_Hand_Axes/Stone_Axe')), 2);
  assert.equal(alcance(personagem({ alcance_corpo_m: 0.7 }, 'Daggers/Glass_Shank')), 1, '1,0 + 0,7 = 1,7 m');
  // a peça antiga sem o alcance gravado: o da base do catálogo
  const antiga = personagem({ alcance_corpo_m: 0.9 });
  delete antiga.equipment.weapon.poe.atributos.alcance_metros;
  assert.equal(alcance(antiga), 2);
  // desarmado: o PoB não traz o alcance — só os metros a mais
  assert.equal(Ficha.alcanceCorpoEmMetros(null, { alcance_corpo_m: 2 }), 2);
});

test('P001 — o golpe corpo a corpo da GEMA usa o mesmo alcance (o Golpe Pesado alcança a 2 casas com 2 m)', { skip: SEM }, () => {
  const gema = GemasPoe.doSlug('Heavy_Strike');
  if (!gema) return; // (sem a coleção de gemas nesta máquina)
  const tenta = (af) => {
    const e = personagem(af);
    const arma = e.equipment.weapon;
    arma.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
    e.inventory = [GS.itemDaGema({ id: gema.itemId, nivel: 10, xp: 0, raridade: 'comum' })];
    GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
    e.actions = Array(Acoes.SLOTS).fill(null);
    e.actions[0] = { id: gema.acao, enabled: true, minMana: 0, conditions: [] };
    Ficha.invalidar(e);
    Afixos.sincronizarMaximos(e);
    assert.equal(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok, true);
    const h = e.hunt;
    Object.assign(e, { mana: 1e6, maxMana: 1e6 });
    h.monstros = h.monstros.filter((m) => m.hp > 0 && !m.dummy).slice(0, 1);
    const [alvo] = h.monstros;
    Object.assign(alvo, { x: h.pos.x + 2, y: h.pos.y, hp: 1e9, maxHp: 1e9 });
    return Acoes.disparar(e, h, PERSONAGEM, 0, alvo, { manual: true });
  };
  assert.equal(tenta({}).motivo, 'FORA_DE_ALCANCE', 'a espada (1,1 m) não alcança a 2 casas');
  assert.equal(tenta({ alcance_corpo_m: 0.9 }).ok, true, 'com 2,0 m, alcança');
});

test('P004 — a Recuperação de Bloqueio trava em TODO bloqueio (a decisão do dono): 0,35 s ÷ (1 + a recuperação)', { skip: SEM }, () => {
  const hunt = { clock: 10000, cooldowns: {} };
  const comum = { uid: 'c', hp: 10, maxHp: 10 };
  const f = { afPoe: { block_recovery: 30, stun_recovery: 20 } };
  const ms = Controle.travarNoBloqueio(hunt, comum, f);
  assert.equal(ms, Math.round(350 / 1.5), 'o monstro comum também');
  assert.equal(hunt.cooldowns['grupo:poe'].ate, 10000 + ms);
  assert.equal(Controle.travarNoBloqueio(hunt, { uid: 'e', elite: true, hp: 10, maxHp: 10 }, { afPoe: {} }), 350, 'sem recuperação: 0,35 s');
});
