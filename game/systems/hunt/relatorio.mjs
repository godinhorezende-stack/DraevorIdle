// O relatório da caçada (`runReport`) e a sessão do Analisador.
// Parte de `cacadas.mjs` (dividido em 2026-09-25); a fachada continua lá.
import * as Rentabilidade from './rentabilidade.mjs';
import { BESTIARY } from './monstros.mjs';

// `byMonster` guarda as mortes pelo NOME do bicho (é o que o Analisador lista); a estimativa precisa da chave.
let chavePeloNome = null;
const chaveDoBicho = (nome) => {
  chavePeloNome ??= new Map(Object.entries(BESTIARY).map(([k, b]) => [b.name, k]));
  return chavePeloNome.get(nome) ?? null;
};

/**
 * A análise de rentabilidade da sessão (ver `rentabilidade.mjs`): o loot COLETADO pelo preço do NPC
 * (vendido ou não), os custos, o líquido e — separada, marcada como estimativa — o que as chances
 * de drop dos bichos mortos dariam. `ms`: a duração da sessão.
 */
export function analise(sessao, ms) {
  const loot = Rentabilidade.valorDoLoot(sessao.itens.loot);
  const r = Rentabilidade.resumo({ gold: sessao.gold, loot: loot.valor, supplies: sessao.supplies, taxas: loot.taxas, ms });
  const mortes = {};
  for (const [nome, n] of Object.entries(sessao.byMonster ?? {})) {
    const k = chaveDoBicho(nome);
    if (k) mortes[k] = (mortes[k] ?? 0) + n;
  }
  const esperado = Rentabilidade.valorEsperado(mortes, BESTIARY);
  return {
    ...r,
    gold: sessao.gold,
    valorDoLoot: loot.valor,
    semPreco: loot.semPreco,
    vendido: sessao.lootValue,
    principais: loot.itens.slice(0, 5),
    estimativa: {
      gold: Math.round(esperado.gold),
      valor: Math.round(esperado.valor),
      liquido: Math.round(esperado.gold + esperado.valor - sessao.supplies),
      principais: esperado.itens.slice(0, 5).map((i) => ({ ...i, quantidade: Math.round(i.quantidade * 100) / 100, total: Math.round(i.total) })),
    },
  };
}

/*
 * ---- O relatório da caçada ----
 *
 * O mesmo formato do `runReport` real (capturado ao vivo: mode, minutos,
 * hunts, exp, kills, gold, lootValue, supplies, lucro...) que o client desenha
 * em "Caçada encerrada" e em "Progresso enquanto você esteve fora"
 * (`corpoDoRelatorio`, em main.mjs). `itens` são os grupos do `blocoDeItens`:
 * `loot` (Coletado) e `gastos` (Gasto).
 */
export function novaSessao(estado, nome, modo, inicio = Date.now()) {
  return {
    inicio, hunts: [nome], modo, levelStart: estado.level,
    exp: 0, kills: 0, gold: 0, lootValue: 0, supplies: 0,
    // Os mesmos campos da `session` real (capturada ao vivo) que o
    // Analisador lê: mortes por bicho, exp por personagem, dano causado.
    byMonster: {}, expPorNome: {}, damageDealt: 0, porElemento: { causado: {}, recebido: {} },
    danoDoFamiliar: 0, acertosDoFamiliar: 0,
    itens: { loot: {}, vendido: {}, gastos: {}, ignorado: {}, perdido: {} },
  };
}

export function sessaoParaCliente(sessao) {
  if (!sessao) return null;
  return {
    exp: sessao.exp, kills: sessao.kills, gold: sessao.gold, lootValue: sessao.lootValue,
    supplies: sessao.supplies, expPorNome: sessao.expPorNome, byMonster: sessao.byMonster,
    damageDealt: sessao.damageDealt, porElemento: sessao.porElemento,
    danoDoFamiliar: sessao.danoDoFamiliar ?? 0, acertosDoFamiliar: sessao.acertosDoFamiliar ?? 0,
    loot: sessao.itens.loot, perdido: sessao.itens.perdido, gastos: sessao.itens.gastos,
    analise: analise(sessao, Math.max(0, Date.now() - (sessao.inicio ?? Date.now()))),
  };
}

export function relatorio(estado, sessao = estado.hunt?.sessao, fim = Date.now()) {
  if (!sessao) return null;
  const ms = Math.max(1000, fim - sessao.inicio);
  const horas = ms / 3_600_000;
  // O loot vale o que foi COLETADO (pelo preço do NPC), e não só o que a venda automática vendeu:
  // antes, item guardado ou vendido à mão não entrava, e o relatório podia dar prejuízo falso.
  const a = analise(sessao, ms);
  const lucro = a.liquido;
  return {
    mode: sessao.modo === 'online' ? 'online' : 'single',
    minutos: Math.round(ms / 60000),
    hunts: sessao.hunts,
    exp: sessao.exp,
    expHora: Math.round(sessao.exp / horas),
    levels: estado.level - sessao.levelStart,
    levelStart: sessao.levelStart,
    levelNow: estado.level,
    kills: sessao.kills,
    gold: sessao.gold,
    lootValue: sessao.lootValue,
    supplies: sessao.supplies,
    potions: Object.values(sessao.itens.gastos).reduce((a, b) => a + b, 0),
    lucro,
    lucroHora: Math.round(lucro / horas),
    // As partes do lucro, separadas: ouro das moedas + valor do loot coletado − suprimentos.
    valorDoLoot: a.valorDoLoot,
    semPreco: a.semPreco,
    estimativa: a.estimativa,
    itens: sessao.itens,
  };
}

/** Soma uma sessão (a da ausência) na sessão inteira da caçada. */
export function somarSessao(total, parte) {
  for (const k of ['exp', 'kills', 'gold', 'lootValue', 'supplies', 'damageDealt']) total[k] = (total[k] ?? 0) + (parte[k] ?? 0);
  for (const grupo of ['loot', 'vendido', 'gastos', 'ignorado', 'perdido']) {
    if (!parte.itens[grupo]) continue;
    total.itens[grupo] ??= {};
    for (const [id, n] of Object.entries(parte.itens[grupo])) total.itens[grupo][id] = (total.itens[grupo][id] ?? 0) + n;
  }
}
