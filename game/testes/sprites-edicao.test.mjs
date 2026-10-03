import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodificarPng } from '../engine/png-minimo.mjs';
import * as F from '../engine/sprite-folha.mjs';
import * as E from '../engine/sprite-edicao.mjs';
import { colorize } from '../engine/outfit-color.mjs';

const RAIZ = new URL('../gamedata/', import.meta.url);
const OUTFITS = JSON.parse(readFileSync(new URL('outfits.json', RAIZ), 'utf8'));
const MONTARIA = String(JSON.parse(readFileSync(new URL('mounts-real.json', RAIZ), 'utf8')).mounts[0].look);
const folha = (look) => decodificarPng(readFileSync(new URL(`sprites/outfits/${look}.png`, RAIZ)));
const estadoDe = (look) => ({ meta: structuredClone(OUTFITS[look]), quadros: F.desmontar(OUTFITS[look], folha(look)) });
const bmp = (w, h, pontos = []) => { const b = F.criarBitmap(w, h); for (const [x, y, c] of pontos) b.data.set(c, (y * w + x) * 4); return b; };
const VERM = [255, 0, 0, 255];
const iguais = (a, b) => a.w === b.w && a.h === b.h && a.data.every((v, i) => v === b.data[i]);

test('SE1. lápis e borracha: pixel exato (sem misturar/suavizar), tamanho do pincel, traço contínuo sem buracos, não alteram o original (imutável)', () => {
  const b = bmp(8, 8);
  const l = E.lapis(b, [[2, 2]], VERM);
  assert.deepEqual(E.pixelEm(l, 2, 2), VERM);
  assert.deepEqual(E.pixelEm(b, 2, 2), [0, 0, 0, 0], 'o bitmap de entrada não mudou');
  const sobre = E.lapis(E.lapis(b, [[1, 1]], [10, 20, 30, 255]), [[1, 1]], [200, 100, 50, 128]);
  assert.deepEqual(E.pixelEm(sobre, 1, 1), [200, 100, 50, 128], 'substitui, não mistura (alfa 128 fica 128)');
  assert.equal(E.lapis(b, [[4, 4]], VERM, 3).data.filter((_, i) => i % 4 === 3 && _ === 255).length, 9, 'pincel 3×3');
  const traco = E.linhaDePontos(0, 0, 7, 3);
  assert.deepEqual(traco[0], [0, 0]);
  assert.deepEqual(traco.at(-1), [7, 3]);
  assert.ok(traco.every(([x, y], i) => i === 0 || (Math.abs(x - traco[i - 1][0]) <= 1 && Math.abs(y - traco[i - 1][1]) <= 1)), 'sem saltos');
  const apagado = E.borracha(l, [[2, 2], [30, 30]], 1);
  assert.deepEqual(E.pixelEm(apagado, 2, 2), [0, 0, 0, 0]);
  assert.equal(E.lapis(b, [[-5, -5], [100, 100]], VERM).data.some((v) => v), false, 'fora da imagem é ignorado');
});

test('SE2. conta-gotas, balde (4-conexo, com tolerância, não vaza por diagonal), troca de cor, endurecer alfa', () => {
  const b = bmp(5, 5, [[1, 0, VERM], [0, 1, VERM], [1, 1, VERM]]);
  assert.deepEqual(E.pixelEm(b, 1, 1), VERM);
  assert.equal(E.pixelEm(b, 9, 9), null);
  const cheio = E.balde(b, 4, 4, [0, 0, 255, 255]);
  assert.deepEqual(E.pixelEm(cheio, 0, 0), [0, 0, 0, 0], 'o canto isolado pela diagonal não é preenchido');
  assert.deepEqual(E.pixelEm(cheio, 4, 4), [0, 0, 255, 255]);
  assert.equal(E.balde(b, 1, 1, VERM), b, 'mesma cor: nada a fazer');
  const parecida = bmp(3, 1, [[0, 0, [100, 100, 100, 255]], [1, 0, [104, 100, 100, 255]], [2, 0, [200, 0, 0, 255]]]);
  assert.deepEqual(E.pixelEm(E.balde(parecida, 0, 0, [9, 9, 9, 255], 5), 1, 0), [9, 9, 9, 255]);
  assert.deepEqual(E.pixelEm(E.balde(parecida, 0, 0, [9, 9, 9, 255], 5), 2, 0), [200, 0, 0, 255]);
  assert.deepEqual(E.pixelEm(E.substituirCor(b, VERM, [0, 255, 0, 255]), 1, 1), [0, 255, 0, 255]);
  const suave = E.endurecerAlfa(bmp(2, 1, [[0, 0, [1, 2, 3, 200]], [1, 0, [1, 2, 3, 30]]]));
  assert.deepEqual([E.pixelEm(suave, 0, 0)[3], E.pixelEm(suave, 1, 0)[3]], [255, 0]);
});

test('SE3. espelhar (h/v), deslocar, centralizar, seleção retangular (copiar/recortar/colar só visível), ajustar célula', () => {
  const b = bmp(4, 3, [[0, 0, VERM], [3, 2, [0, 255, 0, 255]]]);
  assert.deepEqual(E.pixelEm(E.espelhar(b, 'h'), 3, 0), VERM);
  assert.deepEqual(E.pixelEm(E.espelhar(b, 'v'), 0, 2), VERM);
  assert.ok(iguais(E.espelhar(E.espelhar(b, 'h'), 'h'), b));
  assert.deepEqual(E.pixelEm(E.deslocar(b, 1, 1), 1, 1), VERM);
  assert.deepEqual(E.pixelEm(E.deslocar(b, 1, 1), 0, 0), [0, 0, 0, 0]);
  const c = E.centralizar(bmp(10, 10, [[0, 0, VERM], [1, 1, VERM]]));
  assert.deepEqual(E.limitesDoConteudo(c), { x: 4, y: 4, w: 2, h: 2 });
  const copia = E.copiarRegiao(b, { x: 0, y: 0, w: 2, h: 2 });
  assert.deepEqual([copia.w, copia.h], [2, 2]);
  const cortado = E.limparRegiao(b, { x: 0, y: 0, w: 2, h: 2 });
  assert.deepEqual(E.pixelEm(cortado, 0, 0), [0, 0, 0, 0]);
  assert.deepEqual(E.pixelEm(b, 0, 0), VERM, 'imutável');
  const alvo = bmp(4, 4, [[2, 2, [1, 1, 1, 255]]]);
  const colado = E.colarRegiao(alvo, bmp(2, 2, [[0, 0, VERM]]), 1, 1);
  assert.deepEqual(E.pixelEm(colado, 1, 1), VERM);
  assert.deepEqual(E.pixelEm(colado, 2, 2), [1, 1, 1, 255], 'o transparente colado não apaga o que estava embaixo');
  const aj = E.ajustarCelula(bmp(2, 2, [[0, 0, VERM]]), 4, 4);
  assert.deepEqual(E.pixelEm(aj, 2, 2), VERM, 'ancora no canto inferior direito, como o jogo');
  assert.deepEqual(E.pixelEm(E.ajustarCelula(bmp(2, 2, [[0, 0, VERM]]), 4, 4, 'centro'), 1, 1), VERM);
});

test('SE4. quadros: duplicar, remover (mínimo 1), mover (arrastar), copiar/colar, inserir vazio — o tempo acompanha o quadro e o cadastro continua válido', () => {
  const e0 = estadoDe(MONTARIA);
  const meta0 = e0.meta;
  const n = meta0.groups[1].frames;
  const marcada = E.aplicarNaCelula(e0, 1, 2, { z: 0, addon: 0, dir: 2, layer: 0 }, (b) => E.lapis(b, [[1, 1]], VERM));
  const dur = E.definirDuracao(marcada, 1, 2, 777);
  const dup = E.duplicarQuadro(dur, 1, 2);
  assert.equal(dup.meta.groups[1].frames, n + 1);
  assert.equal(dup.quadros[1].length, n + 1);
  assert.deepEqual(dup.meta.groups[1].animation.durations[3], [777, 777], 'a cópia leva a duração');
  assert.deepEqual(E.pixelEm(E.lerCelula(dup, 1, 3, { z: 0, addon: 0, dir: 2, layer: 0 }), 1, 1), VERM);
  const mov = E.moverQuadro(dup, 1, 3, 0);
  assert.deepEqual(mov.meta.groups[1].animation.durations[0], [777, 777]);
  assert.deepEqual(E.pixelEm(E.lerCelula(mov, 1, 0, { z: 0, addon: 0, dir: 2, layer: 0 }), 1, 1), VERM);
  assert.equal(E.moverQuadro(dup, 1, 0, 99), dup, 'destino inválido: nada muda');
  const sem = E.removerQuadro(dup, 1, 0);
  assert.equal(sem.meta.groups[1].frames, n);
  let um = e0;
  for (let i = 0; i < 20; i++) um = E.removerQuadro(um, 0, 0);
  assert.equal(um.meta.groups[0].frames, 1, 'nunca remove o último quadro');
  const copiado = E.copiarQuadro(dur, 1, 2);
  const colado = E.colarQuadro(dur, 1, 0, copiado);
  assert.deepEqual(colado.meta.groups[1].animation.durations[1], [777, 777]);
  const vazio = E.inserirQuadroVazio(e0, 1, 0);
  assert.deepEqual(vazio.quadros[1][1], {});
  for (const e of [dup, mov, sem, colado, vazio]) {
    assert.deepEqual(F.validarMeta(F.montar(e.meta, e.quadros).meta, OUTFITS[MONTARIA]).erros, []);
  }
  let cheio = e0;
  for (let i = 0; i < 80; i++) cheio = E.duplicarQuadro(cheio, 1, 0);
  assert.equal(cheio.meta.groups[1].frames, F.LIMITES.quadros, 'respeita o limite de quadros');
});

test('SE5. animação: FPS, duração por quadro, loop e o tempo (mesma regra do renderer); sem tempos usa 200 ms', () => {
  const e = estadoDe(MONTARIA);
  const f10 = E.definirFps(e, 1, 10);
  assert.ok(f10.meta.groups[1].animation.durations.every(([a, b]) => a === 100 && b === 100));
  assert.equal(E.fpsDoGrupo(f10, 1), 10);
  assert.equal(E.quadroNoTempo(f10.meta.groups[1], 0), 0);
  assert.equal(E.quadroNoTempo(f10.meta.groups[1], 100), 1);
  assert.equal(E.quadroNoTempo(f10.meta.groups[1], 100 * f10.meta.groups[1].frames + 5), 0, 'repete');
  assert.equal(E.quadroNoTempo(f10.meta.groups[1], 100, { velocidade: 2 }), 2, 'velocidade do preview');
  assert.equal(E.quadroNoTempo({ frames: 3 }, 450), 2, 'sem durações: 200 ms por quadro');
  assert.equal(E.quadroNoTempo({ frames: 1 }, 5000), 0);
  const loop = E.definirLoop(f10, 1, -1);
  assert.equal(loop.meta.groups[1].animation.loop, -1);
  assert.equal(loop.meta.groups[1].animation.durations.length, f10.meta.groups[1].frames);
  assert.equal(E.definirShift(loop, 4, 4).meta.shift[0], 4);
  assert.deepEqual(F.validarMeta(F.montar(loop.meta, loop.quadros).meta, OUTFITS[MONTARIA]).erros, []);
  // o mesmo cálculo do renderer do jogo (idleFrameOf), para todos os looks com animação
  const idleFrameOf = (group, time) => { const frames = group.frames ?? 1; const durations = group.animation?.durations; if (!durations?.length) return Math.floor(time / 200) % frames; const step = (i) => { const en = durations[i % durations.length]; const v = Array.isArray(en) ? en[0] : en; return v > 0 ? v : 200; }; let total = 0; for (let i = 0; i < frames; i++) total += step(i); let c = time % total; for (let i = 0; i < frames; i++) { c -= step(i); if (c < 0) return i; } return 0; };
  for (const meta of Object.values(OUTFITS).slice(0, 300)) for (const g of meta.groups) for (const t of [0, 90, 333, 1234, 5000, 99999]) assert.equal(E.quadroNoTempo(g, t), idleFrameOf(g, t), 'igual ao renderer');
});

test('SE6. quatro direções: copiar uma direção para outra (com espelhamento leste↔oeste), um quadro só ou todos; a máscara vai junto', () => {
  const e = estadoDe(OUTFIT_COM_MASCARA());
  const g = 1;
  const leste = { z: 0, addon: 0, dir: 1, layer: 0 };
  const oeste = { ...leste, dir: 3 };
  const copiado = E.copiarDirecao(e, g, 1, 3, { espelhado: true });
  for (let i = 0; i < e.quadros[g].length; i++) {
    assert.ok(iguais(E.lerCelula(copiado, g, i, oeste), E.espelhar(E.lerCelula(e, g, i, leste), 'h')), `quadro ${i}`);
    assert.ok(iguais(E.lerCelula(copiado, g, i, { ...oeste, layer: 1 }), E.espelhar(E.lerCelula(e, g, i, { ...leste, layer: 1 }), 'h')), 'máscara espelhada junto');
  }
  const so = E.copiarDirecao(e, g, 1, 3, { quadro: 2 });
  assert.ok(iguais(E.lerCelula(so, g, 2, oeste), E.lerCelula(e, g, 2, leste)));
  assert.ok(iguais(E.lerCelula(so, g, 0, oeste), E.lerCelula(e, g, 0, oeste)), 'os outros quadros ficam como estavam');
  const semCamada = E.copiarDirecao(e, g, 1, 3, { quadro: 2, camadas: false });
  assert.ok(iguais(E.lerCelula(semCamada, g, 2, { ...oeste, layer: 1 }), E.lerCelula(e, g, 2, { ...oeste, layer: 1 })));
});
function OUTFIT_COM_MASCARA() { return '128'; }

test('SE7. cores dinâmicas: a composição usa a MESMA colorize do jogo; mudar a paleta NÃO altera os pixels da folha; editar o desenho preserva a máscara; pintar a máscara muda onde a cor cai', () => {
  const e = estadoDe('128');
  const pos = { z: 0, addon: 0, dir: 2, layer: 0 };
  const antes = F.montar(e.meta, e.quadros).folha;
  const azul = { head: 79, body: 79, legs: 79, feet: 79 };
  const verde = { head: 52, body: 52, legs: 52, feet: 52 };
  const a = E.comporCelula(e, 0, 0, pos, azul);
  const b = E.comporCelula(e, 0, 0, pos, verde);
  assert.notDeepEqual([...a.data], [...b.data], 'cores diferentes, composição diferente');
  const manual = F.clonarBitmap(E.lerCelula(e, 0, 0, pos));
  colorize(manual.data, E.lerCelula(e, 0, 0, { ...pos, layer: 1 }).data, azul);
  assert.deepEqual([...a.data], [...manual.data], 'idêntica à colorize do renderer');
  assert.ok(F.montar(e.meta, e.quadros).folha.data.every((v, i) => v === antes.data[i]), 'visualizar cores não mexe nos pixels');
  assert.deepEqual([...E.comporCelula(e, 0, 0, pos, null).data], [...E.lerCelula(e, 0, 0, pos).data], 'sem cores: o desenho puro');
  // pinta um pixel de desenho cinza e marca na máscara como "corpo" (vermelho): o pixel passa a ser tingido
  let e2 = E.aplicarNaCelula(e, 0, 0, pos, (c) => E.lapis(c, [[5, 5]], [200, 200, 200, 255]));
  const semMascara = E.comporCelula(e2, 0, 0, pos, azul);
  assert.deepEqual(E.pixelEm(semMascara, 5, 5), [200, 200, 200, 255], 'sem marca na máscara a cor dinâmica não atinge');
  e2 = E.aplicarNaCelula(e2, 0, 0, { ...pos, layer: 1 }, (c) => E.lapis(c, [[5, 5]], [255, 0, 0, 255]));
  assert.notDeepEqual(E.pixelEm(E.comporCelula(e2, 0, 0, pos, azul), 5, 5), [200, 200, 200, 255], 'com a marca de corpo o pixel é tingido');
  assert.deepEqual(F.validarPixels(F.montar(e2.meta, e2.quadros).folha, e2.meta, { folha: folha('128'), meta: OUTFITS['128'] }).erros, []);
  // espelhar/deslocar vinculado leva a máscara junto
  const v = E.aplicarNaCelula(e, 0, 0, pos, (c) => E.espelhar(c, 'h'), { vincular: true });
  assert.ok(iguais(E.lerCelula(v, 0, 0, { ...pos, layer: 1 }), E.espelhar(E.lerCelula(e, 0, 0, { ...pos, layer: 1 }), 'h')));
  const nv = E.aplicarNaCelula(e, 0, 0, pos, (c) => E.espelhar(c, 'h'));
  assert.ok(iguais(E.lerCelula(nv, 0, 0, { ...pos, layer: 1 }), E.lerCelula(e, 0, 0, { ...pos, layer: 1 })), 'sem vincular a máscara não muda');
});

test('SE8. histórico: desfazer/refazer, limite, "sujo" por CONTEÚDO (desenhar e desfazer à mão volta a limpo), descartar restaura o original', () => {
  const e = estadoDe(MONTARIA);
  const pos = { z: 0, addon: 0, dir: 2, layer: 0 };
  let s = E.criarSessao(e);
  assert.equal(E.sujo(s), false);
  s = E.aplicar(s, 'ponto', (x) => E.aplicarNaCelula(x, 0, 0, pos, (b) => E.lapis(b, [[3, 3]], VERM)));
  s = E.aplicar(s, 'duplicar quadro', (x) => E.duplicarQuadro(x, 1, 0));
  assert.deepEqual(E.historicoDe(s), ['ponto', 'duplicar quadro']);
  assert.equal(E.sujo(s), true);
  assert.equal(E.aplicar(s, 'nada', (x) => x), s, 'operação sem efeito não suja o histórico');
  s = E.desfazer(s);
  assert.equal(s.atual.meta.groups[1].frames, e.meta.groups[1].frames);
  assert.equal(E.podeRefazer(s), true);
  s = E.refazer(s);
  assert.equal(s.atual.meta.groups[1].frames, e.meta.groups[1].frames + 1);
  s = E.desfazer(E.desfazer(s));
  assert.equal(E.podeDesfazer(s), false);
  assert.equal(E.sujo(s), false);
  // desenhar um pixel e apagá-lo à mão: sem diferença real
  let t = E.criarSessao(e);
  t = E.aplicar(t, 'a', (x) => E.aplicarNaCelula(x, 0, 0, pos, (b) => E.lapis(b, [[3, 3]], VERM)));
  t = E.aplicar(t, 'b', (x) => E.aplicarNaCelula(x, 0, 0, pos, (b) => E.borracha(b, [[3, 3]])));
  assert.equal(E.sujo(t), false, 'sem diferença de conteúdo');
  t = E.aplicar(t, 'c', (x) => E.definirFps(x, 1, 5));
  assert.equal(E.sujo(t), true);
  assert.equal(E.sujo(E.descartar(t)), false);
  let longa = E.criarSessao(e);
  for (let i = 0; i < 130; i++) longa = E.aplicar(longa, `p${i}`, (x) => E.aplicarNaCelula(x, 0, 0, pos, (b) => E.lapis(b, [[i % 60, 1]], [i, 0, 0, 255])));
  assert.equal(longa.passado.length, 100, 'o histórico tem teto');
});

test('SE9. alinhamento e tamanho: deslocar o quadro inteiro (todas as direções e camadas), redimensionar a folha mantendo o ancoramento e a estrutura', () => {
  const e = estadoDe('128');
  const d = E.deslocarQuadro(e, 0, 0, 2, -1);
  for (const pos of F.posicoesDoGrupo(e.meta.groups[0])) {
    const antes = E.lerCelula(e, 0, 0, pos);
    assert.ok(iguais(E.lerCelula(d, 0, 0, pos), E.deslocar(antes, 2, -1)), JSON.stringify(pos));
  }
  const maior = E.redimensionarQuadros(e, 80, 80);
  assert.equal(maior.meta.cw, 80);
  assert.equal(maior.meta.w, 80 * 48);
  assert.equal(F.estruturaDe(maior.meta).h, maior.meta.h);
  const c0 = E.lerCelula(e, 0, 0, { z: 0, addon: 0, dir: 2, layer: 0 });
  const c1 = E.lerCelula(maior, 0, 0, { z: 0, addon: 0, dir: 2, layer: 0 });
  assert.ok(iguais(F.recortar(c1, { x: 16, y: 16, w: 64, h: 64 }), c0), 'o desenho ficou ancorado no canto inferior direito');
  const v = F.validarMeta(maior.meta, e.meta);
  assert.deepEqual(v.erros, []);
  assert.match(v.avisos.join(' '), /tamanho do quadro mudou/);
});

test('SE10. copiar entre recursos compatíveis valida o tamanho do quadro', () => {
  const a = estadoDe(MONTARIA);
  const b = estadoDe(MONTARIA === '368' ? '369' : '368');
  const pos = { z: 0, addon: 0, dir: 2, layer: 0 };
  const ok = E.copiarCelulaEntreRecursos(a, b, { g: 1, i: 0, pos });
  if (a.meta.cw === b.meta.cw) assert.ok(ok.estado);
  const menor = estadoDe(Object.keys(OUTFITS).find((k) => OUTFITS[k].cw === 32));
  assert.match(E.copiarCelulaEntreRecursos(a, menor, { g: 0, i: 0, pos }).erro, /Tamanhos diferentes/);
  assert.match(E.copiarCelulaEntreRecursos(a, b, { g: 0, i: 0, pos, iDest: 999 }).erro, /destino não existe/);
});

test('SE11. importar spritesheet: recorte por grade, sugestão automática, regiões soltas, e os 4 modos de distribuição nos quadros', () => {
  const e = estadoDe(MONTARIA);
  const g = 1;
  const fotos = e.meta.groups[g].frames;
  const original = F.montar(e.meta, e.quadros).folha;
  // a folha do jogo recortada pela grade certa devolve as células do jogo
  const grade = E.recortarGrade(original, { cw: 64, ch: 64 });
  assert.deepEqual([grade.cols, grade.linhas, grade.celulas.length], [4, 9, 36]);
  const sug = E.sugerirGrades(original);
  assert.deepEqual([sug[0].cw, sug[0].ch], [64, 64], 'a sugestão automática acerta 64×64');
  assert.ok(sug[0].corte < 0.01);
  // modo folha-do-jogo: reimporta o grupo de caminhada inteiro e fica igual
  const gradeCam = E.recortarGrade(F.recortar(original, { x: 0, y: 64, w: 256, h: 64 * fotos }), { cw: 64, ch: 64 });
  const r = E.distribuirImportacao(e, gradeCam, { modo: 'folha-do-jogo', g });
  assert.ok(r.estado);
  assert.ok(F.montar(r.estado.meta, r.estado.quadros).folha.data.every((v, i) => v === original.data[i]), 'reimportar o próprio grupo não muda nada');
  assert.match(E.distribuirImportacao(e, E.recortarGrade(original, { cw: 32, ch: 64 }), { modo: 'folha-do-jogo', g }).erro, /colunas/);
  // direções em linhas: 4 linhas × 3 quadros viram 3 quadros nas 4 direções
  const fatia = (cor) => { const c = F.criarBitmap(64, 64); c.data.set(cor, (10 * 64 + 10) * 4); return c; };
  const tira = F.criarBitmap(64 * 3, 64 * 4);
  for (let d = 0; d < 4; d++) for (let q = 0; q < 3; q++) F.colar(tira, fatia([d * 50, q * 50, 9, 255]), q * 64, d * 64);
  const gl = E.recortarGrade(tira, { cw: 64, ch: 64 });
  const il = E.distribuirImportacao(e, gl, { modo: 'direcoes-em-linhas', g });
  assert.equal(il.estado.meta.groups[g].frames, 3);
  assert.match(il.avisos.join(' '), /quantidade de quadros mudou para 3/);
  assert.deepEqual(E.pixelEm(E.lerCelula(il.estado, g, 2, { z: 0, addon: 0, dir: 3, layer: 0 }), 10, 10), [150, 100, 9, 255]);
  assert.deepEqual(F.validarMeta(F.montar(il.estado.meta, il.estado.quadros).meta, OUTFITS[MONTARIA]).erros, []);
  // direções em colunas (transposto) e ordem personalizada (oeste primeiro)
  const transposta = F.criarBitmap(64 * 4, 64 * 3);
  for (let d = 0; d < 4; d++) for (let q = 0; q < 3; q++) F.colar(transposta, fatia([d * 50, q * 50, 9, 255]), d * 64, q * 64);
  const ic = E.distribuirImportacao(e, E.recortarGrade(transposta, { cw: 64, ch: 64 }), { modo: 'direcoes-em-colunas', g, ordem: [3, 2, 1, 0] });
  assert.equal(ic.estado.meta.groups[g].frames, 3);
  assert.deepEqual(E.pixelEm(E.lerCelula(ic.estado, g, 1, { z: 0, addon: 0, dir: 3, layer: 0 }), 10, 10), [0, 50, 9, 255], 'a 1ª coluna da imagem foi para OESTE (ordem personalizada)');
  assert.deepEqual(E.pixelEm(E.lerCelula(ic.estado, g, 1, { z: 0, addon: 0, dir: 0, layer: 0 }), 10, 10), [150, 50, 9, 255]);
  // sequência: todas as células viram quadros de UMA direção
  const sq = E.distribuirImportacao(e, E.recortarGrade(tira, { cw: 64, ch: 64 }), { modo: 'sequencia', g, dir: 2 });
  assert.equal(sq.estado.meta.groups[g].frames, 12);
  assert.match(E.distribuirImportacao(e, { cols: 0, linhas: 0, celulas: [] }, { modo: 'sequencia', g }).erro, /Nenhuma célula/);
  assert.match(E.distribuirImportacao(e, gl, { modo: 'xyz', g }).erro, /desconhecido/);
  // célula de tamanho diferente do quadro do recurso: avisa e ancora
  const pequena = E.recortarGrade(tira, { cw: 32, ch: 32 });
  assert.match(E.distribuirImportacao(e, pequena, { modo: 'sequencia', g, dir: 2 }).avisos.join(' '), /tamanho diferente do quadro do recurso/);
  // regiões soltas (recorte automático)
  const solta = F.criarBitmap(40, 20);
  for (const [x0, y0] of [[2, 2], [20, 3]]) for (let j = 0; j < 5; j++) for (let i = 0; i < 6; i++) solta.data.set(VERM, ((y0 + j) * 40 + x0 + i) * 4);
  assert.deepEqual(E.detectarRegioes(solta), [{ x: 2, y: 2, w: 6, h: 5 }, { x: 20, y: 3, w: 6, h: 5 }]);
  const cel = E.regioesComoCelulas(solta, E.detectarRegioes(solta), 16, 16);
  assert.equal(cel.length, 2);
  assert.deepEqual(E.limitesDoConteudo(cel[0].bitmap), { x: 10, y: 11, w: 6, h: 5 });
});

test('SE12. exportar: faixa de quadros, configuração da animação (JSON), PNG de quadro e de folha ida-e-volta', async () => {
  const { codificarPng } = await import('../engine/png-minimo.mjs');
  const e = estadoDe(MONTARIA);
  const cels = [0, 1, 2].map((i) => E.lerCelula(e, 1, i, { z: 0, addon: 0, dir: 2, layer: 0 }));
  const faixa = E.faixaDeQuadros(cels);
  assert.deepEqual([faixa.w, faixa.h], [64 * 3, 64]);
  assert.ok(iguais(F.recortar(faixa, { x: 64, y: 0, w: 64, h: 64 }), cels[1]));
  const cfg = JSON.parse(E.configuracaoDaAnimacao(e.meta, MONTARIA));
  assert.equal(cfg.grupos[1].quadros, e.meta.groups[1].frames);
  assert.equal(cfg.grupos[1].nome, 'caminhada');
  const m = F.montar(e.meta, e.quadros);
  assert.ok(iguais(decodificarPng(codificarPng(m.folha)), m.folha));
  assert.ok(iguais(decodificarPng(codificarPng(cels[0])), cels[0]));
});
