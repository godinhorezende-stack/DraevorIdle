// As ÁREAS DE EFEITO (auditoria de 01/10): a geometria compartilhada (`engine/areas.mjs`)
// e a regra que importa — as casas que levam DANO são exatamente as casas que vão para
// a TELA, em toda direção e posição. O bug que abriu a auditoria: a parte de CIMA da
// Rage of the Skies "não levava dano" — o dano saía; a tela é que cortava os 25 primeiros
// efeitos e números (teto de 60, ficando com os últimos; a forma vem de cima para baixo).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Areas from '../engine/areas.mjs';
import * as Acoes from '../systems/acoes.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Ficha from '../systems/ficha.mjs';
import * as Treino from '../systems/treino.mjs';
import * as G from '../systems/skills/gemas.mjs';
import * as Mecanicas from '../systems/mobs/mecanicas.mjs';
import * as Raridade from '../systems/mobs/raridade.mjs';
import { eventosDoQuadro } from '../websocket/quadro.mjs';
import { ACTION_CATALOG, ITEM_CATALOG } from '../systems/dados.mjs';
import { criarMonstro } from '../systems/hunt/monstros.mjs';
import { personagemDeTeste, PERSONAGEM, comSkills, HUNT_DE_TESTE } from './apoio.mjs';
import { aAdaptar, doClassico } from './apoio-migracao.mjs';

const HP = 1e12;
const k = Areas.chave;
const conjunto = (casas) => new Set(casas.map(k));
const COM_FORMA = [...ACTION_CATALOG.spells, ...ACTION_CATALOG.runes].filter((e) => e.papeis?.[0] === 'attack' && e.forma?.length && G.ITEM_DA_ACAO.has(e.id));

// ---------------------------------------------------------------- a geometria

test('geometria: quadrado e círculo simétricos nos quatro lados', () => {
  assert.equal(Areas.quadrado({ x: 0, y: 0 }, 1).length, 9);
  assert.equal(Areas.quadrado({ x: 0, y: 0 }, 2).length, 25);
  for (const r of [1, 2, 3, 4, 6]) {
    const c = Areas.circulo({ x: 0, y: 0 }, r);
    const lado = (f) => c.filter(f).length;
    const [cima, baixo, esq, dir] = [lado((p) => p.y < 0), lado((p) => p.y > 0), lado((p) => p.x < 0), lado((p) => p.x > 0)];
    assert.ok(cima === baixo && esq === dir && cima === esq, `círculo ${r}: ${cima}/${baixo}/${esq}/${dir}`);
  }
});

test('geometria: girar 4 vezes volta ao começo; a forma para o norte vira para cada lado certo', () => {
  for (const d of [[0, -1], [1, -2], [-3, 0], [2, 5]]) {
    let g = d;
    for (let i = 0; i < 4; i++) g = Areas.girar(g, 1);
    assert.deepEqual(g, d);
  }
  const onda = [[-1, -1], [0, -1], [1, -1], [0, -2]];
  const lado = { 0: (c) => c.y < 0, 1: (c) => c.x > 0, 2: (c) => c.y > 0, 3: (c) => c.x < 0 };
  for (const dir of [0, 1, 2, 3]) assert.ok(Areas.daForma(onda, { x: 0, y: 0 }, dir).every(lado[dir]), `dir ${dir}`);
});

test('geometria: reta nas 8 direções, feixe nos dois eixos, aumentar/concentrar, e o evento da tela ida e volta', () => {
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
    const r = Areas.reta({ x: 0, y: 0 }, { x: dx * 3, y: dy * 3 }, 5);
    assert.equal(r.length, 5);
    assert.ok(r.every((c, i) => c.x === dx * (i + 1) && c.y === dy * (i + 1)));
  }
  assert.ok(Areas.feixe({ x: 0, y: 0 }, { x: 0, y: -5 }, 4).every((c) => c.x === 0 && c.y < 0));
  assert.ok(Areas.feixe({ x: 0, y: 0 }, { x: -5, y: 1 }, 4).every((c) => c.y === 0 && c.x < 0));
  const q = Areas.quadrado({ x: 0, y: 0 }, 1);
  assert.equal(Areas.mudar(q, 1).length, 25);
  assert.equal(Areas.mudar(q, -1).length, 1);
  const centro = { x: 50, y: 40 };
  const casas = Areas.daForma([[0, -6], [3, 2], [-1, 0]], centro);
  assert.deepEqual(conjunto(Areas.casasDoEvento({ ...centro, casas: Areas.paraTela(casas, centro) })), conjunto(casas));
  assert.deepEqual(conjunto(Areas.casasDoEvento({ x: 5, y: 5, lado: 3 })), conjunto(Areas.quadrado({ x: 5, y: 5 }, 1)));
});

test('geometria: quem está na área, por índice de casa — rápido com muitos bichos', () => {
  const casas = Areas.circulo({ x: 0, y: 0 }, 6);
  const bichos = [];
  for (let x = -40; x <= 40; x++) for (let y = -40; y <= 40; y++) bichos.push({ x, y });
  const inicio = performance.now();
  const dentro = Areas.dentro(casas, bichos);
  assert.ok(performance.now() - inicio < 30, 'até 30 ms para 6.561 bichos');
  assert.equal(dentro.length, casas.length);
});

// ---------------------------------------------------------------- as magias de verdade

function montar(ids, supports = []) {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 600 });
  Treino.garantir(e);
  comSkills(e, ids);
  if (supports.length) {
    const SUP = (id) => [...G.DEFS.values()].find((d) => d.tipo === 'support' && d.id === id).itemId;
    const arma = Object.values(ITEM_CATALOG).find((i) => i.name === 'wand of vortex');
    e.equipment.weapon = { id: Number(arma.id), count: 1, soquetes: { abertos: 4, links: [true, true, true], gemas: [G.novaGema(G.ITEM_DA_ACAO.get(ids[0])), ...supports.map((s) => G.novaGema(SUP(s))), ...Array(3 - supports.length).fill(null)] } };
    Ficha.invalidar(e);
  }
  assert.ok(Cacadas.entrar(e, { huntId: HUNT_DE_TESTE, mode: 'auto' }).ok);
  const h = e.hunt;
  delete h.instancia;
  h.respawns = [];
  e.maxMana = e.mana = 1e12;
  e.maxHp = e.hp = 1e12;
  return e;
}

/** Bichos em TODAS as casas a até `raio` do personagem (fora a dele); devolve a lista. */
function encher(e, raio = 8) {
  const h = e.hunt;
  h.monstros = [];
  for (let dx = -raio; dx <= raio; dx++) for (let dy = -raio; dy <= raio; dy++) {
    if (!dx && !dy) continue;
    h.monstros.push(Object.assign(criarMonstro({ key: 'troll', x: h.pos.x + dx, y: h.pos.y + dy }, null), { hp: HP, maxHp: HP }));
  }
  return h.monstros;
}

/** Lança `id` no `alvo` e devolve `{ atingidas, desenhadas }` (conjuntos de casas). */
function lancar(e, id, alvo) {
  const h = e.hunt;
  e.actions = Array(Acoes.SLOTS).fill(null);
  const slot = Acoes.PAPEL_DO_SLOT.indexOf('attack');
  assert.ok(Acoes.definir(e, { slot, value: { id } }).ok, id);
  h.cooldowns = {};
  delete h.ultimoAtaqueEm;
  delete h.conjurando;
  const r = Acoes.disparar(e, h, PERSONAGEM, slot, alvo);
  assert.ok(r.ok, `${id}: ${r.erro}`);
  const areas = r.eventos.filter((x) => x.t === 'area');
  assert.equal(areas.length, 1, `${id}: um evento de área`);
  return {
    atingidas: conjunto(h.monstros.filter((m) => m.hp < HP)),
    desenhadas: conjunto(Areas.casasDoEvento(areas[0])),
    evento: areas[0],
  };
}
const ocupadas = (e) => conjunto(e.hunt.monstros);
const iguais = (a, b, msg) => assert.deepEqual([...a].sort(), [...b].sort(), msg);

test('Rage of the Skies: as 85 casas levam dano — a parte de CIMA também — e a tela recebe exatamente as mesmas', { skip: doClassico("Formas das magias de área do Draevor (Rage of the Skies, 39 skills)") }, () => {
  const e = montar(['spell-rage-of-the-skies']);
  encher(e);
  const { atingidas, desenhadas, evento } = lancar(e, 'spell-rage-of-the-skies', e.hunt.monstros[0]);
  assert.equal(evento.casas.length, 85);
  const p = e.hunt.pos;
  const acima = [...atingidas].filter((c) => Number(c.split(',')[1]) < p.y);
  const abaixo = [...atingidas].filter((c) => Number(c.split(',')[1]) > p.y);
  assert.equal(acima.length, 36, 'as 6 linhas de cima');
  assert.equal(abaixo.length, 36, 'as 6 linhas de baixo');
  // A tela: as mesmas casas (menos a do personagem, onde não há bicho).
  iguais(atingidas, new Set([...desenhadas].filter((c) => c !== k(p))));
});

test('Rage of the Skies: a mesma área em várias posições do mapa (bordas, perto de x/y = 0) e com o personagem virado para qualquer lado', { skip: doClassico("Formas das magias de área do Draevor (Rage of the Skies, 39 skills)") }, () => {
  for (const pos of [{ x: 1, y: 1 }, { x: 2, y: 60 }, { x: 120, y: 3 }, { x: 64, y: 64 }]) {
    for (const dir of [0, 1, 2, 3]) {
      const e = montar(['spell-rage-of-the-skies']);
      Object.assign(e.hunt.pos, pos, { dir });
      encher(e);
      const { atingidas, desenhadas } = lancar(e, 'spell-rage-of-the-skies', e.hunt.monstros[0]);
      assert.equal(atingidas.size, 84, `pos ${pos.x},${pos.y} dir ${dir}`);
      iguais(atingidas, new Set([...desenhadas].filter((c) => c !== k(e.hunt.pos))));
    }
  }
});

test(`todas as ${COM_FORMA.length} skills de ataque com forma: o dano cai exatamente nas casas desenhadas, nos quatro lados`, { skip: doClassico("As 297 skills de ataque do Draevor com forma desenhada") }, () => {
  assert.ok(COM_FORMA.length >= 30);
  const lados = [[0, -2], [2, 0], [0, 2], [-2, 0]];
  for (const entry of COM_FORMA) {
    // O alvo a até 2 casas, dentro do alcance da skill (Shield Bash: 1).
    const d = Math.max(1, Math.min(2, entry.range || 2));
    const perto = lados.map(([x, y]) => [Math.sign(x) * d, Math.sign(y) * d]);
    for (const [dx, dy] of Areas.direcional(entry.forma) ? perto : [perto[0]]) {
      const e = montar([entry.id]);
      encher(e);
      const alvo = e.hunt.monstros.find((m) => m.x === e.hunt.pos.x + dx && m.y === e.hunt.pos.y + dy);
      e.hunt.alvo = alvo.uid;
      const { atingidas, desenhadas } = lancar(e, entry.id, alvo);
      assert.ok(atingidas.size > 0, `${entry.id}: ninguém levou`);
      // Toda casa desenhada que tem bicho levou; nenhum bicho fora das desenhadas levou.
      iguais(atingidas, new Set([...desenhadas].filter((c) => ocupadas(e).has(c))), `${entry.id} (${dx},${dy})`);
      // A forma direcional vira para o lado do alvo.
      if (Areas.direcional(entry.forma)) {
        const p = e.hunt.pos;
        // (A casa do próprio personagem, que algumas ondas incluem — Chill Out —, não é de lado nenhum.)
        const doLado = [...desenhadas]
          .filter((c) => c !== k(p))
          .map((c) => c.split(',').map(Number))
          .every(([x, y]) => (dx ? Math.sign(x - p.x) === Math.sign(dx) : Math.sign(y - p.y) === Math.sign(dy)));
        assert.ok(doLado, `${entry.id}: a onda não virou para (${dx},${dy})`);
      }
    }
  }
});

test('gemas de área: Area of Effect aumenta e Concentrated Effect reduz — e a tela acompanha', { skip: aAdaptar("Increased Area of Effect/Concentrated Effect existem no PoE; o teste usa Rage of the Skies") }, () => {
  const base = montar(['spell-rage-of-the-skies']);
  encher(base);
  const normal = lancar(base, 'spell-rage-of-the-skies', base.hunt.monstros[0]).desenhadas.size;
  for (const [sup, cresce] of [['area-of-effect', true], ['concentrated-effect', false]]) {
    const e = montar(['spell-rage-of-the-skies'], [sup]);
    encher(e, 9);
    const { atingidas, desenhadas } = lancar(e, 'spell-rage-of-the-skies', e.hunt.monstros[0]);
    assert.ok(cresce ? desenhadas.size > normal : desenhadas.size < normal, `${sup}: ${desenhadas.size} casas (normal ${normal})`);
    iguais(atingidas, new Set([...desenhadas].filter((c) => ocupadas(e).has(c))), sup);
  }
});

test('explosão das gemas: o quadrado que leva dano é o mesmo que a tela desenha', { skip: doClassico("Formas das magias de área do Draevor (Rage of the Skies, 39 skills)") }, () => {
  const e = montar(['spell-flame-strike'], ['explosion']);
  encher(e, 4);
  const h = e.hunt;
  const alvo = h.monstros.find((m) => m.x === h.pos.x + 3 && m.y === h.pos.y);
  e.actions = Array(Acoes.SLOTS).fill(null);
  const slot = Acoes.PAPEL_DO_SLOT.indexOf('attack');
  assert.ok(Acoes.definir(e, { slot, value: { id: 'spell-flame-strike' } }).ok);
  h.cooldowns = {};
  let r = Acoes.disparar(e, h, PERSONAGEM, slot, alvo);
  let ev = r.eventos;
  if (r.conjurando) {
    h.conjurando.fim = 0;
    ev = Acoes.concluirConjuracao(e, h, PERSONAGEM);
  }
  const ex = ev.find((x) => x.t === 'explosao');
  const naTela = conjunto(Areas.casasDoEvento(ex));
  const daExplosao = conjunto(h.monstros.filter((m) => ev.some((x) => x.t === 'dmg' && x.uid === m.uid && x.fonte === 'explosao')));
  iguais(daExplosao, naTela);
});

test('mob Explosivo: o quadrado desenhado é o raio que fere — dentro fere, fora não', { skip: doClassico("Mob Explosivo do Draevor (raridade de monstro do Draevor) num mapa do Draevor") }, () => {
  for (const [dx, fere] of [[1, true], [2, false]]) {
    const e = montar(['spell-flame-strike']);
    const h = e.hunt;
    const m = Raridade.aplicar(criarMonstro({ key: 'troll', x: h.pos.x + dx, y: h.pos.y }, null), { raridade: 'raro', modificadores: ['explosivo'] });
    h.monstros = [m];
    e.hp = e.maxHp = 1e6;
    // A explosão é 8% da vida do mob: com a vida de um troll ela some na proteção; aqui, um mob grande.
    m.maxHp = 1e5;
    m.hp = 0;
    const ev = [];
    Mecanicas.aoMorrer(e, h, null, m, ev);
    const area = ev.find((x) => x.t === 'area');
    assert.deepEqual(conjunto(Areas.casasDoEvento(area)), conjunto(Areas.quadrado(m, 1)));
    assert.equal(conjunto(Areas.casasDoEvento(area)).has(k(h.pos)), fere);
    assert.equal(e.hp < 1e6, fere, `a ${dx} casa(s): ${fere ? 'fere' : 'não fere'}`);
  }
});

test('a tela recebe a área se QUALQUER casa dela aparece (a de 85 casas passa da janela); longe de tudo, não', () => {
  const casas = Areas.paraTela(Areas.circulo({ x: 0, y: 0 }, 6), { x: 0, y: 0 });
  const centro = { x: 100, y: 100 };
  const bordaDaTela = { t: 'area', id: 41, x: 100 + 14, y: 100, casas };
  const longe = { t: 'area', id: 41, x: 400, y: 400, casas };
  assert.deepEqual(eventosDoQuadro([bordaDaTela, longe], centro, false), [bordaDaTela]);
});
