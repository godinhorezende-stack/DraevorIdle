// O PAINEL POR HUNT do editor: num lugar só, o que a hunt é — o mapa, os monstros, a distribuição de raridade, a dificuldade e os drops
// esperados. SÓ LEITURA, sobre os cadastros e o mapa que o jogo usa (nada é copiado nem gravado); a conta de drops é a do Analisador
// (`hunt/rentabilidade.mjs`): chance-base × mortes esperadas × preço do NPC, na escala da fase. É ESTIMATIVA por probabilidade, não o que
// vai cair numa execução. Nada inventado: o que o cadastro não traz sai `null`.
import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CATALOGO, ITEM_CATALOG } from '../systems/dados.mjs';
import { spawnsDaHunt, encontrosDaHunt, mapaRealCapturado } from '../systems/hunt/terreno.mjs';
import * as Campanha from '../systems/campanha.mjs';
import * as Raridade from '../systems/mobs/raridade.mjs';
import * as Rent from '../systems/hunt/rentabilidade.mjs';
import { VALOR_DA_MOEDA } from '../systems/inventario.mjs';
import { valorEsperado as valorDaRecompensa } from '../systems/encontros/recompensas.mjs';
import { ehMapaReal } from './mapas.mjs';
import { desenhoDoMonstro, desenhoDoItem } from './biblioteca.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', 'gamedata');
const DISTRIBUICAO = JSON.parse(readFileSync(join(RAIZ, 'mobs', 'distribuicao.json'), 'utf8'));
const CATEGORIAS = [['hunts', 'hunt normal'], ['vips', 'hunt vip'], ['especiais', 'hunt especial'], ['divinas', 'hunt divina']];
const ou = (v) => (v === undefined || v === '' ? null : v);
const arred = (n, casas = 2) => (Number.isFinite(n) ? Number(n.toFixed(casas)) : null);

/** A hunt e a categoria dela (`null` se o id não é de hunt). */
export function acharDaCategoria(huntId) {
  for (const [cat, tipo] of CATEGORIAS) {
    const h = (CATALOGO[cat] ?? []).find((x) => x.id === huntId);
    if (h) return { hunt: h, categoria: cat, tipo };
  }
  return null;
}

/** As hunts para a lista do painel (todas as categorias de hunt), com o nº de spawns do mapa. */
export function listar() {
  return CATEGORIAS.flatMap(([cat, tipo]) => (CATALOGO[cat] ?? []).map((h) => ({ id: h.id, nome: h.name ?? h.id, categoria: cat, tipo, nivel: ou(h.level), spawns: spawnsDaHunt(h.id)?.length ?? 0, doCampanha: !!Campanha.faseDe(h.id) })));
}

/** Quantas mortes de cada criatura uma instância cheia espera: cada spawn gera `quantidade` bichos, repartidos pelo peso das criaturas. */
function mortesEsperadas(spawns) {
  const mortes = {};
  for (const s of spawns) {
    const soma = s.criaturas.reduce((n, c) => n + c.peso, 0) || 1;
    for (const c of s.criaturas) mortes[c.key] = (mortes[c.key] ?? 0) + (s.quantidade * c.peso) / soma;
  }
  return mortes;
}

/** A raridade (e o tipo) de cada spawn pelas regras do jogo, contada POR BICHO (quantidade do spawn). */
function distribuicaoDeRaridade(spawns) {
  const ids = Raridade.RARIDADES;
  const contagem = Object.fromEntries(ids.map((r) => [r, 0]));
  let total = 0;
  for (const s of spawns) {
    const r = Raridade.doSpawn(s).raridade;
    contagem[r] = (contagem[r] ?? 0) + s.quantidade;
    total += s.quantidade;
  }
  const P = DISTRIBUICAO.porMapa;
  // O alvo da distribuição (`gamedata/mobs/distribuicao.json`): fração por spawn para modificado/raro, 1 elite a cada N, 1 único e 1 boss por mapa.
  const alvo = {
    normal: null,
    modificado: P.modificado,
    raro: P.raro,
    elite: P.eliteACada ? 1 / P.eliteACada : null,
    unico: P.unico != null ? P.unico / Math.max(1, spawns.length) : null,
    boss: P.boss != null ? P.boss / Math.max(1, spawns.length) : null,
  };
  const porSpawn = Object.fromEntries(ids.map((r) => [r, 0]));
  for (const s of spawns) porSpawn[Raridade.doSpawn(s).raridade]++;
  return {
    totalDeBichos: total,
    totalDeSpawns: spawns.length,
    linhas: ids.map((r) => ({ raridade: r, bichos: contagem[r], spawns: porSpawn[r], pctDosSpawns: spawns.length ? arred((porSpawn[r] / spawns.length) * 100) : null, alvoPct: alvo[r] != null ? arred(alvo[r] * 100) : null })),
    alvoDoMapa: { ...P },
    observacao: 'O alvo é o de `gamedata/mobs/distribuicao.json` na criação dos mapas (o dono pode ter mexido spawn por spawn no editor): serve de referência, não de regra.',
  };
}

/** O bestiário com a exp da escala da fase aplicada (é nela que as moedas se apoiam) — a mesma conta de `encontros/economia.mjs`. */
function bestiarioNaEscala(escala) {
  const f = escala?.exp ?? 1;
  return new Proxy(CATALOGO.bestiary, { get: (b, k) => (b[k] ? { ...b[k], exp: Math.round((b[k].exp ?? 0) * f) } : undefined) });
}

function dificuldade(hunt, f) {
  if (!f) return { tipo: 'sem campanha', levelDaHunt: ou(hunt.level), observacao: 'Fora da campanha a força dos bichos é a do cadastro (sem escala por dificuldade).' };
  return {
    tipo: 'campanha',
    ato: f.ato,
    levelOriginal: f.levelOriginal,
    porDificuldade: Campanha.DIFICULDADES.map((d) => {
      const e = Campanha.escala(f.levelOriginal, f.nivel[d]);
      return { id: d, nome: Campanha.CAMPANHA.dificuldades[d].nome, levelAlvo: f.nivel[d], vida: arred(e.vida, 3), dano: arred(e.dano, 3), exp: arred(e.exp, 3) };
    }),
    observacao: 'Multiplicadores sobre o bicho do cadastro: (level alvo ÷ level original) elevado ao expoente de vida/dano/exp de `gamedata/campanha.json`.',
  };
}

/** O painel de UMA hunt na dificuldade `dif` (só vale para as da campanha; nas outras, a escala é 1). */
export function painel(huntId, dif = 'facil') {
  const achou = acharDaCategoria(huntId);
  if (!achou) return null;
  const { hunt, categoria, tipo } = achou;
  const d = Campanha.DIFICULDADES.includes(dif) ? dif : Campanha.DIFICULDADES[0];
  const f = Campanha.faseDe(huntId);
  const escala = f ? Campanha.escalaDaFase(huntId, d) : null;
  const spawnsDoMapa = spawnsDaHunt(huntId);
  const spawns = spawnsDoMapa ?? [];
  const mortes = mortesEsperadas(spawns);
  const totalDeMortes = Object.values(mortes).reduce((a, b) => a + b, 0);

  // ---- mapa
  const mapa = mapaRealCapturado(huntId);
  const arquivo = join(RAIZ, 'hunts', `${huntId}-map.json`);
  const mapaInfo = {
    arquivo: existsSync(arquivo) ? `${huntId}-map.json` : null,
    tamanhoBytes: existsSync(arquivo) ? statSync(arquivo).size : null,
    largura: ou(mapa?.width ?? hunt.limite?.w),
    altura: ou(mapa?.height ?? hunt.limite?.h),
    andares: mapa?.levels ?? (mapa?.z != null ? [mapa.z] : null),
    real: mapa ? ehMapaReal(mapa) : null,
    custom: mapa?.custom === true ? true : null,
    origem: ou(hunt.origin),
    spawnsDefinidos: spawnsDoMapa ? 'mapa' : null,
  };

  // ---- monstros
  const monstros = Object.entries(mortes)
    .map(([key, n]) => {
      const m = CATALOGO.bestiary[key];
      return { key, nome: ou(m?.name), classe: ou(m?.class), hp: ou(m?.hp), hpNaEscala: m?.hp != null && escala ? Math.round(m.hp * escala.vida) : ou(m?.hp), exp: ou(m?.exp), mortesPorLimpeza: arred(n, 2), pctDosBichos: totalDeMortes ? arred((n / totalDeMortes) * 100) : null, spawnsComEle: spawns.filter((s) => s.criaturas.some((c) => c.key === key)).length, desenho: m ? desenhoDoMonstro(m) : null, cadastrado: !!m };
    })
    .sort((a, b) => b.mortesPorLimpeza - a.mortesPorLimpeza);
  // Sem spawns no mapa (hunt VIP/especial): o que o catálogo diz que vive nela, sem inventar número.
  const doCadastro = !monstros.length ? (hunt.creatures ?? []).map((c) => ({ key: c.key, nome: ou(CATALOGO.bestiary[c.key]?.name ?? c.name), hp: ou(c.hp), exp: ou(c.exp), desenho: CATALOGO.bestiary[c.key] ? desenhoDoMonstro(CATALOGO.bestiary[c.key]) : null })) : null;

  // ---- drops esperados por limpeza (estimativa por chance)
  const bichario = bestiarioNaEscala(escala);
  const est = Rent.valorEsperado(mortes, bichario);
  const porItem = new Map();
  for (const [key, n] of Object.entries(mortes)) {
    for (const drop of CATALOGO.bestiary[key]?.loot ?? []) {
      if (drop.id == null || VALOR_DA_MOEDA[drop.id] != null) continue;
      const chance = Math.min(1, Math.max(0, Number(drop.chance) || 0));
      const linha = porItem.get(drop.id) ?? { item: drop.id, nome: ITEM_CATALOG[drop.id]?.name ?? drop.name ?? null, desenho: ITEM_CATALOG[drop.id] ? desenhoDoItem(ITEM_CATALOG[drop.id]) : null, quedasPorLimpeza: 0, fontes: [], precoNpc: Rent.precoNpc(drop.id), existe: !!ITEM_CATALOG[drop.id] };
      linha.quedasPorLimpeza += n * chance;
      linha.fontes.push({ monstro: ou(CATALOGO.bestiary[key]?.name ?? key), chancePct: arred(chance * 100, 4), mortes: arred(n, 2) });
      porItem.set(drop.id, linha);
    }
  }
  const itens = [...porItem.values()]
    .map((l) => ({ ...l, quedasPorLimpeza: arred(l.quedasPorLimpeza, 4), execucoesParaUmaQueda: l.quedasPorLimpeza > 0 ? arred(1 / l.quedasPorLimpeza, 1) : null, valorPorLimpeza: Math.round(l.quedasPorLimpeza * l.precoNpc), fontes: l.fontes.sort((a, b) => b.chancePct - a.chancePct) }))
    .sort((a, b) => b.valorPorLimpeza - a.valorPorLimpeza || b.quedasPorLimpeza - a.quedasPorLimpeza);
  const encontros = encontrosDaHunt(huntId).map((e) => ({ id: e.id, tipo: e.tipo, nome: ou(e.nome), probabilidade: ou(e.probabilidade), obrigatorio: e.obrigatorio === true, drops: (e.recompensa?.drops ?? []).map((x) => ({ item: x.id, nome: ITEM_CATALOG[x.id]?.name ?? null, chancePct: x.chance })), rolagens: e.recompensa?.rolagens ?? (e.recompensa ? 1 : null), valorDaAbertura: e.recompensa ? valorDaRecompensa(e.recompensa) : null }));

  return {
    id: hunt.id,
    nome: ou(hunt.name),
    categoria,
    tipo,
    descricao: ou(hunt.blurb),
    nivel: ou(hunt.level),
    doCampanha: f ? { ato: f.ato, indice: f.indice + 1, pular: f.pular === true } : null,
    dificuldadeEscolhida: d,
    mapa: mapaInfo,
    spawns: { total: spawns.length, bichos: Math.round(totalDeMortes), pontos: spawns.map((s) => ({ id: s.id, x: s.x, y: s.y, z: s.z, quantidade: s.quantidade, raio: s.raio, raridade: Raridade.doSpawn(s).raridade, criaturas: s.criaturas.map((c) => c.key) })), porAndar: Object.entries(spawns.reduce((a, s) => ({ ...a, [s.z]: (a[s.z] ?? 0) + 1 }), {})).map(([andar, n]) => ({ andar: Number(andar), spawns: n })) },
    monstros: { definidosPeloMapa: monstros, doCadastro },
    distribuicao: spawns.length ? distribuicaoDeRaridade(spawns) : null,
    dificuldade: dificuldade(hunt, f),
    drops: {
      modelo: 'Estimativa por chance: cada monstro tem a tabela de loot do bestiário (chance INDIVIDUAL por item, por morte); aqui multiplicada pelas mortes esperadas de uma limpeza, na escala da fase. Não considera Buff Power, prey nem afixo de loot — e não garante uma execução real.',
      bichosPorLimpeza: Math.round(totalDeMortes),
      ouroEsperado: Math.round(est.gold),
      valorDosItensEsperado: Math.round(est.valor),
      valorTotalEsperado: Math.round(est.gold + est.valor),
      itens,
      deEncontros: encontros.length ? encontros : null,
      referenciasQuebradas: itens.filter((i) => !i.existe).map((i) => i.item),
    },
  };
}
