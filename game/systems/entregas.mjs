// Entregas: o loot que o bicho larga trocado por addon de outfit ou por
// montaria — a janela de Outfits e a aba de montarias das Tarefas
// (panels.mjs `renderEntregas`, `{t:'entrega', id}`).
//
// Do original (Zoros, 2026-09-26; definições em `gamedata/tarefas.json`):
// - 33 entregas (16 outfits × addon 1 e 2, e a Undead Cavebear), cada uma com
//   itens (quantos, de quem caem) e às vezes ouro (Nobleman: 150.000).
// - Por personagem: `tem` (o que está na mochila e na bolsa), `entregue` (o que
//   já foi deixado no balcão), `falta`; `temOuro` vem aparado no pedido (Zoros,
//   62 kk no bolso: temOuro 150.000); `falta` = pedido − balcão − o que tem;
//   `pronta` quando nada falta; `podeAdiantar` quando há algo para deixar no balcão.
// - Entregar pronta: tira os itens e o ouro e dá o addon (nos dois sexos do
//   outfit) ou a montaria. Não pronta: ADIANTA — deixa no balcão o que tem.
//
// ESTIMADO: `tem` também aparado no que falta (como o ouro); `indisponivel`
// nunca liga (o original não mostrou nenhuma).
import { readFileSync } from 'node:fs';
import { MONTARIAS_REAIS } from './dados.mjs';
import { tirarGuardadas } from './inventario.mjs';

const ENTREGAS = JSON.parse(readFileSync(new URL('../../assets_raw/gamedata/tarefas.json', import.meta.url), 'utf8')).entregas;
const POR_ID = new Map(ENTREGAS.map((e) => [e.id, e]));
const ID_DA_MONTARIA = new Map(MONTARIAS_REAIS.mounts.map((m) => [m.look, m.id]));

const nomeDoOutfit = (look) => MONTARIAS_REAIS.outfits.find((o) => o.look === look)?.name;

function garantir(estado) {
  estado.entregas ??= { feitas: [], balcao: {} };
  return estado.entregas;
}

/**
 * Quanto de cada item há na mochila e na bolsa — numa passada só. A bolsa tem até
 * 1.000 vagas e as 33 entregas pedem ~50 itens: contar item por item seria
 * varrer a bolsa 50 vezes a cada envio do personagem.
 */
function contagem(estado) {
  const n = new Map();
  for (const onde of ['inventory', 'pouch']) for (const p of estado[onde] ?? []) if (p) n.set(p.id, (n.get(p.id) ?? 0) + (p.count ?? 1));
  return n;
}

/** Os addons de um look ganhos por entrega (máscara 1|2). */
export function addonsDoLook(estado, look) {
  return estado.addonsDeOutfit?.[nomeDoOutfit(look)] ?? 0;
}

export function montariaEntregue(estado, id) {
  return (estado.montariasEntregues ?? []).includes(id);
}

function vista(estado, e, noBolso = contagem(estado)) {
  const g = estado.entregas ?? {};
  const feita = (g.feitas ?? []).includes(e.id);
  const balcao = g.balcao?.[e.id] ?? {};
  const itens = e.itens.map((i) => {
    const entregue = feita ? i.count : balcao[i.id] ?? 0;
    // `falta` já desconta o que está na mochila (moonlight rod do Zoros: tem 1, falta 0).
    // Feita: "100/100" na tela (o cliente mostra `tem/count`). ESTIMADO — a
    // captura não tinha nenhuma entrega feita.
    const tem = feita ? i.count : Math.min(i.count - entregue, noBolso.get(i.id) ?? 0);
    return { ...i, tem, entregue, falta: feita ? 0 : i.count - entregue - tem };
  });
  const ouroEntregue = feita ? e.ouro : balcao.ouro ?? 0;
  const temOuro = Math.min(e.ouro - ouroEntregue, estado.gold ?? 0);
  const pronta = !feita && itens.every((i) => i.falta === 0) && ouroEntregue + temOuro >= e.ouro;
  const podeAdiantar = !feita && (itens.some((i) => i.tem > 0) || temOuro > 0);
  const adiantada = !feita && (Object.keys(balcao).length > 0);
  return { ...e, itens, ouro: e.ouro, temOuro, ouroEntregue, pronta, podeAdiantar, adiantada, feita, indisponivel: false };
}

/*
 * ---- Só remonta quando muda o que ela usa ----
 *
 * As 33 entregas são ~26 KB e o personagem é montado uma vez por segundo por
 * jogador. Elas só dependem de três coisas: o ouro (até o maior pedido — acima
 * disso, tanto faz), quanto há de cada item PEDIDO e o progresso das entregas.
 * Com a mesma chave, devolve o MESMO objeto; a sessão (`mandarEstado`) nem
 * compara objeto repetido (ver "O mesmo objeto de antes").
 */
const ITENS_PEDIDOS = [...new Set(ENTREGAS.flatMap((e) => e.itens.map((i) => i.id)))];
const MAIOR_OURO = Math.max(...ENTREGAS.map((e) => e.ouro));
const memoria = new WeakMap();

/** `character.entregas`, no formato do original. */
export function paraCliente(estado) {
  const noBolso = contagem(estado);
  const chave = `${Math.min(estado.gold ?? 0, MAIOR_OURO)}|${ITENS_PEDIDOS.map((id) => noBolso.get(id) ?? 0).join(',')}|${JSON.stringify(estado.entregas ?? null)}`;
  const guardada = memoria.get(estado);
  if (guardada?.chave === chave) return guardada.lista;
  const lista = ENTREGAS.map((e) => vista(estado, e, noBolso));
  memoria.set(estado, { chave, lista });
  return lista;
}

/** `{t:'entrega', id}`: entrega (pronta) ou adianta (deixa no balcão o que tem). */
export function entregar(estado, { id }) {
  const e = POR_ID.get(id);
  if (!e) return { ok: false, erro: 'Entrega desconhecida.' };
  const v = vista(estado, e);
  if (v.feita) return { ok: false, erro: 'Essa entrega já foi feita.' };
  if (!v.pronta && !v.podeAdiantar) return { ok: false, erro: 'Você não tem nada desta entrega ainda.' };
  const g = garantir(estado);
  const balcao = (g.balcao[e.id] ??= {});
  for (const i of v.itens) {
    if (!i.tem) continue;
    tirarGuardadas(estado, i.id, i.tem);
    balcao[i.id] = (balcao[i.id] ?? 0) + i.tem;
  }
  if (v.temOuro) {
    estado.gold -= v.temOuro;
    balcao.ouro = (balcao.ouro ?? 0) + v.temOuro;
  }
  if (!v.pronta) return { ok: true, notice: `Adiantado: ${e.nome} (${e.premio}).` };
  delete g.balcao[e.id];
  g.feitas.push(e.id);
  if (e.tipo === 'mount') {
    const idDaMontaria = ID_DA_MONTARIA.get(e.look);
    estado.montariasEntregues = [...new Set([...(estado.montariasEntregues ?? []), idDaMontaria])];
  } else {
    const nome = nomeDoOutfit(e.look);
    estado.addonsDeOutfit ??= {};
    estado.addonsDeOutfit[nome] = (estado.addonsDeOutfit[nome] ?? 0) | e.addon;
  }
  return { ok: true, notice: `${e.nome}: ${e.premio} é seu.` };
}
