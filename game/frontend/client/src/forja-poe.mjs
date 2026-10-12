// A FORJA do PoE (dono, 07/10: "utilizando a forja refazendo para uso dos itens que têm efeito"; 12/10: "reformulação completa da Forja" —
// o modelo compacto do UNDECEMBER, a estética do PoE 1). Uma janela só: à esquerda as CATEGORIAS em grupos (Encaixes, Modificadores,
// Outros — `engine/forja-poe.mjs` → `GRUPOS`; cada moeda com efeito numa delas), no meio a PEÇA escolhida com o que a categoria mexe,
// o RESULTADO DESEJADO, o MATERIAL, a estimativa e a REPETIÇÃO; à direita o INVENTÁRIO (as peças vestidas, a mochila e os materiais —
// os mesmos do personagem, sem cópia).
//
// A tela só configura e mostra. Quem valida, sorteia, gasta o material e grava é o servidor (`systems/itens-poe/forja.mjs`): as opções
// (`{t:'forjaOpcoes'}` → `forjaOpcoes`), a forja em lotes (`{t:'forjaRepetir', id, passo}` → `forjaResultado`; cada lote termina antes de
// o próximo ser pedido, e só um por vez) e o cancelar (`{t:'forjaCancelar'}`). A peça nova volta no estado, como sempre.
import { itemCanvas } from './sprites.mjs';
import { tipFor, tipTexto } from './tooltip.mjs';
import { vestirRaridade, selarSoquetes } from './inventory.mjs';
// As MESMAS regras do servidor (o resultado desejado e o tipo da peça) e a mesma conta dos grupos ligados.
import { CORES, GRUPOS, COM_DESEJO, categoria as cadastroDa, atingiu, contarCores, maiorGrupo, tipoDaPeca } from '/packages/shared/src/forja-poe.mjs';
import { gruposLigados } from '/packages/shared/src/sockets-de-gema.mjs';

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};
const botao = (className, text, aoClicar, dica = null) => {
  const b = el('button', className, text);
  b.type = 'button';
  if (aoClicar) b.onclick = aoClicar;
  if (dica) tipTexto(b, dica);
  return b;
};

const AJUDA = {
  sockets: 'Muda a QUANTIDADE de sockets. O máximo depende da classe da peça e do item level dela (algumas bases têm número fixo). O Orbe do Joalheiro sorteia outro número (sempre diferente do atual) e refaz cores e links; a peça precisa estar sem gemas. O Joalheiro Corroído (peça corrompida) soma ou tira um.',
  cores: 'Muda as CORES dos sockets abertos. O Orbe Cromático sorteia outra combinação, puxando para o atributo que a peça pede (Força → vermelho, Destreza → verde, Inteligência → azul); branco só sai do Cromático Corroído. O desejo conta as cores, sem importar a ordem. A peça precisa estar sem gemas.',
  links: 'Muda as LIGAÇÕES entre sockets vizinhos. O Orbe da Fusão sorteia os links de novo (todos ligados é raro). O desejo é um grupo ligado de N sockets, em qualquer posição. As gemas ficam onde estão.',
  raridade: 'Muda a RARIDADE: Transmutação (Normal → Mágico), Alquimia e Elo (Normal → Raro), Régia (Mágico → Raro), Expurgo (volta a Normal), Chance (Normal → Mágico, Raro ou Único). Na Chance, a repetição pode usar o Orbe do Expurgo para voltar a peça a Normal entre as tentativas.',
  atributos: 'Muda os MODIFICADORES explícitos: sortear de novo (Alteração na Mágica, Caos na Rara, Caos Oculto), somar (Ampliador, Exaltado), tirar (Anulação), sortear os valores (Divino) e prender um (Talhador). A repetição vale nas moedas que sorteiam de novo; o desejo usa os modificadores que a base e o item level da peça podem dar.',
  implicitos: 'O Orbe Abençoado sorteia de novo os VALORES dos implícitos; o Orbe Sagrado sorteia de novo a DEFESA da base (armadura, evasão, escudo de energia). Uma tentativa por vez.',
  influencia: 'Os Exaltados de influência (Criador, Ancião, Cruzado, Juiz, Caçador, Senhor da Guerra) põem um modificador da influência numa peça Rara sem influência. O Orbe do Domínio eleva um modificador influenciado (pede dois). Uma tentativa por vez.',
  ancestral: 'As Brasas (Exarca Abrasador) e os Fluidos (Devorador de Mundos) põem o implícito Eldritch em Peitoral, Botas, Luvas ou Elmo, do tier da moeda. Os orbes Ancestrais mexem no lado que domina; o Conflito sobe um implícito e desce o outro. Uma tentativa por vez.',
  qualidade: 'Sobe a QUALIDADE (até 20%): +5% na Normal, +2% na Mágica, +1% na Rara e na Única. Amolador em arma, Sucata em armadura, Bolha em frasco. O resultado aparece antes de forjar.',
  corrupcao: 'O Orbe Vaal CORROMPE a peça (permanente: depois só as moedas Corroídas valem nela). As Corroídas valem só em peça corrompida; as de sockets ficam em Sockets, Cores e Links. O Orbe Mítico Corroído pode destruir a peça. Uma tentativa por vez.',
  especiais: 'O Espelho de Kalandra faz uma cópia espelhada (que não aceita mais moeda); o Orbe Ancestral troca o único por outro da mesma classe; o Orbe do Remorso dá um ponto para tirar um nó da árvore de passivas (não pede peça).',
  gemas: 'O Prisma do Lapidário sobe 1% de qualidade da gema (até 20%); a Lente do Lapidário troca a gema por outra do mesmo tipo. Escolha a gema no inventário à direita (filtro Gemas).',
  lascas: 'As LASCAS se juntam: 20 iguais formam 1 orbe inteiro (sem peça). O resultado aparece antes de forjar.',
  semEfeito: 'Estas moedas são de ligas e sistemas do PoE que o jogo não tem (mapas, Atlas, Bestiário, encantamentos, Ritual…). Ficam cadastradas, mas não fazem nada; o motivo de cada uma está no material.',
};
/** As categorias que não precisam de peça (a forja delas não mexe em item). */
const SEM_PECA = new Set(['lascas', 'semEfeito']);
const NOME_DA_COR = { R: 'Vermelho', G: 'Verde', B: 'Azul', W: 'Branco' };
const DICA_DA_COR = { R: 'Força', G: 'Destreza', B: 'Inteligência', W: 'aceita qualquer gema' };
const NOME_DO_SLOT = { weapon: 'Arma', shield: 'Mão secundária', head: 'Elmo', body: 'Armadura', gloves: 'Luvas', feet: 'Botas', legs: 'Cinto', neck: 'Amuleto', ring: 'Anel', ring2: 'Anel', flask: 'Frasco' };
const ABAS = [['equipamentos', 'Equipamentos'], ['inventario', 'Inventário'], ['materiais', 'Materiais']];
const FILTROS = [['todos', 'Todos'], ['armas', 'Armas'], ['armaduras', 'Armaduras'], ['acessorios', 'Acessórios'], ['frascos', 'Frascos'], ['mapas', 'Mapas'], ['gemas', 'Gemas']];
const MODOS = [['uma', 'Uma tentativa'], ['limite', 'Limite de tentativas'], ['ate', 'Até atingir o resultado']];
const MOTIVO = {
  atingiu: ['ok', 'Resultado alcançado'], jaEsta: ['ok', 'Já estava assim'], feito: ['ok', 'Feito'], limite: ['aviso', 'Limite alcançado'],
  semMaterial: ['aviso', 'Sem material'], naoPode: ['erro', 'A peça não aceita mais'], cancelado: ['aviso', 'Cancelado'], saiu: ['erro', 'A peça saiu da Forja'],
  erro: ['erro', 'Erro'], encerrada: ['aviso', 'Encerrada'], semResposta: ['erro', 'Sem resposta do servidor'],
};
/** Sem resposta de um lote em tanto tempo, a tela solta os botões (a conexão caiu; nada mais é pedido). */
const ESPERA_MS = 15000;

let ctx = null;
let redrawDaForja = null;
/** A sessão de forja (só a tela; o servidor decide tudo). O desejo e o material ficam por categoria: trocar de aba não os mistura. */
const f = {
  categoria: 'sockets', abaInv: 'equipamentos', filtro: 'todos',
  peca: null, // { alvo, base, ilvl, id }
  moeda: {}, desejo: {}, modo: 'uma', limite: 10, reiniciar: false,
  configAberta: false, ajuda: false, filtroMod: { tag: '', lado: '' },
  opcoes: null, pedido: 0, timer: null, exec: null, vigia: null,
};

/** A Forja do PoE está ligada? (o modo PoE manda as moedas no catálogo) */
export const temForjaPoe = (state) => Object.values(state?.items ?? {}).some((i) => i?.moedaPoe);

export function abrirForjaPoe(context, { moeda = null } = {}) {
  ctx = context;
  if (moeda != null) escolherMoeda(Number(moeda));
  // Sem peça escolhida: a primeira do PoE (vestida primeiro), para a janela já abrir com algo no meio.
  if (!escolhida()) {
    const primeira = pecas().find((x) => !x.gema);
    if (primeira) f.peca = marca(primeira);
  }
  ctx.openModal('Forja', (body) => {
    redrawDaForja = () => desenhar(body);
    ctx.redraw = redrawDaForja;
    // Renasce só quando o que a Forja mostra mudou (as peças, os sockets, a mochila), e não a cada ouro/xp da caçada.
    ctx.redrawKey = assinatura;
    desenhar(body);
    pedirOpcoes();
  }, () => {
    // Fechou no meio da repetição: para (o lote que já rodou fica).
    if (f.exec?.rodando) cancelar();
    redrawDaForja = null;
  }, 'forja-poe');
}

const redesenhar = () => {
  if (ctx && redrawDaForja && ctx.redraw === redrawDaForja) redrawDaForja();
};
function assinatura() {
  const c = ctx?.state?.character;
  if (!c) return '';
  const vestidas = Object.entries(c.equipment ?? {}).filter(([, p]) => p?.poe).map(([slot, p]) => [slot, p.poe, p.soquetes ?? null]);
  return JSON.stringify([vestidas, c.inventory ?? [], c.equipment?.backpack?.id ?? null]);
}

// ---------------------------------------------------------------- o que o personagem tem
const itens = () => ctx.state.items ?? {};
let porSlug = null;
function idDoSlug(slug) {
  if (!porSlug || !porSlug.size) porSlug = new Map(Object.values(itens()).filter((i) => i?.moedaPoe).map((i) => [i.moedaPoe.slug, i.id]));
  return porSlug.get(slug) ?? null;
}
/** As moedas do PoE na mochila: id → quantidade. */
function moedasNaMochila() {
  const tem = new Map();
  for (const p of ctx.state.character?.inventory ?? []) if (itens()[p.id]?.moedaPoe) tem.set(p.id, (tem.get(p.id) ?? 0) + (p.count ?? 1));
  return tem;
}
/** As peças que a Forja trabalha: as do PoE vestidas e na mochila, e as gemas da mochila (o Prisma e a Lente). */
function pecas() {
  const c = ctx.state.character ?? {};
  const saida = [];
  for (const [slot, p] of Object.entries(c.equipment ?? {})) if (p?.poe) saida.push({ alvo: { onde: 'equipment', slot }, peca: p, onde: NOME_DO_SLOT[slot] ?? slot, tipo: tipoDaPeca(p.poe) });
  (c.inventory ?? []).forEach((p, indice) => {
    if (p?.poe) saida.push({ alvo: { onde: 'inventory', indice }, peca: p, onde: 'mochila', tipo: tipoDaPeca(p.poe) });
    else if (itens()[p?.id]?.gemaDef) saida.push({ alvo: { onde: 'inventory', indice }, peca: p, onde: 'mochila', tipo: 'gemas', gema: true });
  });
  return saida;
}
const mesmoAlvo = (a, b) => !!a && !!b && a.onde === b.onde && (a.slot ?? a.indice) === (b.slot ?? b.indice);
const marca = (x) => ({ alvo: x.alvo, id: x.peca.id, base: x.peca.poe?.base ?? null, ilvl: x.peca.poe?.ilvl ?? null });
const mesmaPeca = (m, x) => x.peca.id === m.id && (x.peca.poe?.base ?? null) === m.base && (x.peca.poe?.ilvl ?? null) === m.ilvl;
/** A peça escolhida no estado de agora (a mochila pode ter mudado de ordem: acha a mesma base pelo lugar ou, sendo única, onde estiver). */
function escolhida() {
  if (!f.peca) return null;
  const lista = pecas();
  const ali = lista.find((x) => mesmoAlvo(x.alvo, f.peca.alvo));
  if (ali && mesmaPeca(f.peca, ali)) return ali;
  const iguais = lista.filter((x) => mesmaPeca(f.peca, x));
  if (iguais.length === 1) {
    f.peca = marca(iguais[0]);
    return iguais[0];
  }
  f.peca = null;
  return null;
}
/** As opções do servidor valem para a categoria e a peça de agora? */
const opcoesValem = (categoria = f.categoria) => !!f.opcoes && f.opcoes.categoria === categoria && ((!f.opcoes.alvo && !f.peca) || mesmoAlvo(f.opcoes.alvo, f.peca?.alvo));
const materialDa = (categoria) => (opcoesValem(categoria) ? f.opcoes.materiais?.find((m) => m.id === f.moeda[categoria]) ?? null : null);

// ---------------------------------------------------------------- escolhas
function escolherMoeda(id) {
  const meta = itens()[id];
  if (!meta?.moedaPoe) return;
  f.categoria = meta.moedaPoe.categoria ?? 'atributos';
  f.moeda[f.categoria] = id;
  if (!meta.moedaPoe.repete) f.modo = 'uma';
}
function escolherPeca(x) {
  if (f.exec?.rodando) return;
  f.peca = marca(x);
  if (x.gema) f.categoria = 'gemas';
  // Outra peça: os sockets e os links desejados recomeçam (o máximo é outro); cores e raridade ficam; os mods, só na mesma base.
  const antes = f.desejo;
  f.desejo = { cores: antes.cores, raridade: antes.raridade, atributos: antes.atributos?.base === f.peca.base ? antes.atributos : undefined };
  pedirOpcoes();
  redesenhar();
}
function escolherCategoria(id) {
  if (f.exec?.rodando || f.categoria === id) return;
  f.categoria = id;
  f.configAberta = false;
  const meta = itens()[f.moeda[id]];
  if (meta && !meta.moedaPoe?.repete) f.modo = 'uma';
  pedirOpcoes();
  redesenhar();
}
/** O desejo inicial da categoria para a peça (só o que cabe nela). */
function desejoInicial(categoria, x) {
  const s = f.opcoes?.peca?.sockets ?? null;
  if (categoria === 'sockets') return s ? { abertos: Math.min(s.max, Math.max(1, s.abertos + 1)) } : null;
  if (categoria === 'cores') return { R: 0, G: 0, B: 0, W: 0 };
  if (categoria === 'links') return s && s.abertos >= 2 ? { ligados: Math.min(s.abertos, Math.max(2, maiorGrupo(s) + 1)) } : null;
  if (categoria === 'atributos') return { mods: [], modo: 'todos', base: x?.peca?.poe?.base ?? null };
  if (categoria === 'raridade') return { raridades: [] };
  return null;
}
/** O desejo para o servidor (sem os campos só da tela; vazio = sem desejo). */
function desejoParaEnviar(categoria) {
  const d = f.desejo[categoria];
  if (!d) return null;
  if (categoria === 'cores') return CORES.some((c) => Number(d[c]) > 0) ? { R: d.R, G: d.G, B: d.B, W: d.W } : null;
  if (categoria === 'atributos') return d.mods?.length ? { mods: d.mods.map(({ familia, tierMax, minimo }) => ({ familia, tierMax, minimo })), modo: d.modo } : null;
  if (categoria === 'raridade') return d.raridades?.length ? { raridades: d.raridades } : null;
  if (!COM_DESEJO.has(categoria)) return null;
  return d;
}
function mudouDesejo() {
  pedirOpcoes();
  redesenhar();
}

// ---------------------------------------------------------------- o servidor
function pedirOpcoes() {
  clearTimeout(f.timer);
  f.timer = setTimeout(() => {
    if (!ctx) return;
    const x = escolhida();
    ctx.send({ t: 'forjaOpcoes', pedido: ++f.pedido, alvo: x?.alvo ?? null, categoria: f.categoria, moeda: f.moeda[f.categoria] ?? null, desejo: desejoParaEnviar(f.categoria), reiniciar: f.reiniciar });
  }, 120);
}
/** A resposta das opções (só a do último pedido vale). */
export function chegouForjaOpcoes(m) {
  if (!m || m.pedido !== f.pedido) return;
  f.opcoes = m;
  // O material da categoria: o escolhido, se ainda está na lista; senão o primeiro que dá para usar.
  const lista = m.materiais ?? [];
  if (!lista.some((x) => x.id === f.moeda[m.categoria])) {
    const usavel = lista.find((x) => x.tem > 0 && !x.motivo) ?? lista.find((x) => x.tem > 0) ?? null;
    if (usavel) {
      f.moeda[m.categoria] = usavel.id;
      if (!usavel.repete) f.modo = 'uma';
      pedirOpcoes(); // a validação e a estimativa são do material: pede de novo com ele
    }
  }
  const x = escolhida();
  if (x && opcoesValem(m.categoria) && f.desejo[m.categoria] == null) f.desejo[m.categoria] = desejoInicial(m.categoria, x);
  redesenhar();
}
const novoId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
function vigiar() {
  clearTimeout(f.vigia);
  f.vigia = setTimeout(() => {
    if (!f.exec?.rodando) return;
    Object.assign(f.exec, { rodando: false, fim: true, motivo: 'semResposta', mensagem: 'O servidor não respondeu. Nada mais foi pedido; confira a peça antes de tentar de novo.' });
    redesenhar();
  }, ESPERA_MS);
}
/** Forjar (`modo: 'uma'` sem desejo: uma tentativa) ou repetir com o modo e o desejo da categoria. */
function iniciar(repetir) {
  if (f.exec?.rodando) return;
  const x = escolhida();
  const moeda = f.moeda[f.categoria];
  if (!moeda) return;
  const modo = repetir ? f.modo : 'uma';
  const desejo = repetir && f.opcoes?.validacao?.ok ? desejoParaEnviar(f.categoria) : null;
  const id = novoId();
  f.exec = { id, passo: 0, rodando: true, cancelando: false, feitas: 0, total: modo === 'limite' ? f.limite : modo === 'uma' ? 1 : null, gastos: [], historico: [], ultimo: null, fim: false, motivo: null, mensagem: null, modo };
  ctx.send({ t: 'forjaRepetir', id, passo: 0, moeda, alvo: x?.alvo ?? null, categoria: f.categoria, desejo, modo, limite: f.limite, reiniciar: repetir && f.reiniciar });
  vigiar();
  redesenhar();
}
/** O resultado de um lote: mostra e, sem parada, pede o próximo (um por vez — o servidor só anda com o passo seguinte). */
export function chegouForjaResultado(m) {
  const ex = f.exec;
  if (!m || !ex || m.id !== ex.id || m.duplicada) return;
  if (!ex.rodando && m.motivo === 'encerrada') return;
  Object.assign(ex, { feitas: m.feitas ?? ex.feitas, gastos: m.gastos ?? ex.gastos, historico: m.historico ?? ex.historico, ultimo: m.ultimo ?? ex.ultimo });
  if (m.total != null) ex.total = m.total;
  // A peça pode ter mudado de lugar na mochila: o servidor diz onde ela está.
  if (m.alvo && f.peca) f.peca.alvo = m.alvo;
  if (m.fim) {
    clearTimeout(f.vigia);
    Object.assign(ex, { rodando: false, fim: true, motivo: m.motivo, mensagem: m.mensagem, atingiu: !!m.atingiu });
    pedirOpcoes();
  } else if (!ex.cancelando) {
    ex.passo += 1;
    ctx.send({ t: 'forjaRepetir', id: ex.id, passo: ex.passo });
    vigiar();
  }
  redesenhar();
}
function cancelar() {
  if (!f.exec?.rodando) return;
  f.exec.cancelando = true;
  ctx.send({ t: 'forjaCancelar', id: f.exec.id });
  vigiar();
  redesenhar();
}

// ---------------------------------------------------------------- o desenho
function desenhar(body) {
  const x = escolhida();
  if (x && opcoesValem() && f.desejo[f.categoria] == null) f.desejo[f.categoria] = desejoInicial(f.categoria, x);
  body.replaceChildren();
  // O cabeçalho: a bigorna ao lado do título e a ajuda ao lado do X.
  const selo = ctx.seloDoModal?.();
  if (selo) {
    const img = el('img', 'fp-bigorna');
    img.src = '/client/assets/icons/forja.png';
    img.alt = '';
    selo.append(img);
  }
  const acoes = ctx.acoesDoModal?.();
  if (acoes) {
    const ajuda = botao(`fp-ajuda-botao${f.ajuda ? ' ativo' : ''}`, '?', () => {
      f.ajuda = !f.ajuda;
      redesenhar();
    }, 'Ajuda: como funciona a operação escolhida');
    ajuda.setAttribute('aria-label', 'Ajuda da Forja');
    acoes.append(ajuda);
  }
  const raiz = el('div', `fp${f.exec?.rodando ? ' fp-rodando' : ''}`);
  raiz.append(trilho(), centro(x), inventario(x));
  body.append(raiz);
}

/**
 * As categorias em grupos (Encaixes, Modificadores, Outros), só texto — o nome, o que mexe e quanto material o personagem tem (dono, 12/10:
 * "tire essas imgs, pode confundir").
 */
function trilho() {
  const nav = el('nav', 'fp-trilho');
  const porCategoria = {};
  for (const [id, n] of moedasNaMochila()) {
    const c = itens()[id]?.moedaPoe?.categoria;
    if (c) porCategoria[c] = (porCategoria[c] ?? 0) + n;
  }
  for (const g of GRUPOS) {
    const grupo = el('div', 'fp-grupo');
    grupo.append(el('h5', 'fp-grupo-nome', g.nome));
    for (const c of g.categorias) {
      const b = botao(`fp-cat${f.categoria === c.id ? ' ativa' : ''}${c.id === 'semEfeito' ? ' apagada' : ''}`, null, () => escolherCategoria(c.id), c.resumo);
      b.disabled = !!f.exec?.rodando && f.categoria !== c.id;
      const t = el('span', 'fp-cat-texto');
      t.append(el('b', null, c.nome), el('i', null, c.resumo));
      const n = porCategoria[c.id] ?? 0;
      b.append(t, el('span', `fp-cat-conta${n ? '' : ' zero'}`, n > 9999 ? '9k+' : String(n)));
      b.setAttribute('aria-label', `${c.nome}: ${n} material${n === 1 ? '' : 'is'}`);
      grupo.append(b);
    }
    nav.append(grupo);
  }
  return nav;
}

/** O meio: a peça, a operação da categoria, a barra de materiais, a repetição e os botões. */
function centro(x) {
  const sec = el('section', 'fp-centro');
  if (f.ajuda) sec.append(painelDeAjuda());
  sec.append(cartaoDaPeca(x));
  const op = el('div', 'fp-op');
  op.append(el('h4', 'fp-titulo', cadastroDa(f.categoria)?.nome ?? ''));
  const precisaDePeca = !SEM_PECA.has(f.categoria) && !['gemas', 'especiais'].includes(f.categoria);
  if (!x && precisaDePeca) op.append(el('p', 'fp-vazio', 'Escolha uma peça no inventário, à direita.'));
  else if (!opcoesValem()) op.append(el('p', 'fp-vazio', 'Carregando…'));
  else {
    const corpo = { sockets: opSockets, cores: opCores, links: opLinks, atributos: opAtributos, raridade: opRaridade }[f.categoria] ?? opGeral;
    corpo(op, x);
  }
  sec.append(op, barraDeMateriais(), painelDaRepeticao(), rodape(x));
  return sec;
}

function painelDeAjuda() {
  const caixa = el('div', 'fp-ajuda');
  caixa.append(el('b', null, `Como funciona — ${cadastroDa(f.categoria)?.nome}`), el('p', null, AJUDA[f.categoria]));
  const meta = itens()[f.moeda[f.categoria]];
  if (meta) caixa.append(el('p', null, `${meta.name}: ${meta.descricao ?? ''}`));
  caixa.append(el('p', 'fp-nota', 'Cada tentativa gasta 1 material, e só quando a peça muda (a moeda que não vale na peça volta sem ser gasta). Quem sorteia e grava é o servidor; a repetição anda em lotes e para ao chegar no resultado, no limite, sem material, quando a peça não aceita mais ou quando você cancela.'));
  return caixa;
}

/** A peça escolhida: o desenho, o nome na cor da raridade, o tipo, o item level e os modificadores. */
function cartaoDaPeca(x) {
  const card = el('div', 'fp-peca');
  if (!x) {
    card.classList.add('vazia');
    card.append(el('div', 'fp-peca-moldura'), el('p', 'fp-vazio', SEM_PECA.has(f.categoria) ? 'Esta categoria não precisa de peça.' : f.categoria === 'gemas' ? 'Escolha a gema no inventário, à direita (Inventário → Gemas).' : 'Nenhuma peça escolhida.'));
    return card;
  }
  const meta = itens()[x.peca.id];
  const moldura = el('div', 'fp-peca-moldura cell');
  vestirRaridade(moldura, meta, x.peca.raridade ?? null, x.peca.poe ?? null);
  moldura.append(itemCanvas(x.peca.id, 56));
  tipFor(moldura, x.peca.id, null, null, x.peca);
  const info = el('div', 'fp-peca-info');
  const poe = x.peca.poe;
  const nome = el('b', 'fp-peca-nome', poe?.nome ?? meta?.gemaDef?.nome ?? meta?.name ?? 'peça');
  if (poe?.cor) nome.style.color = poe.cor;
  info.append(nome);
  const linha = [poe?.raridadeNome, meta?.name && poe?.nome !== meta.name ? meta.name : null, poe?.ilvl ? `Item Level ${poe.ilvl}` : x.gema ? `Nível ${x.peca.gema?.nivel ?? 1}` : null,
    poe?.qualidade ? `Qualidade ${poe.qualidade}%` : x.peca.gema?.qualidade ? `Qualidade ${x.peca.gema.qualidade}%` : null, x.onde === 'mochila' ? 'na mochila' : `vestida · ${x.onde}`].filter(Boolean);
  info.append(el('em', 'fp-peca-tipo', linha.join(' · ')));
  const marcas = el('div', 'fp-marcas');
  if (poe?.corrompido) marcas.append(el('span', 'fp-marca corrompida', 'Corrompida'));
  if (poe?.espelhado) marcas.append(el('span', 'fp-marca espelhada', 'Espelhada'));
  if (x.peca.soquetes?.gemas?.some(Boolean)) marcas.append(el('span', 'fp-marca', 'Com gemas'));
  if (marcas.childNodes.length) info.append(marcas);
  if (poe) info.append(listaDeMods(poe));
  card.append(moldura, info);
  return card;
}
/** Os modificadores da peça (implícitos, prefixos, sufixos e os do único), com o tier e o que o desejo pede marcado. */
function listaDeMods(poe) {
  const lista = el('ul', 'fp-mods');
  const pedidos = new Set((f.categoria === 'atributos' ? f.desejo.atributos?.mods ?? [] : []).map((d) => d.familia));
  const linha = (classe, texto, m = null, lado = null) => {
    const li = el('li', classe);
    if (lado) li.append(el('i', 'fp-lado', lado));
    li.append(el('span', null, texto));
    if (m?.tier) li.append(el('i', 'fp-tier', `T${m.tier}`));
    if (m?.talhado) li.append(el('i', 'fp-tier talhado', 'talhado'));
    if (m && pedidos.has(m.familia)) li.classList.add('pedido');
    lista.append(li);
  };
  for (const i of poe.implicitos ?? []) linha('impl', i.texto);
  for (const m of poe.prefixos ?? []) linha('pre', m.texto, m, 'P');
  for (const m of poe.sufixos ?? []) linha('suf', m.texto, m, 'S');
  for (const m of poe.modificadores ?? []) linha('uni', m.texto);
  if (!lista.childNodes.length) lista.append(el('li', 'fp-vazio', 'Sem modificadores.'));
  return lista;
}

// ---- os sockets desenhados (as mesmas cores do Gem Atelier: `.soquete-casa.cor-*`)
/** A fileira de sockets: `s` = `{ max, abertos, links, cores }`; `pedidos` = quantos o desejo pede (os que faltam ficam pontilhados). */
function fileira(s, { pedidos = null } = {}) {
  const fila = el('div', 'fp-fila');
  const max = s?.max ?? 0;
  const grupos = gruposLigados({ abertos: s?.abertos ?? 0, links: s?.links ?? [] });
  for (let i = 0; i < max; i++) {
    const aberto = i < (s.abertos ?? 0);
    const cor = aberto ? s.cores?.[i] : null;
    const nGrupo = grupos.findIndex((g) => g.includes(i));
    const casa = el('span', `soquete-casa fp-sq${cor ? ` cor-${cor}` : ''}${aberto ? '' : ' trancado'}${!aberto && pedidos != null && i < pedidos ? ' pedido' : ''}${nGrupo >= 0 && grupos[nGrupo].length > 1 ? ` grupo grupo-${nGrupo % 4}` : ''}`);
    tipTexto(casa, aberto ? `Socket ${i + 1}: ${cor ? `${NOME_DA_COR[cor]} (${DICA_DA_COR[cor]})` : 'aberto'}` : pedidos != null && i < pedidos ? `Socket ${i + 1}: o desejo pede este` : `Socket ${i + 1}: ainda não aberto`);
    fila.append(casa);
    if (i < max - 1) {
      const ligado = i + 1 < (s.abertos ?? 0) && !!s.links?.[i];
      fila.append(el('span', `soquete-elo fp-elo${ligado ? ' ligado' : ''}${nGrupo >= 0 && grupos[nGrupo].length > 1 && ligado ? ` grupo-${nGrupo % 4}` : ''}`, ligado ? '━' : '·'));
    }
  }
  return fila;
}
/** Uma bolinha de cor (a legenda e o desejo). */
const bolinha = (cor, classe = '') => el('span', `soquete-casa fp-sq mini${cor ? ` cor-${cor}` : ''} ${classe}`.trim());

/** Atual × desejado, lado a lado. */
function comparacao(atual, desejado, atingido) {
  const g = el('div', 'fp-comparar');
  const a = el('div', 'fp-lado-a');
  a.append(el('h5', null, 'Atual'), atual);
  const seta = el('div', `fp-seta${atingido ? ' ok' : ''}`, atingido ? '✔' : '➜');
  const d = el('div', 'fp-lado-d');
  d.append(el('h5', null, 'Desejado'), desejado);
  g.append(a, seta, d);
  return g;
}
const atingidoAgora = (categoria, x) => {
  const d = desejoParaEnviar(categoria);
  return !!d && atingiu(categoria, d, { s: f.opcoes?.peca?.sockets ?? x?.peca?.soquetes ?? null, p: x?.peca?.poe ?? null });
};
/** Um seletor de número (− valor +). */
function seletor(valor, min, max, aoMudar, rotulo) {
  const caixa = el('div', 'fp-seletor');
  const menos = botao('fp-passo', '−', () => aoMudar(Math.max(min, valor - 1)));
  const mais = botao('fp-passo', '+', () => aoMudar(Math.min(max, valor + 1)));
  menos.disabled = valor <= min || !!f.exec?.rodando;
  mais.disabled = valor >= max || !!f.exec?.rodando;
  menos.setAttribute('aria-label', `Menos ${rotulo}`);
  mais.setAttribute('aria-label', `Mais ${rotulo}`);
  caixa.append(menos, el('b', 'fp-numero', String(valor)), mais);
  return caixa;
}
/** O texto do porquê a operação não dá (sem sockets, inalterável) ou null. */
function semSockets(op) {
  const s = f.opcoes?.peca?.sockets;
  if (!s) {
    op.append(el('p', 'fp-aviso', 'Esta peça não tem sockets (anéis, amuletos, cintos e frascos não têm; algumas bases são fixas).'));
    return true;
  }
  if (s.inalteravel) {
    op.append(el('p', 'fp-aviso', 'Os sockets desta peça não podem ser modificados (um modificador do único).'));
    return true;
  }
  return false;
}

function opSockets(op, x) {
  if (semSockets(op)) return;
  const s = f.opcoes.peca.sockets;
  const d = f.desejo.sockets ?? desejoInicial('sockets', x);
  f.desejo.sockets = d;
  const desejado = el('div');
  desejado.append(fileira({ ...s, abertos: Math.min(s.abertos, d.abertos) }, { pedidos: d.abertos }));
  if (f.configAberta) desejado.append(seletor(d.abertos, 1, s.max, (n) => {
    f.desejo.sockets = { abertos: n };
    mudouDesejo();
  }, 'sockets'));
  else desejado.append(el('p', 'fp-legenda', `Pelo menos ${d.abertos} socket${d.abertos === 1 ? '' : 's'}`));
  op.append(comparacao(fileira(s), desejado, atingidoAgora('sockets', x)));
  op.append(el('p', 'fp-legenda', `Agora: ${s.abertos} de ${s.max} (o máximo desta peça, pela classe e pelo item level).${s.comGema ? ' Tem gemas: o Joalheiro e o Cromático pedem a peça sem gemas.' : ''}`));
}

function opCores(op, x) {
  if (semSockets(op)) return;
  const s = f.opcoes.peca.sockets;
  const d = f.desejo.cores ?? desejoInicial('cores', x);
  f.desejo.cores = d;
  const material = materialDa('cores');
  const comBranco = material?.slug === 'Tainted_Chromatic_Orb';
  const soma = CORES.reduce((t, c) => t + (Number(d[c]) || 0), 0);
  const desejado = el('div');
  const fila = el('div', 'fp-fila');
  for (const c of CORES) for (let i = 0; i < (Number(d[c]) || 0); i++) fila.append(bolinha(c));
  for (let i = soma; i < s.abertos; i++) fila.append(bolinha(null, 'qualquer'));
  desejado.append(fila);
  if (f.configAberta) {
    const grade = el('div', 'fp-cores');
    for (const c of CORES) {
      if (c === 'W' && !comBranco) continue;
      const linha = el('div', 'fp-cor');
      linha.append(bolinha(c), el('span', null, NOME_DA_COR[c]));
      // Nada de configuração impossível: a soma das cores não passa dos sockets abertos.
      linha.append(seletor(Number(d[c]) || 0, 0, (Number(d[c]) || 0) + (s.abertos - soma), (n) => {
        f.desejo.cores = { ...d, [c]: n };
        mudouDesejo();
      }, NOME_DA_COR[c].toLowerCase()));
      grade.append(linha);
    }
    desejado.append(grade);
  } else desejado.append(el('p', 'fp-legenda', soma ? CORES.filter((c) => d[c] > 0).map((c) => `${d[c]} ${NOME_DA_COR[c].toLowerCase()}`).join(' + ') + ' (em qualquer ordem)' : 'Nenhuma cor pedida: use "Configurar resultado".'));
  op.append(comparacao(fileira({ ...s, max: s.abertos }), desejado, atingidoAgora('cores', x)));
  const legenda = el('div', 'fp-legenda-cores');
  const n = contarCores(s);
  for (const c of CORES) {
    const item = el('span', null);
    item.append(bolinha(c), document.createTextNode(` ${NOME_DA_COR[c]} — ${DICA_DA_COR[c]} (${n[c]})`));
    legenda.append(item);
  }
  op.append(legenda);
  if (s.abertos < 1) op.append(el('p', 'fp-aviso', 'A peça não tem sockets abertos: abra com o Joalheiro (categoria Sockets).'));
}

function opLinks(op, x) {
  if (semSockets(op)) return;
  const s = f.opcoes.peca.sockets;
  if (s.abertos < 2) {
    op.append(fileira(s), el('p', 'fp-aviso', 'Precisa de pelo menos 2 sockets abertos para ligar (categoria Sockets).'));
    return;
  }
  const d = f.desejo.links ?? desejoInicial('links', x);
  f.desejo.links = d;
  const desejado = el('div');
  // O desenho do desejo: um grupo de N ligados (a posição não importa).
  desejado.append(fileira({ ...s, max: s.abertos, cores: [], links: Array.from({ length: Math.max(0, s.abertos - 1) }, (_, i) => i + 1 < d.ligados) }));
  if (f.configAberta) desejado.append(seletor(d.ligados, 2, s.abertos, (n) => {
    f.desejo.links = { ligados: n };
    mudouDesejo();
  }, 'sockets ligados'));
  else desejado.append(el('p', 'fp-legenda', `Um grupo de ${d.ligados} ligados, em qualquer posição`));
  op.append(comparacao(fileira({ ...s, max: s.abertos }), desejado, atingidoAgora('links', x)));
  const grupos = gruposLigados(s).map((g) => g.map((i) => i + 1).join('+')).join(' | ');
  op.append(el('p', 'fp-legenda', `Grupos agora: ${grupos} (maior: ${maiorGrupo(s)}). Só sockets vizinhos se ligam, e só os abertos.`));
}

function opAtributos(op, x) {
  if (!x?.peca?.poe) return void op.append(el('p', 'fp-aviso', 'Escolha uma peça do PoE.'));
  const material = materialDa('atributos');
  const d = f.desejo.atributos ?? desejoInicial('atributos', x);
  f.desejo.atributos = d;
  const familias = f.opcoes.familias ?? [];
  const porFamilia = new Map(familias.map((fa) => [fa.familia, fa]));
  const desejado = el('div', 'fp-desejo-mods');
  if (!d.mods.length) desejado.append(el('p', 'fp-legenda', 'Nenhum modificador pedido.'));
  for (const [k, m] of d.mods.entries()) {
    const fa = porFamilia.get(m.familia);
    const linha = el('div', 'fp-mod-pedido');
    linha.append(el('i', 'fp-lado', fa?.lado === 'prefixo' ? 'P' : 'S'), el('span', null, fa?.texto ?? m.familia));
    if (f.configAberta && fa) {
      const tier = el('select', 'fp-select');
      tier.append(new Option('qualquer tier', ''));
      for (const t of fa.tiers) tier.append(new Option(`T${t.tier} ou melhor (iLvl ${t.ilvl})`, String(t.tier)));
      tier.value = m.tierMax != null ? String(m.tierMax) : '';
      tier.onchange = () => {
        d.mods[k] = { ...m, tierMax: tier.value ? Number(tier.value) : undefined };
        mudouDesejo();
      };
      linha.append(tier);
      if (fa.tiers.every((t) => t.umValor)) {
        const min = el('input', 'fp-min');
        min.type = 'number';
        min.placeholder = 'mín.';
        min.value = m.minimo ?? '';
        min.title = `Valor mínimo (até ${Math.max(...fa.tiers.map((t) => t.max))} nesta peça)`;
        min.onchange = () => {
          d.mods[k] = { ...m, minimo: min.value === '' ? undefined : Number(min.value) };
          mudouDesejo();
        };
        linha.append(min);
      }
      linha.append(botao('fp-tirar', '×', () => {
        d.mods.splice(k, 1);
        mudouDesejo();
      }, 'Tirar do desejo'));
    } else {
      const partes = [m.tierMax ? `T${m.tierMax} ou melhor` : null, m.minimo != null ? `mín. ${m.minimo}` : null].filter(Boolean);
      if (partes.length) linha.append(el('i', 'fp-tier', partes.join(' · ')));
    }
    desejado.append(linha);
  }
  if (f.configAberta) {
    const modo = el('div', 'fp-segmento');
    for (const [id, rotulo] of [['todos', 'Todos'], ['algum', 'Qualquer um']]) {
      const b = botao(d.modo === id ? 'ativo' : '', rotulo, () => {
        d.modo = id;
        mudouDesejo();
      });
      modo.append(b);
    }
    desejado.append(modo, escolhaDeMods(familias, d));
  }
  op.append(comparacao(el('p', 'fp-legenda', `${(x.peca.poe.prefixos ?? []).length} prefixo(s), ${(x.peca.poe.sufixos ?? []).length} sufixo(s) — a lista está acima.`), desejado, atingidoAgora('atributos', x)));
  if (material && !material.repete) op.append(el('p', 'fp-legenda', `${material.nome}: uma tentativa por vez (soma, tira ou muda a peça — não sorteia de novo).`));
}
/** A lista dos modificadores que a peça pode ter (a base e o item level dela), filtrada por tipo (tag) e lado. */
function escolhaDeMods(familias, d) {
  const caixa = el('div', 'fp-escolha-mods');
  const filtros = el('div', 'fp-filtros-mod');
  const tags = [...new Set(familias.flatMap((fa) => fa.tags))].sort((a, b) => a.localeCompare(b));
  const tag = el('select', 'fp-select');
  tag.append(new Option('todos os tipos', ''));
  for (const t of tags) tag.append(new Option(t, t));
  tag.value = f.filtroMod.tag;
  tag.onchange = () => {
    f.filtroMod.tag = tag.value;
    redesenhar();
  };
  const lado = el('select', 'fp-select');
  for (const [v, r] of [['', 'prefixos e sufixos'], ['prefixo', 'prefixos'], ['sufixo', 'sufixos']]) lado.append(new Option(r, v));
  lado.value = f.filtroMod.lado;
  lado.onchange = () => {
    f.filtroMod.lado = lado.value;
    redesenhar();
  };
  filtros.append(tag, lado);
  const lista = el('div', 'fp-lista-mods');
  const ja = new Set(d.mods.map((m) => m.familia));
  for (const fa of familias) {
    if (ja.has(fa.familia)) continue;
    if (f.filtroMod.tag && !fa.tags.includes(f.filtroMod.tag)) continue;
    if (f.filtroMod.lado && fa.lado !== f.filtroMod.lado) continue;
    const b = botao('fp-mod-opcao', null, () => {
      if (d.mods.length >= 6) return;
      d.mods.push({ familia: fa.familia });
      mudouDesejo();
    }, `${fa.lado === 'prefixo' ? 'Prefixo' : 'Sufixo'} · tiers T${fa.tiers.at(-1).tier}–T${fa.tiers[0].tier} nesta peça${fa.tags.length ? ` · ${fa.tags.join(', ')}` : ''}`);
    b.append(el('i', 'fp-lado', fa.lado === 'prefixo' ? 'P' : 'S'), el('span', null, fa.texto), el('i', 'fp-tier', `até T${fa.tiers[0].tier}`));
    lista.append(b);
  }
  if (!lista.childNodes.length) lista.append(el('p', 'fp-legenda', familias.length ? 'Nenhum modificador com este filtro.' : 'A base desta peça não tem modificadores para sortear.'));
  caixa.append(filtros, lista);
  return caixa;
}

function opRaridade(op, x) {
  if (!x?.peca?.poe) return void op.append(el('p', 'fp-aviso', 'Escolha uma peça do PoE.'));
  const raridades = f.opcoes.raridades ?? [];
  const nomeDa = (id) => raridades.find((r) => r.id === id) ?? { nome: id, cor: null };
  const chip = (id, extra = '') => {
    const r = nomeDa(id);
    const c = el('span', `fp-chip ${extra}`.trim(), r.nome);
    if (r.cor) c.style.setProperty('--cor-chip', r.cor);
    return c;
  };
  const d = f.desejo.raridade ?? desejoInicial('raridade', x);
  f.desejo.raridade = d;
  const material = materialDa('raridade');
  const trans = (f.opcoes.transicoes ?? []).find((t) => t.id === material?.id);
  const desejado = el('div');
  if (f.configAberta) {
    const grade = el('div', 'fp-chips');
    for (const r of raridades) {
      const pode = trans?.para?.includes(r.id);
      const b = botao(`fp-chip${d.raridades.includes(r.id) ? ' ativo' : ''}${pode ? '' : ' fora'}`, r.nome, () => {
        d.raridades = d.raridades.includes(r.id) ? d.raridades.filter((y) => y !== r.id) : [...d.raridades, r.id];
        mudouDesejo();
      }, pode ? `${material?.nome} pode deixar a peça ${r.nome}` : `${material?.nome ?? 'Este material'} não deixa a peça ${r.nome}`);
      if (r.cor) b.style.setProperty('--cor-chip', r.cor);
      grade.append(b);
    }
    desejado.append(grade);
  } else {
    const fila = el('div', 'fp-chips');
    for (const r of d.raridades) fila.append(chip(r, 'ativo'));
    if (!d.raridades.length) fila.append(el('span', 'fp-legenda', 'Nenhuma raridade pedida.'));
    desejado.append(fila);
  }
  op.append(comparacao(chip(x.peca.poe.raridade, 'ativo'), desejado, atingidoAgora('raridade', x)));
  // O que cada material faz NESTA peça (a regra de cada moeda; o sorteio da Chance não é garantido).
  const tabela = el('ul', 'fp-transicoes');
  for (const t of f.opcoes.transicoes ?? []) {
    const m = f.opcoes.materiais.find((y) => y.id === t.id);
    const li = el('li', t.erro ? 'fora' : '');
    li.append(itemCanvas(t.id, 20), el('b', null, m?.nome ?? t.slug));
    if (t.erro) li.append(el('em', null, t.erro));
    else {
      const seta = el('span', 'fp-trans');
      seta.append(chip(x.peca.poe.raridade), document.createTextNode(' → '));
      t.para.forEach((r, i) => {
        if (i) seta.append(document.createTextNode(' / '));
        seta.append(chip(r));
      });
      li.append(seta, el('em', null, t.para.length > 1 ? 'sorteado' : 'garantido'));
    }
    tabela.append(li);
  }
  op.append(tabela);
  if (material?.slug === 'Orb_of_Chance') {
    const lbl = el('label', 'fp-check');
    const cb = el('input');
    cb.type = 'checkbox';
    cb.checked = f.reiniciar;
    cb.disabled = !!f.exec?.rodando;
    cb.onchange = () => {
      f.reiniciar = cb.checked;
      mudouDesejo();
    };
    const exp = moedasNaMochila().get(idDoSlug('Orb_of_Scouring')) ?? 0;
    lbl.append(cb, document.createTextNode(` Na repetição, voltar a peça a Normal com o Orbe do Expurgo entre as tentativas (você tem ${exp})`));
    op.append(lbl);
  }
}

/** O que a peça tem de relevante para a categoria (o lado "Na peça" das categorias sem resultado desejado). */
function naPeca(x) {
  const lista = el('ul', 'fp-na-peca');
  const linha = (rotulo, valor, classe = '') => {
    const li = el('li', classe);
    li.append(el('span', null, rotulo), el('b', null, valor));
    lista.append(li);
  };
  const p = x?.peca?.poe;
  if (f.categoria === 'gemas') {
    if (!x?.gema) return el('p', 'fp-legenda', 'Nenhuma gema escolhida.');
    linha('Nível', String(x.peca.gema?.nivel ?? 1));
    linha('Qualidade', `${x.peca.gema?.qualidade ?? 0}% de 20%`);
    return lista;
  }
  if (!p) return el('p', 'fp-legenda', SEM_PECA.has(f.categoria) || f.categoria === 'especiais' ? 'Não precisa de peça.' : 'Nenhuma peça escolhida.');
  if (f.categoria === 'implicitos') {
    for (const i of p.implicitos ?? []) linha('Implícito', i.texto, 'impl');
    if (!(p.implicitos ?? []).length) linha('Implícitos', 'nenhum');
    const defesa = { armadura: 'Armadura', evasao: 'Evasão', escudo_energia: 'Escudo de Energia' };
    for (const [k, nome] of Object.entries(defesa)) if (typeof p.atributos?.[k] === 'number') linha(`${nome} da base`, String(p.atributos[k]));
  } else if (f.categoria === 'influencia') {
    const NOMES = { shaper: 'Criador', elder: 'Ancião', crusader: 'Cruzado', redeemer: 'Juiz', hunter: 'Caçador', warlord: 'Senhor da Guerra' };
    linha('Influência', (p.influencias ?? []).map((i) => NOMES[i] ?? i).join(', ') || 'nenhuma');
    linha('Mods influenciados', String([...(p.prefixos ?? []), ...(p.sufixos ?? [])].filter((m) => m.influencia).length));
    linha('Raridade', p.raridadeNome ?? p.raridade);
  } else if (f.categoria === 'ancestral') {
    const ELDRITCH = { searing: 'Exarca Abrasador', eater: 'Devorador de Mundos' };
    const eld = (p.implicitos ?? []).filter((i) => ELDRITCH[i.origem]);
    for (const i of eld) linha(ELDRITCH[i.origem], i.texto, 'impl');
    if (!eld.length) linha('Implícitos Eldritch', 'nenhum');
  } else if (f.categoria === 'qualidade') {
    linha('Qualidade', `${p.qualidade ?? 0}% de 20%`);
    linha('Raridade', p.raridadeNome ?? p.raridade);
  } else if (f.categoria === 'corrupcao') {
    linha('Corrompida', p.corrompido ? 'sim' : 'não', p.corrompido ? 'corrompida' : '');
    linha('Raridade', p.raridadeNome ?? p.raridade);
  } else if (f.categoria === 'especiais') {
    linha('Raridade', p.raridadeNome ?? p.raridade);
    linha('Espelhada', p.espelhado ? 'sim' : 'não');
  }
  return lista;
}
/** As categorias sem resultado desejado: o que a peça tem × o que o material faz (e, sem sorteio, o resultado exato). */
function opGeral(op, x) {
  const material = materialDa(f.categoria);
  const meta = itens()[material?.id];
  if (f.categoria === 'semEfeito') {
    const lista = el('ul', 'fp-sem-efeito');
    for (const m of f.opcoes.materiais ?? []) {
      const li = el('li');
      li.append(el('b', null, `${m.nome} (${m.tem})`), el('span', null, String(m.motivo ?? '').replace(/^Sem efeito no jogo: /, '')));
      lista.append(li);
    }
    op.append(lista.childNodes.length ? lista : el('p', 'fp-legenda', 'Você não tem nenhuma moeda sem efeito.'));
    return;
  }
  const faz = el('div');
  if (!meta) faz.append(el('p', 'fp-legenda', 'Escolha um material na barra abaixo.'));
  else {
    faz.append(el('p', 'fp-legenda', meta.descricao ?? ''));
    if (material.previa) faz.append(el('p', 'fp-resultado', `Resultado: ${material.previa}`));
    if (material.slug === 'Tainted_Mythic_Orb') faz.append(el('p', 'fp-aviso', 'Atenção: o Orbe Mítico Corroído pode DESTRUIR a peça.'));
    if (['Vaal_Orb', 'Volatile_Vaal_Orb', 'Djinn-Touched_Vaal_Orb'].includes(material.slug)) faz.append(el('p', 'fp-aviso', 'A corrupção é permanente: depois só as moedas Corroídas valem nesta peça.'));
  }
  const d = el('div', 'fp-lado-d');
  d.append(el('h5', null, 'O material faz'), faz);
  // (as lascas não mexem em peça: só o que o material faz)
  if (SEM_PECA.has(f.categoria)) return void op.append(d);
  const g = el('div', 'fp-comparar');
  const a = el('div', 'fp-lado-a');
  a.append(el('h5', null, f.categoria === 'gemas' ? 'Na gema' : 'Na peça'), naPeca(x));
  g.append(a, el('div', 'fp-seta', '➜'), d);
  op.append(g);
}

/** A barra de materiais da categoria: o ícone, o nome, quanto tem, se vale nesta peça; o escolhido é o que a forja gasta. */
function barraDeMateriais() {
  const caixa = el('div', 'fp-materiais');
  caixa.append(el('h4', 'fp-titulo', 'Material'));
  const lista = opcoesValem() ? f.opcoes.materiais ?? [] : [];
  const barra = el('div', 'fp-barra');
  if (!lista.length) barra.append(el('p', 'fp-vazio', opcoesValem() ? 'Nenhum material desta categoria. As moedas caem dos monstros, e as básicas a Zuma vende.' : 'Carregando…'));
  for (const m of lista) {
    const meta = itens()[m.id];
    const b = el('button', `forja-poe-moeda fp-mat st-${m.status}${f.moeda[f.categoria] === m.id ? ' escolhida' : ''}${m.tem < 1 ? ' falta' : ''}${m.motivo ? ' nao-vale' : ''}`);
    b.type = 'button';
    b.disabled = !!f.exec?.rodando;
    b.append(itemCanvas(m.id, 32), el('i', 'forja-poe-conta', String(m.tem)));
    tipFor(b, m.id, m.motivo ? `Nesta peça: ${m.motivo}` : m.repete ? 'Repete: sorteia de novo a cada tentativa.' : 'Uma tentativa por vez.');
    b.setAttribute('aria-label', `${meta?.name ?? m.nome}: ${m.tem}`);
    b.onclick = () => {
      f.moeda[f.categoria] = m.id;
      if (!m.repete) f.modo = 'uma';
      mudouDesejo();
    };
    barra.append(b);
  }
  caixa.append(barra);
  const escolhido = lista.find((m) => m.id === f.moeda[f.categoria]);
  if (escolhido) {
    const info = el('div', 'fp-mat-info');
    info.append(el('b', null, escolhido.nome), el('span', null, escolhido.status === 'nao' ? `Você tem ${escolhido.tem} · sem efeito no jogo` : `Você tem ${escolhido.tem} · custo: 1 por tentativa${escolhido.repete ? ' · repete' : ' · uma tentativa por vez'}`));
    if (escolhido.motivo) info.append(el('em', 'fp-erro', escolhido.motivo));
    else if (escolhido.status === 'parcial') info.append(el('em', 'fp-legenda', `Funciona em parte: ${notaParcial(escolhido.id)}`));
    caixa.append(info);
  }
  return caixa;
}
const notaParcial = (id) => String(itens()[id]?.descricao ?? '').split(' — no jogo: ')[1] ?? '';

/** A repetição: os três modos, o limite, a estimativa e o progresso. */
function painelDaRepeticao() {
  const caixa = el('div', 'fp-repeticao');
  const material = materialDa(f.categoria);
  const podeRepetir = !!material?.repete && COM_DESEJO.has(f.categoria);
  const modos = el('div', 'fp-segmento');
  for (const [id, rotulo] of MODOS) {
    const b = botao(f.modo === id ? 'ativo' : '', rotulo, () => {
      f.modo = id;
      redesenhar();
    }, id !== 'uma' && !podeRepetir ? 'Este material é de uma tentativa por vez.' : null);
    b.disabled = !!f.exec?.rodando || (id !== 'uma' && !podeRepetir);
    modos.append(b);
  }
  caixa.append(modos);
  if (f.modo === 'limite' && podeRepetir) {
    const lbl = el('label', 'fp-limite');
    const inp = el('input');
    inp.type = 'number';
    inp.min = '1';
    inp.max = '5000';
    inp.value = String(f.limite);
    inp.disabled = !!f.exec?.rodando;
    inp.onchange = () => {
      f.limite = Math.max(1, Math.min(5000, Math.floor(Number(inp.value)) || 1));
      redesenhar();
    };
    lbl.append(document.createTextNode('No máximo '), inp, document.createTextNode(' tentativas'));
    caixa.append(lbl);
  }
  caixa.append(previa());
  if (f.exec) caixa.append(progresso());
  return caixa;
}
const pct = (p) => {
  if (p == null) return '—';
  if (p >= 0.9999 && p < 1) return '> 99,99%';
  if (p > 0 && p < 0.0001) return `1 em ${Math.round(1 / p).toLocaleString('pt-BR')}`;
  return `${(p * 100).toLocaleString('pt-BR', { maximumFractionDigits: p < 0.01 ? 3 : 2 })}%`;
};
/** A prévia do resultado: a validação do desejo e a estimativa do servidor (só quando a conta é exata pela regra do jogo). */
function previa() {
  const caixa = el('div', 'fp-previa');
  const o = f.opcoes;
  if (!opcoesValem() || !COM_DESEJO.has(f.categoria)) return caixa;
  const material = materialDa(f.categoria);
  if (material && !material.repete) {
    caixa.append(el('p', 'fp-legenda', `${material.nome} é de uma tentativa por vez: use Forjar. O resultado desejado vale nas moedas que sorteiam de novo.`));
    return caixa;
  }
  if (!desejoParaEnviar(f.categoria)) {
    caixa.append(el('p', 'fp-legenda', 'Configure o resultado desejado para repetir até chegar nele.'));
    return caixa;
  }
  if (o.validacao && !o.validacao.ok) {
    caixa.append(el('p', 'fp-erro', o.validacao.erro));
    return caixa;
  }
  const e = o.estimativa;
  if (!e) return caixa;
  if (e.semEstimativa) {
    caixa.append(el('p', 'fp-legenda', `Sem estimativa: ${e.semEstimativa}.`));
    return caixa;
  }
  const nome = materialDa(f.categoria)?.nome ?? 'material';
  const grade = el('dl', 'fp-estimativa');
  const par = (k, v) => grade.append(el('dt', null, k), el('dd', null, v));
  par('Próxima tentativa', pct(e.chance));
  if (e.media != null) par('Média', `~${Math.ceil(e.media).toLocaleString('pt-BR')} tentativa${Math.ceil(e.media) === 1 ? '' : 's'} (${Math.ceil(e.media).toLocaleString('pt-BR')}× ${nome})`);
  if (e.comOQueTem != null) par('Com o que você tem', pct(e.comOQueTem));
  caixa.append(grade, el('p', 'fp-nota', 'Conta exata pela regra do jogo — não é garantia: cada tentativa é um sorteio.'));
  return caixa;
}
function progresso() {
  const ex = f.exec;
  const caixa = el('div', `fp-progresso${ex.rodando ? ' rodando' : ''}`);
  const [classe, rotulo] = ex.rodando ? ['rodando', ex.cancelando ? 'Cancelando…' : 'Forjando…'] : MOTIVO[ex.motivo] ?? ['aviso', ex.motivo ?? ''];
  const topo = el('div', 'fp-prog-topo');
  topo.append(el('span', `fp-estado ${classe}`, rotulo), el('b', null, `${ex.feitas}${ex.total ? ` / ${ex.total}` : ''} tentativa${ex.feitas === 1 ? '' : 's'}`));
  caixa.append(topo);
  if (ex.total) {
    const barra = el('div', 'fp-barra-prog');
    const cheio = el('i');
    cheio.style.width = `${Math.min(100, (ex.feitas / ex.total) * 100)}%`;
    barra.append(cheio);
    caixa.append(barra);
  }
  if (ex.gastos?.length) caixa.append(el('p', 'fp-gastos', `Gasto: ${ex.gastos.map((g) => `${g.n}× ${itens()[g.id]?.name ?? 'moeda'}`).join(', ')}`));
  if (ex.mensagem) caixa.append(el('p', `fp-msg ${classe}`, ex.mensagem));
  if (ex.ultimo) caixa.append(el('p', 'fp-ultimo', `Último resultado: ${ex.ultimo}`));
  if (ex.historico?.length > 1) {
    const det = el('details', 'fp-historico');
    det.append(el('summary', null, `Últimas ${ex.historico.length} tentativas`));
    const ol = el('ol');
    for (const h of [...ex.historico].reverse()) ol.append(el('li', null, h));
    det.append(ol);
    caixa.append(det);
  }
  return caixa;
}

/** Os botões: Configurar resultado, Repetir (ou Cancelar) e Forjar. */
function rodape(x) {
  const pe = el('footer', 'fp-rodape');
  const material = materialDa(f.categoria);
  const meta = itens()[material?.id];
  const alvoDaMoeda = meta?.moedaPoe?.alvo ?? 'peca';
  const temAlvo = alvoDaMoeda === 'nenhum' || (alvoDaMoeda === 'gema' ? !!x?.gema : !!x?.peca?.poe);
  const rodando = !!f.exec?.rodando;
  const config = botao(`fp-botao${f.configAberta ? ' ativo' : ''}`, 'Configurar resultado', () => {
    f.configAberta = !f.configAberta;
    redesenhar();
  }, 'Escolhe o resultado desejado desta categoria (fica guardado enquanto a Forja estiver aberta).');
  config.disabled = rodando || !COM_DESEJO.has(f.categoria) || !x?.peca?.poe;
  pe.append(config);
  if (rodando) {
    const parar = botao('fp-botao fp-cancelar', f.exec.cancelando ? 'Cancelando…' : 'Cancelar', cancelar, 'Para a repetição (o que já foi feito fica).');
    parar.disabled = f.exec.cancelando;
    pe.append(parar);
  } else {
    const podeRepetir = f.modo === 'uma' || !!material?.repete;
    const valido = f.modo === 'uma' ? !desejoParaEnviar(f.categoria) || !!f.opcoes?.validacao?.ok : !!f.opcoes?.validacao?.ok;
    const repetir = botao('fp-botao fp-repetir', 'Repetir', () => iniciar(true), f.modo === 'uma' ? 'Uma tentativa, conferindo o resultado desejado.' : f.modo === 'limite' ? `Até ${f.limite} tentativas ou até chegar no resultado.` : 'Até chegar no resultado (ou acabar o material).');
    repetir.disabled = !material || material.tem < 1 || !!material.motivo || !temAlvo || !COM_DESEJO.has(f.categoria) || !podeRepetir || !valido;
    pe.append(repetir);
  }
  const forjar = botao('fp-botao fp-forjar', 'Forjar', () => iniciar(false), 'Uma tentativa com o material escolhido.');
  forjar.disabled = rodando || !material || material.tem < 1 || !!material.motivo || !temAlvo || material.status === 'nao';
  pe.append(forjar);
  return pe;
}

// ---------------------------------------------------------------- o inventário (o do personagem — sem cópia)
function inventario(x) {
  const aside = el('aside', 'fp-inv');
  const abas = el('div', 'fp-abas');
  for (const [id, rotulo] of ABAS) abas.append(botao(f.abaInv === id ? 'ativa' : '', rotulo, () => {
    f.abaInv = id;
    redesenhar();
  }));
  aside.append(abas);
  const c = ctx.state.character ?? {};
  if (f.abaInv !== 'materiais') {
    const filtros = el('div', 'fp-filtros');
    const lista = pecas().filter((p) => (f.abaInv === 'equipamentos' ? p.alvo.onde === 'equipment' : p.alvo.onde === 'inventory'));
    for (const [id, rotulo] of FILTROS) {
      const n = id === 'todos' ? lista.length : lista.filter((p) => p.tipo === id).length;
      if (id !== 'todos' && !n) continue;
      filtros.append(botao(f.filtro === id ? 'ativo' : '', `${rotulo} ${n}`, () => {
        f.filtro = id;
        redesenhar();
      }));
    }
    aside.append(filtros);
    const grade = el('div', 'fp-grade');
    const vistos = lista.filter((p) => f.filtro === 'todos' || p.tipo === f.filtro);
    for (const p of vistos) grade.append(celulaDaPeca(p, x));
    if (!vistos.length) grade.append(el('p', 'fp-vazio', f.abaInv === 'equipamentos' ? 'Nenhuma peça do PoE vestida.' : 'Nenhuma peça do PoE na mochila.'));
    aside.append(grade);
  } else {
    // As moedas da mochila separadas pela categoria da Forja (a ordem do trilho); clicar escolhe o material e a categoria dele.
    const caixa = el('div', 'fp-grade-grupos');
    const porCategoria = new Map();
    for (const [id, n] of moedasNaMochila()) {
      const cat = itens()[id]?.moedaPoe?.categoria ?? 'semEfeito';
      if (!porCategoria.has(cat)) porCategoria.set(cat, []);
      porCategoria.get(cat).push([id, n]);
    }
    for (const g of GRUPOS) for (const cat of g.categorias) {
      const lista = (porCategoria.get(cat.id) ?? []).sort(([a], [b]) => (itens()[a]?.name ?? '').localeCompare(itens()[b]?.name ?? ''));
      if (!lista.length) continue;
      caixa.append(el('h5', 'fp-grade-titulo', cat.nome));
      const grade = el('div', 'fp-grade');
      for (const [id, n] of lista) {
        const meta = itens()[id];
        const cell = el('button', `cell fp-celula${f.moeda[f.categoria] === id ? ' escolhida' : ''}${meta.moedaPoe.status === 'nao' ? ' sem-efeito' : ''}`);
        cell.type = 'button';
        vestirRaridade(cell, meta);
        cell.disabled = !!f.exec?.rodando;
        cell.append(itemCanvas(id, 32), el('b', null, n > 9999 ? '9k+' : String(n)));
        tipFor(cell, id, `Categoria: ${cat.nome}`);
        cell.onclick = () => {
          escolherMoeda(id);
          f.configAberta = false;
          pedirOpcoes();
          redesenhar();
        };
        grade.append(cell);
      }
      caixa.append(grade);
    }
    if (!porCategoria.size) caixa.append(el('p', 'fp-vazio', 'Nenhuma moeda do PoE na mochila.'));
    aside.append(caixa);
  }
  // A capacidade: as vagas da mochila (a do PoE não tem peso).
  const mochila = c.equipment?.backpack;
  const vagas = itens()[mochila?.id]?.container ?? null;
  const usadas = (c.inventory ?? []).length;
  const cap = el('div', 'fp-capacidade');
  if (vagas) {
    const barra = el('div', 'fp-barra-prog');
    const cheio = el('i');
    cheio.style.width = `${Math.min(100, (usadas / vagas) * 100)}%`;
    barra.append(cheio);
    cap.append(el('span', null, `Mochila ${usadas} / ${vagas}`), barra);
  } else cap.append(el('span', null, `Mochila: ${usadas} ite${usadas === 1 ? 'm' : 'ns'}`));
  aside.append(cap);
  return aside;
}
function celulaDaPeca(p, x) {
  const meta = itens()[p.peca.id];
  const escolhidaAgora = !!x && mesmoAlvo(x.alvo, p.alvo);
  const cell = el('button', `cell fp-celula${escolhidaAgora ? ' escolhida' : ''}`);
  cell.type = 'button';
  cell.disabled = !!f.exec?.rodando && !escolhidaAgora;
  vestirRaridade(cell, meta, p.peca.raridade ?? null, p.peca.poe ?? null);
  cell.append(itemCanvas(p.peca.id, 32));
  if (p.gema) cell.append(el('i', 'selo-gema', String(p.peca.gema?.nivel ?? 1)));
  selarSoquetes(cell, p.peca);
  tipFor(cell, p.peca.id, p.alvo.onde === 'equipment' ? `Vestida: ${p.onde}` : null, null, p.peca);
  cell.onclick = () => escolherPeca(p);
  return cell;
}
