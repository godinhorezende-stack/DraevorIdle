// A CAMPANHA — as 48 hunts normais em 4 atos (12 fases cada), jogadas em
// Fácil, depois Médio, depois Difícil, como o Normal/Cruel/Merciless do Path of
// Exile. Configuração em `gamedata/campanha.json`.
//
// Regras (decididas com o dono, uma a uma):
//   - completar uma fase = LIMPAR uma instância dela (todos os bichos mortos,
//     sem respawn — ver `hunt/instancia.mjs`); libera a seguinte;
//   - para entrar, só o PROGRESSO conta (não o level do personagem);
//   - a limpeza na caçada offline conta; offline ele fica sempre na mesma hunt;
//   - na party, qualquer um entra, e a limpeza conta para todos da sala;
//   - fim de cada ato: um boss, que abre com as 12 fases completas; a PRIMEIRA
//     vitória (sem task nem recarga) libera o ato seguinte — e a do Ato 4, a
//     dificuldade seguinte;
//   - fase travada (`pular`: hunt quebrada ou fechada pelo dono) NÃO se entra, e conta como completa sozinha;
//   - os bichos de cada fase são escalados do level original da hunt para o
//     level alvo da fase naquela dificuldade (`escalaDaFase`).
//
// O progresso fica no personagem: `estado.campanha[dificuldade] = { limpezas:
// {huntId: n}, completas: [huntId], bosses: [ato] }` (`kills` é do sistema de
// antes, por contagem de mortes: fica gravado, ninguém mais lê).
import { readFileSync } from 'node:fs';
import { conteudoDaFase, exigidasDaFase, nomesDeBosses, atosDoConteudo, registrarConteudo, registrarMetaDeAto } from './campanha-conteudo.mjs';
import { CATALOGO, ITEM_CATALOG } from './dados.mjs';
import * as Beta from './modo-beta.mjs';
import { validarAto, temErro, fasesAbertas, normalizar } from './atos-modelo.mjs';
import { lerExecutaveis } from './atos-carregar.mjs';
import * as RecompensasDeEncontro from './encontros/recompensas.mjs';
import { ligado as itensPoeLigado } from './itens-poe/catalogo.mjs';
import * as MissoesDeGemas from './itens-poe/missoes-de-gemas.mjs';

/*
 * Com o sistema de itens do PoE ligado (ITENS_POE=1, só local), a campanha é a do PoE (decisão do dono, 05/10): os 4 atos do Draevor saem
 * (fases e bosses vazios) e os 10 atos do PoE entram como atos do runtime (`itens-poe/campanha.mjs` → `registrarAto`).
 */
// `DRAEVOR_CAMPANHA`: caminho de outro arquivo no formato desta campanha — só para os testes provarem que o que o editor grava é o que o jogo lê.
const LIDA = JSON.parse(readFileSync(process.env.DRAEVOR_CAMPANHA || new URL('../gamedata/campanha.json', import.meta.url), 'utf8'));
// A campanha do PoE é uma passada só, do nível 1 ao 69: a faixa do Normal diz isso (Cruel e Merciless ficam fechados).
export const CAMPANHA = itensPoeLigado() ? { ...LIDA, fases: [], bosses: {}, dificuldades: { ...LIDA.dificuldades, facil: { ...LIDA.dificuldades.facil, faixa: [1, 69] } } } : LIDA;
export const DIFICULDADES = Object.keys(CAMPANHA.dificuldades);
/** As dificuldades que EXISTEM para o jogador (a tela): no jogo oficial só o Normal — o Cruel e o Merciless não existem mais no PoE (dono,
 * 10/10: "tire ali cruel e merciless que n existe mais"); no clássico, as três. */
export const dificuldadesDoJogo = () => (itensPoeLigado() ? DIFICULDADES.slice(0, 1) : DIFICULDADES);
export const FASES = CAMPANHA.fases;
const INDICE = new Map(FASES.map((f, i) => [f.huntId, i]));
const FASES_POR_ATO = 12;
export const ATOS = Math.ceil(FASES.length / FASES_POR_ATO);

/** A fase de uma hunt (`null` se ela não é da campanha: boss, VIP, sala gerada...). */
export const faseDe = (huntId) => (INDICE.has(huntId) ? { ...FASES[INDICE.get(huntId)], indice: INDICE.get(huntId) } : null);
/** O número da fase DENTRO do ato — a ordem dela no ato, a do mapa da campanha ("Ato 2 · Fase 3"); a posição na campanha inteira é o
 * `numero` de `faseAtual`. `null` se a hunt não é da campanha. */
export const numeroNoAto = (huntId) => {
  const f = faseDe(huntId);
  return f ? FASES.slice(0, f.indice + 1).filter((x) => x.ato === f.ato).length : null;
};
/** O boss que fecha um ato (`{bossId, nome, nivel}`), e o ato de um boss (`null` se não fecha nenhum). */
export const bossDoAto = (ato) => CAMPANHA.bosses[String(ato)] ?? null;
export const atoDoBoss = (bossId) => Number(Object.entries(CAMPANHA.bosses).find(([, b]) => b.bossId === bossId)?.[0]) || null;

/** O boss é o que fecha algum ato? (esses NÃO têm recarga: entra-se quantas vezes quiser) */
export const ehBossDeAto = (bossId) => atoDoBoss(bossId) != null;

/*
 * ---- Boss de fim de ato: SEM recarga e SEM espera (03/10, decisão do dono) ----
 * O catálogo capturado do jogo original traz `cooldownHours` (12 h; 72 h no The Primal Menace) para todo boss. Os que fecham um ato
 * perdem a recarga: o catálogo (que também vai para o cliente) passa a dizer `cooldownHours: 0` e `semEspera: true`, e o servidor
 * ainda ignora recarga desses bosses em `Cacadas.entrar`/`Bosses.marcarEntrada`/Auto Boss (cinto e suspensório: o catálogo é só o aviso).
 * Os outros bosses (de task, de Instance/Divine...) seguem com a recarga real deles.
 */
for (const { bossId } of Object.values(CAMPANHA.bosses)) {
  for (const lista of [CATALOGO.bosses, CATALOGO.hunts]) {
    for (const e of lista ?? []) {
      if (e.id === bossId || e.id === `${bossId}-online`) {
        e.cooldownHours = 0;
        e.semEspera = true;
      }
    }
  }
}

/** A última fase JOGÁVEL do ato (as `pular` não se entram): a que, ao ser concluída, abre o portal do boss. */
export const ultimaFaseDoAto = (ato) => {
  const g = ATOS_DO_EDITOR.get(Number(ato));
  if (g) return FASES.find((f) => f.grafo?.atoId === g.ato.id && f.grafo.faseId === g.ato.bossFinal?.faseAnterior) ?? null;
  return FASES.filter((f) => f.ato === Number(ato) && !f.pular).at(-1) ?? null;
};
export const ehUltimaFaseDoAto = (huntId) => {
  const f = faseDe(huntId);
  return !!f && ultimaFaseDoAto(f.ato)?.huntId === huntId;
};

const ehDificuldade = (d) => DIFICULDADES.includes(d);
function progresso(estado, dif) {
  estado.campanha ??= {};
  const p = (estado.campanha[dif] ??= {});
  p.limpezas ??= {};
  p.completas ??= [];
  p.bosses ??= [];
  p.premios ??= []; // chaves dos prêmios de PRIMEIRA vez já pagos (`fase:<huntId>`, `boss:<ato>`): nunca pagam duas vezes
  return p;
}

/** A fase conta como completa (matou os X, ou é uma hunt quebrada que se pula)? */
export function faseCompleta(estado, dif, huntId) {
  const f = faseDe(huntId);
  if (!f) return false;
  return !!f.pular || progresso(estado, dif).completas.includes(huntId);
}

export const bossVencido = (estado, dif, ato) => progresso(estado, dif).bosses.includes(Number(ato));

/** A dificuldade está aberta? Fácil sempre; a seguinte, depois do boss do último ato da anterior. */
export function dificuldadeLiberada(estado, dif) {
  const i = DIFICULDADES.indexOf(dif);
  if (i <= 0) return i === 0;
  return bossVencido(estado, DIFICULDADES[i - 1], ATOS);
}

/** Pode entrar nesta fase, nesta dificuldade? */
export function faseLiberada(estado, dif, huntId) {
  const f = faseDe(huntId);
  if (!f || !ehDificuldade(dif) || !dificuldadeLiberada(estado, dif)) return false;
  // Fase travada (`pular`): ninguém entra — nem pelo cliente, nem mandando o `startHunt` na mão.
  if (f.pular) return false;
  if (f.grafo) return liberadaNoGrafo(estado, dif, f);
  if (f.indice === 0) return true;
  // A primeira fase de um ato pede o boss do ato anterior.
  if (f.indice % FASES_POR_ATO === 0 && !bossVencido(estado, dif, f.ato - 1)) return false;
  if (primeiraIncompleta(estado, dif, f)) return false;
  // Requisitos de entrada do conteúdo (editor): fases que precisam estar completas além da cadeia do ato.
  return exigidasDaFase(huntId).every((id) => faseCompleta(estado, dif, id));
}

/**
 * A primeira fase do ATO, antes desta, que ainda não está completa (a travada conta como completa) — ou
 * `null`. A liberação olha a CADEIA inteira, e não só a fase de trás: com a party, uma fase pode ficar
 * "completa" (a limpeza conta para todos da sala) sem a anterior estar — e olhando só a de trás, essa
 * marca abria a seguinte, que abria a seguinte... (uma fase aberta no meio do ato, com a 6 por fazer).
 */
export function primeiraIncompleta(estado, dif, f) {
  const inicio = f.indice - (f.indice % FASES_POR_ATO);
  for (let k = inicio; k < f.indice; k++) if (!faseCompleta(estado, dif, FASES[k].huntId)) return FASES[k];
  return null;
}

/**
 * A fase que precisa estar completa para abrir esta: a anterior — mas a travada (`pular`) conta como
 * completa SOZINHA, então ela não pode ser o elo: com ela como exigência, quem nunca jogou o ato
 * entrava direto na fase depois dela (foi assim que a Infernatil Seal abria no começo). Anda para
 * trás até a primeira que não é travada. `null` = nada antes dela no ato.
 */
export function faseExigida(f) {
  let k = f.indice - 1;
  while (k >= 0 && FASES[k].ato === f.ato && FASES[k].pular) k--;
  return k >= 0 && FASES[k].ato === f.ato ? FASES[k] : null;
}

/** O boss do ato está aberto? (as 12 fases dele completas, na dificuldade) */
export function bossLiberado(estado, dif, ato) {
  if (!ehDificuldade(dif) || !dificuldadeLiberada(estado, dif)) return false;
  const g = ATOS_DO_EDITOR.get(Number(ato));
  if (g) return atoAtivo(Number(ato)) && portaoDoAtoAberto(estado, dif, g) && g.ato.fases.filter((f) => f.obrigatoria).every((f) => faseCompleta(estado, dif, f.huntId));
  return FASES.filter((f) => f.ato === Number(ato)).every((f) => faseCompleta(estado, dif, f.huntId));
}

/** Por que não dá para entrar (`null` = pode). */
export function motivoParaNaoEntrar(estado, dif, huntId) {
  const f = faseDe(huntId);
  if (!f) return null;
  if (!ehDificuldade(dif)) return 'Dificuldade inválida.';
  const nomeDif = CAMPANHA.dificuldades[dif].nome;
  // No jogo oficial a campanha do PoE é uma passada só (o Normal): o Cruel e o Merciless não abrem — e não há "boss do Ato N" do Draevor a citar.
  if (!dificuldadeLiberada(estado, dif)) return itensPoeLigado() ? `A campanha do PoE é uma passada só, no ${CAMPANHA.dificuldades[DIFICULDADES[0]].nome}: o ${nomeDif} não abre.` : `O ${nomeDif} abre depois de vencer o boss do Ato ${ATOS} na dificuldade anterior.`;
  if (f.pular) return `${f.nome} está travada (em obras) e não abre por enquanto.`;
  if (faseLiberada(estado, dif, huntId)) return null;
  if (f.grafo) return motivoNoGrafo(estado, dif, f, nomeDif);
  if (f.indice % FASES_POR_ATO === 0 && !bossVencido(estado, dif, f.ato - 1)) return `Derrote o boss do Ato ${f.ato - 1} (${bossDoAto(f.ato - 1)?.nome}) no ${nomeDif} para abrir o Ato ${f.ato}.`;
  const faltando = exigidasDaFase(huntId).find((id) => !faseCompleta(estado, dif, id));
  if (faltando && !primeiraIncompleta(estado, dif, f)) return `Complete antes ${faseDe(faltando)?.nome ?? faltando} no ${nomeDif} para abrir esta.`;
  return `Complete a fase anterior (${(primeiraIncompleta(estado, dif, f) ?? FASES[f.indice - 1]).nome}) no ${nomeDif} para abrir esta.`;
}

/*
 * ---- A força dos bichos na fase ----
 * Multiplicador = (level alvo / level original) ^ expoente, para vida, dano e
 * exp. Troll Cave no Difícil (level alvo 601, troll de level 8): bem mais forte;
 * Walking Pillar no Fácil (alvo 100, original 1200): bem mais fraca.
 */
export function escala(levelOriginal, levelAlvo) {
  const e = CAMPANHA.escala;
  const r = Math.max(1, levelAlvo) / Math.max(1, levelOriginal);
  const f = (exp) => Math.max(e.minimo ?? 0, Math.pow(r, exp));
  return { vida: f(e.vida), dano: f(e.dano), exp: f(e.exp), nivel: levelAlvo };
}

export function escalaDaFase(huntId, dif) {
  const f = faseDe(huntId);
  return f && ehDificuldade(dif) ? escala(f.levelOriginal, f.nivel[dif]) : null;
}

export function escalaDoBoss(ato, dif) {
  const b = bossDoAto(ato);
  return b && ehDificuldade(dif) ? escala(b.levelOriginal, b.nivel[dif]) : null;
}

/** Aplica a escala num bicho recém-criado (vida, dano via `forca`, exp). No lugar. */
export function aplicarEscala(m, esc) {
  if (!m || !esc) return m;
  m.maxHp = Math.max(1, Math.round((m.maxHp ?? m.hp) * esc.vida));
  m.hp = m.maxHp;
  m.exp = Math.max(0, Math.round((m.exp ?? 0) * esc.exp));
  m.forca = (m.forca ?? 1) * esc.dano;
  return m;
}

/**
 * A instância da fase foi LIMPA (todos os bichos mortos): conta a limpeza e,
 * na primeira, completa a fase e libera a seguinte. Vale para quem estava na
 * sala (ver `hunt/instancia.mjs`). Devolve o aviso "Hunt Clear!" da tela.
 */
export function limpou(estado, hunt) {
  const c = hunt?.campanha;
  if (!c || c.bossDoAto) return null;
  const f = faseDe(c.huntId);
  if (!f || f.pular) return null;
  const p = progresso(estado, c.dificuldade);
  p.limpezas[f.huntId] = (p.limpezas[f.huntId] ?? 0) + 1;
  const nomeDif = CAMPANHA.dificuldades[c.dificuldade].nome;
  let aviso;
  const abriuOPortal = ehUltimaFaseDoAto(f.huntId) && bossLiberado(estado, c.dificuldade, f.ato);
  const conc = conclusaoDa(f.huntId);
  if (p.completas.includes(f.huntId)) {
    aviso = abriuOPortal ? `Hunt Clear! ${f.nome} (${nomeDif}) limpa. O portal do boss ${bossDoAto(f.ato)?.nome} está aberto: entre quando quiser.` : `Hunt Clear! ${f.nome} (${nomeDif}) limpa.`;
  } else if (conc.tipo !== 'limpar-hunt') {
    // A fase conclui por outro objetivo (matar o chefe, N monstros, o item da missão): limpar conta a limpeza, mas não conclui.
    aviso = `Hunt Clear! ${f.nome} (${nomeDif}) limpa. Para concluir: ${objetivoEmTexto(conc)}.`;
  } else {
    aviso = `Hunt Clear! ${completar(estado, c.dificuldade, f)}`;
  }
  estado.avisoDaHunt = aviso;
  return aviso;
}

/** Completa a fase (a primeira vez) e devolve o aviso da tela. */
function completar(estado, dif, f) {
  const p = progresso(estado, dif);
  if (!p.completas.includes(f.huntId)) p.completas.push(f.huntId);
  const nomeDif = CAMPANHA.dificuldades[dif].nome;
  const proxima = FASES[f.indice + 1];
  // As missões do PoE que terminam nesta fase (a gema de recompensa para escolher — `itens-poe/missoes-de-gemas.mjs`).
  const daMissao = MissoesDeGemas.aoCompletarFase(estado, f.huntId);
  return (proxima && proxima.ato === f.ato
    ? `Fase completa: ${f.nome} (${nomeDif}). Liberou ${proxima.nome}.`
    : chefeDoAtoNaFase()
      ? `Fase completa: ${f.nome} (${nomeDif}). Um portal se abre: ${bossDoAto(f.ato)?.nome}, o chefe do Ato ${f.ato}, está chegando!`
      : `Fase completa: ${f.nome} (${nomeDif}). O boss do Ato ${f.ato} (${bossDoAto(f.ato)?.nome}) está liberado: o portal do boss se abriu — entre quando quiser, sem espera.`) + daMissao;
}

// ---- A CONCLUSÃO da fase por objetivo (atos do editor): matar o chefe, matar N, o item da missão (`atos-modelo.TIPOS_DE_CONCLUSAO`).
/** Como a fase conclui (`{ tipo, monstro?, quantidade?, item? }`); fase legada: limpar a hunt. */
export function conclusaoDa(huntId) {
  const f = faseDe(huntId);
  const g = f?.grafo ? ATOS_DO_EDITOR.get(f.ato) : null;
  return g?.ato.fases.find((x) => x.id === f.grafo.faseId)?.conclusao ?? { tipo: 'limpar-hunt' };
}

/*
 * ---- O chefe do ATO enfrentado na fase (dono, 08/10: "Kitava na fase encerra o ato") ----
 * A fase que conclui matando o próprio chefe do ato (o Telhado da Catedral pede o Kitava, o chefe do Ato 5): ele nasce na fase (como todo
 * chefe de fase — `Instancia.chefeNaInstancia`), e matá-lo conclui a fase E vence o chefe do ato — o ato seguinte abre, sem a luta na sala
 * do chefe (o portal dela não abre). Antes a fase pedia um monstro que só existia na sala, e o ato travava.
 */
/** O número do ato cujo chefe a fase `huntId` pede na conclusão; null se ela pede outro monstro (ou nenhum). */
export function atoDoChefeNaFase(huntId) {
  const f = faseDe(huntId);
  const conc = f ? conclusaoDa(huntId) : null;
  if (conc?.tipo !== 'matar-chefe') return null;
  const doAto = bossDoAto(f.ato)?.nome;
  return doAto && String(conc.nome ?? '').trim().toLowerCase() === String(doAto).trim().toLowerCase() ? f.ato : null;
}
const slugDoMonstro = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/** O bicho morto é o monstro do objetivo? (a chave do bestiário, ou o slug do monstro do PoE — `poe-<slug>-<nível>`) */
export const ehOMonstro = (key, alvo) => !!alvo && (key === alvo || String(key ?? '').startsWith(`poe-${slugDoMonstro(alvo)}-`));
const nomeDoMonstro = (alvo) => String(alvo ?? '').replace(/_/g, ' ');
/** O objetivo em texto (aviso e painel). */
export function objetivoEmTexto(conc) {
  if (conc.tipo === 'matar-chefe') return `matar ${conc.nome ?? nomeDoMonstro(conc.monstro)}`;
  if (conc.tipo === 'matar-n') return `matar ${conc.quantidade} ${conc.monstro ? conc.nome ?? nomeDoMonstro(conc.monstro) : 'monstros'}`;
  if (conc.tipo === 'item-de-missao') return `pegar ${ITEM_CATALOG[conc.item]?.name ?? 'o item da missão'} de ${conc.nome ?? nomeDoMonstro(conc.monstro)}`;
  return 'limpar a área';
}
/** O progresso do objetivo `{ feito, total }` (o painel da fase). */
export function progressoDoObjetivo(estado, dif, huntId) {
  const conc = conclusaoDa(huntId);
  const p = progresso(estado, dif);
  if (conc.tipo === 'matar-n') return { feito: Math.min(conc.quantidade, p.mortes?.[huntId] ?? 0), total: conc.quantidade };
  return { feito: p.completas.includes(huntId) ? 1 : 0, total: 1 };
}

/**
 * Um bicho morreu numa fase da campanha: conta para o objetivo da fase e conclui quando ele se cumpre. `ganhou`: os itens que caíram
 * nesta morte (`{id}`); `dar(id)`: põe um item na bolsa (o item da missão, quando a tabela de drop do monstro não o soltou). Devolve o
 * aviso quando a fase concluiu, senão null.
 */
export function matou(estado, hunt, bicho, { ganhou = [], dar = null } = {}) {
  const c = hunt?.campanha;
  if (!c || c.bossDoAto) return null;
  const f = faseDe(c.huntId);
  if (!f || f.pular) return null;
  const conc = conclusaoDa(f.huntId);
  if (conc.tipo === 'limpar-hunt') return null;
  const p = progresso(estado, c.dificuldade);
  if (p.completas.includes(f.huntId)) return null;
  const doAlvo = !conc.monstro || ehOMonstro(bicho?.key, conc.monstro);
  if (!doAlvo) return null;
  if (conc.tipo === 'matar-n') {
    p.mortes ??= {};
    p.mortes[f.huntId] = (p.mortes[f.huntId] ?? 0) + 1;
    if (p.mortes[f.huntId] < conc.quantidade) return null;
  }
  if (conc.tipo === 'item-de-missao') {
    const veio = ganhou.some((g) => Number(g.id) === Number(conc.item));
    if (!veio && !(dar && dar(Number(conc.item)))) return null;
  }
  const aviso = completar(estado, c.dificuldade, f);
  // O chefe do ato morto na fase: vence o ato também (`atoDoChefeNaFase`).
  const doAto = conc.tipo === 'matar-chefe' && atoDoChefeNaFase(f.huntId) ? venceuBoss(estado, c.dificuldade, f.ato) : null;
  estado.avisoDaHunt = [aviso, doAto].filter(Boolean).join(' ');
  return estado.avisoDaHunt;
}

/** O que fazer ao completar uma fase: `'repetir'` (fica em loop nela, o padrão) ou `'seguir'`. */
export const AO_COMPLETAR = ['repetir', 'seguir'];
export const aoCompletar = (estado) => (AO_COMPLETAR.includes(estado.settings?.aoCompletarFase) ? estado.settings.aoCompletarFase : 'repetir');

/**
 * A fase seguinte para quem escolheu "Seguir": a próxima do MESMO ato que não
 * se pula e já está liberada. No fim do ato não segue: o boss é uma luta, não
 * uma fase — o aviso da tela diz que ele abriu. `null` = fica onde está.
 */
export function proximaParaSeguir(estado, dif, huntId) {
  const f = faseDe(huntId);
  if (!f) return null;
  if (f.grafo) return proximaNoGrafo(estado, dif, f);
  for (let i = f.indice + 1; i < FASES.length && FASES[i].ato === f.ato; i++) {
    if (FASES[i].pular) continue;
    return faseLiberada(estado, dif, FASES[i].huntId) ? FASES[i] : null;
  }
  return null;
}

/** O boss do ato caiu: a primeira vitória libera o ato seguinte (ou a dificuldade seguinte). */
export function venceuBoss(estado, dif, ato) {
  const p = progresso(estado, dif);
  if (p.bosses.includes(Number(ato))) return null;
  p.bosses.push(Number(ato));
  const nomeDif = CAMPANHA.dificuldades[dif].nome;
  const doEditor = ATOS_DO_EDITOR.get(Number(ato));
  // As missões do PoE que terminam no chefe do ato (O Eterno Pesadelo, o Malachai do Ato 4).
  const daMissao = MissoesDeGemas.aoVencerBoss(estado, ato);
  if (doEditor) {
    // Ato do editor: concluir libera o ato seguinte que o exige; NÃO mexe na dificuldade (essa é a campanha legada).
    estado.avisoDaHunt = `${doEditor.ato.nome} concluído no ${nomeDif}!${doEditor.ato.seguinte ? ' O próximo ato está liberado.' : ''}${daMissao}`;
    return estado.avisoDaHunt;
  }
  const proxDif = DIFICULDADES[DIFICULDADES.indexOf(dif) + 1];
  const aviso =
    Number(ato) < ATOS
      ? `Ato ${ato} concluído no ${nomeDif}! O Ato ${Number(ato) + 1} está liberado.`
      : proxDif
        ? `Campanha concluída no ${nomeDif}! O ${CAMPANHA.dificuldades[proxDif].nome} está liberado.`
        : `Campanha concluída no ${nomeDif}!`;
  estado.avisoDaHunt = aviso + daMissao;
  return estado.avisoDaHunt;
}

/**
 * O que a tela WORLD sabe de uma fase além do progresso: descrição, ambiente, conexões, o que ela exige, o boss
 * principal e os encontros OBRIGATÓRIOS (a condição de conclusão) — e, dos opcionais e secretos, SÓ os que este
 * personagem já ENCONTROU (concluiu): nenhum segredo, baú ou boss oculto é revelado antes da hora.
 */
/** Os tipos de encontro opcional que o mapa pode anunciar de antemão (fixos): bosses, minibosses e eventos de combate. Baús, altares e segredos não. */
const TIPOS_CONHECIDOS = new Set(['boss', 'miniboss', 'sobrevivencia', 'fenda', 'invasor']);

function grafoDaFase(f) {
  const g = ATOS_DO_EDITOR.get(f.ato);
  const fase = g?.ato.fases.find((x) => x.id === f.grafo.faseId);
  if (!fase) return null;
  const TIPO = { 'matar-chefe': 'boss-fase', 'item-de-missao': 'quest', 'matar-n': 'desafio' };
  return {
    ordem: fase.ordem ?? null,
    tipo: fase.id === g.ato.inicio ? 'inicio' : TIPO[fase.conclusao?.tipo] ?? (fase.tipo === 'fase-final-do-ato' ? 'especial' : 'comum'),
    conexoes: g.ato.conexoes.filter((c) => c.de === fase.id).map((c) => g.huntPorFase.get(c.para)).filter(Boolean),
    aoBoss: g.ato.bossFinal?.faseAnterior === fase.id,
  };
}
function mundoDaFase(estado, f) {
  const c = conteudoDaFase(f.huntId);
  const m = c.mundo ?? {};
  const concluidos = estado.encontros?.concluidos?.[f.huntId] ?? {};
  const conhecidos = (m.todos ?? []).filter((e) => !e.obrigatorio && e.probabilidade === 100 && TIPOS_CONHECIDOS.has(e.tipo)).map((e) => ({ nome: e.bossNome ?? e.nome, tipo: e.tipo, ...(e.categoria ? { categoria: e.categoria } : {}), ...(concluidos[e.id] ? { feito: true } : {}) }));
  const descobertos = (m.todos ?? []).filter((e) => concluidos[e.id]).map((e) => ({ nome: e.nome, tipo: e.tipo, vezes: concluidos[e.id] }));
  return {
    ...(c.descricao ? { descricao: c.descricao } : {}),
    ...(c.ambiente ? { ambiente: c.ambiente } : {}),
    // Onde o nó fica no mapa (0–1000 × 0–640), o tipo e o ícone escolhidos no editor; sem isso a tela desenha o caminho sozinha.
    ...(c.mapa && Number.isFinite(c.mapa.x) && Number.isFinite(c.mapa.y) ? { mapa: { x: c.mapa.x, y: c.mapa.y, ...(c.mapa.icone ? { icone: c.mapa.icone } : {}) } } : {}),
    ...(c.tipo ? { tipo: c.tipo } : {}),
    ...(c.conexoes?.length ? { conexoes: c.conexoes } : {}),
    // Fase de ato do EDITOR: o mapa do jogo segue a Engine à risca (dono, 07/10: "quero sempre manter da engine") — o número (`ordem`),
    // o tipo do nó como a Engine o marca (início, boss por conclusão, item de missão, matar N) e SÓ as ligações desenhadas lá
    // (sem a cadeia implícita fase→seguinte), mais se é a fase que leva ao boss.
    ...(f.grafo ? { grafo: grafoDaFase(f) } : {}),
    ...(c.requisitos?.levelMin ? { levelRecomendado: c.requisitos.levelMin } : {}),
    ...(c.requisitos?.exige?.length ? { exige: c.requisitos.exige.map((id) => ({ huntId: id, nome: faseDe(id)?.nome ?? id })) } : {}),
    ...(m.bossPrincipal ? { bossPrincipal: m.bossPrincipal.nome } : {}),
    // O que o jogador JÁ SABE que existe: conteúdo opcional e FIXO (100%) de boss/miniboss/evento. Aleatório e secreto só se descobre ao encontrar.
    ...(conhecidos.length ? { conhecidos } : {}),
    ...(m.obrigatorios?.length ? { obrigatorios: m.obrigatorios.map((e) => ({ nome: e.nome, tipo: e.tipo })) } : {}),
    ...(descobertos.length ? { descobertos } : {}),
  };
}

/** A campanha para a tela: por dificuldade, as fases (com progresso) e os bosses — mais o conteúdo do WORLD. */
export function paraCliente(estado) {
  const nomes = nomesDeBosses();
  const vitorias = estado.encontros?.concluidos?.boss ?? {};
  return {
    aoCompletar: aoCompletar(estado),
    atos: atosDoConteudo(),
    mundo: Object.fromEntries(FASES.filter(visivel).map((f) => [f.huntId, mundoDaFase(estado, f)]).filter(([, v]) => Object.keys(v).length)),
    bossesDerrotados: Object.entries(vitorias).map(([id, vezes]) => ({ id, nome: nomes[id] ?? id, vezes })),
    // A cidade onde o personagem fica fora da caçada (o nó azul do mapa): a do ato da última fase em que ele caçou (`Cacadas.entrar`).
    atoDaCidade: Number(estado.atoDaCidade) || null,
    dificuldades: dificuldadesDoJogo().map((dif) => {
      const p = progresso(estado, dif);
      return {
        id: dif,
        nome: CAMPANHA.dificuldades[dif].nome,
        faixa: CAMPANHA.dificuldades[dif].faixa,
        liberada: dificuldadeLiberada(estado, dif),
        fases: FASES.filter(visivel).map((f) => ({
          huntId: f.huntId,
          nome: f.nome,
          ato: f.ato,
          nivel: f.nivel[dif],
          limpezas: p.limpezas[f.huntId] ?? 0,
          completa: faseCompleta(estado, dif, f.huntId),
          liberada: faseLiberada(estado, dif, f.huntId),
          ...(f.pular ? { pular: true } : {}),
          // O que conclui a fase DE VERDADE (dono, 07/10: "no Para concluir tem que colocar o que realmente tem que fazer"): o objetivo da
          // Engine (limpar a área, matar o chefe, matar N, pegar o item da missão) e o progresso dele nesta dificuldade.
          objetivo: { tipo: conclusaoDa(f.huntId).tipo, texto: objetivoEmTexto(conclusaoDa(f.huntId)), ...progressoDoObjetivo(estado, dif, f.huntId) },
        })),
        bosses: Object.entries(CAMPANHA.bosses).filter(([ato]) => atoAtivo(Number(ato))).map(([ato, b]) => ({
          ato: Number(ato),
          bossId: b.bossId,
          nome: b.nome,
          nivel: b.nivel[dif],
          liberado: bossLiberado(estado, dif, ato),
          vencido: bossVencido(estado, dif, ato),
          // No jogo oficial o chefe sai de um portal NA última fase (`chefeDoAtoNaFase`): o cliente leva até ela, não há sala.
          ...(chefeDoAtoNaFase() ? { naFase: true, ultimaFase: ultimaFaseDoAto(Number(ato))?.huntId ?? null, ...comoOChefeAparece(ato) } : {}),
        })),
      };
    }),
  };
}

/** A fase em que a caçada está, para a barra da tela ("Troll Cave · Fácil — 312 / 500"). `null` fora da campanha. */
export function faseAtual(estado, hunt) {
  const c = hunt?.campanha;
  if (!c) return null;
  const dif = CAMPANHA.dificuldades[c.dificuldade];
  if (c.bossDoAto) return { tipo: 'boss', ato: c.ato, dificuldade: c.dificuldade, nomeDaDificuldade: dif?.nome, nome: bossDoAto(c.ato)?.nome, vencido: bossVencido(estado, c.dificuldade, c.ato) };
  const f = faseDe(c.huntId);
  if (!f) return null;
  const p = progresso(estado, c.dificuldade);
  const completa = faseCompleta(estado, c.dificuldade, f.huntId);
  return {
    // No jogo oficial o número é o da fase DENTRO do ato, como no mapa da campanha e no site (dono, 08/10: "Ato 2 · Fase 3", e não "Fase 19");
    // no Draevor clássico, a posição nas 48 fases.
    tipo: 'fase', aoCompletar: aoCompletar(estado), ato: f.ato, numero: itensPoeLigado() ? numeroNoAto(f.huntId) : f.indice + 1, dificuldade: c.dificuldade, nomeDaDificuldade: dif?.nome, nome: f.nome,
    limpezas: p.limpezas[f.huntId] ?? 0, completa,
    // Completa e sem próxima para seguir: fim do ato (o boss é o jogador quem chama).
    fimDoAto: completa && !proximaParaSeguir(estado, c.dificuldade, f.huntId),
  };
}

/**
 * Abre o portal do boss do ato na SALA `hunt` (a caçada do dono): só na última fase jogável do ato, e se algum de `estados` (quem está na sala)
 * já tem o boss liberado (as fases do ato completas na dificuldade). O portal nasce onde o dono está e fica na caçada: uma instância nova da
 * mesma fase não o fecha. Idempotente — não duplica para o mesmo ato e dificuldade. Devolve o portal, ou `null`.
 */
/*
 * ---- O chefe do ato sai de um PORTAL na última fase (dono, 08/10) ----
 * "queria que abrisse o portal com o boss na fase: ele não direciona para outra instância — aparece o boss na fase quando limpa tudo,
 * na mesma instância". No jogo oficial, cumprida a regra da última fase do ato (no Ato 1, limpar a Caverna da Ira), um portal se abre
 * NA instância, o chefe sai dele e o portal fecha (`Cacadas` — `abrirPortalDoChefe`/`soltarChefeDoAto`); matá-lo vence o ato para a party
 * da sala. No Draevor clássico continua a sala do boss, pelo portal (`abrirPortalDoBoss`).
 */
export const chefeDoAtoNaFase = () => itensPoeLigado();
/** O chefe do ato que a última fase de `hunt` solta agora: `{ ato, bossId, nome }`, ou null (não é a última fase, o ato não abriu…). */
export function chefeQueSaiNaFase(hunt, estados) {
  const c = hunt?.campanha;
  if (!chefeDoAtoNaFase() || !c || c.bossDoAto || hunt.anfitriao || !ehUltimaFaseDoAto(c.huntId)) return null;
  // O chefe do ato que a fase já pede (o Kitava no Telhado da Catedral): ele nasce com a fase — não há portal.
  if (atoDoChefeNaFase(c.huntId)) return null;
  if (!estados.some((e) => bossLiberado(e, c.dificuldade, c.ato))) return null;
  const b = bossDoAto(c.ato);
  return b ? { ato: c.ato, bossId: b.bossId, nome: b.nome } : null;
}

/**
 * A regra da última fase é MATAR um chefe que não é o do ato (o Ato 8 pede a Lunaris na Ponte do Porto; o chefe do ato é Solaris/Lunaris):
 * a morte dele cumpre a regra e o portal abre ali (`Cacadas` — o pedido `portalDoChefePedido` da instância), sem esperar a limpeza. Com a
 * limpeza (`limpar-hunt`, o Ato 1) quem abre é o "Hunt Clear!". `key`: a chave do bicho morto.
 */
/** Como o chefe do ato aparece, pela regra da última fase (o texto do cartão): `{ comoAparece, semPortal? }`. */
export function comoOChefeAparece(ato) {
  const u = ultimaFaseDoAto(Number(ato));
  if (!u) return {};
  const conc = conclusaoDa(u.huntId);
  // "a fase X": o artigo do nome varia ("o Telhado", "a Ascensão") — assim serve para qualquer um.
  if (atoDoChefeNaFase(u.huntId)) return { semPortal: true, comoAparece: `Ele está na fase ${u.nome}: matá-lo lá vence o ato.` };
  const regra = conc.tipo === 'matar-chefe' ? `Mate ${conc.nome ?? nomeDoMonstro(conc.monstro)} na fase ${u.nome}` : `Limpe a fase ${u.nome}`;
  return { comoAparece: `${regra}: um portal se abre e o chefe sai dele, na mesma instância.` };
}
export function portalAbreNaMorte(huntId, key) {
  const f = faseDe(huntId);
  if (!chefeDoAtoNaFase() || !f || !ehUltimaFaseDoAto(huntId) || atoDoChefeNaFase(huntId)) return false;
  const conc = conclusaoDa(huntId);
  return conc.tipo === 'matar-chefe' && ehOMonstro(key, conc.monstro);
}

export function abrirPortalDoBoss(hunt, estados) {
  const c = hunt?.campanha;
  if (!c || c.bossDoAto || hunt.anfitriao || !ehUltimaFaseDoAto(c.huntId)) return null;
  // O chefe do ato é enfrentado NESTA fase (`atoDoChefeNaFase`): não há sala para abrir.
  if (atoDoChefeNaFase(c.huntId)) return null;
  if (!estados.some((e) => bossLiberado(e, c.dificuldade, c.ato))) return null;
  const b = bossDoAto(c.ato);
  if (!b) return null;
  const atual = hunt.portalDoBoss;
  if (atual && atual.ato === c.ato && atual.dificuldade === c.dificuldade) return atual;
  hunt.portalDoBoss = { ato: c.ato, dificuldade: c.dificuldade, bossId: b.bossId, nome: b.nome, x: hunt.pos.x, y: hunt.pos.y, z: hunt.z ?? 0, abertoEm: Date.now() };
  return hunt.portalDoBoss;
}

// =====================================================================================================================
// ATOS DO EDITOR (runtime por grafo)
// Os 4 atos legados seguem pelo caminho linear de sempre (acima, sem mudar). Um ato do editor (`gamedata/atos/*.json`, estado `beta` ou
// `publicado`) entra aqui no boot: suas fases viram entradas de `FASES` com `grafo: {atoId, faseId}` e `ato` = o `ordem` do ato (5 em diante);
// o boss final vira `CAMPANHA.bosses[ordem]`. Tudo o mais — portal, limpeza, Caça Automática, party, progresso por hunt — é O MESMO caminho:
// só mudam as perguntas "esta fase está aberta?", "o boss abriu?" e "qual a próxima?", que aqui seguem o grafo (`fasesAbertas`).
// O progresso fica onde sempre ficou (`completas` por hunt, `bosses` por número de ato): nada novo no personagem.
// =====================================================================================================================
export const ATOS_DO_EDITOR = new Map(); // número do ato → { ato, numero, huntPorFase: Map, desfazer: [] }
const legadoN = (id) => (/^legado-(\d+)$/.test(String(id)) ? Number(String(id).slice(7)) : null);
/** O ato do editor está valendo? `publicado` sempre; `beta` só com o modo beta ligado. */
export const atoAtivo = (numero) => {
  const g = ATOS_DO_EDITOR.get(Number(numero));
  if (!g) return true; // legado
  return g.ato.estado === 'publicado' || (g.ato.estado === 'beta' && Beta.ativo());
};
const visivel = (f) => !f.grafo || atoAtivo(f.ato);
const numeroDoAtoId = (id) => legadoN(id) ?? [...ATOS_DO_EDITOR.values()].find((g) => g.ato.id === id)?.numero ?? null;

/** O ato anterior/exigidos têm o boss vencido nesta dificuldade? (a porta do ato) */
function portaoDoAtoAberto(estado, dif, g) {
  const ids = [g.ato.anterior, ...g.ato.requisitos.exige].filter(Boolean);
  return ids.every((id) => {
    const n = numeroDoAtoId(id);
    return n != null && bossVencido(estado, dif, n);
  });
}
function liberadaNoGrafo(estado, dif, f) {
  const g = ATOS_DO_EDITOR.get(f.ato);
  if (!g || !atoAtivo(f.ato) || !portaoDoAtoAberto(estado, dif, g)) return false;
  const feitas = new Set(g.ato.fases.filter((x) => faseCompleta(estado, dif, x.huntId)).map((x) => x.id));
  return fasesAbertas(g.ato, feitas).has(f.grafo.faseId);
}
function motivoNoGrafo(estado, dif, f, nomeDif) {
  const g = ATOS_DO_EDITOR.get(f.ato);
  if (!g || !atoAtivo(f.ato)) return `${f.nome} ainda não está disponível.`;
  for (const id of [g.ato.anterior, ...g.ato.requisitos.exige].filter(Boolean)) {
    const n = numeroDoAtoId(id);
    if (n == null || !bossVencido(estado, dif, n)) return `Derrote o boss do Ato ${n ?? id} (${n != null ? bossDoAto(n)?.nome : id}) no ${nomeDif} para abrir o ${g.ato.nome}.`;
  }
  const nomeDe = (faseId) => g.ato.fases.find((x) => x.id === faseId)?.nome ?? faseId;
  const antes = g.ato.conexoes.filter((c) => c.para === f.grafo.faseId).map((c) => nomeDe(c.de));
  const exige = g.ato.fases.find((x) => x.id === f.grafo.faseId)?.requisitos.exige ?? [];
  const faltaExigida = exige.find((id) => !faseCompleta(estado, dif, g.huntPorFase.get(id)));
  if (faltaExigida) return `Complete antes ${nomeDe(faltaExigida)} no ${nomeDif} para abrir esta.`;
  return `Complete ${antes.length > 1 ? `uma de: ${antes.join(', ')}` : (antes[0] ?? 'a fase anterior')} no ${nomeDif} para abrir esta.`;
}
function proximaNoGrafo(estado, dif, f) {
  const g = ATOS_DO_EDITOR.get(f.ato);
  if (!g) return null;
  for (const c of g.ato.conexoes.filter((x) => x.de === f.grafo.faseId)) {
    const huntId = g.huntPorFase.get(c.para);
    if (huntId && !faseCompleta(estado, dif, huntId) && faseLiberada(estado, dif, huntId)) return faseDe(huntId);
  }
  return null;
}

/** O boss é de ato: sem recarga (catálogo e `semEspera`), igual aos legados. */
function semEsperaDoBoss(bossId) {
  for (const lista of [CATALOGO.bosses, CATALOGO.hunts]) for (const e of lista ?? []) if (e.id === bossId || e.id === `${bossId}-online`) Object.assign(e, { cooldownHours: 0, semEspera: true });
}

function contextoDoRuntime() {
  const hunts = new Set([...CATALOGO.hunts, ...(CATALOGO.vips ?? []), ...(CATALOGO.especiais ?? []), ...(CATALOGO.divinas ?? [])].map((h) => h.id));
  const bosses = new Set((CATALOGO.bosses ?? []).map((b) => b.id));
  const huntsEmUso = new Map();
  for (const f of FASES) huntsEmUso.set(f.huntId, f.grafo?.atoId ?? `legado-${f.ato}`);
  const bossesEmUso = new Map(Object.entries(CAMPANHA.bosses).map(([n, b]) => [b.bossId, ATOS_DO_EDITOR.get(Number(n))?.ato.id ?? `legado-${n}`]));
  const ordensEmUso = new Map([...Array(ATOS)].map((_, i) => [i + 1, `legado-${i + 1}`]));
  for (const [n, g] of ATOS_DO_EDITOR) ordensEmUso.set(n, g.ato.id);
  const atos = [...ordensEmUso.values()].map((id) => ({ id }));
  const categoriaDaHunt = (id) => ['hunts', 'vips', 'especiais', 'divinas'].find((c) => (CATALOGO[c] ?? []).some((h) => h.id === id)) ?? null;
  return { categoriaDaHunt, huntExiste: (h) => hunts.has(h), bossExiste: (b) => bosses.has(b), huntsEmUso, bossesEmUso, ordensEmUso, ordemMinima: ATOS + 1, atos, validarRecompensa: RecompensasDeEncontro.validar, itemExiste: (id) => !!ITEM_CATALOG[id] };
}

/**
 * Põe um ato do editor para valer. Valida DE NOVO com o cadastro do servidor (nunca confia no arquivo) e recusa, sem efeito nenhum, se houver
 * erro. Devolve `{ ok, problemas, numero }`.
 */
export function registrarAto(bruto) {
  const ato = normalizar({ ...bruto, estado: bruto.estado === 'beta' ? 'beta' : 'publicado' });
  const problemas = validarAto(ato, contextoDoRuntime());
  if (temErro(problemas)) return { ok: false, problemas };
  const numero = ato.ordem;
  const desfazer = [];
  const huntPorFase = new Map(ato.fases.map((f) => [f.id, f.huntId]));
  const doCadastro = (id) => [...CATALOGO.hunts, ...(CATALOGO.vips ?? []), ...(CATALOGO.especiais ?? []), ...(CATALOGO.divinas ?? [])].find((h) => h.id === id);
  const niveisPadrao = (f) => f.nivel ?? { facil: doCadastro(f.huntId)?.level ?? 1, medio: doCadastro(f.huntId)?.level ?? 1, dificil: doCadastro(f.huntId)?.level ?? 1 };
  const ordenadas = [...ato.fases].sort((a, b) => (a.ordem ?? 1e9) - (b.ordem ?? 1e9));
  const posX = 1000 / 920;
  const posY = 640 / 520;
  for (const f of ordenadas) {
    const entrada = { huntId: f.huntId, nome: f.nome, ato: numero, levelOriginal: Math.max(1, doCadastro(f.huntId)?.level ?? niveisPadrao(f).facil), nivel: niveisPadrao(f), grafo: { atoId: ato.id, faseId: f.id } };
    INDICE.set(f.huntId, FASES.push(entrada) - 1);
    desfazer.push(() => {
      INDICE.delete(f.huntId);
      FASES.splice(FASES.indexOf(entrada), 1);
      FASES.forEach((x, i) => INDICE.set(x.huntId, i));
    });
    desfazer.push(
      registrarConteudo(f.huntId, {
        descricao: f.descricao || undefined,
        conexoes: ato.conexoes.filter((c) => c.de === f.id).map((c) => huntPorFase.get(c.para)),
        requisitos: { exige: f.requisitos.exige.map((id) => huntPorFase.get(id)).filter(Boolean) },
        ...(f.posicao ? { mapa: { x: Math.round(f.posicao.x * posX), y: Math.round(f.posicao.y * posY) } } : {}),
      })
    );
  }
  const boss = ato.bossFinal;
  const bossCad = (CATALOGO.bosses ?? []).find((b) => b.id === boss.bossId);
  const ult = ato.fases.find((f) => f.id === boss.faseAnterior);
  const nivelBoss = boss.nivel ?? niveisPadrao(ult);
  CAMPANHA.bosses[String(numero)] = { bossId: boss.bossId, nome: bossCad?.name ?? boss.bossId, levelOriginal: Math.max(1, bossCad?.level ?? nivelBoss.facil), nivel: nivelBoss };
  desfazer.push(() => delete CAMPANHA.bosses[String(numero)]);
  semEsperaDoBoss(boss.bossId);
  // O FUNDO do mapa no jogo é a IMAGEM do ato do editor (dono, 07/10: "fazer algo assim na parte de hunts e para montar atos" — a mesma arte em
  // que as fases são posicionadas no editor). Sem imagem no ato, vale a do Mapa do mundo (`atos[n].fundo`); sem nenhuma, o pergaminho desenhado.
  const imagemDoAto = ato.imagem ? { url: `/gamedata/atos/${ato.imagem}`, doEditor: true } : null;
  const cidade = ato.cidade ? { nome: ato.cidade.nome, posicao: ato.cidade.posicao ? { x: Math.round(ato.cidade.posicao.x * posX), y: Math.round(ato.cidade.posicao.y * posY) } : null, conexoes: ato.cidade.conexoes.map((id) => huntPorFase.get(id)).filter(Boolean) } : null;
  desfazer.push(registrarMetaDeAto(numero, { nome: ato.nome, descricao: ato.descricao, parte: null, tema: null, fundo: imagemDoAto ?? atosDoConteudo()[String(numero)]?.fundo ?? null, cidade }));
  ATOS_DO_EDITOR.set(numero, { ato, numero, huntPorFase, desfazer });
  return { ok: true, problemas, numero };
}

/** A recompensa configurada de uma fase de ato do editor (`null` se não há / é fase legada). Formato dos encontros. */
export const recompensaDaFase = (huntId) => {
  const f = faseDe(huntId);
  const g = f?.grafo ? ATOS_DO_EDITOR.get(f.ato) : null;
  return g?.ato.fases.find((x) => x.id === f.grafo.faseId)?.recompensas ?? null;
};
/** A recompensa do boss final de um ato do editor (`null` se não há). */
export const recompensaDoBoss = (ato) => ATOS_DO_EDITOR.get(Number(ato))?.ato.bossFinal?.recompensas ?? null;
/**
 * Reivindica o prêmio de PRIMEIRA vez `chave` deste personagem nesta dificuldade: `true` UMA vez só (grava em `premios`), `false` nas demais.
 * É o que impede pagar duas vezes por evento duplicado ou por duas fontes.
 */
export function reivindicarPremio(estado, dif, chave) {
  const p = progresso(estado, dif);
  if (p.premios.includes(chave)) return false;
  p.premios.push(chave);
  return true;
}

/** Só os testes: tira da campanha legada estas hunts (para um ato de teste usá-las; cada hunt pertence a um ato só). */
export function _liberarHuntsParaTestes(ids) {
  const fora = new Set(ids);
  for (let i = FASES.length - 1; i >= 0; i--) if (fora.has(FASES[i].huntId) && !FASES[i].grafo) FASES.splice(i, 1);
  INDICE.clear();
  FASES.forEach((x, i) => INDICE.set(x.huntId, i));
}

/** Só os testes: tira um ato registrado. */
export function _desregistrarAto(numero) {
  const g = ATOS_DO_EDITOR.get(Number(numero));
  if (!g) return;
  for (const d of g.desfazer.reverse()) d();
  ATOS_DO_EDITOR.delete(Number(numero));
}

/**
 * HOT RELOAD de um ato do editor (só desenvolvimento): troca o ato JÁ registrado com o mesmo `id` pelo novo, ou registra se for novo. Se o novo não passar
 * na validação, o antigo é re-registrado (nunca fica sem o ato) e devolve `{ ok: false, problemas }`. O progresso dos personagens é por `huntId` e não
 * muda; quem está dentro de uma fase segue na instância que já tinha. Só afeta o que for aberto/consultado depois. `estado` que não executa
 * (rascunho/desativado) apenas remove o ato registrado.
 */
export function recarregarAto(bruto) {
  // A mesma regra do boot: com o PoE ligado só os atos do PoE (`poe-ato-*`) valem; sem ele, nunca os do PoE.
  if (itensPoeLigado() !== String(bruto.id).startsWith('poe-ato-')) return { ok: true, removido: false, numero: null, ignorado: itensPoeLigado() ? 'PoE ligado: só os atos do PoE valem' : 'ato do PoE: só com ITENS_POE=1' };
  const existente = [...ATOS_DO_EDITOR.values()].find((g) => g.ato.id === bruto.id);
  const executa = bruto.estado === 'beta' || bruto.estado === 'publicado';
  const anterior = existente?.ato;
  if (existente) _desregistrarAto(existente.numero);
  if (!executa) return { ok: true, removido: !!existente, numero: null };
  const r = registrarAto(bruto);
  if (!r.ok && anterior) registrarAto(anterior);
  return r.ok ? { ...r, substituiu: !!existente } : r;
}
/** Hot reload: tira do jogo o ato registrado com este `id` (arquivo apagado). `true` se havia. */
export function removerAtoRegistrado(id) {
  const g = [...ATOS_DO_EDITOR.values()].find((x) => x.ato.id === id);
  if (!g) return false;
  _desregistrarAto(g.numero);
  return true;
}
/**
 * HOT RELOAD dos NÍVEIS da campanha (`campanha.json`): copia `nivel`/`nome`/`pular`/`levelOriginal` das fases LEGADAS e os níveis dos bosses, SE a estrutura
 * for a mesma (mesmas hunts, na mesma ordem, mesmos bosses, mesmas dificuldades). Estrutura diferente → `{ ok: false, reinicio: true }`: nada é tocado.
 */
export function recarregarNiveis(novo) {
  const legadas = FASES.filter((f) => !f.grafo);
  const nv = (novo?.fases ?? []);
  const chavesLegadas = Object.keys(CAMPANHA.bosses).filter((n) => !ATOS_DO_EDITOR.has(Number(n)));
  const mesmaEstrutura = legadas.length === nv.length && legadas.every((f, i) => f.huntId === nv[i].huntId) && JSON.stringify(Object.keys(novo.dificuldades ?? {})) === JSON.stringify(DIFICULDADES)
    && JSON.stringify(Object.keys(novo.bosses ?? {}).sort()) === JSON.stringify(chavesLegadas.sort()) && chavesLegadas.every((n) => novo.bosses[n]?.bossId === CAMPANHA.bosses[n].bossId);
  if (!mesmaEstrutura) return { ok: false, reinicio: true, motivo: 'a estrutura da campanha mudou (fases, bosses ou dificuldades): precisa reiniciar o servidor.' };
  const mudadas = [];
  legadas.forEach((f, i) => {
    const n = nv[i];
    const antes = JSON.stringify([f.nome, f.nivel, f.pular, f.levelOriginal]);
    f.nome = n.nome; f.nivel = structuredClone(n.nivel); f.levelOriginal = n.levelOriginal;
    if (n.pular) f.pular = n.pular; else delete f.pular;
    if (antes !== JSON.stringify([f.nome, f.nivel, f.pular, f.levelOriginal])) mudadas.push(f.huntId);
  });
  for (const [numero, b] of Object.entries(CAMPANHA.bosses)) {
    if (ATOS_DO_EDITOR.has(Number(numero)) || !novo.bosses?.[numero]) continue;
    const antes = JSON.stringify([b.nivel, b.levelOriginal]);
    b.nivel = structuredClone(novo.bosses[numero].nivel); b.levelOriginal = novo.bosses[numero].levelOriginal;
    if (antes !== JSON.stringify([b.nivel, b.levelOriginal])) mudadas.push(`boss-${numero}`);
  }
  if (novo.escala) CAMPANHA.escala = structuredClone(novo.escala);
  return { ok: true, mudadas };
}

// No boot: os atos executáveis da pasta. O que não passar na validação é ignorado COM aviso (nunca derruba o servidor nem afeta os legados).
// Com o PoE ligado, a campanha é só a do PoE: os atos do editor (que seguem os do Draevor) ficam de fora.
// Os atos do PoE (`poe-ato-*`) são registrados pela campanha do PoE (`itens-poe/campanha.mjs`), depois das áreas e dos chefes; sem o PoE, ficam de fora.
for (const ato of itensPoeLigado() ? [] : lerExecutaveis().filter((a) => !a.id.startsWith('poe-ato-'))) {
  const r = registrarAto(ato);
  if (!r.ok) console.warn(`[atos] "${ato.id}" não entrou no jogo: ${r.problemas.filter((p) => p.nivel === 'erro').map((p) => `[${p.onde}] ${p.mensagem}`).join(' | ')}`);
  else console.log(`[atos] "${ato.id}" (${ato.estado}) carregado como Ato ${r.numero}: ${ato.fases.length} fases.`);
}
