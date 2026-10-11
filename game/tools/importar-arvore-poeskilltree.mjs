// Os ÍCONES e as MOLDURAS dos nós da árvore de passivas do PoE (dono, 11/10: "a árvore toda, usa scraping para pegar os assets dos nodes",
// https://poeskilltree.com/?v=3.25.0). Lê o que o Scrapling raspou do poeskilltree.com (`/home/deploy/scrapling/extrair/poeskilltree.py`:
// o SkillTree.json da versão e as folhas de sprites do maior zoom) e grava no repositório:
//   - `gamedata/itens-poe/arvore-sprites/<folha>`: as FOLHAS que os nós usam (ícone ativo e inativo de pequeno/notável/keystone, os três
//     estados da maestria e as molduras) — o jogo desenha recortando delas, como o site (`/api/jogo/poe/icone/arvore/<folha>`);
//   - `gamedata/itens-poe/arvore-sprites.json`: as coordenadas de cada ícone usado e, por nó da árvore do jogo, qual ícone (`nos`) e
//     quais são encaixes de joia (`joias`, só a moldura), os fundos dos grupos (`grupos`) e a arte das classes (`classes`). O servidor junta na árvore (`systems/passivas/arvore.mjs`).
// Os nós que a 3.25.0 do site ainda não tem (vieram depois, os textos do jogo são da 3.29) usam o ícone da árvore do poedb (3.29); se ele
// não está nas folhas, vai o ícone avulso do CDN do poedb (`arvore-sprites/avulsos/`, 64×64).
// (11/10, dono: "coloque os fundos dos grupos e a arte das classes") Também os FUNDOS DOS GRUPOS (`grupos`, na posição da árvore do poedb —
// a do jogo) e a ARTE DAS CLASSES (`classes`: o fundo de todo início, o medalhão da classe e a ilustração grande dela, do CDN do poedb).
//
// Uso (na pasta game/): node tools/importar-arvore-poeskilltree.mjs
//   POESKILLTREE=<pasta da versão raspada>  (padrão /home/deploy/scrapling/saida/poeskilltree/3.25.0)
//   POEDB_ARVORE=<árvore do poedb 3.29>     (padrão /home/deploy/scrapling/saida/arvore/arvore-poedb-3.29-pt.json)
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGEM = process.env.POESKILLTREE ?? '/home/deploy/scrapling/saida/poeskilltree/3.25.0';
const POEDB = process.env.POEDB_ARVORE ?? '/home/deploy/scrapling/saida/arvore/arvore-poedb-3.29-pt.json';
const PASTA = fileURLToPath(new URL('../gamedata/itens-poe/arvore-sprites/', import.meta.url));
const DESTINO = new URL('../gamedata/itens-poe/arvore-sprites.json', import.meta.url);
const ARVORE_DO_JOGO = new URL('../gamedata/itens-poe/arvore-poe.json', import.meta.url);
const AGENTE = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36 DraevorIdle';
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// Os tipos de sprite que os nós usam (o nome é o do SkillTree.json da GGG).
const TIPOS_DE_ICONE = { small: ['normalActive', 'normalInactive'], notable: ['notableActive', 'notableInactive'], keystone: ['keystoneActive', 'keystoneInactive'] };
const TIPOS_DA_MAESTRIA = ['mastery', 'masteryConnected', 'masteryActiveSelected'];
const CAMPOS_DA_MAESTRIA = ['icon', 'inactiveIcon', 'activeIcon'];
const MOLDURAS = [
  'PSSkillFrame', 'PSSkillFrameHighlighted', 'PSSkillFrameActive',
  'NotableFrameUnallocated', 'NotableFrameCanAllocate', 'NotableFrameAllocated',
  'KeystoneFrameUnallocated', 'KeystoneFrameCanAllocate', 'KeystoneFrameAllocated',
  'JewelFrameUnallocated', 'JewelFrameCanAllocate', 'JewelFrameAllocated',
];
/** A chave curta de um ícone: `Art/2DArt/SkillIcons/passives/manaregeneration.png` → `manaregeneration`. */
export const chaveDoIcone = (caminho) => String(caminho ?? '').replace(/^Art\/2DArt\/SkillIcons\/passives\//, '').replace(/\.png$/i, '');

const st = JSON.parse(readFileSync(join(ORIGEM, 'SkillTree.json'), 'utf8'));
const { versao, zoom, fonte } = JSON.parse(readFileSync(join(ORIGEM, 'folhas.json'), 'utf8'));
const poedbTudo = existsSync(POEDB) ? JSON.parse(readFileSync(POEDB, 'utf8')) : null;
const poedb = poedbTudo?.nodes ?? {};
const jogo = JSON.parse(readFileSync(ARVORE_DO_JOGO, 'utf8'));
const sprite = (tipo) => st.sprites[tipo]?.[zoom];
const arquivoDa = (tipo) => sprite(tipo).filename.split('/').pop().split('?')[0];

const coords = {};
const usar = (tipo, caminho, chave = chaveDoIcone(caminho)) => {
  const c = sprite(tipo)?.coords?.[caminho];
  if (!c) return false;
  (coords[tipo] ??= {})[chave] = [c.x, c.y, c.w, c.h];
  return true;
};
const nos = {};
const joias = [];
const avulsos = {};
const relatorio = { nos: 0, daVersao: 0, doPoedb: 0, avulsos: 0, joias: 0, semIcone: [] };
for (const n of jogo.nos) {
  if (n.ascendencia || n.tipo === 'start') continue; // as ascendências já têm a arte própria (`icone`); o início, o desenho do jogo
  relatorio.nos++;
  const s = st.nodes[n.id];
  const p = poedb[n.id];
  const fonteDoNo = s ?? p;
  if (!fonteDoNo) { relatorio.semIcone.push(`${n.id} ${n.nome}`); continue; }
  if (s) relatorio.daVersao++;
  else relatorio.doPoedb++;
  if (fonteDoNo.isJewelSocket) { joias.push(n.id); relatorio.joias++; continue; }
  if (fonteDoNo.isMastery || n.tipo === 'mastery') {
    const chaves = CAMPOS_DA_MAESTRIA.map((k) => fonteDoNo[k]);
    if (chaves.every((c, i) => usar(TIPOS_DA_MAESTRIA[i], c))) nos[n.id] = chaves.map(chaveDoIcone);
    else relatorio.semIcone.push(`${n.id} ${n.nome} (maestria)`);
    continue;
  }
  const tipos = TIPOS_DE_ICONE[n.tipo];
  if (!tipos) { relatorio.semIcone.push(`${n.id} ${n.nome} (${n.tipo})`); continue; }
  const chave = chaveDoIcone(fonteDoNo.icon);
  if (tipos.map((t) => usar(t, fonteDoNo.icon)).every(Boolean)) nos[n.id] = chave;
  else {
    // Fora das folhas da versão: o ícone avulso do poedb (o mesmo caminho, em webp).
    avulsos[chave] = `avulsos/${chave.replace(/\//g, '_')}.webp`;
    nos[n.id] = chave;
    relatorio.avulsos++;
  }
}
for (const m of MOLDURAS) if (!usar('frame', m, m)) throw new Error(`moldura ${m} não está na folha frame da ${versao}`);

// Os FUNDOS DOS GRUPOS: a posição e o fundo de cada grupo vêm da árvore do poedb (3.29) — a mesma do jogo: as posições dos 2.399 nós batem
// todas, e 9 grupos da 3.25 do site mudaram de lugar depois; sem ela, os da versão do site. A arte, da folha do site. Cada grupo:
// [x, y, fundo, meio] — o fundo "meio" (PSGroupBackground3) desenha a metade de cima e a mesma girada 180° embaixo, como o site.
const principais = new Set(jogo.nos.filter((n) => !n.ascendencia).map((n) => n.id));
if (!poedbTudo?.groups) console.warn(`sem a árvore do poedb (${POEDB}): os grupos saem da ${versao} do site`);
const grupos = [];
for (const g of Object.values(poedbTudo?.groups ?? st.groups)) {
  const f = g.background;
  if (!f?.image || !(g.nodes ?? []).some((id) => principais.has(String(id)))) continue;
  if (!usar('groupBackground', f.image, f.image)) throw new Error(`fundo ${f.image} não está na folha da ${versao}`);
  grupos.push([Math.round(g.x + (f.offsetX ?? 0)), Math.round(g.y + (f.offsetY ?? 0)), f.image, f.isHalfImage ? 1 : 0]);
}

// A ARTE DAS CLASSES: em todo início de classe, o fundo do PoE (PSStartNodeBackgroundInactive); no da classe do jogador, o medalhão dela
// (center<classe>) e a ILUSTRAÇÃO grande (BaseClassIllustrations — a folha do site não tem: vem do CDN do poedb, em resolução cheia, para
// `arvore-sprites/classes/`), com o canto de cima à esquerda onde o PoE diz (`extraImages`, em unidades da árvore). A Herdeira não tem.
const ATRIBUTO_DA_CLASSE = { Marauder: 'Str', Ranger: 'Dex', Witch: 'Int', Duelist: 'StrDex', Templar: 'StrInt', Shadow: 'DexInt' };
if (!usar('startNode', 'PSStartNodeBackgroundInactive', 'PSStartNodeBackgroundInactive')) throw new Error(`o fundo do início não está na folha da ${versao}`);
const extras = Object.values(poedbTudo?.extraImages ?? st.extraImages ?? {});
const classes = {};
for (const n of jogo.nos.filter((x) => x.tipo === 'start' && !x.ascendencia)) {
  const centro = `center${String(n.classe).toLowerCase()}`;
  if (!usar('startNode', centro, centro)) throw new Error(`o medalhão ${centro} não está na folha da ${versao}`);
  const atr = ATRIBUTO_DA_CLASSE[n.classe];
  const extra = atr && extras.find((e) => String(e.image).endsWith(`/${atr}.png`));
  classes[n.classe] = { centro, ...(extra ? { ilustracao: `classes/${atr}.webp`, x: Math.round(extra.x), y: Math.round(extra.y) } : {}) };
}

// As folhas (só as que os nós usam), com o nome do site (o "-3" é o zoom): o que sobrou de uma importação anterior sai.
const tipos = {};
for (const t of Object.keys(coords)) tipos[t] = arquivoDa(t);
const folhas = {};
mkdirSync(PASTA, { recursive: true });
const manter = new Set(Object.values(tipos));
for (const f of readdirSync(PASTA, { withFileTypes: true })) if (f.isFile() && !manter.has(f.name)) rmSync(join(PASTA, f.name));
for (const arquivo of manter) {
  copyFileSync(join(ORIGEM, 'assets', arquivo), join(PASTA, arquivo));
  const t = Object.keys(tipos).find((k) => tipos[k] === arquivo);
  folhas[arquivo] = { w: sprite(t).w, h: sprite(t).h };
}

// Os avulsos: do CDN do poedb (o mesmo de tools/baixar-ascendencias-poedb.mjs). O que já existe é pulado.
mkdirSync(join(PASTA, 'avulsos'), { recursive: true });
const erros = [];
for (const [chave, relativo] of Object.entries(avulsos)) {
  const alvo = join(PASTA, relativo);
  if (existsSync(alvo)) continue;
  const url = `https://cdn.poedb.tw/image/Art/2DArt/SkillIcons/passives/${chave}.webp`;
  let r = null;
  for (let tentativa = 1; tentativa <= 3 && !r?.ok; tentativa++) {
    await esperar(300 * tentativa);
    r = await fetch(url, { headers: { 'user-agent': AGENTE, referer: 'https://poedb.tw/pt/Passive_Skill_Tree', accept: 'image/webp,image/*,*/*' } }).catch(() => null);
  }
  if (!r?.ok) { erros.push(`${chave} (${r?.status ?? 'sem resposta'})`); delete avulsos[chave]; continue; }
  writeFileSync(alvo, Buffer.from(await r.arrayBuffer()));
}
// As ilustrações das classes (o mesmo CDN). A largura e a altura saem do cabeçalho do webp (VP8X).
mkdirSync(join(PASTA, 'classes'), { recursive: true });
for (const [classe, c] of Object.entries(classes)) {
  if (!c.ilustracao) continue;
  const alvo = join(PASTA, c.ilustracao);
  if (!existsSync(alvo)) {
    const atr = c.ilustracao.replace(/^classes\//, '').replace(/\.webp$/, '');
    let r = null;
    for (let tentativa = 1; tentativa <= 3 && !r?.ok; tentativa++) {
      await esperar(300 * tentativa);
      r = await fetch(`https://cdn.poedb.tw/image/Art/2DArt/BaseClassIllustrations/${atr}.webp`, { headers: { 'user-agent': AGENTE, referer: 'https://poedb.tw/pt/Passive_Skill_Tree', accept: 'image/webp,image/*,*/*' } }).catch(() => null);
    }
    if (!r?.ok) { erros.push(`ilustração ${classe} (${r?.status ?? 'sem resposta'})`); delete c.ilustracao; continue; }
    writeFileSync(alvo, Buffer.from(await r.arrayBuffer()));
  }
  const b = readFileSync(alvo);
  if (b.toString('latin1', 12, 16) !== 'VP8X') throw new Error(`${c.ilustracao}: webp sem cabeçalho VP8X`);
  c.l = 1 + b.readUIntLE(24, 3);
  c.a = 1 + b.readUIntLE(27, 3);
}
if (erros.length) {
  for (const [id, c] of Object.entries(nos)) if (typeof c === 'string' && !coords.normalActive?.[c] && !coords.notableActive?.[c] && !coords.keystoneActive?.[c] && !avulsos[c]) delete nos[id];
  console.warn(`ícones avulsos que falharam: ${erros.join(', ')}`);
}

const saida = {
  _nota: `Os ícones e as molduras dos nós da árvore de passivas do PoE, raspados do poeskilltree.com (${versao}, zoom ${zoom}) por tools/importar-arvore-poeskilltree.mjs. "folhas": as folhas de sprites em arvore-sprites/ (servidas em /api/jogo/poe/icone/arvore/); "tipos": a folha de cada tipo de sprite; "coords": [x, y, l, a] de cada ícone usado (a chave é o caminho do PoE sem "Art/2DArt/SkillIcons/passives/" e ".png") e das molduras; "nos": o ícone de cada nó (a maestria: [sem ligação, ligada, escolhida]); "joias": os encaixes de joia (só a moldura); "avulsos": os ícones fora das folhas (nós posteriores à ${versao}, do CDN do poedb); "grupos": [x, y, fundo, meio] de cada grupo com fundo (a posição da árvore do poedb, a do jogo; meio = a metade de cima, repetida girada embaixo); "classes": o medalhão (center<classe>) e a ilustração grande de cada classe (classes/<atributo>.webp, do CDN do poedb: o canto de cima à esquerda em x, y e o tamanho l × a, em unidades da árvore).`,
  versao,
  zoom: Number(zoom),
  fonte,
  folhas,
  tipos,
  coords,
  avulsos,
  nos,
  joias,
  grupos,
  classes,
};
writeFileSync(DESTINO, JSON.stringify(saida) + '\n');
console.log(JSON.stringify({ ...relatorio, semIcone: relatorio.semIcone.length, comIcone: Object.keys(nos).length, grupos: grupos.length, ilustracoes: Object.values(classes).filter((c) => c.ilustracao).length, folhas: Object.keys(folhas) }), '→', DESTINO.pathname);
if (relatorio.semIcone.length) console.log('sem ícone:', relatorio.semIcone.join('; '));
