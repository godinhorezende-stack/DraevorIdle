// O MODO BETA do servidor: acesso livre para TESTAR o conteúdo — hunts VIP/Instance/Divine sem premium, pergaminho nem level, e bosses
// sem level, task, "já derrotado" nem recarga (tentativas ilimitadas). Decisão do dono (03/10): vale para todos, no servidor oficial,
// enquanto o jogo está em beta. Não mexe em nada gravado: é só uma checagem a mais nos pontos de entrada (`premium.mjs`, `Cacadas.entrar`,
// `Bosses`), então desligar devolve as regras normais na hora — nenhum personagem foi alterado.
//
// O que NÃO muda (segurança contra travamento): a duração da sala de boss, a instância/limpeza, a regra do portal do boss de ato e os limites
// de combate. Só "quem pode entrar" e "quantas vezes".
//
// Liga/desliga: padrão do arquivo `gamedata/modo-beta.json` (`ativo`); a variável de ambiente `MODO_BETA=0|1` manda sobre ele; o admin
// (rota trancada `/api/mapas/_conteudo/modo-beta`) muda em tempo de execução, sem deploy (volta ao padrão no próximo boot).
import { readFileSync } from 'node:fs';

const arquivo = (() => {
  try {
    return JSON.parse(readFileSync(new URL('../gamedata/modo-beta.json', import.meta.url), 'utf8'));
  } catch {
    return {};
  }
})();
const doAmbiente = process.env.MODO_BETA;
// Sob `node --test` (NODE_TEST_CONTEXT) o padrão é DESLIGADO, para os testes das regras normais não dependerem do estado do servidor.
const padrao = process.env.NODE_TEST_CONTEXT ? false : arquivo.ativo === true;
let ligado = doAmbiente === '1' ? true : doAmbiente === '0' ? false : padrao;

export const ativo = () => ligado;
export const definir = (valor) => {
  ligado = !!valor;
  return ligado;
};
