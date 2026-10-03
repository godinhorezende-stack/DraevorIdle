// A FOLHA DE SPRITES de uma criatura (monstro, outfit de personagem ou montaria — o jogo usa o MESMO formato para os três): geometria, recorte
// em quadros e validação. Puro (sem DOM, sem arquivos): o cliente (editor e renderer) e o servidor (validação ao salvar) leem as mesmas regras.
//
// O formato (conferido nos 1307 desenhos de `gamedata/outfits.json` + `gamedata/sprites/outfits/<look>.png`):
//   - UMA imagem por `look`, em células de `cw`×`ch` pixels;
//   - cada LINHA da imagem é um quadro da animação (`groups[g].row` + quadro); o grupo 0 é a pose parada, o grupo 1 (quando existe) é a caminhada;
//   - cada COLUNA é `(((z * addons + addon) * dirs + dir) * layers + layer)`: `z` 0 = em pé, 1 = pose MONTADA (só nos outfits de personagem);
//     `addon` 0..2 (os addons são cumulativos); `dir` 0 norte, 1 leste, 2 sul, 3 oeste; `layer` 0 = desenho, 1 = MÁSCARA de cores (amarelo/vermelho/
//     verde/azul marcam cabeça/corpo/pernas/pés: o jogo tinge o desenho por ela, por isso a máscara NUNCA é pintada com a cor final);
//   - `animation.durations[i]` = `[mín, máx]` em ms do quadro i; `shift` = deslocamento geral do desenho.

export const DIRECOES = ['norte', 'leste', 'sul', 'oeste'];
export const LIMITES = { celula: [8, 256], quadros: 64, bytes: 4 * 1024 * 1024, lado: 8192, duracao: [0, 60000], shift: 64 };
/** As cores-chave da máscara (iguais às de `engine/outfit-color.mjs`). */
export const CORES_DA_MASCARA = [[255, 255, 0, 'cabeça'], [255, 0, 0, 'corpo'], [0, 255, 0, 'pernas'], [0, 0, 255, 'pés']];

// ---------- bitmaps (RGBA 8 bits) ----------
export const criarBitmap = (w, h) => ({ w, h, data: new Uint8ClampedArray(w * h * 4) });
export const clonarBitmap = (b) => ({ w: b.w, h: b.h, data: new Uint8ClampedArray(b.data) });
export const bitmapDe = (w, h, data) => ({ w, h, data: data instanceof Uint8ClampedArray ? data : new Uint8ClampedArray(data) });
/** O bitmap tem algum pixel visível? */
export function temPixel(b) {
  for (let i = 3; i < b.data.length; i += 4) if (b.data[i]) return true;
  return false;
}
/** Copia a região `{x,y,w,h}` (fora da imagem = transparente). */
export function recortar(b, { x, y, w, h }) {
  const s = criarBitmap(w, h);
  for (let j = 0; j < h; j++) {
    const sy = y + j;
    if (sy < 0 || sy >= b.h) continue;
    for (let i = 0; i < w; i++) {
      const sx = x + i;
      if (sx < 0 || sx >= b.w) continue;
      const o = (sy * b.w + sx) * 4;
      const d = (j * w + i) * 4;
      s.data[d] = b.data[o]; s.data[d + 1] = b.data[o + 1]; s.data[d + 2] = b.data[o + 2]; s.data[d + 3] = b.data[o + 3];
    }
  }
  return s;
}
/** Cola `origem` em `destino` na posição (x, y), SEM misturar: o pixel colado (mesmo transparente) substitui, ou, com `soVisivel`, só os visíveis entram. */
export function colar(destino, origem, x, y, { soVisivel = false } = {}) {
  for (let j = 0; j < origem.h; j++) {
    const dy = y + j;
    if (dy < 0 || dy >= destino.h) continue;
    for (let i = 0; i < origem.w; i++) {
      const dx = x + i;
      if (dx < 0 || dx >= destino.w) continue;
      const o = (j * origem.w + i) * 4;
      if (soVisivel && !origem.data[o + 3]) continue;
      const d = (dy * destino.w + dx) * 4;
      destino.data[d] = origem.data[o]; destino.data[d + 1] = origem.data[o + 1]; destino.data[d + 2] = origem.data[o + 2]; destino.data[d + 3] = origem.data[o + 3];
    }
  }
  return destino;
}

// ---------- geometria ----------
/** Quantas colunas de células o grupo tem. */
export const colunasDoGrupo = (g) => (g.dirs ?? 1) * (g.layers ?? 1) * (g.addons ?? 1) * (g.depth ?? 1);
/** A estrutura derivada do meta: colunas, linhas e o tamanho esperado da imagem. */
export function estruturaDe(meta) {
  const grupos = meta.groups ?? [];
  const cols = Math.max(1, ...grupos.map(colunasDoGrupo));
  const linhas = grupos.reduce((n, g) => n + (g.frames ?? 1), 0);
  return { cols, linhas, w: meta.cw * cols, h: meta.ch * linhas };
}
/** Índice da coluna da célula `{z, addon, dir, layer}` no grupo `g`. */
export const colunaDa = (g, { z = 0, addon = 0, dir = 0, layer = 0 } = {}) => (((z * (g.addons ?? 1) + addon) * (g.dirs ?? 1) + dir) * (g.layers ?? 1) + layer);
/** O retângulo da célula na imagem. `quadro` é o índice DENTRO do grupo. */
export const retanguloDaCelula = (meta, g, quadro, pos) => ({ x: colunaDa(meta.groups[g], pos) * meta.cw, y: (meta.groups[g].row + quadro) * meta.ch, w: meta.cw, h: meta.ch });
/** Todas as posições `{z, addon, dir, layer}` que o grupo tem (a ordem das colunas). */
export function posicoesDoGrupo(g) {
  const lista = [];
  for (let z = 0; z < (g.depth ?? 1); z++) for (let addon = 0; addon < (g.addons ?? 1); addon++) for (let dir = 0; dir < (g.dirs ?? 1); dir++) for (let layer = 0; layer < (g.layers ?? 1); layer++) lista.push({ z, addon, dir, layer });
  return lista;
}
export const chaveDaPosicao = ({ z = 0, addon = 0, dir = 0, layer = 0 } = {}) => `${z}.${addon}.${dir}.${layer}`;

// ---------- a folha em quadros editáveis ----------
/**
 * Desmonta a imagem em QUADROS: `quadros[g][i]` é um objeto `{ 'z.addon.dir.layer': Bitmap(cw×ch) }`. Célula fora da imagem (folha menor que o meta
 * declara — há um caso assim nos dados originais) vira transparente; célula vazia não ocupa lugar no objeto.
 */
export function desmontar(meta, folha) {
  return meta.groups.map((g, gi) => Array.from({ length: g.frames ?? 1 }, (_, i) => {
    const quadro = {};
    for (const pos of posicoesDoGrupo(g)) {
      const c = recortar(folha, retanguloDaCelula(meta, gi, i, pos));
      if (temPixel(c)) quadro[chaveDaPosicao(pos)] = c;
    }
    return quadro;
  }));
}
/** O inverso: monta a imagem do tamanho que o meta pede, refazendo `row` de cada grupo conforme a quantidade de quadros. */
export function montar(meta, quadros) {
  const grupos = meta.groups.map((g, gi) => ({ ...g, frames: quadros[gi].length }));
  let row = 0;
  for (const g of grupos) { g.row = row; row += g.frames; }
  const novo = { ...meta, groups: grupos };
  const { w, h } = estruturaDe(novo);
  const folha = criarBitmap(w, h);
  grupos.forEach((g, gi) => quadros[gi].forEach((quadro, i) => {
    for (const [chave, bitmap] of Object.entries(quadro)) {
      const [z, addon, dir, layer] = chave.split('.').map(Number);
      const r = retanguloDaCelula(novo, gi, i, { z, addon, dir, layer });
      colar(folha, bitmap, r.x, r.y);
    }
  }));
  return { meta: { ...novo, w, h }, folha };
}

// ---------- validação ----------
const inteiro = (n) => Number.isInteger(n);
const dentro = (n, [a, b]) => inteiro(n) && n >= a && n <= b;

/**
 * Valida o META (a estrutura) e compara com o original. `erros` impedem salvar; `avisos` são o que merece atenção. Cada mensagem diz o que corrigir.
 */
export function validarMeta(meta, original = null) {
  const erros = [];
  const avisos = [];
  if (!meta || typeof meta !== 'object') return { erros: ['O cadastro de quadros (meta) está ausente.'], avisos };
  if (!dentro(meta.cw, LIMITES.celula) || !dentro(meta.ch, LIMITES.celula)) erros.push(`Tamanho do quadro inválido (${meta.cw}×${meta.ch}): cada lado precisa ser um inteiro de ${LIMITES.celula[0]} a ${LIMITES.celula[1]} pixels.`);
  const grupos = meta.groups;
  if (!Array.isArray(grupos) || grupos.length < 1 || grupos.length > 2) { erros.push('Precisa de 1 grupo (parado) ou 2 (parado e caminhada).'); return { erros, avisos }; }
  let proximaLinha = 0;
  grupos.forEach((g, i) => {
    const nome = i === 0 ? 'parado' : 'caminhada';
    if (!dentro(g.frames, [1, LIMITES.quadros])) erros.push(`Grupo ${nome}: ${g.frames} quadros — use de 1 a ${LIMITES.quadros}.`);
    if (![1, 4].includes(g.dirs)) erros.push(`Grupo ${nome}: ${g.dirs} direções — o jogo lê 1 ou 4.`);
    if (![1, 2].includes(g.layers)) erros.push(`Grupo ${nome}: ${g.layers} camadas — o jogo lê 1 (desenho) ou 2 (desenho + máscara de cores).`);
    if (!dentro(g.addons, [1, 3])) erros.push(`Grupo ${nome}: ${g.addons} addons — o jogo lê de 1 a 3.`);
    if (![1, 2].includes(g.depth)) erros.push(`Grupo ${nome}: profundidade ${g.depth} — o jogo lê 1 (em pé) ou 2 (em pé e montada).`);
    if (g.row !== proximaLinha) erros.push(`Grupo ${nome}: começa na linha ${g.row}, mas devia ser a ${proximaLinha} (os grupos ficam em sequência, um quadro por linha).`);
    proximaLinha += g.frames ?? 0;
    const a = g.animation;
    if (a !== null && a !== undefined) {
      if (!Array.isArray(a.durations) || a.durations.length !== g.frames) erros.push(`Grupo ${nome}: a animação tem ${a.durations?.length ?? 0} durações para ${g.frames} quadros — precisa de uma por quadro.`);
      else if (a.durations.some((d) => !(Array.isArray(d) ? d : [d]).every((v) => dentro(v, LIMITES.duracao)))) erros.push(`Grupo ${nome}: cada duração precisa ser um inteiro de ${LIMITES.duracao[0]} a ${LIMITES.duracao[1]} ms (0 = o padrão do jogo, 200 ms).`);
      if (!inteiro(a.loop)) erros.push(`Grupo ${nome}: "loop" precisa ser um inteiro (0 = repete para sempre).`);
    } else if (g.frames > 1) avisos.push(`Grupo ${nome}: ${g.frames} quadros sem tempos — o jogo usa 200 ms por quadro.`);
  });
  if (!Array.isArray(meta.shift) || meta.shift.length !== 2 || !meta.shift.every((v) => dentro(v, [-LIMITES.shift, LIMITES.shift]))) erros.push(`O deslocamento (shift) precisa ser [x, y] com inteiros de -${LIMITES.shift} a ${LIMITES.shift}.`);
  const estruturas = new Set(grupos.map((g) => `${g.dirs}/${g.layers}/${g.addons}/${g.depth}`));
  if (estruturas.size > 1) erros.push('Os grupos precisam ter as mesmas direções, camadas, addons e profundidade.');
  const estruturaOk = !erros.length;
  if (original && estruturaOk) {
    const o = original.groups[0];
    const g = grupos[0];
    for (const [campo, nome] of [['dirs', 'direções'], ['layers', 'camadas (desenho/máscara)'], ['addons', 'addons'], ['depth', 'poses (em pé/montada)']]) {
      if (g[campo] !== o[campo]) erros.push(`${nome[0].toUpperCase()}${nome.slice(1)}: o original tem ${o[campo]} e a edição ${g[campo]}. O jogo acha cada coluna por essa conta (e o resto do jogo — cores, addons, montaria — depende dela); essa estrutura não pode mudar.`);
    }
    if (grupos.length !== original.groups.length) avisos.push(`O original tem ${original.groups.length} grupo(s) e a edição ${grupos.length}: ${grupos.length < original.groups.length ? 'sem o grupo de caminhada o jogo usa a pose parada ao andar' : 'o jogo passa a usar o grupo de caminhada'}.`);
    if (meta.cw !== original.cw || meta.ch !== original.ch) avisos.push(`O tamanho do quadro mudou (${original.cw}×${original.ch} → ${meta.cw}×${meta.ch}). O jogo ancora o desenho no canto inferior direito do tile: confira o alinhamento no modo contextual.`);
    grupos.forEach((gr, i) => { const og = original.groups[i]; if (og && og.frames !== gr.frames) avisos.push(`Grupo ${i === 0 ? 'parado' : 'caminhada'}: ${og.frames} → ${gr.frames} quadros. O jogo passa a usar a nova quantidade; confira o ritmo da animação.`); });
  }
  if (estruturaOk && !erros.length) {
    const esperado = estruturaDe(meta);
    if (meta.w !== esperado.w || meta.h !== esperado.h) erros.push(`O tamanho declarado da imagem (${meta.w}×${meta.h}) não bate com a conta dos quadros (${esperado.w}×${esperado.h}).`);
  }
  return { erros, avisos };
}

/** O pixel é uma das cores-chave da máscara (e opaco)? */
const ehCorDaMascara = (d, o) => d[o + 3] === 255 && CORES_DA_MASCARA.some(([r, g, b]) => d[o] === r && d[o + 1] === g && d[o + 2] === b);

/**
 * Valida os PIXELS da folha contra o meta (e, se houver, contra o original). Devolve também `estatisticas` (quadros vazios, pixels opacos...).
 * `folha` = Bitmap. Mensagens específicas: dizem onde está o problema e como corrigir.
 */
export function validarPixels(folha, meta, original = null) {
  const erros = [];
  const avisos = [];
  const esperado = estruturaDe(meta);
  if (folha.w !== esperado.w || folha.h !== esperado.h) {
    erros.push(`A imagem tem ${folha.w}×${folha.h}, mas o cadastro pede ${esperado.w}×${esperado.h} (${meta.cw}×${meta.ch} por quadro, ${esperado.cols} colunas × ${esperado.linhas} linhas). Ajuste o tamanho do quadro ou a quantidade de quadros.`);
    return { erros, avisos, estatisticas: null };
  }
  const d = folha.data;
  let opacos = 0;
  let transparentes = 0;
  let meios = 0;
  for (let i = 3; i < d.length; i += 4) {
    if (d[i] === 0) transparentes++;
    else if (d[i] === 255) opacos++;
    else meios++;
  }
  if (!opacos && !meios) erros.push('A folha está completamente vazia (nenhum pixel visível).');
  else if (!transparentes) erros.push('A folha não tem nenhum pixel transparente: provavelmente há um fundo sólido. Apague o fundo (use a borracha ou exporte o PNG com transparência).');
  if (meios && meios / Math.max(1, opacos + meios) > 0.05) avisos.push(`${Math.round((meios / (opacos + meios)) * 100)}% dos pixels visíveis são semitransparentes (suavização). Pixel art costuma usar só pixels totalmente opacos ou transparentes — bordas borradas aparecem sujas no jogo.`);
  const estatisticas = { opacos, meios, transparentes, quadrosVazios: 0, mascaraForaDoPadrao: 0 };
  const quadros = erros.length ? null : desmontar(meta, folha);
  if (!quadros) return { erros, avisos, estatisticas };
  const refQuadros = original?.folha && original?.meta ? desmontar(original.meta, original.folha) : null;
  meta.groups.forEach((g, gi) => {
    const nome = gi === 0 ? 'parado' : 'caminhada';
    {
      for (let dir = 0; dir < (g.dirs ?? 1); dir++) {
        const chave = chaveDaPosicao({ z: 0, addon: 0, layer: 0, dir });
        const vazios = [];
        quadros[gi].forEach((q, i) => { if (!q[chave]) vazios.push(i + 1); });
        if (vazios.length === quadros[gi].length) {
          const tinha = refQuadros?.[gi]?.some((q) => q[chave]);
          const msg = `Direção ${DIRECOES[dir] ?? dir} (${nome}) sem nenhum desenho.`;
          if (tinha) erros.push(`${msg} O original tinha: restaure a direção (copie de outra direção ou do original) antes de salvar.`);
          else if (g.dirs === 4) avisos.push(`${msg} Se o bicho não usa essa direção, tudo bem; senão, desenhe ou copie de outra direção (espelhando leste ↔ oeste).`);
        } else if (vazios.length) {
          estatisticas.quadrosVazios += vazios.length;
          avisos.push(`Direção ${DIRECOES[dir] ?? dir} (${nome}): quadro(s) ${vazios.slice(0, 8).join(', ')} vazio(s), mas outros têm desenho — a animação pisca. Desenhe-os ou remova esses quadros na linha do tempo.`);
        }
      }
    }
    if ((g.layers ?? 1) > 1) {
      let fora = 0;
      quadros[gi].forEach((q) => { for (const [chave, b] of Object.entries(q)) if (chave.endsWith('.1')) for (let o = 0; o < b.data.length; o += 4) if (b.data[o + 3] && !ehCorDaMascara(b.data, o)) fora++; });
      if (fora) { estatisticas.mascaraForaDoPadrao += fora; avisos.push(`Máscara de cores (${nome}): ${fora} pixel(s) fora das 4 cores-chave (amarelo = cabeça, vermelho = corpo, verde = pernas, azul = pés, todas opacas). O jogo ignora esses pixels: a cor dinâmica não os atinge.`); }
    }
  });
  return { erros, avisos, estatisticas };
}

/**
 * Aplica `gamedata/overrides/sprites.json` sobre o cadastro de quadros original. Puro: devolve `{ metas, urls }` só com os looks que valem — override
 * ligado (global e da entrada), com cadastro completo e que EXISTE nos desenhos originais. O cliente do jogo (`sprites.mjs`) usa o resultado.
 */
export function resolverOverrides(dados, metasOriginais) {
  const metas = {};
  const urls = {};
  if (!dados || dados.ativo === false) return { metas, urls };
  for (const [look, e] of Object.entries(dados.sprites ?? {})) {
    if (e?.ativo === false || !e?.meta?.groups?.length || !metasOriginais[look]) continue;
    metas[look] = e.meta;
    urls[look] = `/gamedata/overrides/sprites/${look}.png?v=${e.hash ?? ''}`;
  }
  return { metas, urls };
}
