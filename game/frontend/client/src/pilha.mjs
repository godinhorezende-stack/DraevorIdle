/*
 * ---- A pilha do VOLTAR ----
 *
 * No telefone o botão (ou o gesto) de voltar é o jeito de sair de uma tela.
 * Aqui ele saía do JOGO: uma loja aberta, o voltar do Android, e a página ia
 * embora com o personagem no meio da caçada.
 *
 * Cada coisa que se abre por cima do jogo no telefone — modal, gaveta, folha —
 * entra nesta pilha com a sua função de fechar, e ganha uma entrada no
 * histórico do navegador. O voltar tira a entrada de cima e fecha só ela.
 *
 * Quem fecha pela própria tela (o ✕, tocar fora) avisa com `fechouNaPilha`, e
 * a entrada correspondente do histórico é consumida em silêncio — senão o
 * próximo voltar não fecharia nada, só "gastaria" a entrada velha.
 *
 * Só vale nos perfis de telefone (ver perfil.mjs). No computador ninguém usa o
 * voltar para fechar janela, e mexer no histórico lá seria surpresa.
 */
import { ehTelefone } from './perfil.mjs';

const pilha = [];
let popsAIgnorar = 0;

/** Registra `id` aberto; `fechar` é chamado quando o voltar chegar nele. */
export function abrirNaPilha(id, fechar) {
  if (!ehTelefone()) return;
  if (pilha.some((e) => e.id === id)) return;
  pilha.push({ id, fechar });
  try {
    history.pushState({ draevorPilha: pilha.length }, '');
  } catch {
    /* histórico indisponível (iframe sandbox): a pilha segue sem o voltar */
  }
}

/** `id` foi fechado pela própria tela: tira da pilha e consome a entrada do histórico. */
export function fechouNaPilha(id) {
  const i = pilha.findIndex((e) => e.id === id);
  if (i < 0) return;
  pilha.splice(i, 1);
  popsAIgnorar++;
  try {
    history.back();
  } catch {
    popsAIgnorar--;
  }
}

export const tamanhoDaPilha = () => pilha.length;
export const topoDaPilha = () => pilha[pilha.length - 1]?.id ?? null;

globalThis.window?.addEventListener('popstate', () => {
  if (popsAIgnorar > 0) {
    popsAIgnorar--;
    return;
  }
  const topo = pilha.pop();
  topo?.fechar();
});
