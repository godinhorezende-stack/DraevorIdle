// Andar no laço da Caça Automática: waypoint da vez, retomar depois da briga, contar as voltas.
// Parte de `cacadas.mjs` (dividido em 2026-09-25); a fachada continua lá.
import { huntOuMapaCustom, gradeDaHunt } from './terreno.mjs';
import { noAndar } from './andares.mjs';
import { proximoPassoAte, distancia } from './caminho.mjs';
import { trocarDeAndar } from './monstros.mjs';

/**
 * O monstro vivo mais próximo que ainda não está perseguindo (fora do
 * `ALCANCE_DE_PERCEPCAO`) — para onde o passo automático anda enquanto está
 * "lurando" (juntando a leva, ver `atualizarLure`), puxando um de cada vez em
 * vez de brigar com o primeiro que aparece.
 */
/**
 * O `run` do `state`: em que waypoint do laço ele está. O client usa `passo`,
 * `passos` e `temRota` (o balão do botão, "waypoint N de M"). Sem percurso, nada.
 */
export function runParaCliente(estado) {
  const hunt = estado.hunt;
  const pontos = hunt?.percurso && gradeDaHunt(huntOuMapaCustom(hunt.huntId)).percurso;
  if (!pontos) return null;
  return { passo: hunt.percurso.passo, passos: pontos.length, temRota: true, voltas: hunt.percurso.voltas ?? 0 };
}

/**
 * O waypoint mais perto de `pos`, olhando `janela` waypoints para a frente a
 * partir de `de` — só os do andar `z` (o de outro andar pode estar "a 2 casas"
 * no x,y e a uma escada inteira de distância).
 */
export function waypointMaisPerto(pontos, pos, de = 0, janela = pontos.length, z = null) {
  let melhor = de;
  let menor = Infinity;
  for (let k = 0; k < Math.min(janela, pontos.length); k++) {
    const i = (de + k) % pontos.length;
    if (z != null && !noAndar(pontos[i], z)) continue;
    const d = distancia(pos, pontos[i]);
    if (d < menor) {
      menor = d;
      melhor = i;
    }
  }
  return melhor;
}

/** Quantos waypoints para a frente ele procura onde retomar o laço depois de uma briga. */
export const JANELA_PARA_RETOMAR = 40;
/** Mais longe que isto do waypoint da vez, ele se desviou (foi brigar) e retoma pelo mais perto à frente. */
export const DESVIO_DO_PERCURSO = 3;

/** Uma volta completa no percurso: conta na caçada e no personagem (`huntLaps`, o que o client mostra). */
export function completarVolta(estado, hunt, passos) {
  // Só conta a volta que foi ANDADA: pular waypoints sem caminho até o fim da
  // lista não é dar a volta (era o que dava centenas de "voltas" parado).
  const p = hunt.percurso;
  const andou = p.andou ?? 0;
  p.andou = 0;
  if (andou < Math.min(passos / 2, 20)) return;
  p.voltas = (p.voltas ?? 0) + 1;
  const voltas = (estado.huntLaps ??= {});
  voltas[hunt.huntId] = (voltas[hunt.huntId] ?? 0) + 1;
}

/**
 * O próximo passo no laço, quando não há bicho à vista. Chegou no waypoint, o
 * próximo; passou do último, volta ao primeiro e conta uma volta. Longe do
 * waypoint da vez (foi brigar), retoma pelo mais perto dos próximos
 * `JANELA_PARA_RETOMAR` — para a frente, nunca voltando o que já andou.
 * Waypoint sem caminho agora (um bicho parado em cima, um pedaço do andar
 * separado): pula para o seguinte.
 */
export function passoNoPercurso(estado, hunt, grade, casasDeBicho) {
  const pontos = grade.percurso;
  const p = hunt.percurso;
  const n = pontos.length;
  const avancar = () => {
    p.passo = (p.passo + 1) % n;
    if (p.passo === 0) completarVolta(estado, hunt, n);
  };
  // Retoma pelo mais perto só depois de uma BRIGA (`desviou`, posto por
  // `tique` quando há alvo): fora disso ele segue os waypoints em ordem. Sem
  // essa condição, num laço curto a janela dava a volta inteira e devolvia o
  // waypoint que ele acabara de pular por falta de caminho — vai-e-vem parado.
  /*
   * Waypoint da vez noutro andar: o de antes dele é a escada (a rota gravada
   * pisa nela e aparece do outro lado). Ele anda até a escada; em cima dela,
   * muda de andar e segue do waypoint onde a rota chega.
   */
  const aqui = (c) => hunt.pos.x === c.x && hunt.pos.y === c.y;
  const escadaDa = (i) => pontos[(i - 1 + n) % n];
  const metaDoAndar = () => (noAndar(pontos[p.passo], hunt.z) ? pontos[p.passo] : escadaDa(p.passo));
  if (p.desviou && distancia(hunt.pos, metaDoAndar()) > DESVIO_DO_PERCURSO) {
    const retoma = waypointMaisPerto(pontos, hunt.pos, p.passo, Math.min(JANELA_PARA_RETOMAR, n - 1), hunt.z);
    if (retoma < p.passo) completarVolta(estado, hunt, n); // retomou já na volta seguinte
    p.passo = retoma;
  }
  p.desviou = false;
  if (noAndar(pontos[p.passo], hunt.z) && aqui(pontos[p.passo])) avancar();
  let meta = pontos[p.passo];
  if (!noAndar(meta, hunt.z)) {
    const escada = escadaDa(p.passo);
    if (!noAndar(escada, hunt.z) || aqui(escada)) {
      // Na caçada em grupo quem troca de andar é o dono; o convidado espera ser levado.
      if (!trocarDeAndar(hunt, meta)) return null;
      p.andou = (p.andou ?? 0) + 1;
      avancar();
      return null;
    }
    meta = escada;
  }
  const ocupada = (c) => casasDeBicho.has(`${c.x},${c.y}`);
  const destino = proximoPassoAte(grade, hunt.pos, meta, ocupada, casasDeBicho);
  if (destino) p.andou = (p.andou ?? 0) + 1;
  else avancar();
  return destino;
}
