// Teste de RESPONSIVIDADE da wiki num navegador de verdade (precisa de `playwright-core` e de um Chromium; não faz parte do `npm test`).
//   node tools/testar-wiki-responsiva.mjs [urlBase=http://127.0.0.1:8080] [caminho...]
// Em cada largura (320 a 1920 px) confere: a PÁGINA nunca rola para o lado; nada do artigo passa da coluna dele (fora a rolagem própria das
// tabelas); figuras e tabelas ficam dentro do artigo; imagens mantêm a proporção. Sai com código 1 se algo falhar.
import { chromium } from 'playwright-core';

const base = process.argv[2] ?? 'http://127.0.0.1:8080';
const caminhos = process.argv.slice(3).length ? process.argv.slice(3) : ['/wiki', '/wiki/itens', '/wiki/layout'];
const LARGURAS = [320, 360, 375, 390, 430, 768, 1024, 1366, 1920];
const navegador = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
let falhas = 0;
for (const caminho of caminhos) {
  for (const w of LARGURAS) {
    const p = await navegador.newPage({ viewport: { width: w, height: 900 } });
    await p.goto(base + caminho, { waitUntil: 'networkidle' });
    await p.waitForTimeout(400);
    const r = await p.evaluate(() => {
      const de = document.documentElement;
      const art = document.querySelector('.wiki-artigo').getBoundingClientRect();
      const fora = (e) => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.right > art.right + 1 || b.left < art.left - 1); };
      return {
        pagina: de.scrollWidth > de.clientWidth,
        passaDoArtigo: [...document.querySelectorAll('.wiki-artigo *')].filter((e) => fora(e) && !e.closest('.tabela-caixa') && !e.closest('.wiki-rolagem::before')).slice(0, 3).map((e) => `${e.tagName}.${e.className}`),
        figurasFora: [...document.querySelectorAll('.wiki-fig')].filter(fora).length,
        tabelasFora: [...document.querySelectorAll('.tabela-caixa')].filter(fora).length,
        distorcidas: [...document.querySelectorAll('.wiki-fig img')].filter((i) => i.naturalWidth && Math.abs(i.getBoundingClientRect().width / i.getBoundingClientRect().height - i.naturalWidth / i.naturalHeight) > 0.03).length,
        tabelas: document.querySelectorAll('.tabela-caixa').length,
      };
    });
    const ruim = r.pagina || r.passaDoArtigo.length || r.figurasFora || r.tabelasFora || r.distorcidas;
    if (ruim) falhas++;
    console.log(`${ruim ? 'FALHOU' : 'ok    '} ${caminho} ${w}px ${JSON.stringify(r)}`);
    await p.close();
  }
}
await navegador.close();
console.log(falhas ? `${falhas} combinação(ões) com problema` : 'tudo certo');
process.exit(falhas ? 1 : 0);
