// O vigia de progresso do passo da Caça Automática: nada de A → B → B → A.
//
// ---- Por que existe ----
//
// O passo atrás do alvo (`proximoPassoAte`) e o recuo do kite (`passoDeRecuo`)
// olham só o AGORA: a melhor casa vizinha para este tique. Quando o bicho
// espelha o personagem (parede no meio, um bolso sem saída, a leva fechando
// a passagem), a melhor casa de agora é a de onde ele acabou de sair, e a de
// depois é a de antes dela — medido: 25 dos 127 mapas com um sorcerer em
// "Distância 4" andavam de lado para sempre (ahau: 31,25 ↔ 32,25 com o boss
// espelhando em cima); na perseguição, a espera de `voltariaAtras` virava
// A → B → B → A → A → B. Nenhum dos dois lembrava onde já tinha estado nem se
// estava chegando mais perto.
//
// ---- O que conta como progresso ----
//
// `falta`: quantas casas faltam para a distância que ele quer do alvo
// (corpo a corpo: colado; com "Distância" > 0: exatamente aquela, recuando
// ou chegando). Enquanto a `falta` bate um recorde novo, é progresso, e a
// memória recomeça. Sem recorde, cada casa pisada fica lembrada por
// `MEMORIA_MS`: um passo que VOLTA a uma delas é um ciclo — A → B → A,
// A → B → B → A, A → B → C → A, qualquer tamanho —, porque um caminho de
// verdade (a BFS até um alvo parado) nunca repassa por uma casa.
//
// ---- Quando detecta ----
//
// Procura, a até `RAIO_DO_DESVIO` passos a pé (retos e diagonais, que o jogo
// já anda — ver `VIZINHANCA_8`), uma casa andável, livre, ainda não tentada,
// de onde ele alcança o alvo e que seja MELHOR que tudo o que o ciclo já deu
// (`falta` abaixo do recorde). Achou: vai até ela (`desvio`), mesmo que seja
// a mais de uma casa, contornando o obstáculo. Um desvio que chega lá sem
// bater o recorde (o alvo fugiu de novo) também é tentativa perdida, e depois
// de `DESVIOS_SEM_PROGRESSO` delas ele não procura mais. Não achou: fica
// PARADO — e parado bate no que alcança, o bicho que persegue chega sozinho.
//
// ---- Quando tenta de novo ----
//
// Parado (por ciclo ou por não haver caminho), guarda a `assinatura` da
// situação (onde ele está, onde está o alvo, os bichos em volta, o andar).
// Enquanto ela for a mesma, o tique nem chama o pathfinding (`aindaTravado`)
// — o custo de ficar travado é montar e comparar um texto por passo. Mudou
// (o alvo andou, um bicho saiu do caminho, ele mudou de andar), avalia de novo.
import { bfsDistancias, distancia, proximoPassoAte, VIZINHANCA_8 } from './caminho.mjs';

/** Quanto tempo (relógio da caçada) uma casa que não trouxe progresso fica lembrada. */
export const MEMORIA_MS = 12_000;
/** Até quantos passos a pé ele procura uma casa melhor para sair do ciclo. */
export const RAIO_DO_DESVIO = 6;
/**
 * Desvios que terminaram sem bater o recorde (o alvo fugiu de novo) também são
 * tentativas sem progresso: passado este número, dentro da mesma memória, ele
 * não sai mais procurando — fica parado até a situação melhorar de verdade.
 */
export const DESVIOS_SEM_PROGRESSO = 2;
/** Teto de casas lembradas — o estado viaja no `hunt` (banco, worker), tem de ser pequeno. */
const MAXIMO_DE_CASAS = 32;

const chave = (p) => `${p.x},${p.y}`;

/** Quantas casas faltam para a distância desejada do alvo (0 = já está onde quer). */
export function faltaAte(pos, alvo, quer, kite) {
  const d = distancia(pos, alvo);
  return kite ? Math.abs(d - quer) : Math.max(0, d - quer);
}

/*
 * A situação em que ele parou: igual a esta, nada mudou e não vale procurar de
 * novo. Os bichos que contam são os que podem estar no caminho (até a
 * distância do alvo mais a folga do desvio); o mapa em si não muda.
 */
function assinatura(hunt, alvo) {
  const raio = distancia(hunt.pos, alvo) + RAIO_DO_DESVIO + 2;
  const perto = [];
  for (const m of hunt.monstros) {
    if (m.hp > 0 && m !== alvo && distancia(m, hunt.pos) <= raio) perto.push(chave(m));
  }
  return `${chave(hunt.pos)}|${hunt.z ?? ''}|${alvo.uid}@${chave(alvo)}|${perto.sort().join(';')}`;
}

/**
 * Parado por falta de caminho ou de saída, e nada mudou desde então? Quem
 * chama pula o pathfinding inteiro neste tique — o mesmo caminho impossível
 * não é recalculado a cada 250 ms.
 */
export function aindaTravado(hunt, alvo) {
  const p = hunt.progresso;
  return !!p?.travado && p.uid === alvo.uid && !p.desvio && p.travado === assinatura(hunt, alvo);
}

function lembrar(p, casa, agora) {
  p.casas[chave(casa)] = agora + MEMORIA_MS;
  const k = Object.keys(p.casas);
  if (k.length > MAXIMO_DE_CASAS) {
    k.sort((a, b) => p.casas[a] - p.casas[b]);
    for (const velha of k.slice(0, k.length - MAXIMO_DE_CASAS)) delete p.casas[velha];
  }
}

/**
 * A casa para onde ir quando o passo de agora fecharia um ciclo — ou `null`.
 * Uma BFS a partir dele (até `RAIO_DO_DESVIO`) e outra a partir do alvo (para
 * saber de onde ainda se chega nele), só no momento em que o ciclo aparece.
 */
function casaParaSair(hunt, grade, alvo, p, { quer, kite, bloqueado }) {
  const minhas = bfsDistancias(grade, hunt.pos, RAIO_DO_DESVIO, null, VIZINHANCA_8, bloqueado);
  const doAlvo = bfsDistancias(grade, alvo, RAIO_DO_DESVIO + quer + distancia(hunt.pos, alvo) + 1, null, VIZINHANCA_8, bloqueado);
  let melhor = null;
  let melhorNota = Infinity;
  for (let dy = -RAIO_DO_DESVIO; dy <= RAIO_DO_DESVIO; dy++) {
    for (let dx = -RAIO_DO_DESVIO; dx <= RAIO_DO_DESVIO; dx++) {
      if (!dx && !dy) continue;
      const c = { x: hunt.pos.x + dx, y: hunt.pos.y + dy };
      const aPe = minhas.em(c.x, c.y);
      if (aPe == null || aPe === 0) continue; // não chega lá (parede, bicho no caminho)
      if (p.casas[chave(c)] != null) continue; // já provou que não adianta
      if (c.x === alvo.x && c.y === alvo.y) continue;
      if (doAlvo.em(c.x, c.y) == null) continue; // de lá não se alcança o alvo
      const f = faltaAte(c, alvo, quer, kite);
      if (f >= p.melhor) continue; // não é melhor do que o ciclo já deu
      const nota = f * 100 + aPe;
      if (nota < melhorNota) {
        melhorNota = nota;
        melhor = c;
      }
    }
  }
  return melhor;
}

/**
 * Filtra o passo que o tique escolheu (`destino`, ou `null`) atrás de `alvo`.
 * Devolve o passo a dar de fato: o mesmo, o primeiro passo de um desvio, ou
 * `null` (ficar parado). `quer` é a distância desejada; `kite`, se ele também
 * recua (Distância > 0); `ocupado`/`bloqueado`, os bichos, como no passo.
 */
export function passoComProgresso(hunt, grade, alvo, destino, { quer, kite = false, ocupado = null, bloqueado = null }) {
  const agora = hunt.clock ?? 0;
  const fAgora = faltaAte(hunt.pos, alvo, quer, kite);
  let p = hunt.progresso;
  if (!p || p.uid !== alvo.uid || p.z !== (hunt.z ?? null)) {
    p = hunt.progresso = { uid: alvo.uid, z: hunt.z ?? null, melhor: fAgora, casas: {}, falhas: [], travado: null, desvio: null };
    lembrar(p, hunt.pos, agora);
  }
  for (const [k, ate] of Object.entries(p.casas)) if (ate <= agora) delete p.casas[k];
  p.falhas = (p.falhas ?? []).filter((ate) => ate > agora);
  if (fAgora < p.melhor) {
    // Chegou mais perto do que nunca: é progresso, a memória recomeça daqui.
    Object.assign(p, { melhor: fAgora, casas: {}, falhas: [], travado: null, desvio: null });
    lembrar(p, hunt.pos, agora);
  }
  // Um desvio em andamento: segue até a casa escolhida (pode repassar pelas lembradas).
  if (p.desvio) {
    const livre = grade.andavel.has(chave(p.desvio)) && !ocupado?.(p.desvio);
    const passo = livre && !(p.desvio.x === hunt.pos.x && p.desvio.y === hunt.pos.y) ? proximoPassoAte(grade, hunt.pos, p.desvio, ocupado, bloqueado) : null;
    if (passo) {
      lembrar(p, passo, agora);
      return passo;
    }
    // Chegou (ou o caminho fechou) e o recorde não caiu — senão a memória já teria recomeçado acima.
    p.desvio = null;
    p.falhas.push(agora + MEMORIA_MS);
  }
  if (!destino) {
    // Sem passo nenhum (sem caminho até o alvo): fica, e lembra da situação.
    p.travado = assinatura(hunt, alvo);
    return null;
  }
  if (p.casas[chave(destino)] == null) {
    // Casa nova: é tentativa legítima.
    p.travado = null;
    lembrar(p, destino, agora);
    return destino;
  }
  // O passo voltaria a uma casa que já não deu em nada: é um ciclo.
  const aqui = assinatura(hunt, alvo);
  if (p.travado === aqui) return null; // nada mudou desde que parou: nem procura
  const saida = p.falhas.length < DESVIOS_SEM_PROGRESSO ? casaParaSair(hunt, grade, alvo, p, { quer, kite, bloqueado }) : null;
  if (saida) {
    p.desvio = saida;
    const passo = proximoPassoAte(grade, hunt.pos, saida, ocupado, bloqueado);
    if (passo) {
      p.travado = null;
      lembrar(p, passo, agora);
      return passo;
    }
    p.desvio = null;
  }
  p.travado = aqui;
  return null;
}
