// As PRÉ-VISUALIZAÇÕES do editor de sprites: isolado (fundo quadriculado, zoom, grade), contextual (o bicho/personagem/montaria andando num cenário
// de teste, desenhado pelo MESMO `drawCreature` do jogo) e comparação (original × editado, alternar, diferença por pixel). Mais o seletor da paleta de
// cores de outfit. O laço de animação é um só por pré-visualização e para sozinho quando o canvas sai do documento (nada vaza ao fechar a tela).
import { el } from './editor-ui.mjs';
import { jogo } from './editor-sprites.mjs';
import { comporCelula, lerCelula, quadroNoTempo, posicaoNoPercurso } from '/packages/shared/src/sprite-edicao.mjs';
import { outfitColor } from '/packages/shared/src/outfit-color.mjs';
import { DIRECOES, criarBitmap } from '/packages/shared/src/sprite-folha.mjs';
import { paraCanvas } from './editor-sprites-io.mjs';

export const SLOTS_DE_COR = [['head', 'Cabeça'], ['body', 'Corpo'], ['legs', 'Pernas'], ['feet', 'Pés']];
const rgb = (i) => `rgb(${outfitColor(i).join(',')})`;

/** O seletor de cor da paleta do jogo (133 cores, 19 × 7): um botão com a cor e, ao clicar, a grade. */
export function seletorDeCor(rotulo, indice, aoEscolher) {
  const botao = el('button', { type: 'button', class: 'spr-cor-botao', title: `${rotulo}: cor ${indice}` }, el('span', { class: 'spr-cor-amostra', style: `background:${rgb(indice)}` }), el('span', {}, rotulo), el('small', {}, String(indice)));
  const grade = el('div', { class: 'spr-paleta', hidden: true }, Array.from({ length: 133 }, (_, i) => el('button', { type: 'button', class: i === indice ? 'atual' : '', title: String(i), style: `background:${rgb(i)}`, onclick: () => { grade.hidden = true; aoEscolher(i); } })));
  botao.addEventListener('click', () => { grade.hidden = !grade.hidden; });
  return el('div', { class: 'spr-cor' }, botao, grade);
}

/** Escala inteira que cabe em `largura` (nunca borra: pixel art só amplia por inteiro). */
const escalaInteira = (w, alvo) => Math.max(1, Math.floor(alvo / Math.max(1, w)));

/**
 * Cria o painel de pré-visualização. `ctx` entrega o que muda a todo instante (`E`: estado da tela; `atual()`: estado de edição; `original()`: o original
 * verdadeiro; `chaves`: nomes das variantes registradas no renderer do jogo).
 */
export function criarPrevia(ctx) {
  const raizEl = el('div', { class: 'spr-previa' });
  let laco = 0;
  const t0 = performance.now();

  const barra = () => {
    const E = ctx.E;
    const modo = (id, nome) => el('button', { type: 'button', class: E.modoPreview === id ? 'ativa' : '', onclick: () => { E.modoPreview = id; desenhar(); } }, nome);
    return el('div', { class: 'spr-previa-barra' },
      el('div', { class: 'eng-abas' }, modo('isolado', 'Isolado'), modo('contextual', 'Contextual'), modo('comparacao', 'Comparação')),
      el('div', { class: 'spr-controles' },
        el('button', { type: 'button', class: E.tocando ? 'ativa' : '', title: 'Reproduzir / pausar (espaço)', onclick: () => { E.tocando = !E.tocando; desenhar(); } }, E.tocando ? '⏸ pausar' : '▶ reproduzir'),
        el('label', { class: 'spr-rot' }, 'velocidade', el('select', { onchange: (e) => { E.velocidade = Number(e.target.value); } }, [0.25, 0.5, 1, 1.5, 2, 4].map((v) => el('option', { value: v, selected: v === E.velocidade }, `${v}×`)))),
        el('label', { class: 'spr-rot' }, 'zoom', el('select', { onchange: (e) => { E.zoomPreview = Number(e.target.value); desenhar(); } }, [1, 2, 3, 4, 6, 8].map((v) => el('option', { value: v, selected: v === E.zoomPreview }, `${v}×`)))),
        E.modoPreview === 'isolado' ? el('button', { type: 'button', class: E.vista === 'todas' ? 'ativa' : '', title: 'Mostrar as quatro direções juntas', onclick: () => { E.vista = E.vista === 'todas' ? 'uma' : 'todas'; desenhar(); } }, '4 direções') : null,
        E.modoPreview === 'isolado' ? el('button', { type: 'button', class: E.gradePreview ? 'ativa' : '', onclick: () => { E.gradePreview = !E.gradePreview; desenhar(); } }, 'grade') : null));
  };

  // ---- isolado: a célula composta (com a cor dinâmica, se houver), em fundo quadriculado
  function pintarCelulaIsolada(canvas, estado, g, quadro, pos, escala) {
    const { cw, ch } = estado.meta;
    const comp = comporCelula(estado, g, quadro, pos, ctx.coresAtivas());
    canvas.width = cw * escala;
    canvas.height = ch * escala;
    const c = canvas.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, canvas.width, canvas.height);
    const tmp = paraCanvas(comp);
    c.drawImage(tmp, 0, 0, cw * escala, ch * escala);
    if (ctx.E.gradePreview && escala >= 4) {
      c.strokeStyle = 'rgba(255,255,255,.08)';
      c.lineWidth = 1;
      c.beginPath();
      for (let x = 0; x <= cw; x++) { c.moveTo(x * escala + .5, 0); c.lineTo(x * escala + .5, ch * escala); }
      for (let y = 0; y <= ch; y++) { c.moveTo(0, y * escala + .5); c.lineTo(cw * escala, y * escala + .5); }
      c.stroke();
    }
  }
  const quadroDaVez = (estado, g, agora) => {
    const E = ctx.E;
    return E.tocando ? quadroNoTempo(estado.meta.groups[g], agora - t0, { velocidade: E.velocidade }) : Math.min(E.i, estado.meta.groups[g].frames - 1);
  };
  function isolado() {
    const E = ctx.E;
    const estado = ctx.atual();
    const { cw, ch } = estado.meta;
    const esc = E.zoomPreview ?? escalaInteira(cw, 192);
    const dirs = E.vista === 'todas' ? Array.from({ length: estado.meta.groups[E.g].dirs ?? 1 }, (_, d) => d) : [E.dir];
    const telas = dirs.map((d) => ({ d, canvas: el('canvas', { class: 'spr-xadrez', title: DIRECOES[d] ?? '' }) }));
    const real = el('canvas', { class: 'spr-real', title: 'Tamanho real (1×)' });
    const corpo = el('div', { class: 'spr-isolado' }, el('div', { class: 'spr-isolado-linha' }, telas.map(({ d, canvas }) => el('figure', {}, canvas, el('figcaption', {}, DIRECOES[d] ?? `dir ${d}`)))), el('figure', { class: 'spr-real-fig' }, real, el('figcaption', {}, `tamanho real · ${cw}×${ch}`)));
    const quadro = (agora) => {
      const e = ctx.atual();
      const q = quadroDaVez(e, E.g, agora);
      for (const { d, canvas } of telas) pintarCelulaIsolada(canvas, e, E.g, q, { z: E.z, addon: E.addon, dir: d, layer: 0 }, esc);
      pintarCelulaIsolada(real, e, E.g, q, { z: E.z, addon: E.addon, dir: E.dir, layer: 0 }, 1);
    };
    return { corpo, quadro, estatico: !E.tocando };
  }

  // ---- contextual: o MESMO renderer do jogo, num cenário de teste, com movimentação simulada
  // O percurso do boneco no cenário de teste: `posicaoNoPercurso` (puro, em engine/sprite-edicao.mjs).
  async function cena({ look, mount = null, colors = null, addons = 0, rotulo }) {
    const J = await jogo();
    const E = ctx.E;
    const W = 7 * 32;
    const H = 5 * 32;
    const canvas = el('canvas', { class: 'spr-cena', width: W, height: H, title: rotulo ?? '' });
    const c = canvas.getContext('2d');
    c.imageSmoothingEnabled = false;
    const esc = E.zoomPreview ?? 2;
    canvas.style.width = `${W * esc}px`;
    canvas.style.height = `${H * esc}px`;
    const chao = () => {
      for (let y = 0; y < 5; y++) for (let x = 0; x < 7; x++) { c.fillStyle = (x + y) % 2 ? '#3d5a2f' : '#44663a'; c.fillRect(x * 32, y * 32, 32, 32); }
      c.fillStyle = 'rgba(0,0,0,.18)';
      c.fillRect(1 * 32, 1 * 32 + 30, 5 * 32, 2);
    };
    const quadro = (agora) => {
      chao();
      const t = (agora - t0) / 1000;
      const andando = E.tocando && E.movimentoSimulado !== false;
      const p = andando ? posicaoNoPercurso(t, 1.6 * E.velocidade) : { x: 3, y: 2, dir: E.dir };
      const dir = andando ? p.dir : E.dir;
      const e = ctx.atual();
      const grupo = andando ? 1 : 0;
      const meta = J.outfitInfo(look);
      const gr = meta?.groups?.[Math.min(grupo, (meta?.groups?.length ?? 1) - 1)] ?? e.meta.groups[0];
      const frame = quadroNoTempo(gr, agora - t0, { velocidade: E.velocidade });
      J.drawCreature(c, { look, colors, dir, frame, walking: andando, mount, addons }, Math.round(p.x * 32), Math.round(p.y * 32));
    };
    return { canvas, quadro };
  }
  const contextoDaCategoria = () => {
    const E = ctx.E;
    const base = { colors: ctx.coresAtivas(), addons: E.addons };
    if (E.categoria === 'montarias') return { ...base, look: E.cavaleiro.look, mount: ctx.chaves.rascunho, addons: E.cavaleiro.addons, colors: E.cavaleiro.cores };
    return { ...base, look: ctx.chaves.rascunho, mount: E.montado ? E.montariaDeTeste : null };
  };
  async function contextual() {
    const E = ctx.E;
    const c = await cena({ ...contextoDaCategoria(), rotulo: 'Rascunho no cenário de teste' });
    const nota = E.categoria === 'montarias'
      ? 'A montaria é desenhada no tile e o personagem por cima, no MESMO ponto, na pose montada do outfit dele (é assim que o jogo faz: não existe deslocamento do cavaleiro por montaria).'
      : E.categoria === 'monstros' ? 'O monstro andando no cenário de teste, desenhado pelo mesmo renderer do jogo (âncora no canto inferior direito do tile).' : 'O outfit num personagem de teste, com as cores e addons escolhidos.';
    return { corpo: el('div', { class: 'spr-contextual' }, c.canvas, el('p', { class: 'dica' }, nota)), quadro: c.quadro };
  }

  // ---- comparação: original × editado (lado a lado, alternar, diferença por pixel)
  async function comparacao() {
    const E = ctx.E;
    const base = contextoDaCategoria();
    const trocar = (chave) => (E.categoria === 'montarias' ? { ...base, mount: chave } : { ...base, look: chave });
    const a = await cena({ ...trocar(ctx.chaves.original), rotulo: 'Original' });
    const b = await cena({ ...trocar(ctx.chaves.rascunho), rotulo: 'Editado' });
    const esc = Math.max(1, Math.min(E.zoomPreview ?? 4, 8));
    const orig = ctx.original();
    const diff = el('canvas', { class: 'spr-xadrez spr-diff', title: 'Diferença: rosa = pixel que mudou nesta célula' });
    const quadroDiff = (agora) => {
      const e = ctx.atual();
      const q = quadroDaVez(e, E.g, agora);
      const pos = { z: E.z, addon: E.addon, dir: E.dir, layer: E.layer };
      const x = lerCelula(e, E.g, Math.min(q, e.meta.groups[E.g].frames - 1), pos);
      const o = orig.quadros[E.g]?.[Math.min(q, orig.quadros[E.g].length - 1)] ? lerCelula(orig, E.g, Math.min(q, orig.quadros[E.g].length - 1), pos) : criarBitmap(x.w, x.h);
      const saida = criarBitmap(x.w, x.h);
      let mudou = 0;
      for (let i = 0; i < x.data.length; i += 4) {
        const igual = x.data[i] === o.data[i] && x.data[i + 1] === o.data[i + 1] && x.data[i + 2] === o.data[i + 2] && x.data[i + 3] === o.data[i + 3];
        if (!igual && (x.data[i + 3] || o.data[i + 3])) { saida.data.set([255, 60, 200, 255], i); mudou++; } else if (x.data[i + 3]) saida.data.set([x.data[i], x.data[i + 1], x.data[i + 2], 70], i);
      }
      if (o.w !== x.w || o.h !== x.h) mudou = -1;
      diff.width = x.w * esc;
      diff.height = x.h * esc;
      const c = diff.getContext('2d');
      c.imageSmoothingEnabled = false;
      c.clearRect(0, 0, diff.width, diff.height);
      c.drawImage(paraCanvas(saida), 0, 0, diff.width, diff.height);
      legenda.textContent = mudou < 0 ? 'Tamanhos de quadro diferentes: não dá para comparar pixel a pixel.' : mudou ? `${mudou} pixel(s) diferente(s) neste quadro/direção.` : 'Idêntico ao original neste quadro/direção.';
    };
    const legenda = el('div', { class: 'dica' });
    // alternar (A/B): mantém o mesmo lugar e troca entre original e editado
    let mostrando = 'editado';
    const ab = el('button', { type: 'button', class: 'spr-ab', title: 'Alternar entre o original e o editado, no mesmo lugar', onclick: () => { mostrando = mostrando === 'editado' ? 'original' : 'editado'; ab.textContent = `A/B: ${mostrando}`; } }, 'A/B: editado');
    const unico = el('canvas', { class: 'spr-cena', width: 7 * 32, height: 5 * 32 });
    unico.style.width = `${7 * 32 * Math.min(esc, 3)}px`;
    unico.style.height = `${5 * 32 * Math.min(esc, 3)}px`;
    const uc = unico.getContext('2d');
    uc.imageSmoothingEnabled = false;
    const corpo = el('div', { class: 'spr-comparacao' },
      el('div', { class: 'spr-comparacao-duas' }, el('figure', {}, a.canvas, el('figcaption', {}, 'Original')), el('figure', {}, b.canvas, el('figcaption', {}, 'Editado'))),
      el('div', { class: 'spr-comparacao-ab' }, ab, unico),
      el('figure', {}, diff, el('figcaption', {}, 'Diferença (quadro e direção atuais)')), legenda);
    const quadro = (agora) => {
      a.quadro(agora);
      b.quadro(agora);
      quadroDiff(agora);
      uc.clearRect(0, 0, unico.width, unico.height);
      uc.drawImage(mostrando === 'editado' ? b.canvas : a.canvas, 0, 0);
    };
    return { corpo, quadro };
  }

  async function desenhar() {
    cancelAnimationFrame(laco);
    const E = ctx.E;
    const meu = (E.pedidoPreview = (E.pedidoPreview ?? 0) + 1);
    let r;
    try {
      r = E.modoPreview === 'contextual' ? await contextual() : E.modoPreview === 'comparacao' ? await comparacao() : isolado();
    } catch (e) {
      raizEl.replaceChildren(barra(), el('div', { class: 'bib-alerta' }, `Não foi possível montar a pré-visualização: ${e.message}`));
      return;
    }
    if (meu !== E.pedidoPreview) return;
    raizEl.replaceChildren(barra(), r.corpo);
    const passo = (agora) => {
      if (!r.corpo.isConnected) return;
      try { r.quadro(agora); } catch (e) { console.warn('[sprites] pré-visualização:', e.message); return; }
      laco = requestAnimationFrame(passo);
    };
    laco = requestAnimationFrame(passo);
  }
  return { elemento: raizEl, desenhar, parar: () => cancelAnimationFrame(laco) };
}
