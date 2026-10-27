// (lote T1, rodada 4, 27/10) O APOIO dos testes do lote T1 (`gemas-t1-*.test.mjs`): o personagem com a arma e as gemas (cada grupo `[ativa, ...suportes]`
// ligado entre si; os grupos em soquetes soltos), a ativa do grupo i no slot i da barra, numa caçada com o alvo imortal colado e os outros longe; o uso
// com o sorteio travado devolve os golpes do registro (crítico, tipo, dano por elemento), os eventos e os dots do alvo. O mesmo molde dos testes vizinhos
// (`ativas-linhas-lidas-poe`, `suportes-s1`).
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
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
export const Registro = await import('../systems/combate/registro.mjs');

/** O poedb salvo: a gema pelo slug. */
const POEDB = JSON.parse(readFileSync(new URL('../gamedata/itens-poe/gemas-poe.json', import.meta.url), 'utf8'));
const DO_POEDB = new Map((Array.isArray(POEDB) ? POEDB : Object.values(POEDB)).map((g) => [g.slug, g]));
export const doPoedb = (slug) => DO_POEDB.get(slug);
/** A tabela por nível do poedb (`gemas-niveis-poedb.json` — a que o jogo carrega; na falta, a da coleção). */
const NIVEIS = JSON.parse(readFileSync(new URL('../gamedata/itens-poe/gemas-niveis-poedb.json', import.meta.url), 'utf8')).niveis ?? {};
/** A célula do poedb no nível (pela coluna cujo cabeçalho casa com `re`). */
export function celula(slug, nivel, re) {
  const g = NIVEIS[slug]?.colunas?.some((c) => re.test(c)) ? NIVEIS[slug] : DO_POEDB.get(slug);
  const i = g.colunas.findIndex((c) => re.test(c));
  assert.ok(i >= 0, `${slug}: coluna ${re}`);
  return g.linhas.find((l) => Number(l[0]) === nivel)[i];
}

export const sorte = (v, f) => { const o = Math.random; Math.random = () => v; try { return f(); } finally { Math.random = o; } };
export const perto = (a, b, tol = 0.02) => Math.abs(a / b - 1) < tol;
export const TAGS = (...t) => ({ tags: t.map((x) => `poe:${x}`) });
export const efeito = (slug, nivel, q = 0, tags = TAGS('Magia', 'Ataque', 'Projétil', 'Área', 'Corpo a Corpo', 'Fogo', 'Gelo', 'Raio', 'Caos', 'Físico', 'Lacaio', 'Duração', 'Arco')) => SP.efeitoNoNivel(slug, nivel, q, tags).efeito;

let J;
let gerarPeca;
/** A peça do jogo pela base (normal, ilvl 60, o sorteio fixo). */
export async function peca(base) {
  J ??= await import('../systems/itens-poe/jogo.mjs');
  gerarPeca ??= (await import('../systems/itens-poe/gerar.mjs')).gerarPeca;
  return J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
}

/** O personagem com a arma (e o escudo) e as gemas; `nivelDe(slug)` dá o nível de cada gema (20; a Desperta 5; a Maior 3, se não vier). */
export async function montar(arma, grupos, { escudo = null, qualidade = 0, nivelDe = null, level = 90 } = {}) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level }), { classePoe: 'Scion', sistema: 'poe' });
  const a = await peca(arma);
  const todas = grupos.flat();
  const links = grupos.flatMap((g) => g.map((_, i) => i < g.length - 1)).slice(0, todas.length - 1);
  a.soquetes = { abertos: todas.length, links, gemas: Array(todas.length).fill(null), cores: Array(todas.length).fill('W') };
  e.equipment = { ...e.equipment, weapon: a };
  if (escudo) e.equipment.shield = await peca(escudo);
  else delete e.equipment.shield;
  const nivel = (s) => nivelDe?.(s) ?? (/^Awakened_/.test(s) ? 5 : /^Greater_/.test(s) && SP.doSlug(s) ? 3 : 20);
  e.inventory = todas.map((s) => GS.itemDaGema({ id: (G.doSlug(s) ?? SP.doSlug(s)).itemId, nivel: nivel(s), xp: 0, raridade: 'comum', ...(qualidade ? { qualidade } : {}) }));
  for (let i = 0; i < todas.length; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  e.actions = Array(Acoes.SLOTS).fill(null);
  grupos.forEach((g, i) => { if (G.doSlug(g[0])) e.actions[i] = { id: G.doSlug(g[0]).acao, enabled: true, minMana: 0, conditions: [] }; });
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(sorte(0.999, () => Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' })).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 1e7;
  e.maxHp = e.hp = 1e7;
  const [b, ...resto] = e.hunt.monstros;
  for (const m of resto) Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60, hp: 1e12, maxHp: 1e12 });
  Object.assign(b, { x: e.hunt.pos.x + 1, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12, estados: {}, dots: [], resist: {} });
  return { e, b, resto };
}

/** Um uso do slot com o sorteio fixo em `v` (a conjuração concluída): os golpes da gema (o registro), os eventos e os dots no alvo. */
export function usar({ e, b }, v, slot = 0, alvo = b) {
  Registro.definirNivel(2);
  Registro.limparRegistro();
  try {
    const eventos = [];
    sorte(v, () => {
      const r = Acoes.disparar(e, e.hunt, PERSONAGEM, slot, alvo, { manual: true });
      assert.ok(r.ok, JSON.stringify(r));
      eventos.push(...(r.eventos ?? []));
      if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; eventos.push(...(Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM) ?? [])); }
    });
    return { golpes: Registro.ultimosGolpes(500).filter((g) => g.origem === 'gema'), eventos, dots: b.dots ?? [] };
  } finally { Registro.definirNivel(0); }
}
/** O dano no alvo pelos eventos. */
export const danoEm = (eventos, b) => eventos.filter((x) => x.t === 'dmg' && x.uid === b.uid && x.foe).reduce((t, x) => t + (x.v ?? 0), 0);
export const totalDo = (dots, tipo) => dots.filter((d) => d.tipo === tipo).reduce((t, d) => t + (d.falta ?? 0), 0);
/** O próximo uso livre: o relógio depois da recarga do grupo e da conjuração. */
export function esperar(e, ms = 10_000) { e.hunt.clock += ms; }
