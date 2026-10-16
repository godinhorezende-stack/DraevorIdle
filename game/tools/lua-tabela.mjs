// Lê uma TABELA LITERAL do Lua (`{ ["chave"] = valor, [1] = valor, … }`) como dado — sem executar nada: só chaves, textos, números e
// booleanos. Para os arquivos de dados do Path of Building (`Data/TimelessJewelData/LegionPassives.lua`). A tabela com só índices [1..n] vira
// lista; o resto, objeto.
export function lerTabelaLua(texto, inicio = texto.indexOf('{')) {
  let i = inicio;
  const fora = () => {
    for (;;) {
      while (i < texto.length && /\s|,|;/.test(texto[i])) i++;
      if (texto.startsWith('--', i)) { const fim = texto.indexOf('\n', i); i = fim < 0 ? texto.length : fim + 1; continue; }
      return;
    }
  };
  const textoLua = () => {
    const aspas = texto[i++];
    let s = '';
    while (i < texto.length && texto[i] !== aspas) {
      if (texto[i] === '\\') { const c = texto[i + 1]; s += c === 'n' ? '\n' : c === 't' ? '\t' : c; i += 2; } else s += texto[i++];
    }
    i++;
    return s;
  };
  const valor = () => {
    fora();
    const c = texto[i];
    if (c === '{') return tabela();
    if (c === '"' || c === "'") return textoLua();
    const m = /^(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|nil)/.exec(texto.slice(i, i + 40));
    if (!m) throw new Error(`valor Lua inesperado em ${i}: ${texto.slice(i, i + 30)}`);
    i += m[0].length;
    return m[0] === 'true' ? true : m[0] === 'false' ? false : m[0] === 'nil' ? null : Number(m[0]);
  };
  const tabela = () => {
    i++;
    const pares = [];
    let n = 0;
    for (;;) {
      fora();
      if (texto[i] === '}') { i++; break; }
      let chave;
      if (texto[i] === '[') {
        i++;
        fora();
        chave = valor();
        fora();
        if (texto[i] !== ']') throw new Error(`] esperado em ${i}`);
        i++;
        fora();
        if (texto[i] !== '=') throw new Error(`= esperado em ${i}`);
        i++;
      } else {
        const m = /^([A-Za-z_]\w*)\s*=(?!=)/.exec(texto.slice(i, i + 80));
        if (m) { chave = m[1]; i += m[0].length; } else chave = ++n;
      }
      pares.push([chave, valor()]);
    }
    const lista = pares.length && pares.every(([k], j) => k === j + 1);
    return lista ? pares.map(([, v]) => v) : Object.fromEntries(pares);
  };
  return valor();
}
