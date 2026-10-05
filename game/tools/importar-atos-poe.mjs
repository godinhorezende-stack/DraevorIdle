// Importa os 10 ATOS do PoE (a coleção do Drive — poe-atos) para a aba Acts da engine (pedido do dono, 05/10: "o editor manda"): cada ato
// vira um ato do editor (`gamedata/atos/poe-ato-<n>.json`, estado `publicado`) que o jogo executa com o PoE ligado. O que vem do Drive:
//   - as FASES = as áreas de combate (nome, nível, posição no mapa do PoE), com o MAPA do Draevor e os monstros de `campanha-poe.json`;
//   - as RAMIFICAÇÕES = as ligações do mapa do PoE (a cidade liga os dois lados), orientadas a partir da primeira área (`atoDoRuntime`);
//   - as MISSÕES de cada área (Ligacoes/Ato_NN/ato-ligado.json) como objetivos da fase e, delas, a CONCLUSÃO:
//       item-de-missao — as missões em que um único da área carrega o item (tabela ITENS_DE_MISSAO abaixo, conferida no Drive);
//       matar-chefe    — a missão manda matar/derrotar um único da área;
//       limpar-hunt    — o resto;
//   - o CHEFE do ato depois da área de nível mais alto.
// Também grava os ITENS DE MISSÃO (`gamedata/itens-poe/itens-de-missao.json`, ids 7.600.000+) e a TABELA DE DROP de cada monstro alvo
// (`gamedata/itens-poe/drops-por-monstro.json`: o item da missão a 100%, só enquanto a missão está aberta). A tabela é editável na engine;
// rodar de novo SÓ ACRESCENTA o que falta nela (não apaga o que o dono configurou) e reescreve os atos.
//
// Uso: node tools/importar-atos-poe.mjs [--sem-atos]   (--sem-atos: só itens de missão e tabelas)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

const ORIGEM = '/home/deploy/referencias-poe/original/poe-atos/Ligacoes';
const C = JSON.parse(readFileSync(new URL('../gamedata/itens-poe/campanha-poe.json', import.meta.url), 'utf8'));
const PASTA_ATOS = new URL('../gamedata/atos/', import.meta.url);
const ARQ_ITENS = new URL('../gamedata/itens-poe/itens-de-missao.json', import.meta.url);
const ARQ_DROPS = new URL('../gamedata/itens-poe/drops-por-monstro.json', import.meta.url);
export const PRIMEIRO_ID_DE_MISSAO = 7_600_000;

/** [ato, área (pt), item, monstro que carrega (pt, começo do nome), missão] — as missões do Drive com item de um único da área. */
export const ITENS_DE_MISSAO = [
  [1, 'Ilha da Maré', 'Baú de Remédios', 'Hailrake', 'Missão de Caridade'],
  [1, 'Necrópole de Navios', 'Omnichama', 'Capitão Fairgraves', 'A Chama Espiritual'],
  [2, 'Aposentos da Weaver', 'Espinho de Maligaro', 'A Tecelã', 'Afiado e Cruel'],
  [4, 'Lago Seco', 'Estandarte de Deshret', 'Voll', 'Quebrando o Selo'],
  [4, 'Fortaleza de Kaom', 'Olho da Fúria', 'Rei Kaom', 'O Rei da Fúria'],
  [4, 'Grande Arena', 'Olho do Desejo', 'Daresso', 'O Rei do Desejo'],
  [5, 'Central de Comando', 'Olhos do Zelo', 'Justicar Casticus', 'Morte à Pureza'],
  [6, 'Ilha da Maré', 'Manuscrito do Bestel', 'Correnteza', 'Epopeia de Bestel'],
  [7, 'Santuário do Maligaro', 'Veneno Negro', 'Maligaro', 'Rede de Segredos'],
  [8, 'Balneário', 'Asas de Vastiri', 'Hector Titucius', 'As Asas de Vastiri'],
  [9, 'Deserto Vastiri', 'Lâmina da Tempestade', 'Rhex Maternal', 'A Lâmina da Tempestade'],
  [9, 'Contraforte', 'Calendário da Fortuna', 'Cabeça de Ferro', 'Fastis Fortuna'],
  [9, 'Lago Fervente', 'Ácido de Basilisco', 'O Basilisco', 'Pesadelo Recorrente'],
  [9, 'Pedreira', 'Pena de Sekhema', 'Garukhan', 'Soberano de Highgate'],
  [9, 'Refinaria', 'Pó de Trarthan', 'General Adus', 'Pesadelo Recorrente'],
  [10, 'Câmaras Desecradas', 'Cajado da Pureza', 'Avarius', 'Morte e Ressurreição'],
];

const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const lerJson = (u, padrao) => (existsSync(u) ? JSON.parse(readFileSync(u, 'utf8')) : padrao);
const unicosDa = (a) => (a?.monstros ?? []).filter((m) => m.unico);
const acharUnico = (a, nome) => unicosDa(a).find((m) => m.nome === nome || m.nome.startsWith(nome) || nome.startsWith(m.nome.split(',')[0]));
const areaDe = (ato, nome) => Object.values(C.areas).find((a) => a.ato === ato && a.nome === nome && !a.cidade);

/** As missões de cada área do Drive, por ato: `Map(slug da área → [{ missao, etapa, objetivos, alvos }])`. */
function missoesDoDrive(ato) {
  const arq = `${ORIGEM}/Ato_${String(ato).padStart(2, '0')}/ato-ligado.json`;
  const porArea = new Map();
  if (!existsSync(arq)) return porArea;
  for (const a of JSON.parse(readFileSync(arq, 'utf8')).areas ?? []) porArea.set(a.slug, (a.missoes_nesta_area ?? []).map((m) => ({ missao: m.missao, etapa: m.etapa, objetivos: (m.objetivos ?? []).filter((o) => o.length < 160), alvos: m.monstros_alvo ?? [] })));
  return porArea;
}

/** Os itens de missão (ids estáveis pela ordem da tabela). */
export function itensDeMissao() {
  return ITENS_DE_MISSAO.map(([ato, area, item, monstro, missao], i) => {
    const a = areaDe(ato, area);
    const m = a ? acharUnico(a, monstro) : null;
    return { id: PRIMEIRO_ID_DE_MISSAO + i + 1, nome: item, missao, ato, area: a?.id ?? null, monstro: m?.slug ?? null, monstroNome: m?.nome ?? monstro, descricao: `Item da missão "${missao}" (${ato === 11 ? 'Epílogo' : `Ato ${ato}`}): ${m?.nome ?? monstro} o carrega.` };
  });
}

/** A conclusão de uma área: o item da missão, matar o único que a missão manda matar, ou limpar. */
export function conclusaoDaArea(a, missoes, itens) {
  const it = itens.find((x) => x.area === a.id && x.monstro);
  if (it) return { tipo: 'item-de-missao', item: it.id, monstro: it.monstro, nome: it.monstroNome };
  for (const m of missoes) {
    const mata = m.objetivos.find((o) => /\b(Mate|Derrote|abata)\b/i.test(o));
    if (!mata) continue;
    const alvo = [...m.alvos.map((n) => acharUnico(a, n)), ...unicosDa(a).filter((u) => mata.includes(u.nome.split(',')[0]))].find(Boolean);
    if (alvo) return { tipo: 'matar-chefe', monstro: alvo.slug, nome: alvo.nome };
  }
  return { tipo: 'limpar-hunt' };
}

/** Os objetivos da fase (as missões do Drive que passam pela área: uma linha por missão). */
const objetivosDaArea = (missoes) => [...new Map(missoes.map((m) => [m.missao, { missao: m.missao, texto: m.objetivos[0] ?? '' }])).values()].slice(0, 8);

async function principal() {
  const soItens = process.argv.includes('--sem-atos');
  const itens = itensDeMissao();
  writeFileSync(ARQ_ITENS, `${JSON.stringify({ _nota: 'Itens de missão do PoE (tools/importar-atos-poe.mjs): entram no catálogo com ITENS_POE=1.', itens }, null, 1)}\n`);
  // A tabela de drop: acrescenta o item da missão no monstro alvo (sem apagar o que já está configurado).
  const drops = lerJson(ARQ_DROPS, { _nota: 'Tabela de drop por monstro (engine → Campanha do PoE / Acts). Chave: o slug do monstro do PoE. Cada linha: { id, chance (%), missao? } — `missao`: só enquanto a missão da fase está aberta.', monstros: {} });
  for (const it of itens) {
    if (!it.monstro) continue;
    const k = slug(it.monstro);
    const lista = (drops.monstros[k] ??= []);
    if (!lista.some((d) => d.id === it.id)) lista.push({ id: it.id, chance: 100, missao: true });
  }
  writeFileSync(ARQ_DROPS, `${JSON.stringify(drops, null, 1)}\n`);
  const sem = itens.filter((i) => !i.monstro).map((i) => i.nome);
  console.log(`itens de missão: ${itens.length}${sem.length ? ` (sem o monstro que carrega: ${sem.join(', ')})` : ' (todos com o monstro que carrega)'}`);
  if (soItens) return;
  process.env.ITENS_POE ??= '1';
  const { atoDoRuntime } = await import('../systems/itens-poe/campanha.mjs');
  mkdirSync(PASTA_ATOS, { recursive: true });
  let anterior = null;
  for (const a of C.atos) {
    const r = atoDoRuntime(a.numero, anterior);
    if (!r) continue;
    const missoes = missoesDoDrive(a.numero);
    // As posições do mapa do PoE, ajustadas à tela do editor (920×520) com margem — e espaço à direita para o portal do chefe.
    const ps = r.fases.map((f) => f.posicao).filter(Boolean);
    const [x0, x1, y0, y1] = [Math.min(...ps.map((p) => p.x)), Math.max(...ps.map((p) => p.x)), Math.min(...ps.map((p) => p.y)), Math.max(...ps.map((p) => p.y))];
    const naTela = (p) => (p ? { x: Math.round(50 + ((p.x - x0) / Math.max(1, x1 - x0)) * 700), y: Math.round(45 + ((p.y - y0) / Math.max(1, y1 - y0)) * 410) } : null);
    const fases = r.fases.map((f) => {
      const area = C.areas[f.huntId];
      const ms = missoes.get(area.slug) ?? [];
      return {
        ...f,
        tipo: f.id === r.bossFinal.faseAnterior ? 'fase-final-do-ato' : 'hunt-normal',
        requisitos: { exige: [] },
        objetivos: objetivosDaArea(ms),
        conclusao: conclusaoDaArea(area, ms, itens),
        recompensas: null, eventos: [], sobrescritas: {},
        posicao: naTela(f.posicao),
      };
    });
    const ato = { ...r, imagem: null, nivelRecomendado: fases[0]?.nivel.facil ?? null, seguinte: null, requisitos: { exige: [] }, progressao: {}, versao: 1, fases, conexoes: r.conexoes.map((c) => ({ ...c, requisito: null, rotulo: '' })), bossFinal: { ...r.bossFinal, arena: null, recompensas: null } };
    // Rodar de novo preserva a IMAGEM de fundo e o estado que o dono deu no editor.
    const arq = new URL(`${r.id}.json`, PASTA_ATOS);
    const antes = lerJson(arq, null);
    if (antes) Object.assign(ato, { imagem: antes.imagem ?? null, estado: antes.estado ?? ato.estado, versao: (antes.versao ?? 0) + 1 });
    writeFileSync(arq, `${JSON.stringify(ato, null, 2)}\n`);
    const tipos = fases.reduce((o, f) => ({ ...o, [f.conclusao.tipo]: (o[f.conclusao.tipo] ?? 0) + 1 }), {});
    console.log(`${r.id}: ${fases.length} fases, ${ato.conexoes.length} ligações — conclusão: ${Object.entries(tipos).map(([k, v]) => `${k} ${v}`).join(', ')}`);
    anterior = r.id;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) principal().catch((e) => {
  console.error(e);
  process.exit(1);
});
