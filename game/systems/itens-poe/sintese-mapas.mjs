// OS MODIFICADORES DE SÍNTESE dos MAPAS (08/11 — dono: "sim" a zerar as linhas sem efeito dos mapas únicos): o Córtex e as Memórias Distantes.
//
//   "Mapa possui N Modificadores aleatórios adicionais" ("map adds X extra synthesis mods" — a aba "Synthesis Area" do poedb): os mods de mapa da
//     Síntese são os mesmos dos mapas comuns (a Quantidade/Raridade/Grupo de recompensa e a mecânica): saem do pool de mods de mapa do tier da peça
//     (`aleatorios`), além das vagas;
//   "Mapa tem N Modificadores Synthesis Globais adicionais" ("map adds X extra synthesis special mods" — a aba "Synthesis Global", 48 linhas): os de
//     `GLOBAIS`, que valem nos monstros do mapa (na Síntese do PoE todo monstro da Memória é Sintetizado), pela raridade de cada um.
//
// Os Globais que pedem um item que o jogo não tem (a Essência, o fragmento Vaal, o item Velado) ficam fora do sorteio — como no pool de Síntese
// dos implícitos (`sintese.mjs`), sai só o que tem efeito no jogo. O peso do poedb é 1000 em todos: sorteio igual, sem repetir.
import * as Catalogo from './catalogo.mjs';
import * as Gerar from './gerar.mjs';

/**
 * Os 48 do poedb ("Synthesis Global"): `chave`, o texto em português, a raridade do monstro em que vale (`raro`, `magico` ou `normal` — o
 * "Synthesised Monsters" sem raridade é o Normal do trio), o atributo e o valor. `semItem`: o item do PoE que o jogo não tem (fora do sorteio).
 */
export const GLOBAIS = Object.freeze([
  ['moedas-raro', 'Monstros Sintetizados Raros derrubam 2 Itens Monetários adicionais', 'raro', 'moedasExtras', 2],
  ['moedas-magico', 'Monstros Sintetizados Mágicos têm 25% de chance de derrubar um Item Monetário', 'magico', 'moedaPct', 25],
  ['moedas-normal', 'Monstros Sintetizados têm 5% de chance de derrubar um Item Monetário', 'normal', 'moedaPct', 5],
  ['qualidade-raro', 'Monstros Sintetizados Raros derrubam 1 Item Monetário de Qualidade adicional', 'raro', 'qualidadeExtras', 1],
  ['qualidade-magico', 'Monstros Sintetizados Mágicos têm 6% de chance de derrubar um Item Monetário de Qualidade', 'magico', 'qualidadePct', 6],
  ['qualidade-normal', 'Monstros Sintetizados têm 1% de chance de derrubar um Item Monetário de Qualidade', 'normal', 'qualidadePct', 1],
  ['corrompidos-raro', 'Itens derrubados por Monstros Sintetizados Raros têm 50% de chance de serem Corrompidos', 'raro', 'corrompidosPct', 50],
  ['corrompidos-magico', 'Itens derrubados por Monstros Sintetizados Mágicos têm 15% de chance de serem Corrompidos', 'magico', 'corrompidosPct', 15],
  ['corrompidos-normal', 'Itens derrubados por Monstros Sintetizados têm 5% de chance de serem Corrompidos', 'normal', 'corrompidosPct', 5],
  ['mapa-raro', 'Monstros Sintetizados Raros têm 150% de chance aumentada de derrubar um Mapa', 'raro', 'mapaPct', 150],
  ['mapa-magico', 'Monstros Sintetizados Mágicos têm 100% de chance aumentada de derrubar um Mapa', 'magico', 'mapaPct', 100],
  ['mapa-normal', 'Monstros Sintetizados têm 50% de chance aumentada de derrubar um Mapa', 'normal', 'mapaPct', 50],
  ['carta-raro', 'Monstros Sintetizados Raros têm 50% de chance de derrubar uma Carta de Adivinhação', 'raro', 'cartaPct', 50],
  ['carta-magico', 'Monstros Sintetizados Mágicos têm 7% de chance de derrubar uma Carta de Adivinhação', 'magico', 'cartaPct', 7],
  ['unico-raro', 'Monstros Sintetizados Raros têm 150% de chance aumentada de derrubar um Item Único', 'raro', 'unicoPct', 150],
  ['unico-magico', 'Monstros Sintetizados Mágicos têm 100% de chance aumentada de derrubar um Item Único', 'magico', 'unicoPct', 100],
  ['unico-normal', 'Monstros Sintetizados têm 50% de chance aumentada de derrubar um Item Único', 'normal', 'unicoPct', 50],
  ['quantidade-raro', '50% de Quantidade aumentada de Itens Derrubados por Monstros Sintetizados Raros', 'raro', 'quantidadePct', 50],
  ['quantidade-magico', '50% de Quantidade aumentada de Itens Derrubados por Monstros Sintetizados Mágicos', 'magico', 'quantidadePct', 50],
  ['quantidade-normal', '25% de Quantidade aumentada de Itens Derrubados por Monstros Sintetizados', 'normal', 'quantidadePct', 25],
  ['raridade-raro', '50% de Raridade aumentada de Itens Derrubados por Monstros Sintetizados Raros', 'raro', 'raridadePct', 50],
  ['raridade-magico', '50% de Raridade aumentada de Itens Derrubados por Monstros Sintetizados Mágicos', 'magico', 'raridadePct', 50],
  ['raridade-normal', '25% de Raridade aumentada de Itens Derrubados por Monstros Sintetizados', 'normal', 'raridadePct', 25],
  ['experiencia-raro', 'Monstros Sintetizados Raros concedem 500% de Experiência aumentada', 'raro', 'experienciaPct', 500],
  ['experiencia-magico', 'Monstros Sintetizados Mágicos concedem 200% de Experiência aumentada', 'magico', 'experienciaPct', 200],
  ['experiencia-normal', 'Monstros Sintetizados concedem 100% de Experiência aumentada', 'normal', 'experienciaPct', 100],
  ['shaper-raro', 'Monstros Sintetizados Raros têm 10% de chance de derrubar um Item do Criador', 'raro', 'shaperPct', 10],
  ['shaper-magico', 'Monstros Sintetizados Mágicos têm 2% de chance de derrubar um Item do Criador', 'magico', 'shaperPct', 2],
  ['elder-raro', 'Monstros Sintetizados Raros têm 10% de chance de derrubar um Item do Ancião', 'raro', 'elderPct', 10],
  ['elder-magico', 'Monstros Sintetizados Mágicos têm 2% de chance de derrubar um Item do Ancião', 'magico', 'elderPct', 2],
  ['joia-raro', 'Monstros Sintetizados Raros têm 20% de chance de derrubar uma Joia', 'raro', 'joiaPct', 20],
  ['mapa-extra-raro', 'Monstros Sintetizados Raros têm 20% de chance de derrubar um Mapa', 'raro', 'mapaExtraPct', 20],
  ['essencia-raro', 'Monstros Sintetizados Raros têm 20% de chance de derrubar uma Essência', 'raro', 'essenciaPct', 20, 'a Essência'],
  ['aliado-raro', 'Monstros Sintetizados Raros ressuscitam como Aliados quando mortos', 'raro', 'aliado', 1],
  ['modificadores-raro', 'Quando um Jogador mata um Monstro Sintetizado Raro, ganha os Modificadores dele por 20 segundos', 'raro', 'modificadoresS', 20],
  ['fragmento-raro', 'Monstros Sintetizados Raros têm 20% de chance de derrubar um Fragmento Vaal', 'raro', 'fragmentoPct', 20, 'o fragmento Vaal'],
  ['velado-raro', 'Monstros Sintetizados Raros têm 30% de chance de derrubar um Item Velado', 'raro', 'veladoPct', 30, 'o item Velado'],
  ['duplicar-3', 'Duplica até 3 Monstros Sintetizados Raros', 'geral', 'duplicarRaros', 3],
  ['duplicar-6', 'Duplica até 6 Monstros Sintetizados Raros', 'geral', 'duplicarRaros', 6],
  ['duplicar-10', 'Duplica até 10 Monstros Sintetizados Raros', 'geral', 'duplicarRaros', 10],
  ['grupos-magicos', '20% de chance de Grupos Sintetizados serem melhorados para Mágicos', 'geral', 'gruposMagicosPct', 20],
  ['grupos-raros', '20% de chance de Grupos Sintetizados serem melhorados para Raros', 'geral', 'gruposRarosPct', 20],
  ['raro-extra', '50% de chance de Grupos Sintetizados Raros terem um Monstro Raro adicional', 'geral', 'raroExtraPct', 50],
  ['grupo-15', '15% de Tamanho aumentado dos Grupos de Monstros Sintetizados', 'geral', 'grupoPct', 15],
  ['grupo-30', '30% de Tamanho aumentado dos Grupos de Monstros Sintetizados', 'geral', 'grupoPct', 30],
  ['baus-normal', 'Área contém 5 Baús Sintetizados adicionais que contêm Monstros Normais', 'geral', 'bausNormais', 5],
  ['baus-magico', 'Área contém 4 Baús Sintetizados adicionais que contêm Monstros Mágicos', 'geral', 'bausMagicos', 4],
  ['baus-raro', 'Área contém 3 Baús Sintetizados adicionais que contêm Monstros Raros', 'geral', 'bausRaros', 3],
].map(([chave, texto, raridade, stat, valor, semItem]) => ({ chave, texto, raridade, stat, valor, ...(semItem ? { semItem } : {}) })));
const POR_CHAVE = new Map(GLOBAIS.map((g) => [g.chave, g]));
/** As cartas existem no jogo? (`cartas.mjs` registra) — sem elas, as linhas das Cartas ficam fora do sorteio. */
let CARTAS = () => false;
export function definirCartas(fn) { CARTAS = fn; }
/** Os Globais que podem sair (os que têm efeito no jogo). */
export const sorteaveis = () => GLOBAIS.filter((g) => !g.semItem && (g.stat !== 'cartaPct' || CARTAS()));

/** `n` Globais sorteados, sem repetir (a linha da peça: `{ chave, texto }`). */
export function sortearGlobais(n, rng = Math.random) {
  const pool = [...sorteaveis()];
  const saida = [];
  while (saida.length < n && pool.length) {
    const g = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    saida.push({ tipo: 'explicit', chave: g.chave, texto: g.texto, modelo: g.texto, valores: [], sintese: 'global' });
  }
  return saida;
}

/** Os Globais da peça somados: `{ raro: {…}, magico: {…}, normal: {…}, geral: {…} }` (o maior em `duplicarRaros`; o resto soma). */
export function efeitosDosGlobais(linhas = []) {
  const ef = {};
  for (const l of linhas ?? []) {
    const g = POR_CHAVE.get(l?.chave);
    if (!g) continue;
    const no = (ef[g.raridade] ??= {});
    no[g.stat] = g.stat === 'duplicarRaros' ? Math.max(no[g.stat] ?? 0, g.valor) : (no[g.stat] ?? 0) + g.valor;
  }
  return ef;
}
/** O Global da linha (`chave`) — o balão e a validação. */
export const globalDa = (chave) => POR_CHAVE.get(chave) ?? null;
/** A raridade do monstro para os Globais (`raro` também o Elite; `magico` o modificado; o resto Normal — o chefe não é Sintetizado). */
export const raridadeDoMonstro = (m) => (m?.raridade === 'raro' || m?.raridade === 'elite' ? 'raro' : m?.raridade === 'modificado' || m?.raridade === 'magico' ? 'magico' : m?.chefeDoMapa || m?.raridade === 'unico' ? null : 'normal');
/** O que vale no monstro `m` (os da raridade dele) — ou null. */
export function doMonstro(efeitos, m) {
  const r = raridadeDoMonstro(m);
  return r && efeitos?.[r] ? efeitos[r] : null;
}

/**
 * Os mods de mapa A MAIS da peça (os "Modificadores aleatórios adicionais"): `n` do pool de mods de mapa do tier dela, de famílias que ela ainda
 * não tem, além das vagas da raridade. Muta `poe` (prefixos/sufixos) e devolve quantos entraram.
 */
export function porAleatorios(poe, n, rng = Math.random) {
  const cat = Catalogo.catalogo();
  const achado = cat && Gerar.acharBase(cat, poe?.base);
  const pagina = achado && Gerar.poolDa(achado.classe, achado.base);
  let postos = 0;
  for (let i = 0; i < n && pagina; i++) {
    const novo = Gerar.sortearDoPool({ pagina, poe, regras: Catalogo.REGRAS, origem: 'sintese', rng, ignorarVagas: true });
    if (!novo) break;
    (poe[`${novo.lado}s`] ??= []).push({ ...novo.mod, sintese: 'area' });
    postos++;
  }
  return postos;
}

/** As moedas de Qualidade do PoE (a Pedra de Amolar, a Sucata, a Bugiganga, o Prisma e o Cinzel). */
export const MOEDAS_DE_QUALIDADE = Object.freeze(['Blacksmiths_Whetstone', 'Armourers_Scrap', 'Glassblowers_Bauble', 'Gemcutters_Prism', 'Cartographers_Chisel']);
/**
 * As MOEDAS a mais do monstro Sintetizado (`efeitos`: os Globais da raridade dele — `doMonstro`): os Itens Monetários ("derrubam N adicionais", "X% de
 * chance de derrubar um") pelo sorteio das moedas do jogo (`moedas.moedasAvulsas`) e os de Qualidade (`MOEDAS_DE_QUALIDADE`, um ao acaso). `Moedas`: o
 * módulo das moedas (quem chama passa — o ciclo de imports).
 */
export function moedasDoMonstro(efeitos, rng = Math.random, Moedas) {
  const ef = efeitos ?? {};
  const n = (Number(ef.moedasExtras) || 0) + (rng() * 100 < (Number(ef.moedaPct) || 0) ? 1 : 0);
  const saida = n > 0 && Moedas ? [...Moedas.moedasAvulsas(n, rng)] : [];
  const q = (Number(ef.qualidadeExtras) || 0) + (rng() * 100 < (Number(ef.qualidadePct) || 0) ? 1 : 0);
  for (let i = 0; i < q && Moedas; i++) {
    const id = Moedas.idDa(MOEDAS_DE_QUALIDADE[Math.floor(rng() * MOEDAS_DE_QUALIDADE.length)]);
    if (id) saida.push({ id, count: 1 });
  }
  return saida;
}

