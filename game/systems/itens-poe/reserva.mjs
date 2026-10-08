// A RESERVA de mana das auras do PoE (dono, 08/10, com a regra do PoE: "as magias do tipo Aura bloqueiam uma quantidade de mana — a Mana
// Reservada. Em vez de consumirem mana ao serem conjuradas, mantêm uma parte da sua mana máxima trancada enquanto estiverem ativadas").
//
//   QUEM: a gema de aura/arauto com "Reserva" no PoE (`stats.reserva` da gema compilada): "50% Mana" (a % da máxima — Determinação, Ódio,
//         Pureza dos Elementos; 35% as Purezas de um elemento e a Disciplina; 25% os Arautos) ou "34 Mana" (o valor fixo, que sobe com o
//         nível da gema — Clareza, Vitalidade, Precisão). As bandeiras e as auras Vaal não reservam (têm custo ou almas).
//   LIGADA: o lançamento não custa mana; ele LIGA a aura, que fica valendo sem expirar enquanto a gema estiver na barra (e encaixada). Só
//           liga se couber na parte LIVRE (a máxima menos o que as outras já reservam).
//   LIVRE: a mana (e a vida) atual nunca passa da parte livre — a regeneração enche só até ela (`cortarNoLivre`, a cada tique).
//   EFICÁCIA: × o "Multiplicador de Custo & Reserva" dos suportes ligados (Iluminação reduz, Arrogância aumenta) ÷ (1 + a "Eficácia da
//             Reserva" das passivas e das peças: de mana, de vida, das habilidades, dos Arautos). Arredonda para cima, como no PoE.
//   VIDA: com o suporte que reserva Vida (Arrogância: "Reservam Vida ao invés de Mana") ou o Magia Sanguínea, a reserva sai da VIDA.
//   BLASFÊMIA: a maldição ligada à Blasfêmia vira AURA — liga reservando a "Sobreposição de Reserva" do suporte (35%) em vez de custar, e
//              fica ligada; as marcas dela têm o "menos Efeito" do suporte. A Eficácia da Reserva de "Aura de Maldição" vale para ela; a de
//              "Postura", para as gemas com a tag Postura. (A dos "suportados por Feiticeiro" não tem efeito: esse suporte não está no jogo.)
import { compilada } from './gemas-poe.mjs';
/** A maldição vira aura (a Blasfêmia ligada a ela). */
export const ehMaldicaoEmAura = (entry, efeitoDaGema) => !!efeitoDaGema?.maldicaoEmAura && entry?.poeGema?.arquetipo === 'maldicao';
import * as ModsPoe from './condicoes-poe.mjs';

/** Até quando a aura ligada vale: não expira (sai quando a gema deixa a barra — `desligarAsQueSairam`). */
export const LIGADA_ATE = Number.MAX_SAFE_INTEGER;

/** A reserva da gema no nível: `{ pct }` (da máxima) ou `{ fixo }`; null se ela não reserva. */
export function daGema(slug, nivel = 1) {
  const m = String(compilada(slug, nivel)?.stats?.reserva ?? '').match(/^\s*(\d+(?:\.\d+)?)\s*(%?)/);
  const n = m ? Number(m[1]) : 0;
  if (!(n > 0)) return null;
  return m[2] ? { pct: n } : { fixo: n };
}

/**
 * O fator da reserva: × o "Multiplicador de Custo & Reserva" dos suportes (`efeitoDaGema.custoPct`, em % acima de 100) ÷ (1 + a Eficácia
 * da Reserva: `eficiencia_reserva` vale para as duas; `_mana`/`_vida`, para a sua; `_arauto`, para a mana dos Arautos).
 */
export function fator(ficha, efeitoDaGema, recurso, arquetipo = null, tipos = null) {
  const mult = Math.max(0, 1 + (Number(efeitoDaGema?.custoPct) || 0) / 100);
  const deMana = recurso === 'mana';
  const eficacia = ModsPoe.valor(ficha, 'eficiencia_reserva')
    + ModsPoe.valor(ficha, recurso === 'vida' ? 'eficiencia_reserva_vida' : 'eficiencia_reserva_mana')
    + (deMana && arquetipo === 'arauto' ? ModsPoe.valor(ficha, 'eficiencia_reserva_arauto') : 0)
    // A maldição em aura (Blasfêmia) e a postura (a tag "Stance" da gema).
    + (deMana && arquetipo === 'maldicao' ? ModsPoe.valor(ficha, 'eficiencia_reserva_maldicao') : 0)
    + (deMana && tipos?.has?.('Stance') ? ModsPoe.valor(ficha, 'eficiencia_reserva_postura') : 0);
  return mult / Math.max(0.1, 1 + eficacia / 100);
}

/** Quanto a reserva `r` (`{ recurso, pct?, fixo?, fator }`) tranca agora — a % sobre a máxima de AGORA (subiu de level, trocou de peça). */
export function valor(estado, r) {
  const maxima = r.recurso === 'vida' ? estado.maxHp ?? 0 : estado.maxMana ?? 0;
  return Math.ceil((r.pct ? (maxima * r.pct) / 100 : r.fixo ?? 0) * (r.fator ?? 1));
}

/** As reservas ligadas agora (as auras da caçada): `{ mana, vida }` — nunca mais que a máxima (a vida deixa sempre 1). */
export function reservadas(estado, exceto = null) {
  const hunt = estado?.hunt;
  const agora = hunt?.clock ?? 0;
  let mana = 0;
  let vida = 0;
  for (const [id, b] of Object.entries(hunt?.buffs ?? {})) {
    if (!b?.reserva || !(b.ate > agora) || id === exceto) continue;
    if (b.reserva.recurso === 'vida') vida += valor(estado, b.reserva);
    else mana += valor(estado, b.reserva);
  }
  return { mana: Math.min(mana, estado?.maxMana ?? 0), vida: Math.min(vida, Math.max(0, (estado?.maxHp ?? 0) - 1)) };
}

/** A parte LIVRE de cada recurso: a máxima menos o reservado. */
export function livre(estado) {
  const r = reservadas(estado);
  return { mana: Math.max(0, (estado?.maxMana ?? 0) - r.mana), vida: Math.max(1, (estado?.maxHp ?? 0) - r.vida), reservada: r };
}

/** Corta a mana e a vida atuais na parte livre (a cada tique, depois da regeneração: a poção e o roubo que passaram também). */
export function cortarNoLivre(estado) {
  const l = livre(estado);
  if (!l.reservada.mana && !l.reservada.vida) return;
  if ((estado.mana ?? 0) > l.mana) estado.mana = l.mana;
  if ((estado.hp ?? 0) > l.vida) estado.hp = l.vida;
}

/**
 * A reserva que a gema PEDE para ligar: `{ recurso, pct?, fixo?, fator, valor }`, ou null se a gema não reserva. `emVida`: o suporte que
 * reserva Vida ou o Magia Sanguínea (quem chama sabe — é a mesma regra do custo em vida).
 */
export function pedida(estado, entry, efeitoDaGema, ficha, emVida = false) {
  if (!entry?.poeGema?.buff) return null;
  const nivel = efeitoDaGema?.nivel ?? 1;
  // A maldição com a Blasfêmia reserva a "Sobreposição de Reserva" do suporte; o resto, a reserva da própria gema.
  const base = ehMaldicaoEmAura(entry, efeitoDaGema) ? { pct: Number(efeitoDaGema.reservaSobreposta) || 35 } : daGema(entry.poeGema.slug, nivel);
  if (!base) return null;
  const recurso = emVida ? 'vida' : 'mana';
  const r = { recurso, ...base, fator: fator(ficha, efeitoDaGema, recurso, entry.poeGema.arquetipo, compilada(entry.poeGema.slug, nivel)?.tipos ?? null) };
  return { ...r, valor: valor(estado, r) };
}

/** Cabe? (na parte livre sem esta aura — religar a mesma não conta duas vezes). A vida reservada deixa sempre 1 de vida. */
export function cabe(estado, idDaAcao, r) {
  const outras = reservadas(estado, idDaAcao);
  const maxima = r.recurso === 'vida' ? (estado.maxHp ?? 0) - 1 : estado.maxMana ?? 0;
  return r.valor <= maxima - outras[r.recurso];
}

/**
 * Desliga a aura cuja gema saiu da barra, foi desligada no slot ou saiu da peça (`continua(id)` diz se ela segue valendo). Devolve true se
 * alguma desligou (quem chama refaz a ficha: os atributos dela saem).
 */
export function desligarAsQueSairam(hunt, continua) {
  let saiu = false;
  for (const [id, b] of Object.entries(hunt?.buffs ?? {})) {
    if (!b?.reserva || continua(id)) continue;
    delete hunt.buffs[id];
    saiu = true;
  }
  return saiu;
}
