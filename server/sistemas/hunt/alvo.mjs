// Quem é o alvo: escolha e trava por caminho a pé, corredor do percurso, espera pelo bicho que vem.
// Parte de `cacadas.mjs` (dividido em 2026-09-25); a fachada continua lá.
import { huntOuMapaCustom, gradeDaHunt } from './terreno.mjs';
import { andarDaGrade, noAndar } from './andares.mjs';
import { bfsDistancias, distancia } from './caminho.mjs';
import { ALCANCE_DE_PERCEPCAO, ALCANCE_DE_PERSEGUICAO } from './monstros.mjs';

/** O alvo de verdade agora: o escolhido por clique, ou (estratégia "nearest") o mais perto vivo. */
export function alvoAtual(hunt) {
  if (hunt.alvo != null) {
    const m = hunt.monstros.find((m) => m.uid === hunt.alvo);
    if (m) return m;
    hunt.alvo = null;
  }
  // Com percurso, só conta quem está à vista (ou já vindo atrás): o de longe
  // fica para quando o laço passar por ele. Sem percurso (mapa gerado, sala de
  // boss), o mais perto de qualquer lugar, como sempre — senão ele pararia.
  // E quem já se mostrou sem caminho (`semCaminhoAte`) fica de fora um tempo.
  /*
   * ---- Perto é perto A PÉ ----
   *
   * "ficou bugado indo e voltando": um bicho a 7 casas em linha reta, do outro
   * lado de uma parede, era o "mais perto". Ele andava de lado tentando chegar
   * no personagem, o personagem andava de lado espelhando, e os dois dançavam
   * até a perseguição desistir (15 s). Com percurso, a escolha e a trava usam
   * o caminho de verdade pela caverna (`aPe`): quem só se alcança dando a volta
   * por mais de `ALCANCE_DO_COMPROMISSO` passos não é alvo.
   */
  const aPe = hunt.percurso ? distanciasAPe(hunt) : null;
  const passos = (m) => (aPe ? aPe.em(m.x, m.y) ?? Infinity : distancia(hunt.pos, m));
  const aoAlcance = (m) =>
    !hunt.percurso ||
    (distancia(hunt.pos, m) <= (m.perseguindo ? ALCANCE_DE_PERSEGUICAO : ALCANCE_DE_PERCEPCAO) &&
      passos(m) <= ALCANCE_DO_COMPROMISSO &&
      (m.semCaminhoAte ?? 0) <= (hunt.clock ?? 0) &&
      noCorredor(hunt, m));
  const vivos = hunt.monstros.filter((m) => m.hp > 0 && aoAlcance(m));
  const perto = (a, b) => passos(a) - passos(b);
  // "Menos vida"/"Mais vida" é em PORCENTAGEM (o `title` da opção no client),
  // entre quem já está por perto — um bicho do outro lado do mapa não conta.
  const aVista = vivos.filter((m) => distancia(hunt.pos, m) <= ALCANCE_DE_PERCEPCAO);
  const pct = (m) => m.hp / Math.max(1, m.maxHp ?? m.hp);
  /*
   * ---- Com percurso, escolheu, vai até o fim ----
   *
   * Sem isto ele oscilava: um bicho a 8 casas entrava "à vista", o caminho até
   * ele dava a volta por trás de uma parede, andando esse caminho o bicho saía
   * das 8 casas, ele voltava para o laço, o bicho entrava de novo... (medido
   * na Cobra Bastion: três minutos indo e vindo entre duas casas, sem nunca
   * chegar no waypoint). Agora o bicho escolhido fica sendo o alvo enquanto
   * estiver vivo, a até `ALCANCE_DO_COMPROMISSO` casas e com caminho — quem
   * desiste dele é `tique`, se a perseguição passar de `PERSEGUICAO_MAXIMA_MS`.
   */
  if (hunt.percurso && hunt.alvoTravado != null) {
    const m = hunt.monstros.find((b) => b.uid === hunt.alvoTravado);
    if (m && m.hp > 0 && passos(m) <= ALCANCE_DO_COMPROMISSO && (m.semCaminhoAte ?? 0) <= (hunt.clock ?? 0)) return m;
    // Largou porque o caminho até ele AFASTA (a volta por trás da parede passa
    // das 16 casas — Black Serpent: 8 → 17 casas indo atrás de um Lizard
    // Chosen): o bicho fica de fora um tempo, senão a 8 casas ele seria
    // escolhido de novo e o vai-e-vem recomeçava.
    if (m && m.hp > 0) m.semCaminhoAte = (hunt.clock ?? 0) + 20_000;
    hunt.alvoTravado = null;
  }
  let escolhido;
  if (hunt.strategy === 'lowest' && aVista.length) escolhido = aVista.sort((a, b) => pct(a) - pct(b) || perto(a, b))[0];
  else if (hunt.strategy === 'highest' && aVista.length) escolhido = aVista.sort((a, b) => pct(b) - pct(a) || perto(a, b))[0];
  else escolhido = vivos.sort(perto)[0] ?? null;
  if (hunt.percurso && escolhido) hunt.alvoTravado = escolhido.uid;
  return escolhido;
}

/*
 * ---- O corredor do percurso ----
 *
 * Com bicho nascendo por toda parte sempre havia um a 8 casas, e ele ia de um
 * para o outro atravessando a caverna inteira sem nunca voltar ao laço (medido
 * na Drefia Wyrm Caves: o waypoint parado no 169 por 10 minutos, com 500
 * mortes pelo mapa todo). A Caça Automática SEGUE o percurso e briga com o que
 * está no caminho: bicho novo só vira alvo se estiver a até `CORREDOR` casas
 * do trecho do laço por onde ele está passando. Quem vem atrás dele entra no
 * corredor sozinho, porque o corredor anda junto.
 */
export const CORREDOR = 5;
export const TRECHO_ANTES = 5;
export const TRECHO_DEPOIS = 15;
export function noCorredor(hunt, m) {
  const pontos = gradeDaHunt(huntOuMapaCustom(hunt.huntId)).percurso;
  if (!pontos) return true;
  const n = pontos.length;
  for (let k = -TRECHO_ANTES; k <= TRECHO_DEPOIS; k++) {
    const p = pontos[(((hunt.percurso.passo + k) % n) + n) % n];
    if (noAndar(p, hunt.z) && distancia(p, m) <= CORREDOR) return true;
  }
  return distancia(hunt.pos, m) <= 2; // colado nele, briga de qualquer jeito
}

/*
 * Os passos a pé do personagem até cada casa, até `ALCANCE_DO_COMPROMISSO` —
 * uma busca por posição/andar e guardada até ele sair do lugar: `alvoAtual` é
 * chamado várias vezes no mesmo tique (passo, golpe, familiar, `state`).
 */
export function distanciasAPe(hunt) {
  const chave = `${hunt.pos.x},${hunt.pos.y},${hunt.z}`;
  const guardada = hunt.aPeGuardado;
  if (guardada?.chave === chave) return guardada.dist;
  const grade = andarDaGrade(gradeDaHunt(huntOuMapaCustom(hunt.huntId)), hunt.z);
  const dist = bfsDistancias(grade, hunt.pos, ALCANCE_DO_COMPROMISSO + 1);
  Object.defineProperty(hunt, 'aPeGuardado', { value: { chave, dist }, enumerable: false, writable: true, configurable: true });
  return dist;
}

/*
 * ---- O bicho já vem: espera ele chegar ----
 *
 * Com os dois andando um para o outro ao mesmo tempo, numa caverna de parede
 * no meio, cada um seguia o caminho do outro e eles espelhavam (Kina na
 * Winter Dream Court: 66,57 ↔ 67,57 com o bicho três casas ao norte). Quando
 * o passo atrás de um bicho que já vem (`perseguindo`) desfaria o passo
 * anterior, ele PARA e espera — como no Tibia —, enquanto o caminho a pé do
 * bicho até ele encurta. Passado `ESPERA_PELO_ALVO_MS` sem encurtar (preso,
 * sem caminho), volta a ir buscar. Esperar SEMPRE que o bicho vem deixava a
 * caça na metade do ritmo (Werehyaenna North: 366 → 142 mortes em 10 min):
 * a espera é só para o vai-e-volta.
 */
export const ESPERA_PELO_ALVO_MS = 1500;
/** E nunca mais que isto parado, mesmo com o bicho ainda chegando: a caça não pode empacar. */
export const ESPERA_MAXIMA_MS = 1750;
export function esperaOAlvoChegar(hunt, alvo) {
  const e = hunt.esperandoAlvo;
  if (!e || e.uid !== alvo.uid || !alvo.perseguindo) return false;
  const agora = hunt.clock ?? 0;
  const passos = distanciasAPe(hunt).em(alvo.x, alvo.y) ?? Infinity;
  if (passos < e.menor) Object.assign(e, { menor: passos, desde: agora });
  if (agora - e.desde < ESPERA_PELO_ALVO_MS && agora - e.inicio < ESPERA_MAXIMA_MS) return true;
  hunt.esperandoAlvo = null;
  // Esperou o que dava: o próximo passo não conta como "voltar atrás", senão
  // uma espera emendava na outra e ele ficava parado.
  hunt.casaAnterior = null;
  return false;
}
/** O passo `destino` atrás de `alvo` desfaz o anterior? Então começa a esperar (ver acima). */
export function voltariaAtras(hunt, alvo, destino) {
  const antes = hunt.casaAnterior;
  if (!hunt.percurso || !alvo.perseguindo || !destino || !antes || destino.x !== antes.x || destino.y !== antes.y) return false;
  const passos = distanciasAPe(hunt).em(alvo.x, alvo.y) ?? Infinity;
  hunt.esperandoAlvo = { uid: alvo.uid, menor: passos, desde: hunt.clock ?? 0, inicio: hunt.clock ?? 0 };
  return true;
}

/** Até onde ele segue um bicho já escolhido (a Caça Automática com percurso). */
export const ALCANCE_DO_COMPROMISSO = 16;
/** Perseguindo o mesmo bicho sem chegar nele por mais que isto, desiste (sem caminho de verdade). */
export const PERSEGUICAO_MAXIMA_MS = 15_000;
