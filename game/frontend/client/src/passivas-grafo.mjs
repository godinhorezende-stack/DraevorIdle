/*
 * ---- (lote 77) A ÁRVORE DO PERSONAGEM na tela: a do jogo + as Ramificadoras encaixadas ----
 *
 * Sem DOM (os testes importam este módulo): o mesmo grafo que o servidor usa (`systems/passivas/arvore.grafoDe`), montado a partir da
 * árvore base (`arvoreParaCliente`, uma vez por sessão) e da vista do personagem (`vista().ramificadoras`: os nós que as joias criam e as
 * conexões de cada encaixe). Os nós da joia SUBSTITUEM os da árvore de mesmo id (o encaixe interno reusa o id da árvore — sem herdar o
 * `soDaRamificadora` dele), o encaixe da borda ganha a entrada da joia e as arestas são refeitas.
 *
 * Como no PoE (o PoB tira da árvore os proxies, os nós dos grupos deles e os encaixes internos — `PassiveSpec:Init`), o que só existe com a
 * joia não aparece sem ela, nem o fundo do grupo do proxy; com a joia, o fundo do TAMANHO dela no centro do grupo do proxy (o PoB:
 * `subGraph.group.oo[tamanho + 1]` — a Média no encaixe Grande leva o fundo médio).
 *
 * O caminho, o estado de cada nó e o "sem este nó" são as regras do servidor (`caminhoAte`, `podeAlocar`, `ilhadosSemEles`) sobre essa árvore.
 */

/** O tamanho da Ramificadora → o índice (o encaixe de expansão aceita a joia de índice até o tamanho dele) — `passivas/arvore.INDICE_DO_TAMANHO`. */
export const INDICE_DO_TAMANHO = Object.freeze({ Small: 0, Medium: 1, Large: 2 });
const NOME_DO_TAMANHO = ['Pequeno', 'Médio', 'Grande'];

/** O mapa por id e as arestas (cada par uma vez, só entre nós que existem) de uma lista de nós. */
function ligar(nos) {
  const porId = new Map(nos.map((n) => [n.id, n]));
  const arestas = [];
  const vistas = new Set();
  for (const n of nos) {
    for (const c of n.conexoes ?? []) {
      const m = porId.get(c);
      if (!m || m === n) continue;
      const chave = n.id < c ? `${n.id}|${c}` : `${c}|${n.id}`;
      if (vistas.has(chave)) continue;
      vistas.add(chave);
      arestas.push([n, m]);
    }
  }
  return { porId, arestas };
}

/**
 * A árvore que veio do servidor, pronta para a tela (uma vez): o mapa por id, as arestas, o texto de busca de cada nó (`busca(n)`) e os
 * centros dos grupos dos proxies (`gruposDeProxy`: "x,y" — a tela esconde esses fundos sem a joia).
 */
export function prepararArvore(a, busca = null) {
  const { porId, arestas } = ligar(a.nos);
  if (busca) for (const n of a.nos) n.busca = busca(n);
  const gruposDeProxy = new Set(a.nos.filter((n) => n.grupoDoProxy).map((n) => n.grupoDoProxy.join(',')));
  return { ...a, porId, arestas, gruposDeProxy, ativas: [], buscaDoNo: busca };
}

/** Os nós de cada joia encaixada: o encaixe dela, o tamanho e o fundo do grupo (no centro do grupo do proxy do encaixe). */
function joiasMontadas(base, porId, extras) {
  const porEncaixe = new Map();
  for (const n of extras) if (n.ramificadora?.encaixe != null && !porEncaixe.has(n.ramificadora.encaixe)) porEncaixe.set(n.ramificadora.encaixe, n.ramificadora.tamanho);
  const ativas = [];
  for (const [encaixe, tamanho] of porEncaixe) {
    const indice = INDICE_DO_TAMANHO[tamanho];
    const centro = base.porId.get(porId.get(encaixe)?.expansao?.proxy)?.grupoDoProxy;
    if (indice == null || !centro) continue;
    ativas.push({ encaixe, tamanho, x: centro[0], y: centro[1], fundo: `PSGroupBackground${indice + 1}`, meio: indice === 2 });
  }
  return ativas;
}

let memo = { base: null, r: null, chave: null, grafo: null };
/**
 * A árvore do PERSONAGEM: a base com os nós das Ramificadoras da vista `v`. Sem Ramificadora, a própria base. Memorizada pela vista (a mesma
 * vista, o mesmo objeto; uma vista nova com as mesmas joias, também — o nó escolhido na tela continua o mesmo).
 */
export function arvoreDoPersonagem(base, v) {
  if (!base) return null;
  const r = v?.ramificadoras?.nos?.length ? v.ramificadoras : null;
  if (!r) return base;
  if (memo.base === base && memo.r === r) return memo.grafo;
  const chave = JSON.stringify(r);
  if (memo.base === base && memo.chave === chave) {
    memo.r = r;
    return memo.grafo;
  }
  // (cópias: a vista guardada no estado não muda)
  const extras = r.nos.map((n) => ({ ...n, conexoes: [...(n.conexoes ?? [])] }));
  if (base.buscaDoNo) for (const n of extras) n.busca = base.buscaDoNo(n);
  const daJoia = new Set(extras.map((n) => n.id));
  const porIdDosNos = new Map(base.porId);
  for (const n of extras) porIdDosNos.set(n.id, n);
  // o encaixe da borda: as conexões da árvore + a entrada da joia
  for (const [id, conexoes] of Object.entries(r.encaixes ?? {})) {
    const no = porIdDosNos.get(id);
    if (no && !daJoia.has(id)) porIdDosNos.set(id, { ...no, conexoes: [...conexoes] });
  }
  const nos = [...porIdDosNos.values()];
  const { porId, arestas } = ligar(nos);
  const grafo = { ...base, nos, porId, arestas, ativas: joiasMontadas(base, porId, extras) };
  memo = { base, r, chave, grafo };
  return grafo;
}

/** O nó só existe com a Joia Ramificadora encaixada (o proxy e o encaixe interno sem a joia): a tela não o mostra, como o PoE. */
export const escondido = (n) => !!n?.soDaRamificadora;

/** Os inícios de outras classes que estes nós liberam ("Caminho do Marauder" da Ascendente: `inicio_extra:<classe>`) — a regra do servidor. */
export function iniciosExtras(a, ids) {
  const extras = new Set();
  for (const id of ids) for (const ef of a?.porId.get(id)?.efeitos ?? []) {
    const m = /^inicio_extra:(\w+)$/.exec(ef.add ?? '');
    if (m && ef.valor > 0 && a.inicios?.[m[1]]) extras.add(a.inicios[m[1]]);
  }
  return extras;
}

/** Os grupos com um notável entre estes ids (a maestria do grupo abre com ele). */
export function gruposComNotavel(a, ids) {
  return new Set([...ids].map((id) => a.porId.get(id)).filter((n) => n?.tipo === 'notable' && n.grupo != null).map((n) => n.grupo));
}

/** (lote 29) Os nós que as joias deixam alocar sem ligação ("podem ser atribuídas sem estarem conectadas à sua árvore") → o encaixe de cada um. */
const liberados = (v) => v?.liberados ?? {};

/** O menor caminho de nós não alocados até `id` — o mesmo que o servidor aceita (`passivas/arvore.caminhoAte`). */
export function caminhoAte(a, v, id) {
  const mine = new Set(v?.alocados ?? []);
  if (!a?.porId.has(id)) return null;
  if (mine.has(id)) return [];
  // (lote 29) o nó liberado por uma joia entra sozinho; o caminho pode começar num liberado (ele entra no caminho)
  const livres = Object.keys(liberados(v)).filter((x) => !mine.has(x));
  if (livres.includes(id)) return [id];
  const veioDe = new Map();
  const fila = [...mine, ...[...iniciosExtras(a, mine)].filter((x) => !mine.has(x))];
  for (const x of fila) veioDe.set(x, null);
  const origens = new Set(fila);
  for (const x of livres) if (!veioDe.has(x)) { veioDe.set(x, null); fila.push(x); }
  for (let i = 0; i < fila.length; i++) {
    for (const c of a.porId.get(fila[i])?.conexoes ?? []) {
      // (lote 60) não passa pelo proxy nem pelo encaixe interno sem a joia; (lote 77) o da joia encaixada chega sem a marca, e passa
      if (veioDe.has(c) || a.porId.get(c)?.tipo === 'start' || escondido(a.porId.get(c))) continue;
      veioDe.set(c, fila[i]);
      if (c === id) {
        const caminho = [];
        for (let x = c; x && !origens.has(x); x = veioDe.get(x)) caminho.unshift(x);
        return caminho;
      }
      fila.push(c);
    }
  }
  return null;
}

/**
 * Os nós alocados que FICAM sem `id` — tirando também os que perderiam o caminho até o início (a mesma regra do servidor:
 * `Passivas.ilhadosSemEles`).
 */
export function ficamSem(a, v, id) {
  const resto = new Set((v?.alocados ?? []).filter((x) => x !== id));
  // (+ os inícios extras dos nós que FICAM: tirar o "Caminho" ilha o que só se ligava por ele)
  // (lote 29: + os nós liberados por uma joia cujo encaixe fica)
  const inicios = [v?.inicio, v?.inicioAscendencia, ...iniciosExtras(a, resto), ...Object.entries(liberados(v)).filter(([n, s]) => s !== id && resto.has(n)).map(([n]) => n)].filter(Boolean);
  const ligados = new Set(inicios);
  const fila = [...inicios];
  while (fila.length) {
    for (const c of a.porId.get(fila.pop())?.conexoes ?? []) {
      if (resto.has(c) && !ligados.has(c)) {
        ligados.add(c);
        fila.push(c);
      }
    }
  }
  // A maestria fica enquanto houver um notável ligado no grupo dela.
  const grupos = gruposComNotavel(a, ligados);
  return [...resto].filter((x) => ligados.has(x) || (a.porId.get(x)?.tipo === 'mastery' && grupos.has(a.porId.get(x).grupo)));
}

/** O estado de um nó para a tela: alocado | disponivel | bloqueado. */
export function estadoDoNo(a, v, n) {
  const mine = new Set(v?.alocados ?? []);
  if (mine.has(n.id)) return 'alocado';
  if (n.tipo === 'start') return 'bloqueado';
  // (lote 60) o proxy e o encaixe interno das Ramificadoras: só com uma Joia Ramificadora encaixada (a regra do servidor).
  if (escondido(n)) return 'bloqueado';
  // A maestria abre com um notável alocado no grupo dela.
  if (n.tipo === 'mastery') return gruposComNotavel(a, mine).has(n.grupo) ? 'disponivel' : 'bloqueado';
  // A opção de escolha de uma ascendência: uma por pai (a irmã escolhida bloqueia as outras).
  if (n.opcaoDe != null && [...mine].some((x) => x !== n.id && a?.porId.get(x)?.opcaoDe === n.opcaoDe)) return 'bloqueado';
  const extras = iniciosExtras(a, mine);
  return (n.conexoes ?? []).some((c) => mine.has(c) || extras.has(c)) || liberados(v)[n.id] ? 'disponivel' : 'bloqueado';
}

/** Os nós que a Ramificadora do encaixe `id` cria, com os das joias menores dentro dela — o `nosDaRamificadora` do servidor. */
export function nosDaJoia(a, id) {
  const saida = [];
  const dentro = (encaixe) => {
    for (const n of a?.nos ?? []) {
      if (n.ramificadora?.encaixe !== encaixe) continue;
      saida.push(n.id);
      if (n.encaixeInterno) dentro(n.id);
    }
  };
  dentro(String(id));
  return saida;
}

/**
 * TIRAR (ou trocar) a Ramificadora do encaixe `id` — o `soltarRamificadora` do servidor: os nós dela que saem da alocação (os pontos voltam),
 * o preço (o de 1 nó no respec, se um encaixe interno ou uma pedra fundamental estava alocado nela — de graça no jogo oficial) e as joias menores
 * que voltam para a mochila. Null se a joia do encaixe não é uma Ramificadora.
 */
export function soltarJoia(a, v, id) {
  if (!v?.joias?.[id]?.poe?.ramificadora) return null;
  const dela = nosDaJoia(a, id);
  const meus = new Set(v.alocados ?? []);
  const sai = dela.filter((x) => meus.has(x));
  const custa = sai.some((x) => a.porId.get(x)?.encaixeInterno || a.porId.get(x)?.tipo === 'keystone');
  return { sai, preco: custa ? v.precoPorNo ?? 0 : 0, menores: dela.filter((x) => v.joias[x]).map((x) => v.joias[x]) };
}

/**
 * Por que a joia `peca` NÃO cabe no encaixe `no` (o `encaixar` do servidor, com os textos dele) — null se cabe: a Ramificadora só num encaixe
 * de expansão do tamanho dela ou maior; a joia comum em todos.
 */
export function porqueNaoCabe(no, peca) {
  const tamanho = peca?.poe?.ramificadora?.tamanho;
  if (!tamanho) return null;
  if (!no?.expansao) return 'A Joia Ramificadora só entra num encaixe de expansão (os Grandes da borda e os que as Ramificadoras criam).';
  if (INDICE_DO_TAMANHO[tamanho] > no.expansao.tamanho) return 'Essa Joia Ramificadora é grande demais para este encaixe.';
  return null;
}

/** O que o encaixe de expansão aceita, para a tela ("Encaixe Grande: joias comuns e Ramificadoras Grandes, Médias e Pequenas"). */
export function textoDoEncaixe(no) {
  const t = no?.expansao?.tamanho;
  if (t == null || !NOME_DO_TAMANHO[t]) return null;
  const cabem = ['Pequenas', 'Médias', 'Grandes'].slice(0, t + 1).reverse();
  return `Encaixe ${NOME_DO_TAMANHO[t]} de expansão: aceita joias comuns e Joias Ramificadoras ${cabem.length > 1 ? `${cabem.slice(0, -1).join(', ')} e ${cabem.at(-1)}` : cabem[0]}.`;
}
