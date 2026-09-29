// Presente de level e recompensa diária. Funções puras sobre `estado` — quem
// manda a resposta pro cliente é `sessao.mjs`.
import { readFileSync } from 'node:fs';
import { CHARACTER_TEMPLATE, MONTARIAS_REAIS } from './dados.mjs';
import { INTERVALO_DIARIO_MS } from './regras.mjs';
import { darItem } from './inventario.mjs';
import * as Boosts from './boosts.mjs';

/*
 * ---- O calendário é do JOGO; o personagem guarda só o que é dele ----
 *
 * Os 30 dias do original (Zoros, 2026-09-26 — `gamedata/diario.json`, gerado
 * por tools/gerar-tarefas.mjs). Cada personagem guardava uma CÓPIA do
 * calendário no save, e uma correção nele (o dia 30, a Battlefrazzle, era o
 * look 1882 — o original é 9246) nunca chegava aos personagens antigos. Agora
 * o que vai para o cliente e o que se entrega vêm daqui; do personagem saem só
 * `pego` e `aVez`.
 */
const CALENDARIO = JSON.parse(readFileSync(new URL('../gamedata/diario.json', import.meta.url), 'utf8')).dias;
const DIA = new Map(CALENDARIO.map((d) => [d.dia, d]));
const QUANTIDADE_POR_EXTENSO = { uma: 1, um: 1, duas: 2, dois: 2, tres: 3, três: 3 };

/**
 * A quantidade é a PRIMEIRA palavra: "2 Draevor Tier UP" → 2, "Duas Stamina
 * Extensions (40h)" → 2 (o 40 é das horas, não das peças), "Uma ..." → 1.
 */
function quantidadeDoRotulo(rotulo) {
  const primeira = String(rotulo ?? '').split(' ')[0].toLowerCase();
  if (/^\d+$/.test(primeira)) return Number(primeira);
  return QUANTIDADE_POR_EXTENSO[primeira] ?? 1;
}

/** "+50% de experiência por 30 min" / "por 1h" / "por 2h" → {percent, ms}. */
function boostDoRotulo(rotulo) {
  const texto = String(rotulo ?? '');
  const percent = Number(texto.match(/(\d+)%/)?.[1] ?? 50);
  const min = texto.match(/(\d+)\s*min/);
  const h = texto.match(/(\d+)\s*h/);
  return { percent, ms: min ? Number(min[1]) * 60_000 : (h ? Number(h[1]) : 1) * 3_600_000 };
}

/** Cópia PRÓPRIA do calendário/presentes — `CHARACTER_TEMPLATE` é compartilhado e só de leitura. */
export function estadoInicial() {
  return {
    wildcards: CHARACTER_TEMPLATE.wildcards,
    presentes: structuredClone(CHARACTER_TEMPLATE.presentes),
    diario: structuredClone(CHARACTER_TEMPLATE.diario),
  };
}

/**
 * `podePegar`/`jaPegouHoje` NUNCA ficam guardados — são calculados aqui, a
 * cada envio, a partir de `ultimoColetadoEm`. Guardar um `podePegar: true`
 * fixo foi o bug que o dono achou: "consegui coletar o prêmio do dia no mesmo
 * dia infinitas vezes" — cada coleta reabria a porta na hora, em vez de
 * esperar o relógio.
 */
export function diarioParaCliente(diario) {
  const espera = diario.ultimoColetadoEm != null && Date.now() - diario.ultimoColetadoEm < INTERVALO_DIARIO_MS;
  const meu = new Map((diario.dias ?? []).map((d) => [d.dia, d]));
  const dias = CALENDARIO.map((d) => ({ ...d, pego: !!meu.get(d.dia)?.pego, aVez: !!meu.get(d.dia)?.aVez }));
  const pendente = diario.pendente ? { ...DIA.get(diario.pendente.dia), pego: false, aVez: true } : null;
  return { ...diario, dias, pendente, podePegar: !espera, jaPegouHoje: espera };
}

const podeColetarHoje = (diario) =>
  !diario.ultimoColetadoEm || Date.now() - diario.ultimoColetadoEm >= INTERVALO_DIARIO_MS;

/** Recompensa de UM dia do calendário (a definição do jogo, `CALENDARIO`). */
function concederRecompensaDoDia(estado, doPersonagem) {
  const dia = DIA.get(doPersonagem.dia) ?? doPersonagem;
  switch (dia.tipo) {
    case 'wildcards': {
      // O rótulo já diz a quantidade ("5 Prey Wildcards", "8 Prey
      // Wildcards") — extrair dali é melhor que inventar um número novo que
      // discordaria do que a tela mostrou.
      const quantidade = Number(String(dia.rotulo).match(/\d+/)?.[0] ?? 0);
      estado.wildcards = (estado.wildcards ?? 0) + quantidade;
      return;
    }
    // "2 Draevor Tier UP", "Duas Stamina Extensions": a quantidade do rótulo.
    case 'item':
      if (dia.itemId) darItem(estado, dia.itemId, quantidadeDoRotulo(dia.rotulo));
      return;
    // O XP Boost de sempre (a mesma fonte da Store: soma no que já corre).
    case 'xpboost': {
      const { percent, ms } = boostDoRotulo(dia.rotulo);
      Boosts.adicionar(estado, 'loja', percent, ms);
      return;
    }
    // "Outfit Feral Trapper, com os dois addons": os dois sexos, como a loja.
    case 'outfit': {
      const nome = MONTARIAS_REAIS.outfits.find((o) => o.look === dia.look)?.name;
      const looks = MONTARIAS_REAIS.outfits.filter((o) => o.name === nome).map((o) => o.look);
      estado.lojaOutfits = [...new Set([...(estado.lojaOutfits ?? []), ...(looks.length ? looks : [dia.look])])];
      return;
    }
    case 'montaria': {
      const id = MONTARIAS_REAIS.mounts.find((m) => m.look === dia.look)?.id;
      if (id != null) estado.lojaMontarias = [...new Set([...(estado.lojaMontarias ?? []), id])];
      return;
    }
    default:
      return;
  }
}

/** Marca o dia como pego, carimba a hora e avança o calendário para o dia seguinte. */
function avancarDiario(estado, dia) {
  const diario = estado.diario;
  dia.pego = true;
  dia.aVez = false;
  diario.sequencia = (diario.sequencia ?? 0) + 1;
  diario.dia = dia.dia >= 30 ? 1 : dia.dia + 1;
  diario.ultimoColetadoEm = Date.now();
  const proximo = diario.dias.find((d) => d.dia === diario.dia);
  if (proximo) proximo.aVez = true;
}

/** `send({t:'diario'})`. */
export function coletarDiario(estado) {
  const diario = estado?.diario;
  if (!diario) return { ok: false, erro: 'Sem calendário.' };
  if (!podeColetarHoje(diario)) return { ok: false, erro: 'Você já coletou a recompensa de hoje — volte mais tarde.' };
  const dia = diario.dias.find((d) => d.dia === diario.dia);
  if (!dia || dia.pego) return { ok: false, erro: 'Nada para coletar.' };

  // Dia de escolha: não resgata ainda — o cliente abre a lista de itens e
  // manda `diarioEscolher` com a peça escolhida. O relógio só corre quando a
  // escolha realmente sai (`escolherDiario`), não aqui.
  if (dia.tipo === 'escolha') {
    diario.pendente = dia;
    return { ok: true };
  }
  concederRecompensaDoDia(estado, dia);
  avancarDiario(estado, dia);
  return { ok: true };
}

/** `send({t:'diarioEscolher', escolha})`. */
export function escolherDiario(estado, { escolha }) {
  const diario = estado?.diario;
  const dia = diario?.pendente;
  if (!dia || !dia.itens?.includes(escolha)) return { ok: false, erro: 'Escolha inválida.' };
  darItem(estado, escolha);
  diario.pendente = null;
  avancarDiario(estado, dia);
  return { ok: true };
}

/*
 * ---- O set de marco é da VOCAÇÃO ----
 *
 * Os marcos saíam do molde (`character-template.json`), que é o de um knight:
 * um druid que pegava o "Set intermediário" recebia knight legs, heroic axe e
 * vampire shield. No original cada vocação tem o seu (`gamedata/sets-de-marco.json`,
 * lido do servidor original). Os marcos AINDA NÃO PEGOS passam a ter os itens
 * da vocação do personagem; o que já foi pego fica como está.
 */
const SETS_DE_MARCO = JSON.parse(readFileSync(new URL('../gamedata/sets-de-marco.json', import.meta.url), 'utf8')).vocacoes;

export function marcosDaVocacao(estado) {
  const sets = SETS_DE_MARCO[estado?.vocation];
  if (!sets) return;
  for (const marco of estado.presentes?.marcos ?? []) {
    const itens = marco.tipo === 'set' && !marco.pego ? sets[String(marco.level)] : null;
    if (itens) marco.itens = itens.map(([itemId, name]) => ({ itemId, name, count: 1 }));
  }
}

/** `send({t:'marco', level})` — um marco de EQUIPAMENTO (set/outfit/montaria). */
export function coletarMarco(estado, { level }) {
  const presentes = estado?.presentes;
  const marco = presentes?.marcos?.find((m) => m.level === level);
  if (!marco || marco.pego) return { ok: false, erro: 'Recompensa não encontrada.' };
  // O marco é do LEVEL: antes só o ouro era conferido, e um level 8 com 100 mil
  // pegava o Set completo do level 100.
  if ((estado.level ?? 1) < marco.level) return { ok: false, erro: `Esta recompensa abre no level ${marco.level}.` };
  if ((estado.gold ?? 0) < marco.custo) return { ok: false, erro: 'Ouro insuficiente.' };
  marcosDaVocacao(estado);

  estado.gold -= marco.custo;
  for (const item of marco.itens ?? []) darItem(estado, item.itemId, item.count ?? 1);
  marco.pego = true;
  marco.aberto = false;
  // `marcosAbertos` conta quantos estão DISPONÍVEIS agora, não quantos já
  // foram pegos — pegar diminui a fila, não aumenta (ver `pintarPresente`
  // no cliente: `emAberto = pendentes + marcosAbertos` decide se a faixa do
  // "Recompensa do level" aparece).
  presentes.marcosAbertos = Math.max(0, (presentes.marcosAbertos ?? 0) - 1);
  return { ok: true };
}

/** `send({t:'presente', itemId})` — o degrau de ARMA DE TREINO (o jogador escolhe a arma). */
export function coletarPresente(estado, { itemId }) {
  const presentes = estado?.presentes;
  const degrau = presentes?.degraus?.find((d) => d.aberto && !d.pego);
  if (!degrau) return { ok: false, erro: 'Nenhum presente disponível.' };
  if ((estado.gold ?? 0) < degrau.custo) return { ok: false, erro: 'Ouro insuficiente.' };

  estado.gold -= degrau.custo;
  darItem(estado, itemId);
  degrau.pego = true;
  degrau.aberto = false;
  presentes.pegos = (presentes.pegos ?? 0) + 1;
  // `pendentes` é quem manda o botão "Presente do level N" aparecer ou não
  // (ver `pintarPresente` no cliente) — sem decrementar, o botão continua
  // achando que ainda há presente para pegar mesmo depois de pego.
  presentes.pendentes = Math.max(0, (presentes.pendentes ?? 0) - 1);
  // O próximo degrau (na ordem da lista) abre se o level já alcança ele.
  const proximo = presentes.degraus.find((d) => !d.pego && !d.aberto);
  if (proximo && estado.level >= proximo.level) {
    proximo.aberto = true;
    presentes.pendentes += 1;
  }
  return { ok: true };
}
