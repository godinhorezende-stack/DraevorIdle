#!/usr/bin/env node
// (lote 59) As RAMIFICADORAS (Cluster Jewels) do PoE — os dados para o jogo (dono: "Fazer completo"; os arquivos do PoB com a autorização do
// download, 16/10). Junta:
//   - o PATH OF BUILDING (`Data/ClusterJewels.lua`): quantas passivas cada tamanho cria (mín./máx.), ONDE cada nó nasce na órbita do encaixe
//     (os índices das pequenas, dos notáveis e dos encaixes), os encantamentos (a tag e os atributos em inglês), a ordem dos notáveis, as pedras
//     fundamentais das únicas e os deslocamentos de órbita; e (`Data/ModJewelCluster.lua`) os mods da peça — o peso de cada notável por
//     encantamento e por tamanho, os "também concedem", os encaixes, o efeito das pequenas…;
//   - (lote 61) os mods comuns da peça em português (`comuns`: a lista do ModsView de cada página — `extrair/ramificadoras.py`);
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
  // (lote 61) a CHAVE é o nome em português — e, quando dois notáveis DIFERENTES do PoE têm o mesmo nome em português (o "Inspiração
  // Ancestral" do português do PoE é o Ancestral Inspiration e o Eldritch Inspiration), o segundo leva o inglês junto na chave; `nome` é o
  // que a tela mostra (o do PoE). O mesmo notável duas vezes (o "Evil Eye", com os mesmos efeitos) fica uma vez só.
  const igual = notaveis[pt.name];
  if (igual && igual.en === us.name) continue;
  const chave = igual ? `${pt.name} (${us.name})` : pt.name;
  notaveis[chave] = { id: Number(id), nome: pt.name, en: us.name, linhas: pt.stats ?? [], ...(pt.reminderText?.length ? { lembretes: pt.reminderText } : {}), icone: pt.icon, ordem: cluster.notableSortOrder?.[us.name] ?? null };
}
const porSlug = new Map(Object.entries(notaveis).map(([nome, n]) => [slugEn(n.en), nome]));
// (lote 63) As PEQUENAS de cada encantamento (a árvore do poedb também as tem sem grupo: "Attack Damage" → "Dano de Ataque"): o nome em
// português e o ícone, pelo nome em inglês e — quando o inglês se repete — pelas linhas
const pequenasSemGrupo = Object.entries(arvoreUs.nodes).filter(([id, n]) => n && n.group == null && !n.isNotable && !n.isKeystone && !n.isMastery && id !== 'root').map(([id, n]) => ({ id: Number(id), en: n.name, pt: arvorePt.nodes[id] }));
const pequenaDe = (en, linhas) => {
  const lista = pequenasSemGrupo.filter((x) => x.en === en && x.pt?.name);
  return lista.find((x) => JSON.stringify(x.pt.stats ?? []) === JSON.stringify(linhas)) ?? lista[0] ?? null;
};

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
    // (lote 61: + o `id` do encantamento no PoB — a tag se repete: o Bloqueio de Ataques e o Mágico da Pequena)
    encantamentos: Object.entries(j.skills).filter(([, s]) => !/^old_/.test(s.tag) && doTam.some((e) => e.tag === s.tag)).map(([idDoPob, s]) => {
      // (lote 61) dois encantamentos com a MESMA tag (a Pequena: Bloquear o Dano de Ataques e o Mágico): o do poedb pelo tipo também
      const mesmos = doTam.filter((e) => e.tag === s.tag);
      const magia = (x) => /Spell|Mágic/.test(x);
      const p = mesmos.length > 1 ? mesmos.find((e) => magia(e.linhas.join(' ')) === magia((s.stats ?? []).join(' '))) ?? mesmos[0] : mesmos[0];
      const lista = (p?.notaveis ?? []).map((n) => {
        // (pelo slug inglês do link primeiro: o nome em português pode ser de dois notáveis)
        const nome = porSlug.get(n.en) ?? (notaveis[n.nome] ? n.nome : n.nome);
        if (!notaveis[nome]) semNotavel.push(`${tam}/${s.tag}: ${n.nome}`);
        return { nome, peso: n.peso, nivel: n.nivel, lado: n.lado };
      });
      const linhasPt = (p?.linhas ?? []).filter((l) => !/^\(/.test(l));
      const pequena = pequenaDe(s.name, linhasPt);
      return { id: idDoPob, tag: s.tag, en: s.name, ...(pequena ? { nome: pequena.pt.name, idDaPequena: pequena.id } : {}), icone: s.icon, linhas: linhasPt, lembretes: (p?.linhas ?? []).filter((l) => /^\(/.test(l)), atributosEn: s.stats ?? [], notaveis: lista };
    }),
  };
}

// (lote 61) A linha do poedb no formato do catálogo: todo número vira marcador — "+(a—b)" → "+{i}" com a faixa [a, b], o fixo com [n, n].
function noFormatoDoCatalogo(texto) {
  const faixas = [];
  const modelo = texto.replace(/([+-]?)\((-?[\d.]+)—(-?[\d.]+)\)|(-?\d+(?:\.\d+)?)/g, (_, pre, a, b, c) => {
    const i = faixas.length;
    if (a != null) { faixas.push([Number(a), Number(b)]); return `${pre}{${i}}`; }
    faixas.push([Number(c), Number(c)]);
    return `{${i}}`;
  });
  return { texto, modelo, faixas };
}
// (lote 61) O "%" que o português do poedb perde (os "também concedem: +(2—3) de Resistência a Fogo" — no inglês, "+(2-3)% to Fire
// Resistance"): cada número (ou faixa) do inglês seguido de "%" leva o "%" no português, na mesma ordem.
function comPorcentagemDoIngles(pt, en) {
  const doIngles = [...String(en).matchAll(/(\(-?[\d.]+-(-?[\d.]+)\)|\d+(?:\.\d+)?)(%?)/g)].map((x) => x[3] === '%');
  let k = 0;
  return String(pt).replace(/(\(-?[\d.]+—-?[\d.]+\)|-?\d+(?:\.\d+)?)(%?)/g, (tudo, n, pct) => (doIngles[k++] && !pct ? `${n}%` : tudo));
}
// Os números de um texto (o inglês do PoB "+(2-3)", o português do poedb "+(2—3)"): é por eles, com o grupo e o nível, que o mod do PoB acha o
// texto em português — o mesmo grupo e nível se repetem entre os tamanhos (a Vida da Grande e a da Pequena), com os mesmos números.
// (sem o sinal: o "-" da faixa do inglês, "(2-3)", não é negativo)
const numeros = (t) => [...String(t).matchAll(/\d+(?:\.\d+)?/g)].map((x) => Number(x[0])).join(',');
const comunsPt = new Map();
for (const lista of Object.values(doPoedb.comuns ?? {})) for (const c of lista) comunsPt.set(`${c.familia}|${c.nivel}|${numeros(c.texto)}`, c);
const ptPorEn = new Map(Object.entries(notaveis).map(([nome, n]) => [n.en, nome]));
// (e os mods que o ENCANTAMENTO sorteia — o peso depende dele: a tabela de cada encantamento no poedb, sem a família) — pela tag do
// encantamento com o mesmo peso, o nível e os números
const outrosPt = [];
for (const lista of Object.values(doPoedb.tamanhos ?? {})) for (const e of lista) for (const o of e.outros ?? []) outrosPt.push({ tag: e.tag, ...o });
const ptDoEncantamento = (m, pesos, en) => outrosPt.find((o) => pesos[o.tag] === o.peso && o.nivel === (m.level ?? 1) && numeros(o.texto) === numeros(en))?.texto ?? null;

// Os mods da peça (fora os corrompidos): o texto em inglês do PoB e (lote 61) o em português do poedb (`modelo` + `faixas`), o lado, o nível,
// o grupo, os PESOS (a 1ª chave que a peça tem: o tamanho — `expansion_jewel_large`… —, a tag do encantamento ou `default`), os
// MULTIPLICADORES (a 1ª chave que a peça tem, entre as tags dos mods que ela já tem e o tamanho) e as TAGS que o mod põe na peça
// (`adiciona`: o notável põe `has_affliction_notable` — é assim que a Pequena só tem 1 notável e a Grande só 1 notável Sufixo). Os NOTÁVEIS
// ("1 Added Passive Skill is X") com o nome do notável em português (`notavel`).
const mods = [];
const semPt = [];
for (const [id, m] of Object.entries(modsDoPob)) {
  if (m.type === 'Corrupted') continue;
  const textos = Object.keys(m).filter((k) => /^\d+$/.test(k)).sort((a, b) => a - b).map((k) => m[k]);
  const pesos = Object.fromEntries((m.weightKey ?? []).map((k, i) => [k, m.weightVal?.[i] ?? 0]));
  const multiplicadores = Object.fromEntries((m.weightMultiplierKey ?? []).map((k, i) => [k, m.weightMultiplierVal?.[i] ?? 100]));
  const enNotavel = /^1 Added Passive Skill is (.+)$/.exec(textos[0] ?? '')?.[1];
  const notavel = enNotavel ? ptPorEn.get(enNotavel) ?? null : null;
  const comum = enNotavel ? null : comunsPt.get(`${m.group}|${m.level ?? 1}|${numeros(textos.join(' '))}`) ?? null;
  const ptPoedb = enNotavel ? (notavel ? `1 das Habilidades Passivas Adicionadas é ${notaveis[notavel].nome}` : null) : comum?.texto ?? ptDoEncantamento(m, pesos, textos.join(' '));
  const pt = ptPoedb && comPorcentagemDoIngles(ptPoedb, textos.join(' '));
  if (!pt && Object.values(pesos).some((v) => v > 0)) semPt.push(`${id}: ${textos[0]}`);
  mods.push({
    id, lado: m.type === 'Prefix' ? 'prefixo' : 'sufixo', afixo: m.affix, textosEn: textos, nivel: m.level ?? 1, grupo: m.group, pesos, multiplicadores,
    // (o nome do afixo em português, na forma feminina — o da peça Mágica: "Joia Ramificadora Grande Robusta")
    adiciona: m.tags ?? [], ...(enNotavel ? { notavel } : {}), ...(comum?.nome ? { nome: comum.nome } : {}), ...(pt ? noFormatoDoCatalogo(pt) : {}),
  });
}

writeFileSync(DESTINO, `${JSON.stringify({
  _nota: 'As RAMIFICADORAS do PoE (lote 59): `tamanhos` — por tamanho, quantos nós (mín./máx.), os ÍNDICES na órbita do encaixe de expansão onde nascem as pequenas, os notáveis e os encaixes (o PoB), e os encantamentos (a tag, o texto das Pequenas Habilidades Passivas Adicionadas em português, os notáveis com peso, nível e lado); `notaveis` — os 301 notáveis de Ramificadora com os efeitos em português (a árvore do poedb) e a ordem do PoB; `pedras` — as pedras fundamentais das únicas; `deslocamentos` — os deslocamentos de órbita do PoB; `mods` — os mods da peça (o inglês do PoB, o português do poedb em `modelo`/`faixas`, os pesos, os multiplicadores, as tags que põem na peça e, nos notáveis, o nome do notável). Feito por `tools/importar-ramificadoras.mjs`.',
  fontes: ['Path of Building — Data/ClusterJewels.lua e Data/ModJewelCluster.lua (dono, 16/10: "Pode baixar os dois")', 'poedb.tw/pt/<Large|Medium|Small>_Cluster_Jewel — a aba EnchantmentModifiers (o Scrapling)', 'poedb — a árvore 3.29 (data_pt.json / data_us.json)'],
  geradoEm: new Date().toISOString(),
  tamanhos, notaveis, pedras, deslocamentos: cluster.orbitOffsets ?? {}, mods,
}, null, 1)}\n`);
console.log(Object.entries(tamanhos).map(([t, x]) => `${t}: ${x.encantamentos.length} encantamentos, ${x.encantamentos.reduce((n, e) => n + e.notaveis.length, 0)} notáveis`).join(' · '));
console.log(`notáveis: ${Object.keys(notaveis).length} · pedras: ${Object.keys(pedras).length} · mods: ${mods.length} (${mods.filter((m) => m.notavel).length} notáveis; sem o português: ${semPt.length}${semPt.length ? ` — ${semPt.slice(0, 5).join('; ')}` : ''}) · sem o notável na árvore: ${semNotavel.length}${semNotavel.length ? ` (${semNotavel.slice(0, 5).join('; ')})` : ''}`);
console.log(`→ ${DESTINO.pathname}`);
