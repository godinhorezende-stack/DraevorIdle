// Chat (Local, Global, Privado, áudio, presença) e quem aparece na praça — a
// regra que o cliente (chat.mjs `logChat`, `receberPresenca`, `receberAudio`;
// map.mjs a fala `say`) diz morar no servidor.
//
// Do original (`api-mapeada/captura-chat-ranking-0926/` e o chat do Godz em
// `captura-bosses-0924/`):
// - Uma fala: `{t:'chat', channel, name, marca, vocation, level, text, at}`
//   (`marca` é a etiqueta da equipe, "GOD" nível 3; jogador comum, null).
// - Presença: `{t:'presenca', nomes: {Zoros: 'on', Biro: 'off'}}`.
// - A praça mostra os outros jogadores da TELA (até 25, a ≤10 casas no
//   capturado): `{uid: 'p:Nome', name, arenaPontos, x, y, z, dir, look, colors,
//   mount, addons, level, marca, moveMs}`.
// - Pelo cliente: texto até 200; áudio até 30 s, que expira em 5 min
//   (`chatAudio` → a fala leva `audio: {id, segundos, expiraEm}`; tocar pede
//   `ouvirAudio` → `{t:'audio', id, formato, dados}`); a fala do Local vira o
//   balão em cima de quem falou (`{t:'events', events:[{t:'say', quem, ...}]}`).
//
// ESTIMADO (o original não mostrou — testar ali seria falar no chat de todo
// mundo): o Local vale para a tela na praça e para a sala na caçada; o balão sai
// amarelo; os textos de erro; um intervalo mínimo de 1 s entre falas.
//
// NOVO (não existe no original): o canal Mercado — compra e venda para todo o
// servidor, uma fala a cada `INTERVALO_DO_MERCADO_MS` por personagem (como o
// Trade do Tibia), e cada anúncio novo do balcão sai nele (`anunciarOferta`).
import { naTela, JANELA } from '../nucleo/quadro.mjs';
import * as Cacadas from './cacadas.mjs';
import * as Guildas from './guildas.mjs';

export const MAX_TEXTO = 200;
export const MAX_AUDIO_S = 30;
const AUDIO_MS = 5 * 60_000;
const MAX_AUDIO_BYTES = 800_000; // ~30 s de opus em base64, com folga
const INTERVALO_MS = 1000;
export const INTERVALO_DO_MERCADO_MS = 30_000;
const NA_PRACA = 25;
const COR_DA_FALA = '#ffff00';

let vivas = new Map(); // nome -> Sessao (injetado por sessao.mjs)
export const ligar = (mapa) => void (vivas = mapa);

const nomeDe = (s) => s?.personagem?.nome;
const sessaoDe = (nome) => {
  const alvo = String(nome ?? '').toLowerCase();
  return vivas.get(nome) ?? [...vivas.values()].find((s) => nomeDe(s)?.toLowerCase() === alvo) ?? null;
};

/** Na praça (fora de caçada) e no mesmo andar. */
const naPraca = (s) => !!s?.estado && !s.estado.hunt && s.estado.pos;

/** Quem vê quem: na praça, a tela; na caçada, a mesma sala. */
function perto(a, b) {
  if (naPraca(a) && naPraca(b)) return (a.estado.pos.z ?? 7) === (b.estado.pos.z ?? 7) && naTela(a.estado.pos, b.estado.pos);
  if (a.estado?.hunt && b.estado?.hunt) return Cacadas.salaDe(a.estado.hunt) === Cacadas.salaDe(b.estado.hunt);
  return false;
}

/** Os brasões das guildas de quem está na tela: `{nome da guilda: brasão}`, como o `city.brasoes` do original. */
export function brasoesDaPraca(jogadores) {
  const r = {};
  for (const j of jogadores) if (j.guilda && !r[j.guilda]) r[j.guilda] = Guildas.guildaDe(j.name)?.brasao ?? null;
  return r;
}

/*
 * ---- O índice espacial da praça (Fase 4.1) ----
 *
 * `jogadoresNaPraca` varria TODO mundo online para achar quem está perto de
 * UM jogador — com N pessoas na praça isso é O(N) por jogador chamado, e
 * como todo mundo na praça chama a cada tique, O(N²) no tique inteiro (200 na
 * praça: medido, tools/carga.mjs 200 40 cidade, 81% de CPU — pior que
 * caçando).
 *
 * Duas coisas caras aconteciam de novo para CADA jogador que perguntava:
 * (1) a varredura de todo mundo, e (2) montar o "cartão" (nome, aparência,
 * cores, guilda — a mesma consulta `Guildas.guildaDe` de novo) de cada
 * vizinho, mesmo que dois jogadores vizinhos vejam exatamente os MESMOS
 * cartões. Agora os dois viram trabalho de uma vez por PASSO do relógio, não
 * por jogador: o índice guarda o cartão JÁ PRONTO de cada um (montado uma
 * única vez), numa grade de células maiores que a tela (`JANELA`, 13×8) — a
 * vizinhança de 1 célula ao redor SEMPRE cobre tudo que cabe na tela, então
 * nenhum vizinho de verdade fica de fora. `invalidarIndice` (chamado em
 * `rodarRelogio`, uma vez por passo de 50ms) é o único jeito da posição/
 * aparência de alguém aparecer atualizada — dentro do mesmo passo, o cartão
 * fica congelado (mesma folga que `Ficha.combate` aceita, Fase 3.1).
 */
const TAM_DA_CELULA = Math.ceil(Math.max(JANELA.x, JANELA.y)) + 2;
let indice = null;

function garantirIndice() {
  if (indice) return indice;
  indice = new Map();
  for (const s of vivas.values()) {
    if (!naPraca(s)) continue;
    const e = s.estado;
    const p = e.pos;
    const o = e.outfit ?? {};
    const guilda = Guildas.guildaDe(nomeDe(s));
    const cartao = {
      uid: `p:${nomeDe(s)}`,
      name: nomeDe(s),
      arenaPontos: e.arenaPontos ?? 0,
      x: p.x,
      y: p.y,
      z: p.z ?? 7,
      dir: p.dir ?? 2,
      look: o.type ?? 0,
      colors: { type: o.type ?? 0, head: o.head ?? 0, body: o.body ?? 0, legs: o.legs ?? 0, feet: o.feet ?? 0, addons: o.addons ?? 0, mount: o.mount ?? 0 },
      mount: o.mount ?? 0,
      addons: o.addons ?? 0,
      level: e.level ?? 1,
      marca: null,
      moveMs: e.moveMs ?? 250,
      // Quem é de guilda leva o nome dela; o brasão vai uma vez em `brasoes` (ver `brasoesDaPraca`).
      ...(guilda ? { guilda: guilda.nome } : {}),
    };
    const chave = `${Math.floor(p.x / TAM_DA_CELULA)},${Math.floor(p.y / TAM_DA_CELULA)},${p.z ?? 7}`;
    let lista = indice.get(chave);
    if (!lista) indice.set(chave, (lista = []));
    lista.push({ s, cartao });
  }
  return indice;
}

/** Um passo do relógio novo: a posição/aparência de todo mundo pode ter mudado desde o índice de antes. */
export function invalidarIndice() {
  indice = null;
}

/** Os outros jogadores na tela da praça, no formato do original (até 25, os mais perto). */
export function jogadoresNaPraca(eu) {
  if (!naPraca(eu)) return [];
  const p = eu.estado.pos;
  const z = p.z ?? 7;
  const idx = garantirIndice();
  const cx = Math.floor(p.x / TAM_DA_CELULA);
  const cy = Math.floor(p.y / TAM_DA_CELULA);
  const candidatos = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const vizinhos = idx.get(`${cx + dx},${cy + dy},${z}`);
      if (!vizinhos) continue;
      for (const { s, cartao } of vizinhos) {
        // O `z` já veio igual pela chave da célula — só falta a tela (`naTela`, a mesma conta do `perto`).
        if (s === eu || !naTela(p, cartao)) continue;
        candidatos.push({ cartao, _d: Math.max(Math.abs(cartao.x - p.x), Math.abs(cartao.y - p.y)) });
      }
    }
  }
  return candidatos
    .sort((a, b) => a._d - b._d)
    .slice(0, NA_PRACA)
    .map(({ cartao }) => cartao);
}

function fala(s, extras) {
  return { t: 'chat', name: nomeDe(s), marca: null, vocation: s.estado?.vocation, level: s.estado?.level ?? 1, at: Date.now(), ...extras };
}

/** Manda a fala para quem deve ouvir; devolve o erro (ou null). */
function espalhar(s, channel, to, conteudo) {
  if (channel === 'global') {
    // Mesma fala para todo mundo online: um `JSON.stringify` só, não um por
    // destinatário (200 gente no Global eram 200 stringifies do mesmo objeto).
    const texto = JSON.stringify(fala(s, { channel: 'global', ...conteudo }));
    for (const outro of vivas.values()) if (outro.personagem) outro.enviarPronto(texto);
    return null;
  }
  if (channel === 'mercado') {
    const texto = JSON.stringify(fala(s, { channel: 'mercado', ...conteudo }));
    for (const outro of vivas.values()) if (outro.personagem) outro.enviarPronto(texto);
    return null;
  }
  if (channel === 'local') {
    const texto = JSON.stringify(fala(s, { channel: 'local', ...conteudo }));
    const pos = s.estado.hunt ? s.estado.hunt.pos : s.estado.pos;
    const balaoTexto = conteudo.text
      ? JSON.stringify({ t: 'events', events: [{ t: 'say', quem: nomeDe(s), text: conteudo.text, x: pos.x, y: pos.y, color: COR_DA_FALA }] })
      : null;
    for (const outro of vivas.values()) {
      if (!outro.personagem || (outro !== s && !perto(s, outro))) continue;
      outro.enviarPronto(texto);
      if (balaoTexto) outro.enviarPronto(balaoTexto);
    }
    return null;
  }
  if (channel === 'private') {
    const alvo = sessaoDe(to);
    if (!alvo?.personagem) return `${to} não está online.`;
    if (alvo === s) return 'Você não pode mandar mensagem para si mesmo.';
    const msg = fala(s, { channel: 'private', para: nomeDe(alvo), ...conteudo });
    alvo.enviar(msg);
    s.enviar(msg);
    return null;
  }
  return 'Esse canal não aceita mensagens.';
}

/** Uma fala a cada `INTERVALO_MS` por personagem (anti-enxurrada). */
function cedoDemais(s) {
  const agora = Date.now();
  if (agora - (s.ultimaFala ?? 0) < INTERVALO_MS) return true;
  s.ultimaFala = agora;
  return false;
}

/** `{t:'chat', channel, to?, text}`. Devolve o erro (ou null). */
export function falar(s, m) {
  const text = String(m.text ?? '').trim().slice(0, MAX_TEXTO);
  if (!text) return null;
  if (text.startsWith('/')) return 'Esse comando é só da equipe do jogo.';
  if (cedoDemais(s)) return 'Calma: uma mensagem por segundo.';
  if (m.channel === 'mercado' && cedoNoMercado(s)) return `No Mercado, uma mensagem a cada ${INTERVALO_DO_MERCADO_MS / 1000} segundos.`;
  return espalhar(s, m.channel ?? 'global', m.to, { text });
}

function cedoNoMercado(s) {
  const agora = Date.now();
  if (agora - (s.ultimaNoMercado ?? 0) < INTERVALO_DO_MERCADO_MS) return true;
  s.ultimaNoMercado = agora;
  return false;
}

/** Um anúncio novo do balcão vira uma fala de quem anunciou na aba Mercado (sem gastar o intervalo dele). */
export function anunciarOferta(s, { kind, count, nome, preco, moeda }) {
  const verbo = kind === 'buy' ? 'Compro' : 'Vendo';
  const valor = `${Number(preco).toLocaleString('pt-BR')} ${moeda === 'coin' ? 'Ravox Coins' : 'gold'}`;
  espalhar(s, 'mercado', null, { text: `${verbo} ${count}x ${nome} por ${valor} cada — no balcão do Mercado.` });
}

// ---------------------------------------------------------------------------
// Áudio: guardado 5 minutos, tocado sob pedido.

const audios = new Map(); // id -> { formato, dados, expira }
let proximoAudio = 1;

function limparAudios(agora = Date.now()) {
  for (const [id, a] of audios) if (a.expira <= agora) audios.delete(id);
}

/** `{t:'chatAudio', channel, to, formato, dados, segundos}`. Devolve o erro (ou null). */
export function falarAudio(s, m) {
  const dados = String(m.dados ?? '');
  const segundos = Math.min(MAX_AUDIO_S, Number(m.segundos) || 0);
  if (!dados || segundos <= 0) return null;
  if (dados.length > MAX_AUDIO_BYTES) return 'Áudio grande demais.';
  if (!/^audio\//.test(String(m.formato ?? ''))) return 'Formato de áudio inválido.';
  if (cedoDemais(s)) return 'Calma: uma mensagem por segundo.';
  limparAudios();
  const id = `a${proximoAudio++}`;
  const expiraEm = Date.now() + AUDIO_MS;
  audios.set(id, { formato: m.formato, dados, expira: expiraEm });
  return espalhar(s, m.channel ?? 'global', m.to, { text: '', audio: { id, segundos: Math.round(segundos * 10) / 10, expiraEm } });
}

/** `{t:'ouvirAudio', id}` → os bytes, ou `erro` quando expirou. */
export function ouvirAudio(id) {
  limparAudios();
  const a = audios.get(id);
  return a ? { t: 'audio', id, formato: a.formato, dados: a.dados } : { t: 'audio', id, erro: 'expirou' };
}

/** `{t:'presenca', nomes:[...]}` → `{nomes: {nome: 'on'|'off'}}`, com o nome como veio. */
export function presenca(nomes) {
  const r = {};
  for (const n of (Array.isArray(nomes) ? nomes : []).slice(0, 100)) r[n] = sessaoDe(n)?.personagem ? 'on' : 'off';
  return { t: 'presenca', nomes: r };
}
