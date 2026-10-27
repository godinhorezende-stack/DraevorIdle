// (lote T3, rodada 4 das gemas — 27/10) O apoio dos testes do lote T3 (gemas-t3-*.test.mjs): o personagem com as gemas encaixadas numa caçada do PoE, o uso com o
// sorteio travado, o tique das plantadas e dos objetos, e a tabela do poedb salvo (a coluna do nível) para conferir os números das linhas.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

process.env.ITENS_POE = '1';
export const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
export const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
export { PERSONAGEM };
export const Acoes = await import('../systems/acoes.mjs');
export const GS = await import('../systems/skills/gemas.mjs');
export const G = await import('../systems/itens-poe/gemas-poe.mjs');
export const SP = await import('../systems/itens-poe/suportes-poe.mjs');
export const Cacadas = await import('../systems/cacadas.mjs');
export const Ficha = await import('../systems/ficha.mjs');
export const Afixos = await import('../systems/afixos.mjs');

export function travado(v, fn) {
  const antes = Math.random;
  Math.random = typeof v === 'function' ? v : () => v;
  try { return fn(); } finally { Math.random = antes; }
}
export const doSlug = (s) => G.doSlug(s) ?? SP.doSlug(s);
export const perto = (a, b, tol = 0.02) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

// ---------------------------------------------------------------- a tabela do poedb salvo

const RAIZ = new URL('../gamedata/itens-poe/', import.meta.url);
const TABELAS = {};
const tabela = (arq) => (TABELAS[arq] ??= JSON.parse(readFileSync(new URL(arq, RAIZ), 'utf8')));
const NIVEIS = () => tabela('gemas-niveis-poedb.json').niveis ?? {};
/** A gema do poedb salvo (ativa: `gemas-poe.json`, com a tabela de níveis de `gemas-niveis-poedb.json`; suporte: `suportes-poe.json`). */
export function doPoedb(slug) {
  const s = tabela('suportes-poe.json').find((x) => x.slug === slug);
  if (s) return s;
  const g = tabela('gemas-poe.json').find((x) => x.slug === slug);
  const n = NIVEIS()[slug];
  return g && n?.linhas?.length ? { ...g, colunas: n.colunas, linhas: n.linhas } : g;
}
/** A célula da coluna cujo cabeçalho casa `re`, no `nivel` (a linha da tabela do poedb). */
export function celula(slug, re, nivel = 20) {
  const g = doPoedb(slug);
  assert.ok(g, `${slug} no poedb salvo`);
  const i = g.colunas.findIndex((c) => re.test(c));
  assert.ok(i >= 0, `${slug}: a coluna ${re} (${g.colunas.join(' | ')})`);
  return String(g.linhas[Math.min(nivel, g.linhas.length) - 1][i]);
}
/** Os números da célula ("251, 377" → [251, 377]; "332.9%" → [332.9]). */
export const numeros = (t) => (String(t).match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);

// ---------------------------------------------------------------- o personagem e o uso

let J;
let gerarPeca;
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
/**
 * O personagem com `grupos` de gemas na arma (cada grupo ligado entre si, os grupos sem ligação), as ativas `barra` nos slots, numa caçada do PoE; o primeiro bicho
 * colado e imortal (`b`), os outros longe (`resto`). `nivel` e `qualidade`: os das gemas (ou `{ slug: valor }`).
 */
export async function montar(grupos, { barra = null, arma = 'Wands/Driftwood_Wand', escudo = null, vocacao = 'sorcerer', classe = 'Witch', nivel = 20, level = 90, qualidade = 0 } = {}) {
  J ??= await import('../systems/itens-poe/jogo.mjs');
  gerarPeca ??= (await import('../systems/itens-poe/gerar.mjs')).gerarPeca;
  const e = Object.assign(personagemDeTeste({ vocacao, level }), { classePoe: classe, sistema: 'poe' });
  const a = peca(arma);
  const slugs = grupos.flat();
  const links = [];
  for (const g of grupos) g.forEach((_, i) => links.push(i < g.length - 1));
  a.soquetes = { abertos: slugs.length, links: links.slice(0, Math.max(0, slugs.length - 1)), gemas: Array(slugs.length).fill(null), cores: Array(slugs.length).fill('W') };
  e.equipment = { ...e.equipment, weapon: a };
  if (escudo) e.equipment.shield = peca(escudo);
  else delete e.equipment.shield;
  e.inventory = slugs.map((s) => GS.itemDaGema({ id: doSlug(s).itemId, nivel: typeof nivel === 'object' ? nivel[s] ?? 20 : nivel, xp: 0, raridade: 'comum', qualidade: typeof qualidade === 'object' ? qualidade[s] ?? 0 : qualidade }));
  for (let i = 0; i < slugs.length; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  e.actions = Array(Acoes.SLOTS).fill(null);
  (barra ?? [slugs[0]]).forEach((s, i) => (e.actions[i] = { id: G.doSlug(s).acao, enabled: true, minMana: 0, conditions: [] }));
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
/** Põe os bichos `ms` nas casas `[dx, dy]` (relativas a você), imortais e limpos. */
export function posicionar(e, ms, casas) {
  ms.forEach((m, i) => Object.assign(m, { x: e.hunt.pos.x + casas[i][0], y: e.hunt.pos.y + casas[i][1], hp: 1e12, maxHp: 1e12, estados: {}, dots: [] }));
}
/** Usa a gema do `slot` no alvo (a conjuração concluída), com o sorteio travado em `v`; devolve `{ r, eventos, inicio }`. */
export function usar(e, alvo, { slot = 0, passo = 60_000, v = 0.5 } = {}) {
  e.hunt.clock += passo;
  const inicio = e.hunt.clock;
  const r = travado(v, () => Acoes.disparar(e, e.hunt, PERSONAGEM, slot, alvo, { manual: true }));
  const eventos = [...(r.eventos ?? [])];
  if (r.ok && e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; eventos.push(...(travado(v, () => Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM)) ?? [])); }
  return { r, eventos, inicio };
}
/** O tempo andando `n` passos de `dt` ms: as plantadas (Armadilhas, Minas, Torres), as Runas e os objetos. */
export function andar(e, n = 6, dt = 400, v = 0.5) {
  const ev = [];
  for (let i = 0; i < n; i++) {
    e.hunt.clock += dt;
    ev.push(...travado(v, () => [...Acoes.tiqueDasPlantadas(e, e.hunt, PERSONAGEM, []), ...Acoes.tiqueDasRunas(e, e.hunt, PERSONAGEM, [])]));
  }
  return ev;
}
export const golpesEm = (ev, b) => ev.filter((x) => x.t === 'dmg' && x.uid === b.uid && x.foe);
export const danoEm = (ev, b) => golpesEm(ev, b).reduce((t, x) => t + (x.v ?? 0), 0);
