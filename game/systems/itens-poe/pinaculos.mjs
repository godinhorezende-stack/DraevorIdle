// Os CHEFES PINÁCULO do PoE no jogo local (sistema de itens do PoE, Fase 1 — só com ITENS_POE=1; em produção nada disto existe).
//
// Os dados estão em `gamedata/itens-poe/pinaculos.json` (gerado por `tools/montar-pinaculos.mjs` a partir do poedb). Cada chefe vira:
//   1. um BOSS ÚNICO (`bosses-unicos/catalogo.registrar`): a criatura-base do Draevor dá desenho, golpes e poderes; o PoE dá a vida
//      (relativa ao pináculo mais fraco), o dano, a experiência e as resistências;
//   2. uma entrada em `CATALOGO.bosses` (o painel de Bosses do cliente): a ARENA é a da criatura-base (o tamanho da sala e a entrada),
//      com `bossUnico` dizendo quem nasce nela (`cacadas.entrar`);
//   3. a TABELA EXCLUSIVA: na vitória, 1 Único só dele (`dropExclusivo`), além do drop normal do PoE (monstro Único, +2850%).
import { readFileSync } from 'node:fs';
import * as Catalogo from './catalogo.mjs';
import { idDaBase, pecaDoJogo } from './jogo.mjs';
import { gerarPeca } from './gerar.mjs';
import * as BossesUnicos from '../bosses-unicos/catalogo.mjs';
import { CATALOGO } from '../dados.mjs';
import { BESTIARY } from '../hunt/monstros.mjs';

export const DADOS = JSON.parse(readFileSync(new URL('../../gamedata/itens-poe/pinaculos.json', import.meta.url), 'utf8'));
const PORID = new Map();

/** O chefe pináculo pelo id do boss (`poe-the-maven`…), ou null. */
export const pinaculo = (id) => PORID.get(id) ?? null;
export const todos = () => [...PORID.values()];

/** A definição de boss único do pináculo. */
export function definicao(c) {
  return {
    id: c.id,
    nome: c.nome,
    descricao: `Chefe pináculo do Path of Exile (${c.vidaPct}% de vida, ${c.danoPct}% de dano).`,
    categoria: 'endgame',
    base: c.base,
    nivel: DADOS.regra.nivel,
    atributos: { vidaMult: c.vidaMult, danoMult: c.danoPct / 100, expMult: c.expPct / 100, resistencias: { ...c.resistencias } },
    usaPoderesDoBase: true,
    usaEscalaDaFase: false,
  };
}

/** A entrada do painel de Bosses: a arena da criatura-base (mesma sala, mesma entrada), com o pináculo nascendo nela. */
export function entradaDoCatalogo(c, def = BossesUnicos.bossUnico(c.id)) {
  const arena = CATALOGO.bosses.find((b) => b.creatures?.[0]?.key === c.base);
  const be = BESTIARY[c.base];
  const hp = Math.round((be?.hp ?? 1) * def.atributos.vidaMult);
  const exp = Math.round((be?.exp ?? 0) * def.atributos.expMult);
  return {
    id: c.id,
    name: c.nome,
    custom: true,
    level: DADOS.regra.nivel,
    density: 1,
    blurb: 'pináculo do PoE',
    ...(arena ? { origin: arena.origin, crop: arena.crop, limite: arena.limite, partida: arena.partida } : { limite: { caixas: { 7: { x: 0, y: 0, w: 40, h: 40 } }, w: 40, h: 40 }, partida: { x: 20, y: 34, z: 7 } }),
    modo: null,
    online: null,
    boss: true,
    cooldownHours: DADOS.regra.cooldownHours,
    exp,
    hp,
    lootCount: c.unicos.length,
    creatures: [{ key: c.base, name: c.nome, look: be?.look ?? 0, exp, hp }],
    task: false,
    bossUnico: c.id,
    poePinaculo: true,
  };
}

/** Registra os 11 chefes (uma vez). Sem o sistema ligado, não faz nada. Devolve os ids registrados. */
export function iniciar() {
  if (!Catalogo.ligado() || PORID.size) return [...PORID.keys()];
  for (const c of DADOS.chefes) {
    if (!BESTIARY[c.base]) continue;
    const def = BossesUnicos.registrar(definicao(c));
    if (!CATALOGO.bosses.some((b) => b.id === c.id)) CATALOGO.bosses.push(entradaDoCatalogo(c, def));
    PORID.set(c.id, c);
  }
  return [...PORID.keys()];
}

/** Os Únicos exclusivos do chefe que se equipam no Draevor (a base do Único tem slot). */
export function exclusivosEquipaveis(c) {
  const cat = Catalogo.catalogo();
  if (!cat) return [];
  return c.unicos
    .map((u) => {
      const b = cat.classes[u.classe]?.bases.find((x) => x.nome === u.base);
      return b && idDaBase(b.id) ? { ...u, baseId: b.id } : null;
    })
    .filter(Boolean);
}

/**
 * A tabela EXCLUSIVA do chefe: com `chanceDoExclusivoPct`, 1 Único só dele (sorteado entre os equipáveis), já como peça do jogo; ou null.
 * `ilvl`: o Item Level (o nível do chefe).
 */
export function dropExclusivo(bossId, { rng = Math.random, ilvl = DADOS.regra.nivel } = {}) {
  const c = pinaculo(bossId);
  if (!c || rng() * 100 >= DADOS.regra.chanceDoExclusivoPct) return null;
  const lista = exclusivosEquipaveis(c);
  if (!lista.length) return null;
  const u = lista[Math.floor(rng() * lista.length)];
  const regras = Catalogo.REGRAS;
  return pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras, base: u.baseId, raridade: 'unico', ilvl: Math.min(regras.drop?.ilvlMaximo ?? 100, ilvl), rng, unico: u.slug }), regras, rng);
}
