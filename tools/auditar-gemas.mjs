// A AUDITORIA das gemas ativas (dono, 02/10): o inventário de TODAS as magias e runas do catálogo de ações — os números reais que o motor lê
// (`Acoes.catalogo`, o mesmo `danoMostrado` do balão), por vocação, num personagem de referência. Não altera nada.
//   node tools/auditar-gemas.mjs [--level 300] [--json]
import { personagemDeTeste } from '../game/testes/apoio.mjs';
import * as Acoes from '../game/systems/acoes.mjs';
import * as Ficha from '../game/systems/ficha.mjs';
import * as Treino from '../game/systems/treino.mjs';

const args = process.argv.slice(2);
const opt = (n, p) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : p; };
const LEVEL = Number(opt('level', 300));
const VOCACOES = ['knight', 'paladin', 'sorcerer', 'druid', 'monk'];

/** O personagem de referência: o mesmo level, perícias proporcionais ao level (a da arma e o magic level), sem equipamento além do inicial. */
function referencia(vocacao) {
  const e = personagemDeTeste({ vocacao, level: LEVEL });
  Treino.garantir(e);
  const alto = Math.round(LEVEL * 0.4);
  e.magic.value = alto;
  for (const p of ['melee', 'distance', 'shielding']) if (e.skills?.[p]) e.skills[p].value = alto;
  Ficha.invalidar(e);
  return e;
}

const vistas = new Map();
for (const v of VOCACOES) {
  const e = referencia(v);
  const cat = Acoes.catalogo(e);
  const global = Acoes.intervaloGlobal(e);
  for (const a of [...cat.spells, ...cat.runes]) {
    if (!(a.vocations ?? []).includes(v)) continue;
    const medio = a.damage ? (a.damage.min + a.damage.max) / 2 : 0;
    const cadencia = Math.max(a.cooldown ?? 0, a.groupCooldown ?? 0, global, 1);
    const cura = a.heals && a.damage ? medio : 0;
    const linha = {
      id: a.id, nome: a.name, tipo: a.kind, vocacoes: a.vocations, level: a.level, ml: a.magicLevel, elemento: a.element ?? null,
      papeis: a.papeis ?? [], tags: a.tags ?? [], area: a.area, alcance: a.range, mana: a.mana, recarga: a.cooldown, recargaDoGrupo: a.groupCooldown,
      danoMedio: Math.round(medio), cura: Math.round(cura), cadenciaMs: cadencia,
      dps: a.damage && !a.heals ? Math.round((medio * 1000) / cadencia) : 0,
      curaPorSegundo: cura ? Math.round((cura * 1000) / cadencia) : 0,
      manaPorSegundo: Math.round(((a.mana ?? 0) * 1000) / cadencia * 10) / 10,
      danoPorMana: a.mana && a.damage && !a.heals ? Math.round((medio / a.mana) * 10) / 10 : null,
      curaPorMana: a.mana && cura ? Math.round((cura / a.mana) * 10) / 10 : null,
      dot: a.overTime ?? null, escalaCom: a.escalaCom ?? null, invocacao: !!a.summon,
    };
    const antiga = vistas.get(a.id);
    if (antiga) antiga.porVocacao[v] = { dps: linha.dps, danoMedio: linha.danoMedio, cura: linha.cura };
    else vistas.set(a.id, { ...linha, porVocacao: { [v]: { dps: linha.dps, danoMedio: linha.danoMedio, cura: linha.cura } } });
  }
}
const lista = [...vistas.values()];
if (args.includes('--json')) console.log(JSON.stringify(lista, null, 1));
else for (const l of lista) console.log([l.id, l.vocacoes.join('/'), `L${l.level}`, `ML${l.ml}`, l.elemento ?? '-', `mana ${l.mana}`, `rec ${l.recarga}/${l.recargaDoGrupo}`, `dano ${l.danoMedio}`, `cura ${l.cura}`, `dps ${l.dps}`, l.papeis.join(','), l.tags.join(',')].join(' | '));
