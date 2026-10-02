// A INSTÂNCIA da hunt: cada entrada cria uma nova; os bichos dela nascem nos
// SPAWNS DO MAPA (ver `mapa/spawns.mjs`); sem respawn; a hunt fica CLEAR em
// 100% de limpeza. Configuração em `gamedata/instancias.json`.
//
// O dono: "Mapa → define posições dos spawns → Hunt Instance → cria mobs
// nesses spawns → jogador limpa o mapa → % de mapa limpo → 100% → Hunt Clear."
//
// A instância mora na própria caçada (`hunt.instancia`, na do DONO da sala —
// os convidados da party leem por `salaDe`), e os bichos dela são
// `hunt.monstros` + `hunt.outrosAndares`: nada de um segundo sistema de bichos.
//
//   hunt.instancia = {
//     id, huntId, criadaEm, limpaEm, status: 'ativa' | 'limpa',
//     objetivos: { total },   // a soma dos pesos dos objetivos de limpeza
//   }
//
// ---- Objetivos de limpeza ----
// Cada bicho gerado é um objetivo (`m.objetivo` = o peso dele, hoje 1) e leva
// o id da instância (`m.instancia`). Concluído = morto (o bicho sai da lista).
// `progresso` = (total − peso dos vivos) / total. Um objetivo que não é bicho
// (baú, alavanca, evento) entra depois como mais um item com peso, sem mudar a
// conta — por isso a instância guarda o TOTAL dos pesos, não "quantos bichos".
import * as Raridade from '../mobs/raridade.mjs';
import { readFileSync } from 'node:fs';
import { andarDaGrade, destinoDaMudanca } from './andares.mjs';
import { VIZINHANCA_8, distancia, bfsDistancias } from './caminho.mjs';
import { criarMonstro } from './monstros.mjs';
import { salaDe } from './sala.mjs';
import { sortearCriatura } from '../mapa/spawns.mjs';
import * as Encontros from '../encontros/estado.mjs';

export const CONFIG = JSON.parse(readFileSync(new URL('../../gamedata/instancias.json', import.meta.url), 'utf8'));

let sequencia = 0;
const novoId = () => `${Date.now().toString(36)}-${(sequencia++).toString(36)}`;

/** Os andares por onde a rota passa (o da entrada sempre). */
export const andaresDaRota = (grade) => [...new Set([grade.z, ...(grade.percurso ?? []).map((p) => p.z ?? grade.z)])];

/*
 * As casas ALCANÇÁVEIS de cada andar: tudo que se anda a partir da entrada,
 * passando de andar pelas escadas e rampas do mapa e pelas trocas de andar da
 * rota (o ponto antes da troca é a escada; o seguinte, onde se chega) — só
 * nos andares por onde a rota passa. Um bicho
 * só nasce numa delas — senão a instância teria um objetivo que ninguém
 * alcança e nunca ficaria limpa (Feru Way: a rota gravada pula entre pedaços
 * do andar 13 que não se ligam; os bichos dos pedaços soltos ficavam para
 * sempre). Guardadas na grade (não enumerável): o mapa não muda.
 */
export function casasAlcancaveis(grade, inicio = null) {
  if (grade.alcancaveis) return grade.alcancaveis;
  const saida = new Map();
  const partida = inicio ?? grade.percurso?.[0] ?? grade.inicioReal;
  if (!partida) {
    Object.defineProperty(grade, 'alcancaveis', { value: saida, enumerable: false });
    return saida;
  }
  const zDe = (p) => p.z ?? grade.z;
  const andares = new Set(andaresDaRota(grade));
  const fila = [];
  const semear = (z, c) => {
    if (!andares.has(z)) return;
    const g = andarDaGrade(grade, z);
    const k = `${c.x},${c.y}`;
    if (!g.andavel.has(k)) return;
    if (!saida.has(z)) saida.set(z, new Set());
    const vistas = saida.get(z);
    if (vistas.has(k)) return;
    vistas.add(k);
    fila.push({ z, x: c.x, y: c.y });
  };
  const rota = grade.percurso ?? [];
  // Na rota, o ponto ANTES de uma troca de andar é a escada; o seguinte, a chegada.
  const chegadas = new Map();
  for (let i = 0; i < rota.length; i++) {
    const a = rota[i];
    const b = rota[(i + 1) % rota.length];
    if (zDe(a) === zDe(b)) continue;
    const k = `${a.x},${a.y},${zDe(a)}`;
    if (!chegadas.has(k)) chegadas.set(k, []);
    chegadas.get(k).push(b);
  }
  semear(zDe(partida), partida);
  while (fila.length) {
    {
      const c = fila.pop();
      const g = andarDaGrade(grade, c.z);
      const vistas = saida.get(c.z);
      for (const [dx, dy] of [[0, 0], ...VIZINHANCA_8]) {
        const x = c.x + dx;
        const y = c.y + dy;
        const k = `${x},${y}`;
        if ((dx || dy) && g.andavel.has(k) && !vistas.has(k)) {
          vistas.add(k);
          fila.push({ z: c.z, x, y });
        }
        // A escada/rampa do mapa (a casa dela nem sempre é "andável"): pisar leva ao outro andar.
        const outro = grade.mapa?.floors && destinoDaMudanca(grade.mapa, c.z, x, y);
        if (outro) semear(outro.z, casaAndavelPerto(grade, outro));
        // A escada de uma troca de andar da rota.
        for (const b of chegadas.get(`${x},${y},${c.z}`) ?? []) semear(zDe(b), casaAndavelPerto(grade, b));
      }
    }
  }
  Object.defineProperty(grade, 'alcancaveis', { value: saida, enumerable: false });
  return saida;
}

/** A casa andável mais perto de `c` no andar dele (a chegada de escada às vezes cai na borda). */
function casaAndavelPerto(grade, c) {
  const g = andarDaGrade(grade, c.z ?? grade.z);
  if (g.andavel.has(`${c.x},${c.y}`)) return c;
  for (let r = 1; r <= 2; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (g.andavel.has(`${c.x + dx},${c.y + dy}`)) return { x: c.x + dx, y: c.y + dy, z: c.z };
  return c;
}

/*
 * A casa do bicho: a livre mais perto do ponto, anel por anel, até o `raio`
 * do spawn, andável e alcançável. `null`: o spawn não tem casa (ponto numa
 * parede, raio todo ocupado) — aquele bicho não nasce nesta instância.
 */
function casaNoSpawn(g, alcancaveis, s, ocupada) {
  for (let r = 0; r <= s.raio; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const k = `${s.x + dx},${s.y + dy}`;
        if (!g.andavel.has(k) || ocupada.has(`${k},${s.z}`)) continue;
        if (alcancaveis && !alcancaveis.has(k)) continue;
        return { x: s.x + dx, y: s.y + dy };
      }
    }
  }
  return null;
}

/**
 * Os bichos de uma instância, nos spawns do mapa: cada spawn gera a sua
 * `quantidade`, cada um de uma criatura sorteada pelos pesos, numa casa até o
 * `raio` do ponto. Devolve `[{ z, m }]` (o bicho e o andar dele), como o
 * `entrar` monta. Nenhuma casa é inventada fora dos spawns.
 */
export function comporBichos({ grade, spawns, dadosDaHunt, inicio, escala, aplicarEscala, instanciaId, rng = Math.random }) {
  const alcancaveis = casasAlcancaveis(grade, inicio);
  const ocupada = new Set();
  // A casa de onde o personagem sai fica livre.
  if (inicio) ocupada.add(`${inicio.x},${inicio.y},${inicio.z ?? grade.z}`);
  const todos = [];
  for (const s of spawns) {
    const casas = alcancaveis.get(s.z);
    if (!casas) continue; // andar por onde a rota não passa: ninguém chega lá
    const g = andarDaGrade(grade, s.z);
    for (let i = 0; i < s.quantidade; i++) {
      const casa = casaNoSpawn(g, casas, s, ocupada);
      if (!casa) break;
      ocupada.add(`${casa.x},${casa.y},${s.z}`);
      const m = aplicarEscala(criarMonstro({ key: sortearCriatura(s, rng), x: casa.x, y: casa.y, z: s.z }, dadosDaHunt), escala);
      if (!m) continue;
      // Sem respawn: o bicho não guarda de onde renascer.
      delete m.spawn;
      m.spawnId = s.id;
      m.tipo = s.tipo;
      // A raridade e os modificadores do spawn (vida, dano, exp, loot, resistência... — ver `mobs/raridade.mjs`).
      Raridade.aplicar(m, Raridade.doSpawn(s));
      m.instancia = instanciaId;
      m.objetivo = 1;
      todos.push({ z: s.z, m });
    }
  }
  return todos;
}

/** Uma instância nova (o registro; os bichos vêm de `comporBichos` com o mesmo `id`). */
export const novoRegistro = (huntId, id = novoId()) => ({ id, huntId, criadaEm: Date.now(), limpaEm: null, status: 'ativa', objetivos: { total: 0 } });
export const gerarId = novoId;

/** A instância da sala (a do dono, para quem é convidado da party). */
export const daSala = (hunt) => salaDe(hunt)?.instancia ?? null;

/** Todos os bichos da sala, em TODOS os andares. */
function bichosDaSala(hunt) {
  const sala = salaDe(hunt);
  if (!sala) return [];
  return [...sala.monstros, ...Object.values(sala.outrosAndares ?? {}).flat()];
}

/** O peso dos objetivos ainda não concluídos (bichos da instância vivos). */
export function pendentes(hunt) {
  const inst = daSala(hunt);
  let n = 0;
  // `opcional`: um boss de encontro opcional (e seus lacaios) não conta para o CLEAR — só o encontro em andamento o segura.
  for (const m of bichosDaSala(hunt)) if (m.hp > 0 && m.instancia === inst?.id && !m.opcional) n += m.objetivo ?? 1;
  return n;
}

/** `{ total, concluidos, percentual }` da limpeza da instância (percentual 0–100). */
export function progresso(hunt) {
  const inst = daSala(hunt);
  const total = inst?.objetivos?.total ?? 0;
  if (!total) return { total: 0, concluidos: 0, percentual: 100 };
  const concluidos = Math.max(0, total - pendentes(hunt));
  return { total, concluidos, percentual: Math.floor((100 * concluidos) / total) };
}

/** Acabou de limpar (100%)? Marca `limpa` (uma vez) e devolve `true` só nessa vez. `agora` = relógio da caçada. */
export function marcarSeLimpou(hunt, agora) {
  const inst = hunt?.instancia;
  if (!inst || inst.status !== 'ativa') return false;
  const bichosLimpos = pendentes(hunt) === 0;
  // Os encontros acompanham a limpeza (libera os que esperam os bichos, expira os opcionais, o idle resolve o que pode).
  Encontros.avaliar(inst, { monstrosLimpos: bichosLimpos, agora, hunt });
  // CLEAR = bichos mortos E encontros OBRIGATÓRIOS concluídos. Opcional nunca trava.
  // Um encontro EM ANDAMENTO (ativo) também segura o CLEAR: a instância não some no meio de uma luta de boss.
  if (!bichosLimpos || Encontros.obrigatoriosPendentes(inst) > 0 || Encontros.emAndamento(inst) > 0) return false;
  inst.status = 'limpa';
  inst.limpaEm = Date.now();
  inst.limpaNoRelogio = agora;
  return true;
}

/** Limpa há mais de `pausaDoClearMs` (o "Hunt Clear!" na tela): hora de criar a próxima. */
export const horaDaProxima = (hunt, agora) =>
  hunt?.instancia?.status === 'limpa' && agora - (hunt.instancia.limpaNoRelogio ?? agora) >= (CONFIG.pausaDoClearMs ?? 0);

/*
 * O bicho da instância a ir buscar quando nada está à vista: o vivo mais perto
 * A PÉ no andar atual (e que não se mostrou sem caminho há pouco). `null`: não
 * há nenhum alcançável aqui — o laço da rota leva a outro andar.
 */
export function bichoMaisPerto(hunt, grade) {
  const inst = daSala(hunt);
  const vivos = hunt.monstros.filter((m) => m.hp > 0 && m.instancia === inst?.id && (m.semCaminhoAte ?? 0) <= (hunt.clock ?? 0));
  if (!vivos.length) return null;
  const dist = bfsDistancias(grade, hunt.pos);
  let melhor = null;
  let d = Infinity;
  for (const m of vivos) {
    // A casa do bicho está ocupada por ele: a distância é a da vizinha mais perto.
    let dm = dist.em(m.x, m.y);
    if (dm == null) {
      for (const [dx, dy] of VIZINHANCA_8) {
        const v = dist.em(m.x + dx, m.y + dy);
        if (v != null && (dm == null || v + 1 < dm)) dm = v + 1;
      }
    }
    if (dm != null && dm < d) {
      d = dm;
      melhor = m;
    }
  }
  return melhor;
}

/**
 * Tira `n` objetivos vivos ao acaso (a caçada offline projetada: o que se
 * matou fora, sem simular tique a tique). Devolve quantos tirou.
 */
export function tirarAoAcaso(hunt, n, rng = Math.random) {
  const inst = hunt.instancia;
  const listas = [hunt.monstros, ...Object.values(hunt.outrosAndares ?? {})];
  let tirados = 0;
  while (tirados < n) {
    const vivos = [];
    for (const l of listas) for (let i = 0; i < l.length; i++) if (l[i].hp > 0 && l[i].instancia === inst?.id) vivos.push([l, i]);
    if (!vivos.length) break;
    const [l, i] = vivos[Math.floor(rng() * vivos.length)];
    l.splice(i, 1);
    tirados++;
  }
  return tirados;
}

/** Para a tela: `{ id, status, total, concluidos, percentual }` (ou `null` fora de instância). */
export function paraCliente(hunt) {
  const inst = daSala(hunt);
  if (!inst) return null;
  return { id: inst.id, status: inst.status, ...progresso(hunt) };
}
