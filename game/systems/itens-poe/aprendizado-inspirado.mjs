// (lote 51) O APRENDIZADO INSPIRADO (a joia única do J30): "Com 4 Notáveis Alocados no Raio, Ao Matar um monstro Raro, você recebe 1 de seus
// Modificadores por 20 segundos". O que cada modificador de monstro do PoE faria em VOCÊ: as linhas dele (o texto em português do PoE)
// traduzidas como as das peças (`traduzirMod`). Decisão do dono (16/10): o sorteio é só entre os que têm um equivalente em você — as linhas
// que não traduzem para nada que valha no personagem (o registrado, o inerte) ficam de fora; as com condição ou escala também (os bônus por
// tempo somam depois das condições — `afixos`).
//
// Só os pontos de entrada importam este módulo (`iniciar.mjs`): ele se registra em `mods-poe` (o abate — `aprenderDoRaro`), sem ciclo.
import { traduzirMod } from './traduzir.mjs';
import * as ModsDeMonstro from './modificadores-monstro.mjs';
import { definirEfeitosDoModDeMonstro } from './mods-poe.mjs';

const VALEM = new Set(['novo', 'equivalente', 'aproximado']);
const CACHE = new Map();

/** A linha do texto → o modelo (`{i}` no lugar de cada número) e os valores: "+25% de Resistência a Caos" → "+{0}% de Resistência a Caos", [25]. */
export function modeloDaLinha(texto) {
  const valores = [];
  const modelo = String(texto).replace(/\d+(?:\.\d+)?/g, (x) => `{${valores.push(Number(x)) - 1}}`);
  return { modelo, valores };
}

/** O que o modificador de monstro `id` (`poe:<id>` ou o id do PoE) faria em você: `[{ stat, valor }]` — vazio, nenhum equivalente. */
export function efeitosNoJogador(id) {
  const k = String(id);
  if (CACHE.has(k)) return CACHE.get(k);
  const efs = [];
  for (const linha of ModsDeMonstro.mod(k)?.linhas ?? []) {
    const { modelo, valores } = modeloDaLinha(linha);
    for (const p of traduzirMod({ modelo, valores }).partes ?? []) {
      if (!VALEM.has(p.estado)) continue;
      for (const ef of p.efeitos ?? []) {
        const v = Number(ef.valor);
        if (typeof ef.stat === 'string' && !ef.stat.startsWith('poe.') && !/[@%]/.test(ef.stat) && Number.isFinite(v) && v !== 0) efs.push({ stat: ef.stat, valor: v });
      }
    }
  }
  CACHE.set(k, efs);
  return efs;
}

definirEfeitosDoModDeMonstro(efeitosNoJogador);
