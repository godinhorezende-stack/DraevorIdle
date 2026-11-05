/*
 * ---- A aba MISSÕES (a janela Tarefas no jogo do PoE) ----
 *
 * "verifique se todas essas missões e assets de itens de missões estão
 *  implementadas, se não implemente — use onde fica task" (dono, 05/11), e a
 * escolha dele: as missões SUBSTITUEM a aba Tasks.
 *
 * Os DADOS (as 179 missões do poedb: nome, passos, recompensas, itens) vêm do
 * arquivo estático `/gamedata/itens-poe/missoes.json`, pedido uma vez — eles
 * não mudam com o personagem. O ESTADO de cada missão (concluída, passos
 * feitos, recompensa esperando) vem do servidor sob demanda (`{t:'missoes'}`,
 * itens-poe/missoes.mjs → `ficha`), como as tasks de criatura vinham.
 *
 * Lista à esquerda, a missão escolhida à direita (no telefone, duas telas —
 * lista-detalhe.mjs), com o filtro em cima: o ato (ou Atlas / Liga e outras),
 * o estado e a busca.
 */
import { itemCanvas } from './sprites.mjs';
import { tipFor, tipTexto } from './tooltip.mjs';
import { montarAosPoucos } from './aos-poucos.mjs';
import { listaDetalhe } from './lista-detalhe.mjs';
import { abrirRecompensaDeGema } from './missoes-poe.mjs';

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

export const URL_DAS_MISSOES = '/gamedata/itens-poe/missoes.json';
let dados = null;
let pedidoDosDados = null;
/** Os dados das missões (uma vez; o redesenho chega quando o arquivo chega). */
function carregar(redesenhar) {
  pedidoDosDados ??= fetch(URL_DAS_MISSOES)
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      dados = d;
      redesenhar();
    })
    .catch(() => {
      pedidoDosDados = null;
    });
}

const RITMO_DA_RENOVACAO = 10_000;
let ultimoPedido = 0;
/** O filtro fica FORA do DOM: o painel se refaz inteiro a cada estado. */
const filtro = { texto: '', grupo: 'campanha', estado: 'todas', escolhida: null };

const GRUPOS = [
  { id: 'campanha', nome: 'Campanha', cabe: (m) => m.categoria === 'campanha' },
  ...Array.from({ length: 10 }, (_, i) => ({ id: `ato${i + 1}`, nome: `Ato ${i + 1}`, cabe: (m) => m.categoria === 'campanha' && m.atos.includes(i + 1) })),
  { id: 'atlas', nome: 'Atlas', cabe: (m) => m.categoria === 'atlas' },
  { id: 'outras', nome: 'Liga e outras', cabe: (m) => m.categoria !== 'campanha' && m.categoria !== 'atlas' },
  { id: 'todas', nome: 'Todas', cabe: () => true },
];
const ESTADOS = [
  { id: 'todas', nome: 'Todas', cabe: () => true },
  { id: 'abertas', nome: 'Em aberto', cabe: (m, e) => !m.semCaminho && !e?.concluida && !e?.naoEscolhida },
  { id: 'concluidas', nome: 'Concluídas', cabe: (m, e) => !!e?.concluida },
  { id: 'recompensa', nome: 'Recompensa', cabe: (m, e, gema) => !!e?.escolher || gema },
];
const TIPOS = { Normal: 'Principal', Optional: 'Opcional', Labyrinth: 'Labirinto', Hideout: 'Esconderijo', MasterQuest: 'Mestre', MasterMission: 'Missão de liga' };

const urlDoIcone = (rel) => `/api/jogo/poe/icone/item/${rel.split('/').map(encodeURIComponent).join('/')}`;
function iconeDaMissao(m, lado) {
  const caixa = el('span', 'missao-icone');
  caixa.style.width = caixa.style.height = `${lado}px`;
  if (m.icone) {
    const img = el('img');
    img.src = urlDoIcone(m.icone);
    img.alt = '';
    img.loading = 'lazy';
    caixa.append(img);
  } else if (m.itens?.[0]) caixa.append(itemCanvas(m.itens[0], lado));
  else caixa.append(el('i', 'missao-icone-vazio', '!'));
  return caixa;
}

/** O estado da missão em uma palavra (a linha da lista e o selo do detalhe). */
function situacao(m, e, gema) {
  if (e?.escolher || gema) return { classe: 'recompensa', texto: 'recompensa para escolher' };
  if (e?.concluida) return { classe: 'feita', texto: 'concluída' };
  if (e?.naoEscolhida) return { classe: 'abandonada', texto: 'não escolhida' };
  if (m.semCaminho) return { classe: 'sem-caminho', texto: 'sem caminho no jogo' };
  return { classe: 'aberta', texto: 'em aberto' };
}

export function renderMissoes(body, ctx) {
  const { state, send } = ctx;
  const redesenhar = () => (ctx.redrawSuave ?? ctx.redraw)?.();
  if (!dados) carregar(redesenhar);
  const agora = Date.now();
  if (agora - ultimoPedido > RITMO_DA_RENOVACAO) {
    ultimoPedido = agora;
    send({ t: 'missoes' });
  }
  const ficha = state.missoes;
  const estados = ficha?.missoes ?? {};
  const gemasPendentes = new Set((state.character?.missoesPoe ?? []).map((p) => p.slug));

  // ---- o filtro: a busca, os grupos e os estados ----
  const barra = el('div', 'tbicho-filtro');
  const busca = el('input');
  busca.id = 'missao-busca';
  busca.type = 'search';
  busca.placeholder = 'Procurar missão, área ou item...';
  busca.value = filtro.texto;
  busca.oninput = () => {
    filtro.texto = busca.value;
    redesenhar();
  };
  barra.append(busca);
  const faixas = el('div', 'tbicho-faixas');
  for (const g of GRUPOS) {
    const b = el('button', 'tbicho-faixa' + (filtro.grupo === g.id ? ' ativa' : ''), g.nome);
    b.type = 'button';
    b.onclick = () => {
      filtro.grupo = g.id;
      redesenhar();
    };
    faixas.append(b);
  }
  // (os estados na MESMA fileira, atrás da divisa dourada — o arranjo das tasks de criatura)
  const caixaDosEstados = el('span', 'tbicho-estados');
  faixas.append(caixaDosEstados);
  for (const s of ESTADOS) {
    const b = el('button', 'tbicho-faixa tbicho-estado' + (filtro.estado === s.id ? ' ativa' : ''), s.nome);
    b.type = 'button';
    b.onclick = () => {
      filtro.estado = s.id;
      redesenhar();
    };
    caixaDosEstados.append(b);
  }
  barra.append(faixas);
  body.append(barra);

  if (!dados || !ficha) return void body.append(el('p', 'gate-note', 'Consultando as missões...'));
  if (ficha.ligado === false) return void body.append(el('p', 'empty', 'As missões do PoE não estão ligadas neste servidor.'));

  // ---- o resumo: o que já foi feito e os pontos que as missões deram ----
  // (os quatro dos Bandidos são UMA missão: a escolha feita conta uma vez)
  const campanha = dados.missoes.filter((m) => m.categoria === 'campanha' && !m.gatilho?.bandido);
  const feitas = campanha.filter((m) => estados[m.slug]?.concluida).length + (ficha.bandido ? 1 : 0);
  const resumo = el('p', 'tbicho-resumo');
  resumo.append(
    el('b', null, `${feitas} de ${campanha.length + 1}`),
    ` missões da campanha concluídas · ${ficha.pontos ?? 0} Ponto${ficha.pontos === 1 ? '' : 's'} de Habilidade Passiva das missões`,
  );
  tipTexto(resumo, 'Os Bandidos contam como uma missão só (você escolhe matar os três ou ajudar um). Os pontos das missões somam no total da Árvore de Passivas.');
  body.append(resumo);
  if (ficha.bandidoPendente) body.append(cartaoDosBandidos(ctx, dados));

  const grupo = GRUPOS.find((g) => g.id === filtro.grupo) ?? GRUPOS[0];
  const est = ESTADOS.find((s) => s.id === filtro.estado) ?? ESTADOS[0];
  const termo = filtro.texto.trim().toLowerCase();
  const nomesDosItens = (m) => (m.itens ?? []).map((id) => state.items?.[id]?.name ?? '').join(' ');
  const lista = dados.missoes.filter(
    (m) =>
      grupo.cabe(m) &&
      est.cabe(m, estados[m.slug], gemasPendentes.has(m.slug)) &&
      (!termo || `${m.nome} ${m.en ?? ''} ${(m.passos ?? []).map((p) => p.area ?? '').join(' ')} ${nomesDosItens(m)}`.toLowerCase().includes(termo)),
  );

  const layout = el('div', 'ciclo-layout missoes-layout');
  const coluna = el('div', 'ciclo-lista');
  const detalhe = el('div', 'ciclo-ficha missao-ficha');
  if (!lista.length) coluna.append(el('p', 'empty', 'Nenhuma missão com esse filtro.'));
  montarAosPoucos(coluna, lista, (m) => {
    const e = estados[m.slug];
    const s = situacao(m, e, gemasPendentes.has(m.slug));
    const linha = el('button', `ciclo-item missao-linha missao-${s.classe}${filtro.escolhida === m.slug ? ' escolhido' : ''}`);
    linha.type = 'button';
    linha.append(iconeDaMissao(m, 28));
    const texto = el('div', 'ciclo-item-texto');
    texto.append(el('b', null, m.nome));
    texto.append(el('span', null, [m.atos?.length ? `Ato ${m.atos.join('/')}` : null, TIPOS[m.tipo] ?? m.tipo, s.texto].filter(Boolean).join(' · ')));
    linha.append(texto);
    linha.append(el('i', `missao-marca missao-marca-${s.classe}`, s.classe === 'feita' ? '✓' : s.classe === 'recompensa' ? '!' : s.classe === 'sem-caminho' ? '–' : '·'));
    linha.onclick = () => {
      filtro.escolhida = m.slug;
      redesenhar();
    };
    return linha;
  });
  const escolhida = dados.missoes.find((m) => m.slug === filtro.escolhida && lista.includes(m)) ?? null;
  if (escolhida) desenharDetalhe(detalhe, escolhida, estados[escolhida.slug], ctx, gemasPendentes.has(escolhida.slug));
  else detalhe.append(el('p', 'empty', 'Escolha uma missão na lista.'));
  layout.append(coluna, detalhe);
  body.append(layout);
  listaDetalhe(layout, detalhe, {
    id: 'missoes',
    escolhido: !!escolhida,
    voltar: () => {
      filtro.escolhida = null;
      redesenhar();
    },
  });
}

/** A escolha dos Bandidos (aparece no alto da aba quando as três fases estão feitas e nada foi escolhido). */
function cartaoDosBandidos(ctx, d) {
  const caixa = el('div', 'missao-bandidos ui-frame ui-frame--card');
  caixa.append(el('b', 'missao-bandidos-titulo', 'Lidando com os Bandidos'));
  caixa.append(el('p', 'shop-note', 'Você enfrentou os três Lordes Bandidos. Escolha UMA vez: matar os três ou ajudar um deles (como no PoE, a escolha não volta atrás).'));
  const botoes = el('div', 'missao-bandidos-botoes');
  for (const b of ['todos', 'kraityn', 'alira', 'oak']) {
    const m = d.missoes.find((x) => x.gatilho?.bandido === b);
    if (!m) continue;
    const premio = b === 'todos' ? `${m.recompensas.pontos} Ponto${m.recompensas.pontos === 1 ? '' : 's'} de Habilidade Passiva` : m.recompensas.bonus.join(', ');
    const botao = el('button', 'missao-bandido');
    botao.type = 'button';
    botao.append(el('b', null, b === 'todos' ? 'Matar os três' : `Ajudar ${m.nome.replace(/^(O|A) Lorde Bandido /, '')}`), el('em', null, premio));
    botao.onclick = () => {
      botoes.querySelectorAll('button').forEach((x) => (x.disabled = true));
      ctx.send({ t: 'missoes', action: 'bandido', bandido: b });
    };
    botoes.append(botao);
  }
  caixa.append(botoes);
  return caixa;
}

function desenharDetalhe(caixa, m, e, ctx, gemaPendente) {
  const { state, send } = ctx;
  const s = situacao(m, e, gemaPendente);
  const topo = el('div', 'ciclo-ficha-topo');
  topo.append(iconeDaMissao(m, 48));
  const nome = el('div');
  nome.append(el('b', null, m.nome));
  nome.append(el('span', null, [m.en, m.atos?.length ? `Ato ${m.atos.join('/')}` : null, TIPOS[m.tipo] ?? m.tipo].filter(Boolean).join(' · ')));
  topo.append(nome, el('em', `missao-selo missao-${s.classe}`, s.texto));
  caixa.append(topo);
  if (m.descricao) caixa.append(el('p', 'missao-descricao', m.descricao));

  // ---- o que conclui (ou por que não há caminho) ----
  if (m.semCaminho) caixa.append(el('p', 'gate-note', `Sem caminho no jogo: ${m.semCaminho}`));
  else if (m.comoConclui) {
    const p = el('p', 'shop-note');
    p.append(el('b', null, 'Conclui ao: '), m.comoConclui);
    caixa.append(p);
  }
  if (m.nota) caixa.append(el('p', 'gate-note', m.nota));

  // ---- as recompensas ----
  const r = m.recompensas ?? {};
  const linhas = [];
  if (r.pontos) linhas.push(`${r.pontos} Ponto${r.pontos === 1 ? '' : 's'} de Habilidade Passiva`);
  if (r.restituicoes) linhas.push(`${r.restituicoes} Pontos de Restituição de Passiva (no jogo o respec é grátis)`);
  for (const b of r.bonus ?? []) linhas.push(b);
  for (const p of r.penalidades ?? []) linhas.push(`${p} (a ficha já aplica ao vencer o chefe)`);
  if (linhas.length || r.escolha?.length || r.gemasPorClasse) {
    caixa.append(el('div', 'sheet-sub', 'Recompensa'));
    for (const l of linhas) caixa.append(el('p', 'missao-recompensa', l));
    if (r.gemasPorClasse) {
      const p = el('p', 'missao-recompensa', 'Uma gema da lista da sua classe (nível 1).');
      if (gemaPendente) {
        const b = el('button', 'tbicho-pegar', 'Escolher a gema');
        b.type = 'button';
        b.onclick = () => abrirRecompensaDeGema(m.slug);
        p.append(' ', b);
      }
      caixa.append(p);
    }
    if (r.escolha?.length) {
      const escolhida = e?.escolhida;
      caixa.append(el('p', 'missao-recompensa', escolhida != null ? 'Escolhida:' : e?.escolher ? 'Escolha UMA:' : 'Uma à escolha, ao concluir:'));
      const grade = el('div', 'missao-escolhas');
      r.escolha.forEach((op, i) => {
        const card = el('button', `missao-escolha${escolhida === i ? ' escolhida' : ''}`);
        card.type = 'button';
        const id = op.id ?? Object.values(state.items ?? {}).find((it) => it.poe?.base === op.base)?.id;
        if (id) {
          card.append(itemCanvas(id, 32));
          tipFor(card, id);
        }
        card.append(el('b', null, op.nome));
        card.disabled = !e?.escolher;
        if (e?.escolher) card.onclick = () => {
          grade.querySelectorAll('button').forEach((x) => (x.disabled = true));
          send({ t: 'missoes', action: 'escolher', missao: m.slug, opcao: i });
        };
        grade.append(card);
      });
      caixa.append(grade);
    }
  } else if (r.texto) {
    caixa.append(el('div', 'sheet-sub', 'Recompensa'));
    caixa.append(el('p', 'missao-recompensa', r.texto));
  }

  // ---- os itens de missão ----
  if (m.itens?.length) {
    caixa.append(el('div', 'sheet-sub', 'Itens da missão'));
    const linha = el('div', 'missao-itens');
    for (const id of m.itens) {
      const cela = el('div', 'missao-item' + (e?.concluida ? ' obtido' : ''));
      cela.append(itemCanvas(id, 36));
      cela.append(el('span', null, state.items?.[id]?.name ?? `#${id}`));
      tipFor(cela, id);
      linha.append(cela);
    }
    caixa.append(linha);
  }

  // ---- os passos (os do poedb; feitos pelo que o personagem já completou) ----
  if (m.passos?.length) {
    caixa.append(el('div', 'sheet-sub', 'Passos'));
    const feitos = new Set(e?.passos ?? []);
    const ol = el('ol', 'missao-passos');
    const vistos = new Set();
    for (const p of m.passos) {
      // (o poedb repete o mesmo passo em variações — "Encontre as outras duas Páginas Douradas"…: um por texto)
      const chave = `${p.titulo}|${p.objetivos.join('|')}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      const li = el('li', feitos.has(p.n) ? 'feito' : '');
      li.append(el('i', 'missao-passo-marca', feitos.has(p.n) ? '✓' : '·'));
      const t = el('div');
      t.append(el('b', null, p.titulo));
      for (const o of (p.objetivos ?? []).flatMap((x) => x.split('\n'))) if (o !== p.titulo) t.append(el('span', null, o));
      if (p.area) t.append(el('em', null, p.area));
      li.append(t);
      ol.append(li);
    }
    caixa.append(ol);
  }
}
