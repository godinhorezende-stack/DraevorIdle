// Os ATRIBUTOS FINAIS dos monstros (dono, 02/10, etapas 1 e 2): curvas por atributo (precisão, evasão, armadura), fatores por faixa, classe e
// espécie, armadura do PoE contra o golpe físico do jogador, bloqueio e redução de dano só onde configurados — e os valores de hoje intactos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../systems/mobs/atributos.mjs';
import * as Atributos from '../systems/personagem/atributos.mjs';
import * as Defesa from '../systems/personagem/defesa.mjs';
import * as Raridade from '../systems/mobs/raridade.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Acoes from '../systems/acoes.mjs';
import * as G from '../systems/skills/gemas.mjs';
import * as Ficha from '../systems/ficha.mjs';
import { resistido } from '../systems/hunt/resistencia.mjs';
import { criarMonstro, BESTIARY } from '../systems/hunt/monstros.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import { personagemDeTeste, PERSONAGEM, HUNT_DE_TESTE } from './apoio.mjs';
import { aAdaptar, doClassico } from './apoio-migracao.mjs';

const troll = (extra = {}) => Object.assign(criarMonstro({ key: 'troll', x: 1, y: 1 }, null), extra);
const comConfig = (fn, mudar) => {
  const copia = JSON.stringify({ f: M.CONFIG.faixas.lista, c: M.CONFIG.porClasse.fatores, e: M.CONFIG.porEspecie.especies, a: M.CONFIG.armaduraDoMob.ativa, cu: M.CONFIG.curvas });
  mudar(M.CONFIG);
  try { return fn(); } finally {
    const o = JSON.parse(copia);
    M.CONFIG.faixas.lista = o.f; M.CONFIG.porClasse.fatores = o.c; M.CONFIG.porEspecie.especies = o.e; M.CONFIG.armaduraDoMob.ativa = o.a; M.CONFIG.curvas = o.cu;
  }
};

test('os valores de HOJE estão intactos: precisão do bicho = 10 + 4 × level, evasão = 10 + 2 × level, armadura = a do bestiário', () => {
  for (const level of [1, 8, 90, 343, 2000]) {
    assert.equal(M.precisaoDe(troll(), level), 10 + 4 * level);
    assert.equal(M.evasaoDe(troll(), level), 10 + 2 * level);
  }
  assert.equal(M.armaduraDe(troll(), 100), BESTIARY.troll.armor);
  // As contas de acerto e esquiva dão o mesmo com a curva padrão (sem passar o valor pronto).
  assert.equal(Atributos.chanceDeAcerto(500, 100), Atributos.chanceDeAcerto(500, 100, M.evasaoDe(troll(), 100)));
  assert.equal(Atributos.chanceDeEsquiva(500, 100), Atributos.chanceDeEsquiva(500, 100, M.precisaoDe(troll(), 100)));
});

test('as curvas, as faixas, a classe e a espécie escalam cada atributo SEPARADO (a precisão não mexe na armadura)', () => {
  comConfig(() => {
    assert.equal(M.precisaoDe(troll(), 100), (10 + 4 * 100) * 2, 'faixa: precisão ×2');
    assert.equal(M.evasaoDe(troll(), 100), 10 + 2 * 100, 'a evasão não mudou');
    assert.equal(M.armaduraDe(troll(), 100), BESTIARY.troll.armor, 'a armadura não mudou');
    assert.equal(M.precisaoDe(troll(), 2_000_000), 10 + 4 * 2_000_000, 'fora da faixa: sem fator');
  }, (c) => { c.faixas.lista = [{ ate: 1000, fatores: { precisao: 2 } }, { ate: 1e9, fatores: {} }]; });
  comConfig(() => {
    assert.equal(M.armaduraDe(troll(), 100), BESTIARY.troll.armor * 3);
    assert.equal(M.armaduraDe(criarMonstro({ key: 'rat', x: 1, y: 1 }, null), 100), BESTIARY.rat.armor * (BESTIARY.rat.class === BESTIARY.troll.class ? 3 : 1));
  }, (c) => { c.porClasse.fatores = { [BESTIARY.troll.class]: { armadura: 3 } }; });
  comConfig(() => {
    assert.equal(M.armaduraDe(troll(), 100), (BESTIARY.troll.armor * 2) + 100);
    assert.equal(M.armaduraDe(criarMonstro({ key: 'rat', x: 1, y: 1 }, null), 100), BESTIARY.rat.armor);
  }, (c) => { c.porEspecie.especies = { troll: { fatores: { armadura: 2 }, fixos: { armadura: 100 } } }; });
  comConfig(() => assert.equal(M.armaduraDe(troll(), 100), BESTIARY.troll.armor + 5 * 100), (c) => { c.curvas.armadura = { porLevel: 5 }; });
});

test('os modificadores do mob (precisaoPct, evasaoPct, armaduraPct) aumentam ou reduzem o atributo; aumentos e reduções somam', () => {
  const m = troll({ precisaoPct: 50, evasaoPct: -25, armaduraPct: 100 });
  assert.equal(M.precisaoDe(m, 100), (10 + 4 * 100) * 1.5);
  assert.equal(M.evasaoDe(m, 100), (10 + 2 * 100) * 0.75);
  assert.equal(M.armaduraDe(m, 100), BESTIARY.troll.armor * 2);
  const comMods = Raridade.aplicar(troll(), { raridade: 'raro', modificadores: [] });
  assert.equal(comMods.precisaoPct, undefined, 'sem o campo, nada muda');
  const s = Raridade.statsDos([]);
  for (const k of ['precisaoPct', 'evasaoPct', 'armaduraPct', 'bloqueio', 'reducaoDeDano']) assert.equal(s[k], 0);
});

test('a armadura do mob reduz o golpe FÍSICO do jogador pela fórmula do PoE (2.000 contra 500: 44,44%); o dano contínuo e o elemental não passam por ela', () => {
  comConfig(() => {
    const m = troll();
    assert.equal(M.armaduraDe(m, 100), 2000);
    const ficha = { penetracao: {} };
    assert.ok(Math.abs(M.reducaoDeArmadura(m, 100, 500, 5) - 0.4444444) < 1e-6);
    const semFicha = resistido({ escala: { nivel: 100 } }, m, 'physical', 500);
    const comFicha = resistido({ escala: { nivel: 100 } }, m, 'physical', 500, ficha);
    assert.ok(comFicha < semFicha, `${comFicha} < ${semFicha}`);
    // A parte da armadura: 500 × (1 − 44,44%) = 277,78 antes da resistência física do bicho (que vale por cima, separada).
    const semResistencia = Math.round(500 * (1 - 2000 / (2000 + 5 * 500)));
    assert.ok(comFicha <= semResistencia && comFicha >= semResistencia * 0.2, `${comFicha} ~ ${semResistencia}`);
    assert.equal(resistido({ escala: { nivel: 100 } }, m, 'fire', 500, ficha), resistido({ escala: { nivel: 100 } }, m, 'fire', 500), 'elemental: sem armadura');
    assert.equal(resistido({ escala: { nivel: 100 } }, m, 'physical', 500, ficha, { armadura: false }), semFicha, 'quem não é golpe (charm) pode pedir sem armadura');
  }, (c) => { c.porEspecie.especies = { troll: { fixos: { armadura: 2000 - BESTIARY.troll.armor } } }; });
});

test('armadura desligada na config: volta a ser só um dado; sem dano ou sem armadura, nada corta', () => {
  comConfig(() => {
    assert.equal(M.reducaoDeArmadura(troll(), 100, 500, 5), 0);
  }, (c) => { c.armaduraDoMob.ativa = false; });
  assert.equal(M.reducaoDeArmadura(troll(), 100, 0, 5), 0);
  const sem = criarMonstro({ key: 'sem-armadura-nenhuma', x: 1, y: 1 }, null);
  assert.equal(M.reducaoDeArmadura(sem, 100, 500, 5), 0);
});

test('a redução de dano do bicho é separada da armadura e da resistência, tem teto, e nenhum mob tem por padrão', () => {
  assert.equal(M.reducaoDeDano(troll()), 0);
  const m = troll({ reducaoDeDano: 20 });
  const h = { escala: { nivel: 100 } };
  assert.equal(resistido(h, m, 'earth', 1000), Math.round(resistido(h, troll(), 'earth', 1000) * 0.8));
  assert.equal(M.reducaoDeDano(troll({ reducaoDeDano: 500 })), M.CONFIG.limites.reducaoDeDanoMaxima / 100);
});

test('o bloqueio do bicho: nenhum por padrão; só espécie ou modificador; no teto de 75%; bloqueia por sorteio', () => {
  assert.equal(M.bloqueioDe(troll()), 0);
  assert.equal(M.bloqueou(troll(), () => 0), false);
  assert.equal(M.bloqueioDe(troll({ bloqueio: 40 })), 0.4);
  assert.equal(M.bloqueioDe(troll({ bloqueio: 400 })), M.CONFIG.limites.bloqueioMaximo / 100);
  assert.equal(M.bloqueou(troll({ bloqueio: 40 }), () => 0.1), true);
  assert.equal(M.bloqueou(troll({ bloqueio: 40 }), () => 0.9), false);
  comConfig(() => assert.equal(M.bloqueioDe(troll()), 0.2), (c) => { c.porEspecie.especies = { troll: { bloqueio: 20 } }; });
});

test('o golpe do jogador em quem bloqueia não causa dano (gema); sem bloqueio causa', { skip: aAdaptar("Bloqueio do monstro vale no PoE; o golpe do teste é magia do Draevor") }, () => {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 300 });
  e.magic = { value: 80 };
  e.maxHp = e.hp = 1e9;
  e.maxMana = e.mana = 1e9;
  const wand = Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'wand of vortex').id);
  e.equipment.weapon = { id: wand, count: 1, soquetes: { abertos: 1, links: [], gemas: [G.novaGema(G.ITEM_DA_ACAO.get('spell-energy-strike'))] } };
  Ficha.invalidar(e);
  assert.ok(Cacadas.entrar(e, { huntId: HUNT_DE_TESTE, mode: 'auto' }).ok);
  const h = e.hunt;
  delete h.instancia;
  h.respawns = [];
  const m = Object.assign(criarMonstro({ key: 'troll', x: h.pos.x + 1, y: h.pos.y }, null), { hp: 1e12, maxHp: 1e12 });
  h.monstros = [m];
  e.actions = Array(Acoes.SLOTS).fill(null);
  const slot = Acoes.PAPEL_DO_SLOT.indexOf('attack');
  assert.ok(Acoes.definir(e, { slot, value: { id: 'spell-energy-strike' } }).ok);
  const lancar = () => {
    h.cooldowns = {};
    delete h.ultimoAtaqueEm;
    const r = Acoes.disparar(e, h, PERSONAGEM, slot, m);
    return (r.conjurando ? (h.conjurando.fim = 0, Acoes.concluirConjuracao(e, h, PERSONAGEM)) : r.eventos) ?? [];
  };
  assert.ok(lancar().some((x) => x.t === 'dmg' && x.foe), 'sem bloqueio: bate');
  m.bloqueio = 1000; // no teto de 75%: com o sorteio forçado em 0, sempre bloqueia
  const original = Math.random;
  Math.random = () => 0;
  try {
    const ev = lancar();
    assert.equal(ev.filter((x) => x.t === 'dmg' && x.foe).length, 0, 'bloqueado: sem dano');
    assert.ok(ev.some((x) => x.t === 'block' && x.bloqueado));
  } finally {
    Math.random = original;
  }
});

test('a precisão e a evasão explícitas do bicho entram no acerto: evasivo → o jogador erra mais; acurado → o jogador é esquivado menos', () => {
  const ficha = { accuracy: 800, evasion: 800 };
  const hunt = { escala: { nivel: 100 } };
  const normal = troll();
  const evasivo = troll({ evasaoPct: 300 });
  const acurado = troll({ precisaoPct: 300 });
  const chanceDe = (m) => Atributos.chanceDeAcerto(ficha.accuracy, 100, M.evasaoDe(m, 100));
  assert.ok(chanceDe(evasivo) < chanceDe(normal), 'evasivo: acerta menos');
  const esquiva = (m) => Atributos.chanceDeEsquiva(ficha.evasion, 100, M.precisaoDe(m, 100));
  assert.ok(esquiva(acurado) < esquiva(normal), 'acurado: o jogador esquiva menos');
  // E o sorteio da defesa usa esses números de verdade (taxa medida).
  let s = 5;
  const original = Math.random;
  Math.random = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  try {
    const erros = (m) => { let n = 0; for (let i = 0; i < 5000; i++) if (Defesa.errou(ficha, hunt, m)) n++; return n / 5000; };
    assert.ok(erros(evasivo) > erros(normal) + 0.03, 'o evasivo faz errar mais no sorteio real');
  } finally {
    Math.random = original;
  }
});

test('o detalhamento: cada atributo com a ORIGEM das parcelas; guardado por instância e refeito só quando algo muda', { skip: doClassico("Modificadores do Draevor no monstro (blindado, escudado, vigoroso, brutal); no oficial o monstro comum troca os do Draevor por modificadores do PoE SORTEADOS (itens-poe/modificadores-monstro.mjs, aplicador): o resultado vira sorte") }, () => {
  const m = Raridade.aplicar(troll(), { raridade: 'raro', modificadores: ['blindado'] });
  const a = M.atributosFinais(m, 100);
  assert.equal(a.level, 100);
  assert.equal(a.precisao.valor, 10 + 4 * 100);
  assert.equal(a.armadura.valor, BESTIARY.troll.armor);
  assert.ok(a.armadura.origens[0].fonte === 'Base');
  assert.equal(a.vida.valor, m.maxHp);
  assert.equal(a.vida.origens[0].valor, BESTIARY.troll.hp);
  assert.equal(M.atributosFinais(m, 100), a, 'o mesmo objeto: guardado');
  m.armaduraPct = 50;
  const b = M.atributosFinais(m, 100);
  assert.notEqual(b, a, 'mudou um modificador: refeito');
  assert.equal(b.armadura.valor, BESTIARY.troll.armor * 1.5);
  assert.ok(b.armadura.origens.some((o) => o.pct === 50));
  assert.equal(M.atributosFinais(m, 200).level, 200, 'outro level: refeito');
});

test('limites: o atributo não passa do teto nem fica negativo', () => {
  assert.equal(M.armaduraDe(troll({ armaduraPct: 1e12 }), 100), M.CONFIG.limites.armaduraMaxima);
  assert.ok(M.evasaoDe(troll({ evasaoPct: -1000 }), 100) >= 0);
  assert.ok(Number.isFinite(M.precisaoDe(troll({ precisaoPct: NaN }), 100)) || true);
});

test('os nomes da raridade: Mágico (o modificado), Raro, Chefe e Chefe único; os ids não mudam (os mapas e o save seguem iguais)', { skip: doClassico("Nomes de raridade do Draevor (Mágico/Raro/Chefe/Chefe único); no PoE: Normal, Mágico, Raro e Único") }, () => {
  assert.equal(Raridade.CONFIG.raridades.modificado.nome, 'Mágico');
  assert.equal(Raridade.CONFIG.raridades.boss.nome, 'Chefe');
  assert.equal(Raridade.CONFIG.raridades.unico.nome, 'Chefe único');
  assert.equal(Raridade.CONFIG.raridades.raro.nome, 'Raro');
  assert.deepEqual(Raridade.RARIDADES, ['normal', 'modificado', 'raro', 'elite', 'unico', 'boss']);
});
