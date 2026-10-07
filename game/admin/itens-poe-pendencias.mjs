// A aba PENDÊNCIAS DE MODIFICADORES da engine (dono, 07/10: "uma aba na engine de pendência de modificadores"): cada mod do catálogo do PoE
// que pode cair no jogo — afixos (prefixos/sufixos), implícitos das bases, mods dos únicos e dos frascos — com o ESTADO dele no jogo:
//   funciona  — todas as partes têm efeito (✓ equivalente, ≈ aproximado, ◆ atributo novo com efeito);
//   parcial   — parte tem efeito, parte não;
//   pendente  — nenhuma parte tem efeito ainda (registrado);
//   inexiste  — mecânica do PoE que não existe no jogo (pesca, Fendas, Óleos…), com o porquê;
//   lembrete  — texto de lembrete do PoE (entre parênteses), não é mod.
// A mesma tradução do jogo (`itens-poe/traduzir.mjs`) e o mesmo leitor dos frascos (`itens-poe/frascos.mjs`): o que a aba diz é o que o
// balão da peça mostra. Só leitura; a conta é feita uma vez por processo (o catálogo e as regras só mudam com o servidor reiniciado).
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';
import { traduzirParte } from '../systems/itens-poe/traduzir.mjs';
import * as Frascos from '../systems/itens-poe/frascos.mjs';

/** As classes que não entram no jogo (os mods delas nunca caem). */
export const FORA_DO_JOGO = new Set(['Trinkets', 'Fishing_Rods', 'Jewels', 'Abyss_Jewels', 'Tinctures']);
const COM_EFEITO = new Set(['equivalente', 'aproximado', 'novo']);

/** O estado de uma linha de frasco (o leitor dos frascos) → o da tradução. */
const DO_FRASCO = { efeito: 'equivalente', registrado: 'registrado', inerte: 'inerte' };

/** As partes de um mod com o estado de cada uma: `[{ texto, estado, nota, efeitos }]`. */
function partesDe(classe, m) {
  const valores = (m.faixas ?? []).map((f) => f[0]);
  if (/Flasks/.test(classe)) {
    const par = Frascos.parametros({ poe: { classe, base: `${classe}/x`, atributos: {}, implicitos: [], prefixos: [{ modelo: m.modelo, valores }], sufixos: [] } });
    return par.linhas.map((l) => ({ texto: l.texto, estado: DO_FRASCO[l.estado] ?? l.estado, nota: null, efeitos: [] }));
  }
  return String(m.modelo ?? '').split(' / ').filter(Boolean).map((p) => {
    const r = traduzirParte(p, valores);
    return { texto: p, estado: r.estado, nota: r.nota ?? null, efeitos: r.efeitos.map((e) => e.stat) };
  });
}

/** O estado do MOD inteiro pelas partes. */
export function estadoDoMod(partes) {
  const mods = partes.filter((p) => p.estado !== 'lembrete');
  if (!mods.length) return 'lembrete';
  if (mods.every((p) => p.estado === 'inerte')) return 'inexiste';
  const com = mods.filter((p) => COM_EFEITO.has(p.estado) || p.estado === 'inerte').length;
  if (com === mods.length) return 'funciona';
  return mods.some((p) => COM_EFEITO.has(p.estado)) ? 'parcial' : 'pendente';
}

let CACHE = null;
/** Todas as linhas: `{ resumo: { origem: { estado: n } }, linhas: [{ id, origem, modelo, texto, estado, partes, classes, itens, peso }] }`. */
export function pendencias() {
  if (CACHE) return CACHE;
  const cat = Catalogo.catalogo();
  if (!cat) return { resumo: {}, linhas: [] };
  const porChave = new Map();
  const somar = (origem, classe, m, item, peso = 0) => {
    const chave = `${origem}|${m.modelo}`;
    let x = porChave.get(chave);
    if (!x) {
      const partes = partesDe(classe, m);
      x = { id: porChave.size + 1, origem, modelo: m.modelo, texto: m.texto ?? m.modelo, estado: estadoDoMod(partes), partes, classes: new Set(), itens: new Set(), peso: 0 };
      porChave.set(chave, x);
    }
    x.classes.add(classe);
    if (item) x.itens.add(item);
    x.peso += peso;
  };
  for (const [classe, c] of Object.entries(cat.classes)) {
    if (FORA_DO_JOGO.has(classe)) continue;
    const frasco = /Flasks/.test(classe);
    for (const pool of Object.values(c.paginas ?? {})) for (const g of [...pool.prefixos, ...pool.sufixos]) for (const t of g.tiers) somar(frasco ? 'frasco' : 'afixo', classe, t, null, t.peso ?? 0);
    for (const b of c.bases ?? []) for (const im of b.implicitos ?? []) somar(frasco ? 'frasco' : 'implicito', classe, im, b.nome);
    for (const u of c.unicos ?? []) for (const m of u.modificadores ?? []) somar('unico', classe, m, u.nome);
  }
  const linhas = [...porChave.values()].map((x) => ({ ...x, classes: [...x.classes], itens: [...x.itens].slice(0, 12), totalDeItens: x.itens.size }));
  const resumo = {};
  for (const l of linhas) { const r = (resumo[l.origem] ??= {}); r[l.estado] = (r[l.estado] ?? 0) + 1; }
  // Os únicos: quantos têm TODOS os mods funcionando.
  const unicos = { total: 0, completos: 0 };
  for (const [classe, c] of Object.entries(cat.classes)) {
    if (FORA_DO_JOGO.has(classe)) continue;
    for (const u of c.unicos ?? []) {
      unicos.total++;
      if (u.modificadores.every((m) => ['funciona', 'inexiste', 'lembrete'].includes(porChave.get(`unico|${m.modelo}`)?.estado))) unicos.completos++;
    }
  }
  CACHE = { resumo, unicos, linhas };
  return CACHE;
}
/** Esquece a conta (os testes; uma regra nova sem reiniciar). */
export const esquecer = () => { CACHE = null; };
