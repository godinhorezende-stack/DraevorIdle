// O TREINO saiu do jogo (dono, 06/10: "Boneco de treino e Exercise Dummy também sai" — e o treino offline junto). Não há mais pátio com
// boneco, Exercise (as armas de carga) nem treino offline: a perícia só sobe usando, caçando.
//
// Este módulo só ARRUMA quem ainda tinha algo disso gravado, ao entrar no jogo (`limpar`, uma vez por login, idempotente):
//   - o treino em andamento (o pátio, o Exercise na mão, o treino offline) acaba, sem relatório nem ganho;
//   - as armas de Exercise e o Scroll Speed Exercise saem (dono: "só saem da mochila e não devolve nada, porque o jogo é beta") — da
//     mochila, da bolsa de loot e do Depósito (Chegadas incluídas), onde quer que estejam com o personagem.
import { STORE_REAL } from './dados.mjs';

/** As armas de Exercise (a prateleira da Store) e o Scroll Speed Exercise. */
// (+ o Scroll Speed Exercise 55386, a Boosted Exercise Box 55595 e os Pacotes Treinador 55591/55592, que só traziam isso.)
const ITENS_DE_TREINO = new Set([...(STORE_REAL.exercises ?? []).map((e) => Number(e.itemId)), 55386, 55595, 55591, 55592]);
export const ehItemDeTreino = (id) => ITENS_DE_TREINO.has(Number(id));

/** Tira o treino do personagem. Devolve quantas coisas mudaram (0 = já estava limpo). */
export function limpar(estado) {
  if (!estado) return 0;
  let n = 0;
  for (const campo of ['training', 'exercicio', 'treinoTanque', 'scrollExercise', 'treinoPendente']) {
    if (campo in estado) {
      delete estado[campo];
      n++;
    }
  }
  // A trilha de ARMAS DE TREINO das recompensas de nível sai (a dos marcos de equipamento fica e segue a fila).
  if (estado.presentes?.degraus?.length) {
    estado.presentes.degraus = [];
    n++;
  }
  // Estava no pátio (a hunt 'treino'): volta para a cidade, de onde saiu (a posição da cidade nunca mudou).
  if (estado.hunt?.huntId === 'treino') {
    estado.hunt = null;
    estado.rumo = null;
    n++;
  }
  const semTreino = (lista) => {
    if (!Array.isArray(lista)) return lista;
    const ficam = lista.filter((p) => !ehItemDeTreino(p?.id));
    n += lista.length - ficam.length;
    return ficam;
  };
  estado.inventory = semTreino(estado.inventory);
  estado.pouch = semTreino(estado.pouch);
  for (const caixa of estado.deposito ?? []) {
    caixa.itens = semTreino(caixa.itens);
    if (Array.isArray(caixa.itens)) caixa.tipos = caixa.itens.length;
  }
  return n;
}
