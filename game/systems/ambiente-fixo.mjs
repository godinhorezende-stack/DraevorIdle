// (04/11, velocidade da caçada offline) As chaves do ambiente lidas no caminho quente — o modo do jogo (`itens-poe/catalogo.classico`,
// por trás de todo `ligado()`) e as chaves de conferência dos voos (`hunt/voos.mjs`) — eram lidas de `process.env` a cada pergunta:
// cada leitura custa ~0,5 µs (ela vai ao ambiente do sistema) e o tique as fazia milhares de vezes. A caçada offline (até 7200 tiques
// seguidos) gastava ~5% do tempo nisso.
//
// `fixar(fn)`: durante `fn` (síncrona — um tique), cada chave é lida UMA vez e guardada; fora dela, a leitura é a de sempre. Nada no
// jogo muda o ambiente no meio de um tique (só os testes, entre uma chamada e outra) — o resultado é o mesmo, sem a conta repetida.
let fixo = null;

/** O valor da chave do ambiente agora (dentro de `fixar`, o da primeira leitura). */
export function ler(chave) {
  if (!fixo) return process.env[chave];
  if (chave in fixo) return fixo[chave];
  return (fixo[chave] = process.env[chave]);
}

/** Roda `fn` com as chaves lidas uma vez só (a de fora manda: dentro de outro `fixar`, só roda). */
export function fixar(fn) {
  if (fixo) return fn();
  fixo = Object.create(null);
  try {
    return fn();
  } finally {
    fixo = null;
  }
}
