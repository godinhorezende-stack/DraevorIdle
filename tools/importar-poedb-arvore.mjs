// IMPORTADOR da ÁRVORE do poedb para a aba "Árvore × PoEDB" da engine (dono, 09/10: "veja também a árvore, crie uma aba de tudo que está
// funcionando e está pendente e se existe ou não, tendo como referência https://poedb.tw/pt/passive-skill-tree/ — verifique se tem
// implementado aqui todas as abas da https://poedb.tw/pt/Ascendancy_class e da https://poedb.tw/pt/Bloodline_Ascendancy_class").
//
// A COLEÇÃO (fora do repositório, extraída com o Scrapling em /home/deploy/scrapling): a árvore do poedb (`saida/arvore/arvore-poedb-<v>-pt.json`,
// o mesmo arquivo que a página da árvore carrega) e as abas das páginas de Ascendência e de Linhagem (`saida/json/*.json`). Este tool grava
// `game/gamedata/itens-poe/poedb-arvore.json`: cada nó do poedb (id do PoE, nome, tipo, ascendência/linhagem, se fica na árvore, os textos)
// e as abas das duas páginas. A engine cruza com a árvore do jogo (`admin/itens-poe-arvore-poedb.mjs`): existe ou não, e o estado de
// cada linha. Uso:
//   node tools/importar-poedb-arvore.mjs            → grava o manifesto
//   node tools/importar-poedb-arvore.mjs --checar   → só o resumo
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { linhasDoNo } from '../game/systems/itens-poe/arvore.mjs';

const ORIGEM = process.env.POEDB_SCRAPLING ?? '/home/deploy/scrapling/saida';
const VERSAO = process.env.POEDB_VERSAO ?? '3.29';
const DESTINO = fileURLToPath(new URL('../game/gamedata/itens-poe/poedb-arvore.json', import.meta.url));
const lerJson = (arq) => JSON.parse(readFileSync(arq, 'utf8'));

/** O tipo do nó do poedb. */
export function tipoDoNo(n) {
  if (n.isBloodline) return 'linhagem';
  if (n.isAscendancyStart) return 'inicioAscendencia';
  if (n.ascendancyName) return n.isNotable ? 'notavelAscendencia' : 'pequenoAscendencia';
  if (n.classStartIndex !== undefined) return 'inicio';
  if (n.isKeystone) return 'keystone';
  if (n.isMastery) return 'maestria';
  if (n.isJewelSocket) return 'joia';
  if (n.isNotable) return 'notavel';
  return 'pequeno';
}

export function importar(origem = ORIGEM) {
  const P = lerJson(join(origem, 'arvore', `arvore-poedb-${VERSAO}-pt.json`));
  // As ascendências: as das classes e as ALTERNATIVAS (as 13 Linhagens e as outras três — Guardião dos Maji, Bruxo das Brumas, Primalista).
  // O id interno do PoE nem sempre é o nome: a ascendência "Protetora" (a Warden do Ranger) tem o id "Raider", e o id "Warden" é o Guardião
  // dos Maji — por isso o tipo vem da LISTA (das classes ou das alternativas), não da marca do nó.
  const ascendencias = {};
  for (const c of P.classes ?? []) for (const a of c.ascendancies ?? []) ascendencias[a.id] = { id: a.id, nome: a.name, classe: c.name, tipo: 'classe' };
  for (const a of P.alternate_ascendancies ?? []) ascendencias[a.id] = { id: a.id, nome: a.name, classe: null, tipo: /^Linhagem/.test(a.name) ? 'linhagem' : 'alternativa' };
  const nos = [];
  for (const [id, n] of Object.entries(P.nodes ?? {})) {
    if (id === 'root') continue;
    const grupo = n.group != null ? P.groups?.[n.group] : null;
    const naArvore = !!(grupo && n.orbit !== undefined && !n.isProxy && !grupo.isProxy) && !n.isBlighted;
    const asc = n.ascendancyName ?? null;
    if (asc && ascendencias[asc]) {
      ascendencias[asc].nos = (ascendencias[asc].nos ?? 0) + 1;
    } else if (asc) ascendencias[asc] = { id: asc, nome: asc, classe: null, tipo: n.isBloodline ? 'linhagem' : 'antiga', nos: 1 };
    nos.push({
      id: String(id),
      nome: n.name,
      tipo: tipoDoNo(n),
      ...(asc ? { ascendencia: asc } : {}),
      ...(n.isBloodline ? { alternativa: true } : {}),
      ...(naArvore ? {} : { foraDaArvore: n.isBlighted ? 'blight' : 'aglomerado/atemporal' }),
      textos: linhasDoNo([...(n.stats ?? []), ...(n.reminderText ?? [])]),
      ...(n.masteryEffects?.length ? { maestrias: n.masteryEffects.map((m) => ({ id: String(m.effect), textos: linhasDoNo(m.stats ?? []) })) } : {}),
    });
  }
  // As abas das duas páginas (Ascendência e Linhagem): o que cada uma lista.
  const paginas = {};
  for (const pag of ['Ascendancy_class', 'Bloodline_Ascendancy_class']) {
    const arq = join(origem, 'json', `${pag}.json`);
    if (!existsSync(arq)) continue;
    const d = lerJson(arq);
    paginas[pag] = {
      fonte: d.fonte,
      abas: d.abas.map((a) => ({
        id: a.id,
        titulo: a.cards.find((c) => c.titulo)?.titulo ?? a.rotulo ?? a.id,
        itens: a.cards.flatMap((c) => (c.bases ?? []).map((b) => ({
          nome: b.nome,
          href: String(b.href ?? '').replace(/^\/pt\//, ''),
          ascendencia: b.props.find((p) => /^(Ascensão|Bloodline):/.test(p.texto))?.texto.split(': ')[1] ?? null,
          classe: b.props.find((p) => /^Personagem:/.test(p.texto))?.texto.split(': ')[1] ?? null,
          textos: b.props.filter((p) => /Mod$/.test(p.classe)).map((p) => p.texto),
        }))),
      })),
    };
  }
  return { geradoEm: new Date().toISOString(), versao: VERSAO, fonte: `poedb.tw/pt/passive-skill-tree (PoE 1 ${VERSAO}) e as páginas de Ascendência e Linhagem — extraídas com o Scrapling (tools/importar-poedb-arvore.mjs)`, ascendencias, nos, paginas };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const m = importar();
  const por = {};
  for (const n of m.nos) por[n.tipo] = (por[n.tipo] ?? 0) + 1;
  console.log(`nós ${m.nos.length} (${Object.entries(por).map(([k, v]) => `${k} ${v}`).join(', ')}) · ascendências ${Object.keys(m.ascendencias).length} · páginas ${Object.keys(m.paginas).join(', ')}`);
  if (!process.argv.includes('--checar')) {
    writeFileSync(DESTINO, JSON.stringify(m));
    console.log(`gravado: ${DESTINO} (${(statSync(DESTINO).size / 1e6).toFixed(2)} MB)`);
  }
}
