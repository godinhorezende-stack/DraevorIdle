// A versão do JOGO que vai no `hello`/`welcome` — a "impressão digital" do que está no ar, calculada no boot a partir do conteúdo dos arquivos.
//
// "Sempre que tiver atualização do servidor aparecer uma janela para atualizar,
// sem limpar cache." A janela já existia (`mostrarAtualizacao`, main.mjs), mas
// quem a disparava era a `versao` do `novidades.json`, trocada à mão — e
// ninguém trocava: de 26/09 em diante, nenhum deploy avisou ninguém, e quem
// estava com a aba aberta seguiu rodando o código velho contra o servidor novo.
//
// Até 08/10 a versão era só a do CÓDIGO DO CLIENTE: deploy só de servidor não avisava ninguém (dono, 08/10: "veja se quando faz o deploy
// está aparecendo a aba de atualizar — nos outros eu vi que não está aparecendo": os deploys da correção da bolsa e dos testes por nível
// anunciaram a mesma versão do anterior). Agora ela junta as duas metades:
//   - o CLIENTE: a página do jogo (`jogar.html`), TODA folha de estilo que ela carrega (antes só a `style.css` — a `balao-item.css` e a
//     `world.css` ficavam de fora) e os módulos de `client/src`;
//   - o SERVIDOR: o código (`systems`, `websocket`, `database`, `backend`, `engine`) e os dados do jogo (`gamedata`, menos os mapas —
//     montados à parte em produção —, os sprites e as versões do Engine).
// Deploy que muda o jogo, de qualquer lado, muda a versão e a janela aparece. Não contam: o site, os pré-comprimidos (.br/.gz — o mesmo
// conteúdo em outra roupa, que o deploy refaz), a Engine (`admin/`), os testes, as ferramentas e a documentação.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const FRONTEND = fileURLToPath(new URL('../frontend/', import.meta.url));
const JOGO = fileURLToPath(new URL('../', import.meta.url));

function arquivosDe(pasta, filtro, pular = () => false) {
  const saida = [];
  let entradas = [];
  try {
    entradas = readdirSync(pasta, { withFileTypes: true });
  } catch {
    return saida;
  }
  for (const entrada of entradas) {
    const caminho = join(pasta, entrada.name);
    if (pular(caminho, entrada)) continue;
    if (entrada.isDirectory()) saida.push(...arquivosDe(caminho, filtro, pular));
    else if (filtro.test(entrada.name)) saida.push(caminho);
  }
  return saida;
}

function digerir(raiz, arquivos) {
  const hash = createHash('sha1');
  for (const arquivo of [...arquivos].sort()) {
    try {
      hash.update(relative(raiz, arquivo));
      hash.update(readFileSync(arquivo));
    } catch {
      // Arquivo que sumiu entre a listagem e a leitura: entra só o nome.
    }
  }
  return hash.digest('hex').slice(0, 12);
}

/** As folhas de estilo que a página do jogo carrega (`<link rel="stylesheet" href="/client/….css">`). */
function folhasDaPagina(raiz) {
  let html = '';
  try {
    html = readFileSync(join(raiz, 'jogar.html'), 'utf8');
  } catch {}
  const folhas = [...html.matchAll(/<link[^>]+href="\/client\/([^"?]+\.css)/g)].map((m) => join(raiz, 'client', m[1]));
  return folhas.length ? folhas : [join(raiz, 'client', 'style.css')];
}

/** A metade do CLIENTE: o que o navegador executa no jogo. */
export function calcular(raiz = FRONTEND) {
  return digerir(raiz, [join(raiz, 'jogar.html'), ...folhasDaPagina(raiz), ...arquivosDe(join(raiz, 'client', 'src'), /\.(mjs|js|css|html|json)$/)]);
}

/** A metade do SERVIDOR: o código do jogo e os dados (sem mapas, sprites, versões do Engine, bancos e pré-comprimidos). */
export function calcularDoServidor(raiz = JOGO) {
  const fora = (caminho) => /(^|[\\/])(dados|node_modules|_versoes|\.saida)([\\/]|$)/.test(caminho);
  const codigo = ['systems', 'websocket', 'database', 'backend', 'engine'].flatMap((p) => arquivosDe(join(raiz, p), /\.mjs$/, fora));
  const dados = arquivosDe(join(raiz, 'gamedata'), /\.json$/, (c) => fora(c) || /[\\/]gamedata[\\/]hunts([\\/]|$)|sprites/.test(c));
  return digerir(raiz, [...codigo, ...dados]);
}

/** A versão anunciada: as duas metades juntas. */
export function versaoDoJogo(frontend = FRONTEND, jogo = JOGO) {
  return createHash('sha1').update(`${calcular(frontend)}:${calcularDoServidor(jogo)}`).digest('hex').slice(0, 12);
}

export const VERSAO_DO_CLIENTE = versaoDoJogo();
