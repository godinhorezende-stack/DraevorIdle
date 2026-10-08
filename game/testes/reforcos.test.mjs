// As GEMAS DE REFORÇO (systems/skills/reforcos.mjs + gamedata/gemas/reforcos.json): cada
// buff, postura, aura e provocação tem efeito de verdade no combate, por dados, e a
// gema dele (nível, raridade, qualidade) escala o efeito.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Acoes from '../systems/acoes.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Ficha from '../systems/ficha.mjs';
import * as Treino from '../systems/treino.mjs';
import * as G from '../systems/skills/gemas.mjs';
import * as Reforcos from '../systems/skills/reforcos.mjs';
import { ACTION_CATALOG } from '../systems/dados.mjs';
import { criarMonstro } from '../systems/hunt/monstros.mjs';
import { personagemDeTeste, PERSONAGEM, comSkills, HUNT_DE_TESTE } from './apoio.mjs';
import { doClassico } from './apoio-migracao.mjs';

const cru = (id) => [...ACTION_CATALOG.spells, ...ACTION_CATALOG.runes].find((x) => x.id === id);

function naCacada(e) {
  assert.ok(Cacadas.entrar(e, { huntId: HUNT_DE_TESTE, mode: 'auto' }).ok);
  const h = e.hunt;
  delete h.instancia;
  h.respawns = [];
  // Um bicho por perto (as magias de suporte só saem com bicho por perto), longe de todo teste de alcance.
  h.monstros = [Object.assign(criarMonstro({ key: 'troll', x: h.pos.x + 3, y: h.pos.y + 3 }, null), { hp: 1e12, maxHp: 1e12, perseguindo: false })];
  return h;
}
function lancar(e, id, alvo = null) {
  const h = e.hunt;
  e.actions = Array(Acoes.SLOTS).fill(null);
  const papel = cru(id).papeis[0];
  const slot = Acoes.PAPEL_DO_SLOT.indexOf(papel);
  assert.equal(Acoes.definir(e, { slot, value: { id } }).ok, true, id);
  h.cooldowns = {};
  delete h.ultimoAtaqueEm;
  e.mana = e.maxMana = 1e9;
  const r = Acoes.disparar(e, h, PERSONAGEM, slot, alvo);
  assert.notEqual(r.ok, false, `${id}: ${r.erro}`);
  return r;
}

test('toda gema de reforço tem entrada nos dados; os efeitos são de tipos conhecidos', { skip: doClassico("Reforços do Draevor (tipos de efeito do catálogo)") }, () => {
  const conhecidos = new Set(['dano', 'critChance', 'critDano', 'treino', 'treinoDeOutraPericia', 'curaRecebida', 'esquivaDeLonge', 'marcaVulneravel', 'marcaEnfraquece', 'provocar']);
  for (const [id, def] of Object.entries(Reforcos.REFORCOS)) {
    assert.ok(G.ITEM_DA_ACAO.has(id), `${id} tem gema`);
    assert.ok(def.dur > 0 && def.tipo, id);
    for (const e of def.efeitos ?? []) assert.ok(conhecidos.has(e.efeito), `${id}: ${e.efeito}`);
  }
  // As 4 de velocidade, o escudo e as 12 que antes eram só um relógio.
  assert.equal(Object.keys(Reforcos.REFORCOS).length, 17);
});

test('postura: Master of Flames sobe o dano das skills de fogo (e só delas) enquanto ligada', { skip: doClassico("Reforços do Draevor (Master of Flames, Blood Rage, Haste, Shared Conservation, Chivalrous Challenge, Cancel Magic Shield)") }, () => {
  const e = comSkills(personagemDeTeste({ vocacao: 'sorcerer', level: 200 }), ['spell-master-of-flames']);
  Treino.garantir(e);
  naCacada(e);
  const flame = cru('spell-flame-strike');
  const energia = cru('spell-energy-strike');
  const antes = Acoes.danoMostrado(e, flame, null).max;
  const antesE = Acoes.danoMostrado(e, energia, null).max;
  lancar(e, 'spell-master-of-flames');
  assert.ok(Acoes.danoMostrado(e, flame, null).max > antes, 'fogo sobe');
  assert.equal(Acoes.danoMostrado(e, energia, null).max, antesE, 'energia não');
});

test('Blood Rage sobe o golpe corpo a corpo (tag melee) — o golpe básico e as skills físicas de perto', { skip: doClassico("Reforços do Draevor (Master of Flames, Blood Rage, Haste, Shared Conservation, Chivalrous Challenge, Cancel Magic Shield)") }, () => {
  const e = comSkills(personagemDeTeste({ vocacao: 'knight', level: 200 }), ['spell-blood-rage']);
  naCacada(e);
  const brutal = cru('spell-brutal-strike');
  const antes = Acoes.danoMostrado(e, brutal, null).max;
  lancar(e, 'spell-blood-rage');
  assert.ok(Reforcos.bonus(e.hunt, 'dano', ['attack', 'melee', 'physical']) > 0, 'golpe básico corpo a corpo');
  assert.ok(Acoes.danoMostrado(e, brutal, null).max > antes);
});

test('o nível, a raridade e a qualidade da gema escalam o efeito (e a velocidade)', { skip: doClassico("Reforços do Draevor (Master of Flames, Blood Rage, Haste, Shared Conservation, Chivalrous Challenge, Cancel Magic Shield)") }, () => {
  assert.equal(Reforcos.fatorDaGema(null), 1);
  assert.equal(Reforcos.fatorDaGema({ nivel: 1, raridade: 'comum', qualidade: 0 }), 1);
  const f = Reforcos.fatorDaGema({ nivel: 11, raridade: 'mítico', qualidade: 10 });
  assert.ok(Math.abs(f - (1 + (10 * 3 * 2) / 100 + 0.1)) < 1e-9);
  assert.equal(Reforcos.velocidadeEscalada(1.3, 2), 1.6);
  const e = comSkills(personagemDeTeste({ vocacao: 'sorcerer', level: 200 }), ['spell-haste'], { nivel: 11 });
  naCacada(e);
  lancar(e, 'spell-haste');
  assert.ok(e.hunt.buffs['spell-haste'].mult > 1.3, `mult ${e.hunt.buffs['spell-haste'].mult}`);
});

test('auras: quem você atinge fica vulnerável (+% de fogo/gelo/energia/terra) ou enfraquecido (bate menos)', { skip: doClassico("Reforços do Draevor (Master of Flames, Blood Rage, Haste, Shared Conservation, Chivalrous Challenge, Cancel Magic Shield)") }, () => {
  const e = comSkills(personagemDeTeste({ vocacao: 'sorcerer', level: 200 }), ['spell-aura-of-exposed-weakness', 'spell-aura-of-sapped-strength', 'spell-flame-strike']);
  const h = naCacada(e);
  const m = Object.assign(criarMonstro({ key: 'troll', x: h.pos.x + 1, y: h.pos.y }, null), { hp: 1e9, maxHp: 1e9 });
  h.monstros.push(m);
  const agora = h.clock ?? Date.now();
  lancar(e, 'spell-aura-of-exposed-weakness');
  lancar(e, 'spell-aura-of-sapped-strength');
  const r = lancar(e, 'spell-flame-strike', m);
  if (r.conjurando) { h.conjurando.fim = 0; Acoes.concluirConjuracao(e, h, PERSONAGEM); }
  assert.ok(Reforcos.vulnerabilidade(m, 'fire', agora) > 1);
  assert.equal(Reforcos.vulnerabilidade(m, 'physical', agora), 1);
  assert.ok(Reforcos.forcaDoBicho(m, agora) < 1, 'bate mais fraco');
  // A marca vence.
  assert.equal(Reforcos.forcaDoBicho(m, agora + 60_000), 1);
});

test('Shared Conservation: a cura recebida vale mais', { skip: doClassico("Reforços do Draevor (Master of Flames, Blood Rage, Haste, Shared Conservation, Chivalrous Challenge, Cancel Magic Shield)") }, () => {
  const e = comSkills(personagemDeTeste({ vocacao: 'druid', level: 200 }), ['spell-shared-conservation']);
  naCacada(e);
  assert.equal(Reforcos.bonus(e.hunt, 'curaRecebida'), 0);
  lancar(e, 'spell-shared-conservation');
  assert.equal(Reforcos.bonus(e.hunt, 'curaRecebida'), 10);
});

test('provocação: Chivalrous Challenge faz os bichos a até 7 sqm (até 6) virem atrás de você', { skip: doClassico("Reforços do Draevor (Master of Flames, Blood Rage, Haste, Shared Conservation, Chivalrous Challenge, Cancel Magic Shield)") }, () => {
  const e = comSkills(personagemDeTeste({ vocacao: 'knight', level: 200 }), ['spell-chivalrous-challenge']);
  const h = naCacada(e);
  for (let i = 1; i <= 9; i++) h.monstros.push(Object.assign(criarMonstro({ key: 'troll', x: h.pos.x + (i <= 8 ? 5 : 20), y: h.pos.y + (i % 3) }, null), { perseguindo: false }));
  lancar(e, 'spell-chivalrous-challenge');
  assert.equal(h.monstros.filter((m) => m.perseguindo).length, 6); // (o bicho do começo, a 3 sqm, conta: é um dos 6 mais perto)
});

test('Magic Wall e Wild Growth são runas de campo (tag ground), não projétil de alvo único', () => {
  for (const id of ['rune-magic-wall-rune', 'rune-wild-growth-rune']) {
    const tags = G.DEFS.get(G.ITEM_DA_ACAO.get(id)).tags;
    assert.ok(tags.includes('ground'));
    assert.ok(!tags.includes('projectile') && !tags.includes('single'));
  }
});

test('cancelamento por dados: o Cancel Magic Shield só sai com o escudo ligado, e o desliga', { skip: doClassico("Reforços do Draevor (Master of Flames, Blood Rage, Haste, Shared Conservation, Chivalrous Challenge, Cancel Magic Shield)") }, () => {
  const e = comSkills(personagemDeTeste({ vocacao: 'sorcerer', level: 200 }), ['spell-magic-shield', 'spell-cancel-magic-shield']);
  const h = naCacada(e);
  const slot = Acoes.PAPEL_DO_SLOT.indexOf(cru('spell-cancel-magic-shield').papeis[0]);
  e.actions = Array(Acoes.SLOTS).fill(null);
  Acoes.definir(e, { slot, value: { id: 'spell-cancel-magic-shield' } });
  assert.equal(Acoes.disparar(e, h, PERSONAGEM, slot, null).motivo, 'SEM_ESCUDO');
  lancar(e, 'spell-magic-shield');
  assert.ok(Acoes.temBuff(h, 'shield'));
  lancar(e, 'spell-cancel-magic-shield');
  assert.ok(!Acoes.temBuff(h, 'shield'));
});
