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
export const linhaDoEncontro = (c) => (c?.mapa ? 'Área é influenciada pelo Criador' : c?.linha ?? null);

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
export function registrarItens(itemCatalog) {
  if (!ligado()) return 0;
  for (const it of DADOS.itens) {
    const c = chefe(it.chefe);
    itemCatalog[it.itemId] = {
      id: it.itemId, name: it.nome, type: 'fragmento', weight: 0.1, hasSprite: false, rarity: 'comum', stackable: true, pilha: 100, sell: 0,
      poe: { icone: it.icone, iconeLado: 64 },
      fragmentoPoe: { slug: it.slug, linhas: it.linhas ?? [], sabor: it.sabor ?? null, chefe: c?.nome ?? null, abre: Object.entries(DADOS.entradas).filter(([, ids]) => ids.includes(it.itemId)).map(([p]) => NOME_DO_PINACULO.get(p) ?? DADOS.arenas?.find((a) => a.id === p)?.nome ?? p),
        conjunto: Object.values(DADOS.entradas).find((ids) => ids.includes(it.itemId))?.length ?? 1,
        ...(it.convite ? { convite: { influencia: INFLUENCIAS_DO_ARQUIVO[it.influencia]?.nome ?? it.influencia, aCada: it.aCada } } : {}) },
    };
  }
  for (const m of DADOS.mapas) {
    const base = Mapas.baseDoTier(m.tier);
    const id = Mapas.idDoTier(m.tier);
    const daBase = id ? itemCatalog[id] : null;
    if (!daBase) continue;
    itemCatalog[m.itemId] = { ...daBase, id: m.itemId, name: m.nome, poe: { ...daBase.poe, base, icone: m.icone, iconeLado: 64, encontro: m.chefe } };
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
  return ids.map((id) => ({ id, nome: fragmento(id)?.nome ?? String(id), tem: contar(estado, id) }));
}

/** A Quantidade de Itens que os itens dão na área do pináculo ("Quantidade de Itens encontrados nesta Área aumentada em N%", somadas). */
export const quantidadeDosItens = (ids) =>
  ids.reduce((t, id) => t + (fragmento(id)?.linhas ?? []).reduce((u, l) => u + (Number(String(l).match(/Quantidade de Itens .*?(\d+)%/)?.[1]) || 0), 0), 0);

/**
 * Abre o pináculo: confere os itens (um de cada), registra `estado.pinaculoAberto` (6 portais) e entra na arena (`entrar()`, o
 * `Cacadas.entrar` do Dispositivo). Os itens só saem depois de a arena nascer; se a entrada falha, nada muda. `contar(estado, id)` e
 * `gastar(estado, id, n)`: os da mochila e do depósito do personagem (as funções das moedas). Devolve o resultado da entrada.
 */
export function abrir(estado, pinaculoId, { contar, gastar, entrar, agora = Date.now() }) {
  const ids = entrada(pinaculoId);
  if (!ids) return { ok: false, erro: 'Esse pináculo ainda não abre no Dispositivo de Mapas.' };
  if (estado.pinaculoAberto) return { ok: false, erro: 'Você já tem um pináculo aberto: volte a ele ou abandone-o antes de abrir outro.' };
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
  if (p.portais <= 0) estado.pinaculoAberto = null;
  return { portais: p.portais, falhou: p.portais <= 0 };
}

/** Venceu o pináculo aberto: fecha, e conta a vitória (`estado.pinaculosVencidos[id]` — a tela mostra). */
export function aoVencer(estado, bossId) {
  if (!estado || !bossId) return;
  if (estado.pinaculoAberto?.id === bossId) estado.pinaculoAberto = null;
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
