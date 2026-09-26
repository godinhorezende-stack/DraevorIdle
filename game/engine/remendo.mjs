/*
 * ---- O REMENDO: o que mudou DENTRO de um campo do delta ----
 *
 * Os dois lados do mesmo acordo, num arquivo só: o servidor monta a árvore de
 * textos e o remendo (`arvoreDeTexto`, `remendoEntre`, usados no `pushState`) e
 * o navegador aplica (`aplicarRemendo`, usado no `applyState`). Morar junto é o
 * que impede os dois de discordarem do formato:
 *
 *   { "=": valor }                         troca o valor inteiro
 *   { "~": { chave: remendo }, "-": [..] } junta chave a chave; "-" são as que saíram
 *   { "~": { 3: remendo }, "#": 12 }       o mesmo numa lista, que continua com 12
 *
 * O porquê (e o que foi medido) está no comentário de `FUNDO_DO_PERSONAGEM`, no
 * index do servidor. O teste é `tools/test-remendo.mjs`.
 */

export const ehFolhaDoJson = (valor) =>
  valor === null || typeof valor !== 'object' || typeof valor.toJSON === 'function';

/** O texto de `valor` como o `JSON.stringify` faria, com o de cada filho guardado até `fundo` níveis. */
export function arvoreDeTexto(valor, fundo) {
  if (fundo <= 0 || ehFolhaDoJson(valor)) return { t: JSON.stringify(valor) ?? 'null' };
  const filhos = new Map();
  if (Array.isArray(valor)) {
    let texto = '[';
    for (let i = 0; i < valor.length; i++) {
      const item = valor[i];
      // Na lista, o que o JSON não sabe escrever vira `null` — como no `stringify`.
      const filho =
        item === undefined || typeof item === 'function' || typeof item === 'symbol'
          ? { t: 'null' }
          : arvoreDeTexto(item, fundo - 1);
      filhos.set(i, filho);
      texto += (i ? ',' : '') + filho.t;
    }
    return { t: `${texto}]`, filhos, lista: true };
  }
  let texto = '{';
  let primeiro = true;
  for (const chave of Object.keys(valor)) {
    const item = valor[chave];
    // No objeto, some — como no `stringify`.
    if (item === undefined || typeof item === 'function' || typeof item === 'symbol') continue;
    const filho = arvoreDeTexto(item, fundo - 1);
    filhos.set(chave, filho);
    texto += `${primeiro ? '' : ','}${JSON.stringify(chave)}:${filho.t}`;
    primeiro = false;
  }
  return { t: `${texto}}`, filhos, lista: false };
}

/**
 * O remendo que leva `velha` a `nova` (cujo valor é `valor`), com o tamanho
 * aproximado dele em bytes. `null` quando não mudou nada.
 */
export function remendoEntre(velha, nova, valor) {
  if (velha.t === nova.t) return null;
  // `{"=":` + valor + `}`
  const inteiro = { r: { '=': valor ?? null }, bytes: nova.t.length + 6 };
  if (!velha.filhos || !nova.filhos || velha.lista !== nova.lista) return inteiro;
  if (nova.lista && velha.filhos.size !== nova.filhos.size) return inteiro;
  if (!nova.lista && !mesmaOrdem(velha, nova)) return inteiro;
  const dentro = {};
  // `{"~":{` + ... + `}}`, e uma vírgula entre as partes.
  let bytes = 8;
  let partes = 0;
  for (const [chave, filha] of nova.filhos) {
    const antes = velha.filhos.get(chave);
    const valorDoFilho = valor[chave];
    const parte = antes
      ? remendoEntre(antes, filha, valorDoFilho)
      : { r: { '=': valorDoFilho ?? null }, bytes: filha.t.length + 6 };
    if (!parte) continue;
    dentro[chave] = parte.r;
    bytes += JSON.stringify(String(chave)).length + 1 + parte.bytes + (partes++ ? 1 : 0);
    if (bytes >= inteiro.bytes) return inteiro;
  }
  const r = { '~': dentro };
  if (nova.lista) {
    r['#'] = nova.filhos.size;
    bytes += 5 + String(nova.filhos.size).length;
  } else {
    let fora = null;
    for (const chave of velha.filhos.keys()) {
      if (nova.filhos.has(chave)) continue;
      bytes += JSON.stringify(chave).length + (fora ? 1 : 7);
      (fora ??= []).push(chave);
    }
    if (fora) r['-'] = fora;
  }
  return bytes >= inteiro.bytes ? inteiro : { r, bytes };
}

/*
 * ---- A ORDEM das chaves também tem de sair igual ----
 *
 * Do outro lado a chave nova entra no FIM do objeto (é o que o espalhamento e a
 * atribuição fazem) e a que saiu some do meio. Se o objeto novo daqui tem outra
 * ordem — alguém o remontou ordenado, uma chave voltou para o lugar antigo —, o
 * remendo daria os mesmos valores numa ordem diferente, e tela que percorre o
 * objeto sem ordenar mostraria outra coisa. Então o remendo só vale quando a
 * ordem que o navegador vai montar é a desta árvore; senão vai inteiro.
 */
function mesmaOrdem(velha, nova) {
  let mudouAsChaves = velha.filhos.size !== nova.filhos.size;
  if (!mudouAsChaves) {
    // O caso de quase sempre: as mesmas chaves. Compara na ordem, sem montar nada.
    const antes = velha.filhos.keys();
    for (const chave of nova.filhos.keys()) {
      const deAntes = antes.next().value;
      if (deAntes === chave) continue;
      if (!velha.filhos.has(chave)) {
        mudouAsChaves = true;
        break;
      }
      return false;
    }
    if (!mudouAsChaves) return true;
  }
  const montado = {};
  for (const chave of velha.filhos.keys()) if (nova.filhos.has(chave)) montado[chave] = 0;
  for (const chave of nova.filhos.keys()) montado[chave] = 0;
  let i = 0;
  const ordem = Object.keys(montado);
  for (const chave of nova.filhos.keys()) if (ordem[i++] !== chave) return false;
  return true;
}

/**
 * Aplica `remendo` sobre `velho` e devolve o valor novo, sem mexer em `velho`:
 * cada nível que muda vira um objeto (ou lista) NOVO. Lança erro quando a base
 * não é a que o remendo espera — quem chama decide o que fazer.
 */
export function aplicarRemendo(velho, remendo) {
  if (Object.hasOwn(remendo, '=')) return remendo['='];
  if (velho === null || typeof velho !== 'object') throw new Error('remendo sem base');
  const dentro = remendo['~'] ?? {};
  if (Object.hasOwn(remendo, '#')) {
    if (!Array.isArray(velho) || velho.length !== remendo['#']) throw new Error('lista de outro tamanho');
    const nova = velho.slice();
    for (const chave of Object.keys(dentro)) nova[Number(chave)] = aplicarRemendo(velho[Number(chave)], dentro[chave]);
    return nova;
  }
  if (Array.isArray(velho)) throw new Error('lista onde era objeto');
  const novo = { ...velho };
  for (const chave of Object.keys(dentro)) novo[chave] = aplicarRemendo(velho[chave], dentro[chave]);
  for (const chave of remendo['-'] ?? []) delete novo[chave];
  return novo;
}
