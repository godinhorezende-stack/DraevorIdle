/*
 * ---- Que tela é esta: o PERFIL, decidido num lugar só ----
 *
 * A auditoria do celular (8 tamanhos, de 360×640 a 915×412) mostrou o mesmo
 * defeito de raiz em quase toda tela: a interface do computador espremida. O
 * conserto é o celular ter a SUA organização — e para isso cada parte do
 * cliente precisa responder à mesma pergunta do mesmo jeito: "estou num
 * telefone em pé, num telefone deitado, num tablet ou no computador?"
 *
 * Quatro perfis:
 *
 *   retrato   telefone em pé (largura < 600)
 *   deitado   telefone deitado (altura < 540)
 *   tablet    tela de toque/estreita que não é nenhum dos dois: segue com o
 *             arranjo de gavetas que já existia
 *   desktop   o de sempre, intocado
 *
 * "É celular?" continua sendo do CSS (`--e-celular`, ver `ehCelular` em
 * mobile.mjs): aqui só se divide o celular em três. O perfil vai para
 * `<html data-perfil="...">`, onde o CSS da casca se pendura, e quem precisa
 * reagir escuta o evento `draevor:perfil`.
 */
import { ehCelular } from './mobile.mjs';

let atual = null;

export function calcularPerfil({ celular, largura, altura }) {
  if (!celular) return 'desktop';
  if (largura < altura && largura < 600) return 'retrato';
  if (largura >= altura && altura < 540) return 'deitado';
  return 'tablet';
}

export const perfil = () => atual ?? aplicarPerfil();

/** O perfil é um dos dois de telefone (os que têm a casca nova). */
export const ehTelefone = () => perfil() === 'retrato' || perfil() === 'deitado';

export function aplicarPerfil() {
  const novo = calcularPerfil({ celular: ehCelular(), largura: innerWidth, altura: innerHeight });
  if (novo === atual) return atual;
  const antes = atual;
  atual = novo;
  document.documentElement.dataset.perfil = novo;
  if (antes) window.dispatchEvent(new CustomEvent('draevor:perfil', { detail: { perfil: novo, antes } }));
  return novo;
}

let ligado = false;
export function ligarPerfil() {
  if (ligado) return;
  ligado = true;
  aplicarPerfil();
  // Girar o telefone: `resize` na maioria, `orientationchange` nos que giram
  // sem mudar a medida na hora.
  window.addEventListener('resize', aplicarPerfil);
  window.addEventListener('orientationchange', () => setTimeout(aplicarPerfil, 60));
}
