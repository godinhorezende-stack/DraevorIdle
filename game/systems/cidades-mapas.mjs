// O MAPA de cada CIDADE (08/11 — o dono: "uma diferente para cada ato… igual do PoE"; `gamedata/cidades/cidades.json`, montadas por
// `tools/cidades-rme/criar.mjs`). A cidade do ato (`cidades.mjs`) tem o seu mapa, os seus NPCs (os do PoE naquele ato), os marcos e o ponto de chegada;
// a cidade sem mapa próprio usa o de outra (`igualA` — o PoE repete a Vigília no Ato 6, Sarn no 8 e Highgate no 9) ou, sem nenhum, a cidade de
// sempre (`CITY_MAP`/`CITY_META`). O chão, o andar e o caminho de cada uma são os dela.
import { readFileSync, existsSync } from 'node:fs';
import { CITY_MAP, CITY_META } from './dados.mjs';
import { cidadeDe } from './cidades.mjs';

const PASTA = new URL('../gamedata/cidades/', import.meta.url);
const DADOS = existsSync(new URL('cidades.json', PASTA)) ? JSON.parse(readFileSync(new URL('cidades.json', PASTA), 'utf8')) : { cidades: [] };
const POR_ID = new Map((DADOS.cidades ?? []).map((c) => [c.id, c]));
const MAPAS = new Map();
const GRADES = new Map();
export const SEMPRE = 'city';
const { x = 99, y = 65, z = 7 } = CITY_META.player ?? {};
export const CHEGADA_DE_SEMPRE = Object.freeze({ x, y, z, dir: 2 });

/** A definição da cidade (a dela; a que repete outra — `igualA` — leva dela o que não tem: o mapa, a chegada, os NPCs e os marcos). */
function definicao(id) {
  const c = POR_ID.get(String(id ?? ''));
  const base = c?.igualA ? POR_ID.get(c.igualA) : null;
  return c ? (base ? { ...base, ...c, id: c.id, mapa: base.mapa, mapaDe: base.id } : { ...c, mapaDe: c.id }) : null;
}
/** O id do MAPA da cidade (o que vai em `mapId`): o da cidade com mapa montado (a própria ou a igual), ou `city`. */
export function mapaIdDa(id) {
  const c = definicao(id);
  return c?.mapa && existsSync(new URL(`${c.mapaDe}-map.json`, PASTA)) ? c.mapaDe : SEMPRE;
}
/** O mapa (no formato de `CITY_MAP`). */
export function mapaDa(id) {
  const mid = mapaIdDa(id);
  if (mid === SEMPRE) return CITY_MAP;
  if (!MAPAS.has(mid)) MAPAS.set(mid, JSON.parse(readFileSync(new URL(`${mid}-map.json`, PASTA), 'utf8')));
  return MAPAS.get(mid);
}
/** Os NPCs e os marcos da cidade (`{ npcs, objetos, chao }`, como `CITY_META`). */
export function metaDa(id) {
  if (mapaIdDa(id) === SEMPRE) return CITY_META;
  const c = definicao(id);
  return { npcs: c.npcs ?? [], objetos: c.objetos ?? [], chao: [] };
}
/** Onde se chega na cidade (`{ x, y, z, dir }`). */
export function chegadaDa(id) {
  if (mapaIdDa(id) === SEMPRE) return { ...CHEGADA_DE_SEMPRE };
  const c = definicao(id);
  return { x: c.chegada.x, y: c.chegada.y, z: c.chegada.z ?? mapaDa(id).z, dir: c.chegada.dir ?? 2 };
}
// (09/11 — o dono: "npc tem colisão tbm") as casas dos NPCs da cidade: ninguém passa por cima deles
const DOS_NPCS = new Map();
function casasDosNpcs(id) {
  const chave = String(id ?? '');
  if (!DOS_NPCS.has(chave)) DOS_NPCS.set(chave, new Set((metaDa(id).npcs ?? []).filter((n) => Number.isFinite(n.x) && Number.isFinite(n.y)).map((n) => `${n.x},${n.y}`)));
  return DOS_NPCS.get(chave);
}
/** A casa está bloqueada no mapa da cidade? (fora do mapa: sim; a casa de um NPC: sim) */
export function bloqueadoNa(id, x, y) {
  const m = mapaDa(id);
  if (x < 0 || y < 0 || x >= m.width || y >= m.height) return true;
  return !!m.blocked[y * m.width + x] || casasDosNpcs(id).has(`${x},${y}`);
}
/** A cidade no formato de grade do caminho (`caminho.mjs`); uma por cidade (a que repete o mapa de outra tem os NPCs dela). */
export function gradeDa(id) {
  const chave = String(id ?? '');
  if (GRADES.has(chave)) return GRADES.get(chave);
  const m = mapaDa(id);
  const npcs = casasDosNpcs(id);
  const andavel = new Set();
  for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) if (!m.blocked[y * m.width + x] && !npcs.has(`${x},${y}`)) andavel.add(`${x},${y}`);
  const g = { minX: 0, maxX: m.width - 1, minY: 0, maxY: m.height - 1, andavel };
  GRADES.set(chave, g);
  return g;
}

/**
 * A posição do personagem na cidade dele: a que ele tem, se é desta cidade (`pos.cidade`) e é andável; senão, a chegada (a cidade mudou — o ato
 * novo, a viagem pelo mapa da campanha —, ou a casa não existe mais). Muta `estado.pos` e devolve.
 */
export function garantirPosicao(estado) {
  const cidade = cidadeDe(estado);
  const mid = mapaIdDa(cidade.id);
  const pos = estado.pos ?? {};
  const daCidade = (pos.cidade ?? SEMPRE) === mid;
  if (!daCidade || !Number.isFinite(pos.x) || !Number.isFinite(pos.y) || bloqueadoNa(cidade.id, pos.x, pos.y) || (pos.z != null && pos.z !== mapaDa(cidade.id).z)) estado.pos = { ...chegadaDa(cidade.id), cidade: mid };
  else if (pos.cidade !== mid) estado.pos = { ...pos, cidade: mid };
  return estado.pos;
}
/** Põe o personagem na CHEGADA da cidade dele (a viagem, a morte, a saída da arena): a casa de entrada daquela cidade, não a da praça antiga. */
export function irParaAChegada(estado) {
  const cidade = cidadeDe(estado);
  estado.pos = { ...chegadaDa(cidade.id), cidade: mapaIdDa(cidade.id) };
  return estado.pos;
}
/** Para a cidade do estado: o id da cidade (a chave do chão e da praça). */
export const idDe = (estado) => cidadeDe(estado).id;
