// As ARMADILHAS e as MINAS PLANTADAS do PoE (dono, 12/10: "Armadilhas e Minas plantadas — limite, duração, detonação"). Só no modo PoE.
//
// Antes a gema de Armadilha/Mina disparava na hora, no alvo. Agora ela PLANTA (`hunt.plantadas`, JSON puro, no relógio da caçada) e a
// habilidade sai depois, DO LUGAR dela (`acoes.dispararSemMarcar` com `plantada`):
//   Armadilha — ativa quando um inimigo entra no raio de ativação (1 casa — o alvo em cima dela ativa na hora); dura o "Armadilha dura N
//               segundos" da gema (4 s); até 15 de uma vez (+ "Pode ter até N Armadilhas adicionais plantadas por vez"); a mais velha sai
//               quando passa do limite. "Quando suas Armadilhas Ativarem, suas Armadilhas próximas também Ativam" (a até 3 casas).
//   Mina      — o jogo detona sozinho, como o atalho de Detonar Minas do PoE: com uma Mina plantada perto de um inimigo (2 casas) e você
//               parado ("Detonar Minas é Ativado enquanto você se mover" detona também andando). A SEQUÊNCIA DE DETONAÇÃO do PoE: a primeira
//               detona na hora; cada uma das seguintes depois do "Tempo Base de Detonação de Mina" da gema (0,25–0,35 s), ÷ (1 + "Velocidade
//               de Detonação aumentada") ÷ (1 + 10% × as Minas anteriores na sequência). Dura o "Mina dura N segundos" (5 s, × "Duração da
//               Mina"); até 15 (+ "Pode ter até N Minas Remotas adicionais").
//   As duas   — a magia em área de um monstro que pega a casa destrói a Armadilha/Mina ("Armadilhas/Minas não podem ser Danificadas" impede).
import { ligado } from './catalogo.mjs';

export const PADRAO = {
  armadilha: { maximo: 15, duracaoMs: 4000, raioDeAtivacao: 1, raioDasProximas: 3 },
  // (lote 45, P012: `recargaMs` — a recarga do Detonar Minas, 0,2 s no poedb: o jogo usa o atalho no máximo uma vez a cada 0,2 s)
  mina: { maximo: 15, duracaoMs: 5000, detonacaoMs: 300, maisPorAnteriorPct: 10, raioDeDetonacao: 2, raioDosProximos: 3, recargaMs: 200 },
};
/** "Se mover": andou há até 0,6 s (o mesmo de `condicoes-poe` — `movendo`). */
const MOVENDO_MS = 600;

const v = (ficha, k) => Number(ficha?.afPoe?.[k]) || 0;
const distancia = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/**
 * A gema planta? (o arquétipo dela: `armadilha` ou `mina`), só no modo PoE. Devolve o tipo ou null. (17/10, lote G3: + `efeito` — o SUPORTE
 * que transforma a habilidade em Armadilha ou Mina: o Suporte de Armadilha, "Armadilha dura 4 segundo"; as Minas de Explosão em Cadeia, de
 * Alto Impacto e Locus, "Mina dura 5 segundos" — `efeito.plantaArmadilha`/`plantaMina`, de `suportes-poe.mjs`.)
 */
export function tipoDaGema(entry, efeito = null) {
  if (!ligado() || !entry?.poeGema) return null;
  if (efeito?.plantaArmadilha > 0) return 'armadilha';
  if (efeito?.plantaMina > 0) return 'mina';
  return ['armadilha', 'mina'].includes(entry.poeGema.arquetipo) ? entry.poeGema.arquetipo : null;
}

/** Quantas do tipo cabem plantadas de uma vez (+ `extra`: o "podem ter até N Armadilhas adicionais armadas de uma vez" do suporte). */
export const maximo = (ficha, tipo, extra = 0) => PADRAO[tipo].maximo + v(ficha, tipo === 'armadilha' ? 'max_armadilhas' : 'max_minas') + Math.max(0, Math.round(Number(extra) || 0));

/** A duração (ms) da Armadilha/Mina: a da gema (`baseS`, "Armadilha/Mina dura N segundos") × "Duração da Mina/Armadilha aumentada". */
export function duracaoMs(ficha, tipo, baseS = null) {
  const base = baseS > 0 ? baseS * 1000 : PADRAO[tipo].duracaoMs;
  return Math.round(base * Math.max(0.1, 1 + v(ficha, tipo === 'mina' ? 'duracao_mina' : 'duracao_armadilha') / 100));
}

/** O "Tempo Base de Detonação de Mina é de N segundos" das linhas da gema (ms), ou o padrão. */
export function detonacaoDaGema(linhas = []) {
  for (const l of linhas) {
    const m = /Tempo Base de Detonação de Mina é de (\d+(?:[.,]\d+)?) segundos?/i.exec(String(l));
    if (m) return Math.round(parseFloat(m[1].replace(',', '.')) * 1000);
  }
  return PADRAO.mina.detonacaoMs;
}

/**
 * Quantas armadilhas a mais este arremesso joga: as de sempre ("Habilidades que Arremessam Armadilhas arremessam até N Armadilhas adicionais")
 * e, na chance, as do "X% de chance de arremessar até N Armadilhas adicionais" (o "até" do PoE: as N, em volta do lugar).
 */
export function extrasDoArremesso(ficha, tipo, rng = Math.random, efeito = null) {
  // (17/10, lote G3) o SUPORTE: "arremessam até N Armadilhas/Minas adicionais" (Armadilhas Múltiplas/Agrupadas, Locus) e as faixas de chance da
  // Montagem Ágil ("X% de chance de arremessar até 1/2/3 Armadilhas ou Minas adicionais" — a maior faixa que acertar o sorteio vale), nos dois
  // tipos; as das peças e da árvore seguem só nas Armadilhas.
  const doSuporte = Math.max(0, Math.round(Number(tipo === 'armadilha' ? efeito?.armadilhasExtras : efeito?.minasExtras) || 0));
  let faixa = 0;
  const faixas = Object.entries(efeito ?? {}).filter(([k, x]) => k.startsWith('arremessoChance:') && x > 0).map(([k, x]) => [Number(k.slice('arremessoChance:'.length)) || 0, x]).sort((a, b) => b[0] - a[0]);
  for (const [n, chance] of faixas) if (rng() * 100 < chance) { faixa = n; break; }
  // (lote 71, a Dispensabilidade: "X% de chance de Arremessar até N Armadilha ou Mina adicional" — vale nas duas)
  const chanceDasDuas = v(ficha, 'plantadas_extras_chance');
  const nDasDuas = Math.max(0, Math.round(v(ficha, 'plantadas_extras_n')));
  const dasDuas = chanceDasDuas > 0 && nDasDuas > 0 && rng() * 100 < chanceDasDuas ? nDasDuas : 0;
  if (tipo !== 'armadilha') return doSuporte + faixa + (tipo === 'mina' ? dasDuas : 0);
  const sempre = Math.max(0, Math.round(v(ficha, 'armadilhas_extras')));
  const chance = v(ficha, 'armadilhas_extras_chance');
  const n = Math.max(0, Math.round(v(ficha, 'armadilhas_extras_n')));
  return sempre + doSuporte + faixa + (chance > 0 && n > 0 && rng() * 100 < chance ? n : 0) + dasDuas;
}

/** As casas das armadilhas a mais, em volta do lugar mirado (a casa do lugar fica com a primeira). */
export function casasDoArremesso(x, y, n) {
  const casas = [{ x, y }];
  const volta = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
  for (let i = 0; casas.length < n + 1; i++) {
    const [dx, dy] = volta[i % volta.length];
    const r = 1 + Math.floor(i / volta.length);
    casas.push({ x: x + dx * r, y: y + dy * r });
  }
  return casas;
}

/** Planta uma Armadilha/Mina. Passou do limite: a mais velha do tipo sai. Devolve a plantada. */
export function plantar(hunt, ficha, { tipo, acao, slot, x, y, z = hunt?.z ?? 0, duracaoMs: dur, detonacaoMs = null, agora = hunt?.clock ?? 0, maximoExtra = 0 }) {
  const lista = (hunt.plantadas ?? []).filter((p) => p.ate > agora);
  const doTipo = lista.filter((p) => p.tipo === tipo);
  while (doTipo.length >= maximo(ficha, tipo, maximoExtra)) lista.splice(lista.indexOf(doTipo.shift()), 1);
  hunt.plantadasN = (hunt.plantadasN ?? 0) + 1;
  const p = { id: `${tipo}-${hunt.plantadasN}`, tipo, acao, slot, x, y, z, desde: agora, ate: agora + dur, ...(tipo === 'mina' ? { detonacaoMs: detonacaoMs ?? PADRAO.mina.detonacaoMs } : {}) };
  lista.push(p);
  hunt.plantadas = lista;
  return p;
}

/** "X% de Chance das Armadilhas Ativarem uma vez adicional" / "Minas têm uma chance de X% de serem Detonadas uma Vez Adicional": sorteia. */
export const ativaDeNovo = (ficha, tipo, rng = Math.random) => {
  const chance = v(ficha, tipo === 'mina' ? 'mina_detona_de_novo' : 'armadilha_ativa_de_novo');
  return chance > 0 && rng() * 100 < chance;
};

/** "Minas Desaceleram Inimigos próximos delas por N segundos quando são Plantadas": os segundos (0 sem a linha). */
export const segundosDaLentidaoAoPlantar = (ficha) => Math.max(0, v(ficha, 'minas_desaceleram_s'));

/** Os inimigos vivos a até `raio` casas da plantada (no mesmo andar). */
export const inimigosPerto = (hunt, p, raio) => (hunt?.monstros ?? []).filter((b) => b.hp > 0 && !b.dummy && !(b.z != null && p.z != null && b.z !== p.z) && distancia(b, p) <= raio);

/** Tira uma plantada (a que ativou, detonou ou foi destruída). */
export function tirar(hunt, p) {
  if (hunt?.plantadas) hunt.plantadas = hunt.plantadas.filter((x) => x !== p && x.id !== p.id);
}

/** As plantadas agora (vencidas saem), de um tipo ou todas. */
export function plantadas(hunt, tipo = null, agora = hunt?.clock ?? 0) {
  if (!hunt?.plantadas?.length) return [];
  hunt.plantadas = hunt.plantadas.filter((p) => p.ate > agora);
  return hunt.plantadas.filter((p) => !tipo || p.tipo === tipo);
}

/** O inimigo vivo mais perto da plantada, a até `raio` casas (no mesmo andar), ou null. */
export function inimigoPerto(hunt, p, raio) {
  let melhor = null;
  for (const b of hunt.monstros ?? []) {
    if (!(b.hp > 0) || b.dummy || (b.z != null && p.z != null && b.z !== p.z)) continue;
    const d = distancia(b, p);
    if (d <= raio && (!melhor || d < melhor.d)) melhor = { b, d };
  }
  return melhor?.b ?? null;
}

/**
 * As ARMADILHAS que ativam agora: `[{ p, alvo }]` — as que têm inimigo no raio de ativação e, com "Quando suas Armadilhas Ativarem, suas
 * Armadilhas próximas também Ativam", as que estão a até 3 casas de uma que ativou (em cadeia; o alvo é o inimigo mais perto dela, ou o da
 * que a ativou).
 */
export function armadilhasQueAtivam(hunt, ficha, agora = hunt?.clock ?? 0) {
  const A = PADRAO.armadilha;
  const todas = plantadas(hunt, 'armadilha', agora);
  const fila = [];
  const na = new Set();
  for (const p of todas) {
    // (lote S2A, 27/10: o raio de ativação da própria Armadilha — o "Efeito em Área da Ativação de Armadilhas aumentado" dos suportes, `p.raioDeAtivacao`)
    const alvo = inimigoPerto(hunt, p, p.raioDeAtivacao ?? A.raioDeAtivacao);
    if (alvo) { fila.push({ p, alvo }); na.add(p); }
  }
  if (fila.length && v(ficha, 'armadilhas_ativam_proximas') > 0) {
    for (let i = 0; i < fila.length; i++) {
      for (const q of todas) {
        if (na.has(q) || distancia(q, fila[i].p) > A.raioDasProximas) continue;
        na.add(q);
        fila.push({ p: q, alvo: inimigoPerto(hunt, q, A.raioDasProximas) ?? fila[i].alvo });
      }
    }
  }
  return fila;
}

/** Você está se movendo? (andou há até 0,6 s) */
export const movendo = (hunt, agora = hunt?.clock ?? 0) => agora - (hunt?.poeRecente?.moveu ?? -Infinity) <= MOVENDO_MS;

/**
 * A SEQUÊNCIA DE DETONAÇÃO das Minas: se o jogo pode detonar agora (parado, ou "Detonar Minas é Ativado enquanto você se mover") e alguma
 * Mina plantada tem inimigo perto, as que ainda não estão na sequência entram nela (a mais velha primeiro): a primeira detona na hora, cada
 * seguinte depois do tempo de detonação dela ÷ (1 + "Velocidade de Detonação aumentada") ÷ (1 + 10% × as anteriores). (Lote 45: cada uso do
 * atalho respeita a recarga de 0,2 s do Detonar Minas — `hunt.poeDetonarEm`.) Devolve as Minas que detonam agora: `[{ p, alvo }]`.
 */
// (lote E2B, 26/10: `velocidadeExtraPct` — a qualidade da gema Detonar Minas encaixada, "Minas tem Velocidade de Detonação aumentada em X%"; `manual` — o uso da gema
// Detonar Minas na barra: detona andando e sem inimigo perto, como o atalho do PoE)
export function minasQueDetonam(hunt, ficha, agora = hunt?.clock ?? 0, { velocidadeExtraPct = 0, manual = false } = {}) {
  const M = PADRAO.mina;
  const minas = plantadas(hunt, 'mina', agora);
  if (!minas.length) return [];
  const pode = manual || !movendo(hunt, agora) || v(ficha, 'detonar_minas_movendo') > 0;
  const fora = minas.filter((p) => p.detonaEm == null);
  if (pode && fora.length && agora >= (hunt.poeDetonarEm ?? -Infinity) + M.recargaMs && (manual || minas.some((p) => inimigoPerto(hunt, p, M.raioDeDetonacao)))) {
    hunt.poeDetonarEm = agora;
    const naSequencia = minas.filter((p) => p.detonaEm != null).length;
    const velocidade = Math.max(0.1, 1 + (v(ficha, 'velocidade_detonacao') + (Number(velocidadeExtraPct) || 0)) / 100);
    let t = Math.max(agora, ...minas.filter((p) => p.detonaEm != null).map((p) => p.detonaEm));
    fora.sort((a, b) => a.desde - b.desde).forEach((p, i) => {
      const anteriores = naSequencia + i;
      // (17/10, lote G3: as Minas anteriores na Sequência de Detonação — a Explosão em Cadeia, "X% mais Dano para cada Mina anterior")
      p.anteriores = anteriores;
      if (anteriores > 0) t += Math.round((p.detonacaoMs ?? M.detonacaoMs) / velocidade / (1 + (M.maisPorAnteriorPct * anteriores) / 100));
      p.detonaEm = t;
    });
  }
  return minas.filter((p) => p.detonaEm != null && p.detonaEm <= agora).sort((a, b) => a.detonaEm - b.detonaEm).map((p) => ({ p, alvo: inimigoPerto(hunt, p, M.raioDeDetonacao) }));
}

/**
 * A magia em ÁREA de um monstro (`casas`) DESTRÓI as Armadilhas e Minas plantadas que ela pega — menos com "Armadilhas/Minas não podem ser
 * Danificadas". Devolve quantas destruiu.
 */
export function destruirNaArea(hunt, casas, ficha) {
  if (!hunt?.plantadas?.length || !casas?.length) return 0;
  const naArea = new Set(casas.map((c) => `${c.x},${c.y}`));
  const imune = (p) => v(ficha, p.tipo === 'mina' ? 'minas_indestrutiveis' : 'armadilhas_indestrutiveis') > 0;
  const antes = hunt.plantadas.length;
  hunt.plantadas = hunt.plantadas.filter((p) => !naArea.has(`${p.x},${p.y}`) || imune(p));
  return antes - hunt.plantadas.length;
}
