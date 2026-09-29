// A árvore de habilidades: a vista contra a CAPTURA do original, as regras e
// os textos medidos lá, e os bônus chegando no combate.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as Arvore from '../systems/arvore.mjs';
import * as Ficha from '../systems/ficha.mjs';
import { personagemDeTeste, comMarcaNova } from './apoio.mjs';

const API = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'api-mapeada', 'servidor');
const capturado = (arquivo) => comMarcaNova(JSON.parse(readFileSync(join(API, arquivo), 'utf8')).view);

/** O Zoros (knight 407) da captura, com a árvore dele aplicada. */
function zoros() {
  const real = capturado('arvore-knight-zoros.json');
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 407 }), { gold: 1_000_000, bank: 100_000_000 });
  const plano = {};
  for (const no of real.nos) if (no.gasto) plano[no.id] = no.gasto;
  assert.equal(Arvore.comando(e, { action: 'aplicar', plano }, true).ok, true);
  return { e, real };
}

const erro = (r, texto) => {
  assert.equal(r.ok, false);
  assert.equal(r.erro, texto);
};

test('a vista bate com a do original: pontos, bônus, vias e preços', () => {
  const { e, real } = zoros();
  const v = Arvore.vista(e);
  assert.deepEqual(v.pontos, real.pontos);
  assert.deepEqual(v.bonus, real.bonus);
  assert.deepEqual(v.vias, real.vias);
  assert.deepEqual(v.nos, real.nos);
  assert.deepEqual(v.vinculos, real.vinculos);
  for (const k of ['custoDaArvore', 'levelCheio', 'precoParaRefazer', 'precoParaUsarMontagem', 'base', 'vocacao']) assert.equal(v[k], real[k], k);
  assert.deepEqual(v.habilidades, real.habilidades);
});

test('as cinco vocações têm a árvore capturada', () => {
  for (const [voc, arq] of [['knight', 'arvore-knight-zoros.json'], ['paladin', 'arvore-paladin.json'], ['sorcerer', 'arvore-sorcerer.json'], ['druid', 'arvore-druid.json'], ['monk', 'arvore-monk.json']]) {
    const real = capturado(arq);
    const e = personagemDeTeste({ vocacao: voc, level: 8 });
    const v = Arvore.vista(e);
    assert.equal(v.nos.length, real.nos.length, voc);
    assert.deepEqual(v.nos.map((n) => n.especial?.id ?? null), real.nos.map((n) => n.especial?.id ?? null), voc);
  }
});

test('pontos pelo level: os cinco pontos medidos', () => {
  for (const [level, pontos] of [[8, 0], [10, 1], [89, 40], [343, 167], [407, 199], [3000, 1496]]) {
    assert.equal(Arvore.pontosDoLevel(level), pontos, `level ${level}`);
  }
});

test('os erros do original, palavra por palavra', () => {
  const { e } = zoros();
  erro(Arvore.comando(e, { action: 'zerar' }, true), 'só fora da caçada');
  erro(Arvore.comando(e, { action: 'tirarHabilidade', id: 'ultimaMuralha' }, true), 'essa habilidade não está escolhida');
  erro(Arvore.comando(e, { action: 'escolherHabilidade', id: 'ultimaMuralha' }, true), 'complete o medalhão Muralha viva antes de escolher Última muralha');
  erro(Arvore.comando(e, { action: 'escolherHabilidade', id: 'naoExiste' }, true), 'essa habilidade não é da sua árvore');
  erro(Arvore.comando(e, { action: 'escolherHabilidade', id: 'sedeDeSangue' }, true), 'sem vaga livre — a próxima abre no level 700');
  erro(Arvore.comando(e, { action: 'usarMontagem', vaga: 0 }, true), 'essa vaga de montagem está vazia');
  erro(Arvore.comando(e, { action: 'apagarMontagem', vaga: 0 }, true), 'essa vaga já está vazia');
  erro(Arvore.comando(e, { action: 'aplicar', plano: { n40: 1 } }, true), 'Casco não tem caminho até o começo');
  erro(Arvore.comando(e, { action: 'aplicar', plano: {} }, true), 'para tirar graus, só fora da caçada');
  assert.equal(Arvore.comando(e, { action: 'xyz' }, true).ok, true); // ação desconhecida: só a vista
  assert.equal(Arvore.pontos(e).usados, 151); // nada disso mexeu na árvore
});

test('montagens: guardar é de graça; sem plano guarda a árvore aplicada', () => {
  const { e } = zoros();
  Arvore.comando(e, { action: 'guardarMontagem', vaga: 1, nome: 'teste-claude', plano: { n3: 1 } }, true);
  assert.deepEqual(Arvore.vista(e).montagens[1], { nome: 'teste-claude', pontos: 3, habilidades: [], plano: { n3: 1 }, tira: true, preco: 12_210_000 });
  Arvore.comando(e, { action: 'guardarMontagem', vaga: 1, nome: '', plano: null }, true);
  const m = Arvore.vista(e).montagens[1];
  assert.deepEqual([m.nome, m.pontos, m.tira, m.preco], ['Montagem 2', 151, false, 0]);
  Arvore.comando(e, { action: 'apagarMontagem', vaga: 1 }, true);
  assert.deepEqual(Arvore.vista(e).montagens, [null, null]);
});

test('refazer cobra 100 mil por level, da carteira e depois do banco', () => {
  const { e } = zoros();
  const antes = e.gold + e.bank;
  assert.equal(Arvore.comando(e, { action: 'zerar' }, false).ok, true);
  assert.equal(antes - (e.gold + e.bank), 40_700_000);
  assert.equal(e.gold, 0); // a carteira primeiro
  assert.equal(Arvore.pontos(e).usados, 0);
  // Acrescentar é de graça — e pode caçando.
  assert.equal(Arvore.comando(e, { action: 'aplicar', plano: { n3: 1 } }, true).ok, true);
  assert.equal(antes - (e.gold + e.bank), 40_700_000);
});

test('habilidade: escolher com vaga e medalhão cheio; tirar custa 20 mil por level', () => {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 700 }), { gold: 0, bank: 50_000_000 });
  const real = capturado('arvore-knight-zoros.json');
  const plano = {};
  for (const no of real.nos) if (no.gasto) plano[no.id] = no.gasto; // n1 (Sede de sangue) está 3/3
  Arvore.comando(e, { action: 'aplicar', plano }, false);
  assert.equal(Arvore.comando(e, { action: 'escolherHabilidade', id: 'sedeDeSangue' }, false).ok, true);
  assert.ok(Arvore.habilidadesAtivas(e).has('sedeDeSangue'));
  assert.equal(Arvore.comando(e, { action: 'tirarHabilidade', id: 'sedeDeSangue' }, false).ok, true);
  assert.equal(50_000_000 - e.bank, 14_000_000);
});

test('os bônus chegam na ficha e na vida máxima', () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 407 });
  const antes = Ficha.combate(e);
  const vida = e.maxHp;
  const real = capturado('arvore-knight-zoros.json');
  const plano = {};
  for (const no of real.nos) if (no.gasto) plano[no.id] = no.gasto;
  Arvore.comando(e, { action: 'aplicar', plano }, true);
  Arvore.recalcularVida(e);
  // Ficha por tique (game/systems/ficha.mjs): aplicar a árvore não passa pela
  // sessão, então quem quer ver o efeito precisa invalidar à mão.
  Ficha.invalidar(e);
  const depois = Ficha.combate(e);
  assert.ok(Math.abs(depois.critChance - antes.critChance - real.bonus.critChance) < 1e-9);
  assert.ok(Math.abs(depois.lifeLeech - antes.lifeLeech - real.bonus.lifeLeech) < 1e-9);
  assert.equal(depois.skillBonus.melee - (antes.skillBonus.melee ?? 0), real.bonus['skill:melee']);
  assert.equal(e.maxHp - vida, Math.round(vida * real.bonus.maxHp));
});

/** Um personagem de level 2100 (3 vagas) com a árvore INTEIRA e as três habilidades. */
function comTudo(vocacao) {
  const e = Object.assign(personagemDeTeste({ vocacao, level: 3000 }), { gold: 0, bank: 0 });
  const plano = {};
  for (const no of Arvore.vista(e).nos) plano[no.id] = no.graus;
  assert.equal(Arvore.comando(e, { action: 'aplicar', plano }, false).ok, true);
  for (const no of Arvore.vista(e).nos) if (no.especial) assert.equal(Arvore.comando(e, { action: 'escolherHabilidade', id: no.especial.id }, false).ok, true);
  e.hunt = { clock: 10_000, pos: { x: 5, y: 5 }, monstros: [] };
  return e;
}

test('habilidades de knight: Sede de sangue, Última muralha, Não cai nunca', () => {
  const e = comTudo('knight');
  const eventos = [];
  const alvo = { uid: 1, x: 6, y: 5, hp: 100 };
  const base = Arvore.fatorDasHabilidades(e, alvo);
  for (let i = 0; i < 5; i++) Arvore.aoMatar(e, eventos, e.hunt.pos, 'T');
  assert.ok(Math.abs(Arvore.fatorDasHabilidades(e, alvo) / base - 1.15) < 1e-9); // 3 acúmulos, não 5
  e.hunt.clock += 6001;
  assert.equal(Arvore.fatorDasHabilidades(e, alvo), base); // acabou em 6s
  // Golpe que mataria: fica com 10% — e só uma vez a cada 120s.
  e.hp = 50;
  const v = Arvore.danoRecebido(e, 10_000, eventos, e.hunt.pos, 'T');
  assert.equal(e.hp - v, Math.round(e.maxHp * 0.1));
  assert.ok(Arvore.danoRecebido(e, 10_000, eventos, e.hunt.pos, 'T') >= e.hp);
});

test('habilidades de druid: Inverno sem fim marca o bicho; Raiz venenosa pinga 5 vezes', () => {
  const e = comTudo('druid');
  const eventos = [];
  const bicho = { uid: 1, x: 6, y: 5, hp: 10_000 };
  e.hunt.monstros.push(bicho);
  const antes = Arvore.fatorDasHabilidades(e, bicho);
  Arvore.depoisDaMagia(e, e.hunt, 'ice', [{ bicho, dano: 100 }], eventos, '#fff');
  assert.ok(Math.abs(Arvore.fatorDasHabilidades(e, bicho) / antes - 1.1) < 1e-9);
  bicho.arvoreVeneno = { porSegundo: 6, restantes: 5, proximo: e.hunt.clock + 1000, cor: '#0f0' };
  e.hunt.clock += 10_000;
  Arvore.tique(e, e.hunt, eventos);
  assert.equal(bicho.hp, 10_000 - 5 * 6);
  assert.equal(bicho.arvoreVeneno, undefined);
});
