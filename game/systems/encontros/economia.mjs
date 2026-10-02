// O IMPACTO ECONÔMICO dos encontros, em ouro de NPC por INSTÂNCIA da fase: quanto vale limpar a fase (os bichos dos
// spawns, pela tabela de loot e pelo preço do NPC — `hunt/rentabilidade.mjs`, a mesma conta do Analisador) e quanto os
// encontros somam por cima, com a probabilidade de cada um. A razão entre os dois é o que o validador cobra: encontro é
// um EXTRA da fase, nunca a fonte principal de ouro (decisão do dono: "não aumentar artificialmente o loot").
//
// É estimativa por chance (como o Analisador): chances-base, sem Buff Power/prey/afixo, e sem a primeira conclusão (que
// paga uma vez por personagem e não é renda repetível). O ouro das moedas segue a exp do bicho NA ESCALA da fase.
import { spawnsDaHunt } from '../hunt/terreno.mjs';
import { escalaDaFase } from '../campanha.mjs';
import { BESTIARY } from '../hunt/monstros.mjs';
import * as Rent from '../hunt/rentabilidade.mjs';
import { ITEM_CATALOG } from '../dados.mjs';
import { dropsDe, valorEsperado as valorDaRecompensa } from './recompensas.mjs';
import { bossUnico } from '../bosses-unicos/catalogo.mjs';

/** O bestiário com a exp da fase aplicada (é nela que as moedas se apoiam). */
function bestiarioNaEscala(escala) {
  const f = escala?.exp ?? 1;
  return new Proxy(BESTIARY, { get: (b, k) => (b[k] ? { ...b[k], exp: Math.round((b[k].exp ?? 0) * f) } : undefined) });
}

/** O valor esperado de matar `mortes` (`{key: n}`) na escala da fase. */
function valorDeMortes(mortes, escala) {
  const r = Rent.valorEsperado(mortes, bestiarioNaEscala(escala));
  return r.gold + r.valor;
}

/** Quanto vale limpar UMA instância da fase (todos os bichos dos spawns). */
export function valorDaInstancia(huntId, dificuldade = 'facil') {
  const spawns = spawnsDaHunt(huntId) ?? [];
  const mortes = {};
  let total = 0;
  for (const s of spawns) {
    const soma = s.criaturas.reduce((n, c) => n + c.peso, 0) || 1;
    for (const c of s.criaturas) {
      mortes[c.key] = (mortes[c.key] ?? 0) + (s.quantidade * c.peso) / soma;
      total += (s.quantidade * c.peso) / soma;
    }
  }
  const escala = escalaDaFase(huntId, dificuldade);
  return { bichos: Math.round(total), valor: Math.round(valorDeMortes(mortes, escala)) };
}

const grupo = (g) => Object.fromEntries((g?.criaturas ?? []).map((c) => [c.key, c.qtd ?? 1]));

/** O valor esperado de UM encontro (sem a probabilidade): recompensa do baú + o loot dos guardiões/invocados + o loot do boss. */
export function valorDeUmEncontro(e, escala) {
  let valor = 0;
  // Ondas: cada onda é um grupo de bichos que dropa; com `porOnda` a recompensa se repete a cada onda vencida.
  if (e.ondas?.length) {
    for (const o of e.ondas) valor += valorDeMortes(grupo(o), escala);
    if (e.recompensa) valor += valorDaRecompensa(e.recompensa) * (e.recompensa.porOnda ? e.ondas.length : 1);
  } else if (e.recompensa) valor += valorDaRecompensa(e.recompensa);
  // Guardiões e invocados são bichos de verdade: quando morrem, dropam como qualquer outro.
  for (const g of [e.guardioes, e.invocacao, e.penalidade?.invocacao, e.captores, e.invasores]) if (g) valor += valorDeMortes(grupo(g), escala);
  // Boss único: o loot do cadastro (ou o da criatura-base), na escala da fase.
  const boss = e.bossId ? bossUnico(e.bossId) : null;
  if (boss) {
    const base = BESTIARY[boss.base];
    const exp = Math.round((base?.exp ?? 0) * (boss.atributos.expMult ?? 1) * (boss.usaEscalaDaFase ? escala?.exp ?? 1 : 1));
    const loot = boss.recompensas.loot.length ? boss.recompensas.loot.map((d) => ({ id: d.id, chance: d.chance / 100 })) : base?.loot ?? [];
    const pseudo = { x: { loot, exp } };
    valor += Rent.valorEsperado({ x: 1 }, pseudo).gold + Rent.valorEsperado({ x: 1 }, pseudo).valor;
  }
  return valor;
}

/**
 * O impacto dos encontros ATIVOS de uma lista (já normalizados), por instância: `valor` = Σ probabilidade × quantidade ×
 * valor de um; `fracao` = valor / valor da instância (a razão que o validador cobra).
 */
export function impactoEconomico(huntId, encontros, dificuldade = 'facil') {
  const escala = escalaDaFase(huntId, dificuldade);
  const base = valorDaInstancia(huntId, dificuldade);
  let valor = 0;
  const porEncontro = [];
  for (const e of encontros.filter((x) => x.ativo)) {
    const um = valorDeUmEncontro(e, escala);
    const esperado = Math.round(um * (e.probabilidade / 100) * e.quantidade);
    valor += esperado;
    porEncontro.push({ id: e.id, tipo: e.tipo, valor: esperado });
  }
  return { dificuldade, valorDaFase: base.valor, bichos: base.bichos, valorDosEncontros: valor, fracao: base.valor ? valor / base.valor : valor ? Infinity : 0, porEncontro };
}

export { dropsDe, ITEM_CATALOG };
