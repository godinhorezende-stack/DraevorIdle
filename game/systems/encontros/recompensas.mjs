// A RECOMPENSA de um encontro (baú): a tabela, a validação (com os tetos de economia) e a entrega pelo loot de sempre.
//
//   "recompensa": {
//     "tabela": "bau-da-cripta",                  // uma tabela de gamedata/encontros.json (reutilizável)...
//     "drops": [{ "id": 3031, "chance": 100 }],   // ...e/ou drops no próprio encontro (chance em %)
//     "rolagens": 2,                              // quantas vezes a tabela é sorteada (a "quantidade de itens")
//     "moedasMedia": 200,                         // média das moedas de ouro (id 3031) por rolagem
//     "primeiraConclusao": { "gold": 1000, "exp": 0, "itens": [{ "id": 3031, "count": 1 }] }
//   }
//
// Regras do dono: os drops passam pelas MESMAS regras do loot (bônus, filtros, capacidade, rodízio da party — ver
// `combate.lootDoEncontro`); a PRIMEIRA conclusão paga o `primeiraConclusao` (uma vez por personagem); as repetições
// só o loot normal. O validador recusa o que passa do teto de valor esperado — encontro não é fonte nova de loot.
import { ITEM_CATALOG } from '../dados.mjs';
import { precoNpc } from '../hunt/rentabilidade.mjs';
import { CONFIG } from './config.mjs';

/** Os drops da recompensa no formato do loot (`{ id, name, chance }`, chance em fração). */
export function dropsDe(r) {
  const da = (CONFIG.tabelas[r?.tabela] ?? []).concat(r?.drops ?? []);
  return da.map((d) => ({ id: d.id, name: ITEM_CATALOG[d.id]?.name, chance: Number(d.chance) / 100 }));
}

/** Quanto vale, em ouro de NPC, abrir isto (rolagens × Σ chance × preço, com as moedas pela média). */
export function valorEsperado(r) {
  if (!r) return 0;
  const por = dropsDe(r).reduce((s, d) => s + d.chance * (d.id === 3031 ? (r.moedasMedia ?? 100) : precoNpc(d.id)), 0);
  return Math.round(por * (r.rolagens ?? 1));
}

/** Os erros de uma recompensa (vazia = aceita). */
export function validar(r, onde = 'recompensa') {
  const erros = [];
  if (!r || typeof r !== 'object') return [`${onde}: obrigatória.`];
  if (r.tabela != null && !CONFIG.tabelas[r.tabela]) erros.push(`${onde}: a tabela "${r.tabela}" não existe em gamedata/encontros.json.`);
  const todos = (CONFIG.tabelas[r.tabela] ?? []).concat(r.drops ?? []);
  if (!todos.length && !r.primeiraConclusao) erros.push(`${onde}: sem drops e sem primeiraConclusao.`);
  for (const d of todos) {
    if (!ITEM_CATALOG[d?.id]) erros.push(`${onde}: item ${d?.id} não existe no catálogo.`);
    if (!(Number(d?.chance) > 0 && Number(d.chance) <= 100)) erros.push(`${onde}: chance do item ${d?.id} entre 0 e 100 (%).`);
  }
  const rol = r.rolagens ?? 1;
  if (!(Number.isInteger(rol) && rol >= 1 && rol <= CONFIG.limites.rolagensMax)) erros.push(`${onde}: rolagens de 1 a ${CONFIG.limites.rolagensMax}.`);
  if (r.moedasMedia != null && !(Number(r.moedasMedia) > 0)) erros.push(`${onde}: moedasMedia precisa ser positivo.`);
  const pc = r.primeiraConclusao;
  if (pc) {
    for (const it of pc.itens ?? []) if (!ITEM_CATALOG[it?.id] || !(Number(it.count) >= 1)) erros.push(`${onde}: item ${it?.id} da primeiraConclusao inválido.`);
    if (pc.gold != null && !(Number(pc.gold) >= 0)) erros.push(`${onde}: gold da primeiraConclusao inválido.`);
  }
  const valor = valorEsperado(r);
  if (valor > CONFIG.limites.valorEsperadoPorEncontro) erros.push(`${onde}: valor esperado ${valor.toLocaleString('pt-BR')} acima do teto de ${CONFIG.limites.valorEsperadoPorEncontro.toLocaleString('pt-BR')} (encontro não pode virar fonte de ouro).`);
  return erros;
}
