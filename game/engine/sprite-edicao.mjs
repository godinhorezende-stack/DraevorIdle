// O MODELO DE EDIÇÃO do editor de sprites: ferramentas de pixel, operações de quadro/animação, histórico (desfazer/refazer) e importação/recorte de
// spritesheets. Puro (sem DOM): a tela só liga eventos a estas funções, e os testes exercitam todas. Tudo é IMUTÁVEL — cada operação devolve um estado/bitmap
// NOVO e o que não mudou é compartilhado, então o histórico guarda só referências (uma folha de 3072×576 não vira 100 cópias de 7 MB).
//
// Um ESTADO é `{ meta, quadros }` (ver `sprite-folha.mjs`): `quadros[g][i]` = `{ 'z.addon.dir.layer': Bitmap }`; célula ausente = transparente.
import { criarBitmap, clonarBitmap, recortar, colar, temPixel, posicoesDoGrupo, chaveDaPosicao, estruturaDe, LIMITES } from './sprite-folha.mjs';
import { colorize } from './outfit-color.mjs';

// ---------- cores ----------
export const corDe = (r, g, b, a = 255) => [r, g, b, a];
export const paraHex = ([r, g, b]) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
export function deHex(hex, a = 255) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  return m ? [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16), a] : null;
}
export const pixelEm = (b, x, y) => (x < 0 || y < 0 || x >= b.w || y >= b.h ? null : [...b.data.subarray((y * b.w + x) * 4, (y * b.w + x) * 4 + 4)]);

// ---------- ferramentas de pixel (devolvem um bitmap NOVO) ----------
/** Os pontos de uma linha (Bresenham) entre dois pixels — o traço contínuo do lápis quando o mouse anda rápido. */
export function linhaDePontos(x0, y0, x1, y1) {
  const pts = [];
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    pts.push([x0, y0]);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
  return pts;
}
const pintar = (b, pontos, cor, tamanho) => {
  const n = clonarBitmap(b);
  const meio = Math.floor((tamanho - 1) / 2);
  for (const [px, py] of pontos) {
    for (let j = 0; j < tamanho; j++) {
      for (let i = 0; i < tamanho; i++) {
        const x = px - meio + i;
        const y = py - meio + j;
        if (x < 0 || y < 0 || x >= n.w || y >= n.h) continue;
        n.data.set(cor, (y * n.w + x) * 4);
      }
    }
  }
  return n;
};
/** Lápis: substitui (NÃO mistura) cada pixel pela cor, sem suavização. */
export const lapis = (b, pontos, cor, tamanho = 1) => pintar(b, pontos, cor, Math.max(1, tamanho));
/** Borracha: deixa o pixel totalmente transparente. */
export const borracha = (b, pontos, tamanho = 1) => pintar(b, pontos, [0, 0, 0, 0], Math.max(1, tamanho));
/** Preenchimento (balde): 4-conexo; `tolerancia` = distância máxima por canal (0 = só a cor exata). */
export function balde(b, x, y, cor, tolerancia = 0) {
  if (x < 0 || y < 0 || x >= b.w || y >= b.h) return b;
  const alvo = pixelEm(b, x, y);
  const mesma = (o) => Math.abs(b.data[o] - alvo[0]) <= tolerancia && Math.abs(b.data[o + 1] - alvo[1]) <= tolerancia && Math.abs(b.data[o + 2] - alvo[2]) <= tolerancia && Math.abs(b.data[o + 3] - alvo[3]) <= tolerancia;
  if (alvo.every((v, i) => v === cor[i])) return b;
  const n = clonarBitmap(b);
  const visto = new Uint8Array(b.w * b.h);
  const pilha = [[x, y]];
  while (pilha.length) {
    const [cx, cy] = pilha.pop();
    if (cx < 0 || cy < 0 || cx >= b.w || cy >= b.h || visto[cy * b.w + cx]) continue;
    visto[cy * b.w + cx] = 1;
    if (!mesma((cy * b.w + cx) * 4)) continue;
    n.data.set(cor, (cy * b.w + cx) * 4);
    pilha.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
  return n;
}
/** Espelha o bitmap inteiro ('h' = esquerda↔direita, 'v' = cima↔baixo). */
export function espelhar(b, eixo) {
  const n = criarBitmap(b.w, b.h);
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
    const sx = eixo === 'h' ? b.w - 1 - x : x;
    const sy = eixo === 'v' ? b.h - 1 - y : y;
    n.data.set(b.data.subarray((sy * b.w + sx) * 4, (sy * b.w + sx) * 4 + 4), (y * b.w + x) * 4);
  }
  return n;
}
/** Desloca o desenho `dx, dy` pixels (o que sai da célula se perde; entra transparência). */
export function deslocar(b, dx, dy) {
  const n = criarBitmap(b.w, b.h);
  colar(n, b, dx, dy);
  return n;
}
const dentroDe = (b, { x, y, w, h }) => ({ x: Math.max(0, x), y: Math.max(0, y), w: Math.max(0, Math.min(b.w, x + w) - Math.max(0, x)), h: Math.max(0, Math.min(b.h, y + h) - Math.max(0, y)) });
/** Copia uma região (seleção retangular) para a área de transferência do editor. */
export const copiarRegiao = (b, r) => recortar(b, dentroDe(b, r));
/** Apaga uma região (a metade "recortar" do recortar-e-colar). */
export function limparRegiao(b, r) {
  const rr = dentroDe(b, r);
  const n = clonarBitmap(b);
  for (let j = 0; j < rr.h; j++) for (let i = 0; i < rr.w; i++) n.data.fill(0, ((rr.y + j) * b.w + rr.x + i) * 4, ((rr.y + j) * b.w + rr.x + i) * 4 + 4);
  return n;
}
/** Cola `area` em (x, y): só os pixels visíveis entram (transparente não apaga o que está embaixo). */
export const colarRegiao = (b, area, x, y) => colar(clonarBitmap(b), area, x, y, { soVisivel: true });
/** Retângulo do conteúdo visível (`null` se vazio). */
export function limitesDoConteudo(b) {
  let x0 = b.w; let y0 = b.h; let x1 = -1; let y1 = -1;
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (b.data[(y * b.w + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
/** Centraliza o conteúdo visível na célula (alinhamento horizontal e vertical). */
export function centralizar(b) {
  const l = limitesDoConteudo(b);
  if (!l) return b;
  return deslocar(b, Math.floor((b.w - l.w) / 2) - l.x, Math.floor((b.h - l.h) / 2) - l.y);
}
/** Troca todos os pixels de uma cor exata por outra. */
export function substituirCor(b, de, para) {
  const n = clonarBitmap(b);
  for (let i = 0; i < n.data.length; i += 4) if (n.data[i] === de[0] && n.data[i + 1] === de[1] && n.data[i + 2] === de[2] && n.data[i + 3] === de[3]) n.data.set(para, i);
  return n;
}
/** Remove a suavização: alfa abaixo do limiar vira 0, o resto vira 255 (pixel art não usa meio-transparente). */
export function endurecerAlfa(b, limiar = 128) {
  const n = clonarBitmap(b);
  for (let i = 3; i < n.data.length; i += 4) n.data[i] = n.data[i] >= limiar ? 255 : 0;
  return n;
}
/** Ajusta um bitmap ao tamanho `cw×ch`: recorta ou completa com transparência, ancorando no canto inferior direito (o do jogo) ou no centro. */
export function ajustarCelula(b, cw, ch, ancora = 'baixo-direita') {
  if (b.w === cw && b.h === ch) return b;
  const n = criarBitmap(cw, ch);
  const ox = ancora === 'centro' ? Math.floor((cw - b.w) / 2) : ancora === 'cima-esquerda' ? 0 : cw - b.w;
  const oy = ancora === 'centro' ? Math.floor((ch - b.h) / 2) : ancora === 'cima-esquerda' ? 0 : ch - b.h;
  colar(n, b, ox, oy);
  return n;
}

// ---------- estado: células ----------
const celulaDe = (estado, g, i, pos) => estado.quadros[g][i][chaveDaPosicao(pos)] ?? criarBitmap(estado.meta.cw, estado.meta.ch);
export const lerCelula = celulaDe;
const comQuadro = (estado, g, i, quadro) => ({ ...estado, quadros: estado.quadros.map((q, gi) => (gi === g ? q.map((x, qi) => (qi === i ? quadro : x)) : q)) });
const comQuadros = (estado, g, lista, metaGrupo = {}) => ({
  meta: { ...estado.meta, groups: estado.meta.groups.map((gr, gi) => (gi === g ? { ...gr, frames: lista.length, ...metaGrupo } : gr)) },
  quadros: estado.quadros.map((q, gi) => (gi === g ? lista : q)),
});
/** Grava um bitmap numa célula. Vazio some do objeto (o quadro guarda só o que tem desenho). */
export function gravarCelula(estado, g, i, pos, bitmap) {
  const quadro = { ...estado.quadros[g][i] };
  if (temPixel(bitmap)) quadro[chaveDaPosicao(pos)] = bitmap; else delete quadro[chaveDaPosicao(pos)];
  return comQuadro(estado, g, i, quadro);
}
/** A posição "irmã" na outra camada (desenho ↔ máscara). */
export const irma = (pos) => ({ ...pos, layer: pos.layer === 0 ? 1 : 0 });
/** Aplica `fn(bitmap) → bitmap` na célula e, com `vincular`, também na da outra camada (a máscara acompanha o desenho: espelhar/deslocar). */
export function aplicarNaCelula(estado, g, i, pos, fn, { vincular = false } = {}) {
  let e = gravarCelula(estado, g, i, pos, fn(celulaDe(estado, g, i, pos)));
  if (vincular && (estado.meta.groups[g].layers ?? 1) > 1) e = gravarCelula(e, g, i, irma(pos), fn(celulaDe(estado, g, i, irma(pos))));
  return e;
}
/** Aplica `fn` em TODAS as células de um quadro (todas as direções, camadas, addons e poses): alinhamento do quadro inteiro. */
export function aplicarNoQuadro(estado, g, i, fn) {
  let e = estado;
  for (const pos of posicoesDoGrupo(estado.meta.groups[g])) {
    const c = e.quadros[g][i][chaveDaPosicao(pos)];
    if (c) e = gravarCelula(e, g, i, pos, fn(c));
  }
  return e;
}
export const deslocarQuadro = (estado, g, i, dx, dy) => aplicarNoQuadro(estado, g, i, (b) => deslocar(b, dx, dy));

/**
 * A célula COMPOSTA como o jogo a mostra: com máscara (2 camadas) e `cores` ({head, body, legs, feet}, índices da paleta 0..132), o desenho é tingido pela
 * MESMA `colorize` do renderer; sem cores (ou sem máscara) é o desenho puro. NUNCA altera o estado: a cor dinâmica é só visualização — os pixels da folha
 * continuam os originais, e a máscara é que decide, no jogo, onde cada cor cai.
 */
export function comporCelula(estado, g, i, pos, cores = null) {
  const base = clonarBitmap(celulaDe(estado, g, i, { ...pos, layer: 0 }));
  if ((estado.meta.groups[g].layers ?? 1) > 1 && cores) colorize(base.data, celulaDe(estado, g, i, { ...pos, layer: 1 }).data, cores);
  return base;
}

// ---------- estado: quadros e animação ----------
const duracaoPadrao = [200, 200];
const duracoesDe = (estado, g) => estado.meta.groups[g].animation?.durations ?? Array.from({ length: estado.meta.groups[g].frames }, () => [...duracaoPadrao]);
const comDuracoes = (estado, g, lista, durations) => comQuadros(estado, g, lista, { animation: { loop: estado.meta.groups[g].animation?.loop ?? 0, start: estado.meta.groups[g].animation?.start ?? 0, random: !!estado.meta.groups[g].animation?.random, durations } });
const ref = (q) => ({ ...q }); // um quadro novo com as MESMAS células (bitmaps imutáveis são compartilhados)

export function duplicarQuadro(estado, g, i) {
  if (estado.quadros[g].length >= LIMITES.quadros) return estado;
  const lista = [...estado.quadros[g]];
  lista.splice(i + 1, 0, ref(lista[i]));
  const d = [...duracoesDe(estado, g)];
  d.splice(i + 1, 0, [...d[i]]);
  return comDuracoes(estado, g, lista, d);
}
export function inserirQuadroVazio(estado, g, i) {
  if (estado.quadros[g].length >= LIMITES.quadros) return estado;
  const lista = [...estado.quadros[g]];
  lista.splice(i + 1, 0, {});
  const d = [...duracoesDe(estado, g)];
  d.splice(i + 1, 0, [...duracaoPadrao]);
  return comDuracoes(estado, g, lista, d);
}
export function removerQuadro(estado, g, i) {
  if (estado.quadros[g].length <= 1) return estado;
  const lista = estado.quadros[g].filter((_, k) => k !== i);
  return comDuracoes(estado, g, lista, duracoesDe(estado, g).filter((_, k) => k !== i));
}
/** Reordena: o quadro `de` passa a ficar na posição `para` (arrastar e soltar). Os tempos acompanham o quadro. */
export function moverQuadro(estado, g, de, para) {
  if (de === para || de < 0 || para < 0 || de >= estado.quadros[g].length || para >= estado.quadros[g].length) return estado;
  const lista = [...estado.quadros[g]];
  const d = [...duracoesDe(estado, g)];
  lista.splice(para, 0, lista.splice(de, 1)[0]);
  d.splice(para, 0, d.splice(de, 1)[0]);
  return comDuracoes(estado, g, lista, d);
}
/** Cola um quadro copiado (`{ cel, dur }`) depois do índice `i`. */
export function colarQuadro(estado, g, i, copiado) {
  if (estado.quadros[g].length >= LIMITES.quadros) return estado;
  const lista = [...estado.quadros[g]];
  lista.splice(i + 1, 0, ref(copiado.celulas));
  const d = [...duracoesDe(estado, g)];
  d.splice(i + 1, 0, [...copiado.duracao]);
  return comDuracoes(estado, g, lista, d);
}
export const copiarQuadro = (estado, g, i) => ({ celulas: ref(estado.quadros[g][i]), duracao: [...duracoesDe(estado, g)[i]] });
/** Define o ritmo: `fps` quadros por segundo para todos os quadros do grupo. */
export function definirFps(estado, g, fps) {
  const ms = Math.max(LIMITES.duracao[0] + 10, Math.round(1000 / Math.max(1, Math.min(60, fps))));
  return comDuracoes(estado, g, estado.quadros[g], estado.quadros[g].map(() => [ms, ms]));
}
export const fpsDoGrupo = (estado, g) => { const d = duracoesDe(estado, g); const media = d.reduce((s, x) => s + ((Array.isArray(x) ? x[0] : x) || 200), 0) / d.length; return Math.round((1000 / (media || 200)) * 10) / 10; };
/** A duração (ms) de UM quadro. */
export function definirDuracao(estado, g, i, ms) {
  const d = duracoesDe(estado, g).map((x) => [...x]);
  d[i] = [ms, ms];
  return comDuracoes(estado, g, estado.quadros[g], d);
}
/** Loop da animação: 0 = para sempre; N = N repetições; -1 = ping-pong (como o appearance do Tibia). */
export function definirLoop(estado, g, loop) {
  const a = estado.meta.groups[g].animation;
  return comQuadros(estado, g, estado.quadros[g], { animation: { loop, start: a?.start ?? 0, random: !!a?.random, durations: duracoesDe(estado, g) } });
}
export const definirShift = (estado, x, y) => ({ ...estado, meta: { ...estado.meta, shift: [x, y] } });

/** Copia o desenho de uma direção para outra (todos os quadros, ou só o `i`). `espelhado`: espelha na horizontal (leste ↔ oeste). */
export function copiarDirecao(estado, g, de, para, { quadro = null, espelhado = false, camadas = true } = {}) {
  let e = estado;
  const gr = estado.meta.groups[g];
  const indices = quadro === null ? estado.quadros[g].map((_, k) => k) : [quadro];
  for (const i of indices) {
    for (const pos of posicoesDoGrupo(gr)) {
      if (pos.dir !== de || (!camadas && pos.layer > 0)) continue;
      const origem = estado.quadros[g][i][chaveDaPosicao(pos)];
      const destino = { ...pos, dir: para };
      e = gravarCelula(e, g, i, destino, origem ? (espelhado ? espelhar(origem, 'h') : origem) : criarBitmap(estado.meta.cw, estado.meta.ch));
    }
  }
  return e;
}
/** Copia UM quadro de um estado para outro (ex.: entre recursos compatíveis), validando o tamanho do quadro. Devolve `{ erro }` se não couber. */
export function copiarCelulaEntreRecursos(origem, destino, { g = 0, i = 0, pos, gDest = g, iDest = i, posDest = pos }) {
  if (origem.meta.cw !== destino.meta.cw || origem.meta.ch !== destino.meta.ch) return { erro: `Tamanhos diferentes: o quadro de origem tem ${origem.meta.cw}×${origem.meta.ch} e o de destino ${destino.meta.cw}×${destino.meta.ch}. Redimensione um deles antes de copiar.` };
  if (!destino.quadros[gDest]?.[iDest]) return { erro: 'O quadro de destino não existe.' };
  return { estado: gravarCelula(destino, gDest, iDest, posDest, celulaDe(origem, g, i, pos)) };
}
/** Muda o tamanho do quadro de TODAS as células (a folha toda), ancorando o desenho no canto inferior direito, como o jogo. */
export function redimensionarQuadros(estado, cw, ch, ancora = 'baixo-direita') {
  const quadros = estado.quadros.map((g) => g.map((q) => Object.fromEntries(Object.entries(q).map(([k, b]) => [k, ajustarCelula(b, cw, ch, ancora)]))));
  const meta = { ...estado.meta, cw, ch };
  return { meta: { ...meta, ...estruturaDe(meta) }, quadros };
}

// ---------- o tempo da animação (mesma regra do renderer do jogo: `idleFrameOf`) ----------
/** O quadro que aparece no instante `tMs` (ms desde o início), com a duração de cada quadro e o `loop` do cadastro; sem tempos, 200 ms por quadro. */
export function quadroNoTempo(grupo, tMs, { velocidade = 1 } = {}) {
  const n = grupo.frames ?? 1;
  if (n <= 1) return 0;
  const d = grupo.animation?.durations;
  const passo = (i) => { const e = d?.[i % (d?.length || 1)]; const v = Array.isArray(e) ? e[0] : e; return v > 0 ? v : 200; };
  const t = Math.max(0, tMs) * velocidade;
  let total = 0;
  for (let i = 0; i < n; i++) total += passo(i);
  let c = t % total;
  for (let i = 0; i < n; i++) { c -= passo(i); if (c < 0) return i; }
  return 0;
}

/**
 * A posição (em tiles) e a direção de quem anda em volta de um retângulo de teste (6×3 tiles... 4 lados), no instante `t` (segundos) a `velocidade`
 * tiles por segundo. Direção: 0 norte, 1 leste, 2 sul, 3 oeste — a do trecho que está percorrendo. Para a pré-visualização contextual.
 */
export function posicaoNoPercurso(t, velocidade) {
  const lados = [[1, 1, 5, 1, 1], [5, 1, 5, 3, 2], [5, 3, 1, 3, 3], [1, 3, 1, 1, 0]];
  const comprimento = lados.reduce((s, [a, b, c, d]) => s + Math.abs(c - a) + Math.abs(d - b), 0);
  let d = (Math.max(0, t) * velocidade) % comprimento;
  for (const [x0, y0, x1, y1, dir] of lados) {
    const len = Math.abs(x1 - x0) + Math.abs(y1 - y0);
    if (d < len) return { x: x0 + Math.sign(x1 - x0) * d, y: y0 + Math.sign(y1 - y0) * d, dir };
    d -= len;
  }
  return { x: 1, y: 1, dir: 1 };
}

// ---------- histórico (desfazer/refazer) ----------
export const criarSessao = (estado) => ({ original: estado, atual: estado, passado: [], futuro: [], rotulos: [] });
/** Aplica uma operação `fn(estado) → estado` registrando no histórico. Operação que não muda nada não suja o histórico. */
export function aplicar(sessao, rotulo, fn) {
  const novo = fn(sessao.atual);
  if (novo === sessao.atual) return sessao;
  return { ...sessao, atual: novo, passado: [...sessao.passado.slice(-99), { estado: sessao.atual, rotulo }], futuro: [] };
}
export const podeDesfazer = (s) => s.passado.length > 0;
export const podeRefazer = (s) => s.futuro.length > 0;
export function desfazer(s) {
  if (!s.passado.length) return s;
  const ultimo = s.passado[s.passado.length - 1];
  return { ...s, atual: ultimo.estado, passado: s.passado.slice(0, -1), futuro: [{ estado: s.atual, rotulo: ultimo.rotulo }, ...s.futuro] };
}
export function refazer(s) {
  if (!s.futuro.length) return s;
  const [prox, ...resto] = s.futuro;
  return { ...s, atual: prox.estado, passado: [...s.passado, { estado: s.atual, rotulo: prox.rotulo }], futuro: resto };
}
/** O histórico legível (mais antigo primeiro). */
export const historicoDe = (s) => s.passado.map((p) => p.rotulo);
/** Descarta tudo e volta ao original (o botão "descartar alterações"). */
export const descartar = (s) => criarSessao(s.original);
/** Os bitmaps são imutáveis: comparar por referência primeiro e só olhar os pixels quando a referência difere. */
export function estadosIguais(a, b) {
  if (a === b) return true;
  if (JSON.stringify(a.meta) !== JSON.stringify(b.meta)) return false;
  for (let g = 0; g < a.quadros.length; g++) {
    if (a.quadros[g].length !== b.quadros[g].length) return false;
    for (let i = 0; i < a.quadros[g].length; i++) {
      const x = a.quadros[g][i]; const y = b.quadros[g][i];
      const ks = new Set([...Object.keys(x), ...Object.keys(y)]);
      for (const k of ks) {
        if (x[k] === y[k]) continue;
        if (!x[k] || !y[k]) return false;
        if (x[k].data.length !== y[k].data.length || x[k].data.some((v, p) => v !== y[k].data[p])) return false;
      }
    }
  }
  return true;
}
/** Há alteração em relação ao original (comparação por conteúdo: desenhar e desfazer à mão volta a "sem alterações")? */
export const sujo = (s) => !estadosIguais(s.atual, s.original);

// ---------- importação de spritesheets ----------
/** Recorta uma grade regular: células de `cw×ch`, com margem externa e espaço entre células. Devolve `{ cols, linhas, celulas: [{x, y, col, linha, bitmap}] }`. */
export function recortarGrade(b, { cw, ch, margemX = 0, margemY = 0, espacoX = 0, espacoY = 0 }) {
  const cols = Math.max(0, Math.floor((b.w - margemX + espacoX) / (cw + espacoX)));
  const linhas = Math.max(0, Math.floor((b.h - margemY + espacoY) / (ch + espacoY)));
  const celulas = [];
  for (let l = 0; l < linhas; l++) for (let c = 0; c < cols; c++) {
    const x = margemX + c * (cw + espacoX);
    const y = margemY + l * (ch + espacoY);
    celulas.push({ x, y, col: c, linha: l, bitmap: recortar(b, { x, y, w: cw, h: ch }) });
  }
  return { cols, linhas, celulas };
}
/** Quanto de um conteúdo "atravessa" as divisões da grade (conteúdo cortado ao meio = grade errada). 0 = nada atravessa. */
function atravessamento(b, cw, ch) {
  let atravessa = 0;
  let total = 0;
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
    if (!b.data[(y * b.w + x) * 4 + 3]) continue;
    total++;
    if (x % cw === 0 && x > 0 && b.data[(y * b.w + x - 1) * 4 + 3]) atravessa++;
    if (y % ch === 0 && y > 0 && b.data[((y - 1) * b.w + x) * 4 + 3]) atravessa++;
  }
  return total ? atravessa / total : 0;
}
/** Sugere grades (tamanhos de quadro) que dividem a imagem sem cortar o desenho ao meio. Mais provável primeiro. */
export function sugerirGrades(b, { tamanhos = [16, 24, 32, 40, 48, 64, 72, 80, 96, 128, 192, 256] } = {}) {
  const lados = new Set(tamanhos);
  const cand = [];
  for (const cw of [...lados, b.w]) for (const ch of [...lados, b.h]) {
    if (cw > b.w || ch > b.h || b.w % cw || b.h % ch) continue;
    const cols = b.w / cw; const linhas = b.h / ch;
    if (cols * linhas > 4096) continue;
    let cheias = 0;
    for (let l = 0; l < linhas; l++) for (let c = 0; c < cols; c++) if (temPixel(recortar(b, { x: c * cw, y: l * ch, w: cw, h: ch }))) cheias++;
    const corte = atravessamento(b, cw, ch);
    // prefere quadrados, sem corte, com muitas células cheias e que não sejam "uma célula só" quando há alternativa
    const pontuacao = (1 - Math.min(1, corte * 20)) * 0.6 + (cheias / (cols * linhas)) * 0.25 + (cw === ch ? 0.1 : 0) + (cols * linhas > 1 ? 0.05 : 0);
    cand.push({ cw, ch, cols, linhas, cheias, corte: Math.round(corte * 1000) / 1000, pontuacao: Math.round(pontuacao * 1000) / 1000 });
  }
  return cand.sort((x, y) => y.pontuacao - x.pontuacao || x.cw * x.ch - y.cw * y.ch).slice(0, 6);
}
/** Recorte AUTOMÁTICO por regiões: separa o desenho em faixas horizontais e, dentro de cada faixa, em blocos separados por colunas vazias. Devolve retângulos. */
export function detectarRegioes(b, { minimo = 2 } = {}) {
  const linhaVazia = (y) => { for (let x = 0; x < b.w; x++) if (b.data[(y * b.w + x) * 4 + 3]) return false; return true; };
  const colunaVazia = (x, y0, y1) => { for (let y = y0; y < y1; y++) if (b.data[(y * b.w + x) * 4 + 3]) return false; return true; };
  const regioes = [];
  let y = 0;
  while (y < b.h) {
    if (linhaVazia(y)) { y++; continue; }
    let y1 = y;
    while (y1 < b.h && !linhaVazia(y1)) y1++;
    let x = 0;
    while (x < b.w) {
      if (colunaVazia(x, y, y1)) { x++; continue; }
      let x1 = x;
      while (x1 < b.w && !colunaVazia(x1, y, y1)) x1++;
      if ((x1 - x) * (y1 - y) >= minimo) {
        const r = limitesDoConteudo(recortar(b, { x, y, w: x1 - x, h: y1 - y }));
        if (r) regioes.push({ x: x + r.x, y: y + r.y, w: r.w, h: r.h });
      }
      x = x1;
    }
    y = y1;
  }
  return regioes;
}
/** Células de tamanho `cw×ch` a partir de regiões soltas: cada região é centralizada/ancorada numa célula do tamanho pedido. */
export const regioesComoCelulas = (b, regioes, cw, ch, ancora = 'baixo-direita') => regioes.map((r) => ({ ...r, bitmap: ajustarCelula(recortar(b, r), cw, ch, ancora) }));

/**
 * Distribui as células importadas nos quadros do recurso. `plano.modo`:
 *  - 'folha-do-jogo': a grade já é a do jogo (linhas = quadros; colunas = addon/direção/camada) — substitui o grupo `g`;
 *  - 'direcoes-em-linhas': cada LINHA é uma direção (ordem `plano.ordem`, padrão norte, leste, sul, oeste), colunas = quadros;
 *  - 'direcoes-em-colunas': cada COLUNA é uma direção, linhas = quadros;
 *  - 'sequencia': todas as células, em ordem de leitura, viram quadros de UMA direção (`plano.dir`).
 * `plano.camada`/`z`/`addon` dizem onde gravar. `ajustar`: 'recortar' (ancorando) ou nada. Devolve `{ estado, avisos }` ou `{ erro }`.
 */
export function distribuirImportacao(estado, grade, plano) {
  const g = plano.g ?? 0;
  const gr = estado.meta.groups[g];
  const { cw, ch } = estado.meta;
  const avisos = [];
  const ancora = plano.ancora ?? 'baixo-direita';
  const celula = (c) => ajustarCelula(c.bitmap, cw, ch, ancora);
  if (grade.celulas.some((c) => c.bitmap.w !== cw || c.bitmap.h !== ch)) avisos.push(`As células importadas (${grade.celulas[0]?.bitmap.w}×${grade.celulas[0]?.bitmap.h}) têm tamanho diferente do quadro do recurso (${cw}×${ch}): foram ${ancora === 'centro' ? 'centralizadas' : 'ancoradas no canto inferior direito'} (recorte/margem transparente). Se o desenho ficou cortado, mude o tamanho do quadro do recurso.`);
  const ordem = plano.ordem ?? [0, 1, 2, 3];
  const pos = (dir, layer = plano.camada ?? 0) => ({ z: plano.z ?? 0, addon: plano.addon ?? 0, dir, layer });
  let e = estado;
  const porLinhaColuna = (l, c) => grade.celulas.find((x) => x.linha === l && x.col === c);
  if (plano.modo === 'folha-do-jogo') {
    const esp = estruturaDe({ ...estado.meta, groups: [gr] });
    if (grade.cols !== esp.cols) return { erro: `A grade importada tem ${grade.cols} colunas, mas este recurso usa ${esp.cols} (${gr.dirs} direções × ${gr.layers} camadas × ${gr.addons} addons × ${gr.depth} poses). Use outro modo de importação ou outro recorte.` };
    const lista = Array.from({ length: grade.linhas }, (_, l) => {
      const q = {};
      for (const p of posicoesDoGrupo(gr)) { const c = porLinhaColuna(l, ((((p.z * gr.addons + p.addon) * gr.dirs + p.dir) * gr.layers) + p.layer)); if (c) { const b = celula(c); if (temPixel(b)) q[chaveDaPosicao(p)] = b; } }
      return q;
    });
    if (lista.length > LIMITES.quadros) return { erro: `${lista.length} quadros: o limite é ${LIMITES.quadros}.` };
    return { estado: comDuracoes(e, g, lista, ajustarDuracoes(duracoesDe(e, g), lista.length)), avisos };
  }
  if (plano.modo === 'sequencia') {
    const dir = plano.dir ?? 2;
    const lista = grade.celulas.map((c) => c);
    if (!lista.length) return { erro: 'Nenhuma célula para importar.' };
    if (lista.length > LIMITES.quadros) return { erro: `${lista.length} quadros: o limite é ${LIMITES.quadros}.` };
    if (plano.somenteQuadrosExistentes) { lista.length = Math.min(lista.length, e.quadros[g].length); }
    else if (lista.length !== e.quadros[g].length) { e = comDuracoes(e, g, ajustarQuadros(e.quadros[g], lista.length), ajustarDuracoes(duracoesDe(e, g), lista.length)); avisos.push(`A quantidade de quadros mudou para ${lista.length}.`); }
    lista.forEach((c, i) => { e = gravarCelula(e, g, i, pos(dir), celula(c)); });
    return { estado: e, avisos };
  }
  const porLinhas = plano.modo === 'direcoes-em-linhas';
  if (!porLinhas && plano.modo !== 'direcoes-em-colunas') return { erro: `Modo de importação desconhecido: ${plano.modo}.` };
  const nDir = porLinhas ? grade.linhas : grade.cols;
  const nQuadros = porLinhas ? grade.cols : grade.linhas;
  if (nDir > ordem.length || nDir > gr.dirs) avisos.push(`A imagem tem ${nDir} direções e o recurso ${gr.dirs}: as extras foram ignoradas.`);
  if (nQuadros > LIMITES.quadros) return { erro: `${nQuadros} quadros: o limite é ${LIMITES.quadros}.` };
  if (nQuadros !== e.quadros[g].length) { e = comDuracoes(e, g, ajustarQuadros(e.quadros[g], nQuadros), ajustarDuracoes(duracoesDe(e, g), nQuadros)); avisos.push(`A quantidade de quadros mudou para ${nQuadros}.`); }
  for (let d = 0; d < Math.min(nDir, ordem.length, gr.dirs); d++) for (let q = 0; q < nQuadros; q++) {
    const c = porLinhas ? porLinhaColuna(d, q) : porLinhaColuna(q, d);
    e = gravarCelula(e, g, q, pos(ordem[d]), c ? celula(c) : criarBitmap(cw, ch));
  }
  return { estado: e, avisos };
}
const ajustarQuadros = (lista, n) => Array.from({ length: n }, (_, i) => lista[i] ?? {});
const ajustarDuracoes = (d, n) => Array.from({ length: n }, (_, i) => [...(d[i] ?? d[d.length - 1] ?? duracaoPadrao)]);

// ---------- exportação ----------
/** Uma faixa horizontal com os bitmaps lado a lado (sequência de quadros). */
export function faixaDeQuadros(bitmaps) {
  const w = bitmaps.reduce((s, b) => s + b.w, 0);
  const h = Math.max(1, ...bitmaps.map((b) => b.h));
  const faixa = criarBitmap(w, h);
  let x = 0;
  for (const b of bitmaps) { colar(faixa, b, x, 0); x += b.w; }
  return faixa;
}
/** A configuração da animação como JSON legível (para exportar). */
export const configuracaoDaAnimacao = (meta, look = null) => JSON.stringify({ look, cw: meta.cw, ch: meta.ch, shift: meta.shift, grupos: meta.groups.map((g, i) => ({ nome: i === 0 ? 'parado' : 'caminhada', quadros: g.frames, direcoes: g.dirs, camadas: g.layers, addons: g.addons, poses: g.depth, loop: g.animation?.loop ?? 0, duracoes: g.animation?.durations ?? null })) }, null, 2);
