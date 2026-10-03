// A WIKI pública (`/wiki`): os dados que as páginas leem. Tudo sai da CONFIGURAÇÃO REAL do jogo (`gamedata/itens/*.json`), então a wiki nunca
// diverge do que o servidor faz: mudou um valor no JSON, a tabela da wiki muda junto. O texto explicativo mora em `client/site/wiki.mjs`.
import { ATRIBUTOS, POOLS, TIERS, RARIDADES, ORDEM, EFEITOS } from './itens/config.mjs';
import { ITEM_CATALOG } from './dados.mjs';

/** Os tipos de equipamento com pool, agrupados do jeito que o jogador pensa. */
export const GRUPOS_DE_EQUIPAMENTO = [
  { id: 'armas', nome: 'Armas', tipos: ['arma_melee', 'arma_distancia', 'arma_magica'] },
  { id: 'municao', nome: 'Munição e aljava', tipos: ['municao', 'aljava'] },
  { id: 'escudos', nome: 'Escudos e livros', tipos: ['escudo', 'livro'] },
  { id: 'armaduras', nome: 'Armaduras e botas', tipos: ['armadura', 'bota'] },
  { id: 'aneis', nome: 'Anéis', tipos: ['anel'] },
  { id: 'amuletos', nome: 'Amuletos', tipos: ['amuleto'] },
];

export const NOMES_DAS_CATEGORIAS = { atributo: 'Atributos principais', ofensivo: 'Ofensivos', defensivo: 'Defensivos', resistencia: 'Resistências', vida: 'Regeneração', utilidade: 'Utilitários', avancado: 'Avançados' };

/** A frequência de um modificador no sorteio, em palavras (o peso cru não ajuda quem lê a wiki). */
export const frequenciaDoPeso = (peso) => (peso >= 80 ? 'muito comum' : peso >= 50 ? 'comum' : peso >= 25 ? 'incomum' : 'raro');

const cheia = (texto, numeros) => String(texto ?? '').replace(/\{(\w+)\}/g, (_, k) => String(numeros?.[k] ?? ''));
const achatar = (def) => ({ ...(def.condicao ?? {}), ...(def.efeito ?? {}), ...(def.efeito?.acumuloAoMatar ?? {}) });

/** Um item de exemplo para as figuras (uma espada de verdade do catálogo): a figura desenha o sprite dele. */
function armaDeExemplo() {
  const lista = Object.entries(ITEM_CATALOG).filter(([, i]) => i.slot === 'weapon' && i.attack > 0 && !i.wand && i.skill === 'sword');
  const achada = lista.find(([, i]) => i.name === 'jagged sword') ?? lista[0];
  return achada ? { id: Number(achada[0]), nome: achada[1].name } : null;
}

/** O que a wiki mostra sobre itens: raridades, tiers, modificadores e poderes. */
export function itens() {
  const raridades = ORDEM.map((id) => {
    const r = RARIDADES.raridades[id];
    return {
      id,
      nome: r.nome,
      quantidadeDeModificadores: Object.entries(r.atributos).map(([quantos, chance]) => ({ quantos: Number(quantos), chance })),
      poder: r.efeito ?? null,
      chanceDoPoder: r.efeito ? (r.chanceDoEfeito ?? 1) : 0,
    };
  });
  const chancesDeRaridade = Object.fromEntries(
    Object.entries(RARIDADES.chances).map(([ato, porDificuldade]) => [ato, Object.fromEntries(Object.entries(porDificuldade).map(([dif, tabela]) => [dif, Object.fromEntries(ORDEM.map((r) => [r, tabela[r] ?? 0]))]))]),
  );
  const modificadores = Object.entries(ATRIBUTOS)
    .filter(([, a]) => a.dropa !== false)
    .map(([id, a]) => {
      const pools = Object.entries(POOLS).filter(([, lista]) => lista.includes(id)).map(([tipo]) => tipo);
      return {
        id,
        nome: a.nome,
        categoria: a.categoria,
        tipo: a.tipo,
        faixas: [1, 2, 3, 4, 5].map((t) => a.niveis[String(t)]),
        // Mod de dano em faixa ("Dano adicional 10–20"): o valor é o mínimo e o máximo é N vezes ele.
        proporcaoDoMaximo: a.proporcaoDoMaximo ?? null,
        valorPorRaridade: a.valorPorRaridade ?? null,
        itemLevelMinimo: a.nivelMinimo ?? 1,
        raridades: a.raridades ?? ORDEM,
        frequencia: frequenciaDoPeso(a.peso),
        onde: GRUPOS_DE_EQUIPAMENTO.filter((g) => g.tipos.some((t) => pools.includes(t))).map((g) => g.id),
      };
    });
  const poderes = ['lendario', 'mitico'].map((grupo) => ({
    grupo,
    lista: Object.entries(EFEITOS[grupo] ?? {})
      .filter(([k]) => !k.startsWith('_'))
      .map(([id, def]) => ({ id, nome: def.nome, texto: cheia(def.texto, achatar(def)) })),
  }));
  return {
    exemplos: { arma: armaDeExemplo() },
    convencaoDoTier: 'T1 é o tier mais fraco e T5 o mais forte.',
    raridades,
    chancesDeRaridade,
    atoPorLevel: RARIDADES.atoPorLevel,
    dificuldades: { facil: 'Normal', medio: 'Cruel', dificil: 'Merciless' },
    tiers: {
      porItemLevel: TIERS.itemLevel,
      peso: TIERS.peso,
      viesDaRaridade: TIERS.viesDaRaridade,
      viesDoAmuleto: TIERS.viesDoAmuleto,
      bonusDoBoss: TIERS.bonusDoBoss,
    },
    categorias: NOMES_DAS_CATEGORIAS,
    gruposDeEquipamento: GRUPOS_DE_EQUIPAMENTO.map(({ id, nome }) => ({ id, nome })),
    modificadores,
    poderes,
  };
}
