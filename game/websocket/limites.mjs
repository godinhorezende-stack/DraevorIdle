// Limites de uma conexão: tamanho de mensagem e ritmo.
//
// Sem isto, um cliente só travava o servidor de todo mundo: o `ws` aceita até
// 100 MB por mensagem (o padrão dele), e o `JSON.parse` disso roda na mesma
// thread do jogo; e nada impedia mil mensagens por segundo (ver
// docs/auditoria-performance.md, gargalo 10).

/*
 * O maior que o jogo manda de verdade é o áudio do chat: até 800 KB de base64
 * (`MAX_AUDIO_BYTES`, em game/systems/chat.mjs). 1 MB cobre ele com folga.
 */
export const TAMANHO_MAXIMO = 1024 * 1024;

/*
 * O cliente, no ritmo mais alto de uso normal: o rumo do WASD a cada 100 ms
 * (10/s), o ping a cada 1 s e os cliques. Abrir um painel manda umas poucas
 * mensagens juntas. 40 por segundo com rajada de 120 deixa isso tudo passar
 * com muita folga e corta só o que não é gente jogando.
 */
export const POR_SEGUNDO = 40;
export const RAJADA = 120;
/*
 * Quantas mensagens jogadas fora a conexão pode acumular até ser fechada. A
 * conta esvazia sozinha no mesmo ritmo do balde: passar um pouco do limite de
 * vez em quando nunca derruba ninguém; uma enxurrada chega aqui em segundos.
 * (Zerar a conta a cada mensagem aceita não serviria: numa enxurrada o balde
 * sempre reenche uma ficha de vez em quando, e a conexão nunca cairia.)
 */
export const TOLERANCIA = 200;

/** Um balde de fichas por conexão. `aceitar()` diz se esta mensagem entra. */
export class Ritmo {
  constructor(agora = performance.now()) {
    this.fichas = RAJADA;
    this.em = agora;
    this.descartadas = 0;
  }

  aceitar(agora = performance.now()) {
    const reposto = ((agora - this.em) / 1000) * POR_SEGUNDO;
    this.em = agora;
    this.fichas = Math.min(RAJADA, this.fichas + reposto);
    this.descartadas = Math.max(0, this.descartadas - reposto);
    if (this.fichas >= 1) {
      this.fichas -= 1;
      return true;
    }
    this.descartadas += 1;
    return false;
  }

  /** Passou tanto do ritmo, por tanto tempo, que não é mais gente jogando. */
  get abusou() {
    return this.descartadas > TOLERANCIA;
  }
}
