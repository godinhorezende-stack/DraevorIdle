// Os KEYSTONES da árvore de passivas: nós que MUDAM uma regra, não só somam
// número. Cada keystone é dado (`{ regra, ...parâmetros }` no nó) e cai num
// dos tipos abaixo — para criar um keystone novo de um tipo que já existe,
// basta o dado; um TIPO novo é uma entrada em `REGRAS` + onde ele age.
//
//   habilidade       — um efeito com gancho no combate (as 15 "habilidades de
//                      medalhão" da árvore antiga: Cataclismo, Mil mãos, Última
//                      muralha...). O gancho mora em `systems/arvore.mjs`
//                      (`fatorDasHabilidades`, `depoisDoGolpe`, `depoisDaMagia`,
//                      `aoMatar`, `danoRecebido`...), que pergunta `tem(id)`.
//   atributoParaTag  — parte de um atributo vira dano de uma tag (Arqueiro
//                      Arcano: cada 10 de INT → +1% de dano Ranged).
//   multiplicarStat  — um número da ficha mais eficiente (Guerreiro de Sangue:
//                      Life Leech ×1,5).
//   conversao        — parte do dano de um tipo sai como outro (Avatar do Fogo:
//                      50% do físico do golpe da arma como fogo).
//   texto            — só o texto, sem efeito ainda (as keystones da árvore do PoE,
//                      sistema de itens do PoE: a mecânica de cada uma vem depois).
//   poe              — uma keystone do PoE com mecânica no Draevor (`IDS_DO_POE`): o que é
//                      da ficha mora aqui (`aplicarNaFicha`); o que é do combate pergunta
//                      `Passivas.temHabilidade(estado, id)` (acerto, dano recebido, custo...).
// Todos agem na FICHA (`Ficha.combate`), a mesma do combate, da tela e do balão.

import { CONFIG as ATRIBUTOS } from '../personagem/atributos.mjs';

const NUMERO = (v) => Number.isFinite(v);
/** As keystones do PoE com mecânica (o mapa está em `gamedata/itens-poe/traducao-arvore.json` → keystones). */
export const IDS_DO_POE = new Set(['reflexosDeFerro', 'posturaInabalavel', 'tecnicaResoluta', 'tecnicaPrecisa', 'vontadeDeFerro', 'sobrecargaElemental', 'sintoniaDaDor', 'menteSobreMateria', 'golpesReveladores', 'magiaSanguinea', 'conduite']);
export const REGRAS = {
  habilidade: (k) => typeof k.id === 'string' && k.id.length > 0,
  atributoParaTag: (k) => ['str', 'dex', 'int'].includes(k.atributo) && typeof k.tag === 'string' && NUMERO(k.porPonto),
  multiplicarStat: (k) => typeof k.stat === 'string' && NUMERO(k.fator),
  conversao: (k) => typeof k.de === 'string' && typeof k.para === 'string' && NUMERO(k.pct),
  texto: (k) => typeof k.texto === 'string' && k.texto.length > 0,
  poe: (k) => IDS_DO_POE.has(k.id),
};

export const valida = (k) => !!k && !!REGRAS[k.regra]?.(k);

/**
 * Aplica os keystones alocados na ficha já montada (muta e devolve `ficha`).
 * `principais`: STR/DEX/INT totais (a ficha já calculou).
 */
export function aplicarNaFicha(ficha, keystones, principais, estado = null) {
  for (const k of keystones ?? []) {
    if (k.regra === 'poe') {
      aplicarDoPoe(ficha, k.id, principais, estado);
      continue;
    }
    if (k.regra === 'atributoParaTag') {
      const pct = Math.round((principais?.[k.atributo] ?? 0) * k.porPonto * 100) / 100;
      if (!pct) continue;
      ficha.afinidades = { ...(ficha.afinidades ?? {}), [k.tag]: (ficha.afinidades?.[k.tag] ?? 0) + pct };
      ficha.fontesDasAfinidades = { ...(ficha.fontesDasAfinidades ?? {}), [k.tag]: [...(ficha.fontesDasAfinidades?.[k.tag] ?? []), { especializacao: `Keystone: ${k.nome}`, pct }] };
    } else if (k.regra === 'multiplicarStat') {
      if (Number.isFinite(ficha[k.stat])) ficha[k.stat] *= k.fator;
    } else if (k.regra === 'conversao' && k.de === 'physical') {
      // A parte do golpe físico que sai como outro elemento: o mesmo campo do imbuement elemental da arma.
      const atual = ficha.imbuElemental;
      if (!atual || atual.pct < k.pct) ficha.imbuElemental = { tipo: k.para, pct: k.pct };
    }
  }
  return ficha;
}

/** O teto da chance de bloqueio (o do PoE: 75%). */
const BLOQUEIO_MAXIMO = 0.75;

/** A parte da FICHA das keystones do PoE (a do combate pergunta `Passivas.temHabilidade`). */
function aplicarDoPoe(ficha, id, principais, estado) {
  const semCritico = () => {
    ficha.critChance = 0;
    ficha.critChanceMagia = 0;
  };
  const multiplicarDano = (f) => {
    if (ficha.damage) ficha.damage = { ...ficha.damage, min: Math.round(ficha.damage.min * f), max: Math.round(ficha.damage.max * f) };
    if (ficha.danoDeEscala) ficha.danoDeEscala = { ...ficha.danoDeEscala, min: Math.round(ficha.danoDeEscala.min * f), max: Math.round(ficha.danoDeEscala.max * f) };
    if (NUMERO(ficha.ataqueMin)) ficha.ataqueMin = Math.round(ficha.ataqueMin * f);
    if (NUMERO(ficha.ataqueMax)) ficha.ataqueMax = Math.round(ficha.ataqueMax * f);
  };
  switch (id) {
    case 'reflexosDeFerro': {
      // Converte toda Evasão em Armadura.
      const ev = ficha.evasion ?? 0;
      ficha.armor = (ficha.armor ?? 0) + ev;
      if (NUMERO(ficha.armorMin)) ficha.armorMin += ev;
      if (NUMERO(ficha.armorMax)) ficha.armorMax += ev;
      ficha.evasion = 0;
      break;
    }
    case 'posturaInabalavel':
      // Não evade; não pode ser atordoado (no Draevor: o teto da resistência a controle).
      ficha.evasion = 0;
      ficha.resistenciaAControle = Math.max(ficha.resistenciaAControle ?? 0, ficha.limites?.resistenciaAControle ?? 75);
      break;
    case 'tecnicaResoluta':
      // Os acertos não podem ser evadidos; nunca crítico.
      semCritico();
      ficha.nuncaErra = true;
      break;
    case 'tecnicaPrecisa':
      // 40% mais Dano de Ataque se a Precisão for maior que a Vida máxima; nunca crítico.
      semCritico();
      if ((ficha.accuracy ?? 0) > (estado?.maxHp ?? Infinity)) multiplicarDano(1.4);
      break;
    case 'vontadeDeFerro': {
      // O bônus de dano da Força também vale para o dano mágico (o mesmo % que a STR dá ao físico).
      const pct = Math.round((principais?.str ?? 0) * (ATRIBUTOS.efeitos.STR_PHYSICAL_DAMAGE_PER_POINT ?? 0) * 100) / 100;
      if (pct) {
        ficha.afinidades = { ...(ficha.afinidades ?? {}), spell: (ficha.afinidades?.spell ?? 0) + pct };
        ficha.fontesDasAfinidades = { ...(ficha.fontesDasAfinidades ?? {}), spell: [...(ficha.fontesDasAfinidades?.spell ?? []), { especializacao: 'Keystone: Vontade de Ferro', pct }] };
      }
      break;
    }
    case 'sobrecargaElemental': {
      // Golpes críticos sem dano extra; 40% mais dano elemental (aqui sempre ligado).
      ficha.critMultiplier = 1;
      const d = { ...(ficha.danoDoElemento ?? {}) };
      for (const el of ['fire', 'ice', 'energy']) d[el] = (d[el] ?? 0) + 40;
      ficha.danoDoElemento = d;
      break;
    }
    case 'golpesReveladores':
      // Chance de bloquear dobrada (até 75%); o golpe bloqueado ainda causa 65% (no combate).
      for (const k of ['blockChance', 'blockChanceMin', 'blockChanceMax']) if (NUMERO(ficha[k])) ficha[k] = Math.min(BLOQUEIO_MAXIMO, ficha[k] * 2);
      break;
    default:
      // sintoniaDaDor, menteSobreMateria, magiaSanguinea: só no combate.
      break;
  }
}
