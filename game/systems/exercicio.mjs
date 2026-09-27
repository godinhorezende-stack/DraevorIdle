// Exercise — treinar no boneco gastando as cargas de uma arma de treino, no
// formato que a tela do client lê (`escolherExercise`, panels.mjs):
// `character.exercicios` (as armas na mochila), `character.exercicio` (a que
// está na mão: `{itemId, name, skill, cargas, restantes, segundos, treinando}`)
// e `character.exercicioFalta` (quanto sobra do mesmo tipo). Ao parar ou
// acabar, o relatório `treinoReport {ganho, gastos, segundos, exercise}`.
//
// Os dados de cada arma (perícia, cargas, bônus 1,3 das Boosted) são os da
// Ravox Store real. O ritmo é o do texto do client: um golpe (uma carga) a
// cada 0,4s, ou 0,2s com o Scroll Speed Exercise. Cada golpe é uma tentativa na
// perícia da arma (x bônus); nas de magia (rod/wand), mana gasta para o magic
// level — a quantidade por carga é uma aproximação (o servidor original não
// manda a conta).
import { STORE_REAL, ITEM_CATALOG, CITY_META, bloqueado } from './dados.mjs';
import * as R from './regras.mjs';
import * as Treino from './treino.mjs';

/*
 * ---- No boneco, batendo ----
 *
 * "o treino com exercise funciona em qualquer lugar; ele teria que
 * teletransportar para o lado do dummy e ficar simulando a batida de acordo com
 * o tipo de arma". A cidade real tem três Exercise Dummy (`CITY_META.objetos`,
 * `acao: 'exercise'`), e a captura dela mostra os jogadores do original
 * parados colados neles, virados para o boneco (Hela em 108,63 olhando para o
 * norte, para o boneco de 108,62; Kai Parker em 107,62 olhando para o leste).
 *
 * Ao começar, o personagem vai para a casa livre colada no boneco mais perto
 * (as dos lados primeiro, para ele ficar de frente) e cada carga gasta é um
 * golpe na tela, com o efeito da arma — o do script de exercise do servidor
 * base (canary): arco atira flecha, rod o gelo pequeno, wand o fogo; as de
 * corpo a corpo acertam o boneco, o escudo bloqueia. Afastar-se do boneco
 * para o treino (ver `sessao.mjs`).
 */
const BONECOS = (CITY_META.objetos ?? []).filter((o) => o.acao === 'exercise');
const EFEITO_DO_GOLPE = { melee: 10, shielding: 4 }; // CONST_ME_HITAREA, CONST_ME_BLOCKHIT
const TIRO_DA_ARMA = { distance: 3, rod: 37, wand: 4 }; // CONST_ANI_SIMPLEARROW, SMALLICE, FIRE
const LADOS = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]];

/** A casa colada num boneco mais perto de `pos`, e o boneco. */
function lugarNoBoneco(pos) {
  let melhor = null;
  for (const b of BONECOS) {
    for (const [k, [dx, dy]] of LADOS.entries()) {
      const c = { x: b.x + dx, y: b.y + dy };
      if (bloqueado(c.x, c.y) || BONECOS.some((o) => o.x === c.x && o.y === c.y)) continue;
      // Diagonal só se as dos lados estiverem bem mais longe: nela ele não fica de frente.
      const custo = Math.max(Math.abs(c.x - pos.x), Math.abs(c.y - pos.y)) + (k >= 4 ? 3 : 0);
      if (!melhor || custo < melhor.custo) melhor = { custo, casa: c, boneco: b };
    }
  }
  return melhor;
}

/** Para que lado ele olha, de `de` para `para` (0 norte, 1 leste, 2 sul, 3 oeste). */
function direcao(de, para) {
  const dx = para.x - de.x;
  const dy = para.y - de.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 1 : 3;
  return dy > 0 ? 2 : 0;
}

/** O golpe na tela, como a arma de treino bate. */
function golpeNaTela(estado, arma, eventos) {
  const boneco = estado.exercicio?.boneco;
  if (!eventos || !boneco) return;
  const de = estado.pos;
  const tipo = arma.skill === 'magic' ? (/rod/i.test(arma.name) ? 'rod' : 'wand') : arma.skill;
  estado.pos.dir = direcao(de, boneco);
  if (TIRO_DA_ARMA[tipo]) eventos.push({ t: 'shot', id: TIRO_DA_ARMA[tipo], x: de.x, y: de.y, tx: boneco.x, ty: boneco.y });
  eventos.push({ t: 'fx', id: EFEITO_DO_GOLPE[tipo] ?? EFEITO_DO_GOLPE.melee, uid: boneco.uid, x: boneco.x, y: boneco.y });
}

/** Ainda está colado no boneco em que começou? (Andou para longe: o treino para.) */
export function noBoneco(estado) {
  const b = estado.exercicio?.boneco;
  if (!b) return true;
  return Math.max(Math.abs(estado.pos.x - b.x), Math.abs(estado.pos.y - b.y)) <= 1 && (estado.pos.z ?? R.POSICAO_INICIAL.z) === R.POSICAO_INICIAL.z;
}

const ARMAS = new Map((STORE_REAL.exercises ?? []).map((e) => [e.itemId, e]));
export const SCROLL_SPEED = 55386;
const INTERVALO_MS = 400;
const MANA_POR_CARGA = 40;
const ESCROLL_MS = 3 * 3_600_000;

export const ehArmaDeTreino = (id) => ARMAS.has(Number(id));
const cargasDe = (p) => p.carga ?? ARMAS.get(p.id)?.cargas ?? ITEM_CATALOG[p.id]?.charges ?? 0;
const intervalo = (estado) => ((estado.scrollExercise ?? 0) > 0 ? INTERVALO_MS / 2 : INTERVALO_MS);

/** As armas de treino da mochila, agrupadas por tipo (a começada primeiro, depois a de menos cargas). */
function armasNaMochila(estado) {
  return (estado.inventory ?? []).filter((p) => ehArmaDeTreino(p.id));
}

export function lista(estado) {
  const grupos = new Map();
  for (const p of armasNaMochila(estado)) {
    const a = ARMAS.get(p.id);
    const g = grupos.get(p.id) ?? { itemId: p.id, arte: p.id, name: a.name, skill: a.skill, cargas: a.cargas, restantes: Infinity, quantidade: 0 };
    g.quantidade += 1;
    g.restantes = Math.min(g.restantes, cargasDe(p));
    grupos.set(p.id, g);
  }
  return [...grupos.values()];
}

function pecaDaMao(estado) {
  const ex = estado.exercicio;
  if (!ex) return null;
  const inv = armasNaMochila(estado).filter((p) => p.id === ex.itemId);
  return inv.sort((a, b) => cargasDe(a) - cargasDe(b))[0] ?? null;
}

/** `send({t:'training', action:'start', mode:'exercise', itemId?})`. */
export function comecar(estado, { itemId }) {
  if (estado.hunt) return { ok: false, erro: 'Saia da caçada para treinar.' };
  const id = Number(itemId ?? estado.exercicio?.itemId);
  if (!ehArmaDeTreino(id) || !armasNaMochila(estado).some((p) => p.id === id)) return { ok: false, erro: 'Você não tem essa arma de treino.' };
  const antes = Treino.paraCliente(estado);
  // Vai para o lado do boneco mais perto, de frente para ele.
  const lugar = estado.pos ? lugarNoBoneco(estado.pos) : null;
  if (lugar) {
    estado.pos = { ...estado.pos, x: lugar.casa.x, y: lugar.casa.y, z: R.POSICAO_INICIAL.z, dir: direcao(lugar.casa, lugar.boneco) };
    estado.rumo = null;
  }
  const boneco = lugar ? { uid: lugar.boneco.uid, x: lugar.boneco.x, y: lugar.boneco.y } : null;
  estado.exercicio = { itemId: id, treinando: true, desde: Date.now(), acumulado: 0, gastas: {}, antes, boneco };
  return { ok: true };
}

/** `send({t:'training', action:'stop'})` — para e devolve o relatório. */
export function parar(estado) {
  const ex = estado.exercicio;
  if (!ex?.treinando) return { ok: false, erro: 'Você não está treinando.' };
  ex.treinando = false;
  return { ok: true, relatorio: relatorio(estado) };
}

function relatorio(estado) {
  const ex = estado.exercicio;
  const agora = Treino.paraCliente(estado);
  const ganho = [];
  for (const [skill, v] of [...Object.entries(agora.skills), ['magic', agora.magic]]) {
    const de = skill === 'magic' ? ex.antes.magic : ex.antes.skills[skill];
    if (!de || (v.value === de.value && Math.abs(v.percent - de.percent) < 1e-6)) continue;
    ganho.push({ skill, de: de.value, dePercent: de.percent, para: v.value, paraPercent: v.percent, niveis: v.value - de.value, golpes: ex.golpes ?? 0 });
  }
  const gastos = Object.entries(ex.gastas ?? {}).map(([id, cargas]) => ({ itemId: Number(id), name: ARMAS.get(Number(id))?.name, cargas }));
  return { t: 'treinoReport', ganho, gastos, segundos: Math.round((Date.now() - ex.desde) / 1000), exercise: true };
}

/**
 * Tique na cidade. Gasta as cargas no ritmo e treina. Acabando a arma: pega a
 * próxima do mesmo tipo se `settings.exerciseAuto`, senão para. Devolve o
 * relatório quando o treino terminar sozinho. Cada golpe vai para `eventos`
 * (o efeito na tela, ver `golpeNaTela`), quando quem chama passa a lista.
 */
export function tique(estado, ms, eventos = null) {
  const ex = estado.exercicio;
  if (!ex?.treinando || !(ms > 0)) return null;
  if (estado.scrollExercise > 0) estado.scrollExercise = Math.max(0, estado.scrollExercise - ms);
  ex.acumulado += ms;
  const passo = intervalo(estado);
  while (ex.acumulado >= passo) {
    ex.acumulado -= passo;
    const peca = pecaDaMao(estado);
    if (!peca) {
      // Acabou esta arma: a próxima do mesmo tipo, se a marca estiver ligada.
      const skill = ARMAS.get(ex.itemId)?.skill;
      const proxima = estado.settings?.exerciseAuto
        ? armasNaMochila(estado).filter((p) => ARMAS.get(p.id)?.skill === skill).sort((a, b) => cargasDe(a) - cargasDe(b) || (ARMAS.get(a.id).coins ?? 0) - (ARMAS.get(b.id).coins ?? 0))[0]
        : null;
      if (!proxima) {
        ex.treinando = false;
        return relatorio(estado);
      }
      ex.itemId = proxima.id;
      continue;
    }
    const arma = ARMAS.get(peca.id);
    peca.carga = cargasDe(peca) - 1;
    ex.gastas[peca.id] = (ex.gastas[peca.id] ?? 0) + 1;
    ex.golpes = (ex.golpes ?? 0) + 1;
    golpeNaTela(estado, arma, eventos);
    // Magia: 5x o pátio (cada carga vale 2s de regen: 0,4s x 5), nunca menos que 40.
    if (arma.skill === 'magic') Treino.gastarMana(estado, Math.max(MANA_POR_CARGA, Treino.manaDoPatioPorSegundo(estado) * 2) * (arma.bonus ?? 1));
    else {
      ex.fracao = (ex.fracao ?? 0) + (arma.bonus ?? 1);
      const n = Math.floor(ex.fracao);
      ex.fracao -= n;
      if (n) Treino.treinar(estado, arma.skill, n);
    }
    if (peca.carga <= 0) estado.inventory = estado.inventory.filter((p) => p !== peca);
  }
  return null;
}

/** Scroll Speed Exercise: 3h de treino em dobro, que só descem treinando. */
export function usarScroll(estado) {
  estado.scrollExercise = (estado.scrollExercise ?? 0) + ESCROLL_MS;
  return { ok: true, notice: 'Treino em dobro por 3 horas de treino.' };
}

/** `exercicio`, `exercicios` e `exercicioFalta`, como a tela lê. */
export function paraCliente(estado) {
  const ex = estado.exercicio;
  const peca = ex ? pecaDaMao(estado) : null;
  const arma = ex ? ARMAS.get(ex.itemId) : null;
  const passo = intervalo(estado) / 1000;
  const doTipo = arma ? armasNaMochila(estado).filter((p) => ARMAS.get(p.id)?.skill === arma.skill) : [];
  const cargasTipo = doTipo.reduce((a, p) => a + cargasDe(p), 0);
  return {
    exercicio: ex && arma
      ? { itemId: ex.itemId, arte: ex.itemId, name: arma.name, skill: arma.skill, cargas: arma.cargas, restantes: peca ? cargasDe(peca) : 0, segundos: Math.round((peca ? cargasDe(peca) : 0) * passo), treinando: !!ex.treinando }
      : null,
    exercicios: lista(estado),
    exercicioFalta: ex && arma
      ? { armas: doTipo.length, cargasTipo, segundos: Math.round((peca ? cargasDe(peca) : 0) * passo), segundosTipo: Math.round(cargasTipo * passo), seguido: !!estado.settings?.exerciseAuto }
      : null,
  };
}
