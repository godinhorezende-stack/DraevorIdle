// O GRAFO DE DEPENDÊNCIAS do jogo, para saber quais testes um arquivo alterado atinge. Lê os `.mjs`/`.js` de `game/` (sem node_modules)
// e anota, de cada um:
//   - import estático (`import … from '…'`, `import '…'`, `export … from '…'`) e dinâmico com caminho LITERAL (`await import('…')`);
//   - o arquivo lido por `new URL('…', import.meta.url)` (é assim que os módulos carregam o gamedata: o JSON vira dependência de quem o lê).
// Caminho montado em tempo de execução (`import(\`${G}/…\`)`, `join(…)`) não entra: é por isso que o SYSTEM também usa o mapa curado de
// `sistemas.mjs`, e não só o grafo. Os caminhos são relativos a `game/` (ex.: `systems/cacadas.mjs`).
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ_DO_JOGO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const IGNORAR = new Set(['node_modules', '.git', '.saida']);

/** Todos os módulos de `game/` (caminhos relativos, com `/`). */
export function modulos(raiz = RAIZ_DO_JOGO) {
  const saida = [];
  const andar = (dir) => {
    for (const nome of readdirSync(dir)) {
      if (IGNORAR.has(nome)) continue;
      const cheio = join(dir, nome);
      const st = statSync(cheio);
      if (st.isDirectory()) andar(cheio);
      else if (/\.(mjs|js)$/.test(nome)) saida.push(relative(raiz, cheio).split(sep).join('/'));
    }
  };
  andar(raiz);
  return saida.sort();
}

const RE_ESTATICO = /(?:^|[\s;])(?:import|export)\s+(?:[^'"`;]*?\sfrom\s+)?(['"])([^'"\n]+)\1/g;
const RE_DINAMICO = /\bimport\(\s*(['"`])([^'"`$\n]+)\1\s*\)/g;
const RE_URL = /new URL\(\s*(['"`])([^'"`$\n]+)\1\s*,\s*import\.meta\.url\s*\)/g;

/** As dependências declaradas no texto de um módulo: `{ locais: [caminho relativo a game/], pacotes: ['ws', ...] }`. */
export function dependenciasDoTexto(arquivo, texto, raiz = RAIZ_DO_JOGO) {
  const locais = new Set();
  const pacotes = new Set();
  const semComentarios = texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
  const anotar = (spec) => {
    if (spec.startsWith('.') || spec.startsWith('/')) {
      const alvo = relative(raiz, resolve(raiz, dirname(arquivo), spec)).split(sep).join('/');
      if (!alvo.startsWith('..')) locais.add(alvo.replace(/\/$/, ''));
    } else if (!spec.startsWith('node:') && !/^[a-z]+:/.test(spec)) pacotes.add(spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]);
  };
  for (const re of [RE_ESTATICO, RE_DINAMICO, RE_URL]) for (const m of semComentarios.matchAll(re)) anotar(m[2]);
  return { locais: [...locais], pacotes: [...pacotes] };
}

/** O grafo inteiro: `{ deps: Map(arquivo → Set(dependências locais)), pacotes: Map(arquivo → Set), reverso: Map(alvo → Set(quem depende)) }`. */
export function montarGrafo(raiz = RAIZ_DO_JOGO) {
  const deps = new Map();
  const pacotes = new Map();
  const reverso = new Map();
  for (const arquivo of modulos(raiz)) {
    const { locais, pacotes: p } = dependenciasDoTexto(arquivo, readFileSync(join(raiz, arquivo), 'utf8'), raiz);
    deps.set(arquivo, new Set(locais));
    pacotes.set(arquivo, new Set(p));
    for (const alvo of locais) {
      if (!reverso.has(alvo)) reverso.set(alvo, new Set());
      reverso.get(alvo).add(arquivo);
    }
  }
  return { deps, pacotes, reverso, raiz };
}

export const ehTeste = (arquivo) => /^testes\/[^/]+\.test\.mjs$/.test(arquivo);

/**
 * As dependências DIRETAS de um arquivo de teste: as do próprio arquivo (e, num irmão `.classico`, as do arquivo que ele importa). O
 * `apoio.mjs` carrega o jogo inteiro — não conta como dependência direta de nada (senão todo teste dependeria de tudo).
 */
export function diretasDoTeste(grafo, teste) {
  const saida = new Set();
  for (const d of grafo.deps.get(teste) ?? []) {
    if (ehTeste(d)) for (const dd of grafo.deps.get(d) ?? []) saida.add(dd);
    else saida.add(d);
  }
  return saida;
}

/** Os testes que dependem DIRETAMENTE de `arquivo` (importam, ou leem pelo `new URL`). */
export function testesDiretos(grafo, arquivo) {
  const saida = new Set();
  for (const teste of grafo.deps.keys()) if (ehTeste(teste) && diretasDoTeste(grafo, teste).has(arquivo)) saida.add(teste);
  return saida;
}

/** Os testes que alcançam `arquivo` por qualquer caminho de imports (o fecho transitivo, pelo grafo reverso). */
export function testesQueAlcancam(grafo, arquivo) {
  const vistos = new Set([arquivo]);
  const fila = [arquivo];
  const testes = new Set();
  while (fila.length) {
    const atual = fila.shift();
    for (const quem of grafo.reverso.get(atual) ?? []) {
      if (vistos.has(quem)) continue;
      vistos.add(quem);
      if (ehTeste(quem)) testes.add(quem);
      fila.push(quem);
    }
  }
  return testes;
}

/** Todos os arquivos de teste (`testes/*.test.mjs`), na ordem do nome. */
export function todosOsTestes(raiz = RAIZ_DO_JOGO) {
  const dir = join(raiz, 'testes');
  return existsSync(dir) ? readdirSync(dir).filter((n) => n.endsWith('.test.mjs')).sort().map((n) => `testes/${n}`) : [];
}
