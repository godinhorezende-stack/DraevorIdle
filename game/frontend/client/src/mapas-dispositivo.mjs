// O DISPOSITIVO DE MAPAS (o endgame do PoE — `systems/mapas-dispositivo.mjs`): a aba Mapas da tela Campanha e o atalho das Docas de Oriath.
// Só desenha o que o servidor mandou (`campanha.mapas`): liberado ou não, o mapa aberto (portais, se está guardado), os mapas que você
// carrega (tier, nível da área, raridade, afixos, quantidade/raridade de itens, tamanho do grupo) e as estatísticas. Quem decide tudo é o
// servidor: abrir manda a peça que a tela mostrou (`onde`, `indice`, `assinatura`) e ele confere de novo.
import { iconeDeBotao } from './world-arte.mjs';

const el = (tag, classe, ...filhos) => {
  const n = document.createElement(tag);
  if (classe) n.className = classe;
  for (const f of filhos.flat()) if (f != null && f !== false) n.append(f.nodeType ? f : document.createTextNode(String(f)));
  return n;
};
const botao = (classe, texto, aoClicar) => {
  const b = el('button', classe, texto);
  b.type = 'button';
  if (aoClicar) b.onclick = aoClicar;
  return b;
};
const RARIDADE = { normal: 'Normal', magico: 'Mágico', raro: 'Raro', unico: 'Único' };
const RESULTADO = { concluido: 'concluído', falhou: 'falhou (sem portais)', abandonado: 'abandonado' };
const pct = (v) => `${v > 0 ? '+' : ''}${v}%`;
const tempo = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}min` : s >= 60 ? `${Math.floor(s / 60)}min ${s % 60}s` : `${s}s`;
};

/** "Nível 68 – 83": a faixa dos níveis de área dos mapas (do T1 ao último tier configurado), como a da dificuldade da campanha. */
export const faixaDosMapas = (m) => {
  const niveis = (m?.tiers ?? []).map((t) => t.nivel).filter(Number.isFinite);
  return niveis.length ? `Nível ${Math.min(...niveis)} – ${Math.max(...niveis)}` : 'Mapas';
};
/** Os portais: um ponto aceso por portal que sobra (6, como no PoE). */
function portais(sobra, total) {
  const n = el('span', 'mp-portais');
  n.setAttribute('aria-label', `${sobra} de ${total} portais`);
  for (let i = 0; i < total; i++) n.append(el('i', i < sobra ? 'aceso' : null));
  return n;
}

/** O resumo da peça (`peca.poe.mapa`): as recompensas e as linhas dos afixos com o estado de cada uma. */
function resumoDaPeca(peca) {
  const r = peca?.poe?.mapa ?? {};
  const bloco = el('div', 'mp-resumo');
  const nums = el('div', 'mp-numeros',
    el('span', null, el('b', null, pct(r.quantidade ?? 0)), ' quantidade'),
    el('span', null, el('b', null, pct(r.raridade ?? 0)), ' raridade'),
    el('span', null, el('b', null, pct(r.grupo ?? 0)), ' grupo'));
  bloco.append(nums);
  if (r.linhas?.length) {
    bloco.append(el('ul', 'mp-afixos', ...r.linhas.map((l) => {
      const li = el('li', `mp-afixo ${l.estado}`, l.texto);
      if (l.nota) li.title = `Ainda não age por inteiro: ${l.nota}.`;
      return li;
    })));
  } else bloco.append(el('p', 'mp-sem-afixo', 'Sem afixos: um mapa Normal (sem riscos e sem recompensa extra).'));
  return bloco;
}

/**
 * Desenha o dispositivo dentro de `body`. `mapas`: o que o servidor mandou; `faixaDaCampanha`: os níveis da campanha (a aba dela). `h`:
 * `send(msg)`, `itemCanvas(id, tamanho)`, `tipFor(el, id, extra, slot, peca)`, `voltarParaCampanha()`, `fechar()`.
 */
export function desenharDispositivo(body, { mapas, faixaDaCampanha = null, h }) {
  const raiz = el('div', 'w2 w2-mapas');
  // ---- o topo: as mesmas abas da Campanha (Campanha | Mapas)
  const abas = el('nav', 'w2-dificuldades');
  abas.setAttribute('aria-label', 'Campanha ou Mapas');
  const campanha = botao('w2-dif aberta', null, () => h.voltarParaCampanha());
  campanha.append(el('b', null, 'Campanha'), el('small', null, faixaDaCampanha ? `Nível ${faixaDaCampanha[0]} – ${faixaDaCampanha[1]}` : 'Atos I – X'));
  const aba = botao('w2-dif selecionada mapas', null);
  aba.setAttribute('aria-pressed', 'true');
  aba.append(el('b', null, 'Mapas'), el('small', null, faixaDosMapas(mapas)));
  abas.append(campanha, aba);
  raiz.append(abas);

  const aviso = el('div', 'mp-aviso');
  aviso.hidden = true;
  const avisar = (texto) => {
    aviso.textContent = texto;
    aviso.hidden = !texto;
  };

  const corpo = el('div', 'mp-corpo');
  raiz.append(aviso, corpo);
  body.append(raiz);

  // ---- fechado: o que falta
  if (!mapas.liberado) {
    corpo.append(el('section', 'mp-cartao mp-fechado',
      el('i', 'w2-cad', iconeDeBotao('cadeado')),
      el('h4', null, 'Dispositivo de Mapas'),
      el('p', null, mapas.motivo ?? `Abre depois do chefe do Ato ${mapas.ato}.`),
      el('p', 'mp-nota', 'Depois dele, a primeira vitória dá um Mapa (Nível 1) Mágico; as outras, um Normal.')));
    return;
  }

  // ---- o mapa aberto
  const a = mapas.aberto;
  const topo = el('section', 'mp-cartao mp-aberto');
  if (a) {
    const fig = el('div', 'mp-fig');
    const ic = h.itemCanvas(a.peca?.id, 48);
    h.tipFor(ic, a.peca?.id, null, null, a.peca);
    fig.append(ic);
    const estado = a.naCacada ? 'Você está nele' : a.guardado ? 'Esperando a sua volta' : 'Pronto para entrar';
    topo.append(fig, el('div', 'mp-info',
      el('span', 'mp-rotulo', 'Mapa aberto'),
      el('h4', `mp-nome r-${a.peca?.poe?.raridade ?? 'normal'}`, a.peca?.poe?.nome ?? a.nome),
      el('span', 'mp-linha', `Nível ${a.tier} · área nível ${a.nivel} · ${estado}`),
      el('span', 'mp-linha', portais(a.portais, a.portaisMax), ` ${a.portais} de ${a.portaisMax} portais${a.mortes ? ` · ${a.mortes} morte${a.mortes > 1 ? 's' : ''}` : ''}`)));
    const acoes = el('div', 'mp-acoes');
    if (!a.naCacada) acoes.append(botao('w2-entrar', 'Voltar ao mapa', () => { h.send({ t: 'voltarAoMapa', mode: 'auto' }); h.fechar(); }));
    // Desistir pede a confirmação NA tela (sem `confirm()`): a peça já foi gasta.
    const desistir = botao('mp-desistir', 'Abandonar', () => {
      if (desistir.dataset.certeza) return h.send({ t: 'abandonarMapa' });
      desistir.dataset.certeza = '1';
      desistir.textContent = 'Tem certeza? O mapa se perde';
    });
    acoes.append(desistir);
    topo.append(acoes);
  } else {
    topo.classList.add('vazio');
    topo.append(el('div', 'mp-info',
      el('span', 'mp-rotulo', 'Nenhum mapa aberto'),
      el('p', 'mp-nota', `Abra um mapa da mochila ou da bolsa: ele vira uma instância só sua (e da party que seguir você), com ${mapas.portais} portais. Cada morte gasta um; limpar 100% (o chefe junto) conclui o mapa. Offline, a caçada segue até limpar.`)));
  }
  corpo.append(topo);

  // ---- os mapas que você carrega
  const lista = el('section', 'mp-lista');
  lista.append(el('h4', 'mp-titulo', `Seus mapas (${mapas.mapas.length})`));
  if (!mapas.mapas.length) lista.append(el('p', 'mp-nota', 'Nenhum mapa com você. Eles caem dentro dos mapas (do tier da área ou um acima; o chefe garante um) e do chefe do Ato 10.'));
  const grade = el('div', 'mp-grade');
  for (const m of mapas.mapas) {
    const c = el('article', `mp-mapa r-${m.raridade}`);
    const fig = el('div', 'mp-fig');
    const ic = h.itemCanvas(m.id, 40);
    h.tipFor(ic, m.id, null, null, m.peca);
    fig.append(ic, el('span', 'mp-tier', `T${m.tier}`));
    c.append(el('header', null, fig, el('div', 'mp-info',
      el('h5', `mp-nome r-${m.raridade}`, m.nome),
      el('span', 'mp-linha', `${RARIDADE[m.raridade] ?? m.raridade} · área nível ${m.nivel}${m.onde === 'pouch' ? ' · na bolsa' : ''}`))));
    c.append(resumoDaPeca(m.peca));
    const abrir = botao('w2-entrar mp-abrir', a ? 'Há um mapa aberto' : 'Abrir mapa', () => {
      abrir.disabled = true;
      avisar('');
      h.send({ t: 'abrirMapa', onde: m.onde, indice: m.indice, assinatura: m.assinatura, mode: 'auto' });
      h.fechar();
    });
    abrir.disabled = !!a;
    c.append(abrir);
    grade.append(c);
  }
  lista.append(grade);
  corpo.append(lista);

  // ---- as estatísticas
  const e = mapas.estatisticas ?? {};
  const est = el('section', 'mp-cartao mp-estat');
  est.append(el('h4', 'mp-titulo', 'Atlas'));
  est.append(el('div', 'mp-numeros',
    el('span', null, el('b', null, String(e.concluidos ?? 0)), ' concluídos'),
    el('span', null, el('b', null, e.maiorTier ? `T${e.maiorTier}` : '—'), ' maior tier'),
    el('span', null, el('b', null, String(e.falhos ?? 0)), ' perdidos'),
    el('span', null, el('b', null, String(e.mortes ?? 0)), ' mortes')));
  const barras = el('div', 'mp-tiers');
  const maior = Math.max(1, ...Object.values(e.porTier ?? {}));
  for (const t of mapas.tiers ?? []) {
    const n = e.porTier?.[t.tier] ?? 0;
    const b = el('div', `mp-tierbar${n ? ' feito' : ''}`, el('i', null), el('small', null, `T${t.tier}`));
    b.firstChild.style.height = `${Math.round((100 * n) / maior)}%`;
    b.title = `Mapa (Nível ${t.tier}) — área nível ${t.nivel}: ${n} concluído${n === 1 ? '' : 's'}`;
    barras.append(b);
  }
  est.append(barras);
  if (e.ultimo) est.append(el('p', 'mp-nota', `Último: Mapa (Nível ${e.ultimo.tier}) ${RESULTADO[e.ultimo.resultado] ?? e.ultimo.resultado} em ${tempo(e.ultimo.duracaoMs)}${e.ultimo.mortes ? `, ${e.ultimo.mortes} morte${e.ultimo.mortes > 1 ? 's' : ''}` : ''}.`));
  corpo.append(est);
}
