// O SALÃO DOS GRÃO-MESTRES (08/11 — o dono: "Personagens do ranking"): "Contém os Grão-Mestres Imortalizados / Escalonamento de dano de PvP em efeito".
// No PoE os monstros do mapa são cópias de personagens de verdade (os Grão-Mestres), e o dano entre eles e você segue a regra de PvP. Aqui:
//   - os GRÃO-MESTRES são os personagens do topo do ranking do PoE do jogo (o nível, sem o personagem de teste — a mesma regra do `ranking.mjs`): os
//     que estão online (o estado de agora) e os do banco (uma foto, refeita a cada 10 min, em segundo plano); sem nenhum, você mesmo;
//   - cada um vira um monstro Único no lugar de um grupo do mapa: o nome e a roupa dele, a Vida (com o Escudo de Energia) e as resistências da
//     ficha dele, e o GOLPE do duelo da Arena (`arena.golpeNoAdversario` — o dano da arma, a regra de PvP do jogo) no intervalo de ataque dele;
//   - não há chefe nem os grupos de sempre: limpar o Salão é vencer os Grão-Mestres.
import { banco } from '../../database/banco.mjs';
import * as Ficha from '../ficha.mjs';
import { sqlDoPoe } from '../personagem/legado.mjs';
import { ehTestador, sqlSemTestador } from '../personagem/testador.mjs';
import { sessoesVivas } from '../ranking.mjs';

/** Quantos Grão-Mestres no Salão (o PoE tem por volta de vinte; aqui, até o tamanho da foto). */
export const QUANTOS = 12;
const FOTO_MS = 10 * 60_000;
let foto = { em: 0, lista: [] };
let buscando = null;

const pg = banco.dialeto === 'postgres';
let consulta = null;
const sql = () => (consulta ??= banco.prepare(pg
  ? `SELECT nome, estado FROM personagens WHERE ${sqlDoPoe('postgres')} AND ${sqlSemTestador('postgres')} ORDER BY (estado::jsonb #>> '{level}')::int DESC NULLS LAST, nome LIMIT ${QUANTOS}`
  : `SELECT nome, estado FROM personagens WHERE ${sqlDoPoe('sqlite')} AND ${sqlSemTestador('sqlite')} ORDER BY json_extract(estado, '$.level') DESC, nome LIMIT ${QUANTOS}`));

/** O Grão-Mestre de um personagem (`nome`, o estado dele): o que vira o monstro. Null se a ficha não sai. */
export function doPersonagem(nome, estado) {
  try {
    const f = Ficha.combate(estado);
    const vida = Math.max(1, Math.round((estado.maxHp ?? estado.hp ?? 1) + (Number(f.escudoMaximo ?? f.maxEs ?? estado.maxEs) || 0)));
    const golpe = Math.max(1, ((Number(f.ataqueMin) || 2) + (Number(f.ataqueMax) || 6)) / 2);
    const res = Object.fromEntries(['physical', 'fire', 'ice', 'energy', 'chaos'].map((el) => [el, Math.round(Number(f.protection?.[el]) || 0)]));
    return { nome, level: estado.level ?? 1, outfit: estado.outfit ?? null, vida, golpe, intervaloMs: Math.max(150, Number(f.intervaloDoGolpeMs) || 1000), res };
  } catch {
    return null;
  }
}

/** Refaz a foto do banco (em segundo plano). */
async function refazerFoto() {
  const lista = [];
  for (const r of await sql().all()) {
    let estado = null;
    try {
      estado = typeof r.estado === 'string' ? JSON.parse(r.estado) : r.estado;
    } catch {
      continue;
    }
    if (!estado || ehTestador(estado)) continue;
    const g = doPersonagem(r.nome, estado);
    if (g) lista.push(g);
  }
  foto = { em: Date.now(), lista };
}

/**
 * Os Grão-Mestres de agora (síncrono — a instância nasce no tique): os online (o estado de agora) por cima da foto do banco, pelo nível, até
 * `QUANTOS`; a foto velha pede outra, em segundo plano. `reserva`: o estado de quem abriu o mapa — o Grão-Mestre quando não há nenhum.
 */
export function atuais({ reserva = null, nomeDaReserva = 'Você' } = {}) {
  if (Date.now() - foto.em > FOTO_MS && !buscando) buscando = refazerFoto().catch((e) => console.error('grão-mestres', e.message)).finally(() => { buscando = null; });
  const porNome = new Map(foto.lista.map((g) => [g.nome, g]));
  for (const s of sessoesVivas().values()) {
    if (!s?.estado || !s.personagem?.nome || ehTestador(s.estado)) continue;
    const g = doPersonagem(s.personagem.nome, s.estado);
    if (g) porNome.set(g.nome, g);
  }
  const lista = [...porNome.values()].sort((a, b) => b.level - a.level || a.nome.localeCompare(b.nome)).slice(0, QUANTOS);
  if (!lista.length && reserva) {
    const g = doPersonagem(nomeDaReserva, reserva);
    if (g) lista.push(g);
  }
  return lista;
}

/**
 * Faz o monstro `m` (um comum do mapa, já com a raridade e os efeitos) virar o Grão-Mestre `g`: Único, o nome e a roupa dele, a Vida, as
 * resistências e o golpe (a força pelo golpe do monstro — `golpeBase`: o maior golpe dele) no intervalo do golpe dele. Muta e devolve.
 */
export function virarGraoMestre(m, g, { golpeBase = 0, intervaloBase = 2000 } = {}) {
  m.name = `${g.nome}, Grão-Mestre`;
  m.raridade = 'unico';
  delete m.mods;
  m.graoMestre = g.nome;
  if (g.outfit) {
    m.look = g.outfit.type ?? m.look;
    m.colors = { head: g.outfit.head ?? 0, body: g.outfit.body ?? 0, legs: g.outfit.legs ?? 0, feet: g.outfit.feet ?? 0 };
    m.addons = g.outfit.addons ?? 0;
  }
  m.maxHp = g.vida;
  m.hp = g.vida;
  delete m.esPoe;
  m.resist = { ...g.res };
  m.forca = golpeBase > 0 ? g.golpe / golpeBase : 1;
  m.velocidadeDeAtaque = Math.max(0.1, intervaloBase / g.intervaloMs);
  return m;
}
