// O LOOP DE MAPAS (dono, 27/10: "a possibilidade, se tiver mapa, de fazer em loop de mapa — ficar repetindo até acabar —, no caso o mapa
// escolhido ou vários mapas escolhidos"). A FILA mora no estado do personagem, ao lado do mapa aberto (`estado.mapas.loop`, gravada com
// ele: sobrevive a recarregar a página, ao logout e à caçada offline):
//
//   estado.mapas.loop = null | {
//     grupos: [{ chave, nome, tier, raridade, quantos, feitos }],  // na ordem escolhida; `quantos` null = todos os iguais que houver
//     feitos, mode, iniciadoEm,
//     atual: null | { mapaId, chave },  // o mapa do loop aberto agora (o `estado.mapas.aberto.id` dele)
//     pendente,                         // o anterior foi concluído e o próximo ainda não abriu (abre quando a caçada do concluído acaba)
//     ultimo,                           // o id do último mapa do loop concluído (para saber de qual caçada é a pausa do "concluído")
//     seguir,                           // um mapa do loop acabou de abrir sozinho (a sessão traz a party que segue o líder e apaga)
//   }
//   estado.mapas.loopFim = null | { motivo, feitos, concluiu, em }  // por que o último loop parou (a tela mostra)
//
// Os GRUPOS são as peças iguais (`chaveDoMapa`: a mesma base/tier, raridade, qualidade, afixos, o único e o estado de corrompido): o loop
// guarda a chave, não a posição — a peça é procurada de novo na mochila, na bolsa e no depósito a cada mapa, então a que foi vendida,
// trocada ou mudou de lugar sai da fila sem quebrar nada. Quem ABRE é o Dispositivo (`mapas-dispositivo.mjs → seguirLoop`), pelo MESMO caminho do botão
// "Abrir mapa"; aqui só a fila (sem caçada, sem sessão).
import { createHash } from 'node:crypto';
import * as Mapas from './mapas.mjs';

const RARIDADES = ['normal', 'magico', 'raro', 'unico'];

/**
 * A CHAVE de um mapa: duas peças com a mesma chave são iguais para o jogador (a tela junta num cartão "×N" e o loop usa qualquer uma). A
 * base (o tier e o nível da área saem dela), a raridade, a qualidade, os textos dos afixos (com os valores — Mágicos e Raros com números
 * diferentes não se juntam), as linhas do único, o corrompido e o identificado (o jogo não tem mapa por identificar: vale o da peça, se um
 * dia existir). Sem o id: é ele que separa duas peças iguais.
 *
 * (27/10, revisão) O resumo é um SHA-256 do texto inteiro (antes um hash de 32 bits: dois mapas diferentes do mesmo tier podiam colidir —
 * a tela os juntava num cartão e o loop abria a peça errada). Curto para ir à tela e voltar, e sem colisão na prática.
 */
export function chaveDoMapa(peca) {
  const p = peca?.poe ?? {};
  const textos = (lista) => (lista ?? []).map((m) => m?.texto ?? '');
  const texto = JSON.stringify([p.base, p.raridade ?? 'normal', Number(p.qualidade) || 0, textos(p.implicitos), textos(p.prefixos), textos(p.sufixos), textos(p.modificadores), p.unico ?? null, !!p.corrompido, p.identificado !== false]);
  return `${Mapas.tierDaPeca(peca) ?? 0}:${createHash('sha256').update(texto).digest('base64url').slice(0, 32)}`;
}

/**
 * (dono, 27/10: "é possível utilizar mapas do baú também? hoje só o que está no inventário") ONDE o Dispositivo procura mapas, na ordem em
 * que usa: a mochila, a bolsa e o DEPÓSITO do personagem — as caixas numeradas (da menor para a maior) e por último as Chegadas. Como no
 * PoE, o Dispositivo pega do baú direto, sem passar pela mochila. O BAÚ DA CONTA fica de fora: é o mesmo para todos os personagens da conta
 * (dois personagens abrindo a mesma peça ao mesmo tempo) — nem está em `estado.deposito` (`Deposito.garantir` o tira; ele mora em
 * `estado.bauDaConta`), e a caixa marcada `compartilhada` é recusada aqui de novo.
 *
 * `[{ onde, origem, lista, caixa }]` — `onde`: o que a tela manda de volta ('inventory', 'pouch', 'depot:<índice da caixa>' ou 'chegadas');
 * `origem`: 'mochila' | 'bolsa' | 'deposito'; `lista`: o array de onde a peça sai; `caixa`: a caixa do depósito (ou null). Só o que EXISTE no
 * estado vira fonte: um `onde` inventado (uma caixa que não há, a da conta) não acha nada.
 */
export function fontesDeMapas(estado) {
  const fontes = [
    { onde: 'inventory', origem: 'mochila', lista: estado?.inventory ?? [], caixa: null },
    { onde: 'pouch', origem: 'bolsa', lista: estado?.pouch ?? [], caixa: null },
  ];
  const caixas = (Array.isArray(estado?.deposito) ? estado.deposito : []).filter((c) => c && !c.compartilhada && Number.isInteger(c.indice) && Array.isArray(c.itens));
  const numeradas = caixas.filter((c) => !c.chegadas).sort((a, b) => a.indice - b.indice);
  for (const c of numeradas) fontes.push({ onde: `depot:${c.indice}`, origem: 'deposito', lista: c.itens, caixa: c });
  const chegadas = caixas.find((c) => c.chegadas);
  if (chegadas) fontes.push({ onde: 'chegadas', origem: 'deposito', lista: chegadas.itens, caixa: chegadas });
  return fontes;
}

/** As peças do grupo que `estado` tem agora (a mochila primeiro, depois a bolsa, depois o depósito — `fontesDeMapas`): `[{ onde, indice, peca }]`. */
export function pecasDoGrupo(estado, chave) {
  const saida = [];
  for (const { onde, lista } of fontesDeMapas(estado)) {
    lista.forEach((peca, indice) => {
      if (Mapas.ehMapa(peca) && chaveDoMapa(peca) === chave) saida.push({ onde, indice, peca });
    });
  }
  return saida;
}

/**
 * Quantas peças há de cada chave (mochila, bolsa e depósito), numa passada só: `Map<chave, n>`. (27/10, revisão: o `paraTela` contava grupo a
 * grupo com `pecasDoGrupo`, refazendo o resumo de TODOS os mapas para cada grupo da fila — grupos × mapas a cada envio, com centenas de
 * mapas no depósito.)
 */
export function contagemPorChave(estado) {
  const n = new Map();
  for (const { lista } of fontesDeMapas(estado)) {
    for (const peca of lista) {
      if (!Mapas.ehMapa(peca)) continue;
      const chave = chaveDoMapa(peca);
      n.set(chave, (n.get(chave) ?? 0) + 1);
    }
  }
  return n;
}

/** O loop de `estado` (ou null). */
export const doPersonagem = (estado) => estado?.mapas?.loop ?? null;

/**
 * Quantos mapas o grupo ainda dá: os iguais que sobram (todos) ou o que falta do número escolhido (o aberto agora já conta), sem passar das
 * peças que há (`contagem`: a de `contagemPorChave`).
 */
function restamNoGrupo(g, loop, contagem) {
  const ha = contagem.get(g.chave) ?? 0;
  const usados = (g.feitos ?? 0) + (loop?.atual?.chave === g.chave ? 1 : 0);
  return g.quantos == null ? ha : Math.max(0, Math.min(g.quantos - usados, ha));
}

/**
 * Monta a fila (`grupos`: `[{ chave, quantos }]` na ordem da tela; `quantos` null/0/ausente = todos). Só entra o grupo de que há peça; o
 * mesmo grupo duas vezes vale uma. Não abre nada (quem abre é `MapasDispositivo.iniciarLoop`). `{ ok, erro? }`.
 */
export function criar(estado, grupos, { mode = 'auto', agora = Date.now() } = {}) {
  if (!Array.isArray(grupos) || !grupos.length) return { ok: false, erro: 'Marque ao menos um mapa para o loop.' };
  const vistos = new Set();
  const fila = [];
  for (const g of grupos.slice(0, 64)) {
    const chave = typeof g?.chave === 'string' ? g.chave.slice(0, 64) : null;
    if (!chave || vistos.has(chave)) continue;
    vistos.add(chave);
    const pecas = pecasDoGrupo(estado, chave);
    if (!pecas.length) continue;
    const n = Math.floor(Number(g.quantos));
    const p = pecas[0].peca;
    const tier = Mapas.tierDaPeca(p);
    fila.push({ chave, nome: p.poe?.nome ?? `Mapa (Nível ${tier})`, tier, raridade: RARIDADES.includes(p.poe?.raridade) ? p.poe.raridade : 'normal', quantos: n >= 1 ? n : null, feitos: 0 });
  }
  if (!fila.length) return { ok: false, erro: 'Esses mapas não estão mais com você: abra a lista de novo.' };
  const st = (estado.mapas ??= {});
  st.loop = { grupos: fila, feitos: 0, mode: mode === 'online' ? 'online' : 'auto', iniciadoEm: agora, atual: null, pendente: true, ultimo: null };
  st.loopFim = null;
  return { ok: true };
}

/** O próximo mapa da fila: `{ grupo, onde, indice, peca }`, ou null (acabou). O grupo cumprido ou sem peça fica para trás. */
export function proxima(estado) {
  const loop = doPersonagem(estado);
  if (!loop) return null;
  for (const g of loop.grupos) {
    if (g.quantos != null && g.feitos >= g.quantos) continue;
    const [p] = pecasDoGrupo(estado, g.chave);
    if (p) return { grupo: g, ...p };
  }
  return null;
}

/** O mapa do loop abriu (`mapaId`: o `estado.mapas.aberto.id`). */
export function marcarAberto(estado, grupo, mapaId) {
  const loop = doPersonagem(estado);
  if (!loop) return;
  loop.atual = { mapaId, chave: grupo.chave };
  loop.pendente = false;
}

/** Para o loop (o mapa aberto, se houver, continua aberto: só a fila acaba). `concluiu`: acabou por não ter mais mapa. */
export function parar(estado, motivo, { concluiu = false, agora = Date.now() } = {}) {
  const st = estado?.mapas;
  const loop = st?.loop;
  if (!loop) return null;
  st.loopFim = { motivo, feitos: loop.feitos ?? 0, concluiu, em: agora };
  st.loop = null;
  return st.loopFim;
}

/**
 * O mapa aberto fechou (`MapaAberto.encerrar`): era o do loop? Concluído, conta e deixa o próximo pendente (abre quando a caçada dele
 * acabar — a pausa do "concluído"); falhou (os 6 portais) ou foi abandonado, o loop PARA.
 */
export function aoEncerrar(estado, mapaId, resultado, agora = Date.now()) {
  const loop = doPersonagem(estado);
  if (!loop || !mapaId || loop.atual?.mapaId !== mapaId) return;
  if (resultado === 'concluido') {
    const g = loop.grupos.find((x) => x.chave === loop.atual.chave);
    if (g) g.feitos++;
    loop.feitos++;
    loop.ultimo = mapaId;
    loop.atual = null;
    loop.pendente = true;
    return;
  }
  parar(estado, resultado === 'falhou' ? 'O mapa falhou (os portais acabaram): o loop parou.' : 'Você abandonou o mapa: o loop parou.', { agora });
}

/** Você saiu do mapa do loop por conta própria (parou, foi para outra caçada) — ou da pausa do concluído antes do próximo abrir: PARA. */
export function saiu(estado, mapaId) {
  const loop = doPersonagem(estado);
  if (!loop || !mapaId) return;
  if (loop.atual?.mapaId === mapaId || (loop.pendente && loop.ultimo === mapaId)) parar(estado, 'Você saiu do mapa: o loop parou.');
}

/**
 * (27/10, revisão) A caçada de que o loop depende sumiu SEM passar por `guardarAoSair` nem pelo fim da pausa (a party troca `estado.hunt`
 * direto: o juntar do "seguir o líder", o "entrar na caçada de alguém", o voltar com o líder). O que fazer, olhando a caçada de agora:
 *   - 'parar'  — você está em OUTRA caçada (a do mapa do loop ou a da pausa do concluído ficou para trás): como sair por conta própria;
 *   - 'seguir' — a pausa do concluído acabou na cidade, antes da hora: o próximo da fila abre (como no fim da pausa);
 *   - null     — está tudo no lugar (no mapa do loop, na pausa dele, ou fora do mapa esperando a volta — como depois de morrer).
 */
export function semCacada(estado) {
  const loop = doPersonagem(estado);
  if (!loop) return null;
  const aqui = estado?.hunt ?? null;
  if (loop.pendente) {
    if (!loop.ultimo || aqui?.mapa?.id === loop.ultimo) return null;
    return aqui ? 'parar' : 'seguir';
  }
  if (loop.atual && aqui && aqui.mapa?.id !== loop.atual.mapaId) return 'parar';
  return null;
}

/** Apaga o aviso do último loop (o "×" do aviso na tela). */
export function dispensarFim(estado) {
  if (!estado?.mapas?.loopFim) return false;
  estado.mapas.loopFim = null;
  return true;
}

/** O rótulo curto de um grupo: "T3 Normal ×5" (ou o nome do único). */
export const rotuloDoGrupo = (g, n) => `${g.raridade === 'unico' ? g.nome : `T${g.tier} ${{ normal: 'Normal', magico: 'Mágico', raro: 'Raro' }[g.raridade] ?? ''}`.trim()}${n != null ? ` ×${n}` : ''}`;

/**
 * O loop para a tela: `{ feitos, total, numero, atual, pendente, restam, grupos: [{ chave, rotulo, nome, tier, raridade, quantos, feitos,
 * restam }] }` (`total`: os feitos, o aberto e o que a fila ainda dá com as peças de agora; `numero`: o mapa da vez; `restam`: os que a fila
 * ainda abre depois do aberto — 0 na pausa do último: não há próximo) e o fim do último (`fim`).
 */
export function paraTela(estado) {
  const st = estado?.mapas;
  const loop = st?.loop;
  const fim = st?.loopFim ?? null;
  if (!loop) return fim ? { ativo: false, fim } : null;
  const contagem = contagemPorChave(estado);
  const grupos = loop.grupos.map((g) => {
    const restam = restamNoGrupo(g, loop, contagem);
    return { chave: g.chave, rotulo: rotuloDoGrupo(g, (g.feitos ?? 0) + restam + (loop.atual?.chave === g.chave ? 1 : 0)), nome: g.nome, tier: g.tier, raridade: g.raridade, quantos: g.quantos, feitos: g.feitos ?? 0, restam };
  });
  const emCurso = loop.atual ? 1 : 0;
  const restam = grupos.reduce((n, g) => n + g.restam, 0);
  const total = (loop.feitos ?? 0) + emCurso + restam;
  return { ativo: true, feitos: loop.feitos ?? 0, total, numero: Math.min(total, (loop.feitos ?? 0) + 1), atual: loop.atual?.mapaId ?? null, pendente: !!loop.pendente, restam, grupos, fim: null };
}
