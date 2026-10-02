// O REGISTRO de cada golpe (depuração, dono 02/10): o que a conta fez num golpe — dano antes da resistência, tipo, resistência do alvo,
// penetração, resistência efetiva, crítico, dano final, vida que sobrou. Desligado em produção (nível 0: nem monta o registro).
//
// `nivel`: 0 desligado, 1 resumo, 2 detalhe. Liga por `COMBATE_LOG=1|2` no ambiente, por `gamedata/combate/formulas.json` ou em tempo de
// execução (`definirNivel`, para o simulador e os testes). Guarda só os últimos `capacidade` golpes, em memória do processo.
import { PARAMETROS } from './formulas.mjs';

let nivel = Number(process.env.COMBATE_LOG ?? PARAMETROS.registro.nivel) || 0;
const golpes = [];

export const nivelDoRegistro = () => nivel;
export function definirNivel(n) {
  nivel = Math.max(0, Math.min(2, Number(n) || 0));
}

/**
 * Registra um golpe. `montar` só roda com o registro ligado (produção paga um `if`): devolve o objeto do golpe — no nível 1 só o resumo
 * (`resumo`), no 2 tudo (`detalhe` junto).
 */
export function registrarGolpe(montar) {
  if (nivel <= 0) return;
  const r = montar();
  if (!r) return;
  const { detalhe, ...resumo } = r;
  golpes.push({ em: Date.now(), ...resumo, ...(nivel >= 2 && detalhe ? { detalhe } : {}) });
  if (golpes.length > PARAMETROS.registro.capacidade) golpes.shift();
}

/** Os últimos `n` golpes registrados (do mais antigo para o mais novo). */
export const ultimosGolpes = (n = 20) => golpes.slice(-n);
export const limparRegistro = () => { golpes.length = 0; };
