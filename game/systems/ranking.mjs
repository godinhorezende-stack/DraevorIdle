// Highscores — `{t:'ranking', category}` → `{t:'ranking', ranking}` (panels.mjs
// `openRanking`), e o de experiência também dentro do welcome.
//
// Do original (Zoros, 2026-09-26, `api-mapeada/captura-chat-ranking-0926/`):
// - Top 25 por categoria: exp, level, magic e cada perícia do catálogo
//   (melee, distance, shielding, fishing — o melee reúne fist, club, sword e axe).
// - `value`: a experiência, o level, o magic level ou o nível da perícia.
// - Cada linha: name, vocation, level, value, online, outfit (com addons e
//   montaria) e guilda (aqui sempre null: não há guildas locais).
// - Entram todos os personagens, online ou não (há level 8 offline no topo de
//   perícia).
//
// Leve: o banco devolve só o campo da categoria (`json_extract`, sem abrir o
// estado inteiro de cada personagem), os online entram com o valor AO VIVO, e o
// resultado fica guardado 15 s por categoria.
//
// ESTIMADO: o desempate (valor, depois level, depois nome).
import { banco } from '../database/banco.mjs';
import * as Cache from '../database/redis.mjs';
import { CATALOGO } from './dados.mjs';
import * as Treino from './treino.mjs';
import * as Promocao from './promocao.mjs';
import * as Guildas from './guildas.mjs';
import { sqlDoPoe } from './personagem/legado.mjs';
import { ligado } from './itens-poe/catalogo.mjs';

export const TAMANHO = 25;
const GUARDA_MS = 15_000;
const PERICIA_INICIAL = 10;
// No jogo oficial (PoE) não há perícias (magic, melee, distance, shielding, fishing): o ranking é de experiência e level.
export const CATEGORIAS = ligado() ? ['exp', 'level'] : ['exp', 'level', 'magic', ...(CATALOGO.skills ?? [])];

let vivas = new Map(); // nome -> Sessao (injetado por sessao.mjs)
export const ligar = (mapa) => void (vivas = mapa);

/** O caminho do valor dentro do estado, para o `json_extract`. */
const caminho = (cat) => (cat === 'exp' ? '$.xp' : cat === 'level' ? '$.level' : cat === 'magic' ? '$.magic.value' : `$.skills.${cat}.value`);
const padrao = (cat) => (cat === 'exp' || cat === 'level' || cat === 'magic' ? 0 : PERICIA_INICIAL);

function valorAoVivo(estado, cat) {
  if (cat === 'exp') return estado.xp ?? 0;
  if (cat === 'level') return estado.level ?? 1;
  if (cat === 'magic') return estado.magic?.value ?? 0;
  return Treino.valor(estado, cat);
}

/*
 * O melee é UMA perícia, mas o personagem salvo antes da fusão ainda guarda as
 * quatro (fist/club/sword/axe) até entrar de novo (`Treino.garantir` migra na
 * entrada). Até lá o ranking lê a melhor das cinco — a mesma regra da migração.
 */
const LEGADAS_DO_MELEE = ['melee', 'fist', 'club', 'sword', 'axe'];
const valorSqlite = (cat) => (cat === 'melee'
  ? `max(${LEGADAS_DO_MELEE.map((k) => `coalesce(json_extract(estado, '$.skills.${k}.value'), ${PERICIA_INICIAL})`).join(', ')})`
  : `coalesce(json_extract(estado, '${caminho(cat)}'), ${padrao(cat)})`);
const valorPg = (cat) => (cat === 'melee'
  ? `greatest(${LEGADAS_DO_MELEE.map((k) => `coalesce((estado::jsonb #>> '{skills,${k},value}')::numeric, ${PERICIA_INICIAL})`).join(', ')})`
  : `coalesce((estado::jsonb #>> '${caminhoPg(cat)}')::numeric, ${padrao(cat)})`);

/** O mesmo caminho JSON, em Postgres: `estado::jsonb #>> '{a,b}'` (texto) em vez de `json_extract`. */
const caminhoPg = (cat) => (cat === 'exp' ? '{xp}' : cat === 'level' ? '{level}' : cat === 'magic' ? '{magic,value}' : `{skills,${cat},value}`);

const consultas = new Map();
function consulta(cat) {
  if (!consultas.has(cat)) {
    const sql =
      banco.dialeto === 'postgres'
        ? `SELECT nome, vocacao, classe,
             ${valorPg(cat)} AS valor,
             (estado::jsonb #>> '{level}')::int AS level,
             (estado::jsonb #>> '{promovido}')::boolean AS promovido,
             estado::jsonb ->> 'outfit' AS outfit
        FROM personagens
       WHERE ${sqlDoPoe(banco.dialeto)}
       ORDER BY valor DESC, level DESC, nome
       LIMIT ${TAMANHO}`
        : `SELECT nome, vocacao, classe,
             ${valorSqlite(cat)} AS valor,
             json_extract(estado, '$.level') AS level,
             json_extract(estado, '$.promovido') AS promovido,
             json_extract(estado, '$.outfit') AS outfit
        FROM personagens
       WHERE ${sqlDoPoe(banco.dialeto)}
       ORDER BY valor DESC, level DESC, nome
       LIMIT ${TAMANHO}`;
    consultas.set(cat, banco.prepare(sql));
  }
  return consultas.get(cat);
}

/** No ranking a guilda vai como no original: só {nome, brasao}. */
const guildaDoRanking = (nome) => {
  const g = Guildas.guildaDe(nome);
  return g ? { nome: g.nome, brasao: g.brasao } : null;
};

const roupa = (o = {}) => ({ type: o.type ?? 0, head: o.head ?? 0, body: o.body ?? 0, legs: o.legs ?? 0, feet: o.feet ?? 0, addons: o.addons ?? 0, mount: o.mount ?? 0 });

const guardados = new Map(); // categoria -> { ate, base }
const CHAVE_RANKING = (cat) => `ranking:${cat}`;

/*
 * Só a parte CARA (a consulta no Postgres/SQLite, sem índice — ver
 * docs/auditoria-performance.md) é o que vale cachear. Quem está online
 * entra DEPOIS, sempre ao vivo, direto de `vivas` (estado deste processo) —
 * nunca do cache: guardar isso no Redis faria outro processo, ou uma leitura
 * 14s depois, mostrar "online"/valor de gente que já saiu ou mudou.
 */
async function baseDoRanking(cat) {
  const base = [];
  for (const r of await consulta(cat).all()) {
    base.push({
      name: r.nome,
      vocation: r.vocacao,
      // A classe gravada vai junto: no PoE o nome é o da classe (Ranger e Shadow nascem do mesmo paladin — só a classe os separa).
      vocationName: Promocao.nomeDaClasse({ vocation: r.vocacao, promovido: !!r.promovido, classe: r.classe ?? undefined }),
      level: r.level ?? 1,
      value: r.valor,
      online: false,
      outfit: roupa(r.outfit ? JSON.parse(r.outfit) : {}),
      guilda: guildaDoRanking(r.nome),
    });
  }
  return base;
}

/** O top 25 de uma categoria, no formato do original. */
export async function topo(cat) {
  if (!CATEGORIAS.includes(cat)) cat = 'exp';
  const agora = Date.now();
  const guardado = guardados.get(cat);
  let base;
  if (guardado && guardado.ate > agora) {
    base = guardado.base;
  } else {
    // L1 (Map deste processo) já evita recalcular a cada 15s; L2 (Redis,
    // opcional) evita a MESMA consulta cara logo depois de um reinício, ou
    // num segundo processo — mesmo TTL dos dois, pra não abrir uma janela de
    // atraso maior do que a que já existe hoje.
    base = await Cache.obterOuCalcular(CHAVE_RANKING(cat), GUARDA_MS / 1000, () => baseDoRanking(cat));
    guardados.set(cat, { ate: agora + GUARDA_MS, base });
  }
  const porNome = new Map(base.map((linha) => [linha.name, linha]));
  // Quem está online entra com o valor de agora (o banco é gravado de tempos em tempos).
  for (const s of vivas.values()) {
    const e = s.estado;
    if (!e || !s.personagem) continue;
    porNome.set(s.personagem.nome, {
      name: s.personagem.nome,
      vocation: e.vocation,
      vocationName: Promocao.nomeDaClasse(e),
      level: e.level ?? 1,
      value: valorAoVivo(e, cat),
      online: true,
      outfit: roupa(e.outfit),
      guilda: guildaDoRanking(s.personagem.nome),
    });
  }
  return [...porNome.values()]
    .sort((a, b) => b.value - a.value || b.level - a.level || a.name.localeCompare(b.name))
    .slice(0, TAMANHO);
}
