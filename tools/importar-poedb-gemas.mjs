// IMPORTADOR das GEMAS do poedb (dono, 09/10: "mapeie https://poedb.tw/pt/Skill_Gems e suas abas e https://poedb.tw/pt/Support_Gems e suas
// abas; ao entrar em cada gema verifique tudo — a missão, o level effect e a imagem tanto da gema quanto da skill que vai ficar na barra de
// slot — e confronte"; "a ideia é colocar todas as gemas para funcionar, visualmente e também efetivamente").
//
// A COLEÇÃO (Scrapling, /home/deploy/scrapling): as páginas de cada gema (`extrair/baixar.py`), extraídas por `extrair/gemas.py` em
// `saida/gemas/<Pagina>.json`, e as imagens por `extrair/icones-gemas.py` (`saida/icones-habilidades/`, `saida/icones-gemas/`). Este tool:
//   - copia o ÍCONE DA HABILIDADE de cada gema para `game/gamedata/itens-poe/icones-habilidades/` e grava o mapa `icones-habilidades.json`
//     (slug → arquivo): a barra de slots desenha com ele (`gemas-poe` → `poeGema.iconeHabilidade` → `actionbar.actionIcon`);
//   - grava o MANIFESTO `game/gamedata/itens-poe/poedb-gemas.json`: cada gema do poedb (ativa, suporte, desperta) × a do jogo — existe,
//     nome, tags, propriedades, mods, qualidade, a tabela por nível (célula a célula), a missão (recompensa/vendedor por classe) e as imagens.
// Uso: node tools/importar-poedb-gemas.mjs [--checar]
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, copyFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGEM = process.env.POEDB_SCRAPLING ?? '/home/deploy/scrapling/saida';
const ITENS_POE = fileURLToPath(new URL('../game/gamedata/itens-poe/', import.meta.url));
const ICONES = join(ITENS_POE, 'icones-habilidades');
const lerJson = (arq) => JSON.parse(readFileSync(arq, 'utf8'));

/** As classes do PoE como o poedb em português escreve → o slug do jogo. */
const CLASSE = { Duelista: 'Duelist', Marauder: 'Marauder', 'Caçadora': 'Ranger', Herdeira: 'Scion', Bruxa: 'Witch', 'Templário': 'Templar', Sombra: 'Shadow' };
const norm = (t) => String(t ?? '').replace(/[\u3164\u115f\u1160]/g, '').replace(/\s+\/\s+/g, ' ').replace(/([+-])\s+(?=\d)/g, '$1').replace(/\s*—\s*/g, '—').replace(/\s*%/g, '%').replace(/\(\s*/g, '(').replace(/\s*\)/g, ')').replace(/\s+/g, ' ').trim().toLowerCase();
const numero = (t) => String(t ?? '').replace(/,/g, '').trim();

function comparar(lista1, lista2) {
  const a = (lista1 ?? []).map(norm).filter(Boolean);
  const b = (lista2 ?? []).map(norm).filter(Boolean);
  const sb = new Set(b);
  const sa = new Set(a);
  return { iguais: a.length === b.length && a.every((x) => sb.has(x)), soNoPoedb: a.filter((x) => !sb.has(x)), soNoJogo: b.filter((x) => !sa.has(x)) };
}

/** A tabela por nível: as colunas e as células (números sem separador de milhar). */
function compararNiveis(poedb, jogo) {
  if (!poedb) return null;
  const linhasP = poedb.linhas ?? [];
  const linhasJ = jogo?.linhas ?? [];
  let diferentes = 0;
  const exemplos = [];
  const n = Math.min(linhasP.length, linhasJ.length);
  for (let i = 0; i < n; i++) {
    const p = linhasP[i].map(numero);
    const j = linhasJ[i].map(numero);
    if (p.length !== j.length || p.some((x, k) => norm(x) !== norm(j[k]))) {
      diferentes++;
      if (exemplos.length < 2) exemplos.push({ nivel: p[0], poedb: p.join(' | '), jogo: j.join(' | ') });
    }
  }
  return { colunasPoedb: poedb.cabecalho, colunasJogo: jogo?.colunas ?? [], niveisPoedb: linhasP.length, niveisJogo: linhasJ.length, diferentes, exemplos };
}

/** As origens da gema pela tabela "Missão" do poedb: recompensa (Quest Reward) ou vendedor (o NPC), com as classes. */
function origensDoPoedb(card) {
  const t = card?.tabelas?.[0];
  if (!t) return [];
  const iA = t.cabecalho.indexOf('Act');
  const iM = t.cabecalho.indexOf('Missão');
  const iN = t.cabecalho.indexOf('NPC');
  const iP = t.cabecalho.indexOf('Personagem');
  return t.linhas.map((l) => ({ ato: Number(l[iA]) || null, missao: l[iM], tipo: /Quest Reward/i.test(l[iN] ?? '') ? 'recompensa' : 'vendedor', npc: /Quest Reward/i.test(l[iN] ?? '') ? null : l[iN], classes: String(l[iP] ?? '').split('·').map((c) => CLASSE[c.trim()]).filter(Boolean).sort() }));
}
const chaveDaOrigem = (o) => `${o.tipo}|${o.ato}|${norm(o.missao)}|${o.classes.join(',')}`;
/**
 * As origens por (tipo, ato, missão): FALTA no jogo a classe que o poedb lista e o jogo não; SÓ NO JOGO a classe que o jogo lista e o poedb
 * não (no vendedor, a classe da recompensa da mesma missão não conta — o poedb ora inclui, ora não).
 */
function compararOrigens(origensP, origensJ) {
  const chave = (o) => `${o.tipo}|${o.ato}|${norm(o.missao)}`;
  const juntar = (lista) => { const m = new Map(); for (const o of lista) { const x = m.get(chave(o)) ?? { ...o, classes: [] }; x.classes = [...new Set([...x.classes, ...o.classes])].sort(); m.set(chave(o), x); } return m; };
  const P = juntar(origensP);
  const J = juntar(origensJ);
  const recompensaDe = (m, o) => new Set(m.get(`recompensa|${o.ato}|${norm(o.missao)}`)?.classes ?? []);
  const faltamNoJogo = [];
  const soNoJogo = [];
  for (const [k, o] of P) { const cs = o.classes.filter((c) => !(J.get(k)?.classes ?? []).includes(c)); if (cs.length) faltamNoJogo.push({ ...o, classes: cs }); }
  for (const [k, o] of J) { const r = o.tipo === 'vendedor' ? recompensaDe(P, o) : new Set(); const cs = o.classes.filter((c) => !(P.get(k)?.classes ?? []).includes(c) && !r.has(c)); if (cs.length) soNoJogo.push({ ...o, classes: cs }); }
  return { poedb: origensP, jogo: origensJ, faltamNoJogo, soNoJogo };
}
/** No vendedor, o jogo lista também as classes que ganham a gema de recompensa na mesma missão; o poedb não — tira-se para comparar. */
function semAsDaRecompensa(origens) {
  return origens.map((o) => {
    if (o.tipo !== 'vendedor') return o;
    const daRecompensa = new Set(origens.filter((x) => x.tipo === 'recompensa' && x.ato === o.ato && norm(x.missao) === norm(o.missao)).flatMap((x) => x.classes));
    return { ...o, classes: o.classes.filter((c) => !daRecompensa.has(c)) };
  }).filter((o) => o.classes.length);
}
/** A gema TRANSFIGURADA ("Cutilada da Fúria" = Cleave_of_Rage): no PoE não sai de missão nem de vendedor (o poedb repete a da base). */
const ehTransfigurada = (slug, existe) => /_of_/.test(slug) && existe(slug.split('_of_')[0]);
/**
 * A tabela por nível do poedb no formato do jogo: "Requer Nível" → "RequerNível"; a célula de dois números "21 31" → "21, 31". O
 * cabeçalho que EQUIVALE a um da tabela do jogo fica com o texto EXATO do jogo (o leitor dos suportes casa a coluna com o mod pelo texto:
 * o poedb escreve "35 % menos" e "- 49 %", o jogo "35% menos" e "-49%"); a coluna nova entra sem os espaços sobrando.
 */
const limparCabecalho = (c) => String(c).replace(/(\d)\s+%/g, '$1%').replace(/(^|\s)([+-])\s+(?=\d)/g, '$1$2').replace(/\s+/g, ' ').trim();
function tabelaParaOJogo(t, antigas = []) {
  const colunas = t.cabecalho.map((c) => {
    const base = c === 'Requer Nível' ? 'RequerNível' : limparCabecalho(c);
    return antigas.find((a) => norm(a) === norm(base) || norm(a) === norm(c)) ?? base;
  });
  const linhas = t.linhas.map((l) => l.map((v) => (/^-?[\d.]+%?(\s+-?[\d.]+%?)+$/.test(String(v).trim()) ? String(v).trim().split(/\s+/).join(', ') : v)));
  return { colunas, linhas };
}
const niveisP = (p) => p.cards?.['Level Effect']?.tabelas?.find((t) => t.cabecalho.includes('Nível')) ?? null;
/** A tabela do poedb vai para o jogo quando tem ao menos os níveis e TODAS as colunas da do jogo (não perde nada). */
function sincronizar(niveis, naoSincronizadas, slug, t, j) {
  if (!t?.linhas?.length) return false;
  const nova = tabelaParaOJogo(t, j.colunas ?? []);
  const faltam = (j.colunas ?? []).filter((c) => !nova.colunas.some((x) => norm(x) === norm(c)));
  if (nova.linhas.length < (j.linhas?.length ?? 0) || faltam.length) {
    naoSincronizadas.push({ slug, motivo: faltam.length ? `colunas só no jogo: ${faltam.join(', ')}` : 'menos níveis no poedb' });
    return false;
  }
  niveis[slug] = nova;
  return true;
}

export function importar(origem = ORIGEM) {
  const pasta = join(origem, 'gemas');
  const gemas = lerJson(join(ITENS_POE, 'gemas-poe.json'));
  const suportes = lerJson(join(ITENS_POE, 'suportes-poe.json'));
  const doJogo = new Map([...(Array.isArray(gemas) ? gemas : Object.values(gemas)).map((g) => [g.slug, { ...g, tipo: 'ativa' }]), ...(Array.isArray(suportes) ? suportes : Object.values(suportes)).map((g) => [g.slug, { ...g, tipo: 'suporte' }])]);
  const origemDasGemas = lerJson(join(ITENS_POE, 'origem-das-gemas.json'));
  const origensDoJogo = new Map(Object.values(origemDasGemas.gemas ?? {}).map((g) => [g.slug, g.origens ?? []]));
  const listas = existsSync('/home/deploy/scrapling/extrair/gemas-paginas.json') ? lerJson('/home/deploy/scrapling/extrair/gemas-paginas.json') : {};
  const tipoDaPagina = new Map([...(listas.GemasdeHabilidades ?? []).map((s) => [s, 'ativa']), ...(listas.GemasdeSuporte ?? []).map((s) => [s, 'suporte']), ...(listas.Awakened ?? []).map((s) => [s, 'desperta'])]);
  const manifesto = [];
  const icones = {};
  const tabelas = {};
  const naoSincronizadas = [];
  for (const arq of readdirSync(pasta).filter((f) => f.endsWith('.json')).sort()) {
    const p = lerJson(join(pasta, arq));
    const slug = p.pagina;
    const j = doJogo.get(slug) ?? null;
    const tags = (p.propriedades?.[0] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const niveis = p.cards?.['Level Effect']?.tabelas?.find((t) => t.cabecalho.includes('Nível')) ?? null;
    const transfigurada = ehTransfigurada(slug, (b) => doJogo.has(b));
    const origensP = transfigurada ? [] : origensDoPoedb(p.cards?.['Missão']);
    const origensJ = transfigurada ? [] : (origensDoJogo.get(slug) ?? []).map((o) => ({ ato: o.ato, missao: o.nomeDaMissao, tipo: o.tipo, classes: [...(o.classes ?? [])].sort() }));
    if (j) sincronizar(tabelas, naoSincronizadas, slug, niveisP(p), j);
    const chavesJ = new Set(origensJ.map(chaveDaOrigem));
    const chavesP = new Set(origensP.map(chaveDaOrigem));
    const arqIcone = p.iconeHabilidade ? p.iconeHabilidade.split('/').pop() : null;
    if (arqIcone && existsSync(join(origem, 'icones-habilidades', arqIcone))) icones[slug] = arqIcone;
    manifesto.push({
      slug,
      nome: String(p.nome ?? '').replace(/^Suporte:\s*/, ''),
      tipo: tipoDaPagina.get(slug) ?? (j?.tipo ?? (/_Support$/.test(slug) ? 'suporte' : 'ativa')),
      fonte: p.fonte,
      noJogo: !!j,
      ...(transfigurada ? { transfigurada: true } : {}),
      iconeGema: p.iconeGema ?? null,
      iconeHabilidade: arqIcone,
      comparacao: j ? {
        nome: norm(String(p.nome ?? '').replace(/^Suporte:\s*/, '')) === norm(j.nome),
        tags: comparar(tags, j.tags),
        propriedades: comparar((p.propriedades ?? []).slice(1), j.props),
        mods: comparar(p.mods, j.mods),
        qualidade: comparar(p.qualidade, j.qualidade),
        niveis: compararNiveis(niveis, j),
        missao: compararOrigens(origensP, origensJ),
      } : null,
      abas: Object.values(p.abas ?? {}),
    });
  }
  return { manifesto: { geradoEm: new Date().toISOString(), fonte: 'poedb.tw/pt — Skill_Gems, Support_Gems e a página de cada gema (Scrapling; tools/importar-poedb-gemas.mjs)', gemas: manifesto, naoSincronizadas }, icones, niveis: tabelas };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { manifesto, icones, niveis } = importar();
  console.log(`tabelas por nível do poedb para o jogo: ${Object.keys(niveis).length} · não sincronizadas: ${manifesto.naoSincronizadas.length}${manifesto.naoSincronizadas.length ? ` (ex.: ${manifesto.naoSincronizadas.slice(0, 3).map((x) => `${x.slug} — ${x.motivo}`).join('; ')})` : ''}`);
  const g = manifesto.gemas;
  const conta = (f) => g.filter(f).length;
  console.log(`gemas ${g.length} (ativas ${conta((x) => x.tipo === 'ativa')}, suportes ${conta((x) => x.tipo === 'suporte')}, despertas ${conta((x) => x.tipo === 'desperta')}) · no jogo ${conta((x) => x.noJogo)} · com ícone de habilidade ${Object.keys(icones).length}`);
  const c = g.filter((x) => x.comparacao);
  console.log(`diferenças: nome ${conta((x) => x.comparacao && !x.comparacao.nome)} · tags ${conta((x) => x.comparacao && !x.comparacao.tags.iguais)} · propriedades ${conta((x) => x.comparacao && !x.comparacao.propriedades.iguais)} · mods ${conta((x) => x.comparacao && !x.comparacao.mods.iguais)} · qualidade ${conta((x) => x.comparacao && !x.comparacao.qualidade.iguais)} · níveis ${conta((x) => x.comparacao?.niveis && (x.comparacao.niveis.diferentes || x.comparacao.niveis.niveisPoedb !== x.comparacao.niveis.niveisJogo))} · missão ${conta((x) => x.comparacao && (x.comparacao.missao.faltamNoJogo.length || x.comparacao.missao.soNoJogo.length))} (de ${c.length})`);
  if (!process.argv.includes('--checar')) {
    mkdirSync(ICONES, { recursive: true });
    for (const arq of new Set(Object.values(icones))) copyFileSync(join(ORIGEM, 'icones-habilidades', arq), join(ICONES, arq));
    writeFileSync(join(ITENS_POE, 'icones-habilidades.json'), JSON.stringify({ _nota: 'O ícone da HABILIDADE de cada gema (a barra de slots, como no PoE): slug → arquivo em icones-habilidades/ (tools/importar-poedb-gemas.mjs, das páginas do poedb).', icones }, null, 1));
    writeFileSync(join(ITENS_POE, 'poedb-gemas.json'), JSON.stringify(manifesto));
    writeFileSync(join(ITENS_POE, 'gemas-niveis-poedb.json'), JSON.stringify({ _nota: 'A tabela por nível (Level Effect) de cada gema e suporte pelo poedb (tools/importar-poedb-gemas.mjs): systems/itens-poe/gemas-niveis.mjs troca a da coleção por esta ao carregar.', niveis }));
    console.log(`gravado: poedb-gemas.json (${(statSync(join(ITENS_POE, 'poedb-gemas.json')).size / 1e6).toFixed(2)} MB), icones-habilidades/ (${new Set(Object.values(icones)).size} arquivos)`);
  }
}
