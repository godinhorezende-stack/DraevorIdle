// O SIMULADOR de luta jogador × monstro na linha de comando (etapa 5, dono 02/10): tempo para matar, dano recebido por segundo, chance de
// morte, o efeito de cada defesa e de cada modificador, as classes lado a lado e a progressão por level. Exemplos:
//   node tools/simular-luta.mjs troll --level 100 --vocacao knight
//   node tools/simular-luta.mjs troll --level 100 --raridade raro --mod brutal --mod blindado --modificadores
//   node tools/simular-luta.mjs troll --level 100 --classes
//   node tools/simular-luta.mjs troll --progressao 20,50,100,200,343
import { personagemDeTeste } from '../game/testes/apoio.mjs';
import * as Treino from '../game/systems/treino.mjs';
import * as Sim from '../game/systems/combate/simulador-mob.mjs';

const args = process.argv.slice(2);
const chave = args[0];
const opt = (nome, padrao) => { const i = args.indexOf(`--${nome}`); return i >= 0 ? args[i + 1] : padrao; };
const todos = (nome) => args.flatMap((a, i) => (a === `--${nome}` ? [args[i + 1]] : []));
if (!chave) { console.error('uso: node tools/simular-luta.mjs <chave do bestiário> [--level N] [--vocacao v] [--raridade id] [--mod id]... [--modificadores] [--classes] [--progressao 20,50,...]'); process.exit(1); }
const level = Number(opt('level', 100));
const personagem = (vocacao, lv) => { const e = personagemDeTeste({ vocacao, level: lv }); Treino.garantir(e); e.maxHp = e.maxHp ?? e.hp; return e; };
const mob = { key: chave, raridade: opt('raridade', 'normal'), modificadores: todos('mod') };
const saida = (x) => console.log(JSON.stringify(x, null, 2));
if (args.includes('--classes')) saida(Sim.compararClasses(Object.fromEntries(['knight', 'paladin', 'sorcerer', 'druid', 'monk'].map((v) => [v, personagem(v, level)])), { mob, level }));
else if (args.includes('--modificadores')) saida(Sim.efeitoDosModificadores(personagem(opt('vocacao', 'knight'), level), { key: chave, level, raridade: mob.raridade === 'normal' ? 'raro' : mob.raridade, modificadores: mob.modificadores }));
else if (opt('progressao', null)) saida(Sim.progressao(personagem(opt('vocacao', 'knight'), level), { mob, niveis: opt('progressao').split(',').map(Number) }));
else saida(Sim.simularLuta(personagem(opt('vocacao', 'knight'), level), { mob, level }));
