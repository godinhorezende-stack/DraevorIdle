// RARIDADE NOS MAPAS JÁ CRIADOS (pedido do dono, 01/10): grava `raridade` e
// `modificadores` nos spawns de cada `gamedata/hunts/<id>-map.json`, pela
// distribuição de `gamedata/mobs/distribuicao.json` (moderada, modificadores
// pelo tema do mob). Nada é sorteado no jogo: a escolha é FIXA — a semente é o
// id do mapa + o id do spawn —, então rodar de novo dá o mesmo resultado.
//
// Uso:
//   node game/admin/raridade-dos-mapas.mjs            # só mostra o que faria
//   node game/admin/raridade-dos-mapas.mjs --gravar   # grava
// Rodar de novo só COMPLETA: o spawn que já tem raridade/modificador fica como
// está (o dono pode ter mexido nele no editor), e o que falta para chegar nas
// quantidades da distribuição sai dos spawns normais — foi assim que o Único e
// o Boss (1 de cada por mapa) entraram nos mapas que já tinham elite/raro.
// `--refazer` recalcula tudo do zero.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { CATALOGO } from '../systems/dados.mjs';
import { RAIZ_HUNTS } from '../systems/hunt/terreno.mjs';
import * as Raridade from '../systems/mobs/raridade.mjs';
import { validar } from '../systems/mapa/spawns.mjs';

export const DIST = JSON.parse(readFileSync(new URL('../gamedata/mobs/distribuicao.json', import.meta.url), 'utf8'));

/** Um número fixo em [0, 1) para um texto (FNV-1a + mistura). */
export function semente(texto) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 16777619);
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

const temMecanica = (id) => !!Raridade.MODIFICADORES[id]?.mecanicas?.length;

/** Os modificadores do TEMA da criatura (a classe e os elementos a que ela resiste). */
export function temaDe(key) {
  const b = CATALOGO.bestiary[key] ?? {};
  const daClasse = DIST.temas[b.class] ?? [];
  const dosElementos = Object.entries(b.elements ?? {}).filter(([, v]) => v >= 50).flatMap(([el]) => DIST.elementos[el] ?? []);
  return [...new Set([...daClasse, ...dosElementos])].filter((id) => Raridade.MODIFICADORES[id]);
}

/** Os modificadores de um spawn: o primeiro do tema, os outros do tema + gerais; teto de mecânicas. */
export function modificadoresPara(raridade, key, chave) {
  const [min, max] = DIST.modificadores[raridade] ?? [1, 1];
  const quantos = min + Math.floor(semente(`${chave}:n`) * (max - min + 1));
  const tetoDeMecanica = DIST.mecanicasNoMaximo[raridade] ?? 1;
  const tema = temaDe(key);
  const ordenar = (lista, sal) => [...lista].sort((a, b) => semente(`${chave}:${sal}:${a}`) - semente(`${chave}:${sal}:${b}`));
  const candidatos = [...ordenar(tema.length ? tema : DIST.geral, 'tema'), ...ordenar([...new Set([...tema, ...DIST.geral])], 'resto')];
  const escolhidos = [];
  for (const id of candidatos) {
    if (escolhidos.length >= quantos) break;
    if (escolhidos.includes(id)) continue;
    if (temMecanica(id) && escolhidos.filter(temMecanica).length >= tetoDeMecanica) continue;
    escolhidos.push(id);
  }
  return escolhidos.slice(0, Raridade.CONFIG.raridades[raridade]?.maxModificadores ?? escolhidos.length);
}

/** A criatura que dá o tema ao spawn: a de maior peso. */
const criaturaPrincipal = (s) => [...(s.criaturas ?? [])].sort((a, b) => (b.peso ?? 1) - (a.peso ?? 1))[0]?.key;

/** A ordem em que as raridades são escolhidas (as que vieram depois entram no fim: não mudam as de antes). */
export const ORDEM = ['elite', 'raro', 'modificado', 'unico', 'boss'];

/**
 * Distribui a raridade nos spawns de um mapa (devolve uma CÓPIA). Os escolhidos
 * saem pela ordem da semente (espalhados pelo mapa); spawn de boss fica de fora.
 * Com `manter`, o spawn que já tem raridade/modificador fica como está e conta
 * para a quantidade da raridade dele.
 */
export function distribuir(mapaId, spawns, { manter = false } = {}) {
  const elegiveis = spawns.filter((s) => {
    const key = criaturaPrincipal(s);
    return key && !CATALOGO.bestiary[key]?.boss;
  });
  const n = elegiveis.length;
  const quantos = {
    elite: n ? Math.max(1, Math.round(n / DIST.porMapa.eliteACada)) : 0,
    raro: Math.round(n * DIST.porMapa.raro),
    modificado: Math.round(n * DIST.porMapa.modificado),
    unico: n ? DIST.porMapa.unico ?? 0 : 0,
    boss: n ? DIST.porMapa.boss ?? 0 : 0,
  };
  const jaTem = (s) => manter && (s.raridade || s.modificadores?.length);
  // Quanto de cada raridade já existe (com `manter`): conta para a quantidade dela.
  const existentes = {};
  for (const s of spawns) if (jaTem(s)) existentes[s.raridade ?? 'modificado'] = (existentes[s.raridade ?? 'modificado'] ?? 0) + 1;
  const livres = [...elegiveis].filter((s) => !jaTem(s)).sort((a, b) => semente(`${mapaId}:${a.id}`) - semente(`${mapaId}:${b.id}`));
  // Do zero, a ordem da semente é dividida pelas raridades na `ORDEM`; para COMPLETAR, a
  // mesma conta: a posição de cada raridade na fila é a soma das de antes (as de antes já
  // escolhidas não estão mais na fila, por isso a fila anda só o que falta de cada uma).
  const escolha = new Map();
  let i = 0;
  for (const raridade of ORDEM) {
    const falta = Math.max(0, quantos[raridade] - (existentes[raridade] ?? 0));
    for (let k = 0; k < falta && i < livres.length; k++, i++) {
      const s = livres[i];
      escolha.set(s, { raridade, modificadores: modificadoresPara(raridade, criaturaPrincipal(s), `${mapaId}:${s.id}`) });
    }
  }
  return spawns.map((s) => {
    if (jaTem(s)) return s;
    const { raridade: _r, modificadores: _m, ...resto } = s;
    const e = escolha.get(s);
    return e ? { ...resto, raridade: e.raridade, modificadores: e.modificadores } : resto;
  });
}

function rodar({ gravar, refazer }) {
  const linhas = [];
  const total = { ...Object.fromEntries(ORDEM.map((r) => [r, 0])), mapas: 0, mudaram: 0 };
  for (const arq of readdirSync(RAIZ_HUNTS).filter((f) => f.endsWith('-map.json')).sort()) {
    const id = arq.slice(0, -'-map.json'.length);
    const caminho = join(RAIZ_HUNTS, arq);
    const cru = JSON.parse(readFileSync(caminho, 'utf8'));
    if (!Array.isArray(cru.spawns) || !cru.spawns.length) continue;
    const spawns = distribuir(id, cru.spawns, { manter: !refazer });
    const mudou = JSON.stringify(spawns) !== JSON.stringify(cru.spawns);
    const erros = validar(spawns, { largura: cru.width, altura: cru.height }).filter((e) => /raridade|modificador|aceita/.test(e));
    if (erros.length) {
      linhas.push(`${id}: INVÁLIDO — ${erros.slice(0, 3).join('; ')}`);
      continue;
    }
    const c = Object.fromEntries(ORDEM.map((r) => [r, spawns.filter((s) => s.raridade === r).length]));
    for (const k of ORDEM) total[k] += c[k];
    total.mapas += 1;
    if (mudou) total.mudaram += 1;
    const resumo = ORDEM.map((r) => `${c[r]} ${r}`).join(', ');
    linhas.push(`${id}: ${spawns.length} spawns → ${resumo}${!mudou ? ' — já completo, não mexe' : gravar ? ' — gravado' : ''}`);
    if (gravar && mudou) writeFileSync(caminho, JSON.stringify({ ...cru, spawns }), 'utf8');
  }
  linhas.push(`TOTAL: ${total.mapas} mapas (${total.mudaram} mudam) — ${ORDEM.map((r) => `${total[r]} ${r}`).join(', ')}`);
  return linhas;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const gravar = process.argv.includes('--gravar');
  console.log(`Pasta de mapas: ${RAIZ_HUNTS}${gravar ? '' : '  (só mostrando — use --gravar para gravar)'}`);
  for (const l of rodar({ gravar, refazer: process.argv.includes('--refazer') })) console.log('  ' + l);
  process.exit(0);
}
