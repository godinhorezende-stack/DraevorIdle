/*
 * ---- LISTA → DETALHE no telefone ----
 *
 * Bestiary, itens da Cyclopedia, magias, proficiência: todas são uma lista
 * com o detalhe do escolhido AO LADO. No computador as duas colunas cabem; no
 * telefone a auditoria mediu a coluna do detalhe com 30px e o texto quebrando
 * letra a letra ("Esco / lha / uma…").
 *
 * No telefone as duas passam a ser duas TELAS: a lista, e ao escolher, só o
 * detalhe — com "← Lista" em cima e o voltar do Android fazendo o mesmo. A
 * tela continua sendo a mesma função de desenho; isto só diz qual das duas
 * metades aparece (`.lista-detalhe` / `.mostrando-detalhe` no CSS).
 */
import { ehTelefone } from './perfil.mjs';
import { abrirNaPilha, fechouNaPilha } from './pilha.mjs';

/**
 * @param layout   o contêiner das duas colunas
 * @param detalhe  a coluna do detalhe (recebe o "← Lista")
 * @param id       nome curto da tela, para a pilha do voltar
 * @param escolhido há algo escolhido (mostra o detalhe)
 * @param voltar   desfaz a escolha e redesenha (mostra a lista)
 */
export function listaDetalhe(layout, detalhe, { id, escolhido, voltar, rotulo = '← Lista' }) {
  if (!ehTelefone() || !layout) return;
  layout.classList.add('lista-detalhe');
  detalhe?.classList.add('detalhe-da-lista');
  layout.classList.toggle('mostrando-detalhe', !!escolhido);
  const chave = `detalhe:${id}`;
  if (!escolhido) {
    fechouNaPilha(chave);
    return;
  }
  if (detalhe && !detalhe.querySelector(':scope > .detalhe-voltar')) {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'detalhe-voltar';
    botao.textContent = rotulo;
    botao.onclick = () => {
      fechouNaPilha(chave);
      voltar();
    };
    detalhe.prepend(botao);
  }
  abrirNaPilha(chave, voltar);
  // O detalhe começa do topo, e não da altura em que a lista estava rolada.
  requestAnimationFrame(() => layout.closest('#modal-body')?.scrollTo?.({ top: 0 }));
}
