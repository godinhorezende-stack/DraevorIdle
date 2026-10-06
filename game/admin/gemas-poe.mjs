// As GEMAS DO PoE na engine (dono, 06/10: "implemente todas essas gemas e coloque na engine do jogo, falando o que está funcionando ou não;
// quero visualizar cada efeito e poder em outros mobs, um char batendo"). A coleção do dono (`poe-gemas-poedb`, do Drive — baixada para a
// referência local com `tools/baixar-drive-publico.mjs`) traz as 562 gemas ativas do poedb e a ARENA DE GEMAS dele: um interpretador das
// gemas (21 arquétipos), uma simulação em canvas contra os monstros do bestiário do PoE e o STATUS de cada gema verificado usando a gema
// (funciona / parcial / não, com os motivos).
//   - `listar()` / `detalhe(slug)`: os dados para a aba Gemas da engine (lidos de `engine/dados/gemas.js` e `status.js`, os mesmos da arena);
//   - `arquivo(caminho)`: serve a pasta da coleção (a arena, os dados e os ícones) para a engine abrir num quadro — só leitura, sem sair da
//     pasta, só tipos conhecidos. No `index.html` da arena entra um script curto que recebe a gema escolhida na engine (postMessage) e a
//     seleciona pela própria lista da arena (o código da arena não é alterado: um download novo do Drive segue funcionando).
// Referência local (fora do git e da produção), como o resto do PoE.
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, normalize, extname } from 'node:path';
import { runInNewContext } from 'node:vm';
import * as GemasPoe from '../systems/itens-poe/gemas-poe.mjs';

const RAIZ = process.env.REFERENCIAS_POE ?? '/home/deploy/referencias-poe';
export const PASTA = join(RAIZ, 'poe-gemas-poedb');
const DADOS = join(PASTA, 'engine', 'dados');

let CACHE = null;
/** Lê os `window.X = ...` dos arquivos de dados da arena (uma vez; `recarregar` lê de novo). */
function carregar() {
  if (CACHE) return CACHE;
  const janela = {};
  for (const f of ['gemas.js', 'status.js']) {
    const arq = join(DADOS, f);
    if (existsSync(arq)) runInNewContext(readFileSync(arq, 'utf8'), { window: janela });
  }
  CACHE = { gemas: janela.GEMAS ?? [], status: janela.STATUS ?? {} };
  return CACHE;
}
export const recarregar = () => ((CACHE = null), carregar());
export const disponivel = () => existsSync(join(DADOS, 'gemas.js'));

/** A lista enxuta para a tela: nome, cor, nível, tags, arquétipo, elemento, status e motivos. */
export function listar() {
  const { gemas, status } = carregar();
  const jogo = GemasPoe.statusNoJogo();
  return gemas.map((g) => {
    const s = status[g.slug] ?? {};
    return {
      slug: g.slug, nome: g.nome, en: g.en, cor: g.cor, nivelReq: g.nivelReq, tags: g.tags ?? [], icone: g.icone ?? null,
      arquetipo: s.arquetipo ?? null, arquetipoNome: s.arquetipoNome ?? null, elemento: s.elemento ?? null,
      status: s.status ?? 'nao', aplicadas: s.aplicadas ?? 0, total: s.total ?? 0, motivos: s.motivos ?? [],
      // O status NO JOGO (o que o combate do Draevor faz da gema — `itens-poe/gemas-poe.mjs`), separado do da arena.
      ...(jogo[g.slug] ? { statusJogo: jogo[g.slug].status, motivosJogo: jogo[g.slug].motivos, moldeJogo: jogo[g.slug].molde } : {}),
    };
  });
}

/** Tudo de uma gema: os dados do poedb (propriedades, mods, qualidade, tabela por nível, onde se ganha) e a verificação em execução. */
export function detalhe(slug) {
  const { gemas, status } = carregar();
  const g = gemas.find((x) => x.slug === slug);
  const r = GemasPoe.doSlug(slug);
  return g ? { ...g, verificacao: status[slug] ?? null, noJogo: r ? { status: r.statusNoJogo, motivos: r.motivosNoJogo, molde: r.molde, formato: r.formato, elemento: r.elemento, itemId: r.itemId, acao: r.acao, ataque: r.ataque, tempos: { 1: GemasPoe.temposNoNivel(slug, 1), 20: GemasPoe.temposNoNivel(slug, 20) } } : null } : null;
}

/** O resumo por status, cor e arquétipo. */
export function resumo() {
  const l = listar();
  const contar = (f) => l.reduce((o, g) => ((o[f(g)] = (o[f(g)] ?? 0) + 1), o), {});
  return { total: l.length, porStatus: contar((g) => g.status), porStatusJogo: contar((g) => g.statusJogo ?? '—'), porCor: contar((g) => g.cor), porArquetipo: contar((g) => g.arquetipoNome ?? g.arquetipo ?? '?') };
}

const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json; charset=utf-8', '.md': 'text/plain; charset=utf-8' };

/** O script que a engine põe na arena: escolher uma gema de fora (`{ tipo: 'gema', slug }`) pela busca e pelo clique da própria lista. */
const PONTE = `<script>
window.addEventListener('message', (e) => {
  const d = e.data || {};
  if (d.tipo !== 'gema' || !d.slug) return;
  const escolher = (tentativa = 0) => {
    const busca = document.getElementById('busca');
    if (!busca || !window.GEMAS) return tentativa < 40 && setTimeout(() => escolher(tentativa + 1), 100);
    const g = window.GEMAS.find((x) => x.slug === d.slug);
    if (!g) return;
    busca.value = g.nome;
    busca.dispatchEvent(new Event('input', { bubbles: true }));
    setTimeout(() => {
      const item = [...document.querySelectorAll('#lista-gemas li')].find((li) => (li.dataset.slug || '') === g.slug || li.textContent.includes(g.nome));
      if (item) item.click();
    }, 60);
  };
  escolher();
});
</script>`;

/** Um arquivo da coleção (caminho relativo à pasta), ou null. `{ tipo, corpo }`. */
export function arquivo(relativo) {
  const alvo = normalize(join(PASTA, relativo));
  if (!alvo.startsWith(PASTA) || /(^|\/)\.cache(\/|$)/.test(alvo)) return null;
  const tipo = TIPOS[extname(alvo).toLowerCase()];
  if (!tipo || !existsSync(alvo) || !statSync(alvo).isFile()) return null;
  let corpo = readFileSync(alvo);
  if (alvo === join(PASTA, 'engine', 'index.html')) corpo = Buffer.from(String(corpo).replace('</body>', `${PONTE}\n</body>`));
  return { tipo, corpo };
}
