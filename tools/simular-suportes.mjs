// A AUDITORIA dos suportes com o simulador de rotação (dono, 02/10): cada suporte ligado a gemas representativas de cada vocação, em 1 e em 5
// alvos, medindo a variação do DPS da gema e do gasto de mana contra a MESMA gema sem suporte. Roda o motor de verdade. Não altera nada.
//   node tools/simular-suportes.mjs [--duracao 30] [--json]
import { personagemDeTeste, PERSONAGEM } from '../game/testes/apoio.mjs';
import * as Rot from '../game/systems/combate/simulador-rotacao.mjs';
import * as Treino from '../game/systems/treino.mjs';
import * as Ficha from '../game/systems/ficha.mjs';
import * as Gemas from '../game/systems/skills/gemas.mjs';
import * as Acoes from '../game/systems/acoes.mjs';
import { compativel } from '../game/engine/sockets-de-gema.mjs';

const args = process.argv.slice(2);
const opt = (n, p) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : p; };
const DUR = Number(opt('duracao', 30)) * 1000;
const ALVOS = {
  sorcerer: ['spell-flame-strike', 'spell-fire-wave', 'spell-energy-strike', 'spell-great-fire-wave'],
  knight: ['spell-brutal-strike', 'spell-shield-bash', 'spell-front-sweep'],
  paladin: ['spell-ethereal-spear', 'spell-ethereal-barrage', 'spell-divine-missile'],
  druid: ['spell-terra-strike', 'spell-ice-wave', 'spell-forked-thorns'],
  monk: ['spell-double-jab', 'spell-flurry-of-blows', 'spell-chained-penance'],
};
function personagem(v) {
  const e = personagemDeTeste({ vocacao: v, level: 300 });
  Treino.garantir(e);
  const alto = 120;
  e.magic.value = alto;
  for (const p of ['melee', 'distance', 'shielding']) if (e.skills?.[p]) e.skills[p].value = alto;
  Ficha.invalidar(e);
  return e;
}
const medir = (v, skill, supports, alvos) => {
  const e = personagem(v);
  const r = Rot.vestirBuild(e, { grupos: [{ skill, supports }] });
  if (!r.ok) return null;
  return Rot.medirRotacao(e, PERSONAGEM, { duracaoMs: DUR, alvos, semente: 3 });
};
const linhas = [];
const tagsDe = (v, skill) => Acoes.catalogo(personagem(v)).spells.find((a) => a.id === skill)?.tags ?? [];
for (const [id, def] of Object.entries(Gemas.SUPPORTS)) {
  for (const [v, gemas] of Object.entries(ALVOS)) {
    for (const skill of gemas) {
      if (!compativel(def, tagsDe(v, skill))) continue; // só os casos em que o suporte vale: o incompatível não entra na média
      for (const alvos of [1, 5]) {
        const base = medir(v, skill, [], alvos);
        const com = medir(v, skill, [id], alvos);
        if (!base || !com) continue;
        linhas.push({ suporte: id, vocacao: v, skill, alvos, dps0: base.dpsDasGemas, dps1: com.dpsDasGemas, mana0: base.manaPorSegundo, mana1: com.manaPorSegundo, exec0: base.execucoes, exec1: com.execucoes, danoPorMana0: base.danoPorMana, danoPorMana1: com.danoPorMana });
      }
    }
  }
}
if (args.includes('--json')) console.log(JSON.stringify(linhas));
else {
  const por = {};
  for (const l of linhas) (por[l.suporte] ??= []).push(l);
  for (const [id, ls] of Object.entries(por)) {
    const d = (f) => ls.filter(f).map((l) => (l.dps0 ? l.dps1 / l.dps0 : 1));
    const med = (a) => (a.length ? a.sort((x, y) => x - y)[a.length >> 1] : null);
    const um = med(d((l) => l.alvos === 1)), cinco = med(d((l) => l.alvos === 5));
    const mana = med(ls.map((l) => (l.mana0 ? l.mana1 / l.mana0 : 1)));
    const max = Math.max(...ls.map((l) => (l.dps0 ? l.dps1 / l.dps0 : 1)));
    console.log(`${id.padEnd(30)} DPS 1 alvo ×${um?.toFixed(2)} | 5 alvos ×${cinco?.toFixed(2)} | máx ×${max.toFixed(2)} | mana/s ×${mana?.toFixed(2)} | casos ${ls.length / 2}`);
  }
}
