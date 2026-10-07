// A TRADUÇÃO dos mods do PoE para os atributos do Draevor (Fase 1, incremento 2 — desligado em produção).
//
// Puro: recebe o texto do mod já com o modelo e os valores (o que o gerador produz) e a tabela `gamedata/itens-poe/traducao.json`, e
// devolve os efeitos nas chaves que a ficha do jogo já soma (`Afixos.somaDeItens`: `life`, `fire_res`, `phys_add`…) ou nos ATRIBUTOS
// NOVOS do PoE (`gamedata/itens-poe/atributos-novos.json`). Nada é aplicado aqui: quem equipa é o incremento 3c. Decisão do dono (04/10):
// "todas do PoE, sem excluir nada" — todo texto vira atributo. Cada mod sai com um ESTADO:
//   'equivalente' / 'aproximado' — atributo que o Draevor já calcula (tem efeito no combate);
//   'novo'       — atributo novo do PoE que JÁ tem efeito no combate (`combate: true` em atributos-novos.json; incremento 3b);
//   'registrado' — atributo novo ainda sem efeito, ou texto sem regra (atributo automático `poe.<texto>`);
//   'inerte'     — mecânica do PoE que não tem como existir no jogo (pesca, Fendas, Óleos…): o balão explica (a `nota` da regra).
// Atributo CONDICIONAL (`dmg_inc@corpo`, `atk_speed@comEscudo` — `mods-poe.mjs`): vale o estado do atributo-base, se as condições existem.
import { readFileSync } from 'node:fs';
import { FICHAS } from '../afixos.mjs';
import { partir, CONDICOES_DE_ESTADO, TAGS_DE_GOLPE, CONDICOES_DE_ANEL } from './condicoes-poe.mjs';

export const TABELA = JSON.parse(readFileSync(new URL('../../gamedata/itens-poe/traducao.json', import.meta.url), 'utf8'));
export const NOVOS = JSON.parse(readFileSync(new URL('../../gamedata/itens-poe/atributos-novos.json', import.meta.url), 'utf8')).atributos;

/** O id automático de um texto sem regra: `poe.` + o texto sem acento, com `n` no lugar dos números. */
export const idAutomatico = (parte) =>
  `poe.${String(parte).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\{\d+\}/g, 'n').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)}`;

/** As regras prontas para casar: `{E}` vira o grupo dos nomes de elemento do PoE. */
export function compilar(tabela = TABELA) {
  const nomes = Object.keys(tabela.elementos ?? {}).filter((k) => !k.startsWith('_'));
  const grupoE = `(${nomes.join('|')})`;
  const base = (tabela.regras ?? []).map((r, i) => ({ ...r, i, re: new RegExp(r.padrao.replace('{E}', grupoE).replace(/^\^\\\+/, '^([+-])?')) }));
  // As versões "REDUZIDA" das regras "aumentada" (o PoE escreve "Velocidade de Ataque reduzida em 10%" com o mesmo número positivo): o
  // mesmo atributo com o valor negativo. Só quando nenhuma regra própria já casa o texto.
  const reduzidas = base
    .filter((r) => /aumentad[oa]s?/.test(r.padrao) && r.estado !== 'inerte')
    .map((r) => ({ ...r, reduzida: true, re: new RegExp(r.padrao.replace('{E}', grupoE).replace(/aumentad([oa]s?)/g, 'reduzid$1')) }));
  return [...base, ...reduzidas];
}
/** O texto de LEMBRETE do PoE (entre parênteses: explica a mecânica, não é um mod) — vira nota, sem efeito nem marca. */
const LEMBRETE = /^\(|\)$|^\(.*\)$/;
const PADRAO = compilar();

/**
 * O valor de um efeito. `{n}` = o n-ésimo NÚMERO-ÍNDICE capturado (os grupos `\{(\d+)\}` do padrão — o elemento e os opcionais não
 * contam), que aponta para `valores`. `media({1},{2})` = a média dos dois (a faixa "Adiciona 5 a 9" vira 7).
 */
function valorDo(expr, indices, valores) {
  const v = (n) => Number(valores[indices[Number(n) - 1]]);
  const media = /^media\(\{(\d+)\},\{(\d+)\}\)$/.exec(expr);
  if (media) return (v(media[1]) + v(media[2])) / 2;
  const um = /^(-?)\{(\d+)\}$/.exec(expr);
  return um ? (um[1] ? -1 : 1) * v(um[2]) : Number(expr);
}

/** Traduz UMA parte do modelo (sem " / "). */
export function traduzirParte(parte, valores, { regras = PADRAO, tabela = TABELA } = {}) {
  if (LEMBRETE.test(String(parte).trim())) return { estado: 'lembrete', efeitos: [], nota: null, regra: null };
  for (const r of regras) {
    const m = r.re.exec(parte);
    if (!m) continue;
    const capturas = m.slice(1).filter((x) => x != null);
    const indices = capturas.filter((x) => /^\d+$/.test(x));
    const elemento = capturas.find((x) => tabela.elementos?.[x] && !/^\d+$/.test(x));
    const stat = (s) => s.replace('{E}', tabela.elementos?.[elemento] ?? '?');
    // "reduzida" (a regra derivada) e o "-" na frente do número ("-10% de Resistência a Fogo"): o valor sai negativo.
    const sinal = (r.reduzida ? -1 : 1) * (m[0].startsWith('-') ? -1 : 1);
    const efeitos = r.efeitos.map((e) => { const v = valorDo(e.valor, indices, valores); return { stat: stat(e.stat), valor: typeof v === 'number' ? v * sinal : v }; });
    if (r.estado === 'inerte') return { estado: 'inerte', efeitos: [], nota: r.nota ?? null, regra: r.i };
    // Atributo que o Draevor não tem (ex.: Resistência a Caos → chaos_res): 'novo' se ele já tem efeito no combate, senão 'registrado'.
    // Sem efeito em algum atributo: 'registrado'. Só atributos do Draevor sem condição: o estado da regra. O resto: o da regra, se ela
    // diz ('equivalente'/'aproximado'), ou 'novo'.
    const soDoDraevor = efeitos.every((e) => FICHAS[e.stat]);
    const estado = !efeitos.every(temEfeito) ? 'registrado' : soDoDraevor ? r.estado ?? 'equivalente' : r._nova && r.estado && r.estado !== 'novo' ? r.estado : 'novo';
    return { estado, efeitos, nota: r.nota ?? null, regra: r.i };
  }
  // Sem regra: o atributo automático do próprio texto (nada fica de fora). O valor é o número da parte (ou a lista, se forem vários).
  const nums = [...parte.matchAll(/\{(\d+)\}/g)].map((m) => Number(valores[Number(m[1])]));
  return { estado: 'registrado', efeitos: [{ stat: idAutomatico(parte), valor: nums.length === 1 ? nums[0] : nums.length ? nums : 1 }], nota: null, regra: null };
}

/** O atributo tem efeito no combate? (o do Draevor, ou o novo com `combate: true`; condicional: o atributo-base e condições conhecidas.) */
function temEfeito(e) {
  const { stat, conds } = partir(e.stat);
  if (!(FICHAS[stat] || NOVOS[stat]?.combate)) return false;
  return conds.every((c) => CONDICOES_DE_ESTADO.has(c) || TAGS_DE_GOLPE.has(c) || CONDICOES_DE_ANEL[c]);
}

const PIOR = ['lembrete', 'equivalente', 'aproximado', 'novo', 'inerte', 'registrado'];
/** Traduz um mod inteiro (`{ modelo, valores }`): híbridos "A / B" viram as partes; o estado do mod é o PIOR das partes. */
export function traduzirMod(mod, opcoes) {
  const partes = String(mod?.modelo ?? '').split(' / ');
  const lista = partes.map((p) => ({ parte: p, ...traduzirParte(p, mod?.valores ?? [], opcoes) }));
  const estado = lista.reduce((pior, x) => (PIOR.indexOf(x.estado) > PIOR.indexOf(pior) ? x.estado : pior), 'lembrete');
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
    for (const e of t.efeitos) {
      // Número soma; lista (atributo automático com vários números) soma posição a posição.
      if (Array.isArray(e.valor)) af[e.stat] = e.valor.map((v, k) => Math.round(((af[e.stat]?.[k] ?? 0) + v) * 100) / 100);
      else af[e.stat] = Math.round(((af[e.stat] ?? 0) + e.valor) * 100) / 100;
    }
    return { texto: m.texto, ...t };
  });
  return { af, linhas };
}

/**
 * A COBERTURA da tabela sobre o catálogo importado: o peso de drop dos tiers de cada estado (o quanto do que realmente cai já funciona),
 * e os modelos ainda sem regra, do mais pesado ao mais leve.
 */
export function cobertura(catalogo, opcoes) {
  const peso = { lembrete: 0, equivalente: 0, aproximado: 0, novo: 0, inerte: 0, registrado: 0 };
  const semRegra = new Map();
  const automaticos = new Set();
  for (const c of Object.values(catalogo?.classes ?? {})) {
    for (const pool of Object.values(c.paginas)) {
      for (const g of [...pool.prefixos, ...pool.sufixos]) {
        for (const t of g.tiers) {
          const r = traduzirMod({ modelo: t.modelo, valores: t.faixas.map((f) => f[0]) }, opcoes);
          peso[r.estado] += t.peso ?? 0;
          for (const e of r.efeitos) if (e.stat.startsWith('poe.')) automaticos.add(e.stat);
          if (r.estado === 'registrado') semRegra.set(t.modelo, (semRegra.get(t.modelo) ?? 0) + (t.peso ?? 0));
        }
      }
    }
  }
  const total = Object.values(peso).reduce((a, b) => a + b, 0) || 1;
  return {
    pct: Object.fromEntries(Object.entries(peso).map(([k, v]) => [k, Number(((v / total) * 100).toFixed(1))])),
    semRegra: [...semRegra.entries()].sort((a, b) => b[1] - a[1]).map(([modelo, p]) => ({ modelo, pct: Number(((p / total) * 100).toFixed(2)) })),
    atributosAutomaticos: automaticos.size,
    atributosNovos: Object.keys(NOVOS).length,
    comEfeitoNoCombate: Number((((peso.equivalente + peso.aproximado + peso.novo) / total) * 100).toFixed(1)),
  };
}
