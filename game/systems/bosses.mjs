// Os bosses além da luta: Boss Tasks, Auto Boss e a loja de Boss Token.
//
// Regras do original (cliente `panels.mjs` + o `character` capturado do Zoros,
// `api-mapeada/treino-online-full.json`):
// - Boss Task: "uma vez por personagem". Matar `alvo` criaturas da lista abre o
//   boss (`feito`); matá-lo fecha para sempre (`matou`). Boss de task não tem
//   cooldown — o card mostra a barra da task em vez do relógio. Fechar a task
//   paga `tokens` Task Token.
// - Auto Boss: até `teto` (15) bosses marcados, um depois do outro, pulando os
//   em cooldown; cada leva de 15 ENTRADAS pede `esperaTotal` (6h) — o passe da
//   loja tira a espera e o teto. `pausa` (8s) entre um boss e o próximo. Até
//   `listasMax` (5) sequências com nome; nome repetido regrava. Morrer para a
//   rotação.
// - A espera de um boss começa quando se ENTRA, mesmo que ele não caia; 25
//   minutos na sala nos dois modos.
import { readFileSync } from 'node:fs';
import { CATALOGO, CHARACTER_TEMPLATE, STORE_REAL } from './dados.mjs';
import { darItem } from './inventario.mjs';
import * as Bau from './bau.mjs';
import * as Beta from './modo-beta.mjs';
import { ehBossDeAto, CAMPANHA } from './campanha.mjs';

export const TEMPO_NA_SALA_MS = 25 * 60_000;

const TASK_TOKEN = JSON.parse(readFileSync(new URL('../gamedata/task-token-real.json', import.meta.url), 'utf8')).loja.token;
const CAPTURADA = JSON.parse(readFileSync(new URL('../../api-mapeada/servidor/bossToken.json', import.meta.url), 'utf8')).loja;
/*
 * A frase das Lasting Exercise veio da captura do servidor original: "14.400
 * cargas — na Ravox Store ela custa 50 coins." O nome é o de antes do rebrand
 * e o preço, escrito à mão, envelhece sozinho quando a Store muda. A frase é
 * montada aqui com as cargas e o preço da MESMA entrada da Store que vende a
 * arma; o que não tiver par na Store fica como veio, só com o nome trocado.
 */
const EXERCISE_NA_STORE = new Map((STORE_REAL.exercises ?? []).map((e) => [e.itemId, e]));
export function textoDaOferta(oferta) {
  const naStore = oferta.grupo === 'exercise' ? EXERCISE_NA_STORE.get(oferta.itemId) : null;
  if (naStore?.cargas && naStore.coins != null) {
    return `${naStore.cargas.toLocaleString('pt-BR')} cargas — na Store ela custa ${naStore.coins} coins.`;
  }
  return typeof oferta.blurb === 'string' ? oferta.blurb.replace(/Ravox/g, 'Draevor') : oferta.blurb;
}
const LOJA_REAL = { ...CAPTURADA, ofertas: CAPTURADA.ofertas.map((o) => ({ ...o, blurb: textoDaOferta(o) })) };
const BOSS_TOKEN = LOJA_REAL.token;
const MOLDE_DO_AUTO = CHARACTER_TEMPLATE.autoBoss;

const acharBoss = (id) => CATALOGO.bosses.find((b) => b.id === id) ?? null;

// ---- Boss Diários (a área da praça, `acao: 'boss-diarios'` em city-meta.json) ----

/*
 * A escala real (`gamedata/novidades.json`, "22 de setembro — os Boss
 * Diários"): segunda Ferumbras, terça Ghazbaran, quarta Morgaroth, quinta
 * Apocalypse, sexta Orshabaal, sábado Zamulosh, domingo Gaz'haragoth — um
 * boss achado às 20h, a semana inteira. `Date#getDay()`: 0 = domingo.
 *
 * Dos sete, só o Zamulosh foi capturado com ficha própria (sala, posição,
 * hp, exp — ver `catalog-real.json`). Os outros seis nunca foram vistos ao
 * vivo nesta restauração: entrar force chutar hp/sala/loot de um boss que
 * ninguém capturou, o que este projeto nunca faz (ver README). Por isso a
 * escala fica documentada e pronta, mas só entra de verdade quem cair num
 * dia com boss real — o resto avisa exatamente isso, em vez de inventar.
 */
const ESCALA_SEMANAL = [
  { dia: 'domingo', nome: "Gaz'haragoth", id: 'gazharagoth' },
  { dia: 'segunda', nome: 'Ferumbras', id: 'ferumbras' },
  { dia: 'terça', nome: 'Ghazbaran', id: 'ghazbaran' },
  { dia: 'quarta', nome: 'Morgaroth', id: 'morgaroth' },
  { dia: 'quinta', nome: 'Apocalypse', id: 'apocalypse' },
  { dia: 'sexta', nome: 'Orshabaal', id: 'orshabaal' },
  { dia: 'sábado', nome: 'Zamulosh', id: 'zamulosh' },
];

/** O boss de hoje na escala, e se ele já foi capturado (`boss` só existe quando dá para entrar). */
export function bossDeHoje(agora = Date.now()) {
  const item = ESCALA_SEMANAL[new Date(agora).getDay()];
  return { ...item, boss: acharBoss(item.id) };
}

// ---- Boss Tasks ----

/*
 * ---- As mortes da Boss Task são as do BESTIARY ----
 *
 * No original, a task conta desde sempre: as três do Zoros (2026-09-26) são a
 * soma cravada do bestiary dos alvos — Minotauros 465 = minotaur + guard + mage,
 * Dragon Lords 12, Necromancers 2. Aqui ela contava do zero a partir de quando a
 * task nasceu. O contador antigo fica como piso: quem já tinha contado mortes
 * antes de o bestiary existir não perde nada.
 */
const doBestiary = (estado, t) => t.alvos.reduce((s, a) => s + (estado.bestiary?.[a.key] ?? 0), 0);

/** A lista guardada, sem acertar com o bestiary. Quem é de antes começa do zero (o molde é o progresso do Zoros). */
function guardadas(estado) {
  if (!Array.isArray(estado.bossTasks)) {
    estado.bossTasks = CHARACTER_TEMPLATE.bossTasks.map((t) => ({ ...t, kills: 0, feito: false, matou: false }));
  }
  return estado.bossTasks;
}

/** As tasks deste personagem, com as mortes acertadas pelo bestiary. */
export function tasks(estado) {
  for (const t of guardadas(estado)) if (!t.feito) t.kills = Math.min(t.alvo, Math.max(t.kills, doBestiary(estado, t)));
  return estado.bossTasks;
}

const taskDoBoss = (estado, bossId) => tasks(estado).find((t) => t.boss === bossId) ?? null;

/**
 * Uma criatura morta conta para toda task aberta que a tenha nos `alvos`.
 * Chamado DEPOIS do bestiary contar esta morte: `kills + 1` é o contador antigo
 * andando, e o bestiary já inclui a morte — o maior dos dois, sem contar duas vezes.
 */
export function contarMorte(estado, key) {
  for (const t of guardadas(estado)) {
    if (t.feito || !t.alvos.some((a) => a.key === key)) continue;
    t.kills = Math.max(t.kills + 1, doBestiary(estado, t));
    if (t.kills < t.alvo) continue;
    t.kills = t.alvo;
    t.feito = true;
    darItem(estado, TASK_TOKEN, t.tokens);
    estado.avisoDaHunt = `Boss Task "${t.name}" completa: ${t.bossName} liberado (+${t.tokens} Task Token).`;
  }
}

/** Boss de task: só entra com a task feita e ele ainda vivo. `null` = pode. */
export function recusaDaTask(estado, bossId) {
  const t = taskDoBoss(estado, bossId);
  if (!t) return null;
  if (t.matou) return `${t.bossName} já foi derrotado — sai uma vez por personagem.`;
  if (!t.feito) return `Termine a Boss Task antes: ${t.kills.toLocaleString('pt-BR')} / ${t.alvo.toLocaleString('pt-BR')} ${t.name}.`;
  return null;
}

/** Na entrada: o de task não tem relógio; o diário começa a esperar agora. */
export function marcarEntrada(estado, bossId, agora = Date.now()) {
  if (Beta.ativo()) return; // modo beta: nenhuma espera começa na entrada
  if (taskDoBoss(estado, bossId)) return;
  if (ehBossDeAto(bossId)) return; // boss de fim de ato: sem recarga, nenhuma espera começa na entrada
  const boss = acharBoss(bossId);
  Bau.garantir(estado).bossCooldownsAte[bossId] = agora + (boss?.cooldownHours ?? 12) * 3_600_000;
}

/**
 * Zera as recargas GRAVADAS dos bosses de fim de ato (de antes de eles ficarem sem espera: ex.: The Primal Menace com 72 h). Só o carimbo de
 * "quando volta" some — progresso, vitórias e sacolas não são tocados. Devolve quantos carimbos limpou.
 */
export function limparRecargasDeAto(estado) {
  const mapa = Bau.garantir(estado).bossCooldownsAte;
  let n = 0;
  for (const { bossId } of Object.values(CAMPANHA.bosses)) {
    if ((mapa[bossId] ?? 0) > 0) {
      mapa[bossId] = 0;
      n++;
    }
  }
  return n;
}

/** Na vitória: o de task fecha para sempre. */
export function marcarVitoria(estado, bossId) {
  const t = taskDoBoss(estado, bossId);
  if (t) t.matou = true;
}

// ---- Auto Boss ----

export function auto(estado, agora = Date.now()) {
  estado.autoBoss = { ...structuredClone(MOLDE_DO_AUTO), ...(estado.autoBoss ?? {}) };
  const a = estado.autoBoss;
  a.listas ??= [];
  // A espera guardada como instante; `espera` (o que o client lê) é quanto falta.
  if (a.esperaAte && a.esperaAte <= agora) {
    a.esperaAte = 0;
    a.usados = 0;
  }
  a.semLimite = !!(a.passe && a.passeAte > agora);
  a.espera = a.semLimite ? 0 : Math.max(0, (a.esperaAte ?? 0) - agora);
  return a;
}

export function autoParaCliente(estado, agora = Date.now()) {
  const { esperaAte, proximoEm, ...resto } = auto(estado, agora);
  return resto;
}

/** Por que este boss não entra agora (`null` = entra). Mesma régua do `entrar`. */
function motivoParaPular(estado, id, agora) {
  const boss = acharBoss(id);
  if (!boss) return 'não existe';
  if (Beta.ativo()) return null;
  if ((estado.level ?? 0) < (boss.level ?? 0)) return `level ${boss.level}`;
  const task = recusaDaTask(estado, id);
  if (task) return task;
  if (!ehBossDeAto(id) && (Bau.garantir(estado).bossCooldownsAte[id] ?? 0) > agora) return 'cooldown';
  return null;
}

/** `send({t:'autoBoss', action})` — save / remove / start / stop. */
export function comandoDoAuto(estado, m, agora = Date.now()) {
  const a = auto(estado, agora);
  const teto = a.semLimite ? Infinity : a.teto;
  const idsValidos = (ids) => [...new Set((Array.isArray(ids) ? ids : []).filter((id) => acharBoss(id)))];

  if (m.action === 'save') {
    const nome = String(m.nome ?? '').trim().slice(0, 24);
    const ids = idsValidos(m.ids);
    if (!nome || !ids.length) return { ok: false, erro: 'Dê um nome e marque pelo menos um boss.' };
    const i = a.listas.findIndex((l) => l.nome === nome);
    if (i >= 0) a.listas[i] = { nome, ids };
    else if (a.listas.length >= a.listasMax) return { ok: false, erro: `${a.listasMax} é o limite — salvar com um nome já usado regrava aquela.` };
    else a.listas.push({ nome, ids });
    return { ok: true, notice: `Sequência "${nome}" guardada.` };
  }
  if (m.action === 'remove') {
    a.listas = a.listas.filter((l) => l.nome !== m.nome);
    return { ok: true };
  }
  if (m.action === 'stop') {
    a.ligado = false;
    a.proximoEm = 0;
    return { ok: true, notice: 'Auto Boss parado.' };
  }
  if (m.action === 'start') {
    if (estado.hunt) return { ok: false, erro: 'Saia da caçada antes de ligar o Auto Boss.' };
    if (a.espera > 0) return { ok: false, erro: 'A leva de bosses está em espera.' };
    const ids = idsValidos(m.ids);
    if (!ids.length) return { ok: false, erro: 'Marque pelo menos um boss.' };
    if (ids.length > teto) return { ok: false, erro: `Marque até ${teto} bosses.` };
    if (ids.every((id) => motivoParaPular(estado, id, agora))) {
      const motivos = [...new Set(ids.map((id) => motivoParaPular(estado, id, agora)))].join('; ');
      return { ok: false, erro: `Nenhum dos marcados pode entrar agora (${motivos}) — a rotação não teria por onde começar.` };
    }
    a.ligado = true;
    a.bosses = ids;
    a.nomes = ids.map((id) => acharBoss(id).name);
    a.feitos = [];
    a.proximoEm = agora;
    return { ok: true };
  }
  return { ok: false, erro: 'Ação desconhecida.' };
}

/**
 * Na cidade, com a rotação ligada: o próximo boss que dá para entrar, depois
 * da pausa. Devolve o id (e já conta a entrada na leva) ou `null`. Sem mais
 * nenhum para entrar, a rotação desliga sozinha.
 */
export function proximoDoAuto(estado, agora = Date.now()) {
  const a = auto(estado, agora);
  if (!a.ligado || estado.hunt || (a.proximoEm ?? 0) > agora) return null;
  if (a.espera > 0) return null;
  const id = a.bosses.find((b) => !a.feitos.includes(b) && !motivoParaPular(estado, b, agora));
  if (!id) {
    a.ligado = false;
    estado.avisoDaHunt = 'Auto Boss terminou a lista.';
    return null;
  }
  a.feitos.push(id);
  if (!a.semLimite) {
    a.usados += 1;
    if (a.usados >= a.teto) a.esperaAte = agora + a.esperaTotal;
  }
  return id;
}

/** Saiu da sala (vitória, tempo ou teleporte): a próxima entra depois da pausa. */
export function depoisDoBoss(estado, agora = Date.now()) {
  const a = auto(estado, agora);
  if (a.ligado) a.proximoEm = agora + (a.pausa ?? 8000);
}

/** "Morrer para a rotação." */
export function pararPorMorte(estado) {
  if (estado.autoBoss?.ligado) estado.autoBoss.ligado = false;
}

// ---- Loja de Boss Token ----

const contarTokens = (estado) => (estado.inventory ?? []).filter((p) => p.id === BOSS_TOKEN).reduce((s, p) => s + (p.count ?? 1), 0);

export function lojaParaCliente(estado) {
  const saldo = contarTokens(estado);
  const ofertas = LOJA_REAL.ofertas.map((o) => {
    const owned = o.grupo === 'outfit' && (estado.lojaOutfits ?? []).includes(o.look);
    return { ...o, owned, podeComprar: !owned && saldo >= o.tokens };
  });
  return { t: 'bossToken', loja: { ...LOJA_REAL, saldo, ofertas } };
}

/** `send({t:'bossToken', action:'buy', id})` — paga em Boss Token (o item) e entrega o item da oferta. */
export function comprar(estado, { id }) {
  const oferta = LOJA_REAL.ofertas.find((o) => o.id === id);
  if (!oferta) return { ok: false, erro: 'Oferta inexistente.' };
  if (oferta.grupo === 'outfit' && (estado.lojaOutfits ?? []).includes(oferta.look)) return { ok: false, erro: 'Você já tem esse outfit.' };
  if (contarTokens(estado) < oferta.tokens) return { ok: false, erro: `Precisa de ${oferta.tokens} Boss Token.` };
  let falta = oferta.tokens;
  for (const p of estado.inventory) {
    if (p.id !== BOSS_TOKEN || !falta) continue;
    const tira = Math.min(falta, p.count ?? 1);
    p.count = (p.count ?? 1) - tira;
    falta -= tira;
  }
  estado.inventory = estado.inventory.filter((p) => p.id !== BOSS_TOKEN || p.count > 0);
  if (oferta.id === 'bt-wildcards-5') estado.wildcards = (estado.wildcards ?? 0) + 5;
  else if (oferta.grupo === 'outfit') (estado.lojaOutfits ??= []).push(oferta.look);
  else if (oferta.itemId) darItem(estado, oferta.itemId, 1);
  return { ok: true, notice: `Comprado: ${oferta.name}.` };
}
