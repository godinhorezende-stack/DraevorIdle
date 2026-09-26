// Os drops raros que a capa do site mostra (`/api/drops`, lido por
// client/site/drops.mjs): `{drops, bags}`, os 30 mais novos de cada.
//
// Do original (api-mapeada/captura-site-0926/drops.json):
// - drop: {id, nome, count, raridade, quem, em, onde (a caçada), boss, bicho,
//   chance (o `dropChance` do catálogo), estrelas, forca, tier, slot, tipo, atk,
//   def, defExtra, armor, minLevel, peso, skill, elemento, vocacoes, container,
//   afixos: [{texto, tier, pct, q}]}.
// - bag: o mesmo, com {bag, bagNome, entre} no lugar de onde/boss/bicho/chance.
// - Entra na lista (o texto da própria capa, e tudo na captura bate): peça
//   lendária ou mítica de BOSS com duas estrelas ou mais, qualquer item com três
//   estrelas douradas, e as bags (Bag You Desire/Covet, Primal, Ravox Bag/Set —
//   os itens "usáveis" com "bag" no nome). Épico comum de hunt NÃO entra.
//
// ESTIMADO: `estrelas` = quantos afixos a peça tem e `forca` = a cor do melhor
// (1 azul, 2 roxa, 3 dourada, 4 vermelha — `Afixos.corDaPeca`). As bags ainda
// não abrem neste servidor (nenhum item "usável" tem efeito), então `bags` fica
// vazia até esse sistema existir; `anotarBag` já está pronto para ele.
//
// Este módulo é importado pelo combate: não importa nada de caçada/sessão.
import * as B from '../nucleo/banco.mjs';
import { ITEM_CATALOG } from '../nucleo/dados.mjs';
import * as Afixos from './afixos.mjs';

const GUARDA = 30;
const DE_BOSS = new Set(['lendário', 'mítico']);
/** As bags do jogo: usáveis, com "bag" no nome (34109, 39546, 43895, 55216, 55517). */
export const ehBag = (id) => !!ITEM_CATALOG[id]?.usavel && /\bbag\b/i.test(ITEM_CATALOG[id]?.name ?? '');

/*
 * A suíte de testes roda caçadas de verdade no banco de verdade: sem esta trava,
 * cada `npm test` enchia a capa de "Teste Automatizado". O `node --test` põe
 * NODE_TEST_CONTEXT no ambiente de cada arquivo; o teste do site liga de volta.
 */
let gravarEmTeste = false;
export const gravarNosTestes = (sim = true) => void (gravarEmTeste = sim);
const emTeste = () => !!process.env.NODE_TEST_CONTEXT && !gravarEmTeste;

B.db.exec(`
  CREATE TABLE IF NOT EXISTS site_drops (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo  TEXT NOT NULL,   -- 'drop' ou 'bag'
    em    INTEGER NOT NULL,
    dados TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS site_drops_tipo ON site_drops(tipo, em);
`);
const Q = {
  anotar: B.db.prepare('INSERT INTO site_drops (tipo, em, dados) VALUES (?, ?, ?)'),
  ultimos: B.db.prepare('SELECT dados FROM site_drops WHERE tipo = ? ORDER BY em DESC, id DESC LIMIT ?'),
  aparar: B.db.prepare('DELETE FROM site_drops WHERE tipo = ? AND id NOT IN (SELECT id FROM site_drops WHERE tipo = ? ORDER BY em DESC, id DESC LIMIT ?)'),
};

/** A cor de um afixo, na régua: 1 azul, 2 roxa, 3 dourada, 4 vermelha (acima do topo). */
const corDoAfixo = (a) => {
  const pct = Afixos.pctDe(a);
  return pct > 100 ? 4 : pct >= 67 ? 3 : pct >= 34 ? 2 : 1;
};

const numeroBr = (v) => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 });

/** Os afixos como o site escreve: "+7,9% Resistência a ice". */
function afixosDoSite(af) {
  return (af ?? []).map((a) => {
    const f = Afixos.FICHAS[a.id] ?? { nome: a.id, tipo: 'pct' };
    return { texto: `+${numeroBr(a.value)}${f.tipo === 'pct' ? '%' : ''} ${f.nome}`, tier: a.tier ?? 1, pct: Afixos.pctDe(a), q: corDoAfixo(a) };
  });
}

/** Os campos da peça que o balão do site mostra, tirados do catálogo. */
function fichaDaPeca(id, count, peca = {}) {
  const it = ITEM_CATALOG[id] ?? {};
  const af = peca.af ?? [];
  return {
    id,
    nome: it.name ?? `item ${id}`,
    count,
    raridade: it.rarity ?? 'comum',
    estrelas: af.length,
    forca: af.length ? Afixos.corDaPeca({ af }) : 0,
    tier: peca.tier ?? 0,
    slot: it.slot ?? null,
    tipo: it.type ?? null,
    atk: it.attack ?? 0,
    def: it.defense ?? 0,
    defExtra: it.extraDefense ?? 0,
    armor: it.armor ?? 0,
    minLevel: it.minLevel ?? 0,
    peso: it.weight ?? 0,
    skill: it.skill ?? null,
    elemento: it.element ?? null,
    vocacoes: it.vocations ?? null,
    container: it.container ?? 0,
    afixos: afixosDoSite(af),
  };
}

/** Vale a capa? Bag; três estrelas douradas; ou lendária/mítica de boss com 2+ estrelas. */
export function valeAnotar(id, af, { boss = false } = {}) {
  if (ehBag(id)) return true;
  const estrelas = af?.length ?? 0;
  if (estrelas >= 3 && af.every((a) => corDoAfixo(a) >= 3)) return true;
  return boss && estrelas >= 2 && DE_BOSS.has(ITEM_CATALOG[id]?.rarity);
}

function guardar(tipo, dados) {
  Q.anotar.run(tipo, dados.em, JSON.stringify(dados));
  Q.aparar.run(tipo, tipo, GUARDA);
}

/** Um drop de caçada: `quem` matou `bicho` em `onde` e caiu `id` (com os afixos `af`). */
export function anotarDrop({ quem, onde, bicho, boss = false, id, count = 1, af = null, tier = 0 }) {
  if (emTeste() || !valeAnotar(id, af, { boss })) return;
  const { afixos, ...resto } = fichaDaPeca(id, count, { af, tier });
  guardar('drop', { ...resto, quem, em: Date.now(), onde, boss, bicho, chance: ITEM_CATALOG[id]?.dropChance ?? null, afixos });
}

/** O que saiu de uma bag aberta (`bag` = o id da bag, `entre` = de quantas opções). */
export function anotarBag({ quem, bag, entre, id, count = 1, af = null, tier = 0 }) {
  // O que sai de uma bag vai sempre (a lista é "uma peça sorteada por bag").
  if (emTeste()) return;
  guardar('bag', { ...fichaDaPeca(id, count, { af, tier }), quem, em: Date.now(), bag, bagNome: ITEM_CATALOG[bag]?.name ?? null, entre });
}

/** `GET /api/drops`. */
export function vista() {
  const ler = (tipo) => Q.ultimos.all(tipo, GUARDA).map((r) => JSON.parse(r.dados));
  return { drops: ler('drop'), bags: ler('bag') };
}
