// A versão do JOGO que o navegador roda — a "impressão digital" do código do
// cliente, calculada no boot a partir do conteúdo dos arquivos.
//
// "Sempre que tiver atualização do servidor aparecer uma janela para atualizar,
// sem limpar cache." A janela já existia (`mostrarAtualizacao`, main.mjs), mas
// quem a disparava era a `versao` do `novidades.json`, trocada à mão — e
// ninguém trocava: de 26/09 em diante, nenhum deploy avisou ninguém, e quem
// estava com a aba aberta seguiu rodando o código velho contra o servidor novo.
//
// Agora a versão é o sha1 dos arquivos que o navegador executa: a página do jogo
// (`jogar.html`), a folha de estilo e os módulos de `client/src`. Deploy que
// mexe neles muda a versão e a janela aparece; deploy só de servidor (ou só do
// site) não incomoda ninguém. Os pré-comprimidos (.br/.gz) ficam de fora: são o
// mesmo conteúdo em outra roupa, e o deploy os refaz.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const FRONTEND = fileURLToPath(new URL('../frontend/', import.meta.url));

function arquivosDe(pasta) {
  const saida = [];
  for (const entrada of readdirSync(pasta, { withFileTypes: true })) {
    const caminho = join(pasta, entrada.name);
    if (entrada.isDirectory()) saida.push(...arquivosDe(caminho));
    else if (/\.(mjs|js|css|html|json)$/.test(entrada.name)) saida.push(caminho);
  }
  return saida;
}

export function calcular(raiz = FRONTEND) {
  const arquivos = [join(raiz, 'jogar.html'), join(raiz, 'client', 'style.css'), ...arquivosDe(join(raiz, 'client', 'src'))].sort();
  const hash = createHash('sha1');
  for (const arquivo of arquivos) {
    try {
      hash.update(relative(raiz, arquivo));
      hash.update(readFileSync(arquivo));
    } catch {
      // Arquivo que sumiu entre a listagem e a leitura: entra só o nome.
    }
  }
  return hash.digest('hex').slice(0, 12);
}

export const VERSAO_DO_CLIENTE = calcular();
