// A configuração dos encontros (`gamedata/encontros.json`): tetos de economia/servidor e as tabelas de recompensa.
import { readFileSync } from 'node:fs';

export const CONFIG = JSON.parse(readFileSync(new URL('../../gamedata/encontros.json', import.meta.url), 'utf8'));
