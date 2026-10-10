// A INTERPOLAÇÃO do passo no cliente (dono, 03/10): o servidor manda a posição a cada tique (~250 ms) e o cliente desenha o deslocamento ligando a casa de antes à de agora.
// O desenho dura `moveMs` a partir do instante em que o pacote CHEGA — e o pacote chega com jitter (rede, navegador, GC): chegou 40 ms depois, o boneco já tinha terminado e
// ficou 40 ms parado no meio da caminhada (a "travadinha"). A folga faz o desenho durar um pouco mais que o tique, e o passo seguinte continua de onde o desenho está (sem
// salto, sem teleporte): o boneco nunca espera o pacote, e o atraso visual para a posição do servidor é de uma fração de casa.
export const FOLGA_DA_INTERPOLACAO = 1.25;
export const DURACAO_MINIMA_MS = 120;

/** Quanto dura o desenho de UM passo cujo tempo real é `moveMs`. */
export const duracaoDaInterpolacao = (moveMs) => Math.max(DURACAO_MINIMA_MS, (moveMs ?? 500) * FOLGA_DA_INTERPOLACAO);

/**
 * O TELETRANSPORTE (a viagem entre cidades): a entidade aparece na casa nova SEM o desenho do caminho — o passo "já terminou" (desde, e
 * não puxada pela tela até lá). Muda `entity` no lugar; `entity.x/y` são a casa nova.
 */
export function teleportar(entity, now) {
  entity.fromX = entity.x;
  entity.fromY = entity.y;
  entity.since = now - 9999;
  entity.duration = 1;
  entity.walkUntil = 0;
}

/** Começa o desenho de um passo novo: continua de onde o desenho parou (não do ponto final do passo anterior) e marca o início. Muda `entity` no lugar. */
export function comecarPasso(entity, now, moveMs) {
  const progress = Math.min(1, (now - entity.since) / entity.duration);
  entity.fromX += (entity.x - entity.fromX) * progress;
  entity.fromY += (entity.y - entity.fromY) * progress;
  entity.since = now;
  entity.duration = duracaoDaInterpolacao(moveMs);
}
