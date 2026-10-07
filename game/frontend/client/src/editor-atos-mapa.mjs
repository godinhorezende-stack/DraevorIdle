// A vista MAPA do editor de atos (dono, 07/10: "quero fazer algo assim na parte de hunts e para montar atos e campanhas"): a arte do ato em
// tamanho real, com os nós, as placas e as estradas desenhados EXATAMENTE como a tela WORLD do jogo (`world.mjs`/`world-arte.mjs`) — o
// que se monta aqui é o que o jogador vê. Arrastar um nó grava `fase.posicao` (o mesmo campo da vista Fluxo: as duas vistas são a mesma
// posição, só muda o desenho). A escala: o editor mora em 920×520 e o jogo em 1000×640 — a conversão é a de `Campanha.registrarAto`.
import { desenharNo } from './world.mjs';
import { svg, fundoDoAto, nomeDoTema } from './world-arte.mjs';
import { LARGURA, ALTURA, tracadoDaEstrada } from './world-dados.mjs';

const L = 920;
const A = 520;
const KX = LARGURA / L;
const KY = ALTURA / A;

/**
 * Desenha a vista. `ato`: o ato do editor; `posicoes`: Map(faseId → {x,y}) no espaço do editor; `opcoes`: { imagem (url), fase (selecionada),
 * somenteLeitura, aoMover(fase, {x,y}), aoEscolher(faseId), aoEscolherBoss() }. Devolve o nó raiz.
 */
export function vistaMapa(ato, posicoes, opcoes) {
  const raiz = document.createElement('div');
  raiz.className = 'atos-mapa';
  const palco = document.createElement('div');
  palco.className = 'w2-palco atos-mapa-palco';
  const viewport = document.createElement('div');
  viewport.className = 'w2-viewport';
  const mapa = svg('svg', { class: 'w2-svg', viewBox: `0 0 ${LARGURA} ${ALTURA}`, preserveAspectRatio: 'xMidYMid meet', role: 'group' });
  const cam = svg('g', { class: 'w2-cam' });
  mapa.append(cam);
  viewport.append(mapa);
  palco.append(viewport);
  raiz.append(palco);

  const numero = Number(String(ato.ordem ?? 1));
  const ordenadas = [...ato.fases].sort((a, b) => (a.ordem ?? 1e9) - (b.ordem ?? 1e9));
  const P = new Map();
  for (const f of ato.fases) {
    const p = posicoes.get(f.id) ?? { x: 100, y: 100 };
    P.set(f.id, { x: p.x * KX, y: p.y * KY });
  }
  const bossPos = (() => {
    const ult = ato.bossFinal?.faseAnterior ? P.get(ato.bossFinal.faseAnterior) : null;
    return ult ? { x: Math.min(LARGURA - 60, ult.x + 120), y: ult.y } : null;
  })();
  const cidade = ato.cidade ? { ...ato.cidade, p: ato.cidade.posicao ? { x: ato.cidade.posicao.x * KX, y: ato.cidade.posicao.y * KY } : { x: 70, y: ALTURA / 2 } } : null;
  const pontos = [...P.values(), ...(bossPos ? [bossPos] : []), ...(cidade ? [cidade.p] : [])];
  cam.append(fundoDoAto(numero, nomeDoTema(numero, null), pontos, opcoes.imagem ? { url: opcoes.imagem } : null));

  const estradas = svg('g', { class: 'w2-estradas' });
  const desenharEstradas = () => {
    estradas.replaceChildren();
    for (const c of ato.conexoes ?? []) {
      const a = P.get(c.de);
      const b = P.get(c.para);
      if (!a || !b) continue;
      const d = tracadoDaEstrada(a, b, 'cadeia');
      estradas.append(svg('path', { d, class: 'w2-leito' }), svg('path', { d, class: 'w2-estrada percorrido cadeia' }));
    }
    for (const id of cidade?.conexoes ?? []) {
      const b = P.get(id);
      if (!b) continue;
      const d = tracadoDaEstrada(cidade.p, b, 'cadeia');
      estradas.append(svg('path', { d, class: 'w2-leito' }), svg('path', { d, class: 'w2-estrada percorrido cadeia' }));
    }
    if (bossPos && ato.bossFinal?.faseAnterior && P.get(ato.bossFinal.faseAnterior)) {
      const d = tracadoDaEstrada(P.get(ato.bossFinal.faseAnterior), bossPos, 'cadeia');
      estradas.append(svg('path', { d, class: 'w2-leito' }), svg('path', { d, class: 'w2-estrada disponivel cadeia' }));
    }
  };
  desenharEstradas();
  cam.append(estradas);

  const nos = svg('g', { class: 'w2-nos' });
  const tipoDe = (f) => (f.tipo === 'boss' || f.tipo === 'boss-fase' || f.conclusao?.tipo === 'matar-chefe' ? 'boss-fase' : f.tipo === 'opcional' ? 'boss-opcional' : 'comum');
  ordenadas.forEach((f, i) => {
    const g = desenharNo({ id: f.id, tipo: tipoDe(f), estado: f.id === ato.inicio ? 'aberta' : 'completa', numero: i + 1, nome: f.nome, p: P.get(f.id), atual: f.id === ato.inicio, escolhido: opcoes.fase === f.id, boss: false });
    // arrastar: o movimento no espaço do jogo volta ao espaço do editor (÷KX, ÷KY), inteiro, dentro da tela
    let arrastou = false;
    g.addEventListener('pointerdown', (ev) => {
      if (opcoes.somenteLeitura) return;
      ev.preventDefault();
      const caixa = mapa.getBoundingClientRect();
      const k = LARGURA / caixa.width;
      const o = { x: ev.clientX, y: ev.clientY, px: P.get(f.id).x, py: P.get(f.id).y };
      const mover = (m) => {
        if (Math.hypot(m.clientX - o.x, m.clientY - o.y) > 4) arrastou = true;
        if (!arrastou) return;
        const p = P.get(f.id);
        p.x = Math.min(LARGURA - 30, Math.max(30, o.px + (m.clientX - o.x) * k));
        p.y = Math.min(ALTURA - 40, Math.max(30, o.py + (m.clientY - o.y) * k));
        g.setAttribute('transform', `translate(${p.x} ${p.y})`);
        desenharEstradas();
      };
      const soltar = () => {
        window.removeEventListener('pointermove', mover);
        window.removeEventListener('pointerup', soltar);
        if (!arrastou) return;
        const p = P.get(f.id);
        opcoes.aoMover(f, { x: Math.round(p.x / KX), y: Math.round(p.y / KY) });
      };
      window.addEventListener('pointermove', mover);
      window.addEventListener('pointerup', soltar);
    });
    g.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (arrastou) return (arrastou = false);
      opcoes.aoEscolher(f.id);
    });
    nos.append(g);
  });
  if (cidade) {
    const g = desenharNo({ id: 'cidade', tipo: 'cidade', estado: 'aberta', numero: 0, nome: cidade.nome, p: cidade.p, escolhido: opcoes.cidadeEscolhida });
    let arrastou = false;
    g.addEventListener('pointerdown', (ev) => {
      if (opcoes.somenteLeitura) return;
      ev.preventDefault();
      const caixa = mapa.getBoundingClientRect();
      const k = LARGURA / caixa.width;
      const o = { x: ev.clientX, y: ev.clientY, px: cidade.p.x, py: cidade.p.y };
      const mover = (m) => {
        if (Math.hypot(m.clientX - o.x, m.clientY - o.y) > 4) arrastou = true;
        if (!arrastou) return;
        cidade.p.x = Math.min(LARGURA - 30, Math.max(30, o.px + (m.clientX - o.x) * k));
        cidade.p.y = Math.min(ALTURA - 40, Math.max(30, o.py + (m.clientY - o.y) * k));
        g.setAttribute('transform', `translate(${cidade.p.x} ${cidade.p.y})`);
        desenharEstradas();
      };
      const soltar = () => {
        window.removeEventListener('pointermove', mover);
        window.removeEventListener('pointerup', soltar);
        if (arrastou) opcoes.aoMoverCidade?.({ x: Math.round(cidade.p.x / KX), y: Math.round(cidade.p.y / KY) });
      };
      window.addEventListener('pointermove', mover);
      window.addEventListener('pointerup', soltar);
    });
    g.addEventListener('click', (ev) => { ev.stopPropagation(); if (arrastou) return (arrastou = false); opcoes.aoEscolherCidade?.(); });
    nos.append(g);
  }
  if (bossPos) {
    const g = desenharNo({ id: 'boss', tipo: 'boss', estado: 'aberta', numero: 0, nome: ato.bossFinal.bossId ?? 'Boss', p: bossPos, boss: true });
    g.addEventListener('click', () => opcoes.aoEscolherBoss?.());
    nos.append(g);
  }
  cam.append(nos);
  const dica = document.createElement('div');
  dica.className = 'w2-dica';
  dica.textContent = opcoes.imagem ? 'Arraste cada fase para o lugar dela na arte — é assim que o jogador vê. Sem imagem, carregue uma no painel do ato.' : 'Sem imagem de fundo neste ato: carregue uma no painel "Ato" (o mapa ilustrado). Enquanto isso, o pergaminho.';
  palco.append(dica);
  return raiz;
}
