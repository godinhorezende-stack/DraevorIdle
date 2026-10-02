// O PODER DA ARMA (decisão do dono, 02/10) — a arma como fonte do dano base das gemas de ataque.
//
// Config em `gamedata/armas/` (`poder.json`: curva, raridade, afinidade, piso legado, identidade de wand/rod; `niveis-de-poder.json`:
// o nível de poder de cada arma). Aqui só a conta, pura: nada de estado de caçada nem de sorteio.
//
//   poder da arma  = curva(nível de poder) × fator da raridade da peça   (wand/rod: é o Magic Attack, fixo)
//   poder efetivo  = max(poder, piso legado × curva(level do personagem)) × identidade   (sem penalidade de compatibilidade: qualquer arma, qualquer habilidade)
//   nível equiv.   = a inversa da curva → o `danoNoLevel` do catálogo responde pelo dano da magia nesse "nível"
//
// Uma arma NO NÍVEL (poder = curva do level do personagem) devolve o nível equivalente = o level dele: o dano de antes.
import { readFileSync } from 'node:fs';
import { ITEM_CATALOG } from '../dados.mjs';

const ler = (f) => JSON.parse(readFileSync(new URL(`../../gamedata/armas/${f}.json`, import.meta.url), 'utf8'));
export const CONFIG = ler('poder');
const NIVEIS = ler('niveis-de-poder').niveis;

/** O poder que um nível dá, na curva. */
export const poderDoNivel = (nivel) => CONFIG.curva.base + CONFIG.curva.inclinacao * Math.max(0, Number(nivel) || 0);
/** A inversa: o "nível equivalente" de um poder (mínimo 1). */
export const nivelDoPoder = (poder) => Math.max(1, (Number(poder) - CONFIG.curva.base) / CONFIG.curva.inclinacao);

const FAMILIA_DO_TIPO = { 'wands': 'magic', 'rods': 'magic', 'distance weapons': 'distance' };

/** A família da arma: magic (wand, rod), distance (arco, besta, arremesso) ou melee (o resto, punho incluso). */
export function familiaDaArma(meta) {
  if (!meta) return null;
  if (meta.wand || meta.skill === 'magic') return 'magic';
  if (meta.skill === 'distance') return 'distance';
  return FAMILIA_DO_TIPO[meta.type] ?? 'melee';
}

/** wand | rod | null — a identidade da arma mágica. */
export const tipoDaArmaMagica = (meta) => (meta?.type === 'wands' ? 'wand' : meta?.type === 'rods' ? 'rod' : null);

/** O nível de poder da arma (config explícita por arma; sem registro, o `minLevel` do catálogo). */
export const nivelDePoderDaArma = (meta) => (meta ? NIVEIS[meta.id] ?? meta.minLevel ?? 1 : 0);

export const fatorDaRaridade = (raridade) => CONFIG.raridade[raridade] ?? 1;

/** O poder (Magic Attack nas wands e rods) de UMA peça de arma: curva do nível dela × raridade. */
export function poderDaPeca(peca) {
  const meta = ITEM_CATALOG[peca?.id];
  if (!meta || meta.slot !== 'weapon') return 0;
  return poderDoNivel(nivelDePoderDaArma(meta)) * fatorDaRaridade(peca.raridade ?? 'comum');
}

/** O poder base (sem raridade) que o catálogo mostra no item: o Magic Attack da wand/rod. */
export const poderDoCatalogo = (meta) => (meta ? Math.round(poderDoNivel(nivelDePoderDaArma(meta))) : 0);

/**
 * O PODER EFETIVO desta arma para uma habilidade: `escala` = 'melee' | 'distance' | 'magic' (a skill que escala a habilidade) e
 * `elemento` dela. `estado` dá a arma equipada e o level (o piso legado). Devolve o que o tooltip precisa mostrar.
 */
export function poderEfetivo(estado, escala, elemento = null) {
  const peca = estado?.equipment?.weapon ?? null;
  const meta = peca ? ITEM_CATALOG[peca.id] : null;
  const familia = familiaDaArma(meta);
  const level = estado?.level ?? 1;
  const esperado = poderDoNivel(level);
  const poderBruto = peca ? poderDaPeca(peca) : 0;
  // O piso legado levanta só a arma fraca (antes da afinidade): a incompatibilidade continua valendo por cima.
  const piso = CONFIG.pisoLegado.fracao * esperado;
  const poder = Math.max(poderBruto, piso);
  const afinidade = (familia ? CONFIG.afinidade[familia] : CONFIG.afinidade.semArma)[escala] ?? 0;
  // Wand e rod: o bônus do rod e o do elemento afim, só nas habilidades mágicas.
  let identidade = 1;
  const tipo = tipoDaArmaMagica(meta);
  if (tipo && escala === 'magic') {
    const id = CONFIG.identidade[tipo];
    identidade *= 1 + (id.poderPct ?? 0) / 100;
    if (elemento && id.elementosAfins?.includes(elemento)) identidade *= 1 + CONFIG.identidade.bonusDeElementoAfimPct / 100;
  }
  const efetivo = poder * afinidade * identidade;
  return {
    familia, escala, afinidade, identidade, poderDaArma: poderBruto, piso, poder: efetivo, nivelEquivalente: nivelDoPoder(efetivo),
    semArma: !peca, compativel: familia === escala, noPiso: poderBruto < piso,
  };
}

/** O Cast Speed (%) da identidade: a wand na mão conjura mais rápido. */
export function castSpeedDaIdentidade(estado) {
  const tipo = tipoDaArmaMagica(ITEM_CATALOG[estado?.equipment?.weapon?.id]);
  return tipo ? CONFIG.identidade[tipo].castSpeedPct ?? 0 : 0;
}

/*
 * O catálogo de itens leva o poder BASE de cada arma (o cliente multiplica pela raridade da peça, `poderDasArmas` no catálogo de
 * ações): `poderDaArma` em toda arma; wand e rod também `magicAttack` (é o mesmo número, com o nome que o jogador conhece).
 */
for (const meta of Object.values(ITEM_CATALOG)) {
  if (meta.slot !== 'weapon' || NIVEIS[meta.id] === undefined) continue;
  meta.poderDaArma = poderDoCatalogo(meta);
  if (familiaDaArma(meta) === 'magic') meta.magicAttack = meta.poderDaArma;
}
