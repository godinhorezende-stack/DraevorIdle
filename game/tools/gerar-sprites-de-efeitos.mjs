// Gera os SPRITES DE EFEITO de fábrica do Draevor (dono, 06/10: "se conseguir fazer sprites de efeitos também quero ver, para poder
// modificar o visual"): spritesheets animados desenhados por código (canvas), por elemento — explosão, nova (anel), esfera (projétil),
// relâmpago, estilhaço de gelo, chamas, nuvem de veneno, corte e cruz sagrada. Saem em `gamedata/efeitos-fabrica/<id>.png` e a definição
// de cada um (grade, fps, loop) em `gamedata/efeitos-fabrica/assets.json` — a biblioteca da Arena de Efeitos mostra todos, e o estilo
// automático das gemas usa onde combinam (`systems/itens-poe/estilos-das-gemas.mjs`). Determinístico (semente fixa): rodar de novo dá
// os mesmos desenhos.
//
// Precisa do Playwright (o canvas do Chromium):
//   docker run --rm -v "$PWD/game":/g -v <pasta com node_modules/playwright>:/t/node_modules -w /g mcr.microsoft.com/playwright:v1.49.0-noble \
//     node tools/gerar-sprites-de-efeitos.mjs
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const PASTA = new URL('../gamedata/efeitos-fabrica/', import.meta.url).pathname;
mkdirSync(PASTA, { recursive: true });

const ELEMENTOS = {
  fogo: { nome: 'Fogo', cor: '#ff7a2e', claro: '#ffd27a', escuro: '#b3260b' },
  gelo: { nome: 'Gelo', cor: '#7fd8ff', claro: '#effbff', escuro: '#1f6fb3' },
  raio: { nome: 'Raio', cor: '#ffe95c', claro: '#ffffff', escuro: '#6a7cff' },
  caos: { nome: 'Caos', cor: '#b15cff', claro: '#e6c8ff', escuro: '#3c8a2a' },
  fisico: { nome: 'Físico', cor: '#d9c7a3', claro: '#ffffff', escuro: '#7a5a3a' },
  sagrado: { nome: 'Sagrado', cor: '#ffd75e', claro: '#fffbe0', escuro: '#c08a1a' },
};
/** Os sprites: `[id, nome, categoria, tipo do desenho, elemento, cel (px), quadros, fps, loop]`. */
const LISTA = [];
for (const el of Object.keys(ELEMENTOS)) {
  LISTA.push([`explosao-${el}`, `Explosão de ${ELEMENTOS[el].nome}`, 'Explosion', 'explosao', el, 64, 8, 16, false]);
  LISTA.push([`nova-${el}`, `Nova de ${ELEMENTOS[el].nome}`, 'Ground', 'nova', el, 96, 8, 16, false]);
  LISTA.push([`esfera-${el}`, `Esfera de ${ELEMENTOS[el].nome}`, 'Projectile', 'esfera', el, 32, 6, 14, true]);
}
LISTA.push(['relampago', 'Relâmpago', 'Impact', 'relampago', 'raio', 64, 6, 18, false]);
LISTA.push(['estilhaco-de-gelo', 'Estilhaço de gelo', 'Impact', 'estilhaco', 'gelo', 64, 8, 16, false]);
LISTA.push(['chamas', 'Chamas', 'Aura', 'chamas', 'fogo', 64, 8, 12, true]);
LISTA.push(['nuvem-de-veneno', 'Nuvem de veneno', 'Ground', 'nuvem', 'caos', 64, 8, 10, true]);
LISTA.push(['corte', 'Corte', 'Impact', 'corte', 'fisico', 64, 6, 18, false]);
LISTA.push(['cruz-sagrada', 'Cruz sagrada', 'Impact', 'cruz', 'sagrado', 64, 8, 14, false]);
LISTA.push(['redemoinho-arcano', 'Redemoinho arcano', 'Aura', 'redemoinho', 'caos', 64, 8, 12, true]);

const b = await chromium.launch();
const page = await b.newPage();
await page.setContent('<canvas id="c"></canvas>');
const assets = {};
for (const [id, nome, categoria, desenho, el, cel, quadros, fps, loop] of LISTA) {
  const png = await page.evaluate(({ desenho, E, cel, quadros, semente }) => {
    let s = semente;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const c = document.getElementById('c');
    c.width = cel * quadros;
    c.height = cel;
    const g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    const brilho = (x, y, r, cor, a) => {
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(255,255,255,${a})`);
      gr.addColorStop(0.35, cor + Math.round(a * 230).toString(16).padStart(2, '0'));
      gr.addColorStop(1, cor + '00');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    };
    // Os raios de cada faísca, iguais em todos os quadros (só crescem).
    const faiscas = Array.from({ length: 12 }, () => ({ a: rnd() * Math.PI * 2, v: 0.6 + rnd() * 0.6 }));
    const cristais = Array.from({ length: 9 }, () => ({ a: rnd() * Math.PI * 2, v: 0.5 + rnd() * 0.6, t: 3 + rnd() * 4 }));
    const bolhas = Array.from({ length: 8 }, () => ({ x: (rnd() - 0.5) * 0.6, y: (rnd() - 0.5) * 0.5, r: 0.18 + rnd() * 0.16, f: rnd() * Math.PI * 2 }));
    for (let i = 0; i < quadros; i++) {
      const f = i / Math.max(1, quadros - 1);
      const cx = i * cel + cel / 2;
      const cy = cel / 2;
      g.save();
      g.beginPath();
      g.rect(i * cel, 0, cel, cel);
      g.clip();
      g.globalCompositeOperation = 'lighter';
      if (desenho === 'explosao') {
        brilho(cx, cy, cel * (0.12 + 0.38 * f), E.cor, 1 - f * 0.85);
        g.strokeStyle = E.claro;
        g.lineWidth = 2;
        for (const p of faiscas) {
          const r0 = cel * 0.1 + cel * 0.35 * f * p.v;
          const r1 = r0 + cel * 0.08 * (1 - f);
          g.globalAlpha = 1 - f;
          g.beginPath();
          g.moveTo(cx + Math.cos(p.a) * r0, cy + Math.sin(p.a) * r0);
          g.lineTo(cx + Math.cos(p.a) * r1, cy + Math.sin(p.a) * r1);
          g.stroke();
        }
      } else if (desenho === 'nova') {
        const r = cel * (0.1 + 0.38 * f);
        g.globalAlpha = 1 - f * 0.9;
        g.strokeStyle = E.cor;
        g.lineWidth = 10 * (1 - f) + 2;
        g.beginPath();
        g.arc(cx, cy, r, 0, Math.PI * 2);
        g.stroke();
        g.strokeStyle = E.claro;
        g.lineWidth = 2;
        g.beginPath();
        g.arc(cx, cy, r, 0, Math.PI * 2);
        g.stroke();
        brilho(cx, cy, r * 0.8, E.cor, 0.25 * (1 - f));
      } else if (desenho === 'esfera') {
        const pulso = 0.85 + 0.15 * Math.sin(f * Math.PI * 2);
        brilho(cx, cy, cel * 0.45 * pulso, E.cor, 0.95);
        brilho(cx, cy, cel * 0.18, E.claro, 1);
      } else if (desenho === 'relampago') {
        g.globalAlpha = 1 - f * 0.8;
        for (let k = 0; k < 2; k++) {
          g.strokeStyle = k ? E.claro : E.escuro;
          g.lineWidth = k ? 1.5 : 4;
          g.beginPath();
          let x = cx + (rnd() - 0.5) * 10;
          g.moveTo(x, 2);
          for (let y = 8; y < cel - 2; y += 8) { x += (rnd() - 0.5) * 14; g.lineTo(x, y); }
          g.stroke();
        }
        brilho(cx, cel - 10, 12 * (1 - f) + 4, E.cor, 0.8);
      } else if (desenho === 'estilhaco') {
        brilho(cx, cy, cel * 0.25 * (1 - f) + 4, E.cor, 0.7 * (1 - f));
        g.fillStyle = E.claro;
        for (const p of cristais) {
          const r = cel * 0.08 + cel * 0.36 * f * p.v;
          const x = cx + Math.cos(p.a) * r;
          const y = cy + Math.sin(p.a) * r;
          g.globalAlpha = 1 - f * 0.9;
          g.beginPath();
          g.moveTo(x + Math.cos(p.a) * p.t * 1.6, y + Math.sin(p.a) * p.t * 1.6);
          g.lineTo(x + Math.cos(p.a + 2.4) * p.t, y + Math.sin(p.a + 2.4) * p.t);
          g.lineTo(x + Math.cos(p.a - 2.4) * p.t, y + Math.sin(p.a - 2.4) * p.t);
          g.closePath();
          g.fill();
        }
      } else if (desenho === 'chamas') {
        for (let k = 0; k < 5; k++) {
          const fase = (f + k / 5) % 1;
          const x = cx + Math.sin(k * 2.1 + f * 6) * 8;
          const y = cel * 0.85 - fase * cel * 0.6;
          brilho(x, y, (1 - fase) * 14 + 4, k % 2 ? E.cor : E.escuro, 0.9 * (1 - fase));
        }
        brilho(cx, cel * 0.82, 14, E.claro, 0.6);
      } else if (desenho === 'nuvem') {
        for (const p of bolhas) {
          const r = cel * p.r * (1 + 0.15 * Math.sin(f * Math.PI * 2 + p.f));
          brilho(cx + p.x * cel, cy + p.y * cel, r, E.escuro, 0.55);
        }
        g.globalAlpha = 0.6;
        brilho(cx, cy, cel * 0.2, E.cor, 0.4);
      } else if (desenho === 'corte') {
        const a0 = -2.4 + f * 2.6;
        g.strokeStyle = E.claro;
        g.globalAlpha = 1 - f * 0.7;
        for (let k = 0; k < 3; k++) {
          g.lineWidth = 5 - k * 1.5;
          g.beginPath();
          g.arc(cx, cy, cel * (0.3 + k * 0.05), a0, a0 + 1.6);
          g.stroke();
        }
      } else if (desenho === 'cruz') {
        const a = 1 - Math.abs(f - 0.35) / 0.65;
        g.globalAlpha = Math.max(0, a);
        g.fillStyle = E.claro;
        const l = cel * (0.18 + 0.15 * f);
        g.fillRect(cx - 3, cy - l, 6, l * 2);
        g.fillRect(cx - l * 0.7, cy - l * 0.3 - 3, l * 1.4, 6);
        brilho(cx, cy, cel * (0.2 + 0.25 * f), E.cor, 0.6 * a);
        g.strokeStyle = E.cor;
        g.lineWidth = 2;
        for (let k = 0; k < 8; k++) {
          const ang = (k / 8) * Math.PI * 2;
          g.beginPath();
          g.moveTo(cx + Math.cos(ang) * l * 1.1, cy + Math.sin(ang) * l * 1.1);
          g.lineTo(cx + Math.cos(ang) * l * 1.6, cy + Math.sin(ang) * l * 1.6);
          g.stroke();
        }
      } else if (desenho === 'redemoinho') {
        g.strokeStyle = E.cor;
        for (let k = 0; k < 3; k++) {
          g.lineWidth = 3;
          g.globalAlpha = 0.85;
          g.beginPath();
          const base = f * Math.PI * 2 + (k * Math.PI * 2) / 3;
          for (let t = 0; t <= 1.001; t += 0.05) {
            const ang = base + t * 3;
            const r = cel * (0.08 + 0.32 * t);
            const x = cx + Math.cos(ang) * r;
            const y = cy + Math.sin(ang) * r * 0.75;
            if (t === 0) g.moveTo(x, y);
            else g.lineTo(x, y);
          }
          g.stroke();
        }
        brilho(cx, cy, cel * 0.16, E.claro, 0.8);
      }
      g.restore();
    }
    return c.toDataURL('image/png').split(',')[1];
  }, { desenho, E: ELEMENTOS[el], cel, quadros, semente: [...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 2147483646, 7) + 1 });
  writeFileSync(join(PASTA, `${id}.png`), Buffer.from(png, 'base64'));
  assets[`fabrica-${id}`] = { nome, categoria, arquivo: `${id}.png`, colunas: quadros, linhas: 1, fps, inicio: 0, fim: quadros - 1, loop, pingpong: false, reverso: false, fabrica: true, elemento: el };
}
await b.close();
/*
 * Os IMPORTADOS: a folha já está na pasta (não é desenhada aqui) e o gerador só mantém o registro dela.
 *   - portal-do-chefe: o vórtice por onde o chefe do ato sai na última fase (dono, 08/10 — o `Glowing_Vortex.gif`, 15 quadros de 96 px a 100 ms,
 *     convertido numa folha de uma linha).
 */
assets['fabrica-portal-do-chefe'] = { nome: 'Portal do Chefe', categoria: 'Other', arquivo: 'portal-do-chefe.png', colunas: 15, linhas: 1, fps: 10, inicio: 0, fim: 14, loop: true, pingpong: false, reverso: false, fabrica: true, importado: true };
// O portal de VIAGEM: por onde o personagem sai de uma instância e chega na outra (dono, 08/10 — o `Portal_(Marapur).gif`, 8 quadros de
// 64 px a 100 ms, convertido do mesmo jeito).
assets['fabrica-portal-de-viagem'] = { nome: 'Portal de Viagem', categoria: 'Other', arquivo: 'portal-de-viagem.png', colunas: 8, linhas: 1, fps: 10, inicio: 0, fim: 7, loop: true, pingpong: false, reverso: false, fabrica: true, importado: true };
writeFileSync(join(PASTA, 'assets.json'), `${JSON.stringify({ _nota: 'Os sprites de efeito de FÁBRICA (tools/gerar-sprites-de-efeitos.mjs): desenhados por código, por elemento. Os PNGs ficam ao lado. Para mudar, edite o gerador e rode de novo; para variações, use a Arena de Efeitos (escala, cor por cima, fps, quadros).', assets }, null, 1)}\n`);
console.log(`gerados ${Object.keys(assets).length} sprites em ${PASTA}`);
