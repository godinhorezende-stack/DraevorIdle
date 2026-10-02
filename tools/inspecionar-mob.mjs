// O DETALHAMENTO dos atributos de um monstro (dono, 02/10): vida, dano, precisão, evasão, armadura, bloqueio, resistências, com a origem de
// cada parcela — as mesmas contas do jogo (`game/systems/mobs/atributos.mjs`). Exemplo:
//   node tools/inspecionar-mob.mjs troll --level 100 --raridade raro --mod blindado --mod veloz
import { criarMonstro } from '../game/systems/hunt/monstros.mjs';
import * as Raridade from '../game/systems/mobs/raridade.mjs';
import * as Mobs from '../game/systems/mobs/atributos.mjs';

const args = process.argv.slice(2);
const chave = args[0];
const opt = (nome, padrao) => { const i = args.indexOf(`--${nome}`); return i >= 0 ? args[i + 1] : padrao; };
const todos = (nome) => args.flatMap((a, i) => (a === `--${nome}` ? [args[i + 1]] : []));
if (!chave) { console.error('uso: node tools/inspecionar-mob.mjs <chave do bestiário> [--level N] [--raridade id] [--mod id]...'); process.exit(1); }
const m = Raridade.aplicar(criarMonstro({ key: chave, x: 1, y: 1 }, null), { raridade: opt('raridade', 'normal'), modificadores: todos('mod') });
const level = Number(opt('level', 100)) + (m.levelExtra ?? 0);
console.log(JSON.stringify({ chave, nome: m.name, raridade: m.raridade ?? 'normal', mods: m.mods ?? [], atributos: Mobs.atributosFinais(m, level) }, null, 2));
