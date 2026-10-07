// Baixa do poedb os ÍCONES das passivas de ASCENDÊNCIA (dono, 07/10: "baixe as passivas de ascendancy de todas as classes ... e a imagem que vai
// ser utilizada para colocar na árvore"): o ícone de cada nó das 21 ascendências (os `icone` dos `ascendencia.json` da coleção do Drive, que
// apontam para o cdn do poedb) e o emblema de cada ascendência. Vão para o repositório (`gamedata/itens-poe/icones-ascendencias/`): o jogo
// e a Engine servem de lá (`/api/jogo/poe/icone/ascendencia/<caminho>`). Arquivo que já existe é pulado; pausa entre os pedidos.
//
// Uso: node tools/baixar-ascendencias-poedb.mjs
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const ASCENDENCIAS = process.env.ASCENDENCIAS_POE ?? '/home/deploy/referencias-poe/original/poe-arvore/Ascendencias';
export const PASTA = new URL('../gamedata/itens-poe/icones-ascendencias/', import.meta.url);
const AGENTE = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36 DraevorIdle';
const PAUSA_MS = 300;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/** O caminho local de um ícone do cdn: `.../passives/Berserker/DefyPain.webp` → `Berserker/DefyPain.webp`; o emblema → `classes/IconStr_Berserker.webp`. */
export function caminhoDoIcone(url) {
  const u = String(url ?? '');
  const p = /\/passives\/(.+\.webp)$/i.exec(u);
  if (p) return p[1].split('/').map(decodeURIComponent).join('/');
  const c = /\/UIImages\/Common\/([^/]+\.webp)$/i.exec(u);
  if (c) return `classes/${decodeURIComponent(c[1])}`;
  return null;
}

const lista = readdirSync(ASCENDENCIAS).filter((d) => existsSync(join(ASCENDENCIAS, d, 'ascendencia.json'))).sort().map((d) => JSON.parse(readFileSync(join(ASCENDENCIAS, d, 'ascendencia.json'), 'utf8')));
const pedidos = new Map();
for (const a of lista) {
  if (a.icone) pedidos.set(caminhoDoIcone(a.icone), a.icone);
  for (const n of a.nos) if (n.icone) pedidos.set(caminhoDoIcone(n.icone), n.icone);
}
pedidos.delete(null);
let baixados = 0;
const erros = [];
for (const [relativo, url] of pedidos) {
  const alvo = new URL(relativo, PASTA);
  if (existsSync(alvo)) continue;
  await esperar(PAUSA_MS);
  let r = null;
  for (let tentativa = 1; tentativa <= 3 && !r?.ok; tentativa++) {
    r = await fetch(url, { headers: { 'user-agent': AGENTE, referer: 'https://poedb.tw/pt/Ascendancy_class', accept: 'image/webp,image/*,*/*' } }).catch(() => null);
    if (!r?.ok) await esperar(PAUSA_MS * tentativa * 3);
  }
  if (!r?.ok) {
    erros.push(`${relativo} (${r?.status ?? 'sem resposta'})`);
    continue;
  }
  mkdirSync(dirname(alvo.pathname), { recursive: true });
  writeFileSync(alvo, Buffer.from(await r.arrayBuffer()));
  baixados++;
}
console.log(`${pedidos.size} ícones (${lista.length} ascendências); baixados agora: ${baixados}; erros: ${erros.length ? erros.join(', ') : 'nenhum'}`);
