// Os pedidos do cliente à árvore de passivas (`{t:'passivas', action, ...}`) e
// o que precisa ser refeito depois de cada mudança: a vida/mana máximas (os
// nós de Life/Mana/STR/INT), os vessels do Gem Atelier e a ficha.
//
// O cliente só PEDE: `alocar` um nó (ou um caminho, nó por nó, cada um
// validado), `respec` (uns nós, com ou sem os que ficariam ilhados, ou tudo),
// `planoRespec` (o que sairia e quanto custa, sem tirar nada). Quem decide é
// `passivas/arvore.mjs`.
import * as Passivas from './arvore.mjs';
import * as Afixos from '../afixos.mjs';
import * as Gemas from '../gemas.mjs';
import * as Ficha from '../ficha.mjs';

/** Depois de a árvore mudar: vida/mana máximas, vessels e a ficha. */
export function depoisDeMudar(estado) {
  Ficha.invalidar(estado);
  Afixos.sincronizarMaximos(estado);
  Gemas.sincronizarMaximos(estado);
  Ficha.invalidar(estado);
}

/**
 * Um pedido. Devolve `{ ok, erro?, motivo?, mudou?, plano?, aviso? }`.
 * `alocar` com `ids` (um caminho): aloca na ordem e para no primeiro que não
 * pode — os de antes ficam (cada um já foi validado sozinho).
 */
export function comando(estado, m, emCacada = false) {
  Passivas.garantir(estado);
  const acao = m?.action ?? 'ver';
  if (acao === 'ver' || acao === 'arvore') return { ok: true };
  if (acao === 'ascender') {
    // A ascendência do PoE (árvore do PoE, incremento 4e): escolhida no primeiro ponto, uma vez.
    const r = Passivas.ascender(estado, String(m.ascendencia ?? ''));
    if (r.ok) depoisDeMudar(estado);
    return r;
  }
  if (acao === 'alocar') {
    const ids = Array.isArray(m.ids) ? m.ids.slice(0, 200).map(String) : [String(m.id ?? '')];
    let feitos = 0;
    let falha = null;
    for (const id of ids) {
      const r = Passivas.alocar(estado, id);
      if (!r.ok) {
        falha = r;
        break;
      }
      feitos++;
    }
    if (feitos) depoisDeMudar(estado);
    if (falha && !feitos) return falha;
    return { ok: true, mudou: feitos > 0, feitos, ...(falha ? { aviso: `${feitos} nó(s) alocado(s); o próximo não: ${falha.erro}` } : {}) };
  }
  if (acao === 'planoRespec') {
    const plano = Passivas.planoDeRespec(estado, pedidoDeRespec(m), emCacada);
    return plano.ok ? { ok: true, plano } : plano;
  }
  if (acao === 'respec') {
    const r = Passivas.respec(estado, pedidoDeRespec(m), emCacada);
    if (r.ok) depoisDeMudar(estado);
    return r;
  }
  return { ok: false, erro: 'Pedido desconhecido.', motivo: 'DESCONHECIDO' };
}

const pedidoDeRespec = (m) => ({ ids: Array.isArray(m.ids) ? m.ids.slice(0, 500).map(String) : m.id != null ? [String(m.id)] : [], tudo: m.tudo === true, junto: m.junto === true });
