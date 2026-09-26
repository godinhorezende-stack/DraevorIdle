// Roda o jogo (Playwright/Chromium) nas resoluções de celular/tablet de
// referência — retrato e paisagem — e aponta: estouro de tela, elemento
// visível fora do viewport, e alvo de toque abaixo de 36px (o mínimo
// publicado por Apple/Google é 44px; 36 é a marca de "certamente pequeno
// demais", pra não afogar o relatório com quase-lá). Tira um print de cada.
//
// O canvas do mapa e o `::after`/`.facho` decorativos SEMPRE aparecem em
// "fora da tela" — é assim de propósito (o canvas é maior que a tela e
// cortado por CSS; o facho é um brilho que sangra alguns px pra fora da
// placa da loja). O resto da lista é o que vale olhar.
//
// Uso (servidor em :8080, personagem pronto — ver preparar-personagem.mjs):
//   node tools/perf/auditoria-mobile.mjs <token> [nome=Perfteste] [pasta=./auditoria-mobile]
//   PLAYWRIGHT=<caminho para playwright/index.mjs> se não estiver instalado global.
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
import { writeFileSync, mkdirSync } from 'node:fs';

const TOKEN = process.argv[2];
if (!TOKEN) { console.error('uso: node auditoria-mobile.mjs <token> [nome] [pasta]'); process.exit(1); }
const NOME = process.argv[3] ?? 'Perfteste';
const OUT = process.argv[4] ?? './auditoria-mobile';
mkdirSync(OUT, { recursive: true });

// [largura, altura, rótulo, dpr] — os 10 pares retrato/paisagem pedidos na auditoria.
const CENARIOS = [
  [375, 667, 'iphone-se-portrait', 2],
  [667, 375, 'iphone-se-landscape', 2],
  [393, 852, 'iphone-15-portrait', 3],
  [852, 393, 'iphone-15-landscape', 3],
  [360, 800, 'android-pequeno-portrait', 2.5],
  [800, 360, 'android-pequeno-landscape', 2.5],
  [412, 915, 'android-medio-portrait', 3],
  [915, 412, 'android-medio-landscape', 3],
  [768, 1024, 'tablet-portrait', 2],
  [1024, 768, 'tablet-landscape', 2],
];

const b = await chromium.launch();
const relatorio = [];

for (const [width, height, rotulo, dpr] of CENARIOS) {
  const ctx = await b.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const erros = [];
  p.on('pageerror', (e) => erros.push(e.message));
  await p.addInitScript(([t, n]) => { localStorage.setItem('ravox:token', t); localStorage.setItem('ravox:character', n); }, [TOKEN, NOME]);
  await p.goto('http://localhost:8080/jogar');
  await p.waitForTimeout(4500);
  await p.getByText(NOME, { exact: true }).first().click().catch(() => {}); // entra no personagem se caiu na lista
  await p.waitForTimeout(3500);
  await p.click('#modal-body button:has-text("OK")').catch(() => {}); // fecha "Progresso enquanto você esteve fora", se veio
  await p.waitForTimeout(300);

  const diag = await p.evaluate(() => {
    const vv = window.visualViewport;
    const overflowX = document.documentElement.scrollWidth > window.innerWidth + 1;
    const overflowY = document.documentElement.scrollHeight > window.innerHeight + 1;
    const fora = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) continue;
      const estoura = r.right > window.innerWidth + 4 || r.bottom > window.innerHeight + 4 || r.left < -4 || r.top < -4;
      if (estoura) fora.push({ tag: el.tagName, id: el.id, cls: (el.className + '').slice(0, 60), rect: { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom) } });
    }
    const pequenos = [];
    for (const el of document.querySelectorAll('button, [role=button], a, .cell, .slot, input, select, .icon-button')) {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      if (r.width < 36 || r.height < 36) pequenos.push({ tag: el.tagName, id: el.id, cls: (el.className + '').slice(0, 40), w: Math.round(r.width), h: Math.round(r.height) });
    }
    const canvas = document.querySelector('canvas');
    return {
      overflowX, overflowY,
      docSize: { w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight },
      winSize: { w: window.innerWidth, h: window.innerHeight },
      vv: vv ? { w: Math.round(vv.width), h: Math.round(vv.height) } : null,
      canvasRect: canvas ? (() => { const r = canvas.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), l: Math.round(r.left), t: Math.round(r.top) }; })() : null,
      foraDaTela: fora.slice(0, 15), totalFora: fora.length,
      pequenosDemais: pequenos.slice(0, 10), totalPequenos: pequenos.length,
    };
  });

  await p.screenshot({ path: `${OUT}/${rotulo}.png` });
  relatorio.push({ rotulo, width, height, dpr, ...diag, erros: erros.slice(0, 3) });
  await ctx.close();
}

await b.close();
writeFileSync(`${OUT}/relatorio.json`, JSON.stringify(relatorio, null, 2));
for (const r of relatorio) {
  console.log(`\n=== ${r.rotulo} (${r.width}x${r.height} @${r.dpr}x) ===`);
  console.log('overflow X/Y:', r.overflowX, r.overflowY, 'doc:', r.docSize, 'win:', r.winSize, 'vv:', r.vv);
  console.log('canvas:', r.canvasRect);
  console.log('fora da tela:', r.totalFora, r.totalFora ? JSON.stringify(r.foraDaTela.slice(0, 5)) : '');
  console.log('botões pequenos (<36px):', r.totalPequenos, r.totalPequenos ? JSON.stringify(r.pequenosDemais.slice(0, 5)) : '');
  if (r.erros.length) console.log('ERROS JS:', r.erros);
}
