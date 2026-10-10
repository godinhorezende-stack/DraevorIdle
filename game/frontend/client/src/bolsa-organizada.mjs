// A BOLSA DE LOOT ORGANIZADA (modo PoE — dono, 10/10): o que cai entra sozinho na sua SEÇÃO (Moedas, Equipáveis, Frascos, Gemas, Mapas,
// Itens de quest, Outros) e, dentro de Equipáveis e Frascos, no GRUPO da categoria do PoE (Armaduras de Corpo, Elmos, Luvas, Machados de Uma Mão...). A bolsa
// continua uma lista só no servidor: aqui é só a forma de mostrar — abas, busca, ordenação. Sem DOM: a janela é `inventory.mjs`.
import { CATEGORIA } from './itens-poe-balao.mjs';

/** As seções, na ordem da tela. `vazia`: o texto da seção sem nada. */
export const SECOES = [
  { id: 'currency', titulo: 'Moedas', sub: 'Moedas, Orbs, fragmentos e itens de troca' },
  { id: 'equipamentos', titulo: 'Equipáveis', sub: 'Armas, armaduras e acessórios, por categoria' },
  { id: 'frascos', titulo: 'Frascos', sub: 'Frascos de Vida, Mana e Utilidade, e Tinturas' },
  { id: 'gemas', titulo: 'Gemas', sub: 'Gemas de habilidade e de suporte' },
  { id: 'mapas', titulo: 'Mapas', sub: 'Mapas do Atlas' },
  { id: 'quest', titulo: 'Itens de quest', sub: 'Itens de missão dos Atos' },
  { id: 'outros', titulo: 'Outros', sub: 'O que não é de nenhuma seção acima' },
];
/** As seções que se dividem pela categoria do PoE (`grupos`). */
const COM_GRUPOS = new Set(['equipamentos', 'frascos']);
const FRASCOS = new Set(['Life_Flasks', 'Mana_Flasks', 'Utility_Flasks', 'Tinctures']);

/** A ordem dos GRUPOS (Equipáveis e Frascos): armas, mão secundária, armaduras, acessórios, frascos e joias (o que não está aqui vai no fim). */
export const ORDEM_DAS_CLASSES = [
  'One_Hand_Swords', 'Thrusting_One_Hand_Swords', 'One_Hand_Axes', 'One_Hand_Maces', 'Sceptres', 'Daggers', 'Rune_Daggers', 'Claws', 'Wands',
  'Two_Hand_Swords', 'Two_Hand_Axes', 'Two_Hand_Maces', 'Staves', 'Warstaves', 'Bows', 'Fishing_Rods',
  'Shields', 'Quivers',
  'Body_Armours', 'Helmets', 'Gloves', 'Boots',
  'Belts', 'Rings', 'Amulets', 'Trinkets',
  'Life_Flasks', 'Mana_Flasks', 'Utility_Flasks', 'Tinctures',
  'Jewels', 'Abyss_Jewels',
];

/** O nome do GRUPO (plural). Sem plural aqui, a categoria do balão (`CATEGORIA`, singular). */
const PLURAL = {
  Body_Armours: 'Armaduras de Corpo', Helmets: 'Elmos', Gloves: 'Luvas', Boots: 'Botas', Belts: 'Cintos', Shields: 'Escudos', Quivers: 'Aljavas',
  Rings: 'Anéis', Amulets: 'Amuletos', Trinkets: 'Bugigangas', Jewels: 'Joias', Abyss_Jewels: 'Joias Abissais',
  One_Hand_Swords: 'Espadas de Uma Mão', Thrusting_One_Hand_Swords: 'Espadas de Estocada', Two_Hand_Swords: 'Espadas de Duas Mãos',
  One_Hand_Axes: 'Machados de Uma Mão', Two_Hand_Axes: 'Machados de Duas Mãos', One_Hand_Maces: 'Maças de Uma Mão', Two_Hand_Maces: 'Maças de Duas Mãos',
  Sceptres: 'Cetros', Staves: 'Cajados', Warstaves: 'Cajados de Guerra', Claws: 'Garras', Daggers: 'Adagas', Rune_Daggers: 'Adagas Rúnicas',
  Bows: 'Arcos', Wands: 'Varinhas', Fishing_Rods: 'Varas de Pesca',
  Life_Flasks: 'Frascos de Vida', Mana_Flasks: 'Frascos de Mana', Utility_Flasks: 'Frascos de Utilidade', Tinctures: 'Tinturas',
};
export const rotuloDoGrupo = (classe) => PLURAL[classe] ?? CATEGORIA[classe] ?? 'Outros equipamentos';

/** A classe do PoE da peça (`Helmets`, `One_Hand_Axes`...): da peça, ou da base no catálogo. */
export function classeDe(entry, meta) {
  return entry?.poe?.classe ?? meta?.poe?.classe ?? (String(entry?.poe?.base ?? meta?.poe?.base ?? '').split('/')[0] || null);
}

/** Em que seção a pilha entra. `meta`: o item no catálogo do cliente (`state.items[id]`). */
export function secaoDe(entry, meta) {
  if (meta?.missao || meta?.type === 'quest items') return 'quest';
  if (meta?.mapa || classeDe(entry, meta) === 'Maps') return 'mapas';
  if (meta?.moedaPoe || meta?.orbeDeSocket) return 'currency';
  if (meta?.gemaDef || entry?.gema) return 'gemas';
  if (meta?.frasco || FRASCOS.has(classeDe(entry, meta))) return 'frascos';
  if (entry?.poe || meta?.poe || meta?.slot) return 'equipamentos';
  return 'outros';
}

const RARIDADE = { unico: 4, raro: 3, magico: 2, normal: 1 };
/** A raridade como número (Único 4 → Normal 1; moeda e o resto 0). */
export const pesoDaRaridade = (entry) => RARIDADE[entry?.poe?.raridade ?? entry?.gema?.raridade ?? entry?.raridade] ?? 0;
/** O nível que ordena: o Item Level da peça, o nível da gema, ou o nível que o item pede. */
export const nivelDe = (entry, meta) => Number(entry?.poe?.ilvl ?? entry?.gema?.nivel ?? meta?.minLevel ?? 0) || 0;
/** O nome que a busca procura: o da peça (Raros têm nome próprio) e o da base. */
export const nomeDe = (entry, meta) => [entry?.poe?.nome, meta?.name].filter(Boolean).join(' ');

/** Os jeitos de ordenar. `categoria`: a ordem em que caíram (a da bolsa). */
export const ORDENS = { categoria: 'Categoria', raridade: 'Raridade', nivel: 'Nível', nome: 'Nome' };

const semAcento = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * A bolsa em seções. `pouch`: a lista do personagem; `itens`: o catálogo do cliente. `opcoes`: `{ aba, busca, ordem, desc }` — `aba`
 * 'todos' ou o id de uma seção. Devolve `{ contagem: {secao: n}, total, secoes: [{ ...SECAO, itens: [{entry, i}], grupos? }] }`: as
 * seções com algo (depois da aba e da busca); Equipáveis e Frascos vêm também em `grupos` (`[{ classe, rotulo, itens }]`, na `ORDEM_DAS_CLASSES`).
 * `i` é o índice na bolsa inteira — o que o servidor conhece. A contagem das abas não olha a busca.
 */
export function organizar(pouch, itens, { aba = 'todos', busca = '', ordem = 'categoria', desc = false } = {}) {
  const contagem = Object.fromEntries(SECOES.map((s) => [s.id, 0]));
  const porSecao = Object.fromEntries(SECOES.map((s) => [s.id, []]));
  const termo = semAcento(busca).trim();
  (pouch ?? []).forEach((entry, i) => {
    const meta = itens?.[entry.id];
    const secao = secaoDe(entry, meta);
    contagem[secao]++;
    if (termo && !semAcento(nomeDe(entry, meta)).includes(termo)) return;
    porSecao[secao].push({ entry, i, meta });
  });
  const comparar = {
    categoria: (a, b) => a.i - b.i,
    raridade: (a, b) => pesoDaRaridade(b.entry) - pesoDaRaridade(a.entry) || nivelDe(b.entry, b.meta) - nivelDe(a.entry, a.meta) || a.i - b.i,
    nivel: (a, b) => nivelDe(b.entry, b.meta) - nivelDe(a.entry, a.meta) || pesoDaRaridade(b.entry) - pesoDaRaridade(a.entry) || a.i - b.i,
    nome: (a, b) => semAcento(nomeDe(a.entry, a.meta)).localeCompare(semAcento(nomeDe(b.entry, b.meta))) || a.i - b.i,
  }[ordem] ?? ((a, b) => a.i - b.i);
  const ordenar = (lista) => {
    lista.sort(comparar);
    return desc ? lista.reverse() : lista;
  };
  const secoes = [];
  for (const s of SECOES) {
    if (aba !== 'todos' && aba !== s.id) continue;
    const lista = porSecao[s.id];
    if (!lista.length) continue;
    const secao = { ...s, itens: ordenar(lista).map(({ entry, i }) => ({ entry, i })) };
    if (COM_GRUPOS.has(s.id)) {
      const grupos = new Map();
      for (const x of lista) {
        const classe = classeDe(x.entry, x.meta) ?? '';
        if (!grupos.has(classe)) grupos.set(classe, []);
        grupos.get(classe).push({ entry: x.entry, i: x.i });
      }
      const posicao = (c) => (ORDEM_DAS_CLASSES.includes(c) ? ORDEM_DAS_CLASSES.indexOf(c) : ORDEM_DAS_CLASSES.length);
      secao.grupos = [...grupos.entries()].sort(([a], [b]) => posicao(a) - posicao(b) || a.localeCompare(b)).map(([classe, lista2]) => ({ classe, rotulo: rotuloDoGrupo(classe), itens: lista2 }));
    }
    secoes.push(secao);
  }
  return { contagem, total: (pouch ?? []).length, secoes };
}

/**
 * A chave de SELEÇÃO de uma pilha: o índice + o que a pilha é. Se a bolsa mudar e outra peça ocupar o índice, a chave não bate mais e a
 * marcação some sozinha (nunca move ou protege a peça errada).
 */
export function chaveDaPilha(entry, i) {
  const { count, trava, ...resto } = entry ?? {};
  return `${i}|${JSON.stringify(resto)}`;
}
