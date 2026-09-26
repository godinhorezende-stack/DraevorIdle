// O Craft — a aba "Craft" da Forja (`renderForjaCraft`, panels.mjs): os sets
// Craftado e Craftado V2 de cada vocação. Funções puras sobre `estado`; quem
// responde é `sessao.mjs`.
//
// As receitas são as REAIS (peça, slot, peça-base e cada material com a
// quantidade), da ficha capturada no original para as cinco vocações
// (`api-mapeada/servidor/craft-por-vocacao.json` → `gamedata/craft-receitas.json`).
// O que o client diz da regra:
//  - `{t:'craft', vocacao}` → `{vocacao, minha, vocacoes, gold, craftado, v2,
//    craftou?}`; qualquer vocação pode ser consultada (a tira de cima);
//  - cada receita tem uma peça-base (`herda`), que é CONSUMIDA — e a peça nova
//    "herda imbuements, tier e afixos da peça base, os três";
//  - o material "ouro" (a crystal coin do lua) é DINHEIRO: bolso + banco;
//  - o V2 exige o Craftado correspondente (é a peça-base dele);
//  - `{t:'craftFazer', vocacao, geracao, id}` crafta, e a resposta é a ficha
//    de novo com `craftou: {id, nome, base, herdou:{tier, imbu, af}}` — o cartaz.
import { RECEITAS_DO_CRAFT, ITEM_CATALOG } from './dados.mjs';
import { contarGuardadas, tirarGuardadas, temExtras } from './inventario.mjs';

const VOCACOES = Object.keys(RECEITAS_DO_CRAFT);

const saldoDeOuro = (estado) => (estado.gold ?? 0) + (estado.bank ?? 0);

function pagarOuro(estado, valor) {
  const doBolso = Math.min(estado.gold ?? 0, valor);
  estado.gold = (estado.gold ?? 0) - doBolso;
  estado.bank = (estado.bank ?? 0) - (valor - doBolso);
}

/** Todas as cópias de `id` com onde estão — vestida, na mochila ou na bolsa. */
function copias(estado, id) {
  const lista = [];
  for (const [slot, p] of Object.entries(estado.equipment ?? {})) if (p?.id === id) lista.push({ onde: 'equip', slot, peca: p });
  for (const k of ['inventory', 'pouch']) (estado[k] ?? []).forEach((p, i) => p.id === id && lista.push({ onde: k, indice: i, peca: p }));
  return lista;
}

/**
 * A cópia da peça-base que o craft consome: a MAIS rica (tier, depois afixos,
 * depois imbuements) — é ela que a pessoa quer ver passar para a peça nova.
 */
function melhorBase(estado, id) {
  const valor = (p) => (p.tier ?? 0) * 1e6 + (p.af?.length ?? 0) * 1e3 + (p.imbu?.length ?? 0);
  return copias(estado, id).sort((a, b) => valor(b.peca) - valor(a.peca))[0] ?? null;
}

const extrasDe = (p) => (temExtras(p) ? { ...(p.tier ? { tier: p.tier } : {}), ...(p.imbu?.length ? { imbu: p.imbu } : {}), ...(p.af?.length ? { af: p.af } : {}) } : null);

function quantasTem(estado, material, baseId) {
  if (material.dinheiro) return saldoDeOuro(estado);
  if (material.id === baseId) return copias(estado, material.id).reduce((s, c) => s + (c.peca.count ?? 1), 0);
  const { limpas, comExtras } = contarGuardadas(estado, material.id);
  return limpas + comExtras;
}

function fichaDaReceita(estado, r) {
  const materiais = r.materiais.map((m) => {
    const tem = quantasTem(estado, m, r.base?.id);
    return { id: m.id, nome: m.nome, precisa: m.precisa, tem, ok: tem >= m.precisa, dinheiro: !!m.dinheiro, deFora: !ITEM_CATALOG[m.id] && !m.dinheiro };
  });
  const falta = materiais.filter((m) => !m.ok).length;
  let herda = null;
  if (r.base) {
    const base = melhorBase(estado, r.base.id);
    const p = base?.peca;
    herda = {
      id: r.base.id,
      nome: r.base.nome,
      tem: copias(estado, r.base.id).length,
      tier: p?.tier ?? 0,
      imbuements: p?.imbu?.length ?? 0,
      afixos: p?.af?.length ?? 0,
      extras: p ? extrasDe(p) : null,
    };
  }
  return { id: r.id, nome: r.nome, slot: r.slot, herda, materiais, falta, pronto: falta === 0 };
}

export function view(estado, { vocacao } = {}, craftou = null) {
  const voc = VOCACOES.includes(vocacao) ? vocacao : VOCACOES.includes(estado.vocation) ? estado.vocation : VOCACOES[0];
  const receitas = RECEITAS_DO_CRAFT[voc];
  return {
    t: 'craft',
    vocacao: voc,
    minha: estado.vocation,
    vocacoes: VOCACOES,
    gold: estado.gold ?? 0,
    craftado: receitas.craftado.map((r) => fichaDaReceita(estado, r)),
    v2: receitas.v2.map((r) => fichaDaReceita(estado, r)),
    ...(craftou ? { craftou } : {}),
  };
}

export function craftar(estado, { vocacao, geracao, id }) {
  const receitas = RECEITAS_DO_CRAFT[vocacao];
  if (!receitas) return { ok: false, erro: 'Vocação inválida.' };
  const r = (geracao === 'v2' ? receitas.v2 : receitas.craftado).find((x) => x.id === Number(id));
  if (!r) return { ok: false, erro: 'Receita inexistente.' };
  const ficha = fichaDaReceita(estado, r);
  if (!ficha.pronto) return { ok: false, erro: `Faltam ${ficha.falta} materiais para ${r.nome}.` };

  // A peça-base sai primeiro, e a peça nova toma o LUGAR dela (vestida, na
  // mochila ou na bolsa) — com o tier, os imbuements e os afixos dela.
  const base = r.base ? melhorBase(estado, r.base.id) : null;
  const herdou = base ? extrasDe(base.peca) ?? {} : {};
  const nova = { id: r.id, count: 1, ...herdou };
  for (const m of r.materiais) {
    if (m.dinheiro) pagarOuro(estado, m.precisa);
    else if (m.id === r.base?.id) continue;
    else tirarGuardadas(estado, m.id, m.precisa);
  }
  // Vestida só se ela PODE ser vestida: o V2 pede level 2500, e craftar com o
  // Craftado no corpo não pode vestir uma peça que o personagem não usa.
  const meta = ITEM_CATALOG[r.id];
  const vestivel = (meta?.minLevel ?? 0) <= (estado.level ?? 0) && (!meta?.vocations?.length || meta.vocations.includes(estado.vocation));
  if (base?.onde === 'equip' && vestivel) estado.equipment[base.slot] = nova;
  else if (base?.onde === 'equip') {
    estado.equipment[base.slot] = null;
    (estado.inventory ??= []).push(nova);
  } else if (base) {
    // O índice pode ter andado se algum material saiu da mesma lista antes dele.
    const lista = estado[base.onde];
    const i = lista.indexOf(base.peca);
    if ((base.peca.count ?? 1) > 1) {
      base.peca.count -= 1;
      lista.push(nova);
    } else lista.splice(i, 1, nova);
  } else (estado.inventory ??= []).push(nova);

  return {
    ok: true,
    craftou: { id: r.id, nome: r.nome, base: r.base?.nome ?? null, herdou },
    notice: `${r.nome} saiu da forja.`,
  };
}
