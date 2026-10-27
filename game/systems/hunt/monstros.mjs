// Os bichos: nascer, renascer, andar atrás do jogador, trocar de andar.
// Parte de `cacadas.mjs` (dividido em 2026-09-25); a fachada continua lá.
import { CATALOGO } from '../dados.mjs';
import * as Raridade from '../mobs/raridade.mjs';
import { aliadosPorCasa } from './aliados.mjs';
import { aplicarEscala } from '../campanha.mjs';
import * as R from '../regras.mjs';
import { huntOuMapaCustom, gradeDaHunt } from './terreno.mjs';
import { andarDaGrade } from './andares.mjs';
import * as Protecao from '../protecao.mjs';
import { VIZINHANCA_8, VIZINHANCA_4, bfsDistancias, distancia } from './caminho.mjs';
import * as Charms from '../charms.mjs';
import * as Estados from '../skills/estados.mjs';
import * as Reforcos from '../skills/reforcos.mjs';
// (lote PR4, dono 25/10: o passo do Aprisionado pela Flecha Aprisionadora — o "menos" de cada corda)
import { fatorDoPassoAprisionado } from '../itens-poe/gemas-pr4.mjs';
// (lote G-C, dono 25/10 — D10: a Corrente Temporal, a velocidade de ação do amaldiçoado)
import { fatorDeAcao } from '../itens-poe/gemas-gac.mjs';
// (lote E1b, dono 26/10: o Imobilizado das Armadilhas de Urso não anda)
import { imobilizado } from '../itens-poe/gemas-e1b.mjs';
// (lote E2B, 26/10: o passo do debuff da Armadilha de Urso — o −80% que cai até 0)
import { fatorDoPassoDoUrso } from '../itens-poe/gemas-e2b.mjs';
import * as GemasR3D from '../itens-poe/gemas-r3d.mjs';

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
    // O ritmo do golpe dos monstros do PoE (o tempo de ataque deles — `itens-poe/monstros.mjs`); os do Draevor não têm.
    ...(bicho.velocidadeDeAtaque ? { velocidadeDeAtaque: bicho.velocidadeDeAtaque } : {}),
    spawn: {
      key: posicao.key, x: posicao.x, y: posicao.y, ...(posicao.z != null ? { z: posicao.z } : {}),
      // O bicho que renasce volta com a raridade do spawn dele (ver `renascer`).
      ...(posicao.raridade != null ? { raridade: posicao.raridade } : {}),
      ...(posicao.modificadores?.length ? { modificadores: posicao.modificadores } : {}),
    },
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
  // (revisão das gemas PR4: como a troca de área do PoE, o que grudou nos bichos do andar que fica para trás some — as flechas da Flecha Explosiva, os golpes da
  // Eletrocussão e a Concha esgotada —, sem explodir na volta; os restos dos mortos também)
  for (const m of ficam) {
    m.perseguindo = false;
    delete m.poeFusiveis;
    delete m.poeEletrocussao;
    if (m.poeConchas) for (const [k, c] of Object.entries(m.poeConchas)) if (c?.estourou != null) delete m.poeConchas[k];
  }
  delete hunt.poeRestosPR4;
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
 * máximo ~2 min. 60s era uma aproximação dentro disso.
 *
 * 30s (pedido do dono, 29/09, junto do balanceamento do 1–100): na simulação de
 * progressão, as hunts com poucos bichos (Feyrist Nightmare, Mother of Scarabs)
 * batiam no teto do respawn — o personagem matava 70–80% do máximo que 60s
 * permitia e ficava esperando bicho renascer.
 */
export const RESPAWN_MS = 30_000;

export function renascer(hunt) {
  const fila = hunt.respawns ?? [];
  if (!fila.length) return;
  const dados = huntOuMapaCustom(hunt.huntId);
  // A força da fase e a raridade/modificadores do spawn (a mesma ordem de quando nasceu).
  const criarMonstroDoSpawn = (r) => {
    const m = aplicarEscala(criarMonstro(r, dados), hunt.escala);
    return m ? Raridade.aplicar(m, { ...Raridade.doSpawn(r), sortear: true }) : m;
  };
  // A Safe Zone (`protecao.mjs`): o bicho cujo ponto ficou numa casa segura renasce na casa livre mais perto FORA dela (sem nenhuma por
  // perto, não renasce). A grade só é lida se o mapa tem casa segura.
  let grade;
  const gradeDoAndar = () => (grade ??= Protecao.temSeguras(gradeDaHunt(dados)?.mapa) ? andarDaGrade(gradeDaHunt(dados), hunt.z) : null);
  // No lugar (splice), e não `hunt.respawns = ...`: numa caçada em grupo a fila
  // é a MESMA para todos da sala (ver `entrarNaSala`).
  const fica = fila.filter((r) => {
    if ((hunt.clock ?? 0) < r.volta) return true;
    // Bicho de outro andar renasce lá, esperando o personagem (ver `trocarDeAndar`).
    if (r.z != null && hunt.z != null && r.z !== hunt.z) {
      const novo = criarMonstroDoSpawn(r);
      if (novo) ((hunt.outrosAndares ??= {})[r.z] ??= []).push(novo);
      return false;
    }
    // Não nasce em cima do personagem (nem de outro da party) nem de outro bicho — tenta de novo depois.
    const casaOcupada = (c) => (hunt.pos.x === c.x && hunt.pos.y === c.y) || aliadosPorCasa(hunt).has(`${c.x},${c.y}`) || hunt.monstros.some((m) => m.x === c.x && m.y === c.y);
    let onde = r;
    if (gradeDoAndar() && Protecao.ehSegura(gradeDoAndar(), r.x, r.y)) {
      onde = Protecao.casaForaDaZona(Protecao.gradeDosBichos(gradeDoAndar()), r, casaOcupada);
      if (!onde) return false;
      onde = { ...r, x: onde.x, y: onde.y };
    }
    if (casaOcupada(onde)) return true;
    // Na campanha, o bicho renasce com a força da fase (ver `systems/campanha.mjs`).
    const novo = criarMonstroDoSpawn(onde);
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
  // O modificador de velocidade (`velocidade`, ver `mobs/raridade.mjs`) encurta o passo.
  const speed = (BESTIARY[m.key]?.speed ?? 100) * (m.velocidade ?? 1);
  return R.duracaoDoPasso(speed, { diagonal, tick: R.PASSO_MS });
}

/*
 * ---- As SAFE ZONES (dono, 10/10 — `protecao.mjs`) ----
 * A caçada passa aqui a grade DOS BICHOS (sem as casas seguras): a BFS não passa por elas e nenhum passo cai nelas. Com o jogador numa
 * delas (`semPerseguir`), ninguém o persegue: a IA larga a perseguição em vez de ficar rondando a borda à espera dele.
 */
/** (R3, dono 27/10) As casas das torres de osso vivas no andar de agora (`Set` de "x,y"), ou null sem nenhuma. */
export function torresNoCaminho(hunt, agora) {
  const relogio = hunt?.clock ?? agora;
  const vivas = (hunt?.a2?.torres ?? []).filter((t) => t.ate > relogio && (t.z ?? 0) === (hunt.z ?? 0));
  return vivas.length ? new Set(vivas.map((t) => `${t.x},${t.y}`)) : null;
}
export function moverMonstros(hunt, grade, agora, { semPerseguir = false, percepcao = ALCANCE_DE_PERCEPCAO } = {}) {
  if (semPerseguir) {
    for (const m of hunt.monstros) m.perseguindo = false;
    return;
  }
  const pronto = (m) => R.jaPode(agora, m.proximoPasso);
  const perseguindo = hunt.monstros.some((m) => {
    const d = distancia(hunt.pos, m);
    return pronto(m) && d > 1 && (d <= percepcao || (m.perseguindo && d <= ALCANCE_DE_PERSEGUICAO));
  });
  // Um BFS só, a partir do jogador, reaproveitado por todo bicho perseguindo
  // neste tique — bem mais barato do que um BFS por bicho.
  // Dois mapas de distância (só reto e com diagonal), reaproveitados por todo
  // bicho perseguindo neste tique — bem mais barato do que um BFS por bicho.
  /*
   * (R3, dono 27/10) As TORRES DE OSSO da Torre Óssea (`hunt.a2.torres`, enquanto duram, no andar de agora) são OBSTÁCULO no passo dos monstros: a BFS não passa por elas e
   * nenhum passo cai nelas. Quem já está numa casa de torre sai normalmente (a casa dele fica sem distância e qualquer vizinha com caminho vale) — ninguém fica preso.
   */
  const torres = torresNoCaminho(hunt, agora);
  const reto = perseguindo ? bfsDistancias(grade, hunt.pos, ALCANCE_DE_PERSEGUICAO + 6, null, VIZINHANCA_4, torres) : null;
  let comDiagonal = null;
  /*
   * ---- Quem está em cada casa, sem varrer todo mundo ----
   *
   * `livre` era `hunt.monstros.some(...)` — para CADA vizinho candidato de
   * CADA bicho andando, uma volta em todos os outros. Numa hunt DENSA (uma
   * leva grande em cima do jogador) isso é O(bichos²): medido com
   * `bench-mover2.mjs`, 2.000 bichos perseguindo levavam 189ms/200 tiques
   * com o `.some()` contra 85ms com a grade abaixo — pouco mais que o dobro
   * mais rápido, e a distância cresce com a densidade. Com poucos bichos
   * perto (a maioria das hunts, a maior parte do tempo) montar a grade tem
   * um custo fixo que o `.some()` nem sempre paga — por isso só existe
   * quando alguém está de fato perseguindo (mesma condição do `reto`,
   * embaixo: sem isso ninguém chega em `melhorPasso`, e a grade seria
   * montada à toa em toda hunt parada).
   *
   * ATUALIZADA a cada passo do laço logo adiante: o `.some()` de antes
   * também lia a posição JÁ ATUALIZADA de um bicho que tinha andado mais
   * cedo no mesmo laço, então a grade precisa acompanhar, não ser uma
   * fotografia do início do tique.
   */
  const ocupada = perseguindo ? new Map() : null;
  if (ocupada) for (const m of hunt.monstros) if (m.hp > 0) ocupada.set(`${m.x},${m.y}`, m);
  // Os outros jogadores da sala (caçada em grupo): bicho também não pisa neles.
  const aliados = perseguindo ? aliadosPorCasa(hunt) : null;
  const livre = (m, viz) => {
    if (viz.x === hunt.pos.x && viz.y === hunt.pos.y) return false; // não pisa no jogador
    if (aliados.has(`${viz.x},${viz.y}`)) return false;
    if (torres?.has(`${viz.x},${viz.y}`)) return false;
    const outro = ocupada.get(`${viz.x},${viz.y}`);
    return !outro || outro === m;
  };
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
  let aliadosDaFuga = null;
  for (const m of hunt.monstros) {
    if (m.dummy) continue; // o boneco não anda
    const d = distancia(hunt.pos, m);
    // Quem já está perseguindo não larga o jogador por andar um pouco mais
    // longe (como no Tibia) — só além de `ALCANCE_DE_PERSEGUICAO`.
    if (d <= percepcao) m.perseguindo = true;
    else if (d > ALCANCE_DE_PERSEGUICAO) m.perseguindo = false;
    // (lote A2, dono 19/10) o bicho FUGINDO (a Chance de Fugir, o Pacifismo — `Acoes.fugir`, 2 s): em vez de perseguir, dá o passo que mais o afasta
    // de você (as casas andáveis em volta dele, sem outro bicho nem você — a exceção (6) do dono, `itens-poe/gemas-a2.mjs`)
    if (Estados.fugindo(m, hunt.clock ?? agora)) {
      if (!pronto(m) || !Estados.podeAgir(m, agora) || imobilizado(m, agora)) continue;
      const perto = bfsDistancias(grade, m, 1);
      // (revisão do A2: as regras do passo normal — sem pisar nos outros jogadores da sala, e a Paralisia no tempo do passo)
      aliadosDaFuga ??= aliadosPorCasa(hunt);
      let destino = null;
      let melhor = d;
      for (const [dx, dy] of VIZINHANCA_8) {
        const v = { x: m.x + dx, y: m.y + dy };
        if (perto.em(v.x, v.y) == null || (v.x === hunt.pos.x && v.y === hunt.pos.y) || aliadosDaFuga.has(`${v.x},${v.y}`) || torres?.has(`${v.x},${v.y}`) || (ocupada ? (ocupada.get(`${v.x},${v.y}`) ?? m) !== m : hunt.monstros.some((o) => o !== m && o.hp > 0 && o.x === v.x && o.y === v.y))) continue;
        const dv = distancia(hunt.pos, v);
        if (dv > melhor) { melhor = dv; destino = v; }
      }
      if (!destino) continue;
      ocupada?.delete(`${m.x},${m.y}`);
      ocupada?.set(`${destino.x},${destino.y}`, m);
      const fx = Math.sign(destino.x - m.x);
      const fy = Math.sign(destino.y - m.y);
      m.x = destino.x;
      m.y = destino.y;
      m.dir = fy < 0 ? 0 : fy > 0 ? 2 : fx > 0 ? 1 : 3;
      m.andouEm = hunt.clock ?? 0;
      m.moveMs = passoDoBicho(m, fx !== 0 && fy !== 0) * (Charms.paralisado(m, agora) ? Charms.FATOR_DA_PARALISIA : 1) * Estados.fatorDeLentidao(m, agora) * Reforcos.fatorDeDesaceleracao(m, agora) * Estados.fatorDeTolhimento(m, agora) * fatorDoPassoAprisionado(m.poeAprisionado) * fatorDoPassoDoUrso(m, agora) * fatorDeAcao(m, agora);
      m.proximoPasso = agora + m.moveMs;
      continue;
    }
    // (lote R3D, 27/10) PROVOCADO pelo Totem Chamariz (`GemasR3D.iscaDoMonstro`): vai até o totem e fica colado nele (bate nele — `cacadas.tiqueDosLacaios`), não em você
    const isca = GemasR3D.iscaDoMonstro(hunt, m, hunt.clock ?? agora);
    if (isca) {
      m.perseguindo = true;
      if (distancia(isca, m) <= 1) { m.dir = Math.abs(isca.x - m.x) > Math.abs(isca.y - m.y) ? (isca.x > m.x ? 1 : 3) : isca.y > m.y ? 2 : isca.y < m.y ? 0 : m.dir; continue; }
      if (!pronto(m) || !Estados.podeAgir(m, agora) || imobilizado(m, agora)) continue;
      const perto = bfsDistancias(grade, m, 1);
      aliadosDaFuga ??= aliadosPorCasa(hunt);
      const vizinhas = VIZINHANCA_8.map(([dx, dy]) => ({ x: m.x + dx, y: m.y + dy })).filter((v) => perto.em(v.x, v.y) != null && !(v.x === hunt.pos.x && v.y === hunt.pos.y) && !aliadosDaFuga.has(`${v.x},${v.y}`) && !torres?.has(`${v.x},${v.y}`) && !(hunt.lacaios ?? []).some((l) => l.hp > 0 && l.x === v.x && l.y === v.y) && (ocupada ? (ocupada.get(`${v.x},${v.y}`) ?? m) === m : !hunt.monstros.some((o) => o !== m && o.hp > 0 && o.x === v.x && o.y === v.y)));
      const destino = GemasR3D.passoAteAIsca(m, isca, vizinhas);
      if (!destino) continue;
      ocupada?.delete(`${m.x},${m.y}`);
      ocupada?.set(`${destino.x},${destino.y}`, m);
      const fx = Math.sign(destino.x - m.x);
      const fy = Math.sign(destino.y - m.y);
      m.x = destino.x;
      m.y = destino.y;
      m.dir = fy < 0 ? 0 : fy > 0 ? 2 : fx > 0 ? 1 : 3;
      m.andouEm = hunt.clock ?? 0;
      m.moveMs = passoDoBicho(m, fx !== 0 && fy !== 0) * (Charms.paralisado(m, agora) ? Charms.FATOR_DA_PARALISIA : 1) * Estados.fatorDeLentidao(m, agora) * Reforcos.fatorDeDesaceleracao(m, agora) * Estados.fatorDeTolhimento(m, agora) * fatorDoPassoAprisionado(m.poeAprisionado) * fatorDoPassoDoUrso(m, agora) * fatorDeAcao(m, agora);
      m.proximoPasso = agora + m.moveMs;
      continue;
    }
    if (d <= 1) {
      // Colado: fica parado, virado para o jogador.
      const ox = hunt.pos.x - m.x;
      const oy = hunt.pos.y - m.y;
      m.dir = Math.abs(ox) > Math.abs(oy) ? (ox > 0 ? 1 : 3) : oy > 0 ? 2 : oy < 0 ? 0 : m.dir;
      continue;
    }
    if (!m.perseguindo || !pronto(m)) continue;
    // Congelado ou atordoado (supports Freeze/Stun): não anda.
    if (!Estados.podeAgir(m, agora) || imobilizado(m, agora)) continue;
    let destino = melhorPasso(m, reto, VIZINHANCA_4);
    if (!destino) {
      comDiagonal ??= bfsDistancias(grade, hunt.pos, ALCANCE_DE_PERSEGUICAO + 4, null, VIZINHANCA_8, torres);
      destino = melhorPasso(m, comDiagonal, VIZINHANCA_8);
    }
    if (!destino) continue;
    const dx = Math.sign(destino.x - m.x);
    const dy = Math.sign(destino.y - m.y);
    // A grade de ocupação anda junto: solta a casa velha, ocupa a nova.
    ocupada.delete(`${m.x},${m.y}`);
    ocupada.set(`${destino.x},${destino.y}`, m);
    m.x = destino.x;
    m.y = destino.y;
    m.dir = dy < 0 ? 0 : dy > 0 ? 2 : dx > 0 ? 1 : 3;
    // (PoE: "em movimento" — o Sangramento dói 200% mais no alvo que anda; no relógio da caçada, o do dano contínuo — `combate/dot.tique`.)
    m.andouEm = hunt.clock ?? 0;
    // Paralisado (charms Cripple e Numb): passo bem mais lento por 10 s.
    // + lento (support Slow): o passo demora mais.
    // + Desacelerado pela maldição do PoE ("Inimigos Amaldiçoados por você são Desacelerados" — `Reforcos.fatorDeDesaceleracao`).
    // (lote C4, dono 21/10: + o Tolhimento do PoE — `Estados.fatorDeTolhimento`, só no passo)
    m.moveMs = passoDoBicho(m, dx !== 0 && dy !== 0) * (Charms.paralisado(m, agora) ? Charms.FATOR_DA_PARALISIA : 1) * Estados.fatorDeLentidao(m, agora) * Reforcos.fatorDeDesaceleracao(m, agora) * Estados.fatorDeTolhimento(m, agora) * fatorDoPassoAprisionado(m.poeAprisionado) * fatorDoPassoDoUrso(m, agora) * fatorDeAcao(m, agora);
    m.proximoPasso = agora + m.moveMs;
  }
}
