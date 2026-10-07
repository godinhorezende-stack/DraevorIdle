// As MISSÕES que dão gemas no PoE (dono, 06/10: "implemente as gemas de suporte e suas missões" — a coleção do Drive `suportes`,
// `missoes.json`) → `gamedata/itens-poe/missoes-de-gemas.json`, que o jogo lê (`systems/itens-poe/missoes-de-gemas.mjs`).
//
// Para cada missão: o nome em português (da coleção das gemas ativas, `poe-gemas-poedb/missoes.json`), o ato, ONDE ela conclui no jogo
// (`gatilho`: a fase da campanha que, completada, conclui a missão — ou o chefe do ato) e a recompensa por CLASSE (a lista "Normal" do
// PoE), já como slugs do jogo: gemas ativas (`poe-gemas-poedb`) e suportes (`poe-suportes-poedb`). As peças da lista (Simple Robe,
// Chainmail Vest...) ficam de fora (decisão do dono: só gemas ativas e suportes). O que não casar com nenhuma gema sai em `semGema`.
// Uso: node tools/importar-missoes-de-gemas.mjs
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = process.env.REFERENCIAS_POE ?? '/home/deploy/referencias-poe';
const ler = (rel) => JSON.parse(readFileSync(join(RAIZ, rel), 'utf8'));
const SAIDA = new URL('../gamedata/itens-poe/missoes-de-gemas.json', import.meta.url);

/*
 * Onde cada missão CONCLUI no jogo. As do item de missão e as do chefe da fase vêm do editor da campanha (as `fasesLigadas` da tela de
 * Missões); as outras, pelo último passo da missão no PoE:
 *   O Bruto Enjaulado — matar o Brutus, na Prisão Superior;  A Raiz do Problema — atravessar as Ruínas Vaal;
 *   Um Acerto do Destino — as Páginas Douradas, na Biblioteca;  Um Espírito Indomável — libertar o espírito de Deshret, nas Minas;
 *   O Eterno Pesadelo — matar o Malachai, o chefe do Ato 4.
 * ("The Twilight Strand" não é missão: são caixas no chão da praia — fica de fora.)
 */
const GATILHOS = {
  Enemy_at_the_Gate: { fase: 'poe-a1-the-twilight-strand' },
  Mercy_Mission: { fase: 'poe-a1-the-tidal-island' },
  The_Caged_Brute: { fase: 'poe-a1-the-upper-prison' },
  Sharp_and_Cruel: { fase: 'poe-a2-the-weavers-chambers' },
  The_Root_of_the_Problem: { fase: 'poe-a2-the-vaal-ruins' },
  A_Fixture_of_Fate: { fase: 'poe-a3-the-library' },
  An_Indomitable_Spirit: { fase: 'poe-a4-the-mines-level-2' },
  The_Eternal_Nightmare: { bossDoAto: 4 },
  // As que faltavam (dono, 07/10: "implemente as missões que faltam para dar as gemas no jogo") — as recompensas vêm da tabela do poedb
  // (`original/poe-atos/Missoes/recompensas-por-missao.json`), o fim de cada uma pelo último passo no PoE:
  //   Quebrando Alguns Ovos — abrir a passagem com os glifos, nos Charcos;  O Canto da Sereia — matar a Merveil, o chefe do Ato 1;
  //   Intrusos de Preto — matar o Fidelitas, na Câmara dos Pecados 2;  Perdidos de Amor — a pulseira do Tolman, no Crematório;
  //   Decepar a Mão Direita — matar o General Gravicius, no Quartel de Ébano;  Rompendo o Selo — o estandarte do Voll, no Lago Seco.
  Breaking_Some_Eggs: { fase: 'poe-a1-the-mud-flats' },
  The_Sirens_Cadence: { bossDoAto: 1 },
  Intruders_in_Black: { fase: 'poe-a2-the-chamber-of-sins-level-2' },
  Lost_in_Love: { fase: 'poe-a3-the-crematorium' },
  Sever_the_Right_Hand: { fase: 'poe-a3-the-ebony-barracks' },
  Breaking_the_Seal: { fase: 'poe-a4-the-dried-lake' },
};

// (O apóstrofo some antes: "Guardian's Blessing" e "Guardians Blessing" são a mesma gema.)
const normal = (s) => String(s ?? '').toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
// As gemas ativas (nome em inglês → slug) e os suportes.
const ativas = new Map();
const pastaAtivas = join(RAIZ, 'poe-gemas-poedb', 'gemas');
for (const f of readdirSync(pastaAtivas).filter((x) => x.endsWith('.json'))) {
  const g = JSON.parse(readFileSync(join(pastaAtivas, f), 'utf8'));
  if (g.nome_en) ativas.set(normal(g.nome_en), g.slug);
}
const suportes = new Map(ler('poe-suportes-poedb/suportes.json').map((s) => [normal(s.en ?? s.slug.replace(/_/g, ' ')), s.slug]));
// O nome em português: o da coleção das missões da campanha (todas) e, na falta, o da coleção das gemas ativas.
const nomesPt = new Map([
  ...(existsSync(join(RAIZ, 'poe-gemas-poedb', 'missoes.json')) ? ler('poe-gemas-poedb/missoes.json') : []),
  ...(existsSync(join(RAIZ, 'original', 'poe-atos', 'Missoes', 'missoes.json')) ? ler('original/poe-atos/Missoes/missoes.json') : []),
].map((m) => [m.slug, m.nome]));

const semGema = new Set();
const missoes = [];
for (const m of ler('suportes-drive/missoes.json')) {
  const gatilho = GATILHOS[m.slug];
  if (!gatilho) continue;
  const recompensas = {};
  for (const [classe, nomes] of Object.entries(m.recompensas?.Normal ?? {})) {
    if (!classe) continue;
    recompensas[classe] = [];
    for (const nome of nomes) {
      const k = normal(nome);
      const s = suportes.get(k);
      const a = s ? null : ativas.get(k);
      if (s) recompensas[classe].push({ tipo: 'suporte', slug: s });
      else if (a) recompensas[classe].push({ tipo: 'ativa', slug: a });
      else semGema.add(nome);
    }
  }
  missoes.push({ slug: m.slug, nome: nomesPt.get(m.slug) ?? m.nome, en: m.nome, ato: Number(m.ato), gatilho, recompensas });
}

// As missões que a coleção do Drive não tem: a tabela "Quest Reward" do poedb (por classe, já com o slug de cada gema).
const POEDB = join(RAIZ, 'original', 'poe-atos', 'Missoes', 'recompensas-por-missao.json');
const CLASSE_DO_POEDB = { Marauder: 'Marauder', Bruxa: 'Witch', Herdeira: 'Scion', 'Caçadora': 'Ranger', Duelista: 'Duelist', Sombra: 'Shadow', 'Templário': 'Templar' };
const slugsDeSuporte = new Set(suportes.values());
const slugsDeAtiva = new Set(ativas.values());
if (existsSync(POEDB)) {
  for (const m of JSON.parse(readFileSync(POEDB, 'utf8')).itens) {
    const gatilho = GATILHOS[m.missao.slug];
    if (!gatilho || missoes.some((x) => x.slug === m.missao.slug)) continue;
    const recompensas = {};
    for (const [classePt, lista] of Object.entries(m.por_classe ?? {})) {
      const classe = CLASSE_DO_POEDB[classePt];
      if (!classe) continue;
      recompensas[classe] = lista
        .map((g) => (slugsDeSuporte.has(g.slug) ? { tipo: 'suporte', slug: g.slug } : slugsDeAtiva.has(g.slug) ? { tipo: 'ativa', slug: g.slug } : (semGema.add(g.nome), null)))
        .filter(Boolean);
    }
    missoes.push({ slug: m.missao.slug, nome: nomesPt.get(m.missao.slug) ?? m.missao.nome, en: m.missao.slug.replace(/_/g, ' '), ato: Number(m.ato), gatilho, recompensas });
  }
}
missoes.sort((a, b) => a.ato - b.ato);

writeFileSync(SAIDA, `${JSON.stringify({
  _nota: 'As missões do PoE que dão gemas (tools/importar-missoes-de-gemas.mjs, da coleção do dono no Drive). `gatilho`: a fase da campanha que, completada pela primeira vez, conclui a missão (ou o chefe do ato). `recompensas`: por classe, as gemas da lista Normal do PoE — o jogador ESCOLHE uma, no nível 1 (dono, 06/10: "como no PoE"; só gemas ativas e suportes; a Zuma continua vendendo todas).',
  missoes,
}, null, 1)}\n`);
console.log(`${missoes.length} missões gravadas; sem gema no jogo (peças e afins, fora): ${[...semGema].sort().join(', ')}`);
