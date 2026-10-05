// Mensagem global para todos os jogadores online (um `JSON.stringify` só, como o chat Global e o anúncio de drop).
// O cliente mostra `{t:'avisoGlobal'}` no Global e na faixa do alto da tela (`anuncio-drop.mjs`). Quem usa: a limpeza do
// chão (`limpeza-do-chao.mjs`) e o Server Save (`server-save.mjs`).
let sessoes = new Map(); // nome -> Sessao (injetado em `ligar`)

export const ligar = (mapa) => void (sessoes = mapa);

/** Devolve para quantos jogadores foi (só quem está com personagem em jogo; offline não recebe nada). */
export function avisoGlobal(texto, nivel = 'sistema') {
  const pronto = JSON.stringify({ t: 'avisoGlobal', nivel, texto, em: Date.now() });
  let n = 0;
  for (const s of sessoes.values()) {
    if (!s?.personagem) continue;
    s.enviarPronto(pronto);
    n++;
  }
  return n;
}

/** Uma mensagem de protocolo (objeto com `t`) para TODOS os clientes conectados com sessão (um `JSON.stringify` só). Devolve para quantos foi. Usado pelo Hot Reload (`hot-reload.mjs`). */
export function transmitir(mensagem) {
  const pronto = JSON.stringify(mensagem);
  let n = 0;
  for (const s of sessoes.values()) {
    if (!s?.ws) continue;
    s.enviarPronto(pronto);
    n++;
  }
  return n;
}
