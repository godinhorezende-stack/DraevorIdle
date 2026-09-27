// Premium e as hunts que ele abre — as regras do original, como o client e a
// Store real descrevem:
//
// - Premium ("Uma semana de premium: 10% de experiência e as hunts premium",
//   o texto da loja): +10% de exp (`Boosts.expDoBicho`, a linha "Premium" da
//   ficha) e a stamina acima de 39h vale x1,5 (`Stamina.fatorDeExp`). O client
//   lê `character.premiumAte` e conta sozinho o que falta (`contarOsPrazos`).
// - Hunts Vip (`catalog.vips`): "só pras pessoas com premium", mais o level da
//   hunt.
// - Especial Hunts: premium E o pergaminho de acesso (`PORTAS_DE_ACESSO`):
//   Instance Hunts (item 22771, level 800, `catalog.especiais`) e Divine Hunts
//   (item 55335, level 1000 — 1300 nas cinco novas —, `catalog.divinas`). Cada
//   pergaminho vale 24h e usar outro soma mais 24 (`ligarAcesso`). O client lê
//   `character.instance` / `character.divina` = `{restante, ate}` ou null.
//
// Acabou o premium (ou o acesso) no meio da caçada: o personagem volta para a
// cidade — senão uma caçada offline ficaria dias numa hunt premium de graça.
import { CATALOGO } from './dados.mjs';
import { PORTAS_DE_ACESSO } from '../engine/portas-de-acesso.mjs';

export const ACESSO_MS = 24 * 3_600_000;
const PORTA_DO_ITEM = new Map(Object.values(PORTAS_DE_ACESSO).map((p) => [p.item, p]));

export const ativo = (estado, agora = Date.now()) => (estado.premiumAte ?? 0) > agora;

/** Soma dias de premium (empilha, não substitui). */
export function adicionarDias(estado, dias) {
  estado.premiumAte = Math.max(estado.premiumAte ?? 0, Date.now()) + dias * 86_400_000;
}

// ------------------------------------------------------------ acessos

function acessos(estado) {
  estado.acessos ??= {};
  return estado.acessos;
}

/** `{restante, ate}` da porta, ou null — o `acessoView` que o client lê. */
export function acessoView(estado, porta, agora = Date.now()) {
  const ate = acessos(estado)[porta] ?? 0;
  return ate > agora ? { restante: ate - agora, ate } : null;
}

export const ehItemDeAcesso = (id) => PORTA_DO_ITEM.has(Number(id));

/**
 * Usar o pergaminho: recusa sem premium ou abaixo do level (e o item fica),
 * senão +24h a partir do que ainda sobrar.
 */
export function ligarAcesso(estado, itemId) {
  const porta = PORTA_DO_ITEM.get(Number(itemId));
  if (!porta) return { ok: false, erro: 'Isso não é um pergaminho de acesso.' };
  const falta = [
    ativo(estado) ? null : 'ser PREMIUM',
    (estado.level ?? 0) >= porta.level ? null : `estar no level ${porta.level} (você está no ${estado.level ?? 0})`,
  ].filter(Boolean);
  if (falta.length) return { ok: false, erro: `As ${porta.nome} pedem ${falta.join(' e ')}. O pergaminho continua na sua mochila — nada foi gasto.` };
  const lista = acessos(estado);
  lista[porta.id] = Math.max(lista[porta.id] ?? 0, Date.now()) + ACESSO_MS;
  const h = Math.round((lista[porta.id] - Date.now()) / 3_600_000);
  return { ok: true, notice: `${porta.nome} liberadas — ${h}h de acesso.` };
}

// ------------------------------------------------------------ as hunts

/** Que tranca a hunt tem: 'vip', 'instance', 'divina' ou null (hunt normal/boss). */
export function trancaDaHunt(hunt) {
  if (!hunt) return null;
  if (hunt.vip) return 'vip';
  if (hunt.divina || CATALOGO.divinas?.some((h) => h.id === hunt.id)) return 'divina';
  if (hunt.especial || CATALOGO.especiais?.some((h) => h.id === hunt.id)) return 'instance';
  return null;
}

/** Pode ENTRAR? `{ok}` ou `{ok:false, erro}` com a frase do que falta. */
export function podeEntrar(estado, hunt) {
  const tranca = trancaDaHunt(hunt);
  if (!tranca) return { ok: true };
  const falta = [];
  if (!ativo(estado)) falta.push('premium ativo');
  if (tranca !== 'vip' && !acessoView(estado, tranca)) falta.push(`o acesso das ${PORTAS_DE_ACESSO[tranca].nome} (o pergaminho, na Store)`);
  if ((estado.level ?? 0) < (hunt.level ?? 0)) falta.push(`level ${hunt.level}`);
  if (!falta.length) return { ok: true };
  return { ok: false, erro: `${hunt.name ?? 'Esta hunt'} pede ${falta.join(', ')}.` };
}

/** Ainda pode FICAR? (premium e acesso valendo — o level não cai). */
export function podeFicar(estado, tranca, agora = Date.now()) {
  if (!tranca) return true;
  if (!ativo(estado, agora)) return false;
  return tranca === 'vip' || !!acessoView(estado, tranca, agora);
}

export function motivoDaSaida(tranca) {
  return tranca === 'vip'
    ? 'Seu premium acabou — você voltou para a cidade. As Hunts Vip são só para premium.'
    : `Seu acesso às ${PORTAS_DE_ACESSO[tranca]?.nome ?? 'Especial Hunts'} (ou o premium) acabou — você voltou para a cidade.`;
}

/** Os campos do personagem: `premiumAte`, `instance`, `divina`. */
export function paraCliente(estado) {
  return {
    premiumAte: estado.premiumAte ?? 0,
    instance: acessoView(estado, 'instance'),
    divina: acessoView(estado, 'divina'),
  };
}
