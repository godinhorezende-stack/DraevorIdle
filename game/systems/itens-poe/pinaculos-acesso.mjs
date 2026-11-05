// A ENTRADA DOS PINÁCULOS como no PoE (dono, 05/11: "quero igual do poe"; etapa 1 — Shaper, Elder e Sirus). Os dados estão em
// `gamedata/itens-poe/pinaculos-acesso.json` (gerado por `tools/montar-pinaculos-acesso.mjs` a partir do poedb).
//
//   - Nenhum pináculo pede level: cada um abre no Dispositivo de Mapas com os itens de `entradas` (um de cada, gastos ao abrir). O que
//     ainda não tem os itens (as próximas etapas) fica fechado.
//   - Os itens (os fragmentos dos Guardiões e as Coroas dos Conquistadores) saem GARANTIDOS dos 12 chefes intermediários, feitos como os
//     pináculos (a criatura de um chefe do Draevor + a vida, o dano e as resistências do poedb).
//   - Os chefes nascem nos MAPAS COM ENCONTRO (`poe.encontro` na peça): o mapa do Guardião do Criador (T16 — o guardião é o chefe do
//     mapa) ou o mapa comum "ocupado pelo…"/"com a Cidadela de…" (o chefe a mais, no fundo). Esses mapas caem dos chefes de mapa T14+.
//   - O pináculo aberto (`estado.pinaculoAberto`) tem 6 portais, como o mapa: cada morte gasta um; a vitória ou o último portal o fecham.
import { readFileSync, existsSync } from 'node:fs';
import { ligado } from './catalogo.mjs';
import * as Mapas from './mapas.mjs';
// (sem importar os bosses únicos nem o bestiário: `jogo.mjs` importa este módulo, e eles leem o bestiário ao carregar — quem registra os
// chefes, `pinaculos.iniciar`, passa os dois)

const ARQUIVO = new URL('../../gamedata/itens-poe/pinaculos-acesso.json', import.meta.url);
export const DADOS = existsSync(ARQUIVO) ? JSON.parse(readFileSync(ARQUIVO, 'utf8')) : { drop: {}, entradas: {}, itens: [], mapas: [], chefes: [] };
const CHEFES = new Map(DADOS.chefes.map((c) => [c.id, c]));
const ITENS = new Map(DADOS.itens.map((i) => [i.itemId, i]));
const MAPAS = new Map(DADOS.mapas.map((m) => [m.itemId, m]));
const GRUPOS = ['criador', 'anciao', 'conquistador'];
const INFLUENCIAS_DO_ARQUIVO = DADOS.influencias ?? {};
// O nome de cada pináculo (o balão do fragmento diz qual ele abre) — de `pinaculos.json`, sem importar `pinaculos.mjs` (que importa o jogo).
const ARQUIVO_DOS_PINACULOS = new URL('../../gamedata/itens-poe/pinaculos.json', import.meta.url);
const NOME_DO_PINACULO = new Map((existsSync(ARQUIVO_DOS_PINACULOS) ? JSON.parse(readFileSync(ARQUIVO_DOS_PINACULOS, 'utf8')).chefes : []).map((c) => [c.id, c.nome]));

/** O chefe intermediário pelo id (`poe-guardiao-da-hidra`…), ou null. */
export const chefe = (id) => CHEFES.get(id) ?? null;
/** O fragmento/coroa pelo id do item, ou null. */
export const fragmento = (itemId) => ITENS.get(Number(itemId)) ?? null;
/** O mapa do Guardião do Criador pelo id do item, ou null. */
export const mapaDoGuardiao = (itemId) => MAPAS.get(Number(itemId)) ?? null;
/** Os ids dos itens que o pináculo pede no Dispositivo (um de cada), ou null (o pináculo ainda não tem a entrada no jogo). */
export const entrada = (pinaculoId) => DADOS.entradas?.[pinaculoId] ?? null;
/** As linhas do mapa com encontro do grupo (o texto do implícito: "Mapa ocupado pelo…", "Mapa contém a Cidadela de…"). */
export const linhaDoEncontro = (c) => (c?.grupo === 'memoria' ? 'Mapa final de uma Linha de Memória' : c?.mapa ? 'Área é influenciada pelo Criador' : c?.linha ?? null);

/** A definição de boss único do chefe (como `pinaculos.definicao`). */
export function definicao(c) {
  return {
    id: c.id,
    nome: c.nome,
    descricao: `Chefe do Atlas do Path of Exile (${c.vidaPct}% de vida, ${c.danoPct}% de dano). Solta o fragmento de um pináculo.`,
    categoria: 'endgame',
    base: c.base,
    atributos: { vidaMult: c.vidaMult, danoMult: c.danoPct / 100, expMult: c.expPct / 100, resistencias: { ...c.resistencias } },
    usaPoderesDoBase: true,
    usaEscalaDaFase: false,
  };
}

let INICIADO = false;
/**
 * Registra os 12 chefes como bosses únicos (uma vez). Sem o sistema ligado, nada. Devolve os ids registrados. `BossesUnicos`: o catálogo
 * dos bosses únicos (`registrar`, `bossUnico`); `bestiario`: o BESTIARY (a criatura-base precisa existir).
 */
export function iniciar(BossesUnicos, bestiario) {
  if (!ligado()) return [];
  if (!INICIADO) {
    for (const c of DADOS.chefes) if (bestiario[c.base]) BossesUnicos.registrar(definicao(c));
    INICIADO = true;
  }
  return DADOS.chefes.filter((c) => BossesUnicos.bossUnico(c.id)).map((c) => c.id);
}

/**
 * Os itens no catálogo: os fragmentos (empilham, vão para a bolsa e o depósito, com o ícone do PoE e as linhas do poedb no balão) e os
 * mapas dos Guardiões do Criador (a base do T16, com o desenho do mapa e o encontro). Ids fixos (7.750.001… e 7.751.001…).
 */
/** O que o balão do convite da Maven diz: quem nasce no Calvário e quantos Fragmentos Crescentes ele solta. */
const mavenDoConvite = (crisolId) => {
  const c = crisol(crisolId);
  if (!c) return null;
  return { chefes: c.chefes === 'testemunhados' ? `os ${MAVEN.contador} chefes de mapa que a Maven testemunhou` : c.chefes.map((id) => chefe(id)?.nome ?? id).join(', '), fragmentos: c.fragmentos };
};

export function registrarItens(itemCatalog) {
  if (!ligado()) return 0;
  for (const it of DADOS.itens) {
    const c = chefe(it.chefe);
    itemCatalog[it.itemId] = {
      id: it.itemId, name: it.nome, type: 'fragmento', weight: 0.1, hasSprite: false, rarity: 'comum', stackable: true, pilha: 100, sell: 0,
      poe: { icone: it.icone, iconeLado: 64 },
      fragmentoPoe: { slug: it.slug, linhas: it.linhas ?? [], sabor: it.sabor ?? null, chefe: c?.nome ?? null, abre: Object.entries(DADOS.entradas).filter(([, ids]) => ids.includes(it.itemId)).map(([p]) => NOME_DO_PINACULO.get(p) ?? DADOS.arenas?.find((a) => a.id === p)?.nome ?? p),
        conjunto: Object.values(DADOS.entradas).find((ids) => ids.includes(it.itemId))?.length ?? 1,
        ...(it.cortex ? { cortex: true } : {}),
        ...(it.memoria ? { memoria: { chefe: chefe(it.memoria)?.nome ?? null, mapa: DADOS.mapas.find((m) => m.chefe === it.memoria)?.nome ?? null, eco: fragmento(chefe(it.memoria)?.fragmento)?.nome ?? null } } : {}),
        ...(it.crescente ? { crescente: { citacao: fragmento(MAVEN?.citacao)?.nome ?? 'A Citação de Maven', n: MAVEN?.fragmentosParaCitacao ?? 10 } } : {}),
        ...(it.conviteDaMaven ? { conviteDaMaven: mavenDoConvite(it.conviteDaMaven) } : {}),
        ...(it.convite ? { convite: { influencia: INFLUENCIAS_DO_ARQUIVO[it.influencia]?.nome ?? it.influencia, aCada: it.aCada } } : {}) },
    };
  }
  for (const m of DADOS.mapas) {
    const base = Mapas.baseDoTier(m.tier);
    const id = Mapas.idDoTier(m.tier);
    const daBase = id ? itemCatalog[id] : null;
    if (!daBase) continue;
    // (etapa 4: o mapa final da Memória não tem desenho próprio no PoE — fica o do T16)
    itemCatalog[m.itemId] = { ...daBase, id: m.itemId, name: m.nome, poe: { ...daBase.poe, base, icone: m.icone ?? daBase.poe?.icone, iconeLado: 64, encontro: m.chefe } };
  }
  return DADOS.itens.length + DADOS.mapas.length;
}

/**
 * O MAPA COM ENCONTRO que cai do chefe de um mapa do tier `tierDaArea` (T14+): cada grupo tem a sua chance (`drop.chancePorChefe`). Devolve
 * `[{ grupo, chefe }]` — o chefe já sorteado no grupo (um dos 4). Abaixo do tier mínimo, nada.
 */
export function sortearEncontros(tierDaArea, rng = Math.random) {
  const D = DADOS.drop ?? {};
  if (!(Number(tierDaArea) >= (Number(D.tierMinimo) || Infinity))) return [];
  const saida = [];
  for (const grupo of GRUPOS) {
    if (!(rng() < (Number(D.chancePorChefe?.[grupo]) || 0))) continue;
    const doGrupo = DADOS.chefes.filter((c) => c.grupo === grupo);
    if (doGrupo.length) saida.push({ grupo, chefe: doGrupo[Math.floor(rng() * doGrupo.length)] });
  }
  return saida;
}

/**
 * A peça do mapa com o encontro do chefe `c`, a partir de uma peça de mapa sorteada (`peca`, a do tier — o T16 para o Guardião do
 * Criador). Muta e devolve a peça: o id do mapa do guardião (o desenho dele), o implícito do encontro e `poe.encontro`. O mapa Único não
 * leva encontro (null).
 */
export function comEncontro(peca, c) {
  if (!peca?.poe || !c || peca.poe.unico) return null;
  const linha = linhaDoEncontro(c);
  peca.poe.implicitos = [...(peca.poe.implicitos ?? []), { texto: linha }];
  peca.poe.estados = Mapas.estadosDasLinhas(peca.poe);
  peca.poe.notas = Mapas.notasDasLinhas(peca.poe);
  peca.poe.encontro = c.id;
  const doMapa = c.mapa ? mapaDoGuardiao(c.mapa) : null;
  if (doMapa) {
    const nomeDaBase = `Mapa (Nível ${doMapa.tier})`;
    peca.id = doMapa.itemId;
    peca.poe.nome = String(peca.poe.nome ?? nomeDaBase).replace(nomeDaBase, doMapa.nome);
  }
  return peca;
}

// ---------------------------------------------------------------- o PINÁCULO ABERTO no Dispositivo

/** Os portais do pináculo aberto (os mesmos do mapa: 6, como no PoE). */
export const portais = () => Math.max(1, Number(Mapas.DADOS.dispositivo?.portais) || 6);

/** Quantos de cada item da entrada o personagem tem (mochila e depósito do personagem — onde as moedas também contam). */
export function itensDaEntrada(estado, pinaculoId, contar) {
  const ids = entrada(pinaculoId);
  if (!ids) return null;
  const conta = contarComFragmentos(contar);
  return ids.map((id) => ({ id, nome: fragmento(id)?.nome ?? String(id), tem: conta(estado, id) }));
}

/** A Quantidade de Itens que os itens dão na área do pináculo ("Quantidade de Itens encontrados nesta Área aumentada em N%", somadas). */
export const quantidadeDosItens = (ids) =>
  ids.reduce((t, id) => t + (fragmento(id)?.linhas ?? []).reduce((u, l) => u + (Number(String(l).match(/Quantidade de Itens .*?(\d+)%/)?.[1]) || 0), 0), 0);

/**
 * Abre o pináculo: confere os itens (um de cada), registra `estado.pinaculoAberto` (6 portais) e entra na arena (`entrar()`, o
 * `Cacadas.entrar` do Dispositivo). Os itens só saem depois de a arena nascer; se a entrada falha, nada muda. `contar(estado, id)` e
 * `gastar(estado, id, n)`: os da mochila e do depósito do personagem (as funções das moedas). Devolve o resultado da entrada.
 */
export function abrir(estado, pinaculoId, { contar: contarNaFonte, gastar: gastarNaFonte, entrar, agora = Date.now() }) {
  const contar = contarComFragmentos(contarNaFonte);
  const gastar = gastarComFragmentos(contarNaFonte, gastarNaFonte);
  const ids = entrada(pinaculoId);
  if (!ids) return { ok: false, erro: 'Esse pináculo ainda não abre no Dispositivo de Mapas.' };
  if (estado.pinaculoAberto) return { ok: false, erro: 'Você já tem um pináculo aberto: volte a ele ou abandone-o antes de abrir outro.' };
  const fechado = motivoDoCrisolFechado(estado, pinaculoId);
  if (fechado) return { ok: false, erro: fechado };
  const faltam = ids.filter((id) => contar(estado, id) < 1);
  if (faltam.length) return { ok: false, erro: `Faltam: ${faltam.map((id) => fragmento(id)?.nome ?? id).join(', ')}.` };
  estado.pinaculoAberto = { id: pinaculoId, portais: portais(), portaisMax: portais(), mortes: 0, abertoEm: agora, quantidadePct: quantidadeDosItens(ids) };
  const r = entrar();
  if (!r?.ok) {
    estado.pinaculoAberto = null;
    return r ?? { ok: false, erro: 'A arena não abriu.' };
  }
  for (const id of ids) gastar(estado, id, 1);
  return r;
}

/** O pináculo aberto deste personagem é `bossId` (com portal sobrando)? */
export const aberto = (estado, bossId) => !!estado?.pinaculoAberto && estado.pinaculoAberto.id === bossId && estado.pinaculoAberto.portais > 0;

/** Morreu na arena do pináculo aberto: gasta um portal; sem portal, o pináculo fecha. Devolve `{ portais, falhou }` ou null. */
export function aoMorrer(estado, bossId) {
  const p = estado?.pinaculoAberto;
  if (!p || p.id !== bossId) return null;
  p.portais = Math.max(0, p.portais - 1);
  p.mortes = (p.mortes ?? 0) + 1;
  if (p.portais <= 0) {
    estado.pinaculoAberto = null;
    aoFecharCrisol(estado, bossId);
  }
  return { portais: p.portais, falhou: p.portais <= 0 };
}

/** Venceu o pináculo aberto: fecha, e conta a vitória (`estado.pinaculosVencidos[id]` — a tela mostra). */
export function aoVencer(estado, bossId) {
  if (!estado || !bossId) return;
  if (estado.pinaculoAberto?.id === bossId) estado.pinaculoAberto = null;
  aoFecharCrisol(estado, bossId);
  (estado.pinaculosVencidos ??= {})[bossId] = (Number(estado.pinaculosVencidos[bossId]) || 0) + 1;
}

/** Abandona o pináculo aberto (os itens já foram gastos, como no PoE). */
export function abandonar(estado) {
  if (!estado?.pinaculoAberto) return { ok: false, erro: 'Você não tem um pináculo aberto.' };
  estado.pinaculoAberto = null;
  return { ok: true };
}

// ---------------------------------------------------------------- a INFLUÊNCIA do Exarca e do Devorador (etapa 2)
/*
 * No PoE a influência se escolhe no Dispositivo (uma por vez, ou nenhuma). Cada chefe de mapa T14+ vencido num mapa aberto sob a influência
 * conta para cada convite dela; a cada `aCada` cai o convite (`drop` garantido para quem matou). O convite do pináculo (Incandescente,
 * Gritante) só começa a contar depois da arena intermediária vencida uma vez (`depoisDe`). Mora em `estado.atlas`:
 *   { influencia: 'exarca' | 'devorador' | null, contagem: { [itemId do convite]: n } }
 */
export const INFLUENCIAS = DADOS.influencias ?? {};
const CONVITES = DADOS.itens.filter((i) => i.convite);
const atlas = (estado) => {
  const a = (estado.atlas ??= {});
  a.influencia ??= null;
  a.contagem ??= {};
  return a;
};

/** Escolhe a influência dos próximos mapas (`null`: nenhuma). `{ ok, erro? }`. */
export function definirInfluencia(estado, influencia) {
  const v = influencia == null || influencia === '' ? null : String(influencia);
  if (v != null && !INFLUENCIAS[v]) return { ok: false, erro: 'Essa influência não existe.' };
  atlas(estado).influencia = v;
  return { ok: true };
}

/** O convite já conta? (o do pináculo, só depois da arena intermediária vencida uma vez) */
const contaJa = (estado, c) => !c.depoisDe || (Number(estado?.pinaculosVencidos?.[c.depoisDe]) || 0) > 0;

/**
 * Um chefe de mapa vencido num mapa do tier `tier` aberto sob a `influencia` (`hunt.mapa.influencia`): conta para os convites dela e devolve
 * os ids dos que caem agora (a cada `aCada`). Abaixo do tier mínimo, sem influência: nada.
 */
export function aoVencerChefeDeMapa(estado, { tier, influencia }) {
  const inf = INFLUENCIAS[influencia];
  if (!inf || !(Number(tier) >= inf.tierMinimo)) return [];
  const a = atlas(estado);
  const caem = [];
  for (const c of CONVITES.filter((x) => x.influencia === influencia)) {
    if (!contaJa(estado, c)) continue;
    const n = (a.contagem[c.itemId] = (Number(a.contagem[c.itemId]) || 0) + 1);
    if (n % c.aCada === 0) caem.push(c.itemId);
  }
  return caem;
}

/** A influência para a tela: a escolhida e, de cada convite, quanto falta (`{ id, nome, abre, feitos, aCada, conta }`). */
export function influenciaParaTela(estado) {
  const a = estado?.atlas ?? {};
  return {
    escolhida: a.influencia ?? null,
    opcoes: Object.entries(INFLUENCIAS).map(([id, i]) => ({ id, nome: i.nome, tierMinimo: i.tierMinimo })),
    convites: CONVITES.map((c) => ({ id: c.itemId, nome: c.nome, influencia: c.influencia, abre: NOME_DO_PINACULO.get(c.abre) ?? DADOS.arenas?.find((x) => x.id === c.abre)?.nome ?? c.abre, feitos: (Number(a.contagem?.[c.itemId]) || 0) % c.aCada, aCada: c.aCada, conta: contaJa(estado, c) })),
  };
}

// ---------------------------------------------------------------- a MAVEN (etapa 3)
/*
 * Dono (05/11): a Maven se liga no Dispositivo (como no PoE) e TESTEMUNHA os chefes de mapa T14+ dos mapas abertos com ela. Cada um vencido
 * soma 1, até 10 (`contador`), e fica guardado (`testemunhados`: quem nasce no Calvário do Atlas); no 10º cai o Convite da Maven: Atlas
 * (garantido, uma vez por ciclo). Os chefes dos encontros (Guardiões do Criador e do Ancião, Conquistadores) testemunhados ficam em `vistos`:
 * com os 4 de um grupo cai o convite dele (Deformados, Distorcidos, Matadores do Ancião) e o grupo recomeça. O Calvário (o Crisol) do Atlas
 * pede os 10; vencido — ou perdidos os 6 portais —, a Maven esquece os testemunhados, como no PoE. Mora em `estado.maven`:
 *   { ligada, contador, testemunhados: [{ chave | bossUnico, nome }], conviteDoAtlas, vistos: { [id do chefe]: true } }
 */
export const MAVEN = DADOS.maven ?? null;
const CRISOIS = new Map((MAVEN?.crisois ?? []).map((c) => [c.id, c]));
/** O Calvário da Conhecedora pelo id (`poe-crisol-atlas`…), ou null. */
export const crisol = (id) => CRISOIS.get(id) ?? null;
export const crisois = () => [...CRISOIS.values()];

/** O registro da Maven do personagem (criado na primeira vez). */
export function daMaven(estado) {
  const m = (estado.maven ??= {});
  m.ligada ??= false;
  m.contador ??= 0;
  m.testemunhados ??= [];
  m.conviteDoAtlas ??= false;
  m.vistos ??= {};
  return m;
}

/** Liga ou desliga a Maven nos próximos mapas. `{ ok }`. */
export function definirMaven(estado, ligada) {
  if (!MAVEN) return { ok: false, erro: 'A Maven ainda não existe neste servidor.' };
  daMaven(estado).ligada = !!ligada;
  return { ok: true };
}

/**
 * Um chefe vencido num mapa do tier `tier` aberto com a Maven (`hunt.mapa.maven`): o chefe do mapa soma no contador (até 10) e os chefes dos
 * encontros ficam vistos. Devolve os ids dos convites que caem agora. `alvo`: o monstro (o chefe do mapa — `chefeDoMapa` —, o do encontro —
 * `boss.id` de um dos 12).
 */
export function aoVencerComMaven(estado, { tier, maven }, alvo) {
  if (!MAVEN || !maven || !(Number(tier) >= MAVEN.tierMinimo) || !alvo) return [];
  const st = daMaven(estado);
  const caem = [];
  const doEncontro = alvo.boss?.id && chefe(alvo.boss.id) ? alvo.boss.id : null;
  if (alvo.chefeDoMapa && st.contador < MAVEN.contador) {
    st.testemunhados.push(doEncontro ? { bossUnico: doEncontro, nome: alvo.name } : { chave: alvo.key, nome: alvo.name });
    st.contador++;
    if (st.contador >= MAVEN.contador && !st.conviteDoAtlas) {
      st.conviteDoAtlas = true;
      const atlas = crisois().find((c) => c.chefes === 'testemunhados');
      if (atlas) caem.push(atlas.convite);
    }
  }
  if (doEncontro) {
    st.vistos[doEncontro] = true;
    for (const c of crisois()) {
      if (!Array.isArray(c.chefes) || !c.chefes.includes(doEncontro) || !c.chefes.every((id) => st.vistos[id])) continue;
      for (const id of c.chefes) delete st.vistos[id];
      caem.push(c.convite);
    }
  }
  return caem;
}

/** O Calvário abre? (o do Atlas pede os 10 testemunhados) — o motivo, ou null. */
export function motivoDoCrisolFechado(estado, crisolId) {
  const c = crisol(crisolId);
  if (!c) return null;
  if (c.chefes === 'testemunhados' && (Number(estado?.maven?.contador) || 0) < MAVEN.contador) return `A Maven precisa ter testemunhado ${MAVEN.contador} chefes de mapa (${Number(estado?.maven?.contador) || 0} de ${MAVEN.contador}).`;
  return null;
}

/** Os chefes do Calvário, na ordem em que nascem (em pares): `[{ chave } | { bossUnico }]`. */
export function chefesDoCrisol(estado, crisolId) {
  const c = crisol(crisolId);
  if (!c) return [];
  if (c.chefes === 'testemunhados') return (estado?.maven?.testemunhados ?? []).slice(0, MAVEN.contador).map((t) => ({ ...t }));
  return c.chefes.map((id) => ({ bossUnico: id, nome: chefe(id)?.nome ?? id }));
}

/** Os Fragmentos Crescentes que o Calvário solta ao ser vencido (Atlas 6–7, os outros 3–4 — dono, pela poewiki). */
export function fragmentosDoCrisol(crisolId, rng = Math.random) {
  const [min, max] = crisol(crisolId)?.fragmentos ?? [0, 0];
  return min + Math.floor(rng() * (max - min + 1));
}

/** O Calvário acabou (vencido, ou os portais acabaram): o do Atlas faz a Maven esquecer os testemunhados (o próximo ciclo recomeça). */
export function aoFecharCrisol(estado, crisolId) {
  if (crisol(crisolId)?.chefes !== 'testemunhados') return;
  const st = daMaven(estado);
  st.contador = 0;
  st.testemunhados = [];
  st.conviteDoAtlas = false;
}

/** A Maven para a tela: ligada, o contador, quem ela testemunhou e os vistos de cada convite dos guardiões. */
export function mavenParaTela(estado) {
  if (!MAVEN) return null;
  const st = estado?.maven ?? {};
  return {
    ligada: !!st.ligada,
    contador: Number(st.contador) || 0,
    meta: MAVEN.contador,
    tierMinimo: MAVEN.tierMinimo,
    testemunhados: (st.testemunhados ?? []).map((t) => t.nome),
    grupos: crisois().filter((c) => Array.isArray(c.chefes)).map((c) => ({ id: c.id, nome: fragmento(c.convite)?.nome ?? c.nome, chefes: c.chefes.map((id) => ({ nome: chefe(id)?.nome ?? id, visto: !!st.vistos?.[id] })) })),
  };
}

/*
 * A CITAÇÃO DE MAVEN: 10 Fragmentos Crescentes valem uma (no PoE se juntam; aqui o Dispositivo conta os 10 como uma Citação e os gasta se
 * faltar a Citação inteira). `contarComFragmentos`/`gastarComFragmentos` embrulham o contar/gastar do Dispositivo.
 */
const citacaoDosFragmentos = (id) => MAVEN && Number(id) === MAVEN.citacao;
export const contarComFragmentos = (contar) => (estado, id) => contar(estado, id) + (citacaoDosFragmentos(id) ? Math.floor(contar(estado, MAVEN.fragmento) / MAVEN.fragmentosParaCitacao) : 0);
export const gastarComFragmentos = (contar, gastar) => (estado, id, n) => {
  if (!citacaoDosFragmentos(id) || contar(estado, id) >= n) return gastar(estado, id, n);
  return gastar(estado, MAVEN.fragmento, n * MAVEN.fragmentosParaCitacao);
};

// ---------------------------------------------------------------- o VENARIUS e as ENCARNAÇÕES (etapa 4)
/*
 * Dono (05/11): o CÓRTEX (o mapa Único do Venarius no PoE) abre o Venarius no Dispositivo, como os outros; as MEMÓRIAS (Solidão, Reverência,
 * Trauma — PoE 3.26) viram o MAPA FINAL da linha delas (T16, com o nome da área do PoE), cujo chefe (a Chama Abandonada, o Deus Enganador, o
 * Cardeal do Medo — feitos como os guardiões) solta o ECO garantido; o Eco abre a Encarnação. Os dois caem dos chefes de mapa T14+: o Córtex
 * com `drop.chanceDoCortex` (2%), uma Memória sorteada com `drop.chanceDaMemoria` (3%) — sem taxa no PoE, números do dono.
 */
const MEMORIAS = DADOS.itens.filter((i) => i.memoria);
/** A Memória pelo id do item, ou null. */
export const memoria = (itemId) => MEMORIAS.find((m) => m.itemId === Number(itemId)) ?? null;
export const memorias = () => [...MEMORIAS];

/** O que o chefe de um mapa do tier solta da etapa 4 (o Córtex, uma Memória): os ids dos itens. Abaixo do tier mínimo, nada. */
export function sortearDoAtlas(tierDaArea, rng = Math.random) {
  const D = DADOS.drop ?? {};
  if (!(Number(tierDaArea) >= (Number(D.tierMinimo) || Infinity))) return [];
  const saida = [];
  const cortex = DADOS.itens.find((i) => i.cortex);
  if (cortex && rng() < (Number(D.chanceDoCortex) || 0)) saida.push(cortex.itemId);
  if (MEMORIAS.length && rng() < (Number(D.chanceDaMemoria) || 0)) saida.push(MEMORIAS[Math.floor(rng() * MEMORIAS.length)].itemId);
  return saida;
}

/** A peça do mapa final da Memória (`criarMapa(tier)`: a peça de mapa sorteada do T16 — o Único vira Normal, como os do encontro). */
export function mapaDaMemoria(memoriaId, criarMapa) {
  const m = memoria(memoriaId);
  const c = m ? chefe(m.memoria) : null;
  const doMapa = c?.mapa ? mapaDoGuardiao(c.mapa) : null;
  if (!doMapa) return null;
  let peca = criarMapa(doMapa.tier);
  if (peca?.poe?.unico) peca = criarMapa(doMapa.tier, 'normal');
  return comEncontro(peca, c);
}
