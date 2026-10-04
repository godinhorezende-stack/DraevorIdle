// A TRADUÇÃO dos mods do PoE para os atributos do Draevor (Fase 1, incremento 2 — desligado em produção).
//
// Puro: recebe o texto do mod já com o modelo e os valores (o que o gerador produz) e a tabela `gamedata/itens-poe/traducao.json`, e
// devolve os efeitos nas chaves que a ficha do jogo já soma (`Afixos.somaDeItens`: `life`, `fire_res`, `phys_add`…). Nada é aplicado
// aqui: quem decide equipar é o incremento seguinte. Cada mod sai com um ESTADO — 'equivalente', 'aproximado', 'sem-equivalente'
// (regra que diz "o Draevor não tem") ou 'sem-regra' (ninguém escreveu a regra ainda) — para a engine mostrar a cobertura.
import { readFileSync } from 'node:fs';

export const TABELA = JSON.parse(readFileSync(new URL('../../gamedata/itens-poe/traducao.json', import.meta.url), 'utf8'));

/** As regras prontas para casar: `{E}` vira o grupo dos nomes de elemento do PoE. */
export function compilar(tabela = TABELA) {
  const nomes = Object.keys(tabela.elementos ?? {}).filter((k) => !k.startsWith('_'));
  const grupoE = `(${nomes.join('|')})`;
  return (tabela.regras ?? []).map((r, i) => ({ ...r, i, re: new RegExp(r.padrao.replace('{E}', grupoE)) }));
}
const PADRAO = compilar();

/**
 * O valor de um efeito. `{n}` = o n-ésimo NÚMERO-ÍNDICE capturado (os grupos `\{(\d+)\}` do padrão — o elemento e os opcionais não
 * contam), que aponta para `valores`. `media({1},{2})` = a média dos dois (a faixa "Adiciona 5 a 9" vira 7).
 */
function valorDo(expr, indices, valores) {
  const v = (n) => Number(valores[indices[Number(n) - 1]]);
  const media = /^media\(\{(\d+)\},\{(\d+)\}\)$/.exec(expr);
  if (media) return (v(media[1]) + v(media[2])) / 2;
  const um = /^\{(\d+)\}$/.exec(expr);
  return um ? v(um[1]) : Number(expr);
}

/** Traduz UMA parte do modelo (sem " / "). */
export function traduzirParte(parte, valores, { regras = PADRAO, tabela = TABELA } = {}) {
  for (const r of regras) {
    const m = r.re.exec(parte);
    if (!m) continue;
    const capturas = m.slice(1).filter((x) => x != null);
    const indices = capturas.filter((x) => /^\d+$/.test(x));
    const elemento = capturas.find((x) => tabela.elementos?.[x] && !/^\d+$/.test(x));
    const stat = (s) => s.replace('{E}', tabela.elementos?.[elemento] ?? '?');
    const efeitos = r.efeitos.map((e) => ({ stat: stat(e.stat), valor: valorDo(e.valor, indices, valores) }));
    return { estado: r.estado, efeitos, nota: r.nota ?? null, regra: r.i };
  }
  return { estado: 'sem-regra', efeitos: [], nota: null, regra: null };
}

const PIOR = ['equivalente', 'aproximado', 'sem-equivalente', 'sem-regra'];
/** Traduz um mod inteiro (`{ modelo, valores }`): híbridos "A / B" viram as partes; o estado do mod é o PIOR das partes. */
export function traduzirMod(mod, opcoes) {
  const partes = String(mod?.modelo ?? '').split(' / ');
  const lista = partes.map((p) => ({ parte: p, ...traduzirParte(p, mod?.valores ?? [], opcoes) }));
  const estado = lista.reduce((pior, x) => (PIOR.indexOf(x.estado) > PIOR.indexOf(pior) ? x.estado : pior), 'equivalente');
  return { estado, partes: lista, efeitos: lista.flatMap((x) => x.efeitos) };
}

/**
 * Os efeitos de uma PEÇA gerada (implícitos + prefixos + sufixos + mods do único), somados por atributo do Draevor (`af`, o formato
 * que a ficha soma), e a lista de cada mod com o estado.
 */
export function traduzirPeca(peca, opcoes) {
  const mods = [...(peca.implicitos ?? []), ...(peca.prefixos ?? []), ...(peca.sufixos ?? []), ...(peca.modificadores ?? [])];
  const af = {};
  const linhas = mods.map((m) => {
    const t = traduzirMod(m, opcoes);
    for (const e of t.efeitos) af[e.stat] = Math.round(((af[e.stat] ?? 0) + e.valor) * 100) / 100;
    return { texto: m.texto, ...t };
  });
  return { af, linhas };
}

/**
 * A COBERTURA da tabela sobre o catálogo importado: o peso de drop dos tiers de cada estado (o quanto do que realmente cai já funciona),
 * e os modelos ainda sem regra, do mais pesado ao mais leve.
 */
export function cobertura(catalogo, opcoes) {
  const peso = { equivalente: 0, aproximado: 0, 'sem-equivalente': 0, 'sem-regra': 0 };
  const semRegra = new Map();
  for (const c of Object.values(catalogo?.classes ?? {})) {
    for (const pool of Object.values(c.paginas)) {
      for (const g of [...pool.prefixos, ...pool.sufixos]) {
        for (const t of g.tiers) {
          const r = traduzirMod({ modelo: t.modelo, valores: t.faixas.map((f) => f[0]) }, opcoes);
          peso[r.estado] += t.peso ?? 0;
          if (r.estado === 'sem-regra') semRegra.set(t.modelo, (semRegra.get(t.modelo) ?? 0) + (t.peso ?? 0));
        }
      }
    }
  }
  const total = Object.values(peso).reduce((a, b) => a + b, 0) || 1;
  return {
    pct: Object.fromEntries(Object.entries(peso).map(([k, v]) => [k, Number(((v / total) * 100).toFixed(1))])),
    semRegra: [...semRegra.entries()].sort((a, b) => b[1] - a[1]).map(([modelo, p]) => ({ modelo, pct: Number(((p / total) * 100).toFixed(2)) })),
  };
}
