// MIGRAÇÃO ÚNICA: grava no arquivo de cada mapa de hunt o bloco `spawns`
// (ver `systems/mapa/spawns.mjs`), a partir das fontes de antes:
//
//   - o catálogo (`catalog-real.json`, `hunts[].posicoes`): os pontos
//     capturados do original, já no referencial do mapa (`pontosNoMapa`), com
//     `density` virando a `quantidade` de cada ponto (decisão do dono: "a do
//     original");
//   - só a captura da entrada (`hunts-spawns-capturados.json`): os pontos
//     vistos ao entrar, e — decisão do dono — pontos FIXOS gerados UMA vez
//     aqui, na área alcançável, com as criaturas da própria hunt, até
//     `REFORCO_PADRAO` bichos a cada 100 casas. Gravados, viram pontos normais
//     do mapa; o código do jogo nunca mais inventa ponto.
//
// Uso (na pasta de mapas que o jogo lê — em produção, dentro do container,
// onde `gamedata/hunts` é a pasta de dados):
//   node game/admin/migrar-spawns.mjs            # só mostra o que faria
//   node game/admin/migrar-spawns.mjs --gravar   # grava
// Mapa que já tem `spawns` não é tocado (dá para rodar de novo sem estrago).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { CATALOGO } from '../systems/dados.mjs';
import { RAIZ_HUNTS, SPAWNS_CAPTURADOS, REFORCO_DE_SPAWN, spawnsCapturados, pontosNoMapa, mapaRealCapturado } from '../systems/hunt/terreno.mjs';
import { gradeDaHunt } from '../systems/hunt/terreno.mjs';
import { RAIO_DO_SPAWN } from '../systems/hunt/caminho.mjs';
import { FASES } from '../systems/campanha.mjs';
import { validar } from '../systems/mapa/spawns.mjs';

/** Bichos a cada 100 casas alcançáveis nas hunts só com a captura da entrada (o mesmo alvo do reforço de antes). */
export const REFORCO_PADRAO = 2.5;

/** Os pontos de spawn de ANTES (catálogo ou captura), no formato `spawns` do mapa. */
export function spawnsDasFontesAntigas(huntId) {
  const hunt = CATALOGO.hunts.find((h) => h.id === huntId);
  const grade = gradeDaHunt(hunt ?? { id: huntId });
  const doCatalogo = hunt?.posicoes?.length;
  let pontos;
  let quantidade = 1;
  if (doCatalogo) {
    pontos = pontosNoMapa(hunt, grade.mapa?.floors ? grade.mapa : null);
    quantidade = Math.max(1, Math.round(hunt.density ?? 1));
  } else if (SPAWNS_CAPTURADOS[huntId]?.length) {
    if (!REFORCO_DE_SPAWN[huntId]) REFORCO_DE_SPAWN[huntId] = REFORCO_PADRAO;
    pontos = spawnsCapturados(huntId);
  } else {
    return [];
  }
  // Andar por onde a rota não passa fica de fora: ninguém chega lá (a regra de antes).
  const andaresDaRota = new Set([grade.z, ...(grade.percurso ?? []).map((p) => p.z ?? grade.z)]);
  // O mesmo ponto com a mesma criatura vira um spawn só, com a quantidade somada.
  const porPonto = new Map();
  for (const p of pontos) {
    const z = p.z ?? grade.z;
    if (!p.key || !andaresDaRota.has(z)) continue;
    const k = `${p.x},${p.y},${z},${p.key}`;
    const s = porPonto.get(k) ?? { x: p.x, y: p.y, z, raio: RAIO_DO_SPAWN, quantidade: 0, tipo: 'normal', criaturas: [{ key: p.key, peso: 1 }] };
    s.quantidade += quantidade;
    porPonto.set(k, s);
  }
  return [...porPonto.values()].map((s, i) => ({ id: `s${i + 1}`, ...s }));
}

function migrar({ gravar }) {
  const linhas = [];
  for (const f of FASES) {
    const caminho = join(RAIZ_HUNTS, `${f.huntId}-map.json`);
    if (!existsSync(caminho)) {
      linhas.push(`${f.huntId}: sem arquivo de mapa — pulado`);
      continue;
    }
    // O arquivo CRU: `mapaRealCapturado` bloqueia água/lava em memória, e isso não vai para o disco.
    const cru = JSON.parse(readFileSync(caminho, 'utf8'));
    if (Array.isArray(cru.spawns)) {
      linhas.push(`${f.huntId}: já tem ${cru.spawns.length} spawns — não mexe`);
      continue;
    }
    mapaRealCapturado(f.huntId);
    const spawns = spawnsDasFontesAntigas(f.huntId);
    if (!spawns.length) {
      linhas.push(`${f.huntId}: nenhuma fonte de spawn — pulado`);
      continue;
    }
    const erros = validar(spawns, { largura: cru.width, altura: cru.height });
    if (erros.length) {
      linhas.push(`${f.huntId}: INVÁLIDO — ${erros.slice(0, 3).join('; ')}`);
      continue;
    }
    const bichos = spawns.reduce((n, s) => n + s.quantidade, 0);
    linhas.push(`${f.huntId}: ${spawns.length} spawns, ${bichos} bichos por instância${gravar ? ' — gravado' : ''}`);
    if (gravar) writeFileSync(caminho, JSON.stringify({ ...cru, spawns }), 'utf8');
  }
  return linhas;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const gravar = process.argv.includes('--gravar');
  console.log(`Pasta de mapas: ${RAIZ_HUNTS}${gravar ? '' : '  (só mostrando — use --gravar para gravar)'}`);
  for (const l of migrar({ gravar })) console.log('  ' + l);
  process.exit(0);
}
