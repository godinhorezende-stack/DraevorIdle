#!/usr/bin/env node
// (lote 59) As RAMIFICADORAS (Cluster Jewels) do PoE — os dados para o jogo (dono: "Fazer completo"; os arquivos do PoB com a autorização do
// download, 16/10). Junta:
//   - o PATH OF BUILDING (`Data/ClusterJewels.lua`): quantas passivas cada tamanho cria (mín./máx.), ONDE cada nó nasce na órbita do encaixe
//     (os índices das pequenas, dos notáveis e dos encaixes), os encantamentos (a tag e os atributos em inglês), a ordem dos notáveis, as pedras
//     fundamentais das únicas e os deslocamentos de órbita; e (`Data/ModJewelCluster.lua`) os mods da peça — o peso de cada notável por
//     encantamento e por tamanho, os "também concedem", os encaixes, o efeito das pequenas…;
//   - o POEDB pelo Scrapling (`extrair/ramificadoras.py` → `saida/json/ramificadoras.json`): o texto em português das Pequenas Habilidades
//     Passivas Adicionadas de cada encantamento e os notáveis dele (nome em português, peso, nível, Prefixo/Sufixo);
//   - a ÁRVORE do poedb 3.29 (`saida/arvore/arvore-poedb-3.29-{pt,us}.json`): os efeitos em português de cada notável de Ramificadora (os 301
//     sem grupo) e o nome em inglês pelo mesmo id.
// Grava `gamedata/itens-poe/ramificadoras.json`.
//
//   node tools/importar-ramificadoras.mjs [pasta do PoB, padrão /home/deploy/referencias-poe/pob] [pasta do Scrapling, padrão /home/deploy/scrapling/saida]
import { readFileSync, writeFileSync } from 'node:fs';
import { lerTabelaLua } from './lua-tabela.mjs';

const POB = process.argv[2] ?? '/home/deploy/referencias-poe/pob';
const SCRAPLING = process.argv[3] ?? '/home/deploy/scrapling/saida';
const DESTINO = new URL('../gamedata/itens-poe/ramificadoras.json', import.meta.url);

const cluster = lerTabelaLua(readFileSync(`${POB}/Data/ClusterJewels.lua`, 'utf8'));
const modsDoPob = lerTabelaLua(readFileSync(`${POB}/Data/ModJewelCluster.lua`, 'utf8'));
const doPoedb = JSON.parse(readFileSync(`${SCRAPLING}/json/ramificadoras.json`, 'utf8'));
const arvorePt = JSON.parse(readFileSync(`${SCRAPLING}/arvore/arvore-poedb-3.29-pt.json`, 'utf8'));
const arvoreUs = JSON.parse(readFileSync(`${SCRAPLING}/arvore/arvore-poedb-3.29-us.json`, 'utf8'));

const slugEn = (nome) => String(nome).replace(/['’]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
// Os notáveis de Ramificadora: os nós da árvore SEM grupo (não ficam na árvore — nascem na joia), pelo id
const notaveis = {};
for (const [id, pt] of Object.entries(arvorePt.nodes)) {
  if (!pt?.isNotable || pt.group != null || pt.isKeystone) continue;
  const us = arvoreUs.nodes[id];
  if (!us?.name) continue;
  notaveis[pt.name] = { id: Number(id), en: us.name, linhas: pt.stats ?? [], ...(pt.reminderText?.length ? { lembretes: pt.reminderText } : {}), icone: pt.icon, ordem: cluster.notableSortOrder?.[us.name] ?? null };
}
const porSlug = new Map(Object.entries(notaveis).map(([nome, n]) => [slugEn(n.en), nome]));

// As pedras fundamentais das únicas Ramificadoras (O Aquele Sem Nada — a Técnica da Palma Oca…): o nome em português e os efeitos
const pedras = {};
for (const en of cluster.keystones ?? []) {
  const id = Object.entries(arvoreUs.nodes).find(([, n]) => n?.name === en && n.isKeystone)?.[0];
  const pt = id ? arvorePt.nodes[id] : null;
  if (pt) pedras[pt.name] = { id: Number(id), en, linhas: pt.stats ?? [], icone: pt.icon };
}

const NOMES = { Large: 'Joia Ramificadora Grande', Medium: 'Joia Ramificadora Média', Small: 'Joia Ramificadora Pequena' };
const tamanhos = {};
const semNotavel = [];
for (const [chave, j] of Object.entries(cluster.jewels)) {
  const tam = j.size;
  const doTam = doPoedb.tamanhos?.[tam] ?? [];
  tamanhos[tam] = {
    base: `Jewels/${tam}_Cluster_Jewel`, nome: NOMES[tam], en: chave, indice: j.sizeIndex,
    nos: [j.minNodes, j.maxNodes], pequenas: j.smallIndicies, notaveis: j.notableIndicies, encaixes: j.socketIndicies, total: j.totalIndicies,
    // (os descontinuados do PoB — `old_do_not_use_…` — não saem mais na peça; e os que o poedb de hoje não tem — a Força, a Destreza e a
    // Inteligência da Pequena: sem o texto nem os notáveis — ficam em `foraDoPoedb`)
    ...(Object.values(j.skills).some((s) => !/^old_/.test(s.tag) && !doTam.some((e) => e.tag === s.tag)) ? { foraDoPoedb: Object.values(j.skills).filter((s) => !/^old_/.test(s.tag) && !doTam.some((e) => e.tag === s.tag)).map((s) => s.tag) } : {}),
    encantamentos: Object.values(j.skills).filter((s) => !/^old_/.test(s.tag) && doTam.some((e) => e.tag === s.tag)).map((s) => {
      const p = doTam.find((e) => e.tag === s.tag);
      const lista = (p?.notaveis ?? []).map((n) => {
        const nome = notaveis[n.nome] ? n.nome : porSlug.get(n.en) ?? n.nome;
        if (!notaveis[nome]) semNotavel.push(`${tam}/${s.tag}: ${n.nome}`);
        return { nome, peso: n.peso, nivel: n.nivel, lado: n.lado };
      });
      return { tag: s.tag, en: s.name, icone: s.icon, linhas: (p?.linhas ?? []).filter((l) => !/^\(/.test(l)), lembretes: (p?.linhas ?? []).filter((l) => /^\(/.test(l)), atributosEn: s.stats ?? [], notaveis: lista };
    }),
  };
}

// Os mods da peça (fora os notáveis e os corrompidos): o texto em inglês do PoB, o lado, o nível, o grupo e os pesos — por tag de encantamento
// e o multiplicador por tamanho (`expansion_jewel_large`…). A tradução vem na peça (o lote da geração).
const mods = [];
for (const [id, m] of Object.entries(modsDoPob)) {
  if (m.type === 'Corrupted' || m.affix === 'Notable') continue;
  const textos = Object.keys(m).filter((k) => /^\d+$/.test(k)).sort((a, b) => a - b).map((k) => m[k]);
  const pesos = Object.fromEntries((m.weightKey ?? []).map((k, i) => [k, m.weightVal?.[i] ?? 0]));
  const multiplicadores = Object.fromEntries((m.weightMultiplierKey ?? []).map((k, i) => [k, m.weightMultiplierVal?.[i] ?? 100]));
  mods.push({ id, lado: m.type === 'Prefix' ? 'prefixo' : 'sufixo', afixo: m.affix, textosEn: textos, nivel: m.level ?? 1, grupo: m.group, pesos, multiplicadores });
}

writeFileSync(DESTINO, `${JSON.stringify({
  _nota: 'As RAMIFICADORAS do PoE (lote 59): `tamanhos` — por tamanho, quantos nós (mín./máx.), os ÍNDICES na órbita do encaixe de expansão onde nascem as pequenas, os notáveis e os encaixes (o PoB), e os encantamentos (a tag, o texto das Pequenas Habilidades Passivas Adicionadas em português, os notáveis com peso, nível e lado); `notaveis` — os 301 notáveis de Ramificadora com os efeitos em português (a árvore do poedb) e a ordem do PoB; `pedras` — as pedras fundamentais das únicas; `deslocamentos` — os deslocamentos de órbita do PoB; `mods` — os outros mods da peça, em inglês, com os pesos. Feito por `tools/importar-ramificadoras.mjs`.',
  fontes: ['Path of Building — Data/ClusterJewels.lua e Data/ModJewelCluster.lua (dono, 16/10: "Pode baixar os dois")', 'poedb.tw/pt/<Large|Medium|Small>_Cluster_Jewel — a aba EnchantmentModifiers (o Scrapling)', 'poedb — a árvore 3.29 (data_pt.json / data_us.json)'],
  geradoEm: new Date().toISOString(),
  tamanhos, notaveis, pedras, deslocamentos: cluster.orbitOffsets ?? {}, mods,
}, null, 1)}\n`);
console.log(Object.entries(tamanhos).map(([t, x]) => `${t}: ${x.encantamentos.length} encantamentos, ${x.encantamentos.reduce((n, e) => n + e.notaveis.length, 0)} notáveis`).join(' · '));
console.log(`notáveis: ${Object.keys(notaveis).length} · pedras: ${Object.keys(pedras).length} · mods: ${mods.length} · sem o notável na árvore: ${semNotavel.length}${semNotavel.length ? ` (${semNotavel.slice(0, 5).join('; ')})` : ''}`);
console.log(`→ ${DESTINO.pathname}`);
