// O PREÇO DE VENDA AO NPC dos itens que o catálogo não tem (decisão do dono,
// 30/09): "staff, green tunic, grapes, scarf não estão sendo vendidos
// independente da raridade" — o catálogo não tinha `sell` para 905 dos 2.297
// itens que caem dos bichos, e a venda automática só vende o que tem preço.
//
// Uma vez, ao carregar o catálogo (`dados.mjs`): o item sem `sell` ganha um,
// marcado `sellCalculado: true`, e todo o jogo lê o mesmo número. Regras em
// `gamedata/itens/precos-de-venda.json`:
//   1. tem preço de compra → `buy` × fração (0,25);
//   2. equipamento sem preço nenhum → a mediana do `sell` dos equipamentos de
//      level mínimo parecido (a curva que o próprio catálogo já tem);
//   3. loot comum sem preço nenhum (lixo, produto de bicho, comida, decoração,
//      bonecos, livros, instrumentos, sem tipo, armaduras enferrujadas) → 1 de ouro;
//   4. moeda, ficha, bolsa, item de quest e de montaria: continuam sem venda.
// A raridade não muda o preço (decisão do dono).
import { readFileSync } from 'node:fs';

export const CONFIG = JSON.parse(readFileSync(new URL('../../gamedata/itens/precos-de-venda.json', import.meta.url), 'utf8'));
// Os slots de equipamento (os mesmos de `Afixos.SLOTS_COM_AFIXO`, sem importar o módulo: aqui é o carregamento do catálogo).
const SLOTS_DE_EQUIPAMENTO = new Set(['weapon', 'head', 'body', 'legs', 'feet', 'shield', 'neck', 'ring', 'backpack', 'ammo', 'gloves']);
const ehEquipamento = (m) => !!m && SLOTS_DE_EQUIPAMENTO.has(m.slot) && !m.stackable;
const semPreco = (m) => !(Number(m?.sell) > 0);
const proibido = (m) => {
  const nome = String(m?.name ?? '').toLowerCase();
  return !nome || CONFIG.nunca.some((p) => nome.includes(p)) || (CONFIG.tiposNunca ?? []).includes(m?.type);
};

/** O loot comum sem preço nenhum (lixo, produto de bicho, comida...): o preço fixo do config (1 de ouro). */
function precoFixo(m) {
  const f = CONFIG.precoFixo;
  if (!f) return 0;
  const nome = String(m.name ?? '').toLowerCase();
  const tipo = m.type ?? '(sem tipo)';
  return f.tipos.includes(tipo) || f.nomes.some((n) => nome.includes(n)) ? f.valor : 0;
}

const mediana = (lista) => {
  const v = [...lista].sort((a, b) => a - b);
  return v.length ? v[Math.floor((v.length - 1) / 2)] : 0;
};

/**
 * O preço calculado de um item sem `sell` (0 = continua sem venda).
 * `referencia`: `[level, sell]` dos equipamentos que têm preço (ver `completar`).
 */
export function precoCalculado(m, referencia) {
  if (!m || !semPreco(m) || proibido(m)) return 0;
  if (Number(m.buy) > 0) return Math.max(1, Math.floor(m.buy * CONFIG.fracaoDoPrecoDeCompra));
  if (!ehEquipamento(m)) return precoFixo(m);
  const level = Number(m.minLevel) || 0;
  if (!level) return CONFIG.semLevel;
  let perto = referencia.filter(([l]) => Math.abs(l - level) <= CONFIG.janelaDeLevel).map(([, s]) => s);
  if (!perto.length && referencia.length) {
    // Nenhum na janela: os de level mais próximo.
    const menor = Math.min(...referencia.map(([l]) => Math.abs(l - level)));
    perto = referencia.filter(([l]) => Math.abs(l - level) === menor).map(([, s]) => s);
  }
  return Math.max(1, Math.round(mediana(perto))) || CONFIG.semLevel;
}

/** Preenche o `sell` que falta em todo o catálogo (muta). Devolve quantos ganharam preço. */
export function completar(catalogo) {
  const referencia = Object.values(catalogo)
    .filter((m) => ehEquipamento(m) && !semPreco(m) && Number(m.minLevel) > 0)
    .map((m) => [Number(m.minLevel), Number(m.sell)]);
  let n = 0;
  for (const m of Object.values(catalogo)) {
    const preco = precoCalculado(m, referencia);
    if (!preco) continue;
    m.sell = preco;
    m.sellCalculado = true;
    n++;
  }
  return n;
}
