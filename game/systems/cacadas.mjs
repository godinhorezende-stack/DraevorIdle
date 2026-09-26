// Hunts (caçadas). Funções puras sobre `estado` — quem manda a resposta pro
// cliente é `sessao.mjs`; este arquivo não conhece WebSocket.
//
// SÓ as hunts com TERRENO REAL capturado (`hunt.limite.andares`, um polígono
// de verdade do `catalog-real.json`) entram na lista jogável — 5 das 48 reais
// (`troll-cave`, `amazon-camp`, `dark-thais`, `infernatil-seal`,
// `walking-pillar`). As outras 43 não têm terreno capturado: no jogo
// original a maioria é gerada de novo a cada sessão, e esse gerador não
// existe em nenhum arquivo extraído — oferecê-las seria inventar chão. Ver
// `api-mapeada/checklist-modulos.md`.
import { CATALOGO, ITEM_CATALOG } from './dados.mjs';
import * as R from './regras.mjs';
import { VALOR_DA_MOEDA, pesoDoInventario, removerItem } from './inventario.mjs';
import * as Acoes from './acoes.mjs';
import * as Treino from './treino.mjs';
import * as Bolsa from './bolsa.mjs';
import * as Ficha from './ficha.mjs';
import * as Bau from './bau.mjs';
import * as Boosts from './boosts.mjs';
import * as Stamina from './stamina.mjs';
import * as Treinos from './treinos.mjs';
import * as Premium from './premium.mjs';
import * as BuffPower from './buffpower.mjs';
import * as Summon from './summon.mjs';
import * as Afixos from './afixos.mjs';
import * as Prey from './prey.mjs';
import * as Imbuements from './imbuements.mjs';
import * as Promocao from './promocao.mjs';
import * as Arena from './arena.mjs';
import * as Arvore from './arvore.mjs';
import * as Bosses from './bosses.mjs';
import { SPAWNS_CAPTURADOS, mapaRealCapturado, pontosNoMapa, acharHunt, huntOuMapaCustom, nomeDaHunt, temTerrenoReal, gradeDaHunt } from './hunt/terreno.mjs';
import { BESTIARY, criarMonstro, trocarDeAndar, renascer, passoDoBicho, moverMonstros, compactarMonstro, completarMonstro, garantirUidAcimaDe } from './hunt/monstros.mjs';
import { destinoDaMudanca, andarDaGrade } from './hunt/andares.mjs';
import { VIZINHANCA_8, proximoPassoAte, casaAndavelMaisProxima, casaLivrePerto, distancia } from './hunt/caminho.mjs';
import { novaSessao, sessaoParaCliente, relatorio, somarSessao } from './hunt/relatorio.mjs';
import { salaDe, ligarAoDono } from './hunt/sala.mjs';
import { alvoAtual, esperaOAlvoChegar, voltariaAtras, PERSEGUICAO_MAXIMA_MS } from './hunt/alvo.mjs';
import { waypointMaisPerto, passoNoPercurso } from './hunt/percurso.mjs';
import { proximoMonstroForaDeAlcance, metaDoLure, atualizarLure } from './hunt/lure.mjs';
import { processarMortes, armaDoPersonagem, alcanceDaArma, subirDeLevel, ATAQUE_MS, round, golpesDosMonstros } from './hunt/combate.mjs';

// A API de antes, agora nos módulos de `hunt/`.
export { nomeDaHunt, huntsJogaveis, gradeDaHunt, aquecerGrades } from './hunt/terreno.mjs';
export { destinoDaMudanca, andarDaGrade } from './hunt/andares.mjs';
export { bfsDistanciasAntiga, bfsDistancias, VIZINHANCA_4, VIZINHANCA_8 } from './hunt/caminho.mjs';
export { relatorio } from './hunt/relatorio.mjs';
export { salaDe, virarDono, mudarDeDono, separar } from './hunt/sala.mjs';
export { alvoAtual } from './hunt/alvo.mjs';
export { runParaCliente } from './hunt/percurso.mjs';
export { armaDoPersonagem, alcanceDaArma, subirDeLevel } from './hunt/combate.mjs';

/*
 * ---- A caçada no banco ----
 *
 * Os bichos vão sem o que é cópia do bestiário (ver `compactarMonstro`). A
 * caçada viva não é tocada: sai uma cópia rasa com as listas de bichos
 * trocadas.
 */
const compactarLista = (lista) => (Array.isArray(lista) ? lista.map(compactarMonstro) : lista);

export function huntParaGravar(hunt) {
  if (!hunt) return hunt;
  const copia = { ...hunt, monstros: compactarLista(hunt.monstros) };
  if (hunt.outrosAndares) {
    copia.outrosAndares = Object.fromEntries(Object.entries(hunt.outrosAndares).map(([z, lista]) => [z, compactarLista(lista)]));
  }
  return copia;
}

/** A caçada lida do banco: os bichos completos de novo, e o contador de `uid` acima de todos eles. */
export function huntAoCarregar(hunt) {
  if (!hunt) return hunt;
  const listas = [hunt.monstros, ...Object.values(hunt.outrosAndares ?? {})].filter(Array.isArray);
  let maior = 0;
  for (const lista of listas) {
    for (const m of lista) {
      completarMonstro(m);
      if (Number(m.uid) > maior) maior = Number(m.uid);
    }
  }
  garantirUidAcimaDe(maior);
  return hunt;
}

/*
 * ---- Caçada offline ----
 *
 * No original o personagem continua caçando com a aba fechada ("Caçando
 * offline em Troll Cave", na lista de personagens) e, ao voltar, aparece
 * "Progresso enquanto você esteve fora". Aqui a sessão grava `offlineDesde`
 * ao soltar o personagem e, na volta, este passo SIMULA o tempo que passou,
 * tique a tique (o mesmo `tique` de sempre, com o relógio adiantado) — o
 * resultado é o de ter caçado de verdade, não uma conta por média — até
 * `SIMULACAO_MAXIMA_MS` (30 min de caçada custam ~3s de processamento, e o
 * Node é uma thread só: simular 12h travaria o servidor para todo mundo por
 * um minuto). O que passar disso é PROJETADO no ritmo que a simulação mediu
 * (exp, mortes, ouro, loot e poções por minuto) e aplicado de verdade no
 * personagem. Teto total de `AUSENCIA_MAXIMA_MS`.
 */
const AUSENCIA_MAXIMA_MS = 12 * 3_600_000;
const SIMULACAO_MAXIMA_MS = 30 * 60_000;

/** Aplica `fator` vezes o que a sessão `base` rendeu, sem simular (ver acima). */
function projetar(estado, base, fator) {
  const extra = {
    exp: Math.round(base.exp * fator), kills: Math.round(base.kills * fator),
    gold: Math.round(base.gold * fator), lootValue: Math.round(base.lootValue * fator),
    supplies: Math.round(base.supplies * fator), damageDealt: Math.round((base.damageDealt ?? 0) * fator),
    itens: { loot: {}, vendido: {}, gastos: {}, ignorado: {}, perdido: {} },
  };
  estado.xp = (estado.xp ?? 0) + extra.exp;
  estado.bank = (estado.bank ?? 0) + extra.gold; // `gold` da sessão é moeda do loot: vai para o banco
  subirDeLevel(estado);
  for (const [id, n] of Object.entries(base.itens.loot)) {
    const qtd = Math.round(n * fator);
    if (!qtd) continue;
    extra.itens.loot[id] = qtd;
    if (VALOR_DA_MOEDA[id]) continue; // já entrou no `gold`
    // O peso vale na projeção também: o que não cabe fica no chão ("perdido").
    const peso = ITEM_CATALOG[id]?.weight ?? 0;
    const livre = Afixos.capacidade(estado) - pesoDoInventario(estado);
    const cabe = peso > 0 ? Math.max(0, Math.min(qtd, Math.floor(livre / peso))) : qtd;
    const entrou = cabe ? Bolsa.porNaBolsa(estado, Number(id), cabe) : 0;
    if (qtd - entrou > 0) extra.itens.perdido[id] = (extra.itens.perdido[id] ?? 0) + (qtd - entrou);
    extra.itens.loot[id] = entrou;
  }
  // O que a auto-venda teria vendido nesse tempo todo.
  for (const [id, n] of Object.entries(base.itens.vendido ?? {})) {
    const qtd = Math.round(n * fator);
    if (qtd) extra.itens.vendido[id] = qtd;
  }
  if (estado.settings?.autoSellPouch !== false) {
    const venda = Bolsa.venderBolsa(estado);
    extra.lootValue = venda.gold;
  }
  for (const [id, n] of Object.entries(base.itens.gastos)) {
    const tem = (estado.inventory ?? []).filter((p) => p.id === Number(id)).reduce((a, p) => a + (p.count ?? 1), 0);
    const qtd = Math.min(tem, Math.round(n * fator));
    if (qtd) {
      removerItem(estado, Number(id), qtd);
      extra.itens.gastos[id] = qtd;
    }
  }
  return extra;
}

/** Se a volta tem caçada offline para simular (o mesmo corte de `simularAusencia`: 5 s ou mais fora). */
export function temAusenciaParaSimular(estado, agora = Date.now()) {
  const desde = estado?.hunt?.offlineDesde;
  return !!desde && Math.min(agora, desde + AUSENCIA_MAXIMA_MS) - desde >= 5000;
}

export function simularAusencia(estado, personagem, agora = Date.now()) {
  const hunt = estado.hunt;
  if (!hunt?.offlineDesde) return null;
  const desde = hunt.offlineDesde;
  delete hunt.offlineDesde;
  const ate = Math.min(agora, desde + AUSENCIA_MAXIMA_MS);
  if (ate - desde < 5000) return null;

  const principal = hunt.sessao ?? novaSessao(estado, huntOuMapaCustom(hunt.huntId).name ?? hunt.huntId, hunt.modo, desde);
  const fora = novaSessao(estado, principal.hunts[0], hunt.modo, desde);
  hunt.sessao = fora;
  hunt.ultimoTique = desde;
  hunt.proximoPassoEm = hunt.proximoGolpeEm = hunt.proximoPassoMonstroEm = 0;
  hunt.rumo = null;
  // A caçada automática corre sozinha; na online, fora da tela, também — é
  // o que o original faz ("Caçando offline").
  const modo = hunt.modo;
  hunt.modo = 'auto';

  let morreu = false;
  let t = desde;
  const fimDaSimulacao = Math.min(ate, desde + SIMULACAO_MAXIMA_MS);
  for (; t <= fimDaSimulacao; t += R.PASSO_MS) {
    tique(estado, personagem, t);
    if (estado.hp <= 0) {
      morreu = true;
      break;
    }
  }
  hunt.modo = modo;
  if (!morreu && ate > fimDaSimulacao) {
    const extra = projetar(estado, fora, (ate - fimDaSimulacao) / (fimDaSimulacao - desde));
    somarSessao(fora, extra);
    t = ate;
  }
  const report = relatorio(estado, fora, Math.min(t, ate));
  somarSessao(principal, fora);
  hunt.sessao = principal;
  hunt.ultimoTique = agora;
  hunt.eventos = [];
  return { report, morreu };
}


/**
 * `send({t:'startHunt', huntId})` — `huntId` normalmente é uma das 48 hunts
 * reais do `catalog.hunts`, mas também aceita um mapa feito no `/editor`
 * (`assets_raw/gamedata/hunts/<id>-map.json` sem entrada nenhuma no
 * catálogo — só o arquivo). Um mapa assim guarda os próprios `posicoes`
 * (spawn de monstro) dentro dele mesmo, porque não tem catálogo pra ler.
 */
/** O boss nasce a algumas casas da entrada (`partida`), para o centro da sala. */
function posicaoDoBoss(boss, grade) {
  const key = boss.creatures?.[0]?.key ?? boss.id;
  // O ponto REAL do catálogo: bateu com o original nas 72 salas capturadas
  // (Zoros, 2026-09-24). O resto é só para um boss sem `posicoes`.
  if (boss.posicoes?.length) return boss.posicoes.map((p) => ({ key: p.key ?? key, x: p.x, y: p.y }));
  const px = boss.partida?.x ?? 1;
  const py = boss.partida?.y ?? 1;
  const cx = Math.round((grade.minX + grade.maxX) / 2);
  const cy = Math.round((grade.minY + grade.maxY) / 2);
  const d = Math.hypot(cx - px, cy - py);
  // Entrada já no meio da sala (brain-head, ghulosh): "rumo ao centro" não tem
  // rumo, e o boss nascia na casa do jogador — e saía da hunt por isso.
  const [dx, dy] = d >= 2 ? [(cx - px) / d, (cy - py) / d] : [0, -1];
  const alvo = casaAndavelMaisProxima(grade, Math.round(px + dx * 5), Math.round(py + dy * 5));
  return [{ key, x: alvo.x, y: alvo.y }];
}

/**
 * `send({t:'training', action:'start', mode:'online'})` — o pátio: a hunt
 * 'treino' na sala real do treino online, com os bonecos como alvos que não morrem,
 * não andam e não batem. O personagem começa onde o original põe: entre os dois.
 */
export function entrarNoPatio(estado) {
  if (estado.hunt) return { ok: false, erro: 'Você já está numa caçada.' };
  const grade = gradeDaHunt({ id: 'treino' });
  const bonecos = Treinos.bonecos();
  const monstros = bonecos.map((b, i) => ({
    uid: 800000 + i, key: null, name: b.nome ?? 'Target Dummy', look: b.look ?? 0, x: b.x, y: b.y, dir: 2,
    hp: 1_000_000, maxHp: 1_000_000, armor: 0, exp: 0, loot: [], dummy: true,
  }));
  const inicio = casaAndavelMaisProxima(grade, Treinos.PARTIDA_DO_PATIO.x, Treinos.PARTIDA_DO_PATIO.y);
  const settings = estado.settings ?? {};
  estado.hunt = {
    huntId: 'treino', modo: 'auto', z: grade.z, pos: { x: inicio.x, y: inicio.y, dir: 1 },
    monstros, alvo: monstros[0].uid, strategy: 'nearest', distancia: Math.max(0, Math.min(6, Number(settings.distance) || 0)),
    rumo: null, rumoValidoAte: 0, proximoPassoEm: 0, proximoGolpeEm: 0, eventos: [], mapaEnviado: false,
    clock: 0, ultimoTique: Date.now(), cooldowns: {}, assistencia: true, autoBarra: true,
    levaAlvo: 0, lureVolta: 0, leva: 0, lurando: false, respawns: [], isBoss: false, bossId: null,
    startedAt: Date.now(), sessao: novaSessao(estado, 'Pátio de treino', 'auto'), treinoAntes: Treino.paraCliente(estado),
    viagem: { hunt: 'Pátio de treino', motivo: 'partida' },
  };
  return { ok: true };
}

export function entrar(estado, { huntId, mode, strategy }) {
  const boss = CATALOGO.bosses.find((b) => b.id === huntId) ?? null;
  const hunt = acharHunt(huntId) ?? boss;
  const mapaCustom = hunt ? null : mapaRealCapturado(huntId);
  if (!hunt && !mapaCustom) return { ok: false, erro: 'Esta hunt não existe.' };
  // Hunts Vip / Instance / Divine: premium, o acesso e o level (ver `premium.mjs`).
  const tranca = Premium.trancaDaHunt(hunt);
  if (tranca) {
    const pode = Premium.podeEntrar(estado, hunt);
    if (!pode.ok) return pode;
  }
  if (hunt && !boss && !tranca && !mapaRealCapturado(hunt.id) && !temTerrenoReal(hunt)) {
    return { ok: false, erro: 'Esta hunt ainda não tem terreno capturado.' };
  }
  if (boss) {
    // Level e a recarga real de cada boss (`cooldownHours`, `bossCooldownsAte`).
    if ((estado.level ?? 0) < (boss.level ?? 0)) return { ok: false, erro: `Precisa de level ${boss.level}.` };
    // Boss de task: abre com a task feita e sai uma vez por personagem (`bosses.mjs`).
    const recusa = Bosses.recusaDaTask(estado, boss.id);
    if (recusa) return { ok: false, erro: recusa };
    const volta = Bau.garantir(estado).bossCooldownsAte[boss.id] ?? 0;
    if (volta > Date.now()) {
      const h = Math.ceil((volta - Date.now()) / 3_600_000);
      return { ok: false, erro: `${boss.name} ainda não voltou: faltam ~${h}h.` };
    }
  }

  const grade = gradeDaHunt(hunt ?? { id: huntId });
  const posicoes = boss ? posicaoDoBoss(boss, grade) : hunt?.posicoes?.length ? pontosNoMapa(hunt, grade.mapa?.floors ? grade.mapa : null) : SPAWNS_CAPTURADOS[huntId] ?? grade.posicoes ?? mapaCustom?.posicoes ?? [];
  /*
   * ---- Quantos bichos: `density` por ponto de spawn, como no original ----
   *
   * "a quantidade de mobs tem que ser igual do oficial — na dream court a
   * oficial tem muito mais". O catálogo dá um ponto por bicho (`spawnPorAndar`
   * soma o mesmo número que `posicoes` no andar) e a hunt tem `density` (1 ou
   * 2). No original, cada ponto vira `density` bichos: no andar 7 da Winter
   * Dream Court são 4 pontos de Thanatursus, e o Zoros viu exatamente 8; o
   * andar chegou a 93 bichos ao mesmo tempo, onde aqui havia 46. E o bicho não
   * nasce em cima do ponto: dos 106 vistos, 30 no ponto exato e 63 a até 3
   * casas dele. O extra nasce na casa livre mais perto do ponto (até
   * `RAIO_DO_SPAWN`), e renasce ali.
   *
   * Antes, ponto repetido virava um só e ponto na água só ia para a margem a
   * até 3 casas — um andar perdia bichos que o original tem. Agora os dois vão
   * para a casa livre mais perto. Sala de boss e as salas geradas (Vip) já
   * contam do jeito delas: densidade 1 aqui.
   */
  const deCatalogo = !boss && !tranca && (hunt?.posicoes?.length || SPAWNS_CAPTURADOS[huntId]);
  const densidade = deCatalogo ? Math.max(1, Math.round(hunt?.density ?? 1)) : 1;
  /*
   * Cada bicho no ANDAR dele (`p.z`). Antes todos caíam no andar da entrada
   * — o que estava numa casa andável dele ficava, com a valquíria do andar 3
   * aparecendo no meio das amazonas do 7. Andar por onde a rota não passa
   * fica de fora: no original ninguém chega lá.
   */
  const andarDe = (p) => p.z ?? grade.z;
  const andaresDaRota = new Set([grade.z, ...(grade.percurso ?? []).map((p) => p.z ?? grade.z)]);
  // Uma criatura por casa (por andar).
  const casasDeSpawn = new Set();
  const todos = [];
  for (const p of posicoes) {
    const z = andarDe(p);
    if (!andaresDaRota.has(z)) continue;
    const g = andarDaGrade(grade, z);
    for (let k = 0; k < densidade; k++) {
      const casa = casaLivrePerto(g, p, (c) => casasDeSpawn.has(`${c.x},${c.y},${z}`));
      if (!casa) break;
      casasDeSpawn.add(`${casa.x},${casa.y},${z}`);
      const m = criarMonstro({ ...p, x: casa.x, y: casa.y }, hunt);
      if (m) todos.push({ z, m });
    }
  }

  const mediaX = Math.round(posicoes.reduce((s, p) => s + p.x, 0) / posicoes.length);
  const mediaY = Math.round(posicoes.reduce((s, p) => s + p.y, 0) / posicoes.length);
  // Com percurso, nasce no primeiro waypoint DELE: o `route[0]` original pode
  // cair num pedaço do andar sem ligação com o laço (Feru Way), e aí nenhum
  // waypoint tinha caminho — ele ficava parado no lugar.
  const inicio = boss
    ? casaAndavelMaisProxima(grade, boss.partida?.x ?? 1, boss.partida?.y ?? 1)
    : grade.percurso
      ? grade.percurso[0]
      : grade.inicioReal && grade.andavel.has(`${grade.inicioReal.x},${grade.inicioReal.y}`)
        ? grade.inicioReal
        : casaAndavelMaisProxima(grade, mediaX, mediaY);
  const andarInicial = inicio.z ?? grade.z;
  const monstros = todos.filter(({ z }) => z === andarInicial).map(({ m }) => m);
  const outrosAndares = {};
  for (const { z, m } of todos) if (z !== andarInicial) (outrosAndares[z] ??= []).push(m);
  // O personagem nasce numa casa livre: o bicho que estaria em cima dele sai da hunt.
  for (let i = monstros.length - 1; i >= 0; i--) if (monstros[i].x === inicio.x && monstros[i].y === inicio.y) monstros.splice(i, 1);

  // Lure e assistência começam do que o personagem já tinha configurado fora
  // da hunt (`estado.settings`, ver `Cacadas.definirLure`/`definirAssistencia`)
  // — sem isto toda hunt nova voltaria para "não lurar" mesmo com o dono tendo
  // deixado "Lurar até 5" ligado na tela.
  const settings = estado.settings ?? {};
  const levaAlvo = Math.max(0, Number(settings.lure) || 0);
  if (ESTRATEGIAS.has(strategy)) settings.strategy = strategy;

  estado.hunt = {
    huntId,
    // `mode` do cliente: 'online' é a Caça Online (o jogador anda/mira na mão,
    // via `huntWalk`); qualquer outra coisa ('auto', undefined — abas velhas
    // não mandam) é a Caça Automática de sempre neste jogo idle: o SERVIDOR
    // anda até o alvo sozinho quando não há rumo manual (ver `tique`).
    modo: mode === 'online' ? 'online' : 'auto',
    z: andarInicial,
    pos: { x: inicio.x, y: inicio.y, dir: 2 },
    monstros,
    // Os bichos dos andares onde ele não está (ver `trocarDeAndar`).
    outrosAndares,
    alvo: null,
    // Onde ele está no laço da Caça Automática (ver `percursoDoMapa`). Nasce no
    // waypoint mais perto de onde entrou — que quase sempre é o `route[0]`.
    percurso: grade.percurso ? { passo: waypointMaisPerto(grade.percurso, inicio, 0, grade.percurso.length, andarInicial) } : null,
    // "Alvo" e "Distância" da barra (ver `definirEstrategia`/`definirDistancia`).
    strategy: ESTRATEGIAS.has(settings.strategy) ? settings.strategy : 'nearest',
    distancia: Math.max(0, Math.min(6, Number(settings.distance) || 0)),
    rumo: null,
    rumoValidoAte: 0,
    proximoPassoEm: 0,
    proximoGolpeEm: 0,
    eventos: [],
    mapaEnviado: false,
    // Relógio da caçada (ver `packages/shared/src/prazos.mjs::faltaDoCooldown`)
    // e os cooldowns de cada slot da barra de ações — por magia/runa/poção usada.
    clock: 0,
    ultimoTique: Date.now(),
    cooldowns: {},
    // "Assistência" (ataque automático) e "barra automática" (magia/runa/poção
    // sozinha): sempre ligadas na Caça Automática; na Caça Online, o que a tela
    // já tinha guardado (ver `huntAssist`/`ajustesDaBarra` no client).
    assistencia: settings.assistencia !== false,
    autoBarra: settings.autoBarra ?? settings.assistencia !== false,
    // Lure: junta `levaAlvo` bichos perseguindo antes de brigar (ver `tique`).
    levaAlvo,
    lureVolta: Math.max(0, Number(settings.lureVolta) || 0),
    leva: 0,
    lurando: levaAlvo > 0,
    respawns: [],
    isBoss: !!boss,
    bossId: boss?.id ?? null,
    // "Você tem 25 minutos lá dentro, nos dois modos" (no relógio da caçada).
    fimDaSala: boss ? Bosses.TEMPO_NA_SALA_MS : null,
    tranca,
    startedAt: Date.now(),
    sessao: novaSessao(estado, hunt?.name ?? huntId, mode === 'online' ? 'online' : 'auto'),
    // A cortina "Traçando a rota" (`mostrarViagem`, no client) sai no primeiro
    // `state` da hunt nova — a sessão manda uma vez e apaga.
    viagem: { hunt: hunt?.name ?? huntId, motivo: 'partida' },
  };
  // "A espera começa quando você ENTRA — mesmo que ele não caia."
  if (boss) Bosses.marcarEntrada(estado, boss.id);
  return { ok: true };
}

/** Os três valores do seletor "Alvo" do client (`jogar.html`, `#strategy`). */
const ESTRATEGIAS = new Set(['nearest', 'lowest', 'highest']);

/** `send({t:'strategy', value})` — grava a preferência e, numa hunt aberta, troca o alvo na hora. */
export function definirEstrategia(estado, { value }) {
  if (!ESTRATEGIAS.has(value)) return { ok: false, erro: 'Estratégia inválida.' };
  (estado.settings ??= {}).strategy = value;
  if (estado.hunt) {
    estado.hunt.strategy = value;
    estado.hunt.alvo = null; // o alvo clicado à mão sai; a regra nova escolhe
  }
  return { ok: true };
}

/** `send({t:'distance', value})` — 0 é corpo a corpo; 1-6 sqm é a distância que ele mantém do alvo. */
export function definirDistancia(estado, { value }) {
  const sqm = Math.max(0, Math.min(6, Number(value) || 0));
  (estado.settings ??= {}).distance = sqm;
  if (estado.hunt) estado.hunt.distancia = sqm;
  return { ok: true };
}

/** `send({t:'lure', value})`/`{value:null, volta}` — grava a preferência e, se a hunt já estiver aberta, aplica na hora. */
export function definirLure(estado, { value, volta }) {
  const settings = (estado.settings ??= {});
  if (value != null) settings.lure = Math.max(0, Number(value) || 0);
  if (volta != null) settings.lureVolta = Math.max(0, Number(volta) || 0);
  if (estado.hunt) {
    if (value != null) {
      estado.hunt.levaAlvo = settings.lure;
      if (settings.lure > 0 && (estado.hunt.leva ?? 0) < settings.lure) estado.hunt.lurando = true;
      if (!settings.lure) estado.hunt.lurando = false;
    }
    if (volta != null) estado.hunt.lureVolta = settings.lureVolta;
  }
  return { ok: true };
}

/** `send({t:'huntAssist', tipo:'ataque'|'barra', on})`. */
export function definirAssistencia(estado, { tipo, on }) {
  const settings = (estado.settings ??= {});
  const chave = tipo === 'barra' ? 'autoBarra' : 'assistencia';
  settings[chave] = !!on;
  if (estado.hunt) estado.hunt[chave] = !!on;
  return { ok: true };
}

/**
 * Dispara UM slot fora do automático — clique ou tecla (`{t:'huntAction',
 * slot}`). Mesma função que o loop automático usa (`autoDisparo`, em
 * `tique`), só que sem checar `enabled`/condições de novo: um clique manual
 * já É a decisão do jogador.
 */
export function disparoManual(estado, personagem, slot) {
  const hunt = estado.hunt;
  if (!hunt) return { ok: false, erro: 'Você não está numa hunt.' };
  const alvo = alvoAtual(hunt);
  const resultado = Acoes.disparar(estado, hunt, personagem, slot, alvo);
  if (!resultado.ok) return resultado;
  processarMortes(estado, personagem, resultado.eventos);
  return resultado;
}

/** Entra na caçada de outro membro da party: os MESMOS bichos, posição própria. */
export function entrarNaSala(estado, sala) {
  const dados = huntOuMapaCustom(sala.huntId);
  const tranca = Premium.trancaDaHunt(dados);
  if (tranca) {
    const pode = Premium.podeEntrar(estado, dados);
    if (!pode.ok) return pode;
  }
  const grade = andarDaGrade(gradeDaHunt(dados), sala.z);
  const ocupadas = new Set(sala.monstros.map((m) => `${m.x},${m.y}`));
  let inicio = null;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, 1], [0, -1], [-1, 1], [1, 1], [-1, -1], [1, -1], [-2, 0], [2, 0], [0, 2], [0, -2]]) {
    const c = { x: sala.pos.x + dx, y: sala.pos.y + dy };
    if (grade.andavel.has(`${c.x},${c.y}`) && !ocupadas.has(`${c.x},${c.y}`)) {
      inicio = c;
      break;
    }
  }
  inicio ??= casaAndavelMaisProxima(grade, sala.pos.x, sala.pos.y);
  const settings = estado.settings ?? {};
  estado.hunt = {
    huntId: sala.huntId, modo: 'auto', z: sala.z, pos: { x: inicio.x, y: inicio.y, dir: 2 },
    monstros: sala.monstros, respawns: (sala.respawns ??= []), alvo: null,
    strategy: ESTRATEGIAS.has(settings.strategy) ? settings.strategy : 'nearest',
    distancia: Math.max(0, Math.min(6, Number(settings.distance) || 0)),
    rumo: null, rumoValidoAte: 0, proximoPassoEm: 0, proximoGolpeEm: 0, eventos: [], mapaEnviado: false,
    clock: sala.clock ?? 0, ultimoTique: Date.now(), cooldowns: {},
    assistencia: settings.assistencia !== false, autoBarra: settings.autoBarra ?? settings.assistencia !== false,
    levaAlvo: 0, lureVolta: 0, leva: 0, lurando: false, isBoss: false, bossId: null, tranca,
    startedAt: Date.now(), sessao: novaSessao(estado, dados.name ?? sala.huntId, 'auto'),
    viagem: { hunt: dados.name ?? sala.huntId, motivo: 'partida' },
  };
  ligarAoDono(estado.hunt, sala);
  return { ok: true };
}

/** 0..1 do caminho até o próximo level (a barra de exp do card da party). */
export function progressoDoLevel(estado) {
  const lv = estado.level ?? 1;
  const de = R.expForLevel(lv);
  const ate = R.expForLevel(lv + 1);
  return Math.max(0, Math.min(1, ((estado.xp ?? 0) - de) / Math.max(1, ate - de)));
}

/** `send({t:'stopHunt'})` */
export function sair(estado) {
  estado.hunt = null;
  return { ok: true };
}

/** `send({t:'huntTarget', uid})` — `uid:null` cancela o alvo. */
export function definirAlvo(estado, { uid }) {
  if (!estado.hunt) return { ok: false, erro: 'Você não está numa hunt.' };
  // No duelo da Arena x1, mirar o adversário (`aliado:<nome>`); qualquer outra mira tira a dele.
  if (Arena.mirar(estado, uid)) return { ok: true };
  if (uid != null && !estado.hunt.monstros.some((m) => m.uid === uid)) {
    return { ok: false, erro: 'Esse bicho não existe mais.' };
  }
  estado.hunt.alvo = uid;
  return { ok: true };
}

/**
 * Percorre `estado.actions` em ordem de slot e dispara quem estiver ligado,
 * fora de cooldown e com as condições batendo (`Acoes.condicoesDoSlotBatem`).
 * Só os slots de ATAQUE ficam de fora enquanto "lurando" — os de sustento
 * (poção/cura) continuam podendo salvar o personagem no meio da juntada.
 */
function autoDisparo(estado, hunt, personagem) {
  const eventos = [];
  const alvo = alvoAtual(hunt);
  const acoes = estado.actions ?? [];
  for (let slot = 0; slot < acoes.length; slot++) {
    if (estado.hp <= 0) break;
    const action = acoes[slot];
    if (!action?.id || action.enabled === false) continue;
    if (hunt.lurando && Acoes.PAPEL_DO_SLOT[slot] === 'attack') continue;
    if (!Acoes.condicoesDoSlotBatem(action, estado, alvo)) continue;
    const resultado = Acoes.disparar(estado, hunt, personagem, slot, alvo);
    if (resultado.ok) eventos.push(...resultado.eventos);
  }
  processarMortes(estado, personagem, eventos);
  return eventos;
}

/**
 * Roda o passo (movimento) e o golpe (combate) da hunt — chamado a cada
 * tique de rede (100ms), igual ao `processarMovimento` da cidade.
 */
/** A casa vizinha andável e livre que mais afasta do alvo (e dos outros bichos). */
function passoDeRecuo(grade, hunt, alvo) {
  let melhor = null;
  let melhorNota = distancia(hunt.pos, alvo);
  for (const [dx, dy] of VIZINHANCA_8) {
    const viz = { x: hunt.pos.x + dx, y: hunt.pos.y + dy };
    if (!grade.andavel.has(`${viz.x},${viz.y}`)) continue;
    // Diagonal só se nenhum passo reto já afasta (ver `VIZINHANCA_4`).
    if (dx && dy && melhor && (melhor.x === hunt.pos.x || melhor.y === hunt.pos.y)) continue;
    if (hunt.monstros.some((m) => m.hp > 0 && m.x === viz.x && m.y === viz.y)) continue;
    const nota = distancia(viz, alvo) + 0.1 * Math.min(...hunt.monstros.filter((m) => m.hp > 0).map((m) => distancia(viz, m)));
    if (nota > melhorNota) {
      melhorNota = nota;
      melhor = viz;
    }
  }
  return melhor;
}

/*
 * Regeneração natural — a MESMA conta que a ficha do client mostra
 * (`sheet.mjs`: vida `maxHp*0.004*regen.hp`/s, mana `maxMana*0.006*regen.mana`/s,
 * `regen` = 1 sem promoção). Sem ela o personagem só perdia vida: qualquer
 * caçada longa (e toda caçada offline) acabava em morte. O resto fracionário
 * fica guardado para não sumir nos tiques de 100ms.
 */
export function regenerar(estado, ms) {
  if (!(ms > 0) || (estado.hp ?? 0) <= 0) return;
  const s = ms / 1000;
  const r = (estado.regenResto ??= { hp: 0, mana: 0 });
  const ficha = Ficha.combate(estado);
  const doEquipamento = ficha.regenFlat;
  // "Regeneração de vida/mana" da árvore: % a mais sobre a regeneração base.
  const daArvore = ficha.regenDaArvore ?? { hp: 0, mana: 0 };
  // A promoção acelera a base (Elite Knight: vida x1,5 — `Promocao.fatorDeRegeneracao`).
  const promo = Promocao.fatorDeRegeneracao(estado);
  r.hp += (estado.maxHp ?? 0) * 0.004 * s * promo.hp * (1 + daArvore.hp) + (doEquipamento.hp ?? 0) * s;
  r.mana += (estado.maxMana ?? 0) * 0.006 * s * promo.mana * (1 + daArvore.mana) + (doEquipamento.mana ?? 0) * s;
  const hp = Math.floor(r.hp);
  const mana = Math.floor(r.mana);
  r.hp -= hp;
  r.mana -= mana;
  estado.hp = Math.min(estado.maxHp ?? estado.hp, (estado.hp ?? 0) + hp);
  estado.mana = Math.min(estado.maxMana ?? estado.mana, (estado.mana ?? 0) + mana);
}

const ELEMENTO_DA_COR = Object.fromEntries(Object.entries(Acoes.COR_DO_ELEMENTO).map(([el, cor]) => [cor, el]));

/** Dano causado e recebido no Analisador (`damageDealt`, `porElemento`), a partir dos eventos do tique. */
function anotarDano(sessao, eventos) {
  if (!sessao) return;
  for (const e of eventos) {
    if (e.t !== 'dmg' || !(e.v > 0)) continue;
    const el = ELEMENTO_DA_COR[e.color] ?? 'physical';
    const lado = e.foe ? 'causado' : 'recebido';
    sessao.porElemento[lado][el] = (sessao.porElemento[lado][el] ?? 0) + e.v;
    if (e.foe) sessao.damageDealt += e.v;
  }
}

/**
 * A auto-venda da bolsa: a cada `Bolsa.VENDA_A_CADA_S` de caçada (o relógio
 * da hunt, que a caçada offline também adianta), se `settings.autoSellPouch`
 * não estiver desligado. O que vendeu vai para "Vendido" e soma no
 * `lootValue` da sessão; o `noSell` fica.
 */
function autoVenda(estado, hunt) {
  hunt.proximaVenda ??= (hunt.clock ?? 0) + Bolsa.esperaDaVenda(estado) * 1000;
  if ((hunt.clock ?? 0) < hunt.proximaVenda) return;
  hunt.proximaVenda = (hunt.clock ?? 0) + Bolsa.esperaDaVenda(estado) * 1000;
  if (estado.settings?.autoSellPouch === false) return;
  const { gold, itens } = Bolsa.venderBolsa(estado);
  Ficha.totais(estado).gold += gold;
  const sessao = hunt.sessao;
  if (!sessao || !gold) return;
  sessao.lootValue += gold;
  for (const [id, n] of Object.entries(itens)) sessao.itens.vendido[id] = (sessao.itens.vendido[id] ?? 0) + n;
}

/** Segundos até a próxima auto-venda (o relógio da bolsa); `null` fora da caçada. */
export function faltaParaVender(estado) {
  const hunt = estado.hunt;
  if (!hunt || estado.settings?.autoSellPouch === false) return null;
  return Math.max(0, Math.ceil(((hunt.proximaVenda ?? 0) - (hunt.clock ?? 0)) / 1000));
}

/** `send({t:'resetAnalyzer'})` — zera o Analisador (a sessão da caçada) sem sair dela. */
export function zerarAnalisador(estado) {
  const hunt = estado.hunt;
  if (!hunt) return { ok: false, erro: 'Você não está numa hunt.' };
  hunt.sessao = novaSessao(estado, hunt.sessao?.hunts?.[0] ?? nomeDaHunt(hunt.huntId), hunt.modo);
  hunt.startedAt = Date.now();
  return { ok: true };
}

export function tique(estado, personagem, agora = Date.now()) {
  const hunt = estado.hunt;
  if (!hunt) return [];
  // Boss derrotado: depois da faixa de vitória, volta para a cidade.
  if (hunt.fimEm && (hunt.clock ?? 0) >= hunt.fimEm) {
    estado.hunt = null;
    return [];
  }
  // Sala de boss: os 25 minutos acabaram, volta para a cidade.
  if (hunt.fimDaSala && (hunt.clock ?? 0) >= hunt.fimDaSala) {
    estado.hunt = null;
    estado.avisoDaHunt = 'Acabaram os 25 minutos na sala do boss.';
    return [];
  }
  // Hunt premium: acabou o premium (ou o acesso), volta para a cidade.
  if (hunt.tranca && !Premium.podeFicar(estado, hunt.tranca, agora)) {
    estado.hunt = null;
    estado.avisoDaHunt = Premium.motivoDaSaida(hunt.tranca);
    return [];
  }
  const passou = agora - (hunt.ultimoTique ?? agora);
  hunt.clock = (hunt.clock ?? 0) + passou;
  hunt.ultimoTique = agora;
  Ficha.totais(estado).time += passou / 1000;
  // O pátio "rende como caçar — e custa o mesmo tempo": gasta stamina, mas
  // não boost (não há exp) nem devolve a stamina de treino.
  Stamina.gastar(estado, passou);
  // No pátio o personagem gasta em magia a mana que regenera (ver `Treino.manaDoPatioPorSegundo`).
  if (hunt.huntId === 'treino') Treino.gastarMana(estado, (Treino.manaDoPatioPorSegundo(estado) * passou) / 1000);
  if (hunt.huntId !== 'treino') {
    Boosts.consumir(estado, passou);
    BuffPower.consumir(estado, passou);
    Prey.consumir(estado, passou); // "o relógio só corre dentro da hunt"
    Imbuements.consumir(estado, passou); // idem: 50.301 s caçando = 50.340 s a menos no Strike do Zoros
    Treinos.encherTanque(estado, passou); // "caçar devolve" a stamina de treino
  }
  regenerar(estado, passou);
  // Numa caçada em grupo, só o DONO da sala move os bichos e faz renascer —
  // senão eles andariam uma vez por membro a cada tique.
  const donoDaSala = !hunt.anfitriao;
  if (donoDaSala) {
    atualizarLure(hunt, estado);
    renascer(hunt);
  } else {
    hunt.lurando = false;
  }

  /*
   * ---- Caça Automática anda sozinha ----
   *
   * "entrei na caça automática" — e no automático é o SERVIDOR que decide o
   * passo, não o jogador: sem isto o personagem nasce e fica parado pra
   * sempre esperando um `huntWalk` que a Caça Automática nunca manda (só a
   * Caça Online manda). Rumo manual (`hunt.rumo`, de `huntWalk`) sempre
   * ganha quando presente e válido — útil mesmo numa hunt automática, se um
   * dia isto ligar movimento manual dentro dela; sem ele, anda reto na
   * direção do alvo mais perto vivo.
   */
  const gradeDaCacada = gradeDaHunt(huntOuMapaCustom(hunt.huntId));
  // Convidado da party: o dono mudou de andar, ele vai junto (ver `trocarDeAndar`).
  const sala = salaDe(hunt);
  if (sala !== hunt && sala.z != null && sala.z !== hunt.z) {
    const lado = casaAndavelMaisProxima(andarDaGrade(gradeDaCacada, sala.z), sala.pos.x, sala.pos.y);
    hunt.z = sala.z;
    hunt.pos.x = lado.x;
    hunt.pos.y = lado.y;
    hunt.alvo = null;
    hunt.alvoTravado = null;
  }
  let grade = andarDaGrade(gradeDaCacada, hunt.z);
  // Caçada que começou antes de existir o percurso: pega o laço de onde está.
  if (hunt.percurso === undefined) hunt.percurso = grade.percurso ? { passo: waypointMaisPerto(grade.percurso, hunt.pos, 0, grade.percurso.length, hunt.z) } : null;
  // Caçada gravada com a rota antiga (só um andar, outro tamanho): retoma pelo waypoint mais perto.
  if (hunt.percurso && grade.percurso && !(hunt.percurso.passo < grade.percurso.length)) {
    hunt.percurso.passo = waypointMaisPerto(grade.percurso, hunt.pos, 0, grade.percurso.length, hunt.z);
  }

  if (R.jaPode(agora, hunt.proximoPassoEm)) {
    let destino = null;
    if (hunt.rumo && agora <= (hunt.rumoValidoAte ?? 0)) {
      // Caça Online: passo manual (`huntWalk`), sem ajuda de caminho — é o jogador apontando.
      const { dx, dy } = hunt.rumo;
      if (dy < 0) hunt.pos.dir = 0;
      else if (dy > 0) hunt.pos.dir = 2;
      else if (dx > 0) hunt.pos.dir = 1;
      else if (dx < 0) hunt.pos.dir = 3;
      const tentativa = { x: hunt.pos.x + dx, y: hunt.pos.y + dy };
      // Não pisa em bicho vivo: duas criaturas na mesma casa se cortam no
      // desenho (o client desenha uma por cima da outra, e o quadrado do alvo junto).
      const ocupada = hunt.monstros.some((b) => b.hp > 0 && b.x === tentativa.x && b.y === tentativa.y);
      // Rampa, degrau ou buraco: pisou, mudou de andar (ver "Os andares da hunt").
      const outroAndar = !ocupada && grade.mapa?.floors && destinoDaMudanca(grade.mapa, hunt.z, tentativa.x, tentativa.y);
      if (outroAndar) {
        const chegada = casaAndavelMaisProxima(andarDaGrade(gradeDaCacada, outroAndar.z), outroAndar.x, outroAndar.y);
        trocarDeAndar(hunt, { ...chegada, z: outroAndar.z });
      } else if (grade.andavel.has(`${tentativa.x},${tentativa.y}`) && !ocupada) destino = tentativa;
    } else if (hunt.guia && distancia(hunt.pos, hunt.guia.pos) > hunt.guia.coleira) {
      // Party: longe demais de quem segue ("Seguir ... a N sqm") — volta para perto.
      const casasDeBicho = new Set(hunt.monstros.filter((b) => b.hp > 0).map((b) => `${b.x},${b.y}`));
      destino = proximoPassoAte(grade, hunt.pos, hunt.guia.pos, (c) => casasDeBicho.has(`${c.x},${c.y}`), casasDeBicho);
      if (destino) {
        const dx = Math.sign(destino.x - hunt.pos.x);
        const dy = Math.sign(destino.y - hunt.pos.y);
        hunt.pos.dir = dy < 0 ? 0 : dy > 0 ? 2 : dx > 0 ? 1 : 3;
      }
    } else if (hunt.modo !== 'online') {
      // Caça Automática: BFS até o alvo — anda pela curva real da caverna, não trava em beco sem saída.
      // Lurando, o "alvo" do passo é o próximo bicho fora de alcance (junta a
      // leva); parado de lurar, é o alvo de combate de sempre.
      // Lurando numa hunt com percurso, ele SEGUE A ROTA e os bichos que o
      // enxergam vêm atrás — "o personagem segue a rota juntando criaturas
      // atrás dele" (o balão do Lurar até, no client do original). Sem alvo,
      // o passo cai no laço, logo abaixo.
      const segueARota = hunt.lurando && hunt.percurso && grade.percurso;
      const alvo = segueARota ? null : hunt.lurando ? proximoMonstroForaDeAlcance(hunt) : alvoAtual(hunt);
      // Wand/rod e arma de distância param no alcance delas, não colados no
      // bicho (ver `categoriaDaArma`) — lurando, o alvo já está sempre bem
      // além disso, então o comportamento não muda.
      // "Distância" da barra: a quantos sqm ele PARA do alvo — nunca além do
      // que a arma alcança (o client avisa "máx N" na opção). Corpo a corpo
      // (0) cola no bicho; a distância > 0 ele também RECUA quando o bicho
      // chega perto demais, como o kite do original.
      const alcance = alcanceDaArma(armaDoPersonagem(estado), estado);
      const querDistancia = hunt.lurando ? alcance : Math.max(1, Math.min(hunt.distancia || 1, alcance));
      const d = alvo ? distancia(hunt.pos, alvo) : 0;
      // Saiu do laço para brigar: na volta, retoma pelo waypoint mais perto (`passoNoPercurso`).
      if (alvo && hunt.percurso) hunt.percurso.desviou = true;
      // Quanto tempo ele já corre atrás DESTE bicho sem chegar (ver `alvoAtual`).
      if (!alvo || d <= querDistancia || hunt.perseguicao?.uid !== alvo.uid) {
        hunt.perseguicao = alvo && d > querDistancia ? { uid: alvo.uid, desde: hunt.clock ?? 0 } : null;
      }
      const cansou = hunt.percurso && hunt.perseguicao && (hunt.clock ?? 0) - hunt.perseguicao.desde > PERSEGUICAO_MAXIMA_MS;
      if (alvo && d > querDistancia && cansou) {
        alvo.semCaminhoAte = (hunt.clock ?? 0) + 10_000;
        hunt.alvoTravado = null;
        hunt.perseguicao = null;
        const casasDeBicho = new Set(hunt.monstros.filter((b) => b.hp > 0).map((b) => `${b.x},${b.y}`));
        if (grade.percurso) destino = passoNoPercurso(estado, hunt, grade, casasDeBicho);
      } else if (alvo && d > querDistancia && esperaOAlvoChegar(hunt, alvo)) {
        destino = null;
      } else if (alvo && d > querDistancia) {
        const casasDeBicho = new Set(hunt.monstros.filter((b) => b.hp > 0).map((b) => `${b.x},${b.y}`));
        destino = proximoPassoAte(grade, hunt.pos, alvo, (c) => casasDeBicho.has(`${c.x},${c.y}`), casasDeBicho);
        const espera = !hunt.lurando && voltariaAtras(hunt, alvo, destino);
        if (espera) destino = null;
        // Travado indo puxar um bicho (sem passo livre): tenta outro por 10s.
        // Com percurso vale também fora do lure — um bicho à vista do outro
        // lado de uma parede prendia o personagem parado para sempre (medido:
        // 48s num White Lion a 8 casas, em Werelions -1). Ele desiste do bicho
        // e segue o laço, que cedo ou tarde passa pelo lado de lá.
        if (!destino && !espera && (hunt.lurando || hunt.percurso)) {
          alvo.semCaminhoAte = (hunt.clock ?? 0) + 10_000;
          if (hunt.alvo === alvo.uid) hunt.alvo = null;
          if (!hunt.lurando && grade.percurso) destino = passoNoPercurso(estado, hunt, grade, casasDeBicho);
        }
      } else if (alvo && !hunt.lurando && hunt.distancia > 0 && d < querDistancia) {
        destino = passoDeRecuo(grade, hunt, alvo);
      } else if (!alvo && hunt.percurso && grade.percurso) {
        // Ninguém à vista: segue o laço da hunt (ver `percursoDoMapa`).
        const casasDeBicho = new Set(hunt.monstros.filter((b) => b.hp > 0).map((b) => `${b.x},${b.y}`));
        destino = passoNoPercurso(estado, hunt, grade, casasDeBicho);
        /*
         * Lurando num corredor, a leva que vem atrás fecha a passagem: o passo
         * da rota contorna o bicho, o bicho acompanha, e os dois espelhavam
         * (Winter Dream Court, andar 5: 32,50 ↔ 33,50 por 30 s). O passo que
         * desfaz o anterior encerra a juntada — ele briga com o que já tem, e
         * volta a lurar depois (ver `atualizarLure`).
         */
        // Voltar pelo mesmo caminho num beco sem saída é normal: só conta com
        // um bicho da leva colado nele (a até 2 casas).
        const antes = hunt.casaAnterior;
        const colado = hunt.monstros.some((b) => b.hp > 0 && b.perseguindo && distancia(b, hunt.pos) <= 2);
        if (hunt.lurando && colado && destino && antes && destino.x === antes.x && destino.y === antes.y) {
          hunt.lurando = false;
          hunt.casaAnterior = null;
          destino = null;
        }
      }
      if (destino) {
        const dx = Math.sign(destino.x - hunt.pos.x);
        const dy = Math.sign(destino.y - hunt.pos.y);
        hunt.pos.dir = dy < 0 ? 0 : dy > 0 ? 2 : dx > 0 ? 1 : 3;
      }
    }
    if (destino) {
      // De onde ele veio: é o que `voltariaAtras` compara.
      hunt.casaAnterior = { x: hunt.pos.x, y: hunt.pos.y };
      hunt.pos.x = destino.x;
      hunt.pos.y = destino.y;
    }
    hunt.proximoPassoEm = agora + R.PASSO_MS;
  }
  // Subiu ou desceu neste passo: o resto do tique já é no andar novo.
  grade = andarDaGrade(gradeDaCacada, hunt.z);

  if (donoDaSala) moverMonstros(hunt, grade, agora);

  let eventos = [];
  const assiste = hunt.modo !== 'online' || hunt.assistencia !== false;
  if (assiste && R.jaPode(agora, hunt.proximoGolpeEm) && estado.hp > 0) {
    const golpe = round(estado, personagem);
    eventos = golpe.eventos;
    // Só conta o intervalo se de fato bateu: sem alvo ao alcance, o golpe sai
    // assim que chegar nele, não 2s depois.
    // "Velocidade de ataque" (afixo): o intervalo encurta nessa %. "Tempo entre
    // golpes" (árvore) mexe no próprio intervalo: −3% é 3% mais curto.
    if (golpe.bateu) {
      const f = Ficha.combate(estado);
      hunt.proximoGolpeEm = agora + (ATAQUE_MS * Math.max(0.2, 1 + (f.intervaloDeAtaque ?? 0))) / (1 + (f.velocidadeDeAtaque ?? 0) / 100);
    }
  }
  if (estado.hp > 0) eventos.push(...golpesDosMonstros(estado, hunt, personagem));
  // O veneno da Raiz venenosa (druid), um pulso por segundo.
  Arvore.tique(estado, hunt, eventos);
  processarMortes(estado, personagem, eventos);

  const usaBarra = hunt.modo !== 'online' || hunt.autoBarra !== false;
  if (usaBarra && estado.hp > 0) eventos.push(...autoDisparo(estado, hunt, personagem));
  if (hunt.summon) eventos.push(...tiqueDoFamiliar(estado, hunt, personagem, grade, agora));

  anotarDano(hunt.sessao, eventos);
  autoVenda(estado, hunt);

  return eventos;
}

/*
 * ---- O familiar em campo ----
 *
 * Gruda no dono: passou de `perto` casas, reaparece numa casa livre do lado
 * dele. A cada 2s (o golpe da caçada) bate em TODO bicho a até `alcance` casas
 * do alvo do dono, com `Summon.fracao` do golpe dele — "nunca sai caçando
 * sozinho": sem alvo do dono, não bate. Acabou o tempo em campo, some.
 */
function tiqueDoFamiliar(estado, hunt, personagem, grade, agora) {
  const f = hunt.summon;
  const eventos = [];
  if (agora >= f.ate) {
    hunt.summon = null;
    return eventos;
  }
  if (distancia(f, hunt.pos) > f.perto || (f.x === hunt.pos.x && f.y === hunt.pos.y)) {
    const ocupadas = new Set(hunt.monstros.filter((b) => b.hp > 0).map((b) => `${b.x},${b.y}`));
    ocupadas.add(`${hunt.pos.x},${hunt.pos.y}`);
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, 1], [0, -1], [-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const c = { x: hunt.pos.x + dx, y: hunt.pos.y + dy };
      if (grade.andavel.has(`${c.x},${c.y}`) && !ocupadas.has(`${c.x},${c.y}`)) {
        f.x = c.x;
        f.y = c.y;
        break;
      }
    }
  }
  const alvo = alvoAtual(hunt);
  if (!alvo || hunt.lurando || !R.jaPode(agora, f.proximoGolpe)) return eventos;
  f.proximoGolpe = agora + ATAQUE_MS;
  f.dir = alvo.y < f.y ? 0 : alvo.y > f.y ? 2 : alvo.x > f.x ? 1 : 3;
  // "25% do seu golpe": o golpe médio do dono agora (arma, wand ou punho).
  const arma = armaDoPersonagem(estado);
  const ficha = Ficha.combate(estado);
  const doDono = arma?.wand ? (arma.wand.min + arma.wand.max) / 2 : R.golpeDoJogador(arma, ficha.skillValue, estado.level);
  const cor = Acoes.COR_DO_ELEMENTO[f.elemento] ?? '#ff0000';
  const sessao = hunt.sessao;
  for (const bicho of hunt.monstros) {
    if (bicho.hp <= 0 || distancia(bicho, alvo) > f.alcance) continue;
    const dano = Math.max(1, Math.round(doDono * Summon.fracao(estado) * (0.85 + Math.random() * 0.3)));
    bicho.hp -= dano;
    eventos.push({ t: 'fx', id: f.fx, uid: bicho.uid, x: bicho.x, y: bicho.y });
    eventos.push({ t: 'dmg', uid: bicho.uid, x: bicho.x, y: bicho.y, v: dano, foe: true, familiar: true, alvo: bicho.name, color: cor });
    if (sessao) {
      sessao.danoDoFamiliar = (sessao.danoDoFamiliar ?? 0) + dano;
      sessao.acertosDoFamiliar = (sessao.acertosDoFamiliar ?? 0) + 1;
    }
    if (bicho.dummy) bicho.hp = bicho.maxHp;
  }
  processarMortes(estado, personagem, eventos);
  return eventos;
}

/** `send({t:'huntWalk', dx, dy})` — mesmo modelo de rumo do `andar` da cidade. */
export function andar(estado, { dx, dy }) {
  if (!estado.hunt) return;
  if (!dx && !dy) {
    estado.hunt.rumo = null;
    return;
  }
  estado.hunt.rumo = { dx: Math.sign(dx), dy: Math.sign(dy) };
  estado.hunt.rumoValidoAte = Date.now() + 500;
}

/*
 * ---- `send({t:'huntEscada', x, y})` — a escada de mão ----
 *
 * O client manda quando o jogador aperta o botão direito numa escada de mão
 * (`floors[z].escada`) na Caça Online. Como no Tibia, é preciso estar do lado
 * dela (ou em cima); `1` sobe, `2` desce, e ele aparece na mesma casa do outro
 * andar (ou na livre mais perto).
 */
export function usarEscada(estado, { x, y }) {
  const hunt = estado.hunt;
  if (!hunt) return { ok: false, erro: 'Você não está numa hunt.' };
  const base = gradeDaHunt(huntOuMapaCustom(hunt.huntId));
  const mapa = base.mapa;
  const tipo = Number(mapa?.floors?.[hunt.z]?.escada?.[y * mapa.width + x] ?? 0);
  if (tipo !== 1 && tipo !== 2) return { ok: false, erro: 'Não há escada aí.' };
  if (distancia(hunt.pos, { x, y }) > 1) return { ok: false, erro: 'Chegue perto da escada.' };
  const z = tipo === 1 ? hunt.z - 1 : hunt.z + 1;
  if (!mapa.floors?.[z]) return { ok: false, erro: 'A escada não leva a lugar nenhum.' };
  const chegada = casaAndavelMaisProxima(andarDaGrade(base, z), x, y);
  if (!trocarDeAndar(hunt, { ...chegada, z })) return { ok: false, erro: 'Quem muda de andar é quem abriu a caçada.' };
  return { ok: true };
}

/*
 * O `hunt` que vai em `state` — mesmo espírito de `snapshotDaPraca`, em
 * `sessao.mjs`. `map` só viaja UMA vez por hunt (`hunt.mapaEnviado`) ou
 * quando `forcarMapa` pede de volta (`pedirMapa`) — mandar de novo em todo
 * tique de 100ms seria reenviar a grade inteira 10x/s sem necessidade.
 */
/*
 * O `hunt.boss` do original: a cara, a vida e as fichas de elemento. Os
 * elementos são os do bestiário com a resistência limitada a
 * `RESISTENCIA_MAXIMA_DE_BOSS` (20%) — Earl Osam no original: gelo/terra/morte
 * 20 (no bestiário 50/50/100), fogo -10, energia -5.
 */
const ORDEM_DOS_ELEMENTOS = ['physical', 'fire', 'ice', 'earth', 'energy', 'death', 'holy'];
function barraDoBoss(hunt) {
  const b = hunt.monstros.find((m) => m.key === hunt.bossId) ?? hunt.monstros[0];
  if (!b) return null;
  const el = BESTIARY[b.key]?.elements ?? {};
  const elementos = ORDEM_DOS_ELEMENTOS.filter((id) => el[id]).map((id) => ({ id, valor: Math.min(R.RESISTENCIA_MAXIMA_DE_BOSS, el[id]) }));
  return { uid: b.uid, name: b.name, look: b.look, lookItem: b.lookItem ?? 0, colors: b.colors ?? null, hp: b.hp, maxHp: b.maxHp, elementos };
}

export function snapshotDaHunt(estado, forcarMapa = false) {
  const hunt = estado.hunt;
  if (!hunt) return null;
  const hd = huntOuMapaCustom(hunt.huntId);
  const mandarMapa = !hunt.mapaEnviado || forcarMapa;
  if (mandarMapa) hunt.mapaEnviado = true;
  return {
    mapId: hunt.huntId,
    z: hunt.z,
    ...(mandarMapa ? { map: gradeDaHunt(hd).mapa } : {}),
    player: { x: hunt.pos.x, y: hunt.pos.y, dir: hunt.pos.dir, moveMs: R.PASSO_MS },
    monsters: hunt.monstros.map((m) => ({
      uid: m.uid,
      x: m.x,
      y: m.y,
      dir: m.dir,
      look: m.look,
      lookItem: m.lookItem ?? 0,
      colors: m.colors ?? null,
      name: m.name,
      hp: m.hp,
      maxHp: m.maxHp,
      moveMs: m.moveMs ?? passoDoBicho(m),
    })),
    players: [],
    npcs: [],
    objetos: [],
    chao: [],
    // Quem marca a moldura vermelha na tela (ver `map.mjs::targetUid`) — antes
    // nunca viajava, e o alvo nunca aparecia marcado.
    targetUid: alvoAtual(hunt)?.uid ?? null,
    // O familiar em campo (map.mjs desenha com o nível ao lado do nome).
    summon: hunt.summon
      ? { uid: hunt.summon.uid, x: hunt.summon.x, y: hunt.summon.y, dir: hunt.summon.dir, look: hunt.summon.look, name: hunt.summon.name, nivel: hunt.summon.nivel, moveMs: R.PASSO_MS }
      : null,
    // Relógio da caçada e os cooldowns da barra (ver `faltaDoCooldown`).
    clock: hunt.clock ?? 0,
    cooldowns: hunt.cooldowns ?? {},
    manual: hunt.modo === 'online',
    assistencia: hunt.assistencia !== false,
    autoBarra: hunt.autoBarra !== false,
    leva: hunt.leva ?? 0,
    levaAlvo: hunt.levaAlvo ? metaDoLure(hunt).meta : 0,
    // O resto do que o `state.hunt` original manda (capturado ao vivo:
    // huntId, isBoss, strategy, distance, alcance, lurando, levaVolta...) e
    // que a barra lê para os seletores "Alvo", "Distância" e "Lurar até".
    huntId: hunt.huntId,
    isBoss: !!hunt.isBoss,
    // A barra do boss no alto da tela (`barraDoBoss`, hud.mjs) — o formato real.
    boss: hunt.isBoss ? barraDoBoss(hunt) : null,
    strategy: hunt.strategy ?? 'nearest',
    distance: hunt.distancia ?? 0,
    alcance: alcanceDaArma(armaDoPersonagem(estado), estado),
    lurando: !!hunt.lurando,
    // O que a leva está fazendo, como o original manda (`levaEstado`): sem lure, nada.
    levaEstado: hunt.levaAlvo ? (hunt.lurando ? (hunt.leva > 0 ? 'juntando' : 'procurando') : 'lutando') : null,
    levaVolta: hunt.levaAlvo ? metaDoLure(hunt).volta : 0,
    // O Analisador (`main.mjs`) lê `startedAt` e `session` — o formato real.
    startedAt: hunt.startedAt ?? hunt.sessao?.inicio ?? Date.now(),
    session: sessaoParaCliente(hunt.sessao),
    // As magias de suporte ligadas, com o tempo que RESTA (os cards acima da barra).
    buffs: Acoes.buffsAtivos(hunt),
  };
}


