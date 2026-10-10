// A PROTEÇÃO do jogador (dono, 10/10: "Animação de Portais e Sistema de Safe Zones" + "Carregamento completo e início da caça"). Duas coisas
// independentes, as duas decididas aqui no SERVIDOR:
//
//   1. As SAFE ZONES — casas do mapa marcadas no editor (`seguras` no arquivo do mapa: `{ "<andar>": [[x, y], ...] }`). Dentro delas o
//      jogador não ataca nem apanha (`imune`, posto a cada tique pela caçada), e nenhum bicho nasce, pisa, atravessa ou persegue para dentro
//      (`gradeDosBichos`: a grade andável SEM as casas seguras, a que os bichos usam para andar, nascer e serem empurrados).
//   2. A PROTEÇÃO DE ENTRADA — ao entrar num mapa (caçada nova, instância nova, sala da party, reconexão), a caçada do jogador fica PARADA
//      (nada anda, ninguém bate) até as DUAS condições: o cliente confirmou que o mapa carregou (`mapaPronto`, validado pela sessão) E passou
//      o tempo mínimo (`minimoMs`). Sem confirmação no prazo (`esperaMaximaMs`), a sessão manda o mapa de novo (até `tentativas`) e, no fim,
//      devolve o jogador à cidade — nunca fica protegido para sempre. Quem guarda o estado é a SESSÃO (`websocket/sessao.mjs`): sai com ela
//      (queda, troca de mapa), e a reconexão começa outra.
//
// Sem imports do jogo de propósito: a caçada, o combate, os poderes e a sessão leem daqui.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const ARQUIVO = join(dirname(fileURLToPath(import.meta.url)), '..', 'gamedata', 'protecao.json');

const PADRAO = Object.freeze({ minimoMs: 3000, esperaMaximaMs: 30000, tentativas: 2, portal: Object.freeze({ abertoMs: 3000, fechamentoMs: 3000 }) });

/** A configuração (`gamedata/protecao.json`), com o padrão no que faltar ou vier errado. */
export function lerConfig(bruto = null) {
  let c = bruto;
  if (!c) {
    try {
      c = existsSync(ARQUIVO) ? JSON.parse(readFileSync(ARQUIVO, 'utf8')) : {};
    } catch {
      c = {};
    }
  }
  const ms = (v, padrao, minimo = 0) => (Number.isFinite(Number(v)) && Number(v) >= minimo ? Math.round(Number(v)) : padrao);
  return Object.freeze({
    minimoMs: ms(c.minimoMs, PADRAO.minimoMs),
    esperaMaximaMs: ms(c.esperaMaximaMs, PADRAO.esperaMaximaMs, 1000),
    tentativas: Math.max(1, Math.min(5, ms(c.tentativas, PADRAO.tentativas, 1))),
    portal: Object.freeze({ abertoMs: ms(c.portal?.abertoMs, PADRAO.portal.abertoMs), fechamentoMs: ms(c.portal?.fechamentoMs, PADRAO.portal.fechamentoMs) }),
  });
}

let CONFIG = lerConfig();
/** A configuração em uso. */
export const config = () => CONFIG;
/** Troca a configuração (os testes: `configurar({ minimoMs: 0 })`); sem argumento, volta à do arquivo. Devolve a de antes. */
export function configurar(parcial = null) {
  const antes = CONFIG;
  CONFIG = parcial ? lerConfig({ ...antes, ...parcial, portal: { ...antes.portal, ...(parcial.portal ?? {}) } }) : lerConfig();
  return antes;
}

/* ================================================================ SAFE ZONES */

/** O máximo de casas seguras num andar (o editor e o servidor recusam acima disto — um mapa inteiro seguro não é uma zona). */
export const MAXIMO_DE_CASAS = 20000;

// As casas seguras de cada mapa, por andar, a partir do objeto `seguras` do arquivo: trocar o objeto (o editor salvou) refaz a conta.
const conjuntosDe = new WeakMap(); // seguras -> Map(z -> Set("x,y"))

/** As casas seguras do andar `z` do mapa (`Set` de "x,y"), ou null se ele não tem nenhuma. */
export function segurasDoMapa(mapa, z) {
  const seguras = mapa?.seguras;
  if (!seguras || typeof seguras !== 'object') return null;
  let porAndar = conjuntosDe.get(seguras);
  if (!porAndar) {
    porAndar = new Map();
    conjuntosDe.set(seguras, porAndar);
  }
  const chave = String(z);
  if (!porAndar.has(chave)) {
    const lista = Array.isArray(seguras[chave]) ? seguras[chave] : [];
    porAndar.set(chave, lista.length ? new Set(lista.map(([x, y]) => `${x},${y}`)) : null);
  }
  return porAndar.get(chave);
}

/** A casa (x, y) do andar da grade (ou do `z` pedido) é segura? */
export function ehSegura(grade, x, y, z = grade?.z) {
  return !!segurasDoMapa(grade?.mapa, z)?.has(`${x},${y}`);
}

/** Algum andar do mapa tem casa segura? */
export const temSeguras = (mapa) => !!mapa?.seguras && Object.values(mapa.seguras).some((l) => Array.isArray(l) && l.length);

/**
 * A grade que os BICHOS usam: a mesma, sem as casas seguras — para andar (a BFS da perseguição), nascer (spawn, respawn, invocação) e ser
 * empurrado. Sem casa segura no andar, a própria grade. Guardada na grade (não-enumerável) e refeita se as casas seguras mudarem.
 */
export function gradeDosBichos(grade) {
  const seguras = segurasDoMapa(grade?.mapa, grade?.z);
  if (!seguras?.size) return grade;
  const guardada = grade.dosBichos;
  if (guardada && guardada.seguras === seguras) return guardada.grade;
  const andavel = new Set();
  for (const k of grade.andavel) if (!seguras.has(k)) andavel.add(k);
  const dosBichos = { ...grade, andavel };
  // (A grade numérica e os andares são da grade de origem: a dos bichos faz os dela.)
  delete dosBichos.numerica;
  delete dosBichos.andares;
  Object.defineProperty(grade, 'dosBichos', { value: { seguras, grade: dosBichos }, enumerable: false, writable: true, configurable: true });
  return dosBichos;
}

/**
 * Valida as casas seguras que o editor mandou para um mapa (`{ "<z>": [[x, y], ...] }`): inteiros dentro do mapa, sem repetição, até
 * `MAXIMO_DE_CASAS` por andar. Devolve `{ ok, seguras }` (o objeto limpo, sem andar vazio — `null` se nenhum) ou `{ ok: false, erro }`.
 */
export function validarSeguras(entrada, mapa) {
  if (entrada == null) return { ok: true, seguras: null };
  if (typeof entrada !== 'object' || Array.isArray(entrada)) return { ok: false, erro: 'Safe Zones: o formato é { "andar": [[x, y], ...] }.' };
  const largura = Number(mapa?.width) || 0;
  const altura = Number(mapa?.height) || 0;
  const limpo = {};
  for (const [z, lista] of Object.entries(entrada)) {
    if (!/^-?\d+$/.test(z)) return { ok: false, erro: `Safe Zones: andar inválido (${z}).` };
    if (!Array.isArray(lista)) return { ok: false, erro: `Safe Zones: o andar ${z} não é uma lista de casas.` };
    if (lista.length > MAXIMO_DE_CASAS) return { ok: false, erro: `Safe Zones: no máximo ${MAXIMO_DE_CASAS} casas por andar.` };
    const vistas = new Set();
    const casas = [];
    for (const c of lista) {
      const [x, y] = Array.isArray(c) ? c : [];
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || (largura && x >= largura) || (altura && y >= altura)) {
        return { ok: false, erro: `Safe Zones: casa fora do mapa no andar ${z} (${JSON.stringify(c)}).` };
      }
      const k = `${x},${y}`;
      if (vistas.has(k)) continue;
      vistas.add(k);
      casas.push([x, y]);
    }
    if (casas.length) limpo[z] = casas.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  }
  return { ok: true, seguras: Object.keys(limpo).length ? limpo : null };
}

/** A casa andável PARA BICHO mais perto de `p` (fora das seguras e de `ocupada`), até `raio` casas; null se não há. */
export function casaForaDaZona(gradeBichos, p, ocupada = () => false, raio = 12) {
  for (let r = 1; r <= raio; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const c = { x: p.x + dx, y: p.y + dy };
        if (gradeBichos.andavel.has(`${c.x},${c.y}`) && !ocupada(c)) return c;
      }
    }
  }
  return null;
}

/**
 * Os bichos VIVOS que estão numa casa segura (o mapa carregou com eles lá, a configuração mudou, um empurrão de fora): vão para a casa
 * livre mais perto fora da zona; sem nenhuma por perto, saem da caçada (não morrem: sem loot nem exp). Devolve quantos mexeu.
 * `ocupadaPorGente(c)`: a casa de um jogador (o dono e a party). Roda a cada tique do dono da sala — com o mapa sem zona, não custa nada.
 */
export function tirarBichosDaZona(hunt, grade, ocupadaPorGente = () => false) {
  const seguras = segurasDoMapa(grade?.mapa, grade?.z);
  if (!seguras?.size || !hunt?.monstros?.length) return 0;
  const dosBichos = gradeDosBichos(grade);
  let mexidos = 0;
  for (let i = hunt.monstros.length - 1; i >= 0; i--) {
    const m = hunt.monstros[i];
    if (m.hp <= 0 || m.dummy || !seguras.has(`${m.x},${m.y}`)) continue;
    const ocupada = (c) => ocupadaPorGente(c) || hunt.monstros.some((o) => o !== m && o.hp > 0 && o.x === c.x && o.y === c.y);
    const casa = casaForaDaZona(dosBichos, m, ocupada);
    if (casa) {
      m.x = casa.x;
      m.y = casa.y;
      m.perseguindo = false;
    } else hunt.monstros.splice(i, 1);
    mexidos++;
  }
  return mexidos;
}

/* ================================================================ IMUNIDADE NO TIQUE */

/**
 * O jogador está IMUNE neste tique (numa casa segura)? A caçada põe no começo do combate (`marcarImune`); o combate, os poderes e as
 * mecânicas leem (`imune`). Não-enumerável, como o `guia`/`partilha` da party: não vai para o banco nem para o worker do tique.
 */
export function marcarImune(hunt, sim) {
  if (!hunt) return;
  Object.defineProperty(hunt, 'imune', { value: !!sim, enumerable: false, writable: true, configurable: true });
}
export const imune = (hunt) => !!hunt?.imune;

/* ================================================================ PROTEÇÃO DE ENTRADA */

let contador = 0;
/** Um id novo de ENTRADA num mapa (vai na caçada: a sessão sabe que ela é outra e o cliente confirma o carregamento dela). */
export function novaEntrada(agora = Date.now()) {
  contador = (contador + 1) % 1e6;
  return `${agora.toString(36)}-${contador.toString(36)}-${Math.floor(Math.random() * 1296).toString(36)}`;
}

/**
 * O estado da proteção de uma entrada (da SESSÃO): começa agora, sem confirmação, com o prazo da primeira tentativa.
 * `{ entrada, desde, confirmadoEm, mapaEnviado, tentativa, prazo }`.
 */
export function iniciar(entrada, agora = Date.now(), c = CONFIG) {
  return { entrada, desde: agora, confirmadoEm: null, mapaEnviado: false, tentativa: 1, prazo: agora + c.esperaMaximaMs };
}

/**
 * O cliente disse que carregou o mapa da entrada `entrada`. Só vale para a entrada de agora e depois de o mapa dela ter ido para ESTE
 * cliente (`mapaEnviado`, marcado pela sessão quando o quadro com o mapa sai). Devolve se aceitou.
 */
export function confirmar(p, entrada, agora = Date.now()) {
  if (!p || p.confirmadoEm != null || typeof entrada !== 'string' || entrada !== p.entrada || !p.mapaEnviado) return false;
  p.confirmadoEm = agora;
  return true;
}

/** As duas condições: confirmado E o tempo mínimo passou. */
export const liberada = (p, agora = Date.now(), c = CONFIG) => !!p && p.confirmadoEm != null && agora - p.desde >= c.minimoMs;

/**
 * O prazo passou sem confirmação? `'reenviar'` (há outra tentativa: o prazo é renovado aqui), `'desistir'` (acabaram — a sessão tira o
 * jogador do mapa) ou null (ainda no prazo, ou já confirmado).
 */
export function vencimento(p, agora = Date.now(), c = CONFIG) {
  if (!p || p.confirmadoEm != null || agora < p.prazo) return null;
  if (p.tentativa < c.tentativas) {
    p.tentativa++;
    p.prazo = agora + c.esperaMaximaMs;
    p.mapaEnviado = false;
    return 'reenviar';
  }
  return 'desistir';
}

/** Quanto falta do tempo mínimo (ms) — o cliente mostra junto da cortina. */
export const faltaDoMinimo = (p, agora = Date.now(), c = CONFIG) => (p ? Math.max(0, c.minimoMs - (agora - p.desde)) : 0);
