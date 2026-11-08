// Os MAPAS do endgame do PoE (T1–T16, dono 10/10 — só no jogo oficial, o PoE). O mapa é uma PEÇA DO PoE (classe Mapas no catálogo, uma
// base por tier, `gamedata/itens-poe/mapas.json`): raridade, prefixos/sufixos, moedas, bolsa, depósito, filtro e banco são os de toda peça,
// sem um segundo sistema de itens. Aqui: os tiers e o nível da área, o RESUMO do mapa (os efeitos somados dos mods, a quantidade e a raridade
// de itens e o tamanho do grupo) e a configuração (drop, dispositivo, instância) — tudo de UM arquivo, `mapas.json`.
//   - A classe e os mods vêm do poedb (tools/montar-mapas-poe.mjs); só sorteia a família que tem `efeitos` (age de verdade no jogo).
//   - Os ids dos mapas são FIXOS (`itemId` da base, 7.700.000 + tier): nunca mudam com o catálogo nem empurram os ids de outras peças.
import { readFileSync, existsSync } from 'node:fs';
import { salaDe } from '../hunt/sala.mjs';
import * as SinteseMapas from './sintese-mapas.mjs';

const ARQUIVO = new URL('../../gamedata/itens-poe/mapas.json', import.meta.url);
export const DADOS = existsSync(ARQUIVO) ? JSON.parse(readFileSync(ARQUIVO, 'utf8')) : { tiers: [], classe: null };
export const CLASSE = 'Maps';
/** Os tiers configurados: `[{ tier, nivel }]` (T1 = 68 … T16 = 83 de fábrica — `mapas.json → tiers`). */
export const TIERS = DADOS.tiers ?? [];
export const TIER_MAXIMO = TIERS.reduce((m, t) => Math.max(m, t.tier), 0);
const POR_TIER = new Map(TIERS.map((t) => [t.tier, t]));
const BASES = new Map((DADOS.classe?.bases ?? []).map((b) => [b.id, b]));

/** O nível da área do tier (ou null, fora de T1…T16). */
export const nivelDoTier = (tier) => POR_TIER.get(Number(tier))?.nivel ?? null;
/** A base do tier no catálogo (`Maps/Map_Tier_N`). */
export const baseDoTier = (tier) => (POR_TIER.has(Number(tier)) ? `Maps/Map_Tier_${Number(tier)}` : null);
/** O id fixo do item do tier. */
export const idDoTier = (tier) => BASES.get(baseDoTier(tier))?.itemId ?? null;
/** O tier de uma base (`Maps/Map_Tier_N`), ou null. */
export const tierDaBase = (base) => BASES.get(base)?.atributos?.tier ?? null;
/** A peça é um mapa? */
export const ehMapa = (peca) => peca?.poe?.classe === CLASSE;
/*
 * ---- Os MAPAS ÚNICOS (dono, 10/10 — `classe.unicos`, `tools/importar-mapas-unicos.mjs`) ----
 * Em TODOS os tiers (dono: "até T16 — a área não vai ser só de nível 68"): o catálogo põe cada único em cada base de mapa
 * (`catalogo.mjs`; `tiers` restringe), e o Único sorteado num drop de mapa sai no tier daquele drop — a área e os monstros são os desse
 * tier, com os modificadores do único por cima (os mesmos em qualquer tier). Cada linha leva os efeitos que já agem no jogo (`efeitos`);
 * a que ainda não tem mecânica fica sem efeito, com a nota (`nota`).
 */
const UNICOS = new Map((DADOS.classe?.unicos ?? []).map((u) => [u.slug, u]));
/** O mapa único pelo slug (ou null). */
export const unicoDoMapa = (slug) => UNICOS.get(slug) ?? null;
/** Os mapas únicos do jogo. */
export const unicos = () => [...UNICOS.values()];
/**
 * O id do mapa único no tier (`itemIdBase` + tier — o ícone é por id, e cada tier tem o seu: o desenho do único com o número romano), ou
 * null (sem o único, sem o tier ou sem id cadastrado).
 */
export const idDoUnico = (slug, tier) => {
  const u = unicoDoMapa(slug);
  return u?.itemIdBase && nivelDoTier(tier) ? u.itemIdBase + Number(tier) : null;
};
/** O ícone do único no tier: o desenho com o número romano (`tools/importar-mapas-unicos.mjs` → `<desenho>_T<N>.png`). */
export const iconeDoUnico = (u, tier) => (u?.icone ? u.icone.replace(/\.png$/, `_T${tier}.png`) : null);
/** O tier de uma peça de mapa (a base dela: o único também — ele sai na base do tier em que caiu). */
export const tierDaPeca = (peca) => tierDaBase(peca?.poe?.base);
/** As bases do catálogo (para registrar no `ITEM_CATALOG`). */
export const bases = () => [...BASES.values()];

/**
 * O grupo do mod na página do tier do mapa: `{ efeitos, recompensa }`, ou null (família sem efeito — não deveria sair). Uma família pode ter
 * VÁRIOS grupos (as maldições: um por maldição; a recuperação: o "reduzida" e o "não podem Regenerar"): vale o do mesmo `modelo` de texto.
 */
function grupoDoMod(base, m) {
  const pagina = DADOS.classe?.paginas?.[BASES.get(base)?.pool];
  const daFamilia = [...(pagina?.prefixos ?? []), ...(pagina?.sufixos ?? [])].filter((g) => g.familia === m?.familia);
  return daFamilia.find((g) => (g.tiers ?? []).some((t) => t.modelo === m.modelo)) ?? (daFamilia.length === 1 ? daFamilia[0] : null);
}
/**
 * Soma um efeito no lugar dele (`resist.chaos`, `danoExtraPct.fire`…); `maldicao` vira a lista das maldições; `chefes` fica o maior. O
 * "mais" do PoE (`mais: true` — "40% mais Vida de Monstros") MULTIPLICA com o que já está lá: dois dão (1 + a) × (1 + b) − 1.
 */
export function somar(efeitos, e, valores) {
  const valor = e.fixo ?? (Number(valores?.[e.de]) || 0) * (e.escala ?? 1);
  const alvo = (efeitos[e.alvo] ??= {});
  if (e.stat === 'maldicao') {
    if (!(efeitos.maldicoes ??= []).includes(valor)) efeitos.maldicoes.push(valor);
    return;
  }
  const caminho = e.stat.split('.');
  let no = alvo;
  for (const k of caminho.slice(0, -1)) no = no[k] ??= {};
  const ultima = caminho.at(-1);
  if (e.stat === 'chefes' || e.stat === 'imuneAtordoamento') no[ultima] = Math.max(no[ultima] ?? 0, valor);
  else if (e.mais) no[ultima] = Math.round(((1 + (no[ultima] ?? 0) / 100) * (1 + valor / 100) - 1) * 10000) / 100;
  else no[ultima] = Math.round(((no[ultima] ?? 0) + valor) * 100) / 100;
}

/** O teto do nível da área (o PoE: 86 — o Réplica: Córtex é 84). */
export const NIVEL_MAXIMO_DA_AREA = 86;
/**
 * O RESUMO do mapa (vai na peça, `poe.mapa`, e o balão mostra): o tier e o nível da área, a quantidade e a raridade de itens e o tamanho
 * do grupo (a soma dos mods + a qualidade, que no PoE dá quantidade de itens), os efeitos somados por alvo e o estado de cada linha
 * (`equivalente` — age inteira; `parcial` — parte dela ainda não existe no jogo, com a nota).
 */
export function resumo({ poe }) {
  const tier = tierDaPeca({ poe });
  let quantidade = Number(poe?.qualidade) || 0;
  let raridade = 0;
  let grupo = 0;
  const efeitos = { monstros: {}, chefe: {}, instancia: {}, jogador: {}, maldicoes: [] };
  const linhas = [];
  for (const m of [...(poe?.prefixos ?? []), ...(poe?.sufixos ?? [])]) {
    const g = grupoDoMod(poe.base, m);
    if (!g) {
      linhas.push({ texto: m.texto, estado: 'inerte' });
      continue;
    }
    quantidade += g.recompensa?.quantidade ?? 0;
    raridade += g.recompensa?.raridade ?? 0;
    grupo += g.recompensa?.grupo ?? 0;
    for (const e of g.efeitos ?? []) somar(efeitos, e, m.valores);
    const parciais = (g.efeitos ?? []).filter((e) => e.parcial).map((e) => e.parcial);
    linhas.push({ texto: m.texto, estado: parciais.length ? 'parcial' : 'equivalente', ...(parciais.length ? { nota: parciais.join('; ') } : {}) });
  }
  // As linhas do MAPA ÚNICO (`poe.modificadores`, sorteadas na faixa de cada uma): os efeitos da linha no único (pelo modelo do texto). A
  // Quantidade/Raridade de Itens e o Tamanho do Grupo (`alvo: 'mapa'`) somam no resumo, com o valor sorteado.
  const doUnico = unicoDoMapa(poe?.unico);
  let nivelFixo = null;
  let nivelDelta = 0;
  for (const m of poe?.modificadores ?? []) {
    // (08/11) o Modificador Synthesis Global da peça (o Córtex, as Memórias — `sintese-mapas.mjs`): vale nos monstros, pela raridade
    if (m.sintese === 'global') {
      linhas.push({ texto: m.texto, estado: SinteseMapas.globalDa(m.chave) ? 'equivalente' : 'inerte', ...(SinteseMapas.globalDa(m.chave) ? {} : { nota: 'o modificador de Síntese não existe no jogo' }) });
      continue;
    }
    const def = doUnico?.modificadores?.find((x) => x.modelo === m.modelo) ?? null;
    if (!def?.efeitos?.length) {
      linhas.push({ texto: m.texto, estado: 'inerte', nota: def?.nota ?? 'ainda não tem a mecânica no jogo' });
      continue;
    }
    for (const e of def.efeitos) {
      if (e.alvo === 'mapa') {
        const v = e.fixo ?? (Number(m.valores?.[e.de]) || 0);
        if (e.stat === 'quantidade') quantidade += v;
        else if (e.stat === 'raridade') raridade += v;
        else if (e.stat === 'grupo') grupo += v;
        // (08/11) o NÍVEL DA ÁREA: "Nível dos Monstros: 83" (o Córtex, as Memórias — `nivel`) e "+2 ao Nível dos Monstros da Área" (as Terras Sagradas — `nivelDelta`)
        else if (e.stat === 'nivel') nivelFixo = v;
        else if (e.stat === 'nivelDelta') nivelDelta += v;
        continue;
      }
      // (08/11) o que a peça ganha ao NASCER ("Mapa possui N Modificadores aleatórios adicionais", os Synthesis Globais — `alvo: 'peca'`, `jogo.pecaDoJogo`)
      if (e.alvo === 'peca') continue;
      somar(efeitos, e, m.valores);
    }
    linhas.push({ texto: m.texto, estado: def.parcial ? 'parcial' : 'equivalente', ...(def.parcial ? { nota: def.parcial } : {}) });
  }
  // (08/11) os Synthesis Globais somados (`sintese-mapas.efeitosDosGlobais`: pela raridade do monstro)
  const globais = (poe?.modificadores ?? []).filter((m) => m.sintese === 'global');
  if (globais.length) efeitos.sintese = SinteseMapas.efeitosDosGlobais(globais);
  // O nível da área mudado pelo mapa único: os monstros sobem/descem pela diferença (`efeitos.monstros.nivelDelta` — `mapas-areas.aplicarEfeitos`).
  const doTier = nivelDoTier(tier);
  const nivel = doTier && (nivelFixo != null || nivelDelta) ? Math.max(1, Math.min(NIVEL_MAXIMO_DA_AREA, Math.round(nivelFixo ?? doTier + nivelDelta))) : doTier;
  if (doTier && nivel !== doTier) efeitos.monstros.nivelDelta = nivel - doTier;
  return { tier, nivel, quantidade, raridade, grupo, efeitos, linhas };
}

/** Os estados das linhas na ordem da peça (implícitos, prefixos, sufixos, as do único) — o mesmo formato de `poe.estados` das outras peças. */
export const estadosDasLinhas = (poe, r = resumo({ poe })) => [...(poe?.implicitos ?? []).map(() => 'equivalente'), ...r.linhas.map((l) => l.estado)];
/** As notas das linhas na mesma ordem (o balão mostra a da linha sem efeito ao passar o mouse) — o formato de `poe.notas`. */
export const notasDasLinhas = (poe, r = resumo({ poe })) => [...(poe?.implicitos ?? []).map(() => null), ...r.linhas.map((l) => (l.estado === 'inerte' ? l.nota ?? null : null))];

// ---------------------------------------------------------------- os DROPS (mapas.json → `drop`)

/** A configuração do drop (a de fábrica, se o arquivo não tiver). */
export const DROP = DADOS.drop ?? { chanceBase: 0, tierAcima: {}, chefe: { garantidos: 0, chanceDeMaisUm: 0 }, kitava: null };
/** O tier do mapa que cai numa área do tier `tierDaArea`, pelo tipo do monstro: o da área, ou um acima (nunca passa do máximo). */
export function tierDoDrop(tierDaArea, tipo = 'normal', rng = Math.random) {
  const t = Math.max(1, Math.min(TIER_MAXIMO, Number(tierDaArea) || 1));
  if (t >= TIER_MAXIMO) return TIER_MAXIMO;
  return rng() < (Number(DROP.tierAcima?.[tipo]) || 0) ? t + 1 : t;
}
/**
 * Os mapas que um monstro morto num mapa do tier `tierDaArea` solta: `[{ tier }]` (a peça sai de `Jogo.mapaSorteado`). `tipo`: o do loot
 * (`hunt/escalonamento.tipoDoBicho`); `bonusDeQuantidade`: o da raridade do monstro (regras.json → drop.bonusDeQuantidade); `quantidadePct`: a
 * Quantidade de Itens do mapa; `chefeDoMapa`: o chefe garante os dele. Fora de um mapa (sem tier), nada.
 */
export function sortearDrops({ tierDaArea, tipo = 'normal', bonusDeQuantidade = 0, quantidadePct = 0, chefeDoMapa = false, mapasExtras = 0, rng = Math.random }) {
  if (!(Number(tierDaArea) >= 1)) return [];
  const saida = [];
  if (chefeDoMapa) {
    // (+ os do mapa único — "Chefes Únicos derrubam N Mapas adicionais": `efeitos.chefe.mapasExtras`.)
    const garantidos = (Number(DROP.chefe?.garantidos) || 0) + Math.max(0, Math.round(Number(mapasExtras) || 0));
    for (let i = 0; i < garantidos; i++) saida.push({ tier: tierDoDrop(tierDaArea, 'boss', rng) });
    if (rng() < (Number(DROP.chefe?.chanceDeMaisUm) || 0)) saida.push({ tier: tierDoDrop(tierDaArea, 'boss', rng) });
    return saida;
  }
  const chance = (Number(DROP.chanceBase) || 0) * (1 + (Number(bonusDeQuantidade) || 0)) * (1 + Math.max(0, Number(quantidadePct) || 0) / 100);
  // Abaixo de 1: a chance de um mapa; de 1 para cima, a parte inteira garantida e o resto rola mais um (o mesmo jeito do loot).
  const certos = Math.floor(chance);
  for (let i = 0; i < certos + (rng() < chance - certos ? 1 : 0); i++) saida.push({ tier: tierDoDrop(tierDaArea, tipo, rng) });
  return saida;
}
/**
 * O mapa garantido do chefe do ato que libera o endgame (Kitava, Ato 10): `{ tier, raridade }` — a primeira vitória dá o T1 mágico (como o
 * Kirac no PoE) e as outras um T1 normal (ninguém fica sem acesso ao endgame) — ou null (outro ato, ou sem a regra).
 */
export function mapaDoChefeDoAto(ato, { primeiraVitoria = false } = {}) {
  const k = DROP.kitava;
  if (!k || Number(ato) !== Number(k.ato) || !nivelDoTier(k.tier)) return null;
  return { tier: Number(k.tier), raridade: primeiraVitoria ? k.primeiraVitoria ?? 'magico' : k.outrasVitorias ?? 'normal' };
}

// ---------------------------------------------------------------- o mapa em VOCÊ (mapas.json → os efeitos `jogador.*` e `maldicao`)

/** O mapa em que `estado` está caçando (o que a caçada do dono da sala guarda — `hunt.mapa`), ou null. */
export const mapaDaCacada = (estado) => salaDe(estado?.hunt)?.mapa ?? null;
/**
 * Os atributos que o mapa põe em VOCÊ enquanto está nele (`efeitos.jogador`: o máximo de resistência menor, a recuperação reduzida, menos
 * precisão…) — somados na sua ficha (`Afixos.soma`). As MALDIÇÕES do mapa vão com as dos monstros (`condicoes-poe.addsDasMaldicoesNoJogador`).
 */
export function addsNoJogador(estado) {
  const ef = mapaDaCacada(estado)?.efeitos?.jogador;
  if (!ef) return null;
  const saida = {};
  for (const [k, v] of Object.entries(ef)) if (Number.isFinite(v) && v) saida[k] = v;
  return Object.keys(saida).length ? saida : null;
}
/** As maldições do mapa em você (ids de `condicoes-poe.MALDICOES_DOS_MONSTROS`). */
export const maldicoesNoJogador = (estado) => mapaDaCacada(estado)?.efeitos?.maldicoes ?? [];

// ---------------------------------------------------------------- a INSTÂNCIA (o que a peça muda na área — `Cacadas.entrar` com `mapa`)

/**
 * O que o mapa muda na composição da área: `fatorDoGrupo` (o Tamanho do Grupo: cada spawn gera × o fator), `chancesDaRaridade` (os fatores
 * das chances de Mágico e Raro do sorteio — "X% mais Monstros Mágicos/Raros"), `chefes` (1, ou 2 com "A área contém dois Chefes Únicos") e
 * `baus` (os Grandes Baús e a Raridade de Itens dos baús).
 */
export function fatoresDaInstancia(r) {
  const inst = r?.efeitos?.instancia ?? {};
  return {
    fatorDoGrupo: Math.max(0, 1 + (Number(r?.grupo) || 0) / 100),
    chancesDaRaridade: { modificado: Math.max(0, 1 + (Number(inst.magicosPct) || 0) / 100), raro: Math.max(0, 1 + (Number(inst.rarosPct) || 0) / 100) },
    chefes: Math.max(1, Math.round(Number(inst.chefes) || 1)),
    // (dono, 03/11 — "100%") os BAÚS do mapa único: "Área contém um Grande Baú" (`grandesBaus`) e "Baús têm a Raridade de Itens aumentada em
    // X%" (`bausRaridadePct`) — `itens-poe/baus-poe.mjs` (o Grande Baú nasce com a instância; a raridade vale no loot do baú)
    baus: { grandes: Math.max(0, Math.round(Number(inst.grandesBaus) || 0)), raridadePct: Math.max(0, Number(inst.bausRaridadePct) || 0) },
    // (08/11) "Itens Encontrados têm X% de chance de caírem Corrompidos na Área" (o loot dos monstros e dos baús — `hunt/combate.mjs`, `baus-poe.pagar`)
    corrompidosPct: Math.max(0, Math.min(100, Number(inst.corrompidosPct) || 0)),
    // (08/11) os TRECHOS DE SOLO ("Área possui trechos de Solo Ardente" — o raio do PoE de cada um: `mapas-areas.porSolosNaInstancia`)
    solos: Object.fromEntries(['ardente', 'congelado', 'profanado'].map((t) => [t, Number(inst[`solo_${t}`]) || 0]).filter(([, r]) => r > 0)),
    // (08/11) os HABITANTES ("Área é habitada por Esqueletos", "por seguidores de Lunaris", "muitos Totens", "variedade de monstros" — `mapas-areas.comHabitantes`)
    // (08/11) "Área não contém monstros" (as Relíquias de Atziri): só os baús, onde nasceriam os grupos (`cacadas.povoar`)
    semMonstros: Number(inst.semMonstros) > 0,
    // (08/11) "Chefe Único é ampliado pelas escolhas do Jogador" (o Maquinário de Doryani — `doryani.mjs`)
    doryani: Number(inst.doryani) > 0,
    // (08/11) o TERRENO próprio do único ("imenso Labirinto", "brechas sem passagem" — `mapas-areas.huntIdDoMapa`)
    terreno: ['labirinto', 'brechas'].find((t) => Number(inst[`terreno_${t}`]) > 0) ?? null,
    // (08/11) "Área se torna fatal após algum tempo" (o Tesouro Maldito de Oba): os segundos até ficar fatal (`cacadas.areaFatal`)
    fatalS: Math.max(0, Number(inst.fatalS) || 0),
    // (08/11) as ONDAS do Julgamento do Covarde ("Contém ondas de Monstros", "ondas adicionais de …" — `mapas-areas.porOndasNaInstancia`)
    ondas: Object.keys(inst).filter((k) => k.startsWith('ondas_') && Number(inst[k]) > 0).map((k) => k.slice('ondas_'.length)),
    habitantes: Object.fromEntries(['esqueletos', 'lunaris', 'solaris', 'totens', 'variedade'].map((g) => [g, Number(inst[`habitantes_${g}`]) || 0]).filter(([, v]) => v > 0)),
  };
}

/** O resumo do mapa que a CAÇADA guarda (`hunt.mapa`): o id do mapa aberto, o tier, o nível, a quantidade/raridade de itens e os efeitos. */
export const resumoNaCacada = (id, peca) => {
  // (refeito da peça: os números são sempre os do mapas.json atual, não os de quando a peça caiu)
  const r = resumo({ poe: peca?.poe });
  // (05/11) `encontro`: o chefe a mais do mapa (o Guardião, o Conquistador — `pinaculos-acesso.mjs`), que nasce na instância
  return { id, tier: r.tier, nivel: r.nivel, quantidade: r.quantidade, raridade: r.raridade, grupo: r.grupo, efeitos: r.efeitos, ...(peca?.poe?.encontro ? { encontro: peca.poe.encontro } : {}) };
};
/** (08/11) Os TRECHOS DE SOLO do mapa único em que a caçada está (`instancia.solosDoMapa` — `mapas-areas.porSolosNaInstancia`). */
export const solosDoMapa = (hunt) => salaDe(hunt)?.instancia?.solosDoMapa ?? [];
/**
 * (08/11) O que a peça do mapa único GANHA AO NASCER: `{ aleatorios, globais }` — a soma dos valores das linhas com `alvo: 'peca'` ("Mapa possui N
 * Modificadores aleatórios adicionais" — `modsAleatorios`; "Mapa tem N Modificadores Synthesis Globais adicionais" — `sinteseGlobais`).
 */
export function extrasDoUnico(poe) {
  const u = unicoDoMapa(poe?.unico);
  const saida = { aleatorios: 0, globais: 0 };
  for (const m of poe?.modificadores ?? []) {
    for (const e of u?.modificadores?.find((x) => x.modelo === m.modelo)?.efeitos ?? []) {
      if (e.alvo !== 'peca') continue;
      const v = Math.round(e.fixo ?? (Number(m.valores?.[e.de]) || 0));
      if (e.stat === 'modsAleatorios') saida.aleatorios += v;
      else if (e.stat === 'sinteseGlobais') saida.globais += v;
    }
  }
  return saida;
}

