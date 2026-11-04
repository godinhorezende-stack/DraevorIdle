// A SALVAGUARDA do PoE (Ward — o poedb em português escreve "Proteção" nos itens e "Salvaguarda" nas gemas e nas Joias Atemporais; dono, 02/11: "como o PoE").
//
// Uma camada de defesa que vem das bases Rúnicas (o `protecao` da base no catálogo) e dos mods de Salvaguarda:
//   - o MÁXIMO (a ficha, `ficha.salvaguarda` — `ficha.defesasDaFicha`): a Salvaguarda de cada peça vestida (a base + o "+N de Proteção" LOCAL, × (1 + a qualidade + o
//     "Proteção aumentada em X%" LOCAL) — `itens-poe/jogo.baseDaPeca`) somada, + o "+N" global, × (1 + o "Salvaguarda aumentada" global), × o "mais/menos";
//   - a ABSORÇÃO (`absorver`): o dano de um ACERTO em você sai dela antes de tudo — antes da Égide, do Escudo Gélido, da Guarda e do Escudo de Energia —, até o
//     que ela tem; o resto segue o caminho de sempre. Ela não absorve dano contínuo (o degenerativo, as auras). "X% do Dano sofrido ignora a Proteção" (o Aperto
//     Noturno): essa parte passa direto por ela;
//   - a QUEBRA: quando o acerto a leva a 0, ela quebra — o gatilho 'salvaguarda' (o Conjurar ao Perder Salvaguarda) e o evento `salvaguardaQuebra` (as Cargas e a
//     Adrenalina "quando a Salvaguarda se Rompe") saem pelo `aoQuebrar` que `acoes.mjs` registra;
//   - a RESTAURAÇÃO: o primeiro dano nela começa a espera (o PoB: Data.lua `WardRechargeDelay = 2` s), ÷ (1 + "Restauração da Salvaguarda X% mais rápida" — o
//     ModParser: "restoration of ward" = `WardRechargeFaster`); no fim, ela volta INTEIRA (`recarregar`, no tique da caçada). O dano no meio da espera não a reinicia.
//   - o frasco "Restaura Proteção ao usar" (o Frasco de Ferro) e "X% de chance de Restaurar a Salvaguarda ao Bloquear": `restaurar`.
//   - (02/11, os únicos e as Atemporais — o PoB) "Proteção não Quebra durante o Efeito" (a Decisão de Olroth: `salvaguarda_nao_quebra`, o PoB: `WardNotBreak`): o
//     acerto é absorvido até a Salvaguarda, mas ela não desce, não quebra e a espera não começa — vira uma redução fixa por acerto (com o "85% menos Proteção
//     durante o Efeito", a do frasco); "A Salvaguarda tem X% de chance de não se Romper" (`WardAvoidBreakChance`): o acerto que a levaria a 0 é absorvido e ela
//     não desce nesse acerto (a espera começa); a INTACTA/ROMPIDA (`intacta` — o PoB: `UnbrokenWard`): a condição "enquanto você tiver Salvaguarda Intacta"/"enquanto
//     sua Salvaguarda estiver Rompida" (`condicoes-poe`); "Efeito é removido quando a Proteção Quebrar" (a Preparação de Vorana: o frasco com `saiNaQuebra`); o
//     ataque que rompe a Salvaguarda (`romper`, `acoes`); "…quando a Salvaguarda é Restaurada" (o evento `salvaguardaRestaurada`, pelo `aoRestaurar`).
// Fora do modo PoE nada disto existe (a ficha não tem Salvaguarda).
import { ligado as itensPoeLigado } from '../itens-poe/catalogo.mjs';

/** A espera até a Salvaguarda voltar (o PoB: `data.misc.WardRechargeDelay = 2`, em segundos). */
export const ATRASO_MS = 2000;
/** A cor do número do dano que a Salvaguarda absorveu (o amarelo do Ward na tela do PoB: ^xFFFF77). */
export const COR = '#ffff77';

const valor = (ficha, k) => Number(ficha?.afPoe?.[k]) || 0;

/** A Salvaguarda máxima da ficha. */
export const maximo = (ficha) => (itensPoeLigado() ? Math.max(0, Math.round(Number(ficha?.salvaguarda) || 0)) : 0);

/** A espera da restauração: 2 s ÷ (1 + a restauração mais rápida/lenta). */
export const espera = (ficha) => Math.round(ATRASO_MS / Math.max(0.1, 1 + valor(ficha, 'salvaguarda_restauracao_pct') / 100));

/**
 * A Salvaguarda ATUAL (nunca acima do máximo). Sem espera correndo ela está cheia: só fica abaixo do máximo entre o dano e a restauração — `null` (o personagem novo,
 * a cidade) é cheia, e a peça Rúnica vestida agora entra cheia.
 */
export function atual(estado, ficha) {
  const max = maximo(ficha);
  if (!(max > 0)) return 0;
  if (estado.salvaguarda == null || estado.salvaguarda > max || !(estado.salvaguardaEspera > 0)) estado.salvaguarda = max;
  return estado.salvaguarda;
}

let aoQuebrar = null;
/** (acoes.mjs) O que sai quando a Salvaguarda quebra: os gatilhos 'salvaguarda' e o evento `salvaguardaQuebra` dos mods. */
export function definirAoQuebrar(fn) { aoQuebrar = fn; }

/**
 * O ACERTO em você passa pela Salvaguarda: tira dela até o que ela tem (menos a parte que a ignora) e devolve o que sobra para o resto do caminho. Começa a espera da
 * restauração (se não estava correndo) e, quando ela chega a 0, quebra. `evento`: os campos do número na tela (`uid`, `x`, `y`, `de`, `golpe`…).
 */
export function absorver(estado, hunt, ficha, dano, eventos = null, evento = null, personagem = null) {
  if (!(dano > 0) || !estado) return dano;
  const tem = atual(estado, ficha);
  if (!(tem > 0)) return dano;
  const ignora = Math.min(100, Math.max(0, valor(ficha, 'salvaguarda_ignorada_pct')));
  const tira = Math.min(tem, Math.round(dano * (1 - ignora / 100)));
  if (!(tira > 0)) return dano;
  if (eventos && evento) eventos.push({ t: 'dmg', ...evento, v: tira, color: COR, salvaguarda: true });
  // "Proteção não Quebra durante o Efeito" (o PoB: `WardNotBreak`): ela segura o acerto e não desce
  if (naoQuebra(ficha)) return dano - tira;
  if (!(estado.salvaguardaEspera > 0)) estado.salvaguardaEspera = espera(ficha);
  // "A Salvaguarda tem X% de chance de não se Romper" (o PoB: `WardAvoidBreakChance`): o acerto que a levaria a 0 não a tira
  if (tem - tira <= 0 && Math.random() * 100 < valor(ficha, 'salvaguarda_chance_nao_romper')) return dano - tira;
  estado.salvaguarda = tem - tira;
  if (estado.salvaguarda <= 0) quebrar(estado, hunt, personagem, eventos);
  return dano - tira;
}

/** "Proteção não Quebra durante o Efeito" (a Decisão de Olroth, enquanto o frasco dura). */
export const naoQuebra = (ficha) => valor(ficha, 'salvaguarda_nao_quebra') > 0;

/**
 * A Salvaguarda está INTACTA (o PoB: `Condition:UnbrokenWard`)? Com Salvaguarda e sem ter quebrado — a quebra vale até a restauração (a espera correndo).
 * `temSalvaguarda`: o personagem tem Salvaguarda (o máximo > 0, ou as peças, quem chama sem a ficha).
 */
export const intacta = (estado, temSalvaguarda) => !!temSalvaguarda && !(estado?.salvaguardaQuebrada && estado.salvaguardaEspera > 0);

/**
 * (o ataque da Joia Atemporal: "Enquanto você tiver Salvaguarda Intacta, seu próximo Ataque sem canalização usado por você rompe sua Salvaguarda…") ROMPE a
 * Salvaguarda agora: ela vai a 0, a espera começa e a quebra sai (o evento, o Conjurar ao Perder Salvaguarda). Devolve true se rompeu.
 */
export function romper(estado, hunt, ficha, personagem = null, eventos = null) {
  if (naoQuebra(ficha) || !(atual(estado, ficha) > 0)) return false;
  if (!(estado.salvaguardaEspera > 0)) estado.salvaguardaEspera = espera(ficha);
  quebrar(estado, hunt, personagem, eventos);
  return true;
}

/** A Salvaguarda QUEBROU (chegou a 0 por um acerto): marca e chama o que sai na quebra. */
function quebrar(estado, hunt, personagem, eventos) {
  estado.salvaguarda = 0;
  estado.salvaguardaQuebrada = true;
  if (hunt) {
    hunt.salvaguardaQuebrouEm = hunt.clock ?? 0;
    // a condição Intacta/Rompida mudou: a ficha é refeita no tique (`cacadas`)
    hunt.poeFichaMudou = true;
    // "Efeito é removido quando a Proteção Quebrar" (a Preparação de Vorana): o efeito do frasco acaba agora (o tique dos frascos o tira)
    for (const a of Object.values(hunt.frascosPoe?.ativos ?? {})) if (a?.saiNaQuebra && a.ate > (hunt.clock ?? 0)) a.ate = hunt.clock ?? 0;
  }
  aoQuebrar?.(estado, hunt, personagem, eventos ?? []);
}

let aoRestaurar = null;
/** (acoes.mjs) O que sai quando a Salvaguarda é RESTAURADA depois de ter descido: o evento `salvaguardaRestaurada` ("Remove uma Afecção Danificadora aleatória"). */
export function definirAoRestaurar(fn) { aoRestaurar = fn; }
/** Ela estava abaixo do máximo (a espera correndo ou quebrada): a restauração conta como "Restaurada". */
const desceu = (estado) => estado.salvaguardaEspera > 0 || !!estado.salvaguardaQuebrada;
function restaurada(estado, estava) {
  if (!estava) return;
  if (estado.hunt) estado.hunt.poeFichaMudou = true;
  aoRestaurar?.(estado, estado.hunt ?? null);
}

/** A Salvaguarda volta inteira agora (o Frasco de Ferro; "Restaurar a Salvaguarda ao Bloquear"). Sem a ficha (o frasco), ela fica cheia na próxima leitura (`atual`). */
export function restaurar(estado, ficha = null) {
  const estava = desceu(estado);
  if (!ficha) {
    estado.salvaguarda = null;
    estado.salvaguardaEspera = 0;
    estado.salvaguardaQuebrada = false;
    restaurada(estado, estava);
    return true;
  }
  const max = maximo(ficha);
  if (!(max > 0)) return false;
  estado.salvaguarda = max;
  estado.salvaguardaEspera = 0;
  estado.salvaguardaQuebrada = false;
  restaurada(estado, estava);
  return true;
}

/** O tique (`ms` de tempo de jogo): a espera corre; no fim, a Salvaguarda volta inteira. Devolve true quando ela voltou agora. */
export function recarregar(estado, ficha, ms) {
  const max = maximo(ficha);
  if (!(max > 0)) {
    if (estado.salvaguarda) estado.salvaguarda = 0;
    estado.salvaguardaEspera = 0;
    estado.salvaguardaQuebrada = false;
    return false;
  }
  if (!(estado.salvaguardaEspera > 0)) return false;
  estado.salvaguardaEspera -= ms;
  if (estado.salvaguardaEspera > 0) return false;
  return restaurar(estado, ficha);
}

/**
 * (o Conjurar ao Perder Salvaguarda) "Magias reforçadas têm a velocidade de recarga aumentada em 5% por 100 Salvaguarda, até 400%": a recarga do gatilho ÷ (1 + o
 * bônus), pela Salvaguarda MÁXIMA (na quebra a atual é 0). Por 100 inteiros, como os "por N" do PoE.
 */
export function recargaDoGatilho(recargaMs, ficha, { porCemPct = 0, maxPct = Infinity } = {}) {
  const bonus = Math.min(maxPct, porCemPct * Math.floor(maximo(ficha) / 100));
  return Math.round(recargaMs / Math.max(0.1, 1 + bonus / 100));
}
