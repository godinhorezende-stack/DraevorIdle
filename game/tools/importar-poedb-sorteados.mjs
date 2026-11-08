#!/usr/bin/env node
// (lote 55, J31) As LINHAS SORTEADAS das únicas de joia do PoE ("[Two random aura modifiers]" do Olho do Vigia, "[Two random modifiers]" da
// Personalidade Dividida e do Equilíbrio do Terror; lote 56: o "[Aura Bonus Modifier]" da Visão Sublime): o pool de cada uma, da aba
// "Modificadores" da página do poedb, extraída pelo Scrapling (`/home/deploy/scrapling/extrair/abas.py <Pagina>` → `saida/json/<Pagina>.json`). Grava `gamedata/itens-poe/linhas-sorteadas.json` — o
// catálogo põe `linhasSorteadas` no único ao carregar (`itens-poe/catalogo.mjs`) e o gerador troca a linha de marcação pelas sorteadas
// (`itens-poe/gerar.modificadoresDoUnico`).
//
//   node tools/importar-poedb-sorteados.mjs [pasta do Scrapling, padrão /home/deploy/scrapling/saida/json]
import { readFileSync, writeFileSync } from 'node:fs';

const PASTA = process.argv[2] ?? '/home/deploy/scrapling/saida/json';
const DESTINO = new URL('../gamedata/itens-poe/linhas-sorteadas.json', import.meta.url);

/** As únicas: a página do poedb, a aba do pool e a linha de marcação do catálogo → quantas linhas ela vira. */
const UNICOS = {
  Watchers_Eye: { aba: /^OlhodoVigiaModificadores$/, substitui: { '[Two random aura modifiers]': 2, '[Three random aura modifiers]': 3 } },
  Split_Personality: { aba: /^PersonalidadeDivididaModificadores$/, substitui: { '[Two random modifiers]': 2 } },
  The_Balance_of_Terror: { aba: /^OEquilíbriodoTerrorModificadores$/, substitui: { '[Two random modifiers]': 2 } },
  // (lote 56) a Visão Sublime: 1 das 17 combinações (o efeito das auras em você, o bônus de uma aura e "as outras são Desabilitadas")
  Sublime_Vision: { aba: /^VisãoSublimeModificadores$/, substitui: { '[Aura Bonus Modifier]': 1 } },
  // (lote 57) o Limitado pelo Destino: cada marcação sorteia 1 das linhas do seu número de itens ("se 2 / 4 / 6 Itens do <Influência>…")
  // (lote 58) a Fé Militante (a Atemporal): 2 das 16 linhas de devoção ("por cada 10 de Devoção")
  Militant_Faith: { aba: /^FéMilitanteModificadores$/, substitui: { '[Two random mods of devotion]': 2 } },
  Bound_By_Destiny: { aba: /^LimitadopeloDestinoModificadores$/, substitui: { '[Random 2x influence item bonus]': { quantidade: 1, itens: 2 }, '[Random 4x influence item bonus]': { quantidade: 1, itens: 4 }, '[Random 6x influence item bonus]': { quantidade: 1, itens: 6 } } },
};

/**
 * A linha no formato do catálogo (o mesmo do `extrair/unicos.py`): todo número vira marcador — "+(a—b)" → "+{i}" com a faixa [a, b], o fixo com
 * [n, n]; `texto` fica como no poedb.
 */
export function noFormatoDoCatalogo(texto) {
  const faixas = [];
  const modelo = texto.replace(/([+-]?)\((-?[\d.]+)—(-?[\d.]+)\)|(-?\d+(?:\.\d+)?)/g, (m, pre, a, b, c) => {
    const i = faixas.length;
    if (a != null) { faixas.push([Number(a), Number(b)]); return `${pre}{${i}}`; }
    faixas.push([Number(c), Number(c)]);
    return `{${i}}`;
  });
  return { texto, modelo, faixas };
}

const unicos = {};
for (const [slug, { aba, substitui }] of Object.entries(UNICOS)) {
  const d = JSON.parse(readFileSync(`${PASTA}/${slug}.json`, 'utf8'));
  const a = d.abas.find((x) => aba.test(x.id));
  if (!a) throw new Error(`${slug}: a aba do pool não está no arquivo do Scrapling`);
  const linhas = a.cards.flatMap((c) => c.tabelas ?? []).flatMap((t) => t.linhas ?? []).map((r) => noFormatoDoCatalogo(String(r[0]).trim()));
  // (lote 57) a marcação com o pool próprio (`{ quantidade, itens }`): `pools[marca]` — as linhas do pool com "se N itens"; `substitui` fica com o número
  const proprios = Object.entries(substitui).filter(([, x]) => typeof x !== 'number');
  const pools = Object.fromEntries(proprios.map(([marca, x]) => [marca, linhas.filter((l) => Number(/se (?:tiver )?(\d+) itens/i.exec(l.texto)?.[1]) === x.itens)]));
  const quantas = Object.fromEntries(Object.entries(substitui).map(([marca, x]) => [marca, typeof x === 'number' ? x : x.quantidade]));
  unicos[slug] = { classe: 'Jewels', substitui: quantas, ...(proprios.length ? { pools } : {}), fonte: d.fonte, linhas };
  console.log(`${slug}: ${linhas.length} linhas`);
}
// (08/11, balão 0 sem efeito — o dono: "Fazer todos") os MODS SORTEADOS dos outros únicos, pela aba "Modificadores" do poedb (o texto do mod é a célula mais
// longa da linha — o Triunvirato traz "Únicos", o texto, o peso e o nível). `substitui`: o número de linhas, ou 'faixa' (o número sai da faixa da própria marcação:
// "[You have 1-2 Random Shrine Buff…]", "[3 to 5 of Arbalists Modifiers]"); `composicao`: a marcação que junta pools ("[Two Endurance Charge mods and one Power Charge
// Mod]" — o Emblema do Precursor).
const textoDaLinha = (r) => String([...r].sort((x, y) => String(y).length - String(x).length)[0] ?? '').trim();
const linhasDaAba = (slug, aba) => {
  const d = JSON.parse(readFileSync(`${PASTA}/${slug}.json`, 'utf8'));
  const a = d.abas.find((x) => aba.test(x.id));
  if (!a) throw new Error(`${slug}: a aba do pool não está no arquivo do Scrapling`);
  return { fonte: d.fonte, linhas: a.cards.flatMap((c) => c.tabelas ?? []).flatMap((t) => t.linhas ?? []).map((r) => noFormatoDoCatalogo(textoDaLinha(r))) };
};
const OUTROS = {
  Screams_of_the_Desiccated: { classe: 'Belts', aba: /Modificadores$/, substitui: { '[You have {0}-{1} Random Shrine Buff while affected by no Flasks]': 'faixa' } },
  Voranas_March: { classe: 'Boots', aba: /Modificadores$/, substitui: { '[{0} to {1} of Arbalists Modifiers]': 'faixa' } },
  Tombfist: { classe: 'Gloves', aba: /Modificadores$/, substitui: { '[{0} random Abyss Jewel-dependent modifiers]': 'faixa' } },
  Triumvirate_Authority: { classe: 'Rings', aba: /^TriumvirateAuthorityMods$/, substitui: { '[Four random modifiers]': 4, '[Three random modifiers]': 3 } },
  Cinderswallow_Urn: { classe: 'Utility_Flasks', aba: /Modificadores$/, substitui: { '[One random modifier]': 1 } },
  Circle_of_Guilt: { classe: 'Rings', aba: /Modificadores$/, substitui: { '[Random Herald of Purity modifier]': 1 } },
  Circle_of_Regret: { classe: 'Rings', aba: /Modificadores$/, substitui: { '[Random Herald of Thunder modifier]': 1 } },
  Circle_of_Fear: { classe: 'Rings', aba: /Modificadores$/, substitui: { '[Random Herald of Ice modifier]': 1 } },
  Circle_of_Anguish: { classe: 'Rings', aba: /Modificadores$/, substitui: { '[Random Herald of Ash modifier]': 1 } },
  Circle_of_Nostalgia: { classe: 'Rings', aba: /Modificadores$/, substitui: { '[Random Herald of Agony modifier]': 1 } },
};
for (const [slug, o] of Object.entries(OUTROS)) {
  const { fonte, linhas } = linhasDaAba(slug, o.aba);
  unicos[slug] = { classe: o.classe, substitui: o.substitui, fonte, linhas };
  console.log(`${slug}: ${linhas.length} linhas`);
}
// A ASCENSÃO DE AUL: o pool por ATRIBUTO da aura (as variantes do PoB — Data/Uniques/amulet.lua: Força, Destreza e Inteligência; a Inveja é uma variante à parte, sem marcação no catálogo)
{
  const { fonte, linhas } = linhasDaAba('Auls_Uprising', /Modificadores$/);
  const POR_ATRIBUTO = { forca: ['Cólera', 'Determinação', 'Orgulho', 'Pureza do Fogo', 'Vitalidade'], destreza: ['Graça', 'Ímpeto', 'Ódio', 'Pureza do Gelo'], inteligencia: ['Clareza', 'Disciplina', 'Malevolência', 'Pureza dos Elementos', 'Pureza do Raio', 'Ira', 'Fanatismo'] };
  const daAura = (l) => l.texto.replace(/ não (?:possui|tem) Reserva.*$/, '');
  const pool = (nomes) => linhas.filter((l) => nomes.includes(daAura(l)));
  const marcas = { '[Random Strength aura Reserves no Mana]': 'forca', '[Random Dexterity aura Reserves no Mana]': 'destreza', '[Random Intelligence aura Reserves no Mana]': 'inteligencia' };
  const pools = Object.fromEntries(Object.entries(marcas).map(([m, a]) => [m, pool(POR_ATRIBUTO[a])]));
  for (const [m, l] of Object.entries(pools)) if (l.length !== POR_ATRIBUTO[marcas[m]].length) throw new Error(`Ascensão de Aul: ${m} com ${l.length} linhas`);
  unicos.Auls_Uprising = { classe: 'Amulets', substitui: Object.fromEntries(Object.keys(marcas).map((m) => [m, 1])), pools, fonte, linhas };
  console.log(`Auls_Uprising: ${Object.values(pools).map((l) => l.length).join(' / ')} auras`);
}
// O EMBLEMA DO PRECURSOR: o pool por CARGA (a linha que fala da carga) e cada marcação, quantas de cada
{
  const { fonte, linhas } = linhasDaAba('Precursors_Emblem', /Modificadores$/);
  const daCarga = (l) => (/Frenesi/.test(l.texto) ? 'frenesi' : /Tolerância/.test(l.texto) ? 'tolerancia' : /Poder/.test(l.texto) ? 'poder' : null);
  const cargas = { frenesi: linhas.filter((l) => daCarga(l) === 'frenesi'), tolerancia: linhas.filter((l) => daCarga(l) === 'tolerancia'), poder: linhas.filter((l) => daCarga(l) === 'poder') };
  const sem = linhas.filter((l) => !daCarga(l));
  if (sem.length) throw new Error(`Precursor: linhas sem carga: ${sem.map((l) => l.texto).join('; ')}`);
  const N = { One: 1, Two: 2, Three: 3 };
  const C = { Power: 'poder', Frenzy: 'frenesi', Endurance: 'tolerancia' };
  const marcas = ['[Three Power Charge mods]', '[Three Frenzy Charge mods]', '[Three Endurance Charge mods]', '[Endurance Charge mod]', '[Frenzy Charge mod]', '[Power Charge mod]',
    '[Two Endurance Charge mods and one Power Charge Mod]', '[One Endurance Charge mod and Two Power Charge Mods]', '[Two Frenzy Charge mods and one Power Charge Mod]',
    '[One Frenzy Charge mod and Two Power Charge Mods]', '[Two Endurance Charge mods and one Frenzy Charge Mod]', '[One Endurance Charge mod and Two Frenzy Charge Mods]'];
  const composicao = Object.fromEntries(marcas.map((m) => [m, [...m.matchAll(/(?:(One|Two|Three) )?(Power|Frenzy|Endurance) Charge [Mm]ods?/gi)].map(([, n, c]) => [C[c[0].toUpperCase() + c.slice(1).toLowerCase()], N[n ? n[0].toUpperCase() + n.slice(1).toLowerCase() : 'One']])]));
  unicos.Precursors_Emblem = { classe: 'Rings', substitui: Object.fromEntries(marcas.map((m) => [m, 'composicao'])), composicao, pools: cargas, fonte, linhas };
  console.log(`Precursors_Emblem: frenesi ${cargas.frenesi.length}, tolerância ${cargas.tolerancia.length}, poder ${cargas.poder.length}`);
}
// (08/11, balão 0 sem efeito — o dono: "os velados já revelados, sorteados do pool do PoE") os MODS VELADOS da Traição nos únicos ("veiled mod seed [N,…]" /
// "veiled mod type [T]"): o pool dos revelados é o da aba "Oculto Modificadores" do poedb (a página do Orbe do Caos Velado — 233 mods, com o peso por tag do item; o
// peso de cada mod é o da PRIMEIRA tag da lista que a peça tem, como no PoE). T = 2: um Sufixo; 4: um Prefixo (+ os da Catarina — o Ponto do Vínculo Amargurado, os
// Espectros); 3 e 6: um Prefixo e um Sufixo (o "seed" N = 2). A linha do tipo sai (a composição vazia); a Bengala de Kulemak multiplica os revelados ("Magnitude de
// Modificadores Revelados aumentada" — `gerar.modificadoresDoUnico`).
{
  const velado = JSON.parse(readFileSync(`${PASTA}/Veiled_Chaos_Orb.json`, 'utf8'));
  const tab = velado.abas.find((x) => x.id === 'OcultoModificadores')?.cards.flatMap((c) => c.tabelas ?? []).flatMap((t) => t.linhas ?? []) ?? [];
  if (!tab.length) throw new Error('Velados: a aba "Oculto Modificadores" não está no arquivo do Scrapling');
  const peso = (r, tags) => { for (const p of String(r[4]).split(' / ')) { const [t, w] = p.trim().split(' '); if (t === 'default' || tags.includes(t)) return Number(w) || 0; } return 0; };
  const TAGS = { Belts: ['belt'], Rings: ['ring'], Helmets: ['helmet', 'armour'], Shields: ['shield', 'armour'], Body_Armours: ['body_armour', 'armour'], Bows: ['bow', 'two_hand_weapon', 'weapon', 'ranged'], Warstaves: ['staff', 'warstaff', 'two_hand_weapon', 'weapon'], Thrusting_One_Hand_Swords: ['sword', 'rapier', 'one_hand_weapon', 'weapon'] };
  const VELADOS = { Hyperboreus: 'Belts', Vivinsect: 'Rings', The_Queens_Hunger: 'Body_Armours', The_Devouring_Diadem: 'Helmets', Bitterbind_Point: 'Shields', The_Crimson_Storm: 'Bows', Cane_of_Kulemak: 'Warstaves', Paradoxica: 'Thrusting_One_Hand_Swords', Replica_Paradoxica: 'Thrusting_One_Hand_Swords' };
  const COMPOSICAO = { 2: [['sufixo', 1]], 4: [['prefixo', 1]], 3: [['prefixo', 1], ['sufixo', 1]], 6: [['prefixo', 1], ['sufixo', 1]] };
  const CAT = JSON.parse(readFileSync(new URL('../gamedata/itens-poe/catalogo-itens.json', import.meta.url), 'utf8'));
  for (const [slug, classe] of Object.entries(VELADOS)) {
    const u = CAT.classes[classe]?.unicos?.find((x) => x.slug === slug);
    const tipo = Number(/^veiled mod type \[(\d+)\]$/.exec(u?.modificadores.find((m) => /^veiled mod type/.test(m.texto))?.texto ?? '')?.[1]);
    if (!u || !COMPOSICAO[tipo]) throw new Error(`Velados: ${slug} sem o tipo (${tipo})`);
    const tags = [...TAGS[classe], ...(tipo === 4 ? ['catarina_veiled_prefix'] : [])];
    const doTipo = (t) => tab.filter((r) => r[2] === t && peso(r, tags) > 0).map((r) => noFormatoDoCatalogo(String(r[3]).trim()));
    const pools = { prefixo: doTipo('Prefixo'), sufixo: doTipo('Sufixo') };
    const seed = u.modificadores.find((m) => /^veiled mod seed/.test(m.texto));
    const marcaDoTipo = u.modificadores.find((m) => /^veiled mod type/.test(m.texto)).modelo;
    unicos[slug] = { classe, substitui: { [seed.modelo]: 'composicao', [marcaDoTipo]: 'composicao' }, composicao: { [seed.modelo]: COMPOSICAO[tipo], [marcaDoTipo]: [] }, pools, fonte: velado.fonte, linhas: [...pools.prefixo, ...pools.sufixo], velado: true };
    console.log(`${slug}: tipo ${tipo} — ${pools.prefixo.length} prefixos, ${pools.sufixo.length} sufixos`);
  }
}
// (lote 56) Os NOMES SORTEADOS: a marcação "Passive Skill" do texto vira um nome — a Fuga Impossível, uma das pedras fundamentais da aba "Notável"
// do poedb (as que estão na árvore do jogo); a Chama e a Carne Proibida, um notável de ascendência (os da árvore do jogo — os 7 escondidos da
// variação do Exarca Supremo não estão nela). Com a mesma chance.
const ARVORE = JSON.parse(readFileSync(new URL('../gamedata/itens-poe/arvore-poe.json', import.meta.url), 'utf8'));
const pedras = new Set(ARVORE.nos.filter((n) => n.tipo === 'keystone' && !n.ascendencia).map((n) => n.nome));
const fuga = JSON.parse(readFileSync(`${PASTA}/Impossible_Escape.json`, 'utf8'));
const doPoedb = fuga.abas.find((x) => x.id === 'Notável').cards.flatMap((c) => c.tabelas ?? []).flatMap((t) => t.linhas ?? []).map((r) => String(r[0]).trim());
const foraDaArvore = doPoedb.filter((n) => !pedras.has(n));
unicos.Impossible_Escape = { classe: 'Jewels', fonte: fuga.fonte, nomeSorteado: { marca: 'Passive Skill', nomes: doPoedb.filter((n) => pedras.has(n)), ...(foraDaArvore.length ? { foraDaArvore } : {}) } };
console.log(`Impossible_Escape: ${unicos.Impossible_Escape.nomeSorteado.nomes.length} pedras fundamentais (fora da árvore: ${foraDaArvore.join(', ') || 'nenhuma'})`);
// (lote 79) o MEGALOMANÍACO: "[Three random notable modifiers]" vira 3 dos 287 mods da aba "Megalomaniac Mods" do poedb ("All non-unique notables from
// any size cluster jewels have a chance to roll" — todos com peso 1000, cada um com o nível do mod). Cada linha leva o notável (a chave de
// `ramificadoras.json` — os nós saem dele) e o nível: pelo texto do mod da Ramificadora, pelo nome, ou pelo apelido (o poedb traduziu alguns
// nomes de outro jeito no mod do Megalomaníaco); as duas "Inspiração Ancestral" pelo nível (68: a Ancestral, 50: a Eldritch).
const RAMIFICADORAS = JSON.parse(readFileSync(new URL('../gamedata/itens-poe/ramificadoras.json', import.meta.url), 'utf8'));
const APELIDOS = {
  'Presença Rancorosa': 'Presença Malévola', 'Presença Eletrizante': 'Presença Elétrica', 'Caminho Casto': 'Caminho Virtuoso', 'Explore a Fraqueza': 'Explorar a Fraqueza',
  'Espíritos Aprisionados': 'Espíritos Aprisionadores', 'Mistura Cravada': 'Composto Tonificado', 'Agravar Ferimentos': 'Agravar Ferimento', 'Suserano': 'Soberano',
  'Leve a Destruição': 'Liderar a Destruição', 'Exaurir Psiquê': 'Exaurir a Psique', 'Sádico': 'Sadista', 'Toque de Crueldade': 'Toque da Crueldade',
  'Presentes Inefáveis': 'Dons Inefáveis', 'Garras Pútrida': 'Garras Pútridas', 'Envolta em Chamas': 'Envolto em Chamas', 'Ferimento Composto': 'Ferida Composta',
  'Tempestade de Raios': 'Trovoada', 'Olho Malígno': 'Olho Perverso', 'Rancor de Doedre': 'Despeito de Doedre', 'Agonia Pura': 'Pura Agonia',
  'Lealdade Rúnica': 'Runa da Lealdade', 'Tática de Guerrilha': 'Táticas de Guerra', 'Reforço do Hábito': 'Reforço da Hábito', 'Capacitador': 'Capacitor', 'Instrospecção': 'Introspecção',
};
{
  const mega = JSON.parse(readFileSync(`${PASTA}/Megalomaniac.json`, 'utf8'));
  const tabela = mega.abas.find((x) => x.id === 'MegalomaniacMods')?.cards.flatMap((c) => c.tabelas ?? []).flatMap((t) => t.linhas ?? []) ?? [];
  const porMod = new Map(RAMIFICADORAS.mods.filter((m) => m.notavel).map((m) => [String(m.modelo).replace('{0}', '1'), m.notavel]));
  // (sem acento nem maiúscula: "Quebra-crânios" × "Quebra-Crânios")
  const norm = (x) => String(x ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const porNome = new Map(Object.keys(RAMIFICADORAS.notaveis).map((k) => [norm(k), k]));
  const linhas = tabela.map(([, texto, , nivel]) => {
    const t = String(texto).trim();
    const nome = / é (.+)$/.exec(t)?.[1];
    const inspiracao = nome === 'Inspiração Ancestral' ? (Number(nivel) >= 68 ? 'Inspiração Ancestral' : 'Inspiração Ancestral (Eldritch Inspiration)') : null;
    const notavel = inspiracao ?? porMod.get(t) ?? porNome.get(norm(nome)) ?? porNome.get(norm(APELIDOS[nome]));
    if (!notavel) throw new Error(`Megalomaníaco: o notável de "${t}" não está em ramificadoras.json`);
    return { ...noFormatoDoCatalogo(t), notavel, nivel: Number(nivel) || 1 };
  });
  unicos.Megalomaniac = { classe: 'Jewels', substitui: { '[Three random notable modifiers]': 3 }, fonte: mega.fonte, linhas };
  console.log(`Megalomaniac: ${linhas.length} linhas, ${new Set(linhas.map((l) => l.notavel)).size} notáveis`);
}
const notaveis = ARVORE.nos.filter((n) => n.ascendencia && n.tipo === 'notable').map((n) => n.nome);
for (const slug of ['Forbidden_Flame', 'Forbidden_Flesh']) unicos[slug] = { classe: 'Jewels', fonte: `https://poedb.tw/pt/${slug}`, nomeSorteado: { marca: 'Passive Skill', nomes: notaveis } };
console.log(`Forbidden_Flame / Forbidden_Flesh: ${notaveis.length} notáveis de ascendência`);
writeFileSync(DESTINO, `${JSON.stringify({
  _nota: 'As LINHAS SORTEADAS das únicas de joia do PoE (lote 55, J31): `substitui` — a linha de marcação do catálogo ("[Two random aura modifiers]") → quantas linhas do pool `linhas` ela vira, sem repetir e com a mesma chance (o poedb não dá o peso). (lote 56) `nomeSorteado` — a marcação `marca` ("Passive Skill") do texto vira um dos `nomes` (a pedra fundamental da Fuga Impossível, o notável de ascendência da Chama/Carne Proibida). A coleção não traz; o catálogo põe por cima (`itens-poe/catalogo.mjs`) e o gerador sorteia (`itens-poe/gerar.modificadoresDoUnico`). Feito por `tools/importar-poedb-sorteados.mjs` a partir das abas "Modificadores" do poedb (o Scrapling).',
  geradoEm: new Date().toISOString(),
  unicos,
}, null, 1)}\n`);
console.log(`→ ${DESTINO.pathname}`);
