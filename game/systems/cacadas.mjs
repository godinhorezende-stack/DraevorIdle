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
import * as Mecanicas from './mobs/mecanicas.mjs';
import * as Raridade from './mobs/raridade.mjs';
import * as Atributos from './personagem/atributos.mjs';
import { CATALOGO, ITEM_CATALOG } from './dados.mjs';
import * as R from './regras.mjs';
import { VALOR_DA_MOEDA, pesoDoInventario, removerItem } from './inventario.mjs';
import * as Acoes from './acoes.mjs';
import * as Combo from './combo.mjs';
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
import * as Estados from './skills/estados.mjs';
import * as RegrasDeUso from './skills/regras-de-uso.mjs';
import * as Bosses from './bosses.mjs';
import { SPAWNS_CAPTURADOS, spawnsCapturados, mapaRealCapturado, pontosNoMapa, acharHunt, huntOuMapaCustom, nomeDaHunt, temTerrenoReal, gradeDaHunt, spawnsDaHunt, encontrosDaHunt } from './hunt/terreno.mjs';
import { BESTIARY, criarMonstro, trocarDeAndar, renascer, passoDoBicho, moverMonstros, compactarMonstro, completarMonstro, garantirUidAcimaDe } from './hunt/monstros.mjs';
import { destinoDaMudanca, andarDaGrade } from './hunt/andares.mjs';
import { VIZINHANCA_8, proximoPassoAte, casaAndavelMaisProxima, casaLivrePerto, distancia, temCaminho, bfsDistancias } from './hunt/caminho.mjs';
import { novaSessao, sessaoParaCliente, relatorio, somarSessao } from './hunt/relatorio.mjs';
import { salaDe, ligarAoDono } from './hunt/sala.mjs';
import { alvoAtual, esperaOAlvoChegar, voltariaAtras, PERSEGUICAO_MAXIMA_MS } from './hunt/alvo.mjs';
import { passoComProgresso, faltaAte, aindaTravado } from './hunt/progresso.mjs';
import * as Diag from './hunt/diagnostico.mjs';
import { AUSENCIA_MAXIMA_MS } from '../database/caca-offline.mjs';
import { waypointMaisPerto, passoNoPercurso } from './hunt/percurso.mjs';
import { proximoMonstroForaDeAlcance, metaDoLure, atualizarLure } from './hunt/lure.mjs';
import { aliadosPorCasa } from './hunt/aliados.mjs';
import * as Defesa from './personagem/defesa.mjs';
import { processarMortes, armaDoPersonagem, alcanceDaArma, subirDeLevel, ATAQUE_MS, round, golpesDosMonstros, contextoDoDrop } from './hunt/combate.mjs';
import { gerarItem, aceitaAtributos } from './itens/gerar.mjs';
import * as Campanha from './campanha.mjs';
import { resistido, resistenciaEfetivaDe } from './hunt/resistencia.mjs';
import * as Controle from './combate/controle.mjs';
import * as Dot from './combate/dot.mjs';
import * as Instancia from './hunt/instancia.mjs';
import * as Encontros from './encontros/estado.mjs';
import './encontros/tipos-de-boss.mjs'; // registra os encontros de boss (boss, miniboss, boss-secreto)
import './encontros/tipos-de-bau.mjs'; // registra os baús e o altar
import './encontros/tipos-de-onda.mjs'; // registra a sobrevivência e a fenda (ondas)
import './encontros/tipos-de-captura.mjs'; // registra o aprisionado e o invasor
import * as EventosDeEncontro from './encontros/eventos.mjs';

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
const SIMULACAO_MAXIMA_MS = 30 * 60_000;

/**
 * Aplica `fator` vezes o que a sessão `base` rendeu, sem simular (ver acima).
 * `multExp` corrige só a exp: a stamina mudou de faixa desde a parte simulada
 * (39 h com premium x1,5; 14 h ou menos x0,5 — ver `Stamina.fatorDeExp`).
 */
function projetar(estado, base, fator, multExp = 1) {
  const extra = {
    exp: Math.round(base.exp * fator * multExp), kills: Math.round(base.kills * fator),
    gold: Math.round(base.gold * fator), lootValue: Math.round(base.lootValue * fator),
    supplies: Math.round(base.supplies * fator), damageDealt: Math.round((base.damageDealt ?? 0) * fator),
    itens: { loot: {}, vendido: {}, gastos: {}, ignorado: {}, perdido: {} },
  };
  estado.xp = (estado.xp ?? 0) + extra.exp;
  // As mortes projetadas limpam a instância (e as seguintes, em loop na mesma
  // hunt — offline nunca troca de fase: o "Avançar" só vale online).
  projetarNaInstancia(estado, extra.kills);
  estado.gold = (estado.gold ?? 0) + extra.gold; // `gold` da sessão é moeda do loot: vai para o bolso, igual à caçada online (hunt/combate.mjs::matarMonstro)
  subirDeLevel(estado);
  for (const [id, n] of Object.entries(base.itens.loot)) {
    // Sessão gravada antes da correção pode ter o item fantasma ("undefined"): não projeta.
    if (!Number.isFinite(Number(id))) continue;
    const qtd = Math.round(n * fator);
    if (!qtd) continue;
    extra.itens.loot[id] = qtd;
    if (VALOR_DA_MOEDA[id]) continue; // já entrou no `gold`
    // O peso vale na projeção também: o que não cabe fica no chão ("perdido").
    const peso = ITEM_CATALOG[id]?.weight ?? 0;
    const livre = Afixos.capacidade(estado) - pesoDoInventario(estado);
    const cabe = peso > 0 ? Math.max(0, Math.min(qtd, Math.floor(livre / peso))) : qtd;
    /*
     * A peça que aceita atributo sai do gerador de itens, uma a uma — igual à
     * caçada online. Antes a projeção punha a peça CRUA na bolsa: quem caçava
     * 12 h offline só ganhava atributo no loot da primeira meia hora.
     */
    let entrou = 0;
    if (cabe && aceitaAtributos(Number(id))) {
      const origem = contextoDoDrop(estado.hunt);
      for (let k = 0; k < cabe; k++) entrou += Bolsa.porNaBolsa(estado, Number(id), 1, gerarItem({ itemId: Number(id), ...origem }));
    } else if (cabe) entrou = Bolsa.porNaBolsa(estado, Number(id), cabe);
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

/**
 * Se a volta tem caçada offline para simular (5 s ou mais fora) — ou uma
 * ausência já consolidada em segundo plano, cujo relatório ainda tem de ser
 * entregue e somado ao Analisador (ver `avancarAusencia`).
 */
export function temAusenciaParaSimular(estado, agora = Date.now()) {
  const hunt = estado?.hunt;
  const desde = hunt?.offlineDesde;
  if (!desde) return false;
  if (hunt.ausencia) return true;
  return Math.min(agora, desde + AUSENCIA_MAXIMA_MS) - desde >= 5000;
}

/*
 * ---- A ausência em PEDAÇOS: consolidada em segundo plano, fechada no login ----
 *
 * "quero o ranking atualizando direto" — com o progresso offline calculado só
 * na volta, quem caçava de aba fechada não subia no ranking do dia até logar.
 * Agora o servidor avança a ausência de tempos em tempos (`consolidarAusencia`,
 * ver `consolidacao-offline.mjs`), grava o personagem ainda ausente, e o login
 * (`simularAusencia`) só termina o que falta e entrega o relatório inteiro.
 *
 * A conta é a MESMA de antes, só espalhada no tempo:
 *   - os primeiros `SIMULACAO_MAXIMA_MS` a partir da saída são simulados tique a
 *     tique (podem ser em mais de um pedaço — o tique continua de onde parou);
 *   - o que passa disso é projetado no ritmo que esses 30 min mediram
 *     (`ausencia.base`, uma cópia do que a parte simulada rendeu) — linear, então
 *     projetar em pedaços soma o mesmo que projetar de uma vez;
 *   - o teto de `AUSENCIA_MAXIMA_MS` conta da saída de verdade (`ausencia.inicio`);
 *   - morreu na parte simulada: nada mais avança; o login aplica a morte.
 * `hunt.ausencia` guarda o fio entre os pedaços: `principal` (o Analisador de
 * antes de sair), `fora` (o que a ausência rendeu até aqui — o relatório), `base`.
 * Sem pedaço nenhum no meio, o login faz exatamente o que fazia.
 */
function avancarAusencia(estado, personagem, agora, final) {
  const hunt = estado.hunt;
  if (!hunt?.offlineDesde) return null;
  const desde = hunt.offlineDesde;
  if (!hunt.ausencia) {
    const ate0 = Math.min(agora, desde + AUSENCIA_MAXIMA_MS);
    if (ate0 - desde < 5000) {
      if (final) delete hunt.offlineDesde;
      return null;
    }
    const principal = hunt.sessao ?? novaSessao(estado, huntOuMapaCustom(hunt.huntId).name ?? hunt.huntId, hunt.modo, desde);
    hunt.ausencia = {
      inicio: desde, principal, fora: novaSessao(estado, principal.hunts[0], hunt.modo, desde),
      base: null, morreu: false, morreuEm: null, projetadoAte: null,
    };
    hunt.ultimoTique = desde;
    hunt.proximoPassoEm = hunt.proximoGolpeEm = hunt.proximoPassoMonstroEm = 0;
    hunt.rumo = null;
    hunt.destino = null;
  }
  const a = hunt.ausencia;
  const ate = Math.min(agora, a.inicio + AUSENCIA_MAXIMA_MS);
  const fimDaSimulacao = a.inicio + SIMULACAO_MAXIMA_MS;
  let avancou = false;

  // 1. A parte simulada, tique a tique, continuando de onde o pedaço anterior parou.
  if (!a.base && !a.morreu && hunt.offlineDesde <= Math.min(ate, fimDaSimulacao)) {
    hunt.sessao = a.fora;
    // A caçada automática corre sozinha; na online, fora da tela, também — é
    // o que o original faz ("Caçando offline").
    const modo = hunt.modo;
    hunt.modo = 'auto';
    const fim = Math.min(ate, fimDaSimulacao);
    let t = hunt.offlineDesde;
    for (; t <= fim; t += R.PASSO_MS) {
      tique(estado, personagem, t);
      if (estado.hp <= 0) {
        a.morreu = true;
        a.morreuEm = t;
        break;
      }
      // A stamina acabou: a caçada offline para aqui (o tique já a gastou).
      if (Stamina.garantir(estado) <= 0) {
        a.semStamina = true;
        a.parouEm = t;
        break;
      }
    }
    hunt.modo = modo;
    hunt.offlineDesde = a.morreu ? a.morreuEm : a.semStamina ? a.parouEm : t;
    avancou = true;
    // Os 30 min inteiros simulados: o ritmo deles é a base da projeção — e o
    // fator de exp da stamina com que ele foi medido.
    if (!a.morreu && !a.semStamina && fim >= fimDaSimulacao) {
      a.base = JSON.parse(JSON.stringify(a.fora));
      a.fatorBase = Stamina.fatorDeExp(estado);
      a.projetadoAte = fimDaSimulacao;
    }
  }

  /*
   * 2. A projeção, do ponto em que a anterior parou até agora — em TRECHOS
   * entre as faixas da stamina (39 h, 14 h, 0). Cada trecho faz o que o tique
   * faria no mesmo tempo: gasta stamina, soma o tempo caçando e os totais da
   * ficha, consome prey/boosts/imbuements (`passarOTempoOffline`), e a exp segue
   * o fator da faixa em que ele está (relativo ao da parte simulada). A stamina
   * zerou: a caçada offline acaba ali — "se acabar a stamina, desloga".
   * Os trechos não dependem de onde os pedaços da consolidação caem: em pedaços
   * ou de uma vez, as fronteiras são as mesmas.
   */
  if (a.base && !a.morreu && !a.semStamina && ate > a.projetadoAte) {
    const fatorBase = a.fatorBase ?? Stamina.fatorDeExp(estado);
    let de = a.projetadoAte;
    for (let volta = 0; de < ate && volta < 8; volta++) {
      const s = Stamina.garantir(estado);
      if (s <= 0) {
        a.semStamina = true;
        a.parouEm = de;
        break;
      }
      const fronteira = [2340, 840, 0].find((f) => f < s) ?? 0;
      const fim = Math.min(ate, de + (s - fronteira) * 60_000);
      const ms = fim - de;
      const extra = projetar(estado, a.base, ms / SIMULACAO_MAXIMA_MS, Stamina.fatorDeExp(estado) / fatorBase);
      somarSessao(a.fora, extra);
      passarOTempoOffline(estado, hunt, ms, extra);
      // Chegou na fronteira: sem o resto de ponto flutuante, que faria um trecho de 0 ms.
      if (fim < ate) estado.stamina = fronteira;
      de = fim;
    }
    if (!a.semStamina && Stamina.garantir(estado) <= 0) {
      a.semStamina = true;
      a.parouEm = de;
    }
    a.projetadoAte = de;
    hunt.offlineDesde = de;
    avancou = true;
  }
  hunt.eventos = [];
  hunt.sessao = a.principal;

  if (!final) return { avancou, morreu: a.morreu, semStamina: !!a.semStamina };

  // O login: fecha a ausência inteira e entrega o relatório desde a saída.
  const fim = a.morreu ? a.morreuEm : a.semStamina ? a.parouEm : ate;
  const report = relatorio(estado, a.fora, fim);
  somarSessao(a.principal, a.fora);
  hunt.sessao = a.principal;
  hunt.ultimoTique = agora;
  delete hunt.offlineDesde;
  delete hunt.ausencia;
  if (a.semStamina && !a.morreu) {
    // Sem stamina a caçada acabou lá atrás: ele volta para a cidade.
    report.motivo = 'A stamina acabou e a caçada offline parou: o personagem voltou para a cidade.';
    estado.hunt = null;
  }
  return { report, morreu: a.morreu, semStamina: !!a.semStamina };
}

/**
 * O que o tique faz com o tempo que passa, para um trecho PROJETADO (ver
 * `tique`: stamina, tempo caçando, prey, boosts, imbuements...) — sem isto a
 * caçada offline, depois dos 30 min simulados, não gastava stamina nem contava
 * no "tempo caçando", e o prey/imbuement dela era de graça.
 */
function passarOTempoOffline(estado, hunt, ms, extra) {
  if (!(ms > 0)) return;
  Stamina.gastar(estado, ms);
  const totais = Ficha.totais(estado);
  totais.time += ms / 1000;
  totais.kills += extra.kills ?? 0;
  totais.exp += extra.exp ?? 0;
  if (hunt.huntId === 'treino') {
    Treino.gastarMana(estado, (Treino.manaDoPatioPorSegundo(estado) * ms) / 1000);
    return;
  }
  Boosts.consumir(estado, ms);
  BuffPower.consumir(estado, ms);
  Prey.consumir(estado, ms);
  Imbuements.consumir(estado, ms);
  Treinos.encherTanque(estado, ms);
}

/** Na volta (login): termina a ausência e devolve `{report, morreu}` — ou `null`, sem ausência. */
export function simularAusencia(estado, personagem, agora = Date.now()) {
  return avancarAusencia(estado, personagem, agora, true);
}

/**
 * Em segundo plano (`consolidacao-offline.mjs`): avança a ausência até `agora`
 * e deixa o personagem ausente. `{avancou, morreu}` — ou `null`, sem ausência.
 */
export function consolidarAusencia(estado, personagem, agora = Date.now()) {
  return avancarAusencia(estado, personagem, agora, false);
}


/**
 * `send({t:'startHunt', huntId})` — `huntId` normalmente é uma das 48 hunts
 * reais do `catalog.hunts`, mas também aceita um mapa feito no `/editor`
 * (`game/gamedata/hunts/<id>-map.json` sem entrada nenhuma no
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
  // O posto: a casa a 1 SQM do boneco, escolhida UMA vez (ver `Treinos.postoNoPatio`).
  const posto = Treinos.postoNoPatio(grade.andavel, bonecos);
  if (!posto) return { ok: false, erro: 'Não há lugar livre ao lado do boneco agora.' };
  const alvo = monstros.find((m) => Math.max(Math.abs(m.x - posto.x), Math.abs(m.y - posto.y)) === 1) ?? monstros[0];
  const settings = estado.settings ?? {};
  estado.rumo = null;
  estado.hunt = {
    huntId: 'treino', modo: 'auto', z: grade.z, pos: { x: posto.x, y: posto.y, dir: direcaoPara(posto, alvo) }, posto: { x: posto.x, y: posto.y },
    monstros, alvo: alvo.uid, strategy: 'nearest', distancia: Math.max(0, Math.min(6, Number(settings.distance) || 0)),
    rumo: null, rumoValidoAte: 0, proximoPassoEm: 0, proximoGolpeEm: 0, eventos: [], mapaEnviado: false,
    clock: 0, ultimoTique: Date.now(), cooldowns: {}, assistencia: true, autoBarra: true,
    levaAlvo: 0, lureVolta: 0, leva: 0, lurando: false, respawns: [], isBoss: false, bossId: null,
    startedAt: Date.now(), sessao: novaSessao(estado, 'Pátio de treino', 'auto'), treinoAntes: Treino.paraCliente(estado),
    viagem: { hunt: 'Pátio de treino', motivo: 'partida' },
  };
  return { ok: true };
}

/** Mapa de editor fora da campanha (sem instância): os spawns dele viram um ponto por bicho, com a 1ª criatura. */
const pontosDosSpawns = (spawns) =>
  (spawns ?? []).flatMap((sp) =>
    Array.from({ length: sp.quantidade }, () => ({
      key: sp.criaturas[0].key, x: sp.x, y: sp.y, z: sp.z,
      // A raridade do spawn vai junto (mapa do editor fora da campanha também a respeita).
      ...(sp.raridade != null ? { raridade: sp.raridade } : {}),
      ...(sp.modificadores?.length ? { modificadores: sp.modificadores } : {}),
    })));

/*
 * Com percurso, nasce no primeiro waypoint DELE: o `route[0]` original pode
 * cair num pedaço do andar sem ligação com o laço (Feru Way), e aí nenhum
 * waypoint tinha caminho — ele ficava parado no lugar.
 */
function inicioDaCacada(grade, posicoes, boss) {
  const mediaX = Math.round(posicoes.reduce((s, p) => s + p.x, 0) / Math.max(1, posicoes.length));
  const mediaY = Math.round(posicoes.reduce((s, p) => s + p.y, 0) / Math.max(1, posicoes.length));
  return boss
    ? casaAndavelMaisProxima(grade, boss.partida?.x ?? 1, boss.partida?.y ?? 1)
    : grade.percurso
      ? grade.percurso[0]
      : grade.inicioReal && grade.andavel.has(`${grade.inicioReal.x},${grade.inicioReal.y}`)
        ? grade.inicioReal
        : casaAndavelMaisProxima(grade, mediaX, mediaY);
}

/**
 * Os bichos de uma caçada nova: onde ele nasce, os do andar da entrada, os dos
 * outros andares e — numa hunt da campanha — a INSTÂNCIA (ver
 * `hunt/instancia.mjs`). Usado por `entrar` e por `novaInstancia`.
 */
function povoar({ huntId, hunt, boss, tranca, fase, mapaCustom, escala }) {
  const grade = gradeDaHunt(hunt ?? { id: huntId });
  const posicoes = boss ? posicaoDoBoss(boss, grade) : hunt?.posicoes?.length ? pontosNoMapa(hunt, grade.mapa?.floors ? grade.mapa : null) : spawnsCapturados(huntId) ?? grade.posicoes ?? mapaCustom?.posicoes ?? pontosDosSpawns(spawnsDaHunt(huntId));
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
  // A força dos bichos na campanha: a da fase (ou do boss do ato) naquela dificuldade.
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
  const inicio = inicioDaCacada(grade, posicoes, boss);
  /*
   * ---- Hunt da campanha: uma INSTÂNCIA, nos spawns do MAPA ----
   * Os bichos nascem nos pontos que o mapa define (`spawnsDaHunt`, ver
   * `mapa/spawns.mjs`), sem respawn; CLEAR em 100% (ver `hunt/instancia.mjs`).
   * Boss, Vip/Instance/Divine e mapa gerado seguem do jeito deles.
   */
  const spawnsDoMapa = fase ? spawnsDaHunt(huntId) : null;
  const comInstancia = !!spawnsDoMapa?.length;
  const instanciaId = comInstancia ? Instancia.gerarId() : null;
  // Uma criatura por casa (por andar).
  const casasDeSpawn = new Set();
  const todos = comInstancia
    ? Instancia.comporBichos({ grade, spawns: spawnsDoMapa, dadosDaHunt: hunt, inicio, escala, aplicarEscala: Campanha.aplicarEscala, instanciaId })
    : [];
  for (const p of comInstancia ? [] : posicoes) {
    const z = andarDe(p);
    if (!andaresDaRota.has(z)) continue;
    const g = andarDaGrade(grade, z);
    for (let k = 0; k < densidade; k++) {
      const casa = casaLivrePerto(g, p, (c) => casasDeSpawn.has(`${c.x},${c.y},${z}`));
      if (!casa) break;
      casasDeSpawn.add(`${casa.x},${casa.y},${z}`);
      const m = Campanha.aplicarEscala(criarMonstro({ ...p, x: casa.x, y: casa.y }, hunt), escala);
      // A raridade e os modificadores que o spawn do mapa configura (os mesmos da instância).
      if (m && (p.raridade || p.modificadores?.length)) Raridade.aplicar(m, Raridade.doSpawn(p));
      if (m) todos.push({ z, m });
    }
  }

  const andarInicial = inicio.z ?? grade.z;
  const monstros = todos.filter(({ z }) => z === andarInicial).map(({ m }) => m);
  const outrosAndares = {};
  for (const { z, m } of todos) if (z !== andarInicial) (outrosAndares[z] ??= []).push(m);
  // O personagem nasce numa casa livre: o bicho que estaria em cima dele sai da hunt.
  for (let i = monstros.length - 1; i >= 0; i--) if (monstros[i].x === inicio.x && monstros[i].y === inicio.y) monstros.splice(i, 1);
  // A instância: o total dos objetivos de limpeza é o que de fato nasceu.
  let instancia = null;
  if (comInstancia) {
    instancia = Instancia.novoRegistro(huntId, instanciaId);
    for (const m of [...monstros, ...Object.values(outrosAndares).flat()]) instancia.objetivos.total += m.objetivo ?? 1;
    // Os encontros do mapa (se houver): sorteados AGORA, uma vez, com a semente guardada na instância.
    const definicoes = encontrosDaHunt(huntId);
    if (definicoes.length) Encontros.criar(instancia, definicoes);
  }
  return { grade, inicio, andarInicial, monstros, outrosAndares, instancia };
}

export function entrar(estado, { huntId, mode, strategy, dificuldade, campanha: pelaCampanha = false }) {
  const boss = CATALOGO.bosses.find((b) => b.id === huntId) ?? null;
  // A campanha (ver `systems/campanha.mjs`): a fase desta hunt, ou o boss de fim de ato.
  const dif = Campanha.DIFICULDADES.includes(dificuldade) ? dificuldade : Campanha.DIFICULDADES[0];
  const fase = boss ? null : Campanha.faseDe(huntId);
  const atoDoBoss = boss && pelaCampanha ? Campanha.atoDoBoss(boss.id) : null;
  const primeiraDoAto = atoDoBoss != null && !Campanha.bossVencido(estado, dif, atoDoBoss);
  const hunt = acharHunt(huntId) ?? boss;
  const mapaCustom = hunt ? null : mapaRealCapturado(huntId);
  if (!hunt && !mapaCustom) return { ok: false, erro: 'Esta hunt não existe.' };
  // Hunts Vip / Instance / Divine: premium, o acesso e o level (ver `premium.mjs`).
  const tranca = Premium.trancaDaHunt(hunt);
  if (tranca) {
    const pode = Premium.podeEntrar(estado, hunt);
    if (!pode.ok) return pode;
  }
  /*
   * Hunt normal = FASE da campanha: entra quem a liberou naquela dificuldade
   * ("só o progresso", decisão do dono — o level do personagem não conta).
   * Isto substitui a trava de level que as hunts normais tinham. As
   * Vip/Instance/Divine seguem com a delas (`podeEntrar`), e os bosses abaixo.
   */
  if (fase) {
    const motivo = Campanha.motivoParaNaoEntrar(estado, dif, huntId);
    if (motivo) return { ok: false, erro: motivo };
  }
  if (atoDoBoss != null && !Campanha.bossLiberado(estado, dif, atoDoBoss)) {
    return { ok: false, erro: `Complete as 12 fases do Ato ${atoDoBoss} no ${Campanha.CAMPANHA.dificuldades[dif].nome} para enfrentar ${boss.name}.` };
  }
  if (hunt && !boss && !tranca && !mapaRealCapturado(hunt.id) && !temTerrenoReal(hunt)) {
    return { ok: false, erro: 'Esta hunt ainda não tem terreno capturado.' };
  }
  // O boss de fim de ato pela campanha: a PRIMEIRA vez sem level, task nem
  // recarga; depois da vitória, repetir segue a recarga dele (sem level/task:
  // a força é a da dificuldade).
  if (boss && !primeiraDoAto) {
    // Level e a recarga real de cada boss (`cooldownHours`, `bossCooldownsAte`).
    if (atoDoBoss == null && (estado.level ?? 0) < (boss.level ?? 0)) return { ok: false, erro: `Precisa de level ${boss.level}.` };
    // Boss de task: abre com a task feita e sai uma vez por personagem (`bosses.mjs`).
    const recusa = atoDoBoss == null ? Bosses.recusaDaTask(estado, boss.id) : null;
    if (recusa) return { ok: false, erro: recusa };
    const volta = Bau.garantir(estado).bossCooldownsAte[boss.id] ?? 0;
    if (volta > Date.now()) {
      const h = Math.ceil((volta - Date.now()) / 3_600_000);
      return { ok: false, erro: `${boss.name} ainda não voltou: faltam ~${h}h.` };
    }
  }

  const escala = fase ? Campanha.escalaDaFase(huntId, dif) : atoDoBoss != null ? Campanha.escalaDoBoss(atoDoBoss, dif) : null;
  const { grade, inicio, andarInicial, monstros, outrosAndares, instancia } = povoar({ huntId, hunt, boss, tranca, fase, mapaCustom, escala });

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
    // A campanha: a fase (ou o boss do ato) e a dificuldade — o progresso, a
    // escala dos bichos que renascem e o ato/dificuldade do loot saem daqui.
    campanha: fase ? { huntId, dificuldade: dif, ato: fase.ato } : atoDoBoss != null ? { bossDoAto: atoDoBoss, dificuldade: dif, ato: atoDoBoss } : null,
    escala,
    // A instância desta entrada (hunt da campanha): os bichos não renascem, e
    // ela fica CLEAR quando não sobra nenhum (ver `hunt/instancia.mjs`).
    instancia,
    // "Você tem 25 minutos lá dentro, nos dois modos" (no relógio da caçada).
    fimDaSala: boss ? Bosses.TEMPO_NA_SALA_MS : null,
    tranca,
    startedAt: Date.now(),
    sessao: novaSessao(estado, hunt?.name ?? huntId, mode === 'online' ? 'online' : 'auto'),
    // A cortina "Traçando a rota" (`mostrarViagem`, no client) sai no primeiro
    // `state` da hunt nova — a sessão manda uma vez e apaga.
    viagem: { hunt: hunt?.name ?? huntId, motivo: 'partida' },
  };
  // "A espera começa quando você ENTRA — mesmo que ele não caia." (Menos a primeira do boss de ato.)
  if (boss && !primeiraDoAto) Bosses.marcarEntrada(estado, boss.id);
  return { ok: true };
}

/**
 * A razão de velocidade do personagem: a da ficha sobre a base do level (1 =
 * um passo por tique), entre 0,25 e 2 — nem parado, nem teleporte.
 */
export function razaoDeVelocidade(estado) {
  const base = R.baseSpeed(estado.level ?? 1);
  // Lento (controle de boss/elite): anda mais devagar (`combate/controle.mjs`); preso, nem anda (`podeAgir`, no tique).
  return Math.min(2, Math.max(0.25, (Ficha.combate(estado).speed ?? base) / Math.max(1, base) / Controle.fatorDeLentidao(estado.hunt)));
}

/** Quantos passos ele dá neste tique: o crédito acumulado (fração de passo) + a razão, inteiro, até 2. */
function passosDoTique(estado, hunt) {
  hunt.creditoDePasso = (hunt.creditoDePasso ?? 0) + razaoDeVelocidade(estado);
  const n = Math.min(2, Math.floor(hunt.creditoDePasso));
  hunt.creditoDePasso = Math.min(1, hunt.creditoDePasso - n);
  return n;
}

/** Os efeitos ativos NO JOGADOR para o ícone ao lado do nome: o controle (congelado, atordoado, lento) e o dano contínuo (queimando, envenenado, sangrando...). */
const estadosDoJogador = (hunt) => [...Controle.ativosNoJogador(hunt), ...Dot.ativosNoJogador(hunt, hunt.clock ?? 0)];

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

/** `send({t:'aoCompletarFase', value: 'repetir'|'seguir'})` — o que fazer quando a fase da campanha completa. */
export function definirAoCompletarFase(estado, { value }) {
  if (!Campanha.AO_COMPLETAR.includes(value)) return { ok: false, erro: 'Opção inválida.' };
  (estado.settings ??= {}).aoCompletarFase = value;
  return { ok: true };
}

/**
 * "Seguir" ligado e a fase ATUAL completa: para onde ir (`{huntId, dificuldade,
 * nome}`), ou `null`. Sem marca de "acabou de completar": ligar o Seguir numa
 * fase já feita também avança (o dono: "se eu clico o seguir ela não vai para
 * a próxima mesmo completa"). Para farmar uma fase completa, é o "Repetir".
 * Só a sessão ONLINE chama (offline fica sempre em loop), e só quem caça a
 * PRÓPRIA sala segue: o convidado da party fica com o anfitrião.
 */
export function faseParaSeguir(estado) {
  const hunt = estado.hunt;
  const c = hunt?.campanha;
  if (!c || c.bossDoAto || Campanha.aoCompletar(estado) !== 'seguir' || salaDe(hunt) !== hunt) return null;
  if (!Campanha.faseCompleta(estado, c.dificuldade, c.huntId)) return null;
  const proxima = Campanha.proximaParaSeguir(estado, c.dificuldade, c.huntId);
  return proxima ? { huntId: proxima.huntId, dificuldade: c.dificuldade, nome: proxima.nome } : null;
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
export function disparoManual(estado, personagem, slot, mira = null) {
  const hunt = estado.hunt;
  if (!hunt) return { ok: false, erro: 'Você não está numa hunt.' };
  const alvo = alvoAtual(hunt);
  // A casa que o jogador escolheu na MIRA (runa/magia de área com `miraNoChao`): é lá que a área cai.
  const noChao = mira && Number.isInteger(mira.x) && Number.isInteger(mira.y) ? { x: mira.x, y: mira.y } : null;
  const resultado = Acoes.disparar(estado, hunt, personagem, slot, alvo, { mira: noChao });
  if (!resultado.ok) return resultado;
  processarMortes(estado, personagem, resultado.eventos);
  return resultado;
}

/** Entra na caçada de outro membro da party: os MESMOS bichos, posição própria. */
/** O level de uma hunt (o do catálogo: Troll Cave 8, Port Hope 40...); 0 se ela não tem. */
export const levelDaHunt = (huntId) => huntOuMapaCustom(huntId)?.level ?? 0;

/** Vip/Instance/Divine: `estado` tem premium, o acesso e o level da porta desta sala? (`{ok}` ou `{ok:false, erro}`) */
export function podeEntrarNaSala(estado, sala) {
  const dados = huntOuMapaCustom(sala.huntId);
  return Premium.trancaDaHunt(dados) ? Premium.podeEntrar(estado, dados) : { ok: true };
}

// Parado atrás do mesmo jogador da party por este tempo, os dois trocam de lugar (ver a colisão, em `tique`).
const TROCA_COM_ALIADO_MS = 1500;
const barradosPorAliado = new WeakMap(); // hunt -> { aliado, desde }

/** `gente`: as casas de quem já está na sala (a party manda — a sala não guarda a lista dos convidados). */
export function entrarNaSala(estado, sala, gente = []) {
  const dados = huntOuMapaCustom(sala.huntId);
  const tranca = Premium.trancaDaHunt(dados);
  if (tranca) {
    const pode = Premium.podeEntrar(estado, dados);
    if (!pode.ok) return pode;
  }
  const grade = andarDaGrade(gradeDaHunt(dados), sala.z);
  // Livre de bicho E de gente: o dono da sala e quem já entrou (a colisão da caçada em grupo).
  const ocupadas = new Set(sala.monstros.map((m) => `${m.x},${m.y}`));
  ocupadas.add(`${sala.pos.x},${sala.pos.y}`);
  for (const casa of aliadosPorCasa(sala).keys()) ocupadas.add(casa);
  for (const p of gente) if ((p.z ?? sala.z) === sala.z) ocupadas.add(`${p.x},${p.y}`);
  let inicio = null;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, 1], [0, -1], [-1, 1], [1, 1], [-1, -1], [1, -1], [-2, 0], [2, 0], [0, 2], [0, -2]]) {
    const c = { x: sala.pos.x + dx, y: sala.pos.y + dy };
    if (grade.andavel.has(`${c.x},${c.y}`) && !ocupadas.has(`${c.x},${c.y}`)) {
      inicio = c;
      break;
    }
  }
  inicio ??= casaLivrePerto(grade, sala.pos, (c) => ocupadas.has(`${c.x},${c.y}`)) ?? casaAndavelMaisProxima(grade, sala.pos.x, sala.pos.y);
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
    // A fase da campanha e a escala dos bichos são da SALA: quem entra caça a mesma fase.
    campanha: sala.campanha ?? null, escala: sala.escala ?? null,
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

/*
 * A caçada offline PROJETADA (o que passa do trecho simulado tique a tique):
 * `kills` mortes tiram bichos da instância ao acaso; cada vez que ela zera, é
 * uma limpeza (conta na campanha) e começa outra do mesmo tamanho. As
 * limpezas do meio são só conta — montar dezenas de instâncias que ninguém vê
 * custaria segundos; só a última é montada de verdade.
 */
function projetarNaInstancia(estado, kills) {
  const hunt = estado.hunt;
  if (!hunt?.instancia || !(kills > 0)) return;
  const restam = Instancia.pendentes(hunt);
  if (hunt.instancia.status === 'ativa' && kills < restam) {
    Instancia.tirarAoAcaso(hunt, kills);
    return;
  }
  const total = Math.max(1, hunt.instancia.objetivos.total);
  let sobra = kills - (hunt.instancia.status === 'ativa' ? restam : 0);
  let limpezas = hunt.instancia.status === 'ativa' ? 1 : 0;
  limpezas += Math.floor(sobra / total);
  sobra %= total;
  // A projeção zerou a instância: o idle resolve os encontros pendentes (obrigatórios sem recompensa; opcionais expiram).
  Encontros.resolverNaProjecao(hunt.instancia);
  for (let i = 0; i < limpezas; i++) Campanha.limpou(estado, hunt);
  novaInstancia(estado);
  Instancia.tirarAoAcaso(hunt, sobra);
}

/*
 * A instância foi limpa: a limpeza conta na campanha de quem é da sala — o
 * dono e os convidados da party que estão nela (decisão do dono: conta para
 * todos). O aviso "Hunt Clear!" sai na tela de cada um (`avisoDaHunt`).
 */
function aoLimparAInstancia(estado, hunt) {
  Campanha.limpou(estado, hunt);
  for (const m of hunt.partilha?.membros ?? []) {
    const h = m.estado?.hunt;
    if (m.estado !== estado && h && salaDe(h) === hunt) Campanha.limpou(m.estado, h);
  }
}

/**
 * Uma instância NOVA da mesma hunt, do zero: bichos sorteados de novo, o
 * personagem de volta à entrada, o resto da caçada (sessão, relógio, recargas,
 * ajustes) segue. Os bichos trocam NO LUGAR (`splice`): os convidados da party
 * apontam para o mesmo array. Só o dono da sala. `false` se não há instância.
 */
export function novaInstancia(estado) {
  const hunt = estado.hunt;
  if (!hunt?.instancia || hunt.anfitriao) return false;
  const dados = acharHunt(hunt.huntId);
  const fase = Campanha.faseDe(hunt.huntId);
  const novo = povoar({ huntId: hunt.huntId, hunt: dados, boss: null, tranca: null, fase, mapaCustom: null, escala: hunt.escala });
  if (!novo.instancia) return false;
  hunt.monstros.splice(0, hunt.monstros.length, ...novo.monstros);
  hunt.outrosAndares = novo.outrosAndares;
  hunt.respawns = [];
  hunt.z = novo.andarInicial;
  hunt.pos = { x: novo.inicio.x, y: novo.inicio.y, dir: 2 };
  hunt.percurso = novo.grade.percurso ? { passo: waypointMaisPerto(novo.grade.percurso, novo.inicio, 0, novo.grade.percurso.length, novo.andarInicial) } : null;
  hunt.alvo = null;
  hunt.alvoTravado = null;
  hunt.alvoDaLimpeza = null;
  hunt.perseguicao = null;
  hunt.progresso = null;
  hunt.rumo = null;
  hunt.leva = 0;
  hunt.lurando = (hunt.levaAlvo ?? 0) > 0;
  if (hunt.summon) {
    hunt.summon.x = novo.inicio.x;
    hunt.summon.y = novo.inicio.y;
  }
  hunt.instancia = novo.instancia;
  return true;
}

/**
 * Caçada gravada ANTES da instância numa hunt que é fase — sem `hunt.campanha`
 * (de antes da campanha) ou sem `hunt.instancia` (de antes das instâncias):
 * sem isto ela seguiria com respawn e nunca completaria a fase. Fase liberada
 * → entra de novo nela, já como instância (mesma dificuldade, mesmo modo);
 * fechada → a caçada termina (todos começam da fase 1). Roda na entrada,
 * depois da caçada offline. Devolve o aviso para a tela, ou null.
 */
export function adotarNaCampanha(estado) {
  const hunt = estado.hunt;
  if (!hunt || hunt.instancia || hunt.campanha?.bossDoAto) return null;
  const fase = Campanha.faseDe(hunt.huntId);
  if (!fase) return null;
  const dif = Campanha.DIFICULDADES.includes(hunt.campanha?.dificuldade) ? hunt.campanha.dificuldade : Campanha.DIFICULDADES[0];
  if (!Campanha.faseLiberada(estado, dif, hunt.huntId)) {
    const motivo = Campanha.motivoParaNaoEntrar(estado, dif, hunt.huntId);
    sair(estado);
    return `A campanha chegou: as hunts agora abrem fase a fase. ${motivo}`;
  }
  const r = entrar(estado, { huntId: hunt.huntId, mode: hunt.modo === 'online' ? 'online' : 'auto', strategy: hunt.strategy, dificuldade: dif });
  if (r.ok) return null;
  sair(estado);
  return r.erro;
}

/** `send({t:'stopHunt'})` */
export function sair(estado) {
  estado.hunt = null;
  return { ok: true };
}

/** Para que lado olhar, de `de` para `para` (0 norte, 1 leste, 2 sul, 3 oeste). */
function direcaoPara(de, para) {
  const dx = para.x - de.x;
  const dy = para.y - de.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 1 : 3;
  return dy > 0 ? 2 : 0;
}

/*
 * ---- Encerrar o treino online (o pátio) ----
 *
 * O "parar" do pátio (`training stop` e `stopHunt`) caía em `Exercicio.parar`,
 * que só conhece o Exercise: respondia "Você não está treinando." com o
 * personagem DENTRO do pátio, e não havia saída — `relatorioDoPatio` existia e
 * ninguém chamava. Aqui: o relatório, a hunt some (ele volta para a casa da
 * cidade de onde saiu, que nunca mudou — a lógica de sempre da volta de uma
 * caçada) e o movimento fica livre de novo, porque `Treinos.emTreino` deixa de
 * valer.
 */
export function sairDoPatio(estado) {
  if (estado.hunt?.huntId !== 'treino') return { ok: false, erro: 'Você não está treinando.' };
  const relatorio = Treinos.relatorioDoPatio(estado);
  estado.hunt = null;
  estado.rumo = null;
  return { ok: true, relatorio };
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
  // "Tirar o escudo quando" (do slot do utamo vita): antes de tudo, para a cura já contar com a vida.
  eventos.push(...Acoes.tirarEscudoSePreciso(estado, hunt, personagem, alvo));
  // Sustento (vida, mana, velocidade, suporte): em ordem de prioridade, todo
  // tique — é ele que salva o personagem, e o primeiro slot de vida manda.
  for (let slot = 0; slot < acoes.length; slot++) {
    if (estado.hp <= 0) break;
    if (Acoes.PAPEL_DO_SLOT[slot] === 'attack') continue;
    const action = acoes[slot];
    if (!action?.id || action.enabled === false) continue;
    if (!Acoes.condicoesDoSlotBatem(action, estado, alvo, hunt)) {
      Acoes.marcarParado(hunt, slot, Acoes.falhaDaCondicao(action, estado, alvo, hunt));
      continue;
    }
    // As regras de uso (`bloquear` vale também para buff e suporte; cura e poção nunca são barradas).
    if (!RegrasDeUso.permitida(action.id, RegrasDeUso.ativas(estado, hunt, alvo), { ataque: false })) continue;
    const resultado = Acoes.disparar(estado, hunt, personagem, slot, alvo);
    if (resultado.ok) eventos.push(...resultado.eventos);
  }
  // Ataque: os 11 slots da fileira por PRIORIDADE (a 1ª disponível, a partir do slot 1 — ver combo.mjs).
  if (estado.hp > 0) eventos.push(...Combo.tiqueDoCombo(estado, hunt, personagem, alvo));
  processarMortes(estado, personagem, eventos);
  return eventos;
}

/**
 * Roda o passo (movimento) e o golpe (combate) da hunt — chamado a cada
 * tique de rede (100ms), igual ao `processarMovimento` da cidade.
 */
/*
 * A casa vizinha andável e livre que mais afasta do alvo (e dos outros bichos).
 *
 * ---- Recuar é AFASTAR do alvo, não andar de lado ----
 *
 * A nota do vizinho era a distância ao alvo + 0,1 x a distância ao bicho mais
 * perto, e a da casa atual só a distância — sem os 0,1. Então todo passo de
 * lado, que não afasta nada, "ganhava" (2,2 > 2): encostado numa parede, o
 * personagem com Distância > 0 andava de lado, o bicho acompanhava, e ele
 * voltava — 31,25 ↔ 32,25 para sempre (ahau, e 24 outros mapas). Agora só
 * vale o vizinho que fica MAIS LONGE do alvo; os 0,1 só desempatam entre eles.
 * Sem nenhum, não há recuo: ele fica e bate de onde está.
 */
function passoDeRecuo(grade, hunt, alvo) {
  let melhor = null;
  const agora = distancia(hunt.pos, alvo);
  let melhorNota = -Infinity;
  for (const [dx, dy] of VIZINHANCA_8) {
    const viz = { x: hunt.pos.x + dx, y: hunt.pos.y + dy };
    if (!grade.andavel.has(`${viz.x},${viz.y}`)) continue;
    if (distancia(viz, alvo) <= agora) continue;
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
 * ---- Sem vizinha que afaste: deslizar pela parede até uma que afaste ----
 *
 * "quando chega na parede ele para, mesmo tendo espaço para movimentar
 * diagonal e sair". O `passoDeRecuo` olha UMA casa: encostado numa parede, a
 * saída é ir de lado ou na diagonal ao longo dela, e esse primeiro passo ainda
 * não afasta — então não havia recuo e ele ficava parado apanhando.
 *
 * Aqui a procura vai até `RAIO_DO_RECUO` casas (BFS, contornando os bichos): a
 * casa alcançável MAIS LONGE do alvo do que ele está agora. Ele se COMPROMETE
 * com ela (`hunt.recuo`) e vai até lá sem reavaliar a direção — cada passo sem
 * nunca chegar mais perto do alvo.
 *
 * ---- E o vaivém que o `passoDeRecuo` corrigiu não volta ----
 *
 * Com o bicho acompanhando de lado (ahau, e o teste H), deslizar não afasta
 * nada. Por isso o deslize é UMA tentativa: chegou e a distância não aumentou,
 * ele fica e bate (`FOLGA_DO_RECUO_MS` sem tentar de novo), e as casas daquele
 * deslize ficam vetadas por `CASAS_RUINS_MS` — o próximo não volta por elas. É o
 * compromisso que corta o ciclo, e não o `passoComProgresso` (que, vendo a volta
 * como ciclo, mandava desviar — e o desvio era deslizar de novo).
 */
const RAIO_DO_RECUO = 5;
const FOLGA_DO_RECUO_MS = 4000;
const CASAS_RUINS_MS = 30_000;
const MAXIMO_DE_RUINS = 24;
/**
 * O passo até um aliado da party (o que ele segue, ou o ponto do reagrupamento): a mesma BFS da caçada (contorna parede, bicho e
 * aliado), com o vigia de progresso (sem A → B → A) e sem refazer a busca enquanto nada mudou (`aindaTravado`). Sem rota, fica parado
 * e tenta de novo quando a situação muda.
 */
function passoAteAliado(grade, hunt, pos, quer, uid) {
  const casasDeBicho = new Set(hunt.monstros.filter((b) => b.hp > 0).map((b) => `${b.x},${b.y}`));
  const ocupado = (c) => casasDeBicho.has(`${c.x},${c.y}`);
  const alvo = { uid, x: pos.x, y: pos.y };
  if (aindaTravado(hunt, alvo)) return null;
  const bruto = proximoPassoAte(grade, hunt.pos, pos, ocupado, casasDeBicho);
  return passoComProgresso(hunt, grade, alvo, bruto, { quer, ocupado, bloqueado: casasDeBicho });
}

/** Os últimos passos de verdade que o kite olha para saber se ele corre (casas novas) ou dança (as mesmas poucas casas). */
const PASSOS_DA_JANELA = 8;
/** Com tantas casas diferentes ou menos nessa janela, é vaivém (o bicho espelha de lado e o passo desfaz o anterior), não corrida. */
const CASAS_DO_VAIVEM = 3;
/** A pausa curta (1,5 s); se o vaivém volta logo (em menos de 10 s), a pausa dobra, até 6 s — o beco com o bicho espelhando pede ficar e bater. */
const PAUSA_DO_KITE_MS = 1500;
const PAUSA_MAXIMA_DO_KITE_MS = 6000;
/**
 * O kite está DANDO VOLTAS? Olha as últimas `PASSOS_DA_JANELA` casas onde ele PISOU (só passos de verdade: a posição mudou desde o último tique de recuo): com
 * `CASAS_DO_VAIVEM` casas diferentes ou menos, não é corrida — é um vaivém — e ele ganha uma pausa curta para bater (que dobra se o vaivém voltar logo).
 * Correr por casas NOVAS (área aberta, mesmo com um bicho do mesmo passo colado) nunca pausa. A versão anterior contava TIQUES e não passos e parava o kite por
 * 4 s a cada 3 tiques sem ganho de distância (medido: 60% dos tiques do kite parados em área aberta). `true` = não recua agora.
 */
function recuoInutil(hunt) {
  const agora = hunt.clock ?? 0;
  // O estado do kite viaja na caçada gravada no banco: uma caçada de ANTES (outro formato do `hunt.kite`, de versões anteriores do recuo) não pode quebrar o tique — qualquer
  // coisa que não seja o formato de agora recomeça limpa. (Foi isso que travou a troca de personagem: `passos` indefinido na simulação offline do login.)
  if (!hunt.kite || !Array.isArray(hunt.kite.passos)) hunt.kite = { passos: [], x: null, y: null, paradoAte: 0, nivel: 0, ultimaPausa: -Infinity };
  const k = hunt.kite;
  if (!Number.isFinite(k.paradoAte)) k.paradoAte = 0;
  if (!Number.isFinite(k.nivel)) k.nivel = 0;
  if (!Number.isFinite(k.ultimaPausa)) k.ultimaPausa = -Infinity;
  if (k.paradoAte > agora) return true;
  if (k.x != null && (k.x !== hunt.pos.x || k.y !== hunt.pos.y)) {
    k.passos.push(`${hunt.pos.x},${hunt.pos.y}`);
    if (k.passos.length > PASSOS_DA_JANELA) k.passos.shift();
  }
  Object.assign(k, { x: hunt.pos.x, y: hunt.pos.y });
  if (k.passos.length === PASSOS_DA_JANELA && new Set(k.passos).size <= CASAS_DO_VAIVEM) {
    k.nivel = agora - k.ultimaPausa < 10_000 ? Math.min(2, k.nivel + 1) : 0;
    k.paradoAte = agora + Math.min(PAUSA_MAXIMA_DO_KITE_MS, PAUSA_DO_KITE_MS * 2 ** k.nivel);
    k.ultimaPausa = agora;
    k.passos = [];
    return true;
  }
  return false;
}

function recuoPlanejado(grade, hunt, alvo) {
  const agora = hunt.clock ?? 0;
  const d = distancia(hunt.pos, alvo);
  const vivos = hunt.monstros.filter((m) => m.hp > 0);
  const casasDeBicho = new Set(vivos.map((m) => `${m.x},${m.y}`));
  const ocupado = (c) => casasDeBicho.has(`${c.x},${c.y}`);
  /*
   * ---- O deslize NUNCA se aproxima do alvo (a rota inteira, não só o 1º passo) ----
   * A BFS e o passo até a casa escolhida só evitavam os bichos: o caminho MAIS CURTO até uma casa longe do alvo costuma passar
   * ao lado dele, o 1º passo era recusado por aproximar, e as 8 candidatas caíam uma a uma — com uma rota que nunca se aproxima
   * (pela diagonal ou pelo lado) ali do lado, ele ficava parado levando dano (medido: 13 em 1.195 posições perto de parede, com
   * uma casa mais longe alcançável sem se aproximar). Agora as casas mais PERTO do alvo que a atual valem como parede para a
   * busca: o caminho achado já nasce sem aproximar.
   */
  const bloqueadas = new Set(casasDeBicho);
  const dAtual = distancia(hunt.pos, alvo);
  for (let yy = -RAIO_DO_RECUO - 1; yy <= RAIO_DO_RECUO + 1; yy++) {
    for (let xx = -RAIO_DO_RECUO - 1; xx <= RAIO_DO_RECUO + 1; xx++) {
      const c = { x: hunt.pos.x + xx, y: hunt.pos.y + yy };
      if (distancia(c, alvo) < dAtual) bloqueadas.add(`${c.x},${c.y}`);
    }
  }
  const r = (hunt.recuo ??= { ruins: {} });
  for (const [k, ate] of Object.entries(r.ruins)) if (ate <= agora) delete r.ruins[k];

  // Um deslize em andamento: segue até o destino, sem reavaliar a direção.
  if (r.destino && r.uid === alvo.uid) {
    const chegou = hunt.pos.x === r.destino.x && hunt.pos.y === r.destino.y;
    const passo = chegou ? null : proximoPassoAte(grade, hunt.pos, r.destino, ocupado, bloqueadas);
    // Um deslize só anda para a frente: repassar por uma casa dele (o bicho
    // fechando o caminho até o destino, e o passo indo e vindo) ou passar do
    // raio é tentativa que não deu — acaba aqui, como se tivesse chegado.
    const repassa = passo && r.caminho.includes(`${passo.x},${passo.y}`);
    if (passo && !repassa && r.caminho.length <= RAIO_DO_RECUO + 2 && distancia(passo, alvo) >= d) {
      r.caminho.push(`${hunt.pos.x},${hunt.pos.y}`);
      return passo;
    }
    // Acabou (chegou, ou o caminho fechou/aproximaria): afastou de verdade?
    const deuCerto = d > r.dAntes;
    if (!deuCerto) {
      r.paradoAte = agora + FOLGA_DO_RECUO_MS;
      for (const k of [...r.caminho, `${r.destino.x},${r.destino.y}`, `${hunt.pos.x},${hunt.pos.y}`]) r.ruins[k] = agora + CASAS_RUINS_MS;
      const k = Object.keys(r.ruins);
      if (k.length > MAXIMO_DE_RUINS) for (const velha of k.sort((a, b) => r.ruins[a] - r.ruins[b]).slice(0, k.length - MAXIMO_DE_RUINS)) delete r.ruins[velha];
    }
    r.destino = null;
    r.caminho = [];
    if (!deuCerto) return null;
  }
  if ((r.paradoAte ?? 0) > agora) return null;
  // Já procurou e não havia saída nesta MESMA situação (ele, o alvo e os bichos em volta no mesmo lugar): não refaz a busca a cada tique.
  const situacao = `${hunt.pos.x},${hunt.pos.y}|${alvo.uid}@${alvo.x},${alvo.y}|${vivos.filter((m) => distancia(m, hunt.pos) <= RAIO_DO_RECUO + d + 2).map((m) => `${m.x},${m.y}`).sort().join(';')}`;
  if (r.semSaida === situacao) return null;

  const aPe = bfsDistancias(grade, hunt.pos, RAIO_DO_RECUO, null, VIZINHANCA_8, bloqueadas);
  const candidatas = [];
  for (let dy = -RAIO_DO_RECUO; dy <= RAIO_DO_RECUO; dy++) {
    for (let dx = -RAIO_DO_RECUO; dx <= RAIO_DO_RECUO; dx++) {
      if (!dx && !dy) continue;
      const c = { x: hunt.pos.x + dx, y: hunt.pos.y + dy };
      const passos = aPe.em(c.x, c.y);
      if (passos == null || passos === 0) continue;
      if (r.ruins[`${c.x},${c.y}`]) continue;
      const longe = distancia(c, alvo);
      if (longe <= d) continue;
      // Longe do alvo primeiro; depois perto (menos passos); depois longe dos outros bichos.
      const outros = Math.min(RAIO_DO_RECUO * 2, ...vivos.filter((m) => m !== alvo).map((m) => distancia(c, m)));
      // E com saída: uma casa com vizinhas livres não encurrala (o canto e o beco valem menos que o aberto).
      let saidas = 0;
      for (const [vx, vy] of VIZINHANCA_8) if (grade.andavel.has(`${c.x + vx},${c.y + vy}`) && !casasDeBicho.has(`${c.x + vx},${c.y + vy}`)) saidas++;
      candidatas.push({ c, nota: longe * 100 - passos * 10 + outros + saidas * 2 });
    }
  }
  candidatas.sort((a, b) => b.nota - a.nota);
  for (const { c } of candidatas.slice(0, 8)) {
    const passo = proximoPassoAte(grade, hunt.pos, c, ocupado, bloqueadas);
    if (!passo || distancia(passo, alvo) < d || r.ruins[`${passo.x},${passo.y}`]) continue;
    Object.assign(r, { uid: alvo.uid, destino: c, dAntes: d, caminho: [`${hunt.pos.x},${hunt.pos.y}`] });
    r.semSaida = null;
    return passo;
  }
  r.semSaida = situacao;
  return null;
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
  // O Energy Shield volta sozinho depois de um tempo sem apanhar (`Defesa.recarregar`).
  Defesa.recarregar(estado, ficha, ms);
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
  // O tique de antes: o relógio lógico das magias conta de dentro deste intervalo (`R.instanteLogico`).
  hunt.relogioAnterior = hunt.clock ?? 0;
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
    // A instância: zerou → CLEAR (para todos da sala); passada a pausa do
    // "Hunt Clear!", uma instância NOVA da mesma hunt (ver `hunt/instancia.mjs`).
    // Online com "Avançar sozinho", a sessão troca de fase antes da pausa acabar.
    if (hunt.instancia) {
      if (Instancia.marcarSeLimpou(hunt, hunt.clock ?? 0, { estado, personagem })) aoLimparAInstancia(estado, hunt);
      else if (Instancia.horaDaProxima(hunt, hunt.clock ?? 0)) novaInstancia(estado);
    }
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

  /*
   * ---- No pátio, nenhum passo ----
   *
   * O pátio rodava o passo da Caça Automática: com "Distância" > 0 o kite
   * levava o personagem a 3 SQM do boneco (18,12 → 18,14), e o `huntWalk` do
   * teclado/analógico andava. Treinando, ele fica no posto escolhido na entrada
   * (`hunt.posto`): sem rumo manual, sem perseguição, sem recuo, sem rota. Se
   * por algum caminho a posição divergir do posto (uma caçada gravada antes
   * disto), o servidor a devolve ao posto — sem recalcular nada.
   */
  if (hunt.huntId === 'treino') {
    hunt.rumo = null;
    // Pátio gravado antes de existir o posto: escolhe uma vez e guarda.
    hunt.posto ??= Treinos.postoNoPatio(grade.andavel);
    if (hunt.posto && (hunt.pos.x !== hunt.posto.x || hunt.pos.y !== hunt.posto.y)) {
      hunt.pos.x = hunt.posto.x;
      hunt.pos.y = hunt.posto.y;
    }
  } else if (!hunt.conjurando && Controle.podeAgir(hunt) && R.jaPode(agora, hunt.proximoPassoEm)) {
    // (Conjurando uma skill — o Cast Time da gema — o personagem não anda.)
    /*
     * ---- Movimento: quantos passos neste tique ----
     * O tique é do tamanho de um passo (`PASSO_MS`), então andar mais rápido
     * é dar MAIS de um passo por tique. A velocidade da ficha (Movimento dos
     * atributos, speed das botas, imbuement) sobre a base do level vira um
     * crédito de passos (ver `passosDoTique`). Antes o passo era fixo e o
     * atributo Movimento não fazia nada (auditoria, 29/09).
     */
    const passos = passosDoTique(estado, hunt);
    for (let passo = 0; passo < passos; passo++) {
    if (passo > 0) grade = andarDaGrade(gradeDaCacada, hunt.z);
      let destino = null;
      // Caça Online: o passo na mão — a tecla (`huntWalk`, o rumo) ou, sem tecla,
      // o próximo passo até onde o jogador clicou/tocou (`huntWalkTo`, ver `andarAte`).
      const manual = hunt.rumo && agora <= (hunt.rumoValidoAte ?? 0) ? hunt.rumo : passoDoClique(hunt, grade);
      if (manual) {
        // Daqui em diante, o mesmo passo para os dois: bicho na casa, escada, parede.
        const { dx, dy } = manual;
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
      } else if (hunt.reagrupar && distancia(hunt.pos, hunt.reagrupar.pos) > hunt.reagrupar.perto) {
        // Party: o líder chamou para perto de alguém (`party.mjs` → `reagruparDe`): anda até lá pela mesma busca, sem teleporte.
        destino = passoAteAliado(grade, hunt, hunt.reagrupar.pos, hunt.reagrupar.perto, 'reagrupar');
        if (destino) {
          const dx = Math.sign(destino.x - hunt.pos.x);
          const dy = Math.sign(destino.y - hunt.pos.y);
          hunt.pos.dir = dy < 0 ? 0 : dy > 0 ? 2 : dx > 0 ? 1 : 3;
        }
      } else if (hunt.guia && distancia(hunt.pos, hunt.guia.pos) > hunt.guia.coleira) {
        // Party: longe demais de quem segue ("Seguir ... a N sqm") — volta para perto. Dentro da distância não anda (a faixa vai de 0 a N).
        destino = passoAteAliado(grade, hunt, hunt.guia.pos, hunt.guia.coleira, 'guia');
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
        /*
         * ---- Instância: vai atrás do que SOBROU ----
         * Sem respawn, o laço da rota (feito para um mapa que se enche de novo)
         * deixava bicho longe da rota vivo para sempre. Nada à vista: o alvo vira
         * o bicho da instância mais perto A PÉ neste andar; não havendo nenhum
         * alcançável aqui, segue o laço, que leva aos outros andares.
         */
        if (!hunt.lurando && hunt.alvo == null && Instancia.daSala(hunt)?.status === 'ativa' && !alvoAtual(hunt)) {
          const resto = Instancia.bichoMaisPerto(hunt, grade);
          if (resto) {
            hunt.alvo = resto.uid;
            hunt.alvoDaLimpeza = resto.uid;
          }
        }
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
        // Chegou onde queria do alvo (ou ficou sem alvo): o que o vigia de
        // progresso lembrava daquela perseguição não vale mais (ver `progresso.mjs`).
        if (hunt.progresso && (!alvo || faltaAte(hunt.pos, alvo, querDistancia, hunt.distancia > 0) === 0)) hunt.progresso = null;
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
          if (hunt.alvo === hunt.alvoDaLimpeza) hunt.alvo = null;
          hunt.perseguicao = null;
          const casasDeBicho = new Set(hunt.monstros.filter((b) => b.hp > 0).map((b) => `${b.x},${b.y}`));
          if (grade.percurso) destino = passoNoPercurso(estado, hunt, grade, casasDeBicho);
        } else if (alvo && d > querDistancia && esperaOAlvoChegar(hunt, alvo)) {
          destino = null;
        } else if (alvo && d > querDistancia) {
          const casasDeBicho = new Set(hunt.monstros.filter((b) => b.hp > 0).map((b) => `${b.x},${b.y}`));
          const ocupado = (c) => casasDeBicho.has(`${c.x},${c.y}`);
          // Parado sem caminho/saída e nada mudou: nem refaz a busca (ver `aindaTravado`).
          const travado = !hunt.lurando && aindaTravado(hunt, alvo);
          destino = travado ? null : proximoPassoAte(grade, hunt.pos, alvo, ocupado, casasDeBicho);
          const espera = !travado && !hunt.lurando && voltariaAtras(hunt, alvo, destino);
          if (espera) destino = null;
          // Sem ciclo: o passo que só repete casas sem chegar mais perto vira desvio ou parada (ver `progresso.mjs`).
          const semCiclo = !travado && !hunt.lurando && !espera ? passoComProgresso(hunt, grade, alvo, destino, { quer: querDistancia, kite: hunt.distancia > 0, ocupado, bloqueado: casasDeBicho }) : destino;
          const cicloParado = travado || (!!destino && !semCiclo);
          destino = semCiclo;
          // Travado indo puxar um bicho (sem passo livre): tenta outro por 10s.
          // Com percurso vale também fora do lure — um bicho à vista do outro
          // lado de uma parede prendia o personagem parado para sempre (medido:
          // 48s num White Lion a 8 casas, em Werelions -1). Ele desiste do bicho
          // e segue o laço, que cedo ou tarde passa pelo lado de lá.
          if (!destino && !espera && !cicloParado && (hunt.lurando || hunt.percurso)) {
            alvo.semCaminhoAte = (hunt.clock ?? 0) + 10_000;
            if (hunt.alvo === alvo.uid) hunt.alvo = null;
            if (!hunt.lurando && grade.percurso) destino = passoNoPercurso(estado, hunt, grade, casasDeBicho);
          }
        } else if (alvo && !hunt.lurando && hunt.distancia > 0 && d < querDistancia) {
          const casasDeBicho = new Set(hunt.monstros.filter((b) => b.hp > 0).map((b) => `${b.x},${b.y}`));
          // O kite CONTINUA enquanto houver passo que afaste do alvo (o golpe sai no mesmo tique, não depende de parar); o vaivém ganha uma pausa curta (`recuoInutil`).
          const parou = recuoInutil(hunt); // corre sem parar; só o vaivém (as mesmas poucas casas em vários passos) ganha uma pausa curta
          const recuo = Diag.medir(hunt, 'passoDeRecuo', () => passoDeRecuo(grade, hunt, alvo));
          // Sem vizinha que afaste: o deslize planejado (com compromisso próprio, fora do vigia).
          if (parou) {
            destino = null;
            Diag.contar(hunt, 'kite:pausa-do-vaivem');
          } else if (!recuo) {
            destino = Diag.medir(hunt, 'recuoPlanejado', () => recuoPlanejado(grade, hunt, alvo));
            Diag.contar(hunt, destino ? 'kite:deslize' : 'kite:deslize-sem-passo');
          } else {
            destino = passoComProgresso(hunt, grade, alvo, recuo, {
              quer: querDistancia,
              kite: true,
              ocupado: (c) => casasDeBicho.has(`${c.x},${c.y}`),
              bloqueado: casasDeBicho,
            });
            Diag.contar(hunt, destino ? 'kite:recuo-1-casa' : 'kite:vigia-de-progresso-parou');
          }
        } else if (!alvo && hunt.percurso && grade.percurso) {
          // Ninguém à vista: segue o laço da hunt (ver `percursoDoMapa`).
          const casasDeBicho = new Set(hunt.monstros.filter((b) => b.hp > 0).map((b) => `${b.x},${b.y}`));
          const colado = hunt.monstros.some((b) => b.hp > 0 && b.perseguindo && distancia(b, hunt.pos) <= 2);
          /*
           * ---- Com espaço, ele PASSA pela leva ----
           * "se tiver espaço para lure ele passa pelos mobs". Com a leva colada, o
           * passo da rota tenta antes um caminho que não volte pela casa de onde
           * ele veio — contornando os bichos pelo lado ou na diagonal. Só sem
           * nenhum é que o passo desfaz o anterior, e aí a regra abaixo encerra a
           * juntada como antes.
           */
          destino = passoNoPercurso(estado, hunt, grade, casasDeBicho, hunt.lurando && colado ? hunt.casaAnterior : null);
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
      /*
       * ---- Colisão entre os jogadores da caçada em grupo ----
       *
       * "Nunca podem andar em cima do outro, tem que ter colisão." O passo que
       * cairia na casa de outro da sala ESPERA. Parado atrás do mesmo aliado por
       * `TROCA_COM_ALIADO_MS` (corredor de uma casa, um indo e outro vindo; ou o
       * líder voltando pela fila que o segue), os dois trocam de lugar — como no
       * Tibia. Sem a troca, o líder e quem o segue se travariam para sempre: quem
       * segue fica parado dentro da coleira, e o líder não passa por ele.
       */
      if (destino) {
        const aliado = aliadosPorCasa(hunt).get(`${destino.x},${destino.y}`);
        if (!aliado) barradosPorAliado.delete(hunt);
        else {
          const antes = barradosPorAliado.get(hunt);
          const desde = antes?.aliado === aliado ? antes.desde : agora;
          if (agora - desde < TROCA_COM_ALIADO_MS) {
            barradosPorAliado.set(hunt, { aliado, desde });
            destino = null;
          } else {
            barradosPorAliado.delete(hunt);
            aliado.pos.x = hunt.pos.x;
            aliado.pos.y = hunt.pos.y;
          }
        }
      }
      if (destino) {
        // De onde ele veio: é o que `voltariaAtras` compara.
        hunt.casaAnterior = { x: hunt.pos.x, y: hunt.pos.y };
        hunt.pos.x = destino.x;
        hunt.pos.y = destino.y;
      }
      // Chegou onde clicou/tocou.
      if (hunt.destino && hunt.pos.x === hunt.destino.x && hunt.pos.y === hunt.destino.y) hunt.destino = null;
      hunt.proximoPassoEm = agora + R.PASSO_MS;
    }
  }
  // Subiu ou desceu neste passo: o resto do tique já é no andar novo.
  grade = andarDaGrade(gradeDaCacada, hunt.z);

  if (donoDaSala) moverMonstros(hunt, grade, agora);

  const eventos = [];
  // Congelado ou atordoado (controle de boss/elite): a conjuração em andamento se perde, e o jogador não age até acabar.
  const livre = Controle.podeAgir(hunt);
  if (!livre) hunt.conjurando = null;
  // A conjuração que chegou ao fim (ou que cancelou): a skill sai aqui, antes do resto.
  eventos.push(...Acoes.concluirConjuracao(estado, hunt, personagem));
  const assiste = hunt.modo !== 'online' || hunt.assistencia !== false;
  // Conjurando, o golpe básico espera (como no Path of Exile: uma ação por vez).
  if (assiste && livre && !hunt.conjurando && R.jaPode(agora, hunt.proximoGolpeEm) && estado.hp > 0) {
    const golpe = round(estado, personagem);
    // JUNTA aos eventos, e não substitui: no tique em que uma conjuração termina e o golpe
    // básico também sai, a magia (dano, explosões, o fim da conjuração) sumia da tela e do
    // analisador de dano — o dano entrava no bicho, mas ninguém via.
    eventos.push(...golpe.eventos);
    // Só conta o intervalo se de fato bateu: sem alvo ao alcance, o golpe sai
    // assim que chegar nele, não 2s depois.
    // "Velocidade de ataque" (afixo): o intervalo encurta nessa %. "Tempo entre
    // golpes" (árvore) mexe no próprio intervalo: −3% é 3% mais curto.
    if (golpe.bateu) {
      const f = Ficha.combate(estado);
      hunt.proximoGolpeEm = agora + Math.round(f.intervaloDoGolpeMs * Controle.fatorDeLentidao(hunt));
    }
  }
  if (estado.hp > 0) eventos.push(...golpesDosMonstros(estado, hunt, personagem));
  // O que os encontros abriram neste tique (loot de baú, falas): vai junto com os eventos da caçada.
  eventos.push(...EventosDeEncontro.tirar(hunt));
  // As mecânicas dos mobs no tempo: enrage na vida baixa, aura de dano e o veneno dos golpes (`mobs/mecanicas.mjs`).
  Mecanicas.tique(estado, hunt, personagem, eventos);
  // O veneno da Raiz venenosa (druid), um pulso por segundo.
  Arvore.tique(estado, hunt, eventos);
  // Os bichos QUEIMANDO (support Ignite): o dano que falta, em pulsos.
  Estados.tique(hunt, eventos, agora);
  processarMortes(estado, personagem, eventos);

  const usaBarra = hunt.modo !== 'online' || hunt.autoBarra !== false;
  if (usaBarra && livre && estado.hp > 0) eventos.push(...autoDisparo(estado, hunt, personagem));
  if (hunt.summon) eventos.push(...tiqueDoFamiliar(estado, hunt, personagem, grade, agora));

  anotarDano(hunt.sessao, eventos);
  autoVenda(estado, hunt);

  return eventos;
}

/**
 * O passo do familiar — SEM teleporte, tile por tile, pela BFS de sempre (contorna parede e bicho, usa diagonal quando precisa; nunca pisa na casa do dono nem na de um bicho).
 * `ate` é o ponto a alcançar (o dono, no follow; o alvo, no combate) e `pararEm(d)` diz quando já chegou perto o bastante. Anda 1 casa por passo (`PASSO_MS`), até 2 por tique
 * quando está longe (`longe`). Sem rota: espera um pouco e tenta de novo, e devolve `false` (quem chama decide o que fazer — nunca aparece do lado de ninguém por isso).
 * Devolve `true` se deu pelo menos um passo ou já está onde queria.
 */
const ESPERA_SEM_ROTA_MS = 1500;
function passoDoFamiliar(hunt, grade, f, agora, ate, { pararEm, longe = 3 }) {
  const d = distancia(f, ate);
  const emCimaDoDono = f.x === hunt.pos.x && f.y === hunt.pos.y;
  if (!emCimaDoDono && pararEm(d, f.andando)) {
    f.andando = false;
    f.moveMs = R.PASSO_MS;
    return true;
  }
  if (!R.jaPode(agora, f.proximoPassoEm)) return true;
  if (!R.jaPode(agora, f.semRotaAte)) return false;
  const bichos = new Set(hunt.monstros.filter((b) => b.hp > 0).map((b) => `${b.x},${b.y}`));
  const bloqueadas = new Set([...bichos, `${hunt.pos.x},${hunt.pos.y}`]);
  const ocupado = (c) => bloqueadas.has(`${c.x},${c.y}`);
  const passos = d > longe ? 2 : 1;
  let deu = 0;
  for (let k = 0; k < passos; k++) {
    let destino;
    if (f.x === hunt.pos.x && f.y === hunt.pos.y) {
      // Em cima do dono: uma casa livre do lado dele (um passo de verdade, de uma casa).
      destino = [[-1, 0], [1, 0], [0, 1], [0, -1], [-1, 1], [1, 1], [-1, -1], [1, -1]].map(([dx, dy]) => ({ x: f.x + dx, y: f.y + dy })).find((c) => grade.andavel.has(`${c.x},${c.y}`) && !ocupado(c));
    } else {
      destino = proximoPassoAte(grade, f, ate, ocupado, bloqueadas);
    }
    if (!destino) break;
    f.dir = destino.y < f.y ? 0 : destino.y > f.y ? 2 : destino.x > f.x ? 1 : 3;
    f.x = destino.x;
    f.y = destino.y;
    deu++;
    f.andando = true;
    if (pararEm(distancia(f, ate), true)) break;
  }
  if (!deu) {
    f.semRotaAte = agora + ESPERA_SEM_ROTA_MS;
    f.andando = false;
    return false;
  }
  f.moveMs = Math.round(R.PASSO_MS / deu);
  f.proximoPassoEm = agora + R.PASSO_MS;
  return true;
}

/** O follow: acompanha o dono, começando a andar passando de `perto` casas e parando uma casa antes (histerese). */
const andarFamiliar = (hunt, grade, f, agora) => passoDoFamiliar(hunt, grade, f, agora, hunt.pos, { pararEm: (d, andando) => (andando ? d <= Math.max(1, f.perto - 1) : d <= f.perto), longe: f.perto + 3 });

/** Quanto além de `perto` o familiar se afasta do dono para combater (o limite de perseguição): passou disso, volta a seguir. */
const FOLGA_DO_COMBATE = 5;
/** Depois de largar um alvo por falta de rota ou de coleira, quanto tempo ele não volta a tentar o mesmo. */
const ESQUECE_ALVO_MS = 3000;

/**
 * O alvo do familiar: (1) o alvo do DONO, se está no alcance de combate (assistência); (2) senão o bicho vivo mais PERTO DELE dentro do raio de combate ao redor do dono
 * (agressivo: ele adquire sozinho, sem o dono bater primeiro). Fora de lure não há combate. Alvos que ele largou há pouco (sem rota, coleira) ficam de fora por `ESQUECE_ALVO_MS`.
 */
/** Marca o alvo como "esquecido" por uns segundos; poda os vencidos (o estado vai para o JSON do banco — não pode crescer). */
function esquecerAlvo(f, alvo, agora) {
  const novo = {};
  if (f.esquecidos && typeof f.esquecidos === 'object') for (const [k, ate] of Object.entries(f.esquecidos)) if (ate > agora) novo[k] = ate;
  novo[alvo.uid] = agora + ESQUECE_ALVO_MS;
  f.esquecidos = novo;
}

function alvoDoFamiliar(hunt, f, agora) {
  if (hunt.lurando) return null;
  const raio = f.perto + FOLGA_DO_COMBATE;
  const ok = (m) => m && m.hp > 0 && distancia(m, hunt.pos) <= raio && !((f.esquecidos?.[m.uid] ?? 0) > agora);
  const doDono = alvoAtual(hunt);
  if (ok(doDono)) return doDono;
  let melhor = null;
  let menor = Infinity;
  for (const m of hunt.monstros) {
    if (m.dummy || !ok(m)) continue;
    const d = distancia(m, f);
    if (d < menor) {
      menor = d;
      melhor = m;
    }
  }
  return melhor;
}

/*
 * ---- O familiar em campo ----
 *
 * Acompanha o dono ANDANDO: passou de `perto` casas, caminha tile por tile até ele
 * (`andarFamiliar`). A cada 2s (o golpe da caçada) bate em TODO bicho a até `alcance` casas
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
  /*
   * ---- A IA do familiar (dono, 03/10): combate e follow, sem um atrapalhar o outro ----
   *   1. Tem alvo (o do dono, ou um bicho perto dele)? Combate: aproxima até o `alcanceDeAtaque` pela BFS e bate; não faz ajuste de follow no meio do combate.
   *   2. Sem rota até o alvo, ou ele ficou longe do dono demais: larga o alvo por uns segundos (não repete a tentativa a cada tique) e volta ao follow.
   *   3. Sem alvo: acompanha o dono.
   * O golpe segue sendo o de sempre (`Summon.fracao` do golpe do dono, em volta do alvo) — o familiar não tem habilidades próprias —, mas só sai com o alvo ao alcance.
   */
  const alcanceDeAtaque = f.alcanceDeAtaque ?? Summon.familiarDe(estado).alcanceDeAtaque ?? 1;
  const alvo = alvoDoFamiliar(hunt, f, agora);
  if (!alvo) {
    andarFamiliar(hunt, grade, f, agora);
    return eventos;
  }
  if (distancia(f, hunt.pos) > f.perto + FOLGA_DO_COMBATE + 1) {
    // Perseguiu demais: o limite é do dono — esquece o alvo um instante e volta.
    esquecerAlvo(f, alvo, agora);
    andarFamiliar(hunt, grade, f, agora);
    return eventos;
  }
  if (distancia(f, alvo) > alcanceDeAtaque) {
    const chegou = passoDoFamiliar(hunt, grade, f, agora, alvo, { pararEm: (d) => d <= alcanceDeAtaque, longe: alcanceDeAtaque + 3 });
    if (!chegou) {
      esquecerAlvo(f, alvo, agora); // sem rota: tenta outro, e não este por uns segundos
      return eventos;
    }
    if (distancia(f, alvo) > alcanceDeAtaque) return eventos; // ainda a caminho
  }
  if (!R.jaPode(agora, f.proximoGolpe)) return eventos;
  f.proximoGolpe = agora + ATAQUE_MS;
  f.dir = alvo.y < f.y ? 0 : alvo.y > f.y ? 2 : alvo.x > f.x ? 1 : 3;
  // "25% do seu golpe": o golpe médio do dono agora (arma, wand ou punho).
  const arma = armaDoPersonagem(estado);
  const ficha = Ficha.combate(estado);
  // Com o ATAQUE DA FICHA (ATK e ATK% dos atributos), não o do catálogo da arma;
  // e o "Dano de <elemento>" do elemento do familiar (auditoria, 29/09).
  const doDono = (arma?.wand ? (arma.wand.min + arma.wand.max) / 2 : R.golpeDoJogador({ ...arma, attack: ficha.ataque, attackMin: ficha.ataqueMin, attackMax: ficha.ataqueMax }, ficha.skillValue, estado.level)) * (1 + (ficha.danoDoElemento?.[f.elemento] ?? 0) / 100);
  const cor = Acoes.COR_DO_ELEMENTO[f.elemento] ?? '#ff0000';
  const sessao = hunt.sessao;
  for (const bicho of hunt.monstros) {
    if (bicho.hp <= 0 || distancia(bicho, alvo) > f.alcance) continue;
    // E a resistência do bicho ao elemento do familiar (`resistido`).
    if (resistenciaEfetivaDe(hunt, bicho, f.elemento ?? 'physical', ficha) >= 100) continue; // imune: nada passa
    const dano = Math.max(1, Math.round(resistido(hunt, bicho, f.elemento ?? 'physical', doDono * Summon.fracao(estado) * (0.85 + Math.random() * 0.3), ficha)));
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
  // No pátio o personagem fica no posto: movimento pedido é recusado.
  if (estado.hunt.huntId === 'treino') {
    estado.hunt.rumo = null;
    estado.hunt.destino = null;
    return { ok: false, erro: 'Treinando: você fica ao lado do boneco até parar o treino.' };
  }
  // A tecla manda mais que o clique: apertou uma direção, larga o destino.
  if (dx || dy) estado.hunt.destino = null;
  if (!dx && !dy) {
    estado.hunt.rumo = null;
    return;
  }
  estado.hunt.rumo = { dx: Math.sign(dx), dy: Math.sign(dy) };
  estado.hunt.rumoValidoAte = Date.now() + 500;
}

/*
 * ---- `send({t:'huntWalkTo', x, y})` — clique ou toque no mapa da Caça Online ----
 *
 * O client mandava (clique esquerdo no desktop, toque no chão no celular, "Ir
 * até lá" no menu) e não havia handler: o clique não andava. Aqui só se VALIDA
 * e guarda o destino (`hunt.destino`); quem anda é o `tique`, pelo mesmo passo
 * manual do `huntWalk` — um passo por `PASSO_MS`, o próximo sempre pedido à
 * busca de sempre (`proximoPassoAte`, ver `passoDoClique`), contornando parede
 * e bicho. Vale a casa andável ou uma escada/rampa (pisar nela muda de andar,
 * como no teclado). Só na Caça Online: na Automática quem anda é a rota.
 */
export function andarAte(estado, { x, y }) {
  const hunt = estado?.hunt;
  if (!hunt) return { ok: true };
  const destino = { x: Math.trunc(Number(x)), y: Math.trunc(Number(y)) };
  if (!Number.isFinite(destino.x) || !Number.isFinite(destino.y)) return { ok: true };
  if (hunt.huntId === 'treino') {
    hunt.destino = null;
    return { ok: false, erro: 'Treinando: você fica ao lado do boneco até parar o treino.' };
  }
  if (hunt.modo !== 'online') return { ok: false, erro: 'Na Caça Automática quem anda é a rota.' };
  if (destino.x === hunt.pos.x && destino.y === hunt.pos.y) {
    hunt.destino = null;
    return { ok: true };
  }
  const grade = andarDaGrade(gradeDaHunt(huntOuMapaCustom(hunt.huntId)), hunt.z);
  const escada = grade.mapa?.floors && destinoDaMudanca(grade.mapa, hunt.z, destino.x, destino.y);
  if ((!grade.andavel.has(`${destino.x},${destino.y}`) && !escada) || !temCaminho(grade, hunt.pos, destino)) {
    hunt.destino = null;
    return { ok: false, erro: 'Não dá para chegar lá.' };
  }
  hunt.rumo = null;
  hunt.destino = { ...destino, z: hunt.z };
  return { ok: true };
}

/**
 * O passo `{dx, dy}` rumo ao destino do clique (ou `null`, e o destino some:
 * chegou, mudou de andar, o caminho fechou). Recalculado a cada passo porque
 * os bichos andam — o mesmo `proximoPassoAte`, contornando os vivos.
 */
function passoDoClique(hunt, grade) {
  const d = hunt.destino;
  if (!d) return null;
  if (hunt.modo !== 'online' || d.z !== hunt.z || (d.x === hunt.pos.x && d.y === hunt.pos.y)) {
    hunt.destino = null;
    return null;
  }
  const casasDeBicho = new Set(hunt.monstros.filter((b) => b.hp > 0).map((b) => `${b.x},${b.y}`));
  const passo = proximoPassoAte(grade, hunt.pos, d, (c) => casasDeBicho.has(`${c.x},${c.y}`), casasDeBicho);
  if (!passo) {
    hunt.destino = null;
    return null;
  }
  return { dx: passo.x - hunt.pos.x, dy: passo.y - hunt.pos.y };
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
  if (hunt.huntId === 'treino') return { ok: false, erro: 'Treinando: você fica ao lado do boneco até parar o treino.' };
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
    // A duração do passo na tela acompanha a velocidade (ver `passosDoTique`).
    player: { x: hunt.pos.x, y: hunt.pos.y, dir: hunt.pos.dir, moveMs: Math.round(R.PASSO_MS / razaoDeVelocidade(estado)), ...(Controle.ativosNoJogador(hunt).length ? { controle: Controle.ativosNoJogador(hunt) } : {}), ...(estadosDoJogador(hunt).length ? { estados: estadosDoJogador(hunt) } : {}) },
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
      // O level do mob (ao lado do nome) e a raridade + os modificadores (a cor do nome e a linha de baixo).
      nivel: Atributos.levelDoBicho(hunt, m),
      ...Raridade.paraCliente(m),
      // Congelado / atordoado / lento / queimando: o cliente mostra um ícone de cada (só quando há).
      ...(m.estados ? ((a) => (a.length ? { estados: a } : {}))(Estados.ativosDe(m, hunt.clock ?? 0)) : {}),
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
      ? { uid: hunt.summon.uid, x: hunt.summon.x, y: hunt.summon.y, dir: hunt.summon.dir, look: hunt.summon.look, name: hunt.summon.name, nivel: hunt.summon.nivel, moveMs: hunt.summon.moveMs ?? R.PASSO_MS }
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
    // A fase da campanha e o progresso nela (a barra "312 / 500" da tela).
    fase: Campanha.faseAtual(estado, hunt),
    // A instância (quantos bichos, quantos restam, CLEAR): a barra da fase.
    instancia: Instancia.paraCliente(hunt),
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
    // Por que cada slot não saiu, e o ✔/✖ de cada condição agora (o balão do slot e o editor).
    parados: Acoes.paradosParaCliente(hunt),
    condicoesAgora: Acoes.condicoesParaCliente(estado, hunt, alvoAtual(hunt)),
  };
}


