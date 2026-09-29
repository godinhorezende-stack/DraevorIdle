// Replica o TERRENO de um mapa de hunt que já existe e o povoa com os bichos de outra hunt.
//
// O dono (29/09): "coloque em algum mapa mas esses mobs — replica um mapa mas com esses mobs".
// Infernatil Seal, Jaded Roots e Walking Pillar estavam travadas porque o catálogo real traz os
// BICHOS delas mas não o terreno (só o contorno, sem `<id>-map.json`). Aqui cada uma ganha o mapa
// de um doador — mesmo chão, mesmas paredes, mesmos pontos de nascimento (posição, raio e
// quantidade) — só que com as criaturas da hunt, repartidas ponto a ponto.
//
// Uso (da raiz do repositório):   node tools/replicar-mapa-com-mobs.mjs
// Idempotente: refaz os três arquivos a partir dos doadores. O doador não é tocado.
import { readFileSync, writeFileSync } from 'node:fs';
import { CATALOGO } from '../game/systems/dados.mjs';

const RAIZ = new URL('../game/gamedata/hunts/', import.meta.url);

// alvo (a hunt que ganha o mapa) -> doador (o mapa copiado)
export const REPLICAS = {
  'infernatil-seal': 'feru-way', // demônios e inferno: o Feru Way já tem vexclaw, hellflayer e grimeleech
  'jaded-roots': 'flimsy-lost-souls-venore',
  'walking-pillar': 'warzone-2',
};

/** O mapa do doador com os spawns repovoados pelas criaturas do alvo. Devolve o objeto (sem gravar). */
export function replicar(alvoId, doadorId, lerMapa = (id) => JSON.parse(readFileSync(new URL(`${id}-map.json`, RAIZ), 'utf8'))) {
  const hunt = CATALOGO.hunts.find((h) => h.id === alvoId);
  const chaves = (hunt?.creatures ?? []).map((c) => c.key);
  if (!chaves.length) throw new Error(`${alvoId}: a hunt não tem criaturas no catálogo`);
  const doador = lerMapa(doadorId);
  const spawns = doador.spawns.map((s, i) => ({ ...s, criaturas: [{ key: chaves[i % chaves.length], peso: 1 }] }));
  return {
    ...doador,
    spawns,
    _replica: `Terreno e pontos de nascimento do mapa "${doadorId}", povoados com os bichos de "${alvoId}" (tools/replicar-mapa-com-mobs.mjs).`,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const [alvo, doador] of Object.entries(REPLICAS)) {
    const mapa = replicar(alvo, doador);
    writeFileSync(new URL(`${alvo}-map.json`, RAIZ), JSON.stringify(mapa));
    const bichos = [...new Set(mapa.spawns.map((s) => s.criaturas[0].key))];
    console.log(`${alvo}: ${mapa.width}x${mapa.height}, ${mapa.spawns.length} pontos (de ${doador}) com ${bichos.join(', ')}`);
  }
}
