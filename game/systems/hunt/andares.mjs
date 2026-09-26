// Os andares da hunt e as escadas entre eles (`mudanca`, `escada`).
// Parte de `cacadas.mjs` (dividido em 2026-09-25); a fachada continua lá.

/*
 * ---- Os andares da hunt e as escadas entre eles ----
 *
 * "as hunts normais tem escadas e rotas de caça diferentes do meu servidor"
 *
 * A rota gravada no original (`route`) sobe e desce: Amazon Camp vai do andar 7
 * ao 3 e ao 9, Dark Pyramid do 5 ao 11, e os bichos de cada andar são outros
 * (Amazon Camp: 29 amazonas no 7, valquírias e bruxas em cima, o resto embaixo).
 * Cada andar do mapa capturado (`floors[z]`) tem o próprio `blocked` e as marcas
 * de mudar de andar — as mesmas que o client usa para desenhar os buracos:
 *
 *   `mudanca`  pisou, mudou. Bit 1 = desce; 2/4/8/16 = rampa que sobe e sai
 *              para norte/sul/leste/oeste.
 *   `escada`   a escada de mão, a de clicar (`huntEscada`): 1 sobe, 2 desce.
 *
 * A regra saiu das 88 trocas de andar das rotas gravadas (todas batem): a rampa
 * leva um andar acima, uma casa na direção dela; o buraco leva à mesma casa do
 * andar de baixo, e se lá embaixo a casa é a rampa de volta, uma casa para o
 * lado de onde ela não sobe (senão subiria de novo). A de mão, mesma casa.
 *
 * As casas de `mudanca` saem do chão andável: o bicho não sobe escada, e o
 * personagem correndo atrás de um bicho não troca de andar sem querer. Quem
 * muda de andar é o passo que PEDE a escada — a rota ou o jogador na Caça Online.
 */
export const SAIDA_DA_RAMPA = [[2, 0, -1], [4, 0, 1], [8, 1, 0], [16, -1, 0]];

export function andavelDoAndar(real, z) {
  const andar = real.floors?.[z];
  const blocked = andar?.blocked ?? (z === real.z ? real.blocked : null);
  if (!blocked) return null;
  const mudanca = andar?.mudanca ?? {};
  const andavel = new Set();
  for (let y = 0; y < real.height; y++) {
    for (let x = 0; x < real.width; x++) {
      const i = y * real.width + x;
      if (!blocked[i] && !mudanca[i]) andavel.add(`${x},${y}`);
    }
  }
  return andavel;
}

/** Para onde leva pisar em `(x, y)` no andar `z` — ou `null`, se ali não há escada. */
export function destinoDaMudanca(mapa, z, x, y) {
  const i = y * mapa.width + x;
  const bits = Number(mapa.floors?.[z]?.mudanca?.[i] ?? 0);
  if (!bits) return null;
  if (bits & 1) {
    const baixo = mapa.floors?.[z + 1];
    if (!baixo) return null;
    const rampa = Number(baixo.mudanca?.[i] ?? 0);
    const saida = SAIDA_DA_RAMPA.find(([bit]) => rampa & bit);
    return saida ? { x: x - saida[1], y: y - saida[2], z: z + 1 } : { x, y, z: z + 1 };
  }
  const saida = SAIDA_DA_RAMPA.find(([bit]) => bits & bit);
  return saida && mapa.floors?.[z - 1] ? { x: x + saida[1], y: y + saida[2], z: z - 1 } : null;
}

/**
 * A grade do andar `z` da hunt — mesmo formato da grade principal (a do andar
 * onde se entra), com o chão daquele andar. Hunt de um andar só devolve a própria.
 */
export function andarDaGrade(grade, z) {
  if (z == null || z === grade.z || !grade.mapa?.floors?.[z]) return grade;
  if (!grade.andares) Object.defineProperty(grade, 'andares', { value: new Map(), enumerable: false });
  if (!grade.andares.has(z)) {
    const andavel = andavelDoAndar(grade.mapa, z);
    grade.andares.set(
      z,
      andavel
        ? { z, minX: grade.minX, maxX: grade.maxX, minY: grade.minY, maxY: grade.maxY, andavel, mapa: grade.mapa, inicioReal: grade.inicioReal, percurso: grade.percurso }
        : grade
    );
  }
  return grade.andares.get(z);
}

/** O waypoint `p` é do andar onde o personagem está? (Rota de um andar só não marca `z`.) */
export const noAndar = (p, z) => p.z == null || p.z === z;
