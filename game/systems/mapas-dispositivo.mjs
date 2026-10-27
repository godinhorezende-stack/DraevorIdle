// O DISPOSITIVO DE MAPAS (o endgame do PoE, dono 10/10 — só no jogo oficial): abre a peça de mapa da mochila, da bolsa ou do depósito do
// personagem (dono 27/10: as caixas numeradas e as Chegadas; o Baú da Conta não — `MapasLoop.fontesDeMapas`) numa instância só sua,
// depois de vencer o chefe do Ato 10. Fica na aba Mapas da tela Campanha e nas Docas de Oriath (a cidade do Ato 10).
//
// Abrir é TUDO OU NADA, no servidor e numa chamada só (síncrona — nenhum outro comando do personagem entra no meio):
//   1. o dispositivo está liberado (o chefe do `dispositivo.atoQueLibera` vencido, em qualquer dificuldade) e não há outro mapa aberto;
//   2. a peça é um mapa, está onde a tela disse e é A MESMA que a tela mostrou (`assinatura`: id, base, raridade e mods);
//   3. a instância nasce (`Cacadas.entrar` com o mapa) — falhou, nada muda e a peça fica onde estava;
//   4. só então a peça sai de onde estava (consumida; a caixa do depósito acerta a contagem "N/100") e o mapa fica aberto
//      (`estado.mapas.aberto`, com os 6 portais).
// Com um mapa aberto não se abre outro (não há consumo em dobro nem dois mapas ao mesmo tempo); volta-se a ele (`voltar`) ou desiste-se
// dele (`abandonar` — a peça já foi gasta, como no PoE).
import { createHash } from 'node:crypto';
import { ligado } from './itens-poe/catalogo.mjs';
import * as Mapas from './itens-poe/mapas.mjs';
import * as MapasAreas from './itens-poe/mapas-areas.mjs';
import * as MapaAberto from './itens-poe/mapa-aberto.mjs';
import * as MapasLoop from './itens-poe/mapas-loop.mjs';
import * as Campanha from './campanha.mjs';
import * as Cacadas from './cacadas.mjs';
import * as Deposito from './deposito.mjs';

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

/** As fontes de mapas (`MapasLoop.fontesDeMapas`), com o depósito acertado antes (`Deposito.garantir`: a marca das Chegadas e o Baú da Conta fora). */
function fontes(estado) {
  if (Array.isArray(estado?.deposito)) Deposito.garantir(estado);
  return MapasLoop.fontesDeMapas(estado);
}

/** Quantos mapas há no Baú da Conta (a tela avisa que de lá não abre: mova para o seu depósito). */
export function mapasNoBauDaConta(estado) {
  return (estado?.bauDaConta?.itens ?? []).reduce((n, p) => n + (Mapas.ehMapa(p) ? p.count ?? 1 : 0), 0);
}

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
 * Os mapas que `estado` tem (mochila, bolsa e depósito), para a tela: `[{ onde, origem, caixa, indice, assinatura, chave, id, tier, nivel,
 * raridade, nome, peca }]` (`chave`: a dos iguais — a tela junta num cartão "×N" e o loop usa — `MapasLoop.chaveDoMapa`; `origem`:
 * 'mochila' | 'bolsa' | 'deposito'; `caixa`: o nome da caixa do depósito). Do tier maior para o menor; no mesmo tier, na ordem em que o
 * Dispositivo usa (a mochila, a bolsa, o depósito) — o primeiro de cada grupo é o que o "Abrir mapa" abre.
 */
export function mapasCarregados(estado) {
  const saida = [];
  fontes(estado).forEach(({ onde, origem, lista, caixa }, ordem) => {
    lista.forEach((peca, indice) => {
      if (!Mapas.ehMapa(peca)) return;
      const tier = Mapas.tierDaPeca(peca);
      saida.push({ onde, origem, ...(caixa ? { caixa: caixa.nome ?? null } : {}), indice, ordem, assinatura: assinatura(peca), chave: MapasLoop.chaveDoMapa(peca), id: peca.id, tier, nivel: Mapas.nivelDoTier(tier), raridade: peca.poe.raridade ?? 'normal', nome: peca.poe.nome ?? `Mapa (Nível ${tier})`, peca });
    });
  });
  saida.sort((a, b) => b.tier - a.tier || a.ordem - b.ordem || a.indice - b.indice);
  for (const m of saida) delete m.ordem;
  return saida;
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
  // O `onde` só vale se for uma fonte que EXISTE (a mochila, a bolsa, uma caixa do depósito do personagem): nunca uma caixa inventada.
  const fonte = typeof onde === 'string' ? fontes(estado).find((f) => f.onde === onde) : null;
  if (!fonte) return { ok: false, erro: 'Esse mapa não está com você.' };
  const { lista, caixa } = fonte;
  const i = Number(indice);
  const peca = Number.isInteger(i) && i >= 0 ? lista[i] : null;
  if (!Mapas.ehMapa(peca)) return { ok: false, erro: 'Isso não é um mapa.' };
  if (aDaTela == null || assinatura(peca) !== String(aDaTela)) return { ok: false, erro: 'Esse mapa mudou de lugar: abra a lista de novo.' };
  const tier = Mapas.tierDaPeca(peca);
  const huntId = MapasAreas.huntIdDoTier(tier);
  if (!huntId || !Mapas.nivelDoTier(tier)) return { ok: false, erro: `O Mapa (Nível ${tier}) não existe no jogo.` };
  antes?.();
  // O registro primeiro (a caçada precisa do id), desfeito se a instância não nascer: a peça só sai depois. (Um mapa empilhado — não
  // deveria haver: a peça do PoE não empilha — gasta UM: o aberto leva uma cópia de uma e a pilha fica com o resto.)
  const pilha = Number(peca.count) > 1;
  const aberto = MapaAberto.abrir(estado, pilha ? { ...peca, count: 1 } : peca);
  const r = Cacadas.entrar(estado, { huntId, mode, strategy, mapa: aberto });
  if (!r.ok) {
    st.aberto = null;
    return r;
  }
  if (pilha) peca.count -= 1;
  else lista.splice(i, 1);
  // A caixa do depósito: a contagem "N/100" (`tipos`) acompanha a lista, como no `take` do depósito. E a `rev` da caixa sobe (27/10,
  // revisão): a peça saiu do MEIO dela sem o jogador mexer (o loop abre sozinho, no tique), as de trás andaram uma casa, e o "tirar" da tela
  // que ainda mostra a caixa de antes acertaria outra peça do mesmo id (todo mapa do tier tem o mesmo) — `Deposito.comando` recusa o
  // pedido que traz a `rev` velha.
  if (caixa) {
    caixa.tipos = caixa.itens.length;
    caixa.rev = (Number(caixa.rev) || 0) + 1;
  }
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

/**
 * A lista para a TELA (27/10, revisão): a `peca` inteira (afixos, textos, recompensas: uns 2 KB) vai SÓ no primeiro de cada grupo de iguais
 * — é o único que a tela desenha (o balão e o resumo do cartão: `mapas-dispositivo.mjs` do client). Com o depósito na lista, centenas de
 * mapas iguais mandavam centenas de cópias da mesma peça.
 */
function mapasParaTela(mapas) {
  const vistos = new Set();
  return mapas.map((m) => {
    if (!vistos.has(m.chave)) {
      vistos.add(m.chave);
      return m;
    }
    const { peca, ...resto } = m;
    return resto;
  });
}

/**
 * A VERSÃO da lista de mapas (`mapasCarregados`): muda quando um mapa entra, sai, muda de lugar ou muda de peça (o `onde`, o `indice`, a
 * `assinatura` e a `chave` de cada um).
 */
export function versaoDosMapas(mapas) {
  return createHash('sha256').update(JSON.stringify((mapas ?? []).map((m) => [m.onde, m.indice, m.assinatura, m.chave]))).digest('base64url').slice(0, 22);
}

/**
 * O dispositivo para a tela (vai junto com a campanha): liberado, o motivo, o mapa aberto, os mapas carregados (e a `versaoDosMapas`), o
 * loop e as estatísticas. `versaoDaTela`: a versão da lista que a tela já tem (o `{t:'campanha'}` que a tela aberta repete a cada 8 s) —
 * igual à de agora, a lista não vai de novo (`mapas: null`, `mapasIguais: true`; a tela continua com a dela). (27/10, revisão: com o
 * depósito, a lista podia ter centenas de mapas e ia inteira a cada pergunta.)
 */
export function paraTela(estado, { versaoDaTela = null } = {}) {
  if (!ligado()) return null;
  const st = MapaAberto.doPersonagem(estado);
  const mapas = mapasCarregados(estado);
  const versao = versaoDosMapas(mapas);
  const iguais = versaoDaTela != null && String(versaoDaTela) === versao;
  return {
    liberado: liberado(estado),
    motivo: motivoFechado(estado),
    ato: atoQueLibera(),
    cidade: cidade(),
    portais: MapaAberto.portaisPorMapa(),
    aberto: MapaAberto.abertoParaTela(estado),
    mapas: iguais ? null : mapasParaTela(mapas),
    ...(iguais ? { mapasIguais: true } : {}),
    versaoDosMapas: versao,
    // Os do Baú da Conta não abrem (é compartilhado entre os personagens): a tela só diz quantos há lá.
    noBauDaConta: mapasNoBauDaConta(estado),
    loop: MapasLoop.paraTela(estado),
    estatisticas: { concluidos: st.concluidos, falhos: st.falhos, mortes: st.mortes, maiorTier: st.maiorTier, porTier: st.porTier, ultimo: st.ultimo },
    tiers: Mapas.TIERS,
  };
}
