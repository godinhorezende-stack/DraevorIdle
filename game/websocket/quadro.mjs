// O quadro da caçada que vai pelo fio: só o que está na tela e só o que mudou.
//
// Medido antes (Werelions -1, 148 bichos, 2026-09-25): cada `state` levava os
// 148 bichos inteiros, quatro vezes por segundo — ~30 KB por quadro, 115 KB/s
// por jogador. O original manda o que o cliente dele sabe juntar
// (`applyState`/`juntarAsCriaturas`, em client/src/main.mjs):
// - `huntDelta: true` → `hunt` leva só as chaves que mudaram; o cliente
//   espalha por cima do que já tem.
// - `monsters` é a lista do que está na TELA agora; um bicho que já estava no
//   quadro anterior pode vir sem a "mobília" (nome, aparência, vida máxima) —
//   o cliente guarda a do quadro anterior pelo `uid`.
// Nada disto muda a regra do jogo: o `snapshotDaHunt` continua inteiro (os
// testes e o próprio servidor leem ele); o recorte é só do que viaja.
import * as Areas from '../engine/areas.mjs';
import { METADE_DA_TELA } from '../../game/engine/tela.mjs';

/** A tela do cliente (23x13) e mais duas casas, para o bicho que entra já chegar desenhado. */
const MARGEM = 2;
export const JANELA = { x: METADE_DA_TELA.x + MARGEM, y: METADE_DA_TELA.y + MARGEM };

/** O que um bicho tem de fixo: vai uma vez, e o cliente guarda. */
// (A raridade, os modificadores e o level do mob também não mudam: vão uma vez — ver `mobs/raridade.mjs`.)
const MOBILIA = ['name', 'look', 'lookItem', 'colors', 'maxHp', 'raridade', 'mods', 'nivel', 'lvExtra'];

export const naTela = (centro, p) => !!centro && Math.abs(p.x - centro.x) <= JANELA.x && Math.abs(p.y - centro.y) <= JANELA.y;

/**
 * Os bichos que vão neste quadro: só os da tela. `jaForam` são os uids do
 * quadro ANTERIOR (a mobília que o cliente tem); devolve a lista e os uids deste.
 */
export function bichosDoQuadro(monsters, centro, jaForam) {
  const lista = [];
  const uids = new Set();
  for (const m of monsters ?? []) {
    if (!naTela(centro, m)) continue;
    uids.add(m.uid);
    if (!jaForam?.has(m.uid)) {
      lista.push(m);
      continue;
    }
    const leve = {};
    for (const [k, v] of Object.entries(m)) if (!MOBILIA.includes(k)) leve[k] = v;
    lista.push(leve);
  }
  return { lista, uids };
}

/*
 * ---- O RADAR do minimapa: TODOS os bichos do andar, só a posição ----
 *
 * O quadro só leva os bichos da TELA (acima), e o minimapa mostra a fase inteira: sem isto ele só
 * via o bicho que já estava perto. Aqui vai uma lista enxuta, plana — `[x, y, tipo, x, y, tipo…]`,
 * tipo 0 normal, 1 de raridade, 2 boss —, só dos vivos. Quem manda (`sessao.mjs`) a refaz no
 * máximo a cada `RADAR_MS` (e sempre que muda a quantidade): o delta do quadro só a leva quando
 * ela mudou. Werelions -1, 148 bichos: ~1 KB, uma vez por segundo, contra os 30 KB do quadro inteiro.
 */
export const RADAR_MS = 1000;
export function radarDosBichos(monsters, bossUid = null, salaDeBoss = false) {
  const radar = [];
  for (const m of monsters ?? []) {
    if (!(m.hp > 0) || !Number.isFinite(m.x) || !Number.isFinite(m.y)) continue;
    const tipo = salaDeBoss || (bossUid != null && m.uid === bossUid) ? 2 : m.raridade && m.raridade !== 'normal' ? 1 : 0;
    radar.push(m.x, m.y, tipo);
  }
  return radar;
}

/** Efeitos de tela (`fx`, `shot`, `explosao`, `area`) longe dela, ou com a aba escondida, não vão: ninguém os vê. */
export function eventosDoQuadro(eventos, centro, oculta) {
  if (!eventos?.length) return eventos;
  return eventos.filter((e) => {
    if (e.t !== 'fx' && e.t !== 'shot' && e.t !== 'explosao' && e.t !== 'area') return true;
    if (oculta) return false;
    if (!centro || e.uid === 'player') return true;
    // Área (`area`, `explosao`): vai se QUALQUER casa dela está na tela (a de 85 casas passa da janela).
    if (e.t === 'area' || e.t === 'explosao') return Areas.casasDoEvento(e).some((c) => naTela(centro, c));
    return naTela(centro, e);
  });
}

/**
 * O delta de um objeto raso contra o texto do último envio (`cache`, chave →
 * JSON). Atualiza o cache e devolve só as chaves que mudaram (vazio = nada).
 */
export function deltaRaso(obj, cache, fixas = []) {
  const delta = {};
  for (const [k, v] of Object.entries(obj)) {
    if (fixas.includes(k)) continue;
    const s = JSON.stringify(v) ?? 'undefined';
    if (cache[k] === s) continue;
    cache[k] = s;
    delta[k] = v;
  }
  // Chave que SAIU: o cliente só espalha por cima, então ela vai como `null`
  // (senão ele ficaria com o valor velho — a `party` de quem saiu da party).
  for (const k of Object.keys(cache)) {
    if (k in obj) continue;
    delete cache[k];
    delta[k] = null;
  }
  return delta;
}

/** Vai só no primeiro quadro de cada caçada, e o cliente guarda: não entra na conta do delta. */
export const SO_NO_PRIMEIRO_QUADRO = ['map'];
