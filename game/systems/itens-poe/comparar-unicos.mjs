// As REGRAS DE COMPARAÇÃO dos únicos do jogo com os do poedb (tools/auditar-unicos-poedb.mjs e o teste testes/unicos-poedb.test.mjs usam as
// mesmas): o texto canônico, o molde sem números e o que é ruído (a linha interna, o lembrete entre parênteses, o marcador de sorteio).
/** O texto sem os números, para casar linhas: "+(15 — 20) de Vida máxima" e "+{0} de Vida máxima" viram "+# de vida máxima". */
export const molde = (t) =>
  String(t ?? '')
    .replace(/\{\d+\}/g, '#')
    .replace(/\(\s*-?\d+(?:[.,]\d+)?\s*[—–-]\s*-?\d+(?:[.,]\d+)?\s*\)/g, '#')
    .replace(/-?\d+(?:[.,]\d+)?/g, '#')
    .replace(/\s+/g, '')
    .toLowerCase();
/** O texto inteiro, com os números, sem espaço nem diferença de traço/quebra: "Regenera (6 — 8) da Vida" = "Regenera (6—8) da Vida". */
export const canonico = (t) =>
  String(t ?? '')
    .replace(/\s+\/\s+|\n/g, ' ')
    .replace(/[—–]/g, '-')
    .replace(/\s+/g, '')
    .toLowerCase();
/** Linha que o poedb mostra mas não é do item: o stat interno sem tradução ("map item drop quantity +% [100]") e o "Histórico". */
export const interna = (t) => /^[a-z][a-z0-9 _+%,.'-]*(\[[^\]]*\])?$/.test(String(t).trim()) || String(t).trim() === 'Histórico';
/** O lembrete entre parênteses ("(Afecções são…)"): só explica a regra; faltar no jogo não muda nada. */
export const lembrete = (t) => /^\(.*\)$/.test(String(t).trim());
/** O marcador de sorteio do poedb ("[Three Power Charge mods]", "or"): não é modificador — o único sorteia de uma lista. */
export const marcador = (t) => /^\[.*\]$/.test(String(t).trim()) || String(t).trim() === 'or';
/** As poucas linhas que a página em português do poedb deixa em inglês (os atributos do Emblema do Precursor): no texto do catálogo. */
const ATRIBUTOS = { Strength: 'Força', Dexterity: 'Destreza', Intelligence: 'Inteligência' };
export function emPortugues({ texto, modelo, faixas }) {
  const m = /^\+(\{0\}|[\d.]+) to (all Attributes|(Strength|Dexterity|Intelligence)( and (Strength|Dexterity|Intelligence))?)$/.exec(modelo);
  if (!m) return { texto, modelo, faixas };
  const nome = m[2] === 'all Attributes' ? 'a todos os Atributos' : `de ${m[2].split(' and ').map((a) => ATRIBUTOS[a]).join(' e ')}`;
  const novo = `+{0} ${nome}`;
  return { texto: novo.replace('{0}', faixas[0][0] === faixas[0][1] ? String(faixas[0][0]) : `(${faixas[0][0]}—${faixas[0][1]})`), modelo: novo, faixas };
}
