// A Máquina de Desmanche — a aba "Desmanche" da Forja (`renderForjaDesmanche`,
// panels.mjs). Funções puras sobre `estado`; quem responde é `sessao.mjs`.
//
// Os sete grupos, as peças de cada um e quantos Dismantle Token cada peça paga
// são os REAIS, da ficha capturada no original (`api-mapeada/servidor/
// desmanche.json` → `gamedata/desmanche.json`). O que o client diz da regra:
//  - `{t:'desmanche'}` → `{itemDoToken, token, categorias:[{nome, tokens,
//    itens, todos}]}`; `itens` são só as peças que a pessoa TEM, `todos` a
//    lista inteira do grupo com o `tem` de cada;
//  - peça com tier, afixo ou imbuement "não entra na máquina" (`presas`, com o
//    `motivo`) — "a que sai é sempre a mais limpa que você tem";
//  - `{t:'desmancharPeca', pedidos:[{id, quantidade}]}` é TUDO OU NADA: "cinco
//    peças marcadas contra um total em tokens não podem virar três peças e
//    outro total".
// Contam a mochila e a bolsa de loot (é onde o loot dessas peças cai); o que
// está vestido não entra.
import { MAQUINA_DE_DESMANCHE } from './dados.mjs';
import { contarGuardadas, tirarGuardadas, darItem } from './inventario.mjs';
import { podeEntrar, MENSAGEM as SO_ITENS_DO_POE } from './itens-poe/so-itens-do-poe.mjs';

const ITEM_DO_TOKEN = MAQUINA_DE_DESMANCHE.itemDoToken;
const MOTIVO = 'estão com tier, imbuement ou afixo';

/** `id` → `{ tokens, nome, grupo }` das peças que a máquina aceita. */
const ACEITAS = new Map(
  MAQUINA_DE_DESMANCHE.categorias.flatMap((c) => c.todos.map((p) => [p.id, { tokens: c.tokens, nome: p.nome, grupo: c.nome }])),
);

export function view(estado) {
  const token = contarGuardadas(estado, ITEM_DO_TOKEN).limpas;
  const categorias = MAQUINA_DE_DESMANCHE.categorias.map((c) => {
    const todos = c.todos.map((p) => {
      const { limpas, comExtras } = contarGuardadas(estado, p.id);
      return { id: p.id, nome: p.nome, tem: limpas + comExtras, pode: limpas, presas: comExtras };
    });
    const itens = todos
      .filter((p) => p.tem > 0)
      .map((p) => ({ id: p.id, nome: p.nome, pode: p.pode, presas: p.presas, ...(p.presas ? { motivo: MOTIVO } : {}), tokens: c.tokens }));
    // `tem` do grupo: a captura só mostra 0 (conta sem peça nenhuma) — aqui é a
    // soma das cópias do grupo, a mesma conta do `tem` de cada peça.
    return {
      id: c.id,
      nome: c.nome,
      tokens: c.tokens,
      tem: todos.reduce((s, p) => s + p.tem, 0),
      itens,
      todos: todos.map(({ id, nome, tem }) => ({ id, nome, tem })),
    };
  });
  return { t: 'desmanche', itemDoToken: ITEM_DO_TOKEN, token, categorias };
}

export function desmanchar(estado, { pedidos }) {
  // No jogo oficial o token do Draevor não entra: a máquina não desmancha (antes de tirar qualquer peça — nada se perde).
  if (!podeEntrar(ITEM_DO_TOKEN)) return { ok: false, erro: `A máquina de desmanche é do Draevor clássico. ${SO_ITENS_DO_POE}` };
  if (!Array.isArray(pedidos) || !pedidos.length) return { ok: false, erro: 'Marque alguma peça para desmanchar.' };
  // Junta o mesmo id pedido duas vezes, e confere TUDO antes de tirar qualquer coisa.
  const porId = new Map();
  for (const p of pedidos) {
    const id = Number(p?.id);
    const n = Math.floor(Number(p?.quantidade));
    if (!ACEITAS.has(id)) return { ok: false, erro: 'A máquina não aceita essa peça.' };
    if (!(n > 0)) return { ok: false, erro: 'Quantidade inválida.' };
    porId.set(id, (porId.get(id) ?? 0) + n);
  }
  for (const [id, n] of porId) {
    const { limpas } = contarGuardadas(estado, id);
    if (limpas < n) return { ok: false, erro: `Você só tem ${limpas} ${ACEITAS.get(id).nome} que a máquina aceita.` };
  }
  let tokens = 0;
  let pecas = 0;
  for (const [id, n] of porId) {
    tirarGuardadas(estado, id, n, { soLimpas: true });
    tokens += n * ACEITAS.get(id).tokens;
    pecas += n;
  }
  darItem(estado, ITEM_DO_TOKEN, tokens);
  return { ok: true, notice: `${pecas} ${pecas === 1 ? 'peça virou' : 'peças viraram'} ${tokens} Dismantle Token.` };
}
