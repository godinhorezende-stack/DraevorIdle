// O RELATÓRIO DE IMPLEMENTAÇÃO DAS GEMAS DO PoE (dono, 17/10: "um relatório automatizado de implementação das gemas … antes e depois de
// cada lote"). Lê o que o CÓDIGO faz — o status no jogo de cada gema ativa (`itens-poe/gemas-poe.mjs`) e de cada suporte
// (`itens-poe/suportes-poe.mjs`), os ícones no repositório, a compatibilidade (`suportes-compat.json`) e os testes que citam a gema —, sem
// classificação manual.
//
//   ITENS_POE=1 node tools/relatorio-gemas-poe.mjs            → docs/gemas-poe-implementacao.md (+ .json)
//   ITENS_POE=1 node tools/relatorio-gemas-poe.mjs --resumo   → só os totais na tela (para o antes/depois de cada lote)
//
// Os ESTADOS (o pedido do dono):
//   - "implementada e testada": status `funciona` e algum teste cita a gema;  "implementada, sem teste próprio": `funciona`, nenhum teste a cita;
//   - "parcial": falta alguma linha ("efeito não simulado" / "não simulado") ou mecânica;
//   - "limitação do modelo idle": parcial SÓ por limitações documentadas do idle (o totem parado, o lacaio com a força do PoB, o deslocamento…);
//   - "sem efeito": status `nao`;  "dados ausentes": a gema não tem linhas/tabela no catálogo.
import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.ITENS_POE ??= '1';
const RAIZ = new URL('../', import.meta.url);
const G = await import('../systems/itens-poe/gemas-poe.mjs');
const SP = await import('../systems/itens-poe/suportes-poe.mjs');
await G.iniciar({ registrarGema: () => {}, registrarReforco: () => {} });
SP.iniciar({ registrarSuporte: () => {} });

// Os textos de limitação do idle (documentados no próprio status; não são "efeito não simulado").
const LIMITACAO_IDLE = [/^o totem fica parado/, /^o lacaio ataca do jeito do tipo dele/, /^o deslocamento \(salto, investida, teleporte\) não existe/, /^sai sozinha, na barra/];
const ehAusencia = (m) => /^(efeito )?não simulado: /.test(m) || /ainda não (existe|se aplica)|não existem?:|não existe no jogo|nenhum efeito/.test(m);

// Os testes que citam cada slug (o nome do arquivo de teste e a linha não importam: só "há um teste que usa a gema").
const TESTES = readdirSync(new URL('testes/', RAIZ)).filter((f) => f.endsWith('.mjs')).map((f) => readFileSync(new URL(`testes/${f}`, RAIZ), 'utf8')).join('\n');
const citada = (slug) => TESTES.includes(`'${slug}'`) || TESTES.includes(`"${slug}"`) || TESTES.includes(`\`${slug}\``) || TESTES.includes(`${slug}`);

// Os ícones (arquivo no repositório + o mesmo desenho em duas gemas diferentes que não são variantes uma da outra).
const hashes = new Map();
function icone(pasta, slug) {
  // (o caminho, não a URL: o slug pode trazer %XX — "Maelstr%C3%B6m" — e a URL o decodificaria)
  const arq = join(fileURLToPath(new URL(`gamedata/itens-poe/${pasta}/`, RAIZ)), `${slug}.png`);
  if (!existsSync(arq) || !statSync(arq).size) return { ok: false };
  const h = createHash('sha1').update(readFileSync(arq)).digest('hex');
  (hashes.get(h) ?? hashes.set(h, []).get(h)).push(slug);
  return { ok: true, h };
}
const base = (slug) => slug.replace(/^(Vaal|Awakened|Greater)_/, '').replace(/_of_.*$/, '');

const ativas = [];
for (const [slug, r] of G.REGISTRO) {
  const g = r.gema;
  const motivos = r.motivosNoJogo ?? [];
  const ausentes = motivos.filter(ehAusencia);
  const idle = motivos.filter((m) => LIMITACAO_IDLE.some((re) => re.test(m)));
  const outros = motivos.filter((m) => !ausentes.includes(m) && !idle.includes(m));
  const semDados = !(g.mods?.length || g.linhas?.length);
  let estado;
  if (semDados) estado = 'dados ausentes';
  else if (r.statusNoJogo === 'nao') estado = 'sem efeito';
  else if (r.statusNoJogo === 'funciona') estado = citada(slug) ? 'implementada e testada' : 'implementada, sem teste próprio';
  else if (!ausentes.length && !outros.length && idle.length) estado = 'limitação do modelo idle';
  else estado = 'parcial';
  ativas.push({
    slug, nome: g.nome, variante: /^Vaal_/.test(slug) ? 'vaal' : /_of_[A-Za-z]+$/.test(slug) ? 'alternativa' : 'normal', ataque: !!r.ataque,
    arquetipo: r.arquetipo, estado, ausentes, idle, outros, icone: icone('icones-gemas', slug).ok, iconeHabilidade: !!JSON.parse(readFileSync(new URL('gamedata/itens-poe/icones-habilidades.json', RAIZ), 'utf8')).icones[slug],
  });
}
const suportes = [];
for (const [slug, r] of SP.REGISTRO) {
  const ausentes = (r.motivos ?? []).filter(ehAusencia);
  const estado = r.status === 'nao' ? 'sem efeito' : r.status === 'funciona' ? (citada(slug) ? 'implementada e testada' : 'implementada, sem teste próprio') : 'parcial';
  suportes.push({ slug, nome: r.suporte.nome, estado, ausentes, outros: (r.motivos ?? []).filter((m) => !ausentes.includes(m)), icone: icone('icones-suportes', slug).ok });
}

// O CATÁLOGO DO POEDB (as listas Skill_Gems e Support_Gems em pt, do cache do Scrapling — ver a memória "scrapling-poedb"): cada gema e o
// desenho dela no poedb ("Art/2DItems/Gems/Support/ChancetoFlee.webp"). Serve para (1) achar gema do poedb que falta no jogo (e vice-versa) e
// (2) separar o desenho repetido LEGÍTIMO (o poedb também usa o mesmo — o Pacifismo e a Chance de Fuga) da troca de ícone.
const HTML = process.env.POEDB_HTML ?? '/home/deploy/scrapling/saida/html';
const poedb = new Map();
for (const f of ['Skill_Gems.html', 'Support_Gems.html']) {
  if (!existsSync(join(HTML, f))) continue;
  const h = readFileSync(join(HTML, f), 'utf8');
  for (const m of h.matchAll(/<a[^>]*href="\/pt\/([^"#?]+)"[^>]*>\s*<img[^>]*src="([^"]+)"/g)) if (/\/Gems\//.test(m[2])) poedb.set(m[1], m[2].replace(/^.*\/Gems\//, ''));
}
const slugsLocais = new Set([...G.REGISTRO.keys(), ...SP.REGISTRO.keys()]);
const catalogo = poedb.size ? { poedb: poedb.size, faltamNoJogo: [...poedb.keys()].filter((k) => !slugsLocais.has(k)), soNoJogo: [...slugsLocais].filter((k) => !poedb.has(k)) } : null;
// Ícones repetidos entre gemas que não são variantes da mesma base E que o poedb desenha diferente (suspeita de troca).
const iconesRepetidos = [...hashes.values()].filter((l) => l.length > 1 && new Set(l.map(base)).size > 1 && (!poedb.size || new Set(l.map((x) => poedb.get(x) ?? x)).size > 1));

// Os EFEITOS COMPARTILHADOS: a mesma linha (números viram #) faltando em várias gemas — o que um lote pode resolver de uma vez.
const molde = (l) => l.replace(/^(efeito )?não simulado: /, '').replace(/-?\d+(?:[.,]\d+)?/g, '#').trim();
const compartilhados = new Map();
for (const x of [...ativas, ...suportes]) for (const l of x.ausentes) {
  const k = molde(l);
  (compartilhados.get(k) ?? compartilhados.set(k, new Set()).get(k)).add(x.slug);
}
const linhasFaltando = [...compartilhados].map(([k, s]) => ({ linha: k, gemas: [...s].sort() })).sort((a, b) => b.gemas.length - a.gemas.length || a.linha.localeCompare(b.linha));

// A COMPATIBILIDADE (bits por ativa, `suportes-compat.json`): quantas ativas têm a regra e quantos pares valem.
const compat = JSON.parse(readFileSync(new URL('gamedata/itens-poe/suportes-compat.json', RAIZ), 'utf8'));
const pares = Object.values(compat.ativas ?? {}).reduce((t, b64) => t + [...Buffer.from(b64, 'base64')].reduce((u, byte) => u + byte.toString(2).replace(/0/g, '').length, 0), 0);
const ativasSemRegra = ativas.filter((a) => !(a.slug in (compat.ativas ?? {}))).map((a) => a.slug);
const suportesSemRegra = suportes.filter((s) => !compat.suportes.includes(s.slug)).map((s) => s.slug);

const contar = (l, f = (x) => x.estado) => l.reduce((o, x) => ((o[f(x)] = (o[f(x)] ?? 0) + 1), o), {});
const totais = {
  ativas: { total: ativas.length, ...contar(ativas) },
  ataques: { total: ativas.filter((a) => a.ataque).length, ...contar(ativas.filter((a) => a.ataque)) },
  suportes: { total: suportes.length, ...contar(suportes) },
  variantes: { vaal: { total: ativas.filter((a) => a.variante === 'vaal').length, ...contar(ativas.filter((a) => a.variante === 'vaal')) }, alternativas: { total: ativas.filter((a) => a.variante === 'alternativa').length, ...contar(ativas.filter((a) => a.variante === 'alternativa')) } },
  compatibilidade: { ativasComRegra: ativas.length - ativasSemRegra.length, ativasSemRegra: ativasSemRegra.length, suportesComRegra: suportes.length - suportesSemRegra.length, suportesSemRegra: suportesSemRegra.length, pares },
  efeitosCompartilhados: { linhasDistintas: linhasFaltando.length, emDuasOuMais: linhasFaltando.filter((x) => x.gemas.length > 1).length },
  imagens: { ativasComIcone: ativas.filter((a) => a.icone).length, ativasComIconeDeHabilidade: ativas.filter((a) => a.iconeHabilidade).length, suportesComIcone: suportes.filter((s) => s.icone).length, repetidosSuspeitos: iconesRepetidos.length },
  catalogoPoedb: catalogo ?? { poedb: 'cache do poedb ausente' },
  // (17/10, lote G16) o teste GERAL: toda ativa `funciona` usada na caçada (dano ou buff) e todo suporte `funciona` com o efeito lido pelo jogo
  testes: { ativasCitadas: ativas.filter((a) => citada(a.slug)).length, suportesCitados: suportes.filter((s) => citada(s.slug)).length, testeGeral: existsSync(new URL('testes/gemas-todas-funcionam-poe.test.mjs', RAIZ)) ? 'gemas-todas-funcionam-poe.test.mjs' : 'ausente' },
};

const linha = (o) => Object.entries(o).map(([k, v]) => `${k} ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ');
if (process.argv.includes('--resumo')) {
  for (const [k, v] of Object.entries(totais)) console.log(`${k}: ${linha(v)}`);
  process.exit(0);
}

const ORDEM = ['implementada e testada', 'implementada, sem teste próprio', 'limitação do modelo idle', 'parcial', 'sem efeito', 'dados ausentes'];
const tabela = (t) => ORDEM.filter((e) => t[e]).map((e) => `| ${e} | ${t[e]} |`).join('\n');
let md = `# Gemas do PoE: estado da implementação\n\nGerado por \`ITENS_POE=1 node tools/relatorio-gemas-poe.mjs\` a partir do código (status no jogo de \`itens-poe/gemas-poe.mjs\` e \`itens-poe/suportes-poe.mjs\`), dos ícones em \`gamedata/itens-poe/\`, da compatibilidade (\`suportes-compat.json\`) e dos testes que citam cada gema. Nada é classificado à mão. **"Testada" quer dizer que algum teste cita a gema** — não que todas as linhas dela tenham teste.\n\n`;
md += `## Totais\n\n### Gemas de habilidade (${totais.ativas.total}; ataques: ${totais.ataques.total})\n\n| Estado | Gemas | \n|---|---|\n${tabela(totais.ativas)}\n\nSó os ataques:\n\n| Estado | Gemas |\n|---|---|\n${tabela(totais.ataques)}\n\n`;
md += `### Gemas de suporte (${totais.suportes.total})\n\n| Estado | Gemas |\n|---|---|\n${tabela(totais.suportes)}\n\n`;
md += `### Variantes\n\n- Vaal (${totais.variantes.vaal.total}): ${linha(Object.fromEntries(Object.entries(totais.variantes.vaal).filter(([k]) => k !== 'total')))}\n- Alternativas (${totais.variantes.alternativas.total}): ${linha(Object.fromEntries(Object.entries(totais.variantes.alternativas).filter(([k]) => k !== 'total')))}\n\n`;
md += `### Compatibilidade, efeitos compartilhados, imagens, testes\n\n- Compatibilidade: ${totais.compatibilidade.ativasComRegra} ativas e ${totais.compatibilidade.suportesComRegra} suportes com regra; ${totais.compatibilidade.pares} pares compatíveis; sem regra: ${totais.compatibilidade.ativasSemRegra} ativas, ${totais.compatibilidade.suportesSemRegra} suportes${ativasSemRegra.length ? ` (${ativasSemRegra.join(', ')})` : ''}${suportesSemRegra.length ? ` (${suportesSemRegra.join(', ')})` : ''}.\n- Efeitos compartilhados faltando: ${totais.efeitosCompartilhados.linhasDistintas} linhas distintas (${totais.efeitosCompartilhados.emDuasOuMais} em duas ou mais gemas).\n- Imagens: ${totais.imagens.ativasComIcone}/${totais.ativas.total} ativas com ícone da gema, ${totais.imagens.ativasComIconeDeHabilidade}/${totais.ativas.total} com ícone da habilidade, ${totais.imagens.suportesComIcone}/${totais.suportes.total} suportes; ${totais.imagens.repetidosSuspeitos} desenhos repetidos entre gemas de bases diferentes.\n- Catálogo do poedb (Skill_Gems + Support_Gems, pt): ${catalogo ? `${catalogo.poedb} gemas; faltam no jogo: ${catalogo.faltamNoJogo.join(', ') || 'nenhuma'}; só no jogo: ${catalogo.soNoJogo.join(', ') || 'nenhuma'}` : 'cache ausente'}.\n- Testes que citam a gema: ${totais.testes.ativasCitadas}/${totais.ativas.total} ativas, ${totais.testes.suportesCitados}/${totais.suportes.total} suportes.\n- Teste geral (\`testes/${totais.testes.testeGeral}\`): toda ativa \`funciona\` é usada de verdade numa caçada e precisa causar dano no alvo (ou ligar o buff); todo suporte \`funciona\` precisa de efeito sem linha não feita, e cada chave do efeito precisa ser lida pelo código do jogo. \"Sem teste próprio\" quer dizer que só esse teste geral cobre a gema.\n\n`;
if (iconesRepetidos.length) md += `#### Ícones repetidos (bases diferentes)\n\n${iconesRepetidos.map((l) => `- ${l.join(', ')}`).join('\n')}\n\n`;
md += `## Linhas que faltam (por quantidade de gemas)\n\n| Gemas | Linha |\n|---|---|\n${linhasFaltando.map((x) => `| ${x.gemas.length} | ${x.linha.replace(/\|/g, '\\|')} |`).join('\n')}\n\n`;
const secao = (titulo, l) => `## ${titulo}\n\n${l.map((x) => `- **${x.slug}** (${x.nome}) — ${x.estado}${[...x.ausentes, ...(x.outros ?? []), ...(x.idle ?? [])].length ? `\n${[...x.ausentes, ...(x.outros ?? []), ...(x.idle ?? []).map((m) => `_idle:_ ${m}`)].map((m) => `  - ${m}`).join('\n')}` : ''}`).join('\n')}\n\n`;
const naoFeitas = (l) => l.filter((x) => !x.estado.startsWith('implementada')).sort((a, b) => a.slug.localeCompare(b.slug));
md += secao('Gemas de habilidade pendentes', naoFeitas(ativas));
md += secao('Gemas de suporte pendentes', naoFeitas(suportes));
md += `## Implementadas sem teste próprio\n\n${[...ativas, ...suportes].filter((x) => x.estado === 'implementada, sem teste próprio').map((x) => x.slug).sort().join(', ') || '—'}\n`;

writeFileSync(new URL('../docs/gemas-poe-implementacao.md', RAIZ), md);
writeFileSync(new URL('../docs/gemas-poe-implementacao.json', RAIZ), JSON.stringify({ totais, ativas, suportes, linhasFaltando, iconesRepetidos }, null, 1));
for (const [k, v] of Object.entries(totais)) console.log(`${k}: ${linha(v)}`);
