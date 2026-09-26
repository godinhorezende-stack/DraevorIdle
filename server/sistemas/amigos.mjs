// Amigos e o Perfil de um personagem — a regra que o cliente (panels.mjs
// `openFriends`, social.mjs `mostrarPerfil`) diz morar no servidor.
//
// Do original (Zoros, 2026-09-26, `api-mapeada/captura-social-0926/`):
// - `{t:'friends', amigos, pedidos, enviados, max: 100, notice}` — chega logo
//   depois do welcome e em resposta a `{t:'friends', action:'list'}`.
// - Cada pessoa: nome, online, vocação, level e a hunt em que está (o cliente
//   escreve "Knight · level 656 · caçando em Winter Dream Court").
// - `{t:'perfil', perfil}`: name, level, vocation, look/colors, addons, mount,
//   online, marca, cacando, hunt, patente da arena, vitórias/derrotas, guilda.
//   Nome que não existe: "não existe ninguém chamado X".
//
// A amizade é guardada no banco (tabela `amizades`), e não no estado de um
// personagem: pedir amizade a quem está offline tem de funcionar.
//
// ESTIMADO (o original não mostrou — pedir amizade lá mandaria um pedido de
// verdade a outro jogador): os textos de erro; pedir a quem já te pediu vira
// amizade na hora; recusar apaga o pedido; tirar serve também para cancelar um
// pedido enviado (o botão "Cancelar" do cliente manda `remove`).
import { readFileSync } from 'node:fs';
import { banco } from '../../game/database/banco.mjs';
import * as Cacadas from './cacadas.mjs';
import * as Promocao from './promocao.mjs';
import * as Guildas from './guildas.mjs';

export const MAX_DE_AMIGOS = 100;
const PATENTES = JSON.parse(readFileSync(new URL('../../assets_raw/gamedata/patentes-arena.json', import.meta.url), 'utf8')).patentes;

await banco.exec(`
  CREATE TABLE IF NOT EXISTS amizades (
    de     TEXT NOT NULL,
    para   TEXT NOT NULL,
    aceita INTEGER NOT NULL DEFAULT 0,
    criada ${banco.dialeto === 'postgres' ? 'BIGINT' : 'INTEGER'} NOT NULL,
    PRIMARY KEY (de, para)
  );
  CREATE INDEX IF NOT EXISTS amizades_para ON amizades(para);
`);

const Q = {
  personagem: banco.prepare('SELECT nome, vocacao, estado FROM personagens WHERE lower(nome) = lower(?)'),
  minhas: banco.prepare('SELECT de, para, aceita FROM amizades WHERE de = ? OR para = ?'),
  par: banco.prepare('SELECT de, para, aceita FROM amizades WHERE (de = ? AND para = ?) OR (de = ? AND para = ?)'),
  pedir: banco.prepare(banco.dialeto === 'postgres' ? 'INSERT INTO amizades (de, para, aceita, criada) VALUES (?, ?, 0, ?) ON CONFLICT DO NOTHING' : 'INSERT OR IGNORE INTO amizades (de, para, aceita, criada) VALUES (?, ?, 0, ?)'),
  aceitar: banco.prepare('UPDATE amizades SET aceita = 1 WHERE de = ? AND para = ?'),
  apagar: banco.prepare('DELETE FROM amizades WHERE (de = ? AND para = ?) OR (de = ? AND para = ?)'),
};

let vivas = new Map(); // nome -> Sessao (injetado por sessao.mjs)
export const ligar = (mapa) => void (vivas = mapa);

/** O estado de alguém: o da sessão aberta ou, offline, o gravado. */
async function quem(nome) {
  const s = vivas.get(nome) ?? [...vivas.values()].find((x) => x.personagem?.nome?.toLowerCase() === nome.toLowerCase());
  if (s?.estado) return { nome: s.personagem.nome, estado: s.estado, online: true, vocacao: s.estado.vocation };
  const linha = await Q.personagem.get(nome);
  if (!linha) return null;
  return { nome: linha.nome, estado: JSON.parse(linha.estado), online: false, vocacao: linha.vocacao };
}

async function pessoa(nome) {
  const q = await quem(nome);
  if (!q) return null;
  return {
    name: q.nome,
    online: q.online,
    vocation: q.estado.vocation ?? q.vocacao,
    vocationName: Promocao.nomeDaClasse({ ...q.estado, vocation: q.estado.vocation ?? q.vocacao }),
    level: q.estado.level ?? 1,
    hunt: q.online && q.estado.hunt ? Cacadas.nomeDaHunt(q.estado.hunt.huntId) : null,
  };
}

/** A lista do personagem `eu`, no formato do original. */
export async function lista(eu, notice = null) {
  const amigos = [];
  const pedidos = [];
  const enviados = [];
  for (const r of await Q.minhas.all(eu, eu)) {
    const outro = r.de === eu ? r.para : r.de;
    const p = await pessoa(outro);
    if (!p) continue;
    if (r.aceita) amigos.push(p);
    else if (r.para === eu) pedidos.push(p);
    else enviados.push(p);
  }
  return { t: 'friends', amigos, pedidos, enviados, max: MAX_DE_AMIGOS, notice };
}

const totalDeAmigos = async (eu) => (await Q.minhas.all(eu, eu)).filter((r) => r.aceita).length;

/*
 * Reenvia a lista a quem está online (depois de algo que muda a dele) —
 * chamada fogo-e-esquece por quem avisa (party.mjs, e aqui embaixo): o
 * resultado nunca é usado, só o efeito de mandar a lista nova.
 */
export async function avisar(nome, notice = null) {
  const s = vivas.get(nome);
  if (s) s.enviar(await lista(nome, notice));
}

/** Entrou ou saiu do jogo: os amigos online veem a bolinha mudar. */
export async function mudouPresenca(nome) {
  for (const r of await Q.minhas.all(nome, nome)) if (r.aceita) await avisar(r.de === nome ? r.para : r.de);
}

/** `{t:'friends', action}` — devolve a mensagem para quem pediu. */
export async function comando(eu, m) {
  const acao = m.action ?? 'list';
  if (acao === 'list') return lista(eu);
  const alvo = await quem(String(m.name ?? '').trim());
  if (!alvo) return { t: 'error', message: `não existe ninguém chamado ${m.name}` };
  const nome = alvo.nome;
  const par = await Q.par.get(eu, nome, nome, eu);
  switch (acao) {
    case 'add': {
      if (nome === eu) return { t: 'error', message: 'Você não pode adicionar a si mesmo.' };
      if (par?.aceita) return { t: 'error', message: `${nome} já é seu amigo.` };
      if (par && par.de === eu) return { t: 'error', message: `Você já pediu amizade a ${nome}.` };
      if ((await totalDeAmigos(eu)) >= MAX_DE_AMIGOS) return { t: 'error', message: `Sua lista está cheia (${MAX_DE_AMIGOS} nomes).` };
      // Ele já tinha pedido: pedir de volta é aceitar.
      if (par && par.para === eu) {
        await Q.aceitar.run(nome, eu);
        avisar(nome, `${eu} aceitou sua amizade.`).catch((e) => console.error('amigos avisar', e.message));
        return lista(eu, `Agora você e ${nome} são amigos.`);
      }
      await Q.pedir.run(eu, nome, Date.now());
      avisar(nome, `${eu} quer ser seu amigo.`).catch((e) => console.error('amigos avisar', e.message));
      return lista(eu, `Pedido de amizade enviado para ${nome}.`);
    }
    case 'accept': {
      if (!par || par.aceita || par.para !== eu) return { t: 'error', message: `${nome} não te pediu amizade.` };
      if ((await totalDeAmigos(eu)) >= MAX_DE_AMIGOS) return { t: 'error', message: `Sua lista está cheia (${MAX_DE_AMIGOS} nomes).` };
      await Q.aceitar.run(nome, eu);
      avisar(nome, `${eu} aceitou sua amizade.`).catch((e) => console.error('amigos avisar', e.message));
      return lista(eu, `Agora você e ${nome} são amigos.`);
    }
    case 'decline': {
      if (!par || par.aceita || par.para !== eu) return { t: 'error', message: `${nome} não te pediu amizade.` };
      await Q.apagar.run(eu, nome, nome, eu);
      avisar(nome).catch((e) => console.error('amigos avisar', e.message));
      return lista(eu);
    }
    case 'remove': {
      if (!par) return { t: 'error', message: `${nome} não está na sua lista.` };
      await Q.apagar.run(eu, nome, nome, eu);
      avisar(nome).catch((e) => console.error('amigos avisar', e.message));
      return lista(eu, par.aceita ? `${nome} saiu da sua lista.` : null);
    }
    default:
      return { t: 'error', message: 'Ação de amigos desconhecida.' };
  }
}

// ---------------------------------------------------------------------------
// Perfil.

function patente(pontos = 0, pontosDeSempre = 0) {
  let i = 0;
  while (i + 1 < PATENTES.length && pontos >= PATENTES[i + 1].pontos) i++;
  const atual = PATENTES[i];
  const prox = PATENTES[i + 1];
  return {
    id: atual.id,
    nome: atual.nome,
    cor: atual.cor,
    pontos,
    pontosDeSempre,
    proxima: prox ? { id: prox.id, nome: prox.nome, pontos: prox.pontos, cor: prox.cor, falta: prox.pontos - pontos } : null,
    noTopo: !prox,
  };
}

/** `{t:'perfil', name}` — a ficha pública de alguém. */
export async function perfil(nome) {
  const q = await quem(String(nome ?? '').trim());
  if (!q) return { t: 'error', message: `não existe ninguém chamado ${nome}` };
  const e = q.estado;
  const outfit = e.outfit ?? {};
  return {
    t: 'perfil',
    perfil: {
      name: q.nome,
      level: e.level ?? 1,
      vocation: e.vocation ?? q.vocacao,
      look: outfit.type ?? 0,
      colors: { type: outfit.type ?? 0, head: outfit.head ?? 0, body: outfit.body ?? 0, legs: outfit.legs ?? 0, feet: outfit.feet ?? 0, addons: outfit.addons ?? 0, mount: outfit.mount ?? 0 },
      addons: outfit.addons ?? 0,
      mount: outfit.mount ?? 0,
      online: q.online,
      marca: null,
      cacando: q.online && !!e.hunt,
      hunt: q.online && e.hunt ? Cacadas.nomeDaHunt(e.hunt.huntId) : null,
      patente: patente(e.arenaPontos ?? 0, e.arenaPontosDeSempre ?? 0),
      arenaVitorias: e.arenaVitorias ?? 0,
      arenaDerrotas: e.arenaDerrotas ?? 0,
      // {id, nome, cargo, posto, brasao}, como o do Zoros no original.
      guilda: Guildas.guildaDe(q.nome),
    },
  };
}
