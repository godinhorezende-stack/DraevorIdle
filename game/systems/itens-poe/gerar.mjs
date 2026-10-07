// O GERADOR de peças no modelo do PoE (Fase 1 — desligado em produção; ver docs/engine/04-piloto-prefixo-sufixo.md).
//
// Puro: recebe o catálogo importado (tools/importar-poe-itens.mjs), as regras (gamedata/itens-poe/regras.json) e o `rng`; não lê
// disco nem guarda estado. A conta segue a documentação da coleção (poe-itens/Raridades e modificadores-tiers, PoEDB):
//   1. a raridade dá QUANTOS mods (pesos de `regras.raridades.<r>.quantidade`) e o máximo por lado (prefixos / sufixos);
//   2. a cada vaga, sorteia UM tier entre TODOS os elegíveis do pool da base — tier com iLvl ≤ o Item Level da peça, de uma família
//      ainda não usada, de um lado que ainda tem vaga — pelo PESO do tier (o "pct" que o PoEDB mostra é este peso sobre o total);
//   3. cada faixa do texto do tier vira um número sorteado (inteiro, ou com as casas decimais da faixa);
//   4. o implícito e os atributos da base (ex.: armadura 19–27) também são sorteados nas faixas deles.
// O Único não sorteia mods: são os fixos do cadastro dele, com os valores sorteados nas faixas.

/** Sorteio pelo peso numa lista de `[item, peso]`. */
function porPeso(lista, rng) {
  const total = lista.reduce((n, [, p]) => n + p, 0);
  if (!(total > 0)) return null;
  let r = rng() * total;
  for (const [item, p] of lista) if ((r -= p) < 0) return item;
  return lista[lista.length - 1][0];
}

const casas = (n) => (String(n).split('.')[1] ?? '').length;
/** Um número dentro da faixa `[a, b]`, com as casas decimais que a faixa usa. */
export function sortearNaFaixa([a, b], rng) {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const c = Math.max(casas(a), casas(b));
  if (!c) return lo + Math.floor(rng() * (hi - lo + 1));
  const f = 10 ** c;
  return Math.round((lo + rng() * (hi - lo)) * f) / f;
}
/** O texto final: o modelo ("+{0} de Vida") com os valores. */
export const escrever = (modelo, valores) => String(modelo ?? '').replace(/\{(\d+)\}/g, (_, i) => String(valores[Number(i)] ?? '?'));
// O modelo vai junto com os valores: é por ele que a tradução para os atributos do Draevor casa as regras (traduzir.mjs).
const rolarTexto = (t, rng) => {
  const valores = (t.faixas ?? []).map((f) => sortearNaFaixa(f, rng));
  return { modelo: t.modelo, valores, texto: escrever(t.modelo, valores) };
};

/** A base pelo id (`Classe/Slug`) e a classe dona dela. */
export function acharBase(catalogo, id) {
  const [classe] = String(id).split('/');
  const c = catalogo?.classes?.[classe];
  const base = c?.bases.find((b) => b.id === id) ?? null;
  return base ? { classe: c, base } : null;
}

/** O pool `normal` da base (`{ prefixos, sufixos }`), ou null quando a coleção não tem pool para ela. */
export const poolDa = (classe, base) => (base?.pool ? classe?.paginas?.[base.pool] ?? null : null);

/**
 * As REGRAS DA BASE que os implícitos dão (PoE: anéis Engrenado/Geodésico/Composto, amuletos Simples/Focal, anéis de um dano só, varinhas
 * sem Conjuração): `{ prefixos, sufixos }` (o a mais/a menos nas vagas da raridade), `magnitude: { todos, prefixo, sufixo }` (% a mais nos
 * valores), `soDano` (a tag do único dano que pode sair) e `semConjuracao`. `implicitos`: os da peça (com os valores sorteados).
 */
const DANO_PERMITIDO = { frio: 'Gelo', fogo: 'Fogo', 'elétrico': 'Raio', 'físico': 'Físico', caos: 'Caos' };
export function regrasDaBase(implicitos = []) {
  const r = { prefixos: 0, sufixos: 0, magnitude: { todos: 0, prefixo: 0, sufixo: 0 }, soDano: null, semConjuracao: false, implicitosFixos: false };
  for (const im of implicitos ?? []) {
    for (const parte of String(im.modelo ?? '').split(' / ')) {
      const v = Number([...parte.matchAll(/\{(\d+)\}/g)].map((m) => im.valores?.[Number(m[1])])[0]) || 0;
      // O sinal: o do texto ("+1", "-2") ou, sem sinal no texto, o do próprio valor ("{1} Modificadores…" com −3).
      const n = /^-/.test(parte) ? -Math.abs(v) : /^\+/.test(parte) ? Math.abs(v) : v;
      if (/Modificador(?:es)? Prefixo permitidos?$/.test(parte)) r.prefixos += n;
      else if (/Modificador(?:es)? Sufixo permitidos?$/.test(parte)) r.sufixos += n;
      else if (/^Magnitudes dos Modificadores Explícitos aumentada/.test(parte)) r.magnitude.todos += v;
      else if (/^Magnitudes do Modificador Prefixo aumentad/.test(parte)) r.magnitude.prefixo += v;
      else if (/^Magnitudes do Modificador Sufixo aumentad/.test(parte)) r.magnitude.sufixo += v;
      else if (/^Não pode rolar Modificadores de Conjuração$/.test(parte)) r.semConjuracao = true;
      else if (/^Modificadores Implícitos Não Podem ser Mudados$/.test(parte)) r.implicitosFixos = true;
      else {
        const m = parte.match(/^Não gera modificadores de dano que não sejam (?:de )?(frio|fogo|elétrico|físico|caos)$/);
        if (m) r.soDano = DANO_PERMITIDO[m[1]];
      }
    }
  }
  return r;
}
/** O tier pode sair nesta base? (o "só dano de um tipo" e o "sem Conjuração"). */
const permitidoNaBase = (c, regras) => {
  const tags = c.tags ?? [];
  if (regras.semConjuracao && tags.includes('Conjurador')) return false;
  if (regras.soDano && tags.includes('Dano') && !tags.includes(regras.soDano)) return false;
  return true;
};
/** Os valores de um mod com a MAGNITUDE da base (% a mais), com as casas decimais da faixa. */
function comMagnitude(mod, pct) {
  if (!pct) return mod;
  const valores = mod.valores.map((v) => { const x = Number(v) * (1 + pct / 100); return Number.isInteger(Number(v)) ? Math.round(x) : Math.round(x * 100) / 100; });
  return { ...mod, valores, texto: escrever(mod.modelo, valores) };
}

/** Os tiers que PODEM sair numa peça de Item Level `ilvl`, por lado (cada item: `{ familia, lado, tier }`). */
export function elegiveis(pool, ilvl) {
  const saida = { prefixo: [], sufixo: [] };
  for (const lado of ['prefixos', 'sufixos']) {
    for (const g of pool?.[lado] ?? []) {
      for (const t of g.tiers) if ((t.ilvl ?? 1) <= ilvl && (t.peso ?? 0) > 0) saida[g.lado].push({ familia: g.familia, lado: g.lado, tags: g.tags, tier: t });
    }
  }
  return saida;
}

/**
 * Os atributos da base: a DEFESA da base (armadura, evasão, escudo de energia, `{min,max}`) é sorteada por peça, como no PoE; o DANO
 * de arma (`dano_*`, `{min,max}`) é uma faixa e fica faixa (cada golpe sorteia dentro dela); número fica número.
 */
function rolarAtributos(atributos, rng) {
  return Object.fromEntries(Object.entries(atributos ?? {}).map(([k, v]) => [k, v && typeof v === 'object' && 'min' in v && !k.startsWith('dano') ? sortearNaFaixa([v.min, v.max], rng) : v]));
}

/**
 * Gera UMA peça. `ctx`: `{ catalogo, regras, base: 'Classe/Slug', raridade: 'normal'|'magico'|'raro'|'unico', ilvl, rng, unico? }`.
 * Devolve `{ base, classe, raridade, ilvl, nome, atributos, implicitos, prefixos, sufixos, unico? }` (cada mod:
 * `{ familia, tier, nome, ilvl, texto, valores }`) ou `{ erro }`.
 */
export function gerarPeca({ catalogo, regras, base: idDaBase, raridade, ilvl, rng = Math.random, unico = null }) {
  const achado = acharBase(catalogo, idDaBase);
  if (!achado) return { erro: `base desconhecida: ${idDaBase}` };
  const { classe, base } = achado;
  const R = regras?.raridades?.[raridade];
  if (!R) return { erro: `raridade desconhecida: ${raridade}` };
  const nivel = Math.max(1, Math.round(Number(ilvl) || 1));
  const peca = {
    base: base.id, classe: classe.id, raridade, ilvl: nivel, nome: base.nome,
    atributos: rolarAtributos(base.atributos, rng),
    implicitos: (base.implicitos ?? []).map((t) => rolarTexto(t, rng)),
    prefixos: [], sufixos: [],
  };
  if (R.fixos) {
    const lista = classe.unicos.filter((u) => u.base === base.nome);
    const u = unico ? lista.find((x) => x.slug === unico) : lista[Math.floor(rng() * lista.length)];
    if (!u) return { erro: `nenhum único com a base ${base.nome}` };
    return { ...peca, nome: u.nome, unico: u.slug, modificadores: u.modificadores.map((m) => ({ tipo: m.tipo, ...rolarTexto(m, rng) })) };
  }
  const quantos = Number(porPeso(Object.entries(R.quantidade ?? { 0: 1 }).map(([n, p]) => [n, p]), rng)) || 0;
  if (!quantos) return peca;
  const pool = poolDa(classe, base);
  if (!pool) return { ...peca, aviso: 'a coleção não tem pool de mods para esta base: saiu sem mods' };
  const todos = elegiveis(pool, nivel);
  // As regras da BASE (os implícitos): vagas a mais/a menos, magnitude dos valores, só um tipo de dano, sem Conjuração.
  const rb = regrasDaBase(peca.implicitos);
  const max = { prefixo: Math.max(0, (R.maxPrefixos ?? 0) + rb.prefixos), sufixo: Math.max(0, (R.maxSufixos ?? 0) + rb.sufixos) };
  const usadas = new Set();
  for (let i = 0; i < quantos; i++) {
    const vagas = ['prefixo', 'sufixo'].filter((l) => peca[`${l}s`].length < max[l]);
    const candidatos = vagas.flatMap((l) => todos[l]).filter((c) => !usadas.has(c.familia) && permitidoNaBase(c, rb));
    const escolhido = porPeso(candidatos.map((c) => [c, c.tier.peso]), rng);
    if (!escolhido) break; // o pool acabou (Item Level baixo demais, ou poucas famílias): a peça sai com menos mods
    usadas.add(escolhido.familia);
    const rolado = comMagnitude(rolarTexto(escolhido.tier, rng), rb.magnitude.todos + rb.magnitude[escolhido.lado]);
    peca[`${escolhido.lado}s`].push({ familia: escolhido.familia, tier: escolhido.tier.tier, nome: escolhido.tier.nome, ilvl: escolhido.tier.ilvl, modelo: rolado.modelo, texto: rolado.texto, valores: rolado.valores });
  }
  // O nome do Mágico leva o prefixo e o sufixo ("Primordial Colete de Placas da Baleia"); o do Raro é aleatório no PoE — a coleção
  // não traz as listas de palavras, então fica o nome da base (marcado).
  if (raridade === 'magico') peca.nome = [peca.prefixos[0]?.nome, base.nome, peca.sufixos[0]?.nome].filter(Boolean).join(' ');
  if (raridade === 'raro') peca.nomeAleatorio = null;
  return peca;
}

// ---------------------------------------------------------------- para as MOEDAS (itens-poe/moedas.mjs)
export { porPeso, rolarTexto };

/**
 * UM mod novo para a peça `poe` (`{ base, classe, raridade, ilvl, prefixos, sufixos }`): de uma família ainda não usada, de um lado com
 * vaga na raridade (`lados` restringe). Devolve `{ lado, mod }` (o mod no formato da peça) ou null (sem vaga / pool esgotado).
 */
export function sortearUmMod({ catalogo, regras, poe, rng = Math.random, lados = ['prefixo', 'sufixo'] }) {
  const achado = acharBase(catalogo, poe.base);
  if (!achado) return null;
  const pool = poolDa(achado.classe, achado.base);
  if (!pool) return null;
  const R = regras?.raridades?.[poe.raridade] ?? {};
  const rb = regrasDaBase(poe.implicitos);
  const max = { prefixo: Math.max(0, (R.maxPrefixos ?? 0) + rb.prefixos), sufixo: Math.max(0, (R.maxSufixos ?? 0) + rb.sufixos) };
  const usadas = new Set([...(poe.prefixos ?? []), ...(poe.sufixos ?? [])].map((m) => m.familia));
  const todos = elegiveis(pool, Math.max(1, Number(poe.ilvl) || 1));
  const vagas = lados.filter((l) => (poe[`${l}s`] ?? []).length < max[l]);
  const candidatos = vagas.flatMap((l) => todos[l]).filter((c) => !usadas.has(c.familia) && permitidoNaBase(c, rb));
  const escolhido = porPeso(candidatos.map((c) => [c, c.tier.peso]), rng);
  if (!escolhido) return null;
  const { modelo, valores, texto } = comMagnitude(rolarTexto(escolhido.tier, rng), rb.magnitude.todos + rb.magnitude[escolhido.lado]);
  return { lado: escolhido.lado, mod: { familia: escolhido.familia, tier: escolhido.tier.tier, nome: escolhido.tier.nome, ilvl: escolhido.tier.ilvl, modelo, texto, valores } };
}

/** O tier do pool de onde o mod saiu (as faixas dele) — `{ tier, tiers }` (todos os tiers da família, do pool da base) — ou null. */
export function tierDoMod(catalogo, poe, mod) {
  const achado = acharBase(catalogo, poe.base);
  const pool = achado && poolDa(achado.classe, achado.base);
  for (const lado of ['prefixos', 'sufixos']) {
    for (const g of pool?.[lado] ?? []) {
      if (g.familia !== mod.familia) continue;
      const tier = g.tiers.find((t) => t.tier === mod.tier) ?? null;
      if (tier) return { tier, tiers: g.tiers };
    }
  }
  return null;
}
