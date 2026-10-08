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
//   estrelas douradas, e as bags (Bag You Desire/Covet, Primal, Draevor Bag/Set —
//   os itens "usáveis" com "bag" no nome). Épico comum de hunt NÃO entra.
//
// ESTIMADO: `estrelas` = quantos afixos a peça tem e `forca` = a cor do melhor
// (1 azul, 2 roxa, 3 dourada, 4 vermelha — `Afixos.corDaPeca`). As bags ainda
// não abrem neste servidor (nenhum item "usável" tem efeito), então `bags` fica
// vazia até esse sistema existir; `anotarBag` já está pronto para ele.
//
// Este módulo é importado pelo combate: não importa nada de caçada/sessão.
import { banco } from '../database/banco.mjs';
import { ITEM_CATALOG, CATALOGO } from './dados.mjs';
import * as Afixos from './afixos.mjs';
import * as EfeitosDeItem from './itens/efeitos.mjs';
import { raridadeDaPeca, metaDaPeca, camposDaPeca } from './itens/item.mjs';
import { RARIDADES_ANUNCIADAS } from './anuncios.mjs';
import { ligado } from './itens-poe/catalogo.mjs';

const GUARDA = 30;
// Épico para cima, como o anúncio para o servidor inteiro (a mesma lista: os dois nunca divergem).
const DE_BOSS = RARIDADES_ANUNCIADAS;
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

const idAuto = banco.dialeto === 'postgres' ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
const inteiroGrande = banco.dialeto === 'postgres' ? 'BIGINT' : 'INTEGER';
await banco.exec(`
  CREATE TABLE IF NOT EXISTS site_drops (
    id    ${idAuto},
    tipo  TEXT NOT NULL,   -- 'drop' ou 'bag'
    em    ${inteiroGrande} NOT NULL,
    dados TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS site_drops_tipo ON site_drops(tipo, em);
`);
const Q = {
  anotar: banco.prepare('INSERT INTO site_drops (tipo, em, dados) VALUES (?, ?, ?)'),
  ultimos: banco.prepare('SELECT dados FROM site_drops WHERE tipo = ? ORDER BY em DESC, id DESC LIMIT ?'),
  aparar: banco.prepare('DELETE FROM site_drops WHERE tipo = ? AND id NOT IN (SELECT id FROM site_drops WHERE tipo = ? ORDER BY em DESC, id DESC LIMIT ?)'),
};

/** A cor de um atributo pelo NÍVEL: 1 azul, 2 roxa, 3 dourada, 4 vermelha (acima do topo) — ver `Afixos.corDoAtributo`. */
const corDoAfixo = (a) => Afixos.corDoAtributo(a);

const numeroBr = (v) => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 });

/** Os afixos como o site escreve: "+7,9% Resistência a ice". */
function afixosDoSite(af) {
  return (af ?? []).map((a) => {
    const f = Afixos.FICHAS[a.id] ?? { nome: a.id, tipo: 'pct' };
    const nivel = Afixos.nivelDe(a);
    return { texto: `+${numeroBr(a.value)}${f.tipo === 'pct' ? '%' : ''} ${f.nome}`, nivel, tier: nivel, pct: Afixos.pctDe(a), q: corDoAfixo(a) };
  });
}

/** Os campos da peça que o balão do site mostra, tirados do catálogo. */
function fichaDaPeca(id, count, peca = {}) {
  // Com a faixa que a peça sorteou no drop (`peca.base`): o site mostra a média e, se houver, a faixa.
  const it = metaDaPeca({ ...peca, id }) ?? {};
  const af = peca.af ?? [];
  return {
    id,
    nome: it.name ?? `item ${id}`,
    count,
    // A raridade do DROP (o sistema de itens); a do catálogo só para peça antiga.
    raridade: raridadeDaPeca(peca),
    // Só quando tem (Lendário/Mítico): as outras linhas seguem no formato do original.
    ...(peca.efeito ? { efeito: EfeitosDeItem.textoDoEfeito(peca.efeito) } : {}),
    estrelas: af.length,
    forca: af.length ? Afixos.corDaPeca({ af }) : 0,
    tier: peca.tier ?? 0,
    slot: it.slot ?? null,
    tipo: it.type ?? null,
    atk: it.attack ?? 0,
    ...(peca.base?.attack ? { atkFaixa: peca.base.attack } : {}),
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

/** Vale a capa? Bag; item Épico, Lendário ou Mítico (a raridade do drop); ou 2+ atributos T5. */
export function valeAnotar(id, af, { raridade = null } = {}) {
  if (ehBag(id)) return true;
  if (DE_BOSS.has(raridade)) return true;
  return (af ?? []).filter((a) => Afixos.nivelDe(a) >= 5).length >= 2;
}

async function guardar(tipo, dados) {
  await Q.anotar.run(tipo, dados.em, JSON.stringify(dados));
  await Q.aparar.run(tipo, tipo, GUARDA);
}

/*
 * Um drop de caçada: `quem` matou `bicho` em `onde` e caiu `id` (com os
 * afixos `af`). Chamada do combate (a cada morte com drop — caminho quente):
 * fogo e esquece de propósito, é só um log para a capa do site, não pode
 * atrasar o golpe que acabou de matar o bicho.
 */
/*
 * A PEÇA inteira (`{id, count, raridade, ilvl, base, af, efeito, tier}`), para
 * a capa desenhar o MESMO balão do jogo (`fichaDeItem`, à Path of Exile) — com
 * Armour/Evasion/Energy Shield, Item Level, tiers e poder. Os campos soltos de
 * `fichaDaPeca` continuam: são os do card da faixa.
 */
const pecaDoSite = (id, count, peca) => ({ id, count, ...camposDaPeca(peca ?? {}) });

export async function anotarDrop({ quem, onde, bicho, boss = false, id, count = 1, af = null, tier = 0, raridade = null, efeito = null, peca = null }) {
  if (emTeste() || !valeAnotar(id, af, { raridade })) return;
  const { afixos, ...resto } = fichaDaPeca(id, count, { af, tier, raridade, efeito, ...(peca ? { base: peca.base, ilvl: peca.ilvl } : {}) });
  await guardar('drop', { ...resto, quem, em: Date.now(), onde, boss, bicho, chance: ITEM_CATALOG[id]?.dropChance ?? null, afixos, peca: pecaDoSite(id, count, peca ?? { af, tier, raridade, efeito }) });
}

/*
 * ---- No jogo oficial (PoE): o ÚNICO do PoE ----
 * O mesmo critério do anúncio para o servidor inteiro (`anuncios.vale`: dono, 07/10, "item únicos são anunciados para todos"): a capa
 * mostra os Únicos que caíram — de monstro na caçada, da sacola do boss ou o exclusivo do chefe pináculo. A peça vai inteira (`poe`:
 * nome, raridade, mods), para o balão do jogo desenhá-la como no jogo.
 */
export const valeAnotarPoe = (peca) => peca?.poe?.raridade === 'unico';

export async function anotarDropPoe({ quem, onde, bicho, boss = false, peca }) {
  if (emTeste() || !valeAnotarPoe(peca)) return;
  const meta = ITEM_CATALOG[peca.id] ?? {};
  const count = peca.count ?? 1;
  await guardar('drop', {
    id: peca.id, nome: peca.poe.nome ?? meta.name ?? `item ${peca.id}`, count, raridade: 'unico',
    estrelas: 0, forca: 0, tier: 0, slot: meta.slot ?? null, tipo: meta.type ?? null, atk: 0, def: 0, defExtra: 0, armor: 0,
    minLevel: meta.minLevel ?? 0, peso: meta.weight ?? 0, skill: null, elemento: null, vocacoes: null, container: 0,
    quem, em: Date.now(), onde, boss, bicho, chance: null, afixos: [], peca: pecaDoSite(peca.id, count, peca),
  });
}

/** O que saiu de uma bag aberta (`bag` = o id da bag, `entre` = de quantas opções). */
export async function anotarBag({ quem, bag, entre, id, count = 1, af = null, tier = 0, raridade = null, efeito = null, peca = null }) {
  // O que sai de uma bag vai sempre (a lista é "uma peça sorteada por bag").
  if (emTeste()) return;
  await guardar('bag', { ...fichaDaPeca(id, count, { af, tier, raridade, efeito }), quem, em: Date.now(), bag, bagNome: ITEM_CATALOG[bag]?.name ?? null, entre, peca: pecaDoSite(id, count, peca ?? { af, tier, raridade, efeito }) });
}

/** `GET /api/drops`. */
export async function vista() {
  const ler = async (tipo) => (await Q.ultimos.all(tipo, GUARDA)).map((r) => JSON.parse(r.dados));
  // No jogo oficial a capa é do PoE: só os drops do PoE (os do Draevor, de antes da troca, ficam no banco e não aparecem), e nada de
  // bags — as bolsas (Bag You Desire, Primal...) são do Draevor; `bags: null` diz à capa para esconder a faixa delas.
  const oficial = ligado();
  const drops = (await ler('drop')).filter((d) => !oficial || d.peca?.poe);
  const bags = oficial ? null : await ler('bag');
  // O que o balão do jogo precisa para desenhar estas peças: o catálogo DELAS e as réguas de afixo e poder.
  const itens = {};
  for (const d of [...drops, ...(bags ?? [])]) {
    for (const id of [d.id, d.bag]) if (id != null && ITEM_CATALOG[id]) itens[id] = ITEM_CATALOG[id];
  }
  return { drops, bags, itens, catalogo: { afixos: CATALOGO.afixos, efeitosDeItem: CATALOGO.efeitosDeItem, efeitosDeTier: CATALOGO.efeitosDeTier } };
}
