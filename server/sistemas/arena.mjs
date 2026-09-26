// Arena x1 — o lobby (panels.mjs `openArena`/`renderArena`), o convite
// (`arenaDesafio`), a sala de duelo, o duelo em si (`hunt.pvp`, a caveira do
// adversário, `hunt.largadaEm`) e o fim (`arenaFim`).
//
// Do original (Zoros, 2026-09-26, `api-mapeada/captura-guilda-arena-0926/`, e o
// texto do cliente e do Godz no chat):
// - `{t:'arena', view}`: arenas (id, nome, level, blurb, bichos com a
//   quantidade), regras, patentes, eu, podio, loja, aviso, gente, emLuta,
//   euAlistado, recebidos, enviados, sala, validadeDaSala, ranking, historico.
// - Regras: level 500 para entrar; 1 ponto por vitória; os bichos ficam 15%
//   mais fortes a cada 2 min ("se demorar pra morrer a cada tempo o bixo fica
//   mais forte"); desafio vale 60 s, a sala 60 s; 5 tickets por dia até 10,
//   1 por duelo; pódio da semana: 1º +8% de exp e de loot, 2º +5%, 3º +3%.
// - A semana vira sexta às 18h (semanaComecou 25/09 18:00, semanaAcaba 02/10 18:00).
// - "Os dois lutam com a força de um level N" (o level da arena) e "ninguém
//   perde experiência nem item". Vitória +1 ponto na semana, derrota −1 (nunca
//   abaixo de zero); vitórias e derrotas de sempre não zeram.
// - Histórico: {quando, arena, duracao, degraus, vencedor, perdedor}.
//
// - Cliente de 26/09 à tarde: o lobby virou FILA. `alistar`/`desalistar` põem e
//   tiram o card de quem QUER lutar (`gente` = só os alistados, `euAlistado`);
//   `enfrentar` num card abre a sala dos dois na hora (sem convite) e manda
//   `{t:'arenaPar', de, arenaId, arena, level, outfit, patente}` aos DOIS, com
//   "Abrir o lobby". O convite antigo (`desafiar`/`aceitar`) continua aceito.
//   O alistamento vale `validadeDoAlistamento` (30 min).
//
// - Moeda da arena: +1 para quem vence, −1 para quem perde (nunca abaixo de zero) —
//   o "Como funciona" do cliente. Cada degrau dos bichos manda `arenaOnda`
//   (degrau, passo, total) aos dois, que o cliente mostra como balão.
//
// ESTIMADO (o original não mostrou — um duelo de verdade pede outro jogador de
// level 500): o MAPA de cada arena (uma sala real do mesmo tema, ver
// tools/gerar-arenas.mjs); o duelo com o golpe básico (arma/wand) contra o
// adversário; os bichos da arena não dão exp nem loot; o formato de `podio`,
// `ranking` e `emLuta` (vazios na captura); cair no duelo (bicho ou adversário,
// ou sair do jogo) é derrota; o pódio vale durante a semana seguinte.
import { readFileSync } from 'node:fs';
import * as B from '../nucleo/banco.mjs';
import * as R from '../nucleo/regras.mjs';
import * as Cacadas from './cacadas.mjs';
import * as Ficha from './ficha.mjs';
import { armaDoPersonagem, alcanceDaArma, categoriaDaArma, armorDoPersonagem, definirLevel, ATAQUE_MS } from './hunt/combate.mjs';
import { distancia } from './hunt/caminho.mjs';

const ARENAS = JSON.parse(readFileSync(new URL('../../assets_raw/gamedata/arenas.json', import.meta.url), 'utf8')).arenas;
const PATENTES = JSON.parse(readFileSync(new URL('../../assets_raw/gamedata/patentes-arena.json', import.meta.url), 'utf8')).patentes;
const SEMANA_MS = 7 * 864e5;
/** Uma sexta-feira às 18h de Brasília (21h UTC) — daqui se contam as semanas. */
const SEXTA_18H = Date.UTC(2026, 8, 25, 21, 0, 0);
const FUSO_MS = -3 * 3_600_000;
const LARGADA_MS = 5000;

export const REGRAS = {
  levelParaEntrar: 500,
  pontosPorVitoria: 1,
  passo: 0.15,
  tempoDoPasso: 120_000,
  validadeDoDesafio: 60_000,
  validadeDoAlistamento: 1_800_000,
  ticketsPorDia: 5,
  tetoDeTickets: 10,
  custoDoTicket: 1,
  premiosDoPodio: [
    { lugar: 1, exp: 8, loot: 8 },
    { lugar: 2, exp: 5, loot: 5 },
    { lugar: 3, exp: 3, loot: 3 },
  ],
  lugaresPremiados: 3,
};

B.db.exec(`
  CREATE TABLE IF NOT EXISTS arena_historico (
    quando INTEGER NOT NULL, arena TEXT NOT NULL, duracao INTEGER NOT NULL, degraus INTEGER NOT NULL,
    vencedor TEXT NOT NULL, perdedor TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS arena_podio (
    semana INTEGER NOT NULL, lugar INTEGER NOT NULL, nome TEXT NOT NULL, pontos INTEGER NOT NULL,
    PRIMARY KEY (semana, lugar)
  );
  CREATE TABLE IF NOT EXISTS arena_semanas (semana INTEGER PRIMARY KEY);
`);
const Q = {
  historico: B.db.prepare('SELECT * FROM arena_historico ORDER BY quando DESC LIMIT 20'),
  anotar: B.db.prepare('INSERT INTO arena_historico (quando, arena, duracao, degraus, vencedor, perdedor) VALUES (?, ?, ?, ?, ?, ?)'),
  podio: B.db.prepare('SELECT * FROM arena_podio WHERE semana = ? ORDER BY lugar'),
  porNoPodio: B.db.prepare('INSERT OR REPLACE INTO arena_podio (semana, lugar, nome, pontos) VALUES (?, ?, ?, ?)'),
  semanaFeita: B.db.prepare('SELECT semana FROM arena_semanas WHERE semana = ?'),
  fecharSemana: B.db.prepare('INSERT OR IGNORE INTO arena_semanas (semana) VALUES (?)'),
  daSemana: B.db.prepare(`SELECT nome, json_extract(estado, '$.arena.pontos') AS pontos FROM personagens
    WHERE json_extract(estado, '$.arena.semana') = ? AND json_extract(estado, '$.arena.pontos') > 0
    ORDER BY pontos DESC LIMIT 3`),
  vencedores: B.db.prepare(`SELECT nome, estado FROM personagens
    WHERE coalesce(json_extract(estado, '$.arena.vitorias'), 0) > 0
    ORDER BY json_extract(estado, '$.arena.vitorias') DESC LIMIT 10`),
  personagem: B.db.prepare('SELECT nome, estado FROM personagens WHERE nome = ?'),
};

let vivas = new Map(); // nome -> Sessao (injetado por sessao.mjs)
export const ligar = (mapa) => void (vivas = mapa);
const sessaoDe = (nome) => vivas.get(nome) ?? [...vivas.values()].find((s) => s.personagem?.nome?.toLowerCase() === String(nome ?? '').toLowerCase()) ?? null;
const nomeDe = (s) => s?.personagem?.nome;

// ------------------------------------------------------------ a semana e os tickets

export const semanaDe = (agora = Date.now()) => SEXTA_18H + Math.floor((agora - SEXTA_18H) / SEMANA_MS) * SEMANA_MS;
const diaDe = (agora = Date.now()) => Math.floor((agora + FUSO_MS) / 864e5);

/** O registro de arena do personagem, com a semana e os tickets do dia em dia. */
export function garantir(estado, agora = Date.now()) {
  const a = (estado.arena ??= { pontos: 0, pontosTotais: 0, vitorias: 0, derrotas: 0, vitoriasSemana: 0, moedas: 0, tickets: REGRAS.tetoDeTickets, dia: diaDe(agora), semana: semanaDe(agora) });
  const semana = semanaDe(agora);
  if (a.semana !== semana) {
    a.semana = semana;
    a.pontos = 0;
    a.vitoriasSemana = 0;
  }
  const dia = diaDe(agora);
  if (a.dia !== dia) {
    a.tickets = Math.min(REGRAS.tetoDeTickets, a.tickets + REGRAS.ticketsPorDia * Math.max(1, dia - a.dia));
    a.dia = dia;
  }
  return a;
}

export function patente(pontos = 0, pontosDeSempre = 0) {
  let i = 0;
  while (i + 1 < PATENTES.length && pontos >= PATENTES[i + 1].pontos) i++;
  const atual = PATENTES[i];
  const prox = PATENTES[i + 1];
  return {
    id: atual.id, nome: atual.nome, cor: atual.cor, pontos, pontosDeSempre,
    proxima: prox ? { id: prox.id, nome: prox.nome, pontos: prox.pontos, cor: prox.cor, falta: prox.pontos - pontos } : null,
    noTopo: !prox,
  };
}

const patenteDe = (estado) => {
  const a = garantir(estado);
  return patente(a.pontos, a.pontosTotais);
};

// ------------------------------------------------------------ o pódio da semana

/** Fecha a semana que passou (uma vez): os 3 com mais pontos viram o pódio desta. */
function fecharSemanaPassada(agora = Date.now()) {
  const semana = semanaDe(agora);
  if (Q.semanaFeita.get(semana)) return;
  const anterior = semana - SEMANA_MS;
  // Quem está online tem os pontos AO VIVO; o banco tem o que foi gravado.
  const porNome = new Map(Q.daSemana.all(anterior).map((r) => [r.nome, r.pontos]));
  for (const s of vivas.values()) {
    const a = s.estado?.arena;
    if (a?.semana === anterior && a.pontos > 0) porNome.set(nomeDe(s), a.pontos);
  }
  [...porNome.entries()]
    .sort((x, y) => y[1] - x[1])
    .slice(0, REGRAS.lugaresPremiados)
    .forEach(([nome, pontos], i) => Q.porNoPodio.run(semana, i + 1, nome, pontos));
  Q.fecharSemana.run(semana);
}

/** O bônus do pódio que o personagem tem nesta semana: {exp, loot, lugar} em %. Lembrado por semana (vale a cada bicho morto). */
const bonusLembrado = new Map();
export function bonusDoPodio(nome, agora = Date.now()) {
  const chave = `${semanaDe(agora)}:${nome}`;
  if (!bonusLembrado.has(chave)) bonusLembrado.set(chave, buscarBonus(nome, agora));
  return bonusLembrado.get(chave);
}

function buscarBonus(nome, agora) {
  fecharSemanaPassada(agora);
  const linha = Q.podio.all(semanaDe(agora)).find((r) => r.nome === nome);
  const premio = linha && REGRAS.premiosDoPodio.find((p) => p.lugar === linha.lugar);
  return premio ? { exp: premio.exp, loot: premio.loot, lugar: linha.lugar } : { exp: 0, loot: 0, lugar: 0 };
}

// ------------------------------------------------------------ desafios, salas e duelos

const desafios = new Map(); // `${de}>${para}` -> { de, para, arenaId, expira }
const fila = new Map(); // nome -> { arenaId, expira } (quem se alistou ao lobby)
const salas = new Map(); // id -> { id, arenaId, lados: [nome, nome], prontos: Set, expira }
const salaDe = new Map(); // nome -> id da sala
const duelos = new Map(); // id -> { id, arenaId, lados: [nome, nome], comecou, degraus }
const dueloDe = new Map(); // nome -> id do duelo
let proximoId = 1;

const arenaPorId = (id) => ARENAS.find((a) => a.id === id) ?? null;
const roupa = (e) => {
  const o = e?.outfit ?? {};
  return { type: o.type ?? 0, head: o.head ?? 0, body: o.body ?? 0, legs: o.legs ?? 0, feet: o.feet ?? 0, addons: o.addons ?? 0, mount: o.mount ?? 0 };
};

function limpar(agora = Date.now()) {
  for (const [k, d] of desafios) if (d.expira <= agora) desafios.delete(k);
  for (const [n, x] of fila) if (x.expira <= agora || !sessaoDe(n)?.personagem) fila.delete(n);
  for (const [id, sala] of salas) {
    if (sala.expira > agora) continue;
    salas.delete(id);
    for (const n of sala.lados) {
      salaDe.delete(n);
      sessaoDe(n)?.enviar(vista(sessaoDe(n), 'A sala se desfez: o duelo não começou a tempo.'));
    }
  }
}

/** Livre para duelar: online, na cidade, sem sala, sem duelo. */
const livre = (s) => !!s?.personagem && !s.estado.hunt && !salaDe.has(nomeDe(s)) && !dueloDe.has(nomeDe(s));

function ladoDaSala(sala, nome, eu) {
  const s = sessaoDe(nome);
  const e = s?.estado ?? {};
  return {
    nome, level: e.level, outfit: roupa(e), patente: s ? patenteDe(e) : patente(), lider: sala.lados[0] === nome,
    pronto: sala.prontos.has(nome), online: !!s?.personagem, souEu: nome === eu,
  };
}

function vistaDaSala(nome, agora = Date.now()) {
  const sala = salas.get(salaDe.get(nome));
  if (!sala) return null;
  const completa = sala.lados.every((n) => sala.prontos.has(n));
  return {
    id: sala.id, arenaId: sala.arenaId, arena: arenaPorId(sala.arenaId)?.nome,
    lados: sala.lados.map((n) => ladoDaSala(sala, n, nome)),
    completa, lider: sala.lados[0], podeComecar: completa && sala.lados[0] === nome,
    faltam: Math.max(0, sala.expira - agora),
  };
}

const dadosDoLado = (nome) => {
  const s = sessaoDe(nome);
  const e = s?.estado ?? JSON.parse(Q.personagem.get(nome)?.estado ?? '{}');
  const a = e.arena ?? {};
  return { nome, patente: patente(a.pontos ?? 0, a.pontosTotais ?? 0), outfit: roupa(e), level: e.arenaGuardado?.level ?? e.level ?? 1 };
};

/** `{t:'arena', view}` — o lobby inteiro, do jeito do original. */
export function vista(s, aviso = null, agora = Date.now()) {
  limpar(agora);
  fecharSemanaPassada(agora);
  const eu = nomeDe(s);
  const e = s.estado;
  const a = garantir(e, agora);
  const semana = semanaDe(agora);
  const podio = Q.podio.all(semana).map((r) => {
    const premio = REGRAS.premiosDoPodio.find((p) => p.lugar === r.lugar);
    return { lugar: r.lugar, nome: r.nome, pontos: r.pontos, exp: premio?.exp ?? 0, loot: premio?.loot ?? 0, ...(() => { const d = dadosDoLado(r.nome); return { outfit: d.outfit, patente: d.patente }; })() };
  });
  const recebidos = [];
  const enviados = [];
  for (const d of desafios.values()) {
    if (d.para === eu) {
      const de = sessaoDe(d.de);
      recebidos.push({ de: d.de, arenaId: d.arenaId, arena: arenaPorId(d.arenaId)?.nome, level: de?.estado.level, outfit: roupa(de?.estado), patente: de ? patenteDe(de.estado) : patente(), expiraEm: d.expira });
    }
    if (d.de === eu) enviados.push({ para: d.para, arenaId: d.arenaId, arena: arenaPorId(d.arenaId)?.nome, expiraEm: d.expira });
  }
  return {
    t: 'arena',
    view: {
      arenas: ARENAS.map(({ id, nome, level, blurb, bichos }) => ({ id, nome, level, blurb, bichos })),
      regras: { ...REGRAS, semanaComecou: semana, semanaAcaba: semana + SEMANA_MS },
      patentes: PATENTES,
      eu: {
        nome: eu, level: e.level, pontos: a.pontos, pontosTotais: a.pontosTotais, vitorias: a.vitorias, derrotas: a.derrotas,
        patente: patente(a.pontos, a.pontosTotais), moedas: a.moedas,
        tickets: { tem: a.tickets, teto: REGRAS.tetoDeTickets, porDia: REGRAS.ticketsPorDia, custo: REGRAS.custoDoTicket, cheio: a.tickets >= REGRAS.tetoDeTickets },
        pontosSemana: a.pontos, vitoriasSemana: a.vitoriasSemana, podio: bonusDoPodio(eu, agora),
      },
      podio,
      loja: [],
      aviso,
      // A fila do lobby: só quem se alistou (e continua livre na cidade).
      gente: [...fila.keys()]
        .map(sessaoDe)
        .filter((o) => o && o !== s && livre(o))
        .map((o) => ({ nome: nomeDe(o), level: o.estado.level, pontos: garantir(o.estado, agora).pontos, patente: patenteDe(o.estado), outfit: roupa(o.estado) })),
      emLuta: [...duelos.values()].map((d) => ({ arena: arenaPorId(d.arenaId)?.nome, desde: d.comecou, lados: d.lados.map((n) => dadosDoLado(n)) })),
      euAlistado: fila.has(eu),
      recebidos,
      enviados,
      sala: vistaDaSala(eu, agora),
      validadeDaSala: 60_000,
      ranking: vencedores(),
      historico: Q.historico.all().map((h) => ({ quando: h.quando, arena: h.arena, duracao: h.duracao, degraus: h.degraus, vencedor: JSON.parse(h.vencedor), perdedor: JSON.parse(h.perdedor) })),
    },
  };
}

function vencedores() {
  const porNome = new Map(Q.vencedores.all().map((r) => [r.nome, JSON.parse(r.estado)]));
  for (const s of vivas.values()) if (s.estado?.arena?.vitorias > 0) porNome.set(nomeDe(s), s.estado);
  return [...porNome.entries()]
    .map(([nome, e]) => ({ nome, level: e.arenaGuardado?.level ?? e.level, vitorias: e.arena.vitorias, derrotas: e.arena.derrotas ?? 0, patente: patente(e.arena.pontos ?? 0, e.arena.pontosTotais ?? 0), outfit: roupa(e) }))
    .sort((x, y) => y.vitorias - x.vitorias || x.derrotas - y.derrotas || x.nome.localeCompare(y.nome))
    .slice(0, 10);
}

const atualizar = (...nomes) => {
  for (const n of nomes) {
    const s = sessaoDe(n);
    if (s?.personagem) s.enviar(vista(s));
  }
};

/** A fila mudou: quem pode lutar (level da arena, na cidade) recebe o lobby novo. */
const atualizarQuemPodeLutar = (...alem) => {
  const nomes = new Set(alem);
  for (const o of vivas.values()) if (livre(o) && (o.estado.level ?? 0) >= REGRAS.levelParaEntrar) nomes.add(nomeDe(o));
  atualizar(...nomes);
};

/** O cartão do par feito: o mesmo do convite, visto por `lado` (o `de` é o adversário). */
const cartaoDoPar = (outro, arena) => ({
  t: 'arenaPar', de: nomeDe(outro), arenaId: arena.id, arena: arena.nome,
  level: outro.estado.level, outfit: roupa(outro.estado), patente: patenteDe(outro.estado),
});

function abrirSala(arenaId, lados, agora) {
  const sala = { id: proximoId++, arenaId, lados, prontos: new Set(), expira: agora + 60_000 };
  salas.set(sala.id, sala);
  for (const n of lados) {
    salaDe.set(n, sala.id);
    fila.delete(n);
  }
  for (const [k, x] of desafios) if (lados.includes(x.de) || lados.includes(x.para)) desafios.delete(k);
  return sala;
}

/** `{t:'arena', action, ...}`. Devolve a mensagem de erro (ou null); a vista nova vai para os envolvidos. */
export function comando(s, m, agora = Date.now()) {
  limpar(agora);
  const eu = nomeDe(s);
  const a = garantir(s.estado, agora);
  switch (m.action) {
    case 'desafiar': {
      const arena = arenaPorId(m.arenaId);
      const alvo = sessaoDe(m.quem);
      if (!arena) return 'Essa arena não existe.';
      if ((s.estado.level ?? 0) < REGRAS.levelParaEntrar) return `Você precisa de level ${REGRAS.levelParaEntrar} para a arena de x1.`;
      if (!livre(s)) return 'Você precisa estar livre na cidade para desafiar.';
      if (a.tickets < REGRAS.custoDoTicket) return 'Seus tickets acabaram — amanhã chegam mais 5.';
      if (!alvo || alvo === s) return `${m.quem} não está online.`;
      if (!livre(alvo)) return `${nomeDe(alvo)} não está livre na cidade agora.`;
      if ((alvo.estado.level ?? 0) < REGRAS.levelParaEntrar) return `${nomeDe(alvo)} ainda não tem level ${REGRAS.levelParaEntrar}.`;
      for (const [k, d] of desafios) if (d.de === eu) desafios.delete(k);
      const d = { de: eu, para: nomeDe(alvo), arenaId: arena.id, expira: agora + REGRAS.validadeDoDesafio };
      desafios.set(`${eu}>${d.para}`, d);
      alvo.enviar({ t: 'arenaDesafio', de: eu, arenaId: arena.id, arena: arena.nome, level: s.estado.level, outfit: roupa(s.estado), patente: patenteDe(s.estado), expiraEm: d.expira });
      atualizar(eu, d.para);
      return null;
    }
    case 'aceitar': {
      const d = desafios.get(`${m.quem}>${eu}`) ?? [...desafios.values()].find((x) => x.para === eu && x.de.toLowerCase() === String(m.quem ?? '').toLowerCase());
      if (!d) return 'Esse desafio não vale mais.';
      const de = sessaoDe(d.de);
      desafios.delete(`${d.de}>${d.para}`);
      if (!livre(de) || !livre(s)) return 'Um de vocês não está mais livre na cidade.';
      abrirSala(d.arenaId, [d.de, eu], agora);
      atualizarQuemPodeLutar(d.de, eu);
      return null;
    }
    case 'alistar': {
      const arena = arenaPorId(m.arenaId) ?? ARENAS[0];
      if ((s.estado.level ?? 0) < REGRAS.levelParaEntrar) return `Você precisa de level ${REGRAS.levelParaEntrar} para a arena de x1.`;
      if (!livre(s)) return 'Você precisa estar livre na cidade para entrar na fila.';
      if (a.tickets < REGRAS.custoDoTicket) return 'Seus tickets acabaram — amanhã chegam mais 5.';
      fila.set(eu, { arenaId: arena.id, expira: agora + REGRAS.validadeDoAlistamento });
      atualizarQuemPodeLutar(eu);
      return null;
    }
    case 'desalistar': {
      fila.delete(eu);
      atualizarQuemPodeLutar(eu);
      return null;
    }
    case 'enfrentar': {
      const arena = arenaPorId(m.arenaId);
      const alvo = sessaoDe(m.quem);
      if (!arena) return 'Essa arena não existe.';
      if ((s.estado.level ?? 0) < REGRAS.levelParaEntrar) return `Você precisa de level ${REGRAS.levelParaEntrar} para a arena de x1.`;
      if (!livre(s)) return 'Você precisa estar livre na cidade para duelar.';
      if (a.tickets < REGRAS.custoDoTicket) return 'Seus tickets acabaram — amanhã chegam mais 5.';
      if (!alvo || alvo === s || !fila.has(nomeDe(alvo))) return `${m.quem} não está mais na fila.`;
      if (!livre(alvo)) return `${nomeDe(alvo)} não está livre na cidade agora.`;
      abrirSala(arena.id, [eu, nomeDe(alvo)], agora);
      s.enviar(cartaoDoPar(alvo, arena));
      alvo.enviar(cartaoDoPar(s, arena));
      atualizarQuemPodeLutar(eu, nomeDe(alvo));
      return null;
    }
    case 'desistir': {
      // Um desafio mandado e ainda sem resposta: cancela. No duelo: entrega.
      if (dueloDe.has(eu)) return void terminar(dueloDe.get(eu), outroLado(dueloDe.get(eu), eu), 'desistiu');
      for (const [k, d] of desafios) if (d.de === eu) desafios.delete(k);
      atualizar(eu);
      return null;
    }
    case 'pronto': {
      const sala = salas.get(salaDe.get(eu));
      if (!sala) return 'Você não está numa sala de duelo.';
      sala.prontos.add(eu);
      atualizar(...sala.lados);
      return null;
    }
    case 'sairDaSala': {
      const sala = salas.get(salaDe.get(eu));
      if (!sala) return null;
      salas.delete(sala.id);
      for (const n of sala.lados) salaDe.delete(n);
      atualizar(...sala.lados);
      return null;
    }
    case 'comecar': {
      const sala = salas.get(salaDe.get(eu));
      if (!sala) return 'Você não está numa sala de duelo.';
      if (sala.lados[0] !== eu) return 'Quem começa o duelo é o líder da sala.';
      if (!sala.lados.every((n) => sala.prontos.has(n))) return 'Os dois precisam estar prontos.';
      const lados = sala.lados.map(sessaoDe);
      if (lados.some((x) => !x?.personagem)) return 'O outro lado saiu do jogo.';
      if (lados.some((x) => garantir(x.estado, agora).tickets < REGRAS.custoDoTicket)) return 'Um de vocês está sem ticket.';
      salas.delete(sala.id);
      for (const n of sala.lados) salaDe.delete(n);
      return comecarDuelo(sala.arenaId, lados, agora);
    }
    case 'comprar':
      return 'A loja da arena ainda não tem nada à venda.';
    default:
      return 'Ação da arena desconhecida.';
  }
}

// ------------------------------------------------------------ o duelo

const outroLado = (id, nome) => duelos.get(id)?.lados.find((n) => n !== nome);

/** Guarda o level de verdade e põe o personagem no level da arena, de vida e mana cheias. */
function nivelarParaODuelo(estado, level) {
  estado.arenaGuardado = { level: estado.level, xp: estado.xp, hp: estado.hp, mana: estado.mana, pos: { ...estado.pos } };
  estado.xp = R.expForLevel(level);
  definirLevel(estado, level);
  estado.hp = estado.maxHp;
  estado.mana = estado.maxMana;
}

/** Devolve o level, a vida e o lugar de antes do duelo. */
export function restaurar(estado) {
  const g = estado.arenaGuardado;
  if (!g) return;
  estado.xp = g.xp;
  definirLevel(estado, g.level);
  estado.hp = Math.min(estado.maxHp, g.hp);
  estado.mana = Math.min(estado.maxMana, g.mana);
  estado.pos = g.pos ?? estado.pos;
  delete estado.arenaGuardado;
}

function comecarDuelo(arenaId, [A, Bs], agora) {
  const arena = arenaPorId(arenaId);
  for (const s of [A, Bs]) {
    garantir(s.estado, agora).tickets -= REGRAS.custoDoTicket;
    nivelarParaODuelo(s.estado, arena.level);
  }
  const r = Cacadas.entrar(A.estado, { huntId: arenaId, mode: 'auto' });
  if (!r.ok) {
    for (const s of [A, Bs]) restaurar(s.estado);
    return r.erro ?? 'A arena não abriu.';
  }
  Cacadas.entrarNaSala(Bs.estado, A.estado.hunt);
  const id = proximoId++;
  const duelo = { id, arenaId, lados: [nomeDe(A), nomeDe(Bs)], comecou: agora, degraus: 0, largadaAte: agora + LARGADA_MS };
  duelos.set(id, duelo);
  [A, Bs].forEach((s, i) => {
    const h = s.estado.hunt;
    Object.assign(h.pos, arena.lados[i]);
    h.pvp = { duelo: id, adversario: duelo.lados[1 - i] };
    // A cortina de entrada mostra o NOME da arena (os dados da arena têm `nome`, não `name`).
    if (h.viagem) h.viagem.hunt = arena.nome;
    h.largadaAte = duelo.largadaAte;
    h.alvo = null;
    h.alvoPvp = null;
    dueloDe.set(nomeDe(s), id);
    s.characterSujo = true;
  });
  atualizar(...duelo.lados);
  return null;
}

/** Os campos do retrato da caçada no duelo: `pvp` e a contagem da largada. */
export function extrasDoRetrato(s, agora = Date.now()) {
  const d = duelos.get(dueloDe.get(nomeDe(s)));
  return d ? { pvp: true, largadaEm: Math.max(0, d.largadaAte - agora) } : {};
}

/** `huntTarget` com `aliado:<adversário>` no duelo: mira nele (o golpe básico vai nele). */
export function mirar(estado, uid) {
  const h = estado.hunt;
  if (!h?.pvp) return false;
  if (uid === `aliado:${h.pvp.adversario}`) {
    h.alvoPvp = h.pvp.adversario;
    h.alvo = null;
    return true;
  }
  h.alvoPvp = null;
  return false;
}

/**
 * Antes do tique da caçada de quem está no duelo: a largada (ninguém anda nem
 * bate), o degrau dos bichos (15% a cada 2 min) e o golpe básico no adversário
 * (chegando perto se estiver longe).
 */
export function antesDoTique(s, agora = Date.now()) {
  const id = dueloDe.get(nomeDe(s));
  const d = duelos.get(id);
  const h = s.estado.hunt;
  if (!d || !h?.pvp) return;
  if (agora < d.largadaAte) {
    h.proximoPassoEm = h.proximoGolpeEm = d.largadaAte;
    h.rumo = null;
    return;
  }
  // O degrau: o dono da sala (o líder) aplica nos bichos, que são os mesmos para os dois.
  const degraus = Math.floor((agora - d.largadaAte) / REGRAS.tempoDoPasso);
  if (degraus > d.degraus && nomeDe(s) === d.lados[0]) {
    d.degraus = degraus;
    for (const m of h.monstros) m.forca = 1 + REGRAS.passo * degraus;
    const onda = { t: 'arenaOnda', degrau: degraus, passo: Math.round(REGRAS.passo * 100), total: Math.round(REGRAS.passo * 100 * degraus) };
    for (const n of d.lados) sessaoDe(n)?.enviar({ t: 'events', events: [onda] });
  }
  if (!h.alvoPvp) return;
  const outro = sessaoDe(h.alvoPvp);
  const oh = outro?.estado?.hunt;
  if (!oh?.pvp || oh.pvp.duelo !== id) return;
  const arma = armaDoPersonagem(s.estado);
  const alcance = alcanceDaArma(arma, s.estado);
  if (distancia(h.pos, oh.pos) > alcance) {
    // Chega perto pelo caminho de verdade: o mesmo BFS que leva o convidado da
    // party até o dono (`hunt.guia` + `coleira`, no tique da caçada). Em linha
    // reta ele travava na primeira parede — as duas pontas da arena ficam a ~70
    // casas uma da outra, com a sala inteira no meio.
    h.guia = { pos: oh.pos, coleira: alcance };
    return;
  }
  if (!R.jaPode(agora, h.proximoGolpePvp)) return;
  h.proximoGolpePvp = agora + ATAQUE_MS;
  golpeNoAdversario(s, outro, arma, id);
}

function golpeNoAdversario(s, outro, arma, id) {
  const ficha = Ficha.fichaDoGolpeBasico(Ficha.combate(s.estado));
  const fo = Ficha.combate(outro.estado);
  const oh = outro.estado.hunt;
  let base;
  let elemento = 'physical';
  if (categoriaDaArma(arma) === 'magica') {
    const { min, max, element } = arma.wand;
    base = min + Math.floor(Math.random() * (max - min + 1));
    elemento = element ?? 'energy';
  } else {
    base = R.golpeDoJogador({ ...arma, attack: ficha.ataque }, ficha.skillValue, s.estado.level);
  }
  const eventos = [];
  const { dano: bruto, crit } = Ficha.rolarCritico(s.estado, base, { key: null, uid: `aliado:${nomeDe(outro)}`, x: oh.pos.x, y: oh.pos.y }, eventos, ficha);
  const protegido = Math.round(bruto * (1 - Math.min(100, fo.protection?.[elemento] ?? 0) / 100));
  const dano = Math.max(0, elemento === 'physical' ? R.danoRecebido(protegido, armorDoPersonagem(outro.estado)) : protegido);
  outro.estado.hp = Math.max(0, outro.estado.hp - dano);
  const cor = elemento === 'physical' ? '#ff0000' : undefined;
  // Quem bateu vê o número em cima do adversário; quem apanhou, em cima de si.
  s.enviar({ t: 'events', events: [...eventos, { t: 'fx', id: 1, uid: `aliado:${nomeDe(outro)}`, x: oh.pos.x, y: oh.pos.y }, { t: 'dmg', uid: `aliado:${nomeDe(outro)}`, x: oh.pos.x, y: oh.pos.y, v: dano, foe: true, crit, alvo: nomeDe(outro), ...(cor ? { color: cor } : {}) }] });
  outro.enviar({ t: 'events', events: [{ t: 'fx', id: 1, uid: 'player', x: oh.pos.x, y: oh.pos.y }, { t: 'dmg', uid: 'player', quem: nomeDe(outro), x: oh.pos.x, y: oh.pos.y, v: dano, foe: false, de: nomeDe(s), golpe: 'corpo a corpo', ...(cor ? { color: cor } : {}) }] });
  if (outro.estado.hp <= 0) terminar(id, nomeDe(s), 'caiu');
}

/** Caiu no duelo (bicho ou adversário): quem ficou de pé vence. Devolve true se era duelo. */
export function caiu(s) {
  const id = dueloDe.get(nomeDe(s));
  if (!id) return false;
  terminar(id, outroLado(id, nomeDe(s)), 'caiu');
  return true;
}

/** Saiu do jogo no meio do duelo: derrota. */
export function saiuDoJogo(s) {
  const nome = nomeDe(s);
  fila.delete(nome);
  for (const [k, d] of desafios) if (d.de === nome || d.para === nome) desafios.delete(k);
  const sala = salas.get(salaDe.get(nome));
  if (sala) {
    salas.delete(sala.id);
    for (const n of sala.lados) salaDe.delete(n);
    atualizar(...sala.lados.filter((n) => n !== nome));
  }
  if (dueloDe.has(nome)) terminar(dueloDe.get(nome), outroLado(dueloDe.get(nome), nome), 'saiu', s);
}

/** Voltou ao jogo com um duelo que não terminou (servidor caiu no meio): o level de verdade volta. */
export function aoEntrar(estado) {
  if (estado.arenaGuardado && !estado.hunt?.pvp) restaurar(estado);
  if (estado.hunt?.pvp) {
    estado.hunt = null;
    restaurar(estado);
  }
}

function terminar(id, vencedor, motivo, quemSaiu = null) {
  const d = duelos.get(id);
  if (!d) return;
  duelos.delete(id);
  const agora = Date.now();
  const arena = arenaPorId(d.arenaId);
  const fichas = {};
  const fins = {};
  for (const nome of d.lados) {
    dueloDe.delete(nome);
    const s = nome === nomeDe(quemSaiu) ? quemSaiu : sessaoDe(nome);
    if (!s?.estado) continue;
    const e = s.estado;
    e.hunt = null;
    restaurar(e);
    // Quem perde "acorda no templo" (o texto da tela de fim do cliente); quem vence volta para onde estava.
    if (nome !== vencedor) e.pos = { ...R.POSICAO_INICIAL };
    const a = garantir(e, agora);
    const antes = { pontos: a.pontos, moedas: a.moedas ?? 0, patente: patente(a.pontos, a.pontosTotais) };
    if (nome === vencedor) {
      a.pontos += REGRAS.pontosPorVitoria;
      a.pontosTotais += REGRAS.pontosPorVitoria;
      a.vitorias += 1;
      a.vitoriasSemana += 1;
      a.moedas = (a.moedas ?? 0) + 1;
    } else {
      a.pontos = Math.max(0, a.pontos - REGRAS.pontosPorVitoria);
      a.derrotas += 1;
      a.moedas = Math.max(0, (a.moedas ?? 0) - 1);
    }
    fichas[nome] = { nome, patente: patente(a.pontos, a.pontosTotais), outfit: roupa(e), level: e.level };
    // A tela de fim (`mostrarFimDeArena`): o antes e o depois de cada número, o placar e o level de volta.
    fins[nome] = {
      level: e.level,
      pontos: { antes: antes.pontos, agora: a.pontos },
      moedas: { antes: antes.moedas, agora: a.moedas },
      patente: { antes: antes.patente, agora: fichas[nome].patente },
      placar: { vitorias: a.vitorias, derrotas: a.derrotas },
    };
    s.characterSujo = true;
  }
  const perdedor = d.lados.find((n) => n !== vencedor);
  Q.anotar.run(agora, arena?.nome ?? d.arenaId, agora - d.largadaAte, d.degraus, JSON.stringify(fichas[vencedor] ?? dadosDoLado(vencedor)), JSON.stringify(fichas[perdedor] ?? dadosDoLado(perdedor)));
  for (const nome of d.lados) {
    const s = sessaoDe(nome);
    if (!s?.personagem) continue;
    s.enviar({ t: 'arenaFim', fim: { venceu: nome === vencedor, adversario: nome === vencedor ? perdedor : vencedor, arena: arena?.nome, motivo, ...fins[nome] } });
    s.enviar(vista(s));
  }
}
