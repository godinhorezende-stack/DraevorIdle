// Presente de level e recompensa diária. Funções puras sobre `estado` — quem
// manda a resposta pro cliente é `sessao.mjs`.
import { readFileSync } from 'node:fs';
import { CHARACTER_TEMPLATE, MONTARIAS_REAIS, ITEM_CATALOG } from './dados.mjs';
import { INTERVALO_DIARIO_MS } from './regras.mjs';
import { darItem } from './inventario.mjs';
import { gerarItem } from './itens/gerar.mjs';
import { nomeDaRaridade } from './itens/config.mjs';
import * as Boosts from './boosts.mjs';
import { ligado as itensPoeLigado } from './itens-poe/catalogo.mjs';
import * as ItensPoeJogo from './itens-poe/jogo.mjs';
import * as FrascosPoe from './itens-poe/frascos.mjs';

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
// Sem a trilha das ARMAS DE TREINO (os degraus de Exercise): o treino saiu do jogo (dono, 06/10 — `sem-treino.mjs`).
const PRESENTES_SEM_TREINO = { ...CHARACTER_TEMPLATE.presentes, degraus: [], escolhas: [], escolhasBoosted: [] };
/*
 * ---- As recompensas de nível NO PoE (dono, 07/10) ----
 *
 * "Todo personagem já começa com um flask de vida mínimo — mas como ele pega isso? Coloque para ele pegar aqui no level 1 mesmo; o
 * flask é level 3, mas ele pode usar. As outras recompensas pode tirar." Com o PoE ligado há UM marco: o Frasco de Vida Pequeno no
 * level 1, de graça, que vai direto para o cinto (`coletarMarco`). Os marcos do Draevor (baú 50/100, montaria 120, outfit 130) saem —
 * quem já os tinha pegos não perde nada do que recebeu, só o cartão.
 */
// (dono, 07/10: "quero que toda classe venha com 2 frascos de vida lv 1 equipados; aqui pode colocar um baú aleatório de itens lv 1 comum":
// os frascos vêm no cinto ao criar o personagem — `sessao.criarPersonagem` — e o marco do nível 1 virou o baú.)
const MARCO_DO_BAU = { level: 1, custo: 0, tipo: 'bau-poe', titulo: 'Baú de itens (nível 1)', pego: false, aberto: true };
const PRESENTES_DO_POE = { ...PRESENTES_SEM_TREINO, marcos: [MARCO_DO_BAU], total: 1, pendentes: 0, marcosAbertos: 1, proximo: 1, degrau: 1, custo: 0 };
const presentesPadrao = () => (itensPoeLigado() ? PRESENTES_DO_POE : PRESENTES_SEM_TREINO);
/** Com o PoE, os marcos do personagem viram só o do frasco (guardando se ele já o pegou). Devolve se mudou. */
export function marcosDoPoe(estado) {
  const presentes = estado?.presentes;
  if (!presentes || !itensPoeLigado()) return false;
  const marcos = presentes.marcos ?? [];
  if (marcos.length === 1 && marcos[0].tipo === 'bau-poe') return false;
  // O marco antigo (o frasco, ou os do Draevor) vira o baú do nível 1 — ainda não pego: quem pegou o frasco ganha o baú também.
  presentes.marcos = [structuredClone(MARCO_DO_BAU)];
  presentes.total = 1;
  return true;
}
export function estadoInicial() {
  return {
    wildcards: CHARACTER_TEMPLATE.wildcards,
    presentes: structuredClone(presentesPadrao()),
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
    case 'outfit':
      liberarOutfit(estado, dia.look);
      return;
    case 'montaria':
      liberarMontaria(estado, { look: dia.look });
      return;
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
 * ---- O BAÚ de marco é da VOCAÇÃO ----
 *
 * Os marcos 50 e 100 eram sets fechados ("Set intermediário", "Set completo"). Agora são
 * BAÚS DE ITENS: o baú abre e sai UM item sorteado entre os do nível — a lista da vocação
 * (`gamedata/sets-de-marco.json`, lida do servidor original: o que o set dava, cada peça é
 * uma possibilidade) — e ele nasce pelo gerador central, com raridade, faixa de valores,
 * atributos e efeito como qualquer drop. Os marcos AINDA NÃO PEGOS viram baú (e ganham a
 * lista da vocação do personagem); o set que já foi pego fica como está.
 */
const SETS_DE_MARCO = JSON.parse(readFileSync(new URL('../gamedata/sets-de-marco.json', import.meta.url), 'utf8')).vocacoes;
const TITULO_DO_BAU = { 50: 'Baú de itens (nível 50)', 100: 'Baú de itens (nível 100)' };

export function marcosDaVocacao(estado) {
  // Quem já tinha resgatado montaria/outfit sem receber, recebe agora (ver `repararEntregas`).
  repararEntregas(estado);
  const sets = SETS_DE_MARCO[estado?.vocation];
  for (const marco of estado.presentes?.marcos ?? []) {
    if (marco.pego) continue;
    // O set antigo, ainda não pego, vira baú (personagens salvos antes desta mudança).
    if (marco.tipo === 'set' && TITULO_DO_BAU[marco.level]) {
      marco.tipo = 'bau';
      marco.titulo = TITULO_DO_BAU[marco.level];
    }
    const itens = marco.tipo === 'bau' && sets ? sets[String(marco.level)] : null;
    if (itens) marco.itens = itens.map(([itemId, name]) => ({ itemId, name, count: 1 }));
  }
}

/** Abre o baú: um item do nível, sorteado, pronto pelo gerador (raridade, faixa, atributos). Devolve a peça. */
function abrirBau(estado, marco) {
  const possiveis = marco.itens ?? [];
  if (!possiveis.length) return null;
  const escolhido = possiveis[Math.floor(Math.random() * possiveis.length)];
  const peca = gerarItem({ itemId: escolhido.itemId, level: marco.level });
  (estado.inventory ??= []).push(peca);
  return peca;
}

/*
 * ---- Montaria e outfit: o MESMO sistema da Store e da aba Aparência ----
 *
 * Não existe lista paralela: liberar é pôr na `lojaMontarias` (ids) / `lojaOutfits` (looks) do
 * personagem — é o que `Aparencia.temMontaria`/`temOutfit` leem, o que a aba Aparência lista como
 * "owned" e o que `equiparMontaria`/`salvarAparencia` deixam vestir. O outfit entra nos DOIS sexos
 * (os looks com o mesmo nome) e, vindo por aqui, com os dois addons (`addonsQueTem` dá 3 a quem o
 * tem em `lojaOutfits`). Idempotente: liberar de novo não duplica nada.
 */
/** Libera a montaria (pelo id OU pelo look). Devolve o id, ou `null` se ela não existe no catálogo. */
export function liberarMontaria(estado, { id, look } = {}) {
  const montaria = MONTARIAS_REAIS.mounts.find((m) => (id != null && m.id === id) || (look != null && m.look === look));
  if (!montaria) return null;
  estado.lojaMontarias = [...new Set([...(estado.lojaMontarias ?? []), montaria.id])];
  return montaria.id;
}

/** Libera o outfit do `look` nos dois sexos (com os dois addons). Devolve os looks, ou `null` se ele não existe. */
export function liberarOutfit(estado, look) {
  const nome = MONTARIAS_REAIS.outfits.find((o) => o.look === look)?.name;
  if (!nome) return null;
  const looks = MONTARIAS_REAIS.outfits.filter((o) => o.name === nome).map((o) => o.look);
  estado.lojaOutfits = [...new Set([...(estado.lojaOutfits ?? []), ...looks])];
  return looks;
}

const temAMontaria = (estado, marco) => {
  const id = MONTARIAS_REAIS.mounts.find((m) => m.id === marco.mount || m.look === marco.look)?.id;
  return id != null && (estado.lojaMontarias ?? []).includes(id);
};
const looksDoOutfit = (look) => {
  const nome = MONTARIAS_REAIS.outfits.find((o) => o.look === look)?.name;
  return nome ? MONTARIAS_REAIS.outfits.filter((o) => o.name === nome).map((o) => o.look) : [];
};
const temOOutfit = (estado, marco) => looksDoOutfit(marco.look).some((l) => (estado.lojaOutfits ?? []).includes(l));

/**
 * Personagens que resgataram a montaria (120) ou o outfit (130) ANTES desta correção pagaram o ouro
 * e não receberam nada (o marco não tinha itens, e o resgate só sabia dar item ou abrir baú). Na
 * entrada, quem tem o marco "pego" e não tem a montaria/outfit recebe agora — sem cobrar de novo.
 * Nada é apagado nem desmarcado.
 */
export function repararEntregas(estado) {
  for (const marco of estado?.presentes?.marcos ?? []) {
    if (!marco.pego) continue;
    if (marco.tipo === 'montaria' && !temAMontaria(estado, marco)) liberarMontaria(estado, { id: marco.mount, look: marco.look });
    if (marco.tipo === 'outfit' && !temOOutfit(estado, marco)) liberarOutfit(estado, marco.look);
  }
}

/*
 * ---- Cada recompensa tem um ID, e não só o level ----
 *
 * O level não é único: no 50 há a arma de treino E o baú. O resgate e a tela passam a usar o `id`
 * (`arma-de-treino-50`, `bau-50`, `montaria-120`...). Personagens salvos antes ganham o id na hora,
 * calculado do que a recompensa já é — o `pego` de cada uma fica como estava.
 */
export function idDaRecompensa(recompensa, trilha) {
  if (trilha === 'degrau') return `${recompensa.boosted ? 'exercise-boosted' : 'arma-de-treino'}-${recompensa.level}`;
  return `${recompensa.tipo ?? 'marco'}-${recompensa.level}`;
}

function garantirIds(presentes) {
  const usados = new Set();
  const marcar = (r, trilha) => {
    let id = r.id ?? idDaRecompensa(r, trilha);
    for (let n = 2; usados.has(id); n++) id = `${idDaRecompensa(r, trilha)}-${n}`;
    r.id = id;
    usados.add(id);
  };
  for (const d of presentes.degraus ?? []) marcar(d, 'degrau');
  for (const m of presentes.marcos ?? []) marcar(m, 'marco');
}

/*
 * ---- Quem está ABERTO na tela de Recompensas de nível ----
 *
 * As recompensas de level formam UMA fila, por level (e, no mesmo level, a arma de treino antes do
 * baú/marco). Só a PRIMEIRA que ainda não foi pega pode abrir, e só quando o level chega nela — as
 * de trás mostram "pegue o anterior primeiro". Antes só o degrau da arma de treino abria (e só na
 * hora de pegar o de trás): o baú/montaria/outfit NUNCA abriam ("to lv 50 e o baú não abriu, diz
 * para pegar o anterior"), e um degrau só abria se o level já alcançasse no momento do anterior.
 * Agora a abertura é recalculada sempre que o estado vai para o cliente e a cada coleta.
 */
function filaDeRecompensas(presentes) {
  const item = (recompensa, tipo) => ({ recompensa, tipo });
  return [...(presentes.degraus ?? []).map((d) => item(d, 'degrau')), ...(presentes.marcos ?? []).map((m) => item(m, 'marco'))].sort(
    (a, b) => a.recompensa.level - b.recompensa.level || (a.tipo === 'degrau' ? -1 : 1) - (b.tipo === 'degrau' ? -1 : 1)
  );
}

export function abrirProximas(estado) {
  const presentes = estado?.presentes;
  if (!presentes) return;
  marcosDoPoe(estado);
  garantirIds(presentes);
  const fila = filaDeRecompensas(presentes);
  const primeira = fila.find((x) => !x.recompensa.pego);
  const level = estado.level ?? 1;
  let degrausAbertos = 0;
  let marcosAbertos = 0;
  for (const x of fila) {
    const abre = x === primeira && level >= x.recompensa.level;
    if (!x.recompensa.pego) x.recompensa.aberto = abre;
    if (abre) x.tipo === 'degrau' ? degrausAbertos++ : marcosAbertos++;
  }
  presentes.pendentes = degrausAbertos;
  presentes.marcosAbertos = marcosAbertos;
}

/**
 * Os presentes como vão para o cliente: aberturas em dia (ver `abrirProximas`) e, na montaria e no
 * outfit já resgatados, o estado REAL da entrega lido do sistema de Aparência — `entregue` (está na
 * lista dele) e `emUso` (está vestido/montado agora). A tela não marca "concluído" pelo `pego` só.
 * É uma cópia: estes campos não vão para o save.
 */
export function presentesParaCliente(estado) {
  if (!estado?.presentes) return presentesPadrao();
  abrirProximas(estado);
  const presentes = estado.presentes;
  return {
    ...presentes,
    marcos: (presentes.marcos ?? []).map((m) => {
      if (m.tipo === 'bau-poe') return { ...m, itens: [] };
      if (m.tipo === 'montaria') {
        const look = MONTARIAS_REAIS.mounts.find((x) => x.id === m.mount || x.look === m.look)?.look;
        return { ...m, entregue: temAMontaria(estado, m), emUso: look != null && estado.outfit?.mount === look, onde: 'Personagem › Aparência' };
      }
      if (m.tipo === 'outfit') {
        return { ...m, entregue: temOOutfit(estado, m), emUso: looksDoOutfit(m.look).includes(estado.outfit?.type), onde: 'Personagem › Aparência' };
      }
      return m;
    }),
  };
}

/**
 * `send({t:'marco', id})` (ou o `level` antigo) — um marco de EQUIPAMENTO: baú, montaria, outfit.
 *
 * A ordem importa: confere tudo, ENTREGA, e só então cobra e marca "pego". Se a entrega não der
 * (baú sem itens da vocação, montaria/outfit que não existe no catálogo), nada é cobrado nem
 * marcado. Resgatar de novo devolve erro (o `pego` já está gravado) — o servidor processa um
 * comando por vez por sessão, então dois cliques seguidos não entregam duas vezes.
 */
export function coletarMarco(estado, { id, level } = {}) {
  const presentes = estado?.presentes;
  if (presentes) garantirIds(presentes);
  const marco = presentes?.marcos?.find((m) => (id != null ? m.id === id : m.level === level));
  if (!marco) return { ok: false, erro: 'Recompensa não encontrada.' };
  if (marco.pego) return { ok: false, erro: 'Esta recompensa já foi resgatada.' };
  // O marco é do LEVEL: antes só o ouro era conferido, e um level 8 com 100 mil
  // pegava o Set completo do level 100.
  if ((estado.level ?? 1) < marco.level) return { ok: false, erro: `Esta recompensa abre no level ${marco.level}.` };
  if ((estado.gold ?? 0) < marco.custo) return { ok: false, erro: 'Ouro insuficiente.' };
  marcosDaVocacao(estado);

  // 1) entregar
  let peca = null;
  let aviso = null;
  if (marco.tipo === 'bau') {
    peca = abrirBau(estado, marco);
    if (!peca) return { ok: false, erro: 'O baú não tem itens para a sua vocação — nada foi cobrado.' };
    aviso = `O baú abriu: ${ITEM_CATALOG[peca.id]?.name ?? `item ${peca.id}`} (${nomeDaRaridade(peca.raridade ?? 'comum')}).`;
  } else if (marco.tipo === 'montaria') {
    if (liberarMontaria(estado, { id: marco.mount, look: marco.look }) == null) return { ok: false, erro: 'Montaria não encontrada — nada foi cobrado.' };
    aviso = `${marco.name ?? 'Montaria'} liberada! Monte em Personagem › Aparência.`;
  } else if (marco.tipo === 'outfit') {
    if (!liberarOutfit(estado, marco.look)) return { ok: false, erro: 'Outfit não encontrado — nada foi cobrado.' };
    aviso = `${marco.name ?? 'Outfit'} liberado, com os 2 addons! Vista em Personagem › Aparência.`;
  } else if (marco.tipo === 'bau-poe') {
    // O baú do nível 1: uma peça comum (Normal) de nível 1, sorteada, na mochila.
    peca = ItensPoeJogo.pecaDoBauInicial();
    if (!peca) return { ok: false, erro: 'O sistema de itens do PoE está desligado — nada foi entregue.' };
    (estado.inventory ??= []).push(peca);
    aviso = `O baú abriu: ${peca.poe.nome} (comum, nível 1) na mochila.`;
  } else {
    for (const item of marco.itens ?? []) darItem(estado, item.itemId, item.count ?? 1);
  }
  // 2) só agora cobra e marca
  estado.gold -= marco.custo;
  marco.pego = true;
  marco.aberto = false;
  abrirProximas(estado); // a próxima da fila abre, se o level já chega
  return {
    ok: true,
    ...(peca ? { item: { id: peca.id, raridade: peca.raridade ?? 'comum' }, peca } : {}),
    ...(aviso ? { notice: aviso } : {}),
  };
}

/**
 * `send({t:'presente', itemId, id?})` — o degrau de ARMA DE TREINO (o jogador escolhe a arma). Só
 * vale uma arma da lista DAQUELE degrau (`escolhas`, ou `escolhasBoosted` no boosted): antes qualquer
 * `itemId` mandado pelo cliente entrava na mochila.
 */
export function coletarPresente(estado, { itemId, id } = {}) {
  const presentes = estado?.presentes;
  abrirProximas(estado); // a abertura pode estar atrasada (o level subiu depois do último envio)
  const degrau = presentes?.degraus?.find((d) => d.aberto && !d.pego);
  if (!degrau) return { ok: false, erro: 'Nenhum presente disponível.' };
  if (id != null && degrau.id !== id) return { ok: false, erro: 'Esta recompensa ainda não está disponível.' };
  const lista = degrau.boosted ? presentes.escolhasBoosted ?? presentes.escolhas : presentes.escolhas;
  if (!(lista ?? []).some((e) => e.itemId === itemId)) return { ok: false, erro: 'Escolha uma das armas da lista.' };
  if ((estado.gold ?? 0) < degrau.custo) return { ok: false, erro: 'Ouro insuficiente.' };

  darItem(estado, itemId);
  estado.gold -= degrau.custo;
  degrau.pego = true;
  degrau.aberto = false;
  presentes.pegos = (presentes.pegos ?? 0) + 1;
  abrirProximas(estado); // o próximo da fila (degrau OU marco) abre, se o level já chega
  return { ok: true };
}
