// O CICLO DO PORTAL de viagem (dono, 10/10: "Animação de Portais e Sistema de Safe Zones"). Quem viaja — para uma caçada, uma instância
// nova, a sala da party, outra cidade, de volta à cidade — vê, na cena de onde sai (congelada: o servidor já o pôs no mapa novo, protegido
// até a confirmação do carregamento — `systems/protecao.mjs`):
//
//   Fase 1 — ABERTO (`abertoMs`, 3 s): o portal se abre sob o personagem, com a energia pulsando, e uma barra acima dele diminui até o
//            fechamento.
//   Fase 2 — FECHAMENTO (`fechamentoMs`, 3 s): o portal se fecha em fade-out (e encolhe), e o personagem some junto, puxado para dentro (a
//            absorção). A barra, na cor do fechamento, acompanha.
//
// Depois a cena nova entra (com a cortina, se o mapa ainda carrega) e o cliente confirma o carregamento. Tudo aqui é conta pura no relógio
// local — nenhuma mensagem ao servidor por quadro — e o mapa (`map.mjs`) só desenha o que estas funções devolvem.

export const CICLO_PADRAO = Object.freeze({ abertoMs: 3000, fechamentoMs: 3000 });

/** A duração inteira do ciclo (ms). */
export const duracao = (ciclo = CICLO_PADRAO) => Math.max(0, ciclo.abertoMs) + Math.max(0, ciclo.fechamentoMs);

const limitar = (v) => Math.max(0, Math.min(1, v));
// Suave nas pontas (a abertura e o fechamento não "estalam").
const suave = (t) => t * t * (3 - 2 * t);

/** O tempo da abertura do portal no começo da fase 1 (ele cresce e acende), em ms. */
export const ABRINDO_MS = 350;
/**
 * O PASSO (dono, 10/10: "quando ele invocar o portal, ele está ao lado olhando para ele; quando abrir todo, ele entra e assim vai
 * sumindo; no outro lado ele vai surgindo e anda 1 tile para o lado"): o portal abre na casa AO LADO dele, e ele anda essa casa — para
 * dentro, no fim da abertura; para fora, depois de surgir. A duração de um passo (ms), quando o ciclo não diz (`passoMs`).
 */
export const PASSO_NO_PORTAL_MS = 600;

/**
 * O quadro do ciclo `t` ms depois do início:
 * `{ fase: 'aberto'|'fechando'|'fim', barra, portal: { alpha, escala }, personagem: { alpha, escala }, passo, andando, energia }`.
 * `barra`: o que falta da fase (1 → 0), a mesma em cima do portal; `passo`: quanto ele já andou da casa dele para a do portal (0 → 1, no
 * fim da abertura — "3 s ele abre e entra"); `energia`: a pulsação (0..1) do brilho.
 */
export function quadroDoCiclo(t, ciclo = CICLO_PADRAO) {
  const aberto = Math.max(0, ciclo.abertoMs);
  const fechamento = Math.max(0, ciclo.fechamentoMs);
  const passoMs = Math.min(aberto, Math.max(0, ciclo.passoMs ?? PASSO_NO_PORTAL_MS));
  const energia = 0.5 + 0.5 * Math.sin((Math.max(0, t) / 420) * Math.PI * 2);
  if (t < aberto) {
    const abrindo = suave(limitar(t / Math.min(ABRINDO_MS, aberto || 1)));
    // Ao lado do portal, olhando para ele; nos últimos `passoMs` da abertura, entra.
    const passo = passoMs ? limitar((t - (aberto - passoMs)) / passoMs) : 0;
    return { fase: 'aberto', barra: aberto ? limitar(1 - t / aberto) : 0, portal: { alpha: abrindo, escala: 0.55 + 0.45 * abrindo }, personagem: { alpha: 1, escala: 1 }, passo, andando: passo > 0 && passo < 1, energia };
  }
  if (t < aberto + fechamento) {
    const p = limitar((t - aberto) / (fechamento || 1));
    const some = suave(p);
    // Dentro do portal, ele vai sumindo ("3 s ele vai sumindo") um pouco antes do portal, e encolhe junto.
    const absorvido = suave(limitar(p / 0.85));
    return { fase: 'fechando', barra: 1 - p, portal: { alpha: 1 - some, escala: 1 - 0.45 * some }, personagem: { alpha: 1 - absorvido, escala: 1 - 0.35 * absorvido }, passo: 1, andando: false, energia };
  }
  return { fase: 'fim', barra: 0, portal: { alpha: 0, escala: 0.55 }, personagem: { alpha: 0, escala: 0.65 }, passo: 1, andando: false, energia: 0 };
}

/*
 * ---- A CHEGADA (dono, 10/10: "no outro lado, 3 s ele vai aparecendo e, depois que o boneco anda 1 tile para o lado, em 1 s o portal
 * some") ----
 * O espelho da saída, na cena NOVA (com o mapa já desenhável). O portal abre na casa AO LADO de onde ele fica (a casa de verdade dele,
 * a do servidor):
 *   SURGINDO (`surgindoMs`, 3 s): ele vai aparecendo dentro do portal (fade-in, crescendo); a barra conta.
 *   SAINDO (`passoMs`): ele anda a casa, do portal para o lugar dele. A tela só confirma o carregamento no fim disto — o combate começa
 *            com ele inteiro, no lugar certo.
 *   FECHANDO (`fechamentoMs`, 1 s): o portal some SOZINHO (fade e encolhe); o boneco fica, 1 casa ao lado. Sem barra.
 */
export const CHEGADA_PADRAO = Object.freeze({ surgindoMs: 3000, passoMs: PASSO_NO_PORTAL_MS, fechamentoMs: 1000 });

const passoDaChegada = (ciclo) => Math.max(0, ciclo.passoMs ?? PASSO_NO_PORTAL_MS);
/** A duração inteira da chegada (ms). */
export const duracaoDaChegada = (ciclo = CHEGADA_PADRAO) => Math.max(0, ciclo.surgindoMs) + passoDaChegada(ciclo) + Math.max(0, ciclo.fechamentoMs);
/** Quando o personagem já está no lugar dele (surgiu e andou a casa): é a hora de a tela confirmar o carregamento (ms). */
export const prontoNaChegada = (ciclo = CHEGADA_PADRAO) => Math.max(0, ciclo.surgindoMs) + passoDaChegada(ciclo);

/**
 * O quadro da chegada `t` ms depois do início: o mesmo formato de `quadroDoCiclo` (fases 'surgindo' | 'saindo' | 'fechando' | 'fim').
 * `passo`: quanto ele já andou do portal para a casa dele (0 → 1).
 */
export function quadroDaChegada(t, ciclo = CHEGADA_PADRAO) {
  const surgindo = Math.max(0, ciclo.surgindoMs);
  const passoMs = passoDaChegada(ciclo);
  const fechamento = Math.max(0, ciclo.fechamentoMs);
  const energia = 0.5 + 0.5 * Math.sin((Math.max(0, t) / 420) * Math.PI * 2);
  if (t < surgindo) {
    const abrindo = suave(limitar(t / Math.min(ABRINDO_MS, surgindo || 1)));
    // O personagem começa a surgir logo que o portal acende e termina inteiro no fim da fase.
    const p = limitar((t - Math.min(ABRINDO_MS, surgindo) * 0.5) / Math.max(1, surgindo - Math.min(ABRINDO_MS, surgindo) * 0.5));
    const surgiu = suave(p);
    return { fase: 'surgindo', barra: surgindo ? limitar(1 - t / surgindo) : 0, portal: { alpha: abrindo, escala: 0.55 + 0.45 * abrindo }, personagem: { alpha: surgiu, escala: 0.65 + 0.35 * surgiu }, passo: 0, andando: false, energia };
  }
  if (t < surgindo + passoMs) {
    const passo = limitar((t - surgindo) / (passoMs || 1));
    return { fase: 'saindo', barra: 0, portal: { alpha: 1, escala: 1 }, personagem: { alpha: 1, escala: 1 }, passo, andando: passo < 1, energia };
  }
  if (t < surgindo + passoMs + fechamento) {
    const some = suave(limitar((t - surgindo - passoMs) / (fechamento || 1)));
    return { fase: 'fechando', barra: 0, portal: { alpha: 1 - some, escala: 1 - 0.45 * some }, personagem: { alpha: 1, escala: 1 }, passo: 1, andando: false, energia };
  }
  return { fase: 'fim', barra: 0, portal: { alpha: 0, escala: 0.55 }, personagem: { alpha: 1, escala: 1 }, passo: 1, andando: false, energia: 0 };
}

/*
 * ---- A CASA DO PORTAL: ao lado dele ----
 * As direções do jogo: 0 norte, 1 leste, 2 sul, 3 oeste. Na saída o portal abre de preferência à FRENTE dele (para onde está virado);
 * na chegada, de preferência a um LADO ("anda 1 tile para o lado"). Só casa andável e livre (`livre(x, y)`); sem nenhuma, a própria casa
 * (o portal sob ele, como antes).
 */
export const DIRECOES = Object.freeze([[0, -1], [1, 0], [0, 1], [-1, 0]]);
export const ORDEM_DA_CHEGADA = Object.freeze([3, 1, 2, 0]);
export function ordemDaSaida(dir) {
  const frente = Number.isInteger(dir) && dir >= 0 && dir < 4 ? dir : 2;
  return [frente, ...[1, 3, 2, 0].filter((d) => d !== frente)];
}
export function casaDoPortal(p, ordem, livre) {
  for (const d of ordem) {
    const [dx, dy] = DIRECOES[d];
    if (livre(p.x + dx, p.y + dy)) return { x: p.x + dx, y: p.y + dy };
  }
  return { x: p.x, y: p.y };
}
/** A direção (0–3) de quem anda de `de` para `para` (casa vizinha); sem diferença, `atual`. */
export function direcaoDoPasso(de, para, atual = 2) {
  const dx = Math.sign(para.x - de.x);
  const dy = Math.sign(para.y - de.y);
  if (dx > 0) return 1;
  if (dx < 0) return 3;
  if (dy > 0) return 2;
  if (dy < 0) return 0;
  return atual;
}

/**
 * A CENA na tela, numa chave: a caçada pela entrada (cada caçada, instância e sala da party é uma), a cidade pelo id e pelo contador de
 * teletransporte (a viagem entre cidades). Trocar a chave é viajar. null sem cena.
 */
export function chaveDaCena({ hunt = null, city = null } = {}) {
  if (hunt) return `h:${hunt.entrada ?? hunt.mapId}`;
  if (city?.player) return `c:${city.cidade?.id ?? 'city'}:${city.player.teleporte ?? 0}`;
  return null;
}

/**
 * A ENTRADA mudou no MESMO mapa (a instância nova do loop da fase, a sala da party)? Então ninguém "vem andando" da instância de antes:
 * o mapa recomeça as criaturas, como numa troca de mapa (dono, 10/10: "quando completa 100% e está em loop, fica arrastando para o
 * começo de forma não natural" — o boneco deslizava da posição velha até a entrada). Sem entrada (a cidade, servidor antigo) ou na
 * primeira, não.
 */
export const entradaNova = (antes, entrada) => antes != null && entrada != null && entrada !== antes;

/**
 * Abre o portal de saída nesta troca de cena? Só com uma cena antes (a entrada no jogo e a reconexão não têm de onde sair), cena
 * diferente e o personagem vivo (morrer não é viajar). Com os efeitos desligados também: o portal é a viagem, não enfeite. O duelo da
 * Arena (`pvp`) não: lá não há proteção de entrada — a largada dele conta na hora, e a luta não pode começar com a tela no portal.
 */
export function abrePortal({ antes, depois, morreu = false, pvp = false }) {
  return !!antes && !!depois && antes !== depois && !morreu && !pvp;
}
