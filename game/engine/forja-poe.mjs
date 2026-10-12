// As regras da FORJA do PoE que o servidor e a tela usam iguais (uma fonte só — como `sockets-de-gema.mjs`): as CATEGORIAS, o RESULTADO
// DESEJADO de cada uma e se a peça já chegou nele. Quem valida, sorteia, gasta o material e grava é o servidor
// (`systems/itens-poe/forja.mjs`, que usa as moedas de `itens-poe/moedas.mjs`); a tela usa estas funções só para MOSTRAR.
import { gruposLigados } from './sockets-de-gema.mjs';

/** As categorias da Forja, na ordem da tela. "Outras": as moedas que não mexem em sockets, atributos nem raridade (Vaal, Espelho…). */
export const CATEGORIAS = Object.freeze(['sockets', 'cores', 'links', 'atributos', 'raridade', 'outras']);
/** As cores dos sockets (R Força, G Destreza, B Inteligência, W branco — aceita qualquer gema). */
export const CORES = Object.freeze(['R', 'G', 'B', 'W']);

/** As cores dos sockets ABERTOS, contadas: `{ R, G, B, W }`. */
export function contarCores(s) {
  const n = { R: 0, G: 0, B: 0, W: 0 };
  for (let i = 0; i < (s?.abertos ?? 0); i++) {
    const c = s.cores?.[i];
    if (c in n) n[c]++;
  }
  return n;
}
/** O maior grupo de sockets ligados (0 sem socket aberto). */
export const maiorGrupo = (s) => gruposLigados(s).reduce((m, g) => Math.max(m, g.length), 0);

/** Os modificadores explícitos da peça do PoE (prefixos e sufixos). */
const explicitos = (p) => [...(p?.prefixos ?? []), ...(p?.sufixos ?? [])];
/**
 * O mod pedido está na peça? `d`: `{ familia, tierMax?, minimo? }` — a família (o grupo do PoE), o tier no máximo `tierMax` (T1 é o
 * melhor) e o primeiro valor pelo menos `minimo` (só nos mods de um valor só).
 */
export function temMod(p, d) {
  return explicitos(p).some((m) => m.familia === d?.familia
    && (d.tierMax == null || (Number(m.tier) || Infinity) <= Number(d.tierMax))
    && (d.minimo == null || Number(m.valores?.[0]) >= Number(d.minimo)));
}

/**
 * A peça já está como o jogador quer? `s`: os sockets (o formato das gemas: `{ abertos, links, cores }`); `p`: o `poe` da peça; `desejo`:
 * o resultado da categoria. Sem desejo, `false` (não há o que comparar).
 *  - sockets: `{ abertos }` — pelo menos esse número de sockets;
 *  - cores: `{ R, G, B, W }` — pelo menos essa quantidade de cada cor (a ordem não importa, como na bancada do PoE);
 *  - links: `{ ligados }` — um grupo ligado com pelo menos esse número de sockets;
 *  - atributos: `{ mods: [{ familia, tierMax?, minimo? }], modo: 'todos' | 'algum' }`;
 *  - raridade: `{ raridades: ['unico', …] }` — a raridade da peça é uma delas.
 */
export function atingiu(categoria, desejo, { s = null, p = null } = {}) {
  if (!desejo) return false;
  if (categoria === 'sockets') return Number(desejo.abertos) > 0 && (s?.abertos ?? 0) >= Number(desejo.abertos);
  if (categoria === 'cores') {
    const n = contarCores(s);
    const pedido = CORES.filter((c) => Number(desejo[c]) > 0);
    return pedido.length > 0 && pedido.every((c) => n[c] >= Number(desejo[c]));
  }
  if (categoria === 'links') return Number(desejo.ligados) > 1 && maiorGrupo(s) >= Number(desejo.ligados);
  if (categoria === 'atributos') {
    const mods = Array.isArray(desejo.mods) ? desejo.mods : [];
    if (!mods.length) return false;
    return desejo.modo === 'algum' ? mods.some((d) => temMod(p, d)) : mods.every((d) => temMod(p, d));
  }
  if (categoria === 'raridade') return Array.isArray(desejo.raridades) && desejo.raridades.includes(p?.raridade);
  return false;
}

/*
 * ---- O TIPO da peça para os filtros do inventário da Forja ----
 * As mesmas classes das abas do Loot Filter (`afixos.tipoDoFiltroPoe`): armas, armaduras, acessórios e frascos; os mapas à parte.
 */
const CLASSES = {
  armas: ['One_Hand_Swords', 'Thrusting_One_Hand_Swords', 'Two_Hand_Swords', 'One_Hand_Axes', 'Two_Hand_Axes', 'One_Hand_Maces', 'Two_Hand_Maces', 'Sceptres', 'Staves', 'Warstaves', 'Claws', 'Daggers', 'Rune_Daggers', 'Bows', 'Wands', 'Quivers'],
  armaduras: ['Body_Armours', 'Helmets', 'Boots', 'Gloves', 'Shields'],
  acessorios: ['Rings', 'Amulets', 'Belts'],
  frascos: ['Life_Flasks', 'Mana_Flasks', 'Utility_Flasks'],
  mapas: ['Maps'],
};
const TIPO_DA_CLASSE = new Map(Object.entries(CLASSES).flatMap(([tipo, lista]) => lista.map((c) => [c, tipo])));
/** O tipo da peça do PoE ('armas' | 'armaduras' | 'acessorios' | 'frascos' | 'mapas'), ou null. */
export const tipoDaPeca = (p) => TIPO_DA_CLASSE.get(p?.classe) ?? null;
