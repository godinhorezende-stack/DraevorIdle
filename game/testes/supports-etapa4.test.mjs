// Etapa 4 do plano: as supports de dano por elemento, crítico, velocidade, recurso,
// duração e os ESTADOS nos bichos (Ignite, Freeze, Slow, Stun) — genéricas por tag.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Acoes from '../systems/acoes.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Ficha from '../systems/ficha.mjs';
import * as Treino from '../systems/treino.mjs';
import * as G from '../systems/skills/gemas.mjs';
import * as Estados from '../systems/skills/estados.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import { criarMonstro, moverMonstros } from '../systems/hunt/monstros.mjs';
import { golpesDosMonstros } from '../systems/hunt/combate.mjs';
import { personagemDeTeste, PERSONAGEM } from './apoio.mjs';

const GEMA = (acao) => G.ITEM_DA_ACAO.get(acao);
const SUP = (id) => [...G.DEFS.values()].find((d) => d.tipo === 'support' && d.id === id).itemId;
const idDe = (nome) => Number(Object.values(ITEM_CATALOG).find((i) => i.name === nome).id);
const FLAME = 'spell-flame-strike';

function montar(vocacao, acao, supports = []) {
  const e = personagemDeTeste({ vocacao, level: 300 });
  Treino.garantir(e);
  const gemas = [G.novaGema(GEMA(acao)), ...supports.map((s) => G.novaGema(SUP(s)))];
  e.equipment.weapon = { id: idDe(vocacao === 'knight' ? 'fire sword' : 'wand of vortex'), count: 1, soquetes: { abertos: 4, links: [true, true, true], gemas: [...gemas, ...Array(4 - gemas.length).fill(null)] } };
  Ficha.invalidar(e);
  assert.ok(Cacadas.entrar(e, { huntId: 'troll-cave', mode: 'auto' }).ok);
  const h = e.hunt;
  delete h.instancia;
  h.respawns = [];
  h.monstros = [];
  e.maxHp = e.hp = 1e9;
  e.maxMana = e.mana = 1e9;
  return e;
}
const bicho = (e, dx, dy, hp = 1e12) => {
  const m = Object.assign(criarMonstro({ key: 'troll', x: e.hunt.pos.x + dx, y: e.hunt.pos.y + dy }, null), { hp, maxHp: hp });
  e.hunt.monstros.push(m);
  return m;
};
function lancar(e, acao, alvo) {
  const h = e.hunt;
  e.actions = Array(Acoes.SLOTS).fill(null);
  const slot = Acoes.PAPEL_DO_SLOT.indexOf([...Acoes.catalogo(e).spells, ...Acoes.catalogo(e).runes].find((x) => x.id === acao).papeis[0]);
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

test('as 39 supports: cada uma com gema, nome e efeito de chave conhecida', () => {
  const conhecidas = new Set(['danoPct', 'curaPct', 'castTimePct', 'custoPct', 'recargaPct', 'critChance', 'critDano', 'alvosExtras', 'danoDosExtrasPct', 'perfurar', 'danoDaPerfuracaoPct', 'bifurcar', 'danoDaBifurcacaoPct', 'encadear', 'danoDoEncadeamentoPct', 'retornar', 'danoDoRetornoPct', 'explosaoPct', 'segundaExplosaoPct', 'areaExtra', 'leechVidaPct', 'leechManaPct', 'custoEmVida', 'duracaoPct', 'igniteChance', 'ignitePct', 'congelarChance', 'lentidaoPct', 'atordoarChance']);
  const sups = [...G.DEFS.values()].filter((d) => d.tipo === 'support');
  assert.equal(sups.length, 39);
  for (const d of sups) for (const k of Object.keys(d.suporte.efeito)) assert.ok(conhecidas.has(k), `${d.nome}: ${k}`);
});

test('dano por elemento: Fire Damage vale na Flame Strike e não na Energy Strike', () => {
  const fire = G.DEFS.get(SUP('fire-damage')).suporte;
  assert.ok(G.compativel(fire, G.DEFS.get(GEMA(FLAME)).tags));
  assert.ok(!G.compativel(fire, G.DEFS.get(GEMA('spell-energy-strike')).tags));
  const e = montar('sorcerer', FLAME, ['fire-damage', 'critical-damage']);
  const ef = G.efeitoNaSkill(e, FLAME);
  assert.equal(ef.danoPct, 25);
  assert.equal(ef.critDano, 40);
});

test('Ignite: o bicho atingido queima — o % do acerto sai em pulsos no tique', () => {
  const e = montar('sorcerer', FLAME, ['ignite']);
  const m = bicho(e, 2, 0);
  lancar(e, FLAME, m);
  assert.ok(m.estados?.queimando?.falta > 0, 'queimando');
  const vidaAntes = m.hp;
  const ev = [];
  const agora = (e.hunt.clock ?? Date.now()) + 1000;
  Estados.tique(e.hunt, ev, agora);
  assert.ok(m.hp < vidaAntes, 'o pulso tirou vida');
  assert.ok(ev.some((x) => x.queimando));
});

test('Freeze / Stun: o bicho não anda nem ataca enquanto dura', () => {
  const e = montar('sorcerer', FLAME, []);
  const m = bicho(e, 1, 0);
  const agora = e.hunt.clock ?? Date.now();
  m.estados = { congelado: { ate: agora + 2000 } };
  assert.equal(Estados.podeAgir(m, agora), false);
  e.hp = 1e9;
  m.proximoGolpe = 0;
  const ev = golpesDosMonstros(e, e.hunt, PERSONAGEM);
  assert.equal(ev.filter((x) => x.t === 'dmg' && x.uid === 'player').length, 0, 'congelado não bate');
  assert.equal(Estados.podeAgir(m, agora + 2500), true, 'passa');
  // Longe: congelado não anda.
  const longe = bicho(e, 5, 0);
  longe.estados = { atordoado: { ate: agora + 1500 } };
  longe.perseguindo = true;
  longe.proximoPasso = 0;
  const antes = { x: longe.x, y: longe.y };
  moverMonstros(e.hunt, Cacadas.gradeDaHunt(e.hunt.hunt ?? { id: 'troll-cave' }), agora);
  assert.deepEqual({ x: longe.x, y: longe.y }, antes);
});

test('Slow: o bicho lento anda e ataca mais devagar (fator > 1); com a support, o acerto põe lento', () => {
  const e = montar('sorcerer', FLAME, ['slow']);
  const m = bicho(e, 2, 0);
  lancar(e, FLAME, m);
  const agora = e.hunt.clock ?? Date.now();
  assert.ok(Estados.fatorDeLentidao(m, agora) > 1);
});

test('Life Cost: o custo sai da vida, não da mana; Life/Mana Leech devolvem parte do dano', () => {
  const e = montar('sorcerer', FLAME, ['life-cost', 'life-leech', 'mana-leech']);
  const m = bicho(e, 2, 0);
  e.maxHp = 1e9;
  e.hp = 5e8;
  const manaAntes = e.mana;
  const ev = lancar(e, FLAME, m);
  assert.equal(e.mana, manaAntes, 'mana intacta (pagou com vida; a volta do Mana Leech vem em heal)');
  assert.ok(ev.some((x) => x.t === 'heal' && x.color === '#00ff66'), 'life leech');
});

test('Skill Duration: o reforço dura mais', () => {
  const e = montar('sorcerer', 'spell-haste', ['skill-duration']);
  bicho(e, 3, 3);
  lancar(e, 'spell-haste');
  const agora = e.hunt.clock ?? Date.now();
  const dur = e.hunt.buffs['spell-haste'].ate - agora;
  assert.ok(dur > 33_000 * 1.25, `${dur}`);
});

test('Faster Attacks: recarga menor só nas skills físicas', () => {
  const s = G.DEFS.get(SUP('faster-attacks')).suporte;
  assert.ok(G.compativel(s, G.DEFS.get(GEMA('spell-brutal-strike')).tags));
  assert.ok(!G.compativel(s, G.DEFS.get(GEMA(FLAME)).tags));
});
