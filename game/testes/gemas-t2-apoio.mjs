// (lote T2, rodada 4 — 27/10) O APOIO dos testes das gemas que estavam "implementada, sem teste próprio" (gemas-t2*.test.mjs): monta o personagem do PoE com
// as gemas na arma, entra numa caçada com um alvo imortal colado e os outros longe, e usa a gema com os sorteios travados. Não é um teste.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
export const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
export const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste, pousarVoos } = await import('./apoio.mjs');
export const Acoes = await import('../systems/acoes.mjs');
export const GS = await import('../systems/skills/gemas.mjs');
export const G = await import('../systems/itens-poe/gemas-poe.mjs');
export const SP = await import('../systems/itens-poe/suportes-poe.mjs');
export const Cacadas = await import('../systems/cacadas.mjs');
export const Ficha = await import('../systems/ficha.mjs');
export const Afixos = await import('../systems/afixos.mjs');

let J;
let gerarPeca;
export async function peca(base) {
  J ??= await import('../systems/itens-poe/jogo.mjs');
  gerarPeca ??= (await import('../systems/itens-poe/gerar.mjs')).gerarPeca;
  return J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
}
export function travado(v, fn) {
  const antes = Math.random;
  Math.random = typeof v === 'function' ? v : () => v;
  try { return fn(); } finally { Math.random = antes; }
}
export const doSlug = (s) => G.doSlug(s) ?? SP.doSlug(s);
export const acao = (s) => G.doSlug(s).acao;
export const perto = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
/** O efeito do suporte no nível (as tags do PoE da ativa suportada). */
export const ef = (slug, nivel = 20, q = 0, ...tags) => SP.efeitoNoNivel(slug, nivel, q, { tags: tags.map((t) => `poe:${t}`) }).efeito;

/**
 * O personagem (nível 90, Scion) com as gemas: o primeiro grupo (`slugs`) ligado na arma; `soltas` em soquetes sem ligação. Entra na caçada com o relógio em
 * 100 s, Vida e Mana enormes; o alvo `b` colado (1 casa à direita) e imortal, os outros a 60 casas.
 */
export async function montar(slugs, { arma = 'One_Hand_Swords/Rusted_Sword', escudo = null, nivel = 20, qualidade = 0, soltas = [], nivelDe = {}, danoArma = 1000 } = {}) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Scion', sistema: 'poe' });
  const a = await peca(arma);
  // (o dano da arma fixo e alto: as razões com e sem a gema não se perdem no arredondamento dos balões)
  if (danoArma && a.poe?.atributos?.dano_fisico) { a.poe.atributos.dano_fisico = { min: danoArma, max: danoArma }; a.base = { ...a.base, attack: [danoArma, danoArma] }; }
  const n = slugs.length + soltas.length;
  a.soquetes = { abertos: n, links: Array(Math.max(0, n - 1)).fill(false).map((_, i) => i < slugs.length - 1), gemas: Array(n).fill(null), cores: Array(n).fill('W') };
  e.equipment = { ...e.equipment, weapon: a };
  if (escudo) e.equipment.shield = await peca(escudo);
  else delete e.equipment.shield;
  const todas = [...slugs, ...soltas];
  e.inventory = todas.map((s) => GS.itemDaGema({ id: doSlug(s).itemId, nivel: nivelDe[s] ?? nivel, xp: 0, raridade: 'comum', qualidade }));
  for (let i = 0; i < todas.length; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  e.actions = Array(Acoes.SLOTS).fill(null);
  todas.filter((s) => G.doSlug(s)).forEach((s, i) => { e.actions[i] = { id: G.doSlug(s).acao, enabled: true, minMana: 0, conditions: [] }; });
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(travado(0.5, () => Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' })).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 1e7;
  e.maxHp = e.hp = 1e7;
  const [b, ...resto] = e.hunt.monstros;
  for (const m of resto) Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60, hp: 1e12, maxHp: 1e12 });
  Object.assign(b, { x: e.hunt.pos.x + 1, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12, estados: {}, dots: [] });
  return { e, b, resto };
}
/** Usa a gema do `slot` no alvo (a conjuração concluída); devolve `{ r, ev }` — `ev`, os eventos do uso. */
export function usar(e, slot, b, v = 0.5) {
  const ev = [];
  const r = travado(v, () => Acoes.disparar(e, e.hunt, { nome: 'T' }, slot, b, { manual: true }));
  ev.push(...(r.eventos ?? []));
  if (r.ok && e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; ev.push(...(travado(v, () => Acoes.concluirConjuracao(e, e.hunt, { nome: 'T' })) ?? [])); }
  ev.push(...pousarVoos(e.hunt, { sorte: v })); // aval do dono 03/11: o voo de verdade — o golpe do projétil cai no tique em que ele chega (`pousarVoos`)
  return { r, ev };
}
/** O dano (os balões) no monstro `m` nos eventos. */
export const danoEm = (ev, m) => ev.filter((x) => x.t === 'dmg' && x.uid === m.uid && x.foe).reduce((t, x) => t + (x.v ?? 0), 0);
/** Os golpes (balões) no monstro `m`. */
export const golpesEm = (ev, m) => ev.filter((x) => x.t === 'dmg' && x.uid === m.uid && x.foe);
/** O próximo uso: o relógio passa o tempo de uso e a recarga do grupo do PoE. */
export function proximo(e, ms = 5000) { e.hunt.clock += ms; }
