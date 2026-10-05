// O DANO AO LONGO DO TEMPO (dono, 02/10): queimadura, veneno, sangramento e as outras fontes periódicas, num sistema só.
//
// Config em `gamedata/combate/dot.json`. Cada efeito mora no bicho (`m.dots`, lista de objetos simples: grava e volta com a caçada) com
// identificador único, tipo, elemento, o que falta pagar (`falta`), o dano por pulso, o instante em que acaba (relógio da caçada), o
// próximo pulso e a origem. Regras (por tipo): ver `acumulacao` em `dot.json`. O pulso passa pela resistência do bicho ao elemento; não
// rola crítico, não testa acerto nem bloqueio, e a penetração do atacante não vale (ela é dos golpes).
import { readFileSync } from 'node:fs';
import { resistido } from '../hunt/resistencia.mjs';
import * as R from '../regras.mjs';
import { registrarGolpe } from './registro.mjs';

export const CONFIG = JSON.parse(readFileSync(new URL('../../gamedata/combate/dot.json', import.meta.url), 'utf8'));

let proximoId = 1;
const ativo = (d, agora) => d.falta > 0 && d.ate + (CONFIG.tipos[d.tipo]?.pulsoMs ?? 1000) > agora;

/** O tipo de dano contínuo de uma gema (`overTime.type` do catálogo), ou null. */
export const tipoDaFonte = (fonte) => CONFIG.fontes[fonte] ?? null;

/** Os efeitos do bicho de um tipo (lista, na ordem em que entraram). */
export const dosDoTipo = (m, tipo) => (m?.dots ?? []).filter((d) => d.tipo === tipo);

/** O que ainda falta pagar de um tipo neste bicho (soma das pilhas). */
export const restante = (m, tipo) => dosDoTipo(m, tipo).reduce((n, d) => n + d.falta, 0);

/**
 * Põe um efeito no bicho. `total`: o dano que o efeito paga ao todo (antes da resistência); `origem`: `{ fonte, habilidade?, atacante? }`.
 * Devolve o nome do ESTADO posto (`'queimando'`, `'envenenado'`...) ou null se não entrou (mais fraco que o que já vale, sem dano...).
 */
export function aplicar(bicho, { tipo, total, origem = null, duracaoMs = null }, agora) {
  const t = CONFIG.tipos[tipo];
  if (!t || !(total > 0) || bicho.hp <= 0) return null;
  const dots = (bicho.dots ??= []);
  const mesmos = dots.filter((d) => d.tipo === tipo && ativo(d, agora));
  // `duracaoMs`: a duração própria da fonte (um modificador de mob pode ter a dele); sem ela, a do tipo.
  const duracao = duracaoMs ?? t.duracaoMs;
  const novo = () => ({
    id: `dot-${proximoId++}`,
    tipo,
    elemento: t.elemento,
    ate: agora + duracao,
    falta: total,
    porPulso: total / Math.max(1, Math.round(duracao / t.pulsoMs)),
    proximo: agora + t.pulsoMs,
    origem,
  });
  const limite = CONFIG.limites.efeitosPorBicho;
  if (t.acumulacao === 'empilha') {
    if (mesmos.length < t.maxPilhas && dots.length < limite) dots.push(novo());
    else {
      // Cheio: a mais forte substitui a mais fraca (a que menos falta pagar).
      const fraca = mesmos.reduce((a, b) => (a && a.falta <= b.falta ? a : b), null);
      if (!fraca || total <= fraca.falta) return null;
      dots.splice(dots.indexOf(fraca), 1, novo());
    }
    return t.estado;
  }
  const atual = mesmos[0];
  if (t.acumulacao === 'renova') {
    if (!atual) {
      if (dots.length >= limite) return null;
      dots.push(novo());
    } else {
      // Renova a duração e fica com o maior dano que falta; o relógio dos pulsos continua.
      atual.ate = agora + duracao;
      if (total > atual.falta) {
        atual.falta = total;
        atual.porPulso = total / Math.max(1, Math.round(duracao / t.pulsoMs));
      }
    }
    return t.estado;
  }
  // 'maior': uma só; a nova só entra se for MAIOR do que o que ainda falta pagar; o relógio dos pulsos não reinicia.
  if (atual && total <= atual.falta) return null;
  if (atual) {
    const n = novo();
    n.proximo = atual.proximo;
    dots.splice(dots.indexOf(atual), 1, n);
  } else {
    if (dots.length >= limite) return null;
    dots.push(novo());
  }
  return t.estado;
}

/**
 * Um tique da caçada: os pulsos de todos os efeitos de todos os bichos. O dano sai direto na vida, depois da resistência do bicho ao
 * elemento; quem cair é recolhido por `processarMortes`. Devolve o dano total do tique.
 */
export function tique(hunt, eventos, agora) {
  let total = 0;
  for (const m of hunt?.monstros ?? []) {
    if (!m.dots?.length) continue;
    if (m.hp <= 0) {
      delete m.dots;
      continue;
    }
    for (const d of m.dots) {
      const t = CONFIG.tipos[d.tipo];
      if (!t) continue;
      while (d.falta > 0 && R.jaPode(agora, d.proximo) && d.proximo <= d.ate + t.pulsoMs && m.hp > 0) {
        const parte = Math.max(1, Math.round(Math.min(d.falta, d.porPulso)));
        const v = resistido(hunt, m, d.elemento, parte);
        m.hp -= v;
        d.falta -= parte;
        d.proximo += t.pulsoMs;
        total += v;
        eventos.push({ t: 'dmg', uid: m.uid, x: m.x, y: m.y, v, foe: true, alvo: m.name, color: t.cor, dot: d.tipo, ...(d.tipo === 'queimadura' ? { queimando: true } : {}) });
        registrarGolpe(() => ({ origem: 'dot', tipo: d.elemento, dot: d.tipo, alvo: m.name, danoAntesDaResistencia: parte, danoFinal: v, vidaRestante: Math.max(0, m.hp), detalhe: { id: d.id, origem: d.origem, falta: d.falta } }));
      }
    }
    m.dots = m.dots.filter((d) => d.falta > 0 && d.proximo <= d.ate + (CONFIG.tipos[d.tipo]?.pulsoMs ?? 1000));
    if (!m.dots.length) delete m.dots;
  }
  return total;
}

/** Os estados dos efeitos ATIVOS do bicho (o cliente mostra um ícone de cada): sem repetir, na ordem dos tipos. */
export function ativosDe(m, agora) {
  const nomes = new Set();
  for (const d of m?.dots ?? []) if (ativo(d, agora)) nomes.add(CONFIG.tipos[d.tipo]?.estado);
  // Sem repetir: dois tipos podem ter o mesmo estado (o veneno do Draevor e o do PoE são "envenenado").
  return [...new Set(Object.values(CONFIG.tipos).map((t) => t.estado))].filter((e) => nomes.has(e));
}

/** Tira os efeitos do bicho (todos, ou só os de um tipo). */
export function remover(m, tipo = null) {
  if (!m.dots) return;
  m.dots = tipo ? m.dots.filter((d) => d.tipo !== tipo) : [];
  if (!m.dots.length) delete m.dots;
}

// ---------------------------------------------------------------- o dano ao longo do tempo NO JOGADOR (mobs que queimam, envenenam, sangram)

/** O tipo de dano contínuo que um dano do `elemento` vira (`doElemento` em `dot.json`), ou null. */
export const tipoDoElemento = (elemento) => CONFIG.doElemento[elemento] ?? null;

/** Os efeitos que estão no JOGADOR agora (na caçada: `hunt.efeitosDoJogador`). */
const doJogador = (hunt) => (hunt.efeitosDoJogador ??= { hp: 1, dots: [] });

/**
 * Um mob põe um efeito de dano contínuo no JOGADOR: as MESMAS regras de acumulação dos bichos (maior / empilha / renova), no relógio da
 * caçada. `origem`: `{ fonte: 'mob', mob, uid }`. Devolve o estado posto ou null.
 */
export function aplicarNoJogador(hunt, { tipo, total, origem = null, duracaoMs = null }, agora) {
  return aplicar(doJogador(hunt), { tipo, total, origem, duracaoMs }, agora);
}

/**
 * Um tique: os pulsos dos efeitos no jogador. O dano passa por `ferir(origem, valor, elemento, nome)` — a proteção do jogador ao elemento,
 * o Energy Shield, a mitigação das gemas (o mesmo caminho de qualquer dano elemental do mob); a armadura NÃO vale (dano contínuo).
 */
export function tiqueDoJogador(hunt, agora, ferir, vivo = () => true) {
  const h = hunt.efeitosDoJogador;
  if (!h?.dots?.length) return 0;
  let total = 0;
  for (const d of h.dots) {
    const t = CONFIG.tipos[d.tipo];
    if (!t) continue;
    while (d.falta > 0 && R.jaPode(agora, d.proximo) && d.proximo <= d.ate + t.pulsoMs && vivo()) {
      const parte = Math.max(1, Math.round(Math.min(d.falta, d.porPulso)));
      d.falta -= parte;
      d.proximo += t.pulsoMs;
      total += ferir(d.origem, parte, d.elemento, t.nome) ?? 0;
    }
  }
  h.dots = h.dots.filter((d) => d.falta > 0 && d.proximo <= d.ate + (CONFIG.tipos[d.tipo]?.pulsoMs ?? 1000));
  return total;
}

/** Os estados dos efeitos ATIVOS no jogador (o cliente pode mostrar um ícone de cada). */
export const ativosNoJogador = (hunt, agora) => ativosDe(hunt?.efeitosDoJogador, agora);

/** Tira os efeitos do jogador (ao morrer, ao sair da caçada, ao ser curado do efeito). */
export const removerDoJogador = (hunt, tipo = null) => remover(hunt?.efeitosDoJogador ?? {}, tipo);
