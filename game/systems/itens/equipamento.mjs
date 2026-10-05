// A VALIDAÇÃO CENTRAL do equipamento (dono, 03/10) — a regra de qual item entra em qual slot e de qual munição vale para qual arma. O servidor é a
// autoridade: todo caminho que veste uma peça (arrastar e soltar, clique, equipamento rápido) passa por `validarEquipar`. O cliente só antecipa a
// mesma regra (destaca os slots certos) e nunca é a única barreira.
//
// A categoria do item é ESTRUTURADA: o campo `slot` do catálogo (`item-catalog.json`), nunca o nome nem o ícone. Matriz de compatibilidade real do jogo:
//   head → capacete · neck → amuleto · body → armadura · legs → calça · feet → bota · ring → anel
//   weapon → arma (espada, machado, clava, distância, wand, rod) · shield → escudo, spellbook e aljava · ammo → munição e acessórios de munição (trinket, tocha)
//   backpack → mochila (container) · gloves → luvas (só com o sistema de itens do PoE ligado: nenhum item do Draevor tem esse slot)
// Cada peça só entra no slot que o catálogo lhe dá.
import { ITEM_CATALOG } from '../dados.mjs';
import { ligado as itensPoeLigado } from '../itens-poe/catalogo.mjs';

/** Os slots reais do jogo (os de `equipment`). `gloves` só existe com o sistema de itens do PoE ligado (ITENS_POE=1, só local). */
export const SLOTS_DE_EQUIPAMENTO = ['head', 'neck', 'body', 'legs', 'feet', 'ring', 'weapon', 'shield', 'ammo', 'backpack', ...(itensPoeLigado() ? ['gloves'] : [])];

/** A frase de recusa por slot errado (a única mensagem de "compatibilidade": nada de penalidade de dano). */
export const ERRO_DE_SLOT = 'Este item não pode ser equipado neste slot.';

/*
 * Munição de arco e besta sem a marca do tipo no catálogo (`simple arrow`, `burst arrow`): o tipo sai do nome ("... arrow" / "... bolt") — os dados do
 * catálogo não mudam, a marca entra na memória uma vez, aqui. Sem ela a flecha nunca valia para nenhum arco.
 */
for (const meta of Object.values(ITEM_CATALOG)) {
  if (meta.slot !== 'ammo' || meta.ammo || meta.type !== 'ammunition') continue;
  if (/ arrow$/.test(meta.name ?? '')) meta.ammo = 'arrow';
  else if (/ bolt$/.test(meta.name ?? '')) meta.ammo = 'bolt';
}

/** O slot a que o item pertence (o do catálogo), ou `null` se não é equipável. */
export const slotDoItem = (meta) => (meta?.slot && SLOTS_DE_EQUIPAMENTO.includes(meta.slot) ? meta.slot : null);

/** O item pode ir para este slot? (só a categoria; os requisitos são do `validarEquipar`) */
export const cabeNoSlot = (meta, slot) => !!slotDoItem(meta) && slotDoItem(meta) === slot;

/** A arma usa munição? (só as que o catálogo marca com o tipo aceito: arco e besta — arma de arremesso, wand e rod não usam) */
export const usaMunicao = (meta) => !!meta?.ammo;

/** A munição `municao` serve para a arma `arma`? (o tipo aceito pela arma é o da munição) */
export const municaoServe = (arma, municao) => usaMunicao(arma) && !!municao && municao.slot === 'ammo' && municao.ammo === arma.ammo;

/** Quer atacar com o golpe da arma e a arma pede munição que não está na mão? (o ataque não sai; a magia não usa munição) */
export function faltaMunicao(estado) {
  const arma = ITEM_CATALOG[estado?.equipment?.weapon?.id];
  if (!usaMunicao(arma)) return false;
  return !municaoServe(arma, ITEM_CATALOG[estado.equipment?.ammo?.id]);
}

/**
 * A regra única de equipar. Devolve `{ ok: true }` ou `{ ok: false, erro }` — SEM mexer em nada: quem chama só muda o estado depois do `ok`.
 * `requisitos(meta)` devolve a frase de quem falta (level, atributos) ou `null`.
 */
export function validarEquipar(estado, meta, destino, requisitos = () => null) {
  if (!meta || !slotDoItem(meta)) return { ok: false, erro: 'Isso não se equipa.' };
  if (!SLOTS_DE_EQUIPAMENTO.includes(destino)) return { ok: false, erro: 'Esse slot não existe.' };
  if (!cabeNoSlot(meta, destino)) return { ok: false, erro: ERRO_DE_SLOT };
  const falta = requisitos(meta);
  if (falta) return { ok: false, erro: falta };
  return { ok: true };
}

/**
 * Peças vestidas no slot ERRADO (de antes desta regra: o servidor aceitava o slot que o cliente mandava): voltam para a mochila, sem perda. Roda na
 * entrada; devolve os nomes. `devolver(estado, peca)` é quem põe na mochila (preserva tier, afixos e gemas).
 */
export function recolherPecasNoSlotErrado(estado, devolver) {
  const eq = estado.equipment ?? {};
  const saiu = [];
  for (const [slot, peca] of Object.entries(eq)) {
    if (!peca) continue;
    const meta = ITEM_CATALOG[peca.id];
    if (meta && cabeNoSlot(meta, slot)) continue;
    eq[slot] = null;
    devolver(estado, peca);
    saiu.push(meta?.name ?? `item ${peca.id}`);
  }
  return saiu;
}
