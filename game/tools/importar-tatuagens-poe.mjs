#!/usr/bin/env node
// (100% — lote "dados", 03/11) As TATUAGENS do PoE (as do Ancestral — "Substitui uma Habilidade Passiva Pequena de Força"…) → o repositório:
//   - `gamedata/itens-poe/tatuagens-poe.json`: as 60 tatuagens da página do poedb (https://poedb.tw/pt/Tattoo), extraídas pelo Scrapling
//     (`/home/deploy/scrapling/extrair/tatuagens.py` → `saida/tatuagens/tatuagens.json`): o nome, o que cada uma SUBSTITUI (a pequena de um
//     atributo, o notável de +30 de um atributo, o notável de ascendência), o "Limitado a", as linhas, a tribo, o nível de drop e o id de item
//     (ESTÁVEL: só cresce — 917.001+);
//   - os ícones (11 desenhos) em `gamedata/itens-poe/icones-moedas/Tatuagem_<desenho>.png` — o PNG do CDN oficial do PoE (o mesmo desenho do
//     webp do poedb; já baixado é pulado), servidos como as moedas (`/api/jogo/poe/icone/moeda/`).
// O que cada uma faz no jogo, a regra de onde entra, o limite de 50 e o drop: `systems/passivas/tatuagens.mjs`.
// As páginas avulsas do poedb (Tattoo_of_the_Ngamahu_Warrior, Journey_Tattoo_of_the_Body, Forbidden_Tattoo_of_the_Witch) deram o resto:
// "Clique com o botão direito neste item, depois clique em uma Habilidade Passiva alocada. Máximo de 50 Tatuagens.", o DropLevel (1 nas comuns e
// nas Proibidas, 81 nas da Jornada) e o "Dropped by: <Tribo>" (a liga Ancestral).
//
//   node tools/importar-tatuagens-poe.mjs [saida/tatuagens do Scrapling]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

const PASTA = process.argv[2] ?? '/home/deploy/scrapling/saida/tatuagens';
const SAIDA = new URL('../gamedata/itens-poe/tatuagens-poe.json', import.meta.url);
const ICONES = new URL('../gamedata/itens-poe/icones-moedas/', import.meta.url);
const PRIMEIRO_ID = 917001;
const AGENTE = 'Mozilla/5.0 (DraevorIdle referencia local)';
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(ICONES, { recursive: true });

const ATRIBUTO = { Força: 'str', Destreza: 'dex', Inteligência: 'int' };
const CLASSE_DA_PROIBIDA = { Ranger: 'Ranger', Duelist: 'Duelist', Marauder: 'Marauder', Templar: 'Templar', Witch: 'Witch', Shadow: 'Shadow', Scion: 'Scion' };

const fonte = JSON.parse(readFileSync(`${PASTA}/tatuagens.json`, 'utf8'));
const antes = existsSync(SAIDA) ? JSON.parse(readFileSync(SAIDA, 'utf8')) : null;
const ids = Object.fromEntries((antes?.tatuagens ?? []).map((t) => [t.slug, t.itemId]));

/** "Substitui uma Habilidade Passiva Pequena de Força" → `{ tipo: 'pequena', atributo: 'str' }`; "+30 de Força Notável" → `notavel30`. */
function alvoDe(props) {
  const p = props.find((x) => /^Substitui uma Habilidade Passiva/.test(x)) ?? '';
  let m = /Pequena de (Força|Destreza|Inteligência)$/.exec(p);
  if (m) return { tipo: 'pequena', atributo: ATRIBUTO[m[1]] };
  m = /\+30 de (Força|Destreza|Inteligência) Notável$/.exec(p);
  if (m) return { tipo: 'notavel30', atributo: ATRIBUTO[m[1]] };
  if (/Notável de Ascendência$/.test(p)) return { tipo: 'ascendencia' };
  throw new Error(`alvo desconhecido: ${p}`);
}

const tatuagens = [];
for (const t of fonte) {
  const alvo = alvoDe(t.props);
  const limite = /^Limitado a: (\d+) (.+)$/.exec(t.props.find((x) => /^Limitado a:/.test(x)) ?? '');
  const tipo = /^Journey_/.test(t.slug) ? 'jornada' : /^Forbidden_/.test(t.slug) ? 'proibida' : 'comum';
  const desenho = /\/Ancestors\/([^/]+)\.webp$/.exec(t.icone ?? '')?.[1] ?? null;
  // (o poedb põe "Tatuagem da Jornada da Mente" também na da Alma — a linha dela diz "Tatuagem da Jornada da Alma")
  const nome = t.slug === 'Journey_Tattoo_of_the_Soul' ? 'Tatuagem da Jornada da Alma' : t.nome;
  tatuagens.push({
    slug: t.slug, nome, en: t.slug.replace(/_/g, ' '), tipo,
    tribo: tipo === 'comum' ? /^Tattoo_of_the_([A-Za-z]+)_/.exec(t.slug)?.[1] ?? null : null,
    alvo,
    ...(limite ? { limite: { n: Number(limite[1]), grupo: tipo === 'proibida' ? 'ascendencia' : limite[2] } } : {}),
    ...(tipo === 'proibida' ? { classe: CLASSE_DA_PROIBIDA[/^Forbidden_Tattoo_of_the_(\w+)$/.exec(t.slug)?.[1]] ?? null } : {}),
    linhas: t.linhas,
    nivelDoDrop: tipo === 'jornada' ? 81 : 1,
    desenho, icone: desenho ? `Tatuagem_${desenho}.png` : null, fonteDaImagem: t.icone ?? null,
  });
}
let proximo = Math.max(PRIMEIRO_ID - 1, ...Object.values(ids)) + 1;
for (const t of [...tatuagens].sort((a, b) => a.slug.localeCompare(b.slug))) ids[t.slug] ??= proximo++;

// os ícones (o PNG oficial do mesmo desenho)
let baixados = 0;
const semIcone = [];
for (const d of [...new Set(tatuagens.map((t) => t.desenho).filter(Boolean))]) {
  const alvo = new URL(`Tatuagem_${d}.png`, ICONES);
  if (existsSync(alvo)) continue;
  const url = `https://web.poecdn.com/image/Art/2DItems/Currency/Ancestors/${d}.png`;
  await esperar(200);
  const r = await fetch(url, { headers: { 'user-agent': AGENTE } }).catch(() => null);
  if (r?.ok) {
    writeFileSync(alvo, Buffer.from(await r.arrayBuffer()));
    baixados++;
  } else semIcone.push(d);
}
for (const t of tatuagens) {
  t.itemId = ids[t.slug];
  if (t.icone && !existsSync(new URL(t.icone, ICONES))) t.icone = null;
  delete t.fonteDaImagem;
  delete t.desenho;
}
writeFileSync(SAIDA, `${JSON.stringify({
  _nota: 'As TATUAGENS do PoE (tools/importar-tatuagens-poe.mjs, do poedb pt — https://poedb.tw/pt/Tattoo). O que cada uma faz no jogo, onde entra (o `alvo`), o limite de 50 e o drop: systems/passivas/tatuagens.mjs. `itemId`: ESTÁVEL (só cresce, 917.001+).',
  fonte: 'https://poedb.tw/pt/Tattoo (+ Tattoo_of_the_Ngamahu_Warrior, Journey_Tattoo_of_the_Body, Forbidden_Tattoo_of_the_Witch)',
  maximo: 50,
  tatuagens,
}, null, 1)}\n`);
console.log(`${tatuagens.length} tatuagens; ícones baixados agora: ${baixados}; sem ícone: ${semIcone.length ? semIcone.join(', ') : 'nenhum'}`);
