/*
 * ---- Escrever o que já está escrito não mexe na página ----
 *
 * "quero otimizar mais o jogo ... como diminuir mais o lag" — medido numa
 * caçada (MutationObserver, 5 s, personagem parado caçando): ~250 mudanças por
 * segundo no documento, e boa parte delas era a interface regravando o MESMO
 * valor a cada quadro do servidor — o ouro, o nome, a vocação, o "Stop", o
 * `hidden` de dez faixas que continuavam escondidas, o `title` e a classe de
 * botões que não mudaram. Para o navegador, gravar o mesmo texto troca o nó de
 * texto; gravar o mesmo atributo é uma mudança de atributo. As duas invalidam o
 * estilo, e o recálculo de estilo era a maior fatia do quadro (~140 ms por
 * segundo depois das outras correções).
 *
 * Corrigir cada linha que grava seriam centenas de pontos espalhados pelo
 * client — e a próxima tela escrita esqueceria. Aqui a regra vale para todas:
 * as escritas mais comuns da interface passam a não fazer nada quando o valor
 * já é o mesmo. O resultado na tela é idêntico por definição (nada muda); o
 * que some é o trabalho do navegador.
 *
 * Carregado ANTES de tudo, no topo do main.mjs.
 */

function travar(prototipo, nome, igual) {
  const d = Object.getOwnPropertyDescriptor(prototipo, nome);
  if (!d?.set || !d.get) return;
  Object.defineProperty(prototipo, nome, {
    ...d,
    set(valor) {
      if (igual(this, d.get.call(this), valor)) return;
      d.set.call(this, valor);
    },
  });
}

if (typeof Node !== 'undefined' && !globalThis.__soQuandoMuda) {
  globalThis.__soQuandoMuda = true;

  /*
   * `textContent`: só é pulado quando o elemento já tem EXATAMENTE aquele texto
   * como único filho de texto (ou nada, e o valor é vazio). Com qualquer outro
   * filho dentro, gravar apaga os filhos — isso é mudança, e segue normal.
   */
  travar(Node.prototype, 'textContent', (no, _atual, valor) => {
    const texto = valor == null ? '' : String(valor);
    const filhos = no.childNodes;
    if (!filhos) return false;
    if (filhos.length === 0) return texto === '';
    return filhos.length === 1 && filhos[0].nodeType === 3 && filhos[0].data === texto;
  });

  // Booleanos e textos refletidos em atributo: igual é igual.
  travar(HTMLElement.prototype, 'hidden', (_no, atual, valor) => atual === !!valor);
  travar(HTMLElement.prototype, 'title', (_no, atual, valor) => atual === String(valor ?? ''));
  travar(Element.prototype, 'className', (_no, atual, valor) => atual === String(valor ?? ''));
  for (const P of [HTMLButtonElement, HTMLInputElement, HTMLSelectElement, HTMLTextAreaElement, HTMLOptionElement]) {
    travar(P.prototype, 'disabled', (_no, atual, valor) => atual === !!valor);
  }

  const setAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (nome, valor) {
    if (this.getAttribute(nome) === String(valor)) return;
    return setAttribute.call(this, nome, valor);
  };
}
