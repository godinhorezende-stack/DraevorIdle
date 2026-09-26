// Os bichos: nascer, renascer, andar atrás do jogador, trocar de andar.
// Parte de `cacadas.mjs` (dividido em 2026-09-25); a fachada continua lá.
import { CATALOGO } from '../../nucleo/dados.mjs';
import * as R from '../../nucleo/regras.mjs';
import { huntOuMapaCustom } from './terreno.mjs';
import { VIZINHANCA_8, VIZINHANCA_4, bfsDistancias, distancia } from './caminho.mjs';
import * as Charms from '../charms.mjs';

export const BESTIARY = CATALOGO.bestiary;

export let proximoUid = 1;

export function criarMonstro(posicao, hunt) {
  const bicho = BESTIARY[posicao.key];
  if (!bicho) return null;
  return {
    uid: proximoUid++,
    key: posicao.key,
    name: bicho.name,
    look: bicho.look,
    lookItem: bicho.lookItem || 0,
    colors: bicho.colors ?? null,
    x: posicao.x,
    y: posicao.y,
    dir: 2,
    hp: bicho.hp,
    maxHp: bicho.hp,
    armor: bicho.armor ?? 0,
    exp: bicho.exp ?? 0,
    loot: bicho.loot ?? [],
    spawn: { key: posicao.key, x: posicao.x, y: posicao.y, ...(posicao.z != null ? { z: posicao.z } : {}) },
  };
}

/*
 * ---- Trocar de andar ----
 *
 * `hunt.monstros` é sempre SÓ o andar onde o personagem está — é o que o
 * original manda no `state` (os bichos vêm sem `z`; `hunt.z` diz o andar). Os
 * dos outros andares esperam em `hunt.outrosAndares[z]`, do jeito que ficaram,
 * e voltam quando ele volta. A lista é trocada NO LUGAR: numa caçada em grupo
 * ela é a mesma para todos da sala (ver `entrarNaSala`), e quem muda de andar
 * é o dono — os outros vão atrás (ver `tique`).
 */
/*
 * ---- O bicho gravado leva só o que é DELE ----
 *
 * `criarMonstro` copia para cada bicho o nome, a aparência, a vida máxima, a
 * exp e a tabela de loot do bestiário. Em memória isso não custa nada (são as
 * mesmas referências), mas no banco cada bicho virava ~1 KB — a hunt inteira
 * (até 547 bichos) era 97% dos 150–720 KB do personagem, regravados a cada
 * 30 s e relidos em todo login (ver docs/auditoria-performance.md, gargalo 6).
 *
 * Na gravação sai só o campo que é IGUAL ao do bestiário daquela `key`; ao
 * carregar, o que falta volta de lá. Campo que mudou (a exp de um bicho que o
 * combate ajustou, um boss com outra vida) continua gravado, e bicho sem `key`
 * (os bonecos do pátio) vai inteiro. Personagem gravado antes disto tem todos
 * os campos, e carregar não mexe em nada.
 */
const FIXOS_DO_BICHO = ['name', 'look', 'lookItem', 'colors', 'maxHp', 'armor', 'exp', 'loot'];
const fixosPorKey = new Map();

function fixosDe(key) {
  if (key == null) return null;
  let f = fixosPorKey.get(key);
  if (f) return f;
  const b = BESTIARY[key];
  if (!b) return null;
  // Os mesmos valores que `criarMonstro` põe no bicho.
  const valores = { name: b.name, look: b.look, lookItem: b.lookItem || 0, colors: b.colors ?? null, maxHp: b.hp, armor: b.armor ?? 0, exp: b.exp ?? 0, loot: b.loot ?? [] };
  const textos = Object.fromEntries(Object.entries(valores).map(([k, v]) => [k, JSON.stringify(v)]));
  f = { valores, textos };
  fixosPorKey.set(key, f);
  return f;
}

/** O bicho para o banco: sem os campos que são cópia exata do bestiário. */
export function compactarMonstro(m) {
  const f = fixosDe(m?.key);
  if (!f) return m;
  const c = {};
  for (const k in m) {
    const v = m[k];
    if (k in f.valores && (v === f.valores[k] || JSON.stringify(v) === f.textos[k])) continue;
    c[k] = v;
  }
  // O ponto de nascimento repete a `key` do próprio bicho (ver `criarMonstro`).
  if (c.spawn?.key === m.key) {
    const { key, ...resto } = c.spawn;
    c.spawn = resto;
  }
  return c;
}

/** O bicho lido do banco, com o que foi tirado na gravação de volta (no lugar). */
export function completarMonstro(m) {
  const f = fixosDe(m?.key);
  if (!f) return m;
  for (const k of FIXOS_DO_BICHO) if (!(k in m)) m[k] = f.valores[k];
  // Na mesma ordem de `criarMonstro` (key primeiro), para a caçada voltar igual.
  if (m.spawn && !('key' in m.spawn)) m.spawn = { key: m.key, ...m.spawn };
  return m;
}

/*
 * O contador de `uid` recomeça em 1 quando o servidor reinicia, mas os bichos
 * de uma hunt carregada do banco já têm os deles: sem isto, o bicho que
 * renascia podia pegar o `uid` de um que ainda estava vivo, e o cliente
 * (que junta os bichos pelo `uid`) e o alvo confundiam os dois.
 */
export function garantirUidAcimaDe(n) {
  if (Number.isFinite(n) && n >= proximoUid) proximoUid = n + 1;
}

export function trocarDeAndar(hunt, destino) {
  if (hunt.anfitriao) return false;
  const guardados = (hunt.outrosAndares ??= {});
  const ficam = hunt.monstros.splice(0, hunt.monstros.length);
  for (const m of ficam) m.perseguindo = false;
  if (ficam.length) guardados[hunt.z] = ficam;
  hunt.monstros.push(...(guardados[destino.z] ?? []));
  delete guardados[destino.z];
  hunt.z = destino.z;
  hunt.pos.x = destino.x;
  hunt.pos.y = destino.y;
  hunt.alvo = null;
  hunt.alvoTravado = null;
  hunt.perseguicao = null;
  hunt.rumo = null;
  // O familiar sobe junto (ele reaparece do lado do dono no próximo tique).
  if (hunt.summon) {
    hunt.summon.x = destino.x;
    hunt.summon.y = destino.y;
  }
  return true;
}

/*
 * ---- Os bichos renascem ----
 *
 * Sem isto a hunt esvaziava: matou os 26 Trolls da troll-cave, acabou — e a
 * caçada offline de horas não teria o que caçar. O tempo real de respawn o
 * servidor original nunca manda; o que dá para medir é o ritmo: o Zotod matava
 * ~11 Trolls por minuto numa hunt de 26 spawns, então cada um volta em no
 * máximo ~2 min. 60s é uma aproximação dentro disso.
 */
export const RESPAWN_MS = 60_000;

export function renascer(hunt) {
  const fila = hunt.respawns ?? [];
  if (!fila.length) return;
  const dados = huntOuMapaCustom(hunt.huntId);
  // No lugar (splice), e não `hunt.respawns = ...`: numa caçada em grupo a fila
  // é a MESMA para todos da sala (ver `entrarNaSala`).
  const fica = fila.filter((r) => {
    if ((hunt.clock ?? 0) < r.volta) return true;
    // Bicho de outro andar renasce lá, esperando o personagem (ver `trocarDeAndar`).
    if (r.z != null && hunt.z != null && r.z !== hunt.z) {
      const novo = criarMonstro(r, dados);
      if (novo) ((hunt.outrosAndares ??= {})[r.z] ??= []).push(novo);
      return false;
    }
    // Não nasce em cima do personagem nem de outro bicho — tenta de novo depois.
    const ocupado = (hunt.pos.x === r.x && hunt.pos.y === r.y) || hunt.monstros.some((m) => m.x === r.x && m.y === r.y);
    if (ocupado) return true;
    const novo = criarMonstro(r, dados);
    if (novo) hunt.monstros.push(novo);
    return false;
  });
  fila.splice(0, fila.length, ...fica);
}

/**
 * "ta faltando os mobs andar e atacar" — até aqui o monstro só brigava se o
 * jogador chegasse nele; agora, se o jogador estiver dentro do alcance de
 * percepção mas fora do corpo a corpo, o próprio monstro anda um passo na
 * direção dele, um por tique (mesma cadência do passo do jogador). Bicho
 * já adjacente não anda — é aí que `round()` briga. Sem perseguição
 * ilimitada: um Troll do outro lado do mapa não sabe que você existe.
 */
export const ALCANCE_DE_PERCEPCAO = 8;
/** Até onde um bicho que JÁ está perseguindo continua atrás do jogador. */
export const ALCANCE_DE_PERSEGUICAO = 12;

/*
 * ---- Cada bicho anda na velocidade dele ----
 *
 * "às vezes tem mob que fica andando com a animação mesmo estando do lado do
 * meu player": todo bicho dava um passo a cada 250ms (o do jogador) e o
 * `moveMs` dele nunca ia para o client, que então animava cada passo por
 * 500ms — a animação ficava atrás da posição e o bicho "chegava andando".
 * Agora o passo é o da fórmula REAL do client (`duracaoDoPasso`, formulas.mjs)
 * com a `speed` REAL do bestiary e o tick do servidor (250ms, o mesmo que dá os
 * 250ms reais do jogador level 8): Troll 750ms, Amazon 500ms. Diagonal custa
 * 3x, como na fórmula. O `moveMs` de cada passo vai no snapshot.
 */
export function passoDoBicho(m, diagonal = false) {
  const speed = BESTIARY[m.key]?.speed ?? 100;
  return R.duracaoDoPasso(speed, { diagonal, tick: R.PASSO_MS });
}

export function moverMonstros(hunt, grade, agora) {
  const pronto = (m) => R.jaPode(agora, m.proximoPasso);
  const perseguindo = hunt.monstros.some((m) => {
    const d = distancia(hunt.pos, m);
    return pronto(m) && d > 1 && (d <= ALCANCE_DE_PERCEPCAO || (m.perseguindo && d <= ALCANCE_DE_PERSEGUICAO));
  });
  // Um BFS só, a partir do jogador, reaproveitado por todo bicho perseguindo
  // neste tique — bem mais barato do que um BFS por bicho.
  // Dois mapas de distância (só reto e com diagonal), reaproveitados por todo
  // bicho perseguindo neste tique — bem mais barato do que um BFS por bicho.
  const reto = perseguindo ? bfsDistancias(grade, hunt.pos, ALCANCE_DE_PERSEGUICAO + 6, null, VIZINHANCA_4) : null;
  let comDiagonal = null;
  const livre = (m, viz) =>
    !(viz.x === hunt.pos.x && viz.y === hunt.pos.y) && // não pisa no jogador
    !hunt.monstros.some((outro) => outro !== m && outro.hp > 0 && outro.x === viz.x && outro.y === viz.y);
  const melhorPasso = (m, dist, vizinhos) => {
    let destino = null;
    let melhorD = dist.em(m.x, m.y) ?? Infinity;
    for (const [dx, dy] of vizinhos) {
      const viz = { x: m.x + dx, y: m.y + dy };
      const dv = dist.em(viz.x, viz.y);
      if (dv == null || dv >= melhorD || !livre(m, viz)) continue;
      melhorD = dv;
      destino = viz;
    }
    return destino;
  };
  for (const m of hunt.monstros) {
    if (m.dummy) continue; // o boneco não anda
    const d = distancia(hunt.pos, m);
    // Quem já está perseguindo não larga o jogador por andar um pouco mais
    // longe (como no Tibia) — só além de `ALCANCE_DE_PERSEGUICAO`.
    if (d <= ALCANCE_DE_PERCEPCAO) m.perseguindo = true;
    else if (d > ALCANCE_DE_PERSEGUICAO) m.perseguindo = false;
    if (d <= 1) {
      // Colado: fica parado, virado para o jogador.
      const ox = hunt.pos.x - m.x;
      const oy = hunt.pos.y - m.y;
      m.dir = Math.abs(ox) > Math.abs(oy) ? (ox > 0 ? 1 : 3) : oy > 0 ? 2 : oy < 0 ? 0 : m.dir;
      continue;
    }
    if (!m.perseguindo || !pronto(m)) continue;
    let destino = melhorPasso(m, reto, VIZINHANCA_4);
    if (!destino) {
      comDiagonal ??= bfsDistancias(grade, hunt.pos, ALCANCE_DE_PERSEGUICAO + 4);
      destino = melhorPasso(m, comDiagonal, VIZINHANCA_8);
    }
    if (!destino) continue;
    const dx = Math.sign(destino.x - m.x);
    const dy = Math.sign(destino.y - m.y);
    m.x = destino.x;
    m.y = destino.y;
    m.dir = dy < 0 ? 0 : dy > 0 ? 2 : dx > 0 ? 1 : 3;
    // Paralisado (charms Cripple e Numb): passo bem mais lento por 10 s.
    m.moveMs = passoDoBicho(m, dx !== 0 && dy !== 0) * (Charms.paralisado(m, agora) ? Charms.FATOR_DA_PARALISIA : 1);
    m.proximoPasso = agora + m.moveMs;
  }
}
