// Baixa do poedb os ÍCONES das bases (e dos únicos) do PoE que a coleção do Drive não trouxe (dono, 06/10: "vários arcos do PoE estão sem sprite") — hoje
// as armas de duas mãos: Arcos, Machados, Maças, Espadas, Cajados de Guerra (e a Vara de Pesca). Para cada base sem o arquivo do ícone:
//   1. a página da base no poedb (`/us/<Slug>`) → a imagem dela (`og:image`, um webp do cdn do poedb);
//   2. o navegador (Chromium do Playwright) decodifica o webp e enquadra num PNG 64×64 transparente, o desenho centralizado e inteiro —
//      o MESMO formato dos ícones que já estão na coleção;
//   3. grava no caminho que o catálogo já espera (`base.icone`, dentro de `<REFERENCIAS_POE>/original/`).
// A saída é REFERÊNCIA LOCAL (fora do git e da produção), como o resto da coleção. Pausa entre os pedidos ao poedb; base que já tem o ícone
// é pulada (rodar de novo só completa o que falta).
//
// Precisa do Playwright: rode no container dele, com a pasta das referências montada no mesmo caminho:
//   docker run --rm --network host -v /home/deploy/referencias-poe:/home/deploy/referencias-poe -v "$PWD/game/tools":/t -w /t \
//     mcr.microsoft.com/playwright:v1.49.0-noble node baixar-icones-poedb.mjs
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const RAIZ = process.env.REFERENCIAS_POE ?? '/home/deploy/referencias-poe';
const SITE = 'https://poedb.tw';
const AGENTE = 'Mozilla/5.0 (DraevorIdle referencia local)';
const PAUSA_MS = 800;
const LADO = 64;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const catalogo = JSON.parse(readFileSync(join(RAIZ, 'importado', 'itens-poe.json'), 'utf8'));
const faltando = [];
for (const c of Object.values(catalogo.classes)) {
  for (const b of c.bases ?? []) {
    if (!b.icone) continue;
    const arquivo = join(RAIZ, 'original', b.icone);
    if (!existsSync(arquivo)) faltando.push({ classe: c.id, slug: b.slug, nome: b.nome, arquivo });
  }
  // Os ÚNICOS também (a imagem própria de cada um, que a engine mostra na aba Únicos).
  for (const u of c.unicos ?? []) {
    if (!u.icone || !u.slug) continue;
    const arquivo = join(RAIZ, 'original', u.icone);
    if (!existsSync(arquivo)) faltando.push({ classe: `${c.id} (único)`, slug: u.slug, nome: u.nome, arquivo });
  }
}
console.log(`${faltando.length} base(s) sem ícone: ${[...new Set(faltando.map((f) => f.classe))].join(', ')}`);
if (!faltando.length) process.exit(0);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<canvas id="c"></canvas>');
let ok = 0;
const erros = [];
for (const f of faltando) {
  try {
    await esperar(PAUSA_MS);
    const html = await (await fetch(`${SITE}/us/${encodeURIComponent(decodeURIComponent(f.slug))}`, { headers: { 'user-agent': AGENTE } })).text();
    // A imagem principal da página; quando ela não é a do item (alguns únicos usam um ícone de passiva), a primeira arte de item da página.
    const og = html.match(/og:image" content="([^"]+)"/)?.[1];
    const url = og && /2DItems/.test(og) ? og : html.match(/https:\/\/cdn\.poedb\.tw\/image\/Art\/2DItems\/(?!Currency)[^"' )]+\.(?:webp|png)/)?.[0];
    if (!url) throw new Error('sem imagem do item na página');
    await esperar(PAUSA_MS / 2);
    const r = await fetch(url, { headers: { 'user-agent': AGENTE, referer: `${SITE}/us/${f.slug}` } });
    if (!r.ok) throw new Error(`imagem ${r.status}`);
    const base64 = Buffer.from(await r.arrayBuffer()).toString('base64');
    const tipo = url.endsWith('.png') ? 'image/png' : 'image/webp';
    // Enquadra no quadrado de 64: escala para caber inteiro (o arco é alto e fino), centralizado, fundo transparente.
    const png = await page.evaluate(async ({ base64, tipo, lado }) => {
      const img = new Image();
      img.src = `data:${tipo};base64,${base64}`;
      await img.decode();
      const c = document.getElementById('c');
      c.width = lado;
      c.height = lado;
      const g = c.getContext('2d');
      g.clearRect(0, 0, lado, lado);
      g.imageSmoothingQuality = 'high';
      const s = Math.min(lado / img.naturalWidth, lado / img.naturalHeight);
      const w = Math.round(img.naturalWidth * s);
      const h = Math.round(img.naturalHeight * s);
      g.drawImage(img, Math.floor((lado - w) / 2), Math.floor((lado - h) / 2), w, h);
      return c.toDataURL('image/png').split(',')[1];
    }, { base64, tipo, lado: LADO });
    mkdirSync(dirname(f.arquivo), { recursive: true });
    writeFileSync(f.arquivo, Buffer.from(png, 'base64'));
    ok++;
    if (ok % 10 === 0) console.log(`${ok}/${faltando.length}`);
  } catch (e) {
    erros.push(`${f.classe}/${f.slug}: ${e.message}`);
  }
}
await browser.close();
console.log(`gravados ${ok} de ${faltando.length}${erros.length ? ` — sem ícone: ${erros.length}\n${erros.join('\n')}` : ''}`);
