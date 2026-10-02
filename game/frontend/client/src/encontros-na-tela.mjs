// Os ENCONTROS (baús, altares) NA TELA da caçada: o marcador no mapa, o "está perto?" e o que o clique faz.
// O servidor manda só o que o jogador pode ver e usar (`Instancia.encontrosVisiveis`: baú/altar, com posição,
// disponível ou em andamento) — nada de boss nem de segredo antes da hora. Aqui não há regra: perto, a distância e o
// "pode abrir" são do SERVIDOR (`interagir` valida tudo); a tela só mostra e manda o pedido.
export const ALCANCE_DE_INTERACAO = 2;

const distancia = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** O encontro na casa `(x, y)` (do andar atual), ou `null`. */
export function encontroNaCasa(lista, x, y, z = null) {
  return (lista ?? []).find((e) => e.x === x && e.y === y && (e.z == null || z == null || e.z === z)) ?? null;
}

/** O encontro mais perto do jogador, se estiver ao alcance de interação (o botão "Interagir"). */
export function encontroPerto(lista, jogador, z = null) {
  let melhor = null;
  let d = Infinity;
  for (const e of lista ?? []) {
    if (e.estado !== 'disponivel' || (e.z != null && z != null && e.z !== z)) continue;
    const dist = distancia(e, jogador);
    if (dist <= ALCANCE_DE_INTERACAO && dist < d) {
      d = dist;
      melhor = e;
    }
  }
  return melhor;
}

/** O pedaço da assinatura do retrato (o mapa só redesenha se ela muda): quais encontros, em que estado. */
export const assinaturaDosEncontros = (lista) => (lista ?? []).map((e) => `enc:${e.id}:${e.estado}`).join('|');

/** O sprite de item de cada tipo (os do próprio jogo): baú, baú ornamentado, baú do coração (amaldiçoado) e pedestal de cristal (altar). */
export const ITEM_DO_TIPO = { 'bau-comum': 2472, 'bau-raro': 26164, 'bau-amaldicoado': 33043, altar: 9063, sobrevivencia: 9064, fenda: 9065, aprisionado: 9066 };

const COR = { 'bau-comum': '#e0b84a', 'bau-raro': '#4ab3ff', 'bau-amaldicoado': '#b04aff', altar: '#ffd24c', sobrevivencia: '#ff6a4a', fenda: '#7a5cff', aprisionado: '#4fd0b0' };

/**
 * Desenha os marcadores: o SPRITE do jogo (`desenharItem`, que devolve `false` enquanto a folha não chegou) ou, até lá,
 * um baú/altar desenhado em código. Por cima do chão e abaixo das criaturas em volta.
 */
export function desenharMarcadores(ctx, lista, { camX, camY, tile, z, jogador, desenharItem = null }) {
  for (const e of lista ?? []) {
    if (e.z != null && z != null && e.z !== z) continue;
    const x = e.x * tile - camX;
    const y = e.y * tile - camY;
    const cor = COR[e.tipo] ?? '#e0b84a';
    const perto = jogador && e.estado === 'disponivel' && distancia(e, jogador) <= ALCANCE_DE_INTERACAO;
    ctx.save();
    ctx.globalAlpha = e.estado === 'ativo' ? 0.55 : 1;
    // O brilho no chão.
    ctx.fillStyle = `${cor}33`;
    ctx.beginPath();
    ctx.ellipse(x + tile / 2, y + tile * 0.78, tile * 0.48, tile * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#000';
    ctx.fillStyle = cor;
    const sprite = desenharItem && ITEM_DO_TIPO[e.tipo] ? desenharItem(ctx, ITEM_DO_TIPO[e.tipo], x, y) : false;
    if (sprite) {
      // O sprite do jogo já é o desenho.
    } else if (e.tipo === 'altar' || e.tipo === 'sobrevivencia' || e.tipo === 'fenda' || e.tipo === 'aprisionado') {
      // Um losango sobre um pedestal.
      ctx.beginPath();
      ctx.moveTo(x + tile / 2, y + tile * 0.12);
      ctx.lineTo(x + tile * 0.8, y + tile * 0.45);
      ctx.lineTo(x + tile / 2, y + tile * 0.78);
      ctx.lineTo(x + tile * 0.2, y + tile * 0.45);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
    } else {
      // Um baú: corpo, tampa e fechadura.
      ctx.beginPath();
      ctx.roundRect(x + tile * 0.16, y + tile * 0.34, tile * 0.68, tile * 0.44, 3);
      ctx.stroke();
      ctx.fill();
      ctx.fillStyle = `${cor}`;
      ctx.beginPath();
      ctx.roundRect(x + tile * 0.16, y + tile * 0.2, tile * 0.68, tile * 0.22, 4);
      ctx.stroke();
      ctx.fill();
      ctx.fillStyle = '#2a1a05';
      ctx.fillRect(x + tile * 0.45, y + tile * 0.42, tile * 0.1, tile * 0.16);
    }
    if (perto) {
      // Ao alcance: o nome por cima — é o convite para interagir.
      ctx.globalAlpha = 1;
      ctx.font = '600 11px Oswald, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#000';
      ctx.fillStyle = '#fff';
      const texto = e.nome || e.tipo;
      ctx.strokeText(texto, x + tile / 2, y - 2);
      ctx.fillText(texto, x + tile / 2, y - 2);
    }
    ctx.restore();
  }
}
