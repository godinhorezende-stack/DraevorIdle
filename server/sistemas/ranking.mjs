// Highscores — `{t:'ranking', category}` → `{t:'ranking', ranking}` (panels.mjs
// `openRanking`), e o de experiência também dentro do welcome.
//
// Do original (Zoros, 2026-09-26, `api-mapeada/captura-chat-ranking-0926/`):
// - Top 25 por categoria: exp, level, magic e cada perícia do catálogo (fist,
//   club, sword, axe, distance, shielding, fishing).
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
import * as B from '../nucleo/banco.mjs';
import { CATALOGO } from '../nucleo/dados.mjs';
import * as Promocao from './promocao.mjs';
import * as Guildas from './guildas.mjs';

export const TAMANHO = 25;
const GUARDA_MS = 15_000;
const PERICIA_INICIAL = 10;
export const CATEGORIAS = ['exp', 'level', 'magic', ...(CATALOGO.skills ?? [])];

let vivas = new Map(); // nome -> Sessao (injetado por sessao.mjs)
export const ligar = (mapa) => void (vivas = mapa);

/** O caminho do valor dentro do estado, para o `json_extract`. */
const caminho = (cat) => (cat === 'exp' ? '$.xp' : cat === 'level' ? '$.level' : cat === 'magic' ? '$.magic.value' : `$.skills.${cat}.value`);
const padrao = (cat) => (cat === 'exp' || cat === 'level' || cat === 'magic' ? 0 : PERICIA_INICIAL);

function valorAoVivo(estado, cat) {
  if (cat === 'exp') return estado.xp ?? 0;
  if (cat === 'level') return estado.level ?? 1;
  if (cat === 'magic') return estado.magic?.value ?? 0;
  return estado.skills?.[cat]?.value ?? PERICIA_INICIAL;
}

const consultas = new Map();
function consulta(cat) {
  if (!consultas.has(cat)) {
    consultas.set(cat, B.db.prepare(`
      SELECT nome, vocacao,
             coalesce(json_extract(estado, '${caminho(cat)}'), ${padrao(cat)}) AS valor,
             json_extract(estado, '$.level') AS level,
             json_extract(estado, '$.promovido') AS promovido,
             json_extract(estado, '$.outfit') AS outfit
        FROM personagens
       ORDER BY valor DESC, level DESC, nome
       LIMIT ${TAMANHO}`));
  }
  return consultas.get(cat);
}

/** No ranking a guilda vai como no original: só {nome, brasao}. */
const guildaDoRanking = (nome) => {
  const g = Guildas.guildaDe(nome);
  return g ? { nome: g.nome, brasao: g.brasao } : null;
};

const roupa = (o = {}) => ({ type: o.type ?? 0, head: o.head ?? 0, body: o.body ?? 0, legs: o.legs ?? 0, feet: o.feet ?? 0, addons: o.addons ?? 0, mount: o.mount ?? 0 });

const guardados = new Map(); // categoria -> { ate, lista }

/** O top 25 de uma categoria, no formato do original. */
export function topo(cat) {
  if (!CATEGORIAS.includes(cat)) cat = 'exp';
  const agora = Date.now();
  const guardado = guardados.get(cat);
  if (guardado && guardado.ate > agora) return guardado.lista;
  const porNome = new Map();
  for (const r of consulta(cat).all()) {
    porNome.set(r.nome, {
      name: r.nome,
      vocation: r.vocacao,
      vocationName: Promocao.nomeDaClasse({ vocation: r.vocacao, promovido: !!r.promovido }),
      level: r.level ?? 1,
      value: r.valor,
      online: false,
      outfit: roupa(r.outfit ? JSON.parse(r.outfit) : {}),
      guilda: guildaDoRanking(r.nome),
    });
  }
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
  const lista = [...porNome.values()]
    .sort((a, b) => b.value - a.value || b.level - a.level || a.name.localeCompare(b.name))
    .slice(0, TAMANHO);
  guardados.set(cat, { ate: agora + GUARDA_MS, lista });
  return lista;
}
