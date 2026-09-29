// Um personagem de verdade para os testes — o mesmo molde de
// `estadoInicialPersonagem` (sessao.mjs), sem abrir o banco.
import * as R from '../systems/regras.mjs';
import * as Inventario from '../systems/inventario.mjs';
import * as Recompensas from '../systems/recompensas.mjs';
import * as Loja from '../systems/loja.mjs';
import { CHARACTER_TEMPLATE } from '../systems/dados.mjs';
import * as Campanha from '../systems/campanha.mjs';

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
  return {
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
  };
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
