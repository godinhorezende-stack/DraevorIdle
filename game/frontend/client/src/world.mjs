// A tela WORLD: o mapa da campanha (Atos, fases, caminhos) e o painel de detalhes da fase escolhida.
//
// É a MESMA campanha de sempre (`{t:'campanha'}` → `systems/campanha.mjs`): quem decide o que está aberto, concluído ou
// exigido é o servidor — aqui só se desenha. Nada de segredo vai para o mapa: o servidor só manda, de cada fase, o que o
// jogador pode saber (descrição, boss principal, condição de conclusão) e, dos opcionais e secretos, o que ele JÁ ENCONTROU.
//
// O estilo é o do Draevor (pergaminho escuro, ouro, serifa gótica); o desenho é nosso: nada copiado de outro jogo.
const NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}, ...filhos) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, String(v));
  for (const f of filhos) if (f) e.append(f);
  return e;
};

/** Um elemento com filhos (texto ou nós) — o `el` das janelas só aceita um texto, e aqui há vários filhos. */
const el = (tag, classe, ...filhos) => {
  const n = document.createElement(tag);
  if (classe) n.className = classe;
  for (const f of filhos.flat()) if (f != null && f !== false) n.append(f.nodeType ? f : document.createTextNode(String(f)));
  return n;
};

// Os ícones dos nós são FORMAS (e não emoji): a fonte de emoji muda de aparelho para aparelho e some em alguns.
const icone = {
  /** O visto de "concluída". */
  visto: () => svg('path', { d: 'M-8 0 L-2 7 L9 -8', class: 'world-ico traco' }),
  /** O cadeado de "bloqueada". */
  cadeado: () => svg('g', { class: 'world-ico' }, svg('rect', { x: -7, y: -1, width: 14, height: 10, rx: 2 }), svg('path', { d: 'M-4 -1 V-5 a4 4 0 0 1 8 0 V-1', class: 'traco' })),
  /** O xis de "em obras". */
  xis: () => svg('path', { d: 'M-7 -7 L7 7 M7 -7 L-7 7', class: 'world-ico traco' }),
  /** A caveira do boss. */
  caveira: (escala = 1) => svg('g', { class: 'world-ico', transform: `scale(${escala})` }, svg('path', { d: 'M-9 2 a9 9 0 1 1 18 0 v5 h-4 v4 h-3 v-4 h-4 v4 h-3 v-4 h-4 z' }), svg('circle', { cx: -3.5, cy: 1, r: 2.4, class: 'vazado' }), svg('circle', { cx: 3.5, cy: 1, r: 2.4, class: 'vazado' })),
  /** A estrela de "algo encontrado". */
  estrela: (escala = 1) => svg('polygon', { points: '0,-7 2,-2 7,-2 3,1.5 4.5,7 0,3.8 -4.5,7 -3,1.5 -7,-2 -2,-2', class: 'world-ico achado', transform: `scale(${escala})` }),
};

export const RAIO_DA_FASE = 22;
export const RAIO_DO_BOSS = 28;
const ESPACO = 78;

/**
 * Onde cada nó fica: as fases do Ato em SERPENTINA (a linha vai e volta), `colunas` por linha, e o boss na ponta.
 * Devolve `{ pontos: [{x, y}], boss: {x, y}, largura, altura }`. Pura (a tela e os testes usam a mesma conta).
 */
export function layoutDoAto(quantidade, colunas) {
  const margem = RAIO_DO_BOSS + 8;
  const pontos = [];
  for (let i = 0; i < quantidade; i++) {
    const linha = Math.floor(i / colunas);
    const coluna = i % colunas;
    const x = margem + (linha % 2 === 0 ? coluna : colunas - 1 - coluna) * ESPACO;
    pontos.push({ x, y: margem + linha * ESPACO });
  }
  const linhas = Math.ceil(quantidade / colunas);
  const ultimo = pontos.at(-1);
  // O boss continua o caminho: na linha de baixo, embaixo da última fase.
  const boss = { x: ultimo.x, y: margem + linhas * ESPACO };
  return { pontos, boss, largura: margem * 2 + (colunas - 1) * ESPACO, altura: boss.y + margem };
}

/** Quantas colunas cabem em `largura` px (mínimo 3, máximo 6). */
export const colunasPara = (largura) => Math.max(3, Math.min(6, Math.floor((largura - 40) / ESPACO) + 1));

/** O estado de um nó, em uma palavra (a cor, o ícone e o texto saem dele). */
export function estadoDoNo(no) {
  if (no.pular) return 'travada';
  if (no.completa || no.vencido) return 'completa';
  if (no.liberada || no.liberado) return 'aberta';
  return 'fechada';
}
const TEXTO_DO_ESTADO = { completa: 'Concluída', aberta: 'Aberta', fechada: 'Bloqueada', travada: 'Em obras' };

/**
 * Desenha o mapa e o painel dentro de `body`. `h` traz o que vem do resto do jogo (para não importar `panels.mjs`):
 * `figuraDaCriatura`, `entrarNaFase(hunt, lista)` e `enfrentarBoss(boss)`.
 */
export function desenharMundo(body, { campanha, escolhida, hunts, bosses, bestiario, h, selecao, aoSelecionar, largura }) {
  const { figuraDaCriatura } = h;
  const mundo = campanha.mundo ?? {};
  const colunas = colunasPara(largura);
  const porAto = (ato) => escolhida.fases.filter((f) => f.ato === ato);
  const fronteira = escolhida.fases.find((f) => f.liberada && !f.completa && !f.pular) ?? escolhida.fases.find((f) => f.liberada) ?? escolhida.fases[0];
  const atual = selecao ?? { tipo: 'fase', huntId: fronteira.huntId };

  const raiz = el('div', 'world');
  const mapa = el('div', 'world-mapa');
  const detalhe = el('div', 'world-detalhe');
  raiz.append(mapa, detalhe);

  const escolher = (s) => {
    aoSelecionar(s);
  };

  for (let ato = 1; ato <= 4; ato++) {
    const fases = porAto(ato);
    if (!fases.length) continue;
    const boss = escolhida.bosses.find((b) => b.ato === ato);
    const feitas = fases.filter((f) => f.completa).length;
    const sec = el('section', 'world-ato');
    sec.append(
      el('h4', 'world-ato-titulo', `Ato ${ato}`),
      el('span', 'world-ato-info', `level ${fases[0].nivel}–${fases.at(-1).nivel} · ${feitas}/${fases.length} fases${boss ? ` · boss: ${boss.nome}` : ''}`)
    );
    const L = layoutDoAto(fases.length, colunas);
    const s = svg('svg', { viewBox: `0 0 ${L.largura} ${L.altura}`, width: L.largura, height: L.altura, class: 'world-svg', role: 'group', 'aria-label': `Mapa do Ato ${ato}` });
    s.append(svg('defs', {},
      (() => {
        const g = svg('radialGradient', { id: `ouro-${ato}` }, svg('stop', { offset: '0%', 'stop-color': '#f6dc8a' }), svg('stop', { offset: '100%', 'stop-color': '#b88a22' }));
        return g;
      })()
    ));

    // Os caminhos: da fase à seguinte, e da última ao boss.
    const caminho = (a, b, aberto) => s.append(svg('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: `world-caminho${aberto ? ' aberto' : ''}` }));
    fases.forEach((f, i) => {
      if (i) caminho(L.pontos[i - 1], L.pontos[i], f.liberada);
    });
    if (boss) caminho(L.pontos.at(-1), L.boss, boss.liberado);
    // As conexões extras do conteúdo (`conexoes`): tracejadas, entre fases do mesmo Ato.
    fases.forEach((f, i) => {
      for (const alvo of mundo[f.huntId]?.conexoes ?? []) {
        const j = fases.findIndex((x) => x.huntId === alvo);
        if (j >= 0 && Math.abs(j - i) > 1) s.append(svg('line', { x1: L.pontos[i].x, y1: L.pontos[i].y, x2: L.pontos[j].x, y2: L.pontos[j].y, class: 'world-conexao' }));
      }
    });

    // Os nós das fases.
    fases.forEach((f, i) => {
      const p = L.pontos[i];
      const st = estadoDoNo(f);
      const m = mundo[f.huntId] ?? {};
      const marcada = atual.tipo === 'fase' && atual.huntId === f.huntId;
      const g = svg('g', { class: `world-no ${st}${marcada ? ' escolhido' : ''}`, transform: `translate(${p.x} ${p.y})`, tabindex: 0, role: 'button', 'aria-label': `${f.nome}, ${TEXTO_DO_ESTADO[st]}` });
      if (marcada) g.append(svg('circle', { r: RAIO_DA_FASE + 7, class: 'world-halo' }));
      g.append(svg('circle', { r: RAIO_DA_FASE, class: 'world-disco', fill: st === 'completa' ? `url(#ouro-${ato})` : null }));
      if (st === 'aberta') {
        const txt = svg('text', { class: 'world-numero', 'text-anchor': 'middle', y: 6 });
        txt.textContent = String((ato - 1) * 12 + i + 1);
        g.append(txt);
      } else {
        g.append(st === 'completa' ? icone.visto() : st === 'fechada' ? icone.cadeado() : icone.xis());
      }
      if (m.bossPrincipal) {
        const b = svg('g', { transform: `translate(${RAIO_DA_FASE - 3} ${-RAIO_DA_FASE + 6})`, class: 'world-selo-boss' }, svg('circle', { r: 9, class: 'fundo' }), icone.caveira(0.6));
        g.append(b);
      }
      if (m.descobertos?.length) {
        const d = svg('g', { transform: `translate(${-RAIO_DA_FASE + 3} ${-RAIO_DA_FASE + 6})`, class: 'world-selo-achado' }, svg('circle', { r: 9, class: 'fundo' }), icone.estrela(0.9));
        g.append(d);
      }
      const titulo = svg('title');
      titulo.textContent = `${f.nome} — ${TEXTO_DO_ESTADO[st]}`;
      g.append(titulo);
      const abrir = () => escolher({ tipo: 'fase', huntId: f.huntId });
      g.addEventListener('click', abrir);
      g.addEventListener('keydown', (ev) => (ev.key === 'Enter' || ev.key === ' ') && (ev.preventDefault(), abrir()));
      s.append(g);
    });

    // O boss do Ato.
    if (boss) {
      const st = estadoDoNo(boss);
      const marcada = atual.tipo === 'boss' && atual.ato === ato;
      const g = svg('g', { class: `world-no world-boss ${st}${marcada ? ' escolhido' : ''}`, transform: `translate(${L.boss.x} ${L.boss.y})`, tabindex: 0, role: 'button', 'aria-label': `Boss do Ato ${ato}: ${boss.nome}, ${TEXTO_DO_ESTADO[st]}` });
      if (marcada) g.append(svg('circle', { r: RAIO_DO_BOSS + 7, class: 'world-halo' }));
      const r = RAIO_DO_BOSS;
      g.append(svg('polygon', { class: 'world-disco', points: `0,${-r} ${r},0 0,${r} ${-r},0`, fill: st === 'completa' ? `url(#ouro-${ato})` : null }));
      g.append(st === 'fechada' ? icone.cadeado() : icone.caveira(1.15));
      const titulo = svg('title');
      titulo.textContent = `Boss do Ato ${ato}: ${boss.nome} — ${TEXTO_DO_ESTADO[st]}`;
      g.append(titulo);
      const abrir = () => escolher({ tipo: 'boss', ato });
      g.addEventListener('click', abrir);
      g.addEventListener('keydown', (ev) => (ev.key === 'Enter' || ev.key === ' ') && (ev.preventDefault(), abrir()));
      s.append(g);
    }
    sec.append(el('div', 'world-svg-caixa'));
    sec.lastChild.append(s);
    mapa.append(sec);
  }

  mapa.append(
    el('div', 'world-legenda',
      el('span', 'l-completa', '● concluída'), el('span', 'l-aberta', '● aberta'), el('span', 'l-fechada', '● bloqueada'),
      el('span', null, 'caveira: boss principal'), el('span', null, 'estrela: algo encontrado'))
  );

  // ------------------------------------------------------------ o painel de detalhes
  const linha = (rotulo, valor) => el('div', 'world-linha', el('span', null, rotulo), valor instanceof Node ? valor : el('b', null, valor));
  if (atual.tipo === 'fase') {
    const posicao = Math.max(0, escolhida.fases.findIndex((x) => x.huntId === atual.huntId));
    const f = escolhida.fases[posicao] ?? fronteira;
    const m = mundo[f.huntId] ?? {};
    const st = estadoDoNo(f);
    const hunt = hunts.get(f.huntId);
    detalhe.append(
      el('h3', 'world-titulo', f.nome),
      el('div', 'world-sub', `Ato ${f.ato} · Fase ${posicao + 1}`, el('span', `world-selo ${st}`, TEXTO_DO_ESTADO[st])),
      m.ambiente ? el('span', 'world-tag', m.ambiente) : null,
      el('p', 'world-descricao', m.descricao ?? 'Sem descrição.'),
      linha('Level dos monstros', `~${f.nivel}${m.levelRecomendado ? ` (recomendado ${m.levelRecomendado}+)` : ''}`),
      m.bossPrincipal ? linha('Boss principal', m.bossPrincipal) : null
    );
    if (hunt?.creatures?.length) {
      const bichos = el('div', 'world-bichos');
      for (const c of hunt.creatures.slice(0, 5)) bichos.append(figuraDaCriatura(c, bestiario, 36));
      detalhe.append(el('div', 'world-bloco', el('span', 'world-rotulo', 'Monstros'), bichos));
    }
    const conclusao = el('ul', 'world-lista');
    conclusao.append(el('li', null, 'Eliminar os monstros da fase'));
    for (const o of m.obrigatorios ?? []) conclusao.append(el('li', null, o.nome));
    detalhe.append(el('div', 'world-bloco', el('span', 'world-rotulo', 'Para concluir'), conclusao));
    // Requisitos de entrada: a cadeia do Ato (a fase de trás) e o que o conteúdo exige.
    const exigencias = [];
    const anterior = escolhida.fases[posicao - 1];
    if (anterior && anterior.ato === f.ato && !anterior.pular) exigencias.push([anterior.nome, anterior.completa]);
    for (const e of m.exige ?? []) exigencias.push([e.nome, escolhida.fases.find((x) => x.huntId === e.huntId)?.completa ?? false]);
    if (exigencias.length) {
      detalhe.append(el('div', 'world-bloco', el('span', 'world-rotulo', 'Requisitos'), el('ul', 'world-lista', ...exigencias.map(([nome, ok]) => el('li', ok ? 'feito' : 'falta', `${ok ? '✓' : '○'} Completar ${nome}`)))));
    }
    if (m.conexoes?.length) detalhe.append(linha('Leva também a', m.conexoes.map((id) => escolhida.fases.find((x) => x.huntId === id)?.nome ?? id).join(', ')));
    if (m.descobertos?.length) {
      detalhe.append(el('div', 'world-bloco', el('span', 'world-rotulo', 'Encontrado aqui'), el('ul', 'world-lista achados', ...m.descobertos.map((d) => el('li', null, `✦ ${d.nome}${d.vezes > 1 ? ` (×${d.vezes})` : ''}`)))));
    }
    const entrar = el('button', 'world-entrar', st === 'travada' ? 'Em obras' : f.liberada ? 'Entrar' : 'Bloqueada');
    entrar.type = 'button';
    entrar.disabled = !f.liberada || !hunt || !!f.pular;
    entrar.onclick = () => h.entrarNaFase(hunt, porAto(f.ato).map((x) => hunts.get(x.huntId)).filter(Boolean));
    detalhe.append(entrar, el('p', 'world-nota', f.completa ? `${f.limpezas > 1 ? `${f.limpezas} limpezas feitas` : 'Concluída'} — pode repetir a fase.` : f.liberada ? 'Limpe a fase inteira para concluí-la.' : 'Complete os requisitos acima para abrir.'));
  } else {
    const b = escolhida.bosses.find((x) => x.ato === atual.ato);
    const st = estadoDoNo(b);
    detalhe.append(
      el('h3', 'world-titulo', `Boss do Ato ${atual.ato}`),
      el('div', 'world-sub', b.nome, el('span', `world-selo ${st}`, TEXTO_DO_ESTADO[st])),
      linha('Level', `~${b.nivel}`),
      el('p', 'world-descricao', b.vencido ? 'Vencido. Pode enfrentá-lo de novo (com a recarga dele).' : b.liberado ? (atual.ato < 4 ? `Vença para liberar o Ato ${atual.ato + 1}.` : 'Vença para liberar a próxima dificuldade.') : `Complete as 12 fases do Ato ${atual.ato} para liberá-lo.`)
    );
    const dados = bosses.get(b.bossId);
    if (dados?.creatures?.length) detalhe.append(el('div', 'world-bichos', figuraDaCriatura(dados.creatures[0], bestiario, 52)));
    const enfrentar = el('button', 'world-entrar', b.liberado ? 'Enfrentar' : 'Bloqueado');
    enfrentar.type = 'button';
    enfrentar.disabled = !b.liberado;
    enfrentar.onclick = () => h.enfrentarBoss(b);
    detalhe.append(enfrentar);
  }
  if (campanha.bossesDerrotados?.length) {
    detalhe.append(el('div', 'world-bloco registro', el('span', 'world-rotulo', 'Bosses derrotados'), el('ul', 'world-lista', ...campanha.bossesDerrotados.map((x) => el('li', null, `☠ ${x.nome}${x.vezes > 1 ? ` (×${x.vezes})` : ''}`)))));
  }
  body.append(raiz);
}
