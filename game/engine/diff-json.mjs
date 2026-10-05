// Diferença estruturada entre dois valores JSON (original × atual) para o painel de alterações e o changelog. Puro.
// Cada achado: `{ caminho, tipo: 'novo' | 'removido' | 'alterado', antes, depois }`, com caminho em ponto (`monstros.troll.hp`, `loot[2].chance`).
const curto = (v) => { const t = JSON.stringify(v); return t === undefined ? 'indefinido' : t.length > 90 ? `${t.slice(0, 87)}…` : t; };
const simples = (v) => v === null || typeof v !== 'object';

export function diffJson(a, b, { max = 300 } = {}) {
  const saida = [];
  let cortou = false;
  const achar = (caminho, x, y) => {
    if (saida.length >= max) { cortou = true; return; }
    if (x === undefined && y !== undefined) return void saida.push({ caminho, tipo: 'novo', antes: undefined, depois: y });
    if (y === undefined && x !== undefined) return void saida.push({ caminho, tipo: 'removido', antes: x, depois: undefined });
    if (simples(x) || simples(y) || Array.isArray(x) !== Array.isArray(y)) { if (JSON.stringify(x) !== JSON.stringify(y)) saida.push({ caminho, tipo: 'alterado', antes: x, depois: y }); return; }
    if (Array.isArray(x)) {
      // Listas de tamanhos diferentes viram UMA mudança (o jogo as trata como lista inteira); do mesmo tamanho, item a item.
      if (x.length !== y.length) { if (JSON.stringify(x) !== JSON.stringify(y)) saida.push({ caminho, tipo: 'alterado', antes: x, depois: y }); return; }
      x.forEach((_, i) => achar(`${caminho}[${i}]`, x[i], y[i]));
      return;
    }
    for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) achar(caminho ? `${caminho}.${k}` : k, x[k], y[k]);
  };
  achar('', a, b);
  return { mudancas: saida, cortou };
}

/** Uma linha legível de uma mudança. */
export const descreverMudanca = (m) => (m.tipo === 'novo' ? `${m.caminho}: novo ${curto(m.depois)}` : m.tipo === 'removido' ? `${m.caminho}: removido (era ${curto(m.antes)})` : `${m.caminho}: ${curto(m.antes)} → ${curto(m.depois)}`);

/** O resumo curto de um diff para o changelog: as `limite` primeiras mudanças, mais "e mais N". */
export function resumirDiff(d, limite = 6) {
  const linhas = d.mudancas.slice(0, limite).map(descreverMudanca);
  const resto = d.mudancas.length - linhas.length;
  return resto > 0 || d.cortou ? [...linhas, `… e mais ${resto}${d.cortou ? '+' : ''} mudança(s)`] : linhas;
}
