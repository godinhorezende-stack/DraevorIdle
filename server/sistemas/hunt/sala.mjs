// A sala da caçada em grupo: quem é o dono, dividir e separar os bichos.
// Parte de `cacadas.mjs` (dividido em 2026-09-25); a fachada continua lá.

// ------------------------------------------------ a sala da caçada em grupo

/** Tira um bicho da sala NO LUGAR (o array é o mesmo para todos da sala). */
export function tirarMonstro(hunt, alvo) {
  const i = hunt.monstros.indexOf(alvo);
  if (i >= 0) hunt.monstros.splice(i, 1);
  if (hunt.alvo === alvo.uid) hunt.alvo = null;
}

/** A hunt de quem abriu a sala (a própria, para quem caça sozinho). */
export const salaDe = (hunt) => (hunt ? hunt.anfitriao ?? hunt : null);

// `anfitriao` não é gravado (não-enumerável): no banco a caçada de cada um é
// só dele, e ela segue offline sozinha.
export const ligarAoDono = (hunt, dono) => Object.defineProperty(hunt, 'anfitriao', { value: dono ?? undefined, enumerable: false, writable: true, configurable: true });
export const virarDono = (hunt) => ligarAoDono(hunt, undefined);
export const mudarDeDono = (hunt, dono) => ligarAoDono(hunt, dono);

/** Deixa de dividir os bichos: fica com uma cópia deles (segue sozinho). */
export function separar(hunt) {
  hunt.monstros = hunt.monstros.map((m) => ({ ...m }));
  hunt.respawns = (hunt.respawns ?? []).map((r) => ({ ...r }));
  ligarAoDono(hunt, undefined);
}
