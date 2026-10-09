// A aba ÁRVORE × POEDB da engine (dono, 09/10: "crie uma aba de tudo que está funcionando e está pendente e se existe ou não, tendo como
// referência a árvore do poedb — e verifique se tem implementado aqui todas as abas de Ascendancy_class e de Bloodline_Ascendancy_class"):
// cada nó da árvore do poedb (PoE 1, a versão do manifesto) — a árvore principal, as 21 ascendências de classe, as 3 alternativas e as 13
// Linhagens — com: existe no jogo (pelo id do PoE), o estado de cada linha (a mesma tradução que dá efeito aos nós no jogo) e o estado do nó.
// O nó que o jogo não tem é traduzido do texto do poedb ("se entrar, já funciona?"). E as abas das duas páginas, item a item.
// O manifesto é do tools/importar-poedb-arvore.mjs (`gamedata/itens-poe/poedb-arvore.json`); só leitura, conta uma vez por processo.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as Arvore from '../systems/passivas/arvore.mjs';
import { traduzirLinha } from '../systems/itens-poe/arvore.mjs';
import { temaDaLinha } from '../systems/itens-poe/precisa-arvore.mjs';

export const ARQUIVO = fileURLToPath(new URL('../gamedata/itens-poe/poedb-arvore.json', import.meta.url));
/** O estado de uma LINHA na árvore → o da aba (o mesmo vocabulário da aba Pendências). */
export const DA_LINHA = { equivalente: 'funciona', aproximado: 'funciona', novo: 'funciona', registrado: 'pendente', inerte: 'inexiste', nota: 'lembrete' };

/** O estado do NÓ pelas linhas (como o mod pelas partes). */
export function estadoDoNo(linhas) {
  const efeito = linhas.filter((l) => l.estado !== 'lembrete');
  if (!efeito.length) return 'lembrete';
  if (efeito.every((l) => l.estado === 'inexiste')) return 'inexiste';
  const com = efeito.filter((l) => l.estado === 'funciona' || l.estado === 'inexiste').length;
  if (com === efeito.length) return 'funciona';
  return efeito.some((l) => l.estado === 'funciona') ? 'parcial' : 'pendente';
}

const linhasDoTexto = (textos) => textos.map((t) => { const r = traduzirLinha(t); return { texto: t, estado: DA_LINHA[r.estado] ?? 'pendente', ...(r.nota ? { nota: r.nota } : {}) }; });
const linhasDoJogo = (n) => [
  ...(n.textos ?? []).map((t, i) => ({ texto: t, estado: DA_LINHA[n.estados?.[i]] ?? 'pendente' })),
  ...(n.opcoes ?? []).flatMap((o) => (o.textos ?? []).map((t, i) => ({ texto: t, estado: DA_LINHA[o.estados?.[i]] ?? 'pendente', opcao: o.id }))),
];

const CLASSES_DO_POE = new Set(['Marauder', 'Ranger', 'Witch', 'Duelist', 'Templar', 'Shadow', 'Scion']);

let CACHE = null;
/** `{ versao, geradoEm, fonte, grupos, nos, paginas }`, ou null sem o manifesto. */
export function arvorePoedb() {
  if (CACHE) return CACHE;
  if (!existsSync(ARQUIVO)) return null;
  const m = JSON.parse(readFileSync(ARQUIVO, 'utf8'));
  const doJogo = new Map(Object.values(Arvore.arvore()?.nos ?? {}).map((n) => [String(n.id), n]));
  const grupos = {};
  const grupoDe = (n) => {
    if (n.foraDaArvore) return { id: 'fora', nome: n.foraDaArvore === 'blight' ? 'Fora da árvore (Blight, Ungir, aglomerado, atemporal)' : 'Fora da árvore (Blight, Ungir, aglomerado, atemporal)', tipo: 'fora' };
    if (!n.ascendencia) return { id: 'principal', nome: 'Árvore principal', tipo: 'principal' };
    const a = m.ascendencias[n.ascendencia] ?? { nome: n.ascendencia, tipo: 'antiga' };
    return { id: `asc:${n.ascendencia}`, nome: a.nome, tipo: a.tipo, classe: a.classe ?? null };
  };
  const nos = m.nos.map((n) => {
    const j = doJogo.get(n.id);
    const linhas = j ? linhasDoJogo(j) : linhasDoTexto([...n.textos, ...(n.maestrias ?? []).flatMap((x) => x.textos)]);
    const estado = estadoDoNo(linhas);
    const g = grupoDe(n);
    const r = (grupos[g.id] ??= { ...g, nos: 0, noJogo: 0, porEstado: {}, linhas: {} });
    r.nos++;
    if (j) r.noJogo++;
    r.porEstado[estado] = (r.porEstado[estado] ?? 0) + 1;
    for (const l of linhas) r.linhas[l.estado] = (r.linhas[l.estado] ?? 0) + 1;
    return { id: n.id, nome: n.nome, tipo: n.tipo, grupo: g.id, noJogo: !!j, estado, linhas };
  });
  // As abas das páginas de Ascendência e de Linhagem, item a item: o nó (pelo nome e pela ascendência) e se está no jogo.
  const porNome = new Map();
  for (const n of nos) {
    const asc = m.nos.find((x) => x.id === n.id)?.ascendencia;
    const nomeAsc = asc ? m.ascendencias[asc]?.nome : null;
    porNome.set(`${n.nome}|${nomeAsc ?? ''}`, n);
    if (!porNome.has(`${n.nome}|`)) porNome.set(`${n.nome}|`, n);
  }
  const inicios = Arvore.arvore()?.inicios ?? {};
  const paginas = Object.fromEntries(Object.entries(m.paginas ?? {}).map(([pag, p]) => [pag, {
    fonte: p.fonte,
    abas: p.abas.map((a) => {
      const itens = a.itens.map((it) => {
        const n = porNome.get(`${it.nome}|${it.ascendencia ?? ''}`) ?? porNome.get(`${it.nome}|`);
        const asc = Object.values(m.ascendencias).find((x) => x.nome === it.nome || x.nome === it.ascendencia);
        // A classe de base ("Ascendancy Classes": Caçadora → Ranger): no jogo se a árvore tem o início dela.
        const classe = CLASSES_DO_POE.has(it.href) ? it.href : null;
        const noJogo = classe ? !!inicios[classe] : n ? n.noJogo : asc ? grupos[`asc:${asc.id}`]?.noJogo > 0 : null;
        return { nome: it.nome, ascendencia: it.ascendencia, classe: it.classe, noJogo, estado: n?.estado ?? null, id: n?.id ?? null };
      });
      return { id: a.id, titulo: a.titulo, itens, noJogo: itens.filter((x) => x.noJogo).length };
    }),
  }]));
  // O QUE FALTA na árvore principal: cada linha sem efeito por grupo (gema, item, mecânica) e tema, com quantos nós e um exemplo.
  const precisa = {};
  for (const n of nos) {
    if (n.grupo !== 'principal') continue;
    for (const l of n.linhas) {
      if (l.estado !== 'pendente') continue;
      const t = temaDaLinha(l.texto);
      l.tema = t.tema;
      const x = (precisa[`${t.grupo}|${t.tema}`] ??= { grupo: t.grupo, tema: t.tema, precisa: t.precisa, linhas: 0, nos: new Set(), exemplos: [] });
      x.linhas++;
      x.nos.add(n.id);
      if (x.exemplos.length < 4 && !x.exemplos.includes(l.texto)) x.exemplos.push(l.texto);
    }
  }
  CACHE = { versao: m.versao, geradoEm: m.geradoEm, fonte: m.fonte, grupos: Object.values(grupos), nos, paginas, precisa: Object.values(precisa).map((x) => ({ ...x, nos: x.nos.size })).sort((a, b) => b.linhas - a.linhas) };
  return CACHE;
}
export const esquecer = () => { CACHE = null; };
