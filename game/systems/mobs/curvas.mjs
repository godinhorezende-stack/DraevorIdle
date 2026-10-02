// As CURVAS dos atributos dos monstros (config `gamedata/mobs/atributos.json`) — o mínimo que não depende do bestiário nem do combate,
// para `personagem/atributos.mjs` (a chance de acerto e de esquiva) e `mobs/atributos.mjs` lerem do MESMO lugar sem ciclo de import.
import { readFileSync } from 'node:fs';

export const CONFIG = JSON.parse(readFileSync(new URL('../../gamedata/mobs/atributos.json', import.meta.url), 'utf8'));

/** O valor da curva de um atributo neste level: `base + porLevel × level` (sem os fatores). */
export const daCurva = (atributo, level) => (CONFIG.curvas[atributo]?.base ?? 0) + (CONFIG.curvas[atributo]?.porLevel ?? 0) * Math.max(0, level ?? 0);
