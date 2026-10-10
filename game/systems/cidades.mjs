// As CIDADES (dono, 10/10: "entre atos a cidade muda — então terá instâncias de cada cidade"). No jogo oficial cada ato tem a sua (a
// Vigília de Lioneye no Ato 1, o Acampamento da Floresta no 2… as Docas de Oriath no 10), e cada uma é uma INSTÂNCIA: quem está nela só vê
// quem está na mesma — a praça (`chat.mjs`) e o chão (`inventario.mjs`). O desenho, os NPCs, a forja e o depósito são os da cidade de
// sempre em todas (o dono escolheu "instância por cidade, mesmo mapa"), até cada uma ter o seu.
//
// A cidade do personagem é a do ATO dele (`estado.atoDaCidade`): o da última fase em que caçou (`Cacadas.entrar`) ou o da cidade para onde
// viajou pelo mapa da campanha (o comando `irParaCidade` da sessão). Quem registra as cidades é a campanha do PoE (`itens-poe/campanha.mjs`);
// no Draevor clássico não há registro, e a cidade é uma só (`CIDADE_UNICA`).
//
// Sem imports de propósito: o inventário e o chat leem daqui, e nada daqui depende deles.

/** A cidade do Draevor clássico (e de quem ainda não tem ato): a de sempre. */
export const CIDADE_UNICA = Object.freeze({ id: 'city', nome: 'Draevor', ato: null });

const POR_ATO = new Map();

/** Registra as cidades da campanha: `[{ id, nome, ato }]` (uma por ato; a lista nova troca a de antes). */
export function registrar(lista = []) {
  POR_ATO.clear();
  for (const c of lista) if (c?.id && Number(c.ato) > 0) POR_ATO.set(Number(c.ato), Object.freeze({ id: String(c.id), nome: String(c.nome ?? c.id), ato: Number(c.ato) }));
}

/** As cidades registradas, na ordem dos atos. */
export const cidades = () => [...POR_ATO.values()].sort((a, b) => a.ato - b.ato);
/** Há uma cidade por ato (o jogo oficial)? */
export const porAto = () => POR_ATO.size > 0;
/** A cidade do ato (ou null). */
export const daCidadeDoAto = (ato) => POR_ATO.get(Number(ato)) ?? null;

/** A cidade em que `estado` está (fora da caçada): a do ato dele; sem ato (ou sem registro), a primeira — no clássico, a única. */
export function cidadeDe(estado) {
  if (!POR_ATO.size) return CIDADE_UNICA;
  return POR_ATO.get(Number(estado?.atoDaCidade)) ?? POR_ATO.get(Math.min(...POR_ATO.keys()));
}
/** O id da instância da cidade de `estado` (a chave da praça e do chão). */
export const idDaCidade = (estado) => cidadeDe(estado).id;
