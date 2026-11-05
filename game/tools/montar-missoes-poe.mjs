#!/usr/bin/env node
// (05/11) O REGISTRO DE MISSÕES do PoE no jogo (dono: "verifique se todas essas missões e assets de itens de missões estão implementadas, se
// não implemente" — https://poedb.tw/pt/Quest). Lê `gamedata/itens-poe/missoes-poedb.json` (tools/importar-missoes-poedb.mjs) e a campanha
// do jogo (`campanha-poe.json` + `gamedata/atos/poe-ato-N.json`) e grava:
//   - `gamedata/itens-poe/missoes.json`: as missões (uma por slug) com o GATILHO no jogo, os passos ligados às fases, as recompensas e os
//     itens de missão — quem lê é systems/itens-poe/missoes.mjs;
//   - `gamedata/itens-poe/missoes-itens-ids.json`: o id de ITEM de cada item de missão (o `Type` do poedb → id). ESTÁVEL: só cresce. Os 16
//     que já existiam (7600001–7600016, `itens-de-missao.json`, gravados nos atos e nas bolsas) ficam com o mesmo número.
//
// O gatilho (o que conclui a missão no jogo), pela categoria (dono, 05/11: campanha, Atlas e liga entram; o que não tem caminho fica marcado):
//   - campanha (Normal/Optional dos Atos 1–10): `{ fase }` — a fase mais adiante entre as áreas dos passos (a ordem do ato), ou `{ chefeDoAto }`
//     quando a missão é matar o chefe do ato; `GATILHOS` corrige à mão o que a regra erra;
//   - Atlas (Normal do "Ato 12"): `ATLAS` (mapa concluído, pináculo vencido);
//   - Labirinto, Esconderijo, Epílogo e as de liga (MasterQuest/MasterMission): `semCaminho` com o motivo.
//
//   node tools/montar-missoes-poe.mjs
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { traduzirLinha } from '../systems/itens-poe/arvore.mjs';

const lerJson = (rel) => JSON.parse(readFileSync(new URL(`../gamedata/${rel}`, import.meta.url), 'utf8'));
const ARQ_IDS = new URL('../gamedata/itens-poe/missoes-itens-ids.json', import.meta.url);
const DESTINO = new URL('../gamedata/itens-poe/missoes.json', import.meta.url);
const PASTA_DOS_ICONES = fileURLToPath(new URL('../gamedata/itens-poe/icones-itens/poe-itens/Missoes', import.meta.url));

/** O primeiro id dos itens de missão NOVOS (os 16 da campanha vão de 7600001 a 7600016). */
const PRIMEIRO_ID_NOVO = 7_600_017;
/** Os 16 itens que já existiam (`itens-de-missao.json`) → o `Type` do poedb (três têm o nome diferente do poedb: Espinho, Estandarte, Manuscrito). */
const ITENS_ANTIGOS = {
  7600001: 'Medicine_Chest', 7600002: 'Allflame', 7600003: 'Maligaros_Spike', 7600004: 'Deshrets_Banner', 7600005: 'The_Eye_of_Fury',
  7600006: 'The_Eye_of_Desire', 7600007: 'Eyes_of_Zeal', 7600008: 'Bestels_Manuscript', 7600009: 'Black_Venom', 7600010: 'Wings_of_Vastiri',
  7600011: 'Storm_Blade', 7600012: 'Calendar_of_Fortune', 7600013: 'Basilisk_Acid', 7600014: 'Sekhema_Feather', 7600015: 'Trarthan_Powder',
  7600016: 'The_Staff_of_Purity',
};

/**
 * Correções à mão do gatilho da campanha (a regra "a fase mais adiante dos passos" erra quando o passo final é numa área com outro nome, ou
 * quando a missão termina num chefe que não é o do ato). `{ fase }` ou `{ chefeDoAto }`.
 */
export const GATILHOS = {
  The_Sirens_Cadence: { chefeDoAto: 1 },
  The_Way_Forward: { fase: 'poe-a2-the-western-forest' },
  Shadow_of_the_Vaal: { chefeDoAto: 2 },
  The_Brine_King: { chefeDoAto: 6 },
  Safe_Passage: { fase: 'poe-a10-the-cathedral-rooftop' },
  Love_is_Dead: { fase: 'poe-a8-the-quay' },
  Toward_the_Future: { chefeDoAto: 10 },
  An_End_to_Hunger: { chefeDoAto: 10 },
};

/**
 * Os BANDIDOS (Ato 2): as quatro missões do poedb são uma escolha só — matar os três (Lidando com os Bandidos) ou ajudar um deles (O Lorde
 * Bandido X). A escolha abre depois das três fases dos bandidos (Ponte Quebrada, Floresta Ocidental, Terras Inundadas) e é feita na aba Missões.
 */
export const FASES_DOS_BANDIDOS = ['poe-a2-the-broken-bridge', 'poe-a2-the-western-forest', 'poe-a2-the-wetlands'];
export const BANDIDOS = { Deal_with_the_Bandits: 'todos', The_Bandit_Lord_Kraityn: 'kraityn', The_Bandit_Lord_Alira: 'alira', The_Bandit_Lord_Oak: 'oak' };

/** As missões do Atlas ("Ato 12" do poedb) e o que as conclui no jogo. */
export const ATLAS = {
  A_Call_to_Arms: { gatilho: { mapas: 1 }, nota: 'Concluir o primeiro mapa. Sem o Comandante Kirac.' },
  The_Atlas_of_Worlds: { gatilho: { mapas: 1 }, nota: 'Concluir o primeiro mapa (o Dispositivo de Mapas abre depois do Kitava).' },
  The_Maven: { gatilho: { pinaculo: ['poe-the-maven', 'poe-nucleus-of-the-maven'] }, nota: 'Vencer a Maven. Sem os Convites e sem a Maven assistindo às lutas.' },
  The_Mavens_Game: { gatilho: { pinaculo: ['poe-the-maven', 'poe-nucleus-of-the-maven'] }, nota: 'Vencer a Maven. Sem os Convites da Maven.' },
  The_Elder: { gatilho: { pinaculo: ['poe-the-elder'] }, nota: 'Vencer o Ancião. Sem os Guardiões e sem a influência do Ancião.' },
  The_Eater_of_Worlds: { gatilho: { pinaculo: ['poe-the-eater-of-worlds'] }, nota: 'Vencer o Devorador de Mundos. Sem os altares eldritch.' },
  The_Searing_Exarch: { gatilho: { pinaculo: ['poe-the-searing-exarch'] }, nota: 'Vencer o Exarca Cauterizado. Sem os altares eldritch.' },
  Threads_of_the_Originator: { gatilho: { unicos: ['Altered_Distant_Memory', 'Augmented_Distant_Memory', 'Rewritten_Distant_Memory', 'Twisted_Distant_Memory'] }, nota: 'Concluir os 4 mapas únicos Memória Distante.' },
};

/** O motivo do "sem caminho" de cada categoria. */
const SEM_CAMINHO = {
  labirinto: 'O Labirinto do Lorde não existe no jogo (decisão do dono: sem caminho; os pontos de Ascendência vêm dos chefes de ato).',
  esconderijo: 'O jogo não tem esconderijo.',
  epilogo: 'O Epílogo (Litoral Karui) não tem fases no jogo.',
  liga: 'A mecânica dessa liga do PoE não existe no jogo.',
  atlas: 'O jogo não tem o sistema do Atlas que essa missão usa.',
};

const sem = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** O nome da área para comparar: sem acento, sem artigo, sem " nível N". */
const chaveDaArea = (n) => sem(n).replace(/^(o|a|os|as)\s+/, '').replace(/\s+nivel\s+\d+$/, '').trim();

function categoria(m) {
  if (m.tipo === 'Labyrinth') return 'labirinto';
  if (m.tipo === 'Hideout') return 'esconderijo';
  if (m.tipo === 'MasterQuest' || m.tipo === 'MasterMission') return 'liga';
  if (m.ato === 12) return 'atlas';
  if (m.ato === 11) return 'epilogo';
  return 'campanha';
}

export function montar() {
  const poedb = lerJson('itens-poe/missoes-poedb.json');
  const campanha = lerJson('itens-poe/campanha-poe.json');
  const catalogo = lerJson('itens-poe/catalogo-itens.json');
  const moedas = lerJson('itens-poe/moedas-poe-ids.json').ids;
  const gemas = { ...lerJson('itens-poe/gemas-poe-ids.json').ids, ...lerJson('itens-poe/suportes-poe-ids.json').ids };
  const deGemas = new Set(lerJson('itens-poe/missoes-de-gemas.json').missoes.map((m) => m.slug));

  // As fases do jogo: área → { id, ato, ordem } (a ordem do editor; o chefe do ato fica depois da última).
  const fases = new Map();
  for (const f of readdirSync(new URL('../gamedata/atos/', import.meta.url)).filter((x) => /^poe-ato-\d+\.json$/.test(x))) {
    const ato = lerJson(`atos/${f}`);
    const n = Number(ato.id.replace('poe-ato-', ''));
    for (const fase of ato.fases) fases.set(fase.id, { id: fase.id, ato: n, ordem: fase.ordem ?? 0 });
  }
  const areas = Object.values(campanha.areas);
  /** A fase da área `nome` (no ato da missão primeiro; "A Prisão" acha "Prisão Inferior/Superior": a mais adiante). */
  function fasesDaArea(nome, ato) {
    const k = chaveDaArea(nome);
    const casa = (a) => {
      const ka = chaveDaArea(a.nome);
      return ka === k || ka.startsWith(`${k} `) || ka.endsWith(` ${k}`);
    };
    const candidatas = areas.filter((a) => !a.cidade && fases.has(a.id) && casa(a));
    const doAto = candidatas.filter((a) => a.ato === ato);
    return (doAto.length ? doAto : candidatas).map((a) => fases.get(a.id));
  }
  const chefes = Object.values(campanha.chefes);
  const nomesDoChefe = (c) => [c.nome, c.nomeEn, ...String(c.nome).split(/\s*\/\s*/)].filter(Boolean).map((n) => sem(n.split(',')[0]).trim());

  // Os itens de missão: um por `Type` do poedb; ids estáveis.
  const ids = existsSync(ARQ_IDS) ? JSON.parse(readFileSync(ARQ_IDS, 'utf8')).ids : {};
  for (const [id, chave] of Object.entries(ITENS_ANTIGOS)) {
    const it = poedb.itens.find((x) => x.id?.endsWith(`/${chave}`) || x.slug === chave);
    if (it) ids[it.id] ??= Number(id);
  }
  let proximo = Math.max(PRIMEIRO_ID_NOVO - 1, ...Object.values(ids)) + 1;
  const itens = [];
  for (const it of [...poedb.itens].sort((a, b) => a.id.localeCompare(b.id))) {
    ids[it.id] ??= proximo++;
    const rel = it.icone ? it.icone.replace(/^https:\/\/cdn\.poedb\.tw\/image\/Art\/(2DItems|2DArt)\//, '').replace(/\.(webp|png)$/, '.png') : null;
    itens.push({
      itemId: ids[it.id], tipo: it.id, slug: it.slug, nome: it.nome, en: it.en, linhas: it.linhas, sabor: it.sabor,
      icone: rel && existsSync(`${PASTA_DOS_ICONES}/${rel}`) ? `poe-itens/Missoes/${rel}` : null, largura: it.largura, altura: it.altura,
    });
  }

  // O bônus permanente de cada missão (a aba "Missão Stats").
  const bonusDe = new Map();
  for (const b of poedb.bonus) if (b.missao) (bonusDe.get(b.missao) ?? bonusDe.set(b.missao, []).get(b.missao)).push(b.recompensa);

  const porSlug = new Map();
  for (const m of poedb.missoes) {
    const ja = porSlug.get(m.slug);
    if (ja) { if (m.ato != null && !ja.atos.includes(m.ato)) ja.atos.push(m.ato); continue; }
    porSlug.set(m.slug, { ...m, atos: m.ato != null ? [m.ato] : [] });
  }

  const missoes = [];
  for (const m of porSlug.values()) {
    const cat = categoria(m);
    const texto = sem([m.nome, m.descricao, ...m.passos.flatMap((p) => [p.titulo, p.descricao, ...p.objetivos])].join('\n'));
    const passos = m.passos.filter((p) => !/^Missão (Completa|Abandonada)/.test(p.titulo)).map((p) => {
      const fs = cat === 'campanha' && p.area ? p.area.split(/,\s*/).flatMap((a) => fasesDaArea(a, m.ato)) : [];
      const ultima = fs.sort((a, b) => a.ato - b.ato || a.ordem - b.ordem).at(-1);
      return { n: p.n, titulo: p.titulo, objetivos: p.objetivos, area: p.area, ...(ultima ? { fase: ultima.id } : {}) };
    });
    let gatilho = null;
    let semCaminho = null;
    let nota = null;
    if (cat === 'campanha') {
      // (O alvo do "Mate/Derrote" COMEÇA pelo nome do chefe: "Derrote os cultistas de Kitava" não é a luta contra o Kitava.)
      const chefe = chefes.find((c) => c.ato === m.ato && m.passos.some((p) => p.objetivos.some((o) => nomesDoChefe(c).some((n) => n && new RegExp(`^(mate|derrote)\\s+((o|a)\\s+)?${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(sem(o))))));
      const todas = passos.filter((p) => p.fase).map((p) => fases.get(p.fase)).sort((a, b) => a.ato - b.ato || a.ordem - b.ordem);
      gatilho = BANDIDOS[m.slug] ? { fases: FASES_DOS_BANDIDOS, bandido: BANDIDOS[m.slug] } : GATILHOS[m.slug] ?? (chefe ? { chefeDoAto: chefe.ato } : todas.length ? { fase: todas.at(-1).id } : null);
      if (!gatilho) semCaminho = 'Nenhuma área dos passos dessa missão é uma fase do jogo.';
    } else if (cat === 'atlas' && ATLAS[m.slug]) {
      gatilho = ATLAS[m.slug].gatilho;
      nota = ATLAS[m.slug].nota;
    } else {
      semCaminho = SEM_CAMINHO[cat];
    }

    // As recompensas: os pontos e os bônus (Missão Stats), a ESCOLHA (gemas e itens dos links) e o livro.
    const linhas = (bonusDe.get(m.slug) ?? []).flatMap((r) => r.split(/,\s*|\n/)).map((l) => l.trim()).filter(Boolean);
    let pontos = 0;
    let restituicoes = 0;
    const bonus = [];
    // A penalidade de resistência do Kitava ("-30% de todas…") a ficha já aplica pelo chefe vencido (`ficha.mjs penalidadeDeResistencia`): só aparece.
    const penalidades = [];
    for (const l of linhas) {
      const p = l.match(/^(\d+) Pontos de Habilidade Passiva$/);
      const r = l.match(/^(\d+) Pontos de Restituição de Passiva$/);
      if (p) pontos += Number(p[1]);
      else if (r) restituicoes += Number(r[1]);
      else if (/^-\d/.test(l)) penalidades.push(l);
      else bonus.push(l);
    }
    const opcoes = [];
    for (const l of m.recompensa?.links ?? []) {
      if (/^gem_/.test(l.classe)) {
        // As missões das gemas já têm a lista por classe (missoes-de-gemas.json): aqui só as que não estão lá.
        if (!deGemas.has(m.slug) && gemas[l.slug]) opcoes.push({ tipo: 'gema', id: gemas[l.slug], slug: l.slug, nome: l.nome });
      } else if (/StackableCurrency/.test(l.classe) && moedas[l.slug]) {
        opcoes.push({ tipo: 'moeda', id: moedas[l.slug], slug: l.slug, nome: l.nome });
      } else if (/^whiteitem /.test(l.classe)) {
        const base = Object.values(catalogo.classes).flatMap((c) => c.bases ?? []).find((b) => b.slug === l.slug);
        if (base) opcoes.push({ tipo: 'base', base: base.id, slug: l.slug, nome: l.nome });
      }
    }
    // Os itens da missão: os que os passos citam pelo nome.
    const daMissao = itens.filter((it) => it.nome && texto.includes(sem(it.nome)));
    // O que conclui a missão, em texto (a aba mostra).
    const nomeDaFase = (id) => areas.find((a) => a.id === id)?.nome ?? id;
    const nomeDoPinaculo = (id) => ({ 'poe-the-maven': 'a Maven', 'poe-the-elder': 'o Ancião', 'poe-the-eater-of-worlds': 'o Devorador de Mundos', 'poe-the-searing-exarch': 'o Exarca Cauterizado' })[id] ?? id;
    const comoConclui = !gatilho ? null
      : gatilho.bandido ? 'Enfrentar os três Lordes Bandidos (Ponte Quebrada, Floresta Ocidental e Terras Inundadas) e escolher: matar todos ou ajudar um.'
      : gatilho.fase ? `Completar ${nomeDaFase(gatilho.fase)} (Ato ${fases.get(gatilho.fase)?.ato}).`
      : gatilho.chefeDoAto ? `Vencer ${chefes.find((c) => c.ato === gatilho.chefeDoAto)?.nome ?? 'o chefe'} (Ato ${gatilho.chefeDoAto}).`
      : gatilho.mapas ? `Concluir ${gatilho.mapas === 1 ? 'um mapa' : `${gatilho.mapas} mapas`} no Dispositivo de Mapas.`
      : gatilho.pinaculo ? `Vencer ${nomeDoPinaculo(gatilho.pinaculo[0])}.`
      : gatilho.unicos ? `Concluir os mapas únicos: ${gatilho.unicos.map((u) => u.replace(/_/g, ' ')).join(', ')}.`
      : null;
    missoes.push({
      slug: m.slug, nome: m.nome, en: m.en, tipo: m.tipo, categoria: cat, atos: m.atos, descricao: m.descricao,
      icone: m.icone && existsSync(`${PASTA_DOS_ICONES}/${m.icone.replace(/^.*\/2DArt\//, '').replace(/\.webp$/, '.png')}`) ? `poe-itens/Missoes/${m.icone.replace(/^.*\/2DArt\//, '').replace(/\.webp$/, '.png')}` : null,
      gatilho, ...(comoConclui ? { comoConclui } : {}), ...(semCaminho ? { semCaminho } : {}), ...(nota ? { nota } : {}),
      recompensas: {
        texto: m.recompensa?.texto ?? null,
        pontos, restituicoes, bonus, penalidades,
        // (os efeitos do bônus no formato da árvore: a linha que não traduz fica sem efeito e aparece em `bonusSemEfeito`)
        efeitos: bonus.flatMap((l) => traduzirLinha(l).efeitos ?? []),
        bonusSemEfeito: bonus.filter((l) => !(traduzirLinha(l).efeitos ?? []).length),
        gemasPorClasse: deGemas.has(m.slug),
        escolha: opcoes,
      },
      itens: daMissao.map((it) => it.itemId),
      passos,
    });
  }
  return { missoes, itens, ids };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { missoes, itens, ids } = montar();
  writeFileSync(ARQ_IDS, JSON.stringify({ _nota: 'Id de ITEM de cada item de missão do PoE (o Type do poedb → id). ESTÁVEL: só cresce (a peça salva guarda o número). Gerado por tools/montar-missoes-poe.mjs; os 16 primeiros (7600001–7600016) são os de itens-de-missao.json.', ids }, null, 1) + '\n');
  writeFileSync(DESTINO, JSON.stringify({ _nota: 'O registro de missões do PoE (tools/montar-missoes-poe.mjs, de missoes-poedb.json e da campanha do jogo). Quem lê: systems/itens-poe/missoes.mjs e o cliente (a aba Missões, estático).', missoes, itens }) + '\n');
  const conta = {};
  for (const m of missoes) conta[`${m.categoria}${m.semCaminho ? ' (sem caminho)' : ''}`] = (conta[`${m.categoria}${m.semCaminho ? ' (sem caminho)' : ''}`] ?? 0) + 1;
  console.log(`missões ${missoes.length}:`, conta);
  console.log(`itens ${itens.length} (com ícone ${itens.filter((i) => i.icone).length})`);
}
