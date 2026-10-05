// Monta `gamedata/itens-poe/campanha-poe.json`: a CAMPANHA do PoE (os 10 atos e o Epílogo da coleção do Drive — poe-atos) no formato que
// o Draevor vai usar (sistema de itens do PoE, incremento C1 — só entra no jogo com ITENS_POE=1). Decisões do dono (05/10): a campanha do
// PoE SUBSTITUI a do Draevor com o PoE ligado; o terreno de cada área é um MAPA do Draevor de ambientação parecida (trocável no editor);
// os monstros são os do PoE (status por nível) no desenho de uma criatura do Draevor.
//
// Por área: id (`poe-a<ato>-<slug>`), nome, ato, nível, cidade/waypoint, conexões (ids), chefes, tags, a nota de ambientação, o MAPA do
// Draevor escolhido (palavras-chave do nome e das tags → a ambientação das 48 hunts do Draevor, revezando dentro dela) e os monstros com os
// status do PoE (vida, dano, tempo de ataque, armadura, evasão, escudo de energia, resistências, experiência). Por ato: as áreas na ordem e
// o chefe de ato (com os status da versão de campanha).
//
// Uso: node tools/montar-campanha-poe.mjs
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';

const ORIGEM = '/home/deploy/referencias-poe/original/poe-atos';
const DESTINO = new URL('../gamedata/itens-poe/campanha-poe.json', import.meta.url);
const CAMPANHA = JSON.parse(readFileSync(new URL('../gamedata/campanha.json', import.meta.url), 'utf8'));
const CONTEUDO = JSON.parse(readFileSync(new URL('../gamedata/campanha-conteudo.json', import.meta.url), 'utf8'));

/** As hunts do Draevor por ambientação (`campanha-conteudo.json`), na ordem do level original. */
const HUNTS_POR_AMBIENTE = {};
for (const f of [...CAMPANHA.fases].sort((a, b) => a.levelOriginal - b.levelOriginal)) {
  const amb = CONTEUDO.fases?.[f.huntId]?.ambiente ?? 'outro';
  (HUNTS_POR_AMBIENTE[amb] ??= []).push(f.huntId);
}

/** Palavra-chave do nome/tags da área do PoE → as ambientações do Draevor que servem (a primeira que casar vale). */
const REGRAS_DE_MAPA = [
  [/prisão|prison/i, ['prisão', 'masmorra']],
  [/esgoto|canais|aqueduto|sewer/i, ['esgoto']],
  [/deserto|oásis|lago seco|vastiri/i, ['deserto', 'savana']],
  [/caverna|gruta|cavern|minas|veias de cristal|túnel|pedreira/i, ['caverna', 'gruta', 'mina']],
  [/cripta|catacumba|ossuário|câmara dos pecados|relicário|crematório|câmaras desecradas|necrópole/i, ['catacumba', 'tumba', 'necrópole']],
  [/templo|santuário|maligaro|solaris|lunaris/i, ['templo', 'santuário']],
  [/ventre da besta|núcleo em putrefação|comedouro/i, ['coluna viva', 'floresta corrompida', 'abismo']],
  [/sonho|grande arena/i, ['pesadelo', 'plano sombrio']],
  [/fervente|refinaria|incendiad|kaom|fire_area/i, ['vale de fogo', 'inferno']],
  [/telhado|torre|ascensão/i, ['torre']],
  [/weaver|aposentos/i, ['covil']],
  [/ruínas|cidade vaal|vaal/i, ['ruínas', 'pirâmide']],
  [/sarn|favelas|mercado|praça|corte|esplanada|jardins|balneário|biblioteca|highgate|oriath|quartel|frente de batalha|central de comando|abrigo escravo|capataz|docas|porto|ponte do porto|urban/i, ['fortaleza', 'palácio', 'muralha', 'bastião', 'campo de guerra']],
  [/costa|litoral|ilha|lagoa|lamaçal|farol|recife|inundad|submersa|shore|area_with_water/i, ['pântano']],
  [/floresta|matagal|bosque|campos|caminhos fluviais|acampamento|encruzilhada|ponte|desfiladeiro|escalada|cordilheira|contraforte|descida|forest/i, ['floresta', 'selva', 'savana', 'montanha', 'acampamento']],
];
const vezes = {};
function mapaDaArea(area) {
  // Primeiro pelo NOME (a tag de água está em metade das áreas e puxava floresta e desfiladeiro para o pântano); sem nada no nome, as tags.
  const ambientes = REGRAS_DE_MAPA.find(([re]) => re.test(area.nome))?.[1] ?? REGRAS_DE_MAPA.find(([re]) => re.test((area.detalhe?.tags ?? []).join(' ')))?.[1] ?? Object.keys(HUNTS_POR_AMBIENTE);
  const lista = ambientes.flatMap((a) => HUNTS_POR_AMBIENTE[a] ?? []);
  const chave = ambientes.join('|');
  const i = (vezes[chave] = (vezes[chave] ?? -1) + 1);
  return lista.length ? lista[i % lista.length] : CAMPANHA.fases[0].huntId;
}

const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const monstro = (m) => ({
  slug: m.slug,
  nome: m.nome,
  nivel: m.nivel,
  unico: !!m.unico,
  experiencia: m.experiencia ?? 0,
  dano: m.dano ?? 0,
  tempoAtaque: m.tempo_ataque ?? 1.5,
  vida: m.vida ?? 1,
  armadura: m.armadura ?? 0,
  evasao: m.evasao ?? 0,
  escudoDeEnergia: m.escudo_energia ?? 0,
  resistencias: { fire: m.res_fogo ?? 0, ice: m.res_gelo ?? 0, energy: m.res_raio ?? 0, chaos: m.res_caos ?? 0 },
});

const pastas = readdirSync(ORIGEM).filter((d) => /^Ato_\d+$/.test(d) || d === 'Epilogo').sort();
const atos = [];
const areas = {};
for (const pasta of pastas) {
  const a = JSON.parse(readFileSync(`${ORIGEM}/${pasta}/ato.json`, 'utf8'));
  const numero = pasta === 'Epilogo' ? 11 : Number(pasta.slice(4));
  // Até 40 caracteres (o limite do id de fase do Draevor), sem repetir.
  const idDe = (s) => `poe-a${numero}-${slug(s)}`.slice(0, 40).replace(/-$/, '');
  const ids = [];
  // A posição de cada área no mapa do ato (os pinos do mapa do PoE), ajustada à tela do ato do Draevor (920 × 520).
  const pinos = a.mapa?.pinos ?? [];
  const xs = pinos.map((p) => p.x);
  const ys = pinos.map((p) => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const posicaoDe = (s) => {
    const p = pinos.find((q) => q.slug === s);
    if (!p || !(x1 > x0) || !(y1 > y0)) return null;
    return { x: Math.round(40 + ((p.x - x0) / (x1 - x0)) * 840), y: Math.round(30 + ((p.y - y0) / (y1 - y0)) * 460) };
  };
  for (const ar of a.areas) {
    const id = idDe(ar.slug);
    if (areas[id]) continue;
    ids.push(id);
    // Os monstros sem repetir (o PoE lista o mesmo monstro várias vezes, um por variante).
    const vistos = new Set();
    const monstros = (ar.detalhe?.monstros ?? []).map(monstro).filter((m) => {
      const k = `${m.slug}:${m.nivel}`;
      if (vistos.has(k)) return false;
      vistos.add(k);
      return true;
    });
    areas[id] = {
      id,
      slug: ar.slug,
      nome: ar.nome,
      ato: numero,
      nivel: ar.nivel ?? ar.detalhe?.nivel ?? 1,
      ...(ar.cidade ? { cidade: true } : {}),
      ...(ar.waypoint ? { waypoint: true } : {}),
      conexoes: (ar.detalhe?.conectada_a ?? []).map((c) => idDe(c.slug)),
      chefes: (ar.chefes_e_monstros_unicos ?? []).map((c) => c.nome),
      tags: ar.detalhe?.tags ?? [],
      ...(ar.detalhe?.notas ? { notas: ar.detalhe.notas } : {}),
      mapa: ar.cidade ? null : mapaDaArea(ar),
      ...(posicaoDe(ar.slug) ? { posicao: posicaoDe(ar.slug) } : {}),
      monstros,
    };
  }
  atos.push({ numero, nome: numero === 11 ? 'Epílogo' : `Ato ${numero}`, areas: ids });
}
// As conexões só para áreas que existem (as "saídas" para outro ato ficam de fora: a ordem dos atos liga um ao outro).
for (const ar of Object.values(areas)) ar.conexoes = [...new Set(ar.conexoes.filter((c) => areas[c] && c !== ar.id))];
// Área sem a tabela de monstros (o poedb omite algumas): os monstros da área de nível mais perto — conectada primeiro, senão do mesmo ato.
for (const ar of Object.values(areas)) {
  if (ar.cidade || ar.monstros.length) continue;
  const comMonstros = (lista) => lista.map((id) => areas[id]).filter((x) => x && !x.cidade && x.monstros.length && !x.monstrosDe);
  const perto = (lista) => lista.sort((a, b) => Math.abs(a.nivel - ar.nivel) - Math.abs(b.nivel - ar.nivel))[0];
  const fonte = perto(comMonstros(ar.conexoes)) ?? perto(comMonstros(Object.keys(areas).filter((id) => areas[id].ato === ar.ato)));
  if (fonte) {
    ar.monstros = fonte.monstros.filter((m) => !m.unico).map((m) => ({ ...m }));
    ar.monstrosDe = fonte.id;
  }
}

/*
 * A BASE de cada status por nível, tirada das fórmulas dos monstros ("22(Base Stat) * 1.8(...)" → nível 1: 22). É com ela que se calcula o
 * chefe que a coleção só traz no nível de mapa: base do nível da campanha × os multiplicadores dele.
 */
const BASE_POR_NIVEL = { vida: {}, dano: {}, experiencia: {}, armadura: {} };
for (const pasta of pastas) {
  const a = JSON.parse(readFileSync(`${ORIGEM}/${pasta}/ato.json`, 'utf8'));
  for (const ar of a.areas) for (const m of ar.detalhe?.monstros ?? []) for (const k of Object.keys(BASE_POR_NIVEL)) {
    const b = Number(String(m.formulas?.[k] ?? '').match(/^([\d.]+)\(Base Stat\)/)?.[1]);
    if (b > 0 && m.nivel) BASE_POR_NIVEL[k][m.nivel] = b;
  }
}
const baseNo = (k, nivel) => {
  const t = BASE_POR_NIVEL[k];
  if (t[nivel]) return t[nivel];
  const niveis = Object.keys(t).map(Number).sort((x, y) => Math.abs(x - nivel) - Math.abs(y - nivel));
  return niveis.length ? t[niveis[0]] : 0;
};
const pct = (s) => (s == null ? null : Number(String(s).replace(/[^\d.-]/g, '')) / 100 || null);
/** Os multiplicadores de monstro ÚNICO de chefe de área do PoE (os da fórmula da Merveil: vida ×7,98 ×1,74; dano ×0,67 ×1,7). */
const UNICO = { vida: 7.98 * 1.74, dano: 0.67 * 1.7 };
/** O chefe calculado no nível da campanha a partir da versão de mapa (multiplicadores + resistências da primeira dificuldade). */
function chefeCalculado(c, nivel) {
  const v = c.versoes?.[0];
  if (!v?.multiplicadores) return null;
  const mult = v.multiplicadores;
  const res = (k) => Number(String(v.resistencias?.[k]?.por_dificuldade ?? '').split('/')[0].replace(/[^\d.-]/g, '')) || 0;
  return {
    slug: v.poedb_slug ?? c.chefe_en,
    nome: v.nome_pt ?? c.chefe_pt,
    nivel,
    unico: true,
    experiencia: Math.round(baseNo('experiencia', nivel) * (pct(mult['Experiência']) ?? 1) * 5.5),
    dano: Math.round(baseNo('dano', nivel) * (pct(mult.Damage) ?? 1) * UNICO.dano),
    tempoAtaque: Number(String(mult['Attack Time'] ?? '').replace(/[^\d.]/g, '')) || 1.5,
    vida: Math.round(baseNo('vida', nivel) * (pct(mult.Vida) ?? 1) * UNICO.vida),
    armadura: Math.round(baseNo('armadura', nivel) * (1 + (pct(mult.Armadura) ?? 0))),
    evasao: 0,
    escudoDeEnergia: 0,
    resistencias: { fire: res('fogo'), ice: res('gelo'), energy: res('raio'), chaos: res('caos') },
    calculado: true,
  };
}

// Os chefes de ato (a versão de campanha: o monstro do chefe na área dele).
const chefes = {};
const pastaChefes = `${ORIGEM}/Chefes`;
for (const d of existsSync(pastaChefes) ? readdirSync(pastaChefes).sort() : []) {
  const arq = `${pastaChefes}/${d}/chefe.json`;
  if (!existsSync(arq)) continue;
  const c = JSON.parse(readFileSync(arq, 'utf8'));
  const principal = c.monstros_relacionados_na_area?.find((m) => m.unico && (m.nome.startsWith(c.chefe_pt.split(',')[0]) || m.slug.includes(c.chefe_en.split(' ')[0]))) ?? c.monstros_relacionados_na_area?.find((m) => m.unico);
  chefes[c.ato] = {
    ato: c.ato,
    nome: c.chefe_pt,
    nomeEn: c.chefe_en,
    area: c.area_do_chefe?.nome ?? null,
    nivel: c.area_do_chefe?.nivel ?? principal?.nivel ?? 1,
    // Sem o monstro da campanha na coleção: calculado (base do nível × multiplicadores da versão de mapa).
    ...(principal ? { monstro: monstro(principal) } : chefeCalculado(c, c.area_do_chefe?.nivel ?? 1) ? { monstro: chefeCalculado(c, c.area_do_chefe?.nivel ?? 1) } : {}),
    acompanhantes: (c.monstros_relacionados_na_area ?? []).filter((m) => m !== principal && m.unico).map(monstro),
  };
}

const saida = {
  _nota: 'A CAMPANHA do PoE (10 atos + Epílogo) para o Draevor — gerada por tools/montar-campanha-poe.mjs da coleção do Drive (poe-atos). Só entra no jogo com ITENS_POE=1 (incremento C3). `mapa`: a hunt do Draevor cujo terreno a área usa (escolhida pela ambientação; trocável no editor); `monstros`: os do PoE com os status por nível (C2 dá o desenho de uma criatura do Draevor). Cidades não têm mapa nem monstros.',
  atos,
  areas,
  chefes,
};
writeFileSync(DESTINO, JSON.stringify(saida) + '\n');
const lista = Object.values(areas);
const mapasUsados = new Set(lista.map((a) => a.mapa).filter(Boolean));
console.log(`${atos.length} atos, ${lista.length} áreas (${lista.filter((a) => a.cidade).length} cidades), ${lista.reduce((n, a) => n + a.monstros.length, 0)} monstros por área, ${mapasUsados.size} mapas do Draevor usados, ${Object.keys(chefes).length} chefes de ato`);
