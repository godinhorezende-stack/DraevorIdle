// A conta da morte — quanto de experiência e de ouro ela custa — e as
// blessings, que é o que diminui a parte da experiência.
//
// Do original (`blessings` capturado de dois personagens: Zotod, level 89, e o
// da conta2, level 343 — `api-mapeada/servidor/{,conta2/}blessings.json`), e o
// texto do próprio cliente ("é a conta do crystalserver"):
// - Perda cheia: a curva do Tibia, (L+50)/100 × 50 × (L² − 5L + 8)
//   (520.138 no 89, 22.782.603 no 343 — os dois exatos).
// - Teto: 80% de um level (306.320 e 4.664.960, exatos), antes das bênçãos.
// - Desconto: 8% por bênção e mais 30% com a promoção, sobre o que o teto
//   deixou (4.664.960 × 70% = 3.265.472, exato). Morrer queima todas.
// - Ouro: 20% do que está CARREGADO (`Banqueiro.cobrarMorte`); o banco não.
// - Preço de cada bênção: 2.000 até o level 30, depois 200 × (L − 20) com teto
//   de 20.000 (13.800 no 89, 20.000 no 343); as aprimoradas custam o dobro.
//
// ESTIMADO: `itemChance` (a conta de item do Tibia) — o jogo não tira item na
// morte, e a view só mostrou o valor sem bênção (1).
import { CATALOGO } from './dados.mjs';
import * as R from './regras.mjs';
import { FRACAO_DO_OURO_NA_MORTE, cobrarMorte } from './banqueiro.mjs';
import * as Promocao from './promocao.mjs';
import { ligado as itensPoeLigado } from './itens-poe/catalogo.mjs';

export const BLESSINGS = CATALOGO.blessings;
export const DESCONTO_POR_BLESSING = 8;
export const DESCONTO_DA_PROMOCAO = 30;
export const TETO_EM_LEVELS = 0.8;

const minhas = (estado) => (estado.blessings ?? []).filter((id) => BLESSINGS.some((b) => b.id === id));

export function precoDaBlessing(level, tipo) {
  const regular = level <= 30 ? 2000 : Math.min(20000, 200 * (level - 20));
  return tipo === 'enhanced' ? regular * 2 : regular;
}

/** A conta da morte AGORA, no formato do `resumo` do original. */
export function conta(estado) {
  const L = estado.level ?? 1;
  const umLevel = R.expDeUmLevel(L);
  const expCheia = Math.round(((L + 50) / 100) * 50 * (L * L - 5 * L + 8));
  const teto = Math.round(umLevel * TETO_EM_LEVELS);
  const base = Math.min(expCheia, teto);
  const blessings = minhas(estado).length;
  const promocao = Promocao.promovido(estado);
  const descontoPercent = Math.min(100, blessings * DESCONTO_POR_BLESSING + (promocao ? DESCONTO_DA_PROMOCAO : 0));
  // Modo PoE (regra do PoE 1): a morte tira experiência, mas NUNCA um level — o piso é o começo do level atual. Sem isso, cair de level
  // deixava a árvore de passivas com mais pontos gastos do que o personagem tem (auditoria da árvore, 09/10).
  const piso = itensPoeLigado() ? Math.max(0, (estado.xp ?? 0) - R.expForLevel(L)) : estado.xp ?? 0;
  const expPerdida = Math.min(piso, Math.round(base * (1 - descontoPercent / 100)));
  return {
    expPerdida,
    ...(itensPoeLigado() ? { semPerderLevel: true } : {}),
    expCheia,
    descontoPercent,
    teto,
    aparadoPeloTeto: expCheia > teto,
    emLevels: Math.round((expPerdida / umLevel) * 100) / 100,
    blessingsLost: blessings,
    promocao,
    ouroFracao: FRACAO_DO_OURO_NA_MORTE,
    itemChance: blessings ? 0 : 1,
    umLevel,
  };
}

/** `{t:'blessings'}`: a lista com preço e dono, o ouro e a conta da morte. */
export function vista(estado) {
  const tenho = new Set(minhas(estado));
  return {
    t: 'blessings',
    list: BLESSINGS.map((b) => ({ ...b, price: precoDaBlessing(estado.level ?? 1, b.type), owned: tenho.has(b.id) })),
    gold: estado.gold ?? 0,
    resumo: conta(estado),
  };
}

/** `{t:'bless', id}` compra uma; `{t:'bless', all:true}` as que faltam. */
export function comprar(estado, m) {
  const tenho = new Set(minhas(estado));
  const alvo = m.all ? BLESSINGS.filter((b) => !tenho.has(b.id)) : BLESSINGS.filter((b) => b.id === Number(m.id));
  if (!alvo.length) return { ok: false, erro: m.all ? 'Você já tem todas as bênçãos.' : 'Bênção desconhecida.' };
  if (!m.all && tenho.has(alvo[0].id)) return { ok: false, erro: 'Você já tem essa bênção.' };
  const preco = alvo.reduce((s, b) => s + precoDaBlessing(estado.level ?? 1, b.type), 0);
  if ((estado.gold ?? 0) < preco) return { ok: false, erro: `Faltam ${preco - (estado.gold ?? 0)} gold.` };
  estado.gold -= preco;
  estado.blessings = [...tenho, ...alvo.map((b) => b.id)];
  return { ok: true };
}

/**
 * Morreu: tira a experiência (podendo cair de level), 20% do ouro carregado e
 * queima as bênçãos. `descerDeLevel` refaz vida e mana do level novo (fica em
 * `hunt/combate.mjs`, ao lado do `subirDeLevel`). Devolve os campos do `death`.
 */
export function morrer(estado, descerDeLevel) {
  const c = conta(estado);
  const levelAntes = estado.level ?? 1;
  estado.xp = Math.max(0, (estado.xp ?? 0) - c.expPerdida);
  descerDeLevel(estado);
  const goldLost = cobrarMorte(estado);
  estado.blessings = [];
  return {
    lost: c.expPerdida,
    goldLost,
    levelPerdido: Math.max(0, levelAntes - (estado.level ?? levelAntes)),
    expCheia: c.expCheia,
    expSemProtecao: Math.min(c.expCheia, c.teto),
    teto: c.teto,
    aparadoPeloTeto: c.aparadoPeloTeto,
    descontoPercent: c.descontoPercent,
    blessings: c.blessingsLost,
    promocao: c.promocao,
  };
}

/*
 * ---- O golpe que matou ----
 *
 * Report do dono (27/10): o personagem morria sem aparecer o número do golpe — o evento ia no quadro DEPOIS da morte, já na cidade, por
 * baixo da caixa "Você morreu". Agora a sessão manda o último quadro da caçada com os eventos e o `death` leva o golpe: quem, qual golpe,
 * quanto e de que tipo. O evento que zerou a vida vem marcado (`fatal`, em `contraAtaque`/`aplicarNoJogador`); sem a marca (a vida que
 * zerou por outro caminho), vale o último dano no próprio personagem.
 */
const NOME_DO_TIPO = {
  physical: 'Físico', fire: 'Fogo', ice: 'Gelo', chaos: 'Caos', earth: 'Terra', death: 'Morte', holy: 'Sagrado',
  lifedrain: 'Dreno de Vida', manadrain: 'Dreno de Mana', drown: 'Afogamento', agony: 'Agonia',
};
const NOME_DO_TIPO_NO_POE = { earth: 'Caos', death: 'Caos' };
export function nomeDoTipo(elemento) {
  if (!elemento) return null;
  if (elemento === 'energy') return itensPoeLigado() ? 'Raio' : 'Energia';
  return (itensPoeLigado() ? NOME_DO_TIPO_NO_POE[elemento] : null) ?? NOME_DO_TIPO[elemento] ?? elemento;
}

/** O dano que o PRÓPRIO personagem levou (não o do lacaio, nem o que ele causou), de `eventos`. */
const noPersonagem = (e, nome) => e?.t === 'dmg' && !e.foe && !e.lacaio && e.v > 0 && e.uid === 'player' && (!e.quem || !nome || e.quem === nome);

/** `{de, golpe, v, elemento, tipo, crit}` do golpe que matou, dos eventos do tique da morte — ou null, sem dano no personagem. */
export function golpeQueMatou(eventos, nome = null) {
  const lista = (eventos ?? []).filter((e) => noPersonagem(e, nome));
  const ev = lista.findLast((e) => e.fatal) ?? lista.at(-1);
  if (!ev) return null;
  return {
    de: ev.de ?? null,
    golpe: ev.golpe ?? null,
    v: ev.v,
    elemento: ev.elemento ?? null,
    tipo: nomeDoTipo(ev.elemento),
    ...(ev.crit ? { crit: true } : {}),
  };
}

/** "Morto por General Adus — Bomba Viva: 3.230 de Raio" (a linha da caixa da morte, do log e do relatório da ausência). */
export function textoDoGolpe(g) {
  if (!g) return null;
  const quem = g.de ? `Morto por ${g.de}` : 'Morto';
  const golpe = g.golpe && g.golpe !== g.de ? ` — ${g.golpe[0].toUpperCase()}${g.golpe.slice(1)}` : '';
  return `${quem}${golpe}: ${Number(g.v).toLocaleString('pt-BR')}${g.tipo ? ` de ${g.tipo}` : ' de dano'}${g.crit ? ' (crítico)' : ''}`;
}
