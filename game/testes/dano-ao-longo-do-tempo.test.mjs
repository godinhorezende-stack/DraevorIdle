// O DANO AO LONGO DO TEMPO (Etapa 4 do combate, dono 02/10): queimadura, veneno, sangramento e as outras fontes periódicas, num sistema só
// (`combate/dot.mjs`, config em `combate/dot.json`). Acumulação por tipo, resistência no pulso, sem crítico, sem acerto, sem penetração.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Dot from '../systems/combate/dot.mjs';
import * as Estados from '../systems/skills/estados.mjs';
import * as Acoes from '../systems/acoes.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Ficha from '../systems/ficha.mjs';
import * as Treino from '../systems/treino.mjs';
import * as G from '../systems/skills/gemas.mjs';
import { ACTION_CATALOG, ITEM_CATALOG } from '../systems/dados.mjs';
import { criarMonstro } from '../systems/hunt/monstros.mjs';
import { resistenciaEfetivaDe } from '../systems/hunt/resistencia.mjs';
import { personagemDeTeste, PERSONAGEM } from './apoio.mjs';

const mob = (extra = {}) => Object.assign(criarMonstro({ key: 'troll', x: 1, y: 1 }, null), { hp: 1e9, maxHp: 1e9, resist: {} }, extra);
const T = Dot.CONFIG.tipos;

test('config: queimadura (maior), veneno (empilha) e sangramento (renova), cada um com elemento, duração e pulso; teto de efeitos por bicho', () => {
  assert.equal(T.queimadura.acumulacao, 'maior');
  assert.equal(T.veneno.acumulacao, 'empilha');
  assert.equal(T.sangramento.acumulacao, 'renova');
  assert.deepEqual([T.queimadura.elemento, T.veneno.elemento, T.sangramento.elemento], ['fire', 'earth', 'physical']);
  for (const t of Object.values(T)) assert.ok(t.duracaoMs > 0 && t.pulsoMs > 0 && t.estado && t.cor);
  assert.ok(Dot.CONFIG.limites.efeitosPorBicho >= T.veneno.maxPilhas);
});

test('cada efeito tem identificador único, tipo, origem e o que falta pagar', () => {
  const m = mob();
  Dot.aplicar(m, { tipo: 'veneno', total: 600, origem: { fonte: 'gema', habilidade: 'spell-envenom' } }, 1000);
  Dot.aplicar(m, { tipo: 'veneno', total: 900, origem: { fonte: 'suporte' } }, 1000);
  const ids = m.dots.map((d) => d.id);
  assert.equal(new Set(ids).size, 2);
  assert.equal(m.dots[0].origem.habilidade, 'spell-envenom');
  assert.equal(Dot.restante(m, 'veneno'), 1500);
});

test('veneno EMPILHA: cada aplicação é uma pilha (soma), até o máximo; cheio, a mais forte substitui a mais fraca e a fraca não entra', () => {
  const m = mob();
  for (let i = 0; i < 25; i++) Dot.aplicar(m, { tipo: 'veneno', total: 100 + i }, 1000);
  assert.equal(Dot.dosDoTipo(m, 'veneno').length, T.veneno.maxPilhas, 'no máximo as pilhas do tipo');
  const antes = Dot.restante(m, 'veneno');
  assert.equal(Dot.aplicar(m, { tipo: 'veneno', total: 1 }, 1000), null, 'mais fraca que todas: não entra');
  assert.equal(Dot.restante(m, 'veneno'), antes);
  assert.equal(Dot.aplicar(m, { tipo: 'veneno', total: 10_000 }, 1000), 'envenenado', 'mais forte: substitui a mais fraca');
  assert.ok(Dot.restante(m, 'veneno') > antes);
  assert.equal(Dot.dosDoTipo(m, 'veneno').length, T.veneno.maxPilhas);
});

test('sangramento RENOVA: uma só; reaplicar renova a duração, fica com o maior dano que falta e o relógio dos pulsos continua', () => {
  const m = mob();
  Dot.aplicar(m, { tipo: 'sangramento', total: 500 }, 1000);
  const [d] = m.dots;
  const proximo = d.proximo;
  Dot.aplicar(m, { tipo: 'sangramento', total: 300 }, 3000);
  assert.equal(m.dots.length, 1);
  assert.equal(m.dots[0].falta, 500, 'o menor não substitui');
  assert.equal(m.dots[0].ate, 3000 + T.sangramento.duracaoMs, 'a duração renovou');
  assert.equal(m.dots[0].proximo, proximo, 'o relógio dos pulsos não reiniciou');
  Dot.aplicar(m, { tipo: 'sangramento', total: 900 }, 3500);
  assert.equal(m.dots[0].falta, 900, 'o maior fica');
});

test('queimadura (maior): uma só, a maior vale, e o relógio dos pulsos não reinicia', () => {
  const m = mob();
  Dot.aplicar(m, { tipo: 'queimadura', total: 400 }, 1000);
  const proximo = m.dots[0].proximo;
  assert.equal(Dot.aplicar(m, { tipo: 'queimadura', total: 200 }, 1200), null);
  assert.equal(Dot.aplicar(m, { tipo: 'queimadura', total: 800 }, 1400), 'queimando');
  assert.equal(m.dots.length, 1);
  assert.equal(m.dots[0].proximo, proximo);
});

test('efeitos de tipos DIFERENTES convivem no mesmo bicho; o limite de efeitos por bicho vale', () => {
  const m = mob();
  for (const tipo of Object.keys(T)) Dot.aplicar(m, { tipo, total: 500 }, 1000);
  assert.equal(m.dots.length, Object.keys(T).length);
  assert.deepEqual(Dot.ativosDe(m, 1100), Object.values(T).map((t) => t.estado));
  const cheio = mob();
  const limite = Dot.CONFIG.limites.efeitosPorBicho;
  cheio.dots = Array.from({ length: limite }, (_, i) => ({ id: `x${i}`, tipo: 'veneno', elemento: 'earth', falta: 10, porPulso: 1, ate: 1e9, proximo: 1e9 }));
  assert.equal(Dot.aplicar(cheio, { tipo: 'sangramento', total: 500 }, 1000), null, 'no teto: não entra outro tipo');
});

test('o pulso passa pela RESISTÊNCIA do bicho ao elemento, sem crítico e sem a penetração do atacante', () => {
  const m = mob({ resist: { earth: 90 } });
  Dot.aplicar(m, { tipo: 'veneno', total: 600 }, 1000);
  const porPulso = m.dots[0].porPulso;
  const ev = [];
  const hunt = { monstros: [m], clock: 2000 };
  const antes = m.hp;
  // A resistência do bicho a terra (o bestiário + o que ele ganhou), no teto, e SEM a penetração do atacante.
  const passa = 1 - resistenciaEfetivaDe(hunt, m, 'earth') / 100;
  assert.ok(passa < 0.6, 'o bicho resiste a terra');
  Dot.tique(hunt, ev, 2000);
  const pulso = ev.filter((x) => x.dot === 'veneno');
  assert.equal(pulso.length, 1);
  assert.equal(pulso[0].crit, undefined, 'sem crítico');
  assert.equal(antes - m.hp, Math.round(porPulso * passa), 'a resistência a terra vale nos pulsos');
  assert.equal(pulso[0].v, Math.round(porPulso * passa));
  assert.equal(pulso[0].color, T.veneno.cor);
});

test('a resistência do bicho acima do teto vale o teto no pulso (a penetração do atacante não entra no dano contínuo)', () => {
  const m = mob({ resist: { earth: 1000 } });
  Dot.aplicar(m, { tipo: 'veneno', total: 600 }, 1000);
  const antes = m.hp;
  const hunt = { monstros: [m], clock: 2000 };
  const porPulso = m.dots[0].porPulso;
  Dot.tique(hunt, [], 2000);
  assert.equal(antes - m.hp, Math.round(porPulso * (1 - resistenciaEfetivaDe(hunt, m, 'earth') / 100)));
  assert.ok(resistenciaEfetivaDe(hunt, m, 'earth') <= 75);
});

test('os pulsos pagam o total ao longo da duração e o efeito some; morto, nada mais; sem dano, nada entra', () => {
  const m = mob();
  Dot.aplicar(m, { tipo: 'sangramento', total: 500 }, 0);
  let pago = 0;
  for (let t = 0; t <= 10_000; t += 100) pago += Dot.tique({ monstros: [m], clock: t }, [], t);
  assert.ok(Math.abs(pago - 500) <= 5, `pagou ${pago}`);
  assert.equal(m.dots, undefined, 'acabou: some do bicho');
  const morrendo = mob({ hp: 50 });
  Dot.aplicar(morrendo, { tipo: 'veneno', total: 5000 }, 0);
  Dot.tique({ monstros: [morrendo], clock: 1000 }, [], 1000);
  assert.ok(morrendo.hp <= 0);
  Dot.tique({ monstros: [morrendo], clock: 2000 }, [], 2000);
  assert.equal(morrendo.dots, undefined);
  assert.equal(Dot.aplicar(mob(), { tipo: 'veneno', total: 0 }, 0), null);
  assert.equal(Dot.aplicar(mob(), { tipo: 'inexistente', total: 10 }, 0), null);
});

test('remover tira os efeitos (todos, ou de um tipo)', () => {
  const m = mob();
  Dot.aplicar(m, { tipo: 'veneno', total: 100 }, 0);
  Dot.aplicar(m, { tipo: 'sangramento', total: 100 }, 0);
  Dot.remover(m, 'veneno');
  assert.deepEqual(m.dots.map((d) => d.tipo), ['sangramento']);
  Dot.remover(m);
  assert.equal(m.dots, undefined);
});

test('o estado do mob com efeitos grava e volta com a caçada (JSON puro)', () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 100 });
  assert.ok(Cacadas.entrar(e, { huntId: 'troll-cave', mode: 'auto' }).ok);
  const m = e.hunt.monstros[0];
  Dot.aplicar(m, { tipo: 'veneno', total: 777, origem: { fonte: 'gema' } }, e.hunt.clock ?? 0);
  const volta = JSON.parse(JSON.stringify(Cacadas.huntParaGravar(e.hunt)));
  Cacadas.huntAoCarregar(volta);
  const carregado = volta.monstros.find((x) => x.uid === m.uid);
  assert.deepEqual(carregado.dots, m.dots);
});

// ---------------------------------------------------------------- as fontes: gemas de dano contínuo e supports

const GEMA = (acao) => G.ITEM_DA_ACAO.get(acao);
const SUP = (id) => [...G.DEFS.values()].find((d) => d.tipo === 'support' && d.id === id).itemId;
const idDe = (nome) => Number(Object.values(ITEM_CATALOG).find((i) => i.name === nome).id);

function montar(acao, supports = []) {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 300 });
  Treino.garantir(e);
  e.magic = { value: 80 };
  const gemas = [G.novaGema(GEMA(acao)), ...supports.map((s) => G.novaGema(SUP(s)))];
  e.equipment.weapon = { id: idDe('wand of vortex'), count: 1, soquetes: { abertos: 4, links: [true, true, true], gemas: [...gemas, ...Array(4 - gemas.length).fill(null)] } };
  Ficha.invalidar(e);
  assert.ok(Cacadas.entrar(e, { huntId: 'troll-cave', mode: 'auto' }).ok);
  const h = e.hunt;
  delete h.instancia;
  h.respawns = [];
  h.monstros = [];
  e.maxHp = e.hp = 1e9;
  e.maxMana = e.mana = 1e9;
  const m = Object.assign(criarMonstro({ key: 'troll', x: h.pos.x + 1, y: h.pos.y }, null), { hp: 1e12, maxHp: 1e12, resist: {} });
  h.monstros.push(m);
  return { e, m };
}
function lancar(e, acao, alvo) {
  const h = e.hunt;
  e.actions = Array(Acoes.SLOTS).fill(null);
  const entry = [...Acoes.catalogo(e).spells, ...Acoes.catalogo(e).runes].find((x) => x.id === acao);
  const slot = Acoes.PAPEL_DO_SLOT.indexOf(entry.papeis[0]);
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

test('toda gema de dano contínuo do catálogo vira um EFEITO do tipo certo (sem golpe na hora), com o dano dela como total', () => {
  const gemas = [...ACTION_CATALOG.spells, ...ACTION_CATALOG.runes].filter((a) => a.overTime && Dot.tipoDaFonte(a.overTime.type));
  assert.ok(gemas.length >= 6);
  for (const a of gemas) {
    const { e, m } = montar(a.id);
    const ev = lancar(e, a.id, m);
    const tipo = Dot.tipoDaFonte(a.overTime.type);
    assert.equal(ev.filter((x) => x.t === 'dmg' && x.foe).length, 0, `${a.id}: não bate na hora`);
    assert.equal(m.hp, 1e12, `${a.id}: a vida só cai nos pulsos`);
    const feitos = Dot.dosDoTipo(m, tipo);
    assert.equal(feitos.length, 1, `${a.id}: um efeito de ${tipo}`);
    assert.ok(feitos[0].falta > 0);
    assert.equal(feitos[0].origem.habilidade, a.id);
    assert.ok(ev.some((x) => x.t === 'estado' && x.estado === T[tipo].estado), `${a.id}: o evento de estado`);
  }
});

test('Envenom (veneno), Inflict Wound (sangramento) e Ignite (queimadura): os mapeamentos do catálogo', () => {
  assert.equal(Dot.tipoDaFonte('CONDITION_POISON'), 'veneno');
  assert.equal(Dot.tipoDaFonte('CONDITION_BLEEDING'), 'sangramento');
  assert.equal(Dot.tipoDaFonte('CONDITION_FIRE'), 'queimadura');
  assert.equal(Dot.tipoDaFonte('CONDITION_QUALQUER'), null);
});

test('gema de dano contínuo: o total sai nos pulsos e a resistência do bicho vale em cada um', () => {
  const { e, m } = montar('spell-envenom');
  m.resist = { earth: 50 };
  lancar(e, 'spell-envenom', m);
  const total = Dot.restante(m, 'veneno');
  let pago = 0;
  const h = e.hunt;
  const passa = 1 - resistenciaEfetivaDe(h, m, 'earth') / 100;
  for (let t = 0; t <= 12_000; t += 100) pago += Dot.tique({ monstros: [m], clock: (h.clock ?? 0) + t }, [], (h.clock ?? 0) + t);
  assert.ok(Math.abs(pago - total * passa) < total * 0.02 + 5, `pagou ${pago} de ${total} (esperado ${Math.round(total * passa)})`);
});

test('os suportes Chance de Envenenar e Chance de Sangrar põem veneno e sangramento no acerto (do dano antes da resistência)', () => {
  const venenoNaGema = montar('spell-terra-strike', ['poison']);
  lancar(venenoNaGema.e, 'spell-terra-strike', venenoNaGema.m);
  assert.ok(Dot.restante(venenoNaGema.m, 'veneno') > 0, 'veneno');
  const sangra = montar('spell-brutal-strike', ['bleed']);
  lancar(sangra.e, 'spell-brutal-strike', sangra.m);
  assert.ok(Dot.restante(sangra.m, 'sangramento') > 0, 'sangramento');
  // Sem o suporte nada entra; fora da compatibilidade (fogo não pega veneno nem sangramento) também não.
  const sem = montar('spell-terra-strike');
  lancar(sem.e, 'spell-terra-strike', sem.m);
  assert.equal(sem.m.dots, undefined);
  const fogo = montar('spell-flame-strike', ['poison', 'bleed']);
  lancar(fogo.e, 'spell-flame-strike', fogo.m);
  assert.equal(fogo.m.dots, undefined, 'poison é de físico/terra; bleed, de físico');
});

test('o tique da caçada paga os pulsos (Estados.tique → Dot.tique) e eles aparecem nos estados ativos do mob', () => {
  const m = mob();
  Dot.aplicar(m, { tipo: 'veneno', total: 600 }, 1000);
  Dot.aplicar(m, { tipo: 'queimadura', total: 400 }, 1000);
  const ev = [];
  const total = Estados.tique({ monstros: [m] }, ev, 2000);
  assert.ok(total > 0);
  assert.deepEqual(Estados.ativosDe(m, 2000), ['queimando', 'envenenado']);
  assert.ok(ev.every((x) => x.dot));
});
