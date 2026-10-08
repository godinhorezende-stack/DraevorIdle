// Um personagem de verdade para os testes — o mesmo molde de
// `estadoInicialPersonagem` (sessao.mjs), sem abrir o banco.
import { readFileSync } from 'node:fs';
import * as R from '../systems/regras.mjs';
import * as Inventario from '../systems/inventario.mjs';
import * as Afixos from '../systems/afixos.mjs';
import * as GemasDeSkill from '../systems/skills/gemas.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import * as Recompensas from '../systems/recompensas.mjs';
import * as Loja from '../systems/loja.mjs';
import { CHARACTER_TEMPLATE } from '../systems/dados.mjs';
import * as Campanha from '../systems/campanha.mjs';
import { ligado as jogoOficial } from '../systems/itens-poe/catalogo.mjs';
import { iniciarJogoDoPoe } from '../systems/itens-poe/iniciar.mjs';

/*
 * A HUNT DE TESTE: no jogo oficial (PoE), a área do PoE sobre o MESMO terreno da Troll Cave (o Navio Encalhado: a mesma grade, as
 * mesmas casas, os mesmos pontos de spawn) — as hunts do Draevor não existem no oficial (`cacadas.entrar`). No clássico, a Troll Cave.
 * Os testes que usam coordenadas da Troll Cave continuam valendo nos dois.
 */
export const HUNT_DE_TESTE = jogoOficial() ? 'poe-a1-the-ship-graveyard-cave' : 'troll-cave';

const AREAS_DO_POE = Object.entries(JSON.parse(readFileSync(new URL('../gamedata/itens-poe/campanha-poe.json', import.meta.url), 'utf8')).areas ?? {});
/** A área do PoE sobre o MESMO terreno de uma hunt do Draevor (a primeira, na ordem da campanha); no clássico, a própria hunt. */
export function huntDoPoe(huntDoDraevor) {
  if (!jogoOficial()) return huntDoDraevor;
  return AREAS_DO_POE.find(([, a]) => a.mapa === huntDoDraevor && !a.cidade)?.[0] ?? huntDoDraevor;
}

// O processo de um teste é um PONTO DE ENTRADA como o servidor: carrega o MESMO jogo pelo mesmo bootstrap (as áreas, os monstros, as
// gemas e os itens do PoE). No modo clássico (`DRAEVOR_CLASSICO=1`, ver `apoio-classico.mjs`) não faz nada.
await iniciarJogoDoPoe();

/*
 * A campanha INTEIRA liberada (as 48 fases e os 4 bosses nas três dificuldades):
 * os testes que entram numa hunt qualquer são de antes da campanha, e testam
 * outra coisa. Os testes da campanha montam o progresso deles (`campanha: {}`).
 */
export function campanhaCompleta() {
  const tudo = { kills: {}, completas: Campanha.FASES.map((f) => f.huntId), bosses: [1, 2, 3, 4] };
  return Object.fromEntries(Campanha.DIFICULDADES.map((d) => [d, structuredClone(tudo)]));
}

export function personagemDeTeste({ vocacao = 'knight', level = R.NIVEL_INICIAL, campanha = campanhaCompleta() } = {}) {
  const { maxHp, maxMana } = R.statsBase(vocacao, level);
  const e = {
    level,
    xp: R.expForLevel(level),
    vocation: vocacao,
    sex: 'male',
    outfit: { type: R.LOOK_DA_VOCACAO[vocacao].male, head: 0, body: 0, legs: 0, feet: 0, mount: 0, addons: 0 },
    hp: maxHp,
    maxHp,
    mana: maxMana,
    maxMana,
    gold: 500,
    bank: 0,
    coins: 0,
    stamina: 2520,
    maxStamina: 2520,
    equipment: Inventario.equipamentoInicial(vocacao),
    inventory: Inventario.inventarioInicial(vocacao),
    pos: { ...R.POSICAO_INICIAL },
    actions: Array(22).fill(null),
    hotkeys: [...CHARACTER_TEMPLATE.hotkeys],
    actionPresets: [],
    settings: { ...CHARACTER_TEMPLATE.settings },
    ...Recompensas.estadoInicial(),
    ...Loja.estadoInicial(),
    campanha,
    // Do jogo oficial (PoE): sem a marca, ele seria um personagem do Draevor clássico, ARQUIVADO (`personagem/legado.mjs`), que não entra
    // no jogo. Os testes de legado tiram a marca de propósito.
    sistema: 'poe',
  };
  // Como ao entrar no jogo (`sessao.mjs`): a vida/mana dos adds e do STR/INT já no máximo, e cheias.
  Afixos.sincronizarMaximos(e);
  e.hp = e.maxHp;
  e.mana = e.maxMana;
  return e;
}

export const PERSONAGEM = { id: 0, nome: 'Teste Automatizado' };

/*
 * As fichas capturadas em `api-mapeada/` são do servidor original (Ravox
 * Idle) e ficam como estavam — é o registro histórico da captura. O jogo
 * virou Draevor Idle, então os testes de fidelidade ("é igual à ficha real")
 * comparam contra essa ficha JÁ com o nome trocado, e não contra o nome
 * antigo. Troca chave e valor, recursivo, sem mexer no arquivo no disco.
 */
export function comMarcaNova(valor) {
  if (typeof valor === 'string') return valor.replace(/RAVOX/g, 'DRAEVOR').replace(/Ravox/g, 'Draevor').replace(/ravox/g, 'draevor');
  if (Array.isArray(valor)) return valor.map(comMarcaNova);
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [comMarcaNova(k), comMarcaNova(v)]));
  }
  return valor;
}


/*
 * ---- As skills pelas GEMAS (modelo Path of Exile) ----
 * Sem a gema encaixada numa peça vestida, a magia/runa não existe para o
 * personagem. Os testes que usam skills encaixam as gemas delas aqui, como o
 * jogador faria: cada slot de socket ganha uma peça (a que já estiver vestida
 * fica) com os sockets todos abertos e SEM links (nenhuma support por acaso), e
 * as gemas entram na ordem. `conjuracao: false` (o padrão) zera o Cast Time
 * dessas gemas NESTE processo de teste — para os testes que não são sobre a
 * conjuração continuarem medindo o que medem.
 */
const PECA_PARA_O_SLOT = {};
for (const slot of Object.keys(GemasDeSkill.CONFIG.sockets.maximo)) {
  PECA_PARA_O_SLOT[slot] = Object.values(ITEM_CATALOG).find((i) => i.slot === slot && !i.stackable && !i.vocations?.length && !(i.minLevel > 1) && !i.twoHanded)?.id;
}
export function comSkills(e, ids, { nivel = 1, conjuracao = false } = {}) {
  const itens = ids.map((id) => GemasDeSkill.ITEM_DA_ACAO.get(id));
  if (itens.some((x) => !x)) throw new Error(`skill sem gema: ${ids.filter((id) => !GemasDeSkill.ITEM_DA_ACAO.has(id)).join(', ')}`);
  if (!conjuracao) for (const it of itens) GemasDeSkill.DEFS.get(it).castTime = 0;
  let k = 0;
  for (const slot of ['weapon', 'body', 'shield', 'head', 'legs', 'feet', 'ring', 'neck']) {
    if (k >= itens.length) break;
    if (slot === 'shield' && ITEM_CATALOG[e.equipment?.weapon?.id]?.twoHanded) continue;
    e.equipment[slot] ??= { id: PECA_PARA_O_SLOT[slot], count: 1 };
    const max = GemasDeSkill.maximoDeSockets(ITEM_CATALOG[e.equipment[slot].id]);
    const gemas = Array(max).fill(null);
    for (let i = 0; i < max && k < itens.length; i++) gemas[i] = { ...GemasDeSkill.novaGema(itens[k++]), nivel };
    e.equipment[slot] = { ...e.equipment[slot], soquetes: { abertos: max, links: Array(max - 1).fill(false), gemas } };
  }
  if (k < itens.length) throw new Error(`mais skills (${itens.length}) do que sockets`);
  return e;
}
