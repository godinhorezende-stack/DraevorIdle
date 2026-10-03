/*
 * ---- O NAMEPLATE do jogador: esfera de nível, nome, vida e mana ----
 *
 *        ( 85 )  Draevor
 *                ████████████   vida (verde)
 *                █████████      mana (azul)
 *
 * Substitui, para o PERSONAGEM e os outros jogadores (os da praça e os companheiros de party/duelo), o nome solto em
 * cima de uma barrinha de 27 px. Criaturas, NPCs e o familiar seguem com o desenho de sempre (`drawNameplate`, em
 * `map.mjs`): a esfera é a insígnia de GENTE.
 *
 * ---- Como ele fica barato ----
 * O overlay do mapa é redesenhado inteiro a cada quadro, então nada aqui desenha texto nem gradiente por quadro:
 *   - a PLACA (esfera + nível + nome com contorno + os trilhos das barras) é pintada UMA vez numa telinha e depois é
 *     um `drawImage`; a chave leva tudo que muda o desenho (nome, nível, escala, ratio, se tem mana, se é o próprio);
 *     subiu de nível → chave nova → uma placa nova, e a velha sai pelo teto do cache;
 *   - o PREENCHIMENTO de cada barra também é uma telinha (barra cheia, cantos redondos), e por quadro é um
 *     `drawImage` recortado na fração da vida/mana — sem caminho, sem gradiente, sem `fillText`;
 *   - fora da tela não desenha nada (`dentroDaTela`).
 * Os números de vida e mana vêm do snapshot que o cliente já recebe: nenhum pacote a mais.
 *
 * ---- Tudo que se ajusta mora em `NAMEPLATE` ----
 * Tamanho da esfera, fonte, largura das barras, distância do boneco, espaço esfera-nome, cores, barras ligadas ou
 * não, escala do telefone. Nada de número solto no desenho.
 */

export const NAMEPLATE = Object.freeze({
  esfera: Object.freeze({ diametro: 28, fonteDoNivel: 12, fonteDoNivelGrande: 10 }), // `Grande`: nível de 3 dígitos
  nome: Object.freeze({ fonte: 12, larguraMaxima: 84, cor: '#e8e4d8', corDoPropriario: '#fff3cf' }),
  barras: Object.freeze({
    largura: 64,
    alturaDaVida: 5,
    alturaDaMana: 4,
    espaco: 1,
    mostrarVida: true,
    mostrarMana: true,
    corDaVida: Object.freeze(['#58d94c', '#2f9a2b']), // topo, base do degradê
    corDaMana: Object.freeze(['#4f9bff', '#2557b8']),
    trilho: '#07090b',
    bordaDoTrilho: 'rgba(0,0,0,.9)',
  }),
  esfera2: Object.freeze({ ouro: Object.freeze(['#f6e2a0', '#c8932f', '#6f4b13']), fundo: Object.freeze(['#2a2118', '#0a0b0d']), numero: '#f6f1e4' }),
  espacoEsferaNome: 5,
  distanciaVertical: 6, // do alto da casa do boneco até a base do conjunto
  escala: Object.freeze({ desktop: 1, telefone: 0.82 }), // multiplicador final; o do telefone vale nos perfis `retrato` e `deitado`
  zoom: Object.freeze({ peso: 0.35, minimo: 0.85, maximo: 1.2 }), // o mapa dá zoom; o nameplate acompanha só um pouco
  passoDaEscala: 0.05, // a escala é arredondada em degraus: poucas chaves de cache, sem borrar
  tetoDoCache: 160,
});

const OUTLINE = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
const limitar = (v, a, b) => Math.min(b, Math.max(a, v));

/** A escala final (desktop/telefone × um pouco do zoom do mapa), em degraus. */
export function escalaDoNameplate({ zoom = 1, telefone = false, cfg = NAMEPLATE } = {}) {
  const base = telefone ? cfg.escala.telefone : cfg.escala.desktop;
  const z = limitar(1 + (zoom - 1) * cfg.zoom.peso, cfg.zoom.minimo, cfg.zoom.maximo);
  const bruta = base * z;
  return Math.max(cfg.passoDaEscala, Math.round(bruta / cfg.passoDaEscala) * cfg.passoDaEscala);
}

/**
 * A caixa do conjunto, em pixels de tela (antes de encaixar na grade de pixels): centralizada no boneco, com a base
 * `distanciaVertical` acima do alto da casa. `larguraDoNome` já é a do texto (cortado em `larguraMaxima`).
 */
export function calcularLayout({ cx, topoDaCasa, larguraDoNome, escala = 1, comMana = true, comBarras = true, cfg = NAMEPLATE }) {
  const D = cfg.esfera.diametro * escala;
  const gap = cfg.espacoEsferaNome * escala;
  const nomeH = Math.ceil(cfg.nome.fonte * escala) + 2;
  const vidaH = cfg.barras.mostrarVida && comBarras ? cfg.barras.alturaDaVida * escala : 0;
  const manaH = cfg.barras.mostrarMana && comBarras && comMana ? cfg.barras.alturaDaMana * escala : 0;
  const esp = cfg.barras.espaco * escala;
  const colunaH = nomeH + (vidaH ? esp + vidaH : 0) + (manaH ? esp + manaH : 0);
  const barraL = vidaH || manaH ? cfg.barras.largura * escala : 0;
  const colunaL = Math.max(larguraDoNome, barraL);
  const largura = D + gap + colunaL;
  const altura = Math.max(D, colunaH);
  const esq = cx - largura / 2;
  const base = topoDaCasa - cfg.distanciaVertical * escala;
  const topo = base - altura;
  const colunaX = esq + D + gap;
  const colunaTopo = topo + (altura - colunaH) / 2;
  const nomeTopo = colunaTopo;
  const vidaTopo = nomeTopo + nomeH + esp;
  const manaTopo = vidaTopo + (vidaH ? vidaH + esp : 0) - (vidaH ? 0 : esp);
  return { esq, topo, base, dir: esq + largura, largura, altura, D, esferaX: esq, esferaCY: topo + altura / 2, colunaX, nomeTopo, nomeH, vidaTopo, vidaH, manaTopo, manaH, barraL };
}

/** Está (ao menos em parte) dentro da tela de `telaL × telaA`? Fora dela não se desenha nada. */
export const dentroDaTela = (caixa, telaL, telaA, folga = 8) => caixa.dir >= -folga && caixa.esq <= telaL + folga && caixa.base >= -folga && caixa.topo <= telaA + folga;

/** A fração (0..1) de uma barra: sem máximo conhecido não há barra. */
export const fracao = (atual, maximo) => (maximo > 0 ? limitar((Number(atual) || 0) / maximo, 0, 1) : null);

/** O nome cortado com reticências para caber em `larguraMaxima` (usando `medir(texto)`). */
export function cortarNome(nome, medir, larguraMaxima) {
  const texto = String(nome ?? '');
  if (medir(texto) <= larguraMaxima) return texto;
  let fim = texto.length;
  while (fim > 1 && medir(`${texto.slice(0, fim)}…`) > larguraMaxima) fim--;
  return `${texto.slice(0, fim)}…`;
}

const gradienteVertical = (ctx, y0, y1, [a, b]) => {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  return g;
};
function retanguloArredondado(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

export class NameplateDoJogador {
  /** `criarTela(largura, altura)` devolve uma tela fora da página (OffscreenCanvas); a do `map.mjs`. */
  constructor({ criarTela, cfg = NAMEPLATE }) {
    this.criarTela = criarTela;
    this.cfg = cfg;
    this.placas = new Map();
    this.enchimentos = new Map();
    this.regua = null;
    this.pintadas = 0; // quantas placas/enchimentos foram pintados de verdade (os testes conferem o cache)
  }

  medirNome(nome, escala) {
    this.regua ??= this.criarTela(1, 1).getContext('2d');
    this.regua.font = `bold ${this.cfg.nome.fonte * escala}px Verdana, "Segoe UI", sans-serif`;
    return (texto) => Math.ceil(this.regua.measureText(texto).width) + 2;
  }

  guardar(mapa, chave, valor) {
    if (mapa.size >= this.cfg.tetoDoCache) mapa.delete(mapa.keys().next().value);
    mapa.set(chave, valor);
    this.pintadas++;
    return valor;
  }

  /** A placa (esfera, nível, nome, trilhos) pintada uma vez. */
  placa({ nome, nivel, escala, ratio, comMana, comBarras, propria }) {
    const chave = `${nome}\0${nivel}\0${escala}\0${ratio}\0${comMana ? 1 : 0}\0${comBarras ? 1 : 0}\0${propria ? 1 : 0}`;
    const achada = this.placas.get(chave);
    if (achada) return achada;
    const cfg = this.cfg;
    const medir = this.medirNome(nome, escala);
    const texto = cortarNome(nome, medir, cfg.nome.larguraMaxima * escala);
    const larguraDoNome = medir(texto);
    const caixa = calcularLayout({ cx: 0, topoDaCasa: 0, larguraDoNome, escala, comMana, comBarras, cfg });
    // A telinha cobre a caixa, mais 2 px de folga para o contorno do texto. A origem do desenho é `(-esq + folga, -topo + folga)`.
    const folga = 2;
    const L = Math.ceil(caixa.largura) + folga * 2;
    const A = Math.ceil(caixa.altura) + folga * 2;
    const tela = this.criarTela(Math.max(1, Math.ceil(L * ratio)), Math.max(1, Math.ceil(A * ratio)));
    const c = tela.getContext('2d');
    c.scale(ratio, ratio);
    const ox = folga - caixa.esq;
    const oy = folga - caixa.topo;

    // -- A esfera: aro dourado metálico, miolo escuro com brilho no alto, filete interno e dois engastes.
    const r = caixa.D / 2;
    const ex = caixa.esferaX + ox + r;
    const ey = caixa.esferaCY + oy;
    c.beginPath();
    c.arc(ex, ey, r, 0, Math.PI * 2);
    c.fillStyle = gradienteVertical(c, ey - r, ey + r, [cfg.esfera2.ouro[0], cfg.esfera2.ouro[2]]);
    c.fill();
    c.beginPath();
    c.arc(ex, ey, r - 1.2 * escala, 0, Math.PI * 2);
    c.fillStyle = gradienteVertical(c, ey - r, ey + r, [cfg.esfera2.ouro[1], cfg.esfera2.ouro[2]]);
    c.fill();
    const miolo = r - 4 * escala;
    const brilho = c.createRadialGradient(ex, ey - miolo * 0.45, miolo * 0.1, ex, ey, miolo);
    brilho.addColorStop(0, cfg.esfera2.fundo[0]);
    brilho.addColorStop(1, cfg.esfera2.fundo[1]);
    c.beginPath();
    c.arc(ex, ey, miolo, 0, Math.PI * 2);
    c.fillStyle = brilho;
    c.fill();
    c.lineWidth = Math.max(0.5, 0.8 * escala);
    c.strokeStyle = 'rgba(246,226,160,.55)';
    c.stroke();
    c.fillStyle = cfg.esfera2.ouro[0];
    for (const dy of [-r + 0.6 * escala, r - 0.6 * escala]) {
      c.beginPath();
      c.arc(ex, ey + dy, Math.max(0.7, 1.1 * escala), 0, Math.PI * 2);
      c.fill();
    }
    // -- O nível, centralizado.
    const digitos = String(nivel ?? '').length;
    c.font = `bold ${(digitos >= 3 ? cfg.esfera.fonteDoNivelGrande : cfg.esfera.fonteDoNivel) * escala}px Verdana, "Segoe UI", sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#000';
    for (const [dx, dy] of OUTLINE) c.fillText(String(nivel ?? '?'), ex + dx * 0.7, ey + 0.5 + dy * 0.7);
    c.fillStyle = cfg.esfera2.numero;
    c.fillText(String(nivel ?? '?'), ex, ey + 0.5);

    // -- O nome, à direita, com contorno preto.
    c.font = `bold ${cfg.nome.fonte * escala}px Verdana, "Segoe UI", sans-serif`;
    c.textAlign = 'left';
    c.textBaseline = 'alphabetic';
    const nx = caixa.colunaX + ox;
    const base = caixa.nomeTopo + oy + cfg.nome.fonte * escala;
    c.fillStyle = '#000';
    for (const [dx, dy] of OUTLINE) c.fillText(texto, nx + dx, base + dy);
    c.fillStyle = propria ? cfg.nome.corDoPropriario : cfg.nome.cor;
    c.fillText(texto, nx, base);

    // -- Os trilhos (fundo escuro) das barras; o preenchimento vem por quadro.
    const trilho = (topo, altura) => {
      retanguloArredondado(c, nx - 1, topo + oy - 1, caixa.barraL + 2, altura + 2, (altura + 2) / 2);
      c.fillStyle = cfg.barras.trilho;
      c.fill();
      c.lineWidth = 1;
      c.strokeStyle = cfg.barras.bordaDoTrilho;
      c.stroke();
    };
    if (caixa.vidaH) trilho(caixa.vidaTopo, caixa.vidaH);
    if (caixa.manaH) trilho(caixa.manaTopo, caixa.manaH);

    return this.guardar(this.placas, chave, { tela, caixa, folga, largura: L, altura: A, ratio });
  }

  /** O preenchimento de uma barra cheia (cantos redondos, degradê), pintado uma vez por tamanho. */
  enchimento(tipo, largura, altura, ratio) {
    const chave = `${tipo}\0${largura}\0${altura}\0${ratio}`;
    const achado = this.enchimentos.get(chave);
    if (achado) return achado;
    const cores = tipo === 'mana' ? this.cfg.barras.corDaMana : this.cfg.barras.corDaVida;
    const tela = this.criarTela(Math.max(1, Math.ceil(largura * ratio)), Math.max(1, Math.ceil(altura * ratio)));
    const c = tela.getContext('2d');
    c.scale(ratio, ratio);
    retanguloArredondado(c, 0, 0, largura, altura, altura / 2);
    c.fillStyle = gradienteVertical(c, 0, altura, cores);
    c.fill();
    return this.guardar(this.enchimentos, chave, { tela });
  }

  /**
   * Desenha o conjunto de UM jogador no overlay (`ctx`, já com `setTransform(ratio)`), encaixado na grade de pixels
   * físicos por `nitido`. Devolve a caixa em pixels de tela (para o escudo da party, a tag e os estados), ou `null`
   * se ficou fora da tela.
   */
  desenhar(ctx, d, { telaL, telaA, nitido, ratio }) {
    const cfg = this.cfg;
    const frVida = cfg.barras.mostrarVida ? fracao(d.hp, d.maxHp) : null;
    const comMana = cfg.barras.mostrarMana && d.maxMana > 0;
    const comBarras = frVida != null || comMana;
    // Corte grosso ANTES de pintar qualquer coisa: quem está longe da tela nem ganha placa no cache.
    const meia = (cfg.esfera.diametro + cfg.espacoEsferaNome + Math.max(cfg.nome.larguraMaxima, cfg.barras.largura)) * d.escala / 2;
    if (!dentroDaTela({ esq: d.cx - meia, dir: d.cx + meia, topo: d.topoDaCasa - 40 * d.escala, base: d.topoDaCasa }, telaL, telaA)) return null;
    const placa = this.placa({ nome: d.nome, nivel: d.nivel, escala: d.escala, ratio, comMana, comBarras, propria: d.propria });
    const caixa = calcularLayout({ cx: d.cx, topoDaCasa: d.topoDaCasa, larguraDoNome: placa.caixa.largura - placa.caixa.D - cfg.espacoEsferaNome * d.escala, escala: d.escala, comMana, comBarras, cfg });
    if (!dentroDaTela(caixa, telaL, telaA)) return null;
    const x = nitido(caixa.esq - placa.folga);
    const y = nitido(caixa.topo - placa.folga);
    ctx.drawImage(placa.tela, x, y, placa.largura, placa.altura);
    const nx = nitido(caixa.colunaX);
    const preencher = (tipo, fr, topo, altura) => {
      if (!(fr > 0) || !altura) return;
      const cheia = this.enchimento(tipo, caixa.barraL, altura, ratio);
      const w = Math.max(1, Math.round(caixa.barraL * fr * ratio) / ratio);
      ctx.drawImage(cheia.tela, 0, 0, Math.max(1, Math.round(caixa.barraL * fr * ratio)), Math.ceil(altura * ratio), nx, nitido(topo), w, altura);
    };
    preencher('vida', frVida, caixa.vidaTopo, caixa.vidaH);
    if (comMana) preencher('mana', fracao(d.mana, d.maxMana), caixa.manaTopo, caixa.manaH);
    return caixa;
  }
}
