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
// Todos agem na FICHA (`Ficha.combate`), a mesma do combate, da tela e do balão.

const NUMERO = (v) => Number.isFinite(v);
export const REGRAS = {
  habilidade: (k) => typeof k.id === 'string' && k.id.length > 0,
  atributoParaTag: (k) => ['str', 'dex', 'int'].includes(k.atributo) && typeof k.tag === 'string' && NUMERO(k.porPonto),
  multiplicarStat: (k) => typeof k.stat === 'string' && NUMERO(k.fator),
  conversao: (k) => typeof k.de === 'string' && typeof k.para === 'string' && NUMERO(k.pct),
  texto: (k) => typeof k.texto === 'string' && k.texto.length > 0,
};

export const valida = (k) => !!k && !!REGRAS[k.regra]?.(k);

/**
 * Aplica os keystones alocados na ficha já montada (muta e devolve `ficha`).
 * `principais`: STR/DEX/INT totais (a ficha já calculou).
 */
export function aplicarNaFicha(ficha, keystones, principais) {
  for (const k of keystones ?? []) {
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
