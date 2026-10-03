import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as Campanha from '../systems/campanha.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Beta from '../systems/modo-beta.mjs';
import * as Premium from '../systems/premium.mjs';
import * as M from '../systems/atos-modelo.mjs';
import { CATALOGO } from '../systems/dados.mjs';
import { personagemDeTeste, PERSONAGEM } from './apoio.mjs';

const VIPS = CATALOGO.vips.slice(0, 2).map((h) => h.id);
const ESPECIAL = CATALOGO.especiais[0].id;
const BOSS = 'ahau';
const nivel = { facil: 20, medio: 120, dificil: 620 };
const fase = (id, huntId, tipo, extra = {}) => ({ id, nome: id.toUpperCase(), huntId, tipo, nivel, ...extra });
const ato = (mod = {}) => ({
  id: 'ato-premium', nome: 'Ato Premium', estado: 'publicado', ordem: 5, anterior: 'legado-4', inicio: 'fase-1',
  fases: [fase('fase-1', VIPS[0], 'hunt-vip', { ordem: 1 }), fase('fase-2', VIPS[1], 'hunt-vip', { ordem: 2 }), fase('fase-3', ESPECIAL, 'hunt-especial', { ordem: 3 })],
  conexoes: [{ de: 'fase-1', para: 'fase-2' }, { de: 'fase-2', para: 'fase-3' }],
  bossFinal: { bossId: BOSS, faseAnterior: 'fase-3' },
  ...mod,
});
afterEach(() => { Campanha._desregistrarAto(5); Beta.definir(false); });
const novo = (extra = {}) => personagemDeTeste({ level: 2000, campanha: { facil: { limpezas: {}, completas: [], bosses: [4] } }, ...extra });
const vivos = (e) => [...e.hunt.monstros, ...Object.values(e.hunt.outrosAndares ?? {}).flat()];
function limpar(e) {
  for (let i = 0; i < 12 && e.hunt?.instancia?.status !== 'limpa'; i++) {
    for (const m of vivos(e)) m.hp = 0;
    Cacadas.tique(e, PERSONAGEM, Date.now() + 500 * (i + 1));
  }
}

test('VE1. o validador aceita VIP/especial como fase e cobra o tipo certo para cada hunt (a normal não vira VIP nem o contrário)', () => {
  assert.equal(M.TIPOS_DE_FASE['hunt-vip'].suportado, true);
  assert.equal(M.TIPOS_DE_FASE['hunt-especial'].suportado, true);
  const ctx = { huntExiste: () => true, bossExiste: () => true, categoriaDaHunt: (h) => (VIPS.includes(h) ? 'vips' : h === ESPECIAL ? 'especiais' : 'hunts') };
  const erros = (a) => M.validarAto(a, ctx).filter((p) => p.nivel === 'erro').map((p) => p.mensagem);
  assert.deepEqual(erros({ ...ato(), anterior: null, ordem: 5 }), []);
  assert.ok(erros(ato({ fases: ato().fases.map((f) => (f.id === 'fase-1' ? { ...f, tipo: 'hunt-normal' } : f)) })).some((m) => /VIP \(exige acesso\): use o tipo "hunt-vip"/.test(m)));
  assert.ok(erros(ato({ fases: ato().fases.map((f) => (f.id === 'fase-3' ? { ...f, huntId: 'troll-cave' } : f)) })).some((m) => /hunt normal: use o tipo "hunt-normal"/.test(m)));
});

test('VE2. a fase VIP/especial vira instância (sala gerada) que LIMPA, pela regra do jogo: precisa de acesso e, com o beta ligado, o acesso é livre', () => {
  assert.equal(Campanha.registrarAto(ato()).ok, true);
  const semAcesso = novo();
  const r = Cacadas.entrar(semAcesso, { huntId: VIPS[0], mode: 'auto', dificuldade: 'facil' });
  assert.equal(r.ok, false, 'sem premium não entra na fase VIP');
  assert.match(r.erro, /premium/);
  Beta.definir(true);
  const e = novo();
  const ok = Cacadas.entrar(e, { huntId: VIPS[0], mode: 'auto', dificuldade: 'facil' });
  assert.equal(ok.ok, true, ok.erro);
  assert.ok(e.hunt.instancia, 'a fase VIP tem instância');
  assert.ok(e.hunt.instancia.objetivos.total > 0, 'com bichos para matar');
  limpar(e);
  assert.equal(e.hunt.instancia.status, 'limpa');
  assert.ok(e.campanha.facil.completas.includes(VIPS[0]), 'limpou: a fase completa');
  assert.equal(Campanha.faseLiberada(e, 'facil', VIPS[1]), true, 'e abre a próxima pelo grafo');
});

test('VE3. com premium de verdade (sem beta) a fase VIP entra e limpa; a especial pede também o pergaminho e o level', () => {
  assert.equal(Campanha.registrarAto(ato()).ok, true);
  const e = novo();
  Premium.adicionarDias(e, 1);
  const ok = Cacadas.entrar(e, { huntId: VIPS[0], mode: 'auto', dificuldade: 'facil' });
  assert.equal(ok.ok, true, ok.erro);
  limpar(e);
  assert.equal(e.hunt.instancia.status, 'limpa');
  e.campanha.facil.completas.push(VIPS[1]);
  const esp = Cacadas.entrar(e, { huntId: ESPECIAL, mode: 'auto', dificuldade: 'facil' });
  assert.equal(esp.ok, false, 'a especial exige o pergaminho de acesso');
  assert.match(esp.erro, /Instance|acesso|pergaminho/i);
});

test('VE4. a última fase do ato sendo especial: limpar abre o portal do boss como em qualquer ato do editor', () => {
  Beta.definir(true);
  assert.equal(Campanha.registrarAto(ato()).ok, true);
  const e = novo();
  for (const h of [...VIPS, ESPECIAL]) {
    assert.equal(Cacadas.entrar(e, { huntId: h, mode: 'auto', dificuldade: 'facil' }).ok, true, h);
    limpar(e);
    e.hunt = e.hunt?.portalDoBoss ? e.hunt : e.hunt;
    if (h !== ESPECIAL) e.hunt = null;
  }
  assert.ok(e.hunt.portalDoBoss, 'limpou a última: portal aberto');
  assert.equal(e.hunt.portalDoBoss.bossId, BOSS);
});
