// OS PROJÉTEIS NO AR (lote "projetil", dono 02/11 — o voo de verdade; as contas em `itens-poe/projeteis-voo.mjs`). Cada projétil lançado anda pelo caminho dele
// na velocidade dele, um trecho por tique: a cada casa nova, bate no terreno (para) ou no primeiro que está ali (o contato); passado o alcance, se perde. O
// golpe sai NO CONTATO, pelo caminho de sempre de quem lançou (o `aoContato` — o seu uso inteiro, o golpe do lacaio, a magia do monstro), com a posição de
// agora de todos: quem saiu da frente não é acertado, quem entrou no caminho é.
//
// Além do voo com passos, os golpes ADIADOS (`adiar`): os saltos que o resolvedor do uso já mediu (a perfuração, o ricochete, a difusão, a divisão e a volta)
// caem no instante em que o projétil chega neles (o tempo do caminho até ali).
//
// O ESTADO: fica FORA do estado salvo da caçada (um `WeakMap` pela caçada, como as instâncias prontas de `cacadas.mjs`) — o que está no ar guarda o que o
// golpe precisa (a conta do uso, os alvos) e não vai para o banco. Recarregar a caçada no meio de um voo (o servidor que reinicia) perde só os projéteis que
// estavam no ar (no máximo um alcance de voo). Os TETOS: `VOO.maxVivos` projéteis no ar e `VOO.maxAdiados` golpes à espera por caçada — passou, o novo cai na
// hora (o voo de antes); cada projétil anda no máximo `VOO.maxCasasPorTique` casas por tique. A troca de instância (outra lista de bichos) e a de andar
// esquecem o que estava no ar.
import { VOO, caminho, pontoEm, distanciaNoTempo, tempoAte } from '../itens-poe/projeteis-voo.mjs';
import { ler as lerDoAmbiente } from '../ambiente-fixo.mjs';

const REGISTRO = new WeakMap();
const doHunt = (hunt) => {
  let r = REGISTRO.get(hunt);
  if (!r) REGISTRO.set(hunt, (r = { voos: [], adiados: [], imediatos: [], n: 0 }));
  return r;
};
/**
 * O MODO INSTANTÂNEO (só para conferir — `VOO_INSTANTANEO=1` no ambiente; nunca no jogo): o projétil anda o caminho todo na hora e os golpes adiados também caem
 * já, mas pelo MESMO caminho do golpe que chega depois (`descarregar`, no fim do uso de fora — `Acoes.dispararSemMarcar` — e no tique). Serve para separar, nos
 * testes antigos, o que mudou só de TEMPO (passa neste modo) do que mudou de geometria (o leque, a difusão, o terreno, quem entrou na frente).
 */
export const instantaneo = () => lerDoAmbiente('VOO_INSTANTANEO') === '1';
/** (só para conferir, com o instantâneo: `VOO_GEOMETRIA_ANTIGA=1` — sem o leque, sem os ângulos da difusão e sem o que entra na frente: o que sobra de diferente é outra coisa) */
export const geometriaAntiga = () => lerDoAmbiente('VOO_GEOMETRIA_ANTIGA') === '1';
/** (só para conferir: `VOO_REGISTRO=1` escreve cada projétil que fica no ar e cada golpe adiado — a conta do tempo de cada teste) */
const registrar = () => lerDoAmbiente('VOO_REGISTRO') === '1';
const chave = (c) => `${c.x},${c.y}`;

/** Quantos projéteis estão no ar e quantos golpes esperam (os testes e o desempenho). */
export function contar(hunt) {
  const r = hunt ? REGISTRO.get(hunt) : null;
  return { voando: r?.voos.length ?? 0, adiados: r?.adiados.length ?? 0 };
}
/** Esquece tudo o que estava no ar (a caçada acabou, a instância trocou). */
export function limpar(hunt) {
  if (hunt) REGISTRO.delete(hunt);
}

/**
 * Anda o voo `v` até o instante `ateMs` (o relógio da caçada) — ou até o fim do caminho (`semTempo`). Devolve o que aconteceu: `{ tipo: 'contato', alvo, casa }`,
 * `{ tipo: 'parede', casa }` (a última casa livre antes do terreno), `{ tipo: 'fim', casa }` ou null (segue no ar).
 */
function avancar(v, ateMs, semTempo = false) {
  const c = v.caminho;
  const ops = { alcance: v.alcance, volta: null, fator: v.fator };
  const max = Math.min(c.comprimento, v.s + VOO.maxCasasPorTique);
  const sAlvo = semTempo ? c.comprimento : distanciaNoTempo(ateMs - v.sai, v.v0, v.perfil, ops, { s0: v.s, t0: v.t, max });
  const passo = 0.25;
  let s = v.s;
  let ultimaLivre = v.ultimaLivre;
  while (s < sAlvo - 1e-9) {
    s = Math.min(sAlvo, s + passo);
    const p = pontoEm(c, s);
    const casa = { x: Math.round(p.x), y: Math.round(p.y) };
    const k = chave(casa);
    if (k === v.origem || v.vistas.has(k)) continue;
    v.vistas.add(k);
    if (v.parede?.(casa)) { v.s = s; return { tipo: 'parede', casa: ultimaLivre ?? { x: Math.round(v.de.x), y: Math.round(v.de.y) } }; }
    ultimaLivre = casa;
    // (06/11, O Inexperiente: "Projéteis não podem colidir com Inimigos em Curto Alcance" — até 1 casa de onde o seu projétil saiu, ele passa)
    if (v.semCurto && Math.max(Math.abs(casa.x - v.de.x), Math.abs(casa.y - v.de.y)) <= 1) continue;
    const alvo = v.colide(casa);
    if (alvo) { v.s = s; v.t = tempoAte(s, v.v0, v.perfil, ops); return { tipo: 'contato', alvo, casa }; }
  }
  v.s = s;
  v.ultimaLivre = ultimaLivre;
  v.t = semTempo ? tempoAte(s, v.v0, v.perfil, ops) : Math.max(v.t, Math.min(ateMs - v.sai, tempoAte(s, v.v0, v.perfil, ops)));
  if (s >= c.comprimento - 1e-9) return { tipo: 'fim', casa: ultimaLivre ?? { x: Math.round(v.de.x), y: Math.round(v.de.y) } };
  return null;
}

function resolver(v, r, adiado) {
  if (!r) return [];
  if (r.tipo === 'contato') return v.aoContato?.(r.alvo, r.casa, { adiado, ms: v.t }) ?? [];
  return v.aoFim?.(r.casa, { adiado, parede: r.tipo === 'parede', ms: v.t }) ?? [];
}

/**
 * LANÇA um projétil: `{ de, para | angulo, z, alcance, v0 (casas/s), perfil, agora, colide(casa) → alvo | null, parede(casa) → true no terreno, aoContato(alvo,
 * casa, { adiado, ms }) → eventos, aoFim(casa, { adiado, parede, ms }) → eventos }`. Ele anda já o que anda até meio tique depois de `agora` (`VOO.meioTiqueMs` —
 * o golpe cai no tique mais perto); o que encontra aí sai NA HORA (`adiado` false: o chamador segue no mesmo passo). Devolve `{ eventos, noAr, ms }` — `ms`: o
 * tempo do voo até `para` (o desenho na tela).
 */
export function lancar(hunt, opcoes) {
  const { de, para = null, angulo = null, z = 0, alcance = 7, v0, perfil = null, agora = hunt?.clock ?? 0, colide, parede = null, aoContato, aoFim = null, fator = 1 } = opcoes;
  const destino = para ?? { x: de.x + Math.cos(angulo ?? 0), y: de.y + Math.sin(angulo ?? 0) };
  const c = caminho(de, destino, { alcance, perfil, angulo: para ? null : angulo });
  // (06/11, O Inexperiente: o SEU projétil — o que sai da sua casa — não colide em Curto Alcance; `hunt.poeProjeteisSemCurto`, da sua ficha)
  const semCurto = !!hunt?.poeProjeteisSemCurto && !!hunt.pos && Math.round(de.x) === hunt.pos.x && Math.round(de.y) === hunt.pos.y;
  const v = { de, z, alcance, v0, perfil, fator, caminho: c, sai: agora, s: 0, t: 0, vistas: new Set(), origem: chave({ x: Math.round(de.x), y: Math.round(de.y) }), colide, parede, aoContato, aoFim, inst: hunt?.instancia ?? null, ultimaLivre: null, ...(semCurto ? { semCurto: true } : {}) };
  const ms = para ? Math.round(tempoAte(Math.hypot(para.x - de.x, para.y - de.y) * (c.avanco > 0 ? c.comprimento / c.avanco : 1), v0, perfil, { alcance, fator })) : 0;
  const r = hunt ? doHunt(hunt) : null;
  // (o teto de projéteis no ar: o que passa dele anda o caminho todo agora — o voo de antes)
  const cheio = !r || r.voos.length >= VOO.maxVivos;
  // (o que nasce DENTRO de alguém — a Runa do vinculado, a Armadilha com o bicho em cima — o acerta primeiro: a casa de onde sai também conta)
  const casaDaOrigem = { x: Math.round(de.x), y: Math.round(de.y) };
  const naOrigem = semCurto ? null : v.colide(casaDaOrigem);
  if (r && instantaneo()) {
    const res = naOrigem ? { tipo: 'contato', alvo: naOrigem, casa: casaDaOrigem } : avancar(v, Infinity, true);
    r.imediatos.push(() => resolver(v, res, true));
    return { eventos: [], noAr: true, ms };
  }
  if (naOrigem) return { eventos: resolver(v, { tipo: 'contato', alvo: naOrigem, casa: casaDaOrigem }, false), noAr: false, ms };
  const ja = avancar(v, agora + VOO.meioTiqueMs, cheio);
  if (ja || cheio) return { eventos: resolver(v, ja, false), noAr: false, ms };
  v.id = ++r.n;
  r.voos.push(v);
  if (registrar()) console.log(`[voo] no ar: ${v0.toFixed(2)} casas/s, ${Math.hypot((para ?? destino).x - de.x, (para ?? destino).y - de.y).toFixed(2)} casas até o alvo (${ms} ms até o centro dele)`);
  return { eventos: [], noAr: true, ms };
}

/**
 * (03/11, rodada 2 do voo de verdade) ONDE o voo pararia se todos ficassem onde estão agora (as mesmas opções de `lancar`, sem lançar nada): `{ tipo: 'contato', alvo,
 * casa }`, `{ tipo: 'parede', casa }` ou `{ tipo: 'fim', casa }`. O uso reserva o bicho do caminho do principal que ainda voa: os projéteis a mais escolhem outro (D7b).
 */
export function previsto(opcoes) {
  const { de, para = null, angulo = null, alcance = 7, v0, perfil = null, colide, parede = null, fator = 1 } = opcoes;
  const destino = para ?? { x: de.x + Math.cos(angulo ?? 0), y: de.y + Math.sin(angulo ?? 0) };
  const c = caminho(de, destino, { alcance, perfil, angulo: para ? null : angulo });
  const v = { de, alcance, v0, perfil, fator, caminho: c, sai: 0, s: 0, t: 0, vistas: new Set(), origem: chave({ x: Math.round(de.x), y: Math.round(de.y) }), colide, parede, ultimaLivre: null };
  const casaDaOrigem = { x: Math.round(de.x), y: Math.round(de.y) };
  const naOrigem = colide(casaDaOrigem);
  if (naOrigem) return { tipo: 'contato', alvo: naOrigem, casa: casaDaOrigem };
  // (o caminho todo de uma vez: `avancar` sem o teto de casas por tique)
  let r = null;
  for (let n = 0; !r && n < 1000; n++) r = avancar(v, Infinity, true);
  return r;
}

/** ADIA um golpe para o instante `quando` (o relógio da caçada): `fn()` → eventos. Passado o teto, sai na hora. Devolve se ficou à espera. */
export function adiar(hunt, quando, fn, agora = hunt?.clock ?? 0) {
  const r = hunt ? doHunt(hunt) : null;
  if (r && instantaneo()) { r.imediatos.push(fn); return true; }
  if (!r || quando <= agora + VOO.meioTiqueMs || r.adiados.length >= VOO.maxAdiados) return false;
  r.adiados.push({ quando, fn, inst: hunt.instancia ?? null, z: hunt.z ?? 0 });
  if (registrar()) console.log(`[voo] golpe adiado: chega em ${Math.round(quando - agora)} ms`);
  return true;
}

/** (o modo instantâneo) Os golpes guardados para cair já, pelo caminho do golpe que chega depois (os que eles soltam também). */
export function descarregar(hunt) {
  const r = hunt ? REGISTRO.get(hunt) : null;
  const eventos = [];
  for (let n = 0; r?.imediatos.length && n < 10_000; n++) for (const ev of r.imediatos.shift()() ?? []) { if (ev && typeof ev === 'object') ev.voou = 1; eventos.push(ev); }
  return eventos;
}

/** O TIQUE do que está no ar (o relógio da caçada `agora`): os voos andam; os contatos e os golpes adiados que chegaram saem. Devolve os eventos. */
export function tique(hunt, agora = hunt?.clock ?? 0) {
  const r = hunt ? REGISTRO.get(hunt) : null;
  if (r?.imediatos.length) return descarregar(hunt);
  if (!r || (!r.voos.length && !r.adiados.length)) return [];
  const eventos = [];
  const marcar = (evs) => { for (const ev of evs ?? []) { if (ev && typeof ev === 'object') ev.voou = 1; eventos.push(ev); } };
  const inst = hunt.instancia ?? null;
  const ate = agora + VOO.meioTiqueMs;
  // os voos (na ordem em que saíram)
  const voos = r.voos;
  r.voos = [];
  const seguem = [];
  const z = hunt.z ?? 0;
  for (const v of voos) {
    // (o de outra instância ou de outro andar some)
    if (v.inst !== inst || (v.z ?? 0) !== z) continue;
    const res = avancar(v, ate);
    if (!res) { seguem.push(v); continue; }
    marcar(resolver(v, res, true));
  }
  // (os lançados por um contato deste tique já estão em `r.voos`)
  r.voos = seguem.concat(r.voos);
  // os golpes adiados que chegaram (na ordem do instante)
  if (r.adiados.length) {
    const prontos = r.adiados.filter((a) => a.quando <= ate).sort((a, b) => a.quando - b.quando);
    if (prontos.length) {
      r.adiados = r.adiados.filter((a) => a.quando > ate);
      for (const a of prontos) if (a.inst === inst && a.z === z) marcar(a.fn());
    }
  }
  return eventos;
}
