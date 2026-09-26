// Guildas — a janela de guilda do cliente (guildas.mjs `openGuildas`) e o que a
// guilda mostra fora dela (perfil, ranking, a praça).
//
// Do original (Zoros, membro da TAKA MAE, 2026-09-26,
// `api-mapeada/captura-guilda-arena-0926/guilda-zoros.json`):
// - `{t:'guilda', view}`: `minha` (id, nome, dono, recado, pontos, criadaEm,
//   nivel, brasao, brasaoEfeitos, membros, convidados, candidatos, diario,
//   meuCargo, meuPosto), `bau`, `convites`, `pedidos`, `lista`, `regras`,
//   `online`, `aviso`.
// - Regras: level 500 e premium para fundar; 5 pedidos por pessoa; 10 vagas de
//   fábrica, +10 por nível, até 100; o 1º degrau custa 1 kk de ouro guardado.
// - Nível: TAKA MAE no 2 com 20 vagas, 35.090.046 guardados, custo 2 kk para o 3
//   (e "vagasDoProximo" 30) — o degrau N custa N kk.
// - Cargos: 3 Líder, 2 Vice-líder, 1 Membro. Vice convida, aceita pedido e
//   expulsa membro (não mexe no líder nem em outro vice) — o texto do cliente.
// - Membro: nome, cargo, posto, entrouEm, level, vocation, outfit, online,
//   veste (o equipamento), onde {cacando, lugar}, expTotal.
// - Diário: contribuicoes, membros, bau, placar (total por pessoa).
// - Baú comunitário: 100 vagas no máximo, compra de 25 vagas por 50 Ravox Coins,
//   o aviso de que qualquer membro retira.
//
// - Brasão (cliente de 26/09 à tarde): o catálogo, os preços e as regras moram em
//   `packages/shared/src/brasao-de-guilda.mjs`, o MESMO arquivo que o cliente lê.
//   Fundar paga só os efeitos pagos; trocar custa CUSTO_DE_TROCAR (50) Ravox Coins
//   + os efeitos ainda não destravados (`brasaoEfeitos`), e só o líder troca.
//   Nome e ordem da tabela também são do shared (nome-de-guilda, ordem-das-guildas).
//
// ESTIMADO (o original não mostrou — mexer lá seria mexer na guilda dos outros):
// fundar não custa ouro; o baú nasce com 25 vagas; o diário guarda as 50 últimas
// de cada tipo; o recado é do líder e dos vices; desfazer só com o líder sozinho.
//
// Fase 6: banco assíncrono (SQLite ou Postgres — ver `nucleo/db.mjs`). A
// exceção é `guildaDe`: chamada em caminho quente (a praça a cada passo do
// relógio, o ranking, o site) por código que não pode virar assíncrono só
// por causa disto — ela lê de um cache em memória e nunca do banco direto
// (ver o comentário ali).
import { banco } from '../nucleo/banco.mjs';
import { ITEM_CATALOG } from '../nucleo/dados.mjs';
import * as Cacadas from './cacadas.mjs';
import * as Premium from './premium.mjs';
import { normalizarBrasao, brasaoPadrao, precoDoBrasao, efeitosUsados, mesmoBrasao } from '../../game/engine/brasao-de-guilda.mjs';
import { recusaDoNome, chaveDoNome, nomeArrumado } from '../../game/engine/nome-de-guilda.mjs';
import { ordenarGuildas } from '../../game/engine/ordem-das-guildas.mjs';

export const REGRAS = {
  levelParaFundar: 500,
  precisaDePremiumParaFundar: true,
  pedidosPorPessoa: 5,
  vagasDeFabrica: 10,
  vagasPorNivel: 10,
  vagasNoMaximo: 100,
  ouroDoPrimeiroDegrau: 1_000_000_000,
};
export const LIDER = 3;
export const VICE = 2;
export const MEMBRO = 1;
const POSTO = { 3: 'Líder', 2: 'Vice-líder', 1: 'Membro' };
const NIVEL_MAXIMO = 1 + (REGRAS.vagasNoMaximo - REGRAS.vagasDeFabrica) / REGRAS.vagasPorNivel; // 10
const BAU_INICIAL = 25;
const BAU = { vagasPorCompra: 25, vagasNoMaximo: 100, coinsPorCompra: 50 };
const AVISO_DO_BAU = 'Tudo o que entrar aqui pode ser retirado por QUALQUER membro da guilda. Não guarde o que você não quer dividir.';
const DIARIO_MAX = 50;

if (banco.dialeto === 'sqlite') {
  await banco.exec(`
    CREATE TABLE IF NOT EXISTS guildas (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      nome      TEXT UNIQUE NOT NULL,
      dono      TEXT NOT NULL,
      recado    TEXT NOT NULL DEFAULT '',
      pontos    INTEGER NOT NULL DEFAULT 0,
      nivel     INTEGER NOT NULL DEFAULT 1,
      guardado  INTEGER NOT NULL DEFAULT 0,
      brasao    TEXT,
      bau       TEXT NOT NULL DEFAULT '[]',
      bau_teto  INTEGER NOT NULL DEFAULT ${BAU_INICIAL},
      criada_em INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS guilda_membros (
      nome     TEXT PRIMARY KEY,
      guilda   INTEGER NOT NULL,
      cargo    INTEGER NOT NULL,
      entrou   INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS guilda_convites (
      guilda INTEGER NOT NULL, nome TEXT NOT NULL, de TEXT NOT NULL, em INTEGER NOT NULL,
      PRIMARY KEY (guilda, nome)
    );
    CREATE TABLE IF NOT EXISTS guilda_pedidos (
      guilda INTEGER NOT NULL, nome TEXT NOT NULL, texto TEXT NOT NULL DEFAULT '', em INTEGER NOT NULL,
      PRIMARY KEY (guilda, nome)
    );
    CREATE TABLE IF NOT EXISTS guilda_diario (
      guilda INTEGER NOT NULL, tipo TEXT NOT NULL, grupo TEXT NOT NULL, quem TEXT NOT NULL,
      alvo TEXT NOT NULL DEFAULT '', quanto INTEGER NOT NULL DEFAULT 0, extra TEXT NOT NULL DEFAULT '', em INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS guilda_membros_guilda ON guilda_membros(guilda);
    CREATE INDEX IF NOT EXISTS guilda_diario_guilda ON guilda_diario(guilda, grupo, em);
  `);
  const colunas = await banco.prepare('PRAGMA table_info(guildas)').all();
  if (!colunas.some((c) => c.name === 'efeitos')) {
    await banco.exec("ALTER TABLE guildas ADD COLUMN efeitos TEXT NOT NULL DEFAULT '[]'");
  }
} else {
  await banco.exec(`
    CREATE TABLE IF NOT EXISTS guildas (
      id        SERIAL PRIMARY KEY,
      nome      CITEXT UNIQUE NOT NULL,
      dono      TEXT NOT NULL,
      recado    TEXT NOT NULL DEFAULT '',
      pontos    INTEGER NOT NULL DEFAULT 0,
      nivel     INTEGER NOT NULL DEFAULT 1,
      guardado  BIGINT NOT NULL DEFAULT 0,
      brasao    TEXT,
      efeitos   TEXT NOT NULL DEFAULT '[]',
      bau       TEXT NOT NULL DEFAULT '[]',
      bau_teto  INTEGER NOT NULL DEFAULT ${BAU_INICIAL},
      criada_em BIGINT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS guilda_membros (
      nome     CITEXT PRIMARY KEY,
      guilda   INTEGER NOT NULL,
      cargo    INTEGER NOT NULL,
      entrou   BIGINT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS guilda_convites (
      guilda INTEGER NOT NULL, nome CITEXT NOT NULL, de TEXT NOT NULL, em BIGINT NOT NULL,
      PRIMARY KEY (guilda, nome)
    );
    CREATE TABLE IF NOT EXISTS guilda_pedidos (
      guilda INTEGER NOT NULL, nome CITEXT NOT NULL, texto TEXT NOT NULL DEFAULT '', em BIGINT NOT NULL,
      PRIMARY KEY (guilda, nome)
    );
    CREATE TABLE IF NOT EXISTS guilda_diario (
      guilda INTEGER NOT NULL, tipo TEXT NOT NULL, grupo TEXT NOT NULL, quem TEXT NOT NULL,
      alvo TEXT NOT NULL DEFAULT '', quanto INTEGER NOT NULL DEFAULT 0, extra TEXT NOT NULL DEFAULT '', em BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS guilda_membros_guilda ON guilda_membros(guilda);
    CREATE INDEX IF NOT EXISTS guilda_diario_guilda ON guilda_diario(guilda, grupo, em);
  `);
}

const pg = banco.dialeto === 'postgres';
const Q = {
  guilda: banco.prepare('SELECT * FROM guildas WHERE id = ?'),
  guildaPorNome: banco.prepare('SELECT * FROM guildas WHERE lower(nome) = lower(?)'),
  todas: banco.prepare('SELECT g.*, (SELECT count(*) FROM guilda_membros m WHERE m.guilda = g.id) AS n FROM guildas g ORDER BY g.pontos DESC, g.nivel DESC, g.criada_em'),
  fundar: banco.prepare(`INSERT INTO guildas (nome, dono, brasao, efeitos, criada_em) VALUES (?, ?, ?, ?, ?)${pg ? ' RETURNING id' : ''}`),
  brasao: banco.prepare('UPDATE guildas SET brasao = ?, efeitos = ? WHERE id = ?'),
  apagar: banco.prepare('DELETE FROM guildas WHERE id = ?'),
  recado: banco.prepare('UPDATE guildas SET recado = ? WHERE id = ?'),
  dono: banco.prepare('UPDATE guildas SET dono = ? WHERE id = ?'),
  ouro: banco.prepare('UPDATE guildas SET nivel = ?, guardado = ? WHERE id = ?'),
  bau: banco.prepare('UPDATE guildas SET bau = ? WHERE id = ?'),
  bauTeto: banco.prepare('UPDATE guildas SET bau_teto = ? WHERE id = ?'),
  meu: banco.prepare('SELECT * FROM guilda_membros WHERE nome = ?'),
  membros: banco.prepare('SELECT * FROM guilda_membros WHERE guilda = ? ORDER BY cargo DESC, entrou'),
  entrar: banco.prepare(
    pg
      ? 'INSERT INTO guilda_membros (nome, guilda, cargo, entrou) VALUES (?, ?, ?, ?) ON CONFLICT (nome) DO UPDATE SET guilda = excluded.guilda, cargo = excluded.cargo, entrou = excluded.entrou'
      : 'INSERT OR REPLACE INTO guilda_membros (nome, guilda, cargo, entrou) VALUES (?, ?, ?, ?)',
  ),
  sair: banco.prepare('DELETE FROM guilda_membros WHERE nome = ?'),
  sairTodos: banco.prepare('DELETE FROM guilda_membros WHERE guilda = ?'),
  cargo: banco.prepare('UPDATE guilda_membros SET cargo = ? WHERE nome = ?'),
  convidar: banco.prepare(
    pg
      ? 'INSERT INTO guilda_convites (guilda, nome, de, em) VALUES (?, ?, ?, ?) ON CONFLICT (guilda, nome) DO UPDATE SET de = excluded.de, em = excluded.em'
      : 'INSERT OR REPLACE INTO guilda_convites (guilda, nome, de, em) VALUES (?, ?, ?, ?)',
  ),
  convidados: banco.prepare('SELECT * FROM guilda_convites WHERE guilda = ?'),
  meusConvites: banco.prepare('SELECT * FROM guilda_convites WHERE nome = ?'),
  tirarConvite: banco.prepare('DELETE FROM guilda_convites WHERE guilda = ? AND nome = ?'),
  tirarConvitesDe: banco.prepare('DELETE FROM guilda_convites WHERE nome = ?'),
  tirarConvitesDaGuilda: banco.prepare('DELETE FROM guilda_convites WHERE guilda = ?'),
  pedir: banco.prepare(
    pg
      ? 'INSERT INTO guilda_pedidos (guilda, nome, texto, em) VALUES (?, ?, ?, ?) ON CONFLICT (guilda, nome) DO UPDATE SET texto = excluded.texto, em = excluded.em'
      : 'INSERT OR REPLACE INTO guilda_pedidos (guilda, nome, texto, em) VALUES (?, ?, ?, ?)',
  ),
  candidatos: banco.prepare('SELECT * FROM guilda_pedidos WHERE guilda = ?'),
  meusPedidos: banco.prepare('SELECT * FROM guilda_pedidos WHERE nome = ?'),
  tirarPedido: banco.prepare('DELETE FROM guilda_pedidos WHERE guilda = ? AND nome = ?'),
  tirarPedidosDe: banco.prepare('DELETE FROM guilda_pedidos WHERE nome = ?'),
  tirarPedidosDaGuilda: banco.prepare('DELETE FROM guilda_pedidos WHERE guilda = ?'),
  anotar: banco.prepare('INSERT INTO guilda_diario (guilda, tipo, grupo, quem, alvo, quanto, extra, em) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
  diario: banco.prepare('SELECT * FROM guilda_diario WHERE guilda = ? AND grupo = ? ORDER BY em DESC LIMIT ?'),
  placar: banco.prepare("SELECT quem, sum(quanto) AS total, count(*) AS vezes FROM guilda_diario WHERE guilda = ? AND tipo = 'contribuiu' GROUP BY quem ORDER BY total DESC"),
  apagarDiario: banco.prepare('DELETE FROM guilda_diario WHERE guilda = ?'),
  personagem: banco.prepare('SELECT nome, vocacao, estado FROM personagens WHERE lower(nome) = lower(?)'),
};

let vivas = new Map(); // nome -> Sessao (injetado por sessao.mjs)
export const ligar = (mapa) => void (vivas = mapa);

const sessaoDe = (nome) => vivas.get(nome) ?? [...vivas.values()].find((s) => s.personagem?.nome?.toLowerCase() === String(nome ?? '').toLowerCase()) ?? null;

/** O estado de alguém: o da sessão aberta ou o gravado. */
async function quem(nome) {
  const s = sessaoDe(nome);
  if (s?.estado) return { nome: s.personagem.nome, estado: s.estado, online: true, vocacao: s.estado.vocation };
  const r = await Q.personagem.get(nome);
  return r ? { nome: r.nome, estado: JSON.parse(r.estado), online: false, vocacao: r.vocacao } : null;
}

const anotar = (g, grupo, tipo, quemFez, alvo = '', quanto = 0, extra = '') => Q.anotar.run(g, tipo, grupo, quemFez, String(alvo), Math.round(quanto), extra, Date.now());
const custoDoDegrau = (nivel) => REGRAS.ouroDoPrimeiroDegrau * nivel;
const vagasDo = (nivel) => Math.min(REGRAS.vagasNoMaximo, REGRAS.vagasDeFabrica + REGRAS.vagasPorNivel * (nivel - 1));
/** O brasão guardado, passado pelo normalizador do shared (o que o cliente desenha). */
const brasaoDa = (g) => (g.brasao ? normalizarBrasao(JSON.parse(g.brasao), g.nome) : brasaoPadrao(g.nome));
const efeitosDa = (g) => JSON.parse(g.efeitos || '[]');

/*
 * ---- A guilda de cada nome, para quem não pode esperar o banco ----
 *
 * `guildaDe` é chamada em caminho quente: a praça (o índice espacial inteiro,
 * a cada passo do relógio — ver `chat.mjs`), o ranking e o site (`/api/*`),
 * tudo síncrono por natureza (rodam fora — ou antes — de qualquer `await` de
 * quem chama). Virar assíncrona empurraria isso para uma cadeia de `await`
 * em módulos que não têm nada a ver com Fase 6.
 *
 * Por isso ela só lê de `lembradas` (um cache) — nunca do banco direto. Uma
 * chave ausente dispara a busca de verdade EM SEGUNDO PLANO (preenche o
 * cache para a PRÓXIMA chamada) e devolve `null` desta vez — o mesmo "sem
 * guilda" de quem não tem mesmo, só que por um passo do relógio. Qualquer
 * comando que mude alguém de guilda chama `esquecer()` primeiro, então o
 * pior caso é: um jogador muda de guilda, e a tela mostra a guilda antiga
 * por até um passo do relógio antes de esquecer e buscar de novo.
 */
const lembradas = new Map();
const esquecer = () => lembradas.clear();

/** A guilda de alguém, para o perfil e o ranking: {id, nome, cargo, posto, brasao} (null sem guilda, ou ainda buscando). */
export function guildaDe(nome) {
  if (lembradas.has(nome)) return lembradas.get(nome);
  lembradas.set(nome, null); // evita disparar uma busca por chamada enquanto a 1ª ainda não voltou
  buscarGuildaDe(nome)
    .then((r) => lembradas.set(nome, r))
    .catch((e) => console.error('guildaDe', nome, '->', e.message));
  return null;
}

async function buscarGuildaDe(nome) {
  const m = await Q.meu.get(nome);
  if (!m) return null;
  const g = await Q.guilda.get(m.guilda);
  return g ? { id: g.id, nome: g.nome, cargo: m.cargo, posto: POSTO[m.cargo], brasao: brasaoDa(g) } : null;
}

function nivelDa(g, membros) {
  const noTopo = g.nivel >= NIVEL_MAXIMO;
  const custo = noTopo ? 0 : custoDoDegrau(g.nivel);
  return {
    nivel: g.nivel,
    nivelMaximo: NIVEL_MAXIMO,
    vagas: vagasDo(g.nivel),
    membros,
    guardado: g.guardado,
    custo,
    falta: noTopo ? 0 : Math.max(0, custo - g.guardado),
    noTopo,
    vagasDoProximo: noTopo ? null : vagasDo(g.nivel + 1),
  };
}

async function membroParaVista(m) {
  const q = await quem(m.nome);
  const e = q?.estado ?? {};
  const o = e.outfit ?? {};
  return {
    nome: m.nome,
    cargo: m.cargo,
    posto: POSTO[m.cargo],
    entrouEm: m.entrou,
    level: e.level ?? 1,
    vocation: e.vocation ?? q?.vocacao,
    outfit: { type: o.type ?? 0, head: o.head ?? 0, body: o.body ?? 0, legs: o.legs ?? 0, feet: o.feet ?? 0, addons: o.addons ?? 0, mount: o.mount ?? 0 },
    online: !!q?.online,
    veste: Object.entries(e.equipment ?? {})
      .filter(([, p]) => p?.id)
      .map(([slot, p]) => ({ slot, id: p.id, ...(p.tier ? { tier: p.tier } : {}), ...(p.af?.length ? { af: p.af } : {}), ...(p.imbu?.length ? { imbu: p.imbu } : {}) })),
    onde: q?.online && e.hunt ? { cacando: true, lugar: Cacadas.nomeDaHunt(e.hunt.huntId) } : { cacando: false, lugar: q?.online ? 'na cidade' : 'offline' },
    expTotal: e.xp ?? 0,
  };
}

const linhaDoDiario = (r) => ({ tipo: r.tipo, quem: r.quem, alvo: r.alvo, quanto: r.quanto, extra: r.extra, em: r.em });

function bauDa(g) {
  const itens = JSON.parse(g.bau);
  return {
    nome: 'Baú comunitário',
    tipos: itens.length,
    teto: g.bau_teto,
    itens,
    podeComprarVagas: g.bau_teto < BAU.vagasNoMaximo,
    ...BAU,
    aviso: AVISO_DO_BAU,
  };
}

/** `{t:'guilda'}` — a vista inteira, do jeito do original. */
export async function vista(eu, aviso = null) {
  const meu = await Q.meu.get(eu);
  const g = meu ? await Q.guilda.get(meu.guilda) : null;
  let minha = null;
  if (g) {
    const membros = await Q.membros.all(g.id);
    const diario = Object.fromEntries(
      await Promise.all(['contribuicoes', 'membros', 'bau'].map(async (grupo) => [grupo, (await Q.diario.all(g.id, grupo, DIARIO_MAX)).map(linhaDoDiario)])),
    );
    // `sum`/`count` voltam como texto no Postgres (precisão de bigint) — `Number()` funciona nos dois bancos.
    diario.placar = (await Q.placar.all(g.id)).map((r) => ({ quem: r.quem, total: Number(r.total), vezes: Number(r.vezes) }));
    minha = {
      id: g.id,
      nome: g.nome,
      dono: g.dono,
      recado: g.recado,
      pontos: g.pontos,
      criadaEm: g.criada_em,
      nivel: nivelDa(g, membros.length),
      brasao: brasaoDa(g),
      brasaoEfeitos: efeitosDa(g),
      membros: await Promise.all(membros.map(membroParaVista)),
      convidados: (await Q.convidados.all(g.id)).map((c) => ({ nome: c.nome, de: c.de, em: c.em })),
      candidatos: await Promise.all(
        (await Q.candidatos.all(g.id)).map(async (c) => {
          const q = await quem(c.nome);
          return { nome: c.nome, level: q?.estado.level ?? 1, vocation: q?.estado.vocation ?? q?.vocacao, online: !!q?.online, texto: c.texto, em: c.em };
        }),
      ),
      diario,
      meuCargo: meu.cargo,
      meuPosto: POSTO[meu.cargo],
    };
  }
  const nomeDaGuilda = (id) => Q.guilda.get(id);
  const convites = await Promise.all(
    (await Q.meusConvites.all(eu)).map(async (c) => {
      const x = await nomeDaGuilda(c.guilda);
      return x ? { guildaId: x.id, nome: x.nome, dono: x.dono, em: c.em, brasao: brasaoDa(x) } : null;
    }),
  );
  const pedidos = await Promise.all(
    (await Q.meusPedidos.all(eu)).map(async (p) => {
      const x = await nomeDaGuilda(p.guilda);
      return x ? { guildaId: x.id, nome: x.nome, dono: x.dono, em: p.em, brasao: brasaoDa(x) } : null;
    }),
  );
  const todas = await Q.todas.all();
  return {
    t: 'guilda',
    view: {
      minha,
      bau: g ? bauDa(g) : null,
      convites: convites.filter(Boolean),
      pedidos: pedidos.filter(Boolean),
      lista: ordenarGuildas(todas.map((x) => ({ id: x.id, nome: x.nome, dono: x.dono, pontos: x.pontos, nivel: x.nivel, membros: Number(x.n), criadaEm: x.criada_em, brasao: brasaoDa(x) }))),
      regras: REGRAS,
      online: [...vivas.values()].map((s) => s.personagem?.nome).filter(Boolean),
      aviso,
    },
  };
}

/** Manda a vista nova a todo membro online (e a quem mais for tocado). */
async function avisarGuilda(gid, alem = []) {
  const nomes = new Set([...(await Q.membros.all(gid)).map((m) => m.nome), ...alem]);
  for (const n of nomes) {
    const s = sessaoDe(n);
    if (s) s.enviar(await vista(n));
  }
}

const erro = (texto) => ({ ok: false, erro: texto });

const mesmosAfixos = (a, b) => JSON.stringify(a?.length ? a : null) === JSON.stringify(b?.length ? b : null);
/**
 * A pilha da mochila que o cliente apontou (`alvoDaPeca`: indice, tier, af). Se o
 * índice já não bate (a mochila mudou no caminho), a primeira com o mesmo id,
 * tier e afixos; sem alvo, a primeira de mesmo id — o comportamento antigo.
 */
function pecaDoAlvo(mochila, id, alvo) {
  if (!alvo || typeof alvo !== 'object') return mochila.findIndex((p) => p.id === id);
  const confere = (p) => p?.id === id && Math.floor(Number(p.tier) || 0) === Math.floor(Number(alvo.tier) || 0) && mesmosAfixos(p.af, alvo.af);
  if (Number.isInteger(alvo.indice) && confere(mochila[alvo.indice])) return alvo.indice;
  return mochila.findIndex(confere);
}

/** `{t:'guilda', action, ...}` para o personagem `s` (Sessao). Devolve {ok, erro?, notice?}. */
export async function comando(s, m) {
  esquecer();
  const eu = s.personagem.nome;
  const meu = await Q.meu.get(eu);
  const g = meu ? await Q.guilda.get(meu.guilda) : null;
  const mando = (meu?.cargo ?? 0) >= VICE;
  const alvoNome = String(m.quem ?? '').trim();
  switch (m.action) {
    case 'fundar': {
      const nome = nomeArrumado(m.nome);
      if (g) return erro('Saia da sua guilda antes de fundar outra.');
      if ((s.estado.level ?? 1) < REGRAS.levelParaFundar) return erro(`Fundar uma guilda pede level ${REGRAS.levelParaFundar}.`);
      if (REGRAS.precisaDePremiumParaFundar && !Premium.ativo(s.estado)) return erro('Fundar uma guilda pede conta premium.');
      const recusa = recusaDoNome(nome);
      if (recusa) return erro(recusa.charAt(0).toUpperCase() + recusa.slice(1) + '.');
      if (await Q.guildaPorNome.get(chaveDoNome(nome))) return erro('Já existe uma guilda com esse nome.');
      const brasao = normalizarBrasao(m.brasao ?? brasaoPadrao(nome), nome);
      const preco = precoDoBrasao(brasao, { jaExiste: false });
      if ((s.estado.coins ?? 0) < preco.coins) return erro(`Faltam ${(preco.coins - (s.estado.coins ?? 0)).toLocaleString('pt-BR')} Ravox Coins.`);
      s.estado.coins = (s.estado.coins ?? 0) - preco.coins;
      const criada = await Q.fundar.run(nome, eu, JSON.stringify(brasao), JSON.stringify(efeitosUsados(brasao)), Date.now());
      const id = Number(criada.lastInsertRowid);
      await Q.entrar.run(eu, id, LIDER, Date.now());
      await Q.tirarConvitesDe.run(eu);
      await Q.tirarPedidosDe.run(eu);
      await anotar(id, 'membros', 'fundou', eu);
      return { ok: true, notice: `A guilda ${nome} foi fundada.` };
    }
    case 'convidar': {
      if (!g || !mando) return erro('Só o líder e os vices convidam.');
      const q = await quem(alvoNome);
      if (!q) return erro(`não existe ninguém chamado ${alvoNome}`);
      if (await Q.meu.get(q.nome)) return erro(`${q.nome} já está numa guilda.`);
      if ((await Q.membros.all(g.id)).length >= vagasDo(g.nivel)) return erro('A guilda está cheia — suba o nível para abrir vagas.');
      await Q.convidar.run(g.id, q.nome, eu, Date.now());
      await anotar(g.id, 'membros', 'convidou', eu, q.nome);
      await avisarGuilda(g.id, [q.nome]);
      return { ok: true, notice: `Convite enviado para ${q.nome}.` };
    }
    case 'aceitar': {
      const gid = Number(m.guildaId);
      const alvo = await Q.guilda.get(gid);
      if (!alvo) return erro('Essa guilda não existe mais.');
      if (g) return erro('Você já está numa guilda.');
      if (!(await Q.meusConvites.all(eu)).some((c) => c.guilda === gid)) return erro('Esse convite não existe mais.');
      if ((await Q.membros.all(gid)).length >= vagasDo(alvo.nivel)) return erro('A guilda encheu antes de você aceitar.');
      await Q.entrar.run(eu, gid, MEMBRO, Date.now());
      await Q.tirarConvitesDe.run(eu);
      await Q.tirarPedidosDe.run(eu);
      await anotar(gid, 'membros', 'entrou', eu);
      await avisarGuilda(gid);
      return { ok: true, notice: `Você entrou na guilda ${alvo.nome}.` };
    }
    case 'recusar': {
      await Q.tirarConvite.run(Number(m.guildaId), eu);
      await avisarGuilda(Number(m.guildaId), [eu]);
      return { ok: true };
    }
    case 'candidatar': {
      const gid = Number(m.guildaId);
      if (g) return erro('Você já está numa guilda.');
      if (!(await Q.guilda.get(gid))) return erro('Essa guilda não existe mais.');
      if ((await Q.meusPedidos.all(eu)).length >= REGRAS.pedidosPorPessoa) return erro(`No máximo ${REGRAS.pedidosPorPessoa} pedidos abertos ao mesmo tempo.`);
      await Q.pedir.run(gid, eu, String(m.texto ?? '').slice(0, 200), Date.now());
      await avisarGuilda(gid, [eu]);
      return { ok: true, notice: 'Pedido enviado.' };
    }
    case 'cancelarPedido': {
      await Q.tirarPedido.run(Number(m.guildaId), eu);
      await avisarGuilda(Number(m.guildaId), [eu]);
      return { ok: true };
    }
    case 'aceitarPedido': {
      if (!g || !mando) return erro('Só o líder e os vices aceitam pedidos.');
      const pedido = (await Q.candidatos.all(g.id)).find((p) => p.nome.toLowerCase() === alvoNome.toLowerCase());
      if (!pedido) return erro('Esse pedido não existe mais.');
      if (await Q.meu.get(pedido.nome)) {
        await Q.tirarPedido.run(g.id, pedido.nome);
        return erro(`${pedido.nome} já entrou em outra guilda.`);
      }
      if ((await Q.membros.all(g.id)).length >= vagasDo(g.nivel)) return erro('A guilda está cheia — suba o nível para abrir vagas.');
      await Q.entrar.run(pedido.nome, g.id, MEMBRO, Date.now());
      await Q.tirarPedidosDe.run(pedido.nome);
      await Q.tirarConvitesDe.run(pedido.nome);
      await anotar(g.id, 'membros', 'aceitou', eu, pedido.nome);
      await avisarGuilda(g.id, [pedido.nome]);
      return { ok: true, notice: `${pedido.nome} entrou na guilda.` };
    }
    case 'recusarPedido': {
      if (!g || !mando) return erro('Só o líder e os vices recusam pedidos.');
      const pedido = (await Q.candidatos.all(g.id)).find((p) => p.nome.toLowerCase() === alvoNome.toLowerCase());
      if (pedido) await Q.tirarPedido.run(g.id, pedido.nome);
      await avisarGuilda(g.id, pedido ? [pedido.nome] : []);
      return { ok: true };
    }
    case 'sair': {
      if (!g) return erro('Você não está numa guilda.');
      if (meu.cargo === LIDER) return erro('O líder passa a liderança antes de sair (ou desfaz a guilda).');
      await Q.sair.run(eu);
      await anotar(g.id, 'membros', 'saiu', eu);
      await avisarGuilda(g.id, [eu]);
      return { ok: true, notice: `Você saiu da guilda ${g.nome}.` };
    }
    case 'expulsar': {
      if (!g || !mando) return erro('Só o líder e os vices expulsam.');
      const alvo = (await Q.membros.all(g.id)).find((x) => x.nome.toLowerCase() === alvoNome.toLowerCase());
      if (!alvo || alvo.nome === eu) return erro('Essa pessoa não está na guilda.');
      if (alvo.cargo >= meu.cargo) return erro('Você não pode expulsar quem tem o mesmo cargo ou maior.');
      await Q.sair.run(alvo.nome);
      await anotar(g.id, 'membros', 'expulsou', eu, alvo.nome);
      await avisarGuilda(g.id, [alvo.nome]);
      return { ok: true, notice: `${alvo.nome} saiu da guilda.` };
    }
    case 'posto': {
      if (!g || meu.cargo !== LIDER) return erro('Só o líder muda o cargo de alguém.');
      const alvo = (await Q.membros.all(g.id)).find((x) => x.nome.toLowerCase() === alvoNome.toLowerCase());
      const cargo = Number(m.cargo);
      if (!alvo || alvo.nome === eu) return erro('Essa pessoa não está na guilda.');
      if (cargo !== VICE && cargo !== MEMBRO) return erro('Cargo inválido.');
      await Q.cargo.run(cargo, alvo.nome);
      await anotar(g.id, 'membros', cargo === VICE ? 'promoveu' : 'rebaixou', eu, alvo.nome);
      await avisarGuilda(g.id);
      return { ok: true };
    }
    case 'passar': {
      if (!g || meu.cargo !== LIDER) return erro('Só o líder passa a liderança.');
      const alvo = (await Q.membros.all(g.id)).find((x) => x.nome.toLowerCase() === alvoNome.toLowerCase());
      if (!alvo || alvo.nome === eu) return erro('Essa pessoa não está na guilda.');
      await Q.cargo.run(LIDER, alvo.nome);
      await Q.cargo.run(VICE, eu);
      await Q.dono.run(alvo.nome, g.id);
      await anotar(g.id, 'membros', 'passou', eu, alvo.nome);
      await avisarGuilda(g.id);
      return { ok: true, notice: `${alvo.nome} agora lidera a guilda.` };
    }
    case 'desfazer': {
      if (!g || meu.cargo !== LIDER) return erro('Só o líder desfaz a guilda.');
      if ((await Q.membros.all(g.id)).length > 1) return erro('Tire os outros membros antes de desfazer a guilda.');
      if (JSON.parse(g.bau).length) return erro('Esvazie o baú antes de desfazer a guilda.');
      await Q.sairTodos.run(g.id);
      await Q.tirarConvitesDaGuilda.run(g.id);
      await Q.tirarPedidosDaGuilda.run(g.id);
      await Q.apagarDiario.run(g.id);
      await Q.apagar.run(g.id);
      return { ok: true, notice: `A guilda ${g.nome} foi desfeita.` };
    }
    case 'brasao': {
      if (!g || meu.cargo !== LIDER) return erro('Só o líder muda o brasão.');
      const brasao = normalizarBrasao(m.brasao, g.nome);
      if (mesmoBrasao(brasao, brasaoDa(g))) return erro('O brasão está igual ao que a guilda já tem.');
      const destravados = efeitosDa(g);
      const preco = precoDoBrasao(brasao, { jaExiste: true, destravados });
      if ((s.estado.coins ?? 0) < preco.coins) return erro(`Faltam ${(preco.coins - (s.estado.coins ?? 0)).toLocaleString('pt-BR')} Ravox Coins.`);
      s.estado.coins = (s.estado.coins ?? 0) - preco.coins;
      const efeitos = [...new Set([...destravados, ...efeitosUsados(brasao)])];
      await Q.brasao.run(JSON.stringify(brasao), JSON.stringify(efeitos), g.id);
      await anotar(g.id, 'membros', 'brasao', eu, '', preco.coins);
      await avisarGuilda(g.id);
      return { ok: true, notice: `O brasão da guilda foi trocado (${preco.coins} Ravox Coins).` };
    }
    case 'recado': {
      if (!g || !mando) return erro('Só o líder e os vices escrevem o recado.');
      await Q.recado.run(String(m.texto ?? '').slice(0, 300), g.id);
      await avisarGuilda(g.id);
      return { ok: true };
    }
    case 'contribuir': {
      if (!g) return erro('Você não está numa guilda.');
      const quanto = Math.floor(Number(m.quanto) || 0);
      if (quanto <= 0) return erro('Diga quanto ouro quer guardar.');
      if ((s.estado.gold ?? 0) < quanto) return erro('Você não tem esse ouro no bolso.');
      s.estado.gold -= quanto;
      let { nivel, guardado } = g;
      guardado += quanto;
      while (nivel < NIVEL_MAXIMO && guardado >= custoDoDegrau(nivel)) {
        guardado -= custoDoDegrau(nivel);
        nivel++;
        await anotar(g.id, 'membros', 'subiu', eu, '', nivel);
      }
      await Q.ouro.run(nivel, guardado, g.id);
      await anotar(g.id, 'contribuicoes', 'contribuiu', eu, '', quanto);
      await avisarGuilda(g.id);
      return { ok: true, notice: nivel > g.nivel ? `A guilda subiu para o nível ${nivel}!` : `Você guardou ${quanto.toLocaleString('pt-BR')} de ouro na guilda.` };
    }
    case 'bauGuardar': {
      if (!g) return erro('Você não está numa guilda.');
      const id = Number(m.id);
      const count = Math.max(1, Math.floor(Number(m.count) || 1));
      const itens = JSON.parse(g.bau);
      const empilha = ITEM_CATALOG[id]?.stackable;
      const ondeEmpilhar = empilha ? itens.find((p) => p.id === id && !p.af && !p.tier && !p.imbu) : null;
      if (!ondeEmpilhar && itens.length >= g.bau_teto) return erro('O baú está cheio.');
      // A peça sai da mochila com o que ela tiver (afixos, tier, imbuements).
      const mochila = s.estado.inventory ?? [];
      const i = pecaDoAlvo(mochila, id, m.alvo);
      if (i < 0 || (mochila[i].count ?? 1) < count) return erro('Você não tem isso na mochila.');
      const peca = mochila[i];
      if ((peca.count ?? 1) > count) peca.count -= count;
      else mochila.splice(i, 1);
      const { count: _c, ...extras } = peca;
      if (ondeEmpilhar) ondeEmpilhar.count = (ondeEmpilhar.count ?? 1) + count;
      else itens.push({ ...extras, count });
      await Q.bau.run(JSON.stringify(itens), g.id);
      const { id: _i, ...soExtras } = extras;
      await anotar(g.id, 'bau', 'guardou', eu, id, count, Object.keys(soExtras).length ? JSON.stringify(soExtras) : '');
      await avisarGuilda(g.id);
      return { ok: true };
    }
    case 'bauTirar': {
      if (!g) return erro('Você não está numa guilda.');
      const itens = JSON.parse(g.bau);
      const pos = Number.isInteger(m.pos) && itens[m.pos]?.id === Number(m.id) ? m.pos : itens.findIndex((p) => p.id === Number(m.id));
      if (pos < 0) return erro('Isso não está mais no baú.');
      const peca = itens[pos];
      const count = Math.min(peca.count ?? 1, Math.max(1, Math.floor(Number(m.count) || 1)));
      const { count: _c, ...extras } = peca;
      if ((peca.count ?? 1) > count) peca.count -= count;
      else itens.splice(pos, 1);
      (s.estado.inventory ??= []).push({ ...extras, count });
      await Q.bau.run(JSON.stringify(itens), g.id);
      const { id: _i, ...soExtras } = extras;
      await anotar(g.id, 'bau', 'tirou', eu, peca.id, count, Object.keys(soExtras).length ? JSON.stringify(soExtras) : '');
      await avisarGuilda(g.id);
      return { ok: true };
    }
    case 'bauOrganizar': {
      if (!g) return erro('Você não está numa guilda.');
      const itens = JSON.parse(g.bau).sort((a, b) => (ITEM_CATALOG[a.id]?.name ?? '').localeCompare(ITEM_CATALOG[b.id]?.name ?? '') || a.id - b.id);
      await Q.bau.run(JSON.stringify(itens), g.id);
      await avisarGuilda(g.id);
      return { ok: true };
    }
    case 'bauVagas': {
      if (!g) return erro('Você não está numa guilda.');
      if (g.bau_teto >= BAU.vagasNoMaximo) return erro('O baú já está no máximo.');
      if ((s.estado.coins ?? 0) < BAU.coinsPorCompra) return erro(`Custa ${BAU.coinsPorCompra} Ravox Coins.`);
      s.estado.coins -= BAU.coinsPorCompra;
      await Q.bauTeto.run(Math.min(BAU.vagasNoMaximo, g.bau_teto + BAU.vagasPorCompra), g.id);
      await avisarGuilda(g.id);
      return { ok: true, notice: `O baú ganhou ${BAU.vagasPorCompra} vagas.` };
    }
    default:
      return erro('Ação de guilda desconhecida.');
  }
}

// ------------------------------------------------------------ o site (/guildas)

/** `GET /api/guildas` — a tabela do servidor, na ordem do shared (como a aba Servidor). */
export async function listaDoSite() {
  const todas = await Q.todas.all();
  return ordenarGuildas(todas.map((x) => ({ id: x.id, nome: x.nome, dono: x.dono, pontos: x.pontos, nivel: x.nivel, membros: Number(x.n), criadaEm: x.criada_em, brasao: brasaoDa(x) })));
}

/** `GET /api/guilda?nome=` — a ficha pública: sem baú, diário, convites nem pedidos. */
export async function fichaDoSite(nome) {
  const g = await Q.guildaPorNome.get(chaveDoNome(nome));
  if (!g) return { ok: false, reason: `não existe guilda chamada ${nomeArrumado(nome)}` };
  const membros = await Q.membros.all(g.id);
  return {
    ok: true,
    guilda: {
      nome: g.nome, dono: g.dono, recado: g.recado, pontos: g.pontos, criadaEm: g.criada_em,
      nivel: nivelDa(g, membros.length), brasao: brasaoDa(g),
      membros: (await Promise.all(membros.map(membroParaVista))).map((v) => ({
        nome: v.nome, cargo: v.cargo, posto: v.posto, entrouEm: v.entrouEm, level: v.level, vocation: v.vocation, outfit: v.outfit, online: v.online,
      })),
    },
  };
}
