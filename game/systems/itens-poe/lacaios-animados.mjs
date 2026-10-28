// (rodada 4 das gemas, lote C1 — o dono, 28/10: "quero resolver") os LACAIOS ANIMADOS: a Arma Animada (Animar Arma, a Vaal, a dos Braços Distantes) e o Guardião
// Animado (Animar Guardião, o do Castigo). No PoE o lacaio é um ITEM animado — a arma no chão, a armadura —, e o idle não tem o item no chão: a decisão do dono é que o
// item animado seja uma BASE NORMAL do nível que a gema anima ("Pode usar Itens que exigem até o Nível N" — o PoB: animate_item_maximum_level_requirement):
//   - a ARMA: uma base de arma do tipo da gema — corpo a corpo (Animar Arma, a Vaal) ou à distância (a dos Braços Distantes: os arcos) —, com o requisito de nível até
//     o da gema; a de maior DPS Físico de base entre todas as que cabem (decisão do dono 28/10 — antes, a de requisito mais alto). O lacaio bate com o dano Físico e o tempo de ataque dela (o PoB: a Arma Animada
//     tem `damage = 0` e `monster_gets_item_stats` — o golpe é o da arma);
//   - o GUARDIÃO: uma Armadura de Corpo base com o requisito até o da gema (a de requisito mais alto; entre elas, a de mais defesa — armadura + evasão + escudo). O
//     lacaio tem a armadura, a evasão e o escudo de energia dela (a média da faixa da base) somados às dele no PoB (armour 0,5 × a tabela) e bate desarmado: os 2 a 6
//     de Dano Físico da mão principal (o PoB, AnimatedArmour: main_hand_local_minimum/maximum_added_physical_damage) a cada 1 s (attackTime 1); o do Castigo usa o
//     Castigo do PoB (AnimateGuardianSmite: 325%, 50% do Físico em Raio, a área de 2,1 m).
// Puro (sem a caçada): quem usa é `LacaiosPoe.oQueInvoca`.
import * as Catalogo from './catalogo.mjs';

/** As classes de arma CORPO A CORPO que a Arma Animada pode animar (no PoE, armas de corpo a corpo) e as À DISTÂNCIA da dos Braços Distantes (os arcos). */
export const CLASSES_CORPO = ['Claws', 'Daggers', 'Rune_Daggers', 'One_Hand_Axes', 'One_Hand_Maces', 'One_Hand_Swords', 'Thrusting_One_Hand_Swords', 'Sceptres', 'Two_Hand_Axes', 'Two_Hand_Maces', 'Two_Hand_Swords', 'Staves', 'Warstaves'];
export const CLASSES_DISTANCIA = ['Bows'];
/** As gemas: a Arma Animada (`distancia` — a dos Braços Distantes) e o Guardião. A Auto-reflexão usa a SUA arma (`LacaiosHabilidades`, `arma: 'sua'`). */
const ARMA = /^(?:Vaal_)?Animate_Weapon(?!_of_Self_Reflection)/;
const GUARDIAO = /^Animate_Guardian/;
export const ehArmaAnimada = (slug) => ARMA.test(String(slug ?? ''));
export const ehGuardiao = (slug) => GUARDIAO.test(String(slug ?? ''));
export const usaBase = (slug) => ehArmaAnimada(slug) || ehGuardiao(slug);
/** O Guardião desarmado no PoB: 2 a 6 de Dano Físico na mão principal, um ataque por segundo. */
export const GUARDIAO_DESARMADO = Object.freeze({ min: 2, max: 6, tempoS: 1 });

/** O nível máximo do item que a gema anima ("Pode usar Itens que exigem até o Nível N"), ou null. */
// (rodada 4, correções finais — achado C: a linha da Vaal vem embaralhada do poedb: "até o Nível 40 … Exigência de Nível entre 100 e 1". No PoB (VaalAnimateWeapon,
// act_dex.lua) o animate_item_maximum_level_requirement é 9 no nível 1, 44 no 10 e 100 no 20, igual ao da comum; o 40 é o vaal_animate_weapon_minimum_level_requirement.
// Com a faixa "entre A e B" na linha, o limite é o maior dos dois.)
export function limiteDeNivel(linhas) {
  for (const l of linhas ?? []) {
    const faixa = /Exigência de Nível entre (\d+) e (\d+)/i.exec(String(l));
    if (faixa) return Math.max(Number(faixa[1]), Number(faixa[2]));
    const m = /Pode usar Itens que exigem até o Nível (\d+)/i.exec(String(l));
    if (m) return Number(m[1]);
  }
  return null;
}
const media = (f) => (f && Number.isFinite(f.min) && Number.isFinite(f.max) ? (f.min + f.max) / 2 : Number(f) || 0);
const nivelDe = (b) => b?.requisitos?.nivel;
/** As bases das classes (só as com requisito de nível — as especiais, criadas por habilidade, não têm). */
function bases(classes) {
  const cat = Catalogo.catalogo();
  if (!cat) return [];
  return classes.flatMap((c) => (cat.classes?.[c]?.bases ?? []).map((b) => ({ b, classe: c }))).filter(({ b }) => Number.isFinite(nivelDe(b)));
}
/**
 * A melhor base até o `limite`: com `porRequisito`, o requisito mais alto e, entre elas, a de maior `valor` (o Guardião); sem ele, a de maior `valor` entre TODAS as que
 * cabem no limite (a Arma Animada — decisão do dono 28/10: o maior DPS Físico de base, sem preferir o requisito mais alto). Empate: o requisito mais alto, depois o id.
 */
function melhor(lista, limite, valor, { porRequisito = true } = {}) {
  const ok = lista.filter(({ b }) => nivelDe(b) <= limite);
  if (!ok.length) return null;
  const topo = Math.max(...ok.map(({ b }) => nivelDe(b)));
  return ok.filter(({ b }) => !porRequisito || nivelDe(b) === topo).sort((x, y) => valor(y.b) - valor(x.b) || nivelDe(y.b) - nivelDe(x.b) || String(x.b.id).localeCompare(String(y.b.id)))[0];
}
/**
 * A ARMA animada: `{ id, nome, classe, nivel, min, max, aps, intervaloMs, distancia }` — a base Normal de arma do tipo da gema com o requisito até `limite`. Null sem
 * catálogo ou sem base.
 */
export function armaBase(limite, { distancia = false } = {}) {
  const lista = bases(distancia ? CLASSES_DISTANCIA : CLASSES_CORPO).filter(({ b }) => b.atributos?.dano_fisico?.max > 0 && b.atributos?.ataques_por_segundo > 0);
  const x = melhor(lista, limite, (b) => media(b.atributos.dano_fisico) * b.atributos.ataques_por_segundo, { porRequisito: false });
  if (!x) return null;
  const a = x.b.atributos;
  return { id: x.b.id, nome: x.b.nome, classe: x.classe, nivel: nivelDe(x.b), min: a.dano_fisico.min, max: a.dano_fisico.max, aps: a.ataques_por_segundo, intervaloMs: Math.round(1000 / a.ataques_por_segundo), distancia };
}
/** A ARMADURA DE CORPO do Guardião: `{ id, nome, nivel, armadura, evasao, es }` (a média da faixa de cada defesa da base), ou null. */
export function armaduraBase(limite) {
  const def = (b) => ({ armadura: media(b.atributos?.armadura), evasao: media(b.atributos?.evasao), es: media(b.atributos?.escudo_energia) });
  const x = melhor(bases(['Body_Armours']), limite, (b) => { const d = def(b); return d.armadura + d.evasao + d.es; });
  if (!x) return null;
  return { id: x.b.id, nome: x.b.nome, nivel: nivelDe(x.b), ...def(x.b) };
}
/**
 * O ITEM ANIMADO da gema (`slug`, as linhas do nível — o limite de nível): `{ arma }` (a Arma Animada), `{ armadura }` (o Guardião) ou null (as outras gemas, ou sem
 * base). `nivelDoLacaio`: o limite quando a gema não traz a linha.
 */
export function animadoDaGema(slug, linhas, nivelDoLacaio = 100) {
  if (!usaBase(slug)) return null;
  const limite = limiteDeNivel(linhas) ?? nivelDoLacaio;
  if (ehArmaAnimada(slug)) {
    const arma = armaBase(limite, { distancia: /_of_Ranged_Arms$/.test(String(slug)) });
    return arma ? { arma, limite } : null;
  }
  const armadura = armaduraBase(limite);
  return armadura ? { armadura, limite } : null;
}
