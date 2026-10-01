// RARIDADE NOS MAPAS JÁ CRIADOS (pedido do dono, 01/10): grava `raridade` e
// `modificadores` nos spawns de cada `gamedata/hunts/<id>-map.json`, pela
// distribuição de `gamedata/mobs/distribuicao.json` (moderada, modificadores
// pelo tema do mob). Nada é sorteado no jogo: a escolha é FIXA — a semente é o
// id do mapa + o id do spawn —, então rodar de novo dá o mesmo resultado.
//
// Uso:
//   node game/admin/raridade-dos-mapas.mjs            # só mostra o que faria
//   node game/admin/raridade-dos-mapas.mjs --gravar   # grava
// Mapa que já tem algum spawn com raridade/modificador não é tocado (o dono
// pode ter mexido nele no editor) — `--refazer` passa por cima disso.
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

/**
 * Distribui a raridade nos spawns de um mapa (devolve uma CÓPIA). Os escolhidos
 * saem pela ordem da semente (espalhados pelo mapa); spawn de boss fica de fora.
 */
export function distribuir(mapaId, spawns) {
  const elegiveis = spawns.filter((s) => {
    const key = criaturaPrincipal(s);
    return key && !CATALOGO.bestiary[key]?.boss;
  });
  const n = elegiveis.length;
  const quantos = {
    elite: n ? Math.max(1, Math.round(n / DIST.porMapa.eliteACada)) : 0,
    raro: Math.round(n * DIST.porMapa.raro),
    modificado: Math.round(n * DIST.porMapa.modificado),
  };
  const ordem = [...elegiveis].sort((a, b) => semente(`${mapaId}:${a.id}`) - semente(`${mapaId}:${b.id}`));
  const escolha = new Map();
  let i = 0;
  for (const raridade of ['elite', 'raro', 'modificado']) {
    for (let k = 0; k < quantos[raridade] && i < ordem.length; k++, i++) {
      const s = ordem[i];
      escolha.set(s, { raridade, modificadores: modificadoresPara(raridade, criaturaPrincipal(s), `${mapaId}:${s.id}`) });
    }
  }
  return spawns.map((s) => {
    const { raridade: _r, modificadores: _m, ...resto } = s;
    const e = escolha.get(s);
    return e ? { ...resto, raridade: e.raridade, modificadores: e.modificadores } : resto;
  });
}

function rodar({ gravar, refazer }) {
  const linhas = [];
  const total = { elite: 0, raro: 0, modificado: 0, mapas: 0 };
  for (const arq of readdirSync(RAIZ_HUNTS).filter((f) => f.endsWith('-map.json')).sort()) {
    const id = arq.slice(0, -'-map.json'.length);
    const caminho = join(RAIZ_HUNTS, arq);
    const cru = JSON.parse(readFileSync(caminho, 'utf8'));
    if (!Array.isArray(cru.spawns) || !cru.spawns.length) continue;
    if (!refazer && cru.spawns.some((s) => s.raridade || s.modificadores?.length)) {
      linhas.push(`${id}: já tem raridade — não mexe`);
      continue;
    }
    const spawns = distribuir(id, cru.spawns);
    const erros = validar(spawns, { largura: cru.width, altura: cru.height }).filter((e) => /raridade|modificador|aceita/.test(e));
    if (erros.length) {
      linhas.push(`${id}: INVÁLIDO — ${erros.slice(0, 3).join('; ')}`);
      continue;
    }
    const conta = (r) => spawns.filter((s) => s.raridade === r).length;
    const c = { elite: conta('elite'), raro: conta('raro'), modificado: conta('modificado') };
    for (const k of Object.keys(c)) total[k] += c[k];
    total.mapas += 1;
    linhas.push(`${id}: ${spawns.length} spawns → ${c.elite} elite, ${c.raro} raro, ${c.modificado} modificado${gravar ? ' — gravado' : ''}`);
    if (gravar) writeFileSync(caminho, JSON.stringify({ ...cru, spawns }), 'utf8');
  }
  linhas.push(`TOTAL: ${total.mapas} mapas — ${total.elite} elite, ${total.raro} raro, ${total.modificado} modificado`);
  return linhas;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const gravar = process.argv.includes('--gravar');
  console.log(`Pasta de mapas: ${RAIZ_HUNTS}${gravar ? '' : '  (só mostrando — use --gravar para gravar)'}`);
  for (const l of rodar({ gravar, refazer: process.argv.includes('--refazer') })) console.log('  ' + l);
  process.exit(0);
}
