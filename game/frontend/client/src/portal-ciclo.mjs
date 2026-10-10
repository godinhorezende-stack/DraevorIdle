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
 * O quadro do ciclo `t` ms depois do início:
 * `{ fase: 'aberto'|'fechando'|'fim', barra, portal: { alpha, escala }, personagem: { alpha, escala }, energia }`.
 * `barra`: o que falta da fase (1 → 0), a mesma em cima do portal; `energia`: a pulsação (0..1) do brilho.
 */
export function quadroDoCiclo(t, ciclo = CICLO_PADRAO) {
  const aberto = Math.max(0, ciclo.abertoMs);
  const fechamento = Math.max(0, ciclo.fechamentoMs);
  const energia = 0.5 + 0.5 * Math.sin((Math.max(0, t) / 420) * Math.PI * 2);
  if (t < aberto) {
    const abrindo = suave(limitar(t / Math.min(ABRINDO_MS, aberto || 1)));
    return { fase: 'aberto', barra: aberto ? limitar(1 - t / aberto) : 0, portal: { alpha: abrindo, escala: 0.55 + 0.45 * abrindo }, personagem: { alpha: 1, escala: 1 }, energia };
  }
  if (t < aberto + fechamento) {
    const p = limitar((t - aberto) / (fechamento || 1));
    const some = suave(p);
    // O personagem some um pouco antes do portal (é puxado para dentro dele) e encolhe junto.
    const absorvido = suave(limitar(p / 0.85));
    return { fase: 'fechando', barra: 1 - p, portal: { alpha: 1 - some, escala: 1 - 0.45 * some }, personagem: { alpha: 1 - absorvido, escala: 1 - 0.35 * absorvido }, energia };
  }
  return { fase: 'fim', barra: 0, portal: { alpha: 0, escala: 0.55 }, personagem: { alpha: 0, escala: 0.65 }, energia: 0 };
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
 * Abre o portal de saída nesta troca de cena? Só com uma cena antes (a entrada no jogo e a reconexão não têm de onde sair), cena
 * diferente e o personagem vivo (morrer não é viajar). Com os efeitos desligados também: o portal é a viagem, não enfeite. O duelo da
 * Arena (`pvp`) não: lá não há proteção de entrada — a largada dele conta na hora, e a luta não pode começar com a tela no portal.
 */
export function abrePortal({ antes, depois, morreu = false, pvp = false }) {
  return !!antes && !!depois && antes !== depois && !morreu && !pvp;
}
