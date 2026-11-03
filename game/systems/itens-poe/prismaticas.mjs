// (100% — lote "dados", 03/11) As HABILIDADES PRISMÁTICAS do PoE (o `SkillType.RandomElement` do PoB): as que escolhem um elemento — o Acerto
// Elemental, o Golpe Selvagem e o dos Extremos, o Tornado da Turbulência Elemental, o Convocar Esqueleto dos Magos, a Explosão Prismática (a do
// suporte) e a Relíquia Elemental do Guardian. Aqui:
//   - o que o Foco de Combate faz nelas ("Com um total de 40 de <A> e <B> no Raio, Habilidades Prismáticas não podem escolher <Elemento>" / "…
//     causam 50% menos Dano de <Elemento>"): os elementos PROIBIDOS (`prisma_nao_escolhe_<fire|ice|energy>`, da árvore — `passivas/arvore.raiosDasJoias`) e o
//     "menos" (`mais_dano_<el>@prismatico`, a tag `prismatico` do golpe — `condicoes-poe.TAG_DO_POE`);
//   - a escolha do elemento ("Ela evitará escolher o mesmo elemento duas vezes seguidas" — o Acerto Elemental e o Golpe Selvagem);
//   - a FORMA do Golpe Selvagem pelo elemento escolhido (o PoB, act_dex.lua WildStrike/AltX: "Fire explosion" — a área de 2,4 m em volta do
//     alvo —, "Lightning bolt" — o raio que ricocheteia — e "Icy wave" — os 3 projéteis que perfuram todos).
// Os pares de atributos do Foco de Combate: os do PoB (ModParser.lua 6471–6473): Fogo ← Inteligência e Destreza, Gelo ← Força e Inteligência,
// Raio ← Destreza e Força.

export const ELEMENTOS = Object.freeze(['fire', 'ice', 'energy']);
/** O elemento → a chave em português dos atributos ("_fogo", "_gelo", "_raio"). */
export const PT = Object.freeze({ fire: 'fogo', ice: 'gelo', energy: 'raio' });
/**
 * Os atributos do jogo por elemento (escritos por inteiro: o teste dos atributos novos procura o nome no código): o limiar do "não podem escolher" no raio, o
 * do "menos Dano" e o valor dele, e o "não escolhe" que a árvore põe na ficha.
 */
export const CHAVES = Object.freeze({
  fire: Object.freeze({ naoNoRaio: 'raio_prisma_nao_escolhe_fire', menosLimiar: 'raio_prisma_menos_fire_limiar', menos: 'raio_prisma_menos_fire', nao: 'prisma_nao_escolhe_fire' }),
  ice: Object.freeze({ naoNoRaio: 'raio_prisma_nao_escolhe_ice', menosLimiar: 'raio_prisma_menos_ice_limiar', menos: 'raio_prisma_menos_ice', nao: 'prisma_nao_escolhe_ice' }),
  energy: Object.freeze({ naoNoRaio: 'raio_prisma_nao_escolhe_energy', menosLimiar: 'raio_prisma_menos_energy_limiar', menos: 'raio_prisma_menos_energy', nao: 'prisma_nao_escolhe_energy' }),
});
/** Os atributos do Foco de Combate por elemento (o PoB). */
export const ATRIBUTOS_DO_FOCO = Object.freeze({ fire: ['int', 'dex'], ice: ['str', 'int'], energy: ['dex', 'str'] });

/** As gemas PRISMÁTICAS do jogo (a tag "Prismático" do poedb; a do PoB é `RandomElement`). */
export const GEMAS_PRISMATICAS = Object.freeze(['Elemental_Hit', 'Wild_Strike', 'Wild_Strike_of_Extremes', 'Tornado_of_Elemental_Turbulence', 'Summon_Skeletons_of_Mages', 'Blink_Arrow_of_Prismatic_Clones', 'Mirror_Arrow_of_Prismatic_Clones']);
export const ehPrismatica = (slug) => GEMAS_PRISMATICAS.includes(String(slug ?? ''));
/** O Golpe Selvagem (e o dos Extremos). */
export const ehGolpeSelvagem = (slug) => /^Wild_Strike(?:_of_Extremes)?$/.test(String(slug ?? ''));

/** Os elementos que as habilidades prismáticas NÃO podem escolher agora (`afPoe` da ficha — a árvore põe `prisma_nao_escolhe_<fire|ice|energy>`). */
export function proibidos(afOuFicha) {
  const af = afOuFicha?.afPoe ?? afOuFicha ?? {};
  return new Set(ELEMENTOS.filter((el) => Number(af[CHAVES[el].nao]) > 0));
}

/**
 * O elemento do uso: um dos três, sem os PROIBIDOS e sem repetir o ANTERIOR ("Ela evitará escolher o mesmo elemento duas vezes seguidas"). Com só
 * o anterior sobrando, ele (melhor repetir que não sair); com os três proibidos (três Focos de Combate, um de cada), a regra cai — escolha sem
 * fonte, o PoE não diz o que acontece (`docs/gemas-poe-progresso.md`, "100% — dados").
 */
export function escolherElemento(anterior = null, proib = new Set(), rng = Math.random) {
  const livres = ELEMENTOS.filter((el) => !proib.has(el));
  const base = livres.length ? livres : [...ELEMENTOS];
  const semRepetir = base.filter((el) => el !== anterior);
  const lista = semRepetir.length ? semRepetir : base;
  return lista[Math.min(lista.length - 1, Math.floor(rng() * lista.length))];
}

/** Um elemento por PESOS (`[[el, peso]]` — a Explosão Prismática pelos atributos), sem os proibidos (os três proibidos: os pesos de sempre). */
export function elementoPorPesos(pesos, proib = new Set(), rng = Math.random) {
  const livres = pesos.filter(([el]) => !proib.has(el));
  const lista = livres.length ? livres : pesos;
  const total = lista.reduce((t, [, p]) => t + Math.max(0, Number(p) || 0), 0);
  if (!(total > 0)) return lista[Math.min(lista.length - 1, Math.floor(rng() * lista.length))][0];
  let r = rng() * total;
  for (const [el, p] of lista) {
    const q = Math.max(0, Number(p) || 0);
    if (r < q) return el;
    r -= q;
  }
  return lista[lista.length - 1][0];
}

/** O elemento de uma habilidade de lacaio pelo nome do PoB (`SkeletonMinionProjectileCold` → gelo). */
export function elementoDoNome(id) {
  const s = String(id ?? '');
  return /Cold$/i.test(s) ? 'ice' : /Fire$/i.test(s) ? 'fire' : /Lightning$/i.test(s) ? 'energy' : null;
}

// ---------------------------------------------------------------- o GOLPE SELVAGEM
/** O raio da explosão de fogo do Golpe Selvagem (o PoB: `skill("radius", 24, { SkillPart = 2 })` — 2,4 m). */
export const RAIO_DA_EXPLOSAO_M = 2.4;
/** O que sai do Golpe Selvagem pelo elemento: 'explosao' (fogo), 'raio' (o raio que ricocheteia) ou 'onda' (os projéteis de gelo). */
export const PARTE_DO_ELEMENTO = Object.freeze({ fire: 'explosao', energy: 'raio', ice: 'onda' });

/**
 * O uso do Golpe Selvagem no elemento `el`: `{ entry, efeito }` com a forma do PoB.
 *  - FOGO: o golpe e a explosão em volta do alvo (`alvoNoCentro`, a forma no raio da gema — `formaNoRaioDoPoe` a põe nos 2,4 m × a Área); sem
 *    projéteis, perfuração nem ricochete;
 *  - RAIO: o golpe e o raio que salta do alvo (a CADEIA: `cadeiaPoe.saltos` = os "Raios Ricocheteiam N Vezes" + os das outras fontes); sem
 *    projéteis nem área;
 *  - GELO: a onda — os projéteis (os 3 da gema + os adicionais) que perfuram todos; sem ricochete nem área.
 * `circulo(r)`: a forma de raio `r` em casas (`Areas.circulo`), de quem chama (o motor das áreas fica em `acoes`).
 */
export function usoDoGolpeSelvagem(entry, efeito, el, circulo) {
  const parte = PARTE_DO_ELEMENTO[el] ?? 'onda';
  const e = { ...(efeito ?? {}) };
  if (parte === 'explosao') {
    e.alvosExtras = 0;
    e.projeteisBase = 1;
    e.perfurar = 0;
    e.encadear = 0;
    e.bifurcar = 0;
    delete e.cadeiaPoe;
    return { parte, entry: { ...entry, projetil: null, cadeia: null, forma: circulo(1), alvoNoCentro: true }, efeito: e };
  }
  if (parte === 'raio') {
    const saltos = Math.max(0, Math.floor((e.encadear ?? 0)));
    e.alvosExtras = 0;
    e.projeteisBase = 1;
    e.perfurar = 0;
    e.bifurcar = 0;
    e.encadear = 0;
    e.cadeiaPoe = { saltos, pct: 0 };
    return { parte, entry: { ...entry, projetil: null, forma: null, cadeia: { ...(entry.cadeia ?? {}) } }, efeito: e };
  }
  // a onda de gelo: os projéteis da gema (que perfuram) — o ricochete é só do raio
  e.encadear = 0;
  delete e.cadeiaPoe;
  return { parte, entry: { ...entry, cadeia: null, forma: null }, efeito: e };
}
