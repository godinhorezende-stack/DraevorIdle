// Consultas SOMENTE DE LEITURA ao Git local (nada de commit, push ou checkout aqui): quais arquivos mudaram e a quais módulos da Engine eles pertencem.
// Comandos fixos (sem texto do usuário na linha de comando).
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const JOGO = join(dirname(fileURLToPath(import.meta.url)), '..');
const git = (args, cwd = JOGO) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 30000 });

/** A raiz do repositório (ou `null` fora de um). */
let RAIZ_FORCADA = null;
/** Só os testes: aponta para um repositório temporário. */
export const _usarRepo = (dir) => { RAIZ_FORCADA = dir; };
export function raizDoRepo() { if (RAIZ_FORCADA) return RAIZ_FORCADA; try { return git(['rev-parse', '--show-toplevel']).trim(); } catch { return null; } }

/** Arquivos alterados (modificados, novos, apagados), relativos à raiz do repo: `[{ caminho, estado }]`. Ignora o histórico `_versoes` e dados de operação. */
export function alterados() {
  const raiz = raizDoRepo();
  if (!raiz) return [];
  let saida;
  try { saida = git(['status', '--porcelain=v1', '-z', '--untracked-files=all', '--', 'game'], raiz); } catch { return []; }
  const lista = [];
  const partes = saida.split('\0').filter(Boolean);
  for (let i = 0; i < partes.length; i++) {
    const [xy, caminho] = [partes[i].slice(0, 2), partes[i].slice(3)];
    if (xy[0] === 'R' || xy[0] === 'C') i++; // o nome antigo vem a seguir
    if (/(^|\/)(_versoes|node_modules|database\/dados)\//.test(caminho)) continue;
    const e = xy.includes('?') ? 'novo' : xy.includes('D') ? 'apagado' : xy.includes('A') ? 'novo' : 'modificado';
    lista.push({ caminho, estado: e });
  }
  return lista;
}

/** O módulo da Engine a que um arquivo pertence (para escolher validações e testes). */
export function moduloDe(caminho) {
  const c = caminho.replace(/^game\//, '');
  if (c === 'gamedata/overrides/monstros.json') return 'monstros';
  if (c === 'gamedata/overrides/itens.json') return 'itens';
  if (c === 'gamedata/overrides/conjuntos.json' || c === 'gamedata/conjuntos.json') return 'conjuntos';
  if (c === 'gamedata/overrides/item-power.json' || c === 'gamedata/item-power.json') return 'item-power';
  if (c === 'gamedata/overrides/progressao.json' || c === 'gamedata/progressao.json') return 'progressao';
  if (/^gamedata\/overrides\/sprites(\.json|\/)/.test(c)) return 'sprites';
  if (/^gamedata\/(sprites\/outfits\/|outfits\.json)/.test(c)) return 'sprites';
  if (c.startsWith('gamedata/atos/')) return 'atos';
  if (c === 'gamedata/campanha.json') return 'campanha';
  if (/^gamedata\/(encontros|bosses-unicos|campanha-conteudo)/.test(c)) return 'encontros';
  if (c.startsWith('gamedata/hunts/') || c.startsWith('gamedata/hunts-')) return 'hunts';
  if (c.startsWith('gamedata/')) return 'outros-dados';
  if (/^(docs|testes)\//.test(c)) return 'docs-e-testes';
  return 'codigo';
}

/** O HEAD atual (curto) e se há alterações — a "impressão" do estado do repositório. */
export function estadoDoRepo() {
  const raiz = raizDoRepo();
  if (!raiz) return { repo: false };
  try { return { repo: true, branch: git(['rev-parse', '--abbrev-ref', 'HEAD'], raiz).trim(), head: git(['rev-parse', '--short', 'HEAD'], raiz).trim() }; } catch { return { repo: false }; }
}

const CAMINHO_SEGURO = /^game\/[A-Za-z0-9_.\- /]+$/;
/** Caminho do repo que a Engine pode ler/versionar: dentro de `game/`, sem `..`, sem segredos, banco, dependências ou histórico de versões. */
export function caminhoPermitido(c) {
  const t = String(c ?? '');
  if (!CAMINHO_SEGURO.test(t) || t.includes('..') || t.startsWith('-')) return false;
  return !/(^|\/)(database|node_modules|_versoes|\.git)(\/|$)|(^|\/)\.env|\.(db|sqlite|jsonl|log|key|pem)$|engine-auditoria/i.test(t);
}
/** O conteúdo do arquivo no HEAD (Buffer), ou `null` se ele não existe lá (arquivo novo). Só leitura. */
export function conteudoNoHead(caminho) {
  if (!caminhoPermitido(caminho)) throw new Error('caminho não permitido');
  const raiz = raizDoRepo();
  if (!raiz) return null;
  try { return execFileSync('git', ['show', `HEAD:${caminho}`], { cwd: raiz, maxBuffer: 256 * 1024 * 1024, timeout: 30000 }); } catch { return null; }
}
/** O `git diff` de texto de UM arquivo rastreado contra o HEAD (só leitura; limitado). `null` se não há diferença rastreável. */
export function diffDeTexto(caminho, { linhas = 400 } = {}) {
  if (!caminhoPermitido(caminho)) throw new Error('caminho não permitido');
  const raiz = raizDoRepo();
  if (!raiz) return null;
  try {
    const t = execFileSync('git', ['diff', '--no-color', '-U2', 'HEAD', '--', caminho], { cwd: raiz, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 30000 });
    return t ? t.split('\n').slice(0, linhas).join('\n') : null;
  } catch { return null; }
}
export { JOGO as _jogo };
