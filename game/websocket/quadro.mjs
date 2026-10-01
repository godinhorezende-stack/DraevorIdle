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
import { METADE_DA_TELA } from '../../game/engine/tela.mjs';

/** A tela do cliente (23x13) e mais duas casas, para o bicho que entra já chegar desenhado. */
const MARGEM = 2;
export const JANELA = { x: METADE_DA_TELA.x + MARGEM, y: METADE_DA_TELA.y + MARGEM };

/** O que um bicho tem de fixo: vai uma vez, e o cliente guarda. */
// (A raridade, os modificadores e o level do mob também não mudam: vão uma vez — ver `mobs/raridade.mjs`.)
const MOBILIA = ['name', 'look', 'lookItem', 'colors', 'maxHp', 'raridade', 'mods', 'nivel'];

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

/** Efeitos de tela (`fx`, `shot`) longe dela, ou com a aba escondida, não vão: ninguém os vê. */
export function eventosDoQuadro(eventos, centro, oculta) {
  if (!eventos?.length) return eventos;
  return eventos.filter((e) => {
    if (e.t !== 'fx' && e.t !== 'shot') return true;
    if (oculta) return false;
    return !centro || e.uid === 'player' || naTela(centro, e);
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
