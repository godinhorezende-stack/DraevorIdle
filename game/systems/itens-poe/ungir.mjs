// O UNGIR e o ENCANTAMENTO do PoE (08/11, balão 0 sem efeito — o dono: "Ungir + Orbe de Encantar"). Os dois põem um ENCANTAMENTO na peça: um
// implícito com `encantamento: true` (o balão mostra à parte, na cor do encantamento), que as outras moedas não mexem (`separar`/`devolver`).
//   - UNGIR: 3 Óleos (os 13 do PoE, do Claro ao Dourado — só dos chefes pináculo) num amuleto, ou numa peça que "Pode ser ungida" (o Cinto de
//     Cordão; os únicos da Infestação — o Rouba-ar, a Guarda dos Esporos, A Debandada e os três Capotes): a receita do poedb
//     (`gamedata/itens-poe/ungir-receitas.json`) diz o notável da árvore, e a peça ganha "Aloca <Notável>" — vestida, o nó vale como alocado
//     (`passivas/arvore.mjs → alocadosPeloUngir`, pela chave `ungido:<notável>` do af).
//   - ENCANTAMENTO (a moeda "Encantamento" do PoE): sorteia um encantamento do Labirinto (`pools-poedb/labirinto.json`) em elmo, luvas ou botas.
//     Só os que têm efeito no jogo entram no sorteio (a maioria dos de elmo fala de uma habilidade que o jogo não traduz ainda).
//   - Uma peça tem UM encantamento; "Pode ter N Modificadores Encantados extras" (o Suspiro Estrangulador, os Capotes) soma N. Cheia, o novo
//     troca um do mesmo tipo (o Ungir troca a unção mais antiga; o Encantamento, um do Labirinto), como no PoE.
import { readFileSync } from 'node:fs';
import * as Catalogo from './catalogo.mjs';
import * as Gerar from './gerar.mjs';
import { traduzirMod } from './traduzir.mjs';

const DADOS = JSON.parse(readFileSync(new URL('../../gamedata/itens-poe/ungir-receitas.json', import.meta.url), 'utf8'));
/** Os 13 Óleos, na ordem do tier (do Claro ao Dourado). */
export const OLEOS = Object.freeze([...DADOS.oleos]);
const ORDEM = new Map(OLEOS.map((s, i) => [s, i]));
const chave = (slugs) => [...slugs].sort((a, b) => ORDEM.get(a) - ORDEM.get(b)).join('+');
const RECEITAS = new Map(DADOS.receitas.map((r) => [chave(r.oleos), r]));
/** Os únicos que podem ser ungidos (poedb › Oil › "Ungir Únicos"). */
export const UNICOS_UNGIVEIS = Object.freeze(new Set(['Breathstealer', 'Sporeguard', 'The_Stampede', 'Replica_Stampede', 'Cowl_of_the_Ceraunophile', 'Cowl_of_the_Cryophile', 'Cowl_of_the_Thermophile']));
/** As classes que o Encantamento (o Labirinto) aceita — o dono: elmo, luvas e botas. */
export const CLASSES_DO_LABIRINTO = Object.freeze(['Helmets', 'Gloves', 'Boots']);

const erro = (e) => ({ ok: false, erro: e });
export const ehOleo = (slug) => ORDEM.has(slug);
/** A receita de 3 Óleos (os slugs, em qualquer ordem): `{ oleos, id, nome, no }` ou null. */
export const receita = (slugs) => (slugs?.length === 3 && slugs.every(ehOleo) ? RECEITAS.get(chave(slugs)) ?? null : null);
export const receitas = () => DADOS.receitas;

/** Os encantamentos da peça (os implícitos marcados). */
export const encantamentos = (p) => (p?.implicitos ?? []).filter((m) => m?.encantamento);
/** Quantos encantamentos cabem: 1, mais os "N extras" da peça (`encantamentos_extras`). */
export const maximoDeEncantamentos = (p) => 1 + Math.max(0, Math.floor(Number(p?.af?.encantamentos_extras) || 0));
/** A peça aceita o Ungir? */
export const ungivel = (p) => !!p && (p.classe === 'Amulets' || Number(p.af?.pode_ser_ungido) > 0 || UNICOS_UNGIVEIS.has(p.unico));

/** Põe o encantamento `novo`: cabendo, junto; cheia, no lugar do primeiro que `trocavel` aceita (ou do primeiro de todos). */
function porEncantamento(p, novo, trocavel) {
  const outros = (p.implicitos ?? []).filter((m) => !m?.encantamento);
  const lista = encantamentos(p);
  if (lista.length >= maximoDeEncantamentos(p)) {
    const i = Math.max(0, lista.findIndex(trocavel));
    lista.splice(i, 1);
  }
  p.implicitos = [...outros, ...lista, novo];
}

/** UNGIR: os 3 Óleos (slugs) na peça `p` (o `poe`). Muda a peça; quem gasta os Óleos é quem chamou. */
export function ungir(p, slugs) {
  if (!ungivel(p)) return erro('Só amuletos e as peças que "Podem ser ungidas" aceitam Óleos.');
  if (slugs?.length !== 3 || !slugs.every(ehOleo)) return erro('O Ungir pede 3 Óleos.');
  const r = receita(slugs);
  if (!r) return erro('Estes 3 Óleos não formam nenhuma unção.');
  if (encantamentos(p).some((m) => m.ungido === r.id)) return erro(`A peça já Aloca ${r.nome}.`);
  const texto = `Aloca ${r.nome}`;
  porEncantamento(p, { familia: 'ungir', modelo: texto, texto, valores: [], encantamento: true, ungido: r.id }, (m) => m.ungido);
  return { ok: true, notice: `${p.nome}: ungida — Aloca ${r.nome}.`, receita: r };
}

/** Os encantamentos do Labirinto da classe que têm efeito no jogo (os grupos do pool, com os tiers). */
let DO_LABIRINTO = null;
export function encantamentosDoLabirinto(classe) {
  DO_LABIRINTO ??= new Map();
  if (!DO_LABIRINTO.has(classe)) {
    const pagina = Catalogo.poolEspecialDa('labirinto', classe, '*');
    const temEfeito = (t) => !['inerte', 'registrado'].includes(traduzirMod({ modelo: t.modelo, valores: t.faixas.map((f) => f[0]) }).estado);
    DO_LABIRINTO.set(classe, (pagina?.implicitos ?? []).map((g) => ({ ...g, tiers: g.tiers.filter(temEfeito) })).filter((g) => g.tiers.length));
  }
  return DO_LABIRINTO.get(classe);
}
/** ENCANTAMENTO (a moeda): um encantamento do Labirinto sorteado (o tier mais alto pesa como o PoE: o peso de cada tier). */
export function encantar(p, rng = Math.random) {
  if (!CLASSES_DO_LABIRINTO.includes(p?.classe)) return erro('O Encantamento vale em elmo, luvas e botas.');
  const grupos = encantamentosDoLabirinto(p.classe);
  if (!grupos.length) return erro('Nenhum encantamento do Labirinto desta classe tem efeito no jogo ainda.');
  const ja = new Set(encantamentos(p).map((m) => m.familia));
  const candidatos = grupos.filter((g) => !ja.has(g.familia)).flatMap((g) => g.tiers.map((t) => [{ g, t }, t.peso || 1]));
  const escolhido = Gerar.porPeso(candidatos, rng);
  if (!escolhido) return erro('Não há outro encantamento para esta peça.');
  const { modelo, valores, texto } = Gerar.rolarTexto(escolhido.t, rng);
  porEncantamento(p, { familia: escolhido.g.familia, tier: escolhido.t.tier, modelo, texto, valores, encantamento: true, labirinto: true }, (m) => m.labirinto);
  return { ok: true, notice: `${p.nome}: encantada — ${texto}.` };
}

/**
 * As outras moedas não mexem nos encantamentos (no PoE eles ficam na peça): `separar` tira antes da moeda e `devolver` põe de volta depois.
 * (A Ramificadora fica de fora: o encantamento dela é a própria peça.)
 */
export function separar(p) {
  if (!p || p.ramificadora) return [];
  const lista = encantamentos(p);
  if (lista.length) p.implicitos = p.implicitos.filter((m) => !m?.encantamento);
  return lista;
}
export function devolver(p, lista) {
  if (p && lista?.length) p.implicitos = [...(p.implicitos ?? []).filter((m) => !m?.encantamento), ...lista];
}

/** Os Óleos que o chefe pináculo solta (`regras.moedas.oleos`): os slugs. */
export function oleosDoPinaculo(rng = Math.random) {
  const cfg = Catalogo.REGRAS?.moedas?.oleos;
  if (!cfg) return [];
  const [min, max] = cfg.quantos ?? [0, 0];
  const n = min + Math.floor(rng() * (max - min + 1));
  const pesos = Object.entries(cfg.pesos ?? {}).filter(([s]) => ehOleo(s));
  return Array.from({ length: n }, () => Gerar.porPeso(pesos, rng)).filter(Boolean);
}
