// O SIMULADOR de combate na linha de comando (dono, 02/10): compara uma habilidade de um personagem de teste contra um alvo, com as mesmas
// contas do jogo (`game/systems/combate/simulador.mjs`). Exemplo:
//   node tools/simular-combate.mjs --vocacao sorcerer --level 300 --ml 120 --habilidade spell-buzz --alvo-level 300 --hp 50000 --resist energy=40
// Opções: --vocacao, --level, --ml (magic level), --habilidade (id da ação), --alvo-level, --hp (do alvo), --resist tipo=pct (repetível),
//   --af id=valor (afixo no anel, repetível: crit_chance, elem_pen, double_attack...).
import { personagemDeTeste, comSkills } from '../game/testes/apoio.mjs';
import * as Simulador from '../game/systems/combate/simulador.mjs';
import * as Ficha from '../game/systems/ficha.mjs';
import * as Afixos from '../game/systems/afixos.mjs';
import * as Treino from '../game/systems/treino.mjs';
import { ITEM_CATALOG } from '../game/systems/dados.mjs';

const args = process.argv.slice(2);
const opt = (nome, padrao) => { const i = args.indexOf(`--${nome}`); return i >= 0 ? args[i + 1] : padrao; };
const todos = (nome) => args.flatMap((a, i) => (a === `--${nome}` ? [args[i + 1]] : []));

const e = personagemDeTeste({ vocacao: opt('vocacao', 'sorcerer'), level: Number(opt('level', 300)) });
Treino.garantir(e);
e.magic.value = Number(opt('ml', Math.round(e.level * 0.4)));
const id = opt('habilidade', 'spell-buzz');
const ANEL = Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'might ring').id);
e.equipment.ring = { id: ANEL, count: 1, af: todos('af').map((x) => { const [k, v] = x.split('='); return { id: k, nivel: 5, value: Number(v) }; }) };
comSkills(e, [id]);
Afixos.sincronizarMaximos(e);
Ficha.invalidar(e);
const resistencias = Object.fromEntries(todos('resist').map((x) => { const [k, v] = x.split('='); return [k, Number(v)]; }));
const r = Simulador.simular(e, id, { level: Number(opt('alvo-level', e.level)), hp: Number(opt('hp', 0)) || undefined, resistencias });
console.log(JSON.stringify(r, null, 2));
console.log('mitigação contra um golpe físico de 1.000:', JSON.stringify(Simulador.mitigacao(e, { dano: 1000 })));
