// O DISPOSITIVO DE MAPAS (o endgame do PoE, dono 10/10 — só no jogo oficial): abre a peça de mapa da mochila (ou da bolsa) numa instância
// só sua, depois de vencer o chefe do Ato 10. Fica na aba Mapas da tela Campanha e nas Docas de Oriath (a cidade do Ato 10).
//
// Abrir é TUDO OU NADA, no servidor e numa chamada só (síncrona — nenhum outro comando do personagem entra no meio):
//   1. o dispositivo está liberado (o chefe do `dispositivo.atoQueLibera` vencido, em qualquer dificuldade) e não há outro mapa aberto;
//   2. a peça é um mapa, está onde a tela disse e é A MESMA que a tela mostrou (`assinatura`: id, base, raridade e mods);
//   3. a instância nasce (`Cacadas.entrar` com o mapa) — falhou, nada muda e a peça fica onde estava;
//   4. só então a peça sai da mochila (consumida) e o mapa fica aberto (`estado.mapas.aberto`, com os 6 portais).
// Com um mapa aberto não se abre outro (não há consumo em dobro nem dois mapas ao mesmo tempo); volta-se a ele (`voltar`) ou desiste-se
// dele (`abandonar` — a peça já foi gasta, como no PoE).
import { ligado } from './itens-poe/catalogo.mjs';
import * as Mapas from './itens-poe/mapas.mjs';
import * as MapasAreas from './itens-poe/mapas-areas.mjs';
import * as MapaAberto from './itens-poe/mapa-aberto.mjs';
import * as Campanha from './campanha.mjs';
import * as Cacadas from './cacadas.mjs';

const CFG = () => Mapas.DADOS.dispositivo ?? {};
/** O ato cujo chefe libera o dispositivo (mapas.json → dispositivo.atoQueLibera; 10). */
export const atoQueLibera = () => Number(CFG().atoQueLibera) || 10;
/** A cidade onde o dispositivo também fica (o atalho da tela). */
export const cidade = () => CFG().cidade ?? null;

/** O dispositivo está liberado para `estado`? (o chefe do ato vencido em qualquer dificuldade) */
export const liberado = (estado) => ligado() && Campanha.DIFICULDADES.some((d) => Campanha.bossVencido(estado, d, atoQueLibera()));
/** Por que o dispositivo está fechado (ou null). */
export function motivoFechado(estado) {
  if (!ligado()) return 'Os mapas são do jogo oficial.';
  if (liberado(estado)) return null;
  const chefe = Campanha.bossDoAto(atoQueLibera())?.nome ?? `o chefe do Ato ${atoQueLibera()}`;
  return `O Dispositivo de Mapas abre depois de vencer ${chefe} (Ato ${atoQueLibera()}).`;
}

const ONDES = ['inventory', 'pouch'];
/**
 * A ASSINATURA de uma peça de mapa (o que a tela manda de volta para provar que é a mesma peça): o id, a base, a raridade, a qualidade e os
 * textos dos mods. Duas peças iguais em tudo dão a mesma — e aí tanto faz qual sai.
 */
export function assinatura(peca) {
  const p = peca?.poe ?? {};
  const texto = JSON.stringify([peca?.id, p.base, p.raridade, p.qualidade ?? 0, (p.prefixos ?? []).map((m) => m.texto), (p.sufixos ?? []).map((m) => m.texto), !!p.corrompido]);
  let h = 5381;
  for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Os mapas que `estado` carrega (mochila e bolsa), para a tela: `[{ onde, indice, assinatura, id, tier, nivel, raridade, nome, peca }]`. */
export function mapasCarregados(estado) {
  const saida = [];
  for (const onde of ONDES) {
    (estado?.[onde] ?? []).forEach((peca, indice) => {
      if (!Mapas.ehMapa(peca)) return;
      const tier = Mapas.tierDaBase(peca.poe.base);
      saida.push({ onde, indice, assinatura: assinatura(peca), id: peca.id, tier, nivel: Mapas.nivelDoTier(tier), raridade: peca.poe.raridade ?? 'normal', nome: peca.poe.nome ?? `Mapa (Nível ${tier})`, peca });
    });
  }
  return saida.sort((a, b) => b.tier - a.tier || a.onde.localeCompare(b.onde) || a.indice - b.indice);
}

/**
 * Abre o mapa (`{ onde, indice, assinatura }` — o que a tela mostrou), entrando na instância dele. `mode`/`strategy`: os da caçada (como no
 * `startHunt`). `antes()`: roda depois das validações e antes de entrar (a sessão passa a saída da sala da party). `{ ok, erro? }`.
 */
export function abrir(estado, { onde = 'inventory', indice, assinatura: aDaTela, mode, strategy } = {}, { antes = null } = {}) {
  const fechado = motivoFechado(estado);
  if (fechado) return { ok: false, erro: fechado };
  const st = MapaAberto.doPersonagem(estado);
  if (st.aberto) return { ok: false, erro: 'Você já tem um mapa aberto: volte a ele ou abandone-o antes de abrir outro.' };
  if (!ONDES.includes(onde)) return { ok: false, erro: 'Esse mapa não está com você.' };
  const lista = estado[onde] ?? [];
  const i = Number(indice);
  const peca = Number.isInteger(i) && i >= 0 ? lista[i] : null;
  if (!Mapas.ehMapa(peca)) return { ok: false, erro: 'Isso não é um mapa.' };
  if (aDaTela == null || assinatura(peca) !== String(aDaTela)) return { ok: false, erro: 'Esse mapa mudou de lugar: abra a lista de novo.' };
  const tier = Mapas.tierDaBase(peca.poe.base);
  const huntId = MapasAreas.huntIdDoTier(tier);
  if (!huntId || !Mapas.nivelDoTier(tier)) return { ok: false, erro: `O Mapa (Nível ${tier}) não existe no jogo.` };
  antes?.();
  // O registro primeiro (a caçada precisa do id), desfeito se a instância não nascer: a peça só sai depois.
  const aberto = MapaAberto.abrir(estado, peca);
  const r = Cacadas.entrar(estado, { huntId, mode, strategy, mapa: aberto });
  if (!r.ok) {
    st.aberto = null;
    return r;
  }
  lista.splice(i, 1);
  return { ok: true, mapa: MapaAberto.abertoParaTela(estado) };
}

/**
 * Volta ao mapa aberto (depois de sair, de morrer com portal sobrando, de outra caçada): uma instância do mesmo tier com os monstros que
 * ficaram (`MapaAberto.retomar`). Sem portal, o mapa já acabou. `{ ok, erro? }`.
 */
export function voltar(estado, { mode, strategy } = {}, { antes = null } = {}) {
  const fechado = motivoFechado(estado);
  if (fechado) return { ok: false, erro: fechado };
  const a = estado?.mapas?.aberto;
  if (!a) return { ok: false, erro: 'Você não tem um mapa aberto.' };
  if (MapaAberto.cacadaDoAberto(estado)) return { ok: false, erro: 'Você já está no mapa.' };
  if (!(a.portais > 0)) return { ok: false, erro: 'Os portais desse mapa acabaram.' };
  const huntId = MapasAreas.huntIdDoTier(a.tier);
  if (!huntId) return { ok: false, erro: `O Mapa (Nível ${a.tier}) não existe no jogo.` };
  antes?.();
  const r = Cacadas.entrar(estado, { huntId, mode, strategy, mapa: a });
  if (!r.ok) return r;
  // Os monstros que ficaram (e o progresso da limpeza) voltam para a instância nova; sem nada guardado, ela fica como nasceu.
  MapaAberto.retomar(estado, estado.hunt);
  return { ok: true, mapa: MapaAberto.abertoParaTela(estado) };
}

/** Desiste do mapa aberto (a peça já foi gasta, como no PoE): sai dele se estiver lá e o fecha como `abandonado`. `{ ok }`. */
export function abandonar(estado) {
  const a = estado?.mapas?.aberto;
  if (!a) return { ok: false, erro: 'Você não tem um mapa aberto.' };
  if (MapaAberto.cacadaDoAberto(estado)) estado.hunt = null;
  MapaAberto.encerrar(estado, 'abandonado');
  return { ok: true };
}

/** O dispositivo para a tela (vai junto com a campanha): liberado, o motivo, o mapa aberto, os mapas carregados e as estatísticas. */
export function paraTela(estado) {
  if (!ligado()) return null;
  const st = MapaAberto.doPersonagem(estado);
  return {
    liberado: liberado(estado),
    motivo: motivoFechado(estado),
    ato: atoQueLibera(),
    cidade: cidade(),
    portais: MapaAberto.portaisPorMapa(),
    aberto: MapaAberto.abertoParaTela(estado),
    mapas: mapasCarregados(estado),
    estatisticas: { concluidos: st.concluidos, falhos: st.falhos, mortes: st.mortes, maiorTier: st.maiorTier, porTier: st.porTier, ultimo: st.ultimo },
    tiers: Mapas.TIERS,
  };
}
