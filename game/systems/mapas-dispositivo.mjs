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
import * as MapasLoop from './itens-poe/mapas-loop.mjs';
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

/**
 * Os mapas que `estado` carrega (mochila e bolsa), para a tela: `[{ onde, indice, assinatura, chave, id, tier, nivel, raridade, nome, peca }]`
 * (`chave`: a dos iguais — a tela junta num cartão "×N" e o loop usa — `MapasLoop.chaveDoMapa`).
 */
export function mapasCarregados(estado) {
  const saida = [];
  for (const onde of ONDES) {
    (estado?.[onde] ?? []).forEach((peca, indice) => {
      if (!Mapas.ehMapa(peca)) return;
      const tier = Mapas.tierDaPeca(peca);
      saida.push({ onde, indice, assinatura: assinatura(peca), chave: MapasLoop.chaveDoMapa(peca), id: peca.id, tier, nivel: Mapas.nivelDoTier(tier), raridade: peca.poe.raridade ?? 'normal', nome: peca.poe.nome ?? `Mapa (Nível ${tier})`, peca });
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
  const tier = Mapas.tierDaPeca(peca);
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

/*
 * ---- O LOOP DE MAPAS (dono, 27/10 — a fila em `itens-poe/mapas-loop.mjs`) ----
 * O jogador marca um ou vários grupos de mapas iguais (quantos de cada: todos, ou um número) e inicia: abre o primeiro da fila. Cada mapa
 * do loop CONCLUÍDO (limpou 100%) deixa o próximo pendente, e ele abre quando a caçada do concluído acaba (passada a pausa do aviso — o
 * tique, online e offline, chama `seguirLoop`), até a fila acabar. Abrir é SEMPRE o `abrir` acima (as mesmas travas: o dispositivo
 * liberado, nenhum outro mapa aberto, a peça conferida pela assinatura). Falhou (os portais), abandonou ou saiu por conta própria: para.
 */

/** Começa o loop (`grupos`: `[{ chave, quantos }]` — os da tela) e abre o primeiro mapa. `antes()`: o de `abrir`. `{ ok, erro?, notice? }`. */
export function iniciarLoop(estado, { grupos, mode } = {}, { antes = null } = {}) {
  const fechado = motivoFechado(estado);
  if (fechado) return { ok: false, erro: fechado };
  if (MapaAberto.doPersonagem(estado).aberto) return { ok: false, erro: 'Você já tem um mapa aberto: termine-o (ou abandone-o) antes de começar o loop.' };
  // (o loop que ficou para trás sem a caçada dele não trava o novo — `MapasLoop.semCacada`; a sessão o confere a cada tique)
  if (MapasLoop.semCacada(estado)) MapasLoop.parar(estado, 'O loop anterior ficou sem caçada: parou.');
  if (MapasLoop.doPersonagem(estado)) return { ok: false, erro: 'O loop de mapas já está rodando: pare-o antes de começar outro.' };
  const r = MapasLoop.criar(estado, grupos, { mode });
  if (!r.ok) return r;
  return seguirLoop(estado, { antes });
}

/**
 * Abre o próximo mapa da fila (o loop pendente): pelo mesmo `abrir` do botão. Sem mapa na fila, o loop acaba (concluído); o `abrir` recusou
 * (outro mapa aberto, o dispositivo fechou…), o loop para com o porquê. `{ ok, erro?, notice?, acabou? }`.
 */
export function seguirLoop(estado, { antes = null } = {}) {
  const loop = MapasLoop.doPersonagem(estado);
  if (!loop?.pendente) return { ok: false, erro: 'Nenhum loop de mapas esperando o próximo.' };
  const prox = MapasLoop.proxima(estado);
  if (!prox) {
    const n = loop.feitos;
    const notice = `Loop de mapas concluído: ${n} mapa${n === 1 ? '' : 's'}.`;
    MapasLoop.parar(estado, notice, { concluiu: true });
    return { ok: true, acabou: true, notice };
  }
  const r = abrir(estado, { onde: prox.onde, indice: prox.indice, assinatura: assinatura(prox.peca), mode: loop.mode }, { antes });
  if (!r.ok) {
    MapasLoop.parar(estado, `O loop parou: ${r.erro}`);
    return r;
  }
  MapasLoop.marcarAberto(estado, prox.grupo, estado.mapas.aberto.id);
  loop.seguir = true;
  const tela = MapasLoop.paraTela(estado);
  return { ok: true, notice: `Loop de mapas: ${prox.peca.poe?.nome ?? `Mapa (Nível ${prox.grupo.tier})`} (${tela.numero} de ${tela.total}).` };
}

/**
 * (27/10, revisão) Confere o loop contra a caçada de agora (`MapasLoop.semCacada`): a party troca `estado.hunt` sem passar por
 * `guardarAoSair` nem pelo fim da pausa do concluído, e sem isto o loop ficava "pendente" para sempre (a tela o mostrava rodando, o
 * "Iniciar loop" recusava). Você foi para outra caçada: o loop PARA, como ao sair por conta própria; a pausa acabou na cidade antes da hora:
 * o próximo abre. A sessão chama a cada tique (com ou sem caçada). Devolve o aviso para o jogador, ou null (nada mudou).
 */
export function conferirLoop(estado) {
  const o = MapasLoop.semCacada(estado);
  if (o === 'parar') {
    MapasLoop.parar(estado, 'Você foi para outra caçada: o loop parou.');
    return 'Você foi para outra caçada: o loop de mapas parou.';
  }
  if (o === 'seguir') {
    const r = seguirLoop(estado);
    return r.ok ? r.notice : `O loop de mapas parou: ${r.erro}`;
  }
  return null;
}

/** Apaga o aviso do último loop (por que ele parou). `{ ok }`. */
export function dispensarFimDoLoop(estado) {
  MapasLoop.dispensarFim(estado);
  return { ok: true };
}

/** Para o loop (o mapa aberto continua aberto: só a fila acaba). `{ ok, erro?, notice? }`. */
export function pararLoop(estado) {
  if (!MapasLoop.doPersonagem(estado)) return { ok: false, erro: 'O loop de mapas não está rodando.' };
  MapasLoop.parar(estado, 'Você parou o loop.');
  return { ok: true, notice: 'Loop de mapas parado: o mapa aberto continua aberto.' };
}

/** O dispositivo para a tela (vai junto com a campanha): liberado, o motivo, o mapa aberto, os mapas carregados, o loop e as estatísticas. */
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
    loop: MapasLoop.paraTela(estado),
    estatisticas: { concluidos: st.concluidos, falhos: st.falhos, mortes: st.mortes, maiorTier: st.maiorTier, porTier: st.porTier, ultimo: st.ultimo },
    tiers: Mapas.TIERS,
  };
}
