// Um personagem de verdade para os testes — o mesmo molde de
// `estadoInicialPersonagem` (sessao.mjs), sem abrir o banco.
import * as R from '../nucleo/regras.mjs';
import * as Inventario from '../sistemas/inventario.mjs';
import * as Recompensas from '../sistemas/recompensas.mjs';
import * as Loja from '../sistemas/loja.mjs';
import { CHARACTER_TEMPLATE } from '../nucleo/dados.mjs';

export function personagemDeTeste({ vocacao = 'knight', level = R.NIVEL_INICIAL } = {}) {
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
  };
}

export const PERSONAGEM = { id: 0, nome: 'Teste Automatizado' };
