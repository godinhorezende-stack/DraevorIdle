/*
 * ---- A pilha do VOLTAR ----
 *
 * No telefone o botão (ou o gesto) de voltar é o jeito de sair de uma tela.
 * Aqui ele saía do JOGO: uma loja aberta, o voltar do Android, e a página ia
 * embora com o personagem no meio da caçada.
 *
 * Cada coisa que se abre por cima do jogo no telefone — modal, gaveta, folha,
 * o detalhe de uma lista — entra nesta pilha com a sua função de fechar. O
 * voltar fecha só a de cima.
 *
 * ---- UMA entrada no histórico, nunca mais ----
 *
 * A primeira versão punha uma entrada por tela e, ao fechar pelo ✕, gastava
 * a dela com `history.go(-n)`. Com telas abrindo e fechando depressa, essas
 * travessias ficavam pendentes umas sobre as outras (o navegador as executa
 * depois), e a conta escapava: uma delas passava da primeira entrada do jogo
 * e a página ia embora — o que a auditoria viu como "depois do Reportar, as
 * telas pararam de abrir".
 *
 * Agora existe no máximo UMA entrada nossa (a "guarda") acima da do jogo:
 *
 *   a pilha deixa de estar vazia   → `pushState` da guarda
 *   o voltar chega (popstate)      → fecha a de cima; se ainda sobrou alguma,
 *                                    a guarda é reposta
 *   a pilha esvazia pela tela (✕)  → `back()` uma vez, para gastar a guarda
 *
 * E nada é feito às cegas: uma volta só acontece se a entrada ATUAL for a
 * guarda (`history.state`), e enquanto uma travessia está pendente nada
 * mexe no histórico — quando ela pousa, o `popstate` reconcilia: pilha com
 * algo e sem guarda, põe; pilha vazia e com guarda, gasta. A auditoria achou
 * a corrida que isso fecha: o Esc fechava uma tela (volta pendente) e a
 * seguinte abria no mesmo instante (`pushState`); o navegador resolvia os
 * dois fora de ordem, a guarda sumia, e a volta seguinte saía da página.
 *
 * Só vale nos perfis de telefone (ver perfil.mjs). No computador ninguém usa o
 * voltar para fechar janela, e mexer no histórico lá seria surpresa.
 */
import { ehTelefone } from './perfil.mjs';

const pilha = [];
let voltasPendentes = 0;

const naGuarda = () => {
  try {
    return history.state?.draevorGuarda === true;
  } catch {
    return false;
  }
};

/** Deixa o histórico de acordo com a pilha: guarda se, e só se, há algo aberto. */
function reconciliar() {
  if (voltasPendentes > 0) return; // o `popstate` da volta pendente reconcilia
  try {
    if (pilha.length && !naGuarda()) history.pushState({ draevorGuarda: true }, '');
    else if (!pilha.length && naGuarda()) {
      voltasPendentes++;
      history.back();
    }
  } catch {
    /* histórico indisponível (iframe sandbox): a pilha segue sem o voltar */
  }
}

/** Registra `id` aberto; `fechar` é chamado quando o voltar chegar nele. */
export function abrirNaPilha(id, fechar) {
  if (!ehTelefone()) return;
  if (pilha.some((e) => e.id === id)) return;
  pilha.push({ id, fechar });
  reconciliar();
}

function tirar(quais) {
  const antes = pilha.length;
  for (let i = pilha.length - 1; i >= 0; i--) if (quais(pilha[i])) pilha.splice(i, 1);
  if (pilha.length !== antes) reconciliar();
}

/** `id` foi fechado pela própria tela (o ✕, tocar fora). */
export function fechouNaPilha(id) {
  tirar((e) => e.id === id);
}

/** Fechou junto tudo o que começa com algum dos `prefixos` (o modal e os detalhes dentro dele). */
export function fechouNaPilhaTudoQue(...prefixos) {
  tirar((e) => prefixos.some((p) => e.id.startsWith(p)));
}

export const tamanhoDaPilha = () => pilha.length;
export const topoDaPilha = () => pilha[pilha.length - 1]?.id ?? null;

globalThis.window?.addEventListener('popstate', () => {
  if (voltasPendentes > 0) {
    // Pousou a volta que nós mesmos pedimos: agora dá para conferir.
    voltasPendentes--;
    reconciliar();
    return;
  }
  // O voltar do telefone: a guarda foi consumida pelo navegador.
  const topo = pilha.pop();
  topo?.fechar();
  reconciliar();
});
