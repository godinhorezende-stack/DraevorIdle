// A capa do site e as páginas públicas (ravoxidle.com.br, /online, /personagem,
// /guildas): as APIs que client/site/*.mjs e personagem.html leem.
//
// Do original (api-mapeada/captura-site-0926/):
// - `/api/status?ranking=X` → {online, personagens, maiorLevel, categoria,
//   categorias, donate, googleClientId, packs, hunts, highscore (top 20 da
//   categoria), expHoje (top 5 desde a meia-noite, com `levels` ganhos),
//   expHora (top 5 da última hora)}; cada linha: {name, vocation, level, value,
//   online, outfit, guilda: {nome, brasao} | null}.
// - `/api/online` → {jogadores: [{name, level, vocation, outfit, guilda, onde,
//   hunt}]}, `onde` ∈ automatica | online | exercise | cidade (e "parado").
// - `/api/personagem?nome=` → {ok, personagem} ou {ok:false, reason}.
//
// ESTIMADO: a exp de hoje conta a partir da primeira vez que o personagem é
// visto no dia (Brasília) — online, a cada `AMOSTRA_MS`; a da última hora vem de
// amostras em memória, só de quem está online (some ao reiniciar o servidor).
// `donate: false` e `googleClientId: null`: pagamento e login do Google não
// existem neste servidor, e a capa esconde o que depende deles.
import * as B from '../nucleo/banco.mjs';
import * as R from '../nucleo/regras.mjs';
import { ITEM_CATALOG, CATALOGO } from '../nucleo/dados.mjs';
import * as Ranking from './ranking.mjs';
import * as Guildas from './guildas.mjs';
import * as Promocao from './promocao.mjs';
import * as Premium from './premium.mjs';
import * as Summon from './summon.mjs';
import * as Charms from './charms.mjs';
import * as Aparencia from './aparencia.mjs';
import * as Ficha from './ficha.mjs';
import { nomeDaHunt } from './hunt/terreno.mjs';

const TOPO = 20;
const TOPO_EXP = 5;
const AMOSTRA_MS = 60_000;
const HORA_MS = 3_600_000;
const GUARDA_MS = 15_000;
const FUSO_MS = -3 * HORA_MS;
const SLOTS = ['head', 'neck', 'body', 'legs', 'feet', 'ring', 'weapon', 'shield', 'ammo', 'backpack'];

let vivas = new Map(); // nome -> Sessao (injetado por index.mjs)
let relogio = null;

/** Liga o site às sessões abertas e começa a amostrar a exp (uma vez por minuto). */
export function ligar(mapa) {
  vivas = mapa;
  clearInterval(relogio);
  relogio = setInterval(() => amostrar(), AMOSTRA_MS);
  relogio.unref?.();
}

const online = () => [...vivas.values()].filter((s) => s.personagem && s.estado);
const diaDe = (agora) => Math.floor((agora + FUSO_MS) / 864e5);
const roupa = (o = {}) => ({ type: o.type ?? 0, head: o.head ?? 0, body: o.body ?? 0, legs: o.legs ?? 0, feet: o.feet ?? 0, addons: o.addons ?? 0, mount: o.mount ?? 0 });
const guildaDe = (nome) => {
  const g = Guildas.guildaDe(nome);
  return g ? { nome: g.nome, brasao: g.brasao } : null;
};

// ------------------------------------------------------------ a exp de hoje e da hora

const amostras = new Map(); // nome -> [[t, xp], ...] da última hora

/** Marca o ponto de partida do dia (uma vez por dia) — fica no estado, então vai para o banco. */
export function marcarDia(estado, agora = Date.now()) {
  const dia = diaDe(agora);
  if (estado.expDoDia?.dia !== dia) estado.expDoDia = { dia, xp: estado.xp ?? 0, level: estado.level ?? 1 };
}

export function amostrar(agora = Date.now()) {
  const vistos = new Set();
  for (const s of online()) {
    const nome = s.personagem.nome;
    vistos.add(nome);
    marcarDia(s.estado, agora);
    const lista = amostras.get(nome) ?? [];
    lista.push([agora, s.estado.xp ?? 0]);
    while (lista.length && lista[0][0] < agora - HORA_MS - AMOSTRA_MS) lista.shift();
    amostras.set(nome, lista);
  }
  for (const nome of amostras.keys()) if (!vistos.has(nome)) amostras.delete(nome);
}

const consultaDoDia = B.db.prepare(`
  SELECT nome, vocacao,
         json_extract(estado, '$.xp') - json_extract(estado, '$.expDoDia.xp') AS ganho,
         json_extract(estado, '$.level') AS level,
         json_extract(estado, '$.level') - json_extract(estado, '$.expDoDia.level') AS levels,
         json_extract(estado, '$.outfit') AS outfit
    FROM personagens
   WHERE json_extract(estado, '$.expDoDia.dia') = ?
   ORDER BY ganho DESC
   LIMIT 50`);

function expHoje(agora) {
  const dia = diaDe(agora);
  const porNome = new Map();
  for (const r of consultaDoDia.all(dia)) {
    if (!(r.ganho > 0)) continue;
    porNome.set(r.nome, { name: r.nome, vocation: r.vocacao, level: r.level, value: r.ganho, levels: r.levels ?? 0, online: false, outfit: roupa(r.outfit ? JSON.parse(r.outfit) : {}), guilda: guildaDe(r.nome) });
  }
  for (const s of online()) {
    const e = s.estado;
    marcarDia(e, agora);
    const ganho = (e.xp ?? 0) - e.expDoDia.xp;
    const nome = s.personagem.nome;
    if (ganho > 0) porNome.set(nome, { name: nome, vocation: e.vocation, level: e.level, value: ganho, levels: (e.level ?? 1) - e.expDoDia.level, online: true, outfit: roupa(e.outfit), guilda: guildaDe(nome) });
    else porNome.delete(nome);
  }
  return [...porNome.values()].sort((a, b) => b.value - a.value).slice(0, TOPO_EXP);
}

function expHora(agora) {
  const lista = [];
  for (const s of online()) {
    const nome = s.personagem.nome;
    const hist = (amostras.get(nome) ?? []).filter(([t]) => t >= agora - HORA_MS);
    if (!hist.length) continue;
    const ganho = (s.estado.xp ?? 0) - hist[0][1];
    if (ganho > 0) lista.push({ name: nome, vocation: s.estado.vocation, level: s.estado.level, value: ganho, online: true, outfit: roupa(s.estado.outfit), guilda: guildaDe(nome) });
  }
  return lista.sort((a, b) => b.value - a.value).slice(0, TOPO_EXP);
}

// ------------------------------------------------------------ /api/status

const totais = B.db.prepare("SELECT count(*) AS n, max(coalesce(json_extract(estado, '$.level'), 1)) AS maior FROM personagens");
const guardados = new Map(); // categoria -> {ate, corpo}

export function status(categoria = 'level', agora = Date.now()) {
  if (!Ranking.CATEGORIAS.includes(categoria)) categoria = 'level';
  const g = guardados.get(categoria);
  if (g && g.ate > agora) return g.corpo;
  const t = totais.get();
  const vivosNoTopo = Math.max(0, ...online().map((s) => s.estado.level ?? 1));
  const corpo = {
    online: online().length,
    personagens: t.n,
    maiorLevel: Math.max(t.maior ?? 1, vivosNoTopo),
    categoria,
    categorias: Ranking.CATEGORIAS,
    donate: false,
    googleClientId: null,
    packs: [],
    hunts: CATALOGO.hunts?.length ?? 0,
    highscore: Ranking.topo(categoria).slice(0, TOPO).map(({ vocationName: _v, ...linha }) => linha),
    expHoje: expHoje(agora),
    expHora: expHora(agora),
  };
  guardados.set(categoria, { ate: agora + GUARDA_MS, corpo });
  return corpo;
}

// ------------------------------------------------------------ /api/online

/** Onde a pessoa está, nas palavras da página /online. */
function atividade(e) {
  if (e.exercicio?.treinando) return { onde: 'exercise', lugar: 'Treinando' };
  if (e.hunt) {
    const lugar = e.hunt.huntId === 'treino' ? 'Pátio de treino' : nomeDaHunt(e.hunt.huntId);
    return { onde: e.hunt.modo === 'online' ? 'online' : 'automatica', lugar };
  }
  return { onde: 'cidade', lugar: null };
}

export function jogadoresOnline() {
  const jogadores = online()
    .map((s) => {
      const e = s.estado;
      const a = atividade(e);
      return { name: s.personagem.nome, level: e.level ?? 1, vocation: e.vocation, outfit: roupa(e.outfit), guilda: guildaDe(s.personagem.nome), onde: a.onde, hunt: a.lugar };
    })
    .sort((a, b) => b.level - a.level || a.name.localeCompare(b.name));
  return { jogadores };
}

// ------------------------------------------------------------ /api/personagem

const personagemPorNome = B.db.prepare('SELECT nome, sexo, criado_em, visto_em, estado FROM personagens WHERE lower(nome) = lower(?)');

/** Um número, sem derrubar a ficha se o sistema dele reclamar do estado. */
const seguro = (fn, padrao = 0) => {
  try {
    return fn() ?? padrao;
  } catch {
    return padrao;
  }
};

function equipamento(e) {
  const saida = {};
  for (const slot of SLOTS) {
    const p = e.equipment?.[slot];
    if (!p?.id) {
      saida[slot] = null;
      continue;
    }
    saida[slot] = {
      id: p.id, count: p.count ?? 1, nome: ITEM_CATALOG[p.id]?.name ?? `item ${p.id}`,
      tier: p.tier ?? 0, imbuements: p.imbu?.length ?? 0, afixos: p.af?.length ?? 0, peca: { ...p, count: p.count ?? 1 },
    };
  }
  return saida;
}

function ravox(e) {
  const f = seguro(() => Summon.familiarDe(e), {});
  const col = seguro(() => Aparencia.colecao(e), {});
  const ficha = seguro(() => Ficha.combate(e), {});
  const totaisDoPersonagem = e.totals ?? {};
  const pecas = Object.values(e.equipment ?? {}).filter((p) => p?.id);
  return {
    summonNivel: seguro(() => Summon.nivel(e)),
    summonTeto: 100,
    summonNome: e.summon?.nome ?? f.nome ?? null,
    summonLook: f.look ?? 0,
    summonSkins: (e.summon?.skins ?? []).length,
    arvoreUsados: Object.values(e.arvore?.graus ?? {}).reduce((a, n) => a + n, 0),
    arvoreTotal: seguro(() => Math.floor(((e.level ?? 1) - 8) / 2)),
    montarias: col.mounts ?? col.montarias ?? (e.lojaMontarias ?? []).length,
    outfits: col.outfits ?? (e.lojaOutfits ?? []).length,
    kills: totaisDoPersonagem.kills ?? 0,
    mortes: totaisDoPersonagem.deaths ?? 0,
    expTotal: e.xp ?? 0,
    tempoCacando: Math.round(totaisDoPersonagem.time ?? 0),
    blessings: (e.blessings ?? []).length,
    charms: seguro(() => Charms.pontosGanhos(e)),
    bestiario: Object.keys(e.bestiary ?? {}).length,
    proficiencias: Object.keys(e.proficiencia ?? {}).length,
    bossTasks: (e.bossTasks ?? []).filter((t) => t.feito).length,
    mountTasks: (e.tarefas?.montarias ?? []).length,
    voltas: Object.values(e.huntLaps ?? {}).reduce((a, n) => a + n, 0),
    tierTotal: pecas.reduce((a, p) => a + (p.tier ?? 0), 0),
    critico: ficha.critChance ?? 0,
    lifeLeech: ficha.lifeLeech ?? 0,
    manaLeech: ficha.manaLeech ?? 0,
    partySlots: 0,
    instance: !!seguro(() => Premium.acessoView(e, 'instance'), null),
    divine: !!seguro(() => Premium.acessoView(e, 'divine'), null),
  };
}

export function personagem(nome, agora = Date.now()) {
  const vivo = online().find((s) => s.personagem.nome.toLowerCase() === String(nome ?? '').trim().toLowerCase());
  const r = personagemPorNome.get(String(nome ?? '').trim());
  if (!r && !vivo) return { ok: false, reason: `não existe ninguém chamado ${String(nome ?? '').trim()}` };
  const e = vivo?.estado ?? JSON.parse(r.estado);
  const nomeCerto = vivo?.personagem.nome ?? r.nome;
  const level = e.level ?? 1;
  const prog = R.progressoDoLevel(level, e.xp ?? 0);
  const eq = equipamento(e);
  const itens = {};
  for (const p of Object.values(eq)) if (p) itens[p.id] = ITEM_CATALOG[p.id];
  const a = vivo ? atividade(e) : { onde: 'offline', lugar: null };
  return {
    ok: true,
    personagem: {
      nome: nomeCerto,
      marca: null,
      sexo: r?.sexo ?? e.sex ?? 'male',
      vocacao: e.vocation,
      vocacaoNome: Promocao.nomeDaClasse(e),
      promovido: !!e.promovido,
      level,
      exp: e.xp ?? 0,
      expProximo: prog.toNext,
      expPercent: prog.percent,
      premium: Premium.ativo(e, agora),
      premiumAte: e.premiumAte ?? 0,
      guilda: guildaDe(nomeCerto),
      jogando: !!vivo,
      atividade: a,
      hp: e.hp, maxHp: e.maxHp, mana: e.mana, maxMana: e.maxMana,
      magic: e.magic?.value ?? 0,
      skills: Object.fromEntries(Object.entries(e.skills ?? {}).map(([k, v]) => [k, v?.value ?? v])),
      outfit: roupa(e.outfit),
      equipamento: eq,
      criadoEm: r?.criado_em ?? null,
      visto: vivo ? agora : r?.visto_em ?? null,
      banco: e.bank ?? 0,
      itens,
      catalogo: { afixos: CATALOGO.afixos, efeitosDeTier: CATALOGO.efeitosDeTier, imbuements: CATALOGO.imbuements },
      ravox: ravox(e),
    },
  };
}
