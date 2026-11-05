// O DISPOSITIVO DE MAPAS (o endgame do PoE — `systems/mapas-dispositivo.mjs`): a aba Mapas da tela Campanha e o atalho das Docas de Oriath.
// Só desenha o que o servidor mandou (`campanha.mapas`): liberado ou não, o mapa aberto (portais, se está guardado), os mapas que você
// carrega (tier, nível da área, raridade, afixos, quantidade/raridade de itens, tamanho do grupo) e as estatísticas. Quem decide tudo é o
// servidor: abrir manda a peça que a tela mostrou (`onde`, `indice`, `assinatura`) e ele confere de novo.
//
// (27/10, dono: "organizar melhor — uma aba por mapa, os iguais com ×N, e o loop de mapas; deixe isso profissional") Os mapas iguais viram
// UM cartão com o selo "×N" (o "Abrir mapa" abre o primeiro deles), separados em ABAS por tier (Todos, T1…T16 que você tem, Únicos) — a
// parte pura em `mapas-grupos.mjs`. Cada cartão tem a caixa do LOOP (quantos usar: todos, ou um número); "Iniciar loop" manda os grupos
// marcados e o servidor abre um depois do outro a cada mapa concluído (a fila mora no personagem — `systems/itens-poe/mapas-loop.mjs`).
import { iconeDeBotao } from './world-arte.mjs';
import { agruparMapas, abasDosMapas, abaValida, gruposDaAba, rotuloDoGrupo, resumoDaSelecao, ondeDoGrupo } from './mapas-grupos.mjs';

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

/*
 * A memória da tela entre os redesenhos (a campanha chega de novo a cada 8 s): a aba escolhida (também no navegador, como a dificuldade da
 * campanha — `world.mjs`) e os grupos marcados para o loop (`chave → quantos | null`).
 */
const CHAVE_DA_ABA = 'draevor.mapas.v1';
const MEMORIA = { aba: null, selecao: new Map() };
const lerAba = () => {
  if (MEMORIA.aba) return MEMORIA.aba;
  try {
    MEMORIA.aba = JSON.parse(globalThis.localStorage?.getItem(CHAVE_DA_ABA) ?? '{}')?.aba ?? null;
  } catch {
    /* sem armazenamento (janela privada): fica só na memória */
  }
  return MEMORIA.aba ?? 'todos';
};
const lembrarAba = (aba) => {
  MEMORIA.aba = aba;
  try {
    globalThis.localStorage?.setItem(CHAVE_DA_ABA, JSON.stringify({ aba }));
  } catch {
    /* sem armazenamento: a tela funciona igual */
  }
};
/** (os testes) Esquece a aba e a seleção. */
export const esquecerMemoria = () => {
  MEMORIA.aba = null;
  MEMORIA.selecao.clear();
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
  // (05/11) o implícito do ENCONTRO ("Área é influenciada pelo Criador", "Mapa ocupado pelo…", "Mapa contém a Cidadela de…"): o chefe
  // a mais que solta o fragmento de um pináculo (`itens-poe/pinaculos-acesso.mjs`)
  const implicitos = (peca?.poe?.implicitos ?? []).filter((i) => i?.texto);
  if (implicitos.length) bloco.append(el('ul', 'mp-afixos mp-implicitos', ...implicitos.map((i) => el('li', `mp-afixo implicito${peca.poe.encontro ? ' encontro' : ''}`, i.texto))));
  if (r.linhas?.length) {
    bloco.append(el('ul', 'mp-afixos', ...r.linhas.map((l) => {
      const li = el('li', `mp-afixo ${l.estado}`, l.texto);
      if (l.nota) li.title = `Ainda não age por inteiro: ${l.nota}.`;
      return li;
    })));
  } else if (!implicitos.length) bloco.append(el('p', 'mp-sem-afixo', 'Sem afixos: um mapa Normal (sem riscos e sem recompensa extra).'));
  return bloco;
}

/** A influência dos mapas: os botões (nenhuma, Exarca, Devorador) e, de cada convite, a barra "N de 14". */
function blocoDaInfluencia(inf, h) {
  const bloco = el('div', 'mp-influencia');
  const nav = el('nav', 'mp-abas');
  nav.setAttribute('aria-label', 'Influência dos mapas');
  for (const o of [{ id: null, nome: 'Nenhuma' }, ...inf.opcoes]) {
    const ativo = (inf.escolhida ?? null) === o.id;
    const b = botao(`mp-aba${ativo ? ' ativa' : ''}`, null, () => {
      if (ativo) return;
      b.disabled = true;
      h.send({ t: 'influenciaDoAtlas', influencia: o.id });
    });
    b.setAttribute('aria-pressed', ativo ? 'true' : 'false');
    b.append(el('b', null, o.nome));
    nav.append(b);
  }
  bloco.append(el('span', 'mp-rotulo', 'Influência dos próximos mapas'), nav);
  const linhas = el('ul', 'mp-convites');
  for (const c of inf.convites ?? []) {
    const barra = el('div', 'mp-loop-barra', el('i', null));
    barra.firstChild.style.width = `${Math.round((100 * c.feitos) / c.aCada)}%`;
    const li = el('li', `mp-convite${c.influencia === inf.escolhida ? ' ativo' : ''}${c.conta ? '' : ' espera'}`,
      el('span', null, el('b', null, c.nome), ` → ${c.abre}`),
      barra,
      el('small', null, c.conta ? `${c.feitos} de ${c.aCada} chefes de mapa T14+` : 'conta depois da primeira vitória na arena anterior'));
    linhas.append(li);
  }
  bloco.append(linhas, el('p', 'mp-nota', 'Como no PoE: com uma influência escolhida, cada chefe de mapa T14+ vencido conta. A cada 14 cai o convite da arena (Estrela Negra, Fome Infinita); a cada 28, o do pináculo (Exarca, Devorador). Os altares e os monstros influenciados ainda não existem no jogo.'));
  return bloco;
}

/**
 * (05/11, etapa 3) A MAVEN: o botão que a liga nos próximos mapas, o contador "N de 10" (no 10º cai o Convite: Atlas), quem ela testemunhou
 * e, de cada convite dos guardiões, os 4 chefes (os vistos acesos).
 */
function blocoDaMaven(mv, h) {
  const bloco = el('div', 'mp-influencia mp-maven');
  const nav = el('nav', 'mp-abas');
  nav.setAttribute('aria-label', 'A Maven');
  for (const o of [{ ligada: false, nome: 'Desligada' }, { ligada: true, nome: 'A Maven testemunha' }]) {
    const ativo = !!mv.ligada === o.ligada;
    const b = botao(`mp-aba${ativo ? ' ativa' : ''}`, null, () => {
      if (ativo) return;
      b.disabled = true;
      h.send({ t: 'mavenDoAtlas', ligada: o.ligada });
    });
    b.setAttribute('aria-pressed', ativo ? 'true' : 'false');
    b.append(el('b', null, o.nome));
    nav.append(b);
  }
  bloco.append(el('span', 'mp-rotulo', 'A Maven nos próximos mapas'), nav);
  const linhas = el('ul', 'mp-convites');
  const barra = el('div', 'mp-loop-barra', el('i', null));
  barra.firstChild.style.width = `${Math.round((100 * Math.min(mv.contador, mv.meta)) / mv.meta)}%`;
  linhas.append(el('li', `mp-convite${mv.ligada ? ' ativo' : ''}`,
    el('span', null, el('b', null, 'Convite da Maven: Atlas'), ' → Calvário da Conhecedora'),
    barra,
    el('small', null, `${mv.contador} de ${mv.meta} chefes de mapa T${mv.tierMinimo}+ testemunhados${mv.testemunhados?.length ? `: ${mv.testemunhados.join(', ')}` : ''}`)));
  for (const g of mv.grupos ?? []) {
    const vistos = g.chefes.filter((c) => c.visto).length;
    const b2 = el('div', 'mp-loop-barra', el('i', null));
    b2.firstChild.style.width = `${Math.round((100 * vistos) / g.chefes.length)}%`;
    linhas.append(el('li', `mp-convite${mv.ligada ? ' ativo' : ''}`,
      el('span', null, el('b', null, g.nome)),
      b2,
      el('small', null, g.chefes.map((c) => `${c.visto ? '✓' : '·'} ${c.nome}`).join('  '))));
  }
  bloco.append(linhas, el('p', 'mp-nota', `Como no PoE: com a Maven ligada, cada chefe de mapa T${mv.tierMinimo}+ vencido soma 1; no ${mv.meta}º cai o Convite: Atlas, que leva os ${mv.meta} ao Calvário (em pares). Os Guardiões e os Conquistadores testemunhados (os 4 do grupo) dão o convite deles. O Calvário solta os Fragmentos Crescentes: 10 valem A Citação de Maven.`));
  return bloco;
}

/**
 * A seção dos PINÁCULOS: o aberto (portais, voltar, abandonar) e um cartão por pináculo com os itens que ele pede (o ícone, quantos você
 * tem) e o "Abrir". Os que ainda não abrem no jogo (as próximas etapas) ficam numa linha só. `ocupado`: há um mapa aberto ou um loop.
 */
export function secaoDosPinaculos(mapas, h, avisar = () => {}, ocupado = false) {
  const sec = el('section', 'mp-cartao mp-pinaculos');
  sec.append(el('h4', 'mp-titulo', 'Pináculos'));
  const aberto = mapas.pinaculoAberto;
  if (aberto) {
    const acoes = el('div', 'mp-acoes');
    if (!aberto.naArena) acoes.append(botao('w2-entrar', 'Voltar à arena', () => { h.send({ t: 'voltarAoPinaculo', mode: 'auto' }); h.fechar(); }));
    // (a confirmação NA tela: os itens já foram gastos)
    const desistir = botao('mp-desistir', 'Abandonar', () => {
      if (desistir.dataset.certeza) return h.send({ t: 'abandonarPinaculo' });
      desistir.dataset.certeza = '1';
      desistir.textContent = 'Tem certeza? Os itens se perdem';
    });
    acoes.append(desistir);
    sec.append(el('div', 'mp-pin-aberto',
      el('div', 'mp-info',
        el('span', 'mp-rotulo', 'Pináculo aberto'),
        el('h4', 'mp-nome', aberto.nome),
        el('span', 'mp-linha', portais(aberto.portais, aberto.portaisMax), ` ${aberto.portais} de ${aberto.portaisMax} portais${aberto.naArena ? ' · você está na arena' : ''}`)),
      acoes));
  } else sec.append(el('p', 'mp-nota', 'Como no PoE, os pináculos não pedem level: cada um abre aqui com os itens dele (um de cada, gastos ao abrir), com 6 portais. Os fragmentos e as coroas caem garantidos dos Guardiões e dos Conquistadores, que aparecem nos mapas que os chefes de mapa T14+ soltam.'));
  // (etapa 2) a INFLUÊNCIA dos próximos mapas (Exarca, Devorador ou nenhuma) e quanto falta para cada convite
  if (mapas.influencia?.opcoes?.length) sec.append(blocoDaInfluencia(mapas.influencia, h));
  if (mapas.maven) sec.append(blocoDaMaven(mapas.maven, h));
  const comItens = mapas.pinaculos.filter((p) => p.itens);
  const grade = el('div', 'mp-grade mp-pin-grade');
  for (const p of comItens) {
    const c = el('article', `mp-pin${p.pronto ? ' pronto' : ''}`);
    c.append(el('header', null, el('h5', 'mp-nome', p.nome), p.vitorias ? el('small', 'mp-pin-vitorias', `${p.vitorias} vitória${p.vitorias === 1 ? '' : 's'}`) : null));
    const itens = el('div', 'mp-pin-itens');
    for (const it of p.itens) {
      const ic = h.itemCanvas(it.id, 32);
      h.tipFor(ic, it.id);
      const fig = el('figure', `mp-pin-item${it.tem >= 1 ? ' tem' : ''}`, ic, el('figcaption', null, `${it.tem}`));
      fig.title = `${it.nome}: você tem ${it.tem}`;
      itens.append(fig);
    }
    c.append(itens);
    if (p.fechado) c.append(el('small', 'mp-pin-fechado', p.fechado));
    const abrir = botao('w2-entrar mp-abrir', aberto ? (aberto.id === p.id ? 'Aberto' : 'Outro aberto') : ocupado ? 'Mapa aberto' : p.pronto ? 'Abrir' : p.fechado ? 'Fechado' : 'Faltam itens', () => {
      abrir.disabled = true;
      avisar('');
      h.send({ t: 'abrirPinaculo', pinaculo: p.id, mode: 'auto' });
      h.fechar();
    });
    abrir.disabled = !!aberto || ocupado || !p.pronto;
    c.append(el('footer', 'mp-pe', abrir));
    grade.append(c);
  }
  sec.append(grade);
  const depois = mapas.pinaculos.filter((p) => !p.itens);
  if (depois.length) sec.append(el('p', 'mp-nota', `Ainda sem caminho no jogo (próximas etapas): ${depois.map((p) => p.nome).join(', ')}.`));
  return sec;
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

  // ---- o mapa aberto (e o pináculo aberto: um de cada vez no Dispositivo)
  const a = mapas.aberto;
  const pin = !!mapas.pinaculoAberto;
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
      el('p', 'mp-nota', `Abra um mapa da mochila, da bolsa ou do depósito: ele vira uma instância só sua (e da party que seguir você), com ${mapas.portais} portais. Cada morte gasta um; limpar 100% (o chefe junto) conclui o mapa. Offline, a caçada segue até limpar.`)));
  }
  corpo.append(topo);

  // ---- o LOOP de mapas rodando: em que mapa está, a fila e o "Parar loop"
  const loop = mapas.loop?.ativo ? mapas.loop : null;
  if (loop) {
    const cartao = el('section', 'mp-cartao mp-loop');
    const feito = loop.total ? Math.round((100 * loop.feitos) / loop.total) : 0;
    // (na pausa do último da fila não há próximo: `restam` 0 — o loop termina quando a pausa acabar)
    const restam = loop.restam ?? Math.max(0, loop.total - loop.feitos);
    const estado = loop.pendente ? (restam > 0 ? 'Abrindo o próximo mapa…' : 'Último mapa concluído: o loop termina ao voltar para a cidade.') : a && !a.naCacada ? 'Esperando a sua volta ao mapa: o loop segue quando ele for concluído.' : 'Em andamento: o próximo abre sozinho ao concluir este.';
    const barra = el('div', 'mp-loop-barra', el('i', null));
    barra.firstChild.style.width = `${feito}%`;
    barra.setAttribute('aria-label', `${loop.feitos} de ${loop.total} mapas concluídos`);
    const parar = botao('mp-desistir mp-parar', 'Parar loop', () => {
      parar.disabled = true;
      h.send({ t: 'pararLoopDeMapas' });
    });
    cartao.append(
      el('i', 'mp-loop-ico', iconeDeBotao('loop')),
      el('div', 'mp-info',
        el('span', 'mp-rotulo', 'Loop de mapas'),
        el('h4', 'mp-nome', `Loop: ${loop.numero} de ${loop.total}`, el('small', 'mp-loop-fila', ` — ${loop.grupos.map((g) => g.rotulo).join(', ')}`)),
        barra,
        el('span', 'mp-linha', `${loop.feitos} concluído${loop.feitos === 1 ? '' : 's'} · ${estado}`)),
      el('div', 'mp-acoes', parar));
    corpo.append(cartao);
  }

  // ---- os mapas que você carrega: os iguais juntos ("×N"), em abas por tier
  const grupos = agruparMapas(mapas.mapas);
  const abasDaLista = abasDosMapas(grupos);
  // A seleção do loop só guarda os grupos que ainda existem.
  for (const chave of [...MEMORIA.selecao.keys()]) if (!grupos.some((g) => g.chave === chave)) MEMORIA.selecao.delete(chave);
  const lista = el('section', 'mp-lista');
  corpo.append(lista);
  const desenharLista = () => {
    lista.textContent = '';
    const aba = abaValida(abasDaLista, lerAba());
    const cab = el('header', 'mp-lista-cab', el('h4', 'mp-titulo', `Seus mapas (${mapas.mapas.length})`));
    // O porquê do último loop ter parado, com quando (e o "×" para dispensar: o servidor esquece o aviso).
    const fim = !loop ? mapas.loop?.fim : null;
    if (fim) {
      const fora = botao('mp-loop-fim-x', '×', () => {
        fora.disabled = true;
        h.send({ t: 'dispensarFimDoLoop' });
      });
      fora.title = 'Dispensar o aviso';
      fora.setAttribute('aria-label', 'Dispensar o aviso do loop');
      const quando = Number.isFinite(fim.em) ? el('small', null, `há ${tempo(Date.now() - fim.em)}`) : null;
      cab.append(el('span', `mp-loop-fim${fim.concluiu ? ' ok' : ''}`, el('span', null, fim.motivo), quando, fora));
    }
    lista.append(cab);
    // (dono, 27/10) O Baú da Conta é de todos os personagens da conta: os mapas de lá não abrem daqui — a linha diz o que fazer.
    const daConta = Number(mapas.noBauDaConta) || 0;
    if (daConta > 0) lista.append(el('p', 'mp-nota mp-bau-conta', `${daConta === 1 ? '1 mapa' : `${daConta} mapas`} no Baú da Conta: mova para o seu depósito para usar.`));
    if (!mapas.mapas.length) {
      lista.append(el('p', 'mp-nota', 'Nenhum mapa com você. Eles caem dentro dos mapas (do tier da área ou um acima; o chefe garante um) e do chefe do Ato 10.'));
      return;
    }
    // as abas: Todos, os tiers que você tem (com quantos) e os Únicos
    const nav = el('nav', 'mp-abas');
    nav.setAttribute('aria-label', 'Mapas por tier');
    for (const t of abasDaLista) {
      const b = botao(`mp-aba${t.id === aba ? ' ativa' : ''}${t.id === 'unicos' ? ' unicos' : ''}`, null, () => {
        lembrarAba(t.id);
        desenharLista();
      });
      b.setAttribute('aria-pressed', t.id === aba ? 'true' : 'false');
      b.append(el('b', null, t.rotulo), el('small', null, `×${t.qtd}`));
      nav.append(b);
    }
    lista.append(nav);
    const daAba = gruposDaAba(grupos, aba);
    const grade = el('div', 'mp-grade');
    for (const g of daAba) grade.append(cartaoDoGrupo(g));
    lista.append(grade);
    lista.append(barraDoLoop(daAba));
  };

  /** Um cartão por grupo de mapas iguais: o selo ×N, os afixos, a caixa do loop (com quantos) e o "Abrir mapa" (abre o primeiro). */
  function cartaoDoGrupo(g) {
    const m = g.mapas[0];
    const marcado = MEMORIA.selecao.has(g.chave);
    const c = el('article', `mp-mapa r-${g.raridade}${marcado ? ' marcado' : ''}`);
    const fig = el('div', 'mp-fig');
    const ic = h.itemCanvas(m.id, 40);
    h.tipFor(ic, m.id, null, null, m.peca);
    fig.append(ic, el('span', 'mp-tier', g.raridade === 'unico' ? 'Ú' : `T${g.tier}`));
    const onde = ondeDoGrupo(g);
    const cab = el('header', null, fig, el('div', 'mp-info',
      el('h5', `mp-nome r-${g.raridade}`, m.nome),
      el('span', 'mp-linha', `${RARIDADE[g.raridade] ?? g.raridade} · área nível ${g.nivel}${onde}`)));
    cab.append(el('span', `mp-qtd${g.qtd > 1 ? ' varios' : ''}`, `×${g.qtd}`));
    c.append(cab);
    c.append(resumoDaPeca(m.peca));
    // o rodapé: a caixa do loop (e quantos usar) e o abrir
    const pe = el('footer', 'mp-pe');
    const caixa = el('input', 'mp-caixa');
    caixa.type = 'checkbox';
    caixa.checked = marcado;
    caixa.disabled = !!loop;
    caixa.onchange = () => {
      if (caixa.checked) MEMORIA.selecao.set(g.chave, MEMORIA.selecao.get(g.chave) ?? null);
      else MEMORIA.selecao.delete(g.chave);
      desenharLista();
    };
    const marcar = el('label', 'mp-marcar', caixa, el('span', null, 'Loop'));
    pe.append(marcar);
    if (marcado && g.qtd > 1) {
      const qtd = el('input', 'mp-quantos');
      qtd.type = 'number';
      qtd.min = '1';
      qtd.max = String(g.qtd);
      qtd.placeholder = 'todos';
      const q = MEMORIA.selecao.get(g.chave);
      qtd.value = q == null ? '' : String(q);
      qtd.title = 'Quantos mapas deste grupo o loop usa (vazio: todos, inclusive os iguais que caírem no caminho)';
      qtd.setAttribute('aria-label', 'Quantos usar');
      qtd.onchange = () => {
        const n = Math.floor(Number(qtd.value));
        MEMORIA.selecao.set(g.chave, n >= 1 ? Math.min(n, g.qtd) : null);
        desenharLista();
      };
      pe.append(el('label', 'mp-usar', el('span', null, 'usar'), qtd));
    }
    // Com o loop rodando, abrir à mão fica travado (na pausa do concluído também: abrir outro mapa encerraria o loop sem você pedir).
    const abrir = botao('w2-entrar mp-abrir', a ? 'Há um mapa aberto' : loop ? 'Loop rodando' : pin ? 'Pináculo aberto' : 'Abrir mapa', () => {
      abrir.disabled = true;
      avisar('');
      h.send({ t: 'abrirMapa', onde: m.onde, indice: m.indice, assinatura: m.assinatura, mode: 'auto' });
      h.fechar();
    });
    abrir.disabled = !!a || !!loop || pin;
    if (loop && !a) abrir.title = 'Pare o loop para abrir um mapa à mão.';
    else if (pin) abrir.title = 'Vença (ou abandone) o pináculo aberto antes de abrir um mapa.';
    pe.append(abrir);
    c.append(pe);
    return c;
  }

  /** A barra do loop no pé da lista: o que está marcado, "Marcar a aba", "Limpar" e "Iniciar loop". */
  function barraDoLoop(daAba) {
    const sel = resumoDaSelecao(grupos, MEMORIA.selecao);
    const barra = el('div', 'mp-barra-loop');
    const texto = loop
      ? 'Um loop já está rodando.'
      : sel.grupos.length
        ? `${sel.grupos.length} grupo${sel.grupos.length === 1 ? '' : 's'} · ${sel.mapas} mapa${sel.mapas === 1 ? '' : 's'} no loop`
        : 'Marque os mapas para o loop: eles abrem um depois do outro, a cada mapa concluído.';
    barra.append(el('span', 'mp-barra-texto', texto));
    const marcarAba = botao('mp-sel', 'Marcar a aba', () => {
      for (const g of daAba) if (!MEMORIA.selecao.has(g.chave)) MEMORIA.selecao.set(g.chave, null);
      desenharLista();
    });
    marcarAba.disabled = !!loop || !daAba.length;
    const limpar = botao('mp-sel', 'Limpar', () => {
      MEMORIA.selecao.clear();
      desenharLista();
    });
    limpar.disabled = !!loop || !sel.grupos.length;
    const iniciar = botao('w2-entrar mp-iniciar', loop ? 'Loop rodando' : a ? 'Há um mapa aberto' : 'Iniciar loop', () => {
      iniciar.disabled = true;
      avisar('');
      h.send({ t: 'iniciarLoopDeMapas', grupos: sel.grupos, mode: 'auto' });
      MEMORIA.selecao.clear();
      h.fechar();
    });
    iniciar.disabled = !!a || !!loop || pin || !sel.grupos.length;
    if (a && !loop) iniciar.title = 'Termine (ou abandone) o mapa aberto antes de começar o loop.';
    barra.append(el('div', 'mp-barra-acoes', marcarAba, limpar, iniciar));
    return barra;
  }
  desenharLista();

  // ---- os PINÁCULOS (05/11, dono: "quero igual do poe"): cada um abre aqui com os itens dele (um de cada, gastos ao abrir), 6 portais
  if (mapas.pinaculos?.length) corpo.append(secaoDosPinaculos(mapas, h, avisar, !!a || !!loop));

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
