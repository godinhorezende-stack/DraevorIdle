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
/*
 * ---- A instância mora na caçada do DONO da sala ----
 * Quem entra na sala de outro (`entrarNaSala`) não tem `instancia` própria: lê a do dono por `salaDe`. Seguindo sozinho (saiu da sala,
 * a queda da conexão, o reinício do servidor) ou virando o dono, a caçada precisa levar uma CÓPIA dela — sem isso, na volta ela era
 * tomada por uma caçada "de antes das instâncias" e, com a fase não liberada para ele (na party o amigo carrega), ia para a cidade
 * (dono, 08/10: "estou numa pt e quando o servidor atualiza meu char vai para city").
 */
export function levarDaSala(hunt, sala) {
  if (!sala || sala === hunt) return;
  if (!hunt.instancia && sala.instancia) hunt.instancia = structuredClone(sala.instancia);
  if (!hunt.outrosAndares && sala.outrosAndares) hunt.outrosAndares = structuredClone(sala.outrosAndares);
}
/** `salaAntiga`: a sala de quem saiu — o novo dono fica com a instância dela (uma cópia; quem saiu segue com a dele). */
export const virarDono = (hunt, salaAntiga = null) => {
  levarDaSala(hunt, salaAntiga ?? hunt.anfitriao);
  return ligarAoDono(hunt, undefined);
};
export const mudarDeDono = (hunt, dono) => ligarAoDono(hunt, dono);

/** Deixa de dividir os bichos: fica com uma cópia deles (segue sozinho) — e da instância da sala. */
export function separar(hunt) {
  levarDaSala(hunt, hunt.anfitriao);
  hunt.monstros = hunt.monstros.map((m) => ({ ...m }));
  hunt.respawns = (hunt.respawns ?? []).map((r) => ({ ...r }));
  ligarAoDono(hunt, undefined);
}
