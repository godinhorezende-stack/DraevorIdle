import { MONTARIAS_REAIS } from './dados.mjs';
import * as Tarefas from './tarefas.mjs';
import * as Entregas from './entregas.mjs';
// Aba de Aparência da ficha: quais outfits e montarias o personagem tem, e
// trocar de roupa/montaria. Funções puras sobre `estado` — quem manda a
// resposta pro cliente é `sessao.mjs`.

/** "Knight" a partir de "knight" — mesmo nome mostrado na criação de personagem. */
const nomeDaVocacao = (vocation) => vocation.charAt(0).toUpperCase() + vocation.slice(1);

/**
 * `send({t:'mounts'})` — a aba de Aparência trava em "carregando..." até isto
 * responder (ver `renderAppearance` em `panels.mjs`). Nunca tinha handler:
 * ninguém owned nada, e a tela nunca saía do loading.
 *
 * Sem loja implementada ainda, o único outfit que existe de verdade é o da
 * vocação — é o que `estadoInicialPersonagem` já veste. Nenhuma montaria:
 * elas só vêm de compra na Store, que este servidor ainda não tem.
 */
/*
 * As montarias e outfits REAIS (`MONTARIAS_REAIS`, capturado): os outfits
 * básicos de cada sexo vêm liberados de graça (os `owned` da captura — Citizen,
 * Hunter, Mage, Knight...); o resto se libera comprando na Store
 * (`estado.lojaOutfits`/`lojaMontarias`, ver `loja.mjs`).
 */
const OUTFITS_GRATIS = new Set(MONTARIAS_REAIS.outfits.filter((o) => o.owned).map((o) => o.look));

const NOME_DO_OUTFIT = new Map(MONTARIAS_REAIS.outfits.map((o) => [o.look, o.name]));
/** Cada peça da coleção vale +0,3% de chance de crítico (o texto do cliente). */
export const CRITICO_POR_PECA = 0.003;

/**
 * A Coleção: cada aparência e cada montaria que o personagem TEM (fora os
 * outfits de graça) — `derived.collection` {pieces, critChance}. O Zoros no
 * original: Blade Dancer (loja) + Gorgon Hydra = 2 peças, critChance 0,006.
 * Conta direto das listas do personagem (curtas), e não varrendo os 510
 * outfits/montarias: a ficha de combate chama isto várias vezes por segundo.
 */
export function colecao(estado) {
  const outfits = new Set();
  for (const look of estado.lojaOutfits ?? []) if (!OUTFITS_GRATIS.has(look)) outfits.add(NOME_DO_OUTFIT.get(look) ?? look);
  const montarias = new Set([
    ...(estado.lojaMontarias ?? []),
    ...(estado.tarefas?.montarias ?? []),
    ...(estado.montariasEntregues ?? []),
  ]);
  const pieces = outfits.size + montarias.size;
  return { pieces, critChance: Math.round(pieces * CRITICO_POR_PECA * 1e6) / 1e6 };
}

export function temOutfit(estado, look) {
  return OUTFITS_GRATIS.has(look) || look === estado.outfit?.type || (estado.lojaOutfits ?? []).includes(look) || Object.hasOwn(estado.outfitsDaClasse ?? {}, String(look));
}

/** Da Store, da task de montaria (`Tarefas`) ou da entrega (`Entregas`). */
export function temMontaria(estado, id) {
  return (estado.lojaMontarias ?? []).includes(id) || Tarefas.montariaGanha(estado, id) || Entregas.montariaEntregue(estado, id);
}

/** Os addons que o personagem TEM de um outfit (máscara 1|2): os das entregas, e 3 no outfit da loja. */
export function addonsQueTem(estado, look) {
  const daLoja = (estado.lojaOutfits ?? []).includes(look) ? 3 : 0;
  // O outfit inicial da classe vem com os addons que a classe definiu.
  const daClasse = Number(estado.outfitsDaClasse?.[look] ?? 0);
  return daLoja | daClasse | Entregas.addonsDoLook(estado, look);
}

export function montariasEOutfits(estado) {
  return {
    outfits: MONTARIAS_REAIS.outfits.map((o) => ({
      ...o,
      owned: temOutfit(estado, o.look),
      // Os addons que ele TEM (entregas; os da captura para o que já vinha com eles).
      addons: Math.max(addonsQueTem(estado, o.look), o.addons ?? 0),
    })),
    mounts: MONTARIAS_REAIS.mounts.map((m) => ({
      ...m,
      owned: temMontaria(estado, m.id),
      active: estado.outfit?.mount === m.look,
    })),
  };
}

export function salvarAparencia(estado, { outfit }) {
  if (!outfit || !temOutfit(estado, outfit.type)) return { ok: false, erro: 'Você não tem este outfit.' };
  const { type, head, body, legs, feet } = outfit;
  // Vestir os addons que tem (os das entregas); pedir um que não tem cai fora.
  const addons = (outfit.addons ?? 0) & Math.max(addonsQueTem(estado, type), MONTARIAS_REAIS.outfits.find((o) => o.look === type)?.addons ?? 0);
  Object.assign(estado.outfit, { type, head, body, legs, feet, addons });
  return { ok: true };
}

/**
 * `send({t:'mount', id})` — troca de montaria. Como `montariasEOutfits`
 * nunca lista nenhuma dona, qualquer `id` diferente de "tirar a montaria"
 * (0) é recusado de verdade, e não um zero silencioso.
 */
export function equiparMontaria(estado, { id }) {
  if (id === 0 || id == null) {
    estado.outfit.mount = 0;
    return { ok: true };
  }
  const montaria = MONTARIAS_REAIS.mounts.find((m) => m.id === id);
  if (!montaria || !temMontaria(estado, id)) return { ok: false, erro: 'Você não tem essa montaria.' };
  estado.outfit.mount = montaria.look;
  return { ok: true };
}
