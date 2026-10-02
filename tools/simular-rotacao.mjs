// O SIMULADOR DE ROTAÇÃO na linha de comando (dono, 02/10): roda o motor de verdade (`Cacadas.tique`) com as gemas encaixadas e mede o
// DPS REAL (com o intervalo global, a conjuração, a mana e o tique de 250 ms), não o teórico da auditoria.
//   node tools/simular-rotacao.mjs --vocacao sorcerer --level 300 --arma "wand of vortex" \
//        --grupo spell-flame-strike+greater-damage+multiple-projectiles --grupo spell-fire-wave --alvos 5 --duracao 60
//   node tools/simular-rotacao.mjs --matriz [--level 300] [--duracao 30]   (cada gema de ataque sozinha, por vocação, em 1 e em 5 alvos)
// `--grupo skill[+suporte…]` (repetível; a ORDEM é a prioridade da rotação). Ver `game/systems/combate/simulador-rotacao.mjs`.
import { personagemDeTeste, PERSONAGEM } from '../game/testes/apoio.mjs';
import * as Rot from '../game/systems/combate/simulador-rotacao.mjs';
import * as Acoes from '../game/systems/acoes.mjs';
import * as Treino from '../game/systems/treino.mjs';
import * as Ficha from '../game/systems/ficha.mjs';

const args = process.argv.slice(2);
const opt = (n, p) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : p; };
const todos = (n) => args.flatMap((a, i) => (a === `--${n}` ? [args[i + 1]] : []));
const LEVEL = Number(opt('level', 300));
const DURACAO = Number(opt('duracao', 60)) * 1000;
const SEMENTE = Number(opt('semente', 1));

/** O personagem de referência da auditoria: o level pedido e as perícias a 40% dele. */
function personagem(vocacao) {
  const e = personagemDeTeste({ vocacao, level: LEVEL });
  Treino.garantir(e);
  const alto = Math.round(LEVEL * 0.4);
  e.magic.value = alto;
  for (const p of ['melee', 'distance', 'shielding']) if (e.skills?.[p]) e.skills[p].value = alto;
  Ficha.invalidar(e);
  return e;
}

function rodar(vocacao, grupos, extra = {}) {
  const e = personagem(vocacao);
  const v = Rot.vestirBuild(e, { grupos, arma: opt('arma', null) });
  if (!v.ok) return v;
  return Rot.medirRotacao(e, PERSONAGEM, { duracaoMs: DURACAO, semente: SEMENTE, ...extra });
}

if (args.includes('--matriz')) {
  const linhas = [];
  for (const voc of ['knight', 'paladin', 'sorcerer', 'druid', 'monk']) {
    const cat = Acoes.catalogo(personagem(voc));
    for (const a of cat.spells) {
      if (!(a.vocations ?? []).includes(voc) || !a.damage || a.heals || !a.papeis?.includes('attack')) continue;
      const um = rodar(voc, [{ skill: a.id }], { alvos: 1 });
      const cinco = rodar(voc, [{ skill: a.id }], { alvos: 5 });
      if (!um.ok || !cinco.ok) { linhas.push({ voc, id: a.id, erro: um.erro ?? cinco.erro }); continue; }
      linhas.push({ voc, id: a.id, mana: a.mana, dps1: um.dpsDasGemas, dps5: cinco.dpsDasGemas, dpsTotal1: um.dps, manaPorSegundo: um.manaPorSegundo, regeneracao: um.regeneracaoDeMana, sustentavel: um.sustentavel, danoPorMana: um.danoPorMana, tempoSemGolpe: um.tempoSemGolpe });
    }
  }
  if (args.includes('--json')) console.log(JSON.stringify(linhas, null, 1));
  else for (const l of linhas) console.log(l.erro ? `${l.voc} ${l.id} ERRO ${l.erro}` : `${l.voc.padEnd(8)} ${l.id.padEnd(34)} mana ${String(l.mana).padStart(5)} | DPS da gema 1 alvo ${String(l.dps1).padStart(5)} | 5 alvos ${String(l.dps5).padStart(5)} | mana/s ${String(l.manaPorSegundo).padStart(6)} (regen ${l.regeneracao}) ${l.sustentavel ? '' : 'SEM MANA'}`);
} else {
  const grupos = todos('grupo').map((g) => { const [skill, ...supports] = g.split('+'); return { skill, supports }; });
  if (!grupos.length) { console.error('Use --grupo skill[+suporte...] (repetível) ou --matriz.'); process.exit(1); }
  console.log(JSON.stringify(rodar(opt('vocacao', 'sorcerer'), grupos, { alvos: Number(opt('alvos', 1)) }), null, 2));
}
