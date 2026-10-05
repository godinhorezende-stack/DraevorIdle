// O MOTOR DE ONDAS: ondas sucessivas de inimigos, uma depois da outra, com dificuldade crescente. É o que `sobrevivencia`
// (ondas até o fim) e `fenda` (as mesmas ondas, com LIMITE DE TEMPO) usam — um motor só, dois tipos de encontro.
//
//   "ondas": [{ "criaturas": [{ "key": "troll", "qtd": 3 }], "raridade": "elite", "modificadores": ["veloz"] }, ...]
//   "pausaMs": 4000,        // entre uma onda vencida e a próxima
//   "limiteMs": 120000,     // fenda: o tempo total; estourou, a fenda se fecha (as ondas já vencidas ficam pagas)
//   "recompensa": { "drops": [...], "porOnda": true, "rolagens": 1, "primeiraConclusao": {...} }
//
// A onda é um grupo de bichos de verdade (`sala.nascerGrupo`: escala da fase, raridade, ligados ao encontro, fora da conta do CLEAR);
// quando o último cai, a próxima nasce depois da pausa. Tudo anda no RELÓGIO DA CAÇADA, no passo que a instância já dá
// (`Estado.avaliar` → `verificar`) — nenhum laço próprio, nenhum timer. O estado mora no encontro (`e.onda`, JSON puro):
// gravar/carregar e a volta de quem estava offline continuam de onde pararam.
//
// DESEMPENHO ("recompensas proporcionais ao desempenho"): com `porOnda`, cada onda vencida paga `rolagens` do loot na hora;
// parar no meio (tempo, morte, sair) mantém o que as ondas vencidas já pagaram. A conclusão (todas as ondas) paga ainda a
// primeira conclusão.
import { CONFIG } from './config.mjs';
import * as Estado from './estado.mjs';
import * as Eventos from './eventos.mjs';
import { nascerGrupo, bichosDaSala, listaDoAndar } from './sala.mjs';
import { pagarRolagens, pagarConclusao } from './entregar.mjs';
import { BESTIARY } from '../hunt/monstros.mjs';
import { RARIDADES, MODIFICADORES, IGNORADOS } from '../mobs/raridade.mjs';

const ponto = (e) => (e.x != null ? { x: e.x, y: e.y, ...(e.z != null ? { z: e.z } : {}) } : null);

/** O total de monstros de uma onda. */
export const monstrosDaOnda = (o) => (o.criaturas ?? []).reduce((n, c) => n + (c.qtd ?? 1), 0);

/**
 * Gera `n` ondas CRESCENTES de um grupo-base: a quantidade de cada criatura sobe por `fator` (padrão 1,3) a cada onda,
 * limitada pelo teto de monstros por onda — o editor usa isto para não escrever dez ondas à mão.
 */
export function ondasCrescentes({ criaturas, ondas = 5, fator = 1.3, raridade = null }) {
  const lista = [];
  for (let i = 0; i < ondas; i++) {
    let grupo = criaturas.map((c) => ({ key: c.key, qtd: Math.max(1, Math.round((c.qtd ?? 1) * fator ** i)) }));
    // Respeita o teto da onda: tira do que mais pesa, de um em um.
    while (grupo.reduce((n, c) => n + c.qtd, 0) > CONFIG.limites.ondaMaxMonstros) {
      const maior = grupo.reduce((a, b) => (b.qtd > a.qtd ? b : a));
      maior.qtd--;
    }
    lista.push({ criaturas: grupo, ...(raridade && i >= Math.floor(ondas / 2) ? { raridade } : {}) });
  }
  return lista;
}

/** Os erros das ondas de um encontro (`tipo`: 'sobrevivencia' ou 'fenda'). */
export function validar(tipo, e) {
  const erros = [];
  const L = CONFIG.limites;
  if (!Array.isArray(e.ondas) || !e.ondas.length) return ['precisa de "ondas" (ao menos uma).'];
  if (e.ondas.length > L.ondasMax) erros.push(`no máximo ${L.ondasMax} ondas.`);
  e.ondas.forEach((o, i) => {
    const onde = `ondas[${i}]`;
    if (!o?.criaturas?.length) return void erros.push(`${onde}: sem criaturas.`);
    for (const c of o.criaturas) {
      if (!BESTIARY[c?.key]) erros.push(`${onde}: "${c?.key}" não é um monstro do bestiário.`);
      if (!(Number.isInteger(c?.qtd ?? 1) && (c.qtd ?? 1) >= 1 && (c.qtd ?? 1) <= 8)) erros.push(`${onde}: qtd de 1 a 8 por criatura.`);
    }
    if (monstrosDaOnda(o) > L.ondaMaxMonstros) erros.push(`${onde}: no máximo ${L.ondaMaxMonstros} monstros por onda (limite do servidor).`);
    if (o.raridade && !RARIDADES.includes(o.raridade)) erros.push(`${onde}: raridade "${o.raridade}" desconhecida.`);
    for (const m of o.modificadores ?? []) if (!MODIFICADORES[m] && !IGNORADOS.has(m)) erros.push(`${onde}: modificador "${m}" desconhecido.`);
  });
  if (e.pausaMs != null && !(Number(e.pausaMs) >= 0 && Number(e.pausaMs) <= L.pausaDaOndaMsMax)) erros.push(`pausaMs de 0 a ${L.pausaDaOndaMsMax}.`);
  if (tipo === 'fenda') {
    if (!(Number(e.limiteMs) >= L.limiteDaFendaMsMin && Number(e.limiteMs) <= L.limiteDaFendaMsMax)) erros.push(`a fenda precisa de limiteMs entre ${L.limiteDaFendaMsMin} e ${L.limiteDaFendaMsMax}.`);
    // Uma fenda que se fecha por tempo não pode ser exigência da fase: perder pelo relógio travaria o CLEAR.
    if (e.obrigatorio) erros.push('a fenda tem limite de tempo e não pode ser obrigatória (perder pelo relógio travaria a fase).');
  } else if (e.limiteMs != null) {
    erros.push('só a fenda tem limite de tempo.');
  }
  if (e.recompensa?.porOnda && (e.recompensa.rolagens ?? 1) * e.ondas.length > L.rolagensMax * 4) erros.push('recompensa por onda: rolagens × ondas passa do que o jogo aceita.');
  return erros;
}

const vivosDaOnda = (hunt, e) => {
  const uids = new Set(e.onda?.uids ?? []);
  return bichosDaSala(hunt).filter((m) => uids.has(m.uid) && m.hp > 0).length;
};

/** Tira da sala o que sobrou da fenda/onda (fechou por tempo): nada fica esperando por um evento que acabou. */
export function limparSobras(hunt, e) {
  for (const lista of [listaDoAndar(hunt, null), ...Object.values(hunt.outrosAndares ?? {})]) {
    for (let i = lista.length - 1; i >= 0; i--) if (lista[i].encontro === e.id && lista[i].onda) lista.splice(i, 1);
  }
}

export function aviso(hunt, e, texto, cor = '#f0a851') {
  Eventos.empurrar(hunt, [{ t: 'say', uid: 'player', text: texto, x: hunt.pos.x, y: hunt.pos.y, color: cor }]);
}

function nascerOnda(ctx, e) {
  const { hunt, instancia } = ctx;
  const indice = e.onda.concluidas;
  const def = e.ondas[indice];
  e.onda.uids = nascerGrupo(hunt, { ...def, ponto: ponto(e), instanciaId: instancia.id, encontro: e.id, opcional: !e.obrigatorio, marca: 'onda' });
  e.onda.indice = indice;
  e.onda.proximaEm = null;
  aviso(hunt, e, `Onda ${indice + 1} de ${e.ondas.length}!`, '#ff6a4a');
}

/** O encontro foi ativado: começa a primeira onda e o relógio da fenda. */
export function iniciar(ctx, e) {
  const { hunt, agora } = ctx;
  if (!hunt) return;
  e.onda = { indice: -1, concluidas: 0, uids: [], proximaEm: null, inicioEm: agora, limiteEm: e.limiteMs ? agora + Number(e.limiteMs) : null };
  nascerOnda(ctx, e);
}

/** Um passo (a cada tique da instância): tempo, onda vencida, próxima onda. */
export function avancar(ctx, e) {
  const { hunt, instancia, agora } = ctx;
  if (!hunt || !e.onda) return;
  // Estourou o tempo da fenda: fecha. O que as ondas vencidas já pagaram fica.
  if (e.onda.limiteEm != null && agora >= e.onda.limiteEm) {
    limparSobras(hunt, e);
    aviso(hunt, e, `A fenda se fechou (${e.onda.concluidas}/${e.ondas.length} ondas).`, '#9aa0a8');
    Estado.falhar(instancia, e.id, { agora });
    return;
  }
  if (e.onda.uids.length) {
    if (vivosDaOnda(hunt, e) > 0) return;
    // Onda vencida (ou os bichos sumiram sem passar pela morte: conta como vencida — nunca fica esperando).
    e.onda.uids = [];
    e.onda.concluidas++;
    if (e.recompensa?.porOnda) pagarRolagens(ctx, e, e.recompensa.rolagens ?? 1);
    if (e.onda.concluidas >= e.ondas.length) {
      if (Estado.concluir(instancia, e.id, { agora }).ok) {
        // Sem `porOnda`, o loot vem inteiro no fim.
        if (!e.recompensa?.porOnda) pagarRolagens(ctx, e, e.recompensa?.rolagens ?? 1);
        pagarConclusao(ctx, e);
        aviso(hunt, e, e.tipo === 'fenda' ? 'A fenda foi fechada!' : 'Você sobreviveu!', '#4fbf7a');
      }
      return;
    }
    e.onda.proximaEm = agora + Number(e.pausaMs ?? 3000);
  }
  if (e.onda.proximaEm != null && agora >= e.onda.proximaEm) nascerOnda(ctx, e);
}
