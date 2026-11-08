// O SINTETIZADOR do PoE (08/11, balão 0 sem efeito — o dono: "Criar os sistemas", pelos Círculos: "Quando usado no Sintetizador, o novo item terá
// um Modificador de Arauto adicional"). Só no modo PoE.
//
// No PoE o Sintetizador junta TRÊS itens numa peça nova SINTETIZADA: a base de um deles, sem modificadores, com 1 a 3 IMPLÍCITOS do pool de
// Síntese (`pools/synthesis.json`) — mais implícitos quanto mais forte o que entrou. Aqui:
//   - entram 3 peças do PoE da mochila, identificadas e não corrompidas; Único, só o que tem a regra do Sintetizador (os Círculos);
//   - a peça nova: a base de uma das três (sorteada), Normal, o maior item level, `sintetizado`; os implícitos de Síntese do pool da classe dela
//     (como o Nebulis: a família e o tier com a mesma chance — o pool do PoE tem peso 0), 1 a 3 pela média de modificadores explícitos das
//     três (`regras.sintese.modsPorImplicito`) — só os que têm efeito no jogo (63 frases do pool ainda sem tradução ficam fora);
//   - cada Círculo que entra põe o MODIFICADOR DE ARAUTO dele (a linha "[Random Herald of … modifier]" sorteada nele) como implícito a mais;
//   - as três saem da mochila e a nova entra.
import { ITEM_CATALOG } from '../dados.mjs';
import * as Catalogo from './catalogo.mjs';
import * as Gerar from './gerar.mjs';
import * as Jogo from './jogo.mjs';

const erro = (e) => ({ ok: false, erro: e });
const CFG = () => Catalogo.REGRAS?.sintese ?? {};
const explicitos = (p) => [...(p.prefixos ?? []), ...(p.sufixos ?? []), ...(p.modificadores ?? [])].filter((m) => !/^\(/.test(m?.texto ?? ''));
/** A peça vale no Sintetizador? O motivo de não valer, ou null. */
export function motivo(peca) {
  const p = peca?.poe;
  if (!p) return 'Só peças do PoE.';
  if (p.mapa || p.frasco || Jogo.FRASCOS.includes(p.classe) || p.classe === 'Maps') return 'Mapas e frascos não entram no Sintetizador.';
  if (p.identificado === false) return 'Identifique a peça antes.';
  if (p.corrompido) return 'Peça corrompida não entra no Sintetizador.';
  if (p.espelhado) return 'Peça espelhada não entra no Sintetizador.';
  if (p.raridade === 'unico' && !(Number(p.af?.sintese_arauto_extra) > 0)) return 'Únicos não entram no Sintetizador (só os Círculos).';
  if (!paginaDa(p)) return 'Esta classe não tem implícitos de Síntese.';
  return null;
}
/** A página do pool de Síntese da base da peça. */
function paginaDa(p) {
  const b = Gerar.acharBase(Catalogo.catalogo(), p.base)?.base;
  return b ? Catalogo.poolEspecialDa('synthesis', p.classe, b.pool) : null;
}
/** Os implícitos de Síntese sorteados para a peça (`n` famílias distintas, com a mesma chance; o tier até o item level). */
function implicitosDeSintese(p, n, rng) {
  // (só os implícitos com efeito no jogo — `jogo.implicitoComEfeito`)
  const grupos = (paginaDa(p)?.implicitos ?? []).map((g) => ({ g, tiers: g.tiers.filter((t) => (t.ilvl ?? 1) <= (p.ilvl ?? 1) && Jogo.implicitoComEfeito(t)) })).filter((x) => x.tiers.length);
  const saida = [];
  while (saida.length < n && grupos.length) {
    const { g, tiers } = grupos.splice(Math.floor(rng() * grupos.length), 1)[0];
    const t = tiers[Math.floor(rng() * tiers.length)];
    saida.push({ familia: g.familia, tier: t.tier, nome: t.nome, ...Gerar.rolarTexto(t, rng), origem: 'synthesis', sintetizado: true });
  }
  return saida;
}

/** `{t:'sintetizar', indices:[a,b,c]}`: as 3 peças da mochila viram uma peça sintetizada. */
export function sintetizar(estado, indices, rng = Math.random) {
  if (!Catalogo.ligado()) return erro('O Sintetizador é do modo PoE.');
  const ids = [...new Set((Array.isArray(indices) ? indices : []).map((i) => Math.floor(Number(i))))];
  if (ids.length !== 3) return erro('Escolha 3 peças diferentes da mochila.');
  const inv = estado.inventory ?? [];
  const pecas = ids.map((i) => inv[i]);
  for (const peca of pecas) {
    const m = motivo(peca);
    if (m) return erro(`${peca?.poe?.nome ?? 'Peça'}: ${m}`);
  }
  const fonte = pecas[Math.floor(rng() * 3)].poe;
  const ilvl = Math.max(...pecas.map((x) => Number(x.poe.ilvl) || 1));
  const gerada = Gerar.gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: fonte.base, raridade: 'normal', ilvl, rng });
  if (!gerada || gerada.erro) return erro('O Sintetizador não conseguiu montar a peça.');
  const media = pecas.reduce((t, x) => t + explicitos(x.poe).length, 0) / 3;
  const n = Math.max(1, Math.min(3, Math.floor(media / Math.max(1, Number(CFG().modsPorImplicito) || 2))));
  const nova = Jogo.pecaDoJogo(gerada, Catalogo.REGRAS, rng);
  const p = nova.poe;
  // os implícitos de Síntese no lugar dos da base, e o Modificador de Arauto de cada Círculo
  const arautos = pecas.filter((x) => Number(x.poe.af?.sintese_arauto_extra) > 0)
    .map((x) => explicitos(x.poe).find((m) => m.sorteada && /Arauto/.test(m.texto ?? '')))
    .filter(Boolean)
    .map((m) => ({ ...m, sorteada: undefined, sintetizado: true, arauto: true }));
  p.implicitos = [...implicitosDeSintese(p, n, rng), ...arautos];
  p.sintetizado = true;
  Jogo.recalcular(nova);
  for (const i of [...ids].sort((a, b) => b - a)) inv.splice(i, 1);
  inv.push(nova);
  return { ok: true, notice: `Sintetizado: ${p.nome} — ${p.implicitos.map((m) => m.texto).join('; ')}.`, peca: nova };
}

/** O que a tela mostra: as peças da mochila e por que cada uma não entra. */
export function opcoes(estado) {
  return (estado.inventory ?? []).map((peca, indice) => (peca?.poe ? { indice, id: peca.id, nome: peca.poe.nome ?? ITEM_CATALOG[peca.id]?.name, motivo: motivo(peca) } : null)).filter(Boolean);
}
