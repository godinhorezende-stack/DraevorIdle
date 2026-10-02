// Os EFEITOS TEMPORÁRIOS de um altar: bônus (e penalidades) que valem por um tempo, na caçada em que foram ativados.
//
// Reaproveitam os AFIXOS do equipamento (`afixos.FICHAS`): "+10% Physical Damage" do altar é o mesmo `phys_dmg`
// de uma peça — a ficha, o combate e a comparação já leem essa soma (ver `Afixos.soma`), então nada de conta nova.
// Ficam em `estado.hunt.efeitosDeAltar` (somem ao sair da caçada) e contam no RELÓGIO da sala, não no de parede:
// a caçada offline simulada conta o mesmo tempo que a online.
import { FICHAS, relogioDaSala } from '../afixos.mjs';
import { CONFIG } from './config.mjs';

/** Só dano, velocidade, defesa e resistência (decisão do dono) — nada de XP, loot ou ouro: altar não é fonte de economia. */
export const AFIXOS_DE_ALTAR = [
  'atk_speed', 'cast_speed', 'move_speed', 'phys_dmg', 'fire_dmg', 'energy_dmg', 'earth_dmg', 'ice_dmg', 'death_dmg', 'holy_dmg',
  'spell_dmg', 'weapon_atk_pct', 'crit_chance', 'crit_dmg', 'armour_pct', 'evasion_pct', 'dmg_reduction', 'avoid_damage', 'block',
  'protect_all', 'phys_res', 'fire_res', 'energy_res', 'earth_res', 'ice_res', 'death_res', 'holy_res', 'life_regen_pct', 'hp_max',
];

export const relogioDe = relogioDaSala;

/** Os erros de uma lista de efeitos `[{ afixo, valor }]`; `negativo`: é a lista de PENALIDADE. */
export function validarEfeitos(efeitos, onde, { negativo = false } = {}) {
  const erros = [];
  if (!Array.isArray(efeitos) || !efeitos.length) return [`${onde}: precisa de ao menos um efeito.`];
  if (efeitos.length > CONFIG.limites.altarEfeitosMax) erros.push(`${onde}: no máximo ${CONFIG.limites.altarEfeitosMax} efeitos.`);
  for (const [i, e] of efeitos.entries()) {
    const f = FICHAS[e?.afixo];
    if (!f || !AFIXOS_DE_ALTAR.includes(e.afixo)) erros.push(`${onde}[${i}]: "${e?.afixo}" não é um atributo permitido em altar (dano, velocidade, defesa e resistência).`);
    else if (!Number.isFinite(Number(e.valor)) || (negativo ? Number(e.valor) >= 0 : Number(e.valor) <= 0)) erros.push(`${onde}[${i}]: valor ${negativo ? 'negativo' : 'positivo'} esperado.`);
    else if (Math.abs(Number(e.valor)) > f.max * 2) erros.push(`${onde}[${i}]: valor acima de 2× o teto do atributo (${f.max * 2}).`);
  }
  return erros;
}

/** Liga os efeitos nos estados dados, por `duracaoMs` do relógio da sala. O mesmo altar (`id`) nunca liga duas vezes no mesmo estado. */
export function aplicar(estados, efeitos, duracaoMs, { id, hunt }) {
  for (const estado of estados) {
    const h = estado.hunt;
    if (!h) continue;
    const agora = relogioDe(h);
    // Os vencidos saem (a lista não cresce a cada altar).
    h.efeitosDeAltar = (h.efeitosDeAltar ?? []).filter((x) => x.ate > agora);
    const lista = h.efeitosDeAltar;
    if (lista.some((x) => x.id === id)) continue;
    const ate = agora + duracaoMs;
    for (const e of efeitos) lista.push({ id, afixo: e.afixo, valor: Number(e.valor), ate });
  }
  return hunt;
}
