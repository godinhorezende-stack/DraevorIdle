// Dados estáticos do jogo — só leitura de disco, nenhuma regra aqui. Separado
// de `regras.mjs` (fórmulas) e de `sessao.mjs` (protocolo) para que carregar
// um arquivo novo de captura não obrigue a tocar em nenhum dos dois.
import { readFileSync } from 'node:fs';
import * as PrecoDeVenda from './itens/preco-de-venda.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ_DADOS = join(dirname(fileURLToPath(import.meta.url)), '..', 'gamedata');
const carregar = (arquivo) => JSON.parse(readFileSync(join(RAIZ_DADOS, arquivo), 'utf8'));

/*
 * O mapa REAL da cidade, capturado ao vivo do `ravoxidle.com.br` (que ainda
 * respondia quando isto foi escrito): 187×108, 9 andares, exatamente o que o
 * servidor original manda em `welcome`/`state`. Substitui o placeholder de
 * sala lisa das revisões anteriores — este é a praça de verdade, pixel a
 * pixel, incluindo o atlas (`gamedata/sprites/city.png`, também baixado ao
 * vivo).
 */
export const CITY_MAP = carregar('city-map.json');
export const CITY_META = carregar('city-meta.json');
/*
 * A sala do treino online, capturada ao vivo (`pedirMapa` de dentro do pátio):
 * 37×29, atlas próprio (`gamedata/sprites/treino.png`). No original o pátio NÃO
 * é a cidade — é esta sala, uma instância por jogador (`mapId: treino:<ts>`).
 */
export const TREINO_MAP = carregar('treino-map.json');
/** Catálogo real de itens (nome, peso, raridade) — o mesmo que `welcome.items` manda de verdade. */
export const ITEM_CATALOG = carregar('item-catalog.json');
// O preço de venda ao NPC que o catálogo não tem (ver `itens/preco-de-venda.mjs`): uma vez, aqui.
PrecoDeVenda.completar(ITEM_CATALOG);
/*
 * Itens das receitas do craft que o `item-catalog.json` capturado não tem (ele é
 * mais velho que o set Crafted V2). O NOME é o real, da ficha do craft capturada
 * (`api-mapeada/servidor/craft-por-vocacao.json`); o sprite já está no atlas. O
 * peso não foi capturado — fica o de um token (0,01), que é o que eles são.
 */
for (const [id, name] of [
  [55334, 'Dismantle Token'], [55312, 'Divine Scroll'], [55636, 'Crafted Diamond'],
  [55361, 'Crafted Silver Token'], [55360, 'Crafted Gold Token'], [55729, 'Task Token'],
]) {
  ITEM_CATALOG[id] ??= { id, name, weight: 0.01, stackable: true, type: 'valuables', hasSprite: true, rarity: 'comum' };
}
/** As receitas REAIS do craft (Craftado e V2, por vocação) — tiradas da ficha capturada no original. */
export const RECEITAS_DO_CRAFT = carregar('craft-receitas.json');
/** Os sete grupos REAIS da Máquina de Desmanche (peças e tokens por peça), da ficha capturada. */
export const MAQUINA_DE_DESMANCHE = carregar('desmanche.json');
/** Catálogo REAL da barra de ação (magias/runas/poções + papéis dos 22 slots), capturado ao vivo. */
export const ACTION_CATALOG = carregar('action-catalog.json').catalog;
/*
 * A mesma captura numa segunda conta (Elite Knight level 343; a primeira é o
 * Zotod, knight level 90). O servidor original manda o `damage` de cada magia
 * JÁ CALCULADO para quem pediu — com duas medidas em levels diferentes dá para
 * tirar uma reta por level. Ver `danoNoLevel`, em game/systems/acoes.mjs.
 */
export const ACTION_CATALOG_ALTO = carregar('action-catalog-lvl343.json').catalog;
/*
 * ---- Poção de vida e de mana custa o DOBRO (decisão do dono, 29/09) ----
 *
 * A poção é comprada na hora de usar (o `cost` da entrada da barra, e o `buy` do item de
 * fallback). Os dois dobram aqui, uma vez, na carga: o preço de VENDA (`sell`) continua o
 * capturado. Só vida e mana — spirit e o resto seguem como estão.
 */
export const MULTIPLICADOR_DO_PRECO_DA_POCAO = 2;
const ehPocaoDeVidaOuMana = (nome) => /\b(health|mana) potion\b/i.test(nome ?? '');
for (const item of Object.values(ITEM_CATALOG)) {
  if (ehPocaoDeVidaOuMana(item?.name) && item.buy) item.buy *= MULTIPLICADOR_DO_PRECO_DA_POCAO;
}
for (const catalogo of [ACTION_CATALOG, ACTION_CATALOG_ALTO]) {
  for (const entrada of catalogo.items ?? []) {
    if (ehPocaoDeVidaOuMana(entrada?.name) && entrada.cost) entrada.cost *= MULTIPLICADOR_DO_PRECO_DA_POCAO;
  }
}
/*
 * A Store REAL (`send({t:'store'})` no site original, 2026-09-23): as
 * 11 prateleiras inteiras — pacotes de coins, serviços, exercises, boosts,
 * itens, buff power, upgrades, extras, 242 montarias e 115 outfits, com preço.
 * Capturada num personagem que não tinha comprado nada, então serve de base
 * neutra; o que é DESTE personagem (coins, o que ele já tem) é recalculado em
 * `game/systems/loja.mjs`.
 */
export const STORE_REAL = carregar('store-real.json').store;
/** Todas as montarias (250) e outfits (260) do jogo, com o que vem liberado de graça (`send({t:'mounts'})`). */
export const MONTARIAS_REAIS = carregar('mounts-real.json');
export const LEVELS_DAS_CAPTURAS = [90, 343];
/*
 * Um personagem REAL inteiro, capturado ao vivo (nível 8, recém-criado). Usado
 * como MOLDE em `characterParaCliente`: 96 campos, e o cliente lê quase todos
 * eles sem `?.` — sem cada um presente, e no FORMATO certo (não só `{}`),
 * painel atrás de painel trava. Ver `sessao.mjs`.
 */
export const CHARACTER_TEMPLATE = carregar('character-template.json');
/**
 * O equipamento real de cada vocação — capturado criando um personagem de
 * cada uma no servidor original e lendo `welcome.character.equipment`/
 * `inventory`. Isto é literalmente "o equipamento da vocação" que
 * `panels.mjs` promete na tela de criação.
 */
export const EQUIPAMENTO_POR_VOCACAO = carregar('equipamento-por-vocacao.json');

/*
 * O `catalog` do `hello` — REAL, capturado ao vivo (`window.__state.catalog`,
 * o mesmo objeto que o jogo original usa): 48 hunts de verdade, 87 bosses,
 * 36 hunts vip, a tabela de vocações completa, bestiary, imbuements, afixos,
 * preços de prey/loja.
 */
const CATALOGO_REAL = carregar('catalog-real.json');
export const CATALOGO = {
  ...CATALOGO_REAL,
  // Login com Google e recuperação de senha por e-mail não existem nesta
  // restauração — sem isto o cliente mostraria o botão do Google e ele não
  // faria nada ao clicar.
  googleClientId: null,
  emailLigado: false,
  // O drop do Gem Atelier (`catalog.gemas` do original, 2026-09-25) — a ficha
  // do item diz "cai de qualquer criatura com N de exp" com isto.
  gemas: CATALOGO_REAL.gemas ?? JSON.parse(readFileSync(new URL('../gamedata/gemas.json', import.meta.url), 'utf8')).drop,
};

/** Índice do tile em `CITY_MAP.blocked` (a mesma ordem de `map.ground`: y*width+x). */
export const bloqueado = (x, y) => {
  if (x < 0 || y < 0 || x >= CITY_MAP.width || y >= CITY_MAP.height) return true;
  return !!CITY_MAP.blocked[y * CITY_MAP.width + x];
};

/*
 * A cidade no formato de grade que o pathfinding da hunt usa (`caminho.mjs`:
 * `{minX, maxX, minY, maxY, andavel}`) — o MESMO `bloqueado` de cima, para o
 * clique no mapa (`walkTo`) andar pela mesma busca que a caçada já usa, e não
 * por uma segunda. Montada uma vez só (187x108, ~11 mil casas andáveis).
 */
let gradeDaCidadeGuardada = null;
export function gradeDaCidade() {
  if (gradeDaCidadeGuardada) return gradeDaCidadeGuardada;
  const andavel = new Set();
  for (let y = 0; y < CITY_MAP.height; y++) for (let x = 0; x < CITY_MAP.width; x++) if (!bloqueado(x, y)) andavel.add(`${x},${y}`);
  gradeDaCidadeGuardada = { minX: 0, maxX: CITY_MAP.width - 1, minY: 0, maxY: CITY_MAP.height - 1, andavel };
  return gradeDaCidadeGuardada;
}
