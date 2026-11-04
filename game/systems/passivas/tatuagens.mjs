// (100% — lote "dados", 03/11) As TATUAGENS do PoE (as do Ancestral) na árvore do PoE. Os dados: `gamedata/itens-poe/tatuagens-poe.json`
// (tools/importar-tatuagens-poe.mjs, do poedb pt). Dono, 03/11: "nada pode ficar como 'não se aplica ao jogo'".
//
// As regras do PoE (o poedb — "Clique com o botão direito neste item, depois clique em uma Habilidade Passiva alocada. Máximo de 50 Tatuagens."):
//   - a tatuagem é um item EMPILHÁVEL (a pilha de 10 do PoE; a do jogo, 100 — `itens/pilha.mjs`) que se usa numa passiva ALOCADA e a SUBSTITUI:
//     o nó passa a dar as linhas da tatuagem no lugar das dele (o "+10 de Força" some);
//   - cada uma diz que nó aceita (o `alvo`): a pequena de um atributo (as 50 comuns — "Substitui uma Habilidade Passiva Pequena de Força": o nó
//     pequeno que só dá "+10 de Força"), o notável de "+30 de um atributo" (as 3 da Jornada) ou um notável da SUA ascendência (as 7 Proibidas);
//   - no máximo 50 tatuagens na árvore; as Proibidas, "Limitado a: 1 Tatuagem de Ascendência";
//   - a tatuagem fica no nó (tirar a passiva não a apaga — volta a valer ao alocar de novo); outra tatuagem no mesmo nó toma o lugar (a de antes
//     se perde, como no PoE); a passiva conquistada por uma Joia Atemporal e o nó de uma Ramificadora não aceitam;
//   - a Jornada: "+25 de Vida máxima por Tatuagem da Jornada do Corpo Alocada" — cada uma dá 25 × as do mesmo tipo alocadas (o PoB: o
//     multiplicador `JourneyTattooBody`);
//   - a Proibida: "Concede uma habilidade notável de ascendência aleatória da <classe>" — sorteada entre os notáveis das ascendências daquela
//     classe (fora os que você já tem) quando a tatuagem é aplicada; o nó passa a dar as linhas daquele notável.
// O Conto do Guerreiro ("Efeito das Tatuagens no Raio aumentado em 100%"): `passivas/arvore.efeitosNoRaio`.
// O DROP (escolha sem fonte — a liga Ancestral, onde as tatuagens caem das tribos, não está no jogo): `DROP`, `dropDoMonstro`.
import { readFileSync } from 'node:fs';
import { ITEM_CATALOG } from '../dados.mjs';
import { traduzirLinha } from '../itens-poe/arvore.mjs';
import { ligado as itensPoeLigado } from '../itens-poe/catalogo.mjs';
import { PILHA_MAX_POE } from '../itens/pilha.mjs';
import * as MoedasPoe from '../itens-poe/moedas.mjs';
import { arvore, grafoDe, definirTatuagens, nosConquistados } from './arvore.mjs';

const DADOS = JSON.parse(readFileSync(new URL('../../gamedata/itens-poe/tatuagens-poe.json', import.meta.url), 'utf8'));
export const TATUAGENS = Object.freeze(DADOS.tatuagens);
/** O máximo de tatuagens na árvore (o PoE: 50). */
export const MAXIMO = DADOS.maximo ?? 50;
const POR_SLUG = new Map(TATUAGENS.map((t) => [t.slug, t]));
const POR_ID = new Map(TATUAGENS.map((t) => [t.itemId, t]));
export const daSlug = (slug) => POR_SLUG.get(String(slug ?? '')) ?? null;
export const doItem = (id) => POR_ID.get(Number(id)) ?? null;
export const ehTatuagem = (id) => POR_ID.has(Number(id));
const NOME_DO_ATRIBUTO = { str: 'Força', dex: 'Destreza', int: 'Inteligência' };

/** O texto do "Substitui …" (o do poedb). */
export function textoDoAlvo(t) {
  if (t?.alvo?.tipo === 'pequena') return `Substitui uma Habilidade Passiva Pequena de ${NOME_DO_ATRIBUTO[t.alvo.atributo]}`;
  if (t?.alvo?.tipo === 'notavel30') return `Substitui uma Habilidade Passiva +30 de ${NOME_DO_ATRIBUTO[t.alvo.atributo]} Notável`;
  if (t?.alvo?.tipo === 'ascendencia') return 'Substitui uma Habilidade Passiva Notável de Ascendência';
  return '';
}

// ---------------------------------------------------------------- o catálogo
/** Registra as tatuagens no catálogo de itens (uma vez; só no PoE): empilháveis, com o ícone do PoE (servido como as moedas). */
export function iniciar(catalogo = ITEM_CATALOG) {
  if (!itensPoeLigado()) return 0;
  let n = 0;
  for (const t of TATUAGENS) {
    const tatuagemPoe = { slug: t.slug, tipo: t.tipo, alvo: t.alvo, ...(t.limite ? { limite: t.limite } : {}), linhas: t.linhas, substitui: textoDoAlvo(t) };
    if (catalogo[t.itemId]) {
      Object.assign(catalogo[t.itemId], { tatuagemPoe, pilha: PILHA_MAX_POE });
      continue;
    }
    catalogo[t.itemId] = {
      id: t.itemId, name: t.nome, weight: 0.1, stackable: true, type: 'moeda', rarity: 'raro', hasSprite: true, spriteDe: 9655,
      ...(t.icone ? { poeMoeda: { icone: t.icone } } : {}), tatuagemPoe, descricao: `${textoDoAlvo(t)}. ${t.linhas.join(' ')}`, sell: 0, pilha: PILHA_MAX_POE,
    };
    n++;
  }
  return n;
}

// ---------------------------------------------------------------- onde entra
const poe = () => arvore()?.id === 'poe';
/** O nó só dá "+N de <atributo>" (o pequeno de atributo, N = 10; o notável de atributo, N = 30)? → o atributo. */
function atributoPuro(no, valor) {
  const efs = no?.efeitos ?? [];
  return efs.length === 1 && efs[0].add && NOME_DO_ATRIBUTO[efs[0].add] && efs[0].valor === valor ? efs[0].add : null;
}
/** O tipo de alvo que o nó é: `{ tipo: 'pequena'|'notavel30', atributo }`, `{ tipo: 'ascendencia', ascendencia }` ou null. */
export function alvoDoNo(no) {
  if (!no || no.ramificadora || no.encaixeDeJoia) return null;
  if (no.tipo === 'small' && !no.ascendencia) {
    const a = atributoPuro(no, 10);
    return a ? { tipo: 'pequena', atributo: a } : null;
  }
  if (no.tipo === 'notable' && !no.ascendencia) {
    const a = atributoPuro(no, 30);
    return a ? { tipo: 'notavel30', atributo: a } : null;
  }
  if (no.tipo === 'notable' && no.ascendencia) return { tipo: 'ascendencia', ascendencia: no.ascendencia };
  return null;
}
const casa = (t, alvo) => !!t && !!alvo && t.alvo.tipo === alvo.tipo && (alvo.tipo === 'ascendencia' || t.alvo.atributo === alvo.atributo);

/** Por que a tatuagem `t` não entra no nó `id` agora (null = entra). */
export function porqueNao(estado, id, t) {
  if (!poe()) return 'As Tatuagens são da árvore do PoE.';
  if (!t) return 'Isso não é uma Tatuagem.';
  const p = estado?.passivas;
  const no = grafoDe(estado).porId.get(String(id));
  if (!no) return 'Nó desconhecido.';
  if (!(p?.alocados ?? []).includes(no.id)) return 'Aplique a Tatuagem numa Habilidade Passiva alocada.';
  const alvo = alvoDoNo(no);
  if (!casa(t, alvo)) return `${t.nome}: ${textoDoAlvo(t)}.`;
  if (alvo.tipo === 'ascendencia' && alvo.ascendencia !== p.ascendencia) return 'Só nos notáveis da sua ascendência.';
  if (nosConquistados(estado).has(no.id)) return 'A passiva conquistada por uma Joia Atemporal não aceita Tatuagem.';
  const outras = Object.entries(p.tatuagens ?? {}).filter(([k]) => k !== no.id);
  if (outras.length >= MAXIMO) return `Máximo de ${MAXIMO} Tatuagens.`;
  if (t.limite && outras.filter(([, x]) => daSlug(x.slug)?.limite?.grupo === t.limite.grupo).length >= t.limite.n) return `Limitado a: ${t.limite.n} Tatuagem de Ascendência.`;
  return null;
}

/** Os notáveis de ascendência da classe (o sorteio da Proibida), fora os alocados e o próprio nó. */
function notaveisDaClasse(estado, classe, menos) {
  const a = arvore();
  const meus = new Set(estado?.passivas?.alocados ?? []);
  return a.nos.filter((n) => n.ascendencia && n.tipo === 'notable' && a.ascendencias?.[n.ascendencia]?.classe === classe && !meus.has(n.id) && n.id !== menos);
}

/**
 * `{t:'passivas', action:'tatuar', no, id}` — usa UMA tatuagem (o item `id`, da mochila ou do baú) no nó alocado `no`. A de antes no nó (se havia)
 * se perde. Devolve `{ ok, aviso }` ou `{ ok: false, erro }`.
 */
export function tatuar(estado, { no, id } = {}, rng = Math.random) {
  const t = doItem(id);
  const porque = porqueNao(estado, no, t);
  if (porque) return { ok: false, erro: porque };
  if (MoedasPoe.quantasTem(estado, t.itemId) < 1) return { ok: false, erro: `Você não tem ${t.nome}.` };
  const p = estado.passivas;
  const n = String(no);
  const x = { slug: t.slug };
  if (t.tipo === 'proibida') {
    const lista = notaveisDaClasse(estado, t.classe, n);
    if (!lista.length) return { ok: false, erro: 'Nenhum notável de ascendência para sortear.' };
    x.sorteado = lista[Math.min(lista.length - 1, Math.floor(rng() * lista.length))].id;
  }
  MoedasPoe.gastar(estado, t.itemId, 1);
  (p.tatuagens ??= {})[n] = x;
  p.tatuagensVersao = (p.tatuagensVersao ?? 0) + 1;
  const sorteado = x.sorteado ? arvore().porId.get(x.sorteado) : null;
  return { ok: true, mudou: true, aviso: `${t.nome} aplicada${sorteado ? `: ${sorteado.nome}` : ''}.` };
}

/** Tira as tatuagens que não valem mais: o nó sumiu (a árvore mudou), não aceita mais (outra ascendência) ou passou do máximo. */
export function limpar(estado, p = estado?.passivas) {
  if (!p?.tatuagens || !poe()) return;
  const g = grafoDe(estado);
  let mudou = false;
  let n = 0;
  for (const [id, x] of Object.entries(p.tatuagens)) {
    const t = daSlug(x?.slug);
    const alvo = alvoDoNo(g.porId.get(id));
    const vale = t && casa(t, alvo) && (alvo.tipo !== 'ascendencia' || alvo.ascendencia === p.ascendencia) && (t.tipo !== 'proibida' || arvore().porId.has(String(x.sorteado))) && n < MAXIMO;
    if (vale) n++;
    else {
      delete p.tatuagens[id];
      mudou = true;
    }
  }
  if (mudou) p.tatuagensVersao = (p.tatuagensVersao ?? 0) + 1;
}

// ---------------------------------------------------------------- o que o nó tatuado dá
const TRADUZIDAS = new Map();
const efeitosDasLinhas = (linhas) => {
  const k = linhas.join('\n');
  if (!TRADUZIDAS.has(k)) TRADUZIDAS.set(k, linhas.map(traduzirLinha));
  return TRADUZIDAS.get(k);
};
/** A linha da Jornada: "+25 de Vida máxima por Tatuagem da Jornada do Corpo Alocada" → a linha-base ("+25 de Vida máxima"). */
const JORNADA = /^(.+?) por Tatuagem da Jornada d[oa] .+ Alocada$/;
const vezes = (ef, f) => (ef.tag ? { ...ef, dano: ef.dano * f } : ef.stat ? { ...ef, pct: ef.pct * f } : { ...ef, valor: ef.valor * f });

/** Os efeitos do nó tatuado (a lista no lugar dos dele) ou null (sem tatuagem que valha). */
export function efeitosDoNo(no, passivas) {
  if (!poe() || !no) return null;
  const x = passivas?.tatuagens?.[no.id];
  const t = daSlug(x?.slug);
  if (!t) return null;
  if (t.tipo === 'proibida') return [...(arvore().porId.get(String(x.sorteado))?.efeitos ?? [])];
  if (t.tipo === 'jornada') {
    const alocados = new Set(passivas?.alocados ?? []);
    const iguais = Object.entries(passivas.tatuagens).filter(([id, y]) => y?.slug === t.slug && alocados.has(id)).length;
    return t.linhas.flatMap((l) => {
      const m = JORNADA.exec(l);
      return m ? traduzirLinha(m[1]).efeitos.map((ef) => vezes(ef, iguais)) : traduzirLinha(l).efeitos;
    });
  }
  return efeitosDasLinhas(t.linhas).flatMap((r) => r.efeitos);
}

/** Para a tela da árvore: as tatuagens dos nós e os nós alocados que aceitam uma (o tipo). */
export function paraATela(estado) {
  const p = estado?.passivas;
  if (!poe() || !p) return {};
  const tatuagens = {};
  for (const [id, x] of Object.entries(p.tatuagens ?? {})) {
    const t = daSlug(x?.slug);
    if (!t) continue;
    const s = x.sorteado ? arvore().porId.get(String(x.sorteado)) : null;
    const traduzidas = s ? null : efeitosDasLinhas(t.linhas);
    tatuagens[id] = {
      slug: t.slug, nome: t.nome, itemId: t.itemId, icone: t.icone ?? null, linhas: t.linhas, estados: traduzidas ? traduzidas.map((r) => (r.efeitos.length ? r.estado : 'registrado')) : t.linhas.map(() => 'equivalente'),
      ...(s ? { sorteado: { id: s.id, nome: s.nome, textos: s.textos ?? [], estados: s.estados ?? [] } } : {}),
    };
  }
  const g = grafoDe(estado);
  const conquistados = nosConquistados(estado);
  const tatuaveis = {};
  for (const id of p.alocados ?? []) {
    const alvo = alvoDoNo(g.porId.get(id));
    if (!alvo || conquistados.has(id) || (alvo.tipo === 'ascendencia' && alvo.ascendencia !== p.ascendencia)) continue;
    tatuaveis[id] = alvo.tipo === 'ascendencia' ? { tipo: 'ascendencia' } : alvo;
  }
  return { tatuagens, tatuaveis, maximoDeTatuagens: MAXIMO };
}

// ---------------------------------------------------------------- o DROP (escolha sem fonte)
/**
 * Sem a liga Ancestral (no PoE as tatuagens vêm das tribos do Julgamento dos Ancestrais), uma FONTE SIMPLES (escolha sem fonte — registrada em
 * `docs/gemas-poe-progresso.md`, "100% — dados"): todo monstro do PoE tem a chance pela raridade dele; a tatuagem é sorteada pelos pesos (as comuns
 * mais, as Proibidas e as da Jornada raras) e a da Jornada só no nível de área 81+ (o DropLevel dela no poedb).
 */
export const DROP = Object.freeze({
  chancePorMonstro: Object.freeze({ normal: 0.0004, magico: 0.0012, raro: 0.006, unico: 0.03, boss: 0.15 }),
  pesos: Object.freeze({ comum: 100, proibida: 2, jornada: 4 }),
});
/** As tatuagens que caem de um bicho (`tipo`: normal, magico, raro, unico, boss; `nivel`: o nível da área): `[{ id, count }]`. */
export function dropDoMonstro(tipo, nivel = 1, rng = Math.random, fator = 1) {
  if (!itensPoeLigado()) return [];
  const chance = (DROP.chancePorMonstro[tipo] ?? DROP.chancePorMonstro.normal) * Math.max(0, Number(fator) || 0);
  if (!(rng() < chance)) return [];
  const lista = TATUAGENS.filter((t) => (t.nivelDoDrop ?? 1) <= (Number(nivel) || 1));
  const total = lista.reduce((s, t) => s + (DROP.pesos[t.tipo] ?? 0), 0);
  let r = rng() * total;
  for (const t of lista) {
    r -= DROP.pesos[t.tipo] ?? 0;
    if (r < 0) return [{ id: t.itemId, count: 1 }];
  }
  return lista.length ? [{ id: lista[lista.length - 1].itemId, count: 1 }] : [];
}

definirTatuagens({ efeitosDoNo, limpar, paraATela });
