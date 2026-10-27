// O LOTE D1 das gemas ATIVAS do PoE (27/10: as decisões do dono sobre as parciais que sobraram dos lotes E2A e E2B). Aqui ficam os DADOS (o que as linhas dizem no
// nível e na qualidade, os números do PoB) e as contas puras (sem a caçada); quem usa é gemas-poe.mjs (os leitores e o status), acoes.mjs (os giros da Armadilha de
// Lâminas, a aura do Carne e Pedra no tique, a troca de Postura) e condicoes-poe.mjs (o dano sofrido do Carne e Pedra nos dois lados).
//
// As decisões do dono (27/10):
//   - a ARMADILHA DE LÂMINAS e a da LACERAÇÃO (o PoB, act_dex.lua BladeTrap/BladeTrapAltY): "Gira N vezes" — ativada, a Armadilha gira; cada giro acerta UMA vez cada
//     inimigo na área dela; 0,25 s por giro. Os giros pelo PoB: base_weapon_trap_total_rotation_% (400 na base — "Gira 4 vezes"; 100 na da Laceração — "Gira 1 vez"),
//     + 5% por qualidade na base ("Gira +1 vez" na qualidade 20), + 100% em Empunhadura Dupla (weapon_trap_total_rotation_%_if_dual_wielding — "Gira +1 vezes se em
//     Empunhadura Dupla"); a fração de um giro é a chance de um giro a mais. Em Empunhadura Dupla, a rotação é 25% mais rápida
//     (weapon_trap_rotation_speed_+%_if_dual_wielding — "Velocidade de rotação aumentada em 25%"): 0,25 s ÷ 1,25 por giro. A qualidade da base também dá +0,05 s de
//     duração da Armadilha por ponto (base_trap_duration 50 — "Armadilha dura +1 segundo");
//   - o CARNE E PEDRA (o PoB, act_str.lua FleshAndStone): os dois valem CHEIOS, sem a queda pela distância ("até X%", "mais impactantes contra inimigos mais
//     próximos": o PoB usa o valor cheio). Na Postura de Sangue, os inimigos na aura sofrem X% mais Dano Físico dos Acertos (PhysicalDamageTaken MORE, ModFlag.Hit);
//     na da Areia, você sofre Y% menos Dano dos acertos dos inimigos na aura (DamageTakenWhenHit MORE). A Postura é a mesma do Sangue e Areia (o PoE: as duas gemas
//     são de Postura — "Usar a habilidade novamente alterna entre a Postura de Sangue e a Postura da Areia"); ligar começa na Postura em que você está;
//   - os ESPECTROS ("Velocidade de Movimento dos Lacaios está no Máximo" — movement_velocity_cap −53 do PoB, a base 128): o teto de +75% no aumento total do passo do
//     lacaio (128 − 53). Hoje o espectro tem +55% — só a árvore e as peças passam do teto (`GemasE2a`, `lacaios-poe.movimentoDoLacaio`);
//   - a MINA DE FUMAÇA: "Minas não podem ser Re-armadas" não se aplica (o jogo não tem Re-armar — gemas-poe.mjs, `LINHAS_QUE_NAO_SE_APLICAM`).

const norm = (t) => String(t).replace(/(\d)%/g, '$1 %').replace(/\\n/g, ' ').replace(/[ㅤ ]/g, ' ').replace(/\s+/g, ' ').trim();
const achar = (linhas, re, g = 1) => { for (const l of linhas ?? []) { const m = re.exec(norm(l)); if (m) return Number(m[g]); } return null; };
const ativo = (x, agora) => (x?.ate ?? 0) > agora;

// ---------------------------------------------------------------- a Armadilha de Lâminas

const LINHA_GIROS = /^Gira (\d+) vez(?:es)?$/i;
const LINHA_GIROS_DUPLA = /^Gira \+(\d+) vez(?:es)? se em Empunhadura Dupla$/i;
const LINHA_ROTACAO_DUPLA = /^Velocidade de rotação aumentada em ([\d.]+) % se em Empunhadura Dupla$/i;
// (a linha da qualidade da base, que o poedb salvo parte em duas: "Armadilha dura +1 segundo Gira" e "+1 vez")
const LINHA_QUALIDADE_DURACAO = /^Armadilha dura \+([\d.]+) segundos?(?: Gira)?$/i;
const LINHA_QUALIDADE_GIRO = /^(?:Gira )?\+([\d.]+) vez(?:es)?$/i;
export const LAMINAS = /^Blade_Trap(_of_Laceration)?$/;
/** O tempo de um giro (decisão do dono 27/10: 0,25 s) e o que a qualidade da base dá (o PoB: 5% de rotação e 50 ms de duração por ponto). */
export const GIRO = Object.freeze({ ms: 250, rotacaoPorQualidadePct: 5, duracaoPorQualidadeMs: 50 });
/**
 * Os giros da Armadilha de Lâminas (a base e a da Laceração): `{ giros, chanceDeMais, intervaloMs }` — `giros` inteiros e a chance (0–1) de um a mais, pela rotação
 * total (o PoB: base_weapon_trap_total_rotation_%; 100% = um giro) —, ou null. `qualidade`: 0–20 (só a base gira mais com ela); `duasArmas`: em Empunhadura Dupla.
 */
export function girosDasLinhas(slug, linhas = [], qualidade = 0, duasArmas = false) {
  if (!LAMINAS.test(String(slug ?? ''))) return null;
  const base = achar(linhas, LINHA_GIROS);
  if (!base) return null;
  const q = slug === 'Blade_Trap' ? Math.max(0, Number(qualidade) || 0) * GIRO.rotacaoPorQualidadePct : 0;
  const rotacaoPct = base * 100 + q + (duasArmas ? (achar(linhas, LINHA_GIROS_DUPLA) ?? 0) * 100 : 0);
  const giros = Math.floor(rotacaoPct / 100 + 1e-9);
  const velocidadePct = duasArmas ? achar(linhas, LINHA_ROTACAO_DUPLA) ?? 0 : 0;
  return { giros, chanceDeMais: Math.max(0, rotacaoPct / 100 - giros), intervaloMs: Math.max(50, Math.round(GIRO.ms / Math.max(0.1, 1 + velocidadePct / 100))) };
}
/** Quantos giros nesta ativação (a fração é a chance de um a mais — sorteada). */
export const girosNaAtivacao = (d, rng = Math.random) => (d ? d.giros + (d.chanceDeMais > 0 && rng() < d.chanceDeMais ? 1 : 0) : 0);
/** A duração a mais da Armadilha pela qualidade da base (ms): 50 ms por ponto (o PoB — "Armadilha dura +1 segundo" na qualidade 20). */
export const duracaoDaQualidadeMs = (slug, qualidade = 0) => (slug === 'Blade_Trap' ? Math.round(Math.max(0, Number(qualidade) || 0) * GIRO.duracaoPorQualidadeMs) : 0);

// ---------------------------------------------------------------- o Carne e Pedra

const LINHA_SANGUE = /^Enquanto na Postura de Sangue, Aura faz com que os Inimigos sofram até ([\d.]+) % mais Dano Físico dos Acertos$/i;
const LINHA_AREIA = /^Enquanto na Postura da Areia, Buff faz com que você sofra até ([\d.]+) % menos Dano dos Inimigos na Aura$/i;
export const CARNE_E_PEDRA = Object.freeze({ slug: 'Flesh_and_Stone', raioM: 2.8, marcaMs: 500 });
/** O Carne e Pedra: `{ sanguePct, areiaPct }` (os valores cheios — decisão do dono 27/10), ou null. */
export function carneEPedraDasLinhas(slug, linhas = []) {
  if (slug !== CARNE_E_PEDRA.slug) return null;
  const sanguePct = achar(linhas, LINHA_SANGUE) ?? 0;
  const areiaPct = achar(linhas, LINHA_AREIA) ?? 0;
  return sanguePct || areiaPct ? { sanguePct, areiaPct } : null;
}
/**
 * Marca os inimigos na aura do Carne e Pedra ligado (`b`, o buff — `postura`, `raio` em casas) em volta de `pos`: na Postura de Sangue, `carneEPedraD1.sanguePct` (o
 * Físico dos acertos que eles sofrem a mais); na da Areia, `carneEPedraD1.areiaPct` (o dano dos acertos deles em você a menos). `efeito`: o fator do efeito da aura.
 * A marca dura `marcaMs` (o tique renova). Devolve quantos marcou.
 */
export function marcarNaAura(monstros, pos, z, b, d, efeito = 1, agora = 0) {
  if (!b || !d || !pos) return 0;
  const raio = Math.max(0, b.raio ?? 1);
  const areia = b.postura === 'areia';
  const pct = (areia ? d.areiaPct : d.sanguePct) * Math.max(0, efeito);
  if (!(pct > 0)) return 0;
  let n = 0;
  for (const m of monstros ?? []) {
    if (!(m.hp > 0) || m.dummy || (m.z ?? z ?? 0) !== (z ?? 0) || Math.max(Math.abs(m.x - pos.x), Math.abs(m.y - pos.y)) > raio) continue;
    (m.estados ??= {}).carneEPedraD1 = { ate: agora + CARNE_E_PEDRA.marcaMs, ...(areia ? { areiaPct: pct } : { sanguePct: pct }) };
    n++;
  }
  return n;
}
/** (o golpe em você) o fator do dano do acerto do bicho na aura do Carne e Pedra na Postura da Areia (1 sem a marca). */
export const fatorDaAreia = (bicho, agora) => (ativo(bicho?.estados?.carneEPedraD1, agora) && bicho.estados.carneEPedraD1.areiaPct > 0 ? Math.max(0, 1 - bicho.estados.carneEPedraD1.areiaPct / 100) : 1);
/** (o acerto no bicho) o fator do Físico que o bicho na aura do Carne e Pedra na Postura de Sangue sofre (1 sem a marca). */
export const fatorDoSangue = (bicho, agora) => (ativo(bicho?.estados?.carneEPedraD1, agora) && bicho.estados.carneEPedraD1.sanguePct > 0 ? 1 + bicho.estados.carneEPedraD1.sanguePct / 100 : 1);

// ---------------------------------------------------------------- o que o status lê

/** As linhas do lote que o jogo faz (saem de "efeito não simulado" — GemasPoe.ehLinhaFeita): [regex, slugs]. */
const FEITAS = [
  [LINHA_GIROS, LAMINAS], [LINHA_GIROS_DUPLA, /^Blade_Trap$/], [LINHA_ROTACAO_DUPLA, /^Blade_Trap$/], [LINHA_QUALIDADE_DURACAO, /^Blade_Trap$/], [LINHA_QUALIDADE_GIRO, /^Blade_Trap$/],
  [LINHA_SANGUE, /^Flesh_and_Stone$/], [LINHA_AREIA, /^Flesh_and_Stone$/],
];
export const ehLinhaD1 = (slug, l) => FEITAS.some(([re, s]) => s.test(String(slug ?? '')) && re.test(norm(l)));
/** As gemas do lote cujo efeito é a mecânica (sem o "nenhum efeito do buff"): o Carne e Pedra (a aura que marca os inimigos). */
export const SEM_AF_NO_BUFF_D1 = new Set([CARNE_E_PEDRA.slug]);
