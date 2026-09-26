// "Lurar até N" e "voltar em V": juntar a leva e quando brigar.
// Parte de `cacadas.mjs` (dividido em 2026-09-25); a fachada continua lá.
import { distancia } from './caminho.mjs';
import { ALCANCE_DE_PERCEPCAO } from './monstros.mjs';

/** Juntando sem a leva crescer por este tempo, para de juntar e briga com o que tem. */
export const LURE_SEM_PROGRESSO_MS = 30_000;
/** Vida (fração) abaixo da qual ele larga o lure e briga na hora. */
export const VIDA_PARA_DESISTIR_DO_LURE = 0.35;

export function proximoMonstroForaDeAlcance(hunt) {
  // O próximo a puxar é quem ainda NÃO está vindo (fora da leva) — antes era
  // "o mais perto a mais de 8 casas", que podia ser um que já perseguia: sem
  // ninguém novo, o alvo sumia e o personagem ficava parado. Quem já se
  // mostrou sem caminho (`semCaminhoAte`) fica de fora por um tempo.
  const agora = hunt.clock ?? 0;
  /*
   * ---- Escolheu quem puxar, vai até ele ----
   *
   * "ficou bugado indo e voltando". Sem trava, dar um passo na direção do bicho
   * o trazia para dentro das 8 casas, ele deixava de ser "o de fora mais perto",
   * o escolhido virava outro do lado oposto, e o passo seguinte desfazia o
   * anterior (Kina na Winter Dream Court: 33,34 ↔ 34,34 por minutos). Agora o
   * escolhido segue sendo o alvo do passo até vir atrás dele (`perseguindo`),
   * morrer, ou `LURE_ALVO_MAXIMO_MS` passar sem isso (sem caminho: fica de fora).
   */
  const travado = hunt.monstros.find((m) => m.uid === hunt.alvoDoLure);
  if (travado && travado.hp > 0 && !travado.perseguindo) {
    if (agora - (hunt.alvoDoLureDesde ?? agora) <= LURE_ALVO_MAXIMO_MS) return travado;
    travado.semCaminhoAte = agora + 20_000;
  }
  const novo =
    hunt.monstros
      .filter((m) => m.hp > 0 && !m.perseguindo && distancia(hunt.pos, m) > ALCANCE_DE_PERCEPCAO && agora >= (m.semCaminhoAte ?? 0))
      .map((m) => ({ m, d: distancia(hunt.pos, m) }))
      .sort((a, b) => a.d - b.d)[0]?.m ?? null;
  hunt.alvoDoLure = novo?.uid ?? null;
  hunt.alvoDoLureDesde = agora;
  return novo;
}
/** Indo puxar o mesmo bicho por mais que isto sem ele vir atrás, desiste dele. */
export const LURE_ALVO_MAXIMO_MS = 10_000;

/**
 * Atualiza `hunt.leva`/`hunt.lurando` a cada tique. Simplificado e
 * documentado como tal: "lurando" conta quantos bichos vivos estão dentro do
 * alcance de percepção (perseguindo), sem separar quem já está mordendo de
 * quem só está vindo — o Tibia real distingue isso; aqui não.
 */
/*
 * ---- "Lurar até N" e "voltar em V", como no original ----
 *
 * Do client (`main.mjs`, o seletor `lure-volta`): a meta EFETIVA é limitada ao
 * que a leva viva do andar sustenta ("marcar 8 num andar de 5 vira 5"); o
 * "voltar em V" só vale abaixo da meta (as opções >= meta vêm apagadas); e com
 * "voltar: auto" o servidor escolhe e o rótulo mostra o número
 * ("voltar: auto (X)", lido de `hunt.levaVolta`). O auto é UM TERÇO da meta:
 * é o que o balão do seletor no client do original diz ("Auto: volta quando
 * sobrar um terço da leva"), e o que o original mandou no treino do Zoros
 * (lurar até 3, voltar: auto → `levaVolta: 1`). Com "voltar em 9" marcado e
 * lurar até 10, o original manda `levaVolta: 9` (welcome-zoros-0924).
 */
export function metaDoLure(hunt) {
  const vivos = hunt.monstros.filter((m) => m.hp > 0).length;
  const meta = Math.min(hunt.levaAlvo ?? 0, vivos);
  const pedido = hunt.lureVolta ?? 0;
  const volta = pedido > 0 && pedido < meta ? pedido : Math.floor(meta / 3);
  return { meta, volta };
}

export function atualizarLure(hunt, estado = null) {
  if (!hunt.levaAlvo) {
    hunt.lurando = false;
    hunt.leva = 0;
    return;
  }
  const { meta, volta } = metaDoLure(hunt);
  const naLeva = (m) => m.hp > 0 && (distancia(hunt.pos, m) <= ALCANCE_DE_PERCEPCAO || m.perseguindo);
  hunt.leva = hunt.monstros.filter(naLeva).length;
  const sobraForaDeAlcance = hunt.monstros.some((m) => m.hp > 0 && !naLeva(m));
  // A leva parou de crescer? (bicho que não vem, mapa sem caminho...) Depois
  // de `LURE_SEM_PROGRESSO_MS` ele briga com o que juntou, em vez de rodar
  // apanhando para sempre atrás de uma meta que o andar não sustenta.
  const agora = hunt.clock ?? 0;
  if (hunt.lurando && hunt.leva > (hunt.maiorLeva ?? -1)) {
    hunt.maiorLeva = hunt.leva;
    hunt.lureCresceuEm = agora;
  }
  const apanhando = estado && (estado.hp ?? 0) < (estado.maxHp ?? 0) * VIDA_PARA_DESISTIR_DO_LURE;
  const empacou = hunt.lurando && (apanhando || agora - (hunt.lureCresceuEm ?? agora) > LURE_SEM_PROGRESSO_MS);
  // Junta até a meta (ou até não sobrar ninguém para puxar); briga até a leva
  // cair para `volta`; aí volta a juntar.
  if (hunt.lurando && (hunt.leva >= meta || !sobraForaDeAlcance || empacou)) hunt.lurando = false;
  else if (!hunt.lurando && !apanhando && hunt.leva <= volta && sobraForaDeAlcance) {
    hunt.lurando = true;
    hunt.maiorLeva = hunt.leva;
    hunt.lureCresceuEm = agora;
  }
}
