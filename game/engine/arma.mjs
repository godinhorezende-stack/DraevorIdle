// OS ATRIBUTOS DA ARMA — a conta CENTRAL (pura, sem estado) do dano físico, da velocidade de ataque (APS), da chance de crítico e do DPS físico de UMA arma, no estilo "base + modificadores
// locais + qualidade" do Path of Exile 1, adaptada ao Draevor. Vive em `engine/` porque o MESMO arquivo é lido pelo servidor (`systems/ficha.mjs`, o editor de itens) e pelo cliente
// (o tooltip: `/packages/shared/src/arma.mjs`): o número do tooltip e o que a engine usa saem desta função, nunca de duas cópias.
//
// O QUE É O QUÊ (nunca misturar):
//   BASE da arma ......... o que a base (tipo de arma) traz de fábrica: dano físico mín./máx., APS, chance de crítico, alcance, requisitos. Vem do catálogo do Canary (+ overrides) e,
//                          no dano, da FAIXA que a peça sorteou no drop pela raridade (`peca.base.attack`). Não depende de atributo do personagem nem de modificador aleatório.
//   MODIFICADORES LOCAIS . valem SÓ para esta arma e mudam os números dela (os que o item mostra): dano físico adicional (mín./máx.), % de dano físico, % de velocidade de ataque,
//                          % de chance de crítico. Ficam na peça (`peca.locais`), separados da base.
//   QUALIDADE ............ 0 a 20% (regra do Draevor): aumenta o dano físico mín. e máx. e o APS da arma; NÃO mexe em crítico, alcance, requisitos nem em dano elemental.
//   MODIFICADORES GLOBAIS  são do PERSONAGEM (afixos de outras peças, árvore, gemas, STR/DEX, buffs…): entram na ficha DEPOIS, nunca dentro da base da arma. (Aqui só a velocidade global
//                          tem um ponto de encaixe — `aplicarVelocidadeGlobal` — porque o intervalo do golpe é o encontro das duas.)
//
// ORDEM (documentada e única):
//   dano físico:  1 base (mín., máx.)  →  2 + dano adicional LOCAL  →  3 × (1 + % dano físico local)  →  4 × (1 + qualidade)  →  dano físico final da arma
//   velocidade:   1 APS base  →  2 × (1 + % velocidade local)  →  3 × (1 + qualidade)  →  APS da arma  →  4 aumentos GLOBAIS do personagem (na ficha)  →  5 outros multiplicadores
//   crítico:      base da arma × (1 + % crítico local)  (a qualidade NÃO entra)
// A qualidade entra UMA vez só (aqui); o resto da engine consome o resultado. Sem arredondar: quem apresenta arredonda (1 casa no dano exibido no PoE; o dano do golpe é arredondado uma vez
// no fim pelo combate, como sempre).

/** A qualidade máxima (%), regra do Draevor. */
export const QUALIDADE_MAXIMA = 20;
/** O APS que o jogo usa HOJE para toda arma (um golpe a cada 2 s): o padrão de uma base sem APS próprio — mantém o combate de antes idêntico. */
export const APS_PADRAO = 0.5;
/** Os limites do APS de uma BASE (validação do editor; o intervalo final continua obedecendo os limites da ficha). */
export const LIMITES_DO_APS = { minimo: 0.1, maximo: 5 };

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const naoNeg = (v, padrao = 0) => { const n = num(Number(v)); return n != null && n > 0 ? n : padrao; };

/** A qualidade (%) saneada: de 0 a `QUALIDADE_MAXIMA`; ausente ou inválida = 0. */
export const qualidadeValida = (q) => Math.max(0, Math.min(QUALIDADE_MAXIMA, naoNeg(q, 0)));

/**
 * Os atributos da BASE de uma arma a partir do item do catálogo (`meta`), com os mesmos nomes que o catálogo usa:
 * dano físico `attackMin`/`attackMax` (sem faixa própria, o `attack` único vale para os dois), `aps` (padrão 0,5), crítico `critChance` (centésimos de %: 500 = 5%),
 * alcance `range` (casas; corpo a corpo = 1), `minLevel` e os requisitos `reqStr`/`reqDex`/`reqInt` (ausente = sem requisito). `faixaDaPeca` = `[piso, teto]` que a peça
 * sorteou no drop (substitui o dano do catálogo). Devolve `null` se `meta` não é arma.
 */
export function baseDaArma(meta, faixaDaPeca = null) {
  if (!meta || meta.slot !== 'weapon') return null;
  const unico = naoNeg(meta.attack, 0);
  const min = faixaDaPeca ? naoNeg(faixaDaPeca[0], 0) : naoNeg(meta.attackMin, unico);
  const max = faixaDaPeca ? naoNeg(faixaDaPeca[1], 0) : naoNeg(meta.attackMax, unico);
  return {
    tipo: meta.type ?? null, danoMin: Math.min(min, max), danoMax: Math.max(min, max), temFaixa: Math.max(min, max) > Math.min(min, max),
    aps: naoNeg(meta.aps, APS_PADRAO), critChance: naoNeg(meta.critChance, 0), alcance: naoNeg(meta.range, 1), nivel: num(meta.minLevel) != null && meta.minLevel > 0 ? meta.minLevel : null,
    requisitos: { str: num(meta.reqStr) != null && meta.reqStr > 0 ? meta.reqStr : null, dex: num(meta.reqDex) != null && meta.reqDex > 0 ? meta.reqDex : null, int: num(meta.reqInt) != null && meta.reqInt > 0 ? meta.reqInt : null },
    duasMaos: !!meta.twoHanded, magica: !!(meta.wand || meta.skill === 'magic'),
  };
}

/** Os modificadores LOCAIS saneados (`{ addMin, addMax, pctDano, pctVelocidade, pctCritico }`; ausente = 0). Percentuais negativos são permitidos (reduzem) até −100%. */
export function locaisValidos(l = {}) {
  const pct = (v) => Math.max(-100, num(Number(v)) ?? 0);
  return { addMin: naoNeg(l?.addMin, 0), addMax: naoNeg(l?.addMax, 0), pctDano: pct(l?.pctDano), pctVelocidade: pct(l?.pctVelocidade), pctCritico: pct(l?.pctCritico) };
}

/**
 * Os atributos FINAIS da arma: `base` (de `baseDaArma`), `qualidade` (%) e `locais`. Devolve cada etapa (para o tooltip e o editor mostrarem a influência), os valores finais, o dano
 * médio por ataque e o **DPS físico da arma** = dano médio × APS final — que NÃO é o dano de uma habilidade, nem inclui atributos do personagem, crítico ou efeitos (esses entram na ficha).
 */
export function statsDaArma(base, { qualidade = 0, locais = {} } = {}) {
  if (!base) return null;
  const q = qualidadeValida(qualidade);
  const L = locaisValidos(locais);
  const fq = 1 + q / 100;
  // dano físico: 1 base → 2 + adicional local → 3 × % local → 4 × qualidade
  const aposAdd = [base.danoMin + L.addMin, base.danoMax + Math.max(L.addMax, L.addMin)];
  const aposPct = aposAdd.map((v) => v * Math.max(0, 1 + L.pctDano / 100));
  const final = aposPct.map((v) => v * fq);
  // velocidade: 1 APS base → 2 × % local → 3 × qualidade
  const apsLocal = base.aps * Math.max(0, 1 + L.pctVelocidade / 100);
  const apsFinal = apsLocal * fq;
  // crítico: base × (1 + % local); a qualidade não entra
  const critFinal = base.critChance * Math.max(0, 1 + L.pctCritico / 100);
  const medio = (final[0] + final[1]) / 2;
  return {
    qualidade: q, locais: L,
    dano: { base: [base.danoMin, base.danoMax], aposAdicional: aposAdd, aposPercentual: aposPct, final, medio },
    aps: { base: base.aps, aposLocal: apsLocal, final: apsFinal, intervaloMs: apsFinal > 0 ? 1000 / apsFinal : null },
    critChance: { base: base.critChance, final: critFinal },
    alcance: base.alcance, nivel: base.nivel, requisitos: base.requisitos, tipo: base.tipo,
    danoMin: final[0], danoMax: final[1], danoMedio: medio, apsFinal, dpsFisico: medio * apsFinal,
    // o que a qualidade acrescentou (0 sem qualidade): tudo vem de multiplicar por `fq`, uma vez
    ganhoDaQualidade: { danoMin: final[0] - aposPct[0], danoMax: final[1] - aposPct[1], aps: apsFinal - apsLocal },
  };
}

/** O APS depois dos aumentos GLOBAIS do personagem (`pctGlobal` em %, já somados na ficha) e de um multiplicador extra (1 = nenhum). Passo 4 e 5 da velocidade. */
export const aplicarVelocidadeGlobal = (apsDaArma, pctGlobal = 0, multiplicadorExtra = 1) => apsDaArma * Math.max(0, 1 + (Number(pctGlobal) || 0) / 100) * (Number(multiplicadorExtra) || 1);

/** O intervalo (ms) que corresponde a um APS: `1000 / APS`. */
export const intervaloDoAps = (aps) => (aps > 0 ? 1000 / aps : null);

/** Textos para a tela (1 casa decimal; vírgula decimal pt-BR). A conta nunca usa estes valores. */
export const formatarDano = (n) => (num(n) == null ? '—' : String(Math.round(n * 10) / 10).replace('.', ','));
export const formatarAps = (n) => (num(n) == null ? '—' : n.toFixed(2).replace('.', ','));
export const formatarCritico = (centesimos) => (num(centesimos) == null ? '—' : `${String(Number((centesimos / 100).toFixed(2))).replace('.', ',')}%`);

/** Valida os campos de base de uma arma (para o editor): devolve a lista de erros em pt-BR. */
export function validarBaseDaArma(ov) {
  const erros = [];
  const intOuNull = (k, max) => { if (ov[k] !== undefined && !(Number.isInteger(ov[k]) && ov[k] >= 0 && ov[k] <= max)) erros.push(`${k} precisa ser um inteiro de 0 a ${max}.`); };
  intOuNull('attackMin', 100_000); intOuNull('attackMax', 100_000); intOuNull('critChance', 10_000); intOuNull('range', 20);
  intOuNull('reqStr', 5000); intOuNull('reqDex', 5000); intOuNull('reqInt', 5000);
  if (ov.aps !== undefined && !(typeof ov.aps === 'number' && ov.aps >= LIMITES_DO_APS.minimo && ov.aps <= LIMITES_DO_APS.maximo)) erros.push(`aps precisa ser um número de ${LIMITES_DO_APS.minimo} a ${LIMITES_DO_APS.maximo} (o jogo hoje usa ${APS_PADRAO}).`);
  if (Number.isInteger(ov.attackMin) && Number.isInteger(ov.attackMax) && ov.attackMin > ov.attackMax) erros.push('attackMin não pode ser maior que attackMax.');
  return erros;
}
