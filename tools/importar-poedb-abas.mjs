// IMPORTADOR das ABAS de cada classe de item do poedb (dono, 09/10: "quem tem cada um várias abas, entre em cada aba para extrair as coisas
// que faltam, utilizando para estudar o PoE e implementar tudo").
//
// Cada página de classe do poedb (ex.: https://poedb.tw/pt/Gloves_str) tem, além da Modifiers Calc (o pool normal, já no catálogo), as
// abas: Orbe Vaal Corrompido Implicit, BaseItem/Item, Únicos, Síntese Implicit (e Corrompido), Labirinto Encantamento, Golpe (Heist)
// Encantamento, Mesa de Criação, Ungir, Exarca/Devorador Implicit e Spread, Glimpse of Chaos, Tincture Mods, Encantar Orbe
// Incandescente/Instigante, Crucible, Harvest Seed… A COLEÇÃO é extraída com o Scrapling (fora do repositório, `/home/deploy/scrapling`:
// `extrair/baixar.py` baixa as páginas, `extrair/abas.py` grava `saida/json/<Pagina>.json`) e ESTE tool leva ao jogo o que falta:
//
//   game/gamedata/itens-poe/pools-poedb/<pool>.json — na mesma forma dos pools especiais (`pools/`):
//     - COMPLEMENTOS de pools que já existem (corrupted, synthesis, synthesis_corrupted, searing, eater): só as famílias (ou páginas
//       inteiras) que o poedb tem e o pool importado da coleção antiga não tem — `itens-poe/catalogo.mjs` `poolEspecial` junta os dois;
//     - pools NOVOS: labirinto, golpe, orbe_incandescente, orbe_instigante, vislumbre_do_caos, tintura, semente_harvest, crucible, ungir.
//   game/gamedata/itens-poe/poedb-abas.json — o MANIFESTO: cada página, cada aba, quantos itens o poedb tem, quantos o jogo tem, o que
//     falta e o estado (ok, importado, falta, operação da bancada, referência). A Engine mostra isso (aba "Abas do PoEDB").
//
// Os arquivos de `pools/` são do `tools/importar-poe-itens.mjs` (que refaz aquela pasta inteira); estes ficam numa pasta à parte para
// nenhum dos dois apagar o trabalho do outro. Uso:
//   node tools/importar-poedb-abas.mjs            → grava pools-poedb/ e o manifesto, e imprime o resumo
//   node tools/importar-poedb-abas.mjs --checar   → só o resumo
// A coleção: `POEDB_ABAS` (padrão `/home/deploy/scrapling/saida/json`).
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analisarTexto } from './importar-poe-itens.mjs';

const ORIGEM = process.env.POEDB_ABAS ?? '/home/deploy/scrapling/saida/json';
const ITENS_POE = fileURLToPath(new URL('../game/gamedata/itens-poe/', import.meta.url));
const POOLS = join(ITENS_POE, 'pools');
const DESTINO = join(ITENS_POE, 'pools-poedb');
const MANIFESTO = join(ITENS_POE, 'poedb-abas.json');
const lerJson = (arq) => JSON.parse(readFileSync(arq, 'utf8'));

/** Os pools NOVOS (que a coleção antiga não tinha): o nome e de onde vêm no PoE. */
export const POOLS_NOVOS = {
  labirinto: 'Encantamento do Labirinto (elmo, luvas, botas e cinto)',
  golpe: 'Encantamento do Golpe (Heist — armas e armaduras)',
  orbe_incandescente: 'Encantar com o Orbe Incandescente (frascos e tinturas)',
  orbe_instigante: 'Encantar com o Orbe Instigante (frascos e tinturas)',
  vislumbre_do_caos: 'Vislumbre do Caos (os mods do elmo único)',
  tintura: 'Mods das Tinturas',
  semente_harvest: 'Implícito de joia da Semente (Harvest)',
  crucible: 'Árvore de passivas da arma (Crucible)',
  ungir: 'Ungir (Óleos: notáveis em amuletos, anéis e únicos)',
};
/** Os pools que já existem em `pools/` e que o poedb pode COMPLETAR. */
const COMPLETAVEIS = ['corrupted', 'synthesis', 'synthesis_corrupted', 'searing', 'eater'];
/** O nível de área de cada Labirinto (o "iLvl" do encantamento). */
const NIVEL_DO_LABIRINTO = { 'O Labirinto': 33, 'O Labirinto Cruel': 55, 'O Labirinto Impiedoso': 68, 'O Labirinto Eterno': 75 };

/** O tipo de uma aba pelo id do poedb, e o pool do jogo para onde ela vai. */
export function tipoDaAba(id) {
  if (/VaalCorrompidoImplicit$/.test(id)) return { tipo: 'pool', pool: 'corrupted' };
  if (/S[ií]nteseImplicitCorrompido$/.test(id)) return { tipo: 'pool', pool: 'synthesis_corrupted' };
  if (/S[ií]nteseImplicit$/.test(id)) return { tipo: 'pool', pool: 'synthesis' };
  if (/SearingExarchImplicit$/.test(id)) return { tipo: 'pool', pool: 'searing' };
  if (/EaterofWorldsImplicit$/.test(id)) return { tipo: 'pool', pool: 'eater' };
  if (/Spread$/.test(id)) return { tipo: 'spread', pool: /Searing/.test(id) ? 'searing' : 'eater' };
  if (/LabEnchant$/.test(id)) return { tipo: 'tabela', pool: 'labirinto' };
  if (/Heist(Weapon|Armour)Enchant$/.test(id)) return { tipo: 'tabela', pool: 'golpe' };
  if (/EncantarOrbeIncandescente$/.test(id)) return { tipo: 'tabela', pool: 'orbe_incandescente' };
  if (/EncantarOrbeInstigante$/.test(id)) return { tipo: 'tabela', pool: 'orbe_instigante' };
  if (/GlimpseofChaosMods$/.test(id)) return { tipo: 'tabela', pool: 'vislumbre_do_caos' };
  if (/TinctureMods$/.test(id)) return { tipo: 'tabela', pool: 'tintura' };
  if (/HarvestSeedJewelImplicit$/.test(id)) return { tipo: 'tabela', pool: 'semente_harvest' };
  if (/WeaponPassive$/.test(id)) return { tipo: 'tabela', pool: 'crucible' };
  if (/^Ungir/.test(id)) return { tipo: 'tabela', pool: 'ungir' };
  if (/MesadeCria[cç][aã]o$/.test(id)) return { tipo: 'bancada', pool: 'master' };
  if (/(BaseItem|Item)$/.test(id)) return { tipo: 'bases' };
  if (/[ÚU]nicos$/.test(id)) return { tipo: 'unicos' };
  if (/^JoiaAtemporal(Passive|PassiveAdditions)$|^AlternatePassive$/.test(id)) return { tipo: 'referencia', nota: 'passivas da Joia Atemporal (as lendas) — o jogo ainda não tem encaixe de joia na árvore' };
  return { tipo: 'referencia' };
}

const norm = (t) => String(t ?? '').replace(/\s+/g, ' ').replace(/\s*—\s*/g, '—').replace(/\(\s*/g, '(').replace(/\s*\)/g, ')').replace(/\s*%/g, '%').trim().toLowerCase();
const slug = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\{\d+\}|#/g, 'N').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 80);
/** Um tier no formato dos pools. */
function tier(n, { nome = null, ilvl = null, peso = null, texto }) {
  const { modelo, faixas } = analisarTexto(texto);
  return { tier: n, nome, ilvl, peso, texto, modelo, faixas };
}
const pesoDe = (x) => {
  const m = /(\d+)/.exec(String(x ?? ''));
  return m ? Number(m[1]) : null;
};
const itens = (celula) => String(celula ?? '').split(' ¦ ').map((s) => s.trim()).filter(Boolean);

/** A classe e a página do catálogo para uma página do poedb (pelas fontes que o catálogo guarda). */
function mapaDePaginas(cat) {
  const m = new Map();
  for (const [classe, c] of Object.entries(cat.classes)) {
    for (const f of c.fontes ?? []) {
      const pag = f.replace('https://poedb.tw/pt/', '').replace('#ModifiersCalc', '');
      const sufixo = /_(str|dex|int|str_dex|str_int|dex_int|str_dex_int)$/.exec(pag);
      m.set(pag, { classe, pagina: c.grupo === 'Joias' ? pag : sufixo ? sufixo[1] : '*' });
    }
  }
  // As páginas do poedb que o catálogo não lista (a Joia Ocular Montada é base nova das joias abissais).
  if (!m.has('Assembled_Eye_Jewel')) m.set('Assembled_Eye_Jewel', { classe: 'Abyss_Jewels', pagina: 'Assembled_Eye_Jewel' });
  return m;
}

/** As famílias (grupos do .mod-title) de uma aba em grupos → o formato dos pools. A Síntese corrompida vem em tabela (classe | mods). */
function familiasDosGrupos(aba, pool) {
  const saida = [];
  for (const c of aba.cards) {
    for (const t of c.tabelas ?? []) {
      const col = t.cabecalho.findIndex((h) => /^Mods?$/.test(h));
      if (col < 0) continue;
      for (const l of t.linhas) for (const texto of itens(l[col])) saida.push({ familia: `poedb_${pool}_${slug(analisarTexto(texto).modelo)}`, lado: 'implicito', tags: [], peso: 0, ilvlMax: null, tiers: [tier(1, { texto })] });
    }
    for (const g of c.grupos ?? []) {
      const tiers = g.linhas.map((l, i) => tier(i + 1, { ilvl: typeof l.ilvl === 'number' ? l.ilvl : null, peso: typeof l.peso === 'number' ? l.peso : null, texto: itens(l.texto).join(' / ') }));
      if (!tiers.length) continue;
      saida.push({ familia: `poedb_${pool}_${slug(g.modelo)}`, lado: 'implicito', tags: g.rotulos ?? [], peso: typeof g.peso === 'number' ? g.peso : 0, ilvlMax: g.ilvl ?? null, tiers });
    }
  }
  return saida;
}

/** As famílias de uma aba em TABELA → o formato dos pools (cada pool novo tem as suas colunas). */
function familiasDaTabela(aba, pool) {
  const familias = new Map();
  const somar = (familia, lado, t, tags = []) => {
    const f = familias.get(familia) ?? { familia, lado, tags, peso: 0, ilvlMax: null, tiers: [] };
    f.tiers.push(tier(f.tiers.length + 1, t));
    f.peso += t.peso ?? 0;
    f.ilvlMax = Math.max(f.ilvlMax ?? 0, t.ilvl ?? 0) || null;
    familias.set(familia, f);
  };
  for (const c of aba.cards) {
    for (const t of c.tabelas ?? []) {
      const col = (re) => t.cabecalho.findIndex((h) => re.test(h));
      for (const l of t.linhas) {
        if (pool === 'labirinto') {
          const [nivel, nome, mod, peso] = [l[col(/^N[ií]vel$/)], l[col(/^Nome$/)], l[col(/^Mod$/)], l[col(/^Weight$/)]];
          const ilvl = NIVEL_DO_LABIRINTO[nivel] ?? (Number(nivel) || null);
          const familia = nome ? `lab_${slug(nome.replace(/^Enchantment /, '').replace(/\s*\d+$/, ''))}` : `lab_${slug(mod)}`;
          somar(familia, 'implicito', { nome: nome || nivel, ilvl, peso: pesoDe(peso), texto: itens(mod).join(' / ') });
        } else if (pool === 'golpe') {
          const [nome, nivel, desc] = [l[col(/^Nome$/)], l[col(/^N[ií]vel$/)], l[col(/^Description$/)]];
          somar(`golpe_${slug(nome)}`, 'implicito', { nome, ilvl: Number(nivel) || null, peso: null, texto: itens(desc).join(' / ') });
        } else if (pool === 'orbe_incandescente' || pool === 'orbe_instigante') {
          const [nivel, desc, peso] = [l[col(/^N[ií]vel$/)], l[col(/^Description$/)], l[col(/^Weight$/)]];
          somar(`${pool}_${slug(desc)}`, 'implicito', { nome: POOLS_NOVOS[pool].split(' (')[0], ilvl: Number(nivel) || null, peso: pesoDe(peso), texto: itens(desc).join(' / ') });
        } else if (pool === 'vislumbre_do_caos') {
          const [texto, peso, nivel] = [l[col(/^Nome$/)], l[col(/^Weight$/)], l[col(/^N[ií]vel$/)]];
          somar(`vislumbre_${slug(texto)}`, 'implicito', { nome: 'Vislumbre do Caos', ilvl: Number(nivel) || null, peso: pesoDe(peso), texto: itens(texto).join(' / ') });
        } else if (pool === 'tintura') {
          const [nome, nivel, lado, desc, peso] = [l[col(/^Nome$/)], l[col(/^N[ií]vel$/)], l[col(/^Pre\/Suf$/)], l[col(/^Description$/)], l[col(/^Weight$/)]];
          const ld = /^Prefixo/.test(lado) ? 'prefixo' : /^Sufixo/.test(lado) ? 'sufixo' : 'implicito';
          const { modelo } = analisarTexto(itens(desc).join(' / '));
          somar(`tintura_${ld}_${slug(modelo)}`, ld, { nome: nome || null, ilvl: Number(nivel) || null, peso: pesoDe(peso), texto: itens(desc).join(' / ') });
        } else if (pool === 'semente_harvest') {
          const desc = l[col(/^Description$/)] ?? l[0];
          somar(`semente_${slug(analisarTexto(desc).modelo)}`, 'implicito', { nome: 'Semente (Harvest)', ilvl: null, peso: null, texto: itens(desc).join(' / ') });
        } else if (pool === 'crucible') {
          const [peso, desc] = [l[col(/^Weight$/)], l[col(/^Desc$/)]];
          const nivel = /\(([^)]*)\)/.exec(peso ?? '')?.[1] ?? null;
          somar(`crucible_${slug(analisarTexto(desc).modelo)}`, 'implicito', { nome: nivel, ilvl: null, peso: pesoDe(peso), texto: itens(desc).join(' / ') });
        } else if (pool === 'ungir') {
          const [oleos, resultado] = [l[col(/^Items$/)], l[col(/^Result$/)]];
          const partes = itens(resultado);
          // "Nome ¦ Óleos: A, B, C ¦ efeito ¦ efeito…" (o notável) ou só "efeito" (anéis: as torres do Blight).
          const temNome = partes.length > 1 && /^Óleos:/.test(partes[1] ?? '');
          const nome = temNome ? partes[0] : null;
          const efeito = (temNome ? partes.slice(2) : partes).filter((x) => !/^\(.*\)$/.test(x));
          if (!efeito.length) continue;
          const t2 = tier(1, { nome: nome ?? oleos, ilvl: null, peso: null, texto: efeito.join(' / ') });
          t2.oleos = String(oleos ?? '').split(' / ').map((x) => x.trim()).filter(Boolean);
          const familia = `ungir_${slug(nome ?? efeito.join(' '))}`;
          const f = familias.get(familia) ?? { familia, lado: 'implicito', tags: [], peso: 0, ilvlMax: null, tiers: [] };
          if (!f.tiers.some((x) => x.texto === t2.texto)) f.tiers.push({ ...t2, tier: f.tiers.length + 1 });
          familias.set(familia, f);
        }
      }
    }
  }
  return [...familias.values()];
}

/** Os textos (normalizados) de uma página de pool. */
function textosDaPagina(pg) {
  const s = new Set();
  for (const lado of ['prefixos', 'sufixos', 'implicitos']) for (const f of pg?.[lado] ?? []) for (const t of f.tiers) s.add(norm(t.texto));
  return s;
}
const ladoDoPool = (f) => `${f.lado}s`;

/** Lê a coleção e monta `{ pools: { <pool>: { classes } }, manifesto }`. */
export function importar(origem = ORIGEM) {
  const cat = lerJson(join(ITENS_POE, 'catalogo-itens.json'));
  const pagina = mapaDePaginas(cat);
  const antigos = Object.fromEntries([...COMPLETAVEIS, 'master'].map((p) => [p, existsSync(join(POOLS, `${p}.json`)) ? lerJson(join(POOLS, `${p}.json`)) : { classes: {} }]));
  const pools = {};
  const pagDoPool = (pool, classe, pg) => {
    const p = (pools[pool] ??= { classes: {} });
    return ((p.classes[classe] ??= {})[pg] ??= { prefixos: [], sufixos: [], implicitos: [] });
  };
  const manifesto = [];
  for (const arq of readdirSync(origem).filter((f) => f.endsWith('.json')).sort()) {
    const d = lerJson(join(origem, arq));
    const onde = pagina.get(d.pagina) ?? null;
    const entrada = { pagina: d.pagina, fonte: d.fonte, classe: onde?.classe ?? null, variante: onde?.pagina ?? null, abas: [] };
    for (const aba of d.abas) {
      const t = tipoDaAba(aba.id);
      const titulo = aba.cards.find((c) => c.titulo)?.titulo ?? aba.rotulo ?? aba.id;
      const x = { id: aba.id, titulo: titulo.replace(/\s*\/\s*\d+\s*$/, ''), tipo: t.tipo, pool: t.pool ?? null, poedb: 0, jogo: 0, faltando: 0, estado: 'referencia', exemplos: [] };
      if (t.nota) x.nota = t.nota;
      if (!onde) { x.estado = 'sem-classe'; entrada.abas.push(x); continue; }
      if (t.tipo === 'pool') {
        const familias = familiasDosGrupos(aba, t.pool);
        const antigo = antigos[t.pool]?.classes?.[onde.classe]?.[onde.pagina];
        const ja = textosDaPagina(antigo);
        // Contagens em TEXTOS DISTINTOS (o poedb repete o mesmo texto em tiers de peso diferente).
        const doPoedb = new Set(familias.flatMap((f) => f.tiers.map((tt) => norm(tt.texto))));
        const novas = familias.filter((f) => !f.tiers.some((tt) => ja.has(norm(tt.texto))));
        for (const f of novas) pagDoPool(t.pool, onde.classe, onde.pagina)[ladoDoPool(f)].push(f);
        const importados = new Set(novas.flatMap((f) => f.tiers.map((tt) => norm(tt.texto)))).size;
        x.poedb = doPoedb.size;
        x.faltando = [...doPoedb].filter((tt) => !ja.has(tt)).length - importados;
        x.jogo = x.poedb - x.faltando;
        x.importados = importados;
        x.exemplos = novas.slice(0, 4).map((f) => f.tiers[0].texto);
        x.estado = importados ? 'importado' : x.faltando > 0 ? 'falta' : 'ok';
      } else if (t.tipo === 'tabela') {
        const familias = familiasDaTabela(aba, t.pool);
        for (const f of familias) pagDoPool(t.pool, onde.classe, onde.pagina)[ladoDoPool(f)].push(f);
        x.poedb = familias.reduce((n, f) => n + f.tiers.length, 0);
        x.jogo = x.poedb;
        x.importados = x.poedb;
        x.exemplos = familias.slice(0, 4).map((f) => f.tiers[0].texto);
        x.estado = x.poedb ? 'importado' : 'referencia';
      } else if (t.tipo === 'spread') {
        const tab = aba.cards[0]?.tabelas?.[0];
        x.poedb = tab?.linhas.length ?? 0;
        x.colunas = tab?.cabecalho.slice(1) ?? [];
        x.estado = 'referencia';
        x.nota = 'os degraus de cada Brasa/Icor e do Orbe do Conflito — já são os nomes dos tiers do pool eldritch';
      } else if (t.tipo === 'bancada') {
        const tab = aba.cards[0]?.tabelas?.[0];
        const ja = textosDaPagina(antigos.master?.classes?.[onde.classe]?.[onde.pagina]);
        const linhas = (tab?.linhas ?? []).map((l) => l[0]);
        // Encaixes, ligações, cores, "remover"/"recria": OPERAÇÕES da bancada (não são mods). Os "Usado quando…" são os do Orbe Instigante.
        const operacao = (s) => /encaixe|remover|recria|^usado |^reutilizado /i.test(s);
        x.poedb = linhas.length;
        x.operacoes = linhas.filter(operacao).length;
        const mods = linhas.filter((s) => !operacao(s));
        x.jogo = mods.filter((s) => ja.has(norm(s))).length;
        x.faltando = mods.length - x.jogo;
        x.exemplos = mods.filter((s) => !ja.has(norm(s))).slice(0, 4);
        x.estado = x.faltando ? 'falta' : 'ok';
        x.nota = `${x.operacoes} operações da bancada (encaixes, ligações, remover/recriar) não são mods`;
      } else if (t.tipo === 'bases') {
        const nomes = aba.cards.flatMap((c) => c.bases ?? []).map((b) => b.href);
        const locais = new Set((cat.classes[onde.classe]?.bases ?? []).map((b) => b.slug));
        x.poedb = nomes.length;
        x.jogo = nomes.filter((n) => locais.has(n)).length;
        x.faltando = x.poedb - x.jogo;
        x.exemplos = nomes.filter((n) => !locais.has(n)).slice(0, 4);
        x.estado = x.faltando ? 'falta' : 'ok';
      } else if (t.tipo === 'unicos') {
        const nomes = aba.cards.flatMap((c) => c.bases ?? []).map((b) => decodeURIComponent(String(b.href).replace(/^\/pt\//, '')));
        const locais = new Set((cat.classes[onde.classe]?.unicos ?? []).map((u) => decodeURIComponent(u.slug)));
        x.poedb = nomes.length;
        x.jogo = nomes.filter((n) => locais.has(n)).length;
        x.faltando = x.poedb - x.jogo;
        x.exemplos = nomes.filter((n) => !locais.has(n)).slice(0, 4);
        x.estado = x.faltando ? 'falta' : 'ok';
      } else {
        x.poedb = aba.cards.reduce((n, c) => n + (c.grupos?.length ?? 0) + (c.tabelas ?? []).reduce((m, tt) => m + tt.linhas.length, 0) + (c.bases?.length ?? 0), 0);
      }
      entrada.abas.push(x);
    }
    manifesto.push(entrada);
  }
  // Um pool NOVO igual em todas as variantes de atributo da classe (o Labirinto vale para qualquer elmo) fica uma vez só, em `*`
  // (`Catalogo.poolEspecialDa` cai no `*` quando a variante não tem página).
  for (const [pool, p] of Object.entries(pools)) {
    if (!(pool in POOLS_NOVOS)) continue;
    for (const [classe, pgs] of Object.entries(p.classes)) {
      const lista = Object.values(pgs);
      if (lista.length > 1 && lista.every((x) => JSON.stringify(x) === JSON.stringify(lista[0]))) p.classes[classe] = { '*': lista[0] };
    }
  }
  // Conta famílias e tiers de cada pool.
  for (const p of Object.values(pools)) {
    p.familias = 0;
    p.tiers = 0;
    for (const pgs of Object.values(p.classes)) for (const pg of Object.values(pgs)) for (const f of [...pg.prefixos, ...pg.sufixos, ...pg.implicitos]) { p.familias++; p.tiers += f.tiers.length; }
  }
  return { pools, manifesto: { geradoEm: new Date().toISOString(), fonte: 'poedb.tw/pt — as abas de cada classe, extraídas com o Scrapling (tools/importar-poedb-abas.mjs)', paginas: manifesto } };
}

/** Grava `pools-poedb/` (refeita) e o manifesto. */
export function gravar({ pools, manifesto }) {
  rmSync(DESTINO, { recursive: true, force: true });
  mkdirSync(DESTINO, { recursive: true });
  const resumo = {};
  for (const [pool, x] of Object.entries(pools).sort(([a], [b]) => a.localeCompare(b))) {
    const novo = pool in POOLS_NOVOS;
    const arq = join(DESTINO, `${pool}.json`);
    const nome = novo ? POOLS_NOVOS[pool] : `complemento de "${pool}"`;
    const corpo = { _nota: `${novo ? 'Pool' : 'Complemento do pool'} do PoE "${pool}" (${nome}), das abas do poedb — tools/importar-poedb-abas.mjs.${novo ? '' : ' Só o que pools/' + pool + '.json não tem; itens-poe/catalogo.mjs junta os dois.'}`, pool, nome, origem: 'poedb-abas', complemento: !novo, familias: x.familias, tiers: x.tiers, classes: x.classes };
    writeFileSync(arq, JSON.stringify(corpo));
    resumo[pool] = { familias: x.familias, tiers: x.tiers, bytes: statSync(arq).size, complemento: !novo };
  }
  writeFileSync(MANIFESTO, JSON.stringify(manifesto));
  return resumo;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!existsSync(ORIGEM)) {
    console.error(`Coleção não encontrada em ${ORIGEM} (defina POEDB_ABAS; extraia com /home/deploy/scrapling/extrair/abas.py).`);
    process.exit(1);
  }
  const r = importar();
  const porEstado = {};
  for (const p of r.manifesto.paginas) for (const a of p.abas) porEstado[a.estado] = (porEstado[a.estado] ?? 0) + 1;
  console.log(`páginas ${r.manifesto.paginas.length} · abas por estado: ${Object.entries(porEstado).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  for (const [pool, x] of Object.entries(r.pools)) console.log(`  ${pool.padEnd(20)} ${x.familias} famílias / ${x.tiers} tiers${pool in POOLS_NOVOS ? '' : ' (complemento)'}`);
  if (!process.argv.includes('--checar')) {
    const g = gravar(r);
    const total = Object.values(g).reduce((n, x) => n + x.bytes, 0);
    console.log(`gravado: ${DESTINO} (${Object.keys(g).length} pools, ${(total / 1e6).toFixed(1)} MB) e ${MANIFESTO} (${(statSync(MANIFESTO).size / 1e3).toFixed(0)} KB)`);
  }
}
