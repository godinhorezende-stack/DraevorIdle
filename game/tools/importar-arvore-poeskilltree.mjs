// Os ÍCONES e as MOLDURAS dos nós da árvore de passivas do PoE (dono, 11/10: "a árvore toda, usa scraping para pegar os assets dos nodes",
// https://poeskilltree.com/?v=3.25.0). Lê o que o Scrapling raspou do poeskilltree.com (`/home/deploy/scrapling/extrair/poeskilltree.py`:
// o SkillTree.json da versão e as folhas de sprites do maior zoom) e grava no repositório:
//   - `gamedata/itens-poe/arvore-sprites/<folha>`: as FOLHAS que os nós usam (ícone ativo e inativo de pequeno/notável/keystone, os três
//     estados da maestria e as molduras) — o jogo desenha recortando delas, como o site (`/api/jogo/poe/icone/arvore/<folha>`);
//   - `gamedata/itens-poe/arvore-sprites.json`: as coordenadas de cada ícone usado e, por nó da árvore do jogo, qual ícone (`nos`) e
//     quais são encaixes de joia (`joias`, só a moldura). O servidor junta na árvore (`systems/passivas/arvore.mjs`).
// Os nós que a 3.25.0 do site ainda não tem (vieram depois, os textos do jogo são da 3.29) usam o ícone da árvore do poedb (3.29); se ele
// não está nas folhas, vai o ícone avulso do CDN do poedb (`arvore-sprites/avulsos/`, 64×64).
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
const poedb = existsSync(POEDB) ? JSON.parse(readFileSync(POEDB, 'utf8')).nodes : {};
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
if (erros.length) {
  for (const [id, c] of Object.entries(nos)) if (typeof c === 'string' && !coords.normalActive?.[c] && !coords.notableActive?.[c] && !coords.keystoneActive?.[c] && !avulsos[c]) delete nos[id];
  console.warn(`ícones avulsos que falharam: ${erros.join(', ')}`);
}

const saida = {
  _nota: `Os ícones e as molduras dos nós da árvore de passivas do PoE, raspados do poeskilltree.com (${versao}, zoom ${zoom}) por tools/importar-arvore-poeskilltree.mjs. "folhas": as folhas de sprites em arvore-sprites/ (servidas em /api/jogo/poe/icone/arvore/); "tipos": a folha de cada tipo de sprite; "coords": [x, y, l, a] de cada ícone usado (a chave é o caminho do PoE sem "Art/2DArt/SkillIcons/passives/" e ".png") e das molduras; "nos": o ícone de cada nó (a maestria: [sem ligação, ligada, escolhida]); "joias": os encaixes de joia (só a moldura); "avulsos": os ícones fora das folhas (nós posteriores à ${versao}, do CDN do poedb).`,
  versao,
  zoom: Number(zoom),
  fonte,
  folhas,
  tipos,
  coords,
  avulsos,
  nos,
  joias,
};
writeFileSync(DESTINO, JSON.stringify(saida) + '\n');
console.log(JSON.stringify({ ...relatorio, semIcone: relatorio.semIcone.length, comIcone: Object.keys(nos).length, folhas: Object.keys(folhas) }), '→', DESTINO.pathname);
if (relatorio.semIcone.length) console.log('sem ícone:', relatorio.semIcone.join('; '));
