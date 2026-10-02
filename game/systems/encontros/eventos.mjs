// Os EVENTOS de tela dos encontros (loot, fala): quem abre um baú no meio da limpeza da instância não tem a lista de
// eventos do tique à mão, então empurra para cá e o tique do dono da sala os leva junto (ver `cacadas.tique`).
// WeakMap por sala: nada disto é gravado.
import { salaDe } from '../hunt/sala.mjs';

const pendentes = new WeakMap();

export function empurrar(hunt, eventos) {
  const sala = salaDe(hunt);
  if (!sala || !eventos?.length) return;
  const lista = pendentes.get(sala) ?? [];
  lista.push(...eventos);
  pendentes.set(sala, lista);
}

export function tirar(hunt) {
  const sala = salaDe(hunt);
  const lista = pendentes.get(sala);
  if (!lista) return [];
  pendentes.delete(sala);
  return lista;
}
