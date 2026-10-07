// Buff Power — os três itens da Store, com as regras que a loja, o balão
// e a ficha do client descrevem (`efeitos.buffPower`, character-template.json):
//
// - Comprar é o ITEM (vai para a Store Inbox) e ele NUNCA some. Ligar é clicar
//   nele na mochila: cada clique cobra o preço da hora (`custo`: ouro — bolso
//   primeiro, banco no que faltar — ou Draevor Coins) e soma 1 hora, até o
//   `teto` de 10 horas acumuladas.
// - Buff Power: +3000 HP, +3000 Mana, +15% de dano crítico, +10% de life leech
//   e +10% de mana leech (`Ficha.combate`).
// - Buff Power Exp: +50% de experiência — entra como a fonte 'buff-power' de
//   `efeitos.exp.fontes`, e soma com as outras (`Boosts.expDoBicho`).
// - Buff Power Loot: +50% de loot, em caverna e em boss (a chance de cada drop
//   x1,5 — `fatorDeLoot`).
//
// O relógio corre CAÇANDO (online e offline), como o XP Boost da loja: o bônus
// só vale na caçada, e parado na cidade ele não se perde.
import { CHARACTER_TEMPLATE } from './dados.mjs';
import { ligado as itensPoeLigado } from './itens-poe/catalogo.mjs';

// No modo PoE o Buff Power NÃO EXISTE (dono, 07/10: "esse buff power não vai existir"): não está na Store, não liga, nenhum bônus vale e quem
// estava com ele ligado perde os +3000 de vida/mana na hora (`sincronizarVida`). Os itens que alguém já tenha ficam, sem efeito.
const SEM_BUFF_POWER = () => itensPoeLigado();

const LINHAS = CHARACTER_TEMPLATE.efeitos.buffPower; // [{id, item, nome, resumo, cor, custo, teto}]
const HORA_MS = 3_600_000;
const VIDA_E_MANA = 3000;

const linhaDoItem = (itemId) => LINHAS.find((l) => l.item === Number(itemId)) ?? null;
export const ehBuffPower = (itemId) => !!linhaDoItem(itemId);

function tempos(estado) {
  estado.buffPowerMs ??= {};
  return estado.buffPowerMs;
}

/** Quanto ainda sobra do buff `id` ('poder' | 'exp' | 'loot'), em ms. */
export const restante = (estado, id) => (SEM_BUFF_POWER() ? 0 : tempos(estado)[id] ?? 0);
export const ativo = (estado, id) => restante(estado, id) > 0;

function pagar(estado, custo) {
  const quanto = custo?.quanto ?? 0;
  if (custo?.moeda === 'coins') {
    if ((estado.coins ?? 0) < quanto) return `Faltam ${(quanto - (estado.coins ?? 0)).toLocaleString('pt-BR')} Draevor Coins.`;
    estado.coins -= quanto;
    return null;
  }
  const total = (estado.gold ?? 0) + (estado.bank ?? 0);
  if (total < quanto) return `Faltam ${(quanto - total).toLocaleString('pt-BR')} de ouro (bolso + banco).`;
  const doBolso = Math.min(estado.gold ?? 0, quanto);
  estado.gold = (estado.gold ?? 0) - doBolso;
  estado.bank = (estado.bank ?? 0) - (quanto - doBolso);
  return null;
}

/** `usar` no item: cobra a hora e soma 1h, até o teto. O item fica. */
export function ligar(estado, itemId) {
  if (SEM_BUFF_POWER()) return { ok: false, erro: 'O Buff Power não existe no modo PoE.' };
  const linha = linhaDoItem(itemId);
  if (!linha) return { ok: false, erro: 'Isso não é um Buff Power.' };
  const lista = tempos(estado);
  const agora = lista[linha.id] ?? 0;
  const teto = linha.teto ?? 10 * HORA_MS;
  if (agora + HORA_MS > teto) {
    return { ok: false, erro: `${linha.nome} já tem ${Math.floor(agora / HORA_MS)}h acumuladas — o teto é ${Math.round(teto / HORA_MS)}h.` };
  }
  const falta = pagar(estado, linha.custo);
  if (falta) return { ok: false, erro: falta };
  lista[linha.id] = agora + HORA_MS;
  sincronizarVida(estado);
  const h = Math.round(lista[linha.id] / HORA_MS);
  return { ok: true, notice: `${linha.nome} ligado: ${linha.resumo}. ${h}h acumulada${h > 1 ? 's' : ''}.` };
}

/** Gasta `ms` de caçada de cada buff ligado. */
export function consumir(estado, ms) {
  if (!(ms > 0) || !estado.buffPowerMs) return;
  for (const id of Object.keys(estado.buffPowerMs)) estado.buffPowerMs[id] = Math.max(0, estado.buffPowerMs[id] - ms);
  sincronizarVida(estado);
}

/**
 * Os +3000 de vida e mana entram no máximo enquanto o Buff Power durar e saem
 * quando ele acaba (a vida atual não passa do novo máximo). `buffVida` marca que
 * estão aplicados — `subirDeLevel` refaz o máximo pela fórmula e soma de novo.
 */
export function sincronizarVida(estado) {
  const quer = ativo(estado, 'poder');
  if (quer === !!estado.buffVida) return;
  const sinal = quer ? 1 : -1;
  estado.maxHp = (estado.maxHp ?? 0) + sinal * VIDA_E_MANA;
  estado.maxMana = (estado.maxMana ?? 0) + sinal * VIDA_E_MANA;
  estado.hp = Math.min(estado.hp ?? 0, estado.maxHp);
  estado.mana = Math.min(estado.mana ?? 0, estado.maxMana);
  estado.buffVida = quer;
}

export const bonusDeVida = (estado) => (estado.buffVida ? VIDA_E_MANA : 0);

/** O que o Buff Power soma na ficha de combate. */
export function bonusDeCombate(estado) {
  if (!ativo(estado, 'poder')) return { critMultiplier: 0, lifeLeech: 0, manaLeech: 0 };
  return { critMultiplier: 0.15, lifeLeech: 0.1, manaLeech: 0.1 };
}

/** x1,5 na chance de cada drop com o Buff Power Loot. */
export const fatorDeLoot = (estado) => (ativo(estado, 'loot') ? 1.5 : 1);

/** A fonte de exp para `efeitos.exp.fontes` (ou null). */
export function fonteDeExp(estado) {
  const ms = restante(estado, 'exp');
  return ms > 0 ? { fonte: 'buff-power', percent: 50, restante: ms } : null;
}

/** `efeitos.buffPower`: as três linhas com o relógio e quantos itens a pessoa tem. */
export function paraCliente(estado) {
  if (SEM_BUFF_POWER()) return [];
  const quantos = (item) =>
    [...(estado.inventory ?? []), ...(estado.storeInbox ?? []), ...((estado.deposito ?? []).find((c) => c.chegadas)?.itens ?? [])].filter((p) => p.id === item).reduce((a, p) => a + (p.count ?? 1), 0);
  return LINHAS.map((linha) => ({ ...linha, restante: restante(estado, linha.id), tem: quantos(linha.item) }));
}
