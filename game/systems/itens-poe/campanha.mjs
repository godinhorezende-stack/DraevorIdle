// A CAMPANHA do PoE no jogo local (sistema de itens do PoE, incremento C3 — só com ITENS_POE=1; em produção a campanha é a do Draevor).
//
// Decisões do dono (05/10): a campanha do PoE SUBSTITUI a do Draevor; o terreno de cada área é o MAPA de uma hunt do Draevor de
// ambientação parecida; os monstros são os do PoE no desenho do Draevor. Montagem (dados em `gamedata/itens-poe/campanha-poe.json`):
//   1. cada área de combate vira uma hunt virtual (o id da área) com o APELIDO do mapa da hunt base (`terreno.apelidarMapa`): o terreno, a
//      grade e as posições dos spawns são os da hunt base;
//   2. os spawns trocam os bichos pelos monstros do PoE da área (revezando; os únicos da área — Hillock... — no fim), com os status do
//      PoE (`itens-poe/monstros.mjs`) e sem a escala da campanha (o nível da área já é o nível dos monstros);
//   3. cada chefe de ato vira um BOSS ÚNICO com os status do PoE (vida, golpe, ritmo, resistências), numa arena de boss;
//   4. os atos viram atos do runtime de atos (`Campanha.registrarAto`): as áreas em grafo (as ligações do mapa do PoE, orientadas a partir
//      da primeira área do ato; as cidades ficam de fora e ligam os dois lados), o chefe depois da última área, cada ato abrindo depois
//      do chefe do anterior. A campanha do Draevor sai (a de `campanha.json`, com o PoE ligado, começa vazia — `campanha.mjs`).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { ligado } from './catalogo.mjs';
import * as Monstros from './monstros.mjs';
import * as Habilidades from './habilidades.mjs';
import { CATALOGO } from '../dados.mjs';
import { BESTIARY } from '../hunt/monstros.mjs';
import { acharHunt, apelidarMapa, definirTransformadorDeSpawns, spawnsDaHunt } from '../hunt/terreno.mjs';
import * as BossesUnicos from '../bosses-unicos/catalogo.mjs';
import * as Campanha from '../campanha.mjs';

const C = Monstros.CAMPANHA;

// O MAPA trocado na engine (tela "Campanha do PoE"): `{ areaId: huntId }`, por cima do que `montar-campanha-poe.mjs` escolheu.
const ARQUIVO_DE_MAPAS = new URL('../../gamedata/itens-poe/campanha-mapas.json', import.meta.url);
export const MAPAS_TROCADOS = existsSync(ARQUIVO_DE_MAPAS) ? JSON.parse(readFileSync(ARQUIVO_DE_MAPAS, 'utf8')) : {};
for (const [id, mapa] of Object.entries(MAPAS_TROCADOS)) if (C.areas[id] && !C.areas[id].cidade) C.areas[id].mapa = mapa;

/** Os mapas do Draevor que uma área pode usar (as hunts de verdade, sem as áreas virtuais do PoE). */
export const mapasDoDraevor = () => CATALOGO.hunts.filter((h) => !h.poeArea && acharHunt(h.id)).map((h) => ({ id: h.id, nome: h.name ?? h.id, nivel: h.level ?? null }));

/** A hunt virtual da área (a hunt base com o id, o nome e o nível da área). */
const huntDaArea = (a, base) => ({ ...base, id: a.id, name: a.nome, level: a.nivel, blurb: `${a.ato === 11 ? 'Epílogo' : `Ato ${a.ato}`} (PoE)`, poeArea: true });

/**
 * Troca o MAPA (o terreno) de uma área: vale na hora (quem entrar de novo já pega o terreno novo) e fica salvo em `campanha-mapas.json`.
 * Devolve `{ ok, erro? }`.
 */
export function trocarMapa(id, mapa, { salvar = true } = {}) {
  const a = C.areas[id];
  if (!a || a.cidade) return { ok: false, erro: 'Área desconhecida (ou cidade, que não tem combate).' };
  const base = acharHunt(mapa);
  if (!base || base.poeArea) return { ok: false, erro: `"${mapa}" não é um mapa do Draevor.` };
  a.mapa = mapa;
  MAPAS_TROCADOS[id] = mapa;
  if (INICIADO) {
    apelidarMapa(id, mapa);
    const i = CATALOGO.hunts.findIndex((h) => h.id === id);
    if (i >= 0) CATALOGO.hunts[i] = huntDaArea(a, base);
    else CATALOGO.hunts.push(huntDaArea(a, base));
  }
  if (salvar) writeFileSync(ARQUIVO_DE_MAPAS, `${JSON.stringify(MAPAS_TROCADOS, null, 2)}\n`);
  return { ok: true };
}
export const idDoChefe = (ato) => `poe-chefe-ato-${ato}`;
const idDoAto = (ato) => `poe-ato-${ato}`;

/** As criaturas nativas de um mapa do Draevor (as chaves dos spawns da hunt base). */
const nativosDoMapa = (mapa) => [...new Set((spawnsDaHunt(mapa) ?? []).flatMap((s) => (s.criaturas ?? []).map((c) => c.key)))];

/** As ligações de uma área sem passar por cidade (a cidade liga os dois lados). */
function vizinhos(id, ato) {
  const saida = new Set();
  const visto = new Set([id]);
  const fila = [...(C.areas[id]?.conexoes ?? [])];
  while (fila.length) {
    const v = fila.shift();
    if (visto.has(v)) continue;
    visto.add(v);
    const a = C.areas[v];
    if (!a || a.ato !== ato) continue;
    if (a.cidade) fila.push(...a.conexoes);
    else saida.add(v);
  }
  return [...saida];
}

/** O ato do PoE no formato dos atos do runtime (grafo sem ciclo, a partir da primeira área). */
export function atoDoRuntime(numero, anterior) {
  const ato = C.atos.find((a) => a.numero === numero);
  const chefe = C.chefes[numero];
  const ids = (ato?.areas ?? []).filter((id) => C.areas[id] && !C.areas[id].cidade);
  if (!ids.length || !chefe?.monstro) return null;
  // Profundidade de cada área a partir da primeira (busca em largura); a ligação vai da mais rasa para a mais funda (nunca fecha ciclo).
  const prof = new Map([[ids[0], 0]]);
  const fila = [ids[0]];
  while (fila.length) {
    const v = fila.shift();
    for (const w of vizinhos(v, numero)) if (ids.includes(w) && !prof.has(w)) {
      prof.set(w, prof.get(v) + 1);
      fila.push(w);
    }
  }
  // Área que nenhuma ligação alcança (o mapa a liga só a outro ato): entra depois da área anterior na ordem do ato.
  ids.forEach((id, i) => {
    if (!prof.has(id)) prof.set(id, (prof.get(ids[i - 1]) ?? 0) + 1);
  });
  const conexoes = [];
  const par = new Set();
  for (const v of ids) for (const w of vizinhos(v, numero)) if (ids.includes(w) && prof.get(w) > prof.get(v) && !par.has(`${v}>${w}`)) {
    par.add(`${v}>${w}`);
    conexoes.push({ de: v, para: w });
  }
  // Sem nenhuma entrada (fora a primeira): sai da primeira área (que não tem entrada nenhuma — nunca fecha ciclo).
  for (const id of ids.slice(1)) if (!conexoes.some((c) => c.para === id)) conexoes.push({ de: ids[0], para: id });
  // A fase antes do chefe: a de nível mais alto (empate: a última na ordem do ato).
  const ultima = [...ids].reverse().reduce((m, id) => (C.areas[id].nivel > C.areas[m].nivel ? id : m), ids.at(-1));
  const nivel = (n) => ({ facil: n, medio: n, dificil: n });
  return {
    id: idDoAto(numero),
    nome: ato.nome,
    descricao: `${ato.nome} da campanha do Path of Exile.`,
    ordem: numero,
    anterior,
    estado: 'publicado',
    inicio: ids[0],
    fases: ids.map((id, i) => ({
      id,
      nome: C.areas[id].nome,
      descricao: C.areas[id].notas ?? '',
      ordem: i + 1,
      huntId: id,
      nivel: nivel(C.areas[id].nivel),
      obrigatoria: id === ultima,
      ...(C.areas[id].posicao ? { posicao: C.areas[id].posicao } : {}),
    })),
    conexoes,
    bossFinal: { bossId: idDoChefe(numero), faseAnterior: ultima, nivel: nivel(chefe.nivel) },
  };
}

/** Os monstros comuns que o chefe invoca: os da área dele (pelo nome), senão os da última área do ato. */
function invocaveisDoChefe(numero) {
  const chefe = C.chefes[numero];
  const doAto = Object.values(C.areas).filter((a) => a.ato === numero && !a.cidade);
  const area = doAto.find((a) => a.nome === chefe.area) ?? doAto.at(-1);
  return (area?.monstros ?? []).filter((m) => !m.unico).map((m) => Monstros.chaveDe(m)).filter((k) => BESTIARY[k]).slice(0, 1);
}

/** O chefe de ato como boss único + a entrada do painel/arena (o mesmo jeito dos chefes pináculo). */
function registrarChefe(numero) {
  const chefe = C.chefes[numero];
  const m = chefe?.monstro;
  if (!m) return null;
  const base = Monstros.desenhoPeloNome(chefe.nome) ?? 'demon';
  const be = BESTIARY[base];
  const id = idDoChefe(numero);
  if (!BossesUnicos.bossUnico(id)) {
    BossesUnicos.registrar({
      id,
      nome: chefe.nome.split(',')[0].split(' / ')[0],
      descricao: `Chefe do ${numero === 11 ? 'Epílogo' : `Ato ${numero}`} da campanha do Path of Exile.`,
      categoria: 'principal',
      base,
      nivel: chefe.nivel,
      atributos: { vida: m.vida + (m.escudoDeEnergia ?? 0), expMult: Math.max(0.01, m.experiencia / Math.max(1, be?.exp ?? 1)), armadura: m.armadura ?? 0, resistencias: { ...m.resistencias } },
      melee: { min: Math.max(1, Math.round(m.dano * 0.8)), max: Math.max(1, Math.round(m.dano * 1.2)), intervaloMs: Math.max(250, Math.round(m.tempoAtaque * 1000)) },
      usaPoderesDoBase: false,
      usaEscalaDaFase: false,
      // As habilidades do chefe (poedb): magias, áreas avisadas e invocações (os monstros comuns da área dele).
      comportamentos: Habilidades.comportamentos(m, invocaveisDoChefe(numero)),
    });
  }
  if (!CATALOGO.bosses.some((b) => b.id === id)) {
    const arena = CATALOGO.bosses.find((b) => b.creatures?.[0]?.key === base);
    CATALOGO.bosses.push({
      id,
      name: chefe.nome,
      custom: true,
      level: chefe.nivel,
      density: 1,
      blurb: `chefe do ${numero === 11 ? 'Epílogo' : `Ato ${numero}`} (PoE)`,
      ...(arena ? { origin: arena.origin, crop: arena.crop, limite: arena.limite, partida: arena.partida } : { limite: { caixas: { 7: { x: 0, y: 0, w: 40, h: 40 } }, w: 40, h: 40 }, partida: { x: 20, y: 34, z: 7 } }),
      boss: true,
      cooldownHours: 0,
      exp: m.experiencia,
      hp: m.vida,
      lootCount: 0,
      creatures: [{ key: base, name: chefe.nome, look: be?.look ?? 0, exp: m.experiencia, hp: m.vida }],
      task: false,
      bossUnico: id,
      poeChefeDeAto: numero,
    });
  }
  return id;
}

let INICIADO = null;
/** Monta a campanha do PoE (uma vez). Sem o sistema ligado, nada. Devolve `{ areas, atos, problemas }`. */
export function iniciar() {
  if (!ligado()) return { areas: 0, atos: [], problemas: [] };
  if (INICIADO) return INICIADO;
  // 1. as hunts virtuais das áreas, com o apelido do mapa
  let areas = 0;
  for (const a of Object.values(C.areas)) {
    if (a.cidade || !a.mapa) continue;
    const base = acharHunt(a.mapa);
    if (!base) continue;
    apelidarMapa(a.id, a.mapa);
    if (!CATALOGO.hunts.some((h) => h.id === a.id)) CATALOGO.hunts.push(huntDaArea(a, base));
    areas++;
  }
  // 2. os monstros e a troca dos bichos dos spawns
  const { porArea } = Monstros.iniciar(nativosDoMapa);
  const unicosDa = (id) => C.areas[id].monstros.map((m, i) => (m.unico ? porArea.get(id)?.[i] : null)).filter(Boolean);
  const comunsDa = (id) => {
    const l = C.areas[id].monstros.map((m, i) => (m.unico ? null : porArea.get(id)?.[i])).filter(Boolean);
    return l.length ? l : porArea.get(id) ?? [];
  };
  definirTransformadorDeSpawns((areaId, spawns) => {
    if (!C.areas[areaId]) return spawns;
    const comuns = comunsDa(areaId);
    const unicos = unicosDa(areaId);
    if (!comuns.length) return spawns;
    return spawns.map((s, i) => {
      // Os ÚNICOS da área (Hillock, Brutus...) nos últimos spawns, um em cada; os outros revezam os comuns.
      const u = unicos[spawns.length - 1 - i];
      if (u) return { ...s, quantidade: 1, criaturas: [{ key: u, peso: 1 }], raridade: 'normal', modificadores: [] };
      return { ...s, criaturas: [{ key: comuns[i % comuns.length], peso: 1 }] };
    });
  });
  // 3. os chefes de ato e 4. os atos
  const atos = [];
  const problemas = [];
  let anterior = null;
  for (const a of C.atos) {
    if (!registrarChefe(a.numero)) continue;
    const ato = atoDoRuntime(a.numero, anterior);
    if (!ato) continue;
    const r = Campanha.registrarAto(ato);
    if (!r.ok) {
      problemas.push(...r.problemas.map((p) => `${ato.nome}: ${p.onde} — ${p.mensagem}`));
      continue;
    }
    atos.push(r.numero);
    anterior = ato.id;
  }
  INICIADO = { areas, atos, problemas };
  return INICIADO;
}
