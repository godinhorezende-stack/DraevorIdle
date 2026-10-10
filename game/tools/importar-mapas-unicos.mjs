// IMPORTA os MAPAS ÚNICOS do poedb em português para `gamedata/itens-poe/mapas.json → classe.unicos` (dono, 10/10: "os mapas únicos
// estão funcionando?" → "sim, em português"; "até T16: a área não vai ser só de nível 68"; e "aqui são 26 únicos" — todos os da aba).
//
// A fonte é a aba "Mapas Únicos" de https://poedb.tw/pt/Maps, extraída pelo Scrapling (`/home/deploy/scrapling`, `extrair/abas.py Maps`
// → `saida/json/Maps.json`). Cada linha vira o texto com o modelo e as faixas de sorteio (o formato dos únicos do catálogo), e ganha os
// EFEITOS que já agem no jogo (`REGRAS`, abaixo: os mesmos alvos dos mods de mapa — monstros, chefe, instância, jogador — e `mapa` para a
// Quantidade/Raridade de Itens e o Tamanho do Grupo). A linha sem mecânica no jogo fica sem efeito, com a nota (`NOTAS`); as linhas
// internas do poedb ("map no exiles [1]") e os lembretes entre parênteses ficam de fora — menos as de Quantidade/Raridade de Itens e
// Tamanho do Grupo ("map item drop quantity +% [100]"), que o poedb dá cruas e agem no PoE: viram a linha em português (`CRUAS`).
//
// O tier: o catálogo põe cada único em todas as bases de mapa (`itens-poe/catalogo.mjs`); `tiers` (opcional) restringe.
//
// O ÍCONE (dono, 10/10: "desenho do PoE" e "coloque o número romano em cima dos únicos para facilitar"): o desenho do próprio único no PoE
// (`ARTE`, o arquivo de `Art/2DItems/Maps/` que o poedb mostra) — o PNG do CDN oficial do PoE (web.poecdn.com; o mesmo desenho do webp do
// poedb), centralizado no quadro de 80×80 dos mapas (`importar-icones-mapas.centralizar`; já baixado é pulado) — com o NÚMERO ROMANO do
// tier por cima (as camadas do dono, `mapas/camadas/Numero_Tier_N.png`): um ícone por tier (`<Único>_T<N>.png`). O ícone é por id, então
// cada único tem um id FIXO por tier no catálogo: `itemIdBase` + tier (7.701.001 … 7.701.016 o primeiro, 7.702.001 … o segundo…), que o
// importador preserva; o tier da peça continua vindo da base dela.
//
//   node tools/importar-mapas-unicos.mjs [caminho do Maps.json]     (padrão: /home/deploy/scrapling/saida/json/Maps.json)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { decodificarPng, codificarPng } from '../engine/png-minimo.mjs';
import { centralizar, LADO } from './importar-icones-mapas.mjs';

const RAIZ = dirname(fileURLToPath(import.meta.url));
export const SAIDA = join(RAIZ, '..', 'gamedata', 'itens-poe', 'mapas.json');
const FONTE_PADRAO = '/home/deploy/scrapling/saida/json/Maps.json';
/** A pasta dos ícones dos únicos (dentro de `icones-itens`, servida em `/api/jogo/poe/icone/item/`). */
export const PASTA_DOS_ICONES = join(RAIZ, '..', 'gamedata', 'itens-poe', 'icones-itens', 'poe-itens', 'Mapas', 'unicos');
/** As camadas do número romano de cada tier (as do dono; fora do repositório). */
export const PASTA_DAS_CAMADAS = join(RAIZ, '..', '..', 'mapas', 'camadas');
/** Os ids dos únicos: o primeiro é 7.701.000 + tier, o segundo 7.702.000 + tier… (os mapas comuns são 7.700.000 + tier). */
export const PRIMEIRO_ID = 7_701_000;
export const PASSO_DO_ID = 1000;

/**
 * O desenho de cada um no PoE (o arquivo em `Art/2DItems/Maps/`): o da lista do poedb, ou — sem foto na lista — o da página do mapa. As
 * Réplicas usam o do original. A ordem é a da aba; os ids de quem já existia não mudam (`idsDosUnicos`).
 */
export const ARTE = {
  Actons_Nightmare: 'musicbox',
  The_Cowards_Trial: 'UndeadSiege',
  'Maelström_of_Chaos': 'MaelstromofChaos',
  Mao_Kun: 'FairgravesMap01',
  Olmecs_Sanctum: 'olmec',
  Poorjoys_Asylum: 'PoorjoysAsylum',
  Vaults_of_Atziri: 'UniqueMap1',
  Death_and_Taxes: 'DeathandTaxes',
  Obas_Cursed_Trove: 'oba',
  Whakawairua_Tuahu: 'UniqueMapEye',
  Hall_of_Grandmasters: 'HallOfGrandmasters',
  The_Vinktar_Square: 'TheVinktarSquare',
  'Caer_Blaidd,_Wolfpacks_Den': 'WolfMap',
  The_Putrid_Cloister: 'PutridCloister',
  Hallowed_Ground: 'HallowedGround',
  Pillars_of_Arun: 'PillarsOfVastiri',
  The_Twilight_Temple: 'Celestial',
  Doryanis_Machinarium: 'Doryanis',
  Cortex: 'SynthesisBossGuardianMap',
  Altered_Distant_Memory: 'SynthesisColdGuardianMap',
  Augmented_Distant_Memory: 'SynthesisFireGuardianMap',
  Twisted_Distant_Memory: 'SynthesisLightningGuardianMap',
  Rewritten_Distant_Memory: 'SynthesisGolemGuardianMap',
  Replica_Cortex: 'SynthesisBossGuardianMap',
  Replica_Pillars_of_Arun: 'PillarsOfVastiri',
  Replica_Poorjoys_Asylum: 'PoorjoysAsylum',
};
/** Os mapas únicos que entram (os slugs do poedb): todos os 26 da aba "Mapas Únicos". */
export const ESCOLHIDOS = Object.keys(ARTE);
/** O arquivo do desenho (o slug sem o que não é letra, número ou "_": "Caer_Blaidd,_Wolfpacks_Den" → "Caer_Blaidd_Wolfpacks_Den.png"). */
export const arquivoDoIcone = (slug) => `${String(slug).replace(/[^A-Za-z0-9_]/g, '')}.png`;
/** O ícone do tier: o desenho com o número romano ("Hallowed_Ground_T5.png") — o mesmo nome que `itens-poe/mapas.iconeDoUnico` monta. */
export const arquivoDoIconeNoTier = (slug, tier) => arquivoDoIcone(slug).replace(/\.png$/, `_T${tier}.png`);

const MALDICAO = { Vulnerabilidade: 'vulnerabilidade', Flamabilidade: 'flamabilidade', Congelabilidade: 'congelabilidade', Condutividade: 'condutividade', Desespero: 'desespero' };
/** Linha (o modelo, com {0}, {1}…) → os efeitos no jogo. */
export const REGRAS = [
  [/^Quantidade de Itens encontrados nesta Área aumentada em \{0\}%$/, () => [{ alvo: 'mapa', stat: 'quantidade', de: 0 }]],
  [/^Raridade de Itens encontrados nessa Área aumentada em \{0\}%$/, () => [{ alvo: 'mapa', stat: 'raridade', de: 0 }]],
  [/^Tamanho do Grupo aumentado em \{0\}%$/, () => [{ alvo: 'mapa', stat: 'grupo', de: 0 }]],
  [/^Monstros Mágicos aumentados em \{0\}%$/, () => [{ alvo: 'instancia', stat: 'magicosPct', de: 0 }]],
  [/^Número de Monstros Raros aumentado em \{0\}%$/, () => [{ alvo: 'instancia', stat: 'rarosPct', de: 0 }]],
  [/^\{0\}% mais Vida de Monstros$/, () => [{ alvo: 'monstros', stat: 'vidaPct', de: 0, mais: true }]],
  [/^Dano dos Monstros aumentado em \{0\}%$/, () => [{ alvo: 'monstros', stat: 'danoPct', de: 0 }]],
  [/^\+\{0\}% de Resistência a Raio para Monstros$/, () => [{ alvo: 'monstros', stat: 'resist.energy', de: 0 }]],
  [/^Monstros causam \{0\}% de Dano Físico como Dano de Raio extra$/, () => [{ alvo: 'monstros', stat: 'danoExtraPct.energy', de: 0 }]],
  [/^Monstros não são Afetados por Eletrizações$/, () => [{ alvo: 'monstros', stat: 'imuneChoque', fixo: 1 }]],
  [/^Ganho de Experiência aumentado em \{0\}%$/, () => [{ alvo: 'monstros', stat: 'experienciaPct', de: 0 }]],
  [/^Chefe Único causa Dano aumentado em \{0\}%$/, () => [{ alvo: 'chefe', stat: 'danoPct', de: 0 }]],
  [/^Chefe Único tem \{0\}% de sua Velocidade de Conjuração aumentada$/, () => [{ alvo: 'chefe', stat: 'velocidadeDeConjuracaoPct', de: 0 }]],
  [/^Chefe Único aumenta \{0\}% de Experiência$/, () => [{ alvo: 'chefe', stat: 'experienciaPct', de: 0 }]],
  [/^Chefe Único derruba \{0\} Itens Monetários adicionais$/, () => [{ alvo: 'chefe', stat: 'moedasExtras', de: 0 }]],
  [/^Chefes Únicos derrubam \{0\} Mapas adicionais$/, () => [{ alvo: 'chefe', stat: 'mapasExtras', de: 0 }]],
  [/^Jogadores são Amaldiçoados com (\S+)$/, (m) => (MALDICAO[m[1]] ? [{ alvo: 'jogador', stat: 'maldicao', fixo: MALDICAO[m[1]] }] : null)],
  [/^\{0\} Cargas de Frasco recuperadas a cada \{1\} segundos$/, () => [{ alvo: 'jogador', stat: 'frasco_regen_n:todos', de: 0 }, { alvo: 'jogador', stat: 'frasco_regen_s:todos', de: 1 }]],
  // (As mesmas mecânicas dos mods dos mapas comuns — `tools/montar-mapas-poe.mjs → EFEITOS`.)
  [/^Velocidade de Movimento dos Monstros aumentada em \{0\}%$/, () => [{ alvo: 'monstros', stat: 'velocidadePct', de: 0 }]],
  [/^Velocidade de Ataque dos Monstros aumentada em \{0\}%$/, () => [{ alvo: 'monstros', stat: 'velocidadeDeAtaquePct', de: 0 }]],
  [/^Velocidade de Conjuração dos Monstros aumentada em \{0\}%$/, () => [{ alvo: 'monstros', stat: 'velocidadeDeConjuracaoPct', de: 0 }]],
  [/^Monstros têm a Chance de Crítico aumentada em \{0\}%$/, () => [{ alvo: 'monstros', stat: 'critChance', de: 0, escala: 0.05 }]],
  [/^\+\{0\}% ao Multiplicador de Crítico do Monstro$/, () => [{ alvo: 'monstros', stat: 'critMultiplicador', de: 0 }]],
];
/** As linhas que o poedb dá CRUAS (o id do stat) e que agem no PoE → a linha em português (`{v}`: o valor, ou a faixa "(a—b)"). Valor 0: fora. */
export const CRUAS = [
  [/^map item drop quantity \+% \[(.+)\]$/, 'Quantidade de Itens encontrados nesta Área aumentada em {v}%'],
  [/^map item drop rarity \+% \[(.+)\]$/, 'Raridade de Itens encontrados nessa Área aumentada em {v}%'],
  [/^map pack size \+% \[(.+)\]$/, 'Tamanho do Grupo aumentado em {v}%'],
];
/** Linha sem mecânica no jogo → o motivo (o balão mostra). */
export const NOTAS = [
  [/^Chefe Final derruba Itens de Níveis maiores$/, 'o nível dos itens do chefe ainda não sobe no jogo'],
  [/ao Nível dos Monstros da Área$|^Nível dos Monstros: /, 'o nível dos monstros é o do tier do mapa (ainda não muda por modificador)'],
  [/cartas de adivinhação/, 'as cartas de adivinhação não existem no jogo'],
  [/^% do Dano dos Monstros é convertido em Raio$|^Ganho de Experiência aumentado em %$/, 'o poedb não traz o valor'],
  [/Carga de (Tolerância|Poder) ao Acertar$/, 'os monstros ainda não ganham cargas'],
  [/trechos de [Ss]olo/, 'o solo ardente/gélido/profano ainda não existe no jogo'],
  [/habitada por|^Mortos Inquietos$|variedade de monstros|muitos Totens/, 'os monstros da área são os do tier do mapa'],
  [/imenso Labirinto|brechas sem passagem/, 'o terreno é o do tier do mapa'],
  [/Baú/, 'as áreas dos mapas não têm baús'],
  [/^Área não contém monstros$/, 'as áreas dos mapas sempre têm monstros'],
  [/ondas/, 'as ondas de monstros ainda não existem no jogo'],
  [/caírem Corrompidos/, 'o item corrompido no drop ainda não existe no jogo'],
  [/Modificadores (aleatórios adicionais|Synthesis)/, 'os modificadores a mais do mapa ainda não existem no jogo'],
  [/Raro adicional/, 'os Raros a mais do chefe ainda não existem no jogo'],
  [/Afecções|Atordoamentos/, 'a imunidade a afecções dos monstros ainda não existe no jogo'],
  [/Refletem Feitiços|aplicam Feitiços aleatórios|efeito em Monstros reduzido/, 'os feitiços dos monstros ainda não existem no jogo'],
  [/fatal após algum tempo/, 'a área que fica fatal ainda não existe no jogo'],
  [/Grão-Mestres|PvP/, 'os Grão-Mestres ainda não existem no jogo'],
  [/ampliado pelas escolhas/, 'a escolha do chefe ainda não existe no jogo'],
  [/Habilidade Avanço|Habilidades de Movimento/, 'as habilidades de movimento ainda não existem no jogo'],
];

/** O texto do poedb → `{ modelo, faixas }`: cada número (ou faixa "(a—b)") vira `{i}`. */
export function modeloDe(texto) {
  const faixas = [];
  const num = (x) => Number(String(x).replace(',', '.'));
  const modelo = String(texto).replace(/\((-?\d+(?:[.,]\d+)?)—(-?\d+(?:[.,]\d+)?)\)|(-?\d+(?:[.,]\d+)?)/g, (_, a, b, n) => {
    faixas.push(a != null ? [num(a), num(b)] : [num(n), num(n)]);
    return `{${faixas.length - 1}}`;
  });
  return { modelo, faixas };
}

/** Uma linha do poedb → o modificador do catálogo (com os efeitos ou a nota), ou null (linha interna / lembrete). */
export function modificadorDe(texto) {
  let t = String(texto).trim();
  for (const [re, pt] of CRUAS) {
    const m = t.match(re);
    if (!m) continue;
    const v = m[1].split(',').map((x) => Number(x.trim()));
    if (!v.some((x) => x)) return null;
    t = pt.replace('{v}', v.length > 1 && v[0] !== v[1] ? `(${v[0]}—${v[1]})` : String(v[0]));
    break;
  }
  // (O lembrete é a linha INTEIRA entre parênteses; "(40—50)% mais Vida de Monstros" começa com a faixa e é um modificador.)
  if (!t || (t.startsWith('(') && t.endsWith(')')) || /\[\d+\]$/.test(t)) return null;
  const { modelo, faixas } = modeloDe(t);
  for (const [re, fazer] of REGRAS) {
    const m = modelo.match(re);
    const efeitos = m ? fazer(m) : null;
    if (efeitos) return { tipo: 'explicit', texto: t, modelo, faixas, efeitos };
  }
  const nota = NOTAS.find(([re]) => re.test(modelo))?.[1] ?? 'ainda não tem a mecânica no jogo';
  return { tipo: 'explicit', texto: t, modelo, faixas, efeitos: [], nota };
}

/**
 * A base dos ids de cada único (`itemIdBase`; o id do tier N é a base + N): o que já tinha fica com a dele (`antigos`, slug → base); o novo
 * pega a próxima livre (7.701.000, 7.702.000…) — o id nunca muda (as peças guardadas apontam para ele).
 */
export function idsDosUnicos(slugs, antigos = {}) {
  const usados = new Set(Object.values(antigos).map(Number));
  let proximo = PRIMEIRO_ID;
  const saida = {};
  for (const slug of slugs) {
    if (antigos[slug]) { saida[slug] = Number(antigos[slug]); continue; }
    while (usados.has(proximo)) proximo += PASSO_DO_ID;
    saida[slug] = proximo;
    usados.add(proximo);
  }
  return saida;
}

/**
 * Os mapas únicos escolhidos, do Maps.json do Scrapling: `[{ slug, nome, base, itemIdBase, icone, iconeLado, arte, requisitos,
 * atributosDaBase, modificadores }]` (`icone`: o desenho sem número; o de cada tier, com o número, é `<desenho>_T<N>.png`). `antigos`: as
 * bases dos ids que já existem (slug → itemIdBase).
 */
export function unicosDe(fonte, escolhidos = ESCOLHIDOS, antigos = {}) {
  const aba = (fonte?.abas ?? []).find((a) => a.id === 'MapasÚnicos');
  const bases = aba?.cards?.flatMap((c) => c.bases ?? []) ?? [];
  const porSlug = new Map(bases.map((b) => [decodeURIComponent(String(b.href).split('/').pop()), b]));
  const ids = idsDosUnicos(escolhidos, antigos);
  return escolhidos.map((slug) => {
    const b = porSlug.get(slug);
    if (!b) throw new Error(`o mapa único ${slug} não está na aba "Mapas Únicos"`);
    const [nome, base] = String(b.nome).split('\n').map((x) => x.trim());
    const nivel = Number(b.props?.find((p) => p.classe === 'requirements')?.texto?.match(/\d+/)?.[0]) || null;
    const modificadores = (b.props ?? []).filter((p) => p.classe === 'explicitMod').map((p) => modificadorDe(p.texto)).filter(Boolean);
    const icone = ARTE[slug] ? { icone: `poe-itens/Mapas/unicos/${arquivoDoIcone(slug)}`, iconeLado: LADO, arte: `Art/2DItems/Maps/${ARTE[slug]}` } : {};
    return { slug, nome, base, itemIdBase: ids[slug], ...icone, requisitos: { nivel, forca: null, destreza: null, inteligencia: null }, atributosDaBase: {}, modificadores };
  });
}

/** Baixa o desenho do único (o PNG do CDN oficial do PoE) e grava centralizado em 80×80. Já baixado: pula. Devolve o que fez. */
export async function baixarIcone(u, pasta = PASTA_DOS_ICONES) {
  if (!u.arte) return 'sem desenho';
  const alvo = join(pasta, arquivoDoIcone(u.slug));
  if (existsSync(alvo)) return 'já estava';
  const r = await fetch(`https://web.poecdn.com/image/${u.arte}.png`, { headers: { 'user-agent': 'Mozilla/5.0 (DraevorIdle; importar-mapas-unicos)' } });
  if (!r.ok) throw new Error(`${u.slug}: o CDN do PoE respondeu ${r.status}`);
  mkdirSync(pasta, { recursive: true });
  writeFileSync(alvo, codificarPng(centralizar(decodificarPng(Buffer.from(await r.arrayBuffer())))));
  return 'baixado';
}

/** `cima` sobre `baixo` (RGBA do mesmo tamanho, alfa direto — o "over" de sempre). */
export function sobrepor(baixo, cima) {
  if (baixo.w !== cima.w || baixo.h !== cima.h) throw new Error(`tamanhos diferentes: ${baixo.w}×${baixo.h} e ${cima.w}×${cima.h}`);
  const data = new Uint8ClampedArray(baixo.data.length);
  for (let i = 0; i < data.length; i += 4) {
    const ac = cima.data[i + 3] / 255;
    const ab = baixo.data[i + 3] / 255;
    const a = ac + ab * (1 - ac);
    for (let k = 0; k < 3; k++) data[i + k] = a > 0 ? Math.round((cima.data[i + k] * ac + baixo.data[i + k] * ab * (1 - ac)) / a) : 0;
    data[i + 3] = Math.round(a * 255);
  }
  return { w: baixo.w, h: baixo.h, data };
}

/** Os 16 ícones do único (o desenho com o número romano de cada tier, centralizado). Refaz sempre (o resultado é o mesmo byte a byte). */
export function iconesDosTiers(u, { pasta = PASTA_DOS_ICONES, camadas = PASTA_DAS_CAMADAS } = {}) {
  const desenho = decodificarPng(readFileSync(join(pasta, arquivoDoIcone(u.slug))));
  for (let tier = 1; tier <= 16; tier++) {
    const numero = centralizar(decodificarPng(readFileSync(join(camadas, `Numero_Tier_${tier}.png`))));
    writeFileSync(join(pasta, arquivoDoIconeNoTier(u.slug, tier)), codificarPng(sobrepor(desenho, numero)));
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const caminho = resolve(process.argv[2] ?? FONTE_PADRAO);
  if (!existsSync(caminho)) throw new Error(`não achei ${caminho} — rode antes, no Scrapling: extrair/baixar.py Maps && extrair/abas.py Maps`);
  const mapas = JSON.parse(readFileSync(SAIDA, 'utf8'));
  const antigos = Object.fromEntries((mapas.classe.unicos ?? []).filter((u) => u.itemIdBase).map((u) => [u.slug, u.itemIdBase]));
  const unicos = unicosDe(JSON.parse(readFileSync(caminho, 'utf8')), ESCOLHIDOS, antigos);
  mapas.classe.unicos = unicos;
  writeFileSync(SAIDA, `${JSON.stringify(mapas, null, 1)}\n`);
  const comNumero = existsSync(PASTA_DAS_CAMADAS);
  for (const u of unicos) {
    const desenho = await baixarIcone(u);
    if (comNumero && u.arte) iconesDosTiers(u);
    console.log(`${u.nome} (ids ${u.itemIdBase + 1}–${u.itemIdBase + 16}): ${u.modificadores.filter((m) => m.efeitos.length).length} linhas com efeito, ${u.modificadores.filter((m) => !m.efeitos.length).length} sem efeito; desenho ${desenho}`);
  }
  if (!comNumero) console.log(`sem as camadas do número (${PASTA_DAS_CAMADAS}): os ícones dos tiers não foram refeitos`);
}
